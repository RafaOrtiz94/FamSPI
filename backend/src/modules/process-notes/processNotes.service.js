const crypto = require("crypto");
const db = require("../../config/db");
const logger = require("../../config/logger");
const notificationManager = require("../notifications/notificationManager");
const { sendMail } = require("../../utils/mailer");
const { ensureFolderPath, uploadBase64File } = require("../../utils/drive");

const ENTITY_TYPES = new Set(["business_case", "public_purchase", "private_purchase"]);

// Mismos grupos de rol que ya validan el acceso de lectura a cada entidad en
// sus propios modulos (equipment-purchases.routes.js / private-purchases.routes.js /
// business-case.routes.js) -- las notas no inventan un modelo de permisos
// nuevo, solo replican "quien ya puede ver este expediente/BC puede
// leer y escribir notas en el".
const ENTITY_ROLES = {
  business_case: [
    "comercial", "asesor_comercial", "analista_comercial", "acp_comercial",
    "backoffice_comercial", "jefe_comercial", "jefe_servicio", "jefe_tecnico",
    "jefe_financiero", "jefe_operaciones", "gerencia", "gerencia_general",
    "admin", "administrador",
  ],
  public_purchase: [
    "comercial", "asesor_comercial", "analista_comercial", "acp_comercial",
    "jefe_comercial", "gerencia", "gerencia_general", "backoffice_comercial",
    "jefe_tecnico", "jefe_servicio_tecnico", "tecnico", "jefe_operaciones",
    "operaciones", "jefe_logistica", "logistica",
  ],
  private_purchase: [
    "comercial", "asesor_comercial", "analista_comercial", "acp_comercial",
    "jefe_comercial", "gerencia", "gerencia_general", "backoffice_comercial",
    "jefe_tecnico", "jefe_servicio_tecnico", "tecnico", "jefe_operaciones",
    "operaciones", "jefe_logistica", "logistica", "ing_servicio", "esp_app",
    "jefe_servicio",
  ],
};
const ADMIN_BYPASS_ROLES = new Set(["admin", "administrador", "gerencia", "gerencia_general"]);

const ENTITY_TABLES = {
  business_case: { table: "equipment_purchase_requests", idColumn: "id", labelColumn: "client_name" },
  public_purchase: { table: "equipment_purchase_requests", idColumn: "id", labelColumn: "client_name" },
  private_purchase: { table: "private_purchase_requests", idColumn: "id", labelColumn: "client_name" },
};

