import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    FiAlertCircle,
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiFileText,
    FiX,
} from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";
import Card from "../../../../core/ui/components/Card";
import { useUI } from "../../../../core/ui/UIContext";
import { crearPermiso } from "../../../../core/api/permisosApi";
import { getVacationSummary } from "../../../../core/api/vacationsApi";

const initialForm = {
    tipo_solicitud: "permiso",
    tipo_permiso: "",
    subtipo_calamidad: "",
    fecha_inicio: "",
    fecha_fin: "",
    duracion_horas: "",
    periodo_vacaciones: new Date().getFullYear().toString(),
    observaciones: "",
};

const permisoLabels = {
    estudios: "Por Estudios (máx 3h, recuperables)",
    personal: "Asuntos Personales (máx 2h/semana)",
    salud: "Salud",
    calamidad: "Calamidad Doméstica",
};

const subtipoLabels = {
    fallecimiento: "Fallecimiento de familiar (máx 3 días)",
    accidente: "Accidente de familiar",
    desastre: "Desastres naturales",
};

const getJustificantesRequeridos = (tipoPermiso, subtipoCalamidad, duracionDias) => {
    if (tipoPermiso === "estudios") return ["certificado_institucion"];
    if (tipoPermiso === "personal") return ["evidencia_general"];
    if (tipoPermiso === "salud") {
        if (duracionDias && duracionDias >= 4) return ["certificado_medico_iess"];
        return ["certificado_medico"];
    }
    if (tipoPermiso === "calamidad") {
        switch (subtipoCalamidad) {
            case "fallecimiento":
                return ["certificado_defuncion", "documento_parentesco"];
            case "accidente":
                return ["certificado_medico_familiar"];
            case "desastre":
                return ["evidencia_fotografica"];
            default:
                return [];
        }
    }
    return [];
};

