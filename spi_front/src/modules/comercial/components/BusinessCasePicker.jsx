import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiCalendar, FiUser, FiFilter, FiGrid, FiLogIn, FiHome } from 'react-icons/fi';
import api from '../../../core/api';

import { formatDateSafe } from '../../../shared/utils/dateUtils';

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

const resolvePurchaseOrigin = (bc = {}) => {
 const type = String(bc.bc_purchase_type || bc.bcPurchaseType || "").toLowerCase();
 const sourceModule = String(bc.modern_bc_metadata?.source_module || "").toLowerCase();

 if (type.includes("pub") || type.includes("publico")) return "publica";
 if (type.includes("priv")) return "privada";
 if (sourceModule.includes("equipment_purchases")) return "publica";
 if (sourceModule.includes("private_purchases")) return "privada";
 return "no_definida";
};

const getOriginBadge = (origin) => {
 if (origin === "publica") return { label: "Compra publica", className: "bg-emerald-100 text-emerald-800" };
 if (origin === "privada") return { label: "Compra privada", className: "bg-indigo-100 text-indigo-800" };
 return { label: "Origen no definido", className: "bg-slate-100 text-slate-700" };
};

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

const BusinessCasePicker = () => {
 const navigate = useNavigate();
 const [businessCases, setBusinessCases] = useState([]);
 const [loading, setLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [activeFilter, setActiveFilter] = useState('todos');
 const [error, setError] = useState(null);

 // Fetch business cases on mount
 useEffect(() => {
 const fetchBusinessCases = async () => {
 try {
 setLoading(true);
 setError(null);

 // Use the authenticated API client (with automatic token injection via interceptor)
 const response = await api.get('/business-case');

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

 // Filter business cases based on search and active filter
 const filteredCases = businessCases.filter(bc => {
 const matchesSearch = searchTerm === '' ||
 bc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
 bc.client_name.toLowerCase().includes(searchTerm.toLowerCase());

 const matchesFilter =
 activeFilter === 'todos' ||
 (activeFilter === 'recientes' && new Date(bc.updated_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
 (activeFilter === 'activos' && bc.status === 'active') ||
 (activeFilter === 'mios' && true); // TODO: Filter by ownership when implemented

 return matchesSearch && matchesFilter;
 });

 const handleSelectBC = (bcId) => {
 navigate(`/dashboard/business-case/workspace/${bcId}`);
 };

 const getStageBadgeColor = (stage) => {
 const colors = {
 draft: 'bg-gray-100 text-gray-800',
 economic_evaluation: 'bg-blue-100 text-blue-800',
 economic_approval: 'bg-yellow-100 text-yellow-800',
 operational_data: 'bg-purple-100 text-purple-800',
 final_validation: 'bg-green-100 text-green-800',
 approved: 'bg-emerald-100 text-emerald-800'
 };
 return colors[stage] || 'bg-gray-100 text-gray-800';
 };

 const getStageLabel = (stage) => {
 const labels = {
 draft: 'Borrador',
 economic_evaluation: 'Evaluación Económica',
 economic_approval: 'Aprobación Económica',
 operational_data: 'Datos Operativos',
 final_validation: 'Validación Final',
 approved: 'Aprobado'
 };
 return labels[stage] || stage;
 };

 if (loading) {
 return (
 <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
 <div className="max-w-6xl w-full">
 {/* Header skeleton */}
 <div className="text-center mb-8">
 <div className="h-8 bg-white/60 rounded-lg w-96 mx-auto mb-2 animate-pulse"></div>
 <div className="h-4 bg-white/40 rounded w-80 mx-auto animate-pulse"></div>
 </div>

 {/* Search skeleton */}
 <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 mb-6 shadow-sm">
 <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
 </div>

 {/* Cards skeleton */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {[...Array(6)].map((_, i) => (
 <div key={i} className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm animate-pulse">
 <div className="h-6 bg-gray-200 rounded mb-3"></div>
 <div className="h-4 bg-gray-200 rounded mb-2"></div>
 <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
 <div className="h-8 bg-gray-200 rounded"></div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
 }

 if (error) {
 // Handle session expired with elegant UI
 if (error === 'SESSION_EXPIRED') {
 return (
 <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-6">
 <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-xl p-8 shadow-sm text-center">
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
 );
 }

 // Generic error UI
 return (
 <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-6">
 <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-xl p-8 shadow-sm text-center">
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
 );
 }

 return (
 <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
 <div className="max-w-6xl mx-auto">
 {/* Header */}
 <div className="text-center mb-8">
 <h1 className="text-4xl font-bold text-gray-900 mb-2">
 Selecciona un Business Case
 </h1>
 <p className="text-lg text-gray-600">
 Elige el caso en el que vas a trabajar
 </p>
 </div>

 {/* Search and Filters */}
 <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 mb-8 shadow-sm">
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
 <div className="flex gap-2">
 {[
 { key: 'todos', label: 'Todos', icon: FiGrid },
 { key: 'recientes', label: 'Recientes', icon: FiCalendar },
 { key: 'activos', label: 'Activos', icon: FiFilter },
 { key: 'mios', label: 'Míos', icon: FiUser }
 ].map(({ key, label, icon: Icon }) => (
 <button
 key={key}
 onClick={() => setActiveFilter(key)}
 className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
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
 {filteredCases.length === 0 ? (
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
 {filteredCases.length} caso{filteredCases.length !== 1 ? 's' : ''} encontrado{filteredCases.length !== 1 ? 's' : ''}
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {filteredCases.map((bc) => (
 <div
 key={bc.id}
 className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
 onClick={() => handleSelectBC(bc.id)}
 >
 {(() => {
 const origin = resolvePurchaseOrigin(bc);
 const originBadge = getOriginBadge(origin);
 return (
 <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${originBadge.className}`}>
 <span>{originBadge.label}</span>
 </div>
 );
 })()}

 <div className="flex items-start justify-between mb-4">
 <div>
 <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
 {bc.code}
 </h3>
 <p className="text-sm text-gray-600">{bc.client_name}</p>
 {(bc.title || bc.name) && (
 <p className="text-xs text-gray-500 mt-1">{bc.title || bc.name}</p>
 )}
 </div>
 <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageBadgeColor(bc.current_stage)}`}>
 {getStageLabel(bc.current_stage)}
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
 <FiCalendar className="h-4 w-4" />
 <span>Creado: {formatDateSafe(bc.created_at)}</span>
 </div>
 <div className="flex items-center gap-2">
 <FiUser className="h-4 w-4" />
 <span>Iniciado por: {resolveInitiator(bc)}</span>
 </div>
 <div className="flex items-center gap-2">
 <FiUser className="h-4 w-4" />
 <span>Actualizado: {formatDateSafe(bc.updated_at)}</span>
 </div>
 </div>

 <button
 className="w-full mt-6 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
 onClick={(e) => {
 e.stopPropagation();
 handleSelectBC(bc.id);
 }}
 >
 Abrir Workspace
 </button>
 </div>
 ))}
 </div>
 </>
 )}
 </div>
 </div>
 );
};

export default BusinessCasePicker;
