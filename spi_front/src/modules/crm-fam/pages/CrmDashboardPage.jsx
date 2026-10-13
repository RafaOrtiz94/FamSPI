// "Mi día": inicio operativo del CRM (DESIGN.md §7). En vez de un tablero de cifras, una bandeja de
// lo que requiere acción hoy —actividades, leads, cierres y Blue Sheets— con acceso directo a cada
// registro, y el embudo como contexto subordinado.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCalendar, FiFileText, FiPlus, FiTarget, FiUser } from "react-icons/fi";
import {
  fetchActivities, fetchCrmDashboard, fetchCrmPipeline, fetchLeads, fetchOpportunities,
} from "../../../core/api/crmFamApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import { ActivityFormModal } from "../components/ActivityModals";
import { Badge, Btn, cx, EmptyState, ErrorNote, PageHeader, Panel, SkeletonRows, StatStrip, Tabs } from "../ui/kit";
import { daysFromToday, errorMessage, longDay, money, number, relativeDay, time } from "../ui/format";
import { activityType, blueSheetStatus, isOpenActivity } from "../ui/status";

const BASE = "/dashboard/crm-fam";
const MANAGER_ROLES = ["jefe_comercial", "gerencia", "gerencia_general", "gerente_general", "director", "gerente", "jefe_ti", "jefe_de_ti", "admin", "administrador"];
const CLOSING_WINDOW_DAYS = 14;
const ACTIVITY_LIMIT = 200;

const listOf = (res) => (Array.isArray(res) ? res : res?.data || []);

// Fila de la bandeja: enlace real al registro, con su vencimiento y contexto.
function WorkRow({ to, icon: Icon, title, meta, when, whenTone, right }) {
  return (
    <li>
      <Link to={to} className="group flex items-center gap-3 px-4 py-3 transition-colors duration-100 hover:bg-fam-subtle sm:px-5">
        <Icon className="h-4 w-4 shrink-0 text-fam-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fam-text">{title}</span>
          {meta && <span className="block truncate text-[13px] text-fam-muted">{meta}</span>}
        </span>
        {right && <span className="fam-numeric hidden shrink-0 text-sm text-fam-text sm:block">{right}</span>}
        {when && <Badge tone={whenTone}>{when}</Badge>}
        <FiArrowRight className="h-4 w-4 shrink-0 text-fam-muted opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
      </Link>
    </li>
  );
}

function WorkGroup({ title, count, tone, children, moreTo, moreLabel }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-fam-border bg-fam-canvas px-4 py-2 sm:px-5">
        <h3 className="text-[13px] font-semibold text-fam-text">
          {title} <span className={cx("fam-numeric ml-1 font-normal", tone === "danger" ? "text-fam-danger" : "text-fam-muted")}>{count}</span>
        </h3>
        {moreTo && <Link to={moreTo} className="text-[13px] text-fam-action underline underline-offset-2">{moreLabel}</Link>}
      </div>
      <ul className="divide-y divide-fam-border">{children}</ul>
    </div>
  );
}

