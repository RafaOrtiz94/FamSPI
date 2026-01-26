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
  FiTrendingUp,
  FiShield,
  FiZap,
  FiTarget,
  FiBarChart,
  FiLayers
} from 'react-icons/fi';

// Helper para normalizar roles del usuario
const normalizeRoles = (user) => {
  if (!user) return [];

  const rawRoles = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? [];
  const rolesArray = Array.isArray(rawRoles) ? rawRoles : [rawRoles];

  const normalized = rolesArray.map(role => {
    if (typeof role === 'object' && role !== null) {
      return role.name || role.role || role.code || role.slug || String(role);
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
  const publicRoles = ['comercial', 'jefe_comercial', 'gerencia', 'gerencia_general', 'acp_comercial'];
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
      gradient: 'from-sky-500 via-blue-600 to-indigo-700',
      bgGradient: 'from-sky-50 via-blue-100 to-indigo-100',
      shadowColor: 'shadow-sky-500/25',
      description: 'Adquisiciones públicas ACP',
      features: ['Gestión integral', 'Análisis avanzado', 'Reportes detallados']
    },
    private: {
      id: 'private',
      label: 'Compras Privadas',
      icon: FiPackage,
      gradient: 'from-amber-500 via-orange-600 to-rose-600',
      bgGradient: 'from-amber-50 via-orange-100 to-rose-100',
      shadowColor: 'shadow-orange-500/25',
      description: 'Adquisiciones privadas',
      features: ['Procesos internos', 'Aprobaciones', 'Seguimiento']
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

  const activeTabConfig = tabConfig[activeTab];

  return (
    <div className="premium-workspace">
      {/* Header Premium */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="absolute inset-0 opacity-25 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:28px_28px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 md:px-8 py-14 md:py-18">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-2xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg shadow-blue-500/10">
                  <FiLayers className="text-white text-3xl" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">Centro de Compras Empresarial</h1>
                  <p className="text-lg md:text-xl text-slate-200">Plataforma unificada de adquisiciones</p>
                </div>
              </div>

              <p className="text-slate-200/90 leading-relaxed">
                Consolida la demanda, estandariza aprobaciones y mide el rendimiento operativo
                desde un solo entorno con control y trazabilidad.
              </p>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-xl shadow-slate-900/30"
                >
                  <div className="flex items-center gap-3">
                    <FiTarget className="text-emerald-300 text-xl" />
                    <div>
                      <div className="text-2xl font-bold">98.5%</div>
                      <div className="text-sm text-slate-200">Eficiencia</div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-xl shadow-slate-900/30"
                >
                  <div className="flex items-center gap-3">
                    <FiZap className="text-amber-300 text-xl" />
                    <div>
                      <div className="text-2xl font-bold">24h</div>
                      <div className="text-sm text-slate-200">Tiempo promedio</div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-xl shadow-slate-900/30"
                >
                  <div className="flex items-center gap-3">
                    <FiBarChart className="text-sky-300 text-xl" />
                    <div>
                      <div className="text-2xl font-bold">150+</div>
                      <div className="text-sm text-slate-200">Procesos activos</div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className="relative"
            >
              <div className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 shadow-2xl shadow-slate-900/30">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-sm uppercase tracking-[0.2em] text-slate-300">Estado Operativo</div>
                    <div className="text-2xl font-bold mt-1">Flujo Comercial</div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-200 text-xs font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    En linea
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-500/20 rounded-xl text-sky-200">
                      <FiTrendingUp size={18} />
                    </div>
                    <div>
                      <div className="text-sm text-slate-300">Tasa de aprobacion</div>
                      <div className="text-lg font-semibold text-white">+12.4% semanal</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-xl text-amber-200">
                      <FiShoppingCart size={18} />
                    </div>
                    <div>
                      <div className="text-sm text-slate-300">Solicitudes en curso</div>
                      <div className="text-lg font-semibold text-white">43 activas</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-200">
                      <FiPackage size={18} />
                    </div>
                    <div>
                      <div className="text-sm text-slate-300">Entrega promedio</div>
                      <div className="text-lg font-semibold text-white">5.2 dias</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 h-2 w-full rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-400 w-3/4" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Navigation Tabs Premium */}
      <div className="bg-white/90 backdrop-blur border-b border-slate-200 shadow-lg shadow-slate-200/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0">
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
                    relative flex-1 px-6 md:px-8 py-6 text-left transition-all duration-500 group
                    ${isActive
                      ? `bg-gradient-to-r ${config.bgGradient} border-b-4 border-slate-900/20`
                      : 'hover:bg-slate-50'
                    }
                  `}
                >
                  <div className="flex items-start gap-4">
                    <div className={`
                      p-3 rounded-2xl transition-all duration-300
                      ${isActive
                        ? `bg-gradient-to-r ${config.gradient} text-white shadow-xl ${config.shadowColor}`
                        : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
                      }
                    `}>
                      <Icon size={24} />
                    </div>

                    <div className="flex-1">
                      <h3 className={`text-lg font-bold mb-1 ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                        {config.label}
                      </h3>
                      <p className={`text-sm mb-3 ${isActive ? 'text-slate-700' : 'text-slate-500'}`}>
                        {config.description}
                      </p>

                      {/* Features */}
                      <div className="flex flex-wrap gap-2">
                        {config.features.map((feature, idx) => (
                          <span
                            key={idx}
                            className={`
                              px-2.5 py-1 text-xs rounded-full font-medium
                              ${isActive
                                ? 'bg-white/70 text-slate-700'
                                : 'bg-slate-100 text-slate-600'
                              }
                            `}
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Active Indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area Premium */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
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
