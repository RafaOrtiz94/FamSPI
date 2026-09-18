import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiBarChart2, FiRefreshCw, FiSearch, FiX } from "react-icons/fi";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  addSupportTicketComment,
  assignSupportTicketToMe,
  getSupportTicketEvidenceFile,
  listSupportTicketComments,
  listSupportTicketEvents,
  listSupportTicketsWorkspace,
  listSupportTicketWorkspaceKpiDefinitions,
  getSupportTicketsWorkspaceKpi,
  updateSupportTicketStatus,
} from "../../../core/api/supportTicketsApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import { formatDurationMinutes } from "../../../core/utils/workflowUi";
import Button from "../../../core/ui/components/Button";
import "../design/tokens.css";
import { TicketInspector, TicketKanbanBoard, TicketMetric, TicketStatusChangeModal } from "../design";

const STATUS_OPTIONS = [
  { value: "abierto", label: "Abierto" },
  { value: "triage", label: "Triage" },
  { value: "en_progreso", label: "En progreso" },
  { value: "en_espera", label: "En espera" },
  { value: "resuelto", label: "Terminado" },
  { value: "cerrado", label: "Cerrado" },
  { value: "reabierto", label: "Reabierto" },
];

const ALLOWED_STATUS_TRANSITIONS = {
  abierto: new Set(["triage", "en_progreso", "en_espera", "resuelto", "cerrado"]),
  triage: new Set(["en_progreso", "en_espera", "resuelto", "cerrado"]),
  en_progreso: new Set(["en_espera", "resuelto", "cerrado"]),
  en_espera: new Set(["triage", "en_progreso", "resuelto", "cerrado"]),
  resuelto: new Set(["cerrado", "reabierto"]),
  cerrado: new Set(["reabierto"]),
  reabierto: new Set(["triage", "en_progreso", "en_espera", "resuelto", "cerrado"]),
};

const TYPE_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "fallo", label: "Fallos" },
  { value: "implementacion", label: "Implementaciones" },
  { value: "requerimiento", label: "Requerimientos" },
  { value: "problema", label: "Problemas" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "Todas las prioridades" },
  { value: "critica", label: "Critica" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];

const EMPTY_KPI = {
  total: 0,
  abiertos: 0,
  triage: 0,
  en_progreso: 0,
  en_espera: 0,
  terminados: 0,
  response_overdue: 0,
  resolution_overdue: 0,
  avg_cycle_minutes: null,
};

const isJefeTi = (user) => ["jefe_ti", "jefe_de_ti"].includes(String(user?.role || "").trim().toLowerCase());

