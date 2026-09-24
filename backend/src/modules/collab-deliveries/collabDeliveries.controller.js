const svc = require("./collabDeliveries.service");
const reportSvc = require("./collabDeliveriesReport.service");
const { generateActaHerramientaPdf, generateActaRopaPdf } = require("./collabDeliveries.acta");

const ok  = (res, data, status = 200) => res.status(status).json(data);
const err = (res, e) => res.status(e.status || 500).json({ message: e.message || "Error interno" });

const normalizeActaCategory = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (["herramienta", "herramientas", "herramienta_trabajo", "herramientas_trabajo"].includes(normalized)) return "herramienta";
  if (["ropa", "uniforme", "uniformes", "ropa_trabajo", "uniformes_trabajo"].includes(normalized)) return "ropa";
  return normalized;
};

// ── Catálogo ─────────────────────────────────────────────────────────────────

async function listCatalog(req, res) {
  try {
    const { category, includeInactive } = req.query;
    ok(res, await svc.listCatalog({ category, includeInactive: includeInactive === "true" }));
  } catch (e) { err(res, e); }
}

async function createCatalogItem(req, res) {
  try {
    ok(res, await svc.createCatalogItem(req.body, req.user.id), 201);
  } catch (e) { err(res, e); }
}

async function updateCatalogItem(req, res) {
  try {
    ok(res, await svc.updateCatalogItem(req.params.id, req.body));
  } catch (e) { err(res, e); }
}

async function deleteCatalogItem(req, res) {
  try {
    ok(res, await svc.updateCatalogItem(req.params.id, { active: false }));
  } catch (e) { err(res, e); }
}

// ── Entregas ─────────────────────────────────────────────────────────────────

async function listDeliveries(req, res) {
  try {
    const { userId, category, status, renewalDueDays, page, limit } = req.query;
    ok(res, await svc.listDeliveries({ userId, category, status, renewalDueDays, page, limit }));
  } catch (e) { err(res, e); }
}

async function listDeliveriesByUser(req, res) {
  try {
    ok(res, await svc.listDeliveriesByUser(req.params.userId));
  } catch (e) { err(res, e); }
}

async function getDelivery(req, res) {
  try {
    ok(res, await svc.getDelivery(req.params.id));
  } catch (e) { err(res, e); }
}

async function createDelivery(req, res) {
  try {
    ok(res, await svc.createDelivery(req.body, req.user.id), 201);
  } catch (e) { err(res, e); }
}

async function updateDelivery(req, res) {
  try {
    ok(res, await svc.updateDelivery(req.params.id, req.body, req.user.id));
  } catch (e) { err(res, e); }
}

async function withdrawDelivery(req, res) {
  try {
    ok(res, await svc.withdrawDelivery(req.params.id, req.body, req.user.id));
  } catch (e) { err(res, e); }
}

// ── Eventos / historial ───────────────────────────────────────────────────────

async function listDeliveryEvents(req, res) {
  try {
    const { rows } = await require("../../config/db").query(
      `SELECT e.*, u.fullname AS actor_name
       FROM collab_delivery_events e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.delivery_id = $1
       ORDER BY e.created_at DESC`,
      [req.params.id],
    );
    ok(res, rows);
  } catch (e) { err(res, e); }
}

// ── Actas ────────────────────────────────────────────────────────────────────

async function listActasByDelivery(req, res) {
  try {
    ok(res, await svc.listActasByDelivery(req.params.id));
  } catch (e) { err(res, e); }
}

async function getActa(req, res) {
  try {
    ok(res, await svc.getActa(req.params.actaId));
  } catch (e) { err(res, e); }
}

async function generateActa(req, res) {
  try {
    ok(res, await svc.generateActa(req.params.id, req.body, req.user.id), 201);
  } catch (e) { err(res, e); }
}

async function downloadActaPdf(req, res) {
  try {
    const acta = await svc.getActaWithItems(req.params.actaId);
    if (!acta.pdf_drive_file_id) {
      await svc.generateAndStoreActaPdf(req.params.actaId);
    }
    const { filename, pdfBuffer } = await svc.getActaPdfDownload(req.params.actaId, { preferStored: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (e) {
    if (e?.status === 503 && e?.meta) {
      return res.status(503).json({
        message: e.message,
        ...e.meta,
      });
    }
    err(res, e);
  }
}

async function regenerateActaPdf(req, res) {
  try {
    // Fuerza el regenerado (preferStored: false dentro de la funcion) y
    // reemplaza el PDF guardado en Drive -- downloadActaPdf normal solo
    // regenera si el acta nunca tuvo PDF, asi que una vez creado siempre
    // sirve la copia vieja aunque cambie la plantilla/estilos.
    const result = await svc.generateAndStoreActaPdf(req.params.actaId);
    ok(res, result);
  } catch (e) { err(res, e); }
}

async function uploadSignedActa(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: "Se requiere el archivo firmado" });
    const result = await svc.uploadSignedActa(
      req.params.actaId,
      req.file.buffer,
      req.file.originalname,
      req.user.id,
    );
    ok(res, result);
  } catch (e) { err(res, e); }
}

async function startActaSignatureWorkflow(req, res) {
  try {
    ok(res, await svc.startSignatureWorkflowForActa({
      actaId: req.params.actaId,
      signers: Array.isArray(req.body?.signers) ? req.body.signers : [],
      actorUser: req.user,
    }), 201);
  } catch (e) { err(res, e); }
}

async function getActaSignatureWorkflow(req, res) {
  try {
    ok(res, await svc.getActaSignatureWorkflow(req.params.actaId, req.user));
  } catch (e) { err(res, e); }
}

// ── Renovaciones ─────────────────────────────────────────────────────────────

