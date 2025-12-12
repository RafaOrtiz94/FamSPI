import React, { useEffect, useState } from "react";
import { FiDollarSign, FiPlus } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";

const Step5Investments = ({ onPrev, onNext }) => {
  const { state } = useBusinessCaseWizard();
  const { showToast, showLoader, hideLoader } = useUI();
  const [investments, setInvestments] = useState([]);
  const [newInvestment, setNewInvestment] = useState({
    concept: "",
    amount: 0,
    investment_type: "one_time",
    category: "installation",
    notes: ""
  });
  const [loading, setLoading] = useState(false);

  const loadInvestments = async () => {
    if (!state.businessCaseId) return;
    setLoading(true);
    try {
      const res = await api.get(`/business-case/${state.businessCaseId}/investments`);
      setInvestments(res.data || []);
    } catch (err) {
      console.warn("No se pudieron cargar inversiones", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.businessCaseId]);

  const addInvestment = async () => {
    if (!state.businessCaseId) {
      showToast("Primero crea el Business Case", "warning");
      return;
    }
    showLoader();
    try {
      await api.post(`/business-case/${state.businessCaseId}/investments`, newInvestment);
      setNewInvestment({
        concept: "",
        amount: 0,
        investment_type: "one_time",
        category: "installation",
        notes: ""
      });
      await loadInvestments();
      showToast("Inversión registrada", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo agregar la inversión", "error");
    } finally {
      hideLoader();
    }
  };

  const recommended = investments.filter((inv) => inv.recommended);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FiDollarSign className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Inversiones adicionales</h2>
          <p className="text-sm text-gray-500">Registra inversiones asociadas al Business Case.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Concepto</span>
          <input
            value={newInvestment.concept}
            onChange={(e) => setNewInvestment((prev) => ({ ...prev, concept: e.target.value }))}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: Instalación de equipo"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Monto</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={newInvestment.amount}
            onChange={(e) => setNewInvestment((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Tipo de Inversión</span>
          <select
            value={newInvestment.investment_type}
            onChange={(e) => setNewInvestment((prev) => ({ ...prev, investment_type: e.target.value }))}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="one_time">Única vez</option>
            <option value="recurring_monthly">Recurrente mensual</option>
            <option value="recurring_annual">Recurrente anual</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Categoría</span>
          <select
            value={newInvestment.category}
            onChange={(e) => setNewInvestment((prev) => ({ ...prev, category: e.target.value }))}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="installation">Instalación</option>
            <option value="training">Capacitación</option>
            <option value="transport">Transporte</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="other">Otro</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm font-medium text-gray-700">Notas (opcional)</span>
          <input
            value={newInvestment.notes}
            onChange={(e) => setNewInvestment((prev) => ({ ...prev, notes: e.target.value }))}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            placeholder="Detalles adicionales"
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={addInvestment}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white"
        >
          <FiPlus /> Agregar inversión
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-2 px-3 text-left">Concepto</th>
              <th className="py-2 px-3 text-left">Tipo</th>
              <th className="py-2 px-3 text-left">Categoría</th>
              <th className="py-2 px-3 text-left">Monto</th>
            </tr>
          </thead>
          <tbody>
            {investments.map((inv) => {
              const typeLabels = {
                one_time: "Única",
                recurring_monthly: "Mensual",
                recurring_annual: "Anual"
              };
              const categoryLabels = {
                installation: "Instalación",
                training: "Capacitación",
                transport: "Transporte",
                maintenance: "Mantenimiento",
                other: "Otro"
              };
              return (
                <tr key={inv.id} className="border-t">
                  <td className="py-2 px-3 font-semibold text-gray-900">{inv.concept}</td>
                  <td className="py-2 px-3 text-gray-700">
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                      {typeLabels[inv.investment_type] || inv.investment_type}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-700">
                    {categoryLabels[inv.category] || inv.category}
                  </td>
                  <td className="py-2 px-3 text-gray-700">${inv.amount?.toFixed(2) || "0.00"}</td>
                </tr>
              );
            })}
            {!investments.length && (
              <tr>
                <td colSpan={4} className="py-3 px-3 text-center text-gray-500">
                  {loading ? "Cargando inversiones..." : "Sin inversiones registradas."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {recommended.length ? (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          Inversiones recomendadas: {recommended.map((inv) => inv.name).join(", ")}
        </div>
      ) : null}

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

export default Step5Investments;
