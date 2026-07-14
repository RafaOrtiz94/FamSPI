import React, { useState, useEffect } from "react";
import { FiLock, FiInfo } from "react-icons/fi";
import { lockSection, unlockSection } from "../../../../core/api/businessCaseApi";
import { useUI } from "../../../../core/ui/UIContext";
import EquipmentSection from "./EquipmentSection";
import DeterminationsSection from "./DeterminationsSection";
import InvestmentsSection from "./InvestmentsSection";
import InvestmentValuesSection from "./sections/InvestmentValuesSection";
import ClientDataSection from "./ClientDataSection";
import RequirementsSection from "./sections/RequirementsSection";
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

 // Lazy mount + keep alive: sección se monta la primera vez que se visita y
 // permanece montada. Evita fetches prematuros en secciones no visitadas.
 const [mountedSections, setMountedSections] = useState(() => new Set([selectedSection]));
 useEffect(() => {
  setMountedSections((prev) => {
   if (prev.has(selectedSection)) return prev;
   const next = new Set(prev);
   next.add(selectedSection);
   return next;
  });
 }, [selectedSection]);

 const permissions = uiGuidance?.permissions || {};
 const sectionRule = uiGuidance?.sectionOwnership?.rules?.[selectedSection] || {};
 const isInvestments = selectedSection === "investments";
 const canLock = permissions.canBlockSections && !sectionRule.isLocked && !isInvestments;
 const canUnlock = permissions.canUnblockSections && sectionRule.isLocked && !isInvestments;
 const businessCaseId = businessCase?.id || uiGuidance?.businessCase?.id;

 // Each section passes its own id so save is always attributed correctly
 const makeForwardSave = (sectionId) => (options = {}) => {
  onSectionSave?.({ ...options, section: sectionId });
 };

 const handleLock = async () => {
  if (!businessCaseId) return;
  setLockBusy(true);
  try {
   await lockSection(businessCaseId, selectedSection);
   showToast("Seccion bloqueada para edicion", "success");
   makeForwardSave(selectedSection)({ markComplete: false });
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
   makeForwardSave(selectedSection)({ markComplete: false });
  } catch (error) {
   showToast(error?.response?.data?.message || "No se pudo desbloquear la seccion", "error");
  } finally {
   setLockBusy(false);
  }
 };

 const canonicalState = businessCase?.canonical_state || uiGuidance?.workflowState?.currentState;
 const purchaseType = businessCase?.purchase_type || businessCase?.type || '';
 const isPrivatePurchase = ['privada', 'private', 'PRIVADA'].includes(String(purchaseType).toLowerCase());

 const isTerminalState = ['CANCELADO', 'RECHAZADO_POR_GERENCIA', 'CERRADO_PARA_APROBACION'].includes(canonicalState);
 const isStateLocked = sectionRule.isLocked;
 const isPermissionLocked = !permissions.canEdit && !isInvestments;

 const unlockAuthorizer = isPrivatePurchase ? 'Backoffice' : 'ACP Comercial o Jefe Comercial';

 const terminalStateLabel =
  canonicalState === 'CANCELADO' ? 'Cancelado'
  : canonicalState === 'RECHAZADO_POR_GERENCIA' ? 'Rechazado por Gerencia'
  : 'Cerrado para Aprobación';

 const readOnlyReason = isTerminalState
  ? `BC en estado "${terminalStateLabel}" — edición deshabilitada`
  : isStateLocked
  ? `Sección bloqueada por ${sectionRule.lockedByRole || 'un supervisor'} — Para modificar, solicitar desbloqueo a ${unlockAuthorizer}`
  : isPermissionLocked
  ? `Tu rol no tiene permiso de edición en esta sección`
  : null;

 return (
  <div className="space-y-5 lg:space-y-6">
   {readOnlyReason && (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
     <FiLock className="flex-shrink-0 text-slate-500" size={16} />
     <span>{readOnlyReason}</span>
    </div>
   )}
   {!readOnlyReason && !isTerminalState && canonicalState === 'OBSERVADO_POR_VIABILIDAD' && (
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
       Cerrar sección
      </button>
     )}
     {canUnlock && (
      <button
       type="button"
       onClick={handleUnlock}
       disabled={lockBusy}
       className="px-3 py-1.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-900 hover:bg-amber-200 disabled:opacity-60"
      >
       Reabrir sección
      </button>
     )}
    </div>
   )}

   {/* Lazy mount + keep alive: sección se renderiza solo cuando ha sido visitada
       (o es la activa). Una vez montada permanece en el DOM oculta para preservar
       el estado del formulario (isEditing, campos no guardados). */}
   {mountedSections.has("general") && (
    <div className={selectedSection === "general" ? "" : "hidden"}>
     <ClientDataSection
      businessCase={businessCase}
      uiGuidance={uiGuidance}
      permissions={permissions}
      ownership={uiGuidance?.sectionOwnership?.rules?.general || {}}
      onSave={makeForwardSave("general")}
     />
    </div>
   )}

   {mountedSections.has("lab") && (
    <div className={selectedSection === "lab" ? "" : "hidden"}>
     <LabSection
      businessCase={businessCase}
      uiGuidance={uiGuidance}
      permissions={permissions}
      ownership={uiGuidance?.sectionOwnership?.rules?.lab || {}}
      onSave={makeForwardSave("lab")}
     />
    </div>
   )}

   {mountedSections.has("requirement") && (
    <div className={selectedSection === "requirement" ? "" : "hidden"}>
     <RequirementsSection
      businessCase={businessCase}
      permissions={permissions}
      ownership={uiGuidance?.sectionOwnership?.rules?.requirement || {}}
      onSave={makeForwardSave("requirement")}
     />
    </div>
   )}

   {mountedSections.has("equipment") && (
    <div className={selectedSection === "equipment" ? "" : "hidden"}>
     <EquipmentSection
      businessCase={businessCase}
      permissions={permissions}
      ownership={uiGuidance?.sectionOwnership?.rules?.equipment || {}}
      onSave={makeForwardSave("equipment")}
     />
    </div>
   )}

   {mountedSections.has("lis") && (
    <div className={selectedSection === "lis" ? "" : "hidden"}>
     <LISSection
      businessCase={businessCase}
      permissions={permissions}
      ownership={uiGuidance?.sectionOwnership?.rules?.lis || {}}
      onSave={makeForwardSave("lis")}
     />
    </div>
   )}

   {mountedSections.has("determinations") && (
    <div className={selectedSection === "determinations" ? "" : "hidden"}>
     <DeterminationsSection
      businessCase={businessCase}
      permissions={permissions}
      featureFlags={uiGuidance?.featureFlags || {}}
      ownership={uiGuidance?.sectionOwnership?.rules?.determinations || {}}
      onSave={makeForwardSave("determinations")}
     />
    </div>
   )}

   {mountedSections.has("investments") && (
    <div className={selectedSection === "investments" ? "" : "hidden"}>
     <InvestmentsSection
      businessCase={businessCase}
      permissions={permissions}
      ownership={uiGuidance?.sectionOwnership?.rules?.investments || {}}
      onSave={makeForwardSave("investments")}
     />
    </div>
   )}

   {mountedSections.has("investment_values_op") && (
    <div className={selectedSection === "investment_values_op" ? "" : "hidden"}>
     <InvestmentValuesSection
      investmentClass="operativa"
      businessCase={businessCase}
      permissions={permissions}
      ownership={uiGuidance?.sectionOwnership?.rules?.investment_values_op || {}}
      onSave={makeForwardSave("investment_values_op")}
     />
    </div>
   )}

   {mountedSections.has("investment_values_fin") && (
    <div className={selectedSection === "investment_values_fin" ? "" : "hidden"}>
     <InvestmentValuesSection
      investmentClass="financiera"
      businessCase={businessCase}
      permissions={permissions}
      ownership={uiGuidance?.sectionOwnership?.rules?.investment_values_fin || {}}
      onSave={makeForwardSave("investment_values_fin")}
     />
    </div>
   )}

   {mountedSections.has("consumption_export") && (
    <div className={selectedSection === "consumption_export" ? "" : "hidden"}>
     <ConsumptionExportSection
      businessCase={businessCase}
     />
    </div>
   )}

   {mountedSections.has("dispatch_workspace") && (
    <div className={selectedSection === "dispatch_workspace" ? "" : "hidden"}>
     <DispatchWorkspaceSection
      onSave={makeForwardSave("dispatch_workspace")}
      ownership={uiGuidance?.sectionOwnership?.rules?.dispatch_workspace || {}}
     />
    </div>
   )}

   {mountedSections.has("feasibility") && (
    <div className={selectedSection === "feasibility" ? "" : "hidden"}>
     <FeasibilitySection
      businessCase={businessCase}
      permissions={permissions}
      ownership={uiGuidance?.sectionOwnership?.rules?.feasibility || {}}
      onSave={makeForwardSave("feasibility")}
     />
    </div>
   )}
  </div>
 );
};

export default SectionContent;
