import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FiDollarSign, FiPlus } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";

const InvestmentsSection = ({
  permissions = {},
  ownership = {},
  onSave = () => {}
}) => {
  const { id: bcId } = useParams();
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

  // Load existing investments
  const loadInvestments = async () => {
    if (!bcId) return;
    setLoading(true);
    try {
      const res = await api.get(`/business-case/${bcId}/investments`);
      setInvestments(res.data || []);
    } catch (err) {
      console.warn("No se pudieron cargar inversiones", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestments();
  }, [bcId]);

  // Add new investment
  const addInvestment = async () => {
    if (!bcId) {
      showToast("Primero crea el Business Case", "warning");
      return;
    }
    showLoader();
    try {
      await api.post(`/business-case/${bcId}/investments`, newInvestment);

      // Recalculate ROI with new investment
      await api.post(`/business-case/${bcId}/orchestrator/calculate-roi`);

      // Reload calculations
      const res = await api.get(`/business-case/${bcId}/orchestrator/complete`);
      const bc = res.data.data;

      setNewInvestment({
        concept: "",
        amount: 0,
        investment_type: "one_time",
        category: "installation",
        notes: ""
      });
      await loadInvestments();
      showToast(`Inversión agregada y BC recalculado (ROI: ${bc.calculated_roi_percentage?.toFixed(1)}%)`, "success");

      // Trigger UI guidance refresh
      onSave();

    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo agregar la inversión", "error");
    } finally {
      hideLoader();
    }
  };

  const recommended = investments.filter((inv) => inv.recommended);

  // Check permissions based on role
  // comercial / acp_comercial / jefe_tecnico: can edit investments but NOT prices
  // jefe_operaciones: can edit everything including prices
  const getUserRole = () => {
    // This would come from authentication context
    // For now, assume it's passed through permissions
    return permissions?.userRole || 'comercial';
  };

  const canEditInvestments = () => {
    const role = getUserRole();
    return ['comercial', 'acp_comercial', 'jefe_tecnico', 'jefe_operaciones'].includes(role);
  };

  const canEditPrices = () => {
    const role = getUserRole();
    return role === 'jefe_operaciones';
  };

  const canEdit = canEditInvestments();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FiDollarSign className="text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Inversiones Adicionales</h2>
            <p className="text-sm text-gray-500">Cargando inversiones...</p>
          </div>
        </div>
        <div className="animate-pulse bg-gray-200 h-32 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FiDollarSign className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Inversiones Adicionales</h2>
          <p className="text-sm text-gray-500">
            Registra inversiones asociadas al Business Case
            {!canEdit && " (Solo lectura)"}
          </p>
        </div>
      </div>

      {/* Permission warning */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="text-sm">
              No tienes permisos para editar inversiones en el estado actual.
            </span>
          </div>
        </div>
      )}

      {/* Add new investment form */}
      {canEdit && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Agregar Nueva Inversión</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Concepto</span>
              <input
                value={newInvestment.concept}
                onChange={(e) => setNewInvestment((prev) => ({ ...prev, concept: e.target.value }))}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Instalación de equipo"
                disabled={!canEdit}
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
                disabled={!canEdit}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Tipo de Inversión</span>
              <select
                value={newInvestment.investment_type}
                onChange={(e) => setNewInvestment((prev) => ({ ...prev, investment_type: e.target.value }))}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                disabled={!canEdit}
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
                disabled={!canEdit}
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
                disabled={!canEdit}
              />
            </label>
          </div>

          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={addInvestment}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canEdit || !newInvestment.concept.trim() || newInvestment.amount <= 0}
            >
              <FiPlus /> Agregar inversión
            </button>
          </div>
        </div>
      )}

      {/* Investments table */}
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

      {/* Recommended investments */}
      {recommended.length ? (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          Inversiones recomendadas: {recommended.map((inv) => inv.name).join(", ")}
        </div>
      ) : null}

      {/* Section Actions */}
      {canEdit && (
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onSave}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guardar Inversiones
          </button>
        </div>
      )}
    </div>
  );
};

export default InvestmentsSection;
