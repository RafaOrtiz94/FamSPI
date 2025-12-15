import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FiClock,
    FiCoffee,
    FiLogOut,
    FiCheckCircle,
    FiSun,
    FiMoon,
    FiAlertTriangle,
} from "react-icons/fi";
import confetti from "canvas-confetti";

import Button from "../components/Button";
import Card from "../components/Card";
import Modal from "../components/Modal";
import { useUI } from "../useUI";

import {
    clockOutLunch,
    clockInLunch,
    clockOut,
    registerException,
    getTodayAttendance,
} from "../../api/attendanceApi";

const AttendanceWidget = () => {
    const { showToast } = useUI();

    const [attendance, setAttendance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showCelebration, setShowCelebration] = useState(false);

    const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
    const [exceptionType, setExceptionType] = useState("");
    const [exceptionDescription, setExceptionDescription] = useState("");
    const [exceptionLoading, setExceptionLoading] = useState(false);

    /* -------------------------------------------------------------------------- */
    /*                               EFFECTS                                      */
    /* -------------------------------------------------------------------------- */

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        loadAttendance();
    }, []);

    /* -------------------------------------------------------------------------- */
    /*                               HELPERS                                      */
    /* -------------------------------------------------------------------------- */

    const loadAttendance = async () => {
        try {
            const res = await getTodayAttendance();
            setAttendance(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const getLocation = () =>
        new Promise((resolve) => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 5000 }
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
            const lunchEnd = attendance.lunch_end_time
                ? new Date(attendance.lunch_end_time)
                : now;
            workedMs -= lunchEnd - lunchStart;
        }

        const hours = workedMs / (1000 * 60 * 60);
        return Math.min(Math.round((hours / 8) * 100), 100);
    };

    const getStatusInfo = () => {
        if (!attendance?.entry_time)
            return {
                text: "Entrada registrada automáticamente",
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

    /* -------------------------------------------------------------------------- */
    /*                               ACTIONS                                      */
    /* -------------------------------------------------------------------------- */

    const handle = async (fn, successMsg, celebrateDay = false) => {
        setLoading(true);
        try {
            const loc = await getLocation();
            const res = await fn(loc);
            if (res.ok) {
                if (celebrateDay) celebrate();
                showToast(successMsg, "success");
                await loadAttendance();
            }
        } catch (err) {
            showToast(err.message || "Error", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterException = async () => {
        if (!exceptionType || !exceptionDescription)
            return showToast("Completa todos los campos", "warning");

        setExceptionLoading(true);
        try {
            const loc = await getLocation();
            const res = await registerException(
                exceptionType,
                exceptionDescription,
                loc
            );
            if (res.ok) {
                showToast("Excepción registrada", "success");
                setExceptionModalOpen(false);
                setExceptionType("");
                setExceptionDescription("");
            }
        } catch (err) {
            showToast(err.message || "Error", "error");
        } finally {
            setExceptionLoading(false);
        }
    };

    const progress = calculateProgress();
    const status = getStatusInfo();

    /* -------------------------------------------------------------------------- */
    /*                               RENDER                                       */
    /* -------------------------------------------------------------------------- */

    return (
        <Card className="relative overflow-hidden rounded-2xl bg bg-white/70 backdrop-blur-xl shadow-lg shadow-blue-500/5 p-5">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10">{status.icon}</div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                            Asistencia de Hoy
                        </h3>
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

            {/* Progress */}
            {attendance?.entry_time && !attendance?.exit_time && (
                <div className="mb-5">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progreso del día</span>
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

            {/* Time Grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                    ["Entrada", attendance?.entry_time, "✅"],
                    ["Almuerzo", attendance?.lunch_start_time, "🍽️"],
                    ["Regreso", attendance?.lunch_end_time, "🔙"],
                    ["Salida", attendance?.exit_time, "🏁"],
                ].map(([label, time, icon]) => (
                    <motion.div
                        key={label}
                        whileHover={{ y: -2 }}
                        className="rounded-xl bg-white/60 p-3 shadow-sm"
                    >
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                            <span>{icon}</span>
                            {label}
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
                            {formatTime(time)}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Main Action */}
            {!attendance?.exit_time && (
                <Button
                    onClick={() =>
                        attendance?.lunch_start_time && !attendance?.lunch_end_time
                            ? handle(clockInLunch, "Regresaste del almuerzo")
                            : attendance?.lunch_end_time
                                ? handle(clockOut, "¡Buen trabajo!", true)
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
            )}

            {/* Exception */}
            {attendance?.entry_time && !attendance?.exit_time && (
                <button
                    onClick={() => setExceptionModalOpen(true)}
                    className="mt-4 mx-auto flex items-center gap-1 text-xs text-gray-500 hover:text-amber-600 transition"
                >
                    <FiAlertTriangle size={12} />
                    Registrar salida inesperada
                </button>
            )}

            {/* Celebration */}
            <AnimatePresence>
                {showCelebration && (
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
                    >
                        <div className="text-6xl">🎉</div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Exception Modal */}
            <Modal
                isOpen={exceptionModalOpen}
                onClose={() => setExceptionModalOpen(false)}
                title="Registrar salida inesperada"
            >
                <div className="space-y-4">
                    <select
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={exceptionType}
                        onChange={(e) => setExceptionType(e.target.value)}
                    >
                        <option value="">Motivo</option>
                        <option value="permiso">Permiso</option>
                        <option value="medico">Cita médica</option>
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
                        <button
                            onClick={() => setExceptionModalOpen(false)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            Cancelar
                        </button>
                        <Button
                            onClick={handleRegisterException}
                            disabled={exceptionLoading}
                        >
                            Registrar
                        </Button>
                    </div>
                </div>
            </Modal>
        </Card>
    );
};

export default AttendanceWidget;
