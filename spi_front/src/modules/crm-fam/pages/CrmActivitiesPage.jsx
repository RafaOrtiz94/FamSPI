// Actividades como agenda: lo pendiente agrupado por urgencia (vencidas, hoy, próximas), las visitas
// que esperan cierre comercial, y el historial. El detalle se revisa en el inspector sin dejar la lista.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiCalendar, FiCheck, FiExternalLink, FiPlus, FiSlash } from "react-icons/fi";
import { fetchActivities, updateActivity } from "../../../core/api/crmFamApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import { ActivityCloseModal, ActivityFormModal } from "../components/ActivityModals";
import { ConfirmDialog } from "../ui/dialogs";
import { Badge, Btn, cx, DefList, EmptyState, ErrorNote, Inspector, PageHeader, Panel, SelectInput, SkeletonRows, StatusBadge, Tabs } from "../ui/kit";
import { date, daysFromToday, relativeDay, time } from "../ui/format";
import { isManager } from "../ui/roles";
import { ACTIVITY_TYPES, activityStatus, activityType } from "../ui/status";
import { listOf, useLoad } from "../ui/useLoad";
import { useUrlState } from "../ui/useUrlState";

const BASE = "/dashboard/crm-fam";
const PAGE = 100;
const VIEWS = [
  { value: "pendientes", label: "Pendientes" },
  { value: "seguimiento", label: "Por cerrar" },
  { value: "completadas", label: "Completadas" },
  { value: "canceladas", label: "Canceladas" },
];
const STATUS_BY_VIEW = { pendientes: "scheduled", seguimiento: "visited_pending_followup", completadas: "completed", canceladas: "cancelled" };

// Las visitas del cronograma solo se marcan realizadas desde Asistencia: aquí no se completan ni cancelan.
const fromSchedule = (a) => a.source_module === "schedule" || (a.activity_type === "visita" && Boolean(a.is_scheduled_visit));
const originOf = (a) => (a.source_module === "work_management" ? "Work Management" : fromSchedule(a) ? "Cronograma" : "CRM");
const needsClose = (a) => a.status === "visited_pending_followup" || a.followup_status === "incomplete_followup";
const customerOf = (a) => a.visit_client_name || a.account_name || a.opportunity_name || "Sin cliente vinculado";
const whenOf = (a) => a.hora_salida || a.completed_at || a.scheduled_at || a.visit_date;

function ActivityRow({ a, selected, onOpen }) {
  const d = a.scheduled_at ? daysFromToday(a.scheduled_at) : null;
  const open = a.status === "scheduled";
  const overdue = open && d !== null && d < 0;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-pressed={selected}
        className={cx("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-100 sm:px-5", selected ? "bg-fam-selected" : "hover:bg-fam-subtle")}
      >
        <FiCalendar className="h-4 w-4 shrink-0 text-fam-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fam-text">{a.subject}</span>
          <span className="block truncate text-[13px] text-fam-muted">{activityType(a.activity_type)} · {customerOf(a)}{a.owner_name ? ` · ${a.owner_name}` : ""}</span>
        </span>
        {needsClose(a) && <Badge tone="warning">Falta cierre</Badge>}
        <span className={cx("fam-numeric hidden shrink-0 text-[13px] sm:block", overdue ? "font-medium text-fam-danger" : "text-fam-muted")}>
          {open && d !== null ? (d === 0 ? (time(a.scheduled_at) || "hoy") : relativeDay(a.scheduled_at)) : date(whenOf(a))}
        </span>
      </button>
    </li>
  );
}

function Group({ title, tone, items, selectedId, onOpen }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="flex items-center gap-2 border-b border-fam-border bg-fam-canvas px-4 py-2 text-[13px] font-semibold text-fam-text sm:px-5">
        {title}
        <span className={cx("fam-numeric font-normal", tone === "danger" ? "text-fam-danger" : "text-fam-muted")}>{items.length}</span>
      </h3>
      <ul className="divide-y divide-fam-border">
        {items.map((a) => <ActivityRow key={a.id} a={a} selected={selectedId === a.id} onOpen={() => onOpen(a)} />)}
      </ul>
    </div>
  );
}

