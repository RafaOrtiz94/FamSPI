import React, { useState, useEffect } from 'react';
import { FiCpu, FiImage, FiMapPin } from 'react-icons/fi';
import api from '../../../../core/api';

const Section3Equipment = ({ data, updateData }) => {
    const [equipment, setEquipment] = useState([]);
    const [loadingEquipment, setLoadingEquipment] = useState(false);
    const equipData = data.equipmentDetails;

    useEffect(() => {
        const fetchEquipment = async () => {
            setLoadingEquipment(true);
            try {
                const res = await api.get('/equipment-catalog');
                const payload = res.data?.data ?? res.data;
                const parsedEquipment = Array.isArray(payload?.items)
                    ? payload.items
                    : Array.isArray(payload)
                        ? payload
                        : [];
                setEquipment(parsedEquipment);
            } catch (err) {
                console.warn('No se pudo cargar el catálogo', err.message);
            } finally {
                setLoadingEquipment(false);
            }
        };
        fetchEquipment();
    }, []);

    const handleChange = (field, value) => {
        updateData('equipmentDetails', { [field]: value });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <FiCpu className="text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Equipamiento</h3>
            </div>

            {/* Equipo Principal */}
            <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Equipo Principal</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-700">Seleccionar Equipo *</span>
                        <select
                            value={equipData.equipmentId || ''}
                            onChange={(e) => handleChange('equipmentId', parseInt(e.target.value))}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecciona...</option>
                            {equipment.map((eq) => (
                                <option key={eq.id} value={eq.id}>
                                    {eq.name || eq.equipment_name}
                                </option>
                            ))}
                        </select>
                        {loadingEquipment && <p className="text-xs text-gray-400">Cargando...</p>}
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-700">Estado del Equipo</span>
                        <select
                            value={equipData.equipment_status}
                            onChange={(e) => handleChange('equipment_status', e.target.value)}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="new">Nuevo</option>
                            <option value="cu">CU (Usado)</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-700">Estado de Propiedad</span>
                        <select
                            value={equipData.ownership_status}
                            onChange={(e) => handleChange('ownership_status', e.target.value)}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="owned">Propio</option>
                            <option value="rented">Alquilado</option>
                            <option value="new">Nuevo</option>
                            <option value="reserved">Reservado</option>
                            <option value="fam_series">Serie (FAM)</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <FiImage /> Imagen de Reserva (URL)
                        </span>
                        <input
                            type="text"
                            value={equipData.reservation_image_url}
                            onChange={(e) => handleChange('reservation_image_url', e.target.value)}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            placeholder="https://..."
                        />
                    </label>
                </div>
            </div>

            {/* Equipo Backup */}
            <div className="p-4 rounded-lg bg-purple-50 border border-purple-200 space-y-4">
                <h4 className="font-semibold text-purple-900">Equipo Backup</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-purple-900">Nombre del Equipo Backup</span>
                        <input
                            type="text"
                            value={equipData.backup_equipment_name}
                            onChange={(e) => handleChange('backup_equipment_name', e.target.value)}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                            placeholder="Nombre del equipo"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-purple-900">Estado</span>
                        <input
                            type="text"
                            value={equipData.backup_status}
                            onChange={(e) => handleChange('backup_status', e.target.value)}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                            placeholder="Nuevo / Usado"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-purple-900">Año de Fabricación</span>
                        <input
                            type="number"
                            min="1900"
                            max="2100"
                            value={equipData.backup_manufacture_year || ''}
                            onChange={(e) => handleChange('backup_manufacture_year', parseInt(e.target.value))}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                            placeholder="2024"
                        />
                    </label>

                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={equipData.install_with_primary}
                            onChange={(e) => handleChange('install_with_primary', e.target.checked)}
                            className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm font-medium text-purple-900">Instalar a la par del principal</span>
                    </label>
                </div>
            </div>

            {/* Ubicación y Opciones */}
            <div className="space-y-4">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <FiMapPin /> Ubicación de Instalación
                    </span>
                    <textarea
                        rows={2}
                        value={equipData.installation_location}
                        onChange={(e) => handleChange('installation_location', e.target.value)}
                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="Dirección o ubicación específica..."
                    />
                </label>

                <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={equipData.allows_provisional}
                            onChange={(e) => handleChange('allows_provisional', e.target.checked)}
                            className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-700">Permite equipo provisional</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={equipData.requires_complementary}
                            onChange={(e) => handleChange('requires_complementary', e.target.checked)}
                            className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-700">Requiere equipo complementario</span>
                    </label>
                </div>

                {equipData.requires_complementary && (
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-700">¿Para qué prueba?</span>
                        <input
                            type="text"
                            value={equipData.complementary_test_purpose}
                            onChange={(e) => handleChange('complementary_test_purpose', e.target.value)}
                            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            placeholder="Especifique la prueba..."
                        />
                    </label>
                )}
            </div>
        </div>
    );
};

export default Section3Equipment;
