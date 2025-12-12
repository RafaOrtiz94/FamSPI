const express = require("express");
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

const businessCaseRoles = ["comercial", "acp_comercial", "gerencia", "jefe_tecnico"];
const adminRoles = ["admin", "gerencia", "jefe_tecnico"];

const router = express.Router();

router.get("/", verifyToken, requireRole(businessCaseRoles), ctrl.list);
router.post("/", verifyToken, requireRole(["comercial"]), ctrl.create);
router.get("/:id", verifyToken, requireRole(businessCaseRoles), ctrl.getById);
router.put("/:id", verifyToken, requireRole(businessCaseRoles), ctrl.update);
router.delete("/:id", verifyToken, requireRole(["gerencia", "admin"]), ctrl.remove);

router.post("/:id/equipment", verifyToken, requireRole(businessCaseRoles), ctrl.selectEquipment);
router.get("/:id/determinations", verifyToken, requireRole(businessCaseRoles), ctrl.getDeterminations);
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

// Investment routes
router.get("/:id/investments", verifyToken, requireRole(businessCaseRoles), ctrl.getInvestments);
router.post("/:id/investments", verifyToken, requireRole(businessCaseRoles), ctrl.addInvestment);
router.put("/:id/investments/:invId", verifyToken, requireRole(businessCaseRoles), ctrl.updateInvestment);
router.delete("/:id/investments/:invId", verifyToken, requireRole(businessCaseRoles), ctrl.deleteInvestment);

// Manual BC Form routes
router.get("/:id/complete", verifyToken, requireRole(businessCaseRoles), ctrl.getComplete);
router.post("/:id/lab-environment", verifyToken, requireRole(businessCaseRoles), ctrl.saveLabEnvironment);
router.get("/:id/lab-environment", verifyToken, requireRole(businessCaseRoles), ctrl.getLabEnvironment);
router.post("/:id/equipment-details", verifyToken, requireRole(businessCaseRoles), ctrl.saveEquipmentDetails);
router.get("/:id/equipment-details", verifyToken, requireRole(businessCaseRoles), ctrl.getEquipmentDetails);
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
  requireRole(adminRoles),
  determinationsCatalogCtrl.create,
);
determinationsCatalogRoutes.put(
  "/:id",
  verifyToken,
  requireRole(adminRoles),
  determinationsCatalogCtrl.update,
);
determinationsCatalogRoutes.delete(
  "/:id",
  verifyToken,
  requireRole(adminRoles),
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
