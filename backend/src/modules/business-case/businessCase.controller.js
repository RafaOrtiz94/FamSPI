const Joi = require("joi");
const crypto = require("crypto");
const db = require("../../config/db");
const logger = require("../../config/logger");
const businessCaseService = require("./businessCase.service");
const equipmentSelectionService = require("./equipmentSelection.service");
const determinationsService = require("./determinations.service");
const investmentsService = require("./investments.service");
const dispatchWorkspaceService = require("./bcDispatchWorkspace.service");
const bcLabEnvironmentService = require("./bcLabEnvironment.service");
const bcLisIntegrationService = require("./bcLisIntegration.service");
const bcRequirementsService = require("./bcRequirements.service");
const bcDeliveriesService = require("./bcDeliveries.service");
const pdfGenerator = require("./pdfGenerator.service");
const excelExporter = require("./excelExporter.service");
const equipmentCompatibilityService = require("./equipmentCompatibility.service");
const observabilityService = require("./businessCaseObservability.service");
const featureFlagsService = require("./businessCaseFeatureFlags.service");
const idempotencyService = require("./businessCaseIdempotency.service");
const { BusinessCaseDataOwnership } = require("./businessCaseDataOwnership");
const { BusinessCasePermissions } = require("./businessCasePermissions");
const notificationManager = require("../notifications/notificationManager");
const { BusinessCaseStateMachine } = require("./businessCaseStateMachine");
const { STATES } = require("./businessCaseStates.constants");
const preflowService = require("./businessCasePreflow.service");
const workflowSlaService = require("./businessCaseWorkflowSla.service");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const determinationsGateService = require("./businessCaseDeterminationsGate.service");
const { ensureBusinessCaseDriveFolder, ensureBusinessCaseDriveFolderById } = require("./businessCaseDriveFolder.service");
const sheetGenerationService = require("./businessCaseSheetGeneration.service");
const {
  clearSheetCaches,
  unprotectAnnualQuantityCellsForSubsection,
} = require("./businessCaseSheetSyncLocal.service");
const { createRequest: createServiceRequest, addDriveAttachment, markRequestCompleted } = require("../requests/requests.service");
const {
  normalizeInspectionResult,
  normalizeFst07Checklist,
  assertFollowUpDateConsistency,
  createSiteInspectionError,
} = require("../servicio/siteInspectionRules.service");
const { generateFst07PdfBuffer, buildFst07FileName } = require("../servicio/fst07Pdf.service");
const { trackFst07WorkflowDocument } = require("../servicio/fst07.service");
const XLSX = require("xlsx");

// Guarda contra ids no-UUID (ej. "undefined" por un bundle de frontend viejo
// en cache) para que fallen con 404 claro en vez de un 500 de Postgres
// ("invalid input syntax for type uuid").
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSchema = Joi.object({
  client_name: Joi.string().required(),
  client_id: Joi.number().integer().optional(),
  bc_purchase_type: Joi.string()
    .valid("public", "private_comodato", "private_sale", "comodato_publico", "comodato_privado")
    .default("public"),
  bc_duration_years: Joi.number().min(0).allow(null).optional(),
  bc_equipment_cost: Joi.number().min(0).allow(null).optional(),
  bc_target_margin_percentage: Joi.number().allow(null).optional(),
  bc_amortization_months: Joi.number().integer().min(0).allow(null).optional(),
  bc_calculation_mode: Joi.string().trim().valid("monthly", "annual").default("monthly"),
  bc_show_roi: Joi.boolean().default(false),
  bc_show_margin: Joi.boolean().default(false),
  status: Joi.string().default("draft"),
  bc_stage: Joi.string().optional(),
  bc_progress: Joi.object().default({}),
  assigned_to_email: Joi.string().email().optional(),
  assigned_to_name: Joi.string().optional(),
  extra: Joi.object().default({}),
  modern_bc_metadata: Joi.object().default({}),
});

const updateSchema = Joi.object({
  client_name: Joi.string().optional(),
  client_id: Joi.number().integer().optional(),
  status: Joi.string().optional(),
  bc_stage: Joi.string().optional(),
  bc_progress: Joi.object().optional(),
  assigned_to_email: Joi.string().email().optional(),
  assigned_to_name: Joi.string().optional(),
  extra: Joi.object().optional(),
  modern_bc_metadata: Joi.object().optional(),
  process_code: Joi.string().allow(null, '').optional(),
  contract_object: Joi.string().allow(null, '').optional(),
});

const equipmentSchema = Joi.object({
  equipmentId: Joi.number().integer().required(),
  isPrimary: Joi.boolean().default(true),
});
const equipmentDetailsV2Schema = Joi.object({
  equipment_pairs: Joi.array()
    .items(
      Joi.object({
        primary_id: Joi.number().integer().required(),
        primary_type: Joi.string().trim().valid("new_available", "new_import", "cu", "installed_client").default("new_available"),
        backup_type: Joi.string().trim().valid("new_available", "new_import", "cu", "installed_client").allow(null).optional(),
        backup_id: Joi.number().integer().allow(null),
        backup_install_simultaneous: Joi.boolean().default(false),
        requires_backup: Joi.boolean().default(false),
        // Campos recuperados de equipment-details v1 (bc_equipment_details),
        // huerfano desde que el frontend migro a equipment-details-v2: nadie
        // los escribia y la hoja de Sheets generada los mostraba siempre
        // vacios. Se capturan ahora por par, no a nivel de BC completo.
        equipment_status: Joi.string().trim().allow(null, "").optional(),
        reservation_image_url: Joi.string().trim().allow(null, "").optional(),
        backup_status: Joi.string().trim().allow(null, "").optional(),
        backup_manufacture_year: Joi.number().integer().allow(null).optional(),
        installation_location: Joi.string().trim().allow(null, "").optional(),
        allows_provisional: Joi.boolean().allow(null).optional(),
        requires_complementary: Joi.boolean().allow(null).optional(),
        complementary_test_purpose: Joi.string().trim().allow(null, "").optional(),
      }),
    )
    .min(1)
    .required(),
}).custom((value, helpers) => {
  const pairs = Array.isArray(value?.equipment_pairs) ? value.equipment_pairs : [];
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index] || {};
    const requiresBackup = Boolean(pair.requires_backup);
    const hasBackupId = pair.backup_id !== null && pair.backup_id !== undefined;
    const hasBackupType = typeof pair.backup_type === "string" && pair.backup_type.trim().length > 0;

    if (requiresBackup && !hasBackupId) {
      return helpers.message(`equipment_pairs[${index}]: backup_id es obligatorio cuando requires_backup=true`);
    }
    if (requiresBackup && !hasBackupType) {
      return helpers.message(`equipment_pairs[${index}]: backup_type es obligatorio cuando requires_backup=true`);
    }
    if (!requiresBackup && hasBackupId) {
      return helpers.message(`equipment_pairs[${index}]: backup_id debe ser null cuando requires_backup=false`);
    }
    if (!requiresBackup && hasBackupType) {
      return helpers.message(`equipment_pairs[${index}]: backup_type debe ser null cuando requires_backup=false`);
    }
    if (hasBackupId && Number(pair.primary_id) === Number(pair.backup_id)) {
      return helpers.message(`equipment_pairs[${index}]: primary_id y backup_id no pueden ser iguales`);
    }
  }
  return value;
}, "equipment pairs business rules");

const determinationSchema = Joi.object({
  determinationId: Joi.number().integer().required(),
  monthlyQty: Joi.number().integer().positive(),
  annualQty: Joi.number().integer().positive(),
  monthlyQuantity: Joi.number().integer().positive(),
  annualQuantity: Joi.number().integer().positive(),
}).or("monthlyQty", "annualQty", "monthlyQuantity", "annualQuantity");

const feasibilityDecisionSchema = Joi.object({
  is_feasible: Joi.boolean().required(),
  notes: Joi.string().allow("").max(2000).optional(),
  fallback_offer_kind: Joi.string().valid(
    "venta",
    "alquiler",
    "prestamo",
    "alquiler_transferencia_dominio",
    "alquiler_con_transferencia_de_dominio",
    "rechazado_falta_informacion",
  ).optional(),
  quantities: Joi.object().optional(),
  prices: Joi.object().optional(),
  calculations: Joi.object().optional(),
});

const SECTION_ALIASES = {
  general: "general",
  lab: "laboratory_environment",
  equipment: "equipment",
  lis: "lis",
  determinations: "determinations",
  requirement: "requirement",
  investments: "investments",
  prices: "prices",
  dispatch_workspace: "dispatch_workspace",
  feasibility: "feasibility",
};

const REVIEW_ROLES = ["acp_comercial", "backoffice_comercial"];
// BUG-03: backoffice incluido — pero la validación de tipo de compra se hace en lockSection/unlockSection
// En BC público: solo acp_comercial / jefe_comercial pueden bloquear/desbloquear
// En BC privado: también backoffice / backoffice_comercial pueden bloquear/desbloquear
// NUEVO-07: jefe_de_comercial tiene mismos permisos que jefe_comercial para bloquear/desbloquear
const LOCK_ROLES = ["acp_comercial", "backoffice", "backoffice_comercial", "jefe_comercial", "jefe_de_comercial"];
const BACKOFFICE_LOCK_ROLES = new Set(["backoffice", "backoffice_comercial"]);
// NUEVO-01: private_comodato y private_sale también son tipos privados válidos en BD
// comodato_privado y private_comodato son la misma cosa con nombres distintos según el origen
const PRIVATE_PURCHASE_TYPES = new Set([
  "privada", "private", "privado",       // legacy strings
  "comodato_privado",                    // BC creado desde compra pública con comodato
  "private_comodato",                    // BC creado desde compra privada comodato
  "private_sale",                        // BC de compra privada venta directa
]);
const PHASE1_SECTIONS = ["general", "lab", "equipment", "lis", "determinations", "requirement"];
const PRE_BC_DURATION_HOURS = 48;
const BUSINESS_CASE_PROCESS_MAIL_ROLES = [
  // El comercial solicitante se agrega por created_by, no por rol global.
  "acp_comercial",
  "backoffice_comercial",
  "jefe_comercial",
  "jefe_tecnico",
  "jefe_servicio",
  "tecnico",
  "ing_servicio",
  "jefe_operaciones",
];
const DETERMINATIONS_REACTIVO_TYPES = new Set(["reactivo", "determinacion"]);
const DETERMINATIONS_TECH_TYPES = new Set(["control", "calibrador", "consumible", "material"]);
// Reactivos are filled by the commercial lead plus the flow-specific operator.
const DETERMINATIONS_REACTIVO_PUBLIC_ROLES = new Set(["jefe_comercial", "jefe_de_comercial", "acp_comercial"]);
const DETERMINATIONS_REACTIVO_PRIVATE_ROLES = new Set(["jefe_comercial", "jefe_de_comercial", "backoffice_comercial"]);
// comercial puede solicitar inspección en cualquier tipo de BC; backoffice roles en privados
const INSPECTION_REQUEST_ROLES = new Set(["comercial", "backoffice_comercial", "backoffice"]);
// ing_servicio + jefe_servicio reemplazan a tecnico + jefe_tecnico para controls/calibrators/materials
const DETERMINATIONS_TECH_EDIT_ROLES = new Set(["tecnico", "ing_servicio", "jefe_tecnico", "jefe_servicio"]);
const DETERMINATIONS_TECH_WINDOW_NOTIFY_ROLES = ["tecnico", "ing_servicio", "jefe_tecnico", "jefe_servicio"];
const DETERMINATIONS_SUBSECTIONS = new Set(["reactivos", "controles", "calibradores", "materiales"]);
const DETERMINATIONS_SHEET_ITEM_TYPES = {
  reactivos: ["reactivo", "determinacion"],
  controles: ["control"],
  calibradores: ["calibrador"],
  materiales: ["consumible", "material"],
};
const DETERMINATIONS_UNLOCK_DECIDER_ROLES = new Set(["jefe_comercial"]);
const INVESTMENT_VALUES_OP_ROLES = new Set([
  "jefe_operaciones",
  "jefe_de_operaciones",
]);
const INVESTMENT_VALUES_FIN_ROLES = new Set(["jefe_financiero"]);
// Edicion en paralelo de la lista de inversiones (sin carrito ni dueno por
// item): estos son los unicos roles que pueden agregar items o cambiar
// cantidades/caracteristicas.
const INVESTMENT_EDIT_ROLES = new Set([
  "acp_comercial",
  "jefe_comercial",
  "jefe_de_comercial",
  "jefe_operaciones",
  "jefe_servicio",
  "jefe_logistica",
]);
const INVESTMENT_COMPLETE_ROLES = new Set([
  "acp_comercial",
  "jefe_comercial",
  "jefe_de_comercial",
  ...INVESTMENT_VALUES_OP_ROLES,
]);

const AUTOSAVE_FLAG_ADMIN_ROLES = new Set([
  "admin",
  "administrador",
  "gerencia",
  "gerencia_general",
  "jefe_comercial",
  "jefe_tecnico",
  "jefe_operaciones",
]);
const BC_CONSUMPTION_DEBUG = (() => {
  const raw = String(process.env.BC_CONSUMPTION_DEBUG || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
})();

function logConsumptionDebug(payload, message) {
  if (!BC_CONSUMPTION_DEBUG) return;
  logger.info(payload, message);
}

function summarizeConsumptionItems(items = [], limit = 20) {
  const safeItems = Array.isArray(items) ? items : [];
  const withQty = safeItems.map((item) => {
    const qty = Number(item?.annualQty ?? item?.annualQuantity ?? item?.annual_qty ?? 0);
    return {
      key: item?.key || null,
      itemId: item?.itemId || null,
      name: item?.name || null,
      type: item?.type || item?.item_type || null,
      equipmentId: item?.equipmentId ?? item?.equipment_id ?? null,
      annualQty: Number.isFinite(qty) ? qty : 0,
    };
  });
  return {
    count: withQty.length,
    nonZeroCount: withQty.filter((item) => item.annualQty > 0).length,
    sample: withQty.slice(0, limit),
    nonZeroSample: withQty.filter((item) => item.annualQty > 0).slice(0, limit),
  };
}

function hasTextValue(value) {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function hasAnyFields(obj, fields = []) {
  if (!obj || typeof obj !== "object") return false;
  return fields.some((field) => hasValue(obj[field]));
}

function hasGeneralPayloadChanges(payload = {}) {
  if (!payload || typeof payload !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(payload, "client_name")) return true;
  if (Object.prototype.hasOwnProperty.call(payload, "process_code")) return true;
  if (Object.prototype.hasOwnProperty.call(payload, "contract_object")) return true;
  if (Object.prototype.hasOwnProperty.call(payload, "modern_bc_metadata")) return true;
  return false;
}

function hasGeneralSavePayload(payload = {}) {
  if (!payload || typeof payload !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(payload, "client_name")) return true;
  if (Object.prototype.hasOwnProperty.call(payload, "process_code")) return true;
  if (Object.prototype.hasOwnProperty.call(payload, "contract_object")) return true;
  const metadata = payload?.modern_bc_metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  if (Object.prototype.hasOwnProperty.call(metadata, "general_data")) return true;
  return false;
}

function isCommercialSectionActor(req = {}) {
  const role = String(req.user?.role || "").toLowerCase();
  const scope = String(req.user?.scope || req.user?.role_name || "").toLowerCase();
  const tokens = new Set(
    [role, scope]
      .filter(Boolean)
      .flatMap((value) => value.split(/[,\s|]+/))
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return tokens.has("comercial");
}

function shouldStartQueueOnGeneralSave(businessCase = {}) {
  const purchaseType = String(businessCase?.bc_purchase_type || "").trim().toLowerCase();
  return (
    purchaseType === "public" ||
    purchaseType === "private_comodato" ||
    purchaseType === "comodato_publico" ||
    purchaseType === "comodato_privado"
  );
}

function isTruthyFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function getExpectedVersion(req) {
  const rawHeader = req.headers["if-match"];
  if (rawHeader) return rawHeader;
  const rawBody = req.body?.version;
  if (rawBody) return rawBody;
  return null;
}

function getIdempotencyKey(req) {
  const headerKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
  if (headerKey) return String(headerKey).trim();
  const bodyKey = req.body?.idempotency_key || req.body?.idempotencyKey;
  if (bodyKey) return String(bodyKey).trim();
  return null;
}

async function startIdempotentWrite({
  req,
  operationScope,
  businessCaseId = null,
  payload = {},
}) {
  const providedKey = getIdempotencyKey(req);
  const bucket = Math.floor(Date.now() / 30000);
  const autoKeyHash = idempotencyService.hashPayload(payload).slice(0, 24);
  const key =
    providedKey ||
    `auto:${operationScope}:${req.user?.id || "anon"}:${bucket}:${autoKeyHash}`;

  return idempotencyService.start({
    operationScope,
    idempotencyKey: key,
    businessCaseId,
    payload,
    userId: req.user?.id || null,
  });
}

function applyResponseHeadersFromBody(res, responseBody = {}) {
  const version = responseBody?.data?.version;
  if (version) {
    res.set("ETag", `"${version}"`);
  }
}

async function completeIdempotentWrite(session, responseBody, httpStatus = 200) {
  if (!session?.enabled || !session?.recordId) return;
  await idempotencyService.complete(session.recordId, {
    httpStatus,
    responsePayload: responseBody,
  });
}

async function failIdempotentWrite(session, error) {
  if (!session?.enabled || !session?.recordId) return;
  await idempotencyService.fail(session.recordId, error);
}

function resolveRequestRole(req) {
  return String(req.user?.role || req.user?.scope || req.user?.role_name || "").trim().toLowerCase();
}

// Carrito eliminado: acp_comercial, jefe_comercial, jefe_de_comercial,
// jefe_operaciones, jefe_servicio y jefe_logistica editan la lista de
// inversiones en paralelo, sin dueno por item ni confirmacion que bloquee.
async function assertInvestmentsEditable(businessCase, role = "unknown") {
  const currentDocument = businessCase?.id
    ? await determinationsGateService.getCurrentDocument(businessCase.id)
    : null;
  const determinationsGate = determinationsGateService.buildGateInfo({
    businessCase,
    role,
    currentDocument,
  });
  if (!determinationsGate?.documentUploaded) {
    const error = new Error("Primero se debe cargar el documento de estadistica para habilitar las inversiones.");
    error.status = 409;
    error.code = "INVESTMENT_STAT_DOCUMENT_REQUIRED";
    throw error;
  }
  if (!INVESTMENT_EDIT_ROLES.has(role)) {
    const error = new Error("No tienes permisos para editar la lista de inversiones.");
    error.status = 403;
    error.code = "INVESTMENT_ROLE_REQUIRED";
    throw error;
  }
  return { documentUploaded: true, determinationsGate };
}

function normalizePurchaseTypeForGate(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (["private_comodato", "comodato_privado"].includes(raw)) return "private_comodato";
  if (["public", "comodato_publico"].includes(raw)) return "public";
  if (raw.startsWith("private")) return "private_comodato";
  return "public";
}

function isPublicBusinessCase(value = "") {
  return normalizePurchaseTypeForGate(value) === "public";
}

function resolveBusinessCaseSmartObjective(businessCase = {}) {
  const metadata = businessCase?.modern_bc_metadata && typeof businessCase.modern_bc_metadata === "object"
    ? businessCase.modern_bc_metadata
    : {};
  const generalData = metadata?.general_data && typeof metadata.general_data === "object"
    ? metadata.general_data
    : {};

  return [
    generalData?.smart_objective,
    generalData?.smartObjective,
    metadata?.smart_objective,
    metadata?.smartObjective,
    businessCase?.smart_objective,
  ].find((value) => hasTextValue(value)) || "";
}

function resolveBusinessCaseGeneralMetadata(businessCase = {}) {
  const metadata = businessCase?.modern_bc_metadata && typeof businessCase.modern_bc_metadata === "object"
    ? businessCase.modern_bc_metadata
    : {};
  const generalData = metadata?.general_data && typeof metadata.general_data === "object"
    ? metadata.general_data
    : {};
  const isPublic = isPublicBusinessCase(businessCase?.bc_purchase_type);

  return {
    metadata,
    generalData,
    isPublic,
    smartObjective: resolveBusinessCaseSmartObjective(businessCase),
    contractingEntity:
      generalData?.contractingEntity ||
      metadata?.contractingEntity ||
      "",
    provinceCity:
      generalData?.provinceCity ||
      metadata?.provinceCity ||
      "",
    clientType:
      generalData?.clientType ||
      metadata?.clientType ||
      "",
  };
}

function resolveInvestmentCartStatus(businessCase = {}) {
  const metadata = preflowService.toObject(businessCase?.modern_bc_metadata);
  const investmentsMetadata = metadata?.investments && typeof metadata.investments === "object" && !Array.isArray(metadata.investments)
    ? metadata.investments
    : {};
  const rawCart = [
    metadata?.investment_cart_status,
    metadata?.investments_cart,
    metadata?.investment_cart,
    investmentsMetadata?.cart_status,
    investmentsMetadata?.cart,
  ].find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};

  const acpCart = rawCart.acp && typeof rawCart.acp === "object" && !Array.isArray(rawCart.acp)
    ? rawCart.acp
    : {};
  const serviceCart = rawCart.service && typeof rawCart.service === "object" && !Array.isArray(rawCart.service)
    ? rawCart.service
    : {};

  const acpConfirmedAt =
    rawCart.acp_confirmed_at ||
    rawCart.acpConfirmedAt ||
    acpCart.confirmed_at ||
    acpCart.confirmedAt ||
    null;
  const serviceConfirmedAt =
    rawCart.service_confirmed_at ||
    rawCart.serviceConfirmedAt ||
    serviceCart.confirmed_at ||
    serviceCart.confirmedAt ||
    null;
  const legacyConfirmed = Boolean(rawCart.confirmed ?? rawCart.cart_confirmed);
  const legacyConfirmedByRole = String(
    rawCart.confirmed_by_role ||
    rawCart.confirmedByRole ||
    "",
  ).trim().toLowerCase();
  const legacyServiceConfirmation = legacyConfirmed && legacyConfirmedByRole === "jefe_servicio";

  const acpConfirmed = Boolean(
    rawCart.acp_confirmed ??
    rawCart.acpConfirmed ??
    acpCart.confirmed ??
    acpConfirmedAt ??
    (legacyConfirmed && !legacyServiceConfirmation),
  );
  const serviceConfirmed = Boolean(
    rawCart.service_confirmed ??
    rawCart.serviceConfirmed ??
    serviceCart.confirmed ??
    serviceConfirmedAt ??
    legacyServiceConfirmation,
  );

  return {
    confirmed: serviceConfirmed,
    acpConfirmed,
    serviceConfirmed,
    acpConfirmedAt,
    acpConfirmedByEmail:
      rawCart.acp_confirmed_by_email ||
      rawCart.acpConfirmedByEmail ||
      acpCart.confirmed_by_email ||
      acpCart.confirmedByEmail ||
      (acpConfirmed && !serviceConfirmed ? rawCart.confirmed_by_email || rawCart.confirmedByEmail : null) ||
      null,
    acpConfirmedByRole:
      rawCart.acp_confirmed_by_role ||
      rawCart.acpConfirmedByRole ||
      acpCart.confirmed_by_role ||
      acpCart.confirmedByRole ||
      (acpConfirmed && !serviceConfirmed ? rawCart.confirmed_by_role || rawCart.confirmedByRole : null) ||
      null,
    serviceConfirmedAt,
    serviceConfirmedByEmail:
      rawCart.service_confirmed_by_email ||
      rawCart.serviceConfirmedByEmail ||
      serviceCart.confirmed_by_email ||
      serviceCart.confirmedByEmail ||
      (serviceConfirmed ? rawCart.confirmed_by_email || rawCart.confirmedByEmail : null) ||
      null,
    serviceConfirmedByRole:
      rawCart.service_confirmed_by_role ||
      rawCart.serviceConfirmedByRole ||
      serviceCart.confirmed_by_role ||
      serviceCart.confirmedByRole ||
      (serviceConfirmed ? rawCart.confirmed_by_role || rawCart.confirmedByRole : null) ||
      null,
  };
}

function normalizeConsumptionType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "determinacion") return "reactivo";
  return normalized || "consumible";
}

function classifyConsumptionItemsByType(items = []) {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => normalizeConsumptionType(item?.type))
    .filter(Boolean);
  const hasReactivoFamily = normalized.some((type) => DETERMINATIONS_REACTIVO_TYPES.has(type));
  const hasTechFamily = normalized.some((type) => DETERMINATIONS_TECH_TYPES.has(type));
  return { hasReactivoFamily, hasTechFamily };
}

function assertConsumptionRolePolicyOrThrow({ role = "", hasReactivoFamily = false, hasTechFamily = false, bcPurchaseType = "" }) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  const isPublic = normalizePurchaseTypeForGate(bcPurchaseType) === "public";

  if (hasTechFamily && !DETERMINATIONS_TECH_EDIT_ROLES.has(normalizedRole)) {
    const error = new Error("Solo tecnico y jefe_tecnico pueden registrar controles, calibradores y materiales.");
    error.status = 403;
    error.code = "DETERMINATIONS_TECH_ROLE_REQUIRED";
    throw error;
  }

  if (hasReactivoFamily) {
    const allowedReactivoRoles = isPublic ? DETERMINATIONS_REACTIVO_PUBLIC_ROLES : DETERMINATIONS_REACTIVO_PRIVATE_ROLES;
    if (!allowedReactivoRoles.has(normalizedRole) && !DETERMINATIONS_TECH_EDIT_ROLES.has(normalizedRole)) {
      const msg = isPublic
        ? "Solo jefe_comercial o acp_comercial pueden registrar reactivos en un proceso publico."
        : "Solo jefe_comercial o backoffice_comercial pueden registrar reactivos en un proceso privado.";
      const error = new Error(msg);
      error.status = 403;
      error.code = "DETERMINATIONS_REACTIVO_ROLE_REQUIRED";
      throw error;
    }
  }
}

function normalizeSectionList(sections = []) {
  if (!Array.isArray(sections)) return [];
  return [...new Set(
    sections
      .map((section) => String(section || "").trim().toLowerCase())
      .filter(Boolean),
  )];
}

async function getUsersByRoles(roles = []) {
  if (!roles.length) return [];
  const { rows } = await db.query(
    `SELECT id, email, fullname, role FROM users WHERE role = ANY($1) AND active = true`,
    [roles]
  );
  return rows;
}

function buildBusinessCaseProcessKey(businessCaseId) {
  return `business_case:${businessCaseId}`;
}

function normalizeBusinessCaseFlowLabel(bcPurchaseType) {
  const normalized = String(bcPurchaseType || "").toLowerCase();
  const isPublic = normalized.includes("public");
  return isPublic ? "Proceso de compra publica" : "Proceso de compra privada";
}

function resolveBusinessCaseClientDisplayName(businessCase = {}) {
  const metadata = businessCase?.modern_bc_metadata && typeof businessCase.modern_bc_metadata === "object"
    ? businessCase.modern_bc_metadata
    : {};
  const generalData = metadata?.general_data && typeof metadata.general_data === "object"
    ? metadata.general_data
    : {};

  const candidates = [
    businessCase?.client_name,
    generalData?.client_name,
    generalData?.razon_social,
    generalData?.business_name,
    generalData?.nombre_comercial,
    generalData?.commercial_name,
    generalData?.client_commercial_name,
  ];

  for (const value of candidates) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }

  return "Cliente sin nombre";
}

function normalizeDateOnlyInput(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function addMonthsIso(months = 0, baseDate = new Date()) {
  const parsedMonths = Number.parseInt(months, 10);
  if (!Number.isFinite(parsedMonths) || parsedMonths < 0) return null;
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() + parsedMonths);
  return normalizeDateOnlyInput(date);
}

async function getBusinessCaseClientDetails(clientId) {
  if (!clientId) return null;
  const { rows } = await db.query(
    `SELECT id, commercial_name, client_email, shipping_contact_name, shipping_phone, shipping_cellphone, shipping_address
       FROM client_requests
      WHERE id = $1
      LIMIT 1`,
    [clientId],
  );
  return rows[0] || null;
}

function buildBusinessCaseInstallationAddress(metadata = {}, generalData = {}, clientInfo = null) {
  const directCandidates = [
    generalData?.installation_address,
    metadata?.installation_address,
    clientInfo?.shipping_address,
  ];

  for (const candidate of directCandidates) {
    if (hasTextValue(candidate)) return String(candidate).trim();
  }

  const composedParts = [
    generalData?.client_location_name,
    metadata?.client_location_name,
    generalData?.installation_city,
    metadata?.installation_city,
    generalData?.installation_province,
    metadata?.installation_province,
    generalData?.provinceCity,
    metadata?.provinceCity,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (!composedParts.length) return null;
  return [...new Set(composedParts)].join(", ");
}

async function resolveBusinessCaseInspectionEquipment(businessCaseId, businessCase = {}, metadata = {}) {
  const selectedEquipment = await equipmentSelectionService.getSelectedEquipment(businessCaseId).catch(() => null);
  const metadataEquipmentDetails = metadata?.equipment_details && typeof metadata.equipment_details === "object"
    ? metadata.equipment_details
    : {};
  const metadataEquipmentPairs = Array.isArray(metadataEquipmentDetails?.equipment_pairs)
    ? metadataEquipmentDetails.equipment_pairs
    : [];
  const extraEquipmentPairs = Array.isArray(businessCase?.extra?.equipment_details)
    ? businessCase.extra.equipment_details
    : [];
  const rootEquipmentPairs = Array.isArray(businessCase?.equipment_details)
    ? businessCase.equipment_details
    : [];
  const equipmentPairs = [...metadataEquipmentPairs, ...extraEquipmentPairs, ...rootEquipmentPairs];

  const equipmentIds = Array.from(
    new Set(
      equipmentPairs
        .flatMap((pair) => [pair?.primary_id, pair?.backup_id])
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value)),
    ),
  );

  const namesById = {};
  if (equipmentIds.length) {
    const { rows } = await db.query(
      `SELECT id, name, model
         FROM public.equipment_models
        WHERE id = ANY($1::int[])`,
      [equipmentIds],
    );
    for (const row of rows) {
      namesById[String(row.id)] = row?.name || row?.model || "Equipo";
    }
  }

  const items = [];
  const pushEquipment = (equipmentId, displayName, state) => {
    const numericId = Number.parseInt(equipmentId, 10);
    const key = Number.isFinite(numericId) ? String(numericId) : `${displayName}:${state}`;
    if (!displayName) return;
    if (items.some((item) => item.__key === key)) return;
    items.push({
      __key: key,
      nombre_equipo: displayName,
      estado: state || "nuevo",
      unidad_id: Number.isFinite(numericId) ? numericId : "",
      serial: "",
    });
  };

  if (selectedEquipment?.equipment_id || selectedEquipment?.equipment_name || selectedEquipment?.model) {
    pushEquipment(
      selectedEquipment?.equipment_id,
      selectedEquipment?.equipment_name || selectedEquipment?.model || "Equipo principal",
      "principal",
    );
  }

  for (const pair of equipmentPairs) {
    const primaryId = Number.parseInt(pair?.primary_id, 10);
    const backupId = Number.parseInt(pair?.backup_id, 10);
    if (Number.isFinite(primaryId)) {
      pushEquipment(primaryId, namesById[String(primaryId)] || "Equipo principal", pair?.primary_type || "nuevo");
    }
    if (Number.isFinite(backupId)) {
      pushEquipment(backupId, namesById[String(backupId)] || "Equipo backup", pair?.backup_type || "backup");
    }
  }

  return items.map(({ __key, ...rest }) => rest);
}

