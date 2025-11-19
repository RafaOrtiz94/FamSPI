/**
 * Service: Inventario
 * ------------------------------------------------------------
 * Interactúa con la vista SQL v_inventario_completo
 * y con las tablas inventory / inventory_movements
 */

const db = require("../../config/db");
const logger = require("../../config/logger");

/* ============================================================
   🧭 Obtener todo el inventario (vista completa)
   ============================================================ */
async function getAllInventario({ search, tipo, request_id }) {
  try {
    let query = `SELECT * FROM public.v_inventario_completo WHERE 1=1`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (item_name ILIKE $${params.length} OR sku ILIKE $${params.length})`;
    }

    if (tipo && (tipo === "entrada" || tipo === "salida")) {
      params.push(tipo);
      query += ` AND tipo_ultimo_movimiento = $${params.length}`;
    }

    query += ` ORDER BY item_name ASC;`;

    const { rows } = await db.query(query, params);
    if (request_id) {
      return rows.filter(
        (row) =>
          `${row.request_id || row.silver_tx_id || ""}`.trim() ===
          `${request_id}`.trim()
      );
    }

    return rows;
  } catch (err) {
    logger.error("❌ Error al obtener inventario: %o", err);
    throw new Error("Error al consultar inventario");
  }
}

/* ============================================================
   ➕ Registrar movimiento (entrada/salida)
   ============================================================ */
async function registrarMovimiento({ inventory_id, quantity, movement_type, created_by }) {
  try {
    const { rows } = await db.query(
      `INSERT INTO public.inventory_movements (inventory_id, quantity, movement_type, created_by, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *;`,
      [inventory_id, quantity, movement_type, created_by]
    );

    logger.info(`📦 Movimiento registrado: ${movement_type} x${quantity} (item ${inventory_id})`);
    return rows[0];
  } catch (err) {
    logger.error("❌ Error al registrar movimiento: %o", err);
    throw new Error("Error al registrar movimiento de inventario");
  }
}

module.exports = {
  getAllInventario,
  registrarMovimiento,
};
