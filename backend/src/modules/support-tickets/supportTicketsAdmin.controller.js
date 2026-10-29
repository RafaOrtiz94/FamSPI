const kpiService = require("./supportTicketsKpi.service");
const reportsService = require("./supportTicketsReports.service");
const exportService = require("./supportTicketsExport.service");
const db = require("../../config/db");

const handleError = (res, error, fallbackMessage) => {
  const status = error?.status || 500;
  return res.status(status).json({
    ok: false,
    message: error?.message || fallbackMessage,
  });
};

async function listKpiDefinitions(req, res) {
  try {
    const data = await kpiService.listKpiDefinitions({});
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar los KPIs");
  }
}

async function getKpiMetricCatalog(req, res) {
  try {
    const data = kpiService.getMetricCatalog();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo obtener el catalogo de metricas");
  }
}

async function createKpiDefinition(req, res) {
  try {
    const data = await kpiService.createKpiDefinition({ payload: req.body || {}, actorUserId: req.user.id });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo crear el KPI");
  }
}

async function updateKpiDefinition(req, res) {
  try {
    const data = await kpiService.updateKpiDefinition({
      id: Number(req.params.id),
      payload: req.body || {},
      actorUserId: req.user.id,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo actualizar el KPI");
  }
}

async function deleteKpiDefinition(req, res) {
  try {
    const data = await kpiService.deleteKpiDefinition(Number(req.params.id));
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo eliminar el KPI");
  }
}

async function reorderKpiDefinitions(req, res) {
  try {
    const data = await kpiService.reorderKpiDefinitions(req.body || []);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo reordenar los KPIs");
  }
}

async function getMonthlyReport(req, res) {
  try {
    const data = await reportsService.getMonthlyReport({
      year: req.query.year,
      month: req.query.month,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo generar el reporte mensual");
  }
}

async function exportMonthlyReport(req, res) {
  try {
    const report = await reportsService.getMonthlyReport({
      year: req.query.year,
      month: req.query.month,
    });
    const format = String(req.query.format || "pdf").toLowerCase();
    const { buffer, filename, mimeType } = await exportService.generateMonthlyReportBuffer({ report, format });

    try {
      await db.query(
        `INSERT INTO support_ticket_report_exports (report_year, report_month, format, requested_by)
         VALUES ($1, $2, $3, $4)`,
        [report.period.year, report.period.month, format === "xlsx" ? "xlsx" : "pdf", req.user?.id || null]
      );
    } catch (auditError) {
      // Auditoria no bloqueante: la descarga no debe fallar por esto.
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    return handleError(res, error, "No se pudo exportar el reporte mensual");
  }
}

module.exports = {
  listKpiDefinitions,
  getKpiMetricCatalog,
  createKpiDefinition,
  updateKpiDefinition,
  deleteKpiDefinition,
  reorderKpiDefinitions,
  getMonthlyReport,
  exportMonthlyReport,
};
