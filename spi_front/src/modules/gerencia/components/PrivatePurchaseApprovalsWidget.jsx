import React, { useState, useEffect } from 'react';
import { FiCheck, FiX, FiEye, FiFileText, FiAlertTriangle, FiClock } from 'react-icons/fi';
import {
  getPrivatePurchaseTimeline,
  listPrivatePurchasesByRole,
  transitionPrivatePurchaseState,
  uploadPrivatePurchaseContract
} from '../../../core/api/privatePurchasesApi';
import { useUI } from '../../../core/ui/useUI';
import Modal from '../../../core/ui/components/Modal';
import { formatDateEC, formatDateTimeEC, parseToDate } from '../../../core/utils/dateUtils';
import {
  PRIVATE_PURCHASE_ERROR_CODES,
} from '../../shared/constants/privatePurchaseConstants';

/**
 * PrivatePurchaseApprovalsWidget - Widget para gerencia general
 * Muestra compras privadas pendientes de aprobacion de contrato
 */
const pickFirstValidDate = (values) => {
  for (const value of values) {
    if (parseToDate(value)) {
      return value;
    }
  }
  return null;
};

const formatDateMaybe = (value, fallback, label) => {
  if (!value) {
    console.warn('[GERENCIA_WIDGET][DATE][MISSING]', { label, value });
    return fallback;
  }
  if (parseToDate(value)) return formatDateEC(value, fallback);
  console.warn('[GERENCIA_WIDGET][DATE][INVALID]', { label, value });
  return String(value);
};

const formatDateTimeMaybe = (value, fallback, label) => {
  if (!value) {
    console.warn('[GERENCIA_WIDGET][DATE_TIME][MISSING]', { label, value });
    return fallback;
  }
  if (parseToDate(value)) return formatDateTimeEC(value, fallback);
  console.warn('[GERENCIA_WIDGET][DATE_TIME][INVALID]', { label, value });
  return String(value);
};

