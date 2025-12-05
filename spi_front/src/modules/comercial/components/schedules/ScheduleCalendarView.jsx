import ScheduleStatusBadge from "./ScheduleStatusBadge";

const groupByDate = (visits = []) => {
  return visits.reduce((acc, visit) => {
    const key = visit.planned_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(visit);
    return acc;
  }, {});
};

const ScheduleCalendarView = ({ schedule }) => {
  if (!schedule) return null;
  const grouped = groupByDate(schedule.visits || []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Calendario {schedule.month}/{schedule.year}
          </h3>
          <p className="text-sm text-gray-500">Visitas planificadas por día</p>
        </div>
        <ScheduleStatusBadge status={schedule.status} />
      </div>

      {Object.keys(grouped).length === 0 && (
        <p className="text-sm text-gray-500">Aún no hay visitas planificadas.</p>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {Object.entries(grouped).map(([date, visits]) => (
          <div key={date} className="border rounded-lg p-3 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{date}</p>
                <p className="text-xs text-gray-500">
                  {new Set(visits.map((v) => v.city)).size} ciudades • {visits.length} visitas
                </p>
              </div>
              <span className="text-xs text-gray-500">Prioridad baja → alta</span>
            </div>
            <div className="space-y-2">
              {visits
                .sort((a, b) => (a.priority || 1) - (b.priority || 1))
                .map((visit) => (
                  <div
                    key={visit.id}
                    className="p-2 border rounded-md flex items-center justify-between text-sm bg-gray-50"
                  >
                    <div>
                      <p className="font-semibold">{visit.client_name || `Cliente #${visit.client_request_id}`}</p>
                      <p className="text-xs text-gray-500">
                        {visit.city || visit.client_city || visit.client_province || "Ciudad no especificada"}
                      </p>
                    </div>
                    <span className="text-xs text-gray-600">Prioridad {visit.priority || 1}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleCalendarView;
