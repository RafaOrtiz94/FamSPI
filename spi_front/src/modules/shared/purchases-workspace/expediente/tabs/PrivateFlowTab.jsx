/**
 * PrivateFlowTab — Tab exclusivo del flujo comercial de compra privada
 *
 * Contiene:
 * · Envío de oferta sin firmar    → backoffice_comercial
 * · Subida de oferta firmada      → comercial
 * · Reenvío a ACP                 → backoffice_comercial
 * · Rechazo de oferta             → comercial
 * · Aceptar rechazo / mejora      → jefe_comercial, jefe_de_comercial
 * · Registro de cliente           → comercial (con modal de revisión)
 *
 * Solo se monta en compras privadas (el tab ni aparece en públicas).
 */
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiExternalLink,
  FiGlobe,
  FiLoader,
  FiSend,
  FiUserCheck,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import RoleGatedAction from '../../components/RoleGatedAction';
import TabBadge from '../../components/TabBadge';
import WorkflowStep from '../../components/WorkflowStep';
import FileUploadZone from '../../../../../core/ui/components/FileUploadZone';
import NewClientRequestForm from '../../../../comercial/components/NewClientRequestForm';
import {
  forwardPrivatePurchaseToAcp,
  registerPrivateClient,
  requestClientRegistration,
  savePrivatePurchaseInspectionRequest,
  sendPrivatePurchaseOffer,
  transitionPrivatePurchaseState,
  uploadPrivateSignedOffer,
} from '../../../../../core/api/privatePurchasesApi';
import { promptDialog } from '../../../../../core/ui/utils/promptDialog';

const EASE_OUT = [0.23, 1, 0.32, 1];

/* ─── estados en que cada acción está habilitada ─────────────────────── */
const OFFER_SEND_STATES    = ['acp_availability_confirmed', 'price_improvement_requested'];
const OFFER_SIGN_STATES    = ['offer_sent', 'pending_client_signature'];
const CLIENT_REG_STATES    = ['offer_signed', 'client_registration_requested'];
const PRICE_IMPROVE_STATES = ['offer_rejected_by_commercial'];

/* ─── estados a partir de los cuales el cliente DEBE estar registrado ── */
const REQUIRES_CLIENT_REG  = new Set([
  'offer_signed',
  'client_registration_requested',
  'client_registered',
  'pending_contract_approval',
  'pending_contract_client_signature',
  'contract_available',
  'delivery_dates_requested',
]);

