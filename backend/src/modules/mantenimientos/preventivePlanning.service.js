const db = require("../../config/db");
const logger = require("../../config/logger");
const { sendMail } = require("../../utils/mailer");
const { upsertWorkflow } = require("../servicio/workflowRegistry.service");
const { appendWorkflowAuditEvent } = require("../servicio/workflowAudit.service");

const PROCEDURE_CODE = "ST-01-02";
const WORKFLOW_SOURCE_TYPE = "maintenance_case";

const PLAN_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  SUPERSEDED: "superseded",
  ARCHIVED: "archived",
});

const ITEM_STATUS = Object.freeze({
  PLANNED: "planned",
  OFFER_PENDING: "offer_pending",
  OFFER_REJECTED: "offer_rejected",
  OFFER_ACCEPTED: "offer_accepted",
  COORDINATED: "coordinated",
  KIT_REQUESTED: "kit_requested",
  KIT_READY: "kit_ready",
  IN_EXECUTION: "in_execution",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REPROGRAMMED: "reprogrammed",
});

const OFFER_STATUS = Object.freeze({
  ISSUED: "issued",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
});

const KIT_STATUS = Object.freeze({
  REQUESTED: "requested",
  APPROVED: "approved",
  REJECTED: "rejected",
  WAREHOUSE_OUT: "warehouse_out",
  USED: "used",
});

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const normalizeInt = (value, fallback = null) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeFloat = (value, fallback = null) => {
  const parsed = Number.parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeBool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "si", "sí", "yes", "y"].includes(normalized)) return true;
  if (["false", "no", "n"].includes(normalized)) return false;
  return Boolean(fallback);
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeObject = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
};

const toDateOnly = (value, fallback = null) => {
  if (!value) return fallback;
  const str = String(value).trim();
  const iso = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return fallback;
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const toIsoDateTime = (value, fallback = null) => {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
};

const startOfUtcDay = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const buildError = (
  message,
  { status = 400, code = "PREVENTIVE_PLANNING_ERROR", details = null } = {},
) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details && typeof details === "object") error.details = details;
  return error;
};

const normalizeWarrantyStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["in_warranty", "garantia", "en_garantia", "en garantía"].includes(normalized)) {
    return "in_warranty";
  }
  if (["out_of_warranty", "sin_garantia", "fuera_garantia", "fuera de garantia"].includes(normalized)) {
    return "out_of_warranty";
  }
  return "unknown";
};

const normalizeContractType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "unknown";
  if (["contrato", "contract", "active_contract", "vigente"].includes(normalized)) return "contract";
  if (["sin_contrato", "none", "out", "no_contract"].includes(normalized)) return "without_contract";
  return normalized.slice(0, 80);
};

const normalizeOwnerType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "unknown";
  if (["cliente", "customer", "client"].includes(normalized)) return "client";
  if (["interno", "internal", "spi"].includes(normalized)) return "internal";
  return normalized.slice(0, 80);
};

const resolveDefaultWarrantyStatus = ({ installedAt, warrantyMonths }) => {
  const installationDate = toDateOnly(installedAt);
  const months = Number.isFinite(Number(warrantyMonths)) ? Number(warrantyMonths) : 0;
  if (!installationDate || months <= 0) return "unknown";
  const base = new Date(`${installationDate}T00:00:00Z`);
  base.setUTCMonth(base.getUTCMonth() + months);
  const today = startOfUtcDay();
  return base.getTime() >= today.getTime() ? "in_warranty" : "out_of_warranty";
};

const getMonthNumber = (value, fallback = null) => {
  const parsed = normalizeInt(value, fallback);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 1 || parsed > 12) return fallback;
  return parsed;
};

const createDateForMonth = ({ year, month, day = 1 } = {}) => {
  const safeYear = normalizeInt(year);
  const safeMonth = getMonthNumber(month);
  if (!safeYear || !safeMonth) return null;
  const safeDay = Math.max(1, Math.min(28, normalizeInt(day, 1)));
  return `${safeYear}-${String(safeMonth).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
};

const safeJson = (value, fallback = {}) => {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_error) {
      return fallback;
    }
  }
  return fallback;
};

const sourceIdForPlan = (planId) => `preventive_plan_${planId}`;
const sourceIdForItem = (itemId) => `preventive_item_${itemId}`;

const stageFromItemStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if ([ITEM_STATUS.COMPLETED].includes(normalized)) return "completed";
  if ([ITEM_STATUS.IN_EXECUTION].includes(normalized)) return "executing";
  if (
    [
      ITEM_STATUS.COORDINATED,
      ITEM_STATUS.KIT_REQUESTED,
      ITEM_STATUS.KIT_READY,
    ].includes(normalized)
  ) {
    return "scheduled";
  }
  if ([ITEM_STATUS.CANCELLED, ITEM_STATUS.OFFER_REJECTED].includes(normalized)) return "cancelled";
  return "planned";
};

const globalStatusFromItemStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if ([ITEM_STATUS.COMPLETED].includes(normalized)) return "completed";
  if ([ITEM_STATUS.CANCELLED, ITEM_STATUS.OFFER_REJECTED].includes(normalized)) return "cancelled";
  return "in_progress";
};

const ensurePreventivePlanningTables = async () => {
  await db.query("CREATE SCHEMA IF NOT EXISTS servicio");

  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.preventive_annual_plans (
      id BIGSERIAL PRIMARY KEY,
      plan_year INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT '${PLAN_STATUS.DRAFT}',
      title TEXT,
      notes TEXT,
      source_schedule_id INTEGER,
      anexo7_capacity JSONB NOT NULL DEFAULT '{}'::jsonb,
      baseline_of_id BIGINT REFERENCES servicio.preventive_annual_plans(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      published_at TIMESTAMPTZ,
      UNIQUE (plan_year, version)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_annual_plans_year
      ON servicio.preventive_annual_plans (plan_year, status, updated_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.preventive_plan_items (
      id BIGSERIAL PRIMARY KEY,
      annual_plan_id BIGINT NOT NULL REFERENCES servicio.preventive_annual_plans(id) ON DELETE CASCADE,
      equipment_id INTEGER NOT NULL,
      equipment_name TEXT,
      equipment_serial TEXT,
      client_name TEXT,
      owner_type TEXT DEFAULT 'unknown',
      contract_type TEXT DEFAULT 'unknown',
      warranty_status TEXT DEFAULT 'unknown',
      frequency_months INTEGER NOT NULL DEFAULT 12,
      planned_month INTEGER NOT NULL,
      planned_date DATE NOT NULL,
      estimated_minutes INTEGER NOT NULL DEFAULT 180,
      requires_offer BOOLEAN NOT NULL DEFAULT false,
      offer_required_reason TEXT,
      status TEXT NOT NULL DEFAULT '${ITEM_STATUS.PLANNED}',
      coordination_window TEXT,
      coordinated_at TIMESTAMPTZ,
      coordinated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      work_order_number TEXT,
      last_execution_at TIMESTAMPTZ,
      execution_result TEXT,
      reprogrammed_from_date DATE,
      reprogrammed_to_date DATE,
      cancelled_reason TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (annual_plan_id, equipment_id, planned_month)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_plan_items_plan
      ON servicio.preventive_plan_items (annual_plan_id, planned_month, planned_date)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_plan_items_status
      ON servicio.preventive_plan_items (status, planned_date)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.preventive_offers (
      id BIGSERIAL PRIMARY KEY,
      plan_item_id BIGINT NOT NULL REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE,
      offer_code TEXT,
      status TEXT NOT NULL DEFAULT '${OFFER_STATUS.ISSUED}',
      issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      valid_until DATE,
      offer_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      decision_reason TEXT,
      decision_at TIMESTAMPTZ,
      decided_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      decided_by_email TEXT,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_offers_item
      ON servicio.preventive_offers (plan_item_id, issued_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.preventive_reprogramming_notices (
      id BIGSERIAL PRIMARY KEY,
      plan_item_id BIGINT NOT NULL REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE,
      original_planned_date DATE NOT NULL,
      new_planned_date DATE NOT NULL,
      reason TEXT NOT NULL,
      anexo5_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      communicated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_reprogramming_item
      ON servicio.preventive_reprogramming_notices (plan_item_id, created_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.preventive_kit_requests (
      id BIGSERIAL PRIMARY KEY,
      plan_item_id BIGINT NOT NULL REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      request_month INTEGER NOT NULL,
      request_year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT '${KIT_STATUS.REQUESTED}',
      wo_number TEXT,
      client_name TEXT,
      equipment_name TEXT,
      equipment_serial TEXT,
      observations TEXT,
      warehouse_exit_at TIMESTAMPTZ,
      warehouse_exit_reference TEXT,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_kit_requests_item
      ON servicio.preventive_kit_requests (plan_item_id, requested_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.preventive_execution_reports (
      id BIGSERIAL PRIMARY KEY,
      plan_item_id BIGINT NOT NULL REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE,
      executed_at TIMESTAMPTZ NOT NULL,
      execution_month INTEGER NOT NULL,
      execution_year INTEGER NOT NULL,
      wo_number TEXT,
      duration_minutes INTEGER,
      activities JSONB NOT NULL DEFAULT '[]'::jsonb,
      parts_replaced JSONB NOT NULL DEFAULT '[]'::jsonb,
      consumables JSONB NOT NULL DEFAULT '[]'::jsonb,
      evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
      report_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      performed_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      performed_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_execution_reports_item
      ON servicio.preventive_execution_reports (plan_item_id, executed_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.preventive_documents (
      id BIGSERIAL PRIMARY KEY,
      annual_plan_id BIGINT REFERENCES servicio.preventive_annual_plans(id) ON DELETE CASCADE,
      plan_item_id BIGINT REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE,
      document_code TEXT NOT NULL,
      drive_file_id TEXT,
      drive_link TEXT,
      template_mode TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_documents_plan_item
      ON servicio.preventive_documents (plan_item_id, document_code, created_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_documents_plan
      ON servicio.preventive_documents (annual_plan_id, document_code, created_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.preventive_case_events (
      id BIGSERIAL PRIMARY KEY,
      annual_plan_id BIGINT REFERENCES servicio.preventive_annual_plans(id) ON DELETE CASCADE,
      plan_item_id BIGINT REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      stage_key TEXT,
      actor_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      actor_email TEXT,
      event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_case_events_plan_item
      ON servicio.preventive_case_events (plan_item_id, created_at DESC)
  `);

  await db.query(`
    ALTER TABLE servicio.cronograma_mantenimientos
    ADD COLUMN IF NOT EXISTS preventive_plan_id BIGINT
  `);
  await db.query(`
    ALTER TABLE servicio.cronograma_mantenimientos
    ADD COLUMN IF NOT EXISTS preventive_plan_item_id BIGINT
  `);
  await db.query(`
    ALTER TABLE servicio.cronograma_mantenimientos
    ADD COLUMN IF NOT EXISTS compliance_month_match BOOLEAN
  `);
  await db.query(`
    ALTER TABLE servicio.cronograma_mantenimientos
    ADD COLUMN IF NOT EXISTS procedure_code TEXT DEFAULT '${PROCEDURE_CODE}'
  `);
};

