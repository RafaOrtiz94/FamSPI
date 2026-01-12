import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FiDollarSign, FiSave, FiRefreshCw } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import Card from "../../../../../core/ui/components/Card";

/**
 * PricesSection - Workspace section for price definition per determination
 */
const PricesSection = ({ permissions = {}, ownership = {}, onSave }) => {
    const { id: bcId } = useParams();
    const { showToast } = useUI();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [determinations, setDeterminations] = useState([]);
    const [priceData, setPriceData] = useState({
        targetMargin: 25,
        includeQCCosts: true,
        includeMaintenanceCosts: true,
    });

    // Load determinations with prices
    useEffect(() => {
        const loadPrices = async () => {
            if (!bcId) return;
            try {
                setLoading(true);
                // Load determinations from BC
                const detRes = await api.get(`/business-case/${bcId}/determinations`);
                if (detRes.data) {
                    setDeterminations(
                        detRes.data.map((d) => ({
                            ...d,
                            suggestedPrice: d.suggested_price || d.unit_cost * (1 + priceData.targetMargin / 100),
                            customPrice: d.custom_price || null,
                        }))
                    );
                }

                // Load BC for margin settings
                const bcRes = await api.get(`/business-case/${bcId}`);
                if (bcRes.data?.target_margin) {
                    setPriceData((prev) => ({
                        ...prev,
                        targetMargin: bcRes.data.target_margin,
                    }));
                }
            } catch (err) {
                if (err.response?.status !== 404) {
                    console.error("Error loading prices:", err);
                }
            } finally {
                setLoading(false);
            }
        };

        loadPrices();
    }, [bcId]);

    const handlePriceChange = (detId, value) => {
        setDeterminations((prev) =>
            prev.map((d) =>
                d.id === detId ? { ...d, customPrice: value ? parseFloat(value) : null } : d
            )
        );
    };

    const handleMarginChange = (value) => {
        const margin = parseFloat(value) || 0;
        setPriceData((prev) => ({ ...prev, targetMargin: margin }));

        // Recalculate suggested prices
        setDeterminations((prev) =>
            prev.map((d) => ({
                ...d,
                suggestedPrice: d.unit_cost * (1 + margin / 100),
            }))
        );
    };

    const handleSave = async () => {
        if (!bcId) {
            showToast("Error: No se encontró el Business Case ID", "error");
            return;
        }

        try {
            setSaving(true);

            // Update BC margin
            await api.put(`/business-case/${bcId}`, {
                target_margin: priceData.targetMargin,
            });

            // Update custom prices for each determination
            for (const det of determinations) {
                if (det.customPrice !== null) {
                    await api.put(`/business-case/${bcId}/determinations/${det.id}`, {
                        custom_price: det.customPrice,
                    });
                }
            }

            showToast("Precios guardados", "success");
            if (onSave) onSave();
        } catch (err) {
            console.error("Error saving prices:", err);
            showToast("Error guardando precios", "error");
        } finally {
            setSaving(false);
        }
    };

    const calculateTotals = () => {
        let totalSuggested = 0;
        let totalCustom = 0;
        determinations.forEach((d) => {
            const qty = d.annual_quantity || d.monthly_quantity * 12 || 0;
            totalSuggested += (d.suggestedPrice || 0) * qty;
            totalCustom += (d.customPrice || d.suggestedPrice || 0) * qty;
        });
        return { totalSuggested, totalCustom };
    };

    const canEdit = permissions.canEdit !== false && ownership.canUserEdit !== false;
    const totals = calculateTotals();

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="text-3xl">💵</div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Definición de Precios</h2>
                        <p className="text-sm text-gray-600">Establecimiento de precios y márgenes</p>
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
                    <div className="text-3xl">💵</div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Definición de Precios</h2>
                        <p className="text-sm text-gray-600">Establecimiento de precios y márgenes</p>
                    </div>
                </div>
                {canEdit && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        <FiSave size={16} />
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                )}
            </div>

            {/* Margin Configuration */}
            <Card className="p-6">
                <div className="flex items-center gap-2 border-b pb-4 mb-6">
                    <FiDollarSign className="text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-800">Configuración de Margen</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                            Margen Objetivo (%)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={priceData.targetMargin}
                            onChange={(e) => handleMarginChange(e.target.value)}
                            disabled={!canEdit}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="includeQC"
                            checked={priceData.includeQCCosts}
                            onChange={(e) => setPriceData((prev) => ({ ...prev, includeQCCosts: e.target.checked }))}
                            disabled={!canEdit}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <label htmlFor="includeQC" className="text-sm text-gray-700">
                            Incluir costos de QC
                        </label>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="includeMaint"
                            checked={priceData.includeMaintenanceCosts}
                            onChange={(e) => setPriceData((prev) => ({ ...prev, includeMaintenanceCosts: e.target.checked }))}
                            disabled={!canEdit}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <label htmlFor="includeMaint" className="text-sm text-gray-700">
                            Incluir costos de mantenimiento
                        </label>
                    </div>
                </div>
            </Card>

            {/* Prices Table */}
            <Card className="p-6">
                <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800">Precios por Determinación</h3>
                    <span className="text-sm text-gray-500">
                        {determinations.length} determinaciones
                    </span>
                </div>

                {determinations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No hay determinaciones configuradas</p>
                        <p className="text-sm mt-2">Configure determinaciones en la sección correspondiente primero</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-2 font-medium text-gray-600">Determinación</th>
                                    <th className="text-right py-3 px-2 font-medium text-gray-600">Costo Unit.</th>
                                    <th className="text-right py-3 px-2 font-medium text-gray-600">Precio Sugerido</th>
                                    <th className="text-right py-3 px-2 font-medium text-gray-600">Precio Custom</th>
                                    <th className="text-right py-3 px-2 font-medium text-gray-600">Margen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {determinations.map((det) => {
                                    const finalPrice = det.customPrice || det.suggestedPrice || 0;
                                    const margin = det.unit_cost > 0
                                        ? ((finalPrice - det.unit_cost) / det.unit_cost * 100).toFixed(1)
                                        : 0;
                                    return (
                                        <tr key={det.id} className="border-b hover:bg-gray-50">
                                            <td className="py-3 px-2">
                                                <div className="font-medium text-gray-900">{det.name}</div>
                                                <div className="text-xs text-gray-500">{det.category}</div>
                                            </td>
                                            <td className="text-right py-3 px-2 text-gray-600">
                                                ${det.unit_cost?.toFixed(2) || "0.00"}
                                            </td>
                                            <td className="text-right py-3 px-2 text-blue-600">
                                                ${det.suggestedPrice?.toFixed(2) || "0.00"}
                                            </td>
                                            <td className="text-right py-3 px-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={det.customPrice || ""}
                                                    onChange={(e) => handlePriceChange(det.id, e.target.value)}
                                                    disabled={!canEdit}
                                                    className="w-24 border border-gray-300 rounded px-2 py-1 text-right text-sm"
                                                    placeholder={det.suggestedPrice?.toFixed(2)}
                                                />
                                            </td>
                                            <td className={`text-right py-3 px-2 font-medium ${margin >= priceData.targetMargin ? "text-green-600" : "text-orange-600"
                                                }`}>
                                                {margin}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 bg-blue-50">
                    <div className="text-xs uppercase text-blue-600 font-medium">Ingreso Anual (Precio Sugerido)</div>
                    <div className="text-2xl font-bold text-blue-900">${totals.totalSuggested.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                </Card>
                <Card className="p-4 bg-green-50">
                    <div className="text-xs uppercase text-green-600 font-medium">Ingreso Anual (Precio Final)</div>
                    <div className="text-2xl font-bold text-green-900">${totals.totalCustom.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                </Card>
            </div>
        </div>
    );
};

export default PricesSection;
