// Estructura del módulo CRM. La navegación global de FamSPI es la navbar superior (DESIGN.md §3.1,
// que prohíbe una barra lateral): aquí solo van las secciones del módulo, en horizontal, ordenadas
// por el flujo comercial, con contadores reales y la búsqueda global (Ctrl/⌘+K).
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FiChevronDown, FiSearch } from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { fetchActivities, fetchLeads } from "../../../core/api/crmFamApi";
import CommandPalette from "../ui/CommandPalette";
import { cx, Menu } from "../ui/kit";
import { isOpenActivity } from "../ui/status";

const BASE = "/dashboard/crm-fam";
const ADMIN_ROLES = ["jefe_ti", "jefe_de_ti", "admin", "administrador"];
const CAMPAIGN_ROLES = ["jefe_comercial", "gerencia", "gerencia_general", "gerente_general", "director", "gerente", ...ADMIN_ROLES];

// Trabajo diario (siempre visibles desde escritorio).
const PRIMARY = [
  { key: "day", label: "Mi día", path: BASE, exact: true },
  { key: "leads", label: "Leads", path: `${BASE}/leads` },
  { key: "opps", label: "Embudo", path: `${BASE}/opportunities` },
  { key: "accounts", label: "Cuentas", path: `${BASE}/accounts` },
  { key: "contacts", label: "Contactos", path: `${BASE}/contacts` },
  { key: "activities", label: "Actividades", path: `${BASE}/activities` },
];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

function SectionLink({ item, count, onNavigate }) {
  return (
    <NavLink
      to={item.path}
      end={item.exact}
      onClick={onNavigate}
      className={({ isActive }) => cx(
        "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm transition-colors duration-100",
        isActive ? "border-fam-action font-semibold text-fam-text" : "border-transparent text-fam-muted hover:text-fam-text",
      )}
    >
      {item.label}
      {count > 0 && (
        <span className="fam-numeric rounded-md bg-fam-warning-bg px-1.5 text-xs font-medium text-fam-warning" title={item.countHint}>
          {count}<span className="sr-only"> {item.countHint}</span>
        </span>
      )}
    </NavLink>
  );
}

export default function CrmShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [counts, setCounts] = useState({ leads: 0, activities: 0 });

  const roles = String(user?.role || "").split(",").map((r) => r.trim().toLowerCase());
  const secondary = [
    ...(roles.some((r) => CAMPAIGN_ROLES.includes(r)) ? [{ key: "campaigns", label: "Campañas", path: `${BASE}/campaigns` }] : []),
    { key: "reports", label: "Reportes", path: `${BASE}/reports` },
    ...(roles.some((r) => ADMIN_ROLES.includes(r)) ? [{ key: "settings", label: "Configuración", path: `${BASE}/settings` }] : []),
  ];
  const all = [...PRIMARY, ...secondary];
  const current = [...all].reverse().find((s) => (s.exact ? location.pathname === s.path : location.pathname.startsWith(s.path))) || PRIMARY[0];
  const section = location.pathname.split("/")[3] || "";

  // Contadores reales de lo que espera acción del usuario. Si fallan, simplemente no se muestran.
  const loadCounts = useCallback(async () => {
    if (!user?.id) return;
    const [leads, acts] = await Promise.allSettled([
      fetchLeads({ status: "new", owner_user_id: user.id, limit: 1 }),
      fetchActivities({ owner_user_id: user.id, limit: 200 }),
    ]);
    const now = Date.now();
    setCounts({
      leads: leads.status === "fulfilled" ? Number(leads.value?.total || 0) : 0,
      activities: acts.status === "fulfilled"
        ? (Array.isArray(acts.value) ? acts.value : []).filter((a) => isOpenActivity(a) && a.scheduled_at && new Date(a.scheduled_at).getTime() < now).length
        : 0,
    });
  }, [user?.id]);

  useEffect(() => { loadCounts(); }, [loadCounts, section]);
  useEffect(() => { setSectionsOpen(false); }, [location.pathname]);

  // Atajo global de búsqueda.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const countFor = (key) => (key === "leads" ? counts.leads : key === "activities" ? counts.activities : 0);
  const withHint = (item) => ({
    ...item,
    countHint: item.key === "leads" ? "leads nuevos sin atender" : item.key === "activities" ? "actividades vencidas" : "",
  });

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-6 flex items-center gap-3 border-b border-fam-border">
        {/* Escritorio: secciones en línea */}
        <nav aria-label="Secciones del CRM" className="hidden min-w-0 items-center lg:flex">
          {PRIMARY.map((item) => <SectionLink key={item.key} item={withHint(item)} count={countFor(item.key)} />)}
          <span className="mx-2 hidden h-5 w-px bg-fam-border xl:block" aria-hidden="true" />
          <span className="hidden xl:flex">
            {secondary.map((item) => <SectionLink key={item.key} item={item} count={0} />)}
          </span>
        </nav>
        {/* Entre 1024 y 1279px el grupo secundario se agrupa en «Más» en vez de producir scroll horizontal */}
        <div className="hidden lg:block xl:hidden">
          <NavMore items={secondary} active={secondary.some((s) => s.key === current.key)} />
        </div>

        {/* Móvil y tablet: sección actual como desplegable */}
        <div className="relative lg:hidden">
          <button
            type="button"
            aria-expanded={sectionsOpen}
            aria-controls="crm-sections"
            onClick={() => setSectionsOpen((v) => !v)}
            className="-mb-px inline-flex min-h-[44px] items-center gap-2 border-b-[3px] border-fam-action px-1 text-sm font-semibold text-fam-text"
          >
            {current.label}
            <FiChevronDown className={cx("h-4 w-4 transition-transform duration-100", sectionsOpen && "rotate-180")} aria-hidden="true" />
          </button>
          {sectionsOpen && (
            <nav id="crm-sections" aria-label="Secciones del CRM" className="absolute left-0 z-20 mt-1 w-64 rounded-xl border border-fam-border bg-fam-raised p-1 shadow-[var(--shadow-popover)]">
              {all.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  end={item.exact}
                  className={({ isActive }) => cx("flex min-h-[44px] items-center justify-between rounded-lg px-3 text-sm", isActive ? "bg-fam-selected font-semibold text-fam-text" : "text-fam-text hover:bg-fam-subtle")}
                >
                  {item.label}
                  {countFor(item.key) > 0 && <span className="fam-numeric rounded-md bg-fam-warning-bg px-1.5 text-xs font-medium text-fam-warning">{countFor(item.key)}</span>}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mb-1.5 ml-auto inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-fam-border bg-fam-surface px-3 text-sm text-fam-muted transition-colors duration-100 hover:border-fam-control hover:text-fam-text"
        >
          <FiSearch className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Buscar en el CRM</span>
          <span className="sm:hidden">Buscar</span>
          <kbd className="ml-2 hidden rounded border border-fam-border px-1.5 text-[11px] md:inline">{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>
      </div>

      <Outlet context={{ refreshCounts: loadCounts, openSearch: () => setPaletteOpen(true) }} />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function NavMore({ items, active }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <span className={cx("-mb-px inline-flex border-b-[3px]", active ? "border-fam-action" : "border-transparent")}>
      <Menu
        label="Más"
        variant="ghost"
        size="sm"
        align="left"
        items={items.map((it) => ({
          label: it.label,
          disabled: location.pathname.startsWith(it.path),
          onSelect: () => navigate(it.path),
        }))}
      />
    </span>
  );
}