const appendPreventiveEvent = async ({
  annualPlanId = null,
  planItemId = null,
  eventType,
  stageKey = null,
  payload = {},
  user = null,
}) => {
  await ensurePreventivePlanningTables();
  const normalizedEventType = String(eventType || "").trim().toLowerCase();
  if (!normalizedEventType) return null;
  const safePayload = normalizeObject(payload);

  const { rows } = await db.query(
    `
      INSERT INTO servicio.preventive_case_events (
        annual_plan_id,
        plan_item_id,
        event_type,
        stage_key,
        actor_user_id,
        actor_email,
        event_payload,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now())
      RETURNING *
    `,
    [
      annualPlanId || null,
      planItemId || null,
      normalizedEventType,
      stageKey || null,
      user?.id || null,
      user?.email || null,
      JSON.stringify(safePayload),
    ],
  );

  try {
    await appendWorkflowAuditEvent({
      sourceType: WORKFLOW_SOURCE_TYPE,
      sourceId: planItemId ? sourceIdForItem(planItemId) : sourceIdForPlan(annualPlanId),
      procedureCode: PROCEDURE_CODE,
      eventType: normalizedEventType,
      stageKey: stageKey || "planned",
      actor: user,
      payload: safePayload,
    });
  } catch (error) {
    logger.warn({ error }, "No se pudo registrar evento de workflow para preventivo");
  }

  return rows[0] || null;
};

const buildItemWorkflowMetadata = (item = {}) => ({
  annual_plan_id: item.annual_plan_id,
  plan_item_id: item.id,
  planned_date: item.planned_date,
  planned_month: item.planned_month,
  status: item.status,
  work_order_number: item.work_order_number,
  warranty_status: item.warranty_status,
  contract_type: item.contract_type,
  requires_offer: Boolean(item.requires_offer),
});

const syncPlanItemWorkflow = async (item, user = null) => {
  if (!item?.id) return null;
  const stage = stageFromItemStatus(item.status);
  return upsertWorkflow({
    sourceType: WORKFLOW_SOURCE_TYPE,
    sourceId: sourceIdForItem(item.id),
    requestId: null,
    clientName: item.client_name || null,
    equipmentName: item.equipment_name || `Equipo ${item.equipment_id || ""}`.trim(),
    procedureCode: PROCEDURE_CODE,
    globalStatus: globalStatusFromItemStatus(item.status),
    currentStage: stage,
    metadata: buildItemWorkflowMetadata(item),
    user,
  });
};

const syncPlanWorkflow = async (plan, user = null) => {
  if (!plan?.id) return null;
  const total = Number(plan.total_items || 0);
  const completed = Number(plan.completed_items || 0);
  const cancelled = Number(plan.cancelled_items || 0);
  const inExecution = Number(plan.executing_items || 0);
  let stage = "planned";
  if (completed > 0 || cancelled > 0) stage = "scheduled";
  if (inExecution > 0) stage = "executing";
  if (total > 0 && completed + cancelled >= total) stage = "completed";

  return upsertWorkflow({
    sourceType: WORKFLOW_SOURCE_TYPE,
    sourceId: sourceIdForPlan(plan.id),
    requestId: null,
    clientName: null,
    equipmentName: `Plan anual ${plan.plan_year}`,
    procedureCode: PROCEDURE_CODE,
    globalStatus: stage === "completed" ? "completed" : "in_progress",
    currentStage: stage,
    metadata: {
      plan_year: plan.plan_year,
      version: plan.version,
      status: plan.status,
      total_items: total,
      completed_items: completed,
      cancelled_items: cancelled,
      executing_items: inExecution,
    },
    user,
  });
};

const getPlanVersionForYear = async (year) => {
  const { rows } = await db.query(
    `
      SELECT COALESCE(MAX(version), 0) AS max_version
      FROM servicio.preventive_annual_plans
      WHERE plan_year = $1
    `,
    [year],
  );
  return Number(rows[0]?.max_version || 0);
};

const loadEquipmentBaseFromServicio = async () => {
  const { rows } = await db.query(
    `
      SELECT
        e.id_equipo AS equipment_id,
        e.nombre AS equipment_name,
        e.serie AS equipment_serial,
        e.fecha_instalacion,
        e.warranty_months,
        e.capacity_per_hour,
        e.max_daily_capacity,
        e.technical_specs
      FROM servicio.equipos e
      WHERE COALESCE(e.estado, 'operativo') <> 'fuera_de_servicio'
      ORDER BY e.nombre ASC, e.id_equipo ASC
    `,
  );
  return rows || [];
};

const loadEquipmentBaseFromPublicCatalog = async () => {
  const { rows } = await db.query(
    `
      SELECT
        em.id AS equipment_id,
        em.name AS equipment_name,
        null::text AS equipment_serial,
        null::date AS fecha_instalacion,
        em.warranty_months,
        em.capacity_per_hour,
        em.max_daily_capacity,
        em.metadata AS technical_specs
      FROM public.equipment_models em
      WHERE COALESCE(em.status, 'active') <> 'inactive'
      ORDER BY em.name ASC, em.id ASC
    `,
  );
  return rows || [];
};

const loadEquipmentBase = async () => {
  try {
    const rows = await loadEquipmentBaseFromServicio();
    if (rows.length > 0) return rows;
  } catch (error) {
    logger.warn({ error }, "No se pudo cargar base de equipos desde servicio.equipos");
  }
  return loadEquipmentBaseFromPublicCatalog();
};

const buildDefaultItemsFromMaster = async ({ year, anexo7Capacity = {} }) => {
  const equipmentBase = await loadEquipmentBase();
  const defaultAvgMinutes = normalizeInt(anexo7Capacity.default_average_minutes, 180) || 180;
  return equipmentBase.map((row, index) => {
    const specs = safeJson(row.technical_specs, {});
    const plannedMonth = ((index % 12) + 1);
    const plannedDate = createDateForMonth({
      year,
      month: plannedMonth,
      day: normalizeInt(specs.default_maintenance_day, 10) || 10,
    });
    const warrantyStatus = resolveDefaultWarrantyStatus({
      installedAt: row.fecha_instalacion,
      warrantyMonths: row.warranty_months,
    });
    const contractType = normalizeContractType(specs.contract_type || specs.contract_status);
    const ownerType = normalizeOwnerType(specs.owner_type || specs.owner);
    const requiresOffer = warrantyStatus === "out_of_warranty";
    const avgByEquipment = normalizeObject(anexo7Capacity.average_minutes_by_equipment);
    const estimatedMinutes =
      normalizeInt(avgByEquipment[String(row.equipment_id)], null) ||
      normalizeInt(specs.average_preventive_minutes, null) ||
      defaultAvgMinutes;
    return {
      equipment_id: row.equipment_id,
      equipment_name: row.equipment_name,
      equipment_serial: row.equipment_serial || null,
      client_name: normalizeText(specs.client_name || specs.owner_client_name),
      owner_type: ownerType,
      contract_type: contractType,
      warranty_status: warrantyStatus,
      frequency_months: normalizeInt(specs.preventive_frequency_months, 12) || 12,
      planned_month: plannedMonth,
      planned_date: plannedDate,
      requires_offer: requiresOffer,
      offer_required_reason: requiresOffer
        ? "Equipo fuera de garantía - requiere oferta Anexo 4"
        : null,
      estimated_minutes: estimatedMinutes,
      notes: normalizeText(specs.preventive_notes),
    };
  });
};

