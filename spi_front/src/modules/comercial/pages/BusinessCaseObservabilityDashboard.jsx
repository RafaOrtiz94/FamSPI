import React, { useCallback, useEffect, useState } from "react";
import { FiAlertTriangle, FiClock, FiRefreshCw, FiTrendingUp } from "react-icons/fi";
import { getBusinessCaseObservabilityDashboard } from "../../../core/api/businessCaseApi";
import { useUI } from "../../../core/ui/UIContext";

const percent = (value = 0) => `${(Number(value || 0) * 100).toFixed(2)}%`;

const EndpointTable = ({ title, rows = [] }) => (
  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50/70 text-slate-600">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">Endpoint</th>
            <th className="px-4 py-2 text-right font-semibold">Req</th>
            <th className="px-4 py-2 text-right font-semibold">P95</th>
            <th className="px-4 py-2 text-right font-semibold">Error rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.endpoint}`} className="border-t border-slate-100">
              <td className="px-4 py-2 text-slate-800">{row.endpoint}</td>
              <td className="px-4 py-2 text-right text-slate-700">{row.total}</td>
              <td className="px-4 py-2 text-right text-slate-700">{row.p95_ms} ms</td>
              <td className="px-4 py-2 text-right text-slate-700">{percent(row.error_rate)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={4} className="px-4 py-5 text-center text-slate-500">
                Sin datos recientes
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default function BusinessCaseObservabilityDashboard() {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const snapshot = await getBusinessCaseObservabilityDashboard();
      setData(snapshot || null);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar observabilidad BC", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Observabilidad Business Case</h1>
          <p className="text-sm text-slate-600">
            Ventana de {data?.window_minutes || 15} minutos | Actualizado: {data?.captured_at || "-"}
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">P95 global</span>
            <FiClock className="text-slate-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.p95_ms || 0} ms</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Error rate global</span>
            <FiAlertTriangle className="text-slate-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{percent(summary.error_rate)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Requests capturadas</span>
            <FiTrendingUp className="text-slate-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total_requests || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <EndpointTable title="Top endpoints por tráfico" rows={data?.top_endpoints || []} />
        <EndpointTable title="Top endpoints por latencia (P95)" rows={data?.top_latency || []} />
        <EndpointTable title="Top endpoints por error rate" rows={data?.top_error_rate || []} />
      </div>
    </div>
  );
}
