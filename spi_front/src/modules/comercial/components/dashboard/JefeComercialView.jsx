import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
 FiClipboard,
 FiUsers,
 FiCalendar,
 FiFileText,
 FiCheckCircle,
 FiLayers,
 FiShoppingCart,
 FiShield,
 FiRefreshCw,
 FiX,
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { DashboardHeader } from "../../../../core/ui/layouts/DashboardLayout";
import StatsCard from "../shared/StatsCard";

const quickAccessLinks = [
 {
 label: "Solicitudes",
 description: "Historial comercial",
 icon: FiClipboard,
 path: "/dashboard/comercial/solicitudes",
 gradient: "from-sky-500 to-sky-700",
 color: "blue",
 },
 {
 label: "Clientes",
 description: "Gestión comercial",
 icon: FiUsers,
 path: "/dashboard/comercial/clientes",
 gradient: "from-emerald-500 to-emerald-700",
 color: "emerald",
 },
 {
 label: "Planificación",
 description: "Cronograma",
 icon: FiCalendar,
 path: "/dashboard/comercial/planificacion",
 gradient: "from-purple-500 to-purple-700",
 color: "indigo",
 },
 {
 label: "Aprobaciones",
 description: "Planes mensuales",
 icon: FiCheckCircle,
 path: "/dashboard/comercial/aprobaciones-planificacion",
 gradient: "from-amber-500 to-amber-700",
 color: "amber",
 },
 {
 label: "Workspace",
 description: "Compras",
 icon: FiShoppingCart,
 path: "/dashboard/purchases/workspace",
 gradient: "from-indigo-500 to-indigo-700",
 color: "indigo",
 },
 {
 label: "Business Case",
 description: "Seguimiento",
 icon: FiFileText,
 path: "/dashboard/business-case",
 gradient: "from-orange-500 to-orange-700",
 color: "orange",
 },
 {
 label: "Auditoría",
 description: "Preparación",
 icon: FiShield,
 path: "/dashboard/auditoria/preparacion",
 gradient: "from-slate-500 to-slate-700",
 color: "slate",
 },
 {
 label: "Compras Privadas",
 description: "Supervisión",
 icon: FiLayers,
 path: "/dashboard/backoffice/private-purchases",
 gradient: "from-fuchsia-500 to-fuchsia-700",
 color: "fuchsia",
 },
];

const tabLinks = [
 { label: "Solicitudes", path: "/dashboard/comercial/solicitudes" },
 { label: "Clientes", path: "/dashboard/comercial/clientes" },
 { label: "Workspace", path: "/dashboard/purchases/workspace" },
 { label: "Business Case", path: "/dashboard/business-case" },
 { label: "Permisos", path: "/dashboard/talento-humano/permisos" },
];

const fallbackData = {
 kpis: {
 totalBC: 0,
 bcActivos: 0,
 bcCompletados: 0,
 solicitudesPendientes: 0,
 clientesNuevos30d: 0,
 },
};

