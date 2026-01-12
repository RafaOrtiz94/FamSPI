import React from "react";
import Card from "../../../../core/ui/components/Card";
import EquipmentSection from "./EquipmentSection";
import DeterminationsSection from "./DeterminationsSection";
import InvestmentsSection from "./InvestmentsSection";
import ClientDataSection from "./ClientDataSection";
import SectionObservationAlert from "./SectionObservationAlert";
// New sections - Phase 1 UX Improvements
import LabSection from "./sections/LabSection";
import LISSection from "./sections/LISSection";
import PricesSection from "./sections/PricesSection";
import CalculationsSection from "./sections/CalculationsSection";
import RentabilitySection from "./sections/RentabilitySection";

const SectionContent = ({
  selectedSection,
  businessCase,
  uiGuidance,
  observationData,
  onSectionSave
}) => {
  // Section metadata for display
  const sectionInfo = {
    general: {
      title: "Datos Generales",
      description: "Información básica del cliente y requerimientos del proyecto",
      icon: "📋"
    },
    lab: {
      title: "Entorno Laboratorio",
      description: "Configuración operativa y parámetros del laboratorio",
      icon: "🏥"
    },
    equipment: {
      title: "Equipamiento",
      description: "Selección y configuración de equipos médicos",
      icon: "💻"
    },
    lis: {
      title: "Integración LIS",
      description: "Sistema de información laboratorio y interfaces",
      icon: "🔗"
    },
    determinations: {
      title: "Determinaciones",
      description: "Análisis clínicos y cuantificaciones por período",
      icon: "📊"
    },
    investments: {
      title: "Inversiones Adicionales",
      description: "Costos adicionales y presupuesto de inversiones",
      icon: "💰"
    },
    prices: {
      title: "Definición de Precios",
      description: "Establecimiento de precios y márgenes",
      icon: "💵"
    },
    calculations: {
      title: "Cálculos Técnicos",
      description: "Análisis de viabilidad técnica y operativa",
      icon: "🧮"
    },
    rentability: {
      title: "Análisis de Rentabilidad",
      description: "ROI, payback y análisis financiero",
      icon: "📈"
    }
  };

  const currentSection = sectionInfo[selectedSection] || sectionInfo.general;

  // Render specific section components
  if (selectedSection === "general") {
    return (
      <ClientDataSection
        businessCase={businessCase}
        uiGuidance={uiGuidance}
        permissions={uiGuidance?.permissions || {}}
        ownership={uiGuidance?.sectionOwnership?.rules?.general || {}}
        onSave={onSectionSave}
      />
    );
  }

  if (selectedSection === "lab") {
    return (
      <LabSection
        businessCase={businessCase}
        uiGuidance={uiGuidance}
        permissions={uiGuidance?.permissions || {}}
        ownership={uiGuidance?.sectionOwnership?.rules?.lab || {}}
        onSave={onSectionSave}
      />
    );
  }

  if (selectedSection === "equipment") {
    return (
      <EquipmentSection
        businessCase={businessCase}
        permissions={uiGuidance?.permissions || {}}
        ownership={uiGuidance?.sectionOwnership?.rules?.equipment || {}}
        onSave={onSectionSave}
      />
    );
  }

  if (selectedSection === "lis") {
    return (
      <LISSection
        businessCase={businessCase}
        permissions={uiGuidance?.permissions || {}}
        ownership={uiGuidance?.sectionOwnership?.rules?.lis || {}}
        onSave={onSectionSave}
      />
    );
  }

  if (selectedSection === "determinations") {
    return (
      <DeterminationsSection
        businessCase={businessCase}
        permissions={uiGuidance?.permissions || {}}
        ownership={uiGuidance?.sectionOwnership?.rules?.determinations || {}}
        onSave={onSectionSave}
      />
    );
  }

  if (selectedSection === "investments") {
    return (
      <InvestmentsSection
        businessCase={businessCase}
        permissions={uiGuidance?.permissions || {}}
        ownership={uiGuidance?.sectionOwnership?.rules?.investments || {}}
        onSave={onSectionSave}
      />
    );
  }

  if (selectedSection === "prices") {
    return (
      <PricesSection
        businessCase={businessCase}
        permissions={uiGuidance?.permissions || {}}
        ownership={uiGuidance?.sectionOwnership?.rules?.prices || {}}
        onSave={onSectionSave}
      />
    );
  }

  if (selectedSection === "calculations") {
    return (
      <CalculationsSection
        businessCase={businessCase}
        permissions={uiGuidance?.permissions || {}}
        ownership={uiGuidance?.sectionOwnership?.rules?.calculations || {}}
        onSave={onSectionSave}
      />
    );
  }

  if (selectedSection === "rentability") {
    return (
      <RentabilitySection
        businessCase={businessCase}
        permissions={uiGuidance?.permissions || {}}
        ownership={uiGuidance?.sectionOwnership?.rules?.rentability || {}}
        onSave={onSectionSave}
      />
    );
  }

  // Fallback for unknown sections (should not happen now)
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="text-3xl">{currentSection.icon}</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{currentSection.title}</h2>
          <p className="text-sm text-gray-600">{currentSection.description}</p>
        </div>
      </div>
      <Card className="p-8">
        <div className="text-center space-y-4">
          <div className="text-6xl opacity-50">❓</div>
          <p className="text-gray-600">Sección no reconocida: {selectedSection}</p>
        </div>
      </Card>
    </div>
  );
};

export default SectionContent;
