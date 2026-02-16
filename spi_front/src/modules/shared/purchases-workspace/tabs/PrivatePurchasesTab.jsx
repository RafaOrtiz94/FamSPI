import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Importar hook de auth
import { useAuth } from '../../../../core/auth/AuthContext';

// Importar logger centralizado
import logger from '../../../../core/utils/logger';

// Importar páginas según rol
import OperacionesPrivatePurchases from '../../../operaciones/pages/OperacionesPrivatePurchases';
import LogisticaPrivatePurchases from '../../../logistica/pages/LogisticaPrivatePurchases';
import PrivatePurchasesPage from '../../../backoffice/pages/PrivatePurchases';
import Card from '../../../../core/ui/components/Card';
import { getPrivatePurchaseStats } from '../../../../core/api/privatePurchasesApi';
import { FiList, FiTrendingUp } from 'react-icons/fi';

const normalizeRoles = (user) => {
  if (!user) return [];
  const rawRoles = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? user?.scope ?? [];
  const rolesArray = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
  return rolesArray.map((role) => String(role || '').toLowerCase().trim()).filter(Boolean);
};

const hasRole = (roles, token) => roles.some((role) => role === token || role.includes(token));

const PrivatePurchasesTab = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('requests');
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);

  const userRoles = normalizeRoles(user);

  // Determinar qué página mostrar según rol
  const isJefeOperaciones = hasRole(userRoles, 'jefe_operaciones');
  const isJefeLogistica = hasRole(userRoles, 'jefe_logistica');

  let PageComponent;
  let assignedRole;

  if (isJefeOperaciones) {
    PageComponent = OperacionesPrivatePurchases;
    assignedRole = 'jefe_operaciones';
  } else if (isJefeLogistica) {
    PageComponent = LogisticaPrivatePurchases;
    assignedRole = 'jefe_logistica';
  } else {
    // backoffice_comercial y roles comerciales/gerencia
    PageComponent = PrivatePurchasesPage;
    assignedRole = 'backoffice_comercial';
  }

  const privateSubTabs = useMemo(() => ([
    {
      id: 'requests',
      label: 'Solicitudes',
      icon: FiList,
    },
    {
      id: 'analytics',
      label: 'Análisis',
      icon: FiTrendingUp,
    }
  ]), []);

  // Logs detallados del flujo de compras privadas
  useEffect(() => {
    logger.info("[FLUJO_COMPRAS_PRIVADAS_FRONTEND] Renderizando tab de compras privadas", {
      user_id: user?.id,
      user_name: user?.name || user?.email,
      roles_usuario: userRoles,
      rol_asignado: assignedRole,
      componente_renderizado: PageComponent?.name,
      permisos: {
        puede_ver_operaciones: isJefeOperaciones,
        puede_ver_logistica: isJefeLogistica,
        puede_ver_backoffice: !isJefeOperaciones && !isJefeLogistica
      }
    });

    logger.requestFlow("INICIO_FLUJO_COMPRAS", "Usuario accedió a sección de compras privadas", {
      rol_asignado: assignedRole,
      contexto: 'workspace_compras_privadas'
    });
  }, [user, userRoles, assignedRole, PageComponent, isJefeOperaciones, isJefeLogistica]);

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      setLoadingStats(true);
      try {
        const data = await getPrivatePurchaseStats(assignedRole);
        if (!cancelled) setStats(data || {});
      } catch (_error) {
        if (!cancelled) setStats({});
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    };
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [assignedRole]);

  const total = stats?.total || 0;
  const inProgress =
    Number(stats?.pending_backoffice || 0) +
    Number(stats?.pending_contract_approval || 0) +
    Number(stats?.pending_contract_client_signature || 0);
  const completed = Number(stats?.completed || 0);
  const cancelledCount = Number(stats?.cancelled || 0);

  return (
    <div className="private-purchases-tab">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap gap-2 py-2">
            {privateSubTabs.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {activeSubTab === 'requests' ? (
              <PageComponent />
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Análisis de Compras Privadas</h2>
                  <p className="text-xs text-slate-500">
                    Resumen por estado para el rol actual: <span className="font-medium">{assignedRole}</span>
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p>
                    <p className="text-2xl font-semibold text-slate-900 mt-1">{loadingStats ? "--" : total}</p>
                  </Card>
                  <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">En proceso</p>
                    <p className="text-2xl font-semibold text-slate-900 mt-1">{loadingStats ? "--" : inProgress}</p>
                  </Card>
                  <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Completadas</p>
                    <p className="text-2xl font-semibold text-slate-900 mt-1">{loadingStats ? "--" : completed}</p>
                  </Card>
                  <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Canceladas</p>
                    <p className="text-2xl font-semibold text-slate-900 mt-1">{loadingStats ? "--" : cancelledCount}</p>
                  </Card>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PrivatePurchasesTab;
