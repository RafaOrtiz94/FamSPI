const express = require("express");
const router = express.Router();
const { rateLimit } = require("express-rate-limit");
const controller = require("./permisos.controller");
const { verifyToken } = require("../../middlewares/auth");

const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id ? `uid:${req.user.id}` : req.ip),
  message: { ok: false, code: "PERMISOS_CREATE_RATE_LIMIT", message: "Demasiadas solicitudes en poco tiempo. Intenta en unos segundos." },
});

const approvalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id ? `uid:${req.user.id}` : req.ip),
  message: { ok: false, code: "PERMISOS_APPROVAL_RATE_LIMIT", message: "Demasiadas acciones de aprobación en poco tiempo." },
});

const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id ? `uid:${req.user.id}` : req.ip),
  message: { ok: false, code: "PERMISOS_UPLOAD_RATE_LIMIT", message: "Demasiadas subidas de archivos. Intenta en unos minutos." },
});

// Verificación legal pública por token
router.get("/legal-verification/:token", controller.verifyLegalToken);

router.use(verifyToken);

// Crear solicitud (permiso o vacación)
router.post("/", createLimiter, controller.create);
router.post("/estudios/matricula", (req, res, next) => {
  controller.upload.single("matricula")(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    next();
  });
}, controller.registerStudyEnrollment);
router.get("/estudios/matricula/activa", controller.getActiveStudyEnrollment);
router.get("/estudios/matriculas", controller.listMyStudyEnrollments);
router.get("/estudios/matriculas/pendientes", controller.listPendingStudyEnrollments);
router.post("/estudios/matriculas/:id/revisar", controller.reviewStudyEnrollment);

// Aprobación parcial (jefe)
router.post("/:id/aprobar-parcial", approvalLimiter, controller.aprobarParcial);

// Subir justificantes (colaborador) - con multer para archivos
router.post("/:id/justificantes", uploadLimiter, (req, res, next) => {
  controller.upload.any()(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    next();
  });
}, controller.uploadJustificantes);

// Revisar justificantes (jefe aprobador: aceptar / observar / rechazar)
router.post("/:id/justificantes/revisar", approvalLimiter, controller.revisarJustificantes);

// Aprobación final (jefe)
router.post("/:id/aprobar-final", approvalLimiter, controller.aprobarFinal);

// Rechazar
router.post("/:id/rechazar", approvalLimiter, controller.rechazar);
router.post("/:id/cancelar", approvalLimiter, controller.cancelar);
router.post("/:id/cancelar/revisar", approvalLimiter, controller.revisarCancelacion);
router.post("/:id/recovery-plan", controller.updateRecoveryPlan);

// Listar pendientes (jefes)
router.get("/pendientes", controller.listarPendientes);

// Listar mis solicitudes
router.get("/mis-solicitudes", controller.listarMias);

// Resumen por colaborador (talento humano / gerencia)
router.get("/resumen-colaboradores", controller.listarResumenColaboradores);

// Métrica de cobertura legal de firmas avanzadas
router.get("/legal-coverage", controller.getLegalCoverage);

// Resolución de regularización urgente (TH/admin)
router.post("/:id/regularizar", controller.resolverRegularizacion);
router.post("/:id/regularizar/convertir-vacaciones", controller.convertirAVacaciones);

// Reportes TH/gerencia
router.get("/reporte-periodo", controller.getReportePeriodo);
router.get("/kpis", controller.getKpiDashboard);

module.exports = router;
