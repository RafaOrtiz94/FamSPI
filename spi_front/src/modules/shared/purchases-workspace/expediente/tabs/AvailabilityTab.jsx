import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
  FiMail,
  FiClipboard,
  FiPackage,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiUserCheck,
  FiXCircle,
  FiAlertTriangle,
  FiShield,
  FiArrowRight,
  FiInfo,
  FiFileText,
  FiClock,
  FiLock,
  FiExternalLink,
} from 'react-icons/fi';
import RoleGatedAction from '../../components/RoleGatedAction';
import TabBadge from '../../components/TabBadge';
import WorkflowStep from '../../components/WorkflowStep';
import FileUploadZone from '../../../../../core/ui/components/FileUploadZone';
import { promptDialog } from '../../../../../core/ui/utils/promptDialog';
import { useProviderEmails } from '../../hooks/useProviderEmails';
import { useProviderEmailGroups } from '../../hooks/useProviderEmailGroups';
import ProviderEmailChipsInput from '../../components/ProviderEmailChipsInput';
import {
  saveProviderResponse,
  setAvailability,
  startAvailability,
  confirmCuAvailability,
  confirmAcpImportAwareness,
  getEquipmentPurchaseApiError,
  getEquipmentPurchaseActiveReservations,
} from '../../../../../core/api/equipmentPurchasesApi';
import {
  transitionPrivatePurchaseState,
  savePrivatePurchaseProviderResponse,
  registerPrivatePurchaseProviderDeliveryDate,
  startPrivatePurchaseAvailability,
  confirmPrivateCuAvailability,
  confirmPrivateImportApproval,
  renewPrivatePurchaseReservation,
  uploadPrivatePurchaseProforma,
  requestPrivatePurchaseProforma,
  uploadPrivatePurchaseSignedProforma,
  getPrivatePurchaseActiveReservations,
} from '../../../../../core/api/privatePurchasesApi';
import { getEquiposDisponibles } from '../../../../../core/api/inventarioApi';
import ReservationsOverviewModal from '../components/ReservationsOverviewModal';

/* ─── Utility: File → base64 ──────────────────────────────────────────── */
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result?.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/* ─── Tipos solicitados por el cliente (en creación) ──────────────────── */
const REQUESTED_TYPE_CFG = {
  new:        { label: 'Nuevo',              cls: 'bg-green-soft text-operative-green border-green-200' },
  cu:         { label: 'CU',                 cls: 'bg-amber-soft text-caution-amber border-amber-200'  },
  import_new: { label: 'Nuevo vía importación', cls: 'bg-red-50 text-alert-red border-red-200'         },
};

/* ─── Análisis de discrepancia solicitud vs respuesta ─────────────────── */
function analyzeMismatch(requestedTypes = [], responseOutcome) {
  const dominant = requestedTypes[0] || 'new';

  // Solicitó NUEVO → proveedor dice CU
  if (responseOutcome === 'cu_only' && dominant === 'new') {
    return {
      kind: 'downgrade',
      color: 'amber',
      title: 'El cliente solicitó equipo nuevo, el proveedor solo tiene CU',
      detail: 'Al registrar esta respuesta el sistema derivará la decisión al asesor comercial, quien confirmará con el cliente si acepta condición de uso.',
    };
  }
  // Solicitó CU → proveedor dice NUEVO (más caro)
  if (responseOutcome === 'new' && dominant === 'cu') {
    return {
      kind: 'upgrade',
      color: 'blue',
      title: 'El cliente solicitó CU pero el proveedor tiene nuevo disponible',
      detail: 'El precio será mayor. Al registrar esta respuesta, el sistema derivará la decisión al asesor comercial, quien confirmará con el cliente si acepta el equipo nuevo (precio mayor) o si se cancela el proceso.',
    };
  }
  // Solicitó CU o Nuevo → proveedor dice IMPORTACIÓN
  if (responseOutcome === 'import_new' && (dominant === 'cu' || dominant === 'new')) {
    return {
      kind: 'import',
      color: 'red',
      title: `El cliente solicitó ${dominant === 'cu' ? 'CU' : 'nuevo disponible'}, el proveedor solo puede proveer vía importación`,
      detail: 'La importación es irreversible. El asesor comercial deberá confirmar el compromiso del cliente antes de proceder.',
    };
  }
  return null;
}

const AVAILABILITY_STATUSES = {
  not_checked:                      { label: 'No consultado',                         variant: 'neutral' },
  internal_available_ready:         { label: 'Disponible interno',                    variant: 'green'  },
  supplier_requested:               { label: 'Solicitado al proveedor',               variant: 'amber'  },
  supplier_confirmed:               { label: 'Confirmado por proveedor',              variant: 'green'  },
  supplier_rejected:                { label: 'Rechazado por proveedor',               variant: 'red'    },
  alternative_required:             { label: 'Requiere alternativa',                  variant: 'amber'  },
  availability_confirmed:           { label: 'Disponibilidad confirmada',             variant: 'green'  },
  cu_available_pending_approval:    { label: 'CU disponible — pendiente cliente',     variant: 'amber'  },
  import_pending_acp_confirmation:  { label: 'Importación — pendiente confirmación ACP', variant: 'amber' },
};

/* Roles that can approve/reject on behalf of the client (CU decision) */
const CU_APPROVAL_ROLES = ['comercial', 'asesor_comercial', 'analista_comercial', 'acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'];

/* ─── Private purchase availability derivation ─────────────────────────────
 * private_purchase_requests doesn't have an availability_status column —
 * availability is tracked via the state machine status field.
 * We map known states to the equivalent availability_status values.
 * ─────────────────────────────────────────────────────────────────────────── */
const PRIVATE_AVAIL_STATE_MAP = {
  acp_availability_requested:      'supplier_requested',
  acp_availability_cu_pending:     'cu_available_pending_approval',
  acp_availability_import_pending: 'import_pending_acp_confirmation',
  acp_availability_confirmed:      'availability_confirmed',
  acp_availability_rejected:       'supplier_rejected',
};

// States that come BEFORE the ACP availability workflow
const PRIVATE_PRE_AVAILABILITY_STATES = new Set([
  'pending_commercial', 'pending_backoffice',
  'offer_sent', 'pending_manager_signature', 'pending_client_signature',
  'offer_signed', 'offer_rejected_by_commercial', 'price_improvement_requested',
  'client_registration_requested', 'client_registered', 'inspection_requested',
  'sent_to_acp',
  'business_case_in_progress', 'business_case_under_review',
  'business_case_feasibility_approved', 'business_case_rejected',
]);

function getPrivateAvailabilityStatus(purchase) {
  const s = purchase?.status;
  // Direct mapping for availability states (current status IS an availability state)
  if (s && PRIVATE_AVAIL_STATE_MAP[s]) return PRIVATE_AVAIL_STATE_MAP[s];
  // Bug fix: el estado de compra privada es un solo campo secuencial. Cuando
  // disponibilidad se resuelve ANTES de enviar la oferta (pending_backoffice ->
  // acp_availability_requested -> acp_availability_confirmed -> offer_sent ->
  // offer_signed), al llegar a offer_signed el status ya no es uno de
  // disponibilidad y PRIVATE_PRE_AVAILABILITY_STATES lo trata como "todavia no
  // consultado", perdiendo el hecho de que ACP ya confirmo. provider_response_at
  // es un campo persistente (se setea una vez y no se vuelve a limpiar), asi que
  // es la fuente confiable de "disponibilidad ya fue consultada", sin importar
  // que tan lejos haya avanzado el status despues.
  if (purchase?.provider_response_at) return 'availability_confirmed';
  if (!s) return null;
  // Any post-availability state (not pre-availability, not generic rejected)
  if (!PRIVATE_PRE_AVAILABILITY_STATES.has(s) && s !== 'rejected') {
    return 'availability_confirmed';
  }
  return null;
}

/* ─── tiny helper: extract normalized model tokens from purchase equipment ─── */
function extractPurchaseModels(equipment) {
  if (!Array.isArray(equipment)) return [];
  return equipment
    .map((e) => (e.model || e.name || e.equipment_name || e.label || '').toLowerCase().trim())
    .filter(Boolean);
}

/* ─── fuzzy match: does an inventory unit relate to any purchase model token? ── */
function matchesAnyModel(unit, purchaseModels) {
  if (!purchaseModels.length) return true; // no filter → show all
  const unitLabel = (unit.modelo || unit.nombre || unit.tipo || '').toLowerCase();
  return purchaseModels.some((m) => unitLabel.includes(m) || m.includes(unitLabel));
}

