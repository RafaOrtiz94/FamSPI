const db = require("../../config/db");
const logger = require("../../config/logger");
const notificationManager = require("../notifications/notificationManager");
const { getHolidaysForYear } = require("../security/security.holidays.ec");
const {
  ensureFolder,
  uploadBase64File,
  copyTemplate,
  replaceTags,
  insertDocsTableRows,
  exportPdfBuffer,
  downloadFileBuffer,
  deleteFile,
} = require("../../utils/drive");
const { computeSha256HexFromBuffer } = require("../../utils/documentHash");
const { upsertCollaboratorProfile } = require("../collaborators/collaborators.service");
const signatureWorkflowsService = require("../signature-workflows/signatureWorkflows.service");
const { resolveRecipientOrThrow } = signatureWorkflowsService;
const { validateCreateWorkflowPayload } = require("../signature-workflows/signatureWorkflows.validation");

const ALLOWED_STATUSES = new Set([
  "available",
  "assigned",
  "unassigned",
  "damaged",
  "in_maintenance",
  "retired",
]);

const TI_ROLES = ["ti", "jefe_ti", "admin_ti", "gerencia"];
const TI_READ_ROLES = [
  "ti", "jefe_ti", "admin_ti", "gerencia", "gerencia_general",
  "financiero", "jefe_financiero", "finanzas", "jefe_finanzas", "contador",
];
// Roles que pueden crear activos (TI + financiero)
const TI_ASSET_CREATE_ROLES = [...TI_ROLES, "financiero", "jefe_financiero", "finanzas", "jefe_finanzas", "contador"];
const MS_PER_DAY = 86400000;
const TI_ACTA_ENTREGA_TEMPLATE_ID = process.env.TI_ACTA_ENTREGA_TEMPLATE_ID || null;
const TI_ACTA_RETIRO_TEMPLATE_ID = process.env.TI_ACTA_RETIRO_TEMPLATE_ID || null;

// Schema managed via migration 202_ti_assets_v2.sql — run it once against the DB.
async function ensureTiAssetsSchema() { /* no-op */ }

const getMonthNameEs = (monthNum) => {
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const idx = Number(monthNum) - 1;
  return idx >= 0 && idx < 12 ? months[idx] : String(monthNum || "");
};

// ─── Google Docs table cell builder ──────────────────────────────────────────
// Columns: No. | Equipo/Accesorio | Marca/Modelo | Serie/IMEI | Nuevo o Usado | Estado (1-10) | Observaciones
const _tiActaCellValues = (item, i) => [
  String(i + 1),
  item.name || "",
  item.brand_model || "",
  item.serial_imei || "",
  item.is_new === true ? "Nuevo" : item.is_new === false ? "Usado" : "",
  item.physical_condition != null ? `${item.physical_condition}/10` : "",
  item.observations || "",
];

const buildTiActaItemsBlock = (items = []) => items.map((item, index) => {
  const lines = [`${index + 1}. ${item.name || "Item sin nombre"}`];
  if (item.brand_model) lines.push(`   Marca/Modelo: ${item.brand_model}`);
  if (item.serial_imei) lines.push(`   Serie/IMEI: ${item.serial_imei}`);
  if (item.is_new === true) lines.push("   Estado: Nuevo");
  if (item.is_new === false) lines.push("   Estado: Usado");
  if (item.physical_condition != null) lines.push(`   Condición: ${item.physical_condition}/10`);
  if (item.observations) lines.push(`   Observaciones: ${item.observations}`);
  return lines.join("\n");
}).join("\n\n");

async function resolveDraftActaFolder() {
  const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID || null;
  if (!rootFolderId) return null;
  const folder = await ensureFolder("Actas TI", rootFolderId);
  return folder?.id || rootFolderId;
}

