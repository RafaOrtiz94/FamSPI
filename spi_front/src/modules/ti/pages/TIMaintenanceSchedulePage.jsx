import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiFilter, FiPlus, FiRefreshCw } from "react-icons/fi";
import {
  createTiMaintenance,
  listTiAssets,
  listTiMaintenance,
} from "../../../core/api/tiAssetsApi";
import { useUI } from "../../../core/ui/UIContext";
import Button from "../../../core/ui/components/Button";

const DEVICE_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "computadora", label: "Computadoras" },
  { key: "celular", label: "Celulares" },
];

const matchesDeviceType = (row, filter) => {
  if (filter === "all") return true;
  const haystack = String(
    row?.equipo ||
      row?.equipo_nombre ||
      row?.nombre_equipo ||
      row?.tipo_equipo ||
      row?.descripcion ||
      ""
  )
    .toLowerCase()
    .trim();
  if (filter === "computadora") {
    return haystack.includes("comput") || haystack.includes("laptop") || haystack.includes("pc");
  }
  if (filter === "celular") {
    return haystack.includes("cel") || haystack.includes("movil") || haystack.includes("phone");
  }
  return true;
};

const TIMaintenanceSchedulePage = () => {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [form, setForm] = useState({
    id_equipo: "",
    tipo: "Preventivo",
    fecha_programada: "",
    responsable: "",
    observaciones: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mData, eData] = await Promise.all([listTiMaintenance(), listTiAssets()]);
      setRows(Array.isArray(mData) ? mData : []);
      setEquipos(Array.isArray(eData) ? eData : []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar cronograma de mantenimientos", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesDeviceType(row, deviceFilter)),
    [rows, deviceFilter]
  );

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.id_equipo || !form.fecha_programada) {
      showToast("Selecciona equipo y fecha programada", "warning");
      return;
    }
    setSaving(true);
    try {
      await createTiMaintenance({
        asset_id: Number(form.id_equipo),
        planned_date: form.fecha_programada,
        notes: [form.tipo, form.responsable ? `Responsable: ${form.responsable}` : null, form.observaciones]
          .filter(Boolean)
          .join(" | "),
      });
      showToast("Mantenimiento programado", "success");
      setForm({
        id_equipo: "",
        tipo: "Preventivo",
        fecha_programada: "",
        responsable: "",
        observaciones: "",
      });
      await loadData();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo programar el mantenimiento", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cronograma TI de Mantenimientos</h1>
          <p className="text-sm text-slate-500">Gestión de mantenimientos para celulares y computadoras asignadas.</p>
        </div>
        <Button type="button" variant="secondary" onClick={loadData} icon={FiRefreshCw}>
          Recargar
        </Button>
      </div>

      <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-800">Programar mantenimiento</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <select
            value={form.id_equipo}
            onChange={(e) => setForm((prev) => ({ ...prev, id_equipo: e.target.value }))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Selecciona equipo</option>
            {equipos.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name || `${eq.brand || ""} ${eq.model || ""}`.trim() || `Activo ${eq.id}`}
              </option>
            ))}
          </select>
          <select
            value={form.tipo}
            onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="Preventivo">Preventivo</option>
            <option value="Correctivo">Correctivo</option>
          </select>
          <input
            type="date"
            value={form.fecha_programada}
            onChange={(e) => setForm((prev) => ({ ...prev, fecha_programada: e.target.value }))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Responsable"
            value={form.responsable}
            onChange={(e) => setForm((prev) => ({ ...prev, responsable: e.target.value }))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <Button type="submit" variant="primary" icon={FiPlus} disabled={saving}>
            {saving ? "Guardando..." : "Programar"}
          </Button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FiFilter /> Filtro de equipos
          </div>
          <div className="flex flex-wrap gap-2">
            {DEVICE_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setDeviceFilter(item.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  deviceFilter === item.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Cargando cronograma...</p>
        ) : filteredRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No hay mantenimientos para este filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2">Equipo</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2">Responsable</th>
                  <th className="px-2 py-2">Fecha</th>
                  <th className="px-2 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-2 py-2">{row.asset_name || `Activo ${row.asset_id}`}</td>
                    <td className="px-2 py-2">Preventivo</td>
                    <td className="px-2 py-2">TI</td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                        <FiCalendar size={12} /> {String(row.planned_date || "").slice(0, 10)}
                      </span>
                    </td>
                    <td className="px-2 py-2">{row.status || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TIMaintenanceSchedulePage;
