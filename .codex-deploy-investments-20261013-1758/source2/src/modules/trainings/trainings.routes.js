const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./trainings.controller");

router.use(verifyToken);

// Bloquea ing_servicio_ext / esp_app_ext en rutas de escritura.
// Incluye todos los grupos internos; ext_users no está en ninguno de ellos.
const requireInternalUser = requireRole([
  "admin", "gerencia", "talento_humano", "ti",
  "servicio_tecnico", "comercial", "finanzas", "operaciones", "calidad",
]);

// ---------------------------------------------------------------------------
// CRUD — lectura abierta a todos; escritura solo usuarios internos
// ---------------------------------------------------------------------------
router.post("/",   requireInternalUser, controller.createTrainingController);
router.get("/",                         controller.listTrainingsController);
router.get("/participants",             controller.listParticipantsController);
router.get("/me/assigned",              controller.getMyAssignedController);
router.get("/:id",                      controller.getTrainingController);
router.put("/:id", requireInternalUser, controller.updateTrainingController);
router.delete("/:id", requireInternalUser, controller.cancelTrainingController);

// ---------------------------------------------------------------------------
// Asistentes
// ---------------------------------------------------------------------------
router.post("/:id/attendees",               requireInternalUser, controller.addAttendeesController);
router.delete("/:id/attendees/:attendeeId", requireInternalUser, controller.removeAttendeeController);
router.post("/:id/attendance",              requireInternalUser, controller.markAttendanceController);

// ---------------------------------------------------------------------------
// Acta principal + FamSign (interna y externa_instructor)
// ---------------------------------------------------------------------------
router.post("/:id/acta/generate",   requireInternalUser, controller.generateActaController);
router.post("/:id/acta/upload-external", requireInternalUser, (req, res, next) => {
  controller.upload.single("acta_pdf")(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    next();
  });
}, controller.uploadExternalActaController);
router.post("/:id/acta/upload-signed", requireInternalUser, (req, res, next) => {
  controller.upload.single("acta_pdf")(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    next();
  });
}, controller.uploadManualSignedActaController);
router.post("/:id/acta/send-famsign", requireInternalUser, controller.sendActaToFamSignController);
router.post("/:id/acta/remind",       requireInternalUser, controller.remindMainController);

// ---------------------------------------------------------------------------
// Acta de inasistentes + FamSign
// ---------------------------------------------------------------------------
router.post("/:id/absent-acta/generate",     requireInternalUser, controller.generateAbsentActaController);
router.post("/:id/absent-acta/upload-signed", requireInternalUser, (req, res, next) => {
  controller.upload.single("acta_pdf")(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    next();
  });
}, controller.uploadManualSignedAbsentActaController);
router.post("/:id/absent-acta/send-famsign", requireInternalUser, controller.sendAbsentActaToFamSignController);
router.post("/:id/absent-acta/remind",       requireInternalUser, controller.remindAbsentController);

module.exports = router;
