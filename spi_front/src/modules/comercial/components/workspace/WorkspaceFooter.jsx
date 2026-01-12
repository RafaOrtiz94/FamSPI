import React from "react";
import { FiSave, FiCheckCircle, FiLock } from "react-icons/fi";
import TransitionPanel from "./TransitionPanel";

const WorkspaceFooter = ({
  selectedSection,
  uiGuidance,
  onSectionSave,
  onSectionComplete,
  onStateTransition,
  onNavigateToSection
}) => {
  const { permissions, uiFlags, sectionOwnership } = uiGuidance;

  // Get current section rules for the selected section
  const currentSectionRules = sectionOwnership?.rules?.[selectedSection];

  // Section actions (context-aware)
  const sectionActions = [
    {
      id: "save",
      label: "Guardar Sección",
      icon: FiSave,
      disabled: !currentSectionRules?.canUserComplete, // Enable if user can edit this section
      variant: "secondary",
      onClick: onSectionSave
    },
    {
      id: "complete",
      label: "Marcar Completada",
      icon: FiCheckCircle,
      disabled: !currentSectionRules?.canUserComplete || currentSectionRules?.isCompleted, // Enable if user can complete and section isn't already completed
      variant: "primary",
      onClick: onSectionComplete
    },
    {
      id: "lock",
      label: "Bloquear Edición",
      icon: FiLock,
      disabled: !currentSectionRules?.canUserLock || currentSectionRules?.isCompleted, // Enable if user can lock and section isn't completed
      variant: "outline",
      onClick: () => console.log("Lock section")
    }
  ];

  // Note: Global actions moved to TransitionPanel component

  const getButtonClasses = (variant, disabled) => {
    const baseClasses = "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors";

    if (disabled) {
      return `${baseClasses} bg-gray-100 text-gray-400 cursor-not-allowed`;
    }

    switch (variant) {
      case "primary":
        return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700`;
      case "secondary":
        return `${baseClasses} bg-gray-600 text-white hover:bg-gray-700`;
      case "success":
        return `${baseClasses} bg-green-600 text-white hover:bg-green-700`;
      case "outline":
        return `${baseClasses} border border-gray-300 text-gray-700 bg-white hover:bg-gray-50`;
      default:
        return `${baseClasses} bg-gray-600 text-white hover:bg-gray-700`;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left side: Section actions */}
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Acciones de Sección</h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Sección actual: {selectedSection}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {sectionActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={getButtonClasses(action.variant, action.disabled)}
              >
                <action.icon size={16} />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right side: State Transitions */}
        <div className="lg:border-l lg:border-gray-200 lg:pl-6 lg:w-96">
          <TransitionPanel
            readinessStatus={uiGuidance.readinessStatus}
            onStateTransition={onStateTransition}
            onNavigateToSection={onNavigateToSection}
          />
        </div>
      </div>

      {/* Status information */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>Estado actual: <strong>{uiGuidance.workflowState.currentState}</strong></span>
            <span>•</span>
            <span>Sección: <strong>{selectedSection}</strong></span>
          </div>
          <div className="text-gray-500">
            {currentSectionRules?.isCompleted ? (
              <span className="text-green-600">✓ Sección completada</span>
            ) : currentSectionRules?.currentOwner ? (
              <span className="text-yellow-600">En edición por {currentSectionRules.currentOwner}</span>
            ) : (
              <span>Sección pendiente</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceFooter;
