const db = require("../../config/db");
const logger = require("../../config/logger");
const axios = require("axios");
const PDFDocument = require("pdfkit");
const { PDFDocument: LibPdfDocument } = require("pdf-lib");
const { uploadBase64File, downloadFileBuffer } = require("../../utils/drive");
const { encrypt, decrypt } = require("../../utils/encryption");
const { HASH_ALGORITHM, computeSha256HexFromBase64 } = require("../../utils/documentHash");
const notificationsService = require("../notifications/notifications.service");
const NotificationManager = require("../notifications/notificationManager");

const FINANCE_ROLES = ["finanzas", "financiero", "jefe_finanzas", "jefe_financiero", "gerencia", "gerencia_general"];
const OPERATIONAL_APPROVER_ROLES = [
  "jefe_comercial",
  "jefe_tecnico",
  "jefe_servicio",
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
  "ing_servicio",
  "esp_app",
  "jefe_tecnico",
  "jefe_servicio",
  "jefe_servicio_tecnico",
  "ti",
  "jefe_ti",
  "talento_humano",
  "jefe_talento_humano",
  "admin",
  "ing_servicio_ext",
  "esp_app_ext",
];

const ALLOWED_STATUSES = new Set(["pending", "approved", "paid", "rejected"]);
const ALLOWED_SOURCE_TYPES = new Set(["client_visit", "prospect_visit", "manual_trip", "operational_exit"]);
const ALLOWED_DOC_TYPES = new Set(["invoice", "liquidation", "support"]);
const ALLOWED_WORKFLOW_STATUSES = new Set([
  "borrador",
  "pendiente_revision",
  "pendiente_aprobacion_talento",
  "pendiente_aprobacion_financiera",
  "pendiente_aprobacion_mixta",
  "observado",
  "aprobado_jefe",
  "aprobado_talento_humano",
  "rechazado_jefe",
  "pendiente_financiero",
  "aprobado_financiero",
  "aprobado_mixto",
  "rechazado_financiero",
  "listo_pago",
  "pagado",
  "devolucion_registrada",
  "pago_banco_registrado",
  "cierre_mixto_registrado",
  "cerrado",
  "incluido_xml_ats",
  "excluido_xml_ats",
]);
const FINANCE_WORKFLOW_STATUSES = new Set([
  "observado",
  "pendiente_financiero",
  "aprobado_financiero",
  "aprobado_mixto",
  "rechazado_financiero",
  "listo_pago",
  "pagado",
  "devolucion_registrada",
  "pago_banco_registrado",
  "cierre_mixto_registrado",
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
const ALLOWED_EXPENSE_CATEGORIES = new Set([
  "combustible",
  "alimentacion",
  "hospedaje",
  "transporte",
  "movilidad",
  "materiales",
]);
const ALLOWED_EXPENSE_MODES = new Set(["with_card", "without_card"]);
const ALLOWED_APPROVAL_STATUSES = new Set(["not_required", "pending", "approved"]);
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

function isGlobalViaticosViewer(user = {}) {
  // Talento Humano tiene su propia cola de revision (gastos en efectivo,
  // "Vista Talento") pero no estaba aqui -- assertAllowanceAccess bloqueaba
  // con 403 la lectura de facturas/notas/compras de OTRO usuario, y el
  // frontend traga ese error silenciosamente (.catch(() => [])), asi que se
  // veia "0 facturas" / "$0.00" sin ningun mensaje de error visible.
  return isFinanceUser(user) || isAdminUser(user) || isTalentoApprover(user);
}

function canAccessViaticos(user = {}) {
  if (isGlobalViaticosViewer(user)) return true;
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
  return roles.has("finanzas") || roles.has("financiero") || roles.has("jefe_financiero") || roles.has("jefe_finanzas");
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
  return Array.from(roles).some((role) => ["admin", "gerencia_general"].includes(role));
}

function isTalentoApprover(user = {}) {
  const roles = collectUserRoles(user);
  return Array.from(roles).some((role) => ["talento_humano", "jefe_talento_humano"].includes(role));
}

function assertAdminOrFinance(user = {}) {
  if (!isFinanceUser(user) && !isAdminUser(user)) {
    const error = new Error("Solo finanzas o admin puede ejecutar esta accion");
    error.status = 403;
    throw error;
  }
}

function normalizeExpenseMode(value) {
  const normalized = toLower(value);
  return ALLOWED_EXPENSE_MODES.has(normalized) ? normalized : null;
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
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reviewer_observation TEXT,
      ADD COLUMN IF NOT EXISTS reviewer_observation_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reviewer_observation_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS payment_reference TEXT,
      ADD COLUMN IF NOT EXISTS payment_receipt_drive_url TEXT,
      ADD COLUMN IF NOT EXISTS payment_receipt_drive_id TEXT,
      ADD COLUMN IF NOT EXISTS payment_receipt_uploaded_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS payment_receipt_uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  await db.query(`
    ALTER TABLE attendance_exceptions
      ADD COLUMN IF NOT EXISTS operational_destination_label TEXT,
      ADD COLUMN IF NOT EXISTS operational_destination_city TEXT;
  `).catch(() => null);

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
      ADD COLUMN IF NOT EXISTS trip_reason TEXT,
      ADD COLUMN IF NOT EXISTS classification_completed BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS total_with_card NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_without_card NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS requires_finance_approval BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS requires_talento_approval BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS finance_approval_status TEXT NOT NULL DEFAULT 'not_required',
      ADD COLUMN IF NOT EXISTS talento_approval_status TEXT NOT NULL DEFAULT 'not_required',
      ADD COLUMN IF NOT EXISTS finance_approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS talento_approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS finance_approved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS talento_approved_at TIMESTAMPTZ;
  `);

  await db.query(`
    UPDATE travel_allowances
       SET classification_completed = TRUE
     WHERE source_type <> 'operational_exit'
        OR outside_labor_area = TRUE
        OR workflow_status IN (
          'aprobado_jefe',
          'rechazado_jefe',
          'pendiente_financiero',
          'pendiente_aprobacion_talento',
          'pendiente_aprobacion_financiera',
          'pendiente_aprobacion_mixta',
          'aprobado_financiero',
          'aprobado_talento_humano',
          'aprobado_mixto',
          'rechazado_financiero',
          'listo_pago',
          'pagado',
          'devolucion_registrada',
          'pago_banco_registrado',
          'cierre_mixto_registrado',
          'cerrado',
          'incluido_xml_ats',
          'excluido_xml_ats'
        )
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
      CHECK (category IN ('alimentacion', 'combustible', 'hospedaje', 'transporte', 'movilidad', 'materiales'))
    );
  `);

  await db.query(`
    ALTER TABLE travel_allowance_provider_catalog
    DROP CONSTRAINT IF EXISTS travel_allowance_provider_catalog_category_check;
  `);
  await db.query(`
    ALTER TABLE travel_allowance_provider_catalog
    ADD CONSTRAINT travel_allowance_provider_catalog_category_check
    CHECK (category IN ('alimentacion', 'combustible', 'hospedaje', 'transporte', 'movilidad', 'materiales'));
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_invoices (
      id BIGSERIAL PRIMARY KEY,
      allowance_id BIGINT NOT NULL REFERENCES travel_allowances(id) ON DELETE CASCADE,
      document_id BIGINT REFERENCES travel_allowance_documents(id) ON DELETE SET NULL,
      supplier_ruc TEXT,
      supplier_name TEXT,
      receipt_type TEXT,
      buyer_id TEXT,
      issue_date DATE,
      authorization_date TIMESTAMPTZ,
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
    ALTER TABLE travel_allowance_invoices
      ADD COLUMN IF NOT EXISTS receipt_type TEXT,
      ADD COLUMN IF NOT EXISTS authorization_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS expense_mode TEXT,
      ADD COLUMN IF NOT EXISTS reviewer_note TEXT;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_purchases_no_invoice (
      id BIGSERIAL PRIMARY KEY,
      allowance_id BIGINT NOT NULL REFERENCES travel_allowances(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      total NUMERIC(12,2) NOT NULL,
      purchase_date DATE NOT NULL,
      justification TEXT,
      file_id BIGINT REFERENCES travel_allowance_documents(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
      approved_by_finance INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_by_talento INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    ALTER TABLE travel_allowance_purchases_no_invoice
      ADD COLUMN IF NOT EXISTS expense_mode TEXT;
  `);

  await db.query(`
    ALTER TABLE travel_allowances
      ADD COLUMN IF NOT EXISTS processing_state VARCHAR(30) NOT NULL DEFAULT 'sin_procesar',
      ADD COLUMN IF NOT EXISTS processing_deadline_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS grace_deadline_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS processed_month DATE,
      ADD COLUMN IF NOT EXISTS annulled_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS annulled_reason TEXT,
      ADD COLUMN IF NOT EXISTS final_balance_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS final_balance_result VARCHAR(20) NOT NULL DEFAULT 'en_cero';
  `);

  await db.query(`
    ALTER TABLE travel_allowances
      DROP CONSTRAINT IF EXISTS travel_allowances_processing_state_check;
  `);
  await db.query(`
    ALTER TABLE travel_allowances
      ADD CONSTRAINT travel_allowances_processing_state_check
      CHECK (processing_state IN ('sin_procesar', 'parcial', 'liquidado_total', 'anulado'));
  `);
  await db.query(`
    ALTER TABLE travel_allowances
      DROP CONSTRAINT IF EXISTS travel_allowances_final_balance_result_check;
  `);
  await db.query(`
    ALTER TABLE travel_allowances
      ADD CONSTRAINT travel_allowances_final_balance_result_check
      CHECK (final_balance_result IN ('por_pagar', 'en_cero', 'por_devolver'));
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_travel_allowances_processing_state
      ON travel_allowances(processing_state);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_travel_allowances_processed_month
      ON travel_allowances(processed_month)
      WHERE processed_month IS NOT NULL;
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_travel_allowances_deadline
      ON travel_allowances(grace_deadline_at)
      WHERE grace_deadline_at IS NOT NULL;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_segments (
      id BIGSERIAL PRIMARY KEY,
      allowance_id BIGINT NOT NULL REFERENCES travel_allowances(id) ON DELETE CASCADE,
      segment_type VARCHAR(20) NOT NULL,
      workflow_status VARCHAR(20) NOT NULL DEFAULT 'borrador',
      submitted_at TIMESTAMPTZ,
      submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      review_started_at TIMESTAMPTZ,
      reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      rejected_at TIMESTAMPTZ,
      rejected_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      liquidated_at TIMESTAMPTZ,
      liquidated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      calculated_total NUMERIC(12,2) NOT NULL DEFAULT 0,
      approved_total NUMERIC(12,2) NOT NULL DEFAULT 0,
      economic_result_type VARCHAR(30),
      economic_result_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      bank_payment_reference TEXT,
      liquidation_document_drive_id TEXT,
      liquidation_document_drive_url TEXT,
      visible_in_active_queue BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_travel_allowance_segments_allowance_type UNIQUE (allowance_id, segment_type),
      CONSTRAINT travel_allowance_segments_segment_type_check
        CHECK (segment_type IN ('with_card', 'without_card')),
      CONSTRAINT travel_allowance_segments_workflow_status_check
        CHECK (workflow_status IN ('borrador', 'enviado', 'en_revision', 'aprobado', 'rechazado', 'liquidado')),
      CONSTRAINT travel_allowance_segments_economic_result_type_check
        CHECK (
          economic_result_type IS NULL
          OR economic_result_type IN ('valor_a_pagar', 'saldo_cero', 'valor_a_devolver')
        )
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_travel_allowance_segments_queue
      ON travel_allowance_segments(segment_type, workflow_status, visible_in_active_queue);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_travel_allowance_segments_allowance
      ON travel_allowance_segments(allowance_id);
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS travel_allowance_segment_events (
      id BIGSERIAL PRIMARY KEY,
      allowance_id BIGINT NOT NULL REFERENCES travel_allowances(id) ON DELETE CASCADE,
      segment_id BIGINT REFERENCES travel_allowance_segments(id) ON DELETE CASCADE,
      event_type VARCHAR(40) NOT NULL,
      from_status VARCHAR(30),
      to_status VARCHAR(30),
      observation TEXT,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_travel_allowance_segment_events_allowance
      ON travel_allowance_segment_events(allowance_id, created_at DESC);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_travel_allowance_segment_events_segment
      ON travel_allowance_segment_events(segment_id, created_at DESC)
      WHERE segment_id IS NOT NULL;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS viatico_anticipos (
      id SERIAL PRIMARY KEY,
      allowance_id INTEGER NOT NULL REFERENCES travel_allowances(id) ON DELETE CASCADE,
      requested_by_user_id INTEGER REFERENCES users(id),
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      purpose TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
      approved_by_user_id INTEGER REFERENCES users(id),
      approved_at TIMESTAMPTZ,
      disbursed_at TIMESTAMPTZ,
      payment_reference VARCHAR(255),
      applied_at TIMESTAMPTZ,
      applied_amount NUMERIC(12,2),
      difference_amount NUMERIC(12,2),
      rejected_reason TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    ALTER TABLE viatico_anticipos
      ADD COLUMN IF NOT EXISTS payment_receipt_drive_id TEXT,
      ADD COLUMN IF NOT EXISTS payment_receipt_drive_url TEXT,
      ADD COLUMN IF NOT EXISTS payment_receipt_uploaded_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS payment_receipt_uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  await db.query(`
    ALTER TABLE travel_allowance_invoices
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS rejected_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS returned_to_draft_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS returned_to_draft_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  await db.query(`
    ALTER TABLE travel_allowance_purchases_no_invoice
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS rejected_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS returned_to_draft_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS returned_to_draft_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
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
    { category: "combustible", words: ["combustible", "gasolina", "diesel", "diÃ©sel", "extra", "super"] },
    { category: "hospedaje", words: ["hospedaje", "hotel", "habitacion", "habitaciÃ³n"] },
    { category: "alimentacion", words: ["desayuno", "almuerzo", "cena", "alimentacion", "alimentaciÃ³n", "restaurante"] },
    { category: "transporte", words: ["taxi", "uber", "cabify", "pasaje", "transporte", "bus", "terminal", "peaje"] },
    { category: "movilidad", words: ["movilidad", "estacionamiento", "parqueadero", "metro", "trole"] },
    { category: "materiales", words: ["material", "materiales", "insumo", "repuesto", "herramienta", "papeleria", "suministro"] },
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

  if (!isGlobalViaticosViewer(actorUser)) {
    const actorEmail = String(actorUser.email || "").toLowerCase();
    const actorUserId = Number(actorUser.id);
    params.push(actorEmail);
    const emailParamIndex = params.length;
    if (Number.isFinite(actorUserId) && actorUserId > 0) {
      params.push(actorUserId);
      const userIdParamIndex = params.length;
      filters.push(
        `(LOWER(COALESCE(base.requester_email, '')) = $${emailParamIndex} OR base.requester_user_id = $${userIdParamIndex})`
      );
    } else {
      filters.push(`LOWER(COALESCE(base.requester_email, '')) = $${emailParamIndex}`);
    }
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
          cvl.duracion_minutos,
          NULL::text AS operational_scope,
          NULL::text AS operational_category,
          FALSE AS uses_personal_vehicle,
          NULL::numeric AS odometer_start_km,
          NULL::numeric AS odometer_end_km,
          NULL::numeric AS odometer_distance_km,
          NULL::text AS odometer_start_photo_drive_file_id,
          NULL::text AS odometer_start_photo_drive_url,
          NULL::text AS odometer_end_photo_drive_file_id,
          NULL::text AS odometer_end_photo_drive_url
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
          NULL::integer AS duracion_minutos,
          NULL::text AS operational_scope,
          NULL::text AS operational_category,
          FALSE AS uses_personal_vehicle,
          NULL::numeric AS odometer_start_km,
          NULL::numeric AS odometer_end_km,
          NULL::numeric AS odometer_distance_km,
          NULL::text AS odometer_start_photo_drive_file_id,
          NULL::text AS odometer_start_photo_drive_url,
          NULL::text AS odometer_end_photo_drive_file_id,
          NULL::text AS odometer_end_photo_drive_url
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
          COALESCE(NULLIF(BTRIM(ae.operational_destination_city), ''), NULLIF(BTRIM(ae.operational_destination_label), ''), NULLIF(BTRIM(ae.description), ''), 'Salida operacional') AS city,
          COALESCE(NULLIF(BTRIM(ae.operational_destination_label), ''), NULLIF(BTRIM(ae.description), ''), ae.type, 'Salida operacional') AS reference_name,
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
          END::integer AS duracion_minutos,
          ae.operational_scope,
          ae.operational_category,
          ae.uses_personal_vehicle,
          ae.odometer_start_km,
          ae.odometer_end_km,
          ae.odometer_distance_km,
          ae.odometer_start_photo_drive_file_id,
          ae.odometer_start_photo_drive_url,
          ae.odometer_end_photo_drive_file_id,
          ae.odometer_end_photo_drive_url
        FROM attendance_exceptions ae
        LEFT JOIN users u ON u.id = ae.user_id
        WHERE ae.start_time::date BETWEEN $1 AND $2
          AND LOWER(COALESCE(ae.type, '')) = ANY(ARRAY['operacion_campo', 'operacion_de_campo', 'salida_oficina', 'viaje', 'campo']::text[])
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
      LEFT JOIN LATERAL (
        SELECT ta_latest.*
        FROM travel_allowances ta_latest
        WHERE ta_latest.source_type = base.source_type
          AND ta_latest.source_id = base.source_id
        ORDER BY ta_latest.updated_at DESC NULLS LAST, ta_latest.id DESC
        LIMIT 1
      ) ta ON true
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
  const filters = [
    "ta.visit_date BETWEEN $1 AND $2",
    `(
      ta.source_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM travel_allowances newer
        WHERE newer.source_type = ta.source_type
          AND newer.source_id = ta.source_id
          AND (
            COALESCE(newer.updated_at, '-infinity'::timestamptz) > COALESCE(ta.updated_at, '-infinity'::timestamptz)
            OR (
              COALESCE(newer.updated_at, '-infinity'::timestamptz) = COALESCE(ta.updated_at, '-infinity'::timestamptz)
              AND newer.id > ta.id
            )
          )
      )
    )`,
  ];

  if (status && ALLOWED_STATUSES.has(toLower(status))) {
    params.push(toLower(status));
    filters.push(`ta.status = $${params.length}`);
  }

  if (!isGlobalViaticosViewer(actorUser)) {
    const actorEmail = String(actorUser.email || "").toLowerCase();
    const actorUserId = Number(actorUser.id);
    params.push(actorEmail);
    const emailParamIndex = params.length;
    if (Number.isFinite(actorUserId) && actorUserId > 0) {
      params.push(actorUserId);
      const userIdParamIndex = params.length;
      filters.push(
        `(LOWER(COALESCE(ta.requester_email, '')) = $${emailParamIndex} OR ta.requester_user_id = $${userIdParamIndex})`
      );
    } else {
      filters.push(`LOWER(COALESCE(ta.requester_email, '')) = $${emailParamIndex}`);
    }
  }

  const { rows } = await db.query(
    `
      SELECT
        ta.*,
        ru.fullname AS requester_name,
        fu.fullname AS finance_user_name,
        COALESCE(seg.segments_json, '[]'::json) AS segments,
        COALESCE(NULLIF(BTRIM(ae.operational_destination_label), ''), NULLIF(BTRIM(ae.description), ''), ta.notes, 'Salida operacional') AS reference_name,
        ae.start_time AS hora_entrada,
        ae.return_time AS hora_salida,
        ae.operational_scope,
        ae.operational_category,
        COALESCE(ae.uses_personal_vehicle, FALSE) AS uses_personal_vehicle,
        ae.odometer_start_km,
        ae.odometer_end_km,
        ae.odometer_distance_km,
        ae.odometer_start_photo_drive_file_id,
        ae.odometer_start_photo_drive_url,
        ae.odometer_end_photo_drive_file_id,
        ae.odometer_end_photo_drive_url,
        COALESCE(doc.docs_count, 0) AS docs_count,
        COALESCE(doc.invoices_total, 0) AS invoices_total
      FROM travel_allowances ta
      LEFT JOIN users ru ON ru.id = ta.requester_user_id
      LEFT JOIN users fu ON fu.id = ta.finance_user_id
      LEFT JOIN attendance_exceptions ae
        ON ta.source_type = 'operational_exit'
       AND ae.id = ta.source_id
      LEFT JOIN (
        SELECT
          allowance_id,
          json_agg(
            json_build_object(
              'id', id,
              'segment_type', segment_type,
              'workflow_status', workflow_status,
              'calculated_total', calculated_total,
              'approved_total', approved_total,
              'economic_result_type', economic_result_type,
              'economic_result_amount', economic_result_amount,
              'visible_in_active_queue', visible_in_active_queue,
              'submitted_at', submitted_at,
              'approved_at', approved_at,
              'liquidated_at', liquidated_at
            )
            ORDER BY segment_type
          ) AS segments_json
        FROM travel_allowance_segments
        GROUP BY allowance_id
      ) seg ON seg.allowance_id = ta.id
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
           COALESCE(NULLIF(BTRIM(ae.operational_destination_city), ''), NULLIF(BTRIM(ae.operational_destination_label), ''), NULLIF(BTRIM(ae.description), ''), 'Salida operacional') AS city,
           ae.start_time,
           ae.return_time,
           ae.uses_personal_vehicle,
           ae.odometer_start_km,
           ae.odometer_end_km,
           ae.odometer_distance_km,
           ae.odometer_start_photo_drive_file_id,
           ae.odometer_start_photo_drive_url,
           ae.odometer_end_photo_drive_file_id,
           ae.odometer_end_photo_drive_url
         FROM attendance_exceptions ae
         LEFT JOIN users u ON u.id = ae.user_id
         WHERE ae.id = $1
           AND LOWER(COALESCE(ae.type, '')) = ANY(ARRAY['operacion_campo', 'operacion_de_campo', 'salida_oficina', 'viaje', 'campo']::text[])
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
  const privilegedViewer = isGlobalViaticosViewer(actorUser);
  const requesterEmail = String(actorUser?.email || "").toLowerCase();
  if (privilegedViewer) return;
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

function assertWizardProcessingFlow({ allowance, actorUser, viaWizard, actionLabel }) {
  if (isGlobalViaticosViewer(actorUser) || isOperationalApprover(actorUser)) return;
  const requesterEmail = String(allowance?.requester_email || "").toLowerCase();
  const actorEmail = String(actorUser?.email || "").toLowerCase();
  if (!requesterEmail || requesterEmail !== actorEmail) return;
  if (viaWizard) return;
  const error = new Error(`Debes ${actionLabel} desde el wizard de viaticos`);
  error.status = 400;
  throw error;
}

async function computeAllowanceModeTotals(allowanceId) {
  const { rows } = await db.query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN expense_mode = 'with_card' THEN total ELSE 0 END), 0) AS total_with_card,
        COALESCE(SUM(CASE WHEN expense_mode = 'without_card' THEN total ELSE 0 END), 0) AS total_without_card
      FROM (
        SELECT expense_mode, total
        FROM travel_allowance_invoices
        WHERE allowance_id = $1
          AND COALESCE(status, '') <> 'rechazada'
        UNION ALL
        SELECT expense_mode, total
        FROM travel_allowance_purchases_no_invoice
        WHERE allowance_id = $1
          AND COALESCE(status, '') <> 'rejected'
      ) items
    `,
    [allowanceId]
  );

  const row = rows[0] || {};
  const totalWithCard = Number(row.total_with_card || 0);
  const totalWithoutCard = Number(row.total_without_card || 0);
  return {
    totalWithCard,
    totalWithoutCard,
    requiresFinanceApproval: totalWithCard > 0,
    requiresTalentoApproval: totalWithoutCard > 0,
  };
}

function resolvePendingWorkflowStatus({ requiresFinanceApproval, requiresTalentoApproval }) {
  if (requiresFinanceApproval && requiresTalentoApproval) return "pendiente_aprobacion_mixta";
  if (requiresFinanceApproval) return "pendiente_aprobacion_financiera";
  if (requiresTalentoApproval) return "pendiente_aprobacion_talento";
  return "pendiente_revision";
}

function resolveApprovedWorkflowStatus({ requiresFinanceApproval, requiresTalentoApproval }) {
  if (requiresFinanceApproval && requiresTalentoApproval) return "aprobado_mixto";
  if (requiresFinanceApproval) return "aprobado_financiero";
  if (requiresTalentoApproval) return "aprobado_talento_humano";
  return "aprobado_financiero";
}

function resolveSettlementWorkflowStatus({ requiresFinanceApproval, requiresTalentoApproval }) {
  if (requiresFinanceApproval && requiresTalentoApproval) return "cierre_mixto_registrado";
  if (requiresFinanceApproval) return "pago_banco_registrado";
  if (requiresTalentoApproval) return "devolucion_registrada";
  return "pagado";
}

function computeProcessingDates(visitDate) {
  const raw = parseIsoDate(String(visitDate || "").slice(0, 10));
  const base = raw ? new Date(`${raw}T00:00:00.000Z`) : new Date();
  const processedMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const graceEnd = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 7, 23, 59, 59, 999));
  return {
    processedMonth: processedMonth.toISOString().slice(0, 10),
    processingDeadlineAt: monthEnd.toISOString(),
    graceDeadlineAt: graceEnd.toISOString(),
  };
}

function computeLiquidatedBalance(segments) {
  let net = 0;
  for (const segment of segments) {
    if (String(segment.workflow_status || "").toLowerCase() !== "liquidado") continue;
    const amount = Number(segment.economic_result_amount || 0);
    const resultType = String(segment.economic_result_type || "").toLowerCase();
    if (resultType === "valor_a_pagar") net += amount;
    if (resultType === "valor_a_devolver") net -= amount;
  }
  if (net > 0) return { finalBalanceAmount: Number(net.toFixed(2)), finalBalanceResult: "por_pagar" };
  if (net < 0) return { finalBalanceAmount: Number(Math.abs(net).toFixed(2)), finalBalanceResult: "por_devolver" };
  return { finalBalanceAmount: 0, finalBalanceResult: "en_cero" };
}

async function listAllowanceSegments(allowanceId) {
  const { rows } = await db.query(
    `
      SELECT *
      FROM travel_allowance_segments
      WHERE allowance_id = $1
      ORDER BY segment_type
    `,
    [allowanceId]
  );
  return rows;
}

async function appendSegmentEvent({
  allowanceId,
  segmentId = null,
  eventType,
  fromStatus = null,
  toStatus = null,
  observation = null,
  actorUserId = null,
  metadata = {},
}) {
  await db.query(
    `
      INSERT INTO travel_allowance_segment_events (
        allowance_id, segment_id, event_type, from_status, to_status, observation, actor_user_id, metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `,
    [
      allowanceId,
      segmentId,
      eventType,
      fromStatus,
      toStatus,
      observation,
      actorUserId,
      JSON.stringify(metadata || {}),
    ]
  );
}

async function syncAllowanceSegments(allowanceId, { actorUserId = null } = {}) {
  await ensureSchema();
  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) return null;

  const modeTotals = await computeAllowanceModeTotals(allowanceId);
  const dates = computeProcessingDates(allowance.visit_date);
  const outsideLaborArea = Boolean(allowance.outside_labor_area);
  const classificationCompleted = Boolean(allowance.classification_completed);
  const shouldActivateSegments = outsideLaborArea && classificationCompleted;

  const existingSegments = await listAllowanceSegments(allowanceId);
  const existingByType = new Map(existingSegments.map((segment) => [segment.segment_type, segment]));
  const requestedSegments = [
    { segmentType: "with_card", total: modeTotals.totalWithCard },
    { segmentType: "without_card", total: modeTotals.totalWithoutCard },
  ];

  for (const requested of requestedSegments) {
    const existing = existingByType.get(requested.segmentType);
    const needsVisibleSegment = shouldActivateSegments && (requested.total > 0 || Boolean(existing));
    const defaultEconomicType = requested.segmentType === "with_card" && requested.total > 0 ? "valor_a_pagar" : null;

    if (!existing && needsVisibleSegment) {
      const { rows } = await db.query(
        `
          INSERT INTO travel_allowance_segments (
            allowance_id,
            segment_type,
            workflow_status,
            calculated_total,
            economic_result_type,
            visible_in_active_queue,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'borrador', $3, $4, TRUE, NOW(), NOW())
          RETURNING *
        `,
        [allowanceId, requested.segmentType, requested.total, defaultEconomicType]
      );
      existingByType.set(requested.segmentType, rows[0]);
      await appendSegmentEvent({
        allowanceId,
        segmentId: rows[0].id,
        eventType: "segment_created",
        toStatus: rows[0].workflow_status,
        actorUserId,
        metadata: { segment_type: requested.segmentType, calculated_total: requested.total },
      });
      continue;
    }

    if (existing) {
      const nextVisible = needsVisibleSegment || String(existing.workflow_status || "").toLowerCase() !== "borrador";
      await db.query(
        `
          UPDATE travel_allowance_segments
          SET calculated_total = $2,
              economic_result_type = CASE
                WHEN segment_type = 'with_card' AND $3::numeric > 0 AND economic_result_type IS NULL THEN 'valor_a_pagar'
                ELSE economic_result_type
              END,
              visible_in_active_queue = $4,
              updated_at = NOW()
          WHERE id = $1
        `,
        [existing.id, requested.total, requested.total, nextVisible]
      );
    }
  }

  const refreshedSegments = await listAllowanceSegments(allowanceId);
  const now = new Date();
  const graceDeadline = new Date(dates.graceDeadlineAt);
  const isExpired = shouldActivateSegments && now > graceDeadline;
  if (isExpired) {
    const draftSegmentsToAnnul = refreshedSegments.filter(
      (segment) => Boolean(segment.visible_in_active_queue) && String(segment.workflow_status || "").toLowerCase() === "borrador"
    );
    for (const draftSegment of draftSegmentsToAnnul) {
      await db.query(
        `
          UPDATE travel_allowance_segments
          SET visible_in_active_queue = FALSE,
              updated_at = NOW()
          WHERE id = $1
        `,
        [draftSegment.id]
      );
      await appendSegmentEvent({
        allowanceId,
        segmentId: draftSegment.id,
        eventType: "annulled_by_deadline",
        fromStatus: "borrador",
        toStatus: "borrador",
        actorUserId,
        observation: "Vencido por falta de informacion obligatoria",
        metadata: { segment_type: draftSegment.segment_type },
      });
    }
  }

  const normalizedSegments = await listAllowanceSegments(allowanceId);
  const activeSegments = normalizedSegments.filter((segment) => Boolean(segment.visible_in_active_queue));
  const sentSegments = activeSegments.filter((segment) => String(segment.workflow_status || "").toLowerCase() !== "borrador");
  const allLiquidated = activeSegments.length > 0 && activeSegments.every((segment) => String(segment.workflow_status || "").toLowerCase() === "liquidado");

  let processingState = "sin_procesar";
  let annulledAt = null;
  let annulledReason = null;

  if (isExpired && sentSegments.length === 0) {
    processingState = "anulado";
    annulledAt = now.toISOString();
    annulledReason = "Vencido sin envio dentro de plazo";
  } else if (allLiquidated) {
    processingState = "liquidado_total";
  } else if (sentSegments.length > 0) {
    processingState = "parcial";
  }

  const liquidatedBalance = computeLiquidatedBalance(normalizedSegments);
  await db.query(
    `
      UPDATE travel_allowances
      SET total_with_card = $2,
          total_without_card = $3,
          requires_finance_approval = $4,
          requires_talento_approval = $5,
          processed_month = $6::date,
          processing_deadline_at = $7::timestamptz,
          grace_deadline_at = $8::timestamptz,
          processing_state = $9::text,
          annulled_at = CASE WHEN $9::text = 'anulado' THEN COALESCE(annulled_at, $10::timestamptz) ELSE NULL END,
          annulled_reason = CASE WHEN $9::text = 'anulado' THEN COALESCE(annulled_reason, $11::text) ELSE NULL END,
          final_balance_amount = $12,
          final_balance_result = $13::text,
          amount = $2::numeric + $3::numeric,
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      allowanceId,
      modeTotals.totalWithCard,
      modeTotals.totalWithoutCard,
      modeTotals.requiresFinanceApproval,
      modeTotals.requiresTalentoApproval,
      dates.processedMonth,
      dates.processingDeadlineAt,
      dates.graceDeadlineAt,
      processingState,
      annulledAt,
      annulledReason,
      liquidatedBalance.finalBalanceAmount,
      liquidatedBalance.finalBalanceResult,
    ]
  );

  return {
    ...(await getAllowanceById(allowanceId)),
    segments: normalizedSegments,
  };
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
  let distanceKm = Number(payload.distance_km || 0);
  const fuelAmount = Number(payload.fuel_amount || 0);
  const liquidationAmount = Number(payload.liquidation_amount || 0);
  const workflowStatus = toLower(payload.workflow_status || "borrador");
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
  const classificationCompleted = payload.classification_completed === undefined
    ? sourceType !== "operational_exit"
    : Boolean(payload.classification_completed);

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
    const payloadCity = String(payload.city || "").trim();
    if (payloadCity) {
      resolvedCity = payloadCity;
    }

    if (sourceType === "operational_exit") {
      const trackedDistance = visitData.odometer_distance_km == null ? null : Number(visitData.odometer_distance_km);
      const startKm = visitData.odometer_start_km == null ? null : Number(visitData.odometer_start_km);
      const endKm = visitData.odometer_end_km == null ? null : Number(visitData.odometer_end_km);
      distanceKm = trackedDistance !== null && Number.isFinite(trackedDistance)
        ? trackedDistance
        : (startKm !== null && endKm !== null && Number.isFinite(startKm) && Number.isFinite(endKm)
          ? Number((endKm - startKm).toFixed(2))
          : 0);
    }

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
          classification_completed,
          attendance_check_status, attendance_check_payload,
          finance_user_id, reviewed_by_user_id, reviewed_at,
          payment_date, notes, created_at, updated_at
        )
        VALUES (
          $1::text, NULL, $2::text, $3::integer, $4::date, $5::text, $6::text,
          $7::text, $8::numeric, COALESCE($9::text, 'USD'), $10::numeric, $11::boolean, $12::text,
          $13::numeric, $14::numeric, $15::numeric,
          $16::text, $17::text, $18::text, $19::numeric, $20::numeric, $21::numeric,
          $22::boolean, $23::text, $24::text,
          $25::boolean,
          'unchecked', NULL,
          $26::integer, $27::integer, CASE WHEN $27::integer IS NULL THEN NULL ELSE NOW() END,
          $28::date, $29, NOW(), NOW()
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
        classificationCompleted,
        financeActor ? actorUser.id : null,
        financeActor ? actorUser.id : null,
        paymentDate,
        payload.notes || null,
      ]
    );
    return syncAllowanceSegments(rows[0].id, { actorUserId: actorUser.id || null });
  }

  const decision = await computeAllowanceDecision({
    requesterUserId: resolvedRequesterId,
    visitDate: resolvedVisitDate,
    city: resolvedCity,
    distanceKm,
    outsideLaborArea,
  });

  if (sourceType === "operational_exit") {
    const existing = await db.query(
      `
        SELECT id
        FROM travel_allowances
        WHERE source_type = $1
          AND source_id = $2
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      `,
      [sourceType, sourceId]
    );

    if (existing.rows[0]?.id) {
      const { rows } = await db.query(
        `
          UPDATE travel_allowances
          SET requester_email = $2,
              requester_user_id = $3::integer,
              visit_date = $4::date,
              city = $5::text,
              trip_type = COALESCE($6::text, travel_allowances.trip_type),
              status = $7::text,
              amount = $8::numeric,
              currency = COALESCE($9::text, 'USD'),
              distance_km = $10::numeric,
              outside_labor_area = $11::boolean,
              outside_labor_area_reason = $12::text,
              fuel_amount = $13::numeric,
              liquidation_amount = $14::numeric,
              approved_amount = COALESCE($15::numeric, travel_allowances.approved_amount),
              workflow_status = $16::text,
              decision_type = $17::text,
              decision_reason = $18::text,
              km_accumulated_month = $19::numeric,
              km_excess = $20::numeric,
              reimbursable_amount = $21::numeric,
              trip_authorized = $22::boolean,
              trip_authorization_ref = $23::text,
              trip_reason = $24::text,
              classification_completed = $25::boolean,
              finance_user_id = COALESCE($26::integer, travel_allowances.finance_user_id),
              reviewed_by_user_id = COALESCE($27::integer, travel_allowances.reviewed_by_user_id),
              reviewed_at = CASE
                WHEN $27::integer IS NULL THEN travel_allowances.reviewed_at
                ELSE NOW()
              END,
              payment_date = $28::date,
              notes = $29::text,
              attendance_check_status = 'unchecked',
              attendance_check_payload = NULL,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          existing.rows[0].id,
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
          classificationCompleted,
          financeActor ? actorUser.id : null,
          financeActor ? actorUser.id : null,
          paymentDate,
          payload.notes || null,
        ]
      );
      return syncAllowanceSegments(rows[0].id, { actorUserId: actorUser.id || null });
    }
  }

  const { rows } = await db.query(
    `
      INSERT INTO travel_allowances (
        source_type, source_id, requester_email, requester_user_id, visit_date, city, trip_type,
        status, amount, currency, distance_km, outside_labor_area, outside_labor_area_reason,
        fuel_amount, liquidation_amount, approved_amount,
        workflow_status, decision_type, decision_reason, km_accumulated_month, km_excess, reimbursable_amount,
        trip_authorized, trip_authorization_ref, trip_reason,
        classification_completed,
        attendance_check_status, attendance_check_payload,
        finance_user_id, reviewed_by_user_id, reviewed_at,
        payment_date, notes, created_at, updated_at
      )
      VALUES (
        $1::text, $2::bigint, $3::text, $4::integer, $5::date, $6::text, $7::text,
        $8::text, $9::numeric, COALESCE($10::text, 'USD'), $11::numeric, $12::boolean, $13::text,
        $14::numeric, $15::numeric, $16::numeric,
        $17::text, $18::text, $19::text, $20::numeric, $21::numeric, $22::numeric,
        $23::boolean, $24::text, $25::text,
        $26::boolean,
        'unchecked', NULL,
        $27::integer, $28::integer, CASE WHEN $28::integer IS NULL THEN NULL ELSE NOW() END,
        $29::date, $30::text, NOW(), NOW()
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
        classification_completed = EXCLUDED.classification_completed,
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
      classificationCompleted,
      financeActor ? actorUser.id : null,
      financeActor ? actorUser.id : null,
      paymentDate,
      payload.notes || null,
    ]
  );

  return syncAllowanceSegments(rows[0].id, { actorUserId: actorUser.id || null });
}

async function updateAllowanceStatus({
  allowanceId,
  status,
  workflowStatus,
  amount,
  approvedAmount,
  paymentDate,
  notes,
  destinationCity,
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

  const previousAllowance = await getAllowanceById(allowanceId);
  const normalizedDestinationCity = destinationCity === undefined
    ? null
    : String(destinationCity || "").trim();

  if (normalizedStatus === "approved") {
    const destinationToValidate = normalizedDestinationCity || String(previousAllowance?.city || "").trim();
    if (!destinationToValidate) {
      const error = new Error("Debe registrar la ciudad de destino antes de aprobar");
      error.status = 400;
      throw error;
    }

    const invoiceValidation = await db.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COALESCE(SUM(CASE WHEN category IS NULL OR BTRIM(category) = '' THEN 1 ELSE 0 END), 0)::int AS missing_category
        FROM travel_allowance_invoices
        WHERE allowance_id = $1
      `,
      [allowanceId]
    );
    const invoiceRow = invoiceValidation.rows[0] || { total: 0, missing_category: 0 };
    if (Number(invoiceRow.total || 0) <= 0) {
      const error = new Error("Debe cargar facturas antes de aprobar");
      error.status = 400;
      throw error;
    }
    if (Number(invoiceRow.missing_category || 0) > 0) {
      const error = new Error("Debe clasificar el concepto de gasto en todas las facturas antes de aprobar");
      error.status = 400;
      throw error;
    }
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

  if (destinationCity !== undefined) {
    values.push(normalizedDestinationCity || null);
    sets.push(`city = $${values.length}`);
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
    values.push(resolveSettlementWorkflowStatus({
      requiresFinanceApproval: Boolean(previousAllowance?.requires_finance_approval),
      requiresTalentoApproval: Boolean(previousAllowance?.requires_talento_approval),
    }));
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
  await notifyRequesterAllowanceStatusChange({
    allowance: updated,
    previousAllowance,
    actorUser,
    status: normalizedStatus,
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
          title: "ActualizaciÃ³n viÃ¡ticos por finanzas",
          message: `ViÃ¡tico #${allowance?.id || ""} actualizado a ${status || "sin_estado"} (${workflowStatus || "sin_workflow"}) por ${actorUser?.email || "usuario_finanzas"}.`,
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

async function notifyRequesterAllowanceStatusChange({ allowance, previousAllowance, actorUser, status }) {
  try {
    const finalStatuses = new Set(["approved", "rejected", "paid"]);
    if (!finalStatuses.has(status)) return;
    if (previousAllowance && String(previousAllowance.status || "").toLowerCase() === status) return;

    const requesterQuery = await db.query(
      `
        SELECT id, email, COALESCE(NULLIF(fullname, ''), NULLIF(name, ''), email) AS fullname
        FROM users
        WHERE id = $1
           OR LOWER(COALESCE(email, '')) = LOWER($2)
        ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [allowance?.requester_user_id || null, allowance?.requester_email || ""]
    );
    const requester = requesterQuery.rows[0];
    if (!requester?.id) return;

    const statusLabels = {
      approved: "aprobado",
      rejected: "rechazado",
      paid: "pagado",
    };
    const title = `Viatico ${statusLabels[status] || status}`;
    const amount = Number(allowance?.approved_amount ?? allowance?.amount ?? 0).toFixed(2);
    const message = [
      `Tu viatico #${allowance?.id || ""} fue ${statusLabels[status] || status}.`,
      `Fecha de salida: ${allowance?.visit_date ? String(allowance.visit_date).slice(0, 10) : "No disponible"}.`,
      `Monto aprobado/registrado: USD ${amount}.`,
      actorUser?.email ? `Actualizado por: ${actorUser.email}.` : null,
    ].filter(Boolean).join("\n");

    await NotificationManager.sendNotification({
      userId: requester.id,
      template: "custom_html",
      customTitle: title,
      customMessage: message,
      type: status === "rejected" ? "warning" : "success",
      priority: status === "paid" ? 2 : 1,
      source: "viaticos",
      meta: {
        allowance_id: allowance?.id || null,
        status,
        actor_email: actorUser?.email || null,
        email_to: requester?.email || allowance?.requester_email || null,
        target_path: "/dashboard/finanzas/viaticos",
      },
      data: {
        email_to: requester?.email || allowance?.requester_email || null,
        email_subject: title,
      },
      email: true,
      chat: false,
    });
  } catch (error) {
    logger.warn({ error, allowanceId: allowance?.id }, "No se pudo notificar al solicitante del viatico");
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
    const fileBuffer = Buffer.from(parsed.base64, "base64");
    contentHashSha256 = computeSha256HexFromBuffer(fileBuffer) || contentHashSha256;
    hashAlgorithm = contentHashSha256 ? HASH_ALGORITHM : hashAlgorithm;
    const targetMime = resolveUploadMimeType({
      explicitMimeType: mimeType,
      parsedMimeType: parsed.mimeType,
      fileName,
      buffer: fileBuffer,
    });
    const estimatedBytes = fileBuffer.length;
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
    receipt_type: extractTag(infoTributaria, "codDoc"),
    issue_date: extractTag(infoFactura, "fechaEmision"),
    authorization_date: extractTag(rawXml, "fechaAutorizacion"),
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

function parseEcDateTime(rawDateTime) {
  const value = String(rawDateTime || "").trim();
  if (!value) return null;
  const ddmmyyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ddmmyyyy) {
    const [, day, month, year, hour = "00", minute = "00", second = "00"] = ddmmyyyy;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

const normalizeSriTxtHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const readSriTxtColumn = (row, headerIndex, aliases, fallbackIndex = null) => {
  for (const alias of aliases) {
    const index = headerIndex.get(normalizeSriTxtHeader(alias));
    if (Number.isInteger(index) && index >= 0) return String(row[index] || "").trim();
  }
  if (Number.isInteger(fallbackIndex) && fallbackIndex >= 0) return String(row[fallbackIndex] || "").trim();
  return "";
};

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
   const authorizationDate = parseEcDateTime(parsed.authorization_date);
   const { rows } = await db.query(
     `
       INSERT INTO travel_allowance_invoices (
         allowance_id, document_id, supplier_ruc, supplier_name, receipt_type, buyer_id, issue_date, authorization_date, access_key,
         authorization_number, establishment, emission_point, sequential, subtotal, iva, total,
         payment_method, details_text, category, category_source, allowed_category,
         xml_well_formed, authorized_invoice, duplicate_invoice, duplicated_with_invoice_id,
         in_trip_date_range, valid_buyer, valid_supplier, status, include_in_ats, validation_notes,
         xml_original, created_by_user_id, created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15, $16,
         $17, $18, $19, $20, $21,
         $22, $23, $24, $25,
         $26, $27, $28, $29, TRUE, $30,
         $31, $32, NOW(), NOW()
       )
       RETURNING *
     `,
     [
       allowanceId,
       documentId,
       parsed.supplier_ruc || null,
       parsed.supplier_name || null,
       parsed.receipt_type || null,
       parsed.buyer_id || null,
       issueDate,
       authorizationDate,
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
       throw new Error("El archivo ZIP proporcionado no es vÃ¡lido");
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
      SELECT i.*, d.drive_link AS document_drive_link, d.file_name AS document_file_name
      FROM travel_allowance_invoices i
      LEFT JOIN travel_allowance_documents d ON d.id = i.document_id
      WHERE i.allowance_id = $1
      ORDER BY i.issue_date ASC, i.id ASC
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
 * Parse the SRI tab-delimited TXT file (RUC_EMISOR â€¦ IMPORTE_TOTAL columns) and
 * insert each row as a travel_allowance_invoices record, filtering only invoices
 * whose issue_date falls within the allowance's trip date range.
 */
async function uploadSriTxtInvoices({ allowanceId, actorUser, txtContent, categories = {}, viaWizard = false }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const err = new Error("Viatico no encontrado");
    err.status = 404;
    throw err;
  }
  assertAllowanceAccess(allowance, actorUser);
  assertWizardProcessingFlow({ allowance, actorUser, viaWizard, actionLabel: "cargar facturas SRI" });

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
  const headers = lines[0].split("\t").map(normalizeSriTxtHeader);
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const dataLines = lines.slice(1);
  const results = [];
  const errors = [];

  for (const rawLine of dataLines) {
    const cols = rawLine.split("\t");
    if (cols.length < 11) continue;

    const supplierRuc = readSriTxtColumn(cols, headerIndex, ["RUC_EMISOR", "RUC EMISOR"], 0);
    const supplierName = readSriTxtColumn(cols, headerIndex, ["RAZON_SOCIAL_EMISOR", "RAZON SOCIAL EMISOR"], 1);
    const receiptType = readSriTxtColumn(cols, headerIndex, ["TIPO_COMPROBANTE", "TIPO COMPROBANTE"], 2);
    const serieComprobante = readSriTxtColumn(cols, headerIndex, ["SERIE_COMPROBANTE", "SERIE COMPROBANTE"], 3);
    const accessKey = readSriTxtColumn(cols, headerIndex, ["CLAVE_ACCESO", "CLAVE ACCESO"], 4);
    const authorizationNumber = readSriTxtColumn(cols, headerIndex, ["NUMERO_AUTORIZACION", "NUMERO AUTORIZACION"], 5);
    const fechaAutorizacion = readSriTxtColumn(cols, headerIndex, ["FECHA_AUTORIZACION", "FECHA AUTORIZACION"], 6);
    const fechaEmision = readSriTxtColumn(cols, headerIndex, ["FECHA_EMISION", "FECHA EMISION"], 7);
    const buyerId = readSriTxtColumn(cols, headerIndex, ["IDENTIFICACION_RECEPTOR", "IDENTIFICACION RECEPTOR"], 8);
    const subtotalRaw = readSriTxtColumn(cols, headerIndex, ["VALOR_SIN_IMPUESTOS", "SUBTOTAL", "VALOR SIN IMPUESTOS"], 9);
    const ivaRaw = readSriTxtColumn(cols, headerIndex, ["IVA"], 10);
    const totalRaw = readSriTxtColumn(cols, headerIndex, ["IMPORTE_TOTAL", "TOTAL", "IMPORTE TOTAL"], 11);

    const issueDateEc = String(fechaEmision || "");
    // Convert DD/MM/YYYY â†’ YYYY-MM-DD
    const dateMatch = issueDateEc.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    const issueDate = dateMatch
      ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      : issueDateEc.slice(0, 10);

    const subtotal = parseFloat(String(subtotalRaw).replace(",", ".")) || 0;
    const iva = parseFloat(String(ivaRaw).replace(",", ".")) || 0;
    const total = parseFloat(String(totalRaw).replace(",", ".")) || 0;

    // Parse serie â†’ establishment-emission_point-sequential
    const serieParts = serieComprobante.split("-");
    const establishment = serieParts[0] || null;
    const emissionPoint = serieParts[1] || null;
    const sequential = serieParts[2] || null;

    const inRange = tripStartDate && tripEndDate
      ? issueDate >= tripStartDate && issueDate <= tripEndDate
      : true;

    // Discard invoices outside the trip date range â€” only load relevant ones
    if (!inRange) {
      errors.push({ access_key: accessKey, issue_date: issueDate, reason: "fuera_de_rango" });
      continue;
    }

    if (!accessKey || accessKey.length < 40) {
      errors.push({ access_key: accessKey, reason: "clave_acceso invalida" });
      continue;
    }

    const requestedClassification = accessKey ? categories[accessKey] : null;
    const requestedCategory = requestedClassification && typeof requestedClassification === "object"
      ? String(requestedClassification.category || "").trim().toLowerCase() || null
      : requestedClassification
        ? String(requestedClassification).trim().toLowerCase()
        : null;
    const requestedExpenseMode = requestedClassification && typeof requestedClassification === "object"
      ? normalizeExpenseMode(requestedClassification.expense_mode)
      : null;
    const validCategory = requestedCategory && ALLOWED_EXPENSE_CATEGORIES.has(requestedCategory)
      ? requestedCategory
      : null;
    // El respaldo (foto/PDF de la factura) ya se subio antes, al adjuntarlo en
    // el wizard (ver createAllowanceDocument) -- aqui solo enlazamos el
    // document_id ya existente, no se sube nada nuevo.
    const requestedDocumentId = requestedClassification && typeof requestedClassification === "object"
      ? Number(requestedClassification.document_id) || null
      : null;

    try {
      const { rows } = await db.query(
        `
        INSERT INTO travel_allowance_invoices (
          allowance_id, supplier_ruc, supplier_name, receipt_type, buyer_id, issue_date, authorization_date,
          access_key, authorization_number, establishment, emission_point, sequential,
          subtotal, iva, total,
          xml_well_formed, authorized_invoice, duplicate_invoice,
          in_trip_date_range, valid_buyer, valid_supplier,
          status, include_in_ats, xml_original,
          expense_mode,
          category, allowed_category, category_source,
          document_id,
          created_by_user_id, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15,
          FALSE, TRUE, FALSE,
          TRUE, TRUE, TRUE,
          CASE WHEN $17::text IS NOT NULL THEN 'clasificada' ELSE 'pendiente_clasificacion' END,
          TRUE, '',
          $18,
          $17, CASE WHEN $17::text IS NOT NULL THEN TRUE ELSE FALSE END,
          CASE WHEN $17::text IS NOT NULL THEN 'requester' ELSE NULL END,
          $19,
          $16, NOW(), NOW()
        )
        ON CONFLICT (access_key) DO UPDATE SET
          document_id = COALESCE(travel_allowance_invoices.document_id, EXCLUDED.document_id)
        RETURNING id, access_key, supplier_name, issue_date, total, in_trip_date_range, category, expense_mode, document_id, (xmax = 0) AS is_new_row
        `,
        [
          allowanceId, supplierRuc || null, supplierName || null, receiptType || null, buyerId || null,
          issueDate || null, parseEcDateTime(fechaAutorizacion),
          accessKey, authorizationNumber || null,
          establishment, emissionPoint, sequential,
          subtotal, iva, total,
          actorUser.id || null,
          validCategory,
          requestedExpenseMode,
          requestedDocumentId,
        ]
      );
      // xmax = 0 distingue un INSERT real de un conflicto que solo enlazo el
      // document_id de un respaldo subido despues -- eso no debe contar como
      // "factura cargada" de nuevo en el resumen que ve el usuario.
      if (rows[0]?.is_new_row) results.push(rows[0]);
    } catch (insertErr) {
      errors.push({ access_key: accessKey, reason: insertErr.message });
    }
  }

  // Sin esto, total_sri_invoices/amount se quedaban en el valor previo a la
  // carga -- financiero/talento veian $0.00 hasta que algo mas (una nota,
  // una compra, el envio a revision) disparaba el recalculo por otro lado.
  if (results.length > 0) {
    await recalculateAllowanceTotals(allowanceId);
  }

  const outOfRange = errors.filter((e) => e.reason === "fuera_de_rango");
  const actualErrors = errors.filter((e) => e.reason !== "fuera_de_rango");
  return {
    loaded: results.length,
    skipped: outOfRange.length,
    errors: actualErrors.slice(0, 20),
    out_of_range: outOfRange.length,
    items: results,
  };
}

 
 async function previewSriTxtInvoices({ allowanceId, actorUser, txtContent }) {
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

   let tripStart = allowance.visit_date ? new Date(allowance.visit_date) : null;
   let tripEnd = tripStart;

   if (allowance.source_type === "operational_exit" && allowance.source_id) {
     const { rows: aeRows } = await db.query(
       "SELECT start_time, return_time FROM attendance_exceptions WHERE id = $1 LIMIT 1",
       [allowance.source_id]
     );
     if (aeRows[0]) {
       tripStart = aeRows[0].start_time ? new Date(aeRows[0].start_time) : tripStart;
       tripEnd = aeRows[0].return_time ? new Date(aeRows[0].return_time) : tripEnd;
     }
   }

   const tripStartDate = tripStart ? tripStart.toISOString().slice(0, 10) : null;
   const tripEndDate = tripEnd ? tripEnd.toISOString().slice(0, 10) : null;

   const headers = lines[0].split("\t").map(normalizeSriTxtHeader);
   const headerIndex = new Map(headers.map((header, index) => [header, index]));
   const dataLines = lines.slice(1);

   const inRangeItems = [];
   const outOfRangeItems = [];

   for (const rawLine of dataLines) {
     const cols = rawLine.split("\t");
     if (cols.length < 11) continue;

     const supplierRuc = readSriTxtColumn(cols, headerIndex, ["RUC_EMISOR", "RUC EMISOR"], 0);
     const supplierName = readSriTxtColumn(cols, headerIndex, ["RAZON_SOCIAL_EMISOR", "RAZON SOCIAL EMISOR"], 1);
     const receiptType = readSriTxtColumn(cols, headerIndex, ["TIPO_COMPROBANTE", "TIPO COMPROBANTE"], 2);
     const serieComprobante = readSriTxtColumn(cols, headerIndex, ["SERIE_COMPROBANTE", "SERIE COMPROBANTE"], 3);
     const accessKey = readSriTxtColumn(cols, headerIndex, ["CLAVE_ACCESO", "CLAVE ACCESO"], 4);
     const authorizationNumber = readSriTxtColumn(cols, headerIndex, ["NUMERO_AUTORIZACION", "NUMERO AUTORIZACION"], 5);
     const fechaAutorizacion = readSriTxtColumn(cols, headerIndex, ["FECHA_AUTORIZACION", "FECHA AUTORIZACION"], 6);
     const fechaEmision = readSriTxtColumn(cols, headerIndex, ["FECHA_EMISION", "FECHA EMISION"], 7);
     const buyerId = readSriTxtColumn(cols, headerIndex, ["IDENTIFICACION_RECEPTOR", "IDENTIFICACION RECEPTOR"], 8);
     const subtotalRaw = readSriTxtColumn(cols, headerIndex, ["VALOR_SIN_IMPUESTOS", "SUBTOTAL", "VALOR SIN IMPUESTOS"], 9);
     const ivaRaw = readSriTxtColumn(cols, headerIndex, ["IVA"], 10);
     const totalRaw = readSriTxtColumn(cols, headerIndex, ["IMPORTE_TOTAL", "TOTAL", "IMPORTE TOTAL"], 11);

     const issueDateEc = String(fechaEmision || "");
     const dateMatch = issueDateEc.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
     const issueDate = dateMatch
       ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
       : issueDateEc.slice(0, 10);

     const serieParts = String(serieComprobante || "").split("-");
     const subtotal = parseFloat(String(subtotalRaw).replace(",", ".")) || 0;
     const iva = parseFloat(String(ivaRaw).replace(",", ".")) || 0;
     const total = parseFloat(String(totalRaw).replace(",", ".")) || 0;

     const inRange = tripStartDate && tripEndDate
       ? issueDate >= tripStartDate && issueDate <= tripEndDate
       : true;

     const item = {
       supplier_ruc: supplierRuc || null,
       supplier_name: supplierName || null,
       receipt_type: receiptType || null,
       establishment: serieParts[0] || null,
       emission_point: serieParts[1] || null,
       sequential: serieParts[2] || null,
       access_key: accessKey || null,
       authorization_number: authorizationNumber || null,
       authorization_date: parseEcDateTime(fechaAutorizacion),
       issue_date: issueDate,
       buyer_id: buyerId || null,
       subtotal,
       iva,
       total,
       in_trip_date_range: inRange,
     };

     if (inRange) {
       inRangeItems.push(item);
     } else {
       outOfRangeItems.push({ ...item, reason: "fuera_de_rango" });
     }
   }

   return {
     allowance_id: allowanceId,
     trip_date_range: { start: tripStartDate, end: tripEndDate },
     total_found: inRangeItems.length + outOfRangeItems.length,
     in_range_count: inRangeItems.length,
     out_of_range_count: outOfRangeItems.length,
     in_range: inRangeItems,
     out_of_range: outOfRangeItems,
   };
 }async function deleteAllowanceInvoice({ invoiceId, actorUser }) {
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

  const allowanceId = invoice.allowance_id;

  await db.query(`DELETE FROM travel_allowance_invoices WHERE id = $1`, [invoiceId]);

  // Recalcular totales despuÃ©s de eliminar
  await recalculateAllowanceTotals(allowanceId);

  return { deleted: true, id: invoiceId };
}

async function createManualNote({
  allowanceId,
  issueDate,
  supplierRuc,
  supplierName,
  subtotal12,
  subtotal0,
  iva,
  total,
  expenseDescription,
  documentState,
  emissionPoint,
  sequential,
  driveFileId,
  driveLink,
  notes,
  expenseMode,
  actorUser,
  viaWizard,
}) {
  assertViaticosAccess(actorUser);
  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const err = new Error("Viatico no encontrado");
    err.status = 404;
    throw err;
  }
  assertAllowanceAccess(allowance, actorUser);
  assertWizardProcessingFlow({ allowance, actorUser, viaWizard, actionLabel: "registrar notas manuales" });

  const normalizedExpenseMode = normalizeExpenseMode(expenseMode);
  if (!normalizedExpenseMode) {
    const err = new Error("Debes indicar si la nota es con tarjeta o sin tarjeta");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO travel_allowance_invoices (
      allowance_id, document_type, issue_date, supplier_ruc, supplier_name,
      subtotal_12, subtotal_0, iva, total, details_text,
      document_state, emission_point, sequential,
      expense_mode,
      drive_file_id, drive_link, validation_notes,
      status, created_by_user_id, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
    RETURNING *`,
    [
      allowanceId, 'nota_venta_manual', issueDate, supplierRuc, supplierName,
      subtotal12, subtotal0, iva, total, expenseDescription,
      documentState, emissionPoint, sequential, normalizedExpenseMode,
      driveFileId, driveLink, notes,
      'pendiente_clasificacion', actorUser.id
    ]
  );

  await recalculateAllowanceTotals(allowanceId);
  return syncAllowanceSegments(allowanceId, { actorUserId: actorUser.id || null });
}

async function listManualNotes({ allowanceId, actorUser }) {
  assertViaticosAccess(actorUser);

  const { rows } = await db.query(
    `SELECT * FROM travel_allowance_invoices
     WHERE allowance_id = $1 AND document_type = 'nota_venta_manual'
     ORDER BY issue_date DESC`,
    [allowanceId]
  );
  return rows;
}

async function updateManualNote({
  noteId,
  issueDate,
  supplierRuc,
  supplierName,
  subtotal12,
  subtotal0,
  iva,
  total,
  expenseDescription,
  documentState,
  emissionPoint,
  sequential,
  notes,
  expenseMode,
  actorUser,
  viaWizard,
}) {
  assertViaticosAccess(actorUser);

  const { rows: noteRows } = await db.query(
    `SELECT tai.allowance_id, ta.requester_email
     FROM travel_allowance_invoices tai
     JOIN travel_allowances ta ON ta.id = tai.allowance_id
     WHERE tai.id = $1 AND tai.document_type = $2`,
    [noteId, 'nota_venta_manual']
  );

  if (!noteRows.length) {
    const err = new Error('Nota no encontrada');
    err.status = 404;
    throw err;
  }

  const { allowance_id: allowanceId, requester_email } = noteRows[0];
  const allowance = await getAllowanceById(allowanceId);
  assertWizardProcessingFlow({ allowance, actorUser, viaWizard, actionLabel: "editar notas manuales" });

  if (!isFinanceUser(actorUser) && String(actorUser?.email || '').toLowerCase() !== String(requester_email || '').toLowerCase()) {
    const err = new Error('No tienes permiso para editar esta nota');
    err.status = 403;
    throw err;
  }

  const normalizedExpenseMode = normalizeExpenseMode(expenseMode);
  if (!normalizedExpenseMode) {
    const err = new Error("Debes indicar si la nota es con tarjeta o sin tarjeta");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `UPDATE travel_allowance_invoices SET
      issue_date = $1, supplier_ruc = $2, supplier_name = $3,
      subtotal_12 = $4, subtotal_0 = $5, iva = $6, total = $7,
      details_text = $8, document_state = $9, emission_point = $10,
      sequential = $11, validation_notes = $12, expense_mode = $13, updated_at = NOW()
     WHERE id = $14 AND document_type = 'nota_venta_manual'
     RETURNING *`,
    [issueDate, supplierRuc, supplierName, subtotal12, subtotal0, iva, total, expenseDescription, documentState, emissionPoint, sequential, notes, normalizedExpenseMode, noteId]
  );

  await recalculateAllowanceTotals(allowanceId);
  return syncAllowanceSegments(allowanceId, { actorUserId: actorUser.id || null });
}

async function deleteManualNote({ noteId, actorUser, viaWizard }) {
  assertViaticosAccess(actorUser);

  const { rows } = await db.query(
    `SELECT tai.allowance_id, ta.requester_email
     FROM travel_allowance_invoices tai
     JOIN travel_allowances ta ON ta.id = tai.allowance_id
     WHERE tai.id = $1 AND tai.document_type = $2`,
    [noteId, 'nota_venta_manual']
  );

  if (!rows.length) {
    const err = new Error('Nota no encontrada');
    err.status = 404;
    throw err;
  }

  const { allowance_id: allowanceId, requester_email } = rows[0];
  const allowance = await getAllowanceById(allowanceId);
  assertWizardProcessingFlow({ allowance, actorUser, viaWizard, actionLabel: "eliminar notas manuales" });

  if (!isFinanceUser(actorUser) && String(actorUser?.email || '').toLowerCase() !== String(requester_email || '').toLowerCase()) {
    const err = new Error('No tienes permiso para eliminar esta nota');
    err.status = 403;
    throw err;
  }

  await db.query(
    'DELETE FROM travel_allowance_invoices WHERE id = $1 AND document_type = $2',
    [noteId, 'nota_venta_manual']
  );

  await recalculateAllowanceTotals(allowanceId);
  return { deleted: true, id: noteId };
}

async function createPurchaseNoInvoice({
  allowanceId,
  description,
  total,
  purchaseDate,
  justification,
  driveFileId,
  expenseMode,
  actorUser,
  viaWizard,
}) {
  assertViaticosAccess(actorUser);
  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const err = new Error("Viatico no encontrado");
    err.status = 404;
    throw err;
  }
  assertAllowanceAccess(allowance, actorUser);
  assertWizardProcessingFlow({ allowance, actorUser, viaWizard, actionLabel: "registrar compras sin factura" });

  const normalizedExpenseMode = normalizeExpenseMode(expenseMode);
  if (!normalizedExpenseMode) {
    const err = new Error("Debes indicar si la compra es con tarjeta o sin tarjeta");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO travel_allowance_purchases_no_invoice (
      allowance_id, description, total, purchase_date, justification, file_id, expense_mode, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW())
    RETURNING *`,
    [allowanceId, description, total, purchaseDate, justification, driveFileId, normalizedExpenseMode]
  );

  await recalculateAllowanceTotals(allowanceId);
  return syncAllowanceSegments(allowanceId, { actorUserId: actorUser.id || null });
}

async function listPurchasesNoInvoice({ allowanceId, actorUser }) {
  assertViaticosAccess(actorUser);

  const { rows } = await db.query(
    `SELECT p.*, u1.email as approved_by_finance_email, u2.email as approved_by_talento_email,
            d.drive_link AS document_drive_link, d.file_name AS document_file_name
     FROM travel_allowance_purchases_no_invoice p
     LEFT JOIN public.users u1 ON p.approved_by_finance = u1.id
     LEFT JOIN public.users u2 ON p.approved_by_talento = u2.id
     LEFT JOIN travel_allowance_documents d ON d.id = p.file_id
     WHERE p.allowance_id = $1
     ORDER BY p.purchase_date DESC`,
    [allowanceId]
  );
  return rows;
}

async function approvePurchaseNoInvoice({
  purchaseId,
  status,
  approvedBy,
  actorUser,
}) {
  const roles = collectUserRoles(actorUser);
  const isFinance = Array.from(roles).some(r => FINANCE_ROLES.includes(r));
  const isTalento = Array.from(roles).some(r => ['talento_humano', 'jefe_talento_humano'].includes(r));

  if (!isFinance && !isTalento) {
    const error = new Error("Solo finanzas o talento humano pueden aprobar compras sin factura");
    error.status = 403;
    throw error;
  }

  const updateField = approvedBy === 'finance' ? 'approved_by_finance' : 'approved_by_talento';

  const { rows } = await db.query(
    `UPDATE travel_allowance_purchases_no_invoice
     SET ${updateField} = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [actorUser.id, purchaseId]
  );

  if (rows.length === 0) {
    const error = new Error("Compra no encontrada");
    error.status = 404;
    throw error;
  }

  const purchase = rows[0];
  if (purchase.approved_by_finance && purchase.approved_by_talento) {
    await db.query(
      `UPDATE travel_allowance_purchases_no_invoice SET status = 'approved' WHERE id = $1`,
      [purchaseId]
    );
  }

  await recalculateAllowanceTotals(purchase.allowance_id);
  await syncAllowanceSegments(purchase.allowance_id, { actorUserId: actorUser.id || null });
  return purchase;
}

async function recalculateAllowanceTotals(allowanceId) {
  const { rows: sriTotal } = await db.query(
    `SELECT COALESCE(SUM(total), 0) as total FROM travel_allowance_invoices
     WHERE allowance_id = $1 AND document_type = 'factura_sri' AND status != 'rechazada'`,
    [allowanceId]
  );

  const { rows: manualTotal } = await db.query(
    `SELECT COALESCE(SUM(total), 0) as total FROM travel_allowance_invoices
     WHERE allowance_id = $1 AND document_type = 'nota_venta_manual' AND status != 'rechazada'`,
    [allowanceId]
  );

  const { rows: purchasesTotal } = await db.query(
    `SELECT COALESCE(SUM(total), 0) as total FROM travel_allowance_purchases_no_invoice
     WHERE allowance_id = $1 AND COALESCE(status, '') <> 'rejected'`,
    [allowanceId]
  );

  const modeTotals = await computeAllowanceModeTotals(allowanceId);

  // total_consolidated es GENERATED ALWAYS AS (sri+manual+compras), se
  // calcula solo. Pero "amount" es una columna normal que el frontend usa en
  // todos lados (listados, stats de finanzas/talento) y nadie la escribia --
  // se quedaba en 0 aunque total_consolidated ya reflejara el total real.
  const amount = Number(sriTotal[0].total || 0) + Number(manualTotal[0].total || 0) + Number(purchasesTotal[0].total || 0);

  await db.query(
    `UPDATE travel_allowances SET
      total_sri_invoices = $1,
      total_manual_notes = $2,
      total_purchases_no_invoice = $3,
      total_with_card = $4,
      total_without_card = $5,
      requires_finance_approval = $6,
      requires_talento_approval = $7,
      amount = $8,
      updated_at = NOW()
     WHERE id = $9`,
    [
      sriTotal[0].total,
      manualTotal[0].total,
      purchasesTotal[0].total,
      modeTotals.totalWithCard,
      modeTotals.totalWithoutCard,
      modeTotals.requiresFinanceApproval,
      modeTotals.requiresTalentoApproval,
      amount,
      allowanceId,
    ]
  );

  return syncAllowanceSegments(allowanceId);
}

async function submitAllowanceForReview({ allowanceId, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  const actorEmail = String(actorUser?.email || "").toLowerCase();
  const requesterEmail = String(allowance.requester_email || "").toLowerCase();
  const isOwner = actorEmail && requesterEmail && actorEmail === requesterEmail;
  const isPrivileged = isGlobalViaticosViewer(actorUser) || isOperationalApprover(actorUser);

  if (!isOwner && !isPrivileged) {
    const error = new Error("Solo el solicitante puede enviar este viatico a revision");
    error.status = 403;
    throw error;
  }

  const currentWorkflow = String(allowance.workflow_status || "").toLowerCase();
  const alreadySubmitted = ["pendiente_revision", "aprobado_jefe", "rechazado_jefe",
    "pendiente_aprobacion_talento", "pendiente_aprobacion_financiera", "pendiente_aprobacion_mixta",
    "pendiente_financiero", "aprobado_financiero", "rechazado_financiero",
    "aprobado_talento_humano", "aprobado_mixto",
    "listo_pago", "pagado", "cerrado"].includes(currentWorkflow);

  if (alreadySubmitted) {
    const error = new Error("El viatico ya fue enviado a revision");
    error.status = 400;
    throw error;
  }

  const invoiceValidation = await db.query(
    `
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN category IS NULL OR BTRIM(category) = '' THEN 1 ELSE 0 END), 0)::int AS missing_category,
        COALESCE(SUM(CASE WHEN expense_mode IS NULL OR BTRIM(expense_mode) = '' THEN 1 ELSE 0 END), 0)::int AS missing_expense_mode
      FROM travel_allowance_invoices
      WHERE allowance_id = $1
        AND COALESCE(status, '') <> 'rechazada'
    `,
    [allowanceId]
  );
  const purchaseValidation = await db.query(
    `
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN expense_mode IS NULL OR BTRIM(expense_mode) = '' THEN 1 ELSE 0 END), 0)::int AS missing_expense_mode
      FROM travel_allowance_purchases_no_invoice
      WHERE allowance_id = $1
        AND COALESCE(status, '') <> 'rejected'
    `,
    [allowanceId]
  );
  const invoiceRow = invoiceValidation.rows[0] || { total: 0, missing_category: 0, missing_expense_mode: 0 };
  const purchaseRow = purchaseValidation.rows[0] || { total: 0, missing_expense_mode: 0 };
  const totalItems = Number(invoiceRow.total || 0) + Number(purchaseRow.total || 0);
  if (totalItems <= 0) {
    const error = new Error("Debes registrar al menos un gasto antes de enviar el viatico a revision");
    error.status = 400;
    throw error;
  }
  if (Number(invoiceRow.missing_category || 0) > 0) {
    const error = new Error("Debes clasificar la categoria en todas las facturas y notas manuales antes de enviar el viatico");
    error.status = 400;
    throw error;
  }
  if (Number(invoiceRow.missing_expense_mode || 0) > 0 || Number(purchaseRow.missing_expense_mode || 0) > 0) {
    const error = new Error("Debes indicar si cada gasto es con tarjeta o sin tarjeta antes de enviar el viatico");
    error.status = 400;
    throw error;
  }

  const syncedBeforeSubmit = await syncAllowanceSegments(allowanceId, { actorUserId: actorUser.id || null });
  const modeTotals = await computeAllowanceModeTotals(allowanceId);
  const pendingWorkflowStatus = resolvePendingWorkflowStatus(modeTotals);

  const { rows } = await db.query(
    `UPDATE travel_allowances
     SET workflow_status = $2,
         requires_finance_approval = $3,
         requires_talento_approval = $4,
         finance_approval_status = $5,
         talento_approval_status = $6,
         finance_approved_by_user_id = NULL,
         talento_approved_by_user_id = NULL,
         finance_approved_at = NULL,
         talento_approved_at = NULL,
         status = 'pending',
         updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [
      allowanceId,
      pendingWorkflowStatus,
      modeTotals.requiresFinanceApproval,
      modeTotals.requiresTalentoApproval,
      modeTotals.requiresFinanceApproval ? "pending" : "not_required",
      modeTotals.requiresTalentoApproval ? "pending" : "not_required",
    ]
  );

  if (!rows.length) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  const segmentUpdates = [];
  for (const segment of syncedBeforeSubmit?.segments || []) {
    if (!segment.visible_in_active_queue || Number(segment.calculated_total || 0) <= 0) continue;
    const fromStatus = String(segment.workflow_status || "").toLowerCase();
    if (fromStatus !== "borrador" && fromStatus !== "rechazado") continue;
    const { rows: updatedSegments } = await db.query(
      `
        UPDATE travel_allowance_segments
        SET workflow_status = 'enviado',
            submitted_at = NOW(),
            submitted_by_user_id = $2,
            visible_in_active_queue = TRUE,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [segment.id, actorUser.id || null]
    );
    if (updatedSegments[0]) {
      segmentUpdates.push(updatedSegments[0]);
      await appendSegmentEvent({
        allowanceId,
        segmentId: segment.id,
        eventType: "submitted",
        fromStatus,
        toStatus: "enviado",
        actorUserId: actorUser.id || null,
      });
    }
  }

  return syncAllowanceSegments(rows[0].id, { actorUserId: actorUser.id || null });
}

async function approveAllowanceSegment({ allowanceId, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  const isFinance = isFinanceApprover(actorUser);
  const isTalento = isTalentoApprover(actorUser);
  if (!isFinance && !isTalento) {
    const error = new Error("Solo talento humano o financiero pueden aprobar este viatico");
    error.status = 403;
    throw error;
  }

  const syncedAllowance = await syncAllowanceSegments(allowanceId, { actorUserId: actorUser.id || null });
  const modeTotals = await computeAllowanceModeTotals(allowanceId);
  let fields;
  let targetSegmentType;
  if (isTalento) {
    if (!modeTotals.requiresTalentoApproval) {
      const error = new Error("Este viatico no requiere aprobacion de talento humano");
      error.status = 400;
      throw error;
    }
    fields = {
      statusField: "talento_approval_status",
      byField: "talento_approved_by_user_id",
      atField: "talento_approved_at",
    };
    targetSegmentType = "without_card";
  } else {
    if (!modeTotals.requiresFinanceApproval) {
      const error = new Error("Este viatico no requiere aprobacion financiera");
      error.status = 400;
      throw error;
    }
    fields = {
      statusField: "finance_approval_status",
      byField: "finance_approved_by_user_id",
      atField: "finance_approved_at",
    };
    targetSegmentType = "with_card";
  }

  const targetSegment = (syncedAllowance?.segments || []).find((segment) => segment.segment_type === targetSegmentType);
  if (targetSegment) {
    const fromStatus = String(targetSegment.workflow_status || "").toLowerCase();
    const toStatus = fromStatus === "liquidado" ? "liquidado" : "aprobado";
    await db.query(
      `
        UPDATE travel_allowance_segments
        SET workflow_status = $2,
            review_started_at = COALESCE(review_started_at, NOW()),
            reviewed_by_user_id = $3,
            approved_at = NOW(),
            approved_by_user_id = $3,
            approved_total = calculated_total,
            economic_result_type = CASE
              WHEN segment_type = 'with_card' THEN 'valor_a_pagar'
              WHEN calculated_total > 0 AND COALESCE(economic_result_type, '') = '' THEN 'valor_a_pagar'
              ELSE economic_result_type
            END,
            economic_result_amount = CASE
              WHEN segment_type = 'with_card' THEN calculated_total
              WHEN COALESCE(economic_result_type, 'valor_a_pagar') = 'saldo_cero' THEN 0
              ELSE calculated_total
            END,
            visible_in_active_queue = TRUE,
            updated_at = NOW()
        WHERE id = $1
      `,
      [targetSegment.id, toStatus, actorUser.id || null]
    );
    await appendSegmentEvent({
      allowanceId,
      segmentId: targetSegment.id,
      eventType: "approved",
      fromStatus,
      toStatus,
      actorUserId: actorUser.id || null,
      metadata: { segment_type: targetSegmentType },
    });
  }

  const { rows: updatedRows } = await db.query(
    `
      UPDATE travel_allowances
      SET ${fields.statusField} = 'approved',
          ${fields.byField} = $2,
          ${fields.atField} = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [allowanceId, actorUser.id || null]
  );
  const updated = updatedRows[0];
  if (!updated) {
    const error = new Error("Viatico no encontrado");
    error.status = 404;
    throw error;
  }

  const financeApproved = updated.finance_approval_status === "approved" || !modeTotals.requiresFinanceApproval;
  const talentoApproved = updated.talento_approval_status === "approved" || !modeTotals.requiresTalentoApproval;

  if (financeApproved && talentoApproved) {
    const finalWorkflowStatus = resolveApprovedWorkflowStatus(modeTotals);
    const { rows: finalRows } = await db.query(
      `
        UPDATE travel_allowances
        SET status = 'approved',
            workflow_status = $2,
            reviewed_by_user_id = $3,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [allowanceId, finalWorkflowStatus, actorUser.id || null]
    );
    if (targetSegment && targetSegmentType === "with_card") {
      await db.query(
        `
          UPDATE travel_allowance_segments
          SET workflow_status = 'liquidado',
              liquidated_at = NOW(),
              liquidated_by_user_id = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [targetSegment.id, actorUser.id || null]
      );
      await appendSegmentEvent({
        allowanceId,
        segmentId: targetSegment.id,
        eventType: "liquidated",
        fromStatus: "aprobado",
        toStatus: "liquidado",
        actorUserId: actorUser.id || null,
      });
    }
    return syncAllowanceSegments(finalRows[0].id, { actorUserId: actorUser.id || null });
  }

  return syncAllowanceSegments(updated.id, { actorUserId: actorUser.id || null });
}

async function getPolicyPublic() {
  const policy = await getPolicy();
  return {
    km_excess_rate: Number(policy.km_excess_rate || 0),
    km_rate_per_km: Number(policy.km_rate_per_km || 0.12),
    include_associated_expenses_on_excess: Boolean(policy.include_associated_expenses_on_excess),
    strict_company_buyer_match: Boolean(policy.strict_company_buyer_match),
    invoice_date_margin_days: Number(policy.invoice_date_margin_days || 3),
  };
}

async function requestAnticipo({ allowanceId, amount, purpose, notes, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) {
    const err = new Error("Viatico no encontrado"); err.status = 404; throw err;
  }
  assertAllowanceAccess(allowance, actorUser);

  const parsedAmount = Number(amount || 0);
  if (parsedAmount <= 0) {
    const err = new Error("El monto del anticipo debe ser mayor a 0"); err.status = 400; throw err;
  }

  const existing = await db.query(
    `SELECT id FROM viatico_anticipos WHERE allowance_id = $1 AND status NOT IN ('rejected') LIMIT 1`,
    [allowanceId]
  );
  if (existing.rows.length > 0) {
    const err = new Error("Ya existe un anticipo activo para este viatico"); err.status = 409; throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO viatico_anticipos
       (allowance_id, requested_by_user_id, amount, purpose, notes, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'pending_approval', NOW(), NOW())
     RETURNING *`,
    [allowanceId, actorUser.id, parsedAmount, purpose || null, notes || null]
  );
  await appendSegmentEvent({
    allowanceId,
    eventType: "anticipo_requested",
    actorUserId: actorUser.id || null,
    metadata: { amount: parsedAmount },
  });
  return syncAllowanceSegments(allowanceId, { actorUserId: actorUser.id || null });
}

async function listAnticipos({ allowanceId, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const { rows } = await db.query(
    `SELECT a.*,
       ru.fullname AS requested_by_name,
       au.fullname AS approved_by_name
     FROM viatico_anticipos a
     LEFT JOIN users ru ON ru.id = a.requested_by_user_id
     LEFT JOIN users au ON au.id = a.approved_by_user_id
     WHERE a.allowance_id = $1
     ORDER BY a.created_at DESC`,
    [allowanceId]
  );
  return rows;
}

async function updateAnticipo({ anticipoId, patch, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const { rows: existing } = await db.query(
    `SELECT a.*, ta.requester_user_id FROM viatico_anticipos a
     JOIN travel_allowances ta ON ta.id = a.allowance_id
     WHERE a.id = $1 LIMIT 1`,
    [anticipoId]
  );
  if (!existing.length) {
    const err = new Error("Anticipo no encontrado"); err.status = 404; throw err;
  }
  const anticipo = existing[0];

  const sets = ["updated_at = NOW()"];
  const values = [anticipoId];

  const allowedStatuses = new Set(["pending_approval", "approved", "disbursed", "applied", "rejected"]);
  if (patch.status && allowedStatuses.has(patch.status)) {
    values.push(patch.status);
    sets.push(`status = $${values.length}`);

    if (patch.status === "approved") {
      if (!isFinanceUser(actorUser) && !isOperationalApprover(actorUser)) {
        const err = new Error("No tienes permiso para aprobar anticipos"); err.status = 403; throw err;
      }
      values.push(actorUser.id);
      sets.push(`approved_by_user_id = $${values.length}`);
      sets.push("approved_at = NOW()");
    }
    if (patch.status === "disbursed") {
      if (patch.payment_reference) {
        values.push(patch.payment_reference);
        sets.push(`payment_reference = $${values.length}`);
      }
      sets.push("disbursed_at = NOW()");
    }
    if (patch.status === "applied") {
      const appliedAmount = Number(patch.applied_amount || 0);
      values.push(appliedAmount);
      sets.push(`applied_amount = $${values.length}`);
      const diff = Number(anticipo.amount || 0) - appliedAmount;
      values.push(diff);
      sets.push(`difference_amount = $${values.length}`);
      sets.push("applied_at = NOW()");
    }
    if (patch.status === "rejected") {
      if (!isFinanceUser(actorUser) && !isOperationalApprover(actorUser)) {
        const err = new Error("No tienes permiso para rechazar anticipos"); err.status = 403; throw err;
      }
      values.push(patch.rejected_reason || null);
      sets.push(`rejected_reason = $${values.length}`);
    }
  }

  if (patch.notes !== undefined) {
    values.push(patch.notes || null);
    sets.push(`notes = $${values.length}`);
  }

  const { rows } = await db.query(
    `UPDATE viatico_anticipos SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  if (rows[0] && patch.status) {
    await appendSegmentEvent({
      allowanceId: anticipo.allowance_id,
      eventType: "anticipo_status_changed",
      actorUserId: actorUser.id || null,
      observation: patch.rejected_reason || null,
      metadata: {
        anticipo_id: anticipoId,
        from_status: anticipo.status,
        to_status: rows[0].status,
        payment_reference: rows[0].payment_reference || null,
      },
    });
  }
  return syncAllowanceSegments(anticipo.allowance_id, { actorUserId: actorUser.id || null });
}

async function batchUploadReceipt({ allowanceIds, fileBase64, fileName, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  if (!isTalentoApprover(actorUser) && !isGlobalViaticosViewer(actorUser)) {
    const err = new Error("Solo talento_humano puede subir comprobantes de pago"); err.status = 403; throw err;
  }

  const ids = (Array.isArray(allowanceIds) ? allowanceIds : []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) { const err = new Error("Debes enviar al menos un ID"); err.status = 400; throw err; }
  if (!fileBase64) { const err = new Error("Debes enviar el archivo en base64"); err.status = 400; throw err; }

  const { rows: found } = await db.query(
    `SELECT id, status, workflow_status, requester_email FROM travel_allowances WHERE id = ANY($1::int[])`,
    [ids]
  );

  if (found.length !== ids.length) {
    const err = new Error("Algunos viaticos no fueron encontrados"); err.status = 404; throw err;
  }

  const notPaid = found.filter((r) => r.status !== "paid");
  if (notPaid.length) {
    const err = new Error(`${notPaid.length} salida(s) aun no estan en estado pagado`); err.status = 400; throw err;
  }

  const alreadyClosed = found.filter((r) => r.workflow_status === "cerrado");
  if (alreadyClosed.length === found.length) {
    const err = new Error("El expediente ya fue cerrado con comprobante"); err.status = 409; throw err;
  }

  const parsed = parseBase64Input(fileBase64);
  const targetMime = parsed.mimeType || "application/pdf";
  const safeFileName = String(fileName || "comprobante_pago.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
  const estimatedBytes = Math.ceil((parsed.base64.length * 3) / 4);
  if (estimatedBytes > 15 * 1024 * 1024) {
    const err = new Error("El archivo excede 15 MB"); err.status = 400; throw err;
  }

  const targetFolderId = process.env.VIATICOS_RECEIPTS_FOLDER_ID || process.env.VIATICOS_DRIVE_FOLDER_ID || null;
  const uploaded = await uploadBase64File(safeFileName, parsed.base64, targetMime, targetFolderId);
  const driveFileId = uploaded?.id || null;
  const driveUrl = uploaded?.webViewLink || uploaded?.webContentLink
    || (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null);

  if (!driveUrl) {
    const err = new Error("No se pudo subir el comprobante a Drive"); err.status = 500; throw err;
  }

  const uploaderId = actorUser?.id || actorUser?.user_id || null;

  await db.query(
    `UPDATE travel_allowances
        SET payment_receipt_drive_url      = $1,
            payment_receipt_drive_id       = $2,
            payment_receipt_uploaded_at    = NOW(),
            payment_receipt_uploaded_by    = $3,
            workflow_status                = 'cerrado',
            updated_at                     = NOW()
      WHERE id = ANY($4::int[])`,
    [driveUrl, driveFileId, uploaderId, ids]
  );

  for (const allowance of found) {
    const { rows: segments } = await db.query(
      `
        SELECT id, workflow_status
        FROM travel_allowance_segments
        WHERE allowance_id = $1
          AND segment_type = 'without_card'
        LIMIT 1
      `,
      [allowance.id]
    );
    const segment = segments[0];
    if (segment) {
      await db.query(
        `
          UPDATE travel_allowance_segments
          SET workflow_status = 'liquidado',
              liquidated_at = NOW(),
              liquidated_by_user_id = $2,
              liquidation_document_drive_id = $3,
              liquidation_document_drive_url = $4,
              visible_in_active_queue = FALSE,
              updated_at = NOW()
          WHERE id = $1
        `,
        [segment.id, uploaderId, driveFileId, driveUrl]
      );
      await appendSegmentEvent({
        allowanceId: allowance.id,
        segmentId: segment.id,
        eventType: "liquidated",
        fromStatus: segment.workflow_status,
        toStatus: "liquidado",
        actorUserId: uploaderId,
        metadata: { receipt_drive_id: driveFileId, receipt_drive_url: driveUrl },
      });
      await createSegmentLiquidationDocument({
        allowanceId: allowance.id,
        segmentId: segment.id,
        segmentType: "without_card",
        actorUser,
        fallbackDriveId: driveFileId,
        fallbackDriveUrl: driveUrl,
      });
    }
    await syncAllowanceSegments(allowance.id, { actorUserId: uploaderId });
  }

  // Notify each unique declarant
  const uniqueEmails = [...new Set(found.map((r) => r.requester_email).filter(Boolean))];
  for (const email of uniqueEmails) {
    try {
      const { rows: [recipient] } = await db.query(`SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
      if (recipient?.id) {
        await NotificationManager.sendNotification({
          userId: recipient.id,
          template: "custom_html",
          customTitle: "Viatico cerrado — comprobante disponible",
          customMessage: [
            `El pago de ${ids.length} salida${ids.length !== 1 ? "s" : ""} ha sido registrado y el expediente ha sido cerrado.`,
            "El comprobante de pago esta disponible en tu expediente.",
          ].join("\n"),
          type: "success",
          priority: 1,
          source: "viaticos",
          meta: { allowance_ids: ids, drive_url: driveUrl, email_to: recipient.email, target_path: "/dashboard/finanzas/viaticos" },
          data: { email_to: recipient.email, email_subject: "Viatico cerrado — comprobante disponible" },
          email: true,
          chat: false,
        });
      }
    } catch { /* non-fatal */ }
  }

  return {
    cerrado: ids.length,
    drive_url: driveUrl,
    allowances: await Promise.all(ids.map((id) => syncAllowanceSegments(id, { actorUserId: uploaderId }))),
  };
}

function buildMoneyValue(value) {
  return `USD ${Number(value || 0).toFixed(2)}`;
}

function fmtDate(value) {
  // pg devuelve columnas DATE como objetos Date de JS -- String(dateObj) da
  // "Mon Jul 06 2026 ..." (formato local, no ISO), asi que slice(0,10) corta
  // basura ("Mon Jul 06") en vez de la fecha. toISOString() si es Date.
  if (!value) return "-";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function streamPdfToBuffer(pdf) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.end();
  });
}

async function buildSegmentLiquidationPdfBuffer({ allowance, segment, requesterName = null }) {
  const pdf = new PDFDocument({ margin: 48, size: "A4" });
  const segmentLabel = segment?.segment_type === "with_card" ? "Con tarjeta" : "Sin tarjeta";
  const resultType = String(segment?.economic_result_type || "").toLowerCase();
  const resultLabel = resultType === "valor_a_devolver"
    ? "Valor a devolver por el colaborador"
    : resultType === "saldo_cero"
      ? "Saldo en cero"
      : segment?.segment_type === "with_card"
        ? "Valor conciliado para tarjeta corporativa"
        : "Valor adicional a pagar al colaborador";
  const collaboratorName = requesterName || allowance?.requester_name || allowance?.requester_email || "Colaborador";
  const calculatedTotal = Number(segment?.calculated_total || 0);
  const approvedTotal = Number(segment?.approved_total ?? calculatedTotal);
  const economicAmount = Number(segment?.economic_result_amount ?? approvedTotal);
  const lines = [
    ["Expediente", `#${allowance?.id || ""}`],
    ["Subexpediente", segmentLabel],
    ["Colaborador", collaboratorName],
    ["Correo", allowance?.requester_email || "No registrado"],
    ["Fecha salida", allowance?.visit_date ? String(allowance.visit_date).slice(0, 10) : "No registrada"],
    ["Destino", allowance?.city || "No registrado"],
    ["Referencia", allowance?.reference_name || allowance?.notes || "Salida operacional"],
    ["Total calculado", buildMoneyValue(calculatedTotal)],
    ["Total aprobado", buildMoneyValue(approvedTotal)],
    ["Resultado", resultLabel],
    ["Valor resultado", buildMoneyValue(economicAmount)],
    ["Liquido en", new Date().toISOString().slice(0, 10)],
  ];

  pdf.fontSize(18).font("Helvetica-Bold").text("Liquidacion de viaticos", { align: "left" });
  pdf.moveDown(0.3);
  pdf.fontSize(10).font("Helvetica").fillColor("#475569")
    .text("Documento generado automaticamente por el sistema FamSPI.");
  pdf.moveDown(1);

  lines.forEach(([label, value]) => {
    pdf.font("Helvetica-Bold").fillColor("#0F172A").text(`${label}: `, { continued: true });
    pdf.font("Helvetica").fillColor("#334155").text(String(value || "-"));
    pdf.moveDown(0.2);
  });

  pdf.moveDown(0.8);
  pdf.font("Helvetica-Bold").fillColor("#0F172A").text("Trazabilidad");
  pdf.moveDown(0.2);
  pdf.font("Helvetica").fillColor("#334155").text(
    segment?.segment_type === "with_card"
      ? "Este subexpediente corresponde a gastos clasificados con tarjeta corporativa."
      : "Este subexpediente corresponde a gastos sin tarjeta y requiere soporte de devolucion al colaborador."
  );

  return streamPdfToBuffer(pdf);
}

// ── PDF de expediente consolidado (mes) ──────────────────────────────────
// Reune todo lo que financiero/talento revisan a mano en el modal de mes:
// resumen por salida, facturas SRI, notas de venta manual y compras sin
// factura, con enlace al documento subido cuando existe.

function pdfEnsureSpace(pdf, neededHeight) {
  const bottom = pdf.page.height - pdf.page.margins.bottom;
  if (pdf.y + neededHeight > bottom) pdf.addPage();
}

function pdfResetX(pdf) {
  pdf.x = pdf.page.margins.left;
}

function pdfSectionTitle(pdf, text) {
  pdfEnsureSpace(pdf, 40);
  pdfResetX(pdf);
  pdf.moveDown(0.6);
  pdf.fontSize(13).font("Helvetica-Bold").fillColor("#0F172A").text(text);
  pdf.moveDown(0.3);
}

function pdfTable(pdf, { columns, rows, emptyLabel }) {
  pdfResetX(pdf);
  const startX = pdf.page.margins.left;
  const rowHeight = 18;
  const availableWidth = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
  const rawWidth = columns.reduce((s, c) => s + c.width, 0);
  // Escala todas las columnas para que la tabla nunca se desborde de la
  // pagina (antes las sumas de ancho superaban el area imprimible y el
  // texto se cortaba fuera de la hoja).
  const scale = rawWidth > availableWidth ? availableWidth / rawWidth : 1;
  const cols = columns.map((c) => ({ ...c, width: Math.floor(c.width * scale) }));
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  const cellOptions = (col) => ({
    width: col.width - 6,
    height: rowHeight - 4,
    align: col.align || "left",
    ellipsis: true,
    lineBreak: false,
  });

  const drawHeader = () => {
    pdfEnsureSpace(pdf, rowHeight * 2);
    let x = startX;
    const headerY = pdf.y;
    pdf.rect(startX, headerY, tableWidth, rowHeight).fill("#1E293B");
    pdf.fontSize(8).font("Helvetica-Bold");
    cols.forEach((col) => {
      pdf.fillColor("#FFFFFF").text(col.label, x + 3, headerY + 5, cellOptions(col));
      x += col.width;
    });
    pdf.y = headerY + rowHeight;
  };

  if (!rows.length) {
    pdfEnsureSpace(pdf, rowHeight);
    pdfResetX(pdf);
    pdf.fontSize(9).font("Helvetica-Oblique").fillColor("#94A3B8").text(emptyLabel);
    pdf.moveDown(0.4);
    return;
  }

  drawHeader();
  rows.forEach((row, idx) => {
    pdfEnsureSpace(pdf, rowHeight);
    if (pdf.y === pdf.page.margins.top) drawHeader();
    let x = startX;
    const rowY = pdf.y;
    if (idx % 2 === 1) {
      pdf.rect(startX, rowY, tableWidth, rowHeight).fill("#F8FAFC");
    }
    pdf.fontSize(8).font("Helvetica");
    cols.forEach((col) => {
      const value = String(row[col.key] ?? "-");
      pdf.fillColor("#334155").text(value, x + 3, rowY + 5, cellOptions(col));
      if (col.linkKey && row[col.linkKey]) {
        pdf.link(x + 3, rowY + 3, col.width - 6, rowHeight - 4, row[col.linkKey]);
      }
      x += col.width;
    });
    pdf.y = rowY + rowHeight;
  });
  pdfResetX(pdf);
  pdf.moveDown(0.4);
}

function inferMimeTypeFromFileName(fileName) {
  const raw = String(fileName || "").trim().toLowerCase();
  const parts = raw.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return null;
}

function inferMimeTypeFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return null;
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") {
    return "image/webp";
  }
  if (buffer.length >= 6) {
    const sig = buffer.subarray(0, 6).toString();
    if (sig === "GIF87a" || sig === "GIF89a") return "image/gif";
  }
  return null;
}

function resolveUploadMimeType({ explicitMimeType, parsedMimeType, fileName, buffer }) {
  return (
    explicitMimeType ||
    parsedMimeType ||
    inferMimeTypeFromBuffer(buffer) ||
    inferMimeTypeFromFileName(fileName) ||
    "application/pdf"
  );
}

function resolveAttachmentPreviewType(buffer, fallbackMimeType = null) {
  const detected = inferMimeTypeFromBuffer(buffer);
  return detected || (fallbackMimeType ? String(fallbackMimeType).toLowerCase() : null);
}

async function mergePdfBuffers(baseBuffer, attachmentBuffers = []) {
  const validAttachments = attachmentBuffers.filter((buffer) => Buffer.isBuffer(buffer) && buffer.length);
  if (!Buffer.isBuffer(baseBuffer) || !baseBuffer.length || !validAttachments.length) {
    return baseBuffer;
  }

  const merged = await LibPdfDocument.load(baseBuffer);
  for (const attachmentBuffer of validAttachments) {
    try {
      const attachmentDoc = await LibPdfDocument.load(attachmentBuffer);
      const pages = await merged.copyPages(attachmentDoc, attachmentDoc.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    } catch (error) {
      logger.warn({ error }, "No se pudo anexar un comprobante PDF al expediente de viaticos");
    }
  }
  const mergedBytes = await merged.save();
  return Buffer.from(mergedBytes);
}

async function buildMonthExpedientePdfBuffer({ allowances, invoices, notes, purchases, collaboratorName, monthLabel }) {
  const pdf = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  const pdfAttachmentsToMerge = [];

  const batchDeclared = allowances.reduce((s, a) => s + Number(a.amount || 0), 0);

  pdf.fontSize(18).font("Helvetica-Bold").fillColor("#0F172A").text("Expediente de viaticos");
  pdf.moveDown(0.2);
  pdf.fontSize(11).font("Helvetica").fillColor("#475569")
    .text(`${collaboratorName || "Colaborador"} · ${monthLabel || ""} · ${allowances.length} salida(s) · Total declarado ${buildMoneyValue(batchDeclared)}`);
  pdf.moveDown(0.2);
  pdf.fontSize(8).fillColor("#94A3B8").text(`Generado ${new Date().toISOString().slice(0, 10)} — Sistema FamSPI`);

  pdfSectionTitle(pdf, "Salidas operacionales");
  pdfTable(pdf, {
    columns: [
      { key: "id", label: "#", width: 40 },
      { key: "visit_date", label: "Fecha", width: 70 },
      { key: "city", label: "Destino", width: 150 },
      { key: "workflow_status", label: "Estado", width: 130 },
      { key: "amount", label: "Total", width: 90, align: "right" },
    ],
    rows: allowances.map((a) => ({
      id: a.id,
      visit_date: fmtDate(a.visit_date),
      city: a.city || "-",
      workflow_status: a.workflow_status || "-",
      amount: buildMoneyValue(a.amount),
    })),
    emptyLabel: "Sin salidas",
  });

  const allowanceLabel = (id) => {
    const a = allowances.find((x) => x.id === id);
    return a ? `${fmtDate(a.visit_date)} ${a.city || ""}`.trim() : `#${id}`;
  };

  pdfSectionTitle(pdf, `Facturas SRI (${invoices.length})`);
  pdfTable(pdf, {
    columns: [
      { key: "salida", label: "Salida", width: 130 },
      { key: "supplier_name", label: "Emisor", width: 170 },
      { key: "supplier_ruc", label: "RUC", width: 90 },
      { key: "comprobante", label: "Comprobante", width: 110 },
      { key: "issue_date", label: "Fecha", width: 65 },
      { key: "category", label: "Categoria", width: 90 },
      { key: "expense_mode", label: "Modo", width: 75 },
      { key: "total", label: "Total", width: 75, align: "right" },
      { key: "doc", label: "Doc.", width: 45, linkKey: "docLink" },
    ],
    rows: invoices.map((inv) => ({
      salida: allowanceLabel(inv.allowance_id),
      supplier_name: inv.supplier_name || "-",
      supplier_ruc: inv.supplier_ruc || "-",
      comprobante: [inv.establishment, inv.emission_point, inv.sequential].filter(Boolean).join("-") || "-",
      issue_date: fmtDate(inv.issue_date),
      category: inv.category || "Sin clasificar",
      expense_mode: inv.expense_mode === "with_card" ? "Con tarjeta" : "Sin tarjeta",
      total: buildMoneyValue(inv.total),
      doc: inv.document_drive_link ? "Ver" : "-",
      docLink: inv.document_drive_link || null,
    })),
    emptyLabel: "Sin facturas SRI cargadas",
  });

  pdfSectionTitle(pdf, `Notas de venta manual (${notes.length})`);
  pdfTable(pdf, {
    columns: [
      { key: "salida", label: "Salida", width: 130 },
      { key: "supplier_name", label: "Emisor", width: 200 },
      { key: "supplier_ruc", label: "RUC", width: 110 },
      { key: "issue_date", label: "Fecha", width: 70 },
      { key: "expense_mode", label: "Modo", width: 85 },
      { key: "total", label: "Total", width: 85, align: "right" },
      { key: "doc", label: "Doc.", width: 45, linkKey: "docLink" },
    ],
    rows: notes.map((n) => ({
      salida: allowanceLabel(n.allowance_id),
      supplier_name: n.supplier_name || n.details_text || "-",
      supplier_ruc: n.supplier_ruc || "-",
      issue_date: fmtDate(n.issue_date),
      expense_mode: n.expense_mode === "with_card" ? "Con tarjeta" : "Sin tarjeta",
      total: buildMoneyValue(n.total),
      doc: n.drive_link ? "Ver" : "-",
      docLink: n.drive_link || null,
    })),
    emptyLabel: "Sin notas de venta manual",
  });

  pdfSectionTitle(pdf, `Compras sin factura (${purchases.length})`);
  pdfTable(pdf, {
    columns: [
      { key: "salida", label: "Salida", width: 130 },
      { key: "description", label: "Descripcion", width: 230 },
      { key: "purchase_date", label: "Fecha", width: 70 },
      { key: "expense_mode", label: "Modo", width: 85 },
      { key: "total", label: "Total", width: 85, align: "right" },
      { key: "doc", label: "Justificante", width: 75, linkKey: "docLink" },
    ],
    rows: purchases.map((p) => ({
      salida: allowanceLabel(p.allowance_id),
      description: p.description || "-",
      purchase_date: fmtDate(p.purchase_date),
      expense_mode: p.expense_mode === "with_card" ? "Con tarjeta" : "Sin tarjeta",
      total: buildMoneyValue(p.total),
      doc: p.document_drive_link ? "Ver" : "Sin justificante",
      docLink: p.document_drive_link || null,
    })),
    emptyLabel: "Sin compras sin factura",
  });

  // ── Documentos adjuntos ──────────────────────────────────────────────────
  // Cada factura/nota/compra puede tener una foto o PDF de respaldo subido a
  // Drive; se descarga y se embebe una pagina por archivo (si es una imagen)
  // en vez de solo dejar el enlace, que era lo que se pedia.
  const attachments = [
    ...invoices.map((inv) => ({
      label: `Factura · ${allowanceLabel(inv.allowance_id)} · ${inv.supplier_name || "-"}`,
      driveFileId: inv.document_drive_file_id,
      mimeType: inv.mime_type || inv.document_mime_type || null,
      driveLink: inv.document_drive_link || null,
    })),
    ...notes.map((n) => ({
      label: `Nota de venta · ${allowanceLabel(n.allowance_id)} · ${n.supplier_name || n.details_text || "-"}`,
      driveFileId: n.document_drive_file_id || n.drive_file_id,
      mimeType: n.document_mime_type || null,
      driveLink: n.document_drive_link || n.drive_link || null,
    })),
    ...purchases.map((p) => ({
      label: `Compra sin factura · ${allowanceLabel(p.allowance_id)} · ${p.description || "-"}`,
      driveFileId: p.document_drive_file_id,
      mimeType: p.mime_type || null,
      driveLink: p.document_drive_link || null,
    })),
  ].filter((a) => a.driveFileId);

  if (attachments.length) {
    pdf.addPage();
    pdfResetX(pdf);
    pdf.fontSize(13).font("Helvetica-Bold").fillColor("#0F172A").text(`Documentos adjuntos (${attachments.length})`);
    pdf.moveDown(0.5);

    const maxW = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
    const maxH = pdf.page.height - pdf.page.margins.top - pdf.page.margins.bottom - 40;

    for (const att of attachments) {
      try {
        const buffer = await downloadFileBuffer(att.driveFileId);
        if (pdf.y > pdf.page.margins.top) pdf.addPage();
        pdfResetX(pdf);
        pdf.fontSize(9).font("Helvetica-Bold").fillColor("#0F172A").text(att.label);
        if (att.driveLink) {
          pdf.moveDown(0.2);
          pdf.fillColor("#2563EB").text(att.driveLink, { link: att.driveLink, underline: true });
        }
        pdf.moveDown(0.3);
        const previewType = resolveAttachmentPreviewType(buffer, att.mimeType);
        if (previewType === "image/png" || previewType === "image/jpeg") {
          pdf.image(buffer, pdf.page.margins.left, pdf.y, { fit: [maxW, maxH], align: "left" });
        } else if (previewType === "application/pdf") {
          pdfAttachmentsToMerge.push(buffer);
          pdf.fontSize(9).font("Helvetica").fillColor("#475569")
            .text("Adjunto en PDF. Se anexara al final del expediente como paginas adicionales.");
          if (att.driveLink) {
            pdf.moveDown(0.2);
            pdf.fillColor("#2563EB").text(att.driveLink, { link: att.driveLink, underline: true });
          }
        } else {
          throw new Error(`formato no soportado (${previewType || "desconocido"})`);
        }
      } catch (err) {
        // No es una imagen embebible (PDF, formato no soportado) o fallo la
        // descarga de Drive -- se deja constancia en vez de romper todo el
        // reporte por un solo adjunto.
        pdfEnsureSpace(pdf, 20);
        pdfResetX(pdf);
        pdf.fontSize(9).font("Helvetica").fillColor("#94A3B8")
          .text(`${att.label} — no se pudo previsualizar (${err?.message || "archivo no soportado"})`);
        pdf.moveDown(0.3);
      }
    }
  }

  const baseBuffer = await streamPdfToBuffer(pdf);
  return mergePdfBuffers(baseBuffer, pdfAttachmentsToMerge);
}

async function exportExpedienteMonthPdf({ allowanceIds, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const ids = (Array.isArray(allowanceIds) ? allowanceIds : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) {
    const err = new Error("Debes enviar al menos un ID de viatico"); err.status = 400; throw err;
  }

  const { rows: allowances } = await db.query(
    `SELECT ta.*, ru.fullname AS requester_name
       FROM travel_allowances ta
       LEFT JOIN users ru ON ru.id = ta.requester_user_id
      WHERE ta.id = ANY($1::bigint[])
      ORDER BY ta.visit_date ASC`,
    [ids]
  );
  if (!allowances.length) {
    const err = new Error("No se encontraron viaticos"); err.status = 404; throw err;
  }
  allowances.forEach((a) => assertAllowanceAccess(a, actorUser));

  const foundIds = allowances.map((a) => a.id);
  const [{ rows: invoices }, { rows: notes }, { rows: purchases }] = await Promise.all([
    db.query(
      `SELECT i.*, d.drive_link AS document_drive_link, d.drive_file_id AS document_drive_file_id
         FROM travel_allowance_invoices i
         LEFT JOIN travel_allowance_documents d ON d.id = i.document_id
        WHERE i.allowance_id = ANY($1::bigint[]) AND i.document_type = 'factura_sri'
        ORDER BY i.allowance_id, i.issue_date ASC`,
      [foundIds]
    ),
    db.query(
      `SELECT i.*, d.mime_type AS document_mime_type, d.file_name AS document_file_name,
              d.drive_file_id AS document_drive_file_id, d.drive_link AS document_drive_link
         FROM travel_allowance_invoices i
         LEFT JOIN travel_allowance_documents d ON d.id = i.document_id
        WHERE i.allowance_id = ANY($1::bigint[]) AND i.document_type = 'nota_venta_manual'
        ORDER BY i.allowance_id, i.issue_date ASC`,
      [foundIds]
    ),
    db.query(
      `SELECT p.*, d.drive_link AS document_drive_link, d.drive_file_id AS document_drive_file_id
         FROM travel_allowance_purchases_no_invoice p
         LEFT JOIN travel_allowance_documents d ON d.id = p.file_id
        WHERE p.allowance_id = ANY($1::bigint[])
        ORDER BY p.allowance_id, p.purchase_date ASC`,
      [foundIds]
    ),
  ]);

  const collaboratorName = allowances[0]?.requester_name || allowances[0]?.requester_email || "Colaborador";
  const monthLabel = fmtDate(allowances[0]?.visit_date).slice(0, 7);

  const buffer = await buildMonthExpedientePdfBuffer({
    allowances, invoices, notes, purchases, collaboratorName, monthLabel,
  });
  return { buffer, fileName: `expediente-viaticos-${collaboratorName.replace(/\s+/g, "_")}-${monthLabel}.pdf` };
}

async function createSegmentLiquidationDocument({
  allowanceId,
  segmentId,
  segmentType,
  actorUser,
  fallbackDriveId = null,
  fallbackDriveUrl = null,
}) {
  await ensureSchema();

  const { rows } = await db.query(
    `
      SELECT
        ta.*,
        COALESCE(ru.fullname, ta.requester_email) AS requester_name,
        COALESCE(NULLIF(BTRIM(ae.operational_destination_label), ''), NULLIF(BTRIM(ae.description), ''), ta.notes, 'Salida operacional') AS reference_name,
        seg.id AS segment_id,
        seg.segment_type,
        seg.workflow_status,
        seg.calculated_total,
        seg.approved_total,
        seg.economic_result_type,
        seg.economic_result_amount,
        seg.liquidation_document_drive_id,
        seg.liquidation_document_drive_url
      FROM travel_allowances ta
      LEFT JOIN users ru ON ru.id = ta.requester_user_id
      LEFT JOIN attendance_exceptions ae
        ON ta.source_type = 'operational_exit'
       AND ae.id = ta.source_id
      JOIN travel_allowance_segments seg
        ON seg.allowance_id = ta.id
       AND seg.id = $2
      WHERE ta.id = $1
      LIMIT 1
    `,
    [allowanceId, segmentId]
  );

  const row = rows[0];
  if (!row) return null;

  if (row.liquidation_document_drive_id && row.liquidation_document_drive_url) {
    return {
      drive_id: row.liquidation_document_drive_id,
      drive_url: row.liquidation_document_drive_url,
      reused: true,
    };
  }

  let driveId = fallbackDriveId || null;
  let driveUrl = fallbackDriveUrl || null;

  if (!driveId || !driveUrl) {
    const pdfBuffer = await buildSegmentLiquidationPdfBuffer({
      allowance: row,
      segment: row,
      requesterName: row.requester_name,
    });
    const uploaded = await uploadBase64File(
      `viatico-${allowanceId}-${segmentType}-liquidacion.pdf`,
      pdfBuffer.toString("base64"),
      "application/pdf",
      process.env.VIATICOS_DRIVE_FOLDER_ID || process.env.DRIVE_TRAVEL_ALLOWANCES_FOLDER_ID || null
    );
    driveId = uploaded?.id || null;
    driveUrl = uploaded?.webViewLink || uploaded?.webContentLink || (driveId ? `https://drive.google.com/file/d/${driveId}/view` : null);
  }

  if (!driveId || !driveUrl) return null;

  await db.query(
    `
      UPDATE travel_allowance_segments
      SET liquidation_document_drive_id = $2,
          liquidation_document_drive_url = $3,
          updated_at = NOW()
      WHERE id = $1
    `,
    [segmentId, driveId, driveUrl]
  );

  const fileName = `viatico-${allowanceId}-${segmentType}-liquidacion.pdf`;
  const existingDoc = await db.query(
    `
      SELECT id
      FROM travel_allowance_documents
      WHERE allowance_id = $1
        AND doc_type = 'liquidation'
        AND drive_file_id = $2
      LIMIT 1
    `,
    [allowanceId, driveId]
  );

  if (!existingDoc.rows.length) {
    await db.query(
      `
        INSERT INTO travel_allowance_documents (
          allowance_id, doc_type, file_name, mime_type, drive_file_id, drive_link,
          amount, notes, uploaded_by_user_id, uploaded_at
        )
        VALUES ($1, 'liquidation', $2, 'application/pdf', $3, $4, $5, $6, $7, NOW())
      `,
      [
        allowanceId,
        fileName,
        driveId,
        driveUrl,
        Number(row.economic_result_amount ?? row.approved_total ?? row.calculated_total ?? 0),
        `segment_type=${segmentType}`,
        actorUser?.id || null,
      ]
    );
  }

  await appendSegmentEvent({
    allowanceId,
    segmentId,
    eventType: "liquidation_document_generated",
    actorUserId: actorUser?.id || null,
    metadata: { segment_type: segmentType, drive_id: driveId, drive_url: driveUrl },
  });

  return { drive_id: driveId, drive_url: driveUrl, reused: false };
}

async function getAllowanceReceipt({ allowanceId, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const allowance = await getAllowanceById(allowanceId);
  if (!allowance) { const err = new Error("Viatico no encontrado"); err.status = 404; throw err; }
  assertAllowanceAccess(allowance, actorUser);

  const { rows } = await db.query(
    `SELECT ta.payment_receipt_drive_url  AS drive_url,
            ta.payment_receipt_drive_id   AS drive_id,
            ta.payment_receipt_uploaded_at AS uploaded_at,
            u.fullname                    AS uploaded_by_name
       FROM travel_allowances ta
       LEFT JOIN users u ON u.id = ta.payment_receipt_uploaded_by
      WHERE ta.id = $1`,
    [allowanceId]
  );

  return rows[0] || null;
}

async function listReviewAllowances({ actorUser, startDate, endDate, segment }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const isFinance = isFinanceApprover(actorUser);
  const isTalento = isTalentoApprover(actorUser);
  const isAdmin   = isGlobalViaticosViewer(actorUser);

  if (segment === "talento" && !isTalento && !isAdmin) {
    const err = new Error("Solo talento_humano puede acceder a esta cola"); err.status = 403; throw err;
  }
  if (segment === "finance" && !isFinance && !isAdmin) {
    const err = new Error("Solo finanzas puede acceder a esta cola"); err.status = 403; throw err;
  }

  const range = resolveDateRange(startDate, endDate);

  const segmentType = segment === "talento" ? "without_card" : "with_card";

  const { rows } = await db.query(
    `
      SELECT
        ta.*,
        ru.fullname AS requester_name,
        seg.id AS segment_id,
        seg.segment_type,
        seg.workflow_status AS segment_workflow_status,
        seg.calculated_total AS segment_total,
        seg.approved_total AS segment_approved_total,
        seg.economic_result_type AS segment_economic_result_type,
        seg.economic_result_amount AS segment_economic_result_amount,
        COALESCE(inv.invoices_count, 0)::int AS invoices_count,
        COALESCE(inv.invoices_total, 0)       AS invoices_total
      FROM travel_allowances ta
      LEFT JOIN users ru ON ru.id = ta.requester_user_id
      JOIN travel_allowance_segments seg
        ON seg.allowance_id = ta.id
       AND seg.segment_type = $3
       AND seg.visible_in_active_queue = TRUE
      LEFT JOIN (
        SELECT allowance_id,
               COUNT(*)::int                 AS invoices_count,
               COALESCE(SUM(total), 0)       AS invoices_total
          FROM travel_allowance_invoices
         WHERE COALESCE(status, '') <> 'rechazada'
         GROUP BY allowance_id
      ) inv ON inv.allowance_id = ta.id
      WHERE ta.visit_date BETWEEN $1 AND $2
        AND ta.processing_state <> 'anulado'
        AND seg.workflow_status IN ('enviado', 'en_revision', 'aprobado')
      ORDER BY ta.requester_email, ta.visit_date DESC
      LIMIT 500
    `,
    [range.startDate, range.endDate, segmentType]
  );

  return rows;
}

async function exportAllowancesReport({ actorUser, startDate, endDate, requesterEmail }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const isFinance = isFinanceApprover(actorUser);
  const isTalento = isTalentoApprover(actorUser);
  const isAdmin   = isGlobalViaticosViewer(actorUser);

  if (!isFinance && !isTalento && !isAdmin) {
    const err = new Error("Solo revisores pueden exportar reportes"); err.status = 403; throw err;
  }

  const range = resolveDateRange(startDate, endDate);
  const params = [range.startDate, range.endDate];
  let emailFilter = "";
  if (requesterEmail) {
    params.push(String(requesterEmail).toLowerCase());
    emailFilter = `AND LOWER(COALESCE(ta.requester_email, '')) = $${params.length}`;
  }

  const { rows } = await db.query(
    `
      SELECT
        ta.id,
        ta.requester_email,
        ru.fullname                                                                       AS requester_name,
        ta.visit_date,
        ta.city,
        ta.processing_state,
        ta.workflow_status,
        ta.status,
        ta.requires_finance_approval,
        ta.requires_talento_approval,
        ta.outside_labor_area,
        ta.amount,
        ta.final_balance_amount,
        ta.final_balance_result,
        ta.reviewer_observation,
        COALESCE((SELECT json_agg(
                    json_build_object(
                      'segment_type', s.segment_type,
                      'workflow_status', s.workflow_status,
                      'calculated_total', s.calculated_total,
                      'approved_total', s.approved_total,
                      'economic_result_type', s.economic_result_type,
                      'economic_result_amount', s.economic_result_amount
                    )
                    ORDER BY s.segment_type
                  )
                  FROM travel_allowance_segments s
                  WHERE s.allowance_id = ta.id), '[]'::json)                                        AS segments,
        COALESCE((SELECT SUM(total) FROM travel_allowance_invoices
                   WHERE allowance_id = ta.id AND COALESCE(status,'') <> 'rechazada'), 0)             AS invoices_total,
        COALESCE((SELECT SUM(total) FROM travel_allowance_invoices
                   WHERE allowance_id = ta.id AND expense_mode = 'with_card'
                     AND COALESCE(status,'') <> 'rechazada'), 0)                                      AS with_card_total,
        COALESCE((SELECT SUM(total) FROM travel_allowance_invoices
                   WHERE allowance_id = ta.id AND expense_mode = 'without_card'
                     AND COALESCE(status,'') <> 'rechazada'), 0)                                      AS without_card_total,
        COALESCE((SELECT COUNT(*)::int FROM travel_allowance_invoices
                   WHERE allowance_id = ta.id), 0)                                                     AS total_invoices,
        COALESCE((SELECT COUNT(*)::int FROM travel_allowance_invoices
                   WHERE allowance_id = ta.id AND status = 'rechazada'), 0)                            AS rejected_invoices,
        ta.created_at,
        ta.updated_at
      FROM travel_allowances ta
      LEFT JOIN users ru ON ru.id = ta.requester_user_id
      WHERE ta.visit_date BETWEEN $1 AND $2 ${emailFilter}
      ORDER BY ta.requester_email, ta.visit_date DESC
      LIMIT 5000
    `,
    params
  );

  return rows;
}

async function submitMonthAllowances({ allowanceIds, actorUser }) {
  await ensureSchema();
  assertViaticosAccess(actorUser);

  const ids = (Array.isArray(allowanceIds) ? allowanceIds : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!ids.length) {
    const err = new Error("Debes enviar al menos un ID de viatico"); err.status = 400; throw err;
  }

  const { rows: allowances } = await db.query(
    `SELECT id, requester_email, workflow_status, visit_date, outside_labor_area
       FROM travel_allowances WHERE id = ANY($1::bigint[])`,
    [ids]
  );

  if (allowances.length !== ids.length) {
    const err = new Error("Uno o mas viaticos no fueron encontrados"); err.status = 404; throw err;
  }

  const actorEmail = String(actorUser?.email || "").toLowerCase();
  const isPrivileged = isGlobalViaticosViewer(actorUser) || isOperationalApprover(actorUser);
  const ALREADY_SUBMITTED = new Set([
    "pendiente_revision", "aprobado_jefe", "rechazado_jefe",
    "pendiente_aprobacion_talento", "pendiente_aprobacion_financiera", "pendiente_aprobacion_mixta",
    "pendiente_financiero", "aprobado_financiero", "rechazado_financiero",
    "aprobado_talento_humano", "aprobado_mixto", "listo_pago", "pagado", "cerrado",
  ]);

  for (const allowance of allowances) {
    if (!isPrivileged && String(allowance.requester_email || "").toLowerCase() !== actorEmail) {
      const err = new Error(`No tienes permiso para enviar el viatico #${allowance.id}`); err.status = 403; throw err;
    }
    if (ALREADY_SUBMITTED.has(String(allowance.workflow_status || "").toLowerCase())) {
      const err = new Error(`El viatico #${allowance.id} ya fue enviado a revision`); err.status = 400; throw err;
    }
  }

  // Validate all allowances have at least one expense with category + expense_mode
  for (const allowance of allowances) {
    const invVal = await db.query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(CASE WHEN category IS NULL OR BTRIM(category)='' THEN 1 ELSE 0 END),0)::int AS missing_cat,
              COALESCE(SUM(CASE WHEN expense_mode IS NULL OR BTRIM(expense_mode)='' THEN 1 ELSE 0 END),0)::int AS missing_mode
         FROM travel_allowance_invoices
        WHERE allowance_id = $1 AND COALESCE(status,'') <> 'rechazada'`,
      [allowance.id]
    );
    const pVal = await db.query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(CASE WHEN expense_mode IS NULL OR BTRIM(expense_mode)='' THEN 1 ELSE 0 END),0)::int AS missing_mode
         FROM travel_allowance_purchases_no_invoice
        WHERE allowance_id = $1 AND COALESCE(status,'') <> 'rejected'`,
      [allowance.id]
    );
    const ir = invVal.rows[0] || {};
    const pr = pVal.rows[0] || {};
    if (Number(ir.total || 0) + Number(pr.total || 0) === 0) {
      const err = new Error(`La salida #${allowance.id} no tiene gastos registrados`); err.status = 400; throw err;
    }
    if (Number(ir.missing_cat || 0) > 0) {
      const err = new Error(`La salida #${allowance.id} tiene facturas sin categoria`); err.status = 400; throw err;
    }
    if (Number(ir.missing_mode || 0) > 0 || Number(pr.missing_mode || 0) > 0) {
      const err = new Error(`La salida #${allowance.id} tiene gastos sin modo (tarjeta/efectivo)`); err.status = 400; throw err;
    }
  }

  // Submit all
  const results = [];
  for (const allowance of allowances) {
    // Mismo flujo que submitAllowanceForReview: hay que sincronizar y luego
    // marcar 'enviado' los segmentos (travel_allowance_segments) ademas de
    // actualizar la fila padre. Las colas de revision de Finanzas/Talento
    // (listReviewAllowances) filtran por seg.workflow_status, no por
    // travel_allowances.workflow_status -- sin este paso los segmentos se
    // quedaban en 'borrador' y la salida enviada nunca aparecia en esas
    // colas aunque la fila padre ya dijera "pendiente_aprobacion_talento".
    const syncedBeforeSubmit = await syncAllowanceSegments(allowance.id, { actorUserId: actorUser.id || null });
    const modeTotals = await computeAllowanceModeTotals(allowance.id);
    const pendingWorkflowStatus = resolvePendingWorkflowStatus(modeTotals);
    const { rows } = await db.query(
      `UPDATE travel_allowances
          SET workflow_status = $2,
              requires_finance_approval = $3,
              requires_talento_approval = $4,
              finance_approval_status = $5,
              talento_approval_status = $6,
              finance_approved_by_user_id = NULL,
              talento_approved_by_user_id = NULL,
              finance_approved_at = NULL,
              talento_approved_at = NULL,
              status = 'pending',
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        allowance.id,
        pendingWorkflowStatus,
        modeTotals.requiresFinanceApproval,
        modeTotals.requiresTalentoApproval,
        modeTotals.requiresFinanceApproval ? "pending" : "not_required",
        modeTotals.requiresTalentoApproval ? "pending" : "not_required",
      ]
    );
    if (rows.length) results.push(rows[0]);

    for (const segment of syncedBeforeSubmit?.segments || []) {
      if (!segment.visible_in_active_queue || Number(segment.calculated_total || 0) <= 0) continue;
      const fromStatus = String(segment.workflow_status || "").toLowerCase();
      if (fromStatus !== "borrador" && fromStatus !== "rechazado") continue;
      const { rows: updatedSegments } = await db.query(
        `
          UPDATE travel_allowance_segments
          SET workflow_status = 'enviado',
              submitted_at = NOW(),
              submitted_by_user_id = $2,
              visible_in_active_queue = TRUE,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [segment.id, actorUser.id || null]
      );
      if (updatedSegments[0]) {
        await appendSegmentEvent({
          allowanceId: allowance.id,
          segmentId: segment.id,
          eventType: "submitted",
          fromStatus,
          toStatus: "enviado",
          actorUserId: actorUser.id || null,
        });
      }
    }
    await syncAllowanceSegments(allowance.id, { actorUserId: actorUser.id || null });
  }

  // Single consolidated notification
  try {
    const { rows: [requester] } = await db.query(
      `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
      [allowances[0].requester_email]
    );
    if (requester?.id) {
      await NotificationManager.sendNotification({
        userId: requester.id,
        template: "custom_html",
        customTitle: "Viaticos del mes enviados a revision",
        customMessage: [
          `${results.length} salida${results.length !== 1 ? "s" : ""} fuera del area enviada${results.length !== 1 ? "s" : ""} a revision.`,
          actorUser?.email ? `Enviado por: ${actorUser.email}` : null,
        ].filter(Boolean).join("\n"),
        type: "info",
        priority: 1,
        source: "viaticos",
        meta: {
          allowance_ids: ids,
          actor_email: actorUser?.email || null,
          email_to: requester.email,
          target_path: "/dashboard/finanzas/viaticos",
        },
        data: { email_to: requester.email, email_subject: "Viaticos del mes enviados a revision" },
        email: true,
        chat: false,
      });
    }
  } catch (notifErr) {
    logger.warn({ notifErr }, "No se pudo notificar submit-month");
  }

  return { submitted: results.length, allowances: results };
}

async function requestCorrection({ allowanceId, observation, actorUser }) {
  await ensureSchema();
  const REVIEWER_ROLES = [
    "finanzas", "financiero", "jefe_finanzas", "jefe_financiero",
    "talento_humano", "jefe_talento_humano",
  ];
  const roles = collectUserRoles(actorUser);
  const isReviewer = Array.from(roles).some((r) => REVIEWER_ROLES.includes(r));
  if (!isReviewer) {
    const err = new Error("Solo revisores pueden solicitar correcciones"); err.status = 403; throw err;
  }
  if (!String(observation || "").trim()) {
    const err = new Error("La observacion no puede estar vacia"); err.status = 400; throw err;
  }

  const { rows: [allowance] } = await db.query(
    `SELECT id, requester_email, requester_user_id, workflow_status FROM travel_allowances WHERE id = $1`,
    [allowanceId]
  );
  if (!allowance) { const err = new Error("Viatico no encontrado"); err.status = 404; throw err; }

  await db.query(
    `UPDATE travel_allowances
        SET workflow_status = 'observado',
            reviewer_observation = $1,
            reviewer_observation_at = NOW(),
            reviewer_observation_by = $2,
            updated_at = NOW()
      WHERE id = $3`,
      [observation.trim(), actorUser?.id || null, allowanceId]
  );

  const synced = await syncAllowanceSegments(allowanceId, { actorUserId: actorUser.id || null });
  const targetSegmentType = isTalentoApprover(actorUser) ? "without_card" : "with_card";
  const targetSegment = (synced?.segments || []).find((segment) => segment.segment_type === targetSegmentType);
  if (targetSegment) {
    const fromStatus = String(targetSegment.workflow_status || "").toLowerCase();
    await db.query(
      `
        UPDATE travel_allowance_segments
        SET workflow_status = 'borrador',
            visible_in_active_queue = TRUE,
            updated_at = NOW()
        WHERE id = $1
      `,
      [targetSegment.id]
    ).catch(() => null);
    await appendSegmentEvent({
      allowanceId,
      segmentId: targetSegment.id,
      eventType: "returned_to_draft",
      fromStatus,
      toStatus: "borrador",
      observation: observation.trim(),
      actorUserId: actorUser?.id || null,
      metadata: { segment_type: targetSegmentType },
    });
  }

  try {
    const { rows: [requester] } = await db.query(
      `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
      [allowance.requester_email]
    );
    if (requester?.id) {
      await NotificationManager.sendNotification({
        userId: requester.id,
        template: "custom_html",
        customTitle: "Correccion solicitada en tu viatico",
        customMessage: [
          `Tu viatico #${allowanceId} requiere correcciones.`,
          `Observacion del revisor: ${observation.trim()}`,
          actorUser?.email ? `Revisado por: ${actorUser.email}` : null,
        ].filter(Boolean).join("\n"),
        type: "warning",
        priority: 2,
        source: "viaticos",
        meta: {
          allowance_id: allowanceId,
          actor_email: actorUser?.email || null,
          email_to: requester.email,
          target_path: "/dashboard/finanzas/viaticos",
        },
        data: {
          email_to: requester.email,
          email_subject: `Correccion solicitada en viatico #${allowanceId}`,
        },
        email: true,
        chat: false,
      });
    }
  } catch (notifErr) {
    logger.warn({ notifErr, allowanceId }, "No se pudo notificar correccion al declarante");
  }

  return syncAllowanceSegments(allowanceId, { actorUserId: actorUser.id || null });
}

async function addReviewerNoteToInvoice({ invoiceId, note, action, actorUser }) {
  await ensureSchema();
  const REVIEWER_ROLES = [
    "finanzas", "financiero", "jefe_finanzas", "jefe_financiero",
    "talento_humano", "jefe_talento_humano",
  ];
  const roles = collectUserRoles(actorUser);
  const isReviewer = Array.from(roles).some((r) => REVIEWER_ROLES.includes(r));
  if (!isReviewer) {
    const err = new Error("Solo revisores pueden marcar facturas"); err.status = 403; throw err;
  }
  if (!String(note || "").trim()) {
    const err = new Error("La nota no puede estar vacia"); err.status = 400; throw err;
  }
  const ALLOWED_ACTIONS = new Set(["flag", "reject"]);
  if (!ALLOWED_ACTIONS.has(action)) {
    const err = new Error("Accion invalida. Usa 'flag' o 'reject'"); err.status = 400; throw err;
  }

  const { rows: [invoice] } = await db.query(
    `SELECT id, status FROM travel_allowance_invoices WHERE id = $1`,
    [invoiceId]
  );
  if (!invoice) { const err = new Error("Factura no encontrada"); err.status = 404; throw err; }

  const newStatus = action === "reject" ? "rechazada" : invoice.status;
  await db.query(
    `UPDATE travel_allowance_invoices
        SET reviewer_note = $1,
            status = $2,
            rejected_at = CASE WHEN $2 = 'rechazada' THEN NOW() ELSE rejected_at END,
            rejected_by_user_id = CASE WHEN $2 = 'rechazada' THEN $4 ELSE rejected_by_user_id END,
            returned_to_draft_at = CASE WHEN $2 <> 'rechazada' THEN NOW() ELSE returned_to_draft_at END,
            returned_to_draft_by_user_id = CASE WHEN $2 <> 'rechazada' THEN $4 ELSE returned_to_draft_by_user_id END,
            updated_at = NOW()
      WHERE id = $3`,
    [note.trim(), newStatus, invoiceId, actorUser.id || null]
  );
  const { rows: invoiceRows } = await db.query(`SELECT allowance_id FROM travel_allowance_invoices WHERE id = $1`, [invoiceId]);
  const allowanceId = invoiceRows[0]?.allowance_id || null;
  if (allowanceId) {
    await appendSegmentEvent({
      allowanceId,
      eventType: action === "reject" ? "receipt_rejected" : "receipt_flagged",
      observation: note.trim(),
      actorUserId: actorUser.id || null,
      metadata: { invoice_id: invoiceId, new_status: newStatus },
    });
    await recalculateAllowanceTotals(allowanceId);
    return syncAllowanceSegments(allowanceId, { actorUserId: actorUser.id || null });
  }

  return { ok: true, invoice_id: invoiceId, new_status: newStatus };
}

async function batchPayAllowances({ allowanceIds, paymentReference, actorUser }) {
  await ensureSchema();
  assertFinanceApprover(actorUser);

  const ids = (Array.isArray(allowanceIds) ? allowanceIds : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!ids.length) {
    const err = new Error("Debes enviar al menos un ID de viatico"); err.status = 400; throw err;
  }

  const { rows: allowances } = await db.query(
    `SELECT * FROM travel_allowances WHERE id = ANY($1::bigint[])`,
    [ids]
  );

  if (allowances.length !== ids.length) {
    const err = new Error("Uno o mas viaticos no encontrados"); err.status = 404; throw err;
  }

  const notApproved = allowances.filter((a) => a.status !== "approved");
  if (notApproved.length) {
    const err = new Error(`${notApproved.length} salida(s) aun no estan aprobadas. Aprueba todas antes de registrar el pago del mes.`);
    err.status = 400; throw err;
  }

  const { rows: invoiceCounts } = await db.query(
    `SELECT
       allowance_id,
       COUNT(*)::int AS total,
       SUM(CASE WHEN expense_mode IS NULL OR BTRIM(expense_mode) = '' THEN 1 ELSE 0 END)::int AS missing_mode
     FROM travel_allowance_invoices
     WHERE allowance_id = ANY($1::bigint[])
       AND COALESCE(status, '') <> 'rechazada'
     GROUP BY allowance_id`,
    [ids]
  );

  const invoiceMap = new Map(invoiceCounts.map((r) => [Number(r.allowance_id), r]));

  const noInvoices = ids.filter((id) => !invoiceMap.has(id) || invoiceMap.get(id).total === 0);
  if (noInvoices.length) {
    const err = new Error(`${noInvoices.length} salida(s) no tienen facturas cargadas. Todas las salidas del mes deben tener al menos una factura para registrar el pago.`);
    err.status = 400; throw err;
  }

  const missingMode = ids.filter((id) => (invoiceMap.get(id)?.missing_mode || 0) > 0);
  if (missingMode.length) {
    const err = new Error(`${missingMode.length} salida(s) tienen facturas sin clasificar el modo de pago (con tarjeta / sin tarjeta). Clasifica todas antes de registrar el pago.`);
    err.status = 400; throw err;
  }

  const paymentDate = new Date().toISOString().slice(0, 10);
  const normalizedPaymentReference = String(paymentReference || "").trim() || null;
  const client = await db.getClient();
  const updatedRows = [];
  try {
    await client.query("BEGIN");
    for (const allowance of allowances) {
      const settlementStatus = resolveSettlementWorkflowStatus({
        requiresFinanceApproval: Boolean(allowance.requires_finance_approval),
        requiresTalentoApproval: Boolean(allowance.requires_talento_approval),
      });
      const { rows } = await client.query(
        `UPDATE travel_allowances
         SET status = 'paid',
             workflow_status = $2,
             payment_date = $3,
             finance_user_id = $4,
             payment_reference = $5,
             reviewed_by_user_id = $4,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [allowance.id, settlementStatus, paymentDate, actorUser.id || null, normalizedPaymentReference]
      );
      if (rows[0]) updatedRows.push(rows[0]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await Promise.allSettled(
    updatedRows.map((updated) =>
      notifyRequesterAllowanceStatusChange({
        allowance: updated,
        previousAllowance: allowances.find((a) => a.id === updated.id),
        actorUser,
        status: "paid",
      })
    )
  );

  for (const updated of updatedRows) {
    const { rows: segments } = await db.query(
      `
        SELECT id, workflow_status
        FROM travel_allowance_segments
        WHERE allowance_id = $1
          AND segment_type = 'with_card'
        LIMIT 1
      `,
      [updated.id]
    );
    const segment = segments[0];
    if (segment) {
      await db.query(
        `
          UPDATE travel_allowance_segments
          SET workflow_status = 'liquidado',
              liquidated_at = NOW(),
              liquidated_by_user_id = $2,
              bank_payment_reference = $3,
              visible_in_active_queue = FALSE,
              updated_at = NOW()
          WHERE id = $1
        `,
        [segment.id, actorUser.id || null, normalizedPaymentReference]
      );
      await appendSegmentEvent({
        allowanceId: updated.id,
        segmentId: segment.id,
        eventType: "liquidated",
        fromStatus: segment.workflow_status,
        toStatus: "liquidado",
        actorUserId: actorUser.id || null,
        metadata: { payment_reference: normalizedPaymentReference },
      });
      await createSegmentLiquidationDocument({
        allowanceId: updated.id,
        segmentId: segment.id,
        segmentType: "with_card",
        actorUser,
      });
    }
    await syncAllowanceSegments(updated.id, { actorUserId: actorUser.id || null });
  }

  return Promise.all(updatedRows.map((updated) => syncAllowanceSegments(updated.id, { actorUserId: actorUser.id || null })));
}

module.exports = {
  FINANCE_ROLES,
  isFinanceUser,
  canAccessViaticos,
  listVisitCandidates,
  listAllowances,
  upsertAllowance,
  updateAllowanceStatus,
  approveAllowanceSegment,
  batchPayAllowances,
  updateAllowanceWorkflowOperational,
  listAllowanceDocuments,
  createAllowanceDocument,
  uploadSriXmlInvoice,
  uploadSriTxtInvoices,
  previewSriTxtInvoices,
  uploadSriZipInvoices,
  deleteAllowanceInvoice,
  syncSriInvoicesForUser,
  listAllowanceInvoices,
  updateInvoiceClassification,
  createOrUpdateZone,
  upsertFixedProfile,
  listFixedProfiles,
  updatePolicy,
  getPolicyPublic,
  buildFinanceSummaryReport,
  generateAtsXml,
  buildAllowanceReport,
  createManualNote,
  listManualNotes,
  updateManualNote,
  deleteManualNote,
  createPurchaseNoInvoice,
  listPurchasesNoInvoice,
  approvePurchaseNoInvoice,
  recalculateAllowanceTotals,
  submitAllowanceForReview,
  submitMonthAllowances,
  syncAllowanceSegments,
  appendSegmentEvent,
  listReviewAllowances,
  exportAllowancesReport,
  exportExpedienteMonthPdf,
  batchUploadReceipt,
  getAllowanceReceipt,
  requestCorrection,
  addReviewerNoteToInvoice,
  requestAnticipo,
  listAnticipos,
  updateAnticipo,
};








