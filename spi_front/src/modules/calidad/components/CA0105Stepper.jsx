import React, { useMemo, useState } from "react";
import { FiCheck, FiChevronRight, FiClock, FiEdit3, FiFile, FiLock, FiX } from "react-icons/fi";

const steps = [
  {
    key: "draft",
    label: "Borrador",
    description: "Documento en edición inicial",
    icon: FiEdit3,
  },
  {
    key: "review",
    label: "Revisión",
    description: "En proceso de revisión técnica",
    icon: FiClock,
  },
  {
    key: "approved",
    label: "Aprobado",
    description: "Aprobado por el responsable",
    icon: FiFile,
  },
  {
    key: "archived",
    label: "Archivado",
    description: "Versión final archivada",
    icon: FiLock,
  },
];

export default function CA0105Stepper({ record, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [notes, setNotes] = useState("");

  const currentStatus = useMemo(() => {
    return record?.status || "draft";
  }, [record]);

  const activeStepIndex = useMemo(() => {
    return steps.findIndex((s) => s.key === currentStatus);
  }, [currentStatus]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">
          Flujo de Documento
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 p-4">
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${
                      index <= activeStepIndex
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-400"
                    }
                  `}
                >
                  {index < activeStepIndex ? (
                    <FiCheck className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`
                    text-xs font-medium mt-2
                    ${
                      index <= activeStepIndex
                        ? "text-gray-900"
                        : "text-gray-400"
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2
                    ${
                      index < activeStepIndex
                        ? "bg-blue-600"
                        : "bg-gray-200"
                    }
                  `}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Información del Documento
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Código:</span>
              <span className="ml-2 font-medium text-gray-900">
                {record?.documentCode || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Título:</span>
              <span className="ml-2 font-medium text-gray-900">
                {record?.title || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Estado:</span>
              <span className="ml-2 font-medium text-gray-900 capitalize">
                {currentStatus}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Versión:</span>
              <span className="ml-2 font-medium text-gray-900">
                {record?.currentVersion || 1}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas de Transición
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Agregar notas sobre la transición..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <div className="flex items-center gap-2">
          {currentStep < steps.length - 1 && (
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              Siguiente
              <FiChevronRight className="w-4 h-4" />
            </button>
          )}
          {currentStep === steps.length - 1 && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Finalizar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}