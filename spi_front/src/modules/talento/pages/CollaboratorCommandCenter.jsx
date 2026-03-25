import React, { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiClipboard,
  FiFilePlus,
  FiLayers,
  FiMenu,
  FiUsers,
  FiX,
} from "react-icons/fi";

import { DashboardLayout } from "../../../core/ui/layouts/DashboardLayout";
import Button from "../../../core/ui/components/Button";
import PersonnelRequestForm from "../../../core/ui/widgets/PersonnelRequestForm";
import {
  applicantProfileSections,
  profileSections,
} from "../components/collaboratorProfileDefinitions";
import ApplicantIntakeSummary from "../components/workspace/ApplicantIntakeSummary";
import PersonnelChecklist from "../components/workspace/PersonnelChecklist";
import PersonnelDocuments from "../components/workspace/PersonnelDocuments";
import PersonnelProfile from "../components/workspace/PersonnelProfile";
import PersonnelRequestComments from "../components/workspace/PersonnelRequestComments";
import PersonnelRequestProgress from "../components/workspace/PersonnelRequestProgress";
import PersonnelRequestReview from "../components/workspace/PersonnelRequestReview";
import CommandCenterContextPanel from "../components/command-center/CommandCenterContextPanel";
import CommandCenterEntityBrowser from "../components/command-center/CommandCenterEntityBrowser";
import CommandCenterJourneyPanel from "../components/command-center/CommandCenterJourneyPanel";
import CommandCenterSummaryStrip from "../components/command-center/CommandCenterSummaryStrip";
import CommandCenterWorkspaceHeader from "../components/command-center/CommandCenterWorkspaceHeader";
import useCommandCenterState from "../hooks/useCommandCenterState";

const READY_REQUEST_STATUSES = new Set(["aprobada", "en_proceso", "completada"]);
const REVIEWABLE_REQUEST_STATUSES = new Set(["pendiente", "en_revision"]);

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

