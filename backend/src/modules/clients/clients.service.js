const db = require("../../config/db");
const logger = require("../../config/logger");
const schedulesService = require("../schedules/schedules.service");
const { uploadBase64File } = require("../../utils/drive");
const axios = require("axios");
const crypto = require("crypto");
const { enqueueIntegrationEvent } = require("../integrations/integrationOutbox.service");
const { isCrmSyncEnabled } = require("../../config/crmDb");

const FULL_ACCESS_ROLES = new Set([
  "jefe_comercial",
  "acp_comercial",
  "backoffice",
  "backoffice_comercial",
  "gerencia",
  "gerente",
  "admin",
  "administrador",
  "ti",
]);

const FIELD_CLIENT_READ_ROLES = new Set([
  "tecnico",
  "jefe_tecnico",
  "servicio_tecnico",
  "jefe_servicio_tecnico",
  "logistica",
  "jefe_logistica",
]);

// backoffice_comercial: mismo caso que EDIT_CLIENT_ROLES/ASSIGN_CLIENT_ROLES
// en clients.routes.js (extra_roles, ej. lorena.loaiza) -- sin esto aqui, el
// gate de la ruta la dejaba pasar pero esta funcion la seguia bloqueando.
const OPERATIONS_MANAGER_ROLES = new Set([
  "jefe_operaciones",
  "jefe_de_operaciones",
  "backoffice_comercial",
]);

const ASSIGNER_ROLES = new Set([
  "jefe_operaciones",
  "jefe_de_operaciones",
  "backoffice_comercial",
]);

const ADVISOR_ROLES = new Set([
  "comercial",
  "asesor_comercial",
  "asesor",
  "ejecutivo_comercial",
  "acp_comercial",
  "backoffice",
  "backoffice_comercial",
]);
const ASSIGNABLE_ADVISOR_ROLES = new Set([
  "comercial",
  "asesor_comercial",
  "asesor",
  "ejecutivo_comercial",
  "acp_comercial",
  "backoffice",
  "backoffice_comercial",
]);
const PASSIVE_EMPLOYMENT_STATUSES = new Set(["pasivo", "desvinculado", "inactivo"]);
const ODOO_SYNC_USER_EMAIL = "odoo_sync@spi.local";

const ACTIVE_ASSIGNMENT_CONDITION = `
  ca.is_active = TRUE
  AND (ca.starts_at IS NULL OR ca.starts_at <= NOW())
  AND (ca.ends_at IS NULL OR ca.ends_at >= NOW())
`;

// Estados válidos para registros de visita.
// "in_visit" representa una visita en curso que aún no ha sido cerrada.
const VALID_VISIT_STATUS = new Set(["visited", "pending", "skipped", "in_visit"]);
const VALID_INTERACTION_TYPES = new Set(["call", "visit"]);
const GOOGLE_GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const CLIENT_VISIT_LOCATION_LEARNING_THRESHOLD = Number.parseInt(
  process.env.CLIENT_VISIT_LOCATION_LEARNING_THRESHOLD || "3",
  10,
);
const CLIENT_VISIT_LOCATION_CLUSTER_RADIUS_METERS = Number.parseInt(
  process.env.CLIENT_VISIT_LOCATION_CLUSTER_RADIUS_METERS || "250",
  10,
);

// Bug real (Lorena Loaiza, scope financiero, extra_roles=["backoffice_comercial"]):
// este helper solo miraba el rol principal, ignorando extra_roles (capacidad
// puntual otorgada sin cambiar el rol, ver migrations/276_users_extra_roles.sql).
// El gate de la ruta (requireRole en clients.routes.js) SI mira extra_roles y
// la dejaba pasar, pero toda la logica interna de este modulo (isManager,
// canAssignClients, canEditClients, etc.) seguia evaluandola como si no
// tuviera ningun permiso especial -- resultado: lista de clientes vacia
// (scope "solo mios") y asignacion bloqueada, sin ningun error visible.
function hasRole(user, allowedRoles) {
  if (allowedRoles.has(normalizeRole(user?.role))) return true;
  const extraRoles = Array.isArray(user?.extra_roles) ? user.extra_roles : [];
  return extraRoles.some((role) => allowedRoles.has(normalizeRole(role)));
}

function isManager(user) {
  return hasRole(user, FULL_ACCESS_ROLES);
}

function hasFieldClientReadAccess(user) {
  return hasRole(user, FIELD_CLIENT_READ_ROLES);
}

function canAssignClients(user) {
  return hasRole(user, ASSIGNER_ROLES);
}

function canEditClients(user) {
  return hasRole(user, OPERATIONS_MANAGER_ROLES);
}

