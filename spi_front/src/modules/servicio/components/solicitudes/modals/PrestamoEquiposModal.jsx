import React, { useState } from "react";
import { FiX, FiSettings } from "react-icons/fi";
import { useUI } from "../../../../../core/ui/UIContext";
import Button from "../../../../../core/ui/components/Button";
import EquipmentSelect from "../../../../../core/ui/components/EquipmentSelect";

const PrestamoEquiposModal = ({ open, onClose, onSuccess }) => {
    const { showToast } = useUI();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        cliente: "",
        equipo_id: "",
        fecha_inicio: "",
        fecha_fin: "",
        motivo: ""
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            showToast("Solicitud de préstamo creada exitosamente", "success");
            onSuccess?.();
            onClose();
            setFormData({
                cliente: "",
                equipo_id: "",
                fecha_inicio: "",
                fecha_fin: "",
                motivo: ""
            });
        } catch (error) {
            showToast("Error al crear la solicitud de préstamo", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4">
                <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <FiSettings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-bold">Préstamo de Equipos</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Cliente</label>
                        <input
                            type="text"
                            name="cliente"
                            value={formData.cliente}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                            placeholder="Nombre del cliente"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Equipo</label>
                        <EquipmentSelect
                            name="equipo_id"
                            value={formData.equipo_id}
                            onChange={handleChange}
                            required
                            placeholder="Selecciona el equipo a prestar"
                            filter={{ estado: "disponible" }}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Fecha Inicio</label>
                            <input
                                type="date"
                                name="fecha_inicio"
                                value={formData.fecha_inicio}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Fecha Devolución</label>
                            <input
                                type="date"
                                name="fecha_fin"
                                value={formData.fecha_fin}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Motivo del Préstamo</label>
                        <textarea
                            name="motivo"
                            value={formData.motivo}
                            onChange={handleChange}
                            required
                            rows={3}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                            placeholder="¿Por qué necesita el equipo?"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" disabled={loading}>
                            {loading ? "Creando..." : "Solicitar Préstamo"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PrestamoEquiposModal;
