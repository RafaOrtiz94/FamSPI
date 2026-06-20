const express = require("express");
const multer = require("multer");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const {
  validateDeterminationEquipment,
  validateEquipmentCapacity,
} = require("../../middlewares/businessCaseValidation");
const ctrl = require("./businessCase.controller");
const equipmentCatalogCtrl = require("./equipmentCatalog.controller");
const determinationsCatalogCtrl = require("./determinationsCatalog.controller");
const calculationTemplatesCtrl = require("./calculationTemplates.controller");
const observabilityService = require("./businessCaseObservability.service");
const sheetGenerationCtrl = require("./businessCaseSheetGeneration.controller");

// BC-01: Roles que pueden VER y participar en el BC (todos los involucrados)
// BC-02/BC-10: analista_comercial = asesor_comercial = comercial / jefe_ti agregado
// BUG-06: operaciones (base) agregado — necesita acceder a dispatch_workspace en BC
const businessCaseRoles = [
  "comercial",
  "asesor_comercial",
  "analista_comercial",   // BC-02: mismo nivel que comercial
  "acp_comercial",
  "backoffice",
  "backoffice_comercial",
  "jefe_comercial",
  "jefe_de_comercial",
  "jefe_operaciones",
  "operaciones",          // BUG-06: necesita editar dispatch_workspace en BC
  "jefe_tecnico",
  "jefe_financiero",      // BC-02: ve el BC desde BORRADOR
  "jefe_ti",              // BC-10: puede ver y agregar ítems al carrito
  "gerencia",
  "gerencia_general",
];
// BC-10: investmentRoles — quienes pueden agregar ítems al carrito de inversiones
const investmentRoles = [
  "comercial",
  "asesor_comercial",
  "analista_comercial",
  "acp_comercial",
  "backoffice",
  "backoffice_comercial",
  "jefe_comercial",
  "jefe_de_comercial",
  "jefe_operaciones",
  "jefe_tecnico",
  "jefe_financiero",
  "jefe_ti",              // BC-10: puede agregar ítems al carrito
  "gerencia",
  "gerencia_general",
];
// BC-12: Solo jefe_operaciones y jefe_financiero GUARDAN valores
// jefe_comercial y gerencia solo VER — la separación GET/POST se hace aquí
const investmentValuesRoles = [
  "jefe_operaciones",
  "jefe_de_operaciones",
  "jefe_financiero",
  "gerencia",
  "gerencia_general",
  "jefe_comercial",       // BC-12: puede VER valores (no guardar — validar en servicio)
];
const adminRoles = ["admin", "gerencia", "jefe_tecnico"];
const determinationsCatalogWriteRoles = [
  "admin",
  "gerencia",
  "jefe_tecnico",
  "comercial",
  "acp_comercial",
];

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Audit middleware factory for sensitive section access (REQ-BC-12)
const auditAccessService = require('./businessCaseSectionAccessAudit.service');
const auditSection = (section, accessType = 'read') => (req, _res, next) => {
  const businessCaseId = req.params.id;
  const userId = req.user?.id;
  if (businessCaseId && userId) {
    auditAccessService.logAccess({
      businessCaseId,
      userId,
      userRole: req.user?.role,
      section,
      accessType,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent']
    });
  }
  next();
};

router.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    observabilityService.recordApiCall({
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});

router.post(
  "/observability/frontend-events",
  verifyToken,
  requireRole(businessCaseRoles),
  ctrl.ingestFrontendObservabilityEvents,
);
router.get(
  "/observability/metrics",
  verifyToken,
  requireRole(["admin", "administrador", "gerencia", "jefe_comercial", "jefe_tecnico", "gerencia_general"]),
  ctrl.getObservabilityMetrics,
);
router.get(
  "/observability/dashboard",
  verifyToken,
  requireRole(["admin", "administrador", "gerencia", "gerencia_general", "jefe_comercial", "jefe_tecnico", "jefe_operaciones"]),
  ctrl.getObservabilityDashboard,
);

