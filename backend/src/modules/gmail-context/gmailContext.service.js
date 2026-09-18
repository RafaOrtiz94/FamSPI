const db = require("../../config/db");
const clientsService = require("../clients/clients.service");
const businessCaseService = require("../business-case/businessCase.service");
const processNotesService = require("../process-notes/processNotes.service");

const ADMIN_ROLES = new Set(["admin", "administrador", "gerencia", "gerencia_general"]);
const MAX_PAGE_SIZE = 50;
const MAX_CLIENT_SUGGESTIONS = 5;

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isAdmin(user) {
  return ADMIN_ROLES.has(normalizeRole(user?.role));
}

function assertUser(user) {
  if (!Number.isInteger(Number(user?.id)) || !normalizeEmail(user?.email)) {
    throw httpError("Usuario autenticado invalido.", 401, "GMAIL_CONTEXT_AUTH_INVALID");
  }
}

function canAccessCommunication(row, user) {
  return isAdmin(user) || Number(row?.registered_by_user_id) === Number(user?.id);
}

function formatCommunication(row) {
  if (!row) return null;
  return {
    ...row,
    recipient_emails: Array.isArray(row.recipient_emails) ? row.recipient_emails : [],
  };
}

function normalizeMatchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractClientSearchTerms(communication) {
  const source = [
    communication?.subject,
    communication?.body_preview,
    communication?.sender_email,
    ...(communication?.recipient_emails || []),
  ].filter(Boolean).join("\n");
  const terms = new Set();
  const emails = new Set((source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(normalizeEmail));
  const identifiers = new Set(source.match(/\b\d{10}(?:\d{3})?\b/g) || []);
  const clientLabelPattern = /(?:cliente|empresa|raz[oó]n\s+social)\s*[:#-]\s*([^\r\n]{2,160})/gi;
  let match;
  while ((match = clientLabelPattern.exec(source))) {
    const value = String(match[1] || "")
      .replace(/\.\s*(?:proceso|referencia|contacto|correo|ruc|c[eé]dula|ciudad)\b.*$/i, "")
      .replace(/[|;,]+$/g, "")
      .trim();
    if (value.length >= 2) terms.add(value);
  }
  identifiers.forEach((value) => terms.add(value));
  emails.forEach((value) => terms.add(value));
  return { source: normalizeMatchText(source), terms: [...terms].slice(0, 12), emails, identifiers };
}

async function suggestClientsForCommunication({ user, communication }) {
  assertUser(user);
  const extracted = extractClientSearchTerms(communication);
  if (!extracted.terms.length) return [];

  const candidates = new Map();
  for (const term of extracted.terms) {
    const result = await clientsService.listAccessibleClients({ user, q: term, page: 1, limit: 25 });
    for (const client of result?.clients || result?.items || []) candidates.set(Number(client.id), client);
  }

  return [...candidates.values()]
    .map((client) => {
      const name = client.commercial_name || client.nombre || client.legal_person_business_name || "";
      const normalizedName = normalizeMatchText(name);
      const email = normalizeEmail(client.client_email);
      const ruc = String(client.ruc_cedula || client.identificador || "").trim();
      const evidence = [];
      let score = 0;
      if (ruc && extracted.identifiers.has(ruc)) { score += 100; evidence.push("RUC/cédula exacto"); }
      if (email && extracted.emails.has(email)) { score += 90; evidence.push("correo exacto"); }
      if (normalizedName.length >= 4 && extracted.source.includes(normalizedName)) { score += 80; evidence.push("nombre comercial exacto"); }
      return {
        id: client.id,
        label: name || `Cliente ${client.id}`,
        client_email: client.client_email || null,
        ruc_cedula: client.ruc_cedula || client.identificador || null,
        score,
        confidence: score >= 100 ? "high" : "medium",
        evidence,
      };
    })
    .filter((candidate) => candidate.evidence.length > 0)
    .sort((left, right) => right.score - left.score || String(left.label).localeCompare(String(right.label)))
    .slice(0, MAX_CLIENT_SUGGESTIONS);
}

async function getCommunicationOrThrow(id, user) {
  const { rows } = await db.query(
    `SELECT *
       FROM gmail_context_communications
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw httpError("Comunicacion no encontrada.", 404, "GMAIL_CONTEXT_NOT_FOUND");
  if (!canAccessCommunication(row, user)) {
    throw httpError("No tienes acceso a esta comunicacion.", 403, "GMAIL_CONTEXT_FORBIDDEN");
  }
  return formatCommunication(row);
}

async function registerCommunication({ user, payload }) {
  assertUser(user);
  const mailboxEmail = normalizeEmail(user.email);
  const recipients = [...new Set((payload.recipient_emails || []).map(normalizeEmail).filter(Boolean))];
  const params = [
    mailboxEmail,
    payload.gmail_message_id,
    payload.gmail_thread_id || null,
    normalizeEmail(payload.sender_email) || null,
    JSON.stringify(recipients),
    payload.subject || null,
    payload.received_at || null,
    payload.body_preview || null,
    Number(user.id),
  ];

  const inserted = await db.query(
    `INSERT INTO gmail_context_communications (
       mailbox_email, gmail_message_id, gmail_thread_id, sender_email,
       recipient_emails, subject, received_at, body_preview, registered_by_user_id
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
     ON CONFLICT (lower(mailbox_email), gmail_message_id) DO NOTHING
     RETURNING *`,
    params,
  );

  if (inserted.rows[0]) {
    return { communication: formatCommunication(inserted.rows[0]), created: true };
  }

  const { rows } = await db.query(
    `SELECT *
       FROM gmail_context_communications
      WHERE lower(mailbox_email) = lower($1)
        AND gmail_message_id = $2
      LIMIT 1`,
    [mailboxEmail, payload.gmail_message_id],
  );
  return { communication: formatCommunication(rows[0]), created: false };
}

async function listCommunications({ user, status, page = 1, pageSize = 25 }) {
  assertUser(user);
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || 25));
  const params = [];
  const clauses = [];
  if (!isAdmin(user)) {
    params.push(Number(user.id));
    clauses.push(`registered_by_user_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(safePageSize, (safePage - 1) * safePageSize);
  const { rows } = await db.query(
    `SELECT *, COUNT(*) OVER() AS total_count
       FROM gmail_context_communications
       ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    items: rows.map(formatCommunication),
    page: safePage,
    page_size: safePageSize,
    total: Number(rows[0]?.total_count || 0),
  };
}

async function searchClients({ user, q }) {
  assertUser(user);
  const result = await clientsService.listAccessibleClients({ user, q, page: 1, limit: 25 });
  return (result?.clients || result?.items || []).map((client) => ({
    id: client.id,
    label: client.commercial_name || client.nombre || client.legal_person_business_name || `Cliente ${client.id}`,
    client_email: client.client_email || null,
    ruc_cedula: client.ruc_cedula || client.identificador || null,
  }));
}

async function getClientSuggestions({ id, user }) {
  const communication = await getCommunicationOrThrow(id, user);
  return suggestClientsForCommunication({ user, communication });
}

async function findUniqueAutomaticProcess(clientRequestId) {
  const { rows } = await db.query(
    `SELECT entity_type, entity_id, label
       FROM (
         SELECT 'public_purchase'::text AS entity_type, id::text AS entity_id, client_name AS label
           FROM equipment_purchase_requests
          WHERE purchase_type = 'public' AND client_id = $1
          LIMIT 2
       ) public_processes
     UNION ALL
     SELECT entity_type, entity_id, label
       FROM (
         SELECT 'private_purchase'::text AS entity_type, id::text AS entity_id,
                COALESCE(client_snapshot->>'commercial_name', client_snapshot->>'name', 'Compra privada') AS label
           FROM private_purchase_requests
          WHERE client_request_id = $1
          LIMIT 2
       ) private_processes`,
    [clientRequestId],
  );
  return rows;
}

async function getProcessCandidates({ id, user, clientRequestId }) {
  assertUser(user);
  await getCommunicationOrThrow(id, user);
  const normalizedClientId = Number(clientRequestId);
  if (!Number.isInteger(normalizedClientId) || normalizedClientId <= 0) {
    throw httpError("Cliente invalido para consultar sus procesos.", 400, "GMAIL_CONTEXT_CLIENT_INVALID");
  }

  const { rows } = await db.query(
    `SELECT 'public_purchase'::text AS entity_type, id::text AS entity_id,
            client_name AS label, status::text AS status, created_at
       FROM equipment_purchase_requests
      WHERE purchase_type = 'public' AND client_id = $1
     UNION ALL
     SELECT 'private_purchase'::text AS entity_type, id::text AS entity_id,
            COALESCE(client_snapshot->>'commercial_name', client_snapshot->>'name', 'Compra privada') AS label,
            status::text AS status, created_at
       FROM private_purchase_requests
      WHERE client_request_id = $1
      ORDER BY created_at DESC
      LIMIT 25`,
    [normalizedClientId],
  );

  const accessible = [];
  for (const row of rows) {
    try {
      await processNotesService.assertParticipantAccess(row.entity_type, row.entity_id, user);
      accessible.push({
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        label: row.label || "Proceso sin cliente visible",
        status: row.status || null,
      });
    } catch (error) {
      if (error?.status !== 403) throw error;
    }
  }
  return accessible;
}

async function autoLinkCommunication({ id, user }) {
  const communication = await getCommunicationOrThrow(id, user);
  if (communication.status === "linked" && communication.process_note_id) return communication;

  const suggestions = await suggestClientsForCommunication({ user, communication });
  if (suggestions.length !== 1) {
    throw httpError("No existe una coincidencia única de cliente para vincular automáticamente.", 409, "GMAIL_CONTEXT_CLIENT_AMBIGUOUS");
  }

  const client = suggestions[0];
  const processes = await findUniqueAutomaticProcess(client.id);
  if (processes.length !== 1) {
    throw httpError("El cliente no tiene un único proceso compatible para vincular automáticamente.", 409, "GMAIL_CONTEXT_PROCESS_AMBIGUOUS");
  }

  return linkCommunication({
    id,
    user,
    entityType: processes[0].entity_type,
    entityId: processes[0].entity_id,
    clientRequestId: client.id,
  });
}

async function searchProcesses({ user, entityType, q }) {
  assertUser(user);
  processNotesService.assertUserHasEntityTypeAccess(entityType, user);
  const query = String(q || "").trim();

  if (entityType === "business_case") {
    const result = await businessCaseService.listBusinessCases({ page: 1, pageSize: 25, q: query || undefined }, user);
    return (result?.items || []).map((item) => ({
      entity_type: entityType,
      entity_id: item.business_case_id,
      label: item.client_name || `Business Case ${item.business_case_id}`,
      status: item.canonical_state || item.status || null,
    }));
  }

  const config = entityType === "public_purchase"
    ? { table: "equipment_purchase_requests", typeFilter: "purchase_type = 'public'", clientName: "client_name" }
    : { table: "private_purchase_requests", typeFilter: "TRUE", clientName: "COALESCE(client_snapshot->>'commercial_name', client_snapshot->>'name', '')" };
  const { rows } = await db.query(
    `SELECT id::text AS entity_id, ${config.clientName} AS client_name, status::text AS status, created_at
       FROM ${config.table}
      WHERE ${config.typeFilter}
        AND ($1 = '' OR lower(${config.clientName}) LIKE lower($2) OR id::text ILIKE $2)
      ORDER BY created_at DESC
      LIMIT 25`,
    [query, `%${query}%`],
  );
  return rows.map((row) => ({
    entity_type: entityType,
    entity_id: row.entity_id,
    label: row.client_name || `${entityType} ${row.entity_id}`,
    status: row.status || null,
  }));
}

async function linkCommunication({ id, user, entityType, entityId, clientRequestId = null }) {
  assertUser(user);
  const communication = await getCommunicationOrThrow(id, user);
  if (communication.status === "linked" && communication.process_note_id) return communication;

  await processNotesService.assertParticipantAccess(entityType, entityId, user);
  let note;
  try {
    note = await processNotesService.recordInboundEmail({
      entityType,
      entityId,
      author: user,
      communication,
    });
  } catch (error) {
    if (error?.code !== "23505") throw error;
    const { rows } = await db.query(
      `SELECT id FROM process_notes WHERE source_communication_id = $1 LIMIT 1`,
      [communication.id],
    );
    note = rows[0];
    if (!note) throw error;
  }

  const { rows } = await db.query(
    `UPDATE gmail_context_communications
        SET status = 'linked',
            client_request_id = COALESCE($2, client_request_id),
            linked_entity_type = $3,
            linked_entity_id = $4,
            process_note_id = $5,
            linked_by_user_id = $6,
            linked_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, clientRequestId, entityType, String(entityId), note.id, Number(user.id)],
  );
  return formatCommunication(rows[0]);
}

module.exports = {
  extractClientSearchTerms,
  suggestClientsForCommunication,
  getCommunicationOrThrow,
  registerCommunication,
  listCommunications,
  searchClients,
  getClientSuggestions,
  getProcessCandidates,
  autoLinkCommunication,
  searchProcesses,
  linkCommunication,
};
