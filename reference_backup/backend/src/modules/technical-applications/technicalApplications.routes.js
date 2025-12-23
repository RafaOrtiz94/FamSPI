const express = require("express");
const router = express.Router();
const controller = require("./technicalApplications.controller");
const { requireRole } = require("../../middlewares/roles");

const allowedRoles = [
  "servicio_tecnico",
  "tecnico",
  "jefe_servicio_tecnico",
  "gerencia",
  "administrador",
];

router.get("/available", requireRole(allowedRoles), controller.listAvailable);

module.exports = router;
