import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    FiShoppingCart,
    FiCheckCircle,
    FiClock,
    FiZap,
    FiPackage,
    FiTarget,
    FiActivity
} from "react-icons/fi";
import Card from "../../../../../core/ui/components/Card";
import { getEquipmentPurchaseStats } from "../../../../../core/api/equipmentPurchasesApi";
import { RequestActionButton } from "../../../../../core/ui/components/RequestActionCards";
import { usePurchaseSSE } from "../../../../../core/hooks/usePurchaseSSE";

const STATUS_OVERVIEW = [
    { key: "waiting_provider_response", label: "Esperando respuesta de proveedor" },
    { key: "waiting_proforma", label: "Solicitando proforma" },
    { key: "proforma_received", label: "Proforma recibida" },
    { key: "waiting_signed_proforma", label: "Reservado y esperando proforma firmada" },
    { key: "pending_contract", label: "Pendiente contrato" },
    { key: "completed", label: "Completado" },
];

export const OverviewSection = () => {
    const [stats, setStats] = useState({});
    const [loadingStats, setLoadingStats] = useState(false);

    const loadStats = useCallback(async () => {
        setLoadingStats(true);
        try {
            const data = await getEquipmentPurchaseStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoadingStats(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleStatsRefresh = useCallback(() => {
        loadStats();
    }, [loadStats]);

    usePurchaseSSE({
        type: "public",
        onEvent: handleStatsRefresh,
        debounceMs: 8000
    });

    const totalRequests = stats?.total ?? 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
        >
            {/* KPIs Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 border-0 shadow-xl shadow-blue-100/50 rounded-2xl bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Total Solicitudes</p>
                            <p className="text-3xl font-bold text-blue-900 mt-2">{totalRequests}</p>
                            <p className="text-xs text-blue-700 mt-1">Compras públicas activas</p>
                        </div>
                        <div className="p-3 bg-blue-600 rounded-xl">
                            <FiShoppingCart className="text-white" size={24} />
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-0 shadow-xl shadow-green-100/50 rounded-2xl bg-gradient-to-br from-green-50 via-green-100 to-green-200 border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-green-800 uppercase tracking-wide">Completadas</p>
                            <p className="text-3xl font-bold text-green-900 mt-2">{stats?.completed ?? 0}</p>
                            <p className="text-xs text-green-700 mt-1">Solicitudes finalizadas</p>
                        </div>
                        <div className="p-3 bg-green-600 rounded-xl">
                            <FiCheckCircle className="text-white" size={24} />
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-0 shadow-xl shadow-yellow-100/50 rounded-2xl bg-gradient-to-br from-yellow-50 via-yellow-100 to-yellow-200 border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-yellow-800 uppercase tracking-wide">En Proceso</p>
                            <p className="text-3xl font-bold text-yellow-900 mt-2">
                                {(stats?.waiting_provider_response ?? 0) +
                                    (stats?.waiting_proforma ?? 0) +
                                    (stats?.pending_contract ?? 0)}
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">Esperando acciones</p>
                        </div>
                        <div className="p-3 bg-yellow-600 rounded-xl">
                            <FiClock className="text-white" size={24} />
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-0 shadow-xl shadow-indigo-100/50 rounded-2xl bg-gradient-to-br from-indigo-50 via-indigo-100 to-indigo-200 border-l-4 border-indigo-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-indigo-800 uppercase tracking-wide">Eficiencia</p>
                            <p className="text-3xl font-bold text-indigo-900 mt-2">
                                {totalRequests > 0 ? Math.round(((stats?.completed ?? 0) / totalRequests) * 100) : 0}%
                            </p>
                            <p className="text-xs text-indigo-700 mt-1">Tasa de completación</p>
                        </div>
                        <div className="p-3 bg-indigo-600 rounded-xl">
                            <FiZap className="text-white" size={24} />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Estado Detallado */}
            <Card className="p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Estado de Solicitudes</h3>
                        <p className="text-slate-600 mt-1">Distribución detallada por estado del proceso</p>
                    </div>
                    <RequestActionButton type="PUBLIC_PURCHASE" size="sm" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {STATUS_OVERVIEW.map((item, index) => (
                        <motion.div
                            key={item.key}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                        >
                            <div>
                                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                                <p className="text-xs text-slate-600">Estado del proceso</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-slate-900">{stats?.[item.key] ?? 0}</p>
                                <p className="text-xs text-slate-500">solicitudes</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </Card>

            {/* Actividad Reciente */}
            <Card className="p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-slate-100 rounded-lg">
                        <FiActivity className="text-slate-600" size={20} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Actividad Reciente</h3>
                        <p className="text-slate-600 mt-1">Últimas actualizaciones en el proceso de compras</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-lg">
                                <FiPackage className="text-blue-600" size={16} />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">
                                    Proforma Recibida
                                </p>
                                <p className="text-sm text-slate-600">
                                    Proveedor ABC envió cotización completa
                                </p>
                            </div>
                        </div>
                        <FiCheckCircle className="text-green-600" size={20} />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-lg">
                                <FiTarget className="text-yellow-600" size={16} />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">
                                    Inspección Programada
                                </p>
                                <p className="text-sm text-slate-600">
                                    Equipo técnico asignado para mañana
                                </p>
                            </div>
                        </div>
                        <FiClock className="text-yellow-600" size={20} />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-lg">
                                <FiShoppingCart className="text-indigo-600" size={16} />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">
                                    Contrato Firmado
                                </p>
                                <p className="text-sm text-slate-600">
                                    Solicitud #123 completada exitosamente
                                </p>
                            </div>
                        </div>
                        <FiCheckCircle className="text-green-600" size={20} />
                    </motion.div>
                </div>
            </Card>
        </motion.div>
    );
};