async function buildBusinessCaseInspectionDraft({
  businessCaseId,
  businessCase,
  metadata,
  inspectionWindow = {},
  overrides = {},
}) {
  const currentMetadata = metadata && typeof metadata === "object" ? metadata : {};
  const clientInfo = await getBusinessCaseClientDetails(businessCase?.client_id).catch(() => null);
  const generalData = currentMetadata?.general_data && typeof currentMetadata.general_data === "object"
    ? currentMetadata.general_data
    : {};
  const lisIntegration = await bcLisIntegrationService.getLisIntegration(businessCaseId);
  const requirements = await bcRequirementsService.getRequirements(businessCaseId);
  const equipment = await resolveBusinessCaseInspectionEquipment(businessCaseId, businessCase, currentMetadata);

  const normalizeOverride = (value) => {
    if (!hasTextValue(value)) return null;
    return String(value).trim();
  };

  const inferredObservations = [
    hasTextValue(businessCase?.process_code) ? `Proceso: ${businessCase.process_code}` : null,
    hasTextValue(requirements?.observations) ? `Requerimientos: ${requirements.observations}` : null,
    hasTextValue(generalData?.notes) ? `Notas comerciales: ${generalData.notes}` : null,
  ].filter(Boolean).join(" | ");

  const draft = {
    nombre_cliente:
      normalizeOverride(overrides?.nombre_cliente) ||
      businessCase?.client_name ||
      generalData?.commercial_name ||
      generalData?.client_commercial_name ||
      clientInfo?.commercial_name ||
      "",
    direccion_cliente:
      normalizeOverride(overrides?.direccion_cliente) ||
      buildBusinessCaseInstallationAddress(currentMetadata, generalData, clientInfo) ||
      "",
    persona_contacto:
      normalizeOverride(overrides?.persona_contacto) ||
      clientInfo?.shipping_contact_name ||
      generalData?.contact_name ||
      generalData?.shipping_contact_name ||
      "",
    celular_contacto:
      normalizeOverride(overrides?.celular_contacto) ||
      clientInfo?.shipping_phone ||
      clientInfo?.shipping_cellphone ||
      generalData?.shipping_phone ||
      generalData?.shipping_cellphone ||
      "",
    email_cliente:
      normalizeOverride(overrides?.email_cliente) ||
      clientInfo?.client_email ||
      "",
    fecha_instalacion: normalizeDateOnlyInput(inspectionWindow?.inspection_min_date) || "",
    fecha_tope_instalacion: normalizeDateOnlyInput(inspectionWindow?.inspection_max_date) || "",
    requiere_lis: Boolean(lisIntegration?.includes_lis),
    equipos: equipment,
    anotaciones:
      normalizeOverride(overrides?.anotaciones) ||
      "Solicitud de inspeccion de ambiente generada desde Business Case",
    accesorios:
      normalizeOverride(overrides?.accesorios) ||
      "",
    observaciones:
      normalizeOverride(overrides?.observaciones) ||
      inferredObservations,
    // La inspeccion disparada desde Business Case es, por definicion, "por
    // costos" (estimacion de costos/factibilidad antes de cerrar el trato) --
    // no es una eleccion del usuario, es fija segun el origen del flujo.
    // "origen" permite a la bandeja "Independientes" de Solicitudes excluir
    // esta fila (ya se gestiona en la pestana "Business Case").
    tipo_inspeccion: "costos",
    origen: "business_case",
  };

  const missingFields = [];
  if (!hasTextValue(draft.nombre_cliente)) missingFields.push("nombre_cliente");
  if (!hasTextValue(draft.direccion_cliente)) missingFields.push("direccion_cliente");
  if (!hasTextValue(draft.fecha_instalacion)) missingFields.push("fecha_instalacion");
  if (!hasTextValue(draft.fecha_tope_instalacion)) missingFields.push("fecha_tope_instalacion");
  if (!Array.isArray(draft.equipos) || !draft.equipos.length) missingFields.push("equipos");

  return { draft, missingFields };
}

function resolveBusinessCaseInspectionWindow(requirements = {}) {
  const monthValues = [
    requirements?.deadline_months,
    requirements?.projected_deadline_months,
  ]
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value >= 0);

  if (!monthValues.length) {
    const error = new Error("No se puede generar la solicitud de inspeccion sin plazo o proyeccion de plazo en el Business Case.");
    error.status = 409;
    error.code = "BC_INSPECTION_WINDOW_REQUIRED";
    throw error;
  }

  const sorted = [...monthValues].sort((a, b) => a - b);
  const inspection_min_date = addMonthsIso(sorted[0]);
  const inspection_max_date = addMonthsIso(sorted[sorted.length - 1]);

  if (!inspection_min_date || !inspection_max_date) {
    const error = new Error("No se pudo calcular la ventana de inspeccion del Business Case.");
    error.status = 409;
    error.code = "BC_INSPECTION_WINDOW_INVALID";
    throw error;
  }

  return { inspection_min_date, inspection_max_date };
}

async function ensureBusinessCaseInspectionRequest({
  businessCaseId,
  businessCase,
  metadata,
  actorUser,
  inspectionWindow,
  inspectionPayload = {},
  statDocument = null,
}) {
  const currentMetadata = metadata && typeof metadata === "object" ? { ...metadata } : {};
  const existingInspection = currentMetadata?.environment_inspection_request
    && typeof currentMetadata.environment_inspection_request === "object"
    ? { ...currentMetadata.environment_inspection_request }
    : {};

  if (existingInspection?.request_id) {
    return {
      metadata: currentMetadata,
      inspection: existingInspection,
      created: false,
    };
  }

  const inspection_min_date = normalizeDateOnlyInput(inspectionWindow?.inspection_min_date);
  const inspection_max_date = normalizeDateOnlyInput(inspectionWindow?.inspection_max_date);

  if (!inspection_min_date || !inspection_max_date) {
    const error = new Error("Debes registrar el rango minimo y maximo para solicitar la inspeccion de ambiente.");
    error.status = 409;
    error.code = "BC_INSPECTION_WINDOW_REQUIRED";
    throw error;
  }
  if (inspection_min_date > inspection_max_date) {
    const error = new Error("La fecha minima de inspeccion no puede ser mayor que la fecha maxima.");
    error.status = 409;
    error.code = "BC_INSPECTION_WINDOW_INVALID";
    throw error;
  }

  const { draft: payload, missingFields } = await buildBusinessCaseInspectionDraft({
    businessCaseId,
    businessCase,
    metadata: currentMetadata,
    inspectionWindow: {
      inspection_min_date,
      inspection_max_date,
    },
    overrides: inspectionPayload,
  });

  if (missingFields.length) {
    const labels = {
      nombre_cliente: "nombre de cliente",
      direccion_cliente: "direccion de instalacion",
      fecha_instalacion: "fecha minima de instalacion",
      fecha_tope_instalacion: "fecha maxima de instalacion",
      equipos: "equipo seleccionado",
    };
    const error = new Error(`No se puede generar F.ST-20. Faltan datos requeridos: ${missingFields.map((field) => labels[field] || field).join(", ")}.`);
    error.status = 409;
    error.code = `BC_INSPECTION_${String(missingFields[0] || "REQUIRED").toUpperCase()}_REQUIRED`;
    error.details = { missing_fields: missingFields, draft: payload };
    throw error;
  }

  const inspectionRequest = await createServiceRequest({
    requester_id: actorUser?.id,
    requester_email: actorUser?.email || businessCase?.created_by_email || null,
    requester_name: actorUser?.fullname || actorUser?.name || null,
    request_type_id: "F.ST-20",
    payload,
  });

  const requestId =
    inspectionRequest?.request?.id ||
    inspectionRequest?.request_id ||
    inspectionRequest?.id ||
    null;
  const documentId =
    inspectionRequest?.document?.id ||
    inspectionRequest?.document?.pdfId ||
    inspectionRequest?.document?.docId ||
    null;
  const documentLink =
    inspectionRequest?.document?.link ||
    inspectionRequest?.document?.pdfLink ||
    inspectionRequest?.document?.docLink ||
    null;

  if (!requestId) {
    const error = new Error("No se pudo generar la solicitud automatica F.ST-20 del Business Case.");
    error.status = 500;
    error.code = "BC_INSPECTION_REQUEST_CREATE_FAILED";
    throw error;
  }

  if (statDocument?.drive_file_id) {
    await addDriveAttachment({
      request_id: requestId,
      drive_file_id: statDocument.drive_file_id,
      title: statDocument.name || "Documento estadistico BC",
      mime_type: statDocument.mime_type || "application/octet-stream",
    }).catch((attachmentError) => {
      logger.warn(
        { error: attachmentError.message, businessCaseId, requestId },
        "No se pudo adjuntar el documento estadistico a la solicitud F.ST-20",
      );
    });
  }

  const requestedAt = new Date().toISOString();
  currentMetadata.environment_inspection_request = {
    request_id: requestId,
    acta_document_id: documentId,
    acta_document_link: documentLink,
    inspection_min_date,
    inspection_max_date,
    payload,
    requested_at: requestedAt,
    requested_by_id: actorUser?.id || null,
    requested_by_email: actorUser?.email || null,
    source_stat_document_drive_file_id: statDocument?.drive_file_id || null,
    source_stat_document_drive_link: statDocument?.drive_link || null,
  };

  return {
    metadata: currentMetadata,
    inspection: currentMetadata.environment_inspection_request,
    created: true,
  };
}

function buildBusinessCaseProcessSubject(businessCase = {}) {
  const flowLabel = normalizeBusinessCaseFlowLabel(businessCase?.bc_purchase_type);
  const clientName = resolveBusinessCaseClientDisplayName(businessCase);
  const processCode = String(businessCase?.process_code || "").trim();
  return processCode
    ? `${flowLabel} - ${clientName} - ${processCode}`
    : `${flowLabel} - ${clientName}`;
}

function canRequestBusinessCaseInspection(role = "") {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return INSPECTION_REQUEST_ROLES.has(normalizedRole);
}

async function resolveBusinessCaseMailingList({ businessCase, roles = BUSINESS_CASE_PROCESS_MAIL_ROLES }) {
  const recipients = await getUsersByRoles(roles);
  let creatorEmail = String(businessCase?.created_by_email || "").trim().toLowerCase();
  if (!creatorEmail && businessCase?.created_by) {
    const { rows: creatorRows } = await db.query(
      `SELECT email FROM users WHERE id = $1 AND active = true LIMIT 1`,
      [businessCase.created_by],
    );
    creatorEmail = String(creatorRows?.[0]?.email || "").trim().toLowerCase();
  }
  const emails = [...new Set(
    [
      creatorEmail,
      ...recipients.map((user) => String(user?.email || "").trim().toLowerCase()),
    ].filter(Boolean),
  )];
  const [primaryTo, ...ccEmails] = emails;
  return {
    primaryTo: primaryTo || null,
    ccEmails,
    recipients,
    creatorUserId: businessCase?.created_by || null,
  };
}

async function notifySectionReview({ businessCaseId, section, actor }) {
  const recipients = await getUsersByRoles(REVIEW_ROLES);
  const bc = await businessCaseService.getBusinessCaseById(businessCaseId).catch(() => null);
  const clientName = bc?.client_name || "Cliente pendiente";
  await Promise.all(
    recipients.map((user) =>
      notificationManager.sendNotification({
        userId: user.id,
        template: "bc_section_review_requested",
        data: { business_case_id: businessCaseId, section_name: section, client_name: clientName },
        email: true,
        chat: false,
        source: "business_case.section_review",
        meta: {
          businessCaseId,
          section,
          actor,
          process_key: buildBusinessCaseProcessKey(businessCaseId),
        }
      }).catch(() => null)
    )
  );
}

async function notifyDeterminationsTechWindowStarted({ businessCaseId, actor }) {
  const recipients = await getUsersByRoles(DETERMINATIONS_TECH_WINDOW_NOTIFY_ROLES);
  const bc = await businessCaseService.getBusinessCaseById(businessCaseId).catch(() => null);
  const clientName = bc?.client_name || "Cliente pendiente";
  await Promise.all(
    recipients.map((user) =>
      notificationManager.sendNotification({
        userId: user.id,
        template: "bc_section_review_requested",
        data: { business_case_id: businessCaseId, section_name: "determinations", client_name: clientName },
        email: true,
        chat: false,
        source: "business_case.determinations_tech_window_started",
        meta: {
          businessCaseId,
          section: "determinations",
          actor,
          process_key: buildBusinessCaseProcessKey(businessCaseId),
          technical_window_hours: determinationsGateService.DETERMINATIONS_DEADLINE_HOURS,
        }
      }).catch(() => null)
    )
  );
}

async function notifyDeterminationsDocumentUploaded({ businessCaseId, actor }) {
  return workflowSlaService.notifyParticipants({
    businessCaseId,
    eventKey: "stat_document_uploaded_pending_reactivos",
    title: "Documento estadistico cargado: sincroniza y valida reactivos",
    message:
      `${actor || "El comercial"} cargo el documento estadistico. ` +
      "Es turno de sincronizar las cantidades de reactivos desde el Sheet y validar la seccion para habilitar la revision tecnica.",
    actorEmail: actor || null,
    excludeActor: true,
    extraData: {
      section_name: "determinations",
    },
  });
}

async function notifyDeterminationsReactivosValidated({ businessCaseId, actor }) {
  return workflowSlaService.notifyParticipants({
    businessCaseId,
    eventKey: "reactivos_validated",
    title: "Reactivos validados: continuar Business Case",
    message:
      `Los reactivos fueron validados por ${actor || "ACP Comercial"}. ` +
      "El resto de participantes debe completar los pasos siguientes: controles, calibradores, materiales, inversiones y factibilidad.",
    actorEmail: actor || null,
    excludeActor: true,
    extraData: {
      section_name: "determinations",
      technical_window_hours: determinationsGateService.DETERMINATIONS_DEADLINE_HOURS,
    },
  });
}

function subsectionFromConsumptionType(value) {
  const type = normalizeConsumptionType(value);
  if (DETERMINATIONS_REACTIVO_TYPES.has(type)) return "reactivos";
  if (type === "control") return "controles";
  if (type === "calibrador") return "calibradores";
  return "materiales";
}

function hasRequiredDeterminationsQuantity(item = {}, subsection = "") {
  const annualQty = Number(item?.annualQty ?? item?.annualQuantity ?? 0);
  if (subsection === "reactivos") return Number.isFinite(annualQty) && annualQty > 0;

  // En el formato c303/c503 verificado en produccion, las filas tecnicas
  // tienen PRODUCTO CALCULADO vacio y el valor operativo en PRODUCTO A
  // ENTREGAR. plannedQty es esa columna sincronizada desde el Sheet.
  const plannedQty = Number(item?.plannedQty ?? item?.planned_qty ?? 0);
  return (
    (Number.isFinite(annualQty) && annualQty > 0) ||
    (Number.isFinite(plannedQty) && plannedQty > 0)
  );
}

function normalizeSubsectionKey(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "reactivo" || raw === "reactivos") return "reactivos";
  if (raw === "control" || raw === "controles") return "controles";
  if (raw === "calibrador" || raw === "calibradores") return "calibradores";
  if (raw === "material" || raw === "materiales" || raw === "consumible" || raw === "consumibles") return "materiales";
  return raw;
}

function resolveDeterminationsSectionLocks(gate = {}) {
  const phase = String(gate?.phase || "commercial_input").toLowerCase();
  const raw = gate?.section_locks && typeof gate.section_locks === "object" ? gate.section_locks : {};
  const locks = {
    reactivos: Boolean(raw.reactivos),
    controles: Boolean(raw.controles),
    calibradores: Boolean(raw.calibradores),
    materiales: Boolean(raw.materiales),
  };
  if (phase === "technical_review") locks.reactivos = true;
  if (phase === "locked" || gate?.quantities_locked === true) {
    locks.reactivos = true;
    locks.controles = true;
    locks.calibradores = true;
    locks.materiales = true;
  }
  return locks;
}

function resolveUnlockRequestList(gate = {}) {
  const raw = Array.isArray(gate?.unlock_requests) ? gate.unlock_requests : [];
  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: String(entry.id || "").trim() || null,
      subsection: normalizeSubsectionKey(entry.subsection),
      status: String(entry.status || "pending").trim().toLowerCase(),
      requested_at: entry.requested_at || null,
      requested_by_email: entry.requested_by_email || null,
      requested_by_role: entry.requested_by_role || null,
      reason: entry.reason || "",
      resolved_at: entry.resolved_at || null,
      resolved_by_email: entry.resolved_by_email || null,
      resolution_notes: entry.resolution_notes || "",
    }))
    .filter((entry) => entry.id && DETERMINATIONS_SUBSECTIONS.has(entry.subsection));
}

function buildUnlockRequestId(subsection) {
  const seed = `${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}:${subsection}`;
  return `unlock_${seed}`;
}

function assertConsumptionPhasePolicyOrThrow({
  phase = "commercial_input",
  role = "",
  hasReactivoFamily = false,
  hasTechFamily = false,
  bcPurchaseType = "",
}) {
  const normalizedPhase = String(phase || "commercial_input").trim().toLowerCase();
  const normalizedRole = String(role || "").trim().toLowerCase();
  const isPublic = normalizePurchaseTypeForGate(bcPurchaseType) === "public";
  const reactivoRoles = isPublic ? DETERMINATIONS_REACTIVO_PUBLIC_ROLES : DETERMINATIONS_REACTIVO_PRIVATE_ROLES;

  if (normalizedPhase === "locked") {
    const error = new Error("Las cantidades de determinaciones estan bloqueadas. Solicita reapertura a Jefe Comercial.");
    error.status = 409;
    error.code = "DETERMINATIONS_QUANTITIES_LOCKED";
    throw error;
  }

  if (normalizedPhase === "technical_review") {
    if (hasReactivoFamily) {
      const error = new Error("En revision tecnica los reactivos quedan en solo lectura (solo > 0 definidos por ACP/Backoffice).");
      error.status = 403;
      error.code = "DETERMINATIONS_REACTIVOS_READ_ONLY";
      throw error;
    }
    if (hasTechFamily && !DETERMINATIONS_TECH_EDIT_ROLES.has(normalizedRole)) {
      const error = new Error("Solo tecnico y jefe_tecnico pueden completar calibradores, controles y materiales en revision tecnica.");
      error.status = 403;
      error.code = "DETERMINATIONS_TECH_REVIEW_ROLE_REQUIRED";
      throw error;
    }
    return;
  }

  if (normalizedPhase === "commercial_input") {
    if (hasTechFamily) {
      const error = new Error("Aun no inicia la revision tecnica. Primero deben terminar reactivos.");
      error.status = 403;
      error.code = "DETERMINATIONS_TECH_REVIEW_NOT_STARTED";
      throw error;
    }
    if (hasReactivoFamily && !reactivoRoles.has(normalizedRole)) {
      const error = new Error(
        isPublic
          ? "Solo jefe_comercial o acp_comercial pueden completar reactivos en la fase comercial."
          : "Solo jefe_comercial o backoffice_comercial pueden completar reactivos en la fase comercial.",
      );
      error.status = 403;
      error.code = "DETERMINATIONS_REACTIVO_PHASE_ROLE_REQUIRED";
      throw error;
    }
  }
}

function buildDeterminationsCompletionProfile({ role = "", bcPurchaseType = "" }) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  const isPublic = normalizePurchaseTypeForGate(bcPurchaseType) === "public";
  const reactivoRoles = isPublic ? DETERMINATIONS_REACTIVO_PUBLIC_ROLES : DETERMINATIONS_REACTIVO_PRIVATE_ROLES;
  if (reactivoRoles.has(normalizedRole)) return { phase: "commercial_input", actor: "commercial" };
  if (DETERMINATIONS_TECH_EDIT_ROLES.has(normalizedRole)) return { phase: "technical_review", actor: "technical" };
  return { phase: "unknown", actor: "unknown" };
}

async function applyDeterminationsCompletionTransition({ businessCase, role, user }) {
  const businessCaseId = businessCase?.id;
  if (!businessCaseId) return;
  const profile = buildDeterminationsCompletionProfile({
    role,
    bcPurchaseType: businessCase?.bc_purchase_type,
  });
  const now = new Date();
  const metadata = preflowService.toObject(businessCase?.modern_bc_metadata);
  const currentGate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
    ? { ...metadata.determinations_gate }
    : {};

  if (profile.actor === "commercial") {
    const currentConsumption = await businessCaseService.getConsumptionItems(businessCaseId);
    const filteredItems = (currentConsumption?.items || []).filter((item) => {
      const type = normalizeConsumptionType(item?.type);
      if (!DETERMINATIONS_REACTIVO_TYPES.has(type)) return true;
      const qty = Number(item?.annualQty ?? item?.annualQuantity ?? 0);
      return Number.isFinite(qty) && qty > 0;
    });
    await businessCaseService.saveConsumptionItems(
      businessCaseId,
      filteredItems,
      currentConsumption?.excluded || [],
      { expectedVersion: currentConsumption?.version || null },
    );

    const deadlineAt = new Date(now.getTime() + determinationsGateService.DETERMINATIONS_DEADLINE_HOURS * 60 * 60 * 1000);
    const reviewRole = "jefe_servicio";
    metadata.determinations_gate = {
      ...currentGate,
      phase: "technical_review",
      enabled: true,
      is_expired: false,
      review_role: reviewRole,
      review_started_at: now.toISOString(),
      // review_deadline_at (nested) se quito: nunca se lee, la SLA real de
      // fase review la maneja preflow_review_deadline_at (top-level, ver
      // buildGateInfo/usesTechnicalPreflowSla).
      deadline_at: deadlineAt.toISOString(),
      completed_commercial_at: now.toISOString(),
      completed_commercial_by_role: role,
      completed_commercial_by_email: user?.email || null,
      quantities_locked: false,
      section_locks: {
        ...resolveDeterminationsSectionLocks(currentGate),
        reactivos: true,
      },
      updated_at: now.toISOString(),
    };
    // Patch minimo (solo las claves que esta funcion realmente cambia), no el
    // objeto "metadata" completo -- updateBusinessCase hace merge JSONB a
    // nivel de Postgres, asi que mandar solo lo tocado evita pisar cambios
    // concurrentes en OTRAS claves (ej. una prorroga de SLA aprobada casi al
    // mismo tiempo por jefe_comercial) con una copia desactualizada.
    await businessCaseService.updateBusinessCase(businessCaseId, {
      modern_bc_metadata: {
        determinations_gate: metadata.determinations_gate,
        preflow_phase: "review",
        preflow_status: "reactivos_validated_technical_review_in_progress",
        preflow_review_role: reviewRole,
        preflow_review_started_at: now.toISOString(),
        preflow_review_deadline_at: deadlineAt.toISOString(),
        preflow_deadline_at: deadlineAt.toISOString(),
        preflow_handoff_at: now.toISOString(),
        preflow_handoff_by_email: user?.email || null,
        preflow_handoff_by_role: role,
      },
    });
    return;
  }

  if (profile.actor === "technical") {
    const sectionLocks = resolveDeterminationsSectionLocks(currentGate);
    const allLocked = ["reactivos", "controles", "calibradores", "materiales"].every((key) => sectionLocks[key] === true);
    if (!allLocked) {
      const error = new Error("Para terminar determinaciones primero debes bloquear reactivos, controles, calibradores y materiales.");
      error.status = 409;
      error.code = "DETERMINATIONS_SUBSECTIONS_PENDING_LOCK";
      throw error;
    }
    metadata.determinations_gate = {
      ...currentGate,
      phase: "locked",
      quantities_locked: true,
      section_locks: {
        reactivos: true,
        controles: true,
        calibradores: true,
        materiales: true,
      },
      locked_at: now.toISOString(),
      locked_by_role: role,
      locked_by_email: user?.email || null,
      completed_technical_at: now.toISOString(),
      completed_technical_by_role: role,
      completed_technical_by_email: user?.email || null,
      updated_at: now.toISOString(),
    };
    // Patch minimo, solo determinations_gate (ver comentario equivalente en
    // la rama "commercial" de esta misma funcion).
    await businessCaseService.updateBusinessCase(businessCaseId, {
      modern_bc_metadata: { determinations_gate: metadata.determinations_gate },
    });
    await BusinessCaseDataOwnership.lockSection(
      businessCaseId,
      "determinations",
      user,
      String(businessCase?.canonical_state || businessCase?.bc_stage || "draft").toUpperCase(),
      { source: "determinations_completed_technical" },
    );
    await workflowSlaService.notifyParticipants({
      businessCaseId,
      eventKey: "technical_determinations_completed",
      title: "Determinaciones tecnicas completadas",
      message:
        `Jefe de Servicio completo y valido controles, calibradores y materiales del Business Case. ` +
        "El siguiente paso es revisar los carritos de inversiones y registrar sus valores.",
      actorEmail: user?.email || null,
      excludeActor: true,
    });
  }
}


function resolveInvestmentQuotationItemName(selection = {}) {
  const normalize = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const genericNames = new Set(["", "inversion adicional", "producto", "item", "otros"]);
  const directName = [selection?.name, selection?.catalog_name, selection?.item_name, selection?.label]
    .map((value) => String(value || "").trim())
    .find((value) => !genericNames.has(normalize(value)));
  if (directName) return directName;

  const code = String(selection?.code || selection?.catalog_code || "").trim();
  if (code && !genericNames.has(normalize(code))) {
    return code
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
  }

  const detail = String(selection?.notes || selection?.characteristics || "").trim();
  return detail ? `Inversion adicional: ${detail}` : "Inversion adicional";
}

async function notifyInvestmentQuotationRequested({ businessCaseId, actor, selection, assignee }) {
  if (!assignee?.id || !assignee?.email) {
    return { sent: false, reason: "assignee_missing" };
  }
  const businessCase = await businessCaseService.getBusinessCaseById(businessCaseId);
  const context = await investmentsService.getInvestmentPricingContext(businessCaseId);
  const clientName = businessCase?.client_name || "cliente sin nombre";
  const itemName = resolveInvestmentQuotationItemName(selection);
  const itemCode = selection?.code || selection?.catalog_id || "No registrado";
  const characteristics = String(selection?.characteristics || "").trim() || "No registradas";
  const observations = String(selection?.notes || "").trim() || "Sin observaciones";
  const quantity = selection?.quantity ?? "No especificada";
  const category = selection?.category || "No especificada";
  const targetPath = `/dashboard/business-case/workspace/${businessCaseId}`;
  const primaryEquipment = context.primary_equipment_names?.length
    ? context.primary_equipment_names.join(", ")
    : "No registrado";
  const backupEquipment = context.backup_equipment_names?.length
    ? context.backup_equipment_names.join(", ")
    : "No registrado";

  try {
    await notificationManager.sendNotification({
      userId: assignee.id,
      template: "custom_html",
      customTitle: `Se requieren cotizaciones: ${itemName}`,
      customMessage:
        `Es necesaria la cotizacion del producto ${itemName} para el Business Case de ${clientName}. ` +
        `Codigo: ${itemCode}. Categoria: ${category}. Cantidad requerida: ${quantity}. ` +
        `Caracteristicas: ${characteristics}. Observaciones: ${observations}. ` +
        "Debes gestionar tres cotizaciones de proveedores diferentes o una cotizacion de un proveedor validado. " +
        "Las cotizaciones recopiladas deben ser enviadas a Jefe Financiero; esta persona sera la responsable de registrar los valores en el sistema. " +
        "No registres precios en el Business Case.",
      data: {
        business_case_id: businessCaseId,
        target_path: targetPath,
        cta_label: "Ver detalle de la solicitud",
        email_subject: `Cotizacion asignada - ${itemName}`,
        client_name: clientName,
        item_name: itemName,
        item_code: itemCode,
        item_characteristics: characteristics,
        item_observations: observations,
        item_category: category,
        item_quantity: quantity,
        deadline_months: context.deadline_months,
        projected_deadline_months: context.projected_deadline_months,
        primary_equipment_names: context.primary_equipment_names || [],
        backup_equipment_names: context.backup_equipment_names || [],
      },
      type: "alert",
      priority: 2,
      email: true,
      chat: false,
      source: "business_case.investment_quotation_requested",
      meta: {
        businessCaseId,
        process_key: `business_case:${businessCaseId}`,
        actor,
        itemName,
        itemCode,
        characteristics,
        observations,
        category,
        quantity,
        deadlineMonths: context.deadline_months,
        projectedDeadlineMonths: context.projected_deadline_months,
        primaryEquipment,
        backupEquipment,
        target_path: targetPath,
      },
    });
    return { sent: true };
  } catch (error) {
    logger.warn(
      { error: error?.message || String(error), businessCaseId, catalogId: selection?.catalog_id, assigneeId: assignee.id },
      "No se pudo enviar la notificacion de cotizacion asignada",
    );
    return { sent: false, reason: "notification_error" };
  }
}

