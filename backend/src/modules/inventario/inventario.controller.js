/**
 * Controller: Inventario
 * ------------------------------------------------------------
 * Maneja solicitudes HTTP y valida parámetros
 */

const {
  getAllInventario,
  registrarMovimiento,
  captureSerial,
  assignUnidad,
  cambiarEstadoUnidad,
} = require("./inventario.service");
const { asyncHandler } = require("../../middlewares/asyncHandler");
const logger = require("../../config/logger");

/* ============================================================
   🔍 GET /api/v1/inventario
   ============================================================ */
exports.getInventario = asyncHandler(async (req, res) => {
  const { search, tipo, request_id, estado } = req.query;
  logger.info(
    "[inventario] GET → search=%s tipo=%s request_id=%s",
    search || null,
    tipo || null,
    request_id || null
  );
  const data = await getAllInventario({ search, tipo, request_id, estado });
  logger.info("[inventario] GET ← %s registros", data.length);
  res.status(200).json({ ok: true, total: data.length, data });
});

/* ============================================================
   📋 GET /api/v1/inventario/equipos-disponibles
   ============================================================ */
exports.getEquiposDisponibles = asyncHandler(async (req, res) => {
  const { estado, serial_pendiente, cliente_id } = req.query;
  const clienteFilter = cliente_id !== undefined ? cliente_id : null;
  const estadoFilter = estado || (cliente_id ? undefined : "disponible");

  const equipos = await getAllInventario({
    estado: estadoFilter,
    serial_pendiente,
    cliente_id: clienteFilter,
  });
  const simplified = equipos
    .map((row) => ({
      id: row.inventory_id || row.id || row.item_id || row.itemid,
      nombre: row.item_name || row.nombre || row.name,
      tipo: row.tipo || row.type || row.category,
      marca: row.marca || row.brand,
      modelo: row.modelo || row.model,
      estado: row.estado || row.status || row.estado_actual || row.item_status,
      ubicacion: row.ubicacion || row.location || row.ubicacion_actual,
      serial: row.serial || row.serial_number || row.serie || null,
      serial_pendiente: typeof row.serial_pendiente === "boolean" ? row.serial_pendiente : undefined,
      unidad_id: row.unidad_id || row.id || null,
    }))
    .sort((a, b) => {
      if (a.serial_pendiente === b.serial_pendiente) return 0;
      if (a.serial_pendiente === true) return -1;
      if (b.serial_pendiente === true) return 1;
      return 0;
    });

  res.status(200).json({ ok: true, data: simplified });
});

exports.captureSerial = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { serial, cliente_id = null, sucursal_id = null, request_id = null, detalle = null } = req.body || {};
  const userId = req.user?.id || null;

  if (!serial || !String(serial).trim()) {
    return res.status(400).json({ ok: false, message: "El serial es obligatorio" });
  }
  try {
    const result = await captureSerial({
      unidad_id: id,
      serial: String(serial).trim(),
      cliente_id,
      sucursal_id,
      request_id,
      detalle,
      user_id: userId,
    });

    res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const status = error.status || (error.message?.includes("serial") ? 409 : 500);
    res.status(status).json({ ok: false, message: error.message || "No se pudo guardar el serial" });
  }
});

exports.assignUnidad = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cliente_id, sucursal_id = null, detalle = null } = req.body || {};
  const userId = req.user?.id || null;

  const result = await assignUnidad({
    unidad_id: id,
    cliente_id,
    sucursal_id,
    detalle,
    user_id: userId,
  });

  res.status(200).json({ ok: true, data: result });
});

exports.cambiarEstadoUnidad = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { estado, detalle = null, request_id = null } = req.body || {};
  const userId = req.user?.id || null;

  const result = await cambiarEstadoUnidad({
    unidad_id: id,
    estado,
    detalle,
    request_id,
    user_id: userId,
  });

  res.status(200).json({ ok: true, data: result });
});

/* ============================================================
   ➕ POST /api/v1/inventario/movimiento
   ============================================================ */
exports.addMovimiento = asyncHandler(async (req, res) => {
  const { inventory_id, quantity, movement_type } = req.body;
  const created_by = req.user?.id || null;

  if (!inventory_id || !quantity || !movement_type) {
    return res.status(400).json({ ok: false, message: "Campos requeridos: inventory_id, quantity, movement_type" });
  }

  const result = await registrarMovimiento({ inventory_id, quantity, movement_type, created_by });
  res.status(201).json({ ok: true, data: result });
});
