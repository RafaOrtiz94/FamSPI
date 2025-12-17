import React, { useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiX, FiCalendar, FiTool, FiCpu, FiBriefcase, FiFileText } from "react-icons/fi";
import Button from "./Button";
import Modal from "./Modal";
import { useUI } from "../useUI";

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
    producto: '',
    cantidad: 1,
    proveedor_sugerido: '',
    presupuesto_estimado: '',
    fecha_requerida: '',
    justificacion: '',
    observaciones: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.producto || !formData.justificacion) {
      showToast("Completa todos los campos obligatorios", "error");
      return;
    }

    setLoading(true);
    try {
      // Aquí iría la lógica para enviar la solicitud de compra privada
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación

      showToast("Solicitud de compra privada enviada correctamente", "success");
      onSuccess?.();
      onClose();
      setFormData({
        producto: '',
        cantidad: 1,
        proveedor_sugerido: '',
        presupuesto_estimado: '',
        fecha_requerida: '',
        justificacion: '',
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
    <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Compra Privada">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto/Servicio *
            </label>
            <input
              type="text"
              name="producto"
              value={formData.producto}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nombre del producto o servicio"
              required
            />
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Proveedor sugerido
          </label>
          <input
            type="text"
            name="proveedor_sugerido"
            value={formData.proveedor_sugerido}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Nombre del proveedor recomendado"
          />
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
            placeholder="Explica por qué necesitas esta compra..."
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
