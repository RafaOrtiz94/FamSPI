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
 onCommentTextChange,
 setCommentText,
 commentInternal,
 onCommentInternalChange,
 setCommentInternal,
 onCommentSubmit,
 onAddComment,
 saving = false,
 canMarkInternal = false,
}) => {
 const handleCommentTextChange = onCommentTextChange || setCommentText;
 const handleCommentInternalChange = onCommentInternalChange || setCommentInternal;
 const handleCommentSubmit = onCommentSubmit || onAddComment;

 return (
 <div className="space-y-4">
 <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="mb-4 flex items-center justify-between gap-3">
 <div>
 <h3 className="text-lg font-semibold text-slate-900">Trazabilidad de comentarios operativos</h3>
 <p className="text-sm text-slate-500">
 Cada comentario queda registrado con autor, fecha y nivel de visibilidad para mantener seguimiento operativo y evidencia del flujo.
 </p>
 </div>
 <FiMessageSquare className="text-slate-400" size={20} title="Icono de comentarios" />
 </div>

 <form className="space-y-3" onSubmit={handleCommentSubmit}>
 <textarea
className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
 placeholder="Escribe una observacion operativa, una instruccion de seguimiento o una nota interna del expediente"
 value={commentText}
 onChange={(e) => handleCommentTextChange?.(e.target.value)}
 aria-label="Campo para registrar comentario operativo"
 />
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 {canMarkInternal ? (
 <label className="inline-flex items-center gap-2 text-sm text-slate-600">
 <input
 type="checkbox"
 checked={commentInternal}
 onChange={(e) => handleCommentInternalChange?.(e.target.checked)}
 aria-label="Marcar comentario como interno"
 />
 <FiLock size={14} title="Icono de comentario interno" />
 Marcar como comentario interno
 </label>
 ) : (
 <div className="text-xs text-slate-500">
 Los comentarios registrados aqui quedan visibles segun la configuracion del flujo y su tipo de visibilidad.
 </div>
 )}
 <Button type="submit" variant="primary" disabled={saving || !String(commentText || "").trim()} aria-label="Agregar comentario al flujo de solicitud">
 {saving ? "Guardando..." : "Registrar comentario"}
 </Button>
 </div>
 </form>
 </div>

 <div className="space-y-3">
 {comments.length === 0 ? (
 <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
 Aun no existen comentarios registrados para este expediente.
 </div>
 ) : (
 comments.map((comment) => (
 <div key={comment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="mb-2 flex flex-wrap items-center gap-2">
 <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
 <FiUser size={12} title="Icono de autor de comentario" />
 {comment.user_name || comment.user_email || "Sistema"}
 </span>
 {comment.is_internal ? (
 <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
 <FiLock size={12} title="Icono de comentario interno" />
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
