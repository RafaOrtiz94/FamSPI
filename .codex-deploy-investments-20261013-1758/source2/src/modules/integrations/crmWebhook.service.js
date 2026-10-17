/**
 * crmWebhook.service.js
 * Acciones Google Workspace para etapas que SOLO mueve el asesor en EspoCRM.
 *
 * Etapas cubiertas (sub-etapas EspoCRM, no existen como macro en FamSPI):
 *   Asignado            → Calendar: recordatorio al asesor (3 días)
 *   Lead Calificado     → Gmail: notificación a jefe_comercial
 *   Desarrollo de Oferta→ Drive: doc oferta desde template
 *   Negociacion         → Gmail: alerta a jefe + gerencia
 *   Contratos           → Drive: subcarpeta Contratos + Gmail a backoffice
 */

const logger = require("../../config/logger");

// Cache de deduplicación: evita múltiples disparos para el mismo opp+stage
// dentro de una ventana de 30 minutos (ej: varios updates consecutivos en EspoCRM).
const _recentActions = new Map();
const ACTION_TTL_MS = 30 * 60 * 1000;

function _isDuplicate(oppId, stage) {
  const key = `${oppId}:${stage}`;
  const ts = _recentActions.get(key);
  if (ts && Date.now() - ts < ACTION_TTL_MS) return true;
  _recentActions.set(key, Date.now());
  if (_recentActions.size > 1000) {
    const cutoff = Date.now() - ACTION_TTL_MS;
    for (const [k, v] of _recentActions) {
      if (v < cutoff) _recentActions.delete(k);
    }
  }
  return false;
}

function _daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function _getNotifyEmails(envKey) {
  return (process.env[envKey] || "").split(",").map((e) => e.trim()).filter(Boolean);
}

function _currency(amount) {
  if (!amount) return "-";
  return "$" + Number(amount).toLocaleString("es-EC");
}

// ─── Acciones por etapa ───────────────────────────────────────────────────────

async function _handleAsignado(opp) {
  const { createAllDayEvent } = require("../../utils/calendar");
  const advisorEmail = opp.assignedUserEmail || opp.assignedUser?.emailAddress || null;
  const attendees = advisorEmail ? [advisorEmail] : [];

  await createAllDayEvent({
    summary: `Seguimiento asignado: ${opp.name || "Oportunidad"}`,
    description: [
      `Oportunidad recién asignada requiere primer contacto.`,
      `Cuenta: ${opp.accountName || "-"}`,
      `Asesor: ${opp.assignedUserName || "-"}`,
    ].join("\n"),
    date: _daysFromNow(3),
    reminderMinutesBefore: 480,
    attendees,
  });

  logger.info({ opp_id: opp.id, stage: "Asignado" }, "[CRM_WEBHOOK] Calendar recordatorio creado");
}

async function _handleLeadCalificado(opp) {
  const { sendMail } = require("../../utils/mailer");
  const to = _getNotifyEmails("CRM_NOTIFY_JEFE_COMERCIAL");
  if (!to.length) {
    logger.warn("[CRM_WEBHOOK] CRM_NOTIFY_JEFE_COMERCIAL no configurado — skip Gmail Lead Calificado");
    return;
  }

  await sendMail({
    to,
    subject: `Lead Calificado: ${opp.name || "Oportunidad"}`,
    html: `
      <h2>Lead Calificado en FAM CRM</h2>
      <p>El asesor calificó la oportunidad <strong>${opp.name || "-"}</strong> como lead.</p>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
        <tr><td style="padding:6px 12px;color:#666">Cuenta</td><td style="padding:6px 12px"><b>${opp.accountName || "-"}</b></td></tr>
        <tr><td style="padding:6px 12px;color:#666">Asesor</td><td style="padding:6px 12px">${opp.assignedUserName || "-"}</td></tr>
        <tr><td style="padding:6px 12px;color:#666">Monto estimado</td><td style="padding:6px 12px">${_currency(opp.amount)}</td></tr>
        <tr><td style="padding:6px 12px;color:#666">Fecha de cierre</td><td style="padding:6px 12px">${opp.closeDate || "-"}</td></tr>
      </table>
      <p style="margin-top:16px">
        <a href="${process.env.CRM_BASE_URL || "#"}" style="color:#0066cc">Ver en FAM CRM</a>
      </p>
    `,
    source: "crm_webhook",
  });

  logger.info({ opp_id: opp.id, stage: "Lead Calificado" }, "[CRM_WEBHOOK] Gmail a jefe_comercial enviado");
}

