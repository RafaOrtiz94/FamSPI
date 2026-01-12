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
const { asyncHandler } = require("../../middlewares/asyncHandler");

// ============================================================
// 📊 DASHBOARD COMERCIAL
// ============================================================
router.get(
    "/comercial/summary",
    verifyToken,
    asyncHandler(controller.getCommercialSummary)
);

module.exports = router;