import React, { useState } from 'react';
import kickoffApi from '../api/kickoffApi';
import KickoffCanvaEmbed from './KickoffCanvaEmbed';
import KickoffQuestionCard from './KickoffQuestionCard';
import KickoffQRCode from './KickoffQRCode';
import { KickoffElapsedTimer } from './KickoffTimer';
import { useAuth } from '../../../core/auth/AuthContext';
import toast from 'react-hot-toast';

const C = { cyan: '#00a8d4', gold: '#c49a10', navy: '#0a1628', text: '#1e3a5f', muted: '#6b8aaa', line: '#dce8f5' };

export default function KickoffPresenterPanel({ presentation, questions, onRefresh }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!presentation) return null;

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
    } finally { setBusy(false); }
  };

  const isActive = ['active', 'questions_open', 'questions_closed'].includes(presentation.status);
  const canStart = ['pending', 'ready'].includes(presentation.status);
  const canFinish = isActive;

  return (
    <div className="flex flex-col gap-5">

      {/* Command bar */}
      <div
        className="rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4"
        style={{ background: C.navy, border: '1px solid #1a2d45' }}
      >
        <div>
          <p className="text-xs font-black tracking-widest font-mono mb-1" style={{ color: '#2a4060' }}>
            PANEL DEL PRESENTADOR
          </p>
          <h2 className="text-lg font-black" style={{ color: '#ffffff' }}>{presentation.title}</h2>
          {isActive && (
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: C.cyan }} />
              <span className="text-xs font-mono" style={{ color: C.cyan }}>
                EN VIVO · <KickoffElapsedTimer startDate={presentation.updated_at} />
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {canStart && (
            <button disabled={busy}
              onClick={() => act(() => kickoffApi.startPresentation(presentation.id), 'Presentación iniciada')}
              className="px-5 py-2 text-xs font-black tracking-widest uppercase rounded-xl transition-colors disabled:opacity-50"
              style={{ background: '#16a34a', color: '#fff' }}
            >
              ▶ Iniciar
            </button>
          )}
          {canFinish && (
            <button disabled={busy}
              onClick={() => act(() => kickoffApi.finishPresentation(presentation.id), 'Presentación finalizada')}
              className="px-5 py-2 text-xs font-black tracking-widest uppercase rounded-xl transition-colors disabled:opacity-50"
              style={{ background: '#dc2626', color: '#fff' }}
            >
              ■ Finalizar
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Canva embed */}
        <div className="xl:col-span-2">
          <KickoffCanvaEmbed
            embedUrl={presentation.canva_embed_url}
            fallbackUrl={presentation.canva_url || presentation.fallback_url}
            title={presentation.title}
          />
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 overflow-y-auto max-h-[700px] pr-1">

          {/* QR */}
          <div
            className="rounded-2xl p-4 flex flex-col items-center"
            style={{ background: '#fff', border: `1px solid ${C.line}` }}
          >
            <p className="text-xs font-black tracking-widest font-mono mb-3 self-start" style={{ color: C.muted }}>
              ACCESO QR
            </p>
            <KickoffQRCode presentationId={presentation.id} isAdmin />
          </div>

          {/* Aporte count */}
          {aporteCount > 0 && (
            <div
              className="rounded-xl px-4 py-3 text-xs font-bold"
              style={{ background: '#f0fbff', border: `1px solid #b8e6f5`, color: C.cyan }}
            >
              💡 {aporteCount} aporte{aporteCount !== 1 ? 's' : ''} recibido{aporteCount !== 1 ? 's' : ''} — visibles para todos
            </div>
          )}

          {/* Highlighted questions */}
          {highlighted.length > 0 && (
            <section>
              <p className="text-xs font-black tracking-widest font-mono uppercase mb-2" style={{ color: C.gold }}>
                ⭐ Para responder ({highlighted.length})
              </p>
              <div className="flex flex-col gap-2">
                {highlighted.map(q => (
                  <KickoffQuestionCard key={q.id} question={q} isModerator isPresenter currentUserId={user?.id} onRefresh={onRefresh} />
                ))}
              </div>
            </section>
          )}

          {/* Pending questions */}
          <section>
            <p className="text-xs font-black tracking-widest font-mono uppercase mb-2" style={{ color: C.muted }}>
              Preguntas ({pending.length})
            </p>
            {pending.length === 0
              ? <p className="text-xs font-mono text-center py-5" style={{ color: C.line }}>[ SIN PREGUNTAS NUEVAS ]</p>
              : <div className="flex flex-col gap-2">
                  {pending.map(q => (
                    <KickoffQuestionCard key={q.id} question={q} isModerator isPresenter currentUserId={user?.id} onRefresh={onRefresh} />
                  ))}
                </div>
            }
          </section>
        </div>
      </div>
    </div>
  );
}
