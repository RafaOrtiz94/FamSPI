import React, { useState } from 'react';
import RoleGatedAction from '../../components/RoleGatedAction';
import TabBadge from '../../components/TabBadge';
import BlockerAlert from '../../components/BlockerAlert';
import WorkflowStep from '../../components/WorkflowStep';
import FileUploadZone from '../../../../../core/ui/components/FileUploadZone';
import { getEquipmentPurchaseApiError, uploadContract } from '../../../../../core/api/equipmentPurchasesApi';
import {
  uploadPrivatePurchaseClientSignedContract,
  uploadPrivatePurchaseContract,
  markPrivatePurchaseProviderContractReceived,
  uploadPrivatePurchaseProviderSignedContract,
  registerPrivatePurchaseManagerContractDecision,
  uploadPrivatePurchaseAcpSignedContract,
  restartPrivatePurchaseContractAfterRejection,
} from '../../../../../core/api/privatePurchasesApi';

// Estados en que el tab de contrato está habilitado para compras privadas.
// Se incluyen los estados de preparación del contrato (inspection y client_registered)
// además de los estados propios del flujo de firmas.
const PRIVATE_CONTRACT_STATES = [
  'client_registered',                   // BC-comodato: contrato preparado tras registro
  'inspection_requested',                // camino normal: backoffice prepara draft mientras técnico inspecciona
  'inspection_coordinated',              // técnico coordinó, backoffice puede subir draft
  'pending_contract_approval',
  'pending_contract_client_signature',
  'contract_available',
  'contract_rejected',
];

const fileToBase64Payload = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    const payload = result.includes(',') ? result.split(',')[1] : result;
    if (!payload?.trim()) reject(new Error('El archivo esta vacio o no se pudo procesar'));
    else resolve(payload);
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const driveLink = (id) => (id ? `https://drive.google.com/file/d/${id}/view` : null);

