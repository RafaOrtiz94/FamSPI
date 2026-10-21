// Bandeja de contactos: búsqueda y filtro por cuenta en la URL, inspector lateral con acciones.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import { deleteContact, fetchAccounts, fetchContacts } from "../../../core/api/crmFamApi";
import { useUI } from "../../../core/ui/UIContext";
import ContactFormModal from "../components/ContactFormModal";
import { ConfirmDialog } from "../ui/dialogs";
import {
  Badge, Btn, DataTable, DefList, EmptyState, ErrorNote, FilterChip, Inspector, PageHeader, Panel,
  SearchInput, SelectInput, SkeletonRows,
} from "../ui/kit";
import { Pagination } from "../ui/listParts";
import { date, number } from "../ui/format";
import { listOf, totalOf, useLoad } from "../ui/useLoad";
import { useUrlSearch, useUrlState } from "../ui/useUrlState";

const BASE = "/dashboard/crm-fam";
const LIMIT = 25;
const nameOf = (c) => c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Contacto sin nombre";

export default function ContactsPage() {
  const { showToast } = useUI();
  const [url, setUrl] = useUrlState({ q: "", account: "", page: "0", sel: "", new: "" });
  const [search, setSearch] = useUrlSearch(url.q, (q) => setUrl({ q, page: "0" }));
  const [accounts, setAccounts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const offset = Math.max(0, Number(url.page) || 0) * LIMIT;

  useEffect(() => {
    let cancelled = false;
    fetchAccounts({ limit: 500 }).then((res) => { if (!cancelled) setAccounts(listOf(res)); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const { loading, data, error, reload } = useLoad(
    () => fetchContacts({ q: url.q || undefined, account_id: url.account || undefined, limit: LIMIT, offset }),
    [url.q, url.account, offset],
    { fallback: "No se pudieron cargar los contactos." },
  );
  const rows = listOf(data);
  const total = totalOf(data);
  const selected = rows.find((r) => r.id === url.sel);
  const hasFilters = Boolean(url.q || url.account);
  const accountName = accounts.find((a) => a.id === url.account)?.account_name;
  const clearFilters = () => { setSearch(""); setUrl({ q: "", account: "", page: "0" }); };

  const columns = [
    {
      key: "name", header: "Contacto",
      render: (c) => (
        <div className="min-w-0">
          <button type="button" onClick={(e) => { e.stopPropagation(); setUrl({ sel: c.id }, { replace: false }); }} className="max-w-full truncate text-left font-medium text-fam-text hover:text-fam-action">{nameOf(c)}</button>
          {c.job_title && <div className="truncate text-[13px] text-fam-muted">{c.job_title}</div>}
        </div>
      ),
    },
    {
      key: "account_name", header: "Cuenta",
      render: (c) => (c.account_id
        ? <Link to={`${BASE}/accounts/${c.account_id}`} onClick={(e) => e.stopPropagation()} className="text-fam-action underline underline-offset-2">{c.account_name || "Abrir cuenta"}</Link>
        : <span className="text-fam-muted">Sin cuenta</span>),
    },
    { key: "email", header: "Correo", hideBelow: "md", render: (c) => (c.email ? <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} className="text-fam-action underline underline-offset-2">{c.email}</a> : <span className="text-fam-muted">—</span>) },
    { key: "phone", header: "Teléfono", hideBelow: "lg", render: (c) => (c.phone || c.mobile ? <a href={`tel:${String(c.phone || c.mobile).replace(/\s+/g, "")}`} onClick={(e) => e.stopPropagation()} className="fam-numeric text-fam-action underline underline-offset-2">{c.phone || c.mobile}</a> : <span className="text-fam-muted">—</span>) },
  ];
  const visibleColumns = selected ? columns.filter((c) => c.key !== "phone") : columns;

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        title="Contactos"
        count={loading && !data ? null : number(total)}
        actions={<Btn variant="primary" icon={FiPlus} onClick={() => setUrl({ new: "1" })}>Nuevo contacto</Btn>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, correo o cargo…" label="Buscar contactos" className="w-full sm:w-80" />
        <div className="w-full sm:w-72">
          <SelectInput aria-label="Filtrar por cuenta" value={url.account} onChange={(e) => setUrl({ account: e.target.value, page: "0" })}>
            <option value="">Todas las cuentas</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
          </SelectInput>
        </div>
        {url.q && <FilterChip label={`“${url.q}”`} onRemove={() => { setSearch(""); setUrl({ q: "", page: "0" }); }} />}
        {url.account && <FilterChip label={accountName || "Cuenta"} onRemove={() => setUrl({ account: "", page: "0" })} />}
        {hasFilters && <Btn variant="link" onClick={clearFilters}>Limpiar</Btn>}
      </div>

      <div className={selected ? "grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_380px]" : ""}>
        <Panel flush>
          <ErrorNote message={error} onRetry={reload} className="m-4" />
          {loading && !data ? (
            <SkeletonRows rows={8} />
          ) : error ? null : rows.length === 0 ? (
            hasFilters ? (
              <EmptyState title="Ningún contacto coincide" hint="Prueba con otro nombre o quita el filtro de cuenta." action={<Btn onClick={clearFilters}>Limpiar filtros</Btn>} />
            ) : (
              <EmptyState title="Aún no hay contactos" hint="Registra a las personas con las que tratas en cada cuenta." action={<Btn variant="primary" icon={FiPlus} onClick={() => setUrl({ new: "1" })}>Nuevo contacto</Btn>} />
            )
          ) : (
            <>
              <DataTable
                caption="Contactos"
                columns={visibleColumns}
                rows={rows}
                selectedId={url.sel}
                onRowClick={(c) => setUrl({ sel: c.id === url.sel ? "" : c.id }, { replace: false })}
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
              <Btn icon={FiTrash2} onClick={() => setRemoving(selected)}>Eliminar</Btn>
              <Btn variant="primary" icon={FiEdit2} onClick={() => setEditing(selected)}>Editar</Btn>
            </>
          )}
        >
          {selected && (
            <div className="space-y-4">
              {selected.is_primary_contact && <Badge tone="info">Contacto principal</Badge>}
              <DefList
                items={[
                  { label: "Cargo", value: selected.job_title },
                  { label: "Cuenta", value: selected.account_id ? <Link to={`${BASE}/accounts/${selected.account_id}`} className="text-fam-action underline underline-offset-2">{selected.account_name || "Abrir cuenta"}</Link> : null },
                  { label: "Correo", value: selected.email ? <a href={`mailto:${selected.email}`} className="break-all text-fam-action underline underline-offset-2">{selected.email}</a> : null },
                  { label: "Teléfono", value: selected.phone },
                  { label: "Móvil", value: selected.mobile },
                  { label: "Área", value: selected.department },
                  { label: "Registrado", value: date(selected.created_at) },
                  { label: "Notas", value: selected.notes ? <span className="whitespace-pre-wrap">{selected.notes}</span> : null },
                ]}
              />
            </div>
          )}
        </Inspector>
      </div>

      {(url.new === "1" || editing) && (
        <ContactFormModal
          contact={editing}
          onClose={() => { setEditing(null); setUrl({ new: "" }); }}
          onSaved={(saved) => {
            const wasNew = !editing;
            setEditing(null);
            setUrl({ new: "", ...(wasNew && saved?.id ? { sel: saved.id } : {}) });
            reload();
            showToast(wasNew ? "Contacto creado" : "Contacto actualizado", "success");
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={`Eliminar a ${nameOf(removing)}`}
          description="El contacto dejará de aparecer en la cuenta y en las búsquedas. Las actividades ya registradas se conservan."
          confirmLabel="Eliminar contacto"
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await deleteContact(removing.id);
            setRemoving(null);
            setUrl({ sel: "" });
            reload();
            showToast("Contacto eliminado", "success");
          }}
        />
      )}
    </div>
  );
}
