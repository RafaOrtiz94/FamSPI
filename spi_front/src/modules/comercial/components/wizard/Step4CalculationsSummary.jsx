import React, { useEffect, useMemo, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { FiAlertCircle, FiTrendingUp } from "react-icons/fi";
import api from "../../../../core/api";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";
import { useUI } from "../../../../core/ui/UIContext";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const SummaryCard = ({ label, value }) => (
  <div className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
    <p className="text-xs uppercase text-gray-500">{label}</p>
    <p className="text-xl font-bold text-gray-900">{value}</p>
  </div>
);

const Gauge = ({ utilization = 0 }) => (
  <div className="relative w-full h-3 rounded-full bg-gray-100">
    <div
      className={`h-3 rounded-full ${utilization > 80 ? "bg-red-500" : utilization > 60 ? "bg-amber-400" : "bg-green-500"}`}
      style={{ width: `${Math.min(utilization, 100)}%` }}
    />
    <div className="text-xs text-gray-500 mt-1">Utilización: {utilization}%</div>
  </div>
);

const Step4CalculationsSummary = ({ onPrev, onNext }) => {
  const { state, updateState } = useBusinessCaseWizard();
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState({ pdf: false, excel: false });

  const loadCalculations = async () => {
    if (!state.businessCaseId) return;
    setLoading(true);
    try {
      const res = await api.get(`/business-case/${state.businessCaseId}/calculations`);
      updateState({ calculations: res.data });
    } catch (err) {
      showToast("No se pudieron cargar los cálculos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalculations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.businessCaseId]);

  const handleExport = async (format) => {
    if (!state.businessCaseId) return;
    setExporting((prev) => ({ ...prev, [format]: true }));
    try {
      const res = await api.get(`/business-case/${state.businessCaseId}/export/${format}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `business-case-${state.businessCaseId}.${format === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast("No se pudo exportar el Business Case", "error");
    } finally {
      setExporting((prev) => ({ ...prev, [format]: false }));
    }
  };

  const totals = state.calculations || {};
  const barData = useMemo(() => {
    const labels = (totals.topDeterminations || []).map((item) => item.name);
    const values = (totals.topDeterminations || []).map((item) => item.cost);
    return {
      labels,
      datasets: [
        {
          label: "Costo por determinación",
          data: values,
          backgroundColor: "#2563eb",
        },
      ],
    };
  }, [totals.topDeterminations]);

  const pieData = useMemo(() => {
    const labels = (totals.categoryDistribution || []).map((item) => item.category || "N/A");
    const values = (totals.categoryDistribution || []).map((item) => item.cost || 0);
    return {
      labels,
      datasets: [
        {
          label: "Distribución por categoría",
          data: values,
          backgroundColor: ["#2563eb", "#fb923c", "#22c55e", "#e11d48", "#f97316"],
        },
      ],
    };
  }, [totals.categoryDistribution]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FiTrendingUp className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Resumen de Rentabilidad</h2>
          <p className="text-sm text-gray-500">Consulta métricas de ROI, margen y período de recuperación.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={exporting.pdf || !state.businessCaseId}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {exporting.pdf ? "Generando PDF..." : "Exportar PDF"}
          </button>
          <button
            type="button"
            onClick={() => handleExport("excel")}
            disabled={exporting.excel || !state.businessCaseId}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {exporting.excel ? "Generando Excel..." : "Exportar Excel"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Calculando...</p>
      ) : (
        <>
          {/* Métricas de Rentabilidad */}
          <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50">
            <h3 className="text-sm font-semibold text-green-900 mb-3">Métricas de Rentabilidad</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs uppercase text-gray-500">ROI</p>
                <p className="text-2xl font-bold text-green-600">
                  {totals.roi_percentage ? `${totals.roi_percentage.toFixed(1)}%` : "-"}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs uppercase text-gray-500">Payback</p>
                <p className="text-2xl font-bold text-blue-600">
                  {totals.payback_months ? `${totals.payback_months} meses` : "-"}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs uppercase text-gray-500">Margen Mensual</p>
                <p className="text-2xl font-bold text-purple-600">
                  {totals.monthly_margin ? `$${totals.monthly_margin.toFixed(2)}` : "-"}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs uppercase text-gray-500">Margen Anual</p>
                <p className="text-2xl font-bold text-purple-600">
                  {totals.annual_margin ? `$${totals.annual_margin.toFixed(2)}` : "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Inversión y Costos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-gray-200 bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Inversión</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Equipo:</span>
                  <span className="text-sm font-semibold">
                    ${totals.equipment_investment?.toFixed(2) || "0.00"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Inversión Total:</span>
                  <span className="text-sm font-semibold">
                    ${totals.total_investment?.toFixed(2) || "0.00"}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Ingresos Proyectados</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Mensual:</span>
                  <span className="text-sm font-semibold">
                    ${totals.monthly_revenue?.toFixed(2) || "0.00"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Anual:</span>
                  <span className="text-sm font-semibold">
                    ${totals.annual_revenue?.toFixed(2) || "0.00"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Métricas Operativas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Pruebas Anuales" value={totals.total_annual_tests || "-"} />
            <SummaryCard label="Costo Anual" value={`$${totals.total_annual_cost?.toFixed(2) || "-"}`} />
            <SummaryCard label="Costo Mensual" value={`$${totals.total_monthly_cost?.toFixed(2) || "-"}`} />
            <SummaryCard label="Costo por Prueba" value={`$${totals.cost_per_test?.toFixed(2) || "-"}`} />
          </div>

          <div className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
            <Gauge utilization={totals.equipment_utilization_percentage || 0} />
            <p className="text-xs text-gray-500 mt-2">Gauge basado en capacidad del equipo seleccionado.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Top costos</h3>
              {barData.labels?.length ? <Bar data={barData} /> : <p className="text-sm text-gray-500">Sin datos</p>}
            </div>
            <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Distribución por categoría</h3>
              {pieData.labels?.length ? <Pie data={pieData} /> : <p className="text-sm text-gray-500">Sin datos</p>}
            </div>
          </div>

          {totals.warnings?.length ? (
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm flex gap-2">
              <FiAlertCircle />
              <div>
                <p className="font-semibold">Alertas del cálculo</p>
                <ul className="list-disc ml-5">
                  {totals.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onPrev} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700">
          Regresar
        </button>
        <button type="button" onClick={onNext} className="px-4 py-2 rounded-lg bg-blue-600 text-white">
          Continuar
        </button>
      </div>
    </div>
  );
};

export default Step4CalculationsSummary;
