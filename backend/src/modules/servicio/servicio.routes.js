const express = require("express");
const router = express.Router();
const controller = require("./servicio.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const serviceTechnicalCoreRoles = [
  "servicio_tecnico",
  "tecnico",
  "ing_servicio",
  "esp_app",
  "jefe_tecnico",
  "jefe_servicio",
  "jefe_servicio_tecnico",
  "gerencia",
  "gerencia_general",
];

const workflowReadRoles = [
  "ing_servicio",
  "esp_app",
  "jefe_servicio",
  "tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "servicio_tecnico",
  "comercial",
  "acp_comercial",
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
  "operaciones",
  "jefe_operaciones",
  "jefe_logistica",
];
const withdrawalWriteRoles = [
  "ing_servicio",
  "esp_app",
  "jefe_servicio",
  "tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "servicio_tecnico",
  "logistica",
  "jefe_logistica",
  "comercial",
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
];
const correctiveReadRoles = [
  "ing_servicio",
  "esp_app",
  "jefe_servicio",
  "tecnico",
  "servicio_tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "ti",
  "jefe_ti",
  "admin_ti",
  "comercial",
  "jefe_comercial",
  "backoffice_comercial",
  "acp_comercial",
  "gerencia",
  "gerencia_general",
];
const correctiveWriteRoles = [
  "ing_servicio",
  "esp_app",
  "jefe_servicio",
  "tecnico",
  "servicio_tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "ti",
  "jefe_ti",
  "admin_ti",
  "comercial",
  "jefe_comercial",
  "backoffice_comercial",
  "acp_comercial",
  "gerencia",
  "gerencia_general",
];

// Rutas protegidas por verifyToken + requireRole

// ======================================================
// 🧠 CAPACITACIONES
// ======================================================
router.get(
  "/capacitaciones",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.getCapacitaciones
);
router.post(
  "/capacitaciones",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.createCapacitacion
);
router.put(
  "/capacitaciones/:id",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.updateCapacitacion
);
router.delete(
  "/capacitaciones/:id",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.deleteCapacitacion
);

// ======================================================
// ✅ DISPONIBILIDAD DE TÉCNICOS
// ======================================================
router.get(
  "/disponibilidad",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.getDisponibilidadTecnicos
);
router.post(
  "/disponibilidad",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.updateDisponibilidadTecnico
);
router.get(
  "/actividades",
  verifyToken,
  requireRole([...serviceTechnicalCoreRoles, "comercial", "acp_comercial", "jefe_comercial"]),
  controller.listActividadesTecnicas
);
router.post(
  "/actividades",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.createActividadTecnica
);
router.get(
  "/cronograma/feed",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.getTechnicalScheduleFeed
);
router.get(
  "/action-queue",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.getActionQueue
);

// ======================================================
// ⚙️ EQUIPOS
// ======================================================
router.get(
  "/equipos",
  verifyToken,
  requireRole([...serviceTechnicalCoreRoles, "ti", "jefe_ti", "admin_ti"]),
  controller.getEquipos
);
router.post(
  "/equipos",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.createEquipo
);

// ======================================================
// 🛠️ MANTENIMIENTOS
// ======================================================
router.get(
  "/mantenimientos",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.getMantenimientos
);

// ======================================================
// 📅 MANTENIMIENTOS ANUALES
// ======================================================
router.get(
  "/mantenimientos-anuales",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.getMantenimientosAnuales
);
router.post(
  "/mantenimientos-anuales",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.createMantenimientoAnual
);

// ======================================================
// 🧴 DESINFECCIÓN DE INSTRUMENTOS
// ======================================================
router.post(
  "/desinfeccion/pdf",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.generateDisinfectionPDF
);

// ======================================================
// Coordinación de Entrenamiento (PDF)
// ======================================================
router.post(
  "/entrenamiento/pdf",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.generateTrainingCoordinationPDF
);

// ======================================================
// Lista de Asistencia de Entrenamiento (PDF)
// ======================================================
router.post(
  "/entrenamiento/asistencia/pdf",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.generateAttendanceListPDF
);

