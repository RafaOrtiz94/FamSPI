import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiCalendar, FiUser, FiGrid, FiLogIn, FiHome, FiBell, FiCheckCircle, FiClock, FiUploadCloud } from 'react-icons/fi';
import api from '../../../core/api';
import { useAuth } from '../../../core/auth/useAuth';

import { formatDateSafe } from '../../../shared/utils/dateUtils';
import { isPendingForUser, getFlowStateBadge, resolvePurchaseOrigin, getPurchaseOriginBadge } from '../../../core/utils/businessCaseFlowState';
import { DashboardLayout, DashboardHeader } from '../../../core/ui/layouts/DashboardLayout';
import Modal from '../../../core/ui/components/Modal';
import BusinessCaseTemplatePage from '../pages/BusinessCaseTemplatePage';

// Normalizador robusto para diferentes wrappers de respuesta del backend
const normalizeBusinessCases = (payload) => {
  // Prioridad: array directo > payload.items > payload.data > payload.rows > etc.
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  if (payload && payload.data && Array.isArray(payload.data.businessCases)) return payload.data.businessCases;
  if (payload && Array.isArray(payload.businessCases)) return payload.businessCases;
  return [];
};

const getOriginBadge = getPurchaseOriginBadge;

const resolveInitiator = (bc = {}) => {
  const name =
    bc.created_by_name ||
    bc.createdByName ||
    bc.modern_bc_metadata?.created_by_name ||
    bc.modern_bc_metadata?.createdByName ||
    null;
  const email =
    bc.created_by_email ||
    bc.createdByEmail ||
    bc.modern_bc_metadata?.created_by_email ||
    bc.modern_bc_metadata?.createdByEmail ||
    null;
  const id = bc.created_by || bc.createdBy || null;
  return name || email || (id ? `Usuario ${id}` : "No disponible");
};

const isOwnedByUser = (bc, user) =>
  (user?.id && Number(bc.created_by) === Number(user.id)) ||
  (user?.email && String(bc.created_by_email || '').toLowerCase() === String(user.email).toLowerCase());

