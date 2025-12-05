import ScheduleStatusBadge from "./ScheduleStatusBadge";

const TeamScheduleOverview = ({ schedules = [] }) => {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Cronogramas del equipo</h3>
          <p className="text-sm text-gray-500">Vista rápida por asesor y estado</p>
        </div>
      </div>
      {schedules.length === 0 && <p className="text-sm text-gray-500">Sin datos de equipo.</p>}
      <div className="space-y-2">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="border rounded-md p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {schedule.user_email} — {schedule.month}/{schedule.year}
              </p>
              <p className="text-xs text-gray-500">
                Última actualización: {schedule.updated_at ? new Date(schedule.updated_at).toLocaleDateString() : ""}
              </p>
            </div>
            <ScheduleStatusBadge status={schedule.status} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamScheduleOverview;