router.get(
  "/feature-flags/autosave",
  verifyToken,
  requireRole(businessCaseRoles),
  ctrl.getAutosaveFeatureFlags,
);
router.put(
  "/feature-flags/autosave",
  verifyToken,
  requireRole(["admin", "administrador", "gerencia", "gerencia_general", "jefe_comercial", "jefe_tecnico", "jefe_operaciones"]),
  ctrl.upsertAutosaveFeatureFlags,
);

router.get("/", verifyToken, requireRole(businessCaseRoles), ctrl.list);
// BC-01: BC puede ser creado por comercial, asesor_comercial, analista_comercial,
//        acp_comercial, jefe_comercial, backoffice y backoffice_comercial
router.post("/", verifyToken, requireRole([
  "comercial",
  "asesor_comercial",
  "analista_comercial",
  "acp_comercial",
  "jefe_comercial",
  "jefe_de_comercial",
  "backoffice",
  "backoffice_comercial",
]), ctrl.create);
router.get("/:id", verifyToken, requireRole(businessCaseRoles), ctrl.getById);
router.put("/:id", verifyToken, requireRole(businessCaseRoles), ctrl.update);
router.delete("/:id", verifyToken, requireRole(["gerencia", "admin"]), ctrl.remove);

router.post("/:id/equipment", verifyToken, requireRole(businessCaseRoles), ctrl.selectEquipment);
router.get("/:id/determinations", verifyToken, requireRole(businessCaseRoles), ctrl.getDeterminations);
router.get("/:id/determinations/stat-document", verifyToken, requireRole(businessCaseRoles), ctrl.getDeterminationsGateInfo);
router.post("/:id/determinations/lock-subsection", verifyToken, requireRole(businessCaseRoles), ctrl.lockDeterminationsSubsection);
router.post("/:id/determinations/request-unlock-subsection", verifyToken, requireRole(businessCaseRoles), ctrl.requestDeterminationsSubsectionUnlock);
// NUEVO-08: jefe_de_comercial = mismo nivel que jefe_comercial para aprobar desbloqueo de sub-secciones
router.post("/:id/determinations/resolve-unlock-subsection", verifyToken, requireRole(["jefe_comercial", "jefe_de_comercial"]), ctrl.resolveDeterminationsSubsectionUnlock);
router.post("/:id/determinations/reopen-commercial", verifyToken, requireRole(["jefe_comercial", "jefe_de_comercial"]), ctrl.reopenDeterminationsCommercial);
router.post(
  "/:id/determinations/parse-quantities-file",
  verifyToken,
  requireRole(["backoffice_comercial", "jefe_comercial", "jefe_de_comercial"]),
  upload.single("file"),
  ctrl.parseDeterminationsQuantitiesFile,
);
router.post(
  "/:id/determinations/stat-document",
  verifyToken,
  requireRole(businessCaseRoles),
  upload.single("file"),
  ctrl.uploadDeterminationsStatDocument,
);
router.post(
  "/:id/determinations/inspection-request",
  verifyToken,
  requireRole(businessCaseRoles),
  ctrl.requestEnvironmentInspection,
);
router.post(
  "/:id/determinations",
  verifyToken,
  requireRole(businessCaseRoles),
  validateDeterminationEquipment,
  validateEquipmentCapacity,
  ctrl.addDetermination,
);
router.put(
  "/:id/determinations/:detId",
  verifyToken,
  requireRole(businessCaseRoles),
  validateDeterminationEquipment,
  validateEquipmentCapacity,
  ctrl.updateDetermination,
);
router.delete(
  "/:id/determinations/:detId",
  verifyToken,
  requireRole(businessCaseRoles),
  ctrl.removeDetermination,
);

