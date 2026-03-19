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
 <div className="space-y-6 animate-fadeIn">
 <div className="flex items-center gap-3">
 <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
 <span className="text-2xl">💵</span>
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h2 className="text-xl font-bold text-gray-900 tracking-tight">Definición de Precios</h2>
 <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
 En desarrollo
 </span>
 </div>
 <p className="text-sm text-gray-500">Establecimiento de precios y márgenes</p>
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
 <span className="text-2xl">💵</span>
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h2 className="text-xl font-bold text-gray-900 tracking-tight">Definición de Precios</h2>
 <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
 En desarrollo
 </span>
 </div>
 <p className="text-sm text-gray-500">Establecimiento de precios y márgenes</p>
 </div>
 </div>
 {canEdit && (
 <button
 onClick={handleSave}
 disabled={saving}
 className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <FiSave size={18} />
 {saving ? "Guardando..." : "Guardar Precios"}
 </button>
 )}
 </div>

 {/* Margin Configuration */}
 <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
 <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-6">
 <div className="p-2 bg-green-50 rounded-full text-green-600">
 <FiDollarSign size={20} />
 </div>
 <h3 className="text-lg font-semibold text-gray-900">Configuración de Margen</h3>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
 <div className="space-y-2">
 <label className="text-sm font-medium text-gray-700 ml-1">
 Margen Objetivo (%)
 </label>
 <div className="relative">
 <input
 type="number"
 min="0"
 max="100"
 step="0.5"
 value={priceData.targetMargin}
 onChange={(e) => handleMarginChange(e.target.value)}
 disabled={!canEdit}
 className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-gray-900 font-medium disabled:bg-gray-50"
 />
 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-medium">%</div>
 </div>
 </div>

 <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-100 transition-colors cursor-pointer" onClick={() => canEdit && setPriceData(prev => ({ ...prev, includeQCCosts: !prev.includeQCCosts }))}>
 <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${priceData.includeQCCosts ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
 {priceData.includeQCCosts && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
 </div>
 <input
 type="checkbox"
 id="includeQC"
 checked={priceData.includeQCCosts}
 onChange={(e) => setPriceData((prev) => ({ ...prev, includeQCCosts: e.target.checked }))}
 disabled={!canEdit}
 className="hidden"
 />
 <label htmlFor="includeQC" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
 Incluir costos de QC
 </label>
 </div>

 <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-100 transition-colors cursor-pointer" onClick={() => canEdit && setPriceData(prev => ({ ...prev, includeMaintenanceCosts: !prev.includeMaintenanceCosts }))}>
 <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${priceData.includeMaintenanceCosts ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
 {priceData.includeMaintenanceCosts && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
 </div>
 <input
 type="checkbox"
 id="includeMaint"
 checked={priceData.includeMaintenanceCosts}
 onChange={(e) => setPriceData((prev) => ({ ...prev, includeMaintenanceCosts: e.target.checked }))}
 disabled={!canEdit}
 className="hidden"
 />
 <label htmlFor="includeMaint" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
 Incluir costos de mantenimiento
 </label>
 </div>
 </div>
 </div>

 {/* Prices Table */}
 <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
 <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
 <h3 className="text-lg font-semibold text-gray-900">Precios por Determinación</h3>
 <span className="text-xs font-medium px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
 {determinations.length} determinaciones
 </span>
 </div>

 {determinations.length === 0 ? (
 <div className="text-center py-12 text-gray-500">
 <div className="flex justify-center mb-3">
 <span className="text-4xl opacity-20">🏷️</span>
 </div>
 <p className="font-medium">No hay determinaciones configuradas</p>
 <p className="text-sm mt-1 opacity-70">Configure determinaciones en la sección correspondiente primero</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-gray-100">
 <th className="text-left py-3 px-4 font-semibold text-gray-600">Determinación</th>
 <th className="text-right py-3 px-4 font-semibold text-gray-600">Costo Unit.</th>
 <th className="text-right py-3 px-4 font-semibold text-gray-600">Precio Sugerido</th>
 <th className="text-right py-3 px-4 font-semibold text-gray-600">Precio Custom</th>
 <th className="text-right py-3 px-4 font-semibold text-gray-600">Margen</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {determinations.map((det) => {
 const finalPrice = det.customPrice || det.suggestedPrice || 0;
 const margin = det.unit_cost > 0
 ? ((finalPrice - det.unit_cost) / det.unit_cost * 100).toFixed(1)
 : 0;
 return (
 <tr key={det.id} className="hover:bg-gray-50/50 transition-colors">
 <td className="py-3 px-4">
 <div className="font-semibold text-gray-900">{det.name}</div>
 <div className="text-xs text-gray-500 mt-0.5">{det.category}</div>
 </td>
 <td className="text-right py-3 px-4 text-gray-600 font-mono">
 ${det.unit_cost?.toFixed(2) || "0.00"}
 </td>
 <td className="text-right py-3 px-4 text-blue-600 font-medium font-mono">
 ${det.suggestedPrice?.toFixed(2) || "0.00"}
 </td>
 <td className="text-right py-3 px-4">
 <input
 type="number"
 min="0"
 step="0.01"
 value={det.customPrice || ""}
 onChange={(e) => handlePriceChange(det.id, e.target.value)}
 disabled={!canEdit}
 className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-right text-sm font-medium focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
 placeholder={det.suggestedPrice?.toFixed(2)}
 />
 </td>
 <td className="text-right py-3 px-4">
 <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
 margin >= priceData.targetMargin 
 ? "bg-green-50 text-green-700" 
 : "bg-orange-50 text-orange-700"
 }`}>
 {margin}%
 </span>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* Summary */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100 flex items-center justify-between">
 <div>
 <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-1">Ingreso Anual (Precio Sugerido)</div>
 <div className="text-3xl font-bold text-blue-900 tracking-tight">${totals.totalSuggested.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
 </div>
 <div className="p-3 bg-white rounded-full shadow-sm text-blue-500">
 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
 </div>
 </div>
 <div className="bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100 flex items-center justify-between">
 <div>
 <div className="text-xs uppercase tracking-wide text-emerald-600 font-semibold mb-1">Ingreso Anual (Precio Final)</div>
 <div className="text-3xl font-bold text-emerald-900 tracking-tight">${totals.totalCustom.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
 </div>
 <div className="p-3 bg-white rounded-full shadow-sm text-emerald-500">
 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
 </div>
 </div>
 </div>
 </div>
 );
};

export default PricesSection;

