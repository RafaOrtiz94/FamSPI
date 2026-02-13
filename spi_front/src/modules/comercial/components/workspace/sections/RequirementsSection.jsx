import React, { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";
import { useParams } from "react-router-dom";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";

const DELIVERY_OPTIONS = [
  { value: "total", label: "Total" },
  { value: "partial_time", label: "Parcial - Tiempo" },
  { value: "partial_need", label: "Parcial a necesidad" }
];

const defaultForm = {
  deadlineMonths: "",
  projectedDeadlineMonths: "",
  deliveryType: "total",
  effectiveDetermination: false,
  observations: ""
};

const RequirementsSection = ({ permissions = {}, ownership = {}, onSave }) => {
  const { id: bcId } = useParams();
  const { showToast } = useUI();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = permissions.canEdit !== false && ownership?.canUserEdit !== false;

  useEffect(() => {
    const loadRequirementData = async () => {
      if (!bcId) return;
      try {
        setLoading(true);
        const [requirementsRes, deliveriesRes] = await Promise.all([
          api.get(`/business-case/${bcId}/requirements`),
          api.get(`/business-case/${bcId}/deliveries`)
        ]);

        const requirements = requirementsRes?.data?.data || requirementsRes?.data || {};
        const deliveries = deliveriesRes?.data?.data || deliveriesRes?.data || {};

        setForm({
          deadlineMonths: requirements.deadline_months ?? "",
          projectedDeadlineMonths: requirements.projected_deadline_months ?? "",
          observations: requirements.observations ?? "",
          deliveryType: deliveries.delivery_type || "total",
          effectiveDetermination: deliveries.effective_determination ?? false
        });
      } catch (error) {
        console.error("RequirementsSection: Error fetching data", error);
        showToast("No se pudieron cargar los datos del requerimiento", "error");
      } finally {
        setLoading(false);
      }
    };

    loadRequirementData();
  }, [bcId]);

  const handleSave = async () => {
    if (!bcId) {
      showToast("No se encontr? el Business Case", "error");
      return;
    }

    try {
      setSaving(true);
      await api.post(`/business-case/${bcId}/requirements`, {
        deadline_months: form.deadlineMonths ? Number(form.deadlineMonths) : null,
        projected_deadline_months: form.projectedDeadlineMonths ? Number(form.projectedDeadlineMonths) : null,
        observations: form.observations || null
      });

      await api.post(`/business-case/${bcId}/deliveries`, {
        delivery_type: form.deliveryType,
        effective_determination: Boolean(form.effectiveDetermination)
      });

      showToast("Requerimiento guardado", "success");
      if (onSave) onSave();
    } catch (error) {
      console.error("RequirementsSection: Error saving", error);
      showToast(error.response?.data?.message || "No se pudo guardar el requerimiento", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputClasses =
    "w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none transition-all focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white text-gray-900 placeholder-gray-400";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-100 rounded w-3/4"></div>
            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            <div className="h-3 bg-gray-100 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Requerimiento del BC</h2>
            <p className="text-sm text-gray-500">Plazos, entregas y observaciones antes del c?lculo</p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 w-full sm:w-auto"
          >
            <FiSave size={18} />
            {saving ? "Guardando..." : "Guardar"}
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Plazo (meses)</label>
            <input
              type="number"
              min={1}
              value={form.deadlineMonths}
              onChange={(e) => setForm((prev) => ({ ...prev, deadlineMonths: e.target.value }))}
              className={inputClasses}
              disabled={!canEdit}
              placeholder="Ej. 6"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Proyecci?n del plazo (meses)</label>
            <input
              type="number"
              min={1}
              value={form.projectedDeadlineMonths}
              onChange={(e) => setForm((prev) => ({ ...prev, projectedDeadlineMonths: e.target.value }))}
              className={inputClasses}
              disabled={!canEdit}
              placeholder="Ej. 12"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tipo de entrega</label>
            <select
              value={form.deliveryType}
              onChange={(e) => setForm((prev) => ({ ...prev, deliveryType: e.target.value }))}
              className={inputClasses}
              disabled={!canEdit}
            >
              {DELIVERY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Determinaci?n efectiva</label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="effectiveDetermination"
                  value="yes"
                  checked={form.effectiveDetermination === true}
                  onChange={() => setForm((prev) => ({ ...prev, effectiveDetermination: true }))}
                  disabled={!canEdit}
                  className="accent-indigo-600"
                />
                S?
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="effectiveDetermination"
                  value="no"
                  checked={form.effectiveDetermination === false}
                  onChange={() => setForm((prev) => ({ ...prev, effectiveDetermination: false }))}
                  disabled={!canEdit}
                  className="accent-indigo-600"
                />
                No
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Observaciones</label>
          <textarea
            rows={3}
            value={form.observations}
            onChange={(e) => setForm((prev) => ({ ...prev, observations: e.target.value }))}
            className={`${inputClasses} resize-none`}
            placeholder="Notas importantes del laboratorio"
            disabled={!canEdit}
          />
        </div>
      </div>

      {!canEdit && (
        <div className="py-3 px-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-900 text-sm">
          Esta secci?n est? bloqueada porque no tienes permisos para editar datos operativos.
        </div>
      )}
    </div>
  );
};

export default RequirementsSection;
