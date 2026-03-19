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

const ConsumiblesManagement = ({ onRefresh }) => {
 const [consumibles, setConsumibles] = useState([]);
 const [loading, setLoading] = useState(false);
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [selectedConsumible, setSelectedConsumible] = useState(null);
 const [formData, setFormData] = useState({
 nombre: "",
 descripcion: "",
 costo_unitario: "",
 costo_mensual: "",
 costo_anual: "",
 cantidad: "",
 unidad_medida: "",
 categoria: "",
 proveedor: ""
 });
 const [errors, setErrors] = useState({});

 const { execute: fetchConsumibles } = useApi(api.getConsumibles, {
 onSuccess: (data) => setConsumibles(data.data || []),
 onError: (err) => console.error("Error al cargar consumibles:", err)
 });

 const { execute: createConsumible } = useApi(api.createConsumible, {
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
 proveedor: ""
 });
 fetchConsumibles();
 onRefresh();
 },
 onError: (err) => {
 console.error("Error al crear consumible:", err);
 setErrors({ general: err.message || "No se pudo crear el consumible" });
 }
 });

 const { execute: updateConsumible } = useApi(api.updateConsumible, {
 onSuccess: () => {
 setShowEditModal(false);
 setSelectedConsumible(null);
 fetchConsumibles();
 onRefresh();
 },
 onError: (err) => {
 console.error("Error al actualizar consumible:", err);
 setErrors({ general: err.message || "No se pudo actualizar el consumible" });
 }
 });

 const { execute: deleteConsumible } = useApi(api.deleteConsumible, {
 onSuccess: () => {
 fetchConsumibles();
 onRefresh();
 },
 onError: (err) => {
 console.error("Error al eliminar consumible:", err);
 setErrors({ general: err.message || "No se pudo eliminar el consumible" });
 }
 });

 useEffect(() => {
 fetchConsumibles();
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

 createConsumible(formData);
 };

 const handleEdit = (consumible) => {
 setSelectedConsumible(consumible);
 setFormData({
 nombre: consumible.nombre || "",
 descripcion: consumible.descripcion || "",
 costo_unitario: consumible.costo_unitario || "",
 costo_mensual: consumible.costo_mensual || "",
 costo_anual: consumible.costo_anual || "",
 cantidad: consumible.cantidad || "",
 unidad_medida: consumible.unidad_medida || "",
 categoria: consumible.categoria || "",
 proveedor: consumible.proveedor || ""
 });
 setShowEditModal(true);
 setErrors({});
 };

 const handleUpdate = () => {
 if (!selectedConsumible) return;

 const newErrors = {};
 if (!formData.nombre) newErrors.nombre = "El nombre es requerido";
 if (!formData.costo_unitario) newErrors.costo_unitario = "El costo unitario es requerido";
 if (!formData.cantidad) newErrors.cantidad = "La cantidad es requerida";

 if (Object.keys(newErrors).length > 0) {
 setErrors(newErrors);
 return;
 }

 updateConsumible(selectedConsumible.id, formData);
 };

 const handleDelete = (id) => {
 if (window.confirm("¿Está seguro de que desea eliminar este consumible?")) {
 deleteConsumible(id);
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
 { key: "proveedor", label: "Proveedor", sortable: true },
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
 <h3 className="text-lg font-semibold text-gray-900">Gestión de Consumibles</h3>
 <div className="flex gap-2">
 <Button
 onClick={() => setShowCreateModal(true)}
 className="bg-blue-500 hover:bg-blue-600"
 >
 + Nuevo Consumible
 </Button>
 <Button
 onClick={() => fetchConsumibles()}
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
 data={consumibles}
 loading={loading}
 emptyMessage="No hay consumibles registrados"
 />
 </Card>

 {/* Modal Crear Consumible */}
 <Modal
 open={showCreateModal}
 onClose={() => setShowCreateModal(false)}
 title="Crear Nuevo Consumible"
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
 placeholder="Descripción del consumible"
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
 placeholder="Ej: Material de Laboratorio, Suministros de Oficina"
 />

 <Input
 label="Proveedor"
 value={formData.proveedor}
 onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
 placeholder="Nombre del proveedor"
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
 Crear Consumible
 </Button>
 </div>
 </div>
 </Modal>

 {/* Modal Editar Consumible */}
 <Modal
 open={showEditModal}
 onClose={() => setShowEditModal(false)}
 title="Editar Consumible"
 >
 <div className="space-y-4">
 {selectedConsumible && (
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
 label="Proveedor"
 value={formData.proveedor}
 onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
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
 Actualizar Consumible
 </Button>
 </div>
 </div>
 </Modal>
 </>
 );
};

export default ConsumiblesManagement;