/* ─── label de etapa ─────────────────────────────────────────────────── */
function getStageLabel(status) {
  if (['pending_backoffice', 'acp_availability_requested', 'acp_availability_confirmed'].includes(status))
    return 'Backoffice Comercial';
  if (['offer_sent', 'pending_client_signature', 'offer_signed', 'client_registration_requested'].includes(status))
    return 'Comercial';
  if (['offer_rejected_by_commercial', 'price_improvement_requested'].includes(status))
    return 'Jefe Comercial';
  return 'Seguimiento';
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    const payload = result.includes(',') ? result.split(',')[1] : result;
    if (!payload?.trim()) reject(new Error('El archivo está vacío o no se pudo procesar'));
    else resolve(payload);
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

/* ─── Mapear client_snapshot → initialData de NewClientRequestForm ─── */
function snapshotToInitialData(snapshot = {}) {
  return {
    commercial_name:              snapshot.commercial_name              || '',
    legal_person_business_name:   snapshot.legal_person_business_name   || '',
    ruc_cedula:                   snapshot.ruc_cedula                   || '',
    client_email:                 snapshot.email                        || '',
    establishment_cellphone:      snapshot.phone                        || '',
    shipping_contact_name:        snapshot.contact_person               || '',
    client_type:                  snapshot.client_type                  || 'persona_natural',
  };
}

/* ─── Modal de registro — portal para evitar stacking context ────────
 * framer-motion aplica transform/translate en motion.div, lo que crea
 * un nuevo stacking context. position:fixed dentro queda confinado
 * al motion.div y no al viewport. createPortal monta el modal en
 * document.body directamente, garantizando cobertura total.
────────────────────────────────────────────────────────────────────── */
const ClientRegistrationModal = ({ purchase, onClose, onSuccess }) => {
  const initialData = snapshotToInitialData(purchase?.client_snapshot);

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-action-blue/10">
              <FiUserCheck className="text-action-blue" size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-slate">Registro de cliente</h3>
              <p className="text-xs text-warm-ash">Completa los datos del cliente para habilitar el contrato</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-warm-ash hover:bg-slate-100 transition cursor-pointer"
            aria-label="Cerrar"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Formulario completo de registro */}
        <div className="p-6">
          <NewClientRequestForm
            showIntro={false}
            initialData={initialData}
            onCancel={onClose}
            onSuccess={onSuccess}
            successMessage="Cliente registrado correctamente. La solicitud privada puede avanzar al contrato."
          />
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

/* ═══════════════════════════════════════════════════════════════════════
   PrivateFlowTab
═══════════════════════════════════════════════════════════════════════ */
const PrivateFlowTab = ({ purchase, type, userRoles, hasRole, refresh }) => {
  const [action,       setAction]       = useState(null); // acción en curso
  const [offerFile,    setOfferFile]    = useState(null);
  const [signedFile,   setSignedFile]   = useState(null);
  const [error,        setError]        = useState(null);
  const [showRegModal, setShowRegModal] = useState(false);

  /* ── Solicitar inspección de ambiente ───────────────────────────── */
  const [inspMinDate,       setInspMinDate]       = useState('');
  const [inspMaxDate,       setInspMaxDate]       = useState('');
  const [inspAccesorios,    setInspAccesorios]    = useState('');
  const [inspObservaciones, setInspObservaciones] = useState('');

  /* ── compra pública → este tab no aplica ────────────────────────── */
  const isPurchasePrivate = purchase?.purchase_type === 'private' || type === 'private';

  if (!isPurchasePrivate) {
    return (
      <div className="flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-ink-slate">Flujo Comercial</h2>
            <p className="text-xs text-warm-ash mt-0.5">Solo para compras privadas</p>
          </div>
          <TabBadge status="n/a" />
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="p-5 bg-fog rounded-2xl w-fit mb-4">
            <FiGlobe className="text-warm-ash" size={32} />
          </div>
          <h3 className="text-sm font-semibold text-ink-slate mb-1">No aplica</h3>
          <p className="text-xs text-warm-ash text-center max-w-sm">
            Esta sección solo está disponible para compras privadas.
          </p>
        </div>
      </div>
    );
  }

  const status     = purchase?.status;
  const stageLabel = getStageLabel(status);
  const clientName = purchase?.client_snapshot?.commercial_name
    || purchase?.client_data?.commercial_name
    || purchase?.client_data?.legal_person_business_name
    || 'cliente';
  const createdBy  = purchase?.created_by_email || purchase?.created_by || 'comercial';

  /* ── detección de registro de cliente ──────────────────────────── */
  const isClientRegistered   = Boolean(purchase?.client_registered_at);
  const needsClientReg       = REQUIRES_CLIENT_REG.has(status) && !isClientRegistered;
  const alreadyRequested     = status === 'client_registration_requested';

  /* ── detección de inspección de ambiente ──────────────────────── */
  const linkedBcId  = purchase?.extra?.auto_business_case_id || purchase?.business_case_id || null;
  const inspByBc    = String(purchase?.offer_kind || '').toLowerCase() === 'comodato' && Boolean(linkedBcId);
  const inspDone    = Boolean(purchase?.inspection_request_id);

  /** roleStepStatus — estado del paso según el rol del usuario */
  const roleStepStatus = (done, active, ownerRoles) => {
    if (done) return 'completed';
    const isMyStep = Array.isArray(ownerRoles) && userRoles.some((r) => ownerRoles.includes(r));
    if (isMyStep) return active ? 'active' : 'pending';
    return active ? 'waiting' : 'pending';
  };

  /* ─── runner genérico ────────────────────────────────────────────── */
  const run = async (name, handler) => {
    setAction(name);
    setError(null);
    try {
      await handler();
      await refresh();
    } catch (err) {
      setError(
        typeof err === 'string'
          ? err
          : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudo completar la acción',
      );
    } finally {
      setAction(null);
    }
  };

  /* ─── handlers ───────────────────────────────────────────────────── */
  const handleSendOffer = () => run('send_offer', async () => {
    if (!offerFile) throw new Error('Selecciona el archivo de oferta antes de enviarlo');
    const payload = await fileToBase64(offerFile);
    await sendPrivatePurchaseOffer(purchase.id, {
      offer_base64: payload,
      file_name:    offerFile.name,
      folder_path:  `/Ofertas Sin Firmar/${createdBy}/${clientName}`,
    });
    setOfferFile(null);
  });

  const handleUploadSignedOffer = () => run('signed_offer', async () => {
    if (!signedFile) throw new Error('Selecciona la oferta firmada por el cliente');
    const payload = await fileToBase64(signedFile);
    await uploadPrivateSignedOffer(purchase.id, { signed_offer_base64: payload, file_name: signedFile.name });
    setSignedFile(null);
  });

  const handleForwardToAcp = () => run('forward_acp', async () => {
    await forwardPrivatePurchaseToAcp(purchase.id);
  });

  const handleRejectOffer = () => run('reject_offer', async () => {
    const reason = (await promptDialog({
      title: 'Rechazar oferta',
      message: 'Motivo de rechazo (opcional):',
      confirmText: 'Rechazar',
    })) || '';
    await transitionPrivatePurchaseState(purchase.id, 'offer_rejected_by_commercial', reason.trim());
  });

  const handleAcceptReject = () => run('accept_reject', async () => {
    if (!window.confirm('¿Confirmas finalizar esta solicitud por rechazo comercial?')) return;
    await transitionPrivatePurchaseState(purchase.id, 'rejected');
  });

  const handleRequestImprovement = () => run('price_improvement', async () => {
    const reason = (await promptDialog({
      title: 'Solicitar mejora de precio',
      message: 'Detalle de la mejora requerida (opcional):',
      confirmText: 'Solicitar mejora',
    })) || '';
    await transitionPrivatePurchaseState(purchase.id, 'price_improvement_requested', reason.trim());
  });

  const handleRequestInspection = () => run('request_inspection', () =>
    savePrivatePurchaseInspectionRequest(purchase.id, {
      inspection_min_date:  inspMinDate       || undefined,
      inspection_max_date:  inspMaxDate       || undefined,
      accesorios:           inspAccesorios    || undefined,
      observaciones:        inspObservaciones || undefined,
    })
  );

  /* ─── indicador de completado ────────────────────────────────────── */
  const isCompleted = ['completed', 'rejected', 'cancelled'].includes(status);

  return (
    <>
      <div className="flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-ink-slate">Flujo Comercial</h2>
            <p className="text-xs text-warm-ash mt-0.5">Oferta, firma y registro de cliente</p>
          </div>
          <TabBadge status={isCompleted ? 'completado' : 'pendiente'} />
        </div>

        <div className="p-6 space-y-5">
          {/* Error genérico */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <FiAlertCircle className="text-alert-red mt-0.5 shrink-0" size={18} />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </motion.div>
          )}

          {/* ── BLOQUE BLOQUEADOR: cliente no registrado ─────────────────── */}
          <AnimatePresence>
            {needsClientReg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  alreadyRequested
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <FiAlertTriangle
                    className={alreadyRequested ? 'text-amber-600' : 'text-alert-red'}
                    size={18}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold mb-0.5 ${alreadyRequested ? 'text-amber-800' : 'text-red-800'}`}>
                      {alreadyRequested
                        ? 'Registro de cliente en proceso'
                        : 'Cliente no registrado — acción requerida'
                      }
                    </p>
                    <p className={`text-xs ${alreadyRequested ? 'text-amber-700' : 'text-red-700'}`}>
                      {alreadyRequested
                        ? 'La solicitud de registro ya fue enviada al backoffice comercial. Esperá confirmación o reenvíala si es necesario.'
                        : 'El cliente debe estar registrado en el sistema antes de continuar con el contrato. Completá el proceso de registro para desbloquear los siguientes pasos.'
                      }
                    </p>
                  </div>
                  <RoleGatedAction allowedRoles={['comercial', 'backoffice_comercial']} userRoles={userRoles}>
                    <button
                      type="button"
                      onClick={() => setShowRegModal(true)}
                      className={`shrink-0 min-h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-medium border transition cursor-pointer ${
                        alreadyRequested
                          ? 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'border-red-300 bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      <FiUserCheck size={13} />
                      {alreadyRequested ? 'Ver / reenviar' : 'Registrar cliente'}
                    </button>
                  </RoleGatedAction>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Estado / etapa ───────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-soft-border shadow-ambient">
            <div>
              <p className="text-xs text-warm-ash">Etapa actual</p>
              <p className="text-sm font-semibold text-ink-slate">{stageLabel}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {isClientRegistered && (
                <span className="flex items-center gap-1 text-xs text-operative-green font-medium">
                  <FiCheckCircle size={12} /> Cliente registrado
                </span>
              )}
              <span className="text-xs font-mono text-warm-ash">{status || '—'}</span>
            </div>
          </div>

          {/* ── Paso 1: Oferta sin firmar ──────────────────────────────── */}
          <WorkflowStep
            stepNumber={1}
            title="Oferta enviada al cliente"
            actor="Backoffice Comercial"
            status={roleStepStatus(
              Boolean(purchase?.offer_document_id),
              OFFER_SEND_STATES.includes(status),
              ['backoffice_comercial','acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'],
            )}
          >
            {purchase?.offer_document_id ? (
              <FileUploadZone
                id="offer-file"
                accept=".pdf,.doc,.docx"
                label="Enviar oferta al cliente"
                description="PDF, Word — máx. 20 MB"
                file={offerFile}
                onFileChange={setOfferFile}
                onUpload={handleSendOffer}
                uploading={action === 'send_offer'}
                disabled
                uploadedLink={`https://drive.google.com/file/d/${purchase.offer_document_id}/view`}
                uploadedLabel="Oferta enviada al cliente"
              />
            ) : (
              <RoleGatedAction allowedRoles={['backoffice_comercial']} userRoles={userRoles}>
                <FileUploadZone
                  id="offer-file"
                  accept=".pdf,.doc,.docx"
                  label="Enviar oferta al cliente"
                  description="PDF, Word — máx. 20 MB"
                  file={offerFile}
                  onFileChange={setOfferFile}
                  onUpload={handleSendOffer}
                  uploading={action === 'send_offer'}
                  disabled={!OFFER_SEND_STATES.includes(status)}
                  errorMessage={
                    !OFFER_SEND_STATES.includes(status)
                      ? 'Disponible cuando ACP confirma disponibilidad o se solicita mejora de precio.'
                      : undefined
                  }
                />
              </RoleGatedAction>
            )}
          </WorkflowStep>

          {/* ── Paso 2: Oferta firmada por cliente ─────────────────────── */}
          <WorkflowStep
            stepNumber={2}
            title="Oferta firmada por el cliente"
            actor="Asesor Comercial"
            status={roleStepStatus(
              Boolean(purchase?.offer_signed_document_id),
              OFFER_SIGN_STATES.includes(status),
              ['comercial','asesor_comercial','analista_comercial','acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'],
            )}
            completedAt={purchase?.offer_signed_uploaded_at}
          >
            {purchase?.offer_signed_document_id ? (
              <FileUploadZone
                id="signed-offer-file"
                accept=".pdf,.doc,.docx"
                label="Subir oferta firmada por cliente"
                description="PDF, Word — máx. 20 MB"
                file={signedFile}
                onFileChange={setSignedFile}
                onUpload={handleUploadSignedOffer}
                uploading={action === 'signed_offer'}
                disabled
                uploadedLink={`https://drive.google.com/file/d/${purchase.offer_signed_document_id}/view`}
                uploadedLabel="Oferta firmada por cliente"
              />
            ) : (
              <RoleGatedAction allowedRoles={['comercial']} userRoles={userRoles}>
                <FileUploadZone
                  id="signed-offer-file"
                  accept=".pdf,.doc,.docx"
                  label="Subir oferta firmada por cliente"
                  description="PDF, Word — máx. 20 MB"
                  file={signedFile}
                  onFileChange={setSignedFile}
                  onUpload={handleUploadSignedOffer}
                  uploading={action === 'signed_offer'}
                  disabled={!OFFER_SIGN_STATES.includes(status)}
                />
              </RoleGatedAction>
            )}
          </WorkflowStep>

          {/* ── Paso 3: Registro del cliente ───────────────────────────── */}
          <WorkflowStep
            stepNumber={3}
            title="Registro del cliente en el sistema"
            actor="Asesor Comercial / Backoffice"
            status={roleStepStatus(
              isClientRegistered,
              CLIENT_REG_STATES.includes(status),
              ['comercial','asesor_comercial','analista_comercial','backoffice','backoffice_comercial','acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'],
            )}
            completedAt={purchase?.client_registered_at}
          >
            {isClientRegistered ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                <FiCheckCircle className="text-operative-green shrink-0" size={18} />
                <div>
                  <p className="text-sm font-semibold text-operative-green">Cliente registrado</p>
                  <p className="text-xs text-warm-ash mt-0.5">
                    El cliente fue vinculado al sistema. El flujo puede continuar al contrato.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {alreadyRequested && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <FiAlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <p>Solicitud de registro ya enviada al backoffice comercial. En espera de confirmación.</p>
                  </div>
                )}
                <RoleGatedAction allowedRoles={['comercial', 'backoffice_comercial']} userRoles={userRoles}>
                  <button
                    type="button"
                    onClick={() => setShowRegModal(true)}
                    disabled={!CLIENT_REG_STATES.includes(status)}
                    className="min-h-10 inline-flex items-center gap-2 px-4 rounded-xl bg-action-blue text-white text-sm font-medium hover:bg-action-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <FiUserCheck size={15} />
                    {alreadyRequested ? 'Ver / reenviar solicitud' : 'Registrar cliente'}
                  </button>
                </RoleGatedAction>
              </div>
            )}
          </WorkflowStep>

          {/* ── Paso 4: Solicitar inspección de ambiente ────────────────── */}
          {!inspByBc && (
            <WorkflowStep
              stepNumber={4}
              title="Solicitar inspección de ambiente"
              actor="Asesor Comercial / Backoffice"
              status={roleStepStatus(
                inspDone,
                isClientRegistered && status === 'client_registered',
                ['comercial','asesor_comercial','analista_comercial',
                 'backoffice','backoffice_comercial',
                 'acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'],
              )}
              completedAt={purchase?.inspection_requested_at}
            >
              <RoleGatedAction
                allowedRoles={['comercial','asesor_comercial','analista_comercial','backoffice','backoffice_comercial']}
                userRoles={userRoles}
              >
                {inspDone ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                      <FiCheckCircle className="text-operative-green shrink-0" size={18} />
                      <div>
                        <p className="text-sm font-semibold text-operative-green">Inspección solicitada — F.ST-20 generado</p>
                        <p className="text-xs text-warm-ash mt-0.5">
                          El Jefe Técnico recibirá la solicitud y planificará la visita de ambiente.
                        </p>
                      </div>
                    </div>
                    {purchase?.inspection_acta_document_id && (
                      <a
                        href={`https://drive.google.com/file/d/${purchase.inspection_acta_document_id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-action-blue hover:underline font-medium"
                      >
                        <FiExternalLink size={12} />
                        Ver F.ST-20 — Solicitud de inspección de ambiente
                      </a>
                    )}
                  </div>
                ) : !isClientRegistered ? (
                  <p className="text-xs text-amber-600 flex items-center gap-1.5">
                    <FiAlertTriangle size={12} />
                    Disponible después de registrar el cliente en el sistema.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-warm-ash">
                      Define la ventana de disponibilidad para que el Jefe Técnico programe la visita.
                    </p>
                    {/* Ventana de fechas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-slate">
                          Fecha mínima <span className="text-warm-ash font-normal">(opcional)</span>
                        </span>
                        <input
                          type="date"
                          value={inspMinDate}
                          onChange={(e) => setInspMinDate(e.target.value)}
                          className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-slate">
                          Fecha máxima <span className="text-warm-ash font-normal">(opcional)</span>
                        </span>
                        <input
                          type="date"
                          value={inspMaxDate}
                          onChange={(e) => setInspMaxDate(e.target.value)}
                          min={inspMinDate || undefined}
                          className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                        />
                      </label>
                    </div>

                    {/* Accesorios y observaciones — se incluyen en el F.ST-20 */}
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-ink-slate">
                        Accesorios / extras requeridos{' '}
                        <span className="text-warm-ash font-normal">(opcional)</span>
                      </span>
                      <input
                        type="text"
                        value={inspAccesorios}
                        onChange={(e) => setInspAccesorios(e.target.value)}
                        placeholder="Ej: cables de red, rack, UPS…"
                        className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-ink-slate">
                        Observaciones para el técnico{' '}
                        <span className="text-warm-ash font-normal">(opcional)</span>
                      </span>
                      <textarea
                        value={inspObservaciones}
                        onChange={(e) => setInspObservaciones(e.target.value)}
                        placeholder="Indicaciones de acceso, condiciones del sitio, restricciones de horario…"
                        rows={3}
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleRequestInspection}
                      disabled={action === 'request_inspection'}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action-blue text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors active:scale-[0.97]"
                    >
                      {action === 'request_inspection'
                        ? <FiLoader className="animate-spin" size={14} />
                        : <FiCalendar size={14} />}
                      {action === 'request_inspection' ? 'Solicitando…' : 'Solicitar inspección'}
                    </button>
                  </div>
                )}
              </RoleGatedAction>
            </WorkflowStep>
          )}

          {/* ── Acciones del flujo (condicionales, sin número de paso) ─── */}
          <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
            <h3 className="text-sm font-semibold text-ink-slate mb-4">Acciones del flujo</h3>
            <div className="flex flex-wrap gap-2">

              {/* backoffice_comercial → reenviar a ACP */}
              <RoleGatedAction allowedRoles={['backoffice_comercial']} userRoles={userRoles}>
                <button
                  type="button"
                  onClick={handleForwardToAcp}
                  disabled={action === 'forward_acp' || status !== 'pending_backoffice'}
                  className="min-h-11 inline-flex items-center gap-2 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-ink-slate hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition cursor-pointer"
                >
                  {action === 'forward_acp' ? <FiLoader className="animate-spin" size={15} /> : <FiSend size={15} />}
                  Solicitar disponibilidad ACP
                </button>
              </RoleGatedAction>

              {/* comercial → rechazar oferta */}
              <RoleGatedAction allowedRoles={['comercial']} userRoles={userRoles}>
                <button
                  type="button"
                  onClick={handleRejectOffer}
                  disabled={action === 'reject_offer' || !OFFER_SIGN_STATES.includes(status)}
                  className="min-h-11 inline-flex items-center gap-2 px-4 rounded-xl border border-red-200 bg-red-50 text-sm font-medium text-red-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition cursor-pointer"
                >
                  <FiXCircle size={15} />
                  Rechazar oferta
                </button>
              </RoleGatedAction>

              {/* jefe_comercial + jefe_de_comercial → aceptar rechazo */}
              <RoleGatedAction allowedRoles={['jefe_comercial', 'jefe_de_comercial']} userRoles={userRoles}>
                <button
                  type="button"
                  onClick={handleAcceptReject}
                  disabled={action === 'accept_reject' || !PRICE_IMPROVE_STATES.includes(status)}
                  className="min-h-11 inline-flex items-center gap-2 px-4 rounded-xl border border-red-200 bg-white text-sm font-medium text-red-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition cursor-pointer"
                >
                  {action === 'accept_reject' ? <FiLoader className="animate-spin" size={14} /> : <FiXCircle size={15} />}
                  Aceptar rechazo
                </button>
              </RoleGatedAction>

              {/* jefe_comercial + jefe_de_comercial → solicitar mejora */}
              <RoleGatedAction allowedRoles={['jefe_comercial', 'jefe_de_comercial']} userRoles={userRoles}>
                <button
                  type="button"
                  onClick={handleRequestImprovement}
                  disabled={action === 'price_improvement' || !PRICE_IMPROVE_STATES.includes(status)}
                  className="min-h-11 inline-flex items-center gap-2 px-4 rounded-xl border border-amber-200 bg-amber-50 text-sm font-medium text-amber-800 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition cursor-pointer"
                >
                  {action === 'price_improvement' ? <FiLoader className="animate-spin" size={14} /> : null}
                  Solicitar mejora de precio
                </button>
              </RoleGatedAction>

            </div>
          </div>
        </div>
      </div>

      {/* Modal de registro — portal, fuera del stacking context de motion.div */}
      {showRegModal && (
        <ClientRegistrationModal
          purchase={purchase}
          onClose={() => setShowRegModal(false)}
          onSuccess={async () => {
            // El formulario creó la solicitud de cliente. Ahora transicionamos
            // el estado de la compra privada a client_registration_requested
            // para notificar a backoffice y avanzar el flujo.
            try {
              await requestClientRegistration(purchase.id);
            } catch {
              // Si ya estaba en ese estado o falla silenciosamente, solo refrescamos
            }
            setShowRegModal(false);
            await refresh();
          }}
        />
      )}
    </>
  );
};

export default PrivateFlowTab;
