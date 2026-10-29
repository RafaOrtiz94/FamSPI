import React from "react";
import { FiMapPin, FiCheckCircle, FiClock, FiNavigation, FiUsers } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";

const StatPill = ({ label, value, chipClass }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs font-medium text-[#6B7280]">{label}</span>
    <span className={`font-mono text-2xl font-bold text-[#1F2937]`}>{value}</span>
    {chipClass && (
      <span className={`inline-flex w-fit rounded-full px-2 py-[2px] text-[10px] font-semibold ${chipClass}`}>
        {value === 0 ? "Sin visitas" : value === 1 ? "1 visita" : `${value} visitas`}
      </span>
    )}
  </div>
);

const MyClientRequestsWidget = ({ total, visited, pending, onFilterChange }) => {
  const progress = total ? Math.round((visited / total) * 100) : 0;

  return (
    <Card className="border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-semibold text-[#1F2937]">
            <FiNavigation size={11} />
            Ruta comercial · Check-in diario
          </div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#1F2937]">
            <FiUsers size={18} className="text-[#1E293B]" />
            Tu tablero de visitas
          </h2>
          <p className="max-w-sm text-sm text-[#6B7280]">
            Registra tus visitas en campo, valida ubicación y haz seguimiento de lo visitado y lo que falta.
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-4 md:max-w-sm">
          <div className="grid grid-cols-3 gap-3 border-b border-[#E5E7EB] pb-4">
            <StatPill label="Del día" value={total} />
            <StatPill label="Visitados" value={visited} chipClass={visited > 0 ? "bg-[#DCFCE7] text-[#16A34A]" : undefined} />
            <StatPill label="Pendientes" value={pending} chipClass={pending > 0 ? "bg-[#FEF3C7] text-[#D97706]" : undefined} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span className="inline-flex items-center gap-1">
                <FiClock size={11} />
                Progreso de hoy
              </span>
              <span className="font-mono font-semibold text-[#1F2937]">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
              <div
                className="h-1.5 rounded-full bg-[#2563EB] transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>

          {typeof onFilterChange === "function" && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onFilterChange("all")}
                className="cursor-pointer rounded-full bg-[#F3F4F6] px-3 py-1 text-[11px] font-semibold text-[#1F2937] transition-colors hover:bg-[#E5E7EB]"
              >
                Ver todos
              </button>
              <button
                type="button"
                onClick={() => onFilterChange("pending")}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[#FEF3C7] px-3 py-1 text-[11px] font-semibold text-[#D97706] transition-colors hover:bg-[#FDE68A]"
              >
                <FiMapPin size={10} />
                Pendientes
              </button>
              <button
                type="button"
                onClick={() => onFilterChange("visited")}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[#DCFCE7] px-3 py-1 text-[11px] font-semibold text-[#16A34A] transition-colors hover:bg-[#BBF7D0]"
              >
                <FiCheckCircle size={10} />
                Visitados
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default MyClientRequestsWidget;
