import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit, FiFilter, FiPlus, FiSettings, FiTrash2, FiX } from "react-icons/fi";
import api from "../../../core/api";
import { useUI } from "../../../core/ui/UIContext";
import FormulaEditor from "../components/FormulaEditor";

const emptyForm = {
  name: "",
  roche_code: "",
  category: "",
  equipment_id: "",
  version: "1.0",
  status: "active",
};

const DeterminationsCatalog = () => {
  const { showToast, showLoader, hideLoader } = useUI();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ equipmentId: "", q: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formulaTarget, setFormulaTarget] = useState(null);
  const [equipmentOptions, setEquipmentOptions] = useState([]);

  const loadItems = useCallback(async () => {
    try {
      const res = await api.get("/determinations-catalog", { params: filters });
      setItems(res.data?.data || res.data?.items || []);
    } catch (err) {
      showToast("No se pudo cargar el catálogo", "error");
    }
  }, [filters, showToast]);

  const loadEquipment = async () => {
    try {
      const res = await api.get("/equipment-catalog");
      setEquipmentOptions(res.data?.data || res.data?.items || []);
    } catch (err) {
      setEquipmentOptions([]);
    }
  };

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    loadEquipment();
  }, []);

  const openModal = (item) => {
    setEditing(item || null);
    setForm({ ...emptyForm, ...item });
    setModalOpen(true);
  };

  const saveItem = async () => {
    showLoader();
    try {
      if (!form.equipment_id) {
        showToast("Debes seleccionar un equipo asociado", "warning");
        hideLoader();
        return;
      }
      const payload = { ...form };
      if (editing?.id) {
        await api.put(`/determinations-catalog/${editing.id}`, payload);
      } else {
        await api.post("/determinations-catalog", payload);
      }
      showToast("Determinación guardada", "success");
      setModalOpen(false);
      setForm(emptyForm);
      await loadItems();
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo guardar", "error");
    } finally {
      hideLoader();
    }
  };

  const removeItem = async (id) => {
    showLoader();
    try {
      await api.delete(`/determinations-catalog/${id}`);
      showToast("Determinación eliminada", "success");
      await loadItems();
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo eliminar", "error");
    } finally {
      hideLoader();
    }
  };

  const equipmentMap = useMemo(
    () => Object.fromEntries(equipmentOptions.map((eq) => [eq.equipment_id || eq.id, eq.equipment_name || eq.nombre])),
    [equipmentOptions],
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Determinaciones</h1>
          <p className="text-sm text-gray-500">Administra las determinaciones y sus IDs de producto por equipo.</p>
        </div>
        <button
          type="button"
          onClick={() => openModal({ equipment_id: filters.equipmentId })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white"
        >
          <FiPlus /> Nueva determinación
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filters.equipmentId}
          onChange={(e) => setFilters((prev) => ({ ...prev, equipmentId: e.target.value }))}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">Todos los equipos</option>
          {equipmentOptions.map((eq) => (
            <option key={eq.equipment_id || eq.id} value={eq.equipment_id || eq.id}>
              {eq.equipment_name || eq.nombre}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
          <FiFilter className="text-gray-400" />
          <input
            placeholder="Buscar por nombre o código"
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            className="outline-none text-sm"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-2 px-3 text-left">Nombre</th>
              <th className="py-2 px-3 text-left">Categoría</th>
              <th className="py-2 px-3 text-left">Equipo</th>
              <th className="py-2 px-3 text-left">ID de Producto (Proveedor)</th>
              <th className="py-2 px-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="py-2 px-3 font-semibold text-gray-900">{item.name}</td>
                <td className="py-2 px-3 text-gray-700">{item.category || "-"}</td>
                <td className="py-2 px-3 text-gray-700">{equipmentMap[item.equipment_id] || "-"}</td>
                <td className="py-2 px-3 text-gray-700">{item.roche_code || "-"}</td>
                <td className="py-2 px-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openModal(item)}
                    className="px-3 py-1 rounded-lg border border-gray-200 text-gray-700"
                  >
                    <FiEdit />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulaTarget(item)}
                    className="px-3 py-1 rounded-lg border border-gray-200 text-gray-700"
                  >
                    <FiSettings /> Fórmula personalizada
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="px-3 py-1 rounded-lg border border-red-200 text-red-700"
                  >
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-500">
                  No hay determinaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editing ? "Editar" : "Crear"} determinación</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <FiX />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Nombre</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">ID de Producto (Proveedor)</span>
                <input
                  value={form.roche_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, roche_code: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                  placeholder="Ej: 04469658190"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Categoría</span>
                <input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Equipo asociado</span>
                <select
                  value={form.equipment_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, equipment_id: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="">Sin asignar</option>
                  {equipmentOptions.map((eq) => (
                    <option key={eq.equipment_id || eq.id} value={eq.equipment_id || eq.id}>
                      {eq.equipment_name || eq.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Versión</span>
                <input
                  value={form.version}
                  onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Estado</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="active">Activo</option>
                  <option value="discontinuado">Discontinuado</option>
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700">
                Cancelar
              </button>
              <button onClick={saveItem} className="px-4 py-2 rounded-lg bg-blue-600 text-white">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {formulaTarget && (
        <FormulaEditor
          open={!!formulaTarget}
          onClose={() => setFormulaTarget(null)}
          title={`Fórmula personalizada para ${formulaTarget.name}`}
          availableVariables={[
            "monthly_quantity",
            "reagent_consumption",
            "equipment.capacity_per_hour",
            "equipment.max_daily_capacity",
          ]}
          onValidate={async (payload) => api.post("/determinations-catalog/formula/validate", payload)}
          onSave={async (payload) =>
            api.post(`/determinations-catalog/${formulaTarget.id}/formula`, {
              ...payload,
              formula_type: "custom",
            })
          }
        />
      )}
    </div>
  );
};

export default DeterminationsCatalog;
