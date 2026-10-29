const db = require("../../config/db");
const logger = require("../../config/logger");
const notificationManager = require("../notifications/notificationManager");
const { computeSha256HexFromBuffer } = require("../../utils/documentHash");
const {
  ensureFolder,
  uploadBase64File,
  copyTemplate,
  replaceTags,
  updateDocsTextStyleByLiteral,
  insertDocsTableRows,
  exportPdfBuffer,
  downloadFileBuffer,
  deleteFile,
} = require("../../utils/drive");
const signatureWorkflowsService = require("../signature-workflows/signatureWorkflows.service");
const { resolveSignerSnapshot, resolveRecipientOrThrow } = signatureWorkflowsService;
const { validateCreateWorkflowPayload } = require("../signature-workflows/signatureWorkflows.validation");

// ── Roles ────────────────────────────────────────────────────────────────────
const COLLAB_WRITE_ROLES = ["financiero", "jefe_financiero"];
const COLLAB_SESSION_ROLES = [...COLLAB_WRITE_ROLES, "talento_humano", "jefe_tecnico", "jefe_servicio"];
const COLLAB_CATALOG_WRITE_ROLES = [...COLLAB_WRITE_ROLES, "talento_humano"];
const COLLAB_READ_ROLES  = [
  ...COLLAB_SESSION_ROLES,
  "gerencia_general", "gerencia",
  "ti", "jefe_ti", "admin_ti",
];

// Mapa de permisos: quién puede crear sesiones por categoría y tipo
const CATEGORY_TIPO_ROLES = {
  ropa:        { entrega: ["talento_humano"], retiro: ["talento_humano"] },
  epp:         { entrega: ["talento_humano"], retiro: ["talento_humano"] },
  herramienta: { entrega: ["talento_humano","jefe_tecnico","jefe_servicio"], retiro: ["talento_humano","jefe_tecnico","jefe_servicio"] },
  logistica:   { entrega: ["financiero","jefe_financiero"], retiro: ["financiero","jefe_financiero"] },
  suministros: { entrega: ["financiero","jefe_financiero","talento_humano"], retiro: ["financiero","jefe_financiero","talento_humano"] },
  poliza:      { entrega: ["talento_humano"] },
};

const ALLOWED_STATUSES = new Set(["entregado", "retirado", "perdido", "dañado"]);
const ALLOWED_CATEGORIES = new Set(["ropa", "epp", "herramienta", "logistica", "suministros", "poliza"]);
const COLLAB_ACTA_HERRAMIENTA_TEMPLATE_ID = process.env.COLLAB_ACTA_HERRAMIENTA_TEMPLATE_ID || null;
// Herramientas tiene dos plantillas (mismas variables, distinto formato) --
// personal interno vs externo. Si las variantes no estan configuradas cae al
// template generico de herramienta para no romper actas ya en uso.
const COLLAB_ACTA_HERRAMIENTA_INT_TEMPLATE_ID = process.env.COLLAB_ACTA_HERRAMIENTA_INT_TEMPLATE_ID || COLLAB_ACTA_HERRAMIENTA_TEMPLATE_ID;
const COLLAB_ACTA_HERRAMIENTA_EXT_TEMPLATE_ID = process.env.COLLAB_ACTA_HERRAMIENTA_EXT_TEMPLATE_ID || COLLAB_ACTA_HERRAMIENTA_TEMPLATE_ID;
const COLLAB_ACTA_ROPA_TEMPLATE_ID        = process.env.COLLAB_ACTA_ROPA_TEMPLATE_ID        || null;
// Ropa, igual que herramienta, tiene variante interno/externo. Si no estan
// configuradas cae al template generico de ropa para no romper actas ya en uso.
const COLLAB_ACTA_ROPA_INT_TEMPLATE_ID    = process.env.COLLAB_ACTA_ROPA_INT_TEMPLATE_ID    || COLLAB_ACTA_ROPA_TEMPLATE_ID;
const COLLAB_ACTA_ROPA_EXT_TEMPLATE_ID    = process.env.COLLAB_ACTA_ROPA_EXT_TEMPLATE_ID    || COLLAB_ACTA_ROPA_TEMPLATE_ID;
const COLLAB_ACTA_EPP_TEMPLATE_ID         = process.env.COLLAB_ACTA_EPP_TEMPLATE_ID         || null;
const COLLAB_ACTA_POLIZA_INT_TEMPLATE_ID  = process.env.COLLAB_ACTA_POLIZA_INT_TEMPLATE_ID  || "1YMTwTDXY5myxJPbNwBKamEGjqMiptjhduYlwJVPI0cM";
const COLLAB_ACTA_POLIZA_EXT_TEMPLATE_ID  = process.env.COLLAB_ACTA_POLIZA_EXT_TEMPLATE_ID  || "1J17iJ49_EV7VEQ-3-g2-bCBL7J2uyBAXQIcIBKIisa0";
const ACTA_CODE_PREFIX_BY_CATEGORY = {
  herramienta: "ACTA-COL",
  ropa: "ACTA-ROPA",
  epp: "ACTA-EPP",
  logistica: "ACTA-LOG",
  suministros: "ACTA-SUM",
  poliza: "ACTA-POLIZA",
  ti: "ACTA-TI",
};

// Verificación de arranque: muestra en log si los template IDs están configurados
logger.info({
  COLLAB_ACTA_HERRAMIENTA_INT_TEMPLATE_ID: COLLAB_ACTA_HERRAMIENTA_INT_TEMPLATE_ID ? "✓ configurado" : "✗ NO configurado",
  COLLAB_ACTA_HERRAMIENTA_EXT_TEMPLATE_ID: COLLAB_ACTA_HERRAMIENTA_EXT_TEMPLATE_ID ? "✓ configurado" : "✗ NO configurado",
  COLLAB_ACTA_ROPA_INT_TEMPLATE_ID:    COLLAB_ACTA_ROPA_INT_TEMPLATE_ID    ? "✓ configurado" : "✗ NO configurado",
  COLLAB_ACTA_ROPA_EXT_TEMPLATE_ID:    COLLAB_ACTA_ROPA_EXT_TEMPLATE_ID    ? "✓ configurado" : "✗ NO configurado",
  COLLAB_ACTA_POLIZA_INT_TEMPLATE_ID:  COLLAB_ACTA_POLIZA_INT_TEMPLATE_ID  ? "✓ configurado" : "✗ NO configurado",
  COLLAB_ACTA_POLIZA_EXT_TEMPLATE_ID:  COLLAB_ACTA_POLIZA_EXT_TEMPLATE_ID  ? "✓ configurado" : "✗ NO configurado",
}, "collab-deliveries: estado de plantillas Google Docs");

const normalizeActaCategory = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (["herramienta", "herramientas", "herramienta_trabajo", "herramientas_trabajo"].includes(normalized)) return "herramienta";
  if (["ropa", "uniforme", "uniformes", "ropa_trabajo", "uniformes_trabajo"].includes(normalized)) return "ropa";
  return normalized;
};

const getMonthNameEs = (monthNum) => {
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const idx = Number(monthNum) - 1;
  return idx >= 0 && idx < 12 ? months[idx] : String(monthNum || "");
};

const parseJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
};

const humanizeAttributeKey = (key) => String(key || "")
  .replace(/^_+/, "")
  .replace(/_/g, " ")
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

// pg devuelve columnas DATE como objetos Date de JS a medianoche UTC -- leer
// con getDate()/getMonth() (hora local del servidor) puede correr el dia si
// el servidor esta en un huso horario negativo (America/Guayaquil = UTC-5).
// Acepta tanto un Date como un string "YYYY-MM-DD".
const _dateKeyParts = (value, fallback = new Date()) => {
  if (!value) {
    return { day: fallback.getUTCDate(), month: fallback.getUTCMonth() + 1, year: fallback.getUTCFullYear() };
  }
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return { day: Number(match[3]), month: Number(match[2]), year: Number(match[1]) };
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { day: fallback.getUTCDate(), month: fallback.getUTCMonth() + 1, year: fallback.getUTCFullYear() };
  }
  return { day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
};

const formatAttributesSummary = (rawValue) => {
  const attrs = parseJsonObject(rawValue);
  return Object.entries(attrs)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([key, value]) => `${humanizeAttributeKey(key)}: ${String(value).trim()}`)
    .join(" | ");
};

// ─── Google Docs table cell builders ─────────────────────────────────────────
// Columns: Cant | Herramienta | Marca | N° de serie | Condición (Nuevo/Usado) | Características
// "Cant" reemplazo al numero de fila (No.) -- si se entrega mas de 1 unidad
// del mismo item no hace falta agregarlo varias veces, solo subir la cantidad.
const _collabHerramientaCellValues = (item) => {
  const a = parseJsonObject(item.attributes_summary);
  return [
    a.cantidad != null && String(a.cantidad).trim() !== "" ? String(a.cantidad) : "1",
    item.name || "",
    a.marca || "",
    item.serial_number || "",
    item.is_new === true ? "Nuevo" : item.is_new === false ? "Usado" : "",
    a.caracteristicas || "",
  ];
};

// Columns: Prenda | Cantidad | Marca/Modelo | Talla | Estado
const _collabRopaCellValues = (item) => {
  const a = parseJsonObject(item.attributes_summary);
  return [
    item.name || "",
    a.cantidad != null ? String(a.cantidad) : "",
    a.marca || "",
    a.talla || "",
    item.is_new === true ? "Nuevo" : item.is_new === false ? "Usado" : "",
  ];
};

// Columns: No. | EPP | Marca | Referencia/Modelo | Talla | Norma/Certificacion | Serie | Condicion
const _collabEppCellValues = (item, i) => {
  const a = parseJsonObject(item.attributes_summary);
  return [
    String(i + 1),
    item.name || "",
    a.marca || "",
    a.referencia || "",
    a.talla || "",
    a.norma_certificacion || "",
    item.serial_number || "",
    item.physical_condition != null ? `${item.physical_condition}/10` : "",
  ];
};

