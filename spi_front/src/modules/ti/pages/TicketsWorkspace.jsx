import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiMessageSquare, FiRefreshCw, FiUserCheck } from "react-icons/fi";
import {
  addSupportTicketComment,
  assignSupportTicketToMe,
  getSupportTicketsWorkspaceKpi,
  listSupportTicketComments,
  listSupportTicketEvents,
  listSupportTicketsWorkspace,
  updateSupportTicketStatus,
} from "../../../core/api/supportTicketsApi";
import { useUI } from "../../../core/ui/UIContext";

const STATUS_OPTIONS = [
  { value: "abierto", label: "Abierto" },
  { value: "triage", label: "Triage" },
  { value: "en_progreso", label: "En progreso" },
  { value: "en_espera", label: "En espera" },
  { value: "resuelto", label: "Terminado" },
  { value: "cerrado", label: "Cerrado" },
  { value: "reabierto", label: "Reabierto" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "fallo", label: "Fallos" },
  { value: "implementacion", label: "Implementaciones" },
  { value: "requerimiento", label: "Requerimientos" },
  { value: "problema", label: "Problemas" },
];

const toLabel = (text) => String(text || "").replace("_", " ");
const formatMinutes = (minutes) => {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return "-";
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);
  return `${hours}h ${mins}m`;
};

