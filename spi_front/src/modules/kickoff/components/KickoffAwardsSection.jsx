import React, { useEffect, useState, useRef, useCallback } from 'react';
import kickoffApi from '../api/kickoffApi';
import KickoffTiebreakerPanel from './KickoffTiebreakerPanel';

// ─── constants ────────────────────────────────────────────────────────────────

const POLL_MS    = 8000;  // rankings
const TB_POLL_MS = 5000;  // tiebreaker — 5 s es suficiente para tiempo real con 40 usuarios

// ─── CSS keyframes (injected once) ───────────────────────────────────────────

const STYLE_ID = 'kf-awards-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

    @keyframes kf-scan {
      0%   { top: -4px; opacity: 0; }
      5%   { opacity: 1; }
      95%  { opacity: 1; }
      100% { top: 100%; opacity: 0; }
    }
    @keyframes kf-flicker {
      0%,100% { opacity: 1; }
      30%     { opacity: 0.6; }
      32%     { opacity: 1; }
      70%     { opacity: 0.8; }
      72%     { opacity: 1; }
    }
    @keyframes kf-declassify {
      0%   { transform: scale(1.06) translateY(8px); opacity: 0; filter: blur(6px); }
      60%  { transform: scale(0.98) translateY(0); opacity: 1; filter: blur(0); }
      80%  { transform: scale(1.01); }
      100% { transform: scale(1); }
    }
    @keyframes kf-stamp {
      0%   { transform: scale(3.5) rotate(-18deg); opacity: 0; }
      55%  { transform: scale(0.88) rotate(4deg); opacity: 1; }
      75%  { transform: scale(1.04) rotate(-2deg); }
      100% { transform: scale(1) rotate(0deg); }
    }
    @keyframes kf-glow {
      0%,100% { box-shadow: 0 0 24px #c49a1040, 0 0 60px #c49a1018, inset 0 0 30px #c49a1006; }
      50%      { box-shadow: 0 0 48px #c49a1070, 0 0 120px #c49a1030, inset 0 0 60px #c49a1012; }
    }
    @keyframes kf-rank-in {
      0%   { transform: translateX(-16px); opacity: 0; }
      100% { transform: translateX(0);      opacity: 1; }
    }
    @keyframes kf-particle {
      0%   { transform: translate(0,0) scale(1); opacity: 1; }
      100% { transform: translate(var(--tx),var(--ty)) scale(0.2); opacity: 0; }
    }
    @keyframes kf-bar-fill {
      0%   { width: 0%; }
      100% { width: var(--bar-w); }
    }
    @keyframes kf-crown {
      0%,100% { transform: rotate(-4deg) scale(1);   }
      50%      { transform: rotate(4deg)  scale(1.1); }
    }
    @keyframes kf-redact-pulse {
      0%,100% { opacity: 1; }
      50%      { opacity: 0.7; }
    }
    .kf-rank-row { animation: kf-rank-in 0.4s ease both; }
    .kf-bar      { animation: kf-bar-fill 1s cubic-bezier(.2,.8,.2,1) both; }
    .kf-declassify { animation: kf-declassify 0.7s cubic-bezier(.2,.8,.2,1) both; }
    .kf-glow-loop  { animation: kf-glow 3s ease-in-out infinite; }
    .kf-crown-bob  { animation: kf-crown 2s ease-in-out infinite; }
    .kf-flicker    { animation: kf-flicker 1.8s ease-in-out; }
  `;
  document.head.appendChild(s);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name.trim().split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

function useTypewriter(text, active, speed = 28) {
  const [displayed, setDisplayed] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!active || !text) { setDisplayed(''); return; }
    let i = 0;
    setDisplayed('');
    ref.current = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(ref.current);
    }, speed);
    return () => clearInterval(ref.current);
  }, [text, active, speed]);
  return displayed;
}

// ─── Particle burst ───────────────────────────────────────────────────────────

function ParticleBurst({ active }) {
  const particles = useRef(
    Array.from({ length: 28 }, (_, i) => {
      const angle = (i / 28) * 360 + Math.random() * 15;
      const dist  = 80 + Math.random() * 120;
      const rad   = (angle * Math.PI) / 180;
      return {
        tx: Math.round(Math.cos(rad) * dist),
        ty: Math.round(Math.sin(rad) * dist),
        size: 4 + Math.random() * 6,
        color: ['#c49a10','#f0c040','#00a8d4','#ffffff','#ffd700'][Math.floor(Math.random() * 5)],
        delay: Math.random() * 0.3,
        dur: 0.8 + Math.random() * 0.5,
      };
    })
  ).current;

  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 30 }}>
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size, height: p.size,
            background: p.color,
            top: '50%', left: '50%',
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            animation: `kf-particle ${p.dur}s ease-out ${p.delay}s both`,
            boxShadow: `0 0 6px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value, max = 5, gold = false, animate = false }) {
  const pct  = value ? Math.round((parseFloat(value) / max) * 100) : 0;
  const color = gold ? '#c49a10' : '#00a8d4';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#1e3a55', minWidth: 40 }}>
        <div
          className={animate ? 'kf-bar' : ''}
          style={{
            height: '100%',
            background: gold
              ? 'linear-gradient(90deg, #8a6800, #c49a10, #f0d060)'
              : `linear-gradient(90deg, #006a88, ${color})`,
            borderRadius: 99,
            '--bar-w': `${pct}%`,
            width: animate ? undefined : `${pct}%`,
            animationDelay: animate ? '0.6s' : undefined,
          }}
        />
      </div>
      <span
        className="text-xs font-black font-mono flex-shrink-0"
        style={{ color, width: 28, textAlign: 'right' }}
      >
        {value ? parseFloat(value).toFixed(1) : '—'}
      </span>
    </div>
  );
}

