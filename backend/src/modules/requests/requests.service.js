/**
 * Service: Requests
 * -----------------
 * Maneja creación, consulta y actualización de solicitudes (requests)
 * con integración Drive + Docs + Auditoría y validación dinámica AJV.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { v4: uuidv4 } = require("uuid");
const { drive } = require("../../config/google");
const {
  copyTemplate,
  replaceTags,
  uploadBase64File,
  ensureFolder,
  exportPdf,
} = require("../../utils/drive");
const { resolveRequestDriveFolders, padId } = require("../../utils/drivePaths");
const { logAction } = require("../../utils/audit");
const { sendMail } = require("../../utils/mailer");
const { sendChatMessage } = require("../../utils/googleChat");
const { createClientFolder, moveClientFolderToApproved } = require("../../utils/driveClientManager");
const crypto = require("crypto");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const requestSchemas = require("./requestSchemas");

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3001").replace(
  /\$\/$/, ""
);
const CONSENT_EMAIL_TOKEN_TTL_MINUTES = parseInt(
  process.env.CONSENT_EMAIL_TOKEN_TTL_MINUTES || "15",
  10
);
const CONSENT_EMAIL_TOKEN_TTL_MS = Math.max(5, CONSENT_EMAIL_TOKEN_TTL_MINUTES || 15) * 60 * 1000;
const REQUEST_TYPE_LABELS = {
  "F.ST-20": "Solicitud de inspección de ambiente",
  "F.ST-21": "Solicitud de retiro de equipo",
  "F.ST-22": "Registro de nuevo cliente",
};

// 🧩 Validación dinámica con logs extendidos
// Nota: removeAdditional "all" elimina propiedades válidas cuando se usan
// esquemas compuestos (allOf/if-then). Usamos "failing" para limpiar sólo
// las propiedades que realmente incumplen la validación sin despojar el
// payload completo.
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: "failing",
  useDefaults: true,
  coerceTypes: true,
});
addFormats(ajv);
ajv.addSchema(requestSchemas.newClient, 'newClient');

const CLIENT_FILE_LABELS = {
  id_file: "Documento de identificación (PDF)",
  ruc_file: "RUC en PDF",
  legal_rep_appointment_file: "Nombramiento del representante legal (PDF)",
  operating_permit_file: "Permiso de funcionamiento (PDF)",
  consent_evidence_file: "Evidencia del consentimiento LOPDP",
};

const FORM_VARIANT_META = {
  inspection: {
    label: "Solicitud de Inspección de Ambiente",
  },
  retiro: {
    label: "Solicitud de Retiro de Equipo",
  },
  compra: {
    label: "Proceso de Compra",
  },
  cliente: {
    label: "Ficha de Cliente",
  },
};

function buildHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hashConsentEmailCode(tokenId, code) {
  return crypto.createHash("sha256").update(`${tokenId}:${code}`).digest("hex");
}

function maskConsentCode(lastFour) {
  if (!lastFour) return "código OTP";
  const lastDigits = String(lastFour).slice(-4);
  return `****${lastDigits}`;
}

async function getConsentTokenById(tokenId) {
  if (!tokenId) return null;
  const { rows } = await db.query(
    "SELECT * FROM client_request_consent_tokens WHERE id = $1",
    [tokenId],
  );
  return rows[0] || null;
}

async function sendConsentEmailToken({ user, client_email, recipient_email, client_name }) {
  const normalizedEmail = (recipient_email || client_email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw buildHttpError("Debes ingresar el correo del cliente antes de enviar el código.");
  }
  const friendlyName = (client_name || "").trim();
  const tokenId = uuidv4();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = hashConsentEmailCode(tokenId, code);
  const expiresAt = new Date(Date.now() + CONSENT_EMAIL_TOKEN_TTL_MS);

  const insert = await db.query(
    `INSERT INTO client_request_consent_tokens
      (id, client_email, client_name, code_hash, code_last_four, status, expires_at, created_by_email, created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8)
     RETURNING id, expires_at` ,
    [
      tokenId,
      normalizedEmail,
      friendlyName || null,
      codeHash,
      code.slice(-4),
      expiresAt,
      user?.email || null,
      user?.id || null,
    ],
  );

  const html = `
    <h2>Autorización del tratamiento de datos</h2>
    <p>Hola${friendlyName ? ` ${friendlyName}` : ""},</p>
    <p>Estamos registrando tu ficha como cliente en SPI y necesitamos confirmar que autorizas el uso de tus datos conforme a la LOPDP.</p>
    <p>Comparte el siguiente código con tu asesor comercial para finalizar el proceso:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
    <p>El código vence en ${Math.round(CONSENT_EMAIL_TOKEN_TTL_MS / 60000)} minutos. Compartirlo implica tu consentimiento expreso para el tratamiento descrito.</p>
    <p>Si no reconoces esta solicitud, ignora este correo.</p>
  `;

  await sendMail({
    to: normalizedEmail,
    subject: "Código de autorización para tratamiento de datos",
    html,
    senderName: user?.fullname || user?.name || user?.email || "SPI",
    replyTo: user?.email || undefined,
  });

  return {
    token_id: insert.rows[0].id,
    expires_at: insert.rows[0].expires_at,
  };
}

async function verifyConsentEmailToken({ user, token_id, code }) {
  const tokenId = (token_id || "").trim();
  const submittedCode = (code || "").trim();
  if (!tokenId || !submittedCode) {
    throw buildHttpError("Debes ingresar el código enviado al correo del cliente.");
  }

  const token = await getConsentTokenById(tokenId);
  if (!token) {
    throw buildHttpError("No encontramos un código válido. Genera uno nuevo.", 404);
  }
  if (token.used_at) {
    throw buildHttpError("Este código ya fue utilizado en otra solicitud.", 409);
  }
  if (token.status === "expired") {
    throw buildHttpError("El código expiró. Solicita uno nuevo.");
  }

  const now = Date.now();
  if (token.expires_at && new Date(token.expires_at).getTime() < now) {
    await db.query(
      "UPDATE client_request_consent_tokens SET status = 'expired', updated_at = now() WHERE id = $1",
      [tokenId],
    );
    throw buildHttpError("El código expiró. Solicita uno nuevo.");
  }

  const hashedAttempt = hashConsentEmailCode(tokenId, submittedCode);
  if (hashedAttempt !== token.code_hash) {
    await db.query(
      "UPDATE client_request_consent_tokens SET attempts = attempts + 1, updated_at = now() WHERE id = $1",
      [tokenId],
    );
    throw buildHttpError("El código ingresado no coincide con el enviado al cliente.");
  }

  const { rows } = await db.query(
    `UPDATE client_request_consent_tokens
      SET status = 'verified',
          attempts = attempts + 1,
          verified_at = now(),
          verified_by_email = $2,
          verified_by_user_id = $3,
          updated_at = now()
     WHERE id = $1
     RETURNING id, verified_at, expires_at, client_email, client_name, code_last_four` ,
    [tokenId, user?.email || null, user?.id || null],
  );
  return rows[0];
}

async function assertVerifiedConsentEmailToken({ tokenId, email }) {
  const token = await getConsentTokenById(tokenId);
  if (!token) {
    throw buildHttpError("Debes validar el código de consentimiento antes de continuar.");
  }
  if (token.used_at) {
    throw buildHttpError("El código ingresado ya fue usado en otra solicitud.", 409);
  }
  if (token.status !== "verified" || !token.verified_at) {
    throw buildHttpError("El código aún no ha sido verificado en el formulario.");
  }
  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now()) {
    await db.query(
      "UPDATE client_request_consent_tokens SET status = 'expired', updated_at = now() WHERE id = $1",
      [token.id],
    );
    throw buildHttpError("El código verificado expiró. Solicita uno nuevo.");
  }
  if (email && token.client_email && token.client_email.toLowerCase() !== email.trim().toLowerCase()) {
    throw buildHttpError("El código pertenece a otro correo. Genera uno nuevo para este cliente.");
  }
  return token;
}

async function markConsentEmailTokenAsUsed(tokenId, requestId) {
  if (!tokenId) return;
  await db.query(
    `UPDATE client_request_consent_tokens
      SET status = 'used', used_at = now(), used_request_id = $2, updated_at = now()
     WHERE id = $1`,
    [tokenId, requestId || null],
  );
}

async function recordConsentEvent({
  client_request_id,
  event_type,
  method,
  details = null,
  actor_email = null,
  actor_role = null,
  actor_name = null,
  ip = null,
  user_agent = null,
  evidence_file_id = null,
}) {
  if (!client_request_id || !event_type || !method) return;
  const query = `
    INSERT INTO client_request_consents
      (client_request_id, event_type, method, details, evidence_file_id, actor_email, actor_role, actor_name, ip, user_agent)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `;
  await db.query(query, [
    client_request_id,
    event_type,
    method,
    details,
    evidence_file_id,
    actor_email,
    actor_role,
    actor_name,
    ip,
    user_agent,
  ]);
}

function formatDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" });
}

function getRequestLabel(code, fallback) {
  if (code && REQUEST_TYPE_LABELS[code]) return REQUEST_TYPE_LABELS[code];
  return fallback || code || "Solicitud";
}

function asText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return formatDate(value);
  return JSON.stringify(value);
}

// ================================================= ================
// 📄 Obtener tipo de solicitud por ID
// ================================================= ================
async function getRequestType(id) {
  const { rows } = await db.query("SELECT * FROM request_types WHERE id=$1", [id]);
  return rows[0];
}

// ================================================= ================
// 🔎 Resolver request_type_id cuando viene como texto
// ================================================= ================
async function resolveRequestTypeId(input) {
  if (!isNaN(Number(input))) return Number(input);
  const raw = String(input).trim().toLowerCase();
  const aliasToCode = {
    inspection: "F.ST-20",
    inspeccion: "F.ST-20",
    retiro: "F.ST-21",
    compra: "F.ST-19",
    cliente: "F.ST-22",
  };
  const codeHint = aliasToCode[raw] || input;
  let q = await db.query(
    `SELECT id FROM request_types WHERE code = $1`,
    [codeHint]
  );
  if (q.rows.length) return q.rows[0].id;
  q = await db.query(
    `SELECT id FROM request_types WHERE code ILIKE $1 OR title ILIKE $1 LIMIT 1`,
    [`%${codeHint}%`]
  );
  if (q.rows.length) return q.rows[0].id;
  throw new Error(
    `No se encontró tipo de solicitud correspondiente a '${input}'. Verifique la tabla request_types.`
  );
}

// ================================================= ================
// 🧾 Crear solicitud principal con validación AJV + logs
// ================================================= ================
async function createRequest({
  requester_id,
  requester_email = null,
  requester_name = null,
  request_type_id,
  payload,
  files = [],
}) {
  if (!requester_id || !request_type_id) {
    throw new Error("Faltan parámetros obligatorios: requester_id o request_type_id");
  }
  const typeId = await resolveRequestTypeId(request_type_id);
  const version = 1;
  const request_group_id = uuidv4();
  const typeRow = await getRequestType(typeId);
  if (!typeRow) throw new Error("Tipo de solicitud no válido");

  const code = String(typeRow.code || "").toUpperCase();
  let schemaKey = "cliente";
  if (code === "F.ST-20") schemaKey = "inspection";
  else if (code === "F.ST-21") schemaKey = "retiro";
  else if (code === "F.ST-19") schemaKey = "compra";

  const schema = requestSchemas[schemaKey];
  const validate = ajv.compile(schema);
  const valid = validate(payload || {});

  if (!valid) {
    const errors = validate.errors
      .map((e) => `${e.instancePath || e.keyword} ${e.message}`)
      .join(", ");
    const err = new Error(`Datos de solicitud inválidos (${schemaKey}): ${errors}`);
    err.validationErrors = validate.errors;
    throw err;
  }

  let requesterRole = null;
  try {
    const { rows } = await db.query(
      "SELECT email, fullname, name, role FROM users WHERE id = $1 LIMIT 1",
      [requester_id]
    );
    if (rows[0]) {
      requester_email = requester_email || rows[0].email;
      requester_name = requester_name || rows[0].fullname || rows[0].name;
      requesterRole = rows[0].role || null;
    }
  } catch (userErr) {
    logger.warn({ userErr }, "No se pudo obtener datos del solicitante");
  }

  const isJefeComercial = (requesterRole || "").toLowerCase() === "jefe_comercial";
  const normalizedPayload = {};
  for (const key of Object.keys(schema.properties || {})) {
    if (key === "equipos") {
      if (Array.isArray(payload?.equipos)) {
        normalizedPayload.equipos = payload.equipos.map((e) => ({ ...e }));
      } else {
        normalizedPayload.equipos = [];
      }
    } else {
      normalizedPayload[key] =
        payload[key] !== undefined && payload[key] !== null ? payload[key] : "";
    }
  }
  normalizedPayload.__form_variant = schemaKey;

  const insert = await db.query(
    `INSERT INTO requests (request_group_id, requester_id, request_type_id, payload, status, version_number)`
    + `VALUES ($1,$2,$3,$4,'pendiente',$5) RETURNING *`,
    [request_group_id, requester_id, typeId, JSON.stringify(normalizedPayload), version]
  );
  const request = insert.rows[0];

  await db.query(
    `INSERT INTO request_versions (request_id, version_number, payload)`
    + `VALUES ($1,$2,$3)`,
    [request.id, version, JSON.stringify(normalizedPayload)]
  );

  await logAction({
    user_id: requester_id,
    module: "requests",
    action: "create",
    entity: "requests",
    entity_id: request.id,
  });

  if (files?.length) {
    await saveAttachment({
      request_id: request.id,
      files,
      uploaded_by: requester_id,
    });
  }

  let doc = null;
  if (isJefeComercial) {
    try {
      doc = await generateActa(request.id, requester_id, schemaKey);
      await updateRequestStatus(request.id, "acta_generada");
    } catch (e) {
      logger.error("❌ Error generando acta:", e);
    }
  }

  const requesterProfile = await resolveRequesterProfile({
    requester_id,
    requester_email,
    requester_name,
  });

  if (requesterProfile) {
    await notifyTechnicalApprovers({
      request,
      requester: requesterProfile,
      requestType: typeRow,
      payload: normalizedPayload,
      document: doc,
    });
  }

  return {
    message: "Solicitud creada correctamente",
    request,
    document: doc,
  };
}

async function getRequestContext(request_id) {
  const { rows } = await db.query(
    `SELECT r.id,
            r.payload,
            rt.code AS type_code,
            rt.title AS type_title,
            d.code AS department_code,
            d.name AS department_name
     FROM requests r
     JOIN request_types rt ON r.request_type_id = rt.id
     LEFT JOIN users u ON u.id = r.requester_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE r.id = $1`,
    [request_id]
  );
  const ctx = rows[0];
  if (ctx && typeof ctx.payload === "string") {
    try {
      ctx.payload = JSON.parse(ctx.payload);
    } catch {
      ctx.payload = {};
    }
  }
  return ctx;
}

async function resolveRequestFolder(request_id, templateCode) {
  const ctx = await getRequestContext(request_id);
  if (!ctx) throw new Error(`No se encontró contexto para solicitud ${request_id}`);
  const payloadVariant = ctx.payload?.__form_variant;
  const templateHint = templateCode || payloadVariant || ctx.type_code;

  try {
    const folders = await resolveRequestDriveFolders({
      requestId: request_id,
      requestTypeCode: ctx.type_code,
      requestTypeTitle: ctx.type_title,
      departmentCode: ctx.department_code,
      departmentName: ctx.department_name,
      templateCode: templateHint,
    });
    return { ctx, folders };
  } catch (err) {
    logger.warn(
      "⚠️ No se pudo resolver la ruta en Drive para la solicitud %s (%s). Se usará la carpeta base.",
      request_id,
      err.message
    );
    const fallbackParent =
      process.env.DRIVE_REQUESTS_FOLDER_ID ||
      process.env.DRIVE_DOCS_FOLDER_ID ||
      process.env.DRIVE_FOLDER_ID ||
      process.env.DRIVE_ROOT_FOLDER_ID;
    if (!fallbackParent) throw err;
    const fallbackFolder = await ensureFolder(`REQ-${padId(request_id)}`, fallbackParent);
    return {
      ctx,
      folders: {
        rootId: fallbackParent,
        departmentFolderId: fallbackParent,
        typeFolderId: fallbackParent,
        requestFolderId: fallbackFolder.id,
      },
    };
  }
}

async function saveAttachment({ request_id, files, uploaded_by, driveFolderId }) {
  const { folders } = await resolveRequestFolder(request_id);
  const parentFolder =
    folders.requestFolderId ||
    driveFolderId ||
    folders.typeFolderId ||
    folders.departmentFolderId ||
    folders.rootId;

  const uploadedFiles = [];
  for (const f of files) {
    const base64 = f.buffer?.toString("base64") || f.base64;
    const name = f.originalname || f.name || `archivo-${Date.now()}`;
    const mime = f.mimetype || "application/octet-stream";
    const { id, webViewLink } = await uploadBase64File(name, base64, mime, parentFolder);
    uploadedFiles.push({ id, link: webViewLink });
    await db.query(
      `INSERT INTO request_attachments (request_id, drive_file_id, drive_link, mime_type, uploaded_by, title)`
      + `VALUES ($1,$2,$3,$4,$5,$6)`,
      [request_id, id, webViewLink, mime, uploaded_by, name]
    );
  }

  await logAction({
    user_id: uploaded_by,
    module: "requests",
    action: "upload_attachment",
    entity: "requests",
    entity_id: request_id,
    details: { count: uploadedFiles.length },
  });

  return uploadedFiles;
}

async function generateActa(request_id, uploaded_by, options = {}) {
  let formVariant = null;
  if (typeof options === "string") formVariant = options;
  else if (options && typeof options === "object") formVariant = options.formVariant || options.variant || null;

  const { ctx, folders } = await resolveRequestFolder(request_id, formVariant);
  const folderId = folders.requestFolderId;

  const { rows } = await db.query(
    `SELECT r.*, rt.code AS type_code, rt.title AS type_title,
            u.fullname AS requester_name, u.email AS requester_email
     FROM requests r
     JOIN request_types rt ON r.request_type_id=rt.id
     LEFT JOIN users u ON u.id=r.requester_id
     WHERE r.id=$1`,
    [request_id]
  );

  const req = rows[0];
  if (!req) throw new Error("Solicitud no encontrada");
  const payloadRaw = typeof req.payload === "string" ? JSON.parse(req.payload) : req.payload || {};
  const variantKey = (formVariant || payloadRaw.__form_variant || ctx.payload?.__form_variant || "").toLowerCase();
  const variantMeta = FORM_VARIANT_META[variantKey] || {};
  const paddedId = padId(request_id);
  const normalizedCode = req.type_code ? req.type_code.trim() : "ACTA";
  const pdfBaseName = `${normalizedCode}-${paddedId}`;
  const docLabel = variantMeta.label || req.type_title || "Acta";
  const templateId = req.type_code === "F.ST-21" ? process.env.DOC_TEMPLATE_SOLICITUD_1 : req.type_code === "F.ST-20" ? process.env.DOC_TEMPLATE_SOLICITUD_2 : process.env.DOC_TEMPLATE_SOLICITUD_3;
  const docName = `${docLabel} - ${pdfBaseName}`;
  const doc = await copyTemplate(templateId, docName, folderId);
  const payload = payloadRaw || {};

  const equipos = Array.isArray(payload.equipos) ? payload.equipos.slice(0, 4) : [];
  const equipmentTags = {};
  for (let i = 0; i < 4; i += 1) {
    const equipo = equipos[i] || {};
    equipmentTags[`<<N_Equipo${i + 1}>>`] = asText(equipo.nombre_equipo);
    equipmentTags[`<<E_Equipo${i + 1}>>`] = equipo.estado != null ? asText(equipo.estado) : equipo.cantidad != null ? asText(equipo.cantidad) : "";
  }

  const fechaInstalacionRaw = payload.fecha_instalacion || payload.fecha_retiro || payload.fecha_tentativa_visita || "";
  const replacements = {
    ID_SOLICITUD: asText(request_id),
    NOMBRE_CLIENTE: asText(payload.nombre_cliente),
    DIRECCION_CLIENTE: asText(payload.direccion_cliente),
    PERSONA_CONTACTO: asText(payload.persona_contacto),
    CELULAR_CONTACTO: asText(payload.celular_contacto),
    FECHA_INSTALACION: asText(fechaInstalacionRaw),
    EQUIPOS: (payload.equipos || []).map((e) => `${asText(e.nombre_equipo)} (${asText(e.estado ?? e.cantidad)})`).join(", "),
    ACCESORIOS: asText(payload.accesorios),
    ANOTACIONES: asText(payload.anotaciones),
    OBSERVACIONES: asText(payload.observaciones),
    SOLICITANTE: asText(req.requester_name),
    FECHA: formatDate(req.created_at) || new Date().toLocaleDateString("es-EC"),
    "<<Solicitante>>": asText(req.requester_name),
    "<<Fecha>>": formatDate(req.created_at),
    "<<Email>>": asText(payload.email_cliente || req.requester_email),
    "<<Cliente>>": asText(payload.nombre_cliente),
    "<<Direccion>>": asText(payload.direccion_cliente),
    "<<Contacto>>": asText(payload.persona_contacto),
    "<<Celular>>": asText(payload.celular_contacto),
    "<<F_Instalacion>>": fechaInstalacionRaw ? formatDate(fechaInstalacionRaw) : "",
    "<<Accesorios>>": asText(payload.accesorios),
    "<<Observaciones>>": asText(payload.observaciones || payload.anotaciones),
    "<<LIS>>": typeof payload.requiere_lis === "boolean" ? (payload.requiere_lis ? "Sí" : "No") : asText(payload.requiere_lis),
    ...equipmentTags,
  };

  await replaceTags(doc.id, replacements);

  const pdf = await exportPdf(doc.id, folderId, pdfBaseName);
  const docLink = `https://drive.google.com/file/d/${doc.id}/view`;
  const pdfLink = pdf?.webViewLink || (pdf ? `https://drive.google.com/file/d/${pdf.id}/view` : null);
  const attachmentTitle = `${docLabel} (${pdfBaseName}`;

  if (pdf) {
    await db.query(
      `INSERT INTO request_attachments (request_id, drive_file_id, drive_link, mime_type, uploaded_by, title) VALUES ($1,$2,$3,$4,$5,$6)`,
      [request_id, pdf.id, pdfLink, "application/pdf", uploaded_by, attachmentTitle]
    );
  } else {
    await db.query(
      `INSERT INTO request_attachments (request_id, drive_file_id, drive_link, mime_type, uploaded_by, title) VALUES ($1,$2,$3,$4,$5,$6)`,
      [request_id, doc.id, docLink, "application/vnd.google-apps.document", uploaded_by, attachmentTitle]
    );
  }

  if (pdf) await drive.files.delete({ fileId: doc.id, supportsAllDrives: true });

  await updateRequestStatus(request_id, "acta_generada");
  await logAction({ user_id: uploaded_by, module: "requests", action: "generate_acta", entity: "requests", entity_id: request_id });

  return { id: pdf?.id || doc.id, link: pdfLink || docLink, docId: doc.id, docLink, pdfId: pdf?.id || null, pdfLink: pdfLink || null, name: pdfBaseName, variant: variantKey };
}

async function getRequestFull(id) {
  const { rows } = await db.query(
    `SELECT r.*, u.email AS requester_email, rt.title AS type_title
     FROM requests r
     LEFT JOIN users u ON u.id=r.requester_id
     LEFT JOIN request_types rt ON rt.id=r.request_type_id
     WHERE r.id=$1`,
    [id]
  );
  const request = rows[0];
  if (!request) return null;
  request.type_title = getRequestLabel(request.type_code, request.type_title);
  const attachments = (await db.query("SELECT * FROM request_attachments WHERE request_id=$1", [id])).rows;
  const documents = attachments.filter((a) => a.mime_type === "application/vnd.google-apps.document");
  return { request, attachments, documents };
}

async function listRequests({ page = 1, pageSize = 50, status, q }) {
  const offset = (page - 1) * pageSize;
  const fromAndJoins = `
    FROM requests r
    LEFT JOIN users u ON u.id = r.requester_id
    LEFT JOIN request_types rt ON rt.id = r.request_type_id
  `;
  let whereClauses = "WHERE 1=1";
  const params = [];
  let paramIndex = 1;
  if (status) {
    whereClauses += ` AND r.status = $${paramIndex++}`;
    params.push(status);
  }
  if (q) {
    whereClauses += ` AND (LOWER(rt.title) LIKE $${paramIndex} OR LOWER(u.email) LIKE $${paramIndex} OR CAST(r.id AS TEXT) LIKE $${paramIndex})`;
    params.push(`%${q.toLowerCase()}%`);
    paramIndex++;
  }
  const countQuery = `SELECT COUNT(*) ${fromAndJoins} ${whereClauses}`;
  const totalResult = await db.query(countQuery, params);
  const total = parseInt(totalResult.rows[0].count, 10);
  const dataParams = [...params, pageSize, offset];
  const dataQuery = `
    SELECT r.*, u.email AS requester_email, rt.title AS type_title
    ${fromAndJoins}
    ${whereClauses}
    ORDER BY r.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  const { rows } = await db.query(dataQuery, dataParams);
  const mappedRows = rows.map((row) => ({
    ...row,
    type_title: getRequestLabel(row.type_code, row.type_title),
  }));
  return { count: total, rows: mappedRows };
}

async function updateRequestStatus(id, status, client = db) {
  const { rows } = await client.query(
    `UPDATE requests SET status=$1, updated_at=now() WHERE id=$2 RETURNING *`,
    [status, id]
  );
  return rows[0];
}

async function resolveRequesterProfile({ requester_id, requester_email, requester_name }) {
  let profile = { email: requester_email || null, fullname: requester_name || null };
  if (!profile.email || !profile.fullname) {
    const { rows } = await db.query("SELECT email, fullname FROM users WHERE id=$1 LIMIT 1", [requester_id]);
    if (rows[0]) {
      profile = { email: profile.email || rows[0].email, fullname: profile.fullname || rows[0].fullname };
    }
  }
  if (!profile.fullname) profile.fullname = profile.email || `Usuario #${requester_id}`;
  return profile;
}

async function notifyTechnicalApprovers({ request, requester, requestType, payload, document }) {
  const { rows } = await db.query(`SELECT email, fullname FROM users WHERE role = 'jefe_servicio_tecnico' AND email IS NOT NULL`);
  const recipients = rows.map((row) => row.email).filter(Boolean);
  if (!recipients.length) {
    logger.info("ℹ️ No se enviaron notificaciones porque no existen usuarios con rol jefe_servicio_tecnico.");
    return;
  }

  const requesterName = requester?.fullname || requester?.name || requester?.email || "Usuario SPI";
  const requesterEmail = requester?.email || null;
  const requestTitle = getRequestLabel(requestType?.code, requestType?.title);
  const dashboardLink = `${FRONTEND_URL}/dashboard/servicio-tecnico`;
  const detailLink = `${dashboardLink}?request=${request.id}`;
  const summaryItems = [];
  if (payload?.nombre_cliente) summaryItems.push(`<li><b>Cliente:</b> ${asText(payload.nombre_cliente)}</li>`);
  if (payload?.persona_contacto) summaryItems.push(`<li><b>Contacto:</b> ${asText(payload.persona_contacto)}</li>`);
  if (payload?.celular_contacto) summaryItems.push(`<li><b>Teléfono:</b> ${asText(payload.celular_contacto)}</li>`);
  if (payload?.direccion_cliente) summaryItems.push(`<li><b>Dirección:</b> ${asText(payload.direccion_cliente)}</li>`);
  const notes = payload?.anotaciones || payload?.observaciones;
  if (notes) summaryItems.push(`<li><b>Notas:</b> ${asText(notes)}</li>`);
  const summaryBlock = summaryItems.length ? `<ul>${summaryItems.join("")}</ul>` : "<p>No se registraron detalles adicionales.</p>";
  const documentSection = document?.link ? `<p>Documento generado: <a href="${document.link}" target="_blank" rel="noopener">${document.name || "Abrir documento"}</a></p>` : "";

  const html = `<h2>Solicitud pendiente de aprobación</h2><p>Hola equipo de Servicio Técnico,</p><p><b>${requesterName}</b>${requesterEmail ? ` (${requesterEmail})` : ""} registró la solicitud <b>#${request.id}</b> (${requestTitle}).</p>${summaryBlock}${documentSection}<p>Revisa la solicitud en SPI: <a href="${detailLink}" target="_blank" rel="noopener">${detailLink}</a></p><p style="margin-top:16px;">Este aviso se envió automáticamente cuando la solicitud quedó pendiente.</p>`;
  await sendMail({ to: recipients, subject: `Solicitud #${request.id} pendiente de aprobación`, html, from: requesterEmail ? { email: requesterEmail, name: requesterName } : undefined, replyTo: requesterEmail || undefined, senderName: requesterName, delegatedUser: requesterEmail });
}

/*
 * ============================================================ 
 * === Flujo de Creación de Nuevos Clientes
 * ============================================================ 
 */

