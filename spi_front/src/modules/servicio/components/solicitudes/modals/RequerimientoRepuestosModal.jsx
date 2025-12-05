import React, { useState } from "react";
import { FiX, FiPackage } from "react-icons/fi";
import { useUI } from "../../../../../core/ui/UIContext";
import Button from "../../../../../core/ui/components/Button";
import EquipmentSelect from "../../../../../core/ui/components/EquipmentSelect";

/**
 * Modal para requerimiento de repuestos
 */
const RequerimientoRepuestosModal = ({ open, onClose, onSuccess }) => {
    const { showToast } = useUI();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        equipo_id: "",
        repuesto: "",
        cantidad: 1,
        urgencia: "normal",
        observaciones: ""
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // TODO: Implementar llamada al API
            showToast("Requerimiento de repuestos creado exitosamente", "success");
            onSuccess?.();
            onClose();
            setFormData({
                equipo_id: "",
                repuesto: "",
                cantidad: 1,
                urgencia: "normal",
                observaciones: ""
            });
        } catch (error) {
            console.error("Error creating requerimiento:", error);
            showToast("Error al crear el requerimiento", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <FiPackage className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            Requerimiento de Repuestos
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Equipo/Cliente
                        </label>
                        <EquipmentSelect
                            name="equipo_id"
                            value={formData.equipo_id}
                            onChange={handleChange}
                            required
                            placeholder="Selecciona el equipo"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Repuesto/Componente
                        </label>
                        <input
                            type="text"
                            name="repuesto"
                            value={formData.repuesto}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Nombre del repuesto"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Cantidad
                            </label>
                            <input
                                type="number"
                                name="cantidad"
                                value={formData.cantidad}
                                onChange={handleChange}
                                min="1"
                                required
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Urgencia
                            </label>
                            <select
                                name="urgencia"
                                value={formData.urgencia}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="normal">Normal</option>
                                <option value="urgente">Urgente</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Observaciones
                        </label>
                        <textarea
                            name="observaciones"
                            value={formData.observaciones}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Especificaciones adicionales..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" disabled={loading}>
                            {loading ? "Creando..." : "Crear Requerimiento"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RequerimientoRepuestosModal;
