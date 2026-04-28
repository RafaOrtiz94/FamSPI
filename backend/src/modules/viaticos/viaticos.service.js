const db = require("../../config/db");
const logger = require("../../config/logger");
const axios = require("axios");
const { uploadBase64File } = require("../../utils/drive");
const { encrypt, decrypt } = require("../../utils/encryption");
const { HASH_ALGORITHM, computeSha256HexFromBase64 } = require("../../utils/documentHash");
const notificationsService = require("../notifications/notifications.service");

const FINANCE_ROLES = ["finanzas", "jefe_finanzas", "jefe_financiero", "gerencia", "gerencia_general"];
const OPERATIONAL_APPROVER_ROLES = [
  "jefe_comercial",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "jefe_operaciones",
  "jefe_inmediato",
  "gerencia",
  "gerencia_general",
];
const REQUESTER_ROLES = [
  "comercial",
  "jefe_comercial",
  "acp_comercial",
  "backoffice_comercial",
  "servicio_tecnico",
  "tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
];

const ALLOWED_STATUSES = new Set(["pending", "approved", "paid", "rejected"]);
const ALLOWED_SOURCE_TYPES = new Set(["client_visit", "prospect_visit", "manual_trip", "operational_exit"]);
const ALLOWED_DOC_TYPES = new Set(["invoice", "liquidation", "support"]);
const ALLOWED_WORKFLOW_STATUSES = new Set([
  "borrador",
  "pendiente_revision",
  "observado",
  "aprobado_jefe",
  "rechazado_jefe",
  "pendiente_financiero",
  "aprobado_financiero",
  "rechazado_financiero",
  "listo_pago",
  "pagado",
  "cerrado",
  "incluido_xml_ats",
  "excluido_xml_ats",
]);
const FINANCE_WORKFLOW_STATUSES = new Set([
  "pendiente_financiero",
  "aprobado_financiero",
  "rechazado_financiero",
  "listo_pago",
  "pagado",
  "cerrado",
  "incluido_xml_ats",
  "excluido_xml_ats",
]);
const OPERATIONAL_WORKFLOW_STATUSES = new Set([
  "borrador",
  "pendiente_revision",
  "observado",
  "aprobado_jefe",
  "rechazado_jefe",
  "pendiente_financiero",
]);
const ALLOWED_EXPENSE_CATEGORIES = new Set(["alimentacion", "combustible", "hospedaje"]);
const ALLOWED_DECISION_TYPES = new Set([
  "covered_fixed",
  "extraordinary_outside_zone",
  "excess_km",
  "mixed",
  "normal_reimbursement",
]);
let schemaReadyPromise = null;

const toLower = (value) => String(value || "").trim().toLowerCase();

