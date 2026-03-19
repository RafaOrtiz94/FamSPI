import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { FiLink, FiSave, FiPlus, FiTrash2 } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import Card from "../../../../../core/ui/components/Card";

// EMPTY SCHEMA - Initialize with no default values
const EMPTY_SCHEMA = {
 lisIncludes: false,
 lisProvider: "",
 lisIncludesHardware: false,
 lisMonthlyPatients: "",
 currentSystemInterface: false,
 currentSystemName: "",
 currentSystemProvider: "",
 currentSystemHardware: false,
};

/**
 * LISSection - Workspace section for Laboratory Information System integration
 */
const LISSection = ({ businessCase, permissions = {}, ownership = {}, onSave }) => {
 const { id: bcId } = useParams();
 const { showToast } = useUI();
 const [saving, setSaving] = useState(false);

 // ONE-TIME HYDRATION GUARD
 const hydratedRef = useRef(false);

 // COMPLETE SECTION DATA - All fields from businessCase, even conditional ones
 const sectionData = useMemo(() => {
 const lisData = businessCase?.lis_integration || businessCase?.lisIntegration || null;
 if (!lisData) return EMPTY_SCHEMA;

 return {
 lisIncludes: lisData.lis_includes || false,
 lisProvider: lisData.lis_provider || "",
 lisIncludesHardware: lisData.includes_hardware || false,
 lisMonthlyPatients: lisData.monthly_patients || "",
 currentSystemInterface: Boolean(lisData.current_system_name || lisData.current_system_provider),
 currentSystemName: lisData.current_system_name || "",
 currentSystemProvider: lisData.current_system_provider || "",
 currentSystemHardware: lisData.current_system_hardware || false,
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

 // Auto-seed 3 interface rows when LIS is enabled and none exist
 useEffect(() => {
 if (!formData.lisIncludes) return;
 if (interfaces.length > 0) return;
 setInterfaces(ensureDefaultInterfaces());
 }, [formData.lisIncludes, interfaces.length]);

 // ONE-TIME HYDRATION: Reset form with complete sectionData
 useEffect(() => {
 // GUARD: Only hydrate once, when sectionData is available and different
 if (!sectionData || hydratedRef.current) return;

 console.log('LISSection: Hydrating with sectionData:', sectionData);
 setFormData(sectionData);
 hydratedRef.current = true; // Mark as hydrated - never reset again
 }, [sectionData]);

 const handleChange = (field, value) => {
 setFormData((prev) => ({ ...prev, [field]: value }));
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
 includes_lis: formData.lisIncludes,
 lis_provider: formData.lisProvider || null,
 includes_hardware: formData.lisIncludesHardware,
 monthly_patients: formData.lisMonthlyPatients ? parseInt(formData.lisMonthlyPatients) : null,
 current_system_name: formData.currentSystemInterface ? (formData.currentSystemName || null) : null,
 current_system_provider: formData.currentSystemInterface ? (formData.currentSystemProvider || null) : null,
 current_system_hardware: formData.currentSystemInterface ? Boolean(formData.currentSystemHardware) : false,
 interfaces: interfaces
 .filter((i) => i.model || i.provider)
 .map((i) => ({
 model: i.model || null,
 provider: i.provider || null,
 })),
 };

 await api.post(`/business-case/${bcId}/lis-integration`, payload);
 showToast("Integracion LIS guardada", "success");
 if (onSave) onSave();
 } catch (err) {
 console.error("Error saving LIS data:", err);
 showToast("Error guardando integracion LIS", "error");
 } finally {
 setSaving(false);
 }
 };

 const canEdit = permissions.canEdit !== false && ownership.canUserEdit !== false;

 return (
 <div className="space-y-5">
 {/* Section Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div className="flex items-center gap-4">
 
 <div>
 <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Integración LIS</h2>
 <p className="text-sm text-gray-500 mt-1">Sistema de información de laboratorio e interfaces</p>
 </div>
 </div>
 {canEdit && (
 <button
 onClick={handleSave}
 disabled={saving}
 className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.99] shadow-sm transition-all disabled:opacity-50 w-full sm:w-auto"
 >
 <FiSave size={18} />
 {saving ? "Guardando..." : "Guardar"}
 </button>
 )}
 </div>

 {/* LIS Toggle */}
 <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div>
 <h3 className="text-lg font-semibold text-gray-900">¿Incluye LIS?</h3>
 <p className="text-sm text-gray-500 mt-1">
 Active esta opción si el contrato incluye un Sistema de Información de Laboratorio
 </p>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={formData.lisIncludes}
 onChange={(e) => handleChange("lisIncludes", e.target.checked)}
 disabled={!canEdit}
 className="sr-only peer"
 />
 <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
 </label>
 </div>
 </div>

 {/* LIS Configuration */}
 {formData.lisIncludes && (
 <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 animate-fadeIn">
 <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
 <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
 <FiLink size={20} />
 </div>
 <h3 className="text-lg font-semibold text-gray-900">Configuración del LIS</h3>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
 {/* Provider */}
 <div className="space-y-2">
 <label className="text-sm font-medium text-gray-700 ml-1">
 Proveedor del sistema a trabajar
 </label>
 <input
 type="text"
 value={formData.lisProvider}
 onChange={(e) => handleChange("lisProvider", e.target.value)}
 disabled={!canEdit}
 className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500"
 placeholder="Ej: Cerner, Epic, LabWare..."
 />
 </div>

 {/* Monthly Patients */}
 <div className="space-y-2">
 <label className="text-sm font-medium text-gray-700 ml-1">
 Número de pacientes mensual
 </label>
 <input
 type="number"
 min="0"
 value={formData.lisMonthlyPatients}
 onChange={(e) => handleChange("lisMonthlyPatients", e.target.value)}
 disabled={!canEdit}
 className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500"
 placeholder="Ej: 5000"
 />
 </div>

 {/* Hardware Included */}
 <div className="space-y-2">
 <label className="text-sm font-medium text-gray-700 ml-1">
 ¿Incluye hardware?
 </label>
 <div className="relative">
 <select
 value={formData.lisIncludesHardware ? "yes" : "no"}
 onChange={(e) => handleChange("lisIncludesHardware", e.target.value === "yes")}
 disabled={!canEdit}
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

 <div className="space-y-2">
 <label className="text-sm font-medium text-gray-700 ml-1">
 Interfaz a sistema actual
 </label>
 <div className="relative">
 <select
 value={formData.currentSystemInterface ? "yes" : "no"}
 onChange={(e) => handleChange("currentSystemInterface", e.target.value === "yes")}
 disabled={!canEdit}
 className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500 bg-white"
 >
 <option value="no">No</option>
 <option value="yes">S?</option>
 </select>
 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
 </div>
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-gray-700 ml-1">
 Nombre del sistema
 </label>
 <input
 type="text"
 value={formData.currentSystemName}
 onChange={(e) => handleChange("currentSystemName", e.target.value)}
 disabled={!canEdit || !formData.currentSystemInterface}
 className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500"
 placeholder="Ej: HIS del hospital..."
 />
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-gray-700 ml-1">
 Proveedor
 </label>
 <input
 type="text"
 value={formData.currentSystemProvider}
 onChange={(e) => handleChange("currentSystemProvider", e.target.value)}
 disabled={!canEdit || !formData.currentSystemInterface}
 className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500"
 placeholder="Ej: HL7 Solutions..."
 />
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-gray-700 ml-1">
 ¿Incluye hardware?
 </label>
 <div className="relative">
 <select
 value={formData.currentSystemHardware ? "yes" : "no"}
 onChange={(e) => handleChange("currentSystemHardware", e.target.value === "yes")}
 disabled={!canEdit || !formData.currentSystemInterface}
 className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:text-gray-500 bg-white"
 >
 <option value="no">No</option>
 <option value="yes">S?</option>
 </select>
 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Equipment Interfaces */}
 {formData.lisIncludes && (
 <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 animate-fadeIn">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4 mb-5">
 <h3 className="text-lg font-semibold text-gray-900">Interfaces de equipos</h3>
 {canEdit && (
 <button
 onClick={handleAddInterface}
 className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-green-50 text-green-700 font-semibold rounded-xl hover:bg-green-100 active:scale-[0.99] transition-all w-full sm:w-auto"
 >
 <FiPlus size={16} />
 Agregar interfaz
 </button>
 )}
 </div>

 {interfaces.length === 0 ? (
 <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
 <p className="text-gray-500 font-medium">No hay interfaces de equipos configuradas</p>
 {canEdit && (
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
 disabled={!canEdit}
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
 disabled={!canEdit}
 className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
 placeholder="Proveedor del equipo"
 />
 </div>
 </div>
 {canEdit && (
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
 La integración LIS afecta los costos de inversión y la complejidad del proyecto.
 Configure correctamente las interfaces para una estimación precisa.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
};

export default LISSection;
