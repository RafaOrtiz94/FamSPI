import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiGlobe, FiChevronDown, FiChevronUp, FiSave, FiExternalLink, FiLock, FiCheckCircle, FiClock, FiRefreshCw } from 'react-icons/fi';
import { listEquipmentPurchases, updateSercop } from '../../../../../core/api/equipmentPurchasesApi';
import { useUI } from '../../../../../core/ui/useUI';
import { useAuth } from '../../../../../core/auth/AuthContext';

const EASE_OUT = [0.23, 1, 0.32, 1];

const INPUT_CLS = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink-slate placeholder-warm-ash focus:outline-none focus:ring-2 focus:ring-sky-signal/40 focus:border-action-blue transition-colors duration-150';
const LABEL_CLS = 'block text-xs font-medium text-ink-slate';

const PROCEDURE_TYPES = [
  { value: 'catalogo_electronico',        label: 'Catálogo Electrónico' },
  { value: 'infima_cuantia',             label: 'Ínfima Cuantía' },
  { value: 'subasta_inversa_electronica', label: 'Subasta Inversa Electrónica' },
  { value: 'menor_cuantia',              label: 'Menor Cuantía' },
  { value: 'cotizacion',                 label: 'Cotización' },
  { value: 'licitacion',                 label: 'Licitación' },
  { value: 'regimen_especial',           label: 'Régimen Especial' },
];

const Section = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-ambient overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
      >
        <span className="text-sm font-semibold text-ink-slate">{title}</span>
        {open
          ? <FiChevronUp size={14} className="text-slate-400" aria-hidden="true" />
          : <FiChevronDown size={14} className="text-slate-400" aria-hidden="true" />
        }
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
            <div className="border-t border-slate-100 p-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Field = ({ label, value, mono }) => (
  <div>
    <dt className="text-[10px] font-medium text-warm-ash uppercase tracking-wide">{label}</dt>
    <dd className={`text-sm text-ink-slate mt-0.5 ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</dd>
  </div>
);

const StatusPill = ({ done, label }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
    done ? 'bg-green-50 text-operative-green' : 'bg-slate-100 text-warm-ash'
  }`}>
    {done ? <FiCheckCircle size={9} aria-hidden="true" /> : <FiClock size={9} aria-hidden="true" />}
    {label}
  </span>
);

const normalizeRoleList = (v) => {
  if (Array.isArray(v)) return v.map((r) => String(r || '').toLowerCase()).filter(Boolean);
  if (!v) return [];
  return String(v).split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);
};

const PUBLIC_STATUSES = new Set([
  'pending_proforma','proforma_received','pending_inspection','inspection_scheduled',
  'portal_outcome_registered','waiting_dispatch','dispatch_ready','completed',
]);

