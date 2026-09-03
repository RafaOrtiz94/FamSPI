import React, { useState } from 'react';
import {
  FiPackage, FiChevronDown, FiChevronUp,
  FiCheckCircle, FiAlertTriangle, FiClock, FiLock,
} from 'react-icons/fi';
import Card from '../../../core/ui/components/Card';
import Button from '../../../core/ui/components/Button';
import InstallationReceptionStepper from '../../servicio/components/InstallationReceptionStepper';
import { updatePublicPurchaseInstallationWorkflow } from '../../../core/api/equipmentPurchasesApi';
import { useUI } from '../../../core/ui/useUI';
import { useAuth } from '../../../core/auth/AuthContext';
import { normalizeRoles, isTechnical, isChiefTechnical, isLogistics as isLogisticsRole } from '../../shared/purchases-workspace/purchaseRoleGroups';

const DELIVERY_STATUSES = new Set(['waiting_dispatch', 'dispatch_ready', 'completed']);

/* ---- Shared input class (DESIGN.md) ---- */
const INPUT_CLS = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink-slate placeholder-warm-ash focus:outline-none focus:ring-2 focus:ring-sky-signal/40 focus:border-action-blue transition-colors duration-150';

/* ---- Semantic status helpers ---- */
const stepStatus = (done, value) => {
  if (done)                     return 'done';
  if (value && value !== 'pending') return 'active';
  return 'pending';
};

const STEP_META = {
  done:    { dot: 'bg-operative-green', label: 'bg-green-50 text-operative-green',   text: 'Completado',  icon: FiCheckCircle },
  active:  { dot: 'bg-action-blue',     label: 'bg-blue-50 text-action-blue',         text: 'En curso',    icon: FiClock       },
  pending: { dot: 'bg-slate-300',        label: 'bg-slate-100 text-warm-ash',          text: 'Pendiente',   icon: FiClock       },
};

