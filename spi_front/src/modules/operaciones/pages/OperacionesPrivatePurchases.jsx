import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../core/ui/components/Card';
import { Button } from '../../../core/ui/components/Button';
import { Select } from '../../../core/ui/components/Select';
import { Badge } from '../../../core/ui/components/Badge';
import { Alert, AlertDescription } from '../../../core/ui/components/Alert';
import { Spinner } from '../../../core/ui/components/Spinner';
import Modal from '../../../core/ui/components/Modal';

// Importar componentes reutilizables del modulo comercial
import PurchaseTimelinePanel from '../../comercial/components/private-purchases/PurchaseTimelinePanel';
import DocumentChecklist from '../../comercial/components/private-purchases/DocumentChecklist';
import { formatDateEC } from '../../../core/utils/dateUtils';

// Importar API wrapper
import {
  getPrivatePurchaseById,
  getPrivatePurchaseTimeline,
  getPrivatePurchaseDocuments,
  getPrivatePurchasesByRole,
  markPrivatePurchaseEquipmentArrived,
  requestDeliveryDates,
  uploadPrivatePurchaseDeliveryGuides,
  updatePrivatePurchaseOperationsDetails,
} from '../../../core/api/privatePurchasesApi';
import { usePurchaseSSE } from '../../../core/hooks/usePurchaseSSE';

const OperacionesPrivatePurchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState(null);
  const [operationsForm, setOperationsForm] = useState({
    includesStarterKit: false,
    notes: '',
    estimatedArrivalAt: '',
    saving: false
  });
  const [guideFiles, setGuideFiles] = useState([]);
  const [guideUploadState, setGuideUploadState] = useState({
    uploading: false,
    error: null
  });

  // Estados relevantes para operaciones
  const operationStatuses = [
    'contract_available',
    'delivery_dates_requested',
    'delivery_dates_submitted',
    'calendar_events_created',
    'waiting_dispatch',
    'dispatch_ready',
    'delivery_act_draft_ready',
    'delivery_act_tech_assigned',
    'delivery_act_logistics_signed',
    'delivery_act_generated',
    'delivered_signed'
  ];

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

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'load_list',
        statusFilter,
        role: 'jefe_operaciones'
      });

      const response = await getPrivatePurchasesByRole('jefe_operaciones');
      const data = response || [];
      const filtered = statusFilter ? data.filter((item) => item.status === statusFilter) : data;
      setPurchases(filtered);
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'load_list_error',
        error: err.message,
        role: 'jefe_operaciones'
      });
      setError('Error al cargar las compras privadas');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const operationStatusSet = useMemo(() => new Set(operationStatuses), [operationStatuses]);

  usePurchaseSSE({
    type: 'private',
    debounceMs: 8000,
    onEvent: loadPurchases,
    filter: (payload) => {
      const status = payload?.request?.status;
      const fromState = payload?.meta?.from;
      const toState = payload?.meta?.to;
      return (
        operationStatusSet.has(status) ||
        operationStatusSet.has(fromState) ||
        operationStatusSet.has(toState)
      );
    }
  });

  const handleSelectPurchase = useCallback(async (purchase, options = {}) => {
    try {
      console.log('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'view_detail',
        requestId: purchase.id,
        role: 'jefe_operaciones'
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
      setOperationsForm({
        includesStarterKit: Boolean(detailResponse?.includes_starter_kit),
        notes: detailResponse?.operations_notes || '',
        estimatedArrivalAt: detailResponse?.estimated_arrival_at ? String(detailResponse.estimated_arrival_at).slice(0, 10) : '',
        saving: false
      });
      if (options.forceModal) {
        setShowDetail(true);
      } else if (typeof window !== 'undefined') {
        setShowDetail(window.innerWidth < 1024);
      }
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'view_detail_error',
        requestId: purchase.id,
        error: err.message,
        role: 'jefe_operaciones'
      });
      setError('Error al cargar detalles de la compra');
    }
  }, []);

  const handleSaveOperationsDetails = async () => {
    if (!selectedPurchase) return;
    try {
      setOperationsForm((prev) => ({ ...prev, saving: true }));
      await updatePrivatePurchaseOperationsDetails(selectedPurchase.id, {
        includes_starter_kit: operationsForm.includesStarterKit,
        operations_notes: operationsForm.notes,
        estimated_arrival_at: operationsForm.estimatedArrivalAt || null
      });
      setOperationsForm((prev) => ({ ...prev, saving: false }));
      await loadPurchases();
      const detailResponse = await getPrivatePurchaseById(selectedPurchase.id);
      setSelectedPurchase((prev) => ({
        ...prev,
        ...detailResponse
      }));
      alert('Detalles de operaciones guardados');
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'save_operations_details_error',
        requestId: selectedPurchase?.id,
        error: err.message,
        role: 'jefe_operaciones'
      });
      setOperationsForm((prev) => ({ ...prev, saving: false }));
      alert('Error guardando detalles: ' + err.message);
    }
  };

  const handleGuideFilesChange = (event) => {
    const files = Array.from(event.target.files || []);
    setGuideFiles(files);
    setGuideUploadState((prev) => ({ ...prev, error: null }));
  };

  const handleUploadGuides = async () => {
    if (!selectedPurchase || guideFiles.length === 0) {
      setGuideUploadState((prev) => ({ ...prev, error: 'Seleccione al menos una guia' }));
      return;
    }
    try {
      setGuideUploadState({ uploading: true, error: null });
      const guidesPayload = [];
      for (const file of guideFiles) {
        const base64 = await fileToBase64Payload(file);
        if (!base64) {
          throw new Error('No se pudo leer el archivo');
        }
        guidesPayload.push({
          file_base64: base64,
          file_name: file.name,
          mime_type: file.type || 'application/pdf'
        });
      }

      await uploadPrivatePurchaseDeliveryGuides(selectedPurchase.id, guidesPayload);
      setGuideFiles([]);
      setGuideUploadState({ uploading: false, error: null });
      const refreshedDocs = await getPrivatePurchaseDocuments(selectedPurchase.id);
      setSelectedPurchase((prev) => ({
        ...prev,
        documents: refreshedDocs || []
      }));
      await loadPurchases();
      alert('Guias cargadas correctamente');
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'upload_guides_error',
        requestId: selectedPurchase?.id,
        error: err.message
      });
      setGuideUploadState({ uploading: false, error: err.message });
      alert('Error subiendo guias: ' + err.message);
    }
  };

  const handleRequestDeliveryDates = async () => {
    if (!selectedPurchase) return;
    try {
      await requestDeliveryDates(selectedPurchase.id);
      await loadPurchases();
      const detailResponse = await getPrivatePurchaseById(selectedPurchase.id);
      setSelectedPurchase((prev) => ({
        ...prev,
        ...detailResponse
      }));
      alert('Solicitud de fecha de entrega enviada a comercial');
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'request_delivery_dates_error',
        requestId: selectedPurchase?.id,
        error: err.message
      });
      alert('Error solicitando fechas: ' + err.message);
    }
  };

  const handleMarkEquipmentArrived = async () => {
    if (!selectedPurchase) return;
    try {
      await markPrivatePurchaseEquipmentArrived(selectedPurchase.id);
      await loadPurchases();
      const detailResponse = await getPrivatePurchaseById(selectedPurchase.id);
      setSelectedPurchase((prev) => ({
        ...prev,
        ...detailResponse
      }));
      alert('Equipo marcado como recibido');
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'mark_equipment_arrived_error',
        requestId: selectedPurchase?.id,
        error: err.message
      });
      alert('Error marcando llegada: ' + err.message);
    }
  };

  const getStatusBadgeVariant = (status) => {
    const variants = {
      'contract_available': 'blue',
      'delivery_dates_requested': 'yellow',
      'delivery_dates_submitted': 'teal',
      'calendar_events_created': 'teal',
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
      contract_available: 'Contrato firmado',
      delivery_dates_requested: 'Fechas solicitadas',
      delivery_dates_submitted: 'Fechas definidas',
      calendar_events_created: 'Calendario generado',
      waiting_dispatch: 'Esperando despacho',
      dispatch_ready: 'Despacho listo',
      delivery_act_draft_ready: 'Acta en borrador',
      delivery_act_tech_assigned: 'Tecnico asignado',
      delivery_act_logistics_signed: 'Acta firmada por logistica',
      delivery_act_generated: 'Acta generada',
      delivered_signed: 'Entrega confirmada'
    };
    return labels[status] || status?.replace(/_/g, ' ');
  };

  const getDocumentLabel = (docType) => {
    const labels = {
      CLIENT_ID: 'Documento de identidad',
      RUC: 'RUC del cliente',
      OPERATING_PERMIT: 'Permiso de funcionamiento',
      LEGAL_REP_APPOINTMENT: 'Nombramiento representante legal',
      APPROVAL_LETTER: 'Oficio/acta de aprobacion',
      LOPDP_RECORD: 'Registro consentimiento LOPDP',
      LOPDP_EVIDENCE: 'Evidencia consentimiento LOPDP',
      OFFER: 'Oferta enviada',
      SIGNED_OFFER: 'Oferta firmada',
      CONTRACT_DRAFT: 'Borrador del contrato',
      CONTRACT_CLIENT_SIGNED: 'Contrato firmado por cliente',
      CONTRACT_SIGNED: 'Contrato firmado',
      DELIVERY_GUIDE: 'Guia de despacho',
      DELIVERY_ACT_LOGISTICS_SIGNED: 'Acta firmada por logistica',
      DELIVERY_ACT: 'Acta de entrega',
      COMODATO: 'Documento comodato'
    };
    return labels[docType] || docType?.replace(/_/g, ' ');
  };
  const formatClientName = (purchase) => {
    const snapshot = purchase.client_snapshot || {};
    return snapshot.commercial_name || snapshot.client_name || 'Cliente desconocido';
  };

  const formatDate = (dateString) => formatDateEC(dateString, '-');
  const formatDateFallback = (dateString) => (dateString ? formatDateEC(dateString, '-') : 'Pendiente');
  const filterDocumentsByType = (docs, types) => {
    if (!Array.isArray(docs)) return [];
    return docs.filter((doc) => types.includes(doc.doc_type));
  };
  const canEditOperationsDetails = (purchase, hasGuides) => {
    return [
      'contract_available',
      'delivery_dates_requested',
      'delivery_dates_submitted',
      'calendar_events_created',
      'waiting_dispatch',
      'dispatch_ready'
    ].includes(purchase?.status) && hasGuides;
  };
  const canUploadGuides = (purchase) => {
    return [
      'contract_available',
      'waiting_dispatch',
      'dispatch_ready'
    ].includes(purchase?.status);
  };

  useEffect(() => {
    if (!selectedPurchase && purchases.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      handleSelectPurchase(purchases[0], { forceModal: false });
    }
  }, [purchases, selectedPurchase, handleSelectPurchase]);

  const renderDetailContent = () => {
    if (!selectedPurchase) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Selecciona una compra para ver el detalle operativo.
        </div>
      );
    }

    const guideDocuments = filterDocumentsByType(selectedPurchase?.documents, ['DELIVERY_GUIDE']);
    const coreDocuments = filterDocumentsByType(selectedPurchase?.documents, ['SIGNED_OFFER', 'CONTRACT_SIGNED']);
    const hasGuides = guideDocuments.length > 0;
    const negotiatedItems = Array.isArray(selectedPurchase?.equipment) ? selectedPurchase.equipment : [];
    const dispatchItems = Array.isArray(selectedPurchase?.dispatch_items_json)
      ? selectedPurchase.dispatch_items_json
      : [];

    const normalizeItemKey = (item) => String(item?.id || item?.equipment_id || item?.name || "").toLowerCase().trim();
    const dispatchIndex = dispatchItems.reduce((acc, item) => {
      const key = normalizeItemKey(item);
      if (!key) return acc;
      const qty = Number(item?.quantity || item?.qty || item?.amount || 0) || 0;
      acc[key] = (acc[key] || 0) + qty;
      return acc;
    }, {});

    const deliveryControlRows = negotiatedItems.map((item, index) => {
      const key = normalizeItemKey(item) || `row-${index}`;
      const requested = Number(item?.quantity || item?.qty || 1) || 1;
      const dispatched = dispatchIndex[key] || 0;
      return {
        key,
        name: item?.name || item?.label || `Equipo ${index + 1}`,
        requested,
        dispatched,
        pending: Math.max(requested - dispatched, 0),
        completed: dispatched >= requested && requested > 0,
      };
    });

    return (
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
            <p className="text-xs text-gray-500">Fecha tentativa</p>
            <p className="text-sm text-gray-700">{formatDateFallback(selectedPurchase.estimated_arrival_at)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">Ultima actualizacion</p>
            <p className="text-sm text-gray-700">{formatDate(selectedPurchase.updated_at)}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)] min-h-0">
          <div className="space-y-4 min-h-0">
            {selectedPurchase.status === 'contract_available' && (
              <details id="delivery-request-section" className="group rounded-xl border border-gray-200 bg-white p-4" open>
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                  Solicitud de fecha de entrega
                </summary>
                <div className="mt-3 space-y-2">
                  <Button
                    variant="primary"
                    onClick={handleRequestDeliveryDates}
                    disabled={!selectedPurchase.equipment_arrived_at}
                  >
                    Solicitar fecha de entrega
                  </Button>
                  {!selectedPurchase.equipment_arrived_at && (
                    <p className="text-xs text-orange-600">
                      Marca la llegada del equipo para habilitar esta solicitud.
                    </p>
                  )}
                </div>
              </details>
            )}

            <details id="delivery-guides-section" className="group rounded-xl border border-gray-200 bg-white p-4" open>
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                Guias de despacho
              </summary>
              <div className="mt-3 space-y-4">
                <p className="text-sm text-gray-500">
                  Sube una o varias guias en PDF o imagen antes de continuar.
                </p>
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  onChange={handleGuideFilesChange}
                  disabled={!canUploadGuides(selectedPurchase)}
                />
                {guideFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                    {guideFiles.map((file) => (
                      <span
                        key={file.name}
                        className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1"
                      >
                        {file.name}
                      </span>
                    ))}
                  </div>
                )}
                {guideDocuments.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {guideDocuments.map((doc) => (
                      <a
                        key={`${doc.doc_type}-${doc.drive_file_id}`}
                        href={doc.link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <span>
                          {getDocumentLabel(doc.doc_type)}
                          {doc.doc_name ? ` - ${doc.doc_name}` : ''}
                        </span>
                        <span className="text-blue-600">Ver</span>
                      </a>
                    ))}
                  </div>
                )}
                {guideUploadState.error && (
                  <p className="text-sm text-red-600">{guideUploadState.error}</p>
                )}
                <div>
                  <Button
                    onClick={handleUploadGuides}
                    disabled={guideUploadState.uploading || !canUploadGuides(selectedPurchase)}
                  >
                    {guideUploadState.uploading ? 'Subiendo guias...' : 'Subir guias'}
                  </Button>
                </div>
              </div>
            </details>

            <details id="operations-details-section" className="group rounded-xl border border-gray-200 bg-white p-4" open>
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                Detalles de operaciones
              </summary>
              <div className="mt-3 space-y-4">
                {!hasGuides && (
                  <p className="text-sm text-orange-600">
                    Sube al menos una guia para habilitar esta seccion.
                  </p>
                )}
                <div className="flex items-center space-x-3">
                  <input
                    id="includes-starter-kit"
                    type="checkbox"
                    checked={operationsForm.includesStarterKit}
                    onChange={(e) => setOperationsForm((prev) => ({ ...prev, includesStarterKit: e.target.checked }))}
                    disabled={!canEditOperationsDetails(selectedPurchase, hasGuides)}
                  />
                  <label htmlFor="includes-starter-kit">Incluye kit de arranque</label>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fecha tentativa de llegada</label>
                  <input
                    type="date"
                    className="w-full border rounded-md p-2 text-sm"
                    value={operationsForm.estimatedArrivalAt}
                    onChange={(e) => setOperationsForm((prev) => ({ ...prev, estimatedArrivalAt: e.target.value }))}
                    disabled={!canEditOperationsDetails(selectedPurchase, hasGuides) || Boolean(selectedPurchase.equipment_arrived_at)}
                  />
                  {selectedPurchase.equipment_arrived_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      Fecha tentativa bloqueada porque el equipo ya llego.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Observaciones</label>
                  <textarea
                    className="w-full border rounded-md p-2"
                    rows={3}
                    value={operationsForm.notes}
                    onChange={(e) => setOperationsForm((prev) => ({ ...prev, notes: e.target.value }))}
                    disabled={!canEditOperationsDetails(selectedPurchase, hasGuides)}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleSaveOperationsDetails}
                    disabled={operationsForm.saving || !canEditOperationsDetails(selectedPurchase, hasGuides)}
                  >
                    {operationsForm.saving ? 'Guardando...' : 'Guardar detalles'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleMarkEquipmentArrived}
                    disabled={!hasGuides || Boolean(selectedPurchase.equipment_arrived_at)}
                  >
                    {selectedPurchase.equipment_arrived_at ? 'Equipo recibido' : 'Marcar equipo recibido'}
                  </Button>
                </div>
              </div>
            </details>

            <details id="delivery-control-section" className="group rounded-xl border border-gray-200 bg-white p-4" open>
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                Control de elementos de la negociación
              </summary>
              <div className="mt-3 space-y-3">
                {!deliveryControlRows.length ? (
                  <p className="text-sm text-gray-500">No hay equipos negociados registrados para esta compra.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-2 py-2">Elemento</th>
                          <th className="px-2 py-2">Negociado</th>
                          <th className="px-2 py-2">Despachado</th>
                          <th className="px-2 py-2">Pendiente</th>
                          <th className="px-2 py-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryControlRows.map((row) => (
                          <tr key={row.key} className="border-b border-gray-50">
                            <td className="px-2 py-2 text-gray-800">{row.name}</td>
                            <td className="px-2 py-2 text-gray-700">{row.requested}</td>
                            <td className="px-2 py-2 text-gray-700">{row.dispatched}</td>
                            <td className="px-2 py-2 text-gray-700">{row.pending}</td>
                            <td className="px-2 py-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  row.completed
                                    ? "bg-emerald-100 text-emerald-700"
                                    : row.dispatched > 0
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {row.completed ? "Completo" : row.dispatched > 0 ? "Parcial" : "Pendiente"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </details>
          </div>

          <div className="space-y-6 min-h-0">
            <div className="grid gap-4 lg:grid-cols-2">
              <div id="core-docs-section" className="rounded-xl border border-gray-200 bg-white p-4">
                <h4 className="font-semibold mb-3">Documentos clave</h4>
                {coreDocuments.length ? (
                  <div className="grid grid-cols-1 gap-2">
                    {coreDocuments.map((doc) => (
                      <a
                        key={`${doc.doc_type}-${doc.drive_file_id}`}
                        href={doc.link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <span>
                          {getDocumentLabel(doc.doc_type)}
                          {doc.doc_name ? ` - ${doc.doc_name}` : ''}
                        </span>
                        <span className="text-blue-600">Ver</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Contrato firmado y oferta firmada aun no disponibles.</p>
                )}
              </div>

              <div id="checklist-section" className="rounded-xl border border-gray-200 bg-white p-4">
                <h4 className="font-semibold mb-3">Documentos requeridos</h4>
                <div className="max-h-[260px] overflow-y-auto pr-1">
                  <DocumentChecklist checklist={selectedPurchase.checklist || []} readOnly={true} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
          <CardTitle>Compras Privadas - Operaciones</CardTitle>
          <div className="flex items-center space-x-4">
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder="Filtrar por estado"
              className="w-64"
            >
              <option value="">Todos los estados</option>
              {operationStatuses.map(status => (
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

          <div className="grid gap-6 lg:grid-cols-[minmax(0,340px),minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Compra privada</p>
                        <p className="text-sm font-semibold text-slate-900">{formatClientName(purchase)}</p>
                        <p className="text-xs text-slate-500">ID: {purchase.id.slice(0, 8)}...</p>
                      </div>
                      <Badge variant={getStatusBadgeVariant(purchase.status)}>
                        {getStatusLabel(purchase.status)}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span>Ultima actualizacion</span>
                        <span className="font-semibold text-slate-700">
                          {formatDate(purchase.updated_at)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectPurchase(purchase, { forceModal: false })}
                      >
                        Ver detalle
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {purchases.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No hay compras privadas para mostrar
                </div>
              )}
            </div>

            <div className="hidden lg:block">
              {renderDetailContent()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel de detalle */}
      <Modal
        open={showDetail && Boolean(selectedPurchase)}
        onClose={() => setShowDetail(false)}
        title={selectedPurchase ? `Detalle de compra ${selectedPurchase.id.slice(0, 8)}...` : 'Detalle de compra'}
        maxWidth="max-w-6xl"
      >
        <div className="grid gap-4 lg:grid-cols-[200px,minmax(0,1fr)]">
          <aside className="hidden lg:block rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Secciones</p>
            <div className="space-y-2">
              {selectedPurchase?.status === 'contract_available' && (
                <a className="block hover:text-slate-900" href="#delivery-request-section">
                  Solicitud de entrega
                </a>
              )}
              <a className="block hover:text-slate-900" href="#delivery-guides-section">
                Guias de despacho
              </a>
              <a className="block hover:text-slate-900" href="#operations-details-section">
                Detalles de operaciones
              </a>
              <a className="block hover:text-slate-900" href="#core-docs-section">
                Documentos clave
              </a>
              <a className="block hover:text-slate-900" href="#checklist-section">
                Checklist
              </a>
            </div>
          </aside>
          <div className="max-h-[72vh] overflow-y-auto pr-2">
            {renderDetailContent()}
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default OperacionesPrivatePurchases;





