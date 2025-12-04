import { useEffect, useMemo, useState } from "react";
import { fetchClients } from "../../../core/api/clientsApi";
import ScheduleCalendarView from "./ScheduleCalendarView";
import ScheduleStatusBadge from "./ScheduleStatusBadge";

const ScheduleEditor = ({ schedule, onCreate, onAddVisit, onSubmit }) => {
  const [form, setForm] = useState({ month: "", year: new Date().getFullYear(), notes: "" });
  const [visitForm, setVisitForm] = useState({ client_request_id: "", planned_date: "", city: "", priority: 1, notes: "" });
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");

  useEffect(() => {
    fetchClients({ limit: 200 })
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const term = clientSearch.toLowerCase();
    return clients.filter(
      (client) =>
        client.commercial_name?.toLowerCase().includes(term) ||
        String(client.id).includes(term) ||
        client.shipping_city?.toLowerCase().includes(term),
    );
  }, [clients, clientSearch]);

  const handleSelectClient = (value) => {
    const selected = clients.find((client) => String(client.id) === String(value));
    const inferredCity =
      selected?.shipping_city || selected?.shipping_province || selected?.shipping_address || "";
    setVisitForm((prev) => ({ ...prev, client_request_id: value, city: inferredCity }));
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.month || !form.year) return;
    onCreate?.({ month: Number(form.month), year: Number(form.year), notes: form.notes });
  };

  const handleAddVisit = (e) => {
    e.preventDefault();
    if (!schedule) return;
    if (!visitForm.client_request_id || !visitForm.planned_date || !visitForm.city) return;
    onAddVisit?.(schedule.id, {
      client_request_id: Number(visitForm.client_request_id),
      planned_date: visitForm.planned_date,
      city: visitForm.city,
      priority: Number(visitForm.priority) || 1,
      notes: visitForm.notes,
    });
    setVisitForm({ client_request_id: "", planned_date: "", city: "", priority: 1, notes: "" });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-4">
        <div className="p-4 border rounded-lg bg-white shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Crear cronograma mensual</h3>
          <form className="space-y-2" onSubmit={handleCreate}>
            <div className="flex gap-2">
              <select
                className="border rounded px-2 py-1 w-1/2"
                value={form.month}
                onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}
              >
                <option value="">Mes</option>
                {[...Array(12)].map((_, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {idx + 1}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="border rounded px-2 py-1 w-1/2"
                value={form.year}
                onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
              />
            </div>
            <textarea
              className="border rounded px-2 py-1 w-full"
              rows={3}
              placeholder="Notas"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
            <button
              type="submit"
              className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
            >
              Crear cronograma
            </button>
          </form>
        </div>

        {schedule && (
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {schedule.month}/{schedule.year}
                </p>
                <p className="text-xs text-gray-500">Propietario: tú</p>
              </div>
              <ScheduleStatusBadge status={schedule.status} />
            </div>

            <form className="space-y-2" onSubmit={handleAddVisit}>
              <div className="space-y-2">
                <input
                  type="text"
                  className="border rounded px-2 py-1 w-full"
                  placeholder="Buscar por nombre, ciudad o ID"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={visitForm.client_request_id}
                  onChange={(e) => handleSelectClient(e.target.value)}
                >
                  <option value="">Selecciona un cliente</option>
                  {filteredClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.commercial_name || "Cliente"} — {client.shipping_city || "Ciudad no especificada"}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="date"
                className="border rounded px-2 py-1 w-full"
                value={visitForm.planned_date}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, planned_date: e.target.value }))}
              />
              <input
                type="text"
                className="border rounded px-2 py-1 w-full"
                placeholder="Ciudad"
                value={visitForm.city}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, city: e.target.value }))}
              />
              <label className="text-xs text-gray-500">Prioridad</label>
              <input
                type="number"
                min={1}
                max={3}
                className="border rounded px-2 py-1 w-full"
                value={visitForm.priority}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, priority: e.target.value }))}
              />
              <textarea
                className="border rounded px-2 py-1 w-full"
                rows={2}
                placeholder="Notas"
                value={visitForm.notes}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <button
                type="submit"
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                disabled={schedule.status === "approved"}
              >
                Agregar visita
              </button>
            </form>

            <button
              className="w-full mt-3 bg-blue-600 text-white py-2 rounded disabled:opacity-50"
              onClick={() => onSubmit?.(schedule.id)}
              disabled={schedule.status !== "draft" && schedule.status !== "rejected"}
            >
              Enviar para aprobación
            </button>
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        {schedule ? (
          <ScheduleCalendarView schedule={schedule} />
        ) : (
          <div className="h-full border rounded-lg p-4 bg-gray-50 flex items-center justify-center text-sm text-gray-500">
            Selecciona o crea un cronograma para visualizarlo.
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleEditor;
