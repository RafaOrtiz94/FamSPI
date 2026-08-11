import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiClock,
  FiExternalLink,
  FiImage,
  FiMessageSquare,
  FiRefreshCw,
  FiUserCheck,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import {
  addSupportTicketComment,
  assignSupportTicketToMe,
  getSupportTicketEvidenceFile,
  getSupportTicketsWorkspaceKpi,
  listSupportTicketComments,
  listSupportTicketEvents,
  listSupportTicketsWorkspace,
  updateSupportTicketStatus,
} from "../../../core/api/supportTicketsApi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/UIContext";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import { formatDurationMinutes, toStatusLabel } from "../../../core/utils/workflowUi";

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
  { value: "", label: "Todos" },
  { value: "fallo", label: "Fallos" },
  { value: "implementacion", label: "Implementaciones" },
  { value: "requerimiento", label: "Requerimientos" },
  { value: "problema", label: "Problemas" },
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
  avg_response_minutes: null,
  avg_cycle_minutes: null,
  avg_delivery_minutes: null,
};

const STATUS_BADGE_CLASS = {
  abierto: "bg-[#FEF3C7] text-[#B45309]",
  triage: "bg-[#DBEAFE] text-[#1D4ED8]",
  en_progreso: "bg-[#DBEAFE] text-[#1D4ED8]",
  en_espera: "bg-[#FEF3C7] text-[#B45309]",
  resuelto: "bg-[#DCFCE7] text-[#166534]",
  cerrado: "bg-[#F3F4F6] text-[#475569]",
  reabierto: "bg-[#FEE2E2] text-[#B91C1C]",
};

