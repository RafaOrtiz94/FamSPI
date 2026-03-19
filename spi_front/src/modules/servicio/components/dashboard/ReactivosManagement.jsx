import React, { useState, useEffect } from "react";
import * as api from "../../../../core/api/inventarioApi";
import { useApi } from "../../../../core/hooks/useApi";
import Button from "../../../../core/ui/components/Button";
import Card from "../../../../core/ui/components/Card";
import Modal from "../../../../core/ui/components/Modal";
import Input from "../../../../core/ui/components/Input";
import Select from "../../../../core/ui/components/Select";
import Table from "../../../../core/ui/components/Table";
import Alert from "../../../../core/ui/components/Alert";

const ReactivosManagement = ({ onRefresh }) => {
 const [reactivos, setReactivos] = useState([]);
 const [loading, setLoading] = useState(false);
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [selectedReactivo, setSelectedReactivo] = useState(null);
 const [formData, setFormData] = useState({
 nombre: "",
 descripcion: "",
 costo_unitario: "",
 costo_mensual: "",
 costo_anual: "",
 cantidad: "",
 unidad_medida: "",
 categoria: "",
 concentracion: "",
 fecha_caducidad: ""
 });
 const [errors, setErrors] = useState({});

 const { execute: fetchReactivos } = useApi(api.getReactivos, {
 onSuccess: (data) => setReactivos(data.data || []),
 onError: (err) => console.error("Error al cargar reactivos:", err)
 });

 const { execute: createReactivo } = useApi(api.createReactivo, {
 onSuccess: () => {
 setShowCreateModal(false);
 setFormData({
 nombre: "",
 descripcion: "",
 costo_unitario: "",
 costo_mensual: "",
 costo_anual: "",
 cantidad: "",
 unidad_medida: "",
 categoria: "",
 concentracion: "",
 fecha_caducidad: ""
 });
 fetchReactivos();
 onRefresh();
 },
 onError: (err) => {
 console.error("Error al crear reactivo:", err);
 setErrors({ general: err.message || "No se pudo crear el reactivo" });
 }
 });

 const { execute: updateReactivo } = useApi(api.updateReactivo, {
 onSuccess: () => {
 setShowEditModal(false);
 setSelectedReactivo(null);
 fetchReactivos();
 onRefresh();
 },
 onError: (err) => {
 console.error("Error al actualizar reactivo:", err);
 setErrors({ general: err.message || "No se pudo actualizar el reactivo" });
 }
 });

 const { execute: deleteReactivo } = useApi(api.deleteReactivo, {
 onSuccess: () => {
 fetchReactivos();
 onRefresh();
 },
 onError: (err) => {
 console.error("Error al eliminar reactivo:", err);
 setErrors({ general: err.message || "No se pudo eliminar el reactivo" });
 }
 });

 useEffect(() => {
 fetchReactivos();
 }, []);

 const handleCreate = () => {
 const newErrors = {};
 if (!formData.nombre) newErrors.nombre = "El nombre es requerido";
 if (!formData.costo_unitario) newErrors.costo_unitario = "El costo unitario es requerido";
 if (!formData.cantidad) newErrors.cantidad = "La cantidad es requerida";

 if (Object.keys(newErrors).length > 0) {
 setErrors(newErrors);
 return;
 }

 createReactivo(formData);
 };

 const handleEdit = (reactivo) => {
 setSelectedReactivo(reactivo);
 setFormData({
 nombre: reactivo.nombre || "",
 descripcion: reactivo.descripcion || "",
 costo_unitario: reactivo.costo_unitario || "",
 costo_mensual: reactivo.costo_mensual || "",
 costo_anual: reactivo.costo_anual || "",
 cantidad: reactivo.cantidad || "",
 unidad_medida: reactivo.unidad_medida || "",
 categoria: reactivo.categoria || "",
 concentracion: reactivo.concentracion || "",
 fecha_caducidad: reactivo.fecha_caducidad || ""
 });
 setShowEditModal(true);
 setErrors({});
 };

 const handleUpdate = () => {
 if (!selectedReactivo) return;

 const newErrors = {};
 if (!formData.nombre) newErrors.nombre = "El nombre es requerido";
 if (!formData.costo_unitario) newErrors.costo_unitario = "El costo unitario es requerido";
 if (!formData.cantidad) newErrors.cantidad = "La cantidad es requerida";

 if (Object.keys(newErrors).length > 0) {
 setErrors(newErrors);
 return;
 }

 updateReactivo(selectedReactivo.id, formData);
 };

 const handleDelete = (id) => {
 if (window.confirm("¿Está seguro de que desea eliminar este reactivo?")) {
 deleteReactivo(id);
 }
 };

 const columns = [
 { key: "id", label: "ID", sortable: true },
 { key: "nombre", label: "Nombre", sortable: true },
 { key: "descripcion", label: "Descripción", sortable: true },
 { key: "costo_unitario", label: "Costo Unitario", sortable: true },
 { key: "costo_mensual", label: "Costo Mensual", sortable: true },
 { key: "costo_anual", label: "Costo Anual", sortable: true },
 { key: "cantidad", label: "Cantidad", sortable: true },
 { key: "unidad_medida", label: "Unidad de Medida", sortable: true },
 { key: "categoria", label: "Categoría", sortable: true },
 { key: "concentracion", label: "Concentración", sortable: true },
 { key: "fecha_caducidad", label: "Fecha de Caducidad", sortable: true },
 {
 key: "acciones",
 label: "Acciones",
 render: (row) => (
 <div className="flex gap-2">
 <Button
 size="sm"
 onClick={() => handleEdit(row)}
 className="bg-blue-500 hover:bg-blue-600"
 >
 Editar
 </Button>
 <Button
 size="sm"
 onClick={() => handleDelete(row.id)}
 className="bg-red-500 hover:bg-red-600"
 >
 Eliminar
 </Button>
 </div>
 )
 }
 ];

 return (
 <>
 <Card className="p-5 mb-6">
 <div className="flex items-center justify-between gap-4 mb-4">
 <h3 className="text-lg font-semibold text-gray-900">Gestión de Reactivos</h3>
 <div className="flex gap-2">
 <Button
 onClick={() => setShowCreateModal(true)}
 className="bg-blue-500 hover:bg-blue-600"
 >
 + Nuevo Reactivo
 </Button>
 <Button
 onClick={() => fetchReactivos()}
 variant="outline"
 >
 Actualizar
 </Button>
 </div>
 </div>

 {errors.general && (
 <Alert type="error" className="mb-4">
 {errors.general}
 </Alert>
 )}

 <Table
 columns={columns}
 data={reactivos}
 loading={loading}
 emptyMessage="No hay reactivos registrados"
 />
 </Card>

 {/* Modal Crear Reactivo */}
 <Modal
 open={showCreateModal}
 onClose={() => setShowCreateModal(false)}
 title="Crear Nuevo Reactivo"
 >
 <div className="space-y-4">
 <Input
 label="Nombre"
 value={formData.nombre}
 onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
 error={errors.nombre}
 required
 />

 <Input
 label="Descripción"
 value={formData.descripcion}
 onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
 placeholder="Descripción del reactivo"
 />

 <Input
 label="Costo Unitario"
 type="number"
 step="0.01"
 value={formData.costo_unitario}
 onChange={(e) => setFormData({ ...formData, costo_unitario: e.target.value })}
 error={errors.costo_unitario}
 required
 />

 <Input
 label="Costo Mensual"
 type="number"
 step="0.01"
 value={formData.costo_mensual}
 onChange={(e) => setFormData({ ...formData, costo_mensual: e.target.value })}
 />

 <Input
 label="Costo Anual"
 type="number"
 step="0.01"
 value={formData.costo_anual}
 onChange={(e) => setFormData({ ...formData, costo_anual: e.target.value })}
 />

 <Input
 label="Cantidad"
 type="number"
 value={formData.cantidad}
 onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
 error={errors.cantidad}
 required
 />

 <Input
 label="Unidad de Medida"
 value={formData.unidad_medida}
 onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}
 placeholder="Ej: ml, g, L"
 />

 <Input
 label="Categoría"
 value={formData.categoria}
 onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
 placeholder="Ej: Reactivo Químico, Reactivo Biológico"
 />

 <Input
 label="Concentración"
 value={formData.concentracion}
 onChange={(e) => setFormData({ ...formData, concentracion: e.target.value })}
 placeholder="Ej: 1M, 0.1N, 10%"
 />

 <Input
 label="Fecha de Caducidad"
 type="date"
 value={formData.fecha_caducidad}
 onChange={(e) => setFormData({ ...formData, fecha_caducidad: e.target.value })}
 />

 <div className="flex gap-2 justify-end">
 <Button
 variant="outline"
 onClick={() => setShowCreateModal(false)}
 >
 Cancelar
 </Button>
 <Button
 onClick={handleCreate}
 className="bg-blue-500 hover:bg-blue-600"
 >
 Crear Reactivo
 </Button>
 </div>
 </div>
 </Modal>

 {/* Modal Editar Reactivo */}
 <Modal
 open={showEditModal}
 onClose={() => setShowEditModal(false)}
 title="Editar Reactivo"
 >
 <div className="space-y-4">
 {selectedReactivo && (
 <>
 <Input
 label="Nombre"
 value={formData.nombre}
 onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
 error={errors.nombre}
 required
 />

 <Input
 label="Descripción"
 value={formData.descripcion}
 onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
 />

 <Input
 label="Costo Unitario"
 type="number"
 step="0.01"
 value={formData.costo_unitario}
 onChange={(e) => setFormData({ ...formData, costo_unitario: e.target.value })}
 error={errors.costo_unitario}
 required
 />

 <Input
 label="Costo Mensual"
 type="number"
 step="0.01"
 value={formData.costo_mensual}
 onChange={(e) => setFormData({ ...formData, costo_mensual: e.target.value })}
 />

 <Input
 label="Costo Anual"
 type="number"
 step="0.01"
 value={formData.costo_anual}
 onChange={(e) => setFormData({ ...formData, costo_anual: e.target.value })}
 />

 <Input
 label="Cantidad"
 type="number"
 value={formData.cantidad}
 onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
 error={errors.cantidad}
 required
 />

 <Input
 label="Unidad de Medida"
 value={formData.unidad_medida}
 onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}
 />

 <Input
 label="Categoría"
 value={formData.categoria}
 onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
 />

 <Input
 label="Concentración"
 value={formData.concentracion}
 onChange={(e) => setFormData({ ...formData, concentracion: e.target.value })}
 />

 <Input
 label="Fecha de Caducidad"
 type="date"
 value={formData.fecha_caducidad}
 onChange={(e) => setFormData({ ...formData, fecha_caducidad: e.target.value })}
 />
 </>
 )}

 <div className="flex gap-2 justify-end">
 <Button
 variant="outline"
 onClick={() => setShowEditModal(false)}
 >
 Cancelar
 </Button>
 <Button
 onClick={handleUpdate}
 className="bg-blue-500 hover:bg-blue-600"
 >
 Actualizar Reactivo
 </Button>
 </div>
 </div>
 </Modal>
 </>
 );
};

export default ReactivosManagement;