function isAdvisor(user) {
  return isManager(user) || ADVISOR_ROLES.has(normalizeRole(user?.role));
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeInteractionType(type) {
  const raw = String(type || "").trim().toLowerCase();
  if (!raw) return null;
  if (["call", "llamada", "phone_call", "telefono"].includes(raw)) return "call";
  if (["visit", "visita"].includes(raw)) return "visit";
  return raw;
}

function toCoordinateNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildLocationAddress({ address, city, province }) {
  return [address, city, province, "Ecuador"]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function getMapsApiKey() {
  return (
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();
}

async function geocodeAddress({ address, city, province }) {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    logger.warn("GOOGLE_MAPS_SERVER_API_KEY no configurada, se omite geocodificacion de sedes");
    return { lat: null, lng: null, geocoded: false, geocode_status: "MISSING_API_KEY" };
  }

  const fullAddress = buildLocationAddress({ address, city, province });
  if (!fullAddress) {
    return { lat: null, lng: null, geocoded: false, geocode_status: "EMPTY_ADDRESS" };
  }

  try {
    const { data } = await axios.get(GOOGLE_GEOCODING_URL, {
      params: {
        address: fullAddress,
        region: "ec",
        language: "es",
        key: apiKey,
      },
      timeout: 15000,
    });

    if (!data || data.status !== "OK" || !Array.isArray(data.results) || !data.results.length) {
      return {
        lat: null,
        lng: null,
        geocoded: false,
        geocode_status: data?.status || "NO_RESULTS",
        geocode_error: data?.error_message || null,
      };
    }

    const location = data.results[0]?.geometry?.location || {};
    const lat = toCoordinateNumber(location.lat);
    const lng = toCoordinateNumber(location.lng);
    if (lat === null || lng === null) {
      return { lat: null, lng: null, geocoded: false, geocode_status: "INVALID_GEOMETRY" };
    }

    return { lat, lng, geocoded: true, geocode_status: "OK" };
  } catch (error) {
    logger.warn(
      { error: error.message, address: fullAddress },
      "Error consultando Google Geocoding para sede de cliente",
    );
    return { lat: null, lng: null, geocoded: false, geocode_status: "REQUEST_ERROR" };
  }
}

function normalizeLocationPayload(payload = {}) {
  return {
    name: String(payload.name || "").trim(),
    address: String(payload.address || "").trim(),
    city: String(payload.city || "").trim(),
    province: String(payload.province || "").trim(),
    lat: toCoordinateNumber(payload.lat),
    lng: toCoordinateNumber(payload.lng),
    is_main: Boolean(payload.is_main),
  };
}

function parseCompositeOdooLocation(value) {
  const raw = normalizeText(value);
  if (!raw.includes("/")) return null;
  const parts = raw
    .split("/")
    .map((item) => normalizeText(item))
    .filter(Boolean);
  if (parts.length < 3) return null;
  return {
    province: parts[0] || "",
    city: parts[1] || "",
    address: parts.slice(2).join(" / "),
  };
}

function normalizeOdooLocationFields({ address, city, province }) {
  const normalized = {
    address: normalizeText(address),
    city: normalizeText(city),
    province: normalizeText(province),
  };

  const parsedFromCity = parseCompositeOdooLocation(normalized.city);
  const parsedFromAddress = parseCompositeOdooLocation(normalized.address);
  const parsed = parsedFromCity || parsedFromAddress;

  if (parsed) {
    normalized.city = parsed.city || normalized.city;
    normalized.province = parsed.province || normalized.province;
    if (!normalized.address || parsedFromAddress) {
      normalized.address = parsed.address || normalized.address;
    }
  }

  return {
    address: normalized.address || "Direccion no registrada",
    city: normalized.city || "Ciudad no especificada",
    province: normalized.province || "Provincia no especificada",
  };
}

function buildDriveLink(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function getClientRequestAttachments(request = {}) {
  const attachments = [
    { key: "id_file", field: "id_file_id", label: "Documento de identificacion (PDF)" },
    { key: "ruc_file", field: "ruc_file_id", label: "RUC en PDF" },
    { key: "legal_rep_appointment_file", field: "legal_rep_appointment_file_id", label: "Nombramiento del representante legal (PDF)" },
    { key: "operating_permit_file", field: "operating_permit_file_id", label: "Permiso de funcionamiento (PDF)" },
    { key: "consent_evidence_file", field: "consent_evidence_file_id", label: "Evidencia del consentimiento LOPDP" },
    { key: "approval_letter", field: "approval_letter_file_id", label: "Oficio de aprobacion" },
    { key: "consent_record", field: "consent_record_file_id", label: "Registro de consentimiento" },
  ];

  return attachments
    .map((attachment) => {
      const fileId = request[attachment.field];
      if (!fileId) return null;
      return {
        ...attachment,
        file_id: fileId,
        link: buildDriveLink(fileId),
      };
    })
    .filter(Boolean);
}

let _tablesEnsured = false;
async function ensureTables() {
  if (_tablesEnsured) return;
  _tablesEnsured = true; // set early so concurrent requests don't pile up
  const run = async (label, sql) => {
    try {
      await db.query(sql);
    } catch (err) {
      logger.warn({ err, label }, "[CLIENTS] ensureTables: non-fatal DDL/DML failure");
    }
  };

  await run("client_requests columns", `
    ALTER TABLE client_requests
      ADD COLUMN IF NOT EXISTS external_source TEXT,
      ADD COLUMN IF NOT EXISTS external_id TEXT,
      ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS bpadt_certification_file_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS approval_letter_file_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS consent_record_file_id VARCHAR(255);
  `);

  await run("client_requests indexes", `
    CREATE INDEX IF NOT EXISTS idx_client_requests_external_source
      ON client_requests (external_source);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_client_requests_external_identity
      ON client_requests (external_source, external_id)
      WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
  `);

  await run("client_assignments table", `
    CREATE TABLE IF NOT EXISTS client_assignments (
      id SERIAL PRIMARY KEY,
      client_request_id INTEGER NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
      assigned_to_email TEXT NOT NULL,
      assigned_by_email TEXT,
      assignment_type VARCHAR(20) NOT NULL DEFAULT 'manual',
      is_temporary BOOLEAN NOT NULL DEFAULT FALSE,
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      ends_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_request_id, assigned_to_email),
      CONSTRAINT client_assignments_assignment_type_check
        CHECK (assignment_type IN ('owner', 'manual', 'temporary'))
    );
  `);

  await run("client_assignments columns", `
    ALTER TABLE client_assignments
      ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(20) NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS reason TEXT;
  `);

  await run("client_assignments constraint", `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'client_assignments_assignment_type_check'
      ) THEN
        ALTER TABLE client_assignments
          ADD CONSTRAINT client_assignments_assignment_type_check
          CHECK (assignment_type IN ('owner', 'manual', 'temporary'));
      END IF;
    END $$;
  `);

  await run("client_assignments indexes", `
    CREATE INDEX IF NOT EXISTS idx_client_assignments_client_active
      ON client_assignments (client_request_id, is_active, starts_at, ends_at);
    CREATE INDEX IF NOT EXISTS idx_client_assignments_assigned_email
      ON client_assignments (assigned_to_email);
  `);

  await run("client_assignments seed owners", `
    INSERT INTO client_assignments (
      client_request_id,
      assigned_to_email,
      assigned_by_email,
      assignment_type,
      is_temporary,
      starts_at,
      is_active,
      reason
    )
    SELECT
      cr.id,
      LOWER(cr.created_by),
      LOWER(cr.created_by),
      'owner',
      FALSE,
      COALESCE(cr.approved_at, cr.created_at, NOW()),
      TRUE,
      'Asignacion automatica por registro del cliente'
    FROM client_requests cr
    WHERE cr.status = 'approved'
      AND cr.created_by IS NOT NULL
      AND TRIM(cr.created_by) <> ''
      AND LOWER(COALESCE(cr.created_by, '')) <> LOWER('${ODOO_SYNC_USER_EMAIL}')
      AND LOWER(COALESCE(cr.external_source, '')) <> 'odoo'
    ON CONFLICT (client_request_id, assigned_to_email) DO NOTHING;
  `);

  // Los clientes migrados desde Odoo deben quedar disponibles para reasignacion real
  // por jefatura comercial, no asignados al usuario tecnico de sincronizacion.
  await run("client_assignments deactivate odoo technical", `
    UPDATE client_assignments ca
       SET is_active = FALSE,
           ends_at = COALESCE(ca.ends_at, NOW()),
           reason = COALESCE(
             NULLIF(ca.reason, ''),
             'Asignacion tecnica desactivada para habilitar asignacion comercial'
           )
      FROM client_requests cr
     WHERE ca.client_request_id = cr.id
       AND ca.is_active = TRUE
       AND LOWER(COALESCE(ca.assigned_to_email, '')) = LOWER('${ODOO_SYNC_USER_EMAIL}')
       AND (
         LOWER(COALESCE(cr.external_source, '')) = 'odoo'
         OR LOWER(COALESCE(cr.created_by, '')) = LOWER('${ODOO_SYNC_USER_EMAIL}')
       );
  `);

  await run("client_visit_logs table", `
    CREATE TABLE IF NOT EXISTS client_visit_logs (
      id SERIAL PRIMARY KEY,
      client_request_id INTEGER NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
      user_email TEXT NOT NULL,
      visit_date DATE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('visited','pending','skipped','in_visit')),
      hora_entrada TIMESTAMPTZ,
      hora_salida TIMESTAMPTZ,
      lat_entrada DOUBLE PRECISION,
      lng_entrada DOUBLE PRECISION,
      lat_salida DOUBLE PRECISION,
      lng_salida DOUBLE PRECISION,
      observaciones TEXT,
      duracion_minutos INTEGER,
      is_planned BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_request_id, user_email, visit_date)
    );
  `);

  await run("client_visit_logs columns", `
    ALTER TABLE client_visit_logs
      ADD COLUMN IF NOT EXISTS hora_entrada TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS hora_salida TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS lat_entrada DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lng_entrada DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lat_salida DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lng_salida DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS observaciones TEXT,
      ADD COLUMN IF NOT EXISTS duracion_minutos INTEGER,
      ADD COLUMN IF NOT EXISTS is_planned BOOLEAN DEFAULT FALSE;
  `);

  await run("prospect_visits table", `
    CREATE TABLE IF NOT EXISTS prospect_visits (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      prospect_name TEXT NOT NULL,
      visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
      status TEXT NOT NULL CHECK (status IN ('in_visit', 'visited')),
      check_in_time TIMESTAMPTZ,
      check_out_time TIMESTAMPTZ,
      check_in_lat DOUBLE PRECISION,
      check_in_lng DOUBLE PRECISION,
      check_out_lat DOUBLE PRECISION,
      check_out_lng DOUBLE PRECISION,
      observations TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await run("client_interactions table", `
    CREATE TABLE IF NOT EXISTS client_interactions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('call', 'visit')),
      notes TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run("client_interactions indexes", `
    CREATE INDEX IF NOT EXISTS idx_client_interactions_client_created_at
      ON client_interactions (client_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_client_interactions_created_by
      ON client_interactions (created_by);
  `);

  await run("client_locations table", `
    CREATE TABLE IF NOT EXISTS client_locations (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT,
      province TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      is_main BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run("client_locations learning columns", `
    ALTER TABLE client_locations
      ADD COLUMN IF NOT EXISTS location_source TEXT NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS visit_sample_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_learned_visit_id INTEGER,
      ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ;
  `);

  await run("client_locations indexes", `
    CREATE INDEX IF NOT EXISTS idx_client_locations_client_id
      ON client_locations (client_id);
    CREATE INDEX IF NOT EXISTS idx_client_locations_geo
      ON client_locations (lat, lng);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_client_locations_single_main
      ON client_locations (client_id)
      WHERE is_main = TRUE;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_client_locations_visit_learning
      ON client_locations (client_id)
      WHERE location_source = 'visit_learning';
  `);

  await run("client_locations seed main", `
    INSERT INTO client_locations (client_id, name, address, city, province, is_main)
    SELECT
      cr.id,
      'Sede principal',
      COALESCE(NULLIF(TRIM(cr.shipping_address), ''), 'Direccion no registrada'),
      NULLIF(TRIM(cr.shipping_city), ''),
      NULLIF(TRIM(cr.shipping_province), ''),
      TRUE
    FROM client_requests cr
    WHERE cr.status = 'approved'
      AND NULLIF(TRIM(COALESCE(cr.shipping_address, '')), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM client_locations cl
        WHERE cl.client_id = cr.id
      );
  `);
}

async function getClientOrThrow(clientId) {
  const { rows } = await db.query(
    "SELECT id, status, commercial_name, created_by FROM client_requests WHERE id = $1",
    [clientId],
  );
  if (!rows.length) {
    const error = new Error("Cliente no encontrado");
    error.status = 404;
    throw error;
  }
  if (rows[0].status !== "approved") {
    const error = new Error("El cliente aún no está aprobado");
    error.status = 400;
    throw error;
  }
  return rows[0];
}

async function ensureClientAccess({ clientId, user }) {
  if (isManager(user) || canAssignClients(user)) return;

  const { rows } = await db.query(
    `SELECT 1 FROM client_requests cr
     LEFT JOIN client_assignments ca
       ON ca.client_request_id = cr.id
      AND LOWER(ca.assigned_to_email) = LOWER($2)
      AND ${ACTIVE_ASSIGNMENT_CONDITION}
     WHERE cr.id = $1 AND (LOWER(COALESCE(cr.created_by, '')) = LOWER($2) OR ca.assigned_to_email IS NOT NULL)
     LIMIT 1`,
    [clientId, user.email],
  );
  if (!rows.length) {
    const error = new Error("No tienes acceso a este cliente");
    error.status = 403;
    throw error;
  }
}

async function getClientLocationsInternal(clientId, clientOrTx = db) {
  const { rows } = await clientOrTx.query(
    `
      SELECT
        id,
        client_id,
        name,
        address,
        city,
        province,
        lat,
        lng,
        is_main,
        created_at,
        updated_at
      FROM client_locations
      WHERE client_id = $1
      ORDER BY is_main DESC, created_at ASC, id ASC
    `,
    [clientId],
  );
  return rows;
}

async function geocodeLocationIfNeeded(location) {
  if (location.lat !== null && location.lng !== null) {
    return { ...location, geocoded: false, geocode_status: "MANUAL_COORDINATES" };
  }
  const geocoded = await geocodeAddress({
    address: location.address,
    city: location.city,
    province: location.province,
  });
  return {
    ...location,
    lat: geocoded.lat !== null ? geocoded.lat : location.lat,
    lng: geocoded.lng !== null ? geocoded.lng : location.lng,
    geocoded: geocoded.geocoded,
    geocode_status: geocoded.geocode_status,
    geocode_error: geocoded.geocode_error || null,
  };
}

async function getClientDetail({ clientId, user }) {
  await ensureTables();

  const { rows } = await db.query(
    `
      SELECT
        cr.*,
        COALESCE(
          json_agg(DISTINCT LOWER(ca.assigned_to_email))
            FILTER (WHERE ca.assigned_to_email IS NOT NULL),
          '[]'
        ) AS asignados,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'assigned_to_email', LOWER(ca.assigned_to_email),
              'assigned_to_name', COALESCE(au.fullname, au.name, ca.assigned_to_email),
              'assigned_to_role', au.role,
              'assignment_type', ca.assignment_type,
              'is_temporary', ca.is_temporary,
              'starts_at', ca.starts_at,
              'ends_at', ca.ends_at,
              'is_active', ca.is_active,
              'assigned_by_email', ca.assigned_by_email,
              'reason', ca.reason
            )
          ) FILTER (WHERE ca.assigned_to_email IS NOT NULL),
          '[]'
        ) AS assignment_details
      FROM client_requests cr
      LEFT JOIN client_assignments ca
        ON ca.client_request_id = cr.id
       AND ${ACTIVE_ASSIGNMENT_CONDITION}
      LEFT JOIN users au
        ON LOWER(au.email) = LOWER(ca.assigned_to_email)
      WHERE cr.id = $1
      GROUP BY cr.id
    `,
    [clientId],
  );

  const request = rows[0];
  if (!request) {
    const error = new Error("Cliente no encontrado");
    error.status = 404;
    throw error;
  }

  if (request.status !== "approved") {
    const error = new Error("El cliente aun no esta aprobado");
    error.status = 400;
    throw error;
  }

  await ensureClientAccess({ clientId, user });

  let asignados = request.asignados;
  if (typeof asignados === "string") {
    try {
      asignados = JSON.parse(asignados);
    } catch (e) {
      asignados = [];
    }
  }
  if (!Array.isArray(asignados)) asignados = [];

  let assignmentDetails = request.assignment_details;
  if (typeof assignmentDetails === "string") {
    try {
      assignmentDetails = JSON.parse(assignmentDetails);
    } catch (e) {
      assignmentDetails = [];
    }
  }
  if (!Array.isArray(assignmentDetails)) assignmentDetails = [];
  const locations = await getClientLocationsInternal(clientId);
  const normalizedRouteLocation = normalizeOdooLocationFields({
    address: request.shipping_address,
    city: request.shipping_city,
    province: request.shipping_province,
  });

  return {
    ...request,
    shipping_address:
      String(request.external_source || "").toLowerCase() === "odoo"
        ? normalizedRouteLocation.address
        : request.shipping_address,
    shipping_city:
      String(request.external_source || "").toLowerCase() === "odoo"
        ? normalizedRouteLocation.city
        : request.shipping_city,
    shipping_province:
      String(request.external_source || "").toLowerCase() === "odoo"
        ? normalizedRouteLocation.province
        : request.shipping_province,
    asignados,
    assignment_details: assignmentDetails,
    locations,
    attachments: isManager(user) || canEditClients(user) ? getClientRequestAttachments(request) : [],
  };
}

async function listClientLocations({ clientId, user }) {
  await ensureTables();
  await getClientOrThrow(clientId);
  await ensureClientAccess({ clientId, user });
  return getClientLocationsInternal(clientId);
}

async function addLocation({ clientId, user, payload = {} }) {
  await ensureTables();
  await getClientOrThrow(clientId);
  await ensureClientAccess({ clientId, user });
  if (!canEditClients(user)) {
    const error = new Error("Solo jefe de operaciones puede editar sedes de clientes");
    error.status = 403;
    throw error;
  }

  const normalized = normalizeLocationPayload(payload);
  if (!normalized.name) {
    const error = new Error("El nombre de la sede es obligatorio");
    error.status = 400;
    throw error;
  }
  if (!normalized.address) {
    const error = new Error("La direccion de la sede es obligatoria");
    error.status = 400;
    throw error;
  }

  const prepared = await geocodeLocationIfNeeded(normalized);
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rows: countRows } = await client.query(
      "SELECT COUNT(1)::int AS total FROM client_locations WHERE client_id = $1",
      [clientId],
    );
    const hasLocations = Number(countRows[0]?.total || 0) > 0;
    const shouldBeMain = prepared.is_main || !hasLocations;

    if (shouldBeMain) {
      await client.query("UPDATE client_locations SET is_main = FALSE, updated_at = NOW() WHERE client_id = $1", [clientId]);
    }

    const { rows } = await client.query(
      `
        INSERT INTO client_locations (
          client_id,
          name,
          address,
          city,
          province,
          lat,
          lng,
          is_main
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
      `,
      [
        clientId,
        prepared.name,
        prepared.address,
        prepared.city || null,
        prepared.province || null,
        prepared.lat,
        prepared.lng,
        shouldBeMain,
      ],
    );

    await client.query("COMMIT");
    return {
      ...rows[0],
      geocoded: prepared.geocoded,
      geocode_status: prepared.geocode_status || null,
      geocode_error: prepared.geocode_error || null,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ rollbackError: rollbackError.message, clientId }, "Error al hacer rollback en addLocation");
    }
    throw error;
  } finally {
    client.release();
  }
}

async function updateLocation({ clientId, locationId, user, payload = {} }) {
  await ensureTables();
  await getClientOrThrow(clientId);
  await ensureClientAccess({ clientId, user });
  if (!canEditClients(user)) {
    const error = new Error("Solo jefe de operaciones puede editar sedes de clientes");
    error.status = 403;
    throw error;
  }

  const incoming = payload && typeof payload === "object" ? payload : {};
  const hasField = (field) => Object.prototype.hasOwnProperty.call(incoming, field);
  const normalized = normalizeLocationPayload(incoming);

  const { rows: existingRows } = await db.query(
    "SELECT * FROM client_locations WHERE id = $1 AND client_id = $2",
    [locationId, clientId],
  );
  const existing = existingRows[0];
  if (!existing) {
    const error = new Error("Sede no encontrada");
    error.status = 404;
    throw error;
  }

  const merged = {
    name: hasField("name") ? normalized.name : String(existing.name || "").trim(),
    address: hasField("address") ? normalized.address : String(existing.address || "").trim(),
    city: hasField("city") ? normalized.city : String(existing.city || "").trim(),
    province: hasField("province") ? normalized.province : String(existing.province || "").trim(),
    lat: hasField("lat") ? normalized.lat : toCoordinateNumber(existing.lat),
    lng: hasField("lng") ? normalized.lng : toCoordinateNumber(existing.lng),
    is_main: hasField("is_main") ? Boolean(incoming.is_main) : Boolean(existing.is_main),
  };

  if (!merged.name) {
    const error = new Error("El nombre de la sede es obligatorio");
    error.status = 400;
    throw error;
  }
  if (!merged.address) {
    const error = new Error("La direccion de la sede es obligatoria");
    error.status = 400;
    throw error;
  }

  const addressChanged =
    merged.address !== String(existing.address || "").trim() ||
    merged.city !== String(existing.city || "").trim() ||
    merged.province !== String(existing.province || "").trim();

  let prepared = { ...merged, geocoded: false, geocode_status: "UNCHANGED", geocode_error: null };
  if ((prepared.lat === null || prepared.lng === null) && (addressChanged || hasField("lat") || hasField("lng"))) {
    prepared = await geocodeLocationIfNeeded(prepared);
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    if (prepared.is_main) {
      await client.query(
        "UPDATE client_locations SET is_main = FALSE, updated_at = NOW() WHERE client_id = $1 AND id <> $2",
        [clientId, locationId],
      );
    }

    const { rows } = await client.query(
      `
        UPDATE client_locations
        SET
          name = $1,
          address = $2,
          city = $3,
          province = $4,
          lat = $5,
          lng = $6,
          is_main = $7,
          updated_at = NOW()
        WHERE id = $8
          AND client_id = $9
        RETURNING *
      `,
      [
        prepared.name,
        prepared.address,
        prepared.city || null,
        prepared.province || null,
        prepared.lat,
        prepared.lng,
        prepared.is_main,
        locationId,
        clientId,
      ],
    );

    if (!rows.length) {
      const error = new Error("Sede no encontrada");
      error.status = 404;
      throw error;
    }

    const { rows: mainRows } = await client.query(
      "SELECT id FROM client_locations WHERE client_id = $1 AND is_main = TRUE LIMIT 1",
      [clientId],
    );
    if (!mainRows.length) {
      await client.query(
        "UPDATE client_locations SET is_main = TRUE, updated_at = NOW() WHERE id = $1",
        [locationId],
      );
      rows[0].is_main = true;
    }

    await client.query("COMMIT");
    return {
      ...rows[0],
      geocoded: prepared.geocoded,
      geocode_status: prepared.geocode_status || null,
      geocode_error: prepared.geocode_error || null,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ rollbackError: rollbackError.message, clientId, locationId }, "Error al hacer rollback en updateLocation");
    }
    throw error;
  } finally {
    client.release();
  }
}

async function removeLocation({ clientId, locationId, user }) {
  await ensureTables();
  await getClientOrThrow(clientId);
  await ensureClientAccess({ clientId, user });
  if (!canEditClients(user)) {
    const error = new Error("Solo jefe de operaciones puede editar sedes de clientes");
    error.status = 403;
    throw error;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: existingRows } = await client.query(
      "SELECT id, is_main FROM client_locations WHERE id = $1 AND client_id = $2 FOR UPDATE",
      [locationId, clientId],
    );
    const existing = existingRows[0];
    if (!existing) {
      const error = new Error("Sede no encontrada");
      error.status = 404;
      throw error;
    }

    await client.query("DELETE FROM client_locations WHERE id = $1 AND client_id = $2", [locationId, clientId]);

    const { rows: mainRows } = await client.query(
      "SELECT id FROM client_locations WHERE client_id = $1 AND is_main = TRUE LIMIT 1",
      [clientId],
    );
    if (!mainRows.length) {
      const { rows: fallbackRows } = await client.query(
        "SELECT id FROM client_locations WHERE client_id = $1 ORDER BY created_at ASC, id ASC LIMIT 1",
        [clientId],
      );
      if (fallbackRows.length) {
        await client.query(
          "UPDATE client_locations SET is_main = TRUE, updated_at = NOW() WHERE id = $1",
          [fallbackRows[0].id],
        );
      }
    }

    await client.query("COMMIT");
    return { deleted: true, id: locationId };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ rollbackError: rollbackError.message, clientId, locationId }, "Error al hacer rollback en removeLocation");
    }
    throw error;
  } finally {
    client.release();
  }
}

async function syncMainLocationFromShippingAddress({
  clientId,
  shippingAddress,
  shippingCity,
  shippingProvince,
}) {
  const address = String(shippingAddress || "").trim();
  if (!address) return null;

  const city = String(shippingCity || "").trim();
  const province = String(shippingProvince || "").trim();
  const geocoded = await geocodeAddress({ address, city, province });

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: mainRows } = await client.query(
      "SELECT id, name, lat, lng FROM client_locations WHERE client_id = $1 AND is_main = TRUE LIMIT 1 FOR UPDATE",
      [clientId],
    );
    const main = mainRows[0] || null;

    if (main) {
      await client.query(
        `
          UPDATE client_locations
          SET
            name = COALESCE(NULLIF(TRIM(name), ''), 'Sede principal'),
            address = $1,
            city = $2,
            province = $3,
            lat = COALESCE($4, lat),
            lng = COALESCE($5, lng),
            is_main = TRUE,
            updated_at = NOW()
          WHERE id = $6
        `,
        [
          address,
          city || null,
          province || null,
          geocoded.lat,
          geocoded.lng,
          main.id,
        ],
      );
    } else {
      await client.query("UPDATE client_locations SET is_main = FALSE, updated_at = NOW() WHERE client_id = $1", [clientId]);
      await client.query(
        `
          INSERT INTO client_locations (
            client_id,
            name,
            address,
            city,
            province,
            lat,
            lng,
            is_main
          ) VALUES ($1, 'Sede principal', $2, $3, $4, $5, $6, TRUE)
        `,
        [clientId, address, city || null, province || null, geocoded.lat, geocoded.lng],
      );
    }

    await client.query("COMMIT");
    return geocoded;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ rollbackError: rollbackError.message, clientId }, "Error al hacer rollback en syncMainLocationFromShippingAddress");
    }
    throw error;
  } finally {
    client.release();
  }
}

function toFiniteCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const toRad = (value) => (Number(value) * Math.PI) / 180;

function distanceMeters({ lat1, lng1, lat2, lng2 }) {
  const radius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
}

function averageVisitCoordinates(rows = []) {
  const points = rows
    .map((row) => ({
      visitId: row.id,
      lat: toFiniteCoordinate(row.lat),
      lng: toFiniteCoordinate(row.lng),
    }))
    .filter((point) => point.lat !== null && point.lng !== null);

  if (points.length < CLIENT_VISIT_LOCATION_LEARNING_THRESHOLD) return null;

  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
  const maxDistance = Math.max(
    ...points.map((point) => distanceMeters({ lat1: lat, lng1: lng, lat2: point.lat, lng2: point.lng })),
  );

  if (maxDistance > CLIENT_VISIT_LOCATION_CLUSTER_RADIUS_METERS) {
    return {
      eligible: false,
      reason: "LOCATION_SAMPLES_NOT_CONSISTENT",
      sampleCount: points.length,
      maxDistanceMeters: Number(maxDistance.toFixed(2)),
    };
  }

  return {
    eligible: true,
    lat,
    lng,
    sampleCount: points.length,
    latestVisitId: points[0]?.visitId || null,
    maxDistanceMeters: Number(maxDistance.toFixed(2)),
  };
}

async function learnFrequentLocationFromVisits({ clientId, city = null, province = null } = {}) {
  const numericClientId = Number(clientId);
  if (!Number.isInteger(numericClientId) || numericClientId <= 0) return null;

  await ensureTables();

  const { rows: visitRows } = await db.query(
    `
      SELECT
        id,
        COALESCE(lat_entrada, lat_salida) AS lat,
        COALESCE(lng_entrada, lng_salida) AS lng,
        visit_date,
        COALESCE(hora_salida, hora_entrada, updated_at) AS sort_ts
      FROM client_visit_logs
      WHERE client_request_id = $1
        AND status = 'visited'
        AND COALESCE(lat_entrada, lat_salida) IS NOT NULL
        AND COALESCE(lng_entrada, lng_salida) IS NOT NULL
      ORDER BY COALESCE(hora_salida, hora_entrada, updated_at) DESC, id DESC
      LIMIT 10
    `,
    [numericClientId],
  );

  const learned = averageVisitCoordinates(visitRows);
  if (!learned?.eligible) return learned;

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: mainRows } = await client.query(
      `
        SELECT id, lat, lng, location_source
        FROM client_locations
        WHERE client_id = $1 AND is_main = TRUE
        LIMIT 1
        FOR UPDATE
      `,
      [numericClientId],
    );
    const mainLocation = mainRows[0] || null;
    const canFillMainLocation =
      mainLocation &&
      mainLocation.lat === null &&
      mainLocation.lng === null;

    if (canFillMainLocation) {
      const { rows } = await client.query(
        `
          UPDATE client_locations
          SET
            lat = $2,
            lng = $3,
            location_source = 'visit_learning',
            visit_sample_count = $4,
            last_learned_visit_id = $5,
            learned_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          mainLocation.id,
          learned.lat,
          learned.lng,
          learned.sampleCount,
          learned.latestVisitId,
        ],
      );
      await client.query("COMMIT");
      return { ...learned, location: rows[0], action: "main_location_updated" };
    }

    const { rows } = await client.query(
      `
        INSERT INTO client_locations (
          client_id,
          name,
          address,
          city,
          province,
          lat,
          lng,
          is_main,
          location_source,
          visit_sample_count,
          last_learned_visit_id,
          learned_at
        )
        VALUES (
          $1,
          'Ubicacion frecuente de visita',
          'Ubicacion aprendida por visitas recurrentes',
          $2,
          $3,
          $4,
          $5,
          FALSE,
          'visit_learning',
          $6,
          $7,
          NOW()
        )
        ON CONFLICT (client_id) WHERE location_source = 'visit_learning'
        DO UPDATE SET
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          city = COALESCE(EXCLUDED.city, client_locations.city),
          province = COALESCE(EXCLUDED.province, client_locations.province),
          visit_sample_count = EXCLUDED.visit_sample_count,
          last_learned_visit_id = EXCLUDED.last_learned_visit_id,
          learned_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `,
      [
        numericClientId,
        normalizeText(city) || null,
        normalizeText(province) || null,
        learned.lat,
        learned.lng,
        learned.sampleCount,
        learned.latestVisitId,
      ],
    );

    await client.query("COMMIT");
    return { ...learned, location: rows[0], action: "learned_location_upserted" };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ rollbackError: rollbackError.message, clientId: numericClientId }, "Error al hacer rollback en learnFrequentLocationFromVisits");
    }
    throw error;
  } finally {
    client.release();
  }
}

