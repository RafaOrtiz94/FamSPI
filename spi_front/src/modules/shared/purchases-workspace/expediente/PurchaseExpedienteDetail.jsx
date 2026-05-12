import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiBriefcase, FiCheckCircle, FiGlobe, FiFileText,
  FiPackage, FiTool, FiBookOpen, FiGrid, FiClock,
  FiRefreshCw, FiAlertCircle,
} from 'react-icons/fi';

import { useAuth } from '../../../../core/auth/AuthContext';
import usePurchaseExpediente from '../hooks/usePurchaseExpediente';

import CommercialTab       from './tabs/CommercialTab';
import AvailabilityTab     from './tabs/AvailabilityTab';
import PublicAcpTab        from './tabs/PublicAcpTab';
import ContractTab         from './tabs/ContractTab';
import EquipmentLogisticsTab from './tabs/EquipmentLogisticsTab';
import TechnicalTab        from './tabs/TechnicalTab';
import TrainingTab         from './tabs/TrainingTab';
import SupplyControlTab    from './tabs/SupplyControlTab';
import ExpedienteTimelineTab from './tabs/ExpedienteTimelineTab';

const EASE_OUT = [0.23, 1, 0.32, 1];

const normalizeRoles = (user) => {
  if (!user) return [];
  const raw = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? user?.scope ?? [];
  const arr  = Array.isArray(raw) ? raw : [raw];
  return arr.flatMap((r) => String(r || '').split(/[,\s]+/)).map((t) => t.toLowerCase().trim()).filter(Boolean);
};

const OFFER_KIND_LABELS = {
  venta:                          'Venta',
  alquiler:                       'Alquiler',
  alquiler_transferencia_dominio: 'Alquiler con transferencia de dominio',
  comodato:                       'Comodato',
};

const SERIAL_STATUS_LABELS = {
  not_applicable_yet:    'No aplica aún',
  pending_reception:     'Pendiente recepción',
  received_pending_serial: 'Recibido — pendiente serial',
  serial_registered:     'Serial registrado',
};

const AVAIL_STATUS_LABELS = {
  not_checked:              'No consultado',
  internal_available_ready: 'Disponible interno',
  supplier_requested:       'Solicitado al proveedor',
  supplier_confirmed:       'Confirmado por proveedor',
  supplier_rejected:        'Rechazado por proveedor',
  alternative_required:     'Requiere alternativa',
  availability_confirmed:   'Disponibilidad confirmada',
};

const TABS_PUBLIC = [
  { id: 'comercial',    label: 'Comercial',          icon: FiBriefcase   },
  { id: 'disponibilidad', label: 'Disponibilidad',   icon: FiCheckCircle },
  { id: 'acp',          label: 'ACP / Portal',        icon: FiGlobe       },
  { id: 'contrato',     label: 'Contrato',            icon: FiFileText    },
  { id: 'logistica',    label: 'Logística Equipo',    icon: FiPackage     },
  { id: 'tecnica',      label: 'Técnica',             icon: FiTool        },
  { id: 'entrenamiento',label: 'Entrenamiento',       icon: FiBookOpen    },
  { id: 'insumos',      label: 'Control de Insumos',  icon: FiGrid        },
  { id: 'timeline',     label: 'Timeline',            icon: FiClock       },
];

const TABS_PRIVATE = TABS_PUBLIC.filter((t) => t.id !== 'acp');

