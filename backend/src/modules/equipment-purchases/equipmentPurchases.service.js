const db = require("../../config/db");
const logger = require("../../config/logger");
const { v4: uuidv4 } = require("uuid");
const PDFDocument = require("pdfkit");
const { ensureFolder, uploadBase64File, copyTemplate } = require("../../utils/drive");
const { createAllDayEvent } = require("../../utils/calendar");
const { sendMail } = require("../../utils/mailer");
const { sheets } = require("../../config/google");
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
  PENDING_PROVIDER: "pending_provider_assignment",
  WAITING_PROVIDER: "waiting_provider_response",
  NO_STOCK: "no_stock",
  WAITING_PROFORMA: "waiting_proforma",
  PROFORMA_RECEIVED: "proforma_received",
  WAITING_SIGNED_PROFORMA: "waiting_signed_proforma",
  PENDING_CONTRACT: "pending_contract",
  COMPLETED: "completed",
};

const MANAGER_ROLES = new Set(["acp_comercial", "gerencia", "jefe_comercial"]);
const BUSINESS_CASE_TEMPLATE_ID = process.env.BUSINESS_CASE_TEMPLATE_ID || "1cll8wqgVFKOm9tGN5HhgpAEWtIHQts2a";
const BUSINESS_CASE_SHEET_RANGE = "A1:F200";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function canManageAll(user) {
  return MANAGER_ROLES.has(normalizeRole(user?.role));
}

function driveLink(fileId) {
  return fileId ? `https://drive.google.com/file/d/${fileId}/view` : null;
}

function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function mapRequestRow(row = {}) {
  const extra = typeof row.extra === "string" ? safeJsonParse(row.extra) : row.extra;
  return {
    ...row,
    extra,
    proforma_file_link: driveLink(row.proforma_file_id),
    signed_proforma_file_link: driveLink(row.signed_proforma_file_id),
    contract_file_link: driveLink(row.contract_file_id),
    business_case_link: row.bc_spreadsheet_url || driveLink(row.bc_spreadsheet_id),
  };
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
      assigned_to INTEGER,
      assigned_to_email TEXT,
      assigned_to_name TEXT,
      client_id INTEGER,
      client_name TEXT NOT NULL,
      client_email TEXT,
      notes TEXT,
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
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS assigned_to INTEGER`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS assigned_to_email TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS assigned_to_name TEXT`,
  );
  await db.query(`ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS notes TEXT`);
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS bc_spreadsheet_id TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS bc_spreadsheet_url TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS bc_created_at TIMESTAMPTZ`,
  );
  await db.query(`
    CREATE TABLE IF NOT EXISTS equipment_purchase_bc_items (
      id UUID PRIMARY KEY,
      request_id UUID REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      characteristics TEXT,
      status TEXT,
      quantity NUMERIC,
      price NUMERIC,
      total NUMERIC,
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT now()
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
  const extra = request?.extra || {};
  const requiresLis = Boolean(extra.requires_lis || extra.requiere_lis);
  // El esquema espera un booleano para requiere_lis
  const lisValue = requiresLis;
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
    email_cliente: request.client_email || clientInfo?.client_email || "",
    persona_contacto: clientInfo?.shipping_contact_name || "",
    celular_contacto: clientInfo?.shipping_phone || clientInfo?.shipping_cellphone || "",
    fecha_instalacion: inspection_min_date,
    fecha_tope_instalacion: inspection_max_date || "",
    requiere_lis: lisValue,
    equipos,
    anotaciones,
    accesorios: "",
    observaciones: request.notes || "",
  };
}

async function getFirstSheetTitle(spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return meta.data?.sheets?.[0]?.properties?.title;
}

