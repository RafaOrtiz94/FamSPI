import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  FiAlertCircle,
  FiBriefcase,
  FiClock,
  FiFileText,
  FiPackage,
  FiRefreshCw,
  FiSearch,
  FiShield,
} from 'react-icons/fi';

import { useAuth } from '../../../core/auth/AuthContext';
import { listEquipmentPurchases } from '../../../core/api/equipmentPurchasesApi';
import { listPrivatePurchases } from '../../../core/api/privatePurchasesApi';
import { WORKSPACE_PAGE_CLASS } from '../../../core/ui/workspaceLayout';
import TabBadge from './components/TabBadge';
import PurchaseExpedienteDetail from './expediente/PurchaseExpedienteDetail';

const EASE_OUT = [0.23, 1, 0.32, 1];

const ALL_WORKFLOW_ROLES = [
  'comercial',
  'jefe_comercial',
  'acp_comercial',
  'backoffice_comercial',
  'gerencia',
  'gerencia_general',
  'operaciones',
  'jefe_operaciones',
  'logistica',
  'jefe_logistica',
  'jefe_tecnico',
  'jefe_servicio_tecnico',
  'tecnico',
  'servicio_tecnico',
];

const TYPE_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'public', label: 'Publicas' },
  { value: 'private', label: 'Privadas' },
];

const normalizeRoles = (user) => {
  if (!user) return [];
  const rawRoles = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? [];
  const rawScopes = user?.scope ?? user?.user?.scope ?? [];
  return [...(Array.isArray(rawRoles) ? rawRoles : [rawRoles]), ...(Array.isArray(rawScopes) ? rawScopes : [rawScopes])]
    .flatMap((role) => {
      if (typeof role === 'object' && role !== null) return String(role.name || role.role || role.code || role.slug || '');
      return String(role || '').split(/[,\s]+/);
    })
    .map((role) => role.toLowerCase().trim())
    .filter(Boolean);
};

const getPublicClientName = (item) => (
  item?.client_name ||
  item?.equipment?.[0]?.provider_name ||
  item?.provider_name ||
  item?.contracting_entity ||
  'Cliente sin registrar'
);

const getPrivateClientName = (item) => (
  item?.client_data?.commercial_name ||
  item?.client_data?.legal_person_business_name ||
  item?.client_snapshot?.commercial_name ||
  item?.client_snapshot?.legal_person_business_name ||
  'Cliente sin registrar'
);

const getEquipmentLabel = (item) => {
  const equipment = Array.isArray(item?.equipment) ? item.equipment : [];
  const label = equipment
    .map((entry) => entry?.model || entry?.name || entry?.equipment_name || entry?.description)
    .filter(Boolean)
    .join(', ');
  return label || item?.equipment_model || item?.equipment_name || 'Equipo por definir';
};

const normalizePublicPurchase = (item) => ({
  id: item.id,
  type: 'public',
  title: getPublicClientName(item),
  subtitle: getEquipmentLabel(item),
  status: item.status || 'request_created',
  modality: 'Compra publica',
  purchase_type: item.purchase_type || 'public',
  updated_at: item.updated_at || item.created_at,
  raw: item,
});

const normalizePrivatePurchase = (item) => ({
  id: item.id,
  type: 'private',
  title: getPrivateClientName(item),
  subtitle: getEquipmentLabel(item),
  status: item.status || 'request_created',
  modality: item.offer_kind || item.private_modality || 'Compra privada',
  purchase_type: 'private',
  updated_at: item.updated_at || item.created_at,
  raw: item,
});

const statusVariant = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('blocked') || normalized.includes('rejected') || normalized.includes('cancel')) return 'blocked';
  if (normalized.includes('completed') || normalized.includes('delivered') || normalized.includes('signed')) return 'done';
  if (normalized.includes('pending') || normalized.includes('waiting') || normalized.includes('requested')) return 'pending';
  return 'active';
};

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const EmptyState = ({ message }) => (
  <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
    <FiFileText size={28} className="text-slate-400" aria-hidden="true" />
    <p className="mt-3 text-sm font-medium text-slate-900">{message}</p>
    <p className="mt-1 max-w-sm text-xs text-slate-500">
      Ajusta filtros o recarga el workspace para consultar expedientes disponibles.
    </p>
  </div>
);

