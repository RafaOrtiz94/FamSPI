import React, { useState } from "react";
import { FiLock, FiInfo } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import { lockSection, unlockSection } from "../../../../core/api/businessCaseApi";
import { useUI } from "../../../../core/ui/UIContext";
import EquipmentSection from "./EquipmentSection";
import DeterminationsSection from "./DeterminationsSection";
import InvestmentsSection from "./InvestmentsSection";
import InvestmentValuesSection from "./sections/InvestmentValuesSection";
import ClientDataSection from "./ClientDataSection";
import RequirementsSection from "./sections/RequirementsSection";
// New sections - Phase 1 UX Improvements
import LabSection from "./sections/LabSection";
import LISSection from "./sections/LISSection";
import ConsumptionExportSection from "./sections/ConsumptionExportSection";
import DispatchWorkspaceSection from "./sections/DispatchWorkspaceSection";
import FeasibilitySection from "./sections/FeasibilitySection";

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
 forwardSave({ markComplete: false });
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
 forwardSave({ markComplete: false });
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
 investment_values_op: {
 title: "Valores Operativos",
 description: "Precios unitarios de inversiones operativas — productos y adquisiciones",
 icon: "OPV"
 },
 investment_values_fin: {
 title: "Valores Financieros",
 description: "Precios unitarios de inversiones financieras — servicios y mano de obra",
 icon: "FIN"
 },
 consumption_export: {
 title: "Sincronizacion Sheets",
 description: "Creacion y sincronizacion del formato oficial BC en Google Sheets",
 icon: "EXP"
 },
 dispatch_workspace: {
 title: "Cantidades Maximas",
 description: "Cantidades maximas comerciales y control operativo por elemento",
 icon: "OPS"
 },
 feasibility: {
 title: "Factibilidad",
 description: "Decision final del Business Case y cierre para continuidad en compras",
 icon: "FAC"
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

 if (selectedSection === "investment_values_op") {
 return (
 <InvestmentValuesSection
 investmentClass="operativa"
 businessCase={businessCase}
 permissions={permissions}
 ownership={uiGuidance?.sectionOwnership?.rules?.investment_values_op || {}}
 onSave={forwardSave}
 />
 );
 }

 if (selectedSection === "investment_values_fin") {
 return (
 <InvestmentValuesSection
 investmentClass="financiera"
 businessCase={businessCase}
 permissions={permissions}
 ownership={uiGuidance?.sectionOwnership?.rules?.investment_values_fin || {}}
 onSave={forwardSave}
 />
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
 ownership={uiGuidance?.sectionOwnership?.rules?.dispatch_workspace || {}}
 />
 );
 }

 if (selectedSection === "feasibility") {
 return (
 <FeasibilitySection
 businessCase={businessCase}
 permissions={permissions}
 ownership={uiGuidance?.sectionOwnership?.rules?.feasibility || {}}
 onSave={forwardSave}
 />
 );
 }

 return null;
 };

 const sectionContent = renderSection();

 // Determine read-only reason for banner (REQ-BC-17)
 const canonicalState = businessCase?.canonical_state || uiGuidance?.workflowState?.currentState;
 const isTerminalState = ['CANCELADO', 'RECHAZADO_POR_GERENCIA', 'CERRADO_PARA_APROBACION'].includes(canonicalState);
 const isStateLocked = sectionRule.isLocked;
 const isPermissionLocked = !permissions.canEdit && !isInvestments;

 const readOnlyReason = isTerminalState
   ? `BC en estado "${canonicalState === 'CANCELADO' ? 'Cancelado' : canonicalState === 'RECHAZADO_POR_GERENCIA' ? 'Rechazado por Gerencia' : 'Cerrado para Aprobación'}" — edición deshabilitada`
   : isStateLocked
   ? `Sección cerrada por ${sectionRule.lockedByRole || 'un supervisor'} — solo lectura`
   : isPermissionLocked
   ? `Tu rol no tiene permiso de edición en esta sección`
   : null;

 if (sectionContent) {
 return (
 <div className="space-y-5 lg:space-y-6">
 {readOnlyReason && (
 <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
 <FiLock className="flex-shrink-0 text-slate-500" size={16} />
 <span>{readOnlyReason}</span>
 </div>
 )}
 {!readOnlyReason && isTerminalState === false && (canonicalState === 'OBSERVADO_POR_VIABILIDAD') && (
 <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
 <FiInfo className="flex-shrink-0" size={16} />
 <span>BC observado por viabilidad — revisa los comentarios antes de editar</span>
 </div>
 )}
 {(canLock || canUnlock) && (
 <div className="flex flex-wrap items-center justify-end gap-2">
 {canLock && (
 <button
 type="button"
 onClick={handleLock}
 disabled={lockBusy}
 className="px-3 py-1.5 text-xs font-semibold rounded-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
 >
 Cerrar seccion
 </button>
 )}
 {canUnlock && (
 <button
 type="button"
 onClick={handleUnlock}
 disabled={lockBusy}
 className="px-3 py-1.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-900 hover:bg-amber-200 disabled:opacity-60"
 >
 Reabrir seccion
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
