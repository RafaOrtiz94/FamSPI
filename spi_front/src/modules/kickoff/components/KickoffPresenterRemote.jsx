import React, { useState, useEffect, useRef } from 'react';
import kickoffApi from '../api/kickoffApi';
import KickoffStatusBadge from './KickoffStatusBadge';
import KickoffQuestionCard from './KickoffQuestionCard';
import { useAuth } from '../../../core/auth/AuthContext';
import toast from 'react-hot-toast';

const POLL_MS = 4000;

export default function KickoffPresenterRemote({ presentation, onRefresh }) {
  const { user }              = useAuth();
  const [busy,      setBusy]  = useState(false);
  const [questions, setQ]     = useState([]);
  const timerRef              = useRef(null);

  const loadQ = async () => {
    if (!presentation?.id) return;
    try {
      const res = await kickoffApi.getQuestions(presentation.id);
      setQ(res.data || []);
    } catch {}
  };

  useEffect(() => {
    loadQ();
    timerRef.current = setInterval(loadQ, POLL_MS);
    const onVis = () => {
      if (document.hidden) clearInterval(timerRef.current);
      else { loadQ(); timerRef.current = setInterval(loadQ, POLL_MS); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [presentation?.id]); // eslint-disable-line

  if (!presentation) return null;

  const canStart  = ['pending', 'ready'].includes(presentation.status);
  const canFinish = ['active', 'questions_open', 'questions_closed'].includes(presentation.status);

  const act = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      await onRefresh?.();
      if (msg) toast.success(msg);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const highlighted = questions.filter(q => q.type === 'question' && (q.is_highlighted || q.status === 'highlighted'));
  const pendingQ    = questions.filter(q => q.type === 'question' && q.status !== 'highlighted' && q.status !== 'hidden' && !q.is_highlighted);
  const aportes     = questions.filter(q => q.type === 'aporte' && q.status !== 'hidden');

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">

      {/* Header */}
      <div className="px-5 pt-8 pb-4 flex-shrink-0 border-b border-slate-800">
        <div className="text-center mb-4">
          <KickoffStatusBadge status={presentation.status} type="presentation" />
          <h1 className="text-base font-bold mt-2 leading-snug">{presentation.title}</h1>
          <p className="text-slate-500 text-xs mt-0.5 tracking-wider uppercase">Panel del presentador</p>
        </div>

        {/* Controles de flujo */}
        <div className="flex flex-col gap-2">
          {canStart && (
            <button disabled={busy}
              onClick={() => act(() => kickoffApi.startPresentation(presentation.id), 'Presentación iniciada')}
              className="w-full py-4 rounded-2xl text-base font-bold bg-green-500 hover:bg-green-600 active:scale-95 transition-all disabled:opacity-50">
              ▶ Iniciar presentación
            </button>
          )}
          {canFinish && (
            <button disabled={busy}
              onClick={() => act(() => kickoffApi.finishPresentation(presentation.id), 'Presentación finalizada')}
              className="w-full py-3 rounded-2xl text-sm font-bold bg-red-600/80 hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50">
              ■ Finalizar presentación
            </button>
          )}
        </div>

        {/* Contadores */}
        {questions.length > 0 && (
          <div className="flex gap-4 mt-3 justify-center text-xs text-slate-400">
            <span>❓ {questions.filter(q => q.type === 'question').length} preguntas</span>
            <span>💡 {aportes.length} aportes</span>
          </div>
        )}
      </div>

      {/* Feed en vivo */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">

        {highlighted.length > 0 && (
          <section>
            <p className="text-xs font-bold tracking-widest text-purple-400 uppercase mb-2">
              ⭐ Destacadas ({highlighted.length})
            </p>
            <div className="flex flex-col gap-2">
              {highlighted.map(q => (
                <KickoffQuestionCard key={q.id} question={q} isModerator isPresenter currentUserId={user?.id} onRefresh={loadQ} />
              ))}
            </div>
          </section>
        )}

        {pendingQ.length > 0 && (
          <section>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">
              Preguntas recibidas ({pendingQ.length})
            </p>
            <div className="flex flex-col gap-2">
              {pendingQ.map(q => (
                <KickoffQuestionCard key={q.id} question={q} isModerator isPresenter currentUserId={user?.id} onRefresh={loadQ} />
              ))}
            </div>
          </section>
        )}

        {aportes.length > 0 && (
          <section>
            <p className="text-xs font-bold tracking-widest text-teal-400 uppercase mb-2">
              💡 Aportes ({aportes.length})
            </p>
            <div className="flex flex-col gap-2">
              {aportes.map(q => (
                <KickoffQuestionCard
                  key={q.id}
                  question={q}
                  isModerator
                  isPresenter
                  currentUserId={user?.id}
                  onRefresh={loadQ}
                />
              ))}
            </div>
          </section>
        )}

        {questions.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <p className="text-slate-500 text-sm">Aún no hay preguntas ni aportes</p>
            <p className="text-slate-600 text-xs mt-1">Se actualizan automáticamente cada 4 segundos</p>
          </div>
        )}
      </div>
    </div>
  );
}
