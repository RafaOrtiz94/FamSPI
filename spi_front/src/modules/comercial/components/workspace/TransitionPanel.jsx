import React from "react";
import { FiArrowRight, FiAlertTriangle, FiCheckCircle, FiXCircle, FiNavigation } from "react-icons/fi";

const TransitionPanel = ({
  readinessStatus,
  onStateTransition,
  onNavigateToSection
}) => {
  if (!readinessStatus) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-gray-500 font-medium animate-pulse">Cargando estado de readiness...</p>
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

  const getReadinessColor = (status) => {
    switch (status) {
      case 'ready': return 'bg-green-100 text-green-800 border-green-200';
      case 'partial': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'blocked': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <FiArrowRight size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 tracking-tight">Transición de Estado</h3>
          <p className="text-sm text-gray-500">Gestión del flujo de trabajo</p>
        </div>
      </div>

      {/* Current State */}
      <div className="mb-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estado Actual</span>
          <div className={`px-4 py-2 rounded-xl border text-sm font-bold w-fit ${getReadinessColor(overallReadiness)}`}>
            {stateLabels[currentState] || currentState}
          </div>
        </div>
      </div>

      {/* Blocking Issues */}
      {blockingIssues.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl">
          <div className="flex items-start gap-3">
            <FiXCircle className="text-red-600 mt-0.5 flex-shrink-0" size={18} />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-red-900 mb-2">Requisitos Pendientes</h4>
              <div className="space-y-3">
                {blockingIssues.map((issue, index) => (
                  <div key={index} className="flex flex-col gap-1">
                    <p className="text-sm text-red-800 leading-relaxed">{issue.message}</p>
                    {issue.section && (
                      <button
                        type="button"
                        onClick={() => onNavigateToSection(issue.section)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline w-fit"
                      >
                        <FiNavigation size={12} />
                        Ir a la sección
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Available Transitions */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-gray-900 tracking-tight">Siguientes Pasos</h4>

        {availableTransitions.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
             <p className="text-sm text-gray-500 italic">No hay transiciones disponibles</p>
          </div>
        ) : (
          <div className="space-y-3">
            {availableTransitions.map((transition, index) => (
              <div key={index} className="group p-4 border border-gray-100 rounded-2xl hover:shadow-md transition-all duration-200 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-900">
                        {stateLabels[transition.toState] || transition.toState}
                        </span>
                        {transition.canTransition ? (
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                        ) : (
                            <span className="inline-block w-2 h-2 rounded-full bg-gray-300"></span>
                        )}
                    </div>
                    {transition.description && (
                      <p className="text-xs text-gray-500 leading-relaxed">{transition.description}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onStateTransition(transition.toState)}
                    disabled={!transition.canTransition}
                    className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-full transition-all active:scale-95 ${
                      transition.canTransition
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-blue-200'
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
      <div className="mt-6 pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {overallReadiness === 'ready' && <FiCheckCircle className="text-green-600" size={18} />}
            {overallReadiness === 'partial' && <FiAlertTriangle className="text-amber-500" size={18} />}
            {overallReadiness === 'blocked' && <FiXCircle className="text-red-500" size={18} />}

            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              overallReadiness === 'ready' ? 'bg-green-50 text-green-700' :
              overallReadiness === 'partial' ? 'bg-amber-50 text-amber-700' :
              overallReadiness === 'blocked' ? 'bg-red-50 text-red-700' :
              'bg-gray-50 text-gray-600'
            }`}>
              {overallReadiness === 'ready' ? 'Listo' :
               overallReadiness === 'partial' ? 'Revisión' :
               overallReadiness === 'blocked' ? 'Bloqueado' :
               'Desconocido'}
            </span>
          </div>

          {!canTransition && (
            <div className="text-xs font-medium text-gray-400">
              Complete requisitos
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransitionPanel;
