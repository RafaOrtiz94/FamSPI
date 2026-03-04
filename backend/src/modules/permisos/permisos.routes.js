const express = require("express");
const router = express.Router();
const controller = require("./permisos.controller");
const { verifyToken } = require("../../middlewares/auth");

// Verificación legal pública por token
router.get("/legal-verification/:token", controller.verifyLegalToken);

router.use(verifyToken);

// Crear solicitud (permiso o vacación)
router.post("/", controller.create);
router.post("/estudios/matricula", controller.upload.single("matricula"), controller.registerStudyEnrollment);
router.get("/estudios/matricula/activa", controller.getActiveStudyEnrollment);
router.get("/estudios/matriculas", controller.listMyStudyEnrollments);
router.get("/estudios/matriculas/pendientes", controller.listPendingStudyEnrollments);
router.post("/estudios/matriculas/:id/revisar", controller.reviewStudyEnrollment);

// Aprobación parcial (jefe)
router.post("/:id/aprobar-parcial", controller.aprobarParcial);

// Subir justificantes (colaborador) - con multer para archivos
router.post("/:id/justificantes", controller.upload.any(), controller.uploadJustificantes);

// Aprobación final (jefe)
router.post("/:id/aprobar-final", controller.aprobarFinal);

// Rechazar
router.post("/:id/rechazar", controller.rechazar);
router.post("/:id/cancelar", controller.cancelar);
router.post("/:id/cancelar/revisar", controller.revisarCancelacion);
router.post("/:id/recovery-plan", controller.updateRecoveryPlan);

// Listar pendientes (jefes)
router.get("/pendientes", controller.listarPendientes);

// Listar mis solicitudes
router.get("/mis-solicitudes", controller.listarMias);

// Resumen por colaborador (talento humano / gerencia)
router.get("/resumen-colaboradores", controller.listarResumenColaboradores);

// Métrica de cobertura legal de firmas avanzadas
router.get("/legal-coverage", controller.getLegalCoverage);

module.exports = router;
