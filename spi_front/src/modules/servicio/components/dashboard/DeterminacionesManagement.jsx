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

const DeterminacionesManagement = ({ onRefresh }) => {
  const [determinaciones, setDeterminaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDeterminacion, setSelectedDeterminacion] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    costo_unitario: "",
    costo_mensual: "",
    costo_anual: "",
    frecuencia: "",
    unidad_medida: "",
    categoria: ""
  });
  const [errors, setErrors] = useState({});

  const { execute: fetchDeterminaciones } = useApi(api.getDeterminaciones, {
    onSuccess: (data) => setDeterminaciones(data.data || []),
    onError: (err) => console.error("Error al cargar determinaciones:", err)
  });

  const { execute: createDeterminacion } = useApi(api.createDeterminacion, {
    onSuccess: () => {
      setShowCreateModal(false);
      setFormData({
        nombre: "",
        costo_unitario: "",
        costo_mensual: "",
        costo_anual: "",
        frecuencia: "",
        unidad_medida: "",
        categoria: ""
      });
      fetchDeterminaciones();
      onRefresh();
    },
    onError: (err) => {
      console.error("Error al crear determinación:", err);
      setErrors({ general: err.message || "No se pudo crear la determinación" });
    }
  });

  const { execute: updateDeterminacion } = useApi(api.updateDeterminacion, {
    onSuccess: () => {
      setShowEditModal(false);
      setSelectedDeterminacion(null);
      fetchDeterminaciones();
      onRefresh();
    },
    onError: (err) => {
      console.error("Error al actualizar determinación:", err);
      setErrors({ general: err.message || "No se pudo actualizar la determinación" });
    }
  });

  const { execute: deleteDeterminacion } = useApi(api.deleteDeterminacion, {
    onSuccess: () => {
      fetchDeterminaciones();
      onRefresh();
    },
    onError: (err) => {
      console.error("Error al eliminar determinación:", err);
      setErrors({ general: err.message || "No se pudo eliminar la determinación" });
    }
  });

  useEffect(() => {
    fetchDeterminaciones();
  }, []);

  const handleCreate = () => {
    const newErrors = {};
    if (!formData.nombre) newErrors.nombre = "El nombre es requerido";
    if (!formData.costo_unitario) newErrors.costo_unitario = "El costo unitario es requerido";
    if (!formData.frecuencia) newErrors.frecuencia = "La frecuencia es requerida";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createDeterminacion(formData);
  };

  const handleEdit = (determinacion) => {
    setSelectedDeterminacion(determinacion);
    setFormData({
      nombre: determinacion.nombre || "",
      costo_unitario: determinacion.costo_unitario || "",
      costo_mensual: determinacion.costo_mensual || "",
      costo_anual: determinacion.costo_anual || "",
      frecuencia: determinacion.frecuencia || "",
      unidad_medida: determinacion.unidad_medida || "",
      categoria: determinacion.categoria || ""
    });
    setShowEditModal(true);
    setErrors({});
  };

  const handleUpdate = () => {
    if (!selectedDeterminacion) return;

    const newErrors = {};
    if (!formData.nombre) newErrors.nombre = "El nombre es requerido";
    if (!formData.costo_unitario) newErrors.costo_unitario = "El costo unitario es requerido";
    if (!formData.frecuencia) newErrors.frecuencia = "La frecuencia es requerida";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    updateDeterminacion(selectedDeterminacion.id, formData);
  };

  const handleDelete = (id) => {
    if (window.confirm("¿Está seguro de que desea eliminar esta determinación?")) {
      deleteDeterminacion(id);
    }
  };

  const columns = [
    { key: "id", label: "ID", sortable: true },
    { key: "nombre", label: "Nombre", sortable: true },
    { key: "costo_unitario", label: "Costo Unitario", sortable: true },
    { key: "costo_mensual", label: "Costo Mensual", sortable: true },
    { key: "costo_anual", label: "Costo Anual", sortable: true },
    { key: "frecuencia", label: "Frecuencia", sortable: true },
    { key: "unidad_medida", label: "Unidad de Medida", sortable: true },
    { key: "categoria", label: "Categoría", sortable: true },
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
          <h3 className="text-lg font-semibold text-gray-900">Gestión de Determinaciones</h3>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-500 hover:bg-blue-600"
            >
              + Nueva Determinación
            </Button>
            <Button
              onClick={() => fetchDeterminaciones()}
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
          data={determinaciones}
          loading={loading}
          emptyMessage="No hay determinaciones registradas"
        />
      </Card>

      {/* Modal Crear Determinación */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nueva Determinación"
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
            label="Frecuencia"
            value={formData.frecuencia}
            onChange={(e) => setFormData({ ...formData, frecuencia: e.target.value })}
            error={errors.frecuencia}
            required
            placeholder="Ej: Diaria, Semanal, Mensual"
          />

          <Input
            label="Unidad de Medida"
            value={formData.unidad_medida}
            onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}
            placeholder="Ej: Prueba, Muestra, Análisis"
          />

          <Input
            label="Categoría"
            value={formData.categoria}
            onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
            placeholder="Ej: Química, Hematología, Inmunología"
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
              Crear Determinación
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Editar Determinación */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Determinación"
      >
        <div className="space-y-4">
          {selectedDeterminacion && (
            <>
              <Input
                label="Nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                error={errors.nombre}
                required
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
                label="Frecuencia"
                value={formData.frecuencia}
                onChange={(e) => setFormData({ ...formData, frecuencia: e.target.value })}
                error={errors.frecuencia}
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
              Actualizar Determinación
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DeterminacionesManagement;