import React, { useEffect, useMemo, useState } from "react";
import { FiClock, FiActivity, FiUser, FiInfo, FiCpu } from "react-icons/fi";

const PAGE_SIZE = 16;

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

const safeJSON = (txt) => {
    try {
        return typeof txt === "string" ? JSON.parse(txt) : txt || {};
    } catch (err) {
        return {};
    }
};

/**
 * Grid de solicitudes con paginación y vista de tarjetas
 * @param {Object} props
 * @param {Array} props.items - Array de solicitudes
 * @param {Function} props.onView - Callback al hacer click en una solicitud
 * @param {Function} props.onCancel - Callback para cancelar solicitud
 * @param {string} props.emptyMessage - Mensaje cuando no hay datos
 */
const SolicitudesGrid = ({
    items = [],
    onView,
    onCancel,
    emptyMessage = "No hay solicitudes registradas.",
    variant,
}) => {
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
                {emptyMessage}
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
                            className="rounded-full border border-gray-300 p-2 text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            aria-label="Anterior"
                        >
                            ‹
                        </button>
                        <button
                            onClick={nextPage}
                            className="rounded-full border border-gray-300 p-2 text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            aria-label="Siguiente"
                        >
                            ›
                        </button>
                    </div>
                )}
            </div>

                    <div className="grid min-h-[28rem] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                        {visibleItems.map((s) => {
                            const { label, color, dot } = getStatusStyle(s.status);
                            const payload = safeJSON(s.payload);
                            const requester =
                                payload?.nombre_cliente ||
                                s.commercial_name ||
                                s.requester_name ||
                                s.requester_email ||
                                s.type_title ||
                                "Solicitud";
                            const mainEquipment =
                                payload?.equipos?.[0]?.nombre_equipo ||
                                payload?.equipo_principal ||
                                payload?.equipo ||
                                payload?.producto ||
                                payload?.items?.[0]?.nombre ||
                                payload?.equipos?.[0]?.nombre ||
                                payload?.items?.[0]?.equipo ||
                                payload?.equipment ||
                                s.type_title ||
                                "Solicitud";
                            const assignedTo =
                                s.assigned_to_name ||
                                s.assigned_to ||
                                s.assigned_to_user ||
                                payload?.asignado_a ||
                                payload?.assigned_to ||
                                s.created_by ||
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

                            if (variant === "client_request") {
                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => onView?.(s)}
                                className="group relative flex min-h-[220px] cursor-pointer flex-col justify-between rounded-3xl border border-blue-50 bg-gradient-to-br from-blue-50 to-white px-5 py-4 text-sm shadow-lg transition duration-200 hover:-translate-y-0.5 hover:shadow-xl dark:border-blue-900/40 dark:bg-slate-900/70 overflow-hidden"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-500">
                                                    REG #{s.id}
                                                </p>
                                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white line-clamp-1">
                                                    {requester}
                                                </h3>
                                            </div>
                                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${color}`}>
                                                {label}
                                            </span>
                                        </div>

                                        <div className="grid gap-3 text-gray-600 dark:text-gray-300 text-sm mt-4 md:grid-cols-2">
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-gray-500">RUC / Cédula</p>
                                                <p className="font-semibold text-gray-900 dark:text-white break-words">{s.ruc_cedula || "No disponible"}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-gray-500">Solicitante</p>
                                                <p className="font-semibold text-gray-900 dark:text-white break-words">{s.created_by || "Sin responsable"}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-gray-500">Creada</p>
                                                <p className="font-semibold text-gray-900 dark:text-white text-sm">{createdAt}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-gray-500">Estado</p>
                                                <p className="font-semibold text-gray-900 dark:text-white">{label}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center justify-between border-t border-blue-100 pt-3 text-xs text-blue-600 dark:border-blue-900">
                                            <span className="text-[11px] font-semibold uppercase tracking-widest text-blue-500/80">
                                                Solicitud de cliente
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onView?.(s);
                                                }}
                                                className="rounded-full border border-blue-200 bg-white/60 px-3 py-1 font-semibold transition hover:border-blue-300 dark:border-blue-700 dark:bg-blue-900/40"
                                            >
                                                Ver solicitud
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            if (variant === "technical") {
                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => onView?.(s)}
                                        className="group relative flex min-h-[220px] cursor-pointer flex-col justify-between rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 text-sm shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900/40"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500">
                                                    Solicitud #{s.id}
                                                </p>
                                                <p className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1">
                                                    {requester}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {s.type_title || "Solicitud técnica"}
                                                </p>
                                            </div>
                                            <span className={`rounded-full border px-2 py-[2px] text-xs font-semibold ${color}`}>
                                                {label}
                                            </span>
                                        </div>

                                        <div className="mt-5 grid gap-3 text-gray-700 dark:text-gray-200">
                                            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
                                                <span>Solicitante</span>
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white">{requester}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
                                                <span>Estado actual</span>
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
                                                <span>Creada</span>
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white">{createdAt}</span>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-col gap-4 border-t border-gray-200 pt-4 text-sm text-gray-700 dark:text-gray-200 md:flex-row md:items-center md:justify-between">
                                            <div className="flex items-center gap-2">
                                                <FiCpu className="text-blue-500" />
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-gray-500">Equipo principal</p>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{mainEquipment}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <FiUser className="text-gray-600" />
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-gray-500">Asignado a</p>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{assignedTo}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-blue-600 dark:border-gray-700">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onView?.(s);
                                                }}
                                                className="font-semibold"
                                            >
                                                Ver detalle completo
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={s.id}
                                    onClick={() => onView?.(s)}
                                className="group relative flex min-h-[200px] cursor-pointer flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 text-sm shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 overflow-hidden"
                                >
                                    <span
                                        className={`absolute right-4 top-4 h-2.5 w-2.5 rounded-full shadow-sm ${dot}`}
                                        aria-hidden
                                    />

                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                #{s.id} · {s.type_title || "Solicitud"}
                                            </p>
                                            <p className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1">
                                                {requester}
                                            </p>
                                            </div>
                                            <span
                                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${color}`}
                                            >
                                            {label}
                                        </span>
                                    </div>

                                    <div className="grid gap-3 text-gray-600 dark:text-gray-300 sm:grid-cols-2">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                                                <FiActivity />
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Detalle</p>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{mainEquipment}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-50 text-gray-600 dark:bg-gray-900/40 dark:text-gray-200">
                                                <FiUser />
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Asignado a</p>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1 break-words">{assignedTo}</p>
                                            </div>
                                        </div>
                                    </div>

                                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                            <div className="flex items-center gap-2">
                                            <FiClock className="text-blue-500" />
                                            <span className="font-semibold text-gray-700 dark:text-gray-200">{createdAt}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onView?.(s);
                                            }}
                                            className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-500"
                                            aria-label="Ver detalle"
                                        >
                                            <FiInfo /> Más info
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
                            className={`h-2 w-8 rounded-full transition ${idx === page
                                    ? "bg-primary"
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

export default SolicitudesGrid;
