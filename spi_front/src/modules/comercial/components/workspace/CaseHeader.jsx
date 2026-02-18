import React from "react";
import { FiRefreshCw, FiDownload, FiFileText, FiCheckCircle, FiClock, FiAlertTriangle } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";

const CaseHeader = ({ uiGuidance, onRefresh }) => {
  const { businessCaseId, clientName, workflowState, sectionOwnership } = uiGuidance || {};
  const { currentState, availableTransitions } = workflowState || {};
  const { completionSummary } = sectionOwnership || {};

  // Mock state display mapping
  const stateDisplay = {
    'DRAFT_INICIAL': { label: 'Borrador Inicial', color: 'bg-gray-100 text-gray-700', icon: FiClock },
    'DATOS_BASE_COMPLETOS': { label: 'Datos Completos', color: 'bg-blue-100 text-blue-700', icon: FiCheckCircle },
    'EN_EVALUACION_VIABILIDAD': { label: 'En Evaluación', color: 'bg-yellow-100 text-yellow-700', icon: FiAlertTriangle },
    'VIABLE': { label: 'Viable', color: 'bg-green-100 text-green-700', icon: FiCheckCircle },
    'CERRADO_PARA_APROBACION': { label: 'Para Aprobación', color: 'bg-purple-100 text-purple-700', icon: FiFileText }
  };

  const currentStateDisplay = stateDisplay[currentState] || stateDisplay['DRAFT_INICIAL'];

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
        {/* Left side: Case info */}
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-3">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{clientName}</h2>
              <p className="text-xs sm:text-sm text-gray-600 break-all">ID: {businessCaseId}</p>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${currentStateDisplay.color}`}>
              <currentStateDisplay.icon size={14} />
              {currentStateDisplay.label}
            </div>
          </div>

          {/* Progress summary */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <FiCheckCircle className="text-green-600" />
              <span>{completionSummary?.completedSections ?? 0}/{completionSummary?.totalSections ?? 0} completadas</span>
            </div>
            <div className="flex items-center gap-2">
              <FiClock className="text-yellow-600" />
              <span>{completionSummary?.inProgressSections ?? 0} en progreso</span>
            </div>
            <div className="flex items-center gap-2">
              <FiAlertTriangle className="text-gray-600" />
              <span>{completionSummary?.pendingSections ?? 0} pendientes</span>
            </div>
          </div>
        </div>

        {/* Right side: Global actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto"
          >
            <FiRefreshCw size={16} />
            Actualizar
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto"
            disabled
          >
            <FiDownload size={16} />
            Exportar
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto"
            disabled
          >
            <FiFileText size={16} />
            Audit Trail
          </button>
        </div>
      </div>
    </Card>
  );
};

export default CaseHeader;
