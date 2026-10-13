// Embudo de ventas. Tres vistas del mismo pipeline abierto: tablero por fases (arrastrar o mover por
// menú), tabla ordenable y pronóstico ponderado. Cada tarjeta muestra el recorrido de su expediente
// (Business Case o compra) y sus accesos directos; el recorrido de todas llega en una sola consulta.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertTriangle, FiBriefcase, FiClock, FiExternalLink, FiFileText, FiMessageCircle, FiPlus, FiShoppingCart, FiUserPlus, FiUsers } from "react-icons/fi";
import {
  changeOpportunityStage, disqualifyLead, fetchAccounts, fetchActivities, fetchLeads, fetchOpportunities,
  fetchOpportunityJourneys, fetchPipelineStages, promoteLeadToOpportunity, updateLead, updateOpportunity,
} from "../../../core/api/crmFamApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import { ActivityFormModal } from "../components/ActivityModals";
import ContactFormModal from "../components/ContactFormModal";
import {
  AccountLinkModal, AccountPeekModal, ContactsModal, missingFields, OPPORTUNITY_FIELDS, OpportunityFieldsModal,
  OpportunityFormModal, opportunitySource, PurchasePickerModal,
} from "../components/OpportunityDialogs";
import { JourneyPanel, JourneyStrip } from "../components/OpportunityJourney";
import { ReasonDialog } from "../ui/dialogs";
import {
  Badge, Btn, cx, DataTable, DefList, EmptyState, ErrorNote, FilterChip, IconBtn, Inspector, Menu, PageHeader, Panel,
  SearchInput, SelectInput, Skeleton, SkeletonRows, sortRows, StatusBadge, Tabs,
} from "../ui/kit";
import { date, daysFromToday, errorMessage, money, number, relativeDay } from "../ui/format";
import { isManager } from "../ui/roles";
import { accountClassification, activityType, blueSheetStatus, health as healthOf, leadStatus, opportunityStatus } from "../ui/status";
import { listOf, useLoad } from "../ui/useLoad";
import { useUrlSearch, useUrlState } from "../ui/useUrlState";

const BASE = "/dashboard/crm-fam";
const STALE_DAYS = 14;
const LEAD_COLUMN_LIMIT = 20;
const VIEWS = [
  { value: "board", label: "Tablero" },
  { value: "table", label: "Tabla" },
  { value: "forecast", label: "Pronóstico" },
];

// Oportunidad estancada: abierta y sin cambios en STALE_DAYS días o más (updated_at viene en la lista).
const daysIdle = (o) => (o.updated_at ? Math.floor((Date.now() - new Date(o.updated_at).getTime()) / 86400000) : 0);
const isStale = (o) => o.status === "open" && daysIdle(o) >= STALE_DAYS;
const leadName = (l) => (l.full_name || "").trim() || [l.first_name, l.last_name].filter(Boolean).join(" ") || l.company_name || `Lead ${l.lead_code || ""}`;
const probabilityOf = (o, stage) => Number(o.probability_override ?? stage?.probability_default ?? o.probability_default ?? 0);

// ─── Tablero ─────────────────────────────────────────────────────────────────
function Column({ title, count, total, tone, dropActive, onDragOver, onDragLeave, onDrop, footer, children }) {
  return (
    <section
      aria-label={title}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cx(
        "flex w-[288px] shrink-0 flex-col rounded-xl border transition-colors duration-100",
        dropActive ? "border-fam-action bg-fam-selected" : tone === "lead" ? "border-fam-border bg-fam-subtle" : "border-fam-border bg-fam-canvas",
      )}
    >
      <header className="border-b border-fam-border px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-fam-text">{title}</h3>
          <span className="fam-numeric shrink-0 text-[13px] text-fam-muted">{number(count)}</span>
        </div>
        {total !== undefined && <p className="fam-numeric text-[13px] text-fam-muted">{money(total)}</p>}
      </header>
      <div className="flex min-h-[96px] flex-1 flex-col gap-2 overflow-y-auto p-2 lg:max-h-[calc(100dvh-20rem)]">
        {count === 0 ? <p className="px-2 py-6 text-center text-[13px] text-fam-muted">Sin registros</p> : children}
        {footer}
      </div>
    </section>
  );
}

