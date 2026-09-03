import React from "react";

/**
 * Superficie base del sistema visual de Servicio Técnico. Envuelve el token
 * de radio/sombra/borde en vez de repetirlo por página.
 */
const ServicioCard = ({ as: Tag = "div", className = "", children, ...rest }) => (
  <Tag
    className={`rounded-[var(--st-radius-lg)] border ${className}`}
    style={{
      borderColor: "var(--st-border)",
      background: "var(--st-surface)",
      boxShadow: "var(--st-shadow-card)",
    }}
    {...rest}
  >
    {children}
  </Tag>
);

export default ServicioCard;
