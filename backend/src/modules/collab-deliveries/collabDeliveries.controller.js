const svc = require("./collabDeliveries.service");

const ok  = (res, data, status = 200) => res.status(status).json(data);
const err = (res, e) => res.status(e.status || 500).json({ message: e.message || "Error interno" });

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
  // Los templates PDF se integran cuando estén disponibles.
  // Mientras tanto retornamos el drive_url del borrador para que el frontend redirija.
  try {
    const acta = await svc.getActa(req.params.actaId);
    if (!acta.pdf_drive_url) {
      return res.status(503).json({
        message: "El template de acta para esta categoría aún no está disponible. Se habilitará cuando se reciba el archivo PDF.",
        acta_code: acta.acta_code,
      });
    }
    return res.json({ drive_url: acta.pdf_drive_url, sha256: acta.pdf_sha256 });
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
    ok(res, await svc.createCollabSession(req.body, req.user.id), 201);
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

module.exports = {
  listCatalog, createCatalogItem, updateCatalogItem, deleteCatalogItem,
  listDeliveries, listDeliveriesByUser, getDelivery,
  createDelivery, updateDelivery, withdrawDelivery, listDeliveryEvents,
  listActasByDelivery, getActa, generateActa, downloadActaPdf, uploadSignedActa,
  listRenewals, completeRenewal,
  getSummary,
  createOffboardingTasks,
  listSessions, createCollabSession, getSession, createTiSession,
};
