import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiEdit2,
  FiFilter,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiSearch,
  FiUser,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";
import toast from "react-hot-toast";

import { createUser, getUsers, updateUser, getUserRoles } from "../../../core/api/usersApi";
import { getDepartments } from "../../../core/api/departmentsApi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import Input from "../../../core/ui/components/Input";
import Modal from "../../../core/ui/components/Modal";
import Select from "../../../core/ui/components/Select";

const ROLE_OPTIONS = [
  { label: "Pendiente", value: "pendiente" },
  { label: "Gerencia", value: "gerencia" },
  { label: "Comercial", value: "comercial" },
  { label: "Servicio Técnico", value: "servicio_tecnico" },
  { label: "Técnico", value: "tecnico" },
  { label: "Finanzas", value: "finanzas" },
  { label: "Talento Humano", value: "talento_humano" },
  { label: "TI", value: "ti" },
  { label: "Usuario", value: "usuario" },
];

const EMPTY_FORM = {
  fullname: "",
  email: "",
  role: "pendiente",
  department_id: "",
  google_id: "",
};

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  try {
    return new Date(value).toLocaleDateString("es-EC", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "Sin fecha";
  }
};

const isDepartmentInactive = (department) =>
  String(department?.status || "active").toLowerCase() === "inactive" || department?.active === false;

const getRoleLabel = (role) =>
  ROLE_OPTIONS.find((option) => option.value === role)?.label || role || "Pendiente";

const buildDepartmentOption = (department) => ({
  label: `${department.name}${isDepartmentInactive(department) ? " (inactivo)" : ""}`,
  value: String(department.id),
});

