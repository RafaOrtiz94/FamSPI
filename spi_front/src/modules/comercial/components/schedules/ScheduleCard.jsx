import React from "react";
import { FiCalendar, FiCheck, FiEye, FiX } from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const getMonthName = (month) => monthNames[(Number(month) || 1) - 1] || "";
const formatDate = (value) => (value ? new Date(value).toLocaleString("es-EC") : "—");

const ScheduleCard = ({
  schedule,
  onApprove,
  onReject,
  onViewDetails,
  showMeta = false,
  approveLoading = false,
  rejectLoading = false,
  viewLoading = false,
  disabled = false,
}) => {
  const canApprove = schedule.status === "pending_approval";
  const efficiencyPct =
    typeof schedule.efficiency_ratio === "number"
      ? Math.round(schedule.efficiency_ratio * 100)
      : null;
  const detailsPct =
    typeof schedule.details_completion_ratio === "number"
      ? Math.round(schedule.details_completion_ratio * 100)
      : null;
  const avgDuration =
    typeof schedule.avg_duration_minutes === "number"
      ? Math.round(schedule.avg_duration_minutes)
      : null;
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <FiCalendar className="text-blue-600" />
            <h4 className="font-semibold text-gray-900">{schedule.user_name || schedule.user_email}</h4>
          </div>
          <p className="text-sm text-gray-600">
            {getMonthName(schedule.month)} {schedule.year}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>📍 {schedule.visits_count || 0} visitas</span>
            <span>🏙️ {(schedule.cities || []).join(", ")}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
              Cumplidas {schedule.visits_visited || 0}
            </span>
            <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">
              Pendientes {schedule.visits_pending || 0}
            </span>
            <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700">
              No cumplidas {schedule.visits_skipped || 0}
            </span>
            {schedule.visits_in_visit ? (
              <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                En visita {schedule.visits_in_visit}
              </span>
            ) : null}
            {typeof schedule.unexpected_client_visits === "number" && (
              <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                No planificadas {schedule.unexpected_client_visits}
              </span>
            )}
            {efficiencyPct !== null && (
              <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                Eficiencia {efficiencyPct}%
              </span>
            )}
            {detailsPct !== null && (
              <span className="px-2 py-1 rounded-full bg-teal-50 text-teal-700">
                Detalles completos {detailsPct}%
              </span>
            )}
            {avgDuration !== null && (
              <span className="px-2 py-1 rounded-full bg-sky-50 text-sky-700">
                Promedio {avgDuration} min
              </span>
            )}
          </div>
          {showMeta && (
            <div className="mt-2 text-xs text-gray-500 space-y-1">
              <p>Enviado: {formatDate(schedule.submitted_at)}</p>
              <p>
                Aprobado por: {schedule.reviewed_by_email || "—"} · {formatDate(schedule.reviewed_at)}
              </p>
              <p>Estado: {schedule.status || "—"}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={FiEye}
            onClick={onViewDetails}
            loading={viewLoading}
            disabled={disabled && !viewLoading}
          >
            Ver
          </Button>
          {canApprove && (
            <>
              <Button
                size="sm"
                variant="success"
                icon={FiCheck}
                onClick={() => onApprove(schedule.id)}
                loading={approveLoading}
                disabled={disabled && !approveLoading}
              >
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={FiX}
                onClick={onReject}
                loading={rejectLoading}
                disabled={disabled && !rejectLoading}
              >
                Rechazar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleCard;
