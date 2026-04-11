import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../../core/auth/AuthContext";
import {
  addPersonnelRequestComment,
  getPersonnelRequestApplicants,
  getPersonnelRequestWorkspace,
  getPersonnelRequests,
  hirePersonnelRequest,
  linkPersonnelRequestApplicant,
  linkPersonnelRequestCollaborator,
  updatePersonnelRequestProfile,
  uploadPersonnelRequestDocument,
} from "../../../core/api/personnelRequestsApi";
import { getApplicantById } from "../../../core/api/applicantsApi";
import {
  getCollaboratorProfile,
  listCollaborators,
  updateCollaboratorProfile,
  uploadCollaboratorDocument,
} from "../../../core/api/collaboratorsApi";
import { startOffboardingProcess } from "../../../core/api/offboardingApi";
import {
  applicantProfileSections as applicantProfileSectionsTemplate,
  checklistSections as checklistSectionsTemplate,
  defaultProfile as defaultProfileTemplate,
  profileSections as profileSectionsTemplate,
} from "../components/collaboratorProfileDefinitions";
import {
  mapApplicantToHeaderEntity,
  mapCollaboratorToHeaderEntity,
  mapRequestToHeaderEntity,
} from "../utils/commandCenterMappers";

const WORKSPACE_VIEWS = new Set(["solicitudes", "aspirantes", "colaboradores", "desvinculacion"]);
const WORKSPACE_READY_STATUSES = new Set(["aprobada", "en_proceso", "completada"]);
const REQUEST_LIST_VISIBLE_STATUSES = new Set(["pendiente", "en_revision", "aprobada", "en_proceso", "completada", "rechazada", "cancelada"]);
const PASSIVE_EMPLOYMENT_STATUSES = new Set(["pasivo", "desvinculado", "inactivo"]);
const COMMAND_CENTER_SEGMENT = "command-center";
const LEGACY_PERSONAL_SEGMENT = "workspace-personal";
const LEGACY_COLLABORATORS_SEGMENT = "colaboradores";

const normalizeWorkspaceView = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return WORKSPACE_VIEWS.has(normalized) ? normalized : "solicitudes";
};

const normalizeRequestStatus = (value) => String(value || "").trim().toLowerCase();
const normalizeEmploymentStatus = (value) => String(value || "").trim().toLowerCase();
const isPassiveCollaborator = (collaborator = {}) => {
  const statusValue =
    collaborator?.estatus_empleado ||
    collaborator?.profile?.laboral?.estatus_empleado ||
    (collaborator?.active === false ? "pasivo" : "");
  const normalizedStatus = normalizeEmploymentStatus(statusValue);
  return collaborator?.active === false || PASSIVE_EMPLOYMENT_STATUSES.has(normalizedStatus);
};
const isOffboardingInProgressCollaborator = (collaborator = {}) => {
  const requested =
    collaborator?.offboarding_requested === true ||
    collaborator?.profile?.onboarding?.offboarding_requested === true;
  return Boolean(requested) && !isPassiveCollaborator(collaborator);
};

const useDebouncedValue = (value, delay = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
};

const COMMAND_CENTER_STALE_TIME = 1000 * 60 * 5;

const mergeUploadDocuments = (response, current = []) => {
  const nested = response?.data || {};
  if (Array.isArray(response?.documents)) return response.documents;
  if (Array.isArray(nested?.documents)) return nested.documents;
  const doc = response?.document || nested?.document;
  if (doc?.id) return [doc, ...current.filter((item) => item.id !== doc.id)];
  return current;
};

const flattenProfileErrors = (error) => {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details?.validation_errors)) return {};
  return details.validation_errors.reduce((acc, item) => {
    const key = Array.isArray(item.path) ? item.path.join(".") : item.path;
    if (key) acc[key] = item.message || "Campo invalido";
    return acc;
  }, {});
};

const MAX_CARNET_IMAGE_BYTES = 500 * 1024;

const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen para compresion"));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo serializar la imagen comprimida"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });

const optimizeCarnetImage = async (file) => {
  if (!file || file.size <= MAX_CARNET_IMAGE_BYTES || !/^image\//i.test(file.type || "")) {
    return file;
  }

  try {
    const image = await loadImageFromFile(file);
    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;

    let quality = 0.9;
    let scale = 1;
    let bestBlob = null;

    for (let i = 0; i < 12; i += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(320, Math.round(originalWidth * scale));
      canvas.height = Math.max(320, Math.round(originalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) break;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
      if (blob.size <= MAX_CARNET_IMAGE_BYTES) {
        return new File([blob], `${file.name.replace(/\.[a-z0-9]+$/i, "")}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }

      if (quality > 0.55) {
        quality -= 0.1;
      } else {
        scale *= 0.85;
      }
    }

    if (bestBlob) {
      return new File([bestBlob], `${file.name.replace(/\.[a-z0-9]+$/i, "")}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }
  } catch (_error) {
    // Si falla la compresion, se sube el archivo original.
  }

  return file;
};

const prepareDocumentForUpload = async (docType, file) => {
  if (String(docType || "").toUpperCase() !== "FOTO_CARNET") return file;
  const optimizedFile = await optimizeCarnetImage(file);
  if (optimizedFile.size > MAX_CARNET_IMAGE_BYTES) {
    throw new Error("No se pudo comprimir la foto carnet por debajo de 500KB.");
  }
  return optimizedFile;
};

export default function useCommandCenterState({ initialView = "solicitudes" } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = (user?.role || user?.role_name || user?.rol || "").toLowerCase();

  const canUnlockSections = ["talento_humano", "gerencia", "gerencia_general"].includes(role);
  const canRequestPersonnel = ["talento_humano", "gerencia_general"].includes(role);
  const canApprovePersonnel = role === "gerencia_general";
  const canHireApplicant = ["talento_humano", "gerencia_general"].includes(role);
  const canReassignPersonnel = ["talento_humano", "gerencia_general", "admin"].includes(role);

  const [activeTab, setActiveTab] = useState("profile");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [reviewModeOpen, setReviewModeOpen] = useState(false);
  const [reviewRequestData, setReviewRequestData] = useState(null);
  const [selectedApplicantId, setSelectedApplicantId] = useState("");
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState("");
  const [requestCollaboratorId, setRequestCollaboratorId] = useState("");
  const [workflowComment, setWorkflowComment] = useState("");
  const [workflowCommentInternal, setWorkflowCommentInternal] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [profileErrors, setProfileErrors] = useState({});
  const [docUploading, setDocUploading] = useState(null);
  const [docUploadProgress, setDocUploadProgress] = useState({});
  const [startingOffboardingId, setStartingOffboardingId] = useState(null);

  const normalizedInitialView = useMemo(() => normalizeWorkspaceView(initialView), [initialView]);
  const [activeView, setActiveView] = useState(normalizedInitialView);
  const debouncedSearch = useDebouncedValue(searchQuery, 320);

  const defaultProfile = useMemo(() => defaultProfileTemplate, []);
  const profileSections = useMemo(() => profileSectionsTemplate, []);
  const applicantProfileSections = useMemo(() => applicantProfileSectionsTemplate, []);
  const checklistSections = useMemo(() => checklistSectionsTemplate, []);

  const pathSegments = useMemo(() => location.pathname.split("/").filter(Boolean), [location.pathname]);
  const commandCenterIndex = pathSegments.indexOf(COMMAND_CENTER_SEGMENT);
  const commandCenterViewRaw = commandCenterIndex >= 0 ? pathSegments[commandCenterIndex + 1] : undefined;
  const normalizedCommandCenterView = commandCenterViewRaw && WORKSPACE_VIEWS.has(commandCenterViewRaw) ? commandCenterViewRaw : undefined;
  const resolvedPathView = normalizedCommandCenterView || (pathSegments.includes(LEGACY_COLLABORATORS_SEGMENT) ? "colaboradores" : pathSegments.includes(LEGACY_PERSONAL_SEGMENT) ? "solicitudes" : normalizedInitialView);
  const isCommandCenterRoute = commandCenterIndex >= 0;
  const shouldLoadAsRequest = pathSegments.includes(LEGACY_PERSONAL_SEGMENT) || (isCommandCenterRoute && ["solicitudes", "aspirantes"].includes(resolvedPathView));
  const isCollaboratorPathView =
    resolvedPathView === "colaboradores" || resolvedPathView === "desvinculacion";
  const shouldLoadAsCollaborator = pathSegments.includes(LEGACY_COLLABORATORS_SEGMENT) || (isCommandCenterRoute && isCollaboratorPathView);
  const resolvedCollaboratorId = shouldLoadAsCollaborator ? String(id || "") : String(selectedCollaboratorId || "");

  const mergeProfile = useCallback((incoming = {}) => {
    const merged = { ...incoming };
    Object.keys(defaultProfile).forEach((section) => {
      merged[section] = { ...defaultProfile[section], ...(incoming?.[section] || {}) };
    });
    return merged;
  }, [defaultProfile]);

  const getRouteForEntity = (view, entityId) => {
    const segment = view === "aspirantes" ? "aspirantes" : WORKSPACE_VIEWS.has(view) ? view : "solicitudes";
    if (isCommandCenterRoute) {
      const base = `/dashboard/talento-humano/${COMMAND_CENTER_SEGMENT}/${segment}`;
      return entityId ? `${base}/${entityId}` : base;
    }
    if (segment === "desvinculacion") {
      const base = `/dashboard/talento-humano/${COMMAND_CENTER_SEGMENT}/${segment}`;
      return entityId ? `${base}/${entityId}` : base;
    }
    if (segment === "colaboradores") return entityId ? `/dashboard/talento-humano/${LEGACY_COLLABORATORS_SEGMENT}/${entityId}` : `/dashboard/talento-humano/${LEGACY_COLLABORATORS_SEGMENT}`;
    const legacyBase = `/dashboard/talento-humano/${LEGACY_PERSONAL_SEGMENT}`;
    return entityId ? `${legacyBase}/${entityId}` : legacyBase;
  };

  const requestsQuery = useQuery({
    queryKey: ["talento", "requests", debouncedSearch],
    staleTime: COMMAND_CENTER_STALE_TIME,
    queryFn: async () => {
      const response = await getPersonnelRequests({ pageSize: 80, q: debouncedSearch || undefined });
      const list = response?.data || [];
      return list.filter((item) => REQUEST_LIST_VISIBLE_STATUSES.has(normalizeRequestStatus(item?.status)));
    },
  });

  const requestWorkspaceQuery = useQuery({
    queryKey: ["talento", "request-workspace", shouldLoadAsRequest ? String(id || "") : "", debouncedSearch],
    enabled: Boolean(id && shouldLoadAsRequest),
    staleTime: COMMAND_CENTER_STALE_TIME,
    queryFn: async () => {
      const response = await getPersonnelRequestWorkspace(id, { q: debouncedSearch || undefined, page: 1, pageSize: 50 });
      return response?.data || null;
    },
  });

  const requestApplicantsQuery = useQuery({
    queryKey: ["talento", "request-applicants", shouldLoadAsRequest ? String(id || "") : "", debouncedSearch],
    enabled: Boolean(id && shouldLoadAsRequest),
    staleTime: COMMAND_CENTER_STALE_TIME,
    queryFn: async () => {
      const response = await getPersonnelRequestApplicants(id, { q: debouncedSearch || undefined, page: 1, pageSize: 50 });
      return response?.data || [];
    },
  });

  const collaboratorsQuery = useQuery({
    queryKey: ["talento", "collaborators", debouncedSearch],
    enabled:
      activeView === "colaboradores" ||
      activeView === "desvinculacion" ||
      canReassignPersonnel ||
      Boolean(resolvedCollaboratorId),
    staleTime: COMMAND_CENTER_STALE_TIME,
    queryFn: async () => {
      const response = await listCollaborators({
        page: 1,
        pageSize: 120,
        search: debouncedSearch || undefined,
      });
      return Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
    },
  });

  const collaboratorProfileQuery = useQuery({
    queryKey: ["talento", "collaborator-profile", resolvedCollaboratorId],
    enabled: Boolean(resolvedCollaboratorId),
    staleTime: COMMAND_CENTER_STALE_TIME,
    queryFn: async () => getCollaboratorProfile(resolvedCollaboratorId),
  });

  const requests = useMemo(() => requestsQuery.data || [], [requestsQuery.data]);
  const selectedRequest = requestWorkspaceQuery.data?.request || null;
  const applicants = useMemo(() => {
    if (Array.isArray(requestWorkspaceQuery.data?.applicants?.data)) return requestWorkspaceQuery.data.applicants.data;
    return requestApplicantsQuery.data || [];
  }, [requestWorkspaceQuery.data?.applicants?.data, requestApplicantsQuery.data]);
  const allCollaborators = useMemo(() => collaboratorsQuery.data || [], [collaboratorsQuery.data]);
  const collaboratorBuckets = useMemo(() => {
    return allCollaborators.reduce(
      (acc, item) => {
        const passive = isPassiveCollaborator(item);
        const inOffboarding = isOffboardingInProgressCollaborator(item);
        if (passive || inOffboarding) acc.offboarding.push(item);
        else acc.active.push(item);
        return acc;
      },
      { active: [], offboarding: [] },
    );
  }, [allCollaborators]);
  const collaborators = useMemo(() => collaboratorBuckets.active, [collaboratorBuckets.active]);
  const offboardingCollaborators = useMemo(
    () => collaboratorBuckets.offboarding,
    [collaboratorBuckets.offboarding],
  );
  const selectedCollaborator = useMemo(() => {
    const userFromProfile = collaboratorProfileQuery.data?.data?.user || collaboratorProfileQuery.data?.user;
    if (userFromProfile) return userFromProfile;
    if (!resolvedCollaboratorId) return null;
    return allCollaborators.find((item) => String(item.id) === String(resolvedCollaboratorId)) || null;
  }, [allCollaborators, collaboratorProfileQuery.data, resolvedCollaboratorId]);

  const activeProfileSections = useMemo(() => (resolvedCollaboratorId ? profileSections : applicantProfileSections), [resolvedCollaboratorId, profileSections, applicantProfileSections]);
  const lastHydratedRef = useRef("");

  useEffect(() => {
    const normalized = normalizeWorkspaceView(resolvedPathView);
    if (normalized !== activeView) setActiveView(normalized);
  }, [resolvedPathView, activeView]);

  useEffect(() => {
    if (!selectedRequest?.id) return;
    const linkedApplicantId = requestWorkspaceQuery.data?.summary?.linked_applicant_id || selectedRequest.applicant_id || "";
    setSelectedApplicantId(linkedApplicantId ? String(linkedApplicantId) : "");
    setRequestCollaboratorId(selectedRequest.collaborator_user_id ? String(selectedRequest.collaborator_user_id) : "");
  }, [selectedRequest?.id, selectedRequest?.applicant_id, selectedRequest?.collaborator_user_id, requestWorkspaceQuery.data?.summary?.linked_applicant_id]);

  useEffect(() => {
    if (!selectedApplicantId) {
      setSelectedApplicant(null);
      return;
    }
    const linkedApplicant = applicants.find((item) => String(item?.id) === String(selectedApplicantId));
    if (linkedApplicant) {
      setSelectedApplicant((prev) => (String(prev?.id || "") === String(linkedApplicant.id) ? prev : linkedApplicant));
    }
  }, [applicants, selectedApplicantId]);

  useEffect(() => {
    if (!selectedRequest?.id) return;
    if (!WORKSPACE_READY_STATUSES.has(normalizeRequestStatus(selectedRequest.status))) {
      setProfileData(null);
      setDocuments([]);
      return;
    }
    const profilePayload = requestWorkspaceQuery.data?.profile || {};
    const nextProfile = mergeProfile(profilePayload.profile || {});
    const nextDocuments = Array.isArray(profilePayload.documents) ? profilePayload.documents : [];
    const nextKey = `request:${selectedRequest.id}:${profilePayload.updated_at || ""}:${nextDocuments.length}`;
    if (lastHydratedRef.current !== nextKey) {
      setProfileData(nextProfile);
      setDocuments(nextDocuments);
      setProfileErrors({});
      lastHydratedRef.current = nextKey;
    }
  }, [selectedRequest?.id, selectedRequest?.status, requestWorkspaceQuery.data?.profile, mergeProfile]);

  useEffect(() => {
    if (!resolvedCollaboratorId) return;
    const payload = collaboratorProfileQuery.data?.data || collaboratorProfileQuery.data || {};
    const nextProfile = mergeProfile(payload.profile || {});
    const nextDocuments = Array.isArray(payload.documents) ? payload.documents : [];
    const nextKey = `collaborator:${resolvedCollaboratorId}:${payload.updated_at || ""}:${nextDocuments.length}`;
    if (lastHydratedRef.current !== nextKey) {
      setProfileData(nextProfile);
      setDocuments(nextDocuments);
      setProfileErrors({});
      lastHydratedRef.current = nextKey;
    }
  }, [resolvedCollaboratorId, collaboratorProfileQuery.data, mergeProfile]);

  const saveProfileMutation = useMutation({
    mutationFn: async (payload) => {
      if (resolvedCollaboratorId) return updateCollaboratorProfile(resolvedCollaboratorId, payload);
      if (!selectedRequest?.id) throw new Error("No existe contexto activo para guardar perfil");
      return updatePersonnelRequestProfile(selectedRequest.id, payload);
    },
    onSuccess: async () => {
      setProfileErrors({});
      await queryClient.invalidateQueries({ queryKey: ["talento", "requests"] });
      if (selectedRequest?.id) await queryClient.invalidateQueries({ queryKey: ["talento", "request-workspace", String(selectedRequest.id)] });
      if (resolvedCollaboratorId) await queryClient.invalidateQueries({ queryKey: ["talento", "collaborator-profile", resolvedCollaboratorId] });
    },
    onError: (error) => {
      setProfileErrors(flattenProfileErrors(error));
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ docType, file, onProgress }) => {
      const uploadOptions = {
        onUploadProgress: (event) => {
          if (!event?.total || typeof onProgress !== "function") return;
          const percent = Math.round((event.loaded * 100) / event.total);
          onProgress(Math.max(0, Math.min(100, percent)));
        },
      };

      if (resolvedCollaboratorId) {
        return uploadCollaboratorDocument(resolvedCollaboratorId, docType, file, uploadOptions);
      }
      if (!selectedRequest?.id) throw new Error("No existe contexto activo para subir documentos");
      return uploadPersonnelRequestDocument(selectedRequest.id, docType, file, uploadOptions);
    },
    onSuccess: async (response) => {
      setDocuments((current) => mergeUploadDocuments(response, current));
      toast.success("Documento subido correctamente");
      if (selectedRequest?.id) await queryClient.invalidateQueries({ queryKey: ["talento", "request-workspace", String(selectedRequest.id)] });
      if (resolvedCollaboratorId) await queryClient.invalidateQueries({ queryKey: ["talento", "collaborator-profile", resolvedCollaboratorId] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Error al subir documento"),
    onSettled: (_, __, variables) => {
      setDocUploading(null);
      if (variables?.docType) {
        setDocUploadProgress((current) => {
          const next = { ...current };
          delete next[variables.docType];
          return next;
        });
      }
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ requestId, comment, isInternal }) => addPersonnelRequestComment(requestId, comment, isInternal),
    onSuccess: async (_, variables) => {
      setWorkflowComment("");
      setWorkflowCommentInternal(false);
      await queryClient.invalidateQueries({ queryKey: ["talento", "request-workspace", String(variables.requestId)] });
      toast.success("Comentario agregado");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ requestId, collaboratorId }) => linkPersonnelRequestCollaborator(requestId, collaboratorId || null),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["talento", "request-workspace", String(variables.requestId)] });
      await queryClient.invalidateQueries({ queryKey: ["talento", "requests"] });
      toast.success("Responsable actualizado");
    },
  });

  const linkApplicantMutation = useMutation({
    mutationFn: async ({ requestId, applicantId }) => linkPersonnelRequestApplicant(requestId, applicantId || null),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["talento", "request-workspace", String(variables.requestId)] });
      await queryClient.invalidateQueries({ queryKey: ["talento", "request-applicants", String(variables.requestId)] });
    },
  });

  const hireMutation = useMutation({
    mutationFn: async (requestId) => hirePersonnelRequest(requestId),
    onSuccess: async () => {
      toast.success("Postulante contratado correctamente");
      navigate(getRouteForEntity("solicitudes"));
      await queryClient.invalidateQueries({ queryKey: ["talento", "requests"] });
    },
  });

  const startOffboardingMutation = useMutation({
    mutationFn: async ({ collaboratorId, reason }) =>
      startOffboardingProcess(collaboratorId, { reason: reason || "" }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["talento", "collaborators"] });
      await queryClient.invalidateQueries({
        queryKey: ["talento", "collaborator-profile", String(variables.collaboratorId)],
      });
      await queryClient.invalidateQueries({
        queryKey: ["talento", "offboarding", String(variables.collaboratorId)],
      });
    },
  });

  const handleSaveProfile = async (payloadOverride = null) => saveProfileMutation.mutateAsync(payloadOverride || profileData);
  const handleUploadDocument = async (docType, file) => {
    if (!file) return;
    let preparedFile = file;
    try {
      preparedFile = await prepareDocumentForUpload(docType, file);
    } catch (error) {
      toast.error(error?.message || "No se pudo preparar el archivo para subida.");
      return;
    }
    setDocUploading(docType);
    setDocUploadProgress((current) => ({ ...current, [docType]: 0 }));
    await uploadMutation.mutateAsync({
      docType,
      file: preparedFile,
      onProgress: (percent) => {
        setDocUploadProgress((current) => ({ ...current, [docType]: percent }));
      },
    });
  };
  const handleProfileChange = (section, key, value) => setProfileData((prev) => ({ ...(prev || {}), [section]: { ...(prev?.[section] || {}), [key]: value } }));
  const handleChecklistToggle = (flagKey) => setProfileData((prev) => ({ ...(prev || {}), onboarding: { ...(prev?.onboarding || {}), [flagKey]: !prev?.onboarding?.[flagKey] } }));
  const hasContract = useMemo(() => {
    return (documents || []).some((doc) => doc.doc_type === "CONTRATO_TRABAJO");
  }, [documents]);

  const profileCompletion = useMemo(() => {
    if (!profileData) return { total: 0, done: 0, complete: false };
    const sections = activeProfileSections.map((section) => {
      const done = section.fields.reduce((acc, field) => acc + (String(profileData?.[section.key]?.[field.key] || "").trim() !== "" ? 1 : 0), 0);
      return { total: section.fields.length, done };
    });
    const total = sections.reduce((acc, item) => acc + item.total, 0);
    const done = sections.reduce((acc, item) => acc + item.done, 0);
    return { total, done, complete: total > 0 && done === total };
  }, [activeProfileSections, profileData]);

  const checklistCompletion = useMemo(() => {
    if (!profileData) return { total: 0, done: 0, complete: false };
    const total = checklistSections.reduce((acc, section) => acc + section.items.length, 0);
    const done = checklistSections.reduce((acc, section) => acc + section.items.reduce((count, item) => count + (item.type === "doc" ? (documents.some((d) => d.doc_type === item.docType) ? 1 : 0) : (profileData?.onboarding?.[item.flagKey] ? 1 : 0)), 0), 0);
    return { total, done, complete: total > 0 && done === total };
  }, [checklistSections, documents, profileData]);

  const isRequestContext = Boolean(selectedRequest);
  const isApplicantContext = Boolean(selectedApplicant);
  const isCollaboratorContext = Boolean(resolvedCollaboratorId);
  const currentWorkflow = selectedRequest?.workflow || null;

  const canHireFinal = useMemo(() => {
    return isRequestContext && selectedApplicant && profileCompletion.complete && checklistCompletion.complete && hasContract;
  }, [isRequestContext, selectedApplicant, profileCompletion.complete, checklistCompletion.complete, hasContract]);

  const filteredRequests = useMemo(() => requests, [requests]);
  const filteredApplicants = useMemo(() => applicants, [applicants]);
  const filteredCollaborators = useMemo(() => collaborators, [collaborators]);
  const filteredOffboardingCollaborators = useMemo(
    () => offboardingCollaborators,
    [offboardingCollaborators],
  );

  const currentEntity = useMemo(() => {
    if (isCollaboratorContext && selectedCollaborator) return mapCollaboratorToHeaderEntity(selectedCollaborator);
    if (isRequestContext && selectedRequest) return mapRequestToHeaderEntity(selectedRequest, { selectedApplicantName: selectedApplicant?.fullname, assignedCollaborator: selectedRequest?.collaborator_user_email || selectedRequest?.collaborator_user_id });
    if (isApplicantContext && selectedApplicant) return mapApplicantToHeaderEntity(selectedApplicant);
    return null;
  }, [isCollaboratorContext, selectedCollaborator, isRequestContext, selectedRequest, isApplicantContext, selectedApplicant]);

  const handleSelectRequest = (request) => {
    if (!request?.id) return;
    navigate(getRouteForEntity("solicitudes", request.id));
    setActiveView("solicitudes");
    setSelectedCollaboratorId("");
  };

  const handleSelectCollaborator = (collaborator) => {
    if (!collaborator?.id) return;
    const targetView =
      isPassiveCollaborator(collaborator) || isOffboardingInProgressCollaborator(collaborator)
        ? "desvinculacion"
        : "colaboradores";
    setSelectedCollaboratorId(String(collaborator.id));
    setActiveView(targetView);
    if (targetView === "desvinculacion") {
      setActiveTab("offboarding");
    }
    navigate(getRouteForEntity(targetView, collaborator.id));
  };

  const handleSelectApplicant = async (applicant) => {
    if (!selectedRequest?.id) return;
    if (!applicant?.id) {
      setSelectedApplicantId("");
      setSelectedApplicant(null);
      await linkApplicantMutation.mutateAsync({ requestId: selectedRequest.id, applicantId: null });
      return;
    }
    const response = await getApplicantById(applicant.id);
    setSelectedApplicant(response?.data || response || applicant);
    setSelectedApplicantId(String(applicant.id));
    setActiveTab("applicant");
    await linkApplicantMutation.mutateAsync({ requestId: selectedRequest.id, applicantId: applicant.id });
  };

  const handleAssignCollaborator = async (event) => {
    event?.preventDefault?.();
    if (!selectedRequest?.id) return;
    await assignMutation.mutateAsync({ requestId: selectedRequest.id, collaboratorId: requestCollaboratorId || null });
  };

  const handleAddComment = async (event) => {
    event?.preventDefault?.();
    if (!selectedRequest?.id || !String(workflowComment || "").trim()) return;
    await commentMutation.mutateAsync({ requestId: selectedRequest.id, comment: workflowComment.trim(), isInternal: workflowCommentInternal });
  };

  const handleHireApplicant = async () => {
    if (!selectedRequest?.id) return;
    if (!canHireFinal) {
      toast.error("Faltan requisitos para contratar (Perfil 100%, Checklist y Contrato).");
      return;
    }
    await hireMutation.mutateAsync(selectedRequest.id);
  };

  const handleStartOffboarding = async (collaborator, reason = "") => {
    if (!collaborator?.id) return;
    const collaboratorId = String(collaborator.id);
    try {
      setStartingOffboardingId(collaboratorId);
      const response = await startOffboardingMutation.mutateAsync({
        collaboratorId,
        reason,
      });
      const alreadyStarted = Boolean(response?.already_started);
      toast.success(
        alreadyStarted
          ? "El proceso de desvinculación ya estaba iniciado."
          : "Proceso de desvinculación iniciado."
      );
      setSelectedCollaboratorId(collaboratorId);
      setActiveView("desvinculacion");
      setActiveTab("offboarding");
      navigate(getRouteForEntity("desvinculacion", collaborator.id));
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "No se pudo iniciar el proceso de desvinculación."
      );
    } finally {
      setStartingOffboardingId(null);
    }
  };

  const handleCreateRequest = () => setCreateDrawerOpen(true);
  const handleCloseCreateRequest = () => setCreateDrawerOpen(false);
  const handleRequestCreated = async () => {
    setCreateDrawerOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["talento", "requests"] });
  };
  const handleReviewRequest = (request) => {
    setReviewRequestData(request || null);
    setReviewModeOpen(Boolean(request));
  };
  const handleCloseReview = () => {
    setReviewModeOpen(false);
    setReviewRequestData(null);
  };
  const handleRequestReviewed = async () => {
    handleCloseReview();
    await queryClient.invalidateQueries({ queryKey: ["talento", "requests"] });
  };

  const handleSetView = (newView) => {
    const normalized = normalizeWorkspaceView(newView);
    setActiveView(normalized);
    navigate(getRouteForEntity(normalized));
  };

  const requestsInitialLoading = requestsQuery.isLoading;
  const requestsSyncing = requestsQuery.isFetching;
  const applicantsInitialLoading = requestApplicantsQuery.isLoading;
  const applicantsSyncing = requestApplicantsQuery.isFetching;
  const collaboratorsInitialLoading = collaboratorsQuery.isLoading;
  const collaboratorsSyncing = collaboratorsQuery.isFetching;
  const requestWorkspaceLoading = requestWorkspaceQuery.isLoading;
  const requestWorkspaceSyncing = requestWorkspaceQuery.isFetching;
  const collaboratorProfileLoading = collaboratorProfileQuery.isLoading;
  const collaboratorProfileSyncing = collaboratorProfileQuery.isFetching;
  const hasEntityRouteTarget = Boolean(id && (shouldLoadAsRequest || shouldLoadAsCollaborator));
  const entityRouteLoading =
    hasEntityRouteTarget &&
    ((shouldLoadAsRequest && requestWorkspaceLoading) ||
      (shouldLoadAsCollaborator && collaboratorProfileLoading));
  const entityRouteSyncing =
    hasEntityRouteTarget &&
    ((shouldLoadAsRequest && requestWorkspaceSyncing) ||
      (shouldLoadAsCollaborator && collaboratorProfileSyncing));

  return {
    requests,
    loadingRequests: requestsInitialLoading || requestsSyncing,
    requestsInitialLoading,
    requestsSyncing,
    applicants,
    applicantsLoading: applicantsInitialLoading || applicantsSyncing,
    applicantsInitialLoading,
    applicantsSyncing,
    collaborators,
    offboardingCollaborators,
    loadingCollaborators: collaboratorsInitialLoading || collaboratorsSyncing,
    collaboratorsInitialLoading,
    collaboratorsSyncing,
    selectedRequest,
    selectedApplicant,
    selectedApplicantId,
    selectedCollaborator,
    selectedCollaboratorId: resolvedCollaboratorId,
    profileData,
    profileLoading: requestWorkspaceQuery.isFetching || collaboratorProfileQuery.isFetching || saveProfileMutation.isPending,
    profileSaving: saveProfileMutation.isPending,
    profileErrors,
    documents,
    docUploading,
    docUploadProgress,
    activeView,
    setActiveView: handleSetView,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    workflowComment,
    setWorkflowComment,
    workflowCommentInternal,
    setWorkflowCommentInternal,
    workflowCommentSaving: commentMutation.isPending,
    requestCollaboratorId,
    setRequestCollaboratorId,
    createDrawerOpen,
    setCreateDrawerOpen,
    reviewRequestData,
    setReviewRequestData,
    reviewModeOpen,
    setReviewModeOpen,
    canRequestPersonnel,
    canApprovePersonnel,
    canHireApplicant,
    canReassignPersonnel,
    canUnlockSections,
    currentUserRole: role,
    isRequestContext,
    isApplicantContext,
    isCollaboratorContext,
    currentEntity,
    filteredRequests,
    filteredApplicants,
    filteredCollaborators,
    filteredOffboardingCollaborators,
    profileCompletion,
    checklistCompletion,
    hasContract,
    canHireFinal,
    currentWorkflow,
    requestWorkspaceLoading,
    requestWorkspaceSyncing,
    collaboratorProfileLoading,
    collaboratorProfileSyncing,
    hasEntityRouteTarget,
    entityRouteLoading,
    entityRouteSyncing,
    currentContextKind: isCollaboratorContext ? "Colaborador" : isRequestContext ? "Solicitud" : isApplicantContext ? "Postulante" : "Comando de talento",
    handleSelectRequest,
    handleSelectApplicant,
    handleSelectCollaborator,
    handleStartOffboarding,
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
    startingOffboardingId,
  };
}
