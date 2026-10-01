import React from "react";
import ServicioCard from "./ServicioCard";

/**
 * Chrome compartido de los steppers de Servicio Técnico (desinfección,
 * asistencia, entrenamiento, verificación, retiro, etc.). Cada stepper sigue
 * dueño de su propia lógica de negocio y formularios — esto solo unifica:
 * la fila de progreso por etapas, y el envoltorio de cada sección de etapa.
 */
export const ServicioStepperProgress = ({ stages, currentKey, doneKeys = [] }) => (
  <div className="flex flex-wrap items-center gap-2">
    {stages.map((stage, index) => {
      const isDone = doneKeys.includes(stage.key);
      const isCurrent = stage.key === currentKey;
      const tone = isDone
        ? { bg: "var(--st-success-soft)", text: "var(--st-success)", border: "var(--st-success-soft)" }
        : isCurrent
          ? { bg: "var(--st-accent-soft)", text: "var(--st-accent-strong)", border: "var(--st-accent)" }
          : { bg: "var(--st-surface-sunken)", text: "var(--st-text-muted)", border: "var(--st-border)" };
      return (
        <React.Fragment key={stage.key}>
          <span
            className="inline-flex items-center gap-1.5 rounded-[var(--st-radius-pill)] border px-3 py-1.5 text-xs font-semibold"
            style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
          >
            {index + 1}. {stage.label}
          </span>
          {index < stages.length - 1 ? (
            <span aria-hidden="true" style={{ color: "var(--st-text-faint)" }}>
              →
            </span>
          ) : null}
        </React.Fragment>
      );
    })}
  </div>
);

export const ServicioStepperSection = ({ title, description, actions, children }) => (
  <ServicioCard className="p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h4 className="text-sm font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
          {title}
        </h4>
        {description ? (
          <p className="mt-1 text-xs" style={{ color: "var(--st-text-muted)" }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions}
    </div>
    {children ? <div className="mt-3 space-y-2">{children}</div> : null}
  </ServicioCard>
);

export default ServicioStepperProgress;