async function createClientRequest(user, rawData = {}, rawFiles = {}) {
  const data = Object.fromEntries(
    Object.entries(rawData || {}).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ]),
  );

  const validate = ajv.getSchema('newClient');
  if (!validate(data)) {
    const error = new Error("Datos de solicitud inválidos.");
    error.validationErrors = validate.errors;
    error.status = 400;
    throw error;
  }

  const consentCaptureMethod = (data.consent_capture_method || "email_link").toLowerCase();
  const consentCaptureDetails = data.consent_capture_details?.trim() || null;

  const normalizedFiles = rawFiles && typeof rawFiles === "object" ? rawFiles : {};
  const hasFile = (field) => Array.isArray(normalizedFiles[field]) && normalizedFiles[field].length > 0;
  const requiredFileFields = ["id_file", "ruc_file"];
  if ((data.client_type || "").toLowerCase() === "persona_juridica") {
    requiredFileFields.push("legal_rep_appointment_file");
  }
  if (data.operating_permit_status === "has_it") {
    requiredFileFields.push("operating_permit_file");
  }
  if (consentCaptureMethod === "signed_document") {
    requiredFileFields.push("consent_evidence_file");
  }
  const missingFiles = requiredFileFields.filter((field) => !hasFile(field));
  if (missingFiles.length) {
    const readable = missingFiles
      .map((field) => CLIENT_FILE_LABELS[field] || field)
      .join(", ");
    const error = new Error(`Faltan archivos obligatorios: ${readable}`);
    error.status = 400;
    error.details = { missingFiles };
    throw error;
  }

  const { commercial_name, client_email } = data;
  const consentRecipientEmail = data.consent_recipient_email || client_email;
  const consentEmailTokenId = data.consent_email_token_id?.trim() || null;
  let verifiedConsentToken = null;
  if (consentCaptureMethod === "email_link") {
    if (!consentEmailTokenId) {
      throw buildHttpError("Debes validar el código enviado al cliente antes de crear la solicitud.");
    }
    verifiedConsentToken = await assertVerifiedConsentEmailToken({
      tokenId: consentEmailTokenId,
      email: consentRecipientEmail,
    });
  }
  const storedConsentCaptureDetails =
    consentCaptureMethod === "email_link" && verifiedConsentToken
      ? "Consentimiento confirmado mediante código OTP"
      : consentCaptureDetails;
  const driveFolderId = await createClientFolder(commercial_name);

  const fileIds = {};
  const fileUploadPromises = Object.entries(normalizedFiles).map(async ([fieldName, fileArray]) => {
    if (!Array.isArray(fileArray) || !fileArray.length) return;
    const file = fileArray[0];
    if (!file) return;
    const uploadedFile = await uploadBase64File(
      file.originalname,
      file.buffer.toString("base64"),
      file.mimetype,
      driveFolderId,
    );
    const dbFieldName = `${fieldName}_id`;
    fileIds[dbFieldName] = uploadedFile.id;
  });
  await Promise.all(fileUploadPromises);

  const lopdp_token = crypto.randomBytes(32).toString("hex");
  const dbClient = await db.getClient();
  try {
    await dbClient.query("BEGIN");
    const hasVerifiedToken = Boolean(verifiedConsentToken);
    const shouldAutoApproveConsent =
      consentCaptureMethod !== "email_link" ? true : hasVerifiedToken;
    const consentStatus = shouldAutoApproveConsent ? "granted" : "pending";
    const requestStatus = shouldAutoApproveConsent ? "pending_approval" : "pending_consent";
    const lopdpConsentAt = shouldAutoApproveConsent
      ? verifiedConsentToken?.verified_at
        ? new Date(verifiedConsentToken.verified_at)
        : new Date()
      : null;
    const lopdpConsentMethod = shouldAutoApproveConsent ? consentCaptureMethod : null;
    const lopdpConsentDetails = shouldAutoApproveConsent
      ? verifiedConsentToken
        ? `Consentimiento confirmado con ${maskConsentCode(
            verifiedConsentToken.code_last_four,
          )} enviado a ${consentRecipientEmail || client_email}`
        : consentCaptureDetails || "Consentimiento registrado manualmente"
      : null;

    const columns = [
      "created_by", "status", "lopdp_token", "client_email", "consent_recipient_email", "client_type", "data_processing_consent",
      "lopdp_consent_status", "consent_capture_method", "consent_capture_details",
      "legal_person_business_name", "nationality", "natural_person_firstname",
      "natural_person_lastname", "commercial_name", "establishment_name", "ruc_cedula",
      "establishment_province", "establishment_city", "establishment_address",
      "establishment_reference", "establishment_phone", "establishment_cellphone",
      "legal_rep_name", "legal_rep_position", "legal_rep_id_document", "legal_rep_cellphone",
      "legal_rep_email", "shipping_contact_name", "shipping_address", "shipping_city",
      "shipping_province", "shipping_reference", "shipping_phone", "shipping_cellphone",
      "shipping_delivery_hours", "operating_permit_status", "drive_folder_id",
      "legal_rep_appointment_file_id", "ruc_file_id", "id_file_id", "operating_permit_file_id",
      "consent_evidence_file_id", "lopdp_consent_method", "lopdp_consent_details", "lopdp_consent_at",
      "lopdp_consent_ip", "lopdp_consent_user_agent", "consent_email_token_id"
    ];
    const values = columns.map((col, i) => `$${i + 1}`);
    const query = `INSERT INTO client_requests (${columns.join(", ")}) VALUES (${values.join(", ")}) RETURNING *`;
    const dbValues = [
      user.email, requestStatus, lopdp_token, client_email, consentRecipientEmail || client_email, data.client_type, data.data_processing_consent === true,
      consentStatus, consentCaptureMethod, storedConsentCaptureDetails,
      data.legal_person_business_name || null, data.nationality || null, data.natural_person_firstname || null,
      data.natural_person_lastname || null, commercial_name, data.establishment_name || null, data.ruc_cedula,
      data.establishment_province, data.establishment_city, data.establishment_address,
      data.establishment_reference || null, data.establishment_phone || null, data.establishment_cellphone || null,
      data.legal_rep_name || null, data.legal_rep_position || null, data.legal_rep_id_document || null, data.legal_rep_cellphone || null,
      data.legal_rep_email || null, data.shipping_contact_name, data.shipping_address, data.shipping_city,
      data.shipping_province, data.shipping_reference || null, data.shipping_phone || null, data.shipping_cellphone || null,
      data.shipping_delivery_hours || null, data.operating_permit_status || null, driveFolderId,
      fileIds.legal_rep_appointment_file_id || null, fileIds.ruc_file_id || null, fileIds.id_file_id || null, fileIds.operating_permit_file_id || null,
      fileIds.consent_evidence_file_id || null, lopdpConsentMethod, lopdpConsentDetails,
      lopdpConsentAt, null, null, consentEmailTokenId || null
    ];
    const { rows } = await dbClient.query(query, dbValues);
    const newRequest = rows[0];
    await dbClient.query("COMMIT");

    if (consentCaptureMethod === "email_link" && hasVerifiedToken) {
      await markConsentEmailTokenAsUsed(consentEmailTokenId, newRequest.id);
      await recordConsentEvent({
        client_request_id: newRequest.id,
        event_type: "granted",
        method: "email_link",
        details: `Consentimiento confirmado con ${maskConsentCode(
          verifiedConsentToken?.code_last_four,
        )} enviado a ${consentRecipientEmail || client_email}`,
        actor_email: user.email,
        actor_role: user.role,
        actor_name: user.fullname || user.name || null,
      });
    } else if (consentCaptureMethod === "email_link") {
      const consentLink = `${FRONTEND_URL}/auth/consent/${lopdp_token}`;
      await sendMail({
        to: consentRecipientEmail || client_email,
        subject: "Autorización para el Tratamiento de Datos Personales",
        html: `<h2>Confirmación de Uso de Datos</h2><p>Hola,</p><p>Se ha iniciado un proceso de registro como cliente en nuestro sistema. Para continuar, necesitamos tu autorización para el tratamiento de tus datos personales según la normativa vigente.</p><p>Por favor, haz clic en el siguiente enlace para confirmar tu autorización:</p><p><a href="${consentLink}" target="_blank">Autorizar y continuar</a></p><p>Si no has solicitado este registro, puedes ignorar este correo.</p>` ,
      });

      await recordConsentEvent({
        client_request_id: newRequest.id,
        event_type: "request_sent",
        method: "email_link",
        details: `Correo enviado a ${consentRecipientEmail || client_email}`,
        actor_email: user.email,
        actor_role: user.role,
        actor_name: user.fullname || user.name || null,
      });
    } else {
      await recordConsentEvent({
        client_request_id: newRequest.id,
        event_type: "granted",
        method: consentCaptureMethod,
        details: consentCaptureDetails || "Consentimiento registrado manualmente",
        actor_email: user.email,
        actor_role: user.role,
        actor_name: user.fullname || user.name || null,
        evidence_file_id: fileIds.consent_evidence_file_id || null,
      });
    }

    await sendChatMessage({
      text: `*Nueva Solicitud de Cliente para Revisión*\n> *Cliente:* ${commercial_name}\n> *Tipo:* ${data.client_type}\n> *Solicitante:* ${user.email}\n> *Acción Requerida:* Revisar y aprobar/rechazar en el dashboard de Backoffice.`,
    });
    return newRequest;
  } catch (error) {
    await dbClient.query("ROLLBACK");
    logger.error("Error creando la solicitud de cliente:", error);
    throw error;
  } finally {
    dbClient.release();
  }
}

