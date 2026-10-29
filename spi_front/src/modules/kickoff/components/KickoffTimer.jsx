import React, { useState, useEffect } from 'react';

function pad(n) { return String(n).padStart(2, '0'); }

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function KickoffTimer({ targetDate, label, className = '' }) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate) - Date.now();
      setDisplay(diff > 0 ? formatCountdown(diff) : null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!targetDate) return null;

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      {label && (
        <span className="font-bold tracking-widest font-mono" style={{ color: '#6b8aaa' }}>{label}</span>
      )}
      {display ? (
        <span className="font-mono font-black tabular-nums" style={{ color: '#00a8d4' }}>{display}</span>
      ) : (
        <span className="font-bold font-mono" style={{ color: '#16a34a' }}>EN CURSO</span>
      )}
    </div>
  );
}

// Badge flotante (position:fixed) visible incluso en pantalla completa.
// Muestra el tiempo restante antes de que la presentación se inicie automáticamente.
export function KickoffAutoStartCountdown({ presentation }) {
  const [remaining, setRemaining] = React.useState(null);

  React.useEffect(() => {
    if (!presentation?.scheduled_start) return;
    if (!['pending', 'ready'].includes(presentation?.status)) return;

    const deadline = new Date(presentation.scheduled_start).getTime() + 5 * 60 * 1000;

    const tick = () => {
      const now  = Date.now();
      const diff = deadline - now;
      // Solo mostrar si ya pasó la hora de inicio (now >= scheduled_start)
      const started = now >= new Date(presentation.scheduled_start).getTime();
      setRemaining(started ? Math.max(0, diff) : null);
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [presentation?.scheduled_start, presentation?.status]);

  if (remaining === null) return null;
  if (!['pending', 'ready'].includes(presentation?.status)) return null;

  const mins    = Math.floor(remaining / 60000);
  const secs    = Math.floor((remaining % 60000) / 1000);
  const isOver  = remaining === 0;
  const urgent  = remaining < 60000 && !isOver;
  const color   = isOver ? '#16a34a' : urgent ? '#ef4444' : '#00a8d4';
  const bg      = isOver ? '#052e10' : urgent ? '#1f0a0a' : '#060d18';
  const border  = isOver ? '#166534' : urgent ? '#7f1d1d' : '#0d1f35';

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 12,
        background: bg,
        border: `1.5px solid ${border}`,
        boxShadow: `0 0 16px ${color}30`,
        animation: urgent ? 'kf-flicker 0.9s steps(1) infinite' : 'none',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: !isOver ? 'kf-flicker 1s steps(1) infinite' : 'none',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '0.12em',
          fontFamily: "'Share Tech Mono', monospace",
          color: '#2a4060',
          textTransform: 'uppercase',
        }}
      >
        {isOver ? 'Iniciando...' : 'Auto-inicio en'}
      </span>
      {!isOver && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 900,
            fontFamily: "'Share Tech Mono', monospace",
            color,
            letterSpacing: '0.05em',
            tabularNums: true,
          }}
        >
          {pad(mins)}:{pad(secs)}
        </span>
      )}
    </div>
  );
}

export function KickoffElapsedTimer({ startDate, className = '' }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startDate) return;
    const tick = () => {
      const diff = Date.now() - new Date(startDate);
      setElapsed(formatCountdown(Math.abs(diff)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startDate]);

  return (
    <span className={`font-mono font-bold tabular-nums text-xs ${className}`} style={{ color: '#00a8d4' }}>
      {elapsed}
    </span>
  );
}
