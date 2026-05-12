import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../../../../core/auth/AuthContext';
import logger from '../../../../core/utils/logger';

import OperacionesPrivatePurchases from '../../../operaciones/pages/OperacionesPrivatePurchases';
import LogisticaPrivatePurchases from '../../../logistica/pages/LogisticaPrivatePurchases';
import PrivatePurchasesPage from '../../../backoffice/pages/PrivatePurchases';
import PrivatePurchaseDeliveries from '../../../servicio/pages/PrivatePurchaseDeliveries';
import TrainingWorkflowWorkspace from '../../../servicio/components/TrainingWorkflowWorkspace';
import { getPrivatePurchaseStats } from '../../../../core/api/privatePurchasesApi';
import { FiList, FiTruck, FiTool, FiBarChart2, FiBookOpen } from 'react-icons/fi';

const EASE_OUT = [0.23, 1, 0.32, 1];

const normalizeRoles = (user) => {
  if (!user) return [];
  const rawRoles = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? user?.scope ?? [];
  const rolesArray = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
  return rolesArray.map((r) => String(r || '').toLowerCase().trim()).filter(Boolean);
};

const hasRole = (roles, token) => roles.some((r) => r === token || r.includes(token));

const StatStrip = ({ items, loading }) => (
  <div className="flex items-stretch divide-x divide-slate-200 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-ambient">
    {items.map(({ label, value }) => (
      <div key={label} className="flex-1 px-4 py-3 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-warm-ash font-medium truncate">{label}</p>
        <p className="text-xl font-semibold text-ink-slate mt-0.5 tabular-nums">
          {loading
            ? <span className="inline-block h-5 w-8 bg-slate-200 rounded-md animate-pulse" />
            : value
          }
        </p>
      </div>
    ))}
  </div>
);

const PrivatePurchasesTab = () => {
  const { user }       = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('requests');
  const [stats, setStats]               = useState({});
  const [loadingStats, setLoadingStats] = useState(false);

  const userRoles = normalizeRoles(user);

  const isJefeOperaciones = hasRole(userRoles, 'jefe_operaciones');
  const isJefeLogistica   = hasRole(userRoles, 'jefe_logistica');
  const isTechnical       = hasRole(userRoles, 'jefe_tecnico') || hasRole(userRoles, 'jefe_servicio_tecnico') || hasRole(userRoles, 'tecnico');

  const canSeeRequests = !isTechnical || isJefeOperaciones || isJefeLogistica;
  const canSeeLogistica = isJefeLogistica || isJefeOperaciones;
  const canSeeTecnica   = isTechnical || isJefeLogistica || isJefeOperaciones;

  let RequestsComponent;
  let assignedRole;
  if (isJefeOperaciones)  { RequestsComponent = OperacionesPrivatePurchases; assignedRole = 'jefe_operaciones'; }
  else if (isJefeLogistica){ RequestsComponent = LogisticaPrivatePurchases;   assignedRole = 'jefe_logistica'; }
  else                     { RequestsComponent = PrivatePurchasesPage;         assignedRole = 'backoffice_comercial'; }

  const privateSubTabs = useMemo(() => {
    const tabs = [];
    if (canSeeRequests)  tabs.push({ id: 'requests',      label: 'Solicitudes',   icon: FiList     });
    if (canSeeLogistica) tabs.push({ id: 'logistica',     label: 'Logística',     icon: FiTruck    });
    if (canSeeTecnica)   tabs.push({ id: 'tecnica',       label: 'Técnica',       icon: FiTool     });
    if (isTechnical)     tabs.push({ id: 'entrenamiento', label: 'Entrenamiento', icon: FiBookOpen });
    tabs.push({ id: 'analytics', label: 'Análisis', icon: FiBarChart2 });
    return tabs;
  }, [canSeeRequests, canSeeLogistica, canSeeTecnica, isTechnical]);

  useEffect(() => {
    if (!privateSubTabs.find((t) => t.id === activeSubTab)) {
      setActiveSubTab(privateSubTabs[0]?.id || 'requests');
    }
  }, [privateSubTabs, activeSubTab]);

  useEffect(() => {
    logger.info('[FLUJO_COMPRAS_PRIVADAS_FRONTEND] Renderizando tab', { roles: userRoles, rol: assignedRole });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      setLoadingStats(true);
      try {
        const data = await getPrivatePurchaseStats(assignedRole);
        if (!cancelled) setStats(data || {});
      } catch {
        if (!cancelled) setStats({});
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    };
    loadStats();
    return () => { cancelled = true; };
  }, [assignedRole]);

  const total       = stats?.total || 0;
  const inProgress  = Number(stats?.pending_backoffice || 0) + Number(stats?.pending_contract_approval || 0) + Number(stats?.pending_contract_client_signature || 0);
  const completed   = Number(stats?.completed || 0);
  const cancelled   = Number(stats?.cancelled || 0);

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div
            className="flex items-center gap-5 h-9 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
            role="tablist"
            aria-label="Sección de compras privadas"
          >
            {privateSubTabs.map((tab, index) => {
              const Icon     = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.14, ease: EASE_OUT }}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`
                    relative inline-flex items-center gap-1 h-full text-xs font-medium
                    whitespace-nowrap flex-shrink-0 border-b-2 -mb-px
                    transition-colors duration-150 cursor-pointer
                    ${isActive
                      ? 'border-action-blue text-ink-slate'
                      : 'border-transparent text-warm-ash hover:text-ink-slate'
                    }
                  `}
                >
                  <Icon size={12} aria-hidden="true" />
                  <span>{tab.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {activeSubTab === 'requests' && canSeeRequests && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <RequestsComponent />
            </div>
          )}

          {activeSubTab === 'logistica' && canSeeLogistica && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              {isJefeLogistica ? <LogisticaPrivatePurchases /> : <OperacionesPrivatePurchases />}
            </div>
          )}

          {activeSubTab === 'tecnica' && canSeeTecnica && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <PrivatePurchaseDeliveries />
            </div>
          )}

          {activeSubTab === 'entrenamiento' && isTechnical && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <TrainingWorkflowWorkspace />
            </div>
          )}

          {activeSubTab === 'analytics' && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-ink-slate tracking-tight">Análisis de Compras Privadas</h2>
                <p className="text-xs text-warm-ash mt-0.5">
                  Resumen por estado — rol: <span className="font-medium text-ink-slate">{assignedRole.replace(/_/g, ' ')}</span>
                </p>
              </div>
              <StatStrip
                loading={loadingStats}
                items={[
                  { label: 'Total',        value: total      },
                  { label: 'En proceso',   value: inProgress },
                  { label: 'Completadas',  value: completed  },
                  { label: 'Canceladas',   value: cancelled  },
                ]}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PrivatePurchasesTab;