function normalizeRoleList(value) {
  if (Array.isArray(value)) {
    return value.map(toLower).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map(toLower)
    .filter(Boolean);
}

function collectUserRoles(user = {}) {
  return new Set([
    ...normalizeRoleList(user.role),
    ...normalizeRoleList(user.scope),
    ...normalizeRoleList(user.role_name),
    ...normalizeRoleList(user.roles),
    ...normalizeRoleList(user.scopes),
  ]);
}

function isFinanceUser(user = {}) {
  const roles = collectUserRoles(user);
  return Array.from(roles).some((role) => FINANCE_ROLES.includes(role));
}

function canAccessViaticos(user = {}) {
  if (isFinanceUser(user)) return true;
  const roles = collectUserRoles(user);
  return Array.from(roles).some((role) => REQUESTER_ROLES.includes(role));
}

function assertViaticosAccess(user = {}) {
  if (!canAccessViaticos(user)) {
    const error = new Error("No tienes permisos para acceder a viaticos");
    error.status = 403;
    throw error;
  }
}

function assertFinance(user = {}) {
  if (!isFinanceUser(user)) {
    const error = new Error("Solo finanzas puede ejecutar esta accion");
    error.status = 403;
    throw error;
  }
}

function isFinanceApprover(user = {}) {
  const roles = collectUserRoles(user);
  return roles.has("finanzas") || roles.has("jefe_financiero") || roles.has("jefe_finanzas");
}

function assertFinanceApprover(user = {}) {
  if (!isFinanceApprover(user)) {
    const error = new Error("Solo finanzas o jefe_financiero puede aprobar/procesar viaticos");
    error.status = 403;
    throw error;
  }
}

function isOperationalApprover(user = {}) {
  const roles = collectUserRoles(user);
  return Array.from(roles).some((role) => OPERATIONAL_APPROVER_ROLES.includes(role));
}

function assertOperationalApprover(user = {}) {
  if (!isOperationalApprover(user)) {
    const error = new Error("Solo jefe inmediato puede ejecutar esta accion operativa");
    error.status = 403;
    throw error;
  }
}

function isAdminUser(user = {}) {
  const roles = collectUserRoles(user);
  return Array.from(roles).some((role) => ["admin", "administrador", "gerencia_general"].includes(role));
}

function assertAdminOrFinance(user = {}) {
  if (!isFinanceUser(user) && !isAdminUser(user)) {
    const error = new Error("Solo finanzas o administrador puede ejecutar esta accion");
    error.status = 403;
    throw error;
  }
}

async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowances (
      id BIGSERIAL PRIMARY KEY,
      source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('client_visit', 'prospect_visit', 'manual_trip')),
      source_id BIGINT,
      requester_email TEXT NOT NULL,
      requester_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      visit_date DATE NOT NULL,
      city TEXT,
      trip_type TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      currency VARCHAR(8) NOT NULL DEFAULT 'USD',
      distance_km NUMERIC(12,2) NOT NULL DEFAULT 0,
      outside_labor_area BOOLEAN NOT NULL DEFAULT FALSE,
      outside_labor_area_reason TEXT,
      fuel_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      liquidation_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      approved_amount NUMERIC(12,2),
      attendance_check_status VARCHAR(20) NOT NULL DEFAULT 'unchecked',
      attendance_check_payload JSONB,
      finance_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      payment_date DATE,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    ALTER TABLE travel_allowances
      ADD COLUMN IF NOT EXISTS trip_type TEXT,
      ADD COLUMN IF NOT EXISTS distance_km NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS outside_labor_area BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS outside_labor_area_reason TEXT,
      ADD COLUMN IF NOT EXISTS fuel_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS liquidation_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS attendance_check_status VARCHAR(20) NOT NULL DEFAULT 'unchecked',
      ADD COLUMN IF NOT EXISTS attendance_check_payload JSONB,
      ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
  `);

  await db.query(`
    ALTER TABLE travel_allowances
      ALTER COLUMN source_id DROP NOT NULL;
  `).catch(() => null);

  await db.query(`
    DO $$
    DECLARE
      status_constraint_name TEXT;
      source_constraint_name TEXT;
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'travel_allowances_source_type_source_id_key'
          AND conrelid = 'travel_allowances'::regclass
      ) THEN
        ALTER TABLE travel_allowances DROP CONSTRAINT travel_allowances_source_type_source_id_key;
      END IF;

      SELECT conname INTO source_constraint_name
      FROM pg_constraint
      WHERE conrelid = 'travel_allowances'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%source_type IN%';

      IF source_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE travel_allowances DROP CONSTRAINT %I', source_constraint_name);
      END IF;

      -- Always drop and recreate source_type constraint to ensure operational_exit is included
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'travel_allowances_source_type_check'
          AND conrelid = 'travel_allowances'::regclass
      ) THEN
        ALTER TABLE travel_allowances DROP CONSTRAINT travel_allowances_source_type_check;
      END IF;
      ALTER TABLE travel_allowances
        ADD CONSTRAINT travel_allowances_source_type_check
        CHECK (source_type IN ('client_visit', 'prospect_visit', 'manual_trip', 'operational_exit'));

      SELECT conname INTO status_constraint_name
      FROM pg_constraint
      WHERE conrelid = 'travel_allowances'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%attendance_check_status%';

      IF status_constraint_name IS NULL THEN
        ALTER TABLE travel_allowances
          ADD CONSTRAINT travel_allowances_attendance_check_status
          CHECK (attendance_check_status IN ('unchecked', 'matched', 'review', 'mismatch', 'no_attendance', 'insufficient_geo'));
      END IF;
    END $$;
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_travel_allowances_visit_source
      ON travel_allowances(source_type, source_id)
      WHERE source_id IS NOT NULL
        AND source_type IN ('client_visit', 'prospect_visit');
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_documents (
      id BIGSERIAL PRIMARY KEY,
      allowance_id BIGINT NOT NULL REFERENCES travel_allowances(id) ON DELETE CASCADE,
      doc_type VARCHAR(30) NOT NULL CHECK (doc_type IN ('invoice', 'liquidation', 'support')),
      file_name TEXT NOT NULL,
      mime_type TEXT,
      drive_file_id TEXT,
      drive_link TEXT,
      content_hash_sha256 VARCHAR(64),
      hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
      amount NUMERIC(12,2),
      expense_date DATE,
      invoice_number TEXT,
      notes TEXT,
      uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    ALTER TABLE travel_allowance_documents
    ADD COLUMN IF NOT EXISTS content_hash_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS hash_algorithm VARCHAR(20) DEFAULT 'SHA-256';
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_travel_allowance_documents_allowance_id
      ON travel_allowance_documents(allowance_id);
  `);

  await db.query(`
    ALTER TABLE travel_allowances
      ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(40) NOT NULL DEFAULT 'borrador',
      ADD COLUMN IF NOT EXISTS decision_type VARCHAR(40) NOT NULL DEFAULT 'normal_reimbursement',
      ADD COLUMN IF NOT EXISTS decision_reason TEXT,
      ADD COLUMN IF NOT EXISTS km_accumulated_month NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS km_excess NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reimbursable_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS trip_authorized BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS trip_authorization_ref TEXT,
      ADD COLUMN IF NOT EXISTS trip_reason TEXT;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_zones (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      covered_city_tokens TEXT[] NOT NULL DEFAULT '{}',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_fixed_profiles (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      aplica_viatico_fijo BOOLEAN NOT NULL DEFAULT FALSE,
      monto_mensual NUMERIC(12,2) NOT NULL DEFAULT 0,
      zona_cubierta_id BIGINT REFERENCES travel_allowance_zones(id) ON DELETE SET NULL,
      km_incluidos_mes NUMERIC(12,2) NOT NULL DEFAULT 0,
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE,
      estado TEXT NOT NULL DEFAULT 'activo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_travel_allowance_fixed_profiles_user_dates
      ON travel_allowance_fixed_profiles(user_id, fecha_inicio, fecha_fin);
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_policy (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      km_excess_rate NUMERIC(12,4) NOT NULL DEFAULT 0,
      include_associated_expenses_on_excess BOOLEAN NOT NULL DEFAULT FALSE,
      strict_company_buyer_match BOOLEAN NOT NULL DEFAULT TRUE,
      invoice_date_margin_days INTEGER NOT NULL DEFAULT 3,
      updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    INSERT INTO travel_allowance_policy (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_provider_catalog (
      id BIGSERIAL PRIMARY KEY,
      supplier_ruc TEXT,
      supplier_name_pattern TEXT NOT NULL,
      category TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (category IN ('alimentacion', 'combustible', 'hospedaje'))
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_invoices (
      id BIGSERIAL PRIMARY KEY,
      allowance_id BIGINT NOT NULL REFERENCES travel_allowances(id) ON DELETE CASCADE,
      document_id BIGINT REFERENCES travel_allowance_documents(id) ON DELETE SET NULL,
      supplier_ruc TEXT,
      supplier_name TEXT,
      buyer_id TEXT,
      issue_date DATE,
      access_key VARCHAR(49) NOT NULL,
      authorization_number TEXT,
      establishment TEXT,
      emission_point TEXT,
      sequential TEXT,
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
      iva NUMERIC(12,2) NOT NULL DEFAULT 0,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      payment_method TEXT,
      details_text TEXT,
      category TEXT,
      category_source TEXT,
      allowed_category BOOLEAN NOT NULL DEFAULT FALSE,
      xml_well_formed BOOLEAN NOT NULL DEFAULT FALSE,
      authorized_invoice BOOLEAN NOT NULL DEFAULT FALSE,
      duplicate_invoice BOOLEAN NOT NULL DEFAULT FALSE,
      duplicated_with_invoice_id BIGINT REFERENCES travel_allowance_invoices(id) ON DELETE SET NULL,
      in_trip_date_range BOOLEAN NOT NULL DEFAULT FALSE,
      valid_buyer BOOLEAN NOT NULL DEFAULT FALSE,
      valid_supplier BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'pendiente_clasificacion',
      include_in_ats BOOLEAN NOT NULL DEFAULT TRUE,
      exclude_from_ats_reason TEXT,
      validation_notes TEXT,
      xml_original TEXT NOT NULL,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_travel_allowance_invoices_access_key
      ON travel_allowance_invoices(access_key);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_travel_allowance_invoices_allowance
      ON travel_allowance_invoices(allowance_id);
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_sri_credentials (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      endpoint_url TEXT,
      token_encrypted TEXT,
      username_encrypted TEXT,
      password_encrypted TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  })().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });

  return schemaReadyPromise;
}

function resolveDateRange(startDate, endDate) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return {
    startDate: startDate || firstDay,
    endDate: endDate || lastDay,
  };
}

function parseIsoDate(rawDate) {
  const value = String(rawDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function parseLocationPoint(rawValue) {
  if (!rawValue) return null;
  const parts = String(rawValue)
    .split(",")
    .map((part) => Number(part.trim()));

  if (parts.length < 2) return null;
  const [lat, lng] = parts;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTag(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? String(match[1]).trim() : null;
}

function extractAllTagValues(xml, tag) {
  const matches = String(xml || "").matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi"));
  return Array.from(matches).map((match) => String(match[1] || "").trim()).filter(Boolean);
}

function detectCategoryFromKeywords(value) {
  const input = normalizeText(value);
  if (!input) return null;
  const rules = [
    { category: "combustible", words: ["combustible", "gasolina", "diesel", "diésel", "extra", "super"] },
    { category: "hospedaje", words: ["hospedaje", "hotel", "habitacion", "habitación"] },
    { category: "alimentacion", words: ["desayuno", "almuerzo", "cena", "alimentacion", "alimentación", "restaurante"] },
  ];
  const found = rules.find((rule) => rule.words.some((word) => input.includes(normalizeText(word))));
  return found ? found.category : null;
}

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2) * Math.sin(dLat / 2);
  const s2 = Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(s1 + s2), Math.sqrt(1 - (s1 + s2)));
  return R * c;
}

async function getPolicy() {
  const { rows } = await db.query(
    `
      SELECT
        km_excess_rate,
        include_associated_expenses_on_excess,
        strict_company_buyer_match,
        invoice_date_margin_days
      FROM travel_allowance_policy
      WHERE id = 1
      LIMIT 1
    `
  );
  return rows[0] || {
    km_excess_rate: 0,
    include_associated_expenses_on_excess: false,
    strict_company_buyer_match: true,
    invoice_date_margin_days: 3,
  };
}

async function getActiveFixedProfile(userId, visitDate) {
  if (!userId || !visitDate) return null;
  const { rows } = await db.query(
    `
      SELECT p.*, z.code AS zone_code, z.name AS zone_name, z.covered_city_tokens
      FROM travel_allowance_fixed_profiles p
      LEFT JOIN travel_allowance_zones z ON z.id = p.zona_cubierta_id
      WHERE p.user_id = $1
        AND p.estado = 'activo'
        AND p.aplica_viatico_fijo = TRUE
        AND p.fecha_inicio <= $2::date
        AND (p.fecha_fin IS NULL OR p.fecha_fin >= $2::date)
      ORDER BY p.fecha_inicio DESC, p.id DESC
      LIMIT 1
    `,
    [userId, visitDate]
  );
  return rows[0] || null;
}

function isCityInsideZone(city, profile) {
  const cityNormalized = normalizeText(city);
  const tokens = Array.isArray(profile?.covered_city_tokens) ? profile.covered_city_tokens.map(normalizeText) : [];
  if (!cityNormalized || !tokens.length) return false;
  return tokens.some((token) => token && cityNormalized.includes(token));
}

async function getMonthlyKmAccumulated({ userId, visitDate, excludeAllowanceId = null }) {
  if (!userId || !visitDate) return 0;
  const values = [userId, visitDate];
  let excludeClause = "";
  if (excludeAllowanceId) {
    values.push(excludeAllowanceId);
    excludeClause = `AND id <> $${values.length}`;
  }
  const { rows } = await db.query(
    `
      SELECT COALESCE(SUM(distance_km), 0) AS km_acc
      FROM travel_allowances
      WHERE requester_user_id = $1
        AND date_trunc('month', visit_date) = date_trunc('month', $2::date)
        AND status <> 'rejected'
        ${excludeClause}
    `,
    values
  );
  return Number(rows[0]?.km_acc || 0);
}

async function computeAllowanceDecision({
  allowanceId = null,
  requesterUserId,
  visitDate,
  city,
  distanceKm,
  outsideLaborArea,
}) {
  const profile = await getActiveFixedProfile(requesterUserId, visitDate);
  const monthlyKm = await getMonthlyKmAccumulated({ userId: requesterUserId, visitDate, excludeAllowanceId: allowanceId });
  const nextKm = monthlyKm + Number(distanceKm || 0);
  const policy = await getPolicy();

  if (!profile) {
    return {
      decision_type: "normal_reimbursement",
      decision_reason: "Usuario sin viatico fijo vigente",
      km_accumulated_month: monthlyKm,
      km_excess: 0,
      reimbursable_amount: 0,
    };
  }

  const insideZone = isCityInsideZone(city, profile);
  const kmIncluded = Number(profile.km_incluidos_mes || 0);
  const kmExcess = Math.max(0, nextKm - kmIncluded);
  const hasExcess = kmExcess > 0;
  const outsideZone = !insideZone || Boolean(outsideLaborArea);

  if (outsideZone && hasExcess) {
    const reimbursable = kmExcess * Number(policy.km_excess_rate || 0);
    return {
      decision_type: "mixed",
      decision_reason: "Fuera de zona y exceso de kilometraje",
      km_accumulated_month: monthlyKm,
      km_excess: kmExcess,
      reimbursable_amount: reimbursable,
    };
  }

  if (outsideZone) {
    return {
      decision_type: "extraordinary_outside_zone",
      decision_reason: "Viaje fuera de zona contractual",
      km_accumulated_month: monthlyKm,
      km_excess: 0,
      reimbursable_amount: 0,
    };
  }

  if (hasExcess) {
    const reimbursable = kmExcess * Number(policy.km_excess_rate || 0);
    return {
      decision_type: "excess_km",
      decision_reason: "Exceso de kilometraje mensual",
      km_accumulated_month: monthlyKm,
      km_excess: kmExcess,
      reimbursable_amount: reimbursable,
    };
  }

  return {
    decision_type: "covered_fixed",
    decision_reason: "Cubierto por viatico fijo dentro de zona y km incluidos",
    km_accumulated_month: monthlyKm,
    km_excess: 0,
    reimbursable_amount: 0,
  };
}

async function listVisitCandidates({ actorUser, startDate, endDate, status, requesterEmail }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const range = resolveDateRange(startDate, endDate);
  const params = [range.startDate, range.endDate];
  const filters = [];

  if (status && ALLOWED_STATUSES.has(toLower(status))) {
    params.push(toLower(status));
    filters.push(`COALESCE(ta.status, 'pending') = $${params.length}`);
  }

  if (requesterEmail) {
    params.push(String(requesterEmail).toLowerCase());
    filters.push(`LOWER(base.requester_email) = $${params.length}`);
  }

  if (!isFinanceUser(actorUser)) {
    params.push(String(actorUser.email || "").toLowerCase());
    filters.push(`LOWER(base.requester_email) = $${params.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const { rows } = await db.query(
    `
      WITH client_visits AS (
        SELECT
          'client_visit'::text AS source_type,
          cvl.id::bigint AS source_id,
          cvl.user_email AS requester_email,
          u.id AS requester_user_id,
          cvl.visit_date,
          COALESCE(cr.shipping_city, cr.establishment_city, 'N/A') AS city,
          cr.commercial_name AS reference_name,
          cvl.hora_entrada,
          cvl.hora_salida,
          cvl.lat_entrada,
          cvl.lng_entrada,
          cvl.lat_salida,
          cvl.lng_salida,
          cvl.duracion_minutos
        FROM client_visit_logs cvl
        LEFT JOIN client_requests cr ON cr.id = cvl.client_request_id
        LEFT JOIN users u ON LOWER(u.email) = LOWER(cvl.user_email)
        WHERE cvl.visit_date BETWEEN $1 AND $2
          AND cvl.status = 'visited'
      ),
      prospect_visits AS (
        SELECT
          'prospect_visit'::text AS source_type,
          pv.id::bigint AS source_id,
          pv.user_email AS requester_email,
          u.id AS requester_user_id,
          pv.visit_date,
          'Prospecto'::text AS city,
          pv.prospect_name AS reference_name,
          pv.check_in_time AS hora_entrada,
          pv.check_out_time AS hora_salida,
          pv.check_in_lat AS lat_entrada,
          pv.check_in_lng AS lng_entrada,
          pv.check_out_lat AS lat_salida,
          pv.check_out_lng AS lng_salida,
          NULL::integer AS duracion_minutos
        FROM prospect_visits pv
        LEFT JOIN users u ON LOWER(u.email) = LOWER(pv.user_email)
        WHERE pv.visit_date BETWEEN $1 AND $2
          AND pv.status = 'visited'
      ),
      operational_exits AS (
        SELECT
          'operational_exit'::text AS source_type,
          ae.id::bigint AS source_id,
          u.email AS requester_email,
          ae.user_id AS requester_user_id,
          ae.start_time::date AS visit_date,
          COALESCE(ae.destination_description, ae.origin_description, 'Viaje operacional') AS city,
          COALESCE(ae.destination_description, ae.type, 'Salida operacional') AS reference_name,
          ae.start_time AS hora_entrada,
          ae.return_time AS hora_salida,
          NULL::numeric AS lat_entrada,
          NULL::numeric AS lng_entrada,
          NULL::numeric AS lat_salida,
          NULL::numeric AS lng_salida,
          CASE
            WHEN ae.return_time IS NOT NULL AND ae.start_time IS NOT NULL
            THEN EXTRACT(EPOCH FROM (ae.return_time - ae.start_time)) / 60
            ELSE NULL
          END::integer AS duracion_minutos
        FROM attendance_exceptions ae
        LEFT JOIN users u ON u.id = ae.user_id
        WHERE ae.start_time::date BETWEEN $1 AND $2
          AND UPPER(COALESCE(ae.status, '')) = 'COMPLETED'
      ),
      base AS (
        SELECT * FROM client_visits
        UNION ALL
        SELECT * FROM prospect_visits
        UNION ALL
        SELECT * FROM operational_exits
      )
      SELECT
        base.*,
        ta.id AS allowance_id,
        ta.status AS allowance_status,
        ta.amount,
        ta.currency,
        ta.distance_km,
        ta.fuel_amount,
        ta.liquidation_amount,
        ta.outside_labor_area,
        ta.attendance_check_status,
        ta.payment_date,
        ta.notes,
        ta.updated_at AS allowance_updated_at,
        fu.fullname AS finance_user_name
      FROM base
      LEFT JOIN travel_allowances ta
        ON ta.source_type = base.source_type
       AND ta.source_id = base.source_id
      LEFT JOIN users fu ON fu.id = ta.finance_user_id
      ${whereClause}
      ORDER BY base.visit_date DESC, base.source_type, base.source_id DESC
      LIMIT 1000
    `,
    params
  );

  return rows;
}

async function listAllowances({ actorUser, startDate, endDate, status }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const range = resolveDateRange(startDate, endDate);
  const params = [range.startDate, range.endDate];
  const filters = ["ta.visit_date BETWEEN $1 AND $2"];

  if (status && ALLOWED_STATUSES.has(toLower(status))) {
    params.push(toLower(status));
    filters.push(`ta.status = $${params.length}`);
  }

  if (!isFinanceUser(actorUser)) {
    params.push(String(actorUser.email || "").toLowerCase());
    filters.push(`LOWER(ta.requester_email) = $${params.length}`);
  }

  const { rows } = await db.query(
    `
      SELECT
        ta.*,
        ru.fullname AS requester_name,
        fu.fullname AS finance_user_name,
        COALESCE(doc.docs_count, 0) AS docs_count,
        COALESCE(doc.invoices_total, 0) AS invoices_total
      FROM travel_allowances ta
      LEFT JOIN users ru ON ru.id = ta.requester_user_id
      LEFT JOIN users fu ON fu.id = ta.finance_user_id
      LEFT JOIN (
        SELECT
          allowance_id,
          COUNT(*)::int AS docs_count,
          COALESCE(SUM(CASE WHEN doc_type = 'invoice' THEN amount ELSE 0 END), 0) AS invoices_total
        FROM travel_allowance_documents
        GROUP BY allowance_id
      ) doc ON doc.allowance_id = ta.id
      WHERE ${filters.join(" AND ")}
      ORDER BY ta.visit_date DESC, ta.id DESC
      LIMIT 1000
    `,
    params
  );

  return rows;
}

async function resolveReferencedVisit(sourceType, sourceId) {
   if (sourceType === "client_visit") {
     const { rows } = await db.query(
       `
         SELECT
           cvl.id,
           cvl.user_email AS requester_email,
           u.id AS requester_user_id,
           cvl.visit_date,
           COALESCE(cr.shipping_city, cr.establishment_city, 'N/A') AS city
         FROM client_visit_logs cvl
         LEFT JOIN client_requests cr ON cr.id = cvl.client_request_id
         LEFT JOIN users u ON LOWER(u.email) = LOWER(cvl.user_email)
         WHERE cvl.id = $1
           AND cvl.status = 'visited'
         LIMIT 1
       `,
       [sourceId]
     );
     return rows[0] || null;
   }

   if (sourceType === "prospect_visit") {
     const { rows } = await db.query(
       `
         SELECT
           pv.id,
           pv.user_email AS requester_email,
           u.id AS requester_user_id,
           pv.visit_date,
           'Prospecto'::text AS city
         FROM prospect_visits pv
         LEFT JOIN users u ON LOWER(u.email) = LOWER(pv.user_email)
         WHERE pv.id = $1
           AND pv.status = 'visited'
         LIMIT 1
       `,
       [sourceId]
     );
     return rows[0] || null;
   }

   if (sourceType === "operational_exit") {
     const { rows } = await db.query(
       `
         SELECT
           ae.id,
           ae.user_id AS requester_user_id,
           u.email AS requester_email,
           ae.start_time::date AS visit_date,
           COALESCE(ae.destination_description, ae.origin_description, 'Viaje operacional') AS city,
           ae.start_time,
           ae.return_time,
           ae.closure_type,
           ae.outside_labor_area
         FROM attendance_exceptions ae
         LEFT JOIN users u ON u.id = ae.user_id
         WHERE ae.id = $1
           AND UPPER(COALESCE(ae.status, '')) = 'COMPLETED'
         LIMIT 1
       `,
       [sourceId]
     );
     return rows[0] || null;
   }

   return null;
 }

async function getAllowanceById(allowanceId) {
  const { rows } = await db.query(`SELECT * FROM travel_allowances WHERE id = $1 LIMIT 1`, [allowanceId]);
  return rows[0] || null;
}

function assertAllowanceAccess(allowance, actorUser) {
  const finance = isFinanceUser(actorUser);
  const requesterEmail = String(actorUser?.email || "").toLowerCase();
  if (finance) return;
  if (String(allowance?.requester_email || "").toLowerCase() !== requesterEmail) {
    const error = new Error("No tienes acceso a este viatico");
    error.status = 403;
    throw error;
  }
}

function assertAllowanceRequester(allowance, actorUser) {
  const requesterEmail = String(allowance?.requester_email || "").toLowerCase();
  const actorEmail = String(actorUser?.email || "").toLowerCase();
  if (!requesterEmail || !actorEmail || requesterEmail !== actorEmail) {
    const error = new Error("Solo solicitante de salida operacional puede cargar XML SRI");
    error.status = 403;
    throw error;
  }
}

async function upsertAllowance({ actorUser, payload }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const sourceType = toLower(payload.source_type || "manual_trip");
  const sourceId = payload.source_id === undefined || payload.source_id === null || payload.source_id === ""
    ? null
    : Number(payload.source_id);
  const amount = Number(payload.amount || 0);
  const status = toLower(payload.status || "pending");
  const distanceKm = Number(payload.distance_km || 0);
  const fuelAmount = Number(payload.fuel_amount || 0);
  const liquidationAmount = Number(payload.liquidation_amount || 0);
  const workflowStatus = toLower(payload.workflow_status || "pendiente_revision");
  const tripAuthorized = Boolean(payload.trip_authorized);

  if (!ALLOWED_SOURCE_TYPES.has(sourceType)) {
    const error = new Error("source_type invalido");
    error.status = 400;
    throw error;
  }

  if (sourceId !== null && (!Number.isFinite(sourceId) || sourceId <= 0)) {
    const error = new Error("source_id invalido");
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(amount) || amount < 0) {
    const error = new Error("amount invalido");
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(fuelAmount) || fuelAmount < 0) {
    const error = new Error("distance_km o fuel_amount invalido");
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(liquidationAmount) || liquidationAmount < 0) {
    const error = new Error("liquidation_amount invalido");
    error.status = 400;
    throw error;
  }

  if (!ALLOWED_WORKFLOW_STATUSES.has(workflowStatus)) {
    const error = new Error("workflow_status invalido");
    error.status = 400;
    throw error;
  }

  const financeActor = isFinanceUser(actorUser);
  const finalStatus = financeActor && ALLOWED_STATUSES.has(status) ? status : "pending";
  const paymentDate = finalStatus === "paid" ? payload.payment_date || new Date().toISOString().slice(0, 10) : null;
  const outsideLaborArea = Boolean(payload.outside_labor_area);

  if (!financeActor && !outsideLaborArea) {
    const error = new Error("Solo se permiten viaticos para gastos fuera del area de labores");
    error.status = 400;
    throw error;
  }

  if (fuelAmount > 0 && distanceKm <= 1000) {
    const error = new Error("Gasolina solo aplica cuando la distancia supera 1000 km");
    error.status = 400;
    throw error;
  }

  let resolvedRequesterEmail = String(actorUser.email || "").toLowerCase();
  let resolvedRequesterId = actorUser.id || null;
  let resolvedVisitDate = payload.visit_date || new Date().toISOString().slice(0, 10);
  let resolvedCity = payload.city || null;

  if (sourceType !== "manual_trip") {
    if (!sourceId) {
      const error = new Error("source_id es obligatorio para visitas");
      error.status = 400;
      throw error;
    }

    const visitData = await resolveReferencedVisit(sourceType, sourceId);
    if (!visitData) {
      const error = new Error("No existe la visita referenciada");
      error.status = 404;
      throw error;
    }

    resolvedRequesterEmail = String(visitData.requester_email || "").toLowerCase();
    resolvedRequesterId = visitData.requester_user_id || null;
    resolvedVisitDate = visitData.visit_date;
    resolvedCity = visitData.city;

    if (!financeActor && resolvedRequesterEmail !== String(actorUser.email || "").toLowerCase()) {
      const error = new Error("No puedes registrar viaticos de otros usuarios");
      error.status = 403;
      throw error;
    }
  } else if (!financeActor) {
    resolvedRequesterEmail = String(actorUser.email || "").toLowerCase();
    resolvedRequesterId = actorUser.id || null;
  }

  if (sourceType === "manual_trip" || sourceId === null) {
    const decision = await computeAllowanceDecision({
      requesterUserId: resolvedRequesterId,
      visitDate: resolvedVisitDate,
      city: resolvedCity,
      distanceKm,
      outsideLaborArea,
    });

    const { rows } = await db.query(
      `
        INSERT INTO travel_allowances (
          source_type, source_id, requester_email, requester_user_id, visit_date, city, trip_type,
          status, amount, currency, distance_km, outside_labor_area, outside_labor_area_reason,
          fuel_amount, liquidation_amount, approved_amount,
          workflow_status, decision_type, decision_reason, km_accumulated_month, km_excess, reimbursable_amount,
          trip_authorized, trip_authorization_ref, trip_reason,
          attendance_check_status, attendance_check_payload,
          finance_user_id, reviewed_by_user_id, reviewed_at,
          payment_date, notes, created_at, updated_at
        )
        VALUES (
          $1, NULL, $2, $3, $4, $5, $6,
          $7, $8, COALESCE($9, 'USD'), $10, $11, $12,
          $13, $14, $15,
          $16, $17, $18, $19, $20, $21,
          $22, $23, $24,
          'unchecked', NULL,
          $25, $26, CASE WHEN $26 IS NULL THEN NULL ELSE NOW() END,
          $27, $28, NOW(), NOW()
        )
        RETURNING *
      `,
      [
        sourceType,
        resolvedRequesterEmail,
        resolvedRequesterId,
        resolvedVisitDate,
        resolvedCity,
        payload.trip_type || null,
        finalStatus,
        amount,
        payload.currency || "USD",
        distanceKm,
        outsideLaborArea,
        payload.outside_labor_area_reason || null,
        fuelAmount,
        liquidationAmount,
        financeActor ? payload.approved_amount ?? null : null,
        workflowStatus,
        decision.decision_type,
        decision.decision_reason,
        decision.km_accumulated_month,
        decision.km_excess,
        decision.reimbursable_amount,
        tripAuthorized,
        payload.trip_authorization_ref || null,
        payload.trip_reason || null,
        financeActor ? actorUser.id : null,
        financeActor ? actorUser.id : null,
        paymentDate,
        payload.notes || null,
      ]
    );
    return rows[0];
  }

  const decision = await computeAllowanceDecision({
    requesterUserId: resolvedRequesterId,
    visitDate: resolvedVisitDate,
    city: resolvedCity,
    distanceKm,
    outsideLaborArea,
  });

  const { rows } = await db.query(
    `
      INSERT INTO travel_allowances (
        source_type, source_id, requester_email, requester_user_id, visit_date, city, trip_type,
        status, amount, currency, distance_km, outside_labor_area, outside_labor_area_reason,
        fuel_amount, liquidation_amount, approved_amount,
        workflow_status, decision_type, decision_reason, km_accumulated_month, km_excess, reimbursable_amount,
        trip_authorized, trip_authorization_ref, trip_reason,
        attendance_check_status, attendance_check_payload,
        finance_user_id, reviewed_by_user_id, reviewed_at,
        payment_date, notes, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, COALESCE($10, 'USD'), $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20, $21, $22,
        $23, $24, $25,
        'unchecked', NULL,
        $26, $27, CASE WHEN $27 IS NULL THEN NULL ELSE NOW() END,
        $28, $29, NOW(), NOW()
      )
      ON CONFLICT (source_type, source_id)
      WHERE source_id IS NOT NULL
        AND source_type IN ('client_visit', 'prospect_visit')
      DO UPDATE SET
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        distance_km = EXCLUDED.distance_km,
        outside_labor_area = EXCLUDED.outside_labor_area,
        outside_labor_area_reason = EXCLUDED.outside_labor_area_reason,
        fuel_amount = EXCLUDED.fuel_amount,
        liquidation_amount = EXCLUDED.liquidation_amount,
        approved_amount = COALESCE(EXCLUDED.approved_amount, travel_allowances.approved_amount),
        workflow_status = EXCLUDED.workflow_status,
        decision_type = EXCLUDED.decision_type,
        decision_reason = EXCLUDED.decision_reason,
        km_accumulated_month = EXCLUDED.km_accumulated_month,
        km_excess = EXCLUDED.km_excess,
        reimbursable_amount = EXCLUDED.reimbursable_amount,
        trip_authorized = EXCLUDED.trip_authorized,
        trip_authorization_ref = EXCLUDED.trip_authorization_ref,
        trip_reason = EXCLUDED.trip_reason,
        trip_type = COALESCE(EXCLUDED.trip_type, travel_allowances.trip_type),
        finance_user_id = COALESCE(EXCLUDED.finance_user_id, travel_allowances.finance_user_id),
        reviewed_by_user_id = COALESCE(EXCLUDED.reviewed_by_user_id, travel_allowances.reviewed_by_user_id),
        reviewed_at = CASE
          WHEN EXCLUDED.reviewed_by_user_id IS NULL THEN travel_allowances.reviewed_at
          ELSE NOW()
        END,
        payment_date = EXCLUDED.payment_date,
        notes = EXCLUDED.notes,
        attendance_check_status = 'unchecked',
        attendance_check_payload = NULL,
        updated_at = NOW()
      RETURNING *
    `,
    [
      sourceType,
      sourceId,
      resolvedRequesterEmail,
      resolvedRequesterId,
      resolvedVisitDate,
      resolvedCity,
      payload.trip_type || null,
      finalStatus,
      amount,
      payload.currency || "USD",
      distanceKm,
      outsideLaborArea,
      payload.outside_labor_area_reason || null,
      fuelAmount,
      liquidationAmount,
      financeActor ? payload.approved_amount ?? null : null,
      workflowStatus,
      decision.decision_type,
      decision.decision_reason,
      decision.km_accumulated_month,
      decision.km_excess,
      decision.reimbursable_amount,
      tripAuthorized,
      payload.trip_authorization_ref || null,
      payload.trip_reason || null,
      financeActor ? actorUser.id : null,
      financeActor ? actorUser.id : null,
      paymentDate,
      payload.notes || null,
    ]
  );

  return rows[0];
}

async function updateAllowanceStatus({
  allowanceId,
  status,
  workflowStatus,
  amount,
  approvedAmount,
  paymentDate,
  notes,
  actorUser,
}) {
  await ensureSchema();
  assertFinanceApprover(actorUser);

  const normalizedStatus = toLower(status);
  if (!ALLOWED_STATUSES.has(normalizedStatus)) {
    const error = new Error("status invalido");
    error.status = 400;
    throw error;
  }

  const normalizedWorkflowStatus = workflowStatus ? toLower(workflowStatus) : null;
  if (normalizedWorkflowStatus && !ALLOWED_WORKFLOW_STATUSES.has(normalizedWorkflowStatus)) {
    const error = new Error("workflow_status invalido");
    error.status = 400;
    throw error;
  }
  if (normalizedWorkflowStatus && !FINANCE_WORKFLOW_STATUSES.has(normalizedWorkflowStatus)) {
    const error = new Error("workflow_status operativo no permitido para procesamiento financiero");
    error.status = 400;
    throw error;
  }

  const numericAmount = amount === undefined ? null : Number(amount);
  const numericApprovedAmount = approvedAmount === undefined ? null : Number(approvedAmount);

  if (numericAmount !== null && (!Number.isFinite(numericAmount) || numericAmount < 0)) {
    const error = new Error("amount invalido");
    error.status = 400;
    throw error;
  }

  if (numericApprovedAmount !== null && (!Number.isFinite(numericApprovedAmount) || numericApprovedAmount < 0)) {
    const error = new Error("approved_amount invalido");
    error.status = 400;
    throw error;
  }

  const values = [allowanceId, normalizedStatus, actorUser.id];
  const sets = [
    "status = $2",
    "finance_user_id = $3",
    "reviewed_by_user_id = $3",
    "reviewed_at = NOW()",
    "updated_at = NOW()",
  ];

  if (numericAmount !== null) {
    values.push(numericAmount);
    sets.push(`amount = $${values.length}`);
  }

  if (numericApprovedAmount !== null) {
    values.push(numericApprovedAmount);
    sets.push(`approved_amount = $${values.length}`);
  }

  if (normalizedStatus === "paid") {
    values.push(paymentDate || new Date().toISOString().slice(0, 10));
    sets.push(`payment_date = $${values.length}`);
  }

  if (notes !== undefined) {
    values.push(notes || null);
    sets.push(`notes = $${values.length}`);
  }

  if (normalizedWorkflowStatus) {
    values.push(normalizedWorkflowStatus);
    sets.push(`workflow_status = $${values.length}`);
  } else if (normalizedStatus === "approved") {
    values.push("aprobado_financiero");
    sets.push(`workflow_status = $${values.length}`);
  } else if (normalizedStatus === "rejected") {
    values.push("rechazado_financiero");
    sets.push(`workflow_status = $${values.length}`);
  } else if (normalizedStatus === "paid") {
    values.push("pagado");
    sets.push(`workflow_status = $${values.length}`);
  }

  const { rows } = await db.query(
    `
      UPDATE travel_allowances
      SET ${sets.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    values
  );

  if (!rows.length) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  const updated = rows[0];
  await notifyJefeFinancieroStatusChange({
    allowance: updated,
    actorUser,
    status: normalizedStatus,
    workflowStatus: normalizedWorkflowStatus || updated.workflow_status || null,
  });
  return updated;
}

async function updateAllowanceWorkflowOperational({
  allowanceId,
  workflowStatus,
  tripAuthorized,
  tripAuthorizationRef,
  notes,
  actorUser,
}) {
  await ensureSchema();
  assertOperationalApprover(actorUser);

  const normalizedWorkflowStatus = toLower(workflowStatus || "");
  if (!OPERATIONAL_WORKFLOW_STATUSES.has(normalizedWorkflowStatus)) {
    const error = new Error("workflow_status operativo invalido");
    error.status = 400;
    throw error;
  }

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  const values = [allowanceId, normalizedWorkflowStatus, actorUser.id];
  const sets = [
    "workflow_status = $2",
    "reviewed_by_user_id = $3",
    "reviewed_at = NOW()",
    "updated_at = NOW()",
  ];

  if (tripAuthorized !== undefined) {
    values.push(Boolean(tripAuthorized));
    sets.push(`trip_authorized = $${values.length}`);
  }

  if (tripAuthorizationRef !== undefined) {
    values.push(tripAuthorizationRef || null);
    sets.push(`trip_authorization_ref = $${values.length}`);
  }

  if (notes !== undefined) {
    values.push(notes || null);
    sets.push(`notes = $${values.length}`);
  }

  const { rows } = await db.query(
    `
      UPDATE travel_allowances
      SET ${sets.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    values
  );

  if (!rows.length) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  return rows[0];
}

async function listAllowanceDocuments({ allowanceId, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  assertAllowanceAccess(allowance, actorUser);

  const { rows } = await db.query(
    `
      SELECT
        d.*,
        u.fullname AS uploaded_by_name,
        u.email AS uploaded_by_email
      FROM travel_allowance_documents d
      LEFT JOIN users u ON u.id = d.uploaded_by_user_id
      WHERE d.allowance_id = $1
      ORDER BY d.uploaded_at DESC, d.id DESC
    `,
    [allowanceId]
  );

  return rows;
}

async function notifyJefeFinancieroStatusChange({ allowance, actorUser, status, workflowStatus }) {
  try {
    const recipientQuery = await db.query(
      `
        SELECT id, email
        FROM users
        WHERE LOWER(COALESCE(role, '')) IN ('jefe_financiero', 'jefe_finanzas')
      `
    );

    const actorId = Number(actorUser?.id || 0);
    const recipients = recipientQuery.rows.filter((row) => Number(row.id || 0) !== actorId);
    if (!recipients.length) return;

    await Promise.all(
      recipients.map((recipient) =>
        notificationsService.createNotification({
          user_id: recipient.id,
          title: "Actualización viáticos por finanzas",
          message: `Viático #${allowance?.id || ""} actualizado a ${status || "sin_estado"} (${workflowStatus || "sin_workflow"}) por ${actorUser?.email || "usuario_finanzas"}.`,
          type: "info",
          source: "viaticos",
          priority: 1,
          meta: {
            allowance_id: allowance?.id || null,
            status: status || null,
            workflow_status: workflowStatus || null,
            actor_email: actorUser?.email || null,
            target_path: `/dashboard/finanzas/viaticos?allowanceId=${allowance?.id || ""}`,
          },
        })
      )
    );
  } catch (error) {
    logger.warn({ error, allowanceId: allowance?.id }, "No se pudo notificar a jefe_financiero");
  }
}

