import React, { useState, useEffect } from "react";
import { FiX, FiCalendar, FiClock, FiAlertCircle } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../../../core/ui/components/Button";
import { Dialog } from "@headlessui/react";
import { useUI } from "../../../../core/ui/UIContext";
import api from "../../../../core/api";

/**
 * VacationRequestModal
 * Modal para solicitar vacaciones
 * - Calcula automáticamente los días
 * - Muestra días disponibles
 * - Genera documento en Google Drive
 */
const VacationRequestModal = ({ open, onClose, onSuccess }) => {
    const { showToast } = useUI();
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);

    const [formData, setFormData] = useState({
        start_date: "",
        end_date: "",
        period: new Date().getFullYear().toString(),
    });

    // Cargar resumen de vacaciones
    useEffect(() => {
        if (open) {
            loadSummary();
        }
    }, [open]);

    const loadSummary = async () => {
        try {
            setLoadingSummary(true);
            const response = await api.get("/vacaciones/summary/data?all=false");
            if (response.data?.ok) {
                setSummary(response.data.data);
            }
        } catch (error) {
            console.error("Error loading vacation summary:", error);
        } finally {
            setLoadingSummary(false);
        }
    };

    const calculateDays = () => {
        if (!formData.start_date || !formData.end_date) return 0;
        const start = new Date(formData.start_date);
        const end = new Date(formData.end_date);
        const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
        return diff >= 0 ? diff + 1 : 0;
    };

    const days = calculateDays();
    const remaining = summary?.remaining || 0;
    const canSubmit = days > 0 && days <= remaining && formData.start_date && formData.end_date;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!canSubmit) {
            showToast("Por favor completa todos los campos correctamente", "error");
            return;
        }

        if (days > remaining) {
            showToast(`Solo tienes ${remaining} días disponibles`, "error");
            return;
        }

        try {
            setLoading(true);
            const response = await api.post("/vacaciones", {
                ...formData,
                days,
            });

            if (response.data?.ok) {
                showToast("Solicitud de vacaciones creada exitosamente", "success");
                onSuccess?.();
                handleClose();
            } else {
                throw new Error(response.data?.message || "Error al crear solicitud");
            }
        } catch (error) {
            console.error("Error creating vacation request:", error);
            showToast(
                error.response?.data?.message || error.message || "Error al crear la solicitud",
                "error"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({
            start_date: "",
            end_date: "",
            period: new Date().getFullYear().toString(),
        });
        onClose?.();
    };

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <Dialog open={open} onClose={handleClose} className="fixed inset-0 z-50">
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center px-4 py-6 sm:px-6">
                            <Dialog.Panel className="w-full max-w-5xl">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl"
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-100 rounded-lg">
                                                <FiCalendar className="w-6 h-6 text-emerald-600" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                                    Solicitar Vacaciones
                                                </h2>
                                                <p className="text-sm text-gray-500">
                                                    Planifica tu descanso anual
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleClose}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                        >
                                            <FiX className="w-5 h-5 text-gray-500 dark:text-gray-200" />
                                        </button>
                                    </div>

                                    {/* Body */}
                                    <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
                                        {/* Resumen de días disponibles */}
                                        {loadingSummary ? (
                                            <div className="p-4 bg-gray-50 rounded-lg text-center">
                                                <p className="text-sm text-gray-500">Cargando información...</p>
                                            </div>
                                        ) : summary ? (
                                            <div className="grid grid-cols-4 gap-4">
                                                <div className="p-4 bg-blue-50 rounded-lg text-center">
                                                    <p className="text-xs text-blue-600 font-medium mb-1">Asignados</p>
                                                    <p className="text-2xl font-bold text-blue-700">{summary.allowance}</p>
                                                </div>
                                                <div className="p-4 bg-green-50 rounded-lg text-center">
                                                    <p className="text-xs text-green-600 font-medium mb-1">Disponibles</p>
                                                    <p className="text-2xl font-bold text-green-700">{summary.remaining}</p>
                                                </div>
                                                <div className="p-4 bg-amber-50 rounded-lg text-center">
                                                    <p className="text-xs text-amber-600 font-medium mb-1">Usados</p>
                                                    <p className="text-2xl font-bold text-amber-700">{summary.taken}</p>
                                                </div>
                                                <div className="p-4 bg-purple-50 rounded-lg text-center">
                                                    <p className="text-xs text-purple-600 font-medium mb-1">Pendientes</p>
                                                    <p className="text-2xl font-bold text-purple-700">{summary.pending}</p>
                                                </div>
                                            </div>
                                        ) : null}

                                        {/* Fechas */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Fecha de Inicio *
                                                </label>
                                                <div className="relative">
                                                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <input
                                                        type="date"
                                                        required
                                                        value={formData.start_date}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, start_date: e.target.value })
                                                        }
                                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Fecha de Fin *
                                                </label>
                                                <div className="relative">
                                                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <input
                                                        type="date"
                                                        required
                                                        value={formData.end_date}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, end_date: e.target.value })
                                                        }
                                                        min={formData.start_date}
                                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Período */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Período
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.period}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, period: e.target.value })
                                                }
                                                placeholder="2024"
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            />
                                        </div>

                                        {/* Días calculados */}
                                        {days > 0 && (
                                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                                                <FiClock className="w-5 h-5 text-emerald-600" />
                                                <div>
                                                    <p className="text-sm font-medium text-emerald-900">
                                                        Días solicitados: <span className="text-lg font-bold">{days}</span>
                                                    </p>
                                                    <p className="text-xs text-emerald-700">
                                                        Quedarían {Math.max(remaining - days, 0)} días disponibles
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Advertencia si excede días disponibles */}
                                        {days > remaining && (
                                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                                                <FiAlertCircle className="w-5 h-5 text-red-600" />
                                                <p className="text-sm text-red-700">
                                                    No tienes suficientes días disponibles. Solo tienes {remaining} días.
                                                </p>
                                            </div>
                                        )}

                                        {/* Info */}
                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <p className="text-xs text-blue-700">
                                                <strong>Nota:</strong> Al enviar esta solicitud, se generará automáticamente un documento en Google Drive con todos los detalles. Tu jefe inmediato recibirá la notificación para aprobar.
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-3 pt-4 border-t border-gray-200">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={handleClose}
                                                className="flex-1"
                                                disabled={loading}
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                type="submit"
                                                variant="primary"
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                                disabled={loading || !canSubmit}
                                            >
                                                {loading ? "Creando..." : "Solicitar Vacaciones"}
                                            </Button>
                                        </div>
                                    </form>
                                </motion.div>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            )}
        </AnimatePresence>
    );
};

export default VacationRequestModal;