const EMAIL_MAX_ATTACHMENTS_BYTES = 20 * 1024 * 1024; // margen bajo el limite practico de Gmail (~25MB)
const NOTE_MAX_ATTACHMENTS_BYTES = 20 * 1024 * 1024;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertValidEntityType(entityType) {
  if (!ENTITY_TYPES.has(entityType)) {
    const err = new Error(`Tipo de proceso invalido: ${entityType}`);
    err.status = 400;
    throw err;
  }
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function userHasEntityAccess(entityType, userRole) {
  const role = normalizeRole(userRole);
  if (ADMIN_BYPASS_ROLES.has(role)) return true;
  return (ENTITY_ROLES[entityType] || []).includes(role);
}

function assertUserHasEntityTypeAccess(entityType, user) {
  assertValidEntityType(entityType);
  if (!userHasEntityAccess(entityType, user?.role)) {
    const err = new Error("No tienes acceso a las notas de este tipo de proceso.");
    err.status = 403;
    throw err;
  }
}

async function assertParticipantAccess(entityType, entityId, user) {
  assertUserHasEntityTypeAccess(entityType, user);
  const config = ENTITY_TABLES[entityType];
  const { rows } = await db.query(
    `SELECT ${config.idColumn} AS id, ${config.labelColumn} AS label FROM ${config.table} WHERE ${config.idColumn} = $1 LIMIT 1`,
    [entityId],
  );
  if (!rows[0]) {
    const err = new Error("El proceso indicado no existe.");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function listMentionCandidates(entityType) {
  assertValidEntityType(entityType);
  const roles = ENTITY_ROLES[entityType] || [];
  const { rows } = await db.query(
    `SELECT id, fullname, email, role FROM users
      WHERE active = true AND lower(role) = ANY($1::text[])
      ORDER BY fullname ASC`,
    [roles],
  );
  return rows;
}

async function listNotes(entityType, entityId) {
  assertValidEntityType(entityType);
  const { rows } = await db.query(
    `SELECT n.id, n.parent_note_id, n.author_id, n.author_name_snapshot, n.author_role_snapshot,
            n.body, n.mentioned_user_ids, n.note_type, n.email_meta, n.attachments, n.source_communication_id,
            n.note_hash_sha256, n.previous_note_hash_sha256, n.created_at,
            COALESCE(
              (SELECT jsonb_agg(jsonb_build_object('user_id', r.user_id, 'name', u.fullname, 'read_at', r.read_at) ORDER BY r.read_at ASC)
                 FROM process_note_reads r JOIN users u ON u.id = r.user_id
                WHERE r.note_id = n.id),
              '[]'::jsonb
            ) AS read_by
       FROM process_notes n
      WHERE n.entity_type = $1 AND n.entity_id = $2
      ORDER BY n.created_at ASC`,
    [entityType, String(entityId)],
  );
  return rows;
}

// Unico punto de insercion de una fila en process_notes -- calcula el
// encadenado de hash de ESTE hilo (entity_type+entity_id) y hace el INSERT.
// Lo usan tanto una nota normal como el registro de un correo enviado, para
// que ambos queden en la misma cadena de integridad append-only.
async function _appendNote({ entityType, entityId, author, body, parentNoteId = null, mentionedUserIds = [], noteType = "note", emailMeta = null, attachments = [], sourceCommunicationId = null }) {
  const { rows: chainRows } = await db.query(
    `SELECT note_hash_sha256 FROM process_notes
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC, id DESC LIMIT 1`,
    [entityType, String(entityId)],
  );
  const previousHash = chainRows[0]?.note_hash_sha256 || null;

  const createdAt = new Date().toISOString();
  const payloadHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ entityType, entityId: String(entityId), authorId: author.id, body, parentNoteId, sourceCommunicationId, createdAt }))
    .digest("hex");
  const noteHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ payload_hash_sha256: payloadHash, previous_note_hash_sha256: previousHash }))
    .digest("hex");

  const { rows } = await db.query(
    `INSERT INTO process_notes (
       entity_type, entity_id, parent_note_id, author_id, author_name_snapshot, author_role_snapshot,
       body, mentioned_user_ids, note_type, email_meta, attachments, source_communication_id,
       payload_hash_sha256, previous_note_hash_sha256, note_hash_sha256, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      entityType, String(entityId), parentNoteId || null, author.id, author.fullname || author.email || "Usuario",
      normalizeRole(author.role), body, mentionedUserIds, noteType, emailMeta ? JSON.stringify(emailMeta) : null,
      JSON.stringify(attachments || []), sourceCommunicationId || null,
      payloadHash, previousHash, noteHash, createdAt,
    ],
  );
  return rows[0];
}

function toInboundEmailBody({ senderEmail, subject, bodyPreview }) {
  const lines = [
    senderEmail ? `Correo recibido de: ${senderEmail}` : "Correo recibido desde Gmail",
    subject ? `Asunto: ${subject}` : null,
    bodyPreview ? String(bodyPreview).trim() : null,
  ].filter(Boolean);
  return lines.join("\n").slice(0, 4000);
}

// Solo lo invoca el modulo gmail-context despues de validar el registro
// idempotente. El identificador de comunicacion queda en la nota, por lo que
// la base impide que un mismo mensaje llegue dos veces al historial final.
async function recordInboundEmail({ entityType, entityId, author, communication }) {
  assertValidEntityType(entityType);
  await assertParticipantAccess(entityType, entityId, author);

  const sourceCommunicationId = String(communication?.id || "").trim();
  if (!sourceCommunicationId) {
    const err = new Error("La comunicacion de origen es obligatoria.");
    err.status = 400;
    throw err;
  }

  const emailMeta = {
    direction: "inbound",
    from: communication.sender_email || null,
    to: Array.isArray(communication.recipient_emails) ? communication.recipient_emails : [],
    subject: communication.subject || null,
    gmail_message_id: communication.gmail_message_id,
    gmail_thread_id: communication.gmail_thread_id || null,
    received_at: communication.received_at || null,
  };

  return _appendNote({
    entityType,
    entityId,
    author,
    body: toInboundEmailBody({
      senderEmail: communication.sender_email,
      subject: communication.subject,
      bodyPreview: communication.body_preview,
    }),
    noteType: "email",
    emailMeta,
    sourceCommunicationId,
  });
}

async function createNote({ entityType, entityId, author, body, parentNoteId = null, mentionedUserIds = [], attachments = [] }) {
  assertValidEntityType(entityType);
  const trimmedBody = String(body || "").trim();
  if (!trimmedBody) {
    const err = new Error("La nota no puede estar vacia.");
    err.status = 400;
    throw err;
  }
  if (trimmedBody.length > 4000) {
    const err = new Error("La nota no puede superar 4000 caracteres.");
    err.status = 400;
    throw err;
  }
  const nonImage = attachments.find((att) => !String(att.contentType || "").startsWith("image/"));
  if (nonImage) {
    const err = new Error(`Solo se pueden adjuntar imagenes en una nota: ${nonImage.filename}`);
    err.status = 400;
    throw err;
  }
  const totalBytes = attachments.reduce((sum, att) => sum + Math.ceil((att.contentBase64?.length || 0) * 0.75), 0);
  if (totalBytes > NOTE_MAX_ATTACHMENTS_BYTES) {
    const err = new Error("Las imagenes adjuntas superan el limite de 20MB combinadas.");
    err.status = 400;
    throw err;
  }

  const entityLabel = await assertParticipantAccess(entityType, entityId, author);

  let parentNote = null;
  if (parentNoteId) {
    const { rows } = await db.query(
      `SELECT id, author_id, author_name_snapshot FROM process_notes
        WHERE id = $1 AND entity_type = $2 AND entity_id = $3 LIMIT 1`,
      [parentNoteId, entityType, String(entityId)],
    );
    parentNote = rows[0] || null;
    if (!parentNote) {
      const err = new Error("La nota a la que intentas responder no existe en este proceso.");
      err.status = 404;
      throw err;
    }
  }

  // Solo se puede mencionar a alguien con acceso real a este proceso (mismo
  // criterio de participantes que la lectura/escritura del hilo).
  const candidates = await listMentionCandidates(entityType);
  const candidateIds = new Set(candidates.map((c) => c.id));
  const cleanMentions = [...new Set((mentionedUserIds || []).map(Number))].filter((id) => candidateIds.has(id));

  const uploaded = await Promise.all(
    attachments.map((att) => uploadAttachmentToDrive({ entityType, entityId, attachment: att })),
  );
  const attachmentMeta = attachments.map((att, idx) => ({
    filename: att.filename,
    content_type: att.contentType || null,
    size_bytes: Math.ceil((att.contentBase64?.length || 0) * 0.75),
    drive_url: uploaded[idx]?.webViewLink || (uploaded[idx]?.id ? `https://drive.google.com/open?id=${encodeURIComponent(uploaded[idx].id)}` : null),
    drive_file_id: uploaded[idx]?.id || null,
  }));

  const note = await _appendNote({ entityType, entityId, author, body: trimmedBody, parentNoteId, mentionedUserIds: cleanMentions, attachments: attachmentMeta });

  notifyParticipants({ entityType, entityId, entityLabel, note, parentNote, mentionedUserIds: cleanMentions }).catch((error) => {
    logger.warn({ error: error?.message, noteId: note.id }, "No se pudo notificar la nueva nota de proceso");
  });

  return note;
}

