import React from "react";
import TicketBadge from "./TicketBadge";
import { toStatusLabel } from "../../../core/utils/workflowUi";

const PRIORITY_TONE = {
  critica: "danger",
  alta: "warning",
  media: "info",
  baja: "neutral",
};

// Tarjeta de ticket para el tablero kanban. El estado ya lo comunica la
// columna que la contiene -- la tarjeta enfatiza lo que decide la siguiente
// accion: prioridad, SLA vencido y a quien pertenece.
const TicketKanbanCard = ({ ticket, selected = false, onClick }) => {
  const priorityTone = PRIORITY_TONE[String(ticket.priority || "").toLowerCase()] || "neutral";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="flex w-full flex-col gap-2 px-3 py-3 text-left transition"
      style={{
        borderRadius: "var(--ti-radius-panel)",
        border: `1px solid ${selected ? "var(--ti-accent)" : "var(--ti-border)"}`,
        background: selected ? "var(--ti-selected)" : "var(--ti-surface)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold" style={{ color: "var(--ti-text-muted)" }}>{ticket.code}</span>
        <TicketBadge tone={priorityTone}>{toStatusLabel(ticket.priority)}</TicketBadge>
      </div>

      <p className="line-clamp-2 text-sm font-semibold leading-snug" style={{ color: "var(--ti-text)" }}>{ticket.title}</p>

      <p className="truncate text-xs" style={{ color: "var(--ti-text-muted)" }}>
        {ticket.requester_name || ticket.requester_email}
      </p>

      {(ticket.sla_response_overdue || ticket.sla_resolution_overdue) ? (
        <div className="flex flex-wrap gap-1">
          {ticket.sla_response_overdue ? <TicketBadge tone="warning">SLA resp.</TicketBadge> : null}
          {ticket.sla_resolution_overdue ? <TicketBadge tone="danger">SLA resol.</TicketBadge> : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-1" style={{ borderTop: "1px solid var(--ti-border)" }}>
        <span className="truncate text-xs" style={{ color: "var(--ti-text-muted)" }}>
          {ticket.assigned_ti_name || "Sin asignar"}
        </span>
        {ticket.comments_count ? (
          <span className="text-xs font-semibold" style={{ color: "var(--ti-text-muted)" }}>{ticket.comments_count} com.</span>
        ) : null}
      </div>
    </button>
  );
};

export default TicketKanbanCard;