// ── legacy inline schema (kept for reference, replaced by 202_ti_assets_v2.sql) ──
async function _legacyEnsureTiAssetsSchema_UNUSED() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_assets (
      id BIGSERIAL PRIMARY KEY,
      asset_code TEXT UNIQUE,
      name TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      characteristics JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'unassigned',
      assigned_to_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      assigned_at TIMESTAMPTZ,
      last_maintenance_at DATE,
      maintenance_frequency_months INTEGER NOT NULL DEFAULT 12,
      active BOOLEAN NOT NULL DEFAULT true,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_asset_assignments (
      id BIGSERIAL PRIMARY KEY,
      asset_id BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
      assigned_to_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      previous_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      reason TEXT,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_asset_events (
      id BIGSERIAL PRIMARY KEY,
      asset_id BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_asset_maintenance_schedule (
      id BIGSERIAL PRIMARY KEY,
      asset_id BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      planned_date DATE NOT NULL,
      max_due_date DATE,
      coordinated_withdrawal_date DATE,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TIMESTAMPTZ,
      notes TEXT,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(asset_id, planned_date)
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_assets_status ON public.ti_assets(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_assets_assigned_user ON public.ti_assets(assigned_to_user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_asset_events_asset_date ON public.ti_asset_events(asset_id, created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_asset_schedule_year ON public.ti_asset_maintenance_schedule(year, status)`);
  await db.query(`ALTER TABLE public.ti_asset_maintenance_schedule ADD COLUMN IF NOT EXISTS max_due_date DATE`);
  await db.query(`ALTER TABLE public.ti_asset_maintenance_schedule ADD COLUMN IF NOT EXISTS coordinated_withdrawal_date DATE`);
  await db.query(`ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS serial_number TEXT`);
  await db.query(`ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS imei TEXT`);
  await db.query(`ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS purchase_date DATE`);

  // Accesorios vinculados a un activo
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_asset_accessories (
      id                 BIGSERIAL PRIMARY KEY,
      asset_id           BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
      name               TEXT NOT NULL,
      brand              TEXT,
      model              TEXT,
      serial_number      TEXT,
      imei               TEXT,
      is_new             BOOLEAN NOT NULL DEFAULT false,
      physical_condition INTEGER,
      observations       TEXT,
      active             BOOLEAN NOT NULL DEFAULT true,
      created_by         INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      updated_by         INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_accessories_asset ON public.ti_asset_accessories(asset_id, active)`);

  // Cabecera de actas (entrega / retiro) — asset_id is now optional (NULL allowed)
  // Multiple items stored in ti_asset_actas_items
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_asset_actas (
      id                  BIGSERIAL PRIMARY KEY,
      acta_code           TEXT UNIQUE NOT NULL,
      tipo                TEXT NOT NULL,
      asset_id            BIGINT REFERENCES public.ti_assets(id) ON DELETE SET NULL,
      recipient_user_id   INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      previous_user_id    INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      recipient_nombre    TEXT,
      recipient_cedula    TEXT,
      recipient_cargo     TEXT,
      acta_day            INTEGER,
      acta_month          INTEGER,
      acta_year           INTEGER,
      generated_by        INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      notes               TEXT,
      pdf_filename        TEXT,
      pdf_sha256          TEXT,
      pdf_drive_url       TEXT,
      pdf_drive_file_id   TEXT,
      active              BOOLEAN NOT NULL DEFAULT true,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Add missing columns if they don't exist (idempotent)
  await db.query(`ALTER TABLE IF EXISTS public.ti_asset_actas ADD COLUMN IF NOT EXISTS acta_code TEXT UNIQUE`);
  await db.query(`ALTER TABLE IF EXISTS public.ti_asset_actas ADD COLUMN IF NOT EXISTS acta_day INTEGER`);
  await db.query(`ALTER TABLE IF EXISTS public.ti_asset_actas ADD COLUMN IF NOT EXISTS acta_month INTEGER`);
  await db.query(`ALTER TABLE IF EXISTS public.ti_asset_actas ADD COLUMN IF NOT EXISTS acta_year INTEGER`);

  // Make asset_id nullable if it exists and is currently NOT NULL
  await db.query(`ALTER TABLE IF EXISTS public.ti_asset_actas ALTER COLUMN asset_id DROP NOT NULL`);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_actas_asset ON public.ti_asset_actas(asset_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_actas_generated ON public.ti_asset_actas(generated_at DESC)`);

  // Filas del acta (equipos + accesorios)
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_asset_actas_items (
      id                  BIGSERIAL PRIMARY KEY,
      acta_id             BIGINT NOT NULL REFERENCES public.ti_asset_actas(id) ON DELETE CASCADE,
      order_num           INTEGER NOT NULL,
      item_type           TEXT NOT NULL,
      asset_id            BIGINT REFERENCES public.ti_assets(id) ON DELETE SET NULL,
      accessory_id        BIGINT REFERENCES public.ti_asset_accessories(id) ON DELETE SET NULL,
      name                TEXT NOT NULL,
      brand_model         TEXT,
      serial_imei         TEXT,
      is_new              BOOLEAN,
      physical_condition  INTEGER,
      observations        TEXT
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_actas_items_acta ON public.ti_asset_actas_items(acta_id)`);

  // Número corporativo en accesorios (idempotente)
  await db.query(`ALTER TABLE public.ti_asset_accessories ADD COLUMN IF NOT EXISTS numero_corporativo TEXT`);

  // Documentos financieros por activo (factura única, letra de cambio múltiple)
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_asset_financial_docs (
      id              BIGSERIAL PRIMARY KEY,
      asset_id        BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
      doc_type        TEXT NOT NULL,
      assigned_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      filename        TEXT,
      drive_file_id   TEXT,
      drive_url       TEXT,
      sha256          TEXT,
      notes           TEXT,
      uploaded_by     INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      active          BOOLEAN NOT NULL DEFAULT true
    );
  `);
  // UNIQUE only for factura (one per asset), allow multiple letra_de_cambio per asset
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ti_financial_docs_asset_type_factura
      ON public.ti_asset_financial_docs(asset_id, doc_type)
      WHERE active = true AND doc_type = 'factura'
  `);

  // Columnas para acta firmada (idempotentes)
  await db.query(`ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_pdf_drive_file_id TEXT`);
  await db.query(`ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_pdf_drive_url     TEXT`);
  await db.query(`ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_pdf_sha256        TEXT`);
  await db.query(`ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_pdf_filename      TEXT`);
  await db.query(`ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_at               TIMESTAMPTZ`);
  await db.query(`ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_by               INTEGER REFERENCES public.users(id) ON DELETE SET NULL`);
  await db.query(`ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS is_complete             BOOLEAN NOT NULL DEFAULT false`);

  // ========== FASE 1: ACTIVOS TI V2 ==========

  // Tabla: ti_corporate_numbers (números corporativos para móviles)
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_corporate_numbers (
      id BIGSERIAL PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'inactive')),
      asset_id BIGINT REFERENCES public.ti_assets(id) ON DELETE SET NULL,
      assigned_to_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      assigned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_corporate_numbers_status ON public.ti_corporate_numbers(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_corporate_numbers_asset ON public.ti_corporate_numbers(asset_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_corporate_numbers_user ON public.ti_corporate_numbers(assigned_to_user_id)`);

  // Tabla: ti_corporate_number_history (historial de cambios)
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_corporate_number_history (
      id BIGSERIAL PRIMARY KEY,
      number_id BIGINT NOT NULL REFERENCES public.ti_corporate_numbers(id) ON DELETE CASCADE,
      old_number TEXT,
      new_number TEXT NOT NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      changed_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_corporate_number_history_number ON public.ti_corporate_number_history(number_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_corporate_number_history_changed_at ON public.ti_corporate_number_history(changed_at DESC)`);

  // Tabla: ti_asset_liberation_photos (fotos de liberación)
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ti_asset_liberation_photos (
      id BIGSERIAL PRIMARY KEY,
      asset_id BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      drive_url TEXT,
      drive_file_id TEXT,
      sha256 TEXT,
      liberated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      liberated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_asset_liberation_photos_asset ON public.ti_asset_liberation_photos(asset_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_asset_liberation_photos_liberated_at ON public.ti_asset_liberation_photos(liberated_at DESC)`);

  // Alteraciones a ti_assets: purchase_value y value_category (para depreciación)
  await db.query(`ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS purchase_value DECIMAL(12, 2)`);
  await db.query(`ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS value_category TEXT CHECK (value_category IN ('asset', 'control_item'))`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_assets_purchase_value ON public.ti_assets(purchase_value)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_assets_value_category ON public.ti_assets(value_category)`);

  // Alteraciones a ti_asset_actas_items: características
  await db.query(`ALTER TABLE public.ti_asset_actas_items ADD COLUMN IF NOT EXISTS characteristics TEXT`);

  // Alteraciones a ti_asset_assignments: características
  await db.query(`ALTER TABLE public.ti_asset_assignments ADD COLUMN IF NOT EXISTS characteristics TEXT`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_asset_assignments_asset_user ON public.ti_asset_assignments(asset_id, assigned_to_user_id)`);

  // Alteraciones a ti_asset_financial_docs: columnas añadidas posteriormente
  await db.query(`ALTER TABLE public.ti_asset_financial_docs ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL`);
  await db.query(`ALTER TABLE public.ti_asset_financial_docs ADD COLUMN IF NOT EXISTS assignment_id BIGINT REFERENCES public.ti_asset_assignments(id) ON DELETE SET NULL`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_asset_financial_docs_user ON public.ti_asset_financial_docs(assigned_user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ti_asset_financial_docs_assignment ON public.ti_asset_financial_docs(assignment_id)`);

  // Función para auditar cambios de status
  await db.query(`
    CREATE OR REPLACE FUNCTION public.audit_ti_asset_status_change()
    RETURNS TRIGGER AS $$
    BEGIN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
        VALUES (NEW.id, 'status_change', jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'changed_at', now()
        ), NEW.updated_by, now());
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Crear trigger solo si no existe (idempotente, sin DROP que requiere exclusive lock)
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_ti_asset_status_change'
          AND tgrelid = 'public.ti_assets'::regclass
      ) THEN
        CREATE TRIGGER trg_ti_asset_status_change
        AFTER UPDATE ON public.ti_assets
        FOR EACH ROW
        EXECUTE FUNCTION public.audit_ti_asset_status_change();
      END IF;
    END;
    $$;
  `);

}

function parseISODateUTC(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(Date.UTC(y, m - 1, d));
    }
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function toISODateUTC(date) {
  return date.toISOString().slice(0, 10);
}

function addDaysUTC(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function addMonthsClampedUTC(date, monthsToAdd) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const firstOfTarget = new Date(Date.UTC(y, m + monthsToAdd, 1));
  const lastDay = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, lastDay);
  return new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth(), clampedDay));
}

function isWeekendUTC(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function isHolidayECUTC(date) {
  const year = date.getUTCFullYear();
  const iso = toISODateUTC(date);
  const holidays = getHolidaysForYear(year);
  return Array.isArray(holidays) && holidays.includes(iso);
}

function nextBusinessDayUTC(date) {
  let cursor = new Date(date.getTime());
  while (isWeekendUTC(cursor) || isHolidayECUTC(cursor)) {
    cursor = addDaysUTC(cursor, 1);
  }
  return cursor;
}

function addBusinessDaysUTC(date, days) {
  let cursor = new Date(date.getTime());
  let remaining = Math.max(0, Number(days) || 0);
  while (remaining > 0) {
    cursor = addDaysUTC(cursor, 1);
    if (isWeekendUTC(cursor) || isHolidayECUTC(cursor)) continue;
    remaining -= 1;
  }
  return cursor;
}

async function getTIUserIds() {
  const { rows } = await db.query(
    `SELECT id FROM public.users WHERE LOWER(COALESCE(role, '')) = ANY($1::text[]) AND COALESCE(active, true) = true`,
    [TI_ROLES],
  );
  return rows.map((r) => Number(r.id)).filter(Number.isFinite);
}

async function notifyMaintenanceWindow({ assetName, plannedDate, maxDueDate }) {
  const tiUsers = await getTIUserIds();
  if (!tiUsers.length) return;
  await Promise.all(
    tiUsers.map((userId) =>
      notificationManager.sendNotification({
        userId,
        template: "maintenance_due",
        customTitle: "Mantenimiento TI programado",
        customMessage: `${assetName || "Activo TI"} tiene mantenimiento el ${plannedDate}. Fecha maxima de cumplimiento: ${maxDueDate}.`,
        type: "alert",
        priority: 1,
        source: "ti_assets.maintenance_schedule",
        data: { equipment_name: assetName || "Activo TI", planned_date: plannedDate, max_due_date: maxDueDate },
        email: true,
        chat: false,
      }),
    ),
  );
}

// Depreciation: straight-line over 3 years (1095 days).
// Returns percentage deprecated (0-100) and residual percentage (0-100), computed day by day.
function computeDepreciation(purchaseDate) {
  if (!purchaseDate) return { depreciation_pct: null, residual_pct: null, depreciation_days: null, fully_depreciated: null };
  const msPerDay = 86400000;
  const usefulLifeDays = 3 * 365; // 1095
  const days = Math.max(0, Math.floor((Date.now() - new Date(purchaseDate).getTime()) / msPerDay));
  const depPct = Math.min(100, parseFloat(((days / usefulLifeDays) * 100).toFixed(2)));
  const resPct = Math.max(0, parseFloat((100 - depPct).toFixed(2)));
  return {
    depreciation_pct: depPct,
    residual_pct: resPct,
    depreciation_days: days,
    fully_depreciated: days >= usefulLifeDays,
  };
}

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(value)) {
    const err = new Error("Estado TI no permitido");
    err.status = 400;
    throw err;
  }
  return value;
}

async function listAssets({ status, q }) {
  await ensureTiAssetsSchema();
  const params = [];
  let where = "WHERE a.active = true";
  if (status) {
    params.push(normalizeStatus(status));
    where += ` AND a.status = $${params.length}`;
  }
  if (q) {
    params.push(`%${String(q).toLowerCase()}%`);
    where += ` AND (LOWER(a.name) LIKE $${params.length} OR LOWER(COALESCE(a.brand,'')) LIKE $${params.length} OR LOWER(COALESCE(a.model,'')) LIKE $${params.length} OR LOWER(COALESCE(a.serial_number,'')) LIKE $${params.length})`;
  }
  const { rows } = await db.query(
    `SELECT a.*,
            u.email AS assigned_to_email,
            COALESCE(u.fullname, u.name, u.email) AS assigned_to_name
       FROM public.ti_assets a
       LEFT JOIN public.users u ON u.id = a.assigned_to_user_id
       ${where}
       ORDER BY a.updated_at DESC`,
    params,
  );
  return rows.map((row) => ({
    ...row,
    ...computeDepreciation(row.purchase_date),
    depreciation_annual: row.purchase_value && row.purchase_value >= 400 ? (row.purchase_value * 0.1111) : 0,
  }));
}

async function createAsset({ data, userId }) {
  await ensureTiAssetsSchema();
  const {
    name,
    brand = null,
    model = null,
    characteristics = {},
    maintenance_frequency_months = 12,
    serial_number = null,
    imei = null,
    purchase_date = null,
    purchase_value = null, // FASE 3: Depreciación
  } = data || {};
  if (!name || !String(name).trim()) {
    const err = new Error("name es obligatorio");
    err.status = 400;
    throw err;
  }
  const safePurchaseDate = purchase_date ? String(purchase_date).trim() : null;

  // FASE 3: Calcular categoría automáticamente
  const parsedValue = purchase_value ? parseFloat(purchase_value) : null;
  const valueCategory = parsedValue && parsedValue >= 400 ? 'asset' : (parsedValue ? 'control_item' : null);

  const { rows } = await db.query(
    `INSERT INTO public.ti_assets
       (asset_code, name, brand, model, characteristics, status, maintenance_frequency_months,
        serial_number, imei, purchase_date, purchase_value, value_category, created_by, updated_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,'unassigned',$6,$7,$8,$9::date,$10::decimal,$11,$12,$12,now(),now())
     RETURNING *`,
    [
      `TI-${Date.now()}`,
      String(name).trim(),
      brand || null,
      model || null,
      JSON.stringify(characteristics || {}),
      Number.isFinite(Number(maintenance_frequency_months)) ? Number(maintenance_frequency_months) : 12,
      serial_number || null,
      imei || null,
      safePurchaseDate,
      parsedValue || null,
      valueCategory,
      userId,
    ],
  );
  const asset = rows[0];
  await db.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     VALUES ($1,'asset_created',$2::jsonb,$3,now())`,
    [asset.id, JSON.stringify({ name, brand, model, serial_number, imei, purchase_date: safePurchaseDate, purchase_value: parsedValue }), userId],
  );
  return { ...asset, ...computeDepreciation(asset.purchase_date) };
}

async function updateAsset({ assetId, data, userId }) {
  await ensureTiAssetsSchema();
  const safePurchaseDate = data?.purchase_date ? String(data.purchase_date).trim() : undefined;
  const { rows } = await db.query(
    `UPDATE public.ti_assets
        SET name = COALESCE($1, name),
            brand = COALESCE($2, brand),
            model = COALESCE($3, model),
            characteristics = COALESCE($4::jsonb, characteristics),
            maintenance_frequency_months = COALESCE($5, maintenance_frequency_months),
            serial_number = COALESCE($6, serial_number),
            imei = COALESCE($7, imei),
            purchase_date = COALESCE($8::date, purchase_date),
            updated_by = $9,
            updated_at = now()
      WHERE id = $10
      RETURNING *`,
    [
      data?.name ?? null,
      data?.brand ?? null,
      data?.model ?? null,
      data?.characteristics ? JSON.stringify(data.characteristics) : null,
      Number.isFinite(Number(data?.maintenance_frequency_months)) ? Number(data.maintenance_frequency_months) : null,
      data?.serial_number ?? null,
      data?.imei ?? null,
      safePurchaseDate ?? null,
      userId,
      assetId,
    ],
  );
  if (!rows.length) {
    const err = new Error("Activo TI no encontrado");
    err.status = 404;
    throw err;
  }
  await db.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     VALUES ($1,'asset_updated',$2::jsonb,$3,now())`,
    [assetId, JSON.stringify(data || {}), userId],
  );
  return { ...rows[0], ...computeDepreciation(rows[0].purchase_date) };
}

async function assignAsset({
  assetId,
  assignedToUserId = null,
  reason = null,
  userId,
  // Acta fields
  recipientNombre = null,
  recipientCedula = null,
  recipientCargo = null,
  actaItems = null,   // [{item_type, asset_id, accessory_id, name, brand_model, serial_imei, is_new, physical_condition, observations}]
}) {
  await ensureTiAssetsSchema();
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const currentQ = await client.query(
      `SELECT id, name, assigned_to_user_id, status FROM public.ti_assets WHERE id = $1 LIMIT 1`,
      [assetId]
    );
    if (!currentQ.rows.length) {
      const err = new Error("Activo TI no encontrado");
      err.status = 404;
      throw err;
    }
    const current = currentQ.rows[0];

    // FASE 4: Validar estado - solo pueden asignarse equipos en estado available o unassigned
    if (assignedToUserId && current.status && !['available', 'unassigned'].includes(current.status)) {
      const err = new Error(`No se puede asignar un equipo en estado "${current.status}". Solo se pueden asignar equipos disponibles o sin asignar.`);
      err.status = 400;
      throw err;
    }
    const nextStatus = assignedToUserId ? "assigned" : "unassigned";
    const upd = await client.query(
      `UPDATE public.ti_assets
          SET assigned_to_user_id = $1::integer,
              assigned_at = CASE WHEN $1::integer IS NULL THEN NULL ELSE now() END,
              status = $2,
              updated_by = $3,
              updated_at = now()
        WHERE id = $4
        RETURNING *`,
      [assignedToUserId, nextStatus, userId, assetId],
    );
    // FASE 5: Insertar asignación con características
    const assignmentRes = await client.query(
      `INSERT INTO public.ti_asset_assignments (asset_id, assigned_to_user_id, previous_user_id, action, reason, characteristics, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       RETURNING id`,
      [assetId, assignedToUserId, current.assigned_to_user_id, assignedToUserId ? "assign_or_reassign" : "unassign", reason, actaItems ? JSON.stringify(actaItems) : null, userId],
    );
    const assignmentId = assignmentRes.rows[0]?.id || null;
    await client.query(
      `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
       VALUES ($1,$2,$3::jsonb,$4,now())`,
      [assetId, assignedToUserId ? "asset_assigned" : "asset_unassigned", JSON.stringify({ previous_user_id: current.assigned_to_user_id, assigned_to_user_id: assignedToUserId, reason }), userId],
    );

    // Build acta items if not provided: asset principal + accesorios activos
    let resolvedItems = actaItems;
    if (!resolvedItems) {
      const asset = upd.rows[0];
      const accQ = await client.query(
        `SELECT * FROM public.ti_asset_accessories WHERE asset_id = $1 AND active = true ORDER BY created_at ASC`,
        [assetId],
      );
      resolvedItems = [
        {
          item_type: "equipo",
          asset_id: asset.id,
          name: asset.name,
          brand_model: [asset.brand, asset.model].filter(Boolean).join(" "),
          serial_imei: [asset.serial_number, asset.imei].filter(Boolean).join(" / ") || null,
          is_new: null,
          physical_condition: null,
          observations: null,
        },
        ...accQ.rows.map((acc) => ({
          item_type: "accesorio",
          accessory_id: acc.id,
          name: acc.name,
          brand_model: [acc.brand, acc.model].filter(Boolean).join(" "),
          serial_imei: [acc.serial_number, acc.imei].filter(Boolean).join(" / ") || null,
          is_new: acc.is_new,
          physical_condition: acc.physical_condition,
          observations: acc.observations,
        })),
      ];
    }

    const tipo = assignedToUserId ? "entrega" : "retiro";
    // Frontend puede enviar datos manuales cuando la ficha está incompleta; si los 3 vienen, úsalos directamente
    let rNombre, rCedula, rCargo;
    if (recipientNombre && recipientCedula && recipientCargo) {
      rNombre = recipientNombre; rCedula = recipientCedula; rCargo = recipientCargo;
    } else {
      const actaRecipientId = assignedToUserId || current.assigned_to_user_id;
      ({ nombre: rNombre, cedula: rCedula, cargo: rCargo } = await resolveRecipientOrThrow(actaRecipientId, client));
    }
    const acta = await createActa({
      tipo,
      assetId,
      recipientUserId: assignedToUserId,
      previousUserId: current.assigned_to_user_id,
      recipientNombre: rNombre,
      recipientCedula: rCedula,
      recipientCargo:  rCargo,
      generatedBy: userId,
      notes: reason,
      items: resolvedItems,
      client,
    });

    // FASE 5: Crear letra de cambio automáticamente si se está asignando
    if (assignedToUserId && assignmentId) {
      // Buscar si existe factura del equipo
      const facturaQ = await client.query(
        `SELECT id FROM public.ti_asset_financial_docs
         WHERE asset_id = $1 AND doc_type = 'factura' AND active = true LIMIT 1`,
        [assetId]
      );

      if (facturaQ.rows.length) {
        // Crear letra de cambio (INSERT sin upsert, para que sea nueva cada asignación)
        await client.query(
          `INSERT INTO public.ti_asset_financial_docs
           (asset_id, doc_type, assignment_id, assigned_user_id, uploaded_at, uploaded_by, active)
           VALUES ($1, 'letra_de_cambio', $2, $3, now(), $4, true)`,
          [assetId, assignmentId, assignedToUserId, userId],
        );
      }
    }

    await client.query("COMMIT");
    return {
      ...upd.rows[0],
      ...computeDepreciation(upd.rows[0].purchase_date),
      acta_id: acta.id,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Assign multiple assets in a single acta (new flow)
async function assignMultipleAssets({
  assetIds = [],  // [1, 2, 3] — array of asset IDs to assign together
  assignedToUserId = null,
  reason = null,
  userId,
  // Acta fields
  recipientNombre = null,
  recipientCedula = null,
  recipientCargo = null,
  acta_items = null, // Optional: pre-built items with state data
}) {
  await ensureTiAssetsSchema();
  if (!assetIds.length) {
    const err = new Error("Debe seleccionar al menos un equipo");
    err.status = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Fetch all assets
    const assetsQ = await client.query(
      `SELECT id, name, brand, model, serial_number, imei, assigned_to_user_id FROM public.ti_assets WHERE id = ANY($1::bigint[]) ORDER BY id`,
      [assetIds],
    );
    if (!assetsQ.rows.length) {
      const err = new Error("Ninguno de los equipos encontrados");
      err.status = 404;
      throw err;
    }

    // Update all assets: assign to new user
    const nextStatus = assignedToUserId ? "assigned" : "unassigned";
    await client.query(
      `UPDATE public.ti_assets
        SET assigned_to_user_id = $1::integer,
            assigned_at = CASE WHEN $1::integer IS NULL THEN NULL ELSE now() END,
            status = $2,
            updated_by = $3,
            updated_at = now()
       WHERE id = ANY($4::bigint[])`,
      [assignedToUserId, nextStatus, userId, assetIds],
    );

    // Create assignments + events for each asset
    for (const asset of assetsQ.rows) {
      await client.query(
        `INSERT INTO public.ti_asset_assignments (asset_id, assigned_to_user_id, previous_user_id, action, reason, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,now())`,
        [asset.id, assignedToUserId, asset.assigned_to_user_id, assignedToUserId ? "assign_or_reassign" : "unassign", reason, userId],
      );
      await client.query(
        `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
         VALUES ($1,$2,$3::jsonb,$4,now())`,
        [asset.id, assignedToUserId ? "asset_assigned" : "asset_unassigned", JSON.stringify({ previous_user_id: asset.assigned_to_user_id, assigned_to_user_id: assignedToUserId, reason }), userId],
      );
    }

    // Build acta items: use provided acta_items if available, otherwise auto-build from assets + accessories
    let resolvedItems = acta_items;
    if (!resolvedItems || !Array.isArray(resolvedItems) || !resolvedItems.length) {
      resolvedItems = [];
      for (const asset of assetsQ.rows) {
        resolvedItems.push({
          item_type: "equipo",
          asset_id: asset.id,
          name: asset.name,
          brand_model: [asset.brand, asset.model].filter(Boolean).join(" "),
          serial_imei: [asset.serial_number, asset.imei].filter(Boolean).join(" / ") || null,
          is_new: null,
          physical_condition: null,
          observations: null,
        });

        // Add accessories for this asset
        const accQ = await client.query(
          `SELECT * FROM public.ti_asset_accessories WHERE asset_id = $1 AND active = true ORDER BY created_at ASC`,
          [asset.id],
        );
        resolvedItems.push(
          ...accQ.rows.map((acc) => ({
            item_type: "accesorio",
            asset_id: asset.id,
            accessory_id: acc.id,
            name: acc.name,
            brand_model: [acc.brand, acc.model].filter(Boolean).join(" "),
            serial_imei: [acc.serial_number, acc.imei].filter(Boolean).join(" / ") || null,
            is_new: acc.is_new,
            physical_condition: acc.physical_condition,
            observations: acc.observations,
          })),
        );
      }
    } else {
      // If acta_items provided from frontend, also add accessories for each asset
      for (const asset of assetsQ.rows) {
        const accQ = await client.query(
          `SELECT * FROM public.ti_asset_accessories WHERE asset_id = $1 AND active = true ORDER BY created_at ASC`,
          [asset.id],
        );
        resolvedItems.push(
          ...accQ.rows.map((acc) => ({
            item_type: "accesorio",
            asset_id: asset.id,
            accessory_id: acc.id,
            name: acc.name,
            brand_model: [acc.brand, acc.model].filter(Boolean).join(" "),
            serial_imei: [acc.serial_number, acc.imei].filter(Boolean).join(" / ") || null,
            is_new: acc.is_new,
            physical_condition: acc.physical_condition,
            observations: acc.observations,
          })),
        );
      }
    }

    // Create acta with all items
    const tipo = assignedToUserId ? "entrega" : "retiro";
    let rNombre, rCedula, rCargo;
    if (recipientNombre && recipientCedula && recipientCargo) {
      rNombre = recipientNombre; rCedula = recipientCedula; rCargo = recipientCargo;
    } else {
      const batchRecipientId = assignedToUserId || assetsQ.rows[0]?.assigned_to_user_id || null;
      ({ nombre: rNombre, cedula: rCedula, cargo: rCargo } = await resolveRecipientOrThrow(batchRecipientId, client));
    }
    const acta = await createActa({
      tipo,
      assetId: null,
      recipientUserId: assignedToUserId,
      previousUserId: assetsQ.rows[0]?.assigned_to_user_id || null,
      recipientNombre: rNombre,
      recipientCedula: rCedula,
      recipientCargo:  rCargo,
      generatedBy: userId,
      notes: reason,
      items: resolvedItems,
      client,
    });

    await client.query("COMMIT");
    return {
      acta_id: acta.id,
      acta_code: acta.acta_code,
      assets_assigned: assetIds.length,
      items_count: resolvedItems.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateAssetStatus({ assetId, status, reason = null, userId }) {
  await ensureTiAssetsSchema();
  const normalized = normalizeStatus(status);
  const { rows } = await db.query(
    `UPDATE public.ti_assets
        SET status = $1,
            updated_by = $2,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [normalized, userId, assetId],
  );
  if (!rows.length) {
    const err = new Error("Activo TI no encontrado");
    err.status = 404;
    throw err;
  }
  await db.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     VALUES ($1,'status_updated',$2::jsonb,$3,now())`,
    [assetId, JSON.stringify({ status: normalized, reason }), userId],
  );
  return { ...rows[0], ...computeDepreciation(rows[0].purchase_date) };
}

async function listAssetHistory(assetId) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `SELECT e.id, e.event_type, e.payload, e.created_at, e.created_by, COALESCE(u.fullname, u.name, u.email) AS created_by_name
       FROM public.ti_asset_events e
       LEFT JOIN public.users u ON u.id = e.created_by
      WHERE e.asset_id = $1
      ORDER BY e.created_at DESC, e.id DESC`,
    [assetId],
  );
  return rows;
}

async function listAssetAssignmentsHistory(assetId) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `SELECT a.id,
            a.asset_id,
            a.assigned_to_user_id,
            a.previous_user_id,
            a.action,
            a.reason,
            a.created_by,
            a.created_at,
            COALESCE(u_to.fullname, u_to.name, u_to.email) AS assigned_to_name,
            COALESCE(u_prev.fullname, u_prev.name, u_prev.email) AS previous_user_name,
            COALESCE(u_actor.fullname, u_actor.name, u_actor.email) AS created_by_name
       FROM public.ti_asset_assignments a
       LEFT JOIN public.users u_to ON u_to.id = a.assigned_to_user_id
       LEFT JOIN public.users u_prev ON u_prev.id = a.previous_user_id
       LEFT JOIN public.users u_actor ON u_actor.id = a.created_by
      WHERE a.asset_id = $1
      ORDER BY a.created_at DESC, a.id DESC`,
    [assetId],
  );
  return rows;
}

async function generateAnnualMaintenance({ year, userId, dryRun = false }) {
  await ensureTiAssetsSchema();
  const startYear = Number.parseInt(String(year || new Date().getFullYear()), 10);
  if (!Number.isFinite(startYear) || startYear < 2020 || startYear > 2100) {
    const err = new Error("year invalido");
    err.status = 400;
    throw err;
  }
  const endYear = startYear + 4;
  const assetsQ = await db.query(
    `SELECT id, name, maintenance_frequency_months, purchase_date
       FROM public.ti_assets
      WHERE active = true
        AND status NOT IN ('retired', 'damaged')
      ORDER BY id ASC`,
  );
  const assets = assetsQ.rows || [];
  const created = [];
  const skipped = [];
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    for (const asset of assets) {
      const every = Math.max(1, Number(asset.maintenance_frequency_months || 12));
      const purchase = parseISODateUTC(asset.purchase_date);
      if (!purchase) {
        skipped.push({ asset_id: asset.id, reason: "missing_purchase_date" });
        continue;
      }
      // El primer mantenimiento se agenda luego de cumplir la frecuencia desde compra.
      let cursor = addMonthsClampedUTC(purchase, every);
      while (cursor.getUTCFullYear() < startYear) {
        cursor = addMonthsClampedUTC(cursor, every);
      }
      while (cursor.getUTCFullYear() <= endYear) {
        const planned = toISODateUTC(cursor);
        const maxDueDate = toISODateUTC(addDaysUTC(cursor, 15));
        const exists = await client.query(
          `SELECT id FROM public.ti_asset_maintenance_schedule WHERE asset_id = $1 AND planned_date = $2::date LIMIT 1`,
          [asset.id, planned],
        );
        if (exists.rows.length) {
          skipped.push({ asset_id: asset.id, planned_date: planned, reason: "already_exists" });
          continue;
        }
        if (dryRun) {
          created.push({ asset_id: asset.id, planned_date: planned, max_due_date: maxDueDate, dry_run: true });
          cursor = addMonthsClampedUTC(cursor, every);
          continue;
        }
        const ins = await client.query(
          `INSERT INTO public.ti_asset_maintenance_schedule (asset_id, year, planned_date, max_due_date, status, created_by, updated_by, created_at, updated_at)
           VALUES ($1,$2,$3::date,$4::date,'pending',$5,$5,now(),now())
           RETURNING *`,
          [asset.id, Number.parseInt(planned.slice(0, 4), 10), planned, maxDueDate, userId],
        );
        created.push(ins.rows[0]);
        cursor = addMonthsClampedUTC(cursor, every);
      }
    }
    if (dryRun) await client.query("ROLLBACK");
    else await client.query("COMMIT");
    if (!dryRun) {
      for (const row of created) {
        try {
          const assetName = assets.find((a) => Number(a.id) === Number(row.asset_id))?.name || `Activo ${row.asset_id}`;
          await notifyMaintenanceWindow({
            assetName,
            plannedDate: String(row.planned_date).slice(0, 10),
            maxDueDate: String(row.max_due_date || "").slice(0, 10),
          });
        } catch (_err) {
          // notificacion no bloquea la generacion
        }
      }
    }
    return {
      start_year: startYear,
      end_year: endYear,
      assets: assets.length,
      created_count: created.length,
      skipped_count: skipped.length,
      created,
      skipped,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Parse a date value returned by pg robustly.
 * pg returns DATE columns as "YYYY-MM-DD" strings (standard) but may also
 * return JavaScript Date objects depending on driver config or Neon proxy.
 */
function parseAnyDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  // Try ISO date string "YYYY-MM-DD" first (standard pg DATE output)
  const fromISO = parseISODateUTC(value);
  if (fromISO) return fromISO;
  // Fallback: let JS parse it (handles timestamps like "2024-05-15T00:00:00.000Z")
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Generate or refresh maintenance schedules for all active assets
 * across all future years. Idempotent — skips records that already exist.
 * Generates from the current year up to HORIZON_YEARS ahead.
 * Assets with status 'retired' or 'damaged' are excluded.
 */
async function generateFutureMaintenance({ userId } = {}) {
  await ensureTiAssetsSchema();
  const HORIZON_YEARS = 15;
  const currentYear = new Date().getUTCFullYear();

  const assetsQ = await db.query(
    `SELECT id, name, maintenance_frequency_months, purchase_date, created_at
       FROM public.ti_assets
      WHERE active = true
        AND status NOT IN ('retired', 'damaged')
      ORDER BY id ASC`,
  );
  const assets = assetsQ.rows || [];

  let totalCreated = 0;
  let totalSkipped = 0;
  let noDateCount = 0;

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    for (const asset of assets) {
      const every = Math.max(1, Number(asset.maintenance_frequency_months || 12));

      // Regla: el cronograma se calcula desde purchase_date + frecuencia.
      const purchaseDate = parseAnyDate(asset.purchase_date);
      if (!purchaseDate) {
        noDateCount++;
        continue;
      }

      // Primer mantenimiento cuando cumple la frecuencia desde la compra.
      let cursor = addMonthsClampedUTC(purchaseDate, every);
      while (cursor.getUTCFullYear() < currentYear) {
        cursor = addMonthsClampedUTC(cursor, every);
      }

      // Generate from current year up to the horizon
      while (cursor.getUTCFullYear() <= currentYear + HORIZON_YEARS) {
        const planned = toISODateUTC(cursor);
        const maxDueDate = toISODateUTC(addDaysUTC(cursor, 15));
        const yr = cursor.getUTCFullYear();

        const exists = await client.query(
          `SELECT id FROM public.ti_asset_maintenance_schedule
            WHERE asset_id = $1 AND planned_date = $2::date LIMIT 1`,
          [asset.id, planned],
        );

        if (!exists.rows.length) {
          await client.query(
            `INSERT INTO public.ti_asset_maintenance_schedule
               (asset_id, year, planned_date, max_due_date, status, created_by, updated_by, created_at, updated_at)
             VALUES ($1,$2,$3::date,$4::date,'pending',$5,$5,now(),now())`,
            [asset.id, yr, planned, maxDueDate, userId || null],
          );
          totalCreated++;
        } else {
          totalSkipped++;
        }

        cursor = addMonthsClampedUTC(cursor, every);
      }
    }

    await client.query("COMMIT");
    return {
      assets: assets.length,
      created_count: totalCreated,
      skipped_existing: totalSkipped,
      skipped_no_date: noDateCount,
      horizon_years: HORIZON_YEARS,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listMaintenance({ year }) {
  await ensureTiAssetsSchema();
  const params = [];
  let where = "";
  if (year) {
    params.push(Number(year));
    where = `WHERE m.year = $1`;
  }
  const { rows } = await db.query(
    `SELECT m.*, a.name AS asset_name, a.brand, a.model, a.assigned_to_user_id,
            COALESCE(u.fullname, u.name, u.email) AS assigned_to_name,
            CASE
              WHEN m.status = 'completed' THEN 'completed'
              WHEN COALESCE(m.max_due_date, m.planned_date + INTERVAL '15 days') < CURRENT_DATE THEN 'overdue'
              ELSE 'pending'
            END AS computed_status
       FROM public.ti_asset_maintenance_schedule m
       JOIN public.ti_assets a ON a.id = m.asset_id
       LEFT JOIN public.users u ON u.id = a.assigned_to_user_id
       ${where}
      ORDER BY m.planned_date ASC`,
    params,
  );
  return rows.map((r) => ({
    ...r,
    status: r.computed_status || r.status,
    max_due_date: r.max_due_date || null,
    coordinated_withdrawal_date: r.coordinated_withdrawal_date || null,
    assigned_to_name: r.assigned_to_name || null,
  }));
}

async function clearAllMaintenanceSchedules({ userId }) {
  await ensureTiAssetsSchema();
  const { rowCount } = await db.query(`DELETE FROM public.ti_asset_maintenance_schedule`);
  await db.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     SELECT id, 'maintenance_schedule_cleared', $1::jsonb, $2, now()
     FROM public.ti_assets
     WHERE active = true`,
    [JSON.stringify({ deleted_rows: rowCount }), userId || null],
  );
  return { deleted_count: rowCount || 0 };
}

async function setMaintenanceCoordinationDate({ maintenanceId, coordinatedWithdrawalDate, userId }) {
  await ensureTiAssetsSchema();
  const id = Number(maintenanceId);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("maintenanceId invalido");
    err.status = 400;
    throw err;
  }
  const date = String(coordinatedWithdrawalDate || "").trim();
  if (!date) {
    const err = new Error("coordinated_withdrawal_date es obligatorio");
    err.status = 400;
    throw err;
  }
  const parsed = parseISODateUTC(date);
  if (!parsed) {
    const err = new Error("coordinated_withdrawal_date invalido");
    err.status = 400;
    throw err;
  }
  const safeDate = toISODateUTC(parsed);

  const { rows } = await db.query(
    `UPDATE public.ti_asset_maintenance_schedule
        SET coordinated_withdrawal_date = $1::date,
            updated_by = $2,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [safeDate, userId || null, id],
  );
  if (!rows.length) {
    const err = new Error("Mantenimiento TI no encontrado");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function createMaintenance({ assetId, plannedDate, notes = null, userId }) {
  await ensureTiAssetsSchema();
  const id = Number(assetId);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("assetId invalido");
    err.status = 400;
    throw err;
  }
  const date = String(plannedDate || "").trim();
  if (!date) {
    const err = new Error("planned_date es obligatorio");
    err.status = 400;
    throw err;
  }

  const planned = parseISODateUTC(date);
  if (!planned) {
    const err = new Error("planned_date invalido");
    err.status = 400;
    throw err;
  }
  const maxDueDate = toISODateUTC(addDaysUTC(planned, 15));

  const { rows: assetRows } = await db.query(
    `SELECT id, name FROM public.ti_assets WHERE id = $1 AND active = true LIMIT 1`,
    [id],
  );
  if (!assetRows.length) {
    const err = new Error("Activo TI no encontrado o inactivo");
    err.status = 404;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO public.ti_asset_maintenance_schedule
      (asset_id, year, planned_date, max_due_date, status, notes, created_by, updated_by, created_at, updated_at)
     VALUES ($1, EXTRACT(YEAR FROM $2::date)::int, $2::date, $3::date, 'pending', $4, $5, $5, now(), now())
     ON CONFLICT (asset_id, planned_date)
     DO UPDATE SET
       max_due_date = EXCLUDED.max_due_date,
       notes = COALESCE(EXCLUDED.notes, public.ti_asset_maintenance_schedule.notes),
       updated_by = EXCLUDED.updated_by,
       updated_at = now()
     RETURNING *`,
    [id, date, maxDueDate, notes, userId || null],
  );
  try {
    await notifyMaintenanceWindow({
      assetName: assetRows[0].name || `Activo ${id}`,
      plannedDate: toISODateUTC(planned),
      maxDueDate,
    });
  } catch (_err) {
    // notificacion no bloquea el alta
  }

  return rows[0];
}

async function completeMaintenance({ maintenanceId, notes = null, userId }) {
  await ensureTiAssetsSchema();
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const upd = await client.query(
      `UPDATE public.ti_asset_maintenance_schedule
          SET status = 'completed',
              completed_at = now(),
              notes = COALESCE($1, notes),
              updated_by = $2,
              updated_at = now()
        WHERE id = $3
        RETURNING *`,
      [notes, userId, maintenanceId],
    );
    if (!upd.rows.length) {
      const err = new Error("Mantenimiento TI no encontrado");
      err.status = 404;
      throw err;
    }
    await client.query(
      `UPDATE public.ti_assets
          SET last_maintenance_at = $1::date,
              updated_by = $2,
              updated_at = now()
        WHERE id = $3`,
      [upd.rows[0].planned_date, userId, upd.rows[0].asset_id],
    );
    await client.query(
      `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
       VALUES ($1,'maintenance_completed',$2::jsonb,$3,now())`,
      [upd.rows[0].asset_id, JSON.stringify({ maintenance_id: maintenanceId, planned_date: upd.rows[0].planned_date, notes }), userId],
    );
    await client.query("COMMIT");
    return upd.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function requestAssignedDeliveryForMaintenance({ maintenanceId, userId }) {
  await ensureTiAssetsSchema();
  const id = Number(maintenanceId);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("maintenanceId invalido");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `SELECT m.id, m.planned_date, m.max_due_date, m.status,
            a.id AS asset_id, a.name AS asset_name, a.assigned_to_user_id
       FROM public.ti_asset_maintenance_schedule m
       JOIN public.ti_assets a ON a.id = m.asset_id
      WHERE m.id = $1
      LIMIT 1`,
    [id],
  );
  if (!rows.length) {
    const err = new Error("Mantenimiento TI no encontrado");
    err.status = 404;
    throw err;
  }

  const row = rows[0];
  if (row.status === "completed") {
    const err = new Error("El mantenimiento ya fue completado");
    err.status = 400;
    throw err;
  }
  if (!row.assigned_to_user_id) {
    const err = new Error("El equipo no tiene usuario asignado");
    err.status = 400;
    throw err;
  }

  const planned = parseISODateUTC(row.planned_date);
  if (!planned) {
    const err = new Error("planned_date invalido");
    err.status = 400;
    throw err;
  }

  const deliveryFrom = nextBusinessDayUTC(planned);
  const deliveryTo = addBusinessDaysUTC(deliveryFrom, 14);
  const deliveryFromISO = toISODateUTC(deliveryFrom);
  const deliveryToISO = toISODateUTC(deliveryTo);

  await notificationManager.sendNotification({
    userId: Number(row.assigned_to_user_id),
    template: "maintenance_due",
    customTitle: "Entrega de equipo para mantenimiento",
    customMessage: `Debes entregar el equipo ${row.asset_name || `Activo ${row.asset_id}`} desde el ${deliveryFromISO} hasta el ${deliveryToISO} para mantenimiento TI.`,
    type: "alert",
    priority: 1,
    source: "ti_assets.maintenance_delivery_request",
    data: {
      maintenance_id: row.id,
      asset_id: row.asset_id,
      equipment_name: row.asset_name || `Activo ${row.asset_id}`,
      delivery_from_date: deliveryFromISO,
      delivery_to_date: deliveryToISO,
      planned_date: String(row.planned_date || "").slice(0, 10),
      max_due_date: row.max_due_date ? String(row.max_due_date).slice(0, 10) : null,
      business_days: 15,
      country: "EC",
    },
    email: true,
    chat: false,
  });

  await db.query(
    `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
     VALUES ($1,'maintenance_delivery_requested',$2::jsonb,$3,now())`,
    [
      row.asset_id,
      JSON.stringify({
        maintenance_id: row.id,
        assigned_to_user_id: row.assigned_to_user_id,
        delivery_from_date: deliveryFromISO,
        delivery_to_date: deliveryToISO,
      }),
      userId || null,
    ],
  );

  return {
    maintenance_id: row.id,
    asset_id: row.asset_id,
    assigned_to_user_id: Number(row.assigned_to_user_id),
    delivery_from_date: deliveryFromISO,
    delivery_to_date: deliveryToISO,
    business_days: 15,
  };
}

// ─── Accessories ──────────────────────────────────────────────────────────────

async function listAccessories(assetId) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `SELECT * FROM public.ti_asset_accessories
      WHERE asset_id = $1 AND active = true
      ORDER BY created_at ASC`,
    [assetId],
  );
  return rows;
}

async function createAccessory({ assetId, data, userId }) {
  await ensureTiAssetsSchema();
  const { name, brand, model, serial_number, imei, is_new, physical_condition, observations, numero_corporativo } = data || {};
  if (!name || !String(name).trim()) {
    const err = new Error("name es obligatorio");
    err.status = 400;
    throw err;
  }
  const { rows } = await db.query(
    `INSERT INTO public.ti_asset_accessories
       (asset_id, name, brand, model, serial_number, imei, is_new, physical_condition, observations, numero_corporativo, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
     RETURNING *`,
    [
      assetId,
      String(name).trim(),
      brand || null,
      model || null,
      serial_number || null,
      imei || null,
      Boolean(is_new),
      physical_condition != null ? Number(physical_condition) : null,
      observations || null,
      numero_corporativo || null,
      userId,
    ],
  );
  return rows[0];
}

async function updateAccessory({ accessoryId, data, userId }) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `UPDATE public.ti_asset_accessories
        SET name                = COALESCE($1, name),
            brand               = COALESCE($2, brand),
            model               = COALESCE($3, model),
            serial_number       = COALESCE($4, serial_number),
            imei                = COALESCE($5, imei),
            is_new              = COALESCE($6, is_new),
            physical_condition  = COALESCE($7, physical_condition),
            observations        = COALESCE($8, observations),
            numero_corporativo  = COALESCE($9, numero_corporativo),
            updated_by          = $10,
            updated_at          = now()
      WHERE id = $11 AND active = true
      RETURNING *`,
    [
      data?.name ?? null,
      data?.brand ?? null,
      data?.model ?? null,
      data?.serial_number ?? null,
      data?.imei ?? null,
      data?.is_new != null ? Boolean(data.is_new) : null,
      data?.physical_condition != null ? Number(data.physical_condition) : null,
      data?.observations ?? null,
      data?.numero_corporativo ?? null,
      userId,
      accessoryId,
    ],
  );
  if (!rows.length) {
    const err = new Error("Accesorio no encontrado");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function removeAccessory({ accessoryId, userId }) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `UPDATE public.ti_asset_accessories
        SET active = false, updated_by = $1, updated_at = now()
      WHERE id = $2 AND active = true
      RETURNING id`,
    [userId, accessoryId],
  );
  if (!rows.length) {
    const err = new Error("Accesorio no encontrado");
    err.status = 404;
    throw err;
  }
  return { deleted: true, id: rows[0].id };
}

// ─── Actas ────────────────────────────────────────────────────────────────────

async function generateActaCode(tipo = 'entrega', qc = db) {
  const year = new Date().getFullYear();
  const { rows } = await qc.query(`SELECT nextval('public.ti_acta_seq') AS seq`);
  const seq = String(rows[0].seq).padStart(6, '0');
  const prefix = tipo === 'retiro' ? `ACTA-D-ET-${year}` : `ACTA-ET-${year}`;
  return `${prefix}-${seq}`;
}

async function createActa({ tipo, assetId, recipientUserId, previousUserId, recipientNombre, recipientCedula, recipientCargo, generatedBy, notes, items, client: txClient }) {
  const qc = txClient || db;
  const actaCode = await generateActaCode(tipo, qc);

  // Capture current date (immutable once created)
  const now = new Date();
  const actaDay = now.getDate();
  const actaMonth = now.getMonth() + 1;
  const actaYear = now.getFullYear();

  // If items array provided, use first item's asset_id; otherwise use assetId param (supports legacy single-asset flow)
  const mainAssetId = items && items.length && items[0].asset_id ? items[0].asset_id : (assetId || null);

  const { rows } = await qc.query(
    `INSERT INTO public.ti_asset_actas
       (acta_code, tipo, asset_id, recipient_user_id, previous_user_id,
        recipient_nombre, recipient_cedula, recipient_cargo,
        acta_day, acta_month, acta_year,
        generated_by, notes, generated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
     RETURNING *`,
    [actaCode, tipo, mainAssetId, recipientUserId || null, previousUserId || null,
     recipientNombre || null, recipientCedula || null, recipientCargo || null,
     actaDay, actaMonth, actaYear,
     generatedBy || null, notes || null],
  );
  const acta = rows[0];

  if (items && items.length) {
    for (const [i, item] of items.entries()) {
      await qc.query(
        `INSERT INTO public.ti_asset_actas_items
           (acta_id, order_num, item_type, asset_id, accessory_id,
            name, brand_model, serial_imei, is_new, physical_condition, observations)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          acta.id, i + 1, item.item_type || "equipo",
          item.asset_id || null, item.accessory_id || null,
          item.name || "", item.brand_model || null, item.serial_imei || null,
          item.is_new != null ? Boolean(item.is_new) : null,
          item.physical_condition != null ? Number(item.physical_condition) : null,
          item.observations || null,
        ],
      );
    }
  }

  return acta;
}

async function updateActaPdf({ actaId, filename, sha256, driveUrl, driveFileId }) {
  await db.query(
    `UPDATE public.ti_asset_actas
        SET pdf_filename = $1, pdf_sha256 = $2, pdf_drive_url = $3, pdf_drive_file_id = $4
      WHERE id = $5`,
    [filename, sha256, driveUrl || null, driveFileId || null, actaId],
  );
}

async function listAllActas({ limit = 100, offset = 0, tipo = null, is_complete = null }) {
  await ensureTiAssetsSchema();
  const params = [];
  const where  = ["a.active = true"];
  if (tipo) {
    params.push(String(tipo).toLowerCase());
    where.push(`a.tipo = $${params.length}`);
  }
  if (is_complete !== null) {
    params.push(Boolean(is_complete));
    where.push(`a.is_complete = $${params.length}`);
  }
  params.push(Number(limit));
  params.push(Number(offset));
  const { rows } = await db.query(
    `SELECT a.*,
            COALESCE(ub.fullname, ub.name, ub.email) AS generated_by_name,
            ta.name       AS asset_name,
            ta.asset_code AS asset_code,
            COALESCE(
              a.recipient_nombre,
              ur.fullname,  ur.name,  ur.email,
              up.fullname,  up.name,  up.email
            ) AS collaborator_name
       FROM public.ti_asset_actas a
       LEFT JOIN public.users    ub ON ub.id = a.generated_by
       LEFT JOIN public.ti_assets ta ON ta.id = a.asset_id
       LEFT JOIN public.users    ur ON ur.id = a.recipient_user_id
       LEFT JOIN public.users    up ON up.id = a.previous_user_id
      WHERE ${where.join(" AND ")}
      ORDER BY a.generated_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

async function listActas({ assetId, limit = 50 }) {
  await ensureTiAssetsSchema();
  // Find actas where this asset is EITHER the main asset_id OR appears in any acta_items row
  const { rows } = await db.query(
    `SELECT DISTINCT a.*,
            COALESCE(u.fullname, u.name, u.email) AS generated_by_name
       FROM public.ti_asset_actas a
       LEFT JOIN public.ti_asset_actas_items ai ON ai.acta_id = a.id
       LEFT JOIN public.users u ON u.id = a.generated_by
      WHERE (a.asset_id = $1 OR ai.asset_id = $1) AND a.active = true
      ORDER BY a.generated_at DESC
      LIMIT $2`,
    [assetId, limit],
  );
  return rows;
}

async function getActaWithItems(actaId) {
  await ensureTiAssetsSchema();
  const { rows: actaRows } = await db.query(
    `SELECT a.*, COALESCE(u.fullname, u.name, u.email) AS generated_by_name
       FROM public.ti_asset_actas a
       LEFT JOIN public.users u ON u.id = a.generated_by
      WHERE a.id = $1 LIMIT 1`,
    [actaId],
  );
  if (!actaRows.length) {
    const err = new Error("Acta no encontrada");
    err.status = 404;
    throw err;
  }
  const { rows: items } = await db.query(
    `SELECT * FROM public.ti_asset_actas_items WHERE acta_id = $1 ORDER BY order_num ASC`,
    [actaId],
  );
  return { ...actaRows[0], items };
}

async function updateActa({ actaId, data = {}, userId }) {
  await ensureTiAssetsSchema();
  const normalizedActaId = Number(actaId);
  if (!Number.isFinite(normalizedActaId) || normalizedActaId <= 0) {
    const err = new Error("actaId invalido");
    err.status = 400;
    throw err;
  }

  const itemsProvided = Array.isArray(data.items);
  const items = itemsProvided ? data.items : [];
  if (itemsProvided && !items.length) {
    const err = new Error("El acta debe incluir al menos un item");
    err.status = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: actaRows } = await client.query(
      `SELECT *
         FROM public.ti_asset_actas
        WHERE id = $1
        LIMIT 1`,
      [normalizedActaId],
    );
    if (!actaRows.length) {
      const err = new Error("Acta no encontrada");
      err.status = 404;
      throw err;
    }

    const acta = actaRows[0];
    if (acta.is_complete || acta.signed_at || acta.signed_pdf_drive_file_id || acta.signed_pdf_sha256) {
      const err = new Error("El acta ya fue firmada y no puede editarse");
      err.status = 409;
      throw err;
    }

    const targetRecipientNombre = data.recipient_nombre !== undefined ? String(data.recipient_nombre || "").trim() : (acta.recipient_nombre || "");
    const targetRecipientCedula = data.recipient_cedula !== undefined ? String(data.recipient_cedula || "").trim() : (acta.recipient_cedula || "");
    const targetRecipientCargo = data.recipient_cargo !== undefined ? String(data.recipient_cargo || "").trim() : (acta.recipient_cargo || "");
    if (!targetRecipientNombre || !targetRecipientCedula || !targetRecipientCargo) {
      const err = new Error("Nombre, cédula y cargo son obligatorios para editar el acta");
      err.status = 400;
      throw err;
    }

    let sanitizedItems = [];
    if (itemsProvided) {
      sanitizedItems = items.map((item, index) => ({
        order_num: index + 1,
        item_type: item.item_type || "equipo",
        asset_id: item.asset_id != null && String(item.asset_id).trim() !== "" ? Number(item.asset_id) : null,
        accessory_id: item.accessory_id != null && String(item.accessory_id).trim() !== "" ? Number(item.accessory_id) : null,
        name: String(item.name || "").trim(),
        brand_model: item.brand_model != null ? String(item.brand_model || "").trim() || null : null,
        serial_imei: item.serial_imei != null ? String(item.serial_imei || "").trim() || null : null,
        is_new: item.is_new === null || item.is_new === undefined || item.is_new === "" ? null : Boolean(item.is_new),
        physical_condition: item.physical_condition === null || item.physical_condition === undefined || item.physical_condition === ""
          ? null
          : Number(item.physical_condition),
        observations: item.observations != null ? String(item.observations || "").trim() || null : null,
      }));

      if (sanitizedItems.some((item) => !item.name)) {
        const err = new Error("Todos los items del acta deben tener nombre");
        err.status = 400;
        throw err;
      }
    }

    const mainAssetId = (itemsProvided ? sanitizedItems.find((item) => item.asset_id)?.asset_id : null) || acta.asset_id || null;
    const nextNotes = data.notes !== undefined ? (String(data.notes || "").trim() || null) : acta.notes;

    // Si había un workflow en progreso, cancelarlo antes de editar el acta
    if (acta.signature_workflow_id) {
      try {
        await signatureWorkflowsService.cancelWorkflow(Number(acta.signature_workflow_id), { id: userId, role: "admin" });
      } catch (cancelErr) {
        logger.warn({ cancelErr, workflowId: acta.signature_workflow_id }, "ti: no se pudo cancelar el workflow al editar el acta (puede estar ya cancelado)");
      }
    }

    await client.query(
      `UPDATE public.ti_asset_actas
          SET asset_id = $2,
              recipient_nombre = $3,
              recipient_cedula = $4,
              recipient_cargo = $5,
              notes = $6,
              pdf_drive_file_id = NULL,
              pdf_sha256 = NULL,
              pdf_filename = NULL,
              pdf_drive_url = NULL,
              signature_workflow_id = NULL,
              signature_workflow_status = NULL,
              final_verification_token = NULL
        WHERE id = $1`,
      [normalizedActaId, mainAssetId, targetRecipientNombre, targetRecipientCedula, targetRecipientCargo, nextNotes],
    );

    if (itemsProvided) {
      await client.query(
        `DELETE FROM public.ti_asset_actas_items WHERE acta_id = $1`,
        [normalizedActaId],
      );

      for (const item of sanitizedItems) {
        await client.query(
          `INSERT INTO public.ti_asset_actas_items
             (acta_id, order_num, item_type, asset_id, accessory_id,
              name, brand_model, serial_imei, is_new, physical_condition, observations)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            normalizedActaId,
            item.order_num,
            item.item_type,
            item.asset_id,
            item.accessory_id,
            item.name,
            item.brand_model,
            item.serial_imei,
            item.is_new,
            item.physical_condition,
            item.observations,
          ],
        );
      }
    }

    await client.query(
      `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
       VALUES ($1, $2, $3::jsonb, $4, now())`,
      [
        mainAssetId,
        "acta_updated",
        JSON.stringify({ acta_id: normalizedActaId }),
        userId || null,
      ],
    );

    await client.query("COMMIT");
    return getActaWithItems(normalizedActaId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ─── Upload signed acta ───────────────────────────────────────────────────────

async function resolveSignedActaFolder(userIdentity) {
  const base =
    process.env.DRIVE_PROFILE_FOLDER_ID ||
    process.env.DRIVE_DOCS_FOLDER_ID ||
    process.env.DRIVE_ROOT_FOLDER_ID ||
    process.env.DRIVE_FOLDER_ID;
  if (!base) return null;
  const usersRoot  = await ensureFolder("Usuarios", base);
  const userFolder = await ensureFolder(
    userIdentity?.email || userIdentity?.fullname || `user-${userIdentity?.id || "na"}`,
    usersRoot.id,
  );
  const docsFolder  = await ensureFolder("Documentos", userFolder.id);
  const actasFolder = await ensureFolder("Actas TI", docsFolder.id);
  return actasFolder.id;
}

async function uploadSignedActa({ actaId, fileBuffer, originalFilename, userId }) {
  await ensureTiAssetsSchema();
  const id = Number(actaId);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("actaId invalido"); err.status = 400; throw err;
  }
  const acta = await getActaWithItems(id);

  const sha256    = computeSha256HexFromBuffer(fileBuffer);
  const tipo      = acta.tipo === "entrega" ? "ET" : "RT";
  const filename  = `ACTA-${tipo}-${String(id).padStart(6, "0")}-FIRMADA.pdf`;

  let driveUrl = null;
  let driveFileId = null;

  try {
    // Resolve recipient user identity for Drive folder
    const recipientId = acta.tipo === "entrega"
      ? acta.recipient_user_id
      : acta.previous_user_id;

    let userIdentity = { id: recipientId };
    if (recipientId) {
      const { rows } = await db.query(
        `SELECT id, email, COALESCE(fullname, name, email) AS fullname
           FROM public.users WHERE id = $1 LIMIT 1`,
        [recipientId],
      );
      if (rows.length) userIdentity = rows[0];
    }

    const folderId = await resolveSignedActaFolder(userIdentity);
    if (folderId) {
      const uploaded = await uploadBase64File(
        filename,
        fileBuffer.toString("base64"),
        "application/pdf",
        folderId,
      );
      driveUrl    = uploaded?.webViewLink || uploaded?.webContentLink || null;
      driveFileId = uploaded?.id || null;
    }
  } catch (_driveErr) { /* Drive opcional */ }

  await db.query(
    `UPDATE public.ti_asset_actas
        SET signed_pdf_drive_file_id = $1,
            signed_pdf_drive_url     = $2,
            signed_pdf_sha256        = $3,
            signed_pdf_filename      = $4,
            signed_at                = now(),
            signed_by                = $5,
            is_complete              = true
      WHERE id = $6`,
    [driveFileId, driveUrl, sha256, filename, userId || null, id],
  );

  // ── Checklist integration (internal, no HTTP) ─────────────────────────────
  try {
    const targetUserId = acta.tipo === "entrega"
      ? acta.recipient_user_id
      : acta.previous_user_id;

    if (targetUserId) {
      const flags = acta.tipo === "entrega"
        ? { computadora_entregada: true }
        : { acta_descargo_herramientas: true, acta_entrega_equipos_comunicacion: true };

      await upsertCollaboratorProfile(
        targetUserId,
        { onboarding: flags },
        userId || null,
      );
    }
  } catch (_checklistErr) { /* No bloquea si falla la actualizacion del checklist */ }

  return { ok: true, sha256, filename, drive_url: driveUrl };
}

function _trimLastSurname(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/);
  return parts.length >= 3 ? parts.slice(0, -1).join(" ") : String(fullName).trim();
}

function buildTiActaTemplateReplacements(acta) {
  const actaDay = acta.acta_day || new Date().getDate();
  const actaMonth = acta.acta_month || (new Date().getMonth() + 1);
  const actaYear = acta.acta_year || new Date().getFullYear();
  return {
    ACTA_CODE: (String(acta.acta_code || "").match(/(\d+)$/) || [])[1] || acta.acta_code || "",
    NOMBRE: acta.recipient_nombre || "",
    NOMBRE_C: _trimLastSurname(acta.recipient_nombre),
    CEDULA: acta.recipient_cedula || "",
    CARGO: acta.recipient_cargo || "",
    ACTA_DIA: String(actaDay).padStart(2, "0"),
    ACTA_MES: getMonthNameEs(actaMonth),
    ACTA_ANIO: String(actaYear),
    ACTA_FECHA_LARGA: `${String(actaDay).padStart(2, "0")} de ${getMonthNameEs(actaMonth)} de ${actaYear}`,
    ITEMS_COUNT: String(Array.isArray(acta.items) ? acta.items.length : 0),
    ITEMS_BLOCK: buildTiActaItemsBlock(acta.items || []),
    NOTES: acta.notes || "",
  };
}


async function buildDriveTemplateActaPdfBuffer(acta) {
  if (!acta) return null;
  const templateId = acta.tipo === "retiro"
    ? TI_ACTA_RETIRO_TEMPLATE_ID
    : TI_ACTA_ENTREGA_TEMPLATE_ID;
  if (!templateId) {
    const err = new Error(`No hay plantilla Google Docs configurada para acta TI tipo "${acta.tipo}"`);
    err.status = 503;
    throw err;
  }

  const filename = acta.acta_code ? `${acta.acta_code}.pdf` : `ACTA-${String(acta.id).padStart(6, "0")}.pdf`;
  const sourceName = filename.replace(/\.pdf$/i, "");
  const folderId = await resolveDraftActaFolder();
  let doc = null;

  try {
    doc = await copyTemplate(templateId, sourceName, folderId || undefined);
    const usedTable = await insertDocsTableRows(doc.id, 0, acta.items || [], _tiActaCellValues);
    const replacements = buildTiActaTemplateReplacements(acta);
    if (usedTable) delete replacements.ITEMS_BLOCK;
    await replaceTags(doc.id, replacements);
    return {
      pdfBuffer: await exportPdfBuffer(doc.id),
      mode: "drive_template",
    };
  } finally {
    if (doc?.id) {
      try {
        await deleteFile(doc.id);
      } catch (err) {
        logger.warn({ err, documentId: doc.id, actaId: acta.id }, "ti: no se pudo eliminar el documento temporal del acta");
      }
    }
  }
}

async function buildActaPdfBuffer(acta, { preferStored = false } = {}) {
  if (!acta) return null;

  if (preferStored && acta.pdf_drive_file_id) {
    try {
      return {
        pdfBuffer: await downloadFileBuffer(acta.pdf_drive_file_id),
        mode: "stored_drive_pdf",
      };
    } catch (err) {
      logger.warn({ err, actaId: acta.id, driveFileId: acta.pdf_drive_file_id }, "ti: no se pudo descargar el PDF persistido del acta");
    }
  }

  return buildDriveTemplateActaPdfBuffer(acta);
}

async function getActaPdfDownload(actaId, { preferStored = true } = {}) {
  const acta = await getActaWithItems(actaId);
  const result = await buildActaPdfBuffer(acta, { preferStored });
  const pdfBuffer = result?.pdfBuffer || null;
  if (!pdfBuffer) {
    const error = new Error("No se pudo construir el PDF del acta TI");
    error.status = 503;
    throw error;
  }

  return {
    acta,
    mode: result?.mode || null,
    filename: acta.pdf_filename || (acta.acta_code ? `${acta.acta_code}.pdf` : `ACTA-${String(acta.id).padStart(6, "0")}.pdf`),
    pdfBuffer,
  };
}

async function generateAndStoreActaPdf(actaId) {
  const { acta, pdfBuffer, mode, filename } = await getActaPdfDownload(actaId, { preferStored: false });
  const sha256 = computeSha256HexFromBuffer(pdfBuffer);

  let driveUrl = null;
  let driveFileId = null;
  try {
    const folderId = await resolveDraftActaFolder();
    if (folderId) {
      const uploaded = await uploadBase64File(
        filename,
        pdfBuffer.toString("base64"),
        "application/pdf",
        folderId,
      );
      driveUrl = uploaded?.webViewLink || uploaded?.webContentLink || null;
      driveFileId = uploaded?.id || null;
    }
  } catch (err) {
    logger.warn({ err, actaId }, "ti: no se pudo subir PDF borrador del acta a Drive");
  }

  await updateActaPdf({ actaId: acta.id, filename, sha256, driveUrl, driveFileId });
  return { actaId: acta.id, generated: true, filename, sha256, driveUrl, driveFileId, mode };
}

function queueTiActaPdfGeneration(actaId) {
  if (!actaId) return;
  setImmediate(async () => {
    try {
      await generateAndStoreActaPdf(actaId);
    } catch (err) {
      logger.error({ err, actaId }, "ti: fallo la generacion asincrona del PDF de acta");
    }
  });
}

async function startSignatureWorkflowForActa({ actaId, signers = [], actorUser }) {
  const acta = await getActaWithItems(actaId);
  if (acta.signature_workflow_id) {
    return signatureWorkflowsService.getWorkflow(Number(acta.signature_workflow_id), actorUser);
  }

  const { pdfBuffer } = await getActaPdfDownload(actaId, { preferStored: true });
  const payload = validateCreateWorkflowPayload({
    source_module: "ti-assets",
    source_entity: "acta",
    source_entity_id: Number(acta.id),
    document_type: `ti_asset_acta_${String(acta.tipo || "entrega").toLowerCase()}`,
    title: `Acta ${acta.acta_code || `#${acta.id}`} - ${acta.tipo === "retiro" ? "Retiro" : "Entrega"} de activos TI`,
    description: acta.notes || null,
    document: {
      filename: `${acta.acta_code || `ACTA-${String(acta.id).padStart(6, "0")}`}.pdf`,
      pdf_base64: Buffer.from(pdfBuffer).toString("base64"),
      source_sha256: computeSha256HexFromBuffer(pdfBuffer),
    },
    signers,
    meta: {
      source_table: "ti_asset_actas",
      acta_tipo: acta.tipo || null,
      acta_code: acta.acta_code || null,
    },
  });

  const prepared = await signatureWorkflowsService.createWorkflow({ payload, user: actorUser });
  await db.query(
    `UPDATE public.ti_asset_actas
        SET signature_workflow_id = $1,
            signature_workflow_status = $2,
            final_verification_token = $3
      WHERE id = $4`,
    [
      prepared.workflow.id,
      prepared.workflow.status,
      prepared.workflow.verification_token || null,
      acta.id,
    ],
  );

  return signatureWorkflowsService.sendWorkflow(Number(prepared.workflow.id), actorUser);
}

async function getActaSignatureWorkflow(actaId, actorUser) {
  const acta = await getActaWithItems(actaId);
  if (!acta.signature_workflow_id) return null;
  return signatureWorkflowsService.getWorkflow(Number(acta.signature_workflow_id), actorUser);
}

// ─── PDF Reports (on-demand, not stored) ──────────────────────────────────────

async function generateAssetPdfReport(assetId) {
  const PDFDocument = require("pdfkit");

  const { rows: assetRows } = await db.query(
    `SELECT a.*,
            COALESCE(u.fullname, u.name, u.email) AS assigned_to_name
       FROM public.ti_assets a
       LEFT JOIN public.users u ON u.id = a.assigned_to_user_id
      WHERE a.id = $1 LIMIT 1`,
    [assetId],
  );
  if (!assetRows.length) { const e = new Error("Activo no encontrado"); e.status = 404; throw e; }
  const asset = assetRows[0];

  const { rows: assignments } = await db.query(
    `SELECT aa.*,
            COALESCE(u1.fullname, u1.name, u1.email) AS assigned_to_name,
            COALESCE(u2.fullname, u2.name, u2.email) AS previous_user_name,
            COALESCE(u3.fullname, u3.name, u3.email) AS created_by_name
       FROM public.ti_asset_assignments aa
       LEFT JOIN public.users u1 ON u1.id = aa.assigned_to_user_id
       LEFT JOIN public.users u2 ON u2.id = aa.previous_user_id
       LEFT JOIN public.users u3 ON u3.id = aa.created_by
      WHERE aa.asset_id = $1 ORDER BY aa.created_at DESC`,
    [assetId],
  );

  const { rows: actas } = await db.query(
    `SELECT * FROM public.ti_asset_actas WHERE asset_id = $1 AND active = true ORDER BY generated_at DESC`,
    [assetId],
  );

  const depData = computeDepreciation(asset.purchase_date);

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = 515;

    // Header
    doc.rect(40, 40, W, 60).fill("#1E293B");
    doc.fillColor("#fff").fontSize(14).font("Helvetica-Bold").text("Reporte de Activo TI", 50, 52, { width: W - 10 });
    doc.fontSize(9).font("Helvetica").fillColor("#94a3b8")
       .text(`${asset.name}  ·  Código: ${asset.asset_code || "-"}`, 50, 72);
    doc.fillColor("#0f172a").moveDown(2.5);

    // Info block
    const infoRows = [
      ["Marca / Modelo",     `${asset.brand || "-"} ${asset.model || "-"}`],
      ["N° de serie",        asset.serial_number || "-"],
      ["IMEI",               asset.imei || "-"],
      ["Fecha de compra",    asset.purchase_date ? String(asset.purchase_date).slice(0, 10) : "-"],
      ["Estado",             asset.status || "-"],
      ["Asignado a",         asset.assigned_to_name || "Sin asignación"],
      ["Depreciación",       depData.depreciation_pct != null ? `${depData.depreciation_pct}% (residual ${depData.residual_pct}%)` : "-"],
      ["Frec. mant.",        `${asset.maintenance_frequency_months || 12} meses`],
    ];
    infoRows.forEach(([lbl, val], i) => {
      const y = doc.y;
      if (i % 2 === 1) doc.rect(40, y, W, 16).fill("#f8fafc");
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#334155").text(lbl, 46, y + 3, { width: 130 });
      doc.fontSize(8).font("Helvetica").fillColor("#1f2937").text(val, 180, y + 3, { width: W - 140 });
      doc.y = y + 16;
    });

    doc.moveDown(1);

    // Assignment history
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text("Historial de asignaciones");
    doc.rect(40, doc.y + 2, W, 16).fill("#e2e8f0");
    const hdrY = doc.y + 4;
    ["Fecha", "Acción", "Asignado a", "Anterior", "Motivo"].forEach((h, i) => {
      const xs = [42, 110, 200, 310, 400];
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#334155").text(h, xs[i], hdrY, { width: 85 });
    });
    doc.y = hdrY + 12;

    assignments.forEach((a, idx) => {
      if (doc.y > 720) doc.addPage();
      const ry = doc.y;
      if (idx % 2 === 1) doc.rect(40, ry, W, 14).fill("#f8fafc");
      const vals = [
        String(a.created_at || "").slice(0, 10),
        a.action === "unassign" ? "Retiro" : "Entrega",
        a.assigned_to_name || "-",
        a.previous_user_name || "-",
        String(a.reason || "-").slice(0, 25),
      ];
      vals.forEach((v, i) => {
        const xs = [42, 110, 200, 310, 400];
        doc.fontSize(7).font("Helvetica").fillColor("#334155").text(v, xs[i], ry + 2, { width: 85, lineBreak: false, ellipsis: true });
      });
      doc.y = ry + 14;
    });

    doc.moveDown(1);

    // Actas
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text("Actas generadas");
    actas.forEach((acta) => {
      if (doc.y > 720) doc.addPage();
      const ay = doc.y;
      doc.rect(40, ay, W, 20).fill(acta.tipo === "entrega" ? "#dbeafe" : "#fef3c7");
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#1e293b")
         .text(`${acta.tipo.toUpperCase()} #${String(acta.id).padStart(6, "0")}`, 46, ay + 4, { width: 120 });
      doc.fontSize(8).font("Helvetica").fillColor("#334155")
         .text(`${acta.recipient_nombre || "-"} · ${acta.recipient_cargo || "-"}`, 170, ay + 4, { width: 200 });
      doc.fillColor(acta.is_complete ? "#16a34a" : "#d97706")
         .text(acta.is_complete ? "FIRMADA" : "PENDIENTE FIRMA", 380, ay + 4, { width: 100 });
      doc.y = ay + 24;
    });

    const pCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor("#94a3b8").font("Helvetica")
         .text(`Página ${i + 1} de ${pCount}  ·  FAM SPI Activos TI`, 40, 820, { width: W, align: "center" });
    }
    doc.end();
  });
}

