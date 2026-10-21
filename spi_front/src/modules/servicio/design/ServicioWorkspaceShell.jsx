import React from "react";
import "./tokens.css";
import ServicioMetric from "./ServicioMetric";

/**
 * Chrome compartido de los workspaces de Servicio Técnico: encabezado con
 * eyebrow/título/descripción + tira de métricas, más un layout rail (lista
 * lateral) + panel de detalle. Generaliza el patrón que se validó primero en
 * InspectionRequestsWorkspace.jsx / RetiroEquipos.jsx.
 *
 * Cada página sigue siendo dueña de lo que renderiza dentro de `rail` y
 * `detail` (los datos/acciones varían demasiado entre páginas como para
 * forzar un item de lista genérico) — este componente solo evita repetir el
 * maquetado del contenedor.
 */
const ServicioWorkspaceShell = ({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  title,
  description,
  metrics = [],
  headerActions,
  rail,
  detail,
}) => (
  <section className="st-scope mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
    <div
      className="overflow-hidden rounded-[var(--st-radius-lg)] border p-5 sm:p-6"
      style={{
        borderColor: "var(--st-border)",
        background: "linear-gradient(180deg, var(--st-surface) 0%, var(--st-bg) 100%)",
        boxShadow: "var(--st-shadow-card)",
      }}
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <div
              className="inline-flex items-center gap-2 rounded-[var(--st-radius-pill)] border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: "var(--st-accent-soft)", background: "var(--st-accent-soft)", color: "var(--st-accent-strong)" }}
            >
              {EyebrowIcon ? <EyebrowIcon size={14} /> : null}
              {eyebrow}
            </div>
          ) : null}
          {title ? (
            <h2
              className="mt-3 text-2xl font-semibold tracking-tight"
              style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}
            >
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--st-text-muted)" }}>
              {description}
            </p>
          ) : null}
          {headerActions ? <div className="mt-4 flex flex-wrap items-center gap-2">{headerActions}</div> : null}
        </div>

        {metrics.length ? (
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-[420px]">
            {metrics.map((metric) => (
              <ServicioMetric key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <aside
          className="min-w-0 overflow-hidden rounded-[var(--st-radius-lg)] border"
          style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}
        >
          {rail}
        </aside>

        <main
          className="min-w-0 overflow-hidden rounded-[var(--st-radius-lg)] border p-5 sm:p-6"
          style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}
        >
          {detail}
        </main>
      </div>
    </div>
  </section>
);

export default ServicioWorkspaceShell;
