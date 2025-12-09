/**
 * Service: Inventario
 * ------------------------------------------------------------
 * Interactúa con la vista SQL v_inventario_completo
 * y con las tablas inventory / inventory_movements
 */

const db = require("../../config/db");
const logger = require("../../config/logger");

const ALLOWED_STATES = new Set([
  "no_asignado",
  "asignado",
  "reservado",
  "en_transito",
  "retirado",
  "baja",
  "mantenimiento_programado",
  "en_mantenimiento",
  "en_evaluacion",
  "evaluado",
  "proceso_retiro",
]);

async function listModelos({ search } = {}) {
  try {
    const params = [];
    let where = "";

    if (search) {
      params.push(`%${String(search).toLowerCase()}%`);
      where = `WHERE LOWER(nombre) LIKE $1 OR LOWER(modelo) LIKE $1 OR LOWER(fabricante) LIKE $1`;
    }

    const { rows } = await db.query(
      `SELECT id, sku, nombre, fabricante, modelo, categoria
         FROM public.equipos_modelo
         ${where}
        ORDER BY nombre ASC`,
      params,
    );

    return rows;
  } catch (err) {
    logger.error("❌ Error listando modelos: %o", err);
    throw new Error("Error al obtener modelos de equipos");
  }
}

/* ============================================================
   🧭 Obtener todo el inventario (vista completa)
   ============================================================ */
async function getAllInventario({ search, tipo, request_id, estado, serial_pendiente, cliente_id }) {
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

    if (serial_pendiente !== undefined) {
      params.push(Boolean(serial_pendiente));
      query += ` AND serial_pendiente = $${params.length}`;
    }

    if (cliente_id !== undefined) {
      if (cliente_id === null) {
        query += ` AND cliente_id IS NULL`;
      } else {
        params.push(cliente_id);
        query += ` AND cliente_id = $${params.length}`;
      }
    }

    query += ` ORDER BY item_name ASC;`;

    const { rows } = await db.query(query, params);

    const filtered = request_id
      ? rows.filter(
          (row) =>
            `${row.request_id || row.silver_tx_id || ""}`.trim() ===
            `${request_id}`.trim()
        )
      : rows;

    if (estado) {
      const estadoLower = String(estado).toLowerCase();
      return filtered.filter((row) => {
        const candidates = [
          row.estado,
          row.status,
          row.estado_actual,
          row.item_status,
        ];
        return candidates
          .map((value) => (value ? String(value).toLowerCase() : ""))
          .some((value) => value === estadoLower);
      });
    }

    return filtered;
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

async function createUnidad({ modelo_id, serial = null, cliente_id = null, sucursal_id = null, user_id = null }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: modeloRows } = await client.query(
      `SELECT id, nombre, modelo FROM public.equipos_modelo WHERE id = $1 LIMIT 1`,
      [modelo_id],
    );

    if (!modeloRows.length) {
      const error = new Error("Modelo no encontrado");
      error.status = 400;
      throw error;
    }

    const cleanedSerial = serial && String(serial).trim().length ? String(serial).trim() : null;
    const serialPendiente = !cleanedSerial;
    const finalSerial = cleanedSerial || `SIN-SERIE-${Date.now()}`;

    const { rows: duplicates } = await client.query(
      `SELECT id FROM public.equipos_unidad WHERE LOWER(serial) = LOWER($1) LIMIT 1`,
      [finalSerial],
    );
    if (duplicates.length) {
      const error = new Error("El serial ya está registrado en otra unidad");
      error.status = 409;
      throw error;
    }

    const { rows } = await client.query(
      `INSERT INTO public.equipos_unidad (modelo_id, serial, serial_pendiente, cliente_id, sucursal_id, estado, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'no_asignado', now(), now())
       RETURNING id, serial, serial_pendiente, estado`,
      [modelo_id, finalSerial, serialPendiente, cliente_id, sucursal_id],
    );

    const unidad = rows[0];

    await client.query(
      `INSERT INTO public.equipos_historial (unidad_id, evento, detalle, cliente_id, sucursal_id, created_by, created_at)
       VALUES ($1, 'unidad_creada', $2, $3, $4, $5, now())`,
      [unidad.id, serialPendiente ? "Unidad creada sin serial" : "Unidad creada con serial", cliente_id, sucursal_id, user_id],
    );

    await client.query("COMMIT");
    return unidad;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("❌ Error al crear unidad: %o", error);
    throw error;
  } finally {
    client.release();
  }
}

