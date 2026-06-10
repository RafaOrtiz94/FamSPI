import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  FiAlertCircle,
  FiPlus,
  FiSearch,
  FiX,
} from "react-icons/fi";

import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import {
  applicantProfileSections,
  profileSections,
} from "../components/collaboratorProfileDefinitions";
import ApplicantIntakeSummary from "../components/workspace/ApplicantIntakeSummary";
import ApplicantList from "../components/workspace/ApplicantList";
import PersonnelRequestComments from "../components/workspace/PersonnelRequestComments";
import PersonnelRequestProgress from "../components/workspace/PersonnelRequestProgress";
import WorkspaceErrorBoundary from "../components/workspace/WorkspaceErrorBoundary";
import CommandCenterJourneyPanel from "../components/command-center/CommandCenterJourneyPanel";
import ActionDrawersSection from "../components/command-center/sections/ActionDrawersSection";
import useCommandCenterState from "../hooks/useCommandCenterState";
import commandCenterProfileSchema from "../schemas/commandCenterProfileSchema";

const PersonnelProfile   = lazy(() => import("../components/workspace/PersonnelProfile"));
const PersonnelChecklist = lazy(() => import("../components/workspace/PersonnelChecklist"));
const PersonnelDocuments = lazy(() => import("../components/workspace/PersonnelDocuments"));
const OffboardingWorkspace = lazy(() => import("../components/workspace/OffboardingWorkspace"));

// ── Constants ────────────────────────────────────────────────────────────────

const READY_REQUEST_STATUSES     = new Set(["aprobada", "en_proceso", "completada"]);
const REVIEWABLE_REQUEST_STATUSES = new Set(["pendiente", "en_revision"]);
const OFFBOARDING_ALLOWED_ROLES   = new Set([
  "talento_humano","jefe_financiero","jefe_finanzas","jefe_ti",
  "jefe_talento_humano","gerencia_general","admin","administrador",
]);

const VIEWS = [
  { key: "requests",      workspaceKey: "solicitudes",   label: "Contratación",  emptyLabel: "solicitud"      },
  { key: "collaborators", workspaceKey: "colaboradores",  label: "Colaboradores", emptyLabel: "colaborador"    },
  { key: "offboarding",   workspaceKey: "desvinculacion", label: "Desvinculación", emptyLabel: "desvinculación" },
];

const STATUS_LABELS = {
  pendiente:"Pendiente", en_revision:"En revisión", aprobada:"Aprobada",
  en_proceso:"En proceso", completada:"Completada", rechazada:"Rechazada", cancelada:"Cancelada",
};
const PASSIVE_STATUSES = new Set(["pasivo","desvinculado","inactivo"]);

const toBrowserView  = (v) => ({ solicitudes:"requests", colaboradores:"collaborators", desvinculacion:"offboarding", aspirantes:"applicants", requests:"requests", collaborators:"collaborators", offboarding:"offboarding" }[v] || "requests");
const toWorkspaceKey = (v) => ({ requests:"solicitudes", collaborators:"colaboradores", offboarding:"desvinculacion" }[v] || v);

const asArray   = (v) => (Array.isArray(v) ? v : []);
const pct       = (p) => (typeof p?.percent === "number" ? Math.max(0, Math.min(100, p.percent)) : p?.total > 0 ? Math.round(((p.done ?? 0) / p.total) * 100) : 0);

const resolveCollaboratorStatus = (c = {}) => {
  const s = String(c.estatus_empleado || "").toLowerCase();
  if (c.active === false || PASSIVE_STATUSES.has(s)) return "Pasivo";
  if (c.offboarding_requested || c.profile?.onboarding?.offboarding_requested) return "En desvinculación";
  return "Activo";
};

const flattenRHFErrors = (errors = {}, prefix = "") =>
  Object.entries(errors).reduce((acc, [k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v?.message) { acc[path] = v.message; return acc; }
    if (v && typeof v === "object") return { ...acc, ...flattenRHFErrors(v, path) };
    return acc;
  }, {});

// ── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = ({ onOpen, currentView }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center shadow-soft">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
      <FiSearch size={22} className="text-slate-400" />
    </div>
    <p className="text-base font-semibold text-slate-800 mb-1">
      Ningún {currentView?.emptyLabel || "elemento"} seleccionado
    </p>
    <p className="text-sm text-slate-500 mb-6 max-w-xs">
      Selecciona {currentView?.emptyLabel || "un elemento"} del navegador para gestionar su expediente.
    </p>
    <Button onClick={onOpen} leftIcon={<FiSearch size={15} />}>
      Abrir navegador
    </Button>
  </div>
);

// ── Main component ───────────────────────────────────────────────────────────

const CollaboratorCommandCenter = ({ initialView = "requests" }) => {
  const navigate = useNavigate();
  const [browserOpen, setBrowserOpen] = useState(false);

  const state = useCommandCenterState({ initialView });
  const {
    requests, loadingRequests,
    applicants, applicantsLoading,
    collaborators, offboardingCollaborators, loadingCollaborators,
    selectedRequest, selectedApplicant, selectedApplicantId,
    selectedCollaborator, selectedCollaboratorId,
    profileData, profileLoading, profileSaving, profileErrors,
    documents, docUploading, docUploadProgress,
    activeView, setActiveView,
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    workflowComment, setWorkflowComment,
    workflowCommentInternal, setWorkflowCommentInternal,
    workflowCommentSaving,
    requestCollaboratorId, setRequestCollaboratorId,
    createDrawerOpen,
    reviewRequestData, reviewModeOpen,
    canRequestPersonnel, canApprovePersonnel,
    canHireApplicant, canReassignPersonnel, canUnlockSections,
    currentUserRole,
    isRequestContext, isCollaboratorContext,
    currentEntity,
    filteredRequests, filteredApplicants, filteredCollaborators, filteredOffboardingCollaborators,
    profileCompletion, checklistCompletion,
    hasContract, canHireFinal,
    currentWorkflow,
    currentContextKind,
    requestWorkspaceLoading, collaboratorProfileLoading,
    handleSelectRequest, handleSelectApplicant, handleSelectCollaborator,
    handleStartOffboarding, handleSaveProfile,
    handleUploadDocument, handleChecklistToggle, handleProfileChange,
    handleAssignCollaborator, handleAddComment,
    handleCreateRequest, handleCloseCreateRequest, handleRequestCreated,
    handleReviewRequest, handleCloseReview, handleRequestReviewed,
    handleHireApplicant,
    startingOffboardingId,
  } = state;

  const browserView   = toBrowserView(activeView);
  const currentView   = VIEWS.find(v => v.key === browserView) || VIEWS[0];
  const canAccessOffboarding = OFFBOARDING_ALLOWED_ROLES.has(String(currentUserRole || "").toLowerCase());
  const requestWorkspaceReady = !selectedRequest || READY_REQUEST_STATUSES.has(String(selectedRequest?.status || "").toLowerCase());
  const isLoading = (isRequestContext && requestWorkspaceLoading) || (isCollaboratorContext && collaboratorProfileLoading);

  // ── Entity display strings ─────────────────────────────────────────────────
  const entityName = selectedCollaborator?.fullname || selectedCollaborator?.email
    || selectedRequest?.position_title || "";
  const entitySub = selectedCollaborator?.department_name
    || [selectedRequest?.request_number, selectedRequest?.department_name].filter(Boolean).join(" · ")
    || "";

  // ── Profile form ───────────────────────────────────────────────────────────
  const { reset: resetForm, setValue: setFormValue, handleSubmit, formState: { errors: formErrors } } = useForm({
    resolver: zodResolver(commandCenterProfileSchema),
    defaultValues: profileData || {},
    mode: "onSubmit",
  });
  useEffect(() => { if (profileData) resetForm(profileData); }, [profileData, resetForm]);

  const profileErrorMap = useMemo(() => ({ ...profileErrors, ...flattenRHFErrors(formErrors) }), [profileErrors, formErrors]);

  const handleProfileChangeValidated = (section, key, value) => {
    handleProfileChange(section, key, value);
    setFormValue(`${section}.${key}`, value, { shouldDirty: true });
  };
  const handleChecklistToggleValidated = (flagKey) => {
    handleChecklistToggle(flagKey);
    setFormValue(`onboarding.${flagKey}`, !Boolean(profileData?.onboarding?.[flagKey]), { shouldDirty: true });
  };
  const handleValidatedSave = handleSubmit(
    (values) => handleSaveProfile(values),
    () => toast.error("Completa los campos obligatorios antes de guardar."),
  );

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const detailTabs = useMemo(() => {
    const tabs = [];
    if (isRequestContext) tabs.push({ key: "applicant", label: "Postulante" });
    tabs.push({ key: "profile", label: "Perfil" });
    tabs.push({ key: "checklist", label: "Checklist" });
    tabs.push({ key: "documents", label: "Documentos" });
    if (isCollaboratorContext && canAccessOffboarding) tabs.push({ key: "offboarding", label: "Salida" });
    if (isRequestContext) tabs.push({ key: "comments", label: "Comentarios" });
    return tabs;
  }, [canAccessOffboarding, isCollaboratorContext, isRequestContext]);

  const allTabs = useMemo(() => {
    if (!currentEntity) return [];
    const journey = { key: "journey", label: isRequestContext ? "Progreso" : "Resumen" };
    return [journey, ...detailTabs.map(t => ({
      ...t,
      badge: t.key === "documents" ? `${asArray(documents).length}`
        : t.key === "checklist" ? `${checklistCompletion.done ?? 0}/${checklistCompletion.total ?? 0}`
        : undefined,
    }))];
  }, [checklistCompletion, currentEntity, detailTabs, documents, isRequestContext]);

  useEffect(() => {
    if (currentEntity && !allTabs.some(t => t.key === activeTab)) {
      setActiveTab(allTabs[0]?.key || "journey");
    }
  }, [activeTab, allTabs, currentEntity, setActiveTab]);

  // ── Summary strip items ────────────────────────────────────────────────────
  const summaryItems = useMemo(() => {
    if (selectedCollaborator) return [
      { key: "profile",    label: "Perfil",    value: `${pct(profileCompletion)}%`,    hint: `${profileCompletion?.done ?? 0}/${profileCompletion?.total ?? 0} campos` },
      { key: "documents",  label: "Documentos", value: `${asArray(documents).length}`, hint: "archivos" },
      { key: "checklist",  label: "Checklist",  value: `${checklistCompletion?.done ?? 0}/${checklistCompletion?.total ?? 0}`, hint: "validaciones" },
    ];
    if (selectedRequest) return [
      { key: "status",    label: "Estado",       value: STATUS_LABELS[selectedRequest.status] || "Seguimiento" },
      { key: "owner",     label: "Responsable",  value: currentWorkflow?.current_responsible_name || selectedRequest.collaborator_name || "Sin asignar" },
      { key: "profile",   label: "Perfil",       value: `${pct(profileCompletion)}%` },
      { key: "checklist", label: "Checklist",    value: `${checklistCompletion?.done ?? 0}/${checklistCompletion?.total ?? 0}` },
    ];
    return [];
  }, [checklistCompletion, currentWorkflow, documents, profileCompletion, selectedCollaborator, selectedRequest]);

  // ── Journey data ───────────────────────────────────────────────────────────
  const journey = useMemo(() => {
    if (selectedCollaborator) {
      const profileOk    = pct(profileCompletion) === 100;
      const checklistOk  = checklistCompletion?.total > 0 && checklistCompletion.done === checklistCompletion.total;
      return {
        title: "Ciclo operativo del colaborador",
        description: "Mantiene perfil, documentos y checklist dentro del mismo espacio.",
        progress: { done: (profileOk ? 1 : 0) + (checklistOk ? 1 : 0), total: 2, percent: Math.round((pct(profileCompletion) + pct(checklistCompletion)) / 2) },
        steps: [
          { key: "profile",   label: "Completar expediente",  detail: `${profileCompletion?.done ?? 0}/${profileCompletion?.total ?? 0} campos completos.`,  status: profileOk ? "complete" : "current",  actionLabel: "Abrir perfil",    onAction: () => setActiveTab("profile") },
          { key: "checklist", label: "Cerrar checklist",       detail: `${checklistCompletion?.done ?? 0}/${checklistCompletion?.total ?? 0} validaciones.`,    status: checklistOk ? "complete" : "pending", actionLabel: "Abrir checklist", onAction: () => setActiveTab("checklist") },
        ],
      };
    }
    if (selectedRequest) {
      const ready         = READY_REQUEST_STATUSES.has(String(selectedRequest.status || "").toLowerCase());
      const stalled       = Boolean(currentWorkflow?.stalled);
      const nearSla       = Boolean(currentWorkflow?.near_sla);
      const profileOk     = pct(profileCompletion) === 100;
      const checklistOk   = checklistCompletion?.total > 0 && checklistCompletion.done === checklistCompletion.total;
      const applicantOk   = Boolean(selectedApplicant);
      const contractOk    = hasContract;
      const done = (ready ? 1 : 0) + (profileOk ? 1 : 0) + (checklistOk ? 1 : 0) + (applicantOk ? 1 : 0) + (contractOk ? 1 : 0);
      return {
        title: "Journey de ingreso",
        description: "La solicitud, el postulante y el expediente se resuelven en un flujo secuencial.",
        aside: currentWorkflow ? (
          <div className="rounded-xl border p-3 text-xs" style={stalled ? { borderColor:"#FECACA", background:"#FEF2F2", color:"#991B1B" } : nearSla ? { borderColor:"#FDE68A", background:"#FFFBEB", color:"#92400E" } : { borderColor:"#BBF7D0", background:"#F0FDF4", color:"#166534" }}>
            <p className="font-semibold uppercase tracking-widest text-[10px] mb-1">Control SLA</p>
            <p className="font-semibold">{stalled ? "Estancamiento detectado" : nearSla ? "Etapa cerca del límite" : "Etapa dentro de SLA"}</p>
            {currentWorkflow.sla_alert_message && <p className="mt-1">{currentWorkflow.sla_alert_message}</p>}
          </div>
        ) : null,
        progress: { done, total: 5, percent: Math.round((done / 5) * 100) },
        steps: [
          { key: "request",   label: "Solicitud habilitada",  detail: stalled ? `Estancada por ${currentWorkflow?.stalled_for_label || "N/A"}` : currentWorkflow?.current_stage_label || STATUS_LABELS[selectedRequest.status] || "Flujo en seguimiento", status: stalled ? "stalled" : nearSla ? "warning" : ready ? "complete" : REVIEWABLE_REQUEST_STATUSES.has(selectedRequest.status) ? "warning" : "pending" },
          { key: "applicant", label: "Elegir postulante",    detail: selectedApplicant ? `${selectedApplicant.fullname || "Postulante"} seleccionado.` : "Selecciona el candidato para iniciar el expediente.", status: applicantOk ? "complete" : "current", actionLabel: applicantOk ? "Cambiar" : "Seleccionar", onAction: () => setActiveTab("applicant") },
          { key: "profile",   label: "Preparar expediente",  detail: applicantOk ? `${profileCompletion?.done ?? 0}/${profileCompletion?.total ?? 0} campos preparados.` : "Primero elige un postulante.", status: !applicantOk ? "pending" : profileOk ? "complete" : "current", actionLabel: "Abrir perfil", onAction: () => setActiveTab("profile") },
          { key: "checklist", label: "Checklist y evidencias", detail: `${checklistCompletion?.done ?? 0}/${checklistCompletion?.total ?? 0} validaciones cerradas.`, status: checklistOk ? "complete" : "pending", actionLabel: "Abrir checklist", onAction: () => setActiveTab("checklist") },
          { key: "contract",  label: "Contrato firmado",     detail: contractOk ? "Contrato cargado correctamente." : "Pendiente subir contrato de trabajo.", status: contractOk ? "complete" : "pending", actionLabel: "Subir contrato", onAction: () => setActiveTab("documents") },
          { key: "hire",      label: "Finalizar contratación", detail: canHireFinal ? "Todos los requisitos cumplidos." : "Pendiente completar los pasos anteriores.", status: canHireFinal ? "complete" : "pending", actionLabel: "Contratar", onAction: handleHireApplicant },
        ],
      };
    }
    return { title: "Workspace unificado", description: "Selecciona una solicitud o colaborador para trabajar el flujo.", progress: { done: 0, total: 0, percent: 0 }, steps: [] };
  }, [canHireFinal, checklistCompletion, currentWorkflow, handleHireApplicant, hasContract, profileCompletion, selectedApplicant, selectedCollaborator, selectedRequest, setActiveTab]);

  // ── Tab content renderer ───────────────────────────────────────────────────
  const renderJourneyContent = () => (
    <div className={`grid gap-6 ${isRequestContext ? "xl:grid-cols-[1fr_300px]" : ""}`}>
      <CommandCenterJourneyPanel title={journey.title} description={journey.description} progress={journey.progress} steps={journey.steps} aside={journey.aside} />
      {isRequestContext && (
        <div className="space-y-4">
          {currentWorkflow && <PersonnelRequestProgress workflow={currentWorkflow} request={selectedRequest} />}
          {canReassignPersonnel && (
            <form onSubmit={handleAssignCollaborator} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <p className="text-sm font-semibold text-slate-900 mb-1">Responsable operativo</p>
              <p className="text-xs text-slate-500 mb-3">Vincula el colaborador que operará esta solicitud.</p>
              <select value={requestCollaboratorId || ""} onChange={e => setRequestCollaboratorId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-3">
                <option value="">Sin responsable asignado</option>
                {asArray(collaborators).map(c => (
                  <option key={c.id} value={c.id}>{c.fullname || c.email}</option>
                ))}
              </select>
              <Button type="submit" variant="secondary" size="sm" className="w-full">Guardar responsable</Button>
            </form>
          )}
        </div>
      )}
    </div>
  );

  const renderContextContent = () => {
    if (isRequestContext && !requestWorkspaceReady) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">Esta solicitud aún no habilita el expediente operativo.</p>
              <p className="mt-1 text-sm text-amber-800">Usa la revisión o espera a que el flujo avance a una etapa habilitada.</p>
            </div>
          </div>
        </div>
      );
    }
    switch (activeTab) {
      case "applicant":
        return (
          <div className="space-y-5">
            {selectedApplicant && <ApplicantIntakeSummary applicant={selectedApplicant} />}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="mb-4 text-sm font-semibold text-slate-900">{selectedApplicant ? "Cambiar postulante" : "Seleccionar postulante"}</p>
              <ApplicantList applicants={asArray(applicants)} loading={applicantsLoading} selectedApplicantId={selectedApplicantId} onSelectApplicant={handleSelectApplicant} />
            </div>
          </div>
        );
      case "documents":
        return (
          <WorkspaceErrorBoundary title="Error en documentos" message="El panel documental encontró un error.">
            <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
              <PersonnelDocuments documents={asArray(documents)} onDocumentUpload={handleUploadDocument} uploadingDocKey={docUploading} uploadProgress={docUploadProgress} />
            </Suspense>
          </WorkspaceErrorBoundary>
        );
      case "checklist":
        return (
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
            <PersonnelChecklist profileData={profileData} documents={asArray(documents)} onChecklistFlagToggle={handleChecklistToggleValidated} onDocumentUpload={handleUploadDocument} uploadingDocKey={docUploading} userRole={currentUserRole} />
          </Suspense>
        );
      case "offboarding":
        return (
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
            <OffboardingWorkspace collaboratorId={selectedCollaboratorId} profileData={profileData} documents={asArray(documents)} userRole={currentUserRole} onChecklistFlagToggle={handleChecklistToggleValidated} onDocumentUpload={handleUploadDocument} uploadingDocKey={docUploading} />
          </Suspense>
        );
      case "comments":
        return (
          <PersonnelRequestComments
            comments={asArray(selectedRequest?.comments)}
            commentText={workflowComment}
            onCommentTextChange={setWorkflowComment}
            commentInternal={workflowCommentInternal}
            onCommentInternalChange={setWorkflowCommentInternal}
            onCommentSubmit={handleAddComment}
            saving={workflowCommentSaving}
            canMarkInternal={canUnlockSections}
          />
        );
      default: // profile
        return (
          <WorkspaceErrorBoundary title="Error en perfil" message="El formulario de perfil encontró un error.">
            <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
              <PersonnelProfile
                profileData={profileData}
                onProfileFieldChange={handleProfileChangeValidated}
                onProfileSave={handleValidatedSave}
                loading={profileLoading}
                saving={profileSaving}
                errors={profileErrorMap}
                sections={isCollaboratorContext ? profileSections : applicantProfileSections}
                workflowStage={selectedRequest?.status || (isCollaboratorContext ? "completada" : "pendiente")}
                draftKey={isCollaboratorContext ? `collaborator:${selectedCollaboratorId || "active"}` : `request:${selectedRequest?.id || "active"}`}
              />
            </Suspense>
          </WorkspaceErrorBoundary>
        );
    }
  };

  // ── Primary action ─────────────────────────────────────────────────────────
  const primaryAction = profileData
    ? { label: profileSaving ? "Guardando..." : "Guardar expediente", onClick: handleValidatedSave, disabled: profileSaving || profileLoading }
    : canRequestPersonnel
      ? { label: "Nueva solicitud", onClick: handleCreateRequest }
      : null;

  const secondaryActions = [];
  if (selectedRequest && canApprovePersonnel) {
    secondaryActions.push({ label: "Revisar", onClick: () => handleReviewRequest(selectedRequest), disabled: !REVIEWABLE_REQUEST_STATUSES.has(String(selectedRequest.status || "")) });
  }
  if (selectedApplicant && canHireApplicant) {
    secondaryActions.push({ label: "Contratar", onClick: handleHireApplicant, disabled: !canHireFinal });
  }

  // ── Lista del navegador (flat rows, sin cards anidadas) ──────────────────────
  const browserList = useMemo(() => {
    if (browserView === "collaborators") return { items: filteredCollaborators || asArray(collaborators), loading: loadingCollaborators, kind: "collaborator" };
    if (browserView === "offboarding")   return { items: filteredOffboardingCollaborators || asArray(offboardingCollaborators), loading: loadingCollaborators, kind: "collaborator" };
    return { items: filteredRequests || asArray(requests), loading: loadingRequests, kind: "request" };
  }, [browserView, collaborators, filteredCollaborators, filteredOffboardingCollaborators, filteredRequests, loadingCollaborators, loadingRequests, offboardingCollaborators, requests]);

  const renderBrowserRows = () => {
    if (browserList.loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "#2563EB transparent transparent transparent" }} />
        </div>
      );
    }
    if (!browserList.items.length) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FiSearch size={24} className="text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">
            {searchQuery ? `Sin resultados para "${searchQuery}"` : `No hay ${currentView.emptyLabel} disponibles.`}
          </p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100">
        {browserList.kind === "request"
          ? browserList.items.map((r) => {
              const status = String(r?.status || "").toLowerCase();
              const canReview = canApprovePersonnel && REVIEWABLE_REQUEST_STATUSES.has(status);
              return (
                <div key={r.id} className="flex items-center gap-3 py-3 group">
                  <button type="button"
                    onClick={() => { handleSelectRequest(r); setBrowserOpen(false); }}
                    className="flex-1 min-w-0 text-left cursor-pointer">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{r?.position_title || "Solicitud sin título"}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 flex-shrink-0">
                        {STATUS_LABELS[status] || r?.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {[r?.request_number, r?.department_name].filter(Boolean).join(" · ") || "Sin referencia"}
                    </p>
                  </button>
                  {canReview && (
                    <button type="button"
                      onClick={() => { handleReviewRequest(r); setBrowserOpen(false); }}
                      className="flex-shrink-0 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                      Revisar
                    </button>
                  )}
                </div>
              );
            })
          : browserList.items.map((c) => {
              const statusLabel = resolveCollaboratorStatus(c);
              const isActive = statusLabel === "Activo";
              const canStart = browserView === "collaborators" && isActive && typeof handleStartOffboarding === "function";
              const starting = String(startingOffboardingId || "") === String(c?.id || "");
              return (
                <div key={c.id} className="flex items-center gap-3 py-3">
                  <button type="button"
                    onClick={() => { handleSelectCollaborator(c); setBrowserOpen(false); }}
                    className="flex-1 min-w-0 text-left cursor-pointer">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c?.fullname || c?.email || "Colaborador"}</p>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0"
                        style={statusLabel === "Pasivo" ? { background: "#F3F4F6", color: "#6B7280" } : statusLabel === "En desvinculación" ? { background: "#DBEAFE", color: "#1D4ED8" } : { background: "#DCFCE7", color: "#166534" }}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {[c?.email, c?.department_name].filter(Boolean).join(" · ") || "Sin datos"}
                    </p>
                  </button>
                  {canStart && (
                    <button type="button"
                      onClick={() => handleStartOffboarding(c)}
                      disabled={starting}
                      className="flex-shrink-0 rounded-full border border-blue-200 px-3 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 cursor-pointer">
                      {starting ? "Iniciando…" : "Iniciar desvinculación"}
                    </button>
                  )}
                </div>
              );
            })}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/*
        ── Barra de contexto única ──────────────────────────────────────────
        Una sola superficie que resuelve dos estados:
        · Sin entidad: muestra el toggle de vista y el selector de búsqueda
        · Con entidad: muestra la entidad seleccionada con sus acciones
        No hay card adicional debajo repitiendo la misma información.
      */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">

        {/* Fila superior: view toggle + acciones primarias */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
          {/* View tabs — al elegir una vista se abre el navegador de esa vista */}
          <div className="flex gap-1">
            {VIEWS.map(v => (
              <button key={v.key} type="button"
                onClick={() => { setActiveView(v.workspaceKey); setBrowserOpen(true); }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                style={browserView === v.key
                  ? { background: '#1E293B', color: '#FFFFFF' }
                  : { border: '1px solid #E5E7EB', color: '#6B7280', background: 'transparent' }
                }
              >
                {v.label}
              </button>
            ))}
          </div>
          {/* Global actions */}
          <div className="flex flex-wrap gap-2">
            {canRequestPersonnel && (
              <Button onClick={handleCreateRequest} leftIcon={<FiPlus size={14} />} size="sm">
                Nueva solicitud
              </Button>
            )}
            {secondaryActions.map((a, i) => (
              <Button key={i} variant={a.variant || "secondary"} size="sm" onClick={a.onClick} disabled={a.disabled}>
                {a.label}
              </Button>
            ))}
            {primaryAction && profileData && (
              <Button size="sm" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                {primaryAction.label}
              </Button>
            )}
          </div>
        </div>

        {/* Fila inferior: estado de selección o buscador */}
        <div className="px-4 py-3">
          {!currentEntity ? (
            /* Sin selección: botón para abrir el navegador */
            <button type="button" onClick={() => setBrowserOpen(true)}
              className="w-full flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors cursor-pointer text-left">
              <FiSearch size={15} className="flex-shrink-0 text-slate-400" />
              <span>Seleccionar {currentView.emptyLabel}...</span>
            </button>
          ) : isLoading ? (
            /* Cargando entidad */
            <div className="flex items-center gap-3 animate-pulse">
              <div className="h-4 w-48 rounded-full bg-slate-100" />
              <div className="h-3 w-32 rounded-full bg-slate-100" />
            </div>
          ) : (
            /* Entidad seleccionada */
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-slate-900 truncate">{entityName}</p>
                  {/* Workflow / status chips */}
                  {selectedRequest?.status && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      {STATUS_LABELS[selectedRequest.status] || selectedRequest.status}
                    </span>
                  )}
                  {selectedCollaborator && (
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ background: '#DCFCE7', color: '#166534' }}>
                      {resolveCollaboratorStatus(selectedCollaborator)}
                    </span>
                  )}
                </div>
                {entitySub && <p className="text-xs text-slate-500 truncate">{entitySub}</p>}
                {/* Workflow info inline */}
                {selectedRequest?.workflow && (
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                    <span className="text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">{selectedRequest.workflow.current_stage_label}</span>
                    </span>
                    {selectedRequest.workflow.next_action && (
                      <span className="text-[11px] text-slate-400">→ {selectedRequest.workflow.next_action}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button type="button"
                  onClick={() => navigate(`/dashboard/talento-humano/command-center/${toWorkspaceKey(browserView)}`, { replace: true })}
                  className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Deseleccionar">
                  <FiX size={15} />
                </button>
                <Button variant="secondary" size="sm" onClick={() => setBrowserOpen(true)}>
                  Cambiar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Summary strip — solo cuando hay entidad cargada */}
        {currentEntity && !isLoading && summaryItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 px-4 py-2.5 border-t border-slate-100 overflow-x-auto bg-slate-50/60">
            {summaryItems.map(item => (
              <div key={item.key} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{item.label}</span>
                <span className="text-sm font-semibold text-slate-700">{item.value}</span>
                {item.hint && <span className="text-[11px] text-slate-400">· {item.hint}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Estado vacío ─────────────────────────────────────────────────────── */}
      {!currentEntity && <EmptyState onOpen={() => setBrowserOpen(true)} currentView={currentView} />}

      {/* ── Workspace de la entidad ───────────────────────────────────────────── */}
      {currentEntity && !isLoading && (
        <>
          {/* Tab bar sticky */}
          {allTabs.length > 0 && (
            <div className="sticky top-0 z-10 rounded-t-2xl border border-b-0 border-slate-200 bg-white overflow-x-auto"
              style={{ boxShadow: '0 1px 0 0 #E5E7EB' }}>
              <nav className="flex px-3 sm:px-5">
                {allTabs.map(tab => (
                  <button key={tab.key} type="button"
                    onClick={() => setActiveTab(tab.key)}
                    disabled={tab.disabled}
                    className="flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                    style={activeTab === tab.key
                      ? { borderColor: '#2563EB', color: '#2563EB' }
                      : { borderColor: 'transparent', color: '#6B7280' }
                    }
                  >
                    {tab.label}
                    {tab.badge != null && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={activeTab === tab.key
                          ? { background: '#EFF6FF', color: '#1D4ED8' }
                          : { background: '#F3F4F6', color: '#6B7280' }
                        }>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* Tab content */}
          <div className="rounded-b-2xl border border-slate-200 bg-white shadow-soft p-4 sm:p-6 mb-8">
            {activeTab === "journey" ? renderJourneyContent() : renderContextContent()}
          </div>
        </>
      )}

      {/* ── Modal: navegador de la vista activa ───────────────────────────────── */}
      <Modal isOpen={browserOpen} onClose={() => setBrowserOpen(false)}
        title={`Seleccionar ${currentView.emptyLabel}`} maxWidth="max-w-lg">
        {/* Buscador */}
        <div className="relative mb-1">
          <FiSearch size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={searchQuery} autoFocus
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Buscar ${currentView.emptyLabel}...`}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
        </div>
        {/* Lista plana */}
        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
          {renderBrowserRows()}
        </div>
      </Modal>

      {/* Create / Review */}
      <ActionDrawersSection
        createDrawerOpen={createDrawerOpen}
        onCloseCreateDrawer={handleCloseCreateRequest}
        onRequestCreated={handleRequestCreated}
        reviewModeOpen={reviewModeOpen}
        reviewRequestData={reviewRequestData}
        canApprovePersonnel={canApprovePersonnel}
        onCloseReview={handleCloseReview}
        onRequestReviewed={handleRequestReviewed}
      />
    </>
  );
};

export default CollaboratorCommandCenter;