async function updateSheetByLabel({ spreadsheetId, updates }) {
  if (!spreadsheetId || !Object.keys(updates || {}).length) return false;
  const sheetTitle = await getFirstSheetTitle(spreadsheetId);
  if (!sheetTitle) return false;

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!${BUSINESS_CASE_SHEET_RANGE}`,
  });

  const rows = data.values || [];
  const ranges = [];
  Object.entries(updates).forEach(([label, value]) => {
    const rowIndex = rows.findIndex((row) => String(row?.[0] || "").trim().toLowerCase() === String(label || "").trim().toLowerCase());
    if (rowIndex >= 0) {
      ranges.push({
        range: `${sheetTitle}!B${rowIndex + 1}`,
        values: [[value ?? ""]],
      });
    }
  });

  if (!ranges.length) return false;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: ranges,
    },
  });
  return true;
}

async function syncBusinessCaseItemsToSheet({ spreadsheetId, items }) {
  if (!spreadsheetId) return false;
  const sheetTitle = await getFirstSheetTitle(spreadsheetId);
  if (!sheetTitle) return false;

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!${BUSINESS_CASE_SHEET_RANGE}`,
  });

  const rows = data.values || [];
  const startIndex = rows.findIndex((row) => String(row?.[0] || "").toLowerCase().includes("inversiones adicionales"));
  if (startIndex === -1) return false;

  const subtotalIndex = rows.findIndex((row) => String(row?.[0] || "").toLowerCase().includes("sub total"));
  const writableStart = startIndex + 2; // deja fila de título y cabecera
  const maxRows = subtotalIndex > writableStart ? subtotalIndex - writableStart : items.length;
  const normalizedItems = Array.isArray(items) ? items.slice(0, maxRows) : [];
  const fillRows = Math.max(normalizedItems.length, 8);

  const emptyBlock = Array.from({ length: fillRows }, () => ["", "", "", "", "", ""]);
  const itemBlock = normalizedItems.map((item) => [
    item.name || "",
    item.characteristics || "",
    item.status || "",
    item.quantity ?? "",
    item.price ?? "",
    item.total ?? "",
  ]);

  const requests = [
    {
      range: `${sheetTitle}!A${writableStart}:F${writableStart + fillRows - 1}`,
      values: emptyBlock,
    },
  ];

  if (itemBlock.length) {
    requests.push({
      range: `${sheetTitle}!A${writableStart}:F${writableStart + itemBlock.length - 1}`,
      values: itemBlock,
    });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: requests },
  });

  return true;
}

function buildBusinessCaseName(request) {
  const monthYear = new Date().toLocaleDateString("es-EC", { month: "long", year: "numeric" }).toUpperCase();
  const equipmentLabels = Array.isArray(request?.equipment)
    ? request.equipment
        .map((item) => item?.name || item?.sku || item?.id)
        .filter(Boolean)
        .slice(0, 3)
        .join(",")
    : "";
  const suffix = equipmentLabels ? `-${equipmentLabels}` : "";
  return `BC-${request?.client_name || "CLIENTE"}${suffix ? `-${suffix}` : ""}-${monthYear}`;
}

