import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiActivity, FiAlertTriangle } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";

const Step3DeterminationSelector = ({ onPrev, onNext }) => {
  const { state, updateState } = useBusinessCaseWizard();
  const { showToast } = useUI();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRefs = useRef({});

  const bcId = state.businessCaseId;
  const equipmentId = state.selectedEquipment?.id;

  const loadOptions = async () => {
    if (!equipmentId) return;
    setLoading(true);
    try {
      const res = await api.get(`/equipment-catalog/${equipmentId}/determinations`);
      setOptions(res.data?.data || []);
    } catch (err) {
      showToast("No se pudieron cargar determinaciones", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadExisting = async () => {
    if (!bcId) return;
    try {
      const res = await api.get(`/business-case/${bcId}/determinations`);
      updateState({ determinations: res.data?.data || [] });
    } catch (err) {
      console.warn("No se pudieron cargar determinaciones existentes", err.message);
    }
  };

  useEffect(() => {
    loadOptions();
    loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId]);

  const determinationsMap = useMemo(() => {
    const map = {};
    (state.determinations || []).forEach((det) => {
      map[det.id || det.determinationId] = det;
    });
    return map;
  }, [state.determinations]);

  const persistQuantity = async (determinationId, qty) => {
    if (!bcId) {
      showToast("Primero crea el Business Case", "warning");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/business-case/${bcId}/determinations`, {
        detId: determinationId,
        annualQty: qty, // Cambio a cantidad anual
      });
      const refreshed = await api.get(`/business-case/${bcId}/determinations`);
      updateState({ determinations: refreshed.data?.data || [] });
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo registrar la determinación", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleQtyChange = (detId, value) => {
    const numeric = Number(value) || 0;
    clearTimeout(debounceRefs.current[detId]);
    debounceRefs.current[detId] = setTimeout(() => {
      persistQuantity(detId, numeric);
    }, 500);
  };

  const subtotal = useMemo(() => {
    const totalCost = (state.determinations || []).reduce((acc, det) => acc + (Number(det.cost) || 0), 0);
    return {
      totalCost,
      totalQty: (state.determinations || []).reduce((acc, det) => acc + (Number(det.annual_qty || det.annualQty) || 0), 0),
    };
  }, [state.determinations]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FiActivity className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Determinaciones</h2>
          <p className="text-sm text-gray-500">Actualiza cantidades anuales. Se recalcula automáticamente.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando determinaciones...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Nombre</th>
                <th className="py-2">Categoría</th>
                <th className="py-2">Cantidad anual</th>
                <th className="py-2">Consumo</th>
                <th className="py-2">Costo</th>
              </tr>
            </thead>
            <tbody>
              {options.map((det) => {
                const saved = determinationsMap[det.id];
                return (
                  <tr key={det.id} className="border-b last:border-0">
                    <td className="py-2 font-semibold text-gray-900">{det.name}</td>
                    <td className="py-2 text-gray-700">{det.category || "-"}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        min={0}
                        defaultValue={saved?.annual_qty || saved?.annualQty || 0}
                        onChange={(e) => handleQtyChange(det.id, e.target.value)}
                        className="w-24 border rounded-lg px-2 py-1"
                        placeholder="Ej: 6000"
                      />
                    </td>
                    <td className="py-2 text-gray-700">{saved?.consumption ?? "-"}</td>
                    <td className="py-2 text-gray-700">${saved?.cost ?? "-"}</td>
                  </tr>
                );
              })}
              {!options.length && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-500">
                    No hay determinaciones configuradas para este equipo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <FiAlertTriangle className="text-amber-500" />
          Recuerda que los cambios se envían al backend con debounce de 500ms.
        </div>
        <div className="flex items-center gap-4 text-sm font-semibold text-gray-900">
          <span>Total determ.: {subtotal.totalQty}</span>
          <span>Costo estimado: ${subtotal.totalCost.toFixed(2)}</span>
          {saving && <span className="text-blue-600">Guardando...</span>}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700"
        >
          Regresar
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!bcId) {
                showToast("No hay Business Case para calcular", "warning");
                return;
              }
              try {
                // 1. Calculate ROI
                const roiRes = await api.post(`/business-case/${bcId}/orchestrator/calculate-roi`);
                updateState({ calculations: roiRes.data.data });

                // 2. Evaluate approval
                const approvalRes = await api.post(`/business-case/${bcId}/orchestrator/evaluate-approval`);

                if (approvalRes.data.data.approved) {
                  showToast(
                    `BC aprobado económicamente (ROI: ${approvalRes.data.data.roi}%)`,
                    'success'
                  );
                } else {
                  showToast(
                    `ROI insuficiente (${approvalRes.data.data.roi}% < ${approvalRes.data.data.target}%)`,
                    'warning'
                  );
                }

                // Advance to next step
                if (onNext) onNext();
              } catch (error) {
                showToast('Error calculando BC: ' + error.message, 'error');
              }
            }}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            Calcular y Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step3DeterminationSelector;
