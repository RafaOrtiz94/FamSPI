import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Importar componentes de tabs
import PublicPurchasesTab from './tabs/PublicPurchasesTab';
import PrivatePurchasesTab from './tabs/PrivatePurchasesTab';
import ErrorBoundaryTab from './components/ErrorBoundaryTab';

// Importar hook de auth
import { useAuth } from '../../../core/auth/AuthContext';

// Importar logger centralizado
import logger from '../../../core/utils/logger';

// Importar iconos
import {
  FiShoppingCart,
  FiPackage,
  FiShield,
} from 'react-icons/fi';

// Helper para normalizar roles del usuario
const normalizeRoles = (user) => {
  if (!user) return [];

  const rawRoles = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? [];
  const rolesArray = Array.isArray(rawRoles) ? rawRoles : [rawRoles];

  const normalized = rolesArray.map(role => {
    if (typeof role === 'object' && role !== null) {
      const value = role.name || role.role || role.code || role.slug || String(role);
      return String(value).toLowerCase().trim();
    }
    return String(role).toLowerCase().trim();
  }).filter(Boolean);

  return normalized;
};

const PurchasesWorkspace = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Normalizar roles del usuario
  const userRoles = normalizeRoles(user);

  // Roles para tabs
  const publicRoles = [
    'comercial',
    'jefe_comercial',
    'gerencia',
    'gerencia_general',
    'acp_comercial',
    'jefe_tecnico',
    'jefe_servicio_tecnico',
    'tecnico'
  ];
  const privateRoles = ['jefe_operaciones', 'jefe_logistica', 'backoffice_comercial', 'gerencia', 'comercial', 'jefe_comercial', 'acp_comercial'];

  // Determinar qué tabs puede ver el usuario
  const canAccessPublic = userRoles.some(role => publicRoles.includes(role));
  const canAccessPrivate = userRoles.some(role => privateRoles.includes(role));

  // Construir array de tabs disponibles
  const availableTabs = useMemo(() => {
    const tabs = [];
    if (canAccessPublic) tabs.push('public');
    if (canAccessPrivate) tabs.push('private');
    return tabs;
  }, [canAccessPublic, canAccessPrivate]);

  // Configuración de tabs con diseño premium
  const tabConfig = useMemo(() => ({
    public: {
      id: 'public',
      label: 'Compras Públicas',
      icon: FiShoppingCart,
    },
    private: {
      id: 'private',
      label: 'Compras Privadas',
      icon: FiPackage,
    }
  }), []);

  // Estado para tab activo
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabFromUrl = urlParams.get('tab');
    const tabFromStorage = localStorage.getItem('purchases_workspace_last_tab');

    let initial = availableTabs.includes(tabFromUrl) ? tabFromUrl :
      availableTabs.includes(tabFromStorage) ? tabFromStorage :
        availableTabs[0];

    return initial || null;
  });

  // URL sync
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const currentUrlTab = urlParams.get('tab');

    if (currentUrlTab !== activeTab && activeTab) {
      urlParams.set('tab', activeTab);
      navigate(`${location.pathname}?${urlParams.toString()}`, { replace: true });
    }
  }, [activeTab, location.pathname, location.search, navigate]);

  // Logs detallados del flujo de compras privadas
  useEffect(() => {
    logger.info("[WORKSPACE_COMPRAS] Inicializando Workspace de Compras", {
      roles_raw: user?.roles || user?.role,
      roles_normalizados: userRoles,
      acceso_publico: canAccessPublic,
      acceso_privado: canAccessPrivate,
      tab_activa: activeTab,
      tabs_disponibles: availableTabs,
      permisos_usuario: {
        comercial: userRoles.includes('comercial'),
        jefe_comercial: userRoles.includes('jefe_comercial'),
        gerencia: userRoles.includes('gerencia'),
        jefe_operaciones: userRoles.includes('jefe_operaciones'),
        jefe_logistica: userRoles.includes('jefe_logistica'),
        backoffice_comercial: userRoles.includes('backoffice_comercial')
      }
    });

    if (canAccessPrivate) {
      logger.info("[FLUJO_COMPRAS_PRIVADAS] Usuario autorizado para acceso a compras privadas", {
        roles_usuario: userRoles,
        tabs_disponibles: availableTabs
      });
    } else {
      logger.warn("[FLUJO_COMPRAS_PRIVADAS] Usuario sin acceso a compras privadas", {
        roles_usuario: userRoles,
        requiere_roles: privateRoles
      });
    }
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('purchases_workspace_last_tab', tab);
  };

  // Si no hay tabs disponibles
  if (!activeTab) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-8"
      >
        <div className="text-center">
          <div className="p-6 bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-200">
            <div className="p-4 bg-red-100 rounded-2xl w-fit mx-auto mb-4">
              <FiShield className="text-red-600 text-3xl" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h3>
            <p className="text-slate-600 mb-6">No tiene permisos para acceder al Workspace de Compras.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg shadow-blue-500/25"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="premium-workspace">
      {/* Header compacto */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-b border-slate-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-lg font-semibold text-slate-900">Workspace de Compras</h1>
            <p className="text-xs text-slate-500">Gestiona compras públicas y privadas en un solo lugar</p>
          </div>
        </div>
      </motion.div>

      {/* Navigation Tabs compactos */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex flex-wrap gap-2 py-2">
            {availableTabs.map((tabId, index) => {
              const config = tabConfig[tabId];
              const Icon = config.icon;
              const isActive = activeTab === tabId;

              return (
                <motion.button
                  key={tabId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                  onClick={() => handleTabChange(tabId)}
                  className={`
                    inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                    ${isActive
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }
                  `}
                >
                  <Icon size={16} />
                  <span className="font-medium">{config.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
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
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PurchasesWorkspace;
