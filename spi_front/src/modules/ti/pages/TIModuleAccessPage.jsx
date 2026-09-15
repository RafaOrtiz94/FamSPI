import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FiUsers,
  FiGlobe,
  FiSearch,
  FiChevronDown,
  FiChevronRight,
  FiCheckCircle,
  FiXCircle,
  FiRotateCcw,
  FiSave,
  FiShield,
  FiHome,
  FiBriefcase,
  FiTool,
  FiHeart,
  FiClipboard,
  FiDollarSign,
  FiActivity,
  FiPackage,
  FiAward,
  FiBox,
  FiCpu,
  FiLayers,
  FiGrid,
  FiAlertTriangle,
  FiTruck,
  FiBookOpen,
  FiEdit3,
  FiServer,
  FiPhoneCall,
  FiLink,
  FiTrendingUp,
} from "react-icons/fi";
import { getUsers } from "../../../core/api/usersApi";
import {
  getModuleCatalog,
  getUserModuleAccess,
  updateUserModuleAccess,
  getGlobalModuleStatuses,
  updateGlobalModuleStatus,
} from "../../../core/api/moduleAccessApi";
import Modal from "../../../core/ui/components/Modal";

const STAGE_LABELS = { production: "Producción", testing: "Pruebas (whitelist)", construction: "En construcción" };
const STAGE_BADGE = {
  production: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  testing: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  construction: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};
const STAGE_ICON = { production: "✅", testing: "🔬", construction: "🚧" };

const GROUP_META = {
  inicio: { label: "Inicio", icon: FiHome },
  ti: { label: "TI", icon: FiCpu },
  comercial: { label: "Comercial", icon: FiBriefcase },
  "servicio-tecnico": { label: "Servicio Técnico", icon: FiTool },
  "talento-humano": { label: "Talento Humano", icon: FiHeart },
  auditoria: { label: "Auditoría", icon: FiClipboard },
  finanzas: { label: "Finanzas", icon: FiDollarSign },
  operaciones: { label: "Operaciones", icon: FiActivity },
  logistica: { label: "Logística", icon: FiPackage },
  calidad: { label: "Calidad", icon: FiAward },
  purchases: { label: "Compras", icon: FiBox },
  "business-case": { label: "Business Case", icon: FiLayers },
  "work-management": { label: "Work Management", icon: FiGrid },
  kickoff: { label: "Kick Off 2026", icon: FiAward },
  famdays: { label: "FamDays", icon: FiAward },
  collab: { label: "Entregas Colaboradores", icon: FiTruck },
  capacitaciones: { label: "Capacitaciones", icon: FiBookOpen },
  signatures: { label: "Firmas (FamSign)", icon: FiEdit3 },
  backoffice: { label: "Backoffice", icon: FiServer },
  "crm-fam": { label: "CRM Fam", icon: FiPhoneCall },
  "links-interes": { label: "Links de Interés", icon: FiLink },
  gerencia: { label: "Gerencia", icon: FiTrendingUp },
  otros: { label: "Otros", icon: FiGrid },
};

const getGroupKey = (mod) => {
  const firstPath = Array.isArray(mod?.path_prefixes) ? mod.path_prefixes[0] : "";
  const clean = String(firstPath || "").replace(/^\/dashboard\/?/, "");
  const root = clean.split("/")[0] || "inicio";
  return root;
};

const getGroupMeta = (key) => GROUP_META[key] || { label: key, icon: FiGrid };

const roleLabel = (role) => String(role || "").replace(/_/g, " ");

const initials = (name = "") =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

const Toggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

const TIModuleAccessPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [userId, setUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [state, setState] = useState({});
  const [initialState, setInitialState] = useState({});
  const [overrideKeys, setOverrideKeys] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState({});
  const [tab, setTab] = useState("users"); // 'users' | 'global'
  const [globalStatuses, setGlobalStatuses] = useState([]);
  const [editingModule, setEditingModule] = useState(null);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [confirmSwitchUser, setConfirmSwitchUser] = useState(null); // pending userId while unsaved changes exist

  useEffect(() => {
    const load = async () => {
      try {
        const [u, c, g] = await Promise.all([getUsers(), getModuleCatalog(), getGlobalModuleStatuses()]);
        setUsers(u || []);
        setCatalog(c || []);
        setGlobalStatuses(g || []);
      } catch (error) {
        toast.error("No se pudo cargar el workspace de módulos");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const globalStatusMap = useMemo(() => {
    const map = {};
    for (const s of globalStatuses) map[s.module_key] = s;
    return map;
  }, [globalStatuses]);

  const openEditGlobal = (mod) => {
    const current = globalStatusMap[mod.key] || { stage: "production", whitelist_emails: [] };
    setEditingModule({ module_key: mod.key, label: mod.label, stage: current.stage, whitelist_emails: current.whitelist_emails || [] });
    setWhitelistInput((current.whitelist_emails || []).join("\n"));
  };

  const saveGlobalStatus = async () => {
    if (!editingModule) return;
    setSaving(true);
    try {
      const emails = whitelistInput.split(/[\n,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
      const updated = await updateGlobalModuleStatus(editingModule.module_key, {
        stage: editingModule.stage,
        whitelist_emails: emails,
      });
      setGlobalStatuses((prev) => {
        const idx = prev.findIndex((s) => s.module_key === editingModule.module_key);
        const next = [...prev];
        if (idx >= 0) next[idx] = updated;
        else next.push(updated);
        return next;
      });
      setEditingModule(null);
      toast.success("Estado global actualizado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = useMemo(
    () => users.find((u) => String(u.id) === String(userId)) || null,
    [users, userId]
  );

  const loadUserAccess = async (selected) => {
    try {
      const rows = await getUserModuleAccess(selected);
      const next = {};
      for (const mod of catalog) next[mod.key] = true;
      const overrides = new Set();
      for (const row of rows) {
        next[row.module_key] = Boolean(row.is_enabled);
        overrides.add(row.module_key);
      }
      setState(next);
      setInitialState(next);
      setOverrideKeys(overrides);
    } catch (error) {
      toast.error("No se pudo cargar la configuración del usuario");
    }
  };

  useEffect(() => {
    const selected = Number(userId);
    if (!Number.isFinite(selected) || selected <= 0) {
      setState({});
      setInitialState({});
      setOverrideKeys(new Set());
      return;
    }
    if (catalog.length) loadUserAccess(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, catalog]);

  const hasUnsavedChanges = useMemo(() => {
    const keys = new Set([...Object.keys(state), ...Object.keys(initialState)]);
    for (const key of keys) {
      if (Boolean(state[key]) !== Boolean(initialState[key])) return true;
    }
    return false;
  }, [state, initialState]);

  const requestSelectUser = (id) => {
    if (hasUnsavedChanges && String(id) !== String(userId)) {
      setConfirmSwitchUser(id);
      return;
    }
    setUserId(id);
  };

  const confirmDiscardAndSwitch = () => {
    if (confirmSwitchUser !== null) setUserId(confirmSwitchUser);
    setConfirmSwitchUser(null);
  };

  const enabledCount = useMemo(() => Object.values(state).filter(Boolean).length, [state]);

  const groupedCatalog = useMemo(() => {
    const groups = {};
    for (const mod of catalog) {
      const key = getGroupKey(mod);
      if (!groups[key]) groups[key] = [];
      groups[key].push(mod);
    }
    return Object.entries(groups).sort(([a], [b]) => getGroupMeta(a).label.localeCompare(getGroupMeta(b).label));
  }, [catalog]);

  const filteredGroupedCatalog = useMemo(() => {
    const term = moduleSearch.trim().toLowerCase();
    if (!term) return groupedCatalog;
    return groupedCatalog
      .map(([key, mods]) => [
        key,
        mods.filter(
          (m) =>
            m.label.toLowerCase().includes(term) ||
            m.key.toLowerCase().includes(term) ||
            (m.path_prefixes || []).some((p) => p.toLowerCase().includes(term))
        ),
      ])
      .filter(([, mods]) => mods.length > 0);
  }, [groupedCatalog, moduleSearch]);

  useEffect(() => {
    const next = {};
    for (const [groupKey] of groupedCatalog) next[groupKey] = groupKey === "ti";
    setExpandedGroups(next);
  }, [groupedCatalog]);

  useEffect(() => {
    if (!moduleSearch.trim()) return;
    setExpandedGroups((prev) => {
      const next = { ...prev };
      for (const [key] of filteredGroupedCatalog) next[key] = true;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleSearch]);

  const toggleGroup = (groupKey) => setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));

  const setGroupEnabled = (mods, enabled) => {
    setState((prev) => {
      const next = { ...prev };
      for (const mod of mods) next[mod.key] = enabled;
      return next;
    });
  };

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const name = (u.fullname || u.name || u.email || "").toLowerCase();
      const role = (u.role || "").toLowerCase();
      return name.includes(term) || role.includes(term) || (u.email || "").toLowerCase().includes(term);
    });
  }, [users, userSearch]);

  const onSave = async () => {
    const selected = Number(userId);
    if (!Number.isFinite(selected) || selected <= 0) {
      toast.error("Selecciona un usuario");
      return;
    }
    setSaving(true);
    try {
      const modules = Object.entries(state).map(([module_key, is_enabled]) => ({ module_key, is_enabled }));
      await updateUserModuleAccess(selected, modules);
      setInitialState(state);
      setOverrideKeys(new Set(Object.keys(state)));
      toast.success("Configuración guardada");
    } catch (error) {
      toast.error("No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => setState(initialState);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-slate-500 dark:text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-sm">Cargando workspace de módulos…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
            <FiShield size={18} />
          </span>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 sm:text-2xl">Gestor de Módulos</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Controla el acceso por usuario y define el estado global (producción / pruebas / construcción) de cada módulo del sistema.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {[
          ["users", "Por Usuario", FiUsers],
          ["global", "Estado Global", FiGlobe],
        ].map(([k, l, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === k
                ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Icon size={14} /> {l}
          </button>
        ))}
      </div>

      {tab === "global" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define si cada módulo está en <strong>Producción</strong> (todos acceden), <strong>Pruebas</strong> (solo whitelist) o{" "}
            <strong>En construcción</strong> (nadie accede, excepto TI).
          </p>

          {editingModule && (
            <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950/40">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  Editando: <em>{editingModule.label}</em>
                </h3>
                <button onClick={() => setEditingModule(null)} className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-300">
                  ✕ Cancelar
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {["production", "testing", "construction"].map((s) => (
                  <label
                    key={s}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      editingModule.stage === s
                        ? STAGE_BADGE[s] + " border-2"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="stage"
                      value={s}
                      checked={editingModule.stage === s}
                      onChange={() => setEditingModule((v) => ({ ...v, stage: s }))}
                      className="sr-only"
                    />
                    {STAGE_ICON[s]} {STAGE_LABELS[s]}
                  </label>
                ))}
              </div>
              {editingModule.stage === "testing" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Whitelist de emails (uno por línea o separados por coma)
                  </label>
                  <textarea
                    value={whitelistInput}
                    onChange={(e) => setWhitelistInput(e.target.value)}
                    rows={4}
                    placeholder={"usuario@fam-project.com\notro@fam-project.com"}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              )}
              <button
                disabled={saving}
                onClick={saveGlobalStatus}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar estado"}
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-800/60">
              <span>Módulo</span>
              <span>Estado</span>
              <span></span>
            </div>
            {catalog.map((mod) => {
              const gs = globalStatusMap[mod.key] || { stage: "production", whitelist_emails: [] };
              return (
                <div
                  key={mod.key}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-slate-50 px-5 py-3 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{mod.label}</p>
                    <p className="font-mono text-xs text-slate-400 dark:text-slate-500">{mod.key}</p>
                    {gs.stage === "testing" && gs.whitelist_emails?.length > 0 && (
                      <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                        {gs.whitelist_emails.length} email{gs.whitelist_emails.length !== 1 ? "s" : ""} en whitelist
                      </p>
                    )}
                  </div>
                  <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${STAGE_BADGE[gs.stage]}`}>
                    {STAGE_ICON[gs.stage]} {STAGE_LABELS[gs.stage]}
                  </span>
                  <button
                    onClick={() => openEditGlobal(mod)}
                    className="whitespace-nowrap text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400"
                  >
                    Editar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          {/* User picker */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-3 dark:border-slate-800">
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar usuario o rol…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="max-h-[32rem] overflow-y-auto lg:max-h-[calc(100vh-20rem)]">
              {filteredUsers.length === 0 && (
                <p className="p-4 text-center text-xs text-slate-400">Sin resultados</p>
              )}
              {filteredUsers.map((u) => {
                const active = String(u.id) === String(userId);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => requestSelectUser(String(u.id))}
                    className={`flex w-full items-center gap-2.5 border-b border-slate-50 px-3 py-2.5 text-left transition-colors last:border-0 dark:border-slate-800 ${
                      active ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    } ${u.active === false ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {initials(u.fullname || u.name || u.email)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {u.fullname || u.name || u.email}
                      </span>
                      <span className="block truncate text-xs capitalize text-slate-400 dark:text-slate-500">
                        {roleLabel(u.role) || "sin rol"}
                        {u.active === false ? " · inactivo" : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module panel */}
          <div className="space-y-4">
            {!selectedUser ? (
              <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
                <FiUsers size={28} />
                <p className="text-sm">Selecciona un usuario para gestionar sus módulos</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                      {initials(selectedUser.fullname || selectedUser.name || selectedUser.email)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {selectedUser.fullname || selectedUser.name || selectedUser.email}
                      </p>
                      <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
                        {roleLabel(selectedUser.role) || "sin rol"}
                        {selectedUser.department_name ? ` · ${selectedUser.department_name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Módulos activos: <span className="font-semibold text-slate-800 dark:text-slate-100">{enabledCount}</span> / {catalog.length}
                  </div>
                </div>

                <div className="relative">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    placeholder="Buscar módulo por nombre, clave o ruta…"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-3">
                  {filteredGroupedCatalog.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
                      Ningún módulo coincide con la búsqueda.
                    </p>
                  )}
                  {filteredGroupedCatalog.map(([groupKey, mods]) => {
                    const enabledInGroup = mods.filter((m) => Boolean(state[m.key])).length;
                    const allEnabled = mods.length > 0 && enabledInGroup === mods.length;
                    const noneEnabled = enabledInGroup === 0;
                    const { label, icon: GroupIcon } = getGroupMeta(groupKey);
                    return (
                      <div key={groupKey} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 dark:bg-slate-800/60">
                          <button type="button" onClick={() => toggleGroup(groupKey)} className="flex items-center gap-2 text-left">
                            {expandedGroups[groupKey] ? (
                              <FiChevronDown className="text-slate-400" size={14} />
                            ) : (
                              <FiChevronRight className="text-slate-400" size={14} />
                            )}
                            <GroupIcon className="text-slate-500 dark:text-slate-400" size={15} />
                            <div>
                              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {enabledInGroup}/{mods.length} activos
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-white disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                              onClick={() => setGroupEnabled(mods, true)}
                              disabled={allEnabled}
                            >
                              Activar todo
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-white disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                              onClick={() => setGroupEnabled(mods, false)}
                              disabled={noneEnabled}
                            >
                              Desactivar todo
                            </button>
                          </div>
                        </div>
                        {expandedGroups[groupKey] ? (
                          <div className="grid gap-2 p-3 sm:grid-cols-2">
                            {mods.map((mod) => {
                              const changed = Boolean(state[mod.key]) !== Boolean(initialState[mod.key]);
                              return (
                                <div
                                  key={mod.key}
                                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${
                                    changed
                                      ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
                                      : "border-slate-200 dark:border-slate-700"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                                      {state[mod.key] ? (
                                        <FiCheckCircle className="shrink-0 text-emerald-500" size={13} />
                                      ) : (
                                        <FiXCircle className="shrink-0 text-slate-300 dark:text-slate-600" size={13} />
                                      )}
                                      <span className="truncate">{mod.label}</span>
                                      {overrideKeys.has(mod.key) && (
                                        <span
                                          title="Este usuario tiene una configuración explícita para este módulo (no usa el valor por defecto)"
                                          className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                        >
                                          personalizado
                                        </span>
                                      )}
                                    </div>
                                    <div className="truncate font-mono text-xs text-slate-400 dark:text-slate-500">{mod.key}</div>
                                    <div className="truncate text-[11px] text-slate-400 dark:text-slate-600">
                                      {(mod.path_prefixes || []).join(" | ")}
                                    </div>
                                  </div>
                                  <Toggle
                                    checked={Boolean(state[mod.key])}
                                    onChange={(v) => setState((prev) => ({ ...prev, [mod.key]: v }))}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "users" && selectedUser && (
        <div
          className={`sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur ${
            hasUnsavedChanges
              ? "border-amber-300 bg-amber-50/95 dark:border-amber-700 dark:bg-amber-950/80"
              : "border-slate-200 bg-white/95 dark:border-slate-700 dark:bg-slate-900/90"
          }`}
        >
          <div className="flex items-center gap-2 text-sm">
            {hasUnsavedChanges ? (
              <>
                <FiAlertTriangle className="text-amber-500" size={16} />
                <span className="font-medium text-amber-700 dark:text-amber-300">Tienes cambios sin guardar</span>
              </>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">Sin cambios pendientes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={discardChanges}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiRotateCcw size={14} /> Descartar
              </button>
            )}
            <button
              type="button"
              disabled={saving || !hasUnsavedChanges}
              onClick={onSave}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiSave size={14} /> {saving ? "Guardando…" : "Guardar configuración"}
            </button>
          </div>
        </div>
      )}

      <Modal
        open={confirmSwitchUser !== null}
        onClose={() => setConfirmSwitchUser(null)}
        title="Cambios sin guardar"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4 p-1">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tienes cambios sin guardar para <strong>{selectedUser?.fullname || selectedUser?.email}</strong>. Si cambias de usuario ahora, se perderán.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmSwitchUser(null)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Seguir editando
            </button>
            <button
              type="button"
              onClick={confirmDiscardAndSwitch}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Descartar y cambiar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TIModuleAccessPage;