export default function CrmDashboardPage() {
  const { user } = useAuth();
  const isManager = String(user?.role || "").split(",").map((r) => r.trim().toLowerCase()).some((r) => MANAGER_ROLES.includes(r));
  const { showToast } = useUI();
  const [scope, setScope] = useState("mine"); // un manager puede mirar al equipo completo
  const [addingActivity, setAddingActivity] = useState(false);
  const [state, setState] = useState({ loading: true, error: "", activities: [], leads: [], opps: [], summary: null, pipeline: [] });

  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!user?.id) return;
    // Cada carga lleva un número; si al responder ya hay otra más nueva (cambio de alcance), se descarta.
    const requestId = ++requestRef.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const owner = scope === "mine" ? { owner_user_id: user.id } : {};
    const [acts, leads, opps, summary, pipeline] = await Promise.allSettled([
      fetchActivities({ ...owner, limit: ACTIVITY_LIMIT }),
      fetchLeads({ status: "new", ...owner, limit: 25 }),
      fetchOpportunities({ status: "open", ...owner, limit: 200 }),
      fetchCrmDashboard(),
      fetchCrmPipeline(),
    ]);
    if (requestId !== requestRef.current) return;
    const failed = [acts, leads, opps].filter((r) => r.status === "rejected");
    setState({
      loading: false,
      // Si falla la bandeja completa se dice; no se muestra un cero que parezca "todo al día".
      error: failed.length === 3
        ? errorMessage(failed[0].reason, "No se pudo cargar tu bandeja.")
        : failed.length > 0 ? "Parte de tu bandeja no se pudo cargar; lo que ves puede estar incompleto." : "",
      activities: acts.status === "fulfilled" ? listOf(acts.value) : [],
      leads: leads.status === "fulfilled" ? listOf(leads.value) : [],
      opps: opps.status === "fulfilled" ? listOf(opps.value) : [],
      summary: summary.status === "fulfilled" ? summary.value : null,
      pipeline: pipeline.status === "fulfilled" ? listOf(pipeline.value) : [],
    });
  }, [user?.id, scope]);

  useEffect(() => { load(); }, [load]);

  const work = useMemo(() => {
    const open = state.activities.filter((a) => isOpenActivity(a) && a.scheduled_at);
    const overdue = open.filter((a) => daysFromToday(a.scheduled_at) < 0).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    const today = open.filter((a) => daysFromToday(a.scheduled_at) === 0).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    const followUp = state.activities.filter((a) => a.status === "visited_pending_followup" || a.followup_status === "incomplete_followup");
    const closing = state.opps
      .filter((o) => o.estimated_close_date && daysFromToday(o.estimated_close_date) <= CLOSING_WINDOW_DAYS)
      .sort((a, b) => new Date(a.estimated_close_date) - new Date(b.estimated_close_date));
    const blueSheets = state.opps.filter((o) => ["observed", "needs_update"].includes(o.blue_sheet_status));
    const toReview = isManager ? state.opps.filter((o) => o.blue_sheet_status === "ready_for_review") : [];
    return { overdue, today, followUp, closing, blueSheets, toReview };
  }, [state.activities, state.opps, isManager]);

  const totalPending = work.overdue.length + work.today.length + work.followUp.length + state.leads.length + work.closing.length + work.blueSheets.length + work.toReview.length;

  const openStats = (state.summary?.opportunities || []).find((r) => r.status === "open") || {};
  const maxStage = Math.max(1, ...state.pipeline.map((s) => Number(s.total_amount || 0)));

  const activityRow = (a, tone) => (
    <WorkRow
      key={a.id}
      to={`${BASE}/activities?view=${a.status === "scheduled" ? "pendientes" : "seguimiento"}&sel=${a.id}${scope === "team" ? "&scope=team" : ""}`}
      icon={FiCalendar}
      title={`${activityType(a.activity_type)} · ${a.subject}`}
      meta={[a.account_name, a.opportunity_name].filter(Boolean).join(" · ") || "Sin cuenta asociada"}
      when={daysFromToday(a.scheduled_at) === 0 ? time(a.scheduled_at) || "hoy" : relativeDay(a.scheduled_at)}
      whenTone={tone}
    />
  );

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        title="Mi día"
        context={longDay().replace(/^./, (c) => c.toUpperCase())}
        actions={(
          <>
            <Btn to={`${BASE}/leads`} icon={FiUser}>Leads</Btn>
            <Btn variant="primary" icon={FiPlus} onClick={() => setAddingActivity(true)}>Registrar actividad</Btn>
          </>
        )}
      >
        {isManager && (
          <Tabs
            label="Alcance"
            value={scope}
            onChange={setScope}
            tabs={[{ value: "mine", label: "Lo mío" }, { value: "team", label: "Todo el equipo" }]}
          />
        )}
      </PageHeader>

      <StatStrip
        className="mb-6"
        items={[
          { label: "Requiere tu acción", value: state.loading ? "—" : `${number(totalPending)}${state.activities.length >= ACTIVITY_LIMIT ? "+" : ""}`, hint: "actividades, leads, cierres y Blue Sheets", tone: work.overdue.length ? "danger" : undefined },
          { label: "Pipeline abierto", value: state.summary ? money(openStats.total_amount) : "—", hint: `${number(openStats.count)} oportunidad(es) abierta(s)`, to: `${BASE}/opportunities` },
          { label: "Acciones del Blue Sheet", value: state.summary ? number(state.summary.my_open_actions) : "—", hint: "asignadas a ti, sin cerrar" },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Requiere tu acción" flush>
          <ErrorNote message={state.error} onRetry={load} className="m-4" />
          {state.loading ? (
            <SkeletonRows rows={7} />
          ) : totalPending === 0 && !state.error ? (
            <EmptyState
              title="Estás al día"
              hint="No tienes actividades vencidas ni para hoy, leads nuevos, cierres próximos ni Blue Sheets por atender."
              action={<Btn to={`${BASE}/opportunities`} icon={FiTarget}>Revisar el embudo</Btn>}
            />
          ) : (
            <>
              {work.overdue.length > 0 && (
                <WorkGroup title="Actividades vencidas" count={state.activities.length >= ACTIVITY_LIMIT ? `${work.overdue.length}+` : work.overdue.length} tone="danger" moreTo={`${BASE}/activities`} moreLabel="Ver todas">
                  {work.overdue.slice(0, 6).map((a) => activityRow(a, "danger"))}
                </WorkGroup>
              )}
              {work.today.length > 0 && (
                <WorkGroup title="Para hoy" count={work.today.length}>
                  {work.today.map((a) => activityRow(a, "info"))}
                </WorkGroup>
              )}
              {work.followUp.length > 0 && (
                <WorkGroup title="Visitas sin seguimiento" count={work.followUp.length} moreTo={`${BASE}/activities?view=seguimiento${scope === "team" ? "&scope=team" : ""}`} moreLabel="Completar">
                  {work.followUp.slice(0, 5).map((a) => activityRow(a, "warning"))}
                </WorkGroup>
              )}
              {state.leads.length > 0 && (
                <WorkGroup title="Leads nuevos sin atender" count={state.leads.length} moreTo={`${BASE}/leads?status=new`} moreLabel="Abrir leads">
                  {state.leads.slice(0, 6).map((l) => (
                    <WorkRow
                      key={l.id}
                      to={`${BASE}/leads?status=new&sel=${l.id}`}
                      icon={FiUser}
                      title={(l.full_name || "").trim() || l.company_name || "Lead sin nombre"}
                      meta={[l.company_name, l.city, l.source].filter(Boolean).join(" · ")}
                      right={l.estimated_value != null ? money(l.estimated_value) : null}
                      when={`recibido ${relativeDay(l.created_at)}`}
                      whenTone={daysFromToday(l.created_at) <= -3 ? "warning" : "neutral"}
                    />
                  ))}
                </WorkGroup>
              )}
              {work.closing.length > 0 && (
                <WorkGroup title={`Cierres vencidos o en ${CLOSING_WINDOW_DAYS} días`} count={work.closing.length} moreTo={`${BASE}/opportunities`} moreLabel="Ver embudo">
                  {work.closing.slice(0, 6).map((o) => {
                    const d = daysFromToday(o.estimated_close_date);
                    return (
                      <WorkRow
                        key={o.id}
                        to={`${BASE}/opportunities/${o.id}`}
                        icon={FiTarget}
                        title={o.name}
                        meta={[o.account_name, o.stage_name].filter(Boolean).join(" · ")}
                        right={money(o.estimated_amount)}
                        when={d < 0 ? `venció ${relativeDay(o.estimated_close_date)}` : `cierra ${relativeDay(o.estimated_close_date)}`}
                        whenTone={d < 0 ? "danger" : "warning"}
                      />
                    );
                  })}
                </WorkGroup>
              )}
              {work.toReview.length > 0 && (
                <WorkGroup title="Blue Sheets por revisar" count={work.toReview.length}>
                  {work.toReview.map((o) => (
                    <WorkRow key={o.id} to={`${BASE}/opportunities/${o.id}/blue-sheet`} icon={FiFileText} title={o.name} meta={[o.account_name, o.owner_name].filter(Boolean).join(" · ")} when="En revisión" whenTone="info" />
                  ))}
                </WorkGroup>
              )}
              {work.blueSheets.length > 0 && (
                <WorkGroup title="Blue Sheets por corregir" count={work.blueSheets.length}>
                  {work.blueSheets.map((o) => (
                    <WorkRow key={o.id} to={`${BASE}/opportunities/${o.id}/blue-sheet`} icon={FiFileText} title={o.name} meta={o.account_name} when={blueSheetStatus(o.blue_sheet_status).label} whenTone="warning" />
                  ))}
                </WorkGroup>
              )}
            </>
          )}
        </Panel>

        <Panel title="Embudo por fase" hint="Oportunidades abiertas" actions={<Btn variant="link" to={`${BASE}/opportunities`}>Abrir</Btn>}>
          {state.loading ? (
            <SkeletonRows rows={4} />
          ) : state.pipeline.length === 0 ? (
            <p className="text-sm text-fam-muted">No se pudo cargar el embudo.</p>
          ) : (
            <ol className="space-y-3">
              {state.pipeline.map((s) => (
                <li key={s.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-fam-text">{s.name}</span>
                    <span className="fam-numeric shrink-0 text-sm text-fam-text">{money(s.total_amount)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fam-subtle" aria-hidden="true">
                      <div className="h-full rounded-full bg-fam-action" style={{ width: `${(Number(s.total_amount || 0) / maxStage) * 100}%` }} />
                    </div>
                    <span className="fam-numeric w-16 shrink-0 text-right text-xs text-fam-muted">{number(s.opportunity_count)} opp.</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {addingActivity && (
        <ActivityFormModal
          onClose={() => setAddingActivity(false)}
          onSaved={() => { setAddingActivity(false); load(); showToast("Actividad registrada", "success"); }}
        />
      )}
    </div>
  );
}
