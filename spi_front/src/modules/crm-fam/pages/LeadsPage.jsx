// Bandeja de leads: vistas por estado, filtros en la URL, inspector lateral y acciones masivas.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheck, FiEdit2, FiFilter, FiPlus, FiSlash } from "react-icons/fi";
import { disqualifyLead, fetchLeads, updateLead } from "../../../core/api/crmFamApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import LeadFormModal, { ECUADOR_CITIES, LEAD_PRIORITIES, LEAD_SOURCES, leadPriority, leadSource } from "../components/LeadFormModal";
import { ReasonDialog } from "../ui/dialogs";
import {
  Badge, Btn, DataTable, DefList, EmptyState, ErrorNote, Field, FilterChip, Inspector, PageHeader, Panel,
  SearchInput, SelectInput, SkeletonRows, StatusBadge, Tabs, TextInput,
} from "../ui/kit";
import { BulkBar, Pagination, runBulk, useSelection } from "../ui/listParts";
import { date, daysFromToday, errorMessage, money, number, relativeDay } from "../ui/format";
import { canSeeAllLeads } from "../ui/roles";
import { leadStatus } from "../ui/status";
import { listOf, totalOf, useAdvisors, useLoad } from "../ui/useLoad";
import { useUrlSearch, useUrlState } from "../ui/useUrlState";

const BASE = "/dashboard/crm-fam";
const LIMIT = 25;
const VIEWS = [
  { value: "", label: "Todos" },
  { value: "new", label: "Nuevos" },
  { value: "contacted", label: "Contactados" },
  { value: "qualified", label: "Calificados" },
  { value: "converted", label: "Convertidos" },
  { value: "unqualified", label: "Descalificados" },
];
// `unqualified` es el estado final que guarda el backend; `disqualified` solo aparece en datos antiguos.
const isFinal = (status) => ["converted", "unqualified", "disqualified"].includes(status);
const canQualify = (status) => status === "new" || status === "contacted";
const nameOf = (l) => [l.first_name, l.last_name].filter(Boolean).join(" ") || l.company_name || "Lead sin nombre";
const priorityTone = { urgent: "danger", high: "warning" };

function LeadPeek({ lead }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <StatusBadge of={leadStatus} value={lead.status} />
        <Badge tone={priorityTone[lead.priority] || "neutral"}>Prioridad {leadPriority(lead.priority).toLowerCase()}</Badge>
      </div>
      <DefList
        columns={2}
        items={[
          { label: "Empresa", value: lead.company_name },
          { label: "Ciudad", value: lead.city },
          { label: "Correo", value: lead.email ? <a href={`mailto:${lead.email}`} className="break-all text-fam-action underline underline-offset-2">{lead.email}</a> : null },
          { label: "Teléfono", value: lead.phone ? <a href={`tel:${lead.phone.replace(/\s+/g, "")}`} className="fam-numeric text-fam-action underline underline-offset-2">{lead.phone}</a> : null },
          { label: "Fuente", value: lead.source ? leadSource(lead.source) : null },
          { label: "Asesor", value: lead.owner_name },
          { label: "Recibido", value: `${date(lead.created_at)} (${relativeDay(lead.created_at)})` },
          { label: "Valor estimado", value: lead.estimated_value != null ? money(lead.estimated_value) : null, numeric: true },
        ]}
      />
      {lead.interest_description && (
        <div className="border-t border-fam-border pt-4">
          <h3 className="mb-1 text-[13px] font-semibold text-fam-text">Interés o necesidad</h3>
          <p className="whitespace-pre-wrap text-sm text-fam-text">{lead.interest_description}</p>
        </div>
      )}
      {lead.converted_account_id && (
        <div className="border-t border-fam-border pt-4">
          <h3 className="mb-1 text-[13px] font-semibold text-fam-text">Cuenta vinculada</h3>
          <Link to={`${BASE}/accounts/${lead.converted_account_id}`} className="text-sm text-fam-action underline underline-offset-2">{lead.converted_account_name || "Abrir cuenta"}</Link>
        </div>
      )}
      {lead.status === "qualified" && (
        <p className="rounded-lg bg-fam-info-bg px-3 py-2 text-[13px] text-fam-info">
          Este lead está calificado: promuévelo a oportunidad desde el <Link to={`${BASE}/opportunities`} className="underline underline-offset-2">embudo de ventas</Link>.
        </p>
      )}
    </div>
  );
}

