import React, { useCallback, useEffect, useState } from 'react';
import { FiClock, FiChevronDown, FiChevronUp, FiRefreshCw, FiExternalLink, FiAlertCircle } from 'react-icons/fi';
import { getEquipmentPurchaseTimeline } from '../../../core/api/equipmentPurchasesApi';

/* ---- Event config — dot color follows DESIGN.md semantic palette ---- */
const EVENT_CONFIG = {
  REQUEST_CREATED:               { label: 'Solicitud creada',                     dot: 'bg-slate-400'          },
  AVAILABILITY_REQUESTED:        { label: 'Disponibilidad solicitada',             dot: 'bg-sky-400'            },
  PROVIDER_RESPONSE:             { label: 'Respuesta del proveedor',              dot: 'bg-sky-500'            },
  PROFORMA_REQUESTED:            { label: 'Proforma solicitada',                  dot: 'bg-indigo-400'         },
  PROFORMA_RECEIVED:             { label: 'Proforma recibida',                    dot: 'bg-indigo-500'         },
  RESERVATION_MADE:              { label: 'Equipos reservados',                   dot: 'bg-violet-500'         },
  SIGNED_PROFORMA_UPLOADED:      { label: 'Proforma firmada cargada',             dot: 'bg-violet-600'         },
  PORTAL_OUTCOME_REGISTERED:     { label: 'Resultado portal SOCE',                dot: 'bg-teal-500'           },
  INSPECTION_REQUESTED:          { label: 'Inspección solicitada (F.ST-20)',      dot: 'bg-caution-amber'      },
  INSPECTION_SCHEDULED:          { label: 'Inspección coordinada',                dot: 'bg-amber-600'          },
  CONTRACT_UPLOADED:             { label: 'Contrato subido',                      dot: 'bg-operative-green'    },
  SERCOP_OFERTA_SUBMITTED:       { label: 'Oferta técnica enviada al SOCE',       dot: 'bg-teal-600'           },
  SERCOP_PUJA:                   { label: 'Sesión de puja SOCE',                  dot: 'bg-teal-700'           },
  SERCOP_ADJUDICACION:           { label: 'Resolución de adjudicación',           dot: 'bg-operative-green'    },
  DELIVERY_DATES_REQUESTED:      { label: 'Fechas de entrega solicitadas',        dot: 'bg-orange-400'         },
  DELIVERY_DATES_SUBMITTED:      { label: 'Fechas de entrega confirmadas',        dot: 'bg-orange-500'         },
  EQUIPMENT_ARRIVED:             { label: 'Equipo llegó a bodega',                dot: 'bg-orange-600'         },
  DISPATCH_READY:                { label: 'Despacho listo',                       dot: 'bg-rose-400'           },
  DELIVERY_COMPLETED:            { label: 'Entrega completada',                   dot: 'bg-rose-500'           },
  INSTALLATION_DISPATCH_REQUEST: { label: 'Solicitud formal de despacho',         dot: 'bg-slate-500'          },
  LOGISTICS_VALIDATED:           { label: 'Validación logística completada',      dot: 'bg-slate-600'          },
  FST14_COMPLETED:               { label: 'Recepción visual F.ST-14',             dot: 'bg-action-blue'        },
  VERIFICATION_DECIDED:          { label: 'Decisión de verificación F.ST-09',     dot: 'bg-indigo-700'         },
  SERCOP_ACTA_PROVISIONAL:       { label: 'Acta recepción provisional (SERCOP)',  dot: 'bg-operative-green'    },
  SERCOP_ACTA_DEFINITIVA:        { label: 'Acta recepción definitiva (SERCOP)',   dot: 'bg-green-800'          },
};

const formatTs = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PublicPurchaseTimelinePanel = ({ purchaseId }) => {
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [timeline, setTimeline]   = useState(null);
  const [fetchError, setFetchError] = useState(false);

  const load = useCallback(async () => {
    if (!purchaseId) return;
    setLoading(true);
    setFetchError(false);
    try {
      const result = await getEquipmentPurchaseTimeline(purchaseId);
      setTimeline(result);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    if (open && !timeline) load();
  }, [open, timeline, load]);

  const events = timeline?.events || [];

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-ambient overflow-hidden">
      {/* Header row — toggle + refresh (siblings, not nested) */}
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="timeline-panel-content"
          className="flex-1 flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <FiClock size={14} className="text-warm-ash shrink-0" aria-hidden="true" />
            <span className="text-sm font-semibold text-ink-slate">Línea de tiempo</span>
            {events.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-warm-ash font-medium">
                {events.length} eventos
              </span>
            )}
          </div>
          {open
            ? <FiChevronUp  size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
            : <FiChevronDown size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
          }
        </button>
        {open && (
          <button
            type="button"
            onClick={load}
            className="px-3 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors duration-150 border-l border-slate-100 cursor-pointer"
            aria-label="Recargar línea de tiempo"
          >
            <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <div id="timeline-panel-content" className="border-t border-slate-100 px-4 py-4">
          {/* Skeleton */}
          {loading && !events.length && (
            <div className="space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-1.5 pb-3">
                    <div className="h-3 w-2/3 bg-slate-200 rounded" />
                    <div className="h-2.5 w-1/3 bg-slate-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && fetchError && (
            <div className="flex items-center gap-2 py-2">
              <FiAlertCircle size={14} className="text-alert-red shrink-0" aria-hidden="true" />
              <span className="text-xs text-slate-600">No se pudo cargar la línea de tiempo.</span>
              <button
                type="button"
                onClick={load}
                className="text-xs text-action-blue hover:underline cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !fetchError && events.length === 0 && (
            <p className="text-xs text-warm-ash py-1">Sin eventos registrados aún.</p>
          )}

          {/* Event feed */}
          {events.length > 0 && (
            <ol className="space-y-0">
              {events.map((ev, idx) => {
                const cfg    = EVENT_CONFIG[ev.type] || { label: ev.label || ev.type, dot: 'bg-slate-300' };
                const isLast = idx === events.length - 1;
                return (
                  <li key={`${ev.type}-${ev.timestamp}-${idx}`} className="flex gap-3">
                    {/* Dot spine */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                      {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
                    </div>

                    {/* Content */}
                    <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                      <p className="text-[11px] font-semibold text-ink-slate leading-snug">
                        {ev.label || cfg.label}
                      </p>
                      <p className="text-[10px] text-warm-ash mt-0.5 font-mono">{formatTs(ev.timestamp)}</p>
                      {ev.actor_email && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{ev.actor_email}</p>
                      )}
                      {ev.outcome && (
                        <span className={`mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                          ev.outcome === 'won'
                            ? 'bg-green-50 text-operative-green'
                            : 'bg-red-50 text-alert-red'
                        }`}>
                          {ev.outcome === 'won' ? 'Ganado' : 'No ganado'}
                        </span>
                      )}
                      {ev.resolution_number && (
                        <p className="text-[10px] text-warm-ash font-mono">Res. {ev.resolution_number}</p>
                      )}
                      {ev.report_link && (
                        <a
                          href={ev.report_link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-action-blue hover:underline cursor-pointer"
                        >
                          Ver F.ST-14 <FiExternalLink size={9} aria-hidden="true" />
                        </a>
                      )}
                      {typeof ev.applies === 'boolean' && (
                        <p className="text-[10px] text-warm-ash">
                          Verificación: {ev.applies ? 'Aplica' : 'Exenta'}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};

export default PublicPurchaseTimelinePanel;
