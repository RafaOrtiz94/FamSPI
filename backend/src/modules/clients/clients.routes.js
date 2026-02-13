const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const clientsController = require("./clients.controller");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);

router.get("/", clientsController.listClients);
router.get("/:id", clientsController.getClientDetail);

router.put(
  "/:id",
  requireRole([
    "comercial",
    "acp_comercial",
    "backoffice",
    "backoffice_comercial",
    "jefe_comercial",
    "gerencia",
    "gerente",
    "admin",
    "administrador",
    "ti",
  ]),
  upload.fields([
    { name: "legal_rep_appointment_file", maxCount: 1 },
    { name: "ruc_file", maxCount: 1 },
    { name: "id_file", maxCount: 1 },
    { name: "operating_permit_file", maxCount: 1 },
    { name: "consent_evidence_file", maxCount: 1 },
  ]),
  clientsController.updateClient,
);

router.post(
  "/:id/assign",
  requireRole(["jefe_comercial", "gerencia", "gerente", "admin", "administrador", "ti"]),
  clientsController.assignClient,
);

router.post("/:id/visit-status", clientsController.setVisitStatus);

router.post("/prospect-visit", clientsController.registerProspectVisit);

module.exports = router;
