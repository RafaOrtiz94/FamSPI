/**
 * Reportes mensuales del workspace de tickets de soporte TI.
 * Calculo on-demand (sin snapshots) -- el volumen interno de tickets es
 * bajo y los indices de support_tickets (migracion 088) hacen barata la
 * agregacion, igual que backend/src/modules/dashboard/dashboard.service.js
 * hace con volumenes mayores.
 */
const db = require("../../config/db");
const kpiService = require("./supportTicketsKpi.service");

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function parseYearMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw badRequest("year invalido");
  if (!Number.isInteger(m) || m < 1 || m > 12) throw badRequest("month invalido (1-12)");
  return { year: y, month: m };
}

// Normaliza filas { mes: 'YYYY-MM', total } a un arreglo continuo de 6 meses
// (incluye meses sin datos con total 0), igual que el patron de
// dashboard.service.js pero garantizando continuidad para el eje de tiempo.
function fillMonthlySeries(rows, monthsBack, referenceDate) {
  const byMonth = new Map(rows.map((r) => [r.mes, Number(r.total || 0)]));
  const labels = [];
  const data = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    labels.push(key);
    data.push(byMonth.get(key) || 0);
  }
  return { labels, data };
}

async function getMonthlyReport({ year, month }) {
  const period = parseYearMonth(year, month);
  const referenceDate = new Date(Date.UTC(period.year, period.month - 1, 1));
  const monthStartParam = `${period.year}-${String(period.month).padStart(2, "0")}-01`;

  const [
    volumeByTypeResult,
    volumeByStatusResult,
    volumeByPriorityResult,
    trendTotalResult,
    trendByTypeResult,
    slaResult,
    slaTrendResult,
    timesResult,
    csatResult,
    csatDistributionResult,
    technicianRankingResult,
    kpiDefinitions,
  ] = await Promise.all([
    db.query(
      `SELECT ticket_type, COUNT(*)::int AS total FROM support_tickets t
       WHERE t.created_at >= $1::date AND t.created_at < $1::date + interval '1 month'
       GROUP BY ticket_type ORDER BY total DESC`,
      [monthStartParam]
    ),
    db.query(
      `SELECT status, COUNT(*)::int AS total FROM support_tickets t
       WHERE t.created_at >= $1::date AND t.created_at < $1::date + interval '1 month'
       GROUP BY status ORDER BY total DESC`,
      [monthStartParam]
    ),
    db.query(
      `SELECT priority, COUNT(*)::int AS total FROM support_tickets t
       WHERE t.created_at >= $1::date AND t.created_at < $1::date + interval '1 month'
       GROUP BY priority ORDER BY total DESC`,
      [monthStartParam]
    ),
    db.query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes, COUNT(*)::int AS total
       FROM support_tickets
       WHERE created_at >= date_trunc('month', $1::date) - INTERVAL '5 months'
         AND created_at < date_trunc('month', $1::date) + INTERVAL '1 month'
       GROUP BY 1 ORDER BY 1`,
      [monthStartParam]
    ),
    db.query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes, ticket_type, COUNT(*)::int AS total
       FROM support_tickets
       WHERE created_at >= date_trunc('month', $1::date) - INTERVAL '5 months'
         AND created_at < date_trunc('month', $1::date) + INTERVAL '1 month'
       GROUP BY 1, 2 ORDER BY 1`,
      [monthStartParam]
    ),
    db.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE t.first_response_due_at IS NOT NULL)::int AS response_measurable,
          COUNT(*) FILTER (WHERE NOT t.sla_response_breached AND t.first_response_at IS NOT NULL AND t.first_response_due_at IS NOT NULL)::int AS response_compliant,
          COUNT(*) FILTER (WHERE t.resolution_due_at IS NOT NULL)::int AS resolution_measurable,
          COUNT(*) FILTER (WHERE NOT t.sla_resolution_breached AND t.resolved_at IS NOT NULL AND t.resolution_due_at IS NOT NULL)::int AS resolution_compliant
        FROM support_tickets t
        WHERE t.created_at >= $1::date AND t.created_at < $1::date + interval '1 month'
      `,
      [monthStartParam]
    ),
    db.query(
      `
        SELECT
          to_char(date_trunc('month', t.created_at), 'YYYY-MM') AS mes,
          ROUND(100.0 * COUNT(*) FILTER (WHERE NOT t.sla_response_breached AND t.first_response_at IS NOT NULL AND t.first_response_due_at IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE t.first_response_due_at IS NOT NULL), 0), 2) AS response_pct,
          ROUND(100.0 * COUNT(*) FILTER (WHERE NOT t.sla_resolution_breached AND t.resolved_at IS NOT NULL AND t.resolution_due_at IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE t.resolution_due_at IS NOT NULL), 0), 2) AS resolution_pct
        FROM support_tickets t
        WHERE t.created_at >= date_trunc('month', $1::date) - INTERVAL '5 months'
          AND t.created_at < date_trunc('month', $1::date) + INTERVAL '1 month'
        GROUP BY 1 ORDER BY 1
      `,
      [monthStartParam]
    ),
    db.query(
      `
        SELECT
          ROUND(AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 60.0) FILTER (WHERE t.first_response_at IS NOT NULL), 2) AS avg_response_minutes,
          ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - t.created_at)) / 60.0) FILTER (WHERE t.status IN ('resuelto', 'cerrado')), 2) AS avg_cycle_minutes,
          ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - COALESCE(ev.first_in_progress_at, t.first_response_at, t.created_at))) / 60.0) FILTER (WHERE t.status IN ('resuelto', 'cerrado')), 2) AS avg_delivery_minutes
        FROM support_tickets t
        LEFT JOIN LATERAL (
          SELECT MIN(e.created_at) FILTER (WHERE e.new_status = 'en_progreso') AS first_in_progress_at
          FROM support_ticket_events e WHERE e.ticket_id = t.id
        ) ev ON TRUE
        WHERE t.created_at >= $1::date AND t.created_at < $1::date + interval '1 month'
      `,
      [monthStartParam]
    ),
    db.query(
      `SELECT ROUND(AVG(satisfaction_score), 2) AS csat_avg, COUNT(satisfaction_score)::int AS csat_count
       FROM support_tickets t
       WHERE t.created_at >= $1::date AND t.created_at < $1::date + interval '1 month'
         AND satisfaction_score IS NOT NULL`,
      [monthStartParam]
    ),
    db.query(
      `SELECT satisfaction_score AS score, COUNT(*)::int AS total
       FROM support_tickets t
       WHERE t.created_at >= $1::date AND t.created_at < $1::date + interval '1 month'
         AND satisfaction_score IS NOT NULL
       GROUP BY satisfaction_score ORDER BY satisfaction_score`,
      [monthStartParam]
    ),
    db.query(
      `
        SELECT
          u.id AS technician_id,
          u.fullname AS technician_name,
          COUNT(*) FILTER (WHERE t.status IN ('resuelto', 'cerrado'))::int AS resolved_count,
          ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - COALESCE(ev.first_in_progress_at, t.first_response_at, t.created_at))) / 60.0) FILTER (WHERE t.status IN ('resuelto', 'cerrado')), 2) AS avg_delivery_minutes,
          ROUND(AVG(t.satisfaction_score) FILTER (WHERE t.satisfaction_score IS NOT NULL), 2) AS csat_avg
        FROM support_tickets t
        JOIN users u ON u.id = t.assigned_ti_user_id
        LEFT JOIN LATERAL (
          SELECT MIN(e.created_at) FILTER (WHERE e.new_status = 'en_progreso') AS first_in_progress_at
          FROM support_ticket_events e WHERE e.ticket_id = t.id
        ) ev ON TRUE
        WHERE t.created_at >= $1::date AND t.created_at < $1::date + interval '1 month'
          AND t.assigned_ti_user_id IS NOT NULL
        GROUP BY u.id, u.fullname
        ORDER BY resolved_count DESC, technician_name ASC
        LIMIT 20
      `,
      [monthStartParam]
    ),
    kpiService.listKpiDefinitionsWithValues({ reportsOnly: true, asOfMonth: period }),
  ]);

  const trendTotal = fillMonthlySeries(trendTotalResult.rows, 6, referenceDate);

  const trendByTypeMap = new Map();
  trendByTypeResult.rows.forEach((row) => {
    if (!trendByTypeMap.has(row.ticket_type)) trendByTypeMap.set(row.ticket_type, []);
    trendByTypeMap.get(row.ticket_type).push({ mes: row.mes, total: row.total });
  });
  const trendByType = Array.from(trendByTypeMap.entries()).map(([ticketType, rows]) => ({
    ticket_type: ticketType,
    ...fillMonthlySeries(rows, 6, referenceDate),
  }));

  const slaRow = slaResult.rows[0] || {};
  const slaResponsePct = slaRow.response_measurable > 0
    ? Math.round((slaRow.response_compliant / slaRow.response_measurable) * 10000) / 100
    : null;
  const slaResolutionPct = slaRow.resolution_measurable > 0
    ? Math.round((slaRow.resolution_compliant / slaRow.resolution_measurable) * 10000) / 100
    : null;

  const slaTrend = {
    labels: [],
    responseData: [],
    resolutionData: [],
  };
  const slaTrendFilled = fillMonthlySeries(
    slaTrendResult.rows.map((r) => ({ mes: r.mes, total: r.response_pct })),
    6,
    referenceDate
  );
  const slaResolutionFilled = fillMonthlySeries(
    slaTrendResult.rows.map((r) => ({ mes: r.mes, total: r.resolution_pct })),
    6,
    referenceDate
  );
  slaTrend.labels = slaTrendFilled.labels;
  slaTrend.responseData = slaTrendFilled.data;
  slaTrend.resolutionData = slaResolutionFilled.data;

  const timesRow = timesResult.rows[0] || {};
  const csatRow = csatResult.rows[0] || {};

  return {
    period: {
      year: period.year,
      month: period.month,
      label: referenceDate.toLocaleDateString("es-EC", { month: "long", year: "numeric", timeZone: "UTC" }),
    },
    volume: {
      total: volumeByStatusResult.rows.reduce((sum, r) => sum + Number(r.total || 0), 0),
      byType: volumeByTypeResult.rows.map((r) => ({ label: r.ticket_type, total: Number(r.total) })),
      byStatus: volumeByStatusResult.rows.map((r) => ({ label: r.status, total: Number(r.total) })),
      byPriority: volumeByPriorityResult.rows.map((r) => ({ label: r.priority, total: Number(r.total) })),
    },
    trend: {
      total: trendTotal,
      byType: trendByType,
    },
    sla: {
      responseCompliancePct: slaResponsePct,
      resolutionCompliancePct: slaResolutionPct,
      responseMeasurable: Number(slaRow.response_measurable || 0),
      resolutionMeasurable: Number(slaRow.resolution_measurable || 0),
      trend: slaTrend,
    },
    times: {
      avgResponseMinutes: timesRow.avg_response_minutes !== null && timesRow.avg_response_minutes !== undefined ? Number(timesRow.avg_response_minutes) : null,
      avgCycleMinutes: timesRow.avg_cycle_minutes !== null && timesRow.avg_cycle_minutes !== undefined ? Number(timesRow.avg_cycle_minutes) : null,
      avgDeliveryMinutes: timesRow.avg_delivery_minutes !== null && timesRow.avg_delivery_minutes !== undefined ? Number(timesRow.avg_delivery_minutes) : null,
    },
    csat: {
      average: csatRow.csat_avg !== null && csatRow.csat_avg !== undefined ? Number(csatRow.csat_avg) : null,
      responses: Number(csatRow.csat_count || 0),
      distribution: csatDistributionResult.rows.map((r) => ({ score: Number(r.score), total: Number(r.total) })),
    },
    technicianRanking: technicianRankingResult.rows.map((r) => ({
      technicianId: Number(r.technician_id),
      technicianName: r.technician_name,
      resolvedCount: Number(r.resolved_count || 0),
      avgDeliveryMinutes: r.avg_delivery_minutes !== null && r.avg_delivery_minutes !== undefined ? Number(r.avg_delivery_minutes) : null,
      csatAvg: r.csat_avg !== null && r.csat_avg !== undefined ? Number(r.csat_avg) : null,
    })),
    kpis: kpiDefinitions,
  };
}

module.exports = {
  getMonthlyReport,
};
