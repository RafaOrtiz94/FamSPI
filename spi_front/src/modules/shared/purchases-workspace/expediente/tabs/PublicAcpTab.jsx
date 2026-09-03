import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiFileText, FiGlobe, FiUpload, FiCalendar,
  FiClock, FiRefreshCw, FiAlertCircle, FiCheckCircle,
  FiLoader, FiChevronDown, FiChevronUp, FiArrowRight,
} from 'react-icons/fi';
import RoleGatedAction from '../../components/RoleGatedAction';
import TabBadge from '../../components/TabBadge';
import FileUploadZone from '../../../../../core/ui/components/FileUploadZone';
import {
  getEquipmentPurchaseApiError,
  registerPublicPortalOutcome,
  requestPublicPurchaseInspection,
  requestProforma,
  reserveEquipment,
  renewReservation,
  getFreedReservations,
  transferReservation,
  submitSignedProformaWithInspection,
  updatePublicPortalChecklist,
  updatePurchaseChecklist,
  uploadProforma,
} from '../../../../../core/api/equipmentPurchasesApi';

/* ─── helpers ─── */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ACP_RESULTS = [
  { value: 'won',       label: 'Ganado',     variant: 'green'   },
  { value: 'lost',      label: 'Perdido',    variant: 'red'     },
  { value: 'deserted',  label: 'Desierto',   variant: 'amber'   },
  { value: 'cancelled', label: 'Cancelado',  variant: 'neutral' },
];

const ACP_STATUS_LABELS = {
  pending_provider_assignment: 'Pendiente asignación de proveedor',
  waiting_provider_response:   'Esperando respuesta del proveedor',
  waiting_signed_proforma:     'Esperando proforma firmada',
  pending_contract:            'Pendiente de contrato',
};

