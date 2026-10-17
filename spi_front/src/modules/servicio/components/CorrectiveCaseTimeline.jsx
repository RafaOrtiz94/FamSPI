import React from "react";
import { FiClock, FiFileText, FiMessageSquare, FiRefreshCw } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import { formatDateTimeEs } from "../../../core/utils/workflowUi";
import ServicioCard from "../design/ServicioCard";
import ServicioEmptyState from "../design/ServicioEmptyState";

const iconByType = {
  event: FiClock,
  comment: FiMessageSquare,
  evidence: FiFileText,
};

const labelByType = {
  event: "Evento",
  comment: "Comentario",
  evidence: "Evidencia",
};

const CorrectiveCaseTimeline = ({ rows = [], loading = false, onRefresh }) => (
  <ServicioCard className="st-scope p-4">
    <div className="flex items-center justify-between gap-2">
      <div>
        <h4 className="text-sm font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Timeline del caso</h4>
        <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>Historial técnico, comentarios y evidencias</p>
      </div>
      <Button size="sm" variant="secondary" icon={FiRefreshCw} loading={loading} onClick={onRefresh}>Recargar</Button>
    </div>

    {rows.length === 0 ? (
      <ServicioEmptyState title="No hay entradas en el timeline." />
    ) : (
      <div className="mt-3 space-y-2">
        {rows.map((row) => {
          const Icon = iconByType[row.entry_type] || FiClock;
          const label = labelByType[row.entry_type] || row.entry_type || "Registro";
          const evidenceUrl = row?.payload?.evidence_ref || null;
          return (
            <div key={row.id} className="rounded-[var(--st-radius-md)] border px-3 py-2" style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)" }}>
              <div className="flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--st-text)" }}>
                  <Icon size={14} />
                  {label}: {row.label}
                </p>
                <span className="text-xs" style={{ color: "var(--st-text-faint)" }}>{formatDateTimeEs(row.created_at, "N/D")}</span>
              </div>
              {row.description ? <p className="mt-1 text-xs" style={{ color: "var(--st-text-muted)" }}>{row.description}</p> : null}
              <p className="mt-1 text-[11px]" style={{ color: "var(--st-text-faint)" }}>Actor: {row.actor_name || row.actor_email || "Sistema"}</p>
              {row.entry_type === "evidence" && evidenceUrl ? (
                <a href={evidenceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-[11px] font-semibold underline" style={{ color: "var(--st-accent)" }}>
                  Abrir evidencia
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    )}
  </ServicioCard>
);

export default CorrectiveCaseTimeline;
