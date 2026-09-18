import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowDown, FiArrowUp, FiDownload, FiEdit2, FiPlus, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import {
  deleteTiKpiDefinition,
  exportTiMonthlyReport,
  getTiMonthlyReport,
  listTiKpiDefinitions,
  reorderTiKpiDefinitions,
} from "../../../core/api/supportTicketsApi";
import { useUI } from "../../../core/ui/UIContext";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import { toStatusLabel } from "../../../core/utils/workflowUi";
import Button from "../../../core/ui/components/Button";
import "../design/tokens.css";
import { TicketMetric, statusToTone } from "../design";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Paleta de datos de FamSPI (DESIGN.md §11): usada solo para series de
// identidad (tipo de ticket, SLA respuesta/resolucion). El estado de un
// ticket es una dimension semantica, no de identidad -- para el doughnut de
// estados se usan los tokens de estado (success/warning/danger/info) via
// statusToTone, no esta paleta categorica.
const DATA_SERIES_COLORS = ["#2458D3", "#7654A3", "#167D8D", "#98613C"];

const STATUS_TONE_HEX = {
  success: "#166344",
  warning: "#805500",
  danger: "#B42336",
  info: "#234BA4",
  neutral: "#586A79",
};

const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function EmptyChartState({ message = "No hay datos disponibles" }) {
  return (
    <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--ti-text-muted)" }}>
      {message}
    </div>
  );
}

const panelStyle = {
  background: "var(--ti-surface)",
  border: "1px solid var(--ti-border)",
  borderRadius: "var(--ti-radius-panel)",
  padding: "20px",
};

const chartOptions = {
  maintainAspectRatio: false,
  plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } },
};

function monthKeyToLabel(key) {
  const [year, month] = String(key || "").split("-");
  const idx = Number(month) - 1;
  return `${(MONTH_LABELS[idx] || "").slice(0, 3)} ${String(year).slice(2)}`;
}

