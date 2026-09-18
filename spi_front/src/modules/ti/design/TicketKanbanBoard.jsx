import React from "react";
import TicketKanbanCard from "./TicketKanbanCard";

// Tablero de columnas por estado. Patron reutilizado (sin drag-and-drop, clic
// para abrir el inspector) de spi_front/src/modules/servicio/components/
// CorrectiveCaseBoard.jsx -- mismo lenguaje visual ya validado en el modulo
// hermano de servicio tecnico, ahora con los tokens .ti-scope.
const TicketKanbanBoard = ({ columns, selectedId, onSelectTicket }) => (
  <div className="flex gap-3 overflow-x-auto pb-2">
    {columns.map((column) => (
      <div key={column.key} className="flex w-[280px] shrink-0 flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ti-text-muted)" }}>
            {column.label}
          </p>
          <span className="fam-numeric text-xs font-semibold" style={{ color: "var(--ti-text-muted)" }}>
            {column.tickets.length}
          </span>
        </div>

        <div
          className="flex min-h-[80px] flex-col gap-2 p-2"
          style={{ background: "var(--ti-surface-sunken)", borderRadius: "var(--ti-radius-panel)" }}
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
    ))}
  </div>
);

export default TicketKanbanBoard;
