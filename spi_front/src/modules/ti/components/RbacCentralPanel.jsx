import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiInfo, FiShield, FiTrash2 } from "react-icons/fi";
import RbacRoleBuilder from "./RbacRoleBuilder";
import {
  assignRbacRole,
  getRbacPermissions,
  getRbacAudit,
  getRbacMembers,
  getRbacMatrix,
  getRbacRoles,
  getRbacSummary,
  syncRbacInherited,
  getRbacUserAccess,
  grantRbacPermission,
  revokeRbacGrant,
  revokeRbacRole,
} from "../../../core/api/rbacAdminApi";

const SOURCE_LABEL = {
  legacy_role: "Rol del usuario",
  legacy_scope: "Área derivada del rol",
  legacy_extra_role: "Rol adicional",
  manual: "Asignación manual",
};

const fieldClass =
  "h-10 w-full rounded-lg border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action)]";
const primaryButton =
  "h-10 rounded-lg bg-[var(--action)] px-4 text-sm font-medium text-[var(--on-action)] hover:bg-[var(--action-hover)] disabled:cursor-not-allowed disabled:opacity-60";
const ghostButton =
  "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-[var(--danger-text)] hover:bg-[var(--danger-bg)] disabled:opacity-60";

const ACTION_LABEL = {
  asignar_rol: "Rol asignado",
  revocar_rol: "Rol revocado",
  otorgar_permiso: "Permiso otorgado",
  revocar_permiso: "Permiso revocado",
  sincronizar_heredadas: "Sincronización de roles heredados",
  crear_rol: "Rol creado",
  editar_rol: "Rol editado",
  archivar_rol: "Rol archivado",
};
const VIEWS = [["users", "Usuarios"], ["roles", "Roles"], ["matrix", "Matriz"], ["audit", "Auditoría"]];

const formatDateTime = (value) => (value ? new Date(value).toLocaleString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" }) : "Sin vencimiento");

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{value ?? "–"}</p>
    </div>
  );
}

