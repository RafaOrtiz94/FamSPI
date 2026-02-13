import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiClock, FiCoffee, FiSun, FiMoon, FiAlertTriangle, FiTrendingUp } from "react-icons/fi";
import confetti from "canvas-confetti";

import Button from "../components/Button";
import Card from "../components/Card";
import Modal from "../components/Modal";
import { useUI } from "../useUI";

import {
    clockIn,
    clockOutLunch,
    clockInLunch,
    clockOut,
    registerException,
    updateExceptionStatus,
    getActiveException,
    getTodayAttendance,
} from "../../api/attendanceApi";
import { useAutoUpdate } from "../../api/index";
import { formatTimeSafe, formatDateTimeSafe, toDate } from "../../../shared/utils/dateUtils";

const AttendanceWidget = () => {
    const { showToast } = useUI();

    const [attendance, setAttendance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showCelebration, setShowCelebration] = useState(false);

    const [activeException, setActiveException] = useState(null);
    const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
    const [exceptionType, setExceptionType] = useState("");
    const [exceptionDescription, setExceptionDescription] = useState("");
    const [exceptionLoading, setExceptionLoading] = useState(false);


    // Geolocation state
    const [locationLoading, setLocationLoading] = useState(false);
    const [cachedLocation, setCachedLocation] = useState(null);
    const [locationTimestamp, setLocationTimestamp] = useState(null);
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        refreshAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sistema de actualizaciones automáticas sin loops
    useAutoUpdate(() => {
        refreshAll();
    }, []);

    const loadAttendance = async () => {
        try {
            const res = await getTodayAttendance();
            setAttendance(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchException = async () => {
        try {
            const res = await getActiveException();
            setActiveException(res.data);
        } catch (err) {
            console.error("Error fetching active exception:", err);
        }
    };

    const refreshAll = async () => {
        await Promise.all([loadAttendance(), fetchException()]);
    };

    /**
     * Optimized geolocation with caching, retry logic, and performance improvements
     * - Uses cached location if recent (< 10 minutes)
     * - Fast mode first (low accuracy, 5s timeout), fallback to high accuracy
     * - Non-blocking with loading indicators
     * - Allows attendance without location when geolocation fails
     */
    const getLocation = async (showErrors = true) => {
        // Check cache first (10 minutes validity)
        const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
        if (cachedLocation && locationTimestamp &&
            (Date.now() - locationTimestamp) < CACHE_DURATION) {
            return cachedLocation;
        }

        if (!navigator.geolocation) {
            if (showErrors) {
                showToast("Geolocalización no soportada por el navegador", "warning");
            }
            return null;
        }

        const getPosition = (options) =>
            new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, options);
            });

        try {
            setLocationLoading(true);

            // Try fast mode first (5 seconds, low accuracy)
            const fastOptions = {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 300000 // 5 minutes cache
            };

            try {
                const pos = await getPosition(fastOptions);
                const loc = `${pos.coords.latitude},${pos.coords.longitude}`;
                setCachedLocation(loc);
                setLocationTimestamp(Date.now());
                return loc;
            } catch (fastError) {
                console.warn("Fast geolocation failed, trying high accuracy mode:", fastError);

                // Fallback to high accuracy mode (8 seconds timeout)
                const highAccuracyOptions = {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 180000 // 3 minutes cache
                };

                const pos = await getPosition(highAccuracyOptions);
                const loc = `${pos.coords.latitude},${pos.coords.longitude}`;
                setCachedLocation(loc);
                setLocationTimestamp(Date.now());
                return loc;
            }
        } catch (err) {
            console.error("Geolocation error:", err);

            // Handle different error types gracefully
            if (showErrors) {
                let msg = "No se pudo obtener ubicación.";
                if (err.code === 1) {
                    msg = "Permiso de ubicación denegado. El registro continuará sin ubicación.";
                } else if (err.code === 2) {
                    msg = "Ubicación no disponible. El registro continuará sin ubicación.";
                } else if (err.code === 3) {
                    msg = "Tiempo de espera agotado. El registro continuará sin ubicación.";
                }
                showToast(msg, "warning");
            }

            return null; // Allow attendance without location
        } finally {
            setLocationLoading(false);
        }
    };
    const formatTime = (ts) => {
        return formatTimeSafe(ts);
    };

    const formatDateTime = (ts) => {
        return formatDateTimeSafe(ts, 'dd/MM/yyyy HH:mm');
    };

    const celebrate = () => {
        confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
            colors: ["#3b82f6", "#22c55e", "#6366f1"],
        });
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 2500);
    };

    const calculateProgress = () => {
        const entryDate = toDate(attendance?.entry_time);
        if (!entryDate) return 0;

        const now = new Date();
        let workedMs = now.getTime() - entryDate.getTime();

        const lunchStart = toDate(attendance?.lunch_start_time);
        if (lunchStart) {
            const lunchEnd = toDate(attendance?.lunch_end_time);
            workedMs -= (lunchEnd ? lunchEnd.getTime() : now.getTime()) - lunchStart.getTime();
        }

        const hours = workedMs / (1000 * 60 * 60);
        return Math.min(Math.round((hours / 8) * 100), 100);
    };

    const getStatusInfo = () => {
        if (!attendance?.entry_time)
            return {
                text: "Marca tu entrada",
                icon: <FiSun className="text-yellow-500" />,
            };

        if (attendance.exit_time)
            return {
                text: "Jornada completada",
                icon: <FiMoon className="text-indigo-500" />,
            };

        if (attendance.lunch_start_time && !attendance.lunch_end_time)
            return {
                text: "En almuerzo",
                icon: <FiCoffee className="text-orange-500" />,
            };

        return {
            text: "Jornada en progreso",
            icon: <FiClock className="text-blue-500" />,
        };
    };

    /**
     * Optimized non-blocking attendance handler
     * - Starts geolocation in background
     * - Proceeds with attendance registration regardless of geolocation result
     * - Shows appropriate loading states and feedback
     */
    const handle = async (fn, successMsg, celebrateDay = false) => {
        setLoading(true);

        try {
            // Start geolocation in background (non-blocking)
            const locationPromise = getLocation(false); // Don't show errors in background

            // Proceed with attendance registration
            const res = await fn(await locationPromise);

            if (res.ok) {
                if (celebrateDay) celebrate();
                showToast(successMsg, "success");
                await refreshAll();
            } else {
                showToast("Error registrando asistencia", "error");
            }
        } catch (err) {
            console.error("Attendance registration error:", err);
            showToast(err.response?.data?.message || err.message || "Error registrando asistencia", "error");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Optimized exception registration with background geolocation
     */
    const handleRegisterException = async () => {
        const finalType = exceptionType || "otro";
        const finalDescription = exceptionDescription || "Salida inesperada";

        setExceptionLoading(true);
        try {
            // Start geolocation in background
            const locationPromise = getLocation(false);

            const res = await registerException(finalType, finalDescription, await locationPromise);
            if (res.ok) {
                showToast("Salida registrada. Notifica tu llegada.", "success");
                setExceptionModalOpen(false);
                setExceptionType("");
                setExceptionDescription("");
                await refreshAll();
            } else {
                showToast("Error registrando salida", "error");
            }
        } catch (err) {
            console.error("Exception registration error:", err);
            const msg = err.response?.data?.message || err.message || "Error registrando salida";
            showToast(msg, "error");
        } finally {
            setExceptionLoading(false);
        }
    };

    /**
     * Optimized exception status update with background geolocation
     */
    const handleExceptionUpdate = async (status, successMsg) => {
        setLoading(true);
        try {
            // Start geolocation in background
            const locationPromise = getLocation(false);

            const res = await updateExceptionStatus(status, await locationPromise);
            if (res.ok) {
                showToast(successMsg, "success");
                await refreshAll();
            } else {
                showToast("Error actualizando estado", "error");
            }
        } catch (err) {
            console.error("Exception update error:", err);
            const msg = err.response?.data?.message || err.message || "Error actualizando estado";
            showToast(msg, "error");
        } finally {
            setLoading(false);
        }
    };

    const progress = calculateProgress();
    const status = getStatusInfo();
    const hasActiveException = Boolean(activeException);
    const exceptionStatus = activeException?.status || "NONE";
    const exceptionStepLabel =
        {
            ACTIVE: "En ruta",
            ON_SITE: "En sitio",
            RETURNING: "Regresando",
            COMPLETED: "Completada",
            NONE: "Sin salidas inesperadas",
        }[exceptionStatus] || "Sin salidas inesperadas";

    const baseTimeEntries = [
        ["Entrada", attendance?.entry_time, "bg-emerald-50 border-emerald-200 text-emerald-800"],
        ["Salida Almuerzo", attendance?.lunch_start_time, "bg-orange-50 border-orange-200 text-orange-800"],
        ["Entrada Almuerzo", attendance?.lunch_end_time, "bg-blue-50 border-blue-200 text-blue-800"],
        ["Salida", attendance?.exit_time, "bg-indigo-50 border-indigo-200 text-indigo-800"],
    ].map(([label, time, colors]) => ({ label, value: time, colors }));

    const exceptionTimeEntries = hasActiveException
        ? [
            {
                label: "Salida inesperada",
                value: activeException.start_time,
                colors: "bg-amber-50 border-amber-200 text-amber-800",
                note: activeException.type ? activeException.type.replace(/_/g, " ").toUpperCase() : "Sin motivo",
            },
            {
                label: "Arribo a destino",
                value: activeException.arrival_time,
                colors: "bg-orange-50 border-orange-200 text-orange-800",
                note: activeException.status === "ON_SITE" ? "Llegaste" : "Pendiente",
            },
            {
                label: "Salida del destino",
                value: activeException.departure_time,
                colors: "bg-yellow-50 border-yellow-200 text-yellow-800",
                note: activeException.status === "RETURNING" ? "Regresando" : "Pendiente",
            },
            {
                label: "Regreso a oficina",
                value: activeException.return_time,
                colors: "bg-emerald-50 border-emerald-200 text-emerald-800",
                note: activeException.status === "COMPLETED" ? "Completado" : "Pendiente",
            },
        ]
        : [];

    const timeEntries = [...baseTimeEntries, ...exceptionTimeEntries];

    const renderExceptionBanner = () => {
        if (!hasActiveException) return null;
        const items = [
            { label: "Salida de oficina", value: activeException.start_time, icon: "🏢" },
            { label: "Llegada a destino", value: activeException.arrival_time, icon: "📍" },
            { label: "Salida de destino", value: activeException.departure_time, icon: "🚶" },
            { label: "Regreso a oficina", value: activeException.return_time, icon: "🏠" },
        ];

        return (
            <div className="mb-6 p-5 rounded-2xl border-2 border-amber-200/60 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl">
                            <FiAlertTriangle className="text-amber-600" size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
                                🚨 Salida Inesperada Activa
                            </h4>
                            <p className="text-sm font-semibold text-amber-800">{exceptionStepLabel}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                            {activeException.type}
                        </span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {items.map((item) => (
                        <div
                            key={item.label}
                            className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-3 border border-amber-100/50 shadow-sm"
                        >
                            <span className="text-lg">{item.icon}</span>
                            <div className="flex-1">
                                <div className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
                                    {item.label}
                                </div>
                                <div className="text-sm font-mono font-bold text-amber-800">
                                    {formatDateTime(item.value)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderExceptionControls = () => {
        if (!attendance?.entry_time || attendance?.exit_time) return null;

        if (!hasActiveException) {
            return (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 mt-2">
                    <div className="flex items-center gap-2 text-amber-800 mb-2">
                        <FiAlertTriangle size={14} />
                        <span className="text-xs font-semibold uppercase">Salida inesperada</span>
                    </div>
                    <p className="text-xs text-amber-700 mb-3">
                        Si necesitas salir por permiso, cita o emergencia, registralo aqui para dejar trazabilidad.
                    </p>
                    <Button
                        onClick={() => setExceptionModalOpen(true)}
                        className="w-full text-xs py-2 bg-amber-500 hover:bg-amber-600"
                        disabled={loading}
                    >
                        Registrar salida inesperada
                    </Button>
                </div>
            );
        }

        return (
            <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center gap-2 mb-2 text-amber-800">
                    <FiAlertTriangle size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                        Salida en curso: {activeException.type}
                    </span>
                </div>

                {activeException.status === "ACTIVE" && (
                    <>
                        <p className="text-xs text-amber-700 mb-3">Estas en camino a tu destino.</p>
                        <Button
                            onClick={() => handleExceptionUpdate("ON_SITE", "Has llegado a tu destino")}
                            className="w-full text-xs py-2 bg-amber-500 hover:bg-amber-600"
                            disabled={loading}
                        >
                            Llegue a destino
                        </Button>
                    </>
                )}

                {activeException.status === "ON_SITE" && (
                    <>
                        <p className="text-xs text-amber-700 mb-3">Estas en el sitio. Registra cuando salgas.</p>
                        <Button
                            onClick={() => handleExceptionUpdate("RETURNING", "Has salido del destino")}
                            className="w-full text-xs py-2 bg-amber-500 hover:bg-amber-600"
                            disabled={loading}
                        >
                            Salir de destino
                        </Button>
                    </>
                )}

                {activeException.status === "RETURNING" && (
                    <>
                        <p className="text-xs text-amber-700 mb-3">Estas regresando a la oficina.</p>
                        <Button
                            onClick={() => handleExceptionUpdate("COMPLETED", "Ciclo de salida completado")}
                            className="w-full text-xs py-2 bg-green-600 hover:bg-green-700"
                            disabled={loading}
                        >
                            Llegue a oficina
                        </Button>
                    </>
                )}
            </div>
        );
    };

    const quickEntryTime = attendance?.entry_time ? formatTime(attendance.entry_time) : null;
    const quickBadgeText = quickEntryTime ? `${status.text} · ${quickEntryTime}` : status.text;

    const renderWidgetContent = () => (
        <Card className="relative overflow-hidden rounded-3xl bg-white/95 backdrop-blur-xl shadow-md border border-slate-200/70 p-4 sm:p-5">
            {/* Header Section */}
            <div className="flex flex-col gap-3 mb-4 pb-3 border-b border-slate-200/70 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-2xl bg-slate-100 shadow-sm">
                        {status.icon}
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 tracking-tight">Asistencia de Hoy</h3>
                        <p className="text-[11px] text-slate-600 font-medium">{status.text}</p>
                    </div>
                </div>

                <div className="text-left md:text-right">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Hora Actual</div>
                    <div className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white px-3 py-1 text-xs font-mono font-bold">
                        {formatTimeSafe(currentTime, 'HH:mm:ss')}
                    </div>
                </div>
            </div>

            {/* Progress Section */}
            {attendance?.entry_time && !attendance?.exit_time && (
                <div className="mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <FiTrendingUp className="text-blue-600" size={14} />
                            <span className="text-[11px] font-semibold text-slate-800 uppercase tracking-widest">Progreso</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">{progress}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-200/70 rounded-full overflow-hidden shadow-inner">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ type: "spring", stiffness: 120, damping: 20 }}
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 shadow-sm"
                        />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2 text-center font-medium">
                        Jornada laboral de 8 horas
                    </div>
                </div>
            )}

            {renderExceptionBanner()}

            {/* Time Records Grid */}
            <div className="mb-4">
                <h4 className="text-[11px] font-semibold text-slate-600 mb-2 flex items-center gap-2 uppercase tracking-widest">
                    <FiClock className="text-slate-500" size={12} />
                    Registro de Tiempos
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {timeEntries.map((entry) => (
                        <motion.div
                            key={`${entry.label}-${entry.value ?? "pending"}`}
                            whileHover={{ y: -2, scale: 1.02 }}
                            className={`rounded-2xl border ${entry.colors} p-2.5 shadow-sm hover:shadow-md transition-all duration-200`}
                        >
                            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-75">
                                {entry.label}
                            </div>
                            <div className="text-sm font-mono font-bold">{formatTime(entry.value)}</div>
                            {entry.note && (
                                <div className="text-[10px] font-semibold tracking-wider text-slate-600 uppercase mt-1">
                                    {entry.note}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Primary Action Section */}
            {!attendance?.exit_time && !hasActiveException && (
                <div className="mb-4">
                    <div className="text-center mb-2">
                        <h4 className="text-[11px] font-semibold text-slate-600 mb-2 uppercase tracking-widest">Acción Principal</h4>
                    </div>
                    {attendance?.entry_time ? (
                        <Button
                            onClick={() =>
                                attendance?.lunch_start_time && !attendance?.lunch_end_time
                                    ? handle(clockInLunch, "Regresaste del almuerzo")
                                    : attendance?.lunch_end_time
                                        ? handle(clockOut, "Buen trabajo!", true)
                                        : handle(clockOutLunch, "Buen provecho")
                            }
                            disabled={loading || locationLoading}
                            className="w-full py-3 rounded-2xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/15 transition-all duration-200"
                        >
                            {loading ? "⏳ Registrando..." :
                                locationLoading ? "📍 Obteniendo ubicación..." :
                                    attendance?.lunch_start_time && !attendance?.lunch_end_time
                                        ? "🍽️ Regresar de Almuerzo"
                                        : attendance?.lunch_end_time
                                            ? "🏁 Finalizar Jornada"
                                            : "🍽️ Salir a Almuerzo"}
                        </Button>
                    ) : (
                        <Button
                            onClick={() => handle(clockIn, "Entrada registrada")}
                            disabled={loading || locationLoading}
                            className="w-full py-3 rounded-2xl font-semibold text-sm bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-md shadow-emerald-500/15 transition-all duration-200"
                        >
                            {loading ? "⏳ Registrando entrada..." :
                                locationLoading ? "📍 Obteniendo ubicación..." :
                                    "🚀 Marcar Entrada"}
                        </Button>
                    )}
                </div>
            )}

            {/* Secondary Actions Section */}
            <div className="space-y-3">
                {renderExceptionControls()}
            </div>

            <AnimatePresence>
                {showCelebration && (
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
                    >
                        <div className="text-4xl font-bold text-blue-600">Â¡Listo!</div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Modal
                isOpen={exceptionModalOpen}
                onClose={() => setExceptionModalOpen(false)}
                title="🚨 Registrar Salida Inesperada"
                className="max-w-md"
            >
                <div className="space-y-5">
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-sm text-amber-800">
                            📝 Registra tu salida por motivos excepcionales para mantener trazabilidad.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                            🎯 Tipo de Salida
                        </label>
                        <select
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                            value={exceptionType}
                            onChange={(e) => setExceptionType(e.target.value)}
                        >
                            <option value="">Selecciona un motivo...</option>
                            <option value="permiso">🏠 Permiso personal</option>
                            <option value="medico">🏥 Cita médica</option>
                            <option value="proveedor">🤝 Reunión con proveedor</option>
                            <option value="otro">❓ Otro motivo</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                            📝 Descripción Detallada
                        </label>
                        <textarea
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all resize-none"
                            rows="3"
                            placeholder="Describe brevemente el motivo de tu salida..."
                            value={exceptionDescription}
                            onChange={(e) => setExceptionDescription(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            💡 Incluye detalles como destino, duración aproximada, etc.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setExceptionModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            ❌ Cancelar
                        </button>
                        <Button
                            onClick={handleRegisterException}
                            disabled={exceptionLoading}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                        >
                            {exceptionLoading ? "⏳ Registrando..." : "✅ Registrar Salida"}
                        </Button>
                    </div>
                </div>
            </Modal>

        </Card>
    );

    return (
        <>
            <div className="fixed bottom-20 right-4 z-[50] flex flex-col items-end gap-2 sm:bottom-24 sm:right-6">
                <span className="px-3 py-1 rounded-full bg-white/90 text-xs font-semibold text-blue-900 border border-white/60 shadow-sm">
                    {quickBadgeText}
                </span>
                <button
                    onClick={() => setWidgetModalOpen(true)}
                    className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/40 transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                    aria-label="Abrir asistencia"
                >
                    <span className="absolute inset-0 -z-10 rounded-full bg-blue-500/40 animate-ping" aria-hidden="true" />
                    <FiClock className="w-6 h-6" />
                </button>
            </div>
            <Modal
                isOpen={widgetModalOpen}
                onClose={() => setWidgetModalOpen(false)}
                title="Asistencia"
                className="max-w-lg mx-4"
            >
                {renderWidgetContent()}
            </Modal>
        </>
    );
};

export default AttendanceWidget;
