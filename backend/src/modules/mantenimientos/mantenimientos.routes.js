const express = require("express");
const router = express.Router();
const ctrl = require("./mantenimientos.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const multer = require("multer");

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "/tmp/uploads");
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix);
    },
  }),
});

const preventiveReadRoles = [
  "tecnico",
  "servicio_tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "comercial",
  "acp_comercial",
  "jefe_comercial",
  "logistica",
  "jefe_logistica",
  "gerencia",
  "gerencia_general",
];

const preventiveWriteRoles = [
  "tecnico",
  "servicio_tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "comercial",
  "acp_comercial",
  "jefe_comercial",
  "logistica",
  "jefe_logistica",
  "gerencia",
  "gerencia_general",
];

const preventivePlanAdminRoles = [
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
];

// 🧾 Crear mantenimiento (ficha + firma)
router.post(
  "/",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "ti", "jefe_ti", "admin_ti"]),
  upload.fields([
    { name: "firma_responsable", maxCount: 1 },
    { name: "firma_receptor", maxCount: 1 },
    { name: "evidencias", maxCount: 10 },
  ]),
  ctrl.createMantenimiento
);

// 📋 Listar mantenimientos del técnico o general
router.get(
  "/",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia", "ti", "jefe_ti", "admin_ti"]),
  ctrl.listMantenimientos
);
router.post(
  "/ti/annual-schedule/generate",
  verifyToken,
  requireRole(["ti", "jefe_ti", "admin_ti", "gerencia"]),
  ctrl.generateAnnualScheduleForTi,
);

// ======================================================
// ST-01-02 Preventivos - Workspace Empresarial
// ======================================================
router.get(
  "/preventive/annual-plans",
  verifyToken,
  requireRole(preventiveReadRoles),
  ctrl.listPreventiveAnnualPlans,
);
router.post(
  "/preventive/annual-plans",
  verifyToken,
  requireRole(preventivePlanAdminRoles),
  ctrl.createPreventiveAnnualPlan,
);
router.get(
  "/preventive/annual-plans/:planId",
  verifyToken,
  requireRole(preventiveReadRoles),
  ctrl.getPreventiveAnnualPlanDetail,
);
router.post(
  "/preventive/annual-plans/:planId/publish",
  verifyToken,
  requireRole(preventivePlanAdminRoles),
  ctrl.publishPreventiveAnnualPlan,
);
router.post(
  "/preventive/annual-plans/:planId/rebaseline",
  verifyToken,
  requireRole(preventivePlanAdminRoles),
  ctrl.rebaselinePreventiveAnnualPlan,
);
router.post(
  "/preventive/annual-plans/:planId/fst16",
  verifyToken,
  requireRole(preventivePlanAdminRoles),
  ctrl.issueFst16,
);
router.post(
  "/preventive/annual-plans/:planId/monthly-report",
  verifyToken,
  requireRole(preventivePlanAdminRoles),
  ctrl.sendPreventiveMonthlyReport,
);
router.post(
  "/preventive/plan-items/:itemId/fst17",
  verifyToken,
  requireRole(preventiveWriteRoles),
  ctrl.issueFst17,
);
router.post(
  "/preventive/plan-items/:itemId/offer",
  verifyToken,
  requireRole(preventiveWriteRoles),
  ctrl.registerPreventiveOffer,
);
router.post(
  "/preventive/plan-items/:itemId/offer/decision",
  verifyToken,
  requireRole(preventiveWriteRoles),
  ctrl.decidePreventiveOffer,
);
router.post(
  "/preventive/plan-items/:itemId/reprogramming",
  verifyToken,
  requireRole(preventiveWriteRoles),
  ctrl.registerReprogrammingNotice,
);
router.post(
  "/preventive/plan-items/:itemId/coordination",
  verifyToken,
  requireRole(preventiveWriteRoles),
  ctrl.registerPreventiveCoordination,
);
router.post(
  "/preventive/plan-items/:itemId/work-order",
  verifyToken,
  requireRole(preventiveWriteRoles),
  ctrl.registerPreventiveWorkOrder,
);
router.post(
  "/preventive/plan-items/:itemId/kits",
  verifyToken,
  requireRole(preventiveWriteRoles),
  ctrl.requestPreventiveKit,
);
router.post(
  "/preventive/kits/:kitId/warehouse-exit",
  verifyToken,
  requireRole(preventiveWriteRoles),
  ctrl.registerKitWarehouseExit,
);
router.post(
  "/preventive/plan-items/:itemId/close",
  verifyToken,
  requireRole(preventiveWriteRoles),
  ctrl.closePreventiveExecution,
);
router.get(
  "/preventive/compliance",
  verifyToken,
  requireRole(preventiveReadRoles),
  ctrl.getPreventiveComplianceDashboard,
);
router.get(
  "/preventive/capacity",
  verifyToken,
  requireRole(preventiveReadRoles),
  ctrl.getPreventiveCapacityDashboard,
);
router.get(
  "/preventive/timeline",
  verifyToken,
  requireRole(preventiveReadRoles),
  ctrl.getPreventiveTimeline,
);
router.get(
  "/preventive/history",
  verifyToken,
  requireRole(preventiveReadRoles),
  ctrl.getPreventiveHistory,
);

// 🔍 Detalle completo
router.get("/:id", verifyToken, ctrl.getDetail);

// 🖊️ Firmar posteriormente
router.post("/:id/sign", verifyToken, requireRole(["gerencia", "tecnico"]), ctrl.sign);
router.post("/:id/sign-advanced", verifyToken, requireRole(["gerencia", "tecnico"]), ctrl.signAdvanced);

// ✅ Aprobar mantenimiento (gerencia)
router.post("/:id/approve", verifyToken, requireRole(["gerencia"]), ctrl.approve);

// 📄 Exportar a PDF manualmente
router.post("/:id/export", verifyToken, requireRole(["tecnico", "gerencia"]), ctrl.exportPdf);

module.exports = router;
