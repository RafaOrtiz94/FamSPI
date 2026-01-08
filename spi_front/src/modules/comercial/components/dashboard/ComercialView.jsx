import { useNavigate } from "react-router-dom";
import { FiClipboard, FiUsers, FiCheckSquare, FiFileText, FiCalendar, FiRefreshCw } from "react-icons/fi";
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
import { DashboardHeader } from "../../../../core/ui/layouts/DashboardLayout";
import StatCard from "../../../../core/ui/patterns/StatCard";
import ChartCard from "../../../gerencia/components/ChartCard";

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

const ComercialView = ({ onRefresh, summaryData, summaryLoading, summaryError }) => {
    const navigate = useNavigate();

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

    const data = summaryData || fallbackData;

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
            <DashboardHeader
                title="Panel de control para asesores comerciales"
                actions={
                    <Button
                        variant="secondary"
                        icon={FiRefreshCw}
                        onClick={onRefresh}
                        disabled={summaryLoading}
                    >
                        {summaryLoading ? 'Actualizando...' : 'Actualizar'}
                    </Button>
                }
            />

            {/* KPIs Section */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                <StatCard
                    label="Total Business Cases"
                    value={summaryLoading ? '...' : data.kpis.totalBC}
                    icon={FiFileText}
                    color="blue"
                />
                <StatCard
                    label="BC Activos"
                    value={summaryLoading ? '...' : data.kpis.bcActivos}
                    icon={FiCheckSquare}
                    color="emerald"
                />
                <StatCard
                    label="Solicitudes Pendientes"
                    value={summaryLoading ? '...' : data.kpis.solicitudesPendientes}
                    icon={FiClipboard}
                    color="amber"
                />
                <StatCard
                    label="Clientes Nuevos (30d)"
                    value={summaryLoading ? '...' : data.kpis.clientesNuevos30d}
                    icon={FiUsers}
                    color="violet"
                />
            </section>

            {/* Charts Section */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ChartCard title="Estado de Business Cases">
                    <div className="h-64">
                        {summaryLoading ? (
                            <LoadingChartState />
                        ) : data.charts.bcStatus.hasData ? (
                            <Doughnut
                                data={bcStatusChartData}
                                options={chartOptions}
                                aria-label="Gráfico circular mostrando distribución de estados de Business Cases"
                            />
                        ) : (
                            <EmptyChartState message="No hay Business Cases para mostrar" />
                        )}
                    </div>
                </ChartCard>

                <ChartCard title="Solicitudes por Mes">
                    <div className="h-64">
                        {summaryLoading ? (
                            <LoadingChartState />
                        ) : data.charts.requestsMonthly.hasData ? (
                            <Bar
                                data={monthlyRequestsChartData}
                                options={chartOptions}
                                aria-label="Gráfico de barras mostrando evolución mensual de solicitudes"
                            />
                        ) : (
                            <EmptyChartState message="No hay datos de solicitudes mensuales" />
                        )}
                    </div>
                </ChartCard>
            </section>

            {/* Navigation Cards Section */}
            <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Accesos Rápidos</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 👉 Clientes */}
                    <Card className="p-0">
                        <button
                            className="w-full text-left p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                            onClick={() => navigate("/dashboard/comercial/clientes")}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 rounded-md text-green-600">
                                    <FiUsers size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Clientes</p>
                                    <p className="text-xs text-gray-500">Gestión desde navegación</p>
                                </div>
                            </div>
                        </button>
                    </Card>

                    {/* 👉 Solicitudes */}
                    <Card className="p-0">
                        <button
                            className="w-full text-left p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                            onClick={() => navigate("/dashboard/comercial/solicitudes")}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-md text-blue-600">
                                    <FiClipboard size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Solicitudes</p>
                                    <p className="text-xs text-gray-500">Módulo dedicado</p>
                                </div>
                            </div>
                        </button>
                    </Card>

                    {/* 👉 Business Case */}
                    <Card className="p-0">
                        <button
                            className="w-full text-left p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                            onClick={() => navigate("/dashboard/business-case")}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-50 rounded-md text-orange-600">
                                    <FiFileText size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Business Case</p>
                                    <p className="text-xs text-gray-500">Inicia y completa tu caso</p>
                                </div>
                            </div>
                        </button>
                    </Card>

                    {/* 👉 Planificación */}
                    <Card className="p-0">
                        <button
                            className="w-full text-left p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                            onClick={() => navigate("/dashboard/comercial/planificacion")}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 rounded-md text-purple-600">
                                    <FiCalendar size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Planificación</p>
                                    <p className="text-xs text-gray-500">Cronograma mensual</p>
                                </div>
                            </div>
                        </button>
                    </Card>
                </div>
            </section>
        </>
    );
};

export default ComercialView;