async function generateCollaboratorPdfReport(collaboratorUserId) {
  const PDFDocument = require("pdfkit");

  const { rows: userRows } = await db.query(
    `SELECT id, email, COALESCE(fullname, name, email) AS fullname, role
       FROM public.users WHERE id = $1 LIMIT 1`,
    [collaboratorUserId],
  );
  if (!userRows.length) { const e = new Error("Usuario no encontrado"); e.status = 404; throw e; }
  const collab = userRows[0];

  // All assets currently assigned
  const { rows: currentAssets } = await db.query(
    `SELECT a.*, COALESCE(u.fullname, u.name, u.email) AS assigned_to_name
       FROM public.ti_assets a
       LEFT JOIN public.users u ON u.id = a.assigned_to_user_id
      WHERE a.assigned_to_user_id = $1 AND a.active = true ORDER BY a.name`,
    [collaboratorUserId],
  );

  // Historical assignments (all assets ever assigned)
  const { rows: history } = await db.query(
    `SELECT aa.*,
            b.name AS asset_name, b.brand, b.model, b.serial_number,
            COALESCE(u1.fullname, u1.name, u1.email) AS assigned_to_name,
            COALESCE(u2.fullname, u2.name, u2.email) AS created_by_name
       FROM public.ti_asset_assignments aa
       JOIN public.ti_assets b ON b.id = aa.asset_id
       LEFT JOIN public.users u1 ON u1.id = aa.assigned_to_user_id
       LEFT JOIN public.users u2 ON u2.id = aa.created_by
      WHERE aa.assigned_to_user_id = $1 OR aa.previous_user_id = $1
      ORDER BY aa.created_at DESC`,
    [collaboratorUserId],
  );

  // Actas
  const { rows: actas } = await db.query(
    `SELECT * FROM public.ti_asset_actas
      WHERE (recipient_user_id = $1 OR previous_user_id = $1) AND active = true
      ORDER BY generated_at DESC`,
    [collaboratorUserId],
  );

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = 515;

    // Header
    doc.rect(40, 40, W, 60).fill("#1E293B");
    doc.fillColor("#fff").fontSize(14).font("Helvetica-Bold").text("Reporte de Colaborador - Activos TI", 50, 52, { width: W - 10 });
    doc.fontSize(9).font("Helvetica").fillColor("#94a3b8").text(`${collab.fullname}  ·  ${collab.email}`, 50, 72);
    doc.fillColor("#0f172a").moveDown(2.5);

    // Current assets
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text("Activos actualmente asignados");
    if (!currentAssets.length) {
      doc.fontSize(9).font("Helvetica").fillColor("#94a3b8").text("Sin activos asignados actualmente").moveDown(0.5);
    } else {
      currentAssets.forEach((a, idx) => {
        if (doc.y > 720) doc.addPage();
        const dep = computeDepreciation(a.purchase_date);
        const ay = doc.y;
        if (idx % 2 === 1) doc.rect(40, ay, W, 18).fill("#f8fafc");
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#1e293b").text(a.name, 46, ay + 3, { width: 160 });
        doc.fontSize(8).font("Helvetica").fillColor("#334155")
           .text(`${a.brand || "-"} ${a.model || ""}`, 210, ay + 3, { width: 120 });
        doc.text(a.serial_number || "-", 335, ay + 3, { width: 90 });
        doc.text(dep.depreciation_pct != null ? `${dep.depreciation_pct}% dep.` : "-", 430, ay + 3, { width: 80 });
        doc.y = ay + 18;
      });
    }

    doc.moveDown(1);

    // History
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text("Historial de movimientos");
    const cols = [42, 110, 200, 310, 400];
    const hdrs = ["Fecha", "Acción", "Equipo", "Asignado a", "Realizado por"];
    doc.rect(40, doc.y + 2, W, 16).fill("#e2e8f0");
    const hY = doc.y + 4;
    hdrs.forEach((h, i) => doc.fontSize(7).font("Helvetica-Bold").fillColor("#334155").text(h, cols[i], hY, { width: 85 }));
    doc.y = hY + 12;

    history.forEach((h, idx) => {
      if (doc.y > 720) doc.addPage();
      const ry = doc.y;
      if (idx % 2 === 1) doc.rect(40, ry, W, 14).fill("#f8fafc");
      [
        String(h.created_at || "").slice(0, 10),
        h.action === "unassign" ? "Retiro" : "Entrega",
        String(h.asset_name || "-").slice(0, 18),
        String(h.assigned_to_name || "-").slice(0, 18),
        String(h.created_by_name || "-").slice(0, 18),
      ].forEach((v, i) => {
        doc.fontSize(7).font("Helvetica").fillColor("#334155").text(v, cols[i], ry + 2, { width: 85, lineBreak: false, ellipsis: true });
      });
      doc.y = ry + 14;
    });

    doc.moveDown(1);

    // Actas
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text("Actas generadas");
    actas.forEach((acta) => {
      if (doc.y > 720) doc.addPage();
      const ay = doc.y;
      doc.rect(40, ay, W, 20).fill(acta.tipo === "entrega" ? "#dbeafe" : "#fef3c7");
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#1e293b")
         .text(`${acta.tipo.toUpperCase()} #${String(acta.id).padStart(6, "0")}`, 46, ay + 4, { width: 120 });
      doc.fontSize(8).font("Helvetica").fillColor("#334155")
         .text(String(acta.generated_at || "").slice(0, 10), 170, ay + 4, { width: 100 });
      doc.fillColor(acta.is_complete ? "#16a34a" : "#d97706")
         .text(acta.is_complete ? "FIRMADA" : "PENDIENTE FIRMA", 380, ay + 4, { width: 100 });
      doc.y = ay + 24;
    });

    const pCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor("#94a3b8").font("Helvetica")
         .text(`Página ${i + 1} de ${pCount}  ·  FAM SPI Activos TI`, 40, 820, { width: W, align: "center" });
    }
    doc.end();
  });
}