function normalizeText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

async function listAccessibleClients({
  user,
  q,
  visitDate,
  includeScheduleInfo = false,
  filterBySchedule = false,
  includeAllForBusinessCase = false,
  scheduleScope = null,
  scheduleWindow = null,
  page = 1,
  limit = null,
}) {
  await ensureTables();
  const dateParam = visitDate || new Date().toISOString().slice(0, 10);
  const normalizedScheduleWindow = String(scheduleWindow || "").trim().toLowerCase();
  const shouldUseApprovedPeriod = normalizedScheduleWindow === "approved_period";

  const normalizedEmail = (user?.email || "").toLowerCase();
  let approvedSchedule = null;
  let plannedVisits = [];
  let plannedTechnicalByClient = {};
  let scheduledLeadsToday = [];

  if (includeScheduleInfo || filterBySchedule) {
    approvedSchedule = await schedulesService.findApprovedScheduleForMonth({
      userEmail: normalizedEmail,
      month: Number(dateParam.slice(5, 7)),
      year: Number(dateParam.slice(0, 4)),
      allowPendingReapproval: true,
    });

    if (approvedSchedule) {
      const { rows } = await db.query(
        `SELECT client_request_id, planned_date, city, priority, notes, schedule_id
           FROM scheduled_visits
          WHERE schedule_id = $1
            AND ($2::boolean = TRUE OR planned_date = $3::date)
          ORDER BY planned_date ASC, priority DESC, id ASC`,
        [approvedSchedule.id, shouldUseApprovedPeriod, dateParam],
      );
      plannedVisits = rows || [];

      const { rows: leadRows } = await db.query(
        `SELECT
           sv.id AS scheduled_visit_id,
           sv.lead_id,
           sv.city,
           sv.priority,
           sv.notes,
           sv.schedule_id,
           l.full_name,
           l.company_name,
           COALESCE(pv.status, 'pending') AS visit_status,
           pv.check_in_time,
           pv.check_out_time
         FROM scheduled_visits sv
         JOIN crm.crm_leads l ON l.id = sv.lead_id
         LEFT JOIN prospect_visits pv
          ON pv.lead_id = sv.lead_id
          AND LOWER(COALESCE(pv.user_email, '')) = $3
          AND pv.visit_date = sv.planned_date
        WHERE sv.schedule_id = $1
          AND ($4::boolean = TRUE OR sv.planned_date = $2::date)
          AND sv.lead_id IS NOT NULL
        ORDER BY sv.planned_date ASC, sv.priority DESC, sv.id ASC`,
        [approvedSchedule.id, dateParam, normalizedEmail, shouldUseApprovedPeriod],
      );
      scheduledLeadsToday = leadRows || [];
    }

    try {
      const normalizedScheduleScope = String(scheduleScope || "").trim().toLowerCase();
      const technicalParams = [dateParam];
      const technicalWhere = [
        `cat.activity_date = $1`,
        `COALESCE(lower(cat.status), 'programado') IN ('programado', 'confirmado', 'en_proceso')`,
        `COALESCE(epr.client_id, ppr.client_request_id) IS NOT NULL`,
      ];

      if (normalizedScheduleScope === "mine") {
        technicalParams.push(Number(user?.id) || null, normalizedEmail);
        technicalWhere.push(`
          (
            cat.user_id = $2
            OR LOWER(COALESCE(tu.email, '')) = LOWER($3)
          )
        `);
      }

      const { rows: technicalScheduleRows } = await db.query(
        `
        SELECT DISTINCT
          COALESCE(epr.client_id, ppr.client_request_id) AS client_request_id
        FROM servicio.cronograma_actividades_tecnicas cat
        LEFT JOIN public.users tu
          ON tu.id = cat.user_id
        LEFT JOIN equipment_purchase_requests epr
          ON epr.id::text = cat.source_id
        LEFT JOIN private_purchase_requests ppr
          ON ppr.id::text = cat.source_id
        WHERE ${technicalWhere.join(" AND ")}
        `,
        technicalParams,
      );

      plannedTechnicalByClient = (technicalScheduleRows || []).reduce((acc, row) => {
        const key = Number(row?.client_request_id);
        if (!Number.isFinite(key)) return acc;
        acc[key] = { is_planned_technical: true, technical_date: dateParam };
        return acc;
      }, {});
    } catch (technicalError) {
      logger.warn(
        { error: technicalError.message, dateParam },
        "No se pudo consultar cronograma técnico para clientes",
      );
    }
  }

  const params = [user.email, dateParam];
  const plannedClientIdsForScheduleAccess =
    includeScheduleInfo && String(scheduleScope || "").trim().toLowerCase() === "mine"
      ? [...new Set(plannedVisits.map((visit) => Number(visit?.client_request_id)).filter(Number.isFinite))]
      : [];
  let plannedClientParamIndex = null;
  if (plannedClientIdsForScheduleAccess.length) {
    params.push(plannedClientIdsForScheduleAccess);
    plannedClientParamIndex = params.length;
  }
  const clauses = [
    plannedClientParamIndex
      ? `(cr.status = 'approved' OR cr.id = ANY($${plannedClientParamIndex}::int[]))`
      : "cr.status = 'approved'",
  ]; // base status filter
  clauses.push(`
    NOT (
      LOWER(COALESCE(cr.external_source, '')) = 'odoo'
      AND LOWER(COALESCE(cr.created_by, '')) = LOWER('${ODOO_SYNC_USER_EMAIL}')
      AND (
        TRIM(COALESCE(cr.commercial_name, '')) = ''
        OR LENGTH(TRIM(COALESCE(cr.commercial_name, ''))) <= 1
        OR UPPER(TRIM(COALESCE(cr.commercial_name, ''))) ~ '^(CLIENTE( ID)? [0-9]{1,13}|RUC ODOO-.+)$'
      )
    )
  `);

  const requestedLimit =
    Number.parseInt(String(limit || process.env.CLIENTS_LIST_LIMIT || "100"), 10);
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 25), 250)
    : 100;
  const safePage = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;
  const safeOffset = (safePage - 1) * safeLimit;

  // canAssignClients (jefe_operaciones) necesita ver la lista completa para poder elegir a
  // quien asignar cada cliente; sin esto queda ciego apenas no tiene asignaciones activas propias.
  const canBypassAssignmentScope = includeAllForBusinessCase || canAssignClients(user);

  if (!canBypassAssignmentScope && !isManager(user) && !hasFieldClientReadAccess(user)) {
    params.push(user.email, user.email);
    const createdByParamIndex = params.length - 1;
    const assignedToParamIndex = params.length;
    const plannedClientAccessClause = plannedClientParamIndex
      ? `OR cr.id = ANY($${plannedClientParamIndex}::int[])`
      : "";
    clauses.push(`(
      LOWER(COALESCE(cr.created_by, '')) = LOWER($${createdByParamIndex})
      OR EXISTS (
        SELECT 1
        FROM client_assignments ca_filter
        WHERE ca_filter.client_request_id = cr.id
          AND ca_filter.is_active = TRUE
          AND (ca_filter.starts_at IS NULL OR ca_filter.starts_at <= NOW())
          AND (ca_filter.ends_at IS NULL OR ca_filter.ends_at >= NOW())
          AND LOWER(COALESCE(ca_filter.assigned_to_email, '')) = LOWER($${assignedToParamIndex})
      )
      ${plannedClientAccessClause}
    )`);
  }

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    const idx = params.length;
    clauses.push(
      `(LOWER(cr.commercial_name) LIKE $${idx} OR LOWER(cr.ruc_cedula) LIKE $${idx} OR CAST(cr.id AS TEXT) LIKE $${idx})`,
    );
  }

  const prospectsQuery = `
    SELECT
      id,
      prospect_name,
      status,
      check_in_time,
      check_out_time,
      check_in_lat,
      check_in_lng,
      check_out_lat,
      check_out_lng,
      observations
    FROM prospect_visits
    WHERE user_email = $1 AND visit_date = $2
    ORDER BY created_at DESC
  `;

  const prospects = await db.query(prospectsQuery, [user.email, dateParam]);

  if (filterBySchedule && approvedSchedule) {
    params.push(plannedVisits.map((v) => v.client_request_id));
    clauses.push(`cr.id = ANY($${params.length})`);
  }

  if (filterBySchedule && !approvedSchedule) {
    return {
      clients: [],
      prospects: prospects.rows,
      scheduleMeta: {
        total: 0,
        visited: 0,
        pending: 0,
        planned_today: 0,
        has_approved_schedule: false,
        cities_today: [],
      },
    };
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const query = `
    SELECT
      cr.id,
      cr.commercial_name AS nombre,
      cr.ruc_cedula AS identificador,
      cr.created_by,
      CASE
        WHEN LOWER(COALESCE(cr.created_by, '')) = LOWER('${ODOO_SYNC_USER_EMAIL}') THEN 'odoo'
        ELSE 'spi'
      END AS data_source,
      COALESCE(NULLIF(cr.client_email, ''), NULLIF(cr.consent_recipient_email, '')) AS client_email,
      COALESCE(
        NULLIF(cr.client_type, ''),
        CASE
          WHEN NULLIF(cr.legal_person_business_name, '') IS NOT NULL THEN 'persona_juridica'
          WHEN NULLIF(cr.natural_person_firstname, '') IS NOT NULL THEN 'persona_natural'
        END
      ) AS client_type,
      cr.status,
      cr.created_at,
      cr.shipping_contact_name,
      cr.shipping_city,
      cr.shipping_province,
      cr.shipping_phone,
      cr.shipping_address,
      cr.drive_folder_id,
      COALESCE(assignment_history.asignados, '[]'::json) AS asignados,
      COALESCE(assignment_history.assignment_details, '[]'::json) AS assignment_details,
      COALESCE(visit_history.visit_logs, '[]'::json) AS visit_logs,
      vl.status AS visit_status,
      vl.hora_entrada,
      vl.hora_salida,
      vl.lat_entrada,
      vl.lng_entrada,
      vl.lat_salida,
      vl.lng_salida,
      vl.observaciones,
      vl.duracion_minutos,
      crm_followup.activity_id AS crm_activity_id,
      crm_followup.activity_status AS crm_activity_status,
      crm_followup.followup_status AS crm_followup_status
    FROM client_requests cr
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(
          json_agg(DISTINCT LOWER(ca.assigned_to_email))
            FILTER (WHERE ca.assigned_to_email IS NOT NULL),
          '[]'::json
        ) AS asignados,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'assigned_to_email', LOWER(ca.assigned_to_email),
              'assigned_to_name', COALESCE(au.fullname, au.name, ca.assigned_to_email),
              'assigned_to_role', au.role,
              'is_active_user', COALESCE(au.active, false),
              'employment_status', COALESCE(cp.profile->'laboral'->>'estatus_empleado', 'activo'),
              'has_active_permiso', (
                SELECT COUNT(*) > 0
                FROM permisos_vacaciones s
                WHERE LOWER(s.user_email) = LOWER(ca.assigned_to_email)
                  AND s.status = 'approved'
                  AND LOWER(COALESCE(s.tipo_solicitud, '')) = 'permiso'
                  AND CURRENT_DATE BETWEEN s.fecha_inicio AND s.fecha_fin
              ),
              'has_active_vacaciones', (
                SELECT COUNT(*) > 0
                FROM permisos_vacaciones s
                WHERE LOWER(s.user_email) = LOWER(ca.assigned_to_email)
                  AND s.status = 'approved'
                  AND LOWER(COALESCE(s.tipo_solicitud, '')) = 'vacaciones'
                  AND CURRENT_DATE BETWEEN s.fecha_inicio AND s.fecha_fin
              ),
              'assignment_type', ca.assignment_type,
              'is_temporary', ca.is_temporary,
              'starts_at', ca.starts_at,
              'ends_at', ca.ends_at,
              'is_active', ca.is_active,
              'assigned_by_email', ca.assigned_by_email,
              'reason', ca.reason
            )
          ) FILTER (WHERE ca.assigned_to_email IS NOT NULL),
          '[]'::json
        ) AS assignment_details
      FROM client_assignments ca
      LEFT JOIN users au
        ON LOWER(COALESCE(au.email, '')) = LOWER(COALESCE(ca.assigned_to_email, ''))
      LEFT JOIN collaborator_profiles cp
        ON cp.user_id = au.id
      WHERE ca.client_request_id = cr.id
        AND ca.is_active = TRUE
        AND (ca.starts_at IS NULL OR ca.starts_at <= NOW())
        AND (ca.ends_at IS NULL OR ca.ends_at >= NOW())
    ) assignment_history ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(
          json_agg(
            json_build_object(
              'id', logs.id,
              'advisor_email', logs.user_email,
              'advisor_name', logs.advisor_name,
              'advisor_role', logs.advisor_role,
              'visit_date', logs.visit_date,
              'status', logs.status,
              'hora_entrada', logs.hora_entrada,
              'hora_salida', logs.hora_salida,
              'observaciones', logs.observaciones,
              'duracion_minutos', logs.duracion_minutos
            )
            ORDER BY logs.sort_ts DESC
          ),
          '[]'::json
        ) AS visit_logs
      FROM (
        SELECT
          cvl.id,
          LOWER(COALESCE(cvl.user_email, '')) AS user_email,
          COALESCE(vu.fullname, vu.name, cvl.user_email) AS advisor_name,
          vu.role AS advisor_role,
          cvl.visit_date,
          cvl.status,
          cvl.hora_entrada,
          cvl.hora_salida,
          cvl.observaciones,
          cvl.duracion_minutos,
          COALESCE(cvl.hora_salida, cvl.hora_entrada, cvl.visit_date::timestamp) AS sort_ts
        FROM client_visit_logs cvl
        LEFT JOIN users vu
          ON LOWER(COALESCE(vu.email, '')) = LOWER(COALESCE(cvl.user_email, ''))
        WHERE cvl.client_request_id = cr.id
        ORDER BY COALESCE(cvl.hora_salida, cvl.hora_entrada, cvl.visit_date::timestamp) DESC
        LIMIT 5
      ) logs
    ) visit_history ON TRUE
    LEFT JOIN LATERAL (
      SELECT visit_log.*
      FROM client_visit_logs visit_log
      WHERE visit_log.client_request_id = cr.id
        AND LOWER(COALESCE(visit_log.user_email, '')) = LOWER($1)
        AND ${
          shouldUseApprovedPeriod
            ? `EXTRACT(MONTH FROM visit_log.visit_date) = EXTRACT(MONTH FROM $2::date)
               AND EXTRACT(YEAR FROM visit_log.visit_date) = EXTRACT(YEAR FROM $2::date)`
            : `visit_log.visit_date = $2::date`
        }
      ORDER BY
        CASE WHEN visit_log.status = 'visited' THEN 0 WHEN visit_log.status = 'in_visit' THEN 1 ELSE 2 END,
        COALESCE(visit_log.hora_salida, visit_log.hora_entrada, visit_log.visit_date::timestamp) DESC,
        visit_log.id DESC
      LIMIT 1
    ) vl ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        a.id AS activity_id,
        a.status AS activity_status,
        CASE
          WHEN a.status = 'visited_pending_followup' THEN 'pending_followup'
          WHEN a.status = 'completed'
           AND NULLIF(TRIM(COALESCE(a.outcome_notes, '')), '') IS NOT NULL
           AND NULLIF(TRIM(COALESCE(a.outcome, '')), '') IS NOT NULL
            THEN 'completed'
          WHEN a.status = 'completed' THEN 'incomplete_followup'
          ELSE 'not_applicable'
        END AS followup_status
      FROM crm.crm_activities a
      WHERE a.deleted_at IS NULL
        AND a.activity_type = 'visita'
        AND (
          (vl.id IS NOT NULL AND a.visit_log_id = vl.id)
          OR EXISTS (
            SELECT 1
            FROM scheduled_visits sv2
            JOIN visit_schedules vs2 ON vs2.id = sv2.schedule_id
            WHERE sv2.crm_activity_id = a.id
              AND sv2.client_request_id = cr.id
              AND LOWER(COALESCE(vs2.user_email, '')) = LOWER($1)
              AND (
                sv2.planned_date = $2
                OR (
                  vs2.month = EXTRACT(MONTH FROM $2::date)
                  AND vs2.year = EXTRACT(YEAR FROM $2::date)
                )
              )
          )
        )
      ORDER BY
        CASE
          WHEN a.status = 'visited_pending_followup' THEN 0
          WHEN a.status = 'completed' THEN 1
          ELSE 2
        END,
        a.updated_at DESC
      LIMIT 1
    ) crm_followup ON TRUE
    ${whereClause}
    ORDER BY cr.created_at DESC
    LIMIT ${safeLimit + 1}
    OFFSET ${safeOffset}
  `;

  const { rows: rawRows } = await db.query(query, params);
  const hasMore = rawRows.length > safeLimit;
  const rows = hasMore ? rawRows.slice(0, safeLimit) : rawRows;

  const plannedByClient = plannedVisits.reduce((acc, visit) => {
    acc[visit.client_request_id] = {
      is_planned: true,
      planned_date: visit.planned_date,
      planned_city: visit.city,
      priority: visit.priority,
      notes: visit.notes,
      schedule_id: visit.schedule_id,
    };
    return acc;
  }, {});

  const clients = rows.map((row) => {
    const normalizedRouteLocation =
      row.data_source === "odoo"
        ? normalizeOdooLocationFields({
            address: row.shipping_address,
            city: row.shipping_city,
            province: row.shipping_province,
          })
        : null;
    let asignados = row.asignados;
    // PostgreSQL puede devolver json_agg como string JSON, parsearlo si es necesario
    if (typeof asignados === "string") {
      try {
        asignados = JSON.parse(asignados);
      } catch (e) {
        asignados = [];
      }
    }
    // Asegurar que siempre sea un array
    if (!Array.isArray(asignados)) {
      asignados = [];
    }
    let assignmentDetails = row.assignment_details;
    if (typeof assignmentDetails === "string") {
      try {
        assignmentDetails = JSON.parse(assignmentDetails);
      } catch (e) {
        assignmentDetails = [];
      }
    }
    if (!Array.isArray(assignmentDetails)) {
      assignmentDetails = [];
    }
    let visitLogs = row.visit_logs;
    if (typeof visitLogs === "string") {
      try {
        visitLogs = JSON.parse(visitLogs);
      } catch (e) {
        visitLogs = [];
      }
    }
    if (!Array.isArray(visitLogs)) {
      visitLogs = [];
    }
    const commercialPlan = plannedByClient[row.id] || { is_planned_commercial: false };
    const technicalPlan = plannedTechnicalByClient[row.id] || { is_planned_technical: false };
    const scheduled_info = includeScheduleInfo
      ? {
        ...commercialPlan,
        ...technicalPlan,
        is_planned_commercial: Boolean(commercialPlan?.is_planned || commercialPlan?.is_planned_commercial),
        is_planned_technical: Boolean(technicalPlan?.is_planned_technical),
        is_planned:
          Boolean(commercialPlan?.is_planned || commercialPlan?.is_planned_commercial) ||
          Boolean(technicalPlan?.is_planned_technical),
        schedule_id: commercialPlan?.schedule_id || approvedSchedule?.id || null,
      }
      : undefined;

    return {
      ...row,
      shipping_address: normalizedRouteLocation?.address || row.shipping_address,
      shipping_city: normalizedRouteLocation?.city || row.shipping_city,
      shipping_province: normalizedRouteLocation?.province || row.shipping_province,
      asignados,
      assignment_details: assignmentDetails,
      visit_logs: visitLogs,
      visit_status: row.visit_status || "pending",
      scheduled_info,
    };
  });

  // Also fetch prospect visits for this user and date
  const visitedCount = clients.filter((c) => (c.visit_status || "").toLowerCase() === "visited").length;
  const citiesToday = [...new Set(plannedVisits.map((v) => v.city).filter(Boolean))];

  return {
    clients,
    prospects: prospects.rows, // Return prospects too
    leads: scheduledLeadsToday,
    scheduleMeta: {
      total: clients.length,
      visited: visitedCount,
      pending: Math.max(0, clients.length - visitedCount),
      planned_today: plannedVisits.length,
      planned_period: plannedVisits.length,
      schedule_window: shouldUseApprovedPeriod ? "approved_period" : "selected_date",
      period_month: Number(dateParam.slice(5, 7)),
      period_year: Number(dateParam.slice(0, 4)),
      has_approved_schedule: Boolean(approvedSchedule),
      schedule_status: approvedSchedule?.status || null,
      cities_today: citiesToday,
    },
    pagination: {
      page: safePage,
      limit: safeLimit,
      has_more: hasMore,
      returned: clients.length,
    },
  };
}

