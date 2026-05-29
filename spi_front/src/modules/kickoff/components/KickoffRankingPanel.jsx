import React, { useState, useEffect, useRef } from 'react';
import kickoffApi from '../api/kickoffApi';

const POLL_MS = 5000;
const MEDALS = ['🥇', '🥈', '🥉'];

function Stars({ value }) {
  if (!value) return <span className="text-slate-300 text-xs">Sin votos</span>;
  const full = Math.round(parseFloat(value));
  return (
    <span className="text-yellow-400 text-sm leading-none tracking-tight">
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
    </span>
  );
}

export default function KickoffRankingPanel({ eventId }) {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const timerRef = useRef(null);

  const load = async () => {
    if (!eventId) return;
    try {
      const res = await kickoffApi.getAporteRankings(eventId);
      setRankings(res.data || []);
    } catch {
      setRankings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!eventId) return;
    load();
    timerRef.current = setInterval(load, POLL_MS);
    const onVis = () => {
      if (document.hidden) clearInterval(timerRef.current);
      else { load(); timerRef.current = setInterval(load, POLL_MS); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [eventId]); // eslint-disable-line

  if (loading) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-base">&#128161;</span>
        <h3 className="text-sm font-bold text-slate-700">Mejores aportes</h3>
        <span className="flex items-center gap-1 ml-auto text-xs text-emerald-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          En tiempo real
        </span>
      </div>

      {rankings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center">
          <p className="text-sm text-slate-400">Aún no hay aportes registrados.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {rankings.map((r, idx) => {
            const hasRating = r.rating_count > 0;
            const medal = MEDALS[idx] ?? null;
            const score = hasRating ? parseFloat(r.avg_rating).toFixed(1) : '-';
            const initials = (r.collaborator_name || 'C').trim().charAt(0).toUpperCase();

            return (
              <div
                key={r.id}
                className={`grid grid-cols-[2rem_2.5rem_1fr_auto] gap-3 px-4 py-3 items-center border-b border-slate-50 last:border-0 ${idx === 0 && hasRating ? 'bg-yellow-50' : 'hover:bg-slate-50'}`}
              >
                <div className="text-center">
                  {hasRating && medal
                    ? <span className="text-lg leading-none">{medal}</span>
                    : <span className="text-sm font-bold text-slate-400">{idx + 1}</span>}
                </div>

                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-semibold shrink-0">
                  {r.collaborator_avatar_url
                    ? <img src={r.collaborator_avatar_url} alt={r.collaborator_name || ''} className="w-full h-full object-cover" />
                    : initials}
                </div>

                <p className="text-sm font-semibold text-slate-800 truncate">{r.collaborator_name || 'Colaborador'}</p>

                <div className="flex flex-col items-end gap-0.5">
                  <span className={`text-xl font-black leading-none ${idx === 0 ? 'text-yellow-600' : 'text-slate-700'}`}>{score}</span>
                  <Stars value={r.avg_rating} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
