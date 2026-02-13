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
const SummaryCard = ({ label, value, accent = "gray" }) => {
    const accents = {
        blue: { bg: "bg-blue-50/50", border: "border-blue-100", text: "text-blue-600", val: "text-blue-900" },
        green: { bg: "bg-green-50/50", border: "border-green-100", text: "text-green-600", val: "text-green-900" },
        purple: { bg: "bg-purple-50/50", border: "border-purple-100", text: "text-purple-600", val: "text-purple-900" },
        orange: { bg: "bg-orange-50/50", border: "border-orange-100", text: "text-orange-600", val: "text-orange-900" },
        gray: { bg: "bg-gray-50/50", border: "border-gray-100", text: "text-gray-600", val: "text-gray-900" }
    };
    const style = accents[accent] || accents.gray;

    return (
        <div className={`p-5 rounded-2xl border ${style.bg} ${style.border} transition-all hover:shadow-sm`}>
            <p className={`text-xs uppercase tracking-wide font-semibold mb-1 ${style.text}`}>{label}</p>
            <p className={`text-2xl font-bold ${style.val}`}>{value}</p>
        </div>
    );
};

/**
 * Gauge - Simple utilization gauge component
 */
const Gauge = ({ utilization = 0, label = "Utilización" }) => {
    const percentage = Math.min(100, Math.max(0, utilization));
    const color = percentage > 90 ? "#ef4444" : percentage > 70 ? "#eab308" : "#22c55e"; // red, yellow, green

    return (
        <div className="text-center">
            <div className="relative w-40 h-40 mx-auto">
                <svg className="w-40 h-40 transform -rotate-90">
                    <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="#f3f4f6"
                        strokeWidth="12"
                        fill="none"
                    />
                    <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke={color}
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${percentage * 4.4} 440`}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-gray-900 tracking-tight">{percentage.toFixed(0)}%</span>
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Carga</span>
                </div>
            </div>
            <p className="text-sm font-medium text-gray-600 mt-2">{label}</p>
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
                    borderWidth: 0,
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
                    borderRadius: 8,
                },
            ],
        };
    }, [determinations]);

    if (loading) {
        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                        <span className="text-2xl">🧮</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Cálculos Técnicos</h2>
                            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                En desarrollo
                            </span>
                        </div>
                        <p className="text-sm text-gray-500">Análisis de viabilidad técnica y operativa</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                        <span className="text-2xl">🧮</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Cálculos Técnicos</h2>
                            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                En desarrollo
                            </span>
                        </div>
                        <p className="text-sm text-gray-500">Análisis de viabilidad técnica y operativa</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleRecalculate}
                        disabled={recalculating}
                        className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded-full hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-50 font-medium"
                    >
                        <FiRefreshCw size={16} className={recalculating ? "animate-spin" : ""} />
                        Recalcular
                    </button>
                    <button
                        onClick={() => handleExport("pdf")}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-full hover:bg-red-100 active:scale-95 transition-all font-medium"
                    >
                        <FiDownload size={16} />
                        PDF
                    </button>
                    <button
                        onClick={() => handleExport("xlsx")}
                        className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 border border-green-100 rounded-full hover:bg-green-100 active:scale-95 transition-all font-medium"
                    >
                        <FiDownload size={16} />
                        Excel
                    </button>
                </div>
            </div>

            {!calculations ? (
                <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
                    <div className="p-4 bg-yellow-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 text-yellow-500">
                        <FiAlertTriangle size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No hay cálculos disponibles</h3>
                    <p className="text-gray-500 mb-8 max-w-md mx-auto">
                        Configure equipos y determinaciones primero, luego presione "Recalcular" para ver los resultados.
                    </p>
                    <button
                        onClick={handleRecalculate}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm hover:shadow-blue-200"
                    >
                        Ejecutar Cálculos
                    </button>
                </div>
            ) : (
                <>
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">
                                Utilización del Equipo
                            </h3>
                            <Gauge
                                utilization={calculations.equipment_utilization || 0}
                                label="Capacidad Utilizada"
                            />
                            {calculations.equipment_utilization > 90 && (
                                <div className="mt-6 p-3 bg-red-50 text-red-700 text-xs rounded-xl text-center font-medium border border-red-100">
                                    ⚠️ Alta utilización - considere equipo adicional
                                </div>
                            )}
                        </div>

                        {/* Cost Breakdown Pie */}
                        {costBreakdownData && (
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                                <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">
                                    Distribución de Costos
                                </h3>
                                <div className="h-56">
                                    <Pie
                                        data={costBreakdownData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    position: "bottom",
                                                    labels: { 
                                                        boxWidth: 10, 
                                                        font: { size: 11, family: 'system-ui' },
                                                        padding: 20,
                                                        usePointStyle: true
                                                    },
                                                },
                                            },
                                            layout: {
                                                padding: 10
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Volume Bar Chart */}
                        {determinationVolumeData && (
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                                <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">
                                    Top 5 Determinaciones
                                </h3>
                                <div className="h-56">
                                    <Bar
                                        data={determinationVolumeData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: { display: false },
                                            },
                                            scales: {
                                                y: { 
                                                    beginAtZero: true,
                                                    grid: { borderDash: [2, 4], color: '#f3f4f6' },
                                                    ticks: { font: { size: 10 } }
                                                },
                                                x: { 
                                                    grid: { display: false },
                                                    ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } 
                                                },
                                            },
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                             <div className="w-1.5 h-6 rounded-full bg-blue-500"></div>
                             Desglose Detallado
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <span className="text-gray-500 block text-xs uppercase tracking-wide font-semibold mb-1">Capacidad Requerida</span>
                                <span className="font-bold text-gray-900 text-lg">{calculations.required_capacity || 0} <span className="text-xs font-normal text-gray-500">tests/hora</span></span>
                            </div>
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <span className="text-gray-500 block text-xs uppercase tracking-wide font-semibold mb-1">Consumo Reactivos</span>
                                <span className="font-bold text-gray-900 text-lg">${calculations.reagent_consumption?.toFixed(2) || "0.00"}<span className="text-xs font-normal text-gray-500">/mes</span></span>
                            </div>
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <span className="text-gray-500 block text-xs uppercase tracking-wide font-semibold mb-1">Horas Operativas</span>
                                <span className="font-bold text-gray-900 text-lg">{calculations.operating_hours || 0} <span className="text-xs font-normal text-gray-500">hrs/mes</span></span>
                            </div>
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <span className="text-gray-500 block text-xs uppercase tracking-wide font-semibold mb-1">Personal Requerido</span>
                                <span className="font-bold text-gray-900 text-lg">{calculations.required_personnel || 0} <span className="text-xs font-normal text-gray-500">FTE</span></span>
                            </div>
                        </div>
                    </div>

                    {/* Warnings */}
                    {calculations.warnings?.length > 0 && (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                            <div className="p-1 bg-amber-100 rounded-full mt-0.5 text-amber-600">
                                <FiAlertTriangle size={18} />
                            </div>
                            <div>
                                <h4 className="font-semibold text-amber-900">Advertencias</h4>
                                <ul className="text-sm text-amber-800 mt-1 space-y-1 list-disc ml-4 marker:text-amber-500">
                                    {calculations.warnings.map((w, i) => (
                                        <li key={i}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CalculationsSection;



