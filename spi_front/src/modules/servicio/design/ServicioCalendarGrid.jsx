import React, { useMemo } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import ServicioBadge from "./ServicioBadge";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_VISIBLE_EVENTS = 3;

const toDateKey = (date) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const buildMonthCells = (anchor) => {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // Lunes=0 ... Domingo=6
  const leadingBlank = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - leadingBlank);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { date, inMonth: date.getMonth() === month };
  });
};

/**
 * Grilla de calendario mes con eventos agrupados por día. Sin librería
 * externa (ver plan de refactor visual) — suficiente para el volumen de
 * actividades del cronograma técnico.
 *
 * `events`: [{ date: "YYYY-MM-DD", label, tone, href }]
 * `tone` acepta los mismos tonos que ServicioBadge (success/warning/danger/info/accent/neutral).
 */
const ServicioCalendarGrid = ({ month, onPrevMonth, onNextMonth, onToday, events = [], onSelectDate }) => {
  const anchor = month instanceof Date ? month : new Date();
  const cells = useMemo(() => buildMonthCells(anchor), [anchor.getFullYear(), anchor.getMonth()]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const key = toDateKey(event.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    });
    return map;
  }, [events]);

  const todayKey = toDateKey(new Date());
  const monthLabel = anchor.toLocaleDateString("es-EC", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p
          className="text-sm font-semibold capitalize"
          style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}
        >
          {monthLabel}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevMonth}
            className="rounded-[var(--st-radius-sm)] border p-1.5"
            style={{ borderColor: "var(--st-border)" }}
            aria-label="Mes anterior"
          >
            <FiChevronLeft size={14} style={{ color: "var(--st-text-muted)" }} />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="rounded-[var(--st-radius-sm)] border px-2 py-1 text-xs font-semibold"
            style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)" }}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="rounded-[var(--st-radius-sm)] border p-1.5"
            style={{ borderColor: "var(--st-border)" }}
            aria-label="Mes siguiente"
          >
            <FiChevronRight size={14} style={{ color: "var(--st-text-muted)" }} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[var(--st-radius-md)] border" style={{ borderColor: "var(--st-border)", background: "var(--st-border)" }}>
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ background: "var(--st-surface-sunken)", color: "var(--st-text-faint)" }}
          >
            {day}
          </div>
        ))}

        {cells.map(({ date, inMonth }) => {
          const key = toDateKey(date);
          const dayEvents = eventsByDay.get(key) || [];
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate?.(key, dayEvents)}
              className="flex min-h-[92px] flex-col items-stretch gap-1 px-1.5 py-1.5 text-left transition"
              style={{
                background: inMonth ? "var(--st-surface)" : "var(--st-surface-sunken)",
                opacity: inMonth ? 1 : 0.55,
              }}
            >
              <span
                className="inline-flex h-5 w-5 items-center justify-center self-end rounded-full text-[11px] font-semibold"
                style={{
                  background: isToday ? "var(--st-accent)" : "transparent",
                  color: isToday ? "#fff" : "var(--st-text-muted)",
                }}
              >
                {date.getDate()}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event, index) => (
                  <ServicioBadge key={`${key}-${index}`} tone={event.tone || "neutral"} className="w-full justify-start truncate">
                    {event.label}
                  </ServicioBadge>
                ))}
                {dayEvents.length > MAX_VISIBLE_EVENTS ? (
                  <span className="text-[10px] font-medium" style={{ color: "var(--st-text-faint)" }}>
                    +{dayEvents.length - MAX_VISIBLE_EVENTS} más
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ServicioCalendarGrid;