export const SoceTrackSection = () => {
  const { showToast } = useUI();
  const { user }      = useAuth();
  const roles         = [...normalizeRoleList(user?.role), ...normalizeRoleList(user?.scope)];
  const isACP         = roles.some((r) => r.includes('acp_comercial'));

  const [allRequests, setAllRequests]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedId, setSelectedId]       = useState(null);
  const [editingId, setEditingId]         = useState(null);
  const [draft, setDraft]                 = useState({});
  const [saving, setSaving]               = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listEquipmentPurchases();
      setAllRequests(Array.isArray(data) ? data : (data?.purchases ?? data?.data ?? []));
    } catch {
      showToast('No se pudieron cargar las solicitudes SERCOP', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const publicRequests = allRequests.filter((r) => PUBLIC_STATUSES.has(r.status));

  const openEdit = (req) => {
    setEditingId(req.id);
    setDraft({
      procedure_type:                    req.procedure_type || '',
      soce_process_code:                 req.soce_process_code || '',
      entidad_contratante_name:          req.entidad_contratante_name || '',
      entidad_contratante_ruc:           req.entidad_contratante_ruc || '',
      presupuesto_referencial:           req.presupuesto_referencial || '',
      oferta_tecnica_submitted_at:       req.oferta_tecnica_submitted_at?.slice(0,10) || '',
      puja_date:                         req.puja_date || '',
      puja_final_price:                  req.puja_final_price || '',
      adjudicacion_resolution_number:    req.adjudicacion_resolution_number || '',
      adjudicacion_resolution_date:      req.adjudicacion_resolution_date || '',
      adjudicacion_resolution_file_id:   req.adjudicacion_resolution_file_id || '',
      orden_compra_number:               req.orden_compra_number || '',
      garantia_fiel_cumplimiento_submitted: req.garantia_fiel_cumplimiento_submitted ?? false,
      acta_recepcion_provisional_date:   req.acta_recepcion_provisional_date || '',
      acta_recepcion_definitiva_date:    req.acta_recepcion_definitiva_date || '',
      pac_code:                          req.pac_code || '',
    });
  };

  const handleSave = async (req) => {
    setSaving(true);
    try {
      const payload = { ...draft };
      if (payload.presupuesto_referencial) payload.presupuesto_referencial = Number(payload.presupuesto_referencial);
      if (payload.puja_final_price)        payload.puja_final_price        = Number(payload.puja_final_price);
      Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
      await updateSercop(req.id, payload);
      showToast('Datos SERCOP actualizados', 'success');
      setEditingId(null);
      fetchAll();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FiGlobe size={16} className="text-action-blue" aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink-slate tracking-tight">Seguimiento SOCE / SERCOP</h2>
        </div>
        <button
          type="button"
          onClick={fetchAll}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
          aria-label="Recargar datos SERCOP"
        >
          <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>
      <p className="text-xs text-warm-ash">
        Registro oficial del proceso de contratación pública en el portal SOCE. Cada campo corresponde a datos legales del expediente.
      </p>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 h-16 shadow-ambient" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && publicRequests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FiGlobe size={32} className="text-slate-300 mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-ink-slate">Sin solicitudes públicas activas</p>
          <p className="text-xs text-warm-ash mt-1">Las solicitudes en proceso aparecerán aquí</p>
        </div>
      )}

      {!loading && publicRequests.length > 0 && (
      <div className="space-y-3">
        {publicRequests.map((req) => {
          const isEditing   = editingId === req.id;
          const isExpanded  = selectedId === req.id || isEditing;
          const hasAdj      = Boolean(req.adjudicacion_resolution_number);
          const hasOrden    = Boolean(req.orden_compra_number);
          const hasActaProv = Boolean(req.acta_recepcion_provisional_date);
          const hasActaDef  = Boolean(req.acta_recepcion_definitiva_date);

          return (
            <div key={req.id} className="rounded-2xl border border-slate-200 bg-white shadow-ambient overflow-hidden">
              {/* Request header */}
              <button
                type="button"
                onClick={() => setSelectedId((p) => (p === req.id ? null : req.id))}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-slate truncate">
                      {req.client_name || 'Solicitud sin cliente'}
                    </p>
                    <p className="text-[10px] text-warm-ash mt-0.5 font-mono">
                      {req.soce_process_code || 'Sin código SOCE'}
                      {req.procedure_type && (
                        <span className="ml-2 text-warm-ash">
                          {PROCEDURE_TYPES.find((p) => p.value === req.procedure_type)?.label || req.procedure_type}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill done={hasAdj}  label="Adjudicado"  />
                  <StatusPill done={hasOrden} label="Orden compra" />
                  {isExpanded
                    ? <FiChevronUp  size={14} className="text-slate-400" aria-hidden="true" />
                    : <FiChevronDown size={14} className="text-slate-400" aria-hidden="true" />
                  }
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-slate-100 p-4 space-y-5">
                      {isEditing ? (
                        /* ---- Edit mode ---- */
                        <div className="space-y-5">
                          {/* Proceso */}
                          <Section title="Proceso SERCOP" defaultOpen>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label className={LABEL_CLS}>
                                Tipo de procedimiento
                                <select value={draft.procedure_type} onChange={(e) => setDraft((p) => ({ ...p, procedure_type: e.target.value }))} className={INPUT_CLS}>
                                  <option value="">Seleccionar...</option>
                                  {PROCEDURE_TYPES.map((pt) => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                                </select>
                              </label>
                              <label className={LABEL_CLS}>
                                Código SOCE
                                <input type="text" value={draft.soce_process_code} onChange={(e) => setDraft((p) => ({ ...p, soce_process_code: e.target.value }))} className={INPUT_CLS} placeholder="SIE-HCAM-2025-0042" />
                              </label>
                              <label className={LABEL_CLS}>
                                Código PAC
                                <input type="text" value={draft.pac_code} onChange={(e) => setDraft((p) => ({ ...p, pac_code: e.target.value }))} className={INPUT_CLS} />
                              </label>
                              <label className={LABEL_CLS}>
                                Presupuesto referencial (USD)
                                <input type="number" step="0.01" value={draft.presupuesto_referencial} onChange={(e) => setDraft((p) => ({ ...p, presupuesto_referencial: e.target.value }))} className={INPUT_CLS} />
                              </label>
                            </div>
                          </Section>

                          {/* Entidad */}
                          <Section title="Entidad contratante">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label className={`${LABEL_CLS} sm:col-span-2`}>
                                Nombre de la entidad
                                <input type="text" value={draft.entidad_contratante_name} onChange={(e) => setDraft((p) => ({ ...p, entidad_contratante_name: e.target.value }))} className={INPUT_CLS} />
                              </label>
                              <label className={LABEL_CLS}>
                                RUC
                                <input type="text" maxLength={13} value={draft.entidad_contratante_ruc} onChange={(e) => setDraft((p) => ({ ...p, entidad_contratante_ruc: e.target.value }))} className={INPUT_CLS} placeholder="13 dígitos" />
                              </label>
                            </div>
                          </Section>

                          {/* Oferta / Puja */}
                          <Section title="Oferta y puja">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label className={LABEL_CLS}>
                                Fecha oferta técnica enviada
                                <input type="date" value={draft.oferta_tecnica_submitted_at} onChange={(e) => setDraft((p) => ({ ...p, oferta_tecnica_submitted_at: e.target.value }))} className={INPUT_CLS} />
                              </label>
                              <label className={LABEL_CLS}>
                                Fecha de puja
                                <input type="date" value={draft.puja_date} onChange={(e) => setDraft((p) => ({ ...p, puja_date: e.target.value }))} className={INPUT_CLS} />
                              </label>
                              <label className={LABEL_CLS}>
                                Precio final de puja (USD)
                                <input type="number" step="0.01" value={draft.puja_final_price} onChange={(e) => setDraft((p) => ({ ...p, puja_final_price: e.target.value }))} className={INPUT_CLS} />
                              </label>
                            </div>
                          </Section>

                          {/* Adjudicación */}
                          <Section title="Adjudicación">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label className={LABEL_CLS}>
                                Número de resolución
                                <input type="text" value={draft.adjudicacion_resolution_number} onChange={(e) => setDraft((p) => ({ ...p, adjudicacion_resolution_number: e.target.value }))} className={INPUT_CLS} />
                              </label>
                              <label className={LABEL_CLS}>
                                Fecha de resolución
                                <input type="date" value={draft.adjudicacion_resolution_date} onChange={(e) => setDraft((p) => ({ ...p, adjudicacion_resolution_date: e.target.value }))} className={INPUT_CLS} />
                              </label>
                              <label className={LABEL_CLS}>
                                ID archivo resolución (Drive)
                                <input type="text" value={draft.adjudicacion_resolution_file_id} onChange={(e) => setDraft((p) => ({ ...p, adjudicacion_resolution_file_id: e.target.value }))} className={INPUT_CLS} placeholder="ID de Google Drive" />
                              </label>
                              <label className={LABEL_CLS}>
                                Número orden de compra / contrato
                                <input type="text" value={draft.orden_compra_number} onChange={(e) => setDraft((p) => ({ ...p, orden_compra_number: e.target.value }))} className={INPUT_CLS} />
                              </label>
                            </div>
                          </Section>

                          {/* Garantía y Actas */}
                          <Section title="Garantía y actas de recepción">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label className="flex items-center gap-2 text-sm text-ink-slate cursor-pointer sm:col-span-2">
                                <input
                                  type="checkbox"
                                  checked={draft.garantia_fiel_cumplimiento_submitted}
                                  onChange={(e) => setDraft((p) => ({ ...p, garantia_fiel_cumplimiento_submitted: e.target.checked }))}
                                  className="rounded border-slate-300 text-action-blue focus:ring-action-blue"
                                />
                                Garantía de Fiel Cumplimiento entregada (5% del valor adjudicado)
                              </label>
                              <label className={LABEL_CLS}>
                                Acta recepción provisional
                                <input type="date" value={draft.acta_recepcion_provisional_date} onChange={(e) => setDraft((p) => ({ ...p, acta_recepcion_provisional_date: e.target.value }))} className={INPUT_CLS} />
                              </label>
                              <label className={LABEL_CLS}>
                                Acta recepción definitiva
                                <input type="date" value={draft.acta_recepcion_definitiva_date} onChange={(e) => setDraft((p) => ({ ...p, acta_recepcion_definitiva_date: e.target.value }))} className={INPUT_CLS} />
                              </label>
                            </div>
                          </Section>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSave(req)}
                              disabled={saving}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-action-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 active:scale-[0.97] transition-colors duration-150 cursor-pointer disabled:opacity-60"
                            >
                              <FiSave size={14} aria-hidden="true" />
                              {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-4 py-2 text-warm-ash text-sm font-medium hover:text-ink-slate transition-colors duration-150 cursor-pointer rounded-xl hover:bg-slate-100 active:scale-[0.97]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ---- Read mode ---- */
                        <div className="space-y-4">
                          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                            <Field label="Tipo procedimiento" value={PROCEDURE_TYPES.find((p) => p.value === req.procedure_type)?.label} />
                            <Field label="Código SOCE"        value={req.soce_process_code}              mono />
                            <Field label="Código PAC"         value={req.pac_code}                       mono />
                            <Field label="Presupuesto ref."   value={req.presupuesto_referencial ? `$${Number(req.presupuesto_referencial).toLocaleString('es-EC', {minimumFractionDigits:2})}` : null} mono />
                            <Field label="Entidad"            value={req.entidad_contratante_name} />
                            <Field label="RUC entidad"        value={req.entidad_contratante_ruc}        mono />
                            <Field label="Fecha oferta SOCE"  value={req.oferta_tecnica_submitted_at?.slice(0,10)} mono />
                            <Field label="Fecha puja"         value={req.puja_date}                      mono />
                            <Field label="Precio puja"        value={req.puja_final_price ? `$${Number(req.puja_final_price).toLocaleString('es-EC', {minimumFractionDigits:2})}` : null} mono />
                            <Field label="Res. adjudicación"  value={req.adjudicacion_resolution_number} mono />
                            <Field label="Fecha adjudicación" value={req.adjudicacion_resolution_date}   mono />
                            <Field label="Orden de compra"    value={req.orden_compra_number}            mono />
                            <Field label="Garantía FC"        value={req.garantia_fiel_cumplimiento_submitted ? 'Entregada' : 'Pendiente'} />
                            <Field label="Acta provisional"   value={req.acta_recepcion_provisional_date} mono />
                            <Field label="Acta definitiva"    value={req.acta_recepcion_definitiva_date}  mono />
                          </dl>

                          {req.adjudicacion_resolution_file_id && (
                            <a
                              href={`https://drive.google.com/file/d/${req.adjudicacion_resolution_file_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-action-blue hover:underline cursor-pointer"
                            >
                              <FiExternalLink size={12} aria-hidden="true" />
                              Ver resolución en Drive
                            </a>
                          )}

                          {isACP && (
                            <button
                              type="button"
                              onClick={() => openEdit(req)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-700 active:scale-[0.97] transition-colors duration-150 cursor-pointer"
                            >
                              Editar datos SERCOP
                            </button>
                          )}
                          {!isACP && (
                            <div className="flex items-center gap-1.5 text-xs text-warm-ash">
                              <FiLock size={12} aria-hidden="true" />
                              Solo ACP Comercial puede editar datos SERCOP
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default SoceTrackSection;
