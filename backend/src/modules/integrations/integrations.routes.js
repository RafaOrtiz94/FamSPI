const express = require("express");
const { requireRole } = require("../../middlewares/auth");
const controller = require("./integrations.controller");

const router = express.Router();

const READ_ROLES = [
  "ti",
  "jefe_ti",
  "admin_ti",
  "tecnico",
  "servicio_tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "gerencia",
  "gerencia_general",
];

const WRITE_ROLES = [
  "ti",
  "jefe_ti",
  "admin_ti",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "gerencia",
  "gerencia_general",
];

router.get("/health", requireRole(READ_ROLES), controller.getHealth);
router.post("/external-cases/sync/process-queue", requireRole(WRITE_ROLES), controller.processExternalSyncQueue);

module.exports = router;