router.get("/:id/calculations", verifyToken, requireRole(businessCaseRoles), ctrl.getCalculations);
router.post("/:id/recalculate", verifyToken, requireRole(businessCaseRoles), ctrl.recalculate);
router.get("/:id/export/pdf", verifyToken, requireRole(businessCaseRoles), ctrl.exportPdf);
router.get("/:id/export/excel", verifyToken, requireRole(businessCaseRoles), ctrl.exportExcel);
// BC-07: Viabilidad — acp_comercial, jefe_comercial y gerencia (ambos niveles = mismo rol)
router.post(
  "/:id/feasibility-decision",
  verifyToken,
  requireRole(["acp_comercial", "jefe_comercial", "jefe_de_comercial", "gerencia", "gerencia_general"]),
  ctrl.submitFeasibilityDecision,
);
router.put("/:id/economic-data", verifyToken, requireRole(businessCaseRoles), ctrl.updateEconomicData);
router.get("/:id/sheets/preview", verifyToken, requireRole(businessCaseRoles), sheetGenerationCtrl.getSheetGenerationPreview);
router.post("/:id/sheets/generate", verifyToken, requireRole(businessCaseRoles), sheetGenerationCtrl.enqueueSheetGeneration);
router.get("/:id/sheets/fallback-excel", verifyToken, requireRole(businessCaseRoles), sheetGenerationCtrl.downloadFallbackExcel);
router.get("/:id/sheets/document-versions", verifyToken, requireRole(businessCaseRoles), sheetGenerationCtrl.getDocumentVersionHistory);
router.get("/:id/sheets/jobs/latest", verifyToken, requireRole(businessCaseRoles), sheetGenerationCtrl.getLatestSheetGenerationJobStatus);
router.get("/:id/sheets/jobs/:jobId", verifyToken, requireRole(businessCaseRoles), sheetGenerationCtrl.getSheetGenerationJobStatus);
router.get("/sheets/metrics", verifyToken, requireRole(adminRoles), sheetGenerationCtrl.getSheetGenerationMetrics);
router.post("/sheets/clear-template-cache", verifyToken, requireRole(adminRoles), ctrl.clearSheetTemplateCache);

// UI Guidance routes (Workspace)
router.get("/:id/ui-guidance", verifyToken, requireRole(businessCaseRoles), ctrl.getUIGuidance);
router.get("/:id/ownership", verifyToken, requireRole(businessCaseRoles), ctrl.getDataOwnership);
router.post("/:id/ownership/complete", verifyToken, requireRole(businessCaseRoles), ctrl.recordSectionCompletion);
// BC-20: Bloqueo/desbloqueo de secciones — solo acp_comercial, jefe_comercial (públicas) y backoffice (privadas)
// NUEVO-07: jefe_de_comercial = mismo nivel que jefe_comercial → debe poder bloquear/desbloquear
router.post("/:id/sections/:section/lock", verifyToken, requireRole(["acp_comercial", "backoffice", "backoffice_comercial", "jefe_comercial", "jefe_de_comercial"]), ctrl.lockSection);
router.post("/:id/sections/:section/unlock", verifyToken, requireRole(["acp_comercial", "backoffice", "backoffice_comercial", "jefe_comercial", "jefe_de_comercial"]), ctrl.unlockSection);
router.post("/:id/preflow/reopen-request", verifyToken, requireRole(businessCaseRoles), ctrl.requestPreflowReopen);
router.post(
  "/:id/preflow/reopen-decision",
  verifyToken,
  // NUEVO-09: jefe_de_comercial = mismo nivel que jefe_comercial para aprobar reapertura de preflow
  requireRole(["jefe_comercial", "jefe_de_comercial", "gerencia", "gerencia_general"]),
  ctrl.resolvePreflowReopen,
);
// BC-16: Apelación de factibilidad rechazada — comercial* solicita revisión; jefe_comercial/gerencia resuelve
router.post(
  "/:id/feasibility/appeal",
  verifyToken,
  requireRole(["comercial", "asesor_comercial", "analista_comercial"]),
  ctrl.requestFeasibilityAppeal,
);
router.post(
  "/:id/feasibility/appeal/resolve",
  verifyToken,
  requireRole(["jefe_comercial", "jefe_de_comercial", "gerencia", "gerencia_general"]),
  ctrl.resolveFeasibilityAppeal,
);

