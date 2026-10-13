// Recorrido de la oportunidad a través de sus expedientes (compra privada, compra pública o
// Business Case): cliente → disponibilidad → factibilidad → oferta → contrato → entrega → consumibles.
// <JourneyStrip> es el resumen de la tarjeta del embudo; <JourneyPanel> el detalle con fechas,
// documentos e historial. Los datos llegan ya resueltos del backend (crmOpportunityJourney).
import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCheck, FiExternalLink, FiFileText } from "react-icons/fi";
import { fetchOpportunityJourney } from "../../../core/api/crmFamApi";
import { Badge, Btn, cx, Skeleton } from "../ui/kit";
import { date, relativeDay } from "../ui/format";
import { OFFER_KINDS, PURCHASE_STATUS } from "./OpportunityDialogs";

const STATE = {
  done: { label: "Hecho", bar: "bg-fam-success", dot: "border-fam-success bg-fam-success text-white", text: "text-fam-text" },
  current: { label: "En curso", bar: "bg-fam-action", dot: "border-fam-action bg-fam-surface text-fam-action", text: "text-fam-text" },
  blocked: { label: "Detenido", bar: "bg-fam-danger", dot: "border-fam-danger bg-fam-danger-bg text-fam-danger", text: "text-fam-danger" },
  pending: { label: "Pendiente", bar: "bg-fam-border", dot: "border-fam-border bg-fam-surface text-fam-muted", text: "text-fam-muted" },
};
const stateOf = (state) => STATE[state] || STATE.pending;

const BC_STAGES = {
  pending_comercial: "Pendiente comercial", esperando_calculos: "Esperando cálculos", factibilidad: "En factibilidad",
  factible: "Factible", cerrado_no_factible: "No factible",
};
const humanize = (value) => {
  const text = String(value || "").replaceAll("_", " ").toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};
const statusLabel = (status) => PURCHASE_STATUS[status]?.[0] || BC_STAGES[status] || humanize(status);

// Dónde se trabaja el expediente principal de la oportunidad.
export const journeyReference = (reference) => {
  if (!reference) return null;
  if (reference.type === "private_purchase") {
    return { kind: OFFER_KINDS[reference.offer_kind] || "Compra privada", status: statusLabel(reference.status), to: "/dashboard/purchases/workspace?tab=private" };
  }
  if (reference.type === "public_purchase") {
    return { kind: "Compra pública", status: statusLabel(reference.status), to: "/dashboard/purchases/workspace?tab=public" };
  }
  return { kind: "Business Case", status: statusLabel(reference.status), to: `/dashboard/business-case/workspace/${reference.id}` };
};

// El hito que hay que mirar ahora: el detenido, si no el que está en curso, si no el primero pendiente.
const focusOf = (journey) => journey.blocked
  || [...journey.milestones].reverse().find((m) => m.state === "current")
  || journey.milestones.find((m) => m.state === "pending")
  || journey.milestones[journey.milestones.length - 1];

// ─── Resumen para la tarjeta ─────────────────────────────────────────────────
export function JourneyStrip({ journey }) {
  if (!journey) return null;
  const focus = focusOf(journey);
  const ref = journeyReference(journey.reference);
  const summary = journey.milestones.map((m) => `${m.label}: ${stateOf(m.state).label.toLowerCase()}`).join(", ");
  return (
    <div className="mt-2.5 border-t border-fam-border pt-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-fam-muted">{ref ? ref.kind : "Cliente"}</span>
        <span className="fam-numeric shrink-0 text-xs text-fam-muted">{journey.progress.done}/{journey.progress.total}</span>
      </div>
      <div className="mt-1.5 flex gap-1" role="img" aria-label={`Recorrido. ${summary}`}>
        {journey.milestones.map((m) => (
          <span key={m.key} title={`${m.label}: ${m.detail || stateOf(m.state).label}`} className={cx("h-1.5 flex-1 rounded-full", stateOf(m.state).bar)} />
        ))}
      </div>
      <p className={cx("mt-1.5 flex items-start gap-1 text-xs", focus.state === "blocked" ? "text-fam-danger" : "text-fam-text")}>
        {focus.state === "blocked" && <FiAlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />}
        <span className="min-w-0">
          <span className="font-medium">{focus.label}:</span> {focus.state === "pending" ? "pendiente" : (focus.detail || stateOf(focus.state).label).toLowerCase()}
        </span>
      </p>
      {(journey.last_update || journey.documents_count > 0) && (
        <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-fam-muted">
          <span>{journey.last_update ? `Actualizado ${relativeDay(journey.last_update)}` : ""}</span>
          {journey.documents_count > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1"><FiFileText className="h-3 w-3" aria-hidden="true" />{journey.documents_count} doc.</span>
          )}
        </p>
      )}
    </div>
  );
}

