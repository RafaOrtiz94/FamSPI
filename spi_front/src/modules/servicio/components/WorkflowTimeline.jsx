import React, { useEffect, useMemo, useState } from "react";
import { FiClock, FiRefreshCw } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import { getWorkflowRegistry, getWorkflowTimeline } from "../../../core/api/servicioApi";
import { formatDateTimeEs, getStatusBadgeClass, toStatusLabel } from "../../../core/utils/workflowUi";

const getStatusColor = (status) => {
 return getStatusBadgeClass(status, {
  success: ["completed", "done", "closed"],
  warning: ["blocked", "in_progress", "pending", "review"],
  error: ["cancelled", "error", "failed"],
 });
};

const getEventLabel = (eventType) => {
 const value = String(eventType || "").toLowerCase();
 if (value === "document_generated") return "Documento generado";
 if (value === "workflow_upserted") return "Workflow actualizado";
 if (value === "template_incompatibility_detected") return "Incompatibilidad de plantilla";
 return toStatusLabel(value, "Evento");
};

const WorkflowTimeline = ({ sourceType, sourceId, procedureCode = "ST-01-01" }) => {
 const [workflow, setWorkflow] = useState(null);
 const [timeline, setTimeline] = useState([]);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");

 const loadData = async () => {
 if (!sourceType || !sourceId) return;
 setLoading(true);
 setError("");
 try {
 const [workflowRow, timelineRows] = await Promise.all([
 getWorkflowRegistry({ source_type: sourceType, source_id: sourceId, procedure_code: procedureCode }),
 getWorkflowTimeline({ source_type: sourceType, source_id: sourceId, procedure_code: procedureCode, limit: 50 }),
 ]);
 setWorkflow(workflowRow || null);
 setTimeline(Array.isArray(timelineRows) ? timelineRows : []);
 } catch (err) {
 setError(err?.message || "No se pudo cargar el timeline del workflow");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadData();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [sourceType, sourceId, procedureCode]);

 const topEvents = useMemo(() => timeline.slice(0, 8), [timeline]);

 return (
 <Card className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
 <div className="flex items-center justify-between gap-2">
 <div>
 <p className="text-xs uppercase tracking-wide text-slate-500">Timeline del workflow</p>
 <h4 className="text-sm font-semibold text-slate-900">{procedureCode}</h4>
 </div>
 <Button size="sm" variant="secondary" icon={FiRefreshCw} onClick={loadData} loading={loading}>
 Recargar
 </Button>
 </div>

 <div className="mt-2 flex flex-wrap gap-2">
 <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
 Etapa: {workflow?.current_stage || "N/D"}
 </span>
 <span className={`rounded-full px-2 py-0.5 text-xs ${getStatusColor(workflow?.global_status)}`}>
 Estado: {toStatusLabel(workflow?.global_status, "N/D")}
 </span>
 {workflow?.request_id ? (
 <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
 Request #{workflow.request_id}
 </span>
 ) : null}
 </div>

 {error ? (
 <p className="mt-2 text-xs text-rose-700">{error}</p>
 ) : topEvents.length === 0 ? (
 <p className="mt-2 text-xs text-slate-500">No hay eventos de timeline para este workflow.</p>
 ) : (
 <div className="mt-3 space-y-2">
 {topEvents.map((event) => (
 <div key={event.id} className="rounded-lg border border-slate-200 px-2 py-2">
 <div className="flex items-center justify-between gap-2">
 <p className="text-xs font-medium text-slate-900">{getEventLabel(event.event_type)}</p>
 <span className="inline-flex items-center gap-1 text-xs text-slate-500">
 <FiClock size={12} />
 {formatDateTimeEs(event.event_at, "N/D")}
 </span>
 </div>
 <p className="mt-1 text-xs text-slate-600">
 Etapa: {event.stage_key || "N/D"} · Actor: {event.actor_email || "sistema"}
 </p>
 </div>
 ))}
 </div>
 )}
 </Card>
 );
};

export default WorkflowTimeline;