async function startDeterminationsTechWindowIfNeeded({ businessCase, role, actorUser }) {
  const normalizedRole = String(role || "").toLowerCase();
  const purchaseCategory = normalizePurchaseTypeForGate(businessCase?.bc_purchase_type);
  const isPublic = purchaseCategory === "public";
  // Public: comercial triggers the window by uploading the statistical document.
  // Private: backoffice_comercial/backoffice trigger it.
  const privateTriggerRoles = new Set(["backoffice_comercial", "backoffice"]);
  if ((isPublic && normalizedRole !== "comercial") || (!isPublic && !privateTriggerRoles.has(normalizedRole))) {
    return null;
  }

  const metadata = businessCase?.modern_bc_metadata && typeof businessCase.modern_bc_metadata === "object"
    ? { ...businessCase.modern_bc_metadata }
    : {};
  const currentGate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
    ? { ...metadata.determinations_gate }
    : {};

  const now = new Date();
  const deadline = new Date(now.getTime() + determinationsGateService.DETERMINATIONS_DEADLINE_HOURS * 60 * 60 * 1000);
  metadata.determinations_gate = {
    ...currentGate,
    enabled: true,
    enabled_at: now.toISOString(),
    deadline_at: deadline.toISOString(),
    is_expired: false,
    expired_at: null,
    expired_notified_at: null,
  };

  // Patch minimo, solo determinations_gate (ver comentario en
  // applyDeterminationsCompletionTransition).
  await businessCaseService.updateBusinessCase(businessCase.id, {
    modern_bc_metadata: { determinations_gate: metadata.determinations_gate },
  });
  await notifyDeterminationsTechWindowStarted({
    businessCaseId: businessCase.id,
    actor: actorUser?.email || "system",
  });
  return { enabledAt: now.toISOString(), deadlineAt: deadline.toISOString() };
}

async function notifySectionLocked({ businessCaseId, section, actor }) {
  const recipients = await getUsersByRoles(["acp_comercial", "backoffice_comercial", "jefe_comercial"]);
  const bc = await businessCaseService.getBusinessCaseById(businessCaseId).catch(() => null);
  const clientName = bc?.client_name || "Cliente pendiente";
  await Promise.all(
    recipients.map((user) =>
      notificationManager.sendNotification({
        userId: user.id,
        template: "bc_section_locked",
        data: { business_case_id: businessCaseId, section_name: section, client_name: clientName },
        email: true,
        chat: false,
        source: "business_case.section_locked",
        meta: {
          businessCaseId,
          section,
          actor,
          process_key: buildBusinessCaseProcessKey(businessCaseId),
        }
      }).catch(() => null)
    )
  );
}

async function notifyPhase1Completed({ businessCaseId, actor }) {
  const recipients = await getUsersByRoles(["acp_comercial", "backoffice_comercial", "jefe_comercial"]);
  const bc = await businessCaseService.getBusinessCaseById(businessCaseId).catch(() => null);
  const clientName = bc?.client_name || "Cliente pendiente";
  await Promise.all(
    recipients.map((user) =>
      notificationManager.sendNotification({
        userId: user.id,
        template: "bc_phase1_completed",
        data: { business_case_id: businessCaseId, client_name: clientName },
        email: true,
        chat: false,
        source: "business_case.phase1_completed",
        meta: {
          businessCaseId,
          actor,
          process_key: buildBusinessCaseProcessKey(businessCaseId),
        }
      }).catch(() => null)
    )
  );
}

async function notifyDeterminationsGateEnabled({
  businessCase,
  gate,
  actor,
}) {
  const recipients = await getUsersByRoles(gate?.notificationsTargetRoles || []);
  if (!recipients.length) return;
  const deadlineText = gate?.deadlineAt
    ? new Date(gate.deadlineAt).toLocaleString("es-EC", {
      timeZone: process.env.APP_TIMEZONE || "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    : "sin fecha";

  await Promise.all(
    recipients.map((targetUser) =>
      notificationManager.sendNotification({
        userId: targetUser.id,
        template: "custom_html",
        customTitle: "Documento estadistico cargado para determinaciones",
        customMessage:
          `El comercial subio el documento estadistico del BC ${businessCase?.id || businessCase?.business_case_id}. ` +
          `Debes completar determinaciones antes de ${deadlineText}.`,
        type: "alert",
        priority: 2,
        source: "business_case.determinations_gate_enabled",
        email: true,
        chat: false,
        meta: {
          businessCaseId: businessCase?.id || businessCase?.business_case_id,
          bc_purchase_type: businessCase?.bc_purchase_type || null,
          determinations_deadline_at: gate?.deadlineAt || null,
          notified_role: targetUser.role || null,
          actor: actor || null,
          process_key: buildBusinessCaseProcessKey(businessCase?.id || businessCase?.business_case_id),
        },
      }).catch(() => null),
    ),
  );
}

function buildOwnershipCompletionRules(ownershipInfo = {}) {
  const getSection = (key) => ownershipInfo?.[key] || {};
  return {
    general: { isCompleted: Boolean(getSection("general")?.completedAt) },
    lab: { isCompleted: Boolean(getSection("laboratory_environment")?.completedAt || getSection("lab")?.completedAt) },
    requirement: { isCompleted: Boolean(getSection("requirement")?.completedAt) },
    equipment: { isCompleted: Boolean(getSection("equipment")?.completedAt) },
    lis: { isCompleted: Boolean(getSection("lis")?.completedAt) },
  };
}

async function buildSectionReadinessForDeterminationsUpload(businessCaseId, businessCase) {
  const labEnvironment = await bcLabEnvironmentService.getLabEnvironment(businessCaseId);
  const lisIntegration = await bcLisIntegrationService.getLisIntegration(businessCaseId);
  const requirementData = await bcRequirementsService.getRequirements(businessCaseId);
  const deliveryData = await bcDeliveriesService.getDeliveries(businessCaseId);

  const extraEquipment = Array.isArray(businessCase?.extra?.equipment_details)
    ? businessCase.extra.equipment_details
    : [];
  const equipmentPairs = extraEquipment;

  const hasLabData =
    labEnvironment &&
    Object.entries(labEnvironment).some(([key, value]) => {
      if (["id", "business_case_id", "created_at", "updated_at"].includes(key)) return false;
      return hasValue(value);
    });

  const hasEquipmentData = Array.isArray(equipmentPairs) && equipmentPairs.length > 0;
  const equipmentComplete = hasEquipmentData && equipmentPairs.every((pair) => {
    if (!pair?.primary_id) return false;
    if (pair?.requires_backup) return Boolean(pair?.backup_id);
    return true;
  });

  const hasLisData =
    lisIntegration &&
    Object.entries(lisIntegration).some(([key, value]) => {
      if (["id", "business_case_id", "created_at", "updated_at"].includes(key)) return false;
      return hasValue(value);
    });

  // El proveedor LIS no es obligatorio para considerar la seccion completa
  // (confirmado con el negocio) -- basta con que comercial haya decidido
  // explicitamente si el BC incluye LIS o no.
  const lisComplete =
    lisIntegration &&
    lisIntegration.includes_lis !== null &&
    lisIntegration.includes_lis !== undefined;

  const hasRequirementData =
    requirementData &&
    (hasValue(requirementData.deadline_months) ||
      hasValue(requirementData.projected_deadline_months) ||
      hasValue(requirementData.observations));

  const hasDeliveryData =
    deliveryData &&
    (hasValue(deliveryData.delivery_type) || typeof deliveryData.effective_determination === "boolean");

  const requirementReady = hasRequirementData || hasDeliveryData;

  const {
    isPublic,
    smartObjective,
    contractingEntity,
    provinceCity,
    clientType,
  } = resolveBusinessCaseGeneralMetadata(businessCase);
  const generalReady =
    hasValue(businessCase?.client_name) &&
    hasValue(businessCase?.contract_object) &&
    hasValue(clientType) &&
    hasValue(provinceCity) &&
    hasValue(smartObjective) &&
    (!isPublic || (hasValue(businessCase?.process_code) && hasValue(contractingEntity)));

  return {
    general: Boolean(generalReady),
    lab: Boolean(hasLabData),
    equipment: Boolean(equipmentComplete),
    lis: Boolean(lisComplete || hasLisData),
    requirement: Boolean(requirementReady),
  };
}

const DETERMINATIONS_UPLOAD_REQUIRED_SECTIONS = ["general", "lab", "requirement", "equipment", "lis"];
const DETERMINATIONS_UPLOAD_SECTION_LABELS = {
  general: "Datos generales",
  lab: "Datos comerciales",
  requirement: "Requerimientos",
  equipment: "Equipos",
  lis: "LIS",
};

async function buildDeterminationsUploadReadiness({ businessCaseId, businessCase, role }) {
  const readiness = await buildSectionReadinessForDeterminationsUpload(businessCaseId, businessCase);
  const missingSectionKeys = DETERMINATIONS_UPLOAD_REQUIRED_SECTIONS.filter((sectionKey) => !readiness?.[sectionKey]);
  const roleAllowed = determinationsGateService.isUploadRole(role);

  let message = null;
  if (!roleAllowed) {
    message = "Solo el usuario comercial responsable puede subir el documento estadistico.";
  } else if (missingSectionKeys.length) {
    message = `Debes completar las secciones previas hasta LIS antes de subir el documento estadistico. Pendientes: ${missingSectionKeys.join(", ")}.`;
  }

  return {
    canUpload: roleAllowed && missingSectionKeys.length === 0,
    roleAllowed,
    preflowExpired: false,
    missingSectionKeys,
    missingSections: missingSectionKeys.map((key) => ({
      key,
      label: DETERMINATIONS_UPLOAD_SECTION_LABELS[key] || key,
    })),
    readiness,
    message,
  };
}

async function notifyBusinessCaseFirstProcessEmail({ businessCaseId, actorUser }) {
  const businessCase = await businessCaseService.getBusinessCaseById(businessCaseId);
  const metadata = preflowService.toObject(businessCase?.modern_bc_metadata);
  if (metadata?.preflow_first_email_sent_at) {
    return { skipped: true, reason: "already_sent" };
  }

  const mailingList = await resolveBusinessCaseMailingList({ businessCase });
  if (!mailingList.primaryTo) {
    return { skipped: true, reason: "missing_recipients" };
  }

  const subject = buildBusinessCaseProcessSubject(businessCase);
  const flowLabel = normalizeBusinessCaseFlowLabel(businessCase?.bc_purchase_type);
  const clientName = resolveBusinessCaseClientDisplayName(businessCase);
  const processCode = String(businessCase?.process_code || "").trim() || "No aplica";

  await notificationManager.sendNotification({
    userId: mailingList.creatorUserId || mailingList.recipients?.[0]?.id,
    template: "custom_html",
    customTitle: subject,
    customMessage:
      `${flowLabel} activado para ${clientName}. ` +
      `El usuario comercial completo Datos Generales y se inicia la trazabilidad del proceso. ` +
      `Codigo de proceso: ${processCode}.`,
    type: "alert",
    priority: 2,
    source: "business_case.process.first_email",
    email: true,
    chat: false,
    data: {
      email_to: mailingList.primaryTo,
      email_cc: mailingList.ccEmails,
      email_subject: subject,
    },
    meta: {
      businessCaseId,
      process_key: buildBusinessCaseProcessKey(businessCaseId),
      flow_label: flowLabel,
      client_name: clientName,
      process_code: String(businessCase?.process_code || "").trim() || null,
      email_to: mailingList.primaryTo,
      email_cc: mailingList.ccEmails,
      triggered_by: actorUser?.email || null,
    },
  });

  await businessCaseService.updateBusinessCase(businessCaseId, {
    modern_bc_metadata: {
      ...metadata,
      preflow_first_email_sent_at: new Date().toISOString(),
      preflow_first_email_sent_by: actorUser?.email || null,
      preflow_first_email_subject: subject,
    },
  });

  return { sent: true, subject };
}

// "lab" y "requirement" son los nombres de seccion usados por los handlers
// (saveLabEnvironment/saveRequirements/saveDeliveries) pero no existen como
// claves en SECTIONS de businessCasePermissions.js -- sin este alias,
// canEdit() siempre devuelve false para cualquier rol (bug real: nadie podia
// guardar Lab Environment ni Requirements/Deliveries). "lab" es el nombre
// corto de "lab_environment"; "requirement" comparte exactamente el mismo
// bucket de permiso que "general" (verificado: en roleSectionConfig.js del
// frontend, "requirement" aparece en canEdit siempre junto con "general",
// nunca uno sin el otro, para los 9 roles comparados).
// No confundir con SECTION_ALIASES (linea 139): ese mapea a claves de
// BusinessCaseDataOwnership (bloqueo/lock), un namespace distinto.
const PERMISSION_SECTION_ALIASES = {
  lab: "lab_environment",
  requirement: "general",
};

async function assertSectionEditable(businessCaseId, section, user) {
  if (section === "investments") return;
  const lockMap = await BusinessCaseDataOwnership.getLockStatus(businessCaseId);
  const lockInfo = lockMap?.[section];
  if (lockInfo?.isLocked) {
    const error = new Error("Seccion bloqueada para edicion");
    error.status = 409;
    throw error;
  }

  // Determinations tiene un gate propio basado en documento estadistico,
  // fase y subseccion. Los handlers de consumo validan ese gate justo despues.
  if (section === "determinations") return;

  const currentState = await BusinessCaseStateMachine.getCurrentState(businessCaseId);
  const canEdit = BusinessCasePermissions.canEdit({
    role: user?.role,
    canonicalState: currentState,
    section: PERMISSION_SECTION_ALIASES[section] || section
  });
  if (!canEdit) {
    const error = new Error("No tienes permisos para editar esta seccion en el estado actual del caso de negocio");
    error.status = 403;
    throw error;
  }
}



async function list(req, res) {
  try {
    logConsumptionDebug({ versionTag: 'TOISO_V1', ts: new Date().toISOString() }, '[WORKSPACE_DEBUG] business-case list handler hit');

    const { page, pageSize, status, client_name, q } = req.query;
    const result = await businessCaseService.listBusinessCases({ page, pageSize, status, client_name, q });

    // Log sample data transformation
    if (result.items && result.items.length > 0) {
      logConsumptionDebug({
        raw: result.items[0].created_at,
        rawType: typeof result.items[0].created_at,
        mapped: result.items[0].created_at,
        mappedType: typeof result.items[0].created_at
      }, '[WORKSPACE_DEBUG] sample created_at before/after');
    }

    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error(error);
    res.status(error.status || 500).json({ ok: false, message: error.message || "Error listando Business Cases" });
  }
}

async function create(req, res) {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const bc = await businessCaseService.createBusinessCase(value, req.user);
    res.status(201).json({ ok: true, data: bc });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error creando Business Case" });
  }
}

async function getById(req, res) {
  try {
    const bc = await businessCaseService.getBusinessCaseById(req.params.id);
    res.json({ ok: true, data: bc });
  } catch (error) {
    logger.error(error);
    res.status(error.status || 500).json({ ok: false, message: error.message || "No se pudo obtener el Business Case" });
  }
}

async function update(req, res) {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    await assertSectionEditable(req.params.id, "general", req.user);

    const currentState = await BusinessCaseStateMachine.getCurrentState(req.params.id);
    const permissionValidation = BusinessCasePermissions.validateUpdatePayload({
      role: req.user?.role,
      canonicalState: currentState,
      updateData: value
    });

    if (permissionValidation.hasForbiddenFields) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para editar los siguientes campos en el estado actual",
        forbiddenFields: Object.keys(permissionValidation.forbidden)
      });
    }

    const bc = await businessCaseService.updateBusinessCase(req.params.id, value);

    // El rol comercial guarda una sola vez: la seccion "general" queda en
    // solo lectura de inmediato (sin paso de confirmacion aparte). Roles
    // superiores (acp_comercial/jefe_comercial/backoffice) pueden reabrirla
    // con el endpoint generico /sections/general/unlock que ya existe --
    // por eso este auto-lock solo aplica cuando quien guarda es "comercial"
    // (rol base), nunca cuando un rol superior edita la seccion.
    if (String(req.user?.role || "").toLowerCase() === "comercial") {
      await BusinessCaseDataOwnership.lockSection(req.params.id, "general", req.user, currentState, {
        source: "auto_lock_after_comercial_save",
      });
    }

    const shouldNotifyFirstProcessByGeneralSave =
      shouldStartQueueOnGeneralSave(bc) &&
      hasGeneralSavePayload(value) &&
      isCommercialSectionActor(req);
    if (shouldNotifyFirstProcessByGeneralSave) {
      try {
        await notifyBusinessCaseFirstProcessEmail({
          businessCaseId: req.params.id,
          actorUser: req.user,
        });
      } catch (mailError) {
        logger.warn(
          { error: mailError.message, businessCaseId: req.params.id },
          "No se pudo iniciar notificacion de proceso al guardar datos generales",
        );
      }
    }

    const refreshed = await businessCaseService.getBusinessCaseById(req.params.id);
    res.json({ ok: true, data: refreshed });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error actualizando Business Case" });
  }
}

async function remove(req, res) {
  try {
    await businessCaseService.deleteBusinessCase(req.params.id);
    res.status(204).send();
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error eliminando Business Case" });
  }
}

async function selectEquipment(req, res) {
  try {
    const { error, value } = equipmentSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    await assertSectionEditable(req.params.id, "equipment", req.user);

    const selection = await equipmentSelectionService.selectEquipment(
      req.params.id,
      value.equipmentId,
      value.isPrimary,
      req.user,
    );
    res.status(201).json({ ok: true, data: selection });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error seleccionando equipo" });
  }
}

async function addDetermination(req, res) {
  try {
    const bc = await businessCaseService.getBusinessCaseById(req.params.id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: bc,
      role: resolveRequestRole(req),
      currentDocument: await determinationsGateService.getCurrentDocument(req.params.id),
    });
    determinationsGateService.assertCanEditDeterminationsOrThrow(gate);

    const { error, value } = determinationSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const monthlyQty = value.monthlyQty ?? value.monthlyQuantity;
    const annualQty = value.annualQty ?? value.annualQuantity;

    const determination = await determinationsService.addDetermination(
      req.params.id,
      value.determinationId,
      { monthlyQty, annualQty },
      req.user,
    );
    res.status(201).json({ ok: true, data: determination, warnings: res.locals.warnings || [] });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error agregando determinación" });
  }
}

async function updateDetermination(req, res) {
  try {
    const bc = await businessCaseService.getBusinessCaseById(req.params.id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: bc,
      role: resolveRequestRole(req),
      currentDocument: await determinationsGateService.getCurrentDocument(req.params.id),
    });
    determinationsGateService.assertCanEditDeterminationsOrThrow(gate);

    const { error, value } = Joi.object({
      monthlyQty: Joi.number().integer().positive(),
      annualQty: Joi.number().integer().positive(),
      monthlyQuantity: Joi.number().integer().positive(),
      annualQuantity: Joi.number().integer().positive(),
    }).or("monthlyQty", "annualQty", "monthlyQuantity", "annualQuantity").validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const monthlyQty = value.monthlyQty ?? value.monthlyQuantity;
    const annualQty = value.annualQty ?? value.annualQuantity;

    const determination = await determinationsService.updateDeterminationQuantity(
      req.params.id,
      req.params.detId,
      { monthlyQty, annualQty },
    );
    res.json({ ok: true, data: determination, warnings: res.locals.warnings || [] });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error actualizando determinación" });
  }
}

async function removeDetermination(req, res) {
  try {
    const bc = await businessCaseService.getBusinessCaseById(req.params.id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: bc,
      role: resolveRequestRole(req),
      currentDocument: await determinationsGateService.getCurrentDocument(req.params.id),
    });
    determinationsGateService.assertCanEditDeterminationsOrThrow(gate);
    await determinationsService.removeDetermination(req.params.id, req.params.detId);
    res.status(204).send();
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error eliminando determinación" });
  }
}

async function getDeterminations(req, res) {
  try {
    const dets = await determinationsService.getDeterminations(req.params.id);
    res.json({ ok: true, data: dets });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error obteniendo determinaciones" });
  }
}

async function getCalculations(req, res) {
  try {
    const calculations = await businessCaseService.getCalculations(req.params.id);
    res.json({ ok: true, data: calculations });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error obteniendo cálculos" });
  }
}

async function recalculate(req, res) {
  try {
    const calculations = await businessCaseService.recalculateBusinessCase(req.params.id);
    res.json({ ok: true, data: calculations });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error recalculando Business Case" });
  }
}

async function exportPdf(req, res) {
  try {
    const buffer = await pdfGenerator.generateBusinessCasePdf(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=business-case-${req.params.id}.pdf`);
    res.send(buffer);
  } catch (err) {
    logger.error(err);
    res
      .status(err.status || 500)
      .json({ ok: false, message: err.message || "No se pudo generar el PDF del Business Case" });
  }
}

async function exportExcel(req, res) {
  try {
    const buffer = await excelExporter.generateBusinessCaseExcel(req.params.id);
    await businessCaseService.recordExcelExportAndMarkWaitingCalculations(req.params.id, req.user);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename=business-case-${req.params.id}.xlsx`);
    res.send(buffer);
  } catch (err) {
    logger.error(err);
    res
      .status(err.status || 500)
      .json({ ok: false, message: err.message || "No se pudo generar el Excel del Business Case" });
  }
}

// No factible: solo avisa a jefe_comercial/acp_comercial y a quien creo el
// BC -- a nadie mas del resto de PARTICIPANT_ROLES (jefe_servicio,
// jefe_operaciones, jefe_financiero, jefe_ti, contador quedan fuera).
async function notifyNonFeasibleDecision({ businessCaseId, bc, reason, actorEmail }) {
  try {
    const { rows } = await db.query(
      `SELECT id, email FROM users WHERE active = true AND lower(role) = ANY($1::text[])`,
      [["jefe_comercial", "jefe_de_comercial", "acp_comercial"]],
    );
    const normalizedActor = String(actorEmail || "").trim().toLowerCase();
    const recipientIds = new Set(
      rows
        .filter((row) => String(row.email || "").trim().toLowerCase() !== normalizedActor)
        .map((row) => row.id),
    );
    if (bc?.created_by && String(bc?.created_by_email || "").trim().toLowerCase() !== normalizedActor) {
      recipientIds.add(bc.created_by);
    }

    const clientName = bc?.client_name || `BC ${businessCaseId}`;
    const message = `El Business Case ${clientName} (#${businessCaseId}) ha sido resuelto como no factible.${
      reason ? ` Motivo: ${reason}` : ""
    }`;

    await Promise.all(Array.from(recipientIds).map((userId) => notificationManager.sendNotification({
      userId,
      customTitle: "Business Case resuelto: no factible",
      customMessage: message,
      type: "alert",
      source: "business_case.feasibility.rejected",
      priority: 2,
      email: true,
      chat: false,
      data: { email_subject: `Business Case ${clientName} - Resuelto no factible` },
      meta: { businessCaseId, reason: reason || null },
    })));
  } catch (err) {
    logger.warn({ businessCaseId, err: err.message }, "No se pudo notificar decision de no factibilidad");
  }
}

async function submitFeasibilityDecision(req, res) {
  try {
    const { error, value } = feasibilityDecisionSchema.validate(req.body || {}, { abortEarly: false });
    if (error) {
      return res.status(400).json({ ok: false, message: error.details.map((d) => d.message).join(", ") });
    }

    const updated = await businessCaseService.saveFeasibilityDecision(req.params.id, value, req.user);
    await workflowSlaService.markCompleted({
      businessCaseId: req.params.id,
      actorEmail: req.user?.email || null,
    });
    if (value.is_feasible) {
      await workflowSlaService.notifyParticipants({
        businessCaseId: req.params.id,
        eventKey: "feasibility_completed",
        title: "Factibilidad registrada: Business Case completado",
        message: "La factibilidad fue registrada como factible. El Business Case completo el flujo de evaluacion.",
        actorEmail: req.user?.email || null,
        excludeActor: true,
        extraData: { is_feasible: true },
      });
    } else {
      await notifyNonFeasibleDecision({
        businessCaseId: req.params.id,
        bc: updated,
        reason: value.notes,
        actorEmail: req.user?.email || null,
      });
    }
    res.json({ ok: true, data: updated });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({
      ok: false,
      message: err.message || "No se pudo registrar la decision de factibilidad",
    });
  }
}

async function updateEconomicData(req, res) {
  try {
    const schema = Joi.object({
      equipment_id: Joi.number().integer().required(),
      equipment_name: Joi.string().trim().required(),
      equipment_cost: Joi.number().min(0).required(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.message });
    }

    const currentState = await BusinessCaseStateMachine.getCurrentState(req.params.id);
    const permissionValidation = BusinessCasePermissions.validateUpdatePayload({
      role: req.user?.role,
      canonicalState: currentState,
      updateData: value
    });

    if (permissionValidation.hasForbiddenFields) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para editar los siguientes campos en el estado actual",
        forbiddenFields: Object.keys(permissionValidation.forbidden)
      });
    }

    const bc = await businessCaseService.updateEconomicData(req.params.id, value);
    res.json({ ok: true, data: bc });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error actualizando datos económicos" });
  }
}

// ===== INVESTMENT ENDPOINTS =====

async function addInvestment(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);

    const investment = await investmentsService.addInvestment(id, req.body);
    res.json({ ok: true, data: investment });
  } catch (error) {
    logger.error({ error: error.message }, "Error adding investment");
    res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
}

