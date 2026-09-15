const express = require("express");
const router = express.Router();
const controller = require("./technicalApplications.controller");
const { requireRole } = require("../../middlewares/roles");

const allowedRoles = [
  "servicio_tecnico",
  "tecnico",
  "ing_servicio",
  "esp_app",
  "jefe_servicio",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "gerencia",
  "administrador",
];

router.get("/available", requireRole(allowedRoles), controller.listAvailable);

module.exports = router;
