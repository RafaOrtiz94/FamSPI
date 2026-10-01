import React from "react";

const TONE_VARS = {
  success: { bg: "var(--ti-success-bg)", text: "var(--ti-success-text)" },
  warning: { bg: "var(--ti-warning-bg)", text: "var(--ti-warning-text)" },
  danger: { bg: "var(--ti-danger-bg)", text: "var(--ti-danger-text)" },
  info: { bg: "var(--ti-info-bg)", text: "var(--ti-info-text)" },
  neutral: { bg: "var(--ti-surface-sunken)", text: "var(--ti-text-muted)" },
};

// Estado del ticket -> tono semantico (DESIGN.md §8: badges de estado con
// radio 6px y color semantico, nunca decorativo).
const STATUS_TONE = {
  abierto: "warning",
  reabierto: "danger",
  triage: "info",
  en_progreso: "info",
  en_espera: "warning",
  resuelto: "success",
  cerrado: "neutral",
};

export function statusToTone(status) {
  return STATUS_TONE[String(status || "").trim().toLowerCase()] || "neutral";
}

const TicketBadge = ({ tone = "neutral", children, className = "" }) => {
  const colors = TONE_VARS[tone] || TONE_VARS.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold capitalize leading-none ${className}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderRadius: "var(--ti-radius-badge)",
      }}
    >
      {children}
    </span>
  );
};

export default TicketBadge;