// Investment routes (audited — REQ-BC-12)
router.get("/:id/investments", verifyToken, requireRole(businessCaseRoles), auditSection('investments', 'read'), ctrl.getInvestments);
router.post("/:id/investments", verifyToken, requireRole(businessCaseRoles), auditSection('investments', 'write'), ctrl.addInvestment);
router.put("/:id/investments/:invId", verifyToken, requireRole(businessCaseRoles), auditSection('investments', 'write'), ctrl.updateInvestment);
router.delete("/:id/investments/:invId", verifyToken, requireRole(businessCaseRoles), auditSection('investments', 'write'), ctrl.deleteInvestment);
router.get("/:id/investments/catalog", verifyToken, requireRole(investmentRoles), ctrl.getInvestmentCatalog);
router.post("/:id/investments/catalog", verifyToken, requireRole(investmentRoles), ctrl.createInvestmentCatalogItem);
router.post("/:id/investments/selections", verifyToken, requireRole(investmentRoles), ctrl.saveInvestmentSelection);
router.post("/:id/investments/selections/request-increase", verifyToken, requireRole(investmentRoles), ctrl.requestInvestmentQuantityIncrease);
router.post("/:id/investments/confirm-cart", verifyToken, requireRole(investmentRoles), ctrl.confirmInvestmentCart);
router.get("/:id/investments/values", verifyToken, requireRole(investmentValuesRoles), ctrl.getInvestmentValues);
router.post("/:id/investments/values", verifyToken, requireRole(investmentValuesRoles), ctrl.saveInvestmentValues);
router.get("/:id/consumption-items", verifyToken, requireRole(businessCaseRoles), ctrl.getConsumptionItems);
router.put("/:id/consumption-items", verifyToken, requireRole(businessCaseRoles), ctrl.saveConsumptionItems);
router.patch("/:id/consumption-items/:itemKey", verifyToken, requireRole(businessCaseRoles), ctrl.patchConsumptionItem);
router.get("/:id/dispatch-workspace", verifyToken, requireRole(businessCaseRoles), ctrl.getDispatchWorkspace);
router.put(
  "/:id/dispatch-workspace/commercial-plan",
  verifyToken,
  // BUG-07: acp_comercial y jefe_de_comercial también editan el plan comercial de dispatch
  requireRole(["acp_comercial", "jefe_comercial", "jefe_de_comercial", "gerencia", "gerencia_general"]),
  ctrl.saveCommercialDispatchPlan,
);
router.put(
  "/:id/dispatch-workspace/operations-control",
  verifyToken,
  // BUG-07: acp_comercial, jefe_comercial y operaciones (base) también guardan control operativo
  requireRole(["acp_comercial", "jefe_comercial", "jefe_de_comercial", "jefe_operaciones", "operaciones", "gerencia", "gerencia_general"]),
  ctrl.saveOperationsDispatchControl,
);

