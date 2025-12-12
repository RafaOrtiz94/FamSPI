import React, { useEffect, useState } from "react";
import { FiCpu, FiFilter, FiSearch } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";

const EquipmentCard = ({ item, onSelect, selected }) => (
  <button
    type="button"
    onClick={() => onSelect(item)}
    className={`border rounded-xl p-4 text-left space-y-2 transition hover:shadow ${selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
      }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <FiCpu />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{item.name}</p>
          <p className="text-xs text-gray-500">{item.code || "Sin código"}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm text-gray-700">Capacidad: {item.capacity || "-"}</p>
        <p className="text-sm text-gray-700">Precio: ${item.price ?? "-"}</p>
      </div>
    </div>
    <p className="text-xs text-gray-600">{item.description || "Sin descripción"}</p>
    <div className="flex flex-wrap gap-1">
      {(item.categories || []).map((cat) => (
        <span
          key={cat}
          className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200"
        >
          {cat}
        </span>
      ))}
    </div>
  </button>
);

const Step2EquipmentSelector = ({ onPrev, onNext }) => {
  const { state, updateState } = useBusinessCaseWizard();
  const { showToast, showLoader, hideLoader } = useUI();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ search: "", category: "" });
  const [loading, setLoading] = useState(false);
  const [equipmentCost, setEquipmentCost] = useState(state.equipmentCost || 0);

  const normalizeItem = (item) => {
    const id =
      item.id ?? item.equipment_id ?? item.equipmentId ?? item.bc_equipment_id ?? item.bcEquipmentId ?? item.code;

    return {
      id,
      name: item.name ?? item.equipment_name ?? item.display_name ?? "Equipo",
      code: item.code ?? item.codigo ?? item.equipment_code,
      capacity: item.capacity ?? item.capacidad ?? item.capacidad_maxima,
      price: item.price ?? item.precio ?? item.base_price,
      description: item.description ?? item.descripcion ?? item.summary,
      categories: item.categories ?? item.categorias ?? item.tags ?? [],
      raw: item,
    };
  };

  const loadEquipment = async () => {
    setLoading(true);
    try {
      const res = await api.get("/equipment-catalog", {
        params: {
          search: filters.search || undefined,
          category: filters.category || undefined,
        },
      });
      const payload = res.data?.data ?? res.data;
      const parsedItems = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.rows)
            ? payload.rows
            : Array.isArray(payload?.items?.data)
              ? payload.items.data
              : Array.isArray(payload?.records)
                ? payload.records
                : Array.isArray(payload)
                  ? payload
                  : [];

      const normalized = (Array.isArray(parsedItems) ? parsedItems : []).map(normalizeItem).filter((i) => i.id);
      setItems(normalized);
    } catch (err) {
      showToast("No se pudo cargar el catálogo", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = async (item) => {
    if (!state.businessCaseId) {
      showToast("Primero guarda los datos generales", "warning");
      return;
    }
    showLoader();
    try {
      const equipmentId =
        item.id ||
        item.raw?.id ||
        item.raw?.equipment_id ||
        item.raw?.equipmentId ||
        item.raw?.bc_equipment_id ||
        item.raw?.bcEquipmentId;

      if (!equipmentId) {
        showToast("No se pudo identificar el equipo seleccionado", "error");
        return;
      }

      // Update bc_economic_data with equipment info
      await api.put(`/business-case/${state.businessCaseId}/economic-data`, {
        equipment_id: equipmentId,
        equipment_name: item.name,
        equipment_cost: equipmentCost || 0
      });

      updateState({
        selectedEquipment: item,
        equipmentCost: equipmentCost
      });
      showToast("Equipo seleccionado", "success");
      if (onNext) onNext();
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo seleccionar el equipo", "error");
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Selecciona un equipo</h2>
          <p className="text-sm text-gray-500">Filtra por categoría o busca por nombre.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="pl-10 pr-3 py-2 rounded-lg border border-gray-200"
              placeholder="Buscar equipo"
            />
          </div>
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200"
          >
            <option value="">Todas las categorías</option>
            <option value="hematologia">Hematología</option>
            <option value="quimica">Química</option>
            <option value="coagulacion">Coagulación</option>
          </select>
          <button
            type="button"
            onClick={loadEquipment}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700"
          >
            <FiFilter /> Filtrar
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando catálogo...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Array.isArray(items) ? items : []).map((item) => (
            <EquipmentCard
              key={item.id}
              item={item}
              onSelect={handleSelect}
              selected={state.selectedEquipment?.id === item.id}
            />
          ))}
          {!items.length && <p className="text-sm text-gray-500">No hay equipos para mostrar.</p>}
        </div>
      )}

      {state.selectedEquipment && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-800 text-sm">
            Equipo seleccionado: {state.selectedEquipment.name}
          </div>

          <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-blue-900">
                Costo del Equipo (para cálculo de ROI)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={equipmentCost}
                onChange={(e) => setEquipmentCost(parseFloat(e.target.value) || 0)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: 50000.00"
              />
              <p className="text-xs text-blue-700">
                Este costo se usará para calcular el ROI y período de recuperación del comodato
              </p>
            </label>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700"
        >
          Regresar
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white"
          disabled={!state.selectedEquipment}
        >
          Continuar
        </button>
      </div>
    </div>
  );
};

export default Step2EquipmentSelector;
