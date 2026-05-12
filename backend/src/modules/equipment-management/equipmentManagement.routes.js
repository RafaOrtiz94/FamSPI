const express = require("express");
const router = express.Router();
const controller = require("./equipmentManagement.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const READ_ROLES = [
  "comercial",
  "jefe_comercial",
  "backoffice_comercial",
  "acp_comercial",
  "servicio_tecnico",
  "tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "operaciones",
  "jefe_operaciones",
  "logistica",
  "jefe_logistica",
  "gerencia",
  "gerencia_general",
  "ti",
  "admin_ti",
  "admin",
];

const ASSET_ROLES = [
  "backoffice_comercial",
  "acp_comercial",
  "servicio_tecnico",
  "tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "operaciones",
  "jefe_operaciones",
  "logistica",
  "jefe_logistica",
  "gerencia",
  "gerencia_general",
  "ti",
  "admin_ti",
  "admin",
];

const MODEL_ROLES = [
  "jefe_comercial",
  "acp_comercial",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "gerencia",
  "gerencia_general",
  "ti",
  "admin_ti",
  "admin",
];

router.use(verifyToken);
router.use(requireRole(READ_ROLES));

router.get("/statuses", controller.listStatuses);
router.get("/models", controller.listModels);
router.get("/models/:id", controller.getModelDetail);
router.get("/assets", controller.listAssets);
router.get("/assets/:id/timeline", controller.listAssetTimeline);
router.get("/schedule", controller.listSchedule);

router.post("/assets", requireRole(ASSET_ROLES), controller.createAsset);
router.post("/assets/:id/status", requireRole(ASSET_ROLES), controller.changeAssetStatus);
router.post("/assets/:id/reserve", requireRole(ASSET_ROLES), controller.reserveAsset);
router.post("/assets/:id/install", requireRole(ASSET_ROLES), controller.installAsset);

router.post("/procedures", requireRole(MODEL_ROLES), controller.createProcedure);
router.post("/parts", requireRole(MODEL_ROLES), controller.createPart);
router.post("/procedures/:id/parts", requireRole(MODEL_ROLES), controller.attachPartToProcedure);

module.exports = router;