const ContractTab = ({ purchase, type, userRoles, refresh }) => {
  const [loading, setLoading] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [gerenciaDecisionLoading, setGerenciaDecisionLoading] = useState(false);
  const [acpSignedLoading, setAcpSignedLoading] = useState(false);
  const [restartLoading, setRestartLoading] = useState(false);
  const [providerMarkLoading, setProviderMarkLoading] = useState(false);
  const [providerUploadLoading, setProviderUploadLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [clientSignedFile, setClientSignedFile] = useState(null);
  const [acpSignedFile, setAcpSignedFile] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [providerContractFile, setProviderContractFile] = useState(null);

  const isPurchasePublic = purchase?.purchase_type === 'public' || type === 'public';
  const isPurchasePrivate = purchase?.purchase_type === 'private' || type === 'private';
  const hasRole = (token) => userRoles.some((role) => role === token || role.includes(token));

  const canBackofficeDraft = hasRole('backoffice_comercial');
  const canCommercialClientSign = hasRole('comercial');
  const linkedBusinessCaseId = purchase?.extra?.auto_business_case_id || purchase?.business_case_id || null;
  const privateInspectionHandledByBusinessCase =
    isPurchasePrivate &&
    String(purchase?.offer_kind || '').toLowerCase() === 'comodato' &&
    Boolean(linkedBusinessCaseId);
  // Nueva precondición: proforma firmada por el proveedor cargada en AvailabilityTab
  const signedProformaUploaded = Boolean(purchase?.extra?.proforma_signed_file_id);

  const canUploadPrivateDraft =
    isPurchasePrivate &&
    signedProformaUploaded &&
    (purchase?.status === 'inspection_requested' || (privateInspectionHandledByBusinessCase && purchase?.status === 'client_registered')) &&
    canBackofficeDraft &&
    !purchase?.contract_document_id;

  // Gerencia — solo puede aprobar/rechazar (sin subir archivo)
  const canGerenciaDecide  = userRoles.some((r) =>
    ['gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'].includes(r)
  );
  // ACP — sube el contrato firmado tras la aprobación de gerencia
  const canAcpUploadSigned = userRoles.some((r) =>
    ['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'].includes(r)
  );

  // Decisión de gerencia sobre el contrato
  const gerenciaDecision = purchase?.manager_contract_decision || null; // 'approved' | 'rejected' | null

  // El tab se habilita para todos los estados en PRIVATE_CONTRACT_STATES (ya incluye client_registered, inspection_*)
  const isEnabled = isPurchasePublic
    ? purchase?.public_portal_outcome === 'won'
    : PRIVATE_CONTRACT_STATES.includes(purchase?.status);

  const contractLink = purchase?.contract_file_link || driveLink(purchase?.contract_document_id);
  const clientContractLink = driveLink(purchase?.contract_client_signed_document_id);
  const managerContractLink = driveLink(purchase?.contract_signed_document_id);

  // Contrato del proveedor
  const providerContractReceived  = Boolean(purchase?.provider_contract_received_at);
  const providerContractLink      = driveLink(purchase?.provider_contract_document_id);
  const canAcpProviderContract    = userRoles.some((r) =>
    ['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'].includes(r)
  );

  const blockerMessage = (() => {
    if (isPurchasePublic && purchase?.public_portal_outcome !== 'won') {
      return 'El contrato se habilita cuando el proceso público está ganado.';
    }
    if (isPurchasePrivate && !PRIVATE_CONTRACT_STATES.includes(purchase?.status)) {
      // Estado previo al registro de cliente — aún no corresponde gestionar el contrato
      return 'El contrato se habilita una vez que el cliente esté registrado en el sistema y la proforma firmada.';
    }
    if (isPurchasePrivate && !signedProformaUploaded && !purchase?.contract_document_id) {
      return 'Gerencia o ACP deben firmar y subir la proforma antes de gestionar el contrato.';
    }
    return null;
  })();

  const uploadErrorMessage = (err, fallback) => (
    err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback
  );

  /** roleStepStatus — mismo patrón que los otros tabs */
  const roleStepStatus = (done, active, ownerRoles) => {
    if (done) return 'completed';
    const isMyStep = Array.isArray(ownerRoles) && userRoles.some((r) => ownerRoles.includes(r));
    if (isMyStep) return active ? 'active' : 'pending';
    return active ? 'waiting' : 'pending';
  };

  const handleRestartContract = async () => {
    setRestartLoading(true);
    setError(null);
    try {
      await restartPrivatePurchaseContractAfterRejection(purchase.id);
      await refresh();
    } catch (err) {
      setError(uploadErrorMessage(err, 'No se pudo reiniciar el contrato'));
    } finally {
      setRestartLoading(false);
    }
  };

  const handleMarkProviderContractReceived = async () => {
    setProviderMarkLoading(true);
    setError(null);
    try {
      await markPrivatePurchaseProviderContractReceived(purchase.id);
      await refresh();
    } catch (err) {
      setError(uploadErrorMessage(err, 'No se pudo registrar la recepción del contrato del proveedor'));
    } finally {
      setProviderMarkLoading(false);
    }
  };

  const handleUploadProviderContract = async () => {
    if (!providerContractFile) return;
    setProviderUploadLoading(true);
    setError(null);
    try {
      const payload = await fileToBase64Payload(providerContractFile);
      await uploadPrivatePurchaseProviderSignedContract(purchase.id, {
        contractBase64: payload,
        fileName: providerContractFile.name,
        mimeType: providerContractFile.type || 'application/pdf',
      });
      setProviderContractFile(null);
      await refresh();
    } catch (err) {
      setError(uploadErrorMessage(err, 'No se pudo subir el contrato firmado del proveedor'));
    } finally {
      setProviderUploadLoading(false);
    }
  };

  const handleUploadContract = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    try {
      if (isPurchasePrivate) {
        const payload = await fileToBase64Payload(selectedFile);
        await uploadPrivatePurchaseContract(purchase.id, {
          contract_base64: payload,
          file_name: selectedFile.name,
          mime_type: selectedFile.type || 'application/pdf',
        });
      } else {
        await uploadContract(purchase.id, selectedFile, {
          expected_updated_at: purchase.updated_at,
        });
      }
      setSelectedFile(null);
      await refresh();
    } catch (err) {
      setError(isPurchasePrivate ? uploadErrorMessage(err, 'No se pudo subir el contrato') : getEquipmentPurchaseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGerenciaDecision = async (decision) => {
    setGerenciaDecisionLoading(true);
    setError(null);
    try {
      await registerPrivatePurchaseManagerContractDecision(purchase.id, {
        decision,
        reason: rejectionReason || '',
      });
      setRejectionReason('');
      await refresh();
    } catch (err) {
      setError(uploadErrorMessage(err, `No se pudo registrar la decisión de gerencia`));
    } finally {
      setGerenciaDecisionLoading(false);
    }
  };

  const handleUploadAcpSignedContract = async () => {
    if (!acpSignedFile) return;
    setAcpSignedLoading(true);
    setError(null);
    try {
      const payload = await fileToBase64Payload(acpSignedFile);
      await uploadPrivatePurchaseAcpSignedContract(purchase.id, {
        contractBase64: payload,
        fileName: acpSignedFile.name,
        mimeType: acpSignedFile.type || 'application/pdf',
      });
      setAcpSignedFile(null);
      await refresh();
    } catch (err) {
      setError(uploadErrorMessage(err, 'No se pudo subir el contrato firmado por ACP'));
    } finally {
      setAcpSignedLoading(false);
    }
  };

  const handleUploadClientSignedContract = async () => {
    if (!clientSignedFile) return;
    setClientLoading(true);
    setError(null);
    try {
      const payload = await fileToBase64Payload(clientSignedFile);
      await uploadPrivatePurchaseClientSignedContract(purchase.id, {
        contract_base64: payload,
        file_name: clientSignedFile.name,
        mime_type: clientSignedFile.type || 'application/pdf',
      });
      setClientSignedFile(null);
      await refresh();
    } catch (err) {
      setError(uploadErrorMessage(err, 'No se pudo subir el contrato firmado por cliente'));
    } finally {
      setClientLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">Contrato</h2>
          <p className="text-xs text-warm-ash mt-0.5">Documentacion, adjuntos y firmas</p>
        </div>
        <TabBadge status={isEnabled ? (contractLink ? 'completado' : 'pendiente') : 'bloqueado'} />
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {!isEnabled && blockerMessage && <BlockerAlert message={blockerMessage} />}

        {isEnabled && isPurchasePrivate && (
          <>
            {/* ── Banner de rechazo de gerencia ── */}
            {purchase?.status === 'contract_rejected' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-red-500 text-xl mt-0.5">✗</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800">Contrato rechazado por gerencia</p>
                    {purchase?.manager_contract_decision_reason && (
                      <p className="text-xs text-red-700 mt-1">
                        <span className="font-medium">Motivo:</span> {purchase.manager_contract_decision_reason}
                      </p>
                    )}
                    <p className="text-xs text-red-600 mt-1">
                      Backoffice o comercial deben preparar un nuevo contrato borrador. Se reiniciará el flujo
                      completo de firmas.
                    </p>
                  </div>
                </div>
                <RoleGatedAction
                  allowedRoles={['backoffice_comercial', 'comercial', 'asesor_comercial', 'analista_comercial',
                    'jefe_comercial', 'jefe_de_comercial', 'gerencia', 'gerencia_general', 'acp_comercial']}
                  userRoles={userRoles}
                >
                  <button
                    onClick={handleRestartContract}
                    disabled={restartLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-red-700 transition-colors"
                  >
                    {restartLoading ? 'Reiniciando…' : '↩ Preparar nuevo contrato borrador'}
                  </button>
                </RoleGatedAction>
              </div>
            )}

            {/* ── Paso 1: Backoffice genera el contrato borrador ───── */}
            <WorkflowStep
              stepNumber={1}
              title="Generar contrato y enviar a comercial"
              actor="Backoffice Comercial"
              status={roleStepStatus(
                Boolean(contractLink),
                signedProformaUploaded && !contractLink,
                ['backoffice_comercial','jefe_comercial','jefe_de_comercial','gerencia','gerencia_general'],
              )}
              completedAt={purchase?.contract_uploaded_at || undefined}
            >
              {/* Backoffice y gerencia: zona de subida completa */}
              <RoleGatedAction
                allowedRoles={['backoffice_comercial', 'jefe_comercial', 'jefe_de_comercial', 'gerencia', 'gerencia_general']}
                userRoles={userRoles}
              >
                <FileUploadZone
                  id="contract-draft-file"
                  accept=".pdf,.doc,.docx"
                  label="Subir contrato borrador"
                  description="PDF, Word — máx. 20 MB"
                  file={selectedFile}
                  onFileChange={setSelectedFile}
                  onUpload={handleUploadContract}
                  uploading={loading}
                  disabled={!canUploadPrivateDraft && !contractLink}
                  uploadedLink={contractLink || null}
                  uploadedLabel="Contrato borrador cargado"
                  errorMessage={
                    !contractLink && !canUploadPrivateDraft && !signedProformaUploaded
                      ? 'Debes esperar a que ACP suba la proforma firmada por el proveedor.'
                      : undefined
                  }
                />
              </RoleGatedAction>

              {/* Comercial: solo puede ver el link para bajarse el borrador y hacerlo firmar */}
              <RoleGatedAction
                allowedRoles={['comercial', 'asesor_comercial', 'analista_comercial', 'backoffice', 'acp_comercial']}
                userRoles={userRoles}
              >
                {contractLink ? (
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <span className="text-emerald-600 text-base">📄</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-emerald-800">Contrato borrador disponible</p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Descárgalo, obtén la firma del cliente y súbelo en el paso siguiente.
                      </p>
                    </div>
                    <a
                      href={contractLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
                    >
                      Descargar ↗
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-warm-ash italic">
                    Backoffice aún no ha generado el contrato borrador.
                  </p>
                )}
              </RoleGatedAction>
            </WorkflowStep>

            {/* ── Paso 2: Comercial sube contrato firmado por el cliente ── */}
            <WorkflowStep
              stepNumber={2}
              title="Contrato firmado por el cliente"
              actor="Asesor Comercial"
              status={roleStepStatus(
                Boolean(clientContractLink),
                Boolean(contractLink) && purchase?.status === 'pending_contract_client_signature',
                ['comercial','asesor_comercial','analista_comercial'],
              )}
              completedAt={purchase?.contract_client_signed_uploaded_at || undefined}
            >
              <RoleGatedAction allowedRoles={['comercial', 'asesor_comercial', 'analista_comercial']} userRoles={userRoles}>
                <FileUploadZone
                  id="client-contract-file"
                  accept=".pdf,.doc,.docx"
                  label="Subir contrato firmado por cliente"
                  description="PDF, Word — máx. 20 MB"
                  file={clientSignedFile}
                  onFileChange={setClientSignedFile}
                  onUpload={handleUploadClientSignedContract}
                  uploading={clientLoading}
                  disabled={purchase?.status !== 'pending_contract_client_signature' || !canCommercialClientSign}
                  uploadedLink={clientContractLink || null}
                  uploadedLabel="Contrato firmado por cliente"
                  errorMessage={
                    !clientContractLink && purchase?.status !== 'pending_contract_client_signature'
                      ? 'Disponible cuando backoffice haya generado el contrato borrador.'
                      : undefined
                  }
                />
              </RoleGatedAction>
            </WorkflowStep>

            {/* ── Paso 3: Gerencia aprueba o rechaza ── */}
            <WorkflowStep
              stepNumber={3}
              title="Revisión y aprobación de gerencia"
              actor="Gerencia General"
              status={roleStepStatus(
                Boolean(gerenciaDecision),
                Boolean(clientContractLink) && purchase?.status === 'pending_contract_approval' && !gerenciaDecision,
                ['gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'],
              )}
              completedAt={purchase?.manager_contract_decision_at || undefined}
            >
              <RoleGatedAction
                allowedRoles={['gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial']}
                userRoles={userRoles}
              >
                {gerenciaDecision === 'approved' ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="text-base">✓</span>
                    <span>Contrato aprobado por gerencia — ACP puede subir el firmado.</span>
                  </div>
                ) : gerenciaDecision === 'rejected' ? (
                  <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <span className="text-base">✗</span>
                    <span>Contrato rechazado por gerencia.{purchase?.manager_contract_decision_reason ? ` Motivo: ${purchase.manager_contract_decision_reason}` : ''}</span>
                  </div>
                ) : purchase?.status === 'pending_contract_approval' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-warm-ash">
                      Revisa el contrato borrador y el contrato firmado por el cliente antes de decidir.
                    </p>
                    {clientContractLink && (
                      <a href={clientContractLink} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        Ver contrato firmado por el cliente ↗
                      </a>
                    )}
                    <div className="space-y-2">
                      <label className="block text-xs text-warm-ash font-medium">
                        Motivo del rechazo (obligatorio si rechaza, opcional si aprueba)
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={2}
                        placeholder="Escribe el motivo aquí…"
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGerenciaDecision('approved')}
                        disabled={gerenciaDecisionLoading || !canGerenciaDecide}
                        className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-emerald-700 transition-colors"
                      >
                        {gerenciaDecisionLoading ? 'Registrando…' : '✓ Aprobar contrato'}
                      </button>
                      <button
                        onClick={() => handleGerenciaDecision('rejected')}
                        disabled={gerenciaDecisionLoading || !rejectionReason.trim() || !canGerenciaDecide}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-red-700 transition-colors"
                      >
                        {gerenciaDecisionLoading ? 'Registrando…' : '✗ Rechazar contrato'}
                      </button>
                    </div>
                    {!rejectionReason.trim() && (
                      <p className="text-xs text-warm-ash italic">El botón de rechazo se activa cuando escribes el motivo.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-warm-ash">Disponible cuando el cliente haya firmado el contrato.</p>
                )}
              </RoleGatedAction>
            </WorkflowStep>

            {/* ── Paso 4: ACP sube el contrato firmado ── */}
            <WorkflowStep
              stepNumber={4}
              title="Contrato firmado — subida por ACP"
              actor="ACP Comercial"
              status={roleStepStatus(
                Boolean(managerContractLink),
                gerenciaDecision === 'approved' && !managerContractLink,
                ['acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'],
              )}
              completedAt={purchase?.contract_signed_uploaded_at || undefined}
            >
              <RoleGatedAction
                allowedRoles={['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial']}
                userRoles={userRoles}
              >
                <FileUploadZone
                  id="acp-signed-contract-file"
                  accept=".pdf,.doc,.docx"
                  label="Subir contrato firmado"
                  description="PDF, Word — máx. 20 MB"
                  file={acpSignedFile}
                  onFileChange={setAcpSignedFile}
                  onUpload={handleUploadAcpSignedContract}
                  uploading={acpSignedLoading}
                  disabled={gerenciaDecision !== 'approved' && !managerContractLink}
                  uploadedLink={managerContractLink || null}
                  uploadedLabel="Contrato firmado cargado"
                  errorMessage={
                    !managerContractLink && gerenciaDecision !== 'approved'
                      ? 'Disponible cuando gerencia apruebe el contrato.'
                      : undefined
                  }
                />
              </RoleGatedAction>
            </WorkflowStep>

            {/* ─────────────────────────────────────────────────────────────
                Contrato con el proveedor (paralelo al flujo del cliente)
            ───────────────────────────────────────────────────────────── */}
            <div className="mt-2 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-warm-ash uppercase tracking-wide mb-3 px-1">
                Contrato con el proveedor
              </p>

              {/* Paso P-1: ACP avisa que llegó el contrato del proveedor */}
              <WorkflowStep
                stepNumber="P-1"
                title="Contrato del proveedor recibido"
                actor="ACP Comercial"
                status={roleStepStatus(
                  providerContractReceived,
                  !providerContractReceived,
                  ['acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'],
                )}
                completedAt={purchase?.provider_contract_received_at || undefined}
              >
                <RoleGatedAction
                  allowedRoles={['acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial']}
                  userRoles={userRoles}
                >
                  {providerContractReceived ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <span className="text-base">✓</span>
                      <span>Contrato del proveedor marcado como recibido.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-warm-ash">
                        Cuando el proveedor envíe el contrato físicamente, avisa al sistema para habilitar la subida.
                      </p>
                      <button
                        onClick={handleMarkProviderContractReceived}
                        disabled={providerMarkLoading || !canAcpProviderContract}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
                      >
                        {providerMarkLoading ? 'Registrando…' : 'Marcar contrato del proveedor como recibido'}
                      </button>
                    </div>
                  )}
                </RoleGatedAction>
              </WorkflowStep>

              {/* Paso P-2: ACP sube el contrato del proveedor firmado */}
              <WorkflowStep
                stepNumber="P-2"
                title="Subir contrato del proveedor firmado"
                actor="ACP Comercial"
                status={roleStepStatus(
                  Boolean(providerContractLink),
                  providerContractReceived && !providerContractLink,
                  ['acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'],
                )}
                completedAt={purchase?.provider_contract_uploaded_at || undefined}
              >
                <RoleGatedAction
                  allowedRoles={['acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial']}
                  userRoles={userRoles}
                >
                  <FileUploadZone
                    id="provider-contract-file"
                    accept=".pdf,.doc,.docx"
                    label="Subir contrato del proveedor firmado"
                    description="PDF, Word — máx. 20 MB"
                    file={providerContractFile}
                    onFileChange={setProviderContractFile}
                    onUpload={handleUploadProviderContract}
                    uploading={providerUploadLoading}
                    disabled={!providerContractReceived && !providerContractLink}
                    uploadedLink={providerContractLink || null}
                    uploadedLabel="Contrato del proveedor cargado"
                    errorMessage={
                      !providerContractLink && !providerContractReceived
                        ? 'Marca primero que el contrato del proveedor ha llegado.'
                        : undefined
                    }
                  />
                </RoleGatedAction>
              </WorkflowStep>
            </div>
          </>
        )}

        {isEnabled && !isPurchasePrivate && (
          <>
            {/* ── Públicas: contrato preparado por la empresa + firma vía portal ── */}
            <WorkflowStep
              stepNumber={1}
              title="Contrato preparado y firmado por la empresa"
              actor="Jefe Comercial / Backoffice"
              status={roleStepStatus(
                Boolean(contractLink),
                true,
                ['jefe_comercial','jefe_de_comercial','backoffice_comercial','gerencia','gerencia_general'],
              )}
              completedAt={purchase?.contract_signed_uploaded_at || undefined}
            >
              <RoleGatedAction
                allowedRoles={['jefe_comercial', 'backoffice_comercial', 'gerencia', 'gerencia_general']}
                userRoles={userRoles}
              >
                <FileUploadZone
                  id="contract-file"
                  accept=".pdf,.doc,.docx"
                  label="Subir contrato"
                  description="PDF, Word — máx. 20 MB"
                  file={selectedFile}
                  onFileChange={setSelectedFile}
                  onUpload={handleUploadContract}
                  uploading={loading}
                  uploadedLink={contractLink || null}
                  uploadedLabel="Contrato cargado"
                />
              </RoleGatedAction>
            </WorkflowStep>

            <WorkflowStep
              stepNumber={2}
              title="Contrato firmado por el cliente"
              actor="Portal de contratación pública"
              status={roleStepStatus(Boolean(clientContractLink), Boolean(contractLink), [])}
              completedAt={purchase?.contract_client_signed_uploaded_at || undefined}
            >
              <div className="bg-paper-white rounded-lg p-4 text-center">
                <div className="text-xs text-warm-ash">La firma del cliente en procesos públicos se gestiona a través del portal de contratación pública.</div>
              </div>
            </WorkflowStep>
          </>
        )}
      </div>
    </div>
  );
};

export default ContractTab;
