/**
 * Service: Requests
 * -----------------
 * Maneja creación, consulta y actualización de solicitudes (requests)
 * con integración Drive + Docs + Auditoría y validación dinámica AJV.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { v4: uuidv4 } = require("uuid");
const { drive, docs } = require("../../config/google");
const QRCode = require("qrcode");
const { Readable } = require("stream");
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
const notificationManager = require("../notifications/notificationManager");
const gmailService = require("../../services/gmail.service");
const { createClientFolder, moveClientFolderToApproved } = require("../../utils/driveClientManager");
const crypto = require("crypto");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const { captureSerial, cambiarEstadoUnidad, assignUnidad, normalizeDetalleValue } = require("../inventario/inventario.service");
const requestSchemas = require("./requestSchemas");

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3001").replace(
  /\$\/$/, ""
);
const CONSENT_EMAIL_TOKEN_TTL_MINUTES = parseInt(
  process.env.CONSENT_EMAIL_TOKEN_TTL_MINUTES || "30",
  10
);
const CONSENT_EMAIL_TOKEN_TTL_MS = Math.max(5, CONSENT_EMAIL_TOKEN_TTL_MINUTES || 15) * 60 * 1000;
const REQUEST_TYPE_LABELS = {
  "F.ST-20": "Solicitud de inspección de ambiente",
  "F.ST-21": "Solicitud de retiro de equipo",
  "F.ST-22": "Registro de nuevo cliente",
};

const CLIENT_APPROVAL_TEMPLATE_ID = process.env.DOC_TEMPLATE_CLIENT_APPROVAL;
const DEFAULT_SOLICITUD_TEMPLATE = process.env.DOC_TEMPLATE_SOLICITUD || null;

const DEFAULT_REQUEST_TYPES = [
  { code: "F.ST-19", title: "Proceso de compra" },
  { code: "F.ST-20", title: "Solicitud de inspección de ambiente" },
  { code: "F.ST-21", title: "Solicitud de retiro de equipo" },
  { code: "F.ST-22", title: "Registro de nuevo cliente" },
];

const SOLICITUD_TEMPLATE_MAP = {
  "F.ST-19": process.env.DOC_TEMPLATE_SOLICITUD_1 || null,
  "F.ST-20": process.env.DOC_TEMPLATE_SOLICITUD_2 || null,
  "F.ST-21": process.env.DOC_TEMPLATE_SOLICITUD_3 || null,
};

function getSolicitudTemplateId(typeCode) {
  const normalized = String(typeCode || "").toUpperCase();
  return SOLICITUD_TEMPLATE_MAP[normalized] || DEFAULT_SOLICITUD_TEMPLATE;
}

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
  approval_letter: "Oficio de aprobación",
};

const parseRecipients = (value = "") =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const REQUEST_NOTIFICATION_EMAILS = parseRecipients(
  process.env.REQUEST_NOTIFICATION_EMAILS || process.env.BACKOFFICE_NOTIFICATION_EMAILS || process.env.SMTP_FROM || "",
);

const uniqueRecipients = (...emails) => {
  const recipients = emails.flat().filter(Boolean);
  return [...new Set(recipients.map((e) => e.trim().toLowerCase()))];
};

function buildDriveLink(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function getClientRequestAttachments(request = {}) {
  const attachments = [
    { key: "id_file", field: "id_file_id", label: CLIENT_FILE_LABELS.id_file },
    { key: "ruc_file", field: "ruc_file_id", label: CLIENT_FILE_LABELS.ruc_file },
    {
      key: "legal_rep_appointment_file",
      field: "legal_rep_appointment_file_id",
      label: CLIENT_FILE_LABELS.legal_rep_appointment_file,
    },
    { key: "operating_permit_file", field: "operating_permit_file_id", label: CLIENT_FILE_LABELS.operating_permit_file },
    { key: "consent_evidence_file", field: "consent_evidence_file_id", label: CLIENT_FILE_LABELS.consent_evidence_file },
    { key: "approval_letter", field: "approval_letter_file_id", label: CLIENT_FILE_LABELS.approval_letter },
    { key: "consent_record", field: "consent_record_file_id", label: "Registro de consentimiento" },
  ];

  return attachments
    .map((attachment) => {
      const fileId = request[attachment.field];
      if (!fileId) return null;
      return {
        ...attachment,
        file_id: fileId,
        link: buildDriveLink(fileId),
      };
    })
    .filter(Boolean);
}

function buildConsentDeclarationText({ request, token }) {
  const clientName = request.commercial_name || request.legal_person_business_name || "Cliente";
  const cedula = request.ruc_cedula || "N/A";
  const purpose = request.client_type === "persona_juridica" ? "registro administrativo y cumplimiento contractual" : "gestión administrativa del cliente";
  const today = new Date();
  const formattedDate = formatDate(today);
  const formattedTime = today.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
  const tokenId = token?.id || token?.token_id || "N/A";
  const codeMasked = token?.code_last_four ? `****${token.code_last_four}` : "****";
  const sealCode =
    tokenId && request?.id
      ? crypto
          .createHash("sha256")
          .update(`${tokenId}:${request.id}:${formattedDate}`)
          .digest("hex")
          .slice(0, 16)
          .toUpperCase()
      : "N/A";

  return `
DECLARACIÓN DE CONSENTIMIENTO INFORMADO PARA TRATAMIENTO DE DATOS PERSONALES

Yo, ${clientName}, portador(a) de la cédula ${cedula}, declaro que he sido informado(a) de forma clara, precisa, suficiente y accesible, conforme a los artículos 11 y 12 de la LOPDP, sobre los siguientes aspectos relacionados con el tratamiento de mis datos personales por parte de FAMPROJECT CIA. LTDA.:

Finalidades del tratamiento:
Mis datos personales serán tratados exclusivamente para los fines relacionados con ${purpose}, gestión administrativa, cumplimiento de obligaciones contractuales y/o prestación de servicios solicitados.

Responsable del tratamiento:
FAMPROJECT CIA. LTDA., RUC 0591760730001.
Delegado de Protección de Datos: Ing. Rafael Ortiz
Correo oficial para ejercer derechos: soporte-ti@fam-project.com

Datos que serán tratados:
Los datos proporcionados voluntariamente y necesarios para los fines mencionados, tales como identificación, contacto, información contractual o técnica estrictamente vinculada al trámite o servicio requerido.

Derechos del titular (ARCO-P):
Conforme a los arts. 18 al 25 de la LOPDP, conozco que puedo ejercer mis derechos de acceso, rectificación, actualización, eliminación, oposición, portabilidad y suspensión, dirigiendo una solicitud al correo arriba indicado.

Tiempo de conservación:
Mis datos serán conservados únicamente por el tiempo necesario para cumplir la finalidad declarada y obligaciones legales aplicables.

Seguridad y confidencialidad:
Soy informado(a) de que FAMPROJECT implementa medidas de seguridad técnicas, organizativas y administrativas conforme a los arts. 31 y 32, garantizando la protección y confidencialidad de mis datos.

Carácter libre del consentimiento:
Declaro que otorgo este consentimiento de forma libre, voluntaria, específica, inequívoca e informada, sin presión ni condicionamiento alguno, y que puedo revocarlo en cualquier momento, sin efectos retroactivos, conforme lo establece la ley.

Firma digital:
Este documento se firma digitalmente mediante el token de validación ${tokenId} (código verificado ${codeMasked}) y se encuentra registrado con fecha ${formattedDate} a las ${formattedTime}.

Finalmente, AUTORIZO el tratamiento de mis datos personales bajo las condiciones detalladas en este documento, en cumplimiento de la Ley Orgánica de Protección de Datos Personales del Ecuador.

Firma del titular: ________________________
Nombre: ${clientName}
Cédula: ${cedula}
Fecha: ${formattedDate}
Sello oficial de validación: ${sealCode}
Rubrica digital (token auditado): ${tokenId || "N/A"}
`;
}

function buildConsentQrPayload({ request, token }) {
  if (!token?.id) return null;
  const clientName = request.commercial_name || request.legal_person_business_name || "cliente";
  const info = {
    token: token.id,
    request: request.id,
    client: clientName,
  };
  return JSON.stringify(info);
}

async function shareDriveFilePublic(fileId) {
  if (!fileId) return;
  try {
    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
  } catch (error) {
    if (error.code && error.code === 409) {
      return;
    }
    logger.warn({ err: error, fileId }, "No se pudo compartir el QR públicamente");
  }
}

function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

async function generateConsentDeclarationDocument({ request, token }) {
  if (!request?.drive_folder_id || !docs) return null;
  const docName = `Registro consentimiento - ${request.commercial_name || "Cliente"} - ${padId(request.id)}`;
  let created;
  try {
    ({ data: created } = await drive.files.create({
      requestBody: {
        name: docName,
        mimeType: "application/vnd.google-apps.document",
        parents: [request.drive_folder_id],
      },
      supportsAllDrives: true,
      supportsTeamDrives: true,
      fields: "id, webViewLink",
    }));
    logger.info(
      { requestId: request.id, folderId: request.drive_folder_id, documentId: created.id },
      "Documento de consentimiento generado"
    );
  } catch (error) {
    logger.warn(
      { err: error, requestId: request.id, folderId: request.drive_folder_id },
      "No se pudo crear el documento de consentimiento (carpeta no encontrada o acceso denegado)"
    );
    return null;
  }

  const text = buildConsentDeclarationText({ request, token });
  await docs.documents.batchUpdate({
    documentId: created.id,
    requestBody: {
      requests: [
        {
          insertText: {
            text,
            location: { index: 1 },
          },
        },
      ],
    },
  }).catch((error) => {
    logger.error(
      { err: error, requestId: request.id, documentId: created.id },
      "No se pudo insertar el texto del consentimiento",
    );
  });

  const qrPayload = buildConsentQrPayload({ request, token });
  if (qrPayload) {
    try {
      const qrBuffer = await QRCode.toBuffer(qrPayload, { type: "png", width: 150 });
      const qrFileName = `QR - ${request.commercial_name || request.legal_person_business_name || "Cliente"} - ${padId(
        request.id,
      )}`;
      const qrFile = await uploadBase64File(
        qrFileName,
        qrBuffer.toString("base64"),
        "image/png",
        request.drive_folder_id,
      );
      await shareDriveFilePublic(qrFile.id);
      const qrUri =
        qrFile?.webContentLink ||
        qrFile?.webViewLink ||
        (qrFile?.id ? buildDriveLink(qrFile.id) : null);
      if (qrUri) {
        await docs.documents
          .batchUpdate({
            documentId: created.id,
            requestBody: {
              requests: [
                {
                  insertInlineImage: {
                    uri: qrUri,
                    location: { index: text.length + 1 },
                    objectSize: {
                      height: { magnitude: 100, unit: "PT" },
                      width: { magnitude: 100, unit: "PT" },
                    },
                  },
                },
              ],
            },
          })
          .catch((error) => {
            logger.error(
              { err: error, requestId: request.id, documentId: created.id },
              "No se pudo insertar el QR de consentimiento",
            );
          });
        logger.info(
          { requestId: request.id, qrFileId: qrFile.id, qrUri },
          "QR de consentimiento generado y almacenado",
        );
      }
    } catch (error) {
      logger.warn({ err: error, requestId: request.id }, "No se pudo generar el QR de consentimiento");
    }
  }

  const pdf = await exportPdf(created.id, request.drive_folder_id, `${docName}.pdf`);
  logger.info(
    { requestId: request.id, pdfFileId: pdf?.id, folderId: request.drive_folder_id },
    "Registro de consentimiento exportado a PDF",
  );
  await drive.files.delete({ fileId: created.id, supportsAllDrives: true });

  await logAction({
    user_id: null,
    module: "client_requests",
    action: "generate_consent_record",
    entity: "client_requests",
    entity_id: request.id,
    details: { file_id: pdf?.id || null },
  });

  return pdf;
}

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

  try {
    // Intentar enviar con Gmail API (usuario autenticado)
    await gmailService.sendEmail({
      userId: user.id,
      to: normalizedEmail,
      subject: "Codigo de autorizacion para tratamiento de datos",
      html,
      replyTo: user?.email
    });
  } catch (error) {
    logger.warn(`⚠️ Falló envío con Gmail API, intentando fallback SMTP: ${error.message}`);
    // Fallback a SMTP si falla la API
    await notificationManager.sendNotification({
      template: 'custom_html',
      data: {
        title: "Codigo de autorizacion para tratamiento de datos",
        message: html
      },
      to: normalizedEmail,
      sender: {
        name: user?.fullname || user?.name || user?.email || "SPI",
        replyTo: user?.email || undefined,
        gmailUserId: user?.id || null,
      },
      skipSave: true
    });
  }

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
  VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

async function ensureRequestTypes() {
  const upserts = DEFAULT_REQUEST_TYPES.map(({ code, title }) =>
    db.query(
      `INSERT INTO request_types (code, title)
       VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET title = excluded.title`,
      [code, title],
    ),
  );

  await Promise.all(upserts);
}

// ================================================= ================
// 🔎 Resolver request_type_id cuando viene como texto
// ================================================= ================
async function resolveRequestTypeId(input) {
  await ensureRequestTypes();
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
    `No se encontró tipo de solicitud correspondiente a '${input}'.Verifique la tabla request_types.`
  );
}

function resolveSchemaKey(code) {
  const normalized = String(code || "").toUpperCase();
  if (normalized === "F.ST-20") return "inspection";
  if (normalized === "F.ST-21") return "retiro";
  if (normalized === "F.ST-19") return "compra";
  return "cliente";
}

function normalizePayload(schemaKey, payload) {
  const schema = requestSchemas[schemaKey] || { properties: {} };
  const normalizedPayload = { ...(payload || {}) };
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
  return { normalizedPayload, schema };
}

function getEquipmentEventLabel(typeCode) {
  if (typeCode === "F.ST-21") return "retiro_programado";
  if (typeCode === "F.ST-20") return "inspeccion_solicitada";
  return "solicitud_registrada";
}

function getEquipmentDefaultState(typeCode) {
  if (typeCode === "F.ST-20") return "en_evaluacion";
  if (typeCode === "F.ST-21") return "proceso_retiro";
  return null;
}

function buildEquipmentEntries(payload = {}) {
  const sourceEntries = Array.isArray(payload.equipos) ? payload.equipos : [];
  const normalized = sourceEntries
    .map((item) => ({
      unidad_id: item?.unidad_id || item?.equipo_id || null,
      serial: item?.serial ? String(item.serial).trim() : null,
      estado: item?.estado || item?.estado_equipo || null,
      cantidad: Number.isFinite(Number(item?.cantidad)) ? Number(item.cantidad) : item?.cantidad ?? null,
      serial_pendiente: item?.serial_pendiente ?? false,
    }))
    .filter((entry) => entry.unidad_id || entry.serial);

  if (normalized.length) return normalized;

  const fallback = {
    unidad_id: payload.unidad_id || payload.equipo_id || null,
    serial: payload.serial ? String(payload.serial).trim() : null,
    estado: payload.estado_equipo || payload.estado || null,
    cantidad: Number.isFinite(Number(payload.cantidad)) ? Number(payload.cantidad) : payload.cantidad ?? null,
    serial_pendiente: payload.serial_pendiente ?? false,
  };

  if (fallback.unidad_id || fallback.serial) {
    return [fallback];
  }

  return [];
}

function resolveClientIdFromPayload(payload = {}) {
  const candidate =
    payload.cliente_id ??
    payload.client_id ??
    payload.client_request_id ??
    payload.clientRequestId ??
    payload.client_request_uuid;
  if (candidate === undefined || candidate === null || candidate === "") return null;
  const normalized = Number(candidate);
  return Number.isFinite(normalized) ? Math.trunc(normalized) : null;
}

function buildEquipmentDetail(entry, baseEvent) {
  const parts = [];
  if (entry.estado) parts.push(`estado: ${entry.estado}`);
  if (entry.cantidad || entry.cantidad === 0) parts.push(`cantidad: ${entry.cantidad}`);
  if (entry.serial) parts.push(`serie: ${entry.serial}`);
  return parts.length ? `${baseEvent} (${parts.join("; ")})` : baseEvent;
}

async function logEquipmentHistory({ unidad_id, request_id, evento, detalle = null, cliente_id = null, sucursal_id = null, user_id = null }) {
  if (!unidad_id) return null;
  const normalizedDetalle = normalizeDetalleValue(detalle);
  await db.query(
    `INSERT INTO public.equipos_historial (unidad_id, evento, detalle, request_id, cliente_id, sucursal_id, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
    [unidad_id, evento, normalizedDetalle, request_id, cliente_id, sucursal_id, user_id],
  );
  return true;
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
  const schemaKey = resolveSchemaKey(code);

  const { normalizedPayload, schema } = normalizePayload(schemaKey, payload);
  const validate = ajv.compile(schema);
  const valid = validate(payload || {});

  if (!valid) {
    const errors = validate.errors
      .map((e) => `${e.instancePath || e.keyword} ${e.message} `)
      .join(", ");
    const validationDetails = {
      request_type_id,
      schemaKey,
      payload: normalizedPayload,
      originalPayload: payload,
      errors: validate.errors,
    };
    logger.warn(validationDetails, "⚠️ Validación AJV fallida al crear solicitud");
    const err = new Error(`Datos de solicitud inválidos(${schemaKey}): ${errors} `);
    err.validationErrors = validate.errors;
    err.schemaKey = schemaKey;
    err.normalizedPayload = normalizedPayload;
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

  logger.info(
    {
      requester_id,
      requester_email,
      request_type: code,
      cliente: normalizedPayload?.nombre_cliente,
    },
    "📄 Creando solicitud comercial"
  );
  const insert = await db.query(
    `INSERT INTO requests(request_group_id, requester_id, request_type_id, payload, status, version_number)`
    + `VALUES($1, $2, $3, $4, 'pendiente', $5) RETURNING * `,
    [request_group_id, requester_id, typeId, JSON.stringify(normalizedPayload), version]
  );
  const request = insert.rows[0];

  await db.query(
    `INSERT INTO request_versions(request_id, version_number, payload)`
    + `VALUES($1, $2, $3)`,
    [request.id, version, JSON.stringify(normalizedPayload)]
  );

  setImmediate(() => {
    syncEquipmentOnCreate({
      requestId: request.id,
      typeCode: code,
      payload: normalizedPayload,
    }).catch((err) => logger.warn({ err }, "No se pudo registrar equipo desde creación de solicitud"));
  });

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

  const shouldGenerateActa = isJefeComercial || ["F.ST-20", "F.ST-21"].includes(code);

  let doc = null;
  if (shouldGenerateActa) {
    try {
      doc = await generateActa(request.id, requester_id, schemaKey);
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

function inferDepartmentFallback(typeCode) {
  if ((typeCode || "").toUpperCase().startsWith("F.ST")) return "Servicio Técnico";
  return null;
}

async function resolveRequestFolder(request_id, templateCode) {
  const ctx = await getRequestContext(request_id);
  if (!ctx) throw new Error(`No se encontró contexto para solicitud ${request_id} `);
  const payloadVariant = ctx.payload?.__form_variant;
  const templateHint = templateCode || payloadVariant || ctx.type_code;
  const inferredDepartment = inferDepartmentFallback(ctx.type_code);
  const departmentName = ctx.department_name || inferredDepartment || ctx.department_code;
  const departmentCode = ctx.department_code || inferredDepartment || ctx.department_name;

  try {
    const clientName = ctx.payload?.nombre_cliente || null;
    const folders = await resolveRequestDriveFolders({
      requestId: request_id,
      requestTypeCode: ctx.type_code,
      requestTypeTitle: ctx.type_title,
      departmentCode,
      departmentName,
      templateCode: templateHint,
      clientName, // ← Pasar nombre de cliente para carpetas identificables
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
    const fallbackFolder = await ensureFolder(`REQ - ${padId(request_id)} `, fallbackParent);
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
  for (const f of files || []) {
    const rawBuffer = f?.buffer;
    const existingBase64 = typeof f?.base64 === "string" ? f.base64 : null;
    let contentBuffer = null;

    if (rawBuffer && Buffer.isBuffer(rawBuffer)) {
      contentBuffer = rawBuffer;
    } else if (typeof rawBuffer === "object" && rawBuffer?.bytes && ArrayBuffer.isView(rawBuffer?.buffer)) {
      contentBuffer = Buffer.from(rawBuffer.buffer);
    }

    if (!contentBuffer && existingBase64) {
      contentBuffer = Buffer.from(existingBase64.split(",").pop()?.trim() || "", "base64");
    }

    if (!contentBuffer || !contentBuffer.length) {
      logger.warn(
        {
          file: f?.name || f?.originalname,
          hasBuffer: !!rawBuffer,
          hasBase64: !!existingBase64,
        },
        "Ignorando archivo sin contenido para adjuntar"
      );
      continue;
    }

    const base64 = contentBuffer.toString("base64");
    const name = f.originalname || f.name || `archivo - ${Date.now()} `;
    const mime = f.mimetype || "application/octet-stream";
    const { id, webViewLink } = await uploadBase64File(name, base64, mime, parentFolder);
    uploadedFiles.push({ id, link: webViewLink });
    await db.query(
      `INSERT INTO request_attachments(request_id, drive_file_id, drive_link, mime_type, uploaded_by, title)`
      + `VALUES($1, $2, $3, $4, $5, $6)`,
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

async function resolveEquipmentDisplayData(equipos = []) {
  const normalizedEquipos = Array.isArray(equipos) ? equipos.slice(0, 4) : [];
  const unidadIds = [
    ...new Set(
      normalizedEquipos
        .map((entry) => Number(entry?.unidad_id))
        .filter((id) => Number.isFinite(id)),
    ),
  ];
  const details = {};

  if (unidadIds.length) {
    const { rows } = await db.query(
      `SELECT eu.id, eu.estado, eu.serial,
              em.nombre AS modelo_nombre, em.modelo, em.fabricante
         FROM public.equipos_unidad eu
         LEFT JOIN public.equipos_modelo em ON em.id = eu.modelo_id
        WHERE eu.id = ANY($1::int[])`,
      [unidadIds],
    );
    rows.forEach((row) => {
      details[row.id] = row;
    });
  }

  return normalizedEquipos.map((entry) => {
    const detail = details[Number(entry.unidad_id)] || {};
    const rawState = String(entry.estado || detail.estado || "").toLowerCase();
    const displayState = rawState === "cu" ? "CU" : "Nuevo";
    const displayName =
      entry.nombre_equipo ||
      detail.modelo_nombre ||
      detail.modelo ||
      detail.nombre ||
      entry.nombre ||
      entry.equipo_nombre ||
      "Equipo";
    return {
      ...entry,
      displayName,
      displayState,
    };
  });
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
     JOIN request_types rt ON r.request_type_id = rt.id
     LEFT JOIN users u ON u.id = r.requester_id
     WHERE r.id = $1`,
    [request_id]
  );

  const req = rows[0];
  if (!req) throw new Error("Solicitud no encontrada");
  const payloadRaw = typeof req.payload === "string" ? JSON.parse(req.payload) : req.payload || {};
  const typeCode = (req.type_code || "").trim().toUpperCase();
  const variantKey = (formVariant || payloadRaw.__form_variant || ctx.payload?.__form_variant || "").toLowerCase();
  const variantMeta = FORM_VARIANT_META[variantKey] || {};
  const paddedId = padId(request_id);
  const normalizedCode = typeCode || "ACTA";
  const pdfBaseName = `${normalizedCode} -${paddedId} `;
  const docLabel = variantMeta.label || req.type_title || "Acta";
  const templateId = getSolicitudTemplateId(typeCode);
  if (!templateId) {
    throw new Error(`No se encontró plantilla para el tipo de solicitud ${typeCode || "desconocido"}`);
  }
  const docName = `${docLabel} - ${pdfBaseName} `;
  const doc = await copyTemplate(templateId, docName, folderId);
  const payload = payloadRaw || {};
  const resolvedEquipments = await resolveEquipmentDisplayData(payload.equipos);
  const equipos = resolvedEquipments || [];
  const equipmentTags = {};
  for (let i = 0; i < 4; i += 1) {
    const equipo = equipos[i];
    const nameTag = `<<N_Equipo${i + 1}>>`;
    const stateTag = `<<E_Equipo${i + 1}>>`;

    if (equipo) {
      equipmentTags[nameTag] = asText(equipo.displayName);
      equipmentTags[stateTag] = asText(equipo.displayState);
    } else {
      equipmentTags[nameTag] = "";
      equipmentTags[stateTag] = "";
    }
  }

  const fechaInstalacionRaw = payload.fecha_instalacion || payload.fecha_retiro || payload.fecha_tentativa_visita || "";
  const replacements = {
    ID_SOLICITUD: asText(request_id),
    NOMBRE_CLIENTE: asText(payload.nombre_cliente),
    DIRECCION_CLIENTE: asText(payload.direccion_cliente),
    PERSONA_CONTACTO: asText(payload.persona_contacto),
    CELULAR_CONTACTO: asText(payload.celular_contacto),
    FECHA_INSTALACION: asText(fechaInstalacionRaw),
    EQUIPOS: equipos.map((e) => `${asText(e.displayName)} (${asText(e.displayState)})`).join(", "),
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

  await logAction({ user_id: uploaded_by, module: "requests", action: "generate_acta", entity: "requests", entity_id: request_id });

  logger.info(
    {
      request_id,
      template: templateId,
      doc_id: doc.id,
      pdf_id: pdf?.id || null,
    },
    "📄 Acta generada en Drive"
  );

  return { id: pdf?.id || doc.id, link: pdfLink || docLink, docId: doc.id, docLink, pdfId: pdf?.id || null, pdfLink: pdfLink || null, name: pdfBaseName, variant: variantKey };
}

async function generateClientApprovalLetter({ request, approvedBy }) {
  if (!CLIENT_APPROVAL_TEMPLATE_ID) return null;
  if (!request?.drive_folder_id) return null;

  const paddedId = padId(request.id);
  const clientName = request.commercial_name || request.legal_person_business_name || "Cliente";
  const docBaseName = `Oficio de aprobación - ${clientName} - ${paddedId}`;

  try {
    const doc = await copyTemplate(CLIENT_APPROVAL_TEMPLATE_ID, docBaseName, request.drive_folder_id);
    const approvedAt = request.approved_at ? new Date(request.approved_at) : new Date();
    const approverName = approvedBy?.fullname || approvedBy?.name || approvedBy?.email || "Equipo de SPI";

    await replaceTags(doc.id, {
      CLIENTE: clientName,
      RUC: request.ruc_cedula || "",
      SOLICITUD: String(request.id),
      FECHA: formatDate(approvedAt),
      HORA: approvedAt.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
      APROBADOR: approverName,
      CORREO_APROBADOR: approvedBy?.email || "",
      ESTADO: "Aprobada",
      FECHA_SOLICITUD: formatDate(request.created_at),
    });

    const pdf = await exportPdf(doc.id, request.drive_folder_id, `${docBaseName}.pdf`);
    await drive.files.delete({ fileId: doc.id, supportsAllDrives: true });

    await logAction({
      user_id: approvedBy?.id || null,
      module: "client_requests",
      action: "generate_approval_letter",
      entity: "client_requests",
      entity_id: request.id,
      details: { file_id: pdf?.id || null },
    });

    return pdf;
  } catch (error) {
    logger.error({ err: error }, "Error generando oficio de aprobación");
    return null;
  }
}

async function addDriveAttachment({ request_id, drive_file_id, title, mime_type = "application/pdf" }) {
  if (!drive_file_id) return null;
  const drive_link = buildDriveLink(drive_file_id);
  const { rows } = await db.query(
    `INSERT INTO request_attachments (request_id, drive_file_id, drive_link, mime_type, uploaded_by, title)
     VALUES ($1, $2, $3, $4, NULL, $5)
     RETURNING *`,
    [request_id, drive_file_id, drive_link, mime_type, title || "Documento adjunto"],
  );

  await logAction({
    module: "requests",
    action: "attach_existing_file",
    entity: "requests",
    entity_id: request_id,
    details: { drive_file_id, title },
  });

  return rows[0];
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

async function listRequests({ page = 1, pageSize = 50, status, q, type }) {
  const offset = (page - 1) * pageSize;
  const fromAndJoins = `
    FROM requests r
    LEFT JOIN users u ON u.id = r.requester_id
    LEFT JOIN request_types rt ON rt.id = r.request_type_id
  `;
  let whereClauses = "WHERE 1=1";
  const params = [];
  let paramIndex = 1;

  if (type) {
    try {
      const typeId = await resolveRequestTypeId(type);
      whereClauses += ` AND r.request_type_id = $${paramIndex++}`;
      params.push(typeId);
    } catch (e) {
      // Si el tipo no existe, retornamos lista vacía o ignoramos. 
      // Retornar vacío es más correcto para un filtro fallido.
      return { rows: [], total: 0 };
    }
  }

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

async function syncEquipmentOnCreate({ requestId, typeCode, payload }) {
  const entries = buildEquipmentEntries(payload || {});
  if (!entries.length) return null;
  const clientesId = resolveClientIdFromPayload(payload);
  const evento = getEquipmentEventLabel(typeCode);

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.unidad_id) return null;

      if (entry.serial) {
        try {
          await captureSerial({
            unidad_id: entry.unidad_id,
            serial: entry.serial,
            request_id: requestId,
            cliente_id: clientesId,
            detalle: `Serial registrado desde solicitud ${typeCode || ""}`,
            user_id: null,
          });
        } catch (error) {
          logger.warn({ error, unit: entry.unidad_id }, "No se pudo guardar el serial al crear solicitud");
        }
      }

      if (clientesId) {
        try {
          await assignUnidad({
            unidad_id: entry.unidad_id,
            cliente_id: clientesId,
            detalle: `Asignacion por solicitud ${REQUEST_TYPE_LABELS[typeCode] || "solicitud"}`,
            user_id: null,
          });
        } catch (error) {
          logger.warn(
            { error, unidad_id: entry.unidad_id, cliente_id: clientesId },
            "No se pudo asignar la unidad al cliente desde la solicitud"
          );
        }
      }

      const detalle = buildEquipmentDetail(entry, evento);
      await logEquipmentHistory({
        unidad_id: entry.unidad_id,
        request_id: requestId,
        evento,
        detalle,
        cliente_id: clientesId,
        user_id: null,
      });
      return true;
    }),
  );

  return true;
}

async function syncEquipmentFromRequest({ requestId, status, client = db }) {
  const normalizedStatus = (status || "").toLowerCase();
  if (!requestId || !normalizedStatus.includes("aprob")) return null;

  const { rows } = await client.query(
    `SELECT r.payload, rt.code AS type_code
       FROM requests r
       JOIN request_types rt ON rt.id = r.request_type_id
      WHERE r.id = $1
      LIMIT 1`,
    [requestId],
  );

  const row = rows[0];
  if (!row) return null;

  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload || {};
  const entries = buildEquipmentEntries(payload);
  if (!entries.length) return null;

  const evento = getEquipmentEventLabel(row.type_code);
  const estadoFinal = getEquipmentDefaultState(row.type_code);

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.unidad_id) return null;

      if (entry.serial) {
        try {
          await captureSerial({
            unidad_id: entry.unidad_id,
            serial: entry.serial,
            request_id: requestId,
            detalle: `Actualizado por solicitud ${row.type_code || ""} aprobada`,
            user_id: null,
          });
        } catch (error) {
          logger.warn({ error, unidad_id: entry.unidad_id }, "No se pudo registrar serial desde la solicitud aprobada");
        }
      }

      const estado = entry.estado || estadoFinal;
      if (!estado) return null;

      try {
        await cambiarEstadoUnidad({
          unidad_id: entry.unidad_id,
          estado,
          detalle: buildEquipmentDetail(entry, evento),
          request_id: requestId,
          user_id: null,
        });
      } catch (err) {
        logger.warn(
          { err, unidad_id: entry.unidad_id },
          "No se pudo actualizar estado del equipo desde solicitud",
        );
      }

      return true;
    }),
  );

  return true;
}

async function updateRequestStatus(id, status, client = db) {
  const { rows } = await client.query(
    `UPDATE requests SET status=$1, updated_at=now() WHERE id=$2 RETURNING *`,
    [status, id]
  );
  const updated = rows[0];
  if (updated) {
    // Enviar notificaciones automáticas
    setImmediate(async () => {
      try {
        const { rows: requestRows } = await db.query(
          `SELECT r.*, u.email as requester_email, u.id as requester_id
           FROM requests r
           LEFT JOIN users u ON r.requester_id = u.id
           WHERE r.id = $1`,
          [updated.id]
        );
        const requestData = requestRows[0];

        if (requestData && requestData.requester_id) {
          if (status.toLowerCase().includes('aprob')) {
            await notificationManager.notifyRequestApproved(requestData.requester_id, updated.id, {
              request_type: requestData.request_type_id,
              approved_at: new Date().toISOString()
            });
          } else if (status.toLowerCase().includes('rechaz')) {
            await notificationManager.notifyRequestRejected(requestData.requester_id, updated.id, {
              request_type: requestData.request_type_id,
              rejected_at: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        logger.error('Error enviando notificación automática:', error);
        // No lanzamos error para no detener el flujo
      }

      syncEquipmentFromRequest({ requestId: updated.id, status: updated.status, client });
    });
  }
  return updated;
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

  const summaryText = summaryItems.length
    ? summaryItems
      .map((item) => item.replace(/<[^>]+>/g, ""))
      .map((text) => `• ${text}`)
      .join("\n")
    : "• Sin detalles adicionales";

  const documentLine = document?.link ? `• Documento generado: ${document.link}` : null;
  const lines = [
    `*Solicitud pendiente de aprobación* (#${request.id})`,
    `*Tipo:* ${requestTitle}`,
    `*Solicitante:* ${requesterName}${requesterEmail ? ` (${requesterEmail})` : ""}`,
    summaryText,
    documentLine,
    `*Revisar en SPI:* ${detailLink}`,
  ].filter(Boolean);

  const recipients = uniqueRecipients(REQUEST_NOTIFICATION_EMAILS, requesterEmail);

  await notificationManager.sendNotification({
    template: 'custom_html',
    data: {
      title: `Solicitud pendiente de aprobación (#${request.id})`,
      message: `
      <p><strong>Tipo:</strong> ${requestTitle}</p>
      <p><strong>Solicitante:</strong> ${requesterName}${requesterEmail ? ` (${requesterEmail})` : ""}</p>
      ${summaryBlock}
      ${documentSection || ""}
      <p>Revisa y gestiona la solicitud en SPI: <a href="${detailLink}" target="_blank" rel="noopener">${detailLink}</a></p>
      `,
      link: detailLink
    },
    to: recipients,
    sender: {
      gmailUserId: requester?.id || null,
      replyTo: requesterEmail || undefined,
      from: requesterEmail || undefined,
    },
    skipSave: true
  });
}

async function cancelRequest({ id, user_id }) {
  const { rows } = await db.query(
    `SELECT id, status FROM requests WHERE id = $1 LIMIT 1`,
    [id],
  );

  const request = rows[0];
  if (!request) throw new Error("Solicitud no encontrada");

  const currentStatus = (request.status || "").toLowerCase();
  if (["aprobado", "approved", "cancelado", "cancelled"].includes(currentStatus)) {
    throw new Error("La solicitud ya no puede cancelarse");
  }

  await db.query(
    `UPDATE requests SET status = 'cancelado', updated_at = now() WHERE id = $1`,
    [id],
  );

  await logAction({
    user_id,
    module: "requests",
    action: "cancel",
    entity: "requests",
    entity_id: id,
  });

  return true;
}

async function resubmit({ id, user_id, payload }) {
  const { rows } = await db.query(
    `SELECT r.*, rt.code AS type_code
       FROM requests r
       LEFT JOIN request_types rt ON rt.id = r.request_type_id
      WHERE r.id = $1
      LIMIT 1`,
    [id],
  );

  const request = rows[0];
  if (!request) throw new Error("Solicitud no encontrada");

  const status = (request.status || "").toLowerCase();
  if (!status.includes("rechaz") && !status.includes("cancel")) {
    throw new Error("Solo puedes reenviar solicitudes rechazadas o canceladas");
  }

  const schemaKey = resolveSchemaKey(request.type_code);
  const { normalizedPayload, schema } = normalizePayload(schemaKey, payload || {});
  const validate = ajv.compile(schema);
  const valid = validate(payload || {});
  if (!valid) {
    const errors = validate.errors
      .map((e) => `${e.instancePath || e.keyword} ${e.message} `)
      .join(", ");
    const err = new Error(`Datos de solicitud inválidos(${schemaKey}): ${errors} `);
    err.validationErrors = validate.errors;
    throw err;
  }

  const nextVersion = (request.version_number || 1) + 1;
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE requests
          SET status = 'pendiente',
              payload = $1,
              version_number = $2,
              updated_at = now()
        WHERE id = $3`,
      [JSON.stringify(normalizedPayload), nextVersion, id],
    );

    await client.query(
      `INSERT INTO request_versions(request_id, version_number, payload)
       VALUES($1, $2, $3)`,
      [id, nextVersion, JSON.stringify(normalizedPayload)],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await logAction({
    user_id,
    module: "requests",
    action: "resubmit",
    entity: "requests",
    entity_id: id,
    details: normalizedPayload,
  });

  return { id, status: "pendiente", version_number: nextVersion, payload: normalizedPayload };
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

  const booleanFields = ["data_processing_consent"];
  booleanFields.forEach((field) => {
    if (data[field] === "true") data[field] = true;
    if (data[field] === "false") data[field] = false;
  });

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
  const requiredFileFields = ["id_file"];
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
  const rucCedula = data.ruc_cedula || null;
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
      data.natural_person_lastname || null, commercial_name, data.establishment_name || null, rucCedula,
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
        html: `<h2>Confirmación de Uso de Datos</h2><p>Hola,</p><p>Se ha iniciado un proceso de registro como cliente en nuestro sistema. Para continuar, necesitamos tu autorización para el tratamiento de tus datos personales según la normativa vigente.</p><p>Por favor, haz clic en el siguiente enlace para confirmar tu autorización:</p><p><a href="${consentLink}" target="_blank">Autorizar y continuar</a></p><p>Si no has solicitado este registro, puedes ignorar este correo.</p>`,
        gmailUserId: user?.id || null,
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

    if (consentCaptureMethod === "email_link" && hasVerifiedToken) {
      const consentRecord = await generateConsentDeclarationDocument({
        request: newRequest,
        token: verifiedConsentToken,
      });
      if (consentRecord?.id) {
        await dbClient.query(
          "UPDATE client_requests SET consent_record_file_id = $1 WHERE id = $2",
          [consentRecord.id, newRequest.id],
        );
        newRequest.consent_record_file_id = consentRecord.id;
      }
    }

    const recipients = uniqueRecipients(REQUEST_NOTIFICATION_EMAILS, user.email);
    const detailLink = `${FRONTEND_URL}/dashboard/backoffice-comercial?request=${newRequest.id}`;
    await sendMail({
      to: recipients,
      subject: `Nueva solicitud de cliente (#${newRequest.id}) pendiente de revisión`,
      html: `
        <h2>Nueva solicitud de cliente</h2>
        <p><strong>Cliente:</strong> ${commercial_name}</p>
        <p><strong>Tipo:</strong> ${data.client_type}</p>
        <p><strong>Solicitante:</strong> ${user.email}</p>
        <p>Revisar y aprobar/rechazar en el dashboard de Backoffice:</p>
        <p><a href="${detailLink}" target="_blank" rel="noopener">Abrir en SPI</a></p>
      `,
      text: `Nueva solicitud de cliente (#${newRequest.id})\nCliente: ${commercial_name}\nTipo: ${data.client_type}\nSolicitante: ${user.email}\nRevisar en SPI: ${detailLink}`,
      gmailUserId: user?.id || null,
      replyTo: user?.email || undefined,
      from: user?.email || undefined,
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

async function listClientRequests({ page = 1, pageSize = 25, status, q, createdBy }) {
  const offset = (page - 1) * pageSize;
  const params = [];
  let whereClause = "WHERE 1=1";
  if (status) {
    params.push(status);
    whereClause += ` AND status = $${params.length}`;
  }
  if (createdBy) {
    params.push(createdBy);
    whereClause += ` AND created_by = $${params.length}`;
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    const qIndex = params.length;
    whereClause += ` AND (LOWER(commercial_name) LIKE $${qIndex} OR LOWER(ruc_cedula) LIKE $${qIndex} OR CAST(id AS TEXT) LIKE $${qIndex})`;
  }
  const countQuery = `SELECT COUNT(*) FROM client_requests ${whereClause}`;
  const totalResult = await db.query(countQuery, params);
  const total = parseInt(totalResult.rows[0].count, 10);
  const dataQuery = `SELECT id, commercial_name, ruc_cedula, created_by, status, created_at, rejection_reason FROM client_requests ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const { rows } = await db.query(dataQuery, [...params, pageSize, offset]);
  return { count: total, rows, page, pageSize };
}

async function getClientRequestSummary({ createdBy } = {}) {
  const params = [];
  let whereClause = "WHERE 1=1";
  if (createdBy) {
    params.push(createdBy);
    whereClause += ` AND created_by = $${params.length}`;
  }

  const query = `
    SELECT status, COUNT(*)::int AS count
    FROM client_requests
    ${whereClause}
    GROUP BY status
  `;

  const { rows } = await db.query(query, params);
  const summary = { total: 0 };
  rows.forEach((row) => {
    const statusKey = (row.status || "sin_estado").toString();
    const count = parseInt(row.count, 10) || 0;
    summary[statusKey] = count;
    summary.total += count;
  });

  return summary;
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
  return {
    ...request,
    attachments: getClientRequestAttachments(request),
  };
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
  const approvalStatus = newStatus === 'approved' ? 'aprobado' : 'rechazado';
  const approvedBy = newStatus === 'approved' ? user?.id || null : null;
  const approvedAt = newStatus === 'approved' ? new Date() : null;
  const { rows: updatedRows } = await db.query(
    `
      UPDATE client_requests
         SET status = $1,
             approval_status = $2,
             rejection_reason = $3,
             approved_by = $4,
             approved_at = $5,
             updated_at = now()
       WHERE id = $6
       RETURNING *
    `,
    [
      newStatus,
      approvalStatus,
      newStatus === 'rejected' ? rejection_reason : null,
      approvedBy,
      approvedAt,
      id,
    ]
  );
  const updatedRequest = updatedRows[0];
  let approvalLetter = null;
  if (newStatus === 'approved') {
    await moveClientFolderToApproved(request.drive_folder_id);
    approvalLetter = await generateClientApprovalLetter({
      request: updatedRequest,
      approvedBy: user,
    });
    if (approvalLetter?.id) {
      await db.query(
        "UPDATE client_requests SET approval_letter_file_id = $1 WHERE id = $2",
        [approvalLetter.id, id],
      );
      updatedRequest.approval_letter_file_id = approvalLetter.id;
    }
  }
  const outcome = newStatus === 'approved' ? 'Aprobada' : 'Rechazada';
  const approvalLetterLink =
    approvalLetter?.webViewLink || (approvalLetter?.id ? buildDriveLink(approvalLetter.id) : null);
  const recipients = uniqueRecipients(REQUEST_NOTIFICATION_EMAILS, request.created_by, request.client_email);
  const detailLink = `${FRONTEND_URL}/dashboard/backoffice-comercial?request=${request.id}`;
  await sendMail({
    to: recipients,
    subject: `Solicitud de cliente #${request.id} ${outcome}`,
    html: `
      <h2>Solicitud ${outcome}</h2>
      <p><strong>Cliente:</strong> ${request.commercial_name} (#${request.id})</p>
      <p><strong>Estado:</strong> ${outcome}</p>
      <p><strong>Procesado por:</strong> ${user.email}</p>
      ${newStatus === 'rejected' && rejection_reason ? `<p><strong>Motivo:</strong> ${rejection_reason}</p>` : ''}
      ${approvalLetterLink ? `<p><strong>Oficio de aprobación:</strong> <a href="${approvalLetterLink}" target="_blank" rel="noopener">${approvalLetterLink}</a></p>` : ''}
      <p>Consulta el detalle en SPI: <a href="${detailLink}" target="_blank" rel="noopener">${detailLink}</a></p>
    `,
    text: `Solicitud ${outcome}\nCliente: ${request.commercial_name} (#${request.id})\nEstado: ${outcome}\nProcesado por: ${user.email}${newStatus === 'rejected' && rejection_reason ? `\nMotivo: ${rejection_reason}` : ''}${approvalLetterLink ? `\nOficio de aprobación: ${approvalLetterLink}` : ''}\nDetalle: ${detailLink}`,
    gmailUserId: user?.id || null,
    replyTo: user?.email || undefined,
    from: user?.email || undefined,
  });
  return updatedRequest;
}

async function grantConsent({ token, audit = {} }) {
  if (!token) {
    const error = new Error("Token de consentimiento no proporcionado.");
    error.status = 400;
    throw error;
  }

  // Buscar solicitud por token
  const { rows } = await db.query(
    "SELECT * FROM client_requests WHERE lopdp_token = $1",
    [token]
  );
  const request = rows[0];

  if (!request) {
    const error = new Error("Token inválido o la solicitud no existe.");
    error.status = 404;
    throw error;
  }

  // Evitar reconfirmación
  if (request.lopdp_consent_status === "granted") {
    logger.warn(
      `Intento de re-confirmar consentimiento para la solicitud #${request.id}`
    );
    return request;
  }

  const clientIp = audit.ip || null;
  const userAgent = audit.userAgent || null;

  // Actualizar
  const { rows: updatedRows } = await db.query(
    `
    UPDATE client_requests
    SET 
      lopdp_consent_status = 'granted',
      status = 'pending_approval',
      lopdp_consent_method = COALESCE(lopdp_consent_method, 'email_link'),
      lopdp_consent_details = 'Consentimiento confirmado desde enlace público',
      lopdp_consent_at = NOW(),
      lopdp_consent_ip = $2,
      lopdp_consent_user_agent = $3,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
    `,
    [request.id, clientIp, userAgent]
  );

  const updatedRequest = updatedRows[0];

  // Registrar evento de auditoría
  await recordConsentEvent({
    client_request_id: updatedRequest.id,
    event_type: "granted",
    method: "email_link",
    details:
      "Consentimiento confirmado por el cliente mediante enlace público.",
    ip: clientIp,
    user_agent: userAgent,
  });

  // Notificación interna
  const recipients = uniqueRecipients(REQUEST_NOTIFICATION_EMAILS, updatedRequest.created_by, updatedRequest.client_email);
  const detailLink = `${FRONTEND_URL}/dashboard/backoffice-comercial?request=${updatedRequest.id}`;
  await sendMail({
    to: recipients,
    subject: `Consentimiento confirmado para solicitud #${updatedRequest.id}`,
    html: `
      <h2>Consentimiento confirmado</h2>
      <p><strong>Solicitud:</strong> #${updatedRequest.id}</p>
      <p><strong>Cliente:</strong> ${updatedRequest.commercial_name || "N/A"}</p>
      <p><strong>Email:</strong> ${updatedRequest.client_email || "N/A"}</p>
      <p>Revisar la solicitud en Backoffice: <a href="${detailLink}" target="_blank" rel="noopener">${detailLink}</a></p>
    `,
    text: `Consentimiento confirmado\nSolicitud: #${updatedRequest.id}\nCliente: ${updatedRequest.commercial_name || "N/A"}\nEmail: ${updatedRequest.client_email || "N/A"}\nRevisar: ${detailLink}`,
  });

  return updatedRequest;
}

async function updateClientRequest(id, user, rawData = {}, rawFiles = {}) {
  const { rows } = await db.query("SELECT * FROM client_requests WHERE id = $1", [id]);
  const request = rows[0];
  if (!request) {
    const error = new Error("Solicitud no encontrada.");
    error.status = 404;
    throw error;
  }

  if (request.created_by !== user.email) {
    const error = new Error("No tienes permiso para editar esta solicitud.");
    error.status = 403;
    throw error;
  }

  if (request.status !== "rejected" && request.status !== "pending_approval" && request.status !== "pending_consent") {
    const error = new Error("Solo puedes editar solicitudes rechazadas o pendientes.");
    error.status = 400;
    throw error;
  }

  const data = Object.fromEntries(
    Object.entries(rawData || {}).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ]),
  );

  const normalizedFiles = rawFiles && typeof rawFiles === "object" ? rawFiles : {};

  const fileIds = {};
  const fileUploadPromises = Object.entries(normalizedFiles).map(async ([fieldName, fileArray]) => {
    if (!Array.isArray(fileArray) || !fileArray.length) return;
    const file = fileArray[0];
    if (!file) return;

    const driveFolderId = request.drive_folder_id;

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

  const fieldsToUpdate = [
    "client_type", "legal_person_business_name", "nationality", "natural_person_firstname",
    "natural_person_lastname", "commercial_name", "establishment_name", "ruc_cedula",
    "establishment_province", "establishment_city", "establishment_address",
    "establishment_reference", "establishment_phone", "establishment_cellphone",
    "legal_rep_name", "legal_rep_position", "legal_rep_id_document", "legal_rep_cellphone",
    "legal_rep_email", "shipping_contact_name", "shipping_address", "shipping_city",
    "shipping_province", "shipping_reference", "shipping_phone", "shipping_cellphone",
    "shipping_delivery_hours", "operating_permit_status"
  ];

  if (fileIds.legal_rep_appointment_file_id) fieldsToUpdate.push("legal_rep_appointment_file_id");
  if (fileIds.ruc_file_id) fieldsToUpdate.push("ruc_file_id");
  if (fileIds.id_file_id) fieldsToUpdate.push("id_file_id");
  if (fileIds.operating_permit_file_id) fieldsToUpdate.push("operating_permit_file_id");
  if (fileIds.consent_evidence_file_id) fieldsToUpdate.push("consent_evidence_file_id");

  const newStatus = request.lopdp_consent_status === 'granted' ? 'pending_approval' : 'pending_consent';

  const values = [];
  const setParts = fieldsToUpdate.map((field) => {
    let val;
    if (field.endsWith("_id")) {
      if (fileIds[field]) {
        val = fileIds[field];
      } else {
        return null;
      }
    } else {
      val = data[field];
    }

    if (val !== undefined) {
      values.push(val);
      return `${field} = $${values.length} `;
    }
    return null;
  }).filter(Boolean);

  values.push(newStatus);
  setParts.push(`status = $${values.length} `);
  setParts.push(`rejection_reason = NULL`);
  setParts.push(`updated_at = now()`);

  const setClause = setParts.join(", ");

  const query = `UPDATE client_requests SET ${setClause} WHERE id = $${values.length + 1} RETURNING * `;
  values.push(id);

  const { rows: updatedRows } = await db.query(query, values);
  const updatedRequest = updatedRows[0];

  const recipients = uniqueRecipients(REQUEST_NOTIFICATION_EMAILS, updatedRequest.created_by);
  const detailLink = `${FRONTEND_URL}/dashboard/backoffice-comercial?request=${updatedRequest.id}`;
  await sendMail({
    to: recipients,
    subject: `Solicitud de cliente #${updatedRequest.id} corregida`,
    html: `
      <h2>Solicitud corregida y reenviada</h2>
      <p><strong>Cliente:</strong> ${updatedRequest.commercial_name} (#${updatedRequest.id})</p>
      <p>El usuario ha corregido la solicitud previamente rechazada. Está pendiente de nueva revisión.</p>
      <p>Revisar en SPI: <a href="${detailLink}" target="_blank" rel="noopener">${detailLink}</a></p>
    `,
    text: `Solicitud corregida y reenviada\nCliente: ${updatedRequest.commercial_name} (#${updatedRequest.id})\nPendiente de nueva revisión. Ver en SPI: ${detailLink}`,
    gmailUserId: user?.id || null,
    replyTo: user?.email || undefined,
    from: user?.email || undefined,
  });

  return updatedRequest;
}

module.exports = {
  listRequests,
  getRequestType,
  createRequest,
  saveAttachment,
  addDriveAttachment,
  getRequestFull,
  generateActa,
  generateClientApprovalLetter,
  updateRequestStatus,
  cancelRequest,
  resubmit,
  createClientRequest,
  listClientRequests,
  getClientRequestSummary,
  getClientRequestById,
  processClientRequest,
  grantConsent,
  sendConsentEmailToken,
  verifyConsentEmailToken,
  updateClientRequest,
};
