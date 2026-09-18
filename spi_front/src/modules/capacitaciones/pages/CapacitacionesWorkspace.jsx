import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBook,
  FiCalendar,
  FiFilter,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import { useTrainings, useTrainingActions } from "../hooks/useTrainings";
import TrainingCreateModal from "../components/TrainingCreateModal";
import { TrainingStatusBadge, TrainingTypeBadge } from "../components/TrainingStatusBadge";
import { useUI } from "../../../core/ui/useUI";
import { useAuth } from "../../../core/auth/AuthContext";

const STATUS_FILTER_OPTS = [
  { value: "",              label: "Cualquier estado" },
  { value: "borrador",      label: "Borrador" },
  { value: "programada",    label: "Agendada" },
  { value: "en_curso",      label: "En progreso" },
  { value: "completada",    label: "Realizada" },
  { value: "acta_generada", label: "Registro listo" },
  { value: "en_firma",      label: "Esperando firmas" },
  { value: "firmada",       label: "Todos firmaron" },
  { value: "cancelada",     label: "Cancelada" },
];

const TYPE_FILTER_OPTS = [
  { value: "",                      label: "Cualquier tipo" },
  { value: "interna",               label: "Instructor interno" },
  { value: "externa_instructor",    label: "Instructor externo" },
  { value: "externa_desplazamiento",label: "Desplazamiento" },
];

const EXT_ROLES = new Set(["ing_servicio_ext", "esp_app_ext"]);

function HoverInfo({ value, children, className = "", tooltipClassName = "" }) {
  const text = String(value || "").trim();
  if (!text) return children || null;

  return (
    <span className="group/hover-info relative inline-flex min-w-0 max-w-full align-middle" title={text}>
      <span className={className}>{children || text}</span>
      <span
        className={`pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-max max-w-[min(28rem,78vw)] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-relaxed text-slate-700 shadow-xl ring-1 ring-slate-900/5 group-hover/hover-info:block ${tooltipClassName}`}
      >
        {text}
      </span>
    </span>
  );
}

export default function CapacitacionesWorkspace() {
  const navigate  = useNavigate();
  const { showToast } = useUI?.() ?? {};
  const { user } = useAuth();
  const isExtUser = EXT_ROLES.has(String(user?.role || user?.scope || "").toLowerCase());

  const [showCreate, setShowCreate]   = useState(false);
  const [search, setSearch]           = useState("");

  const { trainings, loading, error, filters, setFilters, reload } = useTrainings({
    status: "",
    type: "",
  });

  const { busy, create } = useTrainingActions(useCallback(() => {
    setShowCreate(false);
    reload();
    showToast?.("Capacitación creada correctamente", "success");
  }, [reload, showToast]));

  const filtered = trainings.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.code?.toLowerCase().includes(q) ||
      t.area?.toLowerCase().includes(q) ||
      t.instructor_name?.toLowerCase().includes(q)
    );
  });

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  };

  const sigPct = (t) => {
    const total  = t.signature_total_signers || 0;
    const signed = t.signature_signed_count  || 0;
    if (!total) return null;
    return `${signed}/${total}`;
  };

  return (
    <div className="flex min-w-0 flex-col bg-[#F1F5F9] p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm">
            <FiBook size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Capacitaciones</h1>
            <p className="text-sm text-slate-500">Registro y seguimiento de la formación del equipo</p>
          </div>
        </div>
        {!isExtUser && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <FiPlus size={16} /> Registrar capacitación
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Buscar por nombre, código o área…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <FiFilter size={14} className="text-slate-400" />
            <select
              className="min-w-0 w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none sm:w-auto"
              value={filters.status || ""}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              {STATUS_FILTER_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              className="min-w-0 w-full border border-slate-200 rounded-xl bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none sm:w-auto"
              value={filters.type || ""}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            >
              {TYPE_FILTER_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              onClick={reload}
              disabled={loading}
              className="shrink-0 rounded-xl border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50"
              title="Actualizar"
            >
              <FiRefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Estado de carga / error */}
      {loading && (
        <div className="flex justify-center items-center py-16 text-slate-400">
          <FiLoader size={22} className="animate-spin mr-2" /> Cargando capacitaciones…
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
          No pudimos cargar las capacitaciones. Por favor intenta de nuevo.
        </div>
      )}

      {/* Tabla */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <FiCalendar size={36} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Todavía no hay capacitaciones registradas</p>
              <p className="text-sm text-slate-400 mt-1">Haz clic en "Registrar capacitación" para agregar la primera</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Modalidad</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Área</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Fecha</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Firmas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => navigate(`/dashboard/capacitaciones/${t.id}`)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">{t.code}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <HoverInfo
                              value={t.title}
                              className="block min-w-0 max-w-[20rem] truncate font-semibold text-slate-800"
                            />
                            {t.is_owner
                              ? <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Organizador</span>
                              : <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Asistente</span>
                            }
                          </div>
                          {t.instructor_name && (
                            <HoverInfo
                              value={t.instructor_name}
                              className="mt-0.5 block min-w-0 max-w-[18rem] truncate text-xs text-slate-400"
                              tooltipClassName="font-semibold"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <TrainingTypeBadge type={t.type} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 hidden md:table-cell">
                          <HoverInfo
                            value={t.area || "—"}
                            className="block max-w-[12rem] truncate"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 hidden md:table-cell whitespace-nowrap">
                          {formatDate(t.scheduled_date)}
                        </td>
                        <td className="px-4 py-3.5">
                          <TrainingStatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          {sigPct(t) ? (
                            <span className="text-xs text-slate-600 font-medium">{sigPct(t)}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
                {filtered.length} capacitación{filtered.length !== 1 ? "es" : ""}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de creación */}
      <TrainingCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={create}
        busy={busy}
      />
    </div>
  );
}
