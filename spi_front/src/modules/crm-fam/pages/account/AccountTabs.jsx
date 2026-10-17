// Pestañas de la Cuenta 360 que listan registros relacionados: contactos, oportunidades y actividad.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiPlus } from "react-icons/fi";
import { fetchAccountTimeline, fetchContacts, fetchOpportunities } from "../../../../core/api/crmFamApi";
import { useUI } from "../../../../core/ui/UIContext";
import ContactFormModal from "../../components/ContactFormModal";
import { Badge, Btn, cx, DataTable, EmptyState, ErrorNote, Panel, SkeletonRows, sortRows, StatusBadge } from "../../ui/kit";
import { date, money } from "../../ui/format";
import { blueSheetStatus, opportunityStatus } from "../../ui/status";
import { listOf, useLoad } from "../../ui/useLoad";

const BASE = "/dashboard/crm-fam";
// ─── Contactos ───────────────────────────────────────────────────────────────
export function AccountContacts({ accountId }) {
  const { showToast } = useUI();
  const { loading, data, error, reload } = useLoad(() => fetchContacts({ account_id: accountId, limit: 200 }), [accountId]);
  const [adding, setAdding] = useState(false);
  const rows = listOf(data);

  return (
    <Panel title="Contactos" flush actions={<Btn variant="primary" size="sm" icon={FiPlus} onClick={() => setAdding(true)}>Nuevo contacto</Btn>}>
      <ErrorNote message={error} onRetry={reload} className="m-4" />
      {loading ? <SkeletonRows rows={4} /> : error ? null : rows.length === 0 ? (
        <EmptyState title="Sin contactos" hint="Registra a las personas con las que tratas en esta cuenta." action={<Btn variant="primary" icon={FiPlus} onClick={() => setAdding(true)}>Nuevo contacto</Btn>} />
      ) : (
        <DataTable
          caption="Contactos de la cuenta"
          columns={[
            { key: "full_name", header: "Nombre", render: (c) => (
              <span className="font-medium">{c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ")}{c.is_primary_contact && <Badge tone="info" className="ml-2">Principal</Badge>}</span>
            ) },
            { key: "job_title", header: "Cargo", hideBelow: "sm" },
            { key: "email", header: "Correo", render: (c) => (c.email ? <a href={`mailto:${c.email}`} className="text-fam-action underline underline-offset-2">{c.email}</a> : <span className="text-fam-muted">—</span>) },
            { key: "phone", header: "Teléfono", hideBelow: "md", render: (c) => (c.phone || c.mobile ? <a href={`tel:${c.phone || c.mobile}`} className="fam-numeric text-fam-action underline underline-offset-2">{c.phone || c.mobile}</a> : <span className="text-fam-muted">—</span>) },
          ]}
          rows={rows}
        />
      )}
      {adding && <ContactFormModal accountId={accountId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); showToast("Contacto creado", "success"); }} />}
    </Panel>
  );
}

// ─── Oportunidades ───────────────────────────────────────────────────────────
export function AccountOpportunities({ accountId }) {
  const { loading, data, error, reload } = useLoad(() => fetchOpportunities({ account_id: accountId, limit: 200 }), [accountId]);
  const [sort, setSort] = useState({ key: "estimated_close_date", dir: "asc" });
  const rows = useMemo(() => sortRows(listOf(data), sort, { estimated_amount: (r) => Number(r.estimated_amount || 0) }), [data, sort]);
  const onSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  return (
    <Panel title="Oportunidades" flush actions={<Btn size="sm" to={`${BASE}/opportunities`}>Abrir embudo</Btn>}>
      <ErrorNote message={error} onRetry={reload} className="m-4" />
      {loading ? <SkeletonRows rows={4} /> : error ? null : rows.length === 0 ? (
        <EmptyState title="Sin oportunidades" hint="Las oportunidades de esta cuenta aparecerán aquí; se crean desde un lead calificado o desde el embudo." />
      ) : (
        <DataTable
          caption="Oportunidades de la cuenta"
          sort={sort}
          onSort={onSort}
          columns={[
            { key: "name", header: "Oportunidad", sortable: true, render: (o) => (
              <div className="min-w-0">
                <Link to={`${BASE}/opportunities/${o.id}`} className="font-medium text-fam-action underline underline-offset-2">{o.name}</Link>
                <div className="fam-id text-xs text-fam-muted">{o.opportunity_code}</div>
              </div>
            ) },
            { key: "stage_name", header: "Fase", sortable: true, hideBelow: "sm" },
            { key: "status", header: "Estado", render: (o) => <StatusBadge of={opportunityStatus} value={o.status} /> },
            { key: "blue_sheet_status", header: "Blue Sheet", hideBelow: "lg", render: (o) => (o.blue_sheet_status ? <StatusBadge of={blueSheetStatus} value={o.blue_sheet_status} /> : <span className="text-fam-muted">—</span>) },
            { key: "estimated_close_date", header: "Cierre", sortable: true, hideBelow: "md", render: (o) => <span className="fam-numeric">{date(o.estimated_close_date)}</span> },
            { key: "estimated_amount", header: "Monto", align: "right", sortable: true, render: (o) => money(o.status === "won" && o.won_amount != null ? o.won_amount : o.estimated_amount) },
          ]}
          rows={rows}
        />
      )}
    </Panel>
  );
}