function FilterField({ label, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-sm text-[#334155]">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">{label}</span>
      {children}
    </label>
  );
}

function KpiBox({ label, value, tone = "neutral", helper }) {
  const toneClass =
    tone === "amber"
      ? "border-[#FCD34D] bg-[#FFFBEB]"
      : tone === "red"
        ? "border-[#FECACA] bg-[#FEF2F2]"
        : "border-[#E5E7EB] bg-white";
  const valueClass =
    tone === "amber" ? "text-[#B45309]" : tone === "red" ? "text-[#B91C1C]" : "text-[#0F172A]";

  return (
    <div className={`rounded-2xl border p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">{label}</p>
      <p className={`mt-3 text-2xl font-semibold leading-none ${valueClass}`}>{value}</p>
      {helper ? <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{helper}</p> : null}
    </div>
  );
}

const TicketsWorkspace = () => {
  const navigate = useNavigate();
  const { showToast } = useUI();
  const [tickets, setTickets] = useState([]);
  const [kpi, setKpi] = useState(EMPTY_KPI);
  const [eventsByTicket, setEventsByTicket] = useState({});
  const [commentsByTicket, setCommentsByTicket] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [evidencePreviewUrls, setEvidencePreviewUrls] = useState({});
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    ticket_type: "",
    q: "",
  });

  const loadTickets = useCallback(async (remoteFilters = {}) => {
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
  }, [showToast]);

  useEffect(() => {
    loadTickets({
      status: filters.status || undefined,
      ticket_type: filters.ticket_type || undefined,
      q: filters.q || undefined,
    });
  }, [filters.q, filters.status, filters.ticket_type, loadTickets]);

  useEffect(() => {
    const attachments = selectedEvidence?.evidence_photos || [];
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
  }, [selectedEvidence]);

  const filteredTickets = useMemo(() => {
    if (!filters.q.trim()) return tickets;
    const query = filters.q.trim().toLowerCase();
    return tickets.filter((ticket) =>
      [ticket.code, ticket.title, ticket.requester_name, ticket.requester_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [filters.q, tickets]);

  const handleAssignToMe = async (ticketId) => {
    setBusyId(ticketId);
    try {
      await assignSupportTicketToMe(ticketId);
      showToast("Ticket asignado", "success");
      await loadTickets({
        status: filters.status || undefined,
        ticket_type: filters.ticket_type || undefined,
        q: filters.q || undefined,
      });
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo asignar", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusChange = async (ticketId, nextStatus) => {
    setBusyId(ticketId);
    try {
      let comment = "";
      if (nextStatus === "en_espera") {
        comment = window.prompt("Motivo de espera (obligatorio)") || "";
      }
      await updateSupportTicketStatus(ticketId, { status: nextStatus, comment });
      showToast("Estado actualizado", "success");
      await loadTickets({
        status: filters.status || undefined,
        ticket_type: filters.ticket_type || undefined,
        q: filters.q || undefined,
      });
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar estado", "error");
    } finally {
      setBusyId(null);
    }
  };

  const getStatusOptionsForTicket = (currentStatus) => {
    const normalizedCurrent = String(currentStatus || "").trim().toLowerCase();
    const allowed = ALLOWED_STATUS_TRANSITIONS[normalizedCurrent];
    if (!allowed) return STATUS_OPTIONS;
    return STATUS_OPTIONS.filter((option) => option.value === normalizedCurrent || allowed.has(option.value));
  };

  const handleToggleEvents = async (ticketId) => {
    if (eventsByTicket[ticketId]) {
      setEventsByTicket((prev) => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      return;
    }

    setBusyId(ticketId);
    try {
      const events = await listSupportTicketEvents(ticketId);
      setEventsByTicket((prev) => ({ ...prev, [ticketId]: events }));
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudieron cargar eventos", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleComments = async (ticketId) => {
    if (commentsByTicket[ticketId]) {
      setCommentsByTicket((prev) => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      return;
    }

    setBusyId(ticketId);
    try {
      const comments = await listSupportTicketComments(ticketId);
      setCommentsByTicket((prev) => ({ ...prev, [ticketId]: comments }));
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudieron cargar comentarios", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleCommentDraft = (ticketId, value) => {
    setCommentDrafts((prev) => ({
      ...prev,
      [ticketId]: {
        text: value,
        visibility: prev[ticketId]?.visibility || "internal",
      },
    }));
  };

  const handleCommentVisibility = (ticketId, value) => {
    setCommentDrafts((prev) => ({
      ...prev,
      [ticketId]: {
        text: prev[ticketId]?.text || "",
        visibility: value,
      },
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
      await addSupportTicketComment(ticketId, {
        message: draft.text,
        visibility: draft.visibility,
      });
      showToast("Comentario guardado", "success");
      const comments = await listSupportTicketComments(ticketId);
      setCommentsByTicket((prev) => ({ ...prev, [ticketId]: comments }));
      setCommentDrafts((prev) => ({
        ...prev,
        [ticketId]: { text: "", visibility: prev[ticketId]?.visibility || "internal" },
      }));
      await loadTickets({
        status: filters.status || undefined,
        ticket_type: filters.ticket_type || undefined,
        q: filters.q || undefined,
      });
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo guardar comentario", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-5`}>
      <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-[0_15px_35px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">Workspace TI</p>
            <h1 className="mt-2 text-[clamp(1.5rem,3vw,2rem)] font-bold leading-tight tracking-[-0.02em] text-[#0F172A]">
              Tickets de soporte interno
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
              Prioriza incidencias, revisa evidencia fotográfica y conserva el hilo operativo entre solicitante y TI.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => navigate("/dashboard/ti/casos-externos")}
            >
              Casos externos ST-01-04
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              icon={FiRefreshCw}
              onClick={() => loadTickets({
                status: filters.status || undefined,
                ticket_type: filters.ticket_type || undefined,
                q: filters.q || undefined,
              })}
            >
              Recargar
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <KpiBox label="Abiertos" value={kpi.abiertos || 0} />
        <KpiBox label="Triage" value={kpi.triage || 0} />
        <KpiBox label="En progreso" value={kpi.en_progreso || 0} />
        <KpiBox label="En espera" value={kpi.en_espera || 0} />
        <KpiBox label="Terminados" value={kpi.terminados || 0} />
        <KpiBox label="SLA resp. vencido" value={kpi.response_overdue || 0} tone="amber" />
        <KpiBox label="SLA resol. vencido" value={kpi.resolution_overdue || 0} tone="red" />
        <KpiBox label="Total" value={kpi.total || 0} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <Card className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">Primera respuesta</p>
              <p className="mt-2 text-xl font-semibold text-[#0F172A]">{formatDurationMinutes(kpi.avg_response_minutes)}</p>
              <p className="mt-1 text-xs text-[#64748B]">Creación a primera acción de TI.</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">Ciclo total</p>
              <p className="mt-2 text-xl font-semibold text-[#0F172A]">{formatDurationMinutes(kpi.avg_cycle_minutes)}</p>
              <p className="mt-1 text-xs text-[#64748B]">Creación a cierre técnico.</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">Entrega TI</p>
              <p className="mt-2 text-xl font-semibold text-[#0F172A]">{formatDurationMinutes(kpi.avg_delivery_minutes)}</p>
              <p className="mt-1 text-xs text-[#64748B]">En progreso a resolución.</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <FiClock className="text-[#2563EB]" />
            <h2 className="text-base font-semibold text-[#0F172A]">Filtros operativos</h2>
          </div>

          <div className="grid gap-4">
            <FilterField label="Estado">
              <select
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
              >
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Tipo">
              <select
                value={filters.ticket_type}
                onChange={(event) => setFilters((prev) => ({ ...prev, ticket_type: event.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Buscar">
              <input
                value={filters.q}
                onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
                placeholder="Código, título o solicitante"
                className="min-h-[44px] w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none transition placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </FilterField>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-8 text-sm text-[#64748B] shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            Cargando tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <FiAlertTriangle size={28} className="text-[#94A3B8]" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#0F172A]">No hay tickets con los filtros seleccionados</p>
              <p className="text-xs leading-relaxed text-[#64748B]">Prueba con otro estado, tipo o texto de búsqueda.</p>
            </div>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const draft = commentDrafts[ticket.id] || { text: "", visibility: "internal" };
            const normalizedStatus = String(ticket.status || "").trim().toLowerCase();

            return (
              <article key={ticket.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#64748B]">{ticket.code}</span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${STATUS_BADGE_CLASS[normalizedStatus] || "bg-[#F3F4F6] text-[#475569]"}`}>
                        {toStatusLabel(ticket.status)}
                      </span>
                      <span className="inline-flex rounded-full bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold capitalize text-[#475569]">
                        {toStatusLabel(ticket.ticket_type, "Sin tipo")}
                      </span>
                      {ticket.evidence_photos?.length ? (
                        <button
                          type="button"
                          onClick={() => setSelectedEvidence(ticket)}
                          className="inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded-full bg-[#DBEAFE] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] transition hover:bg-[#BFDBFE]"
                        >
                          <FiImage size={12} />
                          {ticket.evidence_photos.length} evidencia{ticket.evidence_photos.length !== 1 ? "s" : ""}
                        </button>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold leading-tight text-[#0F172A]">{ticket.title}</h3>
                      <p className="max-w-4xl text-sm leading-relaxed text-[#334155]">{ticket.description}</p>
                    </div>

                    <div className="grid gap-2 text-sm text-[#475569] md:grid-cols-2 xl:grid-cols-3">
                      <p><span className="font-semibold text-[#0F172A]">Solicitante:</span> {ticket.requester_name || ticket.requester_email}</p>
                      <p><span className="font-semibold text-[#0F172A]">Asignado TI:</span> {ticket.assigned_ti_name || "Sin asignar"}</p>
                      <p><span className="font-semibold text-[#0F172A]">Prioridad:</span> {ticket.priority}</p>
                      <p><span className="font-semibold text-[#0F172A]">Impacto:</span> {ticket.impact || "medio"}</p>
                      <p><span className="font-semibold text-[#0F172A]">Urgencia:</span> {ticket.urgency || "medio"}</p>
                      <p><span className="font-semibold text-[#0F172A]">Comentarios:</span> {ticket.comments_count || 0}</p>
                    </div>

                    <div className="grid gap-2 text-xs text-[#64748B] md:grid-cols-3">
                      <p><span className="font-semibold text-[#334155]">Tiempo respuesta:</span> {formatDurationMinutes(ticket.response_minutes)}</p>
                      <p><span className="font-semibold text-[#334155]">Ciclo total:</span> {formatDurationMinutes(ticket.cycle_minutes)}</p>
                      <p><span className="font-semibold text-[#334155]">Entrega TI:</span> {formatDurationMinutes(ticket.delivery_minutes)}</p>
                    </div>

                    {(ticket.sla_response_overdue || ticket.sla_resolution_overdue) ? (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {ticket.sla_response_overdue ? (
                          <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 font-semibold text-[#B45309]">SLA respuesta vencido</span>
                        ) : null}
                        {ticket.sla_resolution_overdue ? (
                          <span className="rounded-full bg-[#FEE2E2] px-2.5 py-1 font-semibold text-[#B91C1C]">SLA resolución vencido</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex w-full flex-col gap-3 xl:w-[240px]">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={FiUserCheck}
                      onClick={() => handleAssignToMe(ticket.id)}
                      disabled={busyId === ticket.id}
                    >
                      Asignarme
                    </Button>

                    <select
                      value={ticket.status}
                      disabled={busyId === ticket.id}
                      onChange={(event) => handleStatusChange(ticket.id, event.target.value)}
                      className="min-h-[40px] w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
                    >
                      {getStatusOptionsForTicket(ticket.status).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>

                    {ticket.evidence_photos?.length ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={FiImage}
                        onClick={() => setSelectedEvidence(ticket)}
                      >
                        Ver evidencias
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleEvents(ticket.id)}
                    disabled={busyId === ticket.id}
                  >
                    {eventsByTicket[ticket.id] ? "Ocultar historial" : "Ver historial"}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    icon={FiMessageSquare}
                    onClick={() => handleToggleComments(ticket.id)}
                    disabled={busyId === ticket.id}
                  >
                    {commentsByTicket[ticket.id] ? "Ocultar comentarios" : "Ver comentarios"}
                  </Button>
                </div>

                {eventsByTicket[ticket.id] ? (
                  <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                    {eventsByTicket[ticket.id].length === 0 ? (
                      <p className="text-xs text-[#64748B]">Sin eventos registrados.</p>
                    ) : (
                      <div className="space-y-2">
                        {eventsByTicket[ticket.id].map((event) => (
                          <div key={event.id} className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#475569]">
                            <span className="font-semibold text-[#0F172A]">{event.event_type}</span>
                            {event.old_status || event.new_status
                              ? ` (${toStatusLabel(event.old_status)} -> ${toStatusLabel(event.new_status)})`
                              : ""}
                            {" · "}
                            {event.actor_name || "Sistema"}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {commentsByTicket[ticket.id] ? (
                  <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                    <div className="space-y-2">
                      {commentsByTicket[ticket.id].length === 0 ? (
                        <p className="text-xs text-[#64748B]">Sin comentarios.</p>
                      ) : (
                        commentsByTicket[ticket.id].map((comment) => (
                          <div key={comment.id} className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2">
                            <p className="text-[11px] text-[#64748B]">
                              <span className="font-semibold text-[#0F172A]">{comment.author_name || comment.author_email || "Usuario"}</span>
                              {" · "}
                              {comment.visibility}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-[#334155]">{comment.message}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-4 grid gap-2 lg:grid-cols-[160px_minmax(0,1fr)_120px]">
                      <select
                        value={draft.visibility}
                        onChange={(event) => handleCommentVisibility(ticket.id, event.target.value)}
                        className="min-h-[40px] rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
                      >
                        <option value="internal">Interno TI</option>
                        <option value="public">Público</option>
                      </select>

                      <input
                        value={draft.text}
                        onChange={(event) => handleCommentDraft(ticket.id, event.target.value)}
                        placeholder="Agregar comentario operativo..."
                        className="min-h-[40px] rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none transition placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
                      />

                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busyId === ticket.id}
                        onClick={() => handleSubmitComment(ticket.id)}
                      >
                        Publicar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      <Modal open={Boolean(selectedEvidence)} onClose={() => setSelectedEvidence(null)} title="Evidencia del ticket" maxWidth="max-w-4xl">
        {selectedEvidence?.evidence_photos?.length ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              <p className="font-mono text-xs font-semibold text-[#64748B]">{selectedEvidence.code}</p>
              <h3 className="mt-2 text-lg font-semibold text-[#0F172A]">{selectedEvidence.title}</h3>
              <p className="mt-1 text-sm text-[#64748B]">
                {selectedEvidence.evidence_photos.length} evidencia{selectedEvidence.evidence_photos.length !== 1 ? "s" : ""} adjunta{selectedEvidence.evidence_photos.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="min-h-56 rounded-2xl border border-[#E5E7EB] bg-white p-3">
              {evidenceLoading ? <p className="text-sm text-[#64748B]">Cargando evidencia...</p> : null}
              {!evidenceLoading && evidenceError ? <p className="px-5 text-center text-sm text-[#DC2626]">{evidenceError}</p> : null}
              {!evidenceLoading && !evidenceError ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectedEvidence.evidence_photos.map((attachment, index) => (
                    <a
                      key={attachment.id}
                      href={evidencePreviewUrls[attachment.id] || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] transition hover:border-[#93C5FD]"
                    >
                      {evidencePreviewUrls[attachment.id] ? (
                        <img
                          src={evidencePreviewUrls[attachment.id]}
                          alt={`Evidencia ${index + 1} del ticket ${selectedEvidence.code}`}
                          className="h-64 w-full bg-white object-contain"
                        />
                      ) : null}
                      <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <span className="truncate font-medium text-[#334155]">{attachment.file_name || `Evidencia ${index + 1}`}</span>
                        <FiExternalLink size={13} className="shrink-0 text-[#2563EB]" />
                      </div>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default TicketsWorkspace;
