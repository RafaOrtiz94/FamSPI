import React, { useEffect, useState } from "react";
import { FiDollarSign, FiTrendingUp, FiAlertTriangle } from "react-icons/fi";
import api from "../../../../core/api";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";
import { useUI } from "../../../../core/ui/UIContext";

const SummaryCard = ({ label, value, accent = "gray" }) => (
  <div className={`p-4 rounded-lg border border-gray-200 bg-${accent}-50 shadow-sm`}>
    <p className="text-xs uppercase text-gray-500">{label}</p>
    <p className="text-xl font-bold text-gray-900">{value}</p>
  </div>
);

const Step4RentabilitySummary = ({ onPrev, onNext }) => {
  const { state } = useBusinessCaseWizard();
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [calculations, setCalculations] = useState(null);

  const fetchCalculations = async () => {
    if (!state.businessCaseId) return;
    setLoading(true);
    try {
      await api.post(`/business-case/${state.businessCaseId}/recalculate`);
      const res = await api.get(`/business-case/${state.businessCaseId}/calculations`);
      setCalculations(res.data);
    } catch (err) {
      showToast("No se pudieron cargar los cálculos de rentabilidad", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalculations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.businessCaseId]);

  if (loading) {
    return <div className="text-center py-8 text-sm text-gray-500">Calculando rentabilidad...</div>;
  }

  if (!calculations) {
    return <div className="text-center py-8 text-sm text-gray-500">No hay cálculos disponibles aún</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-green-50 text-green-600">
          <FiDollarSign />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Rentabilidad del comodato</h2>
          <p className="text-sm text-gray-500">
            Proyección financiera basada en los determinaciones y las inversiones registradas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard
          label="ROI proyectado"
          value={`${calculations.roi_percentage?.toFixed(2) ?? "-"}%`}
          accent="green"
        />
        <SummaryCard
          label="Margen mensual"
          value={`$${calculations.monthly_margin?.toFixed(2) ?? "-"}`}
          accent="blue"
        />
        <SummaryCard
          label="Período de recuperación"
          value={calculations.payback_months ? `${calculations.payback_months} meses` : "N/A"}
          accent="purple"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryCard label="Ingreso necesario" value={`$${calculations.monthly_revenue?.toFixed(2) ?? "-"}`} />
        <SummaryCard label="Costo operativo mensual" value={`$${calculations.monthly_operating_cost?.toFixed(2) ?? "-"}`} />
      </div>

      {calculations.warnings?.length ? (
        <div className="p-3 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <FiAlertTriangle /> Advertencias
          </div>
          <ul className="list-disc ml-5 space-y-1">
            {calculations.warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          Regresar
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchCalculations}
            className="px-4 py-2 rounded-lg border border-blue-200 text-blue-700"
          >
            Recalcular
          </button>
          <button
            type="button"
            onClick={onNext}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step4RentabilitySummary;