function ActivityPeek({ a }) {
  const documents = Array.isArray(a.documents) ? a.documents : [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <StatusBadge of={activityStatus} value={a.status} />
        <Badge>{activityType(a.activity_type)}</Badge>
        <Badge>{originOf(a)}</Badge>
      </div>

      {needsClose(a) && (
        <p className="rounded-lg bg-fam-warning-bg px-3 py-2 text-[13px] text-fam-warning">
          La visita ya está registrada. Falta documentar qué se logró, los comentarios y la evidencia si aplica.
        </p>
      )}
      {fromSchedule(a) && a.status === "scheduled" && (
        <p className="rounded-lg bg-fam-info-bg px-3 py-2 text-[13px] text-fam-info">
          Viene del cronograma: se marca como realizada cuando el asesor registra la visita desde Asistencia.
        </p>
      )}

      <DefList
        items={[
          { label: "Cliente", value: a.account_id ? <Link to={`${BASE}/accounts/${a.account_id}`} className="text-fam-action underline underline-offset-2">{customerOf(a)}</Link> : customerOf(a) },
          a.opportunity_id && { label: "Oportunidad", value: <Link to={`${BASE}/opportunities/${a.opportunity_id}`} className="text-fam-action underline underline-offset-2">{a.opportunity_name || "Abrir oportunidad"}</Link> },
          { label: "Fecha", value: whenOf(a) ? `${date(whenOf(a))}${time(whenOf(a)) ? ` · ${time(whenOf(a))}` : ""}` : "Sin fecha" },
          a.duration_minutes && { label: "Duración", value: `${a.duration_minutes} min` },
          { label: "Responsable", value: a.owner_name },
          a.description && { label: "Descripción", value: <span className="whitespace-pre-wrap">{a.description}</span> },
        ]}
      />

      {a.calendar_event_url && (
        <a href={a.calendar_event_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-fam-action underline underline-offset-2">
          <FiExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Ver en Calendar
        </a>
      )}

      {(a.outcome || a.outcome_notes || a.next_step) && (
        <div className="border-t border-fam-border pt-4">
          <h3 className="mb-3 text-[13px] font-semibold text-fam-text">Cierre comercial</h3>
          <DefList
            items={[
              { label: "Qué se logró", value: a.outcome ? <span className="whitespace-pre-wrap">{a.outcome}</span> : "Pendiente" },
              { label: "Comentarios", value: a.outcome_notes ? <span className="whitespace-pre-wrap">{a.outcome_notes}</span> : "Pendiente" },
              { label: "Próximo paso", value: a.next_step ? <span className="whitespace-pre-wrap">{a.next_step}</span> : "Sin siguiente paso" },
            ]}
          />
        </div>
      )}

      <div className="border-t border-fam-border pt-4">
        <h3 className="mb-2 text-[13px] font-semibold text-fam-text">Documentos <span className="fam-numeric font-normal text-fam-muted">{documents.length}</span></h3>
        {documents.length === 0 ? (
          <p className="text-sm text-fam-muted">Sin documentos adjuntos.</p>
        ) : (
          <ul className="space-y-1.5">
            {documents.map((doc) => (
              <li key={doc.id}>
                <a href={doc.drive_file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-fam-action underline underline-offset-2">{doc.document_name || "Documento"}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function CrmActivitiesPage() {
  const { user } = useAuth();
  const { showToast } = useUI();
  const manager = isManager(user);
  const [url, setUrl] = useUrlState({ view: "pendientes", type: "", scope: "mine", sel: "", new: "" });
  const view = STATUS_BY_VIEW[url.view] ? url.view : "pendientes";
  const [limit, setLimit] = useState(PAGE);
  const [closing, setClosing] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => { setLimit(PAGE); }, [view, url.type, url.scope]);

  // El backend limita a lo propio a quien no es manager; un manager elige entre lo suyo y el equipo.
  const owner = manager && url.scope === "team" ? {} : { owner_user_id: user?.id };
  const { loading, data, error, reload } = useLoad(
    async () => {
      const base = { ...owner, ...(url.type ? { activity_type: url.type } : {}), limit };
      if (view !== "seguimiento") return listOf(await fetchActivities({ ...base, status: STATUS_BY_VIEW[view] }));
      // "Por cerrar" junta las visitas sin cierre y las completadas con cierre incompleto.
      const [pending, done] = await Promise.all([
        fetchActivities({ ...base, status: "visited_pending_followup" }),
        fetchActivities({ ...base, status: "completed" }),
      ]);
      return [...listOf(pending), ...listOf(done).filter((a) => a.followup_status === "incomplete_followup")];
    },
    [view, url.type, url.scope, limit, user?.id],
    { fallback: "No se pudieron cargar las actividades." },
  );
  const rows = useMemo(() => data || [], [data]);
  const selected = rows.find((a) => a.id === url.sel);
  const mayHaveMore = rows.length >= limit && view !== "seguimiento";

  const groups = useMemo(() => {
    if (view !== "pendientes") return null;
    const withDate = rows.filter((a) => a.scheduled_at);
    const asc = (x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at);
    return {
      overdue: withDate.filter((a) => daysFromToday(a.scheduled_at) < 0).sort(asc),
      today: withDate.filter((a) => daysFromToday(a.scheduled_at) === 0).sort(asc),
      upcoming: withDate.filter((a) => daysFromToday(a.scheduled_at) > 0).sort(asc),
      undated: rows.filter((a) => !a.scheduled_at),
    };
  }, [rows, view]);

  const open = (a) => setUrl({ sel: a.id === url.sel ? "" : a.id }, { replace: false });
  const canAct = (a) => a.status === "scheduled" && !fromSchedule(a);

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        title="Actividades"
        actions={<Btn variant="primary" icon={FiPlus} onClick={() => setUrl({ new: "1" })}>Nueva actividad</Btn>}
      >
        <Tabs label="Vistas" tabs={VIEWS} value={view} onChange={(v) => setUrl({ view: v, sel: "" })} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-52">
          <SelectInput aria-label="Filtrar por tipo" value={url.type} onChange={(e) => setUrl({ type: e.target.value })}>
            <option value="">Todos los tipos</option>
            {Object.entries(ACTIVITY_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectInput>
        </div>
        {manager && (
          <div className="w-full sm:w-48">
            <SelectInput aria-label="Alcance" value={url.scope} onChange={(e) => setUrl({ scope: e.target.value })}>
              <option value="mine">Lo mío</option>
              <option value="team">Todo el equipo</option>
            </SelectInput>
          </div>
        )}
      </div>

      <div className={selected ? "grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_420px]" : ""}>
        <Panel flush>
          <ErrorNote message={error} onRetry={reload} className="m-4" />
          {loading && !data ? (
            <SkeletonRows rows={8} />
          ) : error ? null : rows.length === 0 ? (
            view === "pendientes" ? (
              <EmptyState title="No tienes actividades pendientes" hint="Registra una llamada, reunión o tarea para darle seguimiento." action={<Btn variant="primary" icon={FiPlus} onClick={() => setUrl({ new: "1" })}>Nueva actividad</Btn>} />
            ) : view === "seguimiento" ? (
              <EmptyState title="Nada por cerrar" hint="Cuando una visita del cronograma se registre en Asistencia, aparecerá aquí para documentar su resultado." />
            ) : (
              <EmptyState title={view === "completadas" ? "Sin actividades completadas" : "Sin actividades canceladas"} hint="Prueba con otro tipo o alcance." />
            )
          ) : (
            <>
              {groups ? (
                <>
                  <Group title="Vencidas" tone="danger" items={groups.overdue} selectedId={url.sel} onOpen={open} />
                  <Group title="Hoy" items={groups.today} selectedId={url.sel} onOpen={open} />
                  <Group title="Próximas" items={groups.upcoming} selectedId={url.sel} onOpen={open} />
                  <Group title="Sin fecha" items={groups.undated} selectedId={url.sel} onOpen={open} />
                </>
              ) : (
                <ul className="divide-y divide-fam-border">
                  {rows.map((a) => <ActivityRow key={a.id} a={a} selected={url.sel === a.id} onOpen={() => open(a)} />)}
                </ul>
              )}
              {mayHaveMore && (
                <div className="border-t border-fam-border px-4 py-3 text-center">
                  <Btn onClick={() => setLimit((n) => n + PAGE)} loading={loading}>{loading ? "Cargando…" : "Cargar más"}</Btn>
                </div>
              )}
            </>
          )}
        </Panel>

        <Inspector
          open={Boolean(selected)}
          title={selected?.subject}
          onClose={() => setUrl({ sel: "" })}
          footer={selected && (needsClose(selected) || canAct(selected)) && (
            <>
              {canAct(selected) && <Btn icon={FiSlash} onClick={() => setCancelling(selected)}>Cancelar</Btn>}
              <Btn variant="primary" icon={FiCheck} onClick={() => setClosing(selected)}>{needsClose(selected) ? "Registrar cierre" : "Completar"}</Btn>
            </>
          )}
        >
          {selected && <ActivityPeek a={selected} />}
        </Inspector>
      </div>

      {url.new === "1" && (
        <ActivityFormModal
          onClose={() => setUrl({ new: "" })}
          onSaved={(saved) => { setUrl({ new: "", view: "pendientes", sel: saved?.id || "" }); reload(); showToast("Actividad registrada", "success"); }}
        />
      )}

      {closing && (
        <ActivityCloseModal
          activity={closing}
          onClose={() => setClosing(null)}
          onSaved={({ uploadFailed }) => {
            setClosing(null);
            setUrl({ sel: "" });
            reload();
            showToast(uploadFailed ? "Cierre guardado, pero el documento no se pudo adjuntar." : "Cierre guardado", uploadFailed ? "warning" : "success");
          }}
        />
      )}

      {cancelling && (
        <ConfirmDialog
          title="Cancelar actividad"
          description={`“${cancelling.subject}” pasará a Canceladas y dejará de contar como pendiente.`}
          confirmLabel="Cancelar actividad"
          danger
          onClose={() => setCancelling(null)}
          onConfirm={async () => {
            await updateActivity(cancelling.id, { status: "cancelled" });
            setCancelling(null);
            setUrl({ sel: "" });
            reload();
            showToast("Actividad cancelada", "success");
          }}
        />
      )}
    </div>
  );
}