function normalizeEmailList(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[,;]/);
  const clean = list.map((item) => String(item || "").trim()).filter(Boolean);
  const invalid = clean.filter((email) => !EMAIL_REGEX.test(email));
  if (invalid.length) {
    const err = new Error(`Correo invalido: ${invalid.join(", ")}`);
    err.status = 400;
    throw err;
  }
  return [...new Set(clean.map((email) => email.toLowerCase()))];
}

function replySubject(subject) {
  const clean = String(subject || "").trim();
  return /^re\s*:/i.test(clean) ? clean : `Re: ${clean}`;
}

async function getGmailReplyContext({ entityType, entityId, replyToNoteId }) {
  const noteId = Number(replyToNoteId);
  if (!Number.isInteger(noteId) || noteId <= 0) {
    const err = new Error("La nota de correo a responder no es valida.");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `SELECT n.id, c.mailbox_email, c.gmail_thread_id, c.sender_email, c.subject
       FROM process_notes n
       JOIN gmail_context_communications c ON c.id = n.source_communication_id
      WHERE n.id = $1
        AND n.entity_type = $2
        AND n.entity_id = $3
        AND n.note_type = 'email'
      LIMIT 1`,
    [noteId, entityType, String(entityId)],
  );
  const context = rows[0];
  if (!context?.gmail_thread_id || !context?.mailbox_email || !context?.sender_email || !context?.subject) {
    const err = new Error("Esta nota no proviene de un correo de Gmail vinculado que se pueda responder.");
    err.status = 409;
    err.code = "PROCESS_NOTE_GMAIL_REPLY_UNAVAILABLE";
    throw err;
  }
  return context;
}

