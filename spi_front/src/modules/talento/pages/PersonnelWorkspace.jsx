import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FiAlertCircle, FiChevronDown, FiUsers } from "react-icons/fi";
import toast from "react-hot-toast";

import { DashboardLayout } from "../../../core/ui/layouts/DashboardLayout";
import Button from "../../../core/ui/components/Button";
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
import { getApplicants } from "../../../core/api/applicantsApi";
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

// New Components
import PersonnelSidebar from "../components/workspace/PersonnelSidebar";
import PersonnelHeader from "../components/workspace/PersonnelHeader";
import PersonnelProfile from "../components/workspace/PersonnelProfile";
import PersonnelChecklist from "../components/workspace/PersonnelChecklist";
import PersonnelDocuments from "../components/workspace/PersonnelDocuments";
import ApplicantIntakeSummary from "../components/workspace/ApplicantIntakeSummary";
import PersonnelRequestProgress from "../components/workspace/PersonnelRequestProgress";
import PersonnelRequestComments from "../components/workspace/PersonnelRequestComments";
import ApplicantList from "../components/workspace/ApplicantList";

import PersonnelRequestReview from "../components/workspace/PersonnelRequestReview";
import PersonnelRequestForm from "../../../core/ui/widgets/PersonnelRequestForm";

const WORKSPACE_VIEWS = new Set(["solicitudes", "aspirantes", "colaboradores"]);

const normalizeWorkspaceView = (value) => {
 const normalized = String(value || "").trim().toLowerCase();
 return WORKSPACE_VIEWS.has(normalized) ? normalized : "solicitudes";
};

const REQUEST_STATUS_LABELS = {
 pendiente: "Pendiente",
 en_revision: "En revisión",
 aprobada: "Aprobada",
 en_proceso: "En proceso",
 completada: "Completada",
 rechazada: "Rechazada",
 cancelada: "Cancelada",
};

const WORKSPACE_READY_STATUSES = new Set(["aprobada", "en_proceso", "completada"]);
const REQUEST_LIST_VISIBLE_STATUSES = new Set(["aprobada", "en_proceso", "completada"]);

const normalizeRequestStatus = (value) => String(value || "").trim().toLowerCase();

const buildDocumentListFromUpload = (response, currentDocuments = []) => {
 const nested = response?.data || null;
 const documents =
 response?.documents ||
 nested?.documents ||
 response?.data?.documents;

 if (Array.isArray(documents)) {
 return documents;
 }

 const document = response?.document || nested?.document || nested;
 if (document && typeof document === "object" && !Array.isArray(document) && document.id) {
 return [document, ...(currentDocuments || []).filter((item) => item.id !== document.id)];
 }

 return currentDocuments || [];
};