function OpportunityCard({ opp, journey, selected, stages, onOpen, onMove, onAction }) {
  const missing = missingFields(opp).length;
  const h = healthOf(opp.health_status);
  const tier = opp.account_classification ? accountClassification(opp.account_classification) : null;
  const act = (type) => () => onAction(type, opp);
  return (
    <article
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", opp.id); e.dataTransfer.effectAllowed = "move"; }}
      className={cx("rounded-lg border bg-fam-surface p-3", selected ? "border-fam-action ring-1 ring-fam-action" : "border-fam-border")}
    >
      <button type="button" onClick={() => onOpen(opp)} className="block w-full text-left">
        <span className="line-clamp-2 text-sm font-medium text-fam-text">{opp.name}</span>
        <span className="mt-1 flex items-center gap-1.5 text-[13px] text-fam-muted">
          <FiBriefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{opp.account_name || "Sin cuenta"}</span>
          {tier && <Badge tone={tier.tone} className="shrink-0">{tier.label}</Badge>}
        </span>
      </button>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          {opp.health_status && opp.health_status !== "gray" && <Badge tone={h.tone}>{h.label}</Badge>}
          {isStale(opp) && <Badge tone="warning"><FiClock className="mr-1 h-3 w-3" aria-hidden="true" />{daysIdle(opp)} d sin movimiento</Badge>}
          {missing > 0 && <Badge tone="warning">Faltan {missing} dato{missing === 1 ? "" : "s"}</Badge>}
        </div>
        <span className="fam-numeric shrink-0 text-sm font-semibold text-fam-text">{opp.estimated_amount != null ? money(opp.estimated_amount) : "—"}</span>
      </div>
      <JourneyStrip journey={journey} />
      {/* Accesos directos de la tarjeta. "Mover" es la alternativa accesible al arrastre. */}
      <div className="mt-2 flex items-center justify-between gap-1 border-t border-fam-border pt-2">
        <div className="flex">
          <IconBtn icon={FiBriefcase} label={opp.account_id ? "Ver cuenta" : "Vincular cuenta"} className={cx("h-8 w-8", !opp.account_id && "text-fam-action")} onClick={act(opp.account_id ? "account-peek" : "account-link")} />
          <IconBtn icon={FiMessageCircle} label="Escribir o llamar a un contacto de la cuenta" className="h-8 w-8" disabled={!opp.account_id} onClick={act("contacts")} />
          <IconBtn icon={FiUserPlus} label="Agregar contacto" className="h-8 w-8" onClick={act("contact-new")} />
          <IconBtn icon={FiShoppingCart} label="Requerimiento de compra" className="h-8 w-8" onClick={act("purchase")} />
          <Link to={`${BASE}/opportunities/${opp.id}/blue-sheet`} aria-label="Abrir Blue Sheet" title="Abrir Blue Sheet" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fam-muted transition-colors duration-100 hover:bg-fam-subtle hover:text-fam-text">
            <FiFileText className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <Menu
          label="Mover"
          variant="ghost"
          size="sm"
          items={stages.map((s) => ({ label: s.name, disabled: s.id === opp.stage_id, onSelect: () => onMove(opp, s) }))}
        />
      </div>
    </article>
  );
}

function LeadCard({ lead, selected, onOpen }) {
  return (
    <article className={cx("rounded-lg border bg-fam-surface p-3", selected ? "border-fam-action ring-1 ring-fam-action" : "border-fam-border")}>
      <button type="button" onClick={() => onOpen(lead)} className="block w-full text-left">
        <span className="line-clamp-2 text-sm font-medium text-fam-text">{leadName(lead)}</span>
        <span className="mt-0.5 block truncate text-[13px] text-fam-muted">{[lead.company_name, lead.city].filter(Boolean).join(" · ") || "Sin empresa"}</span>
      </button>
      <div className="mt-2 flex flex-wrap gap-1">
        {lead.status === "contacted" && <StatusBadge of={leadStatus} value={lead.status} />}
        {lead.converted_account_id && <Badge tone="info">{lead.converted_account_name || "Cuenta vinculada"}</Badge>}
        {lead.status === "new" && daysFromToday(lead.created_at) <= -3 && <Badge tone="warning">{relativeDay(lead.created_at)}</Badge>}
      </div>
    </article>
  );
}

