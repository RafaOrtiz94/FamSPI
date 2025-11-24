import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiClock, FiCoffee, FiLogOut, FiCheckCircle, FiSun, FiMoon } from "react-icons/fi";
import confetti from "canvas-confetti";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import { useUI } from "../../../core/ui/useUI";
import {
    clockOutLunch,
    clockInLunch,
    clockOut,
    getTodayAttendance,
} from "../../../core/api/attendanceApi";

/**
 * AttendanceWidget Component - Enhanced Interactive Version
 * ----------------------------------------------------------
 * 🎮 Gamified attendance tracking with:
 * - Auto clock-in on login
 * - Interactive buttons with animations
 * - Progress bar showing work day completion
 * - Celebration effects on milestones
 * - Time tracking with visual feedback
 */
const AttendanceWidget = () => {
    const { showToast } = useUI();
    const [attendance, setAttendance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showCelebration, setShowCelebration] = useState(false);

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Load today's attendance on mount
    useEffect(() => {
        loadAttendance();
    }, []);

    const loadAttendance = async () => {
        try {
            const data = await getTodayAttendance();
            setAttendance(data.data);
        } catch (err) {
            console.error("Error loading attendance:", err);
        }
    };

    const celebrate = () => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#10b981", "#3b82f6", "#f59e0b"],
        });
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
    };

    const handleClockOutLunch = async () => {
        setLoading(true);
        try {
            const result = await clockOutLunch();
            if (result.ok) {
                showToast("¡Buen provecho! 🍽️", "success");
                await loadAttendance();
            }
        } catch (err) {
            showToast(err.message || "Error registrando salida a almuerzo", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleClockInLunch = async () => {
        setLoading(true);
        try {
            const result = await clockInLunch();
            if (result.ok) {
                showToast("¡De vuelta al trabajo! 💪", "success");
                await loadAttendance();
            }
        } catch (err) {
            showToast(err.message || "Error registrando regreso de almuerzo", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleClockOut = async () => {
        setLoading(true);
        try {
            const result = await clockOut();
            if (result.ok) {
                celebrate();
                showToast("¡Excelente día de trabajo! 🎉", "success");
                await loadAttendance();
            }
        } catch (err) {
            showToast(err.message || "Error registrando salida", "error");
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return "---";
        return new Date(timestamp).toLocaleTimeString("es-EC", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    };

    const calculateProgress = () => {
        if (!attendance?.entry_time) return 0;

        const entry = new Date(attendance.entry_time);
        const now = new Date();
        const workDayHours = 8; // 8 hour work day
        const elapsedMs = now - entry;
        const elapsedHours = elapsedMs / (1000 * 60 * 60);

        // Subtract lunch time if applicable
        let lunchMs = 0;
        if (attendance.lunch_start_time && attendance.lunch_end_time) {
            lunchMs = new Date(attendance.lunch_end_time) - new Date(attendance.lunch_start_time);
        } else if (attendance.lunch_start_time && !attendance.lunch_end_time) {
            lunchMs = now - new Date(attendance.lunch_start_time);
        }

        const workHours = (elapsedMs - lunchMs) / (1000 * 60 * 60);
        const progress = Math.min((workHours / workDayHours) * 100, 100);

        return Math.round(progress);
    };

    const getStatusInfo = () => {
        if (!attendance?.entry_time) {
            return {
                message: "¡Bienvenido! Tu entrada se registró automáticamente 🎉",
                color: "text-blue-600",
                icon: <FiSun className="text-yellow-500" size={24} />,
            };
        }
        if (attendance.exit_time) {
            return {
                message: "¡Día completado! Descansa bien 🌙",
                color: "text-green-600",
                icon: <FiMoon className="text-indigo-500" size={24} />,
            };
        }
        if (attendance.lunch_start_time && !attendance.lunch_end_time) {
            return {
                message: "En almuerzo 🍽️",
                color: "text-orange-500",
                icon: <FiCoffee className="text-orange-500" size={24} />,
            };
        }
        if (attendance.lunch_end_time) {
            return {
                message: "¡Sigue así! 💪",
                color: "text-blue-600",
                icon: <FiCheckCircle className="text-blue-500" size={24} />,
            };
        }
        return {
            message: "Jornada en progreso ⚡",
            color: "text-blue-600",
            icon: <FiClock className="text-blue-500" size={24} />,
        };
    };

    const getNextAction = () => {
        if (!attendance?.entry_time) {
            return (
                <div className="text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
                    <p className="text-sm text-green-700 font-medium">
                        ✅ Tu entrada fue registrada automáticamente al iniciar sesión
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                        {formatTime(attendance?.entry_time || new Date())}
                    </p>
                </div>
            );
        }

        if (attendance.exit_time) {
            return (
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200"
                >
                    <FiCheckCircle className="text-green-500 text-4xl mx-auto mb-2" />
                    <p className="text-lg font-bold text-gray-800">¡Jornada completada!</p>
                    <p className="text-sm text-gray-600 mt-1">Hasta mañana 👋</p>
                </motion.div>
            );
        }

        if (attendance.lunch_end_time) {
            return (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                        variant="danger"
                        icon={FiLogOut}
                        onClick={handleClockOut}
                        disabled={loading}
                        className="w-full py-3 text-base font-semibold bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600"
                    >
                        🏁 Marcar Salida
                    </Button>
                </motion.div>
            );
        }

        if (attendance.lunch_start_time) {
            return (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                        variant="success"
                        icon={FiCheckCircle}
                        onClick={handleClockInLunch}
                        disabled={loading}
                        className="w-full py-3 text-base font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                        🔙 Regresar de Almuerzo
                    </Button>
                </motion.div>
            );
        }

        return (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                    variant="warning"
                    icon={FiCoffee}
                    onClick={handleClockOutLunch}
                    disabled={loading}
                    className="w-full py-3 text-base font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                >
                    🍽️ Salir a Almuerzo
                </Button>
            </motion.div>
        );
    };

    const statusInfo = getStatusInfo();
    const progress = calculateProgress();

    return (
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-white to-blue-50 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {statusInfo.icon}
                    <h3 className="text-base font-bold text-gray-900">Mi Asistencia</h3>
                </div>
                <div className="text-lg font-mono font-bold text-blue-600">
                    {currentTime.toLocaleTimeString("es-EC", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                    })}
                </div>
            </div>

            {/* Status Message */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-center text-sm font-semibold mb-3 ${statusInfo.color}`}
            >
                {statusInfo.message}
            </motion.div>

            {/* Progress Bar */}
            {attendance?.entry_time && !attendance?.exit_time && (
                <div className="mb-4">
                    <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                        <span>Progreso del día</span>
                        <span className="font-bold">{progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full bg-gradient-to-r from-blue-500 to-green-500"
                        />
                    </div>
                </div>
            )}

            {/* Time Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="bg-white rounded-lg p-2 shadow-sm border border-green-100"
                >
                    <div className="text-gray-500 text-[10px] mb-1 font-medium">✅ Entrada</div>
                    <div className="font-bold text-sm text-green-600">
                        {formatTime(attendance?.entry_time)}
                    </div>
                </motion.div>

                <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="bg-white rounded-lg p-2 shadow-sm border border-orange-100"
                >
                    <div className="text-gray-500 text-[10px] mb-1 font-medium">🍽️ Almuerzo</div>
                    <div className="font-bold text-sm text-orange-600">
                        {formatTime(attendance?.lunch_start_time)}
                    </div>
                </motion.div>

                <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="bg-white rounded-lg p-2 shadow-sm border border-blue-100"
                >
                    <div className="text-gray-500 text-[10px] mb-1 font-medium">🔙 Regreso</div>
                    <div className="font-bold text-sm text-blue-600">
                        {formatTime(attendance?.lunch_end_time)}
                    </div>
                </motion.div>

                <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="bg-white rounded-lg p-2 shadow-sm border border-red-100"
                >
                    <div className="text-gray-500 text-[10px] mb-1 font-medium">🏁 Salida</div>
                    <div className="font-bold text-sm text-red-600">
                        {formatTime(attendance?.exit_time)}
                    </div>
                </motion.div>
            </div>

            {/* Action Button */}
            {getNextAction()}

            {/* Celebration Animation */}
            <AnimatePresence>
                {showCelebration && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
                    >
                        <div className="text-6xl">🎉</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
};

export default AttendanceWidget;
