import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiClock, FiRefreshCw, FiChevronDown, FiChevronUp, FiAlertCircle } from 'react-icons/fi';
import { listEquipmentPurchases } from '../../../../../core/api/equipmentPurchasesApi';
import PublicPurchaseTimelinePanel from '../../../../comercial/components/PublicPurchaseTimelinePanel';

const EASE_OUT = [0.23, 1, 0.32, 1];

const ACTIVE_STATUSES = new Set([
  'pending_proforma', 'proforma_received', 'reservation_made',
  'signed_proforma_uploaded', 'pending_inspection', 'inspection_scheduled',
  'portal_outcome_registered', 'waiting_dispatch', 'dispatch_ready', 'completed',
]);

const STATUS_LABEL = {
  pending_proforma:           'Proforma pendiente',
  proforma_received:          'Proforma recibida',
  reservation_made:           'Reserva realizada',
  signed_proforma_uploaded:   'Proforma firmada',
  pending_inspection:         'Inspección pendiente',
  inspection_scheduled:       'Inspección coordinada',
  portal_outcome_registered:  'Resultado SOCE registrado',
  waiting_dispatch:           'Esperando despacho',
  dispatch_ready:             'Despacho listo',
  completed:                  'Completado',
};

const STATUS_DOT = {
  completed:     'bg-operative-green',
  dispatch_ready:'bg-rose-400',
  waiting_dispatch:'bg-orange-400',
  portal_outcome_registered:'bg-teal-500',
  inspection_scheduled:'bg-amber-500',
  pending_inspection:'bg-caution-amber',
  signed_proforma_uploaded:'bg-violet-600',
  reservation_made:'bg-violet-500',
  proforma_received:'bg-indigo-500',
  pending_proforma:'bg-sky-400',
};

const PurchaseRow = ({ req }) => {
  const [open, setOpen] = useState(false);
  const dot = STATUS_DOT[req.status] || 'bg-slate-300';
  const label = STATUS_LABEL[req.status] || req.status;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-ambient overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-slate truncate">
            {req.client_name || req.client || '—'}
          </p>
          <p className="text-[11px] text-warm-ash truncate mt-0.5">
            {req.equipment_description || req.equipment_name || req.notes || '—'}
          </p>
        </div>
        <span className="text-[10px] font-medium text-warm-ash shrink-0 hidden sm:block">
          {label}
        </span>
        <span className="ml-2 shrink-0 text-slate-400" aria-hidden="true">
          {open ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-4 pb-4">
              <PublicPurchaseTimelinePanel purchaseId={req.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const TimelineSection = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await listEquipmentPurchases();
      const list = Array.isArray(data) ? data : (data?.purchases ?? data?.data ?? []);
      setPurchases(list.filter((r) => ACTIVE_STATUSES.has(r.status)));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FiClock size={16} className="text-action-blue" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-ink-slate tracking-tight">Auditoría de expedientes</h2>
            <p className="text-[11px] text-warm-ash mt-0.5">Línea de tiempo consolidada de todos los procesos activos</p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchAll}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
          aria-label="Recargar expedientes"
        >
          <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>

      {loading && (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white h-14 shadow-ambient" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-ambient">
          <FiAlertCircle size={14} className="text-alert-red shrink-0" aria-hidden="true" />
          <span className="text-xs text-slate-600">No se pudieron cargar los expedientes.</span>
          <button
            type="button"
            onClick={fetchAll}
            className="text-xs text-action-blue hover:underline cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && purchases.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FiClock size={32} className="text-slate-300 mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-ink-slate">Sin expedientes activos</p>
          <p className="text-xs text-warm-ash mt-1">Aquí aparecerán los procesos de compra con actividad reciente</p>
        </div>
      )}

      {!loading && !error && purchases.length > 0 && (
        <div className="space-y-2">
          {purchases.map((req) => (
            <PurchaseRow key={req.id} req={req} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TimelineSection;
