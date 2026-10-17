// Planes de la cuenta y su proyección: una cuenta puede tener varios (por año, trimestre, vendedor).
// El plan seleccionado alimenta los indicadores de la cabecera y el FODA.
import { useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import Modal from "../../../../core/ui/components/Modal";
import { createAccountPlan, deleteAccountPlan, updateAccountPlan } from "../../../../core/api/crmFamApi";
import { getUsers } from "../../../../core/api/usersApi";
import { useUI } from "../../../../core/ui/UIContext";
import { Badge, Btn, cx, DefList, EmptyState, ErrorNote, Field, Panel, SelectInput, SkeletonRows, TextArea, TextInput } from "../../ui/kit";
import { date, errorMessage, money, number } from "../../ui/format";

const EMPTY = { name: "", period_start: "", period_end: "", target_amount: "", seller_user_id: "", status: "active", notes: "" };
const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");
export const planPeriod = (p) => (p.period_start || p.period_end ? `${p.period_start ? date(dateOnly(p.period_start)) : "…"} – ${p.period_end ? date(dateOnly(p.period_end)) : "…"}` : "Todo el histórico");

function PlanFormModal({ accountId, plan, canEditSeller, onClose, onSaved }) {
  const [form, setForm] = useState(plan ? {
    name: plan.name || "", period_start: dateOnly(plan.period_start), period_end: dateOnly(plan.period_end),
    target_amount: plan.target_amount ?? "", seller_user_id: plan.seller_user_id || "", status: plan.status || "active", notes: plan.notes || "",
  } : EMPTY);
  const [sellers, setSellers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  useEffect(() => {
    if (!canEditSeller) return;
    getUsers()
      .then((users) => setSellers(Array.isArray(users) ? users : (users?.rows || users?.data || [])))
      .catch(() => setSellers([]));
  }, [canEditSeller]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    const payload = {
      name: form.name,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
      target_amount: form.target_amount,
      status: form.status,
      notes: form.notes || null,
      ...(canEditSeller && form.seller_user_id ? { seller_user_id: Number(form.seller_user_id) } : {}),
    };
    try {
      const saved = plan?.id ? await updateAccountPlan(accountId, plan.id, payload) : await createAccountPlan(accountId, payload);
      onSaved(saved, !plan?.id);
    } catch (err) {
      setError(errorMessage(err, "No se pudo guardar el plan."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={plan?.id ? "Editar plan" : "Nuevo plan de cuenta"} onClose={onClose} maxWidth="max-w-xl" disableClose={saving}>
      <form onSubmit={submit}>
        <ErrorNote message={error} className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            {(p) => <TextInput {...p} value={form.name} onChange={set("name")} required maxLength={150} placeholder="Plan 2026" autoFocus />}
          </Field>
          <Field label="Meta de ventas (USD)">
            {(p) => <TextInput {...p} type="number" min="0" step="0.01" value={form.target_amount} onChange={set("target_amount")} required className="fam-numeric" />}
          </Field>
          <Field label="Inicio del periodo" optional>
            {(p) => <TextInput {...p} type="date" value={form.period_start} onChange={set("period_start")} />}
          </Field>
          <Field label="Fin del periodo" optional hint="Sin periodo, cuenta todo lo ganado o ya con contrato.">
            {(p) => <TextInput {...p} type="date" value={form.period_end} onChange={set("period_end")} />}
          </Field>
          <Field label="Estado">
            {(p) => (
              <SelectInput {...p} value={form.status} onChange={set("status")}>
                <option value="active">Activo</option>
                <option value="closed">Cerrado</option>
              </SelectInput>
            )}
          </Field>
          {canEditSeller && (
            <Field label="Vendedor" optional hint="Su win rate y promedio definen el pipeline a generar.">
              {(p) => (
                <SelectInput {...p} value={form.seller_user_id} onChange={set("seller_user_id")}>
                  <option value="">Propietario de la cuenta</option>
                  {sellers.map((u) => <option key={u.id} value={u.id}>{u.fullname || u.email}</option>)}
                </SelectInput>
              )}
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Notas" optional>
              {(p) => <TextArea {...p} rows={2} value={form.notes} onChange={set("notes")} />}
            </Field>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={saving}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={saving}>{saving ? "Guardando…" : "Guardar plan"}</Btn>
        </div>
      </form>
    </Modal>
  );
}

// Proyección del plan seleccionado. El pipeline sale del historial del vendedor, no de esta cuenta.
export function PlanProjection({ stats, loading }) {
  if (loading) return <SkeletonRows rows={3} />;
  if (!stats) return <p className="text-sm text-fam-muted">No se pudo cargar la proyección.</p>;
  const seller = stats.seller || {};
  const hasPlan = Boolean(stats.plan);
  const closed = Number(seller.won_count || 0) + Number(seller.lost_count || 0);
  const hasHistory = Number(seller.win_rate_pct) > 0;
  return (
    <div className="space-y-5">
      <div className={cx("rounded-lg p-4", hasPlan && hasHistory ? "bg-fam-selected" : "bg-fam-subtle")}>
        <p className="text-[13px] text-fam-muted">Pipeline a generar para cerrar la meta</p>
        <p className="fam-numeric text-3xl font-semibold tracking-tight text-fam-text">
          {hasPlan && hasHistory ? money(stats.required_pipeline_amount) : "—"}
        </p>
        <p className="mt-1 text-[13px] text-fam-muted">
          {!hasPlan
            ? "Crea un plan para calcularlo."
            : !hasHistory
              ? (closed > 0
                ? `El vendedor no ha ganado ninguna de sus ${number(closed)} oportunidades cerradas; con win rate 0% no se puede proyectar.`
                : "El vendedor aún no tiene oportunidades cerradas; no hay win rate con qué proyectar.")
              : `Faltan ${money(stats.remaining_to_target)} ÷ win rate ${seller.win_rate_pct}%${stats.opportunities_to_generate != null ? ` ≈ ${number(stats.opportunities_to_generate)} oportunidades de ${money(seller.avg_deal_size)}` : ""}.`}
        </p>
      </div>
      <DefList
        columns={2}
        items={[
          { label: "Meta del plan", value: hasPlan ? money(stats.sales_target_amount) : "—", numeric: true },
          { label: "Vendido (ganado o con contrato)", value: `${money(stats.sold_amount)} · ${number(stats.sold_opportunities)} opp.`, numeric: true },
          { label: "Falta por vender", value: hasPlan ? money(stats.remaining_to_target) : "—", numeric: true },
          { label: "Vendedor del plan", value: seller.name ? `${seller.name} · ${number(seller.won_count)} ganadas, ${number(seller.lost_count)} perdidas` : "—" },
          { label: "Total generado en la cuenta", value: `${money(stats.total_estimated_amount)} · ${number(stats.total_opportunities)} opp.`, numeric: true },
          { label: "Cierre en la cuenta", value: stats.win_rate_pct != null ? `${stats.win_rate_pct}% ganadas · ${stats.loss_rate_pct}% perdidas` : "Sin oportunidades cerradas" },
        ]}
      />
    </div>
  );
}

export default function AccountPlans({ accountId, plans, loading, selectedPlanId, onSelect, canEditSeller, stats, statsLoading, onChanged }) {
  const { showToast, askConfirm } = useUI();
  const [editing, setEditing] = useState(null); // null | {} (nuevo) | plan
  const activeId = selectedPlanId || stats?.plan?.id || plans[0]?.id;

  const remove = (plan) => askConfirm(`¿Eliminar el plan “${plan.name}”?`, async () => {
    try {
      await deleteAccountPlan(accountId, plan.id);
      if (selectedPlanId === plan.id) onSelect(null);
      onChanged();
      showToast("Plan eliminado", "success");
    } catch (err) {
      showToast(errorMessage(err, "No se pudo eliminar el plan."), "error");
    }
  });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel title="Planes" hint="Selecciona uno para ver su proyección" flush actions={<Btn variant="primary" size="sm" icon={FiPlus} onClick={() => setEditing({})}>Nuevo plan</Btn>}>
        {loading ? (
          <SkeletonRows rows={3} />
        ) : plans.length === 0 ? (
          <EmptyState title="Esta cuenta no tiene planes" hint="Un plan fija la meta de ventas de un periodo y permite proyectar cuánto pipeline hay que generar." action={<Btn variant="primary" icon={FiPlus} onClick={() => setEditing({})}>Crear el primer plan</Btn>} />
        ) : (
          <ul className="divide-y divide-fam-border">
            {plans.map((p) => {
              const selected = activeId === p.id;
              return (
                <li key={p.id} className={cx("flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5", selected && "bg-fam-selected")}>
                  <button type="button" onClick={() => onSelect(p.id)} aria-pressed={selected} className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-fam-text">{p.name}</span>
                      <Badge tone={p.status === "active" ? "success" : "neutral"}>{p.status === "active" ? "Activo" : "Cerrado"}</Badge>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-fam-muted">
                      <span className="fam-numeric text-fam-text">{money(p.target_amount)}</span> · {planPeriod(p)}{p.seller_name ? ` · ${p.seller_name}` : ""}
                    </span>
                  </button>
                  <span className="flex shrink-0 gap-1">
                    <Btn variant="ghost" size="sm" onClick={() => setEditing(p)}>Editar</Btn>
                    <Btn variant="ghost" size="sm" onClick={() => remove(p)}>Eliminar</Btn>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Proyección comercial" hint={stats?.plan ? `${stats.plan.name} · ${planPeriod(stats.plan)}` : undefined}>
        <PlanProjection stats={stats} loading={statsLoading} />
      </Panel>

      {editing && (
        <PlanFormModal
          accountId={accountId}
          plan={editing.id ? editing : null}
          canEditSeller={canEditSeller}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setEditing(null);
            if (isNew && saved?.id) onSelect(saved.id);
            onChanged();
            showToast("Plan guardado", "success");
          }}
        />
      )}
    </div>
  );
}