/* ══════════════════════════════════════════════════════════
   ReservationPanel — muestra estado de reserva, vencimiento,
   renovación y transferencia desde reservas liberadas.
══════════════════════════════════════════════════════════ */
function ReservationPanel({ purchase, userRoles, refresh }) {
  const [reserveLoading,   setReserveLoading]   = useState(false);
  const [renewLoading,     setRenewLoading]     = useState(false);
  const [transferLoading,  setTransferLoading]  = useState(null); // id being transferred
  const [fetchingFreed,    setFetchingFreed]    = useState(false);
  const [freedReservations, setFreedReservations] = useState(null); // null = not fetched yet
  const [freedExpanded,    setFreedExpanded]    = useState(false);
  const [error,            setError]            = useState(null);

  const canManage = userRoles.some((r) => ['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'].includes(r));

  const hasReservation       = Boolean(purchase?.reservation_email_sent_at);
  const reservationExpiresAt = purchase?.reservation_expires_at;
  const daysLeft             = daysUntil(reservationExpiresAt);
  const isExpired            = daysLeft !== null && daysLeft <= 0;
  const isExpiringSoon       = daysLeft !== null && daysLeft > 0 && daysLeft <= 3;
  const transferredFrom      = purchase?.extra?.reservation_transferred_from;

  const handleReserve = async () => {
    setReserveLoading(true);
    setError(null);
    try {
      await reserveEquipment(purchase.id, purchase.updated_at);
      await refresh();
    } catch (err) {
      setError(getEquipmentPurchaseApiError(err).message);
    } finally {
      setReserveLoading(false);
    }
  };

  const handleRenew = async () => {
    setRenewLoading(true);
    setError(null);
    try {
      await renewReservation(purchase.id, purchase.updated_at);
      await refresh();
    } catch (err) {
      setError(getEquipmentPurchaseApiError(err).message);
    } finally {
      setRenewLoading(false);
    }
  };

  const loadFreedReservations = useCallback(async () => {
    setFetchingFreed(true);
    setError(null);
    try {
      const list = await getFreedReservations();
      setFreedReservations(Array.isArray(list) ? list : []);
      setFreedExpanded(true);
    } catch (err) {
      setError('No se pudieron cargar las reservas liberadas.');
    } finally {
      setFetchingFreed(false);
    }
  }, []);

  const handleTransfer = async (fromId) => {
    setTransferLoading(fromId);
    setError(null);
    try {
      await transferReservation(purchase.id, { from_id: fromId, expected_updated_at: purchase.updated_at });
      await refresh();
      setFreedExpanded(false);
      setFreedReservations(null);
    } catch (err) {
      setError(getEquipmentPurchaseApiError(err).message);
    } finally {
      setTransferLoading(null);
    }
  };

  return (
    <div className={`rounded-xl border p-5 shadow-ambient transition-all duration-200 ${
      hasReservation && !isExpired
        ? 'border-action-blue bg-action-blue/5'
        : isExpired
        ? 'border-alert-red bg-red-50'
        : 'border-soft-border bg-white'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${
            hasReservation && !isExpired ? 'bg-action-blue text-white' :
            isExpired ? 'bg-alert-red text-white' :
            'bg-fog text-warm-ash'
          }`}>
            <FiCalendar size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink-slate">Reserva de equipos</h3>
            <p className="text-xs text-warm-ash">Válida por {15} días desde la fecha de solicitud</p>
          </div>
        </div>
        {hasReservation && reservationExpiresAt && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isExpired       ? 'bg-red-soft text-alert-red' :
            isExpiringSoon  ? 'bg-amber-soft text-caution-amber' :
            'bg-action-blue/10 text-action-blue'
          }`}>
            {isExpired ? 'Vencida' : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <FiAlertCircle className="text-alert-red shrink-0 mt-0.5" size={14} />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* Estado de la reserva */}
      {hasReservation ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-warm-ash mb-1">Reserva solicitada</p>
              <p className="font-medium text-ink-slate">{formatDate(purchase.reservation_email_sent_at)}</p>
            </div>
            <div className={`rounded-xl border p-3 ${
              isExpired ? 'border-alert-red bg-red-50' : isExpiringSoon ? 'border-caution-amber bg-amber-50' : 'border-slate-200 bg-white'
            }`}>
              <p className="text-warm-ash mb-1">Vencimiento</p>
              <p className={`font-medium ${isExpired ? 'text-alert-red' : isExpiringSoon ? 'text-caution-amber' : 'text-ink-slate'}`}>
                {formatDate(reservationExpiresAt)}
              </p>
            </div>
          </div>

          {/* Referencia transferida */}
          {transferredFrom && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
              <FiArrowRight size={13} className="shrink-0" />
              Reserva transferida desde expediente de {transferredFrom.from_client_name || 'compra cancelada'}
              {' '}· Transferida el {formatDate(transferredFrom.transferred_at)}
            </div>
          )}

          {/* Enlace a Calendar */}
          {purchase.reservation_calendar_event_link && (
            <a
              href={purchase.reservation_calendar_event_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-action-blue hover:underline"
            >
              <FiCalendar size={12} />
              Ver recordatorio en Google Calendar
            </a>
          )}

          {/* Acciones ACP */}
          {canManage && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleRenew}
                disabled={renewLoading || isExpired}
                className="flex-1 min-h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border border-action-blue text-action-blue text-xs font-medium hover:bg-action-blue hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.97]"
              >
                {renewLoading
                  ? <FiLoader className="animate-spin" size={13} />
                  : <FiRefreshCw size={13} />}
                Renovar reserva (+15 días)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-warm-ash">
            Aún no se ha solicitado reserva para este expediente.
            {canManage && ' Cuando la proforma esté lista, solicita la reserva al proveedor.'}
          </p>
          {canManage && (
            <button
              type="button"
              onClick={handleReserve}
              disabled={reserveLoading}
              className="w-full min-h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-action-blue text-white text-sm font-medium disabled:opacity-50 active:scale-[0.97] transition"
            >
              {reserveLoading ? <FiLoader className="animate-spin" size={14} /> : <FiCheckCircle size={14} />}
              Solicitar reserva al proveedor
            </button>
          )}
        </div>
      )}

      {/* Reservas liberadas disponibles */}
      {canManage && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={freedExpanded ? () => setFreedExpanded(false) : loadFreedReservations}
            disabled={fetchingFreed}
            className="w-full flex items-center justify-between text-xs font-medium text-ink-slate hover:text-action-blue transition-colors"
          >
            <span className="flex items-center gap-1.5">
              {fetchingFreed
                ? <FiLoader className="animate-spin" size={12} />
                : <FiClock size={12} />}
              Ver reservas liberadas disponibles
            </span>
            {freedExpanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
          </button>

          <AnimatePresence>
            {freedExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-3"
              >
                {!freedReservations || freedReservations.length === 0 ? (
                  <p className="text-xs text-warm-ash text-center py-4">
                    No hay reservas liberadas disponibles en este momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-warm-ash">
                      Estas reservas fueron liberadas por cancelaciones. Puedes asignar una a este expediente si el equipo coincide.
                    </p>
                    {freedReservations.map((freed) => {
                      const freedDays = daysUntil(freed.reservation_expires_at);
                      const equipmentNames = (Array.isArray(freed.equipment) ? freed.equipment : [])
                        .map((e) => e.model || e.name || e.equipment_name || e.label).filter(Boolean).join(', ');
                      return (
                        <div key={freed.id} className="rounded-xl border border-slate-200 bg-white p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-ink-slate truncate">
                              {freed.client_name || freed.client_business_name || 'Cliente desconocido'}
                            </p>
                            {equipmentNames && (
                              <p className="text-[11px] text-warm-ash truncate">{equipmentNames}</p>
                            )}
                            <p className="text-[11px] text-warm-ash mt-0.5">
                              Vence: <span className={freedDays !== null && freedDays <= 3 ? 'text-caution-amber font-medium' : ''}>
                                {formatDate(freed.reservation_expires_at)}
                                {freedDays !== null && ` (${freedDays}d)`}
                              </span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTransfer(freed.id)}
                            disabled={transferLoading !== null}
                            className="shrink-0 min-h-8 px-3 rounded-xl bg-action-blue text-white text-xs font-medium disabled:opacity-50 active:scale-[0.97] transition"
                          >
                            {transferLoading === freed.id
                              ? <FiLoader className="animate-spin" size={12} />
                              : 'Usar esta'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PublicAcpTab — tab principal
══════════════════════════════════════════════════════════ */
const PublicAcpTab = ({ purchase, type, userRoles, refresh }) => {
  const [loading, setLoading] = useState(false);
  const [proformaLoading, setProformaLoading] = useState(null);
  const [error, setError] = useState(null);
  const [selectedResult, setSelectedResult] = useState(purchase?.public_portal_outcome || null);
  const [portalNotes, setPortalNotes] = useState(purchase?.public_portal_outcome_notes || '');
  const [proformaFile, setProformaFile] = useState(null);
  const [signedProformaFile, setSignedProformaFile] = useState(null);
  const [includesStarterKit, setIncludesStarterKit] = useState(Boolean(purchase?.includes_starter_kit));
  const [inspectionMinDate, setInspectionMinDate] = useState(purchase?.inspection_min_date ? String(purchase.inspection_min_date).slice(0, 10) : '');
  const [inspectionMaxDate, setInspectionMaxDate] = useState(purchase?.inspection_max_date ? String(purchase.inspection_max_date).slice(0, 10) : '');
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [portalChecklistEvidenceUrl, setPortalChecklistEvidenceUrl] = useState('');
  const [portalChecklistDueDate, setPortalChecklistDueDate] = useState('');

  const isPurchasePublic = purchase?.purchase_type === 'public' || type === 'public';

  if (!isPurchasePublic) {
    return (
      <div className="flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-ink-slate">ACP / Portal Público</h2>
            <p className="text-xs text-warm-ash mt-0.5">Solo para compras públicas</p>
          </div>
          <TabBadge status="n/a" />
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="p-5 bg-fog rounded-2xl w-fit mb-4">
            <FiGlobe className="text-warm-ash" size={32} />
          </div>
          <h3 className="text-sm font-semibold text-ink-slate mb-1">No aplica</h3>
          <p className="text-xs text-warm-ash text-center max-w-sm">Esta sección solo está disponible para compras públicas.</p>
        </div>
      </div>
    );
  }

  const handleApiError = (err, fallback = 'No se pudo completar la acción') => {
    const info = getEquipmentPurchaseApiError(err);
    setError(info.message || fallback);
  };

  const handleDeclareResult = async (result) => {
    setLoading(true);
    setError(null);
    try {
      await registerPublicPortalOutcome(purchase.id, {
        outcome: result,
        notes: portalNotes,
        expected_updated_at: purchase.updated_at,
      });
      setSelectedResult(result);
      await refresh();
    } catch (err) {
      handleApiError(err, 'No se pudo registrar el resultado SOCE');
    } finally {
      setLoading(false);
    }
  };

  const runProformaAction = async (actionName, handler) => {
    setProformaLoading(actionName);
    setError(null);
    try {
      await handler();
      await refresh();
    } catch (err) {
      handleApiError(err);
    } finally {
      setProformaLoading(null);
    }
  };

  const handleRequestProforma = () => runProformaAction('request_proforma', async () => {
    await requestProforma(purchase.id, purchase.updated_at);
  });

  const handleUploadProforma = () => runProformaAction('upload_proforma', async () => {
    if (!proformaFile) throw new Error('Selecciona la proforma del proveedor');
    await uploadProforma(purchase.id, proformaFile, { expected_updated_at: purchase.updated_at });
    setProformaFile(null);
  });

  const handleUploadSignedProforma = () => runProformaAction('signed_proforma', async () => {
    if (!signedProformaFile) throw new Error('Selecciona la proforma firmada');
    await submitSignedProformaWithInspection(purchase.id, {
      file: signedProformaFile,
      includes_starter_kit: includesStarterKit,
      expected_updated_at: purchase.updated_at,
    });
    setSignedProformaFile(null);
  });

  const handleRequestInspection = () => runProformaAction('request_inspection', async () => {
    if (!inspectionMinDate || !inspectionMaxDate) {
      throw new Error('Define la ventana minima y maxima para la inspeccion operativa');
    }
    await requestPublicPurchaseInspection(purchase.id, {
      inspection_min_date: inspectionMinDate,
      inspection_max_date: inspectionMaxDate,
      includes_starter_kit: includesStarterKit,
      expected_updated_at: purchase.updated_at,
    });
  });

  const checklistState    = purchase?.checklist_state || {};
  const checklistItems    = Array.isArray(checklistState.items) ? checklistState.items : [];
  const checklistPending  = Array.isArray(checklistState.pending) ? checklistState.pending : [];
  const requiredKeys      = Array.isArray(checklistState.requirements) ? checklistState.requirements : [];
  const linkedBcId = purchase?.extra?.auto_business_case_id || purchase?.business_case_id || null;
  const hasLinkedBc = Boolean(linkedBcId);
  const publicOutcomeWon = String(selectedResult || purchase?.public_portal_outcome || '').toLowerCase() === 'won';
  const hasSignedProforma = Boolean(
    purchase?.signed_proforma_file_id ||
    purchase?.signed_proforma_uploaded_at ||
    purchase?.signed_proforma_file_link
  );
  const inspectionRequested = Boolean(purchase?.inspection_request_id);
  const canRequestInspection = hasSignedProforma && publicOutcomeWon && ['waiting_signed_proforma', 'pending_contract'].includes(purchase?.status || '');

  const toggleChecklistItem = async (item) => {
    setChecklistLoading(true);
    setError(null);
    try {
      await updatePurchaseChecklist(purchase.id, {
        item_key: item.key,
        checked: !item.checked,
      });
      await refresh();
    } catch (err) {
      handleApiError(err, 'No se pudo actualizar el checklist');
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleUpdatePortalChecklist = async () => {
    setChecklistLoading(true);
    setError(null);
    try {
      const checklist = checklistItems
        .filter((item) => requiredKeys.length === 0 || requiredKeys.includes(item.key))
        .map((item) => ({ key: item.key, checked: Boolean(item.checked) }));
      await updatePublicPortalChecklist(purchase.id, {
        checklist,
        evidence_url: portalChecklistEvidenceUrl || null,
        due_date: portalChecklistDueDate || null,
      });
      await refresh();
    } catch (err) {
      handleApiError(err, 'No se pudo sincronizar checklist del portal');
    } finally {
      setChecklistLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">ACP / Portal Público</h2>
          <p className="text-xs text-warm-ash mt-0.5">Proformas, reserva, SOCE e inspección</p>
        </div>
        <TabBadge status={selectedResult ? 'completado' : 'pendiente'} />
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Estado ACP — visible para todos los roles con acceso al workspace */}
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-warm-ash">Estado ACP</p>
            <p className="text-sm font-medium text-ink-slate">
              {ACP_STATUS_LABELS[purchase?.status] || purchase?.status || 'Sin estado'}
            </p>
          </div>
        </div>

        {/* ══════════ PANEL DE RESERVA ══════════ */}
        <ReservationPanel purchase={purchase} userRoles={userRoles} refresh={refresh} />

        {/* Proformas, Checklist y SOCE — solo acp_comercial, gerencia, jefe_comercial */}
        <RoleGatedAction allowedRoles={['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial']} userRoles={userRoles}>
          <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
            <div className="flex items-center gap-2 mb-4">
              <FiGlobe className="text-action-blue" size={18} />
              <h3 className="text-sm font-semibold text-ink-slate">Checklist del portal externo</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FiFileText className="text-action-blue" size={16} />
                  <h4 className="text-sm font-medium text-ink-slate">Solicitud de proforma</h4>
                </div>
                <button
                  type="button"
                  onClick={handleRequestProforma}
                  disabled={proformaLoading === 'request_proforma'}
                  className="w-full min-h-11 rounded-xl bg-action-blue text-white text-sm font-medium disabled:opacity-50 active:scale-[0.97]"
                >
                  {proformaLoading === 'request_proforma' ? 'Solicitando...' : 'Solicitar proforma'}
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FiUpload className="text-action-blue" size={16} />
                  <h4 className="text-sm font-medium text-ink-slate">Proforma proveedor</h4>
                </div>
                <FileUploadZone
                  id="proforma-file"
                  accept=".pdf,.doc,.docx"
                  label="Subir proforma"
                  description="PDF, Word — máx. 20 MB"
                  file={proformaFile}
                  onFileChange={setProformaFile}
                  onUpload={handleUploadProforma}
                  uploading={proformaLoading === 'upload_proforma'}
                  uploadedLink={purchase?.proforma_file_link || null}
                  uploadedLabel="Proforma del proveedor"
                />
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FiUpload className="text-operative-green" size={16} />
                  <h4 className="text-sm font-medium text-ink-slate">Proforma firmada + inspección operativa</h4>
                </div>
                <div className="space-y-3">
                  <RoleGatedAction allowedRoles={['acp_comercial']} userRoles={userRoles}>
                    <FileUploadZone
                      id="signed-proforma-file"
                      accept=".pdf,.doc,.docx"
                      label="Subir proforma firmada"
                      description="PDF, Word — máx. 20 MB"
                      file={signedProformaFile}
                      onFileChange={setSignedProformaFile}
                      onUpload={handleUploadSignedProforma}
                      uploading={proformaLoading === 'signed_proforma'}
                      uploadedLink={purchase?.signed_proforma_file_link || null}
                      uploadedLabel="Proforma firmada"
                    />
                  </RoleGatedAction>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-slate-800">Inspeccion operativa de compra publica</p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Esta solicitud F.ST-20 pertenece al proceso operativo de la compra publica.
                        {hasLinkedBc ? ' Si existe un Business Case vinculado, su inspeccion por costos o factibilidad es independiente.' : ''}
                      </p>
                    </div>

                    {inspectionRequested ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                        <p className="font-semibold">Inspeccion operativa solicitada</p>
                        <p className="mt-1">
                          Solicitud #{purchase?.inspection_request_id || '—'} · Ventana {purchase?.inspection_min_date || 'Pendiente'} a {purchase?.inspection_max_date || 'Pendiente'}
                        </p>
                        {purchase?.extra?.inspection_acta_link && (
                          <a
                            href={purchase.extra.inspection_acta_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 text-action-blue hover:underline font-medium"
                          >
                            <FiFileText size={12} />
                            Ver F.ST-20 operativo
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-medium text-slate-700">Fecha minima</span>
                            <input
                              type="date"
                              value={inspectionMinDate}
                              onChange={(e) => setInspectionMinDate(e.target.value)}
                              className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-medium text-slate-700">Fecha maxima</span>
                            <input
                              type="date"
                              value={inspectionMaxDate}
                              onChange={(e) => setInspectionMaxDate(e.target.value)}
                              min={inspectionMinDate || undefined}
                              className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs"
                            />
                          </label>
                        </div>

                        {canRequestInspection ? (
                          <RoleGatedAction allowedRoles={['acp_comercial']} userRoles={userRoles}>
                            <button
                              type="button"
                              onClick={handleRequestInspection}
                              disabled={proformaLoading === 'request_inspection'}
                              className="w-full min-h-11 rounded-xl bg-action-blue text-white text-sm font-medium disabled:opacity-50 active:scale-[0.97]"
                            >
                              {proformaLoading === 'request_inspection' ? 'Solicitando...' : 'Solicitar inspeccion operativa'}
                            </button>
                          </RoleGatedAction>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                            {!publicOutcomeWon
                              ? 'Disponible cuando el resultado SOCE sea Ganado.'
                              : !hasSignedProforma
                                ? 'Disponible despues de subir la proforma firmada.'
                                : 'Disponible cuando el expediente entre a la etapa contractual habilitada para inspeccion.'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={includesStarterKit} onChange={(e) => setIncludesStarterKit(e.target.checked)} />
                    Incluye starter kit
                  </label>
                </div>
              </div>
            </div>

            {/* Checklist ACP */}
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <h4 className="text-sm font-medium text-ink-slate mb-2">Checklist ACP</h4>
              {checklistItems.length ? (
                <div className="space-y-2">
                  {checklistItems
                    .filter((item) => requiredKeys.length === 0 || requiredKeys.includes(item.key))
                    .map((item) => (
                      <label key={item.key} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-50">
                        <span className="text-xs text-slate-700">{item.label || item.key}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(item.checked)}
                          disabled={checklistLoading}
                          onChange={() => toggleChecklistItem(item)}
                        />
                      </label>
                    ))}
                  {checklistPending.length > 0 && (
                    <p className="text-[11px] text-amber-700">Pendientes: {checklistPending.join(', ')}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-warm-ash">Sin checklist estructurado para este expediente.</p>
              )}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="url"
                  value={portalChecklistEvidenceUrl}
                  onChange={(e) => setPortalChecklistEvidenceUrl(e.target.value)}
                  placeholder="URL de evidencia (opcional)"
                  className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs"
                />
                <input
                  type="date"
                  value={portalChecklistDueDate}
                  onChange={(e) => setPortalChecklistDueDate(e.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleUpdatePortalChecklist}
                disabled={checklistLoading}
                className="mt-3 w-full min-h-11 rounded-xl bg-action-blue text-white text-sm font-medium disabled:opacity-50 active:scale-[0.97]"
              >
                Sincronizar checklist portal
              </button>
            </div>
          </div>

          {/* Declarar resultado SOCE */}
          <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
            <h3 className="text-sm font-semibold text-ink-slate mb-4">Declarar resultado SOCE</h3>
            <textarea
              value={portalNotes}
              onChange={(e) => setPortalNotes(e.target.value)}
              placeholder="Notas del resultado SOCE"
              className="mb-4 w-full min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              {ACP_RESULTS.map((result) => (
                <button
                  key={result.value}
                  type="button"
                  onClick={() => handleDeclareResult(result.value)}
                  disabled={loading}
                  className={`p-4 min-h-11 rounded-xl text-center transition-all duration-150 border active:scale-[0.97] ${
                    selectedResult === result.value
                      ? result.variant === 'green'  ? 'border-operative-green bg-green-soft shadow-lifted'
                        : result.variant === 'red'  ? 'border-alert-red bg-red-soft shadow-lifted'
                        : result.variant === 'amber' ? 'border-caution-amber bg-amber-soft shadow-lifted'
                        : 'border-fog bg-fog shadow-lifted'
                      : 'border-soft-border hover:bg-paper-white hover:shadow-lifted'
                  }`}
                >
                  <div className="font-medium text-ink-slate">{loading ? 'Guardando...' : result.label}</div>
                </button>
              ))}
            </div>
          </div>
        </RoleGatedAction>
      </div>
    </div>
  );
};

export default PublicAcpTab;
