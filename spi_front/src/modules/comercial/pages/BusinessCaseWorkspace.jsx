import React, { useCallback, useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { FiAlertTriangle } from "react-icons/fi";
import {
 getBusinessCase,
 getUIGuidance,
 normalizeUIGuidanceResponse,
 createAutosaveManager,
 recordSectionCompletion,
 requestBusinessCasePreflowReopen,
 resolveBusinessCasePreflowReopen,
} from "../../../core/api/businessCaseApi";
import { useUI } from "../../../core/ui/UIContext";
import { recordBusinessCaseTelemetry } from "../../../core/utils/businessCaseTelemetry";
import { getApiErrorMessage } from "../../../core/utils/apiErrors";
import CaseHeader from "../components/workspace/CaseHeader";
import WorkspaceContent from "../components/workspace/WorkspaceContent";
import UIGuidancePanel from "../components/workspace/UIGuidancePanel";
import BusinessCasePicker from "../components/BusinessCasePicker";
import ErrorBoundary from "../../../core/ui/components/ErrorBoundary";
import { BusinessCaseWorkspaceProviders } from "../components/workspace/BusinessCaseWorkspaceContext";
import Modal from "../../../core/ui/components/Modal";
import Button from "../../../core/ui/components/Button";
import { resolveRoleSectionConfig, getVisibleSections } from "../components/workspace/roleSectionConfig";

// BC-21: Orden canónico de secciones — incluye investment_values para roles que las ven
const WORKSPACE_SECTION_ORDER = [
 "general",
 "lab",
 "requirement",
 "equipment",
 "lis",
 "determinations",
 "investments",
 "investment_values_op",
 "investment_values_fin",
 "consumption_export",
 "dispatch_workspace",
 "feasibility",
];
const LEGACY_DEV_SECTIONS = new Set(["prices", "calculations", "rentability"]);
const SECTION_LABELS = {
 general: "Datos Generales",
 lab: "Entorno Laboratorio",
 requirement: "Condiciones del BC",
 equipment: "Equipamiento",
 lis: "Integración LIS",
 determinations: "Determinaciones",
 investments: "Inversiones",
 investment_values_op: "Valores Operativos",
 investment_values_fin: "Valores Financieros",
 consumption_export: "Sincronización",
 dispatch_workspace: "Cantidades Máximas",
 feasibility: "Factibilidad",
};

// BC-21: Usa la función exportada del config para obtener secciones visibles por rol
const getVisibleSectionsByRole = (role = "") => {
 return getVisibleSections(role, WORKSPACE_SECTION_ORDER);
};

const getNextSectionId = (currentSection, role = "") => {
 const visible = getVisibleSectionsByRole(role);
 const currentIndex = visible.indexOf(currentSection);
 if (currentIndex < 0) return null;
 if (currentIndex >= visible.length - 1) return null;
 return visible[currentIndex + 1] || null;
};

// BC-21: Roles que ven inversiones después de determinaciones
// (ampliado con analista_comercial, asesor_comercial, jefe_ti)
const ROLE_FORCE_INVESTMENTS_AFTER_DETERMINATIONS = new Set([
 "comercial",
 "asesor_comercial",
 "analista_comercial",
 "acp_comercial",
 "backoffice",
 "backoffice_comercial",
 "jefe_ti",
]);

const BusinessCaseWorkspace = () => {
 const { id: bcId } = useParams();
 const { showToast } = useUI();
 const [selectedSection, setSelectedSection] = useState("general");
 const [businessCase, setBusinessCase] = useState(null);
 const [uiGuidance, setUiGuidance] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [confirmState, setConfirmState] = useState({
 open: false,
 sectionLabel: "",
 });
 const [reopenRequestState, setReopenRequestState] = useState({
 open: false,
 reason: "",
 sections: [],
 submitting: false,
 });
 const [reopenDecisionState, setReopenDecisionState] = useState({
 open: false,
 additionalHours: "",
 notes: "",
 sections: [],
 submitting: false,
 });
 const workspaceShellClass = "px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6";
 const workspaceContainerClass = "mx-auto w-full max-w-[1440px] space-y-5 lg:space-y-6";

 // Autosave manager ref
 const autosaveManagerRef = useRef(null);
 const confirmResolverRef = useRef(null);

 const handleSectionSelect = (sectionId) => {
 if (LEGACY_DEV_SECTIONS.has(sectionId)) {
 setSelectedSection("consumption_export");
 return;
 }
 setSelectedSection(sectionId);
 };

 const refreshWorkspaceState = useCallback(async () => {
 if (!bcId) return null;
 const [guidanceData, businessCaseData] = await Promise.all([
 getUIGuidance(bcId),
 getBusinessCase(bcId),
 ]);
 const normalized = normalizeUIGuidanceResponse(guidanceData);
 setUiGuidance(normalized);
 setBusinessCase(businessCaseData);
 return normalized;
 }, [bcId]);

 const requestSectionConfirm = useCallback((section) => {
 const sectionLabel = String(section || "seccion").replace(/_/g, " ");
 setConfirmState({ open: true, sectionLabel });
 return new Promise((resolve) => {
 confirmResolverRef.current = resolve;
 });
 }, []);

 const resolveSectionConfirm = useCallback((accepted) => {
 if (typeof confirmResolverRef.current === "function") {
 confirmResolverRef.current(Boolean(accepted));
 confirmResolverRef.current = null;
 }
 setConfirmState({ open: false, sectionLabel: "" });
 }, []);

 const handleSectionSave = useCallback(async (options = {}) => {
 if (!uiGuidance) return;
 if (options?.refresh === false) return;

 const startedAt = Date.now();
 try {
 console.log("[BC_AUDIT][FE][WORKSPACE_SAVE_START]", {
 bcId,
 options,
 selectedSection,
 });
 let sectionCompleted = false;
 const shouldMarkComplete = options?.markComplete !== false;
 if (bcId && options?.section && shouldMarkComplete) {
 const confirmed = await requestSectionConfirm(options.section);
 if (confirmed) {
 await recordSectionCompletion(bcId, options.section, options?.reason || null);
 sectionCompleted = true;
 } else {
 showToast("Puedes seguir editando esta seccion antes de continuar.", "info");
 }
 }
 const normalizedUIGuidance = await refreshWorkspaceState();
 if (sectionCompleted && options?.section) {
 const userRole = normalizedUIGuidance?.permissions?.userRole || "comercial";
 const visible = getVisibleSectionsByRole(userRole);
 let nextSection = getNextSectionId(options.section, userRole);
 if (
 options.section === "determinations" &&
 ROLE_FORCE_INVESTMENTS_AFTER_DETERMINATIONS.has(String(userRole || "").toLowerCase()) &&
 visible.includes("investments")
 ) {
 nextSection = "investments";
 }
 console.log("[BC_AUDIT][FE][WORKSPACE_SECTION_COMPLETE]", {
 bcId,
 section: options.section,
 userRole,
 visible,
 nextSection,
 });
 if (nextSection) {
 setSelectedSection(nextSection);
 }
 }
 showToast("Seccion guardada y datos actualizados", "success");
 recordBusinessCaseTelemetry({
 section: "workspace",
 type: "refresh_after_save_success",
 durationMs: Date.now() - startedAt,
 success: true,
 });
 } catch (err) {
 console.error("Failed to refresh UI guidance after save:", err);
 showToast(getApiErrorMessage(err, "Error actualizando datos despues del guardado"), "error");
 recordBusinessCaseTelemetry({
 section: "workspace",
 type: "refresh_after_save_error",
 durationMs: Date.now() - startedAt,
 success: false,
 });
 }
 }, [bcId, refreshWorkspaceState, requestSectionConfirm, showToast, uiGuidance]);

 // Initialize autosave manager and fetch data on mount and when bcId changes
 const fetchWorkspaceData = useCallback(async () => {
 if (!bcId) {
 // No bcId provided - show picker instead of workspace
 setLoading(false);
 return;
 }

 const startedAt = Date.now();
 try {
 setLoading(true);
 setError(null);

 // Create autosave manager
 autosaveManagerRef.current = createAutosaveManager(bcId);

 // Load complete business case and UI guidance in parallel
 const [businessCaseData, uiGuidanceData] = await Promise.all([
 getBusinessCase(bcId),
 getUIGuidance(bcId)
 ]);

 // Normalize UI guidance response
 const normalizedUIGuidance = normalizeUIGuidanceResponse(uiGuidanceData);
 const userRole = normalizedUIGuidance?.permissions?.userRole || "comercial";
 const visibleSections = getVisibleSectionsByRole(userRole);
 if (!visibleSections.includes(selectedSection)) {
 setSelectedSection(visibleSections[0] || "general");
 }

 setBusinessCase(businessCaseData);
 setUiGuidance(normalizedUIGuidance);
 recordBusinessCaseTelemetry({
 section: "workspace",
 type: "initial_load_success",
 durationMs: Date.now() - startedAt,
 success: true,
 });
 } catch (err) {
 console.error("Failed to fetch workspace data:", err);
 setError(getApiErrorMessage(err, "Failed to load workspace data"));
 showToast(getApiErrorMessage(err, "Error cargando datos del workspace"), "error");
 recordBusinessCaseTelemetry({
 section: "workspace",
 type: "initial_load_error",
 durationMs: Date.now() - startedAt,
 success: false,
 });
 } finally {
 setLoading(false);
 }
 }, [bcId, showToast]);

 useEffect(() => {
 fetchWorkspaceData();

 // Cleanup function
 return () => {
 if (autosaveManagerRef.current) {
 autosaveManagerRef.current.destroy();
 autosaveManagerRef.current = null;
 }
 };
 }, [fetchWorkspaceData]);

 useEffect(() => {
 const preflow = uiGuidance?.preflow;
 const shouldWarn = Boolean(preflow?.isActive && !preflow?.readyToStartProcess && !preflow?.processCreated);
 if (!shouldWarn) return undefined;

 const handler = (event) => {
 event.preventDefault();
 event.returnValue = "";
 return "";
 };

 window.addEventListener("beforeunload", handler);
 return () => window.removeEventListener("beforeunload", handler);
 }, [uiGuidance?.preflow]);

 const handleRefresh = async () => {
 if (!bcId) return;

 try {
 await refreshWorkspaceState();
 showToast("Datos actualizados", "success");
 } catch (err) {
 console.error("Failed to refresh UI guidance:", err);
 showToast(getApiErrorMessage(err, "Error actualizando datos"), "error");
 }
 };

 const visibleSections = getVisibleSectionsByRole(uiGuidance?.permissions?.userRole || "comercial");
 const pendingReopenRequest = uiGuidance?.preflow?.extensionRequest || null;

 const openReopenRequestModal = useCallback(() => {
 const defaultSections = visibleSections.includes(selectedSection) ? [selectedSection] : [];
 setReopenRequestState({
 open: true,
 reason: "",
 sections: defaultSections,
 submitting: false,
 });
 }, [selectedSection, visibleSections]);

 const closeReopenRequestModal = useCallback(() => {
 setReopenRequestState({ open: false, reason: "", sections: [], submitting: false });
 }, []);

 const openReopenDecisionModal = useCallback(() => {
 setReopenDecisionState({
 open: true,
 additionalHours: "",
 notes: "",
 sections: Array.isArray(pendingReopenRequest?.sections) ? pendingReopenRequest.sections : [],
 submitting: false,
 });
 }, [pendingReopenRequest?.sections]);

 const closeReopenDecisionModal = useCallback(() => {
 setReopenDecisionState({ open: false, additionalHours: "", notes: "", sections: [], submitting: false });
 }, []);

 const toggleRequestSection = useCallback((sectionId) => {
 setReopenRequestState((prev) => ({
 ...prev,
 sections: prev.sections.includes(sectionId)
 ? prev.sections.filter((item) => item !== sectionId)
 : [...prev.sections, sectionId],
 }));
 }, []);

 const toggleDecisionSection = useCallback((sectionId) => {
 setReopenDecisionState((prev) => ({
 ...prev,
 sections: prev.sections.includes(sectionId)
 ? prev.sections.filter((item) => item !== sectionId)
 : [...prev.sections, sectionId],
 }));
 }, []);

 const submitReopenRequest = useCallback(async () => {
 if (!bcId) return;
 setReopenRequestState((prev) => ({ ...prev, submitting: true }));
 try {
 await requestBusinessCasePreflowReopen(bcId, {
 reason: reopenRequestState.reason,
 sections: reopenRequestState.sections,
 });
 await refreshWorkspaceState();
 closeReopenRequestModal();
 showToast("Solicitud enviada a Jefe Comercial", "success");
 } catch (err) {
 setReopenRequestState((prev) => ({ ...prev, submitting: false }));
 showToast(getApiErrorMessage(err, "No se pudo solicitar la reapertura"), "error");
 }
 }, [bcId, closeReopenRequestModal, refreshWorkspaceState, reopenRequestState.reason, reopenRequestState.sections, showToast]);

 const submitReopenDecision = useCallback(async (approved) => {
 if (!bcId) return;
 setReopenDecisionState((prev) => ({ ...prev, submitting: true }));
 try {
 await resolveBusinessCasePreflowReopen(bcId, {
 approved,
 additional_hours: approved ? reopenDecisionState.additionalHours : 0,
 notes: reopenDecisionState.notes,
 sections: reopenDecisionState.sections,
 });
 await refreshWorkspaceState();
 closeReopenDecisionModal();
 showToast(approved ? "Solicitud aprobada" : "Solicitud rechazada", "success");
 } catch (err) {
 setReopenDecisionState((prev) => ({ ...prev, submitting: false }));
 showToast(getApiErrorMessage(err, "No se pudo resolver la solicitud"), "error");
 }
 }, [bcId, closeReopenDecisionModal, refreshWorkspaceState, reopenDecisionState.additionalHours, reopenDecisionState.notes, reopenDecisionState.sections, showToast]);

 // Show picker when no bcId is provided
 if (!bcId) {
 return <BusinessCasePicker />;
 }

 // Loading state
 if (loading) {
 return (
 <div className={workspaceShellClass}>
 <div className={workspaceContainerClass}>
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <div>
 <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
 Business Case Workspace
 </p>
 <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Workspace Moderno</h1>
 <p className="text-sm text-gray-600">
 Gestión colaborativa de casos de negocio por secciones
 </p>
 </div>
 </div>
 <div className="flex items-center justify-center py-24">
 <div className="text-center">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
 <p className="text-gray-600 font-medium">Cargando workspace...</p>
 </div>
 </div>
 </div>
 </div>
 );
 }

 // Error state
 if (error) {
 return (
 <div className={workspaceShellClass}>
 <div className={workspaceContainerClass}>
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <div>
 <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
 Business Case Workspace
 </p>
 <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Workspace Moderno</h1>
 <p className="text-sm text-gray-600">
 Gestión colaborativa de casos de negocio por secciones
 </p>
 </div>
 </div>
 <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center shadow-sm">
 <div className="text-red-500 mb-4 bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
 <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
 </svg>
 </div>
 <h3 className="text-lg font-bold text-red-900 mb-2">Error cargando workspace</h3>
 <p className="text-red-700 mb-6">{error}</p>
 <button
 onClick={() => window.location.reload()}
 className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
 >
 Reintentar
 </button>
 </div>
 </div>
 </div>
 );
 }

 // No data state
 if (!uiGuidance) {
 return (
 <div className={workspaceShellClass}>
 <div className={workspaceContainerClass}>
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <div>
 <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
 Business Case Workspace
 </p>
 <h1 className="text-2xl font-bold text-gray-900">Workspace Moderno</h1>
 <p className="text-sm text-gray-600">
 Gestión colaborativa de casos de negocio por secciones
 </p>
 </div>
 </div>
 <div className="text-center py-12">
 <p className="text-gray-600">No se encontraron datos del workspace.</p>
 </div>
 </div>
 </div>
 );
 }

 const workspaceContextValue = {
 bcId,
 selectedSection,
 setSelectedSection: handleSectionSelect,
 businessCase,
 uiGuidance,
 onSectionSave: handleSectionSave,
 onRefresh: handleRefresh,
 };

 const documentsContextValue = {
 bcId,
 documents:
 businessCase?.documents ||
 businessCase?.modern_bc_metadata?.documents ||
 [],
 onRefresh: handleRefresh,
 };

 const calculationsContextValue = {
 bcId,
 selectedSection,
 businessCase,
 uiGuidance,
 onSectionSave: handleSectionSave,
 };

 return (
 <BusinessCaseWorkspaceProviders
 workspaceValue={workspaceContextValue}
 documentsValue={documentsContextValue}
 calculationsValue={calculationsContextValue}
 >
 <div className={workspaceShellClass}>
 <div className={workspaceContainerClass}>
 {/* Header Area */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
 Business Case Workspace
 </p>
 <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Workspace Moderno</h1>
 <p className="text-sm text-gray-500 mt-1">
 Gestión colaborativa de casos de negocio por secciones
 </p>
 {(businessCase?.modern_bc_metadata?.source_module === "equipment_purchases" ||
 businessCase?.modern_bc_metadata?.auto_created === true) && (
 <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
 <span>Auto desde Compras Publicas</span>
 {businessCase?.modern_bc_metadata?.source_purchase_request_id && (
 <span>#{String(businessCase.modern_bc_metadata.source_purchase_request_id).slice(0, 8)}</span>
 )}
 </div>
 )}
 </div>
 </div>

 <CaseHeader
 uiGuidance={uiGuidance}
 onRefresh={handleRefresh}
 onOpenReopenRequest={openReopenRequestModal}
 onOpenReopenDecision={openReopenDecisionModal}
 />

 <div className="space-y-6">
 <WorkspaceContent
 selectedSection={selectedSection}
 businessCase={businessCase}
 uiGuidance={uiGuidance}
 onSectionSelect={handleSectionSelect}
 onSectionSave={handleSectionSave}
 />
 </div>

 <ErrorBoundary title="Panel de UI Guidance" message="Error en el panel de guidance.">
 <UIGuidancePanel
 businessCaseId={bcId}
 selectedSection={selectedSection}
 />
 </ErrorBoundary>

 <Modal
 open={confirmState.open}
 onClose={() => resolveSectionConfirm(false)}
 title="Confirmar cierre de seccion"
 maxWidth="max-w-xl"
 >
 <div className="space-y-4">
 <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
 <div className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-700">
 <FiAlertTriangle size={18} />
 </div>
 <div>
 <p className="text-sm font-semibold text-amber-900">
 Verifica la informacion antes de continuar
 </p>
 <p className="mt-1 text-sm text-amber-800">
 Seccion: <span className="font-semibold">{confirmState.sectionLabel}</span>
 </p>
 <p className="mt-2 text-sm text-amber-800">
 Si continuas, la seccion quedara marcada como completada y el flujo avanzara al siguiente paso.
 </p>
 </div>
 </div>

 <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
 <Button variant="secondary" onClick={() => resolveSectionConfirm(false)}>
 Seguir editando
 </Button>
 <Button variant="primary" onClick={() => resolveSectionConfirm(true)}>
 Continuar y bloquear
 </Button>
 </div>
 </div>
 </Modal>

 <Modal
 open={reopenRequestState.open}
 onClose={reopenRequestState.submitting ? undefined : closeReopenRequestModal}
 title="Solicitar reapertura de etapa"
 maxWidth="max-w-2xl"
 >
 <div className="space-y-4">
 <p className="text-sm text-slate-600">
 La solicitud se enviara a Jefe Comercial para decidir si amplia la ventana y que secciones quedaran nuevamente editables.
 </p>
 <div>
 <label className="mb-2 block text-sm font-medium text-slate-700">Motivo</label>
 <textarea
 rows={4}
 value={reopenRequestState.reason}
 onChange={(event) => setReopenRequestState((prev) => ({ ...prev, reason: event.target.value }))}
 className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
 placeholder="Describe que necesitas corregir o completar."
 />
 </div>
 <div>
 <p className="mb-2 text-sm font-medium text-slate-700">Secciones a reabrir</p>
 <div className="grid gap-2 sm:grid-cols-2">
 {visibleSections.map((sectionId) => (
 <label key={sectionId} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
 <input
 type="checkbox"
 checked={reopenRequestState.sections.includes(sectionId)}
 onChange={() => toggleRequestSection(sectionId)}
 />
 <span>{SECTION_LABELS[sectionId] || sectionId}</span>
 </label>
 ))}
 </div>
 </div>
 <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
 <Button variant="secondary" onClick={closeReopenRequestModal} disabled={reopenRequestState.submitting}>
 Cancelar
 </Button>
 <Button
 variant="primary"
 onClick={submitReopenRequest}
 disabled={!reopenRequestState.reason.trim() || reopenRequestState.submitting}
 >
 Enviar solicitud
 </Button>
 </div>
 </div>
 </Modal>

 <Modal
 open={reopenDecisionState.open}
 onClose={reopenDecisionState.submitting ? undefined : closeReopenDecisionModal}
 title="Gestionar solicitud de reapertura"
 maxWidth="max-w-2xl"
 >
 <div className="space-y-4">
 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
 <p><span className="font-semibold">Solicitante:</span> {pendingReopenRequest?.requestedByEmail || "N/D"}</p>
 <p className="mt-1"><span className="font-semibold">Etapa:</span> {pendingReopenRequest?.phaseLabel || "N/D"} ({pendingReopenRequest?.roleLabel || "N/D"})</p>
 <p className="mt-1"><span className="font-semibold">Motivo:</span> {pendingReopenRequest?.reason || "Sin detalle"}</p>
 </div>
 <div>
 <label className="mb-2 block text-sm font-medium text-slate-700">Horas adicionales</label>
 <input
 type="number"
 min="1"
 value={reopenDecisionState.additionalHours}
 onChange={(event) => setReopenDecisionState((prev) => ({ ...prev, additionalHours: event.target.value }))}
 className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
 placeholder="Ej. 12"
 />
 </div>
 <div>
 <label className="mb-2 block text-sm font-medium text-slate-700">Notas</label>
 <textarea
 rows={3}
 value={reopenDecisionState.notes}
 onChange={(event) => setReopenDecisionState((prev) => ({ ...prev, notes: event.target.value }))}
 className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
 placeholder="Opcional"
 />
 </div>
 <div>
 <p className="mb-2 text-sm font-medium text-slate-700">Secciones a reabrir</p>
 <div className="grid gap-2 sm:grid-cols-2">
 {visibleSections.map((sectionId) => (
 <label key={sectionId} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
 <input
 type="checkbox"
 checked={reopenDecisionState.sections.includes(sectionId)}
 onChange={() => toggleDecisionSection(sectionId)}
 />
 <span>{SECTION_LABELS[sectionId] || sectionId}</span>
 </label>
 ))}
 </div>
 </div>
 <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
 <Button variant="secondary" onClick={closeReopenDecisionModal} disabled={reopenDecisionState.submitting}>
 Cancelar
 </Button>
 <button
 type="button"
 onClick={() => submitReopenDecision(false)}
 disabled={reopenDecisionState.submitting}
 className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
 >
 Rechazar
 </button>
 <Button
 variant="primary"
 onClick={() => submitReopenDecision(true)}
 disabled={!String(reopenDecisionState.additionalHours || "").trim() || reopenDecisionState.submitting}
 >
 Aprobar y ampliar tiempo
 </Button>
 </div>
 </div>
 </Modal>
 </div>
 </div>
 </BusinessCaseWorkspaceProviders>
 );
};

export default BusinessCaseWorkspace;
