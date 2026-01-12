import React from "react";
import { FiMessageSquare, FiAlertTriangle } from "react-icons/fi";

const SectionObservationAlert = ({
  sectionId,
  observationData,
  onDismiss
}) => {
  if (!observationData?.comments?.[sectionId]) {
    return null;
  }

  const comment = observationData.comments[sectionId];
  const observedBy = observationData.observedBy;
  const observedAt = observationData.observedAt;

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <FiAlertTriangle className="text-amber-600 mt-0.5" size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FiMessageSquare className="text-amber-600" size={16} />
              <h4 className="text-sm font-semibold text-amber-900">
                Observación en esta sección
              </h4>
            </div>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="text-amber-400 hover:text-amber-600 transition-colors text-sm"
                title="Ocultar comentario"
              >
                ✕
              </button>
            )}
          </div>

          <div className="space-y-2">
            {/* Comment content */}
            <div className="bg-white border border-amber-200 rounded-md p-3">
              <p className="text-sm text-amber-800 leading-relaxed">{comment}</p>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-amber-700">
              {observedBy && (
                <span>
                  <strong>Observado por:</strong> {observedBy}
                </span>
              )}
              {observedAt && (
                <span>
                  <strong>Fecha:</strong> {formatDate(observedAt)}
                </span>
              )}
            </div>

            {/* Action guidance */}
            <div className="bg-amber-100 border border-amber-300 rounded-md p-2">
              <p className="text-xs text-amber-800">
                Realice las correcciones solicitadas y guarde los cambios para resolver esta observación.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectionObservationAlert;
