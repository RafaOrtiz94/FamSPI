import React from "react";
import { useNavigate } from "react-router-dom";
import { FiActivity, FiChevronRight, FiClipboard, FiExternalLink, FiInbox, FiShield, FiTruck } from "react-icons/fi";

import ServicioCard from "../../design/ServicioCard";
import ServicioBadge from "../../design/ServicioBadge";
import ServicioEmptyState from "../../design/ServicioEmptyState";
import { actionQueueTypeTone, actionQueueUrgencyLabel, actionQueueUrgencyTone } from "./dashboardViewShared";

const TYPE_ICONS = {
  approval: FiClipboard,
  withdrawal: FiTruck,
  corrective: FiActivity,
  preventive_offer: FiShield,
  external_case: FiExternalLink,
};

// DESIGN.md §13 prohibe el border-left decorativo como "acento de alerta"
// (cliche reconocible) -- la urgencia se comunica con fondo semantico suave
// (la alternativa que el propio DESIGN.md sugiere) y con el badge, nunca con
// una franja de color.
const URGENCY_TINT = {
  urgent: "var(--st-danger-soft)",
};

// Motion system del propio DESIGN.md (§6): curva fuerte para entradas/salidas
// de UI, nunca el ease-in/ease-out generico del navegador.
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

const SkeletonRow = () => (
  <div className="flex animate-pulse items-center gap-3 rounded-[var(--st-radius-md)] px-3 py-3" style={{ background: "var(--st-surface-sunken)" }}>
    <div className="h-9 w-9 shrink-0 rounded-lg" style={{ background: "var(--st-border)" }} />
    <div className="min-w-0 flex-1 space-y-2">
      <div className="h-3.5 w-2/5 rounded" style={{ background: "var(--st-border)" }} />
      <div className="h-3 w-3/5 rounded" style={{ background: "var(--st-border)" }} />
    </div>
    <div className="h-5 w-16 shrink-0 rounded-[var(--st-radius-pill)]" style={{ background: "var(--st-border)" }} />
  </div>
);

/**
 * Reemplaza la navegacion por modulos identicos en Inicio: en vez de que el
 * jefe de servicio recorra cronograma / inspecciones / correctivos / plan
 * preventivo / casos externos por separado para saber que necesita su
 * decision hoy, esta lista junta los 5 en una sola cola priorizada por
 * urgencia (backend/src/modules/servicio/actionQueue.service.js). Cada fila
 * navega directo al workspace real donde se decide -- esta lista no decide
 * nada por si misma, solo prioriza y enruta.
 */
const ActionQueueList = ({ items = [], title = "Qué necesita tu decisión", emptyDescription, loading = false }) => {
  const navigate = useNavigate();

  return (
    <ServicioCard className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
            {title}
          </h3>
          <p className="mt-1 text-xs" style={{ color: "var(--st-text-muted)" }}>
            Inspección, retiro, correctivos, preventivo y casos externos en una sola lista.
          </p>
        </div>
        {items.length ? <ServicioBadge tone="neutral">{items.length}</ServicioBadge> : null}
      </div>

      {loading ? (
        <div className="space-y-1.5" aria-busy="true" aria-label="Cargando cola de decisiones">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : items.length === 0 ? (
        <ServicioEmptyState
          icon={FiInbox}
          title="No hay nada pendiente de decisión"
          description={emptyDescription || "Cuando algo requiera tu acción aparecerá aquí, priorizado por urgencia."}
        />
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type] || FiClipboard;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => item.source_path && navigate(item.source_path)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-[var(--st-radius-md)] border px-3 py-3 text-left transition-shadow hover:shadow-[var(--st-shadow-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99]"
                style={{
                  background: URGENCY_TINT[item.urgency] || "var(--st-surface-sunken)",
                  borderColor: "var(--st-border)",
                  outlineColor: "var(--st-accent)",
                  transitionDuration: "150ms, 120ms",
                  transitionProperty: "box-shadow, transform",
                  transitionTimingFunction: EASE_OUT,
                }}
              >
                <div className="shrink-0 rounded-lg p-2" style={{ background: "var(--st-surface)" }}>
                  <Icon size={16} style={{ color: "var(--st-accent)" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--st-text)" }}>{item.title}</p>
                  <p className="truncate text-xs font-normal" style={{ color: "var(--st-text-muted)" }}>
                    {item.client_name ? `${item.client_name} · ` : ""}
                    {item.meta}
                  </p>
                </div>
                {item.urgency === "urgent" ? (
                  <ServicioBadge tone={actionQueueUrgencyTone(item.urgency)}>{actionQueueUrgencyLabel(item.urgency)}</ServicioBadge>
                ) : null}
                <ServicioBadge tone={actionQueueTypeTone(item.type)}>{item.primary_action}</ServicioBadge>
                <FiChevronRight size={14} className="shrink-0" style={{ color: "var(--st-text-faint)" }} />
              </button>
            );
          })}
        </div>
      )}
    </ServicioCard>
  );
};

export default ActionQueueList;
