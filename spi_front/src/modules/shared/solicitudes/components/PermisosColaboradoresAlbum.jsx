import React, { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiClock, FiEye, FiUser, FiSearch, FiX } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { getResumenColaboradores } from "../../../../core/api/permisosApi";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { formatVacationDaysHours } from "../utils/vacationDisplay";

const formatDate = (dateStr) => {
 if (!dateStr) return "-";
 return new Date(dateStr).toLocaleDateString("es-EC", {
 year: "numeric",
 month: "short",
 day: "numeric",
 });
};

const computePermisoDuration = (item) => {
 if (item.duracion_horas) return `${item.duracion_horas}h`;
 if (item.duracion_dias) return `${item.duracion_dias}d`;
 return "-";
};

const computePermisoHours = (item = {}) => {
 if (Number.isFinite(Number(item?.duracion_horas))) {
 return Number(item.duracion_horas);
 }
 if (Number.isFinite(Number(item?.duracion_dias))) {
 return Number(item.duracion_dias) * 8;
 }
 return 0;
};

const summarizePermisos = (items = []) => {
 const summary = { total: items.length, hours: 0, byType: {} };
 items.forEach((item) => {
 summary.hours += computePermisoHours(item);
 const typeKey = (item.tipo_permiso || "Permiso").toLowerCase();
 summary.byType[typeKey] = (summary.byType[typeKey] || 0) + 1;
 });
 return summary;
};

const summarizeVacaciones = (items = []) => {
 const totalDays = items.reduce((acc, item) => acc + (Number(item.duracion_dias) || 0), 0);
 return { totalDays };
};