// Manual BC Form routes
router.get("/:id/complete", verifyToken, requireRole(businessCaseRoles), ctrl.getComplete);
router.post("/:id/lab-environment", verifyToken, requireRole(businessCaseRoles), ctrl.saveLabEnvironment);
router.get("/:id/lab-environment", verifyToken, requireRole(businessCaseRoles), ctrl.getLabEnvironment);
router.post("/:id/equipment-details", verifyToken, requireRole(businessCaseRoles), ctrl.saveEquipmentDetails);
router.get("/:id/equipment-details", verifyToken, requireRole(businessCaseRoles), ctrl.getEquipmentDetails);
router.post("/:id/equipment-details-v2", verifyToken, requireRole(businessCaseRoles), ctrl.saveEquipmentDetailsV2);
router.post("/:id/lis-integration", verifyToken, requireRole(businessCaseRoles), ctrl.saveLisIntegration);
router.get("/:id/lis-integration", verifyToken, requireRole(businessCaseRoles), ctrl.getLisIntegration);
router.post("/:id/lis-integration/equipment-interfaces", verifyToken, requireRole(businessCaseRoles), ctrl.addLisEquipmentInterface);
router.get("/:id/lis-integration/equipment-interfaces", verifyToken, requireRole(businessCaseRoles), ctrl.getLisEquipmentInterfaces);
router.post("/:id/requirements", verifyToken, requireRole(businessCaseRoles), ctrl.saveRequirements);
router.get("/:id/requirements", verifyToken, requireRole(businessCaseRoles), ctrl.getRequirements);
router.post("/:id/deliveries", verifyToken, requireRole(businessCaseRoles), ctrl.saveDeliveries);
router.get("/:id/deliveries", verifyToken, requireRole(businessCaseRoles), ctrl.getDeliveries);

  // Orchestrator routes (Unified BC Workflow)
  router.post("/orchestrator/create-economic", verifyToken, requireRole(businessCaseRoles), ctrl.createEconomicBC);
  router.post("/:id/orchestrator/calculate-roi", verifyToken, requireRole(businessCaseRoles), ctrl.calculateROI);
  router.post("/:id/orchestrator/evaluate-approval", verifyToken, requireRole(businessCaseRoles), ctrl.evaluateEconomicApproval);
  router.post("/:id/orchestrator/attach-operational", verifyToken, requireRole(businessCaseRoles), ctrl.attachOperationalData);
  router.post("/:id/orchestrator/attach-lis", verifyToken, requireRole(businessCaseRoles), ctrl.attachLISData);
  router.post("/:id/orchestrator/recalculate", verifyToken, requireRole(businessCaseRoles), ctrl.recalculateWithOperational);
  router.post("/:id/orchestrator/validate", verifyToken, requireRole(businessCaseRoles), ctrl.validateBC);
  router.post("/:id/orchestrator/promote-stage", verifyToken, requireRole(businessCaseRoles), ctrl.promoteStage);
  router.get("/:id/orchestrator/complete", verifyToken, requireRole(businessCaseRoles), ctrl.getCompleteBCMaster);
  // BC-15: gerencia y gerencia_general son el mismo nivel — ambos pueden hacer emergency-transition
  router.post("/:id/orchestrator/emergency-transition", verifyToken, requireRole(["gerencia", "gerencia_general"]), ctrl.emergencyTransition);
  router.get("/:id/state-history", verifyToken, requireRole(businessCaseRoles), ctrl.getStateHistory);
  router.get("/:id/section-access-log", verifyToken, requireRole(["admin", "gerencia", "gerencia_general", "jefe_comercial"]), ctrl.getSectionAccessLog);
  router.get("/:id/section-completeness", verifyToken, requireRole(businessCaseRoles), ctrl.getSectionCompleteness);
  router.get("/:id/sla", verifyToken, requireRole(businessCaseRoles), ctrl.getBcSlaStatus);
  router.get("/sla/at-risk", verifyToken, requireRole(["admin", "gerencia", "gerencia_general", "jefe_comercial", "jefe_operaciones"]), ctrl.getSlaAtRisk);

  // Equipment compatibility routes (NEW - Automatic backup selection)
  router.get("/equipment/:equipmentId/compatibility/backups", verifyToken, requireRole(businessCaseRoles), ctrl.getCompatibleBackupCandidates);
  router.get("/equipment/:primaryId/:backupId/compatibility/validate", verifyToken, requireRole(businessCaseRoles), ctrl.validateEquipmentCompatibility);
  router.get("/compatibility/statistics", verifyToken, requireRole(adminRoles), ctrl.getCompatibilityStatistics);

  // Equipment catalog
