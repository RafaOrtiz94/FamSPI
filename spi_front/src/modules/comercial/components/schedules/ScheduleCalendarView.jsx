import ScheduleStatusBadge from "./ScheduleStatusBadge";

const groupByDate = (visits = []) => {
  return visits.reduce((acc, visit) => {
    const key = visit.planned_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(visit);
    return acc;
  }, {});
};

const ScheduleCalendarView = ({ schedule, clients = [], onUpdateVisit, onRemoveVisit, editingLocked, onRequestEdit }) => {
  if (!schedule) return null;
  const grouped = groupByDate(schedule.visits || []);

  const findClient = (id) => clients.find((c) => String(c.id) === String(id));

  const handleChangePriority = (visit, value) => {
    if (editingLocked && schedule.status === "approved") {
      onRequestEdit?.(schedule);
      return;
    }
    const priority = Number(value) || 1;
    onUpdateVisit?.(schedule.id, visit.id, { priority });
  };

  const handleChangeClient = (visit, value) => {
    if (editingLocked && schedule.status === "approved") {
      onRequestEdit?.(schedule);
      return;
    }
    const selected = findClient(value);
    const city = selected?.shipping_city || selected?.shipping_province || selected?.shipping_address || visit.city;
    onUpdateVisit?.(schedule.id, visit.id, { client_request_id: Number(value), city });
  };

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
                .map((visit) => {
                  const client = findClient(visit.client_request_id);
                  const label =
                    visit.client_name ||
                    client?.commercial_name ||
                    client?.nombre ||
                    client?.name ||
                    client?.display_name ||
                    client?.email ||
                    client?.identificador ||
                    `Cliente #${visit.client_request_id}`;
                  return (
                    <div
                      key={visit.id}
                      className="p-2 border rounded-md flex flex-col gap-2 text-sm bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{label}</p>
                          <p className="text-xs text-gray-500">
                            {visit.city || visit.client_city || visit.client_province || "Ciudad no especificada"}
                          </p>
                        </div>
                        <span className="text-[11px] text-gray-500">ID #{visit.id}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-gray-500">Cliente</label>
                          <select
                            className="border rounded px-2 py-1 text-xs"
                            value={visit.client_request_id || ""}
                            onChange={(e) => handleChangeClient(visit, e.target.value)}
                            disabled={editingLocked && schedule.status === "approved"}
                          >
                            <option value="">Selecciona cliente</option>
                            {clients.map((c) => {
                              const cLabel =
                                c.commercial_name ||
                                c.nombre ||
                                c.name ||
                                c.display_name ||
                                c.email ||
                                c.identificador ||
                                `Cliente #${c.id}`;
                              return (
                                <option key={c.id} value={c.id}>
                                  {cLabel}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-gray-500">Prioridad</label>
                          <select
                            className="border rounded px-2 py-1 text-xs"
                            value={visit.priority || 1}
                            onChange={(e) => handleChangePriority(visit, e.target.value)}
                            disabled={editingLocked && schedule.status === "approved"}
                          >
                            {[1, 2, 3].map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleCalendarView;
