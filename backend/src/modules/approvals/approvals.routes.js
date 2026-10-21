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
  requireRole([
    "tecnico",
    "gerencia",
    "calidad",
    "jefe_calidad",
    "jefe_servicio_tecnico",
    "jefe_tecnico",
  ]),
  ctrl.listPending
);

// ✅ Aprobar
// "jefe_servicio" es un grupo en middlewares/roles.js que ya expande a todos
// los alias (jefe_tecnico, jefe_de_tecnico, jefe_servicio_tecnico,
// jefe_de_servicio_tecnico) -- antes el literal "jefe_servicio" no estaba
// en esta lista, asi que nadie con ese rol exacto podia aprobar/coordinar.
router.post(
  "/:id/approve",
  verifyToken,
  requireRole(["jefe_servicio"]),
  ctrl.approve
);

// ❌ Rechazar
router.post(
  "/:id/reject",
  verifyToken,
  requireRole(["jefe_servicio"]),
  ctrl.reject
);

module.exports = router;
