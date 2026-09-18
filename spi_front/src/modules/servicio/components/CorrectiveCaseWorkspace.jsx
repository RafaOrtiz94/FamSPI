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
import CorrectiveActionForm from "./CorrectiveActionForm";
import CorrectiveCaseBoard from "./CorrectiveCaseBoard";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";
import ServicioMetric from "../design/ServicioMetric";
import ServicioEmptyState from "../design/ServicioEmptyState";

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

// Mismos grupos que CEAC_ROLES/DISPATCH_ROLES/TECH_SPECIALIST_ROLES en
// ceacDispatch.service.js (backend) -- antes este archivo tenia su propia
// lista sin los roles vigentes (ing_servicio/esp_app/jefe_servicio), lo que
// ocultaba silenciosamente todas las acciones a esos usuarios aunque el
// backend ya los autorizaba.
const CEAC_ROLE_TOKENS = ["ceac", "ti", "jefe_ti", "admin_ti", "servicio_tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "jefe_servicio"];
const DISPATCH_ROLE_TOKENS = ["dispatcher", "jefe_tecnico", "jefe_servicio_tecnico", "jefe_servicio", "servicio_tecnico"];
const TECH_ROLE_TOKENS = ["servicio_tecnico", "tecnico", "ing_servicio", "esp_app", "jefe_tecnico", "jefe_servicio_tecnico", "jefe_servicio", "ingeniero", "especialista_aplicaciones"];
const COMMERCIAL_ROLE_TOKENS = ["comercial", "jefe_comercial", "backoffice_comercial", "acp_comercial"];

// T11 del plan de rework: clasificacion tecnica (hardware/aplicacion) visible
// desde que el caso entra a la cola. `ing_servicio` = hardware (clasificacion
// "ingenieria"), `esp_app` = aplicacion/software (clasificaciones
// "aplicaciones" y "software_lis") -- verificado contra ST-01-03 original.
const SPECIALTY_BY_ROLE = { ing_servicio: ["ingenieria"], esp_app: ["aplicaciones", "software_lis"] };
const mySpecialtyClassifications = (tokens) => {
  for (const [role, classifications] of Object.entries(SPECIALTY_BY_ROLE)) {
    if (tokens.includes(role)) return classifications;
  }
  return null;
};

const labelStatus = (status) => String(status || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusTone = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (["closed"].includes(normalized)) return "success";
  if (["cancelled", "parts_rejected"].includes(normalized)) return "danger";
  if (["parts_pending_quote", "parts_pending_client_approval", "pending_disinfection"].includes(normalized)) return "warning";
  return "neutral";
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

const inputClass = "rounded-[var(--st-radius-md)] border px-3 py-2 text-xs outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };

const CorrectiveCaseWorkspace = () => {
  const { showToast } = useUI();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [kpi, setKpi] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ status: "", q: "" });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentVisibility, setCommentVisibility] = useState("internal");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [specialtyFilter, setSpecialtyFilter] = useState("mine");
  const [activeAction, setActiveAction] = useState(null);
  const currentUserId = Number(user?.id) || null;

  const tokens = useMemo(() => roleTokens(user), [user]);
  const canCeac = useMemo(() => isAny(tokens, CEAC_ROLE_TOKENS), [tokens]);
  const canDispatcher = useMemo(() => isAny(tokens, DISPATCH_ROLE_TOKENS), [tokens]);
  const canTech = useMemo(() => isAny(tokens, TECH_ROLE_TOKENS), [tokens]);
  const canCommercial = useMemo(() => isAny(tokens, COMMERCIAL_ROLE_TOKENS), [tokens]);
  const mySpecialty = useMemo(() => mySpecialtyClassifications(tokens), [tokens]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: filters.status || undefined, q: filters.q || undefined };
      const [list, kpiData] = await Promise.all([listCorrectiveCasesWorkspace(params), getCorrectiveCasesWorkspaceKpi(params)]);
      setRows(Array.isArray(list) ? list : []);
      setKpi(kpiData || {});
      if (!selectedId && Array.isArray(list) && list.length > 0) setSelectedId(list[0].id);
      if (selectedId && !list.some((item) => Number(item.id) === Number(selectedId))) setSelectedId(list[0]?.id || null);
    } catch (error) {
      showToast(error?.response?.data?.error || "No se pudo cargar workspace correctivo", "error");
    } finally {
      setLoading(false);
    }
  }, [filters.q, filters.status, selectedId, showToast]);

  const visibleRows = useMemo(() => {
    let out = rows;
    if (mySpecialty && specialtyFilter === "mine") {
      out = out.filter((item) => !item.classification || mySpecialty.includes(item.classification));
    }
    if (assignedToMeOnly && currentUserId) {
      out = out.filter(
        (item) => Number(item.assigned_specialist_user_id) === currentUserId || Number(item.dispatcher_user_id) === currentUserId,
      );
    }
    return out;
  }, [rows, assignedToMeOnly, currentUserId, mySpecialty, specialtyFilter]);

  // Tablero por etapa (reemplaza la lista plana): el caso correctivo tiene
  // una etapa natural (sin clasificar -> especialidad -> cerrado) que la
  // lista+detalle lado a lado no comunicaba. Un tecnico viendo "mi
  // especialidad" solo necesita su columna + cerrados, no las 4 completas.
  const boardColumns = useMemo(() => {
    const open = (item) => String(item.status || "").toLowerCase() !== "closed";
    const closed = visibleRows.filter((item) => !open(item));
    if (mySpecialty && specialtyFilter === "mine") {
      return [
        {
          key: "mine",
          label: mySpecialty.includes("ingenieria") ? "Ingeniería" : "Aplicaciones / LIS",
          rows: visibleRows.filter(open),
        },
        { key: "closed", label: "Cerrados", rows: closed },
      ];
    }
    return [
      { key: "unclassified", label: "Por clasificar", rows: visibleRows.filter((item) => open(item) && !item.classification) },
      { key: "ingenieria", label: "Ingeniería", rows: visibleRows.filter((item) => open(item) && item.classification === "ingenieria") },
      { key: "aplicaciones", label: "Aplicaciones / LIS", rows: visibleRows.filter((item) => open(item) && ["aplicaciones", "software_lis"].includes(item.classification)) },
      { key: "closed", label: "Cerrados", rows: closed },
    ];
  }, [visibleRows, mySpecialty, specialtyFilter]);

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
    setActiveAction(null);
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
      await addCorrectiveCaseComment(selectedId, { message: newComment, visibility: commentVisibility });
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

  // Panel inline por accion (T3/calidad general): reemplaza la cadena de
  // window.prompt() que existia antes por accion -- ademas de la mala UX de
  // dialogos nativos apilados, no dejaba ver que se estaba por enviar antes
  // de confirmar ni distinguia campos opcionales de obligatorios.
  const ACTION_DEFS = {
    ceac_diagnosis: { title: "Diagnóstico CEAC", action: "ceac_diagnosis", fields: [{ key: "notes", label: "Notas de diagnóstico", type: "textarea", required: true, wide: true }] },
    resolve_remote: {
      title: "Cierre remoto CEAC",
      action: "resolve_remote",
      fields: [
        { key: "resolution_notes", label: "Notas de resolución", type: "textarea", required: true, wide: true },
        { key: "technical_basis", label: "Base técnica (manual/proveedor/referencia)", type: "text", required: true, wide: true },
      ],
    },
    escalate_dispatch: { title: "Escalar a dispatcher", action: "escalate_dispatch", fields: [{ key: "reason", label: "Motivo de escalamiento", type: "textarea", required: true, wide: true }] },
    classify_aplicaciones: {
      title: "Clasificar: aplicaciones",
      action: "classify_case",
      staticValues: { classification: "aplicaciones" },
      fields: [
        { key: "assigned_specialist_user_id", label: "ID de especialista asignado", type: "number", placeholder: "Opcional" },
        { key: "assigned_specialist_role", label: "Rol del asignado", type: "text", placeholder: "esp_app" },
      ],
    },
    classify_ingenieria: {
      title: "Clasificar: ingeniería",
      action: "classify_case",
      staticValues: { classification: "ingenieria" },
      fields: [
        { key: "assigned_specialist_user_id", label: "ID de especialista asignado", type: "number", placeholder: "Opcional" },
        { key: "assigned_specialist_role", label: "Rol del asignado", type: "text", placeholder: "ing_servicio" },
      ],
    },
    classify_software_lis: {
      title: "Clasificar: software/LIS",
      action: "classify_case",
      staticValues: { classification: "software_lis" },
      fields: [
        { key: "provider_name", label: "Proveedor / ingeniero de proveedor", type: "text", required: true, wide: true },
        { key: "provider_case_reference", label: "Referencia de caso proveedor", type: "text", wide: true },
        { key: "assigned_specialist_user_id", label: "ID de especialista asignado", type: "number", placeholder: "Opcional" },
        { key: "assigned_specialist_role", label: "Rol del asignado", type: "text" },
      ],
    },
    milestone_qualify: { title: "Milestone: qualify", action: "register_dispatch_milestone", staticValues: { milestone: "qualify" }, fields: [{ key: "notes", label: "Notas", type: "textarea", wide: true }] },
    milestone_attend: { title: "Milestone: attend", action: "register_dispatch_milestone", staticValues: { milestone: "attend" }, fields: [{ key: "notes", label: "Notas", type: "textarea", wide: true }] },
    milestone_dispatch: {
      title: "Milestone: dispatch",
      action: "register_dispatch_milestone",
      staticValues: { milestone: "dispatch" },
      fields: [
        { key: "scheduled_visit_at", label: "Fecha y hora de visita", type: "datetime", required: true },
        { key: "notes", label: "Notas", type: "textarea", wide: true },
      ],
    },
    schedule_revisit: {
      title: "Programar revisita",
      action: "schedule_revisit",
      fields: [
        { key: "scheduled_visit_at", label: "Fecha/hora nueva visita", type: "datetime", required: true },
        { key: "work_order_number", label: "WO (opcional)", type: "text" },
      ],
    },
    close_case: {
      title: "Cerrar caso",
      action: "close_case",
      fields: [
        { key: "close_reason", label: "Causal de cierre", type: "textarea", required: true, wide: true },
        { key: "result_summary", label: "Resumen de resultado final", type: "textarea", required: true, wide: true },
      ],
    },
    link_disinfection_fst02: { title: "Vincular F.ST-02", action: "link_disinfection_fst02", fields: [{ key: "fst02_file_id", label: "ID archivo F.ST-02 (vacío = buscar último)", type: "text", wide: true }] },
    add_evidence: {
      title: "Agregar evidencia",
      action: "add_evidence",
      fields: [
        { key: "evidence_ref", label: "URL o referencia de evidencia", type: "text", required: true, wide: true },
        { key: "note", label: "Nota (opcional)", type: "textarea", wide: true },
      ],
    },
  };

  const submitActiveAction = async (payload) => {
    if (!activeAction) return;
    await executeAction(activeAction.action, payload);
    setActiveAction(null);
  };

  return (
    <div className="st-scope space-y-4">
      <ServicioCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
              <FiTool /> Correctivos ST-01-03 (CEAC + Dispatcher)
            </h3>
            <p className="text-xs" style={{ color: "var(--st-text-muted)" }}>
              Gestión formal del caso: triage CEAC, escalamiento, clasificación técnica, repuestos y cierre trazable.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon={FiRefreshCw} loading={loading} onClick={loadWorkspace}>Recargar</Button>
            <Button size="sm" icon={FiPlus} onClick={() => setShowCreate((prev) => !prev)}>{showCreate ? "Ocultar formulario" : "Nuevo caso correctivo"}</Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <ServicioMetric label="Total" value={kpi.total || 0} />
          <ServicioMetric label="Cola CEAC" value={kpi.ceac_queue || 0} />
          <ServicioMetric label="Dispatcher" value={kpi.dispatch_queue || 0} />
          <div className="rounded-[var(--st-radius-md)] border px-4 py-3" style={{ borderColor: "var(--st-warning)", background: "var(--st-warning-soft)" }}>
            <p className="text-[11px]" style={{ color: "var(--st-warning)" }}>Repuestos pendientes</p>
            <p className="text-lg font-bold" style={{ color: "var(--st-warning)" }}>{kpi.spare_parts_pending || 0}</p>
          </div>
          <div className="rounded-[var(--st-radius-md)] border px-4 py-3" style={{ borderColor: "var(--st-danger)", background: "var(--st-danger-soft)" }}>
            <p className="text-[11px]" style={{ color: "var(--st-danger)" }}>SLA vencidos</p>
            <p className="text-lg font-bold" style={{ color: "var(--st-danger)" }}>{(kpi.response_overdue || 0) + (kpi.resolution_overdue || 0)}</p>
          </div>
        </div>
      </ServicioCard>

      {showCreate ? (
        <ServicioCard className="p-4">
          <h4 className="text-sm font-semibold" style={{ color: "var(--st-text)" }}>Nuevo caso correctivo</h4>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input value={createForm.problem_summary} onChange={(event) => setCreateForm((prev) => ({ ...prev, problem_summary: event.target.value }))} className={inputClass} style={inputStyle} placeholder="Resumen del problema" />
            <input value={createForm.client_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, client_name: event.target.value }))} className={inputClass} style={inputStyle} placeholder="Cliente" />
            <input value={createForm.equipment_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, equipment_name: event.target.value }))} className={inputClass} style={inputStyle} placeholder="Equipo" />
            <input value={createForm.equipment_serial} onChange={(event) => setCreateForm((prev) => ({ ...prev, equipment_serial: event.target.value }))} className={inputClass} style={inputStyle} placeholder="Serie" />
            <select value={createForm.client_segment} onChange={(event) => setCreateForm((prev) => ({ ...prev, client_segment: event.target.value }))} className={inputClass} style={inputStyle}>
              <option value="A">Segmento A</option>
              <option value="B">Segmento B</option>
              <option value="C">Segmento C</option>
            </select>
            <select value={createForm.priority} onChange={(event) => setCreateForm((prev) => ({ ...prev, priority: event.target.value }))} className={inputClass} style={inputStyle}>
              <option value="critica">Prioridad crítica</option>
              <option value="alta">Prioridad alta</option>
              <option value="media">Prioridad media</option>
              <option value="baja">Prioridad baja</option>
            </select>
            <textarea rows={3} value={createForm.problem_detail} onChange={(event) => setCreateForm((prev) => ({ ...prev, problem_detail: event.target.value }))} className={`md:col-span-2 ${inputClass}`} style={inputStyle} placeholder="Detalle técnico del problema" />
            <label className="md:col-span-2 inline-flex items-center gap-2 text-xs" style={{ color: "var(--st-text-muted)" }}>
              <input type="checkbox" checked={createForm.ceac_exception_authorized} onChange={(event) => setCreateForm((prev) => ({ ...prev, ceac_exception_authorized: event.target.checked }))} />
              Excepción formal (cuando no ingresa por CEAC)
            </label>
            {createForm.ceac_exception_authorized ? (
              <textarea rows={2} value={createForm.ceac_exception_reason} onChange={(event) => setCreateForm((prev) => ({ ...prev, ceac_exception_reason: event.target.value }))} className={`md:col-span-2 ${inputClass}`} style={inputStyle} placeholder="Justificación de excepción CEAC" />
            ) : null}
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" loading={busy} onClick={handleCreateCase}>Crear caso</Button>
          </div>
        </ServicioCard>
      ) : null}

      <ServicioCard className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} className={inputClass} style={inputStyle}>
            <option value="">Todos los estados</option>
            <option value="ceac_received">CEAC recibido</option>
            <option value="ceac_diagnosis">Diagnóstico CEAC</option>
            <option value="escalated_dispatch">Escalado dispatcher</option>
            <option value="visit_scheduled">Visita programada</option>
            <option value="parts_pending_quote">Repuesto cotización</option>
            <option value="pending_disinfection">Pendiente F.ST-02</option>
            <option value="closed">Cerrado</option>
          </select>
          <input value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} placeholder="Buscar caso, cliente, equipo..." className={`flex-1 ${inputClass}`} style={{ ...inputStyle, minWidth: 180 }} />
          {mySpecialty ? (
            <div className="flex overflow-hidden rounded-[var(--st-radius-md)] border text-xs font-semibold" style={{ borderColor: "var(--st-border)" }}>
              <button
                type="button"
                onClick={() => setSpecialtyFilter("mine")}
                className="px-2.5 py-2 transition-colors"
                style={specialtyFilter === "mine" ? { background: "var(--st-accent)", color: "#fff" } : { background: "var(--st-surface)", color: "var(--st-text-muted)" }}
              >
                Mi especialidad
              </button>
              <button
                type="button"
                onClick={() => setSpecialtyFilter("all")}
                className="px-2.5 py-2 transition-colors"
                style={specialtyFilter === "all" ? { background: "var(--st-accent)", color: "#fff" } : { background: "var(--st-surface)", color: "var(--st-text-muted)" }}
              >
                Todos
              </button>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
            <input type="checkbox" checked={assignedToMeOnly} onChange={(event) => setAssignedToMeOnly(event.target.checked)} />
            Solo míos
          </label>
        </div>

        {loading ? (
          <p className="text-xs" style={{ color: "var(--st-text-muted)" }}>Cargando casos...</p>
        ) : visibleRows.length === 0 ? (
          <ServicioEmptyState title="No hay casos con filtros actuales." />
        ) : (
          <CorrectiveCaseBoard columns={boardColumns} selectedId={selectedId} onSelect={setSelectedId} currentUserId={currentUserId} />
        )}
      </ServicioCard>

      <div className="space-y-4">
        {!selectedCase ? null : (
          <>
            <ServicioCard className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: "var(--st-text)" }}>{selectedCase.code} · {selectedCase.problem_summary}</h4>
                    <p className="mt-1 text-xs" style={{ color: "var(--st-text-muted)" }}>
                      Cliente: {selectedCase.client_name || "N/D"} · Equipo: {selectedCase.equipment_name || "N/D"} · Serie: {selectedCase.equipment_serial || "N/D"}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--st-text-muted)" }}>
                      Solicitante: {selectedCase.requester_name || selectedCase.requester_email || "N/D"} · Creado: {formatDate(selectedCase.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ServicioBadge tone={statusTone(selectedCase.status)}>{labelStatus(selectedCase.status)}</ServicioBadge>
                    <ServicioBadge tone="neutral">Prioridad {selectedCase.priority}</ServicioBadge>
                    {selectedCase.sla_response_breached || selectedCase.sla_resolution_breached ? (
                      <ServicioBadge tone="danger" icon={FiAlertTriangle}>SLA vencido</ServicioBadge>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 rounded-[var(--st-radius-md)] border px-3 py-2 text-xs" style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)", color: "var(--st-text-muted)" }}>
                  {selectedCase.problem_detail}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-[var(--st-radius-md)] border p-2 text-xs" style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)" }}>
                    <p className="font-semibold" style={{ color: "var(--st-text)" }}>Asignación técnica</p>
                    <p>Clasificación: {selectedCase.classification || "Pendiente"}</p>
                    <p>Especialista: {selectedCase.assigned_specialist_name || "Sin asignar"}</p>
                    <p>Dispatcher: {selectedCase.dispatcher_name || "Sin asignar"}</p>
                  </div>
                  <div className="rounded-[var(--st-radius-md)] border p-2 text-xs" style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)" }}>
                    <p className="font-semibold" style={{ color: "var(--st-text)" }}>Cierre y trazabilidad</p>
                    <p>WO: {selectedCase.work_order_number || "N/D"}</p>
                    <p>Requiere F.ST-02: {selectedCase.requires_disinfection ? "Sí" : "No"}</p>
                    <p>F.ST-02: {selectedCase.disinfection_document_file_id || "No vinculado"}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {canCeac ? (
                    <>
                      <Button size="sm" variant="secondary" icon={FiClipboard} onClick={() => setActiveAction(ACTION_DEFS.ceac_diagnosis)}>Diagnóstico CEAC</Button>
                      <Button size="sm" variant="secondary" icon={FiCheckCircle} onClick={() => setActiveAction(ACTION_DEFS.resolve_remote)}>Cierre remoto CEAC</Button>
                      <Button size="sm" variant="secondary" icon={FiSend} onClick={() => setActiveAction(ACTION_DEFS.escalate_dispatch)}>Escalar a dispatcher</Button>
                    </>
                  ) : null}
                  {canDispatcher ? (
                    <>
                      <Button size="sm" variant="secondary" icon={FiActivity} onClick={() => setActiveAction(ACTION_DEFS.classify_aplicaciones)}>Clasificar aplicaciones</Button>
                      <Button size="sm" variant="secondary" icon={FiActivity} onClick={() => setActiveAction(ACTION_DEFS.classify_ingenieria)}>Clasificar ingeniería</Button>
                      <Button size="sm" variant="secondary" icon={FiActivity} onClick={() => setActiveAction(ACTION_DEFS.classify_software_lis)}>Clasificar software/LIS</Button>
                      <Button size="sm" variant="secondary" onClick={() => setActiveAction(ACTION_DEFS.milestone_qualify)}>Milestone qualify</Button>
                      <Button size="sm" variant="secondary" onClick={() => setActiveAction(ACTION_DEFS.milestone_dispatch)}>Milestone dispatch</Button>
                      <Button size="sm" variant="secondary" onClick={() => setActiveAction(ACTION_DEFS.milestone_attend)}>Milestone attend</Button>
                      <Button size="sm" variant="secondary" onClick={() => setActiveAction(ACTION_DEFS.schedule_revisit)}>Programar revisita</Button>
                    </>
                  ) : null}
                  {canTech ? (
                    <>
                      <Link
                        to={`/dashboard/servicio-tecnico/desinfeccion?source_type=corrective_case&source_id=${encodeURIComponent(String(selectedCase.id))}`}
                        className="inline-flex items-center rounded-[var(--st-radius-md)] border px-3 py-1.5 text-xs font-semibold transition"
                        style={{ borderColor: "var(--st-border)", color: "var(--st-text)" }}
                      >
                        Abrir F.ST-02
                      </Link>
                      <Button size="sm" variant="secondary" onClick={() => setActiveAction(ACTION_DEFS.link_disinfection_fst02)}>Vincular F.ST-02</Button>
                      <Button size="sm" variant="secondary" onClick={() => setActiveAction(ACTION_DEFS.close_case)}>Cerrar caso</Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="secondary" onClick={() => setActiveAction(ACTION_DEFS.add_evidence)}>Agregar evidencia</Button>
                </div>

                {activeAction ? (
                  <div className="mt-3">
                    <CorrectiveActionForm
                      title={activeAction.title}
                      fields={activeAction.fields}
                      staticValues={activeAction.staticValues}
                      busy={busy}
                      onCancel={() => setActiveAction(null)}
                      onSubmit={submitActiveAction}
                    />
                  </div>
                ) : null}
              </ServicioCard>

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

              <CorrectiveCaseTimeline rows={timeline} loading={busy} onRefresh={() => loadCaseDetail(selectedId)} />

              <ServicioCard className="p-4">
                <div className="flex items-center gap-2">
                  <FiMessageSquare size={14} style={{ color: "var(--st-text-muted)" }} />
                  <h4 className="text-sm font-semibold" style={{ color: "var(--st-text)" }}>Comentarios internos y públicos</h4>
                </div>
                <div className="mt-2 space-y-2">
                  {comments.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>Sin comentarios registrados.</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="rounded-[var(--st-radius-md)] border px-3 py-2" style={{ borderColor: "var(--st-border)" }}>
                        <p className="text-xs" style={{ color: "var(--st-text-muted)" }}>{comment.message}</p>
                        <p className="mt-1 text-[11px]" style={{ color: "var(--st-text-faint)" }}>
                          {comment.visibility} · {comment.author_name || comment.author_email || "N/D"} · {formatDate(comment.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
                  <textarea rows={2} value={newComment} onChange={(event) => setNewComment(event.target.value)} className={inputClass} style={inputStyle} placeholder="Escribe comentario para trazabilidad del caso" />
                  <select value={commentVisibility} onChange={(event) => setCommentVisibility(event.target.value)} className={inputClass} style={inputStyle}>
                    <option value="internal">Interno</option>
                    <option value="public">Público</option>
                  </select>
                  <Button size="sm" loading={busy} onClick={submitComment}>Enviar</Button>
                </div>
              </ServicioCard>
          </>
        )}
      </div>
    </div>
  );
};

export default CorrectiveCaseWorkspace;
