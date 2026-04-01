import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClipboard,
  FiFilePlus,
  FiLayers,
  FiMenu,
  FiUsers,
} from "react-icons/fi";

import { DashboardLayout } from "../../../core/ui/layouts/DashboardLayout";
import Button from "../../../core/ui/components/Button";
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
import CommandCenterSkeleton, {
  JourneyPanelSkeleton,
  SummaryStripSkeleton,
  WorkspaceHeaderSectionSkeleton,
} from "../components/command-center/CommandCenterSkeleton";
import CommandCenterSummaryStrip from "../components/command-center/CommandCenterSummaryStrip";
import ActionDrawersSection from "../components/command-center/sections/ActionDrawersSection";
import EntityBrowserSection from "../components/command-center/sections/EntityBrowserSection";
import WorkspaceHeaderSection from "../components/command-center/sections/WorkspaceHeaderSection";
import WorkspaceTabsSection from "../components/command-center/sections/WorkspaceTabsSection";
import useCommandCenterState from "../hooks/useCommandCenterState";
import commandCenterProfileSchema from "../schemas/commandCenterProfileSchema";

const READY_REQUEST_STATUSES = new Set(["aprobada", "en_proceso", "completada"]);
const REVIEWABLE_REQUEST_STATUSES = new Set(["pendiente", "en_revision"]);
const OFFBOARDING_ALLOWED_ROLES = new Set([
  "jefe_financiero",
  "jefe_finanzas",
  "jefe_talento_humano",
  "admin",
  "administrador",
]);

const BROWSER_VIEW_MAP = {
  solicitudes: "requests",
  aspirantes: "applicants",
  colaboradores: "collaborators",
  requests: "requests",
  applicants: "applicants",
  collaborators: "collaborators",
};

const WORKSPACE_VIEW_MAP = {
  requests: "solicitudes",
  applicants: "aspirantes",
  collaborators: "colaboradores",
};

const toBrowserView = (value) => BROWSER_VIEW_MAP[value] || "requests";
const toWorkspaceView = (value) => WORKSPACE_VIEW_MAP[value] || value || "solicitudes";
const asArray = (value) => (Array.isArray(value) ? value : []);