const _collabPolizaCellValues = (item) => {
  const a = parseJsonObject(item.attributes_summary);
  return [
    a.tipo_seguro || item.name || "",
    a.aseguradora || "",
    a.numero_poliza || "",
    a.vigencia || "",
    a.monto_asegurado || "",
  ];
};

const buildActaItemsBlock = (items = []) => items.map((item, index) => {
  const lines = [`${index + 1}. ${item.name || "Item sin nombre"}`];
  const attrs = formatAttributesSummary(item.attributes_summary);
  if (attrs) lines.push(`   Detalle: ${attrs}`);
  if (item.serial_number) lines.push(`   Serie: ${item.serial_number}`);
  if (item.physical_condition != null) lines.push(`   Condición: ${item.physical_condition}/10`);
  return lines.join("\n");
}).join("\n\n");

async function _resolveCollabActaFolderId() {
  const configuredFolderId = process.env.GDRIVE_FOLDER_ACTAS_COLLAB || null;
  const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_FOLDER_ID || null;

  if (configuredFolderId) return configuredFolderId;
  if (!rootFolderId) return null;

  const folder = await ensureFolder("Actas Colaboradores", rootFolderId);
  return folder?.id || rootFolderId;
}

const _SURNAME_PARTICLES = new Set(["de", "del", "la", "el", "los", "las", "van", "von", "le", "y"]);

function _trimLastSurname(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length < 3) return String(fullName).trim();
  // Retroceder desde el final incluyendo partículas del apellido compuesto
  let start = parts.length - 1;
  while (start > 1 && _SURNAME_PARTICLES.has(parts[start - 1].toLowerCase())) {
    start--;
  }
  return parts.slice(0, start).join(" ");
}

function _buildActaTemplateReplacements(acta) {
  const actaDay = acta.acta_day || new Date().getDate();
  const actaMonth = acta.acta_month || (new Date().getMonth() + 1);
  const actaYear = acta.acta_year || new Date().getFullYear();
  return {
    ACTA_CODE: (String(acta.acta_code || "").match(/(\d+)$/) || [])[1] || acta.acta_code || "",
    NOMBRE: acta.recipient_nombre || "",
    NOMBRE_C: _trimLastSurname(acta.recipient_nombre),
    CEDULA: acta.recipient_cedula || "",
    CARGO: acta.recipient_cargo || "",
    ACTA_DIA: String(actaDay).padStart(2, "0"),
    ACTA_MES: getMonthNameEs(actaMonth),
    ACTA_ANIO: String(actaYear),
    ACTA_FECHA_LARGA: `${String(actaDay).padStart(2, "0")} de ${getMonthNameEs(actaMonth)} de ${actaYear}`,
    NOTES: acta.notes || "",
    OBSERVACIONES: acta.notes || "",
    ITEMS_COUNT: String(Array.isArray(acta.items) ? acta.items.length : 0),
    ITEMS_BLOCK: buildActaItemsBlock(acta.items || []),
  };
}

const validateSessionRole = (category, tipo, actorRole) => {
  const allowedRoles = (CATEGORY_TIPO_ROLES[category] || {})[tipo] || COLLAB_WRITE_ROLES;
  if (actorRole && !allowedRoles.includes(actorRole)) {
    throw Object.assign(new Error(`Tu rol no tiene permiso para ${tipo} de ${category}`), { status: 403 });
  }
};

async function _resolveSessionCatalogItem(client, item, category) {
  const { rows: catRows } = await client.query(
    `SELECT * FROM collab_item_catalog WHERE id = $1 AND active = true AND category = $2`,
    [item.catalog_item_id, category],
  );
  if (!catRows.length) {
    throw Object.assign(new Error(`Ítem ${item.catalog_item_id} no encontrado en categoría ${category}`), { status: 400 });
  }
  const cat = catRows[0];
  if (cat.requires_serial && !item.serial_number?.trim()) {
    throw Object.assign(new Error(`${cat.name} requiere número de serie`), { status: 400 });
  }
  return cat;
}

function _validatePolicyAttributes(attributes) {
  const source = attributes && typeof attributes === "object" ? attributes : {};
  const required = ["tipo_seguro", "aseguradora", "numero_poliza", "vigencia", "monto_asegurado"];
  const missing = required.filter((key) => !String(source[key] || "").trim());
  if (missing.length) {
    throw Object.assign(new Error(`La póliza requiere: ${missing.join(", ")}`), { status: 400 });
  }
  if (!new Set(["Salud", "Vida", "Salud y Vida"]).has(String(source.tipo_seguro).trim())) {
    throw Object.assign(new Error("tipo_seguro inválido"), { status: 400 });
  }
}

async function _insertSessionDeliveries({
  client,
  session,
  userId,
  category,
  tipo,
  items,
  actorId,
}) {
  const deliveries = [];

  for (const item of items) {
    const cat = await _resolveSessionCatalogItem(client, item, category);
    if (category === "poliza" && tipo === "entrega") _validatePolicyAttributes(item.attributes);
    const status = tipo === "entrega" ? "entregado" : "retirado";
    const attrs = item.attributes && typeof item.attributes === "object"
      ? JSON.stringify(item.attributes)
      : (item.attributes || "{}");

    const { rows: [delivery] } = await client.query(
      `INSERT INTO collab_deliveries
        (catalog_item_id, user_id, status, serial_number, physical_condition, attributes,
         observations, delivery_date, renewal_date, renewal_notes, delivered_by, created_by, session_id)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$11,$12) RETURNING *`,
      [
        cat.id,
        userId,
        status,
        item.serial_number || null,
        item.physical_condition || null,
        attrs,
        item.observations || null,
        session.session_date,
        item.renewal_date || null,
        item.renewal_notes || null,
        actorId,
        session.id,
      ],
    );

    // is_new no vive en collab_deliveries (solo en collab_delivery_actas_items),
    // se pasa en memoria para el insert del acta que sigue mas abajo.
    deliveries.push({ ...delivery, item_name: cat.name, is_new: item.is_new });

    await client.query(
      `INSERT INTO collab_delivery_events (delivery_id, event_type, payload, created_by)
       VALUES ($1,'created',$2::jsonb,$3)`,
      [delivery.id, JSON.stringify({ from_session: session.id, item_name: cat.name }), actorId],
    );

    if (item.renewal_date) {
      await client.query(
        `INSERT INTO collab_renewal_schedule (delivery_id, scheduled_date, created_by)
         VALUES ($1,$2,$3)`,
        [delivery.id, item.renewal_date, actorId],
      );
    }
  }

  return deliveries;
}

// ── Catálogo ─────────────────────────────────────────────────────────────────

async function listCatalog({ category, includeInactive = false } = {}) {
  let q = `SELECT * FROM collab_item_catalog WHERE 1=1`;
  const params = [];
  if (!includeInactive) { q += ` AND active = true`; }
  if (category) { params.push(category); q += ` AND category = $${params.length}`; }
  q += ` ORDER BY category, name`;
  const { rows } = await db.query(q, params);
  return rows;
}

async function createCatalogItem({ category, name, description, requires_serial, requires_condition, attribute_schema }, actorId) {
  if (!ALLOWED_CATEGORIES.has(category)) throw Object.assign(new Error("Categoría inválida"), { status: 400 });
  if (!name?.trim()) throw Object.assign(new Error("El nombre es requerido"), { status: 400 });
  const { rows } = await db.query(
    `INSERT INTO collab_item_catalog
      (category, name, description, requires_serial, requires_condition, attribute_schema, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [category, name.trim(), description || null, !!requires_serial, !!requires_condition, attribute_schema || {}, actorId],
  );
  return rows[0];
}

async function updateCatalogItem(id, { name, description, requires_serial, requires_condition, attribute_schema, active }) {
  const { rows } = await db.query(
    `UPDATE collab_item_catalog SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       requires_serial = COALESCE($4, requires_serial),
       requires_condition = COALESCE($5, requires_condition),
       attribute_schema = COALESCE($6, attribute_schema),
       active = COALESCE($7, active),
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, name || null, description || null, requires_serial ?? null, requires_condition ?? null,
     attribute_schema || null, active ?? null],
  );
  if (!rows.length) throw Object.assign(new Error("Ítem no encontrado"), { status: 404 });
  return rows[0];
}

// ── Entregas ─────────────────────────────────────────────────────────────────