const AvailabilityTab = ({ purchase, type, userRoles, hasRole, refresh }) => {
  /* ── provider/response form state ───────────────────────────── */
  const [loading,          setLoading]          = useState(false);
  const [supplierLoading,  setSupplierLoading]  = useState(null);
  const [cuLoading,        setCuLoading]        = useState(null);
  const [importLoading,    setImportLoading]    = useState(null);
  const [decisionLoading,  setDecisionLoading]  = useState(null);
  const [renewLoading,     setRenewLoading]     = useState(false);
  const [providerEmail,    setProviderEmail]    = useState(purchase?.provider_email || '');
  const [providerNotes,    setProviderNotes]    = useState('');
  const [responseOutcome,  setResponseOutcome]  = useState('new');
  const [responseNotes,    setResponseNotes]    = useState('');
  const [error,            setError]            = useState(null);

  /* ── Fecha tentativa de entrega del proveedor (privado) ───────── */
  const [providerDeliveryDateDraft,  setProviderDeliveryDateDraft]  = useState('');
  const [providerDeliveryNotesDraft, setProviderDeliveryNotesDraft] = useState('');
  const [providerDeliveryLoading,    setProviderDeliveryLoading]    = useState(false);

  /* ── Paso solicitar proforma al proveedor ─────────────────── */
  const [proformaRequestNotes,  setProformaRequestNotes]  = useState('');
  const [proformaRequestLoading, setProformaRequestLoading] = useState(false);

  /* ── Paso proforma sin firmar + Reserva ───────────────────── */
  const [proformaFile,          setProformaFile]          = useState(null);
  const [proformaLoading,       setProformaLoading]       = useState(false);
  const [importReserveChecked,  setImportReserveChecked]  = useState(false);

  /* ── Paso proforma firmada ────────────────────────────────── */
  const [signedProformaFile,    setSignedProformaFile]    = useState(null);
  const [signedProformaLoading, setSignedProformaLoading] = useState(false);

  /* ── Paso 5: Panel de reservas activas ──────────────────────── */
  const [reservationsModalOpen, setReservationsModalOpen] = useState(false);

  /* ── provider email registry ─────────────────────────────── */
  const { emails: savedEmails, save: saveEmail } = useProviderEmails();
  const { groups: emailGroups, save: saveEmailGroup, remove: removeEmailGroup } = useProviderEmailGroups();

  /* ── internal inventory state ───────────────────────────────── */
  const [invLoading,     setInvLoading]     = useState(false);
  const [invUnits,       setInvUnits]       = useState([]);
  const [invError,       setInvError]       = useState(null);
  const [invExpanded,    setInvExpanded]    = useState(false);

  /* ── derived ─────────────────────────────────────────────────── */
  const isPrivate = type === 'private' || purchase?.purchase_type === 'private';

  // currentStatus: for public purchases, read directly from availability_status column.
  // For private purchases, that column doesn't exist — derive from state machine status.
  const currentStatus = isPrivate
    ? (purchase?.availability_status || getPrivateAvailabilityStatus(purchase) || 'not_checked')
    : (purchase?.availability_status || 'not_checked');

  const statusInfo  = AVAILABILITY_STATUSES[currentStatus] || AVAILABILITY_STATUSES.not_checked;
  const isInternal  = purchase?.availability_source === 'internal';
  // Historial de fechas tentativas de entrega dadas por el proveedor (privado).
  const providerDeliveryHistory = Array.isArray(purchase?.provider_delivery_dates_history)
    ? purchase.provider_delivery_dates_history
    : [];
  const latestProviderDeliveryDate = providerDeliveryHistory.length
    ? providerDeliveryHistory[providerDeliveryHistory.length - 1]
    : null;
  // isSupplier: public uses availability_source; private infers from state machine
  const isSupplier  = purchase?.availability_source === 'supplier' ||
    (isPrivate && (Boolean(purchase?.provider_response_at) ||
      (!PRIVATE_PRE_AVAILABILITY_STATES.has(purchase?.status) && purchase?.status !== 'rejected')));
  // CU pending: public uses availability_status, private uses purchase.status
  const isCuPending =
    (!isPrivate && currentStatus === 'cu_available_pending_approval') ||
    (isPrivate  && purchase?.status === 'acp_availability_cu_pending');
  // Import pending states
  const isImportPendingClient = isPrivate && purchase?.status === 'acp_availability_import_pending';
  const isImportPendingAcp    = !isPrivate && currentStatus === 'import_pending_acp_confirmation';
  const equipmentItems  = Array.isArray(purchase?.equipment) ? purchase.equipment : [];
  const purchaseModels  = extractPurchaseModels(equipmentItems);
  const requestedTypes  = equipmentItems.map((e) => e.type || 'new');

  /* ── matched units (models relevant to this purchase) ─────── */
  const matchedUnits = invUnits.filter((u) => matchesAnyModel(u, purchaseModels));
  const hasInternalStock = matchedUnits.length > 0;

  /* ── fetch inventory ─────────────────────────────────────────── */
  const fetchInventory = useCallback(async () => {
    setInvLoading(true);
    setInvError(null);
    try {
      const units = await getEquiposDisponibles({ estado: 'no_asignado' });
      setInvUnits(Array.isArray(units) ? units : []);
    } catch (err) {
      setInvError('No se pudo consultar el inventario interno.');
    } finally {
      setInvLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  /* ── set availability (internal / supplier) ─────────────────── */
  const handleSetAvailability = async (source, status) => {
    if (source === purchase?.availability_source && status === currentStatus) return;
    setLoading(true);
    setError(null);
    try {
      await setAvailability(purchase.id, {
        availabilitySource: source,
        availabilityStatus: status,
        expected_updated_at: purchase.updated_at,
      });
      await refresh();
    } catch (err) {
      const errInfo = getEquipmentPurchaseApiError(err);
      setError(errInfo.message);
    } finally {
      setLoading(false);
    }
  };

  /*
   * backoffice_comercial should see the status summary only — NOT the action panels
   * (no email sending, no provider request forms).
   */
  const actionRoles = isPrivate
    ? ['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial', 'backoffice_comercial']
    : ['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'];

  /* ── supplier request / provider response ───────────────────── */
  const runSupplierAction = async (actionName, handler) => {
    setSupplierLoading(actionName);
    setError(null);
    try {
      await handler();
      await refresh();
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudo completar la acción';
      setError(message);
    } finally {
      setSupplierLoading(null);
    }
  };

  const handleRequestSupplier = () => runSupplierAction('supplier_request', async () => {
    if (!providerEmail.trim()) throw new Error('Ingresa el correo del proveedor');
    const payload = {
      provider_email: providerEmail.trim(),
      notes: providerNotes.trim(),
      expected_updated_at: purchase.updated_at,
    };
    if (isPrivate) await startPrivatePurchaseAvailability(purchase.id, payload);
    else           await startAvailability(purchase.id, payload);
  });

  const handleProviderResponse = () => runSupplierAction('provider_response', async () => {
    if (!responseNotes.trim()) throw new Error('La respuesta del proveedor es obligatoria');
    const isCuOnly      = responseOutcome === 'cu_only';
    const isUnavailable = responseOutcome === 'unavailable';
    const isImportNew   = responseOutcome === 'import_new';
    const items = equipmentItems.map((item) => ({
      id:             item.id,
      name:           item.name || item.label || item.sku || 'Equipo',
      sku:            item.sku,
      requested_type: item.type,
      available_type: isCuOnly    ? 'cu_available'    :
                      isUnavailable ? 'not_available'   :
                      isImportNew ? 'import_available' : 'new_available',
      decision:       isCuOnly    ? 'cu_only'         :
                      isUnavailable ? 'reject'          :
                      isImportNew ? 'import_new'       : 'accept',
    }));
    const payload = {
      outcome:             responseOutcome,
      notes:               responseNotes.trim(),
      items,
      expected_updated_at: purchase.updated_at,
    };
    if (isPrivate) await savePrivatePurchaseProviderResponse(purchase.id, payload);
    else           await saveProviderResponse(purchase.id, payload);
  });

  /* ── CU approval (on behalf of client) ──────────────────────── */
  const handleCuDecision = async (decision) => {
    setCuLoading(decision);
    setError(null);
    try {
      if (isPrivate) {
        await confirmPrivateCuAvailability(purchase.id, { decision });
      } else {
        await confirmCuAvailability(purchase.id, {
          decision,
          expected_updated_at: purchase.updated_at,
        });
      }
      await refresh();
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudo registrar la decisión';
      setError(message);
    } finally {
      setCuLoading(null);
    }
  };

  const canApproveCu = userRoles.some((r) => CU_APPROVAL_ROLES.includes(r));
  const canResolvePrivateAvailability = userRoles.some((r) => [
    'comercial',
    'asesor_comercial',
    'analista_comercial',
    'jefe_comercial',
    'jefe_de_comercial',
    'gerencia',
    'gerencia_general',
  ].includes(r));
  const canManagePrivateSupplierAvailability = userRoles.some((r) => [
    'acp_comercial',
    'jefe_comercial',
    'jefe_de_comercial',
    'gerencia',
    'gerencia_general',
  ].includes(r));
  const canRenewReservation = userRoles.some((r) => [
    'acp_comercial',
    'jefe_comercial',
    'jefe_de_comercial',
    'gerencia',
    'gerencia_general',
  ].includes(r));

  // Detect recent CU approval — show banner when no longer pending but decision was approve
  const cuRecentlyApproved =
    purchase?.extra?.cu_approval_decision === 'approve' && !isCuPending;

  /* ── Import approval — private (client commitment) ──────────── */
  const handleImportDecision = async (decision) => {
    setImportLoading(decision);
    setError(null);
    try {
      await confirmPrivateImportApproval(purchase.id, { decision });
      await refresh();
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudo registrar la decisión';
      setError(message);
    } finally {
      setImportLoading(null);
    }
  };

  const handleResolvePrivateAvailability = async (decision) => {
    if (!isPrivate) return;
    const targetState = decision === 'confirm'
      ? 'acp_availability_confirmed'
      : 'acp_availability_rejected';
    let reason = decision === 'confirm'
      ? 'Asesor comercial confirma con el cliente la respuesta del proveedor y autoriza continuar.'
      : '';

    if (decision === 'reject') {
      const inputReason = (await promptDialog({
        title: 'Cancelar proceso',
        message: 'El cliente rechazó la respuesta del proveedor. Motivo:',
        confirmText: 'Cancelar proceso',
      })) || '';
      if (!inputReason.trim()) {
        setError('Motivo de rechazo es obligatorio');
        return;
      }
      reason = inputReason.trim();
    }

    setDecisionLoading(decision);
    setError(null);
    try {
      await transitionPrivatePurchaseState(purchase.id, targetState, reason);
      await refresh();
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudo registrar la decisión';
      setError(message);
    } finally {
      setDecisionLoading(null);
    }
  };

  /* ── Fecha tentativa de entrega del proveedor (privado) ───────── */
  const handleRegisterProviderDeliveryDate = async () => {
    if (!isPrivate || !providerDeliveryDateDraft) return;
    setProviderDeliveryLoading(true);
    setError(null);
    try {
      await registerPrivatePurchaseProviderDeliveryDate(purchase.id, {
        date: providerDeliveryDateDraft,
        notes: providerDeliveryNotesDraft,
      });
      setProviderDeliveryDateDraft('');
      setProviderDeliveryNotesDraft('');
      await refresh();
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudo registrar la fecha tentativa de entrega';
      setError(message);
    } finally {
      setProviderDeliveryLoading(false);
    }
  };

  /* ── Import awareness — public (ACP confirms client secured) ── */
  const handleAcpImportConfirm = async () => {
    setImportLoading('acp_confirm');
    setError(null);
    try {
      await confirmAcpImportAwareness(purchase.id, {
        expected_updated_at: purchase.updated_at,
      });
      await refresh();
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudo registrar la confirmación';
      setError(message);
    } finally {
      setImportLoading(null);
    }
  };

  const handleRenewReservation = async () => {
    if (!isPrivate || !purchase?.id) return;
    setRenewLoading(true);
    setError(null);
    try {
      await renewPrivatePurchaseReservation(purchase.id);
      await refresh();
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudo renovar la reserva';
      setError(message);
    } finally {
      setRenewLoading(false);
    }
  };

  /* ── Solicitar proforma al proveedor (envía email por SPI o solo registra) ── */
  const handleRequestProforma = async (viaEmail = true) => {
    if (!isPrivate) return;
    if (viaEmail && !providerEmail.trim()) {
      setError('Ingresa el correo del proveedor');
      return;
    }
    setProformaRequestLoading(true);
    setError(null);
    try {
      await requestPrivatePurchaseProforma(purchase.id, {
        providerEmail: providerEmail.trim(),
        notes: proformaRequestNotes.trim(),
        viaEmail,
      });
      setProformaRequestNotes('');
      await refresh();
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudo solicitar la proforma';
      setError(message);
    } finally {
      setProformaRequestLoading(false);
    }
  };

  /* ── Subir proforma firmada por el proveedor ───────────────── */
  const handleUploadSignedProforma = async () => {
    if (!signedProformaFile) return;
    setSignedProformaLoading(true);
    setError(null);
    try {
      const base64 = await fileToBase64(signedProformaFile);
      await uploadPrivatePurchaseSignedProforma(purchase.id, {
        proformaBase64: base64,
        fileName: signedProformaFile.name,
        mimeType: signedProformaFile.type || 'application/pdf',
      });
      setSignedProformaFile(null);
      await refresh();
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudo subir la proforma firmada';
      setError(message);
    } finally {
      setSignedProformaLoading(false);
    }
  };

  /* ── Subir proforma sin firmar + activar reserva ───────────── */
  const handleUploadProforma = async () => {
    if (!proformaFile) return;
    setProformaLoading(true);
    setError(null);
    try {
      const base64 = await fileToBase64(proformaFile);
      await uploadPrivatePurchaseProforma(purchase.id, {
        proformaBase64: base64,
        fileName: proformaFile.name,
        mimeType: proformaFile.type || 'application/pdf',
        reserveImport: importReserveChecked,
      });
      setProformaFile(null);
      setImportReserveChecked(false);
      await refresh();
    } catch (err) {
      const message = typeof err === 'string'
        ? err
        : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudo subir la proforma';
      setError(message);
    } finally {
      setProformaLoading(false);
    }
  };

  /* ── Paso 5: Cargar todas las reservas activas ─────────────── */
  const loadReservationOverview = useCallback(async () => {
    const [privateReservations, publicReservations] = await Promise.all([
      getPrivatePurchaseActiveReservations().catch(() => []),
      getEquipmentPurchaseActiveReservations().catch(() => []),
    ]);

    const normalizedPrivate = (Array.isArray(privateReservations) ? privateReservations : []).map((item) => ({
      ...item,
      purchase_type: 'private',
      process_number: item?.process_number || null,
    }));

    return [
      ...normalizedPrivate,
      ...(Array.isArray(publicReservations) ? publicReservations : []),
    ];
  }, []);

  // Detect recently confirmed import — show banner when no longer pending but import was confirmed
  const importRecentlyConfirmed =
    (purchase?.extra?.import_is_binding === true || purchase?.extra?.import_is_confirmed_by_acp === true) &&
    !isImportPendingClient && !isImportPendingAcp;

  /* ── Paso 4 / 5 derived ──────────────────────────────────────── */
  const providerOutcome = purchase?.provider_response?.outcome;
  const isImportOutcome = providerOutcome === 'import_new';

  const proformaRequested      = Boolean(purchase?.extra?.proforma_request_sent_at);
  const proformaUploaded       = Boolean(purchase?.extra?.proforma_file_id);
  const signedProformaUploaded = Boolean(purchase?.extra?.proforma_signed_file_id);

  // La reserva se activa con el envío del email de reserva al proveedor.
  // Si el email falló (capturado silenciosamente en backend), la proforma subida es evidencia
  // suficiente de que el equipo está reservado (no-import, o import con reserveImport=true).
  const reservationEmailSent = Boolean(purchase?.reservation_email_sent_at);
  const proformaActivatesReservation =
    proformaUploaded &&
    (!isImportOutcome || Boolean(purchase?.extra?.proforma_reserve_import));
  const hasReservation = reservationEmailSent || proformaActivatesReservation;

  // Fecha de activación: email real o fecha de subida de proforma como respaldo
  const reservationActivatedAt =
    purchase?.reservation_email_sent_at || purchase?.extra?.proforma_uploaded_at || null;

  // Fecha de caducidad: del registro de BD o calculada desde proforma_uploaded_at + 15 días
  const RESERVATION_DAYS = 15;
  const reservationExpiresAt =
    purchase?.reservation_expires_at ||
    (purchase?.extra?.proforma_uploaded_at
      ? new Date(new Date(purchase.extra.proforma_uploaded_at).getTime() + RESERVATION_DAYS * 86_400_000).toISOString()
      : null);

  const reservationDaysRemaining = reservationExpiresAt
    ? Math.ceil((new Date(reservationExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const reservationExpired = reservationDaysRemaining !== null && reservationDaysRemaining <= 0;

  const canUploadProforma = userRoles.some((r) => ['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'].includes(r));

  // Step number offsets (isInternal skips Paso 2 "Registrar respuesta proveedor")
  // Confirmación con cliente
  const paso3Num = isInternal ? 2 : 3;
  // Solicitar proforma al proveedor (email)
  const pasoRequestProformaNum  = isInternal ? 3 : 4;
  // Subir proforma sin firmar (reserva automática)
  const paso4Num = isInternal ? 4 : 5;
  // Subir proforma firmada (habilita contrato)
  const pasoSignedProformaNum   = isInternal ? 5 : 6;
  // Panel de reservas

  /**
   * roleStepStatus — calcula el estado del paso según los roles del usuario.
   * Si el usuario tiene alguno de los ownerRoles → active/completed/pending normal.
   * Si no → waiting cuando ya es el turno, pending cuando aún no llega.
   */
  const roleStepStatus = (done, active, ownerRoles) => {
    if (done) return 'completed';
    const isMyStep = Array.isArray(ownerRoles) && userRoles.some((r) => ownerRoles.includes(r));
    if (isMyStep) return active ? 'active' : 'pending';
    return active ? 'waiting' : 'pending';
  };

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(date);
  };

  /* ── render ──────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">Disponibilidad</h2>
          <p className="text-xs text-warm-ash mt-0.5">Verificación de disponibilidad del equipo</p>
        </div>
        <TabBadge status={statusInfo.variant === 'green' ? 'completado' : 'pendiente'} />
      </div>

      <div className="p-6 space-y-6">
        {/* Error global */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <FiAlertCircle className="text-alert-red mt-0.5 shrink-0" size={18} />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Estado actual */}
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <h3 className="text-sm font-semibold text-ink-slate mb-4">Estado actual</h3>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              statusInfo.variant === 'green' ? 'bg-green-soft text-operative-green' :
              statusInfo.variant === 'red'   ? 'bg-red-soft text-alert-red' :
              statusInfo.variant === 'amber' ? 'bg-amber-soft text-caution-amber' :
              'bg-fog text-ink-slate'
            }`}>
              {statusInfo.label}
            </div>
            {isInternal && <span className="text-xs text-warm-ash">Origen: Equipo interno</span>}
            {isSupplier  && <span className="text-xs text-warm-ash">Origen: Proveedor</span>}
          </div>

          {/* Equipo solicitado con tipo por ítem */}
          {equipmentItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Solicitado por el cliente</p>
              <div className="space-y-2">
                {equipmentItems.map((item, idx) => {
                  const reqType = item.type || 'new';
                  const reqCfg  = REQUESTED_TYPE_CFG[reqType] || REQUESTED_TYPE_CFG.new;
                  const availType = item.available_type;
                  return (
                    <div key={item.id || idx} className="flex items-center gap-2 text-xs">
                      <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-fog text-warm-ash text-[10px] font-semibold">
                        {idx + 1}
                      </span>
                      <span className="text-ink-slate font-medium truncate flex-1">
                        {item.name || item.label || item.equipment_name || 'Equipo'}
                      </span>
                      {item.quantity && (
                        <span className="text-warm-ash shrink-0">×{item.quantity}</span>
                      )}
                      <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-medium ${reqCfg.cls}`}>
                        {reqCfg.label}
                      </span>
                      {availType && availType !== reqType && (
                        <>
                          <FiArrowRight className="text-slate-400 shrink-0" size={11} />
                          <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-medium ${
                            availType === 'new_available'    ? 'bg-green-soft text-operative-green border-green-200' :
                            availType === 'cu_available'     ? 'bg-amber-soft text-caution-amber border-amber-200'  :
                            availType === 'import_available' ? 'bg-red-50 text-alert-red border-red-200'            :
                            'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {availType === 'new_available'    ? 'Nuevo disponible' :
                             availType === 'cu_available'     ? 'CU disponible'    :
                             availType === 'import_available' ? 'Importación'      :
                             availType === 'not_available'    ? 'No disponible'    : availType}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Banner CU aprobada recientemente */}
        {cuRecentlyApproved && (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-operative-green rounded-xl">
            <FiCheckCircle className="text-operative-green shrink-0 mt-0.5" size={16} />
            <div>
              <p className="text-sm font-semibold text-operative-green">Cliente aprobó condición de uso</p>
              <p className="text-xs text-warm-ash mt-0.5">
                ACP Comercial fue notificado para continuar con la proforma y la reserva del equipo.
              </p>
            </div>
          </div>
        )}

        {/* Banner importación confirmada recientemente */}
        {importRecentlyConfirmed && (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-operative-green rounded-xl">
            <FiCheckCircle className="text-operative-green shrink-0 mt-0.5" size={16} />
            <div>
              <p className="text-sm font-semibold text-operative-green">Importación confirmada — proceso avanza</p>
              <p className="text-xs text-warm-ash mt-0.5">
                {isPrivate
                  ? 'El cliente aprobó el compromiso de importación. El flujo continúa con la proforma.'
                  : 'ACP Comercial confirmó que tiene al cliente asegurado para proceder con la importación.'}
              </p>
            </div>
          </div>
        )}

        {/* Reservation card moved to Paso 5 WorkflowStep below */}

        {/* ═══════════════════════════════════════════════════════
            PANEL CU: Aprobación del cliente (condición de uso)
            Solo visible cuando está en ese estado + solo comercial puede decidir
        ═══════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {isCuPending && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="rounded-xl border-2 border-caution-amber bg-amber-50 p-5 shadow-ambient"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-xl bg-amber-soft text-caution-amber shrink-0">
                  <FiUserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink-slate">Disponible en condición de uso (CU)</h3>
                  <p className="text-xs text-warm-ash mt-0.5">
                    El proveedor confirmó que el equipo <strong>no está disponible nuevo</strong>, pero sí en
                    condición de uso. Se requiere la aprobación del cliente para continuar.
                  </p>
                  {requestedTypes.length > 0 && requestedTypes[0] !== 'cu' && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      <FiInfo size={12} className="shrink-0 text-caution-amber" />
                      El cliente solicitó{' '}
                      <span className="font-semibold">{REQUESTED_TYPE_CFG[requestedTypes[0]]?.label ?? requestedTypes[0]}</span>
                      {' '}— ACP registró CU como única opción disponible.
                    </div>
                  )}
                </div>
              </div>

              {canApproveCu ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => handleCuDecision('approve')}
                    disabled={cuLoading !== null}
                    className="flex-1 min-h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-operative-green text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition"
                  >
                    {cuLoading === 'approve'
                      ? <FiLoader className="animate-spin" size={14} />
                      : <FiCheckCircle size={14} />}
                    El cliente acepta — continuar en CU
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCuDecision('reject')}
                    disabled={cuLoading !== null}
                    className="flex-1 min-h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-alert-red text-alert-red text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition hover:bg-red-50"
                  >
                    {cuLoading === 'reject'
                      ? <FiLoader className="animate-spin" size={14} />
                      : <FiXCircle size={14} />}
                    El cliente rechaza — cerrar flujo
                  </button>
                </div>
              ) : (
                <p className="text-xs text-warm-ash italic">
                  En espera de que el usuario comercial registre la decisión del cliente.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════════════════════════
            PANEL IMPORTACIÓN PRIVADA: aprobación vinculante del cliente
            Solo visible cuando purchase.status === 'acp_availability_import_pending'
            en compra privada. Comercial/managers aprueban o rechazan.
        ═══════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {isImportPendingClient && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="rounded-xl border-2 border-alert-red bg-red-50 p-5 shadow-ambient"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-xl bg-red-100 text-alert-red shrink-0">
                  <FiAlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink-slate">
                    Disponible nuevo vía importación — aprobación vinculante del cliente
                  </h3>
                  <p className="text-xs text-warm-ash mt-0.5">
                    El proveedor solo puede proveer el equipo mediante importación.
                    Esta operación <strong className="text-alert-red">no puede revertirse</strong> una vez iniciada.
                    Antes de proceder, el comercial debe obtener la aceptación expresa del cliente.
                  </p>
                  {requestedTypes.length > 0 && requestedTypes[0] !== 'import_new' && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                      <FiInfo size={12} className="shrink-0 text-alert-red" />
                      El cliente solicitó{' '}
                      <span className="font-semibold">{REQUESTED_TYPE_CFG[requestedTypes[0]]?.label ?? requestedTypes[0]}</span>
                      {' '}— ACP registró importación como única opción disponible.
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4 p-3 bg-white border border-red-200 rounded-xl text-xs text-red-900 leading-relaxed">
                <div className="flex items-start gap-2">
                  <FiShield className="text-alert-red shrink-0 mt-0.5" size={13} />
                  <span>
                    <strong>Compromiso irreversible:</strong> al confirmar, ACP procederá con la solicitud
                    de importación. Si el cliente cancela después de iniciada la importación, la empresa
                    asume el costo del equipo importado. Asegurar la aceptación del cliente por escrito.
                  </span>
                </div>
              </div>

              {canApproveCu ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => handleImportDecision('approve')}
                    disabled={importLoading !== null}
                    className="flex-1 min-h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-alert-red text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition"
                  >
                    {importLoading === 'approve'
                      ? <FiLoader className="animate-spin" size={14} />
                      : <FiCheckCircle size={14} />}
                    Cliente acepta — proceder con importación
                  </button>
                  <button
                    type="button"
                    onClick={() => handleImportDecision('reject')}
                    disabled={importLoading !== null}
                    className="flex-1 min-h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-300 text-ink-slate text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition hover:bg-fog"
                  >
                    {importLoading === 'reject'
                      ? <FiLoader className="animate-spin" size={14} />
                      : <FiXCircle size={14} />}
                    Cliente rechaza — cerrar flujo
                  </button>
                </div>
              ) : (
                <p className="text-xs text-warm-ash italic">
                  En espera de que el usuario comercial obtenga la confirmación del cliente.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════════════════════════
            PANEL IMPORTACIÓN PÚBLICA: confirmación de conciencia de ACP
            Solo visible cuando availability_status === 'import_pending_acp_confirmation'
            en compra pública. ACP debe confirmar que tiene al cliente asegurado.
        ═══════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {isImportPendingAcp && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="rounded-xl border-2 border-alert-red bg-red-50 p-5 shadow-ambient"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-xl bg-red-100 text-alert-red shrink-0">
                  <FiShield size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink-slate">
                    Disponible nuevo vía importación — confirmación ACP requerida
                  </h3>
                  <p className="text-xs text-warm-ash mt-0.5">
                    El equipo solo está disponible mediante importación. Esta acción es
                    <strong className="text-alert-red"> irreversible</strong>: una vez solicitada
                    la importación, la empresa queda comprometida con el costo del equipo.
                  </p>
                  {requestedTypes.length > 0 && requestedTypes[0] !== 'import_new' && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                      <FiInfo size={12} className="shrink-0 text-alert-red" />
                      El cliente solicitó{' '}
                      <span className="font-semibold">{REQUESTED_TYPE_CFG[requestedTypes[0]]?.label ?? requestedTypes[0]}</span>
                      {' '}— la importación es el único camino disponible.
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4 p-3 bg-white border border-red-200 rounded-xl text-xs text-red-900 leading-relaxed space-y-2">
                <div className="flex items-start gap-2">
                  <FiAlertTriangle className="text-alert-red shrink-0 mt-0.5" size={13} />
                  <span>
                    <strong>Responsabilidad ACP:</strong> al confirmar, certificás que tenés al cliente
                    comprometido con la compra. Si el cliente cancela después de iniciada la importación,
                    la empresa asume el costo íntegro del equipo importado.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <FiAlertCircle className="text-caution-amber shrink-0 mt-0.5" size={13} />
                  <span>
                    Verificá que contás con al menos una pre-confirmación formal del cliente (correo,
                    orden de compra borrador, o autorización escrita) antes de continuar.
                  </span>
                </div>
              </div>

              <RoleGatedAction allowedRoles={['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial']} userRoles={userRoles}>
                <button
                  type="button"
                  onClick={handleAcpImportConfirm}
                  disabled={importLoading !== null}
                  className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-alert-red text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition"
                >
                  {importLoading === 'acp_confirm'
                    ? <FiLoader className="animate-spin" size={15} />
                    : <FiShield size={15} />}
                  Confirmo que tengo al cliente asegurado — proceder con importación
                </button>
              </RoleGatedAction>

              {!userRoles.some((r) => ['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'].includes(r)) && (
                <p className="text-xs text-warm-ash italic">
                  En espera de que ACP Comercial confirme que tiene al cliente asegurado para proceder.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Paso 1: Verificar disponibilidad (inventario / solicitud proveedor) ── */}
        <WorkflowStep
          stepNumber={1}
          title={isPrivate ? 'Verificar disponibilidad del equipo' : 'Verificar disponibilidad (inventario / proveedor)'}
          actor="ACP Comercial"
          status={roleStepStatus(
            isInternal || Boolean(purchase?.availability_email_sent_at),
            isPrivate
              ? (purchase?.status === 'acp_availability_requested' || purchase?.status === 'sent_to_acp')
              : true,
            ['acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial','backoffice_comercial'],
          )}
          completedAt={purchase?.availability_email_sent_at || undefined}
        >
          <RoleGatedAction allowedRoles={actionRoles} userRoles={userRoles}>
            {/* ── Inventario interno ── */}
            <div className={`rounded-xl border p-5 shadow-ambient transition-all duration-200 ${
              isInternal
                ? 'border-action-blue bg-action-blue/5 ring-2 ring-action-blue ring-offset-1'
                : hasInternalStock
                ? 'border-operative-green bg-green-50'
                : 'border-soft-border bg-white'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${
                    isInternal       ? 'bg-action-blue text-white' :
                    hasInternalStock ? 'bg-green-100 text-operative-green' :
                    'bg-fog text-warm-ash'
                  }`}>
                    <FiPackage size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink-slate">Inventario interno</h3>
                    <p className="text-xs text-warm-ash">Unidades sin asignar disponibles</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {invLoading ? (
                    <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-fog text-xs text-warm-ash">
                      <FiLoader className="animate-spin" size={12} /> Consultando...
                    </span>
                  ) : invError ? (
                    <span className="px-3 py-1 rounded-full bg-red-50 text-xs text-alert-red border border-red-200">
                      Error al consultar
                    </span>
                  ) : (
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                      hasInternalStock ? 'bg-green-soft text-operative-green' : 'bg-fog text-warm-ash'
                    }`}>
                      {hasInternalStock
                        ? `✓ ${matchedUnits.length} unidad${matchedUnits.length !== 1 ? 'es' : ''} disponible${matchedUnits.length !== 1 ? 's' : ''}`
                        : 'Sin stock interno'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={fetchInventory}
                    disabled={invLoading}
                    className="p-1.5 rounded-lg text-warm-ash hover:text-ink-slate hover:bg-fog transition-colors disabled:opacity-40"
                    title="Actualizar inventario"
                  >
                    <FiRefreshCw size={13} className={invLoading ? 'animate-spin' : ''} />
                  </button>
                  {matchedUnits.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setInvExpanded((v) => !v)}
                      className="p-1.5 rounded-lg text-warm-ash hover:text-ink-slate hover:bg-fog transition-colors"
                      title={invExpanded ? 'Ocultar lista' : 'Ver unidades'}
                    >
                      {invExpanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                    </button>
                  )}
                </div>
              </div>

              {invError && <p className="text-xs text-alert-red mb-3">{invError}</p>}

              <AnimatePresence>
                {invExpanded && matchedUnits.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="rounded-xl border border-green-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-operative-green">#</th>
                            <th className="text-left px-3 py-2 font-semibold text-operative-green">Equipo / Modelo</th>
                            <th className="text-left px-3 py-2 font-semibold text-operative-green">Serial</th>
                            <th className="text-left px-3 py-2 font-semibold text-operative-green">Estado</th>
                            <th className="text-left px-3 py-2 font-semibold text-operative-green">Ubicación</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-green-100">
                          {matchedUnits.slice(0, 10).map((unit, idx) => (
                            <tr key={unit.id || idx} className="hover:bg-green-50 transition-colors">
                              <td className="px-3 py-2 text-warm-ash">{idx + 1}</td>
                              <td className="px-3 py-2 text-ink-slate font-medium">
                                {unit.nombre || unit.modelo || unit.tipo || '—'}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-600">
                                {unit.serial || (unit.serial_pendiente ? (
                                  <span className="text-caution-amber">Pendiente</span>
                                ) : '—')}
                              </td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded-full bg-green-soft text-operative-green text-[11px] font-medium">
                                  {unit.estado || 'no_asignado'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-warm-ash">{unit.ubicacion || '—'}</td>
                            </tr>
                          ))}
                          {matchedUnits.length > 10 && (
                            <tr>
                              <td colSpan={5} className="px-3 py-2 text-center text-xs text-warm-ash">
                                + {matchedUnits.length - 10} unidades más
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!invLoading && !invError && !hasInternalStock && (
                <p className="text-xs text-warm-ash mb-4">
                  No se encontraron unidades internas sin asignar que coincidan con el equipo de este expediente.
                  Utiliza la opción de solicitud al proveedor.
                </p>
              )}

              {hasInternalStock && (
                <button
                  type="button"
                  onClick={() => handleSetAvailability('internal', 'internal_available_ready')}
                  disabled={loading || isInternal}
                  className={`w-full min-h-11 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97] ${
                    isInternal
                      ? 'bg-operative-green text-white opacity-80 cursor-default'
                      : 'bg-operative-green text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {loading && !isInternal ? (
                    <span className="flex items-center justify-center gap-2">
                      <FiLoader className="animate-spin" size={15} /> Confirmando...
                    </span>
                  ) : isInternal ? (
                    <span className="flex items-center justify-center gap-2">
                      <FiCheckCircle size={15} /> Disponibilidad interna confirmada
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <FiCheckCircle size={15} /> Confirmar disponibilidad interna ({matchedUnits.length} unidad{matchedUnits.length !== 1 ? 'es' : ''})
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* ── Solicitud al proveedor (formulario de envío) ── */}
            {!isInternal && (
              <div className={`rounded-xl border p-5 shadow-ambient transition-all duration-200 ${
                isSupplier
                  ? 'border-action-blue bg-action-blue/5 ring-2 ring-action-blue ring-offset-1'
                  : !hasInternalStock
                  ? 'border-caution-amber bg-amber-50'
                  : 'border-soft-border bg-white'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-xl ${
                    isSupplier        ? 'bg-action-blue text-white'          :
                    !hasInternalStock ? 'bg-amber-soft text-caution-amber'   :
                    'bg-fog text-warm-ash'
                  }`}>
                    <FiMail size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink-slate">Solicitud al proveedor</h3>
                    <p className="text-xs text-warm-ash">
                      {!hasInternalStock
                        ? 'Sin stock interno — solicita disponibilidad al proveedor'
                        : 'Alternativa: solicitar disponibilidad al proveedor'}
                    </p>
                  </div>
                  {isSupplier && (
                    <span className="ml-auto px-3 py-1 rounded-full bg-action-blue/10 text-action-blue text-xs font-semibold">
                      Enviada
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Contactos guardados */}
                  {/* Destinatarios: chips (varios correos a la vez), correos
                      individuales guardados y grupos de correos guardados
                      para aplicar de una sola vez. */}
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Correo(s) proveedor</span>
                    <div className="mt-1">
                      <ProviderEmailChipsInput
                        value={providerEmail}
                        onChange={setProviderEmail}
                        savedEmails={savedEmails}
                        onSaveEmail={(email) => saveEmail(email, email)}
                        groups={emailGroups}
                        onSaveGroup={saveEmailGroup}
                        onRemoveGroup={removeEmailGroup}
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Notas</span>
                    <textarea
                      value={providerNotes}
                      onChange={(e) => setProviderNotes(e.target.value)}
                      className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue"
                      placeholder="Detalle de equipo, cantidad o condición comercial"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRequestSupplier}
                    disabled={
                      !canManagePrivateSupplierAvailability ||
                      supplierLoading === 'supplier_request' ||
                      !providerEmail.trim() ||
                      Boolean(purchase?.availability_email_sent_at) ||
                      purchase?.status !== 'acp_availability_requested'
                    }
                    className="min-h-10 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-action-blue text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition"
                  >
                    {supplierLoading === 'supplier_request'
                      ? <FiLoader className="animate-spin" size={14} />
                      : <FiMail size={14} />}
                    Enviar solicitud
                  </button>
                  {!canManagePrivateSupplierAvailability && isPrivate && (
                    <p className="text-xs text-warm-ash">Solo ACP/gerencia puede enviar solicitud al proveedor.</p>
                  )}
                  {purchase?.availability_email_sent_at && (
                    <p className="text-xs text-warm-ash">
                      Correo enviado: <span className="font-mono">{purchase.availability_email_sent_at}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </RoleGatedAction>
        </WorkflowStep>

        {/* ── Paso 2: Registrar respuesta del proveedor ── */}
        {!isInternal && (
          <WorkflowStep
            stepNumber={2}
            title="Registrar respuesta del proveedor"
            actor="ACP Comercial"
            status={roleStepStatus(
              Boolean(purchase?.provider_response_at),
              Boolean(purchase?.availability_email_sent_at) && purchase?.status === 'acp_availability_requested',
              ['acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial','backoffice_comercial'],
            )}
            completedAt={purchase?.provider_response_at || undefined}
          >
            <RoleGatedAction allowedRoles={actionRoles} userRoles={userRoles}>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-ambient space-y-4">
                <div className="flex items-center gap-2">
                  <FiClipboard className="text-operative-green" size={15} />
                  <h4 className="text-xs font-semibold text-ink-slate">Respuesta del proveedor</h4>
                </div>

                {/* Resumen de lo solicitado por el cliente — contexto para ACP */}
                {equipmentItems.length > 0 && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Solicitado por el cliente
                    </p>
                    {equipmentItems.map((item, idx) => {
                      const reqType = item.type || 'new';
                      const reqCfg  = REQUESTED_TYPE_CFG[reqType] || REQUESTED_TYPE_CFG.new;
                      return (
                        <div key={item.id || idx} className="flex items-center gap-2 text-xs">
                          <span className="shrink-0 text-warm-ash">{idx + 1}.</span>
                          <span className="text-ink-slate font-medium flex-1 truncate">
                            {item.name || item.label || item.equipment_name || 'Equipo'}
                          </span>
                          {item.quantity && (
                            <span className="text-warm-ash shrink-0">×{item.quantity}</span>
                          )}
                          <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-medium ${reqCfg.cls}`}>
                            {reqCfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selector de resultado */}
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Resultado del proveedor</span>
                  <select
                    value={responseOutcome}
                    onChange={(e) => setResponseOutcome(e.target.value)}
                    className="mt-1 w-full min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue"
                  >
                    <option value="new">Disponible (nuevo)</option>
                    <option value="cu_only">Disponible en CU (condición de uso)</option>
                    <option value="import_new">Disponible nuevo vía importación</option>
                    <option value="unavailable">No disponible</option>
                  </select>
                </label>

                {/* Análisis de discrepancia */}
                {(() => {
                  const mismatch = analyzeMismatch(requestedTypes, responseOutcome);
                  if (!mismatch) {
                    // Sin discrepancia — confirmación silenciosa si coincide
                    if (responseOutcome === 'new' && requestedTypes[0] === 'new') {
                      return (
                        <div className="flex items-center gap-2 text-xs text-operative-green bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                          <FiCheckCircle size={13} className="shrink-0" />
                          El tipo coincide con lo solicitado por el cliente.
                        </div>
                      );
                    }
                    if (responseOutcome === 'cu_only' && requestedTypes[0] === 'cu') {
                      return (
                        <div className="flex items-center gap-2 text-xs text-operative-green bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                          <FiCheckCircle size={13} className="shrink-0" />
                          El tipo coincide con lo solicitado por el cliente (CU).
                        </div>
                      );
                    }
                    return null;
                  }
                  return (
                    <div className={`rounded-xl border p-3 space-y-2 ${
                      mismatch.color === 'amber' ? 'bg-amber-50 border-caution-amber' :
                      mismatch.color === 'blue'  ? 'bg-blue-50 border-action-blue'   :
                      'bg-red-50 border-alert-red'
                    }`}>
                      <div className="flex items-start gap-2">
                        {mismatch.color === 'amber' && <FiAlertTriangle className="text-caution-amber shrink-0 mt-0.5" size={14} />}
                        {mismatch.color === 'blue'  && <FiInfo className="text-action-blue shrink-0 mt-0.5" size={14} />}
                        {mismatch.color === 'red'   && <FiAlertTriangle className="text-alert-red shrink-0 mt-0.5" size={14} />}
                        <div>
                          <p className={`text-xs font-semibold ${
                            mismatch.color === 'amber' ? 'text-caution-amber' :
                            mismatch.color === 'blue'  ? 'text-action-blue'   :
                            'text-alert-red'
                          }`}>
                            {mismatch.title}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">{mismatch.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {responseOutcome === 'import_new' && (
                  <div className="flex items-start gap-2 bg-red-50 border border-alert-red rounded-lg px-3 py-2">
                    <FiAlertTriangle className="text-alert-red shrink-0 mt-0.5" size={14} />
                    <p className="text-xs text-red-800">
                      <strong>Advertencia — compromiso irreversible:</strong> solicitar importación
                      <strong> no se puede deshacer</strong>. En privada se requerirá aprobación
                      vinculante del cliente; en pública, ACP deberá confirmar que tiene al cliente asegurado.
                    </p>
                  </div>
                )}

                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Respuesta / observación</span>
                  <textarea
                    value={responseNotes}
                    onChange={(e) => setResponseNotes(e.target.value)}
                    className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue"
                    placeholder="Respuesta enviada por proveedor"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleProviderResponse}
                  disabled={
                    !canManagePrivateSupplierAvailability ||
                    supplierLoading === 'provider_response' ||
                    !responseNotes.trim() ||
                    !purchase?.availability_email_sent_at ||
                    Boolean(purchase?.provider_response_at) ||
                    purchase?.status !== 'acp_availability_requested'
                  }
                  className="min-h-10 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-operative-green text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition"
                >
                  {supplierLoading === 'provider_response'
                    ? <FiLoader className="animate-spin" size={14} />
                    : <FiCheckCircle size={14} />}
                  Registrar respuesta
                </button>
                {!canManagePrivateSupplierAvailability && isPrivate && (
                  <p className="text-xs text-warm-ash">Solo ACP/gerencia puede registrar la respuesta del proveedor.</p>
                )}
                {purchase?.provider_response_at && (
                  <p className="text-xs text-warm-ash">
                    Registrada: <span className="font-mono">{purchase.provider_response_at}</span>
                  </p>
                )}
              </div>
            </RoleGatedAction>
          </WorkflowStep>
        )}

        {/* ── Paso 3: Asesor comercial confirma con el cliente la respuesta del proveedor ── */}
        {isPrivate && (
          <WorkflowStep
            stepNumber={paso3Num}
            title="Confirmar respuesta del proveedor con el cliente"
            actor="Asesor Comercial"
            status={roleStepStatus(
              // Done cuando el proveedor respondió Y el status ya avanzó más allá de acp_availability_requested.
              // Esto cubre TODOS los estados posteriores (offer_sent, client_registered, inspection_requested, etc.)
              Boolean(purchase?.provider_response_at) && purchase?.status !== 'acp_availability_requested',
              // Activo solo mientras el status es acp_availability_requested y ya hay respuesta del proveedor
              Boolean(purchase?.provider_response_at) && purchase?.status === 'acp_availability_requested',
              ['comercial','asesor_comercial','analista_comercial','jefe_comercial','jefe_de_comercial','gerencia','gerencia_general'],
            )}
          >
            {purchase?.provider_response_at && (() => {
              const providerOutcome = purchase?.provider_response?.outcome;
              const mismatch = analyzeMismatch(requestedTypes, providerOutcome);
              return (
                <div className="space-y-3">
                  {/* Resumen de la respuesta del proveedor */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Respuesta registrada por ACP</p>
                    <p className="text-xs text-slate-600">
                      <strong>Resultado del proveedor:</strong>{' '}
                      {providerOutcome === 'new'        ? 'Disponible (nuevo)' :
                       providerOutcome === 'cu_only'    ? 'Disponible en CU' :
                       providerOutcome === 'import_new' ? 'Disponible vía importación' :
                       providerOutcome === 'unavailable'? 'No disponible' : '—'}
                    </p>
                    {purchase?.provider_response?.notes && (
                      <p className="text-xs text-slate-600">
                        <strong>Observación:</strong> {purchase.provider_response.notes}
                      </p>
                    )}
                  </div>

                  {/* Alerta de discrepancia */}
                  {mismatch ? (
                    <div className={`rounded-xl border p-3 ${
                      mismatch.color === 'amber' ? 'bg-amber-50 border-caution-amber' :
                      mismatch.color === 'blue'  ? 'bg-blue-50 border-action-blue'   :
                      'bg-red-50 border-alert-red'
                    }`}>
                      <div className="flex items-start gap-2">
                        {mismatch.color === 'amber' && <FiAlertTriangle className="text-caution-amber shrink-0 mt-0.5" size={14} />}
                        {mismatch.color === 'blue'  && <FiInfo className="text-action-blue shrink-0 mt-0.5" size={14} />}
                        {mismatch.color === 'red'   && <FiAlertTriangle className="text-alert-red shrink-0 mt-0.5" size={14} />}
                        <div>
                          <p className={`text-xs font-semibold ${
                            mismatch.color === 'amber' ? 'text-caution-amber' :
                            mismatch.color === 'blue'  ? 'text-action-blue'   :
                            'text-alert-red'
                          }`}>
                            {mismatch.title}
                          </p>
                          <p className="text-xs text-slate-700 mt-1">
                            Confirma con el cliente si acepta esta respuesta. Si la rechaza, el proceso termina aquí.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-operative-green bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <FiCheckCircle size={13} className="shrink-0" />
                      La respuesta del proveedor coincide con lo solicitado por el cliente.
                    </div>
                  )}

                  <RoleGatedAction
                    allowedRoles={['comercial', 'asesor_comercial', 'analista_comercial', 'jefe_comercial', 'jefe_de_comercial', 'gerencia', 'gerencia_general']}
                    userRoles={userRoles}
                  >
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <p className="text-xs text-slate-700">
                        {mismatch
                          ? 'Verifica con el cliente que acepta el cambio antes de continuar.'
                          : 'Confirma que el cliente acepta la respuesta del proveedor para continuar el flujo.'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolvePrivateAvailability('confirm')}
                          disabled={Boolean(decisionLoading) || !canResolvePrivateAvailability}
                          className="min-h-9 inline-flex items-center gap-2 px-4 rounded-xl bg-operative-green text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {decisionLoading === 'confirm' ? <FiLoader className="animate-spin" size={13} /> : <FiCheckCircle size={13} />}
                          Aceptar y continuar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolvePrivateAvailability('reject')}
                          disabled={Boolean(decisionLoading) || !canResolvePrivateAvailability}
                          className="min-h-9 inline-flex items-center gap-2 px-4 rounded-xl bg-white border border-alert-red text-alert-red text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {decisionLoading === 'reject' ? <FiLoader className="animate-spin" size={13} /> : <FiXCircle size={13} />}
                          Rechazar y cancelar proceso
                        </button>
                      </div>
                    </div>
                  </RoleGatedAction>
                </div>
              );
            })()}
          </WorkflowStep>
        )}

        {/* ── Paso: Solicitar proforma al proveedor (email) — ACP ── */}
        {isPrivate && (
          <WorkflowStep
            stepNumber={pasoRequestProformaNum}
            title="Solicitar proforma al proveedor"
            actor="ACP Comercial"
            status={roleStepStatus(
              proformaRequested,
              purchase?.status === 'acp_availability_confirmed' && !proformaRequested,
              ['acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'],
            )}
            completedAt={purchase?.extra?.proforma_request_sent_at || undefined}
          >
            <RoleGatedAction
              allowedRoles={['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial']}
              userRoles={userRoles}
            >
              <div className="space-y-3">
                {proformaRequested ? (
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-operative-green bg-green-50">
                    <FiCheckCircle className="text-operative-green shrink-0 mt-0.5" size={18} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-operative-green">Proforma solicitada al proveedor</p>
                      <p className="text-xs text-warm-ash mt-0.5">
                        Enviada a <span className="font-mono">{purchase?.extra?.proforma_request_provider_email || providerEmail}</span> el {formatDate(purchase?.extra?.proforma_request_sent_at)}
                      </p>
                      {purchase?.extra?.proforma_request_notes && (
                        <p className="text-xs text-slate-600 mt-1"><strong>Notas:</strong> {purchase.extra.proforma_request_notes}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      Puedes enviar el correo de solicitud por SPI, o si ya la solicitaste respondiendo directamente el hilo de Gmail con el proveedor, solo registra el paso como hecho.
                    </div>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Correo del proveedor</span>
                      <input
                        type="email"
                        value={providerEmail}
                        onChange={(e) => setProviderEmail(e.target.value)}
                        placeholder="proveedor@empresa.com"
                        className="mt-1 w-full min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Notas adicionales (opcional)</span>
                      <textarea
                        value={proformaRequestNotes}
                        onChange={(e) => setProformaRequestNotes(e.target.value)}
                        className="mt-1 w-full min-h-16 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue"
                        placeholder="Plazo, condiciones, referencias, etc."
                      />
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => handleRequestProforma(true)}
                        disabled={
                          proformaRequestLoading ||
                          !canUploadProforma ||
                          !providerEmail.trim() ||
                          purchase?.status !== 'acp_availability_confirmed'
                        }
                        className="min-h-10 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-action-blue text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition"
                      >
                        {proformaRequestLoading ? <FiLoader className="animate-spin" size={14} /> : <FiMail size={14} />}
                        Enviar solicitud por SPI
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestProforma(false)}
                        disabled={
                          proformaRequestLoading ||
                          !canUploadProforma ||
                          purchase?.status !== 'acp_availability_confirmed'
                        }
                        className="min-h-10 inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-slate-300 bg-white text-ink-slate text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition"
                        title="Usa esta opción si ya solicitaste la proforma respondiendo el correo directamente en Gmail"
                      >
                        {proformaRequestLoading ? <FiLoader className="animate-spin" size={14} /> : <FiCheckCircle size={14} />}
                        Ya la solicité por Gmail — solo registrar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </RoleGatedAction>
          </WorkflowStep>
        )}

        {/* ── Paso: Subir proforma sin firmar + activar reserva (solo privada) ── */}
        {isPrivate && (
          <WorkflowStep
            stepNumber={paso4Num}
            title="Subir proforma del proveedor y reservar equipo"
            actor="ACP Comercial"
            status={roleStepStatus(
              proformaUploaded,
              proformaRequested && !proformaUploaded,
              ['acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'],
            )}
            completedAt={purchase?.extra?.proforma_uploaded_at || undefined}
          >
            <RoleGatedAction
              allowedRoles={['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial']}
              userRoles={userRoles}
            >
              <div className="space-y-4">
                {/* Condiciones de reserva según tipo de equipo */}
                <div className={`rounded-xl border p-4 ${
                  isImportOutcome
                    ? 'bg-red-50 border-alert-red'
                    : 'bg-green-50 border-operative-green'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isImportOutcome ? 'bg-red-100 text-alert-red' : 'bg-green-100 text-operative-green'
                    }`}>
                      {isImportOutcome ? <FiAlertTriangle size={16} /> : <FiShield size={16} />}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isImportOutcome ? 'text-alert-red' : 'text-operative-green'}`}>
                        {isImportOutcome
                          ? 'Equipo vía importación — reserva con compromiso 100%'
                          : providerOutcome === 'cu_only'
                          ? 'Equipo CU — reserva automática al subir proforma'
                          : 'Equipo nuevo disponible — reserva automática al subir proforma'}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        {isImportOutcome
                          ? 'Para importaciones, la reserva es vinculante. Solo actívala si el cliente está comprometido al 100% con la compra.'
                          : 'Al subir la proforma se enviará automáticamente la confirmación de reserva al proveedor y se creará un recordatorio en calendario (vence en 15 días).'}
                      </p>
                    </div>
                  </div>

                  {/* Checkbox de compromiso para importación */}
                  {isImportOutcome && (
                    <label className="flex items-start gap-2 mt-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importReserveChecked}
                        onChange={(e) => setImportReserveChecked(e.target.checked)}
                        className="mt-0.5 accent-alert-red"
                        disabled={proformaUploaded}
                      />
                      <span className="text-xs text-red-900">
                        <strong>Confirmo</strong> que el cliente está comprometido al 100% con la importación y autorizo la reserva del equipo. Entiendo que esta operación <strong>no puede revertirse</strong>.
                      </span>
                    </label>
                  )}
                </div>

                {/* Upload zone */}
                {proformaUploaded ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-operative-green bg-green-50">
                    <FiCheckCircle className="text-operative-green shrink-0" size={18} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-operative-green">Proforma subida</p>
                      <p className="text-xs text-warm-ash">
                        {formatDate(purchase?.extra?.proforma_uploaded_at)}
                      </p>
                    </div>
                    {purchase?.extra?.proforma_file_link && (
                      <a
                        href={purchase.extra.proforma_file_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-action-blue hover:underline shrink-0"
                      >
                        <FiExternalLink size={12} />
                        Ver archivo
                      </a>
                    )}
                  </div>
                ) : (
                  <FileUploadZone
                    id="proforma-file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    label="Proforma del proveedor (sin firma)"
                    description="PDF, Word, Excel — máx. 20 MB"
                    file={proformaFile}
                    onFileChange={setProformaFile}
                    onUpload={handleUploadProforma}
                    uploading={proformaLoading}
                    disabled={
                      !canUploadProforma ||
                      purchase?.status !== 'acp_availability_confirmed' ||
                      !proformaRequested ||
                      (isImportOutcome && !importReserveChecked)
                    }
                    errorMessage={
                      purchase?.status !== 'acp_availability_confirmed'
                        ? 'Disponible cuando la disponibilidad está confirmada.'
                        : !proformaRequested
                        ? 'Debes solicitar la proforma al proveedor en el paso anterior.'
                        : isImportOutcome && !importReserveChecked
                        ? 'Debes confirmar el compromiso de importación para reservar.'
                        : undefined
                    }
                  />
                )}

                {!canUploadProforma && (
                  <p className="text-xs text-warm-ash">Solo ACP Comercial o gerencia pueden subir la proforma.</p>
                )}
              </div>
            </RoleGatedAction>
          </WorkflowStep>
        )}

        {/* ── Paso: Firmar y aprobar proforma (Gerencia / ACP) — habilita contrato ── */}
        {isPrivate && (
          <WorkflowStep
            stepNumber={pasoSignedProformaNum}
            title="Firmar y aprobar proforma"
            actor="Gerencia General / ACP Comercial"
            status={roleStepStatus(
              signedProformaUploaded,
              proformaUploaded && !signedProformaUploaded,
              ['acp_comercial','gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'],
            )}
            completedAt={purchase?.extra?.proforma_signed_uploaded_at || undefined}
          >
            <RoleGatedAction
              allowedRoles={['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial']}
              userRoles={userRoles}
            >
              <div className="space-y-3">
                <div className="rounded-xl border border-action-blue bg-blue-50 p-3">
                  <div className="flex items-start gap-2">
                    <FiInfo className="text-action-blue shrink-0 mt-0.5" size={14} />
                    <p className="text-xs text-slate-700">
                      Gerencia General o ACP Comercial debe firmar la proforma del proveedor y subirla aquí para <strong>habilitar la gestión del contrato</strong>.
                    </p>
                  </div>
                </div>

                {signedProformaUploaded ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-operative-green bg-green-50">
                    <FiCheckCircle className="text-operative-green shrink-0" size={18} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-operative-green">Proforma aprobada y firmada</p>
                      <p className="text-xs text-warm-ash">
                        {formatDate(purchase?.extra?.proforma_signed_uploaded_at)}
                      </p>
                    </div>
                    {purchase?.extra?.proforma_signed_file_link && (
                      <a
                        href={purchase.extra.proforma_signed_file_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-action-blue hover:underline shrink-0"
                      >
                        <FiExternalLink size={12} />
                        Ver archivo
                      </a>
                    )}
                  </div>
                ) : (
                  <FileUploadZone
                    id="signed-proforma-file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    label="Proforma firmada por gerencia / ACP"
                    description="PDF, Word, Excel — máx. 20 MB"
                    file={signedProformaFile}
                    onFileChange={setSignedProformaFile}
                    onUpload={handleUploadSignedProforma}
                    uploading={signedProformaLoading}
                    disabled={!canUploadProforma || !proformaUploaded}
                    errorMessage={
                      !proformaUploaded
                        ? 'Debes subir primero la proforma sin firmar.'
                        : undefined
                    }
                  />
                )}

                {!canUploadProforma && (
                  <p className="text-xs text-warm-ash">Solo Gerencia General o ACP Comercial pueden firmar y aprobar la proforma.</p>
                )}
              </div>
            </RoleGatedAction>
          </WorkflowStep>
        )}

        {isPrivate && (
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-ambient">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className={`rounded-2xl p-3 ${
                  reservationExpired
                    ? 'bg-red-100 text-alert-red'
                    : hasReservation
                    ? 'bg-green-100 text-operative-green'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  <FiClock size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-slate">Reserva de equipo</p>
                  <p className="mt-1 text-xs text-warm-ash">
                    La consulta global de reservas se gestiona desde una ventana independiente y ya no cuenta como paso del flujo.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReservationsModalOpen(true)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
              >
                <FiFileText size={14} />
                Ver reservas activas
              </button>
            </div>

            {hasReservation ? (
              <div className={`mt-4 rounded-2xl border p-4 ${
                reservationExpired
                  ? 'border-alert-red bg-red-50'
                  : reservationDaysRemaining !== null && reservationDaysRemaining <= 3
                  ? 'border-caution-amber bg-amber-50'
                  : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink-slate">
                      {reservationExpired ? 'Reserva vencida en este expediente' : 'Reserva activa en este expediente'}
                    </p>
                    <p className="mt-1 text-xs text-warm-ash">
                      {/* Mostrar etiqueta según si la reserva fue por email o por proforma */}
                      {reservationEmailSent ? 'Reserva enviada' : 'Reserva activada (proforma)'}:
                      {' '}<span className="font-medium text-slate-700">{formatDate(reservationActivatedAt)}</span>
                      {' — '}
                      Caduca: <span className="font-medium text-slate-700">{formatDate(reservationExpiresAt)}</span>
                    </p>
                  </div>

                  {reservationDaysRemaining !== null && (
                    <div className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      reservationExpired
                        ? 'bg-red-100 text-alert-red'
                        : reservationDaysRemaining <= 3
                        ? 'bg-amber-soft text-caution-amber'
                        : 'bg-green-soft text-operative-green'
                    }`}>
                      {reservationExpired
                        ? 'Vencida'
                        : reservationDaysRemaining === 0
                        ? 'Vence hoy'
                        : `${reservationDaysRemaining} dias restantes`}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {purchase?.reservation_calendar_event_link && (
                    <a
                      href={purchase.reservation_calendar_event_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-4 text-sm font-medium text-action-blue transition hover:bg-blue-50"
                    >
                      <FiExternalLink size={13} />
                      Ver seguimiento en calendario
                    </a>
                  )}

                  <RoleGatedAction
                    allowedRoles={['acp_comercial', 'jefe_comercial', 'jefe_de_comercial', 'gerencia', 'gerencia_general']}
                    userRoles={userRoles}
                  >
                    <button
                      type="button"
                      onClick={handleRenewReservation}
                      disabled={renewLoading || !canRenewReservation}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-action-blue px-4 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {renewLoading ? <FiLoader className="animate-spin" size={13} /> : <FiRefreshCw size={13} />}
                      Renovar reserva
                    </button>
                  </RoleGatedAction>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-warm-ash">
                <FiLock size={14} className="shrink-0 text-slate-400" />
                <span>La reserva de este expediente aparecera aqui cuando ACP la registre.</span>
              </div>
            )}
          </div>
        )}

        {/* ── Fecha tentativa de entrega del proveedor — al final del tab: no es
             un paso bloqueante, puede actualizarse varias veces durante el
             proceso, por eso vive fuera de la secuencia numerada de WorkflowStep. ── */}
        {isPrivate && (
          <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-ink-slate flex items-center gap-2">
                  <FiClock className="text-action-blue" size={15} />
                  Fecha tentativa de entrega del proveedor
                </h3>
                <p className="text-xs text-warm-ash mt-0.5">
                  Registrada por ACP Comercial. Puede actualizarse si el proveedor da una nueva fecha — cada cambio queda en el historial.
                </p>
              </div>
              {latestProviderDeliveryDate && (
                <TabBadge variant="active" label={`Vigente: ${formatDate(latestProviderDeliveryDate.date)}`} />
              )}
            </div>

            <RoleGatedAction
              allowedRoles={['acp_comercial', 'jefe_operaciones', 'jefe_comercial', 'jefe_de_comercial', 'gerencia', 'gerencia_general']}
              userRoles={userRoles}
            >
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input
                  type="date"
                  value={providerDeliveryDateDraft}
                  onChange={(e) => setProviderDeliveryDateDraft(e.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue"
                />
                <input
                  type="text"
                  value={providerDeliveryNotesDraft}
                  onChange={(e) => setProviderDeliveryNotesDraft(e.target.value)}
                  placeholder="Notas (opcional)"
                  className="flex-1 min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue"
                />
                <button
                  type="button"
                  onClick={handleRegisterProviderDeliveryDate}
                  disabled={!providerDeliveryDateDraft || providerDeliveryLoading}
                  className="min-h-10 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-action-blue text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {providerDeliveryLoading ? <FiLoader className="animate-spin" size={14} /> : <FiClock size={14} />}
                  {latestProviderDeliveryDate ? 'Registrar nueva fecha' : 'Registrar fecha'}
                </button>
              </div>
            </RoleGatedAction>

            {providerDeliveryHistory.length ? (
              <div className="space-y-2">
                {providerDeliveryHistory.slice().reverse().map((entry, i) => (
                  <div
                    key={`${entry.registered_at}-${i}`}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-lg border px-3 py-2 text-xs ${
                      i === 0 ? 'border-action-blue/30 bg-action-blue/5' : 'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="font-mono font-semibold text-ink-slate">{formatDate(entry.date)}</span>
                      {entry.notes && <span className="text-warm-ash ml-2">{entry.notes}</span>}
                    </div>
                    <span className="text-warm-ash">
                      {entry.registered_by_email || 'ACP'} · {formatDate(entry.registered_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-warm-ash">Aún no se ha registrado una fecha tentativa del proveedor.</p>
            )}
          </div>
        )}
      </div>

      <ReservationsOverviewModal
        open={reservationsModalOpen}
        onClose={() => setReservationsModalOpen(false)}
        fetchReservations={loadReservationOverview}
        currentPurchaseId={purchase?.id}
      />
    </div>
  );
};

export default AvailabilityTab;
