import React from "react";
import ServicioBadge from "../design/ServicioBadge";

const labelStatus = (status) => String(status || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusTone = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (["closed"].includes(normalized)) return "success";
  if (["cancelled", "parts_rejected"].includes(normalized)) return "danger";
  if (["parts_pending_quote", "parts_pending_client_approval", "pending_disinfection"].includes(normalized)) return "warning";
  return "neutral";
};

const CaseCard = ({ item, selected, onSelect, currentUserId }) => (
  <button
    type="button"
    onClick={() => onSelect(item.id)}
    className="w-full shrink-0 rounded-[var(--st-radius-md)] border px-3 py-2.5 text-left transition"
    style={selected ? { borderColor: "var(--st-accent)", background: "var(--st-accent-soft)" } : { borderColor: "var(--st-border)", background: "var(--st-surface)" }}
  >
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-semibold" style={{ color: "var(--st-text)" }}>{item.code}</p>
      <ServicioBadge tone={statusTone(item.status)}>{labelStatus(item.status)}</ServicioBadge>
    </div>
    <p className="mt-1 line-clamp-2 text-[11px] leading-snug" style={{ color: "var(--st-text-muted)" }}>{item.problem_summary}</p>
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--st-text-faint)" }}>{item.priority}</span>
      {currentUserId && (Number(item.assigned_specialist_user_id) === currentUserId || Number(item.dispatcher_user_id) === currentUserId) ? (
        <ServicioBadge tone="success">Mío</ServicioBadge>
      ) : null}
      {item.classification && !item.assigned_specialist_user_id ? <ServicioBadge tone="warning">Sin tomar</ServicioBadge> : null}
    </div>
  </button>
);

/**
 * Tablero por etapa -- reemplaza la lista plana + panel de detalle lado a
 * lado (mismo patron que Dashboard/Solicitudes) por una composicion propia
 * del trabajo correctivo: cada caso pertenece a UNA etapa visible de un
 * vistazo (sin clasificar / especialidad / cerrado), que es literalmente
 * como el equipo ya piensa el flujo (triage CEAC -> clasificacion ->
 * ejecucion -> cierre). Scroll horizontal intencional en mobile, no un bug
 * de overflow: es el patron esperado de un tablero de columnas.
 */
const CorrectiveCaseBoard = ({ columns, selectedId, onSelect, currentUserId }) => (
  <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
    {columns.map((column) => (
      <div key={column.key} className="flex w-[260px] shrink-0 flex-col gap-2">
        <div className="flex items-center justify-between border-b px-1 pb-2" style={{ borderColor: "var(--st-border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--st-text-faint)" }}>{column.label}</p>
          <span className="font-mono-data text-xs font-semibold tabular-nums" style={{ color: "var(--st-text-muted)" }}>{column.rows.length}</span>
        </div>
        <div className="flex flex-col gap-2">
          {column.rows.length === 0 ? (
            <p className="rounded-[var(--st-radius-md)] border border-dashed px-3 py-4 text-center text-[11px]" style={{ borderColor: "var(--st-border)", color: "var(--st-text-faint)" }}>
              Vacío
            </p>
          ) : (
            column.rows.map((item) => (
              <CaseCard key={item.id} item={item} selected={Number(selectedId) === Number(item.id)} onSelect={onSelect} currentUserId={currentUserId} />
            ))
          )}
        </div>
      </div>
    ))}
  </div>
);

export default CorrectiveCaseBoard;
