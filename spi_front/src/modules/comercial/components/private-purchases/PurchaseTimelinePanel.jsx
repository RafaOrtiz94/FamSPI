import React, { useState, useEffect, useMemo } from 'react';
import { FiClock, FiCheckCircle, FiXCircle, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import { format } from 'date-fns';
import { getPrivatePurchaseTimeline } from '../../../../core/api/privatePurchasesApi';
import { formatDateEC, formatTimeEC, parseToDate } from '../../../../core/utils/dateUtils';

/**
 * PurchaseTimelinePanel - Componente para visualizar el timeline completo de una compra privada
 * Incluye eventos, decisiones, correcciones y checklist computado
 */
const PurchaseTimelinePanel = ({ requestId, compact = false }) => {
 const [expandedSections, setExpandedSections] = useState({});
 const [timelineEvents, setTimelineEvents] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const itemWidth = compact ? 'min-w-[200px] sm:min-w-[220px]' : 'min-w-[240px] sm:min-w-[280px]';
 const itemPadding = compact ? 'p-3' : 'p-4';
 const EVENT_LABELS = {
 REQUEST_CREATED: 'Solicitud creada',
 CLIENT_REGISTERED: 'Cliente registrado',
 INSPECTION_REQUESTED: 'Inspeccion de ambiente solicitada',
 RESERVATION_REQUESTED: 'Reserva solicitada al proveedor',
 OFFER_UPLOADED: 'Oferta cargada',
 SIGNED_OFFER_UPLOADED: 'Oferta firmada cargada',
 PROVIDER_RESPONSE: 'Respuesta de disponibilidad',
 CONTRACT_DRAFT_UPLOADED: 'Borrador de contrato cargado',
 CONTRACT_CLIENT_SIGNED_UPLOADED: 'Contrato firmado por cliente cargado',
 CONTRACT_SIGNED_UPLOADED: 'Contrato firmado cargado',
 ESTIMATED_ARRIVAL_SET: 'Fecha tentativa de llegada definida',
 EQUIPMENT_ARRIVED: 'Equipo recibido en operaciones',
 DELIVERY_DATES_SET: 'Fechas de entrega definidas',
 STATE_TRANSITION: 'Cambio de estado',
 CORRECTION_SUBMITTED: 'Correccion enviada',
 MANAGER_DECISION: 'Decision de gerencia'
 };

 const STATE_LABELS = {
 pending_commercial: 'Pendiente de comercial',
 pending_backoffice: 'Pendiente de backoffice',
 offer_sent: 'Oferta enviada',
 pending_manager_signature: 'Pendiente de firma de gerencia',
 pending_client_signature: 'Pendiente de firma del cliente',
 offer_signed: 'Oferta firmada',
 client_registration_requested: 'Registro de cliente solicitado',
 client_registered: 'Cliente registrado',
 inspection_requested: 'Inspeccion solicitada',
 sent_to_acp: 'Enviado a ACP',
 acp_availability_requested: 'Disponibilidad solicitada a ACP',
 acp_availability_confirmed: 'Disponibilidad confirmada por ACP',
 acp_availability_rejected: 'Disponibilidad rechazada por ACP',
 pending_contract_approval: 'Contrato pendiente de aprobacion',
 pending_contract_client_signature: 'Contrato pendiente firma cliente',
 contract_available: 'Contrato disponible',
 contract_rejected: 'Contrato rechazado',
 delivery_dates_requested: 'Fechas de entrega solicitadas',
 delivery_dates_submitted: 'Fechas de entrega definidas',
 calendar_events_created: 'Eventos de calendario creados',
 waiting_dispatch: 'En espera de despacho',
 dispatch_ready: 'Despacho listo',
 delivery_act_draft_ready: 'Acta en borrador',
 delivery_act_tech_assigned: 'Tecnico asignado',
 delivery_act_logistics_signed: 'Acta firmada por logistica',
 delivery_act_generated: 'Acta de entrega generada',
 delivered_signed: 'Entrega confirmada',
 rejected: 'Rechazado',
 business_case_in_progress: 'Caso de negocio en progreso',
 business_case_under_review: 'Caso de negocio en revision',
 business_case_feasibility_approved: 'Factibilidad aprobada',
 business_case_rejected: 'Caso de negocio rechazado'
 };

 const normalizeKey = (value) => String(value || '').trim().toUpperCase();
 const normalizeState = (value) => String(value || '').trim().toLowerCase();
 const humanizeKey = (value) => {
 const cleanValue = String(value || '').replace(/_/g, ' ').toLowerCase();
 if (!cleanValue) return 'Evento';
 return cleanValue.replace(/\b\w/g, (letter) => letter.toUpperCase());
 };
 const formatStateLabel = (state) => {
 const key = normalizeState(state);
 if (STATE_LABELS[key]) return STATE_LABELS[key];
 if (!state) return 'Sin estado';
 return humanizeKey(state);
 };

 // Fetch timeline data from API
 useEffect(() => {
 if (!requestId) return;

 const fetchTimeline = async () => {
 try {
 console.log('[FLOW_PRIVADA][FE][FASE6][TIMELINE][FETCH_START]', { requestId });
 setLoading(true);
 setError(null);

 const response = await getPrivatePurchaseTimeline(requestId);

 // Tolerant reading for schema variations
 const events = response?.events || response?.timeline || [];
 console.log('[FLOW_PRIVADA][FE][FASE6][TIMELINE][SHAPE]', {
 requestId,
 eventsCount: events.length,
 sampleEvent: events[0] ? Object.keys(events[0]) : null
 });

 setTimelineEvents(events);
 console.log('[FLOW_PRIVADA][FE][FASE6][TIMELINE][FETCH_OK]', { eventsCount: events.length });
 } catch (error) {
 console.error('[FLOW_PRIVADA][FE][FASE6][TIMELINE][FETCH_ERR]', {
 requestId,
 error: error.response?.data || error.message
 });
 setError('Error al cargar el historial');
 } finally {
 setLoading(false);
 }
 };

 fetchTimeline();
 }, [requestId]);

 // Agrupar eventos por fecha
 const groupedEvents = useMemo(() => {
 if (!timelineEvents.length) return {};

 const groups = {};
 timelineEvents.forEach(timelineEvent => {
 const parsedDate = parseToDate(timelineEvent.timestamp);
 if (!parsedDate) return;
 const date = format(parsedDate, 'yyyy-MM-dd');
 if (!groups[date]) groups[date] = [];
 groups[date].push(timelineEvent);
 });

 // Ordenar fechas descendente
 return Object.keys(groups)
 .sort((a, b) => {
 const dateA = parseToDate(a);
 const dateB = parseToDate(b);
 return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
 })
 .reduce((acc, date) => {
 acc[date] = groups[date].sort((a, b) => {
 const dateA = parseToDate(a.timestamp);
 const dateB = parseToDate(b.timestamp);
 return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
 });
 return acc;
 }, {});
 }, [timelineEvents]);

 const getEventIcon = (event) => {
 // Tolerant reading: eventType or type
 const eventType = normalizeKey(event.eventType || event.type || '');

 switch (eventType) {
 case 'CLIENT_REGISTERED':
 case 'CLIENT_APPROVED':
 return <FiCheckCircle className="w-4 h-4 text-green-500" />;
 case 'OFFER_CREATED':
 case 'OFFER_UPLOADED':
 case 'SIGNED_OFFER_UPLOADED':
 return <FiCheckCircle className="w-4 h-4 text-blue-500" />;
 case 'CONTRACT_DRAFT_UPLOADED':
 case 'CONTRACT_SIGNED_UPLOADED':
 return <FiCheckCircle className="w-4 h-4 text-purple-500" />;
 case 'CORRECTION_SUBMITTED':
 return <FiAlertTriangle className="w-4 h-4 text-orange-500" />;
 case 'MANAGER_DECISION':
 return eventType?.includes('approved') ?
 <FiCheckCircle className="w-4 h-4 text-green-600" /> :
 <FiXCircle className="w-4 h-4 text-red-500" />;
 default:
 return <FiClock className="w-4 h-4 text-gray-400" />;
 }
 };

 const toggleSection = (sectionId) => {
 setExpandedSections(prev => ({
 ...prev,
 [sectionId]: !prev[sectionId]
 }));
 };

 if (loading) {
 return (
 <div className="p-8 bg-white rounded-lg border">
 <div className="flex items-center justify-center">
 <FiRefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
 <p className="text-gray-500">Cargando historial...</p>
 </div>
 </div>
 );
 }

 if (error) {
 return (
 <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
 <p className="text-red-700 text-sm">{error}</p>
 </div>
 );
 }

 if (!timelineEvents.length) {
 return (
 <div className="p-4 bg-gray-50 rounded-lg">
 <p className="text-gray-500 text-sm">No hay eventos para mostrar</p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* Timeline */}
 <div className="bg-white rounded-lg border">
 <div className="p-4 border-b">
 <div className="flex items-center justify-between gap-4">
 <h3 className="text-lg font-semibold text-gray-900">Historial de Eventos</h3>
 <span className="hidden text-xs text-gray-500 sm:inline">Desliza para ver todo</span>
 </div>
 </div>

 <div className="p-4 space-y-6">
 {Object.entries(groupedEvents).map(([date, events]) => (
 <div key={date} className="space-y-3">
 <div className="flex items-center space-x-2">
 <div className="text-sm font-medium text-gray-900">
 {formatDateEC(date, 'Sin fecha')}
 </div>
 <div className="flex-1 h-px bg-gray-200" />
 </div>

 <div className="relative">
 <div className="absolute left-0 right-0 top-5 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
 <div className="flex gap-3 overflow-x-auto pb-4 pt-2 pr-2 snap-x snap-mandatory">
 {events.map((timelineEvent, index) => {
 // Tolerant reading for schema variations
 const eventTypeRaw = timelineEvent.eventType || timelineEvent.type || timelineEvent.event || '';
 const eventType = normalizeKey(eventTypeRaw);
 const previousState = timelineEvent.previousState || timelineEvent.oldState || timelineEvent.fromState || '';
 const newState = timelineEvent.newState || timelineEvent.nextState || timelineEvent.toState || '';
 const reason = timelineEvent.metadata?.reason || timelineEvent.reason || '';
 let eventTitle = EVENT_LABELS[eventType] || humanizeKey(eventTypeRaw);
 if (eventType === 'STATE_TRANSITION') {
 if (previousState && newState) {
 eventTitle = `Cambio de estado: ${formatStateLabel(previousState)} a ${formatStateLabel(newState)}`;
 } else if (newState) {
 eventTitle = `Nuevo estado: ${formatStateLabel(newState)}`;
 } else {
 eventTitle = EVENT_LABELS.STATE_TRANSITION;
 }
 }

 return (
 <div key={index} className={`relative snap-start ${itemWidth}`}>
 <div className="absolute left-4 top-3 h-3 w-3 rounded-full border-2 border-white bg-gray-300 shadow-sm" />
 <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${itemPadding}`}>
 <div className="flex items-start gap-2">
 <div className="mt-0.5">{getEventIcon(timelineEvent)}</div>
 <p className="text-sm font-semibold text-gray-900">
 {eventTitle}
 </p>
 </div>

 {/* Show reason for rejections */}
 {eventType === 'STATE_TRANSITION' && normalizeState(newState) === 'contract_rejected' && reason && (
 <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
 <p className="text-xs font-medium text-red-800">Motivo del rechazo:</p>
 <p className="text-sm text-red-700 mt-1">{reason}</p>
 </div>
 )}

 {/* Show reason for corrections */}
 {eventType === 'CORRECTION_SUBMITTED' && reason && (
 <div className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
 <p className="text-xs font-medium text-orange-800">Motivo de la correccion:</p>
 <p className="text-sm text-orange-700 mt-1">{reason}</p>
 </div>
 )}

 <p className="text-xs text-gray-400 mt-2">
 {formatTimeEC(timelineEvent.timestamp, '--:--')}
 </p>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
};

export default PurchaseTimelinePanel;

