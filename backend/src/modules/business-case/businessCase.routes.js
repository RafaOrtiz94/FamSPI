const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
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
router.post("/:id/determinations", verifyToken, requireRole(businessCaseRoles), ctrl.addDetermination);
router.put(
  "/:id/determinations/:detId",
  verifyToken,
  requireRole(businessCaseRoles),
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
