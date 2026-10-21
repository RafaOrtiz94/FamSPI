import React from 'react';
import { FiAlertCircle, FiShield } from 'react-icons/fi';
import TabBadge from '../../components/TabBadge';

const getEvents = (timeline) => {
  if (Array.isArray(timeline)) return timeline;
  if (Array.isArray(timeline?.events)) return timeline.events;
  if (Array.isArray(timeline?.rows)) return timeline.rows;
  return [];
};

const getEventTime = (event) => event.timestamp || event.created_at || event.occurred_at || event.updated_at || '';
const getEventActor = (event) => event.actor_name || event.actor_email || event.actor || event.created_by || 'Sistema';
const humanize = (value) => {
  const text = String(value || '').trim();
  if (!text) return 'Evento';
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};
const getEventAction = (event) => humanize(event.action || event.event_type || event.type || event.description || 'Evento');

const ExpedienteAuditTab = ({ timeline }) => {
  const events = getEvents(timeline).slice().sort((a, b) => new Date(getEventTime(b)).getTime() - new Date(getEventTime(a)).getTime());
  const blockers = events.filter((event) => {
    const action = String(getEventAction(event)).toLowerCase();
    return action.includes('block') || action.includes('bloque') || action.includes('rechaz');
  });

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">Auditoria</h2>
          <p className="text-xs text-warm-ash mt-0.5">Registro de control y trazabilidad del expediente</p>
        </div>
        <TabBadge status={events.length ? 'completado' : 'pendiente'} />
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <div className="flex items-center gap-2 mb-4">
            <FiShield className="text-action-blue" size={18} />
            <h3 className="text-sm font-semibold text-ink-slate">Eventos auditables</h3>
          </div>
          {!events.length ? (
            <div className="text-xs text-warm-ash">Sin eventos.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map((event, idx) => (
                <div key={event.id || `${idx}-${getEventTime(event)}`} className="py-2.5">
                  <p className="text-xs font-semibold text-ink-slate">{getEventAction(event)}</p>
                  <p className="text-[11px] text-warm-ash">Responsable: {humanize(getEventActor(event))} | {getEventTime(event) || 'Sin fecha'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <div className="flex items-center gap-2 mb-4">
            <FiAlertCircle className="text-caution-amber" size={18} />
            <h3 className="text-sm font-semibold text-ink-slate">Bloqueos y rechazos</h3>
          </div>
          {!blockers.length ? (
            <div className="text-xs text-warm-ash">Sin bloqueos activos.</div>
          ) : (
            <div className="space-y-2">
              {blockers.map((event, idx) => (
                <div key={event.id || idx} className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-medium text-red-800">{getEventAction(event)}</p>
                  <p className="text-[11px] text-red-700">{getEventTime(event) || 'Sin fecha'} | {humanize(getEventActor(event))}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpedienteAuditTab;
