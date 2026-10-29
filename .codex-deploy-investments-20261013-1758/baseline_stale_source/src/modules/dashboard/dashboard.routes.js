/**
 * ============================================================
 * 🛣️ Routes: Dashboard (Paneles de Control)
 * ------------------------------------------------------------
 * Define rutas para endpoints de métricas y resúmenes.
 * Todas las rutas requieren autenticación previa.
 * ============================================================
 */

const express = require("express");
const router = express.Router();
const controller = require("./dashboard.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const { asyncHandler } = require("../../middlewares/asyncHandler");

const COMMERCIAL_DASHBOARD_ROLES = [
  "comercial",
  "jefe_comercial",
  "backoffice_comercial",
  "acp_comercial",
  "analista_comercial",
  "gerencia",
];

// ============================================================
// 📊 DASHBOARD COMERCIAL
// ============================================================
router.get(
  "/comercial/summary",
  verifyToken,
  requireRole(COMMERCIAL_DASHBOARD_ROLES),
  asyncHandler(controller.getCommercialSummary)
);

module.exports = router;
