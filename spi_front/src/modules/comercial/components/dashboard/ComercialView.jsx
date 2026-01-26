import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiClipboard, FiUsers, FiCheckSquare, FiFileText, FiCalendar, FiRefreshCw, FiShoppingCart, FiBriefcase, FiUser, FiBarChart2 } from "react-icons/fi";
import { Doughnut, Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    PointElement,
    Filler,
} from "chart.js";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import Modal from "../../../../core/ui/components/Modal";
import { DashboardHeader } from "../../../../core/ui/layouts/DashboardLayout";
import StatCard from "../../../../core/ui/patterns/StatCard";
import ChartCard from "../../../gerencia/components/ChartCard";
import PurchaseHandoffWidget from "../../components/PurchaseHandoffWidget";
import PurchaseTypeSelector from "../../../../shared/purchases/PurchaseTypeSelector";

// Register Chart.js components
ChartJS.register(
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    PointElement,
    Filler
);

// Empty state component
const EmptyChartState = ({ message = "No hay datos disponibles" }) => (
    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        {message}
    </div>
);

// Loading chart component
const LoadingChartState = () => (
    <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-gray-500 text-sm">Cargando gráfico...</div>
    </div>
);

const quickAccessLinks = [
    {
        label: "Crear Solicitud",
        description: "Compra de equipos",
        icon: FiShoppingCart,
        action: { type: "modal", target: "purchaseType" },
        color: "from-indigo-500 via-indigo-600 to-indigo-700",
    },
    {
        label: "Clientes",
        description: "Gestión desde navegación",
        icon: FiUsers,
        action: { type: "navigate", target: "/dashboard/comercial/clientes" },
        color: "from-emerald-500 via-emerald-600 to-emerald-700",
    },
    {
        label: "Solicitudes",
        description: "Historial completo",
        icon: FiClipboard,
        action: { type: "navigate", target: "/dashboard/comercial/solicitudes" },
        color: "from-sky-500 via-sky-600 to-sky-700",
    },
    {
        label: "Business Case",
        description: "Inicia y completa tu caso",
        icon: FiFileText,
        action: { type: "navigate", target: "/dashboard/business-case" },
        color: "from-orange-500 via-orange-600 to-orange-700",
    },
    {
        label: "Planificación",
        description: "Cronograma mensual",
        icon: FiCalendar,
        action: { type: "navigate", target: "/dashboard/comercial/planificacion" },
        color: "from-purple-500 via-purple-600 to-purple-700",
    },
];

const QuickAccessCard = ({ label, description, Icon, colorClasses, onClick }) => (
    <Card className="p-0">
        <button
            className="w-full h-full rounded-2xl border border-transparent bg-gradient-to-br from-white/80 to-white shadow-sm transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-300"
            onClick={onClick}
            type="button"
        >
            <div className="flex items-center gap-3 p-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${colorClasses} text-white shadow-md`}>
                    <Icon size={22} />
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{description}</p>
                </div>
            </div>
        </button>
    </Card>
);

