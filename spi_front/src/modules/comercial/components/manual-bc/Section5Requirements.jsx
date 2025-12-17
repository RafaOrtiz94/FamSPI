import React from 'react';
import { FiClock, FiCalendar } from 'react-icons/fi';

const Section5Requirements = ({ data, updateData }) => {
    const reqData = data.requirements;

    const handleChange = (field, value) => {
        updateData('requirements', { [field]: value });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <FiClock className="text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Requerimientos del BC</h3>
                <p className="text-sm text-gray-500 ml-auto">Plazos y proyecciones</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <FiCalendar /> Plazo (meses) *
                    </span>
                    <input
                        type="number"
                        min="1"
                        value={reqData.deadline_months}
                        onChange={(e) => handleChange('deadline_months', parseInt(e.target.value))}
                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="12"
                    />
                    <p className="text-xs text-gray-500">Plazo comprometido para el Business Case</p>
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <FiCalendar /> ProyecciÃ³n de Plazo (meses) *
                    </span>
                    <input
                        type="number"
                        min="1"
                        value={reqData.projected_deadline_months}
                        onChange={(e) => handleChange('projected_deadline_months', parseInt(e.target.value))}
                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="12"
                    />
                    <p className="text-xs text-gray-500">ProyecciÃ³n estimada del plazo real</p>
                </label>
            </div>

            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-900">
                    <strong>Nota:</strong> El plazo se refiere al tiempo estimado para la implementaciÃ³n completa del Business Case,
                    desde la aprobaciÃ³n hasta la puesta en marcha del equipo.
                </p>
            </div>
        </div>
    );
};

export default Section5Requirements;

