import React, { useMemo, useState } from "react";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";

const inputClass =
 "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100";

const statusChip = (value) => {
 const status = String(value || "draft").toLowerCase();
 if (status === "active") return "bg-emerald-100 text-emerald-700";
 if (status === "superseded") return "bg-slate-100 text-slate-600";
 return "bg-amber-100 text-amber-700";
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
 <Card className="p-4">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <h3 className="text-base font-semibold text-slate-900">Plan anual preventivo (F.ST-16)</h3>
 <p className="text-xs text-slate-600">
 Base empresarial para ST-01-02 con capacidad Anexo 7 y versionado.
 </p>
 </div>
 </div>

 <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-6">
 <label className="text-xs font-medium text-slate-600">
 Año
 <input
 className={inputClass}
 type="number"
 value={draft.year}
 onChange={(event) => setDraft((prev) => ({ ...prev, year: event.target.value }))}
 />
 </label>
 <label className="text-xs font-medium text-slate-600 xl:col-span-2">
 Título
 <input
 className={inputClass}
 value={draft.title}
 onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
 placeholder="Plan anual preventivo 2026"
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Ingenieros
 <input
 className={inputClass}
 type="number"
 min="1"
 value={draft.engineers_count}
 onChange={(event) =>
 setDraft((prev) => ({ ...prev, engineers_count: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Días/mes
 <input
 className={inputClass}
 type="number"
 min="1"
 value={draft.working_days_per_month}
 onChange={(event) =>
 setDraft((prev) => ({ ...prev, working_days_per_month: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Horas/día
 <input
 className={inputClass}
 type="number"
 min="1"
 step="0.5"
 value={draft.hours_per_day}
 onChange={(event) =>
 setDraft((prev) => ({ ...prev, hours_per_day: event.target.value }))
 }
 />
 </label>
 <label className="text-xs font-medium text-slate-600 xl:col-span-2">
 Notas
 <textarea
 className={inputClass}
 rows={2}
 value={draft.notes}
 onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Minutos prom. Anexo 7
 <input
 className={inputClass}
 type="number"
 min="30"
 step="10"
 value={draft.default_average_minutes}
 onChange={(event) =>
 setDraft((prev) => ({ ...prev, default_average_minutes: event.target.value }))
 }
 />
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
 <label className="text-xs font-medium text-slate-600">
 Mes reporte
 <input
 className={inputClass}
 type="number"
 min="1"
 max="12"
 value={reportMonth}
 onChange={(event) => setReportMonth(event.target.value)}
 />
 </label>
 <Button
 variant="secondary"
 onClick={() => onSendMonthlyReport?.({ month: Number(reportMonth || 1) })}
 disabled={!activePlanId || busy}
 >
 Enviar avance mensual
 </Button>
 </div>
 </div>

 <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
 <table className="min-w-full text-left text-xs">
 <thead className="bg-slate-50 text-slate-600">
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
 <td className="px-3 py-4 text-slate-500" colSpan={6}>
 Sin planes preventivos generados.
 </td>
 </tr>
 ) : (
 sortedPlans.map((plan) => {
 const selected = Number(activePlanId) === Number(plan.id);
 return (
 <tr
 key={plan.id}
 className={`border-t border-slate-100 ${selected ? "bg-blue-50" : "hover:bg-slate-50"}`}
 >
 <td className="px-3 py-2 font-semibold text-slate-700">{plan.plan_year}</td>
 <td className="px-3 py-2 text-slate-700">v{plan.version}</td>
 <td className="px-3 py-2 text-slate-700">{plan.title || "Plan anual"}</td>
 <td className="px-3 py-2">
 <span className={`rounded-full px-2 py-1 font-semibold ${statusChip(plan.status)}`}>
 {plan.status}
 </span>
 </td>
 <td className="px-3 py-2 text-slate-700">
 {plan.completed_items || 0}/{plan.total_items || 0}
 </td>
 <td className="px-3 py-2">
 <div className="flex justify-end gap-2">
 <Button
 size="sm"
 variant="secondary"
 onClick={() => onSelectPlan?.(plan)}
 disabled={busy}
 >
 Abrir
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => onIssueFst16?.(plan)}
 disabled={busy}
 >
 PDF F.ST-16
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => onPublishPlan?.(plan)}
 disabled={busy}
 >
 Publicar
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => onRebaselinePlan?.(plan)}
 disabled={busy}
 >
 Rebaseline
 </Button>
 </div>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 </Card>
 );
};

export default PreventiveAnnualPlanBoard;
