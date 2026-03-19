import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { FiTruck, FiRefreshCw, FiCheckCircle, FiClock, FiFileText } from "react-icons/fi";

import { useApi } from "../../core/hooks/useApi";
import { useUI } from "../../core/ui/useUI";
import { getPrivatePurchasesByRole } from "../../core/api/privatePurchasesApi";
import StatCard from "../../core/ui/patterns/StatCard";
import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";
import { DashboardLayout, DashboardHeader } from "../../core/ui/layouts/DashboardLayout";

const normalizeStatus = (status) => String(status || "").toLowerCase();

const DashboardLogistica = () => {
 const { showToast } = useUI();

 const {
 data: purchasesData,
 loading,
 execute: loadPurchases,
 } = useApi(() => getPrivatePurchasesByRole("jefe_logistica"), {
 errorMsg: "No se pudieron cargar las compras de logistica.",
 });

 const purchasesRef = useRef(loadPurchases);
 useEffect(() => {
 purchasesRef.current = loadPurchases;
 }, [loadPurchases]);

 const refresh = useCallback(async () => {
 try {
 await purchasesRef.current();
 } catch (error) {
 console.error("DashboardLogistica refresh error:", error);
 showToast("No se pudo actualizar el panel de logistica.", "error");
 }
 }, [showToast]);

 useEffect(() => {
 refresh();
 }, [refresh]);

 const purchases = useMemo(() => {
 if (Array.isArray(purchasesData)) return purchasesData;
 if (Array.isArray(purchasesData?.rows)) return purchasesData.rows;
 return [];
 }, [purchasesData]);

 const buckets = useMemo(() => {
 const acc = {
 delivery_dates_submitted: 0,
 waiting_dispatch: 0,
 dispatch_ready: 0,
 delivery_act_generated: 0,
 delivered_signed: 0,
 };
 purchases.forEach((purchase) => {
 const status = normalizeStatus(purchase.status);
 if (acc[status] !== undefined) {
 acc[status] += 1;
 }
 });
 return acc;
 }, [purchases]);

 const pendingDispatch = (buckets.waiting_dispatch || 0) + (buckets.dispatch_ready || 0);

 const recentPurchases = useMemo(() => purchases.slice(0, 6), [purchases]);

 return (
 <DashboardLayout includeWidgets={false}>
 <DashboardHeader
 title="Logistica"
 subtitle="Despachos y actas de entrega de compras privadas"
 actions={
 <Button variant="secondary" icon={FiRefreshCw} onClick={refresh}>
 Actualizar
 </Button>
 }
 />

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <StatCard
 icon={FiClock}
 label="Fecha de entrega registrada"
 value={buckets.delivery_dates_submitted || 0}
 color="blue"
 />
 <StatCard
 icon={FiTruck}
 label="Pendientes de despacho"
 value={pendingDispatch}
 color="amber"
 />
 <StatCard
 icon={FiFileText}
 label="Actas generadas"
 value={buckets.delivery_act_generated || 0}
 color="indigo"
 />
 <StatCard
 icon={FiCheckCircle}
 label="Entregas confirmadas"
 value={buckets.delivered_signed || 0}
 color="emerald"
 />
 </div>

 <Card className="p-5 space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-semibold text-gray-900">Ultimas compras privadas</h2>
 <span className="text-sm text-gray-500">{purchases.length} solicitudes</span>
 </div>

 {loading ? (
 <p className="text-sm text-gray-500">Cargando...</p>
 ) : recentPurchases.length ? (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {recentPurchases.map((purchase) => (
 <div
 key={purchase.id}
 className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
 >
 <p className="text-xs text-gray-500">Solicitud</p>
 <p className="text-sm font-semibold text-gray-900">{purchase.id}</p>
 <p className="mt-2 text-xs text-gray-500">Cliente</p>
 <p className="text-sm text-gray-700">
 {purchase.client_snapshot?.commercial_name ||
 purchase.client_snapshot?.name ||
 "Cliente sin nombre"}
 </p>
 <p className="mt-2 text-xs text-gray-500">Estado</p>
 <p className="text-sm text-gray-700">
 {normalizeStatus(purchase.status).replace(/_/g, " ")}
 </p>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-gray-500">No hay compras privadas para mostrar.</p>
 )}
 </Card>
 </DashboardLayout>
 );
};

export default DashboardLogistica;
