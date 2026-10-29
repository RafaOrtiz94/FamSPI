import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
 FiPlus,
 FiEye,
 FiRefreshCw
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useAuth } from "../../../../core/auth/useAuth";
import { getRequests, getMyClientRequests } from "../../../../core/api/requestsApi";
import { getPersonnelRequests } from "../../../../core/api/personnelRequestsApi";
import { useUI } from "../../../../core/ui/UIContext";

// Importar configuraciones centralizadas
import { REQUEST_TYPES_CONFIG, getStatusColor, getStatusIcon, formatDate } from '../../config/requestConfig';

/**
 * Componente que muestra las solicitudes del usuario organizadas por tipo
 */
const UserRequestsView = ({ onCreateNew }) => {
 const { user } = useAuth();
 const { showToast } = useUI();
 const [loading, setLoading] = useState(true);
 const [requests, setRequests] = useState([]);
 const [clientRequests, setClientRequests] = useState([]);
 const [personnelRequests, setPersonnelRequests] = useState([]);

 // Cargar solicitudes del usuario
 useEffect(() => {
 const loadUserRequests = async () => {
 setLoading(true);
 try {
 // Cargar solicitudes generales del usuario
 const generalRequests = await getRequests({ mine: true, pageSize: 100 });
 setRequests(generalRequests.rows || []);

 // Cargar solicitudes de clientes del usuario
 const clientReqs = await getMyClientRequests({ pageSize: 100 });
 setClientRequests(clientReqs.rows || clientReqs || []);

 // Cargar solicitudes de personal (si aplica)
 const personnelReqs = await getPersonnelRequests({ my_requests: true, pageSize: 100 });
 setPersonnelRequests(personnelReqs?.data || personnelReqs || []);
 } catch (error) {
 console.error("Error cargando solicitudes:", error);
 showToast("Error al cargar las solicitudes", "error");
 } finally {
 setLoading(false);
 }
 };

 loadUserRequests();
 }, [showToast]);

 // Determinar configuración basada en el rol del usuario
 const roleConfig = useMemo(() => {
 const roleName = (user?.role_name || user?.role || "").toLowerCase();
 const isACP = roleName.includes('acp');
 const isJefeComercial = roleName.includes("jefe_comercial") || roleName.includes("jefe comercial");

 const baseActions = ["cliente", "compra", "credito", "permisos"];
 const acpActions = ["cliente", "compra", "credito", "permisos"];
 const fullActions = ["inspection", "retiro", ...baseActions];

 let availableActionIds = isACP ? acpActions : fullActions;
 if (isJefeComercial) {
 availableActionIds = [...fullActions, "personal"];
 }

 return {
 isACP,
 availableTypes: availableActionIds
 };
 }, [user]);

 // Organizar solicitudes por tipo
 const requestsByType = useMemo(() => {
 const organized = {
 cliente: [],
 compra: [],
 credito: [],
 inspection: [],
 retiro: [],
 permisos: [],
 personal: []
 };

 // Procesar solicitudes de clientes
 clientRequests.forEach(request => {
 organized.cliente.push({
 id: request.id,
 type: 'cliente',
 title: request.client_name || request.commercial_name || 'Cliente',
 status: request.status,
 created_at: request.created_at,
 description: `Registro de cliente: ${request.client_name || request.commercial_name}`,
 rejectionReason: request.rejection_reason || null,
 data: request
 });
 });

 // Procesar solicitudes generales -- request_type_id llega como el codigo
 // real del tipo (F.ST-19/20/21/22), no como 'compra'/'inspection'/etc.
 // El switch anterior comparaba contra esos alias en ingles, que nunca
 // coincidian, asi que todo caia al default 'compra'.
 const TYPE_CODE_MAP = {
 'F.ST-19': { type: 'compra', title: 'Requerimiento de Compra' },
 'F.ST-20': { type: 'inspection', title: 'Inspección Técnica' },
 'F.ST-21': { type: 'retiro', title: 'Retiro de Equipo' },
 'F.ST-22': { type: 'cliente', title: 'Registro de Cliente' },
    'F.VE-02': { type: 'credito', title: 'Solicitud de Credito' },
 };

 requests.forEach(request => {
 const mapped = TYPE_CODE_MAP[request.type_code] || { type: 'compra', title: request.type_title || 'Solicitud' };
 const { type, title } = mapped;
 let description = '';

 // Extraer información del payload si existe
 if (request.payload) {
 let payload = request.payload;
 if (typeof payload === 'string') {
 try {
 payload = JSON.parse(payload);
 } catch (e) {
 payload = {};
 }
 }

 if (payload.nombre_cliente || payload.client_name) {
 description = `Cliente: ${payload.nombre_cliente || payload.client_name}`;
 }
 }

 organized[type].push({
 id: request.id,
 type,
 title,
 status: request.status,
 created_at: request.created_at,
 description,
 rejectionReason: request.rejection_reason || null,
 data: request
 });
 });

 // Procesar solicitudes de personal
 personnelRequests.forEach((request) => {
 organized.personal.push({
 id: request.id,
 type: 'personal',
 title: request.position_title || 'Solicitud de personal',
 status: request.status,
 created_at: request.created_at,
 description: request.request_number
 ? `${request.request_number} · ${request.position_type || "Puesto"}`
 : request.position_type || "Puesto",
 data: request
 });
 });

 return organized;
 }, [requests, clientRequests, personnelRequests]);

 if (loading) {
 return (
 <div className="flex items-center justify-center py-12">
 <div className="flex items-center gap-3">
 <FiRefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
 <span className="text-gray-600">Cargando tus solicitudes...</span>
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-5 md:space-y-8">
 {/* Resumen general - iOS Style */}
 <Card className="p-4 sm:p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl bg-white">
 <div className="flex items-center justify-between mb-4 sm:mb-6">
 <div>
 <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Resumen de Solicitudes</h3>
 <p className="text-slate-600 mt-1 text-xs sm:text-sm">Estado de tus gestiones por tipo</p>
 </div>
 <div className="text-[11px] sm:text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-full">
 {new Date().toLocaleDateString('es-ES', { 
 day: 'numeric',
 month: 'short'
 })}
 </div>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
 {Object.entries(REQUEST_TYPES_CONFIG)
 .filter(([type]) => roleConfig.availableTypes.includes(type))
 .map(([type, config]) => {
 const requestsOfType = requestsByType[type] || [];
 const Icon = config.icon;

 return (
 <div key={type} className="group cursor-pointer text-center">
 <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${
 config.color === 'emerald' ? 'from-emerald-500 to-emerald-600' :
 config.color === 'indigo' ? 'from-indigo-500 to-indigo-600' :
 config.color === 'blue' ? 'from-blue-500 to-blue-600' :
 config.color === 'amber' ? 'from-amber-500 to-amber-600' :
 config.color === 'teal' ? 'from-teal-500 to-teal-600' :
 'from-orange-500 to-orange-600'
 } rounded-xl flex items-center justify-center shadow-md mb-2 mx-auto group-hover:${
 config.color === 'emerald' ? 'shadow-emerald-500/25' :
 config.color === 'indigo' ? 'shadow-indigo-500/25' :
 config.color === 'blue' ? 'shadow-blue-500/25' :
 config.color === 'amber' ? 'shadow-amber-500/25' :
 config.color === 'teal' ? 'shadow-teal-500/25' :
 'shadow-orange-500/25'
 } transition-shadow duration-300`}>
 <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
 </div>
 <div className="text-base sm:text-lg font-bold text-slate-900">{requestsOfType.length}</div>
 <div className="text-[11px] sm:text-xs text-slate-600 font-medium">{config.title.split(' ')[0]}</div>
 </div>
 );
 })}
 </div>
 </Card>

 {/* Solicitudes por tipo - iOS Style */}
 {Object.entries(REQUEST_TYPES_CONFIG)
 .filter(([type]) => roleConfig.availableTypes.includes(type))
 .map(([type, config]) => {
 const requestsOfType = requestsByType[type] || [];
 const Icon = config.icon;

 return (
 <Card key={type} className="border-0 shadow-xl shadow-slate-100/60 rounded-2xl overflow-hidden bg-white">
 {/* Header iOS Style */}
 <div className="p-4 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className={`w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br ${
 config.color === 'emerald' ? 'from-emerald-500 to-emerald-600' :
 config.color === 'indigo' ? 'from-indigo-500 to-indigo-600' :
 config.color === 'blue' ? 'from-blue-500 to-blue-600' :
 config.color === 'amber' ? 'from-amber-500 to-amber-600' :
 config.color === 'teal' ? 'from-teal-500 to-teal-600' :
 'from-orange-500 to-orange-600'
 } rounded-xl flex items-center justify-center shadow-md`}>
 <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
 </div>
 <div>
 <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{config.title}</h3>
 <p className="text-xs sm:text-sm text-slate-600">{requestsOfType.length} solicitudes</p>
 </div>
 </div>

 <Button
 onClick={() => onCreateNew && onCreateNew(type)}
 className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 shadow-sm hover:shadow-md transition-all duration-200"
 size="sm"
 >
 <FiPlus className="w-3.5 h-3.5" />
 <span className="text-xs sm:text-sm">Nueva</span>
 </Button>
 </div>
 </div>

 {/* Content iOS Style */}
 <div className="p-4 sm:p-6">
 {requestsOfType.length === 0 ? (
 <div className="text-center py-6 sm:py-8">
 <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-3 opacity-50" />
 <p className="text-slate-500 text-xs sm:text-sm">{config.emptyMessage}</p>
 </div>
 ) : (
 <div className="space-y-2 sm:space-y-3">
 {requestsOfType.slice(0, 5).map((request) => (
 <motion.div
 key={request.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="flex items-center justify-between p-3 sm:p-4 bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
 onClick={() => {
 // Aquí iría la lógica para ver el detalle
 console.log('Ver detalle de solicitud:', request);
 }}
 >
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 sm:gap-3 mb-2">
 <h4 className="font-semibold text-slate-900 truncate text-xs sm:text-sm">
 {request.title}
 </h4>
 <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${getStatusColor(request.status)} border border-current border-opacity-20`}>
 {getStatusIcon(request.status)}
 {request.status || 'Pendiente'}
 </div>
 </div>
 {request.description && (
 <p className="text-[11px] sm:text-xs text-slate-600 truncate mb-1">
 {request.description}
 </p>
 )}
 {request.rejectionReason && (
 <p className="text-[11px] sm:text-xs text-red-600 mb-1">
 <span className="font-semibold">Motivo de rechazo:</span> {request.rejectionReason}
 </p>
 )}
 <p className="text-[11px] sm:text-xs text-slate-500">
 {formatDate(request.created_at)}
 </p>
 </div>

 <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
 <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-600">
 <FiEye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
 </Button>
 </div>
 </motion.div>
 ))}

 {requestsOfType.length > 5 && (
 <div className="text-center pt-2">
 <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
 Ver todas ({requestsOfType.length})
 </Button>
 </div>
 )}
 </div>
 )}
 </div>
 </Card>
 );
 })}
 </div>
 );
};

export default UserRequestsView;
