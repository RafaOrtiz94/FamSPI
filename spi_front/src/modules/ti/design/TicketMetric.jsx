import React from "react";

const TONE_TEXT = {
  neutral: "var(--ti-text)",
  warning: "var(--ti-warning-text)",
  danger: "var(--ti-danger-text)",
  success: "var(--ti-success-text)",
};

// Tile de indicador para la franja de KPI. DESIGN.md §13 desaconseja repetir
// cuatro KPI identicos con iconos de color -- por eso este componente es
// deliberadamente austero (sin icono ornamental) y se usa con moderacion.
const TicketMetric = ({ label, value, tone = "neutral", helper, unit }) => (
  <div
    className="min-w-[140px] flex-1 px-4 py-3"
    style={{
      background: "var(--ti-surface)",
      border: "1px solid var(--ti-border)",
      borderRadius: "var(--ti-radius-panel)",
    }}
  >
    <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ti-text-muted)" }}>
      {label}
    </p>
    <p className="mt-2 text-2xl font-semibold leading-none fam-numeric" style={{ color: TONE_TEXT[tone] || TONE_TEXT.neutral }}>
      {value}
      {unit ? <span className="ml-1 text-sm font-medium" style={{ color: "var(--ti-text-muted)" }}>{unit}</span> : null}
    </p>
    {helper ? (
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--ti-text-muted)" }}>
        {helper}
      </p>
    ) : null}
  </div>
);

export default TicketMetric;
