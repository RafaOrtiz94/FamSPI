import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  FiChevronRight,
  FiChevronLeft,
  FiX,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiArrowRight
} from "react-icons/fi";
import { fetchClients } from "../../../../core/api/clientsApi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import ScheduleCalendarView from "./ScheduleCalendarView";
import ScheduleStatusBadge from "./ScheduleStatusBadge";

/**
 * Editor intuitivo de planificación mensual - Versión rediseñada para máxima usabilidad
 * Características principales:
 * - Flujo wizard paso a paso
 * - Calendario visual con drag & drop
 * - Búsqueda inteligente de clientes
 * - Vista general clara
 */
const ScheduleEditorIntuitive = ({
  schedule,
  schedules = [],
  onCreate,
  onAddVisit,
  onUpdateVisit,
  onRemoveVisit,
  onSubmit,
  onDelete,
  onSelectSchedule,
  editingLocked,
  onRequestEdit,
}) => {
  // Estados principales
  const [currentStep, setCurrentStep] = useState(1);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedClients, setSelectedClients] = useState([]);
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [localSchedules, setLocalSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);

  // Estados del formulario
  const [scheduleForm, setScheduleForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    notes: ""
  });

  const [visitForm, setVisitForm] = useState({
    client_id: "",
    planned_date: "",
    city: "",
    priority: 2, // Media por defecto
    notes: "",
    duration_hours: 2
  });

  // Estados de datos
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Cargar clientes al montar
  useEffect(() => {
    const loadClients = async () => {
      try {
        const data = await fetchClients({ limit: 500 });
        const clientList = Array.isArray(data) ? data :
                          Array.isArray(data?.clients) ? data.clients : [];
        setClients(clientList);
      } catch (error) {
        console.error("Error loading clients:", error);
      }
    };
    loadClients();
  }, []);

  // Filtrar clientes por búsqueda
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 10); // Mostrar primeros 10 si no hay búsqueda

    const searchTerm = clientSearch.toLowerCase();
    return clients.filter(client => {
      const searchableFields = [
        client.commercial_name,
        client.nombre,
        client.name,
        client.email,
        client.shipping_city,
        client.shipping_province,
        client.identificador
      ].filter(Boolean).map(field => String(field).toLowerCase());

      return searchableFields.some(field => field.includes(searchTerm)) ||
             String(client.id).includes(searchTerm);
    }).slice(0, 20); // Limitar a 20 resultados
  }, [clients, clientSearch]);

  // Estadísticas del cronograma actual
  const scheduleStats = useMemo(() => {
    if (!schedule?.visits) return { total: 0, high: 0, medium: 0, low: 0, cities: 0 };

    const visits = schedule.visits;
    const cities = new Set(visits.map(v => v.city)).size;

    return {
      total: visits.length,
      high: visits.filter(v => v.priority === 3).length,
      medium: visits.filter(v => v.priority === 2).length,
      low: visits.filter(v => v.priority === 1).length,
      cities
    };
  }, [schedule]);

  // Handlers
  const handleCreateSchedule = async () => {
    if (!scheduleForm.month || !scheduleForm.year) return;

    setLoading(true);
    try {
      await onCreate?.({
        month: Number(scheduleForm.month),
        year: Number(scheduleForm.year),
        notes: scheduleForm.notes
      });
      setShowCreateWizard(false);
      setCurrentStep(1);
    } catch (error) {
      console.error("Error creating schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVisit = async () => {
    if (!schedule || !visitForm.client_id || !visitForm.planned_date) return;

    setLoading(true);
    try {
      await onAddVisit?.(schedule.id, {
        client_request_id: Number(visitForm.client_id),
        planned_date: visitForm.planned_date,
        city: visitForm.city,
        priority: Number(visitForm.priority),
        notes: visitForm.notes,
        duration_hours: Number(visitForm.duration_hours)
      });

      // Reset form
      setVisitForm({
        client_id: "",
        planned_date: "",
        city: "",
        priority: 2,
        notes: "",
        duration_hours: 2
      });
      setClientSearch("");
      setQuickAddMode(false);
    } catch (error) {
      console.error("Error adding visit:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (client) => {
    setVisitForm(prev => ({
      ...prev,
      client_id: client.id,
      city: client.shipping_city || client.shipping_province || ""
    }));
    setClientSearch(client.commercial_name || client.nombre || client.name || `Cliente ${client.id}`);
  };

  const handleQuickAdd = () => {
    setQuickAddMode(true);
    setVisitForm(prev => ({
      ...prev,
      planned_date: new Date().toISOString().split('T')[0] // Hoy por defecto
    }));
  };

  // Componentes del wizard
  const WizardStep = ({ number, title, description, isActive, isCompleted }) => (
    <div className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
      isActive ? 'bg-indigo-50 border-2 border-indigo-200' :
      isCompleted ? 'bg-green-50 border-2 border-green-200' :
      'bg-gray-50 border-2 border-gray-200'
    }`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
        isActive ? 'bg-indigo-600 text-white' :
        isCompleted ? 'bg-green-600 text-white' :
        'bg-gray-400 text-white'
      }`}>
        {isCompleted ? <FiCheckCircle size={20} /> : number}
      </div>
      <div className="flex-1">
        <h3 className={`font-semibold ${isActive ? 'text-indigo-900' : 'text-gray-900'}`}>
          {title}
        </h3>
        <p className={`text-sm ${isActive ? 'text-indigo-700' : 'text-gray-600'}`}>
          {description}
        </p>
      </div>
      {isActive && <FiChevronRight className="text-indigo-600" size={20} />}
    </div>
  );

  // Siempre mostrar lista de planificaciones primero, luego el editor cuando se selecciona una
  return (
    <div className="space-y-6">
      {/* Header con navegación */}
      <Card className="border-0 shadow-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl">
                <FiCalendar className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  {schedule ? `Editando Planificación ${schedule.month}/${schedule.year}` : 'Mis Planificaciones'}
                </h1>
                <p className="text-indigo-100 mt-1">
                  {schedule ? 'Gestiona las visitas de esta planificación' : 'Gestiona todas tus planificaciones mensuales'}
                </p>
              </div>
            </div>

            {schedule && (
              <Button
                onClick={() => onSelectSchedule?.(null)}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
                icon={FiArrowRight}
              >
                ← Volver a Lista
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Contenido condicional */}
      {schedule ? (
        /* MODO EDITOR - cuando hay un schedule seleccionado */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header con estadísticas */}
          <Card className="border-0 shadow-xl bg-gradient-to-r from-slate-700 to-slate-800 text-white">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <FiCalendar className="text-white" size={28} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">
                      Planificación {schedule.month}/{schedule.year}
                    </h1>
                    <p className="text-slate-300 mt-1">
                      {scheduleStats.total} visitas planificadas en {scheduleStats.cities} ciudades
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <ScheduleStatusBadge status={schedule.status} />
                  <Button
                    onClick={handleQuickAdd}
                    className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
                    icon={FiPlus}
                  >
                    Agregar Visita
                  </Button>
                </div>
              </div>

              {/* Estadísticas rápidas */}
              <div className="grid grid-cols-4 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{scheduleStats.total}</div>
                  <div className="text-xs text-slate-300">Total Visitas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{scheduleStats.high}</div>
                  <div className="text-xs text-slate-300">Alta Prioridad</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{scheduleStats.medium}</div>
                  <div className="text-xs text-slate-300">Media Prioridad</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{scheduleStats.low}</div>
                  <div className="text-xs text-slate-300">Baja Prioridad</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Contenido principal del editor */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Panel lateral */}
            <div className="xl:col-span-1 space-y-6">
              {/* Agregar visita rápida */}
              <AnimatePresence>
                {quickAddMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Card className="border-0 shadow-xl">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-gray-900">Agregar Nueva Visita</h3>
                          <button
                            onClick={() => setQuickAddMode(false)}
                            className="p-2 hover:bg-gray-100 rounded-xl"
                          >
                            <FiX size={16} />
                          </button>
                        </div>

                        <div className="space-y-4">
                          {/* Búsqueda de cliente */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Cliente
                            </label>
                            <div className="relative">
                              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                              <input
                                type="text"
                                placeholder="Buscar cliente..."
                                value={clientSearch}
                                onChange={(e) => setClientSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              />
                            </div>

                            {/* Resultados de búsqueda */}
                            {clientSearch && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-lg"
                              >
                                {filteredClients.length > 0 ? (
                                  filteredClients.map((client) => (
                                    <button
                                      key={client.id}
                                      onClick={() => handleClientSelect(client)}
                                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="font-medium text-gray-900">
                                        {client.commercial_name || client.nombre || client.name || `Cliente ${client.id}`}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {client.shipping_city || "Sin ciudad"} • ID: {client.id}
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-4 py-3 text-gray-500 text-sm">
                                    No se encontraron clientes
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>

                          {/* Fecha y ciudad */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Fecha
                              </label>
                              <input
                                type="date"
                                value={visitForm.planned_date}
                                onChange={(e) => setVisitForm(prev => ({ ...prev, planned_date: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Ciudad
                              </label>
                              <input
                                type="text"
                                placeholder="Ciudad"
                                value={visitForm.city}
                                onChange={(e) => setVisitForm(prev => ({ ...prev, city: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              />
                            </div>
                          </div>

                          {/* Prioridad */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Prioridad
                            </label>
                            <select
                              value={visitForm.priority}
                              onChange={(e) => setVisitForm(prev => ({ ...prev, priority: Number(e.target.value) }))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                              <option value={1}>🟢 Baja</option>
                              <option value={2}>🟡 Media</option>
                              <option value={3}>🔴 Alta</option>
                            </select>
                          </div>

                          <Button
                            onClick={handleAddVisit}
                            loading={loading}
                            className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                            icon={FiPlus}
                          >
                            Agregar Visita
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Acciones del cronograma */}
              <Card className="border-0 shadow-xl">
                <div className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Acciones</h3>
                  <div className="space-y-3">
                    <Button
                      onClick={() => onSubmit?.(schedule.id)}
                      disabled={schedule.status !== "draft" && schedule.status !== "rejected"}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                      icon={FiSend}
                    >
                      {schedule.status === "pending_approval" ? "Reenviar para Aprobación" : "Enviar para Aprobación"}
                    </Button>

                    {["draft", "rejected"].includes(schedule.status) && (
                      <Button
                        variant="danger"
                        className="w-full"
                        onClick={() => {
                          if (window.confirm("¿Eliminar este cronograma?")) {
                            onDelete?.(schedule.id);
                          }
                        }}
                        icon={FiTrash2}
                      >
                        Eliminar Cronograma
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Calendario principal */}
            <div className="xl:col-span-2">
              <Card className="border-0 shadow-xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Calendario de Visitas</h3>
                    <div className="text-sm text-gray-600">
                      Arrastra las visitas para reorganizarlas
                    </div>
                  </div>

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
            </div>
          </div>
        </motion.div>
      ) : (
        /* MODO LISTA - mostrar todas las planificaciones disponibles */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Lista de planificaciones */}
          <div className="space-y-4">
            {schedules.length === 0 ? (
              <Card className="border-0 shadow-xl">
                <div className="p-12 text-center">
                  <FiCalendar className="mx-auto text-gray-300 mb-4" size={64} />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No tienes planificaciones</h3>
                  <p className="text-gray-600 mb-6">
                    Crea tu primera planificación mensual para organizar tus rutas comerciales
                  </p>
                  <Button
                    onClick={() => setShowCreateWizard(true)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8"
                    icon={FiPlus}
                  >
                    Crear Primera Planificación
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4">
                {schedules.map((scheduleItem, index) => (
                  <motion.div
                    key={scheduleItem.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer group">
                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-100 rounded-2xl group-hover:bg-indigo-200 transition-colors">
                              <FiCalendar className="text-indigo-600" size={24} />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">
                                Planificación {scheduleItem.month}/{scheduleItem.year}
                              </h3>
                              <p className="text-gray-600 mt-1">
                                {scheduleItem.visits?.length || 0} visitas planificadas
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <ScheduleStatusBadge status={scheduleItem.status} />
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectSchedule?.(scheduleItem);
                              }}
                              className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white"
                              icon={FiEdit3}
                            >
                              Editar
                            </Button>
                          </div>
                        </div>

                        {/* Estadísticas rápidas */}
                        {scheduleItem.visits && scheduleItem.visits.length > 0 && (
                          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{scheduleItem.visits.length}</div>
                              <div className="text-xs text-gray-600">Total Visitas</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-red-600">
                                {scheduleItem.visits.filter(v => v.priority === 3).length}
                              </div>
                              <div className="text-xs text-gray-600">Alta Prioridad</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-yellow-600">
                                {scheduleItem.visits.filter(v => v.priority === 2).length}
                              </div>
                              <div className="text-xs text-gray-600">Media Prioridad</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">
                                {scheduleItem.visits.filter(v => v.priority === 1).length}
                              </div>
                              <div className="text-xs text-gray-600">Baja Prioridad</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Wizard Modal para crear nueva planificación */}
          <AnimatePresence>
            {showCreateWizard && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiCalendar size={24} />
                        <h2 className="text-xl font-bold">Crear Nueva Planificación</h2>
                      </div>
                      <button
                        onClick={() => setShowCreateWizard(false)}
                        className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                      >
                        <FiX size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8">
                    <div className="space-y-6">
                      <WizardStep
                        number={1}
                        title="Configuración Básica"
                        description="Selecciona el mes y año para tu planificación"
                        isActive={currentStep === 1}
                        isCompleted={false}
                      />

                      {currentStep === 1 && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-6"
                        >
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Mes
                              </label>
                              <select
                                value={scheduleForm.month}
                                onChange={(e) => setScheduleForm(prev => ({ ...prev, month: Number(e.target.value) }))}
                                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all text-lg"
                              >
                                {[...Array(12)].map((_, idx) => (
                                  <option key={idx + 1} value={idx + 1}>
                                    {new Date(2000, idx).toLocaleDateString('es-ES', { month: 'long' })}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Año
                              </label>
                              <input
                                type="number"
                                value={scheduleForm.year}
                                onChange={(e) => setScheduleForm(prev => ({ ...prev, year: Number(e.target.value) }))}
                                min={new Date().getFullYear()}
                                max={new Date().getFullYear() + 2}
                                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all text-lg"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                              Objetivos del Mes (Opcional)
                            </label>
                            <textarea
                              value={scheduleForm.notes}
                              onChange={(e) => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))}
                              placeholder="Describe tus objetivos comerciales para este mes..."
                              rows={3}
                              className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all resize-none"
                            />
                          </div>

                          <div className="flex justify-end gap-3 pt-6">
                            <Button
                              variant="secondary"
                              onClick={() => setShowCreateWizard(false)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={handleCreateSchedule}
                              loading={loading}
                              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8"
                              icon={FiArrowRight}
                            >
                              Crear Planificación
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

export default ScheduleEditorIntuitive;
