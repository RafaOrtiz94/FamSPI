import React, { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiClipboard,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiList,
  FiBarChart2,
  FiCreditCard,
  FiUsers,
  FiActivity,
  FiShoppingCart,
  FiBriefcase,
  FiTarget,
  FiTrendingUp
} from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import { useAuth } from "../../../core/auth/useAuth";
import { useRequestModals } from "../../../core/hooks/useRequestModals";
import ACPComercialSolicitudesView from "../components/solicitudes/ACPComercialSolicitudesView";
import ComercialSolicitudesView from "../components/solicitudes/ComercialSolicitudesView";
import UserRequestsView from "../components/solicitudes/UserRequestsView";
import {
  MaintenanceRequestModal,
  PrivatePurchaseRequestModal,
  PublicPurchaseRequestModal,
  EquipmentRequestModal,
  BusinessCaseRequestModal
} from "../../../core/ui/components/RequestModals";
import CreateRequestModal from "../components/CreateRequestModal";
import PermisoVacacionModal from "../../shared/solicitudes/modals/PermisoVacacionModal";

// Importar configuraciones centralizadas
import { REQUEST_TYPES_CONFIG } from '../config/requestConfig';
import StatsCard from '../components/shared/StatsCard';


const SolicitudesPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Hook para manejar modales
  const {
    privatePurchaseModalOpen,
    businessCaseModalOpen,
    maintenanceModalOpen,
    equipmentModalOpen,
    openModal,
    closeModal
  } = useRequestModals();

  // Estados para modales de creación de solicitudes comerciales
  const [createInspectionModalOpen, setCreateInspectionModalOpen] = useState(false);
  const [createRetiroModalOpen, setCreateRetiroModalOpen] = useState(false);
  const [purchaseTypeSelectionModalOpen, setPurchaseTypeSelectionModalOpen] = useState(false);
  const [publicPurchaseModalOpen, setPublicPurchaseModalOpen] = useState(false);
  const [createCompraModalOpen, setCreateCompraModalOpen] = useState(false);
  const [createClienteModalOpen, setCreateClienteModalOpen] = useState(false);
  const [permisosModalOpen, setPermisosModalOpen] = useState(false);

  // Determinar configuración basada en el rol
  const roleConfig = useMemo(() => {
    const roleName = (user?.role_name || user?.role || "").toLowerCase();
    const isACP = roleName.includes('acp');

    const baseActions = ["cliente", "compra", "permisos"];
    const acpActions = ["cliente", "compra", "permisos"];
    const fullActions = ["inspection", "retiro", ...baseActions];

    const availableActionIds = isACP ? acpActions : fullActions;

    return {
      isACP,
      viewComponent: isACP ? ACPComercialSolicitudesView : ComercialSolicitudesView,
      availableActions: availableActionIds.map(id => REQUEST_TYPES_CONFIG[id]).filter(Boolean)
    };
  }, [user]);

  // Estadísticas calculadas (placeholder - en producción vendrían de API)
  const stats = useMemo(() => ({
    total: 45,
    pending: 12,
    approved: 28,
    rejected: 5
  }), []);

  // Función para manejar acciones rápidas
  const handleQuickAction = useCallback((actionId) => {
    switch (actionId) {
      case 'cliente':
        setCreateClienteModalOpen(true);
        break;
      case 'compra':
        setPurchaseTypeSelectionModalOpen(true);
        break;
      case 'permisos':
        setPermisosModalOpen(true);
        break;
      case 'inspection':
        setCreateInspectionModalOpen(true);
        break;
      case 'retiro':
        setCreateRetiroModalOpen(true);
        break;
      default:
        console.warn(`Acción rápida no reconocida: ${actionId}`);
    }
  }, []);

  // Función para manejar selección de tipo de compra
  const handlePurchaseTypeSelection = useCallback((type) => {
    setPurchaseTypeSelectionModalOpen(false);
    if (type === 'public') {
      // Abrir modal de creación de solicitud de compra pública
      setPublicPurchaseModalOpen(true);
    } else if (type === 'private') {
      // Abrir modal de compra privada
      openModal('PRIVATE_PURCHASE');
    }
  }, [openModal]);

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
            {/* KPIs Principales - Componente Reutilizable */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Total Solicitudes"
                value={stats.total}
                subtitle="Gestiones activas"
                icon={FiClipboard}
                colors="from-blue-50 via-blue-100 to-blue-200"
                borderColor="border-blue-500"
                shadowColor="shadow-blue-100/50"
                iconBg="bg-blue-600"
                textColor="text-blue-800"
                valueColor="text-blue-900"
              />
              <StatsCard
                title="Aprobadas"
                value={stats.approved}
                subtitle={`${stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}% de éxito`}
                icon={FiCheckCircle}
                colors="from-green-50 via-green-100 to-green-200"
                borderColor="border-green-500"
                shadowColor="shadow-green-100/50"
                iconBg="bg-green-600"
                textColor="text-green-800"
                valueColor="text-green-900"
              />
              <StatsCard
                title="En Proceso"
                value={stats.pending}
                subtitle="Pendientes de revisión"
                icon={FiClock}
                colors="from-yellow-50 via-yellow-100 to-yellow-200"
                borderColor="border-yellow-500"
                shadowColor="shadow-yellow-100/50"
                iconBg="bg-yellow-600"
                textColor="text-yellow-800"
                valueColor="text-yellow-900"
              />
              <StatsCard
                title="Rechazadas"
                value={stats.rejected}
                subtitle="Requieren corrección"
                icon={FiAlertTriangle}
                colors="from-red-50 via-red-100 to-red-200"
                borderColor="border-red-500"
                shadowColor="shadow-red-100/50"
                iconBg="bg-red-600"
                textColor="text-red-800"
                valueColor="text-red-900"
              />
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
                    onClick={() => handleQuickAction(action.id)}
                    className={`p-3 h-14 ${action.color === 'blue' ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800' :
                        action.color === 'amber' ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800' :
                          action.color === 'emerald' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800' :
                            action.color === 'indigo' ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800' :
                              'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800'
                      } text-white rounded-xl shadow-md`}
                  >
                    <div className="flex items-center gap-3">
                      <action.icon size={16} />
                      <div className="text-left">
                        <div className="font-semibold">{action.label}</div>
                        <div className="text-xs opacity-90">{action.subtitle}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </Card>

            {/* Vista Específica del Rol */}
            <div className="mt-8">
              <roleConfig.viewComponent />
            </div>

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
            <UserRequestsView onCreateNew={handleQuickAction} />
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

      {/* Modales */}
      <PermisoVacacionModal
        open={permisosModalOpen}
        onClose={() => setPermisosModalOpen(false)}
        onSuccess={() => {
          setPermisosModalOpen(false);
          // Aquí podríamos recargar datos si fuera necesario
        }}
      />

      <CreateRequestModal
        open={createClienteModalOpen}
        onClose={() => setCreateClienteModalOpen(false)}
        onSubmit={async (data) => {
          console.log('Crear cliente:', data);
          setCreateClienteModalOpen(false);
        }}
        presetType="cliente"
      />

      <CreateRequestModal
        open={createCompraModalOpen}
        onClose={() => setCreateCompraModalOpen(false)}
        onSubmit={async (data) => {
          console.log('Crear compra:', data);
          setCreateCompraModalOpen(false);
        }}
        presetType="compra"
      />

      <CreateRequestModal
        open={createInspectionModalOpen}
        onClose={() => setCreateInspectionModalOpen(false)}
        onSubmit={async (data) => {
          console.log('Crear inspección:', data);
          setCreateInspectionModalOpen(false);
        }}
        presetType="inspection"
      />

      <CreateRequestModal
        open={createRetiroModalOpen}
        onClose={() => setCreateRetiroModalOpen(false)}
        onSubmit={async (data) => {
          console.log('Crear retiro:', data);
          setCreateRetiroModalOpen(false);
        }}
        presetType="retiro"
      />

      {/* ✅ MODALES GLOBALES DETALLADOS */}
      <PrivatePurchaseRequestModal
        isOpen={privatePurchaseModalOpen}
        onClose={() => closeModal('PRIVATE_PURCHASE')}
      />

      <BusinessCaseRequestModal
        isOpen={businessCaseModalOpen}
        onClose={() => closeModal('BUSINESS_CASE')}
      />

      <EquipmentRequestModal
        isOpen={equipmentModalOpen}
        onClose={() => closeModal('EQUIPMENT')}
      />

      <MaintenanceRequestModal
        isOpen={maintenanceModalOpen}
        onClose={() => closeModal('MAINTENANCE')}
      />

      {/* Modal de selección de tipo de compra */}
      <Modal
        isOpen={purchaseTypeSelectionModalOpen}
        onClose={() => setPurchaseTypeSelectionModalOpen(false)}
        title="Seleccionar Tipo de Compra"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 text-center">
            ¿Qué tipo de requerimiento de compra deseas crear?
          </p>

          <div className="grid grid-cols-1 gap-3">
            {/* Opción Compra Pública */}
            <button
              onClick={() => handlePurchaseTypeSelection('public')}
              className="p-4 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                  <FiShoppingCart className="text-emerald-600" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-900">Compra Pública</h3>
                  <p className="text-sm text-emerald-700">
                    Proceso formal vía Administración de Contratación Pública (ACP)
                  </p>
                </div>
              </div>
            </button>

            {/* Opción Compra Privada */}
            <button
              onClick={() => handlePurchaseTypeSelection('private')}
              className="p-4 border border-purple-200 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <FiBriefcase className="text-purple-600" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-purple-900">Compra Privada</h3>
                  <p className="text-sm text-purple-700">
                    Proceso directo con cliente privado y flujo interno
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              variant="secondary"
              onClick={() => setPurchaseTypeSelectionModalOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de compra pública reconstruido */}
      <PublicPurchaseRequestModal
        isOpen={publicPurchaseModalOpen}
        onClose={() => setPublicPurchaseModalOpen(false)}
        onSuccess={() => {
          setPublicPurchaseModalOpen(false);
          // Aquí podríamos recargar datos si fuera necesario
        }}
      />
    </div>
  );
};

export default SolicitudesPage;
