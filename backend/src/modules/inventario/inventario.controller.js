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
  const { search, tipo, request_id } = req.query;
  logger.info(
    "[inventario] GET → search=%s tipo=%s request_id=%s",
    search || null,
    tipo || null,
    request_id || null
  );
  const data = await getAllInventario({ search, tipo, request_id });
  logger.info("[inventario] GET ← %s registros", data.length);
  res.status(200).json({ ok: true, total: data.length, data });
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
