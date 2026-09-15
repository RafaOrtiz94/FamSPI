import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  FiAlertCircle,
  FiFileText,
  FiPlus,
  FiSearch,
  FiX,
} from "react-icons/fi";

import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import {
  applicantProfileSections,
  checklistSections as checklistSectionsTemplate,
  documentTypes,
  profileSections,
} from "../components/collaboratorProfileDefinitions";
import ApplicantIntakeSummary from "../components/workspace/ApplicantIntakeSummary";
import PipelineWorkspace from "../components/pipeline/PipelineWorkspace";
import PersonnelRequestComments from "../components/workspace/PersonnelRequestComments";
import PersonnelRequestProgress from "../components/workspace/PersonnelRequestProgress";
import WorkspaceErrorBoundary from "../components/workspace/WorkspaceErrorBoundary";
import {
  canUploadDocumentInAccess,
  computeChecklistCompletionBySections,
  filterChecklistSectionsByAccess,
  filterDocumentDefinitionsByAccess,
  resolveTalentWorkspaceAccess,
} from "../components/workspace/workspaceAccess";
import CommandCenterJourneyPanel from "../components/command-center/CommandCenterJourneyPanel";
import ActionDrawersSection from "../components/command-center/sections/ActionDrawersSection";
import useCommandCenterState from "../hooks/useCommandCenterState";
import commandCenterProfileSchema from "../schemas/commandCenterProfileSchema";

const PersonnelProfile   = lazy(() => import("../components/workspace/PersonnelProfile"));
const PersonnelChecklist = lazy(() => import("../components/workspace/PersonnelChecklist"));
const PersonnelDocuments = lazy(() => import("../components/workspace/PersonnelDocuments"));
const PersonnelReports = lazy(() => import("../components/workspace/PersonnelReports"));
const OffboardingWorkspace = lazy(() => import("../components/workspace/OffboardingWorkspace"));

// ── Constants ────────────────────────────────────────────────────────────────

const READY_REQUEST_STATUSES     = new Set(["aprobada", "en_proceso", "completada"]);
const REVIEWABLE_REQUEST_STATUSES = new Set(["pendiente", "en_revision"]);
const OFFBOARDING_ALLOWED_ROLES   = new Set([
  "talento_humano","jefe_financiero","jefe_finanzas","jefe_ti",
  "jefe_talento_humano","gerencia_general","admin","administrador",
]);

const VIEWS = [
  { key: "requests",      workspaceKey: "solicitudes",   label: "Gestión de contratación", emptyLabel: "expediente de contratación" },
  { key: "collaborators", workspaceKey: "colaboradores",  label: "Gestión de colaboradores", emptyLabel: "expediente de colaborador" },
  { key: "offboarding",   workspaceKey: "desvinculacion", label: "Gestión de despidos o renuncias", emptyLabel: "expediente de salida laboral" },
];

const STATUS_LABELS = {
  pendiente:"Pendiente", en_revision:"En revisión", aprobada:"Aprobada",
  en_proceso:"En proceso", completada:"Completada", rechazada:"Rechazada", cancelada:"Cancelada",
};
const PASSIVE_STATUSES = new Set(["pasivo","desvinculado","inactivo"]);

const toBrowserView  = (v) => ({ solicitudes:"requests", colaboradores:"collaborators", desvinculacion:"offboarding", aspirantes:"applicants", requests:"requests", collaborators:"collaborators", offboarding:"offboarding" }[v] || "requests");
const toWorkspaceKey = (v) => ({ requests:"solicitudes", collaborators:"colaboradores", offboarding:"desvinculacion" }[v] || v);
const resolveWorkspaceViewLabel = (viewKey) => ({
  requests: "Gestion de contratacion",
  collaborators: "Gestion de colaboradores",
  offboarding: "Gestion de despidos o renuncias",
}[viewKey] || "Workspace");
const resolveWorkspaceScopeBanner = (scope, fallbackBanner) => ({
  financial:
    "Vista limitada a la revision de validaciones financieras, documentos financieros y checklist visible para el area financiera dentro del expediente laboral.",
  ti:
    "Vista limitada al control de herramientas de comunicacion, accesos, actas tecnologicas y checklist operativo asignado al area de TI.",
  logistics:
    "Vista limitada al control de herramientas de trabajo, logistica, ropa de trabajo, EPP y validaciones operativas asignadas a esta area.",
  restricted:
    "Vista limitada a funciones especificas del expediente laboral segun los permisos del area asignada.",
}[scope] || fallbackBanner || "Gestiona unicamente los elementos autorizados para tu area dentro del expediente.");

const asArray   = (v) => (Array.isArray(v) ? v : []);
const pct       = (p) => (typeof p?.percent === "number" ? Math.max(0, Math.min(100, p.percent)) : p?.total > 0 ? Math.round(((p.done ?? 0) / p.total) * 100) : 0);
const resolveDocumentType = (document = {}) =>
  String(document?.canonical_doc_type || document?.doc_type || "")
    .trim()
    .toUpperCase();

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

const APPLICANT_PROFILE_ALIAS_MAP = [
  ["personal.nombres", ["nombres"]],
  ["personal.apellidos", ["apellidos"]],
  ["personal.cedula", ["cedula"]],
  ["personal.tipo_sangre", ["tipo_sangre"]],
  ["personal.genero", ["genero"]],
  ["personal.lugar_nacimiento", ["lugar_nacimiento"]],
  ["personal.estado_civil", ["estado_civil"]],
  ["personal.telefono_personal", ["telefono"]],
  ["personal.email_personal", ["email"]],
  ["laboral.cargo", ["cargo", "position_title"]],
  ["laboral.residencia", ["lugar_residencia", "residencia"]],
];