const PermisosColaboradoresAlbum = ({ compact = false }) => {
 const { showToast } = useUI();
 const [loading, setLoading] = useState(false);
 const [rows, setRows] = useState([]);
 const [active, setActive] = useState(null);
 const [search, setSearch] = useState("");

 const load = async ({ silent = false } = {}) => {
 if (!silent) setLoading(true);
 try {
 const response = await getResumenColaboradores();
 setRows(Array.isArray(response?.data) ? response.data : []);
 } catch (error) {
 console.error("Error cargando resumen de colaboradores:", error);
 showToast("No se pudo cargar el resumen de colaboradores", "warning");
 } finally {
 if (!silent) setLoading(false);
 }
 };

 useEffect(() => {
 load();
 }, []);

 useScopedAutoUpdate(
 [DATA_UPDATE_SCOPES.PERMISOS, DATA_UPDATE_SCOPES.VACACIONES],
 () => {
 load({ silent: true });
 },
 );

 const filteredRows = useMemo(() => {
 if (!search) return rows;
 const lower = search.toLowerCase();
 return rows.filter(
 (r) =>
 (r.user_fullname || "").toLowerCase().includes(lower) ||
 (r.user_email || "").toLowerCase().includes(lower)
 );
 }, [rows, search]);

 const activePermisoSummary = useMemo(() => {
 if (!active) return { total: 0, hours: 0, byType: {} };
 return summarizePermisos(active.permisos?.items || []);
 }, [active]);

 const activeVacacionesSummary = useMemo(() => {
 if (!active) return { totalDays: 0 };
 return summarizeVacaciones(active.vacaciones?.items || []);
 }, [active]);

 const spacingClass = compact ? "space-y-4" : "space-y-6";
 const headerTitleClass = compact ? "text-base font-bold text-gray-900 tracking-tight flex items-center gap-2" : "text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2";
 const searchInputClass = compact
 ? "block w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg bg-white/50 text-xs placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all shadow-sm"
 : "block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl bg-white/50 text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all shadow-sm";
 const gridClass = compact ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";
 const cardPadding = compact ? "p-4 space-y-3" : "p-5 space-y-4";
 const avatarSize = compact ? "h-9 w-9" : "h-10 w-10";
 const modalPadding = compact ? "p-4 space-y-6" : "p-6 space-y-8";
 const modalHeaderPadding = compact ? "px-4 py-3" : "px-6 py-4";
 const modalFooterPadding = compact ? "px-4 py-3" : "px-6 py-4";
return (
 <div className={spacingClass}>
 {/* Header & Search */}
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
 <h2 className={headerTitleClass}>
 Colaboradores
 <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
 {rows.length}
 </span>
 </h2>
 <div className="relative w-full sm:w-72 group">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <FiSearch className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
 </div>
 <input
 type="text"
 placeholder="Buscar por nombre o correo..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className={searchInputClass}
 />
 </div>
 </div>

 {loading && rows.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-gray-400">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
 <p className="text-sm">Cargando información...</p>
 </div>
 ) : filteredRows.length === 0 ? (
 <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
 <p className="text-sm text-gray-500">No se encontraron colaboradores.</p>
 </div>
 ) : (
 <div className={gridClass}>
 {filteredRows.map((row) => {
 const hasPermisos = (row.permisos?.items || []).length > 0 || (row.permisos?.total || 0) > 0;
 const hasVacaciones = (row.vacaciones?.items || []).length > 0;
 const hasRequests = hasPermisos || hasVacaciones;
 return (
 <div
 key={row.user_email || row.user_id || row.user_fullname}
 onClick={() => setActive(row)}
 className="group relative bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-2xl cursor-pointer overflow-hidden"
 >
 <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
 <FiEye className="text-gray-400" />
 </div>
 
 <div className={cardPadding}>
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
 <span className="font-bold text-sm">
 {(row.user_fullname || row.user_email || "?").charAt(0).toUpperCase()}
 </span>
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-sm font-semibold text-gray-900 truncate">
 {row.user_fullname || "Usuario sin nombre"}
 </p>
 <p className="text-xs text-gray-500 truncate font-medium">
 {row.user_email}
 </p>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-2">
 <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 group-hover:border-slate-200 transition-colors">
 <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">
 Permisos
 </p>
 <p className="text-lg font-bold text-slate-700">
 {row.permisos.total}
 </p>
 </div>
 <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-100/50 group-hover:border-emerald-200/50 transition-colors">
 <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600/70 mb-1">
 Vacaciones
 </p>
 <div className="grid grid-cols-3 gap-1 text-[10px] text-emerald-700/80">
 <div>
 <p className="font-semibold text-emerald-700">{formatVacationDaysHours(row.vacaciones.dias_disponibles).shortText}</p>
 <p className="text-[9px] uppercase tracking-wide">Asignados</p>
 </div>
 <div>
 <p className="font-semibold text-emerald-700">{formatVacationDaysHours(row.vacaciones.dias_aprobados).shortText}</p>
 <p className="text-[9px] uppercase tracking-wide">Ocupados</p>
 </div>
 <div>
 <p className="font-semibold text-emerald-700">{formatVacationDaysHours(row.vacaciones.dias_restantes).shortText}</p>
 <p className="text-[9px] uppercase tracking-wide">Restantes</p>
 </div>
 </div>
 </div>
 </div>

 {!hasRequests && (
 <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-center">
 Sin solicitudes registradas
 </div>
 )}
 {row.vacaciones?.missing_hire_date && (
 <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 text-center">
 Falta fecha de ingreso
 </div>
 )}
 </div>
 </div>
 )})}
 </div>
 )}

 {/* Detail Modal */}
 {active && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
 <div 
 className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" 
 onClick={() => setActive(null)}
 />
 <div className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
 {/* Modal Header */}
 <div className={`${modalHeaderPadding} flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-md z-10 sticky top-0`}>
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-500/20">
 {(active.user_fullname || active.user_email || "?").charAt(0).toUpperCase()}
 </div>
 <div>
 <h3 className="text-base font-semibold text-gray-900">
 {active.user_fullname || active.user_email}
 </h3>
 <p className="text-xs text-gray-500">{active.user_email}</p>
 </div>
 </div>
 <button 
 onClick={() => setActive(null)}
 className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 >
 <FiX className="h-5 w-5" />
 </button>
 </div>

 {/* Modal Content */}
 <div className={`flex-1 overflow-y-auto ${modalPadding}`}>
 {/* Stats Grid */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Permisos</p>
 <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-medium">Total</span>
 </div>
 <p className="text-2xl font-bold text-slate-800">{active.permisos.total}</p>
 <p className="text-xs text-slate-400 mt-1">
 {activePermisoSummary.hours} horas registradas
 </p>
 </div>
 
 <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50">
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">Asignados</p>
 <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded font-medium">Vacaciones</span>
 </div>
 <p className="text-2xl font-bold text-blue-700">{formatVacationDaysHours(active.vacaciones.dias_disponibles).shortText}</p>
 </div>

 <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50">
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Restantes</p>
 <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-medium">Vacaciones</span>
 </div>
 <p className="text-2xl font-bold text-emerald-700">{formatVacationDaysHours(active.vacaciones.dias_restantes).shortText}</p>
 <p className="text-xs text-emerald-600/70 mt-1">
 {activeVacacionesSummary.totalDays} días solicitados
 </p>
 </div>
 </div>

 {/* Permisos Types Pills */}
 {Object.keys(activePermisoSummary.byType).length > 0 && (
 <div className="space-y-2">
 <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipos de Permisos</h4>
 <div className="flex flex-wrap gap-2">
 {Object.entries(activePermisoSummary.byType).map(([key, count]) => (
 <span key={key} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200">
 <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
 {key}: {count}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* Lists Grid */}
 <div className="grid md:grid-cols-2 gap-8">
 {/* Permisos List */}
 <div className="space-y-4">
 <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
 <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
 <FiClock className="h-4 w-4" />
 </div>
 <h4 className="text-sm font-bold text-gray-900">Historial de Permisos</h4>
 </div>
 
 {active.permisos.items?.length ? (
 <div className="space-y-3">
 {active.permisos.items.map((item) => (
 <div key={`permiso-${item.id}`} className="group p-3 rounded-xl bg-gray-50/50 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
 <div className="flex items-center justify-between mb-1">
 <span className="font-semibold text-xs text-gray-900 capitalize">
 {item.tipo_permiso || "Permiso"}
 </span>
 <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize
 ${item.status === 'approved' ? 'bg-green-100 text-green-700' : 
 item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
 {item.status}
 </span>
 </div>
 <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
 <FiCalendar className="h-3 w-3" />
 <span>{formatDate(item.fecha_inicio)} - {formatDate(item.fecha_fin)}</span>
 </div>
 <div className="text-xs text-gray-400">
 Duración: {computePermisoDuration(item)}
 </div>
 {Array.isArray(item.justificantes_urls) && item.justificantes_urls.length > 0 && (
 <div className="mt-2 flex flex-wrap gap-2">
 {item.justificantes_urls.map((url, idx) => (
 <a
 key={`${item.id}-doc-${idx}`}
 href={url}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-blue-600 shadow-sm border border-blue-100 hover:border-blue-300 transition-colors"
 >
 <FiEye className="h-3 w-3" />
 Doc {idx + 1}
 </a>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
 No hay permisos registrados
 </div>
 )}
 </div>

 {/* Vacaciones List */}
 <div className="space-y-4">
 <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
 <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
 <FiCalendar className="h-4 w-4" />
 </div>
 <h4 className="text-sm font-bold text-gray-900">Historial de Vacaciones</h4>
 </div>

 {active.vacaciones.items?.length ? (
 <div className="space-y-3">
 {active.vacaciones.items.map((item) => (
 <div key={`vac-${item.id}`} className="group p-3 rounded-xl bg-gray-50/50 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
 <div className="flex items-center justify-between mb-1">
 <span className="font-semibold text-xs text-gray-900">
 {item.duracion_dias} días
 </span>
 <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize
 ${item.status === 'approved' ? 'bg-green-100 text-green-700' : 
 item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
 {item.status}
 </span>
 </div>
 <div className="flex items-center gap-2 text-xs text-gray-500">
 <FiCalendar className="h-3 w-3" />
 <span>{formatDate(item.fecha_inicio)} - {formatDate(item.fecha_fin)}</span>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
 No hay vacaciones registradas
 </div>
 )}
 </div>
 </div>

 {!(active.permisos.items?.length || active.vacaciones.items?.length) && (
 <div className="text-center text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-3">
 Este colaborador no ha solicitado permisos ni vacaciones.
 </div>
 )}
 </div>
 
 {/* Footer */}
 <div className={`${modalFooterPadding} border-t border-gray-100 bg-gray-50/50 flex justify-end`}>
 <Button variant="secondary" onClick={() => setActive(null)}>
 Cerrar
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default PermisosColaboradoresAlbum;
