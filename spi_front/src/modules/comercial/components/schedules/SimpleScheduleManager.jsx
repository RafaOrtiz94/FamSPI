import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCalendar,
  FiPlus,
  FiChevronRight,
  FiX,
  FiCheckCircle,
  FiAlertTriangle,
  FiSearch,
  FiFilter,
  FiEdit3,
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import ScheduleCalendarView from "./ScheduleCalendarView";
import ScheduleStatusBadge from "./ScheduleStatusBadge";

const SimpleScheduleManager = ({
  schedules = [],
  onCreate,
  onAddVisit,
  onUpdateVisit,
  onRemoveVisit,
  onSubmit,
  onDelete,
  editingLocked,
  onRequestEdit,
  onSelectSchedule,
  activeSchedule,
  clients = [],
}) => {
  const [currentView, setCurrentView] = useState("list");
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [createForm, setCreateForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    notes: "",
  });
  const [visitForm, setVisitForm] = useState({
    client_request_id: "",
    planned_date: "",
    city: "",
    priority: 2,
    notes: "",
    duration_hours: 2,
  });
  const [loading, setLoading] = useState(false);

  const filteredSchedules = useMemo(() => {
    return schedules.filter((schedule) => {
      const matchesSearch =
        searchTerm === "" ||
        `${schedule.month}/${schedule.year}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.status.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || schedule.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [schedules, searchTerm, statusFilter]);

  const handleCreateSchedule = async () => {
    if (!createForm.month || !createForm.year) return;
    setLoading(true);
    setFormError("");
    try {
      const created = await onCreate?.({
        month: Number(createForm.month),
        year: Number(createForm.year),
        notes: createForm.notes,
      });
      if (created) {
        setSelectedSchedule(created);
        onSelectSchedule?.(created);
      }
      setCreateForm({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), notes: "" });
      setShowCreateForm(false);
      setCurrentView("list");
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo crear la planificación";
      setFormError(message);
      console.error("Error creating schedule:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setCurrentView("edit");
    onSelectSchedule?.(schedule);
  };

  const handleBackToList = () => {
    setSelectedSchedule(null);
    setCurrentView("list");
    setShowCreateForm(false);
  };

  const handleAddVisit = async () => {
    if (!selectedSchedule || !visitForm.client_request_id || !visitForm.planned_date) return;
    setLoading(true);
    try {
      await onAddVisit?.(selectedSchedule.id, {
        client_request_id: visitForm.client_request_id,
        planned_date: visitForm.planned_date,
        city: visitForm.city,
        priority: Number(visitForm.priority),
        notes: visitForm.notes,
        duration_hours: Number(visitForm.duration_hours),
      });
      setVisitForm({
        client_request_id: "",
        planned_date: "",
        city: "",
        priority: 2,
        notes: "",
        duration_hours: 2,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderListView = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="border bg-white shadow-sm">
        <div className="p-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Planificaciones mensuales</h1>
            <p className="text-sm text-gray-500">{schedules.length} planificaciones registradas</p>
          </div>
          <Button onClick={() => setShowCreateForm(true)} icon={FiPlus}>
            Nueva planificación
          </Button>
        </div>
      </Card>

      <AnimatePresence>
        {showCreateForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border shadow-sm">
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Nueva planificación</h2>
                  <button onClick={() => setShowCreateForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <FiX size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mes</label>
                    <select
                      value={createForm.month}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, month: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {[...Array(12)].map((_, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {new Date(2000, idx).toLocaleDateString("es-ES", { month: "long" })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Año</label>
                    <input
                      type="number"
                      min={new Date().getFullYear()}
                      max={new Date().getFullYear() + 2}
                      value={createForm.year}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, year: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Notas</label>
                    <input
                      type="text"
                      value={createForm.notes}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Objetivos del mes"
                    />
                  </div>
                </div>

                {formError && <p className="text-sm text-rose-600">{formError}</p>}

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setShowCreateForm(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateSchedule} loading={loading} icon={FiCheckCircle}>
                    Crear planificación
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="p-4 border shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2">
            <FiSearch className="text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Buscar por mes, año o estado"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="text-slate-500" size={16} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos</option>
              <option value="draft">Borradores</option>
              <option value="pending_approval">Pendientes</option>
              <option value="approved">Aprobados</option>
              <option value="rejected">Rechazados</option>
            </select>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {filteredSchedules.length === 0 ? (
          <Card className="p-10 border shadow-sm text-center text-slate-600">
            <p>No hay planificaciones que coincidan.</p>
          </Card>
        ) : (
          filteredSchedules.map((schedule) => (
            <Card
              key={schedule.id}
              className="border shadow-sm hover:border-indigo-200 hover:shadow-md transition"
              onClick={() => handleSelectSchedule(schedule)}
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FiCalendar className="text-indigo-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {schedule.month}/{schedule.year}
                    </p>
                    <p className="text-xs text-slate-500">Estado: {schedule.status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <ScheduleStatusBadge status={schedule.status} />
                  <FiChevronRight />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </motion.div>
  );

  const renderEditView = () => {
    if (!selectedSchedule) return null;
    const scheduleToDisplay =
      activeSchedule && activeSchedule.id === selectedSchedule.id ? activeSchedule : selectedSchedule;
    if (!scheduleToDisplay) return null;

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleBackToList} icon={FiChevronRight}>
            Volver a lista
          </Button>
          <ScheduleStatusBadge status={scheduleToDisplay.status} />
          {editingLocked && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <FiAlertTriangle /> Edición bloqueada
            </span>
          )}
        </div>

        <Card className="border shadow-sm">
          <div className="p-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {scheduleToDisplay.month}/{scheduleToDisplay.year}
              </h2>
              <p className="text-sm text-gray-500">Gestiona las visitas del cronograma</p>
            </div>
            <Button onClick={() => onRequestEdit?.(scheduleToDisplay)} icon={FiEdit3} disabled={!editingLocked}>
              Solicitar edición
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="border shadow-sm lg:col-span-2">
            <div className="p-4">
              <ScheduleCalendarView
                schedule={scheduleToDisplay}
                clients={clients}
                onUpdateVisit={onUpdateVisit}
                onRemoveVisit={onRemoveVisit}
                editingLocked={editingLocked}
                onRequestEdit={onRequestEdit}
              />
            </div>
          </Card>

          <Card className="border shadow-sm">
            <div className="p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">Agregar visita</h3>
              <select
                value={visitForm.client_request_id}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, client_request_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecciona cliente</option>
                {clients.map((client) => {
                  const label =
                    client.nombre ||
                    client.commercial_name ||
                    client.name ||
                    client.display_name ||
                    client.email ||
                    client.identificador ||
                    client.id;
                  const value = client.id || client.email || client.identificador || label;
                  return (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <input
                type="date"
                value={visitForm.planned_date}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, planned_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Ciudad"
                value={visitForm.city}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, city: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={visitForm.priority}
                  onChange={(e) => setVisitForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={1}>Baja</option>
                  <option value={2}>Media</option>
                  <option value={3}>Alta</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={visitForm.duration_hours}
                  onChange={(e) => setVisitForm((prev) => ({ ...prev, duration_hours: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Notas"
                  value={visitForm.notes}
                  onChange={(e) => setVisitForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <Button onClick={handleAddVisit} loading={loading} icon={FiPlus}>
                Agregar visita
              </Button>
            </div>
          </Card>
        </div>

        <Card className="border shadow-sm">
          <div className="p-4 flex flex-wrap gap-3 justify-between items-center">
            <div className="text-sm text-gray-600">Acciones del cronograma</div>
            <div className="flex gap-2">
              <Button
                onClick={() => onSubmit?.(scheduleToDisplay.id)}
                disabled={scheduleToDisplay.status !== "draft" && scheduleToDisplay.status !== "rejected"}
                icon={FiCheckCircle}
              >
                {scheduleToDisplay.status === "pending_approval" ? "Reenviar" : "Enviar"}
              </Button>
              {["draft", "rejected"].includes(scheduleToDisplay.status) && (
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm("¿Eliminar esta planificación?")) {
                      onDelete?.(scheduleToDisplay.id);
                      handleBackToList();
                    }
                  }}
                  icon={FiAlertTriangle}
                >
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {currentView === "list" && renderListView()}
          {currentView === "edit" && renderEditView()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SimpleScheduleManager;
/*  */