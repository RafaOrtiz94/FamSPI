import React from "react";

/**
 * Lectura tipo "cluster de instrumentos" -- reemplaza el patron de tarjeta con
 * icono de color + numero grande (DESIGN.md §13 lo prohibe explicitamente:
 * "los KPIs son siempre: numero grande, label pequena, icono de colorcito").
 * Sin caja, sin sombra, sin icono: vive directo sobre el fondo de la pagina,
 * como un HUD, separado solo por reglas verticales delgadas.
 */
const DispatchStrip = ({ items = [] }) => (
  <div
    className="flex flex-wrap items-stretch gap-x-8 gap-y-3 border-y py-3"
    style={{ borderColor: "var(--st-border)" }}
  >
    {items.map((item, index) => (
      <div
        key={item.label}
        className="flex items-baseline gap-2 pl-8 first:pl-0"
        style={index > 0 ? { borderLeft: "1px solid var(--st-border)" } : undefined}
      >
        <span
          className="font-mono-data text-2xl font-semibold tabular-nums leading-none"
          style={{ color: item.emphasis ? "var(--st-danger)" : "var(--st-text)" }}
        >
          {item.value ?? "—"}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--st-text-faint)" }}>
          {item.label}
        </span>
      </div>
    ))}
  </div>
);

export default DispatchStrip;
