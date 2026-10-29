import React, { useEffect, useState } from "react";
import { FiX, FiUserCheck, FiImage, FiExternalLink } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import TicketBadge, { statusToTone } from "./TicketBadge";
import { formatDurationMinutes, toStatusLabel } from "../../../core/utils/workflowUi";

const TABS = [
  { key: "detalle", label: "Detalle" },
  { key: "historial", label: "Historial" },
  { key: "comentarios", label: "Comentarios" },
  { key: "evidencia", label: "Evidencia" },
];

// Panel lateral (drawer) del ticket seleccionado. Reemplaza la expansion
// inline por card que multiplicaba el alto de la pagina -- DESIGN.md §7
// ("inspeccionar un registro abre el panel contextual y conserva filtros,
// seleccion y posicion"). 320-400px en >=1200px (aqui fijo en 400px via
// max-w), pantalla completa en breakpoints menores.
const TicketInspector = ({
  ticket,
  open,
  activeTab = "detalle",
  onTabChange,
  onClose,
  statusOptions = [],
  onStatusChange,
  busy = false,
  onAssignToMe,
  events = [],
  eventsLoading = false,
  comments = [],
  commentsLoading = false,
  commentDraft = { text: "", visibility: "internal" },
  onCommentDraftChange,
  onCommentVisibilityChange,
  onSubmitComment,
  evidencePreviewUrls = {},
  evidenceLoading = false,
  evidenceError = "",
}) => {
  const [localTab, setLocalTab] = useState(activeTab);

  useEffect(() => {
    setLocalTab(activeTab);
  }, [activeTab, ticket?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !ticket) return null;

  const setTab = (key) => {
    setLocalTab(key);
    onTabChange?.(key);
  };

  const normalizedStatus = String(ticket.status || "").trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="presentation">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(16, 24, 32, 0.45)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Ticket ${ticket.code}`}
        className="relative flex h-full w-full flex-col overflow-hidden sm:w-[420px]"
        style={{ background: "var(--ti-surface)", boxShadow: "var(--ti-shadow-overlay)" }}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--ti-border)" }}>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold" style={{ color: "var(--ti-text-muted)" }}>{ticket.code}</span>
              <TicketBadge tone={statusToTone(normalizedStatus)}>{toStatusLabel(ticket.status)}</TicketBadge>
            </div>
            <h2 className="truncate text-base font-semibold" style={{ color: "var(--ti-text)" }}>{ticket.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle del ticket"
            className="shrink-0 p-2 transition"
            style={{ borderRadius: "var(--ti-radius-control)", color: "var(--ti-text-muted)" }}
          >
            <FiX size={18} />
          </button>
        </header>

        <nav className="flex gap-1 px-3 pt-3" role="tablist" aria-label="Secciones del ticket">
          {TABS.map((tab) => {
            const isActive = localTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(tab.key)}
                className="min-h-[36px] px-3 text-sm font-semibold transition"
                style={{
                  borderRadius: "var(--ti-radius-control)",
                  background: isActive ? "var(--ti-selected)" : "transparent",
                  color: isActive ? "var(--ti-accent)" : "var(--ti-text-muted)",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {localTab === "detalle" ? (
            <div className="space-y-4 text-sm">
              <p className="leading-relaxed" style={{ color: "var(--ti-text)" }}>{ticket.description}</p>

              <div className="grid gap-2" style={{ color: "var(--ti-text)" }}>
                <p><span className="font-semibold">Solicitante:</span> {ticket.requester_name || ticket.requester_email}</p>
                <p><span className="font-semibold">Asignado TI:</span> {ticket.assigned_ti_name || "Sin asignar"}</p>
                <p><span className="font-semibold">Tipo:</span> {toStatusLabel(ticket.ticket_type, "Sin tipo")}</p>
                <p><span className="font-semibold">Prioridad:</span> {ticket.priority}</p>
                <p><span className="font-semibold">Impacto:</span> {ticket.impact || "medio"}</p>
                <p><span className="font-semibold">Urgencia:</span> {ticket.urgency || "medio"}</p>
              </div>

              <div className="grid gap-2 text-xs" style={{ color: "var(--ti-text-muted)" }}>
                <p><span className="font-semibold">Tiempo respuesta:</span> {formatDurationMinutes(ticket.response_minutes)}</p>
                <p><span className="font-semibold">Ciclo total:</span> {formatDurationMinutes(ticket.cycle_minutes)}</p>
                <p><span className="font-semibold">Entrega TI:</span> {formatDurationMinutes(ticket.delivery_minutes)}</p>
              </div>

              {(ticket.sla_response_overdue || ticket.sla_resolution_overdue) ? (
                <div className="flex flex-wrap gap-2">
                  {ticket.sla_response_overdue ? <TicketBadge tone="warning">SLA respuesta vencido</TicketBadge> : null}
                  {ticket.sla_resolution_overdue ? <TicketBadge tone="danger">SLA resolucion vencido</TicketBadge> : null}
                </div>
              ) : null}

              <div className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--ti-border)" }}>
                <Button size="sm" variant="secondary" icon={FiUserCheck} onClick={onAssignToMe} disabled={busy}>
                  Asignarme
                </Button>

                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ti-text-muted)" }}>
                    Cambiar estado
                  </span>
                  <select
                    value={ticket.status}
                    disabled={busy}
                    onChange={(event) => onStatusChange?.(event.target.value)}
                    className="w-full px-3 py-2 text-sm outline-none transition"
                    style={{
                      minHeight: "var(--ti-control-height)",
                      borderRadius: "var(--ti-radius-control)",
                      border: "1px solid var(--ti-border-control)",
                      background: "var(--ti-surface)",
                      color: "var(--ti-text)",
                    }}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {localTab === "historial" ? (
            <div className="space-y-2">
              {eventsLoading ? (
                <p className="text-sm" style={{ color: "var(--ti-text-muted)" }}>Cargando historial...</p>
              ) : events.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ti-text-muted)" }}>Sin eventos registrados.</p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="px-3 py-2 text-xs"
                    style={{ borderRadius: "var(--ti-radius-control)", border: "1px solid var(--ti-border)", color: "var(--ti-text-muted)" }}
                  >
                    <span className="font-semibold" style={{ color: "var(--ti-text)" }}>{event.event_type}</span>
                    {event.old_status || event.new_status ? ` (${toStatusLabel(event.old_status)} -> ${toStatusLabel(event.new_status)})` : ""}
                    {" · "}
                    {event.actor_name || "Sistema"}
                  </div>
                ))
              )}
            </div>
          ) : null}

          {localTab === "comentarios" ? (
            <div className="space-y-3">
              {commentsLoading ? (
                <p className="text-sm" style={{ color: "var(--ti-text-muted)" }}>Cargando comentarios...</p>
              ) : comments.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ti-text-muted)" }}>Sin comentarios.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="px-3 py-2" style={{ borderRadius: "var(--ti-radius-control)", border: "1px solid var(--ti-border)" }}>
                    <p className="text-[11px]" style={{ color: "var(--ti-text-muted)" }}>
                      <span className="font-semibold" style={{ color: "var(--ti-text)" }}>{comment.author_name || comment.author_email || "Usuario"}</span>
                      {" · "}
                      {comment.visibility === "internal" ? "Interno TI" : "Publico"}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--ti-text)" }}>{comment.message}</p>
                  </div>
                ))
              )}

              <div className="space-y-2 pt-2" style={{ borderTop: "1px solid var(--ti-border)" }}>
                <select
                  value={commentDraft.visibility}
                  onChange={(event) => onCommentVisibilityChange?.(event.target.value)}
                  className="w-full px-3 py-2 text-sm outline-none"
                  style={{ minHeight: "var(--ti-control-height)", borderRadius: "var(--ti-radius-control)", border: "1px solid var(--ti-border-control)", background: "var(--ti-surface)", color: "var(--ti-text)" }}
                >
                  <option value="internal">Interno TI</option>
                  <option value="public">Publico</option>
                </select>
                <textarea
                  value={commentDraft.text}
                  onChange={(event) => onCommentDraftChange?.(event.target.value)}
                  rows={3}
                  placeholder="Agregar comentario operativo..."
                  className="w-full resize-none px-3 py-2 text-sm outline-none"
                  style={{ borderRadius: "var(--ti-radius-control)", border: "1px solid var(--ti-border-control)", background: "var(--ti-surface)", color: "var(--ti-text)" }}
                />
                <Button size="sm" variant="primary" disabled={busy} onClick={onSubmitComment} className="w-full justify-center">
                  Publicar
                </Button>
              </div>
            </div>
          ) : null}

          {localTab === "evidencia" ? (
            <div className="space-y-3">
              {!ticket.evidence_photos?.length ? (
                <p className="text-sm" style={{ color: "var(--ti-text-muted)" }}>Sin evidencia adjunta.</p>
              ) : evidenceLoading ? (
                <p className="text-sm" style={{ color: "var(--ti-text-muted)" }}>Cargando evidencia...</p>
              ) : evidenceError ? (
                <p className="text-sm" style={{ color: "var(--ti-danger-text)" }}>{evidenceError}</p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {ticket.evidence_photos.map((attachment, index) => (
                    <a
                      key={attachment.id}
                      href={evidencePreviewUrls[attachment.id] || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden"
                      style={{ borderRadius: "var(--ti-radius-panel)", border: "1px solid var(--ti-border)" }}
                    >
                      {evidencePreviewUrls[attachment.id] ? (
                        <img
                          src={evidencePreviewUrls[attachment.id]}
                          alt={`Evidencia ${index + 1} del ticket ${ticket.code}`}
                          className="h-48 w-full object-contain"
                          style={{ background: "var(--ti-surface-sunken)" }}
                        />
                      ) : null}
                      <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs" style={{ color: "var(--ti-text-muted)" }}>
                        <span className="truncate font-medium">{attachment.file_name || `Evidencia ${index + 1}`}</span>
                        <FiExternalLink size={13} style={{ color: "var(--ti-accent)" }} />
                      </div>
                    </a>
                  ))}
                  <p className="flex items-center gap-1 text-xs" style={{ color: "var(--ti-text-muted)" }}>
                    <FiImage size={12} /> {ticket.evidence_photos.length} evidencia{ticket.evidence_photos.length !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
};

export default TicketInspector;
