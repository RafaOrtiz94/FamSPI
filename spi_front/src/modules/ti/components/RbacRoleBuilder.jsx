import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiCopy, FiEdit2, FiEye, FiPlus, FiTrash2 } from "react-icons/fi";
import {
  archiveRbacRole,
  createRbacRole,
  getRbacPermissions,
  getRbacRole,
  getRbacRoles,
  updateRbacRole,
} from "../../../core/api/rbacAdminApi";

const CUSTOM_PREFIX = "custom_";
// Permisos de administracion del propio RBAC: el servidor no deja delegarlos, asi que ni se ofrecen.
const RESERVED = /^(rbac|module_access)\./;

const fieldClass =
  "h-10 w-full rounded-lg border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action)] disabled:opacity-70";
const primaryButton =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--action)] px-4 text-sm font-medium text-[var(--on-action)] hover:bg-[var(--action-hover)] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border-control)] px-4 text-sm text-[var(--text)] hover:bg-[var(--surface-subtle)] disabled:opacity-60";
const rowButton =
  "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-[var(--text)] hover:bg-[var(--surface-subtle)] disabled:opacity-60";

const areaOf = (permission) => String(permission.resource || permission.key).split(/[/.]/)[0] || "otros";
const slug = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

function GroupCheckbox({ checked, indeterminate, onChange, id, label, disabled }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium text-[var(--text)]">
      <input ref={ref} id={id} type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="h-4 w-4" />
      {label}
    </label>
  );
}