function SkeletonBlock({ className = '' }) {
  return <div className={`bg-slate-200 rounded-xl animate-pulse ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <SkeletonBlock className="h-6 w-1/3" />
      <SkeletonBlock className="h-4 w-1/2" />
      <div className="space-y-3 mt-6">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-14" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="p-3 bg-red-50 rounded-2xl">
        <FiAlertCircle size={24} className="text-alert-red" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink-slate">No se pudo cargar el expediente</p>
        <p className="text-xs text-warm-ash mt-1">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-ink-slate hover:bg-slate-50 transition-colors duration-150 cursor-pointer shadow-sm"
      >
        <FiRefreshCw size={13} aria-hidden="true" />
        Reintentar
      </button>
    </div>
  );
}

const PurchaseExpedienteDetail = ({ id, type }) => {
  const { user }     = useAuth();
  const userRoles    = useMemo(() => normalizeRoles(user), [user]);
  const hasRole      = (token) => userRoles.some((r) => r === token || r.includes(token));

  const { purchase, timeline, loading, error, refresh } = usePurchaseExpediente(id, type);

  const [activeTab, setActiveTab] = useState('comercial');

  const tabs = type === 'public' ? TABS_PUBLIC : TABS_PRIVATE;

  const tabProps = { purchase, type, userRoles, hasRole, refresh };

  if (loading && !purchase) return <LoadingSkeleton />;
  if (error)                 return <ErrorState message={error} onRetry={refresh} />;
  if (!purchase)             return null;

  const offerLabel = type === 'public'
    ? 'Compra Pública'
    : (OFFER_KIND_LABELS[purchase.offer_kind] || purchase.offer_kind || '—');

  const clientName = type === 'public'
    ? (purchase.equipment?.[0]?.provider_name || purchase.provider_name || '—')
    : (purchase.client_data?.commercial_name || purchase.client_data?.legal_person_business_name || '—');

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Expediente header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-medium uppercase tracking-wider text-warm-ash">
                {type === 'public' ? 'Compra Pública' : 'Compra Privada'}
              </span>
              <span className="text-[10px] text-slate-300">·</span>
              <span className="text-[10px] font-medium text-warm-ash">{offerLabel}</span>
            </div>
            <h2 className="text-base font-semibold text-ink-slate tracking-tight mt-0.5 truncate">
              {clientName}
            </h2>
            {purchase.equipment && (
              <p className="text-xs text-warm-ash mt-0.5 truncate">
                {Array.isArray(purchase.equipment)
                  ? purchase.equipment.map((e) => e.model || e.name || e.equipment_name).filter(Boolean).join(', ')
                  : '—'}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            {purchase.serial_status && purchase.serial_status !== 'not_applicable_yet' && (
              <span className="text-[10px] font-medium text-slate-500 hidden sm:block">
                {SERIAL_STATUS_LABELS[purchase.serial_status]}
              </span>
            )}
            {purchase.availability_status && purchase.availability_status !== 'not_checked' && (
              <span className="text-[10px] font-medium text-slate-500 hidden sm:block">
                {AVAIL_STATUS_LABELS[purchase.availability_status]}
              </span>
            )}
            <button
              onClick={refresh}
              aria-label="Actualizar expediente"
              disabled={loading}
              className={`p-1.5 rounded-lg text-warm-ash hover:bg-slate-100 transition-colors duration-150 cursor-pointer ${loading ? 'opacity-40' : ''}`}
            >
              <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal tab bar */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div
          className="flex items-center gap-0 px-4 h-10 min-w-max"
          role="tablist"
          aria-label="Secciones del expediente"
        >
          {tabs.map((tab, index) => {
            const Icon     = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.14, ease: EASE_OUT }}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative inline-flex items-center gap-1.5 px-3 h-full text-[11px] font-medium
                  whitespace-nowrap flex-shrink-0 border-b-2 -mb-px
                  transition-colors duration-150 cursor-pointer
                  ${isActive
                    ? 'border-action-blue text-ink-slate'
                    : 'border-transparent text-warm-ash hover:text-ink-slate hover:border-slate-200'
                  }
                `}
              >
                <Icon size={11} aria-hidden="true" />
                <span>{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Scrollable tab content */}
      <div className="flex-1 overflow-y-auto bg-slate-50 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            className="p-5"
          >
            {activeTab === 'comercial'     && <CommercialTab         {...tabProps} />}
            {activeTab === 'disponibilidad' && <AvailabilityTab       {...tabProps} />}
            {activeTab === 'acp'           && type === 'public' && <PublicAcpTab {...tabProps} />}
            {activeTab === 'contrato'      && <ContractTab            {...tabProps} />}
            {activeTab === 'logistica'     && <EquipmentLogisticsTab  {...tabProps} />}
            {activeTab === 'tecnica'       && <TechnicalTab           {...tabProps} />}
            {activeTab === 'entrenamiento' && <TrainingTab            {...tabProps} />}
            {activeTab === 'insumos'       && <SupplyControlTab       {...tabProps} />}
            {activeTab === 'timeline'      && <ExpedienteTimelineTab  {...tabProps} timeline={timeline} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PurchaseExpedienteDetail;
