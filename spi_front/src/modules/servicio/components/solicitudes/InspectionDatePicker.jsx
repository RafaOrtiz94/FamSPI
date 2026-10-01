import React, { useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

const toKey = (date) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const buildWeeks = (anchor) => {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leadingBlank = (firstOfMonth.getDay() + 6) % 7; // Lun=0
  const start = new Date(year, month, 1 - leadingBlank);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
};

/**
 * Selector de fecha compacto para asignar una inspeccion dentro (o antes) de
 * la ventana propuesta -- reemplaza el <input type="date"> nativo, que no
 * comunicaba visualmente cual era la ventana original vs. eleccion libre
 * (pedido explicito del plan de rework, §3.2). `ServicioCalendarGrid` (mes
 * completo con eventos, 92px por celda) es para el cronograma del equipo,
 * demasiado pesado para elegir una sola fecha aqui -- este es su primo
 * chico, sin eventos, sin libreria externa.
 *
 * Reglas visuales: dias dentro de [minDate,maxDate] llevan el tinte de
 * "ventana propuesta"; el resto son eleccion libre (permitido, ST fix de
 * esta sesion: sin min real, solo se bloquea pasarse del max); dias despues
 * de maxDate quedan deshabilitados.
 */
const InspectionDatePicker = ({ minDate, maxDate, value, onChange }) => {
  const initialAnchor = useMemo(() => new Date(value || minDate || Date.now()), [value, minDate]);
  const [anchor, setAnchor] = useState(() => new Date(initialAnchor.getFullYear(), initialAnchor.getMonth(), 1));

  const weeks = useMemo(() => buildWeeks(anchor), [anchor]);
  const monthLabel = anchor.toLocaleDateString("es-EC", { month: "long", year: "numeric" });
  const maxKey = maxDate ? toKey(maxDate) : null;
  const minKey = minDate ? toKey(minDate) : null;
  const todayKey = toKey(new Date());

  return (
    <div className="rounded-[var(--st-radius-md)] border p-3" style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold capitalize" style={{ color: "var(--st-text)" }}>{monthLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="cursor-pointer rounded-[3px] p-1 hover:bg-[var(--st-surface-sunken)]"
            aria-label="Mes anterior"
          >
            <FiChevronLeft size={13} style={{ color: "var(--st-text-muted)" }} />
          </button>
          <button
            type="button"
            onClick={() => setAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="cursor-pointer rounded-[3px] p-1 hover:bg-[var(--st-surface-sunken)]"
            aria-label="Mes siguiente"
          >
            <FiChevronRight size={13} style={{ color: "var(--st-text-muted)" }} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-center text-[10px] font-semibold uppercase" style={{ color: "var(--st-text-faint)" }}>
            {day}
          </span>
        ))}
        {weeks.map((date) => {
          const key = toKey(date);
          const inMonth = date.getMonth() === anchor.getMonth();
          const disabled = maxKey ? key > maxKey : false;
          const inProposedWindow = minKey && maxKey && key >= minKey && key <= maxKey;
          const isSelected = key === value;
          const isToday = key === todayKey;

          let background = "transparent";
          let color = "var(--st-text)";
          if (isSelected) {
            background = "var(--st-accent)";
            color = "#fff";
          } else if (inProposedWindow) {
            background = "var(--st-accent-soft)";
            color = "var(--st-accent-strong)";
          }

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(key)}
              className="flex h-7 items-center justify-center rounded-[3px] text-xs font-medium transition-colors duration-100 disabled:cursor-not-allowed"
              style={{
                background,
                color: disabled ? "var(--st-text-faint)" : color,
                opacity: inMonth ? (disabled ? 0.35 : 1) : 0.3,
                outline: isToday && !isSelected ? "1px solid var(--st-border)" : "none",
              }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px]" style={{ color: "var(--st-text-faint)" }}>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: "var(--st-accent-soft)" }} />
          Ventana propuesta
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: "var(--st-accent)" }} />
          Seleccionada
        </span>
      </div>
    </div>
  );
};

export default InspectionDatePicker;
