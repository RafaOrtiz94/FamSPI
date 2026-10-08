const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const clientsController = require("./clients.controller");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

// backoffice_comercial: capacidad otorgada via extra_roles a un usuario
// puntual (ver migrations/276_users_extra_roles.sql, ej. lorena.loaiza,
// scope financiero) para manejar clientes igual que jefe_operaciones. El
// frontend (ClientesPage.jsx, FULL_ACCESS_ROLES) ya le mostraba el
// formulario de edicion sin que el backend lo aceptara -- 403 al guardar.
const EDIT_CLIENT_ROLES = ["jefe_operaciones", "jefe_de_operaciones", "backoffice_comercial"];

// backoffice_comercial tambien puede asignar clientes a asesores (ver
// EDIT_CLIENT_ROLES arriba -- mismo caso, extra_roles).
const ASSIGN_CLIENT_ROLES = ["jefe_operaciones", "jefe_de_operaciones", "backoffice_comercial"];

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
  // jefe_operaciones edita clientes (EDIT_CLIENT_ROLES) y esa vista tambien consulta
  // ubicaciones/historial/interacciones.
  "jefe_operaciones",
  "jefe_de_operaciones",
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
    { name: "bpadt_certification_file", maxCount: 1 },
    { name: "operating_permit_file", maxCount: 1 },
    { name: "consent_evidence_file", maxCount: 1 },
    { name: "approval_letter", maxCount: 1 },
    { name: "consent_record", maxCount: 1 },
  ]),
  clientsController.updateClient,
);

router.post(
  "/:id/assign",
  requireRole(ASSIGN_CLIENT_ROLES),
  clientsController.assignClient,
);

module.exports = router;
