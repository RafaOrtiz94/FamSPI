// Paleta de comandos del CRM (Ctrl/⌘+K): encontrar cualquier cuenta, contacto, lead u oportunidad
// y saltar a las acciones frecuentes sin recorrer secciones. Navegable por teclado (↑ ↓ Enter Esc).
// Es un combobox anclado arriba, no un formulario: por eso no usa el <Modal> del sistema.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBriefcase, FiCornerDownLeft, FiPlus, FiSearch, FiTarget, FiUser, FiUsers } from "react-icons/fi";
import { fetchAccounts, fetchContacts, fetchLeads, fetchOpportunities } from "../../../core/api/crmFamApi";
import { cx } from "./kit";
import { money } from "./format";

const BASE = "/dashboard/crm-fam";

const ACTIONS = [
  { id: "a-day", label: "Ir a Mi día", to: BASE, icon: FiCornerDownLeft },
  { id: "a-lead", label: "Ir a Leads", to: `${BASE}/leads`, icon: FiUser },
  { id: "a-account", label: "Nueva cuenta", to: `${BASE}/accounts?new=1`, icon: FiPlus },
  { id: "a-opps", label: "Abrir embudo de ventas", to: `${BASE}/opportunities`, icon: FiTarget },
  { id: "a-act", label: "Ver actividades", to: `${BASE}/activities`, icon: FiCornerDownLeft },
];

const listOf = (res) => (Array.isArray(res) ? res : res?.data || []);

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQ(""); setResults([]); setActive(0); setFailed(false);
    // El foco entra al campo al abrir.
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Búsqueda con espera corta; se descarta la respuesta si la consulta ya cambió.
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) { setResults([]); setSearching(false); return undefined; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const settled = await Promise.allSettled([
        fetchAccounts({ q: term, limit: 5 }),
        fetchContacts({ q: term, limit: 5 }),
        fetchLeads({ q: term, limit: 5 }),
        fetchOpportunities({ q: term, limit: 5 }),
      ]);
      if (cancelled) return;
      const [acc, con, lead, opp] = settled.map((s) => (s.status === "fulfilled" ? listOf(s.value) : []));
      setFailed(settled.every((s) => s.status === "rejected"));
      setResults([
        ...acc.map((a) => ({ id: `acc-${a.id}`, group: "Cuentas", icon: FiBriefcase, label: a.account_name, meta: [a.ruc, a.city].filter(Boolean).join(" · "), to: `${BASE}/accounts/${a.id}` })),
        ...opp.map((o) => ({ id: `opp-${o.id}`, group: "Oportunidades", icon: FiTarget, label: o.name, meta: [o.account_name, o.stage_name, o.estimated_amount != null ? money(o.estimated_amount) : null].filter(Boolean).join(" · "), to: `${BASE}/opportunities/${o.id}` })),
        ...lead.map((l) => ({ id: `lead-${l.id}`, group: "Leads", icon: FiUser, label: l.full_name || [l.first_name, l.last_name].filter(Boolean).join(" ") || l.company_name || "Lead", meta: [l.company_name, l.city].filter(Boolean).join(" · "), to: `${BASE}/leads?q=${encodeURIComponent(term)}` })),
        ...con.map((c) => ({ id: `con-${c.id}`, group: "Contactos", icon: FiUsers, label: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" "), meta: [c.job_title, c.account_name].filter(Boolean).join(" · "), to: c.account_id ? `${BASE}/accounts/${c.account_id}?tab=contactos` : `${BASE}/contacts?q=${encodeURIComponent(term)}` })),
      ]);
      setActive(0);
      setSearching(false);
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  const term = q.trim().toLowerCase();
  const actions = useMemo(
    () => ACTIONS.filter((a) => !term || a.label.toLowerCase().includes(term)).map((a) => ({ ...a, group: "Acciones" })),
    [term],
  );
  const items = useMemo(() => [...results, ...actions], [results, actions]);

  if (!open) return null;

  const go = (item) => { if (!item) return; onClose(); navigate(item.to); };
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(items[active]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  let lastGroup = null;
  return (
    <div className="fixed inset-0 z-[40] flex items-start justify-center bg-[#101820]/50 px-4 pb-4" style={{ paddingTop: "12vh" }} role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en el CRM"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-fam-border bg-fam-raised shadow-[var(--shadow-overlay)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-fam-border px-4">
          <FiSearch className="h-4 w-4 shrink-0 text-fam-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="crm-palette-list"
            aria-activedescendant={items[active] ? `crm-palette-${items[active].id}` : undefined}
            aria-label="Buscar cuentas, contactos, leads u oportunidades"
            placeholder="Buscar cuentas, contactos, leads u oportunidades…"
            className="h-12 w-full border-0 bg-transparent text-base text-fam-text outline-none placeholder:text-fam-muted focus:outline-none focus:ring-0 focus-visible:outline-none"
          />
          <kbd className="hidden shrink-0 rounded-md border border-fam-border px-1.5 py-0.5 text-[11px] text-fam-muted sm:block">Esc</kbd>
        </div>

        <ul id="crm-palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {searching && <li className="px-3 py-2 text-sm text-fam-muted" role="status">Buscando…</li>}
          {!searching && failed && <li className="px-3 py-2 text-sm text-fam-danger" role="alert">No se pudo buscar. Revisa tu conexión.</li>}
          {!searching && !failed && term.length >= 2 && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-fam-muted">Sin coincidencias para “{q.trim()}”.</li>
          )}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <li key={item.id} role="presentation">
                {header && <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-fam-muted">{header}</p>}
                <button
                  id={`crm-palette-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                  className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left", i === active ? "bg-fam-selected" : "")}
                >
                  <Icon className="h-4 w-4 shrink-0 text-fam-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fam-text">{item.label}</span>
                    {item.meta && <span className="block truncate text-xs text-fam-muted">{item.meta}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-fam-border px-4 py-2 text-xs text-fam-muted">↑ ↓ para moverte · Enter para abrir</p>
      </div>
    </div>
  );
}
