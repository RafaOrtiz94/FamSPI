import React, { useState, useEffect, useRef } from 'react';
import KickoffPresentationCard from './KickoffPresentationCard';
import KickoffRankingPanel from './KickoffRankingPanel';
import KickoffStatusBadge from './KickoffStatusBadge';
import kickoffApi from '../api/kickoffApi';
import { formatEcDate } from '../api/kickoffDateUtils';

const RANK_POLL = 6000;

export default function KickoffScheduleIndex({ event, presentations, currentUserId }) {
  const [rankings, setRankings] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!event?.id) return;
    const load = async () => {
      try {
        const res = await kickoffApi.getEventRankings(event.id);
        setRankings(res.data || []);
      } catch {}
    };
    load();
    timerRef.current = setInterval(load, RANK_POLL);
    const onVis = () => {
      if (document.hidden) clearInterval(timerRef.current);
      else { load(); timerRef.current = setInterval(load, RANK_POLL); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(timerRef.current); document.removeEventListener('visibilitychange', onVis); };
  }, [event?.id]); // eslint-disable-line

  const activePresentation   = presentations.find(p => ['active', 'questions_open', 'questions_closed'].includes(p.status));
  const pendingPresentations = presentations.filter(p => ['pending', 'ready'].includes(p.status));
  const donePresentations    = presentations.filter(p => ['finished', 'skipped'].includes(p.status));

  // Build a lookup map of ratings by presentation_id
  const ratingsMap = Object.fromEntries(rankings.map(r => [r.presentation_id, r]));

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
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-blue-950 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <KickoffStatusBadge status={event.status} type="event" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">{event.name}</h2>
            <p className="text-blue-200 text-sm mt-1 capitalize">{formatEcDate(event.event_date)}</p>
            {event.description && (
              <p className="text-slate-300 text-sm mt-2 max-w-lg">{event.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="text-slate-300 text-xs">Presentaciones</span>
            <span className="text-4xl font-black">{presentations.length}</span>
          </div>
        </div>
      </div>

      {/* Active now */}
      {activePresentation && (
        <section>
          <h3 className="text-xs font-bold tracking-widest text-green-600 uppercase mb-3 flex items-center gap-2">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Ahora en presentación
          </h3>
          <KickoffPresentationCard
            presentation={activePresentation}
            index={presentations.indexOf(activePresentation)}
            isPresenter={activePresentation.presenter_user_id === currentUserId}
            ratings={ratingsMap[activePresentation.id]}
          />
        </section>
      )}

      {/* Upcoming */}
      {pendingPresentations.length > 0 && (
        <section>
          <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">
            Próximas presentaciones
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingPresentations.map((p) => (
              <KickoffPresentationCard
                key={p.id}
                presentation={p}
                index={presentations.indexOf(p)}
                isPresenter={p.presenter_user_id === currentUserId}
                ratings={ratingsMap[p.id]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {donePresentations.length > 0 && (
        <section>
          <h3 className="text-xs font-bold tracking-widest text-slate-300 uppercase mb-3">
            Presentaciones finalizadas
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {donePresentations.map((p) => (
              <KickoffPresentationCard
                key={p.id}
                presentation={p}
                index={presentations.indexOf(p)}
                isPresenter={false}
                ratings={ratingsMap[p.id]}
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

      {/* Real-time ranking */}
      {event?.id && (
        <KickoffRankingPanel eventId={event.id} />
      )}
    </div>
  );
}
