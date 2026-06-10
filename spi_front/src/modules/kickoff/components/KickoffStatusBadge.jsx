import React from 'react';

const C = { cyan: '#00a8d4', gold: '#c49a10', muted: '#6b8aaa' };

const EVENT_MAP = {
  draft:     { label: 'Borrador',   bg: '#f4f8fc', color: C.muted,    border: '#dce8f5' },
  scheduled: { label: 'Programado', bg: '#e8f7fc', color: C.cyan,     border: '#b8e6f5' },
  active:    { label: 'En curso',   bg: '#e8f7fc', color: C.cyan,     border: '#b8e6f5', pulse: true },
  paused:    { label: 'Pausado',    bg: '#fdf8e8', color: C.gold,     border: '#f0e090' },
  finished:  { label: 'Finalizado', bg: '#f0fdf4', color: '#16a34a',  border: '#bbf7d0' },
  cancelled: { label: 'Cancelado',  bg: '#fef2f2', color: '#dc2626',  border: '#fecaca' },
};

const PRES_MAP = {
  pending:          { label: 'En espera',  bg: '#f4f8fc', color: C.muted,   border: '#dce8f5' },
  ready:            { label: 'Preparada',  bg: '#e8f7fc', color: C.cyan,    border: '#b8e6f5' },
  active:           { label: 'En vivo',    bg: '#e8f7fc', color: C.cyan,    border: '#b8e6f5', pulse: true },
  questions_open:   { label: 'En vivo',    bg: '#e8f7fc', color: C.cyan,    border: '#b8e6f5', pulse: true },
  questions_closed: { label: 'En vivo',    bg: '#e8f7fc', color: C.cyan,    border: '#b8e6f5', pulse: true },
  finished:         { label: 'Completada', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  skipped:          { label: 'Omitida',    bg: '#f4f8fc', color: C.muted,   border: '#dce8f5' },
};

const Q_MAP = {
  received:     { label: 'Recibida',    bg: '#e8f7fc', color: C.cyan,    border: '#b8e6f5' },
  under_review: { label: 'En revisión', bg: '#fdf8e8', color: C.gold,    border: '#f0e090' },
  approved:     { label: 'Aprobada',    bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  highlighted:  { label: 'Destacada',   bg: '#fdf8e8', color: C.gold,    border: '#f0e090' },
  answered:     { label: 'Respondida',  bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  hidden:       { label: 'Oculta',      bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  rejected:     { label: 'Rechazada',   bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

export default function KickoffStatusBadge({ status, type = 'presentation', className = '' }) {
  const map = type === 'event' ? EVENT_MAP : type === 'question' ? Q_MAP : PRES_MAP;
  const cfg = map[status] || { label: status, bg: '#f4f8fc', color: C.muted, border: '#dce8f5' };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide border ${className}`}
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
    >
      {type !== 'question' && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.pulse ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: cfg.color }}
        />
      )}
      {cfg.label}
    </span>
  );
}