// Strip de métricas en una sola superficie con dividers (no hero-metric cards)
const MetricsStrip = ({ items }) => (
  <Card className="overflow-hidden p-0 shadow-soft">
    <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-3 px-5 py-4">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500 truncate">{item.label}</p>
              <p className="text-lg font-semibold text-slate-900 leading-tight">{item.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  </Card>
);

const StatusBadge = ({ active }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
      active ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"
    }`}
  >
    {active ? <FiCheckCircle size={12} /> : <FiXCircle size={12} />}
    {active ? "Activo" : "Inactivo"}
  </span>
);

const ActionConfirmModal = ({ state, onClose, onConfirm, loading }) => {
  if (!state) return null;

  const isActivate = state.nextActive === true;
  return (
    <Modal
      open
      onClose={onClose}
      disableClose={loading}
      title={isActivate ? "Reactivar usuario" : "Desactivar usuario"}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p>
            {isActivate
              ? "El usuario volverá a quedar disponible para acceso y operación interna."
              : "El usuario dejará de estar disponible para operación interna, pero conservará su trazabilidad."}
          </p>
          <p className="mt-3 font-semibold text-slate-900">{state.user.fullname || state.user.email}</p>
          <p className="text-xs text-slate-500">{state.user.email}</p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={isActivate ? "success" : "danger"} onClick={onConfirm} loading={loading}>
            {isActivate ? "Reactivar usuario" : "Desactivar usuario"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const Usuarios = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roleOptions, setRoleOptions] = useState(ROLE_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionState, setActionState] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    const handler = window.setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => window.clearTimeout(handler);
  }, [search]);

  const loadDepartments = useCallback(async () => {
    try {
      const depData = await getDepartments({ include_inactive: true });
      setDepartments(Array.isArray(depData) ? depData : []);
    } catch (error) {
      console.error("Error cargando departamentos:", error);
      toast.error("No se pudo cargar el catálogo de departamentos");
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const initialLoad = !initializedRef.current;
    setErrorMessage("");
    if (initialLoad) setLoading(true);
    else setIsRefreshing(true);

    try {
      const usersData = await getUsers({
        search: debouncedSearch || undefined,
        role: roleFilter !== "all" ? roleFilter : undefined,
        department_id: departmentFilter !== "all" ? departmentFilter : undefined,
        active: statusFilter === "all" ? undefined : statusFilter === "active",
      });
      setUsers(Array.isArray(usersData) ? usersData : []);
      initializedRef.current = true;
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setErrorMessage("No se pudo cargar la gestión de usuarios. Intenta nuevamente.");
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [debouncedSearch, departmentFilter, roleFilter, statusFilter]);

  const loadRoles = useCallback(async () => {
    try {
      const rolesData = await getUserRoles();
      if (Array.isArray(rolesData) && rolesData.length > 0) {
        setRoleOptions(rolesData);
      }
    } catch (error) {
      console.error("Error cargando roles:", error);
      // Mantener ROLE_OPTIONS como fallback
    }
  }, []);

  useEffect(() => {
    loadDepartments();
    loadRoles();
  }, [loadDepartments, loadRoles]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const resetForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const openModal = (user = null) => {
    if (user) {
      setEditing(user);
      setForm({
        fullname: user.fullname || "",
        email: user.email || "",
        role: user.role || "pendiente",
        department_id: user.department_id ? String(user.department_id) : "",
        google_id: user.google_id || "",
      });
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.fullname.trim() || !form.email.trim()) {
      toast.error("Nombre completo y correo son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        fullname: form.fullname.trim(),
        email: form.email.trim(),
        role: form.role,
        department_id: form.department_id || null,
        google_id: form.google_id?.trim() || null,
      };

      if (editing) {
        await updateUser(editing.id, payload);
        toast.success("Usuario actualizado correctamente");
      } else {
        await createUser(payload);
        toast.success("Usuario creado correctamente");
      }

      closeModal();
      await loadUsers();
    } catch (error) {
      console.error("Error guardando usuario:", error);
      toast.error(error?.response?.data?.message || "No se pudo guardar el usuario");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmStatus = async () => {
    if (!actionState) return;
    setActionLoading(true);

    try {
      await updateUser(actionState.user.id, { active: actionState.nextActive });
      toast.success(actionState.nextActive ? "Usuario reactivado" : "Usuario desactivado");
      setActionState(null);
      await loadUsers();
    } catch (error) {
      console.error("Error actualizando estado del usuario:", error);
      toast.error(error?.response?.data?.message || "No se pudo actualizar el estado del usuario");
    } finally {
      setActionLoading(false);
    }
  };

  const hasActiveFilters = Boolean(
    search.trim() || roleFilter !== "all" || departmentFilter !== "all" || statusFilter !== "all"
  );

  const visibleUsers = useMemo(() => users, [users]);

  const summary = useMemo(
    () =>
      visibleUsers.reduce(
        (acc, user) => {
          acc.total += 1;
          if (user.active === false) acc.inactive += 1;
          else acc.active += 1;
          if (user.department_name) acc.withDepartment += 1;
          else acc.withoutDepartment += 1;
          return acc;
        },
        { total: 0, active: 0, inactive: 0, withDepartment: 0, withoutDepartment: 0 }
      ),
    [visibleUsers]
  );

  const departmentFilterOptions = useMemo(
    () => [
      { label: "Todos los departamentos", value: "all" },
      ...departments.map(buildDepartmentOption),
    ],
    [departments]
  );

  const departmentSelectOptions = useMemo(() => {
    const selectedDepartment = departments.find((department) => String(department.id) === String(form.department_id));
    const activeOptions = departments.filter((department) => !isDepartmentInactive(department));
    const merged = [...activeOptions];

    if (selectedDepartment && !merged.some((department) => department.id === selectedDepartment.id)) {
      merged.push(selectedDepartment);
    }

    return [{ label: "Sin asignar", value: "" }, ...merged.map(buildDepartmentOption)];
  }, [departments, form.department_id]);

  return (
    <div className="space-y-5">
      {/* Toolbar: acciones + filtros */}
      <Card className="p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">Identidades internas</p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="secondary" leftIcon={FiRefreshCw} onClick={loadUsers} loading={isRefreshing} size="sm" className="flex-1 justify-center sm:flex-none">
              Actualizar
            </Button>
            <Button leftIcon={FiPlus} onClick={() => openModal()} size="sm" className="flex-1 justify-center sm:flex-none">
              Nuevo usuario
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="relative lg:col-start-1 lg:row-start-1">
            <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, correo o rol"
              containerClassName="mb-0"
              className="min-h-[44px] pl-10"
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            options={[{ label: "Todos los roles", value: "all" }, ...roleOptions]}
            includePlaceholder={false}
            containerClassName="mb-0"
            className="min-h-[44px]"
          />
          <Select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            options={departmentFilterOptions}
            includePlaceholder={false}
            containerClassName="mb-0"
            className="min-h-[44px]"
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={[
              { label: "Todos los estados", value: "all" },
              { label: "Activos", value: "active" },
              { label: "Inactivos", value: "inactive" },
            ]}
            includePlaceholder={false}
            containerClassName="mb-0"
            className="min-h-[44px]"
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
            <FiFilter size={13} />
            {isRefreshing ? "Actualizando..." : `${summary.total} registro(s)`}
          </span>
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setRoleFilter("all");
                setDepartmentFilter("all");
                setStatusFilter("all");
              }}
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Métricas */}
      <MetricsStrip
        items={[
          { icon: FiUsers, label: "Usuarios visibles", value: summary.total },
          { icon: FiCheckCircle, label: "Activos", value: summary.active },
          { icon: FiXCircle, label: "Inactivos", value: summary.inactive },
          { icon: FiMail, label: "Con departamento", value: summary.withDepartment },
        ]}
      />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Listado operativo</h3>
            <p className="text-sm text-slate-500">Tabla en escritorio, tarjetas en móvil.</p>
          </div>
          {errorMessage ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              <FiAlertCircle size={14} />
              Error de carga
            </div>
          ) : null}
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : errorMessage ? (
            <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 p-6 text-center">
              <p className="text-base font-semibold text-red-800">No se pudo cargar la gestión de usuarios</p>
              <p className="mt-2 text-sm text-red-700">Reintenta la consulta para recuperar la información actual.</p>
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" leftIcon={FiRefreshCw} onClick={loadUsers}>
                  Reintentar
                </Button>
              </div>
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-lg font-semibold text-slate-900">
                {hasActiveFilters ? "No hay usuarios que coincidan con los filtros actuales" : "Aún no hay usuarios registrados"}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {hasActiveFilters
                  ? "Ajusta la búsqueda o limpia filtros para recuperar el listado completo."
                  : "Crea el primer usuario manual para empezar a operar esta consola."}
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                {hasActiveFilters ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setRoleFilter("all");
                      setDepartmentFilter("all");
                      setStatusFilter("all");
                    }}
                  >
                    Limpiar filtros
                  </Button>
                ) : null}
                <Button leftIcon={FiPlus} onClick={() => openModal()}>
                  Nuevo usuario
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead>
                      <tr className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        <th className="px-4 py-3 font-semibold">Usuario</th>
                        <th className="px-4 py-3 font-semibold">Rol</th>
                        <th className="px-4 py-3 font-semibold">Departamento</th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                        <th className="px-4 py-3 font-semibold">Alta</th>
                        <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                      {visibleUsers.map((user) => {
                        const isActive = user.active !== false;
                        return (
                          <tr key={user.id} className="transition-colors hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <div className="flex items-start gap-3">
                                <div className="inline-flex rounded-2xl bg-slate-100 p-3 text-slate-700">
                                  <FiUser />
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900">{user.fullname || "Sin nombre"}</p>
                                  <p className="text-xs text-slate-500">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 font-medium text-slate-700">{getRoleLabel(user.role)}</td>
                            <td className="px-4 py-4">
                              <div className="text-slate-700">{user.department_name || "Sin asignar"}</div>
                              {user.google_id ? <div className="text-xs text-slate-400">Google ID: {user.google_id}</div> : null}
                            </td>
                            <td className="px-4 py-4">
                              <StatusBadge active={isActive} />
                            </td>
                            <td className="px-4 py-4 text-slate-500">{formatDate(user.created_at)}</td>
                            <td className="px-4 py-4">
                              <div className="flex justify-end gap-2">
                                <Button variant="secondary" size="sm" leftIcon={FiEdit2} onClick={() => openModal(user)}>
                                  Editar
                                </Button>
                                <Button
                                  variant={isActive ? "danger" : "success"}
                                  size="sm"
                                  leftIcon={isActive ? FiXCircle : FiRotateCcw}
                                  onClick={() => setActionState({ user, nextActive: !isActive })}
                                >
                                  {isActive ? "Desactivar" : "Reactivar"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 lg:hidden">
                {visibleUsers.map((user) => {
                  const isActive = user.active !== false;
                  return (
                    <Card
                      key={user.id}
                      className={`rounded-2xl border p-4 shadow-soft ${
                        isActive ? "border-slate-100 bg-white" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                              {getRoleLabel(user.role)}
                            </span>
                            <StatusBadge active={isActive} />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-slate-900">{user.fullname || "Sin nombre"}</p>
                            <p className="break-all text-sm text-slate-500">{user.email}</p>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:min-w-[220px]">
                          <div className="rounded-2xl bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Departamento</p>
                            <p className="mt-1 text-sm font-medium text-slate-800">{user.department_name || "Sin asignar"}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Alta</p>
                            <p className="mt-1 text-sm font-medium text-slate-800">{formatDate(user.created_at)}</p>
                          </div>
                        </div>
                      </div>

                      {user.google_id ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                          Google ID: <span className="font-medium text-slate-700">{user.google_id}</span>
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Button variant="secondary" leftIcon={FiEdit2} className="justify-center" onClick={() => openModal(user)}>
                          Editar
                        </Button>
                        <Button
                          variant={isActive ? "danger" : "success"}
                          leftIcon={isActive ? FiXCircle : FiRotateCcw}
                          className="justify-center"
                          onClick={() => setActionState({ user, nextActive: !isActive })}
                        >
                          {isActive ? "Desactivar" : "Reactivar"}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        disableClose={saving}
        title={editing ? "Editar usuario" : "Nuevo usuario"}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Define identidad base, rol operativo y asignación estructural. El correo será el identificador
            principal para uso interno.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Nombre completo"
              value={form.fullname}
              onChange={(event) => setForm((current) => ({ ...current, fullname: event.target.value }))}
              placeholder="Ej. María Pérez"
              containerClassName="mb-0"
              autoFocus
              required
            />
            <Input
              label="Correo"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="usuario@fam-project.com"
              containerClassName="mb-0"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Rol"
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              options={roleOptions}
              includePlaceholder={false}
              containerClassName="mb-0"
            />
            <Select
              label="Departamento"
              value={form.department_id}
              onChange={(event) => setForm((current) => ({ ...current, department_id: event.target.value }))}
              options={departmentSelectOptions}
              includePlaceholder={false}
              containerClassName="mb-0"
            />
          </div>

          <Input
            label="Google ID"
            value={form.google_id}
            onChange={(event) => setForm((current) => ({ ...current, google_id: event.target.value }))}
            placeholder="Identificador de Google Workspace"
            containerClassName="mb-0"
          />

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </div>
        </form>
      </Modal>

      <ActionConfirmModal
        state={actionState}
        onClose={() => !actionLoading && setActionState(null)}
        onConfirm={handleConfirmStatus}
        loading={actionLoading}
      />
    </div>
  );
};

export default Usuarios;