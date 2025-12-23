import React from "react";
import { FiActivity, FiClock, FiEye, FiTrash2 } from "react-icons/fi";

const STATUS_META = {
  approved: {
    label: "Aprobada",
    badge: "bg-green-100 text-green-700 border-green-200",
    border: "border-green-100",
    gradient: "from-green-50 via-white to-white",
    accent: "text-green-600",
  },
  rejected: {
    label: "Rechazada",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    border: "border-rose-100",
    gradient: "from-rose-50 via-white to-white",
    accent: "text-rose-600",
  },
  in_review: {
    label: "En revisión",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    border: "border-blue-100",
    gradient: "from-blue-50 via-white to-white",
    accent: "text-blue-600",
  },
  acta_generated: {
    label: "Acta generada",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
    border: "border-purple-100",
    gradient: "from-purple-50 via-white to-white",
    accent: "text-purple-600",
  },
  cancelled: {
    label: "Cancelada",
    badge: "bg-gray-200 text-gray-700 border-gray-300",
    border: "border-gray-200",
    gradient: "from-gray-100 via-white to-white",
    accent: "text-gray-600",
  },
  default: {
    label: "Pendiente",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    border: "border-amber-100",
    gradient: "from-amber-50 via-white to-white",
    accent: "text-amber-600",
  },
};

const CANCELLABLE = ["pending", "in_review", "acta_generated"];

const normalizeStatus = (status) => {
  const s = String(status || "").toLowerCase();
  if (["aprobado", "approved"].includes(s)) return "approved";
  if (["rechazado", "rejected"].includes(s)) return "rejected";
  if (["acta_generada", "acta_generated"].includes(s)) return "acta_generated";
  if (["modificada", "modified"].includes(s)) return "modified";
  if (["en_revision", "in_review"].includes(s)) return "in_review";
  return "pending";
};

const safeJSON = (txt) => {
  try {
    return typeof txt === "string" ? JSON.parse(txt) : txt || {};
  } catch {
    return {};
  }
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const RequestHighlights = ({ requests = [], onView, onCancel }) => {
  if (!Array.isArray(requests) || requests.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Solicitudes recientes
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Seguimiento rápido de las últimas gestiones registradas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {requests.map((req) => {
          const status = normalizeStatus(req.status);
          const meta = STATUS_META[status] || STATUS_META.default;
          const payload = safeJSON(req.payload);
          const cancelEnabled = CANCELLABLE.includes(status);

          return (
            <article
              key={req.id}
              className={`rounded-2xl border ${meta.border} bg-gradient-to-br ${meta.gradient} dark:bg-gray-900 dark:border-gray-800 px-5 py-6 shadow-sm`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Solicitud #{req.id}
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">
                    {req.type_title || "Solicitud"}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full border ${meta.badge}`}
                >
                  {meta.label}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
                  <FiActivity className={meta.accent} />
                  {payload?.nombre_cliente || "Cliente no registrado"}
                </p>
                {payload?.persona_contacto && (
                  <p className="text-gray-600 dark:text-gray-300">
                    Contacto: <span className="font-medium">{payload.persona_contacto}</span>
                  </p>
                )}
                <p className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
                  <FiClock /> {formatDate(req.created_at)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 mt-5">
                <button
                  onClick={() => onView?.(req)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 text-gray-800 border border-gray-200 hover:bg-white hover:border-gray-300 text-xs font-semibold transition dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <FiEye /> Ver detalle
                </button>

                {cancelEnabled && onCancel && (
                  <button
                    onClick={() => onCancel(req)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 text-xs font-semibold transition dark:bg-red-900/40 dark:text-red-200 dark:border-red-900/60 dark:hover:bg-red-900/60"
                  >
                    <FiTrash2 /> Cancelar
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default RequestHighlights;