function parseBase64Input(rawBase64) {
  const value = String(rawBase64 || "");
  const dataUriMatch = value.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUriMatch) {
    return {
      mimeType: dataUriMatch[1],
      base64: dataUriMatch[2],
    };
  }

  return {
    mimeType: null,
    base64: value,
  };
}

async function createAllowanceDocument({ allowanceId, actorUser, payload }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  assertAllowanceAccess(allowance, actorUser);

  const docType = toLower(payload.doc_type);
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    const error = new Error("doc_type invalido");
    error.status = 400;
    throw error;
  }

  const fileName = String(payload.file_name || "").trim() || `viatico-${docType}-${Date.now()}.pdf`;
  const amount = payload.amount === undefined || payload.amount === null || payload.amount === ""
    ? null
    : Number(payload.amount);

  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    const error = new Error("amount invalido en documento");
    error.status = 400;
    throw error;
  }

  let driveFileId = payload.drive_file_id || null;
  let driveLink = payload.drive_link || null;
  let mimeType = payload.mime_type || null;
  let contentHashSha256 = typeof payload.content_hash_sha256 === "string"
    ? payload.content_hash_sha256.trim().toLowerCase()
    : null;
  let hashAlgorithm = contentHashSha256
    ? String(payload.hash_algorithm || HASH_ALGORITHM).trim() || HASH_ALGORITHM
    : null;

  if (!driveFileId && !driveLink) {
    if (!payload.file_base64) {
      const error = new Error("Debe enviarse file_base64 o drive_file_id");
      error.status = 400;
      throw error;
    }

    const parsed = parseBase64Input(payload.file_base64);
    contentHashSha256 = computeSha256HexFromBase64(parsed.base64) || contentHashSha256;
    hashAlgorithm = contentHashSha256 ? HASH_ALGORITHM : hashAlgorithm;
    const targetMime = mimeType || parsed.mimeType || "application/pdf";
    const estimatedBytes = Math.ceil((parsed.base64.length * 3) / 4);
    const maxBytes = 15 * 1024 * 1024;
    if (estimatedBytes > maxBytes) {
      const error = new Error("El archivo excede 15MB");
      error.status = 400;
      throw error;
    }
    const targetFolderId =
      process.env.VIATICOS_DRIVE_FOLDER_ID ||
      process.env.DRIVE_TRAVEL_ALLOWANCES_FOLDER_ID ||
      null;

    const uploaded = await uploadBase64File(fileName, parsed.base64, targetMime, targetFolderId);
    driveFileId = uploaded?.id || null;
    driveLink = uploaded?.webViewLink || uploaded?.webContentLink || (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null);
    mimeType = targetMime;
  }

  const { rows } = await db.query(
    `
      INSERT INTO travel_allowance_documents (
        allowance_id, doc_type, file_name, mime_type, drive_file_id, drive_link,
        content_hash_sha256, hash_algorithm,
        amount, expense_date, invoice_number, notes, uploaded_by_user_id, uploaded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *
    `,
    [
      allowanceId,
      docType,
      fileName,
      mimeType,
      driveFileId,
      driveLink,
      contentHashSha256,
      hashAlgorithm,
      amount,
      payload.expense_date || null,
      payload.invoice_number || null,
      payload.notes || null,
      actorUser.id || null,
    ]
  );

  return rows[0];
}