async function listDeliveries({ userId, category, status, renewalDueDays, page = 1, limit = 50 } = {}) {
  const params = [];
  let where = `WHERE cd.active = true`;

  if (userId) { params.push(userId); where += ` AND cd.user_id = $${params.length}`; }
  if (category) { params.push(category); where += ` AND ci.category = $${params.length}`; }
  if (status) { params.push(status); where += ` AND cd.status = $${params.length}`; }
  if (renewalDueDays != null) {
    params.push(parseInt(renewalDueDays, 10));
    where += ` AND cd.renewal_date IS NOT NULL AND cd.renewal_date <= (CURRENT_DATE + ($${params.length} || ' days')::interval) AND cd.status = 'entregado'`;
  }

  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT
       cd.*,
       ci.category, ci.name AS item_name, ci.requires_serial, ci.requires_condition,
       u.fullname AS collaborator_name, u.email AS collaborator_email,
       db.fullname AS delivered_by_name, wb.fullname AS withdrawn_by_name,
       (SELECT COUNT(*) FROM collab_delivery_actas a WHERE a.delivery_id = cd.id AND a.active = true) AS actas_count,
       (SELECT COUNT(*) FROM collab_delivery_actas a WHERE a.delivery_id = cd.id AND a.is_complete = false AND a.active = true) AS actas_pending_signature
     FROM collab_deliveries cd
     JOIN collab_item_catalog ci ON ci.id = cd.catalog_item_id
     JOIN users u ON u.id = cd.user_id
     LEFT JOIN users db ON db.id = cd.delivered_by
     LEFT JOIN users wb ON wb.id = cd.withdrawn_by
     ${where}
     ORDER BY cd.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

async function listDeliveriesByUser(userId) {
  const { rows } = await db.query(
    `SELECT
       cd.*,
       ci.category, ci.name AS item_name, ci.requires_serial, ci.requires_condition,
       db.fullname AS delivered_by_name,
       (SELECT COUNT(*) FROM collab_delivery_actas a WHERE a.delivery_id = cd.id AND a.active = true) AS actas_count
     FROM collab_deliveries cd
     JOIN collab_item_catalog ci ON ci.id = cd.catalog_item_id
     LEFT JOIN users db ON db.id = cd.delivered_by
     WHERE cd.user_id = $1 AND cd.active = true
     ORDER BY ci.category, cd.delivery_date DESC`,
    [userId],
  );
  return rows;
}

async function getDelivery(id) {
  const { rows } = await db.query(
    `SELECT
       cd.*,
       ci.category, ci.name AS item_name, ci.requires_serial, ci.requires_condition, ci.attribute_schema,
       u.fullname AS collaborator_name, u.email AS collaborator_email,
       db.fullname AS delivered_by_name, wb.fullname AS withdrawn_by_name,
       cb.fullname AS created_by_name
     FROM collab_deliveries cd
     JOIN collab_item_catalog ci ON ci.id = cd.catalog_item_id
     JOIN users u ON u.id = cd.user_id
     LEFT JOIN users db ON db.id = cd.delivered_by
     LEFT JOIN users wb ON wb.id = cd.withdrawn_by
     LEFT JOIN users cb ON cb.id = cd.created_by
     WHERE cd.id = $1`,
    [id],
  );
  if (!rows.length) throw Object.assign(new Error("Entrega no encontrada"), { status: 404 });
  return rows[0];
}

async function createDelivery({
  catalog_item_id, user_id, serial_number, physical_condition,
  attributes, observations, delivery_date, renewal_date, renewal_notes,
}, actorId) {
  const item = await db.query(`SELECT * FROM collab_item_catalog WHERE id = $1 AND active = true`, [catalog_item_id]);
  if (!item.rows.length) throw Object.assign(new Error("Ítem de catálogo no encontrado"), { status: 404 });
  const catalogItem = item.rows[0];

  if (catalogItem.requires_serial && !serial_number?.trim()) {
    throw Object.assign(new Error(`Este ítem requiere número de serie`), { status: 400 });
  }

  const { rows } = await db.query(
    `INSERT INTO collab_deliveries
      (catalog_item_id, user_id, status, serial_number, physical_condition, attributes,
       observations, delivery_date, renewal_date, renewal_notes, delivered_by, created_by)
     VALUES ($1,$2,'entregado',$3,$4,$5,$6,$7,$8,$9,$10,$10)
     RETURNING *`,
    [catalog_item_id, user_id, serial_number || null, physical_condition || null,
     attributes || {}, observations || null,
     delivery_date, renewal_date || null, renewal_notes || null, actorId],
  );
  const delivery = rows[0];

  await _logEvent(delivery.id, "created", {
    catalog_item_id, item_name: catalogItem.name, category: catalogItem.category,
    delivery_date, renewal_date,
  }, actorId);

  if (renewal_date) {
    await db.query(
      `INSERT INTO collab_renewal_schedule (delivery_id, scheduled_date, created_by)
       VALUES ($1, $2, $3)`,
      [delivery.id, renewal_date, actorId],
    );
  }

  if (catalogItem.category !== "suministros") {
    const acta = await generateActa(delivery.id, { tipo: "entrega", notes: observations || null }, actorId);
    return { ...delivery, acta_id: acta.id, acta_code: acta.acta_code };
  }

  return delivery;
}

async function updateDelivery(id, { observations, renewal_date, renewal_notes, attributes }, actorId) {
  const existing = await getDelivery(id);
  if (existing.status !== "entregado") throw Object.assign(new Error("Solo se pueden editar entregas activas"), { status: 400 });

  const { rows } = await db.query(
    `UPDATE collab_deliveries SET
       observations = COALESCE($2, observations),
       renewal_date = COALESCE($3, renewal_date),
       renewal_notes = COALESCE($4, renewal_notes),
       attributes = COALESCE($5, attributes),
       updated_by = $6,
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, observations || null, renewal_date || null, renewal_notes || null, attributes || null, actorId],
  );

  if (renewal_date && renewal_date !== existing.renewal_date) {
    await db.query(
      `UPDATE collab_renewal_schedule SET status = 'cancelled', updated_at = now()
       WHERE delivery_id = $1 AND status = 'pending'`,
      [id],
    );
    await db.query(
      `INSERT INTO collab_renewal_schedule (delivery_id, scheduled_date, created_by)
       VALUES ($1, $2, $3)`,
      [id, renewal_date, actorId],
    );
    await _logEvent(id, "renewal_updated", { old: existing.renewal_date, new: renewal_date }, actorId);
  }

  return rows[0];
}

async function withdrawDelivery(id, { withdrawal_date, observations }, actorId) {
  const existing = await getDelivery(id);
  if (existing.status !== "entregado") throw Object.assign(new Error("La entrega ya fue retirada o no está activa"), { status: 400 });

  const { rows } = await db.query(
    `UPDATE collab_deliveries SET
       status = 'retirado',
       withdrawal_date = $2,
       observations = COALESCE($3, observations),
       withdrawn_by = $4,
       updated_by = $4,
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, withdrawal_date || new Date().toISOString().slice(0, 10), observations || null, actorId],
  );

  await _logEvent(id, "withdrawn", { withdrawal_date, withdrawn_by: actorId }, actorId);

  await db.query(
    `UPDATE collab_renewal_schedule SET status = 'cancelled', updated_at = now()
     WHERE delivery_id = $1 AND status = 'pending'`,
    [id],
  );

  await _checkAndCompleteOffboardingTask(existing.user_id, existing.category, actorId);

  return rows[0];
}

// ── Actas ────────────────────────────────────────────────────────────────────

async function listActasByDelivery(deliveryId) {
  const { rows } = await db.query(
    `SELECT a.*, gb.fullname AS generated_by_name, sb.fullname AS signed_by_name
     FROM collab_delivery_actas a
     LEFT JOIN users gb ON gb.id = a.generated_by
     LEFT JOIN users sb ON sb.id = a.signed_by
     WHERE a.delivery_id = $1 AND a.active = true
     ORDER BY a.generated_at DESC`,
    [deliveryId],
  );
  return rows;
}

async function getActa(actaId) {
  const { rows } = await db.query(
    `SELECT a.*, gb.fullname AS generated_by_name
     FROM collab_delivery_actas a
     LEFT JOIN users gb ON gb.id = a.generated_by
     WHERE a.id = $1`,
    [actaId],
  );
  if (!rows.length) throw Object.assign(new Error("Acta no encontrada"), { status: 404 });
  return rows[0];
}

async function getActaWithItems(actaId) {
  const { rows: actaRows } = await db.query(
    `SELECT
       a.*,
       gb.fullname AS generated_by_name,
       dci.category AS delivery_category,
       s.category AS session_category,
       COALESCE(a.category, dci.category, s.category) AS resolved_category
     FROM collab_delivery_actas a
     LEFT JOIN collab_deliveries d ON d.id = a.delivery_id
     LEFT JOIN collab_item_catalog dci ON dci.id = d.catalog_item_id
     LEFT JOIN collab_delivery_sessions s ON s.id = a.session_id
     LEFT JOIN users gb ON gb.id = a.generated_by
     WHERE a.id = $1`,
    [actaId],
  );
  if (!actaRows.length) throw Object.assign(new Error("Acta no encontrada"), { status: 404 });
  const { rows: items } = await db.query(
    `SELECT * FROM collab_delivery_actas_items WHERE acta_id = $1 ORDER BY order_num ASC`,
    [actaId],
  );
  return { ...actaRows[0], items };
}

async function _updateActaPdfMetadata(actaId, { filename, sha256, driveUrl, driveFileId }) {
  await db.query(
    `UPDATE collab_delivery_actas SET
       pdf_filename = $2,
       pdf_sha256 = $3,
       pdf_drive_url = $4,
       pdf_drive_file_id = $5
     WHERE id = $1`,
    [actaId, filename, sha256, driveUrl || null, driveFileId || null],
  );
}


