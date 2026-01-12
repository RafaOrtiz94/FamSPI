import React, { useState, useEffect } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import Button from "./Button";
import Modal from "./Modal";
import { useUI } from "../useUI";
import api from "../../api/index";

/**
 * Componentes de modales para diferentes tipos de solicitudes
 * Cada modal maneja su propio formulario y lógica
 */

// ============================================================================
// 🎯 MODAL DE PERMISOS/VACACIONES
// ============================================================================

export const PermissionRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useUI();
  const [formData, setFormData] = useState({
    tipo: '',
    fecha_inicio: '',
    fecha_fin: '',
    motivo: '',
    observaciones: ''
  });
  const [loading, setLoading] = useState(false);

  const tiposPermiso = [
    { value: 'vacaciones', label: 'Vacaciones' },
    { value: 'permiso_medico', label: 'Permiso Médico' },
    { value: 'permiso_personal', label: 'Permiso Personal' },
    { value: 'otro', label: 'Otro' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.tipo || !formData.fecha_inicio || !formData.motivo) {
      showToast("Completa todos los campos obligatorios", "error");
      return;
    }

    setLoading(true);
    try {
      // Aquí iría la lógica para enviar la solicitud de permiso
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación

      showToast("Solicitud de permiso enviada correctamente", "success");
      onSuccess?.();
      onClose();
      setFormData({
        tipo: '',
        fecha_inicio: '',
        fecha_fin: '',
        motivo: '',
        observaciones: ''
      });
    } catch (error) {
      showToast("Error al enviar la solicitud", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Permiso o Vacaciones">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de permiso *
          </label>
          <select
            name="tipo"
            value={formData.tipo}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Selecciona un tipo</option>
            {tiposPermiso.map(tipo => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de inicio *
            </label>
            <input
              type="date"
              name="fecha_inicio"
              value={formData.fecha_inicio}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de fin
            </label>
            <input
              type="date"
              name="fecha_fin"
              value={formData.fecha_fin}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Motivo *
          </label>
          <textarea
            name="motivo"
            value={formData.motivo}
            onChange={handleChange}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Describe el motivo de tu solicitud..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones adicionales
          </label>
          <textarea
            name="observaciones"
            value={formData.observaciones}
            onChange={handleChange}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Información adicional..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
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
            disabled={loading}
            isLoading={loading}
          >
            Enviar Solicitud
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// 🔧 MODAL DE MANTENIMIENTO
// ============================================================================

export const MaintenanceRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useUI();
  const [formData, setFormData] = useState({
    equipo_id: '',
    tipo_mantenimiento: '',
    prioridad: 'media',
    descripcion: '',
    fecha_solicitada: '',
    observaciones: ''
  });
  const [loading, setLoading] = useState(false);

  const tiposMantenimiento = [
    { value: 'preventivo', label: 'Preventivo' },
    { value: 'correctivo', label: 'Correctivo' },
    { value: 'predictivo', label: 'Predictivo' },
    { value: 'emergencia', label: 'Emergencia' }
  ];

  const prioridades = [
    { value: 'baja', label: 'Baja', color: 'text-green-600' },
    { value: 'media', label: 'Media', color: 'text-yellow-600' },
    { value: 'alta', label: 'Alta', color: 'text-orange-600' },
    { value: 'critica', label: 'Crítica', color: 'text-red-600' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.equipo_id || !formData.tipo_mantenimiento || !formData.descripcion) {
      showToast("Completa todos los campos obligatorios", "error");
      return;
    }

    setLoading(true);
    try {
      // Aquí iría la lógica para enviar la solicitud de mantenimiento
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación

      showToast("Solicitud de mantenimiento enviada correctamente", "success");
      onSuccess?.();
      onClose();
      setFormData({
        equipo_id: '',
        tipo_mantenimiento: '',
        prioridad: 'media',
        descripcion: '',
        fecha_solicitada: '',
        observaciones: ''
      });
    } catch (error) {
      showToast("Error al enviar la solicitud", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Mantenimiento">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Equipo *
          </label>
          <select
            name="equipo_id"
            value={formData.equipo_id}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Selecciona un equipo</option>
            {/* Aquí irían las opciones de equipos disponibles */}
            <option value="1">Equipo 1 - Modelo ABC</option>
            <option value="2">Equipo 2 - Modelo XYZ</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de mantenimiento *
            </label>
            <select
              name="tipo_mantenimiento"
              value={formData.tipo_mantenimiento}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Selecciona tipo</option>
              {tiposMantenimiento.map(tipo => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prioridad
            </label>
            <select
              name="prioridad"
              value={formData.prioridad}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {prioridades.map(prioridad => (
                <option key={prioridad.value} value={prioridad.value}>
                  {prioridad.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha solicitada
          </label>
          <input
            type="date"
            name="fecha_solicitada"
            value={formData.fecha_solicitada}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción del problema *
          </label>
          <textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Describe detalladamente el problema o mantenimiento requerido..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones adicionales
          </label>
          <textarea
            name="observaciones"
            value={formData.observaciones}
            onChange={handleChange}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Información adicional..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
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
            disabled={loading}
            isLoading={loading}
          >
            Enviar Solicitud
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// 💼 MODAL DE COMPRA PRIVADA
// ============================================================================

export const PrivatePurchaseRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useUI();
  const [formData, setFormData] = useState({
    client_snapshot: {
      commercial_name: '',
      client_email: '',
      first_name: '',
      last_name: '',
      client_identifier: ''
    },
    equipment: [],
    notes: '',
    offer_kind: 'venta'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_snapshot?.commercial_name || !formData.equipment?.length) {
      showToast("Completa el nombre del cliente y agrega al menos un equipo", "error");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        status: 'pending_commercial'
      };

      const response = await api.post('/private-purchases', payload);
      showToast("Solicitud de compra privada creada correctamente", "success");
      onSuccess?.(response.data);
      onClose();
      setFormData({
        client_snapshot: {
          commercial_name: '',
          client_email: '',
          first_name: '',
          last_name: '',
          client_identifier: ''
        },
        equipment: [],
        notes: '',
        offer_kind: 'venta'
      });
    } catch (error) {
      console.error('Error creating private purchase:', error);
      showToast("Error al crear la solicitud de compra privada", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const addEquipment = () => {
    setFormData(prev => ({
      ...prev,
      equipment: [...prev.equipment, { name: '', sku: '', type: 'new' }]
    }));
  };

  const updateEquipment = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      equipment: prev.equipment.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeEquipment = (index) => {
    setFormData(prev => ({
      ...prev,
      equipment: prev.equipment.filter((_, i) => i !== index)
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Compra Privada">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Información del Cliente */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Información del Cliente</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre comercial *
              </label>
              <input
                type="text"
                name="client_snapshot.commercial_name"
                value={formData.client_snapshot.commercial_name}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nombre de la empresa"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="client_snapshot.client_email"
                value={formData.client_snapshot.client_email}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="cliente@empresa.com"
              />
            </div>
          </div>
        </div>

        {/* Equipos */}
        <div className="border-b pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Equipos</h3>
            <Button
              type="button"
              onClick={addEquipment}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FiPlus className="mr-1" size={14} />
              Agregar Equipo
            </Button>
          </div>

          {formData.equipment.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No hay equipos agregados. Haz clic en "Agregar Equipo" para comenzar.
            </p>
          ) : (
            <div className="space-y-3">
              {formData.equipment.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Nombre del equipo"
                      value={item.name}
                      onChange={(e) => updateEquipment(index, 'name', e.target.value)}
                      className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      placeholder="SKU/Modelo"
                      value={item.sku}
                      onChange={(e) => updateEquipment(index, 'sku', e.target.value)}
                      className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={item.type}
                    onChange={(e) => updateEquipment(index, 'type', e.target.value)}
                    className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="new">Nuevo</option>
                    <option value="cu">CU</option>
                    <option value="used">Usado</option>
                  </select>
                  <Button
                    type="button"
                    onClick={() => removeEquipment(index)}
                    size="sm"
                    variant="danger"
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    <FiTrash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notas y Tipo de Oferta */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de oferta
            </label>
            <select
              name="offer_kind"
              value={formData.offer_kind}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="venta">Venta</option>
              <option value="alquiler">Alquiler</option>
              <option value="comodato">Comodato</option>
            </select>
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

        <div className="flex justify-end gap-3 pt-4">
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
            Crear Solicitud
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// 🔌 MODAL DE NUEVO EQUIPO
// ============================================================================

export const EquipmentRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useUI();
  const [formData, setFormData] = useState({
    modelo: '',
    fabricante: '',
    tipo_equipo: '',
    cantidad: 1,
    justificacion: '',
    presupuesto_estimado: '',
    fecha_requerida: '',
    observaciones: ''
  });
  const [loading, setLoading] = useState(false);

  const tiposEquipo = [
    { value: 'analizador', label: 'Analizador' },
    { value: 'centrifuga', label: 'Centrífuga' },
    { value: 'incubadora', label: 'Incubadora' },
    { value: 'microscopio', label: 'Microscopio' },
    { value: 'balanza', label: 'Balanza' },
    { value: 'otro', label: 'Otro' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.modelo || !formData.tipo_equipo || !formData.justificacion) {
      showToast("Completa todos los campos obligatorios", "error");
      return;
    }

    setLoading(true);
    try {
      // Aquí iría la lógica para enviar la solicitud de nuevo equipo
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación

      showToast("Solicitud de nuevo equipo enviada correctamente", "success");
      onSuccess?.();
      onClose();
      setFormData({
        modelo: '',
        fabricante: '',
        tipo_equipo: '',
        cantidad: 1,
        justificacion: '',
        presupuesto_estimado: '',
        fecha_requerida: '',
        observaciones: ''
      });
    } catch (error) {
      showToast("Error al enviar la solicitud", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Nuevo Equipo">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modelo *
            </label>
            <input
              type="text"
              name="modelo"
              value={formData.modelo}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej: Cobas C111"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fabricante
            </label>
            <input
              type="text"
              name="fabricante"
              value={formData.fabricante}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej: Roche"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de equipo *
            </label>
            <select
              name="tipo_equipo"
              value={formData.tipo_equipo}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Selecciona tipo</option>
              {tiposEquipo.map(tipo => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad
            </label>
            <input
              type="number"
              name="cantidad"
              value={formData.cantidad}
              onChange={handleChange}
              min="1"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Presupuesto estimado
            </label>
            <input
              type="number"
              name="presupuesto_estimado"
              value={formData.presupuesto_estimado}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha requerida
            </label>
            <input
              type="date"
              name="fecha_requerida"
              value={formData.fecha_requerida}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Justificación *
          </label>
          <textarea
            name="justificacion"
            value={formData.justificacion}
            onChange={handleChange}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Explica por qué necesitas este equipo..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones adicionales
          </label>
          <textarea
            name="observaciones"
            value={formData.observaciones}
            onChange={handleChange}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Información adicional..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
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
            disabled={loading}
            isLoading={loading}
          >
            Enviar Solicitud
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// 🛒 MODAL DE COMPRA PÚBLICA (RECONSTRUIDO)
// ============================================================================

export const PublicPurchaseRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useUI();
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
    // ACP Comercial
    acp_comercial_id: '',
    acp_comercial_name: '',
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

  // Estados para datos dinámicos
  const [availableClients, setAvailableClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [availableACP, setAvailableACP] = useState([]);
  const [loadingACP, setLoadingACP] = useState(false);
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);

  // Tipos de LIS disponibles
  const tiposLIS = [
    { value: 'cobas_infinity', label: 'Cobas Infinity' },
    { value: 'cobas_connection_modules', label: 'Cobas Connection Modules' },
    { value: 'cobas_ict', label: 'Cobas ICT' },
    { value: 'pre_analytic_automation', label: 'Pre-analytic Automation' },
    { value: 'post_analytic_automation', label: 'Post-analytic Automation' },
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
      } finally {
        setLoadingClients(false);
      }
    };

    loadClients();
  }, [isOpen, showToast]);

  // Cargar ACP Comercial cuando se selecciona cliente
  useEffect(() => {
    if (!formData.client_id) {
      setAvailableACP([]);
      return;
    }

    const loadACP = async () => {
      setLoadingACP(true);
      try {
        // Aquí iría la lógica para cargar ACP disponibles
        // Por ahora simulamos algunos ACP
        const mockACP = [
          { id: 1, fullname: 'María González', email: 'maria.gonzalez@empresa.com' },
          { id: 2, fullname: 'Carlos Rodríguez', email: 'carlos.rodriguez@empresa.com' },
          { id: 3, fullname: 'Ana Martínez', email: 'ana.martinez@empresa.com' }
        ];
        setAvailableACP(mockACP);
      } catch (error) {
        console.error('Error loading ACP:', error);
        showToast("Error al cargar ACP Comercial", "error");
      } finally {
        setLoadingACP(false);
      }
    };

    loadACP();
  }, [formData.client_id, showToast]);

  // Cargar equipos cuando se selecciona cliente
  useEffect(() => {
    if (!formData.client_id) {
      setEquipmentOptions([]);
      return;
    }

    const loadEquipment = async () => {
      setLoadingEquipment(true);
      try {
        const response = await api.get(`/inventory/equipment?cliente_id=${formData.client_id}`);
        setEquipmentOptions(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error loading equipment:', error);
        showToast("Error al cargar equipos", "error");
        setEquipmentOptions([]);
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
        client_snapshot: { commercial_name: '', client_email: '', first_name: '', last_name: '', client_identifier: '' },
        acp_comercial_id: '',
        acp_comercial_name: '',
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
    }
  }, [isOpen]);

  const handleClientSelect = (clientId) => {
    if (!clientId) {
      setFormData(prev => ({
        ...prev,
        client_id: '',
        client_snapshot: { commercial_name: '', client_email: '', first_name: '', last_name: '', client_identifier: '' }
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

  const handleACPSelect = (acpId) => {
    if (!acpId) {
      setFormData(prev => ({ ...prev, acp_comercial_id: '', acp_comercial_name: '' }));
      return;
    }

    const selected = availableACP.find(a => `${a.id}` === `${acpId}`);
    setFormData(prev => ({
      ...prev,
      acp_comercial_id: acpId,
      acp_comercial_name: selected ? selected.fullname : ''
    }));
  };

  const addEquipment = () => {
    setFormData(prev => ({
      ...prev,
      equipment: [...prev.equipment, { name: '', sku: '', type: 'nuevo', serial: '' }]
    }));
  };

  const updateEquipment = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      equipment: prev.equipment.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeEquipment = (index) => {
    setFormData(prev => ({
      ...prev,
      equipment: prev.equipment.filter((_, i) => i !== index)
    }));
  };

  const handleChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: inputType === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!formData.client_snapshot.commercial_name) {
      showToast("Selecciona un cliente", "error");
      return;
    }

    if (!formData.equipment.length) {
      showToast("Agrega al menos un equipo", "error");
      return;
    }

    if (formData.requiere_lis && !formData.tipo_lis) {
      showToast("Selecciona el tipo de LIS", "error");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        status: 'pending_commercial',
        request_type_id: 'compra_publica'
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
    <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Compra Pública">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Paso 1: Selección de Cliente */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Selección de Cliente</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente *
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => handleClientSelect(e.target.value)}
              disabled={loadingClients}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          </div>
        </div>

        {/* Paso 2: ACP Comercial (solo si hay cliente seleccionado) */}
        {formData.client_id && (
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">2. ACP Comercial</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ACP Comercial Disponible
              </label>
              <select
                value={formData.acp_comercial_id}
                onChange={(e) => handleACPSelect(e.target.value)}
                disabled={loadingACP}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">
                  {loadingACP ? "Cargando ACP..." : "Selecciona ACP (opcional)"}
                </option>
                {availableACP.map((acp) => (
                  <option key={acp.id} value={acp.id}>
                    {acp.fullname} ({acp.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Si no hay ACP disponible, la solicitud será asignada automáticamente.
              </p>
            </div>
          </div>
        )}

        {/* Paso 3: Selección de Equipos (solo si hay cliente seleccionado) */}
        {formData.client_id && (
          <div className="border-b pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">3. Equipos</h3>
              <Button
                type="button"
                onClick={addEquipment}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <FiPlus className="mr-1" size={14} />
                Agregar Equipo
              </Button>
            </div>

            {formData.equipment.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No hay equipos agregados. Haz clic en "Agregar Equipo" para comenzar.
              </p>
            ) : (
              <div className="space-y-3">
                {formData.equipment.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <select
                        value={item.name}
                        onChange={(e) => {
                          const selected = equipmentOptions.find(opt => opt.nombre === e.target.value || opt.name === e.target.value);
                          updateEquipment(index, 'name', e.target.value);
                          updateEquipment(index, 'sku', selected?.sku || selected?.modelo || '');
                          updateEquipment(index, 'serial', selected?.serial || '');
                        }}
                        className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">
                          {loadingEquipment ? "Cargando equipos..." : "Selecciona equipo"}
                        </option>
                        {equipmentOptions.map((opt) => (
                          <option key={opt.id || opt.unidad_id} value={opt.nombre || opt.name || ""}>
                            {opt.nombre || opt.name || "Equipo"}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Serial"
                        value={item.serial}
                        onChange={(e) => updateEquipment(index, 'serial', e.target.value)}
                        className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <select
                      value={item.type}
                      onChange={(e) => updateEquipment(index, 'type', e.target.value)}
                      className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="nuevo">Nuevo</option>
                      <option value="cu">CU</option>
                      <option value="usado">Usado</option>
                    </select>
                    <Button
                      type="button"
                      onClick={() => removeEquipment(index)}
                      size="sm"
                      variant="danger"
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      <FiTrash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Paso 4: Configuración LIS (siempre visible pero condicional) */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">4. Configuración LIS</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requiere_lis"
                checked={formData.requiere_lis}
                onChange={handleChange}
              />
              ¿Incluye LIS?
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
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={formData.requiere_lis}
                >
                  <option value="">Selecciona el tipo de LIS</option>
                  {tiposLIS.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Información Adicional */}
        <div className="space-y-4">
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

        <div className="flex justify-end gap-3 pt-4">
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
            Crear Solicitud Pública
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// 📊 MODAL DE BUSINESS CASE (SIMPLIFICADO)
// ============================================================================

export const BusinessCaseRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useUI();
  const [formData, setFormData] = useState({
    titulo: '',
    tipo: '',
    descripcion: '',
    inversion_estimada: '',
    roi_esperado: '',
    fecha_implementacion: '',
    observaciones: ''
  });
  const [loading, setLoading] = useState(false);

  const tiposBusinessCase = [
    { value: 'nuevo_equipo', label: 'Nuevo Equipo' },
    { value: 'expansion', label: 'Expansión de Servicios' },
    { value: 'optimizacion', label: 'Optimización de Procesos' },
    { value: 'nuevo_servicio', label: 'Nuevo Servicio' },
    { value: 'otro', label: 'Otro' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titulo || !formData.tipo || !formData.descripcion) {
      showToast("Completa todos los campos obligatorios", "error");
      return;
    }

    setLoading(true);
    try {
      // Aquí iría la lógica para enviar la solicitud de business case
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación

      showToast("Solicitud de business case enviada correctamente", "success");
      onSuccess?.();
      onClose();
      setFormData({
        titulo: '',
        tipo: '',
        descripcion: '',
        inversion_estimada: '',
        roi_esperado: '',
        fecha_implementacion: '',
        observaciones: ''
      });
    } catch (error) {
      showToast("Error al enviar la solicitud", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Business Case">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título del proyecto *
          </label>
          <input
            type="text"
            name="titulo"
            value={formData.titulo}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Nombre del proyecto o iniciativa"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de proyecto *
            </label>
            <select
              name="tipo"
              value={formData.tipo}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Selecciona tipo</option>
              {tiposBusinessCase.map(tipo => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de implementación
            </label>
            <input
              type="date"
              name="fecha_implementacion"
              value={formData.fecha_implementacion}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción del proyecto *
          </label>
          <textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Describe detalladamente el proyecto..."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inversión estimada
            </label>
            <input
              type="number"
              name="inversion_estimada"
              value={formData.inversion_estimada}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ROI esperado (%)
            </label>
            <input
              type="number"
              name="roi_esperado"
              value={formData.roi_esperado}
              onChange={handleChange}
              min="0"
              step="0.1"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.0"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones adicionales
          </label>
          <textarea
            name="observaciones"
            value={formData.observaciones}
            onChange={handleChange}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Información adicional..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
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
            disabled={loading}
            isLoading={loading}
          >
            Crear Business Case
          </Button>
        </div>
      </form>
    </Modal>
  );
};
