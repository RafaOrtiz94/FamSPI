import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
 FiBell,
 FiCheckCircle,
 FiAlertTriangle,
 FiInfo,
 FiZap,
 FiX,
 FiShoppingCart,
 FiPackage,
 FiCalendar,
 FiFileText,
} from "react-icons/fi";
import { useNotifications } from "../NotificationContext";

const typeIcon = {
 alert: <FiAlertTriangle className="text-amber-500" />,
 task: <FiCheckCircle className="text-emerald-500" />,
 info: <FiInfo className="text-sky-500" />,
};

const formatDate = (dateString) => {
 if (!dateString) return "";
 const date = new Date(dateString);
 return date.toLocaleString();
};

const normalizeSource = (source) => String(source || "").trim().toLowerCase();

const getMetaValue = (notification, keys = []) => {
 const meta = notification?.meta || {};
 const data = meta?.data || {};

 for (const key of keys) {
 if (meta[key] !== undefined && meta[key] !== null && meta[key] !== "") return meta[key];
 if (data[key] !== undefined && data[key] !== null && data[key] !== "") return data[key];
 }

 return null;
};

const resolveNotificationIcon = (notification) => {
 const source = normalizeSource(notification?.source);
 const tipoSolicitud = String(getMetaValue(notification, ["tipo_solicitud"]) || "").toLowerCase();

 if (source.startsWith("private_purchase")) {
 return <FiShoppingCart className="text-cyan-600" />;
 }

 if (source.startsWith("equipment_purchase") || source.startsWith("equipment_purchases")) {
 return <FiPackage className="text-indigo-600" />;
 }

 if (source.startsWith("permisos_vacaciones") || source.startsWith("vacaciones")) {
 if (tipoSolicitud === "vacaciones" || source.startsWith("vacaciones")) {
 return <FiCalendar className="text-emerald-600" />;
 }
 return <FiFileText className="text-amber-600" />;
 }

 return typeIcon[notification?.type] || <FiInfo className="text-slate-400" />;
};

