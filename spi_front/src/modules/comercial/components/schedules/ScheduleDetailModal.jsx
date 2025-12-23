import React, { useMemo } from "react";
import { FiCalendar, FiCheck, FiX, FiMapPin } from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";

const groupByDate = (visits = []) => {
  return visits.reduce((acc, visit) => {
    const key = visit.planned_date || "sin_fecha";
    if (!acc[key]) acc[key] = [];
    acc[key].push(visit);
    return acc;
  }, {});
};

const ScheduleDetailModal = ({ schedule, onApprove, onReject }) => {
  const grouped = useMemo(() => groupByDate(schedule?.visits || []), [schedule]);
  const totalCities = useMemo(() => new Set((schedule?.visits || []).map((v) => v.city).filter(Boolean)).size, [schedule]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500">Asesor</p>
          <p className="text-base font-semibold text-gray-900">{schedule.user_name || schedule.user_email}</p>
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <FiCalendar className="text-blue-600" /> Mes {schedule.month} / {schedule.year}
          </p>
        </div>
        <div className="flex gap-2">
          {onApprove && (
            <Button size="sm" variant="success" icon={FiCheck} onClick={onApprove}>
              Aprobar
            </Button>
          )}
          {onReject && (
            <Button size="sm" variant="danger" icon={FiX} onClick={onReject}>
              Rechazar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-lg bg-blue-50 text-blue-900">
          <p className="text-xs uppercase tracking-wide">Visitas</p>
          <p className="text-xl font-semibold">{schedule.visits_count || schedule.visits?.length || 0}</p>
        </div>
        <div className="p-3 rounded-lg bg-purple-50 text-purple-900">
          <p className="text-xs uppercase tracking-wide">Ciudades</p>
          <p className="text-xl font-semibold">{totalCities}</p>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {Object.entries(grouped).map(([date, visits]) => (
          <div key={date} className="border border-gray-100 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FiCalendar className="text-gray-500" /> {date}
              </p>
              <span className="text-xs text-gray-500">{visits.length} visitas</span>
            </div>
            <div className="space-y-2">
              {visits.map((visit) => (
                <div key={visit.id} className="flex items-center justify-between text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <FiMapPin className="text-gray-400" />
                    <div>
                      <p className="font-semibold text-gray-900">{visit.client_name || `Cliente ${visit.client_request_id}`}</p>
                      <p className="text-xs text-gray-500">{visit.city}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">Prioridad {visit.priority || 1}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleDetailModal;
