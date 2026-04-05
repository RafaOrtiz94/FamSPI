import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
 createEquipmentPurchase,
 getEquipmentPurchaseMeta,
 listEquipmentProviderContacts,
 listEquipmentPurchases,
 requestProforma,
 reserveEquipment,
 saveProviderResponse,
 registerPublicPortalOutcome,
 uploadContract,
 requestDeliveryDates,
 submitDeliveryDates,
 markEquipmentArrived,
 markDispatchReady,
 completeDelivery,
 uploadProforma,
 uploadSignedProforma,
 requestPublicPurchaseInspection,
 startAvailability,
 coordinateInspectionDate,
 reviewInspectionDate,
 saveEquipmentProviderContact,
 getPublicPurchaseTechnicalSchedule,
 getEquipmentPurchaseApiError,
} from "../../../core/api/equipmentPurchasesApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";
import { useAuth } from "../../../core/auth/AuthContext";
import ProcessingOverlay from "../../../core/ui/components/ProcessingOverlay";
import StatusBadge from "./StatusBadge";
import EquipmentSelector from "./EquipmentSelector";
import RequestActions from "./RequestActions";
import { usePurchaseSSE } from "../../../core/hooks/usePurchaseSSE";
import {
 STATUS_CONFIG,
 VALIDATION_MESSAGES,
 MODAL_TITLES,
 PROCESSING_STEPS,
 SUCCESS_MESSAGES,
 EMPTY_STATES,
 LOADING_MESSAGES,
 ARIA_LABELS,
} from "./EquipmentPurchaseWidget.constants";
import {
 normalizeResponseItems,
 dedupeEquipmentList,
 getEquipmentDisplayList,
 getFormattedProviderResponse,
 getPaginationInfo,
 validateForm,
 getEquipmentPayload,
 formatProviderOutcome,
} from "./EquipmentPurchaseWidget.utils";
import { formatDateTimeEC } from "../../../core/utils/dateUtils";
import { formatDateOnlyEs, normalizeDateOnly } from "../../../core/utils/workflowUi";
import {
 FiPackage,
 FiMail,
 FiUser,
 FiSearch,
 FiFileText,
 FiChevronDown,
 FiChevronUp,
 FiList,
} from "react-icons/fi";

const CHECKLIST_ACTION_LABELS = {
 start_availability: "Solicitar disponibilidad al proveedor",
 save_provider_response: "Registrar respuesta del proveedor",
 request_or_upload_proforma: "Solicitar o subir proforma",
 reserve_equipment: "Reservar equipos",
 submit_signed_with_inspection: "Subir proforma firmada",
 request_inspection: "Solicitar inspección de ambiente",
 register_public_portal_outcome: "Registrar resultado portal público",
 upload_contract: "Subir contrato",
 request_delivery_dates: "Solicitar fechas de entrega",
 submit_delivery_dates: "Registrar fechas de entrega",
 mark_equipment_arrived: "Marcar arribo de equipo",
 mark_dispatch_ready: "Marcar despacho listo",
 complete_delivery: "Completar entrega",
};

const toChecklistActionLabel = (action) =>
 CHECKLIST_ACTION_LABELS[action] || action || "Sin paso definido";

const epwLog = (...args) => {
 // Logs temporales para depuración de flujo ACP/proveedor.
 console.log("[EPW_DEBUG]", ...args);
};

const normalizeUserTokens = (user) => {
 if (!user) return [];
 const normalizeToken = (value) =>
 String(value || "")
 .trim()
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, "_")
 .replace(/^_+|_+$/g, "");
 const rawRoles = user?.roles ?? user?.role ?? [];
 const rawScopes = user?.scope ?? [];
 const roleValues = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
 const scopeValues = Array.isArray(rawScopes) ? rawScopes : [rawScopes];
 return [...roleValues, ...scopeValues]
 .flatMap((value) => {
 const raw = String(value || "").trim();
 if (!raw) return [];
 return [raw, ...raw.split(/[,\s]+/)];
 })
 .map((value) => normalizeToken(value))
 .filter(Boolean);
};

const toIsoDate = (dateObj) => {
 const year = dateObj.getFullYear();
 const month = String(dateObj.getMonth() + 1).padStart(2, "0");
 const day = String(dateObj.getDate()).padStart(2, "0");
 return `${year}-${month}-${day}`;
};

const startOfMonth = (value) => {
 if (!value) return null;
 const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
 if (Number.isNaN(date.getTime())) return null;
 return new Date(date.getFullYear(), date.getMonth(), 1);
};

const buildMonthGrid = (baseDate) => {
 const year = baseDate.getFullYear();
 const month = baseDate.getMonth();
 const firstDay = new Date(year, month, 1);
 const start = new Date(firstDay);
 start.setDate(firstDay.getDate() - firstDay.getDay());
 const days = [];
 for (let i = 0; i < 42; i += 1) {
 const date = new Date(start);
 date.setDate(start.getDate() + i);
 days.push({
 date,
 iso: toIsoDate(date),
 inMonth: date.getMonth() === month,
 });
 }
 return days;
};