const JefeComercialView = ({ onRefresh, summaryData, summaryLoading, summaryError }) => {
 const navigate = useNavigate();
 const location = useLocation();
 const data = summaryData?.data || fallbackData;
 const isLoading = summaryLoading && !summaryError;
 const kpis = data?.kpis || fallbackData.kpis;
 const alerts = data?.alerts || [];

 const stats = [
 {
 title: "Solicitudes",
 value: isLoading ? "..." : (kpis.solicitudesPendientes ?? 0),
 subtitle: "Pendientes de revisión",
 icon: FiClipboard,
 colors: "from-blue-50 via-blue-100 to-blue-200",
 borderColor: "border-blue-500/30",
 shadowColor: "shadow-blue-100/30",
 iconBg: "bg-gradient-to-br from-blue-500 to-blue-600",
 textColor: "text-blue-800",
 valueColor: "text-blue-900",
 },
 {
 title: "Business Case",
 value: isLoading ? "..." : (kpis.totalBC ?? 0),
 subtitle: "Total en portafolio",
 icon: FiFileText,
 colors: "from-emerald-50 via-emerald-100 to-emerald-200",
 borderColor: "border-emerald-500/30",
 shadowColor: "shadow-emerald-100/30",
 iconBg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
 textColor: "text-emerald-800",
 valueColor: "text-emerald-900",
 },
 {
 title: "BC activos",
 value: isLoading ? "..." : (kpis.bcActivos ?? 0),
 subtitle: "En progreso",
 icon: FiLayers,
 colors: "from-amber-50 via-amber-100 to-amber-200",
 borderColor: "border-amber-500/30",
 shadowColor: "shadow-amber-100/30",
 iconBg: "bg-gradient-to-br from-amber-500 to-amber-600",
 textColor: "text-amber-800",
 valueColor: "text-amber-900",
 },
 {
 title: "Cumplimiento",
 value: isLoading ? "..." : `${kpis.avgCompliance ?? 0}%`,
 subtitle: "Eficacia de visitas",
 icon: FiCheckCircle,
 colors: "from-purple-50 via-purple-100 to-purple-200",
 borderColor: "border-purple-500/30",
 shadowColor: "shadow-purple-100/30",
 iconBg: "bg-gradient-to-br from-purple-500 to-purple-600",
 textColor: "text-purple-800",
 valueColor: "text-purple-900",
 },
 {
 title: "Clientes",
 value: isLoading ? "..." : (kpis.clientesNuevos30d ?? 0),
 subtitle: "Nuevos 30 días",
 icon: FiUsers,
 colors: "from-indigo-50 via-indigo-100 to-indigo-200",
 borderColor: "border-indigo-500/30",
 shadowColor: "shadow-indigo-100/30",
 iconBg: "bg-gradient-to-br from-indigo-500 to-indigo-600",
 textColor: "text-indigo-800",
 valueColor: "text-indigo-900",
 },
 ];

 return (
 <>
 <DashboardHeader
 title="Dashboard Gerencia Comercial"
 subtitle="Visión ejecutiva y accesos rápidos"
 actions={
 <Button variant="secondary" icon={FiRefreshCw} onClick={onRefresh}>
 Actualizar
 </Button>
 }
 />

 <section className="rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 px-4 py-6 sm:px-6 sm:py-8 text-white shadow-[0_20px_45px_-20px_rgba(30,64,175,0.7)] mb-6 border border-white/20">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
 Panel Ejecutivo Comercial
 </h2>
 <p className="text-sm sm:text-base text-blue-100 mt-1">
 Supervisa accesos clave y coordinación del equipo.
 </p>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-xs sm:text-sm bg-white/20 backdrop-blur px-3 py-1 rounded-full">
 {new Date().toLocaleDateString("es-EC", { day: "numeric", month: "short" })}
 </span>
 </div>
 </div>
 </section>

 {summaryError && (
 <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
 No se pudieron cargar los KPIs en este momento. Reintenta con “Actualizar”.
 </div>
 )}

 <section className="mb-6">
 <div className="flex items-center gap-3 overflow-x-auto pb-2">
 {tabLinks.map((tab) => (
 <button
 key={tab.path}
 type="button"
 onClick={() => navigate(tab.path)}
 className={`shrink-0 rounded-xl border px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 ${location.pathname.startsWith(tab.path)
 ? "border-blue-200 bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20"
 : "border-gray-200/70 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900"
 }`}
 >
 {tab.label}
 </button>
 ))}
 </div>
 </section>

 <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
 {stats.map((item) => (
 <StatsCard key={item.title} {...item} className="rounded-2xl border-0 shadow-lg" />
 ))}
 </section>

 {alerts.length > 0 && (
 <section className="mb-8">
 <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
 <div className="flex items-center gap-2 mb-4">
 <FiShield className="text-amber-600" size={20} />
 <h3 className="text-lg font-bold text-amber-900">Alertas de Talento Humano</h3>
 </div>
 <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
 {alerts.map((alert) => (
 <div key={alert.email} className="flex flex-col p-3 rounded-xl bg-white border border-amber-100 shadow-sm">
 <p className="font-semibold text-gray-900">{alert.name}</p>
 <p className="text-xs text-gray-500 mb-2">{alert.email}</p>
 {alert.status !== "activo" && (
 <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 uppercase mb-1">
 <FiX size={12} /> {alert.status}
 </span>
 )}
 {alert.permit && (
 <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 uppercase">
 <FiCalendar size={12} /> {alert.permit.tipo} (hasta {new Date(alert.permit.hasta).toLocaleDateString()})
 </span>
 )}
 <div className="mt-3 pt-3 border-t border-gray-50">
 <p className="text-[10px] text-gray-400 uppercase font-bold mb-2">Acción sugerida</p>
 <Button
 size="xs"
 variant="secondary"
 className="w-full text-[10px]"
 onClick={() => navigate("/dashboard/comercial/clientes")}
 >
 Reasignar Clientes
 </Button>
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>
 )}

 <section className="mb-8">
 <Card className="p-4 border-0 shadow-lg shadow-gray-100/50 rounded-2xl bg-white">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-lg font-bold text-gray-900 tracking-tight">Accesos rápidos</h3>
 <p className="text-gray-600 mt-0.5 text-sm">
 Herramientas clave para la gerencia comercial
 </p>
 </div>
 <span className="text-xs text-gray-500">Disponible en móvil</span>
 </div>

 <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
 {quickAccessLinks.map((link) => (
 <Button
 key={link.path}
 onClick={() => navigate(link.path)}
 className={`p-3 h-14 transition-all duration-200 rounded-xl border-0 shadow-sm hover:shadow-md active:scale-95 bg-gradient-to-br ${link.gradient}`}
 >
 <div className="flex items-center gap-2 w-full">
 <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
 <link.icon size={14} className="text-white" />
 </div>
 <div className="text-left flex-1 min-w-0">
 <div className="font-semibold text-white text-xs leading-tight truncate">{link.label}</div>
 <div className="text-white/80 text-[11px] leading-tight truncate">{link.description}</div>
 </div>
 </div>
 </Button>
 ))}
 </div>
 </Card>
 </section>
 </>
 );
};

export default JefeComercialView;
