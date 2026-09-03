const express = require("express");
const controller = require("./opportunities.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const router = express.Router();

const OPPORTUNITY_READ_ROLES = [
  "comercial",
  "asesor_comercial",
  "analista_comercial",
  "backoffice_comercial",
  "acp_comercial",
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
  "director",
  "operaciones",
  "jefe_operaciones",
  "servicio_tecnico",
  "jefe_tecnico",
];

const OPPORTUNITY_WRITE_ROLES = [
  "comercial",
  "asesor_comercial",
  "analista_comercial",
  "backoffice_comercial",
  "acp_comercial",
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
];

router.use(verifyToken);

router.get("/accounts", requireRole(OPPORTUNITY_READ_ROLES), controller.listAccounts);
router.post("/accounts", requireRole(OPPORTUNITY_WRITE_ROLES), controller.createAccount);
router.get("/contacts", requireRole(OPPORTUNITY_READ_ROLES), controller.listContacts);
router.post("/contacts", requireRole(OPPORTUNITY_WRITE_ROLES), controller.createContact);

router.get("/dashboard/manager", requireRole(OPPORTUNITY_READ_ROLES), controller.getManagerDashboard);
router.get("/process-lookup/:type/:processId", requireRole(OPPORTUNITY_READ_ROLES), controller.lookupProcess);

router.get("/", requireRole(OPPORTUNITY_READ_ROLES), controller.listOpportunities);
router.post("/", requireRole(OPPORTUNITY_WRITE_ROLES), controller.createOpportunity);
router.get("/:id", requireRole(OPPORTUNITY_READ_ROLES), controller.getOpportunity);
router.put("/:id", requireRole(OPPORTUNITY_WRITE_ROLES), controller.updateOpportunity);

router.post("/:id/influences", requireRole(OPPORTUNITY_WRITE_ROLES), controller.upsertInfluence);
router.delete("/:id/influences/:influenceId", requireRole(OPPORTUNITY_WRITE_ROLES), controller.deleteInfluence);

router.post("/:id/flags", requireRole(OPPORTUNITY_WRITE_ROLES), controller.upsertFlag);
router.delete("/:id/flags/:flagId", requireRole(OPPORTUNITY_WRITE_ROLES), controller.deleteFlag);

router.post("/:id/competitors", requireRole(OPPORTUNITY_WRITE_ROLES), controller.upsertCompetitor);
router.delete("/:id/competitors/:competitorId", requireRole(OPPORTUNITY_WRITE_ROLES), controller.deleteCompetitor);

router.post("/:id/actions", requireRole(OPPORTUNITY_WRITE_ROLES), controller.upsertAction);
router.delete("/:id/actions/:actionId", requireRole(OPPORTUNITY_WRITE_ROLES), controller.deleteAction);

router.post("/:id/comments", requireRole(OPPORTUNITY_WRITE_ROLES), controller.createComment);
router.delete("/:id/comments/:commentId", requireRole(OPPORTUNITY_WRITE_ROLES), controller.deleteComment);

router.post("/:id/links", requireRole(OPPORTUNITY_WRITE_ROLES), controller.linkProcess);
router.delete("/:id/links/:linkId", requireRole(OPPORTUNITY_WRITE_ROLES), controller.unlinkProcess);

module.exports = router;
