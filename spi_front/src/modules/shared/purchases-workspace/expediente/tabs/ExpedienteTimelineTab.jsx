import React from 'react';
import { FiGitCommit, FiArrowDown } from 'react-icons/fi';
import TabBadge from '../../components/TabBadge';

const getEvents = (timeline) => {
  if (Array.isArray(timeline)) return timeline;
  if (Array.isArray(timeline?.events)) return timeline.events;
  if (Array.isArray(timeline?.rows)) return timeline.rows;
  return [];
};

const EVENT_LABELS_ES = {
  request_created: 'Solicitud creada',
  state_transition: 'Cambio de etapa del proceso',
  site_inspection_recorded: 'Inspeccion tecnica registrada',
  delivery_dates_set: 'Fechas de entrega definidas',
  provider_response_saved: 'Respuesta del proveedor registrada',
  availability_requested: 'Disponibilidad solicitada al proveedor',
  availability_confirmed: 'Disponibilidad confirmada',
  offer_sent: 'Oferta enviada al cliente',
  offer_signed: 'Oferta firmada por el cliente',
  contract_uploaded: 'Contrato cargado',
  contract_signed: 'Contrato firmado',
  inspection_requested: 'Inspeccion solicitada',
  installation_started: 'Instalacion iniciada',
  dispatch_registered: 'Despacho registrado',
  delivery_confirmed: 'Entrega confirmada',
};

const humanize = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_ -]/g, '')
  .replace(/[-\s]+/g, '_');

const getEventTime = (event) => event.timestamp || event.created_at || event.occurred_at || event.updated_at || '';
const getRawAction = (event) => event.action || event.event_type || event.type || event.description || 'evento';

const toSpanishAction = (event) => {
  const raw = getRawAction(event);
  const normalized = humanize(raw);
  if (EVENT_LABELS_ES[normalized]) return EVENT_LABELS_ES[normalized];
  return String(raw)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const toTime = (value) => {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
};

const ExpedienteTimelineTab = ({ timeline }) => {
  const events = getEvents(timeline)
    .slice()
    .sort((a, b) => new Date(getEventTime(a)).getTime() - new Date(getEventTime(b)).getTime());

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">Timeline</h2>
          <p className="text-xs text-warm-ash mt-0.5">Diagrama de flujo del proceso</p>
        </div>
        <TabBadge status={events.length ? 'completado' : 'pendiente'} />
      </div>

      <div className="p-6">
        {!events.length ? (
          <div className="bg-white rounded-xl border border-soft-border p-6 text-xs text-warm-ash text-center">
            Aun no hay eventos para graficar el flujo.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-soft-border shadow-ambient p-5">
            <h3 className="text-sm font-semibold text-ink-slate mb-4">Flujo cronologico</h3>
            <div className="space-y-2">
              {events.map((event, index) => (
                <div key={event.id || `${index}-${getEventTime(event)}`} className="flex flex-col items-center">
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FiGitCommit size={13} className="text-action-blue" />
                      <p className="text-sm font-semibold text-ink-slate">{toSpanishAction(event)}</p>
                    </div>
                    <p className="text-[11px] text-warm-ash mt-1">{toTime(getEventTime(event))}</p>
                  </div>
                  {index < events.length - 1 && (
                    <div className="h-7 flex items-center text-slate-400">
                      <FiArrowDown size={14} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpedienteTimelineTab;

