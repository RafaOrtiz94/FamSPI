import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiActivity, FiAlertTriangle } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useParams } from "react-router-dom";

const DeterminationsSection = ({
  permissions = {},
  ownership = {},
  onSave = () => {}
}) => {
  const { id: bcId } = useParams();
  const { showToast } = useUI();
  const [options, setOptions] = useState([]);
  const [determinations, setDeterminations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculationMode, setCalculationMode] = useState("monthly"); // Default to monthly
  const debounceRefs = useRef({});

  // Get equipment ID from existing equipment data (assuming it's stored in the business case)
  const [equipmentId, setEquipmentId] = useState(null);

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
      setDeterminations(res.data?.data || []);
    } catch (err) {
      console.warn("No se pudieron cargar determinaciones existentes", err.message);
    }
  };

  // Load equipment data to get equipment ID
  const loadEquipmentData = async () => {
    if (!bcId) return;
    try {
      const res = await api.get(`/business-case/${bcId}/equipment-details`);
      const equipmentDetails = res.data?.data || [];
      if (equipmentDetails.length > 0) {
        const primaryEquipment = equipmentDetails[0].primary_id;
        setEquipmentId(primaryEquipment);
      }
    } catch (err) {
      console.warn("No se pudieron cargar datos de equipo", err.message);
    }
  };

  useEffect(() => {
    loadEquipmentData();
  }, [bcId]);

  useEffect(() => {
    if (equipmentId) {
      loadOptions();
      loadExisting();
    }
  }, [equipmentId]);

  const determinationsMap = useMemo(() => {
    const map = {};
    (determinations || []).forEach((det) => {
      map[det.id || det.determinationId] = det;
    });
    return map;
  }, [determinations]);

  // Sort options deterministically for consistent display
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => {
      // Sort by name first (case-insensitive)
      const nameCompare = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      if (nameCompare !== 0) return nameCompare;
      // If names are equal, sort by ID for deterministic ordering
      return String(a.id).localeCompare(String(b.id));
    });
  }, [options]);

  const persistQuantity = async (determinationId, qty) => {
    if (!bcId) {
      showToast("Primero crea el Business Case", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload =
        calculationMode === "annual"
          ? { detId: determinationId, annualQty: qty }
          : { detId: determinationId, monthlyQty: qty };
      await api.post(`/business-case/${bcId}/determinations`, payload);
      const refreshed = await api.get(`/business-case/${bcId}/determinations`);
      setDeterminations(refreshed.data?.data || []);

      // Trigger onSave callback to refresh UI guidance
      onSave();
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo registrar la determinación", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleQtyChange = (detId, value, det) => {
    const numeric = Number(value) || 0;
    clearTimeout(debounceRefs.current[detId]);
    debounceRefs.current[detId] = setTimeout(() => {
      persistQuantity(detId, numeric);
    }, 500);
  };

  const mode = calculationMode === "monthly" ? "monthly" : "annual";
  const quantityField = mode === "annual" ? "annual_quantity" : "monthly_quantity";

  const subtotal = useMemo(() => {
    const totalCost = (determinations || []).reduce((acc, det) => acc + (Number(det.cost) || 0), 0);
    const totalQty = (determinations || []).reduce(
      (acc, det) =>
        acc + (Number(det[quantityField] || det[quantityField.replace("_", "")]) || 0),
      0,
    );
    return {
      totalCost,
      totalQty,
    };
  }, [determinations, quantityField]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FiActivity className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Determinaciones</h2>
          <p className="text-sm text-gray-500">
            Actualiza cantidades por {mode === "annual" ? "año" : "mes"}. Se recalcula automáticamente.
          </p>
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
                  <th className="py-2">{mode === "annual" ? "Cantidad anual" : "Cantidad mensual"}</th>
                  <th className="py-2">Consumo</th>
                  <th className="py-2">Costo</th>
                </tr>
            </thead>
            <tbody>
              {sortedOptions.map((det) => {
                const saved = determinationsMap[det.id];
                return (
                  <tr key={det.id} className="border-b last:border-0">
                    <td className="py-2 font-semibold text-gray-900">{det.name}</td>
                    <td className="py-2 text-gray-700">{det.category || "-"}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        min={0}
                        defaultValue={
                          mode === "annual"
                            ? saved?.annual_quantity || saved?.annualQty || 0
                            : saved?.monthly_quantity || saved?.monthlyQty || 0
                        }
                        onChange={(e) => handleQtyChange(det.id, e.target.value, det)}
                        className="w-24 border rounded-lg px-2 py-1"
                        placeholder={mode === "annual" ? "Ej: 6000" : "Ej: 500"}
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

      {/* Section Actions */}
      <div className="flex justify-end pt-4 border-t">
        <button
          onClick={onSave}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Guardar Determinaciones
        </button>
      </div>
    </div>
  );
};

export default DeterminationsSection;
