import React from "react";
import { FiArrowRight, FiAlertTriangle, FiCheckCircle, FiXCircle, FiNavigation } from "react-icons/fi";

const TransitionPanel = ({
  readinessStatus,
  onStateTransition,
  onNavigateToSection
}) => {
  if (!readinessStatus) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-500">Cargando estado de readiness...</p>
      </div>
    );
  }

  const {
    currentState,
    availableTransitions = [],
    canTransition,
    blockingIssues = [],
    overallReadiness
  } = readinessStatus;

  // State display labels
  const stateLabels = {
    DRAFT_INICIAL: "Borrador Inicial",
    DATOS_BASE_COMPLETOS: "Datos Base Completos",
    EQUIPAMIENTO_CONFIGURADO: "Equipamiento Configurado",
    DETERMINACIONES_COMPLETAS: "Determinaciones Completas",
    INVERSIONES_CALCULADAS: "Inversiones Calculadas",
    CALCULOS_FINALIZADOS: "Cálculos Finalizados",
    APROBADO_COMERCIAL: "Aprobado Comercial",
    LISTO_FIRMA: "Listo para Firma",
    FIRMADO: "Firmado",
    EJECUCION: "En Ejecución",
    COMPLETADO: "Completado"
  };

  // Readiness status colors
  const getReadinessColor = (readiness) => {
    switch (readiness) {
      case 'ready': return 'text-green-600 bg-green-50 border-green-200';
      case 'partial': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'blocked': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <FiArrowRight className="text-blue-600" size={20} />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Transición de Estado</h3>
          <p className="text-sm text-gray-600">Gestión del flujo de trabajo del Business Case</p>
        </div>
      </div>

      {/* Current State */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700">Estado Actual:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getReadinessColor(overallReadiness)}`}>
            {stateLabels[currentState] || currentState}
          </span>
        </div>
      </div>

      {/* Blocking Issues */}
      {blockingIssues.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <FiXCircle className="text-red-600 mt-0.5" size={16} />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900 mb-2">Requisitos Pendientes</h4>
              <div className="space-y-2">
                {blockingIssues.map((issue, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-red-600 text-xs">•</span>
                    <div className="flex-1">
                      <p className="text-sm text-red-800">{issue.message}</p>
                      {issue.section && (
                        <button
                          type="button"
                          onClick={() => onNavigateToSection(issue.section)}
                          className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-700 underline"
                        >
                          <FiNavigation size={12} />
                          Ir a {issue.section}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Available Transitions */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">Transiciones Disponibles</h4>

        {availableTransitions.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No hay transiciones disponibles en este estado</p>
        ) : (
          <div className="space-y-2">
            {availableTransitions.map((transition, index) => (
              <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <FiArrowRight className="text-blue-600" size={16} />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {stateLabels[transition.toState] || transition.toState}
                    </span>
                    {transition.description && (
                      <p className="text-xs text-gray-600">{transition.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {transition.canTransition ? (
                    <span className="text-xs text-green-600 font-medium">Disponible</span>
                  ) : (
                    <span className="text-xs text-red-600 font-medium">Bloqueado</span>
                  )}

                  <button
                    type="button"
                    onClick={() => onStateTransition(transition.toState)}
                    disabled={!transition.canTransition}
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      transition.canTransition
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Transitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overall Readiness Indicator */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {overallReadiness === 'ready' && <FiCheckCircle className="text-green-600" size={16} />}
            {overallReadiness === 'partial' && <FiAlertTriangle className="text-yellow-600" size={16} />}
            {overallReadiness === 'blocked' && <FiXCircle className="text-red-600" size={16} />}

            <span className="text-sm font-medium text-gray-900">Estado General:</span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              overallReadiness === 'ready' ? 'bg-green-100 text-green-800' :
              overallReadiness === 'partial' ? 'bg-yellow-100 text-yellow-800' :
              overallReadiness === 'blocked' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {overallReadiness === 'ready' ? 'Listo para avanzar' :
               overallReadiness === 'partial' ? 'Requiere atención' :
               overallReadiness === 'blocked' ? 'Bloqueado' :
               'Desconocido'}
            </span>
          </div>

          {!canTransition && (
            <div className="text-xs text-gray-500">
              Complete los requisitos pendientes para desbloquear transiciones
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransitionPanel;
