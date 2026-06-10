import React, { useState, useEffect, useRef } from 'react';
import kickoffApi from '../api/kickoffApi';

const C = { cyan: '#00a8d4', gold: '#c49a10', navy: '#0a1628', text: '#1e3a5f', muted: '#6b8aaa', line: '#dce8f5' };
const POLL_MS = 5000;

function StarBar({ value }) {
  if (!value) return <span className="text-xs font-mono" style={{ color: C.line }}>sin votos</span>;
  const full = Math.round(parseFloat(value));
  const pct  = (parseFloat(value) / 5) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: C.line }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${C.cyan}, ${C.gold})` }} />
      </div>
      <span className="text-xs font-black font-mono" style={{ color: C.gold }}>{parseFloat(value).toFixed(1)}</span>
    </div>
  );
}

export default function KickoffRankingPanel({ eventId }) {
  const [rankings, setRankings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const timerRef = useRef(null);

  const load = async () => {
    if (!eventId) return;
    try {
      const res = await kickoffApi.getAporteRankings(eventId);
      setRankings(res.data || []);
    } catch { setRankings([]); }
    finally { setLoading(false); }
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
    return () => { clearInterval(timerRef.current); document.removeEventListener('visibilitychange', onVis); };
  }, [eventId]); // eslint-disable-line

  if (loading || rankings.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-px flex-1" style={{ background: C.line }} />
        <p className="text-xs font-black tracking-widest font-mono" style={{ color: C.muted }}>💡 RANKING DE APORTES</p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: C.cyan }} />
          <span className="text-xs font-mono font-bold" style={{ color: C.cyan }}>EN VIVO</span>
        </div>
        <div className="h-px flex-1" style={{ background: C.line }} />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: `1.5px solid ${C.line}` }}>
        {rankings.slice(0, 10).map((r, idx) => {
          const initials = (r.collaborator_name || 'C').trim().charAt(0).toUpperCase();
          const isTop    = idx === 0 && r.rating_count > 0;
          return (
            <div
              key={r.id ?? idx}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background:   isTop ? `${C.gold}0a` : 'transparent',
                borderBottom: `1px solid ${C.line}`,
              }}
            >
              <div className="w-6 text-center flex-shrink-0">
                {isTop
                  ? <span className="text-base">🏆</span>
                  : <span className="text-xs font-black font-mono" style={{ color: C.line }}>#{idx + 1}</span>}
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 overflow-hidden"
                style={{ background: isTop ? `${C.gold}20` : '#f4f8fc', color: isTop ? C.gold : C.muted, border: `1px solid ${isTop ? '#f0e090' : C.line}` }}
              >
                {r.collaborator_avatar_url
                  ? <img src={r.collaborator_avatar_url} alt="" className="w-full h-full object-cover" />
                  : initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: isTop ? C.navy : C.text }}>
                  {r.collaborator_name || 'Colaborador'}
                </p>
                {r.presentation_title && (
                  <p className="text-[11px] truncate" style={{ color: C.muted }}>
                    {r.presentation_title}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">
                <StarBar value={r.avg_rating} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
