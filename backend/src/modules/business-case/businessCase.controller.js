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
const bcEquipmentDetailsService = require("./bcEquipmentDetails.service");
const bcLisIntegrationService = require("./bcLisIntegration.service");
const bcRequirementsService = require("./bcRequirements.service");
const bcDeliveriesService = require("./bcDeliveries.service");
const orchestrator = require("./BusinessCaseOrchestrator.service");
const pdfGenerator = require("./pdfGenerator.service");
const excelExporter = require("./excelExporter.service");
const equipmentCompatibilityService = require("./equipmentCompatibility.service");
const observabilityService = require("./businessCaseObservability.service");
const featureFlagsService = require("./businessCaseFeatureFlags.service");
const idempotencyService = require("./businessCaseIdempotency.service");
const { BusinessCaseDataOwnership } = require("./businessCaseDataOwnership");
const notificationManager = require("../notifications/notificationManager");
const BusinessCaseStateMachine = require("./businessCaseStateMachine");
const { STATES } = require("./businessCaseStates.constants");
const preflowService = require("./businessCasePreflow.service");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const determinationsGateService = require("./businessCaseDeterminationsGate.service");
const { ensureBusinessCaseDriveFolder } = require("./businessCaseDriveFolder.service");
const sheetGenerationService = require("./businessCaseSheetGeneration.service");
const { createRequest: createServiceRequest, addDriveAttachment } = require("../requests/requests.service");

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
  ).optional(),
  quantities: Joi.object().optional(),
  prices: Joi.object().optional(),
  calculations: Joi.object().optional(),
});

