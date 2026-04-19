import React, { useMemo } from "react";
import { FiCalendar, FiCheck, FiClock, FiMapPin, FiX, FiInfo } from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";
import { formatDateEC } from "../../../../core/utils/dateUtils";

const groupByDate = (visits = []) => {
 return visits.reduce((acc, visit) => {
 const key = visit.planned_date || "sin_fecha";
 if (!acc[key]) acc[key] = [];
 acc[key].push(visit);
 return acc;
 }, {});
};

const formatTime = (value) => {
 if (!value) return "?";
 try {
 return new Date(value).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
 } catch (error) {
 return value;
 }
};

const visitStatusLabel = (status) => {
 const labels = {
 visited: "Cumplida",
 pending: "Pendiente",
 skipped: "No cumplida",
 in_visit: "En visita",
 };
 return labels[status] || "Sin estado";
};

const hasVisitDetails = (visit) =>
 Boolean(
 visit?.hora_entrada ||
 visit?.hora_salida ||
 visit?.lat_entrada ||
 visit?.lng_entrada ||
 visit?.lat_salida ||
 visit?.lng_salida ||
 visit?.observaciones
 );

const ScheduleDetailModal = ({
 schedule,
 onApprove,
 onReject,
 approveLoading = false,
 rejectLoading = false,
 actionsDisabled = false,
}) => {
 const grouped = useMemo(() => groupByDate(schedule?.visits || []), [schedule]);
 const totalCities = useMemo(() => new Set((schedule?.visits || []).map((v) => v.city).filter(Boolean)).size, [schedule]);

 return (
 <div className="space-y-4">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-xs text-gray-500">Asesor</p>
 <p className="text-base font-semibold text-gray-900">{schedule.user_name || schedule.user_email}</p>
 <p className="text-sm text-gray-600 flex items-center gap-2">
 <FiCalendar className="text-blue-600" /> Mes {schedule.month} / {schedule.year}
 </p>
 <p className="text-xs text-gray-500 mt-1">
 Enviado: {schedule.submitted_at ? new Date(schedule.submitted_at).toLocaleString("es-EC") : "?"}
 </p>
 <p className="text-xs text-gray-500">
 Aprobado por: {schedule.reviewed_by_email || "?"} ? {schedule.reviewed_at ? new Date(schedule.reviewed_at).toLocaleString("es-EC") : "?"}
 </p>
 </div>
 <div className="flex gap-2">
 {onApprove && schedule.status === "pending_approval" && (
 <Button
 size="sm"
 variant="success"
 icon={FiCheck}
 onClick={onApprove}
 loading={approveLoading}
 disabled={actionsDisabled && !approveLoading}
 >
 Aprobar
 </Button>
 )}
 {onReject && schedule.status === "pending_approval" && (
 <Button
 size="sm"
 variant="danger"
 icon={FiX}
 onClick={onReject}
 loading={rejectLoading}
 disabled={actionsDisabled && !rejectLoading}
 >
 Rechazar
 </Button>
 )}
 </div>
 </div>

 <div className="grid grid-cols-2 gap-3 text-sm">
 <div className="p-3 rounded-lg bg-blue-50 text-blue-900">
 <p className="text-xs uppercase tracking-wide">Visitas</p>
 <p className="text-xl font-semibold">{schedule.visits_count || schedule.visits?.length || 0}</p>
 </div>
 <div className="p-3 rounded-lg bg-purple-50 text-purple-900">
 <p className="text-xs uppercase tracking-wide">Ciudades</p>
 <p className="text-xl font-semibold">{totalCities}</p>
 </div>
 </div>

 {schedule.general_justification && (
 <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
 <p className="font-semibold flex items-center gap-2">
 <FiInfo className="text-amber-600" /> Justificación general del mes:
 </p>
 <p className="mt-1 text-gray-700">{schedule.general_justification}</p>
 </div>
 )}

 <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
 {Object.entries(grouped).map(([date, visits]) => (
 <div key={date} className="border border-gray-100 rounded-lg p-3">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
 <FiCalendar className="text-gray-500" /> {date === "sin_fecha" ? "Fecha no disponible" : formatDateEC(date)}
 </p>
 <span className="text-xs text-gray-500">{visits.length} visitas</span>
 </div>
 <div className="space-y-3">
 {visits.map((visit) => (
 <div key={visit.id} className="rounded-lg border border-gray-100 p-3 text-sm text-gray-700">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <FiMapPin className="text-gray-400" />
 <div>
 <p className="font-semibold text-gray-900">{visit.client_name || `Cliente ${visit.client_request_id}`}</p>
 <p className="text-xs text-gray-500">{visit.city || "Ciudad no especificada"}</p>
 </div>
 </div>
 <div className="flex items-center gap-2 text-xs">
 <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
 Prioridad {visit.priority || 1}
 </span>
 <span
 className={`px-2 py-1 rounded-full ${
 visit.visit_status === "visited"
 ? "bg-emerald-100 text-emerald-700"
 : visit.visit_status === "skipped"
 ? "bg-rose-100 text-rose-700"
 : visit.visit_status === "in_visit"
 ? "bg-amber-100 text-amber-700"
 : "bg-slate-100 text-slate-600"
 }`}
 >
 {visitStatusLabel(visit.visit_status)}
 </span>
 </div>
 </div>

 <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
 <div className="flex items-center gap-2">
 <FiClock className="text-gray-400" />
 <span>Entrada: {formatTime(visit.hora_entrada)}</span>
 </div>
 <div className="flex items-center gap-2">
 <FiClock className="text-gray-400" />
 <span>Salida: {formatTime(visit.hora_salida)}</span>
 </div>
 <div className="flex items-center gap-2">
 <FiMapPin className="text-gray-400" />
 <span>
 Ubicacion entrada: {visit.lat_entrada && visit.lng_entrada ? `${visit.lat_entrada}, ${visit.lng_entrada}` : "Sin registro"}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <FiMapPin className="text-gray-400" />
 <span>
 Ubicacion salida: {visit.lat_salida && visit.lng_salida ? `${visit.lat_salida}, ${visit.lng_salida}` : "Sin registro"}
 </span>
 </div>
 </div>

 <div className="mt-2 text-xs text-gray-600">
 Observaciones: {visit.observaciones || "Sin observaciones"}
 {!hasVisitDetails(visit) && (
 <span className="ml-2 text-[10px] text-amber-600">Sin detalles de visita</span>
 )}
 </div>

 {visit.justification && (
 <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
 <p className="font-semibold text-amber-800">Justificación del asesor:</p>
 <p className="text-gray-700">{visit.justification}</p>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>

 <div className="border border-gray-100 rounded-lg p-3">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
 <FiMapPin className="text-gray-500" /> Visitas inesperadas
 </p>
 <span className="text-xs text-gray-500">
 {(schedule.unexpected_visits || []).length +
 (schedule.unexpected_client_visits || []).length}{" "}
 registros
 </span>
 </div>
 {!(schedule.unexpected_visits || []).length &&
 !(schedule.unexpected_client_visits || []).length ? (
 <p className="text-xs text-gray-500">No hay visitas inesperadas registradas.</p>
 ) : (
 <div className="space-y-2">
 {(schedule.unexpected_client_visits || []).map((visit) => (
 <div key={`client-${visit.id}`} className="rounded-lg border border-gray-100 p-3 text-xs text-gray-700">
 <div className="flex items-center justify-between">
 <p className="font-semibold text-gray-900">
 {visit.client_name || `Cliente ${visit.client_request_id}`}
 </p>
 <span className="text-[10px] text-gray-500">
 {visit.visit_date ? formatDateEC(visit.visit_date) : "Fecha no disponible"}
 </span>
 </div>
 <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
 <div className="flex items-center gap-2">
 <FiClock className="text-gray-400" />
 <span>Entrada: {formatTime(visit.hora_entrada)}</span>
 </div>
 <div className="flex items-center gap-2">
 <FiClock className="text-gray-400" />
 <span>Salida: {formatTime(visit.hora_salida)}</span>
 </div>
 <div className="flex items-center gap-2">
 <FiMapPin className="text-gray-400" />
 <span>
 Ubicacion entrada: {visit.lat_entrada && visit.lng_entrada ? `${visit.lat_entrada}, ${visit.lng_entrada}` : "Sin registro"}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <FiMapPin className="text-gray-400" />
 <span>
 Ubicacion salida: {visit.lat_salida && visit.lng_salida ? `${visit.lat_salida}, ${visit.lng_salida}` : "Sin registro"}
 </span>
 </div>
 </div>
 <div className="mt-2 text-[11px] text-gray-600">
 Estado: {visitStatusLabel(visit.status)} · Observaciones: {visit.observaciones || "Sin observaciones"}
 </div>
 </div>
 ))}
 {schedule.unexpected_visits.map((visit) => (
 <div key={visit.id} className="rounded-lg border border-gray-100 p-3 text-xs text-gray-700">
 <div className="flex items-center justify-between">
 <p className="font-semibold text-gray-900">{visit.prospect_name}</p>
 <span className="text-[10px] text-gray-500">
 {visit.visit_date ? formatDateEC(visit.visit_date) : "Fecha no disponible"}
 </span>
 </div>
 <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
 <div className="flex items-center gap-2">
 <FiClock className="text-gray-400" />
 <span>Entrada: {formatTime(visit.check_in_time)}</span>
 </div>
 <div className="flex items-center gap-2">
 <FiClock className="text-gray-400" />
 <span>Salida: {formatTime(visit.check_out_time)}</span>
 </div>
 <div className="flex items-center gap-2">
 <FiMapPin className="text-gray-400" />
 <span>
 Ubicacion entrada: {visit.check_in_lat && visit.check_in_lng ? `${visit.check_in_lat}, ${visit.check_in_lng}` : "Sin registro"}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <FiMapPin className="text-gray-400" />
 <span>
 Ubicacion salida: {visit.check_out_lat && visit.check_out_lng ? `${visit.check_out_lat}, ${visit.check_out_lng}` : "Sin registro"}
 </span>
 </div>
 </div>
 <div className="mt-2 text-[11px] text-gray-600">
 Observaciones: {visit.observations || "Sin observaciones"}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
};

export default ScheduleDetailModal;