async function uploadAttachmentToDrive({ entityType, entityId, attachment }) {
  const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_FOLDER_ID || null;
  if (!rootFolderId) return null;
  try {
    const folder = await ensureFolderPath(["Notas de proceso", entityType, String(entityId)], rootFolderId);
    return await uploadBase64File(
      attachment.filename,
      attachment.contentBase64,
      attachment.contentType || "application/octet-stream",
      folder?.id,
      { makeAnyoneReader: true },
    );
  } catch (error) {
    logger.warn(
      { error: error?.message, entityType, entityId, filename: attachment.filename },
      "No se pudo subir el adjunto a Drive para dejarlo abrible desde la nota",
    );
    return null;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Envia un correo (internos y/o externos, con adjuntos) desde el hilo de
// notas de un proceso y deja constancia como nota tipo 'email' -- misma
// cadena de hash e igual de inmutable que cualquier otra nota. El archivo
// adjunto solo viaja en el correo, no se duplica en almacenamiento propio.
async function sendProcessEmail({ entityType, entityId, author, to, cc = [], subject, body, replyToNoteId = null, attachments = [] }) {
  assertValidEntityType(entityType);
  const isGmailReply = Boolean(replyToNoteId);
  const replyContext = isGmailReply
    ? await getGmailReplyContext({ entityType, entityId, replyToNoteId })
    : null;
  const trimmedSubject = isGmailReply ? replySubject(replyContext.subject) : String(subject || "").trim();
  const trimmedBody = String(body || "").trim();
  if (!trimmedSubject) {
    const err = new Error("El correo necesita un asunto.");
    err.status = 400;
    throw err;
  }
  if (!trimmedBody) {
    const err = new Error("El correo necesita un mensaje.");
    err.status = 400;
    throw err;
  }

  // En una respuesta de Gmail el destinatario procede exclusivamente de la
  // comunicación vinculada. El cliente no puede sustituirlo con un valor del
  // formulario y convertir una respuesta en un correo diferente.
  const recipients = normalizeEmailList(isGmailReply ? replyContext.sender_email : to);
  if (!recipients.length) {
    const err = new Error("Debes indicar al menos un destinatario.");
    err.status = 400;
    throw err;
  }
  const ccList = normalizeEmailList(cc);

  const totalBytes = attachments.reduce((sum, att) => sum + Math.ceil((att.contentBase64?.length || 0) * 0.75), 0);
  if (totalBytes > EMAIL_MAX_ATTACHMENTS_BYTES) {
    const err = new Error("Los adjuntos superan el limite de 20MB combinados.");
    err.status = 400;
    throw err;
  }

  const entityLabel = await assertParticipantAccess(entityType, entityId, author);

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;white-space:pre-wrap;">${escapeHtml(trimmedBody)}</div>
    <hr style="margin-top:24px;border:none;border-top:1px solid #e5e7eb;" />
    <p style="font-size:11px;color:#9ca3af;">Enviado por ${escapeHtml(author.fullname || author.email)} desde FamSPI — ${escapeHtml(entityLabel?.label || "proceso")}.</p>
  `;

  let result;
  try {
    result = await sendMail({
      to: recipients,
      cc: ccList.length ? ccList : undefined,
      subject: trimmedSubject,
      html: htmlBody,
      replyTo: isGmailReply ? replyContext.mailbox_email : author.email,
      from: isGmailReply ? replyContext.mailbox_email : undefined,
      delegatedUser: isGmailReply ? replyContext.mailbox_email : undefined,
      senderName: isGmailReply ? undefined : author.fullname || undefined,
      source: "process_notes.email",
      threadId: isGmailReply ? replyContext.gmail_thread_id : null,
      requireThreading: isGmailReply,
      attachments,
    });
  } catch (error) {
    if (error?.code === "MAIL_THREAD_CONTEXT_UNAVAILABLE") {
      const err = new Error("No se pudo validar el hilo de Gmail. La respuesta no fue enviada para evitar crear un correo fuera de la conversación.");
      err.status = 503;
      err.code = error.code;
      throw err;
    }
    throw error;
  }

  if (!result?.delivered) {
    const err = new Error("No se pudo enviar el correo. Intenta de nuevo en unos minutos.");
    err.status = 502;
    throw err;
  }

  // Sube una copia de cada adjunto a Drive solo para poder abrirlo despues
  // desde la nota (el correo ya se envio de todas formas con el adjunto
  // original) -- si Drive falla para un archivo puntual no se interrumpe el
  // registro de la nota, solo ese adjunto queda sin link para abrir.
  const uploadedAttachments = await Promise.all(
    attachments.map((att) => uploadAttachmentToDrive({ entityType, entityId, attachment: att })),
  );

  const emailMeta = {
    direction: "outbound",
    to: recipients,
    cc: ccList,
    subject: trimmedSubject,
    delivered_via: result.via,
    reply_to_note_id: isGmailReply ? Number(replyToNoteId) : null,
    gmail_thread_id: isGmailReply ? (result.providerThreadId || replyContext.gmail_thread_id) : null,
    rfc822_message_id: result.rfc822MessageId || null,
    attachments: attachments.map((att, idx) => ({
      filename: att.filename,
      content_type: att.contentType || null,
      size_bytes: Math.ceil((att.contentBase64?.length || 0) * 0.75),
      drive_url: uploadedAttachments[idx]?.webViewLink || (uploadedAttachments[idx]?.id ? `https://drive.google.com/open?id=${encodeURIComponent(uploadedAttachments[idx].id)}` : null),
      drive_file_id: uploadedAttachments[idx]?.id || null,
    })),
  };

  const noteBody = [
    `Correo enviado a: ${recipients.join(", ")}`,
    ccList.length ? `CC: ${ccList.join(", ")}` : null,
    `Asunto: ${trimmedSubject}`,
    trimmedBody,
  ].filter(Boolean).join("\n");

  const note = await _appendNote({
    entityType, entityId, author, body: noteBody, noteType: "email", emailMeta,
    parentNoteId: isGmailReply ? Number(replyToNoteId) : null,
  });

  notifyParticipants({
    entityType, entityId, entityLabel, note, parentNote: null, mentionedUserIds: [],
  }).catch(() => null);

  return note;
}

