import React from "react";
import { FiAlertTriangle, FiUser, FiMessageSquare, FiX } from "react-icons/fi";

const ObservedCaseBanner = ({
  observationData,
  onDismiss
}) => {
  if (!observationData) {
    return null;
  }

  const {
    observedBy,
    observedAt,
    reason,
    observedSections = [],
    comments = {}
  } = observationData;

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
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <FiAlertTriangle className="text-amber-600" size={24} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-amber-900">
                Caso Observado - Requiere Correcciones
              </h3>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-amber-400 hover:text-amber-600 transition-colors"
                  title="Ocultar banner"
                >
                  <FiX size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {/* Who observed and when */}
            <div className="flex items-center gap-4 text-sm text-amber-800">
              <div className="flex items-center gap-1">
                <FiUser size={14} />
                <span className="font-medium">Observado por:</span>
                <span>{observedBy || 'Usuario del sistema'}</span>
              </div>
              {observedAt && (
                <div className="flex items-center gap-1">
                  <span className="font-medium">Fecha:</span>
                  <span>{formatDate(observedAt)}</span>
                </div>
              )}
            </div>

            {/* Reason */}
            {reason && (
              <div className="bg-white border border-amber-200 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <FiMessageSquare className="text-amber-600 mt-0.5 flex-shrink-0" size={14} />
                  <div>
                    <span className="text-sm font-medium text-amber-900">Motivo de la observación:</span>
                    <p className="text-sm text-amber-800 mt-1">{reason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Observed sections */}
            {observedSections.length > 0 && (
              <div className="bg-white border border-amber-200 rounded-md p-3">
                <span className="text-sm font-medium text-amber-900">Secciones que requieren corrección:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {observedSections.map((sectionId, index) => {
                    const sectionNames = {
                      general: "Datos Generales",
                      lab: "Ambiente Laboratorio",
                      equipment: "Equipamiento",
                      lis: "Integración LIS",
                      determinations: "Determinaciones",
                      investments: "Inversiones"
                    };

                    return (
                      <span
                        key={sectionId}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full"
                      >
                        {sectionNames[sectionId] || sectionId}
                        {comments[sectionId] && (
                          <FiMessageSquare size={10} title="Tiene comentario específico" />
                        )}
                      </span>
                    );
                  })}
                </div>
                <p className="text-xs text-amber-700 mt-2">
                  Navegue a cada sección para ver los comentarios específicos y realizar las correcciones necesarias.
                </p>
              </div>
            )}

            {/* Action guidance */}
            <div className="bg-amber-100 border border-amber-300 rounded-md p-3">
              <p className="text-sm text-amber-800">
                <strong>Para continuar:</strong> Realice las correcciones requeridas en las secciones indicadas y guarde los cambios.
                El sistema se desbloqueará automáticamente una vez que todas las observaciones sean atendidas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ObservedCaseBanner;
