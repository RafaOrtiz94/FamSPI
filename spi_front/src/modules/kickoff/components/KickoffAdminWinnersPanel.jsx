import React, { useState, useEffect, useRef } from 'react';
import kickoffApi from '../api/kickoffApi';

const POLL_MS = 8000;

const C = {
  cyan:  '#00a8d4',
  gold:  '#c49a10',
  navy:  '#0a1628',
  text:  '#1e3a5f',
  muted: '#6b8aaa',
  line:  '#dce8f5',
  bg:    '#f4f8fc',
};

function StarBar({ value, max = 5 }) {
  if (!value) return <span className="text-xs font-mono" style={{ color: C.muted }}>SIN DATOS</span>;
  const pct = (parseFloat(value) / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.line }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${C.cyan}, ${C.gold})` }}
        />
      </div>
      <span className="text-xs font-black font-mono w-8 text-right" style={{ color: C.gold }}>
        {parseFloat(value).toFixed(1)}
      </span>
    </div>
  );
}

function AgentRow({ rank, agent, isTop }) {
  const initials = (agent.collaborator_name || 'A').trim().charAt(0).toUpperCase();

  return (
    <div
      className="flex items-center gap-4 px-5 py-3.5 transition-colors"
      style={{
        background:   isTop ? `${C.gold}0c` : 'transparent',
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      {/* Rank */}
      <div className="w-8 flex-shrink-0 text-center">
        {isTop
          ? <span className="text-xl leading-none">🏆</span>
          : <span className="text-xs font-black font-mono" style={{ color: C.muted }}>
              #{String(rank).padStart(2, '0')}
            </span>
        }
      </div>

      {/* Avatar */}
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black overflow-hidden"
        style={{
          background: isTop ? `linear-gradient(135deg, ${C.gold}, #e8b820)` : C.line,
          color:      isTop ? '#fff' : C.cyan,
          border:     `1.5px solid ${isTop ? C.gold : C.line}`,
        }}
      >
        {agent.collaborator_avatar_url
          ? <img src={agent.collaborator_avatar_url} alt="" className="w-full h-full object-cover" />
          : initials}
      </div>

      {/* Name + presentación + bar */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: isTop ? C.navy : C.text }}>
          {agent.collaborator_name || 'Colaborador'}
        </p>
        {agent.presentation_title && (
          <p className="text-[11px] truncate mb-1.5" style={{ color: C.muted }}>
            {agent.presentation_title}
          </p>
        )}
        <StarBar value={agent.avg_rating} />
      </div>

      {/* Vote count */}
      <span className="flex-shrink-0 text-xs font-mono" style={{ color: C.muted }}>
        {agent.rating_count} {agent.rating_count === 1 ? 'voto' : 'votos'}
      </span>
    </div>
  );
}

export default function KickoffAdminWinnersPanel({ eventId }) {
  const [rankings, setRankings] = useState([]);
  const [loading,  setLoading]  = useState(true);
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

  const winner = rankings[0] ?? null;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className="h-px flex-1" style={{ background: C.line }} />
        <span className="text-xs font-black tracking-widest font-mono" style={{ color: C.gold }}>
          ◈ CLASIFICACIÓN DE AGENTES ◈
        </span>
        <div className="h-px flex-1" style={{ background: C.line }} />
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: '#ffffff',
          border:     `1.5px solid ${C.line}`,
          boxShadow:  '0 4px 20px #0a162810',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}
        >
          <div>
            <p className="text-xs font-bold tracking-widest font-mono mb-0.5" style={{ color: C.muted }}>
              [ SOLO ADMINISTRADORES ]
            </p>
            <h3 className="text-base font-black tracking-wide" style={{ color: C.navy }}>
              Mejores aportes del evento
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: C.cyan }} />
            <span className="text-xs font-mono font-bold" style={{ color: C.cyan }}>EN VIVO</span>
          </div>
        </div>

        {/* Winner spotlight */}
        {winner && winner.rating_count > 0 && (
          <div
            className="px-5 py-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left"
            style={{ background: `${C.gold}08`, borderBottom: `1px solid ${C.line}` }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black flex-shrink-0 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${C.gold}, #e8b820)`,
                color:      '#fff',
                border:     `2px solid ${C.gold}`,
                boxShadow:  `0 0 20px ${C.gold}40`,
              }}
            >
              {winner.collaborator_avatar_url
                ? <img src={winner.collaborator_avatar_url} alt="" className="w-full h-full object-cover" />
                : (winner.collaborator_name || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black tracking-widest font-mono mb-1" style={{ color: C.gold }}>
                🏆 AGENTE DESTACADO
              </p>
              <p className="text-xl font-black truncate" style={{ color: C.navy }}>
                {winner.collaborator_name || 'Colaborador'}
              </p>
              <div className="flex items-center gap-3 mt-2 justify-center sm:justify-start">
                <div style={{ minWidth: 120 }}>
                  <StarBar value={winner.avg_rating} />
                </div>
                <span className="text-xs font-mono flex-shrink-0" style={{ color: C.muted }}>
                  {winner.rating_count} votos
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Rankings list */}
        {rankings.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm font-mono" style={{ color: C.muted }}>
              [ SIN DATOS — ESPERANDO APORTES ]
            </p>
          </div>
        ) : (
          <div>
            {rankings.map((agent, idx) => (
              <AgentRow
                key={agent.id ?? idx}
                rank={idx + 1}
                agent={agent}
                isTop={idx === 0 && agent.rating_count > 0}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          className="px-5 py-2.5 flex items-center justify-between"
          style={{ background: C.bg, borderTop: `1px solid ${C.line}` }}
        >
          <span className="text-xs font-mono" style={{ color: C.muted }}>FAM PROJECT — KICK OFF 2026</span>
          <span className="text-xs font-mono" style={{ color: C.muted }}>
            {rankings.length} agente{rankings.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </section>
  );
}