const equipmentCatalogRoutes = express.Router();
equipmentCatalogRoutes.get("/", verifyToken, requireRole(businessCaseRoles), equipmentCatalogCtrl.list);
equipmentCatalogRoutes.get("/:id", verifyToken, requireRole(businessCaseRoles), equipmentCatalogCtrl.getDetails);
equipmentCatalogRoutes.get(
  "/:id/determinations",
  verifyToken,
  requireRole(businessCaseRoles),
  equipmentCatalogCtrl.getDeterminations,
);
equipmentCatalogRoutes.get(
  "/:id/consumables",
  verifyToken,
  requireRole(businessCaseRoles),
  equipmentCatalogCtrl.getConsumables,
);
equipmentCatalogRoutes.post(
  "/:id/consumables",
  verifyToken,
  requireRole(businessCaseRoles),
  equipmentCatalogCtrl.createConsumable,
);
equipmentCatalogRoutes.put(
  "/:id/consumables/:consumableId",
  verifyToken,
  requireRole(businessCaseRoles),
  equipmentCatalogCtrl.updateConsumable,
);
equipmentCatalogRoutes.post(
  "/:id/determinations",
  verifyToken,
  requireRole(businessCaseRoles),
  equipmentCatalogCtrl.createDetermination,
);
equipmentCatalogRoutes.post("/", verifyToken, requireRole(adminRoles), equipmentCatalogCtrl.create);
equipmentCatalogRoutes.put("/:id", verifyToken, requireRole(adminRoles), equipmentCatalogCtrl.update);
equipmentCatalogRoutes.post(
  "/:id/formula",
  verifyToken,
  requireRole(adminRoles),
  equipmentCatalogCtrl.updateFormula,
);

// Determinations catalog
const determinationsCatalogRoutes = express.Router();
determinationsCatalogRoutes.get("/", verifyToken, requireRole(businessCaseRoles), determinationsCatalogCtrl.list);
determinationsCatalogRoutes.get(
  "/:id",
  verifyToken,
  requireRole(businessCaseRoles),
  determinationsCatalogCtrl.getDetails,
);
determinationsCatalogRoutes.post(
  "/",
  verifyToken,
  requireRole(determinationsCatalogWriteRoles),
  determinationsCatalogCtrl.create,
);
determinationsCatalogRoutes.put(
  "/:id",
  verifyToken,
  requireRole(determinationsCatalogWriteRoles),
  determinationsCatalogCtrl.update,
);
determinationsCatalogRoutes.delete(
  "/:id",
  verifyToken,
  requireRole(determinationsCatalogWriteRoles),
  determinationsCatalogCtrl.remove,
);
determinationsCatalogRoutes.post(
  "/:id/formula",
  verifyToken,
  requireRole(adminRoles),
  determinationsCatalogCtrl.updateFormula,
);
determinationsCatalogRoutes.post(
  "/formula/validate",
  verifyToken,
  requireRole(adminRoles),
  determinationsCatalogCtrl.validateFormula,
);

// Calculation templates
const calculationTemplatesRoutes = express.Router();
calculationTemplatesRoutes.get("/", verifyToken, requireRole(businessCaseRoles), calculationTemplatesCtrl.list);
calculationTemplatesRoutes.post("/", verifyToken, requireRole(adminRoles), calculationTemplatesCtrl.create);
calculationTemplatesRoutes.put("/:id", verifyToken, requireRole(adminRoles), calculationTemplatesCtrl.update);
calculationTemplatesRoutes.delete("/:id", verifyToken, requireRole(adminRoles), calculationTemplatesCtrl.remove);
calculationTemplatesRoutes.post(
  "/:id/apply",
  verifyToken,
  requireRole(adminRoles),
  calculationTemplatesCtrl.applyToItem,
);

module.exports = {
  businessCaseRoutes: router,
  equipmentCatalogRoutes,
  determinationsCatalogRoutes,
  calculationTemplatesRoutes,
};
