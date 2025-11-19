import React, { useEffect, useMemo, useState } from "react";
import {
  FiEye,
  FiTrash2,
  FiPaperclip,
  FiClock,
  FiActivity,
} from "react-icons/fi";

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
      return { label: "Aprobada", color: "bg-green-100 text-green-700 border-green-200" };
    case "rejected":
      return { label: "Rechazada", color: "bg-red-100 text-red-700 border-red-200" };
    case "in_review":
      return { label: "En Revisión", color: "bg-blue-100 text-blue-700 border-blue-200" };
    case "acta_generated":
      return { label: "Acta Generada", color: "bg-purple-100 text-purple-700 border-purple-200" };
    case "cancelled":
      return { label: "Cancelada", color: "bg-gray-200 text-gray-600 border-gray-300" };
    default:
      return { label: "Pendiente", color: "bg-amber-100 text-amber-700 border-amber-200" };
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

      <div className="grid min-h-[28rem] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((s) => {
          const { label, color } = getStatusStyle(s.status);
          const payload =
            typeof s.payload === "string" ? safeJSON(s.payload) : s.payload || {};

          return (
            <div
              key={s.id}
              className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  #{s.id} — {s.type_title || "Solicitud"}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}
                >
                  {label}
                </span>
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <p className="flex items-center gap-1 text-gray-700 dark:text-gray-200">
                  <FiActivity className="text-accent" />{" "}
                  <span className="font-medium">{payload?.nombre_cliente || "—"}</span>
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  Contacto: <span className="font-medium">{payload?.persona_contacto || "—"}</span>
                </p>
                {payload?.direccion_cliente && (
                  <p className="truncate text-gray-600 dark:text-gray-300">
                    {payload.direccion_cliente}
                  </p>
                )}
                <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <FiClock />
                  {new Date(s.created_at).toLocaleDateString("es-EC", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {Array.isArray(s.attachments) && s.attachments.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <FiPaperclip /> {s.attachments.length} adjunto(s)
                </div>
              )}

              <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                <button
                  onClick={() => onView(s)}
                  className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  <FiEye /> Ver
                </button>
                {["pending", "in_review", "acta_generated"].includes(s.status) && (
                  <button
                    onClick={() => onCancel(s)}
                    className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100"
                  >
                    <FiTrash2 /> Cancelar
                  </button>
                )}
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
