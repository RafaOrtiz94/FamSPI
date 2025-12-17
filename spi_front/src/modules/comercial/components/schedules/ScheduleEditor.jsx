import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FiCalendar,
  FiPlus,
  FiMapPin,
  FiSearch,
  FiUser,
  FiClock,
  FiFlag,
  FiFileText,
  FiSend,
  FiTrash2,
  FiEdit3,
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo
} from "react-icons/fi";
import { fetchClients } from "../../../../core/api/clientsApi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import ScheduleCalendarView from "./ScheduleCalendarView";
import ScheduleStatusBadge from "./ScheduleStatusBadge";

const ScheduleEditor = ({
  schedule,
  onCreate,
  onAddVisit,
  onUpdateVisit,
  onRemoveVisit,
  onSubmit,
  onDelete,
  editingLocked,
  onRequestEdit,
}) => {
  const [form, setForm] = useState({ month: "", year: new Date().getFullYear(), notes: "" });
  const [visitForm, setVisitForm] = useState({ client_request_id: "", planned_date: "", city: "", priority: 1, notes: "" });
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");

  useEffect(() => {
    fetchClients({ limit: 200 })
      .then((data) => {
        if (Array.isArray(data)) {
          setClients(data);
          return;
        }
        setClients(Array.isArray(data?.clients) ? data.clients : []);
      })
      .catch(() => setClients([]));
  }, []);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const term = clientSearch.toLowerCase();
    return clients.filter((client) => {
      const fields = [
        client.commercial_name,
        client.nombre,
        client.name,
        client.display_name,
        client.email,
        client.identificador,
        client.shipping_city,
        client.shipping_province,
      ]
        .filter(Boolean)
        .map((f) => String(f).toLowerCase());
      return fields.some((f) => f.includes(term)) || String(client.id).includes(term);
    });
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
    if (editingLocked && schedule.status === "approved") {
      onRequestEdit?.();
      return;
    }
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

  const handleDelete = () => {
    if (!schedule) return;
    if (editingLocked && schedule.status === "approved") {
      onRequestEdit?.();
      return;
    }
    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este cronograma? Esta acción no se puede deshacer.",
    );
    if (confirmed) {
      onDelete?.(schedule.id);
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* Panel de Control - Crear y Gestionar */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full xl:w-2/5 space-y-6"
      >
        {/* Crear Nuevo Cronograma */}
        <Card className="border-0 shadow-xl shadow-indigo-100/60 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/20">
                <FiPlus className="text-white" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Crear Cronograma</h3>
                <p className="text-indigo-100 text-sm">Planifica tu mes comercial</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <FiCalendar className="inline mr-2" size={16} />
                    Mes
                  </label>
                  <select
                    value={form.month}
                    onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-colors"
                    required
                  >
                    <option value="">Seleccionar mes</option>
                    {[...Array(12)].map((_, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {new Date(2000, idx).toLocaleDateString('es-ES', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <FiClock className="inline mr-2" size={16} />
                    Año
                  </label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-colors"
                    min={new Date().getFullYear()}
                    max={new Date().getFullYear() + 2}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <FiFileText className="inline mr-2" size={16} />
                  Notas del plan
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-colors resize-none"
                  placeholder="Objetivos, estrategias o notas importantes para este mes..."
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200"
                icon={FiPlus}
              >
                Crear Cronograma Mensual
              </Button>
            </form>
          </div>
        </Card>

        {/* Gestionar Cronograma Actual */}
        {schedule && (
          <Card className="border-0 shadow-xl shadow-slate-100/60 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/20">
                    <FiCalendar className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {schedule.month}/{schedule.year}
                    </h3>
                    <p className="text-slate-200 text-sm">Gestionar plan actual</p>
                  </div>
                </div>
                <ScheduleStatusBadge status={schedule.status} />
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Estado de Aprobación */}
              {schedule.status === "approved" && editingLocked && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <FiAlertTriangle className="text-amber-600 mt-0.5" size={20} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900">Cronograma Aprobado</h4>
                      <p className="text-amber-800 text-sm mt-1">
                        Para modificarlo se enviará nuevamente a aprobación.
                      </p>
                      <Button
                        size="sm"
                        variant="warning"
                        className="mt-3"
                        onClick={() => onRequestEdit?.(schedule)}
                        icon={FiEdit3}
                      >
                        Habilitar Edición
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Acciones de Eliminación */}
              {["draft", "rejected"].includes(schedule.status) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={handleDelete}
                    icon={FiTrash2}
                  >
                    Eliminar Cronograma
                  </Button>
                </motion.div>
              )}

              {/* Formulario de Nueva Visita */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <FiPlus className="text-indigo-600" size={18} />
                  <h4 className="font-semibold text-slate-900">Agregar Nueva Visita</h4>
                </div>

                <form onSubmit={handleAddVisit} className="space-y-4">
                  {/* Búsqueda de Cliente */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      <FiUser className="inline mr-2" size={16} />
                      Cliente
                    </label>
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, ciudad o ID..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-colors"
                      />
                    </div>

                    {clientSearch && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-2 max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white"
                      >
                        {filteredClients.length > 0 ? (
                          filteredClients.slice(0, 5).map((client) => (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => {
                                handleSelectClient(client.id);
                                setClientSearch("");
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                            >
                              <div className="font-medium text-slate-900">
                                {client.commercial_name || client.nombre || client.name || `Cliente #${client.id}`}
                              </div>
                              <div className="text-xs text-slate-500">
                                {client.shipping_city || "Ciudad no especificada"} • ID: {client.id}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-slate-500 text-sm">
                            No se encontraron clientes
                          </div>
                        )}
                      </motion.div>
                    )}

                    {visitForm.client_request_id && (
                      <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FiCheckCircle className="text-green-600" size={16} />
                          <span className="text-sm font-medium text-indigo-900">
                            Cliente seleccionado
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fecha y Ciudad */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        <FiCalendar className="inline mr-2" size={16} />
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={visitForm.planned_date}
                        onChange={(e) => setVisitForm((prev) => ({ ...prev, planned_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        <FiMapPin className="inline mr-2" size={16} />
                        Ciudad
                      </label>
                      <input
                        type="text"
                        placeholder="Ciudad de la visita"
                        value={visitForm.city}
                        onChange={(e) => setVisitForm((prev) => ({ ...prev, city: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-colors"
                        required
                      />
                    </div>
                  </div>

                  {/* Prioridad y Notas */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        <FiFlag className="inline mr-2" size={16} />
                        Prioridad
                      </label>
                      <select
                        value={visitForm.priority}
                        onChange={(e) => setVisitForm((prev) => ({ ...prev, priority: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-colors"
                      >
                        <option value={1}>🔵 Baja</option>
                        <option value={2}>🟡 Media</option>
                        <option value={3}>🔴 Alta</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        <FiFileText className="inline mr-2" size={16} />
                        Notas
                      </label>
                      <textarea
                        value={visitForm.notes}
                        onChange={(e) => setVisitForm((prev) => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-colors resize-none"
                        placeholder="Objetivos de la visita, productos a promocionar..."
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3 rounded-xl shadow-lg shadow-green-500/25 transition-all duration-200"
                    disabled={editingLocked && schedule.status === "approved"}
                    icon={FiPlus}
                  >
                    Agregar Visita al Cronograma
                  </Button>
                </form>
              </div>

              {/* Enviar para Aprobación */}
              <div className="pt-4 border-t border-slate-200">
                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200"
                  onClick={() => onSubmit?.(schedule.id)}
                  disabled={(editingLocked && schedule.status === "approved") || (schedule.status !== "draft" && schedule.status !== "rejected")}
                  icon={FiSend}
                >
                  {schedule.status === "pending_approval" ? "Reenviar para Aprobación" : "Enviar para Aprobación"}
                </Button>

                {(editingLocked && schedule.status === "approved") && (
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    <FiInfo className="inline mr-1" size={12} />
                    Habilita la edición para poder enviar cambios
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}
      </motion.div>

      {/* Panel de Visualización - Calendario */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full xl:w-3/5"
      >
        {schedule ? (
          <Card className="border-0 shadow-xl shadow-slate-100/60 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/20">
                  <FiCalendar className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Vista Calendario</h3>
                  <p className="text-slate-200 text-sm">
                    Planificación visual de {schedule.month}/{schedule.year}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <ScheduleCalendarView
                schedule={schedule}
                clients={clients}
                onUpdateVisit={onUpdateVisit}
                onRemoveVisit={onRemoveVisit}
                editingLocked={editingLocked}
                onRequestEdit={onRequestEdit}
              />
            </div>
          </Card>
        ) : (
          <Card className="border-0 shadow-xl shadow-slate-100/60 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-100 to-slate-200 px-6 py-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-200 rounded-full mb-4">
                  <FiCalendar className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Sin Cronograma Seleccionado
                </h3>
                <p className="text-slate-600 max-w-sm mx-auto">
                  Crea un nuevo cronograma mensual o selecciona uno existente para visualizar y gestionar tus visitas comerciales.
                </p>
              </motion.div>
            </div>
          </Card>
        )}
      </motion.div>
    </div>
  );
};

export default ScheduleEditor;