async function updateClient({ clientId, user, rawData = {}, rawFiles = {} }) {
  await ensureTables();

  const { rows } = await db.query("SELECT * FROM client_requests WHERE id = $1", [clientId]);
  const request = rows[0];
  if (!request) {
    const error = new Error("Cliente no encontrado");
    error.status = 404;
    throw error;
  }
  if (request.status !== "approved") {
    const error = new Error("Solo puedes editar clientes aprobados");
    error.status = 400;
    throw error;
  }

  await ensureClientAccess({ clientId, user });
  if (!canEditClients(user)) {
    const error = new Error("Solo jefe de operaciones puede editar clientes aprobados");
    error.status = 403;
    throw error;
  }

  const data = Object.fromEntries(
    Object.entries(rawData || {}).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ]),
  );

  const canEditFull = canEditClients(user);
  const normalizedFiles = rawFiles && typeof rawFiles === "object" ? rawFiles : {};
  const fileIds = {};

  if (canEditFull) {
    const fileUploadPromises = Object.entries(normalizedFiles).map(async ([fieldName, fileArray]) => {
      if (!Array.isArray(fileArray) || !fileArray.length) return;
      const file = fileArray[0];
      if (!file) return;
      const driveFolderId = request.drive_folder_id;
      const uploadedFile = await uploadBase64File(
        file.originalname,
        file.buffer.toString("base64"),
        file.mimetype,
        driveFolderId,
      );
      const dbFieldName = `${fieldName}_id`;
      fileIds[dbFieldName] = uploadedFile.id;
    });
    await Promise.all(fileUploadPromises);
  }

  const limitedFields = [
    "commercial_name",
    "shipping_contact_name",
    "shipping_phone",
    "shipping_cellphone",
  ];

  const fullFields = [
    "client_type",
    "legal_person_business_name",
    "nationality",
    "natural_person_firstname",
    "natural_person_lastname",
    "commercial_name",
    "establishment_name",
    "ruc_cedula",
    "establishment_province",
    "establishment_city",
    "establishment_address",
    "establishment_reference",
    "establishment_phone",
    "establishment_cellphone",
    "legal_rep_name",
    "legal_rep_position",
    "legal_rep_id_document",
    "legal_rep_cellphone",
    "legal_rep_email",
    "shipping_contact_name",
    "shipping_address",
    "shipping_city",
    "shipping_province",
    "shipping_reference",
    "shipping_phone",
    "shipping_cellphone",
    "shipping_delivery_hours",
    "operating_permit_status",
  ];

  const fieldsToUpdate = canEditFull ? fullFields : limitedFields;

  if (canEditFull) {
    if (fileIds.legal_rep_appointment_file_id) fieldsToUpdate.push("legal_rep_appointment_file_id");
    if (fileIds.ruc_file_id) fieldsToUpdate.push("ruc_file_id");
    if (fileIds.id_file_id) fieldsToUpdate.push("id_file_id");
    if (fileIds.bpadt_certification_file_id) fieldsToUpdate.push("bpadt_certification_file_id");
    if (fileIds.operating_permit_file_id) fieldsToUpdate.push("operating_permit_file_id");
    if (fileIds.consent_evidence_file_id) fieldsToUpdate.push("consent_evidence_file_id");
    if (fileIds.approval_letter_id) fieldsToUpdate.push("approval_letter_file_id");
    if (fileIds.consent_record_id) fieldsToUpdate.push("consent_record_file_id");
  }

  const values = [];
  const setParts = fieldsToUpdate
    .map((field) => {
      let val;
      if (field.endsWith("_id")) {
        if (fileIds[field]) {
          val = fileIds[field];
        } else {
          return null;
        }
      } else {
        val = data[field];
      }
      if (val !== undefined) {
        values.push(val);
        return `${field} = $${values.length}`;
      }
      return null;
    })
    .filter(Boolean);

  if (!setParts.length) {
    return {
      ...request,
      attachments: canEditFull ? getClientRequestAttachments(request) : [],
    };
  }

  setParts.push(`updated_at = now()`);
  const setClause = setParts.join(", ");

  const query = `UPDATE client_requests SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`;
  values.push(clientId);

  const { rows: updatedRows } = await db.query(query, values);
  const updated = updatedRows[0];

  if (
    canEditFull &&
    (data.shipping_address !== undefined ||
      data.shipping_city !== undefined ||
      data.shipping_province !== undefined)
  ) {
    try {
      await syncMainLocationFromShippingAddress({
        clientId,
        shippingAddress: updated.shipping_address,
        shippingCity: updated.shipping_city,
        shippingProvince: updated.shipping_province,
      });
    } catch (locationError) {
      logger.warn(
        { locationError: locationError.message, clientId },
        "No se pudo sincronizar la sede principal despues de actualizar direccion del cliente",
      );
    }
  }

  if (isCrmSyncEnabled()) {
    try {
      await enqueueIntegrationEvent({
        eventType: "crm.client.updated",
        payload: {
          famspi_client_request_id: updated.id,
          ruc_cedula: updated.ruc_cedula,
          commercial_name: updated.commercial_name,
          client_email: updated.client_email,
          establishment_phone: updated.establishment_phone,
          establishment_city: updated.establishment_city,
          establishment_province: updated.establishment_province,
          shipping_address: updated.shipping_address,
          shipping_city: updated.shipping_city,
          shipping_province: updated.shipping_province,
          shipping_contact_name: updated.shipping_contact_name,
          legal_rep_name: updated.legal_rep_name,
          legal_rep_email: updated.legal_rep_email,
        },
        idempotencyKey: `crm.client.updated.${updated.id}.${Date.now()}`,
        correlationId: String(updated.id),
      });
    } catch (crmErr) {
      logger.warn(
        { client_request_id: updated.id, error: crmErr?.message },
        "[CRM_SYNC] Error encolando actualizacion de cliente — no bloquea el update",
      );
    }
  }

  return {
    ...updated,
    attachments: canEditFull ? getClientRequestAttachments(updated) : [],
  };
}

