import React, { useState, useEffect } from 'react';
import KickoffStatusBadge from './KickoffStatusBadge';
import KickoffStarRating from './KickoffStarRating';
import kickoffApi from '../api/kickoffApi';
import toast from 'react-hot-toast';

const C = { cyan: '#00a8d4', gold: '#c49a10', navy: '#0a1628', text: '#1e3a5f', muted: '#6b8aaa', line: '#dce8f5' };

// Muestra estrellas visuales basadas en el promedio + contador de votos
function AvgRatingDisplay({ avgRating, ratingCount }) {
  if (!ratingCount || ratingCount === 0) return null;
  const avg      = parseFloat(avgRating) || 0;
  const full     = Math.floor(avg);
  const hasHalf  = avg - full >= 0.5;

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg flex-shrink-0"
      style={{ background: '#fff', border: `1px solid ${C.line}` }}
    >
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <span
            key={i}
            className="text-xs leading-none"
            style={{ color: i <= full ? C.gold : (i === full + 1 && hasHalf) ? C.gold : '#e2e8f0', opacity: (i === full + 1 && hasHalf) ? 0.55 : 1 }}
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-xs font-black" style={{ color: C.gold }}>{avg.toFixed(1)}</span>
      <span className="text-xs" style={{ color: C.muted }}>({ratingCount})</span>
    </div>
  );
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso);
  const mins  = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  return `Hace ${Math.floor(mins / 60)}h`;
}

// ── Aporte card ───────────────────────────────────────────────────────────────
// Aportes nunca pueden ocultarse. Cualquier usuario puede calificarlos (excepto el autor).
function AporteCard({ question, isModerator, currentUserId, onRefresh }) {
  const alreadyRated = question.user_rating != null;
  const [,         setBusy]      = useState(false);
  const [starValue, setStarValue] = useState(alreadyRated ? question.user_rating : 0);
  const [rated,     setRated]     = useState(alreadyRated);

  // Sincroniza con el backend: si el polling reporta que el usuario ya calificó,
  // bloquea las estrellas aunque el componente no se haya remontado.
  useEffect(() => {
    if (question.user_rating != null) {
      setRated(true);
      setStarValue(question.user_rating);
    }
  }, [question.user_rating]);

  const isOwn   = currentUserId && currentUserId === question.user_id;
  const canRate = !isOwn && !rated;

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
    <div
      className="rounded-xl p-4 transition-all duration-200"
      style={{
        background: rated ? '#f0fff4' : '#f0fbff',
        border: `1px solid ${rated ? '#86efac' : '#b8e6f5'}`,
      }}
    >
      {/* Header */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: '#e8f7fc', color: C.cyan, border: `1px solid #b8e6f5` }}
            >
              💡
            </div>
            <span className="text-xs font-bold font-mono" style={{ color: C.muted }}>ANÓNIMO</span>
            <span style={{ color: C.line }}>·</span>
            <span className="text-xs font-mono" style={{ color: C.muted }}>{timeAgo(question.created_at)}</span>
          </div>
          <AvgRatingDisplay avgRating={question.avg_rating} ratingCount={question.rating_count} />
        </div>
        {rated && (
          <span
            className="inline-block mt-1.5 text-xs font-black font-mono tracking-wide px-1.5 py-0.5 rounded-md"
            style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}
          >
            ✓ CALIFICADO
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed" style={{ color: C.text }}>{question.question_text}</p>

      {/* Rating — disponible para todos excepto el autor (incluye moderadores) */}
      {canRate && !rated && (
        <div className="mt-3 pt-3 flex flex-col gap-1.5" style={{ borderTop: `1px solid #b8e6f5` }}>
          <p className="text-xs font-bold" style={{ color: C.cyan }}>¿Qué tan valioso fue este aporte?</p>
          <KickoffStarRating value={starValue} onChange={submitRating} size="md" />
        </div>
      )}
      {rated && (
        <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: `1px solid #86efac` }}>
          <span className="text-xs font-mono" style={{ color: '#16a34a' }}>Tu calificación:</span>
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(i => (
              <span key={i} className="text-sm leading-none" style={{ color: i <= starValue ? C.gold : '#e2e8f0' }}>★</span>
            ))}
          </div>
          <span className="text-xs font-black" style={{ color: C.gold }}>{starValue}/5</span>
        </div>
      )}
      {!canRate && !rated && isOwn && (
        <p className="mt-3 pt-3 text-xs font-mono" style={{ borderTop: `1px solid #b8e6f5`, color: C.muted }}>Tu aporte</p>
      )}

      {/* Moderador: solo badge de estado, sin opción de ocultar */}
      {isModerator && (
        <div className="flex items-center gap-2 pt-3 mt-3" style={{ borderTop: `1px solid #b8e6f5` }}>
          <KickoffStatusBadge status={question.status} type="question" />
        </div>
      )}
    </div>
  );
}

