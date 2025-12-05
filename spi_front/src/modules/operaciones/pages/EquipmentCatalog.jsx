import React, { useEffect, useState } from "react";
import { FiEdit, FiPlus, FiSearch, FiSettings, FiX } from "react-icons/fi";
import api from "../../../core/api";
import { useUI } from "../../../core/ui/UIContext";
import FormulaEditor from "../components/FormulaEditor";

const emptyForm = {
  code: "",
  nombre: "",
  fabricante: "",
  modelo: "",
  category_type: "",
  capacity_per_hour: "",
  max_daily_capacity: "",
  base_price: "",
  estado: "operativo",
};

const EquipmentCatalog = () => {
  const { showToast, showLoader, hideLoader } = useUI();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ category: "", q: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formulaTarget, setFormulaTarget] = useState(null);
  const [determinations, setDeterminations] = useState([]);
  const [loadingDeterminations, setLoadingDeterminations] = useState(false);

  const loadItems = async () => {
    try {
      const res = await api.get("/equipment-catalog", { params: filters });
      setItems(res.data?.data || res.data?.items || []);
    } catch (err) {
      showToast("No se pudo cargar el catálogo", "error");
    }
  };

  useEffect(() => {
    loadItems();
  }, [filters]);

  const loadDeterminations = async (equipmentId) => {
    setLoadingDeterminations(true);
    try {
      const res = await api.get(`/equipment-catalog/${equipmentId}/determinations`);
      setDeterminations(res.data?.data || res.data?.items || []);
    } catch (err) {
      setDeterminations([]);
    } finally {
      setLoadingDeterminations(false);
    }
  };

  const openModal = (item) => {
    setEditing(item || null);
    setForm({ ...emptyForm, ...item });
    if (item?.equipment_id || item?.id) {
      loadDeterminations(item.equipment_id || item.id);
    } else {
      setDeterminations([]);
    }
    setModalOpen(true);
  };

  const saveItem = async () => {
    showLoader();
    try {
      if (editing?.id || editing?.equipment_id) {
        await api.put(`/equipment-catalog/${editing.id || editing.equipment_id}`, form);
      } else {
        await api.post("/equipment-catalog", form);
      }
      showToast("Equipo guardado", "success");
      setModalOpen(false);
      setForm(emptyForm);
      await loadItems();
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo guardar", "error");
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de equipos</h1>
          <p className="text-sm text-gray-500">Administra equipos y fórmulas asociadas.</p>
        </div>
        <button
          type="button"
          onClick={() => openModal(null)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white"
        >
          <FiPlus /> Nuevo equipo
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
          <FiSearch className="text-gray-400" />
          <input
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            placeholder="Buscar por nombre o código"
            className="outline-none text-sm"
          />
        </div>
        <select
          value={filters.category}
          onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">Todas las categorías</option>
          <option value="hematologia">Hematología</option>
          <option value="quimica">Química</option>
          <option value="coag">Coagulación</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-2 px-3 text-left">Nombre</th>
              <th className="py-2 px-3 text-left">Código</th>
              <th className="py-2 px-3 text-left">Categoría</th>
              <th className="py-2 px-3 text-left">Capacidad diaria</th>
              <th className="py-2 px-3 text-left">Precio base</th>
              <th className="py-2 px-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.equipment_id || item.id} className="border-t">
                <td className="py-2 px-3 font-semibold text-gray-900">{item.equipment_name || item.nombre}</td>
                <td className="py-2 px-3 text-gray-700">{item.equipment_code || item.code || "-"}</td>
                <td className="py-2 px-3 text-gray-700">{item.category_type || item.category || "-"}</td>
                <td className="py-2 px-3 text-gray-700">{item.max_daily_capacity || item.capacity_per_hour || "-"}</td>
                <td className="py-2 px-3 text-gray-700">${item.base_price ?? "-"}</td>
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
                    <FiSettings /> Fórmula
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-gray-500">
                  No hay equipos registrados.
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
              <h3 className="text-lg font-semibold text-gray-900">{editing ? "Editar" : "Crear"} equipo</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <FiX />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Nombre</span>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Código</span>
                <input
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Fabricante</span>
                <input
                  value={form.fabricante}
                  onChange={(e) => setForm((prev) => ({ ...prev, fabricante: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Modelo</span>
                <input
                  value={form.modelo}
                  onChange={(e) => setForm((prev) => ({ ...prev, modelo: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Categoría</span>
                <input
                  value={form.category_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, category_type: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Capacidad por hora</span>
                <input
                  type="number"
                  value={form.capacity_per_hour}
                  onChange={(e) => setForm((prev) => ({ ...prev, capacity_per_hour: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Capacidad diaria máxima</span>
                <input
                  type="number"
                  value={form.max_daily_capacity}
                  onChange={(e) => setForm((prev) => ({ ...prev, max_daily_capacity: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Precio base</span>
                <input
                  type="number"
                  value={form.base_price}
                  onChange={(e) => setForm((prev) => ({ ...prev, base_price: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Estado</span>
                <select
                  value={form.estado}
                  onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="operativo">Operativo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </label>
            </div>

            <div className="bg-gray-50 border border-dashed rounded-lg p-3">
              <h4 className="font-semibold text-gray-800 mb-2">Determinaciones asociadas</h4>
              {loadingDeterminations ? (
                <p className="text-sm text-gray-500">Cargando...</p>
              ) : determinations.length ? (
                <ul className="text-sm text-gray-700 space-y-1 max-h-32 overflow-y-auto">
                  {determinations.map((det) => (
                    <li key={det.id} className="flex justify-between">
                      <span>{det.name}</span>
                      <span className="text-gray-500">{det.roche_code || "-"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No hay determinaciones registradas para este equipo.</p>
              )}
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
          title={`Fórmula para ${formulaTarget.equipment_name || formulaTarget.nombre}`}
          availableVariables={[
            "monthly_quantity",
            "equipment.capacity_per_hour",
            "equipment.max_daily_capacity",
          ]}
          onValidate={async (payload) =>
            api.post("/determinations-catalog/formula/validate", { formula: payload.formula, exampleContext: payload.exampleContext })
          }
          onSave={async (payload) =>
            api.post(`/equipment-catalog/${formulaTarget.id || formulaTarget.equipment_id}/formula`, {
              calculationType: payload.type === "cost" ? "cost" : "consumption",
              formula: payload.formula,
              exampleContext: payload.exampleContext,
            })
          }
        />
      )}
    </div>
  );
};

export default EquipmentCatalog;
