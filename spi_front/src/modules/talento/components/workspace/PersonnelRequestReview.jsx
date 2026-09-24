import React, { useState } from "react";
import toast from "react-hot-toast";
import { FiClock, FiAlertCircle, FiCheckCircle, FiXCircle } from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { formatDateSafe } from "../../../../shared/utils/dateUtils";
import { updatePersonnelRequestStatus } from "../../../../core/api/personnelRequestsApi";

const PersonnelRequestReview = ({
  request,
  onRequestUpdate,
  onUpdate,
  onRequestCancel,
  onCancel,
  canApprove,
}) => {
 const { showLoader, hideLoader } = useUI();
 const [actionNotes, setActionNotes] = useState("");
 const [actionLoading, setActionLoading] = useState(false);
 const handleRequestUpdate = onRequestUpdate || onUpdate;
 const handleRequestCancel = onRequestCancel || onCancel;

 const getStatusBadge = (status) => {
 const badges = {
 pendiente: { color: "bg-yellow-100 text-yellow-800", icon: FiClock, label: "Pendiente" },
 en_revision: { color: "bg-blue-100 text-blue-800", icon: FiAlertCircle, label: "En Revisión" },
 aprobada: { color: "bg-green-100 text-green-800", icon: FiCheckCircle, label: "Aprobada" },
 rechazada: { color: "bg-red-100 text-red-800", icon: FiXCircle, label: "Rechazada" },
 en_proceso: { color: "bg-purple-100 text-purple-800", icon: FiClock, label: "En Proceso" },
 completada: { color: "bg-gray-100 text-gray-800", icon: FiCheckCircle, label: "Completada" },
 cancelada: { color: "bg-slate-200 text-slate-800", icon: FiXCircle, label: "Cancelada" },
 };

 const badge = badges[status] || badges.pendiente;
 const Icon = badge.icon;

 return (
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
 <Icon size={12} title={`Estado ${badge.label}`} />
 {badge.label}
 </span>
 );
 };

 const handleDecision = async (status) => {
 if (!request) return;
 if (status === "rechazada" && !actionNotes.trim()) {
 toast.error("Agrega un motivo para rechazar la solicitud");
 return;
 }
 setActionLoading(true);
 showLoader(status === "aprobada" ? "Aprobando solicitud de personal..." : "Rechazando solicitud de personal...");
 try {
 await updatePersonnelRequestStatus(request.id, status, actionNotes.trim() || null);
 toast.success(status === "aprobada" ? "Solicitud aprobada" : "Solicitud rechazada");
 handleRequestUpdate?.();
 } catch (error) {
 console.error("Error actualizando solicitud:", error);
 toast.error(error.response?.data?.message || "No se pudo actualizar la solicitud");
 } finally {
 hideLoader();
 setActionLoading(false);
 }
 };

 if (!request) return null;

 return (
 <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto">
 <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
 <div>
 <h2 className="text-xl font-bold text-gray-900">{request.position_title}</h2>
 <div className="mt-1 flex items-center gap-2">
 {getStatusBadge(request.status)}
 <span className="text-sm text-gray-500">
 Solicitud #{request.request_number}
 </span>
 </div>
 </div>
 <Button variant="secondary" onClick={handleRequestCancel} aria-label="Volver a la lista de solicitudes">
 Volver
 </Button>
 </div>

 <div className="space-y-6">
 {request.workflow && (
 <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
 <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado operativo de la solicitud</p>
 <p className="text-sm font-semibold text-slate-900">{request.workflow.current_stage_label}</p>
 </div>
 <div className="text-sm text-slate-700">
 Responsable: <span className="font-semibold">{request.workflow.current_responsible_name || request.workflow.current_responsible_label}</span>
 </div>
 </div>
 <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
 <div className="h-full rounded-full bg-slate-900" style={{ width: `${request.workflow.progress_percent || 0}%` }} />
 </div>
 <div className="mt-3 grid gap-3 text-xs text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
 <div className="rounded-xl bg-white px-3 py-3">
 <p className="font-semibold text-slate-500">Siguiente acción requerida</p>
 <p className="mt-1 text-sm font-medium text-slate-900">{request.workflow.next_action || "Sin acción pendiente"}</p>
 </div>
 <div className="rounded-xl bg-white px-3 py-3">
 <p className="font-semibold text-slate-500">Tiempo acumulado en la etapa</p>
 <p className="mt-1 text-sm font-medium text-slate-900">{request.workflow.elapsed_label || "N/A"}</p>
 </div>
 <div className="rounded-xl bg-white px-3 py-3">
 <p className="font-semibold text-slate-500">Fecha límite comprometida</p>
 <p className="mt-1 text-sm font-medium text-slate-900">
 {request.workflow.deadline_at ? formatDateSafe(request.workflow.deadline_at, "dd/MM/yyyy") : "Sin límite"}
 </p>
 </div>
 <div className="rounded-xl bg-white px-3 py-3">
 <p className="font-semibold text-slate-500">Estado real de la etapa</p>
 <p className={`mt-1 text-sm font-medium ${request.workflow.stalled ? "text-rose-700" : "text-emerald-700"}`}>
 {request.workflow.stalled ? `Estancada ${request.workflow.stalled_for_label || ""}`.trim() : "En curso"}
 </p>
 </div>
 </div>
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
 <div>
 <span className="block font-medium text-gray-500">Solicitante</span>
 <span className="text-gray-900">{request.requester_name || request.requester_email || "N/A"}</span>
 </div>
 <div>
 <span className="block font-medium text-gray-500">Departamento</span>
 <span className="text-gray-900">{request.department_name || "N/A"}</span>
 </div>
 <div>
 <span className="block font-medium text-gray-500">Tipo de Contratación</span>
 <span className="text-gray-900 capitalize">{request.position_type || "N/A"}</span>
 </div>
 <div>
 <span className="block font-medium text-gray-500">Vacantes</span>
 <span className="text-gray-900">{request.quantity ?? "N/A"}</span>
 </div>
 <div>
 <span className="block font-medium text-gray-500">Urgencia</span>
 <span className="text-gray-900 capitalize">{request.urgency_level || "N/A"}</span>
 </div>
 <div>
 <span className="block font-medium text-gray-500">Fecha de Creación</span>
 <span className="text-gray-900">{formatDateSafe(request.created_at)}</span>
 </div>
 </div>

 <div>
 <h3 className="font-medium text-gray-900 mb-2">Justificación de la solicitud</h3>
 <div className="bg-gray-50 p-4 rounded-md text-sm text-gray-700 whitespace-pre-wrap">
 {request.justification || "La solicitud no registra una justificación detallada."}
 </div>
 </div>

 <div>
 <h3 className="font-medium text-gray-900 mb-2">Sitio a laborar</h3>
 <div className="bg-gray-50 p-4 rounded-md text-sm text-gray-700">
 <span className="font-medium">Ciudad:</span> {request.work_location || "N/A"}
 </div>
 </div>

 {canApprove && (request.status === "pendiente" || request.status === "en_revision") && (
 <div className="border-t border-gray-200 pt-6">
 <h3 className="font-medium text-gray-900 mb-4">Dictamen formal de Gerencia</h3>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Observaciones de aprobación o motivo de rechazo
 </label>
 <textarea
 className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
 rows={3}
 value={actionNotes}
 onChange={(e) => setActionNotes(e.target.value)}
 placeholder="Detalla la observacion que respalda la aprobacion o explica el motivo del rechazo"
 />
 </div>
 <div className="flex justify-end gap-3">
 <Button
 variant="danger"
 onClick={() => handleDecision("rechazada")}
 disabled={actionLoading}
 aria-label="Rechazar solicitud de personal"
 >
 Rechazar
 </Button>
 <Button
 variant="primary"
 onClick={() => handleDecision("aprobada")}
 disabled={actionLoading}
 aria-label="Aprobar solicitud de personal"
 >
 Aprobar Solicitud
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

export default PersonnelRequestReview;
