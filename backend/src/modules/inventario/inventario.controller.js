/**
 * Controller: Inventario
 * ------------------------------------------------------------
 * Maneja solicitudes HTTP y valida parámetros
 */

const { getAllInventario, registrarMovimiento } = require("./inventario.service");
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
  const { estado } = req.query;

  const equipos = await getAllInventario({ estado: estado || "disponible" });
  const simplified = equipos.map((row) => ({
    id: row.inventory_id || row.id || row.item_id || row.itemid,
    nombre: row.item_name || row.nombre || row.name,
    tipo: row.tipo || row.type || row.category,
    marca: row.marca || row.brand,
    modelo: row.modelo || row.model,
    estado: row.estado || row.status || row.estado_actual || row.item_status,
    ubicacion: row.ubicacion || row.location || row.ubicacion_actual,
  }));

  res.status(200).json({ ok: true, data: simplified });
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