const BusinessCaseCard = ({ bc, onSelect, highlight }) => {
  const origin = resolvePurchaseOrigin(bc);
  const originBadge = getOriginBadge(origin);
  const flowBadge = getFlowStateBadge(bc);

  return (
    <div
      className={`bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group border-2 ${
        highlight ? 'border-amber-300 ring-2 ring-amber-100' : 'border-transparent'
      }`}
      onClick={() => onSelect(bc.id)}
    >
      {highlight && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white">
          <FiBell className="h-3 w-3" />
          <span>TU TURNO</span>
        </div>
      )}

      <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${originBadge.className}`}>
        <span>{originBadge.label}</span>
      </div>

      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
            {bc.code}
          </h3>
          <p className="text-sm text-gray-600 truncate">{bc.client_name}</p>
          {(bc.title || bc.name) && (
            <p className="text-xs text-gray-500 mt-1 truncate">{bc.title || bc.name}</p>
          )}
        </div>
        <span className={`shrink-0 px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${flowBadge.className}`}>
          {flowBadge.label}
        </span>
      </div>

      {(bc.modern_bc_metadata?.source_module === "equipment_purchases" ||
        bc.modern_bc_metadata?.auto_created === true) && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
          <span>Auto desde Compras Publicas</span>
          {bc.modern_bc_metadata?.source_purchase_request_id && (
            <span className="text-emerald-700">
              #{String(bc.modern_bc_metadata.source_purchase_request_id).slice(0, 8)}
            </span>
          )}
        </div>
      )}

      <div className="space-y-2 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <FiCalendar className="h-4 w-4 shrink-0" />
          <span>Creado: {formatDateSafe(bc.created_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          <FiUser className="h-4 w-4 shrink-0" />
          <span className="truncate">Iniciado por: {resolveInitiator(bc)}</span>
        </div>
        <div className="flex items-center gap-2">
          <FiClock className="h-4 w-4 shrink-0" />
          <span>Actualizado: {formatDateSafe(bc.updated_at)}</span>
        </div>
      </div>

      <button
        className="w-full mt-6 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(bc.id);
        }}
      >
        Abrir Workspace
      </button>
    </div>
  );
};

const BusinessCasePicker = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [businessCases, setBusinessCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('todos');
  const [error, setError] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Fetch business cases on mount
  useEffect(() => {
    const fetchBusinessCases = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use the authenticated API client (with automatic token injection via interceptor)
        // pageSize explicito: el backend por defecto pagina a 20 y este picker
        // no tiene UI de paginacion -- sin esto, cualquier BC mas antiguo que
        // los 20 mas recientes queda invisible aunque el usuario tenga acceso
        // (el buscador de arriba solo filtra sobre lo ya cargado, no re-consulta).
        const response = await api.get('/business-case', { params: { pageSize: 500 } });

        // Normalize API response to get the array safely
        const bcList = normalizeBusinessCases(response.data);

        // Map to our component structure with tolerance for field names
        const normalizedCases = bcList.map(bc => ({
          id: bc.businessCaseId || bc.id, // businessCaseId como principal
          code: bc.bc_number || bc.code || bc.number || 'BC',
          client_name: bc.client_name || '',
          created_at: bc.created_at || bc.createdAt || bc.created || bc.updated_at || bc.updatedAt || bc.updated || null,
          updated_at: bc.updated_at || bc.updatedAt || bc.updated || bc.created_at || bc.createdAt || bc.created || null,
          current_stage: bc.current_stage || bc.bc_stage || bc.stage || bc.status || '',
          status: bc.status || bc.state || 'draft',
          bc_purchase_type: bc.bc_purchase_type || bc.bcPurchaseType || "",
          created_by: bc.created_by || bc.createdBy || null,
          created_by_name: bc.created_by_name || bc.createdByName || null,
          created_by_email: bc.created_by_email || bc.createdByEmail || null,
          flow_state: bc.flow_state || null,
          modern_bc_metadata: bc.modern_bc_metadata || {},
          extra: bc.extra || {},
        }));

        setBusinessCases(normalizedCases);
      } catch (err) {
        console.error('Error fetching business cases:', err);

        // Handle 401 Unauthorized with elegant UI
        if (err.response?.status === 401) {
          setError('SESSION_EXPIRED');
        } else {
          setError('Error cargando lista de Business Cases');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBusinessCases();
  }, []);

  const handleSelectBC = (bcId) => {
    navigate(`/dashboard/business-case/workspace/${bcId}`);
  };

  // Base: busqueda + filtro elegido. El orden real (pendientes primero) se
  // aplica despues, en pendingCases/otherCases, para que "Pendientes para
  // ti" siempre encabece la vista sin importar el filtro de texto activo.
  const searchedCases = useMemo(() => businessCases.filter((bc) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return bc.code.toLowerCase().includes(term) || bc.client_name.toLowerCase().includes(term);
  }), [businessCases, searchTerm]);

  const filteredCases = useMemo(() => searchedCases.filter((bc) => {
    if (activeFilter === 'todos') return true;
    if (activeFilter === 'pendientes') return isPendingForUser(bc, role);
    if (activeFilter === 'mios') return isOwnedByUser(bc, user);
    if (activeFilter === 'viables') return bc.flow_state?.code === 'viable';
    return true;
  }), [searchedCases, activeFilter, role, user]);

  // Orden real, no cosmetico: dentro de "pendientes para ti", el que lleva
  // MAS tiempo esperando va primero (updated_at ascendente) para que nada
  // se quede olvidado; el resto va por actividad reciente (updated_at
  // descendente), como antes.
  const pendingCases = useMemo(
    () => filteredCases
      .filter((bc) => isPendingForUser(bc, role))
      .sort((a, b) => new Date(a.updated_at || 0) - new Date(b.updated_at || 0)),
    [filteredCases, role],
  );
  const otherCases = useMemo(
    () => filteredCases
      .filter((bc) => !isPendingForUser(bc, role))
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)),
    [filteredCases, role],
  );

  const totalPendingForUser = useMemo(
    () => businessCases.filter((bc) => isPendingForUser(bc, role)).length,
    [businessCases, role],
  );

  if (loading) {
    return (
      <DashboardLayout includeWidgets={false}>
        <DashboardHeader title="Selecciona un Business Case" subtitle="Elige el caso en el que vas a trabajar" />

        {/* Search skeleton */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-3"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    // Handle session expired with elegant UI
    if (error === 'SESSION_EXPIRED') {
      return (
        <DashboardLayout includeWidgets={false}>
          <div className="flex items-center justify-center py-12">
            <div className="max-w-md w-full bg-white rounded-xl p-8 shadow-sm text-center">
              <div className="text-amber-500 mb-4">
                <FiLogIn className="mx-auto h-12 w-12" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Sesión expirada</h2>
              <p className="text-gray-600 mb-6">
                Tu sesión ha expirado o no tienes permisos para acceder a esta información.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <FiLogIn className="h-4 w-4" />
                  Iniciar sesión
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <FiHome className="h-4 w-4" />
                  Ir al inicio
                </button>
              </div>
            </div>
          </div>
        </DashboardLayout>
      );
    }

    // Generic error UI
    return (
      <DashboardLayout includeWidgets={false}>
        <div className="flex items-center justify-center py-12">
          <div className="max-w-md w-full bg-white rounded-xl p-8 shadow-sm text-center">
            <div className="text-red-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error cargando Business Cases</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalResults = filteredCases.length;

  return (
    <DashboardLayout includeWidgets={false}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <DashboardHeader title="Selecciona un Business Case" subtitle="Elige el caso en el que vas a trabajar" />
        {role === 'jefe_comercial' && (
          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <FiUploadCloud className="h-4 w-4" />
            Actualizar plantilla base
          </button>
        )}
      </div>

      <Modal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title="Plantilla base del Business Case"
        maxWidth="max-w-3xl"
      >
        <BusinessCaseTemplatePage />
      </Modal>

      {/* Resumen rapido: cuantos son realmente tu turno hoy */}
      {totalPendingForUser > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <FiBell className="h-6 w-6 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800">
            Tienes <span className="font-bold">{totalPendingForUser}</span> Business Case{totalPendingForUser !== 1 ? 's' : ''} esperando por ti.
            Se muestran primero, ordenados por más tiempo de espera.
          </p>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Buscar por código o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'todos', label: 'Todos', icon: FiGrid },
                { key: 'pendientes', label: `Pendientes para ti (${totalPendingForUser})`, icon: FiBell },
                { key: 'mios', label: 'Mis creados', icon: FiUser },
                { key: 'viables', label: 'Viables', icon: FiCheckCircle },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                    activeFilter === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {totalResults === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <FiGrid className="mx-auto h-12 w-12" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No se encontraron Business Cases
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'Intenta con otros términos de búsqueda' : 'No hay casos disponibles en este momento'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">
                {totalResults} caso{totalResults !== 1 ? 's' : ''} encontrado{totalResults !== 1 ? 's' : ''}
              </p>
            </div>

            {pendingCases.length > 0 && (
              <div className="mb-8">
                <div className="mb-3 flex items-center gap-2">
                  <FiBell className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700">
                    Pendientes para ti ({pendingCases.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingCases.map((bc) => (
                    <BusinessCaseCard key={bc.id} bc={bc} onSelect={handleSelectBC} highlight />
                  ))}
                </div>
              </div>
            )}

            {otherCases.length > 0 && (
              <div>
                {pendingCases.length > 0 && (
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">
                    Otros Business Case ({otherCases.length})
                  </h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {otherCases.map((bc) => (
                    <BusinessCaseCard key={bc.id} bc={bc} onSelect={handleSelectBC} highlight={false} />
                  ))}
                </div>
              </div>
            )}
        </>
      )}
    </DashboardLayout>
  );
};

export default BusinessCasePicker;
