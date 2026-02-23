import React, { useState } from "react";
import Card from "../../../../core/ui/components/Card";
import { lockSection, unlockSection } from "../../../../core/api/businessCaseApi";
import { useUI } from "../../../../core/ui/UIContext";
import EquipmentSection from "./EquipmentSection";
import DeterminationsSection from "./DeterminationsSection";
import InvestmentsSection from "./InvestmentsSection";
import ClientDataSection from "./ClientDataSection";
import RequirementsSection from "./sections/RequirementsSection";
// New sections - Phase 1 UX Improvements
import LabSection from "./sections/LabSection";
import LISSection from "./sections/LISSection";
import ConsumptionExportSection from "./sections/ConsumptionExportSection";
import DispatchWorkspaceSection from "./sections/DispatchWorkspaceSection";

const SectionContent = ({
  selectedSection,
  businessCase,
  uiGuidance,
  observationData,
  onSectionSave
}) => {
  const { showToast } = useUI();
  const [lockBusy, setLockBusy] = useState(false);
  const sectionRule = uiGuidance?.sectionOwnership?.rules?.[selectedSection] || {};
  const permissions = uiGuidance?.permissions || {};
  const isInvestments = selectedSection === "investments";
  const canLock = permissions.canBlockSections && !sectionRule.isLocked && !isInvestments;
  const canUnlock = permissions.canUnblockSections && sectionRule.isLocked && !isInvestments;
  const businessCaseId = businessCase?.id || uiGuidance?.businessCase?.id;
  const forwardSave = (options = {}) => {
    onSectionSave?.({ ...options, section: selectedSection });
  };

  const handleLock = async () => {
    if (!businessCaseId) return;
    setLockBusy(true);
    try {
      await lockSection(businessCaseId, selectedSection);
      showToast("Seccion bloqueada para edicion", "success");
      forwardSave();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo bloquear la seccion", "error");
    } finally {
      setLockBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (!businessCaseId) return;
    setLockBusy(true);
    try {
      await unlockSection(businessCaseId, selectedSection);
      showToast("Seccion desbloqueada", "success");
      forwardSave();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo desbloquear la seccion", "error");
    } finally {
      setLockBusy(false);
    }
  };
  // Section metadata for display
  const sectionInfo = {
    general: {
      title: "Datos Generales",
      description: "Informacion basica del cliente y requerimientos del proyecto",
      icon: "DG"
    },
    lab: {
      title: "Entorno Laboratorio",
      description: "Configuracion operativa y parametros del laboratorio",
      icon: "LAB"
    },
    requirement: {
      title: "Condiciones del BC",
      description: "Plazos y entregas clave antes del calculo",
      icon: "BC"
    },
    equipment: {
      title: "Equipamiento",
      description: "Seleccion y configuracion de equipos medicos",
      icon: "EQ"
    },
    lis: {
      title: "Integracion LIS",
      description: "Sistema de informacion laboratorio y interfaces",
      icon: "LIS"
    },
    determinations: {
      title: "Determinaciones",
      description: "Analisis clinicos y cuantificaciones por periodo",
      icon: "DET"
    },
    investments: {
      title: "Inversiones Adicionales",
      description: "Costos adicionales y presupuesto de inversiones",
      icon: "INV"
    },
    prices: {
      title: "Definicion de Precios",
      description: "Establecimiento de precios y margenes",
      icon: "PR"
    },
    calculations: {
      title: "Calculos Tecnicos",
      description: "Analisis de viabilidad tecnica y operativa",
      icon: "CAL"
    },
    rentability: {
      title: "Analisis de Rentabilidad",
      description: "ROI, payback y analisis financiero",
      icon: "ROI"
    },
    consumption_export: {
      title: "Exportacion Reactivos",
      description: "Salida ordenada para Excel/Sheets",
      icon: "EXP"
    },
    dispatch_workspace: {
      title: "Workspace de Despacho",
      description: "Plan comercial y control operativo por elemento",
      icon: "OPS"
    }
  };

  const currentSection = sectionInfo[selectedSection] || sectionInfo.general;

  const renderSection = () => {
    if (selectedSection === "general") {
      return (
        <ClientDataSection
          businessCase={businessCase}
          uiGuidance={uiGuidance}
          permissions={permissions}
          ownership={uiGuidance?.sectionOwnership?.rules?.general || {}}
          onSave={forwardSave}
        />
      );
    }

    if (selectedSection === "lab") {
      return (
        <LabSection
          businessCase={businessCase}
          uiGuidance={uiGuidance}
          permissions={permissions}
          ownership={uiGuidance?.sectionOwnership?.rules?.lab || {}}
          onSave={forwardSave}
        />
      );
    }

    if (selectedSection === "requirement") {
      return (
        <RequirementsSection
          businessCase={businessCase}
          permissions={permissions}
          ownership={uiGuidance?.sectionOwnership?.rules?.requirement || {}}
          onSave={forwardSave}
        />
      );
    }

    if (selectedSection === "equipment") {
      return (
        <EquipmentSection
          businessCase={businessCase}
          permissions={permissions}
          ownership={uiGuidance?.sectionOwnership?.rules?.equipment || {}}
          onSave={forwardSave}
        />
      );
    }

    if (selectedSection === "lis") {
      return (
        <LISSection
          businessCase={businessCase}
          permissions={permissions}
          ownership={uiGuidance?.sectionOwnership?.rules?.lis || {}}
          onSave={forwardSave}
        />
      );
    }

    if (selectedSection === "determinations") {
      return (
        <DeterminationsSection
          businessCase={businessCase}
          permissions={permissions}
          featureFlags={uiGuidance?.featureFlags || {}}
          ownership={uiGuidance?.sectionOwnership?.rules?.determinations || {}}
          onSave={forwardSave}
        />
      );
    }

    if (selectedSection === "investments") {
      return (
        <InvestmentsSection
          businessCase={businessCase}
          permissions={permissions}
          ownership={uiGuidance?.sectionOwnership?.rules?.investments || {}}
          onSave={forwardSave}
        />
      );
    }

    if (selectedSection === "prices") {
      return (
        <Card className="p-6 border border-amber-100 bg-amber-50 text-amber-900">
          <h3 className="text-lg font-semibold mb-2">Precios (En desarrollo)</h3>
          <p className="text-sm">
            Esta seccion esta deshabilitada. Actualmente se usara la exportacion de reactivos para el
            calculo manual de factibilidad.
          </p>
        </Card>
      );
    }

    if (selectedSection === "calculations") {
      return (
        <Card className="p-6 border border-amber-100 bg-amber-50 text-amber-900">
          <h3 className="text-lg font-semibold mb-2">Calculos (En desarrollo)</h3>
          <p className="text-sm">
            Esta seccion esta deshabilitada. Actualmente se usara la exportacion de reactivos para el
            calculo manual de factibilidad.
          </p>
        </Card>
      );
    }

    if (selectedSection === "rentability") {
      return (
        <Card className="p-6 border border-amber-100 bg-amber-50 text-amber-900">
          <h3 className="text-lg font-semibold mb-2">Rentabilidad (En desarrollo)</h3>
          <p className="text-sm">
            Esta seccion esta deshabilitada. Actualmente se usara la exportacion de reactivos para el
            calculo manual de factibilidad.
          </p>
        </Card>
      );
    }

    if (selectedSection === "consumption_export") {
      return (
        <ConsumptionExportSection
          businessCase={businessCase}
        />
      );
    }

    if (selectedSection === "dispatch_workspace") {
      return (
        <DispatchWorkspaceSection
          onSave={forwardSave}
        />
      );
    }

    return null;
  };

  const sectionContent = renderSection();

  if (sectionContent) {
    return (
      <div className="space-y-4">
        {(canLock || canUnlock) && (
          <div className="flex items-center justify-end gap-2">
            {canLock && (
              <button
                type="button"
                onClick={handleLock}
                disabled={lockBusy}
                className="px-3 py-1.5 text-xs font-semibold rounded-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
              >
                Bloquear seccion
              </button>
            )}
            {canUnlock && (
              <button
                type="button"
                onClick={handleUnlock}
                disabled={lockBusy}
                className="px-3 py-1.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-900 hover:bg-amber-200 disabled:opacity-60"
              >
                Desbloquear seccion
              </button>
            )}
          </div>
        )}
        {sectionContent}
      </div>
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
          <div className="text-6xl opacity-50">!</div>
          <p className="text-gray-600">Seccion no reconocida: {selectedSection}</p>
        </div>
      </Card>
    </div>
  );
};

export default SectionContent;