export default function RbacCentralPanel() {
  const [summary, setSummary] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null); // null | "restricted" | "failed"
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [permissionQuery, setPermissionQuery] = useState("");
  const [view, setView] = useState("users");
  const [matrix, setMatrix] = useState(null);
  const [audit, setAudit] = useState(null);
  const [viewError, setViewError] = useState("");
  const [roleForm, setRoleForm] = useState({ role: "", reason: "", expiresAt: "" });
  const [grantForm, setGrantForm] = useState({ permission: "", reason: "", expiresAt: "" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([getRbacSummary(), getRbacRoles(), getRbacMembers()])
      .then(([s, r, u]) => {
        if (cancelled) return;
        setSummary(s);
        setRoles(r);
        setUsers((Array.isArray(u) ? u : []).filter((item) => item.active !== false));
      })
      .catch((error) => {
        if (cancelled) return;
        // 401/403: el servidor niega el acceso; cualquier otro fallo se puede reintentar.
        setLoadError([401, 403].includes(error?.response?.status) ? "restricted" : "failed");
        toast.error("No se pudo cargar el catálogo de roles y permisos.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    const handle = setTimeout(() => {
      getRbacPermissions({ q: permissionQuery, limit: 60 }).then(setPermissions).catch(() => setPermissions([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [permissionQuery]);

  useEffect(() => {
    if (view === "users" || view === "roles") return undefined;
    let cancelled = false;
    setViewError("");
    const load = view === "matrix" ? getRbacMatrix().then(setMatrix) : getRbacAudit({ limit: 100 }).then(setAudit);
    load.catch(() => !cancelled && setViewError("No se pudo cargar esta vista. Intenta de nuevo."));
    return () => { cancelled = true; };
  }, [view]);

  const syncInherited = async () => {
    if (busy) return;
    if (!window.confirm("Esto compara los roles de todos los usuarios con el catálogo central y corrige las diferencias heredadas. No toca asignaciones manuales ni cambia el acceso real. ¿Continuar?")) return;
    setBusy(true);
    try {
      const result = await syncRbacInherited();
      toast.success(`Sincronizado: ${result.added} agregadas, ${result.removed} retiradas.`);
      setSummary(await getRbacSummary());
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo sincronizar.");
    } finally {
      setBusy(false);
    }
  };

  const loadAccess = useCallback(async (id) => {
    if (!id) { setAccess(null); return; }
    try { setAccess(await getRbacUserAccess(id)); } catch { toast.error("No se pudo cargar el acceso del usuario."); }
  }, []);

  useEffect(() => { loadAccess(userId); }, [userId, loadAccess]);

  const run = async (action, success) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await action();
      setAccess(next);
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo completar la acción.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitRole = async (event) => {
    event.preventDefault();
    const done = await run(() => assignRbacRole(userId, roleForm), "Rol asignado.");
    if (done) setRoleForm({ role: "", reason: "", expiresAt: "" });
  };

  const submitGrant = async (event) => {
    event.preventDefault();
    const done = await run(() => grantRbacPermission(userId, grantForm), "Permiso otorgado.");
    if (done) setGrantForm({ permission: "", reason: "", expiresAt: "" });
  };

  const revokeRole = (assignment) => {
    const reason = window.prompt(`Motivo para revocar el rol «${assignment.role}»:`);
    if (reason && reason.trim().length >= 5) run(() => revokeRbacRole(userId, assignment.id, reason.trim()), "Rol revocado.");
    else if (reason !== null) toast.error("Indica un motivo de al menos 5 caracteres.");
  };

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => String(a.fullname || a.email).localeCompare(String(b.fullname || b.email))),
    [users],
  );

  if (loading) return <p className="py-8 text-sm text-[var(--text-secondary)]" role="status">Cargando catálogo…</p>;

  if (loadError === "restricted") {
    return <p role="alert" className="rounded-xl border border-[var(--border)] bg-[var(--warning-bg)] p-4 text-sm text-[var(--warning-text)]">No tienes permiso para ver los roles y permisos. Pide acceso a TI.</p>;
  }
  if (loadError === "failed") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
        <span>No se pudo cargar el catálogo.</span>
        <button type="button" className="h-9 rounded-lg border border-[var(--danger-text)] px-3" onClick={() => setReloadKey((key) => key + 1)}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--info-bg)] p-4 text-sm text-[var(--info-text)]" role="note">
        <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          {summary?.enforcement?.note ||
            "Hoy el acceso lo decide el sistema de siempre."}{" "}
          Lo que cambies aquí queda registrado y listo para cuando el módulo se active, pero{" "}
          <strong>todavía no modifica el acceso real de nadie</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Roles" value={summary?.roles} />
        <Stat label="Permisos" value={summary?.permissions} />
        <Stat label="Endpoints con permiso" value={summary?.endpoints} />
        <Stat label="Asignaciones manuales" value={summary?.manual_assignments} />
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)]">
        <div role="tablist" aria-label="Vistas del catálogo" className="flex flex-wrap gap-1">
        {VIEWS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`-mb-px min-h-[44px] border-b-2 px-4 text-sm font-medium ${view === key ? "border-[var(--action)] text-[var(--action)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]"}`}
          >
            {label}
          </button>
        ))}
        </div>
        <button type="button" onClick={syncInherited} disabled={busy} className="ml-auto h-9 rounded-lg border border-[var(--border-control)] px-3 text-sm text-[var(--text)] hover:bg-[var(--surface-subtle)] disabled:opacity-60">
          Sincronizar roles heredados
        </button>
      </div>

      {viewError && <p role="alert" className="rounded-lg bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">{viewError}</p>}

      {view === "roles" && <RbacRoleBuilder onChanged={() => getRbacSummary().then(setSummary).catch(() => {})} />}

      {view === "matrix" && (
        <section aria-labelledby="rbac-matrix" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
          <h2 id="rbac-matrix" className="text-base font-semibold text-[var(--text)]">Matriz de permisos por rol y área</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Cada celda es la cantidad de permisos que el rol tiene en esa área. Una celda vacía significa ninguno.</p>
          {!matrix && !viewError && <p className="py-6 text-sm text-[var(--text-secondary)]" role="status">Cargando matriz…</p>}
          {matrix && (
            <div className="relative mt-4 max-h-[32rem] overflow-auto rounded-lg border border-[var(--border)]" role="region" aria-label="Matriz de permisos, desplazable" tabIndex={0}>
              <table className="min-w-full border-collapse text-left text-sm">
                <caption className="sr-only">Permisos por rol y área</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 top-0 z-20 bg-[var(--surface-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">Rol</th>
                    {matrix.areas.map((area) => (
                      <th key={area} scope="col" className="sticky top-0 z-10 whitespace-nowrap bg-[var(--surface-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">{area}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.roles.map((role) => (
                    <tr key={role} className="h-10 border-t border-[var(--border)] hover:bg-[var(--surface-subtle)]">
                      <th scope="row" className="sticky left-0 whitespace-nowrap bg-[var(--surface)] px-3 text-left font-medium text-[var(--text)]">{role}</th>
                      {matrix.areas.map((area) => {
                        const value = matrix.cells[`${role}|${area}`];
                        return <td key={area} className="px-3 text-right tabular-nums text-[var(--text)]">{value || ""}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {view === "audit" && (
        <section aria-labelledby="rbac-audit" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
          <h2 id="rbac-audit" className="text-base font-semibold text-[var(--text)]">Cambios de roles y permisos</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Quién cambió qué, con el valor anterior y el nuevo. Los más recientes primero.</p>
          {!audit && !viewError && <p className="py-6 text-sm text-[var(--text-secondary)]" role="status">Cargando cambios…</p>}
          {audit && audit.length === 0 && <p className="py-6 text-sm text-[var(--text-secondary)]">Todavía no hay cambios registrados.</p>}
          {audit && audit.length > 0 && (
            <ul className="mt-4 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {audit.map((entry) => (
                <li key={entry.id} className="space-y-1 px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-[var(--text)]">{ACTION_LABEL[entry.action] || entry.action}</span>
                    <time className="text-xs text-[var(--text-secondary)]" dateTime={entry.at}>{formatDateTime(entry.at)}</time>
                  </div>
                  <p className="text-[var(--text-secondary)]">{entry.description} · por {entry.actor}</p>
                  {entry.before && <p className="break-words text-xs text-[var(--text-secondary)]">Antes: {JSON.stringify(entry.before)}</p>}
                  {entry.after && <p className="break-words text-xs text-[var(--text-secondary)]">Después: {JSON.stringify(entry.after)}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {view === "users" && (
      <section aria-labelledby="rbac-user" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
        <h2 id="rbac-user" className="text-base font-semibold text-[var(--text)]">Acceso por usuario</h2>
        <label className="mt-3 block text-[13px] text-[var(--text-secondary)]" htmlFor="rbac-user-select">Usuario</label>
        <select id="rbac-user-select" className={`${fieldClass} md:max-w-md`} value={userId} onChange={(event) => setUserId(event.target.value)}>
          <option value="">Selecciona un usuario</option>
          {sortedUsers.map((user) => (
            <option key={user.id} value={user.id}>{user.fullname || user.email}</option>
          ))}
        </select>

        {access && (
          <div className="mt-5 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">Roles centrales</h3>
              <ul className="mt-2 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                {access.assignments.length === 0 && (
                  <li className="p-3 text-sm text-[var(--text-secondary)]">Sin roles en el catálogo central (rol actual: {access.user.role || "sin rol"}).</li>
                )}
                {access.assignments.map((assignment) => (
                  <li key={assignment.id} className="flex min-h-[48px] flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-[var(--text)]">{assignment.role}</span>
                      <span className="ml-2 rounded-md bg-[var(--surface-subtle)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">{SOURCE_LABEL[assignment.source] || assignment.source}</span>
                      <p className="text-xs text-[var(--text-secondary)]">{formatDate(assignment.expires_at)}{assignment.reason ? ` · ${assignment.reason}` : ""}</p>
                    </div>
                    {assignment.source === "manual" && (
                      <button type="button" className={ghostButton} disabled={busy} onClick={() => revokeRole(assignment)}>
                        <FiTrash2 aria-hidden="true" /> Revocar
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <form onSubmit={submitRole} className="mt-3 grid gap-3 md:grid-cols-[1fr_1.5fr_10rem_auto] md:items-end">
                <div>
                  <label className="block text-[13px] text-[var(--text-secondary)]" htmlFor="rbac-role">Rol</label>
                  <select id="rbac-role" required className={fieldClass} value={roleForm.role} onChange={(event) => setRoleForm({ ...roleForm, role: event.target.value })}>
                    <option value="">Selecciona</option>
                    {roles.map((role) => <option key={role.id} value={role.key}>{role.key}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] text-[var(--text-secondary)]" htmlFor="rbac-role-reason">Motivo (obligatorio)</label>
                  <input id="rbac-role-reason" required minLength={5} className={fieldClass} value={roleForm.reason} onChange={(event) => setRoleForm({ ...roleForm, reason: event.target.value })} />
                </div>
                <div>
                  <label className="block text-[13px] text-[var(--text-secondary)]" htmlFor="rbac-role-expiry">Vence (opcional)</label>
                  <input id="rbac-role-expiry" type="date" className={fieldClass} value={roleForm.expiresAt} onChange={(event) => setRoleForm({ ...roleForm, expiresAt: event.target.value })} />
                </div>
                <button type="submit" className={primaryButton} disabled={busy}>Asignar rol</button>
              </form>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">Permisos individuales</h3>
              <ul className="mt-2 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                {access.grants.length === 0 && <li className="p-3 text-sm text-[var(--text-secondary)]">Sin permisos individuales.</li>}
                {access.grants.map((grant) => (
                  <li key={grant.id} className="flex min-h-[48px] flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-[var(--text)]">{grant.permission_key}</span>
                      <p className="text-xs text-[var(--text-secondary)]">{formatDate(grant.expires_at)} · {grant.reason}</p>
                    </div>
                    <button type="button" className={ghostButton} disabled={busy} onClick={() => run(() => revokeRbacGrant(userId, grant.id), "Permiso revocado.")}>
                      <FiTrash2 aria-hidden="true" /> Revocar
                    </button>
                  </li>
                ))}
              </ul>

              <form onSubmit={submitGrant} className="mt-3 grid gap-3 md:grid-cols-[1.5fr_1.5fr_10rem_auto] md:items-end">
                <div>
                  <label className="block text-[13px] text-[var(--text-secondary)]" htmlFor="rbac-grant">Permiso</label>
                  <select id="rbac-grant" required className={fieldClass} value={grantForm.permission} onChange={(event) => setGrantForm({ ...grantForm, permission: event.target.value })}>
                    <option value="">Selecciona (busca abajo para acotar)</option>
                    {permissions.map((permission) => <option key={permission.key} value={permission.key}>{permission.key}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] text-[var(--text-secondary)]" htmlFor="rbac-grant-reason">Motivo (obligatorio)</label>
                  <input id="rbac-grant-reason" required minLength={5} className={fieldClass} value={grantForm.reason} onChange={(event) => setGrantForm({ ...grantForm, reason: event.target.value })} />
                </div>
                <div>
                  <label className="block text-[13px] text-[var(--text-secondary)]" htmlFor="rbac-grant-expiry">Vence (opcional)</label>
                  <input id="rbac-grant-expiry" type="date" className={fieldClass} value={grantForm.expiresAt} onChange={(event) => setGrantForm({ ...grantForm, expiresAt: event.target.value })} />
                </div>
                <button type="submit" className={primaryButton} disabled={busy}>Otorgar permiso</button>
              </form>
            </div>
          </div>
        )}
      </section>

      )}

      {view === "users" && (
      <section aria-labelledby="rbac-catalog" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
        <h2 id="rbac-catalog" className="flex items-center gap-2 text-base font-semibold text-[var(--text)]"><FiShield aria-hidden="true" /> Catálogo</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Los nombres de permiso son provisionales y se generan desde las reglas actuales hasta que cada responsable de área los apruebe.</p>

        <div className="relative mt-4 overflow-x-auto" role="region" aria-label="Roles del catálogo, desplazable" tabIndex={0}>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Roles del catálogo central</caption>
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--text-secondary)]">
                <th scope="col" className="px-3 py-2 font-medium">Rol</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Permisos</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Usuarios</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="h-10 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)]">
                  <td className="px-3 text-[var(--text)]">{role.key}</td>
                  <td className="px-3 text-right tabular-nums text-[var(--text)]">{role.permissions}</td>
                  <td className="px-3 text-right tabular-nums text-[var(--text)]">{role.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="mt-5 block text-[13px] text-[var(--text-secondary)]" htmlFor="rbac-permission-search">Buscar permiso</label>
        <input id="rbac-permission-search" className={`${fieldClass} md:max-w-md`} value={permissionQuery} onChange={(event) => setPermissionQuery(event.target.value)} placeholder="Ej. viaticos, business-case" />
        <ul className="mt-2 max-h-72 divide-y divide-[var(--border)] overflow-y-auto rounded-lg border border-[var(--border)]" aria-label="Resultados de permisos, desplazable" tabIndex={0}>
          {permissions.length === 0 && <li className="p-3 text-sm text-[var(--text-secondary)]">Sin resultados.</li>}
          {permissions.map((permission) => (
            <li key={permission.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="break-all text-[var(--text)]">{permission.key}</span>
              <span className="shrink-0 text-xs text-[var(--text-secondary)]">{permission.roles} rol(es)</span>
            </li>
          ))}
        </ul>
      </section>
      )}
    </div>
  );
}
