const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./viaticos.controller");

const router = express.Router();
const FINANCE_REVIEWER_ROLES = ["finanzas", "financiero", "jefe_financiero", "jefe_finanzas"];

router.use(verifyToken);
router.use(
  requireRole([
    "finanzas",
    "financiero",
    "comercial",
    "backoffice_comercial",
    "servicio_tecnico",
    "tecnico",
    "jefe_comercial",
    "jefe_tecnico",
    "jefe_servicio_tecnico",
    "jefe_operaciones",
    "ti",
    "jefe_ti",
    "admin",
    "administrador",
    "gerencia_general",
  ])
);

router.get("/candidates", controller.listCandidates);
router.get("/reports/summary", requireRole(FINANCE_REVIEWER_ROLES), controller.reportSummary);
router.get("/ats/xml", requireRole(FINANCE_REVIEWER_ROLES), controller.atsXml);
router.get("/", controller.list);
router.post("/", controller.upsert);
router.patch("/:id/status", requireRole(FINANCE_REVIEWER_ROLES), controller.updateStatus);
router.patch("/:id/workflow", controller.updateWorkflowOperational);
router.post("/config/zones", requireRole(["finanzas", "financiero", "admin", "administrador", "gerencia_general"]), controller.upsertZone);
router.post("/config/fixed-profiles", requireRole(["finanzas", "financiero", "admin", "administrador", "gerencia_general"]), controller.upsertFixedProfile);
router.get("/config/fixed-profiles", requireRole(["finanzas", "financiero", "admin", "administrador", "gerencia_general"]), controller.listFixedProfiles);
router.patch("/config/policy", requireRole(["finanzas", "financiero", "admin", "administrador", "gerencia_general"]), controller.updatePolicy);
router.get("/:id/documents", controller.listDocuments);
router.post("/:id/documents", controller.addDocument);
router.post("/sync-sri", controller.syncSri);
router.post("/:id/invoices/xml", controller.uploadInvoiceXml);
router.post("/:id/invoices/zip", controller.uploadInvoiceZip);
router.post("/:id/invoices/txt", controller.uploadInvoiceTxt);
router.get("/:id/invoices", controller.listInvoices);
router.patch("/invoices/:invoiceId", requireRole(FINANCE_REVIEWER_ROLES), controller.patchInvoice);
router.delete("/invoices/:invoiceId", controller.deleteInvoice);
router.get("/:id/report", requireRole(FINANCE_REVIEWER_ROLES), controller.report);

module.exports = router;
