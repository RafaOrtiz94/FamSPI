import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  FiAlertCircle,
  FiArchive,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiGrid,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUpload,
} from 'react-icons/fi';

import { useAuth } from '../../../core/auth/AuthContext';
import {
  createStandaloneConsumableFile,
  importStandaloneBusinessCaseFile,
  listConsumableFilesOverview,
  previewStandaloneBusinessCaseFile,
} from '../../../core/api/consumableFilesApi';
import { listEquipmentPurchases } from '../../../core/api/equipmentPurchasesApi';
import { listPrivatePurchases } from '../../../core/api/privatePurchasesApi';
import Modal from '../../../core/ui/components/Modal';
import { useUI } from '../../../core/ui/UIContext';
import { WORKSPACE_PAGE_CLASS } from '../../../core/ui/workspaceLayout';
import StandaloneConsumableForm, { createStandaloneFormState } from './components/StandaloneConsumableForm';
import TabBadge from './components/TabBadge';
import PurchaseExpedienteDetail from './expediente/PurchaseExpedienteDetail';
import StandaloneConsumableFileDetail from './expediente/StandaloneConsumableFileDetail';
import { normalizeRoles, hasAnyRole, isLogistics } from './purchaseRoleGroups';

const EASE_OUT = [0.23, 1, 0.32, 1];


const TYPE_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'public', label: 'Publicas' },
  { value: 'private', label: 'Privadas' },
  { value: 'standalone', label: 'Control de Consumibles' },
];

const WORKSPACE_SECTIONS = [
  {
    key: 'public',
    label: 'Compras publicas',
    helper: 'Procesos de contratacion publica y sus expedientes operativos.',
    icon: FiBriefcase,
    iconClassName: 'text-sky-700',
    toneClassName: 'border-sky-200 bg-sky-50',
    badgeVariant: 'active',
  },
  {
    key: 'private',
    label: 'Compras privadas',
    helper: 'Solicitudes privadas, oferta, contrato, logistica y tecnica.',
    icon: FiPackage,
    iconClassName: 'text-emerald-700',
    toneClassName: 'border-emerald-200 bg-emerald-50',
    badgeVariant: 'control',
  },
  {
    key: 'standalone',
    label: 'Control de Consumibles',
    helper: 'Expedientes de consumibles que nacen fuera de una compra o BC.',
    icon: FiArchive,
    iconClassName: 'text-amber-700',
    toneClassName: 'border-amber-200 bg-amber-50',
    badgeVariant: 'pending',
  },
];

const ALL_WORKFLOW_ROLES = ['comercial', 'tecnico', 'logistica', 'operaciones', 'gerencia', 'admin'];

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
  created_at: item.created_at,
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
  created_at: item.created_at,
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

const formatDateShort = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
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

const EmptySectionState = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
    <p className="text-sm font-medium text-slate-700">{message}</p>
    <p className="mt-1 text-xs text-slate-500">Ajusta los filtros o recarga el workspace para ver nuevos expedientes.</p>
  </div>
);

// Las secciones siempre inician cerradas -- el usuario las expande a demanda.
// El badge de conteo (ej. "3 expedientes") ya es visible con la sección cerrada,
// así que un conteo en 0 sigue indicando "no hay expedientes", no una sección oculta.
const buildInitialCollapsedSections = () => ({
  public: true,
  private: true,
  standalone: true,
});