const PrivatePurchaseApprovalsWidget = () => {
  const { showToast } = useUI();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  const loadPendingApprovals = async () => {
    try {
      setLoading(true);
      console.log('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Loading pending contract approvals');

      // Get purchases pending manager approval via role-based endpoint
      const result = await listPrivatePurchasesByRole('gerencia_general');

      console.log('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Loaded purchases:', result?.length || 0);
      if (Array.isArray(result) && result.length > 0) {
        const sample = result[0] || {};
        console.log('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET][DATE_SAMPLE]', {
          id: sample.id,
          created_at: sample.created_at,
          createdAt: sample.createdAt,
          updated_at: sample.updated_at,
          updatedAt: sample.updatedAt,
          created: sample.created,
          created_on: sample.created_on,
          createdOn: sample.createdOn,
          created_date: sample.created_date,
          createdDate: sample.createdDate,
          requested_at: sample.requested_at,
          requestedAt: sample.requestedAt,
          keys: Object.keys(sample || {})
        });
      }
      setPurchases(result || []);
    } catch (error) {
      console.error('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Error loading approvals:', error);
      showToast('Error al cargar aprobaciones pendientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (purchase) => {
    try {
      console.log('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Loading timeline for purchase:', purchase.id);

      const timelineResult = await getPrivatePurchaseTimeline(purchase.id);
      if (Array.isArray(timelineResult?.events) && timelineResult.events.length > 0) {
        const eventSample = timelineResult.events[0] || {};
        console.log('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET][TIMELINE_DATE_SAMPLE]', {
          eventType: eventSample.eventType || eventSample.type,
          timestamp: eventSample.timestamp,
          created_at: eventSample.created_at,
          updated_at: eventSample.updated_at,
          keys: Object.keys(eventSample || {})
        });
      }
      setTimelineData(timelineResult);
      setSelectedPurchase(purchase);
      setDetailsOpen(true);
    } catch (error) {
      console.error('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Error loading timeline:', error);
      showToast('Error al cargar detalles de la compra', 'error');
    }
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedPurchase(null);
    setTimelineData(null);
  };

  const handleApprove = async (purchaseId, contractData) => {
    try {
      setActionLoading(prev => ({ ...prev, [purchaseId]: true }));
      console.log('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Uploading contract:', purchaseId);

      await uploadPrivatePurchaseContract(purchaseId, contractData);

      showToast('Contrato subido exitosamente', 'success');
      await loadPendingApprovals(); // Refresh list
    } catch (error) {
      console.error('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Error uploading contract:', error);
      showToast(error.message || 'Error al subir contrato', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [purchaseId]: false }));
    }
  };

  const handleReject = async (purchaseId, reason) => {
    if (!reason || reason.trim().length === 0) {
      console.log('[FLOW_PRIVADA][FE][FASE3][GERENCIA][REJECT][BLOCKED_EMPTY_REASON]', {
        purchaseId,
        reason: reason || 'empty'
      });
      showToast('Debe proporcionar un motivo para el rechazo', 'warning');
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [purchaseId]: true }));
      console.log('[FLOW_PRIVADA][FE][FASE3][GERENCIA][REJECT][OPEN_MODAL]', {
        purchaseId,
        reasonLength: reason.length
      });

      await transitionPrivatePurchaseState(purchaseId, 'contract_rejected', reason);

      console.log('[FLOW_PRIVADA][FE][FASE3][GERENCIA][REJECT][API_OK]', {
        purchaseId,
        ok: true,
        code: 'SUCCESS'
      });

      showToast('Contrato rechazado. Se solicitaran correcciones.', 'info');
      await loadPendingApprovals(); // Refresh list
    } catch (error) {
      console.error('[FLOW_PRIVADA][FE][FASE3][GERENCIA][REJECT][API_ERROR]', {
        purchaseId,
        error: error.response?.data || error.message,
        ok: false
      });

      // Manejo especifico de errores BE
      const errorCode = error.response?.data?.code;
      if (errorCode === PRIVATE_PURCHASE_ERROR_CODES.GERENCIA_REJECTION_REASON_REQUIRED) {
        console.log('[FLOW_PRIVADA][FE][FASE3][GERENCIA][REJECT][BLOCKED_EMPTY_REASON]', {
          purchaseId,
          errorCode,
          reasonLength: reason.length
        });
        showToast('El motivo del rechazo es obligatorio y no puede estar vacio', 'error');
      } else {
        showToast(error.message || 'Error al rechazar contrato', 'error');
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [purchaseId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Aprobaciones de contratos
          </h3>
          <p className="text-sm text-gray-600">
            Compras privadas pendientes de aprobacion por gerencia
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            {purchases.length} pendiente{purchases.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {purchases.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FiCheck className="mx-auto h-12 w-12 text-green-400 mb-4" />
          <p>No hay contratos pendientes de aprobacion</p>
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map((purchase) => (
            <div key={purchase.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <FiFileText className="w-4 h-4 text-blue-500" />
                    <h4 className="text-sm font-medium text-gray-900">
                      {purchase.client_snapshot?.commercial_name || 'Cliente sin nombre'}
                    </h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {purchase.offer_kind === 'comodato' ? 'Comodato' : 'Compra'}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span>ID: {purchase.id.slice(0, 8)}</span>
                    <span>
                      <FiClock className="w-3 h-3 inline mr-1" />
                      {formatDateMaybe(
                        pickFirstValidDate([
                          purchase.created_at,
                          purchase.createdAt,
                          purchase.updated_at,
                          purchase.updatedAt
                        ]),
                        'Fecha pendiente',
                        'purchase.list.created'
                      )}
                    </span>
                  </div>

                  {purchase.equipment && (
                    <p className="mt-2 text-sm text-gray-600">
                      Equipos: {Array.isArray(purchase.equipment) ? purchase.equipment.length : 'N/A'} items
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleViewDetails(purchase)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <FiEye className="w-4 h-4 mr-1" />
                    Revisar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t">
        <button
          onClick={loadPendingApprovals}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Actualizar lista
        </button>
      </div>

      <Modal
        open={detailsOpen}
        onClose={handleCloseDetails}
        title={`Aprobacion de contrato - ${selectedPurchase?.client_snapshot?.commercial_name || 'Cliente'}`}
        maxWidth="max-w-4xl"
      >
        {selectedPurchase && (
          <PurchaseApprovalModal
            purchase={selectedPurchase}
            timelineData={timelineData}
            onApprove={handleApprove}
            onReject={handleReject}
            loading={actionLoading}
          />
        )}
      </Modal>
    </div>
  );
};

/**
 * PurchaseApprovalModal - Modal para revisar y aprobar/rechazar contratos
 */
const PurchaseApprovalModal = ({ purchase, timelineData, onApprove, onReject, loading }) => {
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [contractBase64, setContractBase64] = useState('');
  const [contractFileName, setContractFileName] = useState('');
  const [contractMimeType, setContractMimeType] = useState('');


  const formatStateLabel = (state) => {
    if (!state) return 'Sin estado';
    const map = {
      pending_backoffice: 'Pendiente de backoffice',
      acp_availability_requested: 'Disponibilidad solicitada a ACP',
      acp_availability_confirmed: 'Disponibilidad confirmada',
      acp_availability_rejected: 'Disponibilidad rechazada',
      offer_sent: 'Oferta enviada',
      pending_client_signature: 'Pendiente firma de cliente',
      pending_contract_client_signature: 'Contrato pendiente firma cliente',
      offer_signed: 'Oferta firmada',
      client_registration_requested: 'Registro de cliente solicitado',
      client_registered: 'Cliente registrado',
      pending_contract_approval: 'Pendiente de aprobacion de gerencia general',
      contract_available: 'Contrato disponible',
      contract_rejected: 'Contrato rechazado',
      delivery_dates_requested: 'Fecha de entrega solicitada',
      delivery_dates_submitted: 'Fecha de entrega definida',
      waiting_dispatch: 'Esperando despacho',
      dispatch_ready: 'Despacho listo',
      delivery_act_generated: 'Acta de entrega generada',
      delivered_signed: 'Entregado'
    };
    return map[state] || state.replace(/_/g, ' ');
  };

  const formatEventLabel = (event) => {
    if (!event) return 'Evento';
    if (event.eventType === 'STATE_TRANSITION') {
      return `Cambio de estado: ${formatStateLabel(event.prevState)} -> ${formatStateLabel(event.nextState || event.newState)}`;
    }
    const map = {
      REQUEST_CREATED: 'Solicitud creada',
      CLIENT_REGISTERED: 'Cliente registrado',
      OFFER_UPLOADED: 'Oferta enviada',
      SIGNED_OFFER_UPLOADED: 'Oferta firmada recibida',
      PROVIDER_RESPONSE: 'Respuesta de disponibilidad registrada',
    CONTRACT_UPLOADED: 'Contrato subido',
    CONTRACT_CLIENT_SIGNED_UPLOADED: 'Contrato firmado por cliente cargado',
      INSPECTION_REQUESTED: 'Inspeccion de ambiente solicitada',
      RESERVATION_REQUESTED: 'Reserva solicitada al proveedor'
    };
    return map[event.eventType] || map[event.type] || 'Evento registrado';
  };

  const formatRoleLabel = (role) => {
    if (!role) return 'Rol no disponible';
    const map = {
      acp_comercial: 'ACP comercial',
      backoffice_comercial: 'Backoffice comercial',
      gerencia_general: 'Gerencia general',
      administrador: 'Administrador',
      sistema: 'Sistema'
    };
    return map[role] || role.replace(/_/g, ' ');
  };

  const formatDocLabel = (docType) => {
    const map = {
      CLIENT_REGISTRATION: 'Registro del cliente',
      CLIENT_ID: 'Documento de identidad del cliente',
      RUC: 'RUC del cliente',
      OPERATING_PERMIT: 'Permiso de funcionamiento',
      LEGAL_REP_APPOINTMENT: 'Nombramiento del representante legal',
      APPROVAL_LETTER: 'Oficio/acta de aprobacion',
      LOPDP_APPROVAL: 'Consentimiento LOPDP',
      LOPDP_RECORD: 'Registro de consentimiento LOPDP',
      LOPDP_EVIDENCE: 'Evidencia de consentimiento LOPDP',
      ACP_RESPONSE: 'Respuesta de disponibilidad',
      OFFER_DOCUMENT: 'Documento de la oferta',
      OFFER: 'Oferta enviada',
      SIGNED_OFFER: 'Oferta firmada',
    CONTRACT_DRAFT: 'Borrador del contrato',
    CONTRACT_CLIENT_SIGNED: 'Contrato firmado por cliente',
    CONTRACT_SIGNED: 'Contrato firmado',
      CONTRACT: 'Contrato',
      INSPECTION_ACT: 'Acta de inspeccion de ambiente',
      DELIVERY_ACT: 'Acta de entrega',
      COMODATO: 'Documento comodato'
    };
    return map[docType] || docType?.replace(/_/g, ' ') || 'Documento';
  };

  const handleContractFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setContractBase64('');
      setContractFileName('');
      setContractMimeType('');
      return;
    }

    setContractFileName(file.name);
    setContractMimeType(file.type || 'application/pdf');

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const base64 = String(result).split(',')[1] || '';
      setContractBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDecision = () => {
    if (decision === 'approved') {
      if (!contractBase64) {
        alert('Debe adjuntar el contrato aprobado');
        return;
      }
      onApprove(purchase.id, {
        contract_base64: contractBase64,
        file_name: contractFileName,
        mime_type: contractMimeType,
        reason: reason || 'Aprobado por gerencia'
      });
    } else if (decision === 'rejected') {
      if (!reason.trim()) {
        alert('Debe proporcionar un motivo para el rechazo');
        return;
      }
      onReject(purchase.id, reason);
    }
  };

  return (
    <div className="space-y-6">
      {/* Purchase Summary */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Resumen de la compra</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Cliente:</span> {purchase.client_snapshot?.commercial_name}
          </div>
          <div>
            <span className="font-medium">Solicitado por:</span> {timelineData?.requested_by_name || 'No disponible'}
          </div>
          <div>
            <span className="font-medium">Tipo:</span> {purchase.offer_kind === 'comodato' ? 'Comodato' : 'Compra directa'}
          </div>
          <div>
            <span className="font-medium">Fecha:</span> {formatDateMaybe(
              pickFirstValidDate([
                purchase.created_at,
                purchase.createdAt,
                purchase.updated_at,
                purchase.updatedAt
              ]),
              'Fecha pendiente',
              'purchase.detail.created'
            )}
          </div>
          <div>
            <span className="font-medium">Estado:</span> {formatStateLabel(purchase.status)}
          </div>
        </div>
      </div>

      {/* Checklist Status */}
      {timelineData?.checklist && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Estado de los documentos</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {timelineData.checklist.map((item, index) => (
              <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <div className={`w-2 h-2 rounded-full ${item.present ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className={`text-xs ${item.present ? 'text-gray-900' : 'text-gray-500'}`}>
                  {formatDocLabel(item.docType)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}


      {Array.isArray(timelineData?.documents) && timelineData.documents.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Documentos del cliente</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {timelineData.documents.map((doc) => (
              <a
                key={`${doc.doc_type}-${doc.drive_file_id}`}
                href={doc.link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <span>{formatDocLabel(doc.doc_type)}</span>
                <FiFileText className="w-4 h-4 text-blue-500" />
              </a>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(timelineData?.events) && timelineData.events.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Trazabilidad del proceso</h4>
          <div className="space-y-2">
            {timelineData.events.map((event, index) => (
              <div key={`${event.eventType || event.type}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{formatEventLabel(event)}</span>
                  <span className="text-gray-500">
                    {formatDateTimeMaybe(
                      pickFirstValidDate([
                        event.timestamp,
                        event.updated_at,
                        event.updatedAt,
                        event.created_at,
                        event.createdAt
                      ]),
                      'Fecha pendiente',
                      `event.${event.eventType || event.type || 'unknown'}`
                    )}
                  </span>
                </div>
                <div className="mt-1 text-gray-600">
                  {event.actorName ? `Persona responsable: ${event.actorName}` : 'Persona responsable: Sistema'}
                  {event.actorRole ? ` (${formatRoleLabel(event.actorRole)})` : ''}
                </div>
                {event.reason && (
                  <div className="mt-1 text-gray-500">Observacion: {event.reason}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision Section */}
      <div className="border-t pt-6">
        <h4 className="font-medium text-gray-900 mb-4">Decision de gerencia</h4>

        <div className="space-y-4">
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="approved"
                checked={decision === 'approved'}
                onChange={(e) => setDecision(e.target.value)}
                className="mr-2"
              />
              <FiCheck className="w-4 h-4 text-green-500 mr-1" />
              Aprobar y subir contrato
            </label>

            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="rejected"
                checked={decision === 'rejected'}
                onChange={(e) => setDecision(e.target.value)}
                className="mr-2"
              />
              <FiX className="w-4 h-4 text-red-500 mr-1" />
              Rechazar y pedir correcciones
            </label>
          </div>

          {(decision === 'approved' || decision === 'rejected') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {decision === 'approved' ? 'Comentarios (opcional)' : 'Motivo del rechazo (obligatorio)'}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={decision === 'approved' ? 'Agregue comentarios si aplica...' : 'Explique el motivo del rechazo...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                required={decision === 'rejected'}
              />
            </div>
          )}

          {decision === 'approved' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contrato aprobado (PDF)
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleContractFileChange}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {contractFileName && (
                <p className="text-xs text-gray-500 mt-1">
                  Archivo seleccionado: {contractFileName}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={handleDecision}
              disabled={!decision || loading[purchase.id] || (decision === 'rejected' && !reason.trim()) || (decision === 'approved' && !contractBase64)}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                decision === 'approved'
                  ? 'bg-green-600 hover:bg-green-700'
                : decision === 'rejected'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {loading[purchase.id] ? 'Procesando...' :
               decision === 'approved' ? 'Subir contrato' :
               decision === 'rejected' ? 'Rechazar y pedir correcciones' :
               'Seleccione una decision'}
            </button>
          </div>
        </div>
      </div>

      {/* Warning for rejections */}
      {decision === 'rejected' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex">
            <FiAlertTriangle className="w-5 h-5 text-orange-400 mr-3" />
            <div className="text-sm text-orange-800">
              <strong>Importante:</strong> Al rechazar, la solicitud vuelve a Backoffice
              para que se hagan los ajustes solicitados. El asesor comercial sera notificado.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivatePurchaseApprovalsWidget;
