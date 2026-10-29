// Bandeja de cuentas (DESIGN.md §7): tabla continua con búsqueda, filtros y orden guardados en la
// URL, e inspector lateral para revisar una cuenta sin perder la lista.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiExternalLink, FiPlus } from "react-icons/fi";
import { fetchAccountById, fetchAccounts, fetchAccountSalesStats } from "../../../core/api/crmFamApi";
import { useUI } from "../../../core/ui/UIContext";
import AccountFormModal from "../components/AccountFormModal";
import {
  Badge, Btn, DataTable, DefList, EmptyState, ErrorNote, FilterChip, Inspector, PageHeader, Panel,
  SearchInput, SelectInput, Skeleton, SkeletonRows, sortRows, StatusBadge,
} from "../ui/kit";
import { errorMessage, money, number } from "../ui/format";
import { accountClassification, accountType, ACCOUNT_TYPES } from "../ui/status";
import { useUrlSearch, useUrlState } from "../ui/useUrlState";

const BASE = "/dashboard/crm-fam";
const LIMIT = 200;
const CLASSIFICATIONS = ["oro", "plata", "bronce", "normal"];

// Resumen de la cuenta seleccionada: lo necesario para decidir si abrirla.
function AccountPeek({ id }) {
  const [state, setState] = useState({ loading: true, account: null, stats: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, account: null, stats: null, error: "" });
    Promise.allSettled([fetchAccountById(id), fetchAccountSalesStats(id)]).then(([acc, stats]) => {
      if (cancelled) return;
      setState({
        loading: false,
        account: acc.status === "fulfilled" ? acc.value : null,
        stats: stats.status === "fulfilled" ? stats.value : null,
        error: acc.status === "rejected" ? errorMessage(acc.reason, "No se pudo cargar la cuenta.") : "",
      });
    });
    return () => { cancelled = true; };
  }, [id]);

  if (state.loading) return <div className="space-y-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-24 w-full" /></div>;
  if (state.error) return <ErrorNote message={state.error} />;
  const a = state.account;
  const s = state.stats;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {a.classification && <StatusBadge of={accountClassification} value={a.classification} />}
        {a.account_type && <Badge>{accountType(a.account_type)}</Badge>}
      </div>

      <DefList
        columns={2}
        items={[
          { label: "RUC", value: a.ruc ? <span className="fam-id">{a.ruc}</span> : null },
          { label: "Ciudad", value: a.city },
          { label: "Propietario", value: a.owner_name },
          { label: "Teléfono", value: a.phone },
          { label: "Correo", value: a.email ? <a href={`mailto:${a.email}`} className="text-fam-action underline">{a.email}</a> : null },
          { label: "Industria", value: a.industry },
        ]}
      />

      {s && (
        <div className="border-t border-fam-border pt-4">
          <h3 className="mb-3 text-[13px] font-semibold text-fam-text">{s.plan ? `Plan: ${s.plan.name}` : "Sin plan de cuenta"}</h3>
          <DefList
            columns={2}
            items={[
              { label: "Meta", value: s.plan ? money(s.sales_target_amount) : "—", numeric: true },
              { label: "Vendido", value: money(s.sold_amount), numeric: true },
              { label: "Falta por vender", value: s.plan ? money(s.remaining_to_target) : "—", numeric: true },
              { label: "Pipeline a generar", value: s.required_pipeline_amount != null && Number(s.seller?.win_rate_pct) > 0 ? money(s.required_pipeline_amount) : "—", numeric: true },
            ]}
          />
        </div>
      )}

      <div className="border-t border-fam-border pt-4">
        <h3 className="mb-2 text-[13px] font-semibold text-fam-text">Oportunidades abiertas</h3>
        {(a.open_opportunities || []).length === 0 ? (
          <p className="text-sm text-fam-muted">Ninguna en curso.</p>
        ) : (
          <ul className="divide-y divide-fam-border">
            {a.open_opportunities.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                <Link to={`${BASE}/opportunities/${o.id}`} className="min-w-0 truncate text-sm text-fam-action underline underline-offset-2">{o.name}</Link>
                <span className="fam-numeric shrink-0 text-sm text-fam-text">{money(o.estimated_amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-fam-border pt-4">
        <h3 className="mb-2 text-[13px] font-semibold text-fam-text">Contactos</h3>
        {(a.contacts || []).length === 0 ? (
          <p className="text-sm text-fam-muted">Sin contactos registrados.</p>
        ) : (
          <ul className="space-y-1.5">
            {a.contacts.map((c) => (
              <li key={c.id} className="text-sm text-fam-text">
                {c.full_name}{c.job_title ? <span className="text-fam-muted"> · {c.job_title}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const { showToast } = useUI();
  const [url, setUrl] = useUrlState({ q: "", type: "", cls: "", sort: "account_name", dir: "asc", sel: "", new: "" });
  const [search, setSearch] = useUrlSearch(url.q, (q) => setUrl({ q }));
  const [state, setState] = useState({ loading: true, rows: [], total: 0, error: "" });
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const res = await fetchAccounts({
        ...(url.q ? { q: url.q } : {}),
        ...(url.type ? { account_type: url.type } : {}),
        ...(url.cls ? { classification: url.cls } : {}),
        limit: LIMIT,
      });
      if (requestId !== requestRef.current) return;
      setState({ loading: false, rows: res?.data || [], total: res?.total ?? 0, error: "" });
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setState({ loading: false, rows: [], total: 0, error: errorMessage(err, "No se pudieron cargar las cuentas.") });
    }
  }, [url.q, url.type, url.cls]);

  useEffect(() => { load(); }, [load]);

  const sort = { key: url.sort, dir: url.dir };
  const rows = useMemo(
    () => sortRows(state.rows, sort, {
      open_opportunity_count: (r) => Number(r.open_opportunity_count || 0),
      contact_count: (r) => Number(r.contact_count || 0),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.rows, url.sort, url.dir],
  );
  const onSort = (key) => setUrl({ sort: key, dir: url.sort === key && url.dir === "asc" ? "desc" : "asc" });

  const hasFilters = Boolean(url.q || url.type || url.cls);
  const clearFilters = () => { setSearch(""); setUrl({ q: "", type: "", cls: "" }); };
  const selected = rows.find((r) => r.id === url.sel);

  const columns = [
    {
      key: "account_name", header: "Cuenta", sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <button type="button" onClick={(e) => { e.stopPropagation(); setUrl({ sel: r.id }, { replace: false }); }} className="max-w-full truncate text-left font-medium text-fam-text hover:text-fam-action">
            {r.account_name}
          </button>
          {r.ruc && <div className="fam-id text-xs text-fam-muted">{r.ruc}</div>}
        </div>
      ),
    },
    { key: "classification", header: "Clasificación", sortable: true, hideBelow: "sm", render: (r) => (r.classification ? <StatusBadge of={accountClassification} value={r.classification} /> : <span className="text-fam-muted">—</span>) },
    { key: "account_type", header: "Tipo", hideBelow: "lg", render: (r) => (r.account_type ? accountType(r.account_type) : <span className="text-fam-muted">—</span>) },
    { key: "city", header: "Ciudad", sortable: true, hideBelow: "md" },
    { key: "owner_name", header: "Propietario", sortable: true, hideBelow: "lg", render: (r) => <span className="block max-w-[180px] truncate" title={r.owner_name || undefined}>{r.owner_name || "—"}</span> },
    { key: "contact_count", header: "Contactos", align: "right", sortable: true, hideBelow: "md", render: (r) => number(r.contact_count) },
    { key: "open_opportunity_count", header: "Opp. abiertas", align: "right", sortable: true, render: (r) => number(r.open_opportunity_count) },
  ];

  const visibleColumns = selected ? columns.filter((c) => !["account_type", "owner_name", "contact_count"].includes(c.key)) : columns;

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        title="Cuentas"
        count={state.loading ? null : number(state.total)}
        actions={<Btn variant="primary" icon={FiPlus} onClick={() => setUrl({ new: "1" })}>Nueva cuenta</Btn>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o RUC…" label="Buscar cuentas" className="w-full sm:w-72" />
        <div className="w-full sm:w-48">
          <SelectInput aria-label="Filtrar por tipo" value={url.type} onChange={(e) => setUrl({ type: e.target.value })}>
            <option value="">Todos los tipos</option>
            {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </SelectInput>
        </div>
        <div className="w-full sm:w-52">
          <SelectInput aria-label="Filtrar por clasificación" value={url.cls} onChange={(e) => setUrl({ cls: e.target.value })}>
            <option value="">Todas las clasificaciones</option>
            {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{accountClassification(c).label}</option>)}
          </SelectInput>
        </div>
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {url.q && <FilterChip label={`“${url.q}”`} onRemove={() => { setSearch(""); setUrl({ q: "" }); }} />}
            {url.type && <FilterChip label={accountType(url.type)} onRemove={() => setUrl({ type: "" })} />}
            {url.cls && <FilterChip label={accountClassification(url.cls).label} onRemove={() => setUrl({ cls: "" })} />}
            <Btn variant="link" onClick={clearFilters}>Limpiar</Btn>
          </div>
        )}
      </div>

      <div className={selected ? "grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_400px]" : ""}>
        <Panel flush>
          <ErrorNote message={state.error} onRetry={load} className="m-4" />
          {state.loading ? (
            <SkeletonRows rows={8} />
          ) : state.error ? null : rows.length === 0 ? (
            hasFilters ? (
              <EmptyState title="Ninguna cuenta coincide" hint="Prueba con otro nombre o quita algún filtro." action={<Btn onClick={clearFilters}>Limpiar filtros</Btn>} />
            ) : (
              <EmptyState title="Aún no hay cuentas" hint="Crea la primera cuenta para empezar a registrar contactos, planes y oportunidades." action={<Btn variant="primary" icon={FiPlus} onClick={() => setUrl({ new: "1" })}>Nueva cuenta</Btn>} />
            )
          ) : (
            <>
              <DataTable
                caption="Cuentas"
                columns={visibleColumns}
                rows={rows}
                sort={sort}
                onSort={onSort}
                selectedId={url.sel}
                onRowClick={(r) => setUrl({ sel: r.id === url.sel ? "" : r.id }, { replace: false })}
              />
              {state.total > rows.length && (
                <p className="border-t border-fam-border px-4 py-3 text-[13px] text-fam-muted">
                  Se muestran las primeras {number(rows.length)} de {number(state.total)}. Usa la búsqueda o los filtros para acotar.
                </p>
              )}
            </>
          )}
        </Panel>

        <Inspector
          open={Boolean(selected)}
          title={selected?.account_name}
          onClose={() => setUrl({ sel: "" })}
          footer={selected && <Btn variant="primary" icon={FiExternalLink} to={`${BASE}/accounts/${selected.id}`}>Abrir cuenta</Btn>}
        >
          {selected && <AccountPeek id={selected.id} />}
        </Inspector>
      </div>

      {url.new === "1" && (
        <AccountFormModal
          onClose={() => setUrl({ new: "" })}
          onSaved={(saved) => {
            setUrl({ new: "", sel: saved?.id || "" });
            showToast(saved?.similar_names?.length ? "Cuenta creada. Hay nombres parecidos: revisa posibles duplicados." : "Cuenta creada", saved?.similar_names?.length ? "warning" : "success");
            load();
          }}
        />
      )}
    </div>
  );
}