const STATUS_LABELS = {
  pendiente: "Pendiente",
  en_revision: "En revision",
  aprobada: "Aprobada",
  en_proceso: "En proceso",
  completada: "Completada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};

const toBrowserView = (value) => BROWSER_VIEW_MAP[value] || "requests";
const toWorkspaceView = (value) => WORKSPACE_VIEW_MAP[value] || value || "solicitudes";
const asArray = (value) => (Array.isArray(value) ? value : []);

const percentFromProgress = (progress) => {
  if (!progress) return 0;
  if (typeof progress.percent === "number") return progress.percent;
  const total = Number(progress.total || 0);
  const done = Number(progress.done || 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
};

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

const CollaboratorCommandCenter = ({ initialView = "solicitudes" }) => {
  const [focusMode, setFocusMode] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const state = useCommandCenterState({ initialView });

  const {
    requests,
    loadingRequests,
    applicants,
    applicantsLoading,
    collaborators,
    loadingCollaborators,
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
    isRequestContext,
    isCollaboratorContext,
    currentEntity,
    filteredRequests,
    filteredApplicants,
    filteredCollaborators,
    profileCompletion,
    checklistCompletion,
    currentWorkflow,
    currentContextKind,
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

  const detailTabs = useMemo(() => {
    const tabs = [
      { key: "profile", label: "Perfil" },
      { key: "documents", label: "Documentos" },
      { key: "checklist", label: "Checklist" },
    ];
    if (isRequestContext && selectedApplicant) {
      tabs.push({ key: "applicant", label: "Postulante" });
    }
    if (isRequestContext) {
      tabs.push({ key: "comments", label: "Comentarios" });
    }
    return tabs;
  }, [isRequestContext, selectedApplicant]);

  useEffect(() => {
    if (!detailTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(detailTabs[0]?.key || "profile");
    }
  }, [activeTab, detailTabs, setActiveTab]);

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
      const profileReady = percentFromProgress(profileCompletion) === 100;
      const checklistReady =
        checklistCompletion?.total > 0 &&
        checklistCompletion.done === checklistCompletion.total;
      const applicantReady = Boolean(selectedApplicant);
      const done =
        (requestReady ? 1 : 0) +
        (profileReady ? 1 : 0) +
        (checklistReady ? 1 : 0) +
        (applicantReady ? 1 : 0);
      return {
        title: "Journey de ingreso",
        description:
          "La solicitud, el expediente y el postulante se resuelven en el mismo flujo.",
        progress: { done, total: 4, percent: done * 25 },
        steps: [
          {
            key: "request",
            label: "Solicitud habilitada",
            detail:
              currentWorkflow?.current_stage_label ||
              STATUS_LABELS[selectedRequest.status] ||
              "Flujo en seguimiento",
            status: requestReady
              ? "complete"
              : REVIEWABLE_REQUEST_STATUSES.has(selectedRequest.status)
                ? "warning"
                : "pending",
          },
          {
            key: "profile",
            label: "Preparar expediente",
            detail: `${profileCompletion?.done || 0}/${profileCompletion?.total || 0} campos preparados.`,
            status: profileReady ? "complete" : "current",
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
            key: "hire",
            label: selectedApplicant ? "Contratacion lista" : "Seleccionar postulante",
            detail: selectedApplicant
              ? `${selectedApplicant.fullname || selectedApplicant.email || "Postulante"} listo para cierre.`
              : "Aun no se ha fijado un postulante activo para esta solicitud.",
            status: selectedApplicant ? "current" : "pending",
            actionLabel: selectedApplicant && canHireApplicant ? "Contratar" : "Abrir detalle",
            onAction: selectedApplicant && canHireApplicant
              ? handleHireApplicant
              : () => setActiveTab("applicant"),
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
    canHireApplicant,
    checklistCompletion,
    currentWorkflow,
    handleHireApplicant,
    profileCompletion,
    selectedApplicant,
    selectedCollaborator,
    selectedRequest,
    setActiveTab,
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
      disabled: !requestWorkspaceReady,
      variant: "outline",
    });
  }

  const renderContextContent = () => {
    if (isRequestContext && !requestWorkspaceReady) {
      return (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="mt-0.5 shrink-0" />
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
          <PersonnelDocuments
            documents={documents}
            onUpload={handleUploadDocument}
            uploadingDocKey={docUploading}
          />
        );
      case "checklist":
        return (
          <PersonnelChecklist
            profileData={profileData}
            documents={documents}
            onToggleFlag={handleChecklistToggle}
          />
        );
      case "applicant":
        return selectedApplicant ? (
          <ApplicantIntakeSummary applicant={selectedApplicant} />
        ) : (
          <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
            No hay postulante seleccionado para esta solicitud.
          </div>
        );
      case "comments":
        return (
          <PersonnelRequestComments
            comments={selectedRequest?.comments || []}
            commentText={workflowComment}
            setCommentText={setWorkflowComment}
            commentInternal={workflowCommentInternal}
            setCommentInternal={setWorkflowCommentInternal}
            onAddComment={handleAddComment}
            saving={workflowCommentSaving}
            canMarkInternal={canUnlockSections}
          />
        );
      case "profile":
      default:
        return (
          <PersonnelProfile
            profileData={profileData}
            onChange={handleProfileChange}
            onSave={handleSaveProfile}
            loading={profileLoading}
            saving={profileSaving}
            errors={profileErrors}
            canUnlockSections={canUnlockSections}
            sections={isCollaboratorContext ? profileSections : applicantProfileSections}
          />
        );
    }
  };

  return (
    <DashboardLayout includeWidgets={false} className="bg-[#f6f1e8]">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-6">
        <div
          className={`grid gap-6 ${
            focusMode ? "grid-cols-1" : "xl:grid-cols-[360px_minmax(0,1fr)]"
          }`}
        >
          {!focusMode && (
            <aside className="hidden xl:block">
              <CommandCenterEntityBrowser
                activeView={browserView}
                onChangeView={(view) => setActiveView(toWorkspaceView(view))}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                requests={filteredRequests || requests}
                loadingRequests={loadingRequests}
                selectedRequestId={selectedRequest?.id}
                onSelectRequest={(request) => {
                  handleSelectRequest(request);
                  setBrowserOpen(false);
                }}
                applicants={filteredApplicants || applicants}
                applicantsLoading={applicantsLoading}
                selectedApplicantId={selectedApplicantId}
                onSelectApplicant={(applicant) => {
                  handleSelectApplicant(applicant);
                  setBrowserOpen(false);
                }}
                collaborators={filteredCollaborators || collaborators}
                loadingCollaborators={loadingCollaborators}
                selectedCollaboratorId={selectedCollaboratorId}
                onSelectCollaborator={(collaborator) => {
                  handleSelectCollaborator(collaborator);
                  setBrowserOpen(false);
                }}
                canRequestPersonnel={canRequestPersonnel}
                canApprovePersonnel={canApprovePersonnel}
                onCreateRequest={handleCreateRequest}
                onOpenReview={handleReviewRequest}
              />
            </aside>
          )}
          <section className="overflow-hidden rounded-[36px] border border-stone-200 bg-[#fcfaf7] shadow-[0_24px_80px_rgba(28,25,23,0.08)]">
            <CommandCenterWorkspaceHeader
              currentEntity={currentEntity}
              currentContextKind={currentContextKind}
              summaryBadges={headerBadges}
              onOpenBrowser={() => setBrowserOpen(true)}
              onToggleFocus={() => setFocusMode((current) => !current)}
              focusMode={focusMode}
              primaryAction={primaryAction}
              secondaryActions={secondaryActions}
            />
            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
              {!currentEntity && (
                <div className="grid gap-4 xl:grid-cols-3">
                  {overviewCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div
                        key={card.key}
                        className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                          <Icon size={20} />
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-stone-950">
                          {card.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {card.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              {currentEntity && (
                <div className="space-y-6">
                  <CommandCenterSummaryStrip items={summaryItems} />
                  <div
                    className={`grid gap-6 ${
                      focusMode ? "grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_320px]"
                    }`}
                  >
                    <div className="space-y-6">
                      <CommandCenterJourneyPanel
                        title={journey.title}
                        description={journey.description}
                        progress={journey.progress}
                        steps={journey.steps}
                      />
                      <CommandCenterContextPanel
                        tabs={detailTabs}
                        activeTab={activeTab}
                        onChangeTab={setActiveTab}
                        footer={
                          profileData ? (
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-xs text-stone-500">
                                El guardado sigue siendo manual para evitar cierres
                                accidentales mientras se reorganiza el modulo.
                              </p>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={handleSaveProfile}
                                disabled={profileSaving || profileLoading}
                                rightIcon={FiArrowRight}
                              >
                                Guardar cambios
                              </Button>
                            </div>
                          ) : null
                        }
                      >
                        {renderContextContent()}
                      </CommandCenterContextPanel>
                    </div>
                    {!focusMode && (
                      <div className="space-y-6">
                        {isRequestContext && currentWorkflow && (
                          <PersonnelRequestProgress
                            workflow={currentWorkflow}
                            request={selectedRequest}
                          />
                        )}
                        {selectedRequest && canReassignPersonnel && (
                          <form
                            onSubmit={handleAssignCollaborator}
                            className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm"
                          >
                            <p className="text-sm font-semibold text-stone-900">
                              Responsable operativo
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                              Vincula el colaborador que operara esta solicitud.
                            </p>
                            <select
                              value={requestCollaboratorId || ""}
                              onChange={(event) =>
                                setRequestCollaboratorId(event.target.value)
                              }
                              className="mt-4 w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            >
                              <option value="">Sin responsable asignado</option>
                              {asArray(collaborators).map((collaborator) => (
                                <option key={collaborator.id} value={collaborator.id}>
                                  {collaborator.fullname || collaborator.email}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="submit"
                              variant="secondary"
                              size="sm"
                              className="mt-4 w-full"
                            >
                              Guardar responsable
                            </Button>
                          </form>
                        )}
                        {selectedApplicant && (
                          <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
                            <p className="text-sm font-semibold text-stone-900">
                              Postulante activo
                            </p>
                            <p className="mt-1 text-sm text-stone-600">
                              {selectedApplicant.fullname ||
                                selectedApplicant.email ||
                                "Sin nombre"}
                            </p>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="mt-4 w-full"
                              onClick={() => setActiveTab("applicant")}
                            >
                              Abrir resumen del postulante
                            </Button>
                          </div>
                        )}
                        {selectedCollaborator && (
                          <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
                            <p className="text-sm font-semibold text-stone-900">
                              Colaborador activo
                            </p>
                            <div className="mt-3 space-y-2 text-sm text-stone-600">
                              <p>
                                <span className="font-semibold text-stone-900">
                                  Correo:
                                </span>{" "}
                                {selectedCollaborator.email || "No registrado"}
                              </p>
                              <p>
                                <span className="font-semibold text-stone-900">
                                  Area:
                                </span>{" "}
                                {selectedCollaborator.department_name ||
                                  profileData?.laboral?.area ||
                                  "Sin definir"}
                              </p>
                              <p>
                                <span className="font-semibold text-stone-900">
                                  Cargo:
                                </span>{" "}
                                {profileData?.laboral?.cargo || "Sin definir"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {browserOpen && (
        <div className="fixed inset-0 z-40 flex bg-stone-950/40 xl:hidden">
          <div
            className="flex-1"
            aria-hidden="true"
            onClick={() => setBrowserOpen(false)}
          />
          <div className="w-full max-w-md border-l border-stone-200 bg-[#f8f4ec] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-900">Navegador</p>
              <button
                type="button"
                onClick={() => setBrowserOpen(false)}
                className="rounded-full border border-stone-200 bg-white p-2 text-stone-600"
              >
                <FiX />
              </button>
            </div>
            <CommandCenterEntityBrowser
              activeView={browserView}
              onChangeView={(view) => setActiveView(toWorkspaceView(view))}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              requests={filteredRequests || requests}
              loadingRequests={loadingRequests}
              selectedRequestId={selectedRequest?.id}
              onSelectRequest={(request) => {
                handleSelectRequest(request);
                setBrowserOpen(false);
              }}
              applicants={filteredApplicants || applicants}
              applicantsLoading={applicantsLoading}
              selectedApplicantId={selectedApplicantId}
              onSelectApplicant={(applicant) => {
                handleSelectApplicant(applicant);
                setBrowserOpen(false);
              }}
              collaborators={filteredCollaborators || collaborators}
              loadingCollaborators={loadingCollaborators}
              selectedCollaboratorId={selectedCollaboratorId}
              onSelectCollaborator={(collaborator) => {
                handleSelectCollaborator(collaborator);
                setBrowserOpen(false);
              }}
              canRequestPersonnel={canRequestPersonnel}
              canApprovePersonnel={canApprovePersonnel}
              onCreateRequest={handleCreateRequest}
              onOpenReview={(request) => {
                handleReviewRequest(request);
                setBrowserOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {createDrawerOpen && (
        <div className="fixed inset-0 z-50 flex bg-stone-950/40">
          <div
            className="flex-1"
            aria-hidden="true"
            onClick={handleCloseCreateRequest}
          />
          <div className="flex h-full w-full max-w-3xl flex-col overflow-y-auto border-l border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Nuevo flujo
                </p>
                <h2 className="text-lg font-semibold text-stone-950">
                  Crear solicitud de personal
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseCreateRequest}
                className="rounded-full border border-stone-200 bg-white p-2 text-stone-600"
              >
                <FiX />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <PersonnelRequestForm
                isModal={false}
                onClose={handleCloseCreateRequest}
                onSuccess={handleRequestCreated}
              />
            </div>
          </div>
        </div>
      )}

      {reviewModeOpen && reviewRequestData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/40 p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={handleCloseReview}
                className="rounded-full border border-stone-200 bg-white p-2 text-stone-600 shadow-sm"
              >
                <FiX />
              </button>
            </div>
            <PersonnelRequestReview
              request={reviewRequestData}
              onCancel={handleCloseReview}
              onUpdate={handleRequestReviewed}
              canApprove={canApprovePersonnel}
            />
          </div>
        </div>
      )}

      <div className="fixed bottom-5 right-5 z-30 xl:hidden">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setBrowserOpen(true)}
          leftIcon={FiMenu}
        >
          Navegar
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default CollaboratorCommandCenter;