function Board({ stages, opps, journeys, leads, loading, selected, onOpenOpp, onOpenLead, onMove, onAction }) {
  const card = (o) => (
    <OpportunityCard key={o.id} opp={o} journey={journeys[o.id]} stages={stages} selected={selected === `opp:${o.id}`} onOpen={onOpenOpp} onMove={onMove} onAction={onAction} />
  );
  const [over, setOver] = useState(null);
  const byStage = useMemo(() => {
    const map = new Map(stages.map((s) => [s.id, []]));
    opps.forEach((o) => { if (map.has(o.stage_id)) map.get(o.stage_id).push(o); });
    return map;
  }, [stages, opps]);
  const unstaged = useMemo(() => opps.filter((o) => !stages.some((s) => s.id === o.stage_id)), [opps, stages]);
  const promoted = useMemo(() => new Set(opps.map((o) => o.lead_id).filter(Boolean)), [opps]);
  const leadsNew = leads.filter((l) => ["new", "contacted"].includes(l.status));
  const leadsQualified = leads.filter((l) => l.status === "qualified" && !promoted.has(l.id));

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2" role="status" aria-label="Cargando tablero">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[288px] shrink-0 space-y-2 rounded-xl border border-fam-border bg-fam-canvas p-2">
            <Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const leadFooter = (list, status) => list.length > LEAD_COLUMN_LIMIT && (
    <Link to={`${BASE}/leads?status=${status}`} className="px-2 py-1 text-center text-[13px] text-fam-action underline underline-offset-2">
      Ver los {number(list.length)} en Leads
    </Link>
  );

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      <Column title="Leads" count={leadsNew.length} tone="lead" footer={leadFooter(leadsNew, "new")}>
        {leadsNew.slice(0, LEAD_COLUMN_LIMIT).map((l) => <LeadCard key={l.id} lead={l} selected={selected === `lead:${l.id}`} onOpen={onOpenLead} />)}
      </Column>
      <Column title="Leads calificados" count={leadsQualified.length} tone="lead" footer={leadFooter(leadsQualified, "qualified")}>
        {leadsQualified.slice(0, LEAD_COLUMN_LIMIT).map((l) => <LeadCard key={l.id} lead={l} selected={selected === `lead:${l.id}`} onOpen={onOpenLead} />)}
      </Column>
      {stages.map((stage) => {
        const cards = byStage.get(stage.id) || [];
        return (
          <Column
            key={stage.id}
            title={stage.name}
            count={cards.length}
            total={cards.reduce((sum, o) => sum + (Number(o.estimated_amount) || 0), 0)}
            dropActive={over === stage.id}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== stage.id) setOver(stage.id); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const opp = opps.find((o) => o.id === e.dataTransfer.getData("text/plain"));
              if (opp && opp.stage_id !== stage.id) onMove(opp, stage);
            }}
          >
            {cards.map(card)}
          </Column>
        );
      })}
      {unstaged.length > 0 && (
        <Column title="Sin fase" count={unstaged.length} total={unstaged.reduce((sum, o) => sum + (Number(o.estimated_amount) || 0), 0)}>
          {unstaged.map(card)}
        </Column>
      )}
    </div>
  );
}

// ─── Pronóstico ──────────────────────────────────────────────────────────────
function Forecast({ stages, opps }) {
  const rows = stages.map((s) => {
    const list = opps.filter((o) => o.stage_id === s.id);
    const total = list.reduce((sum, o) => sum + (Number(o.estimated_amount) || 0), 0);
    const weighted = list.reduce((sum, o) => sum + (Number(o.estimated_amount) || 0) * probabilityOf(o, s) / 100, 0);
    return { id: s.id, name: s.name, probability: Number(s.probability_default || 0), count: list.length, total, weighted };
  });
  const sum = (key) => rows.reduce((acc, r) => acc + r[key], 0);
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <Panel title="Pronóstico ponderado" hint="Monto de cada oportunidad abierta × su probabilidad (la propia o, si no tiene, la de su fase)" flush>
      <DataTable
        caption="Pronóstico por fase"
        rowKey="id"
        columns={[
          { key: "name", header: "Fase", render: (r) => (
            <div>
              <span className="font-medium">{r.name}</span>
              <div className="mt-1 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-fam-subtle" aria-hidden="true">
                <div className="h-full rounded-full bg-fam-action" style={{ width: `${(r.total / max) * 100}%` }} />
              </div>
            </div>
          ) },
          { key: "probability", header: "Prob. de la fase", align: "right", hideBelow: "sm", render: (r) => `${r.probability}%` },
          { key: "count", header: "Oportunidades", align: "right", render: (r) => number(r.count) },
          { key: "total", header: "Monto", align: "right", hideBelow: "sm", render: (r) => money(r.total) },
          { key: "weighted", header: "Ponderado", align: "right", render: (r) => <span className="font-semibold">{money(r.weighted)}</span> },
        ]}
        rows={rows}
      />
      <div className="flex flex-wrap justify-end gap-x-10 gap-y-2 border-t border-fam-border px-4 py-3">
        <p className="text-[13px] text-fam-muted">Oportunidades <span className="fam-numeric ml-1 text-sm font-semibold text-fam-text">{number(sum("count"))}</span></p>
        <p className="text-[13px] text-fam-muted">Pipeline <span className="fam-numeric ml-1 text-sm font-semibold text-fam-text">{money(sum("total"))}</span></p>
        <p className="text-[13px] text-fam-muted">Pronóstico <span className="fam-numeric ml-1 text-sm font-semibold text-fam-text">{money(sum("weighted"))}</span></p>
      </div>
    </Panel>
  );
}