const StepBadge = ({ status, override }) => {
  const meta = STEP_META[status] || STEP_META.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.label}`}>
      <Icon size={9} aria-hidden="true" />
      {override || meta.text}
    </span>
  );
};

const createFst14Draft = () => ({
  guide_reference: '', proforma_reference: '', result: 'pass',
  checklist: { guide_vs_proforma: '', packaging_integrity: '', tilt_indicator: '', handling_indicator: '', serial_match: '', accessories_match: '' },
  findings: '', corrective_actions: '', logistics_chain_notes: '', photos: [],
});

const PublicPurchaseInstallationPanel = ({ request, onRefresh }) => {
  const { showToast } = useUI();
  const { user }      = useAuth();

  const roles      = normalizeRoles(user);
  const isLeadTech = isChiefTechnical(roles);
  const isTech     = isTechnical(roles);
  const isLogistics = isLogisticsRole(roles) || isLeadTech;
  const canTech    = isTech || isLeadTech;

  const [open, setOpen]               = useState(false);
  const [saving, setSaving]           = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  const [dispatchDraft, setDispatchDraft]     = useState({ required_date: '', requires_notice: true, client_address: '' });
  const [logisticsDraft, setLogisticsDraft]   = useState({ status: 'completed', guide_reference: '', proforma_reference: '', notes: '' });
  const [fst14Draft, setFst14Draft]           = useState(createFst14Draft());
  const [fst14Errors, setFst14Errors]         = useState({});
  const [verifDraft, setVerifDraft]           = useState({ applies: '', source_reference: '', justification: '' });

  const wf                  = request?.extra?.installation_workflow || {};
  const dispatchRequest     = wf.dispatch_request || {};
  const logisticsValidation = wf.logistics_validation || {};
  const visualReception     = wf.visual_reception || {};
  const verificationDecision= wf.verification_decision || {};
  const verificationCycle   = wf.verification_cycle || {};
  const closureGate         = wf.closure_gate || {};

  if (!DELIVERY_STATUSES.has(request?.status)) return null;

  const doAction = async (action, payload) => {
    setSaving(true);
    try {
      await updatePublicPurchaseInstallationWorkflow(request.id, { action, payload, expected_updated_at: request.updated_at });
      setActiveSection(null);
      showToast('Actualizado correctamente', 'success');
      onRefresh?.();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Error al actualizar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDispatch = () => {
    if (!dispatchDraft.required_date) { showToast('Indica la fecha requerida de entrega', 'warning'); return; }
    doAction('dispatch_request', { required_date: dispatchDraft.required_date, requires_notice: dispatchDraft.requires_notice, client_address: dispatchDraft.client_address || request.client_name || '' });
  };

  const handleLogistics = () => doAction('logistics_validation', logisticsDraft);

  const handleFst14 = () => {
    const errors = {};
    const cl = fst14Draft.checklist || {};
    ['guide_vs_proforma','packaging_integrity','tilt_indicator','handling_indicator','serial_match','accessories_match'].forEach((k) => { if (!cl[k]) errors[k] = 'Requerido'; });
    if (Object.keys(errors).length) { setFst14Errors(errors); showToast('Completa todos los ítems del checklist F.ST-14', 'warning'); return; }
    setFst14Errors({});
    doAction('visual_inspection_fst14', fst14Draft);
  };

  const handleVerif = () => {
    if (!verifDraft.applies) { showToast('Indica si aplica verificación', 'warning'); return; }
    doAction('verification_decision', { applies: verifDraft.applies === 'true', source_reference: verifDraft.source_reference, justification: verifDraft.justification });
  };

  const steps = [
    { key: 'dispatch',      label: 'Solicitud de despacho',          done: Boolean(dispatchRequest.required_date),     status: stepStatus(Boolean(dispatchRequest.required_date), dispatchRequest.required_date) },
    { key: 'logistics',     label: 'Validación logística',           done: logisticsValidation.status === 'completed', status: stepStatus(logisticsValidation.status === 'completed', logisticsValidation.status) },
    { key: 'fst14',         label: 'Recepción visual F.ST-14',       done: visualReception.status === 'completed',     status: stepStatus(visualReception.status === 'completed', visualReception.status) },
    { key: 'verification',  label: 'Verificación F.ST-09',           done: Boolean(verificationDecision.decided_at),   status: stepStatus(Boolean(verificationDecision.decided_at), verificationDecision.decided_at) },
  ];

  const donePct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-ambient overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="installation-panel-content"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FiPackage size={15} className="text-warm-ash shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-ink-slate">Workflow de instalación</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-warm-ash font-medium">{donePct}%</span>
          {closureGate?.all_done && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] text-operative-green font-semibold">Listo para cierre</span>
          )}
        </div>
        {open
          ? <FiChevronUp size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
          : <FiChevronDown size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
        }
      </button>

      {open && (
        <div id="installation-panel-content" className="border-t border-slate-100 p-4 space-y-4">
          {/* Progress bar */}
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-action-blue rounded-full transition-[width] duration-500" style={{ width: `${donePct}%` }} />
          </div>

          {/* Stepper vertical */}
          <ol className="space-y-0">
            {steps.map((step, idx) => {
              const isLast   = idx === steps.length - 1;
              const isOpen   = activeSection === step.key;
              const meta     = STEP_META[step.status];
              return (
                <li key={step.key}>
                  <div className="flex gap-3">
                    {/* Spine */}
                    <div className="flex flex-col items-center shrink-0 pt-1">
                      <span className={`h-3 w-3 rounded-full ${meta.dot} shrink-0`} />
                      {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
                    </div>
                    {/* Row */}
                    <div className={`pb-${isLast ? '0' : '4'} flex-1 min-w-0`}>
                      <button
                        type="button"
                        onClick={() => setActiveSection((p) => (p === step.key ? null : step.key))}
                        aria-expanded={isOpen}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors duration-150 cursor-pointer min-h-[44px]
                          ${isOpen ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'}`}
                      >
                        <span className="text-sm font-medium text-ink-slate leading-snug">{step.label}</span>
                        <StepBadge status={step.status} />
                      </button>

                      {/* Section detail */}
                      {isOpen && (
                        <div className="mt-2 ml-1">
                          {/* --- Dispatch --- */}
                          {step.key === 'dispatch' && (
                            <Card className="p-4 space-y-3 border border-slate-200 rounded-2xl">
                              {dispatchRequest.required_date ? (
                                <dl className="text-sm text-ink-slate space-y-1.5">
                                  <div className="flex gap-2"><dt className="text-warm-ash w-32 shrink-0">Fecha requerida</dt><dd className="font-medium">{dispatchRequest.required_date}</dd></div>
                                  <div className="flex gap-2"><dt className="text-warm-ash w-32 shrink-0">Dirección</dt><dd className="font-medium">{dispatchRequest.client_address || '—'}</dd></div>
                                  <div className="flex gap-2"><dt className="text-warm-ash w-32 shrink-0">Aviso previo</dt><dd className="font-medium">{dispatchRequest.requires_notice ? 'Sí' : 'No'}</dd></div>
                                </dl>
                              ) : (
                                <div className="space-y-3">
                                  <label className="block">
                                    <span className="text-xs font-medium text-ink-slate">Fecha requerida de entrega</span>
                                    <input type="date" value={dispatchDraft.required_date} onChange={(e) => setDispatchDraft((p) => ({ ...p, required_date: e.target.value }))} className={INPUT_CLS} />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs font-medium text-ink-slate">Dirección de entrega</span>
                                    <input type="text" value={dispatchDraft.client_address} onChange={(e) => setDispatchDraft((p) => ({ ...p, client_address: e.target.value }))} className={INPUT_CLS} placeholder="Ingresa la dirección" />
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-ink-slate cursor-pointer">
                                    <input type="checkbox" checked={dispatchDraft.requires_notice} onChange={(e) => setDispatchDraft((p) => ({ ...p, requires_notice: e.target.checked }))} className="rounded border-slate-300 text-action-blue focus:ring-action-blue" />
                                    Requiere aviso previo
                                  </label>
                                  <Button size="sm" onClick={handleDispatch} loading={saving}>Registrar solicitud</Button>
                                </div>
                              )}
                            </Card>
                          )}

                          {/* --- Logistics --- */}
                          {step.key === 'logistics' && (
                            <Card className="p-4 space-y-3 border border-slate-200 rounded-2xl">
                              {logisticsValidation.status === 'completed' ? (
                                <dl className="text-sm text-ink-slate space-y-1.5">
                                  <div className="flex gap-2"><dt className="text-warm-ash w-24 shrink-0">Guía</dt><dd className="font-medium">{logisticsValidation.guide_reference || '—'}</dd></div>
                                  <div className="flex gap-2"><dt className="text-warm-ash w-24 shrink-0">Proforma</dt><dd className="font-medium">{logisticsValidation.proforma_reference || '—'}</dd></div>
                                  {logisticsValidation.notes && <div className="flex gap-2"><dt className="text-warm-ash w-24 shrink-0">Notas</dt><dd>{logisticsValidation.notes}</dd></div>}
                                </dl>
                              ) : isLogistics ? (
                                <div className="space-y-3">
                                  <label className="block">
                                    <span className="text-xs font-medium text-ink-slate">Referencia de guía</span>
                                    <input type="text" value={logisticsDraft.guide_reference} onChange={(e) => setLogisticsDraft((p) => ({ ...p, guide_reference: e.target.value }))} className={INPUT_CLS} />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs font-medium text-ink-slate">Referencia de proforma</span>
                                    <input type="text" value={logisticsDraft.proforma_reference} onChange={(e) => setLogisticsDraft((p) => ({ ...p, proforma_reference: e.target.value }))} className={INPUT_CLS} />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs font-medium text-ink-slate">Notas</span>
                                    <textarea rows={2} value={logisticsDraft.notes} onChange={(e) => setLogisticsDraft((p) => ({ ...p, notes: e.target.value }))} className={INPUT_CLS} />
                                  </label>
                                  <Button size="sm" onClick={handleLogistics} loading={saving}>Confirmar validación</Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-warm-ash py-1">
                                  <FiLock size={13} aria-hidden="true" />
                                  Solo logística puede validar este paso.
                                </div>
                              )}
                            </Card>
                          )}

                          {/* --- F.ST-14 --- */}
                          {step.key === 'fst14' && (
                            <Card className="p-4 space-y-3 border border-slate-200 rounded-2xl">
                              {visualReception.status === 'completed' ? (
                                <dl className="text-sm text-ink-slate space-y-1.5">
                                  <div className="flex gap-2 items-center"><dt className="text-warm-ash w-24 shrink-0">Resultado</dt><dd><StepBadge status={visualReception.result === 'pass' ? 'done' : 'active'} override={visualReception.result === 'pass' ? 'Conforme' : 'No conforme'} /></dd></div>
                                  {visualReception.report_link && (
                                    <a href={visualReception.report_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-action-blue hover:underline">Ver F.ST-14 en Drive</a>
                                  )}
                                </dl>
                              ) : canTech ? (
                                <div className="space-y-3">
                                  <InstallationReceptionStepper
                                    draft={fst14Draft}
                                    errors={fst14Errors}
                                    disabled={saving}
                                    onChange={(field, value) => setFst14Draft((p) => ({ ...p, [field]: value }))}
                                    onChecklistChange={(key, value) => setFst14Draft((p) => ({ ...p, checklist: { ...p.checklist, [key]: value } }))}
                                  />
                                  <Button size="sm" onClick={handleFst14} loading={saving}>Guardar F.ST-14</Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-warm-ash py-1">
                                  <FiLock size={13} aria-hidden="true" />
                                  Solo técnicos pueden registrar F.ST-14.
                                </div>
                              )}
                            </Card>
                          )}

                          {/* --- Verification F.ST-09 --- */}
                          {step.key === 'verification' && (
                            <Card className="p-4 space-y-3 border border-slate-200 rounded-2xl">
                              {verificationDecision.decided_at ? (
                                <dl className="text-sm text-ink-slate space-y-1.5">
                                  <div className="flex gap-2"><dt className="text-warm-ash w-28 shrink-0">Aplica</dt><dd className="font-medium">{verificationDecision.applies ? 'Sí' : 'No'}</dd></div>
                                  <div className="flex gap-2"><dt className="text-warm-ash w-28 shrink-0">Referencia</dt><dd className="font-medium">{verificationDecision.source_reference || '—'}</dd></div>
                                  {verificationDecision.justification && <div className="flex gap-2"><dt className="text-warm-ash w-28 shrink-0">Justificación</dt><dd>{verificationDecision.justification}</dd></div>}
                                  {verificationCycle?.status && <div className="flex gap-2 items-center"><dt className="text-warm-ash w-28 shrink-0">Ciclo</dt><dd><StepBadge status={verificationCycle.status === 'completed' ? 'done' : 'active'} override={verificationCycle.status} /></dd></div>}
                                </dl>
                              ) : isLeadTech ? (
                                <div className="space-y-3">
                                  <label className="block">
                                    <span className="text-xs font-medium text-ink-slate">¿Aplica verificación F.ST-09?</span>
                                    <select value={verifDraft.applies} onChange={(e) => setVerifDraft((p) => ({ ...p, applies: e.target.value }))} className={INPUT_CLS}>
                                      <option value="">Seleccionar...</option>
                                      <option value="true">Sí — requiere verificación técnica</option>
                                      <option value="false">No — exento de verificación</option>
                                    </select>
                                  </label>
                                  <label className="block">
                                    <span className="text-xs font-medium text-ink-slate">Referencia (protocolo o justificación)</span>
                                    <input type="text" value={verifDraft.source_reference} onChange={(e) => setVerifDraft((p) => ({ ...p, source_reference: e.target.value }))} className={INPUT_CLS} />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs font-medium text-ink-slate">Justificación</span>
                                    <textarea rows={2} value={verifDraft.justification} onChange={(e) => setVerifDraft((p) => ({ ...p, justification: e.target.value }))} className={INPUT_CLS} />
                                  </label>
                                  <Button size="sm" onClick={handleVerif} loading={saving}>Registrar decisión</Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-warm-ash py-1">
                                  <FiLock size={13} aria-hidden="true" />
                                  Solo Jefe Técnico puede decidir.
                                </div>
                              )}
                            </Card>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Blockers */}
          {closureGate?.blockers?.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-800">Pendientes para cierre</p>
              <ul className="space-y-1">
                {closureGate.blockers.map((b) => (
                  <li key={b} className="flex items-start gap-1.5 text-xs text-amber-700">
                    <FiAlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PublicPurchaseInstallationPanel;