// ─── Detalle ─────────────────────────────────────────────────────────────────
const SOURCE_LABEL = { private_purchase: "Compra privada", public_purchase: "Compra pública", business_case: "Business Case" };

function Milestone({ milestone, last }) {
  const s = stateOf(milestone.state);
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && <span className="absolute left-[9px] top-5 h-full w-px bg-fam-border" aria-hidden="true" />}
      <span className={cx("relative z-[1] mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border", s.dot)} aria-hidden="true">
        {milestone.state === "done" && <FiCheck className="h-3 w-3" />}
        {milestone.state === "blocked" && <FiAlertTriangle className="h-2.5 w-2.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={cx("text-sm font-medium", s.text)}>{milestone.label}</p>
          <p className="fam-numeric text-[13px] text-fam-muted">{milestone.at ? date(milestone.at) : s.label}</p>
        </div>
        {milestone.detail && <p className="text-[13px] text-fam-muted">{milestone.detail}</p>}
        {milestone.documents.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {milestone.documents.map((d) => (
              <li key={d.url}>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-fam-action underline underline-offset-2">
                  <FiFileText className="h-3.5 w-3.5" aria-hidden="true" />{d.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function JourneyPanel({ opportunityId, reloadKey = 0, onNewPurchase }) {
  const [journey, setJourney] = useState(undefined); // undefined = cargando, null = sin expediente
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setJourney(undefined);
    setFailed(false);
    setShowAll(false);
    fetchOpportunityJourney(opportunityId)
      .then((res) => { if (!cancelled) setJourney(res || null); })
      .catch(() => { if (!cancelled) { setJourney(null); setFailed(true); } });
    return () => { cancelled = true; };
  }, [opportunityId, reloadKey]);

  if (journey === undefined) return <div className="space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-44" /></div>;
  if (failed) return <p className="text-sm text-fam-danger">No se pudo cargar el recorrido. Vuelve a abrir la oportunidad.</p>;
  if (!journey) {
    return (
      <div>
        <p className="text-sm text-fam-muted">Esta oportunidad aún no tiene Business Case ni requerimiento de compra. Al crearlo, su avance aparecerá aquí y moverá la tarjeta de fase.</p>
        {onNewPurchase && <Btn size="sm" className="mt-2" onClick={onNewPurchase}>Crear requerimiento de compra</Btn>}
      </div>
    );
  }

  const ref = journeyReference(journey.reference);
  const events = journey.events || [];
  const visible = showAll ? events : events.slice(0, 5);
  return (
    <div className="space-y-4">
      {ref && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{ref.kind}</Badge>
          {ref.status && <Badge>{ref.status}</Badge>}
          <Btn variant="link" icon={FiExternalLink} to={ref.to}>Abrir expediente</Btn>
        </div>
      )}
      <ol className="mb-0 list-none pl-0">
        {journey.milestones.map((m, i) => <Milestone key={m.key} milestone={m} last={i === journey.milestones.length - 1} />)}
      </ol>
      {events.length > 0 && (
        <div className="border-t border-fam-border pt-3">
          <h4 className="mb-2 text-[13px] font-semibold text-fam-text">Últimos movimientos</h4>
          <ul className="mb-0 list-none space-y-2 pl-0">
            {visible.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 text-fam-text">
                  {e.title || statusLabel(e.state)}
                  <span className="text-fam-muted"> · {[SOURCE_LABEL[e.source], e.by].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="fam-numeric shrink-0 text-fam-muted">{date(e.at)}</span>
              </li>
            ))}
          </ul>
          {events.length > 5 && (
            <Btn variant="link" className="mt-2" onClick={() => setShowAll((v) => !v)}>{showAll ? "Ver menos" : `Ver los ${events.length} movimientos`}</Btn>
          )}
        </div>
      )}
    </div>
  );
}