// ── Question card ─────────────────────────────────────────────────────────────
// Las preguntas no se califican. Solo el presentador puede marcarlas como respondidas.
function QuestionCard({ question, isModerator, isPresenter, currentUserId, onRefresh }) {
  const [busy, setBusy] = useState(false);

  const isHighlighted = question.is_highlighted || question.status === 'highlighted';
  const isAnswered    = question.status === 'answered';

  const act = async (action) => {
    setBusy(true);
    try {
      if (action === 'highlight') await kickoffApi.highlightQuestion(question.id);
      else if (action === 'hide')  await kickoffApi.hideQuestion(question.id);
      else if (action === 'answer') await kickoffApi.answerQuestion(question.id, {});
      onRefresh?.();
      toast.success('Acción registrada');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error');
    } finally { setBusy(false); }
  };

  return (
    <div
      className="rounded-xl p-4 transition-all duration-200"
      style={{
        background: isAnswered  ? '#f0fdf4' :
                    isHighlighted ? '#fdf8e8' : '#ffffff',
        border:     `1px solid ${isAnswered  ? '#bbf7d0' :
                                  isHighlighted ? '#f0e090' : C.line}`,
        boxShadow:  isHighlighted && !isAnswered ? `0 2px 8px ${C.gold}18` : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
            style={{
              background: isAnswered ? '#f0fdf4' : isHighlighted ? '#fdf8e8' : '#f4f8fc',
              color:      isAnswered ? '#16a34a' : isHighlighted ? C.gold : C.muted,
              border:     `1px solid ${isAnswered ? '#bbf7d0' : isHighlighted ? '#f0e090' : C.line}`,
            }}
          >
            {(question.display_name || 'A')[0].toUpperCase()}
          </div>
          <span className="text-xs font-bold font-mono truncate" style={{ color: C.text }}>
            {question.display_name || 'Anónimo'}
          </span>
          <span style={{ color: C.line }}>·</span>
          <span className="text-xs font-mono" style={{ color: C.muted }}>{timeAgo(question.created_at)}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isHighlighted && !isAnswered && <span className="text-sm">⭐</span>}
          {isAnswered && <span className="text-sm">✅</span>}
          {isModerator && <KickoffStatusBadge status={question.status} type="question" />}
        </div>
      </div>

      <p className="text-sm leading-relaxed" style={{ color: C.text }}>{question.question_text}</p>

      {/* Acciones del moderador */}
      {isModerator && question.status !== 'hidden' && (
        <div className="flex flex-wrap items-center gap-2 pt-3 mt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          {/* Destacar — cualquier moderador */}
          {!isHighlighted && !isAnswered && (
            <button disabled={busy} onClick={() => act('highlight')}
              className="px-3 py-1 text-xs font-bold font-mono tracking-wide rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#fdf8e8', color: C.gold, border: `1px solid #f0e090` }}>
              ⭐ Destacar
            </button>
          )}
          {/* Ocultar — cualquier moderador */}
          <button disabled={busy} onClick={() => act('hide')}
            className="px-3 py-1 text-xs font-bold font-mono tracking-wide rounded-lg transition-colors disabled:opacity-50"
            style={{ background: '#f4f8fc', color: C.muted, border: `1px solid ${C.line}` }}>
            Ocultar
          </button>
          {/* Marcar respondida — SOLO el presentador */}
          {isPresenter && isHighlighted && !isAnswered && (
            <button disabled={busy} onClick={() => act('answer')}
              className="ml-auto px-3 py-1 text-xs font-bold font-mono tracking-wide rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#f0fdf4', color: '#16a34a', border: `1px solid #bbf7d0` }}>
              ✓ Respondida
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function KickoffQuestionCard({ question, isModerator, isPresenter = false, currentUserId, onRefresh }) {
  if (question.type === 'aporte') {
    return <AporteCard question={question} isModerator={isModerator} currentUserId={currentUserId} onRefresh={onRefresh} />;
  }
  return <QuestionCard question={question} isModerator={isModerator} isPresenter={isPresenter} currentUserId={currentUserId} onRefresh={onRefresh} />;
}