async function listRenewals(req, res) {
  try {
    const { dueDays, status } = req.query;
    ok(res, await svc.listRenewals({ dueDays, status }));
  } catch (e) { err(res, e); }
}

async function completeRenewal(req, res) {
  try {
    ok(res, await svc.completeRenewal(req.params.id, req.body, req.user.id));
  } catch (e) { err(res, e); }
}

// ── Resumen ejecutivo ─────────────────────────────────────────────────────────

async function getSummary(req, res) {
  try {
    ok(res, await svc.getSummary());
  } catch (e) { err(res, e); }
}

// ── Offboarding ───────────────────────────────────────────────────────────────

async function createOffboardingTasks(req, res) {
  try {
    ok(res, await svc.createOffboardingTasksForUser(req.params.userId, req.user.id));
  } catch (e) { err(res, e); }
}

// ── Sesiones de entrega ───────────────────────────────────────────────────────

async function listSessions(req, res) {
  try {
    const { userId, category, tipo, page, limit } = req.query;
    ok(res, await svc.listSessions({ userId, category, tipo, page, limit }));
  } catch (e) { err(res, e); }
}

async function createCollabSession(req, res) {
  try {
    ok(res, await svc.createCollabSession(req.body, req.user.id, req.user.role), 201);
  } catch (e) { err(res, e); }
}

async function updateCollabSession(req, res) {
  try {
    ok(res, await svc.updateCollabSession(req.params.sessionId, req.body, req.user.id, req.user.role));
  } catch (e) { err(res, e); }
}

async function getSession(req, res) {
  try {
    ok(res, await svc.getSession(req.params.sessionId));
  } catch (e) { err(res, e); }
}

async function createTiSession(req, res) {
  try {
    ok(res, await svc.createTiSession(req.body, req.user.id), 201);
  } catch (e) { err(res, e); }
}

// ── Documentos por entrega ────────────────────────────────────────────────────

async function listDeliveryDocsByUser(req, res) {
  try {
    ok(res, await svc.listDeliveryDocsByUser(req.params.userId));
  } catch (e) { err(res, e); }
}

async function listDeliveryDocs(req, res) {
  try {
    ok(res, await svc.listDeliveryDocs(req.params.id));
  } catch (e) { err(res, e); }
}

async function getFullReport(req, res) {
  try {
    ok(res, await svc.getFullReport());
  } catch (e) { err(res, e); }
}

async function getCollaboratorReport(req, res) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0)
      return res.status(400).json({ message: "userId inválido" });
    ok(res, await svc.getCollaboratorReport(userId));
  } catch (e) { err(res, e); }
}

async function getFullReportPdf(req, res) {
  try {
    const generatedByName = req.user?.fullname || req.user?.name || req.user?.email || null;
    const { buffer, sha256, filename } = await reportSvc.generateFullReportPdf({ generatedByName });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
      "X-SHA256": sha256,
    });
    res.send(buffer);
  } catch (e) { err(res, e); }
}

async function getCollaboratorReportPdf(req, res) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0)
      return res.status(400).json({ message: "userId inválido" });
    const generatedByName = req.user?.fullname || req.user?.name || req.user?.email || null;
    const { buffer, sha256, filename } = await reportSvc.generateCollaboratorReportPdf(userId, { generatedByName });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
      "X-SHA256": sha256,
    });
    res.send(buffer);
  } catch (e) { err(res, e); }
}

async function uploadDeliveryDoc(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: "Se requiere el archivo" });
    const result = await svc.uploadDeliveryDoc({
      deliveryId:       req.params.id,
      docType:          req.body.doc_type || "factura",
      fileBuffer:       req.file.buffer,
      originalFilename: req.file.originalname,
      notes:            req.body.notes || null,
      userId:           req.user.id,
    });
    ok(res, result, 201);
  } catch (e) { err(res, e); }
}

async function getActaRecipientInfo(req, res) {
  const db = require("../../config/db");
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId) || userId <= 0)
    return res.status(400).json({ ok: false, message: "userId invalido" });
  try {
    const { rows } = await db.query(
      `SELECT u.id, COALESCE(u.fullname, u.name, u.email) AS fullname, u.email,
              cp.profile->'personal'->>'cedula'     AS cedula,
              cp.profile->'personal'->>'nombres'    AS nombres,
              cp.profile->'personal'->>'apellidos'  AS apellidos,
              cp.profile->'laboral'->>'cargo'        AS cargo
         FROM public.users u
         LEFT JOIN public.collaborator_profiles cp ON cp.user_id = u.id
        WHERE u.id = $1 LIMIT 1`,
      [userId],
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    const row = rows[0];
    const nombre = [row.nombres, row.apellidos].filter(Boolean).join(" ").trim() || row.fullname || "";
    res.json({ ok: true, data: { id: row.id, nombre, cedula: row.cedula || "", cargo: row.cargo || "", email: row.email || "" } });
  } catch (e) { err(res, e); }
}

module.exports = {
  listCatalog, createCatalogItem, updateCatalogItem, deleteCatalogItem,
  listDeliveries, listDeliveriesByUser, getDelivery,
  createDelivery, updateDelivery, withdrawDelivery, listDeliveryEvents,
  listActasByDelivery, getActa, generateActa, downloadActaPdf, regenerateActaPdf, uploadSignedActa,
  startActaSignatureWorkflow, getActaSignatureWorkflow,
  listRenewals, completeRenewal,
  getSummary,
  createOffboardingTasks,
  getActaRecipientInfo,
  listSessions, createCollabSession, updateCollabSession, getSession, createTiSession,
  listDeliveryDocsByUser, listDeliveryDocs, uploadDeliveryDoc,
  getFullReport, getCollaboratorReport,
  getFullReportPdf, getCollaboratorReportPdf,
};
