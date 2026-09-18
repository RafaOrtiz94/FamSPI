import { useState, useEffect, useCallback } from "react";
import {
  fetchLostReasonsReport,
  fetchRedFlagsReport,
  fetchBlueSheetKpis,
} from "../../../core/api/crmFamApi";

const TABS = [
  { id: "lost", label: "Razones de pérdida" },
  { id: "redflags", label: "Red Flags" },
  { id: "bluekpis", label: "Blue Sheet KPIs" },
];

const RF_COLORS = {
  low: "#6B7280",
  medium: "#D97706",
  high: "#DC2626",
  critical: "#7C3AED",
};

function fmt$(n) {
  return `$${Number(n).toLocaleString("es-EC", { maximumFractionDigits: 0 })}`;
}

function Skeleton({ rows = 3, cols = 3 }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i} className="border-b border-[#E5E7EB]">
            {Array.from({ length: cols }).map((_, j) => (
              <td key={j} className="py-3 pr-4">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div className="bg-[#FEE2E2] border border-[#DC2626] text-[#DC2626] rounded-xl px-4 py-3 text-sm font-medium">
      {msg}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
        active
          ? "bg-[#2563EB] text-white"
          : "text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6]"
      }`}
    >
      {children}
    </button>
  );
}

function SelectFilter({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#6B7280]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-[#1F2937] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateFilter({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#6B7280]">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-[#1F2937] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
      />
    </label>
  );
}

// ── Tab: Razones de pérdida ──────────────────────────────────────────────────
function LostReasonsTab() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apply = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await fetchLostReasonsReport(params);
      setData(res ?? []);
    } catch {
      setError("Error al cargar razones de pérdida.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <DateFilter label="Desde" value={dateFrom} onChange={setDateFrom} />
        <DateFilter label="Hasta" value={dateTo} onChange={setDateTo} />
        <button
          onClick={apply}
          className="px-4 py-1.5 bg-[#2563EB] text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          Aplicar
        </button>
      </div>

      {error && <ErrorBanner msg={error} />}

      {loading ? (
        <Skeleton rows={3} cols={3} />
      ) : data === null ? (
        <p className="text-sm text-[#6B7280]">Aplica filtros para ver el reporte.</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-[#6B7280]">Sin resultados para el período seleccionado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="text-left py-3 pr-4 font-semibold text-[#1E293B]">Razón</th>
                <th className="text-right py-3 pr-4 font-semibold text-[#1E293B]"># Pérdidas</th>
                <th className="text-right py-3 font-semibold text-[#1E293B]">Pipeline Perdido</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
                  <td className="py-3 pr-4 text-[#1F2937]">{row.reason ?? row.razon ?? "—"}</td>
                  <td className="py-3 pr-4 text-right text-[#1F2937]">{row.count ?? row.cantidad ?? 0}</td>
                  <td className="py-3 text-right font-medium text-[#1E293B]">
                    {fmt$(row.pipeline_lost ?? row.pipeline_perdido ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Red Flags ───────────────────────────────────────────────────────────
const SEVERITY_OPTS = [
  { value: "", label: "Todos" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUS_OPTS = [
  { value: "", label: "Todos" },
  { value: "open", label: "Open" },
  { value: "accepted", label: "Accepted" },
  { value: "resolved", label: "Resolved" },
];

function SeverityBadge({ value }) {
  const color = RF_COLORS[value] ?? "#6B7280";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-white text-xs font-medium"
      style={{ backgroundColor: color }}
    >
      {value ?? "—"}
    </span>
  );
}

function RedFlagsTab() {
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (sev, sta) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (sev) params.severity = sev;
      if (sta) params.status = sta;
      const res = await fetchRedFlagsReport(params);
      setData(res ?? []);
    } catch {
      setError("Error al cargar red flags.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(severity, status);
  }, [severity, status, load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SelectFilter
          label="Severidad"
          value={severity}
          onChange={(v) => setSeverity(v)}
          options={SEVERITY_OPTS}
        />
        <SelectFilter
          label="Estado"
          value={status}
          onChange={(v) => setStatus(v)}
          options={STATUS_OPTS}
        />
      </div>

      {error && <ErrorBanner msg={error} />}

      {loading ? (
        <Skeleton rows={3} cols={5} />
      ) : data === null ? (
        null
      ) : data.length === 0 ? (
        <p className="text-sm text-[#6B7280]">Sin red flags para los filtros aplicados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="text-left py-3 pr-4 font-semibold text-[#1E293B]">Descripción</th>
                <th className="text-left py-3 pr-4 font-semibold text-[#1E293B]">Severidad</th>
                <th className="text-left py-3 pr-4 font-semibold text-[#1E293B]">Oportunidad</th>
                <th className="text-left py-3 pr-4 font-semibold text-[#1E293B]">Responsable</th>
                <th className="text-left py-3 font-semibold text-[#1E293B]">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
                  <td className="py-3 pr-4 text-[#1F2937] max-w-xs">{row.description ?? row.descripcion ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <SeverityBadge value={row.severity ?? row.severidad} />
                  </td>
                  <td className="py-3 pr-4 text-[#1F2937]">{row.opportunity ?? row.oportunidad ?? "—"}</td>
                  <td className="py-3 pr-4 text-[#1F2937]">{row.owner ?? row.responsable ?? "—"}</td>
                  <td className="py-3 text-[#6B7280]">
                    {row.date ?? row.fecha
                      ? new Date(row.date ?? row.fecha).toLocaleDateString("es-EC")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Blue Sheet KPIs ─────────────────────────────────────────────────────
function BlueSheetKpisTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBlueSheetKpis()
      .then((res) => setData(res ?? []))
      .catch(() => setError("Error al cargar Blue Sheet KPIs."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton rows={3} cols={6} />;
  if (error) return <ErrorBanner msg={error} />;
  if (!data || data.length === 0)
    return <p className="text-sm text-[#6B7280]">Sin datos de Blue Sheet KPIs.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E5E7EB]">
            <th className="text-left py-3 pr-4 font-semibold text-[#1E293B]">Estado</th>
            <th className="text-left py-3 pr-4 font-semibold text-[#1E293B]">Salud</th>
            <th className="text-right py-3 pr-4 font-semibold text-[#1E293B]">Count</th>
            <th className="text-right py-3 pr-4 font-semibold text-[#1E293B]">Avg Completitud</th>
            <th className="text-right py-3 pr-4 font-semibold text-[#1E293B]">Avg Scorecard</th>
            <th className="text-right py-3 font-semibold text-[#1E293B]">Avg Salud</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
              <td className="py-3 pr-4 text-[#1F2937]">{row.status ?? row.estado ?? "—"}</td>
              <td className="py-3 pr-4 text-[#1F2937]">{row.health ?? row.salud ?? "—"}</td>
              <td className="py-3 pr-4 text-right text-[#1F2937]">{row.count ?? 0}</td>
              <td className="py-3 pr-4 text-right text-[#1F2937]">
                {row.avg_completitud != null
                  ? `${Number(row.avg_completitud).toFixed(1)}%`
                  : "—"}
              </td>
              <td className="py-3 pr-4 text-right text-[#1F2937]">
                {row.avg_scorecard != null ? Number(row.avg_scorecard).toFixed(2) : "—"}
              </td>
              <td className="py-3 text-right text-[#1F2937]">
                {row.avg_health != null || row.avg_salud != null
                  ? Number(row.avg_health ?? row.avg_salud).toFixed(2)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CrmReportsPage() {
  const [activeTab, setActiveTab] = useState("lost");

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-[#1E293B]">CRM — Reportes</h1>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-[#E5E7EB] pb-2">
        {TABS.map((t) => (
          <TabBtn key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </TabBtn>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
        {activeTab === "lost" && <LostReasonsTab />}
        {activeTab === "redflags" && <RedFlagsTab />}
        {activeTab === "bluekpis" && <BlueSheetKpisTab />}
      </div>
    </div>
  );
}
