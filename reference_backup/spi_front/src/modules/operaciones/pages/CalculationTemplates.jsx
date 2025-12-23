import React, { useEffect, useState } from "react";
import { FiPlus, FiSend, FiTrash2, FiX } from "react-icons/fi";
import api from "../../../core/api";
import { useUI } from "../../../core/ui/UIContext";
import FormulaEditor from "../components/FormulaEditor";

const emptyTemplate = {
  name: "",
  description: "",
  type: "expression",
  version: "1.0",
  formula: {},
  is_active: true,
};

const CalculationTemplates = () => {
  const { showToast, showLoader, hideLoader } = useUI();
  const [templates, setTemplates] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyTemplate);
  const [applyTarget, setApplyTarget] = useState(null);
  const [determinations, setDeterminations] = useState([]);

  const loadTemplates = async () => {
    try {
      const res = await api.get("/calculation-templates");
      setTemplates(res.data?.data || res.data || []);
    } catch (err) {
      showToast("No se pudieron cargar templates", "error");
    }
  };

  const loadDeterminations = async () => {
    try {
      const res = await api.get("/determinations-catalog");
      setDeterminations(res.data?.data || res.data || []);
    } catch (err) {
      setDeterminations([]);
    }
  };

  useEffect(() => {
    loadTemplates();
    loadDeterminations();
  }, []);

  const openModal = (tpl) => {
    setEditing(tpl || null);
    setForm({ ...emptyTemplate, ...tpl });
    setModalOpen(true);
  };

  const saveTemplate = async () => {
    showLoader();
    try {
      if (editing?.id) {
        await api.put(`/calculation-templates/${editing.id}`, form);
      } else {
        await api.post("/calculation-templates", form);
      }
      showToast("Template guardado", "success");
      setModalOpen(false);
      setForm(emptyTemplate);
      await loadTemplates();
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo guardar", "error");
    } finally {
      hideLoader();
    }
  };

  const removeTemplate = async (tpl) => {
    showLoader();
    try {
      await api.delete(`/calculation-templates/${tpl.id}`);
      showToast("Template eliminado", "success");
      await loadTemplates();
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo eliminar", "error");
    } finally {
      hideLoader();
    }
  };

  const applyTemplate = async () => {
    if (!applyTarget?.id || !applyTarget?.determinationId) return;
    showLoader();
    try {
      await api.post(`/calculation-templates/${applyTarget.id}/apply`, {
        determinationId: applyTarget.determinationId,
      });
      showToast("Template aplicado", "success");
      setApplyTarget(null);
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo aplicar", "error");
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de cálculo</h1>
          <p className="text-sm text-gray-500">Gestiona templates reutilizables y aplícalos a determinaciones.</p>
        </div>
        <button
          type="button"
          onClick={() => openModal(null)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white"
        >
          <FiPlus /> Nuevo template
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-2 px-3 text-left">Nombre</th>
              <th className="py-2 px-3 text-left">Descripción</th>
              <th className="py-2 px-3 text-left">Tipo</th>
              <th className="py-2 px-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tpl) => (
              <tr key={tpl.id} className="border-t">
                <td className="py-2 px-3 font-semibold text-gray-900">{tpl.name}</td>
                <td className="py-2 px-3 text-gray-700">{tpl.description || "-"}</td>
                <td className="py-2 px-3 text-gray-700">{tpl.type || "expression"}</td>
                <td className="py-2 px-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openModal(tpl)}
                    className="px-3 py-1 rounded-lg border border-gray-200 text-gray-700"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplyTarget({ id: tpl.id })}
                    className="px-3 py-1 rounded-lg border border-gray-200 text-gray-700"
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTemplate(tpl)}
                    className="px-3 py-1 rounded-lg border border-red-200 text-red-700"
                  >
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
            {!templates.length && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">
                  No hay templates registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editing ? "Editar" : "Crear"} template</h3>
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
                <span className="text-sm text-gray-700">Tipo</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="expression">Expression</option>
                  <option value="conditional">Conditional</option>
                  <option value="pipeline">Pipeline</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-700">Descripción</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="border rounded-lg px-3 py-2"
              />
            </label>

            <FormulaEditor
              open
              hideChrome
              initialValue={{ formula: form.formula, type: form.type, exampleContext: form.exampleContext }}
              onValidate={async (payload) => api.post("/determinations-catalog/formula/validate", payload)}
              onSave={(payload) => setForm((prev) => ({ ...prev, ...payload }))}
            />

            <div className="flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700">
                Cancelar
              </button>
              <button onClick={saveTemplate} className="px-4 py-2 rounded-lg bg-blue-600 text-white">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {applyTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Aplicar template</h3>
              <button onClick={() => setApplyTarget(null)} className="text-gray-500 hover:text-gray-700">
                <FiX />
              </button>
            </div>
            <p className="text-sm text-gray-600">Selecciona la determinación destino.</p>
            <select
              value={applyTarget.determinationId || ""}
              onChange={(e) => setApplyTarget((prev) => ({ ...prev, determinationId: e.target.value }))}
              className="border rounded-lg px-3 py-2 w-full"
            >
              <option value="">Selecciona determinación</option>
              {determinations.map((det) => (
                <option key={det.id} value={det.id}>
                  {det.name} ({det.roche_code || "-"})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setApplyTarget(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700">
                Cancelar
              </button>
              <button onClick={applyTemplate} className="px-4 py-2 rounded-lg bg-blue-600 text-white inline-flex items-center gap-2">
                <FiSend /> Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalculationTemplates;
