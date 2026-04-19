const db = require("../../config/db");
const logger = require("../../config/logger");
const schedulesService = require("../schedules/schedules.service");
const { uploadBase64File } = require("../../utils/drive");
const axios = require("axios");
const crypto = require("crypto");
const { callOdoo, IntegrationDisabledError } = require("../integrations/odooClient");

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

const ASSIGNER_ROLES = new Set([
  "jefe_comercial",
  "gerencia",
  "gerente",
  "admin",
  "administrador",
  "ti",
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
const ODOO_SYNC_ALLOWED_ROLES = new Set([
  "jefe_comercial",
  "jefe_de_comercial",
  "gerencia",
  "gerente",
  "admin",
  "administrador",
  "ti",
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

function hasRole(user, allowedRoles) {
  return allowedRoles.has(normalizeRole(user?.role));
}

function isManager(user) {
  return hasRole(user, FULL_ACCESS_ROLES);
}

function canAssignClients(user) {
  return hasRole(user, ASSIGNER_ROLES);
}

function isAdvisor(user) {
  return isManager(user) || ADVISOR_ROLES.has(normalizeRole(user?.role));
}

function canSyncOdooClients(user) {
  return ODOO_SYNC_ALLOWED_ROLES.has(normalizeRole(user?.role));
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

async function ensureTables() {
  await db.query(`
    ALTER TABLE client_requests
      ADD COLUMN IF NOT EXISTS external_source TEXT,
      ADD COLUMN IF NOT EXISTS external_id TEXT,
      ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS bpadt_certification_file_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS approval_letter_file_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS consent_record_file_id VARCHAR(255);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_client_requests_external_source
      ON client_requests (external_source);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_client_requests_external_identity
      ON client_requests (external_source, external_id)
      WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
  `);

  await db.query(`
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

  await db.query(`
    ALTER TABLE client_assignments
      ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(20) NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS reason TEXT;
  `);

  await db.query(`
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

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_client_assignments_client_active
      ON client_assignments (client_request_id, is_active, starts_at, ends_at);
    CREATE INDEX IF NOT EXISTS idx_client_assignments_assigned_email
      ON client_assignments (assigned_to_email);
  `);

  await db.query(`
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
  await db.query(`
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

  await db.query(`
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

  // Asegurar columnas nuevas en instalaciones existentes
  await db.query(`
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

  await db.query(`
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

  await db.query(`
    CREATE TABLE IF NOT EXISTS client_interactions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('call', 'visit')),
      notes TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_client_interactions_client_created_at
      ON client_interactions (client_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_client_interactions_created_by
      ON client_interactions (created_by);
  `);

  await db.query(`
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

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_client_locations_client_id
      ON client_locations (client_id);
    CREATE INDEX IF NOT EXISTS idx_client_locations_geo
      ON client_locations (lat, lng);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_client_locations_single_main
      ON client_locations (client_id)
      WHERE is_main = TRUE;
  `);

  await db.query(`
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
  if (isManager(user)) return;

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

  return {
    ...request,
    asignados,
    assignment_details: assignmentDetails,
    locations,
    attachments: isManager(user) ? getClientRequestAttachments(request) : [],
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

function normalizeText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function extractProvinceFromStateId(stateId) {
  if (!stateId) return "";
  if (Array.isArray(stateId) && stateId.length > 1) {
    return normalizeText(stateId[1]);
  }
  return normalizeText(stateId);
}

function isGenericOdooClientName(name) {
  const normalized = normalizeText(name).toUpperCase();
  if (!normalized) return true;
  return /^CLIENTE( ID)?\s+[0-9]{1,13}$/.test(normalized);
}

function isLikelyTaxId(value) {
  const normalized = normalizeText(value).replace(/\s+/g, "");
  return /^[0-9]{10,13}$/.test(normalized);
}

function mapOdooPartnerToClientDraft(partner = {}) {
  const rawCandidates = [
    partner.commercial_company_name,
    partner.company_name,
    partner.display_name,
    partner.name,
  ];
  const rawName = rawCandidates
    .map((item) => normalizeText(item))
    .find((item) => item && !isGenericOdooClientName(item)) || "";
  const vat = normalizeText(partner.vat);
  const email = normalizeText(partner.email);
  const name = rawName || (isLikelyTaxId(vat) ? `RUC ${vat}` : email ? email : "");
  const phone = normalizeText(partner.phone);
  const mobile = normalizeText(partner.mobile);
  const city = normalizeText(partner.city);
  const province = extractProvinceFromStateId(partner.state_id);
  const contactAddress =
    normalizeText(partner.contact_address) || normalizeText(partner.street) || "Direccion no registrada";

  return {
    external_source: "odoo",
    external_id: normalizeText(partner.id),
    external_updated_at: normalizeText(partner.write_date) || null,
    commercial_name: name,
    ruc_cedula: vat || null,
    client_email: email || null,
    consent_recipient_email: email || null,
    shipping_contact_name: name,
    shipping_address: contactAddress,
    shipping_city: city || "Ciudad no especificada",
    shipping_province: province || "Provincia no especificada",
    shipping_phone: phone || null,
    shipping_cellphone: mobile || null,
  };
}

async function fetchOdooCommercialPartnersPage({ offset = 0, limit = 500 } = {}) {
  const requestedFields = [
    "id",
    "name",
    "display_name",
    "commercial_company_name",
    "company_name",
    "write_date",
    "vat",
    "email",
    "phone",
    "mobile",
    "street",
    "city",
    "state_id",
    "contact_address",
  ];

  let partnerFields = requestedFields;
  try {
    const fieldsMeta = await callOdoo({
      method: "execute_kw",
      eventType: "clients.sync.odoo.fields",
      params: {
        model: "res.partner",
        method: "fields_get",
        args: [],
        kwargs: {
          attributes: ["type"],
        },
      },
    });

    if (fieldsMeta && typeof fieldsMeta === "object" && !Array.isArray(fieldsMeta)) {
      const availableFieldNames = new Set(Object.keys(fieldsMeta));
      partnerFields = requestedFields.filter((fieldName) => availableFieldNames.has(fieldName));
    }
  } catch (_error) {
    partnerFields = requestedFields.filter((fieldName) => fieldName !== "mobile");
  }

  const result = await callOdoo({
    method: "execute_kw",
    eventType: "clients.sync.odoo",
    params: {
      model: "res.partner",
      method: "search_read",
      args: [[["active", "=", true], ["customer_rank", ">", 0]]],
      kwargs: {
        fields: partnerFields,
        order: "write_date desc",
        limit,
        offset,
      },
    },
  });

  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.records)) return result.records;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

async function fetchOdooCommercialPartners() {
  const batchSize = 500;
  const maxRows = Number.parseInt(process.env.ODOO_CLIENTS_SYNC_MAX_ROWS || "50000", 10);
  const safeMaxRows = Number.isFinite(maxRows) && maxRows > 0 ? maxRows : 50000;

  const allPartners = [];
  let offset = 0;

  while (allPartners.length < safeMaxRows) {
    const page = await fetchOdooCommercialPartnersPage({
      offset,
      limit: Math.min(batchSize, safeMaxRows - allPartners.length),
    });
    if (!page.length) break;
    allPartners.push(...page);
    if (page.length < batchSize) break;
    offset += page.length;
  }

  return allPartners;
}

async function syncOdooPartnersIntoClientRequests({ user }) {
  if (!canSyncOdooClients(user)) return;

  let partners = [];
  try {
    partners = await fetchOdooCommercialPartners();
  } catch (error) {
    if (error instanceof IntegrationDisabledError || error?.code === "ODOO_INTEGRATION_DISABLED") {
      return;
    }
    logger.warn(
      { error: error.message, code: error.code || null, role: user?.role || null },
      "No se pudo sincronizar clientes desde Odoo",
    );
    return;
  }

  if (!partners.length) return;

  for (const partner of partners) {
    const draft = mapOdooPartnerToClientDraft(partner);
    const externalId = normalizeText(draft.external_id);
    if (!externalId) continue;
    if (!normalizeText(draft.commercial_name)) continue;

    const rucKey = normalizeText(draft.ruc_cedula).toLowerCase();
    const emailKey = normalizeEmail(draft.client_email);
    const nameKey = normalizeText(draft.commercial_name).toLowerCase();

    try {
      const candidateParams = [];
      const candidatePredicates = [];

      if (rucKey) {
        candidateParams.push(rucKey);
        candidatePredicates.push(`LOWER(TRIM(COALESCE(ruc_cedula, ''))) = $${candidateParams.length + 2}`);
      }
      if (emailKey) {
        candidateParams.push(emailKey);
        const emailParam = candidateParams.length + 2;
        candidatePredicates.push(
          `(
            LOWER(TRIM(COALESCE(client_email, ''))) = $${emailParam}
            OR LOWER(TRIM(COALESCE(consent_recipient_email, ''))) = $${emailParam}
          )`,
        );
      }
      if (nameKey) {
        candidateParams.push(nameKey);
        candidatePredicates.push(`LOWER(TRIM(COALESCE(commercial_name, ''))) = $${candidateParams.length + 2}`);
      }

      if (candidatePredicates.length) {
        const { rows: linkedRows } = await db.query(
          `
            UPDATE client_requests
            SET
              external_source = 'odoo',
              external_id = $1,
              external_updated_at = COALESCE($2::timestamptz, external_updated_at),
              last_synced_at = NOW()
            WHERE id = (
              SELECT id
              FROM client_requests
              WHERE status = 'approved'
                AND (external_source IS NULL OR external_source = '')
                AND (${candidatePredicates.join(" OR ")})
              ORDER BY created_at ASC
              LIMIT 1
            )
            RETURNING id
          `,
          [externalId, draft.external_updated_at, ...candidateParams],
        );

        if (linkedRows.length) continue;
      }

      await db.query(
        `
          INSERT INTO client_requests (
            created_by,
            status,
            approved_at,
            external_source,
            external_id,
            external_updated_at,
            last_synced_at,
            lopdp_token,
            client_type,
            data_processing_consent,
            lopdp_consent_status,
            consent_capture_method,
            consent_capture_details,
            lopdp_consent_method,
            lopdp_consent_details,
            lopdp_consent_at,
            client_sector,
            commercial_name,
            ruc_cedula,
            client_email,
            consent_recipient_email,
            shipping_contact_name,
            shipping_address,
            shipping_city,
            shipping_province,
            shipping_phone,
            shipping_cellphone
          )
          VALUES (
            $1,
            'approved',
            NOW(),
            $2,
            $3,
            $4::timestamptz,
            NOW(),
            $5,
            'persona_juridica',
            TRUE,
            'granted',
            'odoo_sync',
            'Cliente importado automáticamente desde Odoo',
            'odoo_sync',
            'Consentimiento heredado de sistema externo Odoo',
            NOW(),
            'privado',
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15
          )
          ON CONFLICT (external_source, external_id)
          DO UPDATE SET
            status = 'approved',
            approved_at = COALESCE(client_requests.approved_at, NOW()),
            external_updated_at = COALESCE(EXCLUDED.external_updated_at, client_requests.external_updated_at),
            last_synced_at = NOW(),
            commercial_name = COALESCE(NULLIF(EXCLUDED.commercial_name, ''), client_requests.commercial_name),
            ruc_cedula = COALESCE(NULLIF(EXCLUDED.ruc_cedula, ''), client_requests.ruc_cedula),
            client_email = COALESCE(NULLIF(EXCLUDED.client_email, ''), client_requests.client_email),
            consent_recipient_email = COALESCE(
              NULLIF(EXCLUDED.consent_recipient_email, ''),
              client_requests.consent_recipient_email
            ),
            shipping_contact_name = COALESCE(
              NULLIF(EXCLUDED.shipping_contact_name, ''),
              client_requests.shipping_contact_name
            ),
            shipping_address = COALESCE(NULLIF(EXCLUDED.shipping_address, ''), client_requests.shipping_address),
            shipping_city = COALESCE(NULLIF(EXCLUDED.shipping_city, ''), client_requests.shipping_city),
            shipping_province = COALESCE(NULLIF(EXCLUDED.shipping_province, ''), client_requests.shipping_province),
            shipping_phone = COALESCE(NULLIF(EXCLUDED.shipping_phone, ''), client_requests.shipping_phone),
            shipping_cellphone = COALESCE(NULLIF(EXCLUDED.shipping_cellphone, ''), client_requests.shipping_cellphone)
        `,
        [
          ODOO_SYNC_USER_EMAIL,
          "odoo",
          externalId,
          draft.external_updated_at,
          crypto.randomBytes(24).toString("hex"),
          draft.commercial_name,
          draft.ruc_cedula,
          draft.client_email,
          draft.consent_recipient_email,
          draft.shipping_contact_name,
          draft.shipping_address,
          draft.shipping_city,
          draft.shipping_province,
          draft.shipping_phone,
          draft.shipping_cellphone,
        ],
      );
    } catch (error) {
      if (error?.code === "23505") continue;
      logger.warn(
        {
          error: error.message,
          external_id: externalId,
          commercial_name: draft.commercial_name,
          ruc: draft.ruc_cedula,
          email: draft.client_email,
        },
        "No se pudo insertar cliente de Odoo en client_requests",
      );
    }
  }
}

async function syncOdooClientsBackfill({ user }) {
  await ensureTables();
  await syncOdooPartnersIntoClientRequests({ user });
}

async function listAccessibleClients({ user, q, visitDate, includeScheduleInfo = false, filterBySchedule = false }) {
  await ensureTables();
  await syncOdooPartnersIntoClientRequests({ user });
  const dateParam = visitDate || new Date().toISOString().slice(0, 10);

  const normalizedEmail = (user?.email || "").toLowerCase();
  let approvedSchedule = null;
  let plannedVisits = [];
  let plannedTechnicalByClient = {};

  if (includeScheduleInfo || filterBySchedule) {
    approvedSchedule = await schedulesService.findApprovedScheduleForMonth({
      userEmail: normalizedEmail,
      month: Number(dateParam.slice(5, 7)),
      year: Number(dateParam.slice(0, 4)),
    });

    if (approvedSchedule) {
      const { rows } = await db.query(
        `SELECT client_request_id, planned_date, city, priority, notes, schedule_id
           FROM scheduled_visits
          WHERE schedule_id = $1 AND planned_date = $2`,
        [approvedSchedule.id, dateParam],
      );
      plannedVisits = rows || [];
    }

    try {
      const { rows: technicalScheduleRows } = await db.query(
        `
        SELECT DISTINCT
          COALESCE(epr.client_id, ppr.client_request_id) AS client_request_id
        FROM servicio.cronograma_actividades_tecnicas cat
        LEFT JOIN equipment_purchase_requests epr
          ON epr.id::text = cat.source_id
        LEFT JOIN private_purchase_requests ppr
          ON ppr.id::text = cat.source_id
        WHERE cat.activity_date = $1
          AND COALESCE(epr.client_id, ppr.client_request_id) IS NOT NULL
        `,
        [dateParam],
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
  const clauses = ["cr.status = 'approved'"]; // base status filter
  clauses.push(`
    NOT (
      LOWER(COALESCE(cr.external_source, '')) = 'odoo'
      AND LOWER(COALESCE(cr.created_by, '')) = LOWER('${ODOO_SYNC_USER_EMAIL}')
      AND (
        TRIM(COALESCE(cr.commercial_name, '')) = ''
        OR UPPER(TRIM(COALESCE(cr.commercial_name, ''))) ~ '^(CLIENTE( ID)? [0-9]{1,13}|RUC ODOO-.+)$'
      )
    )
  `);

  const requestedLimit = Number.parseInt(String(process.env.CLIENTS_LIST_LIMIT || "5000"), 10);
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 200), 20000)
    : 5000;

  if (!isManager(user)) {
    params.push(user.email, user.email);
    clauses.push(`(
      LOWER(COALESCE(cr.created_by, '')) = LOWER($${params.length - 1})
      OR EXISTS (
        SELECT 1
        FROM client_assignments ca_filter
        WHERE ca_filter.client_request_id = cr.id
          AND ca_filter.is_active = TRUE
          AND (ca_filter.starts_at IS NULL OR ca_filter.starts_at <= NOW())
          AND (ca_filter.ends_at IS NULL OR ca_filter.ends_at >= NOW())
          AND LOWER(COALESCE(ca_filter.assigned_to_email, '')) = LOWER($${params.length})
      )
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
      vl.duracion_minutos
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
        LIMIT 20
      ) logs
    ) visit_history ON TRUE
    LEFT JOIN client_visit_logs vl
      ON vl.client_request_id = cr.id AND vl.user_email = $1 AND vl.visit_date = $2
    ${whereClause}
    ORDER BY cr.created_at DESC
    LIMIT ${safeLimit}
  `;

  const { rows } = await db.query(query, params);

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
    scheduleMeta: {
      total: clients.length,
      visited: visitedCount,
      pending: Math.max(0, clients.length - visitedCount),
      planned_today: plannedVisits.length,
      has_approved_schedule: Boolean(approvedSchedule),
      cities_today: citiesToday,
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

  const data = Object.fromEntries(
    Object.entries(rawData || {}).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ]),
  );

  const canEditFull = isManager(user);
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
    const error = new Error("Solo los jefes pueden asignar clientes");
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
  if (!isManager(user)) {
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
  syncOdooClientsBackfill,
  listAccessibleClients,
  getClientDetail,
  listClientLocations,
  updateClient,
  addLocation,
  updateLocation,
  removeLocation,
  assignClient,
  upsertVisitStatus,
  upsertProspectVisit,
  registerInteraction,
  getClientHistory,
};
