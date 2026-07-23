const axios = require("axios");
const crypto = require("crypto");
const db = require("../../config/db");
const logger = require("../../config/logger");
const idempotencyService = require("./businessCaseIdempotency.service");
const investmentsService = require("./investments.service");
const bcLabEnvironmentService = require("./bcLabEnvironment.service");
const bcEquipmentDetailsService = require("./bcEquipmentDetails.service");
const bcLisIntegrationService = require("./bcLisIntegration.service");
const bcRequirementsService = require("./bcRequirements.service");
const bcDeliveriesService = require("./bcDeliveries.service");
const { ensureBusinessCaseDriveFolderById } = require("./businessCaseDriveFolder.service");
const {
  loadTemplateDefinition,
  buildSheetPayloads,
  syncBusinessCaseToGoogleSheet,
} = require("./businessCaseSheetSyncLocal.service");
const {
  resolveSheetSyncOutcome,
  mergeSheetGenerationHistory,
} = require("./businessCaseSheetVersioning.helper");
const {
  validateGenerationRequest,
  buildSignedWebAppPayload,
  DEFAULT_MAPPING_VERSION,
} = require("./businessCaseSheetGeneration.contract");
const {
  filterEquipmentPairsForSheet,
  shouldIncludeBackupInSheet,
} = require("./businessCaseSheetEquipment.helper");

const OPERATION_SCOPE_ENQUEUE = "bc_sheet_generation_enqueue_v1";
const RETRYABLE_ERROR_CODES = new Set([
  "INTERNAL_ERROR",
  "TIMEOUT_ERROR",
  "NETWORK_ERROR",
  "WEBAPP_5XX",
  "WEBAPP_CIRCUIT_OPEN",
]);
const NON_RETRYABLE_WEBAPP_CODES = new Set([
  "AUTH_ERROR",
  "VALIDATION_ERROR",
  "MAPPING_VERSION_ERROR",
  "TEMPLATE_NOT_FOUND",
]);

const WEBAPP_URL = process.env.BC_SHEET_WEBAPP_URL || "";
const WEBAPP_SECRET = process.env.BC_SHEET_WEBAPP_SECRET || "";
const WEBAPP_TOKEN = process.env.BC_SHEET_WEBAPP_TOKEN || WEBAPP_SECRET;
const WEBAPP_TIMEOUT_MS = Number(process.env.BC_SHEET_WEBAPP_TIMEOUT_MS || 12000);
const CIRCUIT_FAILURE_THRESHOLD = Number(process.env.BC_SHEET_CIRCUIT_FAILURE_THRESHOLD || 5);
const CIRCUIT_RESET_MS = Number(process.env.BC_SHEET_CIRCUIT_RESET_MS || 60000);
const MAX_ATTEMPTS_DEFAULT = Number(process.env.BC_SHEET_MAX_ATTEMPTS || 3);
const SHEET_PROVIDER = String(process.env.BC_SHEET_PROVIDER || "local").trim().toLowerCase();
const DELIVERY_TYPE_LABELS = Object.freeze({
  total: "Total",
  partial_time: "Parcial - Tiempo",
  partial_need: "Parcial a necesidad",
});

let tableReady = false;
let tablePromise = null;

class CircuitBreaker {
  constructor({ threshold = 5, resetMs = 60000 } = {}) {
    this.threshold = Math.max(1, Number(threshold || 5));
    this.resetMs = Math.max(5000, Number(resetMs || 60000));
    this.failures = 0;
    this.state = "closed"; // closed | open | half_open
    this.openedAt = 0;
  }

  isOpen() {
    if (this.state !== "open") return false;
    if (Date.now() - this.openedAt >= this.resetMs) {
      this.state = "half_open";
      return false;
    }
    return true;
  }

  onSuccess() {
    this.failures = 0;
    this.state = "closed";
    this.openedAt = 0;
  }

