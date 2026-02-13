import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../core/ui/components/Card';
import { Button } from '../../../core/ui/components/Button';
import { Select } from '../../../core/ui/components/Select';
import { Badge } from '../../../core/ui/components/Badge';
import { Alert, AlertDescription } from '../../../core/ui/components/Alert';
import { Spinner } from '../../../core/ui/components/Spinner';
import Modal from '../../../core/ui/components/Modal';
import { formatDateEC } from '../../../core/utils/dateUtils';
import { useAuth } from '../../../core/auth/AuthContext';

import PurchaseTimelinePanel from '../../comercial/components/private-purchases/PurchaseTimelinePanel';
import DocumentChecklist from '../../comercial/components/private-purchases/DocumentChecklist';
import {
  assignPrivatePurchaseDeliveryActTechnician,
  finalizePrivatePurchaseDeliveryAct,
  getPrivatePurchaseById,
  getPrivatePurchaseDocuments,
  getPrivatePurchaseTimeline,
  getPrivatePurchasesByRole
} from '../../../core/api/privatePurchasesApi';
import { usePurchaseSSE } from '../../../core/hooks/usePurchaseSSE';

const PrivatePurchaseDeliveries = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({ assignedEmail: '', assignedName: '' });
  const [finalActaFile, setFinalActaFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const allowedStatuses = [
    'waiting_dispatch',
    'dispatch_ready',
    'delivery_act_draft_ready',
    'delivery_act_tech_assigned',
    'delivery_act_logistics_signed',
    'delivery_act_generated'
  ];

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const roleParam = isLeadRole ? 'jefe_tecnico' : 'tecnico';
      console.log('[PRIVATE_PURCHASES][TECNICO][LOAD]', {
        roleParam,
        roleList,
        scopeList,
        mergedRoles,
        isLeadRole
      });
      const response = await getPrivatePurchasesByRole(roleParam);
      console.log('[PRIVATE_PURCHASES][TECNICO][RESPONSE]', {
        roleParam,
        count: Array.isArray(response) ? response.length : 0,
        sample: Array.isArray(response) ? response[0] : null
      });
      const data = response || [];
      const filtered = statusFilter ? data.filter((item) => item.status === statusFilter) : data;
      setPurchases(filtered);
    } catch (err) {
      console.warn('[PRIVATE_PURCHASES][TECNICO][ERROR]', {
        message: err?.message || err,
        roleList,
        scopeList,
        mergedRoles,
        isLeadRole
      });
      setError('Error al cargar las compras privadas');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, isLeadRole, roleList, scopeList, mergedRoles]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const allowedStatusSet = useMemo(() => new Set(allowedStatuses), [allowedStatuses]);

  usePurchaseSSE({
    type: 'private',
    debounceMs: 8000,
    onEvent: loadPurchases,
    filter: (payload) => {
      const status = payload?.request?.status;
      const fromState = payload?.meta?.from;
      const toState = payload?.meta?.to;
      return (
        allowedStatusSet.has(status) ||
        allowedStatusSet.has(fromState) ||
        allowedStatusSet.has(toState)
      );
    }
  });

  const handleViewDetail = async (purchase) => {
    try {
      const detailResponse = await getPrivatePurchaseById(purchase.id);
      const timelineResponse = await getPrivatePurchaseTimeline(purchase.id);
      const documentsResponse = await getPrivatePurchaseDocuments(purchase.id);

      setSelectedPurchase({
        ...detailResponse,
        timeline: timelineResponse?.events || [],
        checklist: timelineResponse?.checklist || [],
        documents: documentsResponse || []
      });
      setAssignmentForm({
        assignedEmail: detailResponse?.delivery_act_assigned_to_email || '',
        assignedName: detailResponse?.delivery_act_assigned_to_name || ''
      });
      setFinalActaFile(null);
      setShowDetail(true);
    } catch (err) {
      setError('Error al cargar detalles de la compra');
    }
  };

  const formatDate = (value) => formatDateEC(value, '-');
  const formatClientName = (purchase) => {
    const snapshot = purchase.client_snapshot || {};
    return snapshot.commercial_name || snapshot.client_name || 'Cliente desconocido';
  };

  const getStatusLabel = (status) => {
    const labels = {
      waiting_dispatch: 'Esperando despacho',
      dispatch_ready: 'Despacho listo',
      delivery_act_draft_ready: 'Acta en borrador',
      delivery_act_tech_assigned: 'Tecnico asignado',
      delivery_act_logistics_signed: 'Acta firmada por logistica',
      delivery_act_generated: 'Acta final firmada'
    };
    return labels[status] || status?.replace(/_/g, ' ');
  };

  const getStatusBadgeVariant = (status) => {
    const variants = {
      waiting_dispatch: 'yellow',
      dispatch_ready: 'orange',
      delivery_act_draft_ready: 'amber',
      delivery_act_tech_assigned: 'yellow',
      delivery_act_logistics_signed: 'blue',
      delivery_act_generated: 'purple'
    };
    return variants[status] || 'gray';
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

  const normalizeRoleList = (value) => {
    if (Array.isArray(value)) {
      return value.map((role) => String(role || '').toLowerCase()).filter(Boolean);
    }
    if (!value) return [];
    return String(value)
      .split(',')
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean);
  };

  const roleList = normalizeRoleList(user?.role);
  const scopeList = normalizeRoleList(user?.scope);
  const mergedRoles = Array.from(new Set([...roleList, ...scopeList]));

  const isLeadRole = mergedRoles.some((role) =>
    role.includes('jefe_tecnico') || role.includes('jefe_servicio_tecnico')
  );

  const isAssignedTechnician = () => {
    if (!selectedPurchase) return false;
    if (selectedPurchase.delivery_act_assigned_to_user_id && user?.id) {
      return selectedPurchase.delivery_act_assigned_to_user_id === user.id;
    }
    if (selectedPurchase.delivery_act_assigned_to_email && user?.email) {
      return selectedPurchase.delivery_act_assigned_to_email === user.email;
    }
    return false;
  };

  const handleAssignTechnician = async () => {
    if (!selectedPurchase) return;
    try {
      setSaving(true);
      await assignPrivatePurchaseDeliveryActTechnician(selectedPurchase.id, {
        assigned_to_email: assignmentForm.assignedEmail,
        assigned_to_name: assignmentForm.assignedName
      });
      const detailResponse = await getPrivatePurchaseById(selectedPurchase.id);
      setSelectedPurchase((prev) => ({ ...prev, ...detailResponse }));
      setSaving(false);
      await loadPurchases();
      alert('Tecnico asignado correctamente');
    } catch (err) {
      setSaving(false);
      alert('Error asignando tecnico: ' + err.message);
    }
  };

  const handleFinalActaUpload = async () => {
    if (!selectedPurchase || !finalActaFile) return;
    try {
      setSaving(true);
      const base64 = await fileToBase64Payload(finalActaFile);
      await finalizePrivatePurchaseDeliveryAct(selectedPurchase.id, {
        act_base64: base64,
        file_name: finalActaFile.name,
        mime_type: finalActaFile.type || 'application/pdf'
      });
      const detailResponse = await getPrivatePurchaseById(selectedPurchase.id);
      setSelectedPurchase((prev) => ({ ...prev, ...detailResponse }));
      setSaving(false);
      await loadPurchases();
      alert('Acta final subida correctamente');
    } catch (err) {
      setSaving(false);
      alert('Error subiendo acta final: ' + err.message);
    }
  };

  const dispatchItems = Array.isArray(selectedPurchase?.dispatch_items_json)
    ? selectedPurchase.dispatch_items_json
    : [];
  const observations = Array.isArray(selectedPurchase?.delivery_act_observations_json)
    ? selectedPurchase.delivery_act_observations_json
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
        <span className="ml-2">Cargando entregas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Entregas de compras privadas</CardTitle>
          <div className="flex items-center space-x-4">
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder="Filtrar por estado"
              className="w-64"
            >
              <option value="">Todos los estados</option>
              {allowedStatuses.map((status) => (
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={showDetail && Boolean(selectedPurchase)}
        onClose={() => setShowDetail(false)}
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
                <p className="text-xs text-gray-500">Numero de acta</p>
                <p className="text-sm text-gray-700">{selectedPurchase.delivery_act_number || 'Pendiente'}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Ultima actualizacion</p>
                <p className="text-sm text-gray-700">{formatDate(selectedPurchase.updated_at)}</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
              <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                  <h4 className="font-semibold">Equipos a entregar</h4>
                  {dispatchItems.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay equipos registrados.</p>
                  ) : (
                    <div className="space-y-3">
                      {dispatchItems.map((item, index) => (
                        <div key={`${item.equipment_name}-${index}`} className="rounded-lg border border-gray-200 p-3 text-sm">
                          <div className="flex flex-wrap gap-2 text-gray-600">
                            <span className="font-semibold text-gray-900">{item.equipment_name || 'Equipo'}</span>
                            <span>Codigo: {item.product_code || '-'}</span>
                            <span>Cantidad: {item.quantity || 1}</span>
                            <span>Serie: {item.serial || '-'}</span>
                          </div>
                          {item.notes && (
                            <p className="text-xs text-gray-500 mt-2">Obs: {item.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold">Asignacion de tecnico</h4>
                    <Badge variant={getStatusBadgeVariant(selectedPurchase.status)}>
                      {getStatusLabel(selectedPurchase.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    El acta se asigna primero y luego logistica firma el documento.
                  </p>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Correo del tecnico asignado</label>
                    <input
                      type="email"
                      className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                      value={assignmentForm.assignedEmail}
                      onChange={(event) => setAssignmentForm((prev) => ({ ...prev, assignedEmail: event.target.value }))}
                      disabled={!isLeadRole || selectedPurchase.status !== 'delivery_act_draft_ready'}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Nombre del tecnico</label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                      value={assignmentForm.assignedName}
                      onChange={(event) => setAssignmentForm((prev) => ({ ...prev, assignedName: event.target.value }))}
                      disabled={!isLeadRole || selectedPurchase.status !== 'delivery_act_draft_ready'}
                    />
                  </div>
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
                  </div>
                  {observations.length > 0 && (
                    <div className="text-xs text-gray-500">
                      Observaciones del acta:
                      <ul className="mt-2 list-disc list-inside">
                        {observations.map((obs, idx) => (
                          <li key={`${obs}-${idx}`}>{obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button
                    onClick={handleAssignTechnician}
                    disabled={saving || !isLeadRole || selectedPurchase.status !== 'delivery_act_draft_ready'}
                  >
                    {saving ? 'Asignando...' : 'Asignar tecnico'}
                  </Button>
                  {!isLeadRole && (
                    <p className="text-xs text-gray-500">
                      Solo jefe tecnico puede asignar.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                  <h4 className="font-semibold">Acta firmada por tecnico y cliente</h4>
                  <p className="text-sm text-gray-500">
                    Descarga el acta firmada por logistica y sube la version firmada por tecnico y cliente.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {actaLogisticsSignedLink && (
                      <a
                        href={actaLogisticsSignedLink}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700"
                      >
                        Ver acta firmada por logistica
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
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => setFinalActaFile(event.target.files?.[0] || null)}
                    disabled={!isAssignedTechnician() || selectedPurchase.status !== 'delivery_act_logistics_signed'}
                  />
                  {finalActaFile && (
                    <p className="text-xs text-gray-500">Archivo seleccionado: {finalActaFile.name}</p>
                  )}
                  <Button
                    onClick={handleFinalActaUpload}
                    disabled={
                      saving ||
                      !finalActaFile ||
                      !isAssignedTechnician() ||
                      selectedPurchase.status !== 'delivery_act_logistics_signed'
                    }
                  >
                    {saving ? 'Subiendo...' : 'Subir acta final'}
                  </Button>
                  {selectedPurchase.status === 'delivery_act_logistics_signed' && !isAssignedTechnician() && (
                    <p className="text-xs text-gray-500">
                      Solo el tecnico asignado puede subir el acta final.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="font-semibold mb-4">Linea de tiempo del proceso</h4>
                  <PurchaseTimelinePanel requestId={selectedPurchase.id} compact />
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="font-semibold mb-3">Documentos requeridos</h4>
                  <DocumentChecklist checklist={selectedPurchase.checklist || []} readOnly={true} />
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PrivatePurchaseDeliveries;