async function captureSerial({ unidad_id, serial, cliente_id = null, sucursal_id = null, request_id = null, detalle = null, user_id = null }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: existingRows } = await client.query(
      `SELECT id, serial, serial_pendiente, estado
         FROM public.equipos_unidad
        WHERE id = $1
        LIMIT 1`,
      [unidad_id],
    );

    const current = existingRows[0];
    if (!current) {
      throw new Error("Unidad no encontrada");
    }

    const { rows: duplicates } = await client.query(
      `SELECT id FROM public.equipos_unidad WHERE LOWER(serial) = LOWER($1) AND id <> $2 LIMIT 1`,
      [serial, unidad_id],
    );
    if (duplicates.length) {
      const error = new Error("El serial ya está registrado en otra unidad");
      error.status = 409;
      throw error;
    }

    await client.query(
      `UPDATE public.equipos_unidad
          SET serial = $1,
              serial_pendiente = false,
              cliente_id = COALESCE($2, cliente_id),
              sucursal_id = COALESCE($3, sucursal_id),
              request_id = COALESCE($4, request_id),
              updated_at = now()
        WHERE id = $5`,
      [serial, cliente_id, sucursal_id, request_id, unidad_id],
    );

    const evento = current.serial && current.serial === serial ? "serial_confirmado" : "serial_capturado";
    await client.query(
      `INSERT INTO public.equipos_historial (unidad_id, evento, detalle, request_id, cliente_id, sucursal_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [unidad_id, evento, detalle || null, request_id, cliente_id, sucursal_id, user_id],
    );

    await client.query("COMMIT");
    return { unidad_id, serial, evento };
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("❌ Error capturando serial: %o", error);
    throw error;
  } finally {
    client.release();
  }
}

async function assignUnidad({ unidad_id, cliente_id, sucursal_id = null, detalle = null, user_id = null }) {
  if (!cliente_id) {
    const error = new Error("cliente_id es requerido para asignar la unidad");
    error.status = 400;
    throw error;
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE public.equipos_unidad
          SET cliente_id = $1,
              sucursal_id = COALESCE($2, sucursal_id),
              estado = 'asignado',
              updated_at = now()
        WHERE id = $3
        RETURNING id, serial, estado`,
      [cliente_id, sucursal_id, unidad_id],
    );

    if (!rows.length) {
      throw new Error("Unidad no encontrada");
    }

    await client.query(
      `INSERT INTO public.equipos_historial (unidad_id, evento, detalle, cliente_id, sucursal_id, created_by, created_at)
       VALUES ($1, 'asignacion', $2, $3, $4, $5, now())`,
      [unidad_id, detalle || "Unidad asignada", cliente_id, sucursal_id, user_id],
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("❌ Error al asignar unidad: %o", error);
    throw error;
  } finally {
    client.release();
  }
}

async function cambiarEstadoUnidad({ unidad_id, estado, detalle = null, request_id = null, user_id = null }) {
  const estadoNormalizado = estado ? String(estado).toLowerCase() : null;
  if (!ALLOWED_STATES.has(estadoNormalizado)) {
    const error = new Error("Estado no permitido");
    error.status = 400;
    throw error;
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE public.equipos_unidad
          SET estado = $1,
              updated_at = now()
        WHERE id = $2
        RETURNING id, serial, estado`,
      [estadoNormalizado, unidad_id],
    );

    if (!rows.length) {
      throw new Error("Unidad no encontrada");
    }

    await client.query(
      `INSERT INTO public.equipos_historial (unidad_id, evento, detalle, request_id, created_by, created_at)
       VALUES ($1, 'estado_actualizado', $2, $3, $4, now())`,
      [unidad_id, detalle || estadoNormalizado, request_id, user_id],
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("❌ Error al cambiar estado de unidad: %o", error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getAllInventario,
  registrarMovimiento,
  listModelos,
  createUnidad,
  captureSerial,
  assignUnidad,
  cambiarEstadoUnidad,
};
