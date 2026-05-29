import React from 'react';
import { useNavigate } from 'react-router-dom';
import KickoffStatusBadge from './KickoffStatusBadge';
import KickoffTimer from './KickoffTimer';
import { formatEcTime } from '../api/kickoffDateUtils';

function RatingMini({ ratings }) {
  if (!ratings || !ratings.avg_overall || ratings.rating_count === 0) return null;
  const score = parseFloat(ratings.avg_overall);
  const stars = Math.round(score);
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-yellow-400 text-sm leading-none">
        {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
      </span>
      <span className="text-xs font-bold text-slate-600">{score.toFixed(1)}</span>
      <span className="text-xs text-slate-400">({ratings.rating_count})</span>
    </div>
  );
}

export default function KickoffPresentationCard({ presentation, index, isPresenter, ratings }) {
  const navigate = useNavigate();
  const isActive = ['active', 'questions_open', 'questions_closed'].includes(presentation.status);

  return (
    <div
      className={`
        relative group rounded-2xl border transition-all duration-300
        ${isActive
          ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg shadow-blue-100'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
        }
        p-5 flex flex-col gap-3
      `}
    >
      {/* Active pulse indicator */}
      {isActive && (
        <span className="absolute -top-2 -right-2 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500" />
        </span>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-100 text-slate-500 text-sm font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate">
              {presentation.title}
            </h3>
            {presentation.presenter_name && (
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {presentation.presenter_name}
              </p>
            )}
            <RatingMini ratings={ratings} />
          </div>
        </div>
        <KickoffStatusBadge status={presentation.status} type="presentation" className="flex-shrink-0" />
      </div>

      {/* Time row */}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatEcTime(presentation.scheduled_start)}
          {presentation.scheduled_end && ` — ${formatEcTime(presentation.scheduled_end)}`}
        </span>
      </div>

      {/* Countdown to next */}
      {presentation.status === 'pending' && presentation.scheduled_start && (
        <KickoffTimer targetDate={presentation.scheduled_start} label="Inicia en:" />
      )}

      {/* Description */}
      {presentation.description && (
        <p className="text-xs text-slate-500 line-clamp-2">{presentation.description}</p>
      )}

      {/* CTA */}
      <button
        onClick={() => navigate(`/dashboard/kickoff/presentacion/${presentation.id}`)}
        disabled={presentation.status === 'pending' && !isPresenter}
        className={`
          mt-1 w-full py-2 rounded-xl text-sm font-semibold transition-all duration-200
          ${isActive
            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
            : presentation.status === 'finished'
              ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }
        `}
      >
        {isActive
          ? 'Ver presentación en vivo →'
          : presentation.status === 'finished'
            ? 'Ver detalles'
            : isPresenter
              ? 'Abrir panel de presentador'
              : 'Ver detalle'
        }
      </button>
    </div>
  );
}
