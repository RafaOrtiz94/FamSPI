import React, { useState, useEffect } from "react";
import { FiPlus, FiTrash2, FiX } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/useUI";
import api from "../../../core/api/index";

/**
 * Nueva Modal de Solicitud de Compra Pública
 * Flujo completo para roles: comercial, backoffice, jefe_comercial
 *
 * Flujo implementado:
 * 1. Selección de cliente (desde BD)
 * 2. Selección de equipos (desde BD por cliente)
 * 3. Condición Nuevo/CU por equipo
 * 4. Checkbox LIS con select condicional Orion/Infinity
 */

export const NewPublicPurchaseRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useUI();

  // Estados principales
  const [formData, setFormData] = useState({
    // Cliente
    client_id: '',
    client_snapshot: {
      commercial_name: '',
      client_email: '',
      first_name: '',
      last_name: '',
      client_identifier: ''
    },
    // Equipos
    equipment: [],
    // LIS
    requiere_lis: false,
    tipo_lis: '',
    // Información adicional
    notes: '',
    fecha_tentativa_visita: '',
    fecha_instalacion: '',
    fecha_tope_instalacion: '',
    anotaciones: '',
    accesorios: '',
    observaciones: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Estados para datos dinámicos
  const [availableClients, setAvailableClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [availableEquipment, setAvailableEquipment] = useState([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);

  // Tipos de LIS disponibles
  const tiposLIS = [
    { value: 'cobas_infinity', label: 'Cobas Infinity' },
    { value: 'cobas_connection_modules', label: 'Cobas Connection Modules' },
    { value: 'cobas_ict', label: 'Cobas ICT' },
    { value: 'pre_analytic_automation', label: 'Pre-analytic Automation' },
    { value: 'post_analytic_automation', label: 'Post-analytic Automation' },
    { value: 'orion', label: 'Orion' },
    { value: 'infinity', label: 'Infinity' },
    { value: 'otro', label: 'Otro' }
  ];

  // Cargar clientes al abrir modal
  useEffect(() => {
    if (!isOpen) return;

    const loadClients = async () => {
      setLoadingClients(true);
      try {
        const response = await api.get('/clients');
        setAvailableClients(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error loading clients:', error);
        showToast("Error al cargar clientes", "error");
        setAvailableClients([]);
      } finally {
        setLoadingClients(false);
      }
    };

    loadClients();
  }, [isOpen, showToast]);

  // Cargar equipos cuando se selecciona cliente
  useEffect(() => {
    if (!formData.client_id) {
      setAvailableEquipment([]);
      return;
    }

    const loadEquipment = async () => {
      setLoadingEquipment(true);
      try {
        const response = await api.get(`/inventory/equipment?cliente_id=${formData.client_id}`);
        setAvailableEquipment(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error loading equipment:', error);
        showToast("Error al cargar equipos", "error");
        setAvailableEquipment([]);
      } finally {
        setLoadingEquipment(false);
      }
    };

    loadEquipment();
  }, [formData.client_id, showToast]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        client_id: '',
        client_snapshot: {
          commercial_name: '',
          client_email: '',
          first_name: '',
          last_name: '',
          client_identifier: ''
        },
        equipment: [],
        requiere_lis: false,
        tipo_lis: '',
        notes: '',
        fecha_tentativa_visita: '',
        fecha_instalacion: '',
        fecha_tope_instalacion: '',
        anotaciones: '',
        accesorios: '',
        observaciones: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  // Handlers
  const handleClientSelect = (clientId) => {
    if (!clientId) {
      setFormData(prev => ({
        ...prev,
        client_id: '',
        client_snapshot: {
          commercial_name: '',
          client_email: '',
          first_name: '',
          last_name: '',
          client_identifier: ''
        }
      }));
      return;
    }

    const selected = availableClients.find(c => `${c.id}` === `${clientId}`);
    if (!selected) return;

    setFormData(prev => ({
      ...prev,
      client_id: clientId,
      client_snapshot: {
        commercial_name: selected.commercial_name || selected.nombre || '',
        client_email: selected.email || '',
        first_name: selected.first_name || '',
        last_name: selected.last_name || '',
        client_identifier: selected.identifier || selected.id || ''
      }
    }));
  };

  const addEquipment = () => {
    setFormData(prev => ({
      ...prev,
      equipment: [...prev.equipment, {
        id: Date.now(), // ID temporal para UI
        equipment_id: '',
        name: '',
        sku: '',
        condition: 'nuevo', // nuevo o cu
        serial: ''
      }]
    }));
  };

  const updateEquipment = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      equipment: prev.equipment.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));

    // Si cambia el equipment_id, actualizar nombre y sku automáticamente
    if (field === 'equipment_id' && value) {
      const selected = availableEquipment.find(eq => `${eq.id}` === `${value}` || `${eq.unidad_id}` === `${value}`);
      if (selected) {
        setFormData(prev => ({
          ...prev,
          equipment: prev.equipment.map((item, i) =>
            i === index ? {
              ...item,
              equipment_id: value,
              name: selected.nombre || selected.name || '',
              sku: selected.sku || selected.modelo || '',
              serial: selected.serial || ''
            } : item
          )
        }));
      }
    }
  };

  const removeEquipment = (index) => {
    setFormData(prev => ({
      ...prev,
      equipment: prev.equipment.filter((_, i) => i !== index)
    }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Limpiar error cuando se modifica el campo
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }

    // Si se desactiva LIS, limpiar el tipo
    if (name === 'requiere_lis' && !checked) {
      setFormData(prev => ({ ...prev, tipo_lis: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validar cliente
    if (!formData.client_snapshot.commercial_name) {
      newErrors.client = "Selecciona un cliente válido";
    }

    // Validar equipos
    if (!formData.equipment.length) {
      newErrors.equipment = "Agrega al menos un equipo";
    } else {
      formData.equipment.forEach((eq, index) => {
        if (!eq.equipment_id || !eq.name) {
          newErrors.equipment = newErrors.equipment || `Selecciona un equipo válido para el equipo #${index + 1}`;
        }
        if (!eq.condition) {
          newErrors.equipment = newErrors.equipment || `Selecciona la condición para el equipo #${index + 1}`;
        }
      });
    }

    // Validar LIS
    if (formData.requiere_lis && !formData.tipo_lis) {
      newErrors.tipo_lis = "Selecciona el tipo de LIS";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast("Completa todos los campos obligatorios", "error");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        status: 'pending_commercial',
        request_type_id: 'compra_publica',
        // Limpiar IDs temporales antes de enviar
        equipment: formData.equipment.map(({ id, ...eq }) => eq)
      };

      const response = await api.post('/equipment-purchases', payload);
      showToast("Solicitud de compra pública creada correctamente", "success");
      onSuccess?.(response.data);
      onClose();
    } catch (error) {
      console.error('Error creating public purchase:', error);
      showToast("Error al crear la solicitud de compra pública", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva Solicitud de Compra Pública">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Datos del Cliente */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">1</span>
            Datos del Cliente
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente *
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => handleClientSelect(e.target.value)}
              disabled={loadingClients}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.client ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            >
              <option value="">
                {loadingClients ? "Cargando clientes..." : "Selecciona un cliente"}
              </option>
              {availableClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.commercial_name || client.nombre || `Cliente ${client.id}`}
                </option>
              ))}
            </select>
            {errors.client && (
              <p className="text-red-500 text-xs mt-1">{errors.client}</p>
            )}
          </div>

          {/* Información del cliente (solo lectura cuando está seleccionado) */}
          {formData.client_snapshot.commercial_name && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Información del Cliente</h4>
              <div className="text-sm text-gray-600">
                <p><strong>Nombre:</strong> {formData.client_snapshot.commercial_name}</p>
                {formData.client_snapshot.client_email && (
                  <p><strong>Email:</strong> {formData.client_snapshot.client_email}</p>
                )}
                {formData.client_snapshot.client_identifier && (
                  <p><strong>ID:</strong> {formData.client_snapshot.client_identifier}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Selección de Equipos */}
        <div className="border-b pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">2</span>
              Selección de Equipos
            </h3>
            {formData.client_id && (
              <Button
                type="button"
                onClick={addEquipment}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!formData.client_id}
              >
                <FiPlus className="mr-1" size={14} />
                Agregar Equipo
              </Button>
            )}
          </div>

          {!formData.client_id ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Selecciona un cliente primero para cargar los equipos disponibles.
            </p>
          ) : formData.equipment.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No hay equipos agregados. Haz clic en "Agregar Equipo" para comenzar.
            </p>
          ) : (
            <div className="space-y-3">
              {formData.equipment.map((item, index) => (
                <div key={item.id || index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1 space-y-3">
                    {/* 3. Equipo y Condición */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          Equipo *
                        </label>
                        <select
                          value={item.equipment_id}
                          onChange={(e) => updateEquipment(index, 'equipment_id', e.target.value)}
                          disabled={loadingEquipment}
                          className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">
                            {loadingEquipment ? "Cargando equipos..." : "Selecciona equipo"}
                          </option>
                          {availableEquipment.map((eq) => (
                            <option key={eq.id || eq.unidad_id} value={eq.id || eq.unidad_id}>
                              {eq.nombre || eq.name || "Equipo"} - {eq.sku || eq.modelo || ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          Condición *
                        </label>
                        <select
                          value={item.condition}
                          onChange={(e) => updateEquipment(index, 'condition', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="nuevo">Nuevo</option>
                          <option value="cu">CU (usado/comodato usado)</option>
                        </select>
                      </div>
                    </div>

                    {/* Información del equipo */}
                    {item.name && (
                      <div className="text-xs text-gray-600 bg-white p-2 rounded border">
                        <p><strong>Nombre:</strong> {item.name}</p>
                        {item.sku && <p><strong>SKU/Modelo:</strong> {item.sku}</p>}
                        {item.serial && <p><strong>Serial:</strong> {item.serial}</p>}
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={() => removeEquipment(index)}
                    size="sm"
                    variant="danger"
                    className="bg-red-500 hover:bg-red-600 text-white mt-1"
                  >
                    <FiTrash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {errors.equipment && (
            <p className="text-red-500 text-xs mt-2">{errors.equipment}</p>
          )}
        </div>

        {/* 4. Requerimiento de LIS */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">3</span>
            Requerimiento de LIS
          </h3>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requiere_lis"
                checked={formData.requiere_lis}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              ¿Requiere LIS?
            </label>

            {formData.requiere_lis && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de LIS *
                </label>
                <select
                  name="tipo_lis"
                  value={formData.tipo_lis}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.tipo_lis ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required={formData.requiere_lis}
                >
                  <option value="">Selecciona el tipo de LIS</option>
                  {tiposLIS.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
                {errors.tipo_lis && (
                  <p className="text-red-500 text-xs mt-1">{errors.tipo_lis}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Información Adicional */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Información Adicional</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha tentativa de visita
              </label>
              <input
                type="date"
                name="fecha_tentativa_visita"
                value={formData.fecha_tentativa_visita}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de instalación
              </label>
              <input
                type="date"
                name="fecha_instalacion"
                value={formData.fecha_instalacion}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha tope de instalación
            </label>
            <input
              type="date"
              name="fecha_tope_instalacion"
              value={formData.fecha_tope_instalacion}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas adicionales
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Información adicional sobre la solicitud..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading || !formData.client_snapshot.commercial_name || formData.equipment.length === 0}
            isLoading={loading}
          >
            Crear Solicitud de Compra Pública
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default NewPublicPurchaseRequestModal;
