import React, { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCalendar,
  FiTrendingUp,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiPlus,
  FiFilter,
  FiSearch,
  FiRefreshCw,
  FiBarChart2,
  FiActivity,
  FiZap,
  FiEdit3
} from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import SectionCard from "../../../core/ui/components/SectionCard";
import Button from "../../../core/ui/components/Button";
import { useAuth } from "../../../core/auth/useAuth";
import useSchedules from "../hooks/useSchedules";
import api from "../../../core/api";
import SimpleScheduleManager from "../components/schedules/SimpleScheduleManager";
import ScheduleStatusBadge from "../components/schedules/ScheduleStatusBadge";
import ScheduleApprovalWidget from "../components/schedules/ScheduleApprovalWidget";
import EditWarningModal from "../components/schedules/EditWarningModal";
import ScheduleDetailModal from "../components/schedules/ScheduleDetailModal";
import Modal from "../../../core/ui/components/Modal";
import { RequestActionButton } from "../../../core/ui/components/RequestActionCards";

const PlanificacionMensual = () => {
  const { role } = useAuth();
  const isManager = ["jefe_comercial", "gerencia", "gerencia_general"].includes(role);
  const {
    schedules,
    activeSchedule,
    loadScheduleDetail,
    create,
    addVisit,
    updateVisit,
    removeVisit,
    submit,
    remove,
    loading,
    error,
  } = useSchedules({ skipLoad: false });

  // Clientes para selector en visitas
  const [clients, setClients] = useState([]);
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await api.get("/clients");
        const payload = res.data?.data ?? res.data;
        const parsedClients = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.clients)
          ? payload.clients
          : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
          ? payload
          : [];
        setClients(parsedClients);
      } catch (err) {
        console.warn("No se pudieron cargar clientes", err.message);
      }
    };
    fetchClients();
  }, []);

  // Estados principales
  const [editingLocked, setEditingLocked] = useState(false);
  const [unlockedScheduleId, setUnlockedScheduleId] = useState(null);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [scheduleToUnlock, setScheduleToUnlock] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedForDetail, setSelectedForDetail] = useState(null);

  // Estados de UI
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");

  // Estadísticas calculadas
  const stats = useMemo(() => {
    const total = schedules.length;
    const approved = schedules.filter(s => s.status === 'approved').length;
    const pending = schedules.filter(s => s.status === 'pending_approval').length;
    const rejected = schedules.filter(s => s.status === 'rejected').length;
    const drafts = schedules.filter(s => s.status === 'draft').length;

    return { total, approved, pending, rejected, drafts };
  }, [schedules]);

  useEffect(() => {
    if (!activeSchedule && schedules.length) {
      setUnlockedScheduleId(null);
      setEditingLocked(["approved"].includes(schedules[0].status));
      loadScheduleDetail(schedules[0].id);
    }
  }, [activeSchedule, schedules, loadScheduleDetail]);

  useEffect(() => {
    if (!activeSchedule) return;
    const shouldLock = activeSchedule.status === "approved" && unlockedScheduleId !== activeSchedule.id;
    setEditingLocked(shouldLock);
  }, [activeSchedule, unlockedScheduleId]);

  const handleSelectSchedule = useCallback(
    (schedule) => {
      setUnlockedScheduleId(null);
      setEditingLocked(schedule.status === "approved");
      loadScheduleDetail(schedule.id);
    },
    [loadScheduleDetail],
  );

  const handleViewDetails = useCallback(
    (schedule) => {
      setSelectedForDetail(schedule);
      setShowDetailModal(true);
      loadScheduleDetail(schedule.id);
    },
    [loadScheduleDetail]
  );

  const startEditing = useCallback(
    (schedule) => {
      setEditingLocked(false);
      setUnlockedScheduleId(schedule.status === "approved" ? schedule.id : null);
      loadScheduleDetail(schedule.id);
    },
    [loadScheduleDetail],
  );

  const handleEditSchedule = useCallback(
    (schedule) => {
      if (!schedule) return;
      if (schedule.status === "approved") {
        setScheduleToUnlock(schedule);
        setShowEditWarning(true);
        return;
      }
      startEditing(schedule);
    },
    [startEditing],
  );

  const confirmEdit = useCallback(() => {
    if (scheduleToUnlock) {
      setUnlockedScheduleId(scheduleToUnlock.id);
      startEditing(scheduleToUnlock);
    }
    setShowEditWarning(false);
    setScheduleToUnlock(null);
  }, [scheduleToUnlock, startEditing]);

  const handleManagerSelect = useCallback(
    (schedule) => {
      if (!schedule) return;
      handleSelectSchedule(schedule);
    },
    [handleSelectSchedule],
  );

  const handleManagerRequestEdit = useCallback(
    (schedule) => {
      handleEditSchedule(schedule ?? activeSchedule);
    },
    [handleEditSchedule, activeSchedule],
  );

  // Filtrar y buscar cronogramas
  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      const matchesSearch = searchTerm === "" ||
        `${schedule.month}/${schedule.year}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.status.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || schedule.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [schedules, searchTerm, statusFilter]);

  const scheduleCards = useMemo(
    () =>
      filteredSchedules.map((schedule, index) => {
        const isActive = activeSchedule?.id === schedule.id;
        const updated =
          schedule.updated_at &&
          new Date(schedule.updated_at).toLocaleDateString("es-EC", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

        const cta = (() => {
          if (["draft", "pending_approval"].includes(schedule.status)) return { label: "Editar", tone: "neutral" };
          if (schedule.status === "approved") return { label: "Modificar", tone: "blue" };
          if (schedule.status === "rejected") return { label: "Corregir y reenviar", tone: "amber" };
          return { label: "Ver detalles", tone: "ghost" };
        })();

        return (
          <motion.div
            key={schedule.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={clsx(
              "rounded-2xl border p-4 transition-all cursor-pointer",
              isActive
                ? "border-indigo-400 bg-gradient-to-br from-indigo-50/80 via-white to-indigo-50/60 shadow-lg shadow-indigo-200/60 ring-2 ring-indigo-200"
                : "border-slate-200 bg-white hover:shadow-md hover:shadow-indigo-100/50 hover:border-indigo-200"
            )}
            onClick={() => handleSelectSchedule(schedule)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FiCalendar className="text-indigo-600" size={16} />
                  <p className="text-sm font-semibold text-slate-900 tracking-tight">
                    {schedule.month}/{schedule.year}
                  </p>
                </div>
                <p className="text-xs text-slate-500">Actualizado {updated || "N/D"}</p>
              </div>
              <ScheduleStatusBadge status={schedule.status} />
            </div>

            {schedule.status === "rejected" && schedule.rejection_reason && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 rounded-xl border border-red-200 bg-red-50/80 p-3 overflow-hidden"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-800 flex items-center gap-1">
                  <FiAlertTriangle size={12} />
                  Razón de rechazo
                </p>
                <p className="text-xs text-red-700 mt-1">{schedule.rejection_reason}</p>
              </motion.div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDetails(schedule);
                }}
              >
                Ver detalles
              </Button>
              <Button
                size="sm"
                variant={cta.tone === 'neutral' ? 'primary' : cta.tone === 'blue' ? 'secondary' : 'warning'}
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditSchedule(schedule);
                }}
              >
                {cta.label}
              </Button>
            </div>
          </motion.div>
        );
      }),
    [filteredSchedules, activeSchedule?.id, handleEditSchedule, handleSelectSchedule, handleViewDetails],
  );

  if (isManager) {
    return (
      <div className="space-y-6">
        {/* Header Premium */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-8 py-6 shadow-xl shadow-slate-300/30 overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-40 h-40 opacity-10">
            <div className="w-full h-full bg-gradient-to-br from-white to-slate-600 rounded-full transform translate-x-20 -translate-y-20" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-white/10">
                <FiCheckCircle className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  Aprobaciones de Planificación
                </h1>
                <p className="text-slate-200 mt-1">
                  Revisa y aprueba las planificaciones comerciales de tu equipo
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-slate-300 mt-4">
              <span className="rounded-full bg-white/10 px-3 py-1 flex items-center gap-2">
                <FiTrendingUp size={14} />
                Control Ejecutivo
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 flex items-center gap-2">
                <FiCheckCircle size={14} />
                Aprobaciones Ágiles
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 flex items-center gap-2">
                <FiCalendar size={14} />
                Planificación Estratégica
              </span>
            </div>
          </div>
        </motion.div>

        {/* Widget de Aprobaciones */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 md:p-8 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
            <ScheduleApprovalWidget />
          </Card>
        </motion.div>
      </div>
    );
  }

  // Componentes de Tabs
  const tabs = [
    { id: 'overview', label: 'Vista General', icon: FiBarChart2 },
    { id: 'schedules', label: 'Cronogramas', icon: FiCalendar },
    { id: 'editor', label: 'Editor', icon: FiEdit3 },
    { id: 'analytics', label: 'Análisis', icon: FiActivity }
  ];

  // Contenido de cada tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* KPIs Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card
                className="p-6 md:p-8 border-0 shadow-xl shadow-blue-100/50 rounded-2xl bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 border-l-4 border-blue-500"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Total Cronogramas</p>
                    <p className="text-3xl font-bold text-blue-900 mt-2">{stats.total}</p>
                    <p className="text-xs text-blue-700 mt-1">Planificaciones activas</p>
                  </div>
                  <div className="p-3 bg-blue-600 rounded-xl">
                    <FiCalendar className="text-white" size={24} />
                  </div>
                </div>
              </Card>

              <Card
                className="p-6 md:p-8 border-0 shadow-xl shadow-green-100/50 rounded-2xl bg-gradient-to-br from-green-50 via-green-100 to-green-200 border-l-4 border-green-500"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-800 uppercase tracking-wide">Aprobados</p>
                    <p className="text-3xl font-bold text-green-900 mt-2">{stats.approved}</p>
                    <p className="text-xs text-green-700 mt-1">
                      {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}% de éxito
                    </p>
                  </div>
                  <div className="p-3 bg-green-600 rounded-xl">
                    <FiCheckCircle className="text-white" size={24} />
                  </div>
                </div>
              </Card>

              <Card
                className="p-6 md:p-8 border-0 shadow-xl shadow-yellow-100/50 rounded-2xl bg-gradient-to-br from-yellow-50 via-yellow-100 to-yellow-200 border-l-4 border-yellow-500"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-yellow-800 uppercase tracking-wide">En Proceso</p>
                    <p className="text-3xl font-bold text-yellow-900 mt-2">{stats.pending + stats.drafts}</p>
                    <p className="text-xs text-yellow-700 mt-1">Pendientes de aprobación</p>
                  </div>
                  <div className="p-3 bg-yellow-600 rounded-xl">
                    <FiClock className="text-white" size={24} />
                  </div>
                </div>
              </Card>

              <Card
                className="p-6 md:p-8 border-0 shadow-xl shadow-indigo-100/50 rounded-2xl bg-gradient-to-br from-indigo-50 via-indigo-100 to-indigo-200 border-l-4 border-indigo-500"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-indigo-800 uppercase tracking-wide">Eficiencia</p>
                    <p className="text-3xl font-bold text-indigo-900 mt-2">
                      {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">Tasa de aprobación</p>
                  </div>
                  <div className="p-3 bg-indigo-600 rounded-xl">
                    <FiZap className="text-white" size={24} />
                  </div>
                </div>
              </Card>
            </div>

            {/* Acciones Rápidas */}
            <Card className="p-4 md:p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Acciones Rápidas</h3>
                  <p className="text-slate-600 mt-1">Operaciones comunes para gestionar tus planificaciones</p>
                </div>
                <RequestActionButton type="CLIENT" size="sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={() => setActiveTab('schedules')}
                  className="p-4 h-auto bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl shadow-lg shadow-indigo-500/25"
                >
                  <div className="flex items-center gap-3">
                    <FiCalendar size={20} />
                    <div className="text-left">
                      <div className="font-semibold">Ver Cronogramas</div>
                      <div className="text-xs opacity-90">Gestiona tus planes</div>
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={() => setActiveTab('editor')}
                  className="p-4 h-auto bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl shadow-lg shadow-green-500/25"
                >
                  <div className="flex items-center gap-3">
                    <FiEdit3 size={20} />
                    <div className="text-left">
                      <div className="font-semibold">Crear Planificación</div>
                      <div className="text-xs opacity-90">Nueva planificación</div>
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={() => setActiveTab('analytics')}
                  className="p-4 h-auto bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-lg shadow-purple-500/25"
                >
                  <div className="flex items-center gap-3">
                    <FiActivity size={20} />
                    <div className="text-left">
                      <div className="font-semibold">Ver Análisis</div>
                      <div className="text-xs opacity-90">Estadísticas detalladas</div>
                    </div>
                  </div>
                </Button>
              </div>
            </Card>

            {/* Actividad Reciente */}
            <Card className="p-4 md:p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <FiActivity className="text-slate-600" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Actividad Reciente</h3>
                  <p className="text-slate-600 mt-1">Últimas actualizaciones en tus planificaciones</p>
                </div>
              </div>

              {filteredSchedules.slice(0, 3).length > 0 ? (
                <div className="space-y-4">
                  {filteredSchedules.slice(0, 3).map((schedule, index) => (
                    <motion.div
                      key={schedule.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => {
                        handleSelectSchedule(schedule);
                        setActiveTab('editor');
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-white rounded-lg">
                          <FiCalendar className="text-indigo-600" size={16} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            Planificación {schedule.month}/{schedule.year}
                          </p>
                          <p className="text-sm text-slate-600">
                            Actualizado {schedule.updated_at ?
                              new Date(schedule.updated_at).toLocaleDateString('es-ES') :
                              'Sin fecha'
                            }
                          </p>
                        </div>
                      </div>
                      <ScheduleStatusBadge status={schedule.status} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FiCalendar className="mx-auto text-slate-300 mb-3" size={48} />
                  <p className="text-slate-500 font-medium">No hay actividad reciente</p>
                  <p className="text-slate-400 text-sm mt-1">Crea tu primera planificación para comenzar</p>
                </div>
              )}
            </Card>
          </motion.div>
        );

      case 'schedules':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header de la sección */}
            <SectionCard variant="base" className="border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Gestión de Cronogramas</h2>
                  <p className="text-slate-600 mt-1">Administra todas tus planificaciones mensuales</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-slate-600">
                    {filteredSchedules.length} de {schedules.length} cronogramas
                  </div>
                  {loading && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600"></div>
                      <span className="text-xs">Cargando...</span>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Filtros y búsqueda */}
            <SectionCard variant="compact" className="border-0 shadow-lg shadow-slate-100/60 rounded-2xl">
              <div className="flex flex-col md:flex-row gap-4">
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
            </SectionCard>

            {/* Lista de cronogramas */}
            <div className="grid gap-4">
              {filteredSchedules.length === 0 ? (
                <SectionCard
                  variant="roomy"
                  className="border-0 shadow-xl shadow-slate-100/60 rounded-2xl"
                >
                  <div className="text-center">
                    <FiCalendar className="mx-auto text-slate-300 mb-4" size={64} />
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No se encontraron cronogramas</h3>
                    <p className="text-slate-600 mb-6">
                      {searchTerm || statusFilter !== 'all'
                        ? 'Intenta ajustar los filtros de búsqueda'
                        : 'Crea tu primera planificación mensual para comenzar'
                      }
                    </p>
                    <Button
                      onClick={() => setActiveTab('editor')}
                      className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white"
                      icon={FiPlus}
                    >
                      Crear Primera Planificación
                    </Button>
                  </div>
                </SectionCard>
              ) : (
                <div className="grid gap-4">
                  {scheduleCards}
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'editor':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <SectionCard variant="base" className="border-0 shadow-xl shadow-slate-100/60 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Editor de Planificación</h2>
                    <p className="text-slate-200 text-sm mt-1">
                      {activeSchedule
                        ? `Editando planificación ${activeSchedule.month}/${activeSchedule.year}`
                        : 'Crea o edita una planificación mensual'
                      }
                    </p>
                  </div>
                  {activeSchedule && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-300">
                        {activeSchedule.month}/{activeSchedule.year}
                      </span>
                      <ScheduleStatusBadge status={activeSchedule.status} />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-0">
                <SimpleScheduleManager
                  schedules={schedules}
                  onCreate={create}
                  onAddVisit={addVisit}
                  onUpdateVisit={updateVisit}
                  onRemoveVisit={removeVisit}
                  onSubmit={submit}
                  onDelete={remove}
                  editingLocked={editingLocked}
                  onRequestEdit={handleManagerRequestEdit}
                  onSelectSchedule={handleManagerSelect}
                  activeSchedule={activeSchedule}
                  clients={clients}
                />
              </div>
            </SectionCard>
          </motion.div>
        );

      case 'analytics':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <SectionCard variant="roomy" className="border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FiBarChart2 className="text-indigo-600" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Análisis y Estadísticas</h2>
                  <p className="text-slate-600 mt-1">Métricas detalladas de tu rendimiento comercial</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard variant="roomy" className="border-0 shadow-lg shadow-slate-100/50 rounded-2xl">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Distribución por Estado</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700">Aprobados</span>
                      <span className="text-sm font-bold text-green-600">{stats.approved}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700">Pendientes</span>
                      <span className="text-sm font-bold text-yellow-600">{stats.pending}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700">Borradores</span>
                      <span className="text-sm font-bold text-slate-600">{stats.drafts}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700">Rechazados</span>
                      <span className="text-sm font-bold text-red-600">{stats.rejected}</span>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard variant="roomy" className="border-0 shadow-lg shadow-slate-100/50 rounded-2xl">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Eficiencia por Mes</h3>
                  <div className="text-center py-8">
                    <FiTrendingUp className="mx-auto text-slate-300 mb-3" size={48} />
                    <p className="text-slate-500">Funcionalidad próximamente</p>
                    <p className="text-slate-400 text-sm mt-1">Análisis detallado por periodos</p>
                  </div>
                </SectionCard>
              </div>
            </SectionCard>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-50">
      {/* Header Principal */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-b border-slate-200 rounded-t-3xl"
      >
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <FiCalendar className="text-indigo-600" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Planificación Mensual</h1>
                <p className="text-slate-600 mt-1">Gestión inteligente de rutas comerciales</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <RequestActionButton type="CLIENT" size="sm" />
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{stats.total} Planificaciones</p>
                <p className="text-xs text-slate-600">
                  {stats.approved} aprobadas • {stats.pending} pendientes
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-slate-100">
            <div className="flex space-x-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 border-b-2
                      ${isActive
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-500 -mb-px'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent'
                      }
                    `}
                  >
                    <Icon size={16} />
                    {tab.label}
                    {tab.id === 'overview' && stats.total > 0 && (
                      <span className="bg-indigo-100 text-indigo-600 text-xs px-2 py-0.5 rounded-full ml-1">
                        {stats.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Contenido Principal */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3"
          >
            <FiAlertTriangle className="text-red-500" size={20} />
            <span>{error}</span>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      <EditWarningModal open={showEditWarning} onClose={() => setShowEditWarning(false)} onConfirm={confirmEdit} />

      <Modal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalle de Planificación"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <FiRefreshCw className="animate-spin mb-4" size={32} />
            <p className="text-sm font-medium">Cargando detalles del cronograma...</p>
          </div>
        ) : activeSchedule && activeSchedule.id === selectedForDetail?.id ? (
          <ScheduleDetailModal
            schedule={activeSchedule}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-slate-300">
            <FiCalendar size={48} className="mb-2" />
            <p>Cargando datos...</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PlanificacionMensual;
