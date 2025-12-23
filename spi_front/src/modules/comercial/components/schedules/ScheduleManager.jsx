import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCalendar,
  FiPlus,
  FiEdit3,
  FiTrendingUp,
  FiTarget,
  FiUsers,
  FiMapPin,
  FiClock,
  FiCheckCircle,
  FiAlertTriangle,
  FiBarChart2,
  FiBriefcase,
  FiArrowRight,
  FiArrowLeft,
  FiX,
  FiFilter,
  FiSearch,
  FiStar,
  FiZap,
  FiDollarSign,
  FiPercent,
  FiActivity,
  FiSend,
  FiTrash2
} from "react-icons/fi";
import { fetchClients } from "../../../../core/api/clientsApi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import ScheduleCalendarView from "./ScheduleCalendarView";
import ScheduleStatusBadge from "./ScheduleStatusBadge";

/**
 * ScheduleManager - Gestor completo de planificación mensual comercial
 * Enfoque empresarial con métricas de rendimiento y eficiencia
 *
 * Características principales:
 * - Dashboard ejecutivo con KPIs comerciales
 * - Sección dedicada para crear nuevas planificaciones
 * - Editor completo para gestionar planificaciones existentes
 * - Navegación intuitiva entre secciones
 * - Métricas de impacto comercial (ROI, eficiencia, cobertura)
 */
