import React from 'react';

const EVENT_MAP = {
  draft:     { label: 'Borrador',   cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  scheduled: { label: 'Programado', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  active:    { label: 'En curso',   cls: 'bg-green-100 text-green-700 border-green-200 animate-pulse' },
  paused:    { label: 'Pausado',    cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  finished:  { label: 'Finalizado', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Cancelado',  cls: 'bg-red-100 text-red-600 border-red-200' },
};

const PRES_MAP = {
  pending:          { label: 'Pendiente',        cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  ready:            { label: 'Listo',             cls: 'bg-blue-100 text-blue-600 border-blue-200' },
  active:           { label: 'En presentación',  cls: 'bg-green-100 text-green-700 border-green-200 animate-pulse' },
  questions_open:   { label: 'Preguntas abiertas', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  questions_closed: { label: 'Preguntas cerradas', cls: 'bg-orange-100 text-orange-600 border-orange-200' },
  finished:         { label: 'Finalizada',       cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  skipped:          { label: 'Omitida',           cls: 'bg-yellow-100 text-yellow-600 border-yellow-200' },
};

const Q_MAP = {
  received:     { label: 'Recibida',   cls: 'bg-blue-50 text-blue-600' },
  under_review: { label: 'En revisión', cls: 'bg-yellow-50 text-yellow-600' },
  approved:     { label: 'Aprobada',   cls: 'bg-green-50 text-green-600' },
  highlighted:  { label: 'Destacada',  cls: 'bg-purple-50 text-purple-700' },
  answered:     { label: 'Respondida', cls: 'bg-slate-50 text-slate-600' },
  hidden:       { label: 'Oculta',     cls: 'bg-red-50 text-red-500' },
  rejected:     { label: 'Rechazada',  cls: 'bg-red-100 text-red-600' },
};

export default function KickoffStatusBadge({ status, type = 'presentation', className = '' }) {
  const map = type === 'event' ? EVENT_MAP : type === 'question' ? Q_MAP : PRES_MAP;
  const cfg = map[status] || { label: status, cls: 'bg-gray-100 text-gray-500 border-gray-200' };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.cls} ${className}`}
    >
      {type !== 'question' && (
        <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-green-500' : 'bg-current opacity-60'}`} />
      )}
      {cfg.label}
    </span>
  );
}
