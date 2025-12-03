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
              className="group relative flex min-h-[180px] cursor-pointer flex-col justify-between rounded-xl border border-gray-100 bg-white p-4 text-sm shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <span
                className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full shadow-sm ${dot}`}
                aria-hidden
              />

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    #{s.id} · {s.type_title || "Solicitud"}
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white line-clamp-1">
                    {requester}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <FiClock className="text-gray-400" />
                    {createdAt}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-[2px] text-xs font-semibold ${color}`}
                >
                  {label}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                    <FiCpu />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Equipo principal</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{mainEquipment}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-gray-600 dark:bg-gray-900/40 dark:text-gray-200">
                    <FiUser />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Asignado a</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{assignedTo}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <FiActivity className="text-blue-500" />
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-300">{label}</span>
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
              className={`h-2 w-8 rounded-full transition ${
                idx === page
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

const safeJSON = (txt) => {
  try {
    return JSON.parse(txt);
  } catch (err) {
    return {};
  }
};

export default SolicitudesGrid;
