const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0103.controller");

/**
 * Routes - CA-01-03 (Buenas Prácticas)
 * Prefijo sugerido: /api/v1/calidad/buenas-practicas
 *
 * La exposición se mantiene privada y con RBAC autoritativo.
 * Endpoints con prefijo /training, /exams, /certifications, /violations
 * para integración directa con frontend hooks.
 */

router.use(verifyToken);

// ============ TRAINING ============
router.post(
  "/training",
  requireRole(["calidad", "gerencia", "talento_humano"]),
  ctrl.createTraining
);

router.get(
  "/training",
  requireRole(["calidad", "gerencia", "talento_humano"]),
  ctrl.listTraining
);

router.get(
  "/training/:id",
  requireRole(["calidad", "gerencia", "talento_humano"]),
  ctrl.getTraining
);

router.put(
  "/training/:id",
  requireRole(["calidad", "gerencia"]),
  ctrl.updateTraining
);

// ============ EXAMS ============
router.post(
  "/exams",
  requireRole(["calidad", "gerencia", "talento_humano"]),
  ctrl.createExam
);

router.get(
  "/exams",
  requireRole(["calidad", "gerencia", "talento_humano"]),
  ctrl.listExams
);

// ============ CERTIFICATIONS ============
router.post(
  "/certifications",
  requireRole(["calidad", "gerencia", "talento_humano"]),
  ctrl.createCertification
);

router.get(
  "/certifications",
  requireRole(["calidad", "gerencia", "talento_humano"]),
  ctrl.listCertifications
);

router.get(
  "/certifications/expiring",
  requireRole(["calidad", "gerencia"]),
  ctrl.listExpiringCertifications
);

// ============ VIOLATIONS ============
router.post(
  "/violations",
  requireRole(["calidad", "gerencia", "talento_humano"]),
  ctrl.createViolation
);

router.get(
  "/violations",
  requireRole(["calidad", "gerencia", "talento_humano"]),
  ctrl.listViolations
);

router.put(
  "/violations/:id",
  requireRole(["calidad", "gerencia"]),
  ctrl.updateViolation
);

// ============ LEGACY: Snapshot & Transition ============
router.post(
  "/snapshots",
  requireRole(["calidad", "gerencia"]),
  ctrl.buildSnapshot
);

router.post(
  "/validate-transition",
  requireRole(["calidad", "gerencia"]),
  ctrl.validateTransition
);

router.put(
  "/workflows/transition",
  requireRole(["calidad"]),
  ctrl.transitionRecord
);

module.exports = router;