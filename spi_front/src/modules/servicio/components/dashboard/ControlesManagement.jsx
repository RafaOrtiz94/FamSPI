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

const ControlesManagement = ({ onRefresh }) => {
 const [controles, setControles] = useState([]);
 const [loading, setLoading] = useState(false);
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [selectedControl, setSelectedControl] = useState(null);
 const [formData, setFormData] = useState({
 nombre: "",
 descripcion: "",
 costo_unitario: "",
 costo_mensual: "",
 costo_anual: "",
 cantidad: "",
 unidad_medida: "",
 categoria: "",
 nivel: "",
 rango_referencia: ""
 });
 const [errors, setErrors] = useState({});

 const { execute: fetchControles } = useApi(api.getControles, {
 onSuccess: (data) => setControles(data.data || []),
 onError: (err) => console.error("Error al cargar controles:", err)
 });

 const { execute: createControl } = useApi(api.createControl, {
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
 nivel: "",
 rango_referencia: ""
 });
 fetchControles();
 onRefresh();
 },
 onError: (err) => {
 console.error("Error al crear control:", err);
 setErrors({ general: err.message || "No se pudo crear el control" });
 }
 });

 const { execute: updateControl } = useApi(api.updateControl, {
 onSuccess: () => {
 setShowEditModal(false);
 setSelectedControl(null);
 fetchControles();
 onRefresh();
 },
 onError: (err) => {
 console.error("Error al actualizar control:", err);
 setErrors({ general: err.message || "No se pudo actualizar el control" });
 }
 });

 const { execute: deleteControl } = useApi(api.deleteControl, {
 onSuccess: () => {
 fetchControles();
 onRefresh();
 },
 onError: (err) => {
 console.error("Error al eliminar control:", err);
 setErrors({ general: err.message || "No se pudo eliminar el control" });
 }
 });

 useEffect(() => {
 fetchControles();
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

 createControl(formData);
 };

 const handleEdit = (control) => {
 setSelectedControl(control);
 setFormData({
 nombre: control.nombre || "",
 descripcion: control.descripcion || "",
 costo_unitario: control.costo_unitario || "",
 costo_mensual: control.costo_mensual || "",
 costo_anual: control.costo_anual || "",
 cantidad: control.cantidad || "",
 unidad_medida: control.unidad_medida || "",
 categoria: control.categoria || "",
 nivel: control.nivel || "",
 rango_referencia: control.rango_referencia || ""
 });
 setShowEditModal(true);
 setErrors({});
 };

 const handleUpdate = () => {
 if (!selectedControl) return;

 const newErrors = {};
 if (!formData.nombre) newErrors.nombre = "El nombre es requerido";
 if (!formData.costo_unitario) newErrors.costo_unitario = "El costo unitario es requerido";
 if (!formData.cantidad) newErrors.cantidad = "La cantidad es requerida";

 if (Object.keys(newErrors).length > 0) {
 setErrors(newErrors);
 return;
 }

 updateControl(selectedControl.id, formData);
 };

 const handleDelete = (id) => {
 if (window.confirm("¿Está seguro de que desea eliminar este control?")) {
 deleteControl(id);
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
 { key: "nivel", label: "Nivel", sortable: true },
 { key: "rango_referencia", label: "Rango de Referencia", sortable: true },
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
 <h3 className="text-lg font-semibold text-gray-900">Gestión de Controles</h3>
 <div className="flex gap-2">
 <Button
 onClick={() => setShowCreateModal(true)}
 className="bg-blue-500 hover:bg-blue-600"
 >
 + Nuevo Control
 </Button>
 <Button
 onClick={() => fetchControles()}
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
 data={controles}
 loading={loading}
 emptyMessage="No hay controles registrados"
 />
 </Card>

 {/* Modal Crear Control */}
 <Modal
 open={showCreateModal}
 onClose={() => setShowCreateModal(false)}
 title="Crear Nuevo Control"
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
 placeholder="Descripción del control"
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
 placeholder="Ej: Unidad, Caja, Paquete"
 />

 <Input
 label="Categoría"
 value={formData.categoria}
 onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
 placeholder="Ej: Control de Calidad, Control de Proceso"
 />

 <Input
 label="Nivel"
 value={formData.nivel}
 onChange={(e) => setFormData({ ...formData, nivel: e.target.value })}
 placeholder="Ej: Nivel 1, Nivel 2, Nivel 3"
 />

 <Input
 label="Rango de Referencia"
 value={formData.rango_referencia}
 onChange={(e) => setFormData({ ...formData, rango_referencia: e.target.value })}
 placeholder="Ej: 100-200, Normal/Anormal"
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
 Crear Control
 </Button>
 </div>
 </div>
 </Modal>

 {/* Modal Editar Control */}
 <Modal
 open={showEditModal}
 onClose={() => setShowEditModal(false)}
 title="Editar Control"
 >
 <div className="space-y-4">
 {selectedControl && (
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
 label="Nivel"
 value={formData.nivel}
 onChange={(e) => setFormData({ ...formData, nivel: e.target.value })}
 />

 <Input
 label="Rango de Referencia"
 value={formData.rango_referencia}
 onChange={(e) => setFormData({ ...formData, rango_referencia: e.target.value })}
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
 Actualizar Control
 </Button>
 </div>
 </div>
 </Modal>
 </>
 );
};

export default ControlesManagement;