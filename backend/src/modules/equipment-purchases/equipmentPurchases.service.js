const db = require("../../config/db");
const logger = require("../../config/logger");
const { v4: uuidv4 } = require("uuid");
const PDFDocument = require("pdfkit");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const { createAllDayEvent } = require("../../utils/calendar");
const { sendMail } = require("../../utils/mailer");
const inventarioService = require("../inventario/inventario.service");
const {
  createRequest: createServiceRequest,
  generateActa,
  updateRequestStatus,
} = require("../requests/requests.service");

const DEFAULT_ROOT_ENV_KEYS = ["DRIVE_ROOT_FOLDER_ID", "DRIVE_FOLDER_ID"];
const ROOT_FOLDER_NAME = process.env.EQUIPMENT_PURCHASE_ROOT_FOLDER || "Solicitudes de compra de equipos";
const COMMERCIAL_FOLDER_NAME = "Comercial";
const PURCHASES_FOLDER_NAME = "Solicitudes de Compra de Equipos";
const CONTRACT_MAX_DAYS = 110;
const RESERVATION_REMINDER_OFFSET_DAYS = 55; // Reserva caduca a los 60 días
const CONTRACT_REMINDER_OFFSET = CONTRACT_MAX_DAYS - 15; // Avisar 15 días antes

let initialized = false;

const STATUS = {
  WAITING_PROVIDER: "waiting_provider_response",
  NO_STOCK: "no_stock",
  WAITING_PROFORMA: "waiting_proforma",
  PROFORMA_RECEIVED: "proforma_received",
  WAITING_SIGNED_PROFORMA: "waiting_signed_proforma",
  PENDING_CONTRACT: "pending_contract",
  COMPLETED: "completed",
};

function driveLink(fileId) {
  return fileId ? `https://drive.google.com/file/d/${fileId}/view` : null;
}

function getAcceptedItems(request) {
  if (!request?.provider_response?.items) return [];
  return request.provider_response.items.filter(
    (item) => item && item.decision !== "reject" && item.available_type !== "none",
  );
}

function formatEquipmentList(items) {
  const list = (items || []).map((item) => {
    const label = item.available_type === "cu" ? "CU" : "Nuevo";
    const name = item.name || item.sku || item.id || "Equipo";
    const serial = item.serial ? ` (Serie: ${item.serial})` : "";
    return `<li>${name}${serial} (${label})</li>`;
  });
  return list.length ? `<ul>${list.join("")}</ul>` : "<p>Sin equipos disponibles</p>";
}

function stripHtml(text) {
  if (!text) return "";
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildReport({ subject, html, request, actionLabel, user }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const acceptedItems = getAcceptedItems(request);
    const requestedItems = Array.isArray(request?.equipment) ? request.equipment : [];
    const now = new Date();

    doc.fontSize(18).text(actionLabel || "Informe de disponibilidad de equipos", {
      underline: true,
    });
    doc.moveDown();
    doc.fontSize(12).text(`Fecha y hora: ${now.toLocaleString("es-ES")}`);
    if (subject) doc.text(`Asunto: ${subject}`);
    if (user?.fullname || user?.name || user?.email) {
      const author = user.fullname || user.name || user.email;
      doc.text(`Usuario: ${author}${user.email && author !== user.email ? ` (${user.email})` : ""}`);
    }
    if (request?.client_name) doc.text(`Cliente: ${request.client_name}`);
    if (request?.provider_email) doc.text(`Proveedor: ${request.provider_email}`);
    if (request?.id) doc.text(`Solicitud: ${request.id}`);
    if (request?.provider_response?.notes) doc.text(`Notas del proveedor: ${request.provider_response.notes}`);

    doc.moveDown();
    doc.fontSize(14).text("Equipos aceptados");
    doc.fontSize(12);
    if (acceptedItems.length) {
      acceptedItems.forEach((item, idx) => {
        const label = item.available_type === "cu" ? "CU" : "Nuevo";
        const name = item.name || item.sku || item.id || `Equipo ${idx + 1}`;
        const serial = item.serial ? ` - Serie: ${item.serial}` : "";
        doc.text(`• ${name}${serial} (${label})`);
      });
    } else {
      doc.text("Sin equipos aceptados registrados");
    }

    if (requestedItems.length) {
      doc.moveDown();
      doc.fontSize(14).text("Equipos solicitados");
      doc.fontSize(12);
      requestedItems.forEach((item, idx) => {
        const label = item.type === "cu" ? "CU" : "Nuevo";
        const name = item.name || item.sku || item.id || `Equipo ${idx + 1}`;
        const serial = item.serial ? ` - Serie: ${item.serial}` : "";
        doc.text(`• ${name}${serial} (${label})`);
      });
    }

    const body = stripHtml(html) || "Sin detalle de mensaje";
    doc.moveDown();
    doc.fontSize(14).text("Detalle del mensaje enviado");
    doc.fontSize(12).text(body, { align: "left" });

    doc.end();
  });
}

