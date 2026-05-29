import React, { useState } from 'react';
import KickoffStatusBadge from './KickoffStatusBadge';
import KickoffStarRating from './KickoffStarRating';
import kickoffApi from '../api/kickoffApi';
import toast from 'react-hot-toast';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso);
  const mins  = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  return `Hace ${Math.floor(mins / 60)}h`;
}

// ── Aporte card ───────────────────────────────────────────────────────────────
function AporteCard({ question, isModerator, currentUserId, onRefresh }) {
  const [busy,      setBusy]      = useState(false);
  const [starValue, setStarValue] = useState(0);
  const [rated,     setRated]     = useState(false);

  const isOwn  = currentUserId && currentUserId === question.user_id;
  const canRate = !isModerator && !isOwn && !rated;

  const hide = async () => {
    setBusy(true);
    try {
      await kickoffApi.hideQuestion(question.id);
      onRefresh?.();
      toast.success('Aporte ocultado');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error');
    } finally { setBusy(false); }
  };

  const submitRating = async (star) => {
    setStarValue(star);
    setBusy(true);
    try {
      await kickoffApi.rateAporte(question.id, star);
      setRated(true);
      toast.success('¡Gracias por valorar este aporte!');
      onRefresh?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo guardar la calificación');
      setStarValue(0);
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 transition-all duration-200 hover:border-teal-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            💡
          </div>
          <span className="text-xs font-medium text-teal-700">Anónimo</span>
          <span className="text-xs text-teal-300">·</span>
          <span className="text-xs text-teal-500">{timeAgo(question.created_at)}</span>
        </div>
        {/* Avg rating badge */}
        {question.rating_count > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0 bg-white rounded-lg px-2 py-0.5 border border-teal-200">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-xs font-bold text-slate-700">{question.avg_rating?.toFixed(1)}</span>
            <span className="text-xs text-slate-400">({question.rating_count})</span>
          </div>
        )}
      </div>

      {/* Aporte text */}
      <p className="text-slate-800 text-sm leading-relaxed">{question.question_text}</p>

      {/* Rating prompt for attendees (not own) */}
      {canRate && (
        <div className="mt-3 pt-3 border-t border-teal-200 flex flex-col gap-1.5">
          <p className="text-xs font-medium text-teal-700">¿Qué tan valioso fue este aporte?</p>
          <KickoffStarRating value={starValue} onChange={submitRating} size="md" />
        </div>
      )}
      {rated && (
        <p className="mt-3 pt-3 border-t border-teal-200 text-xs text-teal-600 font-medium">
          ✓ Valoraste este aporte con {starValue} estrella{starValue !== 1 ? 's' : ''}
        </p>
      )}
      {isOwn && (
        <p className="mt-3 pt-3 border-t border-teal-200 text-xs text-teal-400 italic">Tu aporte</p>
      )}

      {/* Moderator: hide option */}
      {isModerator && (
        <div className="flex items-center gap-2 pt-3 mt-3 border-t border-teal-100">
          {isModerator && <KickoffStatusBadge status={question.status} type="question" />}
          <button
            disabled={busy}
            onClick={hide}
            className="ml-auto px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Ocultar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Question card ─────────────────────────────────────────────────────────────
function QuestionCard({ question, isModerator, currentUserId, onRefresh }) {
  const [busy,      setBusy]      = useState(false);
  const [starValue, setStarValue] = useState(0);
  const [rated,     setRated]     = useState(false);

  const isHighlighted = question.is_highlighted || question.status === 'highlighted';
  const isMyQuestion  = !isModerator && currentUserId && currentUserId === question.user_id;
  const canRate       = isMyQuestion && isHighlighted && !rated;

  const act = async (action) => {
    setBusy(true);
    try {
      if (action === 'highlight') await kickoffApi.highlightQuestion(question.id);
      else if (action === 'hide') await kickoffApi.hideQuestion(question.id);
      onRefresh?.();
      toast.success('Acción registrada');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al procesar la acción');
    } finally { setBusy(false); }
  };

  const submitRating = async (star) => {
    setStarValue(star);
    setBusy(true);
    try {
      await kickoffApi.rateQuestion(question.id, star);
      setRated(true);
      toast.success('¡Gracias por tu calificación!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo guardar la calificación');
      setStarValue(0);
    } finally { setBusy(false); }
  };

  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${
      isHighlighted ? 'border-purple-300 bg-purple-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {(question.display_name || 'A')[0].toUpperCase()}
          </div>
          <span className="text-xs font-medium text-slate-600 truncate">{question.display_name || 'Anónimo'}</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">{timeAgo(question.created_at)}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isHighlighted && <span className="text-sm" title="Seleccionada por el presentador">⭐</span>}
          {isModerator && <KickoffStatusBadge status={question.status} type="question" />}
        </div>
      </div>

      <p className="text-slate-800 text-sm leading-relaxed">{question.question_text}</p>

      {canRate && (
        <div className="mt-3 pt-3 border-t border-purple-100 flex flex-col gap-2">
          <p className="text-xs font-medium text-purple-700">
            El presentador seleccionó tu pregunta — ¿cómo calificarías su respuesta?
          </p>
          <KickoffStarRating value={starValue} onChange={submitRating} size="lg" />
        </div>
      )}
      {isMyQuestion && isHighlighted && rated && (
        <p className="mt-3 pt-3 border-t border-purple-100 text-xs text-purple-600 font-medium">
          ✓ Calificaste esta respuesta con {starValue} estrella{starValue !== 1 ? 's' : ''}
        </p>
      )}

      {isModerator && question.status !== 'hidden' && (
        <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-slate-100">
          {!isHighlighted && (
            <button disabled={busy} onClick={() => act('highlight')}
              className="px-3 py-1.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50">
              ⭐ Destacar
            </button>
          )}
          <button disabled={busy} onClick={() => act('hide')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50">
            Ocultar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Export — routes to correct card based on type ─────────────────────────────
export default function KickoffQuestionCard({ question, isModerator, currentUserId, onRefresh }) {
  if (question.type === 'aporte') {
    return <AporteCard question={question} isModerator={isModerator} currentUserId={currentUserId} onRefresh={onRefresh} />;
  }
  return <QuestionCard question={question} isModerator={isModerator} currentUserId={currentUserId} onRefresh={onRefresh} />;
}