async function _buildDriveTemplateActaPdfBuffer(acta) {
  const category = normalizeActaCategory(
    acta.resolved_category || acta.category || acta.items?.[0]?.item_category || acta.items?.[0]?.category,
  );

  const isExterno = String(acta.personnel_type || "").toLowerCase() === "externo";
  const templateId = category === "herramienta"
    ? (isExterno ? COLLAB_ACTA_HERRAMIENTA_EXT_TEMPLATE_ID : COLLAB_ACTA_HERRAMIENTA_INT_TEMPLATE_ID)
    : category === "ropa"
    ? (isExterno ? COLLAB_ACTA_ROPA_EXT_TEMPLATE_ID : COLLAB_ACTA_ROPA_INT_TEMPLATE_ID)
    : category === "epp"         ? COLLAB_ACTA_EPP_TEMPLATE_ID
    : category === "poliza"      ? (isExterno ? COLLAB_ACTA_POLIZA_EXT_TEMPLATE_ID : COLLAB_ACTA_POLIZA_INT_TEMPLATE_ID)
    : null;
  if (!templateId) {
    const err = new Error(`No hay plantilla Google Docs configurada para la categoría "${category}"`);
    err.status = 503;
    throw err;
  }

  const getCellValues = category === "ropa"
    ? _collabRopaCellValues
    : category === "epp"
      ? _collabEppCellValues
      : category === "poliza"
        ? _collabPolizaCellValues
      : _collabHerramientaCellValues;

  const filename = acta.acta_code ? `${acta.acta_code}.pdf` : `ACTA-${String(acta.id).padStart(6, "0")}.pdf`;
  const folderId = await _resolveCollabActaFolderId();
  const sourceName = filename.replace(/\.pdf$/i, "");
  let doc = null;
  const actaCodeText = (String(acta.acta_code || "").match(/(\d+)$/) || [])[1] || acta.acta_code || "";

  try {
    doc = await copyTemplate(templateId, sourceName, folderId || undefined);
    const usedTable = await insertDocsTableRows(doc.id, 0, acta.items || [], getCellValues, {
      textStyle: {
        bold: false,
        weightedFontFamily: { fontFamily: "Times New Roman" },
        fontSize: { magnitude: 10, unit: "PT" },
      },
      textStyleFields: "bold,weightedFontFamily,fontSize",
    });
    const replacements = _buildActaTemplateReplacements(acta);
    if (usedTable) delete replacements.ITEMS_BLOCK;
    await replaceTags(doc.id, replacements);
    if (actaCodeText) {
      await updateDocsTextStyleByLiteral(
        doc.id,
        actaCodeText,
        {
          bold: false,
          weightedFontFamily: { fontFamily: "Times New Roman" },
          fontSize: { magnitude: 10, unit: "PT" },
        },
        "bold,weightedFontFamily,fontSize"
      );
    }
    return {
      category,
      pdfBuffer: await exportPdfBuffer(doc.id),
      mode: "drive_template",
    };
  } finally {
    if (doc?.id) {
      try {
        await deleteFile(doc.id);
      } catch (err) {
        logger.warn({ err, documentId: doc.id, actaId: acta.id }, "collab: no se pudo eliminar el documento temporal de acta");
      }
    }
  }
}

async function _buildActaPdfBuffer(acta, { preferStored = false } = {}) {
  const category = normalizeActaCategory(
    acta.resolved_category || acta.category || acta.items?.[0]?.item_category || acta.items?.[0]?.category,
  );

  if (preferStored && acta.pdf_drive_file_id) {
    try {
      return {
        category,
        pdfBuffer: await downloadFileBuffer(acta.pdf_drive_file_id),
        mode: "stored_drive_pdf",
      };
    } catch (err) {
      logger.warn({ err, actaId: acta.id, driveFileId: acta.pdf_drive_file_id }, "collab: no se pudo descargar el PDF persistido del acta");
    }
  }

  return _buildDriveTemplateActaPdfBuffer(acta);
}

async function getActaPdfDownload(actaId, { preferStored = true } = {}) {
  const acta = await getActaWithItems(actaId);
  const { category, pdfBuffer, mode } = await _buildActaPdfBuffer(acta, { preferStored });
  if (!pdfBuffer) {
    const error = new Error(`El template de acta para categoria "${acta.category || "sin_categoria"}" aun no esta disponible.`);
    error.status = 503;
    error.meta = {
      acta_code: acta.acta_code,
      detected_category: category,
      resolved_category: acta.resolved_category || null,
    };
    throw error;
  }

  return {
    acta,
    category,
    mode,
    filename: acta.pdf_filename || (acta.acta_code ? `${acta.acta_code}.pdf` : `ACTA-${String(acta.id).padStart(6, "0")}.pdf`),
    pdfBuffer,
  };
}

async function generateAndStoreActaPdf(actaId) {
  const { acta, category, pdfBuffer, mode, filename } = await getActaPdfDownload(actaId, { preferStored: false });

  if (!pdfBuffer) {
    logger.warn({ actaId, category }, "collab: acta sin template persistible");
    return { actaId, generated: false, category, reason: "unsupported_category" };
  }

  const sha256 = computeSha256HexFromBuffer(pdfBuffer);

  let driveUrl = null;
  let driveFileId = null;
  try {
    const folderId = await _resolveCollabActaFolderId();

    if (folderId) {
      const uploaded = await uploadBase64File(
        filename,
        pdfBuffer.toString("base64"),
        "application/pdf",
        folderId,
      );
      driveUrl = uploaded?.webViewLink || uploaded?.webContentLink || null;
      driveFileId = uploaded?.id || null;
    }
  } catch (err) {
    logger.warn({ err, actaId }, "collab: no se pudo subir PDF de acta a Drive");
  }

  await _updateActaPdfMetadata(actaId, { filename, sha256, driveUrl, driveFileId });
  logger.info({ actaId, mode, category, filename, driveFileId: driveFileId || null }, "collab: PDF de acta generado y guardado");
  return { actaId, generated: true, filename, sha256, driveUrl, driveFileId, category, mode };
}

