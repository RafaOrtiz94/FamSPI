import React from "react";
import { FiCheckCircle, FiClock, FiLock, FiAlertTriangle, FiUser, FiMessageSquare } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import { useAuth } from "../../../../core/auth/AuthContext";

/**
 * Role-based section visibility configuration
 * Defines which sections each role can see and edit
 */
const ROLE_SECTION_CONFIG = {
  // Comercial roles - operational data
  comercial: {
    visible: ["general", "lab", "equipment", "lis", "determinations"],
    canEdit: ["general", "lab", "equipment", "lis"],
  },
  acp_comercial: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "investments", "prices"],
    canEdit: ["general", "lab", "equipment", "lis", "investments"],
  },
  // Manager roles - full access
  jefe_comercial: {
    visible: "all",
    canEdit: "all",
  },
  gerencia: {
    visible: "all",
    canEdit: ["calculations", "rentability", "prices"],
  },
  gerencia_general: {
    visible: "all",
    canEdit: "all",
  },
  // Technical roles - equipment/determinations focus
  operaciones: {
    visible: ["equipment", "determinations", "calculations"],
    canEdit: ["equipment", "determinations"],
  },
  jefe_operaciones: {
    visible: ["equipment", "determinations", "calculations", "investments"],
    canEdit: ["equipment", "determinations", "investments"],
  },
  servicio_tecnico: {
    visible: ["equipment", "determinations"],
    canEdit: [],
  },
  jefe_tecnico: {
    visible: ["equipment", "determinations", "calculations", "investments"],
    canEdit: ["equipment", "investments"],
  },
  // Admin - full access
  admin: {
    visible: "all",
    canEdit: "all",
  },
};

const SectionNavigator = ({
  selectedSection,
  uiGuidance,
  onSectionSelect,
  observationData
}) => {
  const { user } = useAuth();
  const userRole = (user?.role || "").toLowerCase();

  const { sectionOwnership } = uiGuidance;
  const { rules } = sectionOwnership;

  // Get role config, default to showing all if role not found
  const roleConfig = ROLE_SECTION_CONFIG[userRole] || { visible: "all", canEdit: [] };

  // Full section list
  const allSections = [
    {
      id: "general",
      title: "Datos Generales",
      description: "Cliente, contrato y requerimientos básicos",
      icon: "📋"
    },
    {
      id: "lab",
      title: "Entorno Laboratorio",
      description: "Configuración y operación del laboratorio",
      icon: "🏥"
    },
    {
      id: "equipment",
      title: "Equipamiento",
      description: "Selección y configuración de equipos",
      icon: "💻"
    },
    {
      id: "lis",
      title: "Integración LIS",
      description: "Sistema de información laboratorio",
      icon: "🔗"
    },
    {
      id: "determinations",
      title: "Determinaciones",
      description: "Análisis y cuantificaciones",
      icon: "📊"
    },
    {
      id: "investments",
      title: "Inversiones",
      description: "Costos adicionales y presupuestos",
      icon: "💰"
    },
    {
      id: "prices",
      title: "Precios",
      description: "Definición de precios y márgenes",
      icon: "💵"
    },
    {
      id: "calculations",
      title: "Cálculos",
      description: "Análisis técnico y viabilidad",
      icon: "🧮"
    },
    {
      id: "rentability",
      title: "Rentabilidad",
      description: "ROI y análisis financiero",
      icon: "📈"
    }
  ];

  // Filter sections based on role
  const visibleSections = roleConfig.visible === "all"
    ? allSections
    : allSections.filter(s => roleConfig.visible.includes(s.id));

  // Check if section is editable by current role
  const canEditSection = (sectionId) => {
    if (roleConfig.canEdit === "all") return true;
    return roleConfig.canEdit.includes(sectionId);
  };

  const getSectionStatus = (sectionId) => {
    const rule = rules[sectionId];
    const isObserved = observationData?.observedSections?.includes(sectionId);
    const hasComment = observationData?.comments?.[sectionId];
    const isLocked = !canEditSection(sectionId);

    // Priority: locked > observed > completed > in-progress > pending
    if (isLocked && !rule?.isCompleted) {
      return {
        status: "locked",
        icon: FiLock,
        color: "text-gray-400",
        isLocked: true
      };
    }

    if (isObserved) {
      return {
        status: "observed",
        icon: FiAlertTriangle,
        color: "text-amber-600",
        hasComment: Boolean(hasComment),
        isObserved: true
      };
    }

    if (!rule) return { status: "pending", icon: FiClock, color: "text-gray-400" };

    if (rule.isCompleted) {
      return {
        status: "completed",
        icon: FiCheckCircle,
        color: "text-green-600",
        completedBy: rule.completedBy,
        completedAt: rule.completedAt
      };
    }

    if (rule.currentOwner) {
      return {
        status: "in-progress",
        icon: FiAlertTriangle,
        color: "text-yellow-600",
        currentOwner: rule.currentOwner
      };
    }

    return { status: "pending", icon: FiClock, color: "text-gray-400" };
  };

  return (
    <Card className="p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Secciones</h3>
          <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
            {visibleSections.length} de {allSections.length}
          </span>
        </div>

        {visibleSections.map((section) => {
          const status = getSectionStatus(section.id);
          const isSelected = selectedSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => onSectionSelect(section.id)}
              disabled={status.isLocked}
              className={`w-full text-left p-3 rounded-lg transition-all ${status.isLocked
                  ? "opacity-60 cursor-not-allowed bg-gray-50 border border-gray-200"
                  : isSelected
                    ? status.isObserved
                      ? "bg-amber-50 border border-amber-300"
                      : "bg-blue-50 border border-blue-200"
                    : status.isObserved
                      ? "hover:bg-amber-50 border border-amber-200"
                      : "hover:bg-gray-50 border border-transparent"
                }`}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className={`flex-shrink-0 mt-0.5 ${status.color}`}>
                  <status.icon size={16} />
                </div>

                {/* Section content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{section.icon}</span>
                    <h4 className={`text-sm font-medium truncate ${status.isLocked ? "text-gray-500" : isSelected ? "text-blue-900" : "text-gray-900"
                      }`}>
                      {section.title}
                    </h4>
                    {status.hasComment && (
                      <FiMessageSquare
                        size={12}
                        className="text-amber-600 flex-shrink-0"
                        title="Tiene comentario de observación"
                      />
                    )}
                    {status.isLocked && (
                      <span className="text-xs text-gray-400">(Solo lectura)</span>
                    )}
                  </div>

                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {section.description}
                  </p>

                  {/* Ownership info */}
                  {status.completedBy && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <FiUser size={12} />
                      <span>Completado por {status.completedBy}</span>
                    </div>
                  )}

                  {status.currentOwner && (
                    <div className="flex items-center gap-1 text-xs text-yellow-600">
                      <FiUser size={12} />
                      <span>En edición: {status.currentOwner}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default SectionNavigator;
