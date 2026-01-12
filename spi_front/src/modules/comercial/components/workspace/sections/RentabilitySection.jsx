import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FiDollarSign, FiTrendingUp, FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import Card from "../../../../../core/ui/components/Card";

/**
 * MetricCard - Reusable card for displaying financial metrics
 */
const MetricCard = ({ label, value, accent = "gray", icon: Icon }) => (
    <div className={`p-4 rounded-lg border bg-${accent}-50 border-${accent}-200`}>
        <div className="flex items-center gap-2 mb-1">
            {Icon && <Icon size={14} className={`text-${accent}-600`} />}
            <p className="text-xs uppercase text-gray-500 font-medium">{label}</p>
        </div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
);

/**
 * RentabilitySection - Workspace section for ROI and financial analysis
 * Adapted from Step4RentabilitySummary.jsx
 */
const RentabilitySection = ({ permissions = {}, ownership = {}, onSave }) => {
    const { id: bcId } = useParams();
    const { showToast } = useUI();
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState(false);
    const [calculations, setCalculations] = useState(null);

    // Load calculations
    const loadCalculations = async () => {
        if (!bcId) return;
        try {
            setLoading(true);
            const res = await api.get(`/business-case/${bcId}/calculations`);
            setCalculations(res.data);
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
            await api.post(`/business-case/${bcId}/orchestrator/calculate-roi`);
            await loadCalculations();
            showToast("Rentabilidad recalculada", "success");
            if (onSave) onSave();
        } catch (err) {
            console.error("Error recalculating ROI:", err);
            showToast("Error al recalcular rentabilidad", "error");
        } finally {
            setRecalculating(false);
        }
    };

    // Determine ROI status
    const getROIStatus = (roi) => {
        if (roi >= 20) return { color: "green", label: "Excelente" };
        if (roi >= 10) return { color: "blue", label: "Bueno" };
        if (roi >= 0) return { color: "yellow", label: "Aceptable" };
        return { color: "red", label: "Negativo" };
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="text-3xl">📈</div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Análisis de Rentabilidad</h2>
                        <p className="text-sm text-gray-600">ROI, payback y análisis financiero</p>
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

    const roiStatus = calculations?.roi_percentage ? getROIStatus(calculations.roi_percentage) : null;

    return (
        <div className="space-y-6">
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-3xl">📈</div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Análisis de Rentabilidad</h2>
                        <p className="text-sm text-gray-600">ROI, payback y análisis financiero</p>
                    </div>
                </div>
                <button
                    onClick={handleRecalculate}
                    disabled={recalculating}
                    className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                >
                    <FiRefreshCw size={16} className={recalculating ? "animate-spin" : ""} />
                    Recalcular
                </button>
            </div>

            {!calculations ? (
                <Card className="p-8">
                    <div className="text-center space-y-4">
                        <FiAlertTriangle size={48} className="mx-auto text-yellow-500" />
                        <h3 className="text-lg font-semibold text-gray-900">No hay cálculos de rentabilidad</h3>
                        <p className="text-gray-600">
                            Complete los cálculos técnicos e inversiones primero
                        </p>
                        <button
                            onClick={handleRecalculate}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Calcular Rentabilidad
                        </button>
                    </div>
                </Card>
            ) : (
                <>
                    {/* ROI Highlight */}
                    <Card className={`p-6 bg-${roiStatus?.color || "gray"}-50 border-${roiStatus?.color || "gray"}-200`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Retorno sobre Inversión (ROI)</p>
                                <p className="text-4xl font-bold text-gray-900">
                                    {calculations.roi_percentage?.toFixed(2) || 0}%
                                </p>
                                <p className={`text-sm font-medium text-${roiStatus?.color || "gray"}-600 mt-1`}>
                                    {roiStatus?.label || "Sin datos"}
                                </p>
                            </div>
                            <div className={`p-4 rounded-full bg-${roiStatus?.color || "gray"}-100`}>
                                <FiTrendingUp size={32} className={`text-${roiStatus?.color || "gray"}-600`} />
                            </div>
                        </div>
                    </Card>

                    {/* Key Financial Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MetricCard
                            label="Margen Mensual"
                            value={`$${calculations.monthly_margin?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}`}
                            accent="green"
                            icon={FiDollarSign}
                        />
                        <MetricCard
                            label="Período de Recuperación"
                            value={calculations.payback_months ? `${calculations.payback_months} meses` : "N/A"}
                            accent="blue"
                            icon={FiTrendingUp}
                        />
                        <MetricCard
                            label="VAN (NPV)"
                            value={`$${calculations.npv?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}`}
                            accent="purple"
                            icon={FiDollarSign}
                        />
                    </div>

                    {/* Revenue vs Cost */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Ingresos vs Costos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Ingreso Mensual Requerido</span>
                                    <span className="font-semibold text-green-600">
                                        ${calculations.monthly_revenue?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Ingreso Anual Proyectado</span>
                                    <span className="font-semibold text-green-600">
                                        ${calculations.annual_revenue?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Costo Operativo Mensual</span>
                                    <span className="font-semibold text-red-600">
                                        ${calculations.monthly_operating_cost?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Costo Operativo Anual</span>
                                    <span className="font-semibold text-red-600">
                                        ${calculations.annual_operating_cost?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Profit Bar */}
                        <div className="mt-6 pt-4 border-t">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium text-gray-700">Utilidad Anual Neta</span>
                                <span className={`text-xl font-bold ${calculations.annual_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    ${calculations.annual_profit?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                                </span>
                            </div>
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${calculations.annual_profit >= 0 ? "bg-green-500" : "bg-red-500"}`}
                                    style={{
                                        width: `${Math.min(100, Math.abs((calculations.annual_profit || 0) / (calculations.annual_revenue || 1) * 100))}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Investment Summary */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumen de Inversión</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-500">Inversión Total</p>
                                <p className="text-lg font-bold text-gray-900">
                                    ${calculations.total_investment?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-500">TIR (IRR)</p>
                                <p className="text-lg font-bold text-gray-900">
                                    {calculations.irr?.toFixed(2) || "0"}%
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-500">Duración del Contrato</p>
                                <p className="text-lg font-bold text-gray-900">
                                    {calculations.contract_duration || 3} años
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Warnings */}
                    {calculations.warnings?.length > 0 && (
                        <Card className="p-4 bg-yellow-50 border-yellow-200">
                            <div className="flex items-start gap-3">
                                <FiAlertTriangle className="text-yellow-600 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-yellow-900">Advertencias de Rentabilidad</h4>
                                    <ul className="text-sm text-yellow-700 mt-1 list-disc ml-4">
                                        {calculations.warnings.map((w, i) => (
                                            <li key={i}>{w}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Approval Status */}
                    {calculations.approved !== undefined && (
                        <Card className={`p-4 ${calculations.approved ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${calculations.approved ? "bg-green-100" : "bg-red-100"}`}>
                                    {calculations.approved ? "✅" : "❌"}
                                </div>
                                <div>
                                    <h4 className={`font-medium ${calculations.approved ? "text-green-900" : "text-red-900"}`}>
                                        {calculations.approved ? "Caso de Negocio Viable" : "Caso de Negocio No Viable"}
                                    </h4>
                                    <p className={`text-sm ${calculations.approved ? "text-green-700" : "text-red-700"}`}>
                                        {calculations.approved
                                            ? "El análisis financiero indica que el proyecto cumple con los criterios de rentabilidad."
                                            : "El proyecto no cumple con los criterios mínimos de rentabilidad. Revise inversiones y precios."}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
};

export default RentabilitySection;
