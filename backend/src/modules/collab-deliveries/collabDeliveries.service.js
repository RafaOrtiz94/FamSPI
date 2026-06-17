const db = require("../../config/db");
const notificationManager = require("../notifications/notificationManager");
const { computeSha256HexFromBuffer } = require("../../utils/documentHash");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");

// ── Roles ────────────────────────────────────────────────────────────────────
const COLLAB_WRITE_ROLES = ["financiero", "jefe_financiero"];
const COLLAB_READ_ROLES  = [
  ...COLLAB_WRITE_ROLES,
  "gerencia_general", "gerencia",
  "ti", "jefe_ti", "admin_ti",
];

const ALLOWED_STATUSES = new Set(["entregado", "retirado", "perdido", "dañado"]);
const ALLOWED_CATEGORIES = new Set(["ropa", "herramienta", "logistica"]);

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

async function generateActa(deliveryId, { tipo, notes }, actorId) {
  const delivery = await getDelivery(deliveryId);

  if (tipo === "entrega" && delivery.status !== "entregado") {
    throw Object.assign(new Error("Solo se puede generar acta de entrega para ítems activos"), { status: 400 });
  }
  if (tipo === "retiro" && delivery.status !== "retirado") {
    throw Object.assign(new Error("Se debe registrar el retiro antes de generar el acta de retiro"), { status: 400 });
  }

  const recipientInfo = await _getRecipientInfo(delivery.user_id);
  const now = new Date();
  const acta_code = await _nextActaCode();

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
      delivery.observations || null,
    ],
  );

  await _logEvent(deliveryId, "acta_generated", { acta_id: acta.id, tipo, acta_code }, actorId);

  return acta;
}