const normalizePlanItemInput = ({ item = {}, year, index = 0, anexo7Capacity = {} }) => {
  const source = normalizeObject(item);
  const plannedMonth = getMonthNumber(
    source.planned_month || source.plannedMonth,
    ((index % 12) + 1),
  );
  const plannedDate = toDateOnly(
    source.planned_date || source.plannedDate,
    createDateForMonth({ year, month: plannedMonth, day: 10 }),
  );
  const warrantyStatus = normalizeWarrantyStatus(source.warranty_status);
  const requiresOffer =
    typeof source.requires_offer === "boolean"
      ? source.requires_offer
      : warrantyStatus === "out_of_warranty";
  const avgByEquipment = normalizeObject(anexo7Capacity.average_minutes_by_equipment);
  const estimatedMinutes =
    normalizeInt(source.estimated_minutes, null) ||
    normalizeInt(avgByEquipment[String(source.equipment_id || source.equipmentId)], null) ||
    normalizeInt(anexo7Capacity.default_average_minutes, 180) ||
    180;
  return {
    equipment_id: normalizeInt(source.equipment_id || source.equipmentId),
    equipment_name: normalizeText(source.equipment_name || source.equipmentName),
    equipment_serial: normalizeText(source.equipment_serial || source.equipmentSerial),
    client_name: normalizeText(source.client_name || source.clientName),
    owner_type: normalizeOwnerType(source.owner_type),
    contract_type: normalizeContractType(source.contract_type),
    warranty_status: warrantyStatus,
    frequency_months: Math.max(1, normalizeInt(source.frequency_months, 12) || 12),
    planned_month: plannedMonth,
    planned_date: plannedDate,
    estimated_minutes: Math.max(30, estimatedMinutes),
    requires_offer: Boolean(requiresOffer),
    offer_required_reason: normalizeText(source.offer_required_reason),
    status: requiresOffer ? ITEM_STATUS.OFFER_PENDING : ITEM_STATUS.PLANNED,
    notes: normalizeText(source.notes),
  };
};

