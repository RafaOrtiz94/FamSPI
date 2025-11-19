// ============================================================
// 🧭 audit.routes.js
// ------------------------------------------------------------
// Rutas del módulo de Auditoría SPI Fam Project
// Permite listar, consultar y exportar los registros del sistema.
// ============================================================

const express = require("express");
const router = express.Router();
const ctrl = require("./audit.controller");
const { requireRole } = require("../../middlewares/roles");

// ============================================================
// 🔒 Middleware de seguridad
// ------------------------------------------------------------
// Solo usuarios con roles autorizados (TI, Gerencia, Talento Humano)
// pueden acceder a los logs del sistema.
// ============================================================

const allowedRoles = ["ti", "gerencia", "talento_humano"];

// ============================================================
// 📤 Exportar registros en formato CSV
// GET /api/auditoria/export/csv
// ============================================================
router.get("/export/csv", requireRole(["ti", "gerencia"]), ctrl.exportCsv);

// ============================================================
// 📋 Listar registros de auditoría (con filtros)
// GET /api/auditoria
// ============================================================
router.get("/", requireRole(allowedRoles), ctrl.listAudits);

// ============================================================
// 🔍 Obtener detalle individual de un log
// GET /api/auditoria/:id
// ============================================================
router.get("/:id", requireRole(allowedRoles), ctrl.getDetail);

module.exports = router;