export default function NotificationBell() {
 const {
 notifications,
 unreadCount,
 markAsRead,
 markAll,
 removeNotification,
 clearAll,
 loading,
 } = useNotifications();
 const [open, setOpen] = useState(false);
 const containerRef = useRef(null);
 const navigate = useNavigate();
 const containerClassName = "fixed bottom-4 right-4 z-[90] sm:bottom-6 sm:right-6";

 useEffect(() => {
 if (!open) return undefined;

 const handleOutsideClick = (event) => {
 const node = containerRef.current;
 if (!node) return;
 if (!node.contains(event.target)) {
 setOpen(false);
 }
 };

 document.addEventListener("mousedown", handleOutsideClick);
 document.addEventListener("touchstart", handleOutsideClick);

 return () => {
 document.removeEventListener("mousedown", handleOutsideClick);
 document.removeEventListener("touchstart", handleOutsideClick);
 };
 }, [open]);

 const recent = useMemo(() => {
 const sorted = [...notifications].sort((a, b) => {
 const priorityScore = (b.priority || 0) - (a.priority || 0);
 if (priorityScore !== 0) return priorityScore;

 return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
 });
 return sorted.slice(0, 6);
 }, [notifications]);

 const resolveFallbackTargetPath = (notification) => {
 const source = normalizeSource(notification?.source);
 const purchaseId = getMetaValue(notification, ["purchase_id", "purchaseId"]);
 const publicRequestId = getMetaValue(notification, ["request_id", "requestId"]);
 const solicitudId = getMetaValue(notification, ["solicitud_id", "solicitudId"]);
 const businessCaseId = getMetaValue(notification, ["business_case_id", "businessCaseId", "bc_id", "bcId"]);

 if (source.startsWith("private_purchase") && purchaseId) {
 return `/dashboard/purchases/workspace?tab=private&requestId=${purchaseId}&requestType=private`;
 }

 if ((source.startsWith("equipment_purchase") || source.startsWith("equipment_purchases")) && publicRequestId) {
 return `/dashboard/purchases/workspace?tab=public&requestId=${publicRequestId}&requestType=public`;
 }

 if ((source.startsWith("permisos_vacaciones") || source.startsWith("vacaciones")) && solicitudId) {
 return `/dashboard/talento-humano/permisos?solicitudId=${solicitudId}`;
 }

 if (source.startsWith("business_case") && businessCaseId) {
 return `/dashboard/business-case/workspace/${businessCaseId}`;
 }

 return null;
 };

 const resolveTargetPath = (notification) => {
 const metaTargetPath = getMetaValue(notification, [
 "target_path",
 "targetPath",
 "url",
 "path",
 "redirect_to",
 "redirectTo",
 ]);
 if (metaTargetPath) return metaTargetPath;
 return resolveFallbackTargetPath(notification);
 };

 const handleItemClick = async (notification) => {
 if (!notification) return;
 await markAsRead(notification.id);

 const targetPath = resolveTargetPath(notification);
 if (targetPath) {
 setOpen(false);
 navigate(targetPath);
 }
 };

 return (
 <div ref={containerRef} className={containerClassName}>
 <button
 onClick={() => setOpen((v) => !v)}
 className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg shadow-slate-900/20 transition hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-accent"
 title="Notificaciones"
 >
 <FiBell className="text-white" size={20} />
 {unreadCount > 0 && (
 <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-rose-500 text-white text-[10px] rounded-full">
 {unreadCount}
 </span>
 )}
 </button>

 {open && (
 <div className="absolute bottom-[3.75rem] right-0 w-[min(22rem,calc(100vw-1.5rem))] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
 <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
 <div>
 <p className="text-sm font-semibold text-slate-800">Notificaciones</p>
 <p className="text-[12px] text-slate-500">
 {loading ? "Cargando..." : `${unreadCount} sin leer`}
 </p>
 </div>
 <div className="flex items-center gap-2 text-[12px]">
 <button
 onClick={markAll}
 className="text-accent hover:text-accent-dark"
 >
 Marcar todas
 </button>
 <span className="text-slate-300">|</span>
 <button
 onClick={clearAll}
 className="text-rose-500 hover:text-rose-600"
 >
 Limpiar
 </button>
 </div>
 </div>

 <div className="max-h-[70vh] overflow-y-auto">
 {recent.length === 0 && (
 <p className="p-4 text-sm text-slate-500">No hay notificaciones</p>
 )}
 {recent.map((notif) => (
 <div
 key={notif.id}
 role="button"
 tabIndex={0}
 onClick={() => handleItemClick(notif)}
 onKeyDown={(event) => {
 if (event.key === "Enter" || event.key === " ") {
 event.preventDefault();
 handleItemClick(notif);
 }
 }}
 className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 transition cursor-pointer ${notif.status !== "read" ? "bg-amber-50/70" : ""
 }`}
 >
 <div className="mt-1">
 {resolveNotificationIcon(notif)}
 </div>
 <div className="flex-1">
 <div className="flex items-center justify-between gap-2">
 <p className="text-sm font-semibold text-slate-900 line-clamp-1">
 {notif.title}
 </p>
 {notif.priority >= 2 && (
 <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
 <FiZap className="text-amber-500" />
 Alta
 </span>
 )}
 </div>
 {notif.message && (
 <p className="text-xs text-slate-600 line-clamp-2">{notif.message}</p>
 )}
 <p className="text-[11px] text-slate-400 mt-1">{formatDate(notif.created_at)}</p>
 </div>
 <button
 onClick={(event) => {
 event.stopPropagation();
 removeNotification(notif.id);
 }}
 className="mt-1 text-slate-300 hover:text-rose-500"
 title="Eliminar"
 aria-label="Eliminar notificacion"
 >
 <FiX size={16} />
 </button>
 {notif.status !== "read" && (
 <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
 )}
 </div>
 ))}
 </div>
 <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2">
   <p className="text-[11px] text-slate-500">
     {notifications.length > 6 ? `${notifications.length - 6} mas sin mostrar` : "Mostrando las mas recientes"}
   </p>
   <button
     type="button"
     onClick={() => { setOpen(false); navigate("/dashboard/notificaciones"); }}
     className="cursor-pointer text-[11px] font-semibold text-accent hover:text-accent-dark"
   >
     Ver todas →
   </button>
 </div>
 </div>
 )}
 </div>
 );
}