async function _getUserIdentity(userId) {
  if (!userId) return null;
  const { rows } = await db.query(
    `SELECT id, email, fullname, name, role, active
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function _findFirstActiveUserByRoles(roles = []) {
  const normalizedRoles = roles
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);
  if (!normalizedRoles.length) return null;
  const { rows } = await db.query(
    `SELECT id, email, fullname, name, role, active
       FROM users
      WHERE LOWER(COALESCE(role, '')) = ANY($1)
        AND COALESCE(active, true) = true
      ORDER BY id ASC
      LIMIT 1`,
    [normalizedRoles]
  );
  return rows[0] || null;
}

async function _buildActaWorkflowSigners(acta) {
  const recipientUser = await _getUserIdentity(acta.recipient_user_id);
  if (!recipientUser?.email) {
    const error = new Error("No se pudo resolver el colaborador receptor para el workflow de firma");
    error.status = 400;
    throw error;
  }

  const talentoHumanoUser = await _findFirstActiveUserByRoles([
    "talento_humano",
    "jefe_talento_humano",
  ]);
  if (!talentoHumanoUser?.email) {
    const error = new Error("No se encontro un usuario activo de Talento Humano para firmar el acta");
    error.status = 400;
    throw error;
  }

  const gerenciaGeneralUser = await _findFirstActiveUserByRoles([
    "gerencia_general",
    "gerente_general",
    "director",
    "gerencia",
  ]);
  if (!gerenciaGeneralUser?.email) {
    const error = new Error("No se encontro un usuario activo de Gerencia General para firmar el acta");
    error.status = 400;
    throw error;
  }

  // Resolución desde ficha TH (fuente de verdad: nombres, cedula, cargo)
  const [snapRecipient, snapTH, snapGG] = await Promise.all([
    resolveSignerSnapshot(recipientUser.id),
    resolveSignerSnapshot(talentoHumanoUser.id),
    resolveSignerSnapshot(gerenciaGeneralUser.id),
  ]);

  return [
    {
      user_id: recipientUser.id,
      email:   recipientUser.email,
      name:    snapRecipient?.name   || recipientUser.fullname || recipientUser.email,
      role:    snapRecipient?.role   || "colaborador_receptor",
      cedula:  snapRecipient?.cedula || null,
      sequence_order: 1,
      is_required: true,
    },
    {
      user_id: talentoHumanoUser.id,
      email:   talentoHumanoUser.email,
      name:    snapTH?.name   || talentoHumanoUser.fullname || talentoHumanoUser.email,
      role:    snapTH?.role   || String(talentoHumanoUser.role || "talento_humano"),
      cedula:  snapTH?.cedula || null,
      sequence_order: 2,
      is_required: true,
    },
    {
      user_id: gerenciaGeneralUser.id,
      email:   gerenciaGeneralUser.email,
      name:    snapGG?.name   || gerenciaGeneralUser.fullname || gerenciaGeneralUser.email,
      role:    snapGG?.role   || String(gerenciaGeneralUser.role || "gerencia_general"),
      cedula:  snapGG?.cedula || null,
      sequence_order: 3,
      is_required: true,
    },
  ];
}

// Categorias que generan acta (todas menos "suministros", que no genera acta)
// pueden iniciar workflow de firma FamSign en una entrega.
const WORKFLOW_ELIGIBLE_CATEGORIES = new Set(["herramienta", "ropa", "epp", "logistica", "poliza"]);
const CATEGORY_ENTREGA_LABEL = {
  herramienta: "herramientas",
  ropa: "ropa de trabajo",
  epp: "equipo de proteccion personal",
  logistica: "logistica",
  poliza: "poliza de seguro",
};

function _shouldAutoStartSignatureWorkflow(acta) {
  const normalizedCategory = normalizeActaCategory(
    acta?.resolved_category || acta?.category || acta?.items?.[0]?.item_category || acta?.items?.[0]?.category
  );
  return WORKFLOW_ELIGIBLE_CATEGORIES.has(normalizedCategory) && String(acta?.tipo || "").toLowerCase() === "entrega";
}

async function startSignatureWorkflowForActa({ actaId, signers = [], actorUser }) {
  const acta = await getActaWithItems(actaId);
  if (acta.signature_workflow_id) {
    return signatureWorkflowsService.getWorkflow(Number(acta.signature_workflow_id), actorUser);
  }

  if (!_shouldAutoStartSignatureWorkflow(acta)) {
    const error = new Error("Esta acta no aplica para workflow FamSign");
    error.status = 400;
    throw error;
  }

  if (!acta.pdf_drive_file_id) {
    const error = new Error("El PDF del acta aún no ha sido generado. Descarga el acta primero.");
    error.status = 400;
    throw error;
  }

  const actor = actorUser?.id ? actorUser : await _getUserIdentity(actorUser?.id);
  if (!actor?.id) {
    const error = new Error("No se pudo resolver el usuario creador del workflow");
    error.status = 400;
    throw error;
  }

  const { acta: refreshedActa, pdfBuffer } = await getActaPdfDownload(actaId, { preferStored: true });
  if (!pdfBuffer) {
    const error = new Error("No se pudo obtener el PDF del acta desde Drive");
    error.status = 400;
    throw error;
  }

  const resolvedSigners = Array.isArray(signers) && signers.length
    ? signers
    : await _buildActaWorkflowSigners(refreshedActa);
  const normalizedCategory = normalizeActaCategory(
    refreshedActa.resolved_category || refreshedActa.category || refreshedActa.items?.[0]?.item_category || refreshedActa.items?.[0]?.category
  );
  const payload = validateCreateWorkflowPayload({
    source_module: "collab-deliveries",
    source_entity: "acta",
    source_entity_id: Number(refreshedActa.id),
    document_type: `acta_${normalizedCategory}_entrega`,
    title: `Acta ${refreshedActa.acta_code} - Entrega de ${CATEGORY_ENTREGA_LABEL[normalizedCategory] || normalizedCategory}`,
    description: refreshedActa.notes || null,
    document: {
      filename: refreshedActa.pdf_filename || `${refreshedActa.acta_code || `ACTA-${refreshedActa.id}`}.pdf`,
      pdf_base64: pdfBuffer.toString("base64"),
      source_sha256: refreshedActa.pdf_sha256,
    },
    signers: resolvedSigners,
    meta: {
      acta_id: refreshedActa.id,
      acta_code: refreshedActa.acta_code,
      category: refreshedActa.category || refreshedActa.resolved_category || null,
    },
  });
  const workflowResult = await signatureWorkflowsService.createWorkflow({
    payload,
    user: actor,
  });

  await db.query(
    `UPDATE collab_delivery_actas
        SET signature_workflow_id = $2,
            signature_workflow_status = $3,
            final_verification_token = $4
      WHERE id = $1`,
    [
      actaId,
      workflowResult.workflow.id,
      workflowResult.workflow.status,
      workflowResult.workflow.verification_token || null,
    ]
  );

  const sentResult = await signatureWorkflowsService.sendWorkflow(workflowResult.workflow.id, actor);
  if (refreshedActa.delivery_id) {
    await _logEvent(
      refreshedActa.delivery_id,
      "signature_workflow_started",
      {
        acta_id: refreshedActa.id,
        workflow_id: sentResult.workflow.id,
        workflow_code: sentResult.workflow.workflow_code,
      },
      actor.id
    );
  }
  return sentResult;
}

async function getActaSignatureWorkflow(actaId, actorUser) {
  const acta = await getActa(actaId);
  if (!acta.signature_workflow_id) {
    const error = new Error("El acta no tiene workflow de firma asociado");
    error.status = 404;
    throw error;
  }
  return signatureWorkflowsService.getWorkflow(Number(acta.signature_workflow_id), actorUser);
}

function queueCollabActaPdfGeneration(actaId) {
  if (!actaId) return;
  setImmediate(async () => {
    try {
      await generateAndStoreActaPdf(actaId);
    } catch (err) {
      logger.error({ err, actaId }, "collab: fallo la generacion asincrona del PDF de acta");
    }
  });
}

async function backfillMissingActaPdfs({ limit = 100 } = {}) {
  const { rows } = await db.query(
    `SELECT id
       FROM collab_delivery_actas
      WHERE active = true
        AND COALESCE(pdf_sha256, '') = ''
      ORDER BY id ASC
      LIMIT $1`,
    [Number(limit)],
  );

  const summary = { total: rows.length, generated: 0, skipped: 0, failed: 0 };
  for (const row of rows) {
    try {
      const result = await generateAndStoreActaPdf(row.id);
      if (result.generated) summary.generated += 1;
      else summary.skipped += 1;
    } catch (err) {
      summary.failed += 1;
      logger.error({ err, actaId: row.id }, "collab: fallo backfill de PDF de acta");
    }
  }

  return summary;
}

async function generateActa(deliveryId, { tipo, notes }, actorId) {
  const delivery = await getDelivery(deliveryId);

  const { rows: existingRows } = await db.query(
    `SELECT *
       FROM collab_delivery_actas
      WHERE delivery_id = $1
        AND tipo = $2
        AND active = true
      ORDER BY id DESC
      LIMIT 1`,
    [deliveryId, tipo],
  );
  if (existingRows.length) return existingRows[0];

  if (tipo === "entrega" && delivery.status !== "entregado") {
    throw Object.assign(new Error("Solo se puede generar acta de entrega para ítems activos"), { status: 400 });
  }
  if (tipo === "retiro" && delivery.status !== "retirado") {
    throw Object.assign(new Error("Se debe registrar el retiro antes de generar el acta de retiro"), { status: 400 });
  }

  const recipientInfo = await _getRecipientInfo(delivery.user_id);
  const now = new Date();
  const acta_code = await _nextActaCode(delivery.category, now.getFullYear());

  const { rows } = await db.query(
    `INSERT INTO collab_delivery_actas
      (acta_code, tipo, category, delivery_id, recipient_user_id,
       recipient_nombre, recipient_cedula, recipient_cargo,
       acta_day, acta_month, acta_year, generated_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      acta_code, tipo, delivery.category, deliveryId, delivery.user_id,
      recipientInfo.nombre, recipientInfo.cedula, recipientInfo.cargo,
      now.getDate(), now.getMonth() + 1, now.getFullYear(),
      actorId, notes || null,
    ],
  );
  const acta = rows[0];

  await db.query(
    `INSERT INTO collab_delivery_actas_items
      (acta_id, order_num, delivery_id, name, attributes_summary, serial_number, is_new, physical_condition, observations)
     VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      acta.id, deliveryId, delivery.item_name,
      JSON.stringify(delivery.attributes || {}),
      delivery.serial_number || null,
      tipo === "entrega",
      delivery.physical_condition || null,
      null,
    ],
  );

  await _logEvent(deliveryId, "acta_generated", { acta_id: acta.id, tipo, acta_code }, actorId);
  queueCollabActaPdfGeneration(acta.id);

  return acta;
}

async function uploadSignedActa(actaId, fileBuffer, originalName, actorId) {
  const acta = await getActa(actaId);
  const wasAlreadySigned = Boolean(
    acta.is_complete || acta.signed_at || acta.signed_pdf_drive_file_id || acta.signed_pdf_sha256,
  );

  const sha256 = computeSha256HexFromBuffer(fileBuffer);
  const b64 = fileBuffer.toString("base64");
  const folder = process.env.GDRIVE_FOLDER_ACTAS_COLLAB || process.env.DRIVE_FOLDER_ID;
  const uploaded = await uploadBase64File(originalName, b64, "application/pdf", folder);
  const fileId = uploaded?.id || null;
  const webViewLink = uploaded?.webViewLink || uploaded?.webContentLink || null;

  await db.query(
    `UPDATE collab_delivery_actas SET
       signed_pdf_sha256 = $2, signed_pdf_drive_url = $3, signed_pdf_drive_file_id = $4,
       signed_pdf_filename = $5, signed_at = now(), signed_by = $6, is_complete = true
     WHERE id = $1`,
    [actaId, sha256, webViewLink, fileId, originalName, actorId],
  );

  if (acta.delivery_id) {
    await _logEvent(
      acta.delivery_id,
      wasAlreadySigned ? "acta_signed_replaced" : "acta_signed",
      { acta_id: actaId, sha256, filename: originalName, replaced: wasAlreadySigned },
      actorId,
    );
  }

  return {
    sha256,
    filename: originalName,
    drive_url: webViewLink,
    drive_file_id: fileId,
    replaced: wasAlreadySigned,
  };
}

// ── Renovaciones ─────────────────────────────────────────────────────────────

async function listRenewals({ dueDays = 30, status } = {}) {
  const params = [parseInt(dueDays, 10)];
  let where = `WHERE rs.scheduled_date <= CURRENT_DATE + ($1 || ' days')::interval`;
  if (status) { params.push(status); where += ` AND rs.status = $${params.length}`; }
  else { where += ` AND rs.status IN ('pending','notified')`; }

  const { rows } = await db.query(
    `SELECT
       rs.*,
       cd.user_id, cd.attributes, cd.serial_number,
       ci.name AS item_name, ci.category,
       u.fullname AS collaborator_name, u.email AS collaborator_email,
       (rs.scheduled_date - CURRENT_DATE) AS days_remaining
     FROM collab_renewal_schedule rs
     JOIN collab_deliveries cd ON cd.id = rs.delivery_id
     JOIN collab_item_catalog ci ON ci.id = cd.catalog_item_id
     JOIN users u ON u.id = cd.user_id
     ${where}
     ORDER BY rs.scheduled_date ASC`,
    params,
  );
  return rows;
}

async function completeRenewal(renewalId, { notes, status = "completed" }, actorId) {
  if (!["completed", "cancelled"].includes(status)) throw Object.assign(new Error("Estado inválido"), { status: 400 });
  const { rows } = await db.query(
    `UPDATE collab_renewal_schedule SET
       status = $2, notes = COALESCE($3, notes),
       completed_at = now(), completed_by = $4, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [renewalId, status, notes || null, actorId],
  );
  if (!rows.length) throw Object.assign(new Error("Renovación no encontrada"), { status: 404 });
  return rows[0];
}

// ── Helpers privados ─────────────────────────────────────────────────────────

async function _logEvent(deliveryId, eventType, payload, actorId) {
  await db.query(
    `INSERT INTO collab_delivery_events (delivery_id, event_type, payload, created_by)
     VALUES ($1, $2, $3, $4)`,
    [deliveryId, eventType, payload, actorId],
  );
}

async function _getRecipientInfo(userId, dbOrClient = db) {
  return resolveRecipientOrThrow(userId, dbOrClient);
}

function _actaCodePrefixForCategory(category) {
  const normalized = normalizeActaCategory(category);
  return ACTA_CODE_PREFIX_BY_CATEGORY[normalized] || "ACTA-COL";
}

