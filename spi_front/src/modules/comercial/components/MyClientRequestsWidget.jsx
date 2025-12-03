import React from "react";
import {
  FiMapPin,
  FiCheckCircle,
  FiClock,
  FiNavigation,
  FiUsers,
} from "react-icons/fi";
import Card from "../../../core/ui/components/Card";

const ProgressBar = ({ value }) => (
  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
    <div
      className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 transition-all"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

const StatPill = ({ label, value, accent }) => (
  <div className="flex flex-col rounded-2xl bg-white/70 backdrop-blur px-4 py-3 border border-gray-100 shadow-sm">
    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
      {label}
    </span>
    <span className={`mt-1 text-2xl font-bold ${accent}`}>{value}</span>
  </div>
);

/**
 * Widget de cabecera para el módulo de clientes comerciales.
 * Muestra el estado diario de visitas y resalta la acción principal
 * de check‑in / check‑out, sin secciones de documentación ni solicitudes.
 */
const MyClientRequestsWidget = ({ total, visited, pending, onFilterChange }) => {
  const progress = total ? Math.round((visited / total) * 100) : 0;

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white">
      {/* halo decorativo */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-emerald-400/30 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
            <FiNavigation className="h-4 w-4" />
            Ruta comercial · Check‑in diario
          </div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FiUsers className="h-5 w-5" />
            Tu tablero de visitas de clientes
          </h2>
          <p className="text-sm text-blue-50 max-w-md">
            Registra tus visitas en campo con un solo clic, valida ubicación
            y haz seguimiento claro de lo que ya visitaste y lo que falta.
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-3 md:max-w-md">
          <div className="grid grid-cols-3 gap-3 text-gray-900">
            <StatPill label="Clientes del día" value={total} accent="text-white" />
            <StatPill label="Visitados" value={visited} accent="text-emerald-300" />
            <StatPill label="Pendientes" value={pending} accent="text-amber-200" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-blue-50">
              <span className="inline-flex items-center gap-1">
                <FiClock className="h-3 w-3" />
                Progreso de la ruta de hoy
              </span>
              <span>{progress}% completado</span>
            </div>
            <ProgressBar value={progress} />
          </div>

          {typeof onFilterChange === "function" && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => onFilterChange("all")}
                className="rounded-full bg-white/10 px-3 py-1 font-medium text-blue-50 hover:bg-white/20 transition"
              >
                Ver todos
              </button>
              <button
                type="button"
                onClick={() => onFilterChange("pending")}
                className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 font-medium text-amber-100 hover:bg-amber-400/30 transition"
              >
                <FiMapPin className="h-3 w-3" />
                Solo pendientes
              </button>
              <button
                type="button"
                onClick={() => onFilterChange("visited")}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1 font-medium text-emerald-100 hover:bg-emerald-400/30 transition"
              >
                <FiCheckCircle className="h-3 w-3" />
                Solo visitados
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default MyClientRequestsWidget;
