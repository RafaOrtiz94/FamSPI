// Reportes de dirección (Senior Ultra): tablero ejecutivo y metas por vendedor.
// Los números vienen ya calculados del servidor (crmInsights.service.js); aquí solo se presentan.
import { useState } from "react";
import { FiDownload } from "react-icons/fi";
import { fetchExecutiveBoard, fetchSalesGoals, saveSalesGoal } from "../../../../core/api/crmFamApi";
import { useUI } from "../../../../core/ui/UIContext";
import { Btn, DataTable, EmptyState, ErrorNote, Field, Panel, SkeletonRows, StatStrip, TextInput } from "../../ui/kit";
import { errorMessage, money, number } from "../../ui/format";
import { useLoad } from "../../ui/useLoad";

const percent = (value) => (value === null || value === undefined ? "—" : `${value}%`);
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const monthLabel = (ym) => { const [y, m] = String(ym).split("-"); return `${MONTHS[Number(m) - 1] || m} ${y}`; };
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

// Descarga una tabla como CSV (lo abre Excel). Separador ";" y BOM para tildes.
const downloadCsv = (filename, headers, rows) => {
  const cell = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const text = [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

function Bar({ value, max, tone = "bg-fam-action" }) {
  return (
    <div className="mt-1 h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-fam-subtle" aria-hidden="true">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${max > 0 ? Math.min(100, (Number(value) / max) * 100) : 0}%` }} />
    </div>
  );
}

// ─── Tablero de dirección ────────────────────────────────────────────────────
export function ExecutiveBoard({ url, setUrl }) {
  const { data, loading, error, reload } = useLoad(
    () => fetchExecutiveBoard({ from: url.from || undefined, to: url.to || undefined }),
    [url.from, url.to],
    { fallback: "No se pudo cargar el tablero de dirección." },
  );

  const filters = (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="w-full sm:w-44"><Field label="Cierre desde">{(p) => <TextInput {...p} type="date" value={url.from} onChange={(e) => setUrl({ from: e.target.value })} />}</Field></div>
      <div className="w-full sm:w-44"><Field label="Cierre hasta">{(p) => <TextInput {...p} type="date" value={url.to} onChange={(e) => setUrl({ to: e.target.value })} />}</Field></div>
      <p className="pb-2 text-[13px] text-fam-muted">{!url.from && !url.to ? "Sin fechas: el año en curso." : ""}</p>
    </div>
  );
  if (loading && !data) return <>{filters}<SkeletonRows rows={8} /></>;
  if (error || !data) return <>{filters}<ErrorNote message={error || "Sin datos."} onRetry={reload} /></>;

  const { totals, scenarios, stages, sellers, months, lost_reasons: lostReasons } = data;
  const maxStage = Math.max(1, ...stages.map((s) => s.amount));
  const maxSeller = Math.max(1, ...sellers.map((s) => s.sold_amount + s.open_amount));
  const maxMonth = Math.max(1, ...months.map((m) => m.sold_amount));
  const slowest = [...stages].filter((s) => s.count > 0).sort((a, b) => b.stalled_amount - a.stalled_amount || b.stalled_count - a.stalled_count)[0];

  return (
    <>
      {filters}
      <StatStrip
        className="mb-6"
        items={[
          { label: "Vendido", value: money(totals.sold_amount), hint: `${number(totals.sold_count)} oportunidad(es) ganadas o con contrato` },
          { label: "Meta del periodo", value: totals.target_amount ? money(totals.target_amount) : "Sin meta", hint: totals.target_amount ? `Avance ${percent(totals.progress_pct)} · ${number(totals.sellers_with_goal)} vendedor(es) con meta` : "Define metas en la pestaña Metas" },
          { label: "Tasa de cierre", value: percent(totals.win_rate_pct), hint: `${number(totals.sold_count)} ganadas · ${number(totals.lost_count)} perdidas` },
          { label: "Ciclo de venta", value: totals.avg_cycle_days === null ? "—" : `${number(totals.avg_cycle_days)} d`, hint: "de creación a cierre ganado" },
          { label: "Pipeline abierto", value: money(totals.open_amount), hint: `${number(totals.open_count)} oportunidad(es)` },
        ]}
      />

      {totals.open_without_date > 0 && (
        <p className="mb-5 rounded-lg bg-fam-warning-bg px-3 py-2.5 text-[13px] text-fam-warning">
          {number(totals.open_without_date)} oportunidad(es) abierta(s) no tienen fecha de cierre estimada y quedan fuera del pronóstico. Complétalas en el embudo.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <Panel title="Pronóstico por escenarios" hint="Lo ya vendido más lo abierto que cierra dentro del periodo">
          <StatStrip
            plain
            items={[
              { label: "Comprometido", value: money(scenarios.committed), hint: "vendido + abierto con 80 % o más" },
              { label: "Probable", value: money(scenarios.likely), hint: "vendido + abierto × su probabilidad" },
              { label: "Optimista", value: money(scenarios.best), hint: "vendido + todo lo abierto" },
            ]}
          />
        </Panel>

        <Panel title="Dónde se detiene el pipeline" hint="Oportunidades abiertas por fase y cuántas llevan 30 días o más en ella" flush>
          {slowest && slowest.stalled_count > 0 && (
            <p className="border-b border-fam-border px-4 py-2.5 text-[13px] text-fam-text sm:px-5">
              Mayor cuello de botella: <span className="font-semibold">{slowest.name}</span>, con {number(slowest.stalled_count)} detenida(s) por {money(slowest.stalled_amount)}.
            </p>
          )}
          <DataTable
            caption="Pipeline por fase"
            rowKey="id"
            columns={[
              { key: "name", header: "Fase", render: (r) => <div><span className="font-medium">{r.name}</span><Bar value={r.amount} max={maxStage} /></div> },
              { key: "count", header: "Abiertas", align: "right", render: (r) => number(r.count) },
              { key: "avg_days", header: "Días prom.", align: "right", render: (r) => (r.avg_days === null ? "—" : number(r.avg_days)) },
              { key: "stalled_count", header: "30+ días", align: "right", render: (r) => <span className={r.stalled_count ? "text-fam-warning" : undefined}>{number(r.stalled_count)}</span> },
              { key: "amount", header: "Monto", align: "right", hideBelow: "sm", render: (r) => money(r.amount) },
            ]}
            rows={stages}
          />
        </Panel>

        <Panel
          title="Por vendedor"
          hint="Vendido en el periodo y pipeline abierto actual"
          flush
          actions={<Btn icon={FiDownload} size="sm" onClick={() => downloadCsv(`crm-vendedores-${data.range.from}_${data.range.to}.csv`,
            ["Vendedor", "Vendido", "Ganadas", "Perdidas", "Tasa de cierre %", "Pipeline abierto", "Abiertas", "Ponderado"],
            sellers.map((s) => [s.seller_name, s.sold_amount, s.sold_count, s.lost_count, s.win_rate_pct ?? "", s.open_amount, s.open_count, s.weighted_amount]))}>Excel</Btn>}
        >
          {sellers.length === 0 ? <EmptyState title="Sin vendedores con oportunidades" /> : (
            <DataTable
              caption="Resultados por vendedor"
              rowKey="user_id"
              columns={[
                { key: "seller_name", header: "Vendedor", render: (r) => <div><span className="font-medium">{r.seller_name}</span><Bar value={r.sold_amount + r.open_amount} max={maxSeller} /></div> },
                { key: "sold_amount", header: "Vendido", align: "right", render: (r) => money(r.sold_amount) },
                { key: "win_rate_pct", header: "Cierre", align: "right", hideBelow: "sm", render: (r) => percent(r.win_rate_pct) },
                { key: "open_count", header: "Abiertas", align: "right", hideBelow: "sm", render: (r) => number(r.open_count) },
                { key: "open_amount", header: "Pipeline", align: "right", render: (r) => money(r.open_amount) },
              ]}
              rows={sellers}
            />
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Vendido por mes" flush>
            {months.length === 0 ? <EmptyState title="Sin cierres en el periodo" hint="Aparecerán aquí las oportunidades ganadas, con contrato o perdidas según su fecha de cierre." /> : (
              <DataTable
                caption="Cierres por mes"
                rowKey="month"
                columns={[
                  { key: "month", header: "Mes", render: (r) => <div><span className="font-medium">{monthLabel(r.month)}</span><Bar value={r.sold_amount} max={maxMonth} tone="bg-fam-success" /></div> },
                  { key: "sold_count", header: "Ganadas", align: "right", render: (r) => number(r.sold_count) },
                  { key: "lost_count", header: "Perdidas", align: "right", render: (r) => number(r.lost_count) },
                  { key: "sold_amount", header: "Vendido", align: "right", render: (r) => money(r.sold_amount) },
                ]}
                rows={months}
              />
            )}
          </Panel>
          <Panel title="Por qué se pierde" hint={`${number(totals.lost_count)} perdida(s) por ${money(totals.lost_amount)} en el periodo`} flush>
            {lostReasons.length === 0 ? <EmptyState title="Sin pérdidas en el periodo" /> : (
              <DataTable
                caption="Motivos de pérdida"
                rowKey="reason"
                columns={[
                  { key: "reason", header: "Motivo", render: (r) => <span className="font-medium">{r.reason}</span> },
                  { key: "count", header: "Casos", align: "right", render: (r) => number(r.count) },
                  { key: "amount", header: "Monto", align: "right", render: (r) => money(r.amount) },
                ]}
                rows={lostReasons}
              />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

// ─── Metas por vendedor ──────────────────────────────────────────────────────
function GoalInput({ seller, month, onSaved }) {
  const { showToast } = useUI();
  const [value, setValue] = useState(seller.target_amount === null ? "" : String(seller.target_amount));
  const [busy, setBusy] = useState(false);
  const dirty = value !== (seller.target_amount === null ? "" : String(seller.target_amount));
  const save = async () => {
    if (!dirty || busy) return;
    setBusy(true);
    try {
      await saveSalesGoal({ user_id: seller.user_id, month, target_amount: value === "" ? null : Number(value) });
      showToast(value === "" ? `Meta de ${seller.seller_name} eliminada` : `Meta de ${seller.seller_name} guardada`, "success");
      onSaved();
    } catch (err) {
      showToast(errorMessage(err, "No se pudo guardar la meta."), "error");
    } finally { setBusy(false); }
  };
  return (
    <TextInput
      type="number" min="0" step="100" inputMode="decimal" value={value} disabled={busy}
      aria-label={`Meta de ${seller.seller_name}`} placeholder="Sin meta" className="w-32 text-right"
      onChange={(e) => setValue(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
    />
  );
}

export function SalesGoals({ url, setUrl }) {
  const month = /^\d{4}-\d{2}$/.test(url.month || "") ? url.month : currentMonth();
  const { data, loading, error, reload } = useLoad(() => fetchSalesGoals({ month }), [month], { fallback: "No se pudieron cargar las metas." });
  const sellers = data?.sellers || [];
  const totals = data?.totals;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-44"><Field label="Mes">{(p) => <TextInput {...p} type="month" value={month} onChange={(e) => setUrl({ month: e.target.value })} />}</Field></div>
        <p className="pb-2 text-[13px] text-fam-muted">Escribe la meta de cada vendedor y sal del campo para guardarla. Vacío quita la meta.</p>
      </div>
      <ErrorNote message={error} onRetry={reload} className="mb-4" />
      {totals && (
        <StatStrip
          className="mb-6"
          items={[
            { label: `Meta de ${monthLabel(month)}`, value: totals.target_amount ? money(totals.target_amount) : "Sin meta", hint: `${number(totals.sellers_with_goal)} vendedor(es) con meta` },
            { label: "Vendido en el mes", value: money(totals.sold_amount), hint: totals.target_amount ? `Avance ${Math.round((totals.sold_amount / totals.target_amount) * 100)}%` : "ganado o con contrato" },
            { label: "Pipeline abierto", value: money(totals.open_amount), hint: `Ponderado ${money(totals.weighted_amount)}` },
          ]}
        />
      )}
      <Panel flush>
        {loading && !data ? <SkeletonRows rows={6} /> : sellers.length === 0 ? <EmptyState title="Sin vendedores con oportunidades" /> : (
          <DataTable
            caption="Metas por vendedor"
            rowKey="user_id"
            columns={[
              { key: "seller_name", header: "Vendedor", render: (r) => (
                <div>
                  <span className="font-medium">{r.seller_name}</span>
                  {r.target_amount !== null && <Bar value={r.sold_amount} max={r.target_amount} tone={r.progress_pct >= 100 ? "bg-fam-success" : "bg-fam-action"} />}
                </div>
              ) },
              { key: "target_amount", header: "Meta", align: "right", render: (r) => (data.can_edit ? <GoalInput key={`${r.user_id}-${month}-${r.target_amount}`} seller={r} month={month} onSaved={reload} /> : (r.target_amount === null ? "Sin meta" : money(r.target_amount))) },
              { key: "sold_amount", header: "Vendido", align: "right", render: (r) => money(r.sold_amount) },
              { key: "progress_pct", header: "Avance", align: "right", hideBelow: "sm", render: (r) => percent(r.progress_pct) },
              { key: "remaining_to_target", header: "Falta", align: "right", hideBelow: "lg", render: (r) => (r.remaining_to_target === null ? "—" : money(r.remaining_to_target)) },
              { key: "required_pipeline_amount", header: "Pipeline a generar", align: "right", hideBelow: "lg", render: (r) => (r.required_pipeline_amount === null ? (r.target_amount === null ? "—" : "Sin historial de cierre") : money(r.required_pipeline_amount)) },
              { key: "open_amount", header: "Pipeline abierto", align: "right", hideBelow: "sm", render: (r) => money(r.open_amount) },
            ]}
            rows={sellers}
          />
        )}
      </Panel>
    </>
  );
}
