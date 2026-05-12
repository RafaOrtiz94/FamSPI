import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiShoppingCart, FiPackage, FiShield, FiLoader } from 'react-icons/fi';

import PublicPurchasesTab from './tabs/PublicPurchasesTab';
import PrivatePurchasesTab from './tabs/PrivatePurchasesTab';
import ErrorBoundaryTab from './components/ErrorBoundaryTab';
import { useAuth } from '../../../core/auth/AuthContext';
import logger from '../../../core/utils/logger';

const EASE_OUT = [0.23, 1, 0.32, 1];

const normalizeRoles = (user) => {
  if (!user) return [];
  const rawRoles = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? [];
  const rawScopes = user?.scope ?? user?.user?.scope ?? [];
  const rolesArray = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
  const scopesArray = Array.isArray(rawScopes) ? rawScopes : [rawScopes];
  const normalized = [...rolesArray, ...scopesArray]
    .flatMap((r) => {
      if (typeof r === 'object' && r !== null) {
        const v = r.name || r.role || r.code || r.slug || String(r);
        return String(v).split(/[,\s]+/);
      }
      return String(r || '').split(/[,\s]+/);
    })
    .map((t) => String(t || '').toLowerCase().trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const PUBLIC_ROLES  = ['comercial', 'jefe_comercial', 'gerencia', 'gerencia_general', 'acp_comercial', 'jefe_tecnico', 'jefe_servicio_tecnico', 'tecnico'];
const PRIVATE_ROLES = ['jefe_operaciones', 'jefe_logistica', 'backoffice_comercial', 'gerencia', 'comercial', 'jefe_comercial', 'acp_comercial'];

const TAB_CONFIG = {
  public:  { id: 'public',  label: 'Compras Públicas',  icon: FiShoppingCart },
  private: { id: 'private', label: 'Compras Privadas',  icon: FiPackage },
};

function WorkspaceSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="h-4 w-48 bg-slate-200 rounded-md" />
        <div className="h-3 w-72 bg-slate-100 rounded-md mt-2" />
      </div>
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex gap-2">
        <div className="h-9 w-32 bg-slate-100 rounded-xl" />
        <div className="h-9 w-32 bg-slate-100 rounded-xl" />
      </div>
      <div className="bg-slate-50 p-6 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-white border border-slate-200 rounded-2xl shadow-ambient" />
        ))}
      </div>
    </div>
  );
}

const PurchasesWorkspace = () => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const userRoles = normalizeRoles(user);

  const canAccessPublic  = userRoles.some((r) => PUBLIC_ROLES.includes(r));
  const canAccessPrivate = userRoles.some((r) => PRIVATE_ROLES.includes(r));

  const availableTabs = useMemo(() => {
    const tabs = [];
    if (canAccessPublic)  tabs.push('public');
    if (canAccessPrivate) tabs.push('private');
    return tabs;
  }, [canAccessPublic, canAccessPrivate]);

  const [activeTab, setActiveTab] = useState(() => {
    const params   = new URLSearchParams(location.search);
    const fromUrl  = params.get('tab');
    const fromStorage = localStorage.getItem('purchases_workspace_last_tab');
    return availableTabs.includes(fromUrl) ? fromUrl
      : availableTabs.includes(fromStorage) ? fromStorage
      : availableTabs[0] ?? null;
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') !== activeTab && activeTab) {
      params.set('tab', activeTab);
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
  }, [activeTab, location.pathname, location.search, navigate]);

  useEffect(() => {
    logger.info('[WORKSPACE_COMPRAS] Inicializando', { roles: userRoles, tab: activeTab });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('purchases_workspace_last_tab', tab);
  };

  if (!activeTab) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        className="min-h-[60vh] bg-slate-50 flex items-center justify-center p-8"
      >
        <div className="max-w-sm w-full text-center">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-ambient">
            <div className="p-3 bg-red-50 rounded-xl w-fit mx-auto mb-4">
              <FiShield className="text-alert-red text-2xl" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-ink-slate mb-1">Acceso Restringido</h3>
            <p className="text-sm text-warm-ash mb-5">No tiene permisos para acceder al Workspace de Compras.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-sm font-medium hover:bg-slate-700 active:scale-[0.97] transition-colors duration-150 cursor-pointer"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col min-w-0">
      {/* Header — Naval Slate, anclaje estructural */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        className="bg-naval-slate border-b border-storm-slate"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight">Workspace de Compras</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Compras públicas y privadas en un solo lugar</p>
          </div>
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide hidden sm:block">
            {userRoles.filter((r) => PUBLIC_ROLES.concat(PRIVATE_ROLES).includes(r)).join(' · ')}
          </span>
        </div>
      </motion.div>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex items-center gap-6 h-11" role="tablist" aria-label="Tipo de compra">
            {availableTabs.map((tabId, index) => {
              const cfg      = TAB_CONFIG[tabId];
              const Icon     = cfg.icon;
              const isActive = activeTab === tabId;
              return (
                <motion.button
                  key={tabId}
                  role="tab"
                  aria-selected={isActive}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, ease: EASE_OUT, duration: 0.15 }}
                  onClick={() => handleTabChange(tabId)}
                  className={`
                    relative inline-flex items-center gap-1.5 h-full text-sm font-medium
                    border-b-2 -mb-px transition-colors duration-150 cursor-pointer
                    ${isActive
                      ? 'border-action-blue text-ink-slate'
                      : 'border-transparent text-warm-ash hover:text-ink-slate'
                    }
                  `}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{cfg.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content — sub-tabs son dueños de su propio layout */}
      <div className="bg-slate-50 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <Suspense fallback={<WorkspaceSkeleton />}>
              {activeTab === 'public' && canAccessPublic && (
                <ErrorBoundaryTab tabName="Compras Públicas">
                  <PublicPurchasesTab />
                </ErrorBoundaryTab>
              )}
              {activeTab === 'private' && canAccessPrivate && (
                <ErrorBoundaryTab tabName="Compras Privadas">
                  <PrivatePurchasesTab />
                </ErrorBoundaryTab>
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PurchasesWorkspace;
