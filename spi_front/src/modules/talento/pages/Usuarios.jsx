import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import {
 getUsers,
 createUser,
 updateUser,
} from "../../../core/api/usersApi";
import { getDepartments } from "../../../core/api/departmentsApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Input from "../../../core/ui/components/Input";
import Select from "../../../core/ui/components/Select";
import Modal from "../../../core/ui/components/Modal";
import toast from "react-hot-toast";

const ROLE_OPTIONS = [
 { label: "Pendiente", value: "pendiente" },
 { label: "Gerencia", value: "gerencia" },
 { label: "Comercial", value: "comercial" },
 { label: "Servicio Tecnico", value: "servicio_tecnico" },
 { label: "Tecnico", value: "tecnico" },
 { label: "Finanzas", value: "finanzas" },
 { label: "Talento Humano", value: "talento_humano" },
 { label: "TI", value: "ti" },
 { label: "Usuario", value: "usuario" },
];

const Usuarios = () => {
 const [users, setUsers] = useState([]);
 const [departments, setDepartments] = useState([]);
 const [loading, setLoading] = useState(true);
 const [modalOpen, setModalOpen] = useState(false);
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [roleFilter, setRoleFilter] = useState("");
 const [departmentFilter, setDepartmentFilter] = useState("");
 const [editing, setEditing] = useState(null);
 const [form, setForm] = useState({
 fullname: "",
 email: "",
 role: "pendiente",
 department_id: "",
 google_id: "",
 });

 const activeDepartments = useMemo(
 () => departments.filter((department) => String(department.status || "active").toLowerCase() === "active"),
 [departments]
 );

 const loadData = async () => {
 try {
 setLoading(true);
 const [usersData, depData] = await Promise.all([
 getUsers({
 search: search.trim() || undefined,
 role: roleFilter || undefined,
 department_id: departmentFilter || undefined,
 active: statusFilter === 'all' ? undefined : statusFilter === 'active',
 }),
 getDepartments({ include_inactive: true }),
 ]);
 setUsers(Array.isArray(usersData) ? usersData : []);
 setDepartments(Array.isArray(depData) ? depData : []);
 } catch (error) {
 console.error("Error cargando usuarios:", error);
 toast.error("Error al cargar usuarios");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadData();
 }, [search, roleFilter, departmentFilter, statusFilter]);

 const openModal = (user = null) => {
 if (user) {
 setEditing(user);
 setForm({
 fullname: user.fullname || "",
 email: user.email || "",
 role: user.role || "pendiente",
 department_id: user.department_id || "",
 google_id: user.google_id || "",
 });
 } else {
 setEditing(null);
 setForm({
 fullname: "",
 email: "",
 role: "pendiente",
 department_id: "",
 google_id: "",
 });
 }
 setModalOpen(true);
 };

 const handleSubmit = async (event) => {
 event.preventDefault();
 if (!form.email.trim() || !form.fullname.trim()) {
 toast.error("Nombre y correo son obligatorios");
 return;
 }

 try {
 const payload = {
 fullname: form.fullname,
 email: form.email,
 role: form.role,
 department_id: form.department_id || null,
 google_id: form.google_id || null,
 };

 if (editing) {
 await updateUser(editing.id, payload);
 toast.success("Usuario actualizado");
 } else {
 await createUser(payload);
 toast.success("Usuario creado");
 }
 setModalOpen(false);
 loadData();
 } catch (err) {
 console.error("Error guardando usuario:", err);
 toast.error(err?.response?.data?.message || "No se pudo guardar el usuario");
 }
 };

 const handleToggleStatus = async (user) => {
 const nextActive = user.active === false;
 const actionLabel = nextActive ? "reactivar" : "desactivar";
 const confirmed = window.confirm(`¿Deseas ${actionLabel} al usuario ${user.fullname || user.email}?`);
 if (!confirmed) return;
 try {
 await updateUser(user.id, { active: nextActive });
 toast.success(nextActive ? "Usuario reactivado" : "Usuario desactivado");
 loadData();
 } catch (err) {
 console.error("Error actualizando estado del usuario:", err);
 const serverMsg = err?.response?.data?.message;
 toast.error(serverMsg || `No se pudo ${actionLabel} el usuario`);
 }
 };

 const visibleUsers = useMemo(() => {
 return users.filter((user) => {
 if (statusFilter === "active") return user.active !== false;
 if (statusFilter === "inactive") return user.active === false;
 return true;
 });
 }, [users, statusFilter]);

 const summary = useMemo(() => {
 return visibleUsers.reduce(
 (acc, user) => {
 acc.total += 1;
 if (user.active === false) acc.inactive += 1;
 else acc.active += 1;
 if (user.department_name) acc.withDepartment += 1;
 else acc.withoutDepartment += 1;
 return acc;
 },
 { total: 0, active: 0, inactive: 0, withDepartment: 0, withoutDepartment: 0 }
 );
 }, [visibleUsers]);

 if (loading) {
 return (
 <div className="flex justify-center items-center min-h-[70vh]">
 <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
 </div>
 );
 }

 return (
 <div className="p-6 space-y-6">
 <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
 <div>
 <h1 className="text-2xl font-semibold text-gray-800">Gestion de Usuarios</h1>
 <p className="text-sm text-gray-500">Administra roles, departamentos y altas manuales.</p>
 </div>
 <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
 <Input
 placeholder="Buscar por nombre, correo o rol..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="flex-1"
 />
 <Select
 value={roleFilter}
 onChange={(e) => setRoleFilter(e.target.value)}
 options={[{ label: "Todos los roles", value: "" }, ...ROLE_OPTIONS]}
 />
 <Select
 value={departmentFilter}
 onChange={(e) => setDepartmentFilter(e.target.value)}
 options={[
 { label: "Todos los departamentos", value: "" },
 ...activeDepartments.map((department) => ({ label: department.name, value: String(department.id) })),
 ]}
 />
 <Select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 options={[
 { label: "Todos", value: "all" },
 { label: "Activos", value: "active" },
 { label: "Inactivos", value: "inactive" },
 ]}
 />
 <Button className="flex items-center gap-2" onClick={() => openModal()}>
 <FiPlus /> Nuevo usuario
 </Button>
 </div>
 </div>

 <div className="grid gap-4 sm:grid-cols-4">
 <Card className="p-4 text-center">
 <p className="text-xs uppercase tracking-wide text-gray-400">Total</p>
 <p className="text-3xl font-semibold text-gray-800">{summary.total}</p>
 </Card>
 <Card className="p-4 text-center">
 <p className="text-xs uppercase tracking-wide text-gray-400">Activos</p>
 <p className="text-3xl font-semibold text-emerald-600">{summary.active}</p>
 </Card>
 <Card className="p-4 text-center">
 <p className="text-xs uppercase tracking-wide text-gray-400">Inactivos</p>
 <p className="text-3xl font-semibold text-slate-600">{summary.inactive}</p>
 </Card>
 <Card className="p-4 text-center">
 <p className="text-xs uppercase tracking-wide text-gray-400">Con departamento</p>
 <p className="text-3xl font-semibold text-indigo-600">{summary.withDepartment}</p>
 </Card>
 </div>

 <Card className="shadow-sm">
 {visibleUsers.length === 0 ? (
 <p className="text-center text-gray-500 py-8">No hay usuarios que coincidan con tu busqueda.</p>
 ) : (
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
 {visibleUsers.map((user) => {
 const roleLabel = ROLE_OPTIONS.find((role) => role.value === user.role)?.label || user.role || "Pendiente";
 const isInactive = user.active === false;

 return (
 <div
 key={user.id}
 className={`border rounded-xl p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow ${
 isInactive ? "border-gray-200 bg-gray-50 opacity-80" : "border-gray-100 bg-white"
 }`}
 >
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-lg font-semibold text-gray-800">{user.fullname || "Sin nombre"}</p>
 <p className="text-sm text-gray-500 break-all">{user.email}</p>
 </div>
 <div className="flex flex-col items-end gap-2">
 <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">{roleLabel}</span>
 <span
 className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
 isInactive ? "bg-slate-200 text-slate-700" : "bg-emerald-50 text-emerald-700"
 }`}
 >
 {isInactive ? "Inactivo" : "Activo"}
 </span>
 </div>
 </div>

 <div className="mt-4 flex flex-col gap-3 text-sm text-gray-600">
 <div className="flex items-center justify-between gap-3">
 <span className="text-gray-400 text-xs uppercase tracking-wide">Departamento</span>
 <span className="font-medium text-gray-800 text-right">{user.department_name || "Sin asignar"}</span>
 </div>
 <div className="flex items-center justify-between gap-3">
 <span className="text-gray-400 text-xs uppercase tracking-wide">Google ID</span>
 <span className="text-gray-700 truncate max-w-[160px]">{user.google_id || "-"}</span>
 </div>
 <div className="flex items-center justify-between gap-3">
 <span className="text-gray-400 text-xs uppercase tracking-wide">Creado</span>
 <span className="text-gray-700">{user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}</span>
 </div>
 </div>

 <div className="mt-4 flex flex-wrap gap-2">
 <Button
 variant="secondary"
 className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1"
 onClick={() => openModal(user)}
 >
 <FiEdit2 /> Editar
 </Button>
 <Button
 variant={isInactive ? "secondary" : "danger"}
 className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1"
 onClick={() => handleToggleStatus(user)}
 >
 <FiTrash2 /> {isInactive ? "Reactivar" : "Desactivar"}
 </Button>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </Card>

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar usuario" : "Nuevo usuario"}>
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className="text-sm font-medium text-gray-700">Nombre completo</label>
 <Input
 value={form.fullname}
 onChange={(e) => setForm({ ...form, fullname: e.target.value })}
 placeholder="Ej. Maria Perez"
 required
 />
 </div>
 <div>
 <label className="text-sm font-medium text-gray-700">Correo</label>
 <Input
 type="email"
 value={form.email}
 onChange={(e) => setForm({ ...form, email: e.target.value })}
 placeholder="usuario@famproject.com.ec"
 required
 />
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className="text-sm font-medium text-gray-700">Rol</label>
 <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={ROLE_OPTIONS} />
 </div>
 <div>
 <label className="text-sm font-medium text-gray-700">Departamento</label>
 <Select
 value={form.department_id || ""}
 onChange={(e) => setForm({ ...form, department_id: e.target.value || "" })}
 options={[
 { label: "Sin asignar", value: "" },
 ...activeDepartments.map((department) => ({ label: department.name, value: department.id })),
 ]}
 />
 </div>
 </div>

 <div>
 <label className="text-sm font-medium text-gray-700">Google ID (opcional)</label>
 <Input
 value={form.google_id || ""}
 onChange={(e) => setForm({ ...form, google_id: e.target.value })}
 placeholder="ID de Google Workspace"
 />
 </div>

 <div className="flex justify-end gap-2 pt-2">
 <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
 Cancelar
 </Button>
 <Button type="submit" variant="primary">
 {editing ? "Actualizar" : "Crear"}
 </Button>
 </div>
 </form>
 </Modal>
 </div>
 );
};

export default Usuarios;

