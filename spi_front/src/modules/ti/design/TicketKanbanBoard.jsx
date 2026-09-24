import React from "react";
import { useDroppable } from "@dnd-kit/core";
import TicketKanbanCard from "./TicketKanbanCard";

// Una columna es una zona de soltar (useDroppable) identificada por el
// value de estado (ej. "en_progreso"). TicketsWorkspace.jsx interpreta el
// `over.id` del evento onDragEnd como el nuevo estado destino.
function KanbanColumn({ column, selectedId, onSelectTicket }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div className="flex w-[280px] shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ti-text-muted)" }}>
          {column.label}
        </p>
        <span className="fam-numeric text-xs font-semibold" style={{ color: "var(--ti-text-muted)" }}>
          {column.tickets.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex min-h-[80px] flex-col gap-2 p-2 transition-colors"
        style={{
          background: isOver ? "var(--ti-selected)" : "var(--ti-surface-sunken)",
          borderRadius: "var(--ti-radius-panel)",
          outline: isOver ? "2px solid var(--ti-accent)" : "none",
          outlineOffset: "-2px",
        }}
      >
        {column.tickets.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs" style={{ color: "var(--ti-text-muted)" }}>Sin tickets</p>
        ) : (
          column.tickets.map((ticket) => (
            <TicketKanbanCard
              key={ticket.id}
              ticket={ticket}
              selected={ticket.id === selectedId}
              onClick={() => onSelectTicket(ticket.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Tablero de columnas por estado, arrastrable con mouse y con el dedo
// (@dnd-kit/core: PointerSensor para mouse, TouchSensor para tactil -- ver
// el DndContext que lo envuelve en TicketsWorkspace.jsx). Estructura base
// reutilizada de spi_front/src/modules/servicio/components/
// CorrectiveCaseBoard.jsx, ahora con los tokens .ti-scope.
const TicketKanbanBoard = ({ columns, selectedId, onSelectTicket }) => (
  <div className="flex gap-3 overflow-x-auto pb-2">
    {columns.map((column) => (
      <KanbanColumn key={column.key} column={column} selectedId={selectedId} onSelectTicket={onSelectTicket} />
    ))}
  </div>
);

export default TicketKanbanBoard;
