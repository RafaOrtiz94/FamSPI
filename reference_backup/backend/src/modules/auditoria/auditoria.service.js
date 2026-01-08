// ============================================================
// 🧾 auditoria.service.js
// ------------------------------------------------------------
// Servicio de Auditoría del sistema SPI Fam Project.
// Consulta, filtra, y exporta los registros del esquema auditoria.logs
// ============================================================

const db = require("../../config/db");
const { stringify } = require("csv-stringify/sync");
const logger = require("../../config/logger");

/**
 * ============================================================
 * 📋 Listar registros de auditoría con paginación y filtros
 * ------------------------------------------------------------
 * Filtros disponibles:
 * - user_id / email
 * - module / action
 * - date_from / date_to
 * ============================================================
 */
async function listAudits(options = {}) {
  const {
    page = 1,
    limit = 50,
    user_id,
    email,
    module,
    action,
    date_from,
    date_to,
    request_id,
    mantenimiento_id,
    inventario_id,
    auto,
  } = options;

  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  const pushCondition = (statement, value) => {
    params.push(value);
    conditions.push(statement.replace("?", `$${params.length}`));
  };

  const toInt = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const normalizedUser = toInt(user_id);
  if (normalizedUser !== null) pushCondition("a.usuario_id = ?", normalizedUser);
  if (email) pushCondition("LOWER(a.usuario_email) = LOWER(?)", email);
  if (module) pushCondition("LOWER(a.modulo) = LOWER(?)", module);
  if (action) pushCondition("LOWER(a.accion) = LOWER(?)", action);
  const normalizedRequest = toInt(request_id);
  if (normalizedRequest !== null) pushCondition("a.request_id = ?", normalizedRequest);
  const normalizedMaint = toInt(mantenimiento_id);
  if (normalizedMaint !== null) pushCondition("a.mantenimiento_id = ?", normalizedMaint);
  const normalizedInventory = toInt(inventario_id);
  if (normalizedInventory !== null)
    pushCondition("a.inventario_id = ?", normalizedInventory);

  const normalizeDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const fromDate = normalizeDate(date_from);
  const toDate = normalizeDate(date_to);
  if (fromDate) pushCondition("a.creado_en >= ?", fromDate);
  if (toDate) pushCondition("a.creado_en <= ?", toDate);

  if (auto !== undefined) {
    const boolValue =
      typeof auto === "string" ? auto.toLowerCase() === "true" : Boolean(auto);
    pushCondition("a.auto = ?", boolValue);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT a.id,
           a.usuario_id,
           a.usuario_email,
           a.rol,
           a.modulo,
           a.accion,
           a.descripcion,
           a.datos_anteriores,
           a.datos_nuevos,
           a.ip,
           a.user_agent,
           a.duracion_ms,
           a.request_id,
           a.mantenimiento_id,
           a.inventario_id,
           a.auto,
           a.creado_en
      FROM auditoria.logs a
      ${where}
     ORDER BY a.creado_en DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;

  const countSql = `SELECT COUNT(*) FROM auditoria.logs a ${where};`;

  const queryParams = [...params, limit, offset];
  const { rows } = await db.query(sql, queryParams);
  const { rows: totalRows } = await db.query(countSql, params);

  const total = parseInt(totalRows[0]?.count || 0, 10);

  logger.audit(`[AUDIT] Consulta de ${rows.length} registros`, {
    page,
    limit,
    filters: { user_id, email, module, action },
  });

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    rows,
  };
}

/**
 * ============================================================
 * 🔍 Obtener detalle individual
 * ============================================================
 */
async function getDetail(id) {
  const { rows } = await db.query(
    `SELECT *
       FROM auditoria.logs
      WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * ============================================================
 * 📤 Exportar registros filtrados a CSV
 * ============================================================
 */
async function exportCsv(filters = {}) {
  const result = await listAudits({ ...filters, page: 1, limit: 10000 });
  const data = result.rows.map((r) => ({
    ID: r.id,
    Usuario: r.usuario_email || "",
    Rol: r.rol || "",
    Modulo: r.modulo || "",
    Accion: r.accion || "",
    Descripcion: r.descripcion || "",
    RequestID: r.request_id || "",
    MantenimientoID: r.mantenimiento_id || "",
    InventarioID: r.inventario_id || "",
    Auto: r.auto ? "sí" : "no",
    DuracionMs: r.duracion_ms || "",
    IP: r.ip || "",
    Fecha: r.creado_en ? new Date(r.creado_en).toISOString() : "",
    UserAgent: r.user_agent?.substring(0, 140) || "",
  }));

  const csv = stringify(data, { header: true, delimiter: ";" });
  logger.audit(`[AUDIT] Exportación CSV completada (${data.length} filas)`);
  return csv;
}

module.exports = {
  listAudits,
  getDetail,
  exportCsv,
};
