// ============================================================
// 🧾 audit.controller.js
// ------------------------------------------------------------
// Controlador principal del módulo de auditoría SPI Fam Project
// Permite listar, filtrar, detallar y exportar registros de logs.
// ============================================================

const svc = require("./auditoria.service");
const { asyncHandler } = require("../../middlewares/asyncHandler");
const logger = require("../../config/logger");

// ============================================================
// 🔹 Obtener lista paginada de auditorías con filtros
// GET /api/auditoria
// ============================================================
exports.listAudits = asyncHandler(async (req, res) => {
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
  } = req.query;

  const filters = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
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
  };

  filters.page = Number.isNaN(filters.page) ? 1 : Math.max(1, filters.page);
  filters.limit = Number.isNaN(filters.limit)
    ? 50
    : Math.max(1, Math.min(500, filters.limit));

  const result = await svc.listAudits(filters);

  logger.audit(`Listado de auditorías — ${result.rows.length} registros`);

  return res.status(200).json({
    ok: true,
    total: result.total,
    page: filters.page,
    limit: filters.limit,
    audits: result.rows,
  });
});

// ============================================================
// 🔹 Obtener detalle de un registro de auditoría
// GET /api/auditoria/:id
// ============================================================
exports.getDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const audit = await svc.getDetail(id);
  if (!audit)
    return res.status(404).json({ ok: false, error: "Registro no encontrado" });

  logger.audit(`Consulta detalle de log ID=${id}`);
  return res.status(200).json({ ok: true, audit });
});

// ============================================================
// 🔹 Exportar logs a CSV
// GET /api/auditoria/export
// ============================================================
exports.exportCsv = asyncHandler(async (req, res) => {
  const csvData = await svc.exportCsv(req.query);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="audit_trail_SPI_Fam.csv"'
  );

  logger.audit("Exportación de logs en CSV completada");
  return res.send(csvData);
});