  onFailure() {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  snapshot() {
    return {
      state: this.state,
      failures: this.failures,
      threshold: this.threshold,
      reset_ms: this.resetMs,
      opened_at: this.openedAt ? new Date(this.openedAt).toISOString() : null,
    };
  }
}

const webAppCircuitBreaker = new CircuitBreaker({
  threshold: CIRCUIT_FAILURE_THRESHOLD,
  resetMs: CIRCUIT_RESET_MS,
});

function createAppError(message, { status = 400, code = "REQUEST_ERROR", retryable = false, details = null } = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.retryable = Boolean(retryable);
  if (details !== null && details !== undefined) error.details = details;
  return error;
}

function isUniqueViolation(error, constraintName = "") {
  const code = String(error?.code || "");
  if (code !== "23505") return false;
  if (!constraintName) return true;
  return String(error?.constraint || "").toLowerCase() === String(constraintName).toLowerCase();
}

async function ensureQueueTable() {
  if (tableReady) return;
  if (tablePromise) return tablePromise;

  tablePromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.bc_sheet_generation_jobs (
        id BIGSERIAL PRIMARY KEY,
        business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
        request_id UUID NOT NULL,
        idempotency_key VARCHAR(200) NOT NULL,
        mapping_version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payload_hash VARCHAR(64) NOT NULL,
        request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        locked_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        sheet_id TEXT,
        sheet_url TEXT,
        worker_response JSONB,
        error_code TEXT,
        error_message TEXT,
        correlation_id UUID,
        created_by INTEGER REFERENCES public.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT bc_sheet_generation_jobs_status_check
          CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        CONSTRAINT bc_sheet_generation_jobs_attempts_check
          CHECK (attempts >= 0 AND max_attempts >= 1),
        CONSTRAINT bc_sheet_generation_jobs_payload_hash_check
          CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
        CONSTRAINT bc_sheet_generation_jobs_unique_request_id UNIQUE (request_id),
        CONSTRAINT bc_sheet_generation_jobs_unique_idempotency UNIQUE (business_case_id, idempotency_key)
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_bc_sheet_jobs_status_retry
        ON public.bc_sheet_generation_jobs (status, next_retry_at, id)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_bc_sheet_jobs_business_case
        ON public.bc_sheet_generation_jobs (business_case_id, created_at DESC)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_bc_sheet_jobs_correlation
        ON public.bc_sheet_generation_jobs (correlation_id)
    `);

    tableReady = true;
  })();

  try {
    await tablePromise;
  } finally {
    tablePromise = null;
  }
}

async function assertBusinessCaseExists(businessCaseId) {
  const { rows } = await db.query(
    `SELECT id, request_type, uses_modern_system, client_name, bc_purchase_type, drive_folder_id,
            bc_equipment_cost,
            process_code, contract_object, modern_bc_metadata, extra, canonical_state
       FROM equipment_purchase_requests
      WHERE id = $1
      LIMIT 1`,
    [businessCaseId],
  );
  const row = rows[0];
  if (!row) {
    throw createAppError("Business Case no encontrado", {
      status: 404,
      code: "BUSINESS_CASE_NOT_FOUND",
      retryable: false,
    });
  }
  if (row.request_type !== "business_case") {
    throw createAppError("La solicitud indicada no corresponde a un Business Case", {
      status: 400,
      code: "INVALID_BUSINESS_CASE_TYPE",
      retryable: false,
    });
  }
  if (row.uses_modern_system === false) {
    throw createAppError("El Business Case legacy no soporta esta operacion", {
      status: 400,
      code: "LEGACY_BUSINESS_CASE_UNSUPPORTED",
      retryable: false,
    });
  }

  return row;
}

function toObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function pickFirst(...values) {
  for (const value of values) {
    if (hasValue(value)) return value;
  }
  return null;
}

function setFieldIfPresent(target, key, value) {
  if (!hasValue(value)) return;
  target[key] = value;
}

function normalizePurchaseTypeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("public")) return "publico";
  if (normalized.includes("priv")) return "privado";
  return normalized;
}

function normalizeEquipmentTypeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "new_available") return "Nuevo";
  if (normalized === "installed_client") return "Instalado en cliente";
  if (normalized === "cu") return "CU";
  return value;
}

function normalizeDeliveryTypeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  return DELIVERY_TYPE_LABELS[normalized] || value;
}

function normalizeInvestmentNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBool(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "Si" : "No";
  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "si" || s === "sí") return "Si";
  if (s === "false" || s === "0" || s === "no") return "No";
  return value;
}

async function getEquipmentNamesMapByIds(ids = []) {
  const cleanIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
  if (!cleanIds.length) return new Map();

  // equipment_id de v_equipment_full_catalog es servicio.equipos.id_equipo, la
  // misma tabla que bc_equipment_selection -- no public.equipment_models (tabla
  // huerfana sin FK real, siempre vacia para ids reales de BC).
  const { rows } = await db.query(
    `
    SELECT equipment_id::int AS id, equipment_name::text AS name
    FROM v_equipment_full_catalog
    WHERE equipment_id = ANY($1::int[])
    `,
    [cleanIds],
  );

  const map = new Map();
  rows.forEach((row) => {
    map.set(Number(row.id), row.name || null);
  });
  return map;
}

async function getEquipmentCatalogMapByIds(ids = []) {
  const cleanIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
  if (!cleanIds.length) return new Map();

  // equipment_id aqui es servicio.equipos.id_equipo (ver comentario arriba).
  const { rows } = await db.query(
    `
    SELECT equipment_id AS id, equipment_name AS name, equipment_code AS code, model
    FROM v_equipment_full_catalog
    WHERE equipment_id = ANY($1::int[])
    `,
    [cleanIds],
  );

  const map = new Map();
  rows.forEach((row) => {
    map.set(Number(row.id), {
      id: Number(row.id),
      name: row.name || null,
      code: row.code || null,
      model: row.model || null,
    });
  });
  return map;
}

function buildInversionesPayload(investments = []) {
  const out = {};
  const safeInvestments = Array.isArray(investments) ? investments : [];
  safeInvestments
    .filter((item) => Boolean(item?.selected))
    .forEach((item) => {
      const name = String(item?.name || "").trim();
      if (!name) return;
      const cantidad = normalizeInvestmentNumber(item?.quantity);
      const precio = normalizeInvestmentNumber(item?.unit_price);
      out[name] = {
        nombre: name,
        categoria: String(item?.category || "").trim(),
        caracteristicas: String(item?.characteristics || "").trim(),
        observaciones: String(item?.notes || "").trim(),
        cantidad: cantidad === null ? 0 : cantidad,
        precio: precio === null ? 0 : precio,
        descripcion: String(item?.characteristics || item?.notes || name || "").trim(),
      };
    });
  return out;
}

async function getMaximumQuantitiesByBusinessCaseId(businessCaseId) {
  try {
    const { rows } = await db.query(
      `
      SELECT
        c.item_key,
        c.item_id,
        c.name AS item_name,
        c.item_type,
        c.source,
        c.equipment_id,
        c.equipment_name,
        c.annual_qty,
        d.planned_qty,
        d.ops_dispatch_qty,
        d.ops_dispatched_qty,
        d.unit_price
      FROM bc_consumption_items c
      LEFT JOIN bc_dispatch_items d
        ON d.business_case_id = c.business_case_id
       AND d.item_key = c.item_key
      WHERE c.business_case_id = $1
      ORDER BY COALESCE(c.equipment_name, ''), c.name
      `,
      [businessCaseId],
    );
    return rows;
  } catch (error) {
    if (String(error?.code || "") === "42P01" && /bc_dispatch_items/i.test(String(error?.message || ""))) {
      const { rows } = await db.query(
        `
        SELECT
          item_key,
          item_id,
          name AS item_name,
          item_type,
          source,
          equipment_id,
          equipment_name,
          annual_qty,
          NULL::numeric AS planned_qty,
          NULL::numeric AS ops_dispatch_qty,
          NULL::numeric AS ops_dispatched_qty,
          NULL::numeric AS unit_price
        FROM bc_consumption_items
        WHERE business_case_id = $1
        ORDER BY COALESCE(equipment_name, ''), name
        `,
        [businessCaseId],
      );
      return rows;
    }
    throw error;
  }
}

async function buildAutoGenerationInput({ businessCaseId, bcRow, input = {} }) {
  const metadata = toObject(bcRow?.modern_bc_metadata);
  const generalData = toObject(metadata.general_data);
  const extra = toObject(bcRow?.extra);
  const equipmentPairs = Array.isArray(extra?.equipment_details) ? extra.equipment_details : [];
  const primaryPair = equipmentPairs.find((pair) => Number(pair?.primary_id) > 0) || equipmentPairs[0] || null;
  const sheetEquipmentPairs = filterEquipmentPairsForSheet(equipmentPairs);
  const includePrimaryBackup = shouldIncludeBackupInSheet(primaryPair || {});
  const primaryId = Number(primaryPair?.primary_id) || null;
  const backupId = includePrimaryBackup ? Number(primaryPair?.backup_id) || null : null;

  const [
    labEnvironment,
    equipmentDetails,
    lisIntegration,
    requirements,
    deliveries,
    investments,
    equipmentNamesMap,
    equipmentCatalogMap,
    maximumQuantities,
  ] = await Promise.all([
    bcLabEnvironmentService.getLabEnvironment(businessCaseId),
    bcEquipmentDetailsService.getEquipmentDetails(businessCaseId),
    bcLisIntegrationService.getLisIntegration(businessCaseId),
    bcRequirementsService.getRequirements(businessCaseId),
    bcDeliveriesService.getDeliveries(businessCaseId),
    investmentsService.getCatalogWithSelections(businessCaseId),
    getEquipmentNamesMapByIds([primaryId, backupId]),
    getEquipmentCatalogMapByIds(
      sheetEquipmentPairs.flatMap((pair) => [pair?.primary_id, pair?.backup_id]),
    ),
    getMaximumQuantitiesByBusinessCaseId(businessCaseId),
  ]);

  const lisInterfaces = lisIntegration?.id
    ? await bcLisIntegrationService.getEquipmentInterfaces(lisIntegration.id)
    : [];

  const fields = {};
  setFieldIfPresent(fields, "TipoDeCliente", pickFirst(
    generalData.clientType,
    metadata.clientType,
    normalizePurchaseTypeLabel(bcRow?.bc_purchase_type),
  ));
  setFieldIfPresent(fields, "EntidadContratante", pickFirst(
    generalData.contractingEntity,
    metadata.contractingEntity,
  ));
  setFieldIfPresent(fields, "Cliente", bcRow?.client_name);
  setFieldIfPresent(fields, "CodigoProceso", bcRow?.process_code);
  setFieldIfPresent(fields, "ObjetoContratacion", bcRow?.contract_object);
  setFieldIfPresent(fields, "ProvinciaCiudad", pickFirst(
    generalData.provinceCity,
    metadata.provinceCity,
  ));

  setFieldIfPresent(fields, "DiasLaboratorio", labEnvironment?.work_days_per_week);
  setFieldIfPresent(fields, "TurnosPorDia", labEnvironment?.shifts_per_day);
  setFieldIfPresent(fields, "HorasPorTurno", labEnvironment?.hours_per_shift);
  setFieldIfPresent(fields, "ControlesCalidadPorTurno", labEnvironment?.quality_controls_per_shift);
  setFieldIfPresent(fields, "NivelesDeControl", labEnvironment?.control_levels);
  setFieldIfPresent(fields, "FrecuenciaControlesRutina", labEnvironment?.routine_qc_frequency);
  setFieldIfPresent(fields, "PruebasEspeciales", labEnvironment?.special_tests);
  setFieldIfPresent(fields, "FrecuenciaControlesEspeciales", labEnvironment?.special_qc_frequency);

  setFieldIfPresent(fields, "NombreEquipoPrincipal", pickFirst(
    equipmentNamesMap.get(primaryId),
    equipmentDetails?.equipment_name,
  ));
  setFieldIfPresent(fields, "EstadoEquipoPrincipal", pickFirst(
    equipmentDetails?.equipment_status,
    primaryPair?.equipment_status,
    normalizeEquipmentTypeLabel(primaryPair?.primary_type),
  ));
  setFieldIfPresent(fields, "PropiedadEquipoPrincipal", equipmentDetails?.ownership_status);
  if (includePrimaryBackup) {
    setFieldIfPresent(fields, "NombreEquipoBackUp", pickFirst(
      equipmentNamesMap.get(backupId),
      equipmentDetails?.backup_equipment_name,
    ));
    setFieldIfPresent(fields, "EstadoEquipoBackUp", pickFirst(
      equipmentDetails?.backup_status,
      primaryPair?.backup_status,
      normalizeEquipmentTypeLabel(primaryPair?.backup_type),
    ));
    setFieldIfPresent(fields, "InstalarJuntoPrincipal", normalizeBool(primaryPair?.backup_install_simultaneous));
  }
  setFieldIfPresent(fields, "UbicacionEquipos", pickFirst(
    equipmentDetails?.installation_location,
    primaryPair?.installation_location,
  ));
  setFieldIfPresent(fields, "RequiereEquipoComplementario", normalizeBool(pickFirst(
    equipmentDetails?.requires_complementary,
    primaryPair?.requires_complementary,
  )));
  setFieldIfPresent(fields, "EquipoComplementarioPrueba", pickFirst(
    equipmentDetails?.complementary_test_purpose,
    primaryPair?.complementary_test_purpose,
  ));

  const includesLis = pickFirst(lisIntegration?.includes_lis, lisIntegration?.lis_includes);
  const requiresInterface = Boolean(
    lisIntegration?.requires_interface ||
    (
      !includesLis &&
      (
        hasValue(lisIntegration?.current_system_name) ||
        hasValue(lisIntegration?.current_system_provider) ||
        Boolean(lisIntegration?.current_system_hardware)
      )
    )
  );
  setFieldIfPresent(fields, "IncluyeLIS", normalizeBool(includesLis));
  setFieldIfPresent(fields, "ProveedorSistemaTrabajar", lisIntegration?.lis_provider);
  setFieldIfPresent(fields, "IncluyeHadwareLIS", normalizeBool(lisIntegration?.includes_hardware));
  setFieldIfPresent(fields, "NumeroPacientesMensual", lisIntegration?.monthly_patients);
  setFieldIfPresent(fields, "InterfazSistemaActual", normalizeBool(requiresInterface));
  setFieldIfPresent(fields, "ModeloProveedor1", lisInterfaces[0]?.model || lisInterfaces[0]?.provider);
  setFieldIfPresent(fields, "ModeloProveedor2", lisInterfaces[1]?.model || lisInterfaces[1]?.provider);
  setFieldIfPresent(fields, "ModeloProveedor3", lisInterfaces[2]?.model || lisInterfaces[2]?.provider);

  setFieldIfPresent(fields, "Plazo", requirements?.deadline_months);
  setFieldIfPresent(fields, "ProyeccionPlazo", requirements?.projected_deadline_months);
  setFieldIfPresent(fields, "PresupuestoReferencial", pickFirst(
    metadata.referential_budget,
    generalData.referential_budget,
    bcRow?.bc_equipment_cost,
  ));
  setFieldIfPresent(fields, "PorcentajeMaximoCanje", pickFirst(
    metadata.max_trade_in_percent,
    generalData.max_trade_in_percent,
  ));
  setFieldIfPresent(fields, "CompromisoDeCompra", pickFirst(
    metadata.purchase_commitment,
    generalData.purchase_commitment,
  ));
  setFieldIfPresent(fields, "TipoEntrega", normalizeDeliveryTypeLabel(deliveries?.delivery_type));
  setFieldIfPresent(fields, "DeterminacionEfectiva", normalizeBool(deliveries?.effective_determination));
  setFieldIfPresent(fields, "Observaciones", pickFirst(requirements?.observations, metadata?.notes, generalData?.notes));

  // The WebApp contract requires at least one field. Keep Cliente as minimal fallback.
  if (!Object.keys(fields).length && hasValue(bcRow?.client_name)) {
    fields.Cliente = bcRow.client_name;
  }

  const hasManualInversiones =
    input?.inversiones &&
    typeof input.inversiones === "object" &&
    !Array.isArray(input.inversiones) &&
    Object.keys(input.inversiones).length > 0;

  const selectedEquipmentRecords = Array.from(
    new Map(
      sheetEquipmentPairs
        .flatMap((pair) => [pair?.primary_id, pair?.backup_id])
        .map((rawId) => Number(rawId))
        .filter((value) => Number.isInteger(value) && value > 0)
        .map((id) => [id, equipmentCatalogMap.get(id)])
        .filter(([, value]) => Boolean(value)),
    ).values(),
  );
  const fallbackEquipmentRecords = !selectedEquipmentRecords.length
    ? (() => {
        const byId = new Map();
        const byName = new Map();
        for (const row of (Array.isArray(maximumQuantities) ? maximumQuantities : [])) {
          if (!row.equipment_name) continue;
          const numId = Number(row.equipment_id);
          const hasId = Number.isInteger(numId) && numId > 0;
          const record = { id: hasId ? numId : null, name: row.equipment_name, code: null, model: null };
          if (hasId) {
            if (!byId.has(numId)) byId.set(numId, record);
          } else {
            const nameKey = String(row.equipment_name).trim().toLowerCase();
            if (!byName.has(nameKey)) byName.set(nameKey, record);
          }
        }
        return [...byId.values(), ...byName.values()];
      })()
    : [];

  logger.info(
    {
      businessCaseId,
      equipmentPairsCount: equipmentPairs.length,
      selectedEquipmentRecordsCount: selectedEquipmentRecords.length,
      fallbackEquipmentRecordsCount: fallbackEquipmentRecords.length,
      selectedRecordNames: selectedEquipmentRecords.map((r) => r.name).filter(Boolean),
      fallbackRecordNames: fallbackEquipmentRecords.map((r) => r.name).filter(Boolean),
    },
    "[SheetGen] equipment records for tab matching",
  );

  const sheetContext = {
    deadline_months: requirements?.deadline_months ?? null,
    projected_deadline_months: requirements?.projected_deadline_months ?? null,
    modality: null,
  };

  const preparedMaximumQuantities = (Array.isArray(maximumQuantities) ? maximumQuantities : []).map((row) => ({
    item_key: row.item_key,
    item_id: row.item_id,
    item_name: row.item_name,
    item_type: row.item_type,
    source: row.source,
    equipment_id: row.equipment_id,
    equipment_name: row.equipment_name,
    annual_qty: row.annual_qty === null || row.annual_qty === undefined ? null : Number(row.annual_qty),
    planned_qty: row.planned_qty === null || row.planned_qty === undefined ? null : Number(row.planned_qty),
    ops_dispatch_qty: row.ops_dispatch_qty === null || row.ops_dispatch_qty === undefined ? null : Number(row.ops_dispatch_qty),
    ops_dispatched_qty:
      row.ops_dispatched_qty === null || row.ops_dispatched_qty === undefined ? null : Number(row.ops_dispatched_qty),
    unit_price: row.unit_price === null || row.unit_price === undefined ? null : Number(row.unit_price),
  }));

  const equipmentTabs = buildSheetPayloads({
    template: loadTemplateDefinition(),
    equipmentRecords: selectedEquipmentRecords.length ? selectedEquipmentRecords : fallbackEquipmentRecords,
    payload: {
      fields,
      max_quantities: preparedMaximumQuantities,
      sheet_context: sheetContext,
    },
  });

  return {
    ...input,
    fields,
    inversiones: hasManualInversiones ? input.inversiones : buildInversionesPayload(investments),
    max_quantities: preparedMaximumQuantities,
    equipment_tabs: equipmentTabs,
    sheet_context: sheetContext,
  };
}

function buildPayloadHash(payload) {
  return idempotencyService.hashPayload({
    mapping_version: payload.mapping_version,
    fields: payload.fields || {},
    inversiones: payload.inversiones || {},
    max_quantities: payload.max_quantities || [],
    equipment_tabs: payload.equipment_tabs || [],
    sheet_context: payload.sheet_context || {},
  });
}

function buildQueueResponse(job) {
  return {
    ok: true,
    data: {
      job_id: Number(job.id),
      business_case_id: job.business_case_id,
      request_id: job.request_id,
      idempotency_key: job.idempotency_key,
      mapping_version: job.mapping_version,
      status: job.status,
      attempts: Number(job.attempts || 0),
      max_attempts: Number(job.max_attempts || 0),
      next_retry_at: job.next_retry_at || null,
      created_at: job.created_at,
      updated_at: job.updated_at,
      sheet_id: job.sheet_id || null,
      sheet_url: job.sheet_url || null,
      error_code: job.error_code || null,
      error_message: job.error_message || null,
    },
  };
}

function normalizeIdempotencyKey({ providedKey, businessCaseId, userId, normalizedPayload }) {
  const explicit = String(providedKey || "").trim();
  if (explicit) return explicit;

  const digest = idempotencyService.hashPayload(normalizedPayload).slice(0, 24);
  return `auto:bc_sheet:${businessCaseId}:${userId || "anon"}:${digest}`;
}

async function enqueueGenerationJob({
  businessCaseId,
  input,
  user,
  idempotencyKey,
  correlationId = null,
}) {
  await ensureQueueTable();
  const bcRow = await assertBusinessCaseExists(businessCaseId);

  let normalizedInput = input || {};
  const hasFieldsInput =
    normalizedInput?.fields &&
    typeof normalizedInput.fields === "object" &&
    !Array.isArray(normalizedInput.fields) &&
    Object.keys(normalizedInput.fields).length > 0;

  if (!hasFieldsInput) {
    normalizedInput = await buildAutoGenerationInput({
      businessCaseId,
      bcRow,
      input: normalizedInput,
    });
  }

  const validation = validateGenerationRequest(normalizedInput);
  if (!validation.ok) {
    throw createAppError(validation.message || "Payload invalido para generacion de hoja", {
      status: 400,
      code: "VALIDATION_ERROR",
      retryable: false,
    });
  }

  const normalized = {
    ...validation.value,
    request_id: validation.value.request_id || crypto.randomUUID(),
    mapping_version: validation.value.mapping_version || DEFAULT_MAPPING_VERSION,
  };

  const normalizedIdempotencyKey = normalizeIdempotencyKey({
    providedKey: idempotencyKey || normalized.idempotency_key,
    businessCaseId,
    userId: user?.id || null,
    normalizedPayload: normalized,
  });

  const payloadHash = buildPayloadHash(normalized);
  let idempotencySession = null;

  try {
    idempotencySession = await idempotencyService.start({
      operationScope: OPERATION_SCOPE_ENQUEUE,
      idempotencyKey: normalizedIdempotencyKey,
      businessCaseId,
      payload: normalized,
      userId: user?.id || null,
    });

    if (idempotencySession?.replay) {
      return {
        replay: true,
        replayStatus: idempotencySession.replayStatus || 202,
        replayPayload: idempotencySession.replayPayload,
      };
    }

    const { rows } = await db.query(
      `
      INSERT INTO bc_sheet_generation_jobs (
        business_case_id,
        request_id,
        idempotency_key,
        mapping_version,
        status,
        payload_hash,
        request_payload,
        attempts,
        max_attempts,
        next_retry_at,
        correlation_id,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,'pending',$5,$6::jsonb,0,$7,NOW(),$8,$9,NOW(),NOW())
      ON CONFLICT (business_case_id, idempotency_key)
      DO UPDATE SET
        updated_at = NOW()
      RETURNING *
      `,
      [
        businessCaseId,
        normalized.request_id,
        normalizedIdempotencyKey,
        normalized.mapping_version,
        payloadHash,
        JSON.stringify({
          request_id: normalized.request_id,
          idempotency_key: normalizedIdempotencyKey,
          mapping_version: normalized.mapping_version,
          fields: normalized.fields,
          inversiones: normalized.inversiones || {},
          max_quantities: normalized.max_quantities || [],
          equipment_tabs: normalized.equipment_tabs || [],
          sheet_context: normalized.sheet_context || {},
          force_recreate: Boolean(normalized.force_recreate),
        }),
        Math.max(1, MAX_ATTEMPTS_DEFAULT),
        correlationId,
        user?.id || null,
      ],
    );

    const responseBody = buildQueueResponse(rows[0]);
    if (idempotencySession?.recordId) {
      await idempotencyService.complete(idempotencySession.recordId, {
        httpStatus: 202,
        responsePayload: responseBody,
      });
    }

    return {
      replay: false,
      responseBody,
    };
  } catch (error) {
    if (isUniqueViolation(error, "bc_sheet_generation_jobs_unique_request_id")) {
      throw createAppError("request_id ya fue utilizado en otro job de generacion", {
        status: 409,
        code: "REQUEST_ID_CONFLICT",
        retryable: false,
      });
    }
    if (idempotencySession?.recordId) {
      await idempotencyService.fail(idempotencySession.recordId, error).catch(() => null);
    }
    throw error;
  }
}

async function getGenerationPreview({ businessCaseId, input = {} }) {
  const bcRow = await assertBusinessCaseExists(businessCaseId);

  let normalizedInput = input || {};
  const hasFieldsInput =
    normalizedInput?.fields &&
    typeof normalizedInput.fields === "object" &&
    !Array.isArray(normalizedInput.fields) &&
    Object.keys(normalizedInput.fields).length > 0;

  if (!hasFieldsInput) {
    normalizedInput = await buildAutoGenerationInput({
      businessCaseId,
      bcRow,
      input: normalizedInput,
    });
  }

  const validation = validateGenerationRequest(normalizedInput);
  if (!validation.ok) {
    throw createAppError(validation.message || "Payload invalido para previsualizacion de hoja", {
      status: 400,
      code: "VALIDATION_ERROR",
      retryable: false,
    });
  }

  const normalized = {
    ...validation.value,
    mapping_version: validation.value.mapping_version || DEFAULT_MAPPING_VERSION,
  };

  const metadata = toObject(bcRow?.modern_bc_metadata);
  const lastGeneration =
    metadata?.bc_sheet_generation?.last && typeof metadata.bc_sheet_generation.last === "object"
      ? metadata.bc_sheet_generation.last
      : null;
  const inversiones = normalized.inversiones && typeof normalized.inversiones === "object"
    ? normalized.inversiones
    : {};

  return {
    ok: true,
    data: {
      business_case_id: businessCaseId,
      mapping_version: normalized.mapping_version,
      fields: normalized.fields || {},
      inversiones,
      summary: {
        fields_count: Object.keys(normalized.fields || {}).length,
        inversiones_count: Object.keys(inversiones).length,
        equipment_tabs_count: Array.isArray(normalized.equipment_tabs) ? normalized.equipment_tabs.length : 0,
        max_quantities_count: Array.isArray(normalized.max_quantities) ? normalized.max_quantities.length : 0,
      },
      equipment_tabs: Array.isArray(normalized.equipment_tabs) ? normalized.equipment_tabs : [],
      max_quantities: Array.isArray(normalized.max_quantities) ? normalized.max_quantities : [],
      last_generation: lastGeneration
        ? {
            job_id: lastGeneration.job_id || null,
            request_id: lastGeneration.request_id || null,
            mapping_version: lastGeneration.mapping_version || null,
            sheet_id: lastGeneration.sheet_id || null,
            sheet_url: lastGeneration.sheet_url || null,
            generated_at: lastGeneration.generated_at || null,
            sync_mode: lastGeneration.sync_mode || null,
            replacement_reason: lastGeneration.replacement_reason || null,
          }
        : null,
    },
  };
}

async function resolveOutputFolderIdForJob(job) {
  try {
    const folder = await ensureBusinessCaseDriveFolderById(job.business_case_id);
    return folder?.folderId || null;
  } catch (error) {
    throw createAppError(
      error?.message || "No se pudo resolver carpeta de Drive para Business Case",
      {
        status: error?.status || 500,
        code: error?.code || "BC_DRIVE_FOLDER_ERROR",
        retryable: (error?.status || 500) >= 500,
      },
    );
  }
}

function classifyWebAppError(error) {
  if (error?.code && NON_RETRYABLE_WEBAPP_CODES.has(error.code)) {
    error.retryable = false;
    return error;
  }

  if (error?.code && RETRYABLE_ERROR_CODES.has(error.code)) {
    error.retryable = true;
    return error;
  }

  const fallback = createAppError(
    error?.message || "Fallo desconocido llamando Apps Script WebApp",
    {
      status: error?.status || 500,
      code: error?.code || "INTERNAL_ERROR",
      retryable: typeof error?.retryable === "boolean" ? error.retryable : true,
    },
  );
  return fallback;
}

async function callAppsScriptWebApp(payload, context = {}) {
  if (!WEBAPP_URL) {
    throw createAppError("BC_SHEET_WEBAPP_URL no configurado", {
      status: 500,
      code: "WEBAPP_URL_MISSING",
      retryable: false,
    });
  }
  if (!WEBAPP_SECRET) {
    throw createAppError("BC_SHEET_WEBAPP_SECRET no configurado", {
      status: 500,
      code: "WEBAPP_SECRET_MISSING",
      retryable: false,
    });
  }
  if (webAppCircuitBreaker.isOpen()) {
    throw createAppError("Circuit breaker activo para WebApp de Business Case", {
      status: 503,
      code: "WEBAPP_CIRCUIT_OPEN",
      retryable: true,
    });
  }

  const signedPayload = buildSignedWebAppPayload(
    {
      ...payload,
      timestamp: new Date().toISOString(),
      auth_token: WEBAPP_TOKEN,
    },
    WEBAPP_SECRET,
  );

  const startedAt = Date.now();

  try {
    const response = await axios.post(WEBAPP_URL, signedPayload, {
      timeout: WEBAPP_TIMEOUT_MS,
      headers: {
        "content-type": "application/json",
        "x-webapp-token": WEBAPP_TOKEN,
      },
      validateStatus: () => true,
    });

    const elapsed = Date.now() - startedAt;
    const responseData = response?.data || {};
    const ok = Boolean(responseData?.ok);

    if (response.status >= 500) {
      throw createAppError(`WebApp respondio ${response.status}`, {
        status: 502,
        code: "WEBAPP_5XX",
        retryable: true,
      });
    }

    if (!ok) {
      const apiCode = String(responseData?.code || "INTERNAL_ERROR");
      const apiMessage = String(responseData?.message || "WebApp retorno error");
      throw createAppError(apiMessage, {
        status: 400,
        code: apiCode,
        retryable: !NON_RETRYABLE_WEBAPP_CODES.has(apiCode),
        details: responseData,
      });
    }

    if (!responseData?.sheetId || !responseData?.url || !responseData?.timestamp) {
      throw createAppError("Respuesta de WebApp incompleta (sheetId/url/timestamp)", {
        status: 502,
        code: "WEBAPP_RESPONSE_INVALID",
        retryable: false,
      });
    }

    webAppCircuitBreaker.onSuccess();
    logger.info(
      {
        correlation_id: context?.correlationId || null,
        request_id: payload?.request_id || null,
        elapsed_ms: elapsed,
        sheet_id: responseData.sheetId,
      },
      "[BC_SHEET] WebApp procesado correctamente",
    );
    return responseData;
  } catch (rawError) {
    webAppCircuitBreaker.onFailure();
    if (rawError?.code === "ECONNABORTED") {
      throw createAppError("Timeout al invocar WebApp de Apps Script", {
        status: 504,
        code: "TIMEOUT_ERROR",
        retryable: true,
      });
    }

    if (rawError?.isAxiosError && !rawError?.response) {
      throw createAppError("Error de red al invocar WebApp de Apps Script", {
        status: 503,
        code: "NETWORK_ERROR",
        retryable: true,
      });
    }

    throw classifyWebAppError(rawError);
  }
}

async function markJobCompleted({ jobId, webAppResponse }) {
  const { rows } = await db.query(
    `
    UPDATE bc_sheet_generation_jobs
       SET status = 'completed',
           completed_at = NOW(),
           locked_at = NULL,
           sheet_id = $2,
           sheet_url = $3,
           worker_response = $4::jsonb,
           error_code = NULL,
           error_message = NULL,
           updated_at = NOW()
     WHERE id = $1
     RETURNING *
    `,
    [jobId, webAppResponse.sheetId, webAppResponse.url, JSON.stringify(webAppResponse)],
  );
  return rows[0];
}

async function persistSheetResultInBusinessCase({
  businessCaseId,
  jobId,
  requestId,
  mappingVersion,
  webAppResponse,
  createdByUserId = null,
}) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT modern_bc_metadata, bc_stage
         FROM equipment_purchase_requests
        WHERE id = $1
        FOR UPDATE`,
      [businessCaseId],
    );
    if (!rows.length) {
      throw createAppError("Business Case no encontrado al persistir resultado de hoja", {
        status: 404,
        code: "BUSINESS_CASE_NOT_FOUND",
        retryable: false,
      });
    }

    const nowIso = new Date().toISOString();
    const row = rows[0];
    const metadata = toObject(row?.modern_bc_metadata);
    const current = metadata.bc_sheet_generation && typeof metadata.bc_sheet_generation === "object"
      ? { ...metadata.bc_sheet_generation }
      : {};
    const history = Array.isArray(current.history) ? [...current.history] : [];
    const previousSheetId = current?.last?.sheet_id || null;
    const syncOutcome = resolveSheetSyncOutcome({
      previousSheetId,
      webAppResponse,
    });
    let createdByEmail = null;
    if (createdByUserId) {
      const { rows: userRows } = await client.query(
        `SELECT email FROM users WHERE id = $1 LIMIT 1`,
        [createdByUserId],
      );
      createdByEmail = userRows[0]?.email || null;
    }

    const record = {
      job_id: Number(jobId),
      request_id: requestId,
      mapping_version: mappingVersion,
      sheet_id: webAppResponse.sheetId,
      sheet_url: webAppResponse.url,
      generated_at: webAppResponse.timestamp || nowIso,
      provider: webAppResponse.provider || "apps_script_webapp",
      sync_mode: syncOutcome.syncMode,
      replacement_reason: syncOutcome.replacementReason,
      missing_required_sheets: syncOutcome.missingRequiredSheets,
      previous_sheet_id: syncOutcome.previousSheetId,
      selected_sheets: Array.isArray(webAppResponse.selected_sheets) ? webAppResponse.selected_sheets : [],
      updated_at: nowIso,
    };

    current.history = mergeSheetGenerationHistory(history, record, syncOutcome);
    current.status = "completed";
    current.updated_at = nowIso;
    current.last = record;
    metadata.bc_sheet_generation = current;

    const feasibility = toObject(metadata.feasibility);
    const previousExport = toObject(feasibility.export_excel);
    feasibility.export_excel = {
      ...previousExport,
      at: record.generated_at,
      by_id: createdByUserId || previousExport.by_id || null,
      by_email: createdByEmail || previousExport.by_email || null,
      source: "bc_sheet_generation",
      sheet_job_id: Number(jobId),
      sheet_url: webAppResponse.url,
    };

    const hasDecision = Boolean(feasibility?.decision?.decided_at);
    if (!hasDecision) {
      feasibility.status = "esperando_calculos";
      feasibility.requires_change_approval = true;
    }
    metadata.feasibility = feasibility;

    const currentStage = String(row?.bc_stage || "").trim().toLowerCase();
    const shouldMoveStage = !hasDecision && currentStage !== "factible" && currentStage !== "cerrado_no_factible";
    const nextStage = shouldMoveStage ? "esperando_calculos" : null;

    await client.query(
      `
      UPDATE equipment_purchase_requests
         SET modern_bc_metadata = $2::jsonb,
             bc_stage = COALESCE($3, bc_stage),
             updated_at = NOW()
       WHERE id = $1
      `,
      [businessCaseId, JSON.stringify(metadata), nextStage],
    );
    await client.query("COMMIT");
    return { record, syncOutcome };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function computeRetryDelayMinutes(attempts) {
  const n = Math.max(1, Number(attempts || 1));
  return Math.min(30, Math.max(1, 2 ** Math.min(n, 6)));
}

async function markJobFailed({
  job,
  error,
}) {
  const normalized = classifyWebAppError(error);
  const attempts = Number(job.attempts || 0);
  const maxAttempts = Number(job.max_attempts || 1);
  const shouldRetry = normalized.retryable && attempts < maxAttempts;
  const retryDelayMinutes = computeRetryDelayMinutes(attempts);
  const nextRetryAt = shouldRetry
    ? `NOW() + make_interval(mins => ${retryDelayMinutes})`
    : "NOW()";

  const forcedAttempts = shouldRetry ? attempts : maxAttempts;
  const nextStatus = shouldRetry ? "pending" : "failed";
  const { rows } = await db.query(
    `
    UPDATE bc_sheet_generation_jobs
       SET status = $5,
           locked_at = NULL,
           error_code = $2,
           error_message = $3,
           attempts = $4,
           next_retry_at = ${nextRetryAt},
           completed_at = CASE WHEN $5 = 'failed' THEN NOW() ELSE NULL END,
           updated_at = NOW()
     WHERE id = $1
     RETURNING *
    `,
    [
      job.id,
      normalized.code || "INTERNAL_ERROR",
      String(normalized.message || "Fallo procesando job de hoja BC"),
      forcedAttempts,
      nextStatus,
    ],
  );
  return rows[0];
}

async function claimPendingJobs(limit = 10) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 10)));
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `
      SELECT *
        FROM bc_sheet_generation_jobs
       WHERE status IN ('pending', 'failed')
         AND next_retry_at <= NOW()
         AND attempts < max_attempts
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
      `,
      [safeLimit],
    );

    if (rows.length) {
      const ids = rows.map((row) => Number(row.id));
      await client.query(
        `
        UPDATE bc_sheet_generation_jobs
           SET status = 'processing',
               attempts = attempts + 1,
               locked_at = NOW(),
               started_at = COALESCE(started_at, NOW()),
               updated_at = NOW()
         WHERE id = ANY($1::bigint[])
        `,
        [ids],
      );
      rows.forEach((row) => {
        row.attempts = Number(row.attempts || 0) + 1;
      });
    }

    await client.query("COMMIT");
    return rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function processSingleJob(job) {
  const context = {
    correlationId: job.correlation_id || null,
  };

  try {
    const storedPayload = job.request_payload && typeof job.request_payload === "object"
      ? job.request_payload
      : {};
    // Strip inversiones so buildAutoGenerationInput always fetches fresh data from DB.
    // The stored payload may have stale inversiones from enqueue time.
    const { inversiones: _stale, ...inputWithoutInversiones } = storedPayload;
    const bcRow = await assertBusinessCaseExists(job.business_case_id);
    const refreshedPayload = await buildAutoGenerationInput({
      businessCaseId: job.business_case_id,
      bcRow,
      input: inputWithoutInversiones,
    });
    const outputFolderId = await resolveOutputFolderIdForJob(job);
    const previousSheetMeta = toObject(bcRow?.modern_bc_metadata)?.bc_sheet_generation?.last || {};
    const previousSheetId = previousSheetMeta?.provider === "google_sheets_local"
      ? previousSheetMeta.sheet_id || null
      : null;
    const forceRecreate = Boolean(storedPayload.force_recreate);
    const enrichedPayload = {
      ...refreshedPayload,
      output_folder_id: outputFolderId,
    };
    const webAppResponse = SHEET_PROVIDER === "webapp"
      ? await callAppsScriptWebApp(enrichedPayload, context)
      : await syncBusinessCaseToGoogleSheet({
          businessCase: bcRow,
          outputFolderId,
          payload: enrichedPayload,
          previousSheetId,
          forceRecreate,
        });

    const persistenceResult = await persistSheetResultInBusinessCase({
      businessCaseId: job.business_case_id,
      jobId: job.id,
      requestId: job.request_id,
      mappingVersion: job.mapping_version,
      webAppResponse,
      createdByUserId: job.created_by || null,
    });
    await markJobCompleted({
      jobId: job.id,
      webAppResponse,
    });
    if (persistenceResult?.syncOutcome?.shouldCreateDocumentVersion) {
      await recordDocumentVersion({
        businessCaseId: job.business_case_id,
        documentType: "sheets",
        documentUrl: webAppResponse.url,
        sheetId: webAppResponse.sheetId,
        fileName: null,
        canonicalState: bcRow.canonical_state || null,
        generatedBy: job.created_by || null,
        metadata: {
          job_id: Number(job.id),
          mapping_version: job.mapping_version,
          sync_mode: persistenceResult.syncOutcome.syncMode,
          replacement_reason: persistenceResult.syncOutcome.replacementReason,
          previous_sheet_id: persistenceResult.syncOutcome.previousSheetId,
          missing_required_sheets: persistenceResult.syncOutcome.missingRequiredSheets,
          selected_sheets: Array.isArray(webAppResponse.selected_sheets) ? webAppResponse.selected_sheets : [],
        },
      });
    }

    return { ok: true, jobId: Number(job.id) };
  } catch (error) {
    const failed = await markJobFailed({ job, error });
    logger.error(
      {
        correlation_id: job.correlation_id || null,
        business_case_id: job.business_case_id,
        job_id: job.id,
        error_code: failed?.error_code || error?.code || "INTERNAL_ERROR",
        error_message: failed?.error_message || error?.message,
      },
      "[BC_SHEET] Error procesando job",
    );
    return { ok: false, jobId: Number(job.id), code: failed?.error_code || error?.code || "INTERNAL_ERROR" };
  }
}

