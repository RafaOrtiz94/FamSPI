import React, { useEffect, useState } from 'react';
import kickoffApi from '../api/kickoffApi';
import { generateKickoffPDF } from '../utils/kickoffReportPdf';

const C = { navy: '#0a1628', cyan: '#00a8d4', gold: '#c49a10', muted: '#6b8aaa', line: '#dce8f5', green: '#16a34a' };

const STATUS_LABELS = {
  under_review:  { label: 'En revisión',  color: '#6b8aaa', bg: '#f8fafc' },
  approved:      { label: 'Aprobada',     color: '#2563eb', bg: '#eff6ff' },
  highlighted:   { label: 'Destacada',    color: C.cyan,    bg: '#e0f7fd' },
  answered:      { label: 'Respondida',   color: C.green,   bg: '#f0fdf4' },
  hidden:        { label: 'Oculta',       color: '#94a3b8', bg: '#f1f5f9' },
  rejected:      { label: 'Rechazada',    color: '#dc2626', bg: '#fef2f2' },
};

function StatusBadge({ status }) {
  const m = STATUS_LABELS[status] || STATUS_LABELS.approved;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
      style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
}

function StarScore({ value, count }) {
  if (!value) return <span className="text-xs" style={{ color: C.muted }}>Sin votos</span>;
  const pct = (parseFloat(value) / 5) * 100;
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${C.gold}, #f0d060)` }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color: C.gold }}>
        {parseFloat(value).toFixed(1)}
      </span>
      <span className="text-xs" style={{ color: C.muted }}>({count}v)</span>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: '#fff', border: `1.5px solid ${C.line}` }}>
      <span className="text-2xl font-black tabular-nums" style={{ color: color || C.navy }}>{value ?? '—'}</span>
      <span className="text-xs font-semibold" style={{ color: C.muted }}>{label}</span>
    </div>
  );
}

// ─── Aportes table ────────────────────────────────────────────────────────────

function AportesTab({ aportes }) {
  const [filter, setFilter] = useState('');
  const filtered = filter
    ? aportes.filter(a => a.presentation_title === filter)
    : aportes;

  const presentations = [...new Set(aportes.map(a => a.presentation_title))];

  if (aportes.length === 0) {
    return <p className="text-sm text-center py-8" style={{ color: C.muted }}>No hay aportes registrados.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['', ...presentations].map(p => (
          <button
            key={p || '__all'}
            onClick={() => setFilter(p)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
            style={filter === p
              ? { background: C.cyan, color: '#fff' }
              : { background: '#f1f5f9', color: C.muted }}
          >
            {p || 'Todas las presentaciones'}
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2">
        {filtered.map((a, i) => (
          <div key={a.id}
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: '#fff', border: `1px solid ${C.line}` }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-black" style={{ color: C.muted }}>#{i + 1}</span>
                  <span className="text-xs font-bold truncate" style={{ color: C.navy }}>{a.collaborator_name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: '#f1f5f9', color: C.muted }}>
                    {a.presentation_title}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{a.aporte_text}</p>
              </div>
              <StarScore value={a.avg_rating} count={a.rating_count} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Questions table ──────────────────────────────────────────────────────────

function QuestionsTab({ questions }) {
  const [filter, setFilter] = useState('all'); // all | answered | unanswered | highlighted
  const [presFilter, setPresFilter] = useState('');

  const presentations = [...new Set(questions.map(q => q.presentation_title))];

  const filtered = questions.filter(q => {
    if (presFilter && q.presentation_title !== presFilter) return false;
    if (filter === 'answered')    return q.status === 'answered';
    if (filter === 'unanswered')  return q.status !== 'answered';
    if (filter === 'highlighted') return q.is_highlighted;
    return true;
  });

  if (questions.length === 0) {
    return <p className="text-sm text-center py-8" style={{ color: C.muted }}>No hay preguntas registradas.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all',         label: 'Todas' },
            { key: 'highlighted', label: '⭐ Destacadas' },
            { key: 'answered',    label: '✓ Respondidas' },
            { key: 'unanswered',  label: 'Sin responder' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
              style={filter === f.key ? { background: C.navy, color: '#fff' } : { background: '#f1f5f9', color: C.muted }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['', ...presentations].map(p => (
            <button key={p || '__all'} onClick={() => setPresFilter(p)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
              style={presFilter === p ? { background: C.cyan, color: '#fff' } : { background: '#f1f5f9', color: C.muted }}>
              {p || 'Todas las presentaciones'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs" style={{ color: C.muted }}>{filtered.length} pregunta{filtered.length !== 1 ? 's' : ''}</p>

      {/* Rows */}
      <div className="flex flex-col gap-2">
        {filtered.map((q, i) => (
          <div key={q.id}
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{
              background: '#fff',
              border: `1px solid ${q.is_highlighted ? `${C.cyan}50` : C.line}`,
              boxShadow: q.is_highlighted ? `0 0 0 2px ${C.cyan}15` : 'none',
            }}
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black" style={{ color: C.muted }}>#{i + 1}</span>
                {q.is_highlighted && <span className="text-xs">⭐</span>}
                <span className="text-xs font-bold" style={{ color: C.navy }}>{q.display_name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: C.muted }}>
                  {q.presentation_title}
                </span>
              </div>
              <StatusBadge status={q.status} />
            </div>

            <p className="text-sm font-medium leading-snug" style={{ color: '#111827' }}>{q.question_text}</p>

            {q.answer_text && (
              <div className="rounded-lg px-3 py-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <p className="text-xs font-bold mb-0.5" style={{ color: C.green }}>Respuesta:</p>
                <p className="text-sm leading-snug" style={{ color: '#166534' }}>{q.answer_text}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KickoffSummaryPanel({ eventId, eventName }) {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [tab,         setTab]         = useState('aportes');

  useEffect(() => {
    if (!eventId) return;
    kickoffApi.getEventSummary(eventId)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleDownload = () => {
    if (!data) return;
    setDownloading(true);
    try {
      generateKickoffPDF({
        eventName: eventName || 'Kick Off 2026',
        stats:     data.stats,
        aportes:   data.aportes,
        questions: data.questions,
      });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 rounded-full border-t-transparent animate-spin"
          style={{ borderColor: `${C.cyan} transparent transparent transparent` }} />
      </div>
    );
  }

  if (!data) return null;

  const { aportes, questions, stats } = data;

  return (
    <div className="flex flex-col gap-6">
      {/* Header con botón de descarga */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: C.muted }}>Evento · Resumen completo</p>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            {stats.total_aportes} aporte{stats.total_aportes !== 1 ? 's' : ''} · {stats.total_questions} pregunta{stats.total_questions !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
          style={{ background: C.navy, color: '#fff' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? 'Generando…' : 'Descargar PDF'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Aportes registrados"   value={stats.total_aportes}      color={C.cyan} />
        <StatCard label="Promedio general"       value={stats.avg_rating_overall ? `${stats.avg_rating_overall} ★` : '—'} color={C.gold} />
        <StatCard label="Preguntas recibidas"    value={stats.total_questions}    color={C.navy} />
        <StatCard label="Preguntas respondidas"  value={stats.answered_questions} color={C.green} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: C.line }}>
        {[
          { key: 'aportes',   label: `💡 Aportes (${aportes.length})` },
          { key: 'questions', label: `❓ Preguntas (${questions.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px"
            style={tab === t.key
              ? { borderColor: C.cyan, color: C.cyan }
              : { borderColor: 'transparent', color: C.muted }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'aportes'   && <AportesTab   aportes={aportes} />}
      {tab === 'questions' && <QuestionsTab questions={questions} />}
    </div>
  );
}
