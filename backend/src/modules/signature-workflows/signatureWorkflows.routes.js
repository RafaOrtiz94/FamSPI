const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const ctrl = require("./signatureWorkflows.controller");

const router = express.Router();

router.get("/verify/:token", ctrl.verifyWorkflowHtml);
router.get("/verify/:token/json", ctrl.verifyWorkflowJson);

router.use(verifyToken);

router.get("/me/pending", ctrl.listMyPending);
router.get("/me/completed", ctrl.listMyCompleted);
router.get("/signer-candidates", ctrl.listSignerCandidates);
router.post("/validate-signer-profiles", ctrl.validateSignerProfiles);
router.get("/", ctrl.listWorkflows);
router.post("/", ctrl.createWorkflow);
router.get("/:id", ctrl.getWorkflow);
router.post("/:id/send", ctrl.sendWorkflow);
router.post("/:id/cancel", ctrl.cancelWorkflow);
router.get("/:id/documents/:documentId/pdf", ctrl.downloadSourcePdf);
router.get("/:id/documents/:documentId/final-pdf", ctrl.downloadFinalPdf);
router.post("/:id/signers/:signerId/open", ctrl.openSignerStep);
router.post("/:id/signers/:signerId/sign", ctrl.signStep);
router.post("/:id/signers/:signerId/reject", ctrl.rejectStep);
// Fase 2 del plan de mejoras de firma: corrige la ubicacion visual de una
// firma YA emitida (no cambia estado ni hashes). Ver signatureWorkflows.
// service.js#correctSignerPlacement para el detalle de que hace y por que es
// seguro.
router.post("/:id/signers/:signerId/correct-placement", ctrl.correctSignerPlacement);
router.post("/:id/signers/:signerId/reassign", ctrl.reassignSigner);

module.exports = router;
