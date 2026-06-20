const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const ctrl = require("./signatureWorkflows.controller");

const router = express.Router();

router.get("/verify/:token", ctrl.verifyWorkflowHtml);
router.get("/verify/:token/json", ctrl.verifyWorkflowJson);

router.use(verifyToken);

router.get("/me/pending", ctrl.listMyPending);
router.get("/me/completed", ctrl.listMyCompleted);
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
router.post("/:id/signers/:signerId/reassign", ctrl.reassignSigner);

module.exports = router;
