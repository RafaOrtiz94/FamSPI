import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../core/ui/components/Card';
import { Button } from '../../../core/ui/components/Button';
import { Select } from '../../../core/ui/components/Select';
import { Badge } from '../../../core/ui/components/Badge';
import { Alert, AlertDescription } from '../../../core/ui/components/Alert';
import { Spinner } from '../../../core/ui/components/Spinner';
import Modal from '../../../core/ui/components/Modal';
import { formatDateEC } from '../../../core/utils/dateUtils';
import { useAuth } from '../../../core/auth/AuthContext';

// Importar componentes reutilizables del módulo comercial
import PurchaseTimelinePanel from '../../comercial/components/private-purchases/PurchaseTimelinePanel';
import DocumentChecklist from '../../comercial/components/private-purchases/DocumentChecklist';

// Importar API wrapper
import {
  completeDelivery,
  getPrivatePurchaseById,
  getPrivatePurchaseDocuments,
  getPrivatePurchaseTimeline,
  getPrivatePurchasesByRole,
  markReadyForDelivery,
  uploadPrivatePurchaseDeliveryAct,
  updatePrivatePurchaseDispatchDetails
} from '../../../core/api/privatePurchasesApi';

const LogisticaPrivatePurchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState(null);
  const [dispatchItems, setDispatchItems] = useState([]);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatchSaving, setDispatchSaving] = useState(false);
  const [actaDispatchedAt, setActaDispatchedAt] = useState('');
  const [actaObservations, setActaObservations] = useState('');
  const [logisticsActaFile, setLogisticsActaFile] = useState(null);
  const [logisticsActaUploading, setLogisticsActaUploading] = useState(false);
  const { user } = useAuth();

  // Estados relevantes para logistica
  const logisticsStatuses = [
    'delivery_dates_submitted',
    'waiting_dispatch',
    'dispatch_ready',
    'delivery_act_draft_ready',
    'delivery_act_tech_assigned',
    'delivery_act_logistics_signed',
    'delivery_act_generated',
    'delivered_signed'
  ];

  useEffect(() => {
    loadPurchases();
  }, [statusFilter]);

  const loadPurchases = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[FLOW_PRIVADA_UI][FASE2][LOG]', {
        action: 'load_list',
        statusFilter,
        role: 'jefe_logistica'
      });

      const response = await getPrivatePurchasesByRole('jefe_logistica');
      const data = response || [];
      const filtered = statusFilter ? data.filter((item) => item.status === statusFilter) : data;
      setPurchases(filtered);
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][LOG]', {
        action: 'load_list_error',
        error: err.message,
        role: 'jefe_logistica'
      });
      setError('Error al cargar las compras privadas');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (purchase) => {
    try {
      console.log('[FLOW_PRIVADA_UI][FASE2][LOG]', {
        action: 'view_detail',
        requestId: purchase.id,
        role: 'jefe_logistica'
      });

      // Obtener detalles completos
      const detailResponse = await getPrivatePurchaseById(purchase.id);
      const timelineResponse = await getPrivatePurchaseTimeline(purchase.id);
      const documentsResponse = await getPrivatePurchaseDocuments(purchase.id);

      setSelectedPurchase({
        ...detailResponse,
        timeline: timelineResponse?.events || [],
        checklist: timelineResponse?.checklist || [],
        documents: documentsResponse || []
      });
      setDispatchItems(
        buildDispatchItemsFromEquipment(
          detailResponse?.equipment,
          detailResponse?.dispatch_items_json
        )
      );
      setDispatchNotes(detailResponse?.dispatch_notes || '');
      setActaDispatchedAt(
        detailResponse?.delivery_act_dispatched_at
          ? String(detailResponse.delivery_act_dispatched_at).slice(0, 10)
          : ''
      );
      setActaObservations(
        Array.isArray(detailResponse?.delivery_act_observations_json)
          ? detailResponse.delivery_act_observations_json.join('\n')
          : ''
      );
      setLogisticsActaFile(null);
      setShowDetail(true);
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][LOG]', {
        action: 'view_detail_error',
        requestId: purchase.id,
        error: err.message,
        role: 'jefe_logistica'
      });
      setError('Error al cargar detalles de la compra');
    }
  };

  const handleMarkDispatchReady = async (purchaseId) => {
    try {
      console.log('[FLOW_PRIVADA_UI][FASE2][LOG]', {
        action: 'dispatch_ready',
        requestId: purchaseId,
        role: 'jefe_logistica'
      });

      await markReadyForDelivery(purchaseId);

      // Recargar lista para reflejar cambios
      await loadPurchases();

      console.log('[FLOW_PRIVADA_UI][FASE2][LOG]', {
        action: 'dispatch_ready',
        requestId: purchaseId,
        ok: true,
        code: 'SUCCESS'
      });

      alert('Despacho marcado como listo exitosamente');
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][LOG]', {
        action: 'dispatch_ready',
        requestId: purchaseId,
        ok: false,
        code: err.code || 'ERROR'
      });

      // Manejar errores específicos del backend
      if (err.code === 'MISSING_REQUIREMENTS') {
        const requirements = err.requirements || [];
        alert(`No se puede marcar como listo: faltan prerrequisitos:\n${requirements.join('\n')}`);
      } else {
        alert('Error al marcar despacho como listo: ' + err.message);
      }
    }
  };

  const handleCompleteDelivery = async (purchaseId) => {
    try {
      console.log('[FLOW_PRIVADA_UI][FASE2][LOG]', {
        action: 'complete_delivery',
        requestId: purchaseId,
        role: 'jefe_logistica'
      });

      await completeDelivery(purchaseId);

      // Recargar lista para reflejar cambios
      await loadPurchases();

      console.log('[FLOW_PRIVADA_UI][FASE2][LOG]', {
        action: 'complete_delivery',
        requestId: purchaseId,
        ok: true,
        code: 'SUCCESS'
      });

      alert('Entrega completada exitosamente');
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][LOG]', {
        action: 'complete_delivery',
        requestId: purchaseId,
        ok: false,
        code: err.code || 'ERROR'
      });

      alert('Error al completar entrega: ' + err.message);
    }
  };

  const getStatusBadgeVariant = (status) => {
    const variants = {
      'delivery_dates_submitted': 'teal',
      'waiting_dispatch': 'yellow',
      'dispatch_ready': 'orange',
      'delivery_act_draft_ready': 'amber',
      'delivery_act_tech_assigned': 'yellow',
      'delivery_act_logistics_signed': 'blue',
      'delivery_act_generated': 'purple',
      'delivered_signed': 'green'
    };
    return variants[status] || 'gray';
  };

  const getStatusLabel = (status) => {
    const labels = {
      delivery_dates_submitted: 'Fecha de entrega registrada',
      waiting_dispatch: 'Esperando despacho',
      dispatch_ready: 'Despacho listo',
      delivery_act_draft_ready: 'Acta en borrador',
      delivery_act_tech_assigned: 'Tecnico asignado',
      delivery_act_logistics_signed: 'Acta firmada por logistica',
      delivery_act_generated: 'Acta de entrega generada',
      delivered_signed: 'Entrega confirmada'
    };
    return labels[status] || status?.replace(/_/g, ' ');
  };

  const formatClientName = (purchase) => {
    const snapshot = purchase.client_snapshot || {};
    return snapshot.commercial_name || snapshot.client_name || 'Cliente desconocido';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return formatDateEC(dateString, '-');
  };

  const formatDateTime = (dateString) => formatDateEC(dateString, '-');

  const buildDispatchItemsFromEquipment = (equipmentList, existingItems = []) => {
    const items = Array.isArray(existingItems) ? existingItems : [];
    const mapped = Array.isArray(equipmentList)
      ? equipmentList.map((item, index) => {
          const name = item?.name || item?.sku || item?.id || `Equipo ${index + 1}`;
          const quantity = item?.quantity || item?.qty || item?.amount || 1;
          const existing = items.find((entry) => entry?.equipment_name === name) || {};
          return {
            equipment_name: name,
            product_code: existing.product_code || item?.sku || '',
            quantity: existing.quantity || quantity,
            serial: existing.serial || '',
            notes: existing.notes || ''
          };
        })
      : items;

    return mapped;
  };

  const fileToBase64Payload = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === 'string' ? result.split(',')[1] || '' : '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const getDocumentLink = (docs, docType) => {
    if (!Array.isArray(docs)) return null;
    const match = docs.find((doc) => doc.doc_type === docType);
    return match?.link || null;
  };

  const resolveSnapshotValue = (snapshot, key) => {
    const sources = [
      snapshot,
      snapshot?.client_data,
      snapshot?.client_request,
      snapshot?.client,
      snapshot?.data
    ];
    for (const source of sources) {
      const value = source?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
    return '';
  };

  const getSnapshotValue = (snapshot, keys) => {
    for (const key of keys) {
      const value = resolveSnapshotValue(snapshot, key);
      if (value !== '') return value;
    }
    return '';
  };

  const formatFullName = (snapshot) => {
    const first = getSnapshotValue(snapshot, ['name', 'first_name', 'client_name']);
    const last = getSnapshotValue(snapshot, ['last_name', 'surname']);
    const combined = [first, last].filter(Boolean).join(' ').trim();
    return combined || getSnapshotValue(snapshot, ['full_name', 'legal_rep_name']);
  };

  const formatContactName = (snapshot) =>
    getSnapshotValue(snapshot, ['shipping_contact_name', 'contact_name', 'legal_rep_name', 'delivery_contact_name']);

  const formatContactPhone = (snapshot) =>
    getSnapshotValue(snapshot, ['shipping_phone', 'shipping_cellphone', 'contact_phone', 'phone', 'cellphone']);

  const handleDispatchItemChange = (index, field, value) => {
    setDispatchItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveDispatchDetails = async () => {
    if (!selectedPurchase) return;
    try {
      setDispatchSaving(true);
      await updatePrivatePurchaseDispatchDetails(selectedPurchase.id, {
        items: dispatchItems,
        notes: dispatchNotes,
        dispatched_at: actaDispatchedAt || null,
        observations: actaObservations
      });
      const detailResponse = await getPrivatePurchaseById(selectedPurchase.id);
      setSelectedPurchase((prev) => ({
        ...prev,
        ...detailResponse
      }));
      setDispatchSaving(false);
      alert('Detalles de despacho guardados');
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][LOGISTICA]', {
        action: 'save_dispatch_details_error',
        requestId: selectedPurchase?.id,
        error: err.message
      });
      setDispatchSaving(false);
      alert('Error guardando despacho: ' + err.message);
    }
  };

  const handleUploadLogisticsSignedActa = async () => {
    if (!selectedPurchase || !logisticsActaFile) return;
    try {
      setLogisticsActaUploading(true);
      const base64 = await fileToBase64Payload(logisticsActaFile);
      await uploadPrivatePurchaseDeliveryAct(selectedPurchase.id, {
        act_base64: base64,
        file_name: logisticsActaFile.name,
        mime_type: logisticsActaFile.type || 'application/pdf'
      });
      const detailResponse = await getPrivatePurchaseById(selectedPurchase.id);
      setSelectedPurchase((prev) => ({
        ...prev,
        ...detailResponse
      }));
      setLogisticsActaFile(null);
      setLogisticsActaUploading(false);
      await loadPurchases();
      alert('Acta firmada por logistica subida correctamente');
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][LOGISTICA]', {
        action: 'upload_logistics_acta_error',
        requestId: selectedPurchase?.id,
        error: err.message
      });
      setLogisticsActaUploading(false);
      alert('Error subiendo acta firmada: ' + err.message);
    }
  };

  const canMarkDispatchReady = (purchase) => {
    return purchase.status === 'waiting_dispatch';
  };

  const canCompleteDelivery = (purchase) => {
    return purchase.status === 'dispatch_ready';
  };

  const guideDocuments = Array.isArray(selectedPurchase?.documents)
    ? selectedPurchase.documents.filter((doc) => doc.doc_type === 'DELIVERY_GUIDE')
    : [];

  const actaDraftLink = selectedPurchase?.delivery_act_draft_document_id
    ? `https://drive.google.com/file/d/${selectedPurchase.delivery_act_draft_document_id}/view`
    : null;
  const actaLogisticsSignedLink = selectedPurchase?.delivery_act_logistics_signed_document_id
    ? `https://drive.google.com/file/d/${selectedPurchase.delivery_act_logistics_signed_document_id}/view`
    : null;
  const actaFinalLink = selectedPurchase?.delivery_act_document_id
    ? `https://drive.google.com/file/d/${selectedPurchase.delivery_act_document_id}/view`
    : null;
  const isDraftLocked = Boolean(selectedPurchase?.delivery_act_draft_document_id);
  const canUploadLogisticsSignedActa = selectedPurchase?.status === 'delivery_act_tech_assigned';

  const clientSnapshot = selectedPurchase?.client_snapshot || {};
  const deliveryExactDate =
    selectedPurchase?.delivery_start_at ||
    selectedPurchase?.delivery_dates_json?.start ||
    selectedPurchase?.delivery_dates?.start ||
    null;
  const deliveryExactEnd =
    selectedPurchase?.delivery_end_at ||
    selectedPurchase?.delivery_dates_json?.end ||
    selectedPurchase?.delivery_dates?.end ||
    null;

  const clientInfoRows = [
    { label: 'Ruc o cedula', value: getSnapshotValue(clientSnapshot, ['ruc_cedula', 'client_identifier', 'ruc', 'cedula', 'identification']) },
    { label: 'Direccion', value: getSnapshotValue(clientSnapshot, ['address', 'shipping_address', 'establishment_address', 'direccion']) },
    { label: 'Telefono', value: getSnapshotValue(clientSnapshot, ['phone', 'cellphone', 'shipping_phone', 'shipping_cellphone']) },
    { label: 'Fecha de entrega', value: formatDateTime(deliveryExactDate) }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
        <span className="ml-2">Cargando compras privadas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Compras Privadas - Logistica</CardTitle>
          <div className="flex items-center space-x-4">
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder="Filtrar por estado"
              className="w-64"
            >
              <option value="">Todos los estados</option>
              {logisticsStatuses.map(status => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </Select>
            <Button onClick={loadPurchases} variant="outline">
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {purchases.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay compras privadas para mostrar
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Solicitud</p>
                      <p className="font-mono text-sm text-gray-900">
                        {purchase.id.slice(0, 8)}...
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(purchase.status)}>
                      {getStatusLabel(purchase.status)}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-gray-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">Cliente</span>
                      <span className="font-medium text-gray-900">
                        {formatClientName(purchase)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">Ultima actualizacion</span>
                      <span>{formatDate(purchase.updated_at)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDetail(purchase)}
                    >
                      Ver detalle
                    </Button>
                    {canMarkDispatchReady(purchase) && (
                      <Button
                        size="sm"
                        onClick={() => handleMarkDispatchReady(purchase.id)}
                      >
                        Listo para despacho
                      </Button>
                    )}
                    {canCompleteDelivery(purchase) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCompleteDelivery(purchase.id)}
                      >
                        Completar entrega
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel de detalle */}
      <Modal
        open={showDetail && Boolean(selectedPurchase)}
        onClose={() => {
          setShowDetail(false);
        }}
        title={selectedPurchase ? `Detalle de compra ${selectedPurchase.id.slice(0, 8)}...` : 'Detalle de compra'}
        maxWidth="max-w-6xl"
      >
        {selectedPurchase && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="text-sm font-semibold text-gray-900">{formatClientName(selectedPurchase)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Estado actual</p>
                <div className="mt-1">
                  <Badge variant={getStatusBadgeVariant(selectedPurchase.status)}>
                    {getStatusLabel(selectedPurchase.status)}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Entrega exacta</p>
                <p className="text-sm text-gray-700">{formatDateTime(deliveryExactDate)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Ultima actualizacion</p>
                <p className="text-sm text-gray-700">{formatDate(selectedPurchase.updated_at)}</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
              <div className="space-y-6">
                <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="font-semibold">Resumen de la negociacion</h4>
                  <div className="grid gap-3 md:grid-cols-2 text-sm text-gray-700">
                    <div>
                      <p className="text-xs text-gray-500">Fecha tentativa de llegada</p>
                      <p>{formatDate(selectedPurchase.estimated_arrival_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Llegada confirmada</p>
                      <p>{formatDate(selectedPurchase.equipment_arrived_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Fecha exacta de entrega</p>
                      <p>{formatDateTime(deliveryExactDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Fin entrega</p>
                      <p>{formatDateTime(deliveryExactEnd)}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 text-sm text-gray-700">
                    <div>
                      <p className="text-xs text-gray-500">Documento oferta firmada</p>
                      {getDocumentLink(selectedPurchase.documents, 'SIGNED_OFFER') ? (
                        <a
                          href={getDocumentLink(selectedPurchase.documents, 'SIGNED_OFFER')}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600"
                        >
                          Ver oferta firmada
                        </a>
                      ) : (
                        <p>No disponible</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Contrato firmado por cliente</p>
                      {getDocumentLink(selectedPurchase.documents, 'CONTRACT_CLIENT_SIGNED') ? (
                        <a
                          href={getDocumentLink(selectedPurchase.documents, 'CONTRACT_CLIENT_SIGNED')}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600"
                        >
                          Ver contrato cliente
                        </a>
                      ) : (
                        <p>No disponible</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Contrato firmado por gerencia</p>
                      {getDocumentLink(selectedPurchase.documents, 'CONTRACT_SIGNED') ? (
                        <a
                          href={getDocumentLink(selectedPurchase.documents, 'CONTRACT_SIGNED')}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600"
                        >
                          Ver contrato final
                        </a>
                      ) : (
                        <p>No disponible</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Acta de entrega</p>
                      {getDocumentLink(selectedPurchase.documents, 'DELIVERY_ACT') ? (
                        <a
                          href={getDocumentLink(selectedPurchase.documents, 'DELIVERY_ACT')}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600"
                        >
                          Ver acta de entrega
                        </a>
                      ) : (
                        <p>No disponible</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="font-semibold mb-3">Datos del cliente para despacho</h4>
                  <div className="grid gap-3 md:grid-cols-2 text-sm text-gray-700">
                    {clientInfoRows.map((row) => (
                      <div key={row.label}>
                        <p className="text-xs text-gray-500">{row.label}</p>
                        <p className="font-medium text-gray-900">{row.value || 'No registrado'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                  <div>
                    <h4 className="font-semibold">Datos de despacho</h4>
                    <p className="text-sm text-gray-500">
                      Completa los datos para el despacho antes de generar el acta.
                    </p>
                  </div>
                  {isDraftLocked && (
                    <Alert>
                      <AlertDescription>
                        El borrador del acta ya fue generado. Ahora esta pendiente de asignacion del tecnico.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="grid gap-3 md:grid-cols-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Numero de acta</p>
                      <p className="font-medium text-gray-900">{selectedPurchase.delivery_act_number || 'Pendiente'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Despachado por</p>
                      <p className="font-medium text-gray-900">{user?.fullname || user?.name || user?.email || 'Usuario'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Fecha de despacho</label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                        value={actaDispatchedAt}
                        onChange={(event) => setActaDispatchedAt(event.target.value)}
                        disabled={isDraftLocked}
                      />
                    </div>
                  </div>
                  {dispatchItems.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay equipos para despachar.</p>
                  ) : (
                    <div className="space-y-4">
                      {dispatchItems.map((item, index) => (
                        <div key={`${item.equipment_name}-${index}`} className="rounded-lg border border-gray-200 p-3">
                          <div className="grid gap-3 md:grid-cols-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-500">Codigo del producto</label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                                value={item.product_code || ''}
                                onChange={(event) => handleDispatchItemChange(index, 'product_code', event.target.value)}
                                disabled={isDraftLocked}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500">Nombre del equipo</label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm"
                                value={item.equipment_name || ''}
                                disabled
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500">Cantidad</label>
                              <input
                                type="number"
                                min="1"
                                className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                                value={item.quantity || 1}
                                onChange={(event) => handleDispatchItemChange(index, 'quantity', Number(event.target.value) || 1)}
                                disabled={isDraftLocked}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500">Serie</label>
                              <input
                                type="text"
                                className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                                value={item.serial || ''}
                                onChange={(event) => handleDispatchItemChange(index, 'serial', event.target.value)}
                                disabled={isDraftLocked}
                              />
                            </div>
                          </div>
                          <div className="mt-3">
                            <label className="text-xs font-semibold text-gray-500">Observaciones</label>
                            <textarea
                              rows={2}
                              className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                              value={item.notes || ''}
                              onChange={(event) => handleDispatchItemChange(index, 'notes', event.target.value)}
                              disabled={isDraftLocked}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Observaciones generales</label>
                    <textarea
                      rows={3}
                      className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                      value={dispatchNotes}
                      onChange={(event) => setDispatchNotes(event.target.value)}
                      disabled={isDraftLocked}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Observaciones del acta (una por linea)</label>
                    <textarea
                      rows={3}
                      className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                      value={actaObservations}
                      onChange={(event) => setActaObservations(event.target.value)}
                      disabled={isDraftLocked}
                    />
                  </div>
                  <div>
                    <Button onClick={handleSaveDispatchDetails} disabled={dispatchSaving || isDraftLocked}>
                      {dispatchSaving ? 'Guardando...' : 'Guardar datos de despacho'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="font-semibold mb-4">Timeline del proceso</h4>
                  <PurchaseTimelinePanel
                    requestId={selectedPurchase.id}
                    className="max-h-72"
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="font-semibold mb-4">Documentos</h4>
                  <DocumentChecklist
                    checklist={selectedPurchase.checklist || []}
                    readOnly={true}
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="font-semibold">Guias de despacho registradas</h4>
                  {guideDocuments.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {guideDocuments.map((doc) => (
                        <a
                          key={`${doc.doc_type}-${doc.drive_file_id}`}
                          href={doc.link}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <span>
                            Guia de despacho
                            {doc.doc_name ? ` - ${doc.doc_name}` : ''}
                          </span>
                          <span className="text-blue-600">Ver</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Operaciones aun no registra guias de despacho.</p>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="font-semibold">Acta de entrega-recepcion</h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {actaDraftLink && (
                      <a
                        href={actaDraftLink}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700"
                      >
                        Ver borrador
                      </a>
                    )}
                    {actaLogisticsSignedLink && (
                      <a
                        href={actaLogisticsSignedLink}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700"
                      >
                        Ver firmado por logistica
                      </a>
                    )}
                    {actaFinalLink && (
                      <a
                        href={actaFinalLink}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700"
                      >
                        Ver acta final
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    El acta se genera automaticamente al guardar los datos de despacho.
                  </p>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500">Subir acta firmada por logistica</label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(event) => setLogisticsActaFile(event.target.files?.[0] || null)}
                      disabled={!canUploadLogisticsSignedActa}
                    />
                    {logisticsActaFile && (
                      <p className="text-xs text-gray-500">Archivo seleccionado: {logisticsActaFile.name}</p>
                    )}
                    <Button
                      onClick={handleUploadLogisticsSignedActa}
                      disabled={!canUploadLogisticsSignedActa || logisticsActaUploading || !logisticsActaFile}
                    >
                      {logisticsActaUploading ? 'Subiendo...' : 'Subir acta firmada'}
                    </Button>
                    {!canUploadLogisticsSignedActa && (
                      <p className="text-xs text-gray-500">
                        Esta accion se habilita cuando el tecnico ha sido asignado.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LogisticaPrivatePurchases;