async function _handleDesarrolloOferta(opp) {
  const { ensureFolder, copyTemplate, replaceTags } = require("../../utils/drive");
  const rootFolderId = process.env.DRIVE_CRM_PROSPECTS_FOLDER_ID;

  if (!rootFolderId) {
    logger.warn({ opp_id: opp.id }, "[CRM_WEBHOOK] DRIVE_CRM_PROSPECTS_FOLDER_ID no configurado — skip Drive");
    return;
  }

  const famspiId = opp.cFamspiOpportunityId || opp.id;
  const folderName = `${opp.accountName || opp.name || "Oportunidad"}_${famspiId}`.slice(0, 200);
  const prospectFolder = await ensureFolder(folderName, rootFolderId);

  const templateId = process.env.DRIVE_TEMPLATE_OFERTA_ID;
  if (templateId) {
    const docName = `Oferta_${opp.name || "Propuesta"}`.slice(0, 200);
    const { findFolder } = require("../../utils/drive");
    const existing = await findFolder(docName, prospectFolder.id);
    if (!existing) {
      const doc = await copyTemplate(templateId, docName, prospectFolder.id);
      await replaceTags(doc.id, {
        CLIENTE: opp.accountName || "",
        OPORTUNIDAD: opp.name || "",
        MONTO: _currency(opp.amount),
        FECHA: opp.closeDate || "",
        ASESOR: opp.assignedUserName || "",
      });
      logger.info({ opp_id: opp.id, doc_id: doc.id }, "[CRM_WEBHOOK] Doc oferta creado en Drive");
    } else {
      logger.info({ opp_id: opp.id }, "[CRM_WEBHOOK] Doc oferta ya existe — skip");
    }
  } else {
    logger.info({ opp_id: opp.id, folder_id: prospectFolder.id }, "[CRM_WEBHOOK] Carpeta oferta creada (sin template)");
  }
}

async function _handleNegociacion(opp) {
  const { sendMail } = require("../../utils/mailer");
  const to = [
    ..._getNotifyEmails("CRM_NOTIFY_JEFE_COMERCIAL"),
    ..._getNotifyEmails("CRM_NOTIFY_GERENCIA"),
  ].filter(Boolean);

  if (!to.length) {
    logger.warn("[CRM_WEBHOOK] CRM_NOTIFY_JEFE_COMERCIAL / CRM_NOTIFY_GERENCIA no configurados — skip Gmail Negociacion");
    return;
  }

  await sendMail({
    to,
    subject: `En Negociacion: ${opp.name || "Oportunidad"}`,
    html: `
      <h2>Oportunidad en Negociacion</h2>
      <p>La oportunidad <strong>${opp.name || "-"}</strong> ha ingresado a la etapa de negociación.</p>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
        <tr><td style="padding:6px 12px;color:#666">Cuenta</td><td style="padding:6px 12px"><b>${opp.accountName || "-"}</b></td></tr>
        <tr><td style="padding:6px 12px;color:#666">Asesor</td><td style="padding:6px 12px">${opp.assignedUserName || "-"}</td></tr>
        <tr><td style="padding:6px 12px;color:#666">Monto</td><td style="padding:6px 12px">${_currency(opp.amount)}</td></tr>
        <tr><td style="padding:6px 12px;color:#666">Fecha de cierre</td><td style="padding:6px 12px">${opp.closeDate || "-"}</td></tr>
      </table>
      <p>Esta etapa puede requerir revisión de jefatura o gerencia.</p>
      <p><a href="${process.env.CRM_BASE_URL || "#"}" style="color:#0066cc">Ver en FAM CRM</a></p>
    `,
    source: "crm_webhook",
  });

  logger.info({ opp_id: opp.id, stage: "Negociacion" }, "[CRM_WEBHOOK] Gmail a jefe+gerencia enviado");
}

