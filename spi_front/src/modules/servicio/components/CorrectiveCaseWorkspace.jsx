import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
 FiActivity,
 FiAlertTriangle,
 FiCheckCircle,
 FiClipboard,
 FiMessageSquare,
 FiPlus,
 FiRefreshCw,
 FiSend,
 FiTool,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";
import { useAuth } from "../../../core/auth/AuthContext";
import {
 addCorrectiveCaseComment,
 createCorrectiveCase,
 getCorrectiveCaseDetail,
 getCorrectiveCaseTimeline,
 getCorrectiveCasesWorkspaceKpi,
 listCorrectiveCaseComments,
 listCorrectiveCasesWorkspace,
 runCorrectiveCaseAction,
} from "../../../core/api/servicioApi";
import CorrectiveCaseTimeline from "./CorrectiveCaseTimeline";
import PartQuotationPanel from "./PartQuotationPanel";

const roleTokens = (user) =>
 Array.from(
 new Set(
 [user?.role, user?.scope, user?.role_name, ...(user?.roles || []), ...(user?.scopes || [])]
 .flat()
 .map((value) => String(value || "").trim().toLowerCase())
 .filter(Boolean),
 ),
 );

const isAny = (tokens, roles) => roles.some((role) => tokens.includes(role));

const labelStatus = (status) =>
 String(status || "")
 .replaceAll("_", " ")
 .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusChip = (status) => {
 const normalized = String(status || "").toLowerCase();
 if (["closed"].includes(normalized)) return "bg-emerald-100 text-emerald-700";
 if (["cancelled", "parts_rejected"].includes(normalized)) return "bg-rose-100 text-rose-700";
 if (
 ["parts_pending_quote", "parts_pending_client_approval", "pending_disinfection"].includes(normalized)
 ) {
 return "bg-amber-100 text-amber-700";
 }
 return "bg-slate-100 text-slate-700";
};

const formatDate = (value) => {
 if (!value) return "N/D";
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "N/D";
 return date.toLocaleString("es-EC");
};

const initialCreateForm = {
 problem_summary: "",
 problem_detail: "",
 client_name: "",
 equipment_name: "",
 equipment_serial: "",
 client_segment: "C",
 priority: "media",
 ceac_exception_authorized: false,
 ceac_exception_reason: "",
};

