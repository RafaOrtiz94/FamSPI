// Expediente de la oportunidad: identidad y estado arriba, la línea de fases como firma de
// trazabilidad (DESIGN.md §3.3), indicadores del negocio y, debajo, datos, actividades, Blue Sheet,
// compra y acciones. Cada cierre explica su consecuencia antes de confirmarse.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiCheck, FiFileText, FiPlus } from "react-icons/fi";
import Modal from "../../../core/ui/components/Modal";
import {
  changeOpportunityStage, closeOpportunityLost, closeOpportunityWon, fetchAccounts, fetchActivities, fetchLostReasons,
  fetchOpportunityById, fetchPipelineStages, suspendOpportunity, updateOpportunity,
} from "../../../core/api/crmFamApi";
import { createProjectFromOpportunity, fetchWorkspaces } from "../../../core/api/workManagementApi";
import { useUI } from "../../../core/ui/UIContext";
import { ActivityFormModal } from "../components/ActivityModals";
import ContactFormModal from "../components/ContactFormModal";
import {
  AccountLinkModal, ContactsModal, missingFields, OpportunityFieldsModal, opportunitySource, PurchasePickerModal,
} from "../components/OpportunityDialogs";
import { JourneyPanel } from "../components/OpportunityJourney";
import { ReasonDialog } from "../ui/dialogs";
import {
  Badge, Btn, cx, DefList, ErrorNote, Field, Menu, PageHeader, Panel, SelectInput, Skeleton, StatStrip, StatusBadge, TextArea, TextInput,
} from "../ui/kit";
import { date, daysFromToday, errorMessage, money, relativeDay } from "../ui/format";
import { activityStatus, activityType, blueSheetStatus, health as healthOf, opportunityStatus } from "../ui/status";
import { listOf, useLoad } from "../ui/useLoad";