async function _handleContratos(opp) {
  const { ensureFolder } = require("../../utils/drive");
  const { sendMail } = require("../../utils/mailer");

  const rootFolderId = process.env.DRIVE_CRM_PROSPECTS_FOLDER_ID;
  const toBackoffice = _getNotifyEmails("CRM_NOTIFY_BACKOFFICE");

  // Drive: subcarpeta Contratos dentro de la carpeta del prospecto
  if (rootFolderId) {
    const famspiId = opp.cFamspiOpportunityId || opp.id;
    const folderName = `${opp.accountName || opp.name || "Oportunidad"}_${famspiId}`.slice(0, 200);
    const prospectFolder = await ensureFolder(folderName, rootFolderId);
    await ensureFolder("Contratos", prospectFolder.id);
    logger.info({ opp_id: opp.id }, "[CRM_WEBHOOK] Carpeta Contratos creada en Drive");
  }

  // Gmail: notificación a backoffice
  if (toBackoffice.length) {
    await sendMail({
      to: toBackoffice,
      subject: `Contratos requeridos: ${opp.name || "Oportunidad"}`,
      html: `
        <h2>Oportunidad en etapa de Contratos</h2>
        <p>La oportunidad <strong>${opp.name || "-"}</strong> requiere preparación de contratos.</p>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
          <tr><td style="padding:6px 12px;color:#666">Cuenta</td><td style="padding:6px 12px"><b>${opp.accountName || "-"}</b></td></tr>
          <tr><td style="padding:6px 12px;color:#666">Asesor</td><td style="padding:6px 12px">${opp.assignedUserName || "-"}</td></tr>
          <tr><td style="padding:6px 12px;color:#666">Monto</td><td style="padding:6px 12px">${_currency(opp.amount)}</td></tr>
        </table>
        <p><a href="${process.env.CRM_BASE_URL || "#"}" style="color:#0066cc">Ver en FAM CRM</a></p>
      `,
      source: "crm_webhook",
    });
    logger.info({ opp_id: opp.id, stage: "Contratos" }, "[CRM_WEBHOOK] Gmail a backoffice enviado");
  }
}

// ─── Dispatcher principal ─────────────────────────────────────────────────────

const STAGE_HANDLERS = {
  "Asignado":             _handleAsignado,
  "Lead Calificado":      _handleLeadCalificado,
  "Desarrollo de Oferta": _handleDesarrolloOferta,
  "Negociacion":          _handleNegociacion,
  "Contratos":            _handleContratos,
};

async function handleWebhookStageChange(opp, stage) {
  if (_isDuplicate(opp.id, stage)) {
    logger.info({ opp_id: opp.id, stage }, "[CRM_WEBHOOK] Accion duplicada — skip (TTL 30min)");
    return { ok: true, action: "skipped_duplicate", stage };
  }

  const handler = STAGE_HANDLERS[stage];
  if (!handler) {
    logger.debug({ opp_id: opp.id, stage }, "[CRM_WEBHOOK] Etapa sin accion Google — ignorado");
    return { ok: true, action: "no_action", stage };
  }

  try {
    await handler(opp);
    return { ok: true, action: "executed", stage };
  } catch (err) {
    logger.error(
      { err: err?.message, opp_id: opp.id, stage },
      "[CRM_WEBHOOK] Error ejecutando accion Google"
    );
    return { ok: false, error: err?.message, stage };
  }
}

module.exports = { handleWebhookStageChange };
