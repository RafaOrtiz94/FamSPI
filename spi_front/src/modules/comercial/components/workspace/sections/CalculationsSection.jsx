import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Bar, Pie } from "react-chartjs-2";
import {
    Chart as ChartJS,
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
} from "chart.js";
import { FiRefreshCw, FiDownload, FiAlertTriangle } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import Card from "../../../../../core/ui/components/Card";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/**
 * SummaryCard - Reusable card for displaying key metrics
 */
const SummaryCard = ({ label, value, accent = "gray" }) => (
    <div className={`p-4 rounded-lg border bg-${accent}-50 border-${accent}-200`}>
        <p className="text-xs uppercase text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
);

/**
 * Gauge - Simple utilization gauge component
 */
const Gauge = ({ utilization = 0, label = "Utilización" }) => {
    const percentage = Math.min(100, Math.max(0, utilization));
    const color = percentage > 90 ? "red" : percentage > 70 ? "yellow" : "green";

    return (
        <div className="text-center">
            <div className="relative w-32 h-32 mx-auto">
                <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                        fill="none"
                    />
                    <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke={color === "green" ? "#22c55e" : color === "yellow" ? "#eab308" : "#ef4444"}
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${percentage * 3.51} 351`}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">{percentage.toFixed(0)}%</span>
                </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">{label}</p>
        </div>
    );
};

/**
 * CalculationsSection - Workspace section for technical calculations summary
 * Adapted from Step4CalculationsSummary.jsx
 */
const CalculationsSection = ({ permissions = {}, ownership = {}, onSave }) => {
    const { id: bcId } = useParams();
    const { showToast } = useUI();
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState(false);
    const [calculations, setCalculations] = useState(null);
    const [determinations, setDeterminations] = useState([]);

    // Load calculations
    const loadCalculations = async () => {
        if (!bcId) return;
        try {
            setLoading(true);
            const [calcRes, detRes] = await Promise.all([
                api.get(`/business-case/${bcId}/calculations`),
                api.get(`/business-case/${bcId}/determinations`),
            ]);
            setCalculations(calcRes.data);
            setDeterminations(detRes.data || []);
        } catch (err) {
            if (err.response?.status !== 404) {
                console.error("Error loading calculations:", err);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCalculations();
    }, [bcId]);

    const handleRecalculate = async () => {
        if (!bcId) return;
        try {
            setRecalculating(true);
            await api.post(`/business-case/${bcId}/recalculate`);
            await loadCalculations();
            showToast("Cálculos actualizados", "success");
            if (onSave) onSave();
        } catch (err) {
            console.error("Error recalculating:", err);
            showToast("Error al recalcular", "error");
        } finally {
            setRecalculating(false);
        }
    };

    const handleExport = async (format) => {
        if (!bcId) return;
        try {
            showToast(`Exportando a ${format.toUpperCase()}...`, "info");
            const res = await api.get(`/business-case/${bcId}/export?format=${format}`, {
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `business_case_${bcId}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showToast(`Exportación a ${format.toUpperCase()} completada`, "success");
        } catch (err) {
            console.error("Export error:", err);
            showToast("Error en la exportación", "error");
        }
    };

    // Chart data
    const costBreakdownData = useMemo(() => {
        if (!calculations) return null;
        return {
            labels: ["Reactivos", "QC", "Mantenimiento", "Personal", "Otros"],
            datasets: [
                {
                    data: [
                        calculations.reagent_cost || 0,
                        calculations.qc_cost || 0,
                        calculations.maintenance_cost || 0,
                        calculations.personnel_cost || 0,
                        calculations.other_cost || 0,
                    ],
                    backgroundColor: [
                        "#3b82f6",
                        "#22c55e",
                        "#f59e0b",
                        "#8b5cf6",
                        "#6b7280",
                    ],
                },
            ],
        };
    }, [calculations]);

    const determinationVolumeData = useMemo(() => {
        if (!determinations.length) return null;
        const top5 = [...determinations]
            .sort((a, b) => (b.annual_quantity || 0) - (a.annual_quantity || 0))
            .slice(0, 5);
        return {
            labels: top5.map((d) => d.name?.substring(0, 15) || "Sin nombre"),
            datasets: [
                {
                    label: "Volumen Anual",
                    data: top5.map((d) => d.annual_quantity || 0),
                    backgroundColor: "#3b82f6",
                },
            ],
        };
    }, [determinations]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="text-3xl">🧮</div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Cálculos Técnicos</h2>
                        <p className="text-sm text-gray-600">Análisis de viabilidad técnica y operativa</p>
                    </div>
                </div>
                <Card className="p-8">
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-3xl">🧮</div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Cálculos Técnicos</h2>
                        <p className="text-sm text-gray-600">Análisis de viabilidad técnica y operativa</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleRecalculate}
                        disabled={recalculating}
                        className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                    >
                        <FiRefreshCw size={16} className={recalculating ? "animate-spin" : ""} />
                        Recalcular
                    </button>
                    <button
                        onClick={() => handleExport("pdf")}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                        <FiDownload size={16} />
                        PDF
                    </button>
                    <button
                        onClick={() => handleExport("xlsx")}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                        <FiDownload size={16} />
                        Excel
                    </button>
                </div>
            </div>

            {!calculations ? (
                <Card className="p-8">
                    <div className="text-center space-y-4">
                        <FiAlertTriangle size={48} className="mx-auto text-yellow-500" />
                        <h3 className="text-lg font-semibold text-gray-900">No hay cálculos disponibles</h3>
                        <p className="text-gray-600">
                            Configure equipos y determinaciones primero, luego presione "Recalcular"
                        </p>
                        <button
                            onClick={handleRecalculate}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Ejecutar Cálculos
                        </button>
                    </div>
                </Card>
            ) : (
                <>
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <SummaryCard
                            label="Tests Anuales"
                            value={calculations.total_annual_tests?.toLocaleString() || "0"}
                            accent="blue"
                        />
                        <SummaryCard
                            label="Costo por Test"
                            value={`$${calculations.cost_per_test?.toFixed(2) || "0.00"}`}
                            accent="green"
                        />
                        <SummaryCard
                            label="Costo Mensual"
                            value={`$${calculations.monthly_cost?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}`}
                            accent="purple"
                        />
                        <SummaryCard
                            label="Costo Anual"
                            value={`$${calculations.annual_cost?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}`}
                            accent="orange"
                        />
                    </div>

                    {/* Utilization and Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Utilization Gauge */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                                Utilización del Equipo
                            </h3>
                            <Gauge
                                utilization={calculations.equipment_utilization || 0}
                                label="Capacidad Utilizada"
                            />
                            {calculations.equipment_utilization > 90 && (
                                <div className="mt-4 p-2 bg-red-50 text-red-700 text-xs rounded text-center">
                                    ⚠️ Alta utilización - considere equipo adicional
                                </div>
                            )}
                        </Card>

                        {/* Cost Breakdown Pie */}
                        {costBreakdownData && (
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                                    Distribución de Costos
                                </h3>
                                <div className="h-48">
                                    <Pie
                                        data={costBreakdownData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    position: "bottom",
                                                    labels: { boxWidth: 12, font: { size: 10 } },
                                                },
                                            },
                                        }}
                                    />
                                </div>
                            </Card>
                        )}

                        {/* Volume Bar Chart */}
                        {determinationVolumeData && (
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                                    Top 5 Determinaciones
                                </h3>
                                <div className="h-48">
                                    <Bar
                                        data={determinationVolumeData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: { display: false },
                                            },
                                            scales: {
                                                y: { beginAtZero: true },
                                                x: { ticks: { font: { size: 9 } } },
                                            },
                                        }}
                                    />
                                </div>
                            </Card>
                        )}
                    </div>

                    {/* Detailed Breakdown */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Desglose Detallado</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">Capacidad Requerida:</span>
                                <span className="ml-2 font-medium">{calculations.required_capacity || 0} tests/hora</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Consumo Reactivos:</span>
                                <span className="ml-2 font-medium">${calculations.reagent_consumption?.toFixed(2) || "0.00"}/mes</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Horas Operativas:</span>
                                <span className="ml-2 font-medium">{calculations.operating_hours || 0} hrs/mes</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Personal Requerido:</span>
                                <span className="ml-2 font-medium">{calculations.required_personnel || 0} FTE</span>
                            </div>
                        </div>
                    </Card>

                    {/* Warnings */}
                    {calculations.warnings?.length > 0 && (
                        <Card className="p-4 bg-yellow-50 border-yellow-200">
                            <div className="flex items-start gap-3">
                                <FiAlertTriangle className="text-yellow-600 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-yellow-900">Advertencias</h4>
                                    <ul className="text-sm text-yellow-700 mt-1 list-disc ml-4">
                                        {calculations.warnings.map((w, i) => (
                                            <li key={i}>{w}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
};

export default CalculationsSection;
