import React, { useEffect, useMemo, useState } from "react";
import { FiClock, FiActivity, FiUser, FiInfo, FiCpu } from "react-icons/fi";

const PAGE_SIZE = 6;

const normalizeStatus = (status) => {
 const s = String(status || "").toLowerCase();
 if (["aprobado", "approved"].includes(s)) return "approved";
 if (["rechazado", "rejected"].includes(s)) return "rejected";
 if (["acta_generada", "acta_generated"].includes(s)) return "acta_generated";
 if (["modificada", "modified"].includes(s)) return "modified";
 if (["en_revision", "in_review"].includes(s)) return "in_review";
 return "pending";
};

const getStatusStyle = (status) => {
 const s = normalizeStatus(status);
 switch (s) {
 case "approved":
 return {
 label: "Aprobada",
 color: "bg-green-100 text-green-700 border-green-200",
 dot: "bg-green-500",
 };
 case "rejected":
 return {
 label: "Rechazada",
 color: "bg-red-100 text-red-700 border-red-200",
 dot: "bg-red-500",
 };
 case "in_review":
 return {
 label: "En Revisión",
 color: "bg-blue-100 text-blue-700 border-blue-200",
 dot: "bg-blue-500",
 };
 case "acta_generated":
 return {
 label: "Acta Generada",
 color: "bg-purple-100 text-purple-700 border-purple-200",
 dot: "bg-purple-500",
 };
 case "cancelled":
 return {
 label: "Cancelada",
 color: "bg-gray-200 text-gray-600 border-gray-300",
 dot: "bg-gray-400",
 };
 default:
 return {
 label: "Pendiente",
 color: "bg-amber-100 text-amber-700 border-amber-200",
 dot: "bg-amber-500",
 };
 }
};

const SolicitudesGrid = ({ items = [], onView, onCancel }) => {
 const [page, setPage] = useState(0);
 const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

 useEffect(() => {
 setPage(0);
 }, [items.length]);

 const visibleItems = useMemo(() => {
 if (!Array.isArray(items)) return [];
 const start = page * PAGE_SIZE;
 return items.slice(start, start + PAGE_SIZE).map((item) => ({
 ...item,
 status: normalizeStatus(item.status),
 }));
 }, [items, page]);

 const nextPage = () => setPage((prev) => (prev + 1) % totalPages);
 const prevPage = () => setPage((prev) => (prev - 1 + totalPages) % totalPages);

 if (!items.length) {
 return (
 <div className="py-10 text-center text-gray-500 dark:text-gray-400">
 No hay solicitudes registradas.
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
 Página {page + 1} de {totalPages}
 </p>
 {totalPages > 1 && (
 <div className="flex items-center gap-2">
 <button
 onClick={prevPage}
 className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-600"
 aria-label="Anterior"
 >
 ‹
 </button>
 <button
 onClick={nextPage}
 className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-600"
 aria-label="Siguiente"
 >
 ›
 </button>
 </div>
 )}
 </div>

 <div className="grid min-h-[28rem] grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
 {visibleItems.map((s) => {
 const { label, color, dot } = getStatusStyle(s.status);
 const payload =
 typeof s.payload === "string" ? safeJSON(s.payload) : s.payload || {};

 const requester =
 payload?.nombre_cliente ||
 payload?.solicitante ||
 payload?.cliente ||
 payload?.persona_contacto ||
 s.type_title ||
 "Solicitud";

 const mainEquipment =
 payload?.equipo_principal ||
 payload?.equipo ||
 payload?.equipment ||
 payload?.producto ||
 payload?.items?.[0]?.nombre ||
 payload?.equipos?.[0]?.nombre ||
 payload?.equipos?.[0]?.equipo ||
 payload?.items?.[0]?.equipo ||
 "—";

 const assignedTo =
 s.assigned_to_name ||
 s.assigned_to ||
 s.assigned_to_user ||
 payload?.asignado_a ||
 payload?.assigned_to ||
 "No asignado";

 const createdAt = s.created_at
 ? new Date(s.created_at).toLocaleDateString("es-EC", {
 day: "2-digit",
 month: "short",
 year: "numeric",
 hour: "2-digit",
 minute: "2-digit",
 })
 : "Fecha no disponible";

 return (
 <div
 key={s.id}
 onClick={() => onView?.(s)}
 className="group relative flex min-h-[200px] cursor-pointer flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-gray-200/20 dark:bg-gray-800/80"
 >
 <span
 className={`absolute right-4 top-4 h-3 w-3 rounded-full shadow-md ${dot}`}
 aria-hidden
 />

 <div className="flex items-start justify-between gap-3">
 <div className="space-y-2">
 <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
 #{s.id} · {s.type_title || "Solicitud"}
 </p>
 <p className="text-base font-bold text-gray-900 dark:text-white line-clamp-1 tracking-tight">
 {requester}
 </p>
 <p className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
 <FiClock className="text-gray-400 w-3 h-3" />
 {createdAt}
 </p>
 </div>
 <span
 className={`rounded-full border px-3 py-1 text-xs font-semibold ${color} border-opacity-30`}
 >
 {label}
 </span>
 </div>

 <div className="mt-5 space-y-4">
 <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md">
 <FiCpu className="w-4 h-4" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Equipo principal</p>
 <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{mainEquipment}</p>
 </div>
 </div>

 <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-md">
 <FiUser className="w-4 h-4" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Asignado a</p>
 <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{assignedTo}</p>
 </div>
 </div>
 </div>

 <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
 <div className="flex items-center gap-2">
 <FiActivity className="text-blue-500 w-3 h-3" />
 <span className="text-xs font-semibold text-blue-600 dark:text-blue-300">{label}</span>
 </div>
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 onView?.(s);
 }}
 className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-600"
 aria-label="Ver detalle"
 >
 <FiInfo className="w-3 h-3" /> Más info
 </button>
 </div>
 </div>
 );
 })}
 </div>

 {totalPages > 1 && (
 <div className="flex justify-center gap-2">
 {Array.from({ length: totalPages }).map((_, idx) => (
 <button
 key={idx}
 onClick={() => setPage(idx)}
 className={`h-2 w-8 rounded-full transition-all duration-200 ${
 idx === page
 ? "bg-blue-500 shadow-sm"
 : "bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"
 }`}
 aria-label={`Ir a la página ${idx + 1}`}
 />
 ))}
 </div>
 )}
 </div>
 );
};

const safeJSON = (txt) => {
 try {
 return JSON.parse(txt);
 } catch (err) {
 return {};
 }
};

export default SolicitudesGrid;