function buildBusinessCasePrefill({ request, clientInfo }) {
  const extra = request?.extra || {};
  return {
    "TIPO DE CLIENTE": extra.tipo_cliente || "",
    "ENTIDAD CONTRATANTE": extra.entidad_contratante || "",
    CLIENTE: request?.client_name || clientInfo?.commercial_name || "",
    "Provincia /Ciudad": extra.ciudad || extra.provincia || "",
    "Código del Proceso": extra.codigo_proceso || "",
    "Objeto de contratación": extra.objeto_contratacion || "",
    "Número de días por semana que trabaja el laboratorio": extra.dias_lab || "",
    "Turnos por dia": extra.turnos_dia || "",
    "Horas por turno": extra.horas_turno || "",
    "Controles de calidad por turno": extra.controles_por_turno || "",
    "Niveles de Control": extra.niveles_control || "",
    "Frecuencia de controles de calidad  (Rutina)": extra.frecuencia_calidad || "",
    "Pruebas Especiales": extra.pruebas_especiales || "",
    "Frecuencia de controles de calidad pruebas especiales": extra.frecuencia_especiales || "",
    "Nombre de Equipo Principal": extra.equipo_principal || "",
    "Estado de equipo principal (nuevo / usado/ año de fabricación) TDR": extra.estado_equipo_principal || "",
    "Estado de equipo: Propio / Alquilado /Nuevo /Reservado/ Serie (FAM)": extra.estado_equipo_propiedad || "",
    "Imagen reserva de equipo": extra.imagen_reserva_equipo || "",
    "Nombre de Equipo Back up": extra.equipo_backup || "",
    "Estado de equipo back up (nuevo / usado/ año de fabricación)": extra.estado_equipo_backup || "",
    "Se debe instalar a la par del equipo principal? SI/NO": extra.backup_paralelo || "",
    "Ubicación de los equipos a instalar": extra.ubicacion_equipos || "",
    "Permite equipo provisional": extra.permite_equipo_provisional || "",
    "Requiere equipo complementario) SI/NO": extra.requiere_equipo_complementario || "",
    "Equipo complementario, para que prueba": extra.equipo_complementario_para || "",
    "Incluye LIS : Si / No": extra.incluye_lis || "",
    "Proveedor del sistema a trabajar": extra.proveedor_lis || "",
    "Incluye Hadware: Si/No": extra.incluye_hardware || "",
    "Número de pacientes MENSUAL": extra.pacientes_mensual || "",
    "Interfaz a sistema actual": extra.interfaz_sistema_actual || "",
    "Nombre del sistema": extra.nombre_sistema || "",
    Proveedor: extra.proveedor_sistema || "",
    "Incluye Hadware: Si/No ": extra.incluye_hardware_actual || "",
    "Interfaz de equipos": extra.interfaz_equipos || "",
    "Modelo / Proveedor": extra.interfaz_modelo_1 || "",
    "Modelo / Proveedor ": extra.interfaz_modelo_2 || "",
    "Modelo / Proveedor  ": extra.interfaz_modelo_3 || "",
    Plazo: extra.plazo || "",
    "Proyección de plazo": extra.proyeccion_plazo || "",
    "Total/Parcial - tiempo/Parcial a necesidad del laboratorio": extra.entregas_plan || "",
    "Determinacion Efectiva Si/No": extra.determinacion_efectiva || "",
  };
}