// ponytail: "registro de notificados" se resuelve reusando la tabla
// notifications ya existente (source=process_notes.*) en vez de crear una
// tabla nueva solo para auditar a quien se le aviso -- ya queda consultable
// ahi igual que el resto de notificaciones del sistema.
async function notifyParticipants({ entityType, entityId, entityLabel, note, parentNote, mentionedUserIds }) {
  const targetPath = buildTargetPath(entityType, entityId);
  const label = entityLabel?.label || "el proceso";
  const notifiedUserIds = new Set();

  for (const userId of mentionedUserIds) {
    if (Number(userId) === Number(note.author_id)) continue;
    notifiedUserIds.add(Number(userId));
    await notificationManager.sendNotification({
      userId,
      customTitle: `${note.author_name_snapshot} te mencionó en una nota`,
      customMessage: `${note.author_name_snapshot} te mencionó en ${label}: "${truncate(note.body)}"`,
      type: "task",
      source: "process_notes.mention",
      priority: 2,
      email: true,
      chat: true,
      meta: { entityType, entityId: String(entityId), noteId: note.id, target_path: targetPath },
    }).catch(() => null);
  }

  if (parentNote && Number(parentNote.author_id) !== Number(note.author_id) && !notifiedUserIds.has(Number(parentNote.author_id))) {
    await notificationManager.sendNotification({
      userId: parentNote.author_id,
      customTitle: `${note.author_name_snapshot} respondió tu nota`,
      customMessage: `${note.author_name_snapshot} respondió en ${label}: "${truncate(note.body)}"`,
      type: "info",
      source: "process_notes.reply",
      priority: 1,
      email: false,
      chat: true,
      meta: { entityType, entityId: String(entityId), noteId: note.id, target_path: targetPath },
    }).catch(() => null);
  }
}

function truncate(text, max = 140) {
  const clean = String(text || "");
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function buildTargetPath(entityType, entityId) {
  if (entityType === "business_case") return `/dashboard/business-case/workspace/${entityId}`;
  const type = entityType === "public_purchase" ? "public" : "private";
  return `/dashboard/purchases/workspace/expediente/${type}/${entityId}`;
}

async function markNoteRead(entityType, entityId, noteId, userId) {
  assertValidEntityType(entityType);
  const { rows } = await db.query(
    `SELECT id FROM process_notes WHERE id = $1 AND entity_type = $2 AND entity_id = $3 LIMIT 1`,
    [noteId, entityType, String(entityId)],
  );
  if (!rows[0]) {
    const err = new Error("Nota no encontrada.");
    err.status = 404;
    throw err;
  }
  await db.query(
    `INSERT INTO process_note_reads (note_id, user_id) VALUES ($1, $2)
     ON CONFLICT (note_id, user_id) DO NOTHING`,
    [noteId, userId],
  );
}

module.exports = {
  ENTITY_TYPES,
  assertParticipantAccess,
  assertUserHasEntityTypeAccess,
  listMentionCandidates,
  listNotes,
  createNote,
  recordInboundEmail,
  sendProcessEmail,
  markNoteRead,
};