const ScheduleManager = ({
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
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard', 'create', 'edit'
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Estados del formulario de creación
  const [scheduleForm, setScheduleForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    notes: "",
    objectives: {
      revenue_target: "",
      client_visits_goal: "",
      new_clients_target: "",
      key_products: ""
    }
  });

  // Estados del editor
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [visitForm, setVisitForm] = useState({
    client_id: "",
    planned_date: "",
    city: "",
    priority: 2,
    notes: "",
    duration_hours: 2,
    expected_revenue: "",
    products: ""
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

  // Filtrar clientes y schedules
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 10);
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
    }).slice(0, 20);
  }, [clients, clientSearch]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      const matchesSearch = searchTerm === "" ||
        `${schedule.month}/${schedule.year}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.status.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || schedule.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [schedules, searchTerm, statusFilter]);

  // KPIs empresariales calculados
  const businessMetrics = useMemo(() => {
    const totalSchedules = schedules.length;
    const activeSchedules = schedules.filter(s => s.status === 'approved').length;
    const pendingSchedules = schedules.filter(s => s.status === 'pending_approval').length;

    // Calcular visitas totales y métricas de eficiencia
    const totalVisits = schedules.reduce((acc, schedule) => {
      return acc + (schedule.visits?.length || 0);
    }, 0);

    const completedVisits = schedules.reduce((acc, schedule) => {
      return acc + (schedule.visits?.filter(v => v.status === 'completed')?.length || 0);
    }, 0);

    const efficiencyRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;

    // Cobertura geográfica
    const citiesCovered = new Set();
    schedules.forEach(schedule => {
      schedule.visits?.forEach(visit => {
        if (visit.city) citiesCovered.add(visit.city);
      });
    });

    // Métricas de prioridad
    const highPriorityVisits = schedules.reduce((acc, schedule) => {
      return acc + (schedule.visits?.filter(v => v.priority === 3)?.length || 0);
    }, 0);

    return {
      totalSchedules,
      activeSchedules,
      pendingSchedules,
      totalVisits,
      completedVisits,
      efficiencyRate,
      citiesCovered: citiesCovered.size,
      highPriorityVisits,
      avgVisitsPerSchedule: totalSchedules > 0 ? Math.round(totalVisits / totalSchedules) : 0
    };
  }, [schedules]);

  // Handlers
  const handleCreateSchedule = async () => {
    if (!scheduleForm.month || !scheduleForm.year) return;

    setLoading(true);
    try {
      await onCreate?.({
        month: Number(scheduleForm.month),
        year: Number(scheduleForm.year),
        notes: scheduleForm.notes,
        objectives: scheduleForm.objectives
      });

      // Reset form
      setScheduleForm({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        notes: "",
        objectives: {
          revenue_target: "",
          client_visits_goal: "",
          new_clients_target: "",
          key_products: ""
        }
      });

      setShowCreateWizard(false);
      setActiveView('dashboard');
    } catch (error) {
      console.error("Error creating schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setActiveView('edit');
    onSelectSchedule?.(schedule);
  };

  const handleBackToDashboard = () => {
    setSelectedSchedule(null);
    setActiveView('dashboard');
    onSelectSchedule?.(null);
  };

  const handleAddVisit = async () => {
    if (!selectedSchedule || !visitForm.client_id || !visitForm.planned_date) return;

    setLoading(true);
    try {
      await onAddVisit?.(selectedSchedule.id, {
        client_request_id: Number(visitForm.client_id),
        planned_date: visitForm.planned_date,
        city: visitForm.city,
        priority: Number(visitForm.priority),
        notes: visitForm.notes,
        duration_hours: Number(visitForm.duration_hours),
        expected_revenue: visitForm.expected_revenue,
        products: visitForm.products
      });

      // Reset form
      setVisitForm({
        client_id: "",
        planned_date: "",
        city: "",
        priority: 2,
        notes: "",
        duration_hours: 2,
        expected_revenue: "",
        products: ""
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
    setQuickAddMode(!quickAddMode);
  };

  // Componentes de navegación
  const NavigationTabs = () => (
    <div className="border-b border-slate-200 mb-8">
      <div className="flex space-x-1">
        {[
          { id: 'dashboard', label: 'Dashboard Ejecutivo', icon: FiBarChart2 },
          { id: 'create', label: 'Crear Planificación', icon: FiPlus },
          { id: 'edit', label: 'Editor de Visitas', icon: FiEdit3, disabled: !selectedSchedule }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          const isDisabled = tab.disabled;

          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && setActiveView(tab.id)}
              disabled={isDisabled}
              className={`
                flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 border-b-2
                ${isActive
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-500 -mb-px'
                  : isDisabled
                  ? 'text-slate-400 cursor-not-allowed border-transparent'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent'
                }
              `}
            >
              <Icon size={16} />
              {tab.label}
              {tab.id === 'dashboard' && businessMetrics.totalSchedules > 0 && (
                <span className="bg-indigo-100 text-indigo-600 text-xs px-2 py-0.5 rounded-full ml-1">
                  {businessMetrics.totalSchedules}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // DASHBOARD EJECUTIVO
  const renderDashboard = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* KPIs Empresariales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 border-0 shadow-xl shadow-blue-100/50 rounded-2xl bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Planificaciones Activas</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{businessMetrics.activeSchedules}</p>
              <p className="text-xs text-blue-700 mt-1">De {businessMetrics.totalSchedules} totales</p>
            </div>
            <div className="p-3 bg-blue-600 rounded-xl">
              <FiBriefcase className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6 border-0 shadow-xl shadow-green-100/50 rounded-2xl bg-gradient-to-br from-green-50 via-green-100 to-green-200 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-800 uppercase tracking-wide">Eficiencia de Visitas</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{businessMetrics.efficiencyRate}%</p>
              <p className="text-xs text-green-700 mt-1">{businessMetrics.completedVisits} de {businessMetrics.totalVisits} completadas</p>
            </div>
            <div className="p-3 bg-green-600 rounded-xl">
              <FiZap className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6 border-0 shadow-xl shadow-purple-100/50 rounded-2xl bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-purple-800 uppercase tracking-wide">Cobertura Geográfica</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">{businessMetrics.citiesCovered}</p>
              <p className="text-xs text-purple-700 mt-1">Ciudades alcanzadas</p>
            </div>
            <div className="p-3 bg-purple-600 rounded-xl">
              <FiMapPin className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6 border-0 shadow-xl shadow-orange-100/50 rounded-2xl bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-orange-800 uppercase tracking-wide">Visitas Prioritarias</p>
              <p className="text-3xl font-bold text-orange-900 mt-2">{businessMetrics.highPriorityVisits}</p>
              <p className="text-xs text-orange-700 mt-1">Alta importancia comercial</p>
            </div>
            <div className="p-3 bg-orange-600 rounded-xl">
              <FiStar className="text-white" size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* Acciones Rápidas Empresariales */}
      <Card className="p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Centro de Control Ejecutivo</h3>
            <p className="text-slate-600 mt-1">Gestione su estrategia comercial mensual</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Button
            onClick={() => setActiveView('create')}
            className="p-6 h-auto bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl shadow-lg shadow-indigo-500/25"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <FiPlus size={24} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-lg">Nueva Planificación</div>
                <div className="text-sm opacity-90">Estrategia comercial mensual</div>
              </div>
            </div>
          </Button>

          <Button
            onClick={() => setActiveView('create')}
            className="p-6 h-auto bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl shadow-lg shadow-green-500/25"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <FiTarget size={24} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-lg">Definir Objetivos</div>
                <div className="text-sm opacity-90">Metas de ventas y clientes</div>
              </div>
            </div>
          </Button>

          <Button
            onClick={() => setActiveView('edit')}
            disabled={filteredSchedules.length === 0}
            className="p-6 h-auto bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-lg shadow-purple-500/25 disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <FiEdit3 size={24} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-lg">Gestionar Visitas</div>
                <div className="text-sm opacity-90">
                  {filteredSchedules.length === 0 ? 'Sin planificaciones' : `${filteredSchedules.length} planificaciones activas`}
                </div>
              </div>
            </div>
          </Button>
        </div>
      </Card>

      {/* Lista de Planificaciones Recientes */}
      <Card className="border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900">Planificaciones Recientes</h3>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                {filteredSchedules.length} planificaciones
              </div>
              <Button
                onClick={() => setActiveView('edit')}
                variant="secondary"
                size="sm"
                disabled={filteredSchedules.length === 0}
              >
                Ver Todas
              </Button>
            </div>
          </div>

          {filteredSchedules.length === 0 ? (
            <div className="text-center py-12">
              <FiCalendar className="mx-auto text-slate-300 mb-4" size={64} />
              <h3 className="text-xl font-bold text-slate-900 mb-2">No hay planificaciones</h3>
              <p className="text-slate-600 mb-6">
                Comience creando su primera planificación mensual comercial
              </p>
              <Button
                onClick={() => setActiveView('create')}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8"
                icon={FiPlus}
              >
                Crear Primera Planificación
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredSchedules.slice(0, 3).map((schedule, index) => (
                <motion.div
                  key={schedule.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 border border-slate-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleSelectSchedule(schedule)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <FiCalendar className="text-indigo-600" size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          Planificación {schedule.month}/{schedule.year}
                        </h4>
                        <p className="text-sm text-slate-600">
                          {schedule.visits?.length || 0} visitas • {schedule.visits?.filter(v => v.priority === 3)?.length || 0} prioritarias
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ScheduleStatusBadge status={schedule.status} />
                      <FiArrowRight className="text-slate-400" size={20} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );

  // SECCIÓN DE CREACIÓN
  const renderCreateSection = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <Card className="border-0 shadow-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl">
                <FiPlus className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Crear Nueva Planificación</h1>
                <p className="text-indigo-100 mt-1">
                  Defina su estrategia comercial mensual
                </p>
              </div>
            </div>
            <Button
              onClick={handleBackToDashboard}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
              icon={FiArrowLeft}
            >
              ← Volver al Dashboard
            </Button>
          </div>
        </div>
      </Card>

      {/* Formulario de Creación */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuración Básica */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 border-0 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Configuración del Período</h3>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Mes de Planificación
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

            <div className="mt-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Notas Estratégicas (Opcional)
              </label>
              <textarea
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Describa su enfoque comercial para este mes..."
                rows={4}
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all resize-none"
              />
            </div>
          </Card>

          {/* Objetivos Empresariales */}
          <Card className="p-6 border-0 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Objetivos Empresariales</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <FiDollarSign className="inline mr-2" />
                  Meta de Ingresos ($)
                </label>
                <input
                  type="number"
                  value={scheduleForm.objectives.revenue_target}
                  onChange={(e) => setScheduleForm(prev => ({
                    ...prev,
                    objectives: { ...prev.objectives, revenue_target: e.target.value }
                  }))}
                  placeholder="15000"
                  className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-100 focus:border-green-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <FiUsers className="inline mr-2" />
                  Visitas a Clientes
                </label>
                <input
                  type="number"
                  value={scheduleForm.objectives.client_visits_goal}
                  onChange={(e) => setScheduleForm(prev => ({
                    ...prev,
                    objectives: { ...prev.objectives, client_visits_goal: e.target.value }
                  }))}
                  placeholder="25"
                  className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <FiTarget className="inline mr-2" />
                  Nuevos Clientes
                </label>
                <input
                  type="number"
                  value={scheduleForm.objectives.new_clients_target}
                  onChange={(e) => setScheduleForm(prev => ({
                    ...prev,
                    objectives: { ...prev.objectives, new_clients_target: e.target.value }
                  }))}
                  placeholder="3"
                  className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <FiBriefcase className="inline mr-2" />
                  Productos Prioritarios
                </label>
                <input
                  type="text"
                  value={scheduleForm.objectives.key_products}
                  onChange={(e) => setScheduleForm(prev => ({
                    ...prev,
                    objectives: { ...prev.objectives, key_products: e.target.value }
                  }))}
                  placeholder="Equipos de laboratorio, Reactivos..."
                  className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all"
                />
              </div>
            </div>
          </Card>

          {/* Botón de Crear */}
          <div className="flex justify-end">
            <Button
              onClick={handleCreateSchedule}
              loading={loading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-12 py-4 rounded-2xl text-lg font-semibold shadow-xl"
              icon={FiCheckCircle}
            >
              Crear Planificación Estratégica
            </Button>
          </div>
        </div>

        {/* Panel Lateral - Vista Previa */}
        <div className="space-y-6">
          <Card className="p-6 border-0 shadow-xl bg-gradient-to-br from-slate-50 to-slate-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Vista Previa</h3>

            <div className="space-y-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <FiCalendar className="text-indigo-600" size={20} />
                  <span className="font-semibold text-gray-900">
                    {new Date(scheduleForm.year, scheduleForm.month - 1).toLocaleDateString('es-ES', {
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {scheduleForm.notes || "Sin notas estratégicas"}
                </p>
              </div>

              {Object.values(scheduleForm.objectives).some(v => v) && (
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <h4 className="font-semibold text-gray-900 mb-3">Objetivos Definidos</h4>
                  <div className="space-y-2 text-sm">
                    {scheduleForm.objectives.revenue_target && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Meta de ingresos:</span>
                        <span className="font-semibold text-green-600">
                          ${scheduleForm.objectives.revenue_target}
                        </span>
                      </div>
                    )}
                    {scheduleForm.objectives.client_visits_goal && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Visitas objetivo:</span>
                        <span className="font-semibold text-blue-600">
                          {scheduleForm.objectives.client_visits_goal}
                        </span>
                      </div>
                    )}
                    {scheduleForm.objectives.new_clients_target && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Nuevos clientes:</span>
                        <span className="font-semibold text-purple-600">
                          {scheduleForm.objectives.new_clients_target}
                        </span>
                      </div>
                    )}
                    {scheduleForm.objectives.key_products && (
                      <div className="text-gray-600">
                        <span className="font-semibold">Productos foco:</span>
                        <p className="text-sm mt-1">{scheduleForm.objectives.key_products}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Consejos Empresariales */}
          <Card className="p-6 border-0 shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50">
            <h3 className="text-lg font-bold text-blue-900 mb-4">
              💡 Consejos para una Planificación Exitosa
            </h3>
            <div className="space-y-3 text-sm text-blue-800">
              <div className="flex items-start gap-3">
                <FiTarget className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
                <p>Defina metas SMART (Específicas, Medibles, Alcanzables, Relevantes, con Tiempo definido)</p>
              </div>
              <div className="flex items-start gap-3">
                <FiUsers className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
                <p>Priorice visitas a clientes estratégicos que representen mayor volumen de negocio</p>
              </div>
              <div className="flex items-start gap-3">
                <FiTrendingUp className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
                <p>Equilibre entre mantener clientes existentes y prospectar nuevos</p>
              </div>
              <div className="flex items-start gap-3">
                <FiMapPin className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
                <p>Optimice rutas geográficas para maximizar eficiencia y reducir costos</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );

  // SECCIÓN DE EDICIÓN
  const renderEditSection = () => {
    if (!selectedSchedule) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header */}
          <Card className="border-0 shadow-xl bg-gradient-to-r from-slate-700 to-slate-800 text-white">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <FiEdit3 className="text-white" size={32} />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Editor de Planificaciones</h1>
                    <p className="text-slate-300 mt-1">
                      Gestione las visitas de sus planificaciones comerciales
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleBackToDashboard}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
                  icon={FiArrowLeft}
                >
                  ← Volver al Dashboard
                </Button>
              </div>
            </div>
          </Card>

          {/* Selector de Planificaciones */}
          <Card className="border-0 shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Seleccionar Planificación</h3>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    {filteredSchedules.length} planificaciones disponibles
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar por mes, año o estado..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <FiFilter size={16} className="text-slate-500" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm min-w-48"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="draft">📝 Borradores</option>
                    <option value="pending_approval">⏳ Pendientes</option>
                    <option value="approved">✅ Aprobados</option>
                    <option value="rejected">❌ Rechazados</option>
                  </select>
                </div>
              </div>

              {/* Lista de Planificaciones */}
              {filteredSchedules.length === 0 ? (
                <div className="text-center py-12">
                  <FiCalendar className="mx-auto text-slate-300 mb-4" size={64} />
                  <h3 className="text-xl font-bold text-slate-900 mb-2">No se encontraron planificaciones</h3>
                  <p className="text-slate-600 mb-6">
                    {searchTerm || statusFilter !== 'all'
                      ? 'Ajuste los filtros de búsqueda'
                      : 'Cree su primera planificación comercial'
                    }
                  </p>
                  <Button
                    onClick={() => setActiveView('create')}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8"
                    icon={FiPlus}
                  >
                    Crear Planificación
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredSchedules.map((schedule, index) => (
                    <motion.div
                      key={schedule.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-6 border border-slate-200 rounded-xl hover:shadow-lg transition-all cursor-pointer hover:border-indigo-300"
                      onClick={() => handleSelectSchedule(schedule)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-100 rounded-2xl">
                            <FiCalendar className="text-indigo-600" size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">
                              Planificación {schedule.month}/{schedule.year}
                            </h3>
                            <p className="text-gray-600 mt-1">
                              {schedule.visits?.length || 0} visitas planificadas
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <ScheduleStatusBadge status={schedule.status} />
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {schedule.visits?.filter(v => v.priority === 3)?.length || 0} prioritarias
                            </div>
                            <div className="text-xs text-gray-500">
                              {schedule.visits?.length || 0} total
                            </div>
                          </div>
                          <FiArrowRight className="text-slate-400" size={20} />
                        </div>
                      </div>

                      {/* Estadísticas rápidas */}
                      {schedule.visits && schedule.visits.length > 0 && (
                        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{schedule.visits.length}</div>
                            <div className="text-xs text-gray-600">Total Visitas</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {schedule.visits.filter(v => v.priority === 3).length}
                            </div>
                            <div className="text-xs text-gray-600">Alta Prioridad</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">
                              {schedule.visits.filter(v => v.priority === 2).length}
                            </div>
                            <div className="text-xs text-gray-600">Media Prioridad</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {schedule.visits.filter(v => v.priority === 1).length}
                            </div>
                            <div className="text-xs text-gray-600">Baja Prioridad</div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      );
    }

    // Vista del editor completo para la planificación seleccionada
    return (
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
                    Editando: {selectedSchedule.month}/{selectedSchedule.year}
                  </h1>
                  <p className="text-slate-300 mt-1">
                    Gestione las visitas comerciales de esta planificación
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <ScheduleStatusBadge status={selectedSchedule.status} />
                <Button
                  onClick={() => setSelectedSchedule(null)}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
                  icon={FiArrowLeft}
                >
                  ← Cambiar Planificación
                </Button>
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
                <div className="text-2xl font-bold">{selectedSchedule.visits?.length || 0}</div>
                <div className="text-xs text-slate-300">Total Visitas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{selectedSchedule.visits?.filter(v => v.priority === 3)?.length || 0}</div>
                <div className="text-xs text-slate-300">Alta Prioridad</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{selectedSchedule.visits?.filter(v => v.priority === 2)?.length || 0}</div>
                <div className="text-xs text-slate-300">Media Prioridad</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{selectedSchedule.visits?.filter(v => v.priority === 1)?.length || 0}</div>
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
                        <h3 className="font-bold text-gray-900">Nueva Visita Comercial</h3>
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
                            Cliente Empresarial
                          </label>
                          <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="text"
                              placeholder="Buscar empresa cliente..."
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
                                  No se encontraron empresas
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>

                        {/* Fecha y ciudad */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Fecha de Visita
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
                              placeholder="Ubicación"
                              value={visitForm.city}
                              onChange={(e) => setVisitForm(prev => ({ ...prev, city: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        {/* Prioridad y negocio esperado */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Nivel de Prioridad
                            </label>
                            <select
                              value={visitForm.priority}
                              onChange={(e) => setVisitForm(prev => ({ ...prev, priority: Number(e.target.value) }))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                              <option value={1}>🟢 Baja - Mantenimiento</option>
                              <option value={2}>🟡 Media - Seguimiento</option>
                              <option value={3}>🔴 Alta - Cierre/Venta</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Ingreso Esperado ($)
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={visitForm.expected_revenue}
                              onChange={(e) => setVisitForm(prev => ({ ...prev, expected_revenue: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        {/* Productos y notas */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Productos/Servicios a Promocionar
                          </label>
                          <input
                            type="text"
                            placeholder="Equipos, reactivos, servicios..."
                            value={visitForm.products}
                            onChange={(e) => setVisitForm(prev => ({ ...prev, products: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Objetivos de la Visita
                          </label>
                          <textarea
                            value={visitForm.notes}
                            onChange={(e) => setVisitForm(prev => ({ ...prev, notes: e.target.value }))}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            placeholder="Presentar nuevos productos, cerrar venta pendiente, seguimiento..."
                          />
                        </div>

                        <Button
                          onClick={handleAddVisit}
                          loading={loading}
                          className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                          icon={FiPlus}
                        >
                          Programar Visita Empresarial
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Acciones de la planificación */}
            <Card className="border-0 shadow-xl">
              <div className="p-6">
                <h3 className="font-bold text-gray-900 mb-4">Acciones Empresariales</h3>
                <div className="space-y-3">
                  <Button
                    onClick={() => onSubmit?.(selectedSchedule.id)}
                    disabled={selectedSchedule.status !== "draft" && selectedSchedule.status !== "rejected"}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                    icon={FiSend}
                  >
                    {selectedSchedule.status === "pending_approval" ? "Reenviar para Aprobación" : "Enviar para Aprobación Ejecutiva"}
                  </Button>

                  {["draft", "rejected"].includes(selectedSchedule.status) && (
                    <Button
                      variant="danger"
                      className="w-full"
                      onClick={() => {
                        if (window.confirm("¿Eliminar esta planificación comercial? Esta acción no se puede deshacer.")) {
                          onDelete?.(selectedSchedule.id);
                          setSelectedSchedule(null);
                        }
                      }}
                      icon={FiTrash2}
                    >
                      Eliminar Planificación
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
                  <h3 className="text-xl font-bold text-gray-900">Calendario de Visitas Empresariales</h3>
                  <div className="text-sm text-gray-600">
                    Planifique estratégicamente sus oportunidades comerciales
                  </div>
                </div>

                <ScheduleCalendarView
                  schedule={selectedSchedule}
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
    );
  };

  // Render principal
  return (
    <div className="bg-slate-50 min-h-screen">
      <NavigationTabs />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeView === 'dashboard' && renderDashboard()}
            {activeView === 'create' && renderCreateSection()}
            {activeView === 'edit' && renderEditSection()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ScheduleManager;