async function processPendingJobsBatch({ limit = 10 } = {}) {
  await ensureQueueTable();
  const jobs = await claimPendingJobs(limit);
  const summary = {
    total: jobs.length,
    completed: 0,
    failed: 0,
  };

  for (const job of jobs) {
     
    const result = await processSingleJob(job);
    if (result.ok) summary.completed += 1;
    else summary.failed += 1;
  }

  return summary;
}

async function getJobStatus({ businessCaseId, jobId }) {
  await ensureQueueTable();
  const { rows } = await db.query(
    `
    SELECT *
      FROM bc_sheet_generation_jobs
     WHERE business_case_id = $1
       AND id = $2
     LIMIT 1
    `,
    [businessCaseId, jobId],
  );
  if (!rows.length) {
    throw createAppError("Job de generacion no encontrado", {
      status: 404,
      code: "JOB_NOT_FOUND",
      retryable: false,
    });
  }

  return buildQueueResponse(rows[0]);
}

async function getLatestJobStatus({ businessCaseId }) {
  await ensureQueueTable();
  const { rows } = await db.query(
    `
    SELECT *
      FROM bc_sheet_generation_jobs
     WHERE business_case_id = $1
     ORDER BY created_at DESC
     LIMIT 1
    `,
    [businessCaseId],
  );
  if (!rows.length) {
    throw createAppError("Aun no existe una solicitud de generacion para este Business Case", {
      status: 404,
      code: "JOB_NOT_FOUND",
      retryable: false,
    });
  }

  return buildQueueResponse(rows[0]);
}

