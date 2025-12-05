import React, { useEffect, useState } from "react";
import { FiEdit, FiPlus, FiSettings, FiX } from "react-icons/fi";
import api from "../../../core/api";
import { useUI } from "../../../core/ui/UIContext";
import FormulaEditor from "../components/FormulaEditor";

const emptyForm = {
  name: "",
  code: "",
  capacity: "",
  price: "",
  category: "",
  description: "",
};

const EquipmentCatalog = () => {
  const { showToast, showLoader, hideLoader } = useUI();
  const [items, setItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formulaTarget, setFormulaTarget] = useState(null);

  const loadItems = async () => {
    try {
      const res = await api.get("/equipment-catalog");
      setItems(res.data?.items || res.data || []);
    } catch (err) {
      showToast("No se pudo cargar el catálogo", "error");
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const openModal = (item) => {
    setEditing(item || null);
    setForm(item || emptyForm);
    setModalOpen(true);
  };

  const saveItem = async () => {
    showLoader();
    try {
      if (editing?.id) {
        await api.put(`/equipment-catalog/${editing.id}`, form);
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

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-2 px-3 text-left">Nombre</th>
              <th className="py-2 px-3 text-left">Código</th>
              <th className="py-2 px-3 text-left">Categoría</th>
              <th className="py-2 px-3 text-left">Capacidad</th>
              <th className="py-2 px-3 text-left">Precio</th>
              <th className="py-2 px-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="py-2 px-3 font-semibold text-gray-900">{item.name}</td>
                <td className="py-2 px-3 text-gray-700">{item.code || "-"}</td>
                <td className="py-2 px-3 text-gray-700">{item.category || "-"}</td>
                <td className="py-2 px-3 text-gray-700">{item.capacity || "-"}</td>
                <td className="py-2 px-3 text-gray-700">${item.price ?? "-"}</td>
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
              {Object.keys(emptyForm).map((key) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-sm text-gray-700 capitalize">{key}</span>
                  <input
                    value={form[key] || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="border rounded-lg px-3 py-2"
                  />
                </label>
              ))}
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
          title={`Fórmula para ${formulaTarget.name}`}
          onValidate={async (payload) => api.post("/equipment-catalog/formula/validate", payload)}
          onSave={async (payload) =>
            api.post(`/equipment-catalog/${formulaTarget.id}/formula`, { ...payload, equipmentId: formulaTarget.id })
          }
        />
      )}
    </div>
  );
};

export default EquipmentCatalog;
