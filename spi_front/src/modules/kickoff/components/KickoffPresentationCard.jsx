import React from 'react';
import { useNavigate } from 'react-router-dom';
import KickoffTimer from './KickoffTimer';
import { formatEcTime } from '../api/kickoffDateUtils';

const C = {
  cyan:  '#00a8d4',
  gold:  '#c49a10',
  navy:  '#0a1628',
  text:  '#1e3a5f',
  muted: '#6b8aaa',
  line:  '#dce8f5',
};


const STATUS_META = {
  pending:          { label: 'EN ESPERA',  dot: '#94a3b8' },
  ready:            { label: 'PREPARADA',  dot: C.cyan    },
  active:           { label: 'EN VIVO',    dot: C.cyan    },
  questions_open:   { label: 'EN VIVO',    dot: C.cyan    },
  questions_closed: { label: 'EN VIVO',    dot: C.cyan    },
  finished:         { label: 'COMPLETADA', dot: '#22c55e' },
  skipped:          { label: 'OMITIDA',    dot: '#94a3b8' },
};

export default function KickoffPresentationCard({ presentation, index, isPresenter }) {
  const navigate   = useNavigate();
  const isActive   = ['active', 'questions_open', 'questions_closed'].includes(presentation.status);
  const isFinished = presentation.status === 'finished';
  const meta       = STATUS_META[presentation.status] || STATUS_META.pending;

  return (
    <div
      className="relative overflow-hidden flex flex-col rounded-2xl transition-all duration-300 group"
      style={{
        background: '#ffffff',
        border: isActive
          ? `1.5px solid ${C.cyan}80`
          : isFinished
            ? '1.5px solid #bbf7d0'
            : `1.5px solid ${C.line}`,
        boxShadow: isActive
          ? `0 0 0 3px ${C.cyan}12, 0 4px 20px #0a162810`
          : '0 2px 12px #0a162808',
      }}
    >
      {/* Active top accent bar */}
      {isActive && (
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${C.cyan}, transparent)` }} />
      )}
      {isFinished && (
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, transparent, #22c55e, transparent)' }} />
      )}

      {/* Live pulse */}
      {isActive && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5 z-10">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: C.cyan }} />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: C.cyan }} />
        </span>
      )}


      {/* Content */}
      <div className="p-5 flex flex-col gap-3">

        {/* Mission tag + status */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-black tracking-widest font-mono" style={{ color: C.muted }}>
            MISIÓN {String(index + 1).padStart(2, '0')}
          </span>
          <div className="flex items-center gap-1.5">
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.cyan }} />
            )}
            <span className="text-xs font-bold tracking-wider font-mono" style={{ color: meta.dot }}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* Title with corner brackets */}
        <div className="relative px-1">
          <span className="absolute top-0 left-0 text-xs font-mono leading-none select-none" style={{ color: C.line }}>┌</span>
          <span className="absolute bottom-0 right-0 text-xs font-mono leading-none select-none" style={{ color: C.line }}>┘</span>
          <h3
            className="font-black text-sm uppercase tracking-wide leading-snug px-2 py-1"
            style={{ color: isActive ? C.navy : isFinished ? '#166534' : C.text }}
          >
            {presentation.title}
          </h3>
        </div>

        {/* Presenter */}
        {presentation.presenter_name && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold tracking-widest font-mono" style={{ color: C.line }}>AGENTE:</span>
            <span className="text-xs font-semibold truncate" style={{ color: isActive ? C.cyan : C.muted }}>
              {presentation.presenter_name}
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="h-px" style={{ background: C.line }} />

        {/* Time */}
        <div className="flex items-center gap-1.5 text-xs font-mono" style={{ color: C.muted }}>
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatEcTime(presentation.scheduled_start)}
          {presentation.scheduled_end && ` — ${formatEcTime(presentation.scheduled_end)}`}
        </div>

        {/* Countdown */}
        {presentation.status === 'pending' && presentation.scheduled_start && (
          <KickoffTimer targetDate={presentation.scheduled_start} label="INICIA EN:" />
        )}

        {/* Description */}
        {presentation.description && (
          <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: C.muted }}>
            {presentation.description}
          </p>
        )}

        {/* Indicador de aportes pendientes de calificar */}
        {!isPresenter && (presentation.pending_ratings > 0
          ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c' }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              Te faltan <strong>{presentation.pending_ratings}</strong> aporte{presentation.pending_ratings !== 1 ? 's' : ''} por calificar
            </div>
          )
          : presentation.total_other_aportes > 0
            ? (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Todos los aportes calificados
              </div>
            )
            : null
        )}

        {/* CTA */}
        <button
          onClick={() => navigate(`/dashboard/kickoff/presentacion/${presentation.id}`)}
          disabled={presentation.status === 'pending' && !isPresenter}
          className="mt-1 w-full py-2.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={
            isActive
              ? { background: `${C.cyan}14`, color: C.cyan, border: `1px solid ${C.cyan}50` }
              : isFinished
                ? { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }
                : { background: '#f8fafc', color: C.muted, border: `1px solid ${C.line}` }
          }
        >
          {isActive
            ? '[ ACCEDER EN VIVO ]'
            : isFinished
              ? '[ VER INFORME FINAL ]'
              : isPresenter
                ? '[ PANEL DE PRESENTADOR ]'
                : '[ VER PRESENTACIÓN ]'
          }
        </button>
      </div>
    </div>
  );
}