const getNestedValue = (source, path = "") =>
  String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), source);

const applySeedValue = (target, path, value) => {
  if (value === undefined || value === null || String(value).trim() === "") return;
  const keys = String(path || "").split(".").filter(Boolean);
  if (!keys.length) return;
  let cursor = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key];
  });
};

const buildProfileSeedFromApplicant = (applicant, baseProfile = {}) => {
  const seed = JSON.parse(JSON.stringify(baseProfile || {}));
  const applicantProfile = applicant?.profile || {};

  Object.entries(baseProfile || {}).forEach(([sectionKey, sectionShape]) => {
    const sectionValue = applicantProfile?.[sectionKey];
    if (!sectionValue || typeof sectionValue !== "object") return;
    Object.keys(sectionShape || {}).forEach((fieldKey) => {
      const fieldValue = sectionValue?.[fieldKey];
      applySeedValue(seed, `${sectionKey}.${fieldKey}`, fieldValue);
    });
  });

  APPLICANT_PROFILE_ALIAS_MAP.forEach(([targetPath, sourcePaths]) => {
    const resolved = sourcePaths
      .map((sourcePath) => getNestedValue(applicant, sourcePath))
      .find((value) => value !== undefined && value !== null && String(value).trim() !== "");
    applySeedValue(seed, targetPath, resolved);
  });

  return seed;
};

// ── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = ({ onOpen, currentView }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center shadow-soft">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
      <FiSearch size={22} className="text-slate-400" />
    </div>
    <p className="text-base font-semibold text-slate-800 mb-1">
      No hay un expediente seleccionado en el workspace
    </p>
    <p className="text-sm text-slate-500 mb-6 max-w-xs">
      Abre el navegador y selecciona un registro de {resolveWorkspaceViewLabel(currentView?.key).toLowerCase()} para revisar su informacion operativa, sus documentos y las acciones habilitadas.
    </p>
    <Button onClick={onOpen} leftIcon={<FiSearch size={15} />}>
      Abrir navegador de expedientes
    </Button>
  </div>
);

// ── Main component ───────────────────────────────────────────────────────────

const WorkspaceEmptyState = EmptyState;

