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

/**
 * Countdown timer to a target ISO date string.
 * Shows "En curso" when target is in the past.
 */
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
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {label && <span className="text-slate-500">{label}</span>}
      {display ? (
        <span className="font-mono font-semibold text-blue-700 tabular-nums">{display}</span>
      ) : (
        <span className="font-medium text-green-600">En curso</span>
      )}
    </div>
  );
}

/**
 * Elapsed time since a start ISO date string.
 */
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
    <span className={`font-mono text-sm text-slate-500 tabular-nums ${className}`}>
      {elapsed}
    </span>
  );
}
