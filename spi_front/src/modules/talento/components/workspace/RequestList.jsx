import React from "react";

const STATUS_VARIANTS = {
 completada: "bg-emerald-100 text-emerald-700",
 en_proceso: "bg-indigo-100 text-indigo-700",
 aprobada: "bg-blue-100 text-blue-700",
 pendiente: "bg-yellow-100 text-yellow-700",
 en_revision: "bg-sky-100 text-sky-700",
 rechazada: "bg-rose-100 text-rose-700",
 cancelada: "bg-slate-200 text-slate-700",
};

const STATUS_LABELS = {
 pendiente: "Pendiente",
 en_revision: "En revisión",
 aprobada: "Aprobada",
 en_proceso: "En proceso",
 completada: "Completada",
 rechazada: "Rechazada",
 cancelada: "Cancelada",
};

const RequestList = ({ requests, selectedRequestId, onSelect }) => {
 if (requests.length === 0) {
 return (
 <div className="p-4 text-center text-sm text-gray-500">
 No hay solicitudes disponibles.
 </div>
 );
 }

 return (
 <div className="space-y-2 p-2">
 {requests.map((request) => (
 <button
 key={request.id}
 onClick={() => onSelect(request)}
 className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition ${
 String(request.id) === String(selectedRequestId)
 ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400"
 : "border-gray-200 hover:bg-gray-50"
 }`}
 >
 <div className="flex items-center justify-between gap-2">
 <p className="font-semibold text-gray-900 truncate">
 {request.position_title}
 </p>
 <span
 className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
 STATUS_VARIANTS[request.status] || "bg-slate-100 text-slate-700"
 }`}
 >
 {STATUS_LABELS[request.status] || "En seguimiento"}
 </span>
 </div>
 <p className="text-xs text-gray-500 mt-1">{request.request_number}</p>
 <p className="text-[11px] text-gray-400 mt-0.5 truncate">
 {request.department_name || "N/A"}
 </p>
 {request.workflow && (
 <div className="mt-2 flex flex-wrap gap-1">
 <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
 {request.workflow.current_stage_label}
 </span>
 <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
 request.workflow.stalled
 ? "bg-rose-100 text-rose-700"
 : "bg-emerald-100 text-emerald-700"
 }`}>
 {request.workflow.stalled ? "Estancada" : request.workflow.elapsed_label || "En curso"}
 </span>
 </div>
 )}
 </button>
 ))}
 </div>
 );
};

export default RequestList;
