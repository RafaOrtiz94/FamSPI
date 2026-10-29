import React from "react";
import { FiAlertCircle } from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";
import { formatTechnicalDateLabel } from "../dashboard/dashboardViewShared";
import InspectionDatePicker from "./InspectionDatePicker";

const inputClass = "w-full rounded-[var(--st-radius-md)] border px-3 py-3 text-sm outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };

const TechnicianRoster = ({ technicians, value, onChange, required }) => (
  <div className="divide-y overflow-hidden rounded-[var(--st-radius-md)] border" style={{ borderColor: "var(--st-border)" }}>
    {!required ? (
      <button
        type="button"
        onClick={() => onChange?.("")}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors duration-100"
        style={{ background: !value ? "var(--st-accent-soft)" : "var(--st-surface)", color: !value ? "var(--st-accent-strong)" : "var(--st-text-muted)" }}
      >
        Sin técnico específico
      </button>
    ) : null}
    {technicians.map((option) => {
      const selected = String(value) === String(option.id);
      const name = option.fullname || option.name || option.email;
      return (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange?.(option.id)}
          className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors duration-100"
          style={{ background: selected ? "var(--st-accent-soft)" : "var(--st-surface)", color: selected ? "var(--st-accent-strong)" : "var(--st-text)" }}
        >
          <span
            className="font-mono-data flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            style={{ background: selected ? "var(--st-accent)" : "var(--st-surface-sunken)", color: selected ? "#fff" : "var(--st-text-faint)" }}
          >
            {String(name || "?").trim().charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{name}</span>
        </button>
      );
    })}
  </div>
);

/**
 * Panel unico de asignacion, reemplaza 3 bloques casi identicos que existian
 * por separado en cada sourceType (bc/compras/independientes) con copy
 * distinto ("Aprobar y asignar" / "Coordinar fecha exacta" / "Aprobar y
 * asignar") para la misma accion real. T3 del plan de rework: un solo verbo
 * ("Asignar") en toda la UI.
 *
 * Segunda pasada (tras feedback de que la primera version era un formulario
 * generico sin el lenguaje visual de la bitacora): tecnico se elige de un
 * roster clicable (no <select> nativo) y la fecha se elige en un calendario
 * compacto que pinta la ventana propuesta -- ambos eran pedidos explicitos
 * del plan original que la primera pasada dejo como texto plano.
 */
const AssignInspectionPanel = ({
  minDate,
  maxDate,
  technicians = [],
  technicianRequired = true,
  technicianValue = "",
  onTechnicianChange,
  dateValue = "",
  onDateChange,
  notesValue = "",
  onNotesChange,
  scheduleConflict,
  onAssign,
  assignLabel = "Asignar inspección",
  saving = false,
  onReject,
  rejectValue,
  onRejectChange,
  rejectPlaceholder = "Motivo de rechazo",
  rejectRequired = true,
}) => (
  <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--st-text-faint)" }}>
        Técnico
      </p>
      {technicians.length ? (
        <TechnicianRoster technicians={technicians} value={technicianValue} onChange={onTechnicianChange} required={technicianRequired} />
      ) : null}

      <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--st-text-faint)" }}>
        Fecha
      </p>
      <InspectionDatePicker minDate={minDate} maxDate={maxDate} value={dateValue} onChange={onDateChange} />

      {scheduleConflict ? (
        <p className="flex items-start gap-2 rounded-[var(--st-radius-md)] border px-3 py-2 text-xs font-medium" style={{ borderColor: "var(--st-warning)", background: "var(--st-warning-soft)", color: "var(--st-warning)" }}>
          <FiAlertCircle className="mt-0.5 shrink-0" size={14} />
          Este colaborador ya tiene {scheduleConflict.rows.length} actividad(es) el {formatTechnicalDateLabel(scheduleConflict.date)}: {scheduleConflict.rows.map((row) => row.title).join(", ")}.
        </p>
      ) : null}
      <textarea
        rows={2}
        value={notesValue}
        onChange={(event) => onNotesChange?.(event.target.value)}
        placeholder="Observaciones internas para la coordinación"
        className={inputClass}
        style={inputStyle}
      />
      <Button onClick={onAssign} loading={saving} className="w-full justify-center">{assignLabel}</Button>
    </div>

    <div className="space-y-4">
      {onReject ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--st-text-faint)" }}>
            Rechazar
          </p>
          <textarea
            rows={4}
            value={rejectValue || ""}
            onChange={(event) => onRejectChange?.(event.target.value)}
            placeholder={rejectPlaceholder}
            className={inputClass}
            style={inputStyle}
          />
          <Button variant="danger" onClick={onReject} loading={saving} className="w-full justify-center">
            {rejectRequired ? "Rechazar solicitud" : "Rechazar (opcional)"}
          </Button>
        </div>
      ) : (
        <div className="rounded-[var(--st-radius-md)] border p-4 text-xs leading-5" style={{ borderColor: "var(--st-border)", background: "var(--st-surface)", color: "var(--st-text-faint)" }}>
          Esta bandeja responde la solicitud F.ST-20. El resto del procedimiento técnico continúa en su flujo propio.
        </div>
      )}
    </div>
  </div>
);

export default AssignInspectionPanel;