const BASE = "/dashboard/crm-fam";
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// ─── Línea de fases ──────────────────────────────────────────────────────────
// Fases reales del embudo: completadas, actual y pendientes. Si la oportunidad sigue abierta,
// cada fase es un botón para moverla (con su nombre visible; no depende del color).
function StageTrack({ stages, currentId, canMove, movingId, onMove }) {
  const currentIndex = stages.findIndex((s) => s.id === currentId);
  if (!stages.length) return null;
  return (
    <nav aria-label="Fases de la oportunidad" className="mb-6">
      {/* Móvil: resumen de la fase actual + selector */}
      <div className="sm:hidden">
        <p className="text-[13px] text-fam-muted">Fase {currentIndex >= 0 ? currentIndex + 1 : "—"} de {stages.length}</p>
        {canMove ? (
          <SelectInput aria-label="Cambiar fase" value={currentId || ""} disabled={Boolean(movingId)} onChange={(e) => { const s = stages.find((x) => x.id === e.target.value); if (s) onMove(s); }}>
            {currentIndex < 0 && <option value="">Sin fase</option>}
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
        ) : <p className="text-sm font-semibold text-fam-text">{stages[currentIndex]?.name || "Sin fase"}</p>}
      </div>
      <ol className="hidden sm:flex">
        {stages.map((s, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "pending";
          const node = (
            <span className="flex min-w-0 flex-col items-start gap-1.5">
              <span className="flex w-full items-center">
                <span className={cx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  state === "done" && "border-fam-control bg-fam-subtle text-fam-text",
                  state === "current" && "border-fam-action bg-fam-action text-fam-on-action",
                  state === "pending" && "border-fam-border bg-fam-surface text-fam-muted",
                )}>
                  {state === "done" ? <FiCheck className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                </span>
                {i < stages.length - 1 && <span className={cx("h-px flex-1", i < currentIndex ? "bg-fam-control" : "bg-fam-border")} aria-hidden="true" />}
              </span>
              <span className={cx("pr-3 text-left text-[13px] leading-tight", state === "current" ? "font-semibold text-fam-text" : "text-fam-muted")}>
                {s.name}
                <span className="sr-only">{state === "done" ? " (completada)" : state === "current" ? " (fase actual)" : " (pendiente)"}</span>
              </span>
            </span>
          );
          return (
            <li key={s.id} className="min-w-0 flex-1" aria-current={state === "current" ? "step" : undefined}>
              {canMove && state !== "current" ? (
                <button type="button" disabled={Boolean(movingId)} onClick={() => onMove(s)} title={`Mover a ${s.name}`} className="w-full rounded-md py-1 text-left transition-colors duration-100 hover:bg-fam-subtle disabled:opacity-60">
                  {node}
                </button>
              ) : <div className="py-1">{node}</div>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Diálogos de cierre ──────────────────────────────────────────────────────
function WonModal({ opp, onClose, onDone }) {
  const [form, setForm] = useState({ won_amount: opp.estimated_amount ?? "", actual_close_date: todayISO(), notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (form.won_amount === "" || Number(form.won_amount) < 0) { setError("Indica el monto ganado."); return; }
    setBusy(true); setError("");
    try {
      const res = await closeOpportunityWon(opp.id, { won_amount: Number(form.won_amount), actual_close_date: form.actual_close_date, notes: form.notes.trim() || undefined });
      onDone(res);
    } catch (err) { setError(errorMessage(err, "No se pudo cerrar la oportunidad.")); setBusy(false); }
  };
  return (
    <Modal open title="Cerrar como ganada" onClose={onClose} maxWidth="max-w-md" disableClose={busy}>
      <form onSubmit={submit} noValidate>
        <p className="mb-4 text-sm text-fam-muted">“{opp.name}” quedará cerrada y su monto contará como vendido en la cuenta. No se puede reabrir desde aquí.</p>
        <ErrorNote message={error} className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monto ganado (USD)">{(p) => <TextInput {...p} type="number" min="0" step="0.01" value={form.won_amount} onChange={set("won_amount")} className="fam-numeric" autoFocus />}</Field>
          <Field label="Fecha de cierre">{(p) => <TextInput {...p} type="date" value={form.actual_close_date} onChange={set("actual_close_date")} />}</Field>
          <div className="sm:col-span-2"><Field label="Nota" optional>{(p) => <TextArea {...p} rows={2} value={form.notes} onChange={set("notes")} />}</Field></div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={busy}>{busy ? "Cerrando…" : "Cerrar como ganada"}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function LostModal({ opp, onClose, onDone }) {
  const [reasons, setReasons] = useState(null);
  const [form, setForm] = useState({ lost_reason_id: "", lost_reason_detail: "", lesson_learned: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  useEffect(() => {
    let cancelled = false;
    fetchLostReasons().then((r) => { if (!cancelled) setReasons(Array.isArray(r) ? r : []); }).catch(() => { if (!cancelled) setReasons([]); });
    return () => { cancelled = true; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.lost_reason_id) { setError("Elige el motivo de la pérdida."); return; }
    setBusy(true); setError("");
    try {
      await closeOpportunityLost(opp.id, {
        lost_reason_id: form.lost_reason_id,
        lost_reason_detail: form.lost_reason_detail.trim() || null,
        lesson_learned: form.lesson_learned.trim() || null,
      });
      onDone();
    } catch (err) { setError(errorMessage(err, "No se pudo cerrar la oportunidad.")); setBusy(false); }
  };

  return (
    <Modal open title="Cerrar como perdida" onClose={onClose} maxWidth="max-w-md" disableClose={busy}>
      <form onSubmit={submit} noValidate>
        <p className="mb-4 text-sm text-fam-muted">“{opp.name}” saldrá del embudo. El motivo alimenta los reportes de pérdidas.</p>
        <ErrorNote message={error} className="mb-4" />
        {reasons !== null && reasons.length === 0 && <ErrorNote message="No hay motivos de pérdida configurados. Pide a un administrador que los cree en Configuración." className="mb-4" />}
        <div className="space-y-4">
          <Field label="Motivo">
            {(p) => (
              <SelectInput {...p} value={form.lost_reason_id} onChange={set("lost_reason_id")} disabled={reasons === null}>
                <option value="">{reasons === null ? "Cargando…" : "Seleccionar"}</option>
                {(reasons || []).map((r) => <option key={r.id} value={r.id}>{r.reason_name}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Detalle" optional>{(p) => <TextArea {...p} value={form.lost_reason_detail} onChange={set("lost_reason_detail")} placeholder="Qué pasó, contra quién se perdió…" />}</Field>
          <Field label="Lección aprendida" optional>{(p) => <TextArea {...p} rows={2} value={form.lesson_learned} onChange={set("lesson_learned")} />}</Field>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn type="submit" variant="danger" loading={busy}>{busy ? "Cerrando…" : "Cerrar como perdida"}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function WorkProjectModal({ opp, onClose }) {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState(null);
  const [form, setForm] = useState({ workspace_id: "", name: `WM · ${opp.name || ""}`, description: opp.description || "", priority: "medium", status: "draft", default_board_name: "Seguimiento comercial" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaces()
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setWorkspaces(list);
        setForm((f) => ({ ...f, workspace_id: f.workspace_id || list[0]?.id || "" }));
      })
      .catch((err) => { if (!cancelled) { setWorkspaces([]); setError(errorMessage(err, "No se pudieron cargar los espacios de trabajo.")); } });
    return () => { cancelled = true; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.workspace_id) { setError("Elige un espacio de trabajo."); return; }
    setBusy(true); setError("");
    try {
      const project = await createProjectFromOpportunity(opp.id, form);
      navigate(`/dashboard/work-management/projects/${project.id}`);
    } catch (err) { setError(errorMessage(err, "No se pudo crear el proyecto.")); setBusy(false); }
  };

  return (
    <Modal open title="Crear proyecto en Work Management" onClose={onClose} maxWidth="max-w-lg" disableClose={busy}>
      <form onSubmit={submit} noValidate>
        <ErrorNote message={error} className="mb-4" />
        {workspaces === null ? <Skeleton className="h-40 w-full" /> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {workspaces.length === 0 && <p className="rounded-lg bg-fam-warning-bg px-3 py-2 text-sm text-fam-warning sm:col-span-2">No tienes espacios de trabajo. Crea uno primero en Work Management.</p>}
            <div className="sm:col-span-2">
              <Field label="Espacio de trabajo">
                {(p) => (
                  <SelectInput {...p} value={form.workspace_id} onChange={set("workspace_id")}>
                    {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </SelectInput>
                )}
              </Field>
            </div>
            <div className="sm:col-span-2"><Field label="Nombre del proyecto">{(p) => <TextInput {...p} value={form.name} onChange={set("name")} />}</Field></div>
            <div className="sm:col-span-2"><Field label="Descripción" optional>{(p) => <TextArea {...p} value={form.description} onChange={set("description")} />}</Field></div>
            <Field label="Prioridad">
              {(p) => (
                <SelectInput {...p} value={form.priority} onChange={set("priority")}>
                  <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
                </SelectInput>
              )}
            </Field>
            <Field label="Estado inicial">
              {(p) => (
                <SelectInput {...p} value={form.status} onChange={set("status")}>
                  <option value="draft">Borrador</option><option value="active">Activo</option>
                </SelectInput>
              )}
            </Field>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={busy} disabled={!workspaces?.length}>{busy ? "Creando…" : "Crear proyecto"}</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function OpportunityDetailPage() {
  const { id } = useParams();
  const { showToast } = useUI();
  const { loading, data: opp, error, reload } = useLoad(() => fetchOpportunityById(id), [id], { fallback: "No se pudo cargar la oportunidad." });
  const [stages, setStages] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [activities, setActivities] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [movingId, setMovingId] = useState(null);
  const [purchaseKey, setPurchaseKey] = useState(0);

  useEffect(() => {
    fetchPipelineStages()
      .then((s) => setStages((Array.isArray(s) ? s : []).filter((x) => x.is_active !== false).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))))
      .catch(() => setStages([]));
  }, []);

  const loadActivities = useCallback(() => {
    fetchActivities({ opportunity_id: id, limit: 30 }).then((res) => setActivities(listOf(res))).catch(() => setActivities([]));
  }, [id]);
  useEffect(() => { loadActivities(); }, [loadActivities]);

  // Las cuentas solo hacen falta para completar datos o vincular: se cargan al abrir ese diálogo.
  useEffect(() => {
    if (!["complete", "account-link"].includes(dialog) || accounts.length) return;
    fetchAccounts({ limit: 500 }).then((res) => setAccounts(listOf(res))).catch(() => {});
  }, [dialog, accounts.length]);

  if (loading && !opp) {
    return <div className="space-y-4"><Skeleton className="h-4 w-48" /><Skeleton className="h-8 w-96 max-w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-48 w-full" /></div>;
  }
  if (error || !opp) {
    return (
      <div className="flex min-w-0 flex-col">
        <PageHeader title="Oportunidad" context={<Link to={`${BASE}/opportunities`} className="underline underline-offset-2">Embudo</Link>} />
        <ErrorNote message={error || "Esta oportunidad no existe o no tienes acceso."} onRetry={reload} />
      </div>
    );
  }

  const isOpen = opp.status === "open";
  const stage = stages.find((s) => s.id === opp.stage_id);
  const probability = Number(opp.probability_override ?? opp.probability_default ?? stage?.probability_default ?? 0);
  const amount = opp.estimated_amount != null ? Number(opp.estimated_amount) : null;
  const missing = missingFields(opp);
  const h = healthOf(opp.health_status);
  const closeIn = opp.estimated_close_date ? daysFromToday(opp.estimated_close_date) : null;
  const pending = (activities || []).filter((a) => !["completed", "cancelled"].includes(a.status));
  const done = (activities || []).filter((a) => ["completed", "cancelled"].includes(a.status));
  const actionItems = Array.isArray(opp.open_action_items) ? opp.open_action_items : [];
  const close = () => setDialog(null);

  const move = async (target) => {
    setMovingId(target.id);
    try {
      const res = await changeOpportunityStage(opp.id, { stage_id: target.id });
      showToast(res?.warning ? `Movida a ${target.name}. ${res.warning}.` : `Movida a ${target.name}`, res?.warning ? "warning" : "success");
      await reload();
    } catch (err) {
      showToast(errorMessage(err, "No se pudo cambiar la fase."), "error");
    } finally { setMovingId(null); }
  };

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        title={opp.name}
        context={<><Link to={`${BASE}/opportunities`} className="underline underline-offset-2">Embudo</Link> / Oportunidad</>}
        actions={(
          <>
            <Menu
              label="Más"
              items={[
                isOpen && { label: "Cerrar como perdida", danger: true, onSelect: () => setDialog("lost") },
                isOpen && { label: "Suspender", onSelect: () => setDialog("suspend") },
                { label: "Requerimiento de compra", onSelect: () => setDialog("purchase") },
                { label: "Contactos de la cuenta", disabled: !opp.account_id, onSelect: () => setDialog("contacts") },
                !opp.account_id && { label: "Vincular cuenta", onSelect: () => setDialog("account-link") },
                { label: "Crear proyecto en Work Management", onSelect: () => setDialog("work-project") },
              ]}
            />
            <Btn icon={FiFileText} to={`${BASE}/opportunities/${id}/blue-sheet`}>{opp.blue_sheet_id ? "Blue Sheet" : "Iniciar Blue Sheet"}</Btn>
            {isOpen && <Btn variant="primary" icon={FiCheck} onClick={() => setDialog("won")}>Cerrar como ganada</Btn>}
          </>
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-fam-muted">
          <StatusBadge of={opportunityStatus} value={opp.status} />
          {opp.blue_sheet_id && (!opp.health_status || opp.health_status === "gray")
            ? <Badge tone={blueSheetStatus(opp.blue_sheet_status).tone}>Blue Sheet: {blueSheetStatus(opp.blue_sheet_status).label.toLowerCase()}</Badge>
            : <Badge tone={h.tone}>{h.label}</Badge>}
          {opp.opportunity_code && <span className="fam-id text-fam-text">{opp.opportunity_code}</span>}
          {opp.account_id
            ? <Link to={`${BASE}/accounts/${opp.account_id}`} className="text-fam-action underline underline-offset-2">{opp.account_name}</Link>
            : <span>Sin cuenta</span>}
          {opp.owner_name && <span>Responsable: <span className="text-fam-text">{opp.owner_name}</span></span>}
        </div>
      </PageHeader>

      <StageTrack stages={stages} currentId={opp.stage_id} canMove={isOpen} movingId={movingId} onMove={move} />

      <StatStrip
        className="mb-6"
        items={[
          { label: opp.status === "won" ? "Monto ganado" : "Monto estimado", value: opp.status === "won" && opp.won_amount != null ? money(opp.won_amount) : money(amount) },
          { label: "Probabilidad", value: `${probability}%`, hint: opp.probability_override == null ? "la de la fase actual" : "definida para esta oportunidad" },
          { label: "Ponderado", value: amount != null ? money(amount * probability / 100) : "—", hint: "monto × probabilidad" },
          { label: opp.actual_close_date ? "Cerrada" : "Cierre estimado", value: date(opp.actual_close_date || opp.estimated_close_date), hint: isOpen && closeIn !== null ? (closeIn < 0 ? `venció ${relativeDay(opp.estimated_close_date)}` : relativeDay(opp.estimated_close_date)) : undefined, tone: isOpen && closeIn !== null && closeIn < 0 ? "danger" : undefined },
        ]}
      />

      {opp.status === "lost" && (
        <p className="mb-6 rounded-lg bg-fam-danger-bg px-4 py-3 text-sm text-fam-danger">
          Perdida{opp.lost_reason_name ? `: ${opp.lost_reason_name}` : ""}{opp.lost_reason_detail ? ` — ${opp.lost_reason_detail}` : ""}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel title="Datos del negocio" actions={isOpen && <Btn size="sm" onClick={() => setDialog("complete")}>Editar</Btn>}>
            {missing.length > 0 && isOpen && (
              <p className="mb-4 rounded-lg bg-fam-warning-bg px-3 py-2 text-[13px] text-fam-warning">Faltan: {missing.map((f) => f.label.toLowerCase()).join(", ")}.</p>
            )}
            <DefList
              columns={2}
              items={[
                { label: "Cuenta", value: opp.account_id ? <Link to={`${BASE}/accounts/${opp.account_id}`} className="text-fam-action underline underline-offset-2">{opp.account_name}</Link> : null },
                { label: "RUC de la cuenta", value: opp.account_ruc ? <span className="fam-id">{opp.account_ruc}</span> : null },
                { label: "Fuente", value: opp.source ? opportunitySource(opp.source) : null },
                { label: "Fase", value: stage?.name || opp.stage_name },
                { label: "Creada", value: date(opp.created_at) },
                { label: "Última actualización", value: date(opp.updated_at) },
              ]}
            />
            {opp.description && (
              <div className="mt-4 border-t border-fam-border pt-4">
                <p className="mb-1 text-[13px] text-fam-muted">Descripción</p>
                <p className="whitespace-pre-wrap text-sm text-fam-text">{opp.description}</p>
              </div>
            )}
          </Panel>

          <Panel title="Actividades" flush actions={<Btn variant="primary" size="sm" icon={FiPlus} onClick={() => setDialog("activity")}>Agregar</Btn>}>
            {activities === null ? <div className="p-4"><Skeleton className="h-16 w-full" /></div> : activities.length === 0 ? (
              <p className="px-5 py-6 text-sm text-fam-muted">Aún no hay actividades en esta oportunidad. Registra la primera llamada, visita o reunión.</p>
            ) : (
              <ul className="divide-y divide-fam-border">
                {[...pending, ...done].map((a) => {
                  const d = a.scheduled_at ? daysFromToday(a.scheduled_at) : null;
                  const overdue = a.status === "scheduled" && d !== null && d < 0;
                  return (
                    <li key={a.id}>
                      <Link to={`${BASE}/activities?view=${a.status === "scheduled" ? "pendientes" : a.status === "completed" ? "completadas" : a.status === "cancelled" ? "canceladas" : "seguimiento"}&scope=team&sel=${a.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors duration-100 hover:bg-fam-subtle sm:px-5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-fam-text">{a.subject}</span>
                          <span className="block text-[13px] text-fam-muted">{activityType(a.activity_type)}{a.owner_name ? ` · ${a.owner_name}` : ""}</span>
                        </span>
                        <StatusBadge of={activityStatus} value={a.status} />
                        <span className={cx("fam-numeric hidden w-24 shrink-0 text-right text-[13px] sm:block", overdue ? "font-medium text-fam-danger" : "text-fam-muted")}>
                          {a.scheduled_at ? (a.status === "scheduled" ? relativeDay(a.scheduled_at) : date(a.completed_at || a.scheduled_at)) : "sin fecha"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Blue Sheet" actions={<Btn variant="link" to={`${BASE}/opportunities/${id}/blue-sheet`}>{opp.blue_sheet_id ? "Abrir" : "Iniciar"}</Btn>}>
            {!opp.blue_sheet_id ? (
              <p className="text-sm text-fam-muted">
                {opp.requires_blue_sheet || opp.stage_requires_bs ? "Esta oportunidad requiere Blue Sheet y aún no se ha iniciado." : "Sin Blue Sheet. Documenta la estrategia para medir la salud del negocio."}
              </p>
            ) : (
              <DefList
                columns={2}
                items={[
                  { label: "Estado", value: <StatusBadge of={blueSheetStatus} value={opp.blue_sheet_status} /> },
                  { label: "Salud", value: opp.health_score != null ? `${Math.round(Number(opp.health_score))} / 100` : "—", numeric: true },
                  { label: "Completitud", value: opp.completeness_score != null ? `${Math.round(Number(opp.completeness_score))}%` : "—", numeric: true },
                  { label: "Scorecard", value: opp.scorecard_score != null ? `${Math.round(Number(opp.scorecard_score))}%` : "—", numeric: true },
                ]}
              />
            )}
          </Panel>

          <Panel title="Recorrido" hint="Avance del Business Case o de la compra" actions={<Btn variant="link" onClick={() => setDialog("purchase")}>Nuevo requerimiento</Btn>}>
            <JourneyPanel opportunityId={opp.id} reloadKey={purchaseKey} />
          </Panel>

          <Panel title="Acciones abiertas" hint="Del Blue Sheet">
            {actionItems.length === 0 ? <p className="text-sm text-fam-muted">Sin acciones abiertas.</p> : (
              <ul className="space-y-2">
                {actionItems.map((a) => {
                  const late = a.due_date && daysFromToday(a.due_date) < 0;
                  return (
                    <li key={a.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 text-fam-text">{a.title}</span>
                      {a.due_date && <span className={cx("fam-numeric shrink-0 text-[13px]", late ? "font-medium text-fam-danger" : "text-fam-muted")}>{late ? `venció ${relativeDay(a.due_date)}` : relativeDay(a.due_date)}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {dialog === "won" && <WonModal opp={opp} onClose={close} onDone={(res) => { close(); reload(); showToast(res?.warning ? `Cerrada como ganada. ${res.warning}.` : "Oportunidad ganada", res?.warning ? "warning" : "success"); }} />}
      {dialog === "lost" && <LostModal opp={opp} onClose={close} onDone={() => { close(); reload(); showToast("Oportunidad cerrada como perdida", "success"); }} />}
      {dialog === "suspend" && (
        <ReasonDialog
          title="Suspender oportunidad"
          description={`“${opp.name}” saldrá del embudo activo sin contarse como perdida.`}
          label="Motivo"
          confirmLabel="Suspender"
          onClose={close}
          onConfirm={async (notes) => { await suspendOpportunity(opp.id, { notes }); close(); reload(); showToast("Oportunidad suspendida", "success"); }}
        />
      )}
      {dialog === "work-project" && <WorkProjectModal opp={opp} onClose={close} />}
      {dialog === "complete" && (
        <OpportunityFieldsModal
          title="Datos del negocio"
          initial={opp}
          accounts={accounts}
          submitLabel="Guardar"
          onClose={close}
          onSubmit={async (fields) => { await updateOpportunity(opp.id, fields); close(); reload(); showToast("Datos guardados", "success"); }}
        />
      )}
      {dialog === "account-link" && <AccountLinkModal opportunity={opp} accounts={accounts} onClose={close} onLinked={() => { close(); reload(); showToast("Cuenta vinculada", "success"); }} />}
      {dialog === "contacts" && <ContactsModal title={`Contactos · ${opp.account_name || ""}`} accountId={opp.account_id} onAddContact={() => setDialog("contact-new")} onClose={close} />}
      {dialog === "contact-new" && <ContactFormModal accountId={opp.account_id || undefined} onClose={close} onSaved={() => { close(); showToast("Contacto creado", "success"); }} />}
      {dialog === "purchase" && <PurchasePickerModal opportunity={opp} onClose={close} onCreated={() => { close(); setPurchaseKey((k) => k + 1); showToast("Requerimiento de compra creado", "success"); }} />}
      {dialog === "activity" && (
        <ActivityFormModal
          defaults={{ opportunity_id: opp.id, account_id: opp.account_id, context: opp.name }}
          onClose={close}
          onSaved={() => { close(); loadActivities(); showToast("Actividad registrada", "success"); }}
        />
      )}
    </div>
  );
}
