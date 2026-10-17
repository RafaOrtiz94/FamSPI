// Reportes gerenciales del CRM. Los cinco son de solo lectura y exclusivos de managers (el servidor
// responde 403 al resto). Cada vista usa los campos reales que devuelve el backend.
import { useState } from "react";
import { FiDownload } from "react-icons/fi";
import {
  downloadLostReasonsReportPdf, downloadRedFlagsReportPdf, fetchBlueSheetKpis, fetchCrmForecast, fetchLostReasonsReport,
  fetchRedFlagsReport, fetchWinLossPatternsReport,
} from "../../../core/api/crmFamApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import { Badge, Btn, cx, DataTable, EmptyState, ErrorNote, Field, PageHeader, Panel, SelectInput, SkeletonRows, StatStrip, StatusBadge, Tabs, TextInput } from "../ui/kit";
import { date, errorMessage, money, number } from "../ui/format";
import { isManager } from "../ui/roles";
import { blueSheetStatus, health as healthOf, opportunityStatus } from "../ui/status";
import { useLoad } from "../ui/useLoad";
import { useUrlState } from "../ui/useUrlState";
import { ExecutiveBoard, SalesGoals } from "./reports/ExecutiveReports";

const BASE = "/dashboard/crm-fam";
const TABS = [
  { value: "executive", label: "Dirección" },
  { value: "goals", label: "Metas" },
  { value: "forecast", label: "Pronóstico" },
  { value: "lost", label: "Motivos de pérdida" },
  { value: "redflags", label: "Red flags" },
  { value: "bluesheets", label: "Blue Sheets" },
  { value: "winloss", label: "Ganadas vs. perdidas" },
];
const SEVERITY = { low: ["Baja", "neutral"], medium: ["Media", "warning"], high: ["Alta", "danger"], critical: ["Crítica", "danger"] };
const FLAG_STATUS = { open: ["Abierta", "warning"], accepted: ["Aceptada", "neutral"], resolved: ["Resuelta", "success"] };
const asList = (v) => (Array.isArray(v) ? v : []);

// Barra proporcional dentro de una celda: comparar magnitudes sin un gráfico aparte.
function Bar({ value, max }) {
  return (
    <div className="mt-1 h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-fam-subtle" aria-hidden="true">
      <div className="h-full rounded-full bg-fam-action" style={{ width: `${max > 0 ? Math.min(100, (Number(value) / max) * 100) : 0}%` }} />
    </div>
  );
}

function PdfButton({ download }) {
  const { showToast } = useUI();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await download(); } catch (err) { showToast(errorMessage(err, "No se pudo generar el PDF."), "error"); }
    finally { setBusy(false); }
  };
  return <Btn icon={FiDownload} loading={busy} onClick={run}>{busy ? "Generando…" : "PDF"}</Btn>;
}

function DateRange({ from, to, onChange }) {
  return (
    <>
      <div className="w-full sm:w-44"><Field label="Cierre desde">{(p) => <TextInput {...p} type="date" value={from} onChange={(e) => onChange({ from: e.target.value })} />}</Field></div>
      <div className="w-full sm:w-44"><Field label="Cierre hasta">{(p) => <TextInput {...p} type="date" value={to} onChange={(e) => onChange({ to: e.target.value })} />}</Field></div>
    </>
  );
}

