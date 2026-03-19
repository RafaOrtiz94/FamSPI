import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
 FiAlertTriangle,
 FiCheckCircle,
 FiClock,
 FiTarget,
} from "react-icons/fi";
import Card from "../../../../../core/ui/components/Card";
import { getEquipmentPurchaseStats } from "../../../../../core/api/equipmentPurchasesApi";
import { usePurchaseSSE } from "../../../../../core/hooks/usePurchaseSSE";
import { getPublicPurchaseActiveCount } from "../../../constants/publicPurchaseConstants";

export const AnalyticsSection = () => {
 const [stats, setStats] = useState({});
 const [loadingStats, setLoadingStats] = useState(false);

 const loadStats = useCallback(async () => {
 setLoadingStats(true);
 try {
 const data = await getEquipmentPurchaseStats();
 setStats(data || {});
 } catch (_error) {
 setStats({});
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
 debounceMs: 8000,
 });

 const totalRequests = Number(stats?.total || 0);
 const completedRequests = Number(stats?.completed || 0);
 const completionRate = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;
 const activeRequests = getPublicPurchaseActiveCount(stats);
 const pendingProvider = Number(stats?.waiting_provider_response || 0);
 const pendingInspectionCoordination = Number(stats?.pending_inspection_coordination || 0);
 const coordinatedPendingContract = Number(stats?.coordinated_pending_contract || 0);
 const inspectionWindowExpired = Number(stats?.inspection_window_expired || 0);

 const cards = [
 {
 key: "completion",
 title: "Tasa de completación",
 value: `${completionRate}%`,
 hint: `${completedRequests} de ${totalRequests} finalizadas`,
 icon: FiTarget,
 },
 {
 key: "active",
 title: "Solicitudes activas",
 value: activeRequests,
 hint: "Casos en ejecución",
 icon: FiClock,
 },
 {
 key: "pending_coord",
 title: "Pendiente coordinar inspección",
 value: pendingInspectionCoordination,
 hint: "En estado pendiente contrato sin fecha",
 icon: FiAlertTriangle,
 },
 {
 key: "coord_ready",
 title: "Con fecha de inspección",
 value: coordinatedPendingContract,
 hint: "Pendiente contrato con coordinación lista",
 icon: FiCheckCircle,
 },
 ];

 const kpis = [
 { label: "Pendiente proveedor", value: pendingProvider },
 { label: "Solicitando proforma", value: Number(stats?.waiting_proforma || 0) },
 { label: "Proforma recibida", value: Number(stats?.proforma_received || 0) },
 { label: "Esperando proforma firmada", value: Number(stats?.waiting_signed_proforma || 0) },
 { label: "Ventana de inspección vencida", value: inspectionWindowExpired },
 { label: "Completadas", value: completedRequests },
 ];

 return (
 <motion.div
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 className="space-y-4"
 >
 <div>
 <h2 className="text-base font-semibold text-slate-900">Análisis de Compras Públicas</h2>
 <p className="text-xs text-slate-500">Métricas operativas en tiempo real para control del flujo ACP.</p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
 {cards.map((card) => {
 const Icon = card.icon;
 return (
 <Card key={card.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-[11px] uppercase tracking-wide text-slate-500">{card.title}</p>
 <p className="mt-1 text-2xl font-semibold text-slate-900">{loadingStats ? "--" : card.value}</p>
 <p className="text-xs text-slate-500">{card.hint}</p>
 </div>
 <div className="rounded-lg bg-slate-100 p-2.5">
 <Icon className="text-slate-700" size={16} />
 </div>
 </div>
 </Card>
 );
 })}
 </div>

 <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
 <h3 className="text-sm font-semibold text-slate-900 mb-2">Distribución por estado</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
 {kpis.map((item) => (
 <div
 key={item.label}
 className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
 >
 <span className="text-xs text-slate-700">{item.label}</span>
 <span className="text-sm font-semibold text-slate-900">{loadingStats ? "--" : item.value}</span>
 </div>
 ))}
 </div>
 </Card>
 </motion.div>
 );
};
