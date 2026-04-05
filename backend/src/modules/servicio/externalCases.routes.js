const express = require("express");
const { requireRole } = require("../../middlewares/auth");
const controller = require("./externalCases.controller");

const router = express.Router();

const READ_ROLES = [
  "ti",
  "jefe_ti",
  "admin_ti",
  "tecnico",
  "servicio_tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "dispatcher",
  "ceac",
  "comercial",
  "jefe_comercial",
  "backoffice_comercial",
  "acp_comercial",
  "gerencia",
  "gerencia_general",
];

const WRITE_ROLES = [
  "ti",
  "jefe_ti",
  "admin_ti",
  "tecnico",
  "servicio_tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "dispatcher",
  "ceac",
  "gerencia",
  "gerencia_general",
];

router.get("/workspace/list", requireRole(READ_ROLES), controller.listWorkspace);
router.get("/workspace/kpi", requireRole(READ_ROLES), controller.kpiWorkspace);
router.get("/providers/health", requireRole(READ_ROLES), controller.getProviderHealth);
router.get("/provider-identities", requireRole(READ_ROLES), controller.listProviderIdentities);
router.post("/provider-identities", requireRole(WRITE_ROLES), controller.upsertProviderIdentity);
router.post("/sync/process-queue", requireRole(WRITE_ROLES), controller.processQueue);
router.post("/inbound/:provider", requireRole(WRITE_ROLES), controller.createInboundCase);
router.post("/", requireRole(WRITE_ROLES), controller.createCase);
router.get("/:id", requireRole(READ_ROLES), controller.getDetail);
router.get("/:id/events", requireRole(READ_ROLES), controller.listEvents);
router.post("/:id/retry-sync", requireRole(WRITE_ROLES), controller.retrySync);
router.post("/:id/reconcile", requireRole(WRITE_ROLES), controller.reconcileState);
router.post("/:id/ceac-decision", requireRole(WRITE_ROLES), controller.postCeacDecision);
router.post("/:id/goapp/milestones/:milestone", requireRole(WRITE_ROLES), controller.postGoAppMilestone);

module.exports = router;
