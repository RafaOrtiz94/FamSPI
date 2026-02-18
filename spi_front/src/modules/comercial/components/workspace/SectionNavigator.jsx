import React from "react";
import { FiCheckCircle, FiClock, FiLock, FiAlertTriangle, FiUser, FiMessageSquare, FiTarget } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import { useAuth } from "../../../../core/auth/AuthContext";

/**
 * Role-based section visibility configuration
 * Defines which sections each role can see and edit
 */
const ROLE_SECTION_CONFIG = {
  // Comercial roles - operational data
  comercial: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments"],
    canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments"],
  },
  asesor_comercial: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments"],
    canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments"],
  },
  acp_comercial: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "prices", "calculations", "rentability", "consumption_export", "dispatch_workspace"],
    canEdit: ["general", "lab", "equipment", "lis", "requirement", "investments", "consumption_export"],
  },
  backoffice_comercial: {
    visible: ["general", "lab", "requirement", "equipment", "lis", "determinations", "investments", "calculations"],
    canEdit: ["general", "lab", "requirement", "equipment", "lis", "determinations", "investments"],
  },
  // Manager roles - full access
  jefe_comercial: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "prices", "calculations", "rentability", "consumption_export", "dispatch_workspace"],
    canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "consumption_export", "dispatch_workspace"],
  },
  gerencia: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "dispatch_workspace"],
    canEdit: [],
  },
  gerencia_general: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "prices", "calculations", "rentability", "dispatch_workspace"],
    canEdit: [],
  },
  // Technical roles - equipment/determinations focus
  operaciones: {
    visible: ["equipment", "determinations", "dispatch_workspace"],
    canEdit: ["equipment", "determinations", "dispatch_workspace"],
  },
  jefe_operaciones: {
    visible: ["equipment", "determinations", "requirement", "investments", "dispatch_workspace"],
    canEdit: ["equipment", "determinations", "requirement", "investments", "dispatch_workspace"],
  },
  servicio_tecnico: {
    visible: ["equipment", "determinations"],
    canEdit: [],
  },
  jefe_tecnico: {
    visible: ["equipment", "determinations", "requirement", "investments"],
    canEdit: ["equipment", "investments"],
  },
  // Admin - full access
  admin: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "dispatch_workspace"],
    canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "dispatch_workspace"],
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
      description: "Cliente, contrato y requerimientos basicos",
      icon: "DG"
    },
    {
      id: "lab",
      title: "Entorno Laboratorio",
      description: "Configuracion y operacion del laboratorio",
      icon: "LAB"
    },
    {
      id: "requirement",
      title: "Requerimiento del BC",
      description: "Plazos, entregas y observaciones clave",
      icon: "BC"
    },
    {
      id: "equipment",
      title: "Equipamiento",
      description: "Seleccion y configuracion de equipos",
      icon: "EQ"
    },
    {
      id: "lis",
      title: "Integracion LIS",
      description: "Sistema de informacion laboratorio",
      icon: "LIS"
    },
    {
      id: "determinations",
      title: "Determinaciones",
      description: "Analisis y cuantificaciones",
      icon: "DET"
    },
    {
      id: "investments",
      title: "Inversiones",
      description: "Costos adicionales y presupuestos",
      icon: "INV"
    },
    {
      id: "prices",
      title: "Precios",
      description: "Definicion de precios y margenes",
      icon: "PR",
      dev: true
    },
    {
      id: "calculations",
      title: "Calculos",
      description: "Analisis tecnico y viabilidad",
      icon: "CAL",
      dev: true
    },
    {
      id: "rentability",
      title: "Rentabilidad",
      description: "ROI y analisis financiero",
      icon: "ROI",
      dev: true
    },
    {
      id: "consumption_export",
      title: "Exportacion Reactivos",
      description: "Salida ordenada para Excel/Sheets",
      icon: "EXP"
    },
    {
      id: "dispatch_workspace",
      title: "Despacho Operativo",
      description: "Cantidades comerciales y control de despacho",
      icon: "OPS"
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
    const isLocked = Boolean(rule?.isLocked);
    const isReadOnly = !canEditSection(sectionId);

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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 lg:p-6 h-auto lg:h-[calc(100vh-200px)] lg:overflow-y-auto custom-scrollbar sticky top-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <h3 className="text-lg font-bold text-gray-900 tracking-tight">Secciones</h3>
          <span className="text-xs font-semibold text-gray-500 px-2 py-1 bg-gray-100 rounded-full">
            {visibleSections.length} de {allSections.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
        {visibleSections.map((section) => {
          const status = getSectionStatus(section.id);
          const isSelected = selectedSection === section.id;
          const isReadOnly = !canEditSection(section.id);

          return (
            <button
              key={section.id}
              onClick={() => onSectionSelect(section.id)}
              className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${status.isLocked
                  ? "opacity-60 cursor-not-allowed bg-gray-50 border border-gray-100"
                  : isSelected
                    ? status.isObserved
                      ? "bg-amber-50 border border-amber-200 shadow-sm ring-1 ring-amber-200"
                      : "bg-blue-50 border border-blue-200 shadow-sm ring-1 ring-blue-200"
                    : status.isObserved
                      ? "hover:bg-amber-50 border border-transparent hover:shadow-sm"
                      : "hover:bg-gray-50 border border-transparent hover:shadow-sm"
                }`}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className={`flex-shrink-0 mt-0.5 ${status.color}`}>
                  <status.icon size={18} />
                </div>

                {/* Section content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{section.icon}</span>
                  <h4 className={`text-sm font-semibold truncate ${status.isLocked ? "text-gray-500" : isSelected ? "text-blue-900" : "text-gray-900"
                    }`}>
                    {section.title}
                  </h4>
                  {section.dev && (
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      En desarrollo
                    </span>
                  )}
                    {status.hasComment && (
                      <FiMessageSquare
                        size={12}
                        className="text-amber-600 flex-shrink-0"
                        title="Tiene comentario de observacion"
                      />
                    )}
                    {(status.isLocked || isReadOnly) && (
                      <span className="text-xs text-gray-400 font-normal ml-auto">
                        {status.isLocked ? "(Bloqueado)" : "(Solo lectura)"}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mb-2 line-clamp-2 leading-relaxed">
                    {section.description}
                  </p>

                  {/* Ownership info */}
                  {status.completedBy && (
                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full w-fit">
                      <FiUser size={10} />
                      <span>{status.completedBy}</span>
                    </div>
                  )}

                  {status.currentOwner && (
                    <div className="flex items-center gap-1.5 text-xs text-yellow-700 font-medium bg-yellow-50 px-2 py-0.5 rounded-full w-fit">
                      <FiUser size={10} />
                      <span>Edit: {status.currentOwner}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default SectionNavigator;