async function assignClient({
  clientId,
  assigneeEmail,
  user,
  temporary = false,
  startsAt = null,
  endsAt = null,
  reason = null,
  unassign = false,
}) {
  if (!canAssignClients(user)) {
    const error = new Error("Solo jefe de operaciones puede asignar clientes");
    error.status = 403;
    throw error;
  }
  await ensureTables();
  const client = await getClientOrThrow(clientId);

  const normalizedEmail = (assigneeEmail || "").toLowerCase();
  if (!normalizedEmail) {
    const error = new Error("El correo del asignado es obligatorio");
    error.status = 400;
    throw error;
  }

  if (Boolean(unassign)) {
    const { rowCount } = await db.query(
      `UPDATE client_assignments
          SET is_active = FALSE,
              ends_at = COALESCE(ends_at, NOW()),
              reason = COALESCE($3, reason)
        WHERE client_request_id = $1
          AND LOWER(COALESCE(assigned_to_email, '')) = LOWER($2)
          AND is_active = TRUE`,
      [clientId, normalizedEmail, reason ? String(reason).trim() : null],
    );

    return {
      ok: true,
      client: clientId,
      assignee: normalizedEmail,
      unassigned: true,
      affected_rows: rowCount,
    };
  }

  const { rows: assigneeRows } = await db.query(
    `
    SELECT
      u.id,
      u.email,
      u.role,
      u.active,
      COALESCE(cp.profile->'laboral'->>'estatus_empleado', 'activo') AS employment_status,
      COALESCE(time_off.has_active_permiso, FALSE) AS has_active_permiso,
      COALESCE(time_off.has_active_vacaciones, FALSE) AS has_active_vacaciones
    FROM users u
    LEFT JOIN collaborator_profiles cp
      ON cp.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE LOWER(COALESCE(p.tipo_solicitud, '')) = 'permiso') > 0 AS has_active_permiso,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(p.tipo_solicitud, '')) = 'vacaciones') > 0 AS has_active_vacaciones
      FROM permisos_vacaciones p
      WHERE LOWER(p.user_email) = LOWER(u.email)
        AND p.status = 'approved'
        AND CURRENT_DATE BETWEEN p.fecha_inicio AND p.fecha_fin
    ) time_off ON TRUE
    WHERE LOWER(u.email) = $1
    LIMIT 1
    `,
    [normalizedEmail],
  );
  const assignee = assigneeRows[0];
  if (!assignee || assignee.active === false) {
    const error = new Error("El asesor seleccionado no existe o está inactivo");
    error.status = 400;
    throw error;
  }

  const assigneeRole = normalizeRole(assignee.role);
  if (!ASSIGNABLE_ADVISOR_ROLES.has(assigneeRole)) {
    const error = new Error("Solo se pueden asignar clientes a usuarios comerciales");
    error.status = 400;
    throw error;
  }

  const employmentStatus = String(assignee.employment_status || "").trim().toLowerCase();
  if (PASSIVE_EMPLOYMENT_STATUSES.has(employmentStatus)) {
    const error = new Error("No puedes asignar clientes a un colaborador desvinculado o inactivo");
    error.status = 400;
    throw error;
  }

  if (assignee.has_active_vacaciones) {
    const error = new Error("No puedes asignar clientes a un colaborador con vacaciones activas");
    error.status = 400;
    throw error;
  }

  if (assignee.has_active_permiso) {
    const error = new Error("No puedes asignar clientes a un colaborador con permiso activo");
    error.status = 400;
    throw error;
  }

  const now = new Date();
  const normalizedStartsAt = startsAt ? new Date(startsAt) : now;
  const normalizedEndsAt = endsAt ? new Date(endsAt) : null;
  const isTemporary = Boolean(temporary);

  if (Number.isNaN(normalizedStartsAt.getTime())) {
    const error = new Error("Fecha de inicio inválida");
    error.status = 400;
    throw error;
  }

  if (isTemporary) {
    if (!normalizedEndsAt || Number.isNaN(normalizedEndsAt.getTime())) {
      const error = new Error("La fecha de fin es obligatoria para asignaciones temporales");
      error.status = 400;
      throw error;
    }
    if (normalizedEndsAt <= normalizedStartsAt) {
      const error = new Error("La fecha de fin debe ser posterior a la fecha de inicio");
      error.status = 400;
      throw error;
    }
  }

  await db.query(
    `INSERT INTO client_assignments (
       client_request_id,
       assigned_to_email,
       assigned_by_email,
       assignment_type,
       is_temporary,
       starts_at,
       ends_at,
       is_active,
       reason
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
     ON CONFLICT (client_request_id, assigned_to_email) DO UPDATE
       SET assigned_by_email = EXCLUDED.assigned_by_email,
           assignment_type = EXCLUDED.assignment_type,
           is_temporary = EXCLUDED.is_temporary,
           starts_at = EXCLUDED.starts_at,
           ends_at = EXCLUDED.ends_at,
           is_active = EXCLUDED.is_active,
           reason = EXCLUDED.reason,
           created_at = NOW()`,
    [
      clientId,
      normalizedEmail,
      (user.email || "").toLowerCase(),
      isTemporary ? "temporary" : "manual",
      isTemporary,
      normalizedStartsAt.toISOString(),
      isTemporary ? normalizedEndsAt.toISOString() : null,
      reason ? String(reason).trim() : null,
    ],
  );

  return {
    ok: true,
    client: clientId,
    assignee: normalizedEmail,
    temporary: isTemporary,
    starts_at: normalizedStartsAt.toISOString(),
    ends_at: isTemporary ? normalizedEndsAt.toISOString() : null,
  };
}

