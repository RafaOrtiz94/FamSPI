import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../core/auth/AuthContext';
import famdaysApi from '../api/famdaysApi';

const POLL_MS = 6000;
const MAX_CHARS = 1000;
const ADMIN_ROLES = new Set(['jefe_ti', 'admin', 'administrador']);

function QuestionItem({ question, isAdmin, onRefresh }) {
  const act = async (action) => {
    try {
      if (action === 'highlight') await famdaysApi.highlightQuestion(question.id);
      if (action === 'answer') await famdaysApi.answerQuestion(question.id);
      if (action === 'hide') await famdaysApi.hideQuestion(question.id);
      await onRefresh?.();
      toast.success('Accion registrada');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo actualizar');
    }
  };

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-widest text-emerald-600">{question.display_name || 'Anonimo'}</span>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-black uppercase text-slate-500">{question.status}</span>
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{question.question_text}</p>
      {isAdmin && question.status !== 'hidden' && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={() => act('highlight')} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">Destacar</button>
          <button type="button" onClick={() => act('answer')} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Respondida</button>
          <button type="button" onClick={() => act('hide')} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">Ocultar</button>
        </div>
      )}
    </article>
  );
}

function FamDaysQuestionRoom({ qrData, isAdmin }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const timerRef = useRef(null);

  const loadQuestions = useCallback(async () => {
    if (!qrData?.event_id) return;
    const res = await famdaysApi.getEventQuestions(qrData.event_id);
    setQuestions(res.data || []);
  }, [qrData?.event_id]);

  useEffect(() => {
    loadQuestions().catch(() => {});
    timerRef.current = setInterval(() => loadQuestions().catch(() => {}), 5000);
    return () => clearInterval(timerRef.current);
  }, [loadQuestions]);

  const send = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 5) {
      toast.error('Escribe al menos 5 caracteres');
      return;
    }
    setSending(true);
    try {
      await famdaysApi.createEventQuestion(qrData.event_id, {
        question_text: trimmed,
        type: 'question',
        is_anonymous: anonymous,
        display_name: anonymous ? null : (user?.fullname || user?.email || 'Colaborador'),
      });
      setText('');
      toast.success('Pregunta enviada');
      await loadQuestions();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <section className="rounded-[2rem] border border-white bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-600">{qrData.event_name}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Preguntas generales del evento</h1>
        <p className="mt-2 text-sm text-slate-500">Todas las preguntas registradas se muestran en una sola sala para presentadores y asistentes.</p>
      </section>

      <section className="mt-5 rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_CHARS))}
          rows={4}
          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
          placeholder="Escribe tu pregunta para el evento..."
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
            Enviar anonimamente
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">{text.length}/{MAX_CHARS}</span>
            <button type="button" disabled={sending || text.trim().length < 5} onClick={send} className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {sending ? 'Enviando...' : 'Enviar pregunta'}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 space-y-3">
        {questions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500">Aun no hay preguntas registradas.</div>
        ) : (
          questions.map((question) => <QuestionItem key={question.id} question={question} isAdmin={isAdmin} onRefresh={loadQuestions} />)
        )}
      </section>
    </div>
  );
}

export default function FamDaysQREntryPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [state, setState] = useState('loading');
  const [qrData, setQrData] = useState(null);
  const [reason, setReason] = useState('');
  const pollRef = useRef(null);

  const validate = useCallback(async () => {
    try {
      const res = await famdaysApi.validateQr(token);
      if (res.data?.waiting) {
        setQrData(res.data);
        setState('waiting');
        return;
      }
      setQrData(res.data);
      setState('valid');
    } catch (err) {
      setReason(err?.response?.data?.message || 'QR no valido');
      setState('invalid');
      clearInterval(pollRef.current);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate(`/login?returnUrl=${encodeURIComponent(`/famdays/sala/${token}`)}`, { replace: true });
      return;
    }
    validate();
    pollRef.current = setInterval(validate, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [authLoading, isAuthenticated, navigate, token, validate]);

  const role = user?.role?.toLowerCase?.() || '';
  const isAdmin = ADMIN_ROLES.has(role) || (user?.roles || []).some((r) => ADMIN_ROLES.has(r?.toLowerCase?.()));

  if (authLoading || state === 'loading') {
    return <main className="flex min-h-screen items-center justify-center bg-[#f6fbf7] text-sm font-semibold text-slate-500">Validando acceso FamDays...</main>;
  }

  if (state === 'invalid') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6fbf7] px-4 text-center">
        <div className="max-w-sm rounded-[2rem] bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">Acceso no valido</h1>
          <p className="mt-2 text-sm text-slate-500">{reason}</p>
        </div>
      </main>
    );
  }

  if (state === 'waiting') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6fbf7] px-4 text-center">
        <div className="max-w-md rounded-[2rem] bg-white p-8 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-600">{qrData?.event_name}</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">Evento disponible</h1>
          <p className="mt-2 text-sm text-slate-500">La sala general de preguntas se abrira cuando el evento este activo.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dcfce7,transparent_32%),linear-gradient(135deg,#f7fbf8,#eef7f2)] px-4 py-8">
      <FamDaysQuestionRoom qrData={qrData} isAdmin={isAdmin} />
    </main>
  );
}