async function ensureBusinessCaseDocument({ request, clientInfo, user }) {
  if (request?.bc_spreadsheet_id) return request;
  if (!request?.drive_folder_id || !BUSINESS_CASE_TEMPLATE_ID) return request;

  try {
    const name = buildBusinessCaseName(request);
    const copy = await copyTemplate(BUSINESS_CASE_TEMPLATE_ID, name, request.drive_folder_id);
    const prefills = buildBusinessCasePrefill({ request, clientInfo });
    await updateSheetByLabel({ spreadsheetId: copy.id, updates: prefills });

    await db.query(
      `UPDATE equipment_purchase_requests
          SET bc_spreadsheet_id = $1,
              bc_spreadsheet_url = $2,
              bc_created_at = now(),
              updated_at = now()
        WHERE id = $3`,
      [copy.id, copy.webViewLink || null, request.id],
    );

    return { ...request, bc_spreadsheet_id: copy.id, bc_spreadsheet_url: copy.webViewLink };
  } catch (error) {
    logger.warn("No se pudo generar Business Case automático: %s", error.message);
    return request;
  }
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

async function getAcpCommercialUsers() {
  const { rows } = await db.query(
    `SELECT id, email, fullname, name
       FROM users
      WHERE lower(role) = 'acp_comercial'
      ORDER BY fullname NULLS LAST, email ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.fullname || row.name || row.email,
  }));
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

async function listByUser(user) {
  await ensureTables();
  const params = [];
  let query = `SELECT * FROM equipment_purchase_requests`;

  if (!canManageAll(user)) {
    query += ` WHERE created_by = $1 OR assigned_to = $1`;
    params.push(user.id);
  }

  query += ` ORDER BY created_at DESC`;

  const { rows } = await db.query(query, params);
  return rows.map(mapRequestRow);
}

async function getById(id, user) {
  await ensureTables();
  const { rows } = await db.query(`SELECT * FROM equipment_purchase_requests WHERE id = $1 LIMIT 1`, [id]);
  const row = rows[0];
  const isCreator = row?.created_by === user?.id;
  const isAssignee = row?.assigned_to === user?.id;
  if (!row || (!isCreator && !isAssignee && !canManageAll(user))) return null;
  return mapRequestRow(row);
}

async function getUserById(id) {
  if (!id) return null;
  try {
    const { rows } = await db.query(
      `SELECT id, email, fullname, name, role
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  } catch (error) {
    logger.warn("No se pudo obtener datos de usuario %s: %s", id, error.message);
    return null;
  }
}

async function createPurchaseRequest({
  user,
  clientId,
  clientName,
  clientEmail,
  providerEmail,
  assignedTo,
  equipment = [],
  notes,
  extra,
}) {
  await ensureTables();
  if (!clientName || !equipment.length) {
    throw new Error("Cliente y al menos un equipo son obligatorios");
  }

  const canSendAvailability = canManageAll(user);
  const provider = canSendAvailability ? providerEmail : null;

  const assigneeUser = assignedTo ? await getUserById(assignedTo) : null;
  const resolvedAssignee = assigneeUser || (canSendAvailability ? user : null);

  if (!resolvedAssignee) {
    throw new Error("Debes asignar la solicitud a un ACP Comercial");
  }

  const id = uuidv4();
  const createdAt = new Date();
  const folderId = await ensureRequestFolder(clientName, id, createdAt);

  const extraPayload = {
    ...(extra || {}),
    requires_lis: Boolean(extra?.requires_lis),
    lis_system: extra?.requires_lis ? (extra?.lis_system || null) : null,
  };

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
    provider_email: provider,
    equipment,
    created_at: createdAt,
    notes,
  };

  let emailFileId = null;
  let status = STATUS.PENDING_PROVIDER;

  if (provider) {
    emailFileId = await sendAndArchive({
      user,
      to: provider,
      subject: `Disponibilidad de equipos - ${clientName}`,
      html,
      folderId,
      prefix: "disponibilidad",
      request: requestSnapshot,
      actionLabel: "Informe de disponibilidad de equipos",
    });
    status = STATUS.WAITING_PROVIDER;
  }

  const { rows } = await db.query(
    `INSERT INTO equipment_purchase_requests (
        id, created_by, created_by_email, assigned_to, assigned_to_email, assigned_to_name,
        client_id, client_name, client_email, notes, provider_email,
        equipment, status, availability_email_sent_at, availability_email_file_id, drive_folder_id, extra
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      id,
      user.id,
      user.email,
      resolvedAssignee?.id || null,
      resolvedAssignee?.email || null,
      resolvedAssignee?.fullname || resolvedAssignee?.name || resolvedAssignee?.email || null,
      clientId || null,
      clientName,
      clientEmail || null,
      notes || null,
      provider,
      JSON.stringify(equipment),
      status,
      provider ? new Date() : null,
      emailFileId,
      folderId,
      JSON.stringify(extraPayload || {}),
    ],
  );

  return mapRequestRow(rows[0]);
}

async function startAvailabilityRequest({ id, user, providerEmail, notes }) {
  await ensureTables();
  if (!canManageAll(user)) {
    throw new Error("Solo el ACP Comercial puede enviar el correo de disponibilidad");
  }
  const request = await getById(id, user);
  if (!request) throw new Error("Solicitud no encontrada o sin acceso");
  if (!providerEmail) throw new Error("El correo del proveedor es obligatorio");
  if (request.status !== STATUS.PENDING_PROVIDER) {
    throw new Error("La solicitud ya tiene proveedor asignado o está en curso");
  }

  const equipment = Array.isArray(request.equipment) ? request.equipment : [];
  if (!equipment.length) throw new Error("No hay equipos registrados para solicitar disponibilidad");

  const equipmentList = equipment
    .map((item) => {
      const typeLabel = item.type === "cu" ? " (CU)" : " (Nuevo)";
      return `• ${item.name || item.sku || item.id}${item.serial ? ` (Serie: ${item.serial})` : ""}${typeLabel}`;
    })
    .join("<br>");

  const html = `
    <h2>Solicitud de disponibilidad</h2>
    <p>Cliente: <strong>${request.client_name}</strong></p>
    <p>Equipos requeridos:</p>
    <p>${equipmentList}</p>
    ${notes ? `<p>Notas: ${notes}</p>` : request.notes ? `<p>Notas: ${request.notes}</p>` : ""}
  `;

  const requestSnapshot = {
    id: request.id,
    client_name: request.client_name,
    provider_email: providerEmail,
    equipment,
    created_at: request.created_at,
    notes: notes || request.notes,
  };

  const emailFileId = await sendAndArchive({
    user,
    to: providerEmail,
    subject: `Disponibilidad de equipos - ${request.client_name}`,
    html,
    folderId: request.drive_folder_id,
    prefix: "disponibilidad",
    request: requestSnapshot,
    actionLabel: "Informe de disponibilidad de equipos",
  });

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET provider_email = $1,
            notes = $2,
            status = $3,
            availability_email_sent_at = now(),
            availability_email_file_id = $4,
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [providerEmail, notes || request.notes || null, STATUS.WAITING_PROVIDER, emailFileId, id],
  );

  return mapRequestRow(rows[0]);
}

async function saveProviderResponse({ id, user, outcome, items = [], notes }) {
  await ensureTables();
  const request = await getById(id, user);
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
      WHERE id = $3
      RETURNING *`,
    [
      { outcome, items, notes },
      normalizedOutcome,
      id,
    ],
  );
  return rows[0];
}

