import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../core/ui/components/Card';
import { Button } from '../../../core/ui/components/Button';
import { Select } from '../../../core/ui/components/Select';
import { Badge } from '../../../core/ui/components/Badge';
import { Alert, AlertDescription } from '../../../core/ui/components/Alert';
import { Spinner } from '../../../core/ui/components/Spinner';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../core/ui/components/Table';

// Importar componentes reutilizables del módulo comercial
import PurchaseTimelinePanel from '../../comercial/components/private-purchases/PurchaseTimelinePanel';
import DocumentChecklist from '../../comercial/components/private-purchases/DocumentChecklist';

// Importar API wrapper
import { privatePurchasesApi } from '../../comercial/api/privatePurchasesApi';

const OperacionesPrivatePurchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState(null);

  // Estados relevantes para operaciones
  const operationStatuses = [
    'calendar_events_created',
    'waiting_dispatch',
    'dispatch_ready',
    'delivery_act_generated',
    'delivered_pending_signatures',
    'delivered_signed'
  ];

  useEffect(() => {
    loadPurchases();
  }, [statusFilter]);

  const loadPurchases = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'load_list',
        statusFilter,
        role: 'jefe_operaciones'
      });

      const params = {};
      if (statusFilter) {
        params.status = statusFilter;
      }

      const response = await privatePurchasesApi.getList(params);
      setPurchases(response.data || []);
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
  };

  const handleViewDetail = async (purchase) => {
    try {
      console.log('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'view_detail',
        requestId: purchase.id,
        role: 'jefe_operaciones'
      });

      // Obtener detalles completos
      const detailResponse = await privatePurchasesApi.getDetail(purchase.id);
      const timelineResponse = await privatePurchasesApi.getTimeline(purchase.id);

      setSelectedPurchase({
        ...detailResponse.data,
        timeline: timelineResponse.data
      });
      setShowDetail(true);
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'view_detail_error',
        requestId: purchase.id,
        error: err.message,
        role: 'jefe_operaciones'
      });
      setError('Error al cargar detalles de la compra');
    }
  };

  const handleRequestDates = async (purchaseId) => {
    try {
      console.log('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'request_dates',
        requestId: purchaseId,
        role: 'jefe_operaciones'
      });

      await privatePurchasesApi.requestDeliveryDates(purchaseId);

      // Recargar lista para reflejar cambios
      await loadPurchases();

      alert('Fechas solicitadas exitosamente');
    } catch (err) {
      console.error('[FLOW_PRIVADA_UI][FASE2][OPS]', {
        action: 'request_dates_error',
        requestId: purchaseId,
        error: err.message,
        role: 'jefe_operaciones'
      });
      alert('Error al solicitar fechas: ' + err.message);
    }
  };

  const getStatusBadgeVariant = (status) => {
    const variants = {
      'calendar_events_created': 'blue',
      'waiting_dispatch': 'yellow',
      'dispatch_ready': 'orange',
      'delivery_act_generated': 'purple',
      'delivered_pending_signatures': 'cyan',
      'delivered_signed': 'green'
    };
    return variants[status] || 'gray';
  };

  const formatClientName = (purchase) => {
    const snapshot = purchase.client_snapshot || {};
    return snapshot.commercial_name || snapshot.client_name || 'Cliente desconocido';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-EC');
  };

  const canRequestDates = (purchase) => {
    return purchase.status === 'pending_operations_schedule';
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
                  {status.replace(/_/g, ' ').toUpperCase()}
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Última actualización</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="font-mono text-sm">
                    {purchase.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{formatClientName(purchase)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(purchase.status)}>
                      {purchase.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(purchase.updated_at)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetail(purchase)}
                      >
                        Ver detalle
                      </Button>
                      {canRequestDates(purchase) && (
                        <Button
                          size="sm"
                          onClick={() => handleRequestDates(purchase.id)}
                        >
                          Solicitar fechas
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {purchases.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay compras privadas para mostrar
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel de detalle */}
      {showDetail && selectedPurchase && (
        <Card>
          <CardHeader>
            <CardTitle>
              Detalle de Compra: {selectedPurchase.id.slice(0, 8)}...
            </CardTitle>
            <Button
              variant="outline"
              onClick={() => setShowDetail(false)}
            >
              Cerrar
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Información básica */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Cliente</h4>
                <p>{formatClientName(selectedPurchase)}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Estado</h4>
                <Badge variant={getStatusBadgeVariant(selectedPurchase.status)}>
                  {selectedPurchase.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="font-semibold mb-4">Timeline del Proceso</h4>
              <PurchaseTimelinePanel
                timeline={selectedPurchase.timeline || []}
                className="max-h-64"
              />
            </div>

            {/* Documentos */}
            <div>
              <h4 className="font-semibold mb-4">Documentos</h4>
              <DocumentChecklist
                purchase={selectedPurchase}
                readonly={true}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OperacionesPrivatePurchases;