import React, { useState, useEffect } from "react";
import { FiX, FiCalendar, FiClock, FiAlertCircle, FiFileText } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../../../core/ui/components/Button";
import Card from "../../../../core/ui/components/Card";
import { useUI } from "../../../../core/ui/UIContext";
import { createSolicitud, getVacationSummary } from "../../../../core/api/permisosApi";

/**
 * Modal unificado para solicitudes de permisos y vacaciones
 * Flujo multi-paso:
 * 1. Seleccionar tipo (permiso o vacación)
 * 2. Llenar formulario específico
 * 3. Confirmar y enviar
 */
const PermisoVacacionModal = ({ open, onClose, onSuccess }) => {
    const { showToast } = useUI();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [tipoSolicitud, setTipoSolicitud] = useState(""); // 'permiso' o 'vacaciones'
    const [tipoPermiso, setTipoPermiso] = useState(""); // 'estudios', 'personal', 'salud', 'calamidad'
    const [subtipoCalamidad, setSubtipoCalamidad] = useState(""); // 'fallecimiento', 'accidente', 'desastre'
    const [vacationSummary, setVacationSummary] = useState(null);

    const [formData, setFormData] = useState({
        // Común
        fecha_inicio: "",
        fecha_fin: "",

        // Permisos
        duracion_horas: "",
        tipo_permiso: "",
        subtipo_calamidad: "",

        // Vacaciones
        duracion_dias: "",
        periodo_vacaciones: new Date().getFullYear().toString(),
        fecha_regreso: "",
    });

    useEffect(() => {
        if (open && tipoSolicitud === "vacaciones") {
            loadVacationSummary();
        }
    }, [open, tipoSolicitud]);

    const loadVacationSummary = async () => {
        try {
            const response = await getVacationSummary();
            if (response.ok) {
                setVacationSummary(response.data);
            }
        } catch (error) {
            console.error("Error loading vacation summary:", error);
        }
    };

    const handleReset = () => {
        setStep(1);
        setTipoSolicitud("");
        setTipoPermiso("");
        setSubtipoCalamidad("");
        setFormData({
            fecha_inicio: "",
            fecha_fin: "",
            duracion_horas: "",
            tipo_permiso: "",
            subtipo_calamidad: "",
            duracion_dias: "",
            periodo_vacaciones: new Date().getFullYear().toString(),
            fecha_regreso: "",
        });
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const payload = {
                tipo_solicitud: tipoSolicitud,
                ...formData,
            };

            if (tipoSolicitud === "permiso") {
                payload.tipo_permiso = tipoPermiso;
                if (tipoPermiso === "calamidad") {
                    payload.subtipo_calamidad = subtipoCalamidad;
                }
            }

            const response = await createSolicitud(payload);

            if (response.ok) {
                showToast(
                    tipoSolicitud === "vacaciones"
                        ? "Solicitud de vacaciones creada exitosamente"
                        : "Solicitud de permiso creada exitosamente",
                    "success"
                );
                onSuccess?.();
                handleClose();
            } else {
                throw new Error(response.message || "Error al crear solicitud");
            }
        } catch (error) {
            console.error("Error creating solicitud:", error);
            showToast(error.response?.data?.message || error.message || "Error al crear la solicitud", "error");
        } finally {
            setLoading(false);
        }
    };

    const calculateDays = () => {
        if (!formData.fecha_inicio || !formData.fecha_fin) return 0;
        const start = new Date(formData.fecha_inicio);
        const end = new Date(formData.fecha_fin);
        const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
        return diff >= 0 ? diff + 1 : 0;
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
                <div
                    key={s}
                    className={`h-2 w-12 rounded-full transition-colors ${s === step ? "bg-indigo-600" : s < step ? "bg-indigo-300" : "bg-gray-200"
                        }`}
                />
            ))}
        </div>
    );

    const renderStep1 = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">¿Qué deseas solicitar?</h3>
            <div className="grid grid-cols-2 gap-4">
                <button
                    type="button"
                    onClick={() => {
                        setTipoSolicitud("permiso");
                        setStep(2);
                    }}
                    className="p-6 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                >
                    <FiClock className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                    <p className="font-semibold text-gray-900">Permiso</p>
                    <p className="text-xs text-gray-500 mt-1">Estudios, personal, salud, calamidad</p>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setTipoSolicitud("vacaciones");
                        setStep(2);
                    }}
                    className="p-6 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                >
                    <FiCalendar className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <p className="font-semibold text-gray-900">Vacaciones</p>
                    <p className="text-xs text-gray-500 mt-1">Descanso anual programado</p>
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => {
        if (tipoSolicitud === "permiso") {
            return renderPermisoForm();
        } else if (tipoSolicitud === "vacaciones") {
            return renderVacacionesForm();
        }
        return null;
    };

    const renderPermisoForm = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Tipo de Permiso</h3>

            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => setTipoPermiso("estudios")}
                    className={`p-4 border-2 rounded-lg transition-all ${tipoPermiso === "estudios"
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 hover:border-indigo-300"
                        }`}
                >
                    <p className="font-semibold text-sm">Por Estudios</p>
                    <p className="text-xs text-gray-500 mt-1">Máx 3h recuperables</p>
                </button>

                <button
                    type="button"
                    onClick={() => setTipoPermiso("personal")}
                    className={`p-4 border-2 rounded-lg transition-all ${tipoPermiso === "personal"
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 hover:border-indigo-300"
                        }`}
                >
                    <p className="font-semibold text-sm">Asuntos Personales</p>
                    <p className="text-xs text-gray-500 mt-1">Máx 2h/semana</p>
                </button>

                <button
                    type="button"
                    onClick={() => setTipoPermiso("salud")}
                    className={`p-4 border-2 rounded-lg transition-all ${tipoPermiso === "salud"
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 hover:border-indigo-300"
                        }`}
                >
                    <p className="font-semibold text-sm">Por Salud</p>
                    <p className="text-xs text-gray-500 mt-1">Con certificado médico</p>
                </button>

                <button
                    type="button"
                    onClick={() => setTipoPermiso("calamidad")}
                    className={`p-4 border-2 rounded-lg transition-all ${tipoPermiso === "calamidad"
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 hover:border-indigo-300"
                        }`}
                >
                    <p className="font-semibold text-sm">Calamidad Doméstica</p>
                    <p className="text-xs text-gray-500 mt-1">Emergencia familiar</p>
                </button>
            </div>

            {tipoPermiso === "calamidad" && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Tipo de Calamidad</label>
                    <select
                        value={subtipoCalamidad}
                        onChange={(e) => setSubtipoCalamidad(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        required
                    >
                        <option value="">Selecciona...</option>
                        <option value="fallecimiento">Fallecimiento de familiar (hasta 2do grado)</option>
                        <option value="accidente">Accidente de familiar directo</option>
                        <option value="desastre">Desastre natural</option>
                    </select>
                </div>
            )}

            {tipoPermiso && (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
                            <input
                                type="date"
                                value={formData.fecha_inicio}
                                onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {tipoPermiso === "estudios" || tipoPermiso === "personal" ? "Horas" : "Días"}
                            </label>
                            <input
                                type="number"
                                step={tipoPermiso === "estudios" || tipoPermiso === "personal" ? "0.5" : "1"}
                                value={
                                    tipoPermiso === "estudios" || tipoPermiso === "personal"
                                        ? formData.duracion_horas
                                        : formData.duracion_dias
                                }
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        [tipoPermiso === "estudios" || tipoPermiso === "personal"
                                            ? "duracion_horas"
                                            : "duracion_dias"]: e.target.value,
                                    })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                required
                                min="0.5"
                                max={tipoPermiso === "estudios" ? "3" : tipoPermiso === "personal" ? "2" : "30"}
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700">
                            <strong>Nota:</strong> Después de la aprobación parcial, deberás subir los documentos
                            justificantes correspondientes.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setStep(1)} className="flex-1">
                            Atrás
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => setStep(3)}
                            className="flex-1"
                            disabled={!tipoPermiso || (tipoPermiso === "calamidad" && !subtipoCalamidad)}
                        >
                            Continuar
                        </Button>
                    </div>
                </>
            )}
        </div>
    );

    const renderVacacionesForm = () => {
        const days = calculateDays();
        const remaining = vacationSummary?.remaining || 0;
        const canSubmit = days > 0 && days <= remaining;

        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Solicitud de Vacaciones</h3>

                {vacationSummary && (
                    <div className="grid grid-cols-4 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                            <p className="text-xs text-blue-600 font-medium">Asignados</p>
                            <p className="text-xl font-bold text-blue-700">{vacationSummary.allowance}</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg text-center">
                            <p className="text-xs text-green-600 font-medium">Disponibles</p>
                            <p className="text-xl font-bold text-green-700">{vacationSummary.remaining}</p>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-lg text-center">
                            <p className="text-xs text-amber-600 font-medium">Usados</p>
                            <p className="text-xl font-bold text-amber-700">{vacationSummary.taken}</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-center">
                            <p className="text-xs text-purple-600 font-medium">Pendientes</p>
                            <p className="text-xl font-bold text-purple-700">{vacationSummary.pending}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Inicio *</label>
                        <input
                            type="date"
                            value={formData.fecha_inicio}
                            onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Fin *</label>
                        <input
                            type="date"
                            value={formData.fecha_fin}
                            onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                            min={formData.fecha_inicio}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                    <input
                        type="text"
                        value={formData.periodo_vacaciones}
                        onChange={(e) => setFormData({ ...formData, periodo_vacaciones: e.target.value })}
                        placeholder="2024"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                {days > 0 && (
                    <div
                        className={`p-4 border rounded-lg ${canSubmit ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                            }`}
                    >
                        <p className={`text-sm font-medium ${canSubmit ? "text-emerald-900" : "text-red-900"}`}>
                            Días solicitados: <span className="text-lg font-bold">{days}</span>
                        </p>
                        <p className={`text-xs ${canSubmit ? "text-emerald-700" : "text-red-700"}`}>
                            {canSubmit
                                ? `Quedarían ${remaining - days} días disponibles`
                                : `No tienes suficientes días. Solo tienes ${remaining} días disponibles.`}
                        </p>
                    </div>
                )}

                <div className="flex gap-3 pt-4">
                    <Button type="button" variant="secondary" onClick={() => setStep(1)} className="flex-1">
                        Atrás
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={() => setStep(3)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        disabled={!canSubmit}
                    >
                        Continuar
                    </Button>
                </div>
            </div>
        );
    };

    const renderStep3 = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Confirmar Solicitud</h3>

            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tipo:</span>
                    <span className="text-sm font-semibold text-gray-900">
                        {tipoSolicitud === "vacaciones" ? "Vacaciones" : `Permiso por ${tipoPermiso}`}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Fecha inicio:</span>
                    <span className="text-sm font-semibold text-gray-900">{formData.fecha_inicio}</span>
                </div>
                {formData.fecha_fin && (
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Fecha fin:</span>
                        <span className="text-sm font-semibold text-gray-900">{formData.fecha_fin}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Duración:</span>
                    <span className="text-sm font-semibold text-gray-900">
                        {tipoSolicitud === "vacaciones"
                            ? `${calculateDays()} días`
                            : formData.duracion_horas
                                ? `${formData.duracion_horas} horas`
                                : `${formData.duracion_dias} días`}
                    </span>
                </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                    <strong>Importante:</strong> Tu solicitud será enviada a tu jefe inmediato para aprobación.
                    {tipoSolicitud === "permiso" &&
                        " Después de la aprobación parcial, deberás subir los documentos justificantes."}
                </p>
            </div>

            <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setStep(2)} className="flex-1">
                    Atrás
                </Button>
                <Button
                    type="button"
                    variant="primary"
                    onClick={handleSubmit}
                    className="flex-1"
                    disabled={loading}
                >
                    {loading ? "Enviando..." : "Enviar Solicitud"}
                </Button>
            </div>
        </div>
    );

    if (!open) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-2xl"
                >
                    <Card className="relative">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <FiFileText className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Nueva Solicitud</h2>
                                    <p className="text-sm text-gray-500">Permisos y Vacaciones</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                disabled={loading}
                            >
                                <FiX className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            {renderStepIndicator()}
                            {step === 1 && renderStep1()}
                            {step === 2 && renderStep2()}
                            {step === 3 && renderStep3()}
                        </div>
                    </Card>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PermisoVacacionModal;