async function getQueueMetrics() {
  await ensureQueueTable();
  const { rows: countersRows } = await db.query(
    `
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'processing') AS processing,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed,
      COUNT(*) FILTER (
        WHERE status IN ('pending', 'failed')
          AND next_retry_at <= NOW()
          AND attempts < max_attempts
      ) AS ready_to_process
    FROM bc_sheet_generation_jobs
    `,
  );

  const { rows: latencyRows } = await db.query(
    `
    SELECT
      COALESCE(
        percentile_cont(0.50) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000
        ),
        0
      ) AS p50_ms,
      COALESCE(
        percentile_cont(0.95) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000
        ),
        0
      ) AS p95_ms,
      COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000), 0) AS avg_ms
    FROM bc_sheet_generation_jobs
    WHERE status = 'completed'
      AND completed_at IS NOT NULL
      AND created_at >= NOW() - INTERVAL '24 hours'
    `,
  );

  const counters = countersRows[0] || {};
  const latency = latencyRows[0] || {};

  return {
    ok: true,
    data: {
      counters: {
        total: Number(counters.total || 0),
        pending: Number(counters.pending || 0),
        processing: Number(counters.processing || 0),
        completed: Number(counters.completed || 0),
        failed: Number(counters.failed || 0),
        ready_to_process: Number(counters.ready_to_process || 0),
      },
      latency_24h: {
        p50_ms: Number(latency.p50_ms || 0),
        p95_ms: Number(latency.p95_ms || 0),
        avg_ms: Number(latency.avg_ms || 0),
      },
      webapp_circuit_breaker: webAppCircuitBreaker.snapshot(),
      generated_at: new Date().toISOString(),
    },
  };
}

