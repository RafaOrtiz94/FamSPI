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
 * Adapted from Step2LabData.jsx wizard component
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
            showToast("Error: No se encontró el Business Case ID", "error");
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

    return (
        <div className="space-y-6">
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-3xl">🏥</div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Entorno Laboratorio</h2>
                        <p className="text-sm text-gray-600">Configuración operativa y parámetros del laboratorio</p>
                    </div>
                </div>
                {canEdit && (
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        <FiSave size={16} />
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
                <Card className="p-6">
                    <div className="flex items-center gap-2 border-b pb-4 mb-6">
                        <FiActivity className="text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-800">Datos Operativos del Laboratorio</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Work Days */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Días de trabajo por semana
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="7"
                                {...register("workDaysPerWeek")}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: 5"
                            />
                        </div>

                        {/* Shifts per Day */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Turnos por día
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="3"
                                {...register("shiftsPerDay")}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: 2"
                            />
                        </div>

                        {/* Hours per Shift */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Horas por turno
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="24"
                                step="0.5"
                                {...register("hoursPerShift")}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: 8"
                            />
                        </div>

                        {/* QC per Shift */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Controles de calidad por turno
                            </label>
                            <input
                                type="number"
                                min="0"
                                {...register("qcPerShift")}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: 3"
                            />
                        </div>

                        {/* Control Levels */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Niveles de control
                            </label>
                            <input
                                type="number"
                                min="1"
                                {...register("controlLevels")}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: 2"
                            />
                        </div>

                        {/* Routine QC Frequency */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Frecuencia QC (Rutina)
                            </label>
                            <input
                                type="text"
                                {...register("routineQCFrequency")}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: Diario, Por turno..."
                            />
                        </div>

                        {/* Special Tests */}
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-700">
                                Pruebas Especiales
                            </label>
                            <textarea
                                {...register("specialTests")}
                                disabled={!canEdit}
                                rows={2}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Describa las pruebas especiales requeridas..."
                            />
                        </div>

                        {/* Special QC Frequency */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Frecuencia QC (Especiales)
                            </label>
                            <input
                                type="text"
                                {...register("specialTestQCFrequency")}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: Semanal, Por lote..."
                            />
                        </div>
                    </div>
                </Card>

                {/* Info Card */}
                <Card className="p-4 bg-blue-50 border-blue-200">
                    <div className="flex items-start gap-3">
                        <div className="text-blue-600 mt-0.5">ℹ️</div>
                        <div>
                            <h4 className="font-medium text-blue-900">Información</h4>
                            <p className="text-sm text-blue-700 mt-1">
                                Los datos del laboratorio se usan para calcular el consumo de reactivos y
                                la utilización del equipo. Asegúrese de ingresar valores precisos para
                                obtener proyecciones exactas.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Section Actions */}
                {canEdit && (
                    <div className="flex justify-between items-center pt-4 border-t">
                        <p className="text-xs text-gray-500">Los cambios se guardan automáticamente al enviar el formulario.</p>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            <FiSave size={16} />
                            {saving ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default LabSection;
