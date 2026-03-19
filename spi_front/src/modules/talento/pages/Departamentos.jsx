import React, { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import toast from "react-hot-toast";

import { createDepartment, deleteDepartment, getDepartments, updateDepartment } from "../../../core/api/departmentsApi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import Input from "../../../core/ui/components/Input";
import Modal from "../../../core/ui/components/Modal";

const Departamentos = () => {
 const [departamentos, setDepartamentos] = useState([]);
 const [loading, setLoading] = useState(true);
 const [modalOpen, setModalOpen] = useState(false);
 const [editing, setEditing] = useState(null);
 const [nombre, setNombre] = useState("");
 const [codigo, setCodigo] = useState("");
 const [descripcion, setDescripcion] = useState("");
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");

 const fetchDepartamentos = async () => {
 try {
 const departamentosList = await getDepartments({ include_inactive: true });
 setDepartamentos(Array.isArray(departamentosList) ? departamentosList : []);
 } catch (err) {
 console.error("Error al cargar departamentos:", err);
 toast.error("Error al cargar los departamentos");
 setDepartamentos([]);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchDepartamentos();
 }, []);

 const isInactive = (dept) => String(dept?.status || "").toLowerCase() === "inactive" || dept?.active === false;

 const handleOpenModal = (dept = null) => {
 if (dept) {
 setEditing(dept);
 setNombre(dept.name || dept.nombre || "");
 setCodigo(dept.code || "");
 setDescripcion(dept.description || "");
 } else {
 setEditing(null);
 setNombre("");
 setCodigo("");
 setDescripcion("");
 }
 setModalOpen(true);
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 if (!nombre.trim()) return toast.error("El nombre es obligatorio");

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

 setModalOpen(false);
 fetchDepartamentos();
 } catch (err) {
 console.error("Error al guardar:", err);
 toast.error("No se pudo guardar el departamento");
 }
 };

 const handleToggleStatus = async (dept) => {
 const deactivate = !isInactive(dept);
 const actionLabel = deactivate ? "desactivar" : "reactivar";

 if (!window.confirm(`¿Deseas ${actionLabel} este departamento?`)) return;

 try {
 if (deactivate) {
 await deleteDepartment(dept.id);
 toast.success("Departamento desactivado");
 } else {
 await updateDepartment(dept.id, { status: "active" });
 toast.success("Departamento reactivado");
 }
 fetchDepartamentos();
 } catch (err) {
 console.error("Error al actualizar:", err);
 toast.error("No se pudo actualizar el departamento");
 }
 };

 const filteredDepartamentos = useMemo(() => {
 const needle = search.trim().toLowerCase();
 return departamentos.filter((dept) => {
 const inactive = isInactive(dept);
 if (statusFilter === "active" && inactive) return false;
 if (statusFilter === "inactive" && !inactive) return false;
 if (!needle) return true;
 return (
 String(dept.name || dept.nombre || "").toLowerCase().includes(needle) ||
 String(dept.code || "").toLowerCase().includes(needle)
 );
 });
 }, [departamentos, search, statusFilter]);

 const summary = useMemo(() => {
 return departamentos.reduce(
 (acc, dept) => {
 if (isInactive(dept)) acc.inactive += 1;
 else acc.active += 1;
 acc.total += 1;
 return acc;
 },
 { total: 0, active: 0, inactive: 0 }
 );
 }, [departamentos]);

 return (
 <div className="p-6 space-y-6">
 <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-gray-800">Departamentos</h1>
 <p className="text-sm text-gray-500">
 Organiza las unidades internas y gestiona nombres, codigos y estado.
 </p>
 </div>
 <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
 <Input
 placeholder="Buscar por nombre o codigo..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="flex-1"
 />
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
 >
 <option value="all">Todos</option>
 <option value="active">Activos</option>
 <option value="inactive">Inactivos</option>
 </select>
 <Button
 onClick={() => handleOpenModal()}
 variant="primary"
 className="flex items-center gap-2 justify-center"
 >
 <FiPlus className="text-lg" /> Nuevo Departamento
 </Button>
 </div>
 </div>

 <div className="grid gap-4 md:grid-cols-3">
 <Card className="p-4">
 <p className="text-xs uppercase tracking-wide text-gray-400">Total</p>
 <p className="text-2xl font-semibold text-gray-800">{summary.total}</p>
 <p className="text-xs text-gray-500">Departamentos registrados</p>
 </Card>
 <Card className="p-4">
 <p className="text-xs uppercase tracking-wide text-gray-400">Activos</p>
 <p className="text-2xl font-semibold text-emerald-600">{summary.active}</p>
 <p className="text-xs text-gray-500">Disponibles para asignacion</p>
 </Card>
 <Card className="p-4">
 <p className="text-xs uppercase tracking-wide text-gray-400">Inactivos</p>
 <p className="text-2xl font-semibold text-amber-600">{summary.inactive}</p>
 <p className="text-xs text-gray-500">Fuera de uso operativo</p>
 </Card>
 </div>

 <Card className="p-4">
 {loading ? (
 <div className="flex justify-center py-10">
 <div className="h-10 w-10 animate-spin rounded-full border-t-4 border-blue-600" />
 </div>
 ) : filteredDepartamentos.length === 0 ? (
 <p className="py-6 text-center text-gray-500">No hay departamentos que coincidan con tu busqueda.</p>
 ) : (
 <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
 {filteredDepartamentos.map((dept) => {
 const inactive = isInactive(dept);
 return (
 <div
 key={dept.id}
 className={`flex flex-col rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ${
 inactive ? "border-gray-200 bg-gray-50 opacity-80" : "border-gray-100 bg-white"
 }`}
 >
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-lg font-semibold text-gray-800">{dept.name || dept.nombre}</p>
 <p className="text-xs uppercase tracking-wide text-gray-400">
 Codigo: {dept.code || "N/D"}
 </p>
 </div>
 <div className="flex flex-col items-end gap-2">
 <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
 #{dept.id}
 </span>
 <span
 className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
 inactive ? "bg-gray-200 text-gray-700" : "bg-emerald-50 text-emerald-700"
 }`}
 >
 {inactive ? "Inactivo" : "Activo"}
 </span>
 </div>
 </div>

 <p className="mt-3 min-h-[48px] text-sm text-gray-600">
 {dept.description || "Sin descripcion registrada."}
 </p>

 <div className="mt-4 flex gap-2">
 <Button
 variant="secondary"
 className="flex-1 inline-flex items-center justify-center gap-1"
 onClick={() => handleOpenModal(dept)}
 >
 <FiEdit2 /> Editar
 </Button>
 <Button
 variant="danger"
 className="flex-1 inline-flex items-center justify-center gap-1"
 onClick={() => handleToggleStatus(dept)}
 >
 <FiTrash2 /> {inactive ? "Reactivar" : "Desactivar"}
 </Button>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </Card>

 {modalOpen && (
 <Modal
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 title={editing ? "Editar Departamento" : "Nuevo Departamento"}
 >
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="mb-1 block text-sm font-medium text-gray-700">Nombre del Departamento</label>
 <Input
 value={nombre}
 onChange={(e) => setNombre(e.target.value)}
 placeholder="Ejemplo: Servicio Tecnico"
 />
 </div>

 <div>
 <label className="mb-1 block text-sm font-medium text-gray-700">Codigo</label>
 <Input
 value={codigo}
 onChange={(e) => setCodigo(e.target.value)}
 placeholder="Ejemplo: STC"
 />
 </div>

 <div>
 <label className="mb-1 block text-sm font-medium text-gray-700">Descripcion</label>
 <Input
 value={descripcion}
 onChange={(e) => setDescripcion(e.target.value)}
 placeholder="Descripcion opcional"
 />
 </div>

 <div className="flex justify-end gap-2">
 <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
 Cancelar
 </Button>
 <Button type="submit" variant="primary">
 {editing ? "Actualizar" : "Guardar"}
 </Button>
 </div>
 </form>
 </Modal>
 )}
 </div>
 );
};

export default Departamentos;

