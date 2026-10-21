import React, { useMemo, useState } from "react";
import Button from "../../../core/ui/components/Button";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";

const inputClass = "w-full rounded-[var(--st-radius-md)] border px-3 py-2 text-sm outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };

const statusTone = (value) => {
  const status = String(value || "draft").toLowerCase();
  if (status === "active") return "success";
  if (status === "superseded") return "neutral";
  return "warning";
};

const PreventiveAnnualPlanBoard = ({
  plans = [],
  activePlanId = null,
  onSelectPlan,
  onCreatePlan,
  onPublishPlan,
  onRebaselinePlan,
  onIssueFst16,
  onSendMonthlyReport,
  busy = false,
}) => {
  const [draft, setDraft] = useState({
    year: new Date().getUTCFullYear(),
    title: "",
    notes: "",
    engineers_count: 2,
    working_days_per_month: 20,
    hours_per_day: 8,
    default_average_minutes: 180,
  });
  const [reportMonth, setReportMonth] = useState(new Date().getUTCMonth() + 1);

  const sortedPlans = useMemo(
    () =>
      (Array.isArray(plans) ? plans : []).slice().sort((a, b) => {
        if (Number(b.plan_year || 0) !== Number(a.plan_year || 0)) {
          return Number(b.plan_year || 0) - Number(a.plan_year || 0);
        }
        return Number(b.version || 0) - Number(a.version || 0);
      }),
    [plans],
  );

  return (
    <ServicioCard className="st-scope p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Plan anual preventivo (F.ST-16)</h3>
          <p className="text-xs" style={{ color: "var(--st-text-muted)" }}>Base empresarial para ST-01-02 con capacidad Anexo 7 y versionado.</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-6">
        <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
          Año
          <input className={inputClass} style={inputStyle} type="number" value={draft.year} onChange={(event) => setDraft((prev) => ({ ...prev, year: event.target.value }))} />
        </label>
        <label className="text-xs font-medium xl:col-span-2" style={{ color: "var(--st-text-muted)" }}>
          Título
          <input className={inputClass} style={inputStyle} value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Plan anual preventivo 2026" />
        </label>
        <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
          Ingenieros
          <input className={inputClass} style={inputStyle} type="number" min="1" value={draft.engineers_count} onChange={(event) => setDraft((prev) => ({ ...prev, engineers_count: event.target.value }))} />
        </label>
        <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
          Días/mes
          <input className={inputClass} style={inputStyle} type="number" min="1" value={draft.working_days_per_month} onChange={(event) => setDraft((prev) => ({ ...prev, working_days_per_month: event.target.value }))} />
        </label>
        <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
          Horas/día
          <input className={inputClass} style={inputStyle} type="number" min="1" step="0.5" value={draft.hours_per_day} onChange={(event) => setDraft((prev) => ({ ...prev, hours_per_day: event.target.value }))} />
        </label>
        <label className="text-xs font-medium xl:col-span-2" style={{ color: "var(--st-text-muted)" }}>
          Notas
          <textarea className={inputClass} style={inputStyle} rows={2} value={draft.notes} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} />
        </label>
        <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
          Minutos prom. Anexo 7
          <input className={inputClass} style={inputStyle} type="number" min="30" step="10" value={draft.default_average_minutes} onChange={(event) => setDraft((prev) => ({ ...prev, default_average_minutes: event.target.value }))} />
        </label>
        <div className="xl:col-span-3 flex flex-wrap items-end gap-2">
          <Button
            onClick={() =>
              onCreatePlan?.({
                year: Number(draft.year),
                title: draft.title || null,
                notes: draft.notes || null,
                anexo7_capacity: {
                  engineers_count: Number(draft.engineers_count || 1),
                  working_days_per_month: Number(draft.working_days_per_month || 20),
                  hours_per_day: Number(draft.hours_per_day || 8),
                  default_average_minutes: Number(draft.default_average_minutes || 180),
                },
              })
            }
            loading={busy}
          >
            Generar F.ST-16
          </Button>
          <label className="text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
            Mes reporte
            <input className={inputClass} style={inputStyle} type="number" min="1" max="12" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} />
          </label>
          <Button variant="secondary" onClick={() => onSendMonthlyReport?.({ month: Number(reportMonth || 1) })} disabled={!activePlanId || busy}>
            Enviar avance mensual
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-[var(--st-radius-md)] border" style={{ borderColor: "var(--st-border)" }}>
        <table className="min-w-full text-left text-xs">
          <thead style={{ background: "var(--st-surface-sunken)", color: "var(--st-text-faint)" }}>
            <tr>
              <th className="px-3 py-2">Año</th>
              <th className="px-3 py-2">Versión</th>
              <th className="px-3 py-2">Título</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlans.length === 0 ? (
              <tr>
                <td className="px-3 py-4" style={{ color: "var(--st-text-faint)" }} colSpan={6}>Sin planes preventivos generados.</td>
              </tr>
            ) : (
              sortedPlans.map((plan) => {
                const selected = Number(activePlanId) === Number(plan.id);
                return (
                  <tr key={plan.id} style={{ borderTop: "1px solid var(--st-border)", background: selected ? "var(--st-accent-soft)" : "transparent" }}>
                    <td className="px-3 py-2 font-semibold" style={{ color: "var(--st-text)" }}>{plan.plan_year}</td>
                    <td className="px-3 py-2" style={{ color: "var(--st-text-muted)" }}>v{plan.version}</td>
                    <td className="px-3 py-2" style={{ color: "var(--st-text-muted)" }}>{plan.title || "Plan anual"}</td>
                    <td className="px-3 py-2"><ServicioBadge tone={statusTone(plan.status)}>{plan.status}</ServicioBadge></td>
                    <td className="px-3 py-2" style={{ color: "var(--st-text-muted)" }}>{plan.completed_items || 0}/{plan.total_items || 0}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => onSelectPlan?.(plan)} disabled={busy}>Abrir</Button>
                        <Button size="sm" variant="outline" onClick={() => onIssueFst16?.(plan)} disabled={busy}>PDF F.ST-16</Button>
                        <Button size="sm" variant="outline" onClick={() => onPublishPlan?.(plan)} disabled={busy}>Publicar</Button>
                        <Button size="sm" variant="outline" onClick={() => onRebaselinePlan?.(plan)} disabled={busy}>Rebaseline</Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </ServicioCard>
  );
};

export default PreventiveAnnualPlanBoard;
