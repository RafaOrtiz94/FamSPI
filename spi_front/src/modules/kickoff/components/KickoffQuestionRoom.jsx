import React, { useState, useRef, useEffect } from 'react';
import kickoffApi from '../api/kickoffApi';
import KickoffQuestionCard from './KickoffQuestionCard';
import toast from 'react-hot-toast';
import { useAuth } from '../../../core/auth/AuthContext';

const MAX_CHARS = 1000;
const POLL_MS   = 5000;
const PRES_POLL = 6000;

export default function KickoffQuestionRoom({ presentationId, presentationTitle, isModerator }) {
  const { user }                    = useAuth();
  const [questions, setQ]           = useState([]);
  const [text, setText]             = useState('');
  const [type, setType]             = useState('question'); // 'question' | 'aporte'
  const [anon, setAnon]             = useState(false);
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(false);
  const [presStatus, setPresStatus] = useState(null);
  const qTimerRef                   = useRef(null);
  const pTimerRef                   = useRef(null);

  const loadQuestions = async () => {
    try {
      const res = await kickoffApi.getQuestions(presentationId);
      setQ(res.data || []);
    } catch {}
  };

  const loadPresStatus = async () => {
    try {
      const res = await kickoffApi.getPresentation(presentationId);
      setPresStatus(res.data?.status);
    } catch {}
  };

  useEffect(() => {
    loadQuestions();
    loadPresStatus();
    qTimerRef.current = setInterval(loadQuestions, POLL_MS);
    pTimerRef.current = setInterval(loadPresStatus, PRES_POLL);
    const onVis = () => {
      if (document.hidden) {
        clearInterval(qTimerRef.current);
        clearInterval(pTimerRef.current);
      } else {
        loadQuestions();
        loadPresStatus();
        qTimerRef.current = setInterval(loadQuestions, POLL_MS);
        pTimerRef.current = setInterval(loadPresStatus, PRES_POLL);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(qTimerRef.current);
      clearInterval(pTimerRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [presentationId]); // eslint-disable-line

  const send = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 5) { toast.error('Escribe al menos 5 caracteres'); return; }
    setSending(true);
    try {
      await kickoffApi.createQuestion(presentationId, {
        question_text: trimmed,
        type,
        is_anonymous: type === 'aporte' ? true : anon,
        display_name: (type === 'aporte' || anon) ? null : (user?.fullname || user?.email || 'Colaborador'),
      });
      setText('');
      setSent(true);
      toast.success(type === 'aporte' ? 'Aporte enviado' : 'Pregunta enviada');
      await loadQuestions();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  };

  const highlighted = questions.filter(q => q.type === 'question' && (q.is_highlighted || q.status === 'highlighted'));
  const aportes     = questions.filter(q => q.type === 'aporte' && q.status !== 'hidden');
  const pendingQ    = isModerator
    ? questions.filter(q => q.type === 'question' && q.status !== 'highlighted' && q.status !== 'hidden' && !q.is_highlighted)
    : [];
  const pendingA    = isModerator
    ? questions.filter(q => q.type === 'aporte')
    : [];

  const isFinished = presStatus === 'finished';
  const canSubmitParticipation = !isModerator && (!isFinished || type === 'aporte');

  useEffect(() => {
    if (isFinished && !isModerator) {
      setType('aporte');
      setAnon(false);
    }
  }, [isFinished, isModerator]);

  return (
    <>
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-900 to-indigo-900 p-6 text-white">
          <p className="text-purple-200 text-xs font-semibold tracking-widest uppercase mb-1">Sala de preguntas y aportes</p>
          <h2 className="text-xl font-bold">{presentationTitle || 'Presentación'}</h2>
          {isModerator && (
            <p className="text-purple-300 text-sm mt-1">
              {questions.filter(q => q.type === 'question').length} preguntas · {aportes.length} aportes
            </p>
          )}
        </div>

        {/* Finished banner */}
        {isFinished && !isModerator && (
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm font-semibold text-purple-800">La presentación ha finalizado</p>
            <p className="text-xs text-purple-500 mt-0.5">Si aún no registraste tu aporte, todavía puedes enviarlo.</p>
          </div>
        )}

        {/* Submit form: after finish only aporte remains enabled */}
        {canSubmitParticipation && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
            {/* Type toggle */}
            <div className="flex gap-2">
              <button
                disabled={isFinished}
                onClick={() => { setType('question'); setSent(false); }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                  type === 'question'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                } ${isFinished ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                ❓ Pregunta
              </button>
              <button
                onClick={() => { setType('aporte'); setSent(false); }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                  type === 'aporte'
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                💡 Aporte
              </button>
            </div>

            {type === 'aporte' && (
              <p className="text-xs text-teal-600 bg-teal-50 rounded-lg p-2.5 leading-relaxed">
                Tu aporte será visible para todos de forma anónima y podrá ser valorado por los demás asistentes.
              </p>
            )}

            <textarea
              value={text}
              onChange={e => { setText(e.target.value.slice(0, MAX_CHARS)); setSent(false); }}
              placeholder={type === 'aporte'
                ? 'Comparte tu experiencia, idea o reflexión sobre el tema…'
                : 'Escribe tu pregunta para el presentador…'
              }
              rows={3}
              className={`w-full text-sm rounded-xl border p-4 resize-none focus:outline-none focus:ring-2 transition-all
                ${type === 'aporte'
                  ? 'border-teal-200 bg-teal-50 focus:ring-teal-400 focus:border-transparent'
                  : 'border-slate-200 bg-slate-50 focus:ring-purple-400 focus:border-transparent'
                }`}
            />

            <div className="flex items-center justify-between gap-3">
              {type === 'question' ? (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 select-none">
                  <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)}
                    className="w-4 h-4 rounded accent-purple-600" />
                  Enviar de forma anónima
                </label>
              ) : (
                <span className="text-xs text-slate-400 italic">Los aportes siempre son anónimos</span>
              )}
              <div className="flex items-center gap-3">
                <span className={`text-xs ${text.length > MAX_CHARS * 0.9 ? 'text-red-400' : 'text-slate-400'}`}>
                  {text.length}/{MAX_CHARS}
                </span>
                <button
                  disabled={sending || text.trim().length < 5}
                  onClick={send}
                  className={`px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    type === 'aporte' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {sending ? 'Enviando...' : isFinished ? 'Enviar aporte' : 'Enviar'}
                </button>
              </div>
            </div>
            {sent && (
              <p className={`text-xs font-medium ${type === 'aporte' ? 'text-teal-600' : 'text-green-600'}`}>
                {type === 'aporte'
                  ? '💡 Tu aporte ya es visible para todos los asistentes.'
                  : '❓ Tu pregunta fue recibida. El presentador seleccionará las que responderá en la charla.'}
              </p>
            )}
          </div>
        )}

        {/* ── Moderator view ────────────────────────────────────────────── */}
        {isModerator && (
          <>
            {highlighted.length > 0 && (
              <section>
                <h3 className="text-xs font-bold tracking-widest text-purple-600 uppercase mb-3">
                  ⭐ Para responder ({highlighted.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {highlighted.map(q => (
                    <KickoffQuestionCard key={q.id} question={q} isModerator onRefresh={loadQuestions} />
                  ))}
                </div>
              </section>
            )}
            {pendingQ.length > 0 && (
              <section>
                <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">
                  Preguntas recibidas ({pendingQ.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {pendingQ.map(q => (
                    <KickoffQuestionCard key={q.id} question={q} isModerator onRefresh={loadQuestions} />
                  ))}
                </div>
              </section>
            )}
            {pendingA.length > 0 && (
              <section>
                <h3 className="text-xs font-bold tracking-widest text-teal-600 uppercase mb-3">
                  💡 Aportes ({pendingA.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {pendingA.map(q => (
                    <KickoffQuestionCard key={q.id} question={q} isModerator onRefresh={loadQuestions} />
                  ))}
                </div>
              </section>
            )}
            {questions.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">Aún no hay preguntas ni aportes.</div>
            )}
          </>
        )}

        {/* ── Attendee view ─────────────────────────────────────────────── */}
        {!isModerator && (
          <>
            {highlighted.length > 0 && (
              <section>
                <h3 className="text-xs font-bold tracking-widest text-purple-600 uppercase mb-3">
                  ⭐ Preguntas seleccionadas ({highlighted.length})
                </h3>
                <div className="flex flex-col gap-3">
                  {highlighted.map(q => (
                    <KickoffQuestionCard key={q.id} question={q} currentUserId={user?.id} onRefresh={loadQuestions} />
                  ))}
                </div>
              </section>
            )}
            {aportes.length > 0 && (
              <section>
                <h3 className="text-xs font-bold tracking-widest text-teal-600 uppercase mb-3">
                  💡 Aportes de la sesión ({aportes.length})
                </h3>
                <div className="flex flex-col gap-3">
                  {aportes.map(q => (
                    <KickoffQuestionCard key={q.id} question={q} currentUserId={user?.id} onRefresh={loadQuestions} />
                  ))}
                </div>
              </section>
            )}
            {highlighted.length === 0 && aportes.length === 0 && !isFinished && (
              <div className="text-center py-10 text-slate-400 text-sm">
                Sé el primero en enviar una pregunta o un aporte.
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