router.get(
  "/entrenamiento/workflow",
  verifyToken,
  requireRole(workflowReadRoles),
  controller.getTrainingWorkflowStatus
);
router.post(
  "/entrenamiento/workflow",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.postTrainingWorkflowAction
);
router.post(
  "/entrenamiento/evaluacion/pdf",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.generateTrainingEvaluationPDF
);
router.post(
  "/entrenamiento/evaluacion-especialista/pdf",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.generateTrainingSpecialistEvaluationPDF
);
router.post(
  "/entrenamiento/conformidad/pdf",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.generateTrainingConformityPDF
);
router.post(
  "/entrenamiento/certificado/emitir",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.issueTrainingCertificate
);
router.post(
  "/entrenamiento/certificado/entregar",
  verifyToken,
  requireRole(serviceTechnicalCoreRoles),
  controller.deliverTrainingCertificate
);

router.get(
  "/withdrawal/workflow/list",
  verifyToken,
  requireRole(workflowReadRoles),
  controller.listWithdrawalWorkflowStatus
);
router.get(
  "/withdrawal/workflow",
  verifyToken,
  requireRole(workflowReadRoles),
  controller.getWithdrawalWorkflowStatus
);
router.post(
  "/withdrawal/workflow",
  verifyToken,
  requireRole(withdrawalWriteRoles),
  controller.postWithdrawalWorkflowAction
);
router.post(
  "/withdrawal/fst11/pdf",
  verifyToken,
  requireRole(withdrawalWriteRoles),
  controller.generateWithdrawalActPDF
);

// ======================================================
// Mantenimientos correctivos ST-01-03 (CEAC + dispatcher)
// ======================================================
router.post(
  "/corrective-cases",
  verifyToken,
  requireRole(correctiveWriteRoles),
  controller.createCorrectiveCaseController
);
router.get(
  "/corrective-cases/workspace/list",
  verifyToken,
  requireRole(correctiveReadRoles),
  controller.listCorrectiveCasesWorkspaceController
);
router.get(
  "/corrective-cases/workspace/kpi",
  verifyToken,
  requireRole(correctiveReadRoles),
  controller.getCorrectiveCasesWorkspaceKpisController
);
router.get(
  "/corrective-cases/:id",
  verifyToken,
  requireRole(correctiveReadRoles),
  controller.getCorrectiveCaseDetailController
);
router.get(
  "/corrective-cases/:id/timeline",
  verifyToken,
  requireRole(correctiveReadRoles),
  controller.listCorrectiveCaseTimelineController
);
router.get(
  "/corrective-cases/:id/events",
  verifyToken,
  requireRole(correctiveReadRoles),
  controller.listCorrectiveCaseEventsController
);
router.get(
  "/corrective-cases/:id/comments",
  verifyToken,
  requireRole(correctiveReadRoles),
  controller.listCorrectiveCaseCommentsController
);
router.post(
  "/corrective-cases/:id/comments",
  verifyToken,
  requireRole(correctiveWriteRoles),
  controller.addCorrectiveCaseCommentController
);
router.get(
  "/corrective-cases/:id/evidences",
  verifyToken,
  requireRole(correctiveReadRoles),
  controller.listCorrectiveCaseEvidencesController
);
router.post(
  "/corrective-cases/:id/actions",
  verifyToken,
  requireRole(correctiveWriteRoles),
  controller.postCorrectiveCaseActionController
);

// ======================================================
// Verificación de Equipos Nuevos (PDF)
// ======================================================
router.post(
  "/entrenamiento/verificacion/pdf",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.generateEquipmentVerificationPDF
);

router.get(
  "/workflow-documents",
  verifyToken,
  requireRole(workflowReadRoles),
  controller.listWorkflowDocuments
);
router.get(
  "/workflow-documents/summary",
  verifyToken,
  requireRole(workflowReadRoles),
  controller.listWorkflowDocumentsSummary
);
router.get(
  "/workflow/reporting-summary",
  verifyToken,
  requireRole(workflowReadRoles),
  controller.getWorkflowReportingSummary
);
router.get(
  "/workflow/catalog",
  verifyToken,
  requireRole(workflowReadRoles),
  controller.getWorkflowCatalog
);
router.get(
  "/workflow/state-machines",
  verifyToken,
  requireRole(workflowReadRoles),
  controller.getWorkflowStateMachines
);
router.get(
  "/workflow/registry",
  verifyToken,
  requireRole(workflowReadRoles),
  controller.getWorkflowRegistryStatus
);
router.post(
  "/workflow/registry",
  verifyToken,
  requireRole(["jefe_tecnico", "jefe_servicio_tecnico", "gerencia", "gerencia_general"]),
  controller.upsertWorkflowRegistryStatus
);
router.get(
  "/workflow/timeline",
  verifyToken,
  requireRole(workflowReadRoles),
  controller.getWorkflowTimelineEvents
);

module.exports = router;
