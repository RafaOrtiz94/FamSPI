import React, { useState, useEffect } from 'react';
import { FiCheck, FiX, FiEye, FiFileText, FiAlertTriangle, FiClock } from 'react-icons/fi';
import { privatePurchasesApi } from '../../comercial/api/privatePurchasesApi';
import { useUI } from '../../../core/ui/useUI';

/**
 * PrivatePurchaseApprovalsWidget - Widget para gerencia general
 * Muestra compras privadas pendientes de aprobación de contrato
 */
const PrivatePurchaseApprovalsWidget = () => {
  const { showToast, showModal } = useUI();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  const loadPendingApprovals = async () => {
    try {
      setLoading(true);
      console.log('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Loading pending contract approvals');

      // Get purchases pending manager approval
      const result = await privatePurchasesApi.listPrivatePurchases({
        status: 'pending_manager_contract_approval'
      });

      console.log('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Loaded purchases:', result.data?.length || 0);
      setPurchases(result.data || []);
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

      const timelineResult = await privatePurchasesApi.getTimeline(purchase.id);
      setTimelineData(timelineResult.data);
      setSelectedPurchase(purchase);

      // Show modal with details
      showModal({
        title: `Aprobación de Contrato - ${purchase.client_snapshot?.commercial_name || 'Cliente'}`,
        size: 'xl',
        content: (
          <PurchaseApprovalModal
            purchase={purchase}
            timelineData={timelineResult.data}
            onApprove={handleApprove}
            onReject={handleReject}
            loading={actionLoading}
          />
        )
      });
    } catch (error) {
      console.error('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Error loading timeline:', error);
      showToast('Error al cargar detalles de la compra', 'error');
    }
  };

  const handleApprove = async (purchaseId, reason) => {
    try {
      setActionLoading(prev => ({ ...prev, [purchaseId]: true }));
      console.log('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Approving contract:', purchaseId);

      await privatePurchasesApi.managerDecision(purchaseId, 'approved', reason || 'Aprobado por gerencia');

      showToast('Contrato aprobado exitosamente', 'success');
      await loadPendingApprovals(); // Refresh list
    } catch (error) {
      console.error('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Error approving:', error);
      showToast(error.message || 'Error al aprobar contrato', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [purchaseId]: false }));
    }
  };

  const handleReject = async (purchaseId, reason) => {
    if (!reason || reason.trim().length === 0) {
      showToast('Debe proporcionar un motivo para el rechazo', 'warning');
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [purchaseId]: true }));
      console.log('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Rejecting contract:', purchaseId);

      await privatePurchasesApi.managerDecision(purchaseId, 'rejected', reason);

      showToast('Contrato rechazado - se solicitarán correcciones', 'info');
      await loadPendingApprovals(); // Refresh list
    } catch (error) {
      console.error('[PURCHASE_FLOW][FASE5][GERENCIA_WIDGET] Error rejecting:', error);
      showToast(error.message || 'Error al rechazar contrato', 'error');
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
            Aprobaciones de Contratos
          </h3>
          <p className="text-sm text-gray-600">
            Compras privadas pendientes de aprobación gerencial
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
          <p>No hay contratos pendientes de aprobación</p>
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
                      {new Date(purchase.created_at).toLocaleDateString('es-ES')}
                    </span>
                  </div>

                  {purchase.equipment && (
                    <p className="mt-2 text-sm text-gray-600">
                      Equipos: {Array.isArray(purchase.equipment) ? purchase.equipment.length : 'N/A'} ítems
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
    </div>
  );
};

/**
 * PurchaseApprovalModal - Modal para revisar y aprobar/rechazar contratos
 */
const PurchaseApprovalModal = ({ purchase, timelineData, onApprove, onReject, loading }) => {
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);

  const handleDecision = () => {
    if (decision === 'approved') {
      onApprove(purchase.id, reason || 'Aprobado por gerencia');
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
        <h4 className="font-medium text-gray-900 mb-2">Resumen de la Compra</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Cliente:</span> {purchase.client_snapshot?.commercial_name}
          </div>
          <div>
            <span className="font-medium">Tipo:</span> {purchase.offer_kind === 'comodato' ? 'Comodato' : 'Compra Directa'}
          </div>
          <div>
            <span className="font-medium">Fecha:</span> {new Date(purchase.created_at).toLocaleDateString('es-ES')}
          </div>
          <div>
            <span className="font-medium">Estado:</span> {purchase.status?.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* Checklist Status */}
      {timelineData?.checklist && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Estado de Documentación</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {timelineData.checklist.map((item, index) => (
              <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <div className={`w-2 h-2 rounded-full ${item.present ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className={`text-xs ${item.present ? 'text-gray-900' : 'text-gray-500'}`}>
                  {item.docType.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision Section */}
      <div className="border-t pt-6">
        <h4 className="font-medium text-gray-900 mb-4">Decisión de Gerencia</h4>

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
              Aprobar Contrato
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
              Rechazar (solicitar correcciones)
            </label>
          </div>

          {(decision === 'approved' || decision === 'rejected') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {decision === 'approved' ? 'Comentarios (opcional)' : 'Motivo del rechazo (requerido)'}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={decision === 'approved' ? 'Comentarios adicionales...' : 'Explique el motivo del rechazo...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                required={decision === 'rejected'}
              />
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={handleDecision}
              disabled={!decision || loading[purchase.id] || (decision === 'rejected' && !reason.trim())}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                decision === 'approved'
                  ? 'bg-green-600 hover:bg-green-700'
                  : decision === 'rejected'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {loading[purchase.id] ? 'Procesando...' :
               decision === 'approved' ? 'Aprobar Contrato' :
               decision === 'rejected' ? 'Rechazar y Solicitar Correcciones' :
               'Seleccionar Decisión'}
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
              <strong>Importante:</strong> El rechazo enviará la solicitud de vuelta al BackOffice
              para que realice las correcciones solicitadas. El asesor comercial será notificado.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivatePurchaseApprovalsWidget;