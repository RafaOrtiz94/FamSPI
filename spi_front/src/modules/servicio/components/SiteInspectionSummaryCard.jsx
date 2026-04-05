import React from "react";

const formatDateEs = (value) => {
 const raw = String(value || "").trim();
 if (!raw) return "Pendiente";
 const date = new Date(raw);
 if (Number.isNaN(date.getTime())) return "Pendiente";
 const yyyy = String(date.getUTCFullYear());
 const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
 const dd = String(date.getUTCDate()).padStart(2, "0");
 return `${dd}/${mm}/${yyyy}`;
};

const SiteInspectionSummaryCard = ({
 result = "compliant",
 scheduledDate = "",
 followUpDate = "",
 answeredCount = 0,
 totalCount = 0,
 pendingCount = 0,
 reinspectionPending = false,
}) => {
 const statusText =
 result === "compliant"
 ? "Sitio conforme"
 : reinspectionPending
 ? "No conforme · Reinspección requerida"
 : "No conforme";
 const statusClass =
 result === "compliant" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";

 return (
 <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Resumen F.ST-07</p>
 <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>{statusText}</span>
 </div>
 <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-600 md:grid-cols-2">
 <p>Fecha de inspección: <span className="font-medium text-slate-800">{formatDateEs(scheduledDate)}</span></p>
 <p>Fecha reinspección: <span className="font-medium text-slate-800">{formatDateEs(followUpDate)}</span></p>
 <p>Respuestas checklist: <span className="font-medium text-slate-800">{answeredCount}/{totalCount}</span></p>
 <p>Ítems pendientes: <span className="font-medium text-slate-800">{pendingCount}</span></p>
 </div>
 </div>
 );
};

export default SiteInspectionSummaryCard;