// Filtro compacto tipo "chip" (estilo Linear/GitHub Issues): un select nativo
// con apariencia de pastilla, que se resalta con el color de accion solo
// cuando tiene un valor activo. Reemplaza la grilla de 5 campos con label
// encima que se sentia pesada -- el estado ya no es un filtro aparte, lo
// comunican las columnas del tablero.
function ChipSelect({ value, onChange, options, "aria-label": ariaLabel }) {
  const isActive = Boolean(value);
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      className="px-3 py-1.5 text-xs font-semibold outline-none transition"
      style={{
        minHeight: "36px",
        borderRadius: "9999px",
        border: `1px solid ${isActive ? "var(--ti-accent)" : "var(--ti-border-control)"}`,
        background: isActive ? "var(--ti-selected)" : "var(--ti-surface)",
        color: isActive ? "var(--ti-accent)" : "var(--ti-text-muted)",
      }}
    >
      {options.map((option) => (
        <option key={option.value || "all"} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

const TicketsWorkspace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState([]);
  const [kpi, setKpi] = useState(EMPTY_KPI);
  const [kpiDefinitions, setKpiDefinitions] = useState([]);
  const [eventsByTicket, setEventsByTicket] = useState({});
  const [commentsByTicket, setCommentsByTicket] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [inspectorTab, setInspectorTab] = useState("detalle");
  const [evidencePreviewUrls, setEvidencePreviewUrls] = useState({});
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [pendingStatusChange, setPendingStatusChange] = useState(null);

  const filters = useMemo(() => ({
    ticket_type: searchParams.get("ticket_type") || "",
    priority: searchParams.get("priority") || "",
    assigned_ti_user_id: searchParams.get("assigned_ti_user_id") || "",
    q: searchParams.get("q") || "",
  }), [searchParams]);

  const hasActiveFilters = Boolean(filters.ticket_type || filters.priority || filters.assigned_ti_user_id || filters.q);

  const selectedTicketId = searchParams.get("ticketId") ? Number(searchParams.get("ticketId")) : null;

  const updateSearchParams = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const remoteFilters = useMemo(() => ({
    ticket_type: filters.ticket_type || undefined,
    priority: filters.priority || undefined,
    assigned_ti_user_id: filters.assigned_ti_user_id || undefined,
    q: filters.q || undefined,
  }), [filters]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const [data, kpiData] = await Promise.all([
        listSupportTicketsWorkspace(remoteFilters),
        getSupportTicketsWorkspaceKpi(remoteFilters),
      ]);
      setTickets(Array.isArray(data) ? data : []);
      setKpi(kpiData || EMPTY_KPI);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudieron cargar tickets", "error");
    } finally {
      setLoading(false);
    }
  }, [remoteFilters, showToast]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    listSupportTicketWorkspaceKpiDefinitions()
      .then((data) => setKpiDefinitions(Array.isArray(data) ? data : []))
      .catch(() => setKpiDefinitions([]));
  }, []);

  const filteredTickets = useMemo(() => {
    if (!filters.q.trim()) return tickets;
    const query = filters.q.trim().toLowerCase();
    return tickets.filter((ticket) =>
      [ticket.code, ticket.title, ticket.requester_name, ticket.requester_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [filters.q, tickets]);

  const technicianOptions = useMemo(() => {
    const seen = new Map();
    tickets.forEach((ticket) => {
      if (ticket.assigned_ti_user_id && !seen.has(ticket.assigned_ti_user_id)) {
        seen.set(ticket.assigned_ti_user_id, ticket.assigned_ti_name || ticket.assigned_ti_email || `Usuario ${ticket.assigned_ti_user_id}`);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ value: String(id), label: name }));
  }, [tickets]);

  const kanbanColumns = useMemo(() => {
    const buckets = new Map(STATUS_OPTIONS.map((option) => [option.value, []]));
    filteredTickets.forEach((ticket) => {
      const key = String(ticket.status || "").trim().toLowerCase();
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(ticket);
    });
    return STATUS_OPTIONS.map((option) => ({ key: option.value, label: option.label, tickets: buckets.get(option.value) || [] }));
  }, [filteredTickets]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  useEffect(() => {
    const attachments = selectedTicket?.evidence_photos || [];
    if (!attachments.length) {
      setEvidencePreviewUrls({});
      setEvidenceError("");
      return undefined;
    }

    let active = true;
    const objectUrls = [];
    setEvidenceLoading(true);
    setEvidenceError("");
    Promise.all(attachments.map(async (attachment) => {
      const { blob } = await getSupportTicketEvidenceFile(attachment.id);
      return [attachment.id, URL.createObjectURL(blob)];
    }))
      .then((entries) => {
        if (!active) {
          entries.forEach(([, url]) => URL.revokeObjectURL(url));
          return;
        }
        entries.forEach(([, url]) => objectUrls.push(url));
        setEvidencePreviewUrls(Object.fromEntries(entries));
      })
      .catch((error) => {
        if (!active) return;
        setEvidenceError(error?.response?.data?.message || "No se pudo cargar la evidencia.");
      })
      .finally(() => {
        if (active) setEvidenceLoading(false);
      });

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedTicket]);

  useEffect(() => {
    if (!selectedTicketId) return;
    if (inspectorTab === "historial" && !eventsByTicket[selectedTicketId]) {
      listSupportTicketEvents(selectedTicketId)
        .then((events) => setEventsByTicket((prev) => ({ ...prev, [selectedTicketId]: events })))
        .catch((error) => showToast(error?.response?.data?.message || "No se pudieron cargar eventos", "error"));
    }
    if (inspectorTab === "comentarios" && !commentsByTicket[selectedTicketId]) {
      listSupportTicketComments(selectedTicketId)
        .then((comments) => setCommentsByTicket((prev) => ({ ...prev, [selectedTicketId]: comments })))
        .catch((error) => showToast(error?.response?.data?.message || "No se pudieron cargar comentarios", "error"));
    }
  }, [selectedTicketId, inspectorTab, eventsByTicket, commentsByTicket, showToast]);

  const openInspector = (ticketId, tab = "detalle") => {
    setInspectorTab(tab);
    updateSearchParams({ ticketId });
  };

  const closeInspector = () => {
    updateSearchParams({ ticketId: null });
  };

  const handleAssignToMe = async (ticketId) => {
    setBusyId(ticketId);
    try {
      await assignSupportTicketToMe(ticketId);
      showToast("Ticket asignado", "success");
      setEventsByTicket((prev) => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      await loadTickets();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo asignar", "error");
    } finally {
      setBusyId(null);
    }
  };

  const applyStatusChange = async (ticketId, nextStatus, comment = "") => {
    setBusyId(ticketId);
    try {
      await updateSupportTicketStatus(ticketId, { status: nextStatus, comment });
      showToast("Estado actualizado", "success");
      setEventsByTicket((prev) => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      await loadTickets();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar estado", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusChangeRequest = (ticketId, nextStatus) => {
    if (nextStatus === "en_espera") {
      setPendingStatusChange({ ticketId, nextStatus });
      return;
    }
    applyStatusChange(ticketId, nextStatus);
  };

  const handleConfirmStatusChange = async (reason) => {
    if (!pendingStatusChange) return;
    const { ticketId, nextStatus } = pendingStatusChange;
    setPendingStatusChange(null);
    await applyStatusChange(ticketId, nextStatus, reason);
  };

  const getStatusOptionsForTicket = (currentStatus) => {
    const normalizedCurrent = String(currentStatus || "").trim().toLowerCase();
    const allowed = ALLOWED_STATUS_TRANSITIONS[normalizedCurrent];
    if (!allowed) return STATUS_OPTIONS;
    return STATUS_OPTIONS.filter((option) => option.value === normalizedCurrent || allowed.has(option.value));
  };

  const handleCommentDraftChange = (ticketId, value) => {
    setCommentDrafts((prev) => ({
      ...prev,
      [ticketId]: { text: value, visibility: prev[ticketId]?.visibility || "internal" },
    }));
  };

  const handleCommentVisibilityChange = (ticketId, value) => {
    setCommentDrafts((prev) => ({
      ...prev,
      [ticketId]: { text: prev[ticketId]?.text || "", visibility: value },
    }));
  };

  const handleSubmitComment = async (ticketId) => {
    const draft = commentDrafts[ticketId] || { text: "", visibility: "internal" };
    if (!draft.text || draft.text.trim().length < 2) {
      showToast("Comentario muy corto", "warning");
      return;
    }

    setBusyId(ticketId);
    try {
      await addSupportTicketComment(ticketId, { message: draft.text, visibility: draft.visibility });
      showToast("Comentario guardado", "success");
      const comments = await listSupportTicketComments(ticketId);
      setCommentsByTicket((prev) => ({ ...prev, [ticketId]: comments }));
      setCommentDrafts((prev) => ({ ...prev, [ticketId]: { text: "", visibility: prev[ticketId]?.visibility || "internal" } }));
      await loadTickets();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo guardar comentario", "error");
    } finally {
      setBusyId(null);
    }
  };

  const combinedOpen = (kpi.abiertos || 0) + (kpi.triage || 0);
  const combinedSlaOverdue = (kpi.response_overdue || 0) + (kpi.resolution_overdue || 0);

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} ti-scope gap-5`}>
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ti-text-muted)" }}>Workspace TI</p>
          <h1 className="mt-1 text-[clamp(1.5rem,3vw,2rem)] font-bold leading-tight tracking-[-0.02em]" style={{ color: "var(--ti-text)" }}>
            Tickets de soporte interno
          </h1>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--ti-text-muted)" }}>
            Prioriza incidencias, revisa evidencia fotografica y conserva el hilo operativo entre solicitante y TI.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {isJefeTi(user) ? (
            <Button type="button" size="sm" variant="secondary" icon={FiBarChart2} onClick={() => navigate("/dashboard/ti/workspace/reportes")}>
              Reportes y KPIs
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/dashboard/ti/casos-externos")}>
            Casos externos ST-01-04
          </Button>
          <Button type="button" size="sm" variant="primary" icon={FiRefreshCw} onClick={loadTickets}>
            Recargar
          </Button>
        </div>
      </header>

      <section className="flex flex-wrap gap-3">
        <TicketMetric label="Abiertos + triage" value={combinedOpen} />
        <TicketMetric label="SLA vencido" value={combinedSlaOverdue} tone={combinedSlaOverdue > 0 ? "danger" : "neutral"} />
        <TicketMetric label="Ciclo promedio" value={formatDurationMinutes(kpi.avg_cycle_minutes)} helper="Creacion a cierre tecnico" />
      </section>

      {kpiDefinitions.length > 0 ? (
        <section className="flex flex-wrap gap-3">
          {kpiDefinitions.map((def) => (
            <TicketMetric
              key={def.id}
              label={def.name}
              value={def.value === null || def.value === undefined ? "-" : def.value}
              unit={def.unit}
              tone={def.meets_goal === false ? "warning" : def.meets_goal === true ? "success" : "neutral"}
              helper={def.goal_value !== null && def.goal_value !== undefined ? `Meta: ${def.goal_value} ${def.unit || ""}` : undefined}
            />
          ))}
        </section>
      ) : isJefeTi(user) ? (
        <p className="text-xs" style={{ color: "var(--ti-text-muted)" }}>
          Aun no configuras KPIs propios.{" "}
          <button type="button" className="font-semibold underline" style={{ color: "var(--ti-accent)" }} onClick={() => navigate("/dashboard/ti/workspace/reportes")}>
            Configurar en Reportes y KPIs
          </button>
        </p>
      ) : null}

      <section className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <FiSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ti-text-muted)" }} />
          <input
            value={filters.q}
            onChange={(e) => updateSearchParams({ q: e.target.value })}
            placeholder="Buscar por codigo, titulo o solicitante"
            className="w-full py-1.5 pl-8 pr-3 text-sm outline-none transition"
            style={{
              minHeight: "36px",
              borderRadius: "9999px",
              border: "1px solid var(--ti-border-control)",
              background: "var(--ti-surface)",
              color: "var(--ti-text)",
            }}
          />
        </div>

        <ChipSelect aria-label="Filtrar por tipo" value={filters.ticket_type} onChange={(value) => updateSearchParams({ ticket_type: value })} options={TYPE_OPTIONS} />
        <ChipSelect aria-label="Filtrar por prioridad" value={filters.priority} onChange={(value) => updateSearchParams({ priority: value })} options={PRIORITY_OPTIONS} />
        <ChipSelect
          aria-label="Filtrar por tecnico asignado"
          value={filters.assigned_ti_user_id}
          onChange={(value) => updateSearchParams({ assigned_ti_user_id: value })}
          options={[{ value: "", label: "Todos los tecnicos" }, ...technicianOptions]}
        />

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => updateSearchParams({ ticket_type: null, priority: null, assigned_ti_user_id: null, q: null })}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition"
            style={{ color: "var(--ti-text-muted)" }}
          >
            <FiX size={12} /> Limpiar filtros
          </button>
        ) : null}
      </section>

      {loading ? (
        <div className="px-5 py-8 text-sm" style={{ color: "var(--ti-text-muted)" }}>Cargando tickets...</div>
      ) : (
        <TicketKanbanBoard columns={kanbanColumns} selectedId={selectedTicketId} onSelectTicket={openInspector} />
      )}

      <TicketInspector
        ticket={selectedTicket}
        open={Boolean(selectedTicket)}
        activeTab={inspectorTab}
        onTabChange={setInspectorTab}
        onClose={closeInspector}
        statusOptions={selectedTicket ? getStatusOptionsForTicket(selectedTicket.status) : []}
        onStatusChange={(nextStatus) => selectedTicket && handleStatusChangeRequest(selectedTicket.id, nextStatus)}
        busy={busyId === selectedTicket?.id}
        onAssignToMe={() => selectedTicket && handleAssignToMe(selectedTicket.id)}
        events={selectedTicketId ? eventsByTicket[selectedTicketId] || [] : []}
        eventsLoading={inspectorTab === "historial" && selectedTicketId && !eventsByTicket[selectedTicketId]}
        comments={selectedTicketId ? commentsByTicket[selectedTicketId] || [] : []}
        commentsLoading={inspectorTab === "comentarios" && selectedTicketId && !commentsByTicket[selectedTicketId]}
        commentDraft={selectedTicketId ? commentDrafts[selectedTicketId] || { text: "", visibility: "internal" } : { text: "", visibility: "internal" }}
        onCommentDraftChange={(value) => selectedTicketId && handleCommentDraftChange(selectedTicketId, value)}
        onCommentVisibilityChange={(value) => selectedTicketId && handleCommentVisibilityChange(selectedTicketId, value)}
        onSubmitComment={() => selectedTicketId && handleSubmitComment(selectedTicketId)}
        evidencePreviewUrls={evidencePreviewUrls}
        evidenceLoading={evidenceLoading}
        evidenceError={evidenceError}
      />

      <TicketStatusChangeModal
        open={Boolean(pendingStatusChange)}
        ticketCode={tickets.find((t) => t.id === pendingStatusChange?.ticketId)?.code}
        nextStatus={pendingStatusChange?.nextStatus}
        onCancel={() => setPendingStatusChange(null)}
        onConfirm={handleConfirmStatusChange}
        submitting={busyId === pendingStatusChange?.ticketId}
      />
    </div>
  );
};

export default TicketsWorkspace;
