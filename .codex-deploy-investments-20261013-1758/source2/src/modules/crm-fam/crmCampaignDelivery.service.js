// Envio, bajas y metricas de las campanas de email del CRM (migracion 319).
//
// Diseno:
//  - El envio se hace por LOTES desde el frontend (sendBatch se llama hasta que no queden
//    pendientes): sin colas ni jobs, reanudable, y cada lote es una peticion corta de Cloud Run.
//  - Solo sale por service account (mailer.sendBulkMail): nunca cae a SMTP ni a Google Chat.
//  - Cada correo lleva enlace + cabecera List-Unsubscribe; quien se da de baja entra a
//    crm_email_suppressions y se omite en todo envio futuro.
//  - Aperturas y clics se miden con un pixel y enlaces propios resueltos en el servidor a partir
//    del contenido guardado (no hay redireccion abierta).
const db = require("../../config/db");
const logger = require("../../config/logger");
const { sendBulkMail } = require("../../utils/mailer");
const { MANAGER_OR_ADMIN_ROLES } = require("./crm.constants");

const MANAGERS = new Set(MANAGER_OR_ADMIN_ROLES);
const BATCH_SIZE = 20;
const DAILY_LIMIT = Number(process.env.CRM_CAMPAIGN_DAILY_LIMIT) || 300;
const URL_PATTERN = /https?:\/\/[^\s<>"')]+/g;

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const ensureManager = (user) => {
  if (!MANAGERS.has(user?.role)) throw fail("Acceso denegado", 403);
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const personalize = (text, recipient) => String(text || "")
  .split("{{nombre_cliente}}").join(recipient?.recipient_name || "Cliente")
  .split("{{laboratorio}}").join(recipient?.laboratory_name || "Laboratorio");

// URL publica del backend, la que ve quien abre el correo.
const publicBaseUrl = () => {
  if (process.env.CRM_PUBLIC_BASE_URL) return process.env.CRM_PUBLIC_BASE_URL.replace(/\/+$/, "");
  try {
    return new URL(process.env.GOOGLE_REDIRECT_URI).origin;
  } catch (_err) {
    return `http://localhost:${process.env.PORT || 8090}`;
  }
};

const campaignUrls = (body) => String(body || "").match(URL_PATTERN) || [];

// HTML del correo: texto escapado, saltos de linea, enlaces rastreados (por indice), pie con baja y pixel.
const renderCampaignEmail = ({ campaign, recipient, tracking = true }) => {
  const base = publicBaseUrl();
  // El indice de cada enlace se fija sobre el contenido ORIGINAL (la plantilla), y solo el texto
  // entre enlaces se personaliza y escapa: una variable no puede introducir enlaces rastreados.
  const template = String(campaign.body_content || "");
  const re = new RegExp(URL_PATTERN.source, "g");
  const parts = [];
  let last = 0;
  let idx = 0;
  let m;
  while ((m = re.exec(template)) !== null) {
    parts.push(escapeHtml(personalize(template.slice(last, m.index), recipient)));
    const href = tracking ? `${base}/api/v1/crm-campaigns/click/${recipient.token}/${idx}` : m[0];
    parts.push(`<a href="${escapeHtml(href)}" style="color:#2458D3;">${escapeHtml(m[0])}</a>`);
    idx += 1;
    last = m.index + m[0].length;
  }
  parts.push(escapeHtml(personalize(template.slice(last), recipient)));
  const body = parts.join("").replace(/\n/g, "<br/>");
  const preheader = campaign.preheader ? personalize(campaign.preheader, recipient) : "";
  const unsubscribeUrl = `${base}/api/v1/crm-campaigns/unsubscribe/${recipient.token}`;
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f3f5f7;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ""}
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:24px auto;background:#ffffff;border:1px solid #dce3e9;border-radius:12px;overflow:hidden;">
  <div style="padding:28px 32px;font-size:15px;line-height:1.7;color:#172b3a;">${body}</div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">
    Famproject Cia. Ltda. Recibes este mensaje por tu relacion comercial con nosotros.
    <a href="${unsubscribeUrl}" style="color:#64748b;">Darme de baja</a>
  </div>
</div>
${tracking ? `<img src="${base}/api/v1/crm-campaigns/open/${recipient.token}.gif" width="1" height="1" alt="" style="display:block;border:0;"/>` : ""}
</body></html>`;
  return { html, unsubscribeUrl };
};

const mailHeaders = (unsubscribeUrl) => ({
  "List-Unsubscribe": `<${unsubscribeUrl}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

const loadCampaign = async (client, id) => {
  const { rows } = await client.query(
    `SELECT * FROM crm.crm_email_campaigns WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (!rows.length) throw fail("Campana no encontrada", 404);
  return rows[0];
};

const progressOf = async (client, id) => {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE delivery_status = 'sent')::int AS sent,
            COUNT(*) FILTER (WHERE delivery_status = 'failed')::int AS failed,
            COUNT(*) FILTER (WHERE delivery_status = 'skipped')::int AS skipped,
            COUNT(*) FILTER (WHERE delivery_status = 'pending')::int AS pending,
            COUNT(*) FILTER (WHERE open_count > 0)::int AS opened,
            COUNT(*) FILTER (WHERE click_count > 0)::int AS clicked
       FROM crm.crm_email_campaign_recipients WHERE campaign_id = $1`,
    [id],
  );
  return rows[0];
};

// ─── Envio de prueba ─────────────────────────────────────────────────────────
// Solo al correo del propio usuario que lo pide: asi nadie usa la prueba para escribir a terceros.
const sendTestEmail = async (id, user) => {
  ensureManager(user);
  if (!user?.email) throw fail("Tu usuario no tiene correo para recibir la prueba");
  const campaign = await loadCampaign(db, id);
  const { rows } = await db.query(
    `SELECT * FROM crm.crm_email_campaign_recipients WHERE campaign_id = $1 ORDER BY recipient_name LIMIT 1`,
    [id],
  );
  if (!rows.length) throw fail("La campana no tiene destinatarios");

  const { html, unsubscribeUrl } = renderCampaignEmail({ campaign, recipient: rows[0], tracking: false });
  const result = await sendBulkMail({
    to: user.email,
    subject: `[PRUEBA] ${personalize(campaign.subject, rows[0])}`,
    html,
    headers: mailHeaders(unsubscribeUrl),
  });
  if (!result.delivered) {
    throw fail(
      result.reason === "disabled_globally"
        ? "El envio de correo esta deshabilitado en este entorno"
        : "No se pudo enviar la prueba",
      409,
    );
  }
  await db.query(`UPDATE crm.crm_email_campaigns SET test_sent_at = now() WHERE id = $1`, [id]);
  return { sent_to: user.email, test_sent_at: new Date().toISOString() };
};

// ─── Envio por lotes ─────────────────────────────────────────────────────────
const sentToday = async (client) => {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM crm.crm_email_campaign_recipients
      WHERE delivery_status = 'sent'
        AND sent_at >= (date_trunc('day', now() AT TIME ZONE 'America/Guayaquil') AT TIME ZONE 'America/Guayaquil')`,
  );
  return rows[0].n;
};

const sendBatch = async (id, { confirm, expected_recipients } = {}, user) => {
  ensureManager(user);
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { rows: lockRows } = await client.query(
      `SELECT * FROM crm.crm_email_campaigns WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    if (!lockRows.length) throw fail("Campana no encontrada", 404);
    const campaign = lockRows[0];
    if (campaign.status === "sent") throw fail("La campana ya fue enviada", 409);

    if (campaign.status === "draft") {
      // Primer lote: exige prueba previa y confirmacion explicita del total de destinatarios.
      const progress = await progressOf(client, id);
      if (!progress.total) throw fail("La campana no tiene destinatarios");
      if (!campaign.test_sent_at) throw fail("Envia primero una prueba a tu correo", 409);
      if (confirm !== true || Number(expected_recipients) !== progress.total) {
        throw fail(`Confirma el envio a ${progress.total} destinatarios`, 409);
      }
      await client.query(
        `UPDATE crm.crm_email_campaigns
            SET status = 'sending', send_started_at = now(), send_confirmed_by = $2, updated_at = now()
          WHERE id = $1`,
        [id, user.id],
      );
    }

    const remainingToday = DAILY_LIMIT - (await sentToday(client));
    if (remainingToday <= 0) {
      throw fail(`Se alcanzo el limite diario de ${DAILY_LIMIT} correos; continua manana`, 429);
    }
    const take = Math.min(BATCH_SIZE, remainingToday);

    const { rows: batch } = await client.query(
      `SELECT * FROM crm.crm_email_campaign_recipients
        WHERE campaign_id = $1 AND delivery_status = 'pending'
        ORDER BY created_at, id
        LIMIT $2
        FOR UPDATE SKIP LOCKED`,
      [id, take],
    );

    for (const recipient of batch) {
      const { rows: sup } = await client.query(
        `SELECT 1 FROM crm.crm_email_suppressions WHERE email_lower = $1`,
        [String(recipient.recipient_email).toLowerCase()],
      );
      if (sup.length) {
        await client.query(
          `UPDATE crm.crm_email_campaign_recipients
              SET delivery_status = 'skipped', error_message = 'Dado de baja' WHERE id = $1`,
          [recipient.id],
        );
        continue;
      }
      const { html, unsubscribeUrl } = renderCampaignEmail({ campaign, recipient, tracking: true });
      try {
        const result = await sendBulkMail({
          to: recipient.recipient_email,
          subject: personalize(campaign.subject, recipient),
          html,
          headers: mailHeaders(unsubscribeUrl),
        });
        if (!result.delivered) {
          // Correo apagado en este entorno: no marcar nada, que el lote se pueda reintentar.
          throw fail("El envio de correo esta deshabilitado en este entorno", 409);
        }
        await client.query(
          `UPDATE crm.crm_email_campaign_recipients
              SET delivery_status = 'sent', sent_at = now(), error_message = NULL WHERE id = $1`,
          [recipient.id],
        );
      } catch (err) {
        if (err.status === 409) throw err;
        logger.warn({ campaign_id: id, recipient_id: recipient.id, error: err.message }, "[CRM-CAMPAIGN] fallo envio");
        await client.query(
          `UPDATE crm.crm_email_campaign_recipients
              SET delivery_status = 'failed', error_message = $2 WHERE id = $1`,
          [recipient.id, String(err.message || "Error de envio").slice(0, 300)],
        );
      }
    }

    const progress = await progressOf(client, id);
    let status = "sending";
    if (progress.pending === 0) {
      status = "sent";
      await client.query(
        `UPDATE crm.crm_email_campaigns SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1`,
        [id],
      );
    }
    await client.query("COMMIT");
    return { status, ...progress, daily_limit: DAILY_LIMIT };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// Reintento de fallidos: vuelven a pendiente y la campana a "sending" para seguir con sendBatch.
const retryFailed = async (id, user) => {
  ensureManager(user);
  const campaign = await loadCampaign(db, id);
  if (campaign.status === "draft") throw fail("La campana aun no se ha enviado", 409);
  const { rowCount } = await db.query(
    `UPDATE crm.crm_email_campaign_recipients
        SET delivery_status = 'pending', error_message = NULL
      WHERE campaign_id = $1 AND delivery_status = 'failed'`,
    [id],
  );
  if (rowCount) {
    await db.query(`UPDATE crm.crm_email_campaigns SET status = 'sending', updated_at = now() WHERE id = $1`, [id]);
  }
  return { requeued: rowCount };
};

// ─── Duplicar (sirve tambien como "usar plantilla") ──────────────────────────
const duplicateCampaign = async (id, user) => {
  ensureManager(user);
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const source = await loadCampaign(client, id);
    const { rows } = await client.query(
      `INSERT INTO crm.crm_email_campaigns (campaign_name, subject, preheader, body_content, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`,
      [`Copia de ${source.campaign_name}`.slice(0, 160), source.subject, source.preheader, source.body_content, user.id],
    );
    await client.query(
      `INSERT INTO crm.crm_email_campaign_recipients
         (campaign_id, contact_id, account_id, recipient_name, recipient_email, laboratory_name)
       SELECT $2, contact_id, account_id, recipient_name, recipient_email, laboratory_name
         FROM crm.crm_email_campaign_recipients WHERE campaign_id = $1`,
      [id, rows[0].id],
    );
    await client.query("COMMIT");
    return { id: rows[0].id };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ─── Audiencia por filtros ───────────────────────────────────────────────────
// Devuelve candidatos (sin guardar nada); el usuario decide cuales agregar. Excluye bajas y sin email.
const audiencePreview = async ({ city, classification, owner_user_id, account_type, q } = {}, user) => {
  ensureManager(user);
  const params = [];
  const accountFilter = [];
  if (city) { params.push(`%${city}%`); accountFilter.push(`a.city ILIKE $${params.length}`); }
  if (classification) { params.push(classification); accountFilter.push(`a.classification = $${params.length}`); }
  if (owner_user_id) { params.push(Number(owner_user_id)); accountFilter.push(`a.owner_user_id = $${params.length}`); }
  if (account_type) { params.push(account_type); accountFilter.push(`a.account_type = $${params.length}`); }
  if (q) { params.push(`%${q}%`); accountFilter.push(`a.account_name ILIKE $${params.length}`); }
  const where = accountFilter.length ? `AND ${accountFilter.join(" AND ")}` : "";

  const { rows } = await db.query(
    `SELECT * FROM (
       SELECT 'contact' AS source_type, c.id AS source_id,
              COALESCE(c.full_name, c.first_name) AS recipient_name, lower(trim(c.email)) AS recipient_email,
              a.account_name AS laboratory_name, a.city, a.classification
         FROM crm.crm_contacts c
         JOIN crm.crm_accounts a ON a.id = c.account_id AND a.deleted_at IS NULL
        WHERE c.deleted_at IS NULL AND c.email IS NOT NULL AND trim(c.email) <> '' ${where}
       UNION ALL
       SELECT 'account', a.id, a.account_name, lower(trim(a.email)), a.account_name, a.city, a.classification
         FROM crm.crm_accounts a
        WHERE a.deleted_at IS NULL AND a.email IS NOT NULL AND trim(a.email) <> '' ${where}
     ) s
     WHERE s.recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
       AND NOT EXISTS (SELECT 1 FROM crm.crm_email_suppressions x WHERE x.email_lower = s.recipient_email)
     ORDER BY s.laboratory_name, s.recipient_name
     LIMIT 500`,
    params,
  );
  // Una sola fila por correo (un contacto y su cuenta pueden compartir email).
  const seen = new Set();
  const data = rows.filter((r) => (seen.has(r.recipient_email) ? false : seen.add(r.recipient_email)));
  return { data, total: data.length, limit: 500 };
};

// ─── Bajas (listado para el equipo) ──────────────────────────────────────────
const listSuppressions = async ({ limit = 100, offset = 0 } = {}, user) => {
  ensureManager(user);
  const { rows } = await db.query(
    `SELECT email_lower, reason, campaign_id, created_at
       FROM crm.crm_email_suppressions ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [Math.min(Math.max(Number(limit) || 100, 1), 500), Math.max(Number(offset) || 0, 0)],
  );
  return rows;
};

// ─── Publico (sin JWT): baja, apertura y clic ────────────────────────────────
const findByToken = async (token) => {
  if (!/^[0-9a-f-]{36}$/i.test(String(token || ""))) return null;
  const { rows } = await db.query(
    `SELECT r.id, r.campaign_id, r.recipient_email, c.body_content, c.campaign_name
       FROM crm.crm_email_campaign_recipients r
       JOIN crm.crm_email_campaigns c ON c.id = r.campaign_id
      WHERE r.token = $1`,
    [token],
  );
  return rows[0] || null;
};

const unsubscribeByToken = async (token) => {
  const r = await findByToken(token);
  if (!r) return false;
  await db.query(
    `INSERT INTO crm.crm_email_suppressions (email_lower, reason, campaign_id)
     VALUES ($1, 'unsubscribed', $2) ON CONFLICT (email_lower) DO NOTHING`,
    [String(r.recipient_email).toLowerCase(), r.campaign_id],
  );
  // Lo que aun este pendiente de esa direccion no debe salir.
  await db.query(
    `UPDATE crm.crm_email_campaign_recipients
        SET delivery_status = 'skipped', error_message = 'Dado de baja'
      WHERE lower(recipient_email) = $1 AND delivery_status = 'pending'`,
    [String(r.recipient_email).toLowerCase()],
  );
  return true;
};

const trackOpen = async (token) => {
  const r = await findByToken(token);
  if (!r) return;
  await db.query(
    `UPDATE crm.crm_email_campaign_recipients
        SET open_count = open_count + 1, first_opened_at = COALESCE(first_opened_at, now())
      WHERE id = $1`,
    [r.id],
  );
};

// Devuelve la URL de destino (siempre una del contenido guardado) o null.
const resolveClick = async (token, index) => {
  const r = await findByToken(token);
  if (!r) return null;
  const url = campaignUrls(r.body_content)[Number(index)];
  if (!url) return null;
  await db.query(
    `UPDATE crm.crm_email_campaign_recipients
        SET click_count = click_count + 1, first_clicked_at = COALESCE(first_clicked_at, now())
      WHERE id = $1`,
    [r.id],
  );
  return url;
};

module.exports = {
  sendTestEmail,
  sendBatch,
  retryFailed,
  duplicateCampaign,
  audiencePreview,
  listSuppressions,
  unsubscribeByToken,
  findByToken,
  trackOpen,
  resolveClick,
  // expuestos para pruebas
  renderCampaignEmail,
  personalize,
  campaignUrls,
};
