import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { FiLink, FiSave, FiPlus, FiTrash2 } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import { useAutoEditSection } from "../BusinessCaseWorkspaceContext";
import SectionEditorBadge from "../SectionEditorBadge";

// Mismos roles que ya autoriza el backend en POST /sections/:section/unlock.
const LIS_REOPEN_ROLES = new Set(["acp_comercial", "backoffice", "backoffice_comercial", "jefe_comercial", "jefe_de_comercial"]);

// EMPTY SCHEMA - Initialize with no default values
const EMPTY_SCHEMA = {
 requiresLis: false,
 requiresInterface: false,
 systemProvider: "",
 includesHardware: false,
 monthlyPatients: "",
 lisObservations: "",
 interfaceObservations: "",
};

const LIS_PROVIDER_OPTIONS = [
 { value: "orion", label: "Orion" },
 { value: "cobas_infiniti", label: "Cobas Infiniti" },
 { value: "other", label: "Otro" },
];

/**
 * LISSection - Workspace section for Laboratory Information System integration
 */
const LISSection = ({ businessCase, permissions = {}, ownership = {}, onSave }) => {
 const { id: bcId } = useParams();
 const { showToast } = useUI();
 const [saving, setSaving] = useState(false);
 const [isEditing, setIsEditing] = useState(false);
 useAutoEditSection("lis", () => setIsEditing(true));

 // ONE-TIME HYDRATION GUARD
 const hydratedRef = useRef(false);

 // COMPLETE SECTION DATA - All fields from businessCase, even conditional ones
 const sectionData = useMemo(() => {
 const lisData = businessCase?.lis_integration || businessCase?.lisIntegration || null;
 if (!lisData) return EMPTY_SCHEMA;
 const requiresLis = Boolean(lisData.includes_lis ?? lisData.lis_includes);
 const requiresInterface = !requiresLis && Boolean(lisData.requires_interface);

 return {
 requiresLis,
 requiresInterface,
 systemProvider: lisData.lis_provider || "",
 includesHardware: Boolean(lisData.includes_hardware),
 monthlyPatients: lisData.monthly_patients || "",
 lisObservations: lisData.lis_observations || "",
 interfaceObservations: lisData.interface_observations || "",
  };
 }, [businessCase]);

 // State for dynamic interfaces (these don't come from businessCase initially)
 const [interfaces, setInterfaces] = useState([]);

 const ensureDefaultInterfaces = () => ([
 { id: Date.now(), model: "", provider: "" },
 { id: Date.now() + 1, model: "", provider: "" },
 { id: Date.now() + 2, model: "", provider: "" }
 ]);

 // Initialize state with sectionData (deterministic hydration)
 const [formData, setFormData] = useState(() => sectionData);

 // HYDRATE INTERFACES - This comes from API, not businessCase
 useEffect(() => {
 const lisData = businessCase?.lis_integration || businessCase?.lisIntegration || null;
 const savedInterfaces = lisData?.equipmentInterfaces || lisData?.interfaces || [];
 if (!savedInterfaces?.length) return;
 setInterfaces(savedInterfaces.map((iface) => ({
 id: iface.id || Date.now() + Math.random(),
 model: iface.model || "",
 provider: iface.provider || ""
 })));
 }, [businessCase]);

 // Auto-seed 3 interface rows when interface is required and none exist
 useEffect(() => {
 if (!formData.requiresInterface) return;
 if (interfaces.length > 0) return;
 setInterfaces(ensureDefaultInterfaces());
 }, [formData.requiresInterface, interfaces.length]);

 // ONE-TIME HYDRATION: Reset form with complete sectionData
 useEffect(() => {
 // GUARD: Only hydrate once, when sectionData is available and different
 if (!sectionData || hydratedRef.current) return;

 console.log('LISSection: Hydrating with sectionData:', sectionData);
 setFormData(sectionData);
 hydratedRef.current = true; // Mark as hydrated - never reset again
 }, [sectionData]);

 const handleChange = (field, value) => {
 setFormData((prev) => {
 const next = { ...prev, [field]: value };

 if (field === "requiresLis" && value) {
 return {
 ...next,
 requiresInterface: false,
 };
 }

 if (field === "requiresInterface" && value) {
 return {
 ...next,
 requiresLis: false,
 monthlyPatients: "",
 };
 }

 return next;
 });
 };

 const handleAddInterface = () => {
 setInterfaces((prev) => [
 ...prev,
 { id: Date.now(), model: "", provider: "" },
 ]);
 };

 const handleRemoveInterface = (id) => {
 setInterfaces((prev) => prev.filter((i) => i.id !== id));
 };

 const handleInterfaceChange = (id, field, value) => {
 setInterfaces((prev) =>
 prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
 );
 };

 const handleSave = async () => {
 if (!bcId) {
 showToast("Error: No se encontro el Business Case ID", "error");
 return;
 }

 try {
 setSaving(true);
  const payload = {
  includes_lis: formData.requiresLis,
  requires_interface: formData.requiresInterface,
  lis_provider: formData.systemProvider || null,
  includes_hardware: formData.includesHardware,
  monthly_patients: formData.requiresLis && formData.monthlyPatients ? parseInt(formData.monthlyPatients) : null,
  lis_observations: formData.requiresLis ? (formData.lisObservations || null) : null,
  interface_observations: formData.requiresInterface ? (formData.interfaceObservations || null) : null,
  interfaces: formData.requiresInterface
  ? interfaces
  .filter((i) => i.model || i.provider)
  .map((i) => ({
  model: i.model || null,
  provider: i.provider || null,
  }))
  : [],
  };

 await api.post(`/business-case/${bcId}/lis-integration`, payload);
 showToast("Integracion LIS guardada", "success");
 setIsEditing(false);
 if (onSave) onSave();
 } catch (err) {
 console.error("Error saving LIS data:", err);
 showToast("Error guardando integracion LIS", "error");
 } finally {
 setSaving(false);
 }
 };

 const canEdit = permissions.canEdit !== false && ownership.canUserEdit !== false;

 // Reabrir "lis" tras el auto-bloqueo al guardar comercial (ver
 // saveLisIntegration en businessCase.controller.js).
 const canReopenLis = ownership?.isLocked === true && LIS_REOPEN_ROLES.has(permissions?.userRole || "");
 const handleReopenLis = async () => {
 if (!bcId || saving) return;
 setSaving(true);
 try {
  await api.post(`/business-case/${bcId}/sections/lis/unlock`);
  if (onSave) onSave();
  showToast("Sección reabierta para edición.", "success");
 } catch (err) {
  showToast("No se pudo reabrir la sección.", "error");
 } finally {
  setSaving(false);
 }
 };

 return (
 <div className="space-y-5">
 {/* Section Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div className="flex items-center gap-4">
 
 <div>
 <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Integración LIS</h2>
 <p className="text-sm text-gray-500 mt-1">Defina si el proyecto requiere LIS o requiere interfaz con equipos</p>
 <div className="mt-2">
 <SectionEditorBadge ownership={ownership} />
 </div>
 </div>
 </div>
 </div>

 <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300">
 <div className="space-y-4">
 <div>
 <h3 className="text-lg font-semibold text-gray-900">Tipo de integración requerida</h3>
 <p className="text-sm text-gray-500 mt-1">
 Seleccione solo una opción. Requiere LIS y requiere interfaz son mutuamente excluyentes.
 </p>
 </div>

 <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
 <button
 type="button"
 onClick={() => isEditing && handleChange("requiresLis", !formData.requiresLis)}
 disabled={!isEditing}
 className={`rounded-2xl border px-4 py-4 text-left transition-all ${
 formData.requiresLis
 ? "border-blue-500 bg-blue-50 shadow-sm"
 : "border-gray-200 bg-white hover:border-blue-200"
 } disabled:cursor-not-allowed disabled:opacity-70`}
 >
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-sm font-semibold text-gray-900">Requiere LIS</p>
 <p className="mt-1 text-xs text-gray-500">Usa sistema LIS para el proyecto y habilita datos clínicos asociados.</p>
 </div>
 <span className={`mt-0.5 inline-flex h-5 w-5 rounded-full border ${formData.requiresLis ? "border-blue-600 bg-blue-600" : "border-gray-300 bg-white"}`} />
 </div>
 </button>

 <button
 type="button"
 onClick={() => isEditing && handleChange("requiresInterface", !formData.requiresInterface)}
 disabled={!isEditing}
 className={`rounded-2xl border px-4 py-4 text-left transition-all ${
 formData.requiresInterface
 ? "border-emerald-500 bg-emerald-50 shadow-sm"
 : "border-gray-200 bg-white hover:border-emerald-200"
 } disabled:cursor-not-allowed disabled:opacity-70`}
 >
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-sm font-semibold text-gray-900">Requiere interfaz</p>
 <p className="mt-1 text-xs text-gray-500">Habilita únicamente la configuración de interfaces de equipos.</p>
 </div>
 <span className={`mt-0.5 inline-flex h-5 w-5 rounded-full border ${formData.requiresInterface ? "border-emerald-600 bg-emerald-600" : "border-gray-300 bg-white"}`} />
 </div>
 </button>
 </div>
 </div>
 </div>

 {(formData.requiresLis || formData.requiresInterface) && (
 <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 animate-fadeIn">
 <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
 <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
 <FiLink size={20} />
 </div>
 <h3 className="text-lg font-semibold text-gray-900">Datos comunes</h3>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
 <div className="space-y-2">
 <label className="text-sm font-medium text-gray-700 ml-1">
 Proveedor del sistema a trabajar
 </label>
 <div className="relative">
 <select
 value={formData.systemProvider || ""}
 onChange={(e) => handleChange("systemProvider", e.target.value)}
 disabled={!isEditing}
 className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500 bg-white"
 >
 <option value="">Selecciona proveedor</option>
 {LIS_PROVIDER_OPTIONS.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
 </div>
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-gray-700 ml-1">
 ¿Incluye hardware?
 </label>
 <div className="relative">
 <select
 value={formData.includesHardware ? "yes" : "no"}
 onChange={(e) => handleChange("includesHardware", e.target.value === "yes")}
 disabled={!isEditing}
 className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500 bg-white"
 >
 <option value="no">No</option>
 <option value="yes">Sí</option>
 </select>
 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* LIS Configuration */}
 {formData.requiresLis && (
  <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 animate-fadeIn">
  <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
  <FiLink size={20} />
  </div>
  <h3 className="text-lg font-semibold text-gray-900">Configuración específica de LIS</h3>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
  <div className="space-y-2">
  <label className="text-sm font-medium text-gray-700 ml-1">
  Número de pacientes mensual
  </label>
  <input
  type="number"
  min="0"
  value={formData.monthlyPatients}
  onChange={(e) => handleChange("monthlyPatients", e.target.value)}
  disabled={!isEditing}
  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500"
  placeholder="Ej: 5000"
  />
  </div>

  <div className="space-y-2 md:col-span-2">
  <label className="text-sm font-medium text-gray-700 ml-1">
  Observaciones LIS
  </label>
  <textarea
  value={formData.lisObservations}
  onChange={(e) => handleChange("lisObservations", e.target.value)}
  disabled={!isEditing}
  rows={4}
  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500 resize-y"
  placeholder="Detalle requerimientos, condiciones o consideraciones especificas para la implementacion LIS"
  />
  </div>
  </div>
  </div>
  )}

  {/* Equipment Interfaces */}
  {formData.requiresInterface && (
  <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 animate-fadeIn">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4 mb-5">
  <h3 className="text-lg font-semibold text-gray-900">Interfaces de equipos</h3>
 {isEditing && (
 <button
 onClick={handleAddInterface}
 className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-green-50 text-green-700 font-semibold rounded-xl hover:bg-green-100 active:scale-[0.99] transition-all w-full sm:w-auto"
 >
 <FiPlus size={16} />
 Agregar interfaz
 </button>
 )}
 </div>

 <div className="space-y-2 mb-5">
 <label className="text-sm font-medium text-gray-700 ml-1">
 Observaciones de interfaz
 </label>
 <textarea
 value={formData.interfaceObservations}
 onChange={(e) => handleChange("interfaceObservations", e.target.value)}
 disabled={!isEditing}
 rows={4}
 className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500 resize-y bg-white"
 placeholder="Detalle requerimientos, equipos, integraciones o condiciones especificas para las interfaces"
 />
 </div>

 {interfaces.length === 0 ? (
 <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
 <p className="text-gray-500 font-medium">No hay interfaces de equipos configuradas</p>
 {isEditing && (
 <button
 onClick={handleAddInterface}
 className="mt-3 text-blue-600 hover:text-blue-700 font-medium hover:underline transition-all"
 >
 Agregar primera interfaz
 </button>
 )}
 </div>
 ) : (
 <div className="space-y-4">
 {interfaces.map((iface, idx) => (
 <div
 key={iface.id}
 className="flex flex-col md:flex-row gap-4 items-start p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-100 transition-all group"
 >
 <span className="text-sm font-bold text-gray-400 mt-3 md:w-8">
 #{idx + 1}
 </span>
 <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
 <div className="space-y-1">
 <label className="text-xs font-medium text-gray-500 ml-1">Modelo</label>
 <input
 type="text"
 value={iface.model}
 onChange={(e) =>
 handleInterfaceChange(iface.id, "model", e.target.value)
 }
 disabled={!isEditing}
 className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
 placeholder="Modelo del equipo"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-gray-500 ml-1">Proveedor</label>
 <input
 type="text"
 value={iface.provider}
 onChange={(e) =>
 handleInterfaceChange(iface.id, "provider", e.target.value)
 }
 disabled={!isEditing}
 className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
 placeholder="Proveedor del equipo"
 />
 </div>
 </div>
 {isEditing && (
 <button
 onClick={() => handleRemoveInterface(iface.id)}
 className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all mt-2 md:mt-4 opacity-0 group-hover:opacity-100"
 title="Eliminar interfaz"
 >
 <FiTrash2 size={18} />
 </button>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Info Card */}
 <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
 <div className="flex items-start gap-3">
 <div className="text-blue-600 mt-0.5 text-lg">Info</div>
 <div>
 <h4 className="font-semibold text-blue-900 text-sm">Información Importante</h4>
  <p className="text-sm text-blue-700/80 mt-1 leading-relaxed">
  Defina correctamente si el proyecto requiere LIS o solo requiere interfaz.
  Los datos comunes impactan costos y las interfaces aplican únicamente al apartado de requiere interfaz.
  </p>
 </div>
 </div>
 </div>

 {/* Section Actions */}
 {canEdit && (
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100">
 <p className="text-xs text-gray-400 font-medium">
  {isEditing ? "Los cambios se guardan al presionar Guardar." : "Sección en modo solo lectura."}
 </p>
 {isEditing ? (
  <div className="flex gap-2 sm:justify-end">
  <button
  type="button"
  onClick={() => {
  setFormData(sectionData);
  const lisData = businessCase?.lis_integration || businessCase?.lisIntegration || null;
  const savedInterfaces = lisData?.equipmentInterfaces || lisData?.interfaces || [];
  setInterfaces(savedInterfaces.map((iface) => ({
  id: iface.id || Date.now() + Math.random(),
  model: iface.model || "",
  provider: iface.provider || ""
  })));
  setIsEditing(false);
  }}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all w-full sm:w-auto"
  >
  Cancelar
  </button>
  <button
  onClick={handleSave}
  disabled={saving}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.99] shadow-sm transition-all disabled:opacity-50 disabled:scale-100 w-full sm:w-auto"
  >
  <FiSave size={16} />
  {saving ? "Guardando..." : "Guardar"}
  </button>
  </div>
 ) : (
  <button
  type="button"
  onClick={() => setIsEditing(true)}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all w-full sm:w-auto"
  >
  Editar
  </button>
 )}
 </div>
 )}

 {!canEdit && ownership?.isLocked && (
 <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <span className="text-sm text-amber-800 font-medium">
 Comercial ya guardó esta sección y quedó en solo lectura.
 </span>
 {canReopenLis && (
 <button
  type="button"
  onClick={handleReopenLis}
  disabled={saving}
  className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 w-full sm:w-auto"
 >
  Reabrir para edición
 </button>
 )}
 </div>
 )}
 </div>
 );
};

export default LISSection;