const CorrectiveCaseWorkspace = () => {
 const { showToast } = useUI();
 const { user } = useAuth();
 const [rows, setRows] = useState([]);
 const [kpi, setKpi] = useState({});
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState(false);
 const [filters, setFilters] = useState({
 status: "",
 q: "",
 });
 const [selectedId, setSelectedId] = useState(null);
 const [selectedCase, setSelectedCase] = useState(null);
 const [timeline, setTimeline] = useState([]);
 const [comments, setComments] = useState([]);
 const [newComment, setNewComment] = useState("");
 const [commentVisibility, setCommentVisibility] = useState("internal");
 const [showCreate, setShowCreate] = useState(false);
 const [createForm, setCreateForm] = useState(initialCreateForm);

 const tokens = useMemo(() => roleTokens(user), [user]);
 const canCeac = useMemo(
 () => isAny(tokens, ["ceac", "ti", "jefe_ti", "admin_ti", "servicio_tecnico", "jefe_tecnico", "jefe_servicio_tecnico"]),
 [tokens],
 );
 const canDispatcher = useMemo(
 () => isAny(tokens, ["dispatcher", "jefe_tecnico", "jefe_servicio_tecnico", "servicio_tecnico"]),
 [tokens],
 );
 const canTech = useMemo(
 () => isAny(tokens, ["tecnico", "servicio_tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "ingeniero", "especialista_aplicaciones"]),
 [tokens],
 );
 const canCommercial = useMemo(
 () => isAny(tokens, ["comercial", "jefe_comercial", "backoffice_comercial", "acp_comercial"]),
 [tokens],
 );

 const loadWorkspace = useCallback(async () => {
 setLoading(true);
 try {
 const params = {
 status: filters.status || undefined,
 q: filters.q || undefined,
 };
 const [list, kpiData] = await Promise.all([
 listCorrectiveCasesWorkspace(params),
 getCorrectiveCasesWorkspaceKpi(params),
 ]);
 setRows(Array.isArray(list) ? list : []);
 setKpi(kpiData || {});
 if (!selectedId && Array.isArray(list) && list.length > 0) {
 setSelectedId(list[0].id);
 }
 if (selectedId && !list.some((item) => Number(item.id) === Number(selectedId))) {
 setSelectedId(list[0]?.id || null);
 }
 } catch (error) {
 showToast(error?.response?.data?.error || "No se pudo cargar workspace correctivo", "error");
 } finally {
 setLoading(false);
 }
 }, [filters.q, filters.status, selectedId, showToast]);

 const loadCaseDetail = useCallback(
 async (caseId) => {
 if (!caseId) {
 setSelectedCase(null);
 setTimeline([]);
 setComments([]);
 return;
 }
 setBusy(true);
 try {
 const [detail, timelineRows, commentRows] = await Promise.all([
 getCorrectiveCaseDetail(caseId),
 getCorrectiveCaseTimeline(caseId),
 listCorrectiveCaseComments(caseId),
 ]);
 setSelectedCase(detail || null);
 setTimeline(Array.isArray(timelineRows) ? timelineRows : []);
 setComments(Array.isArray(commentRows) ? commentRows : []);
 } catch (error) {
 showToast(error?.response?.data?.error || "No se pudo cargar detalle del caso", "error");
 } finally {
 setBusy(false);
 }
 },
 [showToast],
 );

 useEffect(() => {
 loadWorkspace();
 }, [loadWorkspace]);

 useEffect(() => {
 loadCaseDetail(selectedId);
 }, [loadCaseDetail, selectedId]);

 const executeAction = useCallback(
 async (action, payload = {}) => {
 if (!selectedId) return;
 setBusy(true);
 try {
 await runCorrectiveCaseAction(selectedId, { action, ...payload });
 await Promise.all([loadWorkspace(), loadCaseDetail(selectedId)]);
 showToast("Acción correctiva registrada", "success");
 } catch (error) {
 showToast(error?.response?.data?.error || "No se pudo ejecutar la acción", "error");
 } finally {
 setBusy(false);
 }
 },
 [loadCaseDetail, loadWorkspace, selectedId, showToast],
 );

 const handleCreateCase = async () => {
 if (!createForm.problem_summary.trim() || !createForm.problem_detail.trim()) {
 showToast("Completa el resumen y detalle del problema", "warning");
 return;
 }
 setBusy(true);
 try {
 const created = await createCorrectiveCase(createForm);
 setShowCreate(false);
 setCreateForm(initialCreateForm);
 await loadWorkspace();
 if (created?.id) {
 setSelectedId(created.id);
 await loadCaseDetail(created.id);
 }
 showToast("Caso correctivo creado en CEAC", "success");
 } catch (error) {
 showToast(error?.response?.data?.error || "No se pudo crear caso correctivo", "error");
 } finally {
 setBusy(false);
 }
 };

 const submitComment = async () => {
 if (!selectedId || !newComment.trim()) return;
 setBusy(true);
 try {
 await addCorrectiveCaseComment(selectedId, {
 message: newComment,
 visibility: commentVisibility,
 });
 setNewComment("");
 const list = await listCorrectiveCaseComments(selectedId);
 setComments(Array.isArray(list) ? list : []);
 showToast("Comentario registrado", "success");
 } catch (error) {
 showToast(error?.response?.data?.error || "No se pudo registrar comentario", "error");
 } finally {
 setBusy(false);
 }
 };

 const runCeacDiagnosis = async () => {
 const notes = window.prompt("Diagnóstico CEAC");
 if (!notes) return;
 await executeAction("ceac_diagnosis", { notes });
 };

 const runResolveRemote = async () => {
 const notes = window.prompt("Notas de resolución remota");
 if (!notes) return;
 const technicalBasis = window.prompt("Base técnica (manual/proveedor/referencia)");
 if (!technicalBasis) return;
 await executeAction("resolve_remote", {
 resolution_notes: notes,
 technical_basis: technicalBasis,
 });
 };

 const runEscalate = async () => {
 const reason = window.prompt("Motivo de escalamiento a dispatcher");
 if (!reason) return;
 await executeAction("escalate_dispatch", { reason });
 };

 const runClassify = async (classification) => {
 const specialistIdText = window.prompt(
 "ID de usuario del especialista asignado (opcional para software/LIS)",
 );
 const specialistRole = window.prompt("Rol del asignado (ej: especialista_aplicaciones, ingeniero)");
 if (classification === "software_lis") {
 const provider = window.prompt("Proveedor / Ingeniero de proveedor");
 if (!provider) return;
 await executeAction("classify_case", {
 classification,
 provider_name: provider,
 provider_case_reference: window.prompt("Referencia de caso proveedor") || undefined,
 assigned_specialist_user_id: specialistIdText ? Number(specialistIdText) : undefined,
 assigned_specialist_role: specialistRole || undefined,
 });
 return;
 }
 await executeAction("classify_case", {
 classification,
 assigned_specialist_user_id: specialistIdText ? Number(specialistIdText) : undefined,
 assigned_specialist_role: specialistRole || undefined,
 });
 };

 const runDispatchMilestone = async (milestone) => {
 const notes = window.prompt(`Notas para milestone ${milestone}`) || "";
 const payload = { milestone, notes };
 if (milestone === "dispatch") {
 const date = window.prompt("Fecha y hora de visita (ISO o formato local)");
 if (date) payload.scheduled_visit_at = date;
 }
 await executeAction("register_dispatch_milestone", payload);
 };

 const runScheduleRevisit = async () => {
 const visitDate = window.prompt("Fecha/hora nueva visita para cambio de parte");
 if (!visitDate) return;
 const wo = window.prompt("WO para nueva visita (opcional)") || "";
 await executeAction("schedule_revisit", {
 scheduled_visit_at: visitDate,
 work_order_number: wo || undefined,
 });
 };

 const runCloseCase = async () => {
 const closeReason = window.prompt("Causal de cierre");
 if (!closeReason) return;
 const resultSummary = window.prompt("Resumen de resultado final");
 if (!resultSummary) return;
 await executeAction("close_case", {
 close_reason: closeReason,
 result_summary: resultSummary,
 });
 };

 const runLinkFst02 = async () => {
 const customId = window.prompt("ID archivo F.ST-02 (opcional, vacío = buscar último)");
 await executeAction("link_disinfection_fst02", {
 fst02_file_id: customId || undefined,
 });
 };

 const runAddEvidence = async () => {
 const ref = window.prompt("URL o referencia de evidencia");
 if (!ref) return;
 const note = window.prompt("Nota de evidencia (opcional)") || "";
 await executeAction("add_evidence", {
 evidence_ref: ref,
 note,
 });
 };

 return (
 <div className="space-y-4">
 <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
 <FiTool />
 Correctivos ST-01-03 (CEAC + Dispatcher)
 </h3>
 <p className="text-xs text-slate-600">
 Gestión formal del caso: triage CEAC, escalamiento, clasificación técnica, repuestos y cierre trazable.
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <Button size="sm" variant="secondary" icon={FiRefreshCw} loading={loading} onClick={loadWorkspace}>
 Recargar
 </Button>
 <Button size="sm" icon={FiPlus} onClick={() => setShowCreate((prev) => !prev)}>
 {showCreate ? "Ocultar formulario" : "Nuevo caso correctivo"}
 </Button>
 </div>
 </div>
 <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
 <div className="rounded-xl border border-slate-200 p-2"><p className="text-[11px] text-slate-500">Total</p><p className="text-lg font-bold text-slate-900">{kpi.total || 0}</p></div>
 <div className="rounded-xl border border-slate-200 p-2"><p className="text-[11px] text-slate-500">Cola CEAC</p><p className="text-lg font-bold text-slate-900">{kpi.ceac_queue || 0}</p></div>
 <div className="rounded-xl border border-slate-200 p-2"><p className="text-[11px] text-slate-500">Dispatcher</p><p className="text-lg font-bold text-slate-900">{kpi.dispatch_queue || 0}</p></div>
 <div className="rounded-xl border border-amber-200 bg-amber-50 p-2"><p className="text-[11px] text-amber-700">Repuestos pendientes</p><p className="text-lg font-bold text-amber-900">{kpi.spare_parts_pending || 0}</p></div>
 <div className="rounded-xl border border-rose-200 bg-rose-50 p-2"><p className="text-[11px] text-rose-700">SLA vencidos</p><p className="text-lg font-bold text-rose-900">{(kpi.response_overdue || 0) + (kpi.resolution_overdue || 0)}</p></div>
 </div>
 </Card>

 {showCreate ? (
 <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <h4 className="text-sm font-semibold text-slate-900">Nuevo caso correctivo</h4>
 <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
 <input
 value={createForm.problem_summary}
 onChange={(event) => setCreateForm((prev) => ({ ...prev, problem_summary: event.target.value }))}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 placeholder="Resumen del problema"
 />
 <input
 value={createForm.client_name}
 onChange={(event) => setCreateForm((prev) => ({ ...prev, client_name: event.target.value }))}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 placeholder="Cliente"
 />
 <input
 value={createForm.equipment_name}
 onChange={(event) => setCreateForm((prev) => ({ ...prev, equipment_name: event.target.value }))}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 placeholder="Equipo"
 />
 <input
 value={createForm.equipment_serial}
 onChange={(event) => setCreateForm((prev) => ({ ...prev, equipment_serial: event.target.value }))}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 placeholder="Serie"
 />
 <select
 value={createForm.client_segment}
 onChange={(event) => setCreateForm((prev) => ({ ...prev, client_segment: event.target.value }))}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 >
 <option value="A">Segmento A</option>
 <option value="B">Segmento B</option>
 <option value="C">Segmento C</option>
 </select>
 <select
 value={createForm.priority}
 onChange={(event) => setCreateForm((prev) => ({ ...prev, priority: event.target.value }))}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 >
 <option value="critica">Prioridad crítica</option>
 <option value="alta">Prioridad alta</option>
 <option value="media">Prioridad media</option>
 <option value="baja">Prioridad baja</option>
 </select>
 <textarea
 rows={3}
 value={createForm.problem_detail}
 onChange={(event) => setCreateForm((prev) => ({ ...prev, problem_detail: event.target.value }))}
 className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-xs"
 placeholder="Detalle técnico del problema"
 />
 <label className="md:col-span-2 inline-flex items-center gap-2 text-xs text-slate-700">
 <input
 type="checkbox"
 checked={createForm.ceac_exception_authorized}
 onChange={(event) => setCreateForm((prev) => ({ ...prev, ceac_exception_authorized: event.target.checked }))}
 />
 Excepción formal (cuando no ingresa por CEAC)
 </label>
 {createForm.ceac_exception_authorized ? (
 <textarea
 rows={2}
 value={createForm.ceac_exception_reason}
 onChange={(event) => setCreateForm((prev) => ({ ...prev, ceac_exception_reason: event.target.value }))}
 className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-xs"
 placeholder="Justificación de excepción CEAC"
 />
 ) : null}
 </div>
 <div className="mt-3 flex justify-end">
 <Button size="sm" loading={busy} onClick={handleCreateCase}>
 Crear caso
 </Button>
 </div>
 </Card>
 ) : null}

 <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
 <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-4">
 <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
 <select
 value={filters.status}
 onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 >
 <option value="">Todos los estados</option>
 <option value="ceac_received">CEAC recibido</option>
 <option value="ceac_diagnosis">Diagnóstico CEAC</option>
 <option value="escalated_dispatch">Escalado dispatcher</option>
 <option value="visit_scheduled">Visita programada</option>
 <option value="parts_pending_quote">Repuesto cotización</option>
 <option value="pending_disinfection">Pendiente F.ST-02</option>
 <option value="closed">Cerrado</option>
 </select>
 <input
 value={filters.q}
 onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
 placeholder="Buscar caso, cliente, equipo..."
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 />
 </div>
 <div className="space-y-2">
 {loading ? (
 <p className="text-xs text-slate-500">Cargando casos...</p>
 ) : rows.length === 0 ? (
 <p className="text-xs text-slate-500">No hay casos con filtros actuales.</p>
 ) : (
 rows.map((item) => (
 <button
 key={item.id}
 type="button"
 onClick={() => setSelectedId(item.id)}
 className={`w-full rounded-xl border px-3 py-3 text-left transition ${
 Number(selectedId) === Number(item.id)
 ? "border-blue-300 bg-blue-50"
 : "border-slate-200 bg-white hover:border-slate-300"
 }`}
 >
 <div className="flex items-center justify-between gap-2">
 <p className="text-xs font-semibold text-slate-900">{item.code}</p>
 <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusChip(item.status)}`}>
 {labelStatus(item.status)}
 </span>
 </div>
 <p className="mt-1 text-xs text-slate-700">{item.problem_summary}</p>
 <p className="mt-1 text-[11px] text-slate-500">
 {item.client_name || "Cliente N/D"} · {item.equipment_name || "Equipo N/D"}
 </p>
 <p className="mt-1 text-[11px] text-slate-500">
 Prioridad {item.priority} · Comentarios {item.comments_count || 0}
 </p>
 </button>
 ))
 )}
 </div>
 </Card>

 <div className="space-y-4 xl:col-span-8">
 {!selectedCase ? (
 <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <p className="text-sm text-slate-500">Selecciona un caso para ver detalle operativo.</p>
 </Card>
 ) : (
 <>
 <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div>
 <h4 className="text-sm font-semibold text-slate-900">
 {selectedCase.code} · {selectedCase.problem_summary}
 </h4>
 <p className="mt-1 text-xs text-slate-600">
 Cliente: {selectedCase.client_name || "N/D"} · Equipo: {selectedCase.equipment_name || "N/D"} · Serie: {selectedCase.equipment_serial || "N/D"}
 </p>
 <p className="mt-1 text-xs text-slate-600">
 Solicitante: {selectedCase.requester_name || selectedCase.requester_email || "N/D"} · Creado: {formatDate(selectedCase.created_at)}
 </p>
 </div>
 <div className="flex flex-wrap gap-2">
 <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusChip(selectedCase.status)}`}>
 {labelStatus(selectedCase.status)}
 </span>
 <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
 Prioridad {selectedCase.priority}
 </span>
 {selectedCase.sla_response_breached || selectedCase.sla_resolution_breached ? (
 <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700">
 <FiAlertTriangle size={12} />
 SLA vencido
 </span>
 ) : null}
 </div>
 </div>
 <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
 {selectedCase.problem_detail}
 </p>

 <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
 <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
 <p className="font-semibold text-slate-900">Asignación técnica</p>
 <p>Clasificación: {selectedCase.classification || "Pendiente"}</p>
 <p>Especialista: {selectedCase.assigned_specialist_name || "Sin asignar"}</p>
 <p>Dispatcher: {selectedCase.dispatcher_name || "Sin asignar"}</p>
 </div>
 <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
 <p className="font-semibold text-slate-900">Cierre y trazabilidad</p>
 <p>WO: {selectedCase.work_order_number || "N/D"}</p>
 <p>Requiere F.ST-02: {selectedCase.requires_disinfection ? "Sí" : "No"}</p>
 <p>F.ST-02: {selectedCase.disinfection_document_file_id || "No vinculado"}</p>
 </div>
 </div>

 <div className="mt-3 flex flex-wrap gap-2">
 {canCeac ? (
 <>
 <Button size="sm" variant="secondary" icon={FiClipboard} loading={busy} onClick={runCeacDiagnosis}>
 Diagnóstico CEAC
 </Button>
 <Button size="sm" variant="secondary" icon={FiCheckCircle} loading={busy} onClick={runResolveRemote}>
 Cierre remoto CEAC
 </Button>
 <Button size="sm" variant="secondary" icon={FiSend} loading={busy} onClick={runEscalate}>
 Escalar a dispatcher
 </Button>
 </>
 ) : null}
 {canDispatcher ? (
 <>
 <Button size="sm" variant="secondary" icon={FiActivity} loading={busy} onClick={() => runClassify("aplicaciones")}>
 Clasificar aplicaciones
 </Button>
 <Button size="sm" variant="secondary" icon={FiActivity} loading={busy} onClick={() => runClassify("ingenieria")}>
 Clasificar ingeniería
 </Button>
 <Button size="sm" variant="secondary" icon={FiActivity} loading={busy} onClick={() => runClassify("software_lis")}>
 Clasificar software/LIS
 </Button>
 <Button size="sm" variant="secondary" loading={busy} onClick={() => runDispatchMilestone("qualify")}>
 Milestone qualify
 </Button>
 <Button size="sm" variant="secondary" loading={busy} onClick={() => runDispatchMilestone("dispatch")}>
 Milestone dispatch
 </Button>
 <Button size="sm" variant="secondary" loading={busy} onClick={() => runDispatchMilestone("attend")}>
 Milestone attend
 </Button>
 <Button size="sm" variant="secondary" loading={busy} onClick={runScheduleRevisit}>
 Programar revisita
 </Button>
 </>
 ) : null}
              {canTech ? (
                <>
                  <Link
                    to={`/dashboard/servicio-tecnico/desinfeccion?source_type=corrective_case&source_id=${encodeURIComponent(
                      String(selectedCase.id),
                    )}`}
                    className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Abrir F.ST-02
                  </Link>
                  <Button size="sm" variant="secondary" loading={busy} onClick={runLinkFst02}>
                    Vincular F.ST-02
                  </Button>
 <Button size="sm" variant="secondary" loading={busy} onClick={runCloseCase}>
 Cerrar caso
 </Button>
 </>
 ) : null}
 <Button size="sm" variant="secondary" loading={busy} onClick={runAddEvidence}>
 Agregar evidencia
 </Button>
 </div>
 </Card>

 <PartQuotationPanel
 caseItem={selectedCase}
 busy={busy}
 onAction={executeAction}
 canRegisterParts={canTech || canDispatcher}
 canRequestQuote={canTech || canDispatcher}
 canIssueQuote={canCommercial}
 canDecideQuote={canCommercial || canCeac}
 canMarkInstalled={canTech}
 />

 <CorrectiveCaseTimeline
 rows={timeline}
 loading={busy}
 onRefresh={() => loadCaseDetail(selectedId)}
 />

 <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="flex items-center gap-2">
 <FiMessageSquare size={14} />
 <h4 className="text-sm font-semibold text-slate-900">Comentarios internos y públicos</h4>
 </div>
 <div className="mt-2 space-y-2">
 {comments.length === 0 ? (
 <p className="text-xs text-slate-500">Sin comentarios registrados.</p>
 ) : (
 comments.map((comment) => (
 <div key={comment.id} className="rounded-xl border border-slate-200 px-3 py-2">
 <p className="text-xs text-slate-700">{comment.message}</p>
 <p className="mt-1 text-[11px] text-slate-500">
 {comment.visibility} · {comment.author_name || comment.author_email || "N/D"} · {formatDate(comment.created_at)}
 </p>
 </div>
 ))
 )}
 </div>
 <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
 <textarea
 rows={2}
 value={newComment}
 onChange={(event) => setNewComment(event.target.value)}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 placeholder="Escribe comentario para trazabilidad del caso"
 />
 <select
 value={commentVisibility}
 onChange={(event) => setCommentVisibility(event.target.value)}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 >
 <option value="internal">Interno</option>
 <option value="public">Público</option>
 </select>
 <Button size="sm" loading={busy} onClick={submitComment}>
 Enviar
 </Button>
 </div>
 </Card>
 </>
 )}
 </div>
 </div>
 </div>
 );
};

export default CorrectiveCaseWorkspace;
