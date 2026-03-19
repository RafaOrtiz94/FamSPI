import React, { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiPlus, FiTrash2 } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import ProcessingOverlay from "../../../core/ui/components/ProcessingOverlay";
import { useUI } from "../../../core/ui/useUI";
import api from "../../../core/api/index";

const TYPE_CHIPS = {
 new_available: "bg-emerald-100 text-emerald-800 border-emerald-200",
 new_import: "bg-amber-100 text-amber-800 border-amber-200",
 cu: "bg-sky-100 text-sky-800 border-sky-200",
};

const sanitizeDigits = (value, max) => String(value || "").replace(/\D/g, "").slice(0, max);

export const NewPublicPurchaseRequestModal = ({ isOpen, onClose, onSuccess }) => {
 const { showToast } = useUI();

 const [formData, setFormData] = useState({
 client_id: "",
 client_name: "",
 client_identifier: "",
 assigned_to: "",
 equipment: [],
 notes: "",
 });
 const [errors, setErrors] = useState({});
 const [loading, setLoading] = useState(false);
 const [progressStep, setProgressStep] = useState(null);
 const [confirmOpen, setConfirmOpen] = useState(false);

 const [equipmentOptions, setEquipmentOptions] = useState([]);
 const [acpUsers, setAcpUsers] = useState([]);
 const [availableClients, setAvailableClients] = useState([]);
 const [loadingMeta, setLoadingMeta] = useState(false);

 const [clientSearchTerm, setClientSearchTerm] = useState("");
 const [showClientDropdown, setShowClientDropdown] = useState(false);
 const [selectedClient, setSelectedClient] = useState(null);
 const [isNewClient, setIsNewClient] = useState(false);
 const [equipmentSearch, setEquipmentSearch] = useState("");
 const [activeSection, setActiveSection] = useState(0);

 const filteredClients = useMemo(() => {
 const term = clientSearchTerm.trim().toLowerCase();
 if (!term) return [];
 return availableClients
 .filter((client) => {
 const name = String(client?.commercial_name || client?.nombre || "").toLowerCase();
 return name.includes(term);
 })
 .slice(0, 6);
 }, [availableClients, clientSearchTerm]);

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
 if (!String(formData.client_name || "").trim()) issues.push("Ingresa la razón social del cliente");
 if (sanitizeDigits(formData.client_identifier, 13).length !== 13) issues.push("El RUC debe tener 13 dígitos");
 if (!formData.assigned_to) issues.push("Asigna un ACP Comercial");
 if (!Array.isArray(formData.equipment) || formData.equipment.length === 0) issues.push("Agrega al menos un equipo");
 if (
 Array.isArray(formData.equipment) &&
 formData.equipment.some((eq) => !String(eq?.name || eq?.sku || "").trim())
 ) {
 issues.push("Todos los equipos deben tener al menos nombre o SKU");
 }
 return issues;
 }, [formData]);

 const canSubmit = validationIssues.length === 0 && !loading;

 useEffect(() => {
 if (!isOpen) return;

 const loadMeta = async () => {
 setLoadingMeta(true);
 try {
 const response = await api.get("/equipment-purchases/meta");
 const data = response.data?.data || {};
 const clients = Array.isArray(data.clients) ? data.clients : [];
 const equipment = Array.isArray(data.equipment) ? data.equipment : [];
 const acp = Array.isArray(data.acp_users) ? data.acp_users : [];

 setAvailableClients(clients);
 setEquipmentOptions(equipment);
 setAcpUsers(acp);

 setFormData((prev) => ({
 ...prev,
 assigned_to: prev.assigned_to || acp?.[0]?.id || "",
 }));
 } catch (_error) {
 showToast("Error al cargar catálogo de compras", "error");
 } finally {
 setLoadingMeta(false);
 }
 };

 loadMeta();
 }, [isOpen, showToast]);

 useEffect(() => {
 if (!isOpen) {
 setFormData({
 client_id: "",
 client_name: "",
 client_identifier: "",
 assigned_to: "",
 equipment: [],
 notes: "",
 });
 setErrors({});
 setClientSearchTerm("");
 setShowClientDropdown(false);
 setSelectedClient(null);
 setIsNewClient(false);
 setEquipmentSearch("");
 setActiveSection(0);
 setConfirmOpen(false);
 setProgressStep(null);
 }
 }, [isOpen]);

 const handleClientSelect = (client) => {
 const commercialName = client?.commercial_name || client?.nombre || "";
 const identifier = String(
 client?.client_identifier || client?.identificador || client?.identifier || client?.ruc || client?.ruc_cedula || "",
 );

 setSelectedClient(client);
 setIsNewClient(false);
 setShowClientDropdown(false);
 setClientSearchTerm(commercialName);

 setFormData((prev) => ({
 ...prev,
 client_id: client.id,
 client_name: commercialName,
 client_identifier: sanitizeDigits(identifier, 13),
 }));

 setErrors((prev) => ({ ...prev, client_name: "", client_identifier: "" }));
 };

 const handleClientSearchChange = (value) => {
 setClientSearchTerm(value);

 if (!value.trim()) {
 setSelectedClient(null);
 setIsNewClient(false);
 setShowClientDropdown(false);
 setFormData((prev) => ({
 ...prev,
 client_id: "",
 client_name: "",
 client_identifier: "",
 }));
 return;
 }

 const exactMatch = availableClients.find((client) => {
 const name = String(client?.commercial_name || client?.nombre || "").trim().toLowerCase();
 return name === value.trim().toLowerCase();
 });

 if (exactMatch) {
 handleClientSelect(exactMatch);
 return;
 }

 setSelectedClient(null);
 setIsNewClient(true);
 setShowClientDropdown(true);
 setFormData((prev) => ({
 ...prev,
 client_id: "",
 client_name: value,
 client_identifier: "",
 }));
 setErrors((prev) => ({ ...prev, client_name: "" }));
 };

 const addEquipment = () => {
 setFormData((prev) => ({
 ...prev,
 equipment: [...prev.equipment, { equipment_id: "", name: "", sku: "", type: "new_available" }],
 }));
 setErrors((prev) => ({ ...prev, equipment: "" }));
 };

 const updateEquipment = (index, field, value) => {
 setFormData((prev) => ({
 ...prev,
 equipment: prev.equipment.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
 }));

 if (field === "equipment_id") {
 const selected = equipmentOptions.find(
 (eq) => String(eq.id) === String(value) || String(eq.unidad_id) === String(value),
 );
 if (selected) {
 setFormData((prev) => ({
 ...prev,
 equipment: prev.equipment.map((item, i) =>
 i === index
 ? {
 ...item,
 equipment_id: value,
 name: selected.name || selected.nombre || selected.modelo || "",
 sku: selected.sku || selected.modelo || "",
 }
 : item,
 ),
 }));
 }
 }

 if (errors[`equipment_${index}`]) {
 setErrors((prev) => ({ ...prev, [`equipment_${index}`]: "" }));
 }
 };

 const removeEquipment = (index) => {
 setFormData((prev) => ({
 ...prev,
 equipment: prev.equipment.filter((_, i) => i !== index),
 }));
 };

 const validateForm = () => {
 const nextErrors = {};

 if (!String(formData.client_name || "").trim()) {
 nextErrors.client_name = "La razón social es obligatoria";
 }

 if (sanitizeDigits(formData.client_identifier, 13).length !== 13) {
 nextErrors.client_identifier = "Ingresa un RUC válido de 13 dígitos";
 }

 if (!formData.assigned_to) {
 nextErrors.assigned_to = "Selecciona un ACP Comercial";
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

 const submitConfirmed = async () => {
 setLoading(true);
 setProgressStep("validating");

 try {
 setProgressStep("submitting");

 const payload = {
 client_id: formData.client_id || null,
 client_name: String(formData.client_name || "").trim(),
 client_identifier: sanitizeDigits(formData.client_identifier, 13),
 assigned_to: formData.assigned_to || null,
 equipment: formData.equipment.map((eq) => ({
 equipment_id: eq.equipment_id || undefined,
 name: String(eq.name || eq.sku || "").trim(),
 sku: String(eq.sku || "").trim() || undefined,
 type: eq.type || "new_available",
 })),
 notes: formData.notes,
 extra: {
 client_identifier: sanitizeDigits(formData.client_identifier, 13),
 },
 };

 const response = await api.post("/equipment-purchases", payload);

 setProgressStep("notifying");
 showToast("Solicitud de compra pública creada correctamente", "success");
 setConfirmOpen(false);
 onSuccess?.(response.data);
 onClose();
 } catch (error) {
 const message = error?.response?.data?.message || "Error al crear la solicitud de compra pública";
 showToast(message, "error");
 } finally {
 setLoading(false);
 setProgressStep(null);
 }
 };

 const handleReviewAndConfirm = () => {
 if (!validateForm()) {
 showToast("Revisa los campos marcados", "warning");
 return;
 }
 setConfirmOpen(true);
 };

 const sectionClasses = (idx) =>
 `rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${activeSection === idx ? "block" : "hidden md:block"}`;

 return (
 <Modal isOpen={isOpen} onClose={onClose} title="Nueva Compra Pública" maxWidth="max-w-6xl">
 {loading && (
 <ProcessingOverlay
 title="Creando solicitud de compra pública"
 steps={[
 { id: "validating", label: "Validando datos de la solicitud" },
 { id: "submitting", label: "Creando solicitud de compra pública" },
 { id: "notifying", label: "Finalizando proceso" },
 ]}
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
 <label className="mb-1 block text-sm font-medium text-slate-700">Razón social *</label>
 <input
 type="text"
 value={clientSearchTerm}
 onChange={(e) => handleClientSearchChange(e.target.value)}
 onFocus={() => {
 if (filteredClients.length > 0) setShowClientDropdown(true);
 }}
 onBlur={() => setTimeout(() => setShowClientDropdown(false), 160)}
 placeholder={loadingMeta ? "Cargando clientes..." : "Escribe o selecciona un cliente"}
 className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 ${
 errors.client_name ? "border-rose-400" : "border-slate-300"
 } ${selectedClient ? "bg-emerald-50" : isNewClient ? "bg-blue-50" : "bg-white"}`}
 disabled={loadingMeta}
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
 {filteredClients.map((client) => (
 <button
 key={client.id}
 type="button"
 onClick={() => handleClientSelect(client)}
 className="w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
 >
 <p className="text-sm font-medium text-slate-900">{client.commercial_name || client.nombre || "Cliente"}</p>
 </button>
 ))}
 </div>
 )}
 {errors.client_name && <p className="mt-1 text-xs text-rose-600">{errors.client_name}</p>}
 </div>

 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">RUC *</label>
 <input
 type="text"
 value={formData.client_identifier}
 onChange={(e) => {
 setFormData((prev) => ({ ...prev, client_identifier: sanitizeDigits(e.target.value, 13) }));
 setErrors((prev) => ({ ...prev, client_identifier: "" }));
 }}
 placeholder="13 dígitos"
 className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 ${
 errors.client_identifier ? "border-rose-400" : "border-slate-300"
 }`}
 />
 {errors.client_identifier && <p className="mt-1 text-xs text-rose-600">{errors.client_identifier}</p>}
 </div>

 <div>
 <label className="mb-1 block text-sm font-medium text-slate-700">Asignar a ACP *</label>
 <select
 value={formData.assigned_to}
 onChange={(e) => {
 setFormData((prev) => ({ ...prev, assigned_to: e.target.value }));
 setErrors((prev) => ({ ...prev, assigned_to: "" }));
 }}
 className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 ${
 errors.assigned_to ? "border-rose-400" : "border-slate-300"
 }`}
 disabled={loadingMeta}
 >
 <option value="">Selecciona un ACP Comercial</option>
 {acpUsers.map((user) => (
 <option key={user.id} value={user.id}>
 {user.name || user.fullname || user.email}
 </option>
 ))}
 </select>
 {errors.assigned_to && <p className="mt-1 text-xs text-rose-600">{errors.assigned_to}</p>}
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
 disabled={loadingMeta}
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
 {formData.equipment.map((equipment, index) => (
 <div key={`public-eq-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
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
 value={equipment.equipment_id || ""}
 onChange={(e) => updateEquipment(index, "equipment_id", e.target.value)}
 className={`w-full rounded-lg border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 ${
 errors[`equipment_${index}`] ? "border-rose-400" : "border-slate-300"
 }`}
 disabled={loadingMeta}
 >
 <option value="">Seleccionar equipo</option>
 {filteredEquipmentOptions.map((option) => (
 <option key={option.id || option.unidad_id} value={option.id || option.unidad_id}>
 {option.name || option.nombre || option.modelo || "Equipo"}
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
 value={equipment.sku || ""}
 onChange={(e) => updateEquipment(index, "sku", e.target.value)}
 className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
 placeholder="SKU"
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
 equipment.type === opt.value
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
 <div className="grid gap-3 lg:grid-cols-3">
 <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
 <p className="text-xs uppercase tracking-wide text-slate-500">Cliente</p>
 <p className="mt-1 text-sm font-semibold text-slate-900">{formData.client_name || "Pendiente"}</p>
 </div>
 <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
 <p className="text-xs uppercase tracking-wide text-slate-500">RUC</p>
 <p className="mt-1 text-sm font-semibold text-slate-900">
 {formData.client_identifier || "Pendiente"}
 </p>
 </div>
 <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
 <p className="text-xs uppercase tracking-wide text-slate-500">Equipos</p>
 <p className="mt-1 text-sm font-semibold text-slate-900">{formData.equipment.length}</p>
 </div>
 </div>

 <div className="mt-3">
 <label className="mb-1 block text-sm font-medium text-slate-700">Notas</label>
 <textarea
 value={formData.notes}
 onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
 rows={3}
 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
 placeholder="Información adicional..."
 />
 </div>
 </div>

 <div className="sticky bottom-0 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
 <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
 <div>
 <p className="text-xs text-slate-500">Resumen rápido</p>
 <p className="text-sm font-medium text-slate-800">
 {formData.client_name || "Sin cliente"} · {formData.equipment.length} equipo(s)
 </p>
 {!canSubmit && (
 <p className="text-xs text-amber-700">Falta: {validationIssues[0]}</p>
 )}
 </div>
 <div className="flex gap-2">
 <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
 Cancelar
 </Button>
 <Button type="submit" disabled={!canSubmit} isLoading={loading}>
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
 <p><span className="font-semibold">Cliente:</span> {formData.client_name}</p>
 <p><span className="font-semibold">RUC:</span> {sanitizeDigits(formData.client_identifier, 13)}</p>
 <p><span className="font-semibold">ACP:</span> {acpUsers.find((u) => String(u.id) === String(formData.assigned_to))?.name || "N/D"}</p>
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

export default NewPublicPurchaseRequestModal;
