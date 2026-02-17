const express = require("express");
const router = express.Router();
const controller = require("./servicio.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

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
  requireRole([
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
  ]),
  controller.listWorkflowDocuments
);
router.get(
  "/workflow-documents/summary",
  verifyToken,
  requireRole([
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
  ]),
  controller.listWorkflowDocumentsSummary
);

module.exports = router;
