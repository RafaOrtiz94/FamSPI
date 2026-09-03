import React from "react";

// Anatomia exacta de DESIGN.md §11 "Empty states": icono neutral Fog 40px,
// linea principal 14px/500/Ink Slate, linea secundaria 12px/Warm Ash, boton
// de accion opcional. "Nunca: ilustraciones complejas, texto de marketing,
// multiples parrafos" -- por eso el componente no acepta children.
const ServicioEmptyState = ({ icon: Icon, title, description, actionLabel, onAction }) => (
  <div
    className="flex min-h-[240px] flex-col items-center justify-center rounded-[var(--st-radius-lg)] border border-dashed px-6 text-center"
    style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)" }}
  >
    {Icon ? <Icon size={40} style={{ color: "var(--st-fog)" }} /> : null}
    {title ? (
      <p className="mt-4 text-sm font-medium" style={{ color: "var(--st-text)" }}>
        {title}
      </p>
    ) : null}
    {description ? (
      <p className="mt-1.5 max-w-md text-xs" style={{ color: "var(--st-text-muted)" }}>
        {description}
      </p>
    ) : null}
    {actionLabel && onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 cursor-pointer rounded-[var(--st-radius-lg)] px-4 py-2 text-sm font-medium text-white transition-transform duration-150 active:scale-[0.97]"
        style={{ background: "var(--st-accent)", transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
);

export default ServicioEmptyState;