const PermisoVacacionModal = ({ open, onClose, onSuccess }) => {
    const { showToast } = useUI();
    const [formData, setFormData] = useState(initialForm);
    const [step, setStep] = useState("tipo");
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);

    useEffect(() => {
        if (open) {
            setFormData(initialForm);
            setStep("tipo");
            loadSummary();
        }
    }, [open]);

    const loadSummary = async () => {
        try {
            setLoadingSummary(true);
            const data = await getVacationSummary(false);
            setSummary(data);
        } catch (error) {
            console.error("Error loading vacation summary", error);
        } finally {
            setLoadingSummary(false);
        }
    };

    const duracionDias = useMemo(() => {
        if (!formData.fecha_inicio || !formData.fecha_fin) return 0;
        const start = new Date(formData.fecha_inicio);
        const end = new Date(formData.fecha_fin);
        const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
        return diff >= 0 ? diff + 1 : 0;
    }, [formData.fecha_inicio, formData.fecha_fin]);

    const esPermisoPorHoras = ["estudios", "personal"].includes(formData.tipo_permiso);
    const justificantesPreview = useMemo(
        () =>
            getJustificantesRequeridos(
                formData.tipo_permiso,
                formData.subtipo_calamidad,
                duracionDias
            ),
        [formData.subtipo_calamidad, formData.tipo_permiso, duracionDias]
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.tipo_solicitud) {
            showToast("Selecciona el tipo de solicitud", "error");
            return;
        }

        if (formData.tipo_solicitud === "permiso") {
            if (!formData.tipo_permiso) {
                showToast("Selecciona el tipo de permiso", "error");
                return;
            }

            if (!formData.fecha_inicio) {
                showToast("Debes indicar la fecha de inicio", "error");
                return;
            }

            if (esPermisoPorHoras) {
                const horas = parseFloat(formData.duracion_horas || "0");
                if (horas <= 0) {
                    showToast("Indica la duración en horas", "error");
                    return;
                }
                if (formData.tipo_permiso === "estudios" && horas > 3) {
                    showToast("El permiso por estudios no puede exceder 3 horas", "error");
                    return;
                }
                if (formData.tipo_permiso === "personal" && horas > 2) {
                    showToast("Los asuntos personales no pueden exceder 2h semanales", "error");
                    return;
                }
            } else {
                if (!formData.fecha_fin) {
                    showToast("Debes indicar la fecha de fin", "error");
                    return;
                }
                if (duracionDias <= 0) {
                    showToast("Rango de fechas inválido", "error");
                    return;
                }
                if (
                    formData.tipo_permiso === "calamidad" &&
                    formData.subtipo_calamidad === "fallecimiento" &&
                    duracionDias > 3
                ) {
                    showToast("Fallecimiento: máximo 3 días", "error");
                    return;
                }
            }
        }

        if (formData.tipo_solicitud === "vacaciones") {
            if (!formData.fecha_inicio || !formData.fecha_fin) {
                showToast("Selecciona el rango de fechas", "error");
                return;
            }
            if (duracionDias <= 0) {
                showToast("Rango de fechas inválido", "error");
                return;
            }
        }

        try {
            setLoading(true);
            const payload = {
                tipo_solicitud: formData.tipo_solicitud,
                tipo_permiso:
                    formData.tipo_solicitud === "permiso" ? formData.tipo_permiso : undefined,
                subtipo_calamidad:
                    formData.tipo_permiso === "calamidad" ? formData.subtipo_calamidad : undefined,
                fecha_inicio: formData.fecha_inicio,
                fecha_fin: formData.fecha_fin || formData.fecha_inicio,
                duracion_horas: esPermisoPorHoras ? Number(formData.duracion_horas) : undefined,
                duracion_dias:
                    formData.tipo_solicitud === "vacaciones" || !esPermisoPorHoras
                        ? duracionDias
                        : undefined,
                periodo_vacaciones:
                    formData.tipo_solicitud === "vacaciones"
                        ? formData.periodo_vacaciones
                        : undefined,
                observaciones: formData.observaciones
                    ? [formData.observaciones]
                    : undefined,
                justificacion_requerida: justificantesPreview,
            };

            await crearPermiso(payload);
            showToast(
                formData.tipo_solicitud === "vacaciones"
                    ? "Solicitud de vacaciones creada"
                    : "Permiso enviado para aprobación",
                "success"
            );
            onSuccess?.();
            handleClose();
        } catch (error) {
            console.error("Error creando permiso/vacaciones", error);
            showToast(
                error?.response?.data?.message || "No pudimos enviar tu solicitud",
                "error"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFormData(initialForm);
        setStep("tipo");
        onClose?.();
    };

    if (!open) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-3xl"
                >
                    <Card className="relative">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <FiCalendar className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">
                                        Solicitud de Permisos y Vacaciones
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        Define el tipo, completa los datos y envía a aprobación.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <FiX className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    type="button"
                                    variant={formData.tipo_solicitud === "permiso" ? "primary" : "ghost"}
                                    onClick={() => {
                                        setFormData((prev) => ({ ...prev, tipo_solicitud: "permiso" }));
                                        setStep("detalle");
                                    }}
                                >
                                    Solicitar Permiso
                                </Button>
                                <Button
                                    type="button"
                                    variant={formData.tipo_solicitud === "vacaciones" ? "primary" : "ghost"}
                                    onClick={() => {
                                        setFormData((prev) => ({ ...prev, tipo_solicitud: "vacaciones" }));
                                        setStep("detalle");
                                    }}
                                >
                                    Solicitar Vacaciones
                                </Button>
                            </div>

                            {step === "tipo" && (
                                <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3 text-gray-600">
                                    <FiAlertCircle className="text-amber-500" />
                                    Selecciona si deseas registrar un permiso puntual o un período de vacaciones.
                                </div>
                            )}

                            {formData.tipo_solicitud === "permiso" && step === "detalle" && (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Tipo de permiso *
                                            </label>
                                            <select
                                                value={formData.tipo_permiso}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        tipo_permiso: e.target.value,
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                                required
                                            >
                                                <option value="">Selecciona tipo</option>
                                                {Object.entries(permisoLabels).map(([value, label]) => (
                                                    <option key={value} value={value}>
                                                        {label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {formData.tipo_permiso === "calamidad" && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Subtipo de calamidad *
                                                </label>
                                                <select
                                                    value={formData.subtipo_calamidad}
                                                    onChange={(e) =>
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            subtipo_calamidad: e.target.value,
                                                        }))
                                                    }
                                                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                                    required
                                                >
                                                    <option value="">Selecciona subtipo</option>
                                                    {Object.entries(subtipoLabels).map(([value, label]) => (
                                                        <option key={value} value={value}>
                                                            {label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Fecha de inicio *
                                            </label>
                                            <div className="relative">
                                                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    type="date"
                                                    required
                                                    value={formData.fecha_inicio}
                                                    onChange={(e) =>
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            fecha_inicio: e.target.value,
                                                            fecha_fin: esPermisoPorHoras ? e.target.value : prev.fecha_fin,
                                                        }))
                                                    }
                                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>

                                        {!esPermisoPorHoras && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Fecha de fin *
                                                </label>
                                                <div className="relative">
                                                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <input
                                                        type="date"
                                                        required
                                                        value={formData.fecha_fin}
                                                        onChange={(e) =>
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                fecha_fin: e.target.value,
                                                            }))
                                                        }
                                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {esPermisoPorHoras && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Duración (horas) *
                                                </label>
                                                <div className="relative">
                                                    <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.5"
                                                        required
                                                        value={formData.duracion_horas}
                                                        onChange={(e) =>
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                duracion_horas: e.target.value,
                                                            }))
                                                        }
                                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Observaciones
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={formData.observaciones}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    observaciones: e.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                            placeholder="Detalles adicionales que ayuden a tu jefe a aprobar"
                                        />
                                    </div>

                                    {justificantesPreview.length > 0 && (
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                                            <FiFileText className="mt-1 text-blue-500" />
                                            <div>
                                                <p className="text-sm font-semibold text-blue-900">
                                                    Justificantes requeridos
                                                </p>
                                                <ul className="mt-1 text-sm text-blue-800 list-disc list-inside space-y-1">
                                                    {justificantesPreview.map((item) => (
                                                        <li key={item}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {formData.tipo_solicitud === "vacaciones" && step === "detalle" && (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Fecha de inicio *
                                            </label>
                                            <div className="relative">
                                                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    type="date"
                                                    required
                                                    value={formData.fecha_inicio}
                                                    onChange={(e) =>
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            fecha_inicio: e.target.value,
                                                        }))
                                                    }
                                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Fecha de fin *
                                            </label>
                                            <div className="relative">
                                                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    type="date"
                                                    required
                                                    value={formData.fecha_fin}
                                                    onChange={(e) =>
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            fecha_fin: e.target.value,
                                                        }))
                                                    }
                                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Periodo de vacaciones
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.periodo_vacaciones}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        periodo_vacaciones: e.target.value,
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                            />
                                        </div>
                                    </div>

                                    {loadingSummary ? (
                                        <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-600">
                                            Cargando información de vacaciones...
                                        </div>
                                    ) : summary ? (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <SummaryPill label="Asignados" value={summary.allowance} color="blue" />
                                            <SummaryPill label="Disponibles" value={summary.remaining} color="emerald" />
                                            <SummaryPill label="Usados" value={summary.taken} color="amber" />
                                            <SummaryPill label="Pendientes" value={summary.pending} color="purple" />
                                        </div>
                                    ) : null}

                                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800 flex items-center gap-2">
                                        <FiCheckCircle />
                                        Se solicitarán {duracionDias || 0} días en total.
                                    </div>
                                </div>
                            )}

                            {step === "detalle" && (
                                <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                                    <Button type="button" variant="ghost" onClick={handleClose}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" variant="primary" loading={loading} disabled={loading}>
                                        {loading ? "Enviando..." : "Enviar solicitud"}
                                    </Button>
                                </div>
                            )}
                        </form>
                    </Card>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const SummaryPill = ({ label, value, color = "blue" }) => {
    const colorMap = {
        blue: "bg-blue-50 text-blue-700",
        emerald: "bg-emerald-50 text-emerald-700",
        amber: "bg-amber-50 text-amber-700",
        purple: "bg-purple-50 text-purple-700",
    };

    return (
        <div className={`p-3 rounded-lg text-center text-sm font-semibold ${colorMap[color] || colorMap.blue}`}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
            <p className="text-xl">{value ?? 0}</p>
        </div>
    );
};

export default PermisoVacacionModal;