async function recordDocumentVersion({ businessCaseId, documentType, documentUrl, sheetId, fileName, canonicalState, generatedBy, metadata = {} }) {
  try {
    await db.query(
      `SELECT insert_bc_document_version($1, $2, $3, $4, $5, $6, $7, $8)`,
      [businessCaseId, documentType, documentUrl || null, sheetId || null, fileName || null, canonicalState || null, generatedBy || null, JSON.stringify(metadata)],
    );
  } catch (error) {
    logger.warn({ error: error?.message, businessCaseId }, "[BC_SHEET] Failed to record document version (non-fatal)");
  }
}

async function getDocumentVersions({ businessCaseId, limit = 20 }) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit || 20)));
  const { rows } = await db.query(
    `SELECT id, business_case_id, version_number, document_type, document_url,
            sheet_id, file_name, canonical_state, generated_by, generated_at, is_current, metadata
       FROM bc_document_versions
      WHERE business_case_id = $1
      ORDER BY generated_at DESC
      LIMIT $2`,
    [businessCaseId, safeLimit],
  );
  return {
    ok: true,
    data: {
      business_case_id: businessCaseId,
      versions: rows.map((r) => ({
        id: r.id,
        version_number: Number(r.version_number),
        document_type: r.document_type,
        document_url: r.document_url || null,
        sheet_id: r.sheet_id || null,
        file_name: r.file_name || null,
        canonical_state: r.canonical_state || null,
        generated_by: r.generated_by || null,
        generated_at: r.generated_at,
        is_current: Boolean(r.is_current),
        metadata: r.metadata || {},
      })),
    },
  };
}

module.exports = {
  enqueueGenerationJob,
  getGenerationPreview,
  processPendingJobsBatch,
  getJobStatus,
  getLatestJobStatus,
  getQueueMetrics,
  ensureQueueTable,
  recordDocumentVersion,
  getDocumentVersions,
  filterEquipmentPairsForSheet,
  shouldIncludeBackupInSheet,
};
