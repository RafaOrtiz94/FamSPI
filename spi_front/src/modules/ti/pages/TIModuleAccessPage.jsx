import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getUsers } from "../../../core/api/usersApi";
import {
  getModuleCatalog,
  getUserModuleAccess,
  updateUserModuleAccess,
} from "../../../core/api/moduleAccessApi";

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

  useEffect(() => {
    const load = async () => {
      try {
        const [u, c] = await Promise.all([getUsers(), getModuleCatalog()]);
        setUsers(u || []);
        setCatalog(c || []);
      } catch (error) {
        toast.error("No se pudo cargar el workspace de modulos");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
      <h1 className="text-2xl font-bold text-slate-800">Gestor de Modulos por Usuario</h1>
      <p className="text-sm text-slate-500">
        El control por rol se mantiene; este workspace agrega una capa por usuario para activar o desactivar modulos.
      </p>

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
    </div>
  );
};

export default TIModuleAccessPage;