async function listClientRequests({ page = 1, pageSize = 25, status, q }) {
  const offset = (page - 1) * pageSize;
  const params = [];
  let whereClause = "WHERE 1=1";
  if (status) {
    params.push(status);
    whereClause += ` AND status = $${params.length}`;
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    const qIndex = params.length;
    whereClause += ` AND (LOWER(commercial_name) LIKE $${qIndex} OR LOWER(ruc_cedula) LIKE $${qIndex} OR CAST(id AS TEXT) LIKE $${qIndex})`;
  }
  const countQuery = `SELECT COUNT(*) FROM client_requests ${whereClause}`;
  const totalResult = await db.query(countQuery, params);
  const total = parseInt(totalResult.rows[0].count, 10);
  const dataQuery = `SELECT id, commercial_name, ruc_cedula, created_by, status, created_at FROM client_requests ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const { rows } = await db.query(dataQuery, [...params, pageSize, offset]);
  return { count: total, rows, page, pageSize };
}

async function getClientRequestById(id, user) {
  if (!id || !user) throw new Error("ID de solicitud y usuario son obligatorios.");
  const { rows } = await db.query(
    `SELECT cr.*, COALESCE(
        (
          SELECT json_agg(row_to_json(history))
          FROM (
            SELECT id, event_type, method, details, evidence_file_id, actor_email, actor_role,
                   actor_name, ip, user_agent, created_at
            FROM client_request_consents
            WHERE client_request_id = cr.id
            ORDER BY created_at
          ) history
        ), '[]'::json
      ) AS consent_history
     FROM client_requests cr
     WHERE cr.id = $1`,
    [id]
  );
  const request = rows[0];
  if (!request) {
    const error = new Error("Solicitud no encontrada.");
    error.status = 404;
    throw error;
  }
  const allowedRoles = ["backoffice_comercial", "gerencia"];
  const isAllowed = allowedRoles.includes(user.role) || request.created_by === user.email;
  if (!isAllowed) {
    const error = new Error("Acceso denegado a esta solicitud.");
    error.status = 403;
    throw error;
  }
  return request;
}

async function processClientRequest({ id, user, action, rejection_reason }) {
  const { rows } = await db.query("SELECT * FROM client_requests WHERE id = $1", [id]);
  const request = rows[0];
  if (!request) {
    const error = new Error("Solicitud no encontrada.");
    error.status = 404;
    throw error;
  }
  if (request.status !== 'pending_approval' && request.status !== 'pending_consent') {
    const error = new Error(`La solicitud ya ha sido procesada (estado: ${request.status}).`);
    error.status = 400;
    throw error;
  }
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  if (newStatus === 'approved' && request.lopdp_consent_status !== 'granted') {
    const error = new Error("No se puede aprobar una solicitud sin el consentimiento LOPDP del cliente.");
    error.status = 400;
    throw error;
  }
  const { rows: updatedRows } = await db.query(
    "UPDATE client_requests SET status = $1, rejection_reason = $2, updated_at = now() WHERE id = $3 RETURNING *",
    [newStatus, newStatus === 'rejected' ? rejection_reason : null, id]
  );
  const updatedRequest = updatedRows[0];
  if (newStatus === 'approved') {
    await moveClientFolderToApproved(request.drive_folder_id);
  }
  const outcome = newStatus === 'approved' ? 'Aprobada' : 'Rechazada';
  await sendChatMessage({
    text: `*Actualización de Solicitud de Cliente*\n> *Cliente:* ${request.commercial_name} (#${request.id})\n> *Estado:* ${outcome}\n> *Procesado por:* ${user.email}\n${newStatus === 'rejected' && rejection_reason ? `> *Motivo:* ${rejection_reason}` : ''}`,
  });
  return updatedRequest;
}

