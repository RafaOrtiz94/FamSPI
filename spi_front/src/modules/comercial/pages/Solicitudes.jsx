import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useUI } from "../../../core/ui/UIContext";
import { useRequestModals } from "../../../core/hooks/useRequestModals";
import ACPComercialSolicitudesView from "../components/solicitudes/ACPComercialSolicitudesView";
import ComercialSolicitudesView from "../components/solicitudes/ComercialSolicitudesView";
import UserRequestsView from "../components/solicitudes/UserRequestsView";
import {
  MaintenanceRequestModal,
  PrivatePurchaseRequestModal,
  EquipmentRequestModal,
} from "../../../core/ui/components/RequestModals";
import CreateRequestModal from "../components/CreateRequestModal";
import PermisoVacacionModal from "../../shared/solicitudes/modals/PermisoVacacionModal";
import PersonnelRequestForm from "../../../core/ui/widgets/PersonnelRequestForm";
import { createRequest } from "../../../core/api/requestsApi";
import PurchaseTypeSelector from "../../../shared/purchases/PurchaseTypeSelector";
import NewPurchaseRequestModal from "../../../shared/purchases/NewPurchaseRequestModal";
import { usePreflowPurchaseStart } from "../../../shared/purchases/usePreflowPurchaseStart";
import { PURCHASE_FAMILY, PURCHASE_START_MODE, PURCHASE_KIND } from "../../../shared/purchases/purchaseTypes";

// Importar configuraciones centralizadas
import { REQUEST_TYPES_CONFIG } from '../config/requestConfig';
import StatsCard from '../components/shared/StatsCard';


const SolicitudesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast, showLoader, hideLoader } = useUI();
  const [activeTab, setActiveTab] = useState("overview");

  // Hook para manejar modales
  const {
    privatePurchaseModalOpen,
    maintenanceModalOpen,
    equipmentModalOpen,
    openModal,
    closeModal
  } = useRequestModals();

  // Estados para modales de creación de solicitudes comerciales
  const [createInspectionModalOpen, setCreateInspectionModalOpen] = useState(false);
  const [createRetiroModalOpen, setCreateRetiroModalOpen] = useState(false);
  const [purchaseTypeSelectionModalOpen, setPurchaseTypeSelectionModalOpen] = useState(false);
  const [newPurchaseModalOpen, setNewPurchaseModalOpen] = useState(false);
  const [newPurchaseMode, setNewPurchaseMode] = useState('acp_required');
  const [newPurchaseSource, setNewPurchaseSource] = useState('dashboard');
  const [newPurchaseIntent, setNewPurchaseIntent] = useState('provider_handoff');
  const [createCompraModalOpen, setCreateCompraModalOpen] = useState(false);
  const [createClienteModalOpen, setCreateClienteModalOpen] = useState(false);
  const [permisosModalOpen, setPermisosModalOpen] = useState(false);
  const [personnelModalOpen, setPersonnelModalOpen] = useState(false);
  const [privatePurchasePreset, setPrivatePurchasePreset] = useState({
    initialOfferKind: "venta",
    hideOfferKindSelector: false,
  });
  const { startPreflow } = usePreflowPurchaseStart({ navigate, showToast, showLoader, hideLoader });

  // Determinar configuración basada en el rol
  const roleConfig = useMemo(() => {
    const roleName = (user?.role_name || user?.role || "").toLowerCase();
    const isACP = roleName.includes('acp');
    const isBackofficeCommercial = roleName === "backoffice_comercial";
    const isJefeComercial = roleName.includes("jefe_comercial") || roleName.includes("jefe comercial");

    const baseActions = ["cliente", "compra", "permisos"];
    const acpActions = ["cliente", "compra", "permisos"];
    const backofficeCommercialActions = ["cliente", "compra", "permisos"];
    const fullActions = ["inspection", "retiro", ...baseActions];

    let availableActionIds;
    if (isBackofficeCommercial) {
      availableActionIds = backofficeCommercialActions;
    } else if (isACP) {
      availableActionIds = acpActions;
    } else if (isJefeComercial) {
      availableActionIds = [...fullActions, "personal"];
    } else {
      availableActionIds = fullActions;
    }

    return {
      isACP,
      isBackofficeCommercial,
      isJefeComercial,
      viewComponent: isBackofficeCommercial ? null : (isACP ? ACPComercialSolicitudesView : ComercialSolicitudesView),
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
      case 'personal':
        setPersonnelModalOpen(true);
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
  // Funcion para manejar seleccion de tipo de compra
  const handlePurchaseTypeSelection = useCallback(async (selection) => {
    console.log('[FLOW_COMERCIAL][FE][SOLICITUDES][PURCHASE_TYPE_SELECTED]', {
      selection,
      timestamp: new Date().toISOString()
    });

    const family = selection?.purchaseFamily || selection;
    const kind = selection?.purchaseKind || null;
    const startFrom = selection?.startFrom || null;

    if (startFrom === PURCHASE_START_MODE.EXISTING_MODAL && family === PURCHASE_FAMILY.PRIVATE && kind) {
      setPrivatePurchasePreset({
        initialOfferKind: kind,
        hideOfferKindSelector: true,
      });
      openModal('PRIVATE_PURCHASE');
      return;
    }

    if (startFrom === PURCHASE_START_MODE.BUSINESS_CASE_PREFLOW) {
      await startPreflow({ family, kind, origin: "solicitudes" });
      return;
    }

    if (family === PURCHASE_FAMILY.PRIVATE) {
      setPrivatePurchasePreset({
        initialOfferKind: PURCHASE_KIND.PRIVATE_SALE,
        hideOfferKindSelector: false,
      });
      openModal('PRIVATE_PURCHASE');
      return;
    }

    if (family === PURCHASE_FAMILY.PUBLIC) {
      setNewPurchaseMode('acp_required');
      setNewPurchaseSource('solicitudes_publicas');
      setNewPurchaseIntent('public_purchase');
      setNewPurchaseModalOpen(true);
    }
  }, [openModal, startPreflow]);

  // Componentes de Tabs - Filtrar según rol
  const tabs = [
    { id: 'overview', label: 'Vista General', icon: FiBarChart2 },
    { id: 'my-requests', label: 'Mis Solicitudes', icon: FiList },
    // Ocultar análisis/planning para usuarios backoffice_comercial
    ...(roleConfig.isBackofficeCommercial ? [] : [{ id: 'analytics', label: 'Análisis', icon: FiActivity }])
  ];

  // Contenido de cada tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 sm:space-y-6"
          >
            {/* KPIs Principales - iOS Style - Responsive */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
              <StatsCard
                title="Total Solicitudes"
                value={stats.total}
                subtitle="Gestiones activas"
                icon={FiClipboard}
                colors="from-blue-50 via-blue-100 to-blue-200"
                borderColor="border-blue-500/30"
                shadowColor="shadow-blue-100/30"
                iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
                textColor="text-blue-800"
                valueColor="text-blue-900"
                className="rounded-2xl border-0 shadow-lg text-xs sm:text-sm"
              />
              <StatsCard
                title="Aprobadas"
                value={stats.approved}
                subtitle={`${stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}% de éxito`}
                icon={FiCheckCircle}
                colors="from-green-50 via-green-100 to-green-200"
                borderColor="border-green-500/30"
                shadowColor="shadow-green-100/30"
                iconBg="bg-gradient-to-br from-green-500 to-green-600"
                textColor="text-green-800"
                valueColor="text-green-900"
                className="rounded-2xl border-0 shadow-lg text-xs sm:text-sm"
              />
              <StatsCard
                title="En Proceso"
                value={stats.pending}
                subtitle="Pendientes de revisión"
                icon={FiClock}
                colors="from-yellow-50 via-yellow-100 to-yellow-200"
                borderColor="border-yellow-500/30"
                shadowColor="shadow-yellow-100/30"
                iconBg="bg-gradient-to-br from-yellow-500 to-yellow-600"
                textColor="text-yellow-800"
                valueColor="text-yellow-900"
                className="rounded-2xl border-0 shadow-lg text-xs sm:text-sm"
              />
              <StatsCard
                title="Rechazadas"
                value={stats.rejected}
                subtitle="Requieren corrección"
                icon={FiAlertTriangle}
                colors="from-red-50 via-red-100 to-red-200"
                borderColor="border-red-500/30"
                shadowColor="shadow-red-100/30"
                iconBg="bg-gradient-to-br from-red-500 to-red-600"
                textColor="text-red-800"
                valueColor="text-red-900"
                className="rounded-2xl border-0 shadow-lg text-xs sm:text-sm"
              />
            </div>

            {/* Accesos rápidos - iOS Style */}
            <Card className="p-4 sm:p-6 border-0 shadow-lg shadow-gray-100/50 rounded-2xl bg-white">
              <div className="flex items-center justify-between mb-3 sm:mb-5">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">Accesos rápidos</h3>
                  <p className="text-gray-600 mt-1 text-[11px] sm:text-sm">
                    {roleConfig.isACP ? 'Operaciones disponibles para ACP Comercial' : 'Operaciones disponibles para tu rol'}
                  </p>
                </div>
              </div>

              <div className={`grid gap-2 sm:gap-3 ${roleConfig.isACP ? 'grid-cols-2 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                {roleConfig.availableActions.map((action) => (
                  <Button
                    key={action.id}
                    onClick={() => handleQuickAction(action.id)}
                    className={`p-3 h-12 sm:h-16 transition-all duration-200 rounded-xl border-0 shadow-sm hover:shadow-md active:scale-95 ${
                      action.color === 'blue' ? 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' :
                      action.color === 'amber' ? 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700' :
                      action.color === 'emerald' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700' :
                      action.color === 'indigo' ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700' :
                      action.color === 'teal' ? 'bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700' :
                      'bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <action.icon size={14} className="text-white" />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="font-semibold text-white text-xs sm:text-sm leading-tight truncate">{action.label}</div>
                        <div className="text-white/80 text-[10px] sm:text-xs leading-tight truncate">{action.subtitle}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </Card>

            {/* Vista Específica del Rol */}
            {roleConfig.viewComponent && (
              <div className="mt-8">
                <roleConfig.viewComponent />
              </div>
            )}

            {/* Actividad Reciente - iOS Style Unificado */}
            <Card className="p-4 sm:p-6 border-0 shadow-lg shadow-gray-100/50 rounded-2xl bg-white">
              <div className="flex items-center justify-between mb-3 sm:mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 sm:p-2 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg shadow-sm">
                    <FiActivity className="text-white" size={18} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">Actividad Reciente</h3>
                    <p className="text-gray-600 mt-1 text-[11px] sm:text-sm">Últimas actualizaciones en tus solicitudes</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200/60 hover:bg-gradient-to-br hover:from-indigo-100 hover:to-indigo-200 transition-all duration-200 cursor-pointer hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 sm:p-2 bg-white rounded-lg shadow-sm">
                      <FiCreditCard className="text-indigo-600" size={14} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                        Requerimiento de Equipos
                      </p>
                      <p className="text-[11px] sm:text-xs text-gray-600">
                        Aprobado hace 2 días
                      </p>
                    </div>
                  </div>
                  <FiCheckCircle className="text-green-600" size={16} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200/60 hover:bg-gradient-to-br hover:from-orange-100 hover:to-orange-200 transition-all duration-200 cursor-pointer hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 sm:p-2 bg-white rounded-lg shadow-sm">
                      <FiUsers className="text-orange-600" size={14} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                        Permiso de Vacaciones
                      </p>
                      <p className="text-[11px] sm:text-xs text-gray-600">
                        En proceso de aprobación
                      </p>
                    </div>
                  </div>
                  <FiClock className="text-yellow-600" size={16} />
                </motion.div>

                {!roleConfig.isACP && !roleConfig.isBackofficeCommercial && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200/60 hover:bg-gradient-to-br hover:from-blue-100 hover:to-blue-200 transition-all duration-200 cursor-pointer hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 sm:p-2 bg-white rounded-lg shadow-sm">
                        <FiClipboard className="text-blue-600" size={14} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                          Inspección Técnica
                        </p>
                        <p className="text-[11px] sm:text-xs text-gray-600">
                          Programada para mañana
                        </p>
                      </div>
                    </div>
                    <FiTarget className="text-blue-600" size={16} />
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
            <Card className="p-6 border-0 shadow-lg shadow-gray-100/50 rounded-2xl bg-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-sm">
                  <FiBarChart2 className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Análisis y Estadísticas</h2>
                  <p className="text-gray-600 mt-1 text-sm">Métricas detalladas de tu rendimiento en solicitudes</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 border-0 shadow-md shadow-gray-100/40 rounded-2xl bg-white">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Distribución por Tipo</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <span className="text-sm font-medium text-gray-700">Clientes</span>
                      <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">15</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <span className="text-sm font-medium text-gray-700">Compras</span>
                      <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">12</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <span className="text-sm font-medium text-gray-700">Permisos</span>
                      <span className="text-sm font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">8</span>
                    </div>
                    {!roleConfig.isACP && !roleConfig.isBackofficeCommercial && (
                      <>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                          <span className="text-sm font-medium text-gray-700">Inspecciones</span>
                          <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">6</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                          <span className="text-sm font-medium text-gray-700">Retiros</span>
                          <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">4</span>
                        </div>
                      </>
                    )}
                  </div>
                </Card>

                <Card className="p-6 border-0 shadow-md shadow-gray-100/40 rounded-2xl bg-white">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Tiempo de Respuesta</h3>
                  <div className="text-center py-8">
                    <FiTrendingUp className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="text-gray-500 text-sm">Funcionalidad próximamente</p>
                    <p className="text-gray-400 text-xs mt-1">Análisis de tiempos de proceso</p>
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
      {/* Header Principal - iOS Style */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-b border-gray-200/60 rounded-t-3xl shadow-sm"
      >
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                <FiClipboard className="text-white" size={22} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Solicitudes</h1>
                <p className="text-gray-600 mt-1 text-xs sm:text-sm">
                  {roleConfig.isACP ? 'Gestión ACP - Solicitudes y requerimientos' : 'Gestión comercial - Solicitudes y seguimiento'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200/60">
              <div className="text-right">
                <p className="text-xs sm:text-sm font-semibold text-gray-900">{stats.total} Solicitudes</p>
                <p className="text-[11px] sm:text-xs text-gray-600">
                  {stats.approved} aprobadas • {stats.pending} pendientes
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs - iOS Style */}
          <div className="border-b border-gray-200/60 pb-2">
            <div className="flex space-x-1 overflow-x-auto scrollbar-hide -mx-2 px-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 min-w-max
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25'
                        : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                      }
                    `}
                  >
                    <Icon size={14} className={isActive ? 'text-white' : 'text-gray-500'} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.id === 'overview' && stats.total > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-1 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'
                      }`}>
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

      {/* Contenido Principal - Responsive */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
      {personnelModalOpen && (
        <PersonnelRequestForm
          onClose={() => setPersonnelModalOpen(false)}
          onSuccess={() => setPersonnelModalOpen(false)}
        />
      )}

      <CreateRequestModal
        open={createClienteModalOpen}
        onClose={() => setCreateClienteModalOpen(false)}
        onSubmit={async (data) => {
          try {
            showLoader();
            console.log('[SOLICITUDES_PAGE][CLIENTE] Enviando:', data);

            const { files = [], ...payload } = data;
            const payloadToSend = {
              ...payload,
              observaciones: payload.observacion,
            };
            delete payloadToSend.observacion;

            const result = await createRequest({
              request_type_id: "F.ST-22",
              ...payloadToSend,
              files
            });

            console.log('[SOLICITUDES_PAGE][CLIENTE] Respuesta:', result);
            showToast("Solicitud de cliente enviada correctamente ✅", "success");
            setCreateClienteModalOpen(false);
          } catch (err) {
            console.error('[SOLICITUDES_PAGE][CLIENTE] Error:', err);
            showToast("Error al enviar solicitud de cliente", "error");
          } finally {
            hideLoader();
          }
        }}
        presetType="cliente"
      />

      <CreateRequestModal
        open={createCompraModalOpen}
        onClose={() => {
          console.log('[FLOW_COMERCIAL][FE][SOLICITUDES][MODAL_CLOSE]', {
            modalType: 'CreateRequestModal',
            presetType: 'compra',
            timestamp: new Date().toISOString()
          });
          setCreateCompraModalOpen(false);
        }}
        onSubmit={async (data) => {
          console.log('[FLOW_COMERCIAL][FE][SOLICITUDES][FORM_SUBMIT]', {
            modalType: 'CreateRequestModal',
            presetType: 'compra',
            formType: 'compra_general',
            hasData: !!data,
            timestamp: new Date().toISOString()
          });

          try {
            showLoader();
            console.log('[SOLICITUDES_PAGE][COMPRA] Enviando:', data);

            const { files = [], ...payload } = data;
            const payloadToSend = {
              ...payload,
              observaciones: payload.observacion,
            };
            delete payloadToSend.observacion;

            const result = await createRequest({
              request_type_id: "F.ST-19",
              ...payloadToSend,
              files
            });

            console.log('[SOLICITUDES_PAGE][COMPRA] Respuesta:', result);
            showToast("Solicitud de compra enviada correctamente ✅", "success");
            setCreateCompraModalOpen(false);
          } catch (err) {
            console.error('[SOLICITUDES_PAGE][COMPRA] Error:', err);
            showToast("Error al enviar solicitud de compra", "error");
          } finally {
            hideLoader();
          }
        }}
        presetType="compra"
      />

      <CreateRequestModal
        open={createInspectionModalOpen}
        onClose={() => setCreateInspectionModalOpen(false)}
        onSubmit={async (data) => {
          try {
            showLoader();
            console.log('[SOLICITUDES_PAGE][INSPECCION] Enviando:', data);

            const { files = [], ...payload } = data;
            const payloadToSend = {
              ...payload,
              observaciones: payload.observacion,
            };
            delete payloadToSend.observacion;

            // El backend espera que los campos estén directamente en el payload, no anidados
            const result = await createRequest({
              request_type_id: "F.ST-20",
              ...payloadToSend, // Desestructurar para que los campos estén en el nivel superior
              files
            });

            console.log('[SOLICITUDES_PAGE][INSPECCION] Respuesta:', result);
            showToast("Solicitud de inspección enviada correctamente ✅", "success");
            setCreateInspectionModalOpen(false);
          } catch (err) {
            console.error('[SOLICITUDES_PAGE][INSPECCION] Error:', err);
            showToast("Error al enviar solicitud de inspección", "error");
          } finally {
            hideLoader();
          }
        }}
        presetType="inspection"
      />

      <CreateRequestModal
        open={createRetiroModalOpen}
        onClose={() => setCreateRetiroModalOpen(false)}
        onSubmit={async (data) => {
          try {
            showLoader();
            console.log('[SOLICITUDES_PAGE][RETIRO] Enviando:', data);

            const { files = [], ...payload } = data;
            const payloadToSend = {
              ...payload,
              observaciones: payload.observacion,
            };
            delete payloadToSend.observacion;

            const result = await createRequest({
              request_type_id: "F.ST-21",
              ...payloadToSend,
              files
            });

            console.log('[SOLICITUDES_PAGE][RETIRO] Respuesta:', result);
            showToast("Solicitud de retiro enviada correctamente ✅", "success");
            setCreateRetiroModalOpen(false);
          } catch (err) {
            console.error('[SOLICITUDES_PAGE][RETIRO] Error:', err);
            showToast("Error al enviar solicitud de retiro", "error");
          } finally {
            hideLoader();
          }
        }}
        presetType="retiro"
      />

      {/* ✅ MODALES GLOBALES DETALLADOS */}
      <PrivatePurchaseRequestModal
        isOpen={privatePurchaseModalOpen}
        initialOfferKind={privatePurchasePreset.initialOfferKind}
        hideOfferKindSelector={privatePurchasePreset.hideOfferKindSelector}
        onClose={() => {
          console.log('[FLOW_COMERCIAL][FE][SOLICITUDES][MODAL_CLOSE]', {
            modalType: 'PrivatePurchaseRequestModal',
            timestamp: new Date().toISOString()
          });
          setPrivatePurchasePreset({
            initialOfferKind: 'venta',
            hideOfferKindSelector: false,
          });
          closeModal('PRIVATE_PURCHASE');
        }}
        onSuccess={(data) => {
          console.log('[FLOW_COMERCIAL][FE][SOLICITUDES][FORM_SUBMIT]', {
            modalType: 'PrivatePurchaseRequestModal',
            formType: 'compra_privada_proceso',
            hasData: !!data,
            timestamp: new Date().toISOString()
          });
        }}
      />
<EquipmentRequestModal
        isOpen={equipmentModalOpen}
        onClose={() => closeModal('EQUIPMENT')}
      />

      <MaintenanceRequestModal
        isOpen={maintenanceModalOpen}
        onClose={() => closeModal('MAINTENANCE')}
      />

      {/* COMPONENTE UNIFICADO PARA SELECCIÓN DE TIPO DE COMPRA */}
      <PurchaseTypeSelector
        isOpen={purchaseTypeSelectionModalOpen}
        onClose={() => setPurchaseTypeSelectionModalOpen(false)}
        origin="solicitudes"
        onSelect={handlePurchaseTypeSelection}
      />

      {/* Modal unificado de compra pública/privada */}
      <NewPurchaseRequestModal
        isOpen={newPurchaseModalOpen}
        onOpenChange={setNewPurchaseModalOpen}
        mode={newPurchaseMode}
        source={newPurchaseSource}
        intent={newPurchaseIntent}
        hideButton={true}
        onSuccess={(result) => {
          console.log('[FLOW_COMERCIAL][FE][SOLICITUDES][PURCHASE_SUCCESS]', result);
          setNewPurchaseModalOpen(false);
          // Aquí podríamos recargar datos si fuera necesario
        }}
      />
    </div>
  );
};

export default SolicitudesPage;