const CollaboratorCommandCenter = ({ initialView = "requests" }) => {
  const navigate = useNavigate();
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserModalView, setBrowserModalView] = useState("requests");
  const [requestApplicantFilter, setRequestApplicantFilter] = useState("");
  const [requestApplicationDateFilter, setRequestApplicationDateFilter] = useState("");

  const state = useCommandCenterState({ initialView });
  const {
    requests, loadingRequests,
    applicants, refetchApplicants,
    collaborators, offboardingCollaborators, loadingCollaborators,
    selectedRequest, selectedApplicant, selectedApplicantId,
    selectedCollaborator, selectedCollaboratorId,
    profileData, profileLoading, profileSaving, profileErrors,
    qualifications,
    qualificationMigrationPending,
    documents, docUploading, docUploadProgress,
    activeView,
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    workflowComment, setWorkflowComment,
    workflowCommentInternal, setWorkflowCommentInternal,
    workflowCommentSaving,
    requestCollaboratorId, setRequestCollaboratorId,
    requestRequesterId, setRequestRequesterId,
    requesterCandidates, requesterAssigning,
    createDrawerOpen,
    reviewRequestData, reviewModeOpen,
    canRequestPersonnel, canApprovePersonnel,
    canHireApplicant, canReassignPersonnel, canReassignRequester, canUnlockSections,
    currentUserRole,
    isCurrentRequestOwner,
    isRequestContext, isCollaboratorContext,
    currentEntity,
    filteredRequests, filteredApplicants, filteredCollaborators, filteredOffboardingCollaborators,
    profileCompletion, checklistCompletion,
    canHireFinal,
    currentWorkflow,
    requestWorkspaceLoading, collaboratorProfileLoading,
    handleSelectRequest, handleSelectApplicant, handleSelectCollaborator,
    handleStartOffboarding, handleSaveProfile,
    handleUploadDocument, handleChecklistToggle, handleProfileChange, handleQualificationsChange, handleResolveQualificationPending,
    handleAssignCollaborator, handleAssignRequester, handleAddComment,
    handleCreateRequest, handleCloseCreateRequest, handleRequestCreated,
    handleReviewRequest, handleCloseReview, handleRequestReviewed,
    handleHireApplicant,
    startingOffboardingId,
  } = state;

  const browserView   = toBrowserView(activeView);
  const currentView   = VIEWS.find(v => v.key === browserView) || VIEWS[0];
  const currentBrowserModalView = VIEWS.find((v) => v.key === browserModalView) || currentView;
  const normalizedApplicantFilter = String(requestApplicantFilter || "").trim().toLowerCase();
  const normalizedApplicationDateFilter = String(requestApplicationDateFilter || "").trim();
  const canAccessOffboarding = OFFBOARDING_ALLOWED_ROLES.has(String(currentUserRole || "").toLowerCase());
  const hasOffboardingStarted = Boolean(
    selectedCollaborator?.offboarding_requested === true ||
    profileData?.onboarding?.offboarding_requested === true,
  );
  const workspaceAccess = useMemo(() => {
    const baseAccess = resolveTalentWorkspaceAccess(currentUserRole);
    if (isRequestContext && isCurrentRequestOwner && !baseAccess.canViewProfile) {
      return {
        ...baseAccess,
        scope: "request_owner",
        canViewProfile: true,
        banner:
          "Vista del jefe de área sobre su propia solicitud. Puedes revisar postulantes, su ficha consolidada y el CV vinculado sin editar el expediente.",
      };
    }
    return baseAccess;
  }, [currentUserRole, isCurrentRequestOwner, isRequestContext]);
  const scopedDocumentDefinitions = useMemo(
    () => filterDocumentDefinitionsByAccess(documentTypes, workspaceAccess),
    [workspaceAccess],
  );
  const visibleDocumentCodes = useMemo(
    () =>
      new Set(
        scopedDocumentDefinitions.map((definition) =>
          String(definition?.key || "").trim().toUpperCase(),
        ),
      ),
    [scopedDocumentDefinitions],
  );
  const scopedDocuments = useMemo(
    () =>
      asArray(documents).filter((document) =>
        visibleDocumentCodes.has(resolveDocumentType(document)),
      ),
    [documents, visibleDocumentCodes],
  );
  const scopedChecklistSections = useMemo(
    () => filterChecklistSectionsByAccess(checklistSectionsTemplate, workspaceAccess),
    [workspaceAccess],
  );
  const displayedChecklistCompletion = useMemo(
    () =>
      workspaceAccess.scope === "full"
        ? checklistCompletion
        : computeChecklistCompletionBySections(
            scopedChecklistSections,
            profileData,
            documents,
            resolveDocumentType,
          ),
    [checklistCompletion, documents, profileData, scopedChecklistSections, workspaceAccess.scope],
  );
  const requestWorkspaceReady = !selectedRequest || READY_REQUEST_STATUSES.has(String(selectedRequest?.status || "").toLowerCase());
  const isLoading = (isRequestContext && requestWorkspaceLoading) || (isCollaboratorContext && collaboratorProfileLoading);

  useEffect(() => {
    if (browserOpen) {
      setBrowserModalView(currentView.key);
    }
  }, [browserOpen, currentView.key]);

  // ── Pipeline entries (actualizadas desde PipelineWorkspace) ───────────────
  const [pipelineEntries, setPipelineEntries] = useState([]);
  useEffect(() => { setPipelineEntries([]); }, [selectedRequest?.id]);

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
  const handleValidatedSave = handleSubmit((values) => handleSaveProfile(values));
  const handleHydrateProfileFromApplicant = () => {
    if (!selectedApplicant || !workspaceAccess.canEditProfile) {
      toast.error("Selecciona un postulante para obtener informacion inicial.");
      return;
    }

    const nextProfile = buildProfileSeedFromApplicant(selectedApplicant, profileData || {});
    let hydratedFields = 0;

    Object.entries(nextProfile || {}).forEach(([sectionKey, sectionValue]) => {
      if (!sectionValue || typeof sectionValue !== "object") return;
      Object.entries(sectionValue).forEach(([fieldKey, fieldValue]) => {
        handleProfileChange(sectionKey, fieldKey, fieldValue);
        setFormValue(`${sectionKey}.${fieldKey}`, fieldValue, { shouldDirty: true });
        hydratedFields += 1;
      });
    });

    if (hydratedFields === 0) {
      toast.error("El expediente inicial no tiene datos reutilizables para esta ficha.");
      return;
    }

    toast.success("La ficha fue actualizada con la informacion disponible del postulante.");
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const detailTabs = useMemo(() => {
    const tabs = [];
    if (isRequestContext && workspaceAccess.canViewProfile) tabs.push({ key: "applicant", label: "Elegir postulante" });
    if (workspaceAccess.canViewProfile) tabs.push({ key: "profile", label: "Ficha y perfil laboral" });
    if (scopedChecklistSections.length > 0) tabs.push({ key: "checklist", label: "Checklist de cumplimiento" });
    if (scopedDocumentDefinitions.length > 0) tabs.push({ key: "documents", label: "Documentos del expediente" });
    if (isCollaboratorContext && workspaceAccess.scope === "full") {
      tabs.push({ key: "reports", label: "Reporte individual" });
    }
    if (isCollaboratorContext && canAccessOffboarding && workspaceAccess.scope !== "restricted") {
      tabs.push({
        key: "offboarding",
        label: "Gestion de salida laboral",
        disabled: !hasOffboardingStarted,
      });
    }
    if (isRequestContext && workspaceAccess.canViewComments) tabs.push({ key: "comments", label: "Comentarios operativos" });
    return tabs;
  }, [canAccessOffboarding, hasOffboardingStarted, isCollaboratorContext, isRequestContext, scopedChecklistSections.length, scopedDocumentDefinitions.length, workspaceAccess]);

  const allTabs = useMemo(() => {
    if (!currentEntity) return [];
    const baseTabs = detailTabs.map(t => ({
      ...t,
      badge: t.key === "documents" ? `${scopedDocuments.length}`
        : t.key === "checklist" ? `${displayedChecklistCompletion.done ?? 0}/${displayedChecklistCompletion.total ?? 0}`
        : undefined,
    }));
    if (isRequestContext) return baseTabs;
    return [{ key: "journey", label: "Resumen operativo" }, ...baseTabs];
  }, [currentEntity, detailTabs, displayedChecklistCompletion, isRequestContext, scopedDocuments.length]);

  useEffect(() => {
    if (currentEntity && !allTabs.some(t => t.key === activeTab)) {
      setActiveTab(allTabs[0]?.key || (isRequestContext ? "applicant" : "journey"));
    }
  }, [activeTab, allTabs, currentEntity, isRequestContext, setActiveTab]);

  useEffect(() => {
    if (selectedRequest?.id) {
      setActiveTab("applicant");
    }
  }, [selectedRequest?.id, setActiveTab]);

  useEffect(() => {
    if (activeTab === "offboarding" && !hasOffboardingStarted) {
      setActiveTab("journey");
    }
  }, [activeTab, hasOffboardingStarted, setActiveTab]);

  // ── Summary strip items ────────────────────────────────────────────────────
  const summaryItems = useMemo(() => {
    if (selectedCollaborator) {
      const items = [];
      if (workspaceAccess.canViewProfile) {
        items.push({ key: "profile", label: "Perfil", value: `${pct(profileCompletion)}%`, hint: `${profileCompletion?.done ?? 0}/${profileCompletion?.total ?? 0} campos` });
      }
      if (scopedDocumentDefinitions.length > 0) {
        items.push({ key: "documents", label: "Documentos", value: `${scopedDocuments.length}`, hint: "archivos visibles" });
      }
      if (scopedChecklistSections.length > 0) {
        items.push({ key: "checklist", label: "Checklist", value: `${displayedChecklistCompletion?.done ?? 0}/${displayedChecklistCompletion?.total ?? 0}`, hint: "validaciones visibles" });
      }
      return items;
    }
    if (selectedRequest) {
      const items = [
        { key: "status", label: "Estado", value: STATUS_LABELS[selectedRequest.status] || "Seguimiento" },
        { key: "owner", label: "Responsable", value: currentWorkflow?.current_responsible_name || selectedRequest.collaborator_name || "Sin asignar" },
      ];
      if (workspaceAccess.canViewProfile) {
        items.push({ key: "profile", label: "Perfil", value: `${pct(profileCompletion)}%` });
      }
      if (scopedChecklistSections.length > 0) {
        items.push({ key: "checklist", label: "Checklist", value: `${displayedChecklistCompletion?.done ?? 0}/${displayedChecklistCompletion?.total ?? 0}` });
      }
      return items;
    }
    return [];
  }, [currentWorkflow, displayedChecklistCompletion, profileCompletion, scopedChecklistSections.length, scopedDocumentDefinitions.length, scopedDocuments.length, selectedCollaborator, selectedRequest, workspaceAccess.canViewProfile]);

  // ── Journey data ───────────────────────────────────────────────────────────
  const journey = useMemo(() => {
    if (selectedCollaborator) {
      const profileOk    = pct(profileCompletion) === 100;
      const checklistOk  = displayedChecklistCompletion?.total > 0 && displayedChecklistCompletion.done === displayedChecklistCompletion.total;

      if (!workspaceAccess.canViewProfile) {
        const steps = [];

        if (scopedChecklistSections.length > 0) {
          steps.push({
            key: "checklist",
            label: "Checklist operativo",
            detail: `${displayedChecklistCompletion?.done ?? 0}/${displayedChecklistCompletion?.total ?? 0} validaciones visibles.`,
            status: checklistOk ? "complete" : "current",
            actionLabel: "Abrir checklist",
            onAction: () => setActiveTab("checklist"),
          });
        }

        if (scopedDocumentDefinitions.length > 0) {
          const documentsOk = scopedDocuments.length >= scopedDocumentDefinitions.length;
          steps.push({
            key: "documents",
            label: "Documentos del área",
            detail: `${scopedDocuments.length}/${scopedDocumentDefinitions.length} documentos visibles cargados.`,
            status: documentsOk ? "complete" : steps.length === 0 ? "current" : "pending",
            actionLabel: "Abrir documentos",
            onAction: () => setActiveTab("documents"),
          });
        }

        const total = steps.length;
        const done = steps.filter((step) => step.status === "complete").length;

        return {
          title: "Vista operativa por área",
          description: resolveWorkspaceScopeBanner(workspaceAccess.scope, workspaceAccess.banner),
          progress: {
            done,
            total,
            percent: total > 0 ? Math.round((done / total) * 100) : 0,
          },
          steps,
        };
      }

      return {
        title: "Ciclo operativo del colaborador",
        description: "Concentra la ficha laboral, el control documental y el checklist de cumplimiento dentro del expediente central de Talento Humano.",
        progress: { done: (profileOk ? 1 : 0) + (checklistOk ? 1 : 0), total: 2, percent: Math.round((pct(profileCompletion) + pct(displayedChecklistCompletion)) / 2) },
        steps: [
          { key: "profile",   label: "Completar expediente",  detail: `${profileCompletion?.done ?? 0}/${profileCompletion?.total ?? 0} campos completos.`,  status: profileOk ? "complete" : "current",  actionLabel: "Abrir perfil",    onAction: () => setActiveTab("profile") },
          { key: "checklist", label: "Cerrar checklist",       detail: `${displayedChecklistCompletion?.done ?? 0}/${displayedChecklistCompletion?.total ?? 0} validaciones.`,    status: checklistOk ? "complete" : "pending", actionLabel: "Abrir checklist", onAction: () => setActiveTab("checklist") },
        ],
      };
    }
    if (selectedRequest) {
      const ready         = READY_REQUEST_STATUSES.has(String(selectedRequest.status || "").toLowerCase());
      const stalled       = Boolean(currentWorkflow?.stalled);
      const nearSla       = Boolean(currentWorkflow?.near_sla);
      const checklistOk   = displayedChecklistCompletion?.total > 0 && displayedChecklistCompletion.done === displayedChecklistCompletion.total;
      const requestStepStatus = stalled ? "stalled" : nearSla ? "warning" : ready ? "complete" : REVIEWABLE_REQUEST_STATUSES.has(selectedRequest.status) ? "warning" : "pending";
      const requestAside = currentWorkflow ? (
        <div className="rounded-xl border p-3 text-xs" style={stalled ? { borderColor:"#FECACA", background:"#FEF2F2", color:"#991B1B" } : nearSla ? { borderColor:"#FDE68A", background:"#FFFBEB", color:"#92400E" } : { borderColor:"#BBF7D0", background:"#F0FDF4", color:"#166534" }}>
          <p className="font-semibold uppercase tracking-widest text-[10px] mb-1">Control SLA</p>
          <p className="font-semibold">{stalled ? "Estancamiento detectado" : nearSla ? "Etapa cerca del límite" : "Etapa dentro de SLA"}</p>
          {currentWorkflow.sla_alert_message && <p className="mt-1">{currentWorkflow.sla_alert_message}</p>}
        </div>
      ) : null;

      if (!workspaceAccess.canViewProfile) {
        const steps = [
          {
            key: "request",
            label: "Solicitud habilitada",
            detail: stalled ? `Estancada por ${currentWorkflow?.stalled_for_label || "N/A"}` : currentWorkflow?.current_stage_label || STATUS_LABELS[selectedRequest.status] || "Flujo en seguimiento",
            status: requestStepStatus,
          },
        ];

        if (scopedChecklistSections.length > 0) {
          steps.push({
            key: "checklist",
            label: "Checklist operativo",
            detail: `${displayedChecklistCompletion?.done ?? 0}/${displayedChecklistCompletion?.total ?? 0} validaciones visibles.`,
            status: checklistOk ? "complete" : "current",
            actionLabel: "Abrir checklist",
            onAction: () => setActiveTab("checklist"),
          });
        }

        if (scopedDocumentDefinitions.length > 0) {
          const documentsOk = scopedDocuments.length >= scopedDocumentDefinitions.length;
          steps.push({
            key: "documents",
            label: "Documentos del área",
            detail: `${scopedDocuments.length}/${scopedDocumentDefinitions.length} documentos visibles cargados.`,
            status: documentsOk ? "complete" : "pending",
            actionLabel: "Abrir documentos",
            onAction: () => setActiveTab("documents"),
          });
        }

        const total = steps.length;
        const done = steps.filter((step) => step.status === "complete").length;

        return {
          title: "Seguimiento operativo por área",
          description: resolveWorkspaceScopeBanner(workspaceAccess.scope, workspaceAccess.banner),
          aside: requestAside,
          progress: { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 },
          steps,
        };
      }

      // ── Journey basado en pipeline ─────────────────────────────────────────
      const PIPELINE_STAGES = [
        { key: "revision_perfil",        label: "Revisión del perfil" },
        { key: "primera_entrevista",     label: "Primera entrevista" },
        { key: "prueba_habilidades",     label: "Prueba de habilidades" },
        { key: "evaluacion_psicologica", label: "Evaluación psicológica" },
        { key: "entrevista_gerencia",    label: "Entrevista con gerencia" },
        { key: "oferta_contratacion",    label: "Oferta y contratación" },
      ];
      const STAGE_ORDER_MAP = Object.fromEntries(PIPELINE_STAGES.map((s, i) => [s.key, i]));

      const activeEntries   = pipelineEntries.filter(e => e.status === "en_evaluacion");
      const rejectedEntries = pipelineEntries.filter(e => e.status === "rechazado");
      const hiredEntry      = pipelineEntries.find(e => e.status === "contratado");
      const totalApplicants = asArray(applicants).length;

      // La etapa más avanzada entre los postulantes activos
      const maxStageIdx = activeEntries.length
        ? Math.max(...activeEntries.map(e => STAGE_ORDER_MAP[e.current_stage] ?? -1))
        : hiredEntry ? 5 : -1;

      // Estado de cada etapa del pipeline
      const stageStepStatus = (stageIdx) => {
        if (hiredEntry) return "complete";
        if (maxStageIdx > stageIdx) return "complete";
        if (maxStageIdx === stageIdx) return "current";
        return "pending";
      };

      const pipelineSteps = PIPELINE_STAGES.map((s, idx) => {
        const inThisStage = activeEntries.filter(e => e.current_stage === s.key);
        const passedThisStage = activeEntries.filter(e => (STAGE_ORDER_MAP[e.current_stage] ?? -1) > idx);
        const detail = hiredEntry
          ? "Proceso completado — postulante contratado."
          : maxStageIdx > idx
          ? `${passedThisStage.length + (hiredEntry ? 1 : 0)} postulante(s) superaron esta etapa.`
          : maxStageIdx === idx && inThisStage.length
          ? `${inThisStage.length} postulante(s) en esta etapa.`
          : "Aún no iniciada.";

        return {
          key: s.key,
          label: s.label,
          detail,
          status: stageStepStatus(idx),
          actionLabel: "Ver evaluación",
          onAction: () => setActiveTab("applicant"),
        };
      });

      const pipelineDone = hiredEntry ? 6 : maxStageIdx >= 0 ? Math.min(maxStageIdx + 1, 6) : 0;
      const hasEntries = pipelineEntries.length > 0;

      return {
        title: "Seguimiento del proceso de selección",
        description: hasEntries
          ? `${pipelineEntries.length} postulante(s) en el proceso — ${activeEntries.length} en evaluación, ${rejectedEntries.length} rechazados${hiredEntry ? ", 1 contratado" : ""}.`
          : totalApplicants > 0
          ? `${totalApplicants} postulante(s) vinculados. Abre el tab "Selección y evaluación" para iniciar el proceso.`
          : "Aún no hay postulantes en el proceso de selección para este expediente.",
        aside: requestAside,
        progress: { done: pipelineDone, total: 6, percent: Math.round((pipelineDone / 6) * 100) },
        steps: [
          { key: "request", label: "Solicitud habilitada", detail: stalled ? `Estancada: ${currentWorkflow?.stalled_for_label || "N/A"}` : currentWorkflow?.current_stage_label || STATUS_LABELS[selectedRequest.status] || "Flujo en seguimiento", status: requestStepStatus },
          ...pipelineSteps,
        ],
      };
    }
    return { title: "Workspace de Talento Humano", description: "Selecciona un expediente para gestionar contratación, colaboración activa o salida laboral dentro del módulo centralizado de Talento Humano.", progress: { done: 0, total: 0, percent: 0 }, steps: [] };
  }, [applicants, currentWorkflow, displayedChecklistCompletion, pipelineEntries, profileCompletion, scopedChecklistSections.length, scopedDocumentDefinitions.length, scopedDocuments.length, selectedCollaborator, selectedRequest, setActiveTab, workspaceAccess]);

  // ── Tab content renderer ───────────────────────────────────────────────────
  const renderJourneyContent = () => (
    <div className={`grid gap-6 min-w-0 ${isRequestContext ? "xl:grid-cols-[1fr_300px]" : ""}`}>
      <CommandCenterJourneyPanel title={journey.title} description={journey.description} progress={journey.progress} steps={journey.steps} aside={journey.aside} />
      {isRequestContext && (
        <div className="space-y-4">
          {currentWorkflow && <PersonnelRequestProgress workflow={currentWorkflow} request={selectedRequest} />}
          {canReassignRequester && (
            <form onSubmit={handleAssignRequester} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <p className="text-sm font-semibold text-slate-900 mb-1">Origen del expediente</p>
              <p className="text-xs text-slate-500 mb-3">
                Define el jefe de area que debe ver y dar seguimiento a esta solicitud cuando el expediente fue creado por Talento Humano u otro usuario administrativo.
              </p>
              <select
                value={requestRequesterId || ""}
                onChange={(e) => setRequestRequesterId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-3"
              >
                <option value="">Selecciona un jefe de area</option>
                {asArray(requesterCandidates).map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {(candidate.fullname || candidate.email)}{candidate.role ? ` · ${candidate.role}` : ""}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary" size="sm" className="w-full" disabled={!requestRequesterId || requesterAssigning}>
                {requesterAssigning ? "Guardando..." : "Guardar jefe de area"}
              </Button>
            </form>
          )}
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
    if (isRequestContext && !requestWorkspaceReady && activeTab !== "applicant") {
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
        return selectedRequest?.id ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,420px)]">
            <WorkspaceErrorBoundary title="Error en postulantes" message="La selección de postulantes encontró un error.">
              <PipelineWorkspace
                requestId={selectedRequest.id}
                applicants={asArray(filteredApplicants || applicants)}
                selectedApplicantId={selectedApplicantId}
                linkedApplicantId={selectedApplicantId}
                onApplicantSelect={handleSelectApplicant}
                onEntriesChange={setPipelineEntries}
                onApplicantsSynced={refetchApplicants}
              />
            </WorkspaceErrorBoundary>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Postulante seleccionado
                </p>
                {selectedApplicant ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-slate-900">
                          {selectedApplicant.fullname || selectedApplicant.name || "Postulante"}
                        </p>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Activo para la ficha
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {[selectedApplicant.email, selectedApplicant.cargo || selectedApplicant.position_title].filter(Boolean).join(" · ") || "Sin datos complementarios"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Este expediente del postulante es la base para completar la ficha laboral. Puedes continuar al siguiente tab para traer la información disponible.
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Selecciona un postulante de la lista para revisar su expediente inicial y continuar con su pipeline de calificación.
                  </div>
                )}
              </div>

              {selectedApplicant ? (
                <ApplicantIntakeSummary applicant={selectedApplicant} />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-soft">
                  El resumen del expediente inicial se mostrará aquí cuando elijas un postulante.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-8 text-center">
            <p className="text-sm text-[#9CA3AF]">Selecciona una solicitud para gestionar el proceso de selección.</p>
          </div>
        );
      case "documents":
        return (
          <WorkspaceErrorBoundary title="Error en documentos" message="El panel documental encontró un error.">
            <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
              <PersonnelDocuments
                documents={scopedDocuments}
                qualifications={asArray(qualifications)}
                documentDefinitions={scopedDocumentDefinitions}
                onDocumentUpload={handleUploadDocument}
                uploadingDocKey={docUploading}
                uploadProgress={docUploadProgress}
                canUploadDocument={(definition) => canUploadDocumentInAccess(definition, workspaceAccess)}
                readOnly={!workspaceAccess.canEditProfile}
              />
            </Suspense>
          </WorkspaceErrorBoundary>
        );
      case "checklist":
        return (
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
            <PersonnelChecklist profileData={profileData} documents={asArray(documents)} sections={scopedChecklistSections} onChecklistFlagToggle={handleChecklistToggleValidated} onDocumentUpload={handleUploadDocument} uploadingDocKey={docUploading} userRole={currentUserRole} canUploadDocument={(definition) => canUploadDocumentInAccess(definition, workspaceAccess)} readOnly={!workspaceAccess.canEditProfile} />
          </Suspense>
        );
      case "offboarding":
        return (
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
            <OffboardingWorkspace collaboratorId={selectedCollaboratorId} profileData={profileData} documents={asArray(documents)} userRole={currentUserRole} onChecklistFlagToggle={handleChecklistToggleValidated} onDocumentUpload={handleUploadDocument} uploadingDocKey={docUploading} />
          </Suspense>
        );
      case "reports":
        return (
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
            <PersonnelReports
              selectedCollaborator={selectedCollaborator}
              profileData={profileData}
              documents={asArray(documents)}
              qualifications={asArray(qualifications)}
              profileSections={profileSections}
              checklistSections={scopedChecklistSections}
              documentDefinitions={scopedDocumentDefinitions}
              visibleCollaborators={
                browserView === "offboarding"
                  ? asArray(offboardingCollaborators)
                  : asArray(collaborators)
              }
              activeView={activeView}
              mode="current"
            />
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
          <div className="space-y-4">
            {isRequestContext ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Expediente inicial del postulante
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Usa este botón para traer a la ficha los datos verificables ya cargados en el expediente inicial del postulante seleccionado.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleHydrateProfileFromApplicant}
                    disabled={!selectedApplicant || !workspaceAccess.canEditProfile}
                  >
                    Obtener información del expediente inicial
                  </Button>
                </div>
              </div>
            ) : null}

            <WorkspaceErrorBoundary title="Error en perfil" message="El formulario de perfil encontró un error.">
              <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
                <PersonnelProfile
                  profileData={profileData}
                  qualifications={asArray(qualifications)}
                  qualificationMigrationPending={qualificationMigrationPending}
                  onQualificationsChange={handleQualificationsChange}
                  onResolveQualificationPending={handleResolveQualificationPending}
                  showCentralQualifications={isCollaboratorContext}
                  onProfileFieldChange={handleProfileChangeValidated}
                  onProfileSave={handleValidatedSave}
                  loading={profileLoading}
                  saving={profileSaving}
                  errors={profileErrorMap}
                  sections={isCollaboratorContext ? profileSections : applicantProfileSections}
                  workflowStage={selectedRequest?.status || (isCollaboratorContext ? "completada" : "pendiente")}
                  draftKey={isCollaboratorContext ? `collaborator:${selectedCollaboratorId || "active"}` : `request:${selectedRequest?.id || "active"}`}
                  readOnly={!workspaceAccess.canEditProfile}
                />
              </Suspense>
            </WorkspaceErrorBoundary>
          </div>
        );
    }
  };

  // ── Primary action ─────────────────────────────────────────────────────────
  const primaryAction = profileData && workspaceAccess.canEditProfile
    ? { label: profileSaving ? "Guardando..." : "Guardar expediente", onClick: handleValidatedSave, disabled: profileSaving || profileLoading }
    : canRequestPersonnel && workspaceAccess.canCreateRequests
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
    if (browserModalView === "collaborators") return { items: filteredCollaborators || asArray(collaborators), loading: loadingCollaborators, kind: "collaborator" };
    if (browserModalView === "offboarding")   return { items: filteredOffboardingCollaborators || asArray(offboardingCollaborators), loading: loadingCollaborators, kind: "collaborator" };
    const requestItems = asArray(filteredRequests || requests).filter((request) => {
      const applicantName = String(request?.applicant_fullname || request?.applicant_name || "").toLowerCase();
      const applicationDate = String(request?.applicant_created_at || "").slice(0, 10);
      const matchesApplicant = !normalizedApplicantFilter || applicantName.includes(normalizedApplicantFilter);
      const matchesApplicationDate = !normalizedApplicationDateFilter || applicationDate === normalizedApplicationDateFilter;
      return matchesApplicant && matchesApplicationDate;
    });
    return { items: requestItems, loading: loadingRequests, kind: "request" };
  }, [
    browserModalView,
    collaborators,
    filteredCollaborators,
    filteredOffboardingCollaborators,
    filteredRequests,
    loadingCollaborators,
    loadingRequests,
    normalizedApplicantFilter,
    normalizedApplicationDateFilter,
    offboardingCollaborators,
    requests,
  ]);

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
            {searchQuery ? `Sin resultados para "${searchQuery}"` : `No hay ${currentBrowserModalView.emptyLabel} disponibles.`}
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
                    <p className="text-[11px] text-slate-400 truncate mt-1">
                      {[
                        r?.applicant_fullname ? `Postulante: ${r.applicant_fullname}` : "Sin postulante vinculado",
                        r?.applicant_created_at ? `Postulación: ${new Date(r.applicant_created_at).toLocaleDateString()}` : null,
                      ].filter(Boolean).join(" · ")}
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
              const canStart = browserModalView === "collaborators" && isActive && typeof handleStartOffboarding === "function";
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
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Workspace de Talento Humano
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Gestion integral del ciclo laboral
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Administra en un solo modulo la gestion de contratacion, la administracion de colaboradores activos, el control documental del expediente y los procesos de despidos o renuncias con trazabilidad por etapa.
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white">
                  {resolveWorkspaceViewLabel(currentView.key)}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                  Workspace operativo
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Centraliza la selección del expediente, las acciones del flujo y el estado actual sin duplicar controles.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button variant="secondary" size="sm" onClick={() => setBrowserOpen(true)}>
                Abrir navegador
              </Button>
              {['talento_humano', 'gerencia_general'].includes(String(currentUserRole || '').toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/talento-humano/reporte-documentacion')}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97]"
                >
                  <FiFileText size={13} />
                  Reporte de documentacion
                </button>
              )}
              {canRequestPersonnel && (
                <Button onClick={handleCreateRequest} leftIcon={<FiPlus size={14} />} size="sm">
                  Nueva solicitud
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-5">
          {!currentEntity ? (
            <button
              type="button"
              onClick={() => setBrowserOpen(true)}
              className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-left transition-colors hover:border-slate-400 hover:bg-white cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                  <FiSearch size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    Seleccionar expediente
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Abre un expediente de {resolveWorkspaceViewLabel(currentView.key).toLowerCase()} para empezar a trabajar.
                  </p>
                </div>
              </div>
            </button>
          ) : isLoading ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="h-5 w-52 rounded-full bg-slate-200" />
                <div className="mt-3 h-3 w-40 rounded-full bg-slate-100" />
                <div className="mt-2 h-3 w-64 rounded-full bg-slate-100" />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="h-10 w-36 rounded-2xl bg-slate-100 animate-pulse" />
                <div className="h-10 w-32 rounded-2xl bg-slate-100 animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 truncate text-lg font-semibold text-slate-900">{entityName}</p>
                  {selectedRequest?.status && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
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
                {entitySub && <p className="mt-1 text-sm text-slate-500">{entitySub}</p>}
                {selectedRequest?.workflow && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                      {selectedRequest.workflow.current_stage_label}
                    </span>
                    {selectedRequest.workflow.next_action && (
                      <span className="text-slate-500">
                        Siguiente accion: <span className="font-medium text-slate-700">{selectedRequest.workflow.next_action}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:max-w-[360px] xl:justify-end">
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
                <Button variant="secondary" size="sm" onClick={() => setBrowserOpen(true)}>
                  Cambiar expediente
                </Button>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/talento-humano/command-center/${toWorkspaceKey(browserView)}`, { replace: true })}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 active:scale-[0.97] cursor-pointer"
                  title="Cerrar expediente actual"
                >
                  <FiX size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

        {currentEntity && !isLoading && summaryItems.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryItems.map((item) => (
                <div key={item.key} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{item.value}</p>
                  {item.hint ? <p className="mt-1 text-xs text-slate-500">{item.hint}</p> : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Estado vacío ─────────────────────────────────────────────────────── */}
      {currentEntity && !isLoading && workspaceAccess.scope !== "full" && workspaceAccess.banner && (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Vista limitada</p>
          <p className="mt-1 text-sm text-blue-900">{resolveWorkspaceScopeBanner(workspaceAccess.scope, workspaceAccess.banner)}</p>
        </div>
      )}
      {!currentEntity && <WorkspaceEmptyState onOpen={() => setBrowserOpen(true)} currentView={currentView} />}

      {workspaceAccess.scope === "full" && (
        <div className="mb-5">
          <Suspense
            fallback={
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-soft">
                Cargando reportes...
              </div>
            }
          >
            <PersonnelReports
              selectedCollaborator={selectedCollaborator}
              profileData={profileData}
              documents={asArray(documents)}
              qualifications={asArray(qualifications)}
              profileSections={profileSections}
              checklistSections={scopedChecklistSections}
              documentDefinitions={scopedDocumentDefinitions}
              visibleCollaborators={
                browserView === "offboarding"
                  ? asArray(filteredOffboardingCollaborators || offboardingCollaborators)
                  : asArray(filteredCollaborators || collaborators)
              }
              activeView={toWorkspaceKey(browserView)}
              mode="bulk"
            />
          </Suspense>
        </div>
      )}

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
                    title={tab.disabled ? "Esta vista se habilita solo cuando el expediente ya tiene una desvinculacion iniciada." : undefined}
                    className="flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                    style={activeTab === tab.key
                      ? { borderColor: '#2563EB', color: '#2563EB' }
                      : { borderColor: 'transparent', color: '#6B7280' }
                    }
                  >
                    {tab.label}
                    {tab.disabled && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: '#F3F4F6', color: '#6B7280' }}
                      >
                        Bloqueado
                      </span>
                    )}
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
          <div className="rounded-b-2xl border border-slate-200 bg-white shadow-soft p-4 sm:p-6 mb-8 min-w-0 overflow-hidden">
            {activeTab === "journey" ? renderJourneyContent() : renderContextContent()}
          </div>
        </>
      )}

      {/* ── Modal: navegador de la vista activa ───────────────────────────────── */}
      <Modal isOpen={browserOpen} onClose={() => setBrowserOpen(false)}
        title="Navegador de expedientes" maxWidth="max-w-4xl">
        <div className="mb-4 flex flex-wrap gap-2">
          {VIEWS.map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => setBrowserModalView(view.key)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
              style={browserModalView === view.key
                ? { background: '#1E293B', color: '#FFFFFF' }
                : { border: '1px solid #E5E7EB', color: '#6B7280', background: 'transparent' }
              }
            >
              {resolveWorkspaceViewLabel(view.key)}
            </button>
          ))}
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Cambia de tab dentro del navegador para buscar el expediente correcto sin perder el contexto del workspace principal.
        </p>
        {/* Buscador */}
        <div className="relative mb-1">
          <FiSearch size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={searchQuery} autoFocus
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={browserModalView === "requests"
              ? "Buscar por expediente o nombre del postulante..."
              : `Buscar expediente de ${resolveWorkspaceViewLabel(currentBrowserModalView.key).toLowerCase()}...`}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
        </div>
        {browserModalView === "requests" && (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Postulante</span>
              <input
                type="search"
                value={requestApplicantFilter}
                onChange={(e) => setRequestApplicantFilter(e.target.value)}
                placeholder="Filtrar por postulante"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fecha de postulación</span>
              <input
                type="date"
                value={requestApplicationDateFilter}
                onChange={(e) => setRequestApplicationDateFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        )}
        {/* Lista plana */}
        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
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