async function upsertVisitStatus({
  clientId,
  user,
  status,
  visitDate,
  hora_entrada,
  hora_salida,
  lat_entrada,
  lng_entrada,
  lat_salida,
  lng_salida,
  observaciones,
}) {
  if (!isAdvisor(user)) {
    const error = new Error("No tienes permisos para registrar visitas");
    error.status = 403;
    throw error;
  }
  await ensureTables();
  const client = await getClientOrThrow(clientId);

  const now = new Date();
  const baseDate =
    visitDate ||
    hora_entrada ||
    hora_salida ||
    now.toISOString().slice(0, 10);
  const dateValue =
    typeof baseDate === "string" && baseDate.length > 10
      ? baseDate.slice(0, 10)
      : baseDate;

  // Validar acceso a cliente
  if (!isManager(user) && !canAssignClients(user)) {
    const { rows } = await db.query(
      `SELECT 1 FROM client_requests cr
       LEFT JOIN client_assignments ca
         ON ca.client_request_id = cr.id
        AND LOWER(ca.assigned_to_email) = LOWER($2)
        AND ${ACTIVE_ASSIGNMENT_CONDITION}
       WHERE cr.id = $1 AND (LOWER(COALESCE(cr.created_by, '')) = LOWER($2) OR ca.assigned_to_email IS NOT NULL)
       LIMIT 1`,
      [clientId, user.email],
    );
    if (!rows.length) {
      const error = new Error("No tienes acceso a este cliente");
      error.status = 403;
      throw error;
    }
  }

  // Determinar estado final y duración
  let finalStatus;
  if (status && VALID_VISIT_STATUS.has(status)) {
    finalStatus = status;
  } else if (hora_salida) {
    finalStatus = "visited";
  } else if (hora_entrada) {
    finalStatus = "in_visit";
  } else {
    finalStatus = "visited";
  }

  let duracionMinutos = null;
  try {
    if (hora_entrada && hora_salida) {
      const start = new Date(hora_entrada);
      const end = new Date(hora_salida);
      const diffMs = end - start;
      if (Number.isFinite(diffMs) && diffMs >= 0) {
        duracionMinutos = Math.round(diffMs / 60000);
      }
    }
  } catch (e) {
    logger.warn({ e }, "No se pudo calcular la duración de la visita");
  }

  const { rows } = await db.query(
    `INSERT INTO client_visit_logs (
       client_request_id,
       user_email,
       visit_date,
       status,
       hora_entrada,
       hora_salida,
       lat_entrada,
       lng_entrada,
       lat_salida,
       lng_salida,
       observaciones,
       duracion_minutos
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (client_request_id, user_email, visit_date)
     DO UPDATE SET
       status = EXCLUDED.status,
       updated_at = NOW(),
       hora_entrada = COALESCE(client_visit_logs.hora_entrada, EXCLUDED.hora_entrada),
       hora_salida = COALESCE(EXCLUDED.hora_salida, client_visit_logs.hora_salida),
       lat_entrada = COALESCE(client_visit_logs.lat_entrada, EXCLUDED.lat_entrada),
       lng_entrada = COALESCE(client_visit_logs.lng_entrada, EXCLUDED.lng_entrada),
       lat_salida = COALESCE(EXCLUDED.lat_salida, client_visit_logs.lat_salida),
       lng_salida = COALESCE(EXCLUDED.lng_salida, client_visit_logs.lng_salida),
       observaciones = COALESCE(EXCLUDED.observaciones, client_visit_logs.observaciones),
       duracion_minutos = COALESCE(EXCLUDED.duracion_minutos, client_visit_logs.duracion_minutos)
     RETURNING
       id,
       status,
       hora_entrada,
       hora_salida,
       lat_entrada,
       lng_entrada,
       lat_salida,
       lng_salida,
       observaciones,
       duracion_minutos`,
    [
      clientId,
      user.email,
      dateValue,
      finalStatus,
      hora_entrada || null,
      hora_salida || null,
      lat_entrada ?? null,
      lng_entrada ?? null,
      lat_salida ?? null,
      lng_salida ?? null,
      observaciones || null,
      duracionMinutos,
    ],
  );

  logger.info(
    { clientId, user: user.email, status: rows[0].status },
    "Visita de cliente registrada",
  );

  if (rows[0].status === "visited") {
    learnFrequentLocationFromVisits({ clientId }).catch((error) => {
      logger.warn(
        { error: error?.message, clientId },
        "No se pudo actualizar ubicacion frecuente del cliente desde visitas",
      );
    });
    try {
      const scheduledVisit = await schedulesService.findTodayScheduledVisit({
        userEmail: user.email,
        clientRequestId: clientId,
        date: dateValue,
      });
      if (scheduledVisit?.crm_activity_id) {
        await schedulesService.markCrmActivityCompleted(scheduledVisit.crm_activity_id, user.id, {
          visitLogId: rows[0].id,
        });
      }
    } catch (crmActivityError) {
      logger.warn(
        { error: crmActivityError?.message, clientId, user: user.email },
        "No se pudo marcar la actividad CRM de visita como pendiente de cierre",
      );
    }
  }

  if (isCrmSyncEnabled()) {
    try {
      await enqueueIntegrationEvent({
        eventType: "crm.visit.registered",
        payload: {
          client_id:        clientId,
          client_name:      client.legal_person_business_name || client.commercial_name ||
                            `${client.natural_person_firstname || ""} ${client.natural_person_lastname || ""}`.trim() ||
                            client.ruc_cedula,
          user_email:       user.email,
          visit_date:       dateValue,
          status:           rows[0].status,
          hora_entrada:     rows[0].hora_entrada,
          hora_salida:      rows[0].hora_salida,
          observaciones:    rows[0].observaciones,
          duracion_minutos: rows[0].duracion_minutos,
        },
        idempotencyKey: `crm.visit.${clientId}.${user.email}.${dateValue}`,
        correlationId:  String(clientId),
      });
    } catch (crmErr) {
      logger.warn({ client_id: clientId, error: crmErr?.message }, "[CRM_SYNC] Error encolando visita");
    }
  }

  return rows[0];
}

