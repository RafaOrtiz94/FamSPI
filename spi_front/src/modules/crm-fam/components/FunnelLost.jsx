// Columna final del tablero: "Cerrado perdido". Reúne las oportunidades cerradas como perdidas,
// incluidas las que nacieron de un Business Case no factible. No recibe tarjetas por arrastre:
// una oportunidad se cierra como perdida desde su detalle, con su motivo.
import { Link } from "react-router-dom";
import { FiBriefcase } from "react-icons/fi";
import { date, money, number } from "../ui/format";
import { originOf } from "./FunnelPlans";

const BASE = "/dashboard/crm-fam";
const VISIBLE = 30;

const reasonOf = (opp) => opp.lost_reason_name || (opp.lost_reason_detail || "").trim() || "Sin motivo registrado";

function LostCard({ opp }) {
  const origin = originOf(opp);
  return (
    <article className="rounded-lg border border-fam-border bg-fam-surface p-3">
      {origin && <span className="-mx-3 -mt-3 mb-2.5 block h-1 rounded-t-lg" style={{ backgroundColor: origin.color }} aria-hidden="true" />}
      <Link to={`${BASE}/opportunities/${opp.id}`} className="block text-left">
        <span className="line-clamp-2 text-sm font-medium text-fam-text">{opp.name}</span>
        <span className="mt-1 flex items-center gap-1.5 text-[13px] text-fam-muted">
          <FiBriefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{opp.account_name || "Sin cuenta"}</span>
        </span>
      </Link>
      <p className="mt-2 line-clamp-2 text-xs text-fam-danger">{reasonOf(opp)}</p>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-fam-muted">
        <span>{opp.actual_close_date ? `Cerrada el ${date(opp.actual_close_date)}` : "Sin fecha de cierre"}</span>
        <span className="fam-numeric shrink-0">{opp.estimated_amount != null ? money(opp.estimated_amount) : "—"}</span>
      </div>
    </article>
  );
}

export function LostColumn({ opps, loading }) {
  const list = opps || [];
  const total = list.reduce((sum, o) => sum + (Number(o.estimated_amount) || 0), 0);
  return (
    <section aria-label="Cerrado perdido" className="flex w-[18rem] shrink-0 flex-col rounded-xl border border-fam-border bg-fam-subtle">
      <header className="border-b border-fam-border px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-fam-text">Cerrado perdido</h3>
          <span className="fam-numeric shrink-0 text-[13px] text-fam-muted">{loading ? "" : number(list.length)}</span>
        </div>
        <p className="fam-numeric text-[13px] text-fam-muted">{money(total)}</p>
      </header>
      <div className="flex min-h-[96px] flex-1 flex-col gap-2 overflow-y-auto p-2 lg:max-h-[calc(100dvh-20rem)]">
        {!loading && list.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-fam-muted">Sin registros</p>}
        {list.slice(0, VISIBLE).map((o) => <LostCard key={o.id} opp={o} />)}
        {list.length > VISIBLE && (
          <Link to={`${BASE}/opportunities?view=table&status=lost`} className="px-2 py-1 text-center text-[13px] text-fam-action underline underline-offset-2">
            Ver las {number(list.length)} en la tabla
          </Link>
        )}
      </div>
    </section>
  );
}
