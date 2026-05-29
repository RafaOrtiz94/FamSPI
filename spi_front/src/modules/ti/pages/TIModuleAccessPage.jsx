import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getUsers } from "../../../core/api/usersApi";
import {
  getModuleCatalog,
  getUserModuleAccess,
  updateUserModuleAccess,
  getGlobalModuleStatuses,
  updateGlobalModuleStatus,
} from "../../../core/api/moduleAccessApi";

const STAGE_LABELS = { production: 'Producción', testing: 'Pruebas (whitelist)', construction: 'En construcción' };
const STAGE_COLORS = {
  production:   'bg-green-100 text-green-700 border-green-200',
  testing:      'bg-amber-100 text-amber-700 border-amber-200',
  construction: 'bg-slate-100 text-slate-600 border-slate-200',
};

const getGroupKey = (mod) => {
  const firstPath = Array.isArray(mod?.path_prefixes) ? mod.path_prefixes[0] : "";
  const clean = String(firstPath || "").replace("/dashboard/", "");
  const root = clean.split("/")[0] || "otros";
  return root;
};

const getGroupLabel = (key) => {
  const map = {
    ti: "TI",
    comercial: "Comercial",
    "servicio-tecnico": "Servicio Técnico",
    "talento-humano": "Talento Humano",
    auditoria: "Auditoría",
    finanzas: "Finanzas",
    operaciones: "Operaciones",
    logistica: "Logística",
    calidad: "Calidad",
    purchases: "Compras",
    business: "Business Case",
    inicio: "Inicio",
    otros: "Otros",
  };
  return map[key] || key;
};

const TIModuleAccessPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [userId, setUserId] = useState("");
  const [state, setState] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [tab, setTab] = useState('users'); // 'users' | 'global'
  const [globalStatuses, setGlobalStatuses] = useState([]);
  const [editingModule, setEditingModule] = useState(null); // { module_key, stage, whitelist_emails }
  const [whitelistInput, setWhitelistInput] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [u, c, g] = await Promise.all([getUsers(), getModuleCatalog(), getGlobalModuleStatuses()]);
        setUsers(u || []);
        setCatalog(c || []);
        setGlobalStatuses(g || []);
      } catch (error) {
        toast.error("No se pudo cargar el workspace de modulos");
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
    const current = globalStatusMap[mod.key] || { stage: 'production', whitelist_emails: [] };
    setEditingModule({ module_key: mod.key, label: mod.label, stage: current.stage, whitelist_emails: current.whitelist_emails || [] });
    setWhitelistInput((current.whitelist_emails || []).join('\n'));
  };

  const saveGlobalStatus = async () => {
    if (!editingModule) return;
    setSaving(true);
    try {
      const emails = whitelistInput.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
      const updated = await updateGlobalModuleStatus(editingModule.module_key, {
        stage: editingModule.stage,
        whitelist_emails: emails,
      });
      setGlobalStatuses(prev => {
        const idx = prev.findIndex(s => s.module_key === editingModule.module_key);
        const next = [...prev];
        if (idx >= 0) next[idx] = updated;
        else next.push(updated);
        return next;
      });
      setEditingModule(null);
      toast.success('Estado global actualizado');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const selected = Number(userId);
    if (!Number.isFinite(selected) || selected <= 0) {
      setState({});
      return;
    }
    const loadUserAccess = async () => {
      try {
        const rows = await getUserModuleAccess(selected);
        const next = {};
        for (const mod of catalog) next[mod.key] = true;
        for (const row of rows) next[row.module_key] = Boolean(row.is_enabled);
        setState(next);
      } catch (error) {
        toast.error("No se pudo cargar la configuracion del usuario");
      }
    };
    if (catalog.length) loadUserAccess();
  }, [userId, catalog]);

  const enabledCount = useMemo(
    () => Object.values(state).filter(Boolean).length,
    [state]
  );
  const groupedCatalog = useMemo(() => {
    const groups = {};
    for (const mod of catalog) {
      const key = getGroupKey(mod);
      if (!groups[key]) groups[key] = [];
      groups[key].push(mod);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  useEffect(() => {
    const next = {};
    for (const [groupKey] of groupedCatalog) next[groupKey] = groupKey === "ti";
    setExpandedGroups(next);
  }, [groupedCatalog]);

  const toggleGroup = (groupKey) =>
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));

  const setGroupEnabled = (mods, enabled) => {
    setState((prev) => {
      const next = { ...prev };
      for (const mod of mods) next[mod.key] = enabled;
      return next;
    });
  };

  const onSave = async () => {
    const selected = Number(userId);
    if (!Number.isFinite(selected) || selected <= 0) {
      toast.error("Selecciona un usuario");
      return;
    }
    setSaving(true);
    try {
      const modules = Object.entries(state).map(([module_key, is_enabled]) => ({
        module_key,
        is_enabled,
      }));
      await updateUserModuleAccess(selected, modules);
      toast.success("Configuracion guardada");
    } catch (error) {
      toast.error("No se pudo guardar la configuracion");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Cargando workspace de modulos...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Gestor de Módulos</h1>
      <p className="text-sm text-slate-500">
        Controla el acceso por usuario y gestiona el estado global de cada módulo del sistema.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {[['users', 'Por Usuario'], ['global', 'Estado Global']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'global' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Define si cada módulo está en <strong>Producción</strong> (todos acceden), <strong>Pruebas</strong> (solo whitelist) o <strong>En construcción</strong> (nadie accede, excepto TI).
          </p>

          {/* Edit panel */}
          {editingModule && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-blue-900 text-sm">Editando: <em>{editingModule.label}</em></h3>
                <button onClick={() => setEditingModule(null)} className="text-xs text-blue-500 hover:text-blue-700">✕ Cancelar</button>
              </div>
              <div className="flex gap-3 flex-wrap">
                {['production', 'testing', 'construction'].map(s => (
                  <label key={s} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm font-medium transition-colors ${
                    editingModule.stage === s
                      ? STAGE_COLORS[s] + ' border-2'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}>
                    <input type="radio" name="stage" value={s} checked={editingModule.stage === s}
                      onChange={() => setEditingModule(v => ({ ...v, stage: s }))} className="sr-only" />
                    {s === 'production' ? '✅' : s === 'testing' ? '🔬' : '🚧'} {STAGE_LABELS[s]}
                  </label>
                ))}
              </div>
              {editingModule.stage === 'testing' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Whitelist de emails (uno por línea o separados por coma)</label>
                  <textarea value={whitelistInput} onChange={e => setWhitelistInput(e.target.value)}
                    rows={4} placeholder="usuario@fam-project.com&#10;otro@fam-project.com"
                    className="w-full text-xs rounded-xl border border-slate-200 bg-white p-3 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              )}
              <button disabled={saving} onClick={saveGlobalStatus}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar estado'}
              </button>
            </div>
          )}

          {/* Module list */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 bg-slate-50 border-b text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>Módulo</span>
              <span>Estado</span>
              <span></span>
            </div>
            {catalog.map(mod => {
              const gs = globalStatusMap[mod.key] || { stage: 'production', whitelist_emails: [] };
              return (
                <div key={mod.key} className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 items-center border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{mod.label}</p>
                    <p className="text-xs text-slate-400 font-mono">{mod.key}</p>
                    {gs.stage === 'testing' && gs.whitelist_emails?.length > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">{gs.whitelist_emails.length} email{gs.whitelist_emails.length !== 1 ? 's' : ''} en whitelist</p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STAGE_COLORS[gs.stage]}`}>
                    {gs.stage === 'production' ? '✅' : gs.stage === 'testing' ? '🔬' : '🚧'} {STAGE_LABELS[gs.stage]}
                  </span>
                  <button onClick={() => openEditGlobal(mod)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap">
                    Editar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'users' && (
      <>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">Usuario</label>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 p-2"
        >
          <option value="">Selecciona usuario</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullname || u.name || u.email} ({u.role})
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm text-slate-600">
          Modulos activos: <span className="font-semibold">{enabledCount}</span> / {catalog.length}
        </div>
        <div className="space-y-3">
          {groupedCatalog.map(([groupKey, mods]) => {
            const enabledInGroup = mods.filter((m) => Boolean(state[m.key])).length;
            const allEnabled = mods.length > 0 && enabledInGroup === mods.length;
            return (
              <div key={groupKey} className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between gap-3 p-3 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupKey)}
                    className="text-left"
                  >
                    <div className="font-semibold text-slate-800">{getGroupLabel(groupKey)}</div>
                    <div className="text-xs text-slate-500">
                      {enabledInGroup}/{mods.length} componentes activos
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      onClick={() => setGroupEnabled(mods, true)}
                    >
                      Activar todo
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      onClick={() => setGroupEnabled(mods, false)}
                    >
                      Desactivar todo
                    </button>
                    <input
                      type="checkbox"
                      checked={allEnabled}
                      onChange={(e) => setGroupEnabled(mods, e.target.checked)}
                    />
                  </div>
                </div>
                {expandedGroups[groupKey] ? (
                  <div className="grid gap-2 p-3 sm:grid-cols-2">
                    {mods.map((mod) => (
                      <label key={mod.key} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                        <div>
                          <div className="font-medium text-slate-800">{mod.label}</div>
                          <div className="text-xs text-slate-500">{mod.key}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {(mod.path_prefixes || []).join(" | ")}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(state[mod.key])}
                          onChange={(e) => setState((prev) => ({ ...prev, [mod.key]: e.target.checked }))}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
      >
        {saving ? "Guardando..." : "Guardar configuracion"}
      </button>
      </>
      )}
    </div>
  );
};

export default TIModuleAccessPage;