const PurchasesWorkspace = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useUI();
  const prefersReducedMotion = useReducedMotion();
  const userRoles = useMemo(() => normalizeRoles(user), [user]);
  const canAccessWorkspace = hasAnyRole(userRoles, ALL_WORKFLOW_ROLES);

  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [typeFilter, setTypeFilter] = useState(() => new URLSearchParams(location.search).get('tab') || 'all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [consumablesOverview, setConsumablesOverview] = useState({ items: [], summary: {} });
  const [standaloneModalOpen, setStandaloneModalOpen] = useState(false);
  const [standaloneDraft, setStandaloneDraft] = useState(() => createStandaloneFormState());
  const [standaloneSubmitting, setStandaloneSubmitting] = useState(false);
  const [bcAssignedAdvisor, setBcAssignedAdvisor] = useState(null);
  const [bcFileForCreation, setBcFileForCreation] = useState(null);
  const [bcReading, setBcReading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState(buildInitialCollapsedSections);

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

  // Deep-link desde notificaciones/enlaces legacy: ?requestId=X (+ opcional
  // &requestType=public|private, default public) abre ese expediente directo.
  useEffect(() => {
    if (!items.length) return;
    const params = new URLSearchParams(location.search);
    const requestId = params.get('requestId');
    if (!requestId) return;
    const requestType = params.get('requestType') || 'public';
    const match = items.find((item) => String(item.id) === String(requestId) && item.type === requestType);
    if (match) {
      setSelected(match);
      setCollapsedSections((prev) => ({ ...prev, [match.type]: false }));
    }
    params.delete('requestId');
    params.delete('requestType');
    navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    if (!canAccessWorkspace) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await listConsumableFilesOverview();
        if (!cancelled) setConsumablesOverview(data);
      } catch (_error) {
        if (!cancelled) setConsumablesOverview({ items: [], summary: {} });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAccessWorkspace]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (typeFilter === 'all') params.delete('tab');
    else params.set('tab', typeFilter);
    navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
  }, [typeFilter, location.pathname, location.search, navigate]);

  useEffect(() => {
    setCollapsedSections(buildInitialCollapsedSections());
  }, [typeFilter]);

  const consumablesByPurchase = useMemo(() => {
    const map = new Map();
    (consumablesOverview?.items || []).forEach((item) => {
      const key = `${item.purchase_type}:${item.purchase_request_id}`;
      map.set(key, item);
    });
    return map;
  }, [consumablesOverview]);

  const isOpsOrLogistics = isLogistics(userRoles) || hasAnyRole(userRoles, ['gerencia']);
  const standaloneItems = useMemo(() => (
    (consumablesOverview?.items || [])
      .filter((item) => item.origin_type === 'standalone')
      .map((item) => ({
        id: item.id,
        type: 'standalone',
        title: item.process_name || 'Expediente de Control de Consumibles',
        subtitle: item.process_code || 'Sin codigo de proceso',
        status: item.status || 'draft',
        modality: 'Control de Consumibles',
        purchase_type: null,
        created_at: item.created_at,
        updated_at: item.updated_at || item.created_at,
        raw: item,
      }))
  ), [consumablesOverview]);
  const combinedItems = useMemo(() => (
    [...items, ...standaloneItems].sort((a, b) => (
      new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    ))
  ), [items, standaloneItems]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return combinedItems.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (!normalizedQuery) return true;
      return [item.title, item.subtitle, item.status, item.modality, item.id]
        .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    });
  }, [combinedItems, query, typeFilter]);
  const groupedItems = useMemo(() => {
    const groupedMap = new Map(
      WORKSPACE_SECTIONS.map((section) => [section.key, []]),
    );

    filteredItems.forEach((item) => {
      if (!groupedMap.has(item.type)) groupedMap.set(item.type, []);
      groupedMap.get(item.type).push(item);
    });

    return WORKSPACE_SECTIONS
      .filter((section) => typeFilter === 'all' || section.key === typeFilter)
      .map((section) => ({
        ...section,
        items: groupedMap.get(section.key) || [],
      }));
  }, [filteredItems, typeFilter]);

  useEffect(() => {
    setSelected((current) => {
      if (current && combinedItems.some((item) => item.id === current.id && item.type === current.type)) return current;
      return combinedItems[0] || null;
    });
  }, [combinedItems]);

  const refreshConsumablesOverview = useCallback(async () => {
    try {
      const data = await listConsumableFilesOverview();
      setConsumablesOverview(data);
    } catch (_error) {
      setConsumablesOverview({ items: [], summary: {} });
    }
  }, []);

  const toggleSection = useCallback((sectionKey) => {
    setCollapsedSections((current) => ({
      ...current,
      [sectionKey]: !current?.[sectionKey],
    }));
  }, []);

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleReadBusinessCase = async (file) => {
    if (!file) return;
    setBcReading(true);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const preview = await previewStandaloneBusinessCaseFile({ fileBase64, fileName: file.name });
      // eslint-disable-next-line no-console
      console.log('[BC preview] diagnostico por hoja:', preview.sheet_diagnostics);
      // eslint-disable-next-line no-console
      console.log('[BC preview] equipos detectados (equipment_matches):', preview.equipment_matches);
      setStandaloneDraft((current) => ({
        ...current,
        processCode: preview.process_code || current.processCode,
        contractingEntity: preview.contracting_entity || current.contractingEntity,
        contractObject: preview.contract_object || current.contractObject,
        clientId: preview.client_match?.id || current.clientId,
        clientLabel: preview.client_match?.label || preview.client_name_raw || current.clientLabel,
        equipmentIds: preview.equipment_matches?.length
          ? Array.from(new Set([
            ...current.equipmentIds,
            ...preview.equipment_matches.flatMap((item) => item.equipment_ids || []),
          ]))
          : current.equipmentIds,
      }));
      setBcFileForCreation(file);
      setBcAssignedAdvisor(preview.client_match?.advisor_name ? {
        name: preview.client_match.advisor_name,
        email: preview.client_match.advisor_email,
      } : null);
      const unmatchedEquipment = (preview.equipment_matches || []).filter((item) => !(item.equipment_ids || []).length).length;
      const clientUnmatched = Boolean(preview.client_name_raw) && !preview.client_match;
      const warnings = [
        unmatchedEquipment ? `${unmatchedEquipment} pestana(s) de equipo sin coincidencia (revisa "Equipos vinculados")` : null,
        clientUnmatched ? 'el cliente leido no coincide con ningun registro existente' : null,
      ].filter(Boolean);
      showToast(
        warnings.length ? `Business case leido. ${warnings.join('; ')}.` : 'Business case leido y datos completados',
        warnings.length ? 'error' : 'success',
      );
    } catch (previewError) {
      showToast(previewError?.response?.data?.message || previewError?.message || 'No se pudo leer el business case', 'error');
    } finally {
      setBcReading(false);
    }
  };

  const handleCreateStandalone = async () => {
    if (!standaloneDraft.processName.trim()) {
      showToast('Debes ingresar un nombre de proceso para el expediente de Control de Consumibles', 'error');
      return;
    }
    if (!standaloneDraft.contractingEntity.trim() && !(standaloneDraft.sameEntityAsClient && standaloneDraft.clientId)) {
      showToast('Debes completar la entidad contratante o vincularla con el cliente', 'error');
      return;
    }
    if (!standaloneDraft.contractObject.trim()) {
      showToast('Debes ingresar el objeto de contratacion', 'error');
      return;
    }
    if (!standaloneDraft.equipmentIds.length) {
      showToast('Debes seleccionar al menos un equipo', 'error');
      return;
    }
    setStandaloneSubmitting(true);
    try {
      const detail = await createStandaloneConsumableFile({
        processName: standaloneDraft.processName,
        processCode: standaloneDraft.processCode,
        clientId: standaloneDraft.clientId,
        contractingEntity: standaloneDraft.contractingEntity,
        sameEntityAsClient: standaloneDraft.sameEntityAsClient,
        contractObject: standaloneDraft.contractObject,
        equipmentIds: standaloneDraft.equipmentIds,
      });
      if (bcFileForCreation) {
        try {
          const fileBase64 = await readFileAsBase64(bcFileForCreation);
          await importStandaloneBusinessCaseFile(detail.file.id, {
            fileBase64,
            fileName: bcFileForCreation.name,
            mimeType: bcFileForCreation.type || 'application/octet-stream',
          });
        } catch (bcApplyError) {
          showToast(bcApplyError?.response?.data?.message || bcApplyError?.message || 'No se pudieron aplicar las cantidades del business case', 'error');
        }
      }
      await refreshConsumablesOverview();
      setStandaloneModalOpen(false);
      setStandaloneDraft(createStandaloneFormState());
      setBcFileForCreation(null);
      setBcAssignedAdvisor(null);
      setSelected({
        id: detail.file.id,
        type: 'standalone',
        title: detail.file.process_name,
        subtitle: detail.file.process_code || 'Sin codigo de proceso',
        status: detail.file.status || 'draft',
        modality: 'Control de Consumibles',
        purchase_type: null,
        updated_at: detail.file.updated_at || detail.file.created_at,
        raw: {
          id: detail.file.id,
          process_name: detail.file.process_name,
          process_code: detail.file.process_code || null,
        },
      });
      showToast('Expediente de Control de Consumibles creado', 'success');
    } catch (createError) {
      showToast(createError?.response?.data?.message || createError?.message || 'No se pudo crear el expediente de Control de Consumibles', 'error');
    } finally {
      setStandaloneSubmitting(false);
    }
  };

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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">Workspace de Compras</h1>
              <p className="mt-1 text-sm text-slate-500">
                Expediente unico para compra publica, compra privada, logistica, tecnica, entrenamiento y control de insumos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasAnyRole(userRoles, ['comercial']) && (
                <button
                  type="button"
                  onClick={() => setStandaloneModalOpen(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-emerald-600 active:scale-[0.97]"
                >
                  <FiPlus size={15} aria-hidden="true" />
                  Control de Consumibles
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  loadPurchases();
                  refreshConsumablesOverview();
                }}
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors duration-150 hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                Actualizar
              </button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <FiSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por cliente, equipo, estado o ID"
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-action-blue/20"
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
                      ? 'bg-action-blue text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
          {isOpsOrLogistics && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <FiGrid size={15} className="text-sky-700" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-900">Resumen de insumos</h2>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Expedientes</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{consumablesOverview?.summary?.total_files || 0}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-amber-700">Extras pendientes</p>
                  <p className="mt-1 text-lg font-semibold text-amber-900">{consumablesOverview?.summary?.pending_extra || 0}</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-sky-700">Listos despacho</p>
                  <p className="mt-1 text-lg font-semibold text-sky-900">{consumablesOverview?.summary?.ready_dispatch || 0}</p>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-orange-700">Parciales</p>
                  <p className="mt-1 text-lg font-semibold text-orange-900">{consumablesOverview?.summary?.partial_dispatch || 0}</p>
                </div>
              </div>
            </div>
          )}

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
                <div className="space-y-3">
                  {groupedItems.map((section) => {
                    const SectionIcon = section.icon;
                    const isCollapsed = Boolean(collapsedSections?.[section.key]);
                    return (
                      <div key={section.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
                        <button
                          type="button"
                          onClick={() => toggleSection(section.key)}
                          aria-expanded={!isCollapsed}
                          className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors duration-150 hover:brightness-[0.99] active:scale-[0.99] ${section.toneClassName}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <SectionIcon size={15} className={section.iconClassName} aria-hidden="true" />
                                <h3 className="text-sm font-semibold text-slate-900">{section.label}</h3>
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-slate-600">{section.helper}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <TabBadge
                                variant={section.badgeVariant}
                                label={`${section.items.length} expediente${section.items.length === 1 ? '' : 's'}`}
                              />
                              {isCollapsed ? (
                                <FiChevronRight size={16} className="text-slate-500" aria-hidden="true" />
                              ) : (
                                <FiChevronDown size={16} className="text-slate-500" aria-hidden="true" />
                              )}
                            </div>
                          </div>
                        </button>

                        {!isCollapsed ? (
                          <div className="mt-2 space-y-2">
                          {section.items.length ? section.items.map((item) => {
                            const active = selected?.id === item.id && selected?.type === item.type;
                            const consumables = item.type === 'standalone'
                              ? item.raw
                              : (consumablesByPurchase.get(`${item.type}:${item.id}`) || null);
                            return (
                              <button
                                key={`${item.type}:${item.id}`}
                                type="button"
                                onClick={() => setSelected(item)}
                                aria-pressed={active}
                                className={`w-full rounded-2xl border-2 p-3 text-left transition-colors duration-150 active:scale-[0.99] ${
                                  active
                                    ? 'border-action-blue bg-action-blue/5 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      {item.type === 'public'
                                        ? <FiBriefcase size={14} className="text-sky-700 shrink-0" aria-hidden="true" />
                                        : item.type === 'standalone'
                                        ? <FiArchive size={14} className="text-amber-700 shrink-0" aria-hidden="true" />
                                        : <FiPackage size={14} className="text-emerald-700 shrink-0" aria-hidden="true" />}
                                      <span className="truncate text-sm font-semibold text-slate-900">{item.title}</span>
                                      {active && (
                                        <FiCheckCircle size={14} className="text-action-blue shrink-0" aria-hidden="true" />
                                      )}
                                    </div>
                                    <p className="mt-1 truncate text-xs text-slate-500">{item.subtitle}</p>
                                  </div>
                                  <TabBadge
                                    variant={item.type === 'public' ? 'active' : item.type === 'private' ? 'control' : 'pending'}
                                    label={
                                      item.type === 'public'
                                        ? 'publica'
                                        : item.type === 'private'
                                        ? 'privada'
                                        : 'standalone'
                                    }
                                  />
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <TabBadge variant={statusVariant(item.status)} label={String(item.status).replace(/_/g, ' ')} />
                                  {consumables && (
                                    <TabBadge
                                      variant={
                                        consumables.orders_pending_extra > 0
                                          ? 'pending'
                                          : consumables.orders_partial > 0
                                          ? 'active'
                                          : consumables.latest_order_status === 'dispatched'
                                          ? 'done'
                                          : 'control'
                                      }
                                      label={
                                        consumables.orders_pending_extra > 0
                                          ? `insumos: ${consumables.orders_pending_extra} extra`
                                          : consumables.orders_partial > 0
                                          ? `insumos: ${consumables.orders_partial} parcial`
                                          : consumables.total_orders > 0
                                          ? `insumos: ${String(consumables.latest_order_status || 'activo').replace(/_/g, ' ')}`
                                          : `insumos: ${consumables.status}`
                                      }
                                    />
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
                                  {item.created_at && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                      <FiCalendar size={11} aria-hidden="true" />
                                      Creado <span className="font-mono-data">{formatDateShort(item.created_at)}</span>
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                    <FiClock size={11} aria-hidden="true" />
                                    Modificado <span className="font-mono-data">{formatDateShort(item.updated_at)}</span>
                                  </span>
                                </div>
                              </button>
                            );
                          }) : (
                            <EmptySectionState
                              message={`No hay expedientes en ${section.label.toLowerCase()} para los filtros actuales.`}
                            />
                          )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
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
                {selected.type === 'standalone' ? (
                  <StandaloneConsumableFileDetail
                    fileId={selected.id}
                    processName={selected?.raw?.process_name || selected.title}
                    onRefresh={refreshConsumablesOverview}
                  />
                ) : (
                  <PurchaseExpedienteDetail id={selected.id} type={selected.type} />
                )}
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

      <Modal
        open={standaloneModalOpen}
        onClose={() => {
          if (standaloneSubmitting) return;
          setStandaloneModalOpen(false);
        }}
        title="Nuevo expediente de Control de Consumibles"
        maxWidth="max-w-5xl"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            Usa esta opcion cuando el expediente de consumibles no proviene de una compra ni de un business case. La cabecera queda lista desde el inicio y los insumos se estructuran automaticamente segun los equipos seleccionados.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-800">Leer business case resuelto</p>
              <p className="text-xs text-emerald-700">
                Completa codigo, cliente, entidad, objeto, equipos y cantidades maximas automaticamente.
                {bcFileForCreation ? ` Archivo: ${bcFileForCreation.name}` : ''}
              </p>
            </div>
            <label className="inline-flex min-h-11 flex-shrink-0 cursor-pointer items-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[0.97]">
              {bcReading ? <FiRefreshCw size={14} className="animate-spin" /> : <FiUpload size={14} />}
              {bcReading ? 'Leyendo...' : 'Subir archivo'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={bcReading || standaloneSubmitting}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) handleReadBusinessCase(file);
                }}
              />
            </label>
          </div>
          <StandaloneConsumableForm
            value={standaloneDraft}
            onChange={setStandaloneDraft}
            disabled={standaloneSubmitting}
            bcLocked={Boolean(bcFileForCreation)}
            bcAssignedAdvisor={bcAssignedAdvisor}
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setStandaloneModalOpen(false);
                setStandaloneDraft(createStandaloneFormState());
                setBcFileForCreation(null);
                setBcAssignedAdvisor(null);
              }}
              disabled={standaloneSubmitting}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateStandalone}
              disabled={standaloneSubmitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <FiPlus size={14} aria-hidden="true" />
              {standaloneSubmitting ? 'Creando...' : 'Crear expediente'}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
};

export default PurchasesWorkspace;