async function getVisitGeoPoints(allowance) {
  if (!allowance?.source_type || !allowance?.source_id) return [];

  if (allowance.source_type === "client_visit") {
    const { rows } = await db.query(
      `
        SELECT lat_entrada, lng_entrada, lat_salida, lng_salida
        FROM client_visit_logs
        WHERE id = $1
        LIMIT 1
      `,
      [allowance.source_id]
    );

    const row = rows[0];
    if (!row) return [];
    return [
      row.lat_entrada !== null && row.lng_entrada !== null ? { lat: Number(row.lat_entrada), lng: Number(row.lng_entrada), source: "visit_start" } : null,
      row.lat_salida !== null && row.lng_salida !== null ? { lat: Number(row.lat_salida), lng: Number(row.lng_salida), source: "visit_end" } : null,
    ].filter(Boolean);
  }

  if (allowance.source_type === "prospect_visit") {
    const { rows } = await db.query(
      `
        SELECT check_in_lat, check_in_lng, check_out_lat, check_out_lng
        FROM prospect_visits
        WHERE id = $1
        LIMIT 1
      `,
      [allowance.source_id]
    );

    const row = rows[0];
    if (!row) return [];
    return [
      row.check_in_lat !== null && row.check_in_lng !== null ? { lat: Number(row.check_in_lat), lng: Number(row.check_in_lng), source: "visit_start" } : null,
      row.check_out_lat !== null && row.check_out_lng !== null ? { lat: Number(row.check_out_lat), lng: Number(row.check_out_lng), source: "visit_end" } : null,
    ].filter(Boolean);
  }

  return [];
}