const PurchasesWorkspace = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const userRoles = useMemo(() => normalizeRoles(user), [user]);
  const canAccessWorkspace = userRoles.some((role) => ALL_WORKFLOW_ROLES.includes(role));

  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [typeFilter, setTypeFilter] = useState(() => new URLSearchParams(location.search).get('tab') || 'all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadPurchases = useCallback(async () => {
    if (!canAccessWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const [publicResult, privateResult] = await Promise.allSettled([
        listEquipmentPurchases(),
        listPrivatePurchases({ limit: 200 }),
      ]);

      const publicItems = publicResult.status === 'fulfilled'
        ? (Array.isArray(publicResult.value) ? publicResult.value : []).map(normalizePublicPurchase)
        : [];
      const privateItems = privateResult.status === 'fulfilled'
        ? (Array.isArray(privateResult.value) ? privateResult.value : []).map(normalizePrivatePurchase)
        : [];

      const nextItems = [...publicItems, ...privateItems].sort((a, b) => (
        new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
      ));

      setItems(nextItems);
      setSelected((current) => {
        if (current && nextItems.some((item) => item.id === current.id && item.type === current.type)) return current;
        return nextItems[0] || null;
      });

      if (publicResult.status === 'rejected' && privateResult.status === 'rejected') {
        setError('No se pudieron cargar los expedientes de compras.');
      }
    } finally {
      setLoading(false);
    }
  }, [canAccessWorkspace]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (typeFilter === 'all') params.delete('tab');
    else params.set('tab', typeFilter);
    navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
  }, [typeFilter, location.pathname, location.search, navigate]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (!normalizedQuery) return true;
      return [item.title, item.subtitle, item.status, item.modality, item.id]
        .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    });
  }, [items, query, typeFilter]);

  if (!canAccessWorkspace) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-8">
        <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <FiShield size={28} className="mx-auto text-red-600" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">Acceso restringido</h2>
          <p className="mt-1 text-sm text-slate-500">Tu rol no tiene permiso para consultar el workspace de compras.</p>
        </div>
      </div>
    );
  }

  return (
    <main className={`${WORKSPACE_PAGE_CLASS} bg-slate-50`}>
      <header className="border-b border-slate-700 bg-naval-slate">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">Workspace de Compras</h1>
              <p className="mt-1 text-sm text-slate-300">
                Expediente unico para compra publica, compra privada, logistica, tecnica, entrenamiento y control de insumos.
              </p>
            </div>
            <button
              type="button"
              onClick={loadPurchases}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-medium text-slate-900 shadow-sm transition-colors duration-150 hover:bg-slate-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              Actualizar
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <FiSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por cliente, equipo, estado o ID"
                className="h-11 w-full rounded-2xl border border-slate-600 bg-slate-900/40 pl-10 pr-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300/30"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setTypeFilter(filter.value)}
                  className={`min-h-11 rounded-2xl px-4 text-sm font-medium transition-colors duration-150 active:scale-[0.97] ${
                    typeFilter === filter.value
                      ? 'bg-white text-slate-900'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <aside className="min-w-0">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Expedientes</h2>
                <p className="text-xs text-slate-500">
                  <span className="font-mono-data tabular-nums">{filteredItems.length}</span> visibles
                </p>
              </div>
              {loading && <FiRefreshCw size={15} className="animate-spin text-slate-400" aria-hidden="true" />}
            </div>

            {error && (
              <div className="m-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <FiAlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
              {loading && !items.length ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((index) => (
                    <div key={index} className="h-24 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : filteredItems.length ? (
                filteredItems.map((item) => {
                  const active = selected?.id === item.id && selected?.type === item.type;
                  return (
                    <button
                      key={`${item.type}:${item.id}`}
                      type="button"
                      onClick={() => setSelected(item)}
                      className={`mb-2 w-full rounded-lg border p-3 text-left transition-colors duration-150 active:scale-[0.99] ${
                        active
                          ? 'border-sky-500 bg-sky-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {item.type === 'public'
                              ? <FiBriefcase size={14} className="text-sky-700" aria-hidden="true" />
                              : <FiPackage size={14} className="text-emerald-700" aria-hidden="true" />}
                            <span className="truncate text-sm font-semibold text-slate-900">{item.title}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">{item.subtitle}</p>
                        </div>
                        <TabBadge variant={item.type === 'public' ? 'active' : 'control'} label={item.type === 'public' ? 'publica' : 'privada'} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <TabBadge variant={statusVariant(item.status)} label={String(item.status).replace(/_/g, ' ')} />
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <FiClock size={11} aria-hidden="true" />
                          <span className="font-mono-data">{formatDate(item.updated_at)}</span>
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-3">
                  <EmptyState message="No hay expedientes para los filtros actuales" />
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={`${selected.type}:${selected.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: EASE_OUT }}
                className="min-h-[calc(100vh-220px)]"
              >
                <PurchaseExpedienteDetail id={selected.id} type={selected.type} />
              </motion.div>
            ) : (
              <motion.div
                key="empty-detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-5"
              >
                <EmptyState message="Selecciona un expediente para abrir el workspace operativo" />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </section>
    </main>
  );
};

export default PurchasesWorkspace;
