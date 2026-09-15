import React, { useState, useEffect, useMemo } from "react";
import { FiPlus, FiTrash2, FiCheckCircle } from "react-icons/fi";
import Button from "./Button";
import Modal from "./Modal";
import ProcessingOverlay from "./ProcessingOverlay";
import { useUI } from "../useUI";
import api from "../../api/index";
import { getEquipmentModels } from "../../api/inventarioApi";
import { OFFER_KIND_LABELS, normalizeOfferKind } from "../../../shared/purchases/purchaseTypes";
import { getApiErrorMessage } from "../../utils/apiErrors";

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

export const PrivatePurchaseRequestModal = ({
 isOpen,
 onClose,
 onSuccess,
 initialOfferKind = "venta",
 hideOfferKindSelector = false,
}) => {
 const TYPE_CHIPS = {
 new_available: "bg-emerald-100 text-emerald-800 border-emerald-200",
 new_import: "bg-amber-100 text-amber-800 border-amber-200",
 cu: "bg-sky-100 text-sky-800 border-sky-200",
 };
 const sanitizeDigits = (value, max) => String(value || "").replace(/\D/g, "").slice(0, max);
 const { showToast } = useUI();
 const [formData, setFormData] = useState({
 client_id: "",
 client_snapshot: {
 commercial_name: "",
 client_email: "",
 first_name: "",
 last_name: "",
 client_identifier: "",
 identifier_type: "ruc"
 },
 equipment: [],
 notes: "",
 offer_kind: normalizeOfferKind(initialOfferKind)
 });
 const [errors, setErrors] = useState({});
 const [loading, setLoading] = useState(false);
 const [progressStep, setProgressStep] = useState(null);
 const [confirmOpen, setConfirmOpen] = useState(false);

 const [equipmentOptions, setEquipmentOptions] = useState([]);
 const [loadingEquipment, setLoadingEquipment] = useState(false);
 const [availableClients, setAvailableClients] = useState([]);
 const [loadingClients, setLoadingClients] = useState(false);

 const [clientSearchTerm, setClientSearchTerm] = useState("");
 const [showClientDropdown, setShowClientDropdown] = useState(false);
 const [filteredClients, setFilteredClients] = useState([]);
 const [selectedClient, setSelectedClient] = useState(null);
 const [isNewClient, setIsNewClient] = useState(false);
 const [equipmentSearch, setEquipmentSearch] = useState("");
 const [activeSection, setActiveSection] = useState(0);

 // Filtrar clientes basado en el término de búsqueda
 useEffect(() => {
 if (clientSearchTerm.trim() === "") {
 setFilteredClients([]);
 setShowClientDropdown(false);
 return;
 }

 const filtered = availableClients.filter(client =>
 client && // Verificar que el cliente existe
 ((client.commercial_name || client.nombre || "").toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
 (client.email || "").toLowerCase().includes(clientSearchTerm.toLowerCase()))
 ).slice(0, 6);

 const cleanFiltered = filtered.filter(client => client != null);

 setFilteredClients(cleanFiltered);
 setShowClientDropdown(cleanFiltered.length > 0);
 }, [clientSearchTerm, availableClients]);

 const filteredEquipmentOptions = useMemo(() => {
 const term = equipmentSearch.trim().toLowerCase();
 if (!term) return equipmentOptions;
 return equipmentOptions.filter((eq) => {
 const name = String(eq?.name || eq?.nombre || eq?.modelo || "").toLowerCase();
 return name.includes(term);
 });
 }, [equipmentOptions, equipmentSearch]);

 const validationIssues = useMemo(() => {
 const issues = [];
 if (!String(formData.client_snapshot.commercial_name || "").trim()) {
 issues.push("Ingresa el nombre comercial del cliente");
 }

 const identifierType = String(formData.client_snapshot.identifier_type || "ruc");
 const expectedLength = identifierType === "cedula" ? 10 : 13;
 const identifierLabel = identifierType === "cedula" ? "cédula" : "RUC";
 const digits = sanitizeDigits(formData.client_snapshot.client_identifier, expectedLength);
 if (digits.length !== expectedLength) {
 issues.push(`La ${identifierLabel} debe tener ${expectedLength} dígitos`);
 }

 if (!formData.equipment.length) {
 issues.push("Agrega al menos un equipo");
 }

 if (formData.equipment.some((eq) => !String(eq?.name || eq?.sku || "").trim())) {
 issues.push("Todos los equipos deben tener al menos nombre o SKU");
 }

 return issues;
 }, [formData]);

 const canSubmit = validationIssues.length === 0 && !loading;

 const handleClientSelect = (client) => {
 if (!client) {
 return;
 }

 setSelectedClient(client);
 setClientSearchTerm(client.nombre || client.commercial_name || "");
 setShowClientDropdown(false);
 setIsNewClient(false);

 const clientData = {
 commercial_name: client.nombre || client.commercial_name || "",
 client_email: client.client_email || client.email || "",
 first_name: client.first_name || "",
 last_name: client.last_name || "",
 client_identifier: sanitizeDigits(client.identificador || client.identifier || client.id || "", 13),
 identifier_type:
 sanitizeDigits(client.identificador || client.identifier || client.id || "", 13).length === 10 ? "cedula" : "ruc"
 };

 setFormData(prev => ({
 ...prev,
 client_id: client.id,
 client_snapshot: clientData
 }));
 setErrors((prev) => ({
 ...prev,
 client_name: "",
 client_identifier: "",
 }));
 };

 const handleClientSearchChange = (value) => {
 setClientSearchTerm(value);

 if (value.trim() === "") {
 setSelectedClient(null);
 setIsNewClient(false);
 setFormData(prev => ({
 ...prev,
 client_id: "",
 client_snapshot: {
 commercial_name: "",
 client_email: "",
 first_name: "",
 last_name: "",
 client_identifier: "",
 identifier_type: "ruc"
 }
 }));
 return;
 }

 const exactMatch = availableClients.find(client => {
 const clientName = (client.nombre || client.commercial_name || "").toLowerCase().trim();
 const inputValue = value.toLowerCase().trim();
 return clientName === inputValue;
 });

 if (exactMatch) {
 handleClientSelect(exactMatch);
 } else {
 setSelectedClient(null);
 setIsNewClient(true);
 setFormData(prev => ({
 ...prev,
 client_id: `new_${Date.now()}`,
 client_snapshot: {
 commercial_name: value,
 client_email: "",
 first_name: "",
 last_name: "",
 client_identifier: "",
 identifier_type: "ruc"
 }
 }));
 }
 setErrors((prev) => ({ ...prev, client_name: "" }));
 };

 useEffect(() => {
 if (!isOpen) return;

 const loadClients = async () => {
 setLoadingClients(true);
 try {
 const response = await api.get('/clients');
 const clientsData = response.data?.data || response.data || [];
 setAvailableClients(Array.isArray(clientsData) ? clientsData : []);
 } catch (error) {
 console.error('Error loading clients for private purchase:', error);
 showToast(getApiErrorMessage(error, "Error al cargar clientes"), "error");
 } finally {
 setLoadingClients(false);
 }
 };

 loadClients();
 }, [isOpen, showToast]);

 useEffect(() => {
 if (!isOpen) return;

 const loadEquipment = async () => {
 setLoadingEquipment(true);
 try {
 const equipmentModels = await getEquipmentModels();
 setEquipmentOptions(Array.isArray(equipmentModels) ? equipmentModels : []);
 } catch (error) {
 console.error('Error loading equipment models for private purchase:', error);
 showToast(getApiErrorMessage(error, "Error al cargar modelos de equipos disponibles"), "error");
 setEquipmentOptions([]);
 } finally {
 setLoadingEquipment(false);
 }
 };

 loadEquipment();
 }, [isOpen, showToast]);

 useEffect(() => {
 // Se aplica al ABRIR (no al cerrar): el modal se monta una sola vez en la
 // página y initialOfferKind solo llega como prop actualizado después de
 // que el usuario elige el subtipo en el selector de 2 pasos. Resetear en
 // el cierre dejaba "venta" pegado del montaje inicial sin importar lo
 // elegido -- el tipo (alquiler / alquiler con transferencia de dominio)
 // debe reflejarse siempre, no solo cuando coincide con el default.
 if (isOpen) {
 setFormData({
 client_id: "",
 client_snapshot: {
 commercial_name: "",
 client_email: "",
 first_name: "",
 last_name: "",
 client_identifier: "",
 identifier_type: "ruc",
 },
 equipment: [],
 notes: "",
 offer_kind: normalizeOfferKind(initialOfferKind),
 });
 setErrors({});
 setClientSearchTerm("");
 setSelectedClient(null);
 setFilteredClients([]);
 setShowClientDropdown(false);
 setIsNewClient(false);
 setEquipmentSearch("");
 setActiveSection(0);
 setConfirmOpen(false);
 setProgressStep(null);
 }
 }, [initialOfferKind, isOpen]);

 const submitConfirmed = async () => {
 const identifierType = String(formData.client_snapshot.identifier_type || "ruc");
 const expectedLength = identifierType === "cedula" ? 10 : 13;
 const identifierDigits = sanitizeDigits(formData.client_snapshot.client_identifier, expectedLength);
 setLoading(true);
 setProgressStep("validating");

 try {
 setProgressStep("uploading");

 const payload = {
 client_data: {
 id: formData.client_id,
 name: formData.client_snapshot.commercial_name || formData.client_snapshot.name || "",
 commercial_name: formData.client_snapshot.commercial_name || "",
 client_email: formData.client_snapshot.client_email || "",
 first_name: formData.client_snapshot.first_name || "",
 last_name: formData.client_snapshot.last_name || "",
 client_identifier: identifierDigits || "",
 identifier_type: identifierType,
 },
 equipment: formData.equipment,
 offer_kind: formData.offer_kind,
 notes: formData.notes,
 };

 setProgressStep("submitting");
 const response = await api.post('/private-purchases', payload);

 setProgressStep("notifying");
 showToast("Solicitud de compra privada creada correctamente", "success");
 setConfirmOpen(false);
 onSuccess?.(response.data);
 onClose();

 setFormData({
 client_id: "",
 client_snapshot: {
 commercial_name: "",
 client_email: "",
 first_name: "",
 last_name: "",
 client_identifier: "",
 identifier_type: "ruc"
 },
 equipment: [],
 notes: "",
 offer_kind: normalizeOfferKind(initialOfferKind)
 });

 } catch (error) {
 console.error('Error creating private purchase:', error);
 showToast(getApiErrorMessage(error, "Error al crear la solicitud de compra privada"), "error");
 } finally {
 setLoading(false);
 setProgressStep(null);
 }
 };

 const validateForm = () => {
 const nextErrors = {};

 if (!String(formData.client_snapshot.commercial_name || "").trim()) {
 nextErrors.client_name = "El nombre comercial es obligatorio";
 }

 const identifierType = String(formData.client_snapshot.identifier_type || "ruc");
 const expectedLength = identifierType === "cedula" ? 10 : 13;
 const digits = sanitizeDigits(formData.client_snapshot.client_identifier, expectedLength);
 if (digits.length !== expectedLength) {
 nextErrors.client_identifier = `Ingresa un ${identifierType === "cedula" ? "número de cédula" : "RUC"} válido de ${expectedLength} dígitos`;
 }

 if (!formData.equipment.length) {
 nextErrors.equipment = "Agrega al menos un equipo";
 }

 formData.equipment.forEach((eq, idx) => {
 if (!String(eq?.name || eq?.sku || "").trim()) {
 nextErrors[`equipment_${idx}`] = "Selecciona un equipo válido";
 }
 });

 setErrors(nextErrors);
 return Object.keys(nextErrors).length === 0;
 };

 const handleReviewAndConfirm = () => {
 if (!validateForm()) {
 showToast("Revisa los campos marcados", "warning");
 return;
 }
 setConfirmOpen(true);
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
 equipment: [...prev.equipment, { equipment_id: "", name: "", sku: "", type: "new_available" }]
 }));
 setErrors((prev) => ({ ...prev, equipment: "" }));
 };

 const updateEquipment = (index, field, value) => {
 if (field === "equipment_id") {
 const selected = equipmentOptions.find((opt) => String(opt.id || opt.unidad_id) === String(value));
 setFormData(prev => ({
 ...prev,
 equipment: prev.equipment.map((item, i) =>
 i === index
 ? {
 ...item,
 equipment_id: value,
 name: selected?.nombre || selected?.name || selected?.modelo || "",
 sku: selected?.sku || selected?.modelo || "",
 }
 : item
 )
 }));
 } else {
 setFormData(prev => ({
 ...prev,
 equipment: prev.equipment.map((item, i) =>
 i === index ? { ...item, [field]: value } : item
 )
 }));
 }

 if (errors[`equipment_${index}`]) {
 setErrors((prev) => ({ ...prev, [`equipment_${index}`]: "" }));
 }
 };

 const removeEquipment = (index) => {
 setFormData(prev => ({
 ...prev,
 equipment: prev.equipment.filter((_, i) => i !== index)
 }));
 };

 const submissionSteps = useMemo(
 () => [
 { id: "validating", label: "Validando datos de la solicitud" },
 { id: "uploading", label: "Adjuntando archivos y documentos" },
 { id: "submitting", label: "Creando solicitud de compra privada" },
 { id: "notifying", label: "Finalizando proceso" },
 ],
 [],
 );

 const sectionClasses = (idx) =>
 `rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${activeSection === idx ? "block" : "hidden md:block"}`;

 return (
 <Modal isOpen={isOpen} onClose={onClose} title="Nueva Compra Privada" maxWidth="max-w-6xl">
 {loading && (
 <ProcessingOverlay
 title="Creando solicitud de compra privada"
 steps={submissionSteps}
 activeStep={progressStep || "validating"}
 />
 )}

 <div className="mb-3 flex items-center justify-between md:hidden">
 {["Cliente", "Equipos", "Resumen"].map((label, idx) => (
 <button
 key={label}
 type="button"
 onClick={() => setActiveSection(idx)}
 className={`rounded-full px-3 py-1 text-xs font-semibold ${
 activeSection === idx ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
 }`}
 >
 {label}
 </button>
 ))}
 </div>

 <form
 onSubmit={(e) => {
 e.preventDefault();
 handleReviewAndConfirm();
 }}
 className="space-y-4"
 >
 <div className={sectionClasses(0)}>
 <h3 className="mb-3 text-base font-semibold text-slate-900">Información del Cliente</h3>
 <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
 <div className="relative">
 <label className="mb-1 block text-sm font-medium text-slate-700">
 Nombre comercial *
 </label>
 <div className="relative">
 <input
 type="text"
 value={clientSearchTerm}
 onChange={(e) => handleClientSearchChange(e.target.value)}
 onFocus={() => {
 if (filteredClients.length > 0) {
 setShowClientDropdown(true);
 }
 }}
 onBlur={() => setTimeout(() => setShowClientDropdown(false), 160)}
 placeholder={loadingClients ? "Cargando clientes..." : "Escribe o selecciona un cliente"}
 className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 ${
 errors.client_name ? "border-rose-400" : "border-slate-300"
 } ${selectedClient ? "bg-emerald-50" : isNewClient ? "bg-blue-50" : "bg-white"}`}
 disabled={loadingClients}
 />

 {selectedClient && (
 <span title="Cliente registrado" className="absolute right-2 top-2 rounded bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
 Registrado
 </span>
 )}
 {isNewClient && !selectedClient && (
 <span title="Cliente nuevo" className="absolute right-2 top-2 rounded bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-800">
 Nuevo
 </span>
 )}

 {showClientDropdown && filteredClients.length > 0 && (
 <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
 {filteredClients.map((client) => {
 if (!client) {
 return null;
 }
 return (
 <button
 key={client.id || `${client.nombre}-${client.commercial_name}`}
 type="button"
 onClick={() => handleClientSelect(client)}
 className="w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
 >
 <p className="text-sm font-medium text-slate-900">
 {client.commercial_name || client.nombre || 'Cliente sin nombre'}
 </p>
 </button>
 );
 })}
 </div>
 )}
 </div>
 <p className="mt-1 text-xs text-slate-500">
 {loadingClients ? "Cargando..." : "Escribe para buscar clientes existentes o crea uno nuevo"}
 </p>
 {errors.client_name && <p className="mt-1 text-xs text-rose-600">{errors.client_name}</p>}
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">
 Email
 </label>
 <input
 type="email"
 name="client_snapshot.client_email"
 value={formData.client_snapshot.client_email}
 onChange={handleChange}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
 placeholder="cliente@empresa.com"
 readOnly={selectedClient}
 />
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">
 Documento *
 </label>
 <div className="grid grid-cols-2 gap-2">
 <select
 value={formData.client_snapshot.identifier_type || 'ruc'}
 onChange={(e) =>
 setFormData((prev) => ({
 ...prev,
 client_snapshot: {
 ...prev.client_snapshot,
 identifier_type: e.target.value,
 client_identifier: "",
 },
 }))
 }
 className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
 >
 <option value="ruc">RUC</option>
 <option value="cedula">Cédula</option>
 </select>
 <input
 type="text"
 value={formData.client_snapshot.client_identifier}
 onChange={(e) => {
 const identifierType = formData.client_snapshot.identifier_type || "ruc";
 const maxLen = identifierType === 'cedula' ? 10 : 13;
 const digits = sanitizeDigits(e.target.value, maxLen);
 setFormData((prev) => ({
 ...prev,
 client_snapshot: {
 ...prev.client_snapshot,
 client_identifier: digits,
 },
 }));
 setErrors((prev) => ({ ...prev, client_identifier: "" }));
 }}
 placeholder={formData.client_snapshot.identifier_type === 'cedula' ? '10 dígitos' : '13 dígitos'}
 className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 ${
 errors.client_identifier ? "border-rose-400" : "border-slate-300"
 }`}
 />
 </div>
 {errors.client_identifier && <p className="mt-1 text-xs text-rose-600">{errors.client_identifier}</p>}
 </div>
 </div>
 </div>

 <div className={sectionClasses(1)}>
 <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
 <h3 className="text-base font-semibold text-slate-900">Equipos</h3>
 <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
 {formData.equipment.length} seleccionados
 </span>
 </div>

 <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
 <input
 type="text"
 value={equipmentSearch}
 onChange={(e) => setEquipmentSearch(e.target.value)}
 placeholder="Buscar equipo por nombre..."
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
 />
 <Button
 type="button"
 onClick={addEquipment}
 className="bg-slate-900 text-white hover:bg-slate-800"
 disabled={loadingEquipment}
 >
 <FiPlus className="mr-1" size={14} /> Agregar Equipo
 </Button>
 </div>

 {errors.equipment && <p className="mb-2 text-xs text-rose-600">{errors.equipment}</p>}

 {formData.equipment.length === 0 ? (
 <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500">
 No hay equipos agregados.
 </p>
 ) : (
 <div className="space-y-3">
 {formData.equipment.map((item, index) => (
 <div key={`private-eq-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
 <div className="mb-2 flex items-center justify-between">
 <p className="text-sm font-semibold text-slate-800">Equipo #{index + 1}</p>
 <button
 type="button"
 onClick={() => removeEquipment(index)}
 className="text-rose-600 hover:text-rose-700"
 aria-label={`Eliminar equipo ${index + 1}`}
 >
 <FiTrash2 size={16} />
 </button>
 </div>

 <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
 <div>
 <label className="mb-1 block text-xs font-medium text-slate-600">Equipo</label>
 <select
 value={item.equipment_id || ""}
 onChange={(e) => updateEquipment(index, "equipment_id", e.target.value)}
 disabled={loadingEquipment}
 className={`w-full rounded-lg border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 ${
 errors[`equipment_${index}`] ? "border-rose-400" : "border-slate-300"
 }`}
 >
 <option value="">
 {loadingEquipment ? "Cargando equipos..." : "Selecciona equipo"}
 </option>
 {filteredEquipmentOptions.map((opt) => (
 <option key={opt.id || opt.unidad_id} value={opt.id || opt.unidad_id}>
 {opt.nombre || opt.name || opt.modelo || "Equipo"}
 </option>
 ))}
 </select>
 {errors[`equipment_${index}`] && (
 <p className="mt-1 text-xs text-rose-600">{errors[`equipment_${index}`]}</p>
 )}
 </div>

 <div>
 <label className="mb-1 block text-xs font-medium text-slate-600">SKU</label>
 <input
 type="text"
 placeholder="SKU/Modelo"
 value={item.sku || ""}
 onChange={(e) => updateEquipment(index, "sku", e.target.value)}
 className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
 />
 </div>

 <div>
 <label className="mb-1 block text-xs font-medium text-slate-600">Estado</label>
 <div className="flex flex-wrap gap-2">
 {[
 { value: "new_available", label: "Nuevo disponible" },
 { value: "new_import", label: "Nuevo importación" },
 { value: "cu", label: "CU" },
 ].map((opt) => (
 <button
 key={opt.value}
 type="button"
 onClick={() => updateEquipment(index, "type", opt.value)}
 className={`rounded-full border px-2 py-1 text-xs font-semibold ${
 item.type === opt.value
 ? TYPE_CHIPS[opt.value]
 : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
 }`}
 >
 {opt.label}
 </button>
 ))}
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className={sectionClasses(2)}>
 <h3 className="mb-3 text-base font-semibold text-slate-900">Resumen y notas</h3>
 <div className="grid gap-3 lg:grid-cols-4">
 <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
 <p className="text-xs uppercase tracking-wide text-slate-500">Cliente</p>
 <p className="mt-1 text-sm font-semibold text-slate-900">
 {formData.client_snapshot.commercial_name || "Pendiente"}
 </p>
 </div>
 <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
 <p className="text-xs uppercase tracking-wide text-slate-500">Documento</p>
 <p className="mt-1 text-sm font-semibold text-slate-900">
 {formData.client_snapshot.client_identifier || "Pendiente"}
 </p>
 </div>
 <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
 <p className="text-xs uppercase tracking-wide text-slate-500">Tipo oferta</p>
 <p className="mt-1 text-sm font-semibold text-slate-900">
 {formData.offer_kind === "alquiler_transferencia_dominio"
 ? "Alquiler con transferencia de dominio"
 : formData.offer_kind || "Pendiente"}
 </p>
 </div>
 <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
 <p className="text-xs uppercase tracking-wide text-slate-500">Equipos</p>
 <p className="mt-1 text-sm font-semibold text-slate-900">{formData.equipment.length}</p>
 </div>
 </div>

 <div className="mt-4 space-y-4">
 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">
 Tipo de oferta
 </label>
 {hideOfferKindSelector ? (
 <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
 {OFFER_KIND_LABELS[formData.offer_kind] || formData.offer_kind}
 </div>
 ) : (
 <select
 name="offer_kind"
 value={formData.offer_kind}
 onChange={handleChange}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
 >
 <option value="venta">Venta</option>
 <option value="alquiler">Alquiler</option>
 <option value="alquiler_transferencia_dominio">Alquiler con transferencia de dominio</option>
 <option value="comodato">Comodato</option>
 </select>
 )}

 {formData.offer_kind === 'comodato' && (
 <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
 <div className="text-sm">
 <p className="font-medium text-amber-800">Comodato solo disponible para clientes registrados</p>
 <p className="mt-1 text-amber-700">
 El comodato requiere que el cliente esté previamente registrado en el sistema.
 </p>
 </div>
 </div>
 )}
 </div>

 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">
 Notas adicionales
 </label>
 <textarea
 name="notes"
 value={formData.notes}
 onChange={handleChange}
 rows={3}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
 placeholder="Información adicional sobre la solicitud..."
 />
 </div>
 </div>
 </div>

 <div className="sticky bottom-0 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
 <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
 <div>
 <p className="text-xs text-slate-500">Resumen rápido</p>
 <p className="text-sm font-medium text-slate-800">
 {formData.client_snapshot.commercial_name || "Sin cliente"} · {formData.equipment.length} equipo(s)
 </p>
 {!canSubmit && <p className="text-xs text-amber-700">Falta: {validationIssues[0]}</p>}
 </div>
 <div className="flex gap-2">
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
 disabled={!canSubmit}
 isLoading={loading}
 >
 Revisar y confirmar
 </Button>
 </div>
 </div>
 </div>
 </form>

 {confirmOpen && (
 <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 p-4">
 <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
 <div className="mb-3 flex items-center gap-2">
 <FiCheckCircle className="text-emerald-600" />
 <h4 className="text-lg font-semibold text-slate-900">Confirmar creación</h4>
 </div>
 <div className="space-y-2 text-sm text-slate-700">
 <p><span className="font-semibold">Cliente:</span> {formData.client_snapshot.commercial_name}</p>
 <p>
 <span className="font-semibold">Documento:</span>{" "}
 {sanitizeDigits(
 formData.client_snapshot.client_identifier,
 formData.client_snapshot.identifier_type === "cedula" ? 10 : 13
 )}
 </p>
 <p><span className="font-semibold">Tipo de oferta:</span> {formData.offer_kind}</p>
 <p><span className="font-semibold">Equipos:</span> {formData.equipment.length}</p>
 </div>
 <div className="mt-4 flex justify-end gap-2">
 <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={loading}>
 Volver
 </Button>
 <Button type="button" onClick={submitConfirmed} isLoading={loading}>
 Confirmar creación
 </Button>
 </div>
 </div>
 </div>
 )}
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
