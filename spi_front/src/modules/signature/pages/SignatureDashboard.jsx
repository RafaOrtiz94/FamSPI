import React, { useState, useEffect } from 'react';
import { getSignatureDashboard, getDocumentAuditTrail } from '../../../core/api';

/**
 * SignatureDashboard - Dashboard de métricas y auditoría de firmas
 * ===============================================================
 *
 * Dashboard administrativo que muestra:
 * - Métricas generales de firmas
 * - Distribución por estados
 * - Actividad reciente
 * - Trail de auditoría detallado por documento
 */
const SignatureDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [auditTrail, setAuditTrail] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getSignatureDashboard();
      setDashboardData(result.dashboard);

    } catch (err) {
      console.error('Dashboard error:', err);
      setError('Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditTrail = async (documentId) => {
    try {
      setAuditLoading(true);
      setSelectedDocument(documentId);

      const result = await getDocumentAuditTrail(documentId);
      setAuditTrail(result.audit_trail);

    } catch (err) {
      console.error('Audit trail error:', err);
      setError('Error al cargar el trail de auditoría');
    } finally {
      setAuditLoading(false);
    }
  };

  const closeAuditTrail = () => {
    setSelectedDocument(null);
    setAuditTrail(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'SIGNED': return 'bg-green-100 text-green-800';
      case 'LOCKED': return 'bg-blue-100 text-blue-800';
      case 'VERIFIED': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeColor = (eventType) => {
    switch (eventType) {
      case 'FIRMA_AVANZADA_CREADA': return 'bg-green-100 text-green-800';
      case 'SELLO_INSTITUCIONAL_APLICADO': return 'bg-blue-100 text-blue-800';
      case 'QR_VERIFICACION_GENERADO': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  const { total_documents, signed_documents, locked_documents, avg_signing_time_hours, status_distribution, recent_activity } = dashboardData;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Dashboard de Firmas Electrónicas
        </h1>
        <p className="text-gray-600">
          Métricas y auditoría del sistema de firma digital avanzada
        </p>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Documentos</p>
              <p className="text-2xl font-bold text-gray-900">{total_documents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Documentos Firmados</p>
              <p className="text-2xl font-bold text-gray-900">{signed_documents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Documentos Bloqueados</p>
              <p className="text-2xl font-bold text-gray-900">{locked_documents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Tiempo Promedio</p>
              <p className="text-2xl font-bold text-gray-900">
                {avg_signing_time_hours ? `${avg_signing_time_hours.toFixed(1)}h` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Distribución por Estados */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Distribución por Estados</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {status_distribution?.map((item) => (
            <div key={item.signature_status} className="text-center">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.signature_status)}`}>
                {item.signature_status}
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">{item.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actividad Reciente */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Actividad Reciente</h2>
        <div className="space-y-3">
          {recent_activity?.map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  activity.event_type.includes('FIRMA') ? 'bg-green-500' :
                  activity.event_type.includes('SELLO') ? 'bg-blue-500' :
                  activity.event_type.includes('QR') ? 'bg-purple-500' : 'bg-gray-500'
                }`}></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {activity.event_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {activity.user_name} • Documento {activity.document_id}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  {new Date(activity.event_timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
          {(!recent_activity || recent_activity.length === 0) && (
            <p className="text-gray-500 text-center py-4">No hay actividad reciente</p>
          )}
        </div>
      </div>

      {/* Modal de Audit Trail */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold">
                Trail de Auditoría - Documento {selectedDocument}
              </h3>
              <button
                onClick={closeAuditTrail}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {auditLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : auditTrail ? (
                <div className="space-y-4">
                  {auditTrail.map((event, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getEventTypeColor(event.event_type)}`}>
                            {event.event_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm text-gray-500">
                            Posición {event.chain_position}
                          </span>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          event.is_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {event.is_verified ? 'Verificado' : 'Corrupto'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Usuario:</span>
                          <p className="text-gray-600">{event.user_name || 'Sistema'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Rol:</span>
                          <p className="text-gray-600">{event.user_role || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Fecha:</span>
                          <p className="text-gray-600">
                            {new Date(event.event_timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">IP:</span>
                          <p className="text-gray-600 font-mono">{event.ip_address || 'N/A'}</p>
                        </div>
                      </div>

                      {event.event_description && (
                        <div className="mt-2">
                          <span className="font-medium text-gray-700 text-sm">Descripción:</span>
                          <p className="text-gray-600 text-sm mt-1">{event.event_description}</p>
                        </div>
                      )}

                      {event.event_data && Object.keys(event.event_data).length > 0 && (
                        <div className="mt-2">
                          <span className="font-medium text-gray-700 text-sm">Datos del Evento:</span>
                          <pre className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(event.event_data, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div className="mt-2">
                        <span className="font-medium text-gray-700 text-sm">Hash del Evento:</span>
                        <p className="text-xs font-mono text-gray-600 mt-1 break-all">
                          {event.event_hash}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No se pudo cargar el trail de auditoría</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Botón para refrescar */}
      <div className="flex justify-center">
        <button
          onClick={loadDashboard}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Actualizando...' : 'Actualizar Dashboard'}
        </button>
      </div>

    </div>
  );
};

export default SignatureDashboard;