const EquipmentPurchaseWidget = ({ showCreation = true, compactList = false }) => {
 const navigate = useNavigate();
 const location = useLocation();
 const { showToast } = useUI();
 const { user } = useAuth();
 const roleTokens = useMemo(() => normalizeUserTokens(user), [user]);
 const hasRoleToken = React.useCallback(
 (token) => {
 const normalizedToken = String(token || "")
 .trim()
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, "_")
 .replace(/^_+|_+$/g, "");
 const compactToken = normalizedToken.replace(/_/g, "");
 return roleTokens.some((role) => {
 const compactRole = String(role || "").replace(/_/g, "");
 return (
 role === normalizedToken ||
 role.includes(normalizedToken) ||
 compactRole === compactToken ||
 compactRole.includes(compactToken)
 );
 });
 },
 [roleTokens],
 );
 const isManager = ["acp_comercial", "gerencia", "jefe_comercial"].some((roleName) =>
 hasRoleToken(roleName),
 );
 const canAccessAttachments = ["acp_comercial", "gerencia_general"].some((roleName) =>
 hasRoleToken(roleName),
 );
 const canUploadSignedProforma = hasRoleToken("acp_comercial");
 const canRequestInspection = hasRoleToken("acp_comercial");
 const canCoordinateInspection = [
 "jefe_tecnico",
 "jefe_servicio_tecnico",
 ].some((roleName) => hasRoleToken(roleName));
 const canReviewInspectionCoordination = [
 "jefe_tecnico",
 "jefe_servicio_tecnico",
 ].some((roleName) => hasRoleToken(roleName));
 const canAccessTechnicalProcedureForms = [
 "jefe_tecnico",
 "jefe_servicio_tecnico",
 "tecnico",
 ].some((roleName) => hasRoleToken(roleName));
 const isWorkspaceRoute = String(location?.pathname || "").includes("/dashboard/purchases/workspace");
 const allowProcessModals = !isWorkspaceRoute;
 const [meta, setMeta] = useState({ clients: [], equipment: [], acpUsers: [], providerContacts: [] });
 const [requests, setRequests] = useState([]);
 const [listQuery, setListQuery] = useState("");
 const [page, setPage] = useState(1);
 const [loading, setLoading] = useState(false);
 const [creating, setCreating] = useState(false);
 const [form, setForm] = useState({
 clientId: "",
 clientName: "",
 assignedTo: "",
 equipment: [],
 notes: "",
 });
 const [responseDraft, setResponseDraft] = useState({ open: false, id: null, outcome: "new", notes: "", items: [] });
 const [inspectionDraft, setInspectionDraft] = useState({});
 const [inspectionModal, setInspectionModal] = useState({
 open: false,
 requestId: null,
 minDate: "",
 maxDate: "",
 includesKit: false
 });
 const [availabilityDrafts, setAvailabilityDrafts] = useState({});
 const [processingAction, setProcessingAction] = useState(null);
 const [processingStep, setProcessingStep] = useState(null);
 const [expandedRequestId, setExpandedRequestId] = useState(null);
 const [inspectionCoordDrafts, setInspectionCoordDrafts] = useState({});
 const [deliveryDrafts, setDeliveryDrafts] = useState({});
 const [portalOutcomeDrafts, setPortalOutcomeDrafts] = useState({});
 const [savingProviderContact, setSavingProviderContact] = useState(false);
 const [technicalScheduleDays, setTechnicalScheduleDays] = useState([]);
 const [calendarMonthByRequest, setCalendarMonthByRequest] = useState({});
 const loadAll = React.useCallback(async () => {
 setLoading(true);
 try {
 epwLog("loadAll:start", {
 showCreation,
 isManager,
 userId: user?.id,
 userRole: user?.role,
 userScope: user?.scope,
 roleTokens,
 });
 const [metaRes, listRes, providerContactsRes] = await Promise.all([
 showCreation ? getEquipmentPurchaseMeta() : Promise.resolve({ clients: [], equipment: [], acp_users: [], provider_contacts: [] }),
 listEquipmentPurchases(),
 isManager ? listEquipmentProviderContacts({ limit: 200 }) : Promise.resolve([]),
 ]);
 setMeta({
 clients: metaRes.clients || [],
 equipment: dedupeEquipmentList(metaRes.equipment || []),
 acpUsers: metaRes.acp_users || [],
 providerContacts: showCreation
 ? (metaRes.provider_contacts || providerContactsRes || [])
 : (providerContactsRes || []),
 });
 setRequests(listRes || []);
 epwLog("loadAll:done", {
 clients: (metaRes.clients || []).length,
 equipment: (metaRes.equipment || []).length,
 acpUsers: (metaRes.acp_users || []).length,
 providerContacts: (providerContactsRes || metaRes.provider_contacts || []).length,
 requests: (listRes || []).length,
 pendingProviderAssignment: (listRes || []).filter((r) => r.status === "pending_provider_assignment").length,
 });
 } catch (error) {
 console.error(error);
 epwLog("loadAll:error", {
 message: error?.message,
 code: error?.response?.data?.code,
 status: error?.response?.status,
 backendMessage: error?.response?.data?.message,
 });
 const apiError = getEquipmentPurchaseApiError(error, "No se pudo cargar las solicitudes de compra");
 showToast(apiError.message, "error");
 } finally {
 setLoading(false);
 }
 }, [showCreation, isManager, showToast, user?.id, user?.role, user?.scope, roleTokens]);

 useEffect(() => {
 epwLog("auth-context", {
 userId: user?.id,
 userRole: user?.role,
 userScope: user?.scope,
 roleTokens,
 isManager,
 });
 }, [user?.id, user?.role, user?.scope, roleTokens, isManager]);

 useEffect(() => {
 loadAll();
 }, [loadAll]);

 useEffect(() => {
 let cancelled = false;
 const loadTechnicalSchedule = async () => {
 try {
 const candidates = (requests || []).filter((req) => req.status === "pending_contract");
 if (!candidates.length) {
 if (!cancelled) setTechnicalScheduleDays([]);
 return;
 }
 const from = candidates
 .map((item) => item.inspection_min_date)
 .filter(Boolean)
 .sort()[0] || new Date().toISOString().slice(0, 10);
 const to = candidates
 .map((item) => item.inspection_max_date)
 .filter(Boolean)
 .sort()
 .slice(-1)[0] || (() => {
 const d = new Date();
 d.setDate(d.getDate() + 60);
 return d.toISOString().slice(0, 10);
 })();
 const calendar = await getPublicPurchaseTechnicalSchedule({ from, to });
 if (!cancelled) {
 setTechnicalScheduleDays(Array.isArray(calendar?.days) ? calendar.days : []);
 }
 } catch (_error) {
 if (!cancelled) setTechnicalScheduleDays([]);
 }
 };
 loadTechnicalSchedule();
 return () => {
 cancelled = true;
 };
 }, [requests]);

 const handlePurchaseEvent = React.useCallback(({ request }) => {
 if (!request) return;
 setRequests((prev) => {
 const list = Array.isArray(prev) ? [...prev] : [];
 const idx = list.findIndex((item) => item.id === request.id);
 if (idx >= 0) {
 list[idx] = request;
 } else {
 list.unshift(request);
 }
 return list;
 });
 loadAll();
 }, [loadAll]);

 usePurchaseSSE({
 type: "public",
 onEvent: handlePurchaseEvent,
 debounceMs: 800,
 });

 useEffect(() => {
 setPage(1);
 }, [listQuery]);

 useEffect(() => {
 if (showCreation && !isManager && meta.acpUsers?.length && !form.assignedTo) {
 setForm((prev) => ({ ...prev, assignedTo: meta.acpUsers[0].id }));
 }
 }, [showCreation, isManager, meta.acpUsers, form.assignedTo]);

 const selectedClient = useMemo(
 () => (showCreation ? meta.clients.find((c) => `${c.id}` === `${form.clientId}`) : null),
 [showCreation, meta.clients, form.clientId],
 );

 const filteredRequests = useMemo(() => {
 const q = (listQuery || "").trim().toLowerCase();
 const purchaseRequests = requests.filter((req) => req.request_type !== "business_case");
 if (!q) return purchaseRequests;
 return purchaseRequests.filter((req) =>
 [req.client_name, req.provider_email, req.assigned_to_name, req.assigned_to_email]
 .filter(Boolean)
 .some((val) => String(val).toLowerCase().includes(q))
 );
 }, [listQuery, requests]);

 const perPage = compactList ? 9 : Math.max(filteredRequests.length, 1);
 const totalPages = Math.max(1, Math.ceil((filteredRequests.length || 0) / perPage));
 const currentPage = Math.min(page, totalPages);
 const visibleRequests = useMemo(() => {
 if (!compactList) return filteredRequests;
 const start = (currentPage - 1) * perPage;
 return filteredRequests.slice(start, start + perPage);
 }, [compactList, filteredRequests, currentPage, perPage]);

 useEffect(() => {
 if (page > totalPages) {
 setPage(totalPages);
 }
 }, [page, totalPages]);

 const toggleEquipment = (id) => {
 setForm((prev) => {
 const exists = prev.equipment.find((eq) => eq.id === id);
 return {
 ...prev,
 equipment: exists
 ? prev.equipment.filter((x) => x.id !== id)
 : [...prev.equipment, { id, type: "new_available" }],
 };
 });
 };

 const updateEquipmentType = (id, type) => {
 setForm((prev) => ({
 ...prev,
 equipment: prev.equipment.map((eq) =>
 eq.id === id ? { ...eq, type } : eq
 ),
 }));
 };

 const handleCreate = async () => {
 const hasClient = Boolean(form.clientId) || Boolean(String(form.clientName || "").trim());
 if (!hasClient || !form.equipment.length) {
 showToast("Nombre del cliente y equipos son obligatorios", "warning");
 return;
 }
 if (!isManager && !form.assignedTo) {
 showToast("Debes asignar la solicitud a un ACP Comercial", "warning");
 return;
 }
 setCreating(true);
 try {
 const equipmentPayload = form.equipment.map((formEq) => {
 const eq = meta.equipment.find((e) => e.id === formEq.id);
 return {
 equipment_id: eq.id,
 name: eq.name,
 sku: eq.sku,
 serial: eq.serial,
 status: eq.status,
 type: formEq.type
 };
 });
 const normalizedClientName = String(selectedClient?.name || form.clientName || "").trim();

 await createEquipmentPurchase({
 client_id: form.clientId || null,
 client_name: normalizedClientName,
 client_email: selectedClient?.client_email,
 assigned_to: form.assignedTo || null,
 equipment: equipmentPayload,
 notes: form.notes,
 });
 showToast("Solicitud creada y enviada a ACP Comercial para gestionar proveedor", "success");
 setForm({
 clientId: "",
 clientName: "",
 assignedTo: isManager ? "" : meta.acpUsers?.[0]?.id || "",
 equipment: [],
 notes: "",
 });
 loadAll();
 } catch (error) {
 console.error(error);
 const apiError = getEquipmentPurchaseApiError(error, "No se pudo crear la solicitud");
 showToast(apiError.message, "error");
 } finally {
 setCreating(false);
 }
 };

 const openResponse = (request) => setResponseDraft({
 open: true,
 id: request.id,
 outcome: "new",
 notes: "",
 items: normalizeResponseItems(request),
 });

 const runWithOverlay = async (title, steps, asyncFn) => {
 setProcessingAction({ title, steps });
 setProcessingStep(steps?.[0]?.id || null);
 await new Promise((resolve) => setTimeout(resolve, 10));
 try {
 await asyncFn();
 } finally {
 setProcessingAction(null);
 setProcessingStep(null);
 }
 };

 const handleApiError = (error, fallbackMessage) => {
 const apiError = getEquipmentPurchaseApiError(error, fallbackMessage);
 showToast(apiError.message, "error");
 if (["STALE_REQUEST_STATE", "INVALID_TRANSITION", "REQUEST_NOT_FOUND"].includes(apiError.code)) {
 loadAll();
 }
 };

 const submitResponse = async () => {
 await runWithOverlay(
 "Enviando respuesta al proveedor",
 [{ id: "response", label: "Registrando respuesta" }],
 async () => {
 try {
 const responseItems = (responseDraft.items || []).map((item) => {
 const availableType = item.available_type || "none";
 const decision = availableType === "none" ? "reject" : item.decision || "reject";
 return { ...item, available_type: availableType, decision };
 });

 const acceptedItems = responseItems.filter(
 (item) => item.available_type !== "none" && item.decision !== "reject",
 );
 const normalizedOutcome = acceptedItems.length > 0 ? "new" : "none";
 await saveProviderResponse(responseDraft.id, {
 outcome: normalizedOutcome,
 notes: responseDraft.notes,
 items: responseItems,
 expected_updated_at: requests.find((row) => row.id === responseDraft.id)?.updated_at,
 });
 showToast("Respuesta registrada", "success");
 setResponseDraft({ open: false, id: null, outcome: "new", notes: "", items: [] });
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo guardar la respuesta");
 }
 },
 );
 };

 const handleRequestProforma = async (request) => {
 await runWithOverlay(
 "Solicitando proforma",
 [{ id: "proforma", label: "Solicitando proforma" }],
 async () => {
 try {
 await requestProforma(request.id, request.updated_at);
 showToast("Proforma solicitada", "success");
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo solicitar la proforma");
 }
 },
 );
 };

 const handleUpload = async (request, action, file, extra = {}) => {
 if (!file) {
 showToast("Selecciona un archivo", "warning");
 return;
 }
 const label = action === "proforma" ? "subiendo proforma" : action === "signed" ? "subiendo proforma firmada" : "subiendo contrato";
 await runWithOverlay(
 `Enviando ${label}`,
 [{ id: action, label: `Subiendo ${label}` }],
 async () => {
 try {
 if (action === "proforma") await uploadProforma(request.id, file, { expected_updated_at: request.updated_at });
 if (action === "signed") await uploadSignedProforma(request.id, { file, ...extra, expected_updated_at: request.updated_at });
 if (action === "contract") await uploadContract(request.id, file, { expected_updated_at: request.updated_at });
 showToast("Archivo cargado", "success");
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo cargar el archivo");
 }
 },
 );
 };

 const handleReserve = async (request) => {
 await runWithOverlay(
 "Enviando reserva",
 [{ id: "reserve", label: "Enviando reserva" }],
 async () => {
 try {
 await reserveEquipment(request.id, request.updated_at);
 showToast("Reserva enviada y recordatorio agendado", "success");
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo enviar la reserva");
 }
 },
 );
 };

 const handleStartAvailability = async (request) => {
 const draft = availabilityDrafts[request.id] || {};
 const providerEmail = draft.provider_email ?? request.provider_email ?? "";
 const notes = draft.notes ?? request.notes ?? "";
 epwLog("startAvailability:attempt", {
 requestId: request?.id,
 requestStatus: request?.status,
 assignedTo: request?.assigned_to,
 currentUserId: user?.id,
 providerEmail,
 hasProviderEmail: Boolean(String(providerEmail || "").trim()),
 checklistAction: request?.checklist_state?.action,
 checklistPending: request?.checklist_state?.pending || [],
 draft,
 });

 if (!providerEmail) {
 epwLog("startAvailability:blocked:no-provider-email", { requestId: request?.id });
 showToast("Debes ingresar el correo del proveedor", "warning");
 return;
 }

 await runWithOverlay(
 "Enviando correo de disponibilidad",
 [{ id: "availability", label: "Enviando correo de disponibilidad" }],
 async () => {
 try {
 const payload = {
 provider_email: providerEmail,
 notes,
 expected_updated_at: request.updated_at,
 };
 epwLog("startAvailability:api:request", { requestId: request.id, payload });
 const response = await startAvailability(request.id, payload);
 epwLog("startAvailability:api:success", { requestId: request.id, response });
 showToast("Correo de disponibilidad enviado", "success");
 setAvailabilityDrafts((prev) => ({ ...prev, [request.id]: {} }));
 loadAll();
 } catch (error) {
 console.error(error);
 epwLog("startAvailability:api:error", {
 requestId: request?.id,
 message: error?.message,
 code: error?.response?.data?.code,
 status: error?.response?.status,
 backendMessage: error?.response?.data?.message,
 details: error?.response?.data?.details,
 });
 handleApiError(error, "No se pudo enviar el correo de disponibilidad");
 }
 },
 );
 };

 const handleRegisterProviderContact = async ({ email }) => {
 const normalizedEmail = String(email || "").trim().toLowerCase();
 epwLog("registerProvider:attempt", { email, normalizedEmail, userId: user?.id });
 if (!normalizedEmail) {
 epwLog("registerProvider:blocked:invalid-email", { email });
 showToast("Debes ingresar un correo de proveedor válido", "warning");
 return;
 }
 setSavingProviderContact(true);
 try {
 const saved = await saveEquipmentProviderContact({ email: normalizedEmail });
 epwLog("registerProvider:api:success", { normalizedEmail, saved });
 setMeta((prev) => {
 const previous = Array.isArray(prev.providerContacts) ? prev.providerContacts : [];
 const deduped = previous.filter(
 (item) => String(item?.email || "").trim().toLowerCase() !== normalizedEmail,
 );
 return {
 ...prev,
 providerContacts: [saved, ...deduped],
 };
 });
 showToast("Proveedor guardado para reutilización", "success");
 } catch (error) {
 epwLog("registerProvider:api:error", {
 normalizedEmail,
 message: error?.message,
 code: error?.response?.data?.code,
 status: error?.response?.status,
 backendMessage: error?.response?.data?.message,
 details: error?.response?.data?.details,
 });
 handleApiError(error, "No se pudo guardar el proveedor");
 } finally {
 setSavingProviderContact(false);
 }
 };
 const handleSubmitInspection = async () => {
 const { requestId, minDate, maxDate, includesKit } = inspectionModal;

 if (!minDate || !maxDate) {
 showToast("Las fechas mínima y máxima son obligatorias", "warning");
 return;
 }

 await runWithOverlay(
 "Registrando inspección",
 [{ id: "inspection", label: "Enviando inspección" }],
 async () => {
 try {
 const expectedUpdatedAt = requests.find((row) => row.id === requestId)?.updated_at;
 await requestPublicPurchaseInspection(requestId, {
 inspection_min_date: minDate,
 inspection_max_date: maxDate,
 includes_starter_kit: includesKit,
 expected_updated_at: expectedUpdatedAt,
 });
 showToast("Solicitud de inspección creada con autollenado", "success");
 setInspectionModal({ open: false, requestId: null, minDate: "", maxDate: "", includesKit: false });
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "Error al procesar la solicitud");
 }
 },
 );
 };

 const handleCoordinateInspection = async (request) => {
 if (!request?.id) return;
 const draft = inspectionCoordDrafts[request.id] || {};
 const selectedDate = normalizeDateOnly(draft.inspection_date || "");
 if (!selectedDate) {
 showToast("Selecciona la fecha coordinada de inspección", "warning");
 return;
 }
 if (!request.inspection_min_date || !request.inspection_max_date) {
 showToast("La solicitud no tiene ventana de inspección definida", "warning");
 return;
 }

 await runWithOverlay(
 "Enviando propuesta de inspección",
 [{ id: "inspection-coordination", label: "Registrando propuesta comercial" }],
 async () => {
 try {
 await coordinateInspectionDate(request.id, {
 inspection_date: selectedDate,
 notes: draft.notes || "",
 expected_updated_at: request.updated_at,
 });
 showToast("Fecha propuesta enviada. Pendiente aprobación de Jefe Técnico", "success");
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo enviar la propuesta de coordinación");
 }
 },
 );
 };

 const handleReviewInspection = async (request, decision) => {
 if (!request?.id) return;
 const draft = inspectionCoordDrafts[request.id] || {};
 await runWithOverlay(
 decision === "accept" ? "Aprobando coordinación" : "Rechazando coordinación",
 [{ id: "inspection-review", label: decision === "accept" ? "Aprobando fecha propuesta" : "Rechazando fecha propuesta" }],
 async () => {
 try {
 await reviewInspectionDate(request.id, {
 decision,
 review_notes: draft.review_notes || "",
 expected_updated_at: request.updated_at,
 });
 showToast(
 decision === "accept"
 ? "Fecha de inspección aprobada por Jefe Técnico"
 : "Fecha propuesta rechazada. Comercial debe proponer otra fecha",
 "success",
 );
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo revisar la propuesta");
 }
 },
 );
 };

 const handleRequestDeliveryDates = async (request) => {
 await runWithOverlay(
 "Solicitando fechas de entrega",
 [{ id: "delivery-dates-request", label: "Solicitando fechas" }],
 async () => {
 try {
 const draft = deliveryDrafts[request.id] || {};
 await requestDeliveryDates(request.id, {
 notes: draft.notes || "",
 expected_updated_at: request.updated_at,
 });
 showToast("Solicitud de fechas de entrega enviada", "success");
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo solicitar fechas de entrega");
 }
 },
 );
 };

 const handleRegisterPublicPortalOutcome = async (request) => {
 if (!request?.id) return;
 const draft = portalOutcomeDrafts[request.id] || {};
 const outcome = String(
 draft.outcome ?? request.public_portal_outcome ?? "",
 )
 .trim()
 .toLowerCase();
 if (!outcome) {
 showToast("Debes seleccionar si el proceso fue ganado o no ganado", "warning");
 return;
 }
 await runWithOverlay(
 "Registrando resultado portal",
 [{ id: "public-portal-outcome", label: "Guardando resultado" }],
 async () => {
 try {
 await registerPublicPortalOutcome(request.id, {
 outcome,
 notes: draft.notes ?? request.public_portal_outcome_notes ?? "",
 expected_updated_at: request.updated_at,
 });
 showToast(
 outcome === "won"
 ? "Resultado registrado: proceso ganado. Continúa con cliente e inspección."
 : "Resultado registrado: proceso no ganado. Solicitud finalizada.",
 "success",
 );
 setPortalOutcomeDrafts((prev) => ({ ...prev, [request.id]: {} }));
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo registrar el resultado del portal");
 }
 },
 );
 };

 const handleSubmitDeliveryDates = async (request) => {
 const draft = deliveryDrafts[request.id] || {};
 if (!draft.delivery_start_at || !draft.delivery_end_at) {
 showToast("Debes definir fecha de inicio y fin de entrega", "warning");
 return;
 }
 await runWithOverlay(
 "Registrando fechas de entrega",
 [{ id: "delivery-dates-submit", label: "Guardando fechas" }],
 async () => {
 try {
 await submitDeliveryDates(request.id, {
 delivery_start_at: draft.delivery_start_at,
 delivery_end_at: draft.delivery_end_at,
 notes: draft.notes || "",
 expected_updated_at: request.updated_at,
 });
 showToast("Fechas de entrega registradas", "success");
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo registrar fechas de entrega");
 }
 },
 );
 };

 const handleMarkEquipmentArrived = async (request) => {
 await runWithOverlay(
 "Marcando arribo de equipo",
 [{ id: "equipment-arrived", label: "Registrando arribo" }],
 async () => {
 try {
 const draft = deliveryDrafts[request.id] || {};
 await markEquipmentArrived(request.id, {
 notes: draft.notes || "",
 expected_updated_at: request.updated_at,
 });
 showToast("Equipo marcado como arribado", "success");
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo marcar arribo");
 }
 },
 );
 };

 const handleMarkDispatchReady = async (request) => {
 await runWithOverlay(
 "Marcando despacho listo",
 [{ id: "dispatch-ready", label: "Actualizando despacho" }],
 async () => {
 try {
 const draft = deliveryDrafts[request.id] || {};
 await markDispatchReady(request.id, {
 notes: draft.notes || "",
 expected_updated_at: request.updated_at,
 });
 showToast("Despacho marcado como listo", "success");
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo marcar despacho listo");
 }
 },
 );
 };

 const handleCompleteDelivery = async (request) => {
 await runWithOverlay(
 "Completando entrega",
 [{ id: "delivery-complete", label: "Cerrando entrega" }],
 async () => {
 try {
 const draft = deliveryDrafts[request.id] || {};
 await completeDelivery(request.id, {
 notes: draft.notes || "",
 expected_updated_at: request.updated_at,
 });
 showToast("Entrega completada", "success");
 loadAll();
 } catch (error) {
 console.error(error);
 handleApiError(error, "No se pudo completar entrega");
 }
 },
 );
 };

 return (
 <>
 {processingAction && (
 <ProcessingOverlay
 className="z-[1010]"
 title={processingAction.title}
 steps={processingAction.steps}
 activeStep={processingStep}
 />
 )}
 <div className="space-y-6">
 {showCreation && (
 <Card className="overflow-hidden border border-slate-200/70 shadow-sm">
 <div className="flex flex-col gap-2 border-b border-slate-200/60 bg-slate-50/70 p-4">
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div className="flex items-start gap-2">
 <FiPackage className="text-slate-600 mt-0.5" size={16} />
 <div>
 <h2 className="text-base font-semibold text-slate-900">Nueva solicitud de compra</h2>
 <p className="text-xs text-slate-500">Registro y asignación a ACP Comercial</p>
 </div>
 </div>
 <Button onClick={loadAll} variant="ghost" className="px-3">
 Refrescar
 </Button>
 </div>
 </div>

 <div className="space-y-4 p-4">
 <div className="grid grid-cols-1 gap-4">
 <div>
 <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Cliente</label>
 <select
 className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
 value={form.clientId}
 onChange={(e) => {
 const selectedId = e.target.value;
 const selected = meta.clients.find((c) => `${c.id}` === `${selectedId}`);
 setForm((prev) => ({
 ...prev,
 clientId: selectedId,
 clientName: selectedId ? (selected?.name || prev.clientName) : prev.clientName,
 }));
 }}
 >
 <option value="">Escribe solo razón social (opcional seleccionar cliente)</option>
 {meta.clients.map((c) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 <input
 type="text"
 className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
 value={form.clientName}
 onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))}
 placeholder="Razón social del cliente"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Asignar a ACP Comercial</label>
 <select
 className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
 value={form.assignedTo}
 onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: e.target.value }))}
 disabled={meta.acpUsers.length === 0}
 >
 <option value="">{meta.acpUsers.length ? "Selecciona un ACP" : "Sin ACP disponibles"}</option>
 {meta.acpUsers.map((user) => (
 <option key={user.id} value={user.id}>{user.name}</option>
 ))}
 </select>
 </div>
 </div>

 <EquipmentSelector
 equipment={meta.equipment}
 selectedEquipment={form.equipment}
 onToggleEquipment={toggleEquipment}
 onUpdateType={updateEquipmentType}
 />

 <div>
 <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Notas al proveedor</label>
 <textarea
 className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
 rows={3}
 value={form.notes}
 onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
 />
 </div>

 <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
 <div className="text-xs text-slate-500">
 El proveedor y correo se registran despues por ACP Comercial.
 </div>
 <Button onClick={handleCreate} loading={creating} className="sm:w-auto w-full">
 Crear solicitud pública
 </Button>
 </div>
 </div>
 </Card>
 )}

 <div>
 <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
 <div>
 <div className="flex flex-wrap items-center gap-2">
 <h2 className="text-base font-semibold text-slate-900">Solicitudes</h2>
 <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
 {filteredRequests.length} total
 </span>
 </div>
 {loading && <span className="block text-xs text-slate-500 animate-pulse">Actualizando...</span>}
 </div>
 <div className="flex flex-col items-end gap-2 w-full md:w-auto">
 {compactList && (
 <div className="relative w-full md:w-72">
 <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
 <input
 value={listQuery}
 onChange={(e) => setListQuery(e.target.value)}
 className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
 placeholder="Buscar cliente o proveedor"
 />
 </div>
 )}
 <div className="flex items-center gap-2">
 {!showCreation && (
 <Button onClick={loadAll} variant="ghost" className="text-sm px-3 py-1.5">
 Refrescar
 </Button>
 )}
 {compactList && (
 <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
 <Button
 variant="secondary"
 className="px-3 py-1"
 disabled={currentPage <= 1}
 onClick={() => setPage((p) => Math.max(1, p - 1))}
 >
 Anterior
 </Button>
 <span className="text-slate-700">
 Pagina {currentPage} de {totalPages}
 </span>
 <Button
 variant="secondary"
 className="px-3 py-1"
 disabled={currentPage >= totalPages}
 onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
 >
 Siguiente
 </Button>
 </div>
 )}
 </div>
 </div>
 </div>
 {visibleRequests.length === 0 ? (
 <Card className="p-12 text-center border border-slate-200/70 bg-white/80 shadow-sm">
 <FiPackage className="mx-auto text-slate-300 mb-4" size={48} />
 <p className="text-slate-500">Sin solicitudes registradas</p>
 </Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
 {visibleRequests.map((req) => {
 const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.waiting_provider_response;
 const providerResponse = req.provider_response || null;
 const requestedMap = new Map(
 (req.equipment || []).map((item, index) => [
 String(item.id || item.equipment_id || item.inventory_id || `eq_${index + 1}`),
 item,
 ]),
 );
 const availableItems = Array.isArray(providerResponse?.items)
 ? providerResponse.items.map((item) => {
 const itemKey = String(item.id || item.equipment_id || item.inventory_id || "");
 const requestedItem = requestedMap.get(itemKey) || {};
 return {
 ...item,
 name: item.name || requestedItem.name || requestedItem.label || requestedItem.sku || "Equipo",
 requested_type: item.requested_type || requestedItem.type,
 available_type: item.available_type || item.type,
 decision: item.decision || (item.available_type === "none" ? "reject" : "accept"),
 };
 })
 : [];
 const showAvailableItems = !!providerResponse && availableItems.length > 0;
 const equipmentList = showAvailableItems
 ? availableItems
 : (req.equipment || []).map((item) => ({
 ...item,
 requested_type: item.type,
 available_type: item.type,
 }));
 const equipmentTitle = showAvailableItems
 ? "Equipos disponibles (respuesta del proveedor):"
 : "Equipos solicitados:";
 const providerText = providerResponse
 ? formatProviderOutcome(providerResponse.outcome)
 : "Sin respuesta del proveedor";
 const providerTimestamp =
 providerResponse?.updated_at ||
 req.provider_response_at ||
 req.updated_at ||
 req.created_at;
 const formattedResponseDate = providerTimestamp
 ? new Date(providerTimestamp).toLocaleString("es-ES", {
 day: "2-digit",
 month: "short",
 year: "numeric",
 hour: "2-digit",
 minute: "2-digit",
 })
 : null;
 const expanded = expandedRequestId === req.id;
 const canManageThisRequest =
 isManager || String(req.assigned_to || "") === String(user?.id || "");
 if (req.status === "pending_provider_assignment") {
 epwLog("request-card:pending-provider", {
 requestId: req.id,
 assignedTo: req.assigned_to,
 currentUserId: user?.id,
 isManager,
 canManageThisRequest,
 providerEmail: req.provider_email || "",
 checklistAction: req?.checklist_state?.action || null,
 checklistPending: req?.checklist_state?.pending || [],
 });
 }
 const inspectionCoordinationDraft = inspectionCoordDrafts[req.id] || {};
 const publicPortalOutcome = String(req.public_portal_outcome || "").toLowerCase();
 const inspectionMinDate = normalizeDateOnly(req.inspection_min_date);
 const inspectionMaxDate = normalizeDateOnly(req.inspection_max_date);
 const selectedInspectionDate = normalizeDateOnly(
 inspectionCoordinationDraft.inspection_date ?? req.inspection_proposed_date ?? "",
 );
 const selectedDateSchedule = technicalScheduleDays.find((item) => item.date === selectedInspectionDate);
 const selectedDateIsFull = Boolean(
 selectedDateSchedule && Array.isArray(selectedDateSchedule.items) && selectedDateSchedule.items.length >= 3,
 );
 const monthStartCandidate =
 calendarMonthByRequest[req.id] ||
 startOfMonth(selectedInspectionDate) ||
 startOfMonth(inspectionMinDate) ||
 new Date();
 const calendarMonthStart = new Date(
 monthStartCandidate.getFullYear(),
 monthStartCandidate.getMonth(),
 1,
 );
 const calendarDays = buildMonthGrid(calendarMonthStart);
 const blockedDatesInWindow = (technicalScheduleDays || []).filter((item) => {
 if (!inspectionMinDate || !inspectionMaxDate) return false;
 return (
 item.date >= inspectionMinDate &&
 item.date <= inspectionMaxDate &&
 Array.isArray(item.items) &&
 item.items.length >= 3
 );
 });
 const showDeliverySummary = Boolean(
 req.delivery_start_at ||
 req.delivery_end_at ||
 req.equipment_arrived_at ||
 req.dispatch_ready_at ||
 req.delivered_at ||
 ["contract_available", "delivery_dates_requested", "delivery_dates_submitted", "waiting_dispatch", "dispatch_ready", "completed"].includes(req.status),
 );
 const generatedDocuments = [
 req.process_doc_link
 ? { key: "process_doc", label: "Documento base del proceso", link: req.process_doc_link }
 : null,
 req.proforma_file_link
 ? { key: "proforma", label: "Proforma", link: req.proforma_file_link }
 : null,
 req.signed_proforma_file_link
 ? { key: "signed_proforma", label: "Proforma firmada", link: req.signed_proforma_file_link }
 : null,
 req.contract_file_link
 ? { key: "contract", label: "Contrato", link: req.contract_file_link }
 : null,
 req.extra?.inspection_acta_link
 ? { key: "inspection_acta", label: "Acta de inspección F.ST-20", link: req.extra.inspection_acta_link }
 : null,
 ].filter(Boolean);
 const clientDocuments = Array.isArray(req.client_documents) ? req.client_documents : [];
 const hasDocumentsSection = canAccessAttachments && (generatedDocuments.length > 0 || clientDocuments.length > 0);
 const toggleExpanded = () => {
 setExpandedRequestId((prev) => (prev === req.id ? null : req.id));
 };

 return (
 <Card
 key={req.id}
 className={`h-full flex flex-col rounded-xl p-4 border border-slate-200 bg-white shadow-sm ${statusConfig.cardBorder}`}
 >
 <div className="flex items-start justify-between gap-2 mb-3">
 <div className="min-w-0">
 <h3 className="font-semibold text-base text-slate-900 truncate">{req.client_name}</h3>
 <p className="text-[11px] text-slate-500 mt-0.5">
 {formatDateTimeEC(req.created_at)}
 </p>
 </div>
 <StatusBadge status={req.status} />
 </div>

 <div className="space-y-2 mb-3">
 <div className="flex items-center gap-2 text-sm text-slate-700 min-w-0">
 <FiMail className="text-slate-400 shrink-0" size={14} />
 <span className="truncate">{req.provider_email || "Proveedor pendiente"}</span>
 </div>
 {(req.assigned_to_name || req.assigned_to_email) && (
 <div className="flex items-center gap-2 text-sm text-slate-700 min-w-0">
 <FiUser className="text-slate-400 shrink-0" size={14} />
 <span className="truncate">{req.assigned_to_name || req.assigned_to_email}</span>
 </div>
 )}
 </div>

 {req.extra?.auto_business_case_id && (
 <div className="mb-3">
 <button
 type="button"
 onClick={() => navigate(`/dashboard/business-case/workspace/${req.extra.auto_business_case_id}`)}
 className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 transition-colors"
 >
 Ir al BC automático #{String(req.extra.auto_business_case_id).slice(0, 8)}
 </button>
 </div>
 )}

 <div className="mb-3">
 <button
 type="button"
 onClick={toggleExpanded}
 className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800"
 >
 {expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
 {expanded ? "Ocultar detalle" : "Ver detalle"}
 </button>
 </div>

 {(req.status === "waiting_signed_proforma" || req.status === "pending_contract" || req.inspection_request_id) && (
 <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
 <p className="text-[11px] uppercase tracking-wide text-slate-500">
 Coordinación de inspección
 </p>
 <p className="text-xs text-slate-700">
 Ventana acordada:{" "}
 <span className="font-medium">
 {inspectionMinDate ? formatDateOnlyEs(inspectionMinDate, "Sin mínimo") : "Sin mínimo"} - {inspectionMaxDate ? formatDateOnlyEs(inspectionMaxDate, "Sin máximo") : "Sin máximo"}
 </span>
 </p>
 <p className="text-xs text-slate-700">
 Fecha propuesta:{" "}
 <span className="font-semibold">
 {formatDateOnlyEs(req.inspection_proposed_date)}
 </span>
 </p>
 <p className="text-xs text-slate-700">
 Fecha exacta coordinada:{" "}
 <span className="font-semibold">
 {formatDateOnlyEs(req.inspection_scheduled_date)}
 </span>
 </p>
 <p className="text-xs text-slate-700">
 Estado:{" "}
 <span className="font-semibold">
 {req.inspection_coordination_status === "accepted"
 ? "Aprobada por Jefe Técnico"
 : req.inspection_coordination_status === "pending_review"
 ? "Pendiente validación de Jefe Técnico"
 : req.inspection_coordination_status === "rejected"
 ? "Rechazada por Jefe Técnico"
 : "Pendiente propuesta"}
 </span>
 </p>
 <p className="text-xs text-slate-700">
 Resultado portal público:{" "}
 <span className="font-semibold">
 {publicPortalOutcome === "won"
 ? "Ganado"
 : publicPortalOutcome === "lost"
 ? "No ganado"
 : "Pendiente"}
 </span>
 </p>
 {req.contract_deadline_date && (
 <p className="text-xs text-slate-700">
 Fecha límite contrato (110 días):{" "}
 <span className="font-semibold">
 {formatDateOnlyEs(req.contract_deadline_date)}
 </span>
 {Number.isFinite(Number(req.contract_deadline_days_remaining)) && (
 <span
 className={`ml-1 ${
 Number(req.contract_deadline_days_remaining) < 0
 ? "text-rose-700"
 : "text-slate-600"
 }`}
 >
 ({Number(req.contract_deadline_days_remaining) < 0
 ? `${Math.abs(Number(req.contract_deadline_days_remaining))} día(s) vencido`
 : `${Number(req.contract_deadline_days_remaining)} día(s) restantes`})
 </span>
 )}
 </p>
 )}
 {req.contract_reminder_date && (
 <p className="text-[11px] text-slate-500">
 Recordatorio ACP (15 días antes): {formatDateOnlyEs(req.contract_reminder_date)}
 </p>
 )}
 {req.inspection_request_id && canAccessTechnicalProcedureForms && (
 <p className="text-[11px] text-slate-500">
 Solicitud técnica #{req.inspection_request_id}
 </p>
 )}
 {!req.inspection_request_id &&
 req.status === "pending_contract" &&
 canRequestInspection &&
 publicPortalOutcome === "won" && (
 <Button
 size="sm"
 variant="outline"
 onClick={() =>
 setInspectionModal({
 open: true,
 requestId: req.id,
 minDate: inspectionMinDate || "",
 maxDate: inspectionMaxDate || "",
 includesKit: Boolean(req.includes_starter_kit),
 })
 }
 >
 Solicitar inspección de ambiente
 </Button>
 )}
 {req.extra?.inspection_acta_link && (
 <a
 href={req.extra.inspection_acta_link}
 target="_blank"
 rel="noreferrer"
 className="inline-flex items-center text-xs font-medium text-blue-700 hover:text-blue-900"
 >
 Ver acta de inspección
 </a>
 )}
 {req.inspection_request_id && canAccessTechnicalProcedureForms && (
 <div className="flex flex-wrap gap-2 pt-1">
 <button
 type="button"
 onClick={() =>
 navigate(
 `/dashboard/servicio-tecnico/desinfeccion?source_type=public_purchase&source_id=${encodeURIComponent(
 req.id,
 )}&request_id=${encodeURIComponent(req.inspection_request_id)}`,
 )
 }
 className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
 >
 F.ST-02 Desinfección
 </button>
 <button
 type="button"
 onClick={() =>
 navigate(
 `/dashboard/servicio-tecnico/aplicaciones?source_type=public_purchase&source_id=${encodeURIComponent(
 req.id,
 )}&request_id=${encodeURIComponent(req.inspection_request_id)}`,
 )
 }
 className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
 >
 F.ST-04 Entrenamiento
 </button>
 <button
 type="button"
 onClick={() =>
 navigate(
 `/dashboard/servicio-tecnico/verificacion?source_type=public_purchase&source_id=${encodeURIComponent(
 req.id,
 )}&request_id=${encodeURIComponent(req.inspection_request_id)}`,
 )
 }
 className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
 >
 F.ST-09 Verificación
 </button>
 </div>
 )}
 {req.inspection_coordinated_by_email && (
 <p className="text-[11px] text-slate-500">
 Coordinado por {req.inspection_coordinated_by_email}
 </p>
 )}
 {canCoordinateInspection && req.status === "pending_contract" && (
 <div className="space-y-2">
 <input
 type="date"
 value={selectedInspectionDate}
 min={inspectionMinDate || undefined}
 max={inspectionMaxDate || undefined}
 onChange={(event) =>
 setInspectionCoordDrafts((prev) => ({
 ...prev,
 [req.id]: {
 ...prev[req.id],
 inspection_date: event.target.value,
 },
 }))
 }
 className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
 />
 <textarea
 rows={2}
 value={inspectionCoordinationDraft.notes ?? req.inspection_coordination_notes ?? ""}
 onChange={(event) =>
 setInspectionCoordDrafts((prev) => ({
 ...prev,
 [req.id]: {
 ...prev[req.id],
 notes: event.target.value,
 },
 }))
 }
 placeholder="Notas de coordinación (opcional)"
 className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
 />
 <Button
 size="sm"
 onClick={() => handleCoordinateInspection(req)}
 disabled={!inspectionMinDate || !inspectionMaxDate || selectedDateIsFull}
 >
 Proponer fecha a Jefe Técnico
 </Button>
 {inspectionMinDate && inspectionMaxDate && (
 <div className="rounded-lg border border-slate-200 bg-white p-2">
 <div className="mb-2 flex items-center justify-between">
 <button
 type="button"
 className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
 onClick={() =>
 setCalendarMonthByRequest((prev) => ({
 ...prev,
 [req.id]: new Date(
 calendarMonthStart.getFullYear(),
 calendarMonthStart.getMonth() - 1,
 1,
 ),
 }))
 }
 >
 ←
 </button>
 <p className="text-xs font-semibold text-slate-700">
 {calendarMonthStart.toLocaleString("es-ES", { month: "long", year: "numeric" })}
 </p>
 <button
 type="button"
 className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
 onClick={() =>
 setCalendarMonthByRequest((prev) => ({
 ...prev,
 [req.id]: new Date(
 calendarMonthStart.getFullYear(),
 calendarMonthStart.getMonth() + 1,
 1,
 ),
 }))
 }
 >
 →
 </button>
 </div>
 <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500">
 {["D", "L", "M", "X", "J", "V", "S"].map((name) => (
 <span key={`${req.id}-weekday-${name}`}>{name}</span>
 ))}
 </div>
 <div className="grid grid-cols-7 gap-1">
 {calendarDays.map((day) => {
 const isInWindow =
 day.iso >= inspectionMinDate &&
 day.iso <= inspectionMaxDate;
 const schedule = technicalScheduleDays.find((item) => item.date === day.iso);
 const isFull =
 Boolean(schedule && Array.isArray(schedule.items) && schedule.items.length >= 3);
 const isSelected = day.iso === selectedInspectionDate;
 const disabledDay = !day.inMonth || !isInWindow || isFull;
 return (
 <button
 key={`${req.id}-${day.iso}`}
 type="button"
 disabled={disabledDay}
 onClick={() =>
 setInspectionCoordDrafts((prev) => ({
 ...prev,
 [req.id]: {
 ...prev[req.id],
 inspection_date: day.iso,
 },
 }))
 }
 className={`h-8 rounded text-[11px] transition-colors ${
 isSelected
 ? "bg-blue-600 text-white"
 : disabledDay
 ? "bg-slate-100 text-slate-300 cursor-not-allowed"
 : "bg-slate-50 text-slate-700 hover:bg-blue-50"
 }`}
 title={
 isFull
 ? "Cronograma técnico lleno"
 : isInWindow
 ? `Seleccionar ${day.iso}`
 : "Fuera de ventana"
 }
 >
 {day.date.getDate()}
 </button>
 );
 })}
 </div>
 <p className="mt-2 text-[10px] text-slate-500">
 Gris: fuera de ventana. Bloqueado: cronograma lleno. Azul: fecha seleccionada.
 </p>
 </div>
 )}
 {selectedDateIsFull && (
 <p className="text-[11px] text-amber-700">
 Esa fecha ya tiene el cronograma técnico completo:{" "}
 {(selectedDateSchedule?.items || [])
 .map((entry) => entry.summary)
 .filter(Boolean)
 .slice(0, 2)
 .join(" · ")}
 </p>
 )}
 {blockedDatesInWindow.length > 0 && (
 <p className="text-[11px] text-slate-600">
 Fechas con cronograma completo en la ventana:{" "}
 {blockedDatesInWindow
 .slice(0, 4)
 .map((item) => item.date)
 .join(", ")}
 {blockedDatesInWindow.length > 4 ? "..." : ""}
 </p>
 )}
 </div>
 )}
 {canReviewInspectionCoordination &&
 req.status === "pending_contract" &&
 req.inspection_coordination_status === "pending_review" && (
 <div className="space-y-2 rounded border border-emerald-200 bg-emerald-50 p-2">
 <textarea
 rows={2}
 value={inspectionCoordinationDraft.review_notes ?? ""}
 onChange={(event) =>
 setInspectionCoordDrafts((prev) => ({
 ...prev,
 [req.id]: {
 ...prev[req.id],
 review_notes: event.target.value,
 },
 }))
 }
 placeholder="Comentario de validación (opcional)"
 className="w-full rounded border border-emerald-300 px-2 py-1.5 text-sm"
 />
 <div className="flex gap-2">
 <Button size="sm" onClick={() => handleReviewInspection(req, "accept")}>
 Aprobar fecha
 </Button>
 <Button size="sm" variant="ghost" onClick={() => handleReviewInspection(req, "reject")}>
 Rechazar fecha
 </Button>
 </div>
 </div>
 )}
 {req.status === "pending_contract" && publicPortalOutcome !== "won" && (
 <p className="text-[11px] text-slate-600">
 Debes registrar primero el resultado del portal público en "Ganado" para habilitar la inspección.
 </p>
 )}
 {!canCoordinateInspection &&
 !canReviewInspectionCoordination &&
 req.status === "pending_contract" && (
 <p className="text-[11px] text-slate-600">
 La fecha exacta de inspección es coordinada por Jefe Técnico.
 </p>
 )}
 </div>
 )}

 {showDeliverySummary && (
 <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
 <p className="text-[11px] uppercase tracking-wide text-slate-500">
 Entrega
 </p>
 <p className="text-xs text-slate-700">
 Ventana:{" "}
 <span className="font-medium">
 {req.delivery_start_at || "Pendiente"} - {req.delivery_end_at || "Pendiente"}
 </span>
 </p>
 <p className="text-xs text-slate-700">
 Arribo: <span className="font-medium">{req.equipment_arrived_at ? formatDateTimeEC(req.equipment_arrived_at) : "Pendiente"}</span>
 </p>
 <p className="text-xs text-slate-700">
 Despacho: <span className="font-medium">{req.dispatch_ready_at ? formatDateTimeEC(req.dispatch_ready_at) : "Pendiente"}</span>
 </p>
 <p className="text-xs text-slate-700">
 Entrega final: <span className="font-medium">{req.delivered_at ? formatDateTimeEC(req.delivered_at) : "Pendiente"}</span>
 </p>
 </div>
 )}

 {hasDocumentsSection && (
 <details className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
 <summary className="list-none cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600 flex items-center justify-between">
 <span className="inline-flex items-center gap-1.5">
 <FiFileText size={13} />
 Documentos
 </span>
 <span className="text-[10px] text-slate-500">
 {generatedDocuments.length + clientDocuments.length}
 </span>
 </summary>
 <div className="mt-3 space-y-3">
 {generatedDocuments.length > 0 && (
 <div>
 <p className="text-[11px] font-semibold text-slate-700 mb-1">Generados por el proceso</p>
 <div className="flex flex-wrap gap-2">
 {generatedDocuments.map((doc) => (
 <a
 key={`${req.id}-${doc.key}`}
 href={doc.link}
 target="_blank"
 rel="noreferrer"
 className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
 >
 {doc.label}
 </a>
 ))}
 </div>
 </div>
 )}
 {clientDocuments.length > 0 && (
 <div>
 <p className="text-[11px] font-semibold text-slate-700 mb-1">Documentos del cliente</p>
 <div className="flex flex-wrap gap-2">
 {clientDocuments.map((doc, idx) => (
 <a
 key={`${req.id}-client-doc-${doc.key || idx}`}
 href={doc.link}
 target="_blank"
 rel="noreferrer"
 className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
 >
 {doc.label}
 </a>
 ))}
 </div>
 </div>
 )}
 </div>
 </details>
 )}

 {expanded && providerResponse && (
 <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3">
 <div>
 <p className="text-[11px] uppercase tracking-wide text-slate-500">Respuesta del proveedor</p>
 <p className="text-sm font-semibold text-slate-900">{providerText}</p>
 {formattedResponseDate && (
 <p className="text-[10px] text-slate-500">{formattedResponseDate}</p>
 )}
 </div>
 {providerResponse.notes && (
 <p className="text-sm text-slate-700 whitespace-pre-line">{providerResponse.notes}</p>
 )}
 <div className="space-y-3">
 <p className="text-[10px] uppercase tracking-wide text-slate-500">{equipmentTitle}</p>
 <div className="space-y-2">
 {equipmentList.map((eq, idx) => {
 const eqName = typeof eq === "string" ? eq : (eq.name || eq.label || eq.sku || "Equipo");
 const requestedType = typeof eq === "object" ? eq.requested_type || eq.type : null;
 const availableType = typeof eq === "object" ? eq.available_type || eq.type : null;
 const decision = typeof eq === "object" ? eq.decision : null;
 const hasMismatch = requestedType && availableType && requestedType !== availableType;

 const typeBadge = (type, label) => (
 <span
 className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${type === 'new_available'
 ? 'bg-green-100 text-green-700'
 : type === 'new_import'
 ? 'bg-amber-100 text-amber-700'
 : type === 'cu'
 ? 'bg-blue-100 text-blue-700'
 : 'bg-gray-100 text-gray-600'
 }`}
 >
 {label}: {type === 'new_available'
 ? 'Nuevo disponible'
 : type === 'new_import'
 ? 'Nuevo para importación'
 : type === 'cu'
 ? 'CU'
 : 'Sin stock'}
 </span>
 );

 return (
 <div key={`${req.id}-${idx}`} className="rounded-md border border-slate-200 bg-white p-2.5">
 <p className="font-medium text-slate-900 text-sm">{eqName}</p>
 <div className="flex flex-wrap gap-2 mt-2">
 {requestedType && typeBadge(requestedType, "Solicitado")}
 {availableType && typeBadge(availableType, "Disponible")}
 {decision && (
 <span
 className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${decision === 'reject'
 ? 'bg-red-100 text-red-700 border border-red-200'
 : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
 }`}
 >
 {decision === "reject" ? "Rechazado" : "Aceptado"}
 </span>
 )}
 {hasMismatch && (
 <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
 Diferente a lo solicitado
 </span>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 {canAccessAttachments && (
 <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide">
 {req.proforma_file_link && (
 <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-800">Proforma</span>
 )}
 {req.signed_proforma_file_link && (
 <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-800">Proforma firmada</span>
 )}
 {req.contract_file_link && (
 <span className="px-2 py-1 rounded-full bg-green-50 text-green-800">Contrato</span>
 )}
 </div>
 )}
 </div>
 )}

 {
 <RequestActions
 request={req}
 isManager={canManageThisRequest}
 canAccessAttachments={canAccessAttachments}
 canUploadSignedProforma={canUploadSignedProforma}
 checklistState={req.checklist_state}
 providerContacts={meta.providerContacts || []}
 onRegisterProviderContact={handleRegisterProviderContact}
 savingProviderContact={savingProviderContact}
 availabilityDrafts={availabilityDrafts}
 inspectionDraft={inspectionDraft}
 onStartAvailability={handleStartAvailability}
 onOpenResponse={openResponse}
 onRequestProforma={() => handleRequestProforma(req)}
 onReserve={() => handleReserve(req)}
 onUploadSignedProforma={(_id, action, file) => handleUpload(req, action, file)}
 onUploadProforma={(_id, action, file) => handleUpload(req, action, file)}
 onUploadContract={(_id, action, file) => handleUpload(req, action, file)}
 onRequestDeliveryDates={() => handleRequestDeliveryDates(req)}
 onSubmitDeliveryDates={() => handleSubmitDeliveryDates(req)}
 onMarkEquipmentArrived={() => handleMarkEquipmentArrived(req)}
 onMarkDispatchReady={() => handleMarkDispatchReady(req)}
 onCompleteDelivery={() => handleCompleteDelivery(req)}
 deliveryDraft={deliveryDrafts[req.id] || {}}
 onUpdateDeliveryDraft={(requestId, field, value) => {
 setDeliveryDrafts((prev) => ({
 ...prev,
 [requestId]: { ...prev[requestId], [field]: value },
 }));
 }}
 onUpdateAvailabilityDraft={(requestId, field, value) => {
 setAvailabilityDrafts((prev) => ({
 ...prev,
 [requestId]: { ...prev[requestId], [field]: value },
 }));
 }}
 portalOutcomeDraft={portalOutcomeDrafts[req.id] || {}}
 onUpdatePortalOutcomeDraft={(requestId, field, value) => {
 setPortalOutcomeDrafts((prev) => ({
 ...prev,
 [requestId]: { ...prev[requestId], [field]: value },
 }));
 }}
 onRegisterPublicPortalOutcome={() => handleRegisterPublicPortalOutcome(req)}
 />
 }

 {req.checklist_state?.action && (
 <details className="mt-3 rounded-lg border border-slate-200 bg-white">
 <summary className="list-none cursor-pointer select-none px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-700">
 <span className="inline-flex items-center gap-1.5">
 <FiList size={13} />
 Checklist de validación
 </span>
 <span className="text-[11px] text-slate-500">
 {(req.checklist_state.pending || []).length > 0
 ? `${(req.checklist_state.pending || []).length} pendiente(s)`
 : "completo"}
 </span>
 </summary>
 <div className="px-3 pb-3 border-t border-slate-100">
 <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
 Paso: {toChecklistActionLabel(req.checklist_state.action)}
 </p>
 <div className="mt-2 space-y-1.5">
 {(req.checklist_state.items || [])
 .filter((item) => (req.checklist_state.requirements || []).includes(item.key))
 .map((item) => {
 return (
 <div key={`${req.id}-${item.key}`} className="flex items-center gap-2 text-sm">
 <input
 type="checkbox"
 checked={Boolean(item.checked)}
 disabled
 readOnly
 />
 <span className={item.checked ? "text-emerald-700 font-medium" : "text-slate-700"}>
 {item.label}
 </span>
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">auto</span>
 </div>
 );
 })}
 </div>
 {Array.isArray(req.checklist_state.pending) && req.checklist_state.pending.length > 0 && (
 <p className="mt-2 text-xs text-amber-700">
 El checklist se actualiza automáticamente según el avance del proceso.
 </p>
 )}
 </div>
 </details>
 )}
 </Card>
 );
 })}
 </div>
 )}
 </div>
 {allowProcessModals && inspectionModal.open && (
 <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
 <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
 <h3 className="text-lg font-semibold mb-4">Solicitud de Inspección de Ambiente</h3>

 <div className="space-y-4">
 <div>
 <p className="text-[11px] text-slate-500 mt-1">
 SPI autocompleta la solicitud técnica F.ST-20 y genera su PDF con la información de la compra.
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Fecha mínima de inspección <span className="text-red-500">*</span>
 </label>
 <input
 type="date"
 value={inspectionModal.minDate}
 onChange={(e) => setInspectionModal(prev => ({ ...prev, minDate: e.target.value }))}
 className="w-full border rounded-lg p-2"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Fecha máxima de inspección <span className="text-red-500">*</span>
 </label>
 <input
 type="date"
 value={inspectionModal.maxDate}
 onChange={(e) => setInspectionModal(prev => ({ ...prev, maxDate: e.target.value }))}
 className="w-full border rounded-lg p-2"
 />
 </div>

 <label className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={inspectionModal.includesKit}
 onChange={(e) => setInspectionModal(prev => ({ ...prev, includesKit: e.target.checked }))}
 />
 <span className="text-sm text-gray-700">Incluye kit de arranque</span>
 </label>
 </div>

 <div className="flex justify-end gap-3 mt-6">
 <Button
 variant="ghost"
 onClick={() => setInspectionModal({ open: false, requestId: null, minDate: "", maxDate: "", includesKit: false })}
 >
 Cancelar</Button>
 <Button onClick={handleSubmitInspection}>
 Registrar Inspección
 </Button>
 </div>
 </div>
 </div>
 )}
 {responseDraft.open && (
 <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
 <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-md">
 <h3 className="text-lg font-semibold">Respuesta del proveedor</h3>
 <div className="mt-3 space-y-3 text-sm">
 {responseDraft.items?.map((item, idx) => (
 <div key={item.id || idx} className="border rounded-lg p-3 bg-gray-50/60">
 <div className="flex justify-between items-center mb-2">
 <div>
 <p className="font-medium text-gray-800">{item.name}</p>
 <p className="text-xs text-gray-500">
 Solicitado: {
 item.requested_type === "cu"
 ? "CU"
 : item.requested_type === "new_import"
 ? "Nuevo para importación"
 : item.requested_type === "new_available" || item.requested_type === "new"
 ? "Nuevo disponible"
 : "Sin especificar"
 }
 </p>
 </div>
 {item.sku && <span className="text-[11px] text-gray-500">SKU: {item.sku}</span>}
 </div>
 <div className="space-y-1">
 {[
 { value: "new_available", label: "Nuevo disponible" },
 { value: "new_import", label: "Nuevo para importación" },
 { value: "cu", label: "CU" },
 { value: "none", label: "Sin stock" },
 ]
 .map((option) => (
 <label key={option.value} className="flex items-center gap-2">
 <input
 type="radio"
 name={`availability-${item.id}`}
 checked={item.available_type === option.value}
 onChange={() => {
 setResponseDraft((prev) => {
 const items = [...prev.items];
 items[idx] = {
 ...items[idx],
 available_type: option.value,
 decision: option.value === "none" ? "reject" : items[idx].decision,
 };
 return { ...prev, items };
 });
 }}
 />
 {option.label}
 </label>
 ))}
 </div>
 <div className="flex flex-wrap gap-2 mt-2">
 {[{ value: "accept", label: "Aceptar producto" }, { value: "reject", label: "Rechazar producto" }]
 .map((option) => {
 const disabled = option.value === "accept" && item.available_type === "none";
 return (
 <button
 key={option.value}
 type="button"
 onClick={() => {
 if (disabled) return;
 setResponseDraft((prev) => {
 const items = [...prev.items];
 items[idx] = { ...items[idx], decision: option.value };
 return { ...prev, items };
 });
 }}
 className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${item.decision === option.value
 ? option.value === "accept"
 ? "bg-emerald-100 text-emerald-700 border-emerald-200"
 : "bg-red-100 text-red-700 border-red-200"
 : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}
 ${disabled ? " opacity-50 cursor-not-allowed" : ""}`}
 disabled={disabled}
 >
 {option.label}
 </button>
 );
 })}
 </div>
 </div>
 ))}
 <textarea
 className="w-full border rounded p-2"
 rows={3}
 placeholder="Detalles del proveedor"
 value={responseDraft.notes}
 onChange={(e) => setResponseDraft((prev) => ({ ...prev, notes: e.target.value }))}
 />
 </div>
 <div className="flex justify-end gap-2 mt-4">
 <Button variant="ghost" onClick={() => setResponseDraft({ open: false, id: null, outcome: "new", notes: "", items: [] })}>
 Cancelar
 </Button>
 <Button onClick={submitResponse}>Guardar</Button>
 </div>
 </div>
 </div>
 )}
 </div>
 </>
 );
};

export default EquipmentPurchaseWidget;