export default function RbacRoleBuilder({ onChanged }) {
  const [roles, setRoles] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState(null); // null | "new" | "edit" | "view"
  const [current, setCurrent] = useState(null); // rol abierto (edit | view)
  const [form, setForm] = useState({ label: "", key: "", reason: "", cloneFrom: "" });
  const [selected, setSelected] = useState(new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const headingRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    Promise.all([getRbacRoles(), getRbacPermissions({ limit: 1000 })])
      .then(([r, p]) => { if (!cancelled) { setRoles(r); setPermissions(p.filter((item) => !RESERVED.test(item.key))); } })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => { if (mode && headingRef.current) headingRef.current.focus(); }, [mode, current]);

  const groups = useMemo(() => {
    const text = query.trim().toLowerCase();
    const map = new Map();
    permissions
      .filter((permission) => !text || permission.key.toLowerCase().includes(text))
      .forEach((permission) => {
        const area = areaOf(permission);
        if (!map.has(area)) map.set(area, []);
        map.get(area).push(permission);
      });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions, query]);

  const readOnly = mode === "view";
  const technicalKey = `${CUSTOM_PREFIX}${slug(form.key || form.label)}`;

  const close = () => { setMode(null); setCurrent(null); setQuery(""); };
  const refresh = () => { setReloadKey((key) => key + 1); if (onChanged) onChanged(); };

  const openNew = () => {
    setForm({ label: "", key: "", reason: "", cloneFrom: "" });
    setSelected(new Set());
    setCurrent(null);
    setMode("new");
  };

  const openRole = async (role, nextMode) => {
    if (busy) return;
    setBusy(true);
    try {
      const detail = await getRbacRole(role.id);
      setCurrent(detail);
      setForm({ label: detail.label, key: detail.key, reason: "", cloneFrom: "" });
      setSelected(new Set(detail.permissions.filter((key) => !RESERVED.test(key))));
      setMode(nextMode);
    } catch {
      toast.error("No se pudo abrir el rol.");
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (role) => {
    if (busy) return;
    setBusy(true);
    try {
      const detail = await getRbacRole(role.id);
      setCurrent(null);
      setForm({ label: `${detail.label} (copia)`, key: "", reason: `Copia de ${detail.key}`, cloneFrom: String(detail.id) });
      setSelected(new Set(detail.permissions.filter((key) => !RESERVED.test(key))));
      setMode("new");
    } catch {
      toast.error("No se pudo copiar el rol.");
    } finally {
      setBusy(false);
    }
  };

  const copyPermissionsFrom = async (roleId) => {
    setForm((previous) => ({ ...previous, cloneFrom: roleId }));
    if (!roleId) return;
    try {
      const detail = await getRbacRole(roleId);
      setSelected(new Set(detail.permissions.filter((key) => !RESERVED.test(key))));
    } catch {
      toast.error("No se pudieron copiar los permisos.");
    }
  };

  const toggle = (key) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleGroup = (items, on) => setSelected((previous) => {
    const next = new Set(previous);
    items.forEach((item) => (on ? next.add(item.key) : next.delete(item.key)));
    return next;
  });

  const validation = () => {
    if (String(form.label).trim().length < 2) return "Escribe el nombre del rol.";
    if (mode === "new" && technicalKey.length <= CUSTOM_PREFIX.length + 1) return "El nombre técnico necesita al menos 2 caracteres.";
    if (selected.size === 0) return "Elige al menos un permiso.";
    if (String(form.reason).trim().length < 5) return "Indica el motivo (mínimo 5 caracteres).";
    return null;
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy || readOnly) return;
    const problem = validation();
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    try {
      const payload = { label: form.label.trim(), permissions: [...selected], reason: form.reason.trim() };
      if (mode === "new") await createRbacRole({ ...payload, key: technicalKey });
      else await updateRbacRole(current.id, payload);
      toast.success(mode === "new" ? "Rol creado." : "Rol actualizado.");
      close();
      refresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo guardar el rol.");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (role) => {
    if (busy) return;
    const reason = window.prompt(`Motivo para archivar el rol «${role.key}». Dejará de tener efecto y no se podrá asignar:`);
    if (reason === null) return;
    if (reason.trim().length < 5) { toast.error("Indica un motivo de al menos 5 caracteres."); return; }
    setBusy(true);
    try {
      await archiveRbacRole(role.id, reason.trim());
      toast.success("Rol archivado.");
      refresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo archivar el rol.");
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
        <span>No se pudieron cargar los roles.</span>
        <button type="button" className="h-9 rounded-lg border border-[var(--danger-text)] px-3" onClick={() => setReloadKey((key) => key + 1)}>Reintentar</button>
      </div>
    );
  }
  if (!roles) return <p className="py-6 text-sm text-[var(--text-secondary)]" role="status">Cargando roles…</p>;

  const sorted = [...roles].sort((a, b) => Number(a.is_system) - Number(b.is_system) || a.key.localeCompare(b.key));

  return (
    <div className="space-y-6">
      <section aria-labelledby="rbac-roles-title" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="rbac-roles-title" className="text-base font-semibold text-[var(--text)]">Roles</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
              Los roles del sistema vienen del código y no se editan: puedes verlos o duplicarlos. Los roles personalizados los creas tú, eliges sus permisos y
              solo tienen efecto en las áreas donde el control central está activo.
            </p>
          </div>
          <button type="button" className={primaryButton} onClick={openNew} disabled={busy}><FiPlus aria-hidden="true" /> Nuevo rol</button>
        </div>

        <div className="relative mt-4 overflow-x-auto" role="region" aria-label="Roles, desplazable" tabIndex={0}>
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Roles del catálogo</caption>
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--text-secondary)]">
                <th scope="col" className="px-3 py-2 font-medium">Rol</th>
                <th scope="col" className="px-3 py-2 font-medium">Tipo</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Permisos</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Usuarios</th>
                <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((role) => (
                <tr key={role.id} className="min-h-[48px] border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)]">
                  <td className="px-3 py-2 text-[var(--text)]">
                    <span className="font-medium">{role.is_system ? role.key : role.label}</span>
                    {!role.is_system && <span className="block text-xs text-[var(--text-secondary)]">{role.key}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs ${role.is_system ? "bg-[var(--surface-subtle)] text-[var(--text-secondary)]" : "bg-[var(--info-bg)] text-[var(--info-text)]"}`}>
                      {role.is_system ? "Sistema" : "Personalizado"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">{role.permissions}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">{role.users}</td>
                  <td className="px-3 py-1">
                    <div className="flex flex-wrap justify-end gap-1">
                      {role.is_system ? (
                        <>
                          <button type="button" className={rowButton} disabled={busy} onClick={() => openRole(role, "view")} aria-label={`Ver permisos de ${role.key}`}><FiEye aria-hidden="true" /> Ver</button>
                          <button type="button" className={rowButton} disabled={busy} onClick={() => duplicate(role)} aria-label={`Duplicar ${role.key}`}><FiCopy aria-hidden="true" /> Duplicar</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className={rowButton} disabled={busy} onClick={() => openRole(role, "edit")} aria-label={`Editar ${role.label}`}><FiEdit2 aria-hidden="true" /> Editar</button>
                          <button type="button" className={`${rowButton} text-[var(--danger-text)]`} disabled={busy} onClick={() => archive(role)} aria-label={`Archivar ${role.label}`}><FiTrash2 aria-hidden="true" /> Archivar</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {mode && (
        <form onSubmit={save} aria-labelledby="rbac-builder-title" className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="rbac-builder-title" ref={headingRef} tabIndex={-1} className="text-base font-semibold text-[var(--text)] focus:outline-none">
              {mode === "new" ? "Nuevo rol" : mode === "edit" ? `Editar ${current?.label}` : `Permisos de ${current?.key} (solo lectura)`}
            </h2>
            <button type="button" className={secondaryButton} onClick={close}>{readOnly ? "Cerrar" : "Cancelar"}</button>
          </div>

          {readOnly && (
            <p className="rounded-lg bg-[var(--info-bg)] p-3 text-sm text-[var(--info-text)]" role="note">
              Este rol viene del código. Para uno parecido con otros permisos, usa Duplicar en la lista.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-[13px] text-[var(--text-secondary)]" htmlFor="role-label">Nombre del rol</label>
              <input id="role-label" required={!readOnly} disabled={readOnly} className={fieldClass} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} aria-describedby="role-key-help" />
              <p id="role-key-help" className="mt-1 text-xs text-[var(--text-secondary)]">
                {mode === "new" ? <>Nombre técnico: <code>{technicalKey}</code>. No se puede cambiar después.</> : <>Nombre técnico: <code>{current?.key}</code></>}
              </p>
            </div>
            {mode === "new" && (
              <div>
                <label className="block text-[13px] text-[var(--text-secondary)]" htmlFor="role-clone">Copiar permisos de (opcional)</label>
                <select id="role-clone" className={fieldClass} value={form.cloneFrom} onChange={(event) => copyPermissionsFrom(event.target.value)}>
                  <option value="">Empezar sin permisos</option>
                  {sorted.map((role) => <option key={role.id} value={role.id}>{role.is_system ? role.key : role.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Permisos</h3>
                <p className="text-xs text-[var(--text-secondary)]" role="status" aria-live="polite">{selected.size} elegidos de {permissions.length}</p>
              </div>
              <div className="w-full md:w-72">
                <label className="block text-[13px] text-[var(--text-secondary)]" htmlFor="role-search">Buscar permiso</label>
                <input id="role-search" className={fieldClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej. viaticos, clients" />
              </div>
            </div>

            <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border border-[var(--border)] p-2" role="region" aria-label="Permisos agrupados por parte del sistema, desplazable" tabIndex={0}>
              {groups.length === 0 && <p className="p-3 text-sm text-[var(--text-secondary)]">Sin resultados.</p>}
              {groups.map(([area, items]) => {
                const chosen = items.filter((item) => selected.has(item.key)).length;
                return (
                  <details key={area} open={Boolean(query) || chosen > 0} className="rounded-lg border border-[var(--border)]">
                    <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-3 text-sm font-medium text-[var(--text)]">
                      <span>{area}</span>
                      <span className="text-xs font-normal text-[var(--text-secondary)]">{chosen} de {items.length}</span>
                    </summary>
                    <div className="space-y-1 border-t border-[var(--border)] px-3 py-2">
                      {!readOnly && (
                        <GroupCheckbox
                          id={`group-${area}`}
                          label={`Todo ${area}`}
                          checked={chosen === items.length}
                          indeterminate={chosen > 0 && chosen < items.length}
                          onChange={(event) => toggleGroup(items, event.target.checked)}
                        />
                      )}
                      {items.map((item) => (
                        <label key={item.key} htmlFor={`perm-${item.key}`} className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
                          <input id={`perm-${item.key}`} type="checkbox" className="h-4 w-4 shrink-0" checked={selected.has(item.key)} disabled={readOnly} onChange={() => toggle(item.key)} />
                          <span className="break-all">{item.key}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>

          {!readOnly && (
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <label className="block text-[13px] text-[var(--text-secondary)]" htmlFor="role-reason">Motivo (obligatorio, queda en la auditoría)</label>
                <input id="role-reason" required minLength={5} className={fieldClass} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
              </div>
              <button type="submit" className={primaryButton} disabled={busy}>{busy ? "Guardando…" : mode === "new" ? "Crear rol" : "Guardar cambios"}</button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export { areaOf, slug };
