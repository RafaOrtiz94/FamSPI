// Identidad de color del embudo y franja de planes de cuenta.
//  - Cada tarjeta lleva una barra de color según de dónde nació la oportunidad (compra pública o
//    compra privada) y una marca violeta si su cuenta tiene un plan activo.
//  - Un plan de cuenta dura años y no pasa por las fases: vive en una franja fija sobre el tablero,
//    con su avance contra la meta. Al elegirlo, el tablero muestra solo sus oportunidades.
// Los colores son la paleta de categorías de DESIGN.md (distinguen origen, no estado) y siempre
// van acompañados de texto.
import { useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronDown, FiChevronRight, FiExternalLink } from "react-icons/fi";
import { Badge, cx, Skeleton } from "../ui/kit";
import { date, money, number } from "../ui/format";
import { accountClassification } from "../ui/status";

export const PLAN_COLOR = "#7654A3";
// El Business Case no es un origen: es la herramienta de factibilidad de una compra pública o privada.
export const ORIGINS = {
  public_purchase: { label: "Compra pública", color: "#167D8D" },
  private_purchase: { label: "Compra privada", color: "#98613C" },
};
export const originOf = (opp) => ORIGINS[opp.source] || null;

const Dot = ({ color }) => <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />;

// Marca de la tarjeta: origen y plan de cuenta.
export function CardIdentity({ opp }) {
  const origin = originOf(opp);
  if (!origin && !opp.account_plan_id) return null;
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fam-muted">
      {origin && <span className="inline-flex items-center gap-1.5"><Dot color={origin.color} />{origin.label}</span>}
      {opp.account_plan_id && (
        <span className="inline-flex min-w-0 items-center gap-1.5" title={`Aporta al plan de cuenta “${opp.account_plan_name}”`}>
          <Dot color={PLAN_COLOR} /><span className="truncate">Plan: {opp.account_plan_name}</span>
        </span>
      )}
    </span>
  );
}

export function OriginLegend() {
  return (
    <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fam-muted">
      <span>Color de la tarjeta:</span>
      {Object.values(ORIGINS).map((o) => <span key={o.label} className="inline-flex items-center gap-1.5"><Dot color={o.color} />{o.label}</span>)}
      <span className="inline-flex items-center gap-1.5"><Dot color={PLAN_COLOR} />Plan de cuenta</span>
    </p>
  );
}

const periodOf = (plan) => {
  if (!plan.period_start && !plan.period_end) return "Sin fecha de cierre";
  if (plan.period_start && plan.period_end) return `${date(plan.period_start)} – ${date(plan.period_end)}`;
  return plan.period_end ? `Hasta ${date(plan.period_end)}` : `Desde ${date(plan.period_start)}`;
};

function PlanCard({ plan, selected, onSelect }) {
  const tier = plan.account_classification ? accountClassification(plan.account_classification) : null;
  const pct = plan.progress_pct;
  return (
    <article
      className={cx("flex w-[18rem] shrink-0 flex-col rounded-lg border bg-fam-surface p-3", selected ? "border-fam-action ring-1 ring-fam-action" : "border-fam-border")}
    >
      <span className="-mx-3 -mt-3 mb-2.5 block h-1 rounded-t-lg" style={{ backgroundColor: PLAN_COLOR }} aria-hidden="true" />
      <button type="button" onClick={() => onSelect(plan)} aria-pressed={selected} className="block w-full text-left">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium text-fam-text">{plan.account_name}</span>
          {tier && <Badge tone={tier.tone} className="shrink-0">{tier.label}</Badge>}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-fam-muted">{plan.name} · {periodOf(plan)}</span>
      </button>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="fam-numeric text-sm font-semibold text-fam-text">{money(plan.sold_amount)}</span>
        <span className="fam-numeric text-xs text-fam-muted">de {money(plan.target_amount)}{pct !== null ? ` · ${pct}%` : ""}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-fam-subtle" role="img" aria-label={pct !== null ? `Avance del plan: ${pct}%` : "Plan sin meta"}>
        <div className="h-full rounded-full" style={{ width: `${pct || 0}%`, backgroundColor: PLAN_COLOR }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-fam-muted">
        <span>{number(plan.open_count)} abierta{plan.open_count === 1 ? "" : "s"} · {money(plan.open_amount)}</span>
        <Link to={`/dashboard/crm-fam/accounts/${plan.account_id}?tab=planes&plan=${plan.id}`} aria-label={`Abrir el plan de ${plan.account_name}`} title="Abrir plan de cuenta" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-fam-muted hover:bg-fam-subtle hover:text-fam-text">
          <FiExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      {plan.seller_name && <p className="mt-1 truncate text-xs text-fam-muted">{plan.seller_name}</p>}
    </article>
  );
}

export function PlansStrip({ plans, loading, selectedId, onSelect }) {
  const [open, setOpen] = useState(true);
  if (!loading && (!plans || plans.length === 0)) return null;
  const list = plans || [];
  const target = list.reduce((sum, p) => sum + p.target_amount, 0);
  const sold = list.reduce((sum, p) => sum + p.sold_amount, 0);
  return (
    <section aria-label="Planes de cuenta" className="mb-4 rounded-xl border border-fam-border bg-fam-canvas">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
        <span className="flex min-w-0 items-center gap-2">
          {open ? <FiChevronDown className="h-4 w-4 shrink-0 text-fam-muted" aria-hidden="true" /> : <FiChevronRight className="h-4 w-4 shrink-0 text-fam-muted" aria-hidden="true" />}
          <Dot color={PLAN_COLOR} />
          <span className="text-sm font-semibold text-fam-text">Planes de cuenta</span>
          <span className="fam-numeric text-[13px] text-fam-muted">{loading ? "" : number(list.length)}</span>
        </span>
        {!loading && <span className="fam-numeric shrink-0 text-[13px] text-fam-muted">{money(sold)} de {money(target)}</span>}
      </button>
      {open && (
        <div className="flex gap-2 overflow-x-auto border-t border-fam-border p-2">
          {loading
            ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-[132px] w-[18rem] shrink-0" />)
            : list.map((plan) => <PlanCard key={plan.id} plan={plan} selected={selectedId === plan.id} onSelect={onSelect} />)}
        </div>
      )}
    </section>
  );
}