const TicketsReports = () => {
  const navigate = useNavigate();
  const { showToast } = useUI();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [exporting, setExporting] = useState("");

  const [kpiDefinitions, setKpiDefinitions] = useState([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiBusyId, setKpiBusyId] = useState(null);

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const data = await getTiMonthlyReport(period);
      setReport(data);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar el reporte mensual", "error");
    } finally {
      setReportLoading(false);
    }
  };

  const loadKpiDefinitions = async () => {
    setKpiLoading(true);
    try {
      const data = await listTiKpiDefinitions();
      setKpiDefinitions(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudieron cargar los KPIs", "error");
    } finally {
      setKpiLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.year, period.month]);

  useEffect(() => {
    loadKpiDefinitions();
  }, []);

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const { blob, filename } = await exportTiMonthlyReport({ ...period, format });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo exportar el reporte", "error");
    } finally {
      setExporting("");
    }
  };

  const handleDeleteKpi = async (id) => {
    if (!window.confirm("¿Eliminar este KPI? Esta accion no se puede deshacer.")) return;
    setKpiBusyId(id);
    try {
      await deleteTiKpiDefinition(id);
      showToast("KPI eliminado", "success");
      await loadKpiDefinitions();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo eliminar el KPI", "error");
    } finally {
      setKpiBusyId(null);
    }
  };

  const handleMoveKpi = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= kpiDefinitions.length) return;
    const reordered = [...kpiDefinitions];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const payload = reordered.map((def, idx) => ({ id: def.id, display_order: idx }));
    setKpiBusyId(reordered[index].id);
    try {
      await reorderTiKpiDefinitions(payload);
      await loadKpiDefinitions();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo reordenar", "error");
    } finally {
      setKpiBusyId(null);
    }
  };

  const trendByTypeData = useMemo(() => {
    if (!report?.trend?.byType?.length) return null;
    return {
      labels: report.trend.total.labels.map(monthKeyToLabel),
      datasets: report.trend.byType.map((series, idx) => ({
        label: toStatusLabel(series.ticket_type, "Sin tipo"),
        data: series.data,
        backgroundColor: DATA_SERIES_COLORS[idx % DATA_SERIES_COLORS.length],
        borderRadius: 4,
      })),
    };
  }, [report]);

  const statusDoughnutData = useMemo(() => {
    if (!report?.volume?.byStatus?.length) return null;
    return {
      labels: report.volume.byStatus.map((r) => toStatusLabel(r.label)),
      datasets: [{
        data: report.volume.byStatus.map((r) => r.total),
        backgroundColor: report.volume.byStatus.map((r) => STATUS_TONE_HEX[statusToTone(r.label)] || STATUS_TONE_HEX.neutral),
        borderWidth: 1,
        borderColor: "var(--ti-surface)",
      }],
    };
  }, [report]);

  const slaTrendData = useMemo(() => {
    if (!report?.sla?.trend?.labels?.length) return null;
    return {
      labels: report.sla.trend.labels.map(monthKeyToLabel),
      datasets: [
        { label: "SLA respuesta (%)", data: report.sla.trend.responseData, backgroundColor: DATA_SERIES_COLORS[0], borderRadius: 4 },
        { label: "SLA resolucion (%)", data: report.sla.trend.resolutionData, backgroundColor: DATA_SERIES_COLORS[1], borderRadius: 4 },
      ],
    };
  }, [report]);

  const rankingData = useMemo(() => {
    if (!report?.technicianRanking?.length) return null;
    return {
      labels: report.technicianRanking.map((r) => r.technicianName),
      datasets: [{ label: "Tickets resueltos", data: report.technicianRanking.map((r) => r.resolvedCount), backgroundColor: DATA_SERIES_COLORS[0], borderRadius: 4 }],
    };
  }, [report]);

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} ti-scope gap-6`}>
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ti-text-muted)" }}>Workspace TI</p>
          <h1 className="mt-1 text-[clamp(1.5rem,3vw,2rem)] font-bold leading-tight tracking-[-0.02em]" style={{ color: "var(--ti-text)" }}>
            Reportes y KPIs
          </h1>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--ti-text-muted)" }}>
            Exclusivo jefe_ti: reporte mensual de tickets y administracion de los KPIs del workspace.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/dashboard/ti/workspace")}>
          Volver al workspace
        </Button>
      </header>

      {/* ── A. Reporte mensual ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--ti-text)" }}>Reporte mensual</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={`${period.year}-${String(period.month).padStart(2, "0")}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-");
                if (y && m) setPeriod({ year: Number(y), month: Number(m) });
              }}
              className="px-3 py-2 text-sm outline-none"
              style={{ minHeight: "var(--ti-control-height)", borderRadius: "var(--ti-radius-control)", border: "1px solid var(--ti-border-control)", background: "var(--ti-surface)", color: "var(--ti-text)" }}
            />
            <Button size="sm" variant="ghost" icon={FiRefreshCw} onClick={loadReport} disabled={reportLoading}>Actualizar</Button>
            <Button size="sm" variant="secondary" icon={FiDownload} loading={exporting === "pdf"} disabled={Boolean(exporting)} onClick={() => handleExport("pdf")}>PDF</Button>
            <Button size="sm" variant="secondary" icon={FiDownload} loading={exporting === "xlsx"} disabled={Boolean(exporting)} onClick={() => handleExport("xlsx")}>Excel</Button>
          </div>
        </div>

        {reportLoading || !report ? (
          <div style={panelStyle} className="py-10 text-center text-sm" >
            <span style={{ color: "var(--ti-text-muted)" }}>Cargando reporte...</span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <TicketMetric label="Total del mes" value={report.volume.total} />
              <TicketMetric label="SLA resolucion" value={report.sla.resolutionCompliancePct !== null ? `${report.sla.resolutionCompliancePct}%` : "-"} tone={report.sla.resolutionCompliancePct !== null && report.sla.resolutionCompliancePct < 80 ? "warning" : "success"} />
              <TicketMetric label="CSAT promedio" value={report.csat.average ?? "-"} unit={report.csat.average ? "/ 5" : ""} helper={`${report.csat.responses} respuestas`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div style={panelStyle}>
                <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--ti-text)" }}>Tendencia mensual por tipo (6 meses)</h3>
                <div className="h-64">
                  {trendByTypeData ? (
                    <Bar data={trendByTypeData} options={{ ...chartOptions, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }} aria-label="Tendencia mensual de tickets por tipo" />
                  ) : <EmptyChartState message="No hay tickets en el rango." />}
                </div>
              </div>

              <div style={panelStyle}>
                <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--ti-text)" }}>Distribucion por estado (mes actual)</h3>
                <div className="h-64">
                  {statusDoughnutData ? (
                    <Doughnut data={statusDoughnutData} options={chartOptions} aria-label="Distribucion de tickets por estado" />
                  ) : <EmptyChartState message="Sin tickets este mes." />}
                </div>
              </div>

              <div style={panelStyle}>
                <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--ti-text)" }}>Cumplimiento SLA (6 meses)</h3>
                <div className="h-64">
                  {slaTrendData ? (
                    <Bar data={slaTrendData} options={{ ...chartOptions, scales: { y: { beginAtZero: true, max: 100 } } }} aria-label="Cumplimiento de SLA de respuesta y resolucion" />
                  ) : <EmptyChartState message="Sin datos de SLA en el rango." />}
                </div>
              </div>

              <div style={panelStyle}>
                <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--ti-text)" }}>Ranking de tecnicos (mes actual)</h3>
                <div className="h-64">
                  {rankingData ? (
                    <Bar data={rankingData} options={{ ...chartOptions, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }} aria-label="Ranking de tecnicos por tickets resueltos" />
                  ) : <EmptyChartState message="Sin tickets resueltos asignados este mes." />}
                </div>
              </div>
            </div>

            {report.kpis.length > 0 ? (
              <div style={panelStyle} className="overflow-x-auto">
                <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--ti-text)" }}>KPIs configurados (este mes)</h3>
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--ti-border)" }}>
                      {["KPI", "Valor", "Meta", "Cumple"].map((label) => (
                        <th key={label} className="px-2 py-2 text-left text-xs font-semibold uppercase" style={{ color: "var(--ti-text-muted)" }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.kpis.map((def) => (
                      <tr key={def.id} style={{ borderBottom: "1px solid var(--ti-border)" }}>
                        <td className="px-2 py-1.5" style={{ color: "var(--ti-text)" }}>{def.name}</td>
                        <td className="px-2 py-1.5 fam-numeric" style={{ color: "var(--ti-text)" }}>{def.value ?? "-"} {def.unit || ""}</td>
                        <td className="px-2 py-1.5" style={{ color: "var(--ti-text-muted)" }}>{def.goal_value !== null ? `${def.goal_direction === "lte" ? "≤" : "≥"} ${def.goal_value}` : "-"}</td>
                        <td className="px-2 py-1.5" style={{ color: def.meets_goal === false ? "var(--ti-danger-text)" : def.meets_goal === true ? "var(--ti-success-text)" : "var(--ti-text-muted)" }}>
                          {def.meets_goal === null || def.meets_goal === undefined ? "-" : def.meets_goal ? "Si" : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div style={panelStyle} className="overflow-x-auto">
              <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--ti-text)" }}>Detalle del mes</h3>
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--ti-border)" }}>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase" style={{ color: "var(--ti-text-muted)" }}>Tipo</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase" style={{ color: "var(--ti-text-muted)" }}>Total</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase" style={{ color: "var(--ti-text-muted)" }}>Prioridad</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase" style={{ color: "var(--ti-text-muted)" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(report.volume.byType.length, report.volume.byPriority.length) }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--ti-border)" }}>
                      <td className="px-2 py-1.5 capitalize" style={{ color: "var(--ti-text)" }}>{report.volume.byType[i] ? toStatusLabel(report.volume.byType[i].label) : ""}</td>
                      <td className="px-2 py-1.5 text-right fam-numeric" style={{ color: "var(--ti-text)" }}>{report.volume.byType[i]?.total ?? ""}</td>
                      <td className="px-2 py-1.5 capitalize" style={{ color: "var(--ti-text)" }}>{report.volume.byPriority[i] ? toStatusLabel(report.volume.byPriority[i].label) : ""}</td>
                      <td className="px-2 py-1.5 text-right fam-numeric" style={{ color: "var(--ti-text)" }}>{report.volume.byPriority[i]?.total ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ── B. Administrar KPIs ────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3" style={{ borderTop: "1px solid var(--ti-border)", paddingTop: "24px" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--ti-text)" }}>Administrar KPIs</h2>
          <Button size="sm" variant="primary" icon={FiPlus} onClick={() => navigate("/dashboard/ti/workspace/reportes/kpis/nuevo")}>
            Nuevo KPI
          </Button>
        </div>

        <div style={panelStyle} className="overflow-x-auto">
          {kpiLoading ? (
            <p className="text-sm" style={{ color: "var(--ti-text-muted)" }}>Cargando KPIs...</p>
          ) : kpiDefinitions.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ti-text-muted)" }}>Aun no hay KPIs configurados. Crea el primero con "Nuevo KPI".</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ti-border)" }}>
                  {["Nombre", "Metrica", "Meta", "Visible en", "Acciones"].map((label) => (
                    <th key={label} className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: "var(--ti-text-muted)" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kpiDefinitions.map((def, index) => (
                  <tr key={def.id} style={{ borderBottom: "1px solid var(--ti-border)" }}>
                    <td className="px-3 py-2" style={{ color: "var(--ti-text)" }}>
                      {def.name}
                      {!def.is_active ? <span className="ml-2 text-xs" style={{ color: "var(--ti-text-muted)" }}>(inactivo)</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--ti-text-muted)" }}>{def.metric_label}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--ti-text-muted)" }}>{def.goal_value !== null ? `${def.goal_direction === "lte" ? "≤" : "≥"} ${def.goal_value} ${def.unit || ""}` : "-"}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--ti-text-muted)" }}>
                      {[def.show_in_workspace ? "Workspace" : null, def.show_in_reports ? "Reportes" : null].filter(Boolean).join(", ") || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Subir" disabled={index === 0 || Boolean(kpiBusyId)} onClick={() => handleMoveKpi(index, -1)} className="p-1.5 disabled:opacity-30" style={{ borderRadius: "var(--ti-radius-control)", color: "var(--ti-text-muted)" }}>
                          <FiArrowUp size={14} />
                        </button>
                        <button type="button" aria-label="Bajar" disabled={index === kpiDefinitions.length - 1 || Boolean(kpiBusyId)} onClick={() => handleMoveKpi(index, 1)} className="p-1.5 disabled:opacity-30" style={{ borderRadius: "var(--ti-radius-control)", color: "var(--ti-text-muted)" }}>
                          <FiArrowDown size={14} />
                        </button>
                        <button type="button" aria-label="Editar" onClick={() => navigate(`/dashboard/ti/workspace/reportes/kpis/${def.id}/editar`)} className="p-1.5" style={{ borderRadius: "var(--ti-radius-control)", color: "var(--ti-accent)" }}>
                          <FiEdit2 size={14} />
                        </button>
                        <button type="button" aria-label="Eliminar" disabled={kpiBusyId === def.id} onClick={() => handleDeleteKpi(def.id)} className="p-1.5" style={{ borderRadius: "var(--ti-radius-control)", color: "var(--ti-danger-text)" }}>
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

export default TicketsReports;