async function _nextActaCode(category, year = new Date().getFullYear(), dbOrClient = db) {
  const normalizedCategory = normalizeActaCategory(category);
  if (!ALLOWED_CATEGORIES.has(normalizedCategory)) {
    throw Object.assign(new Error("Categoria invalida para generar codigo de acta"), { status: 400 });
  }
  const actaYear = Number(year) || new Date().getFullYear();
  const { rows } = await dbOrClient.query(
    `INSERT INTO public.collab_acta_category_counters (category, acta_year, last_number)
     VALUES ($1, $2, 1)
     ON CONFLICT (category, acta_year)
     DO UPDATE SET
       last_number = public.collab_acta_category_counters.last_number + 1,
       updated_at = now()
     RETURNING last_number`,
    [normalizedCategory, actaYear],
  );
  const seq = String(rows[0].last_number).padStart(6, "0");
  return `${_actaCodePrefixForCategory(normalizedCategory)}-${actaYear}-${seq}`;
}

async function _checkAndCompleteOffboardingTask(userId, category, actorId) {
  const taskKey = `collab_${category}_returned`;
  const remaining = await db.query(
    `SELECT COUNT(*) FROM collab_deliveries cd
     JOIN collab_item_catalog ci ON ci.id = cd.catalog_item_id
     WHERE cd.user_id = $1 AND ci.category = $2 AND cd.status = 'entregado' AND cd.active = true`,
    [userId, category],
  );
  if (parseInt(remaining.rows[0].count, 10) === 0) {
    await db.query(
      `UPDATE offboarding_tasks SET
         is_completed = true, completed_at = now(), completed_by = $3, updated_at = now()
       WHERE user_id = $1 AND task_key = $2 AND is_completed = false`,
      [userId, taskKey, actorId],
    );
  }
}

// ── Flag onboarding / offboarding en collaborator_profiles ───────────────────

const ONBOARDING_FLAG_MAP = {
  entrega: {
    ropa:        "uniformes_entregados",
    epp:         "epp_entregados",
    herramienta: "herramientas_trabajo_entregadas",
    logistica:   "logistica_entregada",
    ti:          "acta_entrega_equipos_comunicacion",
  },
  retiro: {
    ropa:        "ropa_retirada",
    epp:         "epp_retirado",
    herramienta: "herramientas_trabajo_retiradas",
    logistica:   "logistica_retirada",
    ti:          "ti_retirado",
  },
};

function _updateOnboardingFlag(userId, flagKey, value, actorId) {
  if (!flagKey || !userId) return;
  // Two-step: first ensure row exists, then patch the nested key
  db.query(
    `INSERT INTO collaborator_profiles (user_id, profile)
     VALUES ($1, '{}'::jsonb)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  ).then(() => db.query(
    `UPDATE collaborator_profiles
        SET profile    = jsonb_set(
                           COALESCE(profile::jsonb, '{}'::jsonb),
                           ARRAY['onboarding', $2],
                           to_jsonb($3::boolean)
                         ),
            updated_at = now()
      WHERE user_id = $1`,
    [userId, flagKey, Boolean(value)],
  )).catch((e) => {
    require("../../config/logger").warn({ err: e, userId, flagKey }, "collab: no se pudo actualizar onboarding flag");
  });
}

// ── Sesiones de entrega (multi-ítem, 1 acta por categoría) ───────────────────

async function createCollabSession({
  user_id, category, session_date, tipo = "entrega", notes,
  items = [], // [{catalog_item_id, serial_number, physical_condition, attributes, renewal_date, observations}]
  recipient_nombre, recipient_cedula, recipient_cargo,
  personnel_type = null, // 'interno' | 'externo' -- aplica a category 'herramienta' y 'ropa', decide la plantilla del acta
}, actorId, actorRole) {
  if (!ALLOWED_CATEGORIES.has(category)) throw Object.assign(new Error("Categoría inválida"), { status: 400 });
  if (personnel_type && !["interno", "externo"].includes(personnel_type)) {
    throw Object.assign(new Error("personnel_type debe ser 'interno' o 'externo'"), { status: 400 });
  }
  validateSessionRole(category, tipo, actorRole);
  if (!items.length) throw Object.assign(new Error("La sesión debe incluir al menos un ítem"), { status: 400 });

  const client = await db.getClient();
  let _step = "begin";
  try {
    await client.query("BEGIN");

    _step = "insert_session";
    const { rows: [session] } = await client.query(
      `INSERT INTO collab_delivery_sessions (user_id, category, session_date, tipo, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [user_id, category, session_date || new Date().toISOString().slice(0, 10), tipo, notes || null, actorId],
    );

    _step = "insert_deliveries";
    const deliveries = await _insertSessionDeliveries({
      client,
      session,
      userId: user_id,
      category,
      tipo,
      items,
      actorId,
    });

    let acta = null;

    // Suministros de oficina no genera acta
    if (category !== "suministros") {
      _step = "get_recipient_info";
      const recipientInfo = (recipient_nombre && recipient_cedula && recipient_cargo)
        ? { nombre: recipient_nombre, cedula: recipient_cedula, cargo: recipient_cargo }
        : await resolveRecipientOrThrow(user_id, client);

      // La fecha impresa en el acta es la fecha de entrega elegida en el
      // paso 2 (session.session_date), no la fecha en que se genera el PDF.
      const { day: actaDay, month: actaMonth, year: actaYear } = _dateKeyParts(session.session_date);
      const acta_code = await _nextActaCode(category, actaYear, client);

      _step = "insert_acta";
      const { rows: [newActa] } = await client.query(
        `INSERT INTO collab_delivery_actas
          (acta_code, tipo, category, delivery_id, session_id, recipient_user_id,
           recipient_nombre, recipient_cedula, recipient_cargo,
           acta_day, acta_month, acta_year, generated_by, personnel_type, notes)
         VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [acta_code, tipo, category, session.id, user_id,
         recipientInfo.nombre, recipientInfo.cedula, recipientInfo.cargo,
         actaDay, actaMonth, actaYear, actorId,
         ["herramienta", "ropa", "poliza"].includes(category) ? personnel_type : null,
         session.notes || null],
      );
      acta = newActa;

      for (const [i, d] of deliveries.entries()) {
        _step = "insert_acta_item";
        await client.query(
          `INSERT INTO collab_delivery_actas_items
            (acta_id, order_num, delivery_id, name, attributes_summary, serial_number,
             is_new, physical_condition, observations, item_category)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [acta.id, i + 1, d.id, d.item_name,
           JSON.stringify(d.attributes || {}), d.serial_number || null,
           d.is_new != null ? Boolean(d.is_new) : tipo === "entrega",
           d.physical_condition || null, null, category],
        );
      }
    }

    await client.query("COMMIT");

    // Fire-and-forget: non-critical, cannot block or fail this request
    const flagKey = (ONBOARDING_FLAG_MAP[tipo] || {})[category];
    if (flagKey) _updateOnboardingFlag(user_id, flagKey, true, actorId);
    if (acta?.id) {
      queueCollabActaPdfGeneration(acta.id);
    }

    return { session, deliveries, acta };
  } catch (e) {
    await client.query("ROLLBACK");
    logger.error({ err: e, step: _step, category, tipo, user_id }, `[createCollabSession] failed at step=${_step}: ${e.message}`);
    e.message = `[step:${_step}] ${e.message}`;
    throw e;
  } finally {
    client.release();
  }
}