async function getInvestments(req, res) {
  try {
    const { id } = req.params;
    const investments = await investmentsService.getInvestments(id);
    res.json({ ok: true, data: investments });
  } catch (error) {
    logger.error({ error: error.message }, "Error getting investments");
    res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
}

async function updateInvestment(req, res) {
  try {
    const { invId } = req.params;
    const investment = await investmentsService.updateInvestment(invId, req.body);
    res.json({ ok: true, data: investment });
  } catch (error) {
    logger.error({ error: error.message }, "Error updating investment");
    res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
}

async function deleteInvestment(req, res) {
  try {
    const { invId } = req.params;
    await investmentsService.deleteInvestment(invId);
    res.json({ ok: true, message: "Investment deleted" });
  } catch (error) {
    logger.error({ error: error.message }, "Error deleting investment");
    res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
}

// ===== MANUAL BC FORM ENDPOINTS =====

// Lab Environment
async function saveLabEnvironment(req, res) {
  let idempotencySession = null;
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    await assertSectionEditable(id, "lab", req.user);
    const payload = req.body || {};
    idempotencySession = await startIdempotentWrite({
      req,
      operationScope: "bc.lab.save",
      businessCaseId: id,
      payload,
    });
    if (idempotencySession.replay) {
      applyResponseHeadersFromBody(res, idempotencySession.replayPayload);
      return res.status(idempotencySession.replayStatus).json(idempotencySession.replayPayload);
    }

    const result = await bcLabEnvironmentService.createLabEnvironment(id, payload);
    if ((req.user?.role || "").toLowerCase() === "comercial") {
      await notifySectionReview({ businessCaseId: id, section: "lab", actor: req.user?.email || "system" });
      // Mismo auto-bloqueo que "general"/"equipment": comercial guarda una
      // sola vez y la seccion queda en solo lectura de inmediato. Roles
      // superiores pueden reabrirla con /sections/lab/unlock.
      const currentState = await BusinessCaseStateMachine.getCurrentState(id);
      await BusinessCaseDataOwnership.lockSection(id, "lab", req.user, currentState, {
        source: "auto_lock_after_comercial_save",
      });
    }
    const responseBody = { success: true, data: result };
    await completeIdempotentWrite(idempotencySession, responseBody, 200);
    res.json(responseBody);
  } catch (error) {
    await failIdempotentWrite(idempotencySession, error);
    logger.error({ error: error.message }, 'Error saving lab environment');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function getLabEnvironment(req, res) {
  try {
    const { id } = req.params;
    const result = await bcLabEnvironmentService.getLabEnvironment(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting lab environment');
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getInvestmentCatalog(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const rows = await investmentsService.getCatalogWithSelections(id);
    res.json({ ok: true, data: { items: rows } });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting investment catalog');
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function saveInvestmentSelection(req, res) {
  let idempotencySession = null;
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const bc = await businessCaseService.getBusinessCaseById(id);
    const role = resolveRequestRole(req);
    await assertInvestmentsEditable(bc, role);
    const canEditPrice = ["jefe_operaciones", "jefe_de_operaciones"].includes(role);
    const isBatch = Array.isArray(req.body?.selections);
    const payload = isBatch
      ? {
          selections: req.body.selections.map((item) => {
            const normalized = { ...(item || {}) };
            if (!canEditPrice) delete normalized.unit_price;
            return normalized;
          }),
        }
      : { ...req.body };
    if (!canEditPrice && !isBatch) {
      delete payload.unit_price;
    }

    idempotencySession = await startIdempotentWrite({
      req,
      operationScope: "bc.investment.selection.save",
      businessCaseId: id,
      payload,
    });
    if (idempotencySession.replay) {
      applyResponseHeadersFromBody(res, idempotencySession.replayPayload);
      return res.status(idempotencySession.replayStatus).json(idempotencySession.replayPayload);
    }

    if (isBatch && !payload.selections.length) {
      const error = new Error("selections no puede estar vacio");
      error.status = 400;
      throw error;
    }

    const selection = isBatch
      ? await investmentsService.upsertInvestmentSelectionsBatch(id, payload.selections, req.user)
      : await investmentsService.upsertInvestmentSelection(id, payload, req.user);
    const responseBody = isBatch
      ? { ok: true, data: { items: selection, saved_count: selection.length } }
      : { ok: true, data: selection };
    await completeIdempotentWrite(idempotencySession, responseBody, 200);
    res.json(responseBody);

    // Fire-and-forget: detect changes → stamp deadline → notify value managers
    // El SLA de valores inicia solo cuando se confirma el carrito.
  } catch (error) {
    await failIdempotentWrite(idempotencySession, error);
    logger.error({ error: error.message }, 'Error saving investment selection');
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function closeInvestmentsWithoutAdditionalItems(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const bc = await businessCaseService.getBusinessCaseById(id);
    if (!bc) return res.status(404).json({ ok: false, message: "Business Case no encontrado." });

    const role = resolveRequestRole(req);
    const allowedRoles = new Set([
      ...INVESTMENT_EDIT_ROLES,
      ...INVESTMENT_VALUES_OP_ROLES,
      ...INVESTMENT_VALUES_FIN_ROLES,
      "gerencia",
      "gerencia_general",
    ]);
    if (!allowedRoles.has(role)) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para cerrar inversiones sin items adicionales.",
        code: "INVESTMENT_EMPTY_CLOSE_ROLE_REQUIRED",
      });
    }

    const selected = await investmentsService.getInvestmentSelections(id);
    const selectedItems = Array.isArray(selected) ? selected.filter((item) => item.selected !== false) : [];
    if (selectedItems.length > 0) {
      return res.status(409).json({
        ok: false,
        message: "Este Business Case ya tiene inversiones adicionales seleccionadas. Debes gestionar sus precios antes de cerrar.",
        code: "INVESTMENT_EMPTY_CLOSE_HAS_SELECTED_ITEMS",
        selected_count: selectedItems.length,
      });
    }

    const currentState = String(bc?.canonical_state || bc?.bc_stage || "draft").toUpperCase();
    const actorId = req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? req.user?.uuid ?? null;
    const nowIso = new Date().toISOString();
    const sections = ["investments", "investment_values_op", "investment_values_fin"];
    for (const section of sections) {
      await BusinessCaseDataOwnership.recordSectionCompletion(
        id,
        section,
        actorId,
        role,
        currentState,
        {
          source: "close_without_additional_investments",
          actor_email: req.user?.email || null,
          actor_id_raw: actorId,
          completion_basis: "no_additional_investments_selected",
          closed_without_investments_at: nowIso,
        },
      );
    }

    const existingInvestmentsMetadata = preflowService.toObject(bc?.modern_bc_metadata)?.investments || {};
    await preflowService.updateBusinessCaseMetadata(id, {
      investments: {
        ...existingInvestmentsMetadata,
        no_additional_investments: true,
        closed_without_investments_at: nowIso,
        closed_without_investments_by_email: req.user?.email || null,
        closed_without_investments_by_role: role,
        prices_closed_without_investments: true,
      },
    });

    try {
      await workflowSlaService.notifyParticipants({
        businessCaseId: id,
        eventKey: "investments_closed_without_items",
        title: "Inversiones cerradas sin adicionales: revisar factibilidad",
        message:
          "El Business Case fue cerrado sin inversiones adicionales. Precios financieros y operativos quedaron cerrados automaticamente porque no aplican.",
        actorEmail: req.user?.email || null,
        excludeActor: true,
      });
    } catch (notificationError) {
      logger.warn(
        { error: notificationError?.message || String(notificationError), businessCaseId: id },
        "No se pudo notificar cierre de inversiones sin adicionales",
      );
    }

    res.json({
      ok: true,
      data: {
        closed: true,
        sections,
        selected_count: 0,
        closed_without_investments_at: nowIso,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, "Error closing investments without additional items");
    res.status(error.status || 500).json({ ok: false, message: error.message, code: error.code || null });
  }
}

async function createInvestmentCatalogItem(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const bc = await businessCaseService.getBusinessCaseById(id);
    await assertInvestmentsEditable(bc, resolveRequestRole(req));
    const catalog = await investmentsService.createInvestmentCatalogItem(req.body);
    let selection = null;
    if (req.body?.selected !== false) {
      const role = (req.user?.role || req.user?.scope || req.user?.role_name || "").toLowerCase();
      const canEditPrice = ["jefe_operaciones", "jefe_de_operaciones"].includes(role);
      selection = await investmentsService.upsertInvestmentSelection(
        id,
        {
          catalog_id: catalog.id,
          selected: true,
          notes: req.body?.notes || null,
          quantity: req.body?.quantity ?? null,
          characteristics: req.body?.characteristics || null,
          unit_price: canEditPrice ? (req.body?.unit_price ?? null) : null
        },
        req.user
      );
    }
    res.json({
      ok: true,
      data: {
        ...catalog,
        selected: selection?.selected ?? false,
        notes: selection?.notes ?? null,
        quantity: selection?.quantity ?? null,
        characteristics: selection?.characteristics ?? null,
        unit_price: selection?.unit_price ?? null,
        updated_by_role: selection?.updated_by_role ?? null,
        updated_by_email: selection?.updated_by_email ?? null
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error creating investment catalog item');
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function getConsumptionItems(req, res) {
  try {
    const { id } = req.params;

    // Auto-sync Sheet -> SPI antes de mostrar la pantalla: reactivos,
    // calibradores y controles se cargan en la hoja oficial, y esa es ahora
    // la fuente de verdad de las cantidades. Se salta en silencio si la
    // subseccion ya esta bloqueada (no pisar un valor finalizado) o si el BC
    // no tiene Sheet generada todavia -- nunca debe romper la carga de pantalla.
    try {
      const lockMap = await BusinessCaseDataOwnership.getLockStatus(id);
      if (!lockMap?.determinations?.isLocked) {
        await businessCaseService.syncConsumptionQuantitiesFromSheet(id);
      }
    } catch (syncError) {
      if (syncError?.code !== "SHEET_NOT_GENERATED") {
        logger.warn(
          { error: syncError.message, businessCaseId: id },
          "No se pudo auto-sincronizar cantidades desde Sheet al cargar consumos",
        );
      }
    }

    const data = await businessCaseService.getConsumptionItems(id);
    const debugItem = (data?.items || []).find((item) => String(item?.itemId || "").trim() === "3321193001");
    logConsumptionDebug(
      {
        businessCaseId: id,
        itemsCount: Array.isArray(data?.items) ? data.items.length : 0,
        excludedCount: Array.isArray(data?.excluded) ? data.excluded.length : 0,
        summary: summarizeConsumptionItems(data?.items || []),
        debugItem: debugItem
          ? {
            key: debugItem.key,
            itemId: debugItem.itemId,
            annualQty: debugItem.annualQty,
            source: debugItem.source,
          }
          : null,
      },
      "[BC_CONSUMPTION][GET]",
    );
    if (data?.version) {
      res.set("ETag", `"${data.version}"`);
    }
    res.json({ ok: true, data });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting consumption items');
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function syncConsumptionFromSheet(req, res) {
  try {
    const { id } = req.params;
    await assertSectionEditable(id, "determinations", req.user);
    const currentBusinessCase = await businessCaseService.getBusinessCaseById(id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: currentBusinessCase,
      role: resolveRequestRole(req),
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    determinationsGateService.assertCanEditDeterminationsOrThrow(gate);

    const result = await businessCaseService.syncConsumptionQuantitiesFromSheet(id);
    res.json({ ok: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error sincronizando cantidades desde Sheet');
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function saveConsumptionItems(req, res) {
  let idempotencySession = null;
  try {
    const { id } = req.params;
    await assertSectionEditable(id, "determinations", req.user);
    const role = resolveRequestRole(req);
    const currentBusinessCase = await businessCaseService.getBusinessCaseById(id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: currentBusinessCase,
      role: resolveRequestRole(req),
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    determinationsGateService.assertCanEditDeterminationsOrThrow(gate);
    const silent = isTruthyFlag(req.query?.silent) || isTruthyFlag(req.body?.silent);
    const expectedVersion = getExpectedVersion(req);
    let items = Array.isArray(req.body?.items) ? req.body.items : [];
    let excluded = Array.isArray(req.body?.excluded) ? req.body.excluded : [];
    const sectionLocks = resolveDeterminationsSectionLocks(gate);
    const hasAnySectionLocked = Object.values(sectionLocks).some(Boolean);
    if (hasAnySectionLocked) {
      const currentConsumption = await businessCaseService.getConsumptionItems(id);
      const currentItems = Array.isArray(currentConsumption?.items) ? currentConsumption.items : [];
      const currentByKey = new Map(currentItems.map((item) => [String(item?.key || ""), item]));
      const incomingUnlocked = [];
      const lockedIncomingKeys = new Set();
      items.forEach((item) => {
        const subsection = subsectionFromConsumptionType(item?.type);
        const key = String(item?.key || "");
        if (sectionLocks[subsection]) {
          if (key) lockedIncomingKeys.add(key);
          return;
        }
        incomingUnlocked.push(item);
      });
      const preservedLocked = currentItems.filter((item) => {
        const subsection = subsectionFromConsumptionType(item?.type);
        return sectionLocks[subsection];
      });
      items = [...incomingUnlocked, ...preservedLocked];
      excluded = excluded.filter((key) => {
        const current = currentByKey.get(String(key || ""));
        if (!current) return true;
        const subsection = subsectionFromConsumptionType(current?.type);
        return !sectionLocks[subsection];
      });
      logConsumptionDebug(
        {
          businessCaseId: id,
          sectionLocks,
          lockedIncomingCount: lockedIncomingKeys.size,
          preservedLockedCount: preservedLocked.length,
        },
        "[BC_CONSUMPTION][SAVE][SECTION_LOCKS_SANITIZE]",
      );
    }
    logger.info(
      {
        businessCaseId: id,
        itemsCount: items.length,
        excludedCount: excluded.length,
        requestSummary: summarizeConsumptionItems(items, 10),
      },
      "[BC_CONSUMPTION][SAVE][TRACE]",
    );
    const policyItems = items.filter((item) => !sectionLocks[subsectionFromConsumptionType(item?.type)]);
    const { hasReactivoFamily, hasTechFamily } = classifyConsumptionItemsByType(policyItems);
    assertConsumptionPhasePolicyOrThrow({
      phase: gate?.phase || "commercial_input",
      role,
      hasReactivoFamily,
      hasTechFamily,
      bcPurchaseType: currentBusinessCase?.bc_purchase_type,
    });
    assertConsumptionRolePolicyOrThrow({ role, hasReactivoFamily, hasTechFamily, bcPurchaseType: currentBusinessCase?.bc_purchase_type });
    const requestDebugItem = items.find((item) => String(item?.itemId || "").trim() === "3321193001");
    logConsumptionDebug(
      {
        businessCaseId: id,
        itemsCount: items.length,
        excludedCount: excluded.length,
        requestSummary: summarizeConsumptionItems(items),
        requestDebugItem: requestDebugItem
          ? {
            key: requestDebugItem.key,
            itemId: requestDebugItem.itemId,
            annualQty: requestDebugItem.annualQty,
            source: requestDebugItem.source,
          }
          : null,
      },
      "[BC_CONSUMPTION][SAVE][REQUEST]",
    );
    idempotencySession = await startIdempotentWrite({
      req,
      operationScope: "bc.consumption.save",
      businessCaseId: id,
      payload: {
        items,
        excluded,
        version: expectedVersion || null,
        silent: Boolean(silent),
      },
    });
    if (idempotencySession.replay) {
      applyResponseHeadersFromBody(res, idempotencySession.replayPayload);
      return res.status(idempotencySession.replayStatus).json(idempotencySession.replayPayload);
    }

    const data = await businessCaseService.saveConsumptionItems(id, items, excluded, { expectedVersion });
    logger.info(
      {
        businessCaseId: id,
        responseItemsCount: Array.isArray(data?.items) ? data.items.length : 0,
        responseExcludedCount: Array.isArray(data?.excluded) ? data.excluded.length : 0,
        responseSummary: summarizeConsumptionItems(data?.items || [], 10),
      },
      "[BC_CONSUMPTION][SAVE][TRACE_RESULT]",
    );
    if (hasReactivoFamily) {
      await startDeterminationsTechWindowIfNeeded({
        businessCase: currentBusinessCase,
        role,
        actorUser: req.user,
      });
    }
    const responseDebugItem = (data?.items || []).find((item) => String(item?.itemId || "").trim() === "3321193001");
    logConsumptionDebug(
      {
        businessCaseId: id,
        itemsCount: Array.isArray(data?.items) ? data.items.length : 0,
        excludedCount: Array.isArray(data?.excluded) ? data.excluded.length : 0,
        responseSummary: summarizeConsumptionItems(data?.items || []),
        responseDebugItem: responseDebugItem
          ? {
            key: responseDebugItem.key,
            itemId: responseDebugItem.itemId,
            annualQty: responseDebugItem.annualQty,
            source: responseDebugItem.source,
          }
          : null,
      },
      "[BC_CONSUMPTION][SAVE][RESPONSE]",
    );
    try {
      await dispatchWorkspaceService.syncDispatchWorkspaceFromConsumption(id);
    } catch (syncError) {
      logger.warn({ error: syncError.message, businessCaseId: id }, "No se pudo sincronizar workspace de despacho");
    }
    const responseBody = { ok: true, data };
    if (data?.version) {
      res.set("ETag", `"${data.version}"`);
    }
    if (!silent && (req.user?.role || "").toLowerCase() === "comercial") {
      await notifySectionReview({ businessCaseId: id, section: "determinations", actor: req.user?.email || "system" });
    }
    await completeIdempotentWrite(idempotencySession, responseBody, 200);
    res.json(responseBody);
  } catch (error) {
    await failIdempotentWrite(idempotencySession, error);
    logger.error({ error: error.message }, 'Error saving consumption items');
    res.status(error.status || 500).json({
      ok: false,
      message: error.message,
      code: error.code || null,
      details: error.details || null,
    });
  }
}

async function patchConsumptionItem(req, res) {
  let idempotencySession = null;
  try {
    const { id, itemKey } = req.params;
    await assertSectionEditable(id, "determinations", req.user);
    const role = resolveRequestRole(req);
    const currentBusinessCase = await businessCaseService.getBusinessCaseById(id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: currentBusinessCase,
      role: resolveRequestRole(req),
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    determinationsGateService.assertCanEditDeterminationsOrThrow(gate);
    const silent = isTruthyFlag(req.query?.silent) || isTruthyFlag(req.body?.silent);
    const expectedVersion = getExpectedVersion(req);
    const annualQty = req.body?.annualQty;
    const row = req.body?.row && typeof req.body.row === "object" ? req.body.row : {};
    const sectionLocks = resolveDeterminationsSectionLocks(gate);
    const rowSubsection = subsectionFromConsumptionType(row?.type);
    if (sectionLocks[rowSubsection]) {
      const lockError = new Error(`La subseccion ${rowSubsection} esta bloqueada.`);
      lockError.status = 409;
      lockError.code = "DETERMINATIONS_SUBSECTION_LOCKED";
      throw lockError;
    }
    const { hasReactivoFamily, hasTechFamily } = classifyConsumptionItemsByType([row]);
    assertConsumptionPhasePolicyOrThrow({
      phase: gate?.phase || "commercial_input",
      role,
      hasReactivoFamily,
      hasTechFamily,
      bcPurchaseType: currentBusinessCase?.bc_purchase_type,
    });
    assertConsumptionRolePolicyOrThrow({ role, hasReactivoFamily, hasTechFamily, bcPurchaseType: currentBusinessCase?.bc_purchase_type });
    const exclude = isTruthyFlag(req.body?.exclude);
    const normalizedItemKey = decodeURIComponent(itemKey);
    logConsumptionDebug(
      {
        businessCaseId: id,
        itemKey: normalizedItemKey,
        annualQty,
        exclude,
        expectedVersion,
        rowPreview: {
          key: row?.key || null,
          itemId: row?.itemId || null,
          type: row?.type || null,
          source: row?.source || null,
          catalogId: row?.catalogId ?? null,
          equipmentId: row?.equipmentId ?? null,
        },
      },
      "[BC_CONSUMPTION][PATCH][REQUEST]",
    );

    idempotencySession = await startIdempotentWrite({
      req,
      operationScope: "bc.consumption.patch",
      businessCaseId: id,
      payload: {
        itemKey: normalizedItemKey,
        annualQty,
        row,
        exclude,
        version: expectedVersion || null,
        silent: Boolean(silent),
      },
    });
    if (idempotencySession.replay) {
      applyResponseHeadersFromBody(res, idempotencySession.replayPayload);
      return res.status(idempotencySession.replayStatus).json(idempotencySession.replayPayload);
    }

    const data = await businessCaseService.patchConsumptionItem(
      id,
      normalizedItemKey,
      { annualQty, row, exclude },
      { expectedVersion },
    );
    const parsedAnnualQty = Number(annualQty);
    if (hasReactivoFamily && Number.isFinite(parsedAnnualQty) && parsedAnnualQty > 0) {
      await startDeterminationsTechWindowIfNeeded({
        businessCase: currentBusinessCase,
        role,
        actorUser: req.user,
      });
    }
    logConsumptionDebug(
      {
        businessCaseId: id,
        itemKey: normalizedItemKey,
        itemsCount: Array.isArray(data?.items) ? data.items.length : 0,
        excludedCount: Array.isArray(data?.excluded) ? data.excluded.length : 0,
        version: data?.version || null,
      },
      "[BC_CONSUMPTION][PATCH][RESPONSE]",
    );
    try {
      await dispatchWorkspaceService.syncDispatchWorkspaceFromConsumption(id);
    } catch (syncError) {
      logger.warn({ error: syncError.message, businessCaseId: id }, "No se pudo sincronizar workspace de despacho");
    }
    const responseBody = { ok: true, data };
    if (data?.version) {
      res.set("ETag", `"${data.version}"`);
    }

    if (!silent && (req.user?.role || "").toLowerCase() === "comercial") {
      await notifySectionReview({ businessCaseId: id, section: "determinations", actor: req.user?.email || "system" });
    }
    await completeIdempotentWrite(idempotencySession, responseBody, 200);
    res.json(responseBody);
  } catch (error) {
    await failIdempotentWrite(idempotencySession, error);
    logger.error({ error: error.message }, "Error patching consumption item");
    res.status(error.status || 500).json({
      ok: false,
      message: error.message,
      code: error.code || null,
      details: error.details || null,
    });
  }
}

async function getDispatchWorkspace(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const data = await dispatchWorkspaceService.getDispatchWorkspace(id);
    res.json({ ok: true, data });
  } catch (error) {
    logger.error({ error: error.message }, "Error getting dispatch workspace");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function saveCommercialDispatchPlan(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const payloadItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const data = await dispatchWorkspaceService.saveCommercialPlan(id, payloadItems, req.user);
    await notifySectionReview({
      businessCaseId: id,
      section: "calculations",
      actor: req.user?.email || "system",
    });
    res.json({ ok: true, data });
  } catch (error) {
    logger.error({ error: error.message }, "Error saving commercial dispatch plan");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function saveOperationsDispatchControl(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const payloadItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const data = await dispatchWorkspaceService.saveOperationsControl(id, payloadItems, req.user);
    res.json({ ok: true, data });
  } catch (error) {
    logger.error({ error: error.message }, "Error saving operations dispatch control");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function ingestFrontendObservabilityEvents(req, res) {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    const accepted = observabilityService.registerFrontendEvents(events, {
      role: req.user?.role || null,
      user: req.user?.email || null,
    });
    res.json({ ok: true, data: { accepted } });
  } catch (error) {
    logger.error({ error: error.message }, "Error ingesting frontend observability events");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function getObservabilityMetrics(req, res) {
  try {
    const snapshot = observabilityService.getSnapshot();
    res.json({ ok: true, data: snapshot });
  } catch (error) {
    logger.error({ error: error.message }, "Error getting observability metrics");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function getObservabilityDashboard(req, res) {
  try {
    const dashboard = observabilityService.getOperationalDashboard();
    res.json({ ok: true, data: dashboard });
  } catch (error) {
    logger.error({ error: error.message }, "Error getting observability dashboard");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function getAutosaveFeatureFlags(req, res) {
  try {
    const requesterRole = resolveRequestRole(req);
    const requestedRole = String(req.query?.role || requesterRole).trim().toLowerCase();

    if (requestedRole !== requesterRole && !AUTOSAVE_FLAG_ADMIN_ROLES.has(requesterRole)) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para consultar feature flags de otro rol",
      });
    }

    const data = await featureFlagsService.getAutosaveFlagsForRole(requestedRole);
    res.json({ ok: true, data });
  } catch (error) {
    logger.error({ error: error.message }, "Error getting autosave feature flags");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function upsertAutosaveFeatureFlags(req, res) {
  try {
    const schema = Joi.object({
      section: Joi.string().trim().required(),
      role: Joi.string().trim().required(),
      enabled: Joi.boolean().required(),
      metadata: Joi.object().optional(),
    });
    const bulkSchema = Joi.object({
      flags: Joi.array().items(schema).min(1).required(),
    });

    let flags = [];
    if (Array.isArray(req.body?.flags)) {
      const { error, value } = bulkSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          ok: false,
          message: error.details.map((item) => item.message).join(", "),
        });
      }
      flags = value.flags;
    } else {
      const { error, value } = schema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          ok: false,
          message: error.details.map((item) => item.message).join(", "),
        });
      }
      flags = [value];
    }

    const results = [];
    for (const flag of flags) {
      const saved = await featureFlagsService.upsertAutosaveFlag({
        section: flag.section,
        role: flag.role,
        enabled: flag.enabled,
        metadata: flag.metadata || {},
        userId: req.user?.id || null,
      });
      results.push(saved);
    }

    res.json({ ok: true, data: { updated: results } });
  } catch (error) {
    logger.error({ error: error.message }, "Error updating autosave feature flags");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

// Equipment Details V2 (pairs + backup optional)
async function saveEquipmentDetailsV2(req, res) {
  let idempotencySession = null;
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    await assertSectionEditable(id, "equipment", req.user);

    const { error, value } = equipmentDetailsV2Schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });

    idempotencySession = await startIdempotentWrite({
      req,
      operationScope: "bc.equipment.save_v2",
      businessCaseId: id,
      payload: value,
    });
    if (idempotencySession.replay) {
      applyResponseHeadersFromBody(res, idempotencySession.replayPayload);
      return res.status(idempotencySession.replayStatus).json(idempotencySession.replayPayload);
    }

    // Resolver nombres de equipos para incluirlos en los pares almacenados.
    // Esto evita que mapBusinessCaseEquipmentToRequestList use "Equipo ${id}" como fallback.
    // Los ids de equipment_pairs son de servicio.equipos (id_equipo), la misma
    // tabla que usa bc_equipment_selection -- no public.equipment_models (tabla
    // huerfana sin FK real, ver v_equipment_full_catalog).
    const allEquipmentIds = [
      ...new Set(
        value.equipment_pairs.flatMap((pair) => [pair.primary_id, pair.backup_id].filter(Number.isFinite)),
      ),
    ];
    const namesById = {};
    if (allEquipmentIds.length) {
      const { rows: modelRows } = await db.query(
        `SELECT id_equipo AS id, nombre AS name, modelo AS model FROM servicio.equipos WHERE id_equipo = ANY($1::int[])`,
        [allEquipmentIds],
      );
      modelRows.forEach((row) => {
        namesById[String(row.id)] = row.name || row.model || null;
      });
    }

    // Persist in extra.equipment_details to allow UI rehydration
    const payload = {
      equipment_details: value.equipment_pairs.map((pair, index) => ({
        id: index + 1,
        requires_backup: pair.requires_backup,
        primary_id: pair.primary_id,
        primary_name: namesById[String(pair.primary_id)] || null,
        primary_type: pair.primary_type || "new_available",
        backup_type: pair.requires_backup ? (pair.backup_type || "new_available") : null,
        backup_id: pair.requires_backup ? (pair.backup_id ?? null) : null,
        backup_name: (pair.requires_backup && pair.backup_id) ? (namesById[String(pair.backup_id)] || null) : null,
        backup_install_simultaneous: pair.backup_install_simultaneous || false,
        equipment_status: pair.equipment_status || null,
        reservation_image_url: pair.reservation_image_url || null,
        backup_status: pair.requires_backup ? (pair.backup_status || null) : null,
        backup_manufacture_year: pair.requires_backup ? (pair.backup_manufacture_year ?? null) : null,
        installation_location: pair.installation_location || null,
        allows_provisional: pair.allows_provisional ?? null,
        requires_complementary: pair.requires_complementary ?? null,
        complementary_test_purpose: pair.requires_complementary ? (pair.complementary_test_purpose || null) : null,
      })),
    };

    await db.query(
      `
        UPDATE equipment_purchase_requests
        SET extra = jsonb_set(
              COALESCE(extra, '{}'::jsonb),
              '{equipment_details}',
              $1::jsonb,
              true
            ),
            updated_at = now()
        WHERE id = $2
      `,
      [JSON.stringify(payload.equipment_details), id],
    );

    // Keep bc_equipment_selection in sync for determinations and calculations
    const primaryPair = value.equipment_pairs.find((pair) => pair.primary_id);
    if (primaryPair?.primary_id) {
      await equipmentSelectionService.selectEquipment(
        id,
        primaryPair.primary_id,
        true,
        req.user,
      );
      logger.info(
        { businessCaseId: id, equipmentId: primaryPair.primary_id },
        "[BC][EQUIPMENT][SYNC] Primary equipment synced from equipment-details-v2",
      );
    }

    if ((req.user?.role || "").toLowerCase() === "comercial") {
      await notifySectionReview({ businessCaseId: id, section: "equipment", actor: req.user?.email || "system" });
      // Mismo auto-bloqueo que "general": comercial guarda una sola vez y la
      // seccion queda en solo lectura de inmediato. Roles superiores pueden
      // reabrirla con el endpoint generico /sections/equipment/unlock.
      const currentState = await BusinessCaseStateMachine.getCurrentState(id);
      await BusinessCaseDataOwnership.lockSection(id, "equipment", req.user, currentState, {
        source: "auto_lock_after_comercial_save",
      });
    }
    const responseBody = { success: true, data: payload };
    await completeIdempotentWrite(idempotencySession, responseBody, 200);
    res.json(responseBody);
  } catch (error) {
    await failIdempotentWrite(idempotencySession, error);
    logger.error({ error: error.message }, 'Error saving equipment details v2');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

// LIS Integration
async function saveLisIntegration(req, res) {
  let idempotencySession = null;
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    await assertSectionEditable(id, "lis", req.user);
    const payload = req.body || {};
    idempotencySession = await startIdempotentWrite({
      req,
      operationScope: "bc.lis.save",
      businessCaseId: id,
      payload,
    });
    if (idempotencySession.replay) {
      applyResponseHeadersFromBody(res, idempotencySession.replayPayload);
      return res.status(idempotencySession.replayStatus).json(idempotencySession.replayPayload);
    }

    const result = await bcLisIntegrationService.createLisIntegration(id, payload);
    const savedInterfaces = await bcLisIntegrationService.replaceEquipmentInterfaces(
      result.id,
      Array.isArray(payload.interfaces) && payload.requires_interface === true ? payload.interfaces : [],
    );
    if ((req.user?.role || "").toLowerCase() === "comercial") {
      await notifySectionReview({ businessCaseId: id, section: "lis", actor: req.user?.email || "system" });
      // Mismo auto-bloqueo que "general"/"equipment"/"lab": comercial guarda
      // una sola vez y la seccion queda en solo lectura de inmediato. Roles
      // superiores pueden reabrirla con /sections/lis/unlock.
      const currentState = await BusinessCaseStateMachine.getCurrentState(id);
      await BusinessCaseDataOwnership.lockSection(id, "lis", req.user, currentState, {
        source: "auto_lock_after_comercial_save",
      });
    }
    const responseBody = {
      success: true,
      data: {
        ...result,
        equipmentInterfaces: savedInterfaces,
      },
    };
    await completeIdempotentWrite(idempotencySession, responseBody, 200);
    res.json(responseBody);
  } catch (error) {
    await failIdempotentWrite(idempotencySession, error);
    logger.error({ error: error.message }, 'Error saving LIS integration');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function getLisIntegration(req, res) {
  try {
    const { id } = req.params;
    const result = await bcLisIntegrationService.getLisIntegration(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting LIS integration');
    res.status(500).json({ success: false, message: error.message });
  }
}

async function addLisEquipmentInterface(req, res) {
  try {
    const { id } = req.params;
    const lis = await bcLisIntegrationService.getLisIntegration(id);
    if (!lis) {
      return res.status(404).json({ success: false, message: 'LIS integration not found' });
    }
    const result = await bcLisIntegrationService.addEquipmentInterface(lis.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error adding equipment interface');
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getLisEquipmentInterfaces(req, res) {
  try {
    const { id } = req.params;
    const lis = await bcLisIntegrationService.getLisIntegration(id);
    if (!lis) {
      return res.json({ success: true, data: [] });
    }
    const result = await bcLisIntegrationService.getEquipmentInterfaces(lis.id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting equipment interfaces');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Requirements
async function saveRequirements(req, res) {
  let idempotencySession = null;
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    await assertSectionEditable(id, "requirement", req.user);
    const payload = req.body || {};
    idempotencySession = await startIdempotentWrite({
      req,
      operationScope: "bc.requirements.save",
      businessCaseId: id,
      payload,
    });
    if (idempotencySession.replay) {
      applyResponseHeadersFromBody(res, idempotencySession.replayPayload);
      return res.status(idempotencySession.replayStatus).json(idempotencySession.replayPayload);
    }

    const result = await bcRequirementsService.createRequirements(id, payload);
    if ((req.user?.role || "").toLowerCase() === "comercial") {
      await notifySectionReview({ businessCaseId: id, section: "requirement", actor: req.user?.email || "system" });
    }
    const responseBody = { success: true, data: result };
    await completeIdempotentWrite(idempotencySession, responseBody, 200);
    res.json(responseBody);
  } catch (error) {
    await failIdempotentWrite(idempotencySession, error);
    logger.error({ error: error.message }, 'Error saving requirements');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function getRequirements(req, res) {
  try {
    const { id } = req.params;
    const result = await bcRequirementsService.getRequirements(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting requirements');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Deliveries
async function saveDeliveries(req, res) {
  let idempotencySession = null;
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    await assertSectionEditable(id, "requirement", req.user);
    const payload = req.body || {};
    idempotencySession = await startIdempotentWrite({
      req,
      operationScope: "bc.deliveries.save",
      businessCaseId: id,
      payload,
    });
    if (idempotencySession.replay) {
      applyResponseHeadersFromBody(res, idempotencySession.replayPayload);
      return res.status(idempotencySession.replayStatus).json(idempotencySession.replayPayload);
    }

    const result = await bcDeliveriesService.createDeliveries(id, payload);
    if ((req.user?.role || "").toLowerCase() === "comercial") {
      await notifySectionReview({ businessCaseId: id, section: "requirement", actor: req.user?.email || "system" });
      // Mismo auto-bloqueo que las demas secciones. Se aplica aqui (no en
      // saveRequirements) porque el frontend guarda requirements y luego
      // deliveries en la MISMA accion de guardar (RequirementsSection.jsx) --
      // bloquear en el primer POST rechazaria el segundo con "seccion
      // bloqueada". Roles superiores pueden reabrirla con
      // /sections/requirement/unlock.
      const currentState = await BusinessCaseStateMachine.getCurrentState(id);
      await BusinessCaseDataOwnership.lockSection(id, "requirement", req.user, currentState, {
        source: "auto_lock_after_comercial_save",
      });
    }
    const responseBody = { success: true, data: result };
    await completeIdempotentWrite(idempotencySession, responseBody, 200);
    res.json(responseBody);
  } catch (error) {
    await failIdempotentWrite(idempotencySession, error);
    logger.error({ error: error.message }, 'Error saving deliveries');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function getDeliveries(req, res) {
  try {
    const { id } = req.params;
    const result = await bcDeliveriesService.getDeliveries(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting deliveries');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get complete BC with all sections
async function getComplete(req, res) {
  try {
    const { id } = req.params;
    const bc = await businessCaseService.getBusinessCaseById(id);
    const labEnvironment = await bcLabEnvironmentService.getLabEnvironment(id);
    const lisIntegration = await bcLisIntegrationService.getLisIntegration(id);
    const requirements = await bcRequirementsService.getRequirements(id);
    const deliveries = await bcDeliveriesService.getDeliveries(id);

    let lisInterfaces = [];
    if (lisIntegration) {
      lisInterfaces = await bcLisIntegrationService.getEquipmentInterfaces(lisIntegration.id);
    }

    res.json({
      success: true,
      data: {
        ...bc,
        labEnvironment,
        lisIntegration: lisIntegration ? { ...lisIntegration, equipmentInterfaces: lisInterfaces } : null,
        requirements,
        deliveries
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting complete BC');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Eliminadas (verificado muerto, ver businessCase.routes.js para detalle):
// createEconomicBC, calculateROI, evaluateEconomicApproval,
// attachOperationalData, attachLISData, recalculateWithOperational,
// validateBC, promoteStage -- las 8 fases del BusinessCaseOrchestrator.

// Audit log de accesos a secciones sensibles (admin/gerencia)
async function getSectionAccessLog(req, res) {
  try {
    const { id } = req.params;
    const { section } = req.query;
    const auditService = require('./businessCaseSectionAccessAudit.service');
    const rows = await auditService.getAccessLog(id, { section: section || null });
    res.json({ businessCaseId: id, entries: rows, total: rows.length });
  } catch (error) {
    logger.error({ error: error.message }, 'Error obteniendo access log BC');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Historial de transiciones de estado (timeline)
async function getStateHistory(req, res) {
  try {
    const { id } = req.params;
    const db = require('../../config/db');
    const { rows } = await db.query(
      `SELECT
         t.id,
         t.from_state,
         t.to_state,
         t.transition_reason AS reason,
         t.transitioned_at,
         t.metadata,
         u.fullname AS transitioned_by_name,
         u.email   AS transitioned_by_email
       FROM business_case_state_transitions t
       LEFT JOIN users u ON u.id::text = t.transitioned_by::text
       WHERE t.business_case_id = $1
       ORDER BY t.transitioned_at ASC`,
      [id]
    );
    res.json({ businessCaseId: id, history: rows });
  } catch (error) {
    logger.error({ error: error.message }, 'Error obteniendo historial de estados BC');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Completitud por sección para el estado actual del BC
async function getSectionCompleteness(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await require('../../config/db').query(
      `SELECT * FROM v_business_cases_complete WHERE business_case_id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'BC no encontrado' });
    const { BusinessCaseStateReadiness } = require('./businessCaseStateReadiness');
    const completeness = await BusinessCaseStateReadiness.getSectionCompleteness(rows[0]);
    res.json({ businessCaseId: id, sections: completeness });
  } catch (error) {
    logger.error({ error: error.message }, 'Error obteniendo completitud de secciones BC');
    res.status(500).json({ success: false, message: error.message });
  }
}

// SLA status para un BC
async function getBcSlaStatus(req, res) {
  try {
    const { id } = req.params;
    const slaService = require('./businessCaseSla.service');
    const status = await slaService.getSlaStatus(id);
    res.json(status);
  } catch (error) {
    logger.error({ error: error.message }, 'Error obteniendo SLA status BC');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

// SLA dashboard — BCs at_risk o overdue
async function getSlaAtRisk(req, res) {
  try {
    const slaService = require('./businessCaseSla.service');
    const list = await slaService.getAtRiskBcs();
    res.json({ items: list, total: list.length });
  } catch (error) {
    logger.error({ error: error.message }, 'Error obteniendo BCs at-risk SLA');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Transición de emergencia (solo gerencia_general)
async function emergencyTransition(req, res) {
  try {
    const { id } = req.params;
    const { toState, reason } = req.body;
    if (!toState || !reason?.trim()) {
      return res.status(400).json({ success: false, message: 'toState y reason son obligatorios' });
    }
    const result = await BusinessCaseStateMachine.emergencyTransition(
      id, toState, String(req.user?.id || req.user?.email || 'system'), reason.trim()
    );
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Error en transición de emergencia BC');
    res.status(error.status || 500).json({ success: false, message: error.message, code: error.code });
  }
}

// Eliminada (verificado muerto): getCompleteBCMaster -- leia de
// bc_master/bc_lis_data/bc_workflow_history/bc_validations, tablas del
// BusinessCaseOrchestrator sin caller real en el frontend.

// ===== UI GUIDANCE ENDPOINTS (WORKSPACE) =====

/**
 * Get UI guidance data for workspace
 */
async function getUIGuidance(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    // Get business case basic info
    const bc = await businessCaseService.getBusinessCaseById(id);
    if (!bc) {
      return res.status(404).json({ ok: false, message: "Business Case not found" });
    }

    // Helpers to evaluate section completion/progress
    const isFilled = (value) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") return value.trim() !== "";
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.keys(value).length > 0;
      return true;
    };

    const hasAny = (obj, fields) =>
      fields.some((field) => isFilled(obj?.[field]));

    const ownershipInfo = await BusinessCaseDataOwnership.getOwnershipInfo(id);
    const ownershipSectionMap = {
      general: "general",
      lab: "laboratory_environment",
      equipment: "equipment",
      lis: "lis",
      determinations: "determinations",
      investments: "investments",
      prices: "prices",
    };
    const ownershipUserIds = Object.values(ownershipInfo || {})
      .map((entry) => entry?.completedBy)
      .filter(Boolean);
    const numericOwnershipUserIds = ownershipUserIds
      .map((value) => {
        const normalized = String(value || "").trim();
        if (!normalized) return null;
        if (!/^\d+$/.test(normalized)) return null;
        return Number(normalized);
      })
      .filter((value) => Number.isInteger(value) && value > 0);
    const uniqueOwnershipUserIds = [...new Set(numericOwnershipUserIds)];
    const ownershipUserMap = {};
    if (uniqueOwnershipUserIds.length) {
      const { rows } = await db.query(
        `SELECT id, email, fullname FROM users WHERE id = ANY($1)`,
        [uniqueOwnershipUserIds],
      );
      rows.forEach((row) => {
        ownershipUserMap[String(row.id)] = row.email || row.fullname || "system";
      });
    }

    const getOwnershipEntry = (sectionKey) => {
      const mappedKey = ownershipSectionMap[sectionKey] || sectionKey;
      return ownershipInfo?.[mappedKey] || null;
    };

    const getOwnershipEmail = (sectionKey) => {
      const entry = getOwnershipEntry(sectionKey);
      if (!entry?.completedBy) return null;
      const key = String(entry.completedBy);
      return (
        ownershipUserMap[key] ||
        entry?.metadata?.actor_email ||
        null
      );
    };

    const completionRule = (completed, inProgress, sectionKey) => {
      const completedBy = getOwnershipEmail(sectionKey);
      const completedAt = getOwnershipEntry(sectionKey)?.completedAt || null;
      return ({
        canUserEdit: true,
        canUserComplete: true,
        isCompleted: completed,
        currentOwner: !completed && inProgress ? (completedBy || null) : null,
        completedBy: completed ? (completedBy || null) : null,
        completedAt: completed ? (completedAt || null) : null,
      });
    };

    // Load workspace data for completion checks
    const labEnvironment = await bcLabEnvironmentService.getLabEnvironment(id);
    const lisIntegration = await bcLisIntegrationService.getLisIntegration(id);

    const extraEquipment = Array.isArray(bc?.extra?.equipment_details)
      ? bc.extra.equipment_details
      : [];
    const equipmentPairs = extraEquipment;

    const hasLabData =
      labEnvironment &&
      Object.entries(labEnvironment).some(([key, value]) => {
        if (["id", "business_case_id", "created_at", "updated_at"].includes(key)) return false;
        return isFilled(value);
      });

    const hasEquipmentData = Array.isArray(equipmentPairs) && equipmentPairs.length > 0;
    const equipmentComplete = hasEquipmentData && equipmentPairs.every((pair) => {
      if (!pair?.primary_id) return false;
      if (pair?.requires_backup) {
        return Boolean(pair?.backup_id);
      }
      return true;
    });

    const hasLisData =
      lisIntegration &&
      Object.entries(lisIntegration).some(([key, value]) => {
        if (["id", "business_case_id", "created_at", "updated_at"].includes(key)) return false;
        return isFilled(value);
      });

    // El proveedor LIS no es obligatorio para considerar la seccion completa
    // (confirmado con el negocio) -- basta con que comercial haya decidido
    // explicitamente si el BC incluye LIS o no.
    const lisComplete =
      lisIntegration &&
      lisIntegration.includes_lis !== null &&
      lisIntegration.includes_lis !== undefined;

    const requirementData = await bcRequirementsService.getRequirements(id);
    const deliveryData = await bcDeliveriesService.getDeliveries(id);

    const hasRequirementData =
      requirementData &&
      (isFilled(requirementData.deadline_months) ||
        isFilled(requirementData.projected_deadline_months) ||
        isFilled(requirementData.observations));

    const hasDeliveryData =
      deliveryData &&
      (isFilled(deliveryData.delivery_type) ||
        typeof deliveryData.effective_determination === "boolean");

    const requirementComplete =
      isFilled(requirementData?.deadline_months) &&
      isFilled(requirementData?.projected_deadline_months) &&
      Boolean(deliveryData?.delivery_type);

    const consumptionData = await businessCaseService.getConsumptionItems(id);
    const consumptionItems = Array.isArray(consumptionData?.items)
      ? consumptionData.items
      : [];
    const hasDeterminationsData = consumptionItems.length > 0;
    const hasPositiveDeterminations = consumptionItems.some((item) => Number(item?.annualQty) > 0);
    let dispatchWorkspaceData = { items: [] };
    try {
      dispatchWorkspaceData = await dispatchWorkspaceService.getDispatchWorkspace(id);
    } catch (dispatchError) {
      logger.warn(
        { error: dispatchError.message, businessCaseId: id },
        "No se pudo cargar workspace de despacho en ui-guidance. Continuando con fallback.",
      );
    }
    const dispatchItems = Array.isArray(dispatchWorkspaceData?.items) ? dispatchWorkspaceData.items : [];
    const hasDispatchWorkspaceData = dispatchItems.length > 0;
    const calculationsComplete = dispatchItems.some((item) => Number(item?.plannedQty) > 0);
    const dispatchWorkspaceComplete = dispatchItems.some((item) => Number(item?.opsDispatchQty) > 0);

    const {
      metadata: generalMetadata,
      isPublic: isPublicBusinessCaseFlow,
      smartObjective: generalSmartObjective,
      contractingEntity: generalContractingEntity,
      provinceCity: generalProvinceCity,
      clientType: generalClientType,
    } = resolveBusinessCaseGeneralMetadata(bc);

    const hasGeneralData = hasAny(bc, [
      "client_name",
      "client_id",
      "process_code",
      "contract_object",
    ]) || hasAny(generalMetadata, [
      "clientType",
      "contractingEntity",
      "provinceCity",
      "notes",
      "smartObjective",
      "smart_objective",
    ]);

    const generalComplete =
      isFilled(bc?.client_name) &&
      isFilled(bc?.contract_object) &&
      isFilled(generalClientType) &&
      isFilled(generalProvinceCity) &&
      isFilled(generalSmartObjective) &&
      (!isPublicBusinessCaseFlow || (isFilled(bc?.process_code) && isFilled(generalContractingEntity)));

    const investmentSelections = await investmentsService.getInvestmentSelections(id);
    const hasInvestmentsData = Array.isArray(investmentSelections) && investmentSelections.some((i) => i.selected);
    const investmentsMetadata = preflowService.toObject(bc?.modern_bc_metadata)?.investments || {};
    const closedWithoutInvestments = Boolean(investmentsMetadata?.no_additional_investments);
    const investmentCartStatus = resolveInvestmentCartStatus(bc);
    let financialInvestmentValues = [];
    try {
      financialInvestmentValues = await investmentsService.getInvestmentValuesByClass(id, "financiera");
    } catch (financialValuesError) {
      logger.warn(
        { error: financialValuesError?.message || String(financialValuesError), businessCaseId: id },
        "No se pudo cargar valores financieros de inversiones en ui-guidance",
      );
    }
    const financialValuesComplete =
      Array.isArray(financialInvestmentValues) &&
      financialInvestmentValues.length > 0 &&
      financialInvestmentValues.every((item) => {
        const value = Number(item?.unit_price ?? item?.price ?? 0);
        return Number.isFinite(value) && value > 0;
      });

    const userRole = resolveRequestRole(req) || 'comercial';
    const feasibilityData =
      bc?.modern_bc_metadata && typeof bc.modern_bc_metadata === "object" && !Array.isArray(bc.modern_bc_metadata)
        ? (bc.modern_bc_metadata.feasibility && typeof bc.modern_bc_metadata.feasibility === "object" && !Array.isArray(bc.modern_bc_metadata.feasibility)
          ? bc.modern_bc_metadata.feasibility
          : {})
        : {};
    const feasibilityDecision =
      feasibilityData?.decision && typeof feasibilityData.decision === "object" && !Array.isArray(feasibilityData.decision)
        ? feasibilityData.decision
        : null;
    const hasFeasibilityExport = Boolean(feasibilityData?.export_excel?.at);
    const hasFeasibilityDecision = Boolean(feasibilityDecision?.decided_at);
    const workspaceClosedByFeasibility = Boolean(feasibilityData?.closed || hasFeasibilityDecision);
    const lockMap = await BusinessCaseDataOwnership.getLockStatus(id);
    const currentStatDocument = await determinationsGateService.getCurrentDocument(id);
    const determinationsGate = determinationsGateService.buildGateInfo({
      businessCase: bc,
      role: userRole,
      currentDocument: currentStatDocument,
    });
    const canEditInvestments = Boolean(
      determinationsGate.documentUploaded && INVESTMENT_EDIT_ROLES.has(userRole),
    );
    const canEditDeterminations = Boolean(determinationsGate.permissions.canEditDeterminations);
    const ownershipRules = {
      general: completionRule(generalComplete, hasGeneralData, "general"),
      lab: completionRule(hasLabData, hasLabData, "lab"),
      equipment: completionRule(equipmentComplete, hasEquipmentData, "equipment"),
      lis: completionRule(lisComplete, hasLisData, "lis"),
      determinations: completionRule(false, hasDeterminationsData, "determinations"),
      requirement: completionRule(requirementComplete, hasRequirementData || hasDeliveryData, "requirement"),
      investments: completionRule(
        hasInvestmentsData || closedWithoutInvestments,
        hasInvestmentsData || closedWithoutInvestments,
        "investments",
      ),
      investment_values_op: completionRule(
        Boolean(getOwnershipEntry("investment_values_op")?.completedAt) || closedWithoutInvestments,
        hasInvestmentsData || closedWithoutInvestments,
        "investment_values_op",
      ),
      investment_values_fin: completionRule(
        Boolean(getOwnershipEntry("investment_values_fin")?.completedAt) || financialValuesComplete || closedWithoutInvestments,
        hasInvestmentsData || closedWithoutInvestments,
        "investment_values_fin",
      ),
      prices: completionRule(false, false, "prices"),
      calculations: completionRule(calculationsComplete, hasDispatchWorkspaceData, "calculations"),
      dispatch_workspace: completionRule(
        dispatchWorkspaceComplete,
        hasDispatchWorkspaceData,
        "dispatch_workspace",
      ),
      feasibility: completionRule(
        hasFeasibilityDecision,
        hasFeasibilityExport || hasFeasibilityDecision,
        "feasibility",
      ),
      rentability: completionRule(false, false, "rentability"),
    };

    Object.keys(ownershipRules).forEach((section) => {
      const lockInfo = lockMap?.[section];
      if (!lockInfo) return;
      ownershipRules[section].isLocked = Boolean(lockInfo.isLocked);
      if (section !== "investments" && lockInfo.isLocked) {
        ownershipRules[section].canUserEdit = false;
      }
      ownershipRules[section].lockedBy = lockInfo.lockedBy || null;
      ownershipRules[section].lockedAt = lockInfo.lockedAt || null;
    });

    ownershipRules.determinations.canUserEdit = canEditDeterminations;
    const determinationsOwnershipCompleted = Boolean(getOwnershipEntry("determinations")?.completedAt);
    const determinationsCompleted = determinationsGate?.phase === "locked" || determinationsOwnershipCompleted;
    const determinationsInProgress = Boolean(
      hasDeterminationsData || hasPositiveDeterminations || determinationsGate?.phase === "technical_review" || determinationsGate?.phase === "commercial_input",
    );
    ownershipRules.determinations.isCompleted = determinationsCompleted;
    ownershipRules.determinations.currentOwner = !determinationsCompleted && determinationsInProgress
      ? ownershipRules.determinations.currentOwner
      : null;
    if (!ownershipRules.determinations.isCompleted) {
      if (determinationsGate?.phase === "technical_review") {
        ownershipRules.determinations.currentOwner = "jefe_servicio";
      } else if (determinationsGate?.phase === "commercial_input") {
        ownershipRules.determinations.currentOwner =
          normalizePurchaseTypeForGate(bc?.bc_purchase_type) === "public"
            ? "jefe_comercial / analista_compras_publicas"
            : "jefe_comercial / backoffice_comercial";
      }
    }
    ownershipRules.determinations.metadata = {
      ...(ownershipRules.determinations.metadata || {}),
      requires_stat_document: true,
      stat_document_uploaded: determinationsGate.documentUploaded,
      stat_document_deadline_at: determinationsGate.deadlineAt,
      stat_document_expired: determinationsGate.isExpired,
      determinations_editor_roles: determinationsGate.editors,
    };
    const isFeasibleDecision = Boolean(feasibilityDecision?.is_feasible);

    ownershipRules.feasibility.canUserEdit = !workspaceClosedByFeasibility;
    ownershipRules.feasibility.metadata = {
      ...(ownershipRules.feasibility.metadata || {}),
      exported_at: feasibilityData?.export_excel?.at || null,
      status: feasibilityData?.status || null,
      closed: workspaceClosedByFeasibility,
      decision: feasibilityDecision,
    };

    if (workspaceClosedByFeasibility) {
      Object.keys(ownershipRules).forEach((sectionKey) => {
        // dispatch_workspace, investments y determinations tienen reglas propias post-factibilidad.
        if (sectionKey === 'dispatch_workspace') return;
        if (sectionKey === 'investments') return;
        if (sectionKey === 'determinations') return;
        ownershipRules[sectionKey].canUserEdit = false;
      });
      // Solo editable si la decisión fue factible
      ownershipRules.dispatch_workspace.canUserEdit = isFeasibleDecision;
    } else {
      // Antes de decidir factibilidad, dispatch_workspace no se puede editar
      ownershipRules.dispatch_workspace.canUserEdit = false;
    }

    ownershipRules.dispatch_workspace.metadata = {
      ...(ownershipRules.dispatch_workspace.metadata || {}),
      requires_feasibility: true,
      is_feasible: isFeasibleDecision,
      feasibility_decided: hasFeasibilityDecision,
    };

    ownershipRules.investments.canUserEdit = canEditInvestments;
    ownershipRules.investments.metadata = {
      ...(ownershipRules.investments.metadata || {}),
      requires_stat_document: true,
      stat_document_uploaded: determinationsGate.documentUploaded,
      cart_confirmed: investmentCartStatus.confirmed,
      cart_acp_confirmed: investmentCartStatus.acpConfirmed,
      cart_service_confirmed: investmentCartStatus.serviceConfirmed,
      acp_confirmed_at: investmentCartStatus.acpConfirmedAt,
      acp_confirmed_by_email: investmentCartStatus.acpConfirmedByEmail,
      acp_confirmed_by_role: investmentCartStatus.acpConfirmedByRole,
      service_confirmed_at: investmentCartStatus.serviceConfirmedAt,
      service_confirmed_by_email: investmentCartStatus.serviceConfirmedByEmail,
      service_confirmed_by_role: investmentCartStatus.serviceConfirmedByRole,
      no_additional_investments: closedWithoutInvestments,
      closed_without_investments_at: investmentsMetadata?.closed_without_investments_at || null,
      prices_closed_without_investments: Boolean(investmentsMetadata?.prices_closed_without_investments),
    };

    const ruleEntries = [
      ...Object.entries(ownershipRules)
        .filter(([key]) => !["investment_values_op", "investment_values_fin"].includes(key))
        .map(([, rule]) => rule),
      {
        ...(ownershipRules.investment_values_fin || {}),
        isCompleted: Boolean(ownershipRules.investment_values_fin?.isCompleted),
      },
    ];
    const completionSummary = {
      totalSections: ruleEntries.length,
      completedSections: ruleEntries.filter((r) => r.isCompleted).length,
      inProgressSections: ruleEntries.filter((r) => !r.isCompleted && r.currentOwner).length,
    };
    completionSummary.pendingSections =
      completionSummary.totalSections -
      completionSummary.completedSections -
      completionSummary.inProgressSections;

    const sectionOwnership = {
      rules: ownershipRules,
      completionSummary,
    };
    const preflow = preflowService.buildPreflowInfo(bc, ownershipRules);
    const canResolvePreflowReopen = Boolean(
      ['jefe_comercial', 'jefe_de_comercial', 'gerencia', 'gerencia_general'].includes(userRole) &&
      preflow?.extensionRequest?.status === 'pending',
    );
    const canRequestPreflowReopen = Boolean(
      preflow?.isActive &&
      preflow?.isExpired &&
      preflow?.activeRole &&
      String(preflow.activeRole).toLowerCase() === userRole,
    );
    const canDecideFeasibility = ["acp_comercial", "jefe_comercial", "gerencia", "gerencia_general"].includes(userRole);

    // BC-16: Apelación de factibilidad rechazada
    const feasibilityMeta = preflowService.toObject(bc?.modern_bc_metadata)?.feasibility;
    const feasibilityDecisionMeta = (feasibilityMeta?.decision && typeof feasibilityMeta.decision === "object")
      ? feasibilityMeta.decision
      : null;
    const existingAppeal = preflowService.toObject(bc?.modern_bc_metadata)?.feasibility_appeal || null;
    // BC-17: también bloquear si el rechazo ya es definitivo (no hay más apelaciones posibles)
    const isDefinitivelyRejected = Boolean(preflowService.toObject(bc?.modern_bc_metadata)?.feasibility_is_definitively_rejected);
    const canAppealFeasibilityRejection = Boolean(
      FEASIBILITY_APPEAL_REQUESTER_ROLES.has(userRole) &&
      feasibilityDecisionMeta?.decided_at &&
      !Boolean(feasibilityDecisionMeta?.is_feasible) &&
      !isDefinitivelyRejected &&           // BC-17: rechazo definitivo → no más apelaciones
      existingAppeal?.status !== "pending",
    );
    const canResolveFeasibilityAppeal = Boolean(
      FEASIBILITY_APPEAL_RESOLVER_ROLES.has(userRole) &&
      existingAppeal?.status === "pending",
    );

    // Get permissions based on user role
    const permissions = {
      userRole: userRole,
      canEdit: !workspaceClosedByFeasibility,
      canCompleteSections: !workspaceClosedByFeasibility,
      canPromoteStage: !workspaceClosedByFeasibility && ['gerencia', 'jefe_comercial', 'jefe_operaciones'].includes(userRole),
      canAddObservations: true,
      canBlockSections: !workspaceClosedByFeasibility && LOCK_ROLES.includes(userRole),
      canUnblockSections: !workspaceClosedByFeasibility && LOCK_ROLES.includes(userRole),
      canRequestPreflowReopen: !workspaceClosedByFeasibility && canRequestPreflowReopen,
      canResolvePreflowReopen,
      canDecideFeasibility: canDecideFeasibility && !workspaceClosedByFeasibility,
      canAppealFeasibilityRejection,              // BC-16: comercial* puede apelar cuando is_feasible=false
      canResolveFeasibilityAppeal,               // BC-16: jefe_comercial/gerencia puede resolver apelación
      feasibilityAppeal: existingAppeal,         // BC-16: datos de la apelación vigente para el frontend
      feasibilityIsDefinitivelyRejected: isDefinitivelyRejected, // BC-17: rechazo sin más apelaciones posibles
      workspaceClosed: workspaceClosedByFeasibility,
      canEditInvestments,
      canEditDeterminations,
    };
    const autosaveFlags = await featureFlagsService.getAutosaveFlagsForRole(userRole);

    const rawCurrentStage = bc.bc_stage || bc.current_stage || "draft";
    const visibleCurrentStage = hasFeasibilityDecision
      ? (feasibilityDecision?.is_feasible ? "factible" : "cerrado_no_factible")
      : hasFeasibilityExport
        ? "factibilidad"
        : rawCurrentStage;

    // Build UI guidance response
    const uiGuidance = {
      businessCase: bc,
      sectionOwnership,
      permissions,
      featureFlags: {
        autosave: autosaveFlags.sections,
      },
      workspaceData: {
        lab_environment: labEnvironment,
        requirements: requirementData,
        deliveries: deliveryData,
        determinations_gate: determinationsGate,
        feasibility: {
          ...feasibilityData,
          hasExport: hasFeasibilityExport,
          hasDecision: hasFeasibilityDecision,
          closed: workspaceClosedByFeasibility,
        },
      },
      observationData: null, // No observations for now
      workflowState: {
        currentStage: visibleCurrentStage,
        rawStage: rawCurrentStage,
        availableTransitions: ['promote', 'observe']
      },
      preflow,
    };

    res.json({ ok: true, data: uiGuidance });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting UI guidance');
    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error obteniendo datos de UI guidance"
    });
  }
}

async function getDeterminationsGateInfo(req, res) {
  try {
    const { id } = req.params;
    const bc = await businessCaseService.getBusinessCaseById(id);
    const role = resolveRequestRole(req) || "comercial";
    const uploadReadiness = await buildDeterminationsUploadReadiness({
      businessCaseId: id,
      businessCase: bc,
      role,
    });
    const gate = determinationsGateService.buildGateInfo({
      businessCase: bc,
      role,
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    const metadata = bc?.modern_bc_metadata && typeof bc.modern_bc_metadata === "object"
      ? bc.modern_bc_metadata
      : {};
    const inspectionRequest =
      metadata?.environment_inspection_request && typeof metadata.environment_inspection_request === "object"
        ? metadata.environment_inspection_request
        : null;
    const inspectionDraft = await buildBusinessCaseInspectionDraft({
      businessCaseId: id,
      businessCase: bc,
      metadata,
      inspectionWindow: {
        inspection_min_date: inspectionRequest?.inspection_min_date || null,
        inspection_max_date: inspectionRequest?.inspection_max_date || null,
      },
      overrides: inspectionRequest?.payload || {},
    }).catch(() => ({ draft: null, missingFields: [] }));
    res.json({
      ok: true,
      data: {
        ...gate,
        uploadReadiness,
        inspectionRequest,
        inspectionDraft,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, "Error getting determinations gate info");
    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo obtener informacion del documento estadistico",
    });
  }
}

async function requestEnvironmentInspection(req, res) {
  try {
    const { id } = req.params;
    const role = resolveRequestRole(req);
    const bc = await businessCaseService.getBusinessCaseById(id);
    if (!canRequestBusinessCaseInspection(role)) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para solicitar la inspeccion de ambiente en este Business Case.",
      });
    }

    const currentDocument = await determinationsGateService.getCurrentDocument(id);
    if (!currentDocument?.drive_file_id && !currentDocument?.drive_link) {
      return res.status(409).json({
        ok: false,
        message: "Primero debes subir el documento estadistico antes de solicitar la inspeccion de ambiente.",
      });
    }

    const metadata = bc?.modern_bc_metadata && typeof bc.modern_bc_metadata === "object"
      ? { ...bc.modern_bc_metadata }
      : {};
    if (metadata?.environment_inspection_request?.request_id) {
      return res.status(409).json({
        ok: false,
        message: "La inspeccion de ambiente ya fue solicitada para este Business Case.",
        code: "BC_INSPECTION_ALREADY_REQUESTED",
      });
    }

    const inspectionResult = await ensureBusinessCaseInspectionRequest({
      businessCaseId: id,
      businessCase: bc,
      metadata,
      actorUser: req.user,
      inspectionWindow: {
        inspection_min_date: req.body?.inspection_min_date,
        inspection_max_date: req.body?.inspection_max_date,
      },
      inspectionPayload: {
        persona_contacto: req.body?.persona_contacto,
        celular_contacto: req.body?.celular_contacto,
        accesorios: req.body?.accesorios,
        anotaciones: req.body?.anotaciones,
        observaciones: req.body?.observaciones,
      },
      statDocument: {
        drive_file_id: currentDocument.drive_file_id || null,
        drive_link: currentDocument.drive_link || null,
        name: currentDocument.file_name || "Documento estadistico BC",
        mime_type: currentDocument.mime_type || "application/octet-stream",
      },
    });

    await businessCaseService.updateBusinessCase(id, {
      modern_bc_metadata: inspectionResult.metadata,
    });

    const refreshed = await businessCaseService.getBusinessCaseById(id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: refreshed,
      role,
      currentDocument,
    });

    return res.json({
      ok: true,
      data: {
        gate,
        inspectionRequest: inspectionResult.inspection,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, "Error requesting BC environment inspection");
    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo solicitar la inspeccion de ambiente",
      code: error.code || null,
    });
  }
}

const INSPECTION_REVIEW_ROLES = new Set([
  "jefe_servicio", "jefe_servicio_tecnico", "jefe_tecnico",
]);

async function resolveBusinessCaseIdForInspectionReview(rawId) {
  const candidate = String(rawId || "").trim();
  if (UUID_REGEX.test(candidate)) return candidate;

  if (/^\d+$/.test(candidate)) {
    const { rows } = await db.query(
      `SELECT business_case_id
         FROM public.equipment_purchase_requests
        WHERE modern_bc_metadata->'environment_inspection_request'->>'request_id' = $1
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1`,
      [candidate],
    );
    if (rows[0]?.business_case_id) return rows[0].business_case_id;
  }

  return null;
}

async function reviewEnvironmentInspectionRequest(req, res) {
  try {
    const id = await resolveBusinessCaseIdForInspectionReview(req.params.id);
    if (!id) {
      return res.status(404).json({ ok: false, message: "Business Case no encontrado." });
    }
    const role = resolveRequestRole(req);

    if (!INSPECTION_REVIEW_ROLES.has(role)) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para revisar solicitudes de inspeccion de ambiente.",
        code: "BC_INSPECTION_REVIEW_FORBIDDEN",
      });
    }

    const bc = await businessCaseService.getBusinessCaseById(id);
    if (!bc) {
      return res.status(404).json({ ok: false, message: "Business Case no encontrado." });
    }

    const metadata = bc?.modern_bc_metadata && typeof bc.modern_bc_metadata === "object"
      ? { ...bc.modern_bc_metadata }
      : {};

    const inspectionReq = metadata?.environment_inspection_request;
    if (!inspectionReq?.request_id) {
      return res.status(409).json({
        ok: false,
        message: "Este Business Case no tiene una solicitud de inspeccion pendiente.",
        code: "BC_INSPECTION_NOT_REQUESTED",
      });
    }

    const action = String(req.body?.action || "").toLowerCase();
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ ok: false, message: "action debe ser 'approve' o 'reject'." });
    }

    const nowIso = new Date().toISOString();
    const reviewedBy = req.user?.email || req.user?.fullname || null;

    if (action === "reject") {
      const reason = String(req.body?.reason || "").trim();
      if (!reason) {
        return res.status(400).json({ ok: false, message: "Debes indicar el motivo del rechazo." });
      }
      metadata.environment_inspection_request = {
        ...inspectionReq,
        status: "rejected",
        rejection_reason: reason,
        reviewed_by: reviewedBy,
        reviewed_at: nowIso,
      };
    } else {
      const assignedUserId = Number.isFinite(Number(req.body?.assigned_user_id))
        ? Number(req.body.assigned_user_id)
        : null;
      const inspectionDate = String(req.body?.inspection_date || "").slice(0, 10);
      const notes = String(req.body?.notes || "").trim() || null;

      if (!assignedUserId) {
        return res.status(400).json({ ok: false, message: "Debes asignar un usuario para realizar la inspeccion." });
      }
      if (!inspectionDate || !/^\d{4}-\d{2}-\d{2}$/.test(inspectionDate)) {
        return res.status(400).json({ ok: false, message: "Debes indicar la fecha exacta de inspeccion (YYYY-MM-DD)." });
      }
      const windowMinDate = String(inspectionReq.inspection_min_date || "").slice(0, 10);
      const windowMaxDate = String(inspectionReq.inspection_max_date || windowMinDate || "").slice(0, 10);
      if (windowMinDate && (inspectionDate < windowMinDate || inspectionDate > windowMaxDate)) {
        return res.status(409).json({
          ok: false,
          message: `La fecha de inspeccion debe estar entre ${windowMinDate} y ${windowMaxDate}.`,
          code: "BC_INSPECTION_DATE_OUT_OF_WINDOW",
        });
      }

      const { rows: [assignedUser] } = await db.query(
        `SELECT id, COALESCE(fullname, name, email) AS display_name FROM public.users WHERE id = $1`,
        [assignedUserId],
      );
      if (!assignedUser) {
        return res.status(400).json({ ok: false, message: "El usuario asignado no existe." });
      }

      await db.query(
        `INSERT INTO servicio.cronograma_actividades_tecnicas
          (user_id, activity_date, title, notes, status, source_type, source_id, created_by, created_by_email)
         VALUES ($1, $2::date, $3, $4, 'programado', 'inspeccion_bc', $5, $6, $7)`,
        [
          assignedUserId,
          inspectionDate,
          `Inspeccion de ambiente BC – ${bc.client_name || String(id).slice(0, 8)}`,
          notes,
          String(id),
          req.user?.id || null,
          req.user?.email || null,
        ],
      );

      metadata.environment_inspection_request = {
        ...inspectionReq,
        status: "approved",
        assigned_user_id: assignedUserId,
        assigned_user_name: assignedUser.display_name,
        inspection_date: inspectionDate,
        notes,
        reviewed_by: reviewedBy,
        reviewed_at: nowIso,
      };
    }

    await businessCaseService.updateBusinessCase(id, { modern_bc_metadata: metadata });

    const clientName = bc.client_name || "Cliente pendiente";
    const subjectLabel = `Business Case ${clientName} - Inspección de ambiente`;
    try {
      if (bc?.created_by) {
        await notificationManager.sendNotification({
          userId: bc.created_by,
          customTitle: action === "approve" ? "Inspección de ambiente coordinada" : "Inspección de ambiente rechazada",
          customMessage:
            action === "approve"
              ? `Se coordinó la inspección de ambiente del BC de ${clientName} con ${metadata.environment_inspection_request.assigned_user_name} el ${metadata.environment_inspection_request.inspection_date}.`
              : `Se rechazó la inspección de ambiente del BC de ${clientName}. Motivo: ${metadata.environment_inspection_request.rejection_reason}.`,
          type: action === "approve" ? "task" : "alert",
          source: "business_case.inspection.reviewed",
          priority: action === "approve" ? 1 : 2,
          email: true,
          data: {
            email_subject: subjectLabel,
            target_path: `/dashboard/business-case/workspace/${id}`,
          },
          meta: { businessCaseId: id, action },
        });
      }
      if (action === "approve" && metadata.environment_inspection_request.assigned_user_id) {
        await notificationManager.sendNotification({
          userId: metadata.environment_inspection_request.assigned_user_id,
          customTitle: "Inspección de ambiente asignada",
          customMessage: `Tienes una inspección de ambiente para ${clientName} agendada el ${metadata.environment_inspection_request.inspection_date}.${metadata.environment_inspection_request.notes ? ` Notas: ${metadata.environment_inspection_request.notes}` : ""}`,
          type: "task",
          source: "business_case.inspection.assigned",
          priority: 1,
          email: true,
          data: { email_subject: subjectLabel },
          meta: { businessCaseId: id },
        });
      }
    } catch (notifyError) {
      logger.warn({ notifyError, businessCaseId: id }, "No se pudo notificar la revision de inspeccion del BC");
    }

    return res.json({
      ok: true,
      action,
      inspectionRequest: metadata.environment_inspection_request,
    });
  } catch (error) {
    logger.error({ error: error.message }, "Error reviewing BC inspection request");
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo procesar la revision de la inspeccion",
    });
  }
}

// F.ST-07: registra el resultado de la visita de inspeccion de ambiente ya
// coordinada (tecnico + fecha asignados via reviewEnvironmentInspectionRequest).
// Reusa el mismo contrato y helpers compartidos que compras publica/privada
// (siteInspectionRules/fst07Pdf/fst07.service) para no duplicar la logica.
async function registerEnvironmentInspectionResult(req, res) {
  try {
    const id = await resolveBusinessCaseIdForInspectionReview(req.params.id);
    if (!id) {
      return res.status(404).json({ ok: false, message: "Business Case no encontrado." });
    }
    const role = resolveRequestRole(req);
    if (!INSPECTION_REVIEW_ROLES.has(role)) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para registrar el resultado de inspeccion de ambiente.",
        code: "BC_INSPECTION_RESULT_FORBIDDEN",
      });
    }

    const bc = await businessCaseService.getBusinessCaseById(id);
    if (!bc) {
      return res.status(404).json({ ok: false, message: "Business Case no encontrado." });
    }

    const metadata = bc?.modern_bc_metadata && typeof bc.modern_bc_metadata === "object"
      ? { ...bc.modern_bc_metadata }
      : {};
    const inspectionReq = metadata?.environment_inspection_request;
    if (!inspectionReq?.request_id) {
      return res.status(409).json({
        ok: false,
        message: "Este Business Case no tiene una solicitud de inspeccion pendiente.",
        code: "BC_INSPECTION_NOT_REQUESTED",
      });
    }
    if (!inspectionReq?.assigned_user_id || !inspectionReq?.inspection_date) {
      return res.status(409).json({
        ok: false,
        message: "Primero se debe aprobar y asignar tecnico y fecha de inspeccion.",
        code: "BC_INSPECTION_NOT_COORDINATED",
      });
    }

    const normalizedResult = normalizeInspectionResult(req.body?.result);
    if (!normalizedResult) {
      throw createSiteInspectionError("Debes indicar un resultado valido para la inspeccion en sitio", {
        status: 400,
        code: "SITE_INSPECTION_RESULT_REQUIRED",
      });
    }
    const normalizedChecklist = normalizeFst07Checklist(req.body?.checklist || {});
    const clientSignerName = String(req.body?.client_signer_name || "").trim();
    if (!clientSignerName) {
      throw createSiteInspectionError("Debes registrar el nombre de quien firma por parte del cliente", {
        status: 400,
        code: "CLIENT_SIGNATURE_REQUIRED",
      });
    }
    const normalizedFollowUpDate = assertFollowUpDateConsistency({
      result: normalizedResult,
      followUpDate: req.body?.follow_up_date,
      scheduledDate: inspectionReq.inspection_date,
    });

    const clientName = bc?.client_name || "Cliente";
    const equipmentNames = Array.isArray(inspectionReq?.payload?.equipos)
      ? inspectionReq.payload.equipos.map((item) => item?.nombre_equipo).filter(Boolean).join(", ")
      : "";

    const { buffer: fst07Buffer, generatedAt } = await generateFst07PdfBuffer({
      clientName,
      equipmentName: equipmentNames || "Equipo no especificado",
      scheduledDate: inspectionReq.inspection_date,
      responsibleName: inspectionReq.assigned_user_name || "",
      result: normalizedResult,
      checklist: normalizedChecklist,
      observations: req.body?.observations,
      recommendations: req.body?.recommendations,
      followUpDate: normalizedFollowUpDate,
      isReinspection: Boolean(req.body?.is_reinspection),
      clientSignerName,
    });

    const { folderId } = await ensureBusinessCaseDriveFolderById(id);
    const fileName = buildFst07FileName({ clientName, generatedAt });
    const stored = await uploadBase64File(fileName, fst07Buffer.toString("base64"), "application/pdf", folderId);
    if (!stored?.id) {
      throw createSiteInspectionError("No se pudo almacenar el documento F.ST-07 en Drive", {
        status: 500,
        code: "SITE_INSPECTION_REPORT_FAILED",
      });
    }

    await addDriveAttachment({
      request_id: inspectionReq.request_id,
      drive_file_id: stored.id,
      title: "F.ST-07 Inspeccion de Ambiente",
    }).catch((err) => logger.warn({ err }, "No se pudo adjuntar F.ST-07 a la solicitud BC"));

    const nowIso = new Date().toISOString();
    metadata.environment_inspection_request = {
      ...inspectionReq,
      status: normalizedResult === "compliant" ? "completed" : "non_compliant_reinspection_pending",
      result: normalizedResult,
      follow_up_date: normalizedResult === "non_compliant" ? normalizedFollowUpDate : null,
      report_file_id: stored.id,
      report_link: stored.webViewLink || null,
      report_generated_at: generatedAt,
      checklist: normalizedChecklist,
      observations: String(req.body?.observations || "").trim() || null,
      recommendations: String(req.body?.recommendations || "").trim() || null,
      client_signer_name: clientSignerName,
      result_registered_by: req.user?.email || null,
      result_registered_at: nowIso,
    };
    await businessCaseService.updateBusinessCase(id, { modern_bc_metadata: metadata });

    if (normalizedResult === "non_compliant" && normalizedFollowUpDate) {
      await db.query(
        `UPDATE servicio.cronograma_actividades_tecnicas
            SET activity_date = $1, status = 'programado', updated_at = now()
          WHERE source_type = 'inspeccion_bc' AND source_id = $2`,
        [normalizedFollowUpDate, String(id)],
      );
    } else if (normalizedResult === "compliant") {
      await db.query(
        `UPDATE servicio.cronograma_actividades_tecnicas
            SET status = 'completado', updated_at = now()
          WHERE source_type = 'inspeccion_bc' AND source_id = $1
            AND COALESCE(lower(status), 'programado') IN ('programado', 'confirmado', 'en_proceso')`,
        [String(id)],
      );
      markRequestCompleted(inspectionReq.request_id, {
        actorUser: req.user,
        resultMeta: { source: "business_case_site_inspection", result: normalizedResult },
      }).catch((err) => logger.warn({ err }, "No se pudo completar la solicitud F.ST-20 (business case)"));
    }

    await trackFst07WorkflowDocument({
      sourceType: "business_case",
      sourceId: String(id),
      requestId: inspectionReq.request_id,
      driveFileId: stored.id,
      driveFolderId: folderId,
      driveLink: stored.webViewLink || null,
      result: normalizedResult,
      followUpDate: normalizedFollowUpDate,
      isReinspection: Boolean(req.body?.is_reinspection),
      clientName,
      equipmentName: equipmentNames || null,
      user: req.user,
      metadata: { source_module: "business_case", business_case_id: id },
    });

    return res.json({
      ok: true,
      result: normalizedResult,
      inspectionRequest: metadata.environment_inspection_request,
    });
  } catch (error) {
    logger.error({ error: error.message }, "Error registering BC inspection result");
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo registrar el resultado de la inspeccion",
      code: error.code || null,
    });
  }
}

async function lockDeterminationsSubsection(req, res) {
  try {
    const { id } = req.params;
    const subsection = normalizeSubsectionKey(req.body?.subsection);
    if (!DETERMINATIONS_SUBSECTIONS.has(subsection)) {
      return res.status(400).json({ ok: false, message: "Subseccion invalida. Usa: reactivos, controles, calibradores o materiales." });
    }

    const role = resolveRequestRole(req);
    const businessCase = await businessCaseService.getBusinessCaseById(id);
    const currentDocument = await determinationsGateService.getCurrentDocument(id);
    const gate = determinationsGateService.buildGateInfo({ businessCase, role, currentDocument });
    determinationsGateService.assertCanEditDeterminationsOrThrow(gate);

    // Read the official annual quantities immediately before validation. The
    // protection is applied only after the existing completeness checks pass.
    await businessCaseService.syncConsumptionQuantitiesFromSheet(id, {
      itemTypes: DETERMINATIONS_SHEET_ITEM_TYPES[subsection],
    });
    const currentConsumption = await businessCaseService.getConsumptionItems(id);
    const items = Array.isArray(currentConsumption?.items) ? currentConsumption.items : [];
    const scoped = items.filter((item) => subsectionFromConsumptionType(item?.type) === subsection);
    if (subsection === "reactivos" && !scoped.length) {
      return res.status(409).json({
        ok: false,
        message: `No existen items en la subseccion ${subsection} para bloquear.`,
      });
    }
    if (scoped.length) {
      const hasPositiveQuantity = scoped.some((item) => hasRequiredDeterminationsQuantity(item, subsection));
      if (subsection === "reactivos" && !hasPositiveQuantity) {
        return res.status(409).json({
          ok: false,
          message: "No hay reactivos sincronizados con cantidad mayor a 0 para validar.",
        });
      }
      const hasPending = scoped.some((item) => !hasRequiredDeterminationsQuantity(item, subsection));
      if (subsection !== "reactivos" && hasPending) {
        return res.status(409).json({
          ok: false,
          message: `La subseccion ${subsection} tiene items sin valor en PRODUCTO A ENTREGAR. Completa esos valores en el Sheet antes de bloquear.`,
        });
      }

      // Sin items no hay nada que sincronizar ni celdas que proteger --
      // proteger un rango vacio lanzaria "NO_ANNUAL_CELLS_FOUND" y bloquearia
      // el cierre de una subseccion que, para este equipo/BC, simplemente no
      // aplica (ej. b123 no tiene calibradores en su catalogo).
      const annualSync = await businessCaseService.syncConsumptionQuantitiesFromSheet(id, {
        itemTypes: DETERMINATIONS_SHEET_ITEM_TYPES[subsection],
        protectAnnualQuantities: subsection,
      });
      logger.info(
        {
          businessCaseId: id,
          subsection,
          protectedRanges: annualSync?.annualQuantityProtection?.protectedRanges || 0,
        },
        "[BC_SHEET] Cantidades anuales protegidas despues de validar subseccion",
      );
    } else {
      logger.info(
        { businessCaseId: id, subsection },
        "[BC_SHEET] Subseccion sin items para este BC, se marca como completada sin sincronizar",
      );
    }

    const metadata = preflowService.toObject(businessCase?.modern_bc_metadata);
    const currentGate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
      ? { ...metadata.determinations_gate }
      : {};
    const locks = resolveDeterminationsSectionLocks(currentGate);
    locks[subsection] = true;

    if (subsection === "reactivos") {
      await applyDeterminationsCompletionTransition({
        businessCase,
        role,
        user: req.user,
      });
      const refreshedAfterTransition = await businessCaseService.getBusinessCaseById(id);
      const updatedGate = determinationsGateService.buildGateInfo({
        businessCase: refreshedAfterTransition,
        role,
        currentDocument: await determinationsGateService.getCurrentDocument(id),
      });
      await notifyDeterminationsReactivosValidated({
        businessCaseId: id,
        actor: req.user?.email || req.user?.role || "ACP Comercial",
      });
      return res.json({ ok: true, data: { subsection, locked: true, gate: updatedGate } });
    }

    const now = new Date().toISOString();
    metadata.determinations_gate = {
      ...currentGate,
      section_locks: locks,
      updated_at: now,
    };
    // Patch minimo, solo determinations_gate (evita pisar otras claves
    // top-level -- ej. una prorroga de SLA aprobada concurrentemente -- con
    // la copia de metadata leida al inicio de este request).
    await businessCaseService.updateBusinessCase(id, {
      modern_bc_metadata: { determinations_gate: metadata.determinations_gate },
    });
    const allTechnicalSubsectionsLocked = ["reactivos", "controles", "calibradores", "materiales"]
      .every((key) => locks[key] === true);
    if (allTechnicalSubsectionsLocked) {
      await workflowSlaService.notifyParticipants({
        businessCaseId: id,
        eventKey: "technical_determinations_completed",
        title: "Determinaciones tecnicas completadas",
        message:
          "Controles, calibradores y materiales fueron completados y validados. El siguiente paso es revisar los carritos de inversiones y registrar sus valores.",
        actorEmail: req.user?.email || null,
        excludeActor: true,
      });
    }
    const refreshed = await businessCaseService.getBusinessCaseById(id);
    const updatedGate = determinationsGateService.buildGateInfo({
      businessCase: refreshed,
      role,
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    res.json({ ok: true, data: { subsection, locked: true, gate: updatedGate } });
  } catch (error) {
    logger.error({ error: error.message }, "Error locking determinations subsection");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

const DETERMINATIONS_TECHNICAL_SUBSECTIONS = ["controles", "calibradores", "materiales"];

// Cierre en un solo paso de controles + calibradores + materiales para
// jefe_servicio -- evita repetir 3 veces el mismo click de "validar" por
// cada subseccion. Es todo-o-nada: si alguna subseccion tiene cantidades en
// 0 pendientes, no se bloquea ninguna y se informa cuales faltan.
async function lockAllDeterminationsTechnicalSubsections(req, res) {
  try {
    const { id } = req.params;
    const role = resolveRequestRole(req);
    const businessCase = await businessCaseService.getBusinessCaseById(id);
    const currentDocument = await determinationsGateService.getCurrentDocument(id);
    const gate = determinationsGateService.buildGateInfo({ businessCase, role, currentDocument });
    determinationsGateService.assertCanEditDeterminationsOrThrow(gate);

    const metadata = preflowService.toObject(businessCase?.modern_bc_metadata);
    const currentGate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
      ? { ...metadata.determinations_gate }
      : {};
    const locks = resolveDeterminationsSectionLocks(currentGate);

    const pendingSubsections = DETERMINATIONS_TECHNICAL_SUBSECTIONS.filter((key) => !locks[key]);
    // Si las 3 ya estaban bloqueadas (ej. se cerraron una por una antes con
    // el flujo viejo) no hay nada que volver a bloquear, pero igual se debe
    // continuar mas abajo para cerrar la seccion "determinations" completa
    // si todavia no se habia cerrado -- por eso no se corta aqui con error.
    if (!pendingSubsections.length && Boolean(gate?.quantitiesLocked)) {
      return res.status(409).json({ ok: false, message: "Determinaciones ya esta cerrada." });
    }

    // Primero se sincroniza cada subseccion pendiente y se valida que no
    // tenga cantidades en 0 -- sin persistir nada todavia, para que el
    // cierre sea todo-o-nada.
    const blocking = [];
    for (const subsection of pendingSubsections) {
      await businessCaseService.syncConsumptionQuantitiesFromSheet(id, {
        itemTypes: DETERMINATIONS_SHEET_ITEM_TYPES[subsection],
      });
      const currentConsumption = await businessCaseService.getConsumptionItems(id);
      const items = Array.isArray(currentConsumption?.items) ? currentConsumption.items : [];
      const scoped = items.filter((item) => subsectionFromConsumptionType(item?.type) === subsection);
      const hasPending = scoped.some((item) => !hasRequiredDeterminationsQuantity(item, subsection));
      if (scoped.length && hasPending) {
        blocking.push(subsection);
      }
    }

    if (blocking.length) {
      return res.status(409).json({
        ok: false,
        message: `Las siguientes subsecciones tienen items sin valor en PRODUCTO A ENTREGAR: ${blocking.join(", ")}. Completa esos valores en el Sheet antes de cerrar.`,
        details: { blocking },
      });
    }

    // Todas listas: proteger celdas en el Sheet (subsecciones sin items se
    // saltan, no hay nada que proteger) y marcar el lock.
    for (const subsection of pendingSubsections) {
      const currentConsumption = await businessCaseService.getConsumptionItems(id);
      const items = Array.isArray(currentConsumption?.items) ? currentConsumption.items : [];
      const scoped = items.filter((item) => subsectionFromConsumptionType(item?.type) === subsection);
      if (scoped.length) {
        const annualSync = await businessCaseService.syncConsumptionQuantitiesFromSheet(id, {
          itemTypes: DETERMINATIONS_SHEET_ITEM_TYPES[subsection],
          protectAnnualQuantities: subsection,
        });
        logger.info(
          {
            businessCaseId: id,
            subsection,
            protectedRanges: annualSync?.annualQuantityProtection?.protectedRanges || 0,
          },
          "[BC_SHEET] Cantidades anuales protegidas despues de cerrar todas las subsecciones tecnicas",
        );
      }
      locks[subsection] = true;
    }

    const now = new Date().toISOString();
    metadata.determinations_gate = {
      ...currentGate,
      section_locks: locks,
      updated_at: now,
    };
    // Patch minimo, solo determinations_gate (ver comentario en
    // lockDeterminationsSubsection).
    await businessCaseService.updateBusinessCase(id, {
      modern_bc_metadata: { determinations_gate: metadata.determinations_gate },
    });

    // NOTA: este endpoint solo bloquea controles + calibradores + materiales.
    // El cierre real de la seccion "determinations" (que habilita avanzar a
    // Inversiones) es una accion EXPLICITA y separada -- ver
    // completeAllTechnicalDeterminations / boton "Cerrar Determinaciones" en
    // el frontend -- nunca ocurre automaticamente como efecto secundario de
    // bloquear la ultima subseccion, para que el cierre sea una decision
    // deliberada del usuario, no un side-effect silencioso.
    const allTechnicalSubsectionsLocked = ["reactivos", ...DETERMINATIONS_TECHNICAL_SUBSECTIONS]
      .every((key) => locks[key] === true);
    if (allTechnicalSubsectionsLocked) {
      await workflowSlaService.notifyParticipants({
        businessCaseId: id,
        eventKey: "technical_determinations_completed",
        title: "Determinaciones tecnicas completadas",
        message:
          "Controles, calibradores y materiales fueron completados y validados. El siguiente paso es cerrar la seccion de Determinaciones para continuar con Inversiones.",
        actorEmail: req.user?.email || null,
        excludeActor: true,
      });
    }

    const refreshed = await businessCaseService.getBusinessCaseById(id);
    const updatedGate = determinationsGateService.buildGateInfo({
      businessCase: refreshed,
      role,
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    res.json({ ok: true, data: { subsections: pendingSubsections, locked: true, gate: updatedGate } });
  } catch (error) {
    logger.error({ error: error.message }, "Error cerrando todas las subsecciones tecnicas de determinaciones");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function requestDeterminationsSubsectionUnlock(req, res) {
  try {
    const { id } = req.params;
    const subsection = normalizeSubsectionKey(req.body?.subsection);
    const reason = String(req.body?.reason || "").trim();
    if (!DETERMINATIONS_SUBSECTIONS.has(subsection)) {
      return res.status(400).json({ ok: false, message: "Subseccion invalida. Usa: reactivos, controles, calibradores o materiales." });
    }
    if (!reason) {
      return res.status(400).json({ ok: false, message: "Debes incluir el motivo de la solicitud de desbloqueo." });
    }

    const role = resolveRequestRole(req);
    const businessCase = await businessCaseService.getBusinessCaseById(id);
    const metadata = preflowService.toObject(businessCase?.modern_bc_metadata);
    const currentGate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
      ? { ...metadata.determinations_gate }
      : {};
    const locks = resolveDeterminationsSectionLocks(currentGate);
    if (!locks[subsection]) {
      return res.status(409).json({ ok: false, message: `La subseccion ${subsection} ya esta desbloqueada.` });
    }

    const requests = resolveUnlockRequestList(currentGate);
    const hasPending = requests.some((entry) => entry.subsection === subsection && entry.status === "pending");
    if (hasPending) {
      return res.status(409).json({ ok: false, message: `Ya existe una solicitud pendiente para desbloquear ${subsection}.` });
    }

    const created = {
      id: buildUnlockRequestId(subsection),
      subsection,
      status: "pending",
      requested_at: new Date().toISOString(),
      requested_by_email: req.user?.email || null,
      requested_by_role: role || null,
      reason,
      resolved_at: null,
      resolved_by_email: null,
      resolution_notes: "",
    };

    metadata.determinations_gate = {
      ...currentGate,
      unlock_requests: [...requests, created],
      updated_at: new Date().toISOString(),
    };
    // Patch minimo, solo determinations_gate (ver comentario en
    // applyDeterminationsCompletionTransition).
    await businessCaseService.updateBusinessCase(id, {
      modern_bc_metadata: { determinations_gate: metadata.determinations_gate },
    });

    try {
      const targets = await getUsersByRoles(["jefe_comercial"]);
      await Promise.all(
        targets.map((target) =>
          notificationManager.sendNotification({
            userId: target.id,
            template: "custom_html",
            customTitle: `Solicitud de desbloqueo: ${subsection}`,
            customMessage:
              `${req.user?.email || "Usuario"} solicito desbloquear la subseccion ${subsection} del BC de ${businessCase?.client_name || "Cliente pendiente"}. Motivo: ${reason}`,
            email: true,
            chat: true,
            source: "business_case.determinations_unlock_request",
            data: { email_subject: `Business Case ${businessCase?.client_name || "Cliente pendiente"} - Desbloqueo de ${subsection}` },
            meta: {
              businessCaseId: id,
              subsection,
              requestedBy: req.user?.email || null,
              requestId: created.id,
            },
          }).catch(() => null),
        ),
      );
    } catch (_notifyErr) {}

    const refreshed = await businessCaseService.getBusinessCaseById(id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: refreshed,
      role,
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    return res.json({ ok: true, data: { request: created, gate } });
  } catch (error) {
    logger.error({ error: error.message }, "Error requesting determinations subsection unlock");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function resolveDeterminationsSubsectionUnlock(req, res) {
  try {
    const { id } = req.params;
    const role = resolveRequestRole(req);
    if (!DETERMINATIONS_UNLOCK_DECIDER_ROLES.has(role)) {
      return res.status(403).json({ ok: false, message: "Solo jefe_comercial puede decidir solicitudes de desbloqueo." });
    }
    const requestId = String(req.body?.request_id || req.body?.requestId || "").trim();
    const approve = Boolean(req.body?.approve === true || String(req.body?.decision || "").toLowerCase() === "approve");
    const resolutionNotes = String(req.body?.resolution_notes || req.body?.resolutionNotes || "").trim();
    if (!requestId) {
      return res.status(400).json({ ok: false, message: "request_id es obligatorio." });
    }

    const businessCase = await businessCaseService.getBusinessCaseById(id);
    const metadata = preflowService.toObject(businessCase?.modern_bc_metadata);
    const currentGate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
      ? { ...metadata.determinations_gate }
      : {};
    const requests = resolveUnlockRequestList(currentGate);
    const index = requests.findIndex((entry) => entry.id === requestId);
    if (index < 0) {
      return res.status(404).json({ ok: false, message: "Solicitud no encontrada." });
    }
    if (requests[index].status !== "pending") {
      return res.status(409).json({ ok: false, message: "La solicitud ya fue resuelta." });
    }

    const now = new Date().toISOString();
    requests[index] = {
      ...requests[index],
      status: approve ? "approved" : "rejected",
      resolved_at: now,
      resolved_by_email: req.user?.email || null,
      resolution_notes: resolutionNotes,
    };

    const locks = resolveDeterminationsSectionLocks(currentGate);
    if (approve) {
      const sheetId = metadata?.bc_sheet_generation?.last?.sheet_id || null;
      if (sheetId) {
        await unprotectAnnualQuantityCellsForSubsection({
          sheetId,
          businessCaseId: id,
          subsection: requests[index].subsection,
        });
      }
      locks[requests[index].subsection] = false;
    }
    const allLockedAfterDecision = ["reactivos", "controles", "calibradores", "materiales"].every((key) => locks[key] === true);
    const nextPhase = allLockedAfterDecision ? "locked" : (locks.reactivos ? "technical_review" : "commercial_input");

    metadata.determinations_gate = {
      ...currentGate,
      unlock_requests: requests,
      section_locks: locks,
      quantities_locked: allLockedAfterDecision,
      phase: nextPhase,
      updated_at: now,
    };
    // Patch minimo, solo determinations_gate (ver comentario en
    // applyDeterminationsCompletionTransition).
    await businessCaseService.updateBusinessCase(id, {
      modern_bc_metadata: { determinations_gate: metadata.determinations_gate },
    });

    try {
      const targetEmail = requests[index].requested_by_email;
      if (targetEmail) {
        const users = await getUsersByRoles([
          "comercial", "acp_comercial", "backoffice_comercial", "backoffice", "jefe_tecnico", "tecnico",
        ]);
        const target = users.find((u) => String(u.email || "").toLowerCase() === targetEmail.toLowerCase());
        if (target?.id) {
          await notificationManager.sendNotification({
            userId: target.id,
            template: "custom_html",
            customTitle: `Solicitud de desbloqueo ${approve ? "aprobada" : "rechazada"}`,
            customMessage: `La solicitud para ${requests[index].subsection} del BC de ${businessCase?.client_name || "Cliente pendiente"} fue ${approve ? "aprobada" : "rechazada"}.`,
            email: true,
            chat: true,
            source: "business_case.determinations_unlock_resolved",
            data: { email_subject: `Business Case ${businessCase?.client_name || "Cliente pendiente"} - Desbloqueo ${approve ? "aprobado" : "rechazado"}` },
            meta: { businessCaseId: id, requestId, approved: approve },
          }).catch(() => null);
        }
      }
    } catch (_notifyErr) {}

    const refreshed = await businessCaseService.getBusinessCaseById(id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: refreshed,
      role,
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    return res.json({ ok: true, data: { request: requests[index], gate } });
  } catch (error) {
    logger.error({ error: error.message }, "Error resolving determinations subsection unlock");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function reopenDeterminationsCommercial(req, res) {
  try {
    const { id } = req.params;
    const role = resolveRequestRole(req);
    if (!DETERMINATIONS_UNLOCK_DECIDER_ROLES.has(role)) {
      return res.status(403).json({ ok: false, message: "Solo jefe_comercial puede reabrir la fase comercial de determinaciones." });
    }
    const businessCase = await businessCaseService.getBusinessCaseById(id);
    const metadata = preflowService.toObject(businessCase?.modern_bc_metadata);
    const currentGate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
      ? { ...metadata.determinations_gate }
      : {};
    const currentPhase = String(currentGate?.phase || "commercial_input").toLowerCase();
    if (currentPhase !== "technical_review") {
      return res.status(409).json({ ok: false, message: "Solo se puede reabrir cuando la fase está en revisión técnica (después de terminar comercial)." });
    }
    const now = new Date().toISOString();
    const locks = resolveDeterminationsSectionLocks(currentGate);
    locks.reactivos = false;
    const sheetId = metadata?.bc_sheet_generation?.last?.sheet_id || null;
    if (sheetId) {
      await unprotectAnnualQuantityCellsForSubsection({
        sheetId,
        businessCaseId: id,
        subsection: "reactivos",
      });
    }
    metadata.determinations_gate = {
      ...currentGate,
      phase: "commercial_input",
      quantities_locked: false,
      section_locks: locks,
      completed_commercial_at: null,
      completed_commercial_by_role: null,
      completed_commercial_by_email: null,
      reopened_commercial_at: now,
      reopened_commercial_by_role: role,
      reopened_commercial_by_email: req.user?.email || null,
      updated_at: now,
    };
    // Patch minimo, solo determinations_gate (ver comentario en
    // applyDeterminationsCompletionTransition).
    await businessCaseService.updateBusinessCase(id, {
      modern_bc_metadata: { determinations_gate: metadata.determinations_gate },
    });
    const refreshed = await businessCaseService.getBusinessCaseById(id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: refreshed,
      role,
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    return res.json({ ok: true, data: { gate } });
  } catch (error) {
    logger.error({ error: error.message }, "Error reopening commercial determinations phase");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

// La ventana comercial (48h desde subir el documento estadistico, para
// sincronizar+validar reactivos) no tenia forma de renovarse si vencia antes
// de validar -- reopenDeterminationsCommercial solo aplica DESPUES de
// validar (fase technical_review). Sin esto el BC quedaba bloqueado para
// siempre: canEditDeterminations en el gate exige !expired, asi que ni el
// boton de validar ni el mensaje de "falta sincronizar" se mostraban.
async function renewDeterminationsCommercialWindow(req, res) {
  try {
    const { id } = req.params;
    const role = resolveRequestRole(req);
    if (role !== "jefe_comercial" && role !== "jefe_de_comercial") {
      return res.status(403).json({ ok: false, message: "Solo jefe_comercial puede renovar la ventana comercial de determinaciones." });
    }
    const businessCase = await businessCaseService.getBusinessCaseById(id);
    const currentDocument = await determinationsGateService.getCurrentDocument(id);
    const gate = determinationsGateService.buildGateInfo({ businessCase, role, currentDocument });
    if (gate.phase !== "commercial_input") {
      return res.status(409).json({
        ok: false,
        message: "Solo se puede renovar la ventana mientras la fase comercial esta activa (aun no se valida reactivos).",
      });
    }
    if (!gate.isExpired) {
      return res.status(409).json({ ok: false, message: "La ventana comercial aun no ha vencido." });
    }

    const metadata = preflowService.toObject(businessCase?.modern_bc_metadata);
    const currentGate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
      ? { ...metadata.determinations_gate }
      : {};
    const now = new Date();
    const deadlineAt = new Date(now.getTime() + determinationsGateService.DETERMINATIONS_DEADLINE_HOURS * 60 * 60 * 1000);
    metadata.determinations_gate = {
      ...currentGate,
      deadline_at: deadlineAt.toISOString(),
      is_expired: false,
      expired_at: null,
      expired_notified_at: null,
      renewed_commercial_at: now.toISOString(),
      renewed_commercial_by_role: role,
      renewed_commercial_by_email: req.user?.email || null,
      updated_at: now.toISOString(),
    };
    // Patch minimo, solo determinations_gate (ver comentario en
    // applyDeterminationsCompletionTransition).
    await businessCaseService.updateBusinessCase(id, {
      modern_bc_metadata: { determinations_gate: metadata.determinations_gate },
    });

    const refreshed = await businessCaseService.getBusinessCaseById(id);
    const updatedGate = determinationsGateService.buildGateInfo({
      businessCase: refreshed,
      role,
      currentDocument,
    });
    return res.json({ ok: true, data: { gate: updatedGate } });
  } catch (error) {
    logger.error({ error: error.message }, "Error renewing commercial determinations window");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function uploadDeterminationsStatDocument(req, res) {
  let idempotencySession = null;
  try {
    const { id } = req.params;
    const file = req.file;
    const role = resolveRequestRole(req);
    if (!determinationsGateService.isUploadRole(role)) {
      return res.status(403).json({
        ok: false,
        message: "Solo el usuario comercial puede subir el documento estadistico.",
      });
    }
    if (!file || !file.buffer) {
      return res.status(400).json({ ok: false, message: "Debe adjuntar un archivo valido." });
    }
    if (Number(file.size || 0) > 15 * 1024 * 1024) {
      return res.status(400).json({ ok: false, message: "El archivo supera el limite de 15MB." });
    }
    const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    idempotencySession = await startIdempotentWrite({
      req,
      operationScope: "bc.determinations.upload_document",
      businessCaseId: id,
      payload: {
        file_name: file.originalname || null,
        file_mime: file.mimetype || null,
        file_size: Number(file.size || 0),
        file_hash: fileHash,
      },
    });
    if (idempotencySession.replay) {
      applyResponseHeadersFromBody(res, idempotencySession.replayPayload);
      return res.status(idempotencySession.replayStatus).json(idempotencySession.replayPayload);
    }

    const bc = await businessCaseService.getBusinessCaseById(id);
    const uploadReadiness = await buildDeterminationsUploadReadiness({
      businessCaseId: id,
      businessCase: bc,
      role,
    });
    if (uploadReadiness.preflowExpired) {
      return res.status(409).json({
        ok: false,
        message: uploadReadiness.message,
      });
    }
    if (uploadReadiness.missingSectionKeys.length) {
      return res.status(409).json({
        ok: false,
        message: uploadReadiness.message,
        missingSections: uploadReadiness.missingSections,
      });
    }
    if (uploadReadiness.preflowExpired) {
      return res.status(409).json({
        ok: false,
        message:
          "La ventana de 48 horas del comercial expiró. No se puede subir el documento de estadística fuera del plazo.",
      });
    }
    const requiredBeforeUpload = [];
    const readiness = uploadReadiness.readiness;
    const missingRequired = requiredBeforeUpload.filter((sectionKey) => !readiness?.[sectionKey]);
    if (missingRequired.length) {
      return res.status(409).json({
        ok: false,
        message:
          `Debes completar las secciones previas hasta LIS antes de subir el documento estadístico. Pendientes: ${missingRequired.join(", ")}.`,
      });
    }
    let preflowProcessResult = null;
    try {
      preflowProcessResult = await preflowService.ensurePreflowWorkspaceProcess({
        businessCaseId: id,
        actorUser: req.user,
        durationHours: PRE_BC_DURATION_HOURS,
      });
    } catch (preflowError) {
      logger.warn(
        { error: preflowError.message, businessCaseId: id },
        "No se pudo iniciar automaticamente el proceso de compras tras carga de estadistica",
      );
      preflowProcessResult = {
        skipped: true,
        reason: "auto_process_start_failed",
        message: preflowError.message,
      };
    }
    const refreshedAfterProcess = await businessCaseService.getBusinessCaseById(id);
    if (isPublicBusinessCase(refreshedAfterProcess?.bc_purchase_type) && !hasTextValue(refreshedAfterProcess?.process_code)) {
      return res.status(409).json({
        ok: false,
        message: "El proceso no se pudo crear correctamente. Intente nuevamente.",
      });
    }
    const currentDocument = await determinationsGateService.getCurrentDocument(id);
    const isSameCurrentHash = String(currentDocument?.document_hash_sha256 || "").toLowerCase() === String(fileHash || "").toLowerCase();
    if (isSameCurrentHash) {
      // Mismo intento de auto-avance que en el camino de subida nueva (ver
      // mas abajo) -- sin esto, reintentar con el mismo archivo (hash igual)
      // nunca dispara la transicion de estado.
      try {
        const currentState = await BusinessCaseStateMachine.getCurrentState(id);
        if (currentState === STATES.DRAFT_INICIAL) {
          await BusinessCaseStateMachine.transition(
            id,
            STATES.DATOS_BASE_COMPLETOS,
            req.user?.id,
            "stat_document_reused_same_hash",
          );
        }
      } catch (transitionError) {
        logger.warn(
          { error: transitionError.message, businessCaseId: id },
          "No se pudo avanzar automaticamente a DATOS_BASE_COMPLETOS (documento reutilizado)",
        );
      }
      await notifyDeterminationsDocumentUploaded({
        businessCaseId: id,
        actor: req.user?.email || role,
      }).catch((notifyError) => {
        logger.warn(
          { error: notifyError.message, businessCaseId: id },
          "No se pudo notificar la reutilizacion del documento estadistico",
        );
      });
      const refreshedForNotification = await businessCaseService.getBusinessCaseById(id);
      const gate = determinationsGateService.buildGateInfo({
        businessCase: refreshedForNotification,
        role,
        currentDocument,
      });
      const responseBody = {
        ok: true,
        data: gate,
        meta: {
          reused_existing_document: true,
          reason: "same_sha256_hash",
          process_result: preflowProcessResult,
          sla_trigger: "pending_determinations_validation",
        },
      };
      await completeIdempotentWrite(idempotencySession, responseBody, 200);
      return res.json(responseBody);
    }
    const metadata = refreshedAfterProcess?.modern_bc_metadata && typeof refreshedAfterProcess.modern_bc_metadata === "object"
      ? { ...refreshedAfterProcess.modern_bc_metadata }
      : {};
    const previousGate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
      ? { ...metadata.determinations_gate }
      : {};

    const driveTarget = await ensureBusinessCaseDriveFolder({
      businessCaseId: id,
      clientName: refreshedAfterProcess?.client_name || "Cliente",
      bcPurchaseType: refreshedAfterProcess?.bc_purchase_type || "public",
      existingFolderId: refreshedAfterProcess?.drive_folder_id || null,
      persist: true,
    });
    const determinationsFolder = await ensureFolder("Determinaciones", driveTarget.folderId);
    const uploaded = await uploadBase64File(
      file.originalname || `documento-estadistico-${id}.pdf`,
      Buffer.from(file.buffer).toString("base64"),
      file.mimetype || "application/octet-stream",
      determinationsFolder?.id,
    );

    const now = new Date();
    const deadlineAt = new Date(
      now.getTime() + determinationsGateService.DETERMINATIONS_DEADLINE_HOURS * 60 * 60 * 1000,
    );
    const driveLink =
      uploaded?.webViewLink ||
      uploaded?.webContentLink ||
      (uploaded?.id ? `https://drive.google.com/file/d/${uploaded.id}/view` : null);
    metadata.determinations_gate = {
      ...previousGate,
      enabled: true,
      enabled_at: now.toISOString(),
      deadline_at: deadlineAt.toISOString(),
      is_expired: false,
      expired_at: null,
      expired_notified_at: null,
      document: {
        name: file.originalname || uploaded?.name || "documento-estadistico",
        mime_type: file.mimetype || null,
        drive_file_id: uploaded?.id || null,
        drive_link: driveLink,
        uploaded_at: now.toISOString(),
        uploaded_by_id: req.user?.id || null,
        uploaded_by_email: req.user?.email || null,
      },
    };
    await determinationsGateService.saveCurrentDocument({
      businessCaseId: id,
      fileName: file.originalname || uploaded?.name || "documento-estadistico",
      mimeType: file.mimetype || null,
      fileSizeBytes: Number(file.size || 0),
      driveFileId: uploaded?.id || null,
      driveLink,
      documentHashSha256: fileHash,
      uploadedByUserId: req.user?.id || null,
      uploadedByEmail: req.user?.email || null,
      metadata: { source: "business_case_determinations_gate" },
    });

    // Patch minimo, solo determinations_gate (ver comentario en
    // applyDeterminationsCompletionTransition).
    await businessCaseService.updateBusinessCase(id, {
      modern_bc_metadata: { determinations_gate: metadata.determinations_gate },
    });

    // Subir el documento estadistico es la señal de que los datos base ya
    // estan completos -- avanzar automaticamente DRAFT_INICIAL ->
    // DATOS_BASE_COMPLETOS. Antes de este fix, canonical_state se quedaba
    // atascado en DRAFT_INICIAL para siempre (nada mas lo movia), bloqueando
    // la seccion de determinaciones para TODOS los roles (businessCasePermissions.js
    // bloquea DETERMINATIONS en DRAFT_INICIAL por diseño). No fatal si la
    // transicion no esta lista (ej: falta client_id/sercof_code) -- el
    // usuario debe completar esos datos y la transicion se reintentara la
    // proxima vez que se llame a este endpoint (es idempotente).
    try {
      const currentState = await BusinessCaseStateMachine.getCurrentState(id);
      if (currentState === STATES.DRAFT_INICIAL) {
        await BusinessCaseStateMachine.transition(
          id,
          STATES.DATOS_BASE_COMPLETOS,
          req.user?.id,
          "stat_document_uploaded",
        );
      }
    } catch (transitionError) {
      logger.warn(
        { error: transitionError.message, businessCaseId: id },
        "No se pudo avanzar automaticamente a DATOS_BASE_COMPLETOS tras cargar el documento estadistico",
      );
    }

    await notifyDeterminationsDocumentUploaded({
      businessCaseId: id,
      actor: req.user?.email || role,
    }).catch((notifyError) => {
      logger.warn(
        { error: notifyError.message, businessCaseId: id },
        "No se pudo notificar la carga del documento estadistico",
      );
    });

    const refreshed = await businessCaseService.getBusinessCaseById(id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: refreshed,
      role,
      now,
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    const responseBody = {
      ok: true,
      data: gate,
      meta: {
        process_result: preflowProcessResult,
        sla_trigger: "pending_determinations_validation",
      },
    };
    await completeIdempotentWrite(idempotencySession, responseBody, 200);
    res.json(responseBody);
  } catch (error) {
    await failIdempotentWrite(idempotencySession, error);
    logger.error({ error: error.message }, "Error uploading determinations stat document");
    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo cargar el documento estadistico",
    });
  }
}

async function clearSheetTemplateCache(req, res) {
  try {
    clearSheetCaches();
    logger.info({ role: resolveRequestRole(req), user: req.user?.email }, "[SheetGen] Cache de plantilla invalidado manualmente");
    return res.json({ ok: true, message: "Cache de plantilla de Sheets limpiado. La próxima generación cargará el template y aliases actualizados desde disco." });
  } catch (err) {
    logger.error({ err }, "Error al limpiar cache de plantilla de Sheets");
    return res.status(500).json({ ok: false, message: "Error interno al limpiar el cache." });
  }
}

function _normalizeForMatch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function _normalizeItemId(value) {
  return String(value || "").replace(/\.0+$/, "").replace(/[^0-9a-zA-Z\-]/g, "").toLowerCase();
}

function _getItemSection(itemType) {
  const t = String(itemType || "").toLowerCase();
  if (t === "reactivo" || t === "determinacion") return "reactivos";
  if (t === "calibrador") return "calibradores";
  if (t === "control") return "controles";
  if (t === "material" || t === "consumible") return "materiales";
  return "otros";
}

function _detectXlsxColumns(data) {
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(6, data.length); i++) {
    const textCount = (data[i] || []).filter((c) => typeof c === "string" && c.trim().length > 1).length;
    if (textCount >= 2) { headerRowIdx = i; break; }
  }
  const headers = (data[headerRowIdx] || []).map((h) => _normalizeForMatch(String(h || "")));
  let idCol = null, nameCol = null, qtyCol = null;
  headers.forEach((h, i) => {
    if (idCol === null && (h === "id" || h === "codigo" || h === "idfabricante" || h === "itemid" || h === "codigoproducto")) idCol = i;
    if (nameCol === null && (h === "nombre" || h === "reactivo" || h === "descripcion" || h === "producto" || h === "item" || h === "name" || h === "material" || h === "control" || h === "calibrador")) nameCol = i;
    if (qtyCol === null && (h.includes("anual") || h.includes("cantidad") || h.includes("detano") || h === "qty" || h === "cantidad" || h === "anual")) qtyCol = i;
  });
  if (qtyCol === null) {
    const sampleStart = headerRowIdx + 1;
    for (let col = 0; col < (data[sampleStart] || []).length; col++) {
      if (col === idCol) continue;
      const samples = data.slice(sampleStart, sampleStart + 5).map((r) => String(r[col] || "").replace(",", ".").trim());
      const numericCount = samples.filter((v) => v && /^\d+(\.\d+)?$/.test(v)).length;
      if (numericCount >= Math.min(2, samples.filter(Boolean).length)) { qtyCol = col; break; }
    }
  }
  return { headerRowIdx, idCol, nameCol, qtyCol };
}

async function parseDeterminationsQuantitiesFile(req, res) {
  try {
    const role = resolveRequestRole(req);
    const { id: businessCaseId } = req.params;
    const sectionFilter = String(req.body?.section || req.query?.section || "").toLowerCase() || null;
    const businessCase = await businessCaseService.getBusinessCaseById(businessCaseId);
    const isPublic = normalizePurchaseTypeForGate(businessCase?.bc_purchase_type) === "public";
    const allowedReactivoRoles = isPublic ? DETERMINATIONS_REACTIVO_PUBLIC_ROLES : DETERMINATIONS_REACTIVO_PRIVATE_ROLES;
    const appliesReactivoPolicy = !sectionFilter || sectionFilter === "reactivos" || sectionFilter === "reactivo";
    if (appliesReactivoPolicy && !allowedReactivoRoles.has(role)) {
      return res.status(403).json({
        ok: false,
        message: isPublic
          ? "Solo jefe_comercial o acp_comercial pueden importar cantidades de reactivos en un proceso publico."
          : "Solo jefe_comercial o backoffice_comercial pueden importar cantidades de reactivos en un proceso privado.",
      });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ ok: false, message: "No se recibio ningun archivo." });
    }

    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: "buffer", raw: false });
    } catch {
      return res.status(400).json({ ok: false, message: "No se pudo leer el archivo. Verifica que sea un Excel o CSV valido." });
    }

    const { rows: bcItems } = await db.query(
      `SELECT item_key, item_id, name, item_type, equipment_name FROM bc_consumption_items WHERE business_case_id = $1`,
      [businessCaseId],
    );
    if (!bcItems.length) {
      return res.status(404).json({ ok: false, message: "No hay items de determinaciones para este Business Case." });
    }

    const byItemId = new Map();
    const byNormName = new Map();
    bcItems.forEach((item) => {
      if (item.item_id) byItemId.set(_normalizeItemId(item.item_id), item);
      const normName = _normalizeForMatch(item.name);
      if (normName && !byNormName.has(normName)) byNormName.set(normName, item);
    });

    const matched = [];
    const seenKeys = new Set();

    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
      if (!data.length) continue;

      const { headerRowIdx, idCol, nameCol, qtyCol } = _detectXlsxColumns(data);
      if (qtyCol === null) continue;

      for (let i = headerRowIdx + 1; i < data.length; i++) {
        const row = data[i];
        const idVal = idCol !== null ? _normalizeItemId(String(row[idCol] || "")) : "";
        const nameVal = nameCol !== null ? _normalizeForMatch(String(row[nameCol] || "")) : "";
        const qtyRaw = String(row[qtyCol] || "").replace(",", ".").replace(/[^0-9.]/g, "");
        const qty = parseFloat(qtyRaw);
        if (!Number.isFinite(qty) || qty < 0) continue;

        const found = (idVal ? byItemId.get(idVal) : null) || (nameVal ? byNormName.get(nameVal) : null);
        if (!found || seenKeys.has(found.item_key)) continue;
        const section = _getItemSection(found.item_type);
        if (sectionFilter && section !== sectionFilter) continue;
        seenKeys.add(found.item_key);
        matched.push({
          item_key: found.item_key,
          item_name: found.name,
          item_type: found.item_type,
          section,
          annual_qty: Math.round(qty),
        });
      }
    }

    return res.json({ ok: true, data: { matched, total_bc_items: bcItems.length } });
  } catch (err) {
    logger.error({ err }, "Error al parsear archivo de importacion de cantidades");
    return res.status(500).json({ ok: false, message: "Error interno al procesar el archivo." });
  }
}

/**
 * Get data ownership information
 */
async function getDataOwnership(req, res) {
  try {
    const { id } = req.params;

    // Helper function to normalize dates (reuse from service if available)
    function toIso(input) {
      if (!input) return null;
      if (input instanceof Date && !isNaN(input)) return input.toISOString();
      if (typeof input === 'string') {
        try {
          const parsed = new Date(input);
          if (!isNaN(parsed)) return parsed.toISOString();
          return null;
        } catch { return null; }
      }
      if (typeof input === 'number') {
        const timestamp = input < 1e12 ? input * 1000 : input;
        const date = new Date(timestamp);
        if (!isNaN(date)) return date.toISOString();
        return null;
      }
      // dayjs/moment objects
      if (input && typeof input === 'object' && input.$d instanceof Date) {
        return input.$d.toISOString();
      }
      if (input && typeof input === 'object' && typeof input.toDate === 'function') {
        const date = input.toDate();
        if (date instanceof Date && !isNaN(date)) return date.toISOString();
        return null;
      }
      // Objeto vacío {} -> null (problema actual)
      if (input && typeof input === 'object' && Object.keys(input).length === 0) {
        return null;
      }
      return null;
    }

    const now = new Date();

    // Simplified ownership data - in production this would check actual ownership tables
    const ownership = {
      businessCaseId: id,
      owner: req.user?.email || 'system',
      sections: {
        general: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        lab: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        equipment: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        lis: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        determinations: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        investments: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        prices: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        calculations: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        dispatch_workspace: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        rentability: { owner: req.user?.email || 'system', lastModified: toIso(now) }
      }
    };

    res.json({ ok: true, data: ownership });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting data ownership');
    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error obteniendo información de ownership"
    });
  }
}

async function lockSection(req, res) {
  try {
    const { id, section } = req.params;
    const canonicalSection = SECTION_ALIASES[section] || section;
    const userRole = String(req.user?.role || "").toLowerCase();

    // BUG-03: backoffice solo puede bloquear secciones en BC de compra PRIVADA
    if (BACKOFFICE_LOCK_ROLES.has(userRole)) {
      const bc = await businessCaseService.getBusinessCaseById(id);
      const purchaseType = String(bc?.bc_purchase_type || bc?.purchase_type || bc?.type || "").toLowerCase();
      if (!PRIVATE_PURCHASE_TYPES.has(purchaseType)) {
        return res.status(403).json({
          ok: false,
          message: "El rol backoffice solo puede bloquear secciones en Business Cases de compra privada.",
        });
      }
    }

    await BusinessCaseDataOwnership.lockSection(id, canonicalSection, req.user, null, {
      source: "workspace",
    });
    await notifySectionLocked({
      businessCaseId: id,
      section: canonicalSection,
      actor: req.user?.email || "system",
    });

    const lockMap = await BusinessCaseDataOwnership.getLockStatus(id);
    const allLocked = PHASE1_SECTIONS.every((sec) => lockMap?.[sec]?.isLocked);
    if (allLocked) {
      try {
        const currentState = await BusinessCaseStateMachine.getCurrentState(id);
        if (currentState === STATES.DRAFT_INICIAL) {
          await BusinessCaseStateMachine.transition(
            id,
            STATES.DATOS_BASE_COMPLETOS,
            req.user?.id,
            "Secciones bloqueadas por revision",
            { source: "workspace", actor: req.user?.email || "system" }
          );
        }
      } catch (error) {
        logger.warn({ error: error.message, businessCaseId: id }, "No se pudo avanzar estado en fase 1");
      }

      await notifyPhase1Completed({
        businessCaseId: id,
        actor: req.user?.email || "system",
      });
    }

    res.json({ ok: true, data: { section: canonicalSection, locked: true } });
  } catch (error) {
    logger.error({ error: error.message }, "Error locking section");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function unlockSection(req, res) {
  try {
    const { id, section } = req.params;
    const canonicalSection = SECTION_ALIASES[section] || section;
    const userRole = String(req.user?.role || "").toLowerCase();

    // BUG-03: backoffice solo puede desbloquear secciones en BC de compra PRIVADA
    if (BACKOFFICE_LOCK_ROLES.has(userRole)) {
      const bc = await businessCaseService.getBusinessCaseById(id);
      const purchaseType = String(bc?.bc_purchase_type || bc?.purchase_type || bc?.type || "").toLowerCase();
      if (!PRIVATE_PURCHASE_TYPES.has(purchaseType)) {
        return res.status(403).json({
          ok: false,
          message: "El rol backoffice solo puede desbloquear secciones en Business Cases de compra privada.",
        });
      }
    }

    await BusinessCaseDataOwnership.unlockSection(id, canonicalSection, req.user, null, {
      source: "workspace",
    });
    res.json({ ok: true, data: { section: canonicalSection, locked: false } });
  } catch (error) {
    logger.error({ error: error.message }, "Error unlocking section");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function requestPreflowReopen(req, res) {
  try {
    const { id } = req.params;
    const { reason, sections = [] } = req.body || {};
    const result = await preflowService.requestPreflowReopen({
      businessCaseId: id,
      actorUser: req.user,
      reason,
      sections: normalizeSectionList(sections),
    });
    const businessCase = await businessCaseService.getBusinessCaseById(id);
    const preflow = preflowService.buildPreflowInfo(businessCase, {}, new Date());
    res.json({
      ok: true,
      data: {
        request: result.request,
        preflow,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, "Error requesting Business Case preflow reopen");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function resolvePreflowReopen(req, res) {
  try {
    const { id } = req.params;
    const {
      approved,
      additional_hours = 0,
      notes = "",
      sections = [],
    } = req.body || {};
    const result = await preflowService.resolvePreflowReopen({
      businessCaseId: id,
      actorUser: req.user,
      approved: Boolean(approved),
      additionalHours: additional_hours,
      notes,
      sections: normalizeSectionList(sections),
    });
    const businessCase = await businessCaseService.getBusinessCaseById(id);
    const preflow = preflowService.buildPreflowInfo(businessCase, {}, new Date());
    res.json({
      ok: true,
      data: {
        approved: result.approved,
        deadlineAt: result.deadlineAt,
        request: result.request,
        preflow,
        sheetSync: result.sheetSync || null,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, "Error resolving Business Case preflow reopen");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

// BC-16: Roles que pueden solicitar apelación de factibilidad rechazada
const FEASIBILITY_APPEAL_REQUESTER_ROLES = new Set(["comercial", "asesor_comercial", "analista_comercial"]);
// BC-16: Roles que pueden resolver (aprobar/rechazar) una apelación
const FEASIBILITY_APPEAL_RESOLVER_ROLES = new Set(["jefe_comercial", "jefe_de_comercial", "gerencia", "gerencia_general"]);

// ──────────────────────────────────────────────────────────────────────────────
// BC-17: Helpers para pausar/desbloquear/cancelar expedientes vinculados al BC
// ──────────────────────────────────────────────────────────────────────────────

/** Asegura que la columna paused_reason existe en ambas tablas (idempotente) */
async function ensureExpedientPausedReasonColumns() {
  await db.query(`
    ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS paused_reason TEXT DEFAULT NULL
  `);
  await db.query(`
    ALTER TABLE equipment_purchase_requests
      ADD COLUMN IF NOT EXISTS paused_reason TEXT DEFAULT NULL
  `);
}

/**
 * Pausa todos los expedientes vinculados al BC (private_purchase_requests + equipment_purchase_requests).
 * Llamado cuando se registra una apelación de factibilidad pendiente.
 */
async function notifyLinkedExpedientOwners(rows, { title, message, type = "alert", priority = 2, source }) {
  const ownerIds = new Set();
  for (const row of rows) {
    if (row.created_by) ownerIds.add(row.created_by);
    if (row.assigned_to) ownerIds.add(row.assigned_to);
  }
  await Promise.all(
    Array.from(ownerIds).map((userId) =>
      notificationManager.sendNotification({
        userId,
        customTitle: title,
        customMessage: message,
        type,
        priority,
        source,
        email: true,
        chat: false,
      }).catch(() => null),
    ),
  );
}

async function pauseLinkedExpedients(bcId) {
  try {
    await ensureExpedientPausedReasonColumns();
    const { rows: pausedPrivate } = await db.query(
      `UPDATE private_purchase_requests
          SET paused_reason = 'feasibility_appeal_pending', updated_at = NOW()
        WHERE business_case_id = $1
          AND status NOT IN ('rejected', 'delivered_signed')
          AND paused_reason IS NULL
        RETURNING id, created_by`,
      [bcId],
    );
    const { rows: pausedPublic } = await db.query(
      `UPDATE equipment_purchase_requests
          SET paused_reason = 'feasibility_appeal_pending', updated_at = NOW()
        WHERE business_case_id = $1
          AND paused_reason IS NULL
        RETURNING id, created_by, assigned_to`,
      [bcId],
    );
    logger.info({ bcId }, "[BC-17] Expedientes pausados por apelación de factibilidad");

    // Nadie que gestiona esas compras se enteraba de que quedaron pausadas
    // por una apelacion del BC padre -- solo quedaba en logs.
    await notifyLinkedExpedientOwners([...pausedPrivate, ...pausedPublic], {
      title: "Expediente pausado por apelación de factibilidad",
      message: `Tu expediente de compra vinculado al Business Case ${bcId} quedó pausado mientras se resuelve una apelación de factibilidad.`,
      source: "business_case.feasibility.appeal_paused_expedient",
    });
  } catch (err) {
    logger.warn({ bcId, err }, "[BC-17] Error al pausar expedientes vinculados");
  }
}

/**
 * Despausa los expedientes vinculados al BC.
 * Llamado cuando la apelación es APROBADA (BC vuelve a evaluación) o en la resolución.
 */
async function unpauseLinkedExpedients(bcId) {
  try {
    const { rows: resumedPrivate } = await db.query(
      `UPDATE private_purchase_requests
          SET paused_reason = NULL, updated_at = NOW()
        WHERE business_case_id = $1
          AND paused_reason = 'feasibility_appeal_pending'
        RETURNING id, created_by`,
      [bcId],
    );
    const { rows: resumedPublic } = await db.query(
      `UPDATE equipment_purchase_requests
          SET paused_reason = NULL, updated_at = NOW()
        WHERE business_case_id = $1
          AND paused_reason = 'feasibility_appeal_pending'
        RETURNING id, created_by, assigned_to`,
      [bcId],
    );
    logger.info({ bcId }, "[BC-17] Expedientes despausados");

    await notifyLinkedExpedientOwners([...resumedPrivate, ...resumedPublic], {
      title: "Expediente reanudado",
      message: `Tu expediente de compra vinculado al Business Case ${bcId} se reanudó tras resolverse la apelación de factibilidad.`,
      type: "task",
      priority: 1,
      source: "business_case.feasibility.appeal_resumed_expedient",
    });
  } catch (err) {
    logger.warn({ bcId, err }, "[BC-17] Error al desbloquear expedientes vinculados");
  }
}

/**
 * Cancela los expedientes vinculados al BC.
 * Llamado cuando la apelación es RECHAZADA DEFINITIVAMENTE.
 */
async function cancelLinkedExpedients(bcId) {
  try {
    const { rows: cancelledPrivate } = await db.query(
      `UPDATE private_purchase_requests
          SET status = 'rejected',
              paused_reason = NULL,
              updated_at = NOW()
        WHERE business_case_id = $1
          AND status NOT IN ('rejected', 'delivered_signed')
        RETURNING id, created_by`,
      [bcId],
    );
    const { rows: cancelledPublic } = await db.query(
      `UPDATE equipment_purchase_requests
          SET status = 'rejected',
              paused_reason = NULL,
              updated_at = NOW()
        WHERE business_case_id = $1
          AND status NOT IN ('rejected', 'delivered', 'completed')
        RETURNING id, created_by, assigned_to`,
      [bcId],
    );
    logger.info({ bcId }, "[BC-17] Expedientes cancelados por rechazo definitivo de factibilidad");

    await notifyLinkedExpedientOwners([...cancelledPrivate, ...cancelledPublic], {
      title: "Expediente cancelado",
      message: `Tu expediente de compra vinculado al Business Case ${bcId} fue cancelado: la apelación de factibilidad fue rechazada definitivamente.`,
      source: "business_case.feasibility.appeal_cancelled_expedient",
    });
  } catch (err) {
    logger.warn({ bcId, err }, "[BC-17] Error al cancelar expedientes vinculados");
  }
}

/**
 * BC-16: comercial* solicita revisión de un BC no factible
 */
async function requestFeasibilityAppeal(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const userRole = String(req.user?.role || "").toLowerCase();

    if (!FEASIBILITY_APPEAL_REQUESTER_ROLES.has(userRole)) {
      return res.status(403).json({ ok: false, message: "Solo el rol comercial puede solicitar revisión de factibilidad." });
    }

    const bc = await businessCaseService.getBusinessCaseById(id);
    if (!bc) return res.status(404).json({ ok: false, message: "Business Case no encontrado." });

    const metadata = preflowService.toObject(bc?.modern_bc_metadata);
    const feasibility = (metadata?.feasibility && typeof metadata.feasibility === "object") ? metadata.feasibility : {};
    const decision = (feasibility?.decision && typeof feasibility.decision === "object") ? feasibility.decision : null;

    if (!decision?.decided_at) {
      return res.status(409).json({ ok: false, message: "El BC aún no tiene una decisión de factibilidad registrada." });
    }
    if (Boolean(decision?.is_feasible)) {
      return res.status(409).json({ ok: false, message: "El BC fue marcado como factible. Solo se puede apelar decisiones negativas." });
    }
    // BC-17: No se puede apelar si el rechazo ya es definitivo
    if (metadata?.feasibility_is_definitively_rejected) {
      return res.status(409).json({ ok: false, message: "La decisión de no factibilidad es definitiva y no puede ser apelada nuevamente." });
    }
    if (metadata?.feasibility_appeal?.status === "pending") {
      return res.status(409).json({ ok: false, message: "Ya existe una solicitud de revisión pendiente para este Business Case." });
    }

    const normalizedReason = String(reason || "").trim();
    if (!normalizedReason) {
      return res.status(400).json({ ok: false, message: "Debes ingresar el motivo de la solicitud de revisión." });
    }

    const appeal = {
      status: "pending",
      requested_at: new Date().toISOString(),
      requested_by_email: req.user?.email || null,
      requested_by_role: userRole,
      reason: normalizedReason,
    };
    await preflowService.updateBusinessCaseMetadata(id, { feasibility_appeal: appeal });

    // BC-17: Pausar los expedientes vinculados mientras la apelación está pendiente
    await pauseLinkedExpedients(id);

    // Notificar a jefe_comercial y gerencia
    try {
      const managers = await db.query(
        `SELECT id FROM users WHERE active = true AND lower(role) = ANY($1::text[])`,
        [["jefe_comercial", "jefe_de_comercial", "gerencia", "gerencia_general"]],
      );
      for (const mgr of managers.rows) {
        notificationManager.sendNotification({
          userId: mgr.id,
          customTitle: "Solicitud de revisión de factibilidad",
          customMessage: `${req.user?.email || "Un usuario"} solicita revisión del BC de ${bc.client_name || "Cliente pendiente"} marcado como no factible. Motivo: ${normalizedReason}`,
          type: "task",
          source: "business_case.feasibility.appeal_requested",
          priority: 2,
          email: true,
          chat: false,
          data: { email_subject: `Business Case ${bc.client_name || "Cliente pendiente"} - Apelación de factibilidad` },
          meta: { businessCaseId: id, appeal },
        });
      }
    } catch (_notifErr) {
      logger.warn({ businessCaseId: id }, "No se pudo enviar notificación de apelación de factibilidad");
    }

    return res.json({ ok: true, data: { appeal } });
  } catch (error) {
    logger.error({ error: error.message }, "Error requesting feasibility appeal");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

/**
 * BC-16: jefe_comercial/gerencia resuelve la apelación de factibilidad
 *   approved=true  → borra la decisión de factibilidad y reabre el workspace
 *   approved=false → marca la apelación como rechazada y notifica al comercial
 */
async function resolveFeasibilityAppeal(req, res) {
  try {
    const { id } = req.params;
    const { approved, notes } = req.body || {};
    const userRole = String(req.user?.role || "").toLowerCase();

    if (!FEASIBILITY_APPEAL_RESOLVER_ROLES.has(userRole)) {
      return res.status(403).json({ ok: false, message: "No tienes permisos para resolver apelaciones de factibilidad." });
    }

    const bc = await businessCaseService.getBusinessCaseById(id);
    if (!bc) return res.status(404).json({ ok: false, message: "Business Case no encontrado." });

    const metadata = preflowService.toObject(bc?.modern_bc_metadata);
    const appeal = metadata?.feasibility_appeal;
    if (!appeal || appeal.status !== "pending") {
      return res.status(409).json({ ok: false, message: "No existe una solicitud de revisión pendiente para este Business Case." });
    }

    const now = new Date().toISOString();
    const resolvedAppeal = {
      ...appeal,
      status: Boolean(approved) ? "approved" : "rejected",
      resolved_at: now,
      resolved_by_email: req.user?.email || null,
      resolved_by_role: userRole,
      resolution_notes: String(notes || "").trim(),
    };

    const metadataPatch = { feasibility_appeal: resolvedAppeal };

    if (Boolean(approved)) {
      // Reabrir workspace: borrar la decisión de factibilidad para permitir nueva evaluación
      const feasibility = (metadata?.feasibility && typeof metadata.feasibility === "object") ? { ...metadata.feasibility } : {};
      delete feasibility.decision;
      feasibility.closed = false;
      metadataPatch.feasibility = feasibility;
    } else {
      // BC-17: Rechazo definitivo — el jefe confirma que el BC no es factible
      metadataPatch.feasibility_is_definitively_rejected = true;
    }

    await preflowService.updateBusinessCaseMetadata(id, metadataPatch);

    // BC-17: Gestionar pausa de expedientes según la resolución
    if (Boolean(approved)) {
      // Aprobado → desbloquear expedientes para que continúen su flujo
      await unpauseLinkedExpedients(id);
    } else {
      // Rechazado definitivamente → desbloquear pausa Y cancelar expedientes
      await unpauseLinkedExpedients(id);
      await cancelLinkedExpedients(id);
    }

    // Notificar al solicitante
    try {
      const requesters = await db.query(
        `SELECT id FROM users WHERE active = true AND email = $1`,
        [appeal.requested_by_email],
      );
      for (const requester of requesters.rows) {
        notificationManager.sendNotification({
          userId: requester.id,
          customTitle: Boolean(approved) ? "Revisión de factibilidad aprobada" : "Revisión de factibilidad rechazada",
          customMessage: Boolean(approved)
            ? `${req.user?.email || "Jefe comercial"} abrió la revisión del BC de ${bc.client_name || "Cliente pendiente"}. La factibilidad puede ser evaluada nuevamente.`
            : `${req.user?.email || "Jefe comercial"} rechazó tu solicitud de revisión del BC de ${bc.client_name || "Cliente pendiente"}.${resolvedAppeal.resolution_notes ? ` Motivo: ${resolvedAppeal.resolution_notes}` : ""}`,
          type: Boolean(approved) ? "success" : "alert",
          source: Boolean(approved)
            ? "business_case.feasibility.appeal_approved"
            : "business_case.feasibility.appeal_rejected",
          priority: 2,
          email: true,
          chat: false,
          data: { email_subject: `Business Case ${bc.client_name || "Cliente pendiente"} - Apelación de factibilidad ${Boolean(approved) ? "aprobada" : "rechazada"}` },
          meta: { businessCaseId: id, appeal: resolvedAppeal },
        });
      }
    } catch (_notifErr) {
      logger.warn({ businessCaseId: id }, "No se pudo notificar resolución de apelación de factibilidad");
    }

    return res.json({ ok: true, data: { appeal: resolvedAppeal, approved: Boolean(approved) } });
  } catch (error) {
    logger.error({ error: error.message }, "Error resolving feasibility appeal");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

/**
 * Record section completion
 */
async function recordSectionCompletion(req, res) {
  try {
    const { id } = req.params;
    const { section, reason } = req.body;
    const user = req.user;

    // Validate section exists
    const validSections = ['general', 'lab', 'equipment', 'lis', 'determinations', 'requirement', 'investments', 'prices', 'calculations', 'dispatch_workspace', 'feasibility', 'rentability'];
    if (!validSections.includes(section)) {
      return res.status(400).json({ ok: false, message: "Invalid section name" });
    }

    const canonicalSection = SECTION_ALIASES[section] || section;
    const businessCase = await businessCaseService.getBusinessCaseById(id);
    const currentState = String(businessCase?.canonical_state || businessCase?.bc_stage || "draft").toUpperCase();
    const userRole = resolveRequestRole(req) || user?.role || user?.role_name || "comercial";
    const actorId = user?.id ?? user?.sub ?? user?.user_id ?? user?.uuid ?? null;

    if (canonicalSection === "determinations") {
      const profile = buildDeterminationsCompletionProfile({
        role: userRole,
        bcPurchaseType: businessCase?.bc_purchase_type,
      });
      // Cierre comercial: NO marca la seccion como completada.
      // Solo transiciona a revision tecnica y mantiene determinaciones "en curso".
      if (profile.actor === "commercial") {
        await applyDeterminationsCompletionTransition({
          businessCase,
          role: userRole,
          user,
        });
        const refreshed = await businessCaseService.getBusinessCaseById(id);
        const gate = determinationsGateService.buildGateInfo({
          businessCase: refreshed,
          role: "jefe_tecnico",
          currentDocument: await determinationsGateService.getCurrentDocument(id),
        });
        return res.json({
          ok: true,
          data: {
            section: canonicalSection,
            completed: false,
            transitionedTo: "technical_review",
            reviewRole: gate?.phase === "technical_review" ? "jefe_tecnico" : null,
            deadlineAt: gate?.deadlineAt || null,
            reason,
          },
        });
      }
    }

    if (canonicalSection === "investments") {
      if (!INVESTMENT_COMPLETE_ROLES.has(userRole)) {
        return res.status(403).json({
          ok: false,
          message: "Solo ACP Comercial, Jefe Comercial o Jefe de Operaciones pueden cerrar la seccion de inversiones.",
          code: "INVESTMENTS_COMPLETE_ROLE_REQUIRED",
        });
      }
      const selectedInvestments = await investmentsService.getInvestmentValuesByClass(id, "financiera");
      const missingPrices = (selectedInvestments || []).filter((row) => {
        const price = Number(row?.unit_price ?? 0);
        return !Number.isFinite(price) || price <= 0;
      });
      if (missingPrices.length > 0) {
        return res.status(409).json({
          ok: false,
          message: `No se puede cerrar inversiones: faltan ${missingPrices.length} precio(s) financiero(s) en el carrito seleccionado.`,
          code: "INVESTMENTS_PRICES_REQUIRED",
        });
      }
    }

    await BusinessCaseDataOwnership.recordSectionCompletion(
      id,
      canonicalSection,
      actorId,
      userRole,
      currentState,
      {
        source: "workspace",
        reason: reason || null,
        actor_email: user?.email || null,
        actor_id_raw: actorId,
      },
    );

    if (canonicalSection === "determinations") {
      await applyDeterminationsCompletionTransition({
        businessCase,
        role: userRole,
        user,
      });
    }

    const processResult = await preflowService.ensurePreflowWorkspaceProcess({ businessCaseId: id, actorUser: user, durationHours: PRE_BC_DURATION_HOURS });
    const latestBusinessCase = await businessCaseService.getBusinessCaseById(id);
    const isCommercialActor = isCommercialSectionActor(req);
    if (canonicalSection === "general" && isCommercialActor && shouldStartQueueOnGeneralSave(latestBusinessCase)) {
      try {
        await notifyBusinessCaseFirstProcessEmail({
          businessCaseId: id,
          actorUser: user,
        });
      } catch (mailError) {
        logger.warn(
          { error: mailError.message, businessCaseId: id },
          "No se pudo enviar el primer correo por proceso al completar datos generales",
        );
      }
    }

    const latestOwnership = await BusinessCaseDataOwnership.getOwnershipInfo(id);
    const ownershipRules = {};
    Object.entries(latestOwnership || {}).forEach(([key, value]) => {
      ownershipRules[key] = {
        isCompleted: Boolean(value?.completedAt),
      };
    });
    const preflow = preflowService.buildPreflowInfo(latestBusinessCase, ownershipRules);

    res.json({
      ok: true,
      data: {
        section: canonicalSection,
        completed: true,
        completedAt: new Date(),
        completedBy: user?.email || 'system',
        reason,
        processResult,
        preflow,
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error recording section completion');
    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error registrando completitud de sección"
    });
  }
}

// ===== EQUIPMENT COMPATIBILITY ENDPOINTS =====

/**
 * Get compatible backup candidates for equipment
 *
 * NEW ENDPOINT: Advanced compatibility-based backup selection
 * Falls back to legacy category-based logic when compatibility data is missing
 */
async function getCompatibleBackupCandidates(req, res) {
  try {
    const { equipmentId } = req.params;
    const {
      maxCandidates = 10,
      minCompatibilityScore = 0.3,
      maxCostPenalty = 50.0,
      requireCapacityOverlap = true
    } = req.query;

    const options = {
      maxCandidates: parseInt(maxCandidates),
      minCompatibilityScore: parseFloat(minCompatibilityScore),
      maxCostPenalty: parseFloat(maxCostPenalty),
      requireCapacityOverlap: requireCapacityOverlap === 'true'
    };

    const candidates = await equipmentCompatibilityService.getCompatibleBackupCandidates(
      parseInt(equipmentId),
      options
    );

    res.json({
      ok: true,
      data: candidates,
      meta: {
        equipmentId: parseInt(equipmentId),
        options,
        totalCandidates: candidates.length,
        hasCompatibilityData: candidates.some(c => c.compatibility_metadata?.match_type !== 'legacy_fallback')
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      equipmentId: req.params.equipmentId
    }, 'Error getting compatible backup candidates');

    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error obteniendo candidatos de respaldo compatibles"
    });
  }
}

/**
 * Validate compatibility between two equipment items
 *
 * NEW ENDPOINT: Advanced validation beyond basic category matching
 */
async function validateEquipmentCompatibility(req, res) {
  try {
    const { primaryId, backupId } = req.params;

    const validation = await equipmentCompatibilityService.validateEquipmentCompatibility(
      parseInt(primaryId),
      parseInt(backupId)
    );

    res.json({
      ok: true,
      data: validation
    });
  } catch (error) {
    logger.error({
      error: error.message,
      primaryId: req.params.primaryId,
      backupId: req.params.backupId
    }, 'Error validating equipment compatibility');

    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error validando compatibilidad de equipos"
    });
  }
}

/**
 * Get compatibility system statistics
 *
 * NEW ENDPOINT: Analytics for monitoring compatibility system health
 */
async function getCompatibilityStatistics(req, res) {
  try {
    const stats = await equipmentCompatibilityService.getCompatibilityStatistics();

    res.json({
      ok: true,
      data: stats
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting compatibility statistics');

    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error obteniendo estadísticas de compatibilidad"
    });
  }
}

async function getInvestmentValues(req, res) {
  try {
    const { id } = req.params;
    const investmentClass = req.query.class;
    if (!['operativa', 'financiera'].includes(investmentClass)) {
      return res.status(400).json({ ok: false, message: 'Parámetro class debe ser operativa o financiera' });
    }
    await businessCaseService.assertModernBusinessCase(id);
    const rows = await investmentsService.getInvestmentValuesByClass(id, investmentClass);
    const pricingContext = await investmentsService.getInvestmentPricingContext(id);

    // Precios en tiempo real: sin deadline ni cierre, cualquier item con
    // cantidad > 0 puede cotizarse apenas se agrega a la lista.
    const selectedCount = Array.isArray(rows) ? rows.length : 0;
    const missingPriceCount = (rows || []).filter((row) => {
      const price = Number(row?.unit_price ?? 0);
      return !Number.isFinite(price) || price <= 0;
    }).length;
    const syncPending = missingPriceCount > 0;
    res.json({
      ok: true,
      data: {
        items: rows,
        pricing_context: pricingContext,
        sync_status: {
          pending: syncPending,
          selected_count: selectedCount,
          missing_price_count: missingPriceCount,
          message: syncPending
            ? `Pendiente de sincronizacion: faltan ${missingPriceCount} precio(s) en inversiones seleccionadas.`
            : "Sincronizacion lista: todas las inversiones seleccionadas tienen precio.",
        },
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting investment values');
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function getInvestmentQuotationAssignees(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const assignees = await investmentsService.listInvestmentQuotationAssignees();
    res.json({ ok: true, data: assignees });
  } catch (error) {
    logger.error({ error: error.message }, "Error getting investment quotation assignees");
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function assertInvestmentValuesEditorRole(investmentClass, role) {
  const allowedForClass = investmentClass === "operativa"
    ? INVESTMENT_VALUES_OP_ROLES
    : INVESTMENT_VALUES_FIN_ROLES;
  if (!allowedForClass.has(role)) {
    const error = new Error(`Solo ${[...allowedForClass].join(" / ")} puede gestionar cotizaciones ${investmentClass}s`);
    error.status = 403;
    throw error;
  }
}

// Financiero/Operaciones trabajan en tiempo real sobre lo que ACP/Servicio
// van agregando a su carrito -- el BC debe llenarse en 48h maximo, no pueden
// esperar a que el carrito se confirme para empezar a cotizar/poner precios.
// Ya no se exige que el carrito correspondiente este confirmado.
async function assignInvestmentQuotation(req, res) {
  try {
    const { id } = req.params;
    const investmentClass = req.body?.class;
    if (!["operativa", "financiera"].includes(investmentClass)) {
      return res.status(400).json({ ok: false, message: "Campo class debe ser operativa o financiera" });
    }
    await businessCaseService.assertModernBusinessCase(id);
    await assertInvestmentValuesEditorRole(investmentClass, resolveRequestRole(req));
    const result = await investmentsService.assignInvestmentQuotation(
      id,
      req.body?.catalog_id,
      req.body?.assignee_id,
      req.user,
    );
    res.json({ ok: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, "Error assigning investment quotation");
    res.status(error.status || 500).json({ ok: false, message: error.message, code: error.code });
  }
}

async function requestInvestmentQuotation(req, res) {
  try {
    const { id } = req.params;
    const investmentClass = req.body?.class;
    if (!["operativa", "financiera"].includes(investmentClass)) {
      return res.status(400).json({ ok: false, message: "Campo class debe ser operativa o financiera" });
    }
    await businessCaseService.assertModernBusinessCase(id);
    await assertInvestmentValuesEditorRole(investmentClass, resolveRequestRole(req));
    const result = await investmentsService.requestInvestmentQuotation(id, req.body?.catalog_id, req.user);
    const notification = result.alreadyRequested
      ? { sent: false, reason: "already_requested" }
      : await notifyInvestmentQuotationRequested({
        businessCaseId: id,
        actor: req.user?.email || "system",
        selection: result.selection,
        assignee: result.assignee,
      });
    res.json({ ok: true, data: { ...result, notification } });
  } catch (error) {
    logger.error({ error: error.message }, "Error requesting investment quotation");
    res.status(error.status || 500).json({ ok: false, message: error.message, code: error.code });
  }
}

async function saveInvestmentValues(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const role = resolveRequestRole(req);

    const investmentClass = req.body?.class;
    if (!['operativa', 'financiera'].includes(investmentClass)) {
      return res.status(400).json({ ok: false, message: 'Campo class debe ser operativa o financiera' });
    }

    // Role gate: only the designated role per class
    const allowedForClass = investmentClass === 'operativa'
      ? INVESTMENT_VALUES_OP_ROLES
      : INVESTMENT_VALUES_FIN_ROLES;
    if (!allowedForClass.has(role)) {
      return res.status(403).json({ ok: false, message: `Solo ${[...allowedForClass].join(' / ')} puede editar valores ${investmentClass}s` });
    }

    // Precios en tiempo real, sin carrito ni cierre: solo se bloquea si la
    // seccion fue bloqueada por otra via generica (lockSection).
    const valuesSectionKey = investmentClass === "operativa" ? "investment_values_op" : "investment_values_fin";
    const valuesLockMap = await BusinessCaseDataOwnership.getLockStatus(id);
    if (valuesLockMap?.[valuesSectionKey]?.isLocked) {
      return res.status(409).json({
        ok: false,
        message: "Ya cerraste este apartado de valores. Solicita reapertura si necesitas corregir algo.",
        code: "INVESTMENT_VALUES_SECTION_LOCKED",
      });
    }

    const values = req.body?.values;
    if (!Array.isArray(values) || !values.length) {
      return res.status(400).json({ ok: false, message: 'values es requerido' });
    }

    const normalizedValues = values.map((item) => {
      const normalized = { ...(item || {}) };
      if (investmentClass === "financiera" && normalized.depreciation_percentage !== undefined && normalized.depreciation_percentage !== null && normalized.depreciation_percentage !== "") {
        const depreciation = Number(normalized.depreciation_percentage);
        if (!Number.isFinite(depreciation) || depreciation < 0 || depreciation > 100) {
          const error = new Error("El porcentaje de depreciacion debe estar entre 0 y 100");
          error.status = 400;
          throw error;
        }
        normalized.depreciation_percentage = depreciation;
      } else if (investmentClass === "financiera") {
        normalized.depreciation_percentage = null;
      }
      return normalized;
    });

    const saved = await investmentsService.saveInvestmentValuesBatch(id, investmentClass, normalizedValues, req.user);

    // Recalcular el BC (ROI/totales) apenas se guarda un precio -- jefe_operaciones
    // y jefe_financiero necesitan ver el total y las tablas de calculo
    // actualizadas sin tener que ir a "Recalcular" manualmente.
    try {
      await businessCaseService.recalculateBusinessCase(id);
    } catch (recalcError) {
      logger.warn(
        { error: recalcError?.message || String(recalcError), businessCaseId: id, investmentClass },
        "No se pudo recalcular el BC tras guardar valores de inversion",
      );
    }

    // Prices are entered in SPI and then synchronized to the official Sheet
    // for both financial and operational value sections.
    let sheetSync = null;
    if (["operativa", "financiera"].includes(investmentClass)) {
      try {
        const syncResult = await sheetGenerationService.enqueueGenerationJob({
          businessCaseId: id,
          input: {},
          user: req.user || null,
          idempotencyKey: `auto:inv-values-${investmentClass}:${id}:${Date.now()}`,
          correlationId: null,
        });

        if (syncResult?.replay) {
          sheetSync = {
            queued: true,
            replay: true,
            status: syncResult.replayStatus || 202,
          };
        } else {
          const job = syncResult?.responseBody?.data || {};
          sheetSync = {
            queued: true,
            replay: false,
            status: 202,
            job_id: job.job_id || null,
            request_id: job.request_id || null,
          };
        }

        try {
          await sheetGenerationService.processPendingJobsBatch({ limit: 1 });
        } catch (inlineSyncError) {
          logger.warn(
            { error: inlineSyncError?.message || String(inlineSyncError), businessCaseId: id },
            "[BC_SHEET] Inline processing after saving operational investment values failed",
          );
        }
      } catch (syncError) {
        logger.warn(
          { error: syncError?.message || String(syncError), businessCaseId: id },
          "No se pudo encolar sincronizacion a Sheets tras guardar valores operativos",
        );
        sheetSync = {
          queued: false,
          error: syncError?.message || "No se pudo iniciar la sincronizacion de hoja",
        };
      }
    }

    try {
      const financialValues = await investmentsService.getInvestmentValuesByClass(id, "financiera");
      const financialValuesComplete = Array.isArray(financialValues) && financialValues.length > 0 && financialValues.every((item) => {
        const value = Number(item?.unit_price ?? item?.price ?? 0);
        return Number.isFinite(value) && value > 0;
      });
      let financialSectionJustCompleted = false;
      if (investmentClass === "financiera" && financialValuesComplete) {
        await db.query(
          `UPDATE equipment_purchase_requests
              SET bc_stage = 'factibilidad',
                  updated_at = NOW()
            WHERE id = $1
              AND COALESCE(bc_stage, '') NOT IN ('factible', 'cerrado_no_factible')`,
          [id],
        );

        const ownershipInfo = await BusinessCaseDataOwnership.getOwnershipInfo(id);
        if (!ownershipInfo?.investment_values_fin?.completedAt) {
          const latestBusinessCase = await businessCaseService.getBusinessCaseById(id);
          const currentState = String(latestBusinessCase?.canonical_state || latestBusinessCase?.bc_stage || "draft").toUpperCase();
          const actorId = req.user?.id ?? req.user?.sub ?? req.user?.user_id ?? req.user?.uuid ?? null;
          await BusinessCaseDataOwnership.recordSectionCompletion(
            id,
            "investment_values_fin",
            actorId,
            role,
            currentState,
            {
              source: "investment_values_save",
              actor_email: req.user?.email || null,
              actor_id_raw: actorId,
              completion_basis: "all_financial_prices_completed",
            },
          );
          financialSectionJustCompleted = true;
        }
      }

      if (financialSectionJustCompleted) {
        await workflowSlaService.notifyParticipants({
          businessCaseId: id,
          eventKey: "investment_values_completed",
          title: "Valores de inversiones completados: revisar factibilidad",
          message:
            "Los valores financieros obligatorios de las inversiones seleccionadas ya fueron registrados. El siguiente paso es revisar y registrar la factibilidad del Business Case.",
          actorEmail: req.user?.email || null,
          excludeActor: true,
        });
      }
    } catch (workflowError) {
      logger.warn(
        { error: workflowError?.message || String(workflowError), businessCaseId: id },
        "No se pudo notificar la finalizacion de valores de inversiones",
      );
    }

    res.json({
      ok: true,
      data: {
        items: saved,
        saved_count: saved.length,
        sheet_sync: sheetSync,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error saving investment values');
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

module.exports = {
  list,
  create,
  getById,
  update,
  remove,
  selectEquipment,
  getDeterminations,
  addDetermination,
  updateDetermination,
  removeDetermination,
  getCalculations,
  recalculate,
  exportPdf,
  exportExcel,
  submitFeasibilityDecision,
  updateEconomicData,
  addInvestment,
  getInvestments,
  updateInvestment,
  deleteInvestment,
  getInvestmentCatalog,
  createInvestmentCatalogItem,
  saveInvestmentSelection,
  closeInvestmentsWithoutAdditionalItems,
  getInvestmentValues,
  getInvestmentQuotationAssignees,
  assignInvestmentQuotation,
  requestInvestmentQuotation,
  saveInvestmentValues,
  getConsumptionItems,
  saveConsumptionItems,
  patchConsumptionItem,
  syncConsumptionFromSheet,
  getDispatchWorkspace,
  saveCommercialDispatchPlan,
  saveOperationsDispatchControl,
  ingestFrontendObservabilityEvents,
  getObservabilityMetrics,
  getObservabilityDashboard,
  getAutosaveFeatureFlags,
  upsertAutosaveFeatureFlags,
  // UI Guidance endpoints (Workspace)
  getUIGuidance,
  getDeterminationsGateInfo,
  requestEnvironmentInspection,
  reviewEnvironmentInspectionRequest,
  registerEnvironmentInspectionResult,
  lockDeterminationsSubsection,
  lockAllDeterminationsTechnicalSubsections,
  requestDeterminationsSubsectionUnlock,
  resolveDeterminationsSubsectionUnlock,
  reopenDeterminationsCommercial,
  renewDeterminationsCommercialWindow,
  uploadDeterminationsStatDocument,
  parseDeterminationsQuantitiesFile,
  clearSheetTemplateCache,
  getDataOwnership,
  recordSectionCompletion,
  lockSection,
  unlockSection,
  requestPreflowReopen,
  resolvePreflowReopen,
  requestFeasibilityAppeal,    // BC-16
  resolveFeasibilityAppeal,    // BC-16
  // Manual BC Form endpoints
  saveLabEnvironment,
  getLabEnvironment,
  saveEquipmentDetailsV2,
  saveLisIntegration,
  getLisIntegration,
  addLisEquipmentInterface,
  getLisEquipmentInterfaces,
  saveRequirements,
  getRequirements,
  saveDeliveries,
  getDeliveries,
  getComplete,
  emergencyTransition,
  getStateHistory,
  getSectionAccessLog,
  getSectionCompleteness,
  getBcSlaStatus,
  getSlaAtRisk,
  // Equipment compatibility endpoints
  getCompatibleBackupCandidates,
  validateEquipmentCompatibility,
  getCompatibilityStatistics
};