const SECTION_ALIASES = {
  general: "general",
  lab: "lab",
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
const DETERMINATIONS_UPLOAD_MAIL_ROLES = [
  "acp_comercial",
  "backoffice_comercial",
  "jefe_comercial",
  "jefe_tecnico",
  "tecnico",
  "jefe_operaciones",
];
const BUSINESS_CASE_PROCESS_MAIL_ROLES = [
  "comercial",
  "acp_comercial",
  "backoffice_comercial",
  "jefe_comercial",
  "jefe_tecnico",
  "tecnico",
  "jefe_operaciones",
];
const DETERMINATIONS_REACTIVO_TYPES = new Set(["reactivo", "determinacion"]);
const DETERMINATIONS_TECH_TYPES = new Set(["control", "calibrador", "consumible", "material"]);
// Public BCs: comercial uploads the statistical document and completes the public commercial phase.
// Private BCs: backoffice_comercial/backoffice fill reactivos.
const DETERMINATIONS_REACTIVO_PUBLIC_ROLES = new Set(["comercial"]);
const DETERMINATIONS_REACTIVO_PRIVATE_ROLES = new Set(["backoffice_comercial", "backoffice"]);
// tecnico + jefe_tecnico fill controles/calibradores/materiales regardless of BC type
const DETERMINATIONS_TECH_EDIT_ROLES = new Set(["tecnico", "jefe_tecnico"]);
const DETERMINATIONS_TECH_WINDOW_NOTIFY_ROLES = ["tecnico", "jefe_tecnico"];
const DETERMINATIONS_SUBSECTIONS = new Set(["reactivos", "controles", "calibradores", "materiales"]);
const DETERMINATIONS_UNLOCK_DECIDER_ROLES = new Set(["jefe_comercial"]);
const INVESTMENT_VALUES_DEADLINE_HOURS = 48;
const INVESTMENT_VALUES_OP_ROLES = new Set([
  "jefe_operaciones",
  "jefe_de_operaciones",
]);
const INVESTMENT_VALUES_FIN_ROLES = new Set(["jefe_financiero"]);
const INVESTMENT_CART_CONFIRM_ROLES = new Set([
  "comercial",
  "acp_comercial",
  "backoffice_comercial",
  "backoffice",
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
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
  return String(req.user?.role || req.user?.scope || req.user?.role_name || "").toLowerCase();
}

function getInvestmentCartStatus(businessCase = {}) {
  const metadata = preflowService.toObject(businessCase?.modern_bc_metadata);
  const cart = metadata?.investments_cart && typeof metadata.investments_cart === "object"
    ? metadata.investments_cart
    : {};
  return {
    confirmed: Boolean(cart.confirmed),
    confirmedAt: cart.confirmed_at || null,
    confirmedByEmail: cart.confirmed_by_email || null,
    confirmedByRole: cart.confirmed_by_role || null,
  };
}

function normalizePurchaseTypeForGate(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (["private_comodato", "comodato_privado"].includes(raw)) return "private_comodato";
  if (["public", "comodato_publico"].includes(raw)) return "public";
  if (raw.startsWith("private")) return "private_comodato";
  return "public";
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
        ? "Solo acp_comercial puede registrar reactivos en un proceso publico."
        : "Solo backoffice puede registrar reactivos en un proceso privado.";
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

function canRequestBusinessCaseInspection(role = "", bcPurchaseType = "") {
  const normalizedRole = String(role || "").trim().toLowerCase();
  const normalizedType = normalizePurchaseTypeForGate(bcPurchaseType);
  const allowedRoles = normalizedType === "public"
    ? DETERMINATIONS_REACTIVO_PUBLIC_ROLES
    : DETERMINATIONS_REACTIVO_PRIVATE_ROLES;
  return allowedRoles.has(normalizedRole);
}

async function resolveBusinessCaseMailingList({ businessCase, actorUser }) {
  const recipients = await getUsersByRoles(BUSINESS_CASE_PROCESS_MAIL_ROLES);
  const emails = [...new Set(
    [
      String(actorUser?.email || "").trim().toLowerCase(),
      String(businessCase?.created_by_email || "").trim().toLowerCase(),
      ...recipients.map((user) => String(user?.email || "").trim().toLowerCase()),
    ].filter(Boolean),
  )];
  const [primaryTo, ...ccEmails] = emails;
  return { primaryTo: primaryTo || null, ccEmails, recipients };
}

async function notifySectionReview({ businessCaseId, section, actor }) {
  const recipients = await getUsersByRoles(REVIEW_ROLES);
  await Promise.all(
    recipients.map((user) =>
      notificationManager.sendNotification({
        userId: user.id,
        template: "bc_section_review_requested",
        data: { business_case_id: businessCaseId, section_name: section },
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
  await Promise.all(
    recipients.map((user) =>
      notificationManager.sendNotification({
        userId: user.id,
        template: "bc_section_review_requested",
        data: { business_case_id: businessCaseId, section_name: "determinations" },
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

function subsectionFromConsumptionType(value) {
  const type = normalizeConsumptionType(value);
  if (DETERMINATIONS_REACTIVO_TYPES.has(type)) return "reactivos";
  if (type === "control") return "controles";
  if (type === "calibrador") return "calibradores";
  return "materiales";
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
      const error = new Error("Aun no inicia la revision tecnica. Primero ACP/Backoffice debe terminar reactivos.");
      error.status = 403;
      error.code = "DETERMINATIONS_TECH_REVIEW_NOT_STARTED";
      throw error;
    }
    if (hasReactivoFamily && !reactivoRoles.has(normalizedRole)) {
      const error = new Error(
        isPublic
          ? "Solo comercial puede completar reactivos en la fase comercial."
          : "Solo backoffice_comercial puede completar reactivos en la fase comercial.",
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
    metadata.determinations_gate = {
      ...currentGate,
      phase: "technical_review",
      enabled: true,
      is_expired: false,
      review_role: "jefe_tecnico",
      review_started_at: now.toISOString(),
      review_deadline_at: deadlineAt.toISOString(),
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
    await businessCaseService.updateBusinessCase(businessCaseId, { modern_bc_metadata: metadata });
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
    await businessCaseService.updateBusinessCase(businessCaseId, { modern_bc_metadata: metadata });
    await BusinessCaseDataOwnership.lockSection(
      businessCaseId,
      "determinations",
      user,
      String(businessCase?.canonical_state || businessCase?.bc_stage || "draft").toUpperCase(),
      { source: "determinations_completed_technical" },
    );
  }
}

async function notifyInvestmentValuesReady({ businessCaseId, actor, deadlineAt }) {
  const opRecipients = await getUsersByRoles([...INVESTMENT_VALUES_OP_ROLES]);
  const finRecipients = await getUsersByRoles([...INVESTMENT_VALUES_FIN_ROLES]);
  const deadlineStr = deadlineAt ? new Date(deadlineAt).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }) : '48 horas';

  await Promise.all([
    ...opRecipients.map((user) =>
      notificationManager.sendNotification({
        userId: user.id,
        template: "custom_html",
        customTitle: "Inversiones adicionales actualizadas — se requieren valores operativos",
        customBody: `Las inversiones adicionales del BC fueron actualizadas. Tienes hasta <strong>${deadlineStr}</strong> para llenar los valores operativos.`,
        email: true,
        chat: true,
        source: "business_case.investment_values_op_ready",
        meta: { businessCaseId, actor, deadline_at: deadlineAt },
      }).catch(() => null)
    ),
    ...finRecipients.map((user) =>
      notificationManager.sendNotification({
        userId: user.id,
        template: "custom_html",
        customTitle: "Inversiones adicionales actualizadas — se requieren valores financieros",
        customBody: `Las inversiones adicionales del BC fueron actualizadas. Tienes hasta <strong>${deadlineStr}</strong> para llenar los valores financieros.`,
        email: true,
        chat: true,
        source: "business_case.investment_values_fin_ready",
        meta: { businessCaseId, actor, deadline_at: deadlineAt },
      }).catch(() => null)
    ),
  ]);
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

  await businessCaseService.updateBusinessCase(businessCase.id, { modern_bc_metadata: metadata });
  await notifyDeterminationsTechWindowStarted({
    businessCaseId: businessCase.id,
    actor: actorUser?.email || "system",
  });
  return { enabledAt: now.toISOString(), deadlineAt: deadline.toISOString() };
}

async function notifySectionLocked({ businessCaseId, section, actor }) {
  const recipients = await getUsersByRoles(["acp_comercial", "backoffice_comercial", "jefe_comercial"]);
  await Promise.all(
    recipients.map((user) =>
      notificationManager.sendNotification({
        userId: user.id,
        template: "bc_section_locked",
        data: { business_case_id: businessCaseId, section_name: section },
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
  await Promise.all(
    recipients.map((user) =>
      notificationManager.sendNotification({
        userId: user.id,
        template: "bc_phase1_completed",
        data: { business_case_id: businessCaseId },
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
  const equipmentDetails = await bcEquipmentDetailsService.getEquipmentDetails(businessCaseId);
  const lisIntegration = await bcLisIntegrationService.getLisIntegration(businessCaseId);
  const requirementData = await bcRequirementsService.getRequirements(businessCaseId);
  const deliveryData = await bcDeliveriesService.getDeliveries(businessCaseId);

  const extraEquipment = Array.isArray(businessCase?.extra?.equipment_details)
    ? businessCase.extra.equipment_details
    : [];
  const equipmentPairs = extraEquipment.length ? extraEquipment : (equipmentDetails || []);

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

  const lisComplete =
    lisIntegration &&
    lisIntegration.includes_lis !== null &&
    lisIntegration.includes_lis !== undefined &&
    (lisIntegration.includes_lis === false || hasValue(lisIntegration.lis_provider));

  const hasRequirementData =
    requirementData &&
    (hasValue(requirementData.deadline_months) ||
      hasValue(requirementData.projected_deadline_months) ||
      hasValue(requirementData.observations));

  const hasDeliveryData =
    deliveryData &&
    (hasValue(deliveryData.delivery_type) || typeof deliveryData.effective_determination === "boolean");

  const requirementReady = hasRequirementData || hasDeliveryData;

  const metadata = businessCase?.modern_bc_metadata && typeof businessCase.modern_bc_metadata === "object"
    ? businessCase.modern_bc_metadata
    : {};
  const metadataGeneral = metadata?.general_data && typeof metadata.general_data === "object"
    ? metadata.general_data
    : {};
  const generalReady =
    (hasValue(businessCase?.client_name) &&
      hasValue(businessCase?.process_code) &&
      hasValue(businessCase?.contract_object)) ||
    hasAnyFields(metadataGeneral, ["contractingEntity", "provinceCity", "clientType"]);

  return {
    general: Boolean(generalReady),
    lab: Boolean(hasLabData),
    equipment: Boolean(equipmentComplete),
    lis: Boolean(lisComplete || hasLisData),
    requirement: Boolean(requirementReady),
  };
}

function buildGroupedDeterminationsEmailPayload({ businessCase, gate, actorEmail }) {
  const clientName = resolveBusinessCaseClientDisplayName(businessCase);
  const processNumber = String(businessCase?.process_code || "").trim();
  if (!processNumber) {
    const error = new Error("Debe existir numero de proceso (process_code) para enviar notificaciones.");
    error.status = 409;
    throw error;
  }
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
  const flowLabel = normalizeBusinessCaseFlowLabel(businessCase?.bc_purchase_type);
  const actorLabel = actorEmail || "usuario comercial";

  return {
    subject: `${flowLabel} - ${clientName} - ${processNumber}`,
    message:
      `Flujo: ${flowLabel}. ` +
      `${actorLabel} cargó el documento de estadística del Business Case ${businessCase?.id || businessCase?.business_case_id}. ` +
      `Desde esta carga aplica la ventana obligatoria de 48 horas y vence el ${deadlineText}.`,
    metadata: {
      businessCaseId: businessCase?.id || businessCase?.business_case_id,
      clientName,
      processNumber,
      flowLabel,
      actor: actorEmail || null,
      deadlineAt: gate?.deadlineAt || null,
    },
  };
}

async function registerDeterminationsGroupedNotificationAudit({
  businessCaseId,
  actorUserId,
  actorEmail,
  flowType,
  clientName,
  processCode,
  emailTo,
  emailCc,
  deadlineAt,
  source = "business_case.determinations_gate_grouped_mail",
}) {
  try {
    await db.query(
      `
      INSERT INTO bc_notification_legal_audit (
        business_case_id,
        actor_user_id,
        actor_email,
        flow_type,
        client_name,
        process_code,
        source,
        email_to,
        email_cc,
        payload,
        created_at
      ) VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::jsonb, NOW()
      )
      `,
      [
        businessCaseId,
        actorUserId || null,
        actorEmail || null,
        flowType || null,
        clientName || null,
        processCode || null,
        source,
        emailTo || null,
        Array.isArray(emailCc) ? emailCc : [],
        JSON.stringify({
          deadline_at: deadlineAt || null,
          legal_traceability: true,
        }),
      ],
    );
  } catch (error) {
    logger.warn(
      {
        error: error.message,
        businessCaseId,
        source,
      },
      "No se pudo registrar auditoria legal de notificacion agrupada",
    );
  }
}

async function notifyDeterminationsGroupedMail({ businessCase, gate, actorUser }) {
  const mailingList = await resolveBusinessCaseMailingList({ businessCase, actorUser });
  const recipients = mailingList.recipients || [];
  const primaryTo = mailingList.primaryTo;
  const ccEmails = mailingList.ccEmails || [];
  if (!primaryTo) return;

  const payload = buildGroupedDeterminationsEmailPayload({
    businessCase,
    gate,
    actorEmail: actorUser?.email || null,
  });

  await notificationManager.sendNotification({
    userId: actorUser?.id || recipients?.[0]?.id,
    template: "custom_html",
    customTitle: payload.subject,
    customMessage: payload.message,
    type: "alert",
    priority: 2,
    source: "business_case.determinations_gate_grouped_mail",
    email: true,
    chat: false,
    data: {
      email_to: primaryTo,
      email_cc: ccEmails,
    },
    meta: {
      ...payload.metadata,
      email_to: primaryTo,
      email_cc: ccEmails,
      notified_roles: DETERMINATIONS_UPLOAD_MAIL_ROLES,
      process_key: buildBusinessCaseProcessKey(payload.metadata.businessCaseId),
    },
  });

  await registerDeterminationsGroupedNotificationAudit({
    businessCaseId: payload.metadata.businessCaseId,
    actorUserId: actorUser?.id || null,
    actorEmail: actorUser?.email || null,
    flowType: payload.metadata.flowLabel || null,
    clientName: payload.metadata.clientName,
    processCode: payload.metadata.processNumber,
    emailTo: primaryTo,
    emailCc: ccEmails,
    deadlineAt: payload.metadata.deadlineAt || null,
  });
}

async function notifyBusinessCaseFirstProcessEmail({ businessCaseId, actorUser }) {
  const businessCase = await businessCaseService.getBusinessCaseById(businessCaseId);
  const metadata = preflowService.toObject(businessCase?.modern_bc_metadata);
  if (metadata?.preflow_first_email_sent_at) {
    return { skipped: true, reason: "already_sent" };
  }

  const mailingList = await resolveBusinessCaseMailingList({ businessCase, actorUser });
  if (!mailingList.primaryTo) {
    return { skipped: true, reason: "missing_recipients" };
  }

  const subject = buildBusinessCaseProcessSubject(businessCase);
  const flowLabel = normalizeBusinessCaseFlowLabel(businessCase?.bc_purchase_type);
  const clientName = resolveBusinessCaseClientDisplayName(businessCase);
  const processCode = String(businessCase?.process_code || "").trim() || "No aplica";

  await notificationManager.sendNotification({
    userId: actorUser?.id || mailingList.recipients?.[0]?.id,
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

async function assertSectionEditable(businessCaseId, section, user) {
  if (section === "investments") return;
  const lockMap = await BusinessCaseDataOwnership.getLockStatus(businessCaseId);
  const lockInfo = lockMap?.[section];
  if (lockInfo?.isLocked) {
    const error = new Error("Seccion bloqueada para edicion");
    error.status = 409;
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

    const bc = await businessCaseService.updateBusinessCase(req.params.id, value);
    if (preflowService.isPreflowCase(bc) && hasGeneralPayloadChanges(value)) {
      const metadata = preflowService.toObject(bc?.modern_bc_metadata);
      if (!metadata?.preflow_started_at) {
        await preflowService.ensurePreflowStarted(req.params.id, PRE_BC_DURATION_HOURS);
      }
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

async function submitFeasibilityDecision(req, res) {
  try {
    const { error, value } = feasibilityDecisionSchema.validate(req.body || {}, { abortEarly: false });
    if (error) {
      return res.status(400).json({ ok: false, message: error.details.map((d) => d.message).join(", ") });
    }

    const updated = await businessCaseService.saveFeasibilityDecision(req.params.id, value, req.user);
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

// Equipment Details
async function saveEquipmentDetails(req, res) {
  let idempotencySession = null;
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    await assertSectionEditable(id, "equipment", req.user);
    const payload = req.body || {};
    idempotencySession = await startIdempotentWrite({
      req,
      operationScope: "bc.equipment.save",
      businessCaseId: id,
      payload,
    });
    if (idempotencySession.replay) {
      applyResponseHeadersFromBody(res, idempotencySession.replayPayload);
      return res.status(idempotencySession.replayStatus).json(idempotencySession.replayPayload);
    }

    const result = await bcEquipmentDetailsService.createEquipmentDetails(id, payload);
    if ((req.user?.role || "").toLowerCase() === "comercial") {
      await notifySectionReview({ businessCaseId: id, section: "equipment", actor: req.user?.email || "system" });
    }
    const responseBody = { success: true, data: result };
    await completeIdempotentWrite(idempotencySession, responseBody, 200);
    res.json(responseBody);
  } catch (error) {
    await failIdempotentWrite(idempotencySession, error);
    logger.error({ error: error.message }, 'Error saving equipment details');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function getEquipmentDetails(req, res) {
  try {
    const { id } = req.params;
    const result = await bcEquipmentDetailsService.getEquipmentDetails(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting equipment details');
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getInvestmentCatalog(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const bc = await businessCaseService.getBusinessCaseById(id);
    const rows = await investmentsService.getCatalogWithSelections(id);
    res.json({ ok: true, data: { items: rows, cart: getInvestmentCartStatus(bc) } });
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
    if (getInvestmentCartStatus(bc).confirmed) {
      const lockError = new Error("El carrito de inversiones ya fue confirmado y esta bloqueado.");
      lockError.status = 409;
      lockError.code = "INVESTMENT_CART_CONFIRMED_LOCKED";
      throw lockError;
    }
    const role = resolveRequestRole(req);
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

async function createInvestmentCatalogItem(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const bc = await businessCaseService.getBusinessCaseById(id);
    if (getInvestmentCartStatus(bc).confirmed) {
      return res.status(409).json({ ok: false, message: "El carrito de inversiones ya fue confirmado y esta bloqueado.", code: "INVESTMENT_CART_CONFIRMED_LOCKED" });
    }
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

    // Resolver nombres de equipos desde equipment_models para incluirlos en los pares almacenados.
    // Esto evita que mapBusinessCaseEquipmentToRequestList use "Equipo ${id}" como fallback.
    const allEquipmentIds = [
      ...new Set(
        value.equipment_pairs.flatMap((pair) => [pair.primary_id, pair.backup_id].filter(Number.isFinite)),
      ),
    ];
    const namesById = {};
    if (allEquipmentIds.length) {
      const { rows: modelRows } = await db.query(
        `SELECT id, name, model FROM public.equipment_models WHERE id = ANY($1::int[])`,
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
    if ((req.user?.role || "").toLowerCase() === "comercial") {
      await notifySectionReview({ businessCaseId: id, section: "lis", actor: req.user?.email || "system" });
    }
    const responseBody = { success: true, data: result };
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
    const equipmentDetails = await bcEquipmentDetailsService.getEquipmentDetails(id);
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
        equipmentDetails,
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

// ===== ORCHESTRATOR ENDPOINTS (UNIFIED BC WORKFLOW) =====

// FASE 1: Crear BC Económico
async function createEconomicBC(req, res) {
  try {
    const bc = await orchestrator.createEconomicBC({
      ...req.body,
      created_by: req.user?.email || 'system'
    });
    res.json({ success: true, data: bc });
  } catch (error) {
    logger.error({ error: error.message }, 'Error creating economic BC');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 2: Calcular ROI Inicial
async function calculateROI(req, res) {
  try {
    const { id } = req.params;
    const results = await orchestrator.calculateInitialROI(id);
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error({ error: error.message }, 'Error calculating ROI');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 3: Evaluar Aprobación Económica
async function evaluateEconomicApproval(req, res) {
  try {
    const { id } = req.params;
    const result = await orchestrator.evaluateEconomicApproval(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error evaluating approval');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 4: Adjuntar Datos Operativos
async function attachOperationalData(req, res) {
  try {
    const { id } = req.params;
    await orchestrator.attachOperationalData(id, req.body);
    res.json({ success: true, message: 'Operational data attached' });
  } catch (error) {
    logger.error({ error: error.message }, 'Error attaching operational data');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 4: Adjuntar Datos LIS
async function attachLISData(req, res) {
  try {
    const { id } = req.params;
    await orchestrator.attachLISData(id, req.body);
    res.json({ success: true, message: 'LIS data attached' });
  } catch (error) {
    logger.error({ error: error.message }, 'Error attaching LIS data');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 5: Recalcular con Datos Operativos
async function recalculateWithOperational(req, res) {
  try {
    const { id } = req.params;
    const result = await orchestrator.recalculateWithOperationalData(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error recalculating');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 6: Validar Coherencia
async function validateBC(req, res) {
  try {
    const { id } = req.params;
    const validations = await orchestrator.validateCoherence(id);
    res.json({ success: true, data: validations });
  } catch (error) {
    logger.error({ error: error.message }, 'Error validating BC');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 7: Promover Etapa
async function promoteStage(req, res) {
  try {
    const { id } = req.params;
    const { stage, notes } = req.body;
    await orchestrator.promoteStage(id, stage, req.user?.email || 'system', notes);
    res.json({ success: true, message: 'Stage promoted' });
  } catch (error) {
    logger.error({ error: error.message }, 'Error promoting stage');
    res.status(500).json({ success: false, message: error.message });
  }
}

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

// Obtener BC Completo (con todos los módulos)
async function getCompleteBCMaster(req, res) {
  try {
    const { id } = req.params;

    const bc = await orchestrator.getBCMaster(id);
    const economicData = await orchestrator.getEconomicData(id);
    const operationalData = await orchestrator.getOperationalData(id);
    const determinations = await orchestrator.getDeterminations(id);
    const investments = await orchestrator.getInvestments(id);

    // LIS data
    const { rows: lisRows } = await require('../../config/db').query(
      'SELECT * FROM bc_lis_data WHERE bc_master_id = $1', [id]
    );
    const lisData = lisRows[0];

    let lisInterfaces = [];
    if (lisData) {
      const { rows: ifaceRows } = await require('../../config/db').query(
        'SELECT * FROM bc_lis_equipment_interfaces WHERE bc_lis_data_id = $1', [lisData.id]
      );
      lisInterfaces = ifaceRows;
    }

    // Workflow history
    const { rows: historyRows } = await require('../../config/db').query(
      'SELECT * FROM bc_workflow_history WHERE bc_master_id = $1 ORDER BY changed_at DESC', [id]
    );

    // Validations
    const { rows: validationRows } = await require('../../config/db').query(
      'SELECT * FROM bc_validations WHERE bc_master_id = $1 AND NOT resolved ORDER BY created_at DESC', [id]
    );

    res.json({
      success: true,
      data: {
        ...bc,
        economicData,
        operationalData,
        lisData: lisData ? { ...lisData, equipmentInterfaces: lisInterfaces } : null,
        determinations,
        investments,
        workflowHistory: historyRows,
        validations: validationRows
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting complete BC');
    res.status(500).json({ success: false, message: error.message });
  }
}

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
    const equipmentDetails = await bcEquipmentDetailsService.getEquipmentDetails(id);
    const lisIntegration = await bcLisIntegrationService.getLisIntegration(id);

    const extraEquipment = Array.isArray(bc?.extra?.equipment_details)
      ? bc.extra.equipment_details
      : [];
    const equipmentPairs = extraEquipment.length ? extraEquipment : (equipmentDetails || []);

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

    const lisComplete =
      lisIntegration &&
      lisIntegration.includes_lis !== null &&
      lisIntegration.includes_lis !== undefined &&
      (lisIntegration.includes_lis === false || isFilled(lisIntegration.lis_provider));

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

    const hasGeneralData = hasAny(bc, [
      "client_name",
      "client_id",
      "process_code",
      "contract_object",
    ]) || hasAny(bc?.modern_bc_metadata, [
      "clientType",
      "contractingEntity",
      "provinceCity",
      "notes",
    ]);

    const generalComplete =
      isFilled(bc?.client_name) &&
      isFilled(bc?.process_code) &&
      isFilled(bc?.contract_object);

    const investmentSelections = await investmentsService.getInvestmentSelections(id);
    const hasInvestmentsData = Array.isArray(investmentSelections) && investmentSelections.some((i) => i.selected);

    const userRole = (req.user?.role || req.user?.scope || req.user?.role_name || 'comercial').toLowerCase();
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
    const determinationsGate = determinationsGateService.buildGateInfo({
      businessCase: bc,
      role: userRole,
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    const ownershipRules = {
      general: completionRule(generalComplete, hasGeneralData, "general"),
      lab: completionRule(hasLabData, hasLabData, "lab"),
      equipment: completionRule(equipmentComplete, hasEquipmentData, "equipment"),
      lis: completionRule(lisComplete, hasLisData, "lis"),
      determinations: completionRule(false, hasDeterminationsData, "determinations"),
      requirement: completionRule(requirementComplete, hasRequirementData || hasDeliveryData, "requirement"),
      investments: completionRule(hasInvestmentsData, hasInvestmentsData, "investments"),
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

    ownershipRules.determinations.canUserEdit = Boolean(
      ownershipRules.determinations.canUserEdit && determinationsGate.permissions.canEditDeterminations,
    );
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
        ownershipRules.determinations.currentOwner = "jefe_tecnico";
      } else if (determinationsGate?.phase === "commercial_input") {
        ownershipRules.determinations.currentOwner =
          normalizePurchaseTypeForGate(bc?.bc_purchase_type) === "public"
            ? "comercial"
            : "backoffice_comercial";
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
        // dispatch_workspace se desbloquea post-factibilidad, no se cierra
        if (sectionKey === 'dispatch_workspace') return;
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

    const ruleEntries = Object.values(ownershipRules);
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
    const canResolvePreflowReopen = ['jefe_comercial', 'gerencia', 'gerencia_general'].includes(userRole);
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
    };
    const autosaveFlags = await featureFlagsService.getAutosaveFlagsForRole(userRole);

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
        currentStage: bc.bc_stage || bc.current_stage || 'draft',
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
    if (!canRequestBusinessCaseInspection(role, bc?.bc_purchase_type)) {
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

async function requestInvestmentQuantityIncrease(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const requestRow = await investmentsService.createIncreaseQuantityRequest(id, req.body || {}, req.user);

    try {
      const { rows: ownerRows } = await db.query(
        `SELECT owner_email
         FROM bc_investment_selections
         WHERE business_case_id = $1
           AND catalog_id = $2
         LIMIT 1`,
        [id, requestRow.catalog_id],
      );
      const ownerEmail = String(ownerRows?.[0]?.owner_email || "").trim().toLowerCase();
      if (ownerEmail) {
        const { rows: users } = await db.query(
          `SELECT id FROM users WHERE lower(email) = $1 AND active = true LIMIT 1`,
          [ownerEmail],
        );
        const ownerUserId = users?.[0]?.id || null;
        if (ownerUserId) {
          await notificationManager.sendNotification({
            userId: ownerUserId,
            template: "custom_html",
            customTitle: "Solicitud de aumento de cantidad",
            customMessage: `${req.user?.email || "Usuario"} solicito aumentar cantidad para catalogo ${requestRow.catalog_id} a ${requestRow.requested_quantity}.`,
            email: true,
            chat: true,
            source: "business_case.investment.quantity_increase_request",
            meta: {
              businessCaseId: id,
              catalogId: requestRow.catalog_id,
              requestId: requestRow.id,
            },
          }).catch(() => null);
        }
      }
    } catch (_notifyErr) {}

    res.json({ ok: true, data: requestRow });
  } catch (error) {
    logger.error({ error: error.message }, "Error requesting investment quantity increase");
    res.status(error.status || 500).json({ ok: false, message: error.message, code: error.code || null });
  }
}

async function confirmInvestmentCart(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const role = resolveRequestRole(req);
    if (!INVESTMENT_CART_CONFIRM_ROLES.has(role)) {
      return res.status(403).json({ ok: false, message: "No tienes permisos para confirmar el carrito de inversiones." });
    }

    const bc = await businessCaseService.getBusinessCaseById(id);
    const cartStatus = getInvestmentCartStatus(bc);
    if (cartStatus.confirmed) {
      return res.status(409).json({ ok: false, message: "El carrito ya fue confirmado.", code: "INVESTMENT_CART_ALREADY_CONFIRMED" });
    }

    const selected = await investmentsService.getInvestmentValuesByClass(id, "operativa");
    if (!Array.isArray(selected) || !selected.length) {
      return res.status(409).json({ ok: false, message: "No hay inversiones seleccionadas para confirmar." });
    }
    const invalidQty = selected.some((row) => !Number.isFinite(Number(row?.quantity)) || Number(row.quantity) <= 0);
    if (invalidQty) {
      return res.status(409).json({ ok: false, message: "Todas las inversiones seleccionadas deben tener cantidad mayor a 0 antes de confirmar." });
    }

    const metadata = preflowService.toObject(bc?.modern_bc_metadata);
    const now = new Date();
    const deadline = new Date(now.getTime() + INVESTMENT_VALUES_DEADLINE_HOURS * 60 * 60 * 1000);
    metadata.investments_cart = {
      confirmed: true,
      confirmed_at: now.toISOString(),
      confirmed_by_email: req.user?.email || null,
      confirmed_by_role: role,
      deadline_at: deadline.toISOString(),
    };
    await businessCaseService.updateBusinessCase(id, { modern_bc_metadata: metadata });
    await investmentsService.stampInvestmentDeadlines(id, INVESTMENT_VALUES_DEADLINE_HOURS);
    await notifyInvestmentValuesReady({
      businessCaseId: id,
      actor: req.user?.email || req.user?.role || "sistema",
      deadlineAt: deadline,
    });

    res.json({
      ok: true,
      data: {
        confirmed: true,
        confirmed_at: now.toISOString(),
        deadline_at: deadline.toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, "Error confirming investment cart");
    res.status(error.status || 500).json({ ok: false, message: error.message, code: error.code || null });
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

    const currentConsumption = await businessCaseService.getConsumptionItems(id);
    const items = Array.isArray(currentConsumption?.items) ? currentConsumption.items : [];
    const scoped = items.filter((item) => subsectionFromConsumptionType(item?.type) === subsection);
    if (!scoped.length) {
      return res.status(409).json({
        ok: false,
        message: `No existen items en la subseccion ${subsection} para bloquear.`,
      });
    }
    const hasPending = scoped.some((item) => Number(item?.annualQty ?? item?.annualQuantity ?? 0) <= 0);
    if (hasPending) {
      return res.status(409).json({
        ok: false,
        message: `La subseccion ${subsection} tiene cantidades en 0. Completa todas antes de bloquear.`,
      });
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
      return res.json({ ok: true, data: { subsection, locked: true, gate: updatedGate } });
    }

    const now = new Date().toISOString();
    metadata.determinations_gate = {
      ...currentGate,
      section_locks: locks,
      updated_at: now,
    };
    await businessCaseService.updateBusinessCase(id, { modern_bc_metadata: metadata });
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
    await businessCaseService.updateBusinessCase(id, { modern_bc_metadata: metadata });

    try {
      const targets = await getUsersByRoles(["jefe_comercial"]);
      await Promise.all(
        targets.map((target) =>
          notificationManager.sendNotification({
            userId: target.id,
            template: "custom_html",
            customTitle: `Solicitud de desbloqueo: ${subsection}`,
            customMessage:
              `${req.user?.email || "Usuario"} solicito desbloquear la subseccion ${subsection} del BC ${id}. Motivo: ${reason}`,
            email: true,
            chat: true,
            source: "business_case.determinations_unlock_request",
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
    await businessCaseService.updateBusinessCase(id, { modern_bc_metadata: metadata });

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
            customMessage: `La solicitud para ${requests[index].subsection} fue ${approve ? "aprobada" : "rechazada"}.`,
            email: true,
            chat: true,
            source: "business_case.determinations_unlock_resolved",
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
    if (!hasTextValue(bc?.process_code)) {
      return res.status(409).json({
        ok: false,
        message: "Debe completar el numero de proceso antes de cargar el documento de estadistica.",
      });
    }
    const ownershipInfo = await BusinessCaseDataOwnership.getOwnershipInfo(id);
    const ownershipRules = buildOwnershipCompletionRules(ownershipInfo);
    const preflowInfo = preflowService.buildPreflowInfo(bc, ownershipRules);
    if (preflowInfo?.isActive && preflowInfo?.isExpired) {
      return res.status(409).json({
        ok: false,
        message:
          "La ventana de 48 horas del comercial expiró. No se puede subir el documento de estadística fuera del plazo.",
      });
    }
    const requiredBeforeUpload = ["general", "lab", "requirement", "equipment", "lis"];
    const readiness = await buildSectionReadinessForDeterminationsUpload(id, bc);
    const missingRequired = requiredBeforeUpload.filter((sectionKey) => !readiness?.[sectionKey]);
    if (missingRequired.length) {
      return res.status(409).json({
        ok: false,
        message:
          `Debes completar las secciones previas hasta LIS antes de subir el documento estadístico. Pendientes: ${missingRequired.join(", ")}.`,
      });
    }
    let preflowProcessResult = null;
    let preflowHandoffResult = null;
    try {
      if (preflowService.isPreflowCase(bc)) {
        await preflowService.ensurePreflowStarted(id, PRE_BC_DURATION_HOURS);
      }
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
    const currentDocument = await determinationsGateService.getCurrentDocument(id);
    const isSameCurrentHash = String(currentDocument?.document_hash_sha256 || "").toLowerCase() === String(fileHash || "").toLowerCase();
    if (isSameCurrentHash) {
      try {
        preflowHandoffResult = await preflowService.completeCommercialStageAndStartReview({
          businessCaseId: id,
          actorUser: req.user,
          durationHours: PRE_BC_DURATION_HOURS,
          reason: "stat_document_reused_same_hash",
        });
      } catch (handoffError) {
        logger.warn(
          { error: handoffError.message, businessCaseId: id },
          "No se pudo cerrar etapa comercial al reutilizar documento de estadistica",
        );
        preflowHandoffResult = {
          skipped: true,
          reason: "handoff_failed",
          message: handoffError.message,
        };
      }
      const gate = determinationsGateService.buildGateInfo({
        businessCase: bc,
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
          preflow_handoff: preflowHandoffResult,
        },
      };
      await completeIdempotentWrite(idempotencySession, responseBody, 200);
      return res.json(responseBody);
    }
    const metadata = bc?.modern_bc_metadata && typeof bc.modern_bc_metadata === "object"
      ? { ...bc.modern_bc_metadata }
      : {};
    const previousGate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
      ? { ...metadata.determinations_gate }
      : {};

    const driveTarget = await ensureBusinessCaseDriveFolder({
      businessCaseId: id,
      clientName: bc?.client_name || "Cliente",
      bcPurchaseType: bc?.bc_purchase_type || "public",
      existingFolderId: bc?.drive_folder_id || null,
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

    await businessCaseService.updateBusinessCase(id, { modern_bc_metadata: metadata });
    try {
      preflowHandoffResult = await preflowService.completeCommercialStageAndStartReview({
        businessCaseId: id,
        actorUser: req.user,
        durationHours: PRE_BC_DURATION_HOURS,
        reason: "stat_document_uploaded",
      });
    } catch (handoffError) {
      logger.warn(
        { error: handoffError.message, businessCaseId: id },
        "No se pudo cerrar etapa comercial tras carga del documento de estadistica",
      );
      preflowHandoffResult = {
        skipped: true,
        reason: "handoff_failed",
        message: handoffError.message,
      };
    }
    const refreshed = await businessCaseService.getBusinessCaseById(id);
    const gate = determinationsGateService.buildGateInfo({
      businessCase: refreshed,
      role,
      now,
      currentDocument: await determinationsGateService.getCurrentDocument(id),
    });
    await notifyDeterminationsGroupedMail({
      businessCase: refreshed,
      gate,
      actorUser: req.user,
    });

    const responseBody = {
      ok: true,
      data: gate,
      meta: {
        process_result: preflowProcessResult,
        preflow_handoff: preflowHandoffResult,
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
    ALTER TABLE equipment_purchases
      ADD COLUMN IF NOT EXISTS paused_reason TEXT DEFAULT NULL
  `);
}

/**
 * Pausa todos los expedientes vinculados al BC (private_purchase_requests + equipment_purchases).
 * Llamado cuando se registra una apelación de factibilidad pendiente.
 */
async function pauseLinkedExpedients(bcId) {
  try {
    await ensureExpedientPausedReasonColumns();
    await db.query(
      `UPDATE private_purchase_requests
          SET paused_reason = 'feasibility_appeal_pending', updated_at = NOW()
        WHERE business_case_id = $1
          AND status NOT IN ('rejected', 'delivered_signed')
          AND paused_reason IS NULL`,
      [bcId],
    );
    await db.query(
      `UPDATE equipment_purchases
          SET paused_reason = 'feasibility_appeal_pending', updated_at = NOW()
        WHERE extra->>'auto_business_case_id' = $1
          AND paused_reason IS NULL`,
      [bcId],
    );
    logger.info({ bcId }, "[BC-17] Expedientes pausados por apelación de factibilidad");
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
    await db.query(
      `UPDATE private_purchase_requests
          SET paused_reason = NULL, updated_at = NOW()
        WHERE business_case_id = $1
          AND paused_reason = 'feasibility_appeal_pending'`,
      [bcId],
    );
    await db.query(
      `UPDATE equipment_purchases
          SET paused_reason = NULL, updated_at = NOW()
        WHERE extra->>'auto_business_case_id' = $1
          AND paused_reason = 'feasibility_appeal_pending'`,
      [bcId],
    );
    logger.info({ bcId }, "[BC-17] Expedientes despausados");
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
    await db.query(
      `UPDATE private_purchase_requests
          SET status = 'rejected',
              paused_reason = NULL,
              updated_at = NOW()
        WHERE business_case_id = $1
          AND status NOT IN ('rejected', 'delivered_signed')`,
      [bcId],
    );
    await db.query(
      `UPDATE equipment_purchases
          SET status = 'rejected',
              paused_reason = NULL,
              updated_at = NOW()
        WHERE extra->>'auto_business_case_id' = $1
          AND status NOT IN ('rejected', 'delivered', 'completed')`,
      [bcId],
    );
    logger.info({ bcId }, "[BC-17] Expedientes cancelados por rechazo definitivo de factibilidad");
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
          customMessage: `${req.user?.email || "Un usuario"} solicita revisión del BC ${id} marcado como no factible. Motivo: ${normalizedReason}`,
          type: "task",
          source: "business_case.feasibility.appeal_requested",
          priority: 2,
          email: true,
          chat: false,
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
            ? `${req.user?.email || "Jefe comercial"} abrió la revisión del BC ${id}. La factibilidad puede ser evaluada nuevamente.`
            : `${req.user?.email || "Jefe comercial"} rechazó tu solicitud de revisión del BC ${id}.${resolvedAppeal.resolution_notes ? ` Motivo: ${resolvedAppeal.resolution_notes}` : ""}`,
          type: Boolean(approved) ? "success" : "alert",
          source: Boolean(approved)
            ? "business_case.feasibility.appeal_approved"
            : "business_case.feasibility.appeal_rejected",
          priority: 2,
          email: true,
          chat: false,
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
      if (!INVESTMENT_VALUES_OP_ROLES.has(userRole)) {
        return res.status(403).json({
          ok: false,
          message: "Solo jefe_operaciones puede cerrar la seccion de inversiones.",
          code: "INVESTMENTS_COMPLETE_ROLE_REQUIRED",
        });
      }
      const cartStatus = getInvestmentCartStatus(businessCase);
      if (!cartStatus.confirmed) {
        return res.status(409).json({
          ok: false,
          message: "Primero debes confirmar el carrito de inversiones.",
          code: "INVESTMENT_CART_NOT_CONFIRMED",
        });
      }
      const selectedInvestments = await investmentsService.getInvestmentValuesByClass(id, "operativa");
      const missingPrices = (selectedInvestments || []).filter((row) => {
        const price = Number(row?.unit_price ?? 0);
        return !Number.isFinite(price) || price <= 0;
      });
      if (missingPrices.length > 0) {
        return res.status(409).json({
          ok: false,
          message: `No se puede cerrar inversiones: faltan ${missingPrices.length} precio(s) en el carrito seleccionado.`,
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

    let metadataAfter = preflowService.toObject(businessCase?.modern_bc_metadata);
    if (preflowService.isPreflowCase(businessCase) && canonicalSection === "general" && !metadataAfter.preflow_started_at) {
      metadataAfter = await preflowService.ensurePreflowStarted(id, PRE_BC_DURATION_HOURS);
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

    // Include deadline info from BC record
    const { rows: bcRows } = await db.query(
      `SELECT invest_selections_changed_at, invest_values_op_deadline_at, invest_values_fin_deadline_at
       FROM equipment_purchase_requests WHERE id = $1`,
      [id]
    );
    const bc = bcRows[0] || {};
    const fullBc = await businessCaseService.getBusinessCaseById(id);
    const cartStatus = getInvestmentCartStatus(fullBc);
    const deadlineAt = investmentClass === 'operativa'
      ? bc.invest_values_op_deadline_at
      : bc.invest_values_fin_deadline_at;

    const selectedCount = Array.isArray(rows) ? rows.length : 0;
    const missingPriceCount = (rows || []).filter((row) => {
      const price = Number(row?.unit_price ?? 0);
      return !Number.isFinite(price) || price <= 0;
    }).length;
    const syncPending = !cartStatus.confirmed || missingPriceCount > 0;
    res.json({
      ok: true,
      data: {
        items: rows,
        deadline_at: deadlineAt || null,
        cart: cartStatus,
        sync_status: {
          pending: syncPending,
          selected_count: selectedCount,
          missing_price_count: missingPriceCount,
          message: !cartStatus.confirmed
            ? "Pendiente de sincronizacion: el carrito aun no ha sido confirmado."
            : syncPending
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

async function saveInvestmentValues(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const bc = await businessCaseService.getBusinessCaseById(id);
    const cartStatus = getInvestmentCartStatus(bc);
    if (!cartStatus.confirmed) {
      return res.status(409).json({ ok: false, message: "Primero se debe confirmar el carrito de inversiones.", code: "INVESTMENT_CART_NOT_CONFIRMED" });
    }
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

    const values = req.body?.values;
    if (!Array.isArray(values) || !values.length) {
      return res.status(400).json({ ok: false, message: 'values es requerido' });
    }

    const saved = await investmentsService.saveInvestmentValuesBatch(id, investmentClass, values, req.user);

    // Auto-sync with Sheets after operational prices update.
    // This keeps BC sheet totals/prices aligned without requiring manual sync click.
    let sheetSync = null;
    if (investmentClass === "operativa") {
      try {
        const syncResult = await sheetGenerationService.enqueueGenerationJob({
          businessCaseId: id,
          input: {},
          user: req.user || null,
          idempotencyKey: `auto:inv-values-op:${id}:${Date.now()}`,
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
  confirmInvestmentCart,
  requestInvestmentQuantityIncrease,
  saveInvestmentSelection,
  getInvestmentValues,
  saveInvestmentValues,
  getConsumptionItems,
  saveConsumptionItems,
  patchConsumptionItem,
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
  lockDeterminationsSubsection,
  requestDeterminationsSubsectionUnlock,
  resolveDeterminationsSubsectionUnlock,
  uploadDeterminationsStatDocument,
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
  saveEquipmentDetails,
  getEquipmentDetails,
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
  // Orchestrator endpoints
  createEconomicBC,
  calculateROI,
  evaluateEconomicApproval,
  attachOperationalData,
  attachLISData,
  recalculateWithOperational,
  validateBC,
  promoteStage,
  emergencyTransition,
  getStateHistory,
  getSectionAccessLog,
  getSectionCompleteness,
  getBcSlaStatus,
  getSlaAtRisk,
  getCompleteBCMaster,
  // Equipment compatibility endpoints
  getCompatibleBackupCandidates,
  validateEquipmentCompatibility,
  getCompatibilityStatistics
};
