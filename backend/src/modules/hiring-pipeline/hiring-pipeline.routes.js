/**
 * Hiring Pipeline Routes
 * Base: /api/v1/hiring-pipeline
 */

const express = require('express');
const router = express.Router();
const ctrl = require('./hiring-pipeline.controller');
const { verifyToken } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');

const TH_ROLES = ['talento_humano', 'jefe_talento_humano', 'gerencia_general', 'gerencia', 'admin'];

router.use(verifyToken);

// ── Pipeline por solicitud ────────────────────────────────────────────────────
router.get('/request/:requestId',                requireRole(TH_ROLES), ctrl.getRequestPipeline);
router.post('/request/:requestId/start',         requireRole(TH_ROLES), ctrl.startEvaluation);
router.post('/request/:requestId/:entryId/hire', requireRole(TH_ROLES), ctrl.finalizeHiring);

// ── Entry individual ──────────────────────────────────────────────────────────
router.get('/entries/:entryId',                  requireRole(TH_ROLES), ctrl.getEntry);
router.post('/entries/:entryId/stages/:stage/advance', requireRole(TH_ROLES), ctrl.advanceStage);
router.patch('/entries/:entryId/stages/:stage',        requireRole(TH_ROLES), ctrl.updateStageData);
router.post('/entries/:entryId/stages/:stage/reject',  requireRole(TH_ROLES), ctrl.rejectApplicant);
router.post('/entries/:entryId/reactivate',      requireRole(TH_ROLES), ctrl.reactivateApplicant);

// ── Propuestas salariales ─────────────────────────────────────────────────────
router.post('/entries/:entryId/proposals',                requireRole(TH_ROLES), ctrl.createSalaryProposal);
router.patch('/entries/:entryId/proposals/:proposalId',   requireRole(TH_ROLES), ctrl.updateProposalResponse);

// ── Oferta salarial y contrato ───────────────────────────────────────────────
router.post('/entries/:entryId/salary-offer',    requireRole(TH_ROLES), ...ctrl.uploadSalaryOffer);
router.post('/entries/:entryId/contract',        requireRole(TH_ROLES), ...ctrl.uploadContract);

// ── Mis asignaciones como responsable de prueba (cualquier usuario autenticado)
router.get('/my-test-assignments',                       ctrl.getMyTestAssignments);
router.patch('/my-test-assignments/:entryId/confirm',    ctrl.confirmTestDate);
router.post('/my-test-assignments/:entryId/result',      ctrl.submitTestResult);

// ── Usuarios internos (para selects) ─────────────────────────────────────────
router.get('/users',      requireRole(TH_ROLES), ctrl.getInternalUsers);
router.get('/users/role', requireRole(TH_ROLES), ctrl.getUsersByRole);

module.exports = router;
