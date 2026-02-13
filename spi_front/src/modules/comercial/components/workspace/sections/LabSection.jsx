import React, { useEffect, useState, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { FiActivity, FiSave } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import Card from "../../../../../core/ui/components/Card";

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
        watch,
        formState: { errors },
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
                quality_controls_per_shift: data.qcPerShift ? parseInt(data.qcPerShift) : null,
                control_levels: data.controlLevels ? parseInt(data.controlLevels) : null,
                routine_qc_frequency: data.routineQCFrequency || null,
                special_tests: data.specialTests || null,
                special_qc_frequency: data.specialTestQCFrequency || null,
            };

            await api.post(`/business-case/${bcId}/lab-environment`, payload);
            showToast("Datos de laboratorio guardados", "success");
            if (onSave) onSave();
        } catch (err) {
            console.error("Error saving lab data:", err);
            showToast("Error guardando datos de laboratorio", "error");
        } finally {
            setSaving(false);
        }
    };

    const canEdit = permissions.canEdit !== false && ownership.canUserEdit !== false;

    const inputClasses = "w-full border rounded-xl px-4 py-2.5 transition-all outline-none bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-gray-900 placeholder-gray-400 disabled:bg-gray-100 disabled:text-gray-500";

    return (
        <div className="space-y-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-4">
                    
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Entorno Laboratorio</h2>
                        <p className="text-sm text-gray-500 mt-1">Configuración operativa y parámetros del laboratorio</p>
                    </div>
                </div>
                {canEdit && (
                    <button
                        type="submit"
                        disabled={saving}
                        onClick={handleSubmit(handleSave)}
                        className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 active:scale-95 shadow-sm hover:shadow-blue-200 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none w-full sm:w-auto"
                    >
                        <FiSave size={18} />
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
                <Card className="p-6 rounded-2xl shadow-sm border border-gray-100 bg-white">
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <FiActivity size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 tracking-tight">Datos Operativos del Laboratorio</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                disabled={!canEdit}
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
                                disabled={!canEdit}
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
                                disabled={!canEdit}
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
                                {...register("qcPerShift")}
                                disabled={!canEdit}
                                className={inputClasses}
                                placeholder="Ej: 3"
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
                                disabled={!canEdit}
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
                                disabled={!canEdit}
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
                                disabled={!canEdit}
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
                                disabled={!canEdit}
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
                        <p className="text-xs text-gray-400 font-medium">Los cambios se guardan automáticamente al enviar el formulario.</p>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 active:scale-95 shadow-sm hover:shadow-blue-200 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none w-full sm:w-auto"
                        >
                            <FiSave size={18} />
                            {saving ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default LabSection;
