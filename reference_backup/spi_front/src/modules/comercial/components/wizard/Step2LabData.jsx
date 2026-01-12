import React, { useEffect, useState } from "react";
import { FiActivity } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";

const Step2LabData = ({ onPrev, onNext }) => {
    const { state, updateState } = useBusinessCaseWizard();
    const { showToast, showLoader, hideLoader } = useUI();
    const [formData, setFormData] = useState(state.generalData || {});

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        updateState({ generalData: formData });
    }, [formData, updateState]);

    const handleNext = async () => {
        if (!state.businessCaseId) {
            showToast("Error: No se encontró el Business Case ID", "error");
            return;
        }

        try {
            showLoader();
            // Transform to snake_case for backend
            const payload = {
                work_days_per_week: formData.labWorkDaysPerWeek,
                shifts_per_day: formData.labShiftsPerDay,
                control_levels: formData.labControlLevels,
                routine_qc_frequency: formData.labRoutineQCFrequency,
                quality_controls_per_shift: formData.labQcPerShift,
                special_tests: formData.labSpecialTests,
                special_qc_frequency: formData.labSpecialTestQCFrequency
            };

            await api.post(`/business-case/${state.businessCaseId}/lab-environment`, payload);
            showToast("Datos de laboratorio guardados", "success");
            onNext();
        } catch (err) {
            showToast("Error guardando datos", "error");
        } finally {
            hideLoader();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
                <FiActivity className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-800">Datos del Laboratorio</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Días de trabajo por semana</span>
                    <input
                        type="number"
                        min="1"
                        max="7"
                        value={formData.labWorkDaysPerWeek || ""}
                        onChange={(e) => handleChange("labWorkDaysPerWeek", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Turnos por día</span>
                    <input
                        type="number"
                        min="1"
                        max="3"
                        value={formData.labShiftsPerDay || ""}
                        onChange={(e) => handleChange("labShiftsPerDay", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Controles de calidad por turno</span>
                    <input
                        type="number"
                        value={formData.labQcPerShift || ""}
                        onChange={(e) => handleChange("labQcPerShift", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Niveles de control</span>
                    <input
                        type="number"
                        value={formData.labControlLevels || ""}
                        onChange={(e) => handleChange("labControlLevels", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Frecuencia QC (Rutina)</span>
                    <input
                        type="text"
                        value={formData.labRoutineQCFrequency || ""}
                        onChange={(e) => handleChange("labRoutineQCFrequency", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Ej: Diario, Por turno..."
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Pruebas Especiales</span>
                    <input
                        type="text"
                        value={formData.labSpecialTests || ""}
                        onChange={(e) => handleChange("labSpecialTests", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Describa las pruebas..."
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Frecuencia QC (Especiales)</span>
                    <input
                        type="text"
                        value={formData.labSpecialTestQCFrequency || ""}
                        onChange={(e) => handleChange("labSpecialTestQCFrequency", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Ej: Semanal, Por lote..."
                    />
                </label>
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={onPrev}
                    className="px-6 py-2 rounded-lg border hover:bg-gray-50 text-gray-700"
                >
                    Regresar
                </button>
                <button
                    onClick={handleNext}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                    Guardar y Continuar
                </button>
            </div>
        </div>
    );
};

export default Step2LabData;
