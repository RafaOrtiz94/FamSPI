const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const clientsController = require("./clients.controller");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

const EDIT_CLIENT_ROLES = [
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
];

const ASSIGN_CLIENT_ROLES = ["jefe_comercial", "gerencia", "gerente", "admin", "administrador", "ti"];

const CRM_INTERACTION_ROLES = [
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
];

router.use(verifyToken);

router.get("/", clientsController.listClients);
router.post("/prospect-visit", clientsController.registerProspectVisit);
router.post("/:id/visit-status", clientsController.setVisitStatus);

router.post(
  "/:id/interactions",
  requireRole(CRM_INTERACTION_ROLES),
  clientsController.registerInteraction,
);

router.get(
  "/:id/history",
  requireRole(CRM_INTERACTION_ROLES),
  clientsController.getClientHistory,
);

router.get(
  "/:id/locations",
  requireRole(CRM_INTERACTION_ROLES),
  clientsController.listClientLocations,
);

router.post(
  "/:id/locations",
  requireRole(EDIT_CLIENT_ROLES),
  clientsController.addClientLocation,
);

router.put(
  "/:id/locations/:locationId",
  requireRole(EDIT_CLIENT_ROLES),
  clientsController.updateClientLocation,
);

router.delete(
  "/:id/locations/:locationId",
  requireRole(EDIT_CLIENT_ROLES),
  clientsController.removeClientLocation,
);

router.get("/:id", clientsController.getClientDetail);

router.put(
  "/:id",
  requireRole(EDIT_CLIENT_ROLES),
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
  requireRole(ASSIGN_CLIENT_ROLES),
  clientsController.assignClient,
);

module.exports = router;
