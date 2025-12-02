const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const clientsController = require("./clients.controller");

router.use(verifyToken);

router.get("/", clientsController.listClients);

router.post(
  "/:id/assign",
  requireRole(["jefe_comercial", "gerencia", "gerente", "admin", "administrador", "ti"]),
  clientsController.assignClient,
);

router.post("/:id/visit-status", clientsController.setVisitStatus);

module.exports = router;