const PersonnelWorkspace = ({ initialView = "solicitudes" }) => {
 const navigate = useNavigate();
 const location = useLocation();
 const { user } = useAuth();
 const role = (user?.role || user?.role_name || user?.rol || "").toLowerCase();
 const canUnlockSections = role === "talento_humano";
 const canRequestPersonnel = ["talento_humano", "gerencia_general"].includes(role);
 const canApprovePersonnel = role === "gerencia_general";
 const canHireApplicant = ["talento_humano", "gerencia_general"].includes(role);
 const canReassignPersonnel = ["talento_humano", "gerencia_general", "admin"].includes(role);
 const { id } = useParams();

 // Data States
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
 const appliedApplicantRef = useRef(null);

 const [collaborators, setCollaborators] = useState([]);
 const [loadingCollaborators, setLoadingCollaborators] = useState(false);
 const [selectedCollaboratorId, setSelectedCollaboratorId] = useState("");
 const [selectedCollaborator, setSelectedCollaborator] = useState(null);
 const [requestCollaboratorId, setRequestCollaboratorId] = useState("");
 const [workflowComment, setWorkflowComment] = useState("");
 const [workflowCommentInternal, setWorkflowCommentInternal] = useState(false);
 const [workflowCommentSaving, setWorkflowCommentSaving] = useState(false);

 // UI States
 const [activeView, setActiveView] = useState(() => normalizeWorkspaceView(initialView)); // Sidebar View
 const [activeTab, setActiveTab] = useState("perfil"); // Main Content Tab
 const [activeMainView, setActiveMainView] = useState("workspace"); // "workspace" | "create_request" | "review_request"
 const [reviewRequestData, setReviewRequestData] = useState(null);
 const [mobileSelectorOpen, setMobileSelectorOpen] = useState(() => normalizeWorkspaceView(initialView) !== "aspirantes");

 const lastSavedRef = useRef(null);
 const initialCargoRef = useRef(location?.state?.cargo || "");

 // Derived definitions
 const defaultProfile = useMemo(() => defaultProfileTemplate, []);
 const checklistSections = useMemo(() => checklistSectionsTemplate, []);
 const applicantProfileSections = useMemo(() => applicantProfileSectionsTemplate, []);
 const normalizedInitialView = useMemo(() => normalizeWorkspaceView(initialView), [initialView]);

 // --- Logic Helpers ---

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

 const isNAValue = (value) => {
 const normalized = String(value || '').trim().toLowerCase();
 return normalized === 'n/a' || normalized === 'na' || normalized === 'no aplica';
 };

 const isFieldComplete = (value, field) => {
 if (field?.allowNA && isNAValue(value)) return true;
 return value !== null && value !== undefined && String(value).trim() !== '';
 };

 const computeProfileCompletion = (sections = profileSectionsTemplate) => {
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

 const pickValue = (source, keys = []) => {
 for (const key of keys) {
 if (!key) continue;
 const value = key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), source);
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

 const applyApplicantToProfile = (applicant) => {
 if (!applicant) return;
 const source = applicant.profile || applicant;
 const patch = {
 personal: {
 nombres: pickValue(source, ["personal.nombres", "nombres", "nombre", "first_name"]),
 apellidos: pickValue(source, ["personal.apellidos", "apellidos", "apellido", "last_name"]),
 cedula: pickValue(source, ["personal.cedula", "cedula", "cedula_ciudadania", "cedula_ciudadania_numero"]),
 tipo_sangre: pickValue(source, ["personal.tipo_sangre", "tipo_sangre", "blood_type"]),
 genero: pickValue(source, ["personal.genero", "genero", "sexo", "gender"]),
 lugar_nacimiento: pickValue(source, ["personal.lugar_nacimiento", "lugar_nacimiento", "lugar_nacimiento_provincia", "lugar_nacimiento_ciudad"]),
 fecha_nacimiento: pickValue(source, ["personal.fecha_nacimiento", "fecha_nacimiento", "birth_date"]),
 edad: pickValue(source, ["personal.edad", "edad", "age"]),
 estado_civil: pickValue(source, ["personal.estado_civil", "estado_civil", "civil_status"]),
 telefono_personal: pickValue(source, ["personal.telefono_personal", "telefono", "telefono_personal", "celular", "phone", "mobile"]),
 email_personal: pickValue(source, ["personal.email_personal", "email", "correo", "correo_electronico"]),
 },
 laboral: {
 cargo: selectedRequest?.position_title || pickValue(source, ["laboral.cargo", "cargo", "puesto", "puesto_aplica"]),
 residencia: pickValue(source, ["laboral.residencia", "lugar_residencia", "residencia"]),
 },
 domicilio: {
 ciudad_domicilio: pickValue(source, ["domicilio.ciudad_domicilio", "lugar_residencia", "ciudad_residencia", "residencia_ciudad"]),
 direccion_domicilio: pickValue(source, ["domicilio.direccion_domicilio", "direccion", "direccion_domicilio"]),
 telefono_fijo: pickValue(source, ["domicilio.telefono_fijo", "telefono_fijo"]),
 },
 familiar: {
 nombre_conyuge: pickValue(source, ["familiar.nombre_conyuge", "nombre_conyuge"]),
 cedula_conyuge: pickValue(source, ["familiar.cedula_conyuge", "cedula_conyuge"]),
 nombre_primer_hijo: pickValue(source, ["familiar.nombre_primer_hijo", "nombre_primer_hijo"]),
 cedula_primer_hijo: pickValue(source, ["familiar.cedula_primer_hijo", "cedula_primer_hijo"]),
 fecha_nacimiento_primer_hijo: pickValue(source, ["familiar.fecha_nacimiento_primer_hijo", "fecha_nacimiento_primer_hijo"]),
 nombre_segundo_hijo: pickValue(source, ["familiar.nombre_segundo_hijo", "nombre_segundo_hijo"]),
 cedula_segundo_hijo: pickValue(source, ["familiar.cedula_segundo_hijo", "cedula_segundo_hijo"]),
 fecha_nacimiento_segundo_hijo: pickValue(source, ["familiar.fecha_nacimiento_segundo_hijo", "fecha_nacimiento_segundo_hijo"]),
 },
 estudios: {
 nivel_instruccion: pickValue(source, ["estudios.nivel_instruccion", "nivel_instruccion", "nivel_educativo"]),
 titulo_tercer_nivel: pickValue(source, ["estudios.titulo_tercer_nivel", "titulo_tercer_nivel", "titulo_universidad"]),
 universidad_tercer_nivel: pickValue(source, ["estudios.universidad_tercer_nivel", "universidad_tercer_nivel", "institucion_universidad"]),
 titulo_cuarto_nivel: pickValue(source, ["estudios.titulo_cuarto_nivel", "titulo_cuarto_nivel", "titulo_cuarto_nivel_nombre"]),
 universidad_cuarto_nivel: pickValue(source, ["estudios.universidad_cuarto_nivel", "universidad_cuarto_nivel", "institucion_cuarto_nivel"]),
 },
 emergencia: {
 persona_contacto: pickValue(source, ["emergencia.persona_contacto", "referencia_1_nombre", "persona_contacto"]),
 telefono_contacto: pickValue(source, ["emergencia.telefono_contacto", "referencia_1_celular", "telefono_contacto"]),
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

 // --- API Calls ---

 const loadRequests = async () => {
 setLoadingRequests(true);
 try {
 const response = await getPersonnelRequests({ pageSize: 50 });
 const data = response.data || [];
 const allowed = data.filter((item) =>
 REQUEST_LIST_VISIBLE_STATUSES.has(normalizeRequestStatus(item.status))
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
 setRequestCollaboratorId(requestData?.collaborator_user_id ? String(requestData.collaborator_user_id) : "");
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
 const mergedProfile = mergeProfile(response?.data?.profile || response?.profile || {});
 setProfileData(mergedProfile);
 lastSavedRef.current = JSON.stringify(mergedProfile);
 setDocuments(response?.data?.documents || response?.documents || []);
 setSelectedCollaborator(response?.data?.user || response?.user || selectedCollaborator);
 } catch (error) {
 console.error("Error cargando colaborador:", error);
 toast.error("Error al cargar el perfil del colaborador");
 } finally {
 setProfileLoading(false);
 }
 };

 // --- Effects ---

 useEffect(() => {
 loadRequests();
 }, []);

 useEffect(() => {
 setActiveView(normalizedInitialView);
 }, [normalizedInitialView]);

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
 if (activeView === "colaboradores" && selectedRequest) {
 setSelectedRequest(null);
 }
 if (activeView !== "colaboradores" && selectedCollaboratorId) {
 setSelectedCollaboratorId("");
 setSelectedCollaborator(null);
 }
 }, [activeView, selectedRequest, selectedCollaboratorId]);

 useEffect(() => {
 if (id || !initialCargoRef.current || requests.length === 0) return;
 const match = requests.find(
 (req) =>
 String(req.position_title || "").toLowerCase() ===
 String(initialCargoRef.current || "").toLowerCase()
 );
 if (match) {
 navigate(`/dashboard/talento-humano/workspace-personal/${match.id}`, {
 replace: true,
 });
 initialCargoRef.current = "";
 }
 }, [id, requests, navigate]);

 useEffect(() => {
 if (activeView === "colaboradores") return;
 if (!id) {
 setSelectedRequest(null);
 return;
 }
 loadSelectedRequest(id);
 }, [id, activeView]);

 useEffect(() => {
 if (!selectedRequest || selectedCollaboratorId) return;
 const isApproved = ["aprobada", "en_proceso", "completada"].includes(selectedRequest.status);
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
 if (activeMainView !== "workspace") {
 setMobileSelectorOpen(false);
 return;
 }

 if (!selectedRequest && !selectedCollaboratorId) {
 setMobileSelectorOpen(true);
 }
 }, [activeMainView, selectedRequest, selectedCollaboratorId]);

 useEffect(() => {
 if (!profileData?.personal) return;
 const nextAge = calculateAge(profileData.personal.fecha_nacimiento);
 if (nextAge === (profileData.personal.edad ?? "")) return;
 setProfileData((prev) => ({
 ...prev,
 personal: {
 ...prev.personal,
 edad: nextAge,
 },
 }));
 }, [profileData?.personal?.fecha_nacimiento]);

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

 // --- Handlers ---

 const handleProfileChange = (section, key, value) => {
 setProfileData((prev) => ({
 ...prev,
 [section]: {
 ...prev[section],
 [key]: value,
 },
 }));
 };

 const handleChecklistToggle = (flagKey) => {
 if (!profileData) return;
 const currentVal = profileData.onboarding?.[flagKey] || false;
 setProfileData((prev) => ({
 ...prev,
 onboarding: {
 ...prev.onboarding,
 [flagKey]: !currentVal,
 },
 }));
 };

 const handleSaveProfile = async () => {
 if (!profileData) return;
 setProfileSaving(true);
 try {
 if (selectedCollaboratorId) {
 await updateCollaboratorProfile(selectedCollaboratorId, profileData);
 } else if (selectedRequest) {
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
 if (!selectedRequest && !selectedCollaboratorId) return;
 setDocUploading(docType);
 try {
 if (selectedCollaboratorId) {
 const response = await uploadCollaboratorDocument(selectedCollaboratorId, docType, file);
 setDocuments((current) => buildDocumentListFromUpload(response, current));
 } else {
 const response = await uploadPersonnelRequestDocument(
 selectedRequest.id,
 docType,
 file
 );
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
 if (!selectedRequest) return;
 const profileCompletion = computeProfileCompletion();
 const checklistCompletion = computeChecklistCompletion();
 if (!profileCompletion.complete || !checklistCompletion.complete) {
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
 setActiveView("solicitudes");
 await loadRequests();
 } catch (error) {
 console.error("Error contratando postulante:", error);
 toast.error(error?.response?.data?.message || "No se pudo contratar al postulante");
 }
 };

 const handleAssignCollaborator = async (event) => {
 event.preventDefault();
 if (!selectedRequest) return;
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
 event.preventDefault();
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
 navigate(`/dashboard/talento-humano/workspace-personal/${req.id}`);
 setActiveView("solicitudes"); // Ensure we stay on requests view
 setActiveMainView("workspace");
 setMobileSelectorOpen(false);
 setSelectedCollaborator(null);
 setSelectedCollaboratorId("");
 setSelectedApplicant(null);
 setSelectedApplicantId("");
 setRequestCollaboratorId(req?.collaborator_user_id ? String(req.collaborator_user_id) : "");
 };

 const handleSelectApplicant = async (applicant) => {
 setSelectedApplicantId(applicant?.id || "");
 if (applicant) {
 setMobileSelectorOpen(false);
 setProfileLoading(true);
 try {
 const { getApplicantById } = await import("../../../core/api/applicantsApi");
 const fullApplicantResp = await getApplicantById(applicant.id);
 const fullApplicant = fullApplicantResp?.data || fullApplicantResp || applicant;
 setSelectedApplicant(fullApplicant || applicant);

 // Link applicant to request in DB
 if (selectedRequest?.id) {
 try {
 await linkPersonnelRequestApplicant(selectedRequest.id, applicant.id);
 await loadProfile(selectedRequest.id);
 } catch (linkErr) {
 console.error("Error vinculando postulante en DB:", linkErr);
 // Non-critical error, continue
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
 } else {
 setSelectedApplicant(null);

 // Unlink applicant from request in DB if needed
 if (selectedRequest?.id) {
 try {
 await linkPersonnelRequestApplicant(selectedRequest.id, null);
 } catch (unlinkErr) {
 console.error("Error desvinculando postulante en DB:", unlinkErr);
 }
 }
 }
 };

 const handleSelectCollaborator = (collaborator) => {
 setSelectedCollaboratorId(collaborator?.id || "");
 setSelectedCollaborator(collaborator || null);
 setSelectedRequest(null);
 setSelectedApplicant(null);
 setSelectedApplicantId("");
 setRequestCollaboratorId("");
 setActiveView("colaboradores");
 setActiveMainView("workspace");
 setMobileSelectorOpen(false);
 };

 const handleCreateRequest = () => {
 setActiveMainView("create_request");
 setMobileSelectorOpen(false);
 setSelectedRequest(null); // Deselect current workspace request
 setSelectedCollaborator(null);
 setSelectedCollaboratorId("");
 setRequestCollaboratorId("");
 };

 const handleReviewRequest = (req) => {
 setReviewRequestData(req);
 setActiveMainView("review_request");
 setMobileSelectorOpen(false);
 setSelectedRequest(null);
 setSelectedCollaborator(null);
 setSelectedCollaboratorId("");
 setRequestCollaboratorId("");
 };

 const handleBackToWorkspace = () => {
 setActiveMainView("workspace");
 setReviewRequestData(null);
 if (id && !selectedCollaboratorId) {
 loadSelectedRequest(id);
 }
 };

 const handleRequestCreated = () => {
 handleBackToWorkspace();
 loadRequests(); // Reload list
 };

 const handleRequestReviewed = () => {
 // Trigger a refresh of the sidebar widget if possible, or just back to workspace
 handleBackToWorkspace();
 // We might need to refresh the "requests" list if the approved one should appear there
 loadRequests();
 };

 // --- Render ---
  const isRequestContext = Boolean(selectedRequest);
  const isCollaboratorContext = Boolean(selectedCollaboratorId);
  const activeProfileSections = isCollaboratorContext ? profileSectionsTemplate : applicantProfileSections;
  
  // Validation for Hiring
  const profileCompletion = computeProfileCompletion(activeProfileSections);
  const checklistCompletion = computeChecklistCompletion();
  const requestWorkflow = selectedRequest?.workflow || null;

  // New Hiring Requirements Check
  const hasContract = (documents || []).some(doc => doc.doc_type === 'CONTRATO_TRABAJO');
  const hasApplicant = Boolean(selectedRequest?.applicant_id);
  
  const canHire = isRequestContext && 
                  canHireApplicant && 
                  profileCompletion.complete && 
                  checklistCompletion.complete &&
                  hasContract &&
                  hasApplicant;

  const activeViewLabel =
 activeView === "colaboradores"
 ? "Colaboradores"
 : activeView === "aspirantes"
 ? "Postulantes"
 : "Solicitudes";

 return (
 <DashboardLayout>
 <div className="flex h-[calc(100vh-theme(spacing.16))] overflow-hidden bg-gray-50">
 {/* Sidebar */}
 <aside className="w-80 shrink-0 border-r border-gray-200 bg-white md:flex hidden">
 <PersonnelSidebar
 activeView={activeView}
 setActiveView={setActiveView}
 requests={requests}
 loadingRequests={loadingRequests}
 selectedRequestId={selectedRequest?.id}
 onSelectRequest={handleSelectRequest}
 applicants={applicants}
 loadingApplicants={applicantsLoading}
 selectedApplicantId={selectedApplicantId}
 onSelectApplicant={handleSelectApplicant}
 collaborators={collaborators}
 loadingCollaborators={loadingCollaborators}
 selectedCollaboratorId={selectedCollaboratorId}
 onSelectCollaborator={handleSelectCollaborator}
 canRequestPersonnel={canRequestPersonnel}
 canApprovePersonnel={canApprovePersonnel}
 selectedRequestTitle={selectedRequest?.position_title}
 onCreateRequest={handleCreateRequest}
 />
 </aside>

 {/* Main Content */}
 <main className="flex flex-1 flex-col min-w-0">
 {activeMainView === "create_request" ? (
 <div className="h-full overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
 <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px]">
 <PersonnelRequestForm 
 isModal={false} 
 onClose={handleBackToWorkspace}
 onSuccess={handleRequestCreated}
 />
 </div>
 </div>
 ) : activeMainView === "review_request" ? (
 <div className="h-full overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
 <PersonnelRequestReview 
 request={reviewRequestData}
 onCancel={handleBackToWorkspace}
 onUpdate={handleRequestReviewed}
 canApprove={canApprovePersonnel}
 />
 </div>
 ) : (
 <>
 <div className="border-b border-gray-200 bg-white px-4 py-4 shadow-sm md:hidden">
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Selector</p>
 <p className="text-sm font-semibold text-gray-900">{activeViewLabel}</p>
 </div>
 <Button
 variant="secondary"
 size="sm"
 className="inline-flex items-center gap-2"
 onClick={() => setMobileSelectorOpen((prev) => !prev)}
 >
 <FiChevronDown className={`transition-transform ${mobileSelectorOpen ? "rotate-180" : ""}`} />
 {mobileSelectorOpen ? "Ocultar" : "Abrir"}
 </Button>
 </div>

 <div className="mt-3 grid grid-cols-3 gap-2">
 {[
 { key: "solicitudes", label: "Solicitudes" },
 { key: "aspirantes", label: "Postulantes" },
 { key: "colaboradores", label: "Colaboradores" },
 ].map((view) => (
 <button
 key={view.key}
 type="button"
 onClick={() => {
 setActiveView(view.key);
 setMobileSelectorOpen(true);
 }}
 className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
 activeView === view.key
 ? "bg-blue-600 text-white"
 : "bg-gray-100 text-gray-600 hover:bg-gray-200"
 }`}
 >
 {view.label}
 </button>
 ))}
 </div>

 {mobileSelectorOpen && activeMainView === "workspace" && (
 <div className="mt-4 max-h-[60vh] overflow-hidden rounded-2xl border border-gray-200">
 <PersonnelSidebar
 className="h-full rounded-none border-0 shadow-none"
 activeView={activeView}
 setActiveView={setActiveView}
 requests={requests}
 loadingRequests={loadingRequests}
 selectedRequestId={selectedRequest?.id}
 onSelectRequest={handleSelectRequest}
 applicants={applicants}
 loadingApplicants={applicantsLoading}
 selectedApplicantId={selectedApplicantId}
 onSelectApplicant={handleSelectApplicant}
 collaborators={collaborators}
 loadingCollaborators={loadingCollaborators}
 selectedCollaboratorId={selectedCollaboratorId}
 onSelectCollaborator={handleSelectCollaborator}
 canRequestPersonnel={canRequestPersonnel}
 canApprovePersonnel={canApprovePersonnel}
 selectedRequestTitle={selectedRequest?.position_title}
 onCreateRequest={handleCreateRequest}
 />
 </div>
 )}
 </div>

 <PersonnelHeader
 selectedRequest={selectedRequest}
 selectedCollaborator={selectedCollaborator}
 selectedApplicant={selectedApplicant}
 workflow={requestWorkflow}
 onSave={handleSaveProfile}
 saving={profileSaving}
 loading={profileLoading}
 />

 <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
 {!isRequestContext && !isCollaboratorContext ? (
 <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
 <FiUsers size={48} className="mb-4 opacity-20" />
 <h3 className="text-lg font-medium text-gray-900">
 Selecciona una solicitud o colaborador
 </h3>
 <p className="mt-1 text-sm">
 Usa el selector visible para elegir una solicitud o colaborador y gestionar su información.
 </p>
 </div>
 ) : isRequestContext && !WORKSPACE_READY_STATUSES.has(normalizeRequestStatus(selectedRequest.status)) ? (
 <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 text-yellow-900 shadow-sm">
 <p className="text-sm font-semibold">
 Estado actual: {REQUEST_STATUS_LABELS[normalizeRequestStatus(selectedRequest.status)] || "Solicitud en seguimiento"}
 </p>
 <p className="mt-2 text-sm">
 Esta solicitud aún no habilita el expediente operativo. Revísala desde el flujo de aprobación o espera a que avance a una etapa habilitada.
 </p>
 {requestWorkflow && (
 <div className="mt-4 grid gap-3 text-xs text-yellow-900 sm:grid-cols-2">
 <div className="rounded-xl bg-white/70 px-3 py-3">
 <span className="block font-semibold">Etapa actual</span>
 <span>{requestWorkflow.current_stage_label}</span>
 </div>
 <div className="rounded-xl bg-white/70 px-3 py-3">
 <span className="block font-semibold">Siguiente acción</span>
 <span>{requestWorkflow.next_action || "Pendiente de validación"}</span>
 </div>
 </div>
 )}
 </div>
 ) : profileLoading ? (
 <div className="flex h-64 items-center justify-center">
 <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
 </div>
 ) : (
 <div className="mx-auto max-w-5xl space-y-6">
 {selectedApplicant && isRequestContext && (
 <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
 Datos precargados desde el postulante: <strong>{selectedApplicant.fullname}</strong>. Puedes ajustar la información antes de guardar.
 </div>
 )}
 {isRequestContext && requestWorkflow && (
 <PersonnelRequestProgress workflow={requestWorkflow} request={selectedRequest} />
 )}
 {isRequestContext && canReassignPersonnel && (
 <form
 onSubmit={handleAssignCollaborator}
 className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
 >
 <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
 <div className="flex-1 space-y-1">
 <p className="text-sm font-semibold text-slate-900">Responsable operativo</p>
 <p className="text-xs text-slate-500">
 Vincula o reasigna el colaborador que debe operar esta solicitud.
 </p>
 </div>
 <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
 <select
 value={requestCollaboratorId}
 onChange={(e) => setRequestCollaboratorId(e.target.value)}
 className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
 >
 <option value="">Sin responsable asignado</option>
 {collaborators.map((collaborator) => (
 <option key={collaborator.id} value={collaborator.id}>
 {collaborator.fullname || collaborator.email}
 {collaborator.department_name ? ` - ${collaborator.department_name}` : ""}
 </option>
 ))}
 </select>
 <Button
 type="submit"
 variant="secondary"
 disabled={String(requestCollaboratorId || "") === String(selectedRequest?.collaborator_user_id || "")}
 >
 Guardar responsable
 </Button>
 </div>
 </div>
 </form>
 )}
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex flex-wrap gap-4">
            {(isRequestContext
              ? ["perfil", "postulantes", "checklist", "documentos", "comentarios"]
              : ["perfil", "checklist", "documentos", "comentarios"]
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === "postulantes" && isRequestContext && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <h3 className="text-sm font-semibold text-blue-900">Selección de Candidato</h3>
                <p className="text-xs text-blue-700">
                  Selecciona el postulante que deseas vincular a esta solicitud para iniciar el proceso de contratación.
                </p>
              </div>
              <ApplicantList
                applicants={applicants}
                loading={applicantsLoading}
                selectedApplicantId={selectedApplicantId}
                onSelect={handleSelectApplicant}
              />
            </div>
          )}
 {activeTab === "perfil" && (
 <div className="space-y-4">
 {isRequestContext && selectedApplicant && (
 <ApplicantIntakeSummary applicant={selectedApplicant} />
 )}
 <PersonnelProfile
 profileData={profileData}
 onChange={handleProfileChange}
 errors={profileErrors}
 readOnly={selectedRequest?.status === "completada"}
 canUnlockSections={canUnlockSections}
 sections={activeProfileSections}
 />
 </div>
 )}

 {activeTab === "checklist" && (
 <div className="space-y-4">
 {isRequestContext && (
 <div className="rounded-lg border border-gray-200 bg-white p-4">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div className="text-sm text-gray-700">
 <p className="font-semibold text-gray-900">Estado para contratación</p>
 <p className="text-xs text-gray-500">
 Perfil: {profileCompletion.done}/{profileCompletion.total} | Checklist: {checklistCompletion.done}/{checklistCompletion.total}
 </p>
 </div>
 <Button
 variant="primary"
 disabled={!canHire}
 onClick={handleHireApplicant}
 >
 Contratar postulante
 </Button>
 </div>
  {!canHire && (
    <div className="mt-3 space-y-1.5 border-t border-amber-100 pt-3">
      <p className="text-xs font-semibold text-amber-700">Requisitos pendientes para contratar:</p>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {!hasApplicant && (
          <li className="flex items-center gap-1.5 text-[11px] text-amber-600">
            <FiAlertCircle size={12} /> Seleccionar un postulante
          </li>
        )}
        {!profileCompletion.complete && (
          <li className="flex items-center gap-1.5 text-[11px] text-amber-600">
            <FiAlertCircle size={12} /> Completar perfil profesional (100%)
          </li>
        )}
        {!checklistCompletion.complete && (
          <li className="flex items-center gap-1.5 text-[11px] text-amber-600">
            <FiAlertCircle size={12} /> Marcar todos los puntos del checklist
          </li>
        )}
        {!hasContract && (
          <li className="flex items-center gap-1.5 text-[11px] text-amber-600">
            <FiAlertCircle size={12} /> Subir contrato de trabajo firmado
          </li>
        )}
      </ul>
    </div>
  )}
 </div>
 )}
          <PersonnelChecklist
            profileData={profileData}
            documents={documents}
            onToggleFlag={handleChecklistToggle}
            onUpload={handleUploadDocument}
            uploadingDocKey={docUploading}
            lockedSections={getLockedSections()}
            readOnly={selectedRequest?.status === "completada"}
          />
 </div>
 )}

 {activeTab === "documentos" && (
 <PersonnelDocuments
 documents={documents}
 onUpload={handleUploadDocument}
 uploadingDocKey={docUploading}
 lockedSections={getLockedSections()}
 readOnly={selectedRequest?.status === "completada"}
 />
 )}

 {activeTab === "comentarios" && (
 <PersonnelRequestComments
 comments={selectedRequest?.comments || []}
 commentText={workflowComment}
 setCommentText={setWorkflowComment}
 commentInternal={workflowCommentInternal}
 setCommentInternal={setWorkflowCommentInternal}
 onAddComment={handleAddComment}
 saving={workflowCommentSaving}
 canMarkInternal={canReassignPersonnel}
 />
 )}
 </div>
 </div>
 )}
 </div>
 </>
 )}
 </main>
 </div>
 </DashboardLayout>
 );
};

export default PersonnelWorkspace;
