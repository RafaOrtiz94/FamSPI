import React, { useState } from 'react';
import kickoffApi from '../api/kickoffApi';
import KickoffCanvaEmbed from './KickoffCanvaEmbed';
import KickoffQuestionCard from './KickoffQuestionCard';
import KickoffQRCode from './KickoffQRCode';
import KickoffStatusBadge from './KickoffStatusBadge';
import { KickoffElapsedTimer } from './KickoffTimer';
import toast from 'react-hot-toast';

export default function KickoffPresenterPanel({ presentation, questions, onRefresh }) {
  const [busy, setBusy] = useState(false);

  if (!presentation) return null;

  // Only show questions (not aportes) in the moderation queue
  const highlighted = questions.filter(q => q.type !== 'aporte' && (q.is_highlighted || q.status === 'highlighted'));
  const pending     = questions.filter(q => q.type !== 'aporte' && q.status !== 'highlighted' && q.status !== 'hidden' && !q.is_highlighted);
  const aporteCount = questions.filter(q => q.type === 'aporte' && q.status !== 'hidden').length;

  const act = async (fn, successMsg) => {
    setBusy(true);
    try {
      await fn();
      await onRefresh?.();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al ejecutar la acción');
    } finally {
      setBusy(false);
    }
  };

  const isActive  = ['active', 'questions_open'].includes(presentation.status);
  const canStart  = ['pending', 'ready'].includes(presentation.status);
  const canFinish = ['active', 'questions_open', 'questions_closed'].includes(presentation.status);
  const canOpenQ  = presentation.status === 'active';
  const canCloseQ = presentation.status === 'questions_open';

  return (
    <div className="flex flex-col gap-6">
      {/* Status bar */}
      <div className="rounded-2xl bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4 text-white">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <KickoffStatusBadge status={presentation.status} type="presentation" />
            {isActive && (
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Tiempo transcurrido: <KickoffElapsedTimer startDate={presentation.updated_at} />
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold">{presentation.title}</h2>
          <p className="text-slate-400 text-sm mt-0.5">Panel del presentador</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canStart && (
            <button disabled={busy}
              onClick={() => act(() => kickoffApi.startPresentation(presentation.id), 'Presentación iniciada')}
              className="px-4 py-2 text-sm font-semibold bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50">
              ▶ Iniciar
            </button>
          )}
          {canOpenQ && (
            <button disabled={busy}
              onClick={() => act(() => kickoffApi.updatePresentation(presentation.id, { status: 'questions_open' }), 'Sala abierta')}
              className="px-4 py-2 text-sm font-semibold bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50">
              💬 Abrir sala
            </button>
          )}
          {canCloseQ && (
            <button disabled={busy}
              onClick={() => act(() => kickoffApi.updatePresentation(presentation.id, { status: 'questions_closed' }), 'Sala cerrada')}
              className="px-4 py-2 text-sm font-semibold bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50">
              🔒 Cerrar sala
            </button>
          )}
          {canFinish && (
            <button disabled={busy}
              onClick={() => act(() => kickoffApi.finishPresentation(presentation.id), 'Presentación finalizada')}
              className="px-4 py-2 text-sm font-semibold bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">
              ■ Finalizar
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Canva embed */}
        <div className="xl:col-span-2">
          <KickoffCanvaEmbed
            embedUrl={presentation.canva_embed_url}
            fallbackUrl={presentation.canva_url || presentation.fallback_url}
            title={presentation.title}
          />
        </div>

        {/* Questions sidebar */}
        <div className="flex flex-col gap-4 overflow-y-auto max-h-[700px] pr-1">
          <KickoffQRCode presentationId={presentation.id} isAdmin />

          {aporteCount > 0 && (
            <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-700 font-medium">
              💡 {aporteCount} aporte{aporteCount !== 1 ? 's' : ''} recibido{aporteCount !== 1 ? 's' : ''} — visibles para todos
            </div>
          )}

          {highlighted.length > 0 && (
            <section>
              <h3 className="text-xs font-bold tracking-widest text-purple-600 uppercase mb-2">
                ⭐ Para responder ({highlighted.length})
              </h3>
              <div className="flex flex-col gap-2">
                {highlighted.map(q => (
                  <KickoffQuestionCard key={q.id} question={q} isModerator onRefresh={onRefresh} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">
              Preguntas recibidas ({pending.length})
            </h3>
            {pending.length === 0
              ? <p className="text-xs text-slate-400 text-center py-6">Sin preguntas nuevas</p>
              : (
                <div className="flex flex-col gap-2">
                  {pending.map(q => (
                    <KickoffQuestionCard key={q.id} question={q} isModerator onRefresh={onRefresh} />
                  ))}
                </div>
              )}
          </section>
        </div>
      </div>
    </div>
  );
}
