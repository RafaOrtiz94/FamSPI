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
  validateGenerationRequest,
  buildSignedWebAppPayload,
  DEFAULT_MAPPING_VERSION,
} = require("./businessCaseSheetGeneration.contract");

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
            process_code, contract_object, modern_bc_metadata, extra
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

async function getEquipmentNamesMapByIds(ids = []) {
  const cleanIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
  if (!cleanIds.length) return new Map();

  const { rows } = await db.query(
    `
    WITH source AS (
      SELECT equipment_id::int AS id, equipment_name::text AS name
      FROM v_equipment_full_catalog
      WHERE equipment_id = ANY($1::int[])
      UNION
      SELECT id::int AS id, name::text AS name
      FROM equipment_models
      WHERE id = ANY($1::int[])
    )
    SELECT id, MAX(name) AS name
    FROM source
    GROUP BY id
    `,
    [cleanIds],
  );

  const map = new Map();
  rows.forEach((row) => {
    map.set(Number(row.id), row.name || null);
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
      if (cantidad === null && precio === null) return;
      out[name] = {
        cantidad: cantidad === null ? 0 : cantidad,
        precio: precio === null ? 0 : precio,
      };
    });
  return out;
}

async function buildAutoGenerationInput({ businessCaseId, bcRow, input = {} }) {
  const metadata = toObject(bcRow?.modern_bc_metadata);
  const generalData = toObject(metadata.general_data);
  const extra = toObject(bcRow?.extra);
  const equipmentPairs = Array.isArray(extra?.equipment_details) ? extra.equipment_details : [];
  const primaryPair = equipmentPairs.find((pair) => Number(pair?.primary_id) > 0) || equipmentPairs[0] || null;
  const primaryId = Number(primaryPair?.primary_id) || null;
  const backupId = Number(primaryPair?.backup_id) || null;

  const [
    labEnvironment,
    equipmentDetails,
    lisIntegration,
    requirements,
    deliveries,
    investments,
    equipmentNamesMap,
  ] = await Promise.all([
    bcLabEnvironmentService.getLabEnvironment(businessCaseId),
    bcEquipmentDetailsService.getEquipmentDetails(businessCaseId),
    bcLisIntegrationService.getLisIntegration(businessCaseId),
    bcRequirementsService.getRequirements(businessCaseId),
    bcDeliveriesService.getDeliveries(businessCaseId),
    investmentsService.getCatalogWithSelections(businessCaseId),
    getEquipmentNamesMapByIds([primaryId, backupId]),
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
    normalizeEquipmentTypeLabel(primaryPair?.primary_type),
  ));
  setFieldIfPresent(fields, "PropiedadEquipoPrincipal", equipmentDetails?.ownership_status);
  setFieldIfPresent(fields, "NombreEquipoBackUp", pickFirst(
    equipmentNamesMap.get(backupId),
    equipmentDetails?.backup_equipment_name,
  ));
  setFieldIfPresent(fields, "EstadoEquipoBackUp", pickFirst(
    equipmentDetails?.backup_status,
    normalizeEquipmentTypeLabel(primaryPair?.backup_type),
  ));
  setFieldIfPresent(fields, "InstalarJuntoPrincipal", pickFirst(
    primaryPair?.backup_install_simultaneous,
    equipmentDetails?.install_with_primary,
  ));
  setFieldIfPresent(fields, "UbicacionEquipos", equipmentDetails?.installation_location);
  setFieldIfPresent(fields, "RequiereEquipoComplementario", equipmentDetails?.requires_complementary);
  setFieldIfPresent(fields, "EquipoComplementarioPrueba", equipmentDetails?.complementary_test_purpose);

  const includesLis = pickFirst(lisIntegration?.includes_lis, lisIntegration?.lis_includes);
  const hasCurrentSystem = hasValue(lisIntegration?.current_system_name) || hasValue(lisIntegration?.current_system_provider);
  setFieldIfPresent(fields, "IncluyeLIS", includesLis);
  setFieldIfPresent(fields, "ProveedorSistemaTrabajar", lisIntegration?.lis_provider);
  setFieldIfPresent(fields, "IncluyeHadwareLIS", lisIntegration?.includes_hardware);
  setFieldIfPresent(fields, "NumeroPacientesMensual", lisIntegration?.monthly_patients);
  setFieldIfPresent(fields, "InterfazSistemaActual", hasCurrentSystem);
  setFieldIfPresent(fields, "NombreSistema", lisIntegration?.current_system_name);
  setFieldIfPresent(fields, "ProveedorSistemaActual", lisIntegration?.current_system_provider);
  setFieldIfPresent(fields, "IncluyeHadwareSistemaActual", lisIntegration?.current_system_hardware);
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
  setFieldIfPresent(fields, "DeterminacionEfectiva", deliveries?.effective_determination);
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

  return {
    ...input,
    fields,
    inversiones: hasManualInversiones ? input.inversiones : buildInversionesPayload(investments),
  };
}

function buildPayloadHash(payload) {
  return idempotencyService.hashPayload({
    mapping_version: payload.mapping_version,
    fields: payload.fields || {},
    inversiones: payload.inversiones || {},
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
      },
      last_generation: lastGeneration
        ? {
            job_id: lastGeneration.job_id || null,
            request_id: lastGeneration.request_id || null,
            mapping_version: lastGeneration.mapping_version || null,
            sheet_id: lastGeneration.sheet_id || null,
            sheet_url: lastGeneration.sheet_url || null,
            generated_at: lastGeneration.generated_at || null,
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
      provider: "apps_script_webapp",
      updated_at: nowIso,
    };

    history.unshift(record);
    current.status = "completed";
    current.updated_at = nowIso;
    current.last = record;
    current.history = history.slice(0, 10);
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
    const payload = job.request_payload && typeof job.request_payload === "object"
      ? job.request_payload
      : {};
    const outputFolderId = await resolveOutputFolderIdForJob(job);
    const enrichedPayload = {
      ...payload,
      output_folder_id: outputFolderId,
    };
    const webAppResponse = await callAppsScriptWebApp(enrichedPayload, context);

    await persistSheetResultInBusinessCase({
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
    // eslint-disable-next-line no-await-in-loop
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

module.exports = {
  enqueueGenerationJob,
  getGenerationPreview,
  processPendingJobsBatch,
  getJobStatus,
  getLatestJobStatus,
  getQueueMetrics,
  ensureQueueTable,
};