// ─── Financial docs (factura / letra de cambio) ───────────────────────────────

const VALID_FIN_DOC_TYPES = new Set(["factura", "letra_de_cambio"]);

async function resolveFinancialDocFolder(assetCode) {
  const base =
    process.env.DRIVE_ROOT_FOLDER_ID ||
    process.env.DRIVE_FOLDER_ID;
  if (!base) return null;
  const activosRoot = await ensureFolder("Activos TI", base);
  const docsRoot    = await ensureFolder("Documentos Financieros", activosRoot.id);
  const assetFolder = await ensureFolder(String(assetCode || "sin-codigo"), docsRoot.id);
  return assetFolder.id;
}

async function listFinancialDocs(assetId) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `SELECT d.*,
            COALESCE(u.fullname, u.name, u.email) AS uploaded_by_name
       FROM public.ti_asset_financial_docs d
       LEFT JOIN public.users u ON u.id = d.uploaded_by
      WHERE d.asset_id = $1 AND d.active = true
      ORDER BY d.doc_type ASC, d.uploaded_at DESC`,
    [assetId],
  );
  return rows;
}

async function uploadFinancialDoc({ assetId, docType, fileBuffer, originalFilename, notes, userId }) {
  await ensureTiAssetsSchema();

  const type = String(docType || "").toLowerCase().trim();
  if (!VALID_FIN_DOC_TYPES.has(type)) {
    const err = new Error("Tipo de documento no válido. Use: factura | letra_de_cambio");
    err.status = 400;
    throw err;
  }

  const { rows: assetRows } = await db.query(
    `SELECT id, asset_code, name FROM public.ti_assets WHERE id = $1 AND active = true LIMIT 1`,
    [assetId],
  );
  if (!assetRows.length) {
    const err = new Error("Activo TI no encontrado"); err.status = 404; throw err;
  }
  const asset = assetRows[0];

  const sha256   = computeSha256HexFromBuffer(fileBuffer);
  const typeLabel = type === "factura" ? "Factura" : "Letra-de-Cambio";
  const ext      = (originalFilename || "").split(".").pop() || "pdf";
  const filename = `${typeLabel}-${asset.asset_code || asset.id}.${ext}`;

  let driveUrl = null;
  let driveFileId = null;

  try {
    const folderId = await resolveFinancialDocFolder(asset.asset_code || asset.id);
    if (folderId) {
      const uploaded = await uploadBase64File(
        filename,
        fileBuffer.toString("base64"),
        "application/pdf",
        folderId,
      );
      driveUrl    = uploaded?.webViewLink || uploaded?.webContentLink || null;
      driveFileId = uploaded?.id || null;
    }
  } catch (_driveErr) { /* Drive opcional */ }

  // Upsert: desactiva el anterior del mismo tipo y crea el nuevo
  // Factura: upsert (desactiva anterior, crea nueva)
  // Letra de cambio: append (crea nueva sin desactivar)
  if (type === "factura") {
    await db.query(
      `UPDATE public.ti_asset_financial_docs
          SET active = false
        WHERE asset_id = $1 AND doc_type = $2 AND active = true`,
      [assetId, type],
    );
  }

  const { rows } = await db.query(
    `INSERT INTO public.ti_asset_financial_docs
       (asset_id, doc_type, assigned_user_id, filename, drive_file_id, drive_url, sha256, notes, uploaded_by, uploaded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     RETURNING *`,
    [assetId, type, null, filename, driveFileId, driveUrl, sha256, notes || null, userId || null],
  );

  return rows[0];
}

