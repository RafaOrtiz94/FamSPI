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
    "ing_servicio",
    "esp_app",
    "jefe_comercial",
    "jefe_tecnico",
    "jefe_servicio",
    "jefe_servicio_tecnico",
    "jefe_operaciones",
    "ti",
    "jefe_ti",
    "talento_humano",
    "jefe_talento_humano",
    "admin",
    "administrador",
    "gerencia_general",
    "ing_servicio_ext",
    "esp_app_ext",
  ])
);

router.get("/candidates", controller.listCandidates);
router.get("/reports/summary", requireRole(FINANCE_REVIEWER_ROLES), controller.reportSummary);
router.get("/ats/xml", requireRole(FINANCE_REVIEWER_ROLES), controller.atsXml);
router.get("/config/policy", controller.getPolicy);
router.get("/", controller.list);
router.post("/", controller.upsert);
router.patch("/:id/status", requireRole(FINANCE_REVIEWER_ROLES), controller.updateStatus);
router.patch("/:id/approve-segment", requireRole([...FINANCE_REVIEWER_ROLES, "talento_humano", "jefe_talento_humano"]), controller.approveSegment);
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
router.post("/:id/invoices/txt/preview", controller.previewInvoiceTxt);
router.get("/:id/invoices", controller.listInvoices);
router.patch("/invoices/:invoiceId", requireRole(FINANCE_REVIEWER_ROLES), controller.patchInvoice);
router.delete("/invoices/:invoiceId", controller.deleteInvoice);
router.get("/:id/report", requireRole(FINANCE_REVIEWER_ROLES), controller.report);

// Notas de venta manual
router.post("/:id/invoices/manual", controller.createManualNote);
router.get("/:id/invoices/manual", controller.listManualNotes);
router.patch("/invoices/manual/:noteId", controller.updateManualNote);
router.delete("/invoices/manual/:noteId", controller.deleteManualNote);

// Compras sin factura
router.post("/:id/purchases-no-invoice", controller.createPurchaseNoInvoice);
router.get("/:id/purchases-no-invoice", controller.listPurchasesNoInvoice);
router.patch("/purchases/:id/approve", requireRole([...FINANCE_REVIEWER_ROLES, "talento_humano", "jefe_talento_humano"]), controller.approvePurchaseNoInvoice);

// Pago batch del mes completo (atomico, solo finanzas)
router.post("/batch-pay", requireRole(FINANCE_REVIEWER_ROLES), controller.batchPay);

// Envio del mes completo a revision (operacional, multi-salida)
router.post("/submit-month", controller.submitMonth);

// Correcciones de revisor
const REVIEWER_ROLES = [...FINANCE_REVIEWER_ROLES, "talento_humano", "jefe_talento_humano"];
router.patch("/invoices/:invoiceId/reviewer-note", requireRole(REVIEWER_ROLES), controller.reviewerNoteInvoice);
router.patch("/:id/request-correction", requireRole(REVIEWER_ROLES), controller.requestCorrection);

// PDF del expediente consolidado del mes (facturas + notas + compras sin factura)
router.post("/month-report/pdf", requireRole([...REVIEWER_ROLES, "admin", "administrador"]), controller.exportMonthPdf);

// Envio a revision por el propio solicitante
router.post("/:id/submit-review", controller.submitForReview);

// Comprobante de pago (cierre del expediente)
const RECEIPT_ROLES = ["talento_humano", "jefe_talento_humano", ...FINANCE_REVIEWER_ROLES, "admin", "administrador"];
router.post("/batch-receipt", requireRole(["talento_humano", "jefe_talento_humano", "admin", "administrador"]), controller.batchReceipt);
router.get("/:id/receipt", requireRole(RECEIPT_ROLES), controller.getReceipt);

// Colas de revision por segmento
const TALENTO_REVIEWER_ROLES = ["talento_humano", "jefe_talento_humano"];
router.get("/review/talento", requireRole([...TALENTO_REVIEWER_ROLES, ...FINANCE_REVIEWER_ROLES, "admin", "administrador"]), controller.listReviewTalento);
router.get("/review/finance", requireRole([...FINANCE_REVIEWER_ROLES, "admin", "administrador"]), controller.listReviewFinance);

// Exportar reporte de viaticos (CSV data)
router.get("/reports/user-export", requireRole([...FINANCE_REVIEWER_ROLES, ...TALENTO_REVIEWER_ROLES, "admin", "administrador"]), controller.exportReport);

// Anticipos
router.post("/:id/anticipos", controller.requestAnticipo);
router.get("/:id/anticipos", controller.listAnticipos);
router.patch("/anticipos/:anticipoId", controller.updateAnticipo);

module.exports = router;