// ─── Pronóstico ──────────────────────────────────────────────────────────────
function ForecastReport({ url, setUrl }) {
  const period = url.period === "month" ? "month" : "quarter";
  const { loading, data, error, reload } = useLoad(() => fetchCrmForecast({ period }), [period], { fallback: "No se pudo cargar el pronóstico." });
  const rows = asList(data?.breakdown);
  const open = rows.find((r) => r.status === "open");
  const won = rows.find((r) => r.status === "won");
  const max = Math.max(1, ...rows.map((r) => Number(r.pipeline_total || 0)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-52">
          <Field label="Periodo">
            {(p) => (
              <SelectInput {...p} value={period} onChange={(e) => setUrl({ period: e.target.value })}>
                <option value="quarter">Trimestre actual</option>
                <option value="month">Mes actual</option>
              </SelectInput>
            )}
          </Field>
        </div>
        {data?.date_start && <p className="pb-2 text-[13px] text-fam-muted">Cierre estimado entre el <span className="fam-numeric text-fam-text">{date(data.date_start)}</span> y el <span className="fam-numeric text-fam-text">{date(data.date_end)}</span></p>}
      </div>
      <ErrorNote message={error} onRetry={reload} />
      {loading && !data ? <SkeletonRows rows={4} /> : error ? null : rows.length === 0 ? (
        <EmptyState title="Sin oportunidades con cierre en este periodo" hint="El pronóstico se arma con la fecha de cierre estimada de cada oportunidad." />
      ) : (
        <>
          <StatStrip
            items={[
              { label: "Pronóstico ponderado", value: money(open?.weighted_total), hint: "abiertas × su probabilidad" },
              { label: "Pipeline abierto", value: money(open?.pipeline_total), hint: `${number(open?.count)} oportunidad(es)` },
              { label: "Ganado en el periodo", value: money(won?.won_total), hint: `${number(won?.count)} oportunidad(es)` },
            ]}
          />
          <Panel flush>
            <DataTable
              caption="Pronóstico por estado"
              rowKey="status"
              columns={[
                { key: "status", header: "Estado", render: (r) => <div><StatusBadge of={opportunityStatus} value={r.status} /><Bar value={r.pipeline_total} max={max} /></div> },
                { key: "count", header: "Oportunidades", align: "right", render: (r) => number(r.count) },
                { key: "pipeline_total", header: "Pipeline", align: "right", render: (r) => money(r.pipeline_total) },
                { key: "weighted_total", header: "Ponderado", align: "right", hideBelow: "sm", render: (r) => money(r.weighted_total) },
                { key: "won_total", header: "Ganado", align: "right", hideBelow: "sm", render: (r) => (r.won_total != null ? money(r.won_total) : "—") },
              ]}
              rows={rows}
            />
          </Panel>
        </>
      )}
    </div>
  );
}

// ─── Motivos de pérdida ──────────────────────────────────────────────────────
function LostReasonsReport({ url, setUrl }) {
  const params = { ...(url.from ? { date_from: url.from } : {}), ...(url.to ? { date_to: url.to } : {}) };
  const { loading, data, error, reload } = useLoad(() => fetchLostReasonsReport(params), [url.from, url.to], { fallback: "No se pudieron cargar los motivos de pérdida." });
  const rows = asList(data).map((r, i) => ({ ...r, key: r.reason_name || `sin-${i}` }));
  const max = Math.max(1, ...rows.map((r) => Number(r.count || 0)));
  const total = rows.reduce((s, r) => s + Number(r.count || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <DateRange from={url.from} to={url.to} onChange={setUrl} />
        <PdfButton download={() => downloadLostReasonsReportPdf(params)} />
      </div>
      <ErrorNote message={error} onRetry={reload} />
      {loading && !data ? <SkeletonRows rows={4} /> : error ? null : rows.length === 0 ? (
        <EmptyState title="Sin oportunidades perdidas en este rango" hint="Aparecerán aquí cuando se cierre una oportunidad como perdida." />
      ) : (
        <Panel flush>
          <DataTable
            caption="Motivos de pérdida"
            rowKey="key"
            columns={[
              { key: "reason_name", header: "Motivo", render: (r) => <div><span className="font-medium">{r.reason_name || "Sin motivo registrado"}</span><Bar value={r.count} max={max} /></div> },
              { key: "count", header: "Pérdidas", align: "right", render: (r) => number(r.count) },
              { key: "share", header: "Del total", align: "right", hideBelow: "sm", render: (r) => `${total ? Math.round((Number(r.count) / total) * 100) : 0}%` },
              { key: "total_pipeline_lost", header: "Pipeline perdido", align: "right", render: (r) => money(r.total_pipeline_lost) },
            ]}
            rows={rows}
          />
        </Panel>
      )}
    </div>
  );
}

// ─── Red flags ───────────────────────────────────────────────────────────────
function RedFlagsReport({ url, setUrl }) {
  const params = { ...(url.severity ? { severity: url.severity } : {}), ...(url.flag ? { status: url.flag } : {}) };
  const { loading, data, error, reload } = useLoad(() => fetchRedFlagsReport(params), [url.severity, url.flag], { fallback: "No se pudieron cargar las red flags." });
  const rows = asList(data);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-44">
          <Field label="Severidad">
            {(p) => (
              <SelectInput {...p} value={url.severity} onChange={(e) => setUrl({ severity: e.target.value })}>
                <option value="">Todas</option>
                {Object.entries(SEVERITY).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
              </SelectInput>
            )}
          </Field>
        </div>
        <div className="w-full sm:w-44">
          <Field label="Estado">
            {(p) => (
              <SelectInput {...p} value={url.flag} onChange={(e) => setUrl({ flag: e.target.value })}>
                <option value="">Todos</option>
                {Object.entries(FLAG_STATUS).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
              </SelectInput>
            )}
          </Field>
        </div>
        <PdfButton download={() => downloadRedFlagsReportPdf(params)} />
      </div>
      <ErrorNote message={error} onRetry={reload} />
      {loading && !data ? <SkeletonRows rows={5} /> : error ? null : rows.length === 0 ? (
        <EmptyState title="Sin red flags con estos filtros" hint="Las red flags se registran en el Blue Sheet de cada oportunidad." />
      ) : (
        <Panel flush>
          <DataTable
            caption="Red flags"
            columns={[
              { key: "flag_description", header: "Red flag", render: (r) => <span className="block max-w-md">{r.flag_description || r.flag_title || "—"}</span> },
              { key: "severity", header: "Severidad", render: (r) => { const [l, t] = SEVERITY[r.severity] || [r.severity, "neutral"]; return <Badge tone={t}>{l}</Badge>; } },
              { key: "status", header: "Estado", hideBelow: "sm", render: (r) => { const [l, t] = FLAG_STATUS[r.status] || [r.status, "neutral"]; return <Badge tone={t}>{l}</Badge>; } },
              { key: "opportunity_name", header: "Oportunidad", hideBelow: "md", render: (r) => r.opportunity_name || "—" },
              { key: "owner_name", header: "Responsable", hideBelow: "lg" },
              { key: "created_at", header: "Registrada", hideBelow: "lg", render: (r) => <span className="fam-numeric">{date(r.created_at)}</span> },
            ]}
            rows={rows}
          />
        </Panel>
      )}
    </div>
  );
}

// ─── Blue Sheets ─────────────────────────────────────────────────────────────
function BlueSheetsReport() {
  const { loading, data, error, reload } = useLoad(() => fetchBlueSheetKpis(), [], { fallback: "No se pudieron cargar los indicadores de Blue Sheet." });
  const rows = asList(data).map((r, i) => ({ ...r, key: `${r.status}-${r.health_status}-${i}` }));
  const pct = (v) => (v != null ? `${Math.round(Number(v))}%` : "—");
  return (
    <div className="space-y-5">
      <ErrorNote message={error} onRetry={reload} />
      {loading && !data ? <SkeletonRows rows={4} /> : error ? null : rows.length === 0 ? (
        <EmptyState title="Aún no hay Blue Sheets" hint="Se crean desde la ficha de cada oportunidad." action={<Btn to={`${BASE}/opportunities`}>Ir al embudo</Btn>} />
      ) : (
        <Panel flush>
          <DataTable
            caption="Blue Sheets por estado y salud"
            rowKey="key"
            columns={[
              { key: "status", header: "Estado", render: (r) => <StatusBadge of={blueSheetStatus} value={r.status} /> },
              { key: "health_status", header: "Salud", render: (r) => <StatusBadge of={healthOf} value={r.health_status || "gray"} /> },
              { key: "count", header: "Blue Sheets", align: "right", render: (r) => number(r.count) },
              { key: "avg_completeness", header: "Completitud media", align: "right", hideBelow: "sm", render: (r) => pct(r.avg_completeness) },
              { key: "avg_scorecard", header: "Scorecard medio", align: "right", hideBelow: "md", render: (r) => pct(r.avg_scorecard) },
              { key: "avg_health", header: "Salud media", align: "right", hideBelow: "md", render: (r) => (r.avg_health != null ? `${Math.round(Number(r.avg_health))} / 100` : "—") },
            ]}
            rows={rows}
          />
        </Panel>
      )}
    </div>
  );
}

// ─── Ganadas vs. perdidas ────────────────────────────────────────────────────
const RECEPTIVITY = { growth: "Quiere crecer", trouble: "Tiene un problema", even_keel: "Está conforme", overconfident: "Se cree mejor de lo que está" };
const METRICS = [
  { key: "avg_completeness", label: "Completitud del Blue Sheet", unit: "%" },
  { key: "avg_scorecard", label: "Scorecard", unit: "%" },
  { key: "avg_health", label: "Salud del negocio", unit: " / 100" },
  { key: "avg_buyers_mapped", label: "Compradores identificados" },
  { key: "avg_economic_buyers", label: "Compradores económicos identificados" },
  { key: "avg_wins_per_bs", label: "Wins registrados por Blue Sheet" },
  { key: "avg_open_red_flags", label: "Red flags abiertas", lowerIsBetter: true },
];

function WinLossReport({ url, setUrl }) {
  const params = { ...(url.from ? { date_from: url.from } : {}), ...(url.to ? { date_to: url.to } : {}) };
  const { loading, data, error, reload } = useLoad(() => fetchWinLossPatternsReport(params), [url.from, url.to], { fallback: "No se pudo cargar la comparación." });
  const won = asList(data?.summary).find((r) => r.status === "won");
  const lost = asList(data?.summary).find((r) => r.status === "lost");
  const fmt = (v, unit = "") => (v != null ? `${Number(v).toFixed(1)}${unit}` : "—");
  const rows = METRICS.map((m) => {
    const w = won?.[m.key], l = lost?.[m.key];
    const delta = w != null && l != null ? Number(w) - Number(l) : null;
    return { ...m, won: w, lost: l, delta, good: delta === null ? null : (m.lowerIsBetter ? delta <= 0 : delta >= 0) };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3"><DateRange from={url.from} to={url.to} onChange={setUrl} /></div>
      <p className="max-w-3xl text-sm text-fam-muted">Compara el Blue Sheet de las oportunidades que ganamos con el de las que perdimos: qué estaba mejor documentado en las ganadas.</p>
      <ErrorNote message={error} onRetry={reload} />
      {loading && !data ? <SkeletonRows rows={5} /> : error ? null : !won && !lost ? (
        <EmptyState title="Sin oportunidades cerradas con Blue Sheet" hint="La comparación necesita oportunidades ganadas o perdidas que tengan Blue Sheet en el rango elegido." />
      ) : (
        <>
          <Panel flush>
            <DataTable
              caption="Ganadas frente a perdidas"
              rowKey="key"
              columns={[
                { key: "label", header: "Indicador (promedio)" },
                { key: "won", header: `Ganadas (${number(won?.opportunities)})`, align: "right", render: (r) => fmt(r.won, r.unit) },
                { key: "lost", header: `Perdidas (${number(lost?.opportunities)})`, align: "right", render: (r) => fmt(r.lost, r.unit) },
                { key: "delta", header: "Diferencia", align: "right", render: (r) => (r.delta === null ? "—" : <span className={cx("font-medium", r.good ? "text-fam-success" : "text-fam-danger")}>{r.delta > 0 ? "+" : ""}{r.delta.toFixed(1)}</span>) },
              ]}
              rows={rows}
            />
          </Panel>
          {asList(data?.byReceptivity).length > 0 && (
            <Panel title="Actitud de los compradores según el resultado" flush>
              <DataTable
                caption="Receptividad de compradores por resultado"
                rowKey="key"
                columns={[
                  { key: "status", header: "Resultado", render: (r) => <StatusBadge of={opportunityStatus} value={r.status} /> },
                  { key: "receptivity", header: "Cómo veía su situación", render: (r) => RECEPTIVITY[r.receptivity] || r.receptivity || "Sin registrar" },
                  { key: "count", header: "Compradores", align: "right", render: (r) => number(r.count) },
                ]}
                rows={data.byReceptivity.map((r, i) => ({ ...r, key: `${r.status}-${r.receptivity}-${i}` }))}
              />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

export default function CrmReportsPage() {
  const { user } = useAuth();
  const [url, setUrl] = useUrlState({ tab: "executive", period: "quarter", from: "", to: "", severity: "", flag: "", month: "" });
  const tab = TABS.some((t) => t.value === url.tab) ? url.tab : "executive";

  if (!isManager(user)) {
    return (
      <div className="flex min-w-0 flex-col">
        <PageHeader title="Reportes" />
        <Panel>
          <EmptyState title="Reportes para jefatura y gerencia" hint="Tu día a día está en Mi día y en el embudo: ahí ves tu pipeline, tus cierres próximos y tus pendientes." action={<Btn variant="primary" to={BASE}>Ir a Mi día</Btn>} />
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader title="Reportes">
        <Tabs label="Reportes" tabs={TABS} value={tab} onChange={(v) => setUrl({ tab: v })} />
      </PageHeader>
      {tab === "executive" && <ExecutiveBoard url={url} setUrl={setUrl} />}
      {tab === "goals" && <SalesGoals url={url} setUrl={setUrl} />}
      {tab === "forecast" && <ForecastReport url={url} setUrl={setUrl} />}
      {tab === "lost" && <LostReasonsReport url={url} setUrl={setUrl} />}
      {tab === "redflags" && <RedFlagsReport url={url} setUrl={setUrl} />}
      {tab === "bluesheets" && <BlueSheetsReport />}
      {tab === "winloss" && <WinLossReport url={url} setUrl={setUrl} />}
    </div>
  );
}
