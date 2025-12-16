import React from 'react';
import { FiClock, FiActivity } from 'react-icons/fi';

const Section2LabEnvironment = ({ data, updateData }) => {
    const labData = data.labEnvironment;

    const handleChange = (field, value) => {
        updateData('labEnvironment', { [field]: value });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <FiActivity className="text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Ambiente de Laboratorio</h3>
                <p className="text-sm text-gray-500 ml-auto">InformaciÃ³n operativa del laboratorio del cliente</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* DÃ­as por semana */}
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700">DÃ­as por semana *</span>
                    <input
                        type="number"
                        min="1"
                        max="7"
                        value={labData.work_days_per_week}
                        onChange={(e) => handleChange('work_days_per_week', parseInt(e.target.value))}
                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                </label>

                {/* Turnos por dÃ­a */}
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700">Turnos por dÃ­a *</span>
                    <input
                        type="number"
                        min="1"
                        value={labData.shifts_per_day}
                        onChange={(e) => handleChange('shifts_per_day', parseInt(e.target.value))}
                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                </label>

                {/* Horas por turno */}
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700">Horas por turno *</span>
                    <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={labData.hours_per_shift}
                        onChange={(e) => handleChange('hours_per_shift', parseFloat(e.target.value))}
                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                </label>
            </div>

            {/* Control de Calidad */}
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 space-y-4">
                <h4 className="font-semibold text-green-900 flex items-center gap-2">
                    <FiClock /> Control de Calidad
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-green-900">Controles por turno</span>
                        <input
                            type="number"
                            min="0"
                            value={labData.quality_controls_per_shift}
                            onChange={(e) => handleChange('quality_controls_per_shift', parseInt(e.target.value))}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-green-900">Niveles de control</span>
                        <input
                            type="number"
                            min="0"
                            value={labData.control_levels}
                            onChange={(e) => handleChange('control_levels', parseInt(e.target.value))}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-green-900">Frecuencia (Rutina)</span>
                        <input
                            type="text"
                            value={labData.routine_qc_frequency}
                            onChange={(e) => handleChange('routine_qc_frequency', e.target.value)}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                            placeholder="Ej: Diaria, Semanal"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-green-900">Frecuencia (Especiales)</span>
                        <input
                            type="text"
                            value={labData.special_qc_frequency}
                            onChange={(e) => handleChange('special_qc_frequency', e.target.value)}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                            placeholder="Ej: Mensual"
                        />
                    </label>

                    <label className="flex flex-col gap-1 md:col-span-2">
                        <span className="text-sm font-medium text-green-900">Pruebas Especiales</span>
                        <textarea
                            rows={2}
                            value={labData.special_tests}
                            onChange={(e) => handleChange('special_tests', e.target.value)}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                            placeholder="DescripciÃ³n de pruebas especiales..."
                        />
                    </label>
                </div>
            </div>
        </div>
    );
};

export default Section2LabEnvironment;