async function ensureTables() {
  if (initialized) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS equipment_purchase_requests (
      id UUID PRIMARY KEY,
      created_by INTEGER,
      created_by_email TEXT,
      client_id INTEGER,
      client_name TEXT NOT NULL,
      client_email TEXT,
      provider_email TEXT,
      equipment JSONB NOT NULL DEFAULT '[]',
      status TEXT NOT NULL,
      availability_email_sent_at TIMESTAMPTZ,
      availability_email_file_id TEXT,
      provider_response JSONB,
      provider_response_at TIMESTAMPTZ,
      proforma_requested_at TIMESTAMPTZ,
      proforma_request_email_file_id TEXT,
      proforma_file_id TEXT,
      proforma_uploaded_at TIMESTAMPTZ,
      reservation_email_sent_at TIMESTAMPTZ,
      reservation_calendar_event_id TEXT,
      reservation_calendar_event_link TEXT,
      reservation_email_file_id TEXT,
      signed_proforma_file_id TEXT,
      signed_proforma_uploaded_at TIMESTAMPTZ,
      arrival_eta_email_sent_at TIMESTAMPTZ,
      arrival_eta_email_file_id TEXT,
      inspection_min_date DATE,
      inspection_max_date DATE,
      includes_starter_kit BOOLEAN,
      inspection_recorded_at TIMESTAMPTZ,
      contract_file_id TEXT,
      contract_uploaded_at TIMESTAMPTZ,
      contract_reminder_event_id TEXT,
      contract_reminder_event_link TEXT,
      drive_folder_id TEXT,
      extra JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  initialized = true;
}

async function getRootFolder() {
  const rootId = DEFAULT_ROOT_ENV_KEYS.map((key) => process.env[key]).find(Boolean);
  if (rootId) return { id: rootId };
  return ensureFolder(ROOT_FOLDER_NAME);
}

async function getClientDetails(clientId) {
  if (!clientId) return null;
  const { rows } = await db.query(
    `SELECT id, commercial_name, client_email, shipping_contact_name, shipping_phone, shipping_cellphone, shipping_address
       FROM client_requests
      WHERE id = $1
      LIMIT 1`,
    [clientId],
  );
  return rows[0] || null;
}

function buildInspectionPayload({ request, clientInfo, inspection_min_date, inspection_max_date, includes_starter_kit }) {
  const equipment = Array.isArray(request.equipment) ? request.equipment : [];
  const equipos = equipment.map((item) => ({
    nombre_equipo: item.name || item.sku || item.id || "Equipo",
    estado: item.type || item.estado || item.serial || "",
  }));

  const anotaciones = includes_starter_kit
    ? "Incluye kit de arranque"
    : "No incluye kit de arranque";

  return {
    nombre_cliente: request.client_name || clientInfo?.commercial_name || "",
    direccion_cliente: clientInfo?.shipping_address || "",
    persona_contacto: clientInfo?.shipping_contact_name || "",
    celular_contacto: clientInfo?.shipping_phone || clientInfo?.shipping_cellphone || "",
    fecha_instalacion: inspection_min_date,
    fecha_tope_instalacion: inspection_max_date || "",
    requiere_lis: false,
    equipos,
    anotaciones,
    accesorios: "",
    observaciones: request.notes || "",
  };
}

async function ensureActaForInspection({ inspectionRequest, user }) {
  const requestId = inspectionRequest?.request?.id;
  const hasActa =
    inspectionRequest?.document || inspectionRequest?.request?.status === "acta_generada";

  if (!requestId || hasActa) return inspectionRequest;

  try {
    const document = await generateActa(requestId, user.id, "inspection");
    await updateRequestStatus(requestId, "acta_generada");
    return { ...inspectionRequest, document };
  } catch (error) {
    logger.error(
      "No se pudo generar acta de inspección automática para solicitud %s: %s",
      requestId,
      error.message,
    );
    return inspectionRequest;
  }
}

async function ensureRequestFolder(clientName, requestId, requestDate) {
  const root = await getRootFolder();

  const comercialFolder = await ensureFolder(COMMERCIAL_FOLDER_NAME, root.id);
  const purchasesFolder = await ensureFolder(PURCHASES_FOLDER_NAME, comercialFolder.id);

  const paddedId = String(requestId).padStart(4, "0");
  const safeName = (clientName || "").trim().replace(/[\/\\:*?"<>|]/g, "-");
  const dateStr = requestDate ? new Date(requestDate).toISOString().split("T")[0] : "";
  const requestFolderName = `${paddedId} - ${safeName}${dateStr ? ` - ${dateStr}` : ""}`;

  const requestFolder = await ensureFolder(requestFolderName, purchasesFolder.id);
  return requestFolder.id;
}

async function archiveEmail({ html, subject, folderId, prefix = "correo", request, actionLabel, user }) {
  const report = await buildReport({ subject, html, request, actionLabel, user });
  const base64 = report.toString("base64");
  const stored = await uploadBase64File(
    `${prefix}-${new Date().toISOString()}.pdf`,
    base64,
    "application/pdf",
    folderId,
  );
  return stored?.id || null;
}

async function sendAndArchive({ user, to, subject, html, cc, folderId, prefix, request, actionLabel }) {
  await sendMail({
    to,
    cc,
    subject,
    html,
    gmailUserId: user?.id,
    from: user?.email,
    replyTo: user?.email,
  });
  return archiveEmail({ html, subject, folderId, prefix, request, actionLabel, user });
}

async function getApprovedClients() {
  await ensureTables();
  const { rows } = await db.query(
    `SELECT id, commercial_name AS name, client_email, shipping_contact_name, shipping_phone, shipping_address
       FROM client_requests
      WHERE status = 'approved'
      ORDER BY commercial_name ASC`
  );
  return rows;
}

async function getEquipmentCatalog() {
  const { rows } = await db.query(
    `SELECT id_equipo AS id, nombre, modelo, fabricante, categoria, descripcion, serie
       FROM servicio.equipos
      ORDER BY nombre ASC`
  );

  if (rows.length) {
    return rows.map((row) => ({
      id: row.id,
      name: row.nombre,
      model: row.modelo,
      maker: row.fabricante,
      category: row.categoria,
      description: row.descripcion,
      serial: row.serie,
    }));
  }

  const items = await inventarioService.getAllInventario({});
  return items.map((item) => ({
    id: item.inventory_id || item.id,
    name: item.item_name,
    sku: item.sku,
    serial: item.serial_number || item.serial || null,
    type: item.tipo || item.tipo_ultimo_movimiento || null,
  }));
}

async function listByUser(userId) {
  await ensureTables();
  const { rows } = await db.query(
    `SELECT * FROM equipment_purchase_requests WHERE created_by = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
    ...row,
    proforma_file_link: driveLink(row.proforma_file_id),
    signed_proforma_file_link: driveLink(row.signed_proforma_file_id),
    contract_file_link: driveLink(row.contract_file_id),
  }));
}

async function getById(id, userId) {
  await ensureTables();
  const { rows } = await db.query(
    `SELECT * FROM equipment_purchase_requests WHERE id = $1 AND created_by = $2 LIMIT 1`,
    [id, userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    proforma_file_link: driveLink(row.proforma_file_id),
    signed_proforma_file_link: driveLink(row.signed_proforma_file_id),
    contract_file_link: driveLink(row.contract_file_id),
  };
}

async function createPurchaseRequest({
  user,
  clientId,
  clientName,
  clientEmail,
  providerEmail,
  equipment = [],
  notes,
}) {
  await ensureTables();
  if (!clientName || !providerEmail || !equipment.length) {
    throw new Error("Cliente, proveedor y al menos un equipo son obligatorios");
  }

  const id = uuidv4();
  const createdAt = new Date();
  const folderId = await ensureRequestFolder(clientName, id, createdAt);

  const equipmentList = equipment
    .map((item) => {
      const typeLabel = item.type === 'cu' ? ' (CU)' : ' (Nuevo)';
      return `• ${item.name || item.sku || item.id}${item.serial ? ` (Serie: ${item.serial})` : ""}${typeLabel}`;
    })
    .join("<br>");

  const html = `
    <h2>Solicitud de disponibilidad</h2>
    <p>Cliente: <strong>${clientName}</strong></p>
    <p>Equipos requeridos:</p>
    <p>${equipmentList}</p>
    ${notes ? `<p>Notas: ${notes}</p>` : ""}
  `;

  const requestSnapshot = {
    id,
    client_name: clientName,
    provider_email: providerEmail,
    equipment,
    created_at: createdAt,
  };

  const emailFileId = await sendAndArchive({
    user,
    to: providerEmail,
    subject: `Disponibilidad de equipos - ${clientName}`,
    html,
    folderId,
    prefix: "disponibilidad",
    request: requestSnapshot,
    actionLabel: "Informe de disponibilidad de equipos",
  });

  const { rows } = await db.query(
    `INSERT INTO equipment_purchase_requests (
        id, created_by, created_by_email, client_id, client_name, client_email, provider_email,
        equipment, status, availability_email_sent_at, availability_email_file_id, drive_folder_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), $10, $11)
     RETURNING *`,
    [
      id,
      user.id,
      user.email,
      clientId || null,
      clientName,
      clientEmail || null,
      providerEmail,
      JSON.stringify(equipment),
      STATUS.WAITING_PROVIDER,
      emailFileId,
      folderId,
    ],
  );

  return rows[0];
}

async function saveProviderResponse({ id, userId, outcome, items = [], notes }) {
  await ensureTables();
  const request = await getById(id, userId);
  if (!request) throw new Error("Solicitud no encontrada o sin acceso");
  if (request.status !== STATUS.WAITING_PROVIDER) {
    throw new Error("Esta solicitud ya tiene respuesta del proveedor");
  }

  const normalizedOutcome = outcome === "none" ? STATUS.NO_STOCK : STATUS.WAITING_PROFORMA;
  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET provider_response = $1,
            provider_response_at = now(),
            status = $2,
            updated_at = now()
      WHERE id = $3 AND created_by = $4
      RETURNING *`,
    [
      { outcome, items, notes },
      normalizedOutcome,
      id,
      userId,
    ],
  );
  return rows[0];
}

async function requestProforma({ id, user }) {
  await ensureTables();
  const request = await getById(id, user.id);
  if (!request) throw new Error("Solicitud no encontrada o sin acceso");
  if (request.status !== STATUS.WAITING_PROFORMA) {
    throw new Error("La solicitud no está lista para pedir proforma");
  }

  const acceptedItems = getAcceptedItems(request);

  if (acceptedItems.length === 0) {
    throw new Error("No hay equipos aceptados para solicitar proforma");
  }

  const html = `
    <p>Hola,</p>
    <p>Por favor envíanos la proforma de los siguientes equipos para <strong>${request.client_name}</strong>:</p>
    ${formatEquipmentList(acceptedItems)}
  `;

  const emailFileId = await sendAndArchive({
    user,
    to: request.provider_email,
    subject: `Proforma requerida - ${request.client_name}`,
    html,
    folderId: request.drive_folder_id,
    prefix: "proforma",
    request,
    actionLabel: "Solicitud de proforma",
  });

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            proforma_requested_at = now(),
            proforma_request_email_file_id = $2,
            updated_at = now()
      WHERE id = $3 AND created_by = $4
      RETURNING *`,
    [STATUS.WAITING_PROFORMA, emailFileId, id, user.id],
  );
  return rows[0];
}

async function uploadDocument(file, folderId, prefix) {
  if (!file) throw new Error("Archivo requerido");
  const base64 = file.buffer.toString("base64");
  const saved = await uploadBase64File(file.originalname || `${prefix}.pdf`, base64, file.mimetype, folderId);
  return saved?.id;
}

async function uploadProforma({ id, user, file }) {
  await ensureTables();
  const request = await getById(id, user.id);
  if (!request) throw new Error("Solicitud no encontrada o sin acceso");
  if (request.status !== STATUS.WAITING_PROFORMA) {
    throw new Error("La solicitud debe estar esperando proforma");
  }

  const fileId = await uploadDocument(file, request.drive_folder_id, "proforma");
  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET proforma_file_id = $1,
            proforma_uploaded_at = now(),
            status = $2,
            updated_at = now()
      WHERE id = $3 AND created_by = $4
      RETURNING *`,
    [fileId, STATUS.PROFORMA_RECEIVED, id, user.id],
  );
  return rows[0];
}

async function reserveEquipment({ id, user }) {
  await ensureTables();
  const request = await getById(id, user.id);
  if (!request) throw new Error("Solicitud no encontrada o sin acceso");
  if (request.status !== STATUS.PROFORMA_RECEIVED) {
    throw new Error("Se requiere tener la proforma para reservar");
  }

  const acceptedItems = getAcceptedItems(request);
  if (!acceptedItems.length) {
    throw new Error("No hay equipos aceptados para enviar reserva");
  }

  const html = `
    <p>Solicitamos reservar los equipos cotizados para <strong>${request.client_name}</strong>.</p>
    <p>Adjuntamos la proforma recibida y confirmamos reserva para:</p>
    ${formatEquipmentList(acceptedItems)}
  `;

  const emailFileId = await sendAndArchive({
    user,
    to: request.provider_email,
    subject: `Reserva de equipos - ${request.client_name}`,
    html,
    folderId: request.drive_folder_id,
    prefix: "reserva",
    request,
    actionLabel: "Confirmación de reserva",
  });

  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + RESERVATION_REMINDER_OFFSET_DAYS);
  let calendarEvent = {};
  try {
    calendarEvent = await createAllDayEvent({
      summary: `Recordatorio de reserva - ${request.client_name}`,
      description: "La reserva caduca a los 60 días. Confirma cierre o renovación.",
      date: reminderDate,
      attendees: [user.email].filter(Boolean),
    });
  } catch (error) {
    logger.warn("No se pudo crear recordatorio de reserva en Calendar: %s", error.message);
  }

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            reservation_email_sent_at = now(),
            reservation_email_file_id = $2,
            reservation_calendar_event_id = $3,
            reservation_calendar_event_link = $4,
            updated_at = now()
      WHERE id = $5 AND created_by = $6
      RETURNING *`,
    [
      STATUS.WAITING_SIGNED_PROFORMA,
      emailFileId,
      calendarEvent.id || null,
      calendarEvent.htmlLink || null,
      id,
      user.id,
    ],
  );
  return rows[0];
}

async function uploadSignedProforma({ id, user, file, inspection_min_date, inspection_max_date, includes_starter_kit }) {
  await ensureTables();
  const request = await getById(id, user.id);
  if (!request) throw new Error("Solicitud no encontrada o sin acceso");
  if (request.status !== STATUS.WAITING_SIGNED_PROFORMA) {
    throw new Error("Se requiere estar esperando la proforma firmada");
  }

  const fileId = await uploadDocument(file, request.drive_folder_id, "proforma-firmada");

  const acceptedItems = getAcceptedItems(request);
  const arrivalHtml = `
    <p>Hemos recibido la proforma firmada de <strong>${request.client_name}</strong>.</p>
    <p>Por favor confirma el tiempo de llegada de los siguientes equipos:</p>
    ${formatEquipmentList(acceptedItems)}
  `;

  const arrivalFileId = await sendAndArchive({
    user,
    to: request.provider_email,
    subject: `Tiempo de llegada - ${request.client_name}`,
    html: arrivalHtml,
    folderId: request.drive_folder_id,
    prefix: "tiempo-llegada",
    request,
    actionLabel: "Solicitud de tiempo de llegada",
  });

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + CONTRACT_REMINDER_OFFSET);
  let contractReminder = {};
  try {
    contractReminder = await createAllDayEvent({
      summary: `Subir contrato firmado - ${request.client_name}`,
      description: "El contrato debe estar firmado antes de vencer el plazo del proceso de compra.",
      date: dueDate,
      attendees: [user.email].filter(Boolean),
    });
  } catch (error) {
    logger.warn("No se pudo crear recordatorio de contrato en Calendar: %s", error.message);
  }

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET signed_proforma_file_id = $1,
            signed_proforma_uploaded_at = now(),
            arrival_eta_email_sent_at = now(),
            arrival_eta_email_file_id = $2,
            inspection_min_date = $3,
            inspection_max_date = $4,
            includes_starter_kit = $5,
            inspection_recorded_at = now(),
            contract_reminder_event_id = $6,
            contract_reminder_event_link = $7,
            status = $8,
            updated_at = now()
      WHERE id = $9 AND created_by = $10
      RETURNING *`,
    [
      fileId,
      arrivalFileId,
      inspection_min_date || null,
      inspection_max_date || null,
      includes_starter_kit === true,
      contractReminder.id || null,
      contractReminder.htmlLink || null,
      STATUS.PENDING_CONTRACT,
      id,
      user.id,
    ],
  );
  return rows[0];
}