// ─── Detalle de oportunidad en el inspector ──────────────────────────────────
function OpportunityPeek({ opp, stage, purchaseKey, activityKey, onComplete, onAddActivity, onNewPurchase }) {
  const [activities, setActivities] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setActivities(null);
    fetchActivities({ opportunity_id: opp.id, limit: 10 })
      .then((res) => { if (!cancelled) setActivities(listOf(res)); })
      .catch(() => { if (!cancelled) setActivities([]); });
    return () => { cancelled = true; };
  }, [opp.id, activityKey]);

  const missing = missingFields(opp);
  const pending = (activities || []).filter((a) => a.status === "scheduled");
  const h = healthOf(opp.health_status);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <StatusBadge of={opportunityStatus} value={opp.status} />
        <Badge tone={h.tone}>{h.label}</Badge>
        {opp.blue_sheet_status && <Badge tone={blueSheetStatus(opp.blue_sheet_status).tone}>Blue Sheet: {blueSheetStatus(opp.blue_sheet_status).label.toLowerCase()}</Badge>}
        {isStale(opp) && <Badge tone="warning">{daysIdle(opp)} días sin movimiento</Badge>}
      </div>

      {missing.length > 0 && (
        <div className="rounded-lg bg-fam-warning-bg px-3 py-2.5">
          <p className="text-[13px] text-fam-warning">Faltan datos de negocio: {missing.map((f) => f.label.toLowerCase()).join(", ")}.</p>
          <Btn size="sm" className="mt-2" onClick={onComplete}>Completar información</Btn>
        </div>
      )}

      <DefList
        columns={2}
        items={[
          { label: "Cuenta", value: opp.account_id ? <Link to={`${BASE}/accounts/${opp.account_id}`} className="text-fam-action underline underline-offset-2">{opp.account_name || "Abrir cuenta"}</Link> : null },
          { label: "Fase", value: stage?.name || opp.stage_name },
          { label: "Monto estimado", value: opp.estimated_amount != null ? money(opp.estimated_amount) : null, numeric: true },
          { label: "Probabilidad", value: `${probabilityOf(opp, stage)}%${opp.probability_override == null ? " (de la fase)" : ""}`, numeric: true },
          { label: "Cierre estimado", value: opp.estimated_close_date ? `${date(opp.estimated_close_date)} (${relativeDay(opp.estimated_close_date)})` : null },
          { label: "Fuente", value: opp.source ? opportunitySource(opp.source) : null },
          { label: "Responsable", value: opp.owner_name },
          { label: "Código", value: opp.opportunity_code ? <span className="fam-id">{opp.opportunity_code}</span> : null },
        ]}
      />

      <div className="border-t border-fam-border pt-4">
        <h3 className="mb-3 text-[13px] font-semibold text-fam-text">Recorrido</h3>
        <JourneyPanel opportunityId={opp.id} reloadKey={purchaseKey} onNewPurchase={onNewPurchase} />
      </div>

      <div className="border-t border-fam-border pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-fam-text">Actividades pendientes {activities && <span className="fam-numeric font-normal text-fam-muted">{pending.length}</span>}</h3>
          <Btn variant="link" onClick={onAddActivity}>Agregar</Btn>
        </div>
        {activities === null ? <Skeleton className="h-5 w-48" /> : pending.length === 0 ? (
          <p className="text-sm text-fam-muted">Ninguna programada.</p>
        ) : (
          <ul className="space-y-1.5">
            {pending.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-fam-text">{activityType(a.activity_type)} · {a.subject}</span>
                <span className={cx("fam-numeric shrink-0 text-[13px]", a.scheduled_at && daysFromToday(a.scheduled_at) < 0 ? "text-fam-danger" : "text-fam-muted")}>{a.scheduled_at ? relativeDay(a.scheduled_at) : "sin fecha"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LeadPeekFunnel({ lead }) {
  const contacts = Number(lead.linked_contact_count) || 0;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2"><StatusBadge of={leadStatus} value={lead.status} /></div>
      <DefList
        columns={2}
        items={[
          { label: "Empresa", value: lead.company_name },
          { label: "Ciudad", value: lead.city },
          { label: "Correo", value: lead.email ? <a href={`mailto:${lead.email}`} className="break-all text-fam-action underline underline-offset-2">{lead.email}</a> : null },
          { label: "Teléfono", value: lead.phone },
          { label: "Cuenta", value: lead.converted_account_id ? <Link to={`${BASE}/accounts/${lead.converted_account_id}`} className="text-fam-action underline underline-offset-2">{lead.converted_account_name || "Abrir cuenta"}</Link> : "Sin vincular" },
          { label: "Contactos", value: number(contacts), numeric: true },
          { label: "Recibido", value: `${date(lead.created_at)} (${relativeDay(lead.created_at)})` },
          { label: "Asesor", value: lead.owner_name },
        ]}
      />
      {lead.interest_description && (
        <div className="border-t border-fam-border pt-4">
          <h3 className="mb-1 text-[13px] font-semibold text-fam-text">Interés o necesidad</h3>
          <p className="whitespace-pre-wrap text-sm text-fam-text">{lead.interest_description}</p>
        </div>
      )}
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function OpportunitiesPage() {
  const { user } = useAuth();
  const { showToast } = useUI();
  const manager = isManager(user);
  const [url, setUrl] = useUrlState({ view: "board", q: "", owner: "", stale: "", status: "open", sel: "", new: "" });
  const view = VIEWS.some((v) => v.value === url.view) ? url.view : "board";
  const [search, setSearch] = useUrlSearch(url.q, (q) => setUrl({ q }));
  const [stages, setStages] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [sort, setSort] = useState({ key: "estimated_close_date", dir: "asc" });
  const [dialog, setDialog] = useState(null); // { type, opp?, lead? }
  const [purchaseKey, setPurchaseKey] = useState(0);
  const [activityKey, setActivityKey] = useState(0);
  const [moved, setMoved] = useState({}); // movimientos optimistas: { oppId: stageId }
  const [busy, setBusy] = useState(false);

  const loadAccounts = useCallback(() => {
    fetchAccounts({ limit: 500 }).then((res) => setAccounts(listOf(res))).catch(() => {});
  }, []);
  useEffect(() => {
    loadAccounts();
    fetchPipelineStages()
      .then((s) => setStages((Array.isArray(s) ? s : []).filter((x) => x.is_active !== false).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))))
      .catch(() => setStages([]));
  }, [loadAccounts]);

  // El tablero y el pronóstico trabajan sobre lo abierto; la tabla puede revisar cualquier estado.
  const status = view === "table" ? url.status : "open";
  const oppsLoad = useLoad(() => fetchOpportunities({ ...(status ? { status } : {}), limit: 500 }), [status], { fallback: "No se pudo cargar el embudo." });
  const leadsLoad = useLoad(() => fetchLeads({ limit: 200 }), [], { fallback: "No se pudieron cargar los leads." });
  const reloadOpps = oppsLoad.reload;
  const reloadLeads = leadsLoad.reload;

  const allOpps = useMemo(
    () => listOf(oppsLoad.data).map((o) => (moved[o.id] ? { ...o, stage_id: moved[o.id] } : o)),
    [oppsLoad.data, moved],
  );
  const leads = useMemo(() => listOf(leadsLoad.data).filter((l) => !["converted", "unqualified", "disqualified"].includes(l.status)), [leadsLoad.data]);
  const owners = useMemo(() => [...new Map(allOpps.filter((o) => o.owner_user_id).map((o) => [String(o.owner_user_id), o.owner_name || `Usuario ${o.owner_user_id}`])).entries()].sort((a, b) => a[1].localeCompare(b[1], "es")), [allOpps]);

  const term = url.q.trim().toLowerCase();
  const matches = (text) => String(text || "").toLowerCase().includes(term);
  const opps = useMemo(() => allOpps.filter((o) => (
    (!term || matches(o.name) || matches(o.account_name) || matches(o.opportunity_code))
    && (!url.owner || String(o.owner_user_id) === url.owner)
    && (!url.stale || isStale(o))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  )), [allOpps, term, url.owner, url.stale]);
  const shownLeads = useMemo(() => leads.filter((l) => (
    (!term || matches(leadName(l)) || matches(l.company_name))
    && (!url.owner || String(l.owner_user_id) === url.owner)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  )), [leads, term, url.owner]);

  // Recorrido de todas las oportunidades cargadas, en una consulta (no una por tarjeta).
  const oppIds = useMemo(() => allOpps.map((o) => o.id).sort().join(","), [allOpps]);
  const [journeys, setJourneys] = useState({});
  useEffect(() => {
    if (!oppIds) { setJourneys({}); return undefined; }
    let cancelled = false;
    fetchOpportunityJourneys(oppIds.split(",")).then((map) => { if (!cancelled) setJourneys(map || {}); }).catch(() => {});
    return () => { cancelled = true; };
  }, [oppIds, purchaseKey]);

  const staleCount = allOpps.filter(isStale).length;
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const [selKind, selId] = url.sel.split(":");
  const selOpp = selKind === "opp" ? allOpps.find((o) => o.id === selId) : null;
  const selLead = selKind === "lead" ? leads.find((l) => l.id === selId) : null;
  const select = (key) => setUrl({ sel: url.sel === key ? "" : key }, { replace: false });
  const hasFilters = Boolean(url.q || url.owner || url.stale);
  const clearFilters = () => { setSearch(""); setUrl({ q: "", owner: "", stale: "" }); };

  // Mover de fase con actualización optimista; si el servidor falla, la tarjeta vuelve a su fase.
  const move = async (opp, stage) => {
    setMoved((m) => ({ ...m, [opp.id]: stage.id }));
    try {
      const res = await changeOpportunityStage(opp.id, { stage_id: stage.id });
      showToast(res?.warning ? `Movida a ${stage.name}. ${res.warning}.` : `Movida a ${stage.name}`, res?.warning ? "warning" : "success");
      await reloadOpps();
    } catch (err) {
      showToast(errorMessage(err, "No se pudo mover la oportunidad."), "error");
    } finally {
      setMoved((m) => { const next = { ...m }; delete next[opp.id]; return next; });
    }
  };

  const qualify = async (lead) => {
    setBusy(true);
    try { await updateLead(lead.id, { status: "qualified" }); await reloadLeads(); showToast("Lead calificado", "success"); }
    catch (err) { showToast(errorMessage(err, "No se pudo calificar."), "error"); }
    finally { setBusy(false); }
  };

  const close = () => setDialog(null);
  const tableRows = useMemo(() => sortRows(opps, sort, {
    estimated_amount: (r) => Number(r.estimated_amount || 0),
    probability: (r) => probabilityOf(r, stageById.get(r.stage_id)),
    idle: (r) => daysIdle(r),
  }), [opps, sort, stageById]);

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        title="Embudo de ventas"
        count={oppsLoad.loading && !oppsLoad.data ? null : `${number(opps.length)} oportunidad${opps.length === 1 ? "" : "es"} · ${money(opps.reduce((s, o) => s + (Number(o.estimated_amount) || 0), 0))}`}
        actions={<Btn variant="primary" icon={FiPlus} onClick={() => setUrl({ new: "1" })}>Nueva oportunidad</Btn>}
      >
        <Tabs label="Vistas del embudo" tabs={VIEWS} value={view} onChange={(v) => setUrl({ view: v, sel: "" })} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar oportunidad, cuenta o código…" label="Buscar en el embudo" className="w-full sm:w-80" />
        {manager && owners.length > 1 && (
          <div className="w-full sm:w-60">
            <SelectInput aria-label="Filtrar por responsable" value={url.owner} onChange={(e) => setUrl({ owner: e.target.value })}>
              <option value="">Todo el equipo</option>
              {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </SelectInput>
          </div>
        )}
        {view === "table" && (
          <div className="w-full sm:w-44">
            <SelectInput aria-label="Estado" value={url.status} onChange={(e) => setUrl({ status: e.target.value })}>
              <option value="open">Abiertas</option>
              <option value="won">Ganadas</option>
              <option value="lost">Perdidas</option>
              <option value="">Todos los estados</option>
            </SelectInput>
          </div>
        )}
        {staleCount > 0 && !url.stale && (
          <Btn icon={FiAlertTriangle} onClick={() => setUrl({ stale: "1" })}>{staleCount} estancada{staleCount === 1 ? "" : "s"}</Btn>
        )}
        {url.stale && <FilterChip label={`Sin movimiento ${STALE_DAYS}+ días`} onRemove={() => setUrl({ stale: "" })} />}
        {hasFilters && <Btn variant="link" onClick={clearFilters}>Limpiar</Btn>}
      </div>

      <ErrorNote message={oppsLoad.error} onRetry={reloadOpps} className="mb-4" />
      {view === "board" && <ErrorNote message={leadsLoad.error} onRetry={reloadLeads} className="mb-4" />}

      <div className={selOpp || selLead ? "grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_400px]" : ""}>
        <div className="min-w-0">
          {view === "board" && (
            <Board
              stages={stages}
              opps={opps}
              journeys={journeys}
              leads={shownLeads}
              loading={(oppsLoad.loading && !oppsLoad.data) || stages.length === 0}
              selected={url.sel}
              onOpenOpp={(o) => select(`opp:${o.id}`)}
              onOpenLead={(l) => select(`lead:${l.id}`)}
              onMove={move}
              onAction={(type, opp) => setDialog({ type, opp })}
            />
          )}

          {view === "table" && (
            <Panel flush>
              {oppsLoad.loading && !oppsLoad.data ? <SkeletonRows rows={8} /> : tableRows.length === 0 ? (
                <EmptyState title={hasFilters ? "Ninguna oportunidad coincide" : "Sin oportunidades en este estado"} hint={hasFilters ? "Quita filtros o cambia la búsqueda." : undefined} action={hasFilters ? <Btn onClick={clearFilters}>Limpiar filtros</Btn> : undefined} />
              ) : (
                <DataTable
                  caption="Oportunidades"
                  sort={sort}
                  onSort={(key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))}
                  selectedId={selOpp?.id}
                  onRowClick={(o) => select(`opp:${o.id}`)}
                  columns={[
                    { key: "name", header: "Oportunidad", sortable: true, render: (o) => (
                      <div className="min-w-0">
                        <button type="button" onClick={(e) => { e.stopPropagation(); select(`opp:${o.id}`); }} className="max-w-full truncate text-left font-medium text-fam-text hover:text-fam-action">{o.name}</button>
                        <div className="truncate text-[13px] text-fam-muted">{o.account_name || "Sin cuenta"}</div>
                      </div>
                    ) },
                    { key: "stage_name", header: "Fase", sortable: true, hideBelow: "md", render: (o) => stageById.get(o.stage_id)?.name || o.stage_name || "—" },
                    ...(url.status !== "open" ? [{ key: "status", header: "Estado", render: (o) => <StatusBadge of={opportunityStatus} value={o.status} /> }] : []),
                    { key: "health_status", header: "Salud", hideBelow: "lg", render: (o) => <StatusBadge of={healthOf} value={o.health_status || "gray"} /> },
                    { key: "owner_name", header: "Responsable", sortable: true, hideBelow: "xl", render: (o) => <span className="block max-w-[160px] truncate">{o.owner_name || "—"}</span> },
                    { key: "idle", header: "Sin movimiento", align: "right", sortable: true, hideBelow: "lg", render: (o) => (o.status === "open" ? <span className={isStale(o) ? "text-fam-warning" : undefined}>{daysIdle(o)} d</span> : "—") },
                    { key: "estimated_close_date", header: "Cierre", sortable: true, hideBelow: "sm", render: (o) => <span className="fam-numeric">{date(o.estimated_close_date)}</span> },
                    { key: "probability", header: "Prob.", align: "right", sortable: true, hideBelow: "lg", render: (o) => `${probabilityOf(o, stageById.get(o.stage_id))}%` },
                    { key: "estimated_amount", header: "Monto", align: "right", sortable: true, render: (o) => money(o.estimated_amount) },
                  ].filter((c) => !(selOpp && ["owner_name", "idle", "probability", "health_status"].includes(c.key)))}
                  rows={tableRows}
                />
              )}
            </Panel>
          )}

          {view === "forecast" && (oppsLoad.loading && !oppsLoad.data ? <SkeletonRows rows={6} /> : <Forecast stages={stages} opps={opps} />)}
        </div>

        <Inspector
          open={Boolean(selOpp)}
          title={selOpp?.name}
          onClose={() => setUrl({ sel: "" })}
          footer={selOpp && (
            <>
              <Menu
                label="Más"
                items={[
                  selOpp.account_id
                    ? { label: "Ver cuenta", icon: FiBriefcase, onSelect: () => setDialog({ type: "account-peek", opp: selOpp }) }
                    : { label: "Vincular cuenta", icon: FiBriefcase, onSelect: () => setDialog({ type: "account-link", opp: selOpp }) },
                  { label: "Contactos de la cuenta", icon: FiUsers, disabled: !selOpp.account_id, onSelect: () => setDialog({ type: "contacts", opp: selOpp }) },
                  { label: "Agregar contacto", icon: FiUserPlus, onSelect: () => setDialog({ type: "contact-new", opp: selOpp }) },
                  { label: "Requerimiento de compra", icon: FiShoppingCart, onSelect: () => setDialog({ type: "purchase", opp: selOpp }) },
                ]}
              />
              <Btn icon={FiFileText} to={`${BASE}/opportunities/${selOpp.id}/blue-sheet`}>Blue Sheet</Btn>
              <Btn variant="primary" icon={FiExternalLink} to={`${BASE}/opportunities/${selOpp.id}`}>Abrir</Btn>
            </>
          )}
        >
          {selOpp && (
            <>
              <OpportunityPeek
                opp={selOpp}
                stage={stageById.get(selOpp.stage_id)}
                purchaseKey={purchaseKey}
                activityKey={activityKey}
                onComplete={() => setDialog({ type: "complete", opp: selOpp })}
                onAddActivity={() => setDialog({ type: "activity", opp: selOpp })}
                onNewPurchase={() => setDialog({ type: "purchase", opp: selOpp })}
              />
              {stageById.get(selOpp.stage_id)?.order_index === 1 && (
                <p className="mt-5 border-t border-fam-border pt-4 text-sm">
                  <Link to="/dashboard/comercial/new-client-request" className="text-fam-action underline underline-offset-2">Solicitar creación de cliente</Link>
                </p>
              )}
            </>
          )}
        </Inspector>

        <Inspector
          open={Boolean(selLead)}
          title={selLead ? leadName(selLead) : ""}
          onClose={() => setUrl({ sel: "" })}
          footer={selLead && (
            <>
              <Menu
                label="Más"
                items={[
                  !selLead.converted_account_id && { label: "Vincular cuenta", icon: FiBriefcase, onSelect: () => setDialog({ type: "account-link", lead: selLead }) },
                  { label: "Ver contactos", icon: FiUsers, disabled: !(Number(selLead.linked_contact_count) > 0), onSelect: () => setDialog({ type: "contacts", lead: selLead }) },
                  { label: "Nuevo contacto", icon: FiUserPlus, onSelect: () => setDialog({ type: "contact-new", lead: selLead }) },
                  selLead.status !== "qualified" && { label: "Descalificar", danger: true, onSelect: () => setDialog({ type: "disqualify", lead: selLead }) },
                ]}
              />
              {selLead.status === "qualified"
                ? <Btn variant="primary" onClick={() => setDialog({ type: "promote", lead: selLead })}>Iniciar análisis</Btn>
                : <Btn variant="primary" loading={busy} onClick={() => qualify(selLead)}>Calificar</Btn>}
            </>
          )}
        >
          {selLead && <LeadPeekFunnel lead={selLead} />}
        </Inspector>
      </div>

      {url.new === "1" && (
        <OpportunityFormModal
          accounts={accounts}
          stages={stages}
          onClose={() => setUrl({ new: "" })}
          onSaved={(saved) => { setUrl({ new: "", sel: saved?.id ? `opp:${saved.id}` : "" }); reloadOpps(); showToast("Oportunidad creada", "success"); }}
        />
      )}

      {dialog?.type === "complete" && (
        <OpportunityFieldsModal
          title="Completar información"
          description={`Datos de negocio de “${dialog.opp.name}”. Campos: ${OPPORTUNITY_FIELDS.map((f) => f.label.toLowerCase()).join(", ")}.`}
          initial={dialog.opp}
          accounts={accounts}
          submitLabel="Guardar"
          onClose={close}
          onSubmit={async (fields) => { await updateOpportunity(dialog.opp.id, fields); close(); reloadOpps(); showToast("Información guardada", "success"); }}
        />
      )}
      {dialog?.type === "promote" && (
        <OpportunityFieldsModal
          title="Iniciar análisis de oportunidad"
          description={`Completa lo que ya sepas de ${leadName(dialog.lead)}. Puedes omitirlo y completarlo después desde la tarjeta.`}
          initial={{ account_id: dialog.lead.converted_account_id }}
          accounts={accounts}
          submitLabel="Iniciar análisis"
          skipLabel="Omitir por ahora"
          onClose={close}
          onSubmit={async (fields) => {
            const created = await promoteLeadToOpportunity(dialog.lead.id, fields);
            close();
            const newId = created?.opportunity?.id || created?.id;
            setUrl({ sel: newId ? `opp:${newId}` : "" });
            reloadLeads(); reloadOpps();
            showToast("Lead promovido a oportunidad", "success");
          }}
        />
      )}
      {dialog?.type === "account-link" && (
        <AccountLinkModal
          lead={dialog.lead}
          opportunity={dialog.opp}
          accounts={accounts}
          onClose={close}
          onLinked={() => { close(); loadAccounts(); if (dialog.lead) reloadLeads(); else reloadOpps(); showToast("Cuenta vinculada", "success"); }}
        />
      )}
      {dialog?.type === "account-peek" && <AccountPeekModal accountId={dialog.opp.account_id} onClose={close} />}
      {dialog?.type === "contacts" && (
        <ContactsModal
          title={`Contactos · ${dialog.opp ? (dialog.opp.account_name || dialog.opp.name) : (dialog.lead.converted_account_name || dialog.lead.company_name || leadName(dialog.lead))}`}
          accountId={dialog.opp ? dialog.opp.account_id : dialog.lead.converted_account_id}
          seed={dialog.lead && dialog.lead.converted_contact_id ? [{
            id: dialog.lead.converted_contact_id, full_name: dialog.lead.converted_contact_name,
            email: dialog.lead.converted_contact_email, phone: dialog.lead.converted_contact_phone,
          }] : []}
          onAddContact={() => setDialog({ type: "contact-new", opp: dialog.opp, lead: dialog.lead })}
          onClose={close}
        />
      )}
      {dialog?.type === "contact-new" && (
        <ContactFormModal
          leadId={dialog.lead?.id}
          initial={dialog.lead
            ? { first_name: dialog.lead.first_name, last_name: dialog.lead.last_name, email: dialog.lead.email, phone: dialog.lead.phone, account_id: dialog.lead.converted_account_id }
            : { account_id: dialog.opp?.account_id }}
          onClose={close}
          onSaved={() => { close(); if (dialog.lead) reloadLeads(); showToast("Contacto creado", "success"); }}
        />
      )}
      {dialog?.type === "purchase" && (
        <PurchasePickerModal opportunity={dialog.opp} onClose={close} onCreated={() => { close(); setPurchaseKey((k) => k + 1); showToast("Requerimiento de compra creado", "success"); }} />
      )}
      {dialog?.type === "activity" && (
        <ActivityFormModal
          defaults={{ opportunity_id: dialog.opp.id, account_id: dialog.opp.account_id, context: dialog.opp.name, activity_type: "llamada" }}
          onClose={close}
          onSaved={() => { close(); setActivityKey((k) => k + 1); showToast("Actividad registrada", "success"); }}
        />
      )}
      {dialog?.type === "disqualify" && (
        <ReasonDialog
          title={`Descalificar a ${leadName(dialog.lead)}`}
          description="El lead saldrá del embudo. Podrás verlo en Leads, en la vista Descalificados."
          label="Motivo"
          confirmLabel="Descalificar"
          danger
          onClose={close}
          onConfirm={async (reason) => {
            await disqualifyLead(dialog.lead.id, { reason: reason || "Manual" });
            close(); setUrl({ sel: "" }); reloadLeads(); showToast("Lead descalificado", "success");
          }}
        />
      )}
    </div>
  );
}
