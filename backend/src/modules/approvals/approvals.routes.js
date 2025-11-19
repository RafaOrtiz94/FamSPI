const express = require("express");
const router = express.Router();
const ctrl = require("./approvals.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

// Logs para debug (solo en desarrollo)
if (process.env.NODE_ENV === "development") {
  router.use((req, _res, next) => {
    console.log(`➡️ [Approvals] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Forzar respuestas sin caché para evitar 304 con cuerpo vacío
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// 📋 Pendientes de revisión
router.get(
  "/pending",
  verifyToken,
  requireRole(["tecnico", "gerencia"]),
  ctrl.listPending
);

// ✅ Aprobar
router.post(
  "/:id/approve",
  verifyToken,
  requireRole(["jefe_servicio_tecnico", "jefe_tecnico"]),
  ctrl.approve
);

// ❌ Rechazar
router.post(
  "/:id/reject",
  verifyToken,
  requireRole(["jefe_servicio_tecnico", "jefe_tecnico"]),
  ctrl.reject
);

module.exports = router;
