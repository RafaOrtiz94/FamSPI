import React from "react";
import { FiMessageSquare, FiLock, FiUser } from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

const PersonnelRequestComments = ({
  comments = [],
  commentText,
  setCommentText,
  commentInternal,
  setCommentInternal,
  onAddComment,
  saving = false,
  canMarkInternal = false,
}) => {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Comentarios trazables</h3>
            <p className="text-sm text-slate-500">
              Cada comentario queda asociado al usuario, fecha y visibilidad.
            </p>
          </div>
          <FiMessageSquare className="text-slate-400" size={20} />
        </div>

        <form className="space-y-3" onSubmit={onAddComment}>
          <textarea
            className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Escribe un comentario operativo o una nota interna"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {canMarkInternal ? (
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={commentInternal}
                  onChange={(e) => setCommentInternal(e.target.checked)}
                />
                <FiLock size={14} />
                Comentario interno
              </label>
            ) : (
              <div className="text-xs text-slate-500">
                Los comentarios externos quedan visibles en el flujo del solicitante.
              </div>
            )}
            <Button type="submit" variant="primary" disabled={saving || !String(commentText || "").trim()}>
              {saving ? "Guardando..." : "Agregar comentario"}
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
            No hay comentarios registrados.
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                  <FiUser size={12} />
                  {comment.user_name || comment.user_email || "Sistema"}
                </span>
                {comment.is_internal ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
                    <FiLock size={12} />
                    Interno
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                    Visible
                  </span>
                )}
                <span className="text-[11px] text-slate-500">{formatDateTime(comment.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{comment.comment}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PersonnelRequestComments;