const STATUS_LABELS = {
  pendiente: "Pendiente",
  en_revision: "En revision",
  aprobada: "Aprobada",
  en_proceso: "En proceso",
  completada: "Completada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};

const percentFromProgress = (progress) => {
  if (!progress) return 0;
  if (typeof progress.percent === "number") return progress.percent;
  const total = Number(progress.total || 0);
  const done = Number(progress.done || 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
};

const flattenRHFErrors = (errors = {}, prefix = "") =>
  Object.entries(errors).reduce((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value?.message) {
      acc[path] = value.message;
      return acc;
    }
    if (value && typeof value === "object") {
      return { ...acc, ...flattenRHFErrors(value, path) };
    }
    return acc;
  }, {});

const overviewCards = [
  {
    key: "requests",
    icon: FiClipboard,
    title: "Solicitudes en un solo canvas",
    detail:
      "Selecciona una solicitud para gestionar flujo, expediente, postulante y comentarios sin saltar entre vistas separadas.",
  },
  {
    key: "collaborators",
    icon: FiUsers,
    title: "Colaboradores activos",
    detail:
      "Abre cualquier colaborador para trabajar perfil, documentos y seguimiento operativo desde el mismo shell.",
  },
  {
    key: "journey",
    icon: FiLayers,
    title: "Journey central",
    detail:
      "El checklist y las acciones del proceso quedan visibles arriba, sin depender del sidebar viejo.",
  },
];

const PersonnelProfile = lazy(() => import("../components/workspace/PersonnelProfile"));
const PersonnelChecklist = lazy(() => import("../components/workspace/PersonnelChecklist"));
const PersonnelDocuments = lazy(() => import("../components/workspace/PersonnelDocuments"));
const OffboardingWorkspace = lazy(() => import("../components/workspace/OffboardingWorkspace"));

const CollaboratorCommandCenter = ({ initialView = "requests" }) => {
  const [focusMode, setFocusMode] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserPanelOpen, setBrowserPanelOpen] = useState(true);
  const state = useCommandCenterState({ initialView });

  const {
    requests,
    loadingRequests,
    requestsInitialLoading,
    applicants,
    applicantsLoading,
    applicantsInitialLoading,
    collaborators,
    loadingCollaborators,
    collaboratorsInitialLoading,
    selectedRequest,
    selectedApplicant,
    selectedApplicantId,
    selectedCollaborator,
    selectedCollaboratorId,
    profileData,
    profileLoading,
    profileSaving,
    profileErrors,
    documents,
    docUploading,
    docUploadProgress,
    activeView,
    setActiveView,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    workflowComment,
    setWorkflowComment,
    workflowCommentInternal,
    setWorkflowCommentInternal,
    workflowCommentSaving,
    requestCollaboratorId,
    setRequestCollaboratorId,
    createDrawerOpen,
    reviewRequestData,
    reviewModeOpen,
    canRequestPersonnel,
    canApprovePersonnel,
    canHireApplicant,
    canReassignPersonnel,
    canUnlockSections,
    currentUserRole,
    isRequestContext,
    isCollaboratorContext,
    currentEntity,
    filteredRequests,
    filteredApplicants,
    filteredCollaborators,
    profileCompletion,
    checklistCompletion,
    hasContract,
    canHireFinal,
    currentWorkflow,
    currentContextKind,
    requestWorkspaceLoading,
    requestWorkspaceSyncing,
    collaboratorProfileLoading,
    collaboratorProfileSyncing,
    entityRouteLoading,
    handleSelectRequest,
    handleSelectApplicant,
    handleSelectCollaborator,
    handleSaveProfile,
    handleUploadDocument,
    handleChecklistToggle,
    handleProfileChange,
    handleAssignCollaborator,
    handleAddComment,
    handleCreateRequest,
    handleCloseCreateRequest,
    handleRequestCreated,
    handleReviewRequest,
    handleCloseReview,
    handleRequestReviewed,
    handleHireApplicant,
  } = state;

  const requestWorkspaceReady =
    !selectedRequest ||
    READY_REQUEST_STATUSES.has(String(selectedRequest.status || "").toLowerCase());
  const browserView = toBrowserView(activeView);
  const canAccessOffboarding = OFFBOARDING_ALLOWED_ROLES.has(String(currentUserRole || "").toLowerCase());

  const detailTabs = useMemo(() => {
    const tabs = [];

    // Si es una solicitud, siempre habilitar pestaña de postulante
    if (isRequestContext) {
      tabs.push({ key: "applicant", label: "Postulante" });
    }

    // Perfil es común para ambos
    tabs.push({ key: "profile", label: "Perfil" });

    // Checklist y Documentos comunes
    tabs.push({ key: "checklist", label: "Checklist" });
    tabs.push({ key: "documents", label: "Documentos" });

    if (isCollaboratorContext && canAccessOffboarding) {
      tabs.push({ key: "offboarding", label: "Salida" });
    }

    // Comentarios solo para solicitudes
    if (isRequestContext) {
      tabs.push({ key: "comments", label: "Comentarios" });
    }

    return tabs;
  }, [canAccessOffboarding, isCollaboratorContext, isRequestContext]);

  useEffect(() => {
    if (!detailTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(detailTabs[0]?.key || "profile");
    }
  }, [activeTab, detailTabs, setActiveTab]);

  const profileForm = useForm({
    resolver: zodResolver(commandCenterProfileSchema),
    defaultValues: profileData || {},
    mode: "onSubmit",
  });

  const {
    reset: resetProfileForm,
    setValue: setProfileFormValue,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileFormErrors },
  } = profileForm;

  useEffect(() => {
    if (profileData) {
      resetProfileForm(profileData);
    }
  }, [profileData, resetProfileForm]);

  const profileErrorMap = useMemo(
    () => ({
      ...profileErrors,
      ...flattenRHFErrors(profileFormErrors),
    }),
    [profileErrors, profileFormErrors],
  );

  const handleProfileChangeValidated = (section, key, value) => {
    handleProfileChange(section, key, value);
    setProfileFormValue(`${section}.${key}`, value, { shouldDirty: true });
  };

  const handleChecklistToggleValidated = (flagKey) => {
    handleChecklistToggle(flagKey);
    const current = Boolean(profileData?.onboarding?.[flagKey]);
    setProfileFormValue(`onboarding.${flagKey}`, !current, { shouldDirty: true });
  };

  const handleValidatedSaveProfile = handleProfileSubmit(
    async (values) => {
      await handleSaveProfile(values);
    },
    () => {
      toast.error("Completa los campos obligatorios del perfil antes de guardar.");
    },
  );

  const headerBadges = useMemo(() => {
    const badges = [];
    if (selectedRequest) {
      badges.push({
        label: "Estado",
        value: STATUS_LABELS[selectedRequest.status] || "Seguimiento",
        variant: REVIEWABLE_REQUEST_STATUSES.has(selectedRequest.status) ? "yellow" : "blue",
      });
      if (selectedRequest.request_number) {
        badges.push({ label: "Codigo", value: selectedRequest.request_number, variant: "gray" });
      }
    }
    if (selectedCollaborator) {
      badges.push({
        label: "Colaborador",
        value: selectedCollaborator.department_name || "Activo",
        variant: "green",
      });
    }
    if ((profileCompletion?.total || 0) > 0) {
      badges.push({
        label: "Perfil",
        value: `${percentFromProgress(profileCompletion)}%`,
        variant: percentFromProgress(profileCompletion) === 100 ? "green" : "yellow",
      });
    }
    if ((checklistCompletion?.total || 0) > 0) {
      badges.push({
        label: "Checklist",
        value: `${checklistCompletion.done || 0}/${checklistCompletion.total || 0}`,
        variant:
          checklistCompletion.done === checklistCompletion.total ? "green" : "blue",
      });
    }
    return badges;
  }, [checklistCompletion, profileCompletion, selectedCollaborator, selectedRequest]);

  const workflowInfo = useMemo(() => {
    if (selectedRequest) {
      const isStalled = Boolean(currentWorkflow?.stalled);
      const isNearSla = Boolean(currentWorkflow?.near_sla);
      const statusLabel = isStalled
        ? "Estancada"
        : STATUS_LABELS[selectedRequest.status] || "Seguimiento";

      return {
        status: statusLabel,
        owner:
          currentWorkflow?.current_responsible_name ||
          selectedRequest.collaborator_name ||
          "Sin asignar",
        nextAction: currentWorkflow?.next_action || "Revisar estado de solicitud",
        alert: isStalled
          ? `Estancada por ${currentWorkflow?.stalled_for_label || "N/A"}`
          : isNearSla
            ? currentWorkflow?.sla_alert_message || "Etapa cerca del límite de SLA"
            : null,
        alertTone: isStalled ? "danger" : isNearSla ? "warning" : "normal",
      };
    }
    if (selectedCollaborator) {
      return {
        status: "Activo",
        owner: selectedCollaborator.fullname || selectedCollaborator.email || "Sin asignar",
        nextAction: "Mantener expediente y documentos al dia",
      };
    }
    return null;
  }, [currentWorkflow, selectedCollaborator, selectedRequest]);

  const summaryItems = useMemo(() => {
    if (selectedCollaborator) {
      return [
        {
          key: "profile",
          label: "Perfil",
          value: `${percentFromProgress(profileCompletion)}%`,
          hint: `${profileCompletion?.done || 0}/${profileCompletion?.total || 0} campos`,
          tone: percentFromProgress(profileCompletion) === 100 ? "positive" : "warning",
        },
        {
          key: "documents",
          label: "Documentos",
          value: `${asArray(documents).length}`,
          hint: "Archivos del expediente",
          tone: asArray(documents).length > 0 ? "info" : "warning",
        },
        {
          key: "checklist",
          label: "Checklist",
          value: `${checklistCompletion?.done || 0}/${checklistCompletion?.total || 0}`,
          hint: "Validaciones operativas",
          tone:
            checklistCompletion?.total > 0 &&
            checklistCompletion.done === checklistCompletion.total
              ? "positive"
              : "warning",
        },
      ];
    }
    if (selectedRequest) {
      return [
        {
          key: "status",
          label: "Estado",
          value: STATUS_LABELS[selectedRequest.status] || "Seguimiento",
          hint: currentWorkflow?.current_stage_label || "Flujo activo",
          tone: REVIEWABLE_REQUEST_STATUSES.has(selectedRequest.status) ? "warning" : "info",
        },
        {
          key: "owner",
          label: "Responsable",
          value:
            currentWorkflow?.current_responsible_name ||
            selectedRequest.collaborator_name ||
            "Sin asignar",
          hint: "Responsable operativo",
          tone: "info",
        },
        {
          key: "applicants",
          label: "Postulantes",
          value: `${asArray(applicants).length}`,
          hint: "Candidatos visibles",
          tone: asArray(applicants).length > 0 ? "positive" : "warning",
        },
        {
          key: "profile",
          label: "Perfil",
          value: `${percentFromProgress(profileCompletion)}%`,
          hint: `${profileCompletion?.done || 0}/${profileCompletion?.total || 0} campos`,
          tone: percentFromProgress(profileCompletion) === 100 ? "positive" : "warning",
        },
        {
          key: "checklist",
          label: "Checklist",
          value: `${checklistCompletion?.done || 0}/${checklistCompletion?.total || 0}`,
          hint: "Requisitos del ingreso",
          tone:
            checklistCompletion?.total > 0 &&
            checklistCompletion.done === checklistCompletion.total
              ? "positive"
              : "warning",
        },
      ];
    }
    return [];
  }, [
    applicants,
    checklistCompletion,
    currentWorkflow,
    documents,
    profileCompletion,
    selectedCollaborator,
    selectedRequest,
  ]);

  const journey = useMemo(() => {
    if (selectedCollaborator) {
      return {
        title: "Ciclo operativo del colaborador",
        description:
          "Mantiene perfil, documentos y salida dentro del mismo espacio operativo.",
        progress: {
          done:
            (percentFromProgress(profileCompletion) === 100 ? 1 : 0) +
            (checklistCompletion?.total > 0 &&
            checklistCompletion.done === checklistCompletion.total
              ? 1
              : 0),
          total: 2,
          percent: Math.round(
            (percentFromProgress(profileCompletion) +
              percentFromProgress(checklistCompletion)) /
              2,
          ),
        },
        steps: [
          {
            key: "profile",
            label: "Completar expediente",
            detail: `${profileCompletion?.done || 0}/${profileCompletion?.total || 0} campos del perfil completos.`,
            status:
              percentFromProgress(profileCompletion) === 100 ? "complete" : "current",
            actionLabel: "Abrir perfil",
            onAction: () => setActiveTab("profile"),
          },
          {
            key: "checklist",
            label: "Cerrar checklist",
            detail: `${checklistCompletion?.done || 0}/${checklistCompletion?.total || 0} validaciones operativas completas.`,
            status:
              checklistCompletion?.total > 0 &&
              checklistCompletion.done === checklistCompletion.total
                ? "complete"
                : "pending",
            actionLabel: "Abrir checklist",
            onAction: () => setActiveTab("checklist"),
          },
        ],
      };
    }

    if (selectedRequest) {
      const requestReady = READY_REQUEST_STATUSES.has(
        String(selectedRequest.status || "").toLowerCase(),
      );
      const workflowStalled = Boolean(currentWorkflow?.stalled);
      const workflowNearSla = Boolean(currentWorkflow?.near_sla);
      const profileReady = percentFromProgress(profileCompletion) === 100;
      const checklistReady =
        checklistCompletion?.total > 0 &&
        checklistCompletion.done === checklistCompletion.total;
      const applicantReady = Boolean(selectedApplicant);
      const contractReady = hasContract;

      const done =
        (requestReady ? 1 : 0) +
        (profileReady ? 1 : 0) +
        (checklistReady ? 1 : 0) +
        (applicantReady ? 1 : 0) +
        (contractReady ? 1 : 0);

      return {
        title: "Journey de ingreso",
        description:
          "La solicitud, el postulante y el expediente se resuelven en un flujo secuencial.",
        aside: currentWorkflow ? (
          <div
            className={`rounded-2xl border p-3 ${
              workflowStalled
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : workflowNearSla
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em]">
              Control SLA
            </p>
            <p className="mt-1 text-sm font-semibold">
              {workflowStalled
                ? "Estancamiento detectado"
                : workflowNearSla
                  ? "Etapa cerca del límite"
                  : "Etapa dentro de SLA"}
            </p>
            <p className="mt-1 text-xs">
              {currentWorkflow?.sla_alert_message || "Sin métrica de SLA disponible."}
            </p>
          </div>
        ) : null,
        progress: { done, total: 5, percent: Math.round((done / 5) * 100) },
        steps: [
          {
            key: "request",
            label: "Solicitud habilitada",
            detail: workflowStalled
              ? `Estancada por ${currentWorkflow?.stalled_for_label || "N/A"} en ${currentWorkflow?.current_stage_label || "etapa activa"}.`
              : workflowNearSla
                ? currentWorkflow?.sla_alert_message ||
                  "El tiempo consumido está cerca del límite operativo."
                : currentWorkflow?.current_stage_label ||
                  STATUS_LABELS[selectedRequest.status] ||
                  "Flujo en seguimiento",
            status: workflowStalled
              ? "stalled"
              : workflowNearSla
                ? "warning"
                : requestReady
                  ? "complete"
                  : REVIEWABLE_REQUEST_STATUSES.has(selectedRequest.status)
                    ? "warning"
                    : "pending",
          },
          {
            key: "applicant",
            label: "Elegir postulante",
            detail: selectedApplicant
              ? `${selectedApplicant.fullname || selectedApplicant.email || "Postulante"} seleccionado.`
              : "Selecciona el candidato para iniciar el expediente.",
            status: applicantReady ? "complete" : "current",
            actionLabel: applicantReady ? "Cambiar" : "Seleccionar",
            onAction: () => setActiveTab("applicant"),
          },
          {
            key: "profile",
            label: "Preparar expediente",
            detail: applicantReady
              ? `${profileCompletion?.done || 0}/${profileCompletion?.total || 0} campos preparados.`
              : "Primero debes elegir un postulante.",
            status: !applicantReady
              ? "pending"
              : profileReady
                ? "complete"
                : "current",
            actionLabel: "Abrir perfil",
            onAction: () => setActiveTab("profile"),
          },
          {
            key: "checklist",
            label: "Checklist y evidencias",
            detail: `${checklistCompletion?.done || 0}/${checklistCompletion?.total || 0} validaciones cerradas.`,
            status: checklistReady ? "complete" : "pending",
            actionLabel: "Abrir checklist",
            onAction: () => setActiveTab("checklist"),
          },
          {
            key: "contract",
            label: "Contrato firmado",
            detail: contractReady
              ? "Contrato cargado correctamente."
              : "Pendiente subir contrato de trabajo.",
            status: contractReady ? "complete" : "pending",
            actionLabel: "Subir contrato",
            onAction: () => setActiveTab("documents"),
          },
          {
            key: "hire",
            label: "Finalizar contratación",
            detail: canHireFinal
              ? "Todos los requisitos cumplidos."
              : "Pendiente completar los pasos anteriores.",
            status: canHireFinal ? "complete" : "pending",
            actionLabel: "Contratar",
            onAction: handleHireApplicant,
          },
        ],
      };
    }

    return {
      title: "Workspace unificado",
      description:
        "Selecciona una solicitud o un colaborador para trabajar el flujo completo.",
      progress: { done: 0, total: 0, percent: 0 },
      steps: [],
    };
  }, [
    checklistCompletion,
    currentWorkflow,
    handleHireApplicant,
    profileCompletion,
    selectedApplicant,
    selectedCollaborator,
    selectedRequest,
    setActiveTab,
    hasContract,
    canHireFinal,
  ]);

  const primaryAction = profileData
    ? {
        label: profileSaving ? "Guardando..." : "Guardar expediente",
        onClick: handleSaveProfile,
        disabled: profileSaving || profileLoading,
        icon: FiCheckCircle,
      }
    : canRequestPersonnel
      ? {
          label: "Nueva solicitud",
          onClick: handleCreateRequest,
          icon: FiFilePlus,
        }
      : null;

  const secondaryActions = [];
  if (selectedRequest && canApprovePersonnel) {
    secondaryActions.push({
      label: "Revision",
      onClick: () => handleReviewRequest(selectedRequest),
      disabled: !REVIEWABLE_REQUEST_STATUSES.has(
        String(selectedRequest.status || "").toLowerCase(),
      ),
    });
  }
  if (selectedApplicant && canHireApplicant) {
    secondaryActions.push({
      label: "Contratar",
      onClick: handleHireApplicant,
      disabled: !canHireFinal,
      variant: "outline",
    });
  }

  const renderContextContent = () => {
    if (isRequestContext && !requestWorkspaceReady) {
      return (
          <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="mt-0.5 shrink-0" title="Icono de advertencia de flujo" />
            <div>
              <p className="font-semibold">
                Esta solicitud aun no habilita el expediente operativo.
              </p>
              <p className="mt-2 text-amber-800">
                Usa la revision o espera a que el flujo avance a una etapa aprobada
                para completar perfil, documentos y checklist.
              </p>
            </div>
          </div>
        </div>
      );
    }
    switch (activeTab) {
      case "documents":
        return (
          <WorkspaceErrorBoundary
            title="No se pudo cargar Documentos"
            message="El panel documental falló al renderizarse. Reintenta la carga."
          >
            <Suspense fallback={<CommandCenterSkeleton />}>
              <PersonnelDocuments
                documents={documents}
                onDocumentUpload={handleUploadDocument}
                uploadingDocKey={docUploading}
                uploadProgress={docUploadProgress}
              />
            </Suspense>
          </WorkspaceErrorBoundary>
        );
      case "checklist":
        return (
          <Suspense fallback={<CommandCenterSkeleton />}>
            <PersonnelChecklist
              profileData={profileData}
              documents={documents}
              onChecklistFlagToggle={handleChecklistToggleValidated}
              onDocumentUpload={handleUploadDocument}
              uploadingDocKey={docUploading}
              userRole={currentUserRole}
            />
          </Suspense>
        );
      case "offboarding":
        return (
          <Suspense fallback={<CommandCenterSkeleton />}>
            <OffboardingWorkspace
              collaboratorId={selectedCollaboratorId}
              profileData={profileData}
              documents={documents}
              userRole={currentUserRole}
              onChecklistFlagToggle={handleChecklistToggleValidated}
              onDocumentUpload={handleUploadDocument}
              uploadingDocKey={docUploading}
            />
          </Suspense>
        );
      case "applicant":
        return (
          <div className="space-y-6">
            {selectedApplicant && (
              <ApplicantIntakeSummary applicant={selectedApplicant} />
            )}
            <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-stone-800">
                {selectedApplicant ? "Cambiar postulante" : "Seleccionar postulante"}
              </h3>
              <ApplicantList
                applicants={applicants}
                loading={applicantsLoading}
                selectedApplicantId={selectedApplicantId}
                onSelectApplicant={handleSelectApplicant}
              />
            </div>
          </div>
        );
      case "comments":
        return (
          <PersonnelRequestComments
            comments={selectedRequest?.comments || []}
            commentText={workflowComment}
            onCommentTextChange={setWorkflowComment}
            commentInternal={workflowCommentInternal}
            onCommentInternalChange={setWorkflowCommentInternal}
            onCommentSubmit={handleAddComment}
            saving={workflowCommentSaving}
            canMarkInternal={canUnlockSections}
          />
        );
      case "profile":
      default:
        return (
          <WorkspaceErrorBoundary
            title="No se pudo cargar Perfil"
            message="El formulario del perfil encontró un error. Reintenta la carga."
          >
            <Suspense fallback={<CommandCenterSkeleton />}>
              <PersonnelProfile
                profileData={profileData}
                onProfileFieldChange={handleProfileChangeValidated}
                onProfileSave={handleValidatedSaveProfile}
                loading={profileLoading}
                saving={profileSaving}
                errors={profileErrorMap}
                sections={isCollaboratorContext ? profileSections : applicantProfileSections}
                workflowStage={selectedRequest?.status || (isCollaboratorContext ? "completada" : "pendiente")}
                draftKey={
                  isCollaboratorContext
                    ? `collaborator:${selectedCollaboratorId || "active"}`
                    : `request:${selectedRequest?.id || "active"}`
                }
              />
            </Suspense>
          </WorkspaceErrorBoundary>
        );
    }
  };

  const browserProps = {
    activeView: browserView,
    onChangeView: (view) => setActiveView(toWorkspaceView(view)),
    searchQuery,
    onSearchChange: setSearchQuery,
    requests: filteredRequests || requests,
    loadingRequests,
    selectedRequestId: selectedRequest?.id,
    onSelectRequest: (request) => {
      handleSelectRequest(request);
      setBrowserOpen(false);
    },
    applicants: filteredApplicants || applicants,
    applicantsLoading,
    selectedApplicantId,
    onSelectApplicant: (applicant) => {
      handleSelectApplicant(applicant);
      setBrowserOpen(false);
    },
    collaborators: filteredCollaborators || collaborators,
    loadingCollaborators,
    selectedCollaboratorId,
    onSelectCollaborator: (collaborator) => {
      handleSelectCollaborator(collaborator);
      setBrowserOpen(false);
    },
    canRequestPersonnel,
    canApprovePersonnel,
    onCreateRequest: handleCreateRequest,
    onOpenReview: (request) => {
      handleReviewRequest(request);
      setBrowserOpen(false);
    },
    hideControls: true,
  };
  const hasInitialData =
    asArray(requests).length > 0 ||
    asArray(applicants).length > 0 ||
    asArray(collaborators).length > 0;
  const showLoadingSkeleton =
    !currentEntity &&
    !focusMode &&
    !hasInitialData &&
    (requestsInitialLoading || applicantsInitialLoading || collaboratorsInitialLoading);

  const showEntityBootstrapSkeleton =
    !focusMode &&
    !currentEntity &&
    entityRouteLoading;

  const shouldShowHeaderSkeleton =
    Boolean(currentEntity) &&
    ((isRequestContext && (requestWorkspaceLoading || requestWorkspaceSyncing)) ||
      (isCollaboratorContext &&
        (collaboratorProfileLoading || collaboratorProfileSyncing)));

  return (
    <DashboardLayout includeWidgets={false} className="bg-slate-100 dark:bg-slate-900 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 text-slate-900 dark:text-slate-100">
        {showLoadingSkeleton || showEntityBootstrapSkeleton ? (
          <CommandCenterSkeleton />
        ) : (
          <>
            {shouldShowHeaderSkeleton ? (
              <WorkspaceHeaderSectionSkeleton />
            ) : (
              <WorkspaceHeaderSection
                currentEntity={currentEntity}
                currentContextKind={currentContextKind}
                summaryBadges={headerBadges}
                onOpenBrowser={() => setBrowserOpen(true)}
                onToggleFocus={() => setFocusMode((current) => !current)}
                focusMode={focusMode}
                primaryAction={primaryAction}
                secondaryActions={secondaryActions}
                workflowInfo={workflowInfo}
              />
            )}

            {!focusMode && (
              <EntityBrowserSection
                open={browserPanelOpen}
                onToggle={() => setBrowserPanelOpen((current) => !current)}
                activeView={browserView}
                onChangeView={(view) => setActiveView(toWorkspaceView(view))}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                browserProps={browserProps}
              />
            )}

            {!currentEntity && (
              <div className="grid gap-4 xl:grid-cols-3">
                {overviewCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <Icon size={20} title={`Icono de resumen: ${card.title}`} />
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-slate-900">{card.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{card.detail}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {currentEntity && (
              <div className="space-y-6">
                {shouldShowHeaderSkeleton ? (
                  <SummaryStripSkeleton />
                ) : (
                  <CommandCenterSummaryStrip items={summaryItems} />
                )}
                <div className={`grid gap-6 ${focusMode ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_320px]"}`}>
                  <div className="space-y-6">
                    {shouldShowHeaderSkeleton ? (
                      <JourneyPanelSkeleton />
                    ) : (
                      <CommandCenterJourneyPanel
                        title={journey.title}
                        description={journey.description}
                        progress={journey.progress}
                        steps={journey.steps}
                        aside={journey.aside}
                      />
                    )}
                    <WorkspaceTabsSection
                      tabs={detailTabs.map((tab) => ({
                        ...tab,
                        badge:
                          tab.key === "documents"
                            ? `${documents.length}`
                            : tab.key === "checklist"
                              ? `${checklistCompletion.done || 0}/${checklistCompletion.total || 0}`
                              : undefined,
                      }))}
                      activeTab={activeTab}
                      onChangeTab={setActiveTab}
                      footer={
                        profileData ? (
                          <div className="flex flex-col gap-3">
                            <p className="text-xs text-slate-500">
                              Validacion activa con React Hook Form + Zod antes de persistir en JSONB.
                            </p>
                          </div>
                        ) : null
                      }
                    >
                      {renderContextContent()}
                    </WorkspaceTabsSection>
                  </div>
                  {!focusMode && (
                    <div className="space-y-6">
                      {isRequestContext && currentWorkflow && (
                        <PersonnelRequestProgress workflow={currentWorkflow} request={selectedRequest} />
                      )}
                      {selectedRequest && canReassignPersonnel && (
                        <form onSubmit={handleAssignCollaborator} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-sm font-semibold text-slate-900">Responsable operativo</p>
                          <p className="mt-1 text-xs text-slate-500">Vincula el colaborador que operara esta solicitud.</p>
                          <select
                            value={requestCollaboratorId || ""}
                            onChange={(event) => setRequestCollaboratorId(event.target.value)}
                            className="mt-4 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          >
                            <option value="">Sin responsable asignado</option>
                            {asArray(collaborators).map((collaborator) => (
                              <option key={collaborator.id} value={collaborator.id}>
                                {collaborator.fullname || collaborator.email}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" variant="secondary" size="sm" className="mt-4 w-full" aria-label="Guardar responsable operativo de la solicitud">
                            Guardar responsable
                          </Button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <ActionDrawersSection
          browserOpen={browserOpen}
          onCloseBrowser={() => setBrowserOpen(false)}
          browserProps={browserProps}
          createDrawerOpen={createDrawerOpen}
          onCloseCreateDrawer={handleCloseCreateRequest}
          onRequestCreated={handleRequestCreated}
          reviewModeOpen={reviewModeOpen}
          reviewRequestData={reviewRequestData}
          canApprovePersonnel={canApprovePersonnel}
          onCloseReview={handleCloseReview}
          onRequestReviewed={handleRequestReviewed}
        />

        <div className="fixed bottom-5 right-5 z-30 xl:hidden">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setBrowserOpen(true)}
            leftIcon={<FiMenu title="Icono de navegación" />}
            aria-label="Abrir panel de navegación contextual"
          >
            Navegar
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CollaboratorCommandCenter;
