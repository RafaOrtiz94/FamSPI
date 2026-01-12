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

const ScheduleCard = ({ schedule, onApprove, onReject, onViewDetails }) => {
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
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" icon={FiEye} onClick={onViewDetails}>
            Ver
          </Button>
          <Button size="sm" variant="success" icon={FiCheck} onClick={() => onApprove(schedule.id)}>
            Aprobar
          </Button>
          <Button size="sm" variant="danger" icon={FiX} onClick={onReject}>
            Rechazar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleCard;
