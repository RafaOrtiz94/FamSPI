import React, { useEffect, useState } from "react";
import { FiDollarSign, FiPlus } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";

const Step5Investments = ({ onPrev, onNext }) => {
  const { state } = useBusinessCaseWizard();
  const { showToast, showLoader, hideLoader } = useUI();
  const [investments, setInvestments] = useState([]);
  const [newInvestment, setNewInvestment] = useState({ name: "", quantity: 1, price: 0 });
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
      setNewInvestment({ name: "", quantity: 1, price: 0 });
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Concepto</span>
          <input
            value={newInvestment.name}
            onChange={(e) => setNewInvestment((prev) => ({ ...prev, name: e.target.value }))}
            className="border rounded-lg px-3 py-2"
            placeholder="Equipo auxiliar"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Cantidad</span>
          <input
            type="number"
            min={1}
            value={newInvestment.quantity}
            onChange={(e) => setNewInvestment((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
            className="border rounded-lg px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Precio</span>
          <input
            type="number"
            min={0}
            value={newInvestment.price}
            onChange={(e) => setNewInvestment((prev) => ({ ...prev, price: Number(e.target.value) }))}
            className="border rounded-lg px-3 py-2"
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
              <th className="py-2 px-3 text-left">Cantidad</th>
              <th className="py-2 px-3 text-left">Precio</th>
              <th className="py-2 px-3 text-left">Total</th>
            </tr>
          </thead>
          <tbody>
            {investments.map((inv) => (
              <tr key={inv.id || inv.name} className="border-t">
                <td className="py-2 px-3 font-semibold text-gray-900">{inv.name}</td>
                <td className="py-2 px-3 text-gray-700">{inv.quantity}</td>
                <td className="py-2 px-3 text-gray-700">${inv.price ?? "-"}</td>
                <td className="py-2 px-3 text-gray-700">
                  ${
                    inv.total ?? (inv.price != null ? inv.price * inv.quantity : undefined) ?? "-"
                  }
                </td>
              </tr>
            ))}
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
