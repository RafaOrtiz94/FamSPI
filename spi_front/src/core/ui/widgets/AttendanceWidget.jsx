import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiClock, FiCoffee, FiSun, FiMoon, FiAlertTriangle } from "react-icons/fi";
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

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
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

        const getLocation = () =>
        new Promise((resolve) => {
            if (!navigator.geolocation) {
                showToast("Geolocalizacion no soportada por el navegador", "error");
                return resolve(null);
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc = `${pos.coords.latitude},${pos.coords.longitude}`;
                    resolve(loc);
                },
                (err) => {
                    console.error("Error de geolocalizacion:", err);
                    let msg = "No se pudo obtener ubicacion.";
                    if (err.code === 1) msg = "Permiso de ubicacion denegado.";
                    if (err.code === 2) msg = "Ubicacion no disponible.";
                    if (err.code === 3) msg = "Tiempo de espera agotado al obtener ubicacion.";
                    showToast(msg + " No se registrara el evento sin ubicacion.", "warning");
                    resolve(null);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
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

    const handle = async (fn, successMsg, celebrateDay = false) => {
        setLoading(true);
        try {
            const loc = await getLocation();
            if (!loc) {
                setLoading(false);
                return;
            }
            const res = await fn(loc);
            if (res.ok) {
                if (celebrateDay) celebrate();
                showToast(successMsg, "success");
                await refreshAll();
            }
        } catch (err) {
            showToast(err.message || "Error", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterException = async () => {
        const finalType = exceptionType || "otro";
        const finalDescription = exceptionDescription || "Salida inesperada";

        setExceptionLoading(true);
        try {
            const loc = await getLocation();
            if (!loc) {
                setExceptionLoading(false);
                return;
            }
            const res = await registerException(finalType, finalDescription, loc);
            if (res.ok) {
                showToast("Salida registrada. Notifica tu llegada.", "success");
                setExceptionModalOpen(false);
                setExceptionType("");
                setExceptionDescription("");
                await refreshAll();
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Error";
            showToast(msg, "error");
        } finally {
            setExceptionLoading(false);
        }
    };

    const handleExceptionUpdate = async (status, successMsg) => {
        setLoading(true);
        try {
            const loc = await getLocation();
            if (!loc) {
                setLoading(false);
                return;
            }
            const res = await updateExceptionStatus(status, loc);
            if (res.ok) {
                showToast(successMsg, "success");
                await refreshAll();
            }
        } catch (err) {
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

    const renderExceptionBanner = () => {
        if (!hasActiveException) return null;
        const items = [
            { label: "Salida de oficina", value: activeException.start_time },
            { label: "Llegada a destino", value: activeException.arrival_time },
            { label: "Salida de destino", value: activeException.departure_time },
            { label: "Regreso a oficina", value: activeException.return_time },
        ];

        return (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-amber-800">
                        <FiAlertTriangle />
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide">Salida inesperada</p>
                            <p className="text-sm font-bold">{exceptionStepLabel}</p>
                        </div>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-white text-amber-700 border border-amber-200">
                        {activeException.type}
                    </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-amber-800">
                    {items.map((item) => (
                        <div
                            key={item.label}
                            className="flex flex-col rounded-lg bg-white/60 px-2 py-2 border border-amber-100"
                        >
                            <span className="text-[11px] uppercase font-semibold">{item.label}</span>
                            <span className="font-mono">{formatDateTime(item.value)}</span>
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
        <Card className="relative overflow-hidden rounded-2xl bg bg-white/70 backdrop-blur-xl shadow-lg shadow-blue-500/5 p-5">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10">{status.icon}</div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">Asistencia de Hoy</h3>
                        <p className="text-xs text-gray-500">{status.text}</p>
                    </div>
                </div>

                <div className="text-sm font-mono font-semibold text-blue-600">
                    {currentTime.toLocaleTimeString("es-EC", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                    })}
                </div>
            </div>

            {attendance?.entry_time && !attendance?.exit_time && (
                <div className="mb-5">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progreso del dia</span>
                        <span className="font-semibold">{progress}%</span>
                    </div>
                    <div className="h-3 bg-gray-200/60 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ type: "spring", stiffness: 120 }}
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"
                        />
                    </div>
                </div>
            )}

            {renderExceptionBanner()}

            <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                    ["Entrada", attendance?.entry_time, "In"],
                    ["Almuerzo", attendance?.lunch_start_time, "Alm"],
                    ["Regreso", attendance?.lunch_end_time, "Reg"],
                    ["Salida", attendance?.exit_time, "Out"],
                ].map(([label, time, icon]) => (
                    <motion.div key={label} whileHover={{ y: -2 }} className="rounded-xl bg-white/60 p-3 shadow-sm">
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                            <span>{icon}</span>
                            {label}
                        </div>
                        <div className="text-sm font-semibold text-gray-800">{formatTime(time)}</div>
                    </motion.div>
                ))}
            </div>

            {!attendance?.exit_time && !hasActiveException && (
                attendance?.entry_time ? (
                    <Button
                        onClick={() =>
                            attendance?.lunch_start_time && !attendance?.lunch_end_time
                                ? handle(clockInLunch, "Regresaste del almuerzo")
                                : attendance?.lunch_end_time
                                    ? handle(clockOut, "Buen trabajo!", true)
                                    : handle(clockOutLunch, "Buen provecho")
                        }
                        disabled={loading}
                        className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/20"
                    >
                        {attendance?.lunch_start_time && !attendance?.lunch_end_time
                            ? "Regresar de Almuerzo"
                            : attendance?.lunch_end_time
                                ? "Finalizar Jornada"
                                : "Salir a Almuerzo"}
                    </Button>
                ) : (
                    <Button
                        onClick={() => handle(clockIn, "Entrada registrada")}
                        disabled={loading}
                        className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg shadow-emerald-500/20"
                    >
                        Marcar entrada
                    </Button>
                )
            )}

            {renderExceptionControls()}

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

            <Modal isOpen={exceptionModalOpen} onClose={() => setExceptionModalOpen(false)} title="Registrar salida inesperada">
                <div className="space-y-4">
                    <select
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={exceptionType}
                        onChange={(e) => setExceptionType(e.target.value)}
                    >
                        <option value="">Motivo</option>
                        <option value="permiso">Permiso</option>
                        <option value="medico">Cita medica</option>
                        <option value="proveedor">Proveedor</option>
                        <option value="otro">Otro</option>
                    </select>

                    <textarea
                        className="w-full border rounded-lg px-3 py-2 text-sm h-24"
                        placeholder="Describe la salida..."
                        value={exceptionDescription}
                        onChange={(e) => setExceptionDescription(e.target.value)}
                    />

                    <div className="flex justify-end gap-2">
                        <button onClick={() => setExceptionModalOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">
                            Cancelar
                        </button>
                        <Button onClick={handleRegisterException} disabled={exceptionLoading}>
                            Registrar
                        </Button>
                    </div>
                </div>
            </Modal>
        </Card>
    );
};

export default AttendanceWidget;
