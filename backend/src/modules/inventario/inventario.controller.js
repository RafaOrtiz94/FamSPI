/**
 * Controller: Inventario
 * ------------------------------------------------------------
 * Maneja solicitudes HTTP y valida parámetros
 */

const {
  getAllInventario,
  registrarMovimiento,
  createUnidad,
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
  const { estado, serial_pendiente, cliente_id, incluir_no_asignados } = req.query;

  const filters = {
    estado: estado || undefined,
    serial_pendiente,
    cliente_id: cliente_id !== undefined ? cliente_id : null,
  };

  let equipos = await getAllInventario(filters);

  const includeUnassigned = String(incluir_no_asignados || "").toLowerCase() === "true";
  if (includeUnassigned && cliente_id) {
    const unassigned = await getAllInventario({
      estado: estado || undefined,
      serial_pendiente,
      cliente_id: null,
    });
    const seen = new Set(equipos.map((row) => row.unidad_id || row.inventory_id || row.id));
    equipos = [...equipos, ...unassigned.filter((row) => !seen.has(row.unidad_id || row.inventory_id || row.id))];
  }

  const simplified = equipos
    .map((row) => ({
      id: row.unidad_id || row.inventory_id || row.id || row.item_id || row.itemid,
      nombre: row.item_name || row.nombre || row.name,
      tipo: row.tipo || row.type || row.category,
      marca: row.marca || row.brand,
      modelo: row.modelo || row.model,
      estado: row.estado || row.status || row.estado_actual || row.item_status,
      ubicacion: row.ubicacion || row.location || row.ubicacion_actual,
      serial: row.serial || row.serial_number || row.serie || null,
      serial_pendiente: typeof row.serial_pendiente === "boolean" ? row.serial_pendiente : Boolean(row.serial_pendiente),
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

exports.createUnidad = asyncHandler(async (req, res) => {
  const { modelo_id, serial = null, cliente_id = null, sucursal_id = null } = req.body || {};
  const userId = req.user?.id || null;

  if (!modelo_id) {
    return res.status(400).json({ ok: false, message: "modelo_id es requerido" });
  }

  try {
    const result = await createUnidad({
      modelo_id,
      serial,
      cliente_id,
      sucursal_id,
      user_id: userId,
    });
    res.status(201).json({ ok: true, data: result });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ ok: false, message: error.message || "No se pudo crear la unidad" });
  }
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

exports.getEquiposPorCliente = asyncHandler(async (req, res) => {
  req.query.cliente_id = req.params?.cliente_id;
  return exports.getEquiposDisponibles(req, res);
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
