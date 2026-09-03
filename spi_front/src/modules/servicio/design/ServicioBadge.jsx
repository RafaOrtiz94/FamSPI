import React from "react";

const TONE_VARS = {
  success: { bg: "var(--st-success-soft)", text: "var(--st-success)" },
  warning: { bg: "var(--st-warning-soft)", text: "var(--st-warning)" },
  danger: { bg: "var(--st-danger-soft)", text: "var(--st-danger)" },
  info: { bg: "var(--st-info-soft)", text: "var(--st-info)" },
  accent: { bg: "var(--st-accent-soft)", text: "var(--st-accent-strong)" },
  neutral: { bg: "var(--st-surface-sunken)", text: "var(--st-text-muted)" },
};

/**
 * Badge de estado del sistema visual de Servicio Técnico.
 * `tone` mapea a los mismos significados semánticos del resto del dashboard
 * (success=aprobado/completado, warning=pendiente, danger=rechazado) — solo
 * cambia la paleta de superficie, no el significado.
 */
const ServicioBadge = ({ tone = "neutral", icon: Icon, children, className = "" }) => {
  const colors = TONE_VARS[tone] || TONE_VARS.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--st-radius-pill)] px-2.5 py-1 text-[11px] font-semibold ${className}`}
      style={{ background: colors.bg, color: colors.text }}
    >
      {Icon ? <Icon size={11} /> : null}
      {children}
    </span>
  );
};

export default ServicioBadge;
