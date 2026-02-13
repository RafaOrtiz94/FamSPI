const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./viaticos.controller");

const router = express.Router();

router.use(verifyToken);
router.use(requireRole(["finanzas", "comercial", "backoffice_comercial", "servicio_tecnico", "tecnico"]));

router.get("/candidates", controller.listCandidates);
router.get("/", controller.list);
router.post("/", controller.upsert);
router.patch("/:id/status", requireRole(["finanzas"]), controller.updateStatus);
router.get("/:id/documents", controller.listDocuments);
router.post("/:id/documents", controller.addDocument);
router.get("/:id/report", requireRole(["finanzas"]), controller.report);

module.exports = router;