// ─── Línea de tiempo unificada ───────────────────────────────────────────────
const KINDS = {
  lead: "Lead", opportunity: "Oportunidad", activity: "Actividad", note: "Nota",
  document: "Documento", business_case: "Business Case", purchase: "Compra privada",
};

function normalizeTimeline(raw) {
  if (!raw || typeof raw !== "object") return [];
  const ev = [];
  (raw.leads || []).forEach((l) => ev.push({ id: `l-${l.id}`, kind: "lead", date: l.created_at, title: (l.full_name || "").trim() || l.lead_code || "Lead", meta: l.status }));
  (raw.opportunities || []).forEach((o) => ev.push({ id: `o-${o.id}`, kind: "opportunity", date: o.created_at, title: o.name || o.opportunity_code, meta: [opportunityStatus(o.status).label, o.estimated_amount != null ? money(o.estimated_amount) : null].filter(Boolean).join(" · "), to: `${BASE}/opportunities/${o.id}` }));
  (raw.activities || []).forEach((a) => ev.push({ id: `a-${a.id}`, kind: "activity", date: a.scheduled_at || a.completed_at, title: a.subject || a.activity_type, meta: a.status }));
  (raw.notes || []).forEach((n) => ev.push({ id: `n-${n.id}`, kind: "note", date: n.created_at, title: n.note_text ? (n.note_text.length > 140 ? `${n.note_text.slice(0, 140)}…` : n.note_text) : "Nota" }));
  (raw.documents || []).forEach((d) => ev.push({ id: `d-${d.id}`, kind: "document", date: d.created_at, title: d.document_name || "Documento", meta: d.document_type, href: d.drive_file_url }));
  (raw.business_cases || []).forEach((b) => ev.push({ id: `b-${b.id}`, kind: "business_case", date: b.updated_at || b.created_at, title: b.process_code ? `Proceso ${b.process_code}` : "Business Case", meta: [b.canonical_state, b.contract_object].filter(Boolean).join(" · ") }));
  (raw.private_purchases || []).forEach((p) => ev.push({ id: `p-${p.id}`, kind: "purchase", date: p.updated_at || p.created_at, title: "Compra privada", meta: p.status }));
  return ev.filter((e) => e.date).sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function AccountTimeline({ accountId, limit, title = "Actividad de la cuenta" }) {
  const { loading, data, error, reload } = useLoad(() => fetchAccountTimeline(accountId), [accountId]);
  const [kind, setKind] = useState("");
  const all = useMemo(() => normalizeTimeline(data), [data]);
  const present = useMemo(() => [...new Set(all.map((e) => e.kind))], [all]);
  const events = (kind ? all.filter((e) => e.kind === kind) : all).slice(0, limit || undefined);

  return (
    <Panel title={title} hint={limit ? undefined : "Leads, oportunidades, actividades, documentos y compras vinculadas (últimos 10 de cada tipo)"}>
      <ErrorNote message={error} onRetry={reload} className="mb-4" />
      {!limit && present.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
          {["", ...present].map((k) => (
            <button
              key={k || "all"}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cx("rounded-full border px-3 py-1 text-[13px] transition-colors duration-100", kind === k ? "border-fam-action bg-fam-selected font-medium text-fam-text" : "border-fam-border text-fam-muted hover:text-fam-text")}
            >
              {k ? KINDS[k] : "Todo"}
            </button>
          ))}
        </div>
      )}
      {loading ? <SkeletonRows rows={4} /> : error ? null : events.length === 0 ? (
        <p className="text-sm text-fam-muted">Todavía no hay movimientos registrados en esta cuenta.</p>
      ) : (
        <ol className="relative ml-1.5 space-y-4 border-l border-fam-border pl-5">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-fam-control ring-4 ring-fam-surface" aria-hidden="true" />
              <p className="text-xs text-fam-muted"><span className="font-medium text-fam-text">{KINDS[e.kind]}</span> · <span className="fam-numeric">{date(e.date)}</span></p>
              <p className="text-sm text-fam-text">
                {e.to ? <Link to={e.to} className="text-fam-action underline underline-offset-2">{e.title}</Link>
                  : e.href ? <a href={e.href} target="_blank" rel="noopener noreferrer" className="text-fam-action underline underline-offset-2">{e.title}</a>
                  : e.title}
              </p>
              {e.meta && <p className="text-[13px] text-fam-muted">{e.meta}</p>}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
