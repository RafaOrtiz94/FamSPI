import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiRefreshCw, FiSettings } from "react-icons/fi";
import api from "../../../core/api/index";
import { useUI } from "../../../core/ui/useUI";

const statusBadge = (s) => {
  switch (s) {
    case "operativo":
    case "ok":
      return "bg-green-100 text-green-700";
    case "en_mantenimiento":
      return "bg-amber-100 text-amber-700";
    case "baja":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const Equipos = ({ initialRows = null, onRefresh }) => {
  const { showToast, confirm } = useUI();
  const [list, setList] = useState(initialRows || []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    modelo: "",
    serie: "",
    estado: "operativo",
  });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/servicio/equipos", { params: { q: q || undefined } });
      const rows = data.result?.rows || data.rows || data || [];
      setList(rows);
    } catch (e) {
      console.error(e);
      showToast("No se pudieron listar los equipos", "error");
    }
  }, [q, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (Array.isArray(initialRows)) {
      setList(initialRows);
    }
  }, [initialRows]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return list;
    return list.filter((e) =>
      [e.nombre, e.modelo, e.serie].filter(Boolean).some((v) => String(v).toLowerCase().includes(text))
    );
  }, [list, q]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post("/servicio/equipos", form);
      showToast("Equipo registrado ✅", "success");
      setOpen(false);
      setForm({ nombre: "", modelo: "", serie: "", estado: "operativo" });
      await load();
      await onRefresh?.();
    } catch (e) {
      console.error(e);
      showToast("No se pudo registrar el equipo", "error");
    } finally {
      setSaving(false);
    }
  };

  const changeState = async (row, estado) => {
    const ok = await confirm(`¿Cambiar estado del equipo "${row.nombre}" a "${estado}"?`);
    if (!ok) return;
    try {
      await api.patch(`/servicio/equipos/${row.id}`, { estado });
      showToast("Estado actualizado ✅", "success");
      await load();
      await onRefresh?.();
    } catch (e) {
      console.error(e);
      showToast("No se pudo actualizar el estado", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FiSettings /> Equipos Técnicos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Catálogo de equipos, modelos, series y estados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Buscar por nombre / modelo / serie"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
          />
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            <FiPlus /> Nuevo
          </button>
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700"
          >
            <FiRefreshCw />
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Modelo</th>
              <th className="px-4 py-2">Serie</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-4 py-2">{e.id}</td>
                <td className="px-4 py-2">{e.nombre}</td>
                <td className="px-4 py-2">{e.modelo}</td>
                <td className="px-4 py-2">{e.serie}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(e.estado)}`}>
                    {e.estado}
                  </span>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button
                    onClick={() => changeState(e, "operativo")}
                    className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100"
                  >
                    Operativo
                  </button>
                  <button
                    onClick={() => changeState(e, "en_mantenimiento")}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"
                  >
                    Mantenimiento
                  </button>
                  <button
                    onClick={() => changeState(e, "baja")}
                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                  >
                    Baja
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal simple */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-3">Nuevo equipo</h3>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300">Nombre</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setField("nombre", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-300">Modelo</label>
                  <input
                    value={form.modelo}
                    onChange={(e) => setField("modelo", e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-300">Serie</label>
                  <input
                    value={form.serie}
                    onChange={(e) => setField("serie", e.target.value)}
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
                  <option value="operativo">Operativo</option>
                  <option value="en_mantenimiento">En mantenimiento</option>
                  <option value="baja">Baja</option>
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

export default Equipos;