const ComercialView = ({ onRefresh, summaryData, summaryLoading, summaryError }) => {
    const navigate = useNavigate();
    const [showPurchaseTypeModal, setShowPurchaseTypeModal] = useState(false);
    const [showPurchaseHandoff, setShowPurchaseHandoff] = useState(false);

    const handlePurchaseTypeSelection = (type) => {
        // Log TEMPORAL para debugging
        console.log('[UI_COMERCIAL][FASE2][DASHBOARD_ENTRYPOINT_CLICK]');
        // El PurchaseTypeSelector ya maneja la navegación al workspace
        // No necesitamos lógica adicional aquí
    };

    // Error state component
    const ErrorState = ({ message = "Error cargando datos", onRetry }) => (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm p-4">
            <div className="text-red-500 mb-2">⚠️</div>
            <p className="text-center mb-3">{message}</p>
            {onRetry && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                    Reintentar
                </Button>
            )}
        </div>
    );

    // Fallback data for when API is loading or fails
    const fallbackData = {
        kpis: {
            totalBC: 0,
            bcActivos: 0,
            bcCompletados: 0,
            solicitudesPendientes: 0,
            clientesNuevos30d: 0,
        },
        charts: {
            bcStatus: {
                labels: [],
                data: [],
                hasData: false
            },
            requestsMonthly: {
                labels: [],
                data: [],
                hasData: false
            }
        }
    };

    // Handle error state
    if (summaryError && !summaryLoading) {
        return (
            <ErrorState
                message="No se pudieron cargar los datos del dashboard. Verifica tu conexión."
                onRetry={onRefresh}
            />
        );
    }

    const data = summaryData?.data || fallbackData;

    // Chart configurations
    const bcStatusChartData = {
        labels: data.charts.bcStatus.labels,
        datasets: [{
            label: 'Business Cases',
            data: data.charts.bcStatus.data,
            backgroundColor: [
                '#3b82f6', // blue
                '#10b981', // emerald
                '#f59e0b', // amber
                '#ef4444', // red
                '#8b5cf6', // violet
            ],
            borderWidth: 1,
        }],
    };

    const monthlyRequestsChartData = {
        labels: data.charts.requestsMonthly.labels,
        datasets: [{
            label: 'Solicitudes',
            data: data.charts.requestsMonthly.data,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
        }],
    };

    const chartOptions = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
        },
    };

    return (
        <>
            {/* iOS Style Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
                        Panel Comercial
                    </h1>
                    <p className="text-gray-600 text-sm">
                        Resumen de tu actividad comercial
                    </p>
                </div>
                <Button
                    variant="ghost"
                    icon={FiRefreshCw}
                    onClick={onRefresh}
                    disabled={summaryLoading}
                    className="mt-4 sm:mt-0"
                    size="sm"
                >
                    {summaryLoading ? 'Actualizando...' : 'Actualizar'}
                </Button>
            </div>

            {/* iOS Style KPIs - Optimized for iPhone 13 */}
            <section className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <FiFileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-500">Total</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {summaryLoading ? '...' : data.kpis.totalBC}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Business Cases</div>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-emerald-50 rounded-xl">
                            <FiCheckSquare className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span className="text-xs text-gray-500">Activos</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {summaryLoading ? '...' : data.kpis.bcActivos}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">BC Activos</div>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-amber-50 rounded-xl">
                            <FiClipboard className="w-4 h-4 text-amber-600" />
                        </div>
                        <span className="text-xs text-gray-500">Pendientes</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {summaryLoading ? '...' : data.kpis.solicitudesPendientes}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Solicitudes</div>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-violet-50 rounded-xl">
                            <FiUsers className="w-4 h-4 text-violet-600" />
                        </div>
                        <span className="text-xs text-gray-500">Nuevos</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {summaryLoading ? '...' : data.kpis.clientesNuevos30d}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Clientes (30d)</div>
                </div>
            </section>

            {/* iOS Style Charts - Optimized for Mobile */}
            <section className="space-y-6 mb-8">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900">Estado de Business Cases</h3>
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <FiFileText className="w-4 h-4 text-blue-600" />
                        </div>
                    </div>
                    <div className="h-48">
                        {summaryLoading ? (
                            <LoadingChartState />
                        ) : data.charts.bcStatus.hasData ? (
                            <Doughnut
                                data={bcStatusChartData}
                                options={{
                                    ...chartOptions,
                                    plugins: {
                                        ...chartOptions.plugins,
                                        legend: {
                                            position: 'bottom',
                                            labels: {
                                                boxWidth: 12,
                                                font: {
                                                    size: 10
                                                }
                                            }
                                        }
                                    }
                                }}
                                aria-label="Gráfico circular mostrando distribución de estados de Business Cases"
                            />
                        ) : (
                            <EmptyChartState message="No hay Business Cases para mostrar" />
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900">Solicitudes por Mes</h3>
                        <div className="p-2 bg-indigo-50 rounded-xl">
                            <FiClipboard className="w-4 h-4 text-indigo-600" />
                        </div>
                    </div>
                    <div className="h-48">
                        {summaryLoading ? (
                            <LoadingChartState />
                        ) : data.charts.requestsMonthly.hasData ? (
                            <Bar
                                data={monthlyRequestsChartData}
                                options={{
                                    ...chartOptions,
                                    scales: {
                                        x: {
                                            ticks: {
                                                maxRotation: 45,
                                                minRotation: 45,
                                                font: {
                                                    size: 10
                                                }
                                            }
                                        },
                                        y: {
                                            ticks: {
                                                font: {
                                                    size: 10
                                                }
                                            }
                                        }
                                    }
                                }}
                                aria-label="Gráfico de barras mostrando evolución mensual de solicitudes"
                            />
                        ) : (
                            <EmptyChartState message="No hay datos de solicitudes mensuales" />
                        )}
                    </div>
                </div>
            </section>

            {/* iOS Springboard Navigation - Enhanced for iPhone 13 */}
            <section className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Accesos Rápidos</h2>
                    <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                        {new Date().toLocaleDateString('es-ES', { 
                            day: 'numeric',
                            month: 'short'
                        })}
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                    {/* 🛒 Crear Solicitud */}
                    <div className="group cursor-pointer" onClick={() => setShowPurchaseTypeModal(true)}>
                        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:scale-105 transition-all duration-300 group-hover:shadow-blue-100/50 group-active:scale-95">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md mb-2 group-hover:shadow-blue-500/25 transition-shadow">
                                <FiShoppingCart className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-gray-900 text-center leading-tight">Crear</span>
                            <span className="text-[10px] text-gray-500 text-center leading-tight">Solicitud</span>
                        </div>
                    </div>

                    {/* 👥 Clientes */}
                    <div className="group cursor-pointer" onClick={() => navigate("/dashboard/comercial/clientes")}>
                        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:scale-105 transition-all duration-300 group-hover:shadow-green-100/50 group-active:scale-95">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md mb-2 group-hover:shadow-green-500/25 transition-shadow">
                                <FiUsers className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-gray-900 text-center leading-tight">Clientes</span>
                            <span className="text-[10px] text-gray-500 text-center leading-tight">Gestión</span>
                        </div>
                    </div>

                    {/* 📋 Solicitudes */}
                    <div className="group cursor-pointer" onClick={() => navigate("/dashboard/comercial/solicitudes")}>
                        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:scale-105 transition-all duration-300 group-hover:shadow-blue-100/50 group-active:scale-95">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center shadow-md mb-2 group-hover:shadow-blue-400/25 transition-shadow">
                                <FiClipboard className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-gray-900 text-center leading-tight">Solicitudes</span>
                            <span className="text-[10px] text-gray-500 text-center leading-tight">Historial</span>
                        </div>
                    </div>

                    {/* 📊 Business Case */}
                    <div className="group cursor-pointer" onClick={() => navigate("/dashboard/business-case")}>
                        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:scale-105 transition-all duration-300 group-hover:shadow-orange-100/50 group-active:scale-95">
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md mb-2 group-hover:shadow-orange-500/25 transition-shadow">
                                <FiFileText className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-gray-900 text-center leading-tight">Business</span>
                            <span className="text-[10px] text-gray-500 text-center leading-tight">Case</span>
                        </div>
                    </div>

                    {/* 📅 Planificación */}
                    <div className="group cursor-pointer" onClick={() => navigate("/dashboard/comercial/planificacion")}>
                        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:scale-105 transition-all duration-300 group-hover:shadow-purple-100/50 group-active:scale-95">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md mb-2 group-hover:shadow-purple-500/25 transition-shadow">
                                <FiCalendar className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-gray-900 text-center leading-tight">Planificación</span>
                            <span className="text-[10px] text-gray-500 text-center leading-tight">Cronograma</span>
                        </div>
                    </div>

                    {/* 📊 Analytics (Additional for better grid layout) */}
                    <div className="group cursor-pointer" onClick={() => navigate("/dashboard/comercial/analytics")}>
                        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:scale-105 transition-all duration-300 group-hover:shadow-indigo-100/50 group-active:scale-95">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md mb-2 group-hover:shadow-indigo-500/25 transition-shadow">
                                <FiBarChart2 className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-gray-900 text-center leading-tight">Analytics</span>
                            <span className="text-[10px] text-gray-500 text-center leading-tight">Métricas</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* COMPONENTE UNIFICADO PARA SELECCIÓN DE TIPO DE COMPRA */}
            <PurchaseTypeSelector
                isOpen={showPurchaseTypeModal}
                onClose={() => setShowPurchaseTypeModal(false)}
                origin="dashboard"
                onSelect={handlePurchaseTypeSelection}
            />


        </>
    );
};

export default ComercialView;
