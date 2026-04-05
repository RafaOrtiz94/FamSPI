import React from "react";
import { FiClock, FiFileText, FiMessageSquare, FiRefreshCw } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { formatDateTimeEs } from "../../../core/utils/workflowUi";

const iconByType = {
 event: FiClock,
 comment: FiMessageSquare,
 evidence: FiFileText,
};

const labelByType = {
 event: "Evento",
 comment: "Comentario",
 evidence: "Evidencia",
};

const CorrectiveCaseTimeline = ({ rows = [], loading = false, onRefresh }) => (
 <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="flex items-center justify-between gap-2">
 <div>
 <h4 className="text-sm font-semibold text-slate-900">Timeline del caso</h4>
 <p className="text-xs text-slate-500">Historial técnico, comentarios y evidencias</p>
 </div>
 <Button
 size="sm"
 variant="secondary"
 icon={FiRefreshCw}
 loading={loading}
 onClick={onRefresh}
 >
 Recargar
 </Button>
 </div>

 {rows.length === 0 ? (
 <p className="mt-3 text-xs text-slate-500">No hay entradas en el timeline.</p>
 ) : (
 <div className="mt-3 space-y-2">
 {rows.map((row) => {
 const Icon = iconByType[row.entry_type] || FiClock;
 const label = labelByType[row.entry_type] || row.entry_type || "Registro";
 const evidenceUrl = row?.payload?.evidence_ref || null;
 return (
 <div
 key={row.id}
 className="rounded-xl border border-slate-200 bg-white px-3 py-2"
 >
 <div className="flex items-center justify-between gap-2">
 <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800">
 <Icon size={14} />
 {label}: {row.label}
 </p>
 <span className="text-xs text-slate-500">{formatDateTimeEs(row.created_at, "N/D")}</span>
 </div>
 {row.description ? (
 <p className="mt-1 text-xs text-slate-600">{row.description}</p>
 ) : null}
 <p className="mt-1 text-[11px] text-slate-500">
 Actor: {row.actor_name || row.actor_email || "Sistema"}
 </p>
 {row.entry_type === "evidence" && evidenceUrl ? (
 <a
 href={evidenceUrl}
 target="_blank"
 rel="noreferrer"
 className="mt-1 inline-flex text-[11px] font-semibold text-blue-700 underline"
 >
 Abrir evidencia
 </a>
 ) : null}
 </div>
 );
 })}
 </div>
 )}
 </Card>
);

export default CorrectiveCaseTimeline;