async function requestProforma({ id, user }) {
  await ensureTables();
  const request = await getById(id, user);
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
      WHERE id = $3
      RETURNING *`,
    [STATUS.WAITING_PROFORMA, emailFileId, id],
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
  const request = await getById(id, user);
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
      WHERE id = $3
      RETURNING *`,
    [fileId, STATUS.PROFORMA_RECEIVED, id],
  );
  const updated = mapRequestRow(rows[0]);

  try {
    const clientInfo = await getClientDetails(request.client_id);
    await ensureBusinessCaseDocument({ request: updated, clientInfo, user });
  } catch (error) {
    logger.warn("No se pudo crear Business Case tras proforma: %s", error.message);
  }

  return updated;
}

async function reserveEquipment({ id, user }) {
  await ensureTables();
  const request = await getById(id, user);
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
      WHERE id = $5
      RETURNING *`,
    [
      STATUS.WAITING_SIGNED_PROFORMA,
      emailFileId,
      calendarEvent.id || null,
      calendarEvent.htmlLink || null,
      id,
    ],
  );
  return rows[0];
}

async function uploadSignedProforma({ id, user, file, inspection_min_date, inspection_max_date, includes_starter_kit }) {
  await ensureTables();
  const request = await getById(id, user);
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
      WHERE id = $9
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

  const request = await getById(id, user);
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
  const request = await getById(id, user);
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
      WHERE id = $3
      RETURNING *`,
    [fileId, STATUS.COMPLETED, id],
  );
  return rows[0];
}

