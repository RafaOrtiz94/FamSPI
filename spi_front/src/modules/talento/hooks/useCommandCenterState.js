import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../../core/auth/AuthContext";
import {
  getPersonnelRequests,
  getPersonnelRequestById,
  getPersonnelRequestProfile,
  updatePersonnelRequestProfile,
  uploadPersonnelRequestDocument,
  addPersonnelRequestComment,
  hirePersonnelRequest,
  linkPersonnelRequestCollaborator,
  linkPersonnelRequestApplicant,
} from "../../../core/api/personnelRequestsApi";
import { getApplicants, getApplicantById } from "../../../core/api/applicantsApi";
import {
  listCollaborators,
  getCollaboratorProfile,
  updateCollaboratorProfile,
  uploadCollaboratorDocument,
} from "../../../core/api/collaboratorsApi";
import {
  defaultProfile as defaultProfileTemplate,
  profileSections as profileSectionsTemplate,
  applicantProfileSections as applicantProfileSectionsTemplate,
  checklistSections as checklistSectionsTemplate,
} from "../components/collaboratorProfileDefinitions";
import {
  mapRequestToHeaderEntity,
  mapCollaboratorToHeaderEntity,
  mapApplicantToHeaderEntity,
} from "../utils/commandCenterMappers";

const WORKSPACE_VIEWS = new Set(["solicitudes", "aspirantes", "colaboradores"]);
const WORKSPACE_READY_STATUSES = new Set(["aprobada", "en_proceso", "completada"]);
const REQUEST_LIST_VISIBLE_STATUSES = new Set([
  "pendiente",
  "en_revision",
  "aprobada",
  "en_proceso",
  "completada",
  "rechazada",
  "cancelada",
]);
const COMMAND_CENTER_SEGMENT = "command-center";
const LEGACY_PERSONAL_SEGMENT = "workspace-personal";
const LEGACY_COLLABORATORS_SEGMENT = "colaboradores";

const normalizeWorkspaceView = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return WORKSPACE_VIEWS.has(normalized) ? normalized : "solicitudes";
};

const normalizeRequestStatus = (value) => String(value || "").trim().toLowerCase();

const buildDocumentListFromUpload = (response, currentDocuments = []) => {
  const nested = response?.data || null;
  const documents =
    response?.documents || nested?.documents || response?.data?.documents;

  if (Array.isArray(documents)) {
    return documents;
  }

  const document = response?.document || nested?.document || nested;
  if (document && typeof document === "object" && !Array.isArray(document) && document.id) {
    return [document, ...(currentDocuments || []).filter((item) => item.id !== document.id)];
  }

  return currentDocuments || [];
};

const isNAValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "n/a" || normalized === "na" || normalized === "no aplica";
};

const isFieldComplete = (value, field) => {
  if (field?.allowNA && isNAValue(value)) return true;
  return value !== null && value !== undefined && String(value).trim() !== "";
};

const pickValue = (source, keys = []) => {
  for (const key of keys) {
    if (!key) continue;
    const value = key.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), source);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const parseBirthDate = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/").map(Number);
    const parsed = new Date(y, m - 1, d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calculateAge = (birthDateValue) => {
  const birthDate = parseBirthDate(birthDateValue);
  if (!birthDate) return "";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? String(age) : "";
};

export default function useCommandCenterState({ initialView = "solicitudes" } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const role = (user?.role || user?.role_name || user?.rol || "").toLowerCase();
  const canUnlockSections = ["talento_humano", "gerencia", "gerencia_general"].includes(role);
  const canRequestPersonnel = ["talento_humano", "gerencia_general"].includes(role);
  const canApprovePersonnel = role === "gerencia_general";
  const canHireApplicant = ["talento_humano", "gerencia_general"].includes(role);
  const canReassignPersonnel = ["talento_humano", "gerencia_general", "admin"].includes(role);

  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docUploading, setDocUploading] = useState(null);
  const [profileErrors, setProfileErrors] = useState({});

  const [applicants, setApplicants] = useState([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState("");
  const [selectedApplicant, setSelectedApplicant] = useState(null);

  const [collaborators, setCollaborators] = useState([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState("");
  const [selectedCollaborator, setSelectedCollaborator] = useState(null);
  const [requestCollaboratorId, setRequestCollaboratorId] = useState("");

  const [workflowComment, setWorkflowComment] = useState("");
  const [workflowCommentInternal, setWorkflowCommentInternal] = useState(false);
  const [workflowCommentSaving, setWorkflowCommentSaving] = useState(false);

  const [activeTab, setActiveTab] = useState("profile");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [reviewModeOpen, setReviewModeOpen] = useState(false);
  const [reviewRequestData, setReviewRequestData] = useState(null);
  const isCollaboratorContext = Boolean(selectedCollaboratorId);

  const defaultProfile = useMemo(() => defaultProfileTemplate, []);
  const profileSections = useMemo(() => profileSectionsTemplate, []);
  const applicantProfileSections = useMemo(() => applicantProfileSectionsTemplate, []);
  const checklistSections = useMemo(() => checklistSectionsTemplate, []);
  const normalizedInitialView = useMemo(() => normalizeWorkspaceView(initialView), [initialView]);
  const [activeView, setActiveView] = useState(normalizedInitialView);

  const activeProfileSections = useMemo(
    () => (isCollaboratorContext ? profileSections : applicantProfileSections),
    [isCollaboratorContext, profileSections, applicantProfileSections],
  );

  const mergeProfile = (incoming = {}) => {
    const merged = { ...incoming };
    Object.keys(defaultProfile).forEach((section) => {
      merged[section] = {
        ...defaultProfile[section],
        ...(incoming?.[section] || {}),
      };
    });
    if (incoming?.extra) merged.extra = incoming.extra;
    return merged;
  };

  const getLockedSections = () => profileData?.onboarding?.locked_sections || [];

  const computeProfileCompletion = (sections = profileSections) => {
    if (!profileData) return { total: 0, done: 0, complete: false };
    const bySection = sections.map((section) => {
      const total = section.fields.length;
      const done = section.fields.reduce((acc, field) => {
        const value = profileData?.[section.key]?.[field.key];
        return acc + (isFieldComplete(value, field) ? 1 : 0);
      }, 0);
      return { total, done };
    });
    const total = bySection.reduce((acc, entry) => acc + entry.total, 0);
    const done = bySection.reduce((acc, entry) => acc + entry.done, 0);
    return { total, done, complete: total > 0 && done === total };
  };

  const computeChecklistCompletion = () => {
    if (!profileData) return { total: 0, done: 0, complete: false };
    const total = checklistSections.reduce((acc, section) => acc + section.items.length, 0);
    const done = checklistSections.reduce((acc, section) => {
      return acc + section.items.reduce((count, item) => {
        if (item.type === "doc") {
          return count + (documents.some((d) => d.doc_type === item.docType) ? 1 : 0);
        }
        return count + (profileData?.onboarding?.[item.flagKey] ? 1 : 0);
      }, 0);
    }, 0);
    return { total, done, complete: total > 0 && done === total };
  };

  const applyApplicantToProfile = (applicant) => {
    if (!applicant) return;
    const source = applicant.profile || applicant;
    const patch = {
      personal: {
        nombres: pickValue(source, ["personal.nombres", "nombres", "nombre", "first_name"]),
        apellidos: pickValue(source, ["personal.apellidos", "apellidos", "apellido", "last_name"]),
        cedula: pickValue(source, [
          "personal.cedula",
          "cedula",
          "cedula_ciudadania",
          "cedula_ciudadania_numero",
        ]),
        tipo_sangre: pickValue(source, ["personal.tipo_sangre", "tipo_sangre", "blood_type"]),
        genero: pickValue(source, ["personal.genero", "genero", "sexo", "gender"]),
        lugar_nacimiento: pickValue(source, [
          "personal.lugar_nacimiento",
          "lugar_nacimiento",
          "lugar_nacimiento_provincia",
          "lugar_nacimiento_ciudad",
        ]),
        fecha_nacimiento: pickValue(source, [
          "personal.fecha_nacimiento",
          "fecha_nacimiento",
          "birth_date",
        ]),
        edad: pickValue(source, ["personal.edad", "edad", "age"]),
        estado_civil: pickValue(source, ["personal.estado_civil", "estado_civil", "civil_status"]),
        telefono_personal: pickValue(source, [
          "personal.telefono_personal",
          "telefono",
          "telefono_personal",
          "celular",
          "phone",
          "mobile",
        ]),
        email_personal: pickValue(source, [
          "personal.email_personal",
          "email",
          "correo",
          "correo_electronico",
        ]),
      },
      laboral: {
        cargo:
          selectedRequest?.position_title ||
          pickValue(source, ["laboral.cargo", "cargo", "puesto", "puesto_aplica"]),
        residencia: pickValue(source, ["laboral.residencia", "lugar_residencia", "residencia"]),
      },
      domicilio: {
        ciudad_domicilio: pickValue(source, [
          "domicilio.ciudad_domicilio",
          "lugar_residencia",
          "ciudad_residencia",
          "residencia_ciudad",
        ]),
        direccion_domicilio: pickValue(source, [
          "domicilio.direccion_domicilio",
          "direccion",
          "direccion_domicilio",
        ]),
        telefono_fijo: pickValue(source, ["domicilio.telefono_fijo", "telefono_fijo"]),
      },
      familiar: {
        nombre_conyuge: pickValue(source, ["familiar.nombre_conyuge", "nombre_conyuge"]),
        cedula_conyuge: pickValue(source, ["familiar.cedula_conyuge", "cedula_conyuge"]),
        nombre_primer_hijo: pickValue(source, ["familiar.nombre_primer_hijo", "nombre_primer_hijo"]),
        cedula_primer_hijo: pickValue(source, [
          "familiar.cedula_primer_hijo",
          "cedula_primer_hijo",
        ]),
        fecha_nacimiento_primer_hijo: pickValue(source, [
          "familiar.fecha_nacimiento_primer_hijo",
          "fecha_nacimiento_primer_hijo",
        ]),
        nombre_segundo_hijo: pickValue(source, [
          "familiar.nombre_segundo_hijo",
          "nombre_segundo_hijo",
        ]),
        cedula_segundo_hijo: pickValue(source, [
          "familiar.cedula_segundo_hijo",
          "cedula_segundo_hijo",
        ]),
        fecha_nacimiento_segundo_hijo: pickValue(source, [
          "familiar.fecha_nacimiento_segundo_hijo",
          "fecha_nacimiento_segundo_hijo",
        ]),
      },
      estudios: {
        nivel_instruccion: pickValue(source, [
          "estudios.nivel_instruccion",
          "nivel_instruccion",
          "nivel_educativo",
        ]),
        titulo_tercer_nivel: pickValue(source, [
          "estudios.titulo_tercer_nivel",
          "titulo_tercer_nivel",
          "titulo_universidad",
        ]),
        universidad_tercer_nivel: pickValue(source, [
          "estudios.universidad_tercer_nivel",
          "universidad_tercer_nivel",
          "institucion_universidad",
        ]),
        titulo_cuarto_nivel: pickValue(source, [
          "estudios.titulo_cuarto_nivel",
          "titulo_cuarto_nivel",
          "titulo_cuarto_nivel_nombre",
        ]),
        universidad_cuarto_nivel: pickValue(source, [
          "estudios.universidad_cuarto_nivel",
          "universidad_cuarto_nivel",
          "institucion_cuarto_nivel",
        ]),
      },
      emergencia: {
        persona_contacto: pickValue(source, [
          "emergencia.persona_contacto",
          "referencia_1_nombre",
          "persona_contacto",
        ]),
        telefono_contacto: pickValue(source, [
          "emergencia.telefono_contacto",
          "referencia_1_celular",
          "telefono_contacto",
        ]),
      },
    };

    setProfileData((prev) => ({
      ...mergeProfile(prev || {}),
      personal: { ...(prev?.personal || {}), ...patch.personal },
      laboral: { ...(prev?.laboral || {}), ...patch.laboral },
      domicilio: { ...(prev?.domicilio || {}), ...patch.domicilio },
      familiar: { ...(prev?.familiar || {}), ...patch.familiar },
      estudios: { ...(prev?.estudios || {}), ...patch.estudios },
      emergencia: { ...(prev?.emergencia || {}), ...patch.emergencia },
    }));
  };

  const lastSavedRef = useRef(null);
  const appliedApplicantRef = useRef(null);
  const initialCargoRef = useRef(location?.state?.cargo || "");

  const pathSegments = useMemo(() => location.pathname.split("/").filter(Boolean), [location.pathname]);
  const commandCenterIndex = pathSegments.indexOf(COMMAND_CENTER_SEGMENT);
  const commandCenterViewRaw = commandCenterIndex >= 0 ? pathSegments[commandCenterIndex + 1] : undefined;
  const normalizedCommandCenterView =
    commandCenterViewRaw && WORKSPACE_VIEWS.has(commandCenterViewRaw)
      ? commandCenterViewRaw
      : undefined;
  const resolvedPathView =
    normalizedCommandCenterView ||
    (pathSegments.includes(LEGACY_COLLABORATORS_SEGMENT)
      ? "colaboradores"
      : pathSegments.includes(LEGACY_PERSONAL_SEGMENT)
      ? "solicitudes"
      : normalizedInitialView);
  const isCommandCenterRoute = commandCenterIndex >= 0;
  const shouldLoadAsRequest =
    pathSegments.includes(LEGACY_PERSONAL_SEGMENT) ||
    (isCommandCenterRoute && ["solicitudes", "aspirantes"].includes(resolvedPathView));
  const shouldLoadAsCollaborator =
    pathSegments.includes(LEGACY_COLLABORATORS_SEGMENT) ||
    (isCommandCenterRoute && resolvedPathView === "colaboradores");

  const getRouteForEntity = (view, entityId) => {
    const viewSegment =
      view === "aspirantes"
        ? "aspirantes"
        : WORKSPACE_VIEWS.has(view)
        ? view
        : "solicitudes";
    if (isCommandCenterRoute) {
      const base = `/dashboard/talento-humano/${COMMAND_CENTER_SEGMENT}/${viewSegment}`;
      return entityId ? `${base}/${entityId}` : base;
    }
    if (viewSegment === "colaboradores") {
      return entityId
        ? `/dashboard/talento-humano/${LEGACY_COLLABORATORS_SEGMENT}/${entityId}`
        : `/dashboard/talento-humano/${LEGACY_COLLABORATORS_SEGMENT}`;
    }
    const base = `/dashboard/talento-humano/${LEGACY_PERSONAL_SEGMENT}`;
    return entityId ? `${base}/${entityId}` : base;
  };

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const response = await getPersonnelRequests({ pageSize: 50 });
      const data = response.data || [];
      const allowed = data.filter((item) =>
        REQUEST_LIST_VISIBLE_STATUSES.has(normalizeRequestStatus(item.status)),
      );
      setRequests(allowed);
    } catch (error) {
      console.error("Error cargando solicitudes:", error);
      toast.error("Error al cargar solicitudes");
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadSelectedRequest = async (requestId) => {
    try {
      const response = await getPersonnelRequestById(requestId);
      const requestData = response.data || null;
      setSelectedRequest(requestData);
      setSelectedApplicant(null);
      setSelectedApplicantId("");
      setProfileData(null);
      setDocuments([]);
      setRequestCollaboratorId(
        requestData?.collaborator_user_id ? String(requestData.collaborator_user_id) : "",
      );
    } catch (error) {
      console.error("Error cargando solicitud:", error);
      toast.error("Error al cargar solicitud");
    }
  };

  const loadProfile = async (requestId) => {
    setProfileLoading(true);
    try {
      const response = await getPersonnelRequestProfile(requestId);
      const mergedProfile = mergeProfile(response.data?.profile || {});
      setProfileData(mergedProfile);
      lastSavedRef.current = JSON.stringify(mergedProfile);
      setDocuments(response.data?.documents || []);
      setProfileErrors({});
    } catch (error) {
      console.error("Error cargando perfil:", error);
      toast.error("Error al cargar el perfil del personal");
    } finally {
      setProfileLoading(false);
    }
  };

  const loadApplicants = async (requestContext) => {
    if (!requestContext?.position_title) return;
    setApplicantsLoading(true);
    try {
      const response = await getApplicants({
        cargo: requestContext.position_title,
        page: 1,
        pageSize: 50,
      });
      const list = response?.data || [];
      setApplicants(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Error cargando postulantes:", error);
    } finally {
      setApplicantsLoading(false);
    }
  };

  const loadCollaborators = async () => {
    setLoadingCollaborators(true);
    try {
      const response = await listCollaborators({ page: 1, pageSize: 50 });
      const data = response?.data || response || [];
      setCollaborators(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando colaboradores:", error);
      toast.error("Error al cargar colaboradores");
    } finally {
      setLoadingCollaborators(false);
    }
  };

  const loadCollaboratorProfile = async (collaboratorId) => {
    setProfileLoading(true);
    try {
      const response = await getCollaboratorProfile(collaboratorId);
      const mergedProfile = mergeProfile(
        response?.data?.profile || response?.profile || {},
      );
      setProfileData(mergedProfile);
      lastSavedRef.current = JSON.stringify(mergedProfile);
      setDocuments(response?.data?.documents || response?.documents || []);
      setSelectedCollaborator(response?.data?.user || response?.user || null);
      setProfileErrors({});
    } catch (error) {
      console.error("Error cargando colaborador:", error);
      toast.error("Error al cargar el perfil del colaborador");
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const normalized = normalizeWorkspaceView(resolvedPathView);
    if (normalized !== activeView) {
      setActiveView(normalized);
    }
  }, [resolvedPathView, activeView]);

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    if (activeView !== "colaboradores") return;
    if (collaborators.length === 0 && !loadingCollaborators) {
      loadCollaborators();
    }
  }, [activeView, collaborators.length, loadingCollaborators]);

  useEffect(() => {
    if (!selectedRequest || !canReassignPersonnel) return;
    if (collaborators.length === 0 && !loadingCollaborators) {
      loadCollaborators();
    }
  }, [selectedRequest?.id, canReassignPersonnel, collaborators.length, loadingCollaborators]);

  useEffect(() => {
    if (!id) return;
    if (shouldLoadAsCollaborator) {
      if (selectedCollaboratorId !== id) {
        setSelectedCollaboratorId(id);
      }
      return;
    }
    if (shouldLoadAsRequest) {
      loadSelectedRequest(id);
    }
  }, [id, shouldLoadAsRequest, shouldLoadAsCollaborator]);

  useEffect(() => {
    if (!shouldLoadAsCollaborator && selectedCollaboratorId) {
      setSelectedCollaboratorId("");
      setSelectedCollaborator(null);
    }
  }, [shouldLoadAsCollaborator, selectedCollaboratorId]);

  useEffect(() => {
    if (id || !initialCargoRef.current || requests.length === 0) return;
    const match = requests.find(
      (req) =>
        String(req.position_title || "").toLowerCase() ===
        String(initialCargoRef.current || "").toLowerCase(),
    );
    if (match) {
      navigate(getRouteForEntity("solicitudes", match.id), { replace: true });
      initialCargoRef.current = "";
    }
  }, [id, requests, navigate]);

  useEffect(() => {
    if (!selectedRequest || selectedCollaboratorId) return;
    const isApproved = WORKSPACE_READY_STATUSES.has(
      normalizeRequestStatus(selectedRequest.status),
    );
    if (!isApproved) {
      setProfileData(null);
      setDocuments([]);
      return;
    }
    loadProfile(selectedRequest.id);
    loadApplicants(selectedRequest);
  }, [selectedRequest?.id, selectedRequest?.status, selectedCollaboratorId]);

  useEffect(() => {
    if (!selectedCollaboratorId) return;
    loadCollaboratorProfile(selectedCollaboratorId);
  }, [selectedCollaboratorId]);

  useEffect(() => {
    if (activeView === "colaboradores" && selectedRequest) {
      setSelectedRequest(null);
    }
    if (activeView !== "colaboradores" && selectedCollaboratorId) {
      setSelectedCollaboratorId("");
      setSelectedCollaborator(null);
    }
  }, [activeView, selectedRequest, selectedCollaboratorId]);

  useEffect(() => {
    if (!selectedApplicant?.id) {
      appliedApplicantRef.current = null;
      return;
    }
    if (!profileData) return;
    if (appliedApplicantRef.current === selectedApplicant.id) return;
    applyApplicantToProfile(selectedApplicant);
    appliedApplicantRef.current = selectedApplicant.id;
  }, [selectedApplicant, profileData]);

  const handleProfileChange = (section, key, value) => {
    setProfileData((prev) => ({
      ...prev,
      [section]: {
        ...((prev && prev[section]) || {}),
        [key]: value,
      },
    }));
  };

  const handleChecklistToggle = (flagKey) => {
    setProfileData((prev) => ({
      ...(prev || {}),
      onboarding: {
        ...(prev?.onboarding || {}),
        [flagKey]: !prev?.onboarding?.[flagKey],
      },
    }));
  };

  const handleSaveProfile = async () => {
    if (!profileData) return;
    setProfileSaving(true);
    try {
      if (selectedCollaboratorId) {
        await updateCollaboratorProfile(selectedCollaboratorId, profileData);
      } else if (selectedRequest?.id) {
        await updatePersonnelRequestProfile(selectedRequest.id, profileData);
      } else {
        return;
      }
      lastSavedRef.current = JSON.stringify(profileData);
      toast.success("Perfil guardado correctamente");
    } catch (error) {
      console.error("Error guardando perfil:", error);
      toast.error("Error al guardar perfil");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUploadDocument = async (docType, file) => {
    if (!file || (!selectedRequest?.id && !selectedCollaboratorId)) return;
    setDocUploading(docType);
    try {
      if (selectedCollaboratorId) {
        const response = await uploadCollaboratorDocument(selectedCollaboratorId, docType, file);
        setDocuments((current) => buildDocumentListFromUpload(response, current));
      } else if (selectedRequest?.id) {
        const response = await uploadPersonnelRequestDocument(selectedRequest.id, docType, file);
        setDocuments((current) => buildDocumentListFromUpload(response, current));
      }
      toast.success("Documento subido correctamente");
    } catch (error) {
      console.error("Error subiendo documento:", error);
      toast.error("Error al subir documento");
    } finally {
      setDocUploading(null);
    }
  };

  const handleHireApplicant = async () => {
    if (!selectedRequest?.id) return;
    const profileState = computeProfileCompletion(activeProfileSections);
    const checklistState = computeChecklistCompletion();
    if (!profileState.complete || !checklistState.complete) {
      toast.error("Completa todos los campos y documentos antes de contratar.");
      return;
    }
    try {
      await hirePersonnelRequest(selectedRequest.id);
      toast.success("Postulante contratado correctamente.");
      setSelectedRequest(null);
      setSelectedApplicant(null);
      setSelectedApplicantId("");
      setProfileData(null);
      setDocuments([]);
      setRequestCollaboratorId("");
      setActiveView("solicitudes");
      await loadRequests();
    } catch (error) {
      console.error("Error contratando postulante:", error);
      toast.error(error?.response?.data?.message || "No se pudo contratar al postulante");
    }
  };

  const handleAssignCollaborator = async (event) => {
    event?.preventDefault?.();
    if (!selectedRequest?.id) return;
    const currentAssignedId = String(selectedRequest?.collaborator_user_id || "");
    const nextAssignedId = String(requestCollaboratorId || "");
    if (currentAssignedId === nextAssignedId) {
      toast.error("No hay cambios por guardar en el responsable");
      return;
    }
    try {
      await linkPersonnelRequestCollaborator(selectedRequest.id, nextAssignedId || null);
      toast.success("Responsable actualizado");
      await loadSelectedRequest(selectedRequest.id);
      await loadRequests();
    } catch (error) {
      console.error("Error reasignando colaborador:", error);
      toast.error(error?.response?.data?.message || "No se pudo reasignar el responsable");
    }
  };

  const handleAddComment = async (event) => {
    event?.preventDefault?.();
    if (!selectedRequest) return;
    const text = String(workflowComment || "").trim();
    if (!text) {
      toast.error("Escribe un comentario antes de guardar");
      return;
    }
    setWorkflowCommentSaving(true);
    try {
      await addPersonnelRequestComment(selectedRequest.id, text, workflowCommentInternal);
      setWorkflowComment("");
      setWorkflowCommentInternal(false);
      await loadSelectedRequest(selectedRequest.id);
      toast.success("Comentario agregado");
    } catch (error) {
      console.error("Error agregando comentario:", error);
      toast.error(error?.response?.data?.message || "No se pudo agregar el comentario");
    } finally {
      setWorkflowCommentSaving(false);
    }
  };

  const handleSelectRequest = (req) => {
    if (!req?.id) return;
    navigate(getRouteForEntity("solicitudes", req.id));
    setActiveView("solicitudes");
    setSelectedCollaborator(null);
    setSelectedCollaboratorId("");
    setSelectedApplicant(null);
    setSelectedApplicantId("");
    setRequestCollaboratorId(req?.collaborator_user_id ? String(req.collaborator_user_id) : "");
    setCreateDrawerOpen(false);
    setReviewModeOpen(false);
  };

  const handleSelectApplicant = async (applicant) => {
    setSelectedApplicantId(applicant?.id || "");
    if (!applicant) {
      setSelectedApplicant(null);
      if (selectedRequest?.id) {
        try {
          await linkPersonnelRequestApplicant(selectedRequest.id, null);
        } catch (unlinkErr) {
          console.error("Error desvinculando postulante en DB:", unlinkErr);
        }
      }
      return;
    }

    setProfileLoading(true);
    try {
      const response = await getApplicantById(applicant.id);
      const fullApplicant = response?.data || response || applicant;
      setSelectedApplicant(fullApplicant);
      if (selectedRequest?.id) {
        try {
          await linkPersonnelRequestApplicant(selectedRequest.id, applicant.id);
          await loadProfile(selectedRequest.id);
        } catch (linkErr) {
          console.error("Error vinculando postulante en DB:", linkErr);
        }
      }
      if (!profileData) {
        setProfileData(mergeProfile({}));
      }
      appliedApplicantRef.current = null;
      setActiveTab("perfil");
    } catch (error) {
      console.error("Error cargando detalles del postulante:", error);
      setSelectedApplicant(applicant);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSelectCollaborator = (collaborator) => {
    if (!collaborator?.id) return;
    setSelectedCollaboratorId(collaborator.id);
    setSelectedCollaborator(collaborator);
    setSelectedRequest(null);
    setSelectedApplicant(null);
    setSelectedApplicantId("");
    setRequestCollaboratorId("");
    setActiveView("colaboradores");
    setCreateDrawerOpen(false);
    setReviewModeOpen(false);
    navigate(getRouteForEntity("colaboradores", collaborator.id));
  };

  const handleCreateRequest = () => {
    setCreateDrawerOpen(true);
    setSelectedRequest(null);
    setSelectedCollaborator(null);
    setSelectedCollaboratorId("");
    setSelectedApplicant(null);
    setSelectedApplicantId("");
    setRequestCollaboratorId("");
    setActiveView("solicitudes");
    setReviewModeOpen(false);
  };

  const handleCloseCreateRequest = () => {
    setCreateDrawerOpen(false);
  };

  const handleRequestCreated = () => {
    handleCloseCreateRequest();
    loadRequests();
    setActiveView("solicitudes");
  };

  const handleReviewRequest = (req) => {
    if (!req) return;
    setReviewRequestData(req);
    setReviewModeOpen(true);
    setSelectedRequest(null);
    setSelectedCollaborator(null);
    setSelectedCollaboratorId("");
    setSelectedApplicant(null);
    setSelectedApplicantId("");
    setRequestCollaboratorId("");
    setCreateDrawerOpen(false);
    setActiveView("solicitudes");
  };

  const handleCloseReview = () => {
    setReviewModeOpen(false);
    setReviewRequestData(null);
  };

  const handleRequestReviewed = () => {
    handleCloseReview();
    loadRequests();
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredRequests = useMemo(() => {
    if (!normalizedSearch) return requests;
    return requests.filter((req) => {
      const title = String(req.position_title || "").toLowerCase();
      const number = String(req.request_number || "").toLowerCase();
      const dept = String(req.department_name || "").toLowerCase();
      return (
        title.includes(normalizedSearch) ||
        number.includes(normalizedSearch) ||
        dept.includes(normalizedSearch)
      );
    });
  }, [requests, normalizedSearch]);

  const filteredApplicants = useMemo(() => {
    if (!normalizedSearch) return applicants;
    return applicants.filter((applicant) => {
      const name = String(applicant.fullname || applicant.name || "").toLowerCase();
      const email = String(applicant.email || "").toLowerCase();
      return name.includes(normalizedSearch) || email.includes(normalizedSearch);
    });
  }, [applicants, normalizedSearch]);

  const filteredCollaborators = useMemo(() => {
    if (!normalizedSearch) return collaborators;
    return collaborators.filter((collaborator) => {
      const name = String(collaborator.fullname || "").toLowerCase();
      const email = String(collaborator.email || "").toLowerCase();
      const dept = String(
        collaborator.department_name || collaborator.department || "",
      ).toLowerCase();
      return (
        name.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        dept.includes(normalizedSearch)
      );
    });
  }, [collaborators, normalizedSearch]);

  const isRequestContext = Boolean(selectedRequest);
  const isApplicantContext = Boolean(selectedApplicant);
  const currentWorkflow = selectedRequest?.workflow || null;

  const currentEntity = useMemo(() => {
    if (isCollaboratorContext && selectedCollaborator) {
      return mapCollaboratorToHeaderEntity(selectedCollaborator);
    }
    if (isRequestContext && selectedRequest) {
      return mapRequestToHeaderEntity(selectedRequest, {
        selectedApplicantName: selectedApplicant?.fullname,
        assignedCollaborator:
          selectedRequest?.collaborator_fullname ||
          selectedRequest?.collaborator_user_email ||
          selectedRequest?.collaborator_user_id,
      });
    }
    if (isApplicantContext && selectedApplicant) {
      return mapApplicantToHeaderEntity(selectedApplicant);
    }
    return null;
  }, [
    isCollaboratorContext,
    selectedCollaborator,
    isRequestContext,
    selectedRequest,
    isApplicantContext,
    selectedApplicant,
  ]);

  const profileCompletion = useMemo(
    () => computeProfileCompletion(activeProfileSections),
    [activeProfileSections, profileData],
  );
  const checklistCompletion = useMemo(() => computeChecklistCompletion(), [
    profileData,
    documents,
  ]);
  const currentContextKind = isCollaboratorContext
    ? "Colaborador"
    : isRequestContext
    ? "Solicitud"
    : isApplicantContext
    ? "Postulante"
    : "Comando de talento";

  return {
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
    isRequestContext,
    isApplicantContext,
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
  };
}
