import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAlertTriangle,
  FiCalendar,
  FiClock,
  FiExternalLink,
  FiFileText,
  FiLoader,
  FiPackage,
  FiRefreshCw,
  FiUser,
} from 'react-icons/fi';
import Modal from '../../../../../core/ui/components/Modal';

const formatDateTime = (value) => {
  if (!value) return 'No registrada';
  return new Date(value).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCountdown = (targetDate, nowMs) => {
  if (!targetDate) return 'Sin fecha de caducidad';
  const diffMs = new Date(targetDate).getTime() - nowMs;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 'Reserva vencida';

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m`;
};

const getEquipmentLabel = (equipment) => {
  if (!Array.isArray(equipment) || equipment.length === 0) return 'Equipo no especificado';
  return equipment
    .map((item) => (
      item?.model ||
      item?.name ||
      item?.equipment_name ||
      item?.label ||
      item?.descripcion ||
      'Equipo'
    ))
    .filter(Boolean)
    .join(', ');
};

const getPurchaseTypeLabel = (purchaseType) => {
  if (purchaseType === 'public') return 'Pública';
  if (purchaseType === 'private') return 'Privada';
  return 'Expediente';
};

const ReservationsOverviewModal = ({
  open,
  onClose,
  fetchReservations,
  title = 'Reservas activas de equipos',
  currentPurchaseId = null,
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReservations();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'No se pudieron cargar las reservas activas.');
    } finally {
      setLoading(false);
    }
  }, [fetchReservations]);

  useEffect(() => {
    if (!open) return undefined;
    loadReservations();
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [open, loadReservations]);

  const sortedItems = useMemo(() => (
    [...items].sort((a, b) => {
      const aTime = a?.reservation_expires_at ? new Date(a.reservation_expires_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b?.reservation_expires_at ? new Date(b.reservation_expires_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
  ), [items]);

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-6xl">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Consulta transversal de reservas</p>
            <p className="text-xs text-slate-600">
              ACP Comercial puede revisar todas las reservas vigentes sin abrir expediente por expediente.
            </p>
          </div>
          <button
            type="button"
            onClick={loadReservations}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <FiLoader className="animate-spin" size={14} /> : <FiRefreshCw size={14} />}
            Actualizar
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && sortedItems.length === 0 ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <FiLoader className="animate-spin" size={16} />
              Cargando reservas activas...
            </div>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-800">No hay reservas activas registradas.</p>
            <p className="mt-1 text-xs text-slate-500">
              Cuando ACP envíe una nueva reserva, aparecerá aquí con su caducidad.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {sortedItems.map((item) => {
              const countdown = formatCountdown(item?.reservation_expires_at, nowMs);
              const isExpired = countdown === 'Reserva vencida';
              const isCurrentPurchase = currentPurchaseId && String(item?.id) === String(currentPurchaseId);

              return (
                <div
                  key={`${item?.purchase_type || 'purchase'}-${item?.id}`}
                  className={`rounded-3xl border p-5 shadow-sm transition ${
                    isExpired
                      ? 'border-red-200 bg-red-50'
                      : isCurrentPurchase
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                          {getPurchaseTypeLabel(item?.purchase_type)}
                        </span>
                        {isCurrentPurchase && (
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold text-blue-700">
                            Expediente actual
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-slate-900">{item?.client_name || 'Cliente'}</h3>
                    </div>

                    <div
                      className={`rounded-2xl px-3 py-2 text-right ${
                        isExpired ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Contador</p>
                      <p className="mt-1 text-sm font-semibold">{countdown}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        <FiUser size={12} />
                        Cliente
                      </p>
                      <p className="text-sm font-medium text-slate-800">{item?.client_name || 'Cliente no registrado'}</p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        <FiFileText size={12} />
                        Proceso
                      </p>
                      <p className="text-sm font-medium text-slate-800">{item?.process_number || 'No aplica'}</p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-3 md:col-span-2">
                      <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        <FiPackage size={12} />
                        Equipo reservado
                      </p>
                      <p className="text-sm font-medium text-slate-800">{getEquipmentLabel(item?.equipment)}</p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        <FiCalendar size={12} />
                        Fecha de reserva
                      </p>
                      <p className="text-sm font-medium text-slate-800">{formatDateTime(item?.reservation_email_sent_at)}</p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        <FiClock size={12} />
                        Caduca
                      </p>
                      <p className={`text-sm font-medium ${isExpired ? 'text-red-700' : 'text-slate-800'}`}>
                        {formatDateTime(item?.reservation_expires_at)}
                      </p>
                    </div>
                  </div>

                  {item?.reservation_calendar_event_link && (
                    <a
                      href={item.reservation_calendar_event_link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
                    >
                      <FiExternalLink size={13} />
                      Ver recordatorio en calendario
                    </a>
                  )}

                  {isExpired && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700">
                      <FiAlertTriangle size={13} />
                      Esta reserva ya venció y requiere seguimiento.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ReservationsOverviewModal;