async function updateBusinessCaseFields({ id, user, fields }) {
  await ensureTables();
  const request = await getById(id, user);
  if (!request) throw new Error("Solicitud no encontrada o sin acceso");

  const clientInfo = await getClientDetails(request.client_id);
  const ensured = await ensureBusinessCaseDocument({ request, clientInfo, user });
  if (!ensured?.bc_spreadsheet_id) {
    throw new Error("No se pudo inicializar el Business Case para esta solicitud");
  }

  const role = normalizeRole(user.role);
  const baseAllowed = new Set([
    "comercial",
    "acp_comercial",
    "gerencia",
    "jefe_comercial",
    "jefe_tecnico",
    "jefe_operaciones",
  ]);

  if (!baseAllowed.has(role)) {
    throw new Error("No tienes permisos para editar el Business Case");
  }

  const commercialFields = new Set(Object.keys(buildBusinessCasePrefill({ request, clientInfo })));
  const gerenciaFields = new Set([
    "Cobro de arriendo de equipamento",
    "Compromiso de compra",
  ]);
  const acpFields = new Set([
    "Presupuesto Referencial de proceso",
    "Observaciones",
  ]);

  let allowedLabels = new Set();
  if (role === "gerencia") allowedLabels = new Set([...commercialFields, ...gerenciaFields]);
  else if (role === "acp_comercial" || role === "jefe_comercial") allowedLabels = new Set([...commercialFields, ...acpFields]);
  else if (role === "jefe_operaciones") {
    allowedLabels = new Set([
      ...commercialFields,
      ...gerenciaFields,
      ...acpFields,
      "Observaciones de Jefe de Operaciones",
    ]);
  } else {
    allowedLabels = commercialFields;
  }

  const filtered = Object.fromEntries(
    Object.entries(fields || {}).filter(([label]) => allowedLabels.has(label)),
  );

  await updateSheetByLabel({ spreadsheetId: ensured.bc_spreadsheet_id, updates: filtered });
  return { ...ensured, bc_updates: filtered };
}

async function addBusinessCaseItem({ id, user, item }) {
  await ensureTables();
  const request = await getById(id, user);
  if (!request) throw new Error("Solicitud no encontrada o sin acceso");

  const clientInfo = await getClientDetails(request.client_id);
  const ensured = await ensureBusinessCaseDocument({ request, clientInfo, user });

  const role = normalizeRole(user.role);
  const canEditPrice = role === "jefe_operaciones";
  const allowedRoles = new Set([
    "comercial",
    "acp_comercial",
    "jefe_tecnico",
    "jefe_operaciones",
    "jefe_comercial",
    "gerencia",
  ]);

  if (!allowedRoles.has(role)) {
    throw new Error("No tienes permisos para registrar inversiones adicionales");
  }

  const sanitizedItem = {
    name: item?.name || item?.concepto || "Concepto",
    characteristics: item?.characteristics || item?.descripcion || "",
    status: item?.status || "",
    quantity: item?.quantity ?? null,
    price: canEditPrice ? item?.price ?? null : null,
    total: canEditPrice ? item?.total ?? null : null,
  };

  const { rows } = await db.query(
    `INSERT INTO equipment_purchase_bc_items (id, request_id, name, characteristics, status, quantity, price, total, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
    [
      uuidv4(),
      id,
      sanitizedItem.name,
      sanitizedItem.characteristics,
      sanitizedItem.status,
      sanitizedItem.quantity,
      sanitizedItem.price,
      sanitizedItem.total,
      user.id,
    ],
  );

  const items = await listBusinessCaseItems({ id, user });
  if (ensured.bc_spreadsheet_id) {
    await syncBusinessCaseItemsToSheet({ spreadsheetId: ensured.bc_spreadsheet_id, items });
  }

  return rows[0];
}

async function listBusinessCaseItems({ id, user }) {
  await ensureTables();
  const request = await getById(id, user);
  if (!request) throw new Error("Solicitud no encontrada o sin acceso");

  const { rows } = await db.query(
    `SELECT * FROM equipment_purchase_bc_items WHERE request_id = $1 ORDER BY created_at ASC`,
    [id],
  );
  return rows;
}

module.exports = {
  getApprovedClients,
  getAcpCommercialUsers,
  getEquipmentCatalog,
  listByUser,
  getById,
  createPurchaseRequest,
  startAvailabilityRequest,
  saveProviderResponse,
  requestProforma,
  uploadProforma,
  reserveEquipment,
  uploadSignedProforma,
  submitSignedProformaWithInspection,
  uploadContract,
  updateBusinessCaseFields,
  addBusinessCaseItem,
  listBusinessCaseItems,
  STATUS,
};