async function grantConsent({ token, audit = {} }) {
  if (!token) {
    const error = new Error("Token de consentimiento no proporcionado.");
    error.status = 400;
    throw error;
  }
  const { rows } = await db.query("SELECT * FROM client_requests WHERE lopdp_token = $1", [token]);
  const request = rows[0];
  if (!request) {
    const error = new Error("Token inválido o la solicitud no existe.");
    error.status = 404;
    throw error;
  }
  if (request.lopdp_consent_status === 'granted') {
    logger.warn(`Intento de re-confirmar consentimiento para la solicitud #${request.id}`);
    return request;
  }
  const clientIp = audit.ip || null;
  const userAgent = audit.userAgent || null;
  const { rows: updatedRows } = await db.query(
    `UPDATE client_requests
      SET lopdp_consent_status = 'granted',
          status = 'pending_approval',
          lopdp_consent_method = COALESCE(lopdp_consent_method, 'email_link'),
          lopdp_consent_details = 'Consentimiento confirmado desde enlace público',
          lopdp_consent_at = now(),
          lopdp_consent_ip = $2,
          lopdp_consent_user_agent = $3,
          updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [request.id, clientIp, userAgent]
  );
  const updatedRequest = updatedRows[0];
  await recordConsentEvent({
    client_request_id: updatedRequest.id,
    event_type: "granted",
    method: "email_link",
    details: "Consentimiento confirmado por el cliente mediante enlace público.",
    ip: clientIp,
    user_agent: userAgent,
  });
  await sendChatMessage({
    text: `*Consentimiento Recibido - Listo para Aprobación*\n> *Cliente:* ${request.commercial_name} (#${request.id})\n> *Acción Requerida:* La solicitud ha recibido el consentimiento del cliente y está lista para su revisión final.`,
  });
  return updatedRequest;
}

module.exports = {
  listRequests,
  getRequestType,
  createRequest,
  saveAttachment,
  getRequestFull,
  generateActa,
  updateRequestStatus,
  createClientRequest,
  listClientRequests,
  getClientRequestById,
  processClientRequest,
  grantConsent,
  sendConsentEmailToken,
  verifyConsentEmailToken,
};