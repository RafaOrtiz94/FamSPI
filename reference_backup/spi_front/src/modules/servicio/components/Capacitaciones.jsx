import React, { useCallback, useEffect, useState } from "react";
import { FiCalendar, FiPlus, FiRefreshCw } from "react-icons/fi";
import api from "../../../core/api/index";
import { useUI } from "../../../core/ui/useUI";

const Capacitaciones = ({ initialItems = null, onRefresh }) => {
  const { showToast } = useUI();
  const [list, setList] = useState(initialItems || []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    modalidad: "presencial",
    instructor: "",
    fecha: "",
    hora: "",
    estado: "programada",
  });

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/servicio/capacitaciones");
      const rows = data.result?.rows || data.rows || data || [];
      setList(rows);
    } catch (e) {
      console.error(e);
      showToast("No se pudo listar capacitaciones", "error");
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (Array.isArray(initialItems)) {
      setList(initialItems);
    }
  }, [initialItems]);

  const save = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post("/servicio/capacitaciones", form);
      showToast("Capacitación registrada ✅", "success");
      setOpen(false);
      setForm({
        titulo: "",
        modalidad: "presencial",
        instructor: "",
        fecha: "",
        hora: "",
        estado: "programada",
      });
      await load();
      await onRefresh?.();
    } catch (e) {
      console.error(e);
      showToast("No se pudo registrar la capacitación", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FiCalendar /> Capacitaciones Técnicas
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Planifica y registra capacitaciones del equipo técnico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            <FiPlus /> Nueva
          </button>
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700"
          >
            <FiRefreshCw />
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(list || []).map((c) => (
          <div
            key={c.id}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {c.titulo}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {c.modalidad} — {c.instructor || "Por confirmar"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {c.fecha} {c.hora && `• ${c.hora}`}
            </p>
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {c.estado}
            </span>
          </div>
        ))}

        {list?.length === 0 && (
          <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-8">
            No hay capacitaciones.
          </div>
        )}
      </div>

      {/* Modal simple */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-3">Nueva capacitación</h3>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300">Título</label>
                <input
                  value={form.titulo}
                  onChange={(e) => setField("titulo", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-300">Modalidad</label>
                  <select
                    value={form.modalidad}
                    onChange={(e) => setField("modalidad", e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                    <option value="mixta">Mixta</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-300">Instructor</label>
                  <input
                    value={form.instructor}
                    onChange={(e) => setField("instructor", e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-300">Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setField("fecha", e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-300">Hora</label>
                  <input
                    type="time"
                    value={form.hora}
                    onChange={(e) => setField("hora", e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300">Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setField("estado", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                >
                  <option value="programada">Programada</option>
                  <option value="en_curso">En curso</option>
                  <option value="finalizada">Finalizada</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Capacitaciones;
