import React, { useState } from "react";
import { FiX, FiClipboard } from "react-icons/fi";
import { useUI } from "../../../../../core/ui/UIContext";
import Button from "../../../../../core/ui/components/Button";
import EquipmentSelect from "../../../../../core/ui/components/EquipmentSelect";

const InspeccionModal = ({ open, onClose, onSuccess }) => {
    const { showToast } = useUI();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        cliente: "",
        equipo_id: "",
        ubicacion: "",
        tipo: "preventiva",
        fecha_programada: "",
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
            showToast("Inspección técnica programada exitosamente", "success");
            onSuccess?.();
            onClose();
            setFormData({
                cliente: "",
                equipo_id: "",
                ubicacion: "",
                tipo: "preventiva",
                fecha_programada: "",
                observaciones: ""
            });
        } catch (error) {
            showToast("Error al programar la inspección", "error");
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
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <FiClipboard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-xl font-bold">Programar Inspección Técnica</h2>
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
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                            placeholder="Nombre del cliente"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Equipo</label>
                            <EquipmentSelect
                                name="equipo_id"
                                value={formData.equipo_id}
                                onChange={handleChange}
                                placeholder="Selecciona el equipo a inspeccionar"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Ubicación</label>
                            <input
                                type="text"
                                name="ubicacion"
                                value={formData.ubicacion}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                                placeholder="Dirección o ubicación"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Tipo de Inspección</label>
                            <select
                                name="tipo"
                                value={formData.tipo}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                            >
                                <option value="preventiva">Preventiva</option>
                                <option value="correctiva">Correctiva</option>
                                <option value="diagnostico">Diagnóstico</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Fecha Programada</label>
                            <input
                                type="date"
                                name="fecha_programada"
                                value={formData.fecha_programada}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Observaciones</label>
                        <textarea
                            name="observaciones"
                            value={formData.observaciones}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                            placeholder="Detalles adicionales..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" disabled={loading}>
                            {loading ? "Programando..." : "Programar"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InspeccionModal;
