import React, { useEffect, useState, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { FiActivity, FiSave } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import Card from "../../../../../core/ui/components/Card";
import { useAutoEditSection } from "../BusinessCaseWorkspaceContext";
import SectionEditorBadge from "../SectionEditorBadge";

// Mismos roles que ya autoriza el backend en POST /sections/:section/unlock.
const LAB_REOPEN_ROLES = new Set(["acp_comercial", "backoffice", "backoffice_comercial", "jefe_comercial", "jefe_de_comercial"]);

// EMPTY SCHEMA - Initialize with no default values
const EMPTY_SCHEMA = {
 workDaysPerWeek: "",
 shiftsPerDay: "",
 hoursPerShift: "",
 qcPerShift: "",
 controlLevels: "",
 routineQCFrequency: "",
 specialTests: "",
 specialTestQCFrequency: "",
};

/**
 * LabSection - Workspace section for laboratory environment configuration
 */
const LabSection = ({ businessCase, uiGuidance, permissions = {}, ownership = {}, onSave }) => {
 const { id: bcId } = useParams();
 const { showToast } = useUI();
 const [saving, setSaving] = useState(false);
 const [isEditing, setIsEditing] = useState(false);
 useAutoEditSection("lab", () => setIsEditing(true));

 // ONE-TIME HYDRATION GUARD
 const hydratedRef = useRef(false);

 // COMPLETE SECTION DATA - All fields from workspaceData (uiGuidance), not businessCase
 const sectionData = useMemo(() => {
 const labData = uiGuidance?.workspaceData?.lab_environment;
 if (!labData) return EMPTY_SCHEMA;

 return {
 workDaysPerWeek: labData.work_days_per_week || "",
 shiftsPerDay: labData.shifts_per_day || "",
 hoursPerShift: labData.hours_per_shift || "",
 qcPerShift: labData.quality_controls_per_shift || "",
 controlLevels: labData.control_levels || "",
 routineQCFrequency: labData.routine_qc_frequency || "",
 specialTests: labData.special_tests || "",
 specialTestQCFrequency: labData.special_qc_frequency || "",
 };
 }, [uiGuidance]);

 // INITIALIZE FORM WITH EMPTY SCHEMA ONLY
 const {
 register,
 handleSubmit,
 reset,
 } = useForm({
 defaultValues: EMPTY_SCHEMA,
 });

 // ONE-TIME HYDRATION: Reset form with complete sectionData
 useEffect(() => {
 // GUARD: Only hydrate once, when sectionData is available
 if (!sectionData || hydratedRef.current) return;

 console.log('LabSection: Hydrating with sectionData:', sectionData);
 reset(sectionData);
 hydratedRef.current = true; // Mark as hydrated - never reset again
 }, [sectionData, reset]);

 const handleSave = async (data) => {
 if (!bcId) {
 showToast("Error: No se encontr? el Business Case ID", "error");
 return;
 }

 try {
 setSaving(true);
 const payload = {
 work_days_per_week: data.workDaysPerWeek ? parseInt(data.workDaysPerWeek) : null,
 shifts_per_day: data.shiftsPerDay ? parseInt(data.shiftsPerDay) : null,
 hours_per_shift: data.hoursPerShift ? parseFloat(data.hoursPerShift) : null,
 quality_controls_per_shift: data.qcPerShift ? parseFloat(data.qcPerShift) : null,
 control_levels: data.controlLevels ? parseInt(data.controlLevels) : null,
 routine_qc_frequency: data.routineQCFrequency || null,
 special_tests: data.specialTests || null,
 special_qc_frequency: data.specialTestQCFrequency || null,
 };

 await api.post(`/business-case/${bcId}/lab-environment`, payload);
 showToast("Datos de laboratorio guardados", "success");
 setIsEditing(false);
 if (onSave) onSave();
 } catch (err) {
 console.error("Error saving lab data:", err);
 showToast("Error guardando datos de laboratorio", "error");
 } finally {
 setSaving(false);
 }
 };

 const canEdit = permissions.canEdit !== false && ownership.canUserEdit !== false;

 // Reabrir "lab" tras el auto-bloqueo al guardar comercial (ver
 // saveLabEnvironment en businessCase.controller.js).
 const canReopenLab = ownership?.isLocked === true && LAB_REOPEN_ROLES.has(permissions?.userRole || "");
 const handleReopenLab = async () => {
 if (!bcId || saving) return;
 setSaving(true);
 try {
  await api.post(`/business-case/${bcId}/sections/lab/unlock`);
  if (onSave) onSave();
  showToast("Sección reabierta para edición.", "success");
 } catch (err) {
  showToast("No se pudo reabrir la sección.", "error");
 } finally {
  setSaving(false);
 }
 };

 const inputClasses = "w-full border rounded-xl px-4 py-2.5 transition-all outline-none bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-gray-900 placeholder-gray-400 disabled:bg-gray-100 disabled:text-gray-500";

 return (
 <div className="space-y-5">
 {/* Section Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div className="flex items-center gap-4">
 
 <div>
 <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Entorno Laboratorio</h2>
 <p className="text-sm text-gray-500 mt-1">Configuración operativa y parámetros del laboratorio</p>
 <div className="mt-2">
 <SectionEditorBadge ownership={ownership} />
 </div>
 </div>
 </div>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit(handleSave)} className="space-y-5">
 <Card className="p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 bg-white">
 <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
 <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
 <FiActivity size={20} />
 </div>
 <h3 className="text-lg font-bold text-gray-900 tracking-tight">Datos Operativos del Laboratorio</h3>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
 {/* Work Days */}
 <div className="space-y-1.5">
 <label className="text-sm font-bold text-gray-700">
 Días de trabajo por semana
 </label>
 <input
 type="number"
 min="1"
 max="7"
 {...register("workDaysPerWeek")}
 disabled={!isEditing}
 className={inputClasses}
 placeholder="Ej: 5"
 />
 </div>

 {/* Shifts per Day */}
 <div className="space-y-1.5">
 <label className="text-sm font-bold text-gray-700">
 Turnos por día
 </label>
 <input
 type="number"
 min="1"
 max="3"
 {...register("shiftsPerDay")}
 disabled={!isEditing}
 className={inputClasses}
 placeholder="Ej: 2"
 />
 </div>

 {/* Hours per Shift */}
 <div className="space-y-1.5">
 <label className="text-sm font-bold text-gray-700">
 Horas por turno
 </label>
 <input
 type="number"
 min="1"
 max="24"
 step="0.5"
 {...register("hoursPerShift")}
 disabled={!isEditing}
 className={inputClasses}
 placeholder="Ej: 8"
 />
 </div>

 {/* QC per Shift */}
 <div className="space-y-1.5">
 <label className="text-sm font-bold text-gray-700">
 Controles de calidad por turno
 </label>
 <input
 type="number"
 min="0"
 step="0.1"
 {...register("qcPerShift")}
 disabled={!isEditing}
 className={inputClasses}
 placeholder="Ej: 3.5"
 />
 </div>

 {/* Control Levels */}
 <div className="space-y-1.5">
 <label className="text-sm font-bold text-gray-700">
 Niveles de control
 </label>
 <input
 type="number"
 min="1"
 {...register("controlLevels")}
 disabled={!isEditing}
 className={inputClasses}
 placeholder="Ej: 2"
 />
 </div>

 {/* Routine QC Frequency */}
 <div className="space-y-1.5">
 <label className="text-sm font-bold text-gray-700">
 Frecuencia QC (Rutina)
 </label>
 <input
 type="text"
 {...register("routineQCFrequency")}
 disabled={!isEditing}
 className={inputClasses}
 placeholder="Ej: Diario, Por turno..."
 />
 </div>

 {/* Special Tests */}
 <div className="space-y-1.5 md:col-span-2">
 <label className="text-sm font-bold text-gray-700">
 Pruebas Especiales
 </label>
 <textarea
 {...register("specialTests")}
 disabled={!isEditing}
 rows={2}
 className={inputClasses}
 placeholder="Describa las pruebas especiales requeridas..."
 />
 </div>

 {/* Special QC Frequency */}
 <div className="space-y-1.5">
 <label className="text-sm font-bold text-gray-700">
 Frecuencia QC (Especiales)
 </label>
 <input
 type="text"
 {...register("specialTestQCFrequency")}
 disabled={!isEditing}
 className={inputClasses}
 placeholder="Ej: Semanal, Por lote..."
 />
 </div>
 </div>
 </Card>

 {/* Info Card */}
 <Card className="p-4 bg-blue-50 border border-blue-100 rounded-2xl shadow-sm">
 <div className="flex items-start gap-3">
 <div className="text-blue-600 mt-0.5 text-lg">Info</div>
 <div>
 <h4 className="font-bold text-blue-900 text-sm">Información Importante</h4>
 <p className="text-sm text-blue-800 mt-1 leading-relaxed">
 Los datos del laboratorio se usan para calcular el consumo de reactivos y
 la utilización del equipo. Asegúrese de ingresar valores precisos para
 obtener proyecciones exactas.
 </p>
 </div>
 </div>
 </Card>

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
  onClick={() => { reset(sectionData); setIsEditing(false); }}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all w-full sm:w-auto"
  >
  Cancelar
  </button>
  <button
  type="submit"
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
 {canReopenLab && (
 <button
  type="button"
  onClick={handleReopenLab}
  disabled={saving}
  className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 w-full sm:w-auto"
 >
  Reabrir para edición
 </button>
 )}
 </div>
 )}
 </form>
 </div>
 );
};

export default LabSection;