const insertPlanItems = async ({ planId, year, rawItems = [], anexo7Capacity = {}, user = null }) => {
  const inserted = [];
  for (const [index, raw] of normalizeArray(rawItems).entries()) {
    const item = normalizePlanItemInput({ item: raw, year, index, anexo7Capacity });
    if (!item.equipment_id) {
      // eslint-disable-next-line no-continue
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await db.query(
      `
        INSERT INTO servicio.preventive_plan_items (
          annual_plan_id,
          equipment_id,
          equipment_name,
          equipment_serial,
          client_name,
          owner_type,
          contract_type,
          warranty_status,
          frequency_months,
          planned_month,
          planned_date,
          estimated_minutes,
          requires_offer,
          offer_required_reason,
          status,
          notes,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now(),now())
        ON CONFLICT (annual_plan_id, equipment_id, planned_month) DO UPDATE
          SET equipment_name = COALESCE(EXCLUDED.equipment_name, servicio.preventive_plan_items.equipment_name),
              equipment_serial = COALESCE(EXCLUDED.equipment_serial, servicio.preventive_plan_items.equipment_serial),
              client_name = COALESCE(EXCLUDED.client_name, servicio.preventive_plan_items.client_name),
              owner_type = EXCLUDED.owner_type,
              contract_type = EXCLUDED.contract_type,
              warranty_status = EXCLUDED.warranty_status,
              frequency_months = EXCLUDED.frequency_months,
              planned_date = EXCLUDED.planned_date,
              estimated_minutes = EXCLUDED.estimated_minutes,
              requires_offer = EXCLUDED.requires_offer,
              offer_required_reason = EXCLUDED.offer_required_reason,
              status = EXCLUDED.status,
              notes = EXCLUDED.notes,
              updated_at = now()
        RETURNING *
      `,
      [
        planId,
        item.equipment_id,
        item.equipment_name,
        item.equipment_serial,
        item.client_name,
        item.owner_type,
        item.contract_type,
        item.warranty_status,
        item.frequency_months,
        item.planned_month,
        item.planned_date,
        item.estimated_minutes,
        item.requires_offer,
        item.offer_required_reason,
        item.status,
        item.notes,
      ],
    );
    const row = rows[0] || null;
    if (row) {
      inserted.push(row);
      // eslint-disable-next-line no-await-in-loop
      await syncPlanItemWorkflow(row, user);
      // eslint-disable-next-line no-await-in-loop
      await appendPreventiveEvent({
        annualPlanId: row.annual_plan_id,
        planItemId: row.id,
        eventType: "plan_item_generated",
        stageKey: stageFromItemStatus(row.status),
        payload: {
          equipment_id: row.equipment_id,
          planned_date: row.planned_date,
          warranty_status: row.warranty_status,
          requires_offer: row.requires_offer,
        },
        user,
      });
    }
  }
  return inserted;
};

const getPlanAggregate = async (planId) => {
  const { rows } = await db.query(
    `
      SELECT
        p.*,
        COALESCE(stats.total_items, 0) AS total_items,
        COALESCE(stats.completed_items, 0) AS completed_items,
        COALESCE(stats.cancelled_items, 0) AS cancelled_items,
        COALESCE(stats.executing_items, 0) AS executing_items
      FROM servicio.preventive_annual_plans p
      LEFT JOIN (
        SELECT
          annual_plan_id,
          COUNT(*)::int AS total_items,
          COUNT(*) FILTER (WHERE status = '${ITEM_STATUS.COMPLETED}')::int AS completed_items,
          COUNT(*) FILTER (WHERE status IN ('${ITEM_STATUS.CANCELLED}', '${ITEM_STATUS.OFFER_REJECTED}'))::int AS cancelled_items,
          COUNT(*) FILTER (WHERE status = '${ITEM_STATUS.IN_EXECUTION}')::int AS executing_items
        FROM servicio.preventive_plan_items
        WHERE annual_plan_id = $1
        GROUP BY annual_plan_id
      ) stats ON stats.annual_plan_id = p.id
      WHERE p.id = $1
      LIMIT 1
    `,
    [planId],
  );
  return rows[0] || null;
};

const listPreventiveAnnualPlans = async ({
  year = null,
  status = null,
  q = null,
  limit = 100,
} = {}) => {
  await ensurePreventivePlanningTables();
  const safeLimit = Math.max(1, Math.min(300, normalizeInt(limit, 100)));
  const filters = [];
  const params = [];

  if (Number.isFinite(Number(year))) {
    params.push(Number(year));
    filters.push(`p.plan_year = $${params.length}`);
  }
  if (status) {
    params.push(String(status).trim().toLowerCase());
    filters.push(`LOWER(p.status) = $${params.length}`);
  }
  if (q) {
    params.push(`%${String(q).trim().toLowerCase()}%`);
    filters.push(`
      (
        LOWER(COALESCE(p.title, '')) LIKE $${params.length}
        OR LOWER(COALESCE(p.notes, '')) LIKE $${params.length}
      )
    `);
  }
  params.push(safeLimit);

  const { rows } = await db.query(
    `
      SELECT
        p.*,
        COALESCE(stats.total_items, 0) AS total_items,
        COALESCE(stats.completed_items, 0) AS completed_items,
        COALESCE(stats.cancelled_items, 0) AS cancelled_items,
        COALESCE(stats.executing_items, 0) AS executing_items
      FROM servicio.preventive_annual_plans p
      LEFT JOIN (
        SELECT
          annual_plan_id,
          COUNT(*)::int AS total_items,
          COUNT(*) FILTER (WHERE status = '${ITEM_STATUS.COMPLETED}')::int AS completed_items,
          COUNT(*) FILTER (WHERE status IN ('${ITEM_STATUS.CANCELLED}', '${ITEM_STATUS.OFFER_REJECTED}'))::int AS cancelled_items,
          COUNT(*) FILTER (WHERE status = '${ITEM_STATUS.IN_EXECUTION}')::int AS executing_items
        FROM servicio.preventive_plan_items
        GROUP BY annual_plan_id
      ) stats ON stats.annual_plan_id = p.id
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY p.plan_year DESC, p.version DESC, p.updated_at DESC
      LIMIT $${params.length}
    `,
    params,
  );

  return rows || [];
};

const getPreventivePlanItems = async (planId) => {
  await ensurePreventivePlanningTables();
  const { rows } = await db.query(
    `
      SELECT
        pi.*,
        lo.id AS latest_offer_id,
        lo.status AS latest_offer_status,
        lo.offer_code AS latest_offer_code,
        lo.issued_at AS latest_offer_issued_at,
        lk.id AS latest_kit_id,
        lk.status AS latest_kit_status,
        lk.warehouse_exit_at AS latest_kit_warehouse_exit_at,
        le.id AS latest_execution_id,
        le.executed_at AS latest_execution_at
      FROM servicio.preventive_plan_items pi
      LEFT JOIN LATERAL (
        SELECT o.*
        FROM servicio.preventive_offers o
        WHERE o.plan_item_id = pi.id
        ORDER BY o.issued_at DESC, o.id DESC
        LIMIT 1
      ) lo ON true
      LEFT JOIN LATERAL (
        SELECT k.*
        FROM servicio.preventive_kit_requests k
        WHERE k.plan_item_id = pi.id
        ORDER BY k.requested_at DESC, k.id DESC
        LIMIT 1
      ) lk ON true
      LEFT JOIN LATERAL (
        SELECT e.*
        FROM servicio.preventive_execution_reports e
        WHERE e.plan_item_id = pi.id
        ORDER BY e.executed_at DESC, e.id DESC
        LIMIT 1
      ) le ON true
      WHERE pi.annual_plan_id = $1
      ORDER BY pi.planned_date ASC, pi.id ASC
    `,
    [planId],
  );
  return rows || [];
};

const getPreventiveAnnualPlanDetail = async (planId) => {
  await ensurePreventivePlanningTables();
  const id = normalizeInt(planId);
  if (!id) return null;

  const plan = await getPlanAggregate(id);
  if (!plan) return null;
  const items = await getPreventivePlanItems(id);
  const { rows: docs } = await db.query(
    `
      SELECT *
      FROM servicio.preventive_documents
      WHERE annual_plan_id = $1
      ORDER BY created_at DESC
      LIMIT 200
    `,
    [id],
  );
  const { rows: events } = await db.query(
    `
      SELECT *
      FROM servicio.preventive_case_events
      WHERE annual_plan_id = $1
      ORDER BY created_at DESC
      LIMIT 400
    `,
    [id],
  );
  return {
    ...plan,
    items,
    documents: docs || [],
    events: events || [],
  };
};

const createPreventiveAnnualPlan = async ({
  year,
  title = null,
  notes = null,
  sourceScheduleId = null,
  anexo7Capacity = {},
  equipmentItems = [],
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const planYear = normalizeInt(year, new Date().getUTCFullYear());
  if (!planYear || planYear < 2020 || planYear > 2100) {
    throw buildError("Año del plan preventivo inválido", {
      status: 400,
      code: "PREVENTIVE_PLAN_YEAR_INVALID",
    });
  }

  const nextVersion = (await getPlanVersionForYear(planYear)) + 1;
  const safeAnexo7Capacity = normalizeObject(anexo7Capacity);

  const client = await db.getClient();
  let transactionActive = false;
  try {
    await client.query("BEGIN");
    transactionActive = true;
    const { rows: createdRows } = await client.query(
      `
        INSERT INTO servicio.preventive_annual_plans (
          plan_year,
          version,
          status,
          title,
          notes,
          source_schedule_id,
          anexo7_capacity,
          created_by,
          created_by_email,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,now(),now())
        RETURNING *
      `,
      [
        planYear,
        nextVersion,
        PLAN_STATUS.DRAFT,
        normalizeText(title) || `Plan anual preventivo ${planYear} v${nextVersion}`,
        normalizeText(notes),
        normalizeInt(sourceScheduleId),
        JSON.stringify(safeAnexo7Capacity),
        user?.id || null,
        user?.email || null,
      ],
    );

    const createdPlan = createdRows[0] || null;
    if (!createdPlan?.id) {
      throw buildError("No se pudo crear el plan anual preventivo", {
        status: 500,
        code: "PREVENTIVE_PLAN_CREATE_FAILED",
      });
    }

    const sourceItems = normalizeArray(equipmentItems).length
      ? normalizeArray(equipmentItems)
      : await buildDefaultItemsFromMaster({ year: planYear, anexo7Capacity: safeAnexo7Capacity });

    await client.query("COMMIT");
    transactionActive = false;

    try {
      await insertPlanItems({
        planId: createdPlan.id,
        year: planYear,
        rawItems: sourceItems,
        anexo7Capacity: safeAnexo7Capacity,
        user,
      });
    } catch (error) {
      await db.query(
        `
          DELETE FROM servicio.preventive_annual_plans
          WHERE id = $1
        `,
        [createdPlan.id],
      );
      throw error;
    }

    const detail = await getPreventiveAnnualPlanDetail(createdPlan.id);
    await syncPlanWorkflow(detail, user);
    await appendPreventiveEvent({
      annualPlanId: createdPlan.id,
      eventType: "annual_plan_created",
      stageKey: "planned",
      payload: {
        plan_year: planYear,
        version: nextVersion,
        source_schedule_id: normalizeInt(sourceScheduleId),
        generated_items: detail?.items?.length || 0,
      },
      user,
    });
    return detail;
  } catch (error) {
    if (transactionActive) {
      try {
        await client.query("ROLLBACK");
      } catch (_rollbackError) {
        // noop
      }
    }
    throw error;
  } finally {
    client.release();
  }
};

const publishPreventiveAnnualPlan = async ({ planId, user = null }) => {
  await ensurePreventivePlanningTables();
  const id = normalizeInt(planId);
  if (!id) {
    throw buildError("planId inválido", { status: 400, code: "PREVENTIVE_PLAN_ID_INVALID" });
  }
  const detail = await getPreventiveAnnualPlanDetail(id);
  if (!detail) {
    throw buildError("Plan preventivo no encontrado", {
      status: 404,
      code: "PREVENTIVE_PLAN_NOT_FOUND",
    });
  }
  await db.query(
    `
      UPDATE servicio.preventive_annual_plans
      SET status = CASE WHEN id = $1 THEN '${PLAN_STATUS.ACTIVE}' ELSE '${PLAN_STATUS.SUPERSEDED}' END,
          published_at = CASE WHEN id = $1 THEN now() ELSE published_at END,
          updated_at = now()
      WHERE plan_year = $2
    `,
    [id, detail.plan_year],
  );
  const updated = await getPreventiveAnnualPlanDetail(id);
  await syncPlanWorkflow(updated, user);
  await appendPreventiveEvent({
    annualPlanId: id,
    eventType: "annual_plan_published",
    stageKey: "planned",
    payload: { plan_year: updated.plan_year, version: updated.version },
    user,
  });
  return updated;
};

const rebaselinePreventiveAnnualPlan = async ({
  planId,
  reason = null,
  anexo7Capacity = null,
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const id = normalizeInt(planId);
  if (!id) {
    throw buildError("planId inválido", { status: 400, code: "PREVENTIVE_PLAN_ID_INVALID" });
  }
  const detail = await getPreventiveAnnualPlanDetail(id);
  if (!detail) {
    throw buildError("Plan preventivo no encontrado", {
      status: 404,
      code: "PREVENTIVE_PLAN_NOT_FOUND",
    });
  }
  const version = (await getPlanVersionForYear(detail.plan_year)) + 1;
  const nextCapacity = anexo7Capacity ? normalizeObject(anexo7Capacity) : normalizeObject(detail.anexo7_capacity);
  const cloned = await createPreventiveAnnualPlan({
    year: detail.plan_year,
    title: detail.title,
    notes: [
      normalizeText(detail.notes),
      normalizeText(reason) ? `Rebaseline: ${normalizeText(reason)}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
    sourceScheduleId: detail.source_schedule_id || null,
    anexo7Capacity: nextCapacity,
    equipmentItems: detail.items.map((item) => ({
      equipment_id: item.equipment_id,
      equipment_name: item.equipment_name,
      equipment_serial: item.equipment_serial,
      client_name: item.client_name,
      owner_type: item.owner_type,
      contract_type: item.contract_type,
      warranty_status: item.warranty_status,
      frequency_months: item.frequency_months,
      planned_month: item.planned_month,
      planned_date: item.planned_date,
      estimated_minutes: item.estimated_minutes,
      requires_offer: item.requires_offer,
      offer_required_reason: item.offer_required_reason,
      notes: item.notes,
    })),
    user,
  });

  await db.query(
    `
      UPDATE servicio.preventive_annual_plans
      SET baseline_of_id = $1,
          version = $2,
          updated_at = now()
      WHERE id = $3
    `,
    [id, version, cloned.id],
  );
  await db.query(
    `
      UPDATE servicio.preventive_annual_plans
      SET status = '${PLAN_STATUS.SUPERSEDED}',
          updated_at = now()
      WHERE id = $1
    `,
    [id],
  );

  await appendPreventiveEvent({
    annualPlanId: cloned.id,
    eventType: "annual_plan_rebaselined",
    stageKey: "planned",
    payload: { baseline_of_id: id, reason: normalizeText(reason) },
    user,
  });
  return getPreventiveAnnualPlanDetail(cloned.id);
};

const getPlanItemById = async (itemId) => {
  await ensurePreventivePlanningTables();
  const id = normalizeInt(itemId);
  if (!id) return null;
  const { rows } = await db.query(
    `
      SELECT pi.*, p.plan_year, p.version, p.status AS plan_status, p.title AS plan_title
      FROM servicio.preventive_plan_items pi
      JOIN servicio.preventive_annual_plans p ON p.id = pi.annual_plan_id
      WHERE pi.id = $1
      LIMIT 1
    `,
    [id],
  );
  return rows[0] || null;
};

const updatePlanItemById = async ({ itemId, patch = {} } = {}) => {
  const current = await getPlanItemById(itemId);
  if (!current) {
    throw buildError("Ítem preventivo no encontrado", {
      status: 404,
      code: "PREVENTIVE_PLAN_ITEM_NOT_FOUND",
    });
  }
  const next = { ...current, ...normalizeObject(patch) };
  const { rows } = await db.query(
    `
      UPDATE servicio.preventive_plan_items
      SET
        client_name = $1,
        owner_type = $2,
        contract_type = $3,
        warranty_status = $4,
        frequency_months = $5,
        planned_month = $6,
        planned_date = $7,
        estimated_minutes = $8,
        requires_offer = $9,
        offer_required_reason = $10,
        status = $11,
        coordination_window = $12,
        coordinated_at = $13,
        coordinated_by = $14,
        work_order_number = $15,
        last_execution_at = $16,
        execution_result = $17,
        reprogrammed_from_date = $18,
        reprogrammed_to_date = $19,
        cancelled_reason = $20,
        notes = $21,
        updated_at = now()
      WHERE id = $22
      RETURNING *
    `,
    [
      next.client_name || null,
      next.owner_type || "unknown",
      next.contract_type || "unknown",
      next.warranty_status || "unknown",
      Math.max(1, normalizeInt(next.frequency_months, 12) || 12),
      getMonthNumber(next.planned_month, getMonthNumber(current.planned_month, 1)),
      toDateOnly(next.planned_date, current.planned_date),
      Math.max(30, normalizeInt(next.estimated_minutes, 180) || 180),
      normalizeBool(next.requires_offer, false),
      next.offer_required_reason || null,
      String(next.status || ITEM_STATUS.PLANNED).toLowerCase(),
      next.coordination_window || null,
      next.coordinated_at || null,
      normalizeInt(next.coordinated_by, null),
      next.work_order_number || null,
      next.last_execution_at || null,
      next.execution_result || null,
      next.reprogrammed_from_date || null,
      next.reprogrammed_to_date || null,
      next.cancelled_reason || null,
      next.notes || null,
      current.id,
    ],
  );
  return rows[0] || null;
};

const generateOfferCode = ({ planYear, itemId }) =>
  `ANX4-${String(planYear || new Date().getUTCFullYear())}-${String(itemId).padStart(5, "0")}`;

const createPreventiveOffer = async ({
  planItemId,
  validUntil = null,
  offerPayload = {},
  notes = null,
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const item = await getPlanItemById(planItemId);
  if (!item) {
    throw buildError("Ítem preventivo no encontrado para oferta", {
      status: 404,
      code: "PREVENTIVE_OFFER_ITEM_NOT_FOUND",
    });
  }
  const normalizedPayload = normalizeObject(offerPayload);
  const offerCode = generateOfferCode({ planYear: item.plan_year, itemId: item.id });
  const { rows } = await db.query(
    `
      INSERT INTO servicio.preventive_offers (
        plan_item_id,
        offer_code,
        status,
        issued_at,
        valid_until,
        offer_payload,
        created_by,
        created_by_email,
        created_at,
        updated_at
      )
      VALUES ($1,$2,'${OFFER_STATUS.ISSUED}',now(),$3,$4::jsonb,$5,$6,now(),now())
      RETURNING *
    `,
    [
      item.id,
      offerCode,
      toDateOnly(validUntil),
      JSON.stringify({
        ...normalizedPayload,
        notes: normalizeText(notes),
        anexo_code: "Anexo 4",
      }),
      user?.id || null,
      user?.email || null,
    ],
  );
  const offer = rows[0] || null;

  const nextStatus = ITEM_STATUS.OFFER_PENDING;
  const updatedItem = await updatePlanItemById({
    itemId: item.id,
    patch: {
      status: nextStatus,
      requires_offer: true,
      offer_required_reason:
        item.offer_required_reason || "Equipo fuera de garantía - oferta preventiva requerida",
    },
  });
  await syncPlanItemWorkflow(updatedItem, user);
  await appendPreventiveEvent({
    annualPlanId: item.annual_plan_id,
    planItemId: item.id,
    eventType: "preventive_offer_issued",
    stageKey: stageFromItemStatus(nextStatus),
    payload: {
      offer_id: offer?.id || null,
      offer_code: offer?.offer_code || null,
      valid_until: offer?.valid_until || null,
      anexo: "Anexo 4",
    },
    user,
  });

  return {
    offer,
    plan_item: updatedItem,
  };
};

const decidePreventiveOffer = async ({
  planItemId,
  decision,
  reason = null,
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const item = await getPlanItemById(planItemId);
  if (!item) {
    throw buildError("Ítem preventivo no encontrado para decidir oferta", {
      status: 404,
      code: "PREVENTIVE_OFFER_ITEM_NOT_FOUND",
    });
  }
  const normalizedDecision = String(decision || "").trim().toLowerCase();
  if (!["accepted", "rejected"].includes(normalizedDecision)) {
    throw buildError("Decisión de oferta inválida. Use accepted o rejected.", {
      status: 400,
      code: "PREVENTIVE_OFFER_DECISION_INVALID",
    });
  }

  const { rows: latestOfferRows } = await db.query(
    `
      SELECT *
      FROM servicio.preventive_offers
      WHERE plan_item_id = $1
      ORDER BY issued_at DESC, id DESC
      LIMIT 1
    `,
    [item.id],
  );
  const latestOffer = latestOfferRows[0];
  if (!latestOffer) {
    throw buildError("No existe oferta Anexo 4 para este ítem", {
      status: 409,
      code: "PREVENTIVE_OFFER_NOT_FOUND",
    });
  }

  const nextOfferStatus =
    normalizedDecision === "accepted" ? OFFER_STATUS.ACCEPTED : OFFER_STATUS.REJECTED;
  const { rows: updatedOfferRows } = await db.query(
    `
      UPDATE servicio.preventive_offers
      SET status = $1,
          decision_reason = $2,
          decision_at = now(),
          decided_by = $3,
          decided_by_email = $4,
          updated_at = now()
      WHERE id = $5
      RETURNING *
    `,
    [nextOfferStatus, normalizeText(reason), user?.id || null, user?.email || null, latestOffer.id],
  );
  const updatedOffer = updatedOfferRows[0] || null;

  const nextItemStatus =
    normalizedDecision === "accepted" ? ITEM_STATUS.OFFER_ACCEPTED : ITEM_STATUS.CANCELLED;
  const updatedItem = await updatePlanItemById({
    itemId: item.id,
    patch: {
      status: nextItemStatus,
      cancelled_reason: normalizedDecision === "rejected" ? normalizeText(reason) : null,
    },
  });
  await syncPlanItemWorkflow(updatedItem, user);
  await appendPreventiveEvent({
    annualPlanId: item.annual_plan_id,
    planItemId: item.id,
    eventType:
      normalizedDecision === "accepted" ? "preventive_offer_accepted" : "preventive_offer_rejected",
    stageKey: stageFromItemStatus(nextItemStatus),
    payload: {
      decision: normalizedDecision,
      reason: normalizeText(reason),
      offer_id: updatedOffer?.id || null,
      anexo: "Anexo 4",
    },
    user,
  });
  return {
    offer: updatedOffer,
    plan_item: updatedItem,
  };
};

const createReprogrammingNotice = async ({
  planItemId,
  newPlannedDate,
  reason,
  payload = {},
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const item = await getPlanItemById(planItemId);
  if (!item) {
    throw buildError("Ítem preventivo no encontrado para reprogramación", {
      status: 404,
      code: "PREVENTIVE_REPROGRAM_ITEM_NOT_FOUND",
    });
  }
  const normalizedReason = normalizeText(reason);
  if (!normalizedReason) {
    throw buildError("Debe registrar el motivo de reprogramación (Anexo 5)", {
      status: 400,
      code: "PREVENTIVE_REPROGRAM_REASON_REQUIRED",
    });
  }
  const nextDate = toDateOnly(newPlannedDate);
  if (!nextDate) {
    throw buildError("Debe enviar una nueva fecha programada válida", {
      status: 400,
      code: "PREVENTIVE_REPROGRAM_DATE_REQUIRED",
    });
  }
  const oldDate = toDateOnly(item.planned_date);
  if (!oldDate) {
    throw buildError("El ítem no tiene fecha programada inicial", {
      status: 409,
      code: "PREVENTIVE_REPROGRAM_OLD_DATE_MISSING",
    });
  }
  const { rows: noticeRows } = await db.query(
    `
      INSERT INTO servicio.preventive_reprogramming_notices (
        plan_item_id,
        original_planned_date,
        new_planned_date,
        reason,
        anexo5_payload,
        communicated_at,
        created_by,
        created_by_email,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5::jsonb,now(),$6,$7,now())
      RETURNING *
    `,
    [
      item.id,
      oldDate,
      nextDate,
      normalizedReason,
      JSON.stringify({
        ...normalizeObject(payload),
        anexo_code: "Anexo 5",
      }),
      user?.id || null,
      user?.email || null,
    ],
  );
  const notice = noticeRows[0] || null;

  const nextMonth = getMonthNumber(nextDate.slice(5, 7));
  const updatedItem = await updatePlanItemById({
    itemId: item.id,
    patch: {
      status: ITEM_STATUS.REPROGRAMMED,
      planned_date: nextDate,
      planned_month: nextMonth,
      reprogrammed_from_date: oldDate,
      reprogrammed_to_date: nextDate,
      notes: [item.notes, `Reprogramado (${oldDate} -> ${nextDate}): ${normalizedReason}`]
        .filter(Boolean)
        .join(" | "),
    },
  });
  await syncPlanItemWorkflow(updatedItem, user);
  await appendPreventiveEvent({
    annualPlanId: item.annual_plan_id,
    planItemId: item.id,
    eventType: "preventive_reprogrammed",
    stageKey: stageFromItemStatus(updatedItem.status),
    payload: {
      original_planned_date: oldDate,
      new_planned_date: nextDate,
      reason: normalizedReason,
      anexo: "Anexo 5",
      notice_id: notice?.id || null,
    },
    user,
  });
  return {
    notice,
    plan_item: updatedItem,
  };
};

const updatePlanItemCoordination = async ({
  planItemId,
  coordinatedAt = null,
  coordinationWindow = null,
  notes = null,
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const item = await getPlanItemById(planItemId);
  if (!item) {
    throw buildError("Ítem preventivo no encontrado para coordinación", {
      status: 404,
      code: "PREVENTIVE_COORDINATION_ITEM_NOT_FOUND",
    });
  }
  const effectiveCoordinationAt = toIsoDateTime(coordinatedAt, new Date().toISOString());
  const updatedItem = await updatePlanItemById({
    itemId: item.id,
    patch: {
      status: ITEM_STATUS.COORDINATED,
      coordinated_at: effectiveCoordinationAt,
      coordinated_by: user?.id || null,
      coordination_window: normalizeText(coordinationWindow),
      notes: [item.notes, normalizeText(notes)].filter(Boolean).join(" | "),
    },
  });
  await syncPlanItemWorkflow(updatedItem, user);
  await appendPreventiveEvent({
    annualPlanId: item.annual_plan_id,
    planItemId: item.id,
    eventType: "preventive_coordination_registered",
    stageKey: stageFromItemStatus(updatedItem.status),
    payload: {
      coordinated_at: effectiveCoordinationAt,
      coordination_window: normalizeText(coordinationWindow),
    },
    user,
  });
  return updatedItem;
};

const buildAutoWorkOrderCode = (itemId) => {
  const date = new Date();
  const datePart = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
  return `WO-PREV-${datePart}-${String(itemId).padStart(5, "0")}`;
};

const upsertPlanItemWorkOrder = async ({
  planItemId,
  workOrderNumber = null,
  autoCreate = true,
  notes = null,
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const item = await getPlanItemById(planItemId);
  if (!item) {
    throw buildError("Ítem preventivo no encontrado para WO", {
      status: 404,
      code: "PREVENTIVE_WO_ITEM_NOT_FOUND",
    });
  }
  const wo = normalizeText(workOrderNumber) || (autoCreate ? buildAutoWorkOrderCode(item.id) : null);
  if (!wo) {
    throw buildError("Debe registrar número de WO preventiva", {
      status: 400,
      code: "PREVENTIVE_WO_REQUIRED",
    });
  }
  const nextStatus =
    item.status === ITEM_STATUS.KIT_REQUESTED ||
    item.status === ITEM_STATUS.KIT_READY ||
    item.status === ITEM_STATUS.IN_EXECUTION ||
    item.status === ITEM_STATUS.COMPLETED
      ? item.status
      : ITEM_STATUS.COORDINATED;
  const updatedItem = await updatePlanItemById({
    itemId: item.id,
    patch: {
      status: nextStatus,
      work_order_number: wo,
      notes: [item.notes, normalizeText(notes)].filter(Boolean).join(" | "),
    },
  });
  await syncPlanItemWorkflow(updatedItem, user);
  await appendPreventiveEvent({
    annualPlanId: item.annual_plan_id,
    planItemId: item.id,
    eventType: "preventive_work_order_registered",
    stageKey: stageFromItemStatus(updatedItem.status),
    payload: { work_order_number: wo, auto_created: !normalizeText(workOrderNumber) && autoCreate },
    user,
  });
  return updatedItem;
};

const withinKitRequestWindow = ({ plannedDate, requestedAt }) => {
  const planDate = toDateOnly(plannedDate);
  if (!planDate) return { ok: false, window: null };
  const requested = requestedAt instanceof Date ? requestedAt : new Date(requestedAt || new Date());
  if (Number.isNaN(requested.getTime())) return { ok: false, window: null };
  const [year, month] = planDate.split("-").map((value) => Number(value));
  const previousMonthDate = new Date(Date.UTC(year, month - 1, 0));
  const windowEnd = new Date(Date.UTC(previousMonthDate.getUTCFullYear(), previousMonthDate.getUTCMonth(), previousMonthDate.getUTCDate(), 23, 59, 59));
  const windowStart = new Date(windowEnd.getTime());
  windowStart.setUTCDate(windowStart.getUTCDate() - 9);
  return {
    ok: requested.getTime() >= windowStart.getTime() && requested.getTime() <= windowEnd.getTime(),
    window: {
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
    },
  };
};

const requestPreventiveKit = async ({
  planItemId,
  observations = null,
  requestedAt = null,
  workOrderNumber = null,
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const item = await getPlanItemById(planItemId);
  if (!item) {
    throw buildError("Ítem preventivo no encontrado para solicitud de kit", {
      status: 404,
      code: "PREVENTIVE_KIT_ITEM_NOT_FOUND",
    });
  }
  const requestDate = requestedAt ? new Date(requestedAt) : new Date();
  const windowCheck = withinKitRequestWindow({
    plannedDate: item.planned_date,
    requestedAt: requestDate,
  });
  if (!windowCheck.ok) {
    throw buildError("La solicitud de kit está fuera de la ventana de 10 días del mes previo", {
      status: 409,
      code: "PREVENTIVE_KIT_WINDOW_INVALID",
      details: windowCheck.window,
    });
  }

  const woNumber = normalizeText(workOrderNumber) || normalizeText(item.work_order_number);
  if (!woNumber) {
    throw buildError("La solicitud de kit requiere número de WO", {
      status: 409,
      code: "PREVENTIVE_KIT_WO_REQUIRED",
    });
  }

  const serializedObservations = [
    `CLIENTE: ${item.client_name || "N/D"}`,
    `EQUIPO: ${item.equipment_name || `#${item.equipment_id}`}`,
    `SERIE: ${item.equipment_serial || "N/D"}`,
    `WO: ${woNumber}`,
    normalizeText(observations) || null,
  ]
    .filter(Boolean)
    .join(" | ");

  const requestMonth = requestDate.getUTCMonth() + 1;
  const requestYear = requestDate.getUTCFullYear();

  const { rows } = await db.query(
    `
      INSERT INTO servicio.preventive_kit_requests (
        plan_item_id,
        requested_at,
        request_month,
        request_year,
        status,
        wo_number,
        client_name,
        equipment_name,
        equipment_serial,
        observations,
        created_by,
        created_by_email,
        updated_at
      )
      VALUES ($1,$2,$3,$4,'${KIT_STATUS.REQUESTED}',$5,$6,$7,$8,$9,$10,$11,now())
      RETURNING *
    `,
    [
      item.id,
      requestDate.toISOString(),
      requestMonth,
      requestYear,
      woNumber,
      item.client_name || null,
      item.equipment_name || null,
      item.equipment_serial || null,
      serializedObservations,
      user?.id || null,
      user?.email || null,
    ],
  );
  const kitRequest = rows[0] || null;

  const updatedItem = await updatePlanItemById({
    itemId: item.id,
    patch: {
      status: ITEM_STATUS.KIT_REQUESTED,
      work_order_number: woNumber,
      notes: [item.notes, `Kit solicitado (${requestDate.toISOString().slice(0, 10)})`]
        .filter(Boolean)
        .join(" | "),
    },
  });
  await syncPlanItemWorkflow(updatedItem, user);
  await appendPreventiveEvent({
    annualPlanId: item.annual_plan_id,
    planItemId: item.id,
    eventType: "preventive_kit_requested",
    stageKey: stageFromItemStatus(updatedItem.status),
    payload: {
      kit_request_id: kitRequest?.id || null,
      request_month: requestMonth,
      request_year: requestYear,
      work_order_number: woNumber,
    },
    user,
  });
  return {
    kit_request: kitRequest,
    plan_item: updatedItem,
  };
};

const registerKitWarehouseExit = async ({
  kitRequestId,
  warehouseExitAt = null,
  warehouseExitReference = null,
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const id = normalizeInt(kitRequestId);
  if (!id) {
    throw buildError("kitRequestId inválido", {
      status: 400,
      code: "PREVENTIVE_KIT_ID_INVALID",
    });
  }
  const { rows: kitRows } = await db.query(
    `
      SELECT *
      FROM servicio.preventive_kit_requests
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );
  const kit = kitRows[0];
  if (!kit) {
    throw buildError("Solicitud de kit no encontrada", {
      status: 404,
      code: "PREVENTIVE_KIT_NOT_FOUND",
    });
  }
  const exitAt = toIsoDateTime(warehouseExitAt, new Date().toISOString());
  const { rows: updatedKitRows } = await db.query(
    `
      UPDATE servicio.preventive_kit_requests
      SET status = '${KIT_STATUS.WAREHOUSE_OUT}',
          warehouse_exit_at = $1,
          warehouse_exit_reference = $2,
          updated_at = now()
      WHERE id = $3
      RETURNING *
    `,
    [exitAt, normalizeText(warehouseExitReference), kit.id],
  );
  const updatedKit = updatedKitRows[0] || null;

  const item = await getPlanItemById(kit.plan_item_id);
  const updatedItem = await updatePlanItemById({
    itemId: kit.plan_item_id,
    patch: {
      status: ITEM_STATUS.KIT_READY,
    },
  });
  await syncPlanItemWorkflow(updatedItem, user);
  await appendPreventiveEvent({
    annualPlanId: item?.annual_plan_id || null,
    planItemId: kit.plan_item_id,
    eventType: "preventive_kit_warehouse_exit",
    stageKey: stageFromItemStatus(updatedItem.status),
    payload: {
      kit_request_id: updatedKit?.id || null,
      warehouse_exit_at: updatedKit?.warehouse_exit_at || null,
      warehouse_exit_reference: updatedKit?.warehouse_exit_reference || null,
    },
    user,
  });
  return {
    kit_request: updatedKit,
    plan_item: updatedItem,
  };
};

const upsertLegacyMaintenanceClosure = async ({
  item,
  executedAt,
  onTime,
  user,
  notes = null,
} = {}) => {
  if (!item?.equipment_id) return null;
  const executedDate = toDateOnly(executedAt);
  const state = onTime ? "Cumplido" : "No Cumplido";
  const { rows: existingRows } = await db.query(
    `
      SELECT id
      FROM servicio.cronograma_mantenimientos
      WHERE preventive_plan_item_id = $1
      LIMIT 1
    `,
    [item.id],
  );
  const baseObservations = [
    `Cierre preventivo ST-01-02`,
    `Plan ${item.annual_plan_id}, Ítem ${item.id}`,
    normalizeText(notes),
  ]
    .filter(Boolean)
    .join(" | ");

  if (existingRows[0]?.id) {
    const { rows } = await db.query(
      `
        UPDATE servicio.cronograma_mantenimientos
        SET id_equipo = $1,
            tipo = 'Preventivo',
            responsable = COALESCE($2, responsable),
            fecha_programada = COALESCE($3, fecha_programada),
            fecha_realizacion = $4,
            estado = $5,
            observaciones = $6,
            compliance_month_match = $7,
            procedure_code = '${PROCEDURE_CODE}',
            updated_at = now()
        WHERE id = $8
        RETURNING *
      `,
      [
        item.equipment_id,
        user?.email || null,
        item.planned_date || null,
        executedDate,
        state,
        baseObservations,
        onTime,
        existingRows[0].id,
      ],
    );
    return rows[0] || null;
  }

  const { rows } = await db.query(
    `
      INSERT INTO servicio.cronograma_mantenimientos (
        id_equipo,
        tipo,
        responsable,
        fecha_programada,
        fecha_realizacion,
        estado,
        observaciones,
        created_by,
        preventive_plan_id,
        preventive_plan_item_id,
        compliance_month_match,
        procedure_code,
        created_at,
        updated_at
      )
      VALUES ($1,'Preventivo',$2,$3,$4,$5,$6,$7,$8,$9,$10,'${PROCEDURE_CODE}',now(),now())
      RETURNING *
    `,
    [
      item.equipment_id,
      user?.email || null,
      item.planned_date || null,
      executedDate,
      state,
      baseObservations,
      user?.id || null,
      item.annual_plan_id || null,
      item.id,
      onTime,
    ],
  );
  return rows[0] || null;
};

const registerPreventiveExecution = async ({
  planItemId,
  executedAt = null,
  durationMinutes = null,
  activities = [],
  partsReplaced = [],
  consumables = [],
  evidence = [],
  reportPayload = {},
  workOrderNumber = null,
  notes = null,
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const item = await getPlanItemById(planItemId);
  if (!item) {
    throw buildError("Ítem preventivo no encontrado para cierre", {
      status: 404,
      code: "PREVENTIVE_EXECUTION_ITEM_NOT_FOUND",
    });
  }
  const wo = normalizeText(workOrderNumber || item.work_order_number);
  if (!wo) {
    throw buildError("El cierre preventivo requiere WO", {
      status: 409,
      code: "PREVENTIVE_EXECUTION_WO_REQUIRED",
    });
  }
  const executionDate = executedAt ? new Date(executedAt) : new Date();
  if (Number.isNaN(executionDate.getTime())) {
    throw buildError("executed_at inválido", {
      status: 400,
      code: "PREVENTIVE_EXECUTION_DATE_INVALID",
    });
  }
  const executionMonth = executionDate.getUTCMonth() + 1;
  const executionYear = executionDate.getUTCFullYear();

  const { rows: executionRows } = await db.query(
    `
      INSERT INTO servicio.preventive_execution_reports (
        plan_item_id,
        executed_at,
        execution_month,
        execution_year,
        wo_number,
        duration_minutes,
        activities,
        parts_replaced,
        consumables,
        evidence,
        report_payload,
        performed_by,
        performed_by_email,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,now(),now())
      RETURNING *
    `,
    [
      item.id,
      executionDate.toISOString(),
      executionMonth,
      executionYear,
      wo,
      normalizeInt(durationMinutes),
      JSON.stringify(normalizeArray(activities)),
      JSON.stringify(normalizeArray(partsReplaced)),
      JSON.stringify(normalizeArray(consumables)),
      JSON.stringify(normalizeArray(evidence)),
      JSON.stringify(normalizeObject(reportPayload)),
      user?.id || null,
      user?.email || null,
    ],
  );
  const execution = executionRows[0] || null;

  const plannedDate = new Date(`${toDateOnly(item.planned_date)}T00:00:00Z`);
  const onTime =
    plannedDate.getUTCMonth() + 1 === executionMonth &&
    plannedDate.getUTCFullYear() === executionYear;

  const updatedItem = await updatePlanItemById({
    itemId: item.id,
    patch: {
      status: ITEM_STATUS.COMPLETED,
      work_order_number: wo,
      last_execution_at: executionDate.toISOString(),
      execution_result: onTime ? "completed_on_time" : "completed_out_of_period",
      notes: [item.notes, normalizeText(notes)].filter(Boolean).join(" | "),
    },
  });
  await upsertLegacyMaintenanceClosure({
    item: updatedItem,
    executedAt: executionDate.toISOString(),
    onTime,
    user,
    notes,
  });
  await syncPlanItemWorkflow(updatedItem, user);
  await appendPreventiveEvent({
    annualPlanId: item.annual_plan_id,
    planItemId: item.id,
    eventType: "preventive_execution_closed",
    stageKey: "completed",
    payload: {
      execution_id: execution?.id || null,
      executed_at: execution?.executed_at || null,
      execution_month: executionMonth,
      execution_year: executionYear,
      work_order_number: wo,
      compliance_on_time: onTime,
      anexo: "Anexo 6",
      document: "F.ST-17",
    },
    user,
  });
  return {
    execution_report: execution,
    plan_item: updatedItem,
    compliance_on_time: onTime,
  };
};

const registerPreventiveDocument = async ({
  annualPlanId = null,
  planItemId = null,
  documentCode,
  driveFileId = null,
  driveLink = null,
  templateMode = null,
  payload = {},
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const normalizedDocumentCode = String(documentCode || "").trim().toUpperCase();
  if (!normalizedDocumentCode) {
    throw buildError("documentCode es obligatorio", {
      status: 400,
      code: "PREVENTIVE_DOCUMENT_CODE_REQUIRED",
    });
  }
  const { rows } = await db.query(
    `
      INSERT INTO servicio.preventive_documents (
        annual_plan_id,
        plan_item_id,
        document_code,
        drive_file_id,
        drive_link,
        template_mode,
        payload,
        created_by,
        created_by_email,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,now())
      RETURNING *
    `,
    [
      normalizeInt(annualPlanId),
      normalizeInt(planItemId),
      normalizedDocumentCode,
      normalizeText(driveFileId),
      normalizeText(driveLink),
      normalizeText(templateMode),
      JSON.stringify(normalizeObject(payload)),
      user?.id || null,
      user?.email || null,
    ],
  );
  const row = rows[0] || null;
  await appendPreventiveEvent({
    annualPlanId: normalizeInt(annualPlanId),
    planItemId: normalizeInt(planItemId),
    eventType: "preventive_document_registered",
    stageKey: "scheduled",
    payload: {
      document_code: normalizedDocumentCode,
      drive_file_id: normalizeText(driveFileId),
      template_mode: normalizeText(templateMode),
    },
    user,
  });
  return row;
};

const computeComplianceRow = (item) => {
  const plannedDate = toDateOnly(item?.planned_date);
  const plannedYear = normalizeInt(plannedDate?.slice(0, 4));
  const plannedMonth = normalizeInt(plannedDate?.slice(5, 7));
  const executionDate = toDateOnly(item?.last_execution_at);
  const executionYear = normalizeInt(executionDate?.slice(0, 4));
  const executionMonth = normalizeInt(executionDate?.slice(5, 7));
  const onTime =
    plannedYear &&
    plannedMonth &&
    executionYear &&
    executionMonth &&
    plannedYear === executionYear &&
    plannedMonth === executionMonth;
  return {
    ...item,
    planned_year: plannedYear,
    planned_month: plannedMonth,
    execution_year: executionYear,
    execution_month: executionMonth,
    compliance_on_time: Boolean(onTime),
  };
};

const listPreventiveCompliance = async ({
  year = null,
  month = null,
  annualPlanId = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const filters = [];
  const params = [];
  if (normalizeInt(annualPlanId)) {
    params.push(normalizeInt(annualPlanId));
    filters.push(`pi.annual_plan_id = $${params.length}`);
  }
  if (normalizeInt(year)) {
    params.push(normalizeInt(year));
    filters.push(`EXTRACT(YEAR FROM pi.planned_date) = $${params.length}`);
  }
  if (normalizeInt(month)) {
    params.push(normalizeInt(month));
    filters.push(`EXTRACT(MONTH FROM pi.planned_date) = $${params.length}`);
  }

  const { rows } = await db.query(
    `
      SELECT
        pi.*,
        p.plan_year,
        p.version,
        p.status AS plan_status
      FROM servicio.preventive_plan_items pi
      JOIN servicio.preventive_annual_plans p ON p.id = pi.annual_plan_id
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY pi.planned_date ASC, pi.id ASC
    `,
    params,
  );
  const normalized = rows.map(computeComplianceRow);

  const effective = normalized.filter(
    (row) => ![ITEM_STATUS.CANCELLED, ITEM_STATUS.OFFER_REJECTED].includes(String(row.status || "").toLowerCase()),
  );
  const onTime = effective.filter((row) => row.compliance_on_time).length;
  const completedOut = effective.filter(
    (row) => row.status === ITEM_STATUS.COMPLETED && !row.compliance_on_time,
  ).length;
  const pending = effective.filter((row) => row.status !== ITEM_STATUS.COMPLETED).length;
  const complianceRate = effective.length > 0 ? Number(((onTime / effective.length) * 100).toFixed(2)) : 0;

  const byMonth = Array.from({ length: 12 }).map((_, index) => {
    const monthValue = index + 1;
    const monthRows = normalized.filter((row) => row.planned_month === monthValue);
    const monthEffective = monthRows.filter(
      (row) => ![ITEM_STATUS.CANCELLED, ITEM_STATUS.OFFER_REJECTED].includes(String(row.status || "").toLowerCase()),
    );
    const monthOnTime = monthEffective.filter((row) => row.compliance_on_time).length;
    const monthRate =
      monthEffective.length > 0
        ? Number(((monthOnTime / monthEffective.length) * 100).toFixed(2))
        : 0;
    return {
      month: monthValue,
      total: monthRows.length,
      effective_total: monthEffective.length,
      on_time: monthOnTime,
      rate: monthRate,
    };
  });

  return {
    summary: {
      total_items: normalized.length,
      effective_items: effective.length,
      on_time_completed: onTime,
      completed_out_of_period: completedOut,
      pending_or_in_progress: pending,
      compliance_rate: complianceRate,
      rule:
        "Cumplido solo si la ejecución ocurre en el mismo mes planificado (REQ-ST-096)",
    },
    by_month: byMonth,
    rows: normalized,
  };
};

const getPreventiveCapacitySummary = async ({
  annualPlanId = null,
  year = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  let plan = null;
  if (normalizeInt(annualPlanId)) {
    plan = await getPlanAggregate(normalizeInt(annualPlanId));
  } else {
    const selectedYear = normalizeInt(year, new Date().getUTCFullYear());
    const { rows } = await db.query(
      `
        SELECT *
        FROM servicio.preventive_annual_plans
        WHERE plan_year = $1
        ORDER BY
          CASE WHEN status = '${PLAN_STATUS.ACTIVE}' THEN 0 ELSE 1 END,
          version DESC
        LIMIT 1
      `,
      [selectedYear],
    );
    plan = rows[0] || null;
  }

  if (!plan) {
    return {
      plan: null,
      months: [],
      capacity: {
        engineers_count: 0,
        working_days_per_month: 0,
        hours_per_day: 0,
      },
    };
  }

  const items = await getPreventivePlanItems(plan.id);
  const capacity = normalizeObject(plan.anexo7_capacity);
  const engineers = Math.max(1, normalizeInt(capacity.engineers_count, 1));
  const workingDays = Math.max(1, normalizeInt(capacity.working_days_per_month, 20));
  const hoursPerDay = Math.max(1, normalizeFloat(capacity.hours_per_day, 8));
  const availableMinutes = engineers * workingDays * hoursPerDay * 60;

  const months = Array.from({ length: 12 }).map((_, index) => {
    const month = index + 1;
    const monthItems = items.filter((item) => Number(item.planned_month) === month);
    const loadMinutes = monthItems.reduce(
      (sum, item) => sum + Math.max(30, normalizeInt(item.estimated_minutes, 180) || 180),
      0,
    );
    const utilization = availableMinutes > 0 ? Number(((loadMinutes / availableMinutes) * 100).toFixed(2)) : 0;
    return {
      month,
      item_count: monthItems.length,
      load_minutes: loadMinutes,
      available_minutes: availableMinutes,
      utilization_pct: utilization,
      over_capacity: utilization > 100,
    };
  });

  return {
    plan: {
      id: plan.id,
      plan_year: plan.plan_year,
      version: plan.version,
      status: plan.status,
      title: plan.title,
    },
    capacity: {
      engineers_count: engineers,
      working_days_per_month: workingDays,
      hours_per_day: hoursPerDay,
      available_minutes_per_month: availableMinutes,
      source: "Anexo 7",
    },
    months,
  };
};

const sendPreventiveMonthlyProgressReport = async ({
  annualPlanId,
  month = null,
  recipients = [],
  user = null,
} = {}) => {
  await ensurePreventivePlanningTables();
  const planId = normalizeInt(annualPlanId);
  if (!planId) {
    throw buildError("annualPlanId inválido", {
      status: 400,
      code: "PREVENTIVE_MONTHLY_REPORT_PLAN_REQUIRED",
    });
  }
  const detail = await getPreventiveAnnualPlanDetail(planId);
  if (!detail) {
    throw buildError("Plan preventivo no encontrado", {
      status: 404,
      code: "PREVENTIVE_MONTHLY_REPORT_PLAN_NOT_FOUND",
    });
  }

  const targetMonth = getMonthNumber(month, new Date().getUTCMonth() + 1);
  const monthRows = detail.items.filter((item) => Number(item.planned_month) === targetMonth);
  const onTime = monthRows.filter((row) => computeComplianceRow(row).compliance_on_time).length;
  const completed = monthRows.filter((row) => row.status === ITEM_STATUS.COMPLETED).length;
  const pending = monthRows.filter((row) => row.status !== ITEM_STATUS.COMPLETED).length;
  const recipientsList = Array.from(
    new Set(
      [...normalizeArray(recipients), process.env.SMTP_FROM, process.env.SMTP_TO]
        .map((mail) => String(mail || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (recipientsList.length > 0) {
    await sendMail({
      to: recipientsList,
      subject: `Avance mensual F.ST-16 (${detail.plan_year}) - Mes ${targetMonth}`,
      html: `
        <p>Reporte mensual del plan preventivo <strong>${detail.title || detail.id}</strong>.</p>
        <ul>
          <li>Mes: ${targetMonth}</li>
          <li>Total planificado: ${monthRows.length}</li>
          <li>Completados: ${completed}</li>
          <li>Cumplidos en mismo mes (REQ-ST-096): ${onTime}</li>
          <li>Pendientes: ${pending}</li>
        </ul>
        <p>Generado por: ${user?.email || "sistema"}.</p>
      `,
    });
  }
  await appendPreventiveEvent({
    annualPlanId: detail.id,
    eventType: "preventive_monthly_report_sent",
    stageKey: "scheduled",
    payload: {
      month: targetMonth,
      recipients: recipientsList,
      total_planned: monthRows.length,
      completed,
      on_time: onTime,
      pending,
    },
    user,
  });
  return {
    annual_plan_id: detail.id,
    month: targetMonth,
    recipients: recipientsList,
    totals: {
      planned: monthRows.length,
      completed,
      on_time: onTime,
      pending,
    },
  };
};

const listPreventiveTimeline = async ({ annualPlanId = null, planItemId = null, limit = 200 } = {}) => {
  await ensurePreventivePlanningTables();
  const safeLimit = Math.max(1, Math.min(500, normalizeInt(limit, 200)));
  const filters = [];
  const params = [];
  if (normalizeInt(annualPlanId)) {
    params.push(normalizeInt(annualPlanId));
    filters.push(`annual_plan_id = $${params.length}`);
  }
  if (normalizeInt(planItemId)) {
    params.push(normalizeInt(planItemId));
    filters.push(`plan_item_id = $${params.length}`);
  }
  if (!filters.length) return [];
  params.push(safeLimit);
  const { rows } = await db.query(
    `
      SELECT *
      FROM servicio.preventive_case_events
      WHERE ${filters.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${params.length}
    `,
    params,
  );
  return rows || [];
};

const listPreventiveHistory = async ({
  equipmentId = null,
  clientName = null,
  limit = 200,
} = {}) => {
  await ensurePreventivePlanningTables();
  const safeLimit = Math.max(1, Math.min(500, normalizeInt(limit, 200)));
  const filters = [];
  const params = [];
  if (normalizeInt(equipmentId)) {
    params.push(normalizeInt(equipmentId));
    filters.push(`pi.equipment_id = $${params.length}`);
  }
  if (normalizeText(clientName)) {
    params.push(`%${normalizeText(clientName).toLowerCase()}%`);
    filters.push(`LOWER(COALESCE(pi.client_name, '')) LIKE $${params.length}`);
  }
  if (!filters.length) return [];
  params.push(safeLimit);
  const { rows } = await db.query(
    `
      SELECT
        pi.id AS plan_item_id,
        pi.annual_plan_id,
        pi.equipment_id,
        pi.equipment_name,
        pi.equipment_serial,
        pi.client_name,
        pi.planned_date,
        pi.status,
        pi.last_execution_at,
        er.id AS execution_report_id,
        er.evidence,
        er.parts_replaced,
        er.consumables,
        er.wo_number,
        pd.document_code,
        pd.drive_file_id,
        pd.drive_link,
        pd.created_at AS document_created_at
      FROM servicio.preventive_plan_items pi
      LEFT JOIN LATERAL (
        SELECT e.*
        FROM servicio.preventive_execution_reports e
        WHERE e.plan_item_id = pi.id
        ORDER BY e.executed_at DESC, e.id DESC
        LIMIT 1
      ) er ON true
      LEFT JOIN LATERAL (
        SELECT d.*
        FROM servicio.preventive_documents d
        WHERE d.plan_item_id = pi.id
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 1
      ) pd ON true
      WHERE ${filters.join(" AND ")}
      ORDER BY COALESCE(pi.last_execution_at, pi.updated_at) DESC
      LIMIT $${params.length}
    `,
    params,
  );
  return rows || [];
};

module.exports = {
  PLAN_STATUS,
  ITEM_STATUS,
  OFFER_STATUS,
  KIT_STATUS,
  ensurePreventivePlanningTables,
  listPreventiveAnnualPlans,
  getPreventiveAnnualPlanDetail,
  getPreventivePlanItems,
  getPlanItemById,
  createPreventiveAnnualPlan,
  publishPreventiveAnnualPlan,
  rebaselinePreventiveAnnualPlan,
  createPreventiveOffer,
  decidePreventiveOffer,
  createReprogrammingNotice,
  updatePlanItemCoordination,
  upsertPlanItemWorkOrder,
  requestPreventiveKit,
  registerKitWarehouseExit,
  registerPreventiveExecution,
  registerPreventiveDocument,
  listPreventiveCompliance,
  getPreventiveCapacitySummary,
  sendPreventiveMonthlyProgressReport,
  listPreventiveTimeline,
  listPreventiveHistory,
  appendPreventiveEvent,
};
