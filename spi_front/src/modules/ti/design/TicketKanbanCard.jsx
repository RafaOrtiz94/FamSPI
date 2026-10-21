import React from "react";
import { useDraggable } from "@dnd-kit/core";
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
//
// Arrastrable con @dnd-kit/core (useDraggable): el id del draggable es el id
// del ticket, TicketsWorkspace.jsx lo mapea a un cambio de estado en
// onDragEnd. El "clic para abrir el inspector" sigue funcionando porque el
// PointerSensor exige moverse >8px (o el TouchSensor, mantener >150ms) antes
// de activar el arrastre -- un tap/clic sin movimiento sigue disparando
// onClick normalmente.
const TicketKanbanCard = ({ ticket, selected = false, onClick }) => {
  const priorityTone = PRIORITY_TONE[String(ticket.priority || "").toLowerCase()] || "neutral";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id });

  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={onClick}
      aria-pressed={selected}
      aria-roledescription="Ticket arrastrable"
      className="flex w-full flex-col gap-2 px-3 py-3 text-left transition touch-none"
      style={{
        borderRadius: "var(--ti-radius-panel)",
        border: `1px solid ${selected ? "var(--ti-accent)" : "var(--ti-border)"}`,
        background: selected ? "var(--ti-selected)" : "var(--ti-surface)",
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? "grabbing" : "grab",
        zIndex: isDragging ? 10 : "auto",
        position: "relative",
      }}
      {...listeners}
      {...attributes}
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