export default function LeadsPage() {
  const { user } = useAuth();
  const { showToast } = useUI();
  const seesAll = canSeeAllLeads(user);
  const advisors = useAdvisors(seesAll);
  const [url, setUrl] = useUrlState({ q: "", status: "", owner: "", priority: "", source: "", city: "", from: "", to: "", page: "0", sel: "", new: "" });
  const [search, setSearch] = useUrlSearch(url.q, (q) => setUrl({ q, page: "0" }));
  const [moreFilters, setMoreFilters] = useState(Boolean(url.owner || url.priority || url.source || url.city || url.from || url.to));
  const [editing, setEditing] = useState(null);
  const [disqualifying, setDisqualifying] = useState(null); // lead | [leads]
  const [busy, setBusy] = useState(false);
  const selection = useSelection();
  const offset = Math.max(0, Number(url.page) || 0) * LIMIT;

  const { loading, data, error, reload } = useLoad(
    () => fetchLeads({
      q: url.q || undefined,
      status: url.status || undefined,
      owner_user_id: url.owner || undefined,
      priority: url.priority || undefined,
      source: url.source || undefined,
      city: url.city || undefined,
      created_from: url.from || undefined,
      created_to: url.to || undefined,
      limit: LIMIT,
      offset,
    }),
    [url.q, url.status, url.owner, url.priority, url.source, url.city, url.from, url.to, offset],
    { fallback: "No se pudieron cargar los leads." },
  );
  const rows = listOf(data);
  const total = totalOf(data);
  const selected = rows.find((r) => r.id === url.sel);
  const picked = rows.filter((r) => selection.ids.has(r.id));

  // Cambiar de vista o de página invalida la selección.
  useEffect(() => { selection.clear(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [url.status, url.page, url.q]);

  const setFilter = (patch) => setUrl({ ...patch, page: "0" });
  const secondary = [
    url.owner && { key: "owner", label: `Asesor: ${advisors.find((a) => String(a.id) === url.owner)?.fullname || url.owner}` },
    url.priority && { key: "priority", label: `Prioridad ${leadPriority(url.priority).toLowerCase()}` },
    url.source && { key: "source", label: leadSource(url.source) },
    url.city && { key: "city", label: url.city },
    url.from && { key: "from", label: `Desde ${date(url.from)}` },
    url.to && { key: "to", label: `Hasta ${date(url.to)}` },
  ].filter(Boolean);
  const hasFilters = Boolean(url.q || secondary.length);
  const clearFilters = () => { setSearch(""); setUrl({ q: "", status: "", owner: "", priority: "", source: "", city: "", from: "", to: "", page: "0" }); };

  const qualify = async (leads) => {
    setBusy(true);
    const { ok, failed } = await runBulk(leads, (l) => updateLead(l.id, { status: "qualified" }));
    setBusy(false);
    selection.clear();
    reload();
    showToast(failed ? `${ok} calificado(s); ${failed} no se pudieron calificar.` : ok === 1 ? "Lead calificado" : `${ok} leads calificados`, failed ? "warning" : "success");
  };

  const disqualify = async (reason) => {
    const leads = Array.isArray(disqualifying) ? disqualifying : [disqualifying];
    const { ok, failed } = await runBulk(leads, (l) => disqualifyLead(l.id, { reason: reason || "Manual" }));
    if (ok === 0) throw new Error("No se pudo descalificar. Inténtalo de nuevo.");
    setDisqualifying(null);
    selection.clear();
    reload();
    showToast(failed ? `${ok} descalificado(s); ${failed} fallaron.` : ok === 1 ? "Lead descalificado" : `${ok} leads descalificados`, failed ? "warning" : "success");
  };

  const columns = [
    {
      key: "name", header: "Lead",
      render: (l) => (
        <div className="min-w-0">
          <button type="button" onClick={(e) => { e.stopPropagation(); setUrl({ sel: l.id }, { replace: false }); }} className="max-w-full truncate text-left font-medium text-fam-text hover:text-fam-action">{nameOf(l)}</button>
          {l.company_name && <div className="truncate text-[13px] text-fam-muted">{l.company_name}</div>}
        </div>
      ),
    },
    { key: "status", header: "Estado", render: (l) => <StatusBadge of={leadStatus} value={l.status} /> },
    { key: "priority", header: "Prioridad", hideBelow: "md", render: (l) => (priorityTone[l.priority] ? <Badge tone={priorityTone[l.priority]}>{leadPriority(l.priority)}</Badge> : leadPriority(l.priority)) },
    { key: "city", header: "Ciudad", hideBelow: "lg" },
    ...(seesAll ? [{ key: "owner_name", header: "Asesor", hideBelow: "lg", render: (l) => <span className="block max-w-[180px] truncate" title={l.owner_name || undefined}>{l.owner_name || "—"}</span> }] : []),
    {
      key: "created_at", header: "Recibido", hideBelow: "sm",
      render: (l) => {
        const waiting = l.status === "new" && daysFromToday(l.created_at) <= -3;
        return <span className={waiting ? "text-fam-warning" : undefined} title={date(l.created_at)}>{relativeDay(l.created_at)}</span>;
      },
    },
  ];
  const visibleColumns = selected ? columns.filter((c) => !["priority", "city", "owner_name"].includes(c.key)) : columns;

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        title="Leads"
        count={loading && !data ? null : number(total)}
        actions={<Btn variant="primary" icon={FiPlus} onClick={() => setUrl({ new: "1" })}>Nuevo lead</Btn>}
      >
        <Tabs label="Vistas por estado" tabs={VIEWS} value={url.status} onChange={(v) => setFilter({ status: v })} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, empresa o correo…" label="Buscar leads" className="w-full sm:w-80" />
        <Btn icon={FiFilter} aria-expanded={moreFilters} aria-controls="lead-filters" onClick={() => setMoreFilters((v) => !v)}>
          Filtros{secondary.length ? ` (${secondary.length})` : ""}
        </Btn>
        {secondary.map((f) => <FilterChip key={f.key} label={f.label} onRemove={() => setFilter({ [f.key]: "" })} />)}
        {hasFilters && <Btn variant="link" onClick={clearFilters}>Limpiar</Btn>}
      </div>

      {moreFilters && (
        <div id="lead-filters" className="mb-4 grid gap-3 rounded-xl border border-fam-border bg-fam-surface p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {seesAll && (
            <Field label="Asesor">
              {(p) => (
                <SelectInput {...p} value={url.owner} onChange={(e) => setFilter({ owner: e.target.value })}>
                  <option value="">Todos</option>
                  {advisors.map((a) => <option key={a.id} value={a.id}>{a.fullname || a.email}</option>)}
                </SelectInput>
              )}
            </Field>
          )}
          <Field label="Prioridad">
            {(p) => (
              <SelectInput {...p} value={url.priority} onChange={(e) => setFilter({ priority: e.target.value })}>
                <option value="">Todas</option>
                {LEAD_PRIORITIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Fuente">
            {(p) => (
              <SelectInput {...p} value={url.source} onChange={(e) => setFilter({ source: e.target.value })}>
                <option value="">Todas</option>
                {LEAD_SOURCES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Ciudad">
            {(p) => (
              <SelectInput {...p} value={url.city} onChange={(e) => setFilter({ city: e.target.value })}>
                <option value="">Todas</option>
                {ECUADOR_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Recibido desde">{(p) => <TextInput {...p} type="date" value={url.from} onChange={(e) => setFilter({ from: e.target.value })} />}</Field>
          <Field label="Recibido hasta">{(p) => <TextInput {...p} type="date" value={url.to} onChange={(e) => setFilter({ to: e.target.value })} />}</Field>
        </div>
      )}

      <div className={selected ? "grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_400px]" : ""}>
        <Panel flush>
          <BulkBar count={picked.length} onClear={selection.clear}>
            <Btn size="sm" icon={FiCheck} disabled={busy || !picked.some((l) => canQualify(l.status))} onClick={() => qualify(picked.filter((l) => canQualify(l.status)))}>Calificar</Btn>
            <Btn size="sm" icon={FiSlash} disabled={busy || !picked.some((l) => !isFinal(l.status))} onClick={() => setDisqualifying(picked.filter((l) => !isFinal(l.status)))}>Descalificar</Btn>
          </BulkBar>
          <ErrorNote message={error} onRetry={reload} className="m-4" />
          {loading && !data ? (
            <SkeletonRows rows={8} />
          ) : error ? null : rows.length === 0 ? (
            hasFilters ? (
              <EmptyState title="Ningún lead coincide" hint="Cambia la vista, la búsqueda o los filtros." action={<Btn onClick={clearFilters}>Limpiar filtros</Btn>} />
            ) : (
              <EmptyState title="Aún no hay leads" hint="Registra el primer contacto comercial para empezar a darle seguimiento." action={<Btn variant="primary" icon={FiPlus} onClick={() => setUrl({ new: "1" })}>Nuevo lead</Btn>} />
            )
          ) : (
            <>
              <DataTable
                caption="Leads"
                columns={visibleColumns}
                rows={rows}
                selection={selection}
                selectedId={url.sel}
                onRowClick={(l) => setUrl({ sel: l.id === url.sel ? "" : l.id }, { replace: false })}
              />
              <Pagination offset={offset} limit={LIMIT} total={total} shown={rows.length} onChange={(next) => setUrl({ page: String(Math.floor(next / LIMIT)) }, { replace: false })} />
            </>
          )}
        </Panel>

        <Inspector
          open={Boolean(selected)}
          title={selected ? nameOf(selected) : ""}
          onClose={() => setUrl({ sel: "" })}
          footer={selected && (
            <>
              {!isFinal(selected.status) && <Btn icon={FiSlash} onClick={() => setDisqualifying(selected)}>Descalificar</Btn>}
              <Btn icon={FiEdit2} onClick={() => setEditing(selected)}>Editar</Btn>
              {canQualify(selected.status) && <Btn variant="primary" icon={FiCheck} loading={busy} onClick={() => qualify([selected])}>Calificar</Btn>}
            </>
          )}
        >
          {selected && <LeadPeek lead={selected} />}
        </Inspector>
      </div>

      {(url.new === "1" || editing) && (
        <LeadFormModal
          lead={editing}
          onClose={() => { setEditing(null); setUrl({ new: "" }); }}
          onSaved={(saved) => {
            const wasNew = !editing;
            setEditing(null);
            setUrl({ new: "", ...(wasNew && saved?.id ? { sel: saved.id, status: "", page: "0" } : {}) });
            reload();
            showToast(wasNew ? "Lead creado" : "Lead actualizado", "success");
          }}
        />
      )}

      {disqualifying && (
        <ReasonDialog
          title={Array.isArray(disqualifying) ? `Descalificar ${disqualifying.length} lead(s)` : `Descalificar a ${nameOf(disqualifying)}`}
          description="El lead saldrá de tu bandeja activa. Podrás verlo en la vista Descalificados."
          label="Motivo"
          placeholder="Sin presupuesto, fuera de cobertura, contacto equivocado…"
          confirmLabel="Descalificar"
          danger
          onConfirm={disqualify}
          onClose={() => setDisqualifying(null)}
        />
      )}
    </div>
  );
}