async function getLetrasDeChangioHistory(assetId) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `SELECT d.*,
            COALESCE(u.fullname, u.name, u.email) AS uploaded_by_name,
            COALESCE(assigned.fullname, assigned.name, assigned.email) AS assigned_user_name
       FROM public.ti_asset_financial_docs d
       LEFT JOIN public.users u ON u.id = d.uploaded_by
       LEFT JOIN public.users assigned ON assigned.id = d.assigned_user_id
      WHERE d.asset_id = $1 AND d.doc_type = 'letra_de_cambio'
      ORDER BY d.uploaded_at DESC`,
    [assetId],
  );
  return rows;
}

// ========== FASE 6: LIBERACIÓN DE EQUIPOS ==========

async function liberateAsset({ assetId, photos, notes, userId }) {
  await ensureTiAssetsSchema();

  if (!Array.isArray(photos) || photos.length < 2) {
    const err = new Error("Se requieren al menos 2 fotos para liberar el equipo");
    err.status = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Obtener activo con datos completos para el acta
    const assetQ = await client.query(
      `SELECT id, name, brand, model, serial_number, imei, assigned_to_user_id, status
         FROM public.ti_assets WHERE id = $1`,
      [assetId]
    );

    if (!assetQ.rows.length) {
      const err = new Error("Activo TI no encontrado");
      err.status = 404;
      throw err;
    }

    const asset = assetQ.rows[0];

    if (asset.status !== 'assigned') {
      const err = new Error(`No se puede liberar un equipo en estado "${asset.status}". Solo se pueden liberar equipos asignados.`);
      err.status = 400;
      throw err;
    }

    // Ficha TH es fuente de verdad — lanza 422 si incompleta
    const { nombre: recipientNombre, cedula: recipientCedula, cargo: recipientCargo } =
      await resolveRecipientOrThrow(asset.assigned_to_user_id, client);

    // Subir todas las fotos a Drive y guardar registros
    const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID || null;
    let driveFolderId = null;
    if (rootFolderId) {
      try {
        const folder = await ensureFolder("Liberación de Activos TI", rootFolderId);
        driveFolderId = folder?.id || null;
      } catch (_) { /* Drive opcional */ }
    }

    const savedPhotos = [];
    for (const { buffer, filename } of photos) {
      const sha256 = computeSha256HexFromBuffer(buffer);
      let driveUrl = null;
      let driveFileId = null;
      try {
        if (driveFolderId) {
          const uploaded = await uploadBase64File(filename, buffer.toString("base64"), "image/jpeg", driveFolderId);
          driveUrl    = uploaded?.webViewLink || uploaded?.webContentLink || null;
          driveFileId = uploaded?.id || null;
        }
      } catch (_) { /* Drive opcional */ }

      const photoRes = await client.query(
        `INSERT INTO public.ti_asset_liberation_photos
         (asset_id, filename, drive_url, drive_file_id, sha256, liberated_by, liberated_at, notes, active)
         VALUES ($1,$2,$3,$4,$5,$6,now(),$7,true)
         RETURNING *`,
        [assetId, filename, driveUrl, driveFileId, sha256, userId, notes || null]
      );
      savedPhotos.push(photoRes.rows[0]);
    }

    // Crear acta de retiro con datos reales del colaborador y del equipo
    const brandModel = [asset.brand, asset.model].filter(Boolean).join(" / ") || null;
    const serialImei = [asset.serial_number, asset.imei].filter(Boolean).join(" / ") || null;

    const acta = await createActa({
      tipo: 'retiro',
      assetId,
      recipientUserId: asset.assigned_to_user_id,
      previousUserId:  asset.assigned_to_user_id,
      recipientNombre,
      recipientCedula,
      recipientCargo,
      generatedBy: userId,
      notes: notes || null,
      items: [{
        item_type:          'equipo',
        asset_id:           asset.id,
        name:               asset.name,
        brand_model:        brandModel,
        serial_imei:        serialImei,
        is_new:             false,
        physical_condition: null,
        observations:       notes || null,
      }],
      client,
    });

    // Cambiar estado a 'available'
    const updRes = await client.query(
      `UPDATE public.ti_assets
          SET status = 'available',
              assigned_to_user_id = NULL,
              assigned_at = NULL,
              updated_by = $1,
              updated_at = now()
        WHERE id = $2
        RETURNING *`,
      [userId, assetId]
    );

    await client.query(
      `INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
       VALUES ($1,'asset_liberated',$2::jsonb,$3,now())`,
      [assetId, JSON.stringify({ photos_count: photos.length, acta_id: acta.id }), userId]
    );

    await client.query("COMMIT");

    return {
      ...updRes.rows[0],
      ...computeDepreciation(updRes.rows[0].purchase_date),
      photos: savedPhotos,
      acta_id: acta.id,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getLiberationPhotos(assetId) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `SELECT lp.*,
            COALESCE(u.fullname, u.name, u.email) AS liberated_by_name
       FROM public.ti_asset_liberation_photos lp
       LEFT JOIN public.users u ON u.id = lp.liberated_by
      WHERE lp.asset_id = $1 AND lp.active = true
      ORDER BY lp.liberated_at DESC`,
    [assetId]
  );
  return rows;
}

// ========== FASE 2: NÚMEROS CORPORATIVOS ==========

async function listCorporateNumbers({ status, q }) {
  await ensureTiAssetsSchema();
  const params = [];
  let where = "WHERE 1=1";

  if (status) {
    if (!['available', 'assigned', 'inactive'].includes(String(status).toLowerCase())) {
      const err = new Error("Estado de número corporativo inválido");
      err.status = 400;
      throw err;
    }
    params.push(String(status).toLowerCase());
    where += ` AND cn.status = $${params.length}`;
  }

  if (q) {
    params.push(`%${String(q).toLowerCase()}%`);
    where += ` AND (LOWER(cn.number) LIKE $${params.length} OR LOWER(COALESCE(u.email, '')) LIKE $${params.length} OR LOWER(COALESCE(a.name, '')) LIKE $${params.length})`;
  }

  const { rows } = await db.query(
    `SELECT cn.*,
            COALESCE(u.fullname, u.name, u.email) AS assigned_user_name,
            COALESCE(u.cedula, '') AS assigned_user_cedula,
            COALESCE(u.departamento, '') AS assigned_user_department,
            COALESCE(a.name, '') AS asset_name,
            COALESCE(a.asset_code, '') AS asset_code
       FROM public.ti_corporate_numbers cn
       LEFT JOIN public.users u ON u.id = cn.assigned_to_user_id
       LEFT JOIN public.ti_assets a ON a.id = cn.asset_id
       ${where}
       ORDER BY cn.number ASC`,
    params,
  );
  return rows;
}

async function getCorporateNumber(numberId) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `SELECT cn.*,
            COALESCE(u.fullname, u.name, u.email) AS assigned_user_name,
            COALESCE(a.name, '') AS asset_name
       FROM public.ti_corporate_numbers cn
       LEFT JOIN public.users u ON u.id = cn.assigned_to_user_id
       LEFT JOIN public.ti_assets a ON a.id = cn.asset_id
      WHERE cn.id = $1`,
    [numberId],
  );
  if (!rows.length) {
    const err = new Error("Número corporativo no encontrado");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function createCorporateNumber({ number, notes, userId }) {
  await ensureTiAssetsSchema();

  if (!number || !String(number).trim()) {
    const err = new Error("Número corporativo es obligatorio");
    err.status = 400;
    throw err;
  }

  // Verificar que el número sea único
  const existing = await db.query(
    `SELECT id FROM public.ti_corporate_numbers WHERE number = $1`,
    [String(number).trim()],
  );
  if (existing.rows.length) {
    const err = new Error("Número corporativo ya existe");
    err.status = 409;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO public.ti_corporate_numbers (number, status, created_at, updated_at)
     VALUES ($1, 'available', now(), now())
     RETURNING *`,
    [String(number).trim()],
  );

  return rows[0];
}

async function assignCorporateNumber({ numberId, assetId, assignedToUserId, userId }) {
  await ensureTiAssetsSchema();

  const corpNum = await getCorporateNumber(numberId);
  const asset = await getAsset(assetId);

  // Validar que el activo sea un móvil
  // (Asumimos que el tipo está en characteristics o en otro campo)
  // Por ahora verificamos que el activo exista

  if (!asset) {
    const err = new Error("Activo no encontrado");
    err.status = 404;
    throw err;
  }

  // Verificar que el número esté disponible
  if (corpNum.status !== 'available') {
    const err = new Error("Número corporativo no está disponible");
    err.status = 400;
    throw err;
  }

  // Liberar número anterior si existe
  const prevAssignment = await db.query(
    `SELECT id FROM public.ti_corporate_numbers WHERE asset_id = $1 AND status != 'inactive'`,
    [assetId],
  );
  if (prevAssignment.rows.length) {
    await db.query(
      `UPDATE public.ti_corporate_numbers
        SET status = 'available', asset_id = NULL, assigned_to_user_id = NULL, assigned_at = NULL
      WHERE id = $1`,
      [prevAssignment.rows[0].id],
    );
  }

  // Asignar nuevo número
  const { rows } = await db.query(
    `UPDATE public.ti_corporate_numbers
      SET status = 'assigned', asset_id = $1, assigned_to_user_id = $2, assigned_at = now(), updated_at = now()
    WHERE id = $3
    RETURNING *`,
    [assetId, assignedToUserId || null, numberId],
  );

  // Registrar en historial (cambio de número)
  if (prevAssignment.rows.length) {
    await db.query(
      `INSERT INTO public.ti_corporate_number_history
       (number_id, old_number, new_number, changed_at, changed_by, reason)
       VALUES ($1, $2, $3, now(), $4, $5)`,
      [numberId, corpNum.number, corpNum.number, userId || null, 'assigned_to_asset'],
    );
  }

  return rows[0];
}

async function changeCorporateNumber({ currentNumberId, newNumberId, reason, userId }) {
  await ensureTiAssetsSchema();

  const currentNum = await getCorporateNumber(currentNumberId);
  const newNum = await getCorporateNumber(newNumberId);

  if (!currentNum.asset_id) {
    const err = new Error("Número actual no está asignado a un activo");
    err.status = 400;
    throw err;
  }

  if (newNum.status !== 'available') {
    const err = new Error("Número nuevo no está disponible");
    err.status = 400;
    throw err;
  }

  const assetId = currentNum.asset_id;

  // Actualizar números
  await db.query(
    `UPDATE public.ti_corporate_numbers
      SET status = 'available', asset_id = NULL, assigned_to_user_id = NULL, assigned_at = NULL
    WHERE id = $1`,
    [currentNumberId],
  );

  const { rows: newRows } = await db.query(
    `UPDATE public.ti_corporate_numbers
      SET status = 'assigned', asset_id = $1, assigned_to_user_id = $2, assigned_at = now()
    WHERE id = $3
    RETURNING *`,
    [assetId, currentNum.assigned_to_user_id, newNumberId],
  );

  // Registrar cambio en historial
  await db.query(
    `INSERT INTO public.ti_corporate_number_history
     (number_id, old_number, new_number, changed_at, changed_by, reason)
     VALUES ($1, $2, $3, now(), $4, $5)`,
    [newNumberId, currentNum.number, newNum.number, userId || null, reason || null],
  );

  return newRows[0];
}

async function getCorporateNumberHistory(numberId) {
  await ensureTiAssetsSchema();
  const { rows } = await db.query(
    `SELECT ch.*,
            COALESCE(u.fullname, u.name, u.email) AS changed_by_name
       FROM public.ti_corporate_number_history ch
       LEFT JOIN public.users u ON u.id = ch.changed_by
      WHERE ch.number_id = $1
      ORDER BY ch.changed_at DESC`,
    [numberId],
  );
  return rows;
}

async function getAsset(assetId) {
  const { rows } = await db.query(
    `SELECT * FROM public.ti_assets WHERE id = $1 AND active = true`,
    [assetId],
  );
  return rows[0] || null;
}

module.exports = {
  TI_ROLES,
  TI_READ_ROLES,
  TI_ASSET_CREATE_ROLES,
  ensureTiAssetsSchema,
  listAssets,
  createAsset,
  updateAsset,
  assignAsset,
  assignMultipleAssets,
  updateAssetStatus,
  listAssetHistory,
  // FASE 2: Corporate Numbers
  listCorporateNumbers,
  getCorporateNumber,
  createCorporateNumber,
  assignCorporateNumber,
  changeCorporateNumber,
  getCorporateNumberHistory,
  listAssetAssignmentsHistory,
  generateAnnualMaintenance,
  generateFutureMaintenance,
  listMaintenance,
  clearAllMaintenanceSchedules,
  setMaintenanceCoordinationDate,
  createMaintenance,
  completeMaintenance,
  requestAssignedDeliveryForMaintenance,
  // Accessories
  listAccessories,
  createAccessory,
  updateAccessory,
  removeAccessory,
  // Actas
  createActa,
  updateActaPdf,
  generateAndStoreActaPdf,
  queueTiActaPdfGeneration,
  listAllActas,
  listActas,
  getActaWithItems,
  getActaPdfDownload,
  updateActa,
  uploadSignedActa,
  buildActaPdfBuffer,
  startSignatureWorkflowForActa,
  getActaSignatureWorkflow,
  // Reports
  generateAssetPdfReport,
  generateCollaboratorPdfReport,
  // Financial docs
  listFinancialDocs,
  uploadFinancialDoc,
  getLetrasDeChangioHistory,
  // FASE 6: Liberation
  liberateAsset,
  getLiberationPhotos,
};