async function buildAllowanceReport({ allowanceId, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  assertAllowanceAccess(allowance, actorUser);

  const docs = await listAllowanceDocuments({ allowanceId, actorUser });
  const invoiceDocs = docs.filter((doc) => doc.doc_type === "invoice");
  const liquidationDocs = docs.filter((doc) => doc.doc_type === "liquidation");

  const invoiceTotal = invoiceDocs.reduce((sum, doc) => sum + Number(doc.amount || 0), 0);
  const declaredLiquidation = Number(allowance.liquidation_amount || 0);
  const fuelAmount = Number(allowance.fuel_amount || 0);
  const distanceKm = Number(allowance.distance_km || 0);

  const attendanceQuery = await db.query(
    `
      SELECT
        id,
        date,
        entry_time,
        lunch_start_time,
        lunch_end_time,
        exit_time,
        entry_location,
        lunch_start_location,
        lunch_end_location,
        exit_location
      FROM user_attendance_records
      WHERE user_id = $1
        AND date = $2
      LIMIT 1
    `,
    [allowance.requester_user_id || -1, allowance.visit_date]
  );

  const attendance = attendanceQuery.rows[0] || null;
  const attendancePoints = attendance
    ? [
        parseLocationPoint(attendance.entry_location) ? { ...parseLocationPoint(attendance.entry_location), source: "entry" } : null,
        parseLocationPoint(attendance.lunch_start_location) ? { ...parseLocationPoint(attendance.lunch_start_location), source: "lunch_start" } : null,
        parseLocationPoint(attendance.lunch_end_location) ? { ...parseLocationPoint(attendance.lunch_end_location), source: "lunch_end" } : null,
        parseLocationPoint(attendance.exit_location) ? { ...parseLocationPoint(attendance.exit_location), source: "exit" } : null,
      ].filter(Boolean)
    : [];

  const visitPoints = await getVisitGeoPoints(allowance);

  let minDistanceKm = null;
  if (attendancePoints.length && visitPoints.length) {
    attendancePoints.forEach((attendancePoint) => {
      visitPoints.forEach((visitPoint) => {
        const distance = haversineKm(attendancePoint, visitPoint);
        if (distance !== null && (minDistanceKm === null || distance < minDistanceKm)) {
          minDistanceKm = distance;
        }
      });
    });
  }

  let attendanceStatus = "unchecked";
  if (!attendance) {
    attendanceStatus = "no_attendance";
  } else if (!attendancePoints.length || !visitPoints.length) {
    attendanceStatus = "insufficient_geo";
  } else if (minDistanceKm <= 5) {
    attendanceStatus = "matched";
  } else if (minDistanceKm <= 20) {
    attendanceStatus = "review";
  } else {
    attendanceStatus = "mismatch";
  }

  const outsideLaborArea = Boolean(allowance.outside_labor_area);
  const fuelEligible = distanceKm > 1000;
  const technicalRecommendation = outsideLaborArea
    ? declaredLiquidation + (fuelEligible ? fuelAmount : 0)
    : 0;
  const suggestedAmount = Math.max(technicalRecommendation, invoiceTotal);

  const report = {
    allowance_id: allowance.id,
    requester_email: allowance.requester_email,
    visit_date: allowance.visit_date,
    city: allowance.city,
    source_type: allowance.source_type,
    source_id: allowance.source_id,
    attendance: {
      exists: Boolean(attendance),
      status: attendanceStatus,
      min_distance_km: minDistanceKm,
      points_found: attendancePoints.length,
      record: attendance,
    },
    rules: {
      outside_labor_area: outsideLaborArea,
      outside_labor_area_reason: allowance.outside_labor_area_reason || null,
      fuel_eligible_by_km: fuelEligible,
      distance_km: distanceKm,
      threshold_km: 1000,
    },
    documents: {
      total_docs: docs.length,
      invoice_docs: invoiceDocs.length,
      liquidation_docs: liquidationDocs.length,
      invoice_total: invoiceTotal,
      liquidation_amount: declaredLiquidation,
      fuel_amount: fuelAmount,
      missing_liquidation_document: liquidationDocs.length === 0,
      missing_invoice_document: invoiceDocs.length === 0,
    },
    recommendation: {
      suggested_amount: suggestedAmount,
      formula_base: technicalRecommendation,
      approved_amount: allowance.approved_amount,
      current_amount: allowance.amount,
    },
  };

  await db.query(
    `
      UPDATE travel_allowances
      SET attendance_check_status = $2,
          attendance_check_payload = $3,
          updated_at = NOW()
      WHERE id = $1
    `,
    [allowance.id, attendanceStatus, JSON.stringify(report)]
  );

  return report;
}

async function ensureWellFormedXml(xmlText) {
  await db.query(`SELECT xmlparse(document $1::text)`, [String(xmlText || "")]);
}

function resolveFacturaXml(xmlText) {
  const raw = String(xmlText || "").trim();
  const comprobanteEncoded = extractTag(raw, "comprobante");
  if (comprobanteEncoded) {
    return decodeXmlEntities(comprobanteEncoded);
  }
  return raw;
}

async function classifyInvoiceFromCatalog({ supplierRuc, supplierName, detailsText }) {
  const normalizedName = normalizeText(supplierName);
  const { rows } = await db.query(
    `
      SELECT category, supplier_name_pattern
      FROM travel_allowance_provider_catalog
      WHERE active = TRUE
        AND (
          (supplier_ruc IS NOT NULL AND supplier_ruc <> '' AND supplier_ruc = $1)
          OR (supplier_name_pattern IS NOT NULL AND supplier_name_pattern <> '' AND $2 LIKE '%' || LOWER(supplier_name_pattern) || '%')
        )
      ORDER BY supplier_ruc DESC, id ASC
      LIMIT 1
    `,
    [supplierRuc || null, normalizedName]
  );

  if (rows[0]?.category) {
    return {
      category: rows[0].category,
      source: "provider_catalog",
    };
  }

  const fromDetails = detectCategoryFromKeywords(detailsText || supplierName);
  if (fromDetails) {
    return {
      category: fromDetails,
      source: "details_keywords",
    };
  }

  return {
    category: null,
    source: "unclassified",
  };
}

function parseSriInvoiceXml(xmlText) {
  const rawXml = String(xmlText || "");
  const facturaXml = resolveFacturaXml(rawXml);
  const infoTributaria = extractTag(facturaXml, "infoTributaria") || "";
  const infoFactura = extractTag(facturaXml, "infoFactura") || "";
  const detalles = extractTag(facturaXml, "detalles") || "";

  const details = extractAllTagValues(detalles, "descripcion");
  const detailsText = details.join(" | ");

  const parsed = {
    supplier_ruc: extractTag(infoTributaria, "ruc"),
    supplier_name: extractTag(infoTributaria, "razonSocial"),
    issue_date: extractTag(infoFactura, "fechaEmision"),
    access_key: extractTag(infoTributaria, "claveAcceso"),
    authorization_number: extractTag(rawXml, "numeroAutorizacion") || extractTag(infoTributaria, "claveAcceso"),
    establishment: extractTag(infoTributaria, "estab"),
    emission_point: extractTag(infoTributaria, "ptoEmi"),
    sequential: extractTag(infoTributaria, "secuencial"),
    subtotal: Number(extractTag(infoFactura, "totalSinImpuestos") || 0),
    iva: Number(extractTag(infoFactura, "importeTotal") || 0) - Number(extractTag(infoFactura, "totalSinImpuestos") || 0),
    total: Number(extractTag(infoFactura, "importeTotal") || 0),
    payment_method: extractTag(facturaXml, "formaPago"),
    buyer_id: extractTag(infoFactura, "identificacionComprador"),
    details_text: detailsText,
    authorization_state: extractTag(rawXml, "estado"),
  };

  return { rawXml, facturaXml, parsed };
}

function parseEcDate(rawDate) {
  const value = String(rawDate || "").trim();
  if (!value) return null;
  const ddmmyyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;
  return null;
}

async function validateInvoiceForAllowance({ allowance, invoice, actorUser }) {
  const policy = await getPolicy();
  const margin = Number(policy.invoice_date_margin_days || 3);
  const notes = [];

  const accessKey = String(invoice.access_key || "").trim();
  const xmlWellFormed = true;
  const accessKeyValid = /^\d{49}$/.test(accessKey);
  if (!accessKeyValid) notes.push("Clave de acceso invalida (debe ser 49 digitos)");

  const authorized = normalizeText(invoice.authorization_state) === "autorizado" || Boolean(invoice.authorization_number);
  if (!authorized) notes.push("Factura no autorizada segun XML");

  const issueDateIso = parseEcDate(invoice.issue_date);
  const tripDate = allowance?.visit_date ? new Date(allowance.visit_date) : null;
  let inTripDateRange = false;
  if (issueDateIso && tripDate) {
    const issueDate = new Date(issueDateIso);
    const minDate = new Date(tripDate);
    const maxDate = new Date(tripDate);
    minDate.setDate(minDate.getDate() - margin);
    maxDate.setDate(maxDate.getDate() + margin);
    inTripDateRange = issueDate >= minDate && issueDate <= maxDate;
  }
  if (!inTripDateRange) notes.push("Fecha de factura fuera de rango del viaje");

  const validSupplier = /^\d{13}$/.test(String(invoice.supplier_ruc || ""));
  if (!validSupplier) notes.push("RUC proveedor invalido");

  const companyRuc = String(process.env.COMPANY_RUC || "").trim();
  const requesterDocument = String(actorUser?.cedula || actorUser?.identification || "").trim();
  const buyer = String(invoice.buyer_id || "").trim();
  let validBuyer = Boolean(buyer);
  if (policy.strict_company_buyer_match && companyRuc) {
    validBuyer = buyer === companyRuc;
    if (!validBuyer) notes.push("Comprador no coincide con RUC empresa");
  } else if (requesterDocument) {
    validBuyer = buyer === requesterDocument || buyer === companyRuc;
    if (!validBuyer) notes.push("Comprador no coincide con colaborador o empresa");
  }

  const classification = await classifyInvoiceFromCatalog({
    supplierRuc: invoice.supplier_ruc,
    supplierName: invoice.supplier_name,
    detailsText: invoice.details_text,
  });

  const allowedCategory = ALLOWED_EXPENSE_CATEGORIES.has(classification.category);
  if (!allowedCategory) notes.push("Categoria no permitida o no clasificada");

  const duplicateCheck = await db.query(
    `
      SELECT id
      FROM travel_allowance_invoices
      WHERE access_key = $1
      LIMIT 1
    `,
    [accessKey]
  );
  const duplicateInvoice = duplicateCheck.rows.length > 0;
  if (duplicateInvoice) notes.push("Factura duplicada por clave de acceso");

  return {
    xml_well_formed: xmlWellFormed,
    access_key_valid: accessKeyValid,
    authorized_invoice: authorized,
    in_trip_date_range: inTripDateRange,
    valid_supplier: validSupplier,
    valid_buyer: validBuyer,
    category: classification.category,
    category_source: classification.source,
    allowed_category: allowedCategory,
    duplicate_invoice: duplicateInvoice,
    duplicated_with_invoice_id: duplicateCheck.rows[0]?.id || null,
    status: classification.category ? (allowedCategory ? "clasificada" : "rechazada") : "pendiente_clasificacion",
    validation_notes: notes.join(" | "),
  };
}

async function recomputeAllowanceAmountsFromInvoices(allowanceId) {
  const invoiceTotals = await db.query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN allowed_category AND NOT duplicate_invoice AND authorized_invoice THEN total ELSE 0 END), 0) AS valid_total
      FROM travel_allowance_invoices
      WHERE allowance_id = $1
    `,
    [allowanceId]
  );
  const validTotal = Number(invoiceTotals.rows[0]?.valid_total || 0);
  await db.query(
    `
      UPDATE travel_allowances
      SET reimbursable_amount = GREATEST(reimbursable_amount, $2),
          updated_at = NOW()
      WHERE id = $1
    `,
    [allowanceId, validTotal]
  );
  return validTotal;
}

async function uploadSriXmlInvoice({ allowanceId, actorUser, xmlText, documentId = null }) {
   await ensureSchema();
   assertViaticosAccess(actorUser);

   const allowance = await getAllowanceById(allowanceId);
   if (!allowance) {
     const error = new Error("Viatico no encontrado");
     error.status = 404;
     throw error;
   }
   assertAllowanceRequester(allowance, actorUser);

   await ensureWellFormedXml(xmlText);
   const { rawXml, parsed } = parseSriInvoiceXml(xmlText);
   const validions = await validateInvoiceForAllowance({
     allowance,
     invoice: parsed,
     actorUser,
   });

   if (!validions.access_key_valid) {
     const error = new Error("XML invalido: clave de acceso debe tener 49 digitos");
     error.status = 400;
     throw error;
   }

   const issueDate = parseEcDate(parsed.issue_date);
   const { rows } = await db.query(
     `
       INSERT INTO travel_allowance_invoices (
         allowance_id, document_id, supplier_ruc, supplier_name, buyer_id, issue_date, access_key,
         authorization_number, establishment, emission_point, sequential, subtotal, iva, total,
         payment_method, details_text, category, category_source, allowed_category,
         xml_well_formed, authorized_invoice, duplicate_invoice, duplicated_with_invoice_id,
         in_trip_date_range, valid_buyer, valid_supplier, status, include_in_ats, validation_notes,
         xml_original, created_by_user_id, created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13, $14,
         $15, $16, $17, $18, $19,
         $20, $21, $22, $23,
         $24, $25, $26, $27, TRUE, $28,
         $29, $30, NOW(), NOW()
       )
       RETURNING *
     `,
     [
       allowanceId,
       documentId,
       parsed.supplier_ruc || null,
       parsed.supplier_name || null,
       parsed.buyer_id || null,
       issueDate,
       parsed.access_key,
       parsed.authorization_number || null,
       parsed.establishment || null,
       parsed.emission_point || null,
       parsed.sequential || null,
       Number.isFinite(parsed.subtotal) ? parsed.subtotal : 0,
       Number.isFinite(parsed.iva) ? parsed.iva : 0,
       Number.isFinite(parsed.total) ? parsed.total : 0,
       parsed.payment_method || null,
       parsed.details_text || null,
       validions.category,
       validions.category_source,
       validions.allowed_category,
       validions.xml_well_formed,
       validions.authorized_invoice,
       validions.duplicate_invoice,
       validions.duplicated_with_invoice_id,
       validions.in_trip_date_range,
       validions.valid_buyer,
       validions.valid_supplier,
       validions.status,
       validions.validation_notes || null,
       rawXml,
       actorUser.id || null,
     ]
   );

   const reimbursableFromInvoices = await recomputeAllowanceAmountsFromInvoices(allowanceId);
   return { ...rows[0], reimbursable_from_invoices: reimbursableFromInvoices };
 }

async function uploadSriZipInvoices({ allowanceId, actorUser, file_base64, file_name = "viaticos.zip" }) {
   await ensureSchema();
   assertViaticosAccess(actorUser);

   const AdmZip = require("adm-zip");
   const allowance = await getAllowanceById(allowanceId);
   if (!allowance) {
     const error = new Error("Viatico no encontrado");
     error.status = 404;
     throw error;
   }
   assertAllowanceRequester(allowance, actorUser);

   try {
     const zip = new AdmZip(Buffer.from(file_base64, 'base64'));
     const zipEntries = zip.getEntries();
     const xmlFiles = zipEntries.filter(entry => 
       entry.entryName.toLowerCase().endsWith('.xml') && 
       !entry.isDirectory
     );

     if (xmlFiles.length === 0) {
       throw new Error("No se encontraron archivos XML en el ZIP");
     }

     const results = [];
     const errors = [];

     for (const entry of xmlFiles) {
       try {
         const xmlText = entry.getData().toString('utf8');
         const result = await uploadSriXmlInvoice({
           allowanceId,
           actorUser,
           xmlText,
           documentId: null
         });
         results.push(result);
       } catch (error) {
         errors.push({
           fileName: entry.entryName,
           error: error.message
         });
       }
     }

     return {
       processed: results.length,
       errors: errors.length,
       results,
       errors: errors.length > 0 ? errors : undefined
     };
   } catch (error) {
     if (error.name === 'BadZipFile') {
       throw new Error("El archivo ZIP proporcionado no es válido");
     }
     throw error;
   }
 }

async function upsertSriCredentialsForUser({ actorUser, endpointUrl, token, username, password }) {
  if (!actorUser?.id) {
    const error = new Error("No se pudo identificar usuario para credenciales SRI");
    error.status = 400;
    throw error;
  }

  const endpoint = String(endpointUrl || "").trim() || null;
  const tokenEncrypted = token ? encrypt(String(token)) : null;
  const usernameEncrypted = username ? encrypt(String(username)) : null;
  const passwordEncrypted = password ? encrypt(String(password)) : null;

  await db.query(
    `
      INSERT INTO travel_allowance_sri_credentials (
        user_id, endpoint_url, token_encrypted, username_encrypted, password_encrypted, updated_at, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET endpoint_url = COALESCE(EXCLUDED.endpoint_url, travel_allowance_sri_credentials.endpoint_url),
          token_encrypted = COALESCE(EXCLUDED.token_encrypted, travel_allowance_sri_credentials.token_encrypted),
          username_encrypted = COALESCE(EXCLUDED.username_encrypted, travel_allowance_sri_credentials.username_encrypted),
          password_encrypted = COALESCE(EXCLUDED.password_encrypted, travel_allowance_sri_credentials.password_encrypted),
          updated_at = NOW()
    `,
    [actorUser.id, endpoint, tokenEncrypted, usernameEncrypted, passwordEncrypted]
  );
}

async function getSriCredentialsForUser({ actorUser }) {
  if (!actorUser?.id) return null;
  const { rows } = await db.query(
    `
      SELECT endpoint_url, token_encrypted, username_encrypted, password_encrypted
      FROM travel_allowance_sri_credentials
      WHERE user_id = $1
      LIMIT 1
    `,
    [actorUser.id]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    endpoint_url: row.endpoint_url || null,
    token: row.token_encrypted ? decrypt(row.token_encrypted) : null,
    username: row.username_encrypted ? decrypt(row.username_encrypted) : null,
    password: row.password_encrypted ? decrypt(row.password_encrypted) : null,
  };
}

function normalizeSriComprobanteItem(item = {}) {
  const xmlText = String(
    item.xml_text
      || item.xml
      || item.comprobante_xml
      || item.comprobante
      || ""
  ).trim();
  return {
    xml_text: xmlText,
    access_key: String(item.access_key || item.clave_acceso || "").trim() || null,
    authorization_number: String(item.authorization_number || item.numero_autorizacion || "").trim() || null,
  };
}

async function fetchSriComprobantes({ endpointUrl, startDate, endDate, token, username, password }) {
  if (!endpointUrl) {
    const error = new Error("No existe endpoint SRI configurado para sincronizacion");
    error.status = 400;
    throw error;
  }

  const headers = {
    "content-type": "application/json",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const payload = {
    start_date: startDate,
    end_date: endDate,
    username: username || undefined,
    password: password || undefined,
    token: token || undefined,
  };

  const response = await axios.post(endpointUrl, payload, {
    timeout: Number(process.env.SRI_SYNC_TIMEOUT_MS || 20000),
    headers,
  });

  const rawItems = Array.isArray(response?.data?.comprobantes)
    ? response.data.comprobantes
    : Array.isArray(response?.data?.items)
      ? response.data.items
      : Array.isArray(response?.data)
        ? response.data
        : [];

  return rawItems.map(normalizeSriComprobanteItem).filter((item) => item.xml_text);
}

async function findBestAllowanceForInvoice({ actorUser, issueDate, startDate, endDate, marginDays }) {
  const actorEmail = String(actorUser?.email || "").trim().toLowerCase();
  const { rows } = await db.query(
    `
      SELECT
        id,
        visit_date,
        outside_labor_area,
        decision_type,
        ABS((visit_date::date - $3::date))::integer AS diff_days
      FROM travel_allowances
      WHERE (
          requester_user_id = $1
          OR (LOWER(requester_email) = $2 AND $2 <> '')
        )
        AND visit_date BETWEEN $4::date AND $5::date
        AND $3::date BETWEEN (visit_date::date - $6 * INTERVAL '1 day')::date
                        AND (visit_date::date + $6 * INTERVAL '1 day')::date
      ORDER BY diff_days ASC, id DESC
      LIMIT 1
    `,
    [actorUser?.id || null, actorEmail, issueDate, startDate, endDate, marginDays]
  );
  return rows[0] || null;
}

async function syncSriInvoicesForUser({
  actorUser,
  startDate,
  endDate,
  phase,
  autoMode,
  endpointUrl,
  token,
  username,
  password,
}) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const parsedStart = parseIsoDate(startDate);
  const parsedEnd = parseIsoDate(endDate);
  if (!parsedStart || !parsedEnd) {
    const error = new Error("start_date y end_date deben tener formato YYYY-MM-DD");
    error.status = 400;
    throw error;
  }
  if (new Date(parsedEnd) < new Date(parsedStart)) {
    const error = new Error("end_date no puede ser menor a start_date");
    error.status = 400;
    throw error;
  }

  const actorEmail = String(actorUser?.email || "").trim().toLowerCase();
  const { rows } = await db.query(
    `
      SELECT
        id,
        visit_date,
        city,
        source_type,
        source_id,
        outside_labor_area,
        decision_type,
        status,
        workflow_status
      FROM travel_allowances
      WHERE (
          requester_user_id = $1
          OR (LOWER(requester_email) = $2 AND $2 <> '')
        )
        AND visit_date BETWEEN $3::date AND $4::date
      ORDER BY visit_date ASC, id ASC
    `,
    [actorUser?.id || null, actorEmail, parsedStart, parsedEnd]
  );

  const hasLegacyCredentials = Boolean(endpointUrl || token || username || password);
  const inScope = Array.isArray(rows) ? rows : [];
  const eligible = inScope.filter((row) => Boolean(row.outside_labor_area));
  const blocked = inScope.filter((row) => !row.outside_labor_area);
  const normalizedPhase = String(phase || "").trim().toUpperCase() || "F1";
  const normalizedAutoMode = String(autoMode || "").trim().toLowerCase();
  const roadmap = [
    "Fase 1: carga manual XML + parser + clasificacion + motor viaticos",
    "Fase 2: RPA opcional (Playwright) para descarga controlada",
    "Fase 3: cache interno + reconciliacion mensual + XML ATS",
  ];

  if (normalizedPhase === "F3") {
    const cacheStatsQuery = await db.query(
      `
        SELECT
          COUNT(*)::int AS invoices_in_cache,
          COALESCE(SUM(total), 0) AS total_cache_amount,
          COALESCE(SUM(CASE WHEN duplicate_invoice THEN 1 ELSE 0 END), 0)::int AS duplicates_count,
          COALESCE(SUM(CASE WHEN status = 'rechazada' THEN 1 ELSE 0 END), 0)::int AS rejected_count,
          COALESCE(SUM(CASE WHEN include_in_ats = TRUE AND authorized_invoice = TRUE AND duplicate_invoice = FALSE AND allowed_category = TRUE THEN 1 ELSE 0 END), 0)::int AS ats_ready_count
        FROM travel_allowance_invoices
        WHERE issue_date BETWEEN $1::date AND $2::date
      `,
      [parsedStart, parsedEnd]
    );
    const cacheStats = cacheStatsQuery.rows[0] || {};
    const monthlyRowsQuery = await db.query(
      `
        SELECT
          to_char(issue_date, 'YYYY-MM') AS period,
          COUNT(*)::int AS invoices_count,
          COALESCE(SUM(total), 0) AS total_amount,
          COALESCE(SUM(CASE WHEN duplicate_invoice THEN 1 ELSE 0 END), 0)::int AS duplicates_count,
          COALESCE(SUM(CASE WHEN include_in_ats = TRUE AND authorized_invoice = TRUE AND duplicate_invoice = FALSE AND allowed_category = TRUE THEN 1 ELSE 0 END), 0)::int AS ats_ready_count
        FROM travel_allowance_invoices
        WHERE issue_date BETWEEN $1::date AND $2::date
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [parsedStart, parsedEnd]
    );

    return {
      phase: "F3_CACHE_RECONCILIATION",
      integration_mode: "cache_and_monthly_reconciliation",
      connected: null,
      credentials_saved: false,
      legacy_credentials_ignored: hasLegacyCredentials,
      fetched_count: 0,
      attached_count: 0,
      skipped_count: 0,
      error_count: 0,
      range: {
        start_date: parsedStart,
        end_date: parsedEnd,
      },
      cache_summary: {
        invoices_in_cache: Number(cacheStats.invoices_in_cache || 0),
        total_cache_amount: Number(cacheStats.total_cache_amount || 0),
        duplicates_count: Number(cacheStats.duplicates_count || 0),
        rejected_count: Number(cacheStats.rejected_count || 0),
        ats_ready_count: Number(cacheStats.ats_ready_count || 0),
      },
      monthly_reconciliation: monthlyRowsQuery.rows || [],
      ats_generation: {
        enabled: true,
        endpoint: "/api/v1/viaticos/ats/xml",
      },
      roadmap,
      message: "Fase 3 activa: cache interno y reconciliacion mensual listos; ATS disponible por endpoint.",
    };
  }

  if (normalizedPhase === "F2") {
    const rpaEnabled = String(process.env.SRI_RPA_SYNC_ENABLED || "").toLowerCase() === "true";
    const phase2Base = {
      phase: "F2_RPA_OPTIONAL",
      integration_mode: "controlled_auto_download",
      connected: null,
      credentials_saved: false,
      legacy_credentials_ignored: hasLegacyCredentials,
      fetched_count: 0,
      attached_count: 0,
      skipped_count: blocked.length,
      error_count: 0,
      range: {
        start_date: parsedStart,
        end_date: parsedEnd,
      },
      eligible_allowances_count: eligible.length,
      blocked_in_labor_area_count: blocked.length,
      items: eligible.map((row) => ({
        allowance_id: row.id,
        visit_date: row.visit_date,
        city: row.city || null,
        status: "pending_controlled_auto_download",
      })),
      blocked_items: blocked.map((row) => ({
        allowance_id: row.id,
        visit_date: row.visit_date,
        city: row.city || null,
        status: "blocked_in_labor_area",
      })),
      roadmap,
    };

    if (normalizedAutoMode !== "rpa_playwright") {
      return {
        ...phase2Base,
        auto_mode: normalizedAutoMode || null,
        execution_status: "pending_opt_in",
        message: "Fase 2 requiere auto_mode='rpa_playwright' para descarga automatica controlada.",
      };
    }

    if (!rpaEnabled) {
      return {
        ...phase2Base,
        auto_mode: "rpa_playwright",
        execution_status: "disabled_by_policy",
        message: "RPA Playwright deshabilitado por politica. Activa SRI_RPA_SYNC_ENABLED=true para habilitarlo.",
      };
    }

    const rpaEndpoint = String(process.env.SRI_RPA_SYNC_ENDPOINT_URL || "").trim();
    if (!rpaEndpoint) {
      return {
        ...phase2Base,
        auto_mode: "rpa_playwright",
        execution_status: "blocked_missing_endpoint",
        message: "RPA habilitado pero falta SRI_RPA_SYNC_ENDPOINT_URL.",
      };
    }

    const rpaPayload = {
      user_id: actorUser?.id || null,
      requester_email: actorEmail || null,
      start_date: parsedStart,
      end_date: parsedEnd,
      allowance_ids: eligible.map((row) => row.id),
      mode: "controlled",
    };

    try {
      const rpaResponse = await axios.post(rpaEndpoint, rpaPayload, {
        timeout: Number(process.env.SRI_SYNC_TIMEOUT_MS || 20000),
        headers: { "content-type": "application/json" },
      });
      const fetchedCount = Number(rpaResponse?.data?.fetched_count || 0);
      const downloadedItems = Array.isArray(rpaResponse?.data?.items) ? rpaResponse.data.items : [];
      return {
        ...phase2Base,
        auto_mode: "rpa_playwright",
        execution_status: "executed",
        connected: true,
        fetched_count: fetchedCount,
        downloaded_items: downloadedItems,
        message: "Fase 2 ejecutada: descarga automatica controlada completada.",
      };
    } catch (error) {
      return {
        ...phase2Base,
        auto_mode: "rpa_playwright",
        execution_status: "execution_error",
        connected: false,
        error_count: 1,
        message: error?.message || "Error ejecutando descarga controlada con RPA.",
      };
    }
  }

  return {
    phase: "F1_MANUAL_XML",
    integration_mode: "manual_xml_upload",
    connected: null,
    credentials_saved: false,
    legacy_credentials_ignored: hasLegacyCredentials,
    fetched_count: 0,
    attached_count: 0,
    skipped_count: blocked.length,
    error_count: 0,
    range: {
      start_date: parsedStart,
      end_date: parsedEnd,
    },
    eligible_allowances_count: eligible.length,
    blocked_in_labor_area_count: blocked.length,
    items: eligible.map((row) => ({
      allowance_id: row.id,
      visit_date: row.visit_date,
      city: row.city || null,
      source_type: row.source_type || null,
      source_id: row.source_id || null,
      decision_type: row.decision_type || null,
      workflow_status: row.workflow_status || null,
      status: "pending_manual_xml_upload",
      reason: "Fase 1 activa: carga XML manual para este viatico",
    })),
    blocked_items: blocked.map((row) => ({
      allowance_id: row.id,
      visit_date: row.visit_date,
      city: row.city || null,
      status: "blocked_in_labor_area",
      reason: "Viatico en rango laboral: se registra trazabilidad pero no aplica reembolso",
    })),
    roadmap,
    message: hasLegacyCredentials
      ? "Credenciales endpoint/token ignoradas: flujo actual opera en Fase 1 manual."
      : "Flujo SRI en Fase 1 manual: sube XML al viatico fuera de area laboral.",
  };
}

