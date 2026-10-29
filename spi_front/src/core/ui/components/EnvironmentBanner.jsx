import React from "react";

// Marca visible del ambiente de pruebas. La etiqueta solo se define al arrancar el frontend de
// staging (REACT_APP_ENV_LABEL); en el build de produccion no existe y este componente no pinta nada.
const ENV_LABEL = String(process.env.REACT_APP_ENV_LABEL || "").trim();

export default function EnvironmentBanner() {
  if (!ENV_LABEL) return null;
  return (
    <div
      role="status"
      aria-label={`Ambiente ${ENV_LABEL}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100001,
        pointerEvents: "none",
        borderTop: "3px solid var(--warning-text, #805500)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          background: "var(--warning-bg, #FFF3D6)",
          color: "var(--warning-text, #805500)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          padding: "2px 10px",
          borderRadius: "0 0 6px 6px",
        }}
      >
        {ENV_LABEL} · datos de prueba
      </span>
    </div>
  );
}