const TicketsWorkspace = () => {
  const { showToast } = useUI();
  const [tickets, setTickets] = useState([]);
  const [kpi, setKpi] = useState({
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
  });
  const [eventsByTicket, setEventsByTicket] = useState({});
  const [commentsByTicket, setCommentsByTicket] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
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
      setKpi(kpiData || {});
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
  }, [filters.status, filters.ticket_type, filters.q, loadTickets]);

  const filteredTickets = useMemo(() => {
    if (!filters.q.trim()) return tickets;
    const query = filters.q.trim().toLowerCase();
    return tickets.filter((ticket) =>
      [ticket.code, ticket.title, ticket.requester_name, ticket.requester_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [tickets, filters.q]);

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
    <div className="space-y-6 p-2 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workspace TI: Tickets</h1>
          <p className="text-sm text-slate-600">Mesa de soporte madura con SLA, estados operativos y trazabilidad.</p>
        </div>
        <button
          type="button"
          onClick={() =>
            loadTickets({
              status: filters.status || undefined,
              ticket_type: filters.ticket_type || undefined,
              q: filters.q || undefined,
            })
          }
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <FiRefreshCw />
          Recargar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs uppercase text-slate-500">Abiertos</p><p className="text-xl font-bold text-slate-900">{kpi.abiertos || 0}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs uppercase text-slate-500">Triage</p><p className="text-xl font-bold text-slate-900">{kpi.triage || 0}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs uppercase text-slate-500">En progreso</p><p className="text-xl font-bold text-slate-900">{kpi.en_progreso || 0}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs uppercase text-slate-500">En espera</p><p className="text-xl font-bold text-slate-900">{kpi.en_espera || 0}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs uppercase text-slate-500">Terminados</p><p className="text-xl font-bold text-slate-900">{kpi.terminados || 0}</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs uppercase text-amber-700">SLA resp. vencido</p><p className="text-xl font-bold text-amber-900">{kpi.response_overdue || 0}</p></div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="text-xs uppercase text-rose-700">SLA resol. vencido</p><p className="text-xl font-bold text-rose-900">{kpi.resolution_overdue || 0}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs uppercase text-slate-500">Total</p><p className="text-xl font-bold text-slate-900">{kpi.total || 0}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-slate-500">KPI respuesta inicial</p>
          <p className="text-lg font-semibold text-slate-900">{formatMinutes(kpi.avg_response_minutes)}</p>
          <p className="text-xs text-slate-500">Creacion a primera respuesta TI</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">KPI ciclo total</p>
          <p className="text-lg font-semibold text-slate-900">{formatMinutes(kpi.avg_cycle_minutes)}</p>
          <p className="text-xs text-slate-500">Creacion a terminado</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">KPI entrega TI</p>
          <p className="text-lg font-semibold text-slate-900">{formatMinutes(kpi.avg_delivery_minutes)}</p>
          <p className="text-xs text-slate-500">En progreso a terminado</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <label className="text-sm text-slate-700">
          Estado
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-700">
          Tipo
          <select
            value={filters.ticket_type}
            onChange={(e) => setFilters((prev) => ({ ...prev, ticket_type: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-700">
          Buscar
          <input
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            placeholder="Codigo, titulo o solicitante"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando tickets...</p>
        ) : filteredTickets.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            No hay tickets con los filtros seleccionados.
          </p>
        ) : (
          filteredTickets.map((ticket) => {
            const draft = commentDrafts[ticket.id] || { text: "", visibility: "internal" };
            return (
              <div key={ticket.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ticket.code}</p>
                    <h3 className="text-base font-semibold text-slate-900">{ticket.title}</h3>
                    <p className="text-xs capitalize text-slate-500">
                      {toLabel(ticket.ticket_type)} � prioridad {ticket.priority} � impacto {ticket.impact || "medio"} � urgencia {ticket.urgency || "medio"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAssignToMe(ticket.id)}
                      disabled={busyId === ticket.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <FiUserCheck size={14} />
                      Asignarme
                    </button>
                    <select
                      value={ticket.status}
                      disabled={busyId === ticket.id}
                      onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="mt-2 text-sm text-slate-700">{ticket.description}</p>

                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <p><span className="font-semibold">Solicitante:</span> {ticket.requester_name || ticket.requester_email}</p>
                  <p><span className="font-semibold">Asignado TI:</span> {ticket.assigned_ti_name || "Sin asignar"}</p>
                  <p><span className="font-semibold">Estado:</span> {toLabel(ticket.status)}</p>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <p><span className="font-semibold">Tiempo respuesta:</span> {formatMinutes(ticket.response_minutes)}</p>
                  <p><span className="font-semibold">Ciclo total:</span> {formatMinutes(ticket.cycle_minutes)}</p>
                  <p><span className="font-semibold">Entrega TI:</span> {formatMinutes(ticket.delivery_minutes)}</p>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {ticket.sla_response_overdue && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">SLA respuesta vencido</span>
                  )}
                  {ticket.sla_resolution_overdue && (
                    <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">SLA resolucion vencido</span>
                  )}
                  {!!ticket.comments_count && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Comentarios: {ticket.comments_count}</span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleEvents(ticket.id)}
                    disabled={busyId === ticket.id}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {eventsByTicket[ticket.id] ? "Ocultar historial" : "Ver historial"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleComments(ticket.id)}
                    disabled={busyId === ticket.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    <FiMessageSquare size={14} />
                    {commentsByTicket[ticket.id] ? "Ocultar comentarios" : "Ver comentarios"}
                  </button>
                </div>

                {eventsByTicket[ticket.id] && (
                  <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {eventsByTicket[ticket.id].length === 0 ? (
                      <p className="text-xs text-slate-500">Sin eventos registrados.</p>
                    ) : (
                      eventsByTicket[ticket.id].map((event) => (
                        <p key={event.id} className="text-xs text-slate-600">
                          <span className="font-semibold">{event.event_type}</span>
                          {event.old_status || event.new_status
                            ? ` (${toLabel(event.old_status)} -> ${toLabel(event.new_status)})`
                            : ""}
                          {" � "}
                          {event.actor_name || "Sistema"}
                        </p>
                      ))
                    )}
                  </div>
                )}

                {commentsByTicket[ticket.id] && (
                  <div className="mt-2 space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
                    <div className="max-h-44 space-y-1 overflow-y-auto">
                      {commentsByTicket[ticket.id].length === 0 ? (
                        <p className="text-xs text-slate-500">Sin comentarios.</p>
                      ) : (
                        commentsByTicket[ticket.id].map((comment) => (
                          <div key={comment.id} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                            <p className="text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-700">{comment.author_name || comment.author_email || "Usuario"}</span>
                              {" � "}{comment.visibility}
                            </p>
                            <p className="text-xs text-slate-700">{comment.message}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                      <select
                        value={draft.visibility}
                        onChange={(e) => handleCommentVisibility(ticket.id, e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs sm:col-span-2"
                      >
                        <option value="internal">Interno TI</option>
                        <option value="public">Publico</option>
                      </select>
                      <input
                        value={draft.text}
                        onChange={(e) => handleCommentDraft(ticket.id, e.target.value)}
                        placeholder="Agregar comentario..."
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs sm:col-span-3"
                      />
                      <button
                        type="button"
                        disabled={busyId === ticket.id}
                        onClick={() => handleSubmitComment(ticket.id)}
                        className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        Publicar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TicketsWorkspace;
