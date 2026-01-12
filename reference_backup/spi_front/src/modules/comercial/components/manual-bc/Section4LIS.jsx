import React, { useState } from 'react';
import { FiServer, FiPlus, FiTrash2 } from 'react-icons/fi';

const Section4LIS = ({ data, updateData }) => {
    const lisData = data.lisIntegration;

    const handleChange = (field, value) => {
        updateData('lisIntegration', { [field]: value });
    };

    const addInterface = () => {
        const newInterfaces = [...lisData.equipmentInterfaces, { model: '', provider: '' }];
        updateData('lisIntegration', { equipmentInterfaces: newInterfaces });
    };

    const removeInterface = (index) => {
        const newInterfaces = lisData.equipmentInterfaces.filter((_, i) => i !== index);
        updateData('lisIntegration', { equipmentInterfaces: newInterfaces });
    };

    const updateInterface = (index, field, value) => {
        const newInterfaces = [...lisData.equipmentInterfaces];
        newInterfaces[index] = { ...newInterfaces[index], [field]: value };
        updateData('lisIntegration', { equipmentInterfaces: newInterfaces });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <FiServer className="text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">LIS (Sistema de InformaciÃ³n de Laboratorio)</h3>
            </div>

            {/* Incluye LIS */}
            <label className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={lisData.includes_lis}
                    onChange={(e) => handleChange('includes_lis', e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Incluye LIS</span>
            </label>

            {lisData.includes_lis && (
                <div className="space-y-6">
                    {/* ConfiguraciÃ³n LIS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-gray-700">Proveedor del Sistema</span>
                            <select
                                value={lisData.lis_provider}
                                onChange={(e) => handleChange('lis_provider', e.target.value)}
                                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="orion">Orion</option>
                                <option value="cobas_infiniti">Cobas Infiniti</option>
                                <option value="other">Otro</option>
                            </select>
                        </label>

                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={lisData.includes_hardware}
                                onChange={(e) => handleChange('includes_hardware', e.target.checked)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm font-medium text-gray-700">Incluye Hardware</span>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-gray-700">NÃºmero de Pacientes Mensual</span>
                            <input
                                type="number"
                                min="0"
                                value={lisData.monthly_patients}
                                onChange={(e) => handleChange('monthly_patients', parseInt(e.target.value))}
                                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                placeholder="0"
                            />
                        </label>
                    </div>

                    {/* Sistema Actual */}
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-4">
                        <h4 className="font-semibold text-amber-900">Interfaz de Sistema Actual</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-amber-900">Nombre del Sistema</span>
                                <input
                                    type="text"
                                    value={lisData.current_system_name}
                                    onChange={(e) => handleChange('current_system_name', e.target.value)}
                                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500"
                                    placeholder="Nombre del sistema actual"
                                />
                            </label>

                            <label className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-amber-900">Proveedor</span>
                                <input
                                    type="text"
                                    value={lisData.current_system_provider}
                                    onChange={(e) => handleChange('current_system_provider', e.target.value)}
                                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500"
                                    placeholder="Proveedor del sistema"
                                />
                            </label>

                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={lisData.current_system_hardware}
                                    onChange={(e) => handleChange('current_system_hardware', e.target.checked)}
                                    className="w-4 h-4 text-amber-600"
                                />
                                <span className="text-sm font-medium text-amber-900">Incluye Hardware</span>
                            </label>
                        </div>
                    </div>

                    {/* Interfaces de Equipos */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-gray-900">Interfaz de Equipos</h4>
                            <button
                                type="button"
                                onClick={addInterface}
                                className="inline-flex items-center gap-2 px-3 py-1 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                                <FiPlus /> Agregar Interfaz
                            </button>
                        </div>

                        {lisData.equipmentInterfaces.map((iface, index) => (
                            <div key={index} className="flex gap-2 items-start">
                                <input
                                    type="text"
                                    value={iface.model}
                                    onChange={(e) => updateInterface(index, 'model', e.target.value)}
                                    className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                    placeholder="Modelo"
                                />
                                <input
                                    type="text"
                                    value={iface.provider}
                                    onChange={(e) => updateInterface(index, 'provider', e.target.value)}
                                    className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                    placeholder="Proveedor"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeInterface(index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                    <FiTrash2 />
                                </button>
                            </div>
                        ))}

                        {lisData.equipmentInterfaces.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">
                                No hay interfaces agregadas. Click en "Agregar Interfaz" para aÃ±adir.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Section4LIS;

