import React from "react";

/**
 * Tarjeta seleccionable de la lista lateral (rail) de un
 * ServicioWorkspaceShell. `active` resalta el ítem seleccionado.
 */
// Card interactiva por el spec exacto de DESIGN.md §7: hover -> Lifted
// shadow + borde Fog (nunca Action Blue, ese color es solo para la
// decision/estado activo). scale(0.99) en :active como feedback de presion.
const ServicioRailItem = ({ active, onClick, title, badge, subtitle, meta, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full cursor-pointer rounded-[var(--st-radius-md)] border px-4 py-4 text-left transition-shadow duration-150 active:scale-[0.99] ${
      active ? "" : "hover:border-[var(--st-fog)] hover:shadow-[var(--st-shadow-raised)]"
    }`}
    style={{
      borderColor: active ? "var(--st-accent)" : "var(--st-border)",
      background: active ? "var(--st-accent-soft)" : "var(--st-surface)",
      boxShadow: active ? "var(--st-shadow-raised)" : "none",
      transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold" style={{ color: "var(--st-text)" }}>
          {title}
        </p>
        {subtitle ? (
          <p className="mt-1 text-xs" style={{ color: "var(--st-text-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {badge}
    </div>
    {meta ? (
      <div className="mt-4 flex flex-wrap gap-2 text-xs" style={{ color: "var(--st-text-muted)" }}>
        {meta}
      </div>
    ) : null}
    {children}
  </button>
);

export default ServicioRailItem;
