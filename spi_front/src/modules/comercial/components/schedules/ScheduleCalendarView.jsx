import React from "react";
import { motion } from "framer-motion";
import { FiCalendar, FiMapPin, FiClock, FiUser, FiAlertTriangle } from "react-icons/fi";
import ScheduleStatusBadge from "./ScheduleStatusBadge";

const groupByDate = (visits = []) => {
  return visits.reduce((acc, visit) => {
    const key = visit.planned_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(visit);
    return acc;
  }, {});
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 3: return "bg-red-100 text-red-800 border-red-200";
    case 2: return "bg-amber-100 text-amber-800 border-amber-200";
    case 1: default: return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const getPriorityLabel = (priority) => {
  switch (priority) {
    case 3: return "Alta";
    case 2: return "Media";
    case 1: default: return "Baja";
  }
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FiCalendar className="text-slate-600" size={20} />
            Calendario {schedule.month}/{schedule.year}
          </h3>
          <p className="text-sm text-slate-600">Visitas planificadas por día</p>
        </div>
        <ScheduleStatusBadge status={schedule.status} />
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-12">
          <FiCalendar className="mx-auto text-slate-300 mb-4" size={48} />
          <h4 className="text-lg font-semibold text-slate-900 mb-2">Sin visitas planificadas</h4>
          <p className="text-slate-600">Agrega visitas usando el formulario lateral</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(grouped)
          .sort(([a], [b]) => new Date(a) - new Date(b))
          .map(([date, visits]) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-0 shadow-lg shadow-slate-100/50 rounded-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden"
            >
              <div className="bg-slate-600 px-4 py-3">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <p className="font-semibold text-sm">
                      {new Date(date).toLocaleDateString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                      })}
                    </p>
                    <p className="text-xs opacity-90">
                      {new Set(visits.map((v) => v.city)).size} ciudades • {visits.length} visitas
                    </p>
                  </div>
                  <FiCalendar size={16} className="opacity-75" />
                </div>
              </div>

              <div className="p-4 space-y-3">
                {visits
                  .sort((a, b) => (b.priority || 1) - (a.priority || 1)) // Alta prioridad primero
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
                        className={`p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200 ${getPriorityColor(visit.priority || 1)}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <FiUser className="text-slate-500" size={14} />
                              <p className="font-semibold text-sm text-slate-900 truncate">{label}</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-600">
                              <div className="flex items-center gap-1">
                                <FiMapPin size={12} />
                                <span>{visit.city || visit.client_city || visit.client_province || "Sin ciudad"}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <FiClock size={12} />
                                <span>{visit.duration_hours || 2}h</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(visit.priority || 1)}`}>
                              {getPriorityLabel(visit.priority || 1)}
                            </span>
                            <span className="text-xs text-slate-500">#{visit.id}</span>
                          </div>
                        </div>

                        {editingLocked && schedule.status === "approved" && (
                          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                            <FiAlertTriangle className="text-amber-500" size={14} />
                            <span className="text-xs text-amber-700">Edición bloqueada - solicitud requerida</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Cliente</label>
                            <select
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Prioridad</label>
                            <select
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              value={visit.priority || 1}
                              onChange={(e) => handleChangePriority(visit, e.target.value)}
                              disabled={editingLocked && schedule.status === "approved"}
                            >
                              <option value={1}>🔸 Baja</option>
                              <option value={2}>🟡 Media</option>
                              <option value={3}>🔴 Alta</option>
                            </select>
                          </div>
                        </div>

                        {visit.notes && (
                          <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                            <p className="text-xs text-slate-600">{visit.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          ))}
      </div>
    </div>
  );
};

export default ScheduleCalendarView;
