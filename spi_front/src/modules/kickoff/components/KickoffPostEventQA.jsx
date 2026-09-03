import React, { useEffect, useState, useCallback } from 'react';
import kickoffApi from '../api/kickoffApi';
import { toast } from 'react-toastify';

const C = {
  navy:  '#0a1628',
  cyan:  '#00a8d4',
  gold:  '#c49a10',
  muted: '#6b8aaa',
  line:  '#dce8f5',
  bg:    '#f4f8fc',
};

function QuestionRow({ question, onAnswered }) {
  const isAnswered = question.status === 'answered' || !!question.answer_text;
  const [open, setOpen]     = useState(!isAnswered);
  const [text, setText]     = useState(question.answer_text || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await kickoffApi.answerQuestion(question.id, { answer_text: trimmed });
      toast.success('Respuesta guardada');
      onAnswered(question.id, trimmed);
      setOpen(false);
    } catch {
      toast.error('No se pudo guardar la respuesta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ border: `1px solid ${isAnswered ? '#bbf7d0' : C.line}`, background: '#fff' }}
    >
      {/* Question header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors"
      >
        <span
          className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-black"
          style={isAnswered
            ? { background: '#dcfce7', color: '#16a34a' }
            : { background: `${C.cyan}14`, color: C.cyan }
          }
        >
          {isAnswered ? '✓' : '?'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug" style={{ color: C.navy }}>
            {question.question_text}
          </p>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            {question.display_name}
            {question.is_highlighted && (
              <span className="ml-1.5 font-bold" style={{ color: C.cyan }}>· Destacada</span>
            )}
            {isAnswered && (
              <span className="ml-1.5 font-semibold" style={{ color: '#16a34a' }}>· Respondida</span>
            )}
          </p>
        </div>
        <svg
          className="flex-shrink-0 w-4 h-4 transition-transform"
          style={{ color: C.muted, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Answer area */}
      {open && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${C.line}` }}>
          {isAnswered && question.answer_text && (
            <p className="text-xs mb-2 font-semibold" style={{ color: '#16a34a' }}>Respuesta guardada:</p>
          )}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder="Escribe la respuesta aquí…"
            className="w-full rounded-xl text-sm px-3 py-2.5 resize-none outline-none transition-all"
            style={{
              border: `1px solid ${C.line}`,
              background: '#f8fafc',
              color: C.navy,
            }}
            onFocus={e => (e.target.style.borderColor = C.cyan)}
            onBlur={e => (e.target.style.borderColor = C.line)}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              className="px-4 py-1.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              style={{ background: C.cyan, color: '#fff' }}
            >
              {saving ? 'Guardando…' : isAnswered ? '[ Actualizar ]' : '[ Guardar respuesta ]'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PresentationBlock({ pres, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const [questions, setQuestions] = useState(pres.questions || []);

  const handleAnswered = useCallback((qId, answerText) => {
    setQuestions(qs => qs.map(q =>
      q.id === qId ? { ...q, answer_text: answerText, status: 'answered' } : q
    ));
  }, []);

  const unanswered = questions.filter(q => q.status !== 'answered' && !q.answer_text);
  const answered   = questions.filter(q => q.status === 'answered' || !!q.answer_text);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.line}`, background: '#fff' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black tracking-widest font-mono mb-0.5" style={{ color: C.muted }}>
            PRESENTACIÓN
          </p>
          <h4 className="font-black text-sm uppercase tracking-wide" style={{ color: C.navy }}>
            {pres.title}
          </h4>
          {pres.presenter_name && (
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>
              Agente: {pres.presenter_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {unanswered.length > 0 && (
            <span
              className="text-xs font-black px-2 py-0.5 rounded-full"
              style={{ background: `${C.cyan}14`, color: C.cyan }}
            >
              {unanswered.length} pendiente{unanswered.length !== 1 ? 's' : ''}
            </span>
          )}
          {answered.length > 0 && unanswered.length === 0 && (
            <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
              Completa
            </span>
          )}
          <svg
            className="w-4 h-4 transition-transform"
            style={{ color: C.muted, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Questions list */}
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
          {questions.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: C.muted }}>
              No hay preguntas registradas para esta presentación.
            </p>
          )}
          {questions.map(q => (
            <QuestionRow key={q.id} question={q} onAnswered={handleAnswered} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function KickoffPostEventQA({ eventId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!eventId) return;
    kickoffApi.getPostEventQA(eventId)
      .then(res => setData(res.data || []))
      .catch(() => setError('No se pudo cargar la mesa de preguntas finales'))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-8 animate-pulse">
        <div className="h-4 bg-slate-100 rounded-full w-1/3 mb-4" />
        <div className="h-3 bg-slate-100 rounded-full w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  const totalUnanswered = (data || []).reduce(
    (sum, pres) => sum + pres.questions.filter(q => q.status !== 'answered' && !q.answer_text).length,
    0
  );

  return (
    <section>
      {/* Section header */}
      <div
        className="rounded-2xl p-5 mb-4 flex items-start justify-between gap-4"
        style={{ background: C.navy, border: '1px solid #1a2d45' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black tracking-widest font-mono" style={{ color: C.cyan }}>
              MESA DE PREGUNTAS FINALES
            </span>
          </div>
          <p className="text-sm" style={{ color: '#6b8aaa' }}>
            Responde las preguntas que no alcanzaste a atender durante las presentaciones. Esta sección es opcional.
          </p>
        </div>
        {totalUnanswered > 0 && (
          <span
            className="flex-shrink-0 text-xs font-black px-2.5 py-1 rounded-full"
            style={{ background: `${C.cyan}20`, color: C.cyan, border: `1px solid ${C.cyan}40` }}
          >
            {totalUnanswered} sin responder
          </span>
        )}
        {totalUnanswered === 0 && (data || []).length > 0 && (
          <span className="flex-shrink-0 text-xs font-black px-2.5 py-1 rounded-full" style={{ background: '#16a34a20', color: '#4ade80', border: '1px solid #16a34a40' }}>
            Todo respondido
          </span>
        )}
      </div>

      {/* Presentation blocks */}
      <div className="flex flex-col gap-3">
        {(data || []).length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: C.muted }}>
            No hay presentaciones completadas con preguntas.
          </p>
        )}
        {(data || []).map((pres, i) => (
          <PresentationBlock
            key={pres.id}
            pres={pres}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </section>
  );
}