async function listAllowanceInvoices({ allowanceId, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);
  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }
  assertAllowanceAccess(allowance, actorUser);
  const { rows } = await db.query(
    `
      SELECT *
      FROM travel_allowance_invoices
      WHERE allowance_id = $1
      ORDER BY issue_date ASC, id ASC
    `,
    [allowanceId]
  );
  return rows;
}

async function updateInvoiceClassification({ invoiceId, category, includeInAts, note, actorUser }) {
  await ensureSchema();
  assertFinanceApprover(actorUser);

  const normalizedCategory = category ? normalizeText(category) : null;
  if (normalizedCategory && !ALLOWED_EXPENSE_CATEGORIES.has(normalizedCategory)) {
    const error = new Error("Categoria no permitida");
    error.status = 400;
    throw error;
  }

  const values = [invoiceId];
  const sets = ["updated_at = NOW()"];
  if (normalizedCategory) {
    values.push(normalizedCategory);
    sets.push(`category = $${values.length}`);
    sets.push(`allowed_category = TRUE`);
    sets.push(`category_source = 'manual_finance'`);
    sets.push(`status = 'clasificada'`);
  }
  if (includeInAts !== undefined) {
    values.push(Boolean(includeInAts));
    sets.push(`include_in_ats = $${values.length}`);
    if (!Boolean(includeInAts)) {
      values.push(note || "Excluida por finanzas");
      sets.push(`exclude_from_ats_reason = $${values.length}`);
    }
  }
  if (note !== undefined) {
    values.push(note || null);
    sets.push(`validation_notes = COALESCE(validation_notes, '') || CASE WHEN validation_notes IS NULL OR validation_notes = '' THEN '' ELSE ' | ' END || COALESCE($${values.length}, '')`);
  }

  const { rows } = await db.query(
    `
      UPDATE travel_allowance_invoices
      SET ${sets.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    values
  );

  if (!rows.length) {
    const error = new Error("Factura no encontrada");
    error.status = 404;
    throw error;
  }

  await recomputeAllowanceAmountsFromInvoices(rows[0].allowance_id);
  return rows[0];
}

async function createOrUpdateZone({ payload, actorUser }) {
  await ensureSchema();
  assertAdminOrFinance(actorUser);
  const code = normalizeText(payload.code || payload.name).replace(/\s+/g, "_");
  const name = String(payload.name || "").trim();
  const tokens = Array.isArray(payload.covered_city_tokens)
    ? payload.covered_city_tokens.map(normalizeText).filter(Boolean)
    : String(payload.covered_city_tokens || "")
        .split(",")
        .map(normalizeText)
        .filter(Boolean);
  if (!code || !name || !tokens.length) {
    const error = new Error("code, name y covered_city_tokens son obligatorios");
    error.status = 400;
    throw error;
  }
  const { rows } = await db.query(
    `
      INSERT INTO travel_allowance_zones (code, name, covered_city_tokens, active, updated_at)
      VALUES ($1, $2, $3, COALESCE($4, TRUE), NOW())
      ON CONFLICT (code)
      DO UPDATE SET
        name = EXCLUDED.name,
        covered_city_tokens = EXCLUDED.covered_city_tokens,
        active = EXCLUDED.active,
        updated_at = NOW()
      RETURNING *
    `,
    [code, name, tokens, payload.active !== undefined ? Boolean(payload.active) : true]
  );
  return rows[0];
}

async function upsertFixedProfile({ payload, actorUser }) {
  await ensureSchema();
  assertAdminOrFinance(actorUser);
  const userId = Number(payload.user_id);
  if (!Number.isFinite(userId) || userId <= 0) {
    const error = new Error("user_id invalido");
    error.status = 400;
    throw error;
  }
  const { rows } = await db.query(
    `
      INSERT INTO travel_allowance_fixed_profiles (
        user_id, aplica_viatico_fijo, monto_mensual, zona_cubierta_id, km_incluidos_mes,
        fecha_inicio, fecha_fin, estado, updated_at
      )
      VALUES ($1, COALESCE($2, FALSE), $3, $4, $5, $6, $7, COALESCE($8, 'activo'), NOW())
      RETURNING *
    `,
    [
      userId,
      Boolean(payload.aplica_viatico_fijo),
      Number(payload.monto_mensual || 0),
      payload.zona_cubierta_id ? Number(payload.zona_cubierta_id) : null,
      Number(payload.km_incluidos_mes || 0),
      payload.fecha_inicio || new Date().toISOString().slice(0, 10),
      payload.fecha_fin || null,
      payload.estado || "activo",
    ]
  );
  return rows[0];
}

async function listFixedProfiles({ actorUser, userId }) {
  await ensureSchema();
  assertAdminOrFinance(actorUser);
  const values = [];
  let where = "";
  if (userId) {
    values.push(Number(userId));
    where = `WHERE p.user_id = $1`;
  }
  const { rows } = await db.query(
    `
      SELECT p.*, z.code AS zone_code, z.name AS zone_name
      FROM travel_allowance_fixed_profiles p
      LEFT JOIN travel_allowance_zones z ON z.id = p.zona_cubierta_id
      ${where}
      ORDER BY p.user_id, p.fecha_inicio DESC, p.id DESC
    `,
    values
  );
  return rows;
}

async function updatePolicy({ payload, actorUser }) {
  await ensureSchema();
  assertAdminOrFinance(actorUser);
  const { rows } = await db.query(
    `
      UPDATE travel_allowance_policy
      SET km_excess_rate = COALESCE($1, km_excess_rate),
          include_associated_expenses_on_excess = COALESCE($2, include_associated_expenses_on_excess),
          strict_company_buyer_match = COALESCE($3, strict_company_buyer_match),
          invoice_date_margin_days = COALESCE($4, invoice_date_margin_days),
          updated_by_user_id = $5,
          updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `,
    [
      payload.km_excess_rate !== undefined ? Number(payload.km_excess_rate) : null,
      payload.include_associated_expenses_on_excess !== undefined ? Boolean(payload.include_associated_expenses_on_excess) : null,
      payload.strict_company_buyer_match !== undefined ? Boolean(payload.strict_company_buyer_match) : null,
      payload.invoice_date_margin_days !== undefined ? Number(payload.invoice_date_margin_days) : null,
      actorUser.id || null,
    ]
  );
  return rows[0];
}

async function buildFinanceSummaryReport({ actorUser, startDate, endDate, groupBy = "usuario" }) {
  await ensureSchema();
  assertFinanceApprover(actorUser);
  const range = resolveDateRange(startDate, endDate);
  const g = normalizeText(groupBy);
  const dimensions = {
    usuario: "COALESCE(u.fullname, ta.requester_email)",
    viaje: "ta.id::text",
    proveedor: "COALESCE(i.supplier_name, 'Sin proveedor')",
    categoria: "COALESCE(i.category, 'sin_categoria')",
  };
  const dimension = dimensions[g] || dimensions.usuario;

  const { rows } = await db.query(
    `
      SELECT
        ${dimension} AS group_key,
        COUNT(DISTINCT ta.id)::int AS solicitudes,
        COALESCE(SUM(ta.distance_km), 0) AS kilometraje_total,
        COALESCE(SUM(ta.km_excess), 0) AS kilometraje_exceso,
        COALESCE(SUM(ta.amount), 0) AS monto_solicitado,
        COALESCE(SUM(ta.reimbursable_amount), 0) AS monto_reembolsable,
        COALESCE(SUM(CASE WHEN ta.decision_type = 'covered_fixed' THEN ta.amount ELSE 0 END), 0) AS cubierto_viatico_fijo,
        COALESCE(SUM(CASE WHEN i.duplicate_invoice THEN 1 ELSE 0 END), 0) AS facturas_duplicadas,
        COALESCE(SUM(CASE WHEN i.status = 'rechazada' THEN 1 ELSE 0 END), 0) AS facturas_rechazadas
      FROM travel_allowances ta
      LEFT JOIN users u ON u.id = ta.requester_user_id
      LEFT JOIN travel_allowance_invoices i ON i.allowance_id = ta.id
      WHERE ta.visit_date BETWEEN $1 AND $2
      GROUP BY 1
      ORDER BY monto_reembolsable DESC
    `,
    [range.startDate, range.endDate]
  );
  return {
    start_date: range.startDate,
    end_date: range.endDate,
    group_by: g,
    rows,
  };
}

async function generateAtsXml({ actorUser, period }) {
  await ensureSchema();
  assertFinanceApprover(actorUser);
  const targetPeriod = String(period || "").trim();
  if (!/^\d{4}-\d{2}$/.test(targetPeriod)) {
    const error = new Error("period debe tener formato YYYY-MM");
    error.status = 400;
    throw error;
  }
  const { rows } = await db.query(
    `
      SELECT
        i.id,
        i.access_key,
        i.authorization_number,
        i.supplier_ruc,
        i.supplier_name,
        i.issue_date,
        i.subtotal,
        i.iva,
        i.total,
        i.category
      FROM travel_allowance_invoices i
      WHERE to_char(i.issue_date, 'YYYY-MM') = $1
        AND i.include_in_ats = TRUE
        AND i.authorized_invoice = TRUE
        AND i.duplicate_invoice = FALSE
        AND i.allowed_category = TRUE
      ORDER BY i.issue_date, i.id
    `,
    [targetPeriod]
  );

  const items = rows
    .map(
      (invoice) => `
    <detalleCompras>
      <proveedorRuc>${invoice.supplier_ruc || ""}</proveedorRuc>
      <proveedor>${(invoice.supplier_name || "").replace(/[<>&]/g, "")}</proveedor>
      <fechaEmision>${invoice.issue_date ? String(invoice.issue_date).slice(0, 10) : ""}</fechaEmision>
      <claveAcceso>${invoice.access_key || ""}</claveAcceso>
      <autorizacion>${invoice.authorization_number || ""}</autorizacion>
      <subtotal>${Number(invoice.subtotal || 0).toFixed(2)}</subtotal>
      <iva>${Number(invoice.iva || 0).toFixed(2)}</iva>
      <total>${Number(invoice.total || 0).toFixed(2)}</total>
      <categoria>${invoice.category || "sin_categoria"}</categoria>
    </detalleCompras>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ats version="mvp">
  <periodo>${targetPeriod}</periodo>
  <compras>${items}
  </compras>
</ats>`;

  return {
    period: targetPeriod,
    invoices_count: rows.length,
    xml,
  };
}

/**
 * Parse the SRI tab-delimited TXT file (RUC_EMISOR … IMPORTE_TOTAL columns) and
 * insert each row as a travel_allowance_invoices record, filtering only invoices
 * whose issue_date falls within the allowance's trip date range.
 */
async function uploadSriTxtInvoices({ allowanceId, actorUser, txtContent }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const err = new Error("Viatico no encontrado");
    err.status = 404;
    throw err;
  }
  assertAllowanceAccess(allowance, actorUser);

  const lines = String(txtContent || "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    const err = new Error("El archivo TXT no contiene datos");
    err.status = 400;
    throw err;
  }

  // Resolve trip date range from allowance or its linked operational exit
  let tripStart = allowance.visit_date ? new Date(allowance.visit_date) : null;
  let tripEnd = tripStart;

  if (allowance.source_type === "operational_exit" && allowance.source_id) {
    const { rows: aeRows } = await db.query(
      `SELECT start_time, return_time FROM attendance_exceptions WHERE id = $1 LIMIT 1`,
      [allowance.source_id]
    );
    if (aeRows[0]) {
      tripStart = aeRows[0].start_time ? new Date(aeRows[0].start_time) : tripStart;
      tripEnd = aeRows[0].return_time ? new Date(aeRows[0].return_time) : tripEnd;
    }
  }

  const tripStartDate = tripStart ? tripStart.toISOString().slice(0, 10) : null;
  const tripEndDate = tripEnd ? tripEnd.toISOString().slice(0, 10) : null;

  // Header row is line 0; skip it
  const dataLines = lines.slice(1);
  const results = [];
  const errors = [];

  for (const rawLine of dataLines) {
    const cols = rawLine.split("\t");
    if (cols.length < 11) continue;

    const [
      supplierRuc,
      supplierName,
      ,
      serieComprobante,
      accessKey,
      ,
      fechaEmision,
      buyerId,
      subtotalRaw,
      ivaRaw,
      totalRaw,
    ] = cols.map((c) => String(c || "").trim());

    const issueDateEc = String(fechaEmision || "");
    // Convert DD/MM/YYYY → YYYY-MM-DD
    const dateMatch = issueDateEc.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    const issueDate = dateMatch
      ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      : issueDateEc.slice(0, 10);

    const subtotal = parseFloat(String(subtotalRaw).replace(",", ".")) || 0;
    const iva = parseFloat(String(ivaRaw).replace(",", ".")) || 0;
    const total = parseFloat(String(totalRaw).replace(",", ".")) || 0;

    // Parse serie → establishment-emission_point-sequential
    const serieParts = serieComprobante.split("-");
    const establishment = serieParts[0] || null;
    const emissionPoint = serieParts[1] || null;
    const sequential = serieParts[2] || null;

    const inRange = tripStartDate && tripEndDate
      ? issueDate >= tripStartDate && issueDate <= tripEndDate
      : true;

    if (!accessKey || accessKey.length < 40) {
      errors.push({ access_key: accessKey, reason: "clave_acceso invalida" });
      continue;
    }

    try {
      const { rows } = await db.query(
        `
        INSERT INTO travel_allowance_invoices (
          allowance_id, supplier_ruc, supplier_name, buyer_id, issue_date, access_key,
          establishment, emission_point, sequential,
          subtotal, iva, total,
          xml_well_formed, authorized_invoice, duplicate_invoice,
          in_trip_date_range, valid_buyer, valid_supplier,
          status, include_in_ats, xml_original,
          created_by_user_id, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          FALSE, TRUE, FALSE,
          $13, TRUE, TRUE,
          'pendiente_clasificacion', TRUE, '',
          $14, NOW(), NOW()
        )
        ON CONFLICT (access_key) DO NOTHING
        RETURNING id, access_key, supplier_name, issue_date, total, in_trip_date_range
        `,
        [
          allowanceId, supplierRuc || null, supplierName || null, buyerId || null,
          issueDate || null, accessKey,
          establishment, emissionPoint, sequential,
          subtotal, iva, total,
          inRange,
          actorUser.id || null,
        ]
      );
      if (rows[0]) results.push(rows[0]);
    } catch (insertErr) {
      errors.push({ access_key: accessKey, reason: insertErr.message });
    }
  }

  return { loaded: results.length, skipped: errors.length, errors: errors.slice(0, 20), items: results };
}

async function deleteAllowanceInvoice({ invoiceId, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const { rows } = await db.query(
    `SELECT tai.*, ta.requester_email, ta.requester_user_id
       FROM travel_allowance_invoices tai
       JOIN travel_allowances ta ON ta.id = tai.allowance_id
      WHERE tai.id = $1 LIMIT 1`,
    [invoiceId]
  );

  const invoice = rows[0];
  if (!invoice) {
    const err = new Error("Factura no encontrada");
    err.status = 404;
    throw err;
  }

  if (!isFinanceUser(actorUser)) {
    const actorEmail = String(actorUser?.email || "").toLowerCase();
    if (String(invoice.requester_email || "").toLowerCase() !== actorEmail) {
      const err = new Error("No tienes acceso a esta factura");
      err.status = 403;
      throw err;
    }
  }

  await db.query(`DELETE FROM travel_allowance_invoices WHERE id = $1`, [invoiceId]);
  return { deleted: true, id: invoiceId };
}

module.exports = {
  FINANCE_ROLES,
  isFinanceUser,
  canAccessViaticos,
  listVisitCandidates,
  listAllowances,
  upsertAllowance,
  updateAllowanceStatus,
  updateAllowanceWorkflowOperational,
  listAllowanceDocuments,
  createAllowanceDocument,
  uploadSriXmlInvoice,
  uploadSriTxtInvoices,
  uploadSriZipInvoices,
  deleteAllowanceInvoice,
  syncSriInvoicesForUser,
  listAllowanceInvoices,
  updateInvoiceClassification,
  createOrUpdateZone,
  upsertFixedProfile,
  listFixedProfiles,
  updatePolicy,
  buildFinanceSummaryReport,
  generateAtsXml,
  buildAllowanceReport,
};
