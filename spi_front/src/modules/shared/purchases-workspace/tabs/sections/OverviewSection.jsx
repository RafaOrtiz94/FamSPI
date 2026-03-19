import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
 FiShoppingCart,
 FiCheckCircle,
 FiClock,
 FiZap,
} from "react-icons/fi";
import Card from "../../../../../core/ui/components/Card";
import { getEquipmentPurchaseStats } from "../../../../../core/api/equipmentPurchasesApi";
import { RequestActionButton } from "../../../../../core/ui/components/RequestActionCards";
import { usePurchaseSSE } from "../../../../../core/hooks/usePurchaseSSE";
import {
 PUBLIC_PURCHASE_STATUS_OVERVIEW,
 getPublicPurchaseActiveCount,
} from "../../../constants/publicPurchaseConstants";

export const OverviewSection = () => {
 const [stats, setStats] = useState({});

 const loadStats = useCallback(async () => {
 try {
 const data = await getEquipmentPurchaseStats();
 setStats(data);
 } catch (error) {
 console.error('Error loading stats:', error);
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
 const processCount = getPublicPurchaseActiveCount(stats);

 const kpis = [
 {
 key: "total",
 label: "Total solicitudes",
 value: totalRequests,
 hint: "Compras públicas activas",
 icon: FiShoppingCart,
 },
 {
 key: "completed",
 label: "Completadas",
 value: stats?.completed ?? 0,
 hint: "Solicitudes finalizadas",
 icon: FiCheckCircle,
 },
 {
 key: "process",
 label: "En proceso",
 value: processCount,
 hint: "Esperando acciones",
 icon: FiClock,
 },
 {
 key: "efficiency",
 label: "Eficiencia",
 value: `${totalRequests > 0 ? Math.round(((stats?.completed ?? 0) / totalRequests) * 100) : 0}%`,
 hint: "Tasa de completación",
 icon: FiZap,
 },
 ];

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="space-y-5"
 >
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
 {kpis.map((item) => {
 const Icon = item.icon;
 return (
 <Card key={item.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
 <p className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</p>
 <p className="text-xs text-slate-500">{item.hint}</p>
 </div>
 <div className="rounded-lg bg-slate-100 p-2.5">
 <Icon className="text-slate-700" size={18} />
 </div>
 </div>
 </Card>
 );
 })}
 </div>

 <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-base font-semibold text-slate-900">Estado de solicitudes</h3>
 <p className="text-xs text-slate-500">Distribución por etapa del flujo</p>
 </div>
 </div>
 <RequestActionButton type="PUBLIC_PURCHASE" size="sm" />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
 {PUBLIC_PURCHASE_STATUS_OVERVIEW.map((item, index) => (
 <motion.div
 key={item.key}
 initial={{ opacity: 0, scale: 0.9 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: index * 0.1 }}
 className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
 >
 <div>
 <p className="text-sm font-medium text-slate-900">{item.label}</p>
 <p className="text-[11px] text-slate-500">Estado del proceso</p>
 </div>
 <div className="text-right">
 <p className="text-xl font-semibold text-slate-900">{stats?.[item.key] ?? 0}</p>
 <p className="text-[11px] text-slate-500">solicitudes</p>
 </div>
 </motion.div>
 ))}
 </div>
 </Card>
 </motion.div>
 );
};