async function upsertProspectVisit({
  user,
  prospectName,
  checkInTime,
  checkOutTime,
  checkInLat,
  checkInLng,
  checkOutLat,
  checkOutLng,
  observations,
  visitDate,
  visitId // Optional, if updating
}) {
  await ensureTables();
  const dateValue = visitDate || new Date().toISOString().slice(0, 10);
  let status = 'in_visit';
  if (checkOutTime) status = 'visited';

  let result;

  if (visitId) {
    // Update existing
    const query = `
      UPDATE prospect_visits
      SET 
        status = $1, 
        check_out_time = COALESCE($2, check_out_time),
        check_out_lat = COALESCE($3, check_out_lat),
        check_out_lng = COALESCE($4, check_out_lng),
        observations = COALESCE($5, observations),
        updated_at = NOW()
      WHERE id = $6 AND user_email = $7
      RETURNING *
    `;
    result = await db.query(query, [status, checkOutTime, checkOutLat, checkOutLng, observations, visitId, user.email]);
  } else {
    // Insert new
    const query = `
      INSERT INTO prospect_visits 
        (user_email, prospect_name, visit_date, status, check_in_time, check_in_lat, check_in_lng, observations)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    result = await db.query(query, [user.email, prospectName, dateValue, status, checkInTime, checkInLat, checkInLng, observations]);
  }

  return result.rows[0];
}

async function registerInteraction({ clientId, user, type, notes }) {
  if (!isAdvisor(user)) {
    const error = new Error("No tienes permisos para registrar interacciones");
    error.status = 403;
    throw error;
  }

  await ensureTables();
  await getClientOrThrow(clientId);
  await ensureClientAccess({ clientId, user });

  const normalizedType = normalizeInteractionType(type);
  if (!normalizedType || !VALID_INTERACTION_TYPES.has(normalizedType)) {
    const error = new Error("Tipo de interacción inválido. Usa 'call' o 'visit'.");
    error.status = 400;
    throw error;
  }

  const normalizedNotes = String(notes || "").trim();
  if (!normalizedNotes) {
    const error = new Error("Las notas de la interacción son obligatorias.");
    error.status = 400;
    throw error;
  }

  const createdBy = String(user?.email || "").trim().toLowerCase();
  if (!createdBy) {
    const error = new Error("Usuario inválido para registrar interacción.");
    error.status = 400;
    throw error;
  }

  const { rows } = await db.query(
    `INSERT INTO client_interactions (client_id, type, notes, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, client_id, type, notes, created_by, created_at`,
    [clientId, normalizedType, normalizedNotes, createdBy],
  );

  return rows[0];
}

async function getClientHistory({ clientId, user, limit = 100 }) {
  if (!isAdvisor(user)) {
    const error = new Error("No tienes permisos para consultar historial del cliente");
    error.status = 403;
    throw error;
  }

  await ensureTables();
  await getClientOrThrow(clientId);
  await ensureClientAccess({ clientId, user });

  const parsedLimit = Math.max(1, Math.min(Number(limit) || 100, 200));
  const { rows } = await db.query(
    `SELECT
       ci.id,
       ci.client_id,
       ci.type,
       ci.notes,
       ci.created_by,
       ci.created_at,
       COALESCE(u.fullname, u.name, ci.created_by) AS created_by_name,
       u.role AS created_by_role
     FROM client_interactions ci
     LEFT JOIN users u
       ON LOWER(u.email) = LOWER(ci.created_by)
     WHERE ci.client_id = $1
     ORDER BY ci.created_at DESC
     LIMIT $2`,
    [clientId, parsedLimit],
  );

  return rows;
}

module.exports = {
  buildDriveLink,
  listAccessibleClients,
  getClientDetail,
  listClientLocations,
  updateClient,
  addLocation,
  updateLocation,
  removeLocation,
  assignClient,
  upsertVisitStatus,
  learnFrequentLocationFromVisits,
  upsertProspectVisit,
  registerInteraction,
  getClientHistory,
};
