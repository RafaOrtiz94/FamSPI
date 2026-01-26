import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    FiBarChart2,
    FiTrendingUp,
    FiTrendingDown,
    FiTarget,
    FiClock,
    FiCheckCircle,
    FiAlertTriangle
} from "react-icons/fi";
import Card from "../../../../../core/ui/components/Card";
import { getEquipmentPurchaseStats } from "../../../../../core/api/equipmentPurchasesApi";

export const AnalyticsSection = () => {
    const [stats, setStats] = useState({});
    const [loadingStats, setLoadingStats] = useState(false);

    const loadStats = useCallback(async () => {
        setLoadingStats(true);
        try {
            const data = await getEquipmentPurchaseStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading analytics stats:', error);
        } finally {
            setLoadingStats(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const totalRequests = stats?.total ?? 0;
    const completedRequests = stats?.completed ?? 0;
    const completionRate = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;

    // Métricas calculadas
    const activeRequests = (stats?.waiting_provider_response ?? 0) +
        (stats?.waiting_proforma ?? 0) +
        (stats?.pending_contract ?? 0);

    const efficiencyMetrics = [
        {
            title: "Tasa de Completación",
            value: `${completionRate}%`,
            change: "+12%",
            trend: "up",
            icon: FiTarget,
            color: "from-purple-500 to-purple-600",
            bgColor: "from-purple-50 to-purple-100"
        },
        {
            title: "Tiempo Promedio",
            value: "24 días",
            change: "-8%",
            trend: "up",
            icon: FiClock,
            color: "from-blue-500 to-blue-600",
            bgColor: "from-blue-50 to-blue-100"
        },
        {
            title: "Solicitudes Activas",
            value: activeRequests.toString(),
            change: "+5",
            trend: "down",
            icon: FiTrendingUp,
            color: "from-orange-500 to-orange-600",
            bgColor: "from-orange-50 to-orange-100"
        },
        {
            title: "Eficiencia Global",
            value: "87%",
            change: "+3%",
            trend: "up",
            icon: FiBarChart2,
            color: "from-green-500 to-green-600",
            bgColor: "from-green-50 to-green-100"
        }
    ];

    const statusBreakdown = [
        { status: "Completadas", count: completedRequests, percentage: totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0, color: "bg-green-500" },
        { status: "En Proceso", count: activeRequests, percentage: totalRequests > 0 ? Math.round((activeRequests / totalRequests) * 100) : 0, color: "bg-yellow-500" },
        { status: "Pendientes", count: stats?.waiting_provider_response ?? 0, percentage: totalRequests > 0 ? Math.round(((stats?.waiting_provider_response ?? 0) / totalRequests) * 100) : 0, color: "bg-blue-500" }
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
        >
            {/* Header de Analytics */}
            <Card className="p-6 border-0 shadow-xl shadow-purple-100/50 rounded-2xl bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-purple-900">Análisis de Compras Públicas</h2>
                        <p className="text-purple-700 mt-1">Métricas detalladas del rendimiento del proceso ACP</p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-purple-600">
                            Análisis en tiempo real
                        </div>
                    </div>
                </div>
            </Card>

            {/* Métricas Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {efficiencyMetrics.map((metric, index) => {
                    const Icon = metric.icon;
                    const TrendIcon = metric.trend === 'up' ? FiTrendingUp : FiTrendingDown;

                    return (
                        <motion.div
                            key={metric.title}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className={`p-6 border-0 shadow-xl shadow-purple-100/50 rounded-2xl bg-gradient-to-br ${metric.bgColor} border-l-4 border-purple-400`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-purple-800 uppercase tracking-wide">{metric.title}</p>
                                        <p className="text-3xl font-bold text-purple-900 mt-2">{metric.value}</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <TrendIcon className={`text-xs ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`} />
                                            <span className={`text-xs font-medium ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                                {metric.change}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`p-3 bg-gradient-to-br ${metric.color} rounded-xl shadow-lg`}>
                                        <Icon className="text-white" size={24} />
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            {/* Análisis Detallado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Distribución por Estado */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card className="p-6 border-0 shadow-xl shadow-purple-100/60 rounded-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <FiBarChart2 className="text-purple-600" size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-purple-900">Distribución por Estado</h3>
                                <p className="text-purple-600 mt-1">Análisis porcentual del estado de solicitudes</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {statusBreakdown.map((item, index) => (
                                <motion.div
                                    key={item.status}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + index * 0.1 }}
                                    className="flex items-center justify-between p-4 bg-purple-50 rounded-xl"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded-full ${item.color}`}></div>
                                        <span className="font-medium text-purple-900">{item.status}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-purple-900">{item.count}</div>
                                        <div className="text-sm text-purple-600">{item.percentage}%</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </Card>
                </motion.div>

                {/* Insights y Recomendaciones */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <Card className="p-6 border-0 shadow-xl shadow-purple-100/60 rounded-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <FiTarget className="text-purple-600" size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-purple-900">Insights y Recomendaciones</h3>
                                <p className="text-purple-600 mt-1">Análisis inteligente del proceso</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.7 }}
                                className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border border-green-200"
                            >
                                <div className="flex items-start gap-3">
                                    <FiCheckCircle className="text-green-600 mt-1" size={18} />
                                    <div>
                                        <h4 className="font-semibold text-green-900">Excelente Tasa de Completación</h4>
                                        <p className="text-sm text-green-700 mt-1">La eficiencia del proceso se mantiene por encima del 85%</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.8 }}
                                className="p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200"
                            >
                                <div className="flex items-start gap-3">
                                    <FiAlertTriangle className="text-yellow-600 mt-1" size={18} />
                                    <div>
                                        <h4 className="font-semibold text-yellow-900">Optimización de Tiempos</h4>
                                        <p className="text-sm text-yellow-700 mt-1">24 solicitudes esperan respuesta de proveedores por más de 15 días</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.9 }}
                                className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200"
                            >
                                <div className="flex items-start gap-3">
                                    <FiTrendingUp className="text-blue-600 mt-1" size={18} />
                                    <div>
                                        <h4 className="font-semibold text-blue-900">Tendencia Positiva</h4>
                                        <p className="text-sm text-blue-700 mt-1">Reducción del 8% en tiempos de respuesta promedio</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </motion.div>
    );
};