async function submitSignedProformaWithInspection({
  id,
  user,
  file,
  inspection_min_date,
  inspection_max_date,
  includes_starter_kit,
}) {
  if (!inspection_min_date || !inspection_max_date) {
    throw new Error("Las fechas de inspección mínima y máxima son obligatorias");
  }

  const request = await getById(id, user.id);
  if (!request) throw new Error("Solicitud no encontrada o sin acceso");

  const signedResult = await uploadSignedProforma({
    id,
    user,
    file,
    inspection_min_date,
    inspection_max_date,
    includes_starter_kit,
  });

  const clientInfo = await getClientDetails(request.client_id);
  const payload = buildInspectionPayload({
    request,
    clientInfo,
    inspection_min_date,
    inspection_max_date,
    includes_starter_kit,
  });

  const inspectionRequest = await createServiceRequest({
    requester_id: user.id,
    requester_email: user.email,
    requester_name: user.fullname || user.name || null,
    request_type_id: "F.ST-20",
    payload,
  });

  const inspectionWithActa = await ensureActaForInspection({
    inspectionRequest,
    user,
  });

  return { purchase_request: signedResult, inspection_request: inspectionWithActa };
}

async function uploadContract({ id, user, file }) {
  await ensureTables();
  const request = await getById(id, user.id);
  if (!request) throw new Error("Solicitud no encontrada o sin acceso");
  if (request.status !== STATUS.PENDING_CONTRACT) {
    throw new Error("La solicitud no está pendiente de contrato");
  }

  const fileId = await uploadDocument(file, request.drive_folder_id, "contrato");
  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET contract_file_id = $1,
            contract_uploaded_at = now(),
            status = $2,
            updated_at = now()
      WHERE id = $3 AND created_by = $4
      RETURNING *`,
    [fileId, STATUS.COMPLETED, id, user.id],
  );
  return rows[0];
}

module.exports = {
  getApprovedClients,
  getEquipmentCatalog,
  listByUser,
  getById,
  createPurchaseRequest,
  saveProviderResponse,
  requestProforma,
  uploadProforma,
  reserveEquipment,
  uploadSignedProforma,
  submitSignedProformaWithInspection,
  uploadContract,
  STATUS,
};