async function updateCollabSession(sessionId, {
  session_date,
  notes,
  items = [],
  recipient_nombre,
  recipient_cedula,
  recipient_cargo,
  personnel_type,
}, actorId, actorRole) {
  const normalizedSessionId = Number(sessionId);
  if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) {
    throw Object.assign(new Error("sessionId inválido"), { status: 400 });
  }
  if (personnel_type && !["interno", "externo"].includes(personnel_type)) {
    throw Object.assign(new Error("personnel_type debe ser 'interno' o 'externo'"), { status: 400 });
  }

  const client = await db.getClient();
  let step = "begin";
  try {
    await client.query("BEGIN");

    step = "load_session";
    const { rows: sessionRows } = await client.query(
      `SELECT * FROM collab_delivery_sessions WHERE id = $1 LIMIT 1`,
      [normalizedSessionId],
    );
    if (!sessionRows.length) throw Object.assign(new Error("Sesión no encontrada"), { status: 404 });
    const session = sessionRows[0];

    if (session.category === "ti") {
      throw Object.assign(new Error("Las sesiones TI deben corregirse desde el módulo de activos TI"), { status: 400 });
    }

    validateSessionRole(session.category, session.tipo, actorRole);

    if (!Array.isArray(items) || !items.length) {
      throw Object.assign(new Error("La sesión debe incluir al menos un ítem"), { status: 400 });
    }

    step = "load_actas";
    const { rows: actas } = await client.query(
      `SELECT * FROM collab_delivery_actas WHERE session_id = $1 AND active = true ORDER BY id ASC`,
      [normalizedSessionId],
    );
    const sessionActa = actas[0] || null;

    if (actas.some((acta) =>
      acta.signature_workflow_id ||
      acta.is_complete ||
      acta.signed_at ||
      acta.signed_pdf_drive_file_id ||
      acta.signed_pdf_sha256
    )) {
      throw Object.assign(new Error("La sesión ya tiene firma o workflow iniciado y no puede editarse"), { status: 409 });
    }

    step = "validate_docs";
    const { rows: docRows } = await client.query(
      `SELECT d.id
         FROM public.collab_delivery_docs d
         JOIN public.collab_deliveries cd ON cd.id = d.delivery_id
        WHERE cd.session_id = $1 AND d.active = true
        LIMIT 1`,
      [normalizedSessionId],
    );
    if (docRows.length) {
      throw Object.assign(new Error("La sesión ya tiene documentos cargados y no puede reconstruirse automáticamente"), { status: 409 });
    }

    step = "update_session";
    const targetSessionDate = session_date || session.session_date;
    const targetNotes = notes !== undefined ? notes : session.notes;
    const { rows: updatedSessionRows } = await client.query(
      `UPDATE collab_delivery_sessions
          SET session_date = $2,
              notes = $3
        WHERE id = $1
        RETURNING *`,
      [normalizedSessionId, targetSessionDate, targetNotes || null],
    );
    const updatedSession = updatedSessionRows[0];

    step = "delete_acta_items";
    if (sessionActa) {
      await client.query(`DELETE FROM collab_delivery_actas_items WHERE acta_id = $1`, [sessionActa.id]);
    }

    step = "delete_deliveries";
    await client.query(`DELETE FROM collab_deliveries WHERE session_id = $1`, [normalizedSessionId]);

    step = "insert_deliveries";
    const deliveries = await _insertSessionDeliveries({
      client,
      session: updatedSession,
      userId: session.user_id,
      category: session.category,
      tipo: session.tipo,
      items,
      actorId,
    });

    let acta = sessionActa;
    if (session.category !== "suministros") {
      step = "resolve_recipient";
      const recipientInfo = {
        nombre: recipient_nombre || sessionActa?.recipient_nombre || null,
        cedula: recipient_cedula || sessionActa?.recipient_cedula || null,
        cargo: recipient_cargo || sessionActa?.recipient_cargo || null,
      };

      if (!recipientInfo.nombre || !recipientInfo.cedula || !recipientInfo.cargo) {
        const resolved = await resolveRecipientOrThrow(session.user_id, client);
        recipientInfo.nombre = recipientInfo.nombre || resolved.nombre;
        recipientInfo.cedula = recipientInfo.cedula || resolved.cedula;
        recipientInfo.cargo = recipientInfo.cargo || resolved.cargo;
      }

      // Igual que en createCollabSession: la fecha del acta es la fecha de
      // entrega (session_date), no la fecha en que se edita/regenera.
      const { day: actaDay, month: actaMonth, year: actaYear } = _dateKeyParts(updatedSession.session_date);
      if (acta) {
        step = "update_acta";
        const { rows: updatedActaRows } = await client.query(
          `UPDATE collab_delivery_actas
              SET recipient_nombre = $2,
                  recipient_cedula = $3,
                  recipient_cargo = $4,
                  acta_day = $5,
                  acta_month = $6,
                  acta_year = $7,
                  personnel_type = CASE WHEN category IN ('herramienta','ropa','poliza') THEN COALESCE($8, personnel_type) ELSE personnel_type END,
                  notes = $9,
                  pdf_drive_file_id = NULL,
                  pdf_sha256 = NULL,
                  pdf_filename = NULL,
                  pdf_drive_url = NULL
            WHERE id = $1
            RETURNING *`,
          [
            acta.id,
            recipientInfo.nombre,
            recipientInfo.cedula,
            recipientInfo.cargo,
            actaDay,
            actaMonth,
            actaYear,
            personnel_type || null,
            updatedSession.notes || null,
          ],
        );
        acta = updatedActaRows[0];
      } else {
        step = "insert_acta";
        const { rows: createdActaRows } = await client.query(
          `INSERT INTO collab_delivery_actas
            (acta_code, tipo, category, delivery_id, session_id, recipient_user_id,
             recipient_nombre, recipient_cedula, recipient_cargo,
             acta_day, acta_month, acta_year, generated_by, personnel_type, notes)
           VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          RETURNING *`,
          [
            await _nextActaCode(session.category, actaYear, client),
            session.tipo,
            session.category,
            normalizedSessionId,
            session.user_id,
            recipientInfo.nombre,
            recipientInfo.cedula,
            recipientInfo.cargo,
            actaDay,
            actaMonth,
            actaYear,
            actorId,
            ["herramienta", "ropa", "poliza"].includes(session.category) ? (personnel_type || null) : null,
            updatedSession.notes || null,
          ],
        );
        acta = createdActaRows[0];
      }

      step = "insert_acta_items";
      for (const [index, delivery] of deliveries.entries()) {
        await client.query(
          `INSERT INTO collab_delivery_actas_items
            (acta_id, order_num, delivery_id, name, attributes_summary, serial_number,
             is_new, physical_condition, observations, item_category)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            acta.id,
            index + 1,
            delivery.id,
            delivery.item_name,
            JSON.stringify(delivery.attributes || {}),
            delivery.serial_number || null,
            delivery.is_new != null ? Boolean(delivery.is_new) : session.tipo === "entrega",
            delivery.physical_condition || null,
            null,
            session.category,
          ],
        );
      }
    }

    await client.query("COMMIT");

    if (acta?.id) {
      queueCollabActaPdfGeneration(acta.id);
    }

    return { session: updatedSession, deliveries, acta };
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error({ err: error, step, sessionId: normalizedSessionId }, `[updateCollabSession] failed at step=${step}: ${error.message}`);
    error.message = `[step:${step}] ${error.message}`;
    throw error;
  } finally {
    client.release();
  }
}

async function listSessions({ userId, category, tipo, page = 1, limit = 50 } = {}) {
  const params = [];
  let where = "WHERE 1=1";
  if (userId)   { params.push(userId);   where += ` AND s.user_id = $${params.length}`; }
  if (category) { params.push(category); where += ` AND s.category = $${params.length}`; }
  if (tipo)     { params.push(tipo);     where += ` AND s.tipo = $${params.length}`; }
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT s.*,
       u.fullname AS collaborator_name, u.email AS collaborator_email,
       COUNT(DISTINCT d.id)::int AS delivery_count,
       COUNT(DISTINCT a.id)::int AS acta_count,
       (COUNT(DISTINCT a.id) FILTER (WHERE a.is_complete = false))::int AS actas_pending
     FROM collab_delivery_sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN collab_deliveries d ON d.session_id = s.id
     LEFT JOIN collab_delivery_actas a ON a.session_id = s.id AND a.active = true
     ${where}
     GROUP BY s.id, u.fullname, u.email
     ORDER BY s.session_date DESC, s.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

async function getSession(sessionId) {
  const { rows } = await db.query(
    `SELECT s.*, u.fullname AS collaborator_name, u.email AS collaborator_email
     FROM collab_delivery_sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
    [sessionId],
  );
  if (!rows.length) throw Object.assign(new Error("Sesión no encontrada"), { status: 404 });
  const session = rows[0];

  const { rows: deliveries } = await db.query(
    `SELECT d.*, ci.name AS item_name, ci.category, ci.attribute_schema
     FROM collab_deliveries d
     JOIN collab_item_catalog ci ON ci.id = d.catalog_item_id
     WHERE d.session_id = $1 ORDER BY d.id`,
    [sessionId],
  );

  const { rows: actas } = await db.query(
    `SELECT a.*, gb.fullname AS generated_by_name,
       (SELECT json_agg(i ORDER BY i.order_num) FROM collab_delivery_actas_items i WHERE i.acta_id = a.id) AS items
     FROM collab_delivery_actas a
     LEFT JOIN users gb ON gb.id = a.generated_by
     WHERE a.session_id = $1 AND a.active = true
     ORDER BY a.generated_at DESC`,
    [sessionId],
  );

  return { ...session, deliveries, actas };
}

// ── Sesiones TI (herramientas de comunicación) ────────────────────────────────
// Llama internamente al TI service para asignar múltiples activos + 1 acta TI.
async function createTiSession({
  user_id, session_date, tipo = "entrega", notes,
  asset_ids = [],
  recipient_nombre, recipient_cedula, recipient_cargo,
}, actorId) {
  if (!asset_ids.length) throw Object.assign(new Error("Debe incluir al menos un activo TI"), { status: 400 });
  const tiService = require("../ti-assets/tiAssets.service");
  const assignedToUserId = tipo === "entrega" ? Number(user_id) : null;
  const result = await tiService.assignMultipleAssets({
    assetIds: asset_ids.map(Number),
    assignedToUserId,
    reason: notes || "Sesion de herramientas de comunicacion",
    userId: actorId,
    recipientNombre: recipient_nombre || null,
    recipientCedula: recipient_cedula || null,
    recipientCargo:  recipient_cargo  || null,
  });
  // Auto-mark onboarding/offboarding flag
  const tiFlag = tipo === "retiro" ? "salida_equipos" : "acta_entrega_equipos_comunicacion";
  _updateOnboardingFlag(user_id, tiFlag, true, actorId);
  return result;
}

// ── Documentos por entrega (factura) ─────────────────────────────────────────

let _collabDocsReady = false;
async function _ensureCollabDocsSchema() {
  if (_collabDocsReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.collab_delivery_docs (
      id            BIGSERIAL PRIMARY KEY,
      delivery_id   BIGINT NOT NULL REFERENCES public.collab_deliveries(id) ON DELETE CASCADE,
      doc_type      TEXT NOT NULL DEFAULT 'factura',
      filename      TEXT,
      drive_file_id TEXT,
      drive_url     TEXT,
      sha256        TEXT,
      notes         TEXT,
      uploaded_by   INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      active        BOOLEAN NOT NULL DEFAULT true
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_collab_delivery_docs_delivery ON public.collab_delivery_docs(delivery_id)`);
  _collabDocsReady = true;
}

async function listDeliveryDocsByUser(userId) {
  await _ensureCollabDocsSchema();
  const { rows } = await db.query(
    `SELECT d.*, COALESCE(u.fullname, u.name, u.email) AS uploaded_by_name
       FROM public.collab_delivery_docs d
       JOIN public.collab_deliveries cd ON cd.id = d.delivery_id
       LEFT JOIN public.users u ON u.id = d.uploaded_by
      WHERE cd.user_id = $1 AND d.active = true
      ORDER BY d.uploaded_at DESC`,
    [userId],
  );
  return rows;
}

async function listDeliveryDocs(deliveryId) {
  await _ensureCollabDocsSchema();
  const { rows } = await db.query(
    `SELECT d.*, COALESCE(u.fullname, u.name, u.email) AS uploaded_by_name
       FROM public.collab_delivery_docs d
       LEFT JOIN public.users u ON u.id = d.uploaded_by
      WHERE d.delivery_id = $1 AND d.active = true
      ORDER BY d.uploaded_at DESC`,
    [deliveryId],
  );
  return rows;
}

async function uploadDeliveryDoc({ deliveryId, docType = "factura", fileBuffer, originalFilename, notes, userId }) {
  await _ensureCollabDocsSchema();

  const { rows: dr } = await db.query(
    `SELECT id FROM public.collab_deliveries WHERE id = $1 AND active = true LIMIT 1`,
    [deliveryId],
  );
  if (!dr.length) throw Object.assign(new Error("Entrega no encontrada"), { status: 404 });

  const sha256   = computeSha256HexFromBuffer(fileBuffer);
  const ext      = (originalFilename || "").split(".").pop() || "pdf";
  const filename = `Factura-Entrega-${deliveryId}.${ext}`;

  let driveUrl = null;
  let driveFileId = null;
  try {
    const base = process.env.DRIVE_PROFILE_FOLDER_ID || process.env.DRIVE_DOCS_FOLDER_ID
              || process.env.DRIVE_ROOT_FOLDER_ID    || process.env.DRIVE_FOLDER_ID;
    if (base) {
      const folder = await ensureFolder("ColabEntregas", base);
      if (folder?.id) {
        const up = await uploadBase64File(filename, fileBuffer.toString("base64"), "application/pdf", folder.id);
        driveUrl    = up?.webViewLink || up?.webContentLink || null;
        driveFileId = up?.id || null;
      }
    }
  } catch (_e) { /* Drive opcional */ }

  // Upsert: desactiva doc anterior del mismo tipo para esta entrega
  await db.query(
    `UPDATE public.collab_delivery_docs SET active = false WHERE delivery_id = $1 AND doc_type = $2 AND active = true`,
    [deliveryId, docType],
  );

  const { rows } = await db.query(
    `INSERT INTO public.collab_delivery_docs
       (delivery_id, doc_type, filename, drive_file_id, drive_url, sha256, notes, uploaded_by, uploaded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     RETURNING *`,
    [deliveryId, docType, filename, driveFileId, driveUrl, sha256, notes || null, userId || null],
  );
  return rows[0];
}

// ── Job: notificar renovaciones próximas ─────────────────────────────────────

async function notifyUpcomingRenewals() {
  const alertDays = parseInt(process.env.COLLAB_RENEWAL_ALERT_DAYS || "30", 10);
  const { rows: pending } = await db.query(
    `SELECT rs.*, cd.user_id, ci.name AS item_name, ci.category,
            u.fullname AS collaborator_name
     FROM collab_renewal_schedule rs
     JOIN collab_deliveries cd ON cd.id = rs.delivery_id
     JOIN collab_item_catalog ci ON ci.id = cd.catalog_item_id
     JOIN users u ON u.id = cd.user_id
     WHERE rs.status = 'pending'
       AND rs.scheduled_date <= CURRENT_DATE + ($1 || ' days')::interval`,
    [alertDays],
  );

  if (!pending.length) return { notified: 0 };

  const { rows: financieros } = await db.query(
    `SELECT id FROM users WHERE role IN ('financiero','jefe_financiero') AND active = true`,
  );

  for (const renewal of pending) {
    for (const fin of financieros) {
      await notificationManager.sendNotification({
        userId: fin.id,
        customTitle: `Renovación próxima: ${renewal.item_name}`,
        customMessage: `${renewal.collaborator_name} — vence el ${renewal.scheduled_date}`,
        type: "task",
        priority: 1,
        source: "collab_deliveries",
        meta: { renewal_id: renewal.id, delivery_id: renewal.delivery_id },
      });
    }
    await db.query(
      `UPDATE collab_renewal_schedule SET status = 'notified', notified_at = now(), updated_at = now()
       WHERE id = $1`,
      [renewal.id],
    );
  }

  return { notified: pending.length };
}

// ── Offboarding: crear tareas al iniciar proceso ──────────────────────────────

async function createOffboardingTasksForUser(userId, actorId) {
  const { rows: activeCategories } = await db.query(
    `SELECT DISTINCT ci.category
     FROM collab_deliveries cd
     JOIN collab_item_catalog ci ON ci.id = cd.catalog_item_id
     WHERE cd.user_id = $1 AND cd.status = 'entregado' AND cd.active = true`,
    [userId],
  );

  for (const { category } of activeCategories) {
    await db.query(
      `INSERT INTO offboarding_tasks (user_id, stage, task_key, is_completed)
       VALUES ($1, 'equipos', $2, false)
       ON CONFLICT DO NOTHING`,
      [userId, `collab_${category}_returned`],
    );
  }

  const { rows: hasTi } = await db.query(
    `SELECT 1 FROM ti_assets WHERE assigned_to_user_id = $1 AND active = true LIMIT 1`,
    [userId],
  );
  if (hasTi.length) {
    await db.query(
      `INSERT INTO offboarding_tasks (user_id, stage, task_key, is_completed)
       VALUES ($1, 'equipos', 'ti_assets_returned', false)
       ON CONFLICT DO NOTHING`,
      [userId],
    );
  }

  return { categories: activeCategories.map((r) => r.category), hasTiAssets: !!hasTi.length };
}

// ── Resumen ejecutivo (gerencia) ─────────────────────────────────────────────

async function getSummary() {
  const { rows } = await db.query(
    `SELECT
       ci.category,
       COUNT(*) FILTER (WHERE cd.status = 'entregado') AS activos,
       COUNT(*) FILTER (WHERE cd.status = 'retirado')  AS retirados,
       COUNT(*) FILTER (WHERE cd.status IN ('perdido','dañado')) AS incidencias,
       COUNT(DISTINCT cd.user_id) FILTER (WHERE cd.status = 'entregado') AS colaboradores_con_items
     FROM collab_deliveries cd
     JOIN collab_item_catalog ci ON ci.id = cd.catalog_item_id
     WHERE cd.active = true
     GROUP BY ci.category`,
  );

  const { rows: actaStats } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE is_complete = false) AS actas_sin_firma,
       COUNT(*) FILTER (WHERE is_complete = true)  AS actas_firmadas
     FROM collab_delivery_actas WHERE active = true`,
  );

  const alertDays = parseInt(process.env.COLLAB_RENEWAL_ALERT_DAYS || "30", 10);
  const { rows: renewalStats } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE scheduled_date < CURRENT_DATE) AS vencidas,
       COUNT(*) FILTER (WHERE scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($1 || ' days')::interval) AS proximas
     FROM collab_renewal_schedule WHERE status IN ('pending','notified')`,
    [alertDays],
  );

  return {
    by_category: rows,
    actas: actaStats[0],
    renewals: renewalStats[0],
  };
}

// ── Reporte completo de colaboradores ─────────────────────────────────────────

const _REPORT_QUERY = (whereExtra = "") => `
    SELECT
      u.id                                           AS user_id,
      COALESCE(u.fullname, u.name, u.email)          AS colaborador,
      u.email,
      u.role,
      d.id                                           AS delivery_id,
      ci.category,
      d.status,
      d.delivery_date,
      d.serial_number,
      d.physical_condition,
      d.attributes,
      d.observations,
      d.renewal_date,
      ci.name                                        AS item_name,
      ci.attribute_schema                            AS item_attribute_schema,
      s.session_date,
      s.tipo                                         AS session_tipo,
      a.acta_code,
      a.tipo                                         AS acta_tipo,
      a.signed_at                                    AS acta_firmada_at,
      CASE WHEN a.acta_day IS NOT NULL
           THEN (a.acta_day || '/' || a.acta_month || '/' || a.acta_year)
           ELSE NULL END                             AS acta_fecha,
      ew.created_at                                  AS retiro_at
    FROM public.collab_deliveries d
    JOIN public.collab_item_catalog ci ON ci.id = d.catalog_item_id
    JOIN public.users u                ON u.id  = d.user_id
    LEFT JOIN public.collab_delivery_sessions s ON s.id = d.session_id
    LEFT JOIN public.collab_delivery_actas_items ai ON ai.delivery_id = d.id
    LEFT JOIN public.collab_delivery_actas a        ON a.id = ai.acta_id
    LEFT JOIN LATERAL (
      SELECT created_at FROM public.collab_delivery_events
      WHERE delivery_id = d.id AND event_type = 'withdrawn'
      ORDER BY created_at DESC LIMIT 1
    ) ew ON true
    WHERE d.active = true ${whereExtra}
    ORDER BY COALESCE(u.fullname, u.name, u.email), ci.category, d.delivery_date
`;

async function getFullReport() {
  const { rows } = await db.query(_REPORT_QUERY());
  return rows;
}

async function getCollaboratorReport(userId) {
  const { rows } = await db.query(_REPORT_QUERY("AND d.user_id = $1"), [userId]);
  return rows;
}

module.exports = {
  normalizeActaCategory,
  COLLAB_WRITE_ROLES,
  COLLAB_CATALOG_WRITE_ROLES,
  COLLAB_SESSION_ROLES,
  COLLAB_READ_ROLES,
  listCatalog,
  createCatalogItem,
  updateCatalogItem,
  listDeliveries,
  listDeliveriesByUser,
  getDelivery,
  createDelivery,
  updateDelivery,
  withdrawDelivery,
  listActasByDelivery,
  getActa, getActaWithItems,
  generateActa,
  startSignatureWorkflowForActa,
  getActaSignatureWorkflow,
  generateAndStoreActaPdf,
  getActaPdfDownload,
  backfillMissingActaPdfs,
  uploadSignedActa,
  listRenewals,
  completeRenewal,
  notifyUpcomingRenewals,
  createOffboardingTasksForUser,
  getSummary,
  createCollabSession,
  updateCollabSession,
  listSessions,
  getSession,
  createTiSession,
  listDeliveryDocsByUser,
  listDeliveryDocs,
  uploadDeliveryDoc,
  getFullReport,
  getCollaboratorReport,
  _validatePolicyAttributes,
  _REPORT_QUERY,
};
