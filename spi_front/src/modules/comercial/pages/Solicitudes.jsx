import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiClipboard, FiCheckCircle, FiClock, FiAlertTriangle,
  FiList, FiBarChart2, FiActivity, FiTrendingUp,
} from "react-icons/fi";
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
import { REQUEST_TYPES_CONFIG } from '../config/requestConfig';
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";

/* Easing system — DESIGN.md §6 */
const EASE_OUT = [0.23, 1, 0.32, 1];

/* Icon bg classes per semantic color — only the icon gets the color, never the card */
const ACTION_ICON_CLASS = {
  blue:    "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-700",
  indigo:  "bg-indigo-50 text-indigo-600",
  orange:  "bg-orange-50 text-orange-700",
  teal:    "bg-teal-50 text-teal-700",
  amber:   "bg-amber-50 text-amber-700",
};

const SolicitudesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast, showLoader, hideLoader } = useUI();
  const [activeTab, setActiveTab] = useState("overview");

  const {
    privatePurchaseModalOpen,
    maintenanceModalOpen,
    equipmentModalOpen,
    openModal,
    closeModal,
  } = useRequestModals();

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

  const roleConfig = useMemo(() => {
    const roleName = (user?.role_name || user?.role || "").toLowerCase();
    const isACP = roleName.includes('acp');
    const isBackofficeCommercial = roleName === "backoffice_comercial";
    const isJefeComercial = roleName.includes("jefe_comercial") || roleName.includes("jefe comercial");

    const baseActions = ["cliente", "compra", "permisos"];
    const fullActions = ["inspection", "retiro", ...baseActions];

    let availableActionIds;
    if (isBackofficeCommercial) {
      availableActionIds = baseActions;
    } else if (isACP) {
      availableActionIds = baseActions;
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
      availableActions: availableActionIds.map(id => REQUEST_TYPES_CONFIG[id]).filter(Boolean),
    };
  }, [user]);

  const stats = useMemo(() => ({
    total: 45,
    pending: 12,
    approved: 28,
    rejected: 5,
  }), []);

  const handleQuickAction = useCallback((actionId) => {
    switch (actionId) {
      case 'cliente':    setCreateClienteModalOpen(true); break;
      case 'compra':     setPurchaseTypeSelectionModalOpen(true); break;
      case 'permisos':   setPermisosModalOpen(true); break;
      case 'personal':   setPersonnelModalOpen(true); break;
      case 'inspection': setCreateInspectionModalOpen(true); break;
      case 'retiro':     setCreateRetiroModalOpen(true); break;
      default: break;
    }
  }, []);

  const handlePurchaseTypeSelection = useCallback(async (selection) => {
    const family = selection?.purchaseFamily || selection;
    const kind = selection?.purchaseKind || null;
    const startFrom = selection?.startFrom || null;

    if (startFrom === PURCHASE_START_MODE.EXISTING_MODAL && family === PURCHASE_FAMILY.PRIVATE && kind) {
      setPrivatePurchasePreset({ initialOfferKind: kind, hideOfferKindSelector: true });
      openModal('PRIVATE_PURCHASE');
      return;
    }
    if (startFrom === PURCHASE_START_MODE.BUSINESS_CASE_PREFLOW) {
      await startPreflow({ family, kind, origin: "solicitudes" });
      return;
    }
    if (family === PURCHASE_FAMILY.PRIVATE) {
      setPrivatePurchasePreset({ initialOfferKind: PURCHASE_KIND.PRIVATE_SALE, hideOfferKindSelector: false });
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

  const tabs = [
    { id: 'overview',    label: 'Vista General',  icon: FiBarChart2 },
    { id: 'my-requests', label: 'Mis Solicitudes', icon: FiList },
    ...(roleConfig.isBackofficeCommercial ? [] : [{ id: 'analytics', label: 'Análisis', icon: FiActivity }]),
  ];

  /* Stats strip data — numbers use font-mono per Geist Mono Rule */
  const statsData = [
    { label: "Total",      value: stats.total,    sub: "Gestiones activas",      color: "text-slate-900" },
    { label: "Aprobadas",  value: stats.approved, sub: `${stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}% de éxito`, color: "text-emerald-700" },
    { label: "En proceso", value: stats.pending,  sub: "Pendientes de revisión", color: "text-amber-700" },
    { label: "Rechazadas", value: stats.rejected, sub: "Requieren corrección",   color: "text-red-600"   },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Franja de métricas — una sola superficie, no tarjetas individuales */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 divide-y sm:divide-y-0">
                {statsData.map((s, i) => (
                  <div key={i} className="px-5 py-4">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                    <p className={`text-3xl font-bold mt-1 font-mono tabular-nums tracking-tight ${s.color}`}>
                      {s.value}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Acciones rápidas */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {roleConfig.isACP ? 'Operaciones ACP' : 'Acciones rápidas'}
              </p>
              <div className={`grid gap-2 ${
                roleConfig.availableActions.length <= 3
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
              }`}>
                {roleConfig.availableActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleQuickAction(action.id)}
                    /* Press feedback — DESIGN.md §6: scale(0.97) con ease-out */
                    style={{ transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
                    className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-left hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] active:scale-[0.97] transition-[transform,box-shadow,border-color] duration-[120ms] cursor-pointer [touch-action:manipulation] focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:outline-offset-2"
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${ACTION_ICON_CLASS[action.color] || 'bg-slate-50 text-slate-600'}`}>
                      <action.icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{action.label}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{action.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Vista específica del rol */}
            {roleConfig.viewComponent && (
              <roleConfig.viewComponent />
            )}
          </div>
        );

      case 'my-requests':
        return <UserRequestsView onCreateNew={handleQuickAction} />;

      case 'analytics':
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <FiBarChart2 className="text-slate-400" size={16} />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Análisis y estadísticas</h2>
                <p className="text-xs text-slate-500">Distribución de solicitudes por categoría</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Distribución */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Por tipo</h3>
                <div className="space-y-px">
                  {[
                    { label: "Clientes",     value: 15, cls: "bg-emerald-50 text-emerald-700" },
                    { label: "Compras",      value: 12, cls: "bg-indigo-50 text-indigo-700" },
                    { label: "Permisos",     value: 8,  cls: "bg-orange-50 text-orange-700" },
                    ...(!roleConfig.isACP && !roleConfig.isBackofficeCommercial ? [
                      { label: "Inspecciones", value: 6, cls: "bg-blue-50 text-blue-700" },
                      { label: "Retiros",      value: 4, cls: "bg-amber-50 text-amber-700" },
                    ] : []),
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                      <span className="text-sm text-slate-700">{item.label}</span>
                      <span className={`text-xs font-semibold font-mono tabular-nums px-2.5 py-0.5 rounded-full ${item.cls}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tiempo de respuesta — empty state */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center gap-3 min-h-[200px]">
                <FiTrendingUp className="text-slate-200" size={36} />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">Tiempo de respuesta</p>
                  <p className="text-xs text-slate-400 mt-1">Disponible próximamente</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={WORKSPACE_PAGE_CLASS}>

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">

        {/* Título + resumen inline */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            {/* Naval Slate como ancla estructural — DESIGN.md §2 Naval Structure Rule */}
            <div className="p-2 bg-slate-800 rounded-xl shrink-0">
              <FiClipboard className="text-white" size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                Solicitudes
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {roleConfig.isACP
                  ? 'Gestión ACP, solicitudes y requerimientos'
                  : 'Gestión comercial, solicitudes y seguimiento'}
              </p>
            </div>
          </div>

          {/* Resumen numérico en mono — The Geist Mono Rule */}
          <div className="hidden sm:flex items-center gap-2 shrink-0 pt-0.5">
            <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">{stats.total}</span>
            <span className="text-xs text-slate-400">solicitudes</span>
            <span className="w-px h-3.5 bg-slate-200 mx-1" />
            <span className="text-sm font-semibold text-emerald-700 font-mono tabular-nums">{stats.approved}</span>
            <span className="text-xs text-slate-400">aprobadas</span>
            <span className="w-px h-3.5 bg-slate-200 mx-1" />
            <span className="text-sm font-semibold text-amber-700 font-mono tabular-nums">{stats.pending}</span>
            <span className="text-xs text-slate-400">en proceso</span>
          </div>
        </div>

        {/* Tab nav — underline style, Action Blue solo en activo */}
        <div className="flex mt-5 border-b border-slate-100 -mb-px gap-0 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
                }`}
              >
                <Icon size={13} />
                {tab.label}
                {tab.id === 'overview' && stats.total > 0 && (
                  <span className={`text-[10px] font-semibold font-mono tabular-nums px-1.5 py-px rounded-full ml-0.5 ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {stats.total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            /* DESIGN.md §6: ease-out fuerte, 150ms — tab switch en "decenas/día" */
            transition={{ duration: 0.15, ease: EASE_OUT }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Modales ── */}
      <PermisoVacacionModal
        open={permisosModalOpen}
        onClose={() => setPermisosModalOpen(false)}
        onSuccess={() => setPermisosModalOpen(false)}
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
            const { request_type_id, payload: rawPayload, files = [] } = data || {};
            const payload = rawPayload && typeof rawPayload === "object" ? { ...rawPayload } : {};
            if (payload.observacion && !payload.observaciones) payload.observaciones = payload.observacion;
            delete payload.observacion;
            await createRequest({ request_type_id: request_type_id || "F.ST-22", payload, files });
            showToast("Solicitud de cliente enviada correctamente", "success");
            setCreateClienteModalOpen(false);
          } catch {
            showToast("No se pudo enviar la solicitud de cliente. Verifica tu conexión.", "error");
          } finally {
            hideLoader();
          }
        }}
        presetType="cliente"
      />

      <CreateRequestModal
        open={createCompraModalOpen}
        onClose={() => setCreateCompraModalOpen(false)}
        onSubmit={async (data) => {
          try {
            showLoader();
            const { request_type_id, payload: rawPayload, files = [] } = data || {};
            const payload = rawPayload && typeof rawPayload === "object" ? { ...rawPayload } : {};
            if (payload.observacion && !payload.observaciones) payload.observaciones = payload.observacion;
            delete payload.observacion;
            await createRequest({ request_type_id: request_type_id || "F.ST-19", payload, files });
            showToast("Solicitud de compra enviada correctamente", "success");
            setCreateCompraModalOpen(false);
          } catch {
            showToast("No se pudo enviar la solicitud de compra. Verifica tu conexión.", "error");
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
            const { request_type_id, payload: rawPayload, files = [] } = data || {};
            const payload = rawPayload && typeof rawPayload === "object" ? { ...rawPayload } : {};
            if (payload.observacion && !payload.observaciones) payload.observaciones = payload.observacion;
            delete payload.observacion;
            await createRequest({ request_type_id: request_type_id || "F.ST-20", payload, files });
            showToast("Solicitud de inspección enviada correctamente", "success");
            setCreateInspectionModalOpen(false);
          } catch {
            showToast("No se pudo enviar la solicitud de inspección. Verifica tu conexión.", "error");
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
            const { request_type_id, payload: rawPayload, files = [] } = data || {};
            const payload = rawPayload && typeof rawPayload === "object" ? { ...rawPayload } : {};
            if (payload.observacion && !payload.observaciones) payload.observaciones = payload.observacion;
            delete payload.observacion;
            await createRequest({ request_type_id: request_type_id || "F.ST-21", payload, files });
            showToast("Solicitud de retiro enviada correctamente", "success");
            setCreateRetiroModalOpen(false);
          } catch {
            showToast("No se pudo enviar la solicitud de retiro. Verifica tu conexión.", "error");
          } finally {
            hideLoader();
          }
        }}
        presetType="retiro"
      />

      <PrivatePurchaseRequestModal
        isOpen={privatePurchaseModalOpen}
        initialOfferKind={privatePurchasePreset.initialOfferKind}
        hideOfferKindSelector={privatePurchasePreset.hideOfferKindSelector}
        onClose={() => {
          setPrivatePurchasePreset({ initialOfferKind: 'venta', hideOfferKindSelector: false });
          closeModal('PRIVATE_PURCHASE');
        }}
        onSuccess={() => {}}
      />

      <EquipmentRequestModal
        isOpen={equipmentModalOpen}
        onClose={() => closeModal('EQUIPMENT')}
      />

      <MaintenanceRequestModal
        isOpen={maintenanceModalOpen}
        onClose={() => closeModal('MAINTENANCE')}
      />

      <PurchaseTypeSelector
        isOpen={purchaseTypeSelectionModalOpen}
        onClose={() => setPurchaseTypeSelectionModalOpen(false)}
        origin="solicitudes"
        onSelect={handlePurchaseTypeSelection}
      />

      <NewPurchaseRequestModal
        isOpen={newPurchaseModalOpen}
        onOpenChange={setNewPurchaseModalOpen}
        mode={newPurchaseMode}
        source={newPurchaseSource}
        intent={newPurchaseIntent}
        hideButton={true}
        onSuccess={() => setNewPurchaseModalOpen(false)}
      />
    </div>
  );
};

export default SolicitudesPage;
