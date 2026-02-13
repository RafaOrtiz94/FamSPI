import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../../../core/api/inventarioApi";
import { useApi } from "../../../../core/hooks/useApi";
import Button from "../../../../core/ui/components/Button";
import Card from "../../../../core/ui/components/Card";
import Modal from "../../../../core/ui/components/Modal";
import Input from "../../../../core/ui/components/Input";
import Select from "../../../../core/ui/components/Select";
import Table from "../../../../core/ui/components/Table";
import Alert from "../../../../core/ui/components/Alert";

const EquiposManagement = ({ onRefresh }) => {
  const [equipos, setEquipos] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEquipo, setSelectedEquipo] = useState(null);
  const [formData, setFormData] = useState({
    modelo_id: "",
    serial: "",
    cliente_id: "",
    sucursal_id: "",
    estado: "no_asignado"
  });
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();

  const { execute: fetchEquipos } = useApi(api.getEquiposDisponibles, {
    onSuccess: (data) => setEquipos(data.data || []),
    onError: (err) => console.error("Error al cargar equipos:", err)
  });

  const { execute: fetchModelos } = useApi(api.getModelos, {
    onSuccess: (data) => setModelos(data.data || []),
    onError: (err) => console.error("Error al cargar modelos:", err)
  });

  const { execute: createEquipo } = useApi(api.createUnidad, {
    onSuccess: () => {
      setShowCreateModal(false);
      setFormData({ modelo_id: "", serial: "", cliente_id: "", sucursal_id: "", estado: "no_asignado" });
      fetchEquipos();
      onRefresh();
    },
    onError: (err) => {
      console.error("Error al crear equipo:", err);
      setErrors({ general: err.message || "No se pudo crear el equipo" });
    }
  });

  const { execute: updateEquipo } = useApi(api.cambiarEstadoUnidad, {
    onSuccess: () => {
      setShowEditModal(false);
      setSelectedEquipo(null);
      fetchEquipos();
      onRefresh();
    },
    onError: (err) => {
      console.error("Error al actualizar equipo:", err);
      setErrors({ general: err.message || "No se pudo actualizar el equipo" });
    }
  });

  useEffect(() => {
    fetchEquipos();
    fetchModelos();
  }, []);

  const handleCreate = () => {
    const newErrors = {};
    if (!formData.modelo_id) newErrors.modelo_id = "El modelo es requerido";
    if (!formData.serial && formData.estado !== "no_asignado") newErrors.serial = "El serial es requerido";
    if (!formData.cliente_id) newErrors.cliente_id = "El cliente es requerido";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createEquipo(formData);
  };

  const handleEdit = (equipo) => {
    setSelectedEquipo(equipo);
    setFormData({
      modelo_id: equipo.modelo_id || "",
      serial: equipo.serial || "",
      cliente_id: equipo.cliente_id || "",
      sucursal_id: equipo.sucursal_id || "",
      estado: equipo.estado || "no_asignado"
    });
    setShowEditModal(true);
    setErrors({});
  };

  const handleUpdate = () => {
    if (!selectedEquipo) return;

    const newErrors = {};
    if (!formData.serial) newErrors.serial = "El serial es requerido";
    if (!formData.cliente_id) newErrors.cliente_id = "El cliente es requerido";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    updateEquipo(selectedEquipo.id, { estado: formData.estado, detalle: "Actualización manual" });
  };

  const columns = [
    { key: "id", label: "ID", sortable: true },
    { key: "nombre", label: "Nombre", sortable: true },
    { key: "modelo", label: "Modelo", sortable: true },
    { key: "marca", label: "Marca", sortable: true },
    { key: "serial", label: "Serial", sortable: true },
    { key: "estado", label: "Estado", sortable: true },
    { key: "ubicacion", label: "Ubicación", sortable: true },
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
            onClick={() => navigate(`/dashboard/servicio-tecnico/equipos/${row.id}`)}
            className="bg-green-500 hover:bg-green-600"
          >
            Ver Detalles
          </Button>
        </div>
      )
    }
  ];

  return (
    <>
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Gestión de Equipos</h3>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-500 hover:bg-blue-600"
            >
              + Nuevo Equipo
            </Button>
            <Button
              onClick={() => fetchEquipos()}
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
          data={equipos}
          loading={loading}
          emptyMessage="No hay equipos registrados"
        />
      </Card>

      {/* Modal Crear Equipo */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nuevo Equipo"
      >
        <div className="space-y-4">
          <Select
            label="Modelo"
            value={formData.modelo_id}
            onChange={(e) => setFormData({ ...formData, modelo_id: e.target.value })}
            error={errors.modelo_id}
            required
          >
            <option value="">Seleccionar modelo</option>
            {modelos.map((modelo) => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.nombre} - {modelo.modelo} ({modelo.fabricante})
              </option>
            ))}
          </Select>

          <Input
            label="Serial"
            value={formData.serial}
            onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
            error={errors.serial}
            placeholder="Ingrese el serial del equipo"
          />

          <Input
            label="ID del Cliente"
            value={formData.cliente_id}
            onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
            error={errors.cliente_id}
            placeholder="Ingrese el ID del cliente"
          />

          <Input
            label="ID de la Sucursal"
            value={formData.sucursal_id}
            onChange={(e) => setFormData({ ...formData, sucursal_id: e.target.value })}
            placeholder="Ingrese el ID de la sucursal (opcional)"
          />

          <Select
            label="Estado"
            value={formData.estado}
            onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
          >
            <option value="no_asignado">No Asignado</option>
            <option value="asignado">Asignado</option>
            <option value="reservado">Reservado</option>
            <option value="en_transito">En Tránsito</option>
            <option value="retirado">Retirado</option>
            <option value="baja">Baja</option>
            <option value="mantenimiento_programado">Mantenimiento Programado</option>
            <option value="en_mantenimiento">En Mantenimiento</option>
            <option value="en_evaluacion">En Evaluación</option>
            <option value="evaluado">Evaluado</option>
            <option value="proceso_retiro">Proceso de Retiro</option>
          </Select>

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
              Crear Equipo
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Editar Equipo */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Equipo"
      >
        <div className="space-y-4">
          {selectedEquipo && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Equipo
                  </label>
                  <p className="text-sm text-gray-900">{selectedEquipo.nombre}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modelo
                  </label>
                  <p className="text-sm text-gray-900">{selectedEquipo.modelo}</p>
                </div>
              </div>

              <Input
                label="Serial"
                value={formData.serial}
                onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                error={errors.serial}
                required
              />

              <Input
                label="ID del Cliente"
                value={formData.cliente_id}
                onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                error={errors.cliente_id}
                required
              />

              <Input
                label="ID de la Sucursal"
                value={formData.sucursal_id}
                onChange={(e) => setFormData({ ...formData, sucursal_id: e.target.value })}
                placeholder="Ingrese el ID de la sucursal (opcional)"
              />

              <Select
                label="Estado"
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              >
                <option value="no_asignado">No Asignado</option>
                <option value="asignado">Asignado</option>
                <option value="reservado">Reservado</option>
                <option value="en_transito">En Tránsito</option>
                <option value="retirado">Retirado</option>
                <option value="baja">Baja</option>
                <option value="mantenimiento_programado">Mantenimiento Programado</option>
                <option value="en_mantenimiento">En Mantenimiento</option>
                <option value="en_evaluacion">En Evaluación</option>
                <option value="evaluado">Evaluado</option>
                <option value="proceso_retiro">Proceso de Retiro</option>
              </Select>
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
              Actualizar Equipo
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default EquiposManagement;