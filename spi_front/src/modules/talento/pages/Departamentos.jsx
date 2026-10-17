import React, { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiEdit2,
  FiFolder,
  FiHash,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiSearch,
  FiXCircle,
} from "react-icons/fi";
import toast from "react-hot-toast";

import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  updateDepartment,
} from "../../../core/api/departmentsApi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import Input from "../../../core/ui/components/Input";
import Modal from "../../../core/ui/components/Modal";
import Select from "../../../core/ui/components/Select";

const isInactiveDepartment = (department) =>
  String(department?.status || "").toLowerCase() === "inactive" || department?.active === false;

// Strip de métricas en una sola superficie con dividers (no hero-metric cards)
const MetricsStrip = ({ items }) => (
  <Card className="overflow-hidden p-0 shadow-soft">
    <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
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
  const isActivate = state.mode === "reactivate";

  return (
    <Modal
      open
      onClose={onClose}
      disableClose={loading}
      title={isActivate ? "Reactivar departamento" : "Desactivar departamento"}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p>
            {isActivate
              ? "El departamento volverá a quedar disponible para asignaciones internas."
              : "El departamento dejará de estar disponible para nuevas asignaciones, pero conservará trazabilidad histórica."}
          </p>
          <p className="mt-3 font-semibold text-slate-900">{state.department.name || state.department.nombre}</p>
          <p className="text-xs text-slate-500">Código: {state.department.code || "N/D"}</p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={isActivate ? "success" : "danger"} onClick={onConfirm} loading={loading}>
            {isActivate ? "Reactivar departamento" : "Desactivar departamento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const Departamentos = () => {
  const [departamentos, setDepartamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [actionState, setActionState] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDepartamentos = async ({ silent = false } = {}) => {
    setErrorMessage("");
    if (silent) setIsRefreshing(true);
    else setLoading(true);

    try {
      const departamentosList = await getDepartments({ include_inactive: true });
      setDepartamentos(Array.isArray(departamentosList) ? departamentosList : []);
    } catch (error) {
      console.error("Error al cargar departamentos:", error);
      setDepartamentos([]);
      setErrorMessage("No se pudo cargar la gestión de departamentos. Intenta nuevamente.");
      toast.error("Error al cargar los departamentos");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDepartamentos();
  }, []);

  const filteredDepartamentos = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return departamentos.filter((department) => {
      const inactive = isInactiveDepartment(department);
      if (statusFilter === "active" && inactive) return false;
      if (statusFilter === "inactive" && !inactive) return false;
      if (!needle) return true;
      return (
        String(department.name || department.nombre || "").toLowerCase().includes(needle) ||
        String(department.code || "").toLowerCase().includes(needle)
      );
    });
  }, [departamentos, search, statusFilter]);

  const hasActiveFilters = Boolean(search.trim() || statusFilter !== "all");

  const summary = useMemo(
    () =>
      filteredDepartamentos.reduce(
        (acc, department) => {
          acc.total += 1;
          if (isInactiveDepartment(department)) acc.inactive += 1;
          else acc.active += 1;
          return acc;
        },
        { total: 0, active: 0, inactive: 0 }
      ),
    [filteredDepartamentos]
  );

  const resetForm = () => {
    setEditing(null);
    setNombre("");
    setCodigo("");
    setDescripcion("");
  };

  const openModal = (department = null) => {
    if (department) {
      setEditing(department);
      setNombre(department.name || department.nombre || "");
      setCodigo(department.code || "");
      setDescripcion(department.description || "");
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
    if (!nombre.trim()) {
      toast.error("El nombre del departamento es obligatorio");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: nombre.trim(),
        code: (codigo || nombre.slice(0, 3)).trim().toUpperCase(),
        description: descripcion.trim() || null,
      };

      if (editing) {
        await updateDepartment(editing.id, payload);
        toast.success("Departamento actualizado correctamente");
      } else {
        await createDepartment(payload);
        toast.success("Departamento creado correctamente");
      }

      closeModal();
      await fetchDepartamentos({ silent: true });
    } catch (error) {
      console.error("Error guardando departamento:", error);
      toast.error(error?.response?.data?.message || "No se pudo guardar el departamento");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmStatus = async () => {
    if (!actionState) return;
    setActionLoading(true);

    try {
      if (actionState.mode === "deactivate") {
        await deleteDepartment(actionState.department.id);
        toast.success("Departamento desactivado");
      } else {
        await updateDepartment(actionState.department.id, { status: "active" });
        toast.success("Departamento reactivado");
      }
      setActionState(null);
      await fetchDepartamentos({ silent: true });
    } catch (error) {
      console.error("Error actualizando departamento:", error);
      toast.error(error?.response?.data?.message || "No se pudo actualizar el departamento");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar: acciones + filtros */}
      <Card className="p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">Estructura organizacional</p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="secondary" leftIcon={FiRefreshCw} onClick={() => fetchDepartamentos({ silent: true })} loading={isRefreshing} size="sm" className="flex-1 justify-center sm:flex-none">
              Actualizar
            </Button>
            <Button leftIcon={FiPlus} onClick={() => openModal()} size="sm" className="flex-1 justify-center sm:flex-none">
              Nuevo departamento
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)]">
          <div className="relative lg:col-start-1 lg:row-start-1">
            <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o código"
              containerClassName="mb-0"
              className="min-h-[44px] pl-10"
            />
          </div>
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
            <FiFolder size={13} />
            {isRefreshing ? "Actualizando..." : `${summary.total} departamento(s)`}
          </span>
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Métricas */}
      <MetricsStrip
        items={[
          { icon: FiFolder, label: "Departamentos visibles", value: summary.total },
          { icon: FiCheckCircle, label: "Activos", value: summary.active },
          { icon: FiXCircle, label: "Inactivos", value: summary.inactive },
        ]}
      />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Catálogo operativo</h3>
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
              <p className="text-base font-semibold text-red-800">No se pudo cargar la gestión de departamentos</p>
              <p className="mt-2 text-sm text-red-700">Reintenta la consulta para recuperar el catálogo actual.</p>
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" leftIcon={FiRefreshCw} onClick={() => fetchDepartamentos()}>
                  Reintentar
                </Button>
              </div>
            </div>
          ) : filteredDepartamentos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-lg font-semibold text-slate-900">
                {hasActiveFilters ? "No hay departamentos que coincidan con los filtros actuales" : "Aún no hay departamentos registrados"}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {hasActiveFilters
                  ? "Ajusta la búsqueda o limpia filtros para recuperar la estructura completa."
                  : "Crea el primer departamento para estructurar asignaciones internas."}
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                {hasActiveFilters ? (
                  <Button variant="secondary" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
                    Limpiar filtros
                  </Button>
                ) : null}
                <Button leftIcon={FiPlus} onClick={() => openModal()}>
                  Nuevo departamento
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
                        <th className="px-4 py-3 font-semibold">Departamento</th>
                        <th className="px-4 py-3 font-semibold">Código</th>
                        <th className="px-4 py-3 font-semibold">Descripción</th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                        <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                      {filteredDepartamentos.map((department) => {
                        const active = !isInactiveDepartment(department);
                        return (
                          <tr key={department.id} className="transition-colors hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <div className="flex items-start gap-3">
                                <div className="inline-flex rounded-2xl bg-slate-100 p-3 text-slate-700">
                                  <FiFolder />
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900">{department.name || department.nombre}</p>
                                  <p className="text-xs text-slate-500">ID interno: {department.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 font-medium text-slate-700">{department.code || "N/D"}</td>
                            <td className="px-4 py-4 text-slate-500">{department.description || "Sin descripción registrada"}</td>
                            <td className="px-4 py-4">
                              <StatusBadge active={active} />
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex justify-end gap-2">
                                <Button variant="secondary" size="sm" leftIcon={FiEdit2} onClick={() => openModal(department)}>
                                  Editar
                                </Button>
                                <Button
                                  variant={active ? "danger" : "success"}
                                  size="sm"
                                  leftIcon={active ? FiXCircle : FiRotateCcw}
                                  onClick={() =>
                                    setActionState({
                                      department,
                                      mode: active ? "deactivate" : "reactivate",
                                    })
                                  }
                                >
                                  {active ? "Desactivar" : "Reactivar"}
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
                {filteredDepartamentos.map((department) => {
                  const active = !isInactiveDepartment(department);
                  return (
                    <Card
                      key={department.id}
                      className={`rounded-2xl border p-4 shadow-soft ${
                        active ? "border-slate-100 bg-white" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                              <FiHash size={12} />
                              {department.code || "N/D"}
                            </span>
                            <StatusBadge active={active} />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-slate-900">{department.name || department.nombre}</p>
                            <p className="text-sm text-slate-500">ID interno: {department.id}</p>
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-2 sm:min-w-[220px]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Descripción</p>
                          <p className="mt-1 text-sm text-slate-700">{department.description || "Sin descripción registrada"}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Button variant="secondary" leftIcon={FiEdit2} className="justify-center" onClick={() => openModal(department)}>
                          Editar
                        </Button>
                        <Button
                          variant={active ? "danger" : "success"}
                          leftIcon={active ? FiXCircle : FiRotateCcw}
                          className="justify-center"
                          onClick={() =>
                            setActionState({ department, mode: active ? "deactivate" : "reactivate" })
                          }
                        >
                          {active ? "Desactivar" : "Reactivar"}
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
        title={editing ? "Editar departamento" : "Nuevo departamento"}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Registra la unidad organizacional con nombre, código y una descripción breve que ayude a su uso
            operativo dentro del sistema.
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(180px,0.8fr)]">
            <Input
              label="Nombre del departamento"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej. Servicio Técnico"
              containerClassName="mb-0"
              autoFocus
              required
            />
            <Input
              label="Código"
              value={codigo}
              onChange={(event) => setCodigo(event.target.value.toUpperCase())}
              placeholder="Ej. STC"
              containerClassName="mb-0"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              placeholder="Describe el propósito o alcance operativo del departamento"
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Guardar cambios" : "Crear departamento"}
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

export default Departamentos;
