import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiClipboard,
  FiTrendingUp,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiList,
  FiBarChart2,
  FiUserPlus,
  FiCreditCard,
  FiTruck,
  FiUsers,
  FiTarget,
  FiActivity
} from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useAuth } from "../../../core/auth/useAuth";
import ACPComercialSolicitudesView from "../components/solicitudes/ACPComercialSolicitudesView";
import ComercialSolicitudesView from "../components/solicitudes/ComercialSolicitudesView";


const SolicitudesPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Determinar configuración basada en el rol
  const roleConfig = useMemo(() => {
    const roleName = (user?.role_name || user?.role || "").toLowerCase();
    const isACP = roleName.includes('acp');

    return {
      isACP,
      viewComponent: isACP ? ACPComercialSolicitudesView : ComercialSolicitudesView,
      availableActions: isACP ? [
        { id: "cliente", label: "Registrar Cliente", icon: FiUserPlus, color: "emerald", subtitle: "Clientes" },
        { id: "compra", label: "Requerimientos", icon: FiCreditCard, color: "indigo", subtitle: "Compras" },
        { id: "permisos", label: "Permisos y Vacaciones", icon: FiUsers, color: "orange", subtitle: "Talento Humano" }
      ] : [
        { id: "inspection", label: "Inspecciones Técnicas", icon: FiClipboard, color: "blue", subtitle: "Inspecciones" },
        { id: "retiro", label: "Retiros y Devoluciones", icon: FiTruck, color: "amber", subtitle: "Retiros" },
        { id: "cliente", label: "Registrar Cliente", icon: FiUserPlus, color: "emerald", subtitle: "Clientes" },
        { id: "compra", label: "Requerimientos", icon: FiCreditCard, color: "indigo", subtitle: "Compras" },
        { id: "permisos", label: "Permisos y Vacaciones", icon: FiUsers, color: "orange", subtitle: "Talento Humano" }
      ]
    };
  }, [user]);

  // Estadísticas calculadas (placeholder - en producción vendrían de API)
  const stats = useMemo(() => ({
    total: 45,
    pending: 12,
    approved: 28,
    rejected: 5
  }), []);

  // Componentes de Tabs
  const tabs = [
    { id: 'overview', label: 'Vista General', icon: FiBarChart2 },
    { id: 'my-requests', label: 'Mis Solicitudes', icon: FiList },
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
              <Card className="p-6 border-0 shadow-xl shadow-blue-100/50 rounded-2xl bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Total Solicitudes</p>
                    <p className="text-3xl font-bold text-blue-900 mt-2">{stats.total}</p>
                    <p className="text-xs text-blue-700 mt-1">Gestiones activas</p>
                  </div>
                  <div className="p-3 bg-blue-600 rounded-xl">
                    <FiClipboard className="text-white" size={24} />
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-0 shadow-xl shadow-green-100/50 rounded-2xl bg-gradient-to-br from-green-50 via-green-100 to-green-200 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-800 uppercase tracking-wide">Aprobadas</p>
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

              <Card className="p-6 border-0 shadow-xl shadow-yellow-100/50 rounded-2xl bg-gradient-to-br from-yellow-50 via-yellow-100 to-yellow-200 border-l-4 border-yellow-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-yellow-800 uppercase tracking-wide">En Proceso</p>
                    <p className="text-3xl font-bold text-yellow-900 mt-2">{stats.pending}</p>
                    <p className="text-xs text-yellow-700 mt-1">Pendientes de revisión</p>
                  </div>
                  <div className="p-3 bg-yellow-600 rounded-xl">
                    <FiClock className="text-white" size={24} />
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-0 shadow-xl shadow-red-100/50 rounded-2xl bg-gradient-to-br from-red-50 via-red-100 to-red-200 border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-800 uppercase tracking-wide">Rechazadas</p>
                    <p className="text-3xl font-bold text-red-900 mt-2">{stats.rejected}</p>
                    <p className="text-xs text-red-700 mt-1">Requieren corrección</p>
                  </div>
                  <div className="p-3 bg-red-600 rounded-xl">
                    <FiAlertTriangle className="text-white" size={24} />
                  </div>
                </div>
              </Card>
            </div>

            {/* Acciones Rápidas */}
            <Card className="p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Acciones Rápidas</h3>
                  <p className="text-slate-600 mt-1">
                    {roleConfig.isACP ? 'Operaciones disponibles para ACP Comercial' : 'Operaciones disponibles para tu rol'}
                  </p>
                </div>

              </div>

              <div className={`grid gap-4 ${roleConfig.isACP ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'}`}>
                {roleConfig.availableActions.map((action) => (
                  <Button
                    key={action.id}
                    onClick={() => setActiveTab('my-requests')}
                    className={`p-4 h-auto ${
                      action.color === 'blue' ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800' :
                      action.color === 'amber' ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800' :
                      action.color === 'emerald' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800' :
                      action.color === 'indigo' ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800' :
                      'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800'
                    } text-white rounded-xl shadow-lg`}
                  >
                    <div className="flex items-center gap-3">
                      <action.icon size={20} />
                      <div className="text-left">
                        <div className="font-semibold">{action.label}</div>
                        <div className="text-xs opacity-90">{action.subtitle}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </Card>

            {/* Actividad Reciente */}
            <Card className="p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <FiActivity className="text-slate-600" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Actividad Reciente</h3>
                  <p className="text-slate-600 mt-1">Últimas actualizaciones en tus solicitudes</p>
                </div>
              </div>

              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white rounded-lg">
                      <FiCreditCard className="text-indigo-600" size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Requerimiento de Equipos
                      </p>
                      <p className="text-sm text-slate-600">
                        Aprobado hace 2 días
                      </p>
                    </div>
                  </div>
                  <FiCheckCircle className="text-green-600" size={20} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white rounded-lg">
                      <FiUsers className="text-orange-600" size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Permiso de Vacaciones
                      </p>
                      <p className="text-sm text-slate-600">
                        En proceso de aprobación
                      </p>
                    </div>
                  </div>
                  <FiClock className="text-yellow-600" size={20} />
                </motion.div>

                {!roleConfig.isACP && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg">
                        <FiClipboard className="text-blue-600" size={16} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          Inspección Técnica
                        </p>
                        <p className="text-sm text-slate-600">
                          Programada para mañana
                        </p>
                      </div>
                    </div>
                    <FiTarget className="text-blue-600" size={20} />
                  </motion.div>
                )}
              </div>
            </Card>
          </motion.div>
        );



      case 'my-requests':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Mis Solicitudes</h2>
                  <p className="text-slate-600 mt-1">Historial completo de tus gestiones</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-slate-600">
                    {stats.total} solicitudes totales
                  </div>
                  {stats.pending > 0 && (
                    <div className="flex items-center gap-2 text-yellow-600">
                      <FiClock size={16} />
                      <span className="text-sm font-medium">{stats.pending} pendientes</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Renderizar la vista específica del rol */}
            <div className="space-y-6">
              <roleConfig.viewComponent />
            </div>
          </motion.div>
        );

      case 'analytics':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FiBarChart2 className="text-indigo-600" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Análisis y Estadísticas</h2>
                  <p className="text-slate-600 mt-1">Métricas detalladas de tu rendimiento en solicitudes</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 border-0 shadow-lg shadow-slate-100/50 rounded-2xl">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Distribución por Tipo</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700">Clientes</span>
                      <span className="text-sm font-bold text-emerald-600">15</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700">Compras</span>
                      <span className="text-sm font-bold text-indigo-600">12</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700">Permisos</span>
                      <span className="text-sm font-bold text-orange-600">8</span>
                    </div>
                    {!roleConfig.isACP && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-700">Inspecciones</span>
                          <span className="text-sm font-bold text-blue-600">6</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-700">Retiros</span>
                          <span className="text-sm font-bold text-amber-600">4</span>
                        </div>
                      </>
                    )}
                  </div>
                </Card>

                <Card className="p-6 border-0 shadow-lg shadow-slate-100/50 rounded-2xl">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Tiempo de Respuesta</h3>
                  <div className="text-center py-8">
                    <FiTrendingUp className="mx-auto text-slate-300 mb-3" size={48} />
                    <p className="text-slate-500">Funcionalidad próximamente</p>
                    <p className="text-slate-400 text-sm mt-1">Análisis de tiempos de proceso</p>
                  </div>
                </Card>
              </div>
            </Card>
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
                <FiClipboard className="text-indigo-600" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Solicitudes</h1>
                <p className="text-slate-600 mt-1">
                  {roleConfig.isACP ? 'Gestión ACP - Solicitudes y requerimientos' : 'Gestión comercial - Solicitudes y seguimiento'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{stats.total} Solicitudes</p>
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
    </div>
  );
};

export default SolicitudesPage;