// ─── Rank row ─────────────────────────────────────────────────────────────────

function RankRow({ entry, rank, delay = 0 }) {
  const isWinner = rank === 1 && entry.rating_count > 0;
  return (
    <div
      className="kf-rank-row flex items-center gap-3 px-4 py-2.5"
      style={{
        animationDelay: `${delay}s`,
        borderBottom: '1px solid #0d1f35',
        background: isWinner ? 'linear-gradient(90deg, #1a2800 0%, #1c2d10 100%)' : 'transparent',
      }}
    >
      {/* Rank */}
      <div className="w-7 flex-shrink-0 text-center">
        {isWinner
          ? <span className="text-sm kf-crown-bob inline-block">🏆</span>
          : <span className="text-xs font-black font-mono" style={{ color: '#5a82a0' }}>#{rank}</span>}
      </div>

      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 overflow-hidden"
        style={{
          background: isWinner ? 'linear-gradient(135deg, #8a6800, #c49a10)' : '#0d1f35',
          color: isWinner ? '#fff' : '#7aaac8',
          border: `1px solid ${isWinner ? '#c49a10' : '#1e3a55'}`,
          fontFamily: "'Share Tech Mono', monospace",
        }}
      >
        {entry.collaborator_avatar_url
          ? <img src={entry.collaborator_avatar_url} alt="" className="w-full h-full object-cover" />
          : initials(entry.collaborator_name)}
      </div>

      {/* Name + presentation */}
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-black truncate"
          style={{
            color: isWinner ? '#ffd700' : '#c8e0f0',
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: '0.04em',
          }}
        >
          {entry.collaborator_name}
        </p>
        {entry.presentation_title && (
          <p className="text-[10px] truncate" style={{ color: '#5a82a0', fontFamily: "'Share Tech Mono', monospace" }}>
            {entry.presentation_title}
          </p>
        )}
      </div>

      {/* Score */}
      <div className="flex-shrink-0 w-28">
        <ScoreBar value={entry.avg_rating} gold={isWinner} animate />
      </div>

      {/* Count */}
      <div className="w-12 text-right flex-shrink-0">
        <span className="text-[10px] font-mono" style={{ color: '#5a82a0' }}>
          {entry.rating_count}v
        </span>
      </div>
    </div>
  );
}

// ─── Winner card ──────────────────────────────────────────────────────────────

// Vista para usuarios normales mientras el empate no se resuelve: tarjeta clasificada, sin revelar.
function WinnerCardClassified() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{ background: '#060d18', border: '1.5px solid #0d1f35' }}
    >
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.25em] mb-0.5" style={{ color: '#4a9ab8', fontFamily: "'Share Tech Mono', monospace" }}>
            APORTE DESTACADO
          </p>
          <h3 className="text-sm font-black tracking-widest" style={{ color: '#1a2d45', fontFamily: "'Share Tech Mono', monospace" }}>
            ████████████
          </h3>
        </div>
        <div className="flex-shrink-0 px-3 py-2 rounded-xl" style={{ background: '#0d1f35', border: '1px solid #1a2d45', animation: 'kf-redact-pulse 2s ease-in-out infinite' }}>
          <span className="text-xs font-black font-mono" style={{ color: '#1a2d45' }}>██.█</span>
        </div>
      </div>
      <div className="px-5 pb-5">
        <div className="rounded-xl p-4" style={{ background: '#060d18', border: '1px solid #0d1f35', minHeight: 72 }}>
          {[100, 85, 90, 60].map((w, i) => (
            <div key={i} className="h-2.5 rounded-full mb-2" style={{ width: `${w}%`, background: '#0d1f35', animation: 'kf-redact-pulse 2s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <div className="mt-3 py-3 rounded-xl flex items-center justify-center gap-2" style={{ background: '#060d18', border: '1px solid #0d1f35' }}>
          <span className="text-xs font-black tracking-[0.15em] font-mono" style={{ color: '#2a4060' }}>
            [ PENDIENTE DE REVELACIÓN ]
          </span>
        </div>
      </div>
    </div>
  );
}

function TiedCard({ tiedCount }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{ background: '#0d1400', border: '1.5px solid #c49a1060' }}
    >
      {/* Scanning pulse line */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent, #c49a10, transparent)',
          animation: 'kf-scan 2.4s linear infinite',
          boxShadow: '0 0 10px #c49a10, 0 0 30px #c49a1050',
        }}
      />

      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.25em] mb-1" style={{ color: '#c49a10', fontFamily: "'Share Tech Mono', monospace" }}>
            ⚖ EMPATE DETECTADO
          </p>
          <h3 className="text-sm font-black tracking-widest" style={{ color: '#f0d060', fontFamily: "'Share Tech Mono', monospace" }}>
            {tiedCount} APORTES EMPATADOS
          </h3>
          <p className="text-[11px] mt-1" style={{ color: '#5a82a0', fontFamily: "'Share Tech Mono', monospace" }}>
            primer lugar · misma puntuación
          </p>
        </div>
        <div
          className="flex-shrink-0 px-3 py-2 rounded-xl flex flex-col items-center gap-1"
          style={{ background: '#c49a1012', border: '1px solid #c49a1040' }}
        >
          <span className="text-2xl font-black font-mono leading-none" style={{ color: '#f0d060' }}>
            {tiedCount}
          </span>
          <span className="text-[9px] tracking-widest font-mono" style={{ color: '#8a6800' }}>empate</span>
        </div>
      </div>

      {/* Redacted rows to suggest hidden content */}
      <div className="px-5 pb-5">
        <div className="rounded-xl p-4" style={{ background: '#060d18', border: '1px solid #1a2800', minHeight: 72 }}>
          {[100, 80, 90, 50].map((w, i) => (
            <div
              key={i}
              className="h-2.5 rounded-full mb-2"
              style={{
                width: `${w}%`,
                background: '#1a2800',
                animation: 'kf-redact-pulse 2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        {/* Status indicator */}
        <div className="mt-3 flex items-center justify-center gap-2 py-3 rounded-xl" style={{ background: '#060d18', border: '1px solid #1a2800' }}>
          <span className="flex h-2 w-2 relative flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#c49a10' }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: '#c49a10' }} />
          </span>
          <span className="text-xs font-black tracking-[0.15em] font-mono" style={{ color: '#8a6800' }}>
            DESEMPATE EN CURSO — VOTA AHORA
          </span>
        </div>
      </div>
    </div>
  );
}

function WinnerCard({ winner, revealed, onReveal, scanning, isTied, tiedCount, isAdmin }) {
  const text    = useTypewriter(winner?.aporte_text || '', revealed, 22);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (revealed) {
      const t = setTimeout(() => setBurst(true), 300);
      const t2 = setTimeout(() => setBurst(false), 2000);
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
  }, [revealed]);

  // Empate activo: jefe_ti ve la TiedCard, el resto ve la tarjeta clasificada sin revelar
  if (isTied && isAdmin) return <TiedCard tiedCount={tiedCount} />;
  if (isTied && !isAdmin) return <WinnerCardClassified />;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${revealed ? 'kf-declassify kf-glow-loop' : ''}`}
      style={{
        background: revealed
          ? 'linear-gradient(135deg, #1a2800 0%, #0d1f0d 40%, #0a1628 100%)'
          : '#060d18',
        border: `1.5px solid ${revealed ? '#c49a10' : '#0d1f35'}`,
        transition: 'border-color 0.4s',
      }}
    >
      <ParticleBurst active={burst} />

      {/* Scan overlay */}
      {scanning && (
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            height: 3,
            background: 'linear-gradient(90deg, transparent, #00a8d4, #00a8d4, transparent)',
            animation: 'kf-scan 1.2s linear forwards',
            zIndex: 20,
            boxShadow: '0 0 12px #00a8d4, 0 0 40px #00a8d460',
          }}
        />
      )}

      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div>
          <p
            className="text-xs font-black tracking-[0.25em] mb-0.5"
            style={{ color: '#4a9ab8', fontFamily: "'Share Tech Mono', monospace" }}
          >
            APORTE DESTACADO
          </p>
          <h3
            className="text-sm font-black tracking-widest"
            style={{
              color: revealed ? '#ffd700' : '#1a2d45',
              fontFamily: "'Share Tech Mono', monospace",
              transition: 'color 0.5s',
            }}
          >
            {revealed ? (winner?.collaborator_name || 'AGENTE') : '████████████'}
          </h3>
          {revealed && winner?.presentation_title && (
            <p className="text-[11px] mt-0.5" style={{ color: '#7aaac8', fontFamily: "'Share Tech Mono', monospace" }}>
              {winner.presentation_title}
            </p>
          )}
        </div>

        {/* Stamp / Score */}
        {revealed ? (
          <div
            className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl"
            style={{ background: '#c49a1015', border: '1px solid #c49a1040' }}
          >
            <span className="text-2xl font-black font-mono leading-none" style={{ color: '#f0d060' }}>
              {winner?.avg_rating ? parseFloat(winner.avg_rating).toFixed(1) : '—'}
            </span>
            <span className="text-[9px] tracking-widest font-mono" style={{ color: '#c49a10' }}>
              / 5.0 · {winner?.rating_count}v
            </span>
          </div>
        ) : (
          <div
            className="flex-shrink-0 px-3 py-2 rounded-xl"
            style={{
              background: '#0d1f35',
              border: '1px solid #1a2d45',
              animation: 'kf-redact-pulse 2s ease-in-out infinite',
            }}
          >
            <span className="text-xs font-black font-mono" style={{ color: '#1a2d45' }}>
              ██.█
            </span>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="px-5 pb-5">
        {revealed ? (
          <div
            className="rounded-xl p-4 relative"
            style={{
              background: '#060d18',
              border: '1px solid #1a3010',
              minHeight: 72,
            }}
          >
            <span
              className="text-sm leading-relaxed"
              style={{ color: '#c8ee98', fontFamily: "'Share Tech Mono', monospace" }}
            >
              {text}
              <span
                className="inline-block w-0.5 h-4 ml-0.5 align-middle"
                style={{
                  background: '#c8ee98',
                  animation: text.length < (winner?.aporte_text?.length || 0) ? 'kf-flicker 0.8s steps(1) infinite' : 'none',
                  opacity: text.length >= (winner?.aporte_text?.length || 0) ? 0 : 1,
                }}
              />
            </span>
          </div>
        ) : (
          /* Redacted content */
          <div
            className="rounded-xl p-4"
            style={{ background: '#060d18', border: '1px solid #0d1f35', minHeight: 72 }}
          >
            {[100, 85, 90, 60].map((w, i) => (
              <div
                key={i}
                className="h-2.5 rounded-full mb-2"
                style={{
                  width: `${w}%`,
                  background: '#0d1f35',
                  animation: 'kf-redact-pulse 2s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Score bar (visible when revealed) */}
      {revealed && winner?.avg_rating && (
        <div className="px-5 pb-4">
          <ScoreBar value={winner.avg_rating} gold animate />
        </div>
      )}

      {/* CTA button */}
      {!revealed && (
        <div className="px-5 pb-5">
          <button
            onClick={onReveal}
            disabled={scanning}
            className="w-full py-3 rounded-xl font-black tracking-[0.2em] uppercase text-xs transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: scanning
                ? 'transparent'
                : 'linear-gradient(135deg, #004455 0%, #006680 100%)',
              color: scanning ? '#00a8d4' : '#00e5ff',
              border: `1.5px solid ${scanning ? '#00a8d4' : '#006680'}`,
              fontFamily: "'Share Tech Mono', monospace",
              letterSpacing: '0.2em',
              boxShadow: scanning ? 'none' : '0 0 20px #00a8d418',
            }}
          >
            {scanning ? '[ DESENCRIPTANDO... ]' : '[ REVELAR APORTE GANADOR ]'}
          </button>
        </div>
      )}

      {/* Declassified stamp */}
      {revealed && (
        <div
          className="absolute top-4 right-4 pointer-events-none"
          style={{
            animation: 'kf-stamp 0.5s cubic-bezier(.2,.8,.2,1) 0.2s both',
          }}
        >
          <div
            className="px-2.5 py-1 rounded border-2 font-black text-[10px] tracking-[0.3em]"
            style={{
              color: '#c49a10',
              borderColor: '#c49a10',
              fontFamily: "'Share Tech Mono', monospace",
              transform: 'rotate(-12deg)',
              opacity: 0.85,
              textShadow: '0 0 8px #c49a1060',
            }}
          >
            DESCLASIFICADO
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KickoffAwardsSection({ eventId, isAdmin }) {
  const [rankings,         setRankings]         = useState([]);
  const [tiebreakerStatus, setTiebreakerStatus] = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [phase,            setPhase]            = useState('idle'); // idle | scanning | revealed
  const rankTimerRef = useRef(null);
  const tbTimerRef   = useRef(null);
  const prevWinnerIdRef = useRef(null);

  const loadRankings = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await kickoffApi.getAporteRankings(eventId);
      setRankings(res.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [eventId]);

  const loadTiebreaker = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await kickoffApi.getTiebreaker(eventId);
      setTiebreakerStatus(res.data);
    } catch { /* silent */ }
  }, [eventId]);

  useEffect(() => {
    loadRankings();
    loadTiebreaker();
    rankTimerRef.current = setInterval(loadRankings, POLL_MS);
    tbTimerRef.current   = setInterval(loadTiebreaker, TB_POLL_MS);
    const onVis = () => {
      if (document.hidden) {
        clearInterval(rankTimerRef.current);
        clearInterval(tbTimerRef.current);
      } else {
        loadRankings();
        loadTiebreaker();
        rankTimerRef.current = setInterval(loadRankings, POLL_MS);
        tbTimerRef.current   = setInterval(loadTiebreaker, TB_POLL_MS);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(rankTimerRef.current);
      clearInterval(tbTimerRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loadRankings, loadTiebreaker]);

  // Detectar si hay empate en el primer lugar
  const topRating   = rankings[0]?.avg_rating;
  const tiedAportes = rankings.filter(r => r.rating_count > 0 && parseFloat(r.avg_rating) === parseFloat(topRating));
  const isTied      = tiedAportes.length >= 2;

  // El ganador definitivo viene del desempate (si hay) o del ranking (si no hay empate)
  const tiebreakerWinner = tiebreakerStatus?.last_round?.winner_aporte_id
    ? tiebreakerStatus.last_round.candidates?.find(c => c.aporte_id === tiebreakerStatus.last_round.winner_aporte_id)
    : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const winner = tiebreakerWinner
    ? { ...tiebreakerWinner, aporte_text: tiebreakerWinner.aporte_text, collaborator_name: tiebreakerWinner.collaborator_name, avg_rating: null }
    : (!isTied ? (rankings.find(r => r.rating_count > 0) || rankings[0]) : null);

  // Resetear la animación cuando se resuelve el empate (nuevo ganador)
  useEffect(() => {
    const newId = winner?.aporte_id ?? winner?.id ?? null;
    if (newId && newId !== prevWinnerIdRef.current) {
      prevWinnerIdRef.current = newId;
      setPhase('idle');
    }
  }, [winner]);

  const handleReveal = () => {
    if (phase !== 'idle') return;
    setPhase('scanning');
    setTimeout(() => setPhase('revealed'), 1600);
  };

  if (loading) return null;
  if (rankings.length === 0) return null;

  return (
    <section>
      {/* Section label */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, #0d1f35)' }} />
        <span
          className="text-[10px] font-black tracking-[0.3em] px-3 py-1 rounded-full"
          style={{
            color: isTied && !tiebreakerWinner ? '#c49a10' : '#c49a10',
            border: `1px solid ${isTied && !tiebreakerWinner ? '#c49a1070' : '#c49a1040'}`,
            background: isTied && !tiebreakerWinner ? '#c49a1015' : '#c49a1008',
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          {isTied && !tiebreakerWinner ? '⚖ EMPATE · OPERACIÓN APORTES' : '★ OPERACIÓN APORTES'}
        </span>
        <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, #0d1f35, transparent)' }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">

        {/* ── Rankings list ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#060d18', border: '1px solid #0d1f35' }}
        >
          {/* List header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #0d1f35', background: '#070e1a' }}
          >
            <span
              className="text-[10px] font-black tracking-[0.25em]"
              style={{ color: '#5a8aaa', fontFamily: "'Share Tech Mono', monospace" }}
            >
              CLASIFICACIÓN DE CAMPO
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00a8d4', animation: 'kf-flicker 2s steps(1) infinite' }} />
              <span className="text-[10px] font-black font-mono" style={{ color: '#00a8d4' }}>EN VIVO</span>
            </div>
          </div>

          {/* Column headers */}
          <div
            className="flex items-center gap-3 px-4 py-1.5"
            style={{ borderBottom: '1px solid #0d1f35' }}
          >
            <span className="w-7 flex-shrink-0" />
            <span className="w-7 flex-shrink-0" />
            <span className="flex-1 text-[9px] font-black tracking-widest font-mono" style={{ color: '#4a7090' }}>AGENTE</span>
            <span className="w-28 flex-shrink-0 text-[9px] font-black tracking-widest font-mono text-right" style={{ color: '#4a7090' }}>PUNTUACIÓN</span>
            <span className="w-12 flex-shrink-0 text-[9px] font-black tracking-widest font-mono text-right" style={{ color: '#4a7090' }}>VOTOS</span>
          </div>

          {/* Rows */}
          {rankings.slice(0, 10).map((r, i) => (
            <RankRow key={r.id ?? i} entry={r} rank={i + 1} delay={i * 0.06} />
          ))}

          {/* Footer */}
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: '1px solid #0d1f35' }}>
            <span className="text-[10px] font-mono" style={{ color: '#4a7090' }}>
              {rankings.length} aporte{rankings.length !== 1 ? 's' : ''} registrado{rankings.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] font-mono" style={{ color: '#4a7090' }}>
              {rankings.reduce((s, r) => s + (r.rating_count || 0), 0)} valoraciones totales
            </span>
          </div>
        </div>

        {/* ── Winner reveal / Tie state ── */}
        <div>
          {(winner || isTied) && (
            <WinnerCard
              winner={winner}
              revealed={phase === 'revealed'}
              scanning={phase === 'scanning'}
              onReveal={handleReveal}
              isTied={isTied && !tiebreakerWinner}
              tiedCount={tiedAportes.length}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>

      {/* Tiebreaker — recibe el status ya cargado para evitar doble polling */}
      <KickoffTiebreakerPanel eventId={eventId} isAdmin={isAdmin} status={tiebreakerStatus} onRefresh={loadTiebreaker} />
    </section>
  );
}
