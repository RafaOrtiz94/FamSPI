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
  FiShoppingCart,
  FiPackage,
  FiZap,
  FiTarget,
  FiActivity
} from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { getEquipmentPurchaseStats } from "../../../core/api/equipmentPurchasesApi";
import EquipmentPurchaseWidget from "../components/EquipmentPurchaseWidget";
import { useUI } from "../../../core/ui/useUI";
import { RequestActionButton } from "../../../core/ui/components/RequestActionCards";

const STATUS_OVERVIEW = [
  { key: "waiting_provider_response", label: "Esperando respuesta de proveedor" },
  { key: "waiting_proforma", label: "Solicitando proforma" },
  { key: "proforma_received", label: "Proforma recibida" },
  { key: "waiting_signed_proforma", label: "Reservado y esperando proforma firmada" },
  { key: "pending_contract", label: "Pendiente contrato" },
  { key: "completed", label: "Completado" },
];

const HERO_LINE_KEYS = STATUS_OVERVIEW;

const ACPEquipmentPurchasesPage = () => {
  const { showToast } = useUI();
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await getEquipmentPurchaseStats();
      setStats(data);
    } catch (error) {
      console.error(error);
      showToast("No se pudo cargar el estado de las solicitudes", "error");
    } finally {
      setLoadingStats(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const totalRequests = stats?.total ?? 0;

  const heroStatusLine = useMemo(() => {
    return HERO_LINE_KEYS.map((item) => {
      const count = stats?.[item.key] ?? 0;
      return `${count} ${item.label.toLowerCase()}`;
    }).join(" · ");
  }, [stats]);

  // Componentes de Tabs
  const tabs = [
    { id: 'overview', label: 'Vista General', icon: FiBarChart2 },
    { id: 'requests', label: 'Solicitudes', icon: FiList },
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
                    <p className="text-3xl font-bold text-blue-900 mt-2">{totalRequests}</p>
                    <p className="text-xs text-blue-700 mt-1">Compras públicas activas</p>
                  </div>
                  <div className="p-3 bg-blue-600 rounded-xl">
                    <FiShoppingCart className="text-white" size={24} />
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-0 shadow-xl shadow-green-100/50 rounded-2xl bg-gradient-to-br from-green-50 via-green-100 to-green-200 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-800 uppercase tracking-wide">Completadas</p>
                    <p className="text-3xl font-bold text-green-900 mt-2">{stats?.completed ?? 0}</p>
                    <p className="text-xs text-green-700 mt-1">Solicitudes finalizadas</p>
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
                    <p className="text-3xl font-bold text-yellow-900 mt-2">
                      {(stats?.waiting_provider_response ?? 0) +
                       (stats?.waiting_proforma ?? 0) +
                       (stats?.pending_contract ?? 0)}
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">Esperando acciones</p>
                  </div>
                  <div className="p-3 bg-yellow-600 rounded-xl">
                    <FiClock className="text-white" size={24} />
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-0 shadow-xl shadow-indigo-100/50 rounded-2xl bg-gradient-to-br from-indigo-50 via-indigo-100 to-indigo-200 border-l-4 border-indigo-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-indigo-800 uppercase tracking-wide">Eficiencia</p>
                    <p className="text-3xl font-bold text-indigo-900 mt-2">
                      {totalRequests > 0 ? Math.round(((stats?.completed ?? 0) / totalRequests) * 100) : 0}%
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">Tasa de completación</p>
                  </div>
                  <div className="p-3 bg-indigo-600 rounded-xl">
                    <FiZap className="text-white" size={24} />
                  </div>
                </div>
              </Card>
            </div>

            {/* Estado Detallado */}
            <Card className="p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Estado de Solicitudes</h3>
                  <p className="text-slate-600 mt-1">Distribución detallada por estado del proceso</p>
                </div>
                <RequestActionButton type="PUBLIC_PURCHASE" size="sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {STATUS_OVERVIEW.map((item, index) => (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-600">Estado del proceso</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900">{stats?.[item.key] ?? 0}</p>
                      <p className="text-xs text-slate-500">solicitudes</p>
                    </div>
                  </motion.div>
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
                  <p className="text-slate-600 mt-1">Últimas actualizaciones en el proceso de compras</p>
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
                      <FiPackage className="text-blue-600" size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Proforma Recibida
                      </p>
                      <p className="text-sm text-slate-600">
                        Proveedor ABC envió cotización completa
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
                      <FiTarget className="text-yellow-600" size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Inspección Programada
                      </p>
                      <p className="text-sm text-slate-600">
                        Equipo técnico asignado para mañana
                      </p>
                    </div>
                  </div>
                  <FiClock className="text-yellow-600" size={20} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white rounded-lg">
                      <FiShoppingCart className="text-indigo-600" size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Contrato Firmado
                      </p>
                      <p className="text-sm text-slate-600">
                        Solicitud #123 completada exitosamente
                      </p>
                    </div>
                  </div>
                  <FiCheckCircle className="text-green-600" size={20} />
                </motion.div>
              </div>
            </Card>
          </motion.div>
        );

      case 'requests':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Solicitudes de Compras Públicas</h2>
                  <p className="text-slate-600 mt-1">Gestión completa del proceso de adquisiciones ACP</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-slate-600">
                    {totalRequests} solicitudes totales
                  </div>
                  {loadingStats && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600"></div>
                      <span className="text-xs">Actualizando...</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Lista de Solicitudes */}
            <Card className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-xl shadow-slate-200/60">
              <EquipmentPurchaseWidget showCreation={false} compactList />
            </Card>
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
                  <h2 className="text-2xl font-bold text-slate-900">Análisis de Compras Públicas</h2>
                  <p className="text-slate-600 mt-1">Métricas detalladas del rendimiento del proceso ACP</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 border-0 shadow-lg shadow-slate-100/50 rounded-2xl">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Distribución por Estado</h3>
                  <div className="space-y-3">
                    {STATUS_OVERVIEW.map((item) => (
                      <div key={item.key} className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        <span className="text-sm font-bold text-slate-900">{stats?.[item.key] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6 border-0 shadow-lg shadow-slate-100/50 rounded-2xl">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Eficiencia del Proceso</h3>
                  <div className="text-center py-8">
                    <FiTrendingUp className="mx-auto text-slate-300 mb-3" size={48} />
                    <p className="text-slate-500">Funcionalidad próximamente</p>
                    <p className="text-slate-400 text-sm mt-1">Métricas de tiempo y eficiencia</p>
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
                <FiShoppingCart className="text-indigo-600" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Compras Públicas ACP</h1>
                <p className="text-slate-600 mt-1">
                  Gestión integral del proceso de adquisiciones públicas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <RequestActionButton type="PUBLIC_PURCHASE" size="sm" />
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{totalRequests} Solicitudes</p>
                <p className="text-xs text-slate-600">
                  {stats?.completed ?? 0} completadas • {(stats?.waiting_provider_response ?? 0) + (stats?.waiting_proforma ?? 0)} pendientes
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
                    {tab.id === 'overview' && totalRequests > 0 && (
                      <span className="bg-indigo-100 text-indigo-600 text-xs px-2 py-0.5 rounded-full ml-1">
                        {totalRequests}
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

export default ACPEquipmentPurchasesPage;
