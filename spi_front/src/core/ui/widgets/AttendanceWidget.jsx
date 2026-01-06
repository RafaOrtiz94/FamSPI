import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiClock, FiCoffee, FiSun, FiMoon, FiAlertTriangle, FiTrendingUp, FiPlus } from "react-icons/fi";
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
    markOvertime,
    getOvertimeRecords,
} from "../../api/attendanceApi";
import { useAutoUpdate } from "../../api/index";

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

    // Overtime state
    const [overtimeModalOpen, setOvertimeModalOpen] = useState(false);
    const [overtimeHours, setOvertimeHours] = useState("");
    const [overtimeReason, setOvertimeReason] = useState("");
    const [overtimeLoading, setOvertimeLoading] = useState(false);
    const [overtimeRecords, setOvertimeRecords] = useState([]);

    // Geolocation state
    const [locationLoading, setLocationLoading] = useState(false);
    const [cachedLocation, setCachedLocation] = useState(null);
    const [locationTimestamp, setLocationTimestamp] = useState(null);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        refreshAll();
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
    const formatTime = (ts) =>
        ts
            ? new Date(ts).toLocaleTimeString("es-EC", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            })
            : "--:--";

    const formatDateTime = (ts) =>
        ts
            ? new Date(ts).toLocaleString("es-EC", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
            })
            : "--:--";

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
        if (!attendance?.entry_time) return 0;

        const now = new Date();
        const entry = new Date(attendance.entry_time);
        let workedMs = now - entry;

        if (attendance.lunch_start_time) {
            const lunchStart = new Date(attendance.lunch_start_time);
            const lunchEnd = attendance.lunch_end_time ? new Date(attendance.lunch_end_time) : now;
            workedMs -= lunchEnd - lunchStart;
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

    /**
     * Optimized overtime registration with background geolocation
     */
    const handleMarkOvertime = async () => {
        const hours = parseFloat(overtimeHours);
        if (!hours || hours <= 0) {
            showToast("Ingresa horas válidas de overtime", "error");
            return;
        }

        if (!overtimeReason.trim()) {
            showToast("Ingresa una razón para el overtime", "error");
            return;
        }

        setOvertimeLoading(true);
        try {
            // Start geolocation in background
            const locationPromise = getLocation(false);

            const res = await markOvertime(hours, overtimeReason.trim(), await locationPromise);
            if (res.ok) {
                showToast(`Overtime de ${hours}h registrado correctamente`, "success");
                setOvertimeModalOpen(false);
                setOvertimeHours("");
                setOvertimeReason("");
            } else {
                showToast("Error registrando overtime", "error");
            }
        } catch (err) {
            console.error("Overtime registration error:", err);
            const msg = err.response?.data?.message || err.message || "Error registrando overtime";
            showToast(msg, "error");
        } finally {
            setOvertimeLoading(false);
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

    return (
        <Card className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/20 backdrop-blur-xl shadow-xl shadow-blue-500/10 border border-white/50 p-6">
            {/* Header Section */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100/80">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 shadow-sm">
                        {status.icon}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 tracking-tight">Asistencia de Hoy</h3>
                        <p className="text-sm text-gray-600 font-medium">{status.text}</p>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Hora Actual</div>
                    <div className="text-lg font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg">
                        {currentTime.toLocaleTimeString("es-EC", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                        })}
                    </div>
                </div>
            </div>

            {/* Progress Section */}
            {attendance?.entry_time && !attendance?.exit_time && (
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 rounded-xl border border-blue-100/50">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <FiTrendingUp className="text-blue-600" size={16} />
                            <span className="text-sm font-semibold text-blue-900">Progreso del Día</span>
                        </div>
                        <span className="text-lg font-bold text-blue-700">{progress}%</span>
                    </div>
                    <div className="h-4 bg-blue-100/60 rounded-full overflow-hidden shadow-inner">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ type: "spring", stiffness: 120, damping: 20 }}
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 shadow-sm"
                        />
                    </div>
                    <div className="text-xs text-blue-600/80 mt-2 text-center font-medium">
                        Jornada laboral de 8 horas
                    </div>
                </div>
            )}

            {renderExceptionBanner()}

            {/* Time Records Grid */}
            <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FiClock className="text-gray-600" size={16} />
                    Registro de Tiempos
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    {[
                        ["Entrada", attendance?.entry_time, "bg-emerald-50 border-emerald-200 text-emerald-800"],
                        ["Salida Almuerzo", attendance?.lunch_start_time, "bg-orange-50 border-orange-200 text-orange-800"],
                        ["Entrada Almuerzo", attendance?.lunch_end_time, "bg-blue-50 border-blue-200 text-blue-800"],
                        ["Salida", attendance?.exit_time, "bg-indigo-50 border-indigo-200 text-indigo-800"],
                    ].map(([label, time, colors]) => (
                        <motion.div
                            key={label}
                            whileHover={{ y: -2, scale: 1.02 }}
                            className={`rounded-xl border ${colors} p-4 shadow-sm hover:shadow-md transition-all duration-200`}
                        >
                            <div className="text-xs font-medium uppercase tracking-wider mb-1 opacity-75">
                                {label}
                            </div>
                            <div className="text-lg font-mono font-bold">{formatTime(time)}</div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Primary Action Section */}
            {!attendance?.exit_time && !hasActiveException && (
                <div className="mb-6">
                    <div className="text-center mb-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3">Acción Principal</h4>
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
                            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/25 transform hover:scale-[1.02] transition-all duration-200"
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
                            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-xl shadow-emerald-500/25 transform hover:scale-[1.02] transition-all duration-200"
                        >
                            {loading ? "⏳ Registrando entrada..." :
                             locationLoading ? "📍 Obteniendo ubicación..." :
                             "🚀 Marcar Entrada"}
                        </Button>
                    )}
                </div>
            )}

            {/* Secondary Actions Section */}
            <div className="space-y-4">
                {renderExceptionControls()}

                {/* Overtime Section */}
                {attendance?.is_overtime && attendance?.overtime_hours > 0 && (
                    <div className="p-4 bg-gradient-to-r from-orange-50 via-yellow-50 to-orange-50 rounded-xl border border-orange-200/60 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <FiTrendingUp className="text-orange-600" size={16} />
                                </div>
                                <div>
                                    <h5 className="text-sm font-bold text-orange-900 uppercase tracking-wider">
                                        Tiempo Extra Registrado
                                    </h5>
                                    <p className="text-xs text-orange-700">Horas adicionales trabajadas</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-mono font-bold text-orange-700">
                                    +{attendance.overtime_hours.toFixed(1)}h
                                </div>
                            </div>
                        </div>
                        <div className="text-xs text-orange-700/90 bg-orange-100/50 p-2 rounded-lg">
                            ✅ Has trabajado horas adicionales hoy. Esto será considerado en tu registro de asistencia.
                        </div>
                    </div>
                )}

                {/* Overtime Controls */}
                {attendance?.entry_time && !attendance?.exit_time && !hasActiveException && (
                    <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200/60 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                    <FiPlus className="text-gray-600" size={16} />
                                </div>
                                <div>
                                    <h5 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                                        Registrar Overtime
                                    </h5>
                                    <p className="text-xs text-gray-600">Tiempo extra manual</p>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-600 mb-4 bg-gray-100/50 p-2 rounded-lg">
                            📊 Si trabajas tiempo extra, regístralo aquí para mantener un registro preciso.
                        </p>
                        <Button
                            onClick={() => setOvertimeModalOpen(true)}
                            className="w-full py-2.5 bg-gray-700 hover:bg-gray-800 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                            disabled={loading}
                        >
                            ⚡ Registrar Overtime Manual
                        </Button>
                    </div>
                )}
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

            <Modal
                isOpen={overtimeModalOpen}
                onClose={() => setOvertimeModalOpen(false)}
                title="⚡ Registrar Tiempo Extra"
                className="max-w-md"
            >
                <div className="space-y-5">
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-sm text-orange-800">
                            🕐 Registra las horas extras trabajadas para mantener un control preciso.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                            ⏰ Horas Trabajadas
                        </label>
                        <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="12"
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                            placeholder="Ej: 2.5"
                            value={overtimeHours}
                            onChange={(e) => setOvertimeHours(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            🔢 Mínimo 0.5 horas, máximo 12 horas por día
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                            📋 Razón del Tiempo Extra
                        </label>
                        <textarea
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none"
                            rows="3"
                            placeholder="Describe por qué trabajaste tiempo extra..."
                            value={overtimeReason}
                            onChange={(e) => setOvertimeReason(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            💼 Ej: Proyecto urgente, soporte técnico, capacitación, etc.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setOvertimeModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            ❌ Cancelar
                        </button>
                        <Button
                            onClick={handleMarkOvertime}
                            disabled={overtimeLoading}
                            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                        >
                            {overtimeLoading ? "⏳ Registrando..." : "⚡ Registrar Overtime"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </Card>
    );
};

export default AttendanceWidget;