async function uploadSignedActa(actaId, fileBuffer, originalName, actorId) {
  const acta = await getActa(actaId);
  if (acta.is_complete) throw Object.assign(new Error("Esta acta ya tiene versión firmada"), { status: 400 });

  const sha256 = computeSha256HexFromBuffer(fileBuffer);
  const b64 = fileBuffer.toString("base64");
  const folder = process.env.GDRIVE_FOLDER_ACTAS_COLLAB || process.env.DRIVE_FOLDER_ID;
  const { fileId, webViewLink } = await uploadBase64File(b64, originalName, "application/pdf", folder);

  await db.query(
    `UPDATE collab_delivery_actas SET
       signed_pdf_sha256 = $2, signed_pdf_drive_url = $3, signed_pdf_drive_file_id = $4,
       signed_pdf_filename = $5, signed_at = now(), signed_by = $6, is_complete = true
     WHERE id = $1`,
    [actaId, sha256, webViewLink, fileId, originalName, actorId],
  );

  if (acta.delivery_id) {
    await _logEvent(acta.delivery_id, "acta_signed", { acta_id: actaId, sha256 }, actorId);
  }

  return { sha256, drive_url: webViewLink };
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

async function _getRecipientInfo(userId) {
  const { rows } = await db.query(
    `SELECT
       COALESCE(
         cp.profile->'personal'->>'nombres' || ' ' || cp.profile->'personal'->>'apellidos',
         u.fullname, u.name
       ) AS nombre,
       COALESCE(cp.profile->'personal'->>'cedula', '') AS cedula,
       COALESCE(cp.profile->'laboral'->>'cargo', '') AS cargo
     FROM users u
     LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  if (!rows.length) throw Object.assign(new Error("Colaborador no encontrado"), { status: 404 });
  return rows[0];
}

async function _nextActaCode() {
  const { rows } = await db.query(`SELECT nextval('collab_acta_seq') AS seq`);
  const seq = String(rows[0].seq).padStart(6, "0");
  const year = new Date().getFullYear();
  return `ACTA-COL-${year}-${seq}`;
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

// ── Sesiones de entrega (multi-ítem, 1 acta por categoría) ───────────────────

async function createCollabSession({
  user_id, category, session_date, tipo = "entrega", notes,
  items = [], // [{catalog_item_id, serial_number, physical_condition, attributes, renewal_date, observations}]
  recipient_nombre, recipient_cedula, recipient_cargo,
}, actorId) {
  if (!ALLOWED_CATEGORIES.has(category)) throw Object.assign(new Error("Categoría inválida"), { status: 400 });
  if (!items.length) throw Object.assign(new Error("La sesión debe incluir al menos un ítem"), { status: 400 });

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: [session] } = await client.query(
      `INSERT INTO collab_delivery_sessions (user_id, category, session_date, tipo, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [user_id, category, session_date || new Date().toISOString().slice(0, 10), tipo, notes || null, actorId],
    );

    const deliveries = [];
    for (const item of items) {
      const { rows: catRows } = await client.query(
        `SELECT * FROM collab_item_catalog WHERE id = $1 AND active = true AND category = $2`,
        [item.catalog_item_id, category],
      );
      if (!catRows.length) throw Object.assign(new Error(`Ítem ${item.catalog_item_id} no encontrado en categoría ${category}`), { status: 400 });
      const cat = catRows[0];
      if (cat.requires_serial && !item.serial_number?.trim()) {
        throw Object.assign(new Error(`${cat.name} requiere número de serie`), { status: 400 });
      }

      const status = tipo === "entrega" ? "entregado" : "retirado";
      const { rows: [delivery] } = await client.query(
        `INSERT INTO collab_deliveries
          (catalog_item_id, user_id, status, serial_number, physical_condition, attributes,
           observations, delivery_date, renewal_date, renewal_notes, delivered_by, created_by, session_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12) RETURNING *`,
        [cat.id, user_id, status, item.serial_number || null, item.physical_condition || null,
         item.attributes || {}, item.observations || null,
         session.session_date, item.renewal_date || null, item.renewal_notes || null,
         actorId, session.id],
      );
      deliveries.push({ ...delivery, item_name: cat.name });

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

    const recipientInfo = recipient_nombre
      ? { nombre: recipient_nombre, cedula: recipient_cedula || "", cargo: recipient_cargo || "" }
      : await _getRecipientInfo(user_id);

    const acta_code = await _nextActaCode();
    const now = new Date();

    const { rows: [acta] } = await client.query(
      `INSERT INTO collab_delivery_actas
        (acta_code, tipo, category, delivery_id, session_id, recipient_user_id,
         recipient_nombre, recipient_cedula, recipient_cargo,
         acta_day, acta_month, acta_year, generated_by)
       VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [acta_code, tipo, category, session.id, user_id,
       recipientInfo.nombre, recipientInfo.cedula, recipientInfo.cargo,
       now.getDate(), now.getMonth() + 1, now.getFullYear(), actorId],
    );

    for (const [i, d] of deliveries.entries()) {
      await client.query(
        `INSERT INTO collab_delivery_actas_items
          (acta_id, order_num, delivery_id, name, attributes_summary, serial_number,
           is_new, physical_condition, observations, item_category)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [acta.id, i + 1, d.id, d.item_name,
         JSON.stringify(d.attributes || {}), d.serial_number || null,
         tipo === "entrega", d.physical_condition || null, d.observations || null, category],
      );
    }

    await client.query("COMMIT");
    return { session, deliveries, acta };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
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
  return tiService.assignMultipleAssets({
    assetIds: asset_ids.map(Number),
    assignedToUserId,
    reason: notes || "Sesión de herramientas de comunicación",
    userId: actorId,
    recipientNombre: recipient_nombre || null,
    recipientCedula: recipient_cedula || null,
    recipientCargo: recipient_cargo || null,
  });
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

module.exports = {
  COLLAB_WRITE_ROLES,
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
  getActa,
  generateActa,
  uploadSignedActa,
  listRenewals,
  completeRenewal,
  notifyUpcomingRenewals,
  createOffboardingTasksForUser,
  getSummary,
  createCollabSession,
  listSessions,
  getSession,
  createTiSession,
};
