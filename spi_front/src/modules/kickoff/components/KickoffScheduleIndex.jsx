import React from 'react';
import KickoffPresentationCard from './KickoffPresentationCard';
import KickoffRankingPanel from './KickoffRankingPanel';
import KickoffAdminWinnersPanel from './KickoffAdminWinnersPanel';
import KickoffStatusBadge from './KickoffStatusBadge';
import KickoffPostEventQA from './KickoffPostEventQA';
import KickoffAwardsSection from './KickoffAwardsSection';
import { formatEcDate } from '../api/kickoffDateUtils';

export default function KickoffScheduleIndex({ event, presentations, currentUserId, isAdmin, isTiAdmin }) {
  const activePresentation   = presentations.find(p => ['active', 'questions_open', 'questions_closed'].includes(p.status));
  const pendingPresentations = presentations.filter(p => ['pending', 'ready'].includes(p.status));
  const donePresentations    = presentations.filter(p => ['finished', 'skipped'].includes(p.status));

  const nonIntro   = presentations.filter(p => !p.is_intro);
  const allDone    = nonIntro.length > 0 && nonIntro.every(p => ['finished', 'skipped'].includes(p.status));
  const showPostQA = isTiAdmin && allDone && event?.id;

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">📅</div>
        <h3 className="text-lg font-semibold text-slate-700">Cronograma no disponible</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          El cronograma del Kick Off 2026 aún no ha sido configurado.<br />
          Vuelve a intentarlo más tarde.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Event header */}
      <div
        className="rounded-2xl p-6"
        style={{ background: '#0a1628', border: '1px solid #1a2d45' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <KickoffStatusBadge status={event.status} type="event" />
            </div>
            <h2 className="text-2xl font-black tracking-tight" style={{ color: '#ffffff' }}>{event.name}</h2>
            <p className="text-sm mt-1 capitalize font-mono" style={{ color: '#4a6080' }}>{formatEcDate(event.event_date)}</p>
            {event.description && (
              <p className="text-sm mt-2 max-w-lg" style={{ color: '#6b8aaa' }}>{event.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="text-xs font-mono font-bold tracking-widest" style={{ color: '#2a4060' }}>MISIONES</span>
            <span className="text-4xl font-black" style={{ color: '#00a8d4' }}>{presentations.length}</span>
          </div>
        </div>
      </div>

      {/* Active now */}
      {activePresentation && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#00a8d4' }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: '#00a8d4' }} />
            </span>
            <h3 className="text-xs font-black tracking-widest font-mono uppercase" style={{ color: '#00a8d4' }}>
              Misión en curso
            </h3>
          </div>
          <KickoffPresentationCard
            presentation={activePresentation}
            index={presentations.indexOf(activePresentation)}
            isPresenter={isAdmin || activePresentation.presenter_user_id === currentUserId}
          />
        </section>
      )}

      {/* Upcoming */}
      {pendingPresentations.length > 0 && (
        <section>
          <h3 className="text-xs font-black tracking-widest font-mono uppercase mb-3" style={{ color: '#6b8aaa' }}>
            Próximas misiones
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingPresentations.map((p) => (
              <KickoffPresentationCard
                key={p.id}
                presentation={p}
                index={presentations.indexOf(p)}
                isPresenter={isAdmin || p.presenter_user_id === currentUserId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {donePresentations.length > 0 && (
        <section>
          <h3 className="text-xs font-black tracking-widest font-mono uppercase mb-3" style={{ color: '#16a34a' }}>
            Misiones completadas
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {donePresentations.map((p) => (
              <KickoffPresentationCard
                key={p.id}
                presentation={p}
                index={presentations.indexOf(p)}
                isPresenter={isAdmin}
              />
            ))}
          </div>
        </section>
      )}

      {presentations.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          Aún no hay presentaciones configuradas para este evento.
        </div>
      )}

      {/* Live ranking during event — replaced by awards section when all done */}
      {event?.id && !allDone && (
        <KickoffRankingPanel eventId={event.id} />
      )}

      {/* Awards ceremony — visible to all once all presentations are done */}
      {event?.id && allDone && (
        <KickoffAwardsSection eventId={event.id} isAdmin={isAdmin} />
      )}

      {/* Panel de ganadores — solo admin/jefe_ti */}
      {isAdmin && event?.id && (
        <KickoffAdminWinnersPanel eventId={event.id} />
      )}

      {/* Mesa de preguntas finales — solo jefe_ti, cuando todo está completado */}
      {showPostQA && (
        <KickoffPostEventQA eventId={event.id} />
      )}
    </div>
  );
}
