const express = require("express");
const router = express.Router();
const controller = require("./servicio.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const workflowReadRoles = [
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
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.getCapacitaciones
);
router.post(
  "/capacitaciones",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.createCapacitacion
);
router.put(
  "/capacitaciones/:id",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.updateCapacitacion
);
router.delete(
  "/capacitaciones/:id",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.deleteCapacitacion
);

// ======================================================
// ✅ DISPONIBILIDAD DE TÉCNICOS
// ======================================================
router.get(
  "/disponibilidad",
  verifyToken,
  requireRole(["servicio_tecnico", "tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.getDisponibilidadTecnicos
);
router.post(
  "/disponibilidad",
  verifyToken,
  requireRole(["servicio_tecnico", "tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.updateDisponibilidadTecnico
);
router.get(
  "/actividades",
  verifyToken,
  requireRole(["servicio_tecnico", "tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia", "comercial", "acp_comercial", "jefe_comercial"]),
  controller.listActividadesTecnicas
);
router.post(
  "/actividades",
  verifyToken,
  requireRole(["servicio_tecnico", "tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.createActividadTecnica
);

// ======================================================
// ⚙️ EQUIPOS
// ======================================================
router.get(
  "/equipos",
  verifyToken,
  requireRole(["tecnico", "gerencia", "jefe_tecnico", "jefe_servicio_tecnico"]),
  controller.getEquipos
);
router.post(
  "/equipos",
  verifyToken,
  requireRole(["tecnico", "gerencia", "jefe_tecnico", "jefe_servicio_tecnico"]),
  controller.createEquipo
);

// ======================================================
// 🛠️ MANTENIMIENTOS
// ======================================================
router.get(
  "/mantenimientos",
  verifyToken,
  requireRole(["tecnico", "gerencia", "jefe_tecnico", "jefe_servicio_tecnico"]),
  controller.getMantenimientos
);

// ======================================================
// 📅 MANTENIMIENTOS ANUALES
// ======================================================
router.get(
  "/mantenimientos-anuales",
  verifyToken,
  requireRole(["tecnico", "gerencia", "jefe_tecnico", "jefe_servicio_tecnico"]),
  controller.getMantenimientosAnuales
);
router.post(
  "/mantenimientos-anuales",
  verifyToken,
  requireRole(["gerencia", "tecnico", "jefe_tecnico", "jefe_servicio_tecnico"]),
  controller.createMantenimientoAnual
);

// ======================================================
// 🧴 DESINFECCIÓN DE INSTRUMENTOS
// ======================================================
router.post(
  "/desinfeccion/pdf",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.generateDisinfectionPDF
);

// ======================================================
// Coordinación de Entrenamiento (PDF)
// ======================================================
router.post(
  "/entrenamiento/pdf",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.generateTrainingCoordinationPDF
);

// ======================================================
// Lista de Asistencia de Entrenamiento (PDF)
// ======================================================
router.post(
  "/entrenamiento/asistencia/pdf",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
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
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.postTrainingWorkflowAction
);
router.post(
  "/entrenamiento/evaluacion/pdf",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.generateTrainingEvaluationPDF
);
router.post(
  "/entrenamiento/evaluacion-especialista/pdf",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.generateTrainingSpecialistEvaluationPDF
);
router.post(
  "/entrenamiento/conformidad/pdf",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.generateTrainingConformityPDF
);
router.post(
  "/entrenamiento/certificado/emitir",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.issueTrainingCertificate
);
router.post(
  "/entrenamiento/certificado/entregar",
  verifyToken,
  requireRole(["tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "gerencia"]),
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
