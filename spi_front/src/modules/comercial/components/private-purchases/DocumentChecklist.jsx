import React from 'react';
import { FiCheckCircle, FiXCircle, FiFileText, FiEye, FiDownload } from 'react-icons/fi';

/**
 * DocumentChecklist - Componente para mostrar checklist de documentos requeridos
 * Incluye estado present/missing, CTAs para subir/ver documentos
 */
const DocumentChecklist = ({
  checklist = [],
  onUploadDocument,
  onViewDocument,
  onDownloadDocument,
  readOnly = false,
  showProgress = true
}) => {

  // Calcular estadísticas
  const stats = React.useMemo(() => {
    const present = checklist.filter(item => item.present).length;
    const total = checklist.length;
    return {
      present,
      total,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
      missing: total - present
    };
  }, [checklist]);

  // Traducir nombres de documentos
  const getDocumentLabel = (docType) => {
    const labels = {
      'client_registration_docs': 'Documentos de Registro Cliente',
      'registration_act': 'Acta de Registro',
      'lopdp_approval': 'Consentimiento LOPDP',
      'offer_signed': 'Oferta Firmada',
      'contract_generated': 'Contrato Generado',
      'delivery_act': 'Acta de Entrega-Recepción'
    };
    return labels[docType] || docType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Obtener icono según tipo de documento
  const getDocumentIcon = (docType) => {
    return <FiFileText className="w-4 h-4 text-gray-500" />;
  };

  // Determinar si el documento es requerido para el estado actual
  const isRequiredForCurrentState = (item) => {
    // Lógica simplificada - en implementación real esto vendría del backend
    return item.required;
  };

  if (!checklist || checklist.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500 text-sm">No hay checklist de documentos disponible</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Documentos Requeridos</h3>
          {showProgress && (
            <div className="flex items-center space-x-2">
              <div className="text-sm text-gray-600">
                {stats.present}/{stats.total} completos
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                stats.percentage === 100 ? 'bg-green-100 text-green-800' :
                stats.percentage >= 75 ? 'bg-yellow-100 text-yellow-800' :
                stats.percentage >= 50 ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }`}>
                {stats.percentage}%
              </div>
            </div>
          )}
        </div>

        {showProgress && stats.missing > 0 && (
          <div className="mt-2 text-sm text-orange-600">
            ⚠️ Faltan {stats.missing} documento{stats.missing !== 1 ? 's' : ''} para completar el proceso
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="space-y-3">
          {checklist.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {item.present ? (
                    <FiCheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <FiXCircle className="w-5 h-5 text-red-400" />
                  )}
                </div>

                <div className="flex-shrink-0">
                  {getDocumentIcon(item.docType)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className={`text-sm font-medium ${
                      item.present ? 'text-gray-900' : 'text-gray-700'
                    }`}>
                      {getDocumentLabel(item.docType)}
                    </p>
                    {item.required && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        Requerido
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 mt-1">
                    {item.present ? (
                      <span className="text-xs text-green-600 font-medium">
                        ✓ Presente
                      </span>
                    ) : (
                      <span className="text-xs text-red-600 font-medium">
                        ✗ Faltante
                      </span>
                    )}

                    {item.lastUpdatedAt && (
                      <span className="text-xs text-gray-500">
                        Última actualización: {new Date(item.lastUpdatedAt).toLocaleDateString('es-ES')}
                      </span>
                    )}
                  </div>

                  {item.source && (
                    <p className="text-xs text-gray-400 mt-1">
                      Fuente: {item.source}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {item.present && onViewDocument && (
                  <button
                    onClick={() => onViewDocument(item)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={readOnly}
                  >
                    <FiEye className="w-4 h-4 mr-1" />
                    Ver
                  </button>
                )}

                {item.present && onDownloadDocument && (
                  <button
                    onClick={() => onDownloadDocument(item)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={readOnly}
                  >
                    <FiDownload className="w-4 h-4 mr-1" />
                    Descargar
                  </button>
                )}

                {!item.present && onUploadDocument && !readOnly && (
                  <button
                    onClick={() => onUploadDocument(item)}
                    className="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <FiFileText className="w-4 h-4 mr-1" />
                    Subir
                  </button>
                )}

                {readOnly && !item.present && (
                  <span className="text-xs text-gray-400 italic">
                    Solo lectura
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Resumen final */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <strong>Estado general:</strong>
              {stats.percentage === 100 ? (
                <span className="text-green-600 ml-2">✓ Todos los documentos completos</span>
              ) : stats.percentage >= 75 ? (
                <span className="text-yellow-600 ml-2">⚠️ Casi completo</span>
              ) : stats.percentage >= 50 ? (
                <span className="text-orange-600 ml-2">⚠️ Documentos faltantes</span>
              ) : (
                <span className="text-red-600 ml-2">❌ Documentos críticos faltantes</span>
              )}
            </div>

            {stats.percentage < 100 && !readOnly && (
              <div className="text-xs text-gray-500">
                Complete los documentos faltantes para continuar con el proceso
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentChecklist;