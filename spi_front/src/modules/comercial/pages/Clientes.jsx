import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
 FiCheckCircle,
 FiInfo,
 FiMail,
 FiMapPin,
 FiNavigation,
 FiSearch,
 FiUser,
 FiUsers,
 FiCalendar,
 FiEdit2,
 FiFileText,
 FiPhone,
} from "react-icons/fi";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/useUI";
import { useAuth } from "../../../core/auth/useAuth";
import {
 assignClient,
 endClientVisit,
 fetchClients,
 getClientDetail,
 setVisitStatus,
 startClientVisit,
 registerProspectVisit,
 updateClient
} from "../../../core/api/clientsApi";
import { getUsers } from "../../../core/api/usersApi";
import ClientApprovalsWidget from "../../backoffice/components/ClientApprovalsWidget";
import BackofficeClientRequestsKpiWidget from "../components/BackofficeClientRequestsKpiWidget";
import MyClientRequestsWidget from "../components/MyClientRequestsWidget";
import { RequestActionButton } from "../../../core/ui/components/RequestActionCards";

const todayStr = new Date().toISOString().slice(0, 10);

const ASSIGN_CLIENT_ROLES = new Set([
 "jefe_comercial",
 "gerencia",
 "gerente",
 "admin",
 "administrador",
 "ti",
]);

const FULL_ACCESS_ROLES = new Set([
 "acp_comercial",
 "backoffice",
 "backoffice_comercial",
 "jefe_comercial",
 "gerencia",
 "gerente",
 "admin",
 "administrador",
 "ti",
]);
const ADVISOR_ROLES = new Set(["comercial", "acp_comercial", "backoffice"]);
const VISIT_ALLOWED_ROLES = new Set([...FULL_ACCESS_ROLES, ...ADVISOR_ROLES]);
const BACKOFFICE_PANEL_ROLES = new Set(["backoffice", "backoffice_comercial"]);
const ACP_COMMERCIAL_ROLES = new Set(["acp_comercial"]);
const CHECKIN_CARDS_HIDDEN_ROLES = new Set([
 "acp_comercial",
 "backoffice_comercial",
 "jefe_comercial",
]);
const ASSIGNABLE_ADVISOR_ROLES = new Set(["comercial", "acp_comercial", "backoffice", "backoffice_comercial"]);

const normalizeStatus = (status) => {
 const value = (status || "").toLowerCase();
 if (["visited", "visitado"].includes(value)) return "visitado";
 if (["en_visita", "in_visit", "in_progress"].includes(value)) return "en_visita";
 return "pendiente";
};

const STATUS_STYLES = {
 pendiente: {
 label: "Pendiente",
 chip: "bg-gray-100 text-gray-700",
 led: "bg-gray-300",
 },
 en_visita: {
 label: "En visita",
 chip: "bg-blue-50 text-blue-700",
 led: "bg-blue-500",
 },
 visitado: {
 label: "Visitado",
 chip: "bg-green-50 text-green-700",
 led: "bg-green-500",
 },
};

const ClientesPage = () => {
 const { showToast } = useUI();
 const { role, user } = useAuth();
 const normalizedRole =
 (role || user?.role || user?.role_name || user?.scope || "").toLowerCase();
 const roleTokens = (normalizedRole || "")
 .split(/[\s,|]+/)
 .map((token) => token.trim())
 .filter(Boolean);
 const hasAnyRole = useCallback((allowedRoles) => roleTokens.some((token) => allowedRoles.has(token)), [roleTokens]);
 const canAssignClients = hasAnyRole(ASSIGN_CLIENT_ROLES);
 const canManageAllClients = hasAnyRole(FULL_ACCESS_ROLES);
 const canVisitClients = hasAnyRole(VISIT_ALLOWED_ROLES);
 const isBackofficeUser = hasAnyRole(BACKOFFICE_PANEL_ROLES);
 const isAcpCommercial = hasAnyRole(ACP_COMMERCIAL_ROLES);
 const isCommercialOnly = roleTokens.includes("comercial") && !canManageAllClients;
 const currentEmail = user?.email?.toLowerCase?.() || "";

 const [clientes, setClientes] = useState([]);
 const [registeredClients, setRegisteredClients] = useState([]);
 const [loading, setLoading] = useState(false);
 const [assignments, setAssignments] = useState({});
 const [advisors, setAdvisors] = useState([]);
 const [activeClient, setActiveClient] = useState(null);
 const [modalType, setModalType] = useState(null); // start | end | report
 const [visitModal, setVisitModal] = useState({
 timestamp: null,
 coords: null,
 note: "",
 loadingLocation: false,
 error: null,
 });
 const [submittingVisit, setSubmittingVisit] = useState(false);
 const [statusFilter, setStatusFilter] = useState("all"); // all | pending | visited
 const [assignedViewFilter, setAssignedViewFilter] = useState("assigned");
 const [assignedSearch, setAssignedSearch] = useState("");
 const [filterBySchedule, setFilterBySchedule] = useState(true);
 const [selectedDate, setSelectedDate] = useState(todayStr);
 const [summary, setSummary] = useState({});
 const [temporaryAssignmentsFilter, setTemporaryAssignmentsFilter] = useState("all"); // all | expiring_today | expiring_7
 const [albumSearch, setAlbumSearch] = useState("");
 const [showAllClients, setShowAllClients] = useState(false);
 const [allClientsSearch, setAllClientsSearch] = useState("");
 const [expandedTimeline, setExpandedTimeline] = useState({});
 const [reprogramModal, setReprogramModal] = useState({
 isOpen: false,
 client: null,
 date: todayStr,
 note: "",
 submitting: false,
 });
 const [editDetail, setEditDetail] = useState(null);
 const [editLoading, setEditLoading] = useState(false);
 const [editSubmitting, setEditSubmitting] = useState(false);
 const [editForm, setEditForm] = useState({});
 const [editFiles, setEditFiles] = useState({});
 const clientsCacheRef = useRef(new Map());

 const getStatusMeta = (status) => STATUS_STYLES[normalizeStatus(status)] || STATUS_STYLES.pendiente;

 const formatTime = (value) =>
 value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

 const formatDuration = (minutes) => {
 if (minutes === null || typeof minutes === "undefined") return "—";
 if (minutes < 60) return `${minutes} min`;
 const hrs = Math.floor(minutes / 60);
 const mins = minutes % 60;
 return `${hrs}h ${mins}m`;
 };

 const calculateDuration = (client) => {
 if (!client?.hora_entrada || !client?.hora_salida) return null;
 const diffMs = new Date(client.hora_salida) - new Date(client.hora_entrada);
 return Math.max(0, Math.round(diffMs / 60000));
 };

 const formatClientType = (type) => {
 const value = (type || "").toLowerCase();
 if (value === "persona_juridica" || value.includes("jurid")) return "Persona Jurídica";
 if (value === "persona_natural" || value.includes("natur")) return "Persona Natural";
 if (value === "sub_distribuidor" || value.includes("sub_dis")) return "Sub distribuidor";
 return "Tipo no especificado";
 };

 const parseAddressParts = (address) =>
 (address || "")
 .split(",")
 .map((s) => s.trim())
 .filter(Boolean);

 const getCityFromAddress = (address) => {
 const parts = parseAddressParts(address);
 if (parts.length >= 2) return parts[parts.length - 2];
 return parts[0] || "Ciudad no especificada";
 };

 const getProvinceFromAddress = (address) => {
 const parts = parseAddressParts(address);
 if (parts.length >= 1) return parts[parts.length - 1];
 return "Provincia no especificada";
 };

 // Helper para normalizar asignados a un array siempre
 const normalizeAsignados = (asignados) => {
 if (Array.isArray(asignados)) return asignados;
 if (typeof asignados === "string") {
 try {
 const parsed = JSON.parse(asignados);
 return Array.isArray(parsed) ? parsed : [];
 } catch (e) {
 return [];
 }
 }
 return [];
 };

 const normalizeAssignmentDetails = (assignmentDetails) => {
 if (Array.isArray(assignmentDetails)) return assignmentDetails;
 if (typeof assignmentDetails === "string") {
 try {
 const parsed = JSON.parse(assignmentDetails);
 return Array.isArray(parsed) ? parsed : [];
 } catch (e) {
 return [];
 }
 }
 return [];
 };

 const getTemporaryAssignmentInfo = useCallback((client) => {
 const details = normalizeAssignmentDetails(client?.assignment_details);
 const now = new Date();
 let nearest = null;

 details.forEach((item) => {
 if (!item?.is_temporary || !item?.ends_at) return;
 const endDate = new Date(item.ends_at);
 if (Number.isNaN(endDate.getTime())) return;
 if (!nearest || endDate < nearest.endDate) {
 const diffMs = endDate.getTime() - now.getTime();
 nearest = {
 endDate,
 daysRemaining: Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
 assignment: item,
 };
 }
 });

 return nearest;
 }, []);

 const formatAssignment = (assignment) => {
 const email = assignment?.assigned_to_email || assignment?.email || "sin-correo";
 const name = assignment?.assigned_to_name || email;
 const isTemporary = Boolean(assignment?.is_temporary);
 const endsAt = assignment?.ends_at ? new Date(assignment.ends_at) : null;
 if (isTemporary && endsAt && !Number.isNaN(endsAt.getTime())) {
 return `${name} (temporal hasta ${endsAt.toLocaleDateString()})`;
 }
 return name;
 };

 const captureLocation = () =>
 new Promise((resolve, reject) => {
 if (typeof navigator === "undefined" || !navigator.geolocation) {
 console.error("DEBUG: Navigator o geolocation no existen");
 showToast("Geolocalización no soportada", "error");
 reject(new Error("La geolocalización no está disponible"));
 return;
 }

 console.log("DEBUG: Iniciando captureLocation...");
 console.log("DEBUG: Configuración -> Timeout: 30000ms, MaxAge: 300000ms, HighAccuracy: true");
 showToast("Obteniendo ubicación...", "info");

 navigator.geolocation.getCurrentPosition(
 (pos) => {
 const { latitude, longitude, accuracy } = pos.coords;
 console.log(`DEBUG: Ubicación obtenida! Lat: ${latitude}, Lng: ${longitude}, Acc: ${accuracy}m`);
 resolve({ latitude, longitude });
 },
 (err) => {
 console.error("DEBUG: Error en getCurrentPosition:", err);
 console.error(`DEBUG: Error Code: ${err.code}, Message: ${err.message}`);

 let msg = "No se pudo obtener la ubicación.";
 if (err.code === 1) msg = "Permiso denegado. Habilita la ubicación.";
 if (err.code === 2) msg = "Señal GPS débil o no disponible.";
 if (err.code === 3) msg = "Tiempo de espera agotado (30s). Intenta en exteriores.";

 showToast(msg, "warning");
 reject(new Error(msg));
 },
 { enableHighAccuracy: true, timeout: 30000, maximumAge: 300000 }
 );
 });

 const loadAdvisors = async () => {
 try {
 const users = await getUsers();
 const usersArray = Array.isArray(users) ? users : [];
 const filtered = usersArray.filter((u) => ASSIGNABLE_ADVISOR_ROLES.has(u.role?.toLowerCase?.()));
 setAdvisors(Array.isArray(filtered) ? filtered : []);
 } catch (error) {
 console.error(error);
 setAdvisors([]);
 }
 };

 const loadClientes = useCallback(async ({ forceRefresh = false } = {}) => {
 const cacheKey = `${currentEmail}|${selectedDate}|${filterBySchedule ? "1" : "0"}`;
 if (!forceRefresh) {
 const cached = clientsCacheRef.current.get(cacheKey);
 if (cached) {
 setClientes(cached.clients);
 setRegisteredClients(cached.registeredClients);
 setSummary(cached.summary);
 return;
 }
 }

 setLoading(true);
 try {
 const result = await fetchClients({
 date: selectedDate,
 include_schedule_info: true,
 filter_by_schedule: filterBySchedule,
 });

 let loadedClients = [];
 let loadedProspects = [];
 let loadedSummary = {};

 if (Array.isArray(result)) {
 loadedClients = result;
 } else {
 loadedClients = Array.isArray(result?.clients) ? result.clients : [];
 // Map prospects to client-like structure
 loadedProspects = (Array.isArray(result?.prospects) ? result.prospects : []).map(p => ({
 ...p,
 id: p.id, // Keep original ID, handled by different API call
 nombre: p.prospect_name,
 visit_status: p.status, // 'in_visit' | 'visited'
 identificador: "PROSPECTO",
 shipping_address: "Ubicación registrada en visita",
 shipping_city: "—",
 shipping_province: "—",
 client_type: "Prospecto",
 is_prospect: true,
 // Map timestamps for standard display
 hora_entrada: p.check_in_time,
 hora_salida: p.check_out_time,
 lat_entrada: p.check_in_lat,
 lng_entrada: p.check_in_lng,
 lat_salida: p.check_out_lat,
 lng_salida: p.check_out_lng,
 duracion_minutos: null, // Calculate on fly or add to DB if needed
 // Ensure they show in "assigned" and "created" filters
 created_by: currentEmail,
 asignados: [currentEmail]
 }));
 loadedSummary = result?.summary || {};
 }

 setClientes([...loadedProspects, ...loadedClients]);
 setRegisteredClients(loadedClients);
 setSummary(loadedSummary);
 clientsCacheRef.current.set(cacheKey, {
 clients: [...loadedProspects, ...loadedClients],
 registeredClients: loadedClients,
 summary: loadedSummary,
 });
 // Solo mostrar alerta de cronograma si es comercial puro (no backoffice, no acp, no jefe)
 // Si no hay cronograma aprobado, se desactiva el filtro para mostrar cartera completa.
 if (filterBySchedule && !loadedSummary?.has_approved_schedule && isCommercialOnly) {
 setFilterBySchedule(false);
 showToast(
 "No tienes un cronograma aprobado para este mes. Se mostrará tu cartera completa.",
 "info",
 );
 return;
 }

 } catch (error) {
 console.error(error);
 showToast("No pudimos cargar tus clientes", "error");
 setClientes([]);
 setRegisteredClients([]);
 setSummary({});
 } finally {
 setLoading(false);
 }
 }, [filterBySchedule, selectedDate, showToast, currentEmail, isCommercialOnly]);

 useEffect(() => {
 loadClientes();
 }, [filterBySchedule, loadClientes]);

 useEffect(() => {
 if (canAssignClients) loadAdvisors();
 }, [canAssignClients]);

 useEffect(() => {
 if (isAcpCommercial || canManageAllClients) {
 setFilterBySchedule(false);
 setStatusFilter("all");
 }
 }, [isAcpCommercial, canManageAllClients]);

 const visitedCount = useMemo(() => {
 if (typeof summary?.visited === "number") return summary.visited;
 if (!Array.isArray(clientes)) return 0;
 return clientes.filter((c) => normalizeStatus(c.visit_status) === "visitado").length;
 }, [clientes, summary]);

 const pendingCount = useMemo(() => {
 if (typeof summary?.pending === "number") return summary.pending;
 if (!Array.isArray(clientes)) return 0;
 return clientes.filter((c) => normalizeStatus(c.visit_status) !== "visitado").length;
 }, [clientes, summary]);

 const commercialKpi = useMemo(() => {
 const base = Array.isArray(clientes) ? clientes.filter((c) => !c.is_prospect) : [];
 const plannedToday = Number(summary?.planned_today || 0);
 const effective = base.filter((c) => c.hora_entrada && c.hora_salida);
 const avgDuration =
 effective.length > 0
 ? Math.round(
 effective.reduce((acc, c) => acc + (c.duracion_minutos ?? calculateDuration(c) ?? 0), 0) /
 effective.length,
 )
 : 0;

 return {
 plannedToday,
 visited: visitedCount,
 effectiveVisits: effective.length,
 compliance: plannedToday > 0 ? Math.round((visitedCount / plannedToday) * 100) : null,
 avgDuration,
 };
 }, [clientes, summary, visitedCount]);

 const filteredClientes = useMemo(() => {
 if (!Array.isArray(clientes)) return [];
 let base = clientes;

 if (statusFilter === "pending") {
 base = base.filter((c) => normalizeStatus(c.visit_status) !== "visitado");
 } else if (statusFilter === "visited") {
 base = base.filter((c) => normalizeStatus(c.visit_status) === "visitado");
 }

 if (temporaryAssignmentsFilter === "expiring_today") {
 base = base.filter((c) => {
 const tempInfo = getTemporaryAssignmentInfo(c);
 return tempInfo && tempInfo.daysRemaining <= 0;
 });
 } else if (temporaryAssignmentsFilter === "expiring_7") {
 base = base.filter((c) => {
 const tempInfo = getTemporaryAssignmentInfo(c);
 return tempInfo && tempInfo.daysRemaining >= 0 && tempInfo.daysRemaining <= 7;
 });
 }

 return base;
 }, [clientes, statusFilter, temporaryAssignmentsFilter, getTemporaryAssignmentInfo]);

 const invalidateClientsCache = () => {
 clientsCacheRef.current.clear();
 };

 const assignedToMe = useMemo(() => {
 if (!Array.isArray(clientes)) return [];
 return clientes.filter((c) => {
 const asignados = normalizeAsignados(c.asignados);
 return asignados.some((mail) => (mail || "").toLowerCase?.() === currentEmail);
 });
 }, [clientes, currentEmail]);

 const createdByMe = useMemo(() => {
 if (!Array.isArray(clientes)) return [];
 return clientes.filter(
 (c) => (c.created_by || "").toLowerCase?.() === currentEmail,
 );
 }, [clientes, currentEmail]);

 const allMine = useMemo(() => {
 if (!Array.isArray(clientes)) return [];
 const seen = new Set();
 const merged = [];
 [...assignedToMe, ...createdByMe].forEach((client) => {
 if (!seen.has(client.id)) {
 seen.add(client.id);
 merged.push(client);
 }
 });
 return merged;
 }, [clientes, assignedToMe, createdByMe]);

 const albumClients = useMemo(() => {
 if (!Array.isArray(registeredClients)) return [];
 let base = registeredClients;

 if (!canManageAllClients) {
 base = base.filter((c) => {
 const assigned = normalizeAsignados(c.asignados);
 const isAssigned = assigned.some((mail) => (mail || "").toLowerCase?.() === currentEmail);
 const isCreator = (c.created_by || "").toLowerCase?.() === currentEmail;
 return isAssigned || isCreator;
 });
 }

 if (!albumSearch) return base.slice(0, 12);
 const q = albumSearch.toLowerCase();
 return base.filter((c) => {
 const haystack = `${c.nombre || ""} ${c.commercial_name || ""} ${c.identificador || ""} ${c.ruc_cedula || ""} ${c.shipping_contact_name || ""}`.toLowerCase();
 return haystack.includes(q);
 });
 }, [registeredClients, canManageAllClients, currentEmail, albumSearch]);

 const allAlbumClients = useMemo(() => {
 if (!Array.isArray(registeredClients)) return [];
 if (canManageAllClients) return registeredClients;
 return registeredClients.filter((c) => {
 const assigned = normalizeAsignados(c.asignados);
 const isAssigned = assigned.some((mail) => (mail || "").toLowerCase?.() === currentEmail);
 const isCreator = (c.created_by || "").toLowerCase?.() === currentEmail;
 return isAssigned || isCreator;
 });
 }, [registeredClients, canManageAllClients, currentEmail]);

 const filteredAllAlbumClients = useMemo(() => {
 if (!Array.isArray(allAlbumClients)) return [];
 if (!allClientsSearch) return allAlbumClients;
 const q = allClientsSearch.toLowerCase();
 return allAlbumClients.filter((c) => {
 const haystack = `${c.nombre || ""} ${c.commercial_name || ""} ${c.identificador || ""} ${c.ruc_cedula || ""} ${c.shipping_contact_name || ""}`.toLowerCase();
 return haystack.includes(q);
 });
 }, [allAlbumClients, allClientsSearch]);

 const filteredAssignedList = useMemo(() => {
 let base = assignedToMe;

 if (assignedViewFilter === "created") {
 base = createdByMe;
 } else if (assignedViewFilter === "all") {
 base = allMine;
 }

 if (!assignedSearch) return base;
 const q = assignedSearch.toLowerCase();
 return base.filter((c) => {
 const haystack = `${c.nombre || ""} ${c.identificador || ""} ${c.shipping_contact_name || ""} ${c.shipping_address || ""}`.toLowerCase();
 return haystack.includes(q);
 });
 }, [assignedViewFilter, assignedToMe, createdByMe, allMine, assignedSearch]);

 const handleAssign = async (clientId) => {
 const assignment = assignments[clientId] || {};
 const email = assignment.email || "";
 if (!email) {
 showToast("Selecciona un asesor para asignar", "warning");
 return;
 }
 if (assignment.temporary && !assignment.ends_at) {
 showToast("Para asignación temporal debes seleccionar fecha de fin", "warning");
 return;
 }
 try {
 await assignClient(clientId, {
 assignee_email: email,
 temporary: Boolean(assignment.temporary),
 ends_at: assignment.temporary ? assignment.ends_at : undefined,
 reason: assignment.reason || undefined,
 });
 showToast(
 assignment.temporary ? "Cliente reasignado temporalmente" : "Cliente asignado",
 "success",
 );
 setAssignments((prev) => ({ ...prev, [clientId]: {} }));
 invalidateClientsCache();
 loadClientes({ forceRefresh: true });
 } catch (error) {
 console.error(error);
 showToast("No se pudo asignar el cliente", "error");
 }
 };

 const openVisitFlow = async (client, mode) => {
 const timestamp = new Date();
 setActiveClient(client);
 setModalType(mode);
 setVisitModal({ timestamp, coords: null, note: "", loadingLocation: true, error: null });

 try {
 const coords = await captureLocation();
 setVisitModal((prev) => ({ ...prev, coords, loadingLocation: false }));
 } catch (error) {
 console.error(error);
 setVisitModal((prev) => ({
 ...prev,
 loadingLocation: false,
 error: error?.message || "No pudimos obtener tu ubicación",
 }));
 showToast("No pudimos obtener tu ubicación", "warning");
 }
 };

 const openReportModal = (client) => {
 setActiveClient(client);
 setModalType("report");
 };

 const openReprogramModal = (client) => {
 setReprogramModal({
 isOpen: true,
 client,
 date: selectedDate || todayStr,
 note: "",
 submitting: false,
 });
 };

 const closeReprogramModal = () => {
 setReprogramModal({
 isOpen: false,
 client: null,
 date: todayStr,
 note: "",
 submitting: false,
 });
 };

 const handleReprogramVisit = async () => {
 if (!reprogramModal?.client?.id || !reprogramModal?.date) return;
 setReprogramModal((prev) => ({ ...prev, submitting: true }));
 try {
 await setVisitStatus(reprogramModal.client.id, {
 status: "pending",
 date: reprogramModal.date,
 observaciones: reprogramModal.note || null,
 });
 showToast("Visita reprogramada correctamente", "success");
 invalidateClientsCache();
 await loadClientes({ forceRefresh: true });
 closeReprogramModal();
 } catch (error) {
 console.error(error);
 showToast("No se pudo reprogramar la visita", "error");
 setReprogramModal((prev) => ({ ...prev, submitting: false }));
 }
 };

 const closeModal = () => {
 setActiveClient(null);
 setModalType(null);
 setVisitModal({ timestamp: null, coords: null, note: "", loadingLocation: false, error: null });
 setEditDetail(null);
 setEditForm({});
 setEditFiles({});
 setEditLoading(false);
 setEditSubmitting(false);
 };

 const openEditModal = async (client) => {
 setActiveClient(client);
 setModalType("edit");
 setEditLoading(true);
 setEditDetail(null);
 setEditFiles({});

 try {
 const detail = await getClientDetail(client.id);
 setEditDetail(detail);
 setEditForm({
 client_type: detail?.client_type || "",
 legal_person_business_name: detail?.legal_person_business_name || "",
 nationality: detail?.nationality || "",
 natural_person_firstname: detail?.natural_person_firstname || "",
 natural_person_lastname: detail?.natural_person_lastname || "",
 commercial_name: detail?.commercial_name || detail?.nombre || "",
 establishment_name: detail?.establishment_name || "",
 ruc_cedula: detail?.ruc_cedula || detail?.identificador || "",
 establishment_province: detail?.establishment_province || "",
 establishment_city: detail?.establishment_city || "",
 establishment_address: detail?.establishment_address || "",
 establishment_reference: detail?.establishment_reference || "",
 establishment_phone: detail?.establishment_phone || "",
 establishment_cellphone: detail?.establishment_cellphone || "",
 legal_rep_name: detail?.legal_rep_name || "",
 legal_rep_position: detail?.legal_rep_position || "",
 legal_rep_id_document: detail?.legal_rep_id_document || "",
 legal_rep_cellphone: detail?.legal_rep_cellphone || "",
 legal_rep_email: detail?.legal_rep_email || "",
 shipping_contact_name: detail?.shipping_contact_name || "",
 shipping_address: detail?.shipping_address || "",
 shipping_city: detail?.shipping_city || "",
 shipping_province: detail?.shipping_province || "",
 shipping_reference: detail?.shipping_reference || "",
 shipping_phone: detail?.shipping_phone || "",
 shipping_cellphone: detail?.shipping_cellphone || "",
 shipping_delivery_hours: detail?.shipping_delivery_hours || "",
 operating_permit_status: detail?.operating_permit_status || "",
 });
 } catch (error) {
 console.error(error);
 showToast("No pudimos cargar el detalle del cliente", "error");
 } finally {
 setEditLoading(false);
 }
 };

 const handleEditChange = (key, value) => {
 setEditForm((prev) => ({ ...prev, [key]: value }));
 };

 const handleEditFile = (key, file) => {
 setEditFiles((prev) => ({ ...prev, [key]: file }));
 };

 const handleEditSubmit = async (e) => {
 e.preventDefault();
 if (!activeClient) return;

 const limitedPayload = {
 commercial_name: editForm.commercial_name,
 shipping_contact_name: editForm.shipping_contact_name,
 shipping_phone: editForm.shipping_phone,
 shipping_cellphone: editForm.shipping_cellphone,
 };

 const payload = canManageAllClients ? editForm : limitedPayload;
 const files = canManageAllClients ? editFiles : {};

 setEditSubmitting(true);
 try {
 const updated = await updateClient(activeClient.id, payload, files);
 setRegisteredClients((prev) =>
 Array.isArray(prev)
 ? prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
 : prev,
 );
 setClientes((prev) =>
 Array.isArray(prev)
 ? prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
 : prev,
 );
 setEditDetail(updated);
 showToast("Cliente actualizado correctamente", "success");
 invalidateClientsCache();
 closeModal();
 } catch (error) {
 console.error(error);
 showToast("No se pudo actualizar el cliente", "error");
 } finally {
 setEditSubmitting(false);
 }
 };

 const handleConfirmVisit = async () => {
 if (!activeClient || (modalType !== "start" && modalType !== "end")) return;
 if (modalType === "end" && !activeClient.hora_entrada) {
 showToast("No puedes finalizar una visita que no ha iniciado", "warning");
 return;
 }

 const timestamp = visitModal.timestamp || new Date();
 const coords = visitModal.coords;
 const payload =
 modalType === "start"
 ? {
 hora_entrada: timestamp.toISOString(),
 lat_entrada: coords?.latitude,
 lng_entrada: coords?.longitude,
 observaciones: visitModal.note,
 }
 : {
 hora_salida: timestamp.toISOString(),
 lat_salida: coords?.latitude,
 lng_salida: coords?.longitude,
 observaciones: visitModal.note,
 };

 setSubmittingVisit(true);
 try {
 let response;
 if (activeClient.is_prospect) {
 if (modalType === "start") {
 response = await registerProspectVisit({
 prospect_name: activeClient.nombre || activeClient.prospect_name || "Prospecto",
 check_in_time: payload.hora_entrada,
 check_in_lat: payload.lat_entrada,
 check_in_lng: payload.lng_entrada,
 observations: payload.observaciones,
 });
 } else {
 response = await registerProspectVisit({
 visit_id: activeClient.id,
 check_out_time: payload.hora_salida,
 check_out_lat: payload.lat_salida,
 check_out_lng: payload.lng_salida,
 observations: payload.observaciones,
 });
 }
 } else {
 const apiCall = modalType === "start" ? startClientVisit : endClientVisit;
 response = await apiCall(activeClient.id, payload);
 }

 const durationFromApi = response?.duracion_minutos ?? response?.data?.duracion_minutos;

 const updated = {
 ...activeClient,
 ...payload,
 visit_status: modalType === "start" ? "en_visita" : "visitado",
 };

 if (modalType === "end") {
 const computed = durationFromApi ?? calculateDuration(updated);
 if (typeof computed === "number") updated.duracion_minutos = computed;
 }

 setClientes((prev) => {
 if (!Array.isArray(prev)) return [];
 return prev.map((c) => (c.id === activeClient.id ? updated : c));
 });
 setActiveClient(updated);
 showToast(modalType === "start" ? "Visita iniciada" : "Visita finalizada", "success");
 invalidateClientsCache();
 closeModal();
 } catch (error) {
 console.error(error);
 showToast("No pudimos registrar la visita", "error");
 } finally {
 setSubmittingVisit(false);
 }
 };

 const renderCard = (cliente) => {
 const status = normalizeStatus(cliente.visit_status);
 const meta = getStatusMeta(status);
 const duration = cliente.duracion_minutos ?? calculateDuration(cliente);
 const temporaryInfo = getTemporaryAssignmentInfo(cliente);
 const assignmentDetails = normalizeAssignmentDetails(cliente.assignment_details);
 const asignadosArray = normalizeAsignados(cliente.asignados);
 const assigned =
 assignmentDetails.length > 0
 ? assignmentDetails.map(formatAssignment).join(", ")
 : asignadosArray.length > 0
 ? asignadosArray.join(", ")
 : "Sin asignar";
 const timelineOpen = Boolean(expandedTimeline[cliente.id]);
 const hasEntryCoords = cliente.lat_entrada && cliente.lng_entrada;
 const hasExitCoords = cliente.lat_salida && cliente.lng_salida;
 const isPlanned = cliente.scheduled_info?.is_planned;

 return (
 <div
 key={cliente.id}
 className="relative flex flex-col rounded-none border border-gray-100 border-x-0 bg-white/90 p-4 shadow-none backdrop-blur transition cursor-pointer sm:rounded-2xl sm:border sm:bg-white/80 sm:shadow-sm sm:hover:shadow-md sm:hover:-translate-y-0.5"
 onClick={() => openReportModal(cliente)}
 >
 {isPlanned && (
 <span className="absolute top-3 left-3 px-2 py-1 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
 <FiCalendar size={12} />
 Planificado
 </span>
 )}
 {temporaryInfo && (
 <span className="absolute top-3 left-24 px-2 py-1 bg-amber-500 text-white text-xs rounded-full">
 {temporaryInfo.daysRemaining <= 0
 ? "Temporal vencida"
 : `Temporal vence en ${temporaryInfo.daysRemaining}d`}
 </span>
 )}
 <span className={`absolute top-3 right-3 h-2.5 w-2.5 rounded-full ${meta.led}`} />

 <div className="flex items-start justify-between gap-3">
 <div className="space-y-1">
 <p className="text-sm font-semibold text-gray-900">{cliente.nombre}</p>
 <p className="text-xs text-gray-500 flex items-center gap-1">
 <FiMapPin className="text-gray-400" /> {cliente.shipping_address || "Sin dirección"}
 </p>
 <p className="text-[11px] text-gray-400">ID #{cliente.id}</p>
 </div>
 <span className={`px-2 py-[2px] text-xs font-semibold rounded-full ${meta.chip}`}>
 {meta.label}
 </span>
 </div>

 <div className="mt-3 space-y-2 text-sm text-gray-700">
 <div className="flex items-center justify-between text-xs text-gray-600">
 <span>Entrada</span>
 <span className="font-semibold text-gray-800">{formatTime(cliente.hora_entrada)}</span>
 </div>
 <div className="flex items-center justify-between text-xs text-gray-600">
 <span>Salida</span>
 <span className="font-semibold text-gray-800">{formatTime(cliente.hora_salida)}</span>
 </div>
 <div className="flex items-center justify-between text-xs text-gray-600">
 <span>Duración</span>
 <span className="font-semibold text-gray-800">{formatDuration(duration)}</span>
 </div>
 <p className="text-xs text-gray-600">
 <span className="font-semibold text-gray-700">Asignado:</span> {assigned}
 </p>
 </div>

 <div className="mt-4 flex flex-wrap gap-2">
 {status === "pendiente" && (
 <Button
 className="flex-1"
 icon={FiMapPin}
 onClick={(e) => {
 e.stopPropagation();
 openVisitFlow(cliente, "start");
 }}
 >
 Iniciar visita
 </Button>
 )}
 {status === "en_visita" && (
 <Button
 className="flex-1"
 icon={FiCheckCircle}
 onClick={(e) => {
 e.stopPropagation();
 openVisitFlow(cliente, "end");
 }}
 >
 Finalizar visita
 </Button>
 )}
 {status === "visitado" && (
 <Button
 className="flex-1"
 variant="secondary"
 icon={FiInfo}
 onClick={(e) => {
 e.stopPropagation();
 openReportModal(cliente);
 }}
 >
 Ver reporte
 </Button>
 )}
 {status !== "visitado" && (
 <Button
 variant="ghost"
 icon={FiInfo}
 className="px-3 py-2"
 onClick={(e) => {
 e.stopPropagation();
 openReportModal(cliente);
 }}
 >
 Detalles
 </Button>
 )}
 {!cliente.is_prospect && (
 <Button
 variant="ghost"
 className="px-3 py-2"
 onClick={(e) => {
 e.stopPropagation();
 openReprogramModal(cliente);
 }}
 >
 Reprogramar
 </Button>
 )}
 </div>

 <div className="mt-3 flex flex-wrap gap-2 text-xs">
 {hasEntryCoords && (
 <a
 href={`https://www.google.com/maps?q=${cliente.lat_entrada},${cliente.lng_entrada}`}
 target="_blank"
 rel="noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50"
 >
 Ver ubicación entrada
 </a>
 )}
 {hasExitCoords && (
 <a
 href={`https://www.google.com/maps?q=${cliente.lat_salida},${cliente.lng_salida}`}
 target="_blank"
 rel="noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50"
 >
 Ver ubicación salida
 </a>
 )}
 </div>

 <div className="mt-3 border-t border-gray-100 pt-3">
 <button
 type="button"
 className="text-xs font-semibold text-blue-700 hover:underline"
 onClick={(e) => {
 e.stopPropagation();
 setExpandedTimeline((prev) => ({ ...prev, [cliente.id]: !prev[cliente.id] }));
 }}
 >
 {timelineOpen ? "Ocultar timeline" : "Ver timeline"}
 </button>
 {timelineOpen && (
 <div className="mt-2 space-y-1 text-xs text-gray-600">
 <p>Entrada: {formatTime(cliente.hora_entrada)}</p>
 <p>Salida: {formatTime(cliente.hora_salida)}</p>
 <p>Duración: {formatDuration(duration)}</p>
 <p>Observación: {cliente.observaciones || "Sin observaciones"}</p>
 </div>
 )}
 </div>

 {canAssignClients && (
 <div className="mt-4 flex flex-col gap-2 rounded-lg bg-gray-50 p-3" onClick={(e) => e.stopPropagation()}>
 <p className="text-xs font-semibold text-gray-700">Reasignar asesor</p>
 <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
 <select
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 value={assignments[cliente.id]?.email || ""}
 onChange={(e) =>
 setAssignments((prev) => ({
 ...prev,
 [cliente.id]: {
 ...(prev[cliente.id] || {}),
 email: e.target.value,
 },
 }))
 }
 >
 <option value="">Selecciona asesor</option>
 {Array.isArray(advisors) && advisors.map((u) => (
 <option key={u.id} value={u.email}>
 {u.fullname || u.name || u.email}
 </option>
 ))}
 </select>
 <label className="inline-flex items-center gap-2 text-xs text-gray-700">
 <input
 type="checkbox"
 checked={Boolean(assignments[cliente.id]?.temporary)}
 onChange={(e) =>
 setAssignments((prev) => ({
 ...prev,
 [cliente.id]: {
 ...(prev[cliente.id] || {}),
 temporary: e.target.checked,
 ends_at: e.target.checked ? prev[cliente.id]?.ends_at : "",
 },
 }))
 }
 />
 Asignación temporal
 </label>
 {Boolean(assignments[cliente.id]?.temporary) && (
 <input
 type="date"
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 value={assignments[cliente.id]?.ends_at || ""}
 onChange={(e) =>
 setAssignments((prev) => ({
 ...prev,
 [cliente.id]: {
 ...(prev[cliente.id] || {}),
 ends_at: e.target.value,
 },
 }))
 }
 />
 )}
 <Button onClick={() => handleAssign(cliente.id)}>Asignar</Button>
 </div>
 </div>
 )}
 </div>
 );
 };

 const renderAlbumCard = (cliente) => {
 const clientName = cliente.commercial_name || cliente.nombre || "Cliente sin nombre";
 const identifier = cliente.identificador || cliente.ruc_cedula || "Identificador no disponible";
 const address = cliente.shipping_address || "Direccion no disponible";
 const contactName = cliente.shipping_contact_name || "Sin contacto";
 const contactPhone = cliente.shipping_phone || cliente.shipping_cellphone || "Sin telefono";
 const assignmentDetails = normalizeAssignmentDetails(cliente.assignment_details);
 const asignadosArray = normalizeAsignados(cliente.asignados);
 const assigned =
 assignmentDetails.length > 0
 ? assignmentDetails.map(formatAssignment).join(", ")
 : asignadosArray.length > 0
 ? asignadosArray.join(", ")
 : "Sin asignar";

 return (
 <div
 key={`album-${cliente.id}`}
 className="flex flex-col rounded-none border border-gray-100 border-x-0 bg-white/95 p-4 shadow-none transition sm:rounded-2xl sm:border sm:bg-white/90 sm:shadow-sm"
 >
 <div className="flex items-start justify-between gap-3">
 <div className="space-y-1">
 <p className="text-sm font-semibold text-gray-900">{clientName}</p>
 <p className="text-xs text-gray-500">{identifier}</p>
 </div>
 <span className="rounded-full bg-emerald-50 px-2 py-[2px] text-xs font-semibold text-emerald-700">
 Aprobado
 </span>
 </div>

 <div className="mt-3 space-y-2 text-xs text-gray-700">
 <p className="flex items-center gap-1 text-gray-600">
 <FiMapPin className="text-gray-400" /> {address}
 </p>
 <p className="flex items-center gap-1 text-gray-600">
 <FiUser className="text-gray-400" /> {contactName}
 </p>
 <p className="flex items-center gap-1 text-gray-600">
 <FiPhone className="text-gray-400" /> {contactPhone}
 </p>
 <p className="text-gray-600">
 <span className="font-semibold text-gray-700">Asignado:</span> {assigned}
 </p>
 </div>

 <div className="mt-4 flex flex-wrap items-center gap-2">
 <Button
 variant="secondary"
 className="px-3 py-1.5 text-xs"
 onClick={() => openEditModal(cliente)}
 >
 <FiEdit2 className="mr-1" /> Editar
 </Button>
 {canManageAllClients && (
 <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
 <FiFileText /> Documentos disponibles
 </span>
 )}
 </div>
 </div>
 );
 };

 const showVisitFlow = canVisitClients;
 const canSeeCheckInOutCards = showVisitFlow && !hasAnyRole(CHECKIN_CARDS_HIDDEN_ROLES);
 const canSeeDailyManagedClients = showVisitFlow && roleTokens.includes("comercial");

 return (
 <div className="space-y-4 sm:space-y-6 pb-6 px-3 sm:px-0">
 <header className="space-y-4">
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
 <FiUsers className="text-blue-600" /> Gestión de Clientes
 </h1>
 <p className="text-xs sm:text-sm text-gray-500 max-w-xl">
 Clientes aprobados que puedes gestionar, con enfoque en tu ruta diaria de visitas.
 </p>
 </div>
 </div>

 {isBackofficeUser ? (
 <>
 <BackofficeClientRequestsKpiWidget />
 <ClientApprovalsWidget />
 </>
 ) : isAcpCommercial ? (
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div>
 <h2 className="text-lg font-semibold text-gray-900">
 Vista global de clientes
 </h2>
 <p className="text-sm text-gray-500">
 Puedes revisar todos los clientes aprobados y sus asignaciones comerciales.
 </p>
 </div>
 <div className="flex items-center gap-3">
 <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
 {allAlbumClients.length} clientes
 </div>
 <div className="relative">
 <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
 <input
 type="text"
 value={assignedSearch}
 onChange={(e) => setAssignedSearch(e.target.value)}
 placeholder="Buscar cliente..."
 className="w-56 rounded-full border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm text-gray-700 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
 />
 </div>
 </div>
 </div>
 ) : (
 <>
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
 <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
 <RequestActionButton type="CLIENT" size="xs" className="w-full sm:w-auto" />
 <Button
 variant="secondary"
 onClick={() => setModalType("prospect")}
 className="w-full sm:w-auto text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2"
 >
 Visita Prospecto
 </Button>
 </div>
 <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2 sm:min-w-[210px]">
 <label className="text-gray-700 text-xs sm:text-sm">Fecha</label>
 <input
 type="date"
 value={selectedDate}
 onChange={(e) => setSelectedDate(e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs sm:w-[180px] sm:px-3 sm:py-2 sm:text-sm"
 />
 </div>
 </div>
 <div className="flex items-start gap-2 sm:items-center">
 <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-700 sm:items-center sm:text-sm">
 <input
 type="checkbox"
 checked={filterBySchedule}
 onChange={(e) => setFilterBySchedule(e.target.checked)}
 className="rounded"
 />
 <span>Mostrar solo clientes planificados</span>
 </label>
 </div>
 </div>

 {summary?.has_approved_schedule && (
 <Card className="rounded-none border-x-0 border-blue-200 bg-blue-50 p-4 shadow-none sm:rounded-3xl sm:border sm:shadow-[0_15px_35px_rgba(15,23,42,0.08)]">
 <div className="flex items-center justify-between">
 <div>
 <h4 className="font-semibold text-blue-900 flex items-center gap-2">
 <FiCalendar /> Planificación de Hoy
 </h4>
 <p className="text-sm text-blue-700 mt-1">
 {(summary.cities_today || []).join(", ") || "Ciudades"}
 </p>
 </div>
 <div className="text-right">
 <p className="text-2xl font-bold text-blue-900">{summary.planned_today || 0}</p>
 <p className="text-xs text-blue-600">clientes planificados</p>
 </div>
 </div>

 <div className="mt-3">
 <div className="flex items-center justify-between text-sm">
 <span className="text-blue-700">Progreso</span>
 <span className="font-semibold text-blue-900">
 {visitedCount} / {summary.planned_today || 0}
 </span>
 </div>
 <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
 <div
 className="bg-blue-600 h-2 rounded-full transition-all"
 style={{
 width: `${summary.planned_today
 ? Math.min(100, (visitedCount / summary.planned_today) * 100)
 : 0}%`,
 }}
 />
 </div>
 </div>
 </Card>
 )}

 <MyClientRequestsWidget
 total={summary?.planned_today ?? (Array.isArray(clientes) ? clientes.length : 0)}
 visited={visitedCount}
 pending={pendingCount}
 onFilterChange={setStatusFilter}
 />

 {isCommercialOnly && (
 <Card className="rounded-none border-x-0 p-4 shadow-none sm:rounded-3xl sm:border sm:shadow-[0_15px_35px_rgba(15,23,42,0.08)]">
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
 <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
 <p className="text-xs font-semibold text-emerald-700">Cumplimiento plan</p>
 <p className="mt-1 text-xl font-bold text-emerald-900">
 {commercialKpi.compliance === null ? "N/A" : `${commercialKpi.compliance}%`}
 </p>
 </div>
 <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
 <p className="text-xs font-semibold text-blue-700">Visitas efectivas</p>
 <p className="mt-1 text-xl font-bold text-blue-900">{commercialKpi.effectiveVisits}</p>
 </div>
 <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
 <p className="text-xs font-semibold text-indigo-700">Promedio en sitio</p>
 <p className="mt-1 text-xl font-bold text-indigo-900">{formatDuration(commercialKpi.avgDuration)}</p>
 </div>
 </div>
 </Card>
 )}
 </>
 )}
 </header>

 {
 showVisitFlow && (
 <>
 {canSeeCheckInOutCards && (
 <Card className="rounded-none border-x-0 p-4 shadow-none sm:rounded-3xl sm:border sm:p-5 sm:shadow-[0_15px_35px_rgba(15,23,42,0.08)] space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div>
 <h2 className="text-lg font-semibold text-gray-900">Tarjetas de clientes para check-in/check-out</h2>
 <p className="text-sm text-gray-500">
 Usa las tarjetas para iniciar o finalizar visita y consulta el detalle completo de cada cliente.
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => setTemporaryAssignmentsFilter("all")}
 className={`rounded-full px-3 py-1 text-xs font-semibold ${
 temporaryAssignmentsFilter === "all"
 ? "bg-gray-900 text-white"
 : "bg-gray-100 text-gray-700"
 }`}
 >
 Todas
 </button>
 <button
 type="button"
 onClick={() => setTemporaryAssignmentsFilter("expiring_7")}
 className={`rounded-full px-3 py-1 text-xs font-semibold ${
 temporaryAssignmentsFilter === "expiring_7"
 ? "bg-amber-600 text-white"
 : "bg-amber-100 text-amber-800"
 }`}
 >
 Temporales (7d)
 </button>
 <button
 type="button"
 onClick={() => setTemporaryAssignmentsFilter("expiring_today")}
 className={`rounded-full px-3 py-1 text-xs font-semibold ${
 temporaryAssignmentsFilter === "expiring_today"
 ? "bg-red-600 text-white"
 : "bg-red-100 text-red-800"
 }`}
 >
 Vencen hoy
 </button>
 </div>
 </div>

 {Array.isArray(filteredClientes) && filteredClientes.length > 0 ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
 {filteredClientes.map((cliente) => renderCard(cliente))}
 </div>
 ) : (
 <div className="py-10 text-center text-gray-500">
 {loading ? "Cargando clientes..." : "No se encontraron clientes"}
 </div>
 )}
 </Card>
 )}

 {/* Widget: Clientes asignados / registrados por mí (solo comercial) */}
 {canSeeDailyManagedClients && (
 <Card className="rounded-none border-x-0 p-4 shadow-none sm:rounded-3xl sm:border sm:p-5 sm:shadow-[0_15px_35px_rgba(15,23,42,0.08)] space-y-4">
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div>
 <h2 className="text-lg font-semibold text-gray-900">
 Mis clientes de gestión diaria
 </h2>
 <p className="text-sm text-gray-500">
 Revisa rápidamente los clientes que tienes asignados, que tú mismo registraste o el conjunto de todos.
 </p>
 </div>
 <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
 Vista solo para tu usuario
 </div>
 </div>

 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div className="flex w-full flex-wrap rounded-full bg-gray-100 p-1 text-xs font-medium text-gray-700 sm:w-auto">
 <button
 type="button"
 onClick={() => setAssignedViewFilter("assigned")}
 className={`px-3 py-1 rounded-full transition ${assignedViewFilter === "assigned"
 ? "bg-white shadow-sm text-gray-900"
 : "text-gray-500"
 }`}
 >
 Asignados a mí ({Array.isArray(assignedToMe) ? assignedToMe.length : 0})
 </button>
 <button
 type="button"
 onClick={() => setAssignedViewFilter("created")}
 className={`px-3 py-1 rounded-full transition ${assignedViewFilter === "created"
 ? "bg-white shadow-sm text-gray-900"
 : "text-gray-500"
 }`}
 >
 Registrados por mí ({Array.isArray(createdByMe) ? createdByMe.length : 0})
 </button>
 <button
 type="button"
 onClick={() => setAssignedViewFilter("all")}
 className={`px-3 py-1 rounded-full transition ${assignedViewFilter === "all"
 ? "bg-white shadow-sm text-gray-900"
 : "text-gray-500"
 }`}
 >
 Todos mis clientes ({Array.isArray(allMine) ? allMine.length : 0})
 </button>
 </div>

 <div className="relative w-full md:max-w-xs">
 <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
 <input
 type="text"
 placeholder="Buscar por nombre, RUC o ciudad..."
 value={assignedSearch}
 onChange={(e) => setAssignedSearch(e.target.value)}
 className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
 />
 </div>
 </div>

 {Array.isArray(filteredAssignedList) && filteredAssignedList.length > 0 ? (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
 {filteredAssignedList.map((cliente) => {
 const ciudad = cliente.shipping_city || getCityFromAddress(cliente.shipping_address);
 const provincia = cliente.shipping_province || getProvinceFromAddress(cliente.shipping_address);
 const clienteEmail = cliente.client_email || "Correo no disponible";
 const clientTypeLabel = formatClientType(cliente.client_type);
 const status = normalizeStatus(cliente.visit_status);
 const meta = getStatusMeta(status);
 return (
 <div
 key={`mini-${cliente.id}`}
 className="flex flex-col rounded-none border border-gray-100 border-x-0 bg-white/90 p-3 shadow-none transition cursor-pointer sm:rounded-xl sm:border sm:bg-white/80 sm:shadow-sm sm:hover:shadow-md"
 onClick={() => openReportModal(cliente)}
 >
 <div className="flex items-start justify-between gap-2">
 <div className="space-y-0.5">
 <p className="text-sm font-semibold text-gray-900 line-clamp-1">
 {cliente.nombre}
 </p>
 </div>
 <span className={`px-2 py-[1px] text-[10px] font-semibold rounded-full ${meta.chip}`}>
 {meta.label}
 </span>
 </div>

 <div className="mt-2 space-y-1 text-[11px] text-gray-600">
 <p className="flex items-center gap-1">
 <FiMail className="h-3 w-3 text-gray-400" />
 <span className="truncate">{clienteEmail}</span>
 </p>
 <p className="flex items-center gap-1">
 <FiUser className="h-3 w-3 text-gray-400" />
 {clientTypeLabel}
 </p>
 <p className="flex items-center gap-1">
 <FiMapPin className="h-3 w-3 text-gray-400" />
 {provincia || "Provincia no especificada"}
 </p>
 <p className="flex items-center gap-1">
 <FiMapPin className="h-3 w-3 text-gray-400" />
 {ciudad || "Ciudad no especificada"}
 </p>
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <p className="text-sm text-gray-500">
 {assignedViewFilter === "assigned"
 ? "No tienes clientes asignados que coincidan con el filtro."
 : assignedViewFilter === "created"
 ? "No tienes clientes registrados por ti que coincidan con el filtro."
 : "No tienes clientes asignados o registrados por ti que coincidan con el filtro."}
 </p>
 )}
 </Card>
 )}
 </>
 )
 }

 <Card className="rounded-none border-x-0 p-4 shadow-none sm:rounded-3xl sm:border sm:p-5 sm:shadow-[0_15px_35px_rgba(15,23,42,0.08)] space-y-4">
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div>
 <h2 className="text-lg font-semibold text-gray-900">
 Clientes registrados
 </h2>
 <p className="text-sm text-gray-500">
 Gestiona clientes aprobados. Puedes editar nombre comercial y contacto; los roles avanzados pueden ver documentos.
 </p>
 </div>
 <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
 <div className="relative w-full md:max-w-xs">
 <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
 <input
 type="text"
 placeholder="Buscar cliente..."
 value={albumSearch}
 onChange={(e) => setAlbumSearch(e.target.value)}
 className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
 />
 </div>
 <p className="text-xs text-gray-500 md:max-w-xs">
 Ingresa aquí el nombre del cliente que deseas encontrar.
 </p>
 <Button
 variant="secondary"
 className="w-full md:w-auto"
 onClick={() => setShowAllClients(true)}
 >
 Ver todos los clientes
 </Button>
 </div>
 </div>

 {Array.isArray(albumClients) && albumClients.length > 0 ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
 {albumClients.map((cliente) => renderAlbumCard(cliente))}
 </div>
 ) : (
 <div className="py-10 text-center text-gray-500">
 {loading
 ? "Cargando clientes..."
 : albumSearch
 ? "No se encontraron clientes con ese criterio."
 : "Mostrando tus clientes más recientes. Usa el buscador para filtrar."}
 </div>
 )}
 </Card>

 <Modal
 isOpen={showAllClients}
 onClose={() => setShowAllClients(false)}
 title="Todos los clientes registrados"
 maxWidth="max-w-5xl"
 >
 <div className="space-y-4">
 <div className="relative w-full md:max-w-sm">
 <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
 <input
 type="text"
 placeholder="Buscar cliente..."
 value={allClientsSearch}
 onChange={(e) => setAllClientsSearch(e.target.value)}
 className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
 />
 </div>

 {Array.isArray(filteredAllAlbumClients) && filteredAllAlbumClients.length > 0 ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
 {filteredAllAlbumClients.map((cliente) => renderAlbumCard(cliente))}
 </div>
 ) : (
 <div className="py-10 text-center text-gray-500">
 {loading
 ? "Cargando clientes..."
 : allClientsSearch
 ? "No se encontraron clientes con ese criterio."
 : "No hay clientes para mostrar"}
 </div>
 )}
 </div>
 </Modal>

 <Modal
 isOpen={reprogramModal.isOpen}
 onClose={reprogramModal.submitting ? undefined : closeReprogramModal}
 title={`Reprogramar visita${reprogramModal.client?.nombre ? `: ${reprogramModal.client.nombre}` : ""}`}
 maxWidth="max-w-md"
 >
 <div className="space-y-4">
 <div className="space-y-1">
 <label className="text-sm font-medium text-gray-700">Nueva fecha</label>
 <input
 type="date"
 value={reprogramModal.date}
 min={todayStr}
 onChange={(e) => setReprogramModal((prev) => ({ ...prev, date: e.target.value }))}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-sm font-medium text-gray-700">Nota (opcional)</label>
 <textarea
 rows={3}
 value={reprogramModal.note}
 onChange={(e) => setReprogramModal((prev) => ({ ...prev, note: e.target.value }))}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 placeholder="Motivo de la reprogramación"
 />
 </div>
 <div className="flex justify-end gap-3 pt-2">
 <Button variant="secondary" onClick={closeReprogramModal} disabled={reprogramModal.submitting}>
 Cancelar
 </Button>
 <Button
 onClick={handleReprogramVisit}
 isLoading={reprogramModal.submitting}
 disabled={!reprogramModal.date || reprogramModal.submitting}
 >
 Confirmar
 </Button>
 </div>
 </div>
 </Modal>

 {/* Modal de visita normal (usuario registrado) */}
 <Modal
 isOpen={!!activeClient && (modalType === "start" || modalType === "end")}
 onClose={submittingVisit ? undefined : closeModal}
 title={modalType === "start" ? "Iniciar visita a cliente" : "Finalizar visita y reportar"}
 maxWidth="max-w-md"
 >
 <div className="space-y-4">
 <p className="text-sm text-gray-600">
 {modalType === "start"
 ? `Estás a punto de iniciar la visita a ${activeClient?.nombre}. Se registrará tu ubicación y hora de entrada.`
 : `Finaliza la visita a ${activeClient?.nombre}. Puedes agregar observaciones finales.`}
 </p>

 <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
 <div className="flex justify-between">
 <span>Fecha:</span>
 <span className="font-medium text-gray-900">
 {visitModal.timestamp?.toLocaleDateString()}
 </span>
 </div>
 <div className="flex justify-between">
 <span>Hora:</span>
 <span className="font-medium text-gray-900">
 {formatTime(visitModal.timestamp)}
 </span>
 </div>
 {visitModal.loadingLocation ? (
 <div className="flex items-center gap-2 text-blue-600">
 <FiNavigation className="animate-spin" /> Obteniendo ubicación...
 </div>
 ) : visitModal.coords ? (
 <div className="flex items-center gap-2 text-green-600">
 <FiMapPin />{" "}
 {`${visitModal.coords.latitude.toFixed(5)}, ${visitModal.coords.longitude.toFixed(5)}`}
 </div>
 ) : (
 <div className="text-red-500">Ubicación no disponible</div>
 )}
 </div>

 <div className="space-y-1">
 <label className="text-sm font-medium text-gray-700">Observaciones (opcional)</label>
 <textarea
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
 rows={3}
 placeholder="Escribe aquí notas sobre la visita..."
 value={visitModal.note}
 onChange={(e) => setVisitModal((prev) => ({ ...prev, note: e.target.value }))}
 />
 </div>

 <div className="flex justify-end gap-3 pt-2">
 <Button
 variant="secondary"
 onClick={closeModal}
 disabled={submittingVisit}
 >
 Cancelar
 </Button>
 <Button
 onClick={handleConfirmVisit}
 disabled={submittingVisit || visitModal.loadingLocation || !visitModal.coords}
 isLoading={submittingVisit}
 >
 {modalType === "start" ? "Confirmar inicio" : "Confirmar finalización"}
 </Button>
 </div>
 </div>
 </Modal>

 {/* Modal de visita a PROSPECTO */}
 <Modal
 isOpen={modalType === "prospect"}
 onClose={submittingVisit ? undefined : closeModal}
 title="Visita a Prospecto (No registrado)"
 maxWidth="max-w-md"
 >
 <ProspectVisitForm
 onClose={closeModal}
 onSuccess={() => {
 showToast("Visita a prospecto registrada", "success");
 closeModal();
 invalidateClientsCache();
 loadClientes({ forceRefresh: true });
 }}
 captureLocation={captureLocation}
 />
 </Modal>

 {/* Modal de edicion de cliente */}
 <Modal
 isOpen={modalType === "edit" && !!activeClient}
 onClose={editSubmitting ? undefined : closeModal}
 title={`Editar cliente: ${editDetail?.commercial_name || activeClient?.nombre || ""}`}
 maxWidth="max-w-4xl"
 >
 {editLoading ? (
 <div className="py-6 text-center text-sm text-gray-500">Cargando detalle...</div>
 ) : (
 <form onSubmit={handleEditSubmit} className="space-y-6">
 <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
 <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Datos principales</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Nombre comercial</label>
 <input
 type="text"
 value={editForm.commercial_name || ""}
 onChange={(e) => handleEditChange("commercial_name", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Contacto principal</label>
 <input
 type="text"
 value={editForm.shipping_contact_name || ""}
 onChange={(e) => handleEditChange("shipping_contact_name", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Telefono</label>
 <input
 type="text"
 value={editForm.shipping_phone || ""}
 onChange={(e) => handleEditChange("shipping_phone", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Celular</label>
 <input
 type="text"
 value={editForm.shipping_cellphone || ""}
 onChange={(e) => handleEditChange("shipping_cellphone", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 </div>
 </div>

 {canManageAllClients && (
 <>
 <div className="rounded-xl border border-gray-100 bg-white p-4">
 <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Informacion legal</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Tipo de cliente</label>
 <select
 value={editForm.client_type || ""}
 onChange={(e) => handleEditChange("client_type", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 >
 <option value="">Selecciona...</option>
 <option value="persona_juridica">Persona juridica</option>
 <option value="persona_natural">Persona natural</option>
 <option value="sub_distribuidor">Sub distribuidor</option>
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">RUC / Cedula</label>
 <input
 type="text"
 value={editForm.ruc_cedula || ""}
 onChange={(e) => handleEditChange("ruc_cedula", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Razon social</label>
 <input
 type="text"
 value={editForm.legal_person_business_name || ""}
 onChange={(e) => handleEditChange("legal_person_business_name", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Nombre establecimiento</label>
 <input
 type="text"
 value={editForm.establishment_name || ""}
 onChange={(e) => handleEditChange("establishment_name", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 </div>
 </div>

 <div className="rounded-xl border border-gray-100 bg-white p-4">
 <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Direccion de establecimiento</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Provincia</label>
 <input
 type="text"
 value={editForm.establishment_province || ""}
 onChange={(e) => handleEditChange("establishment_province", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Ciudad</label>
 <input
 type="text"
 value={editForm.establishment_city || ""}
 onChange={(e) => handleEditChange("establishment_city", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1 sm:col-span-2">
 <label className="text-xs font-semibold text-gray-600">Direccion</label>
 <input
 type="text"
 value={editForm.establishment_address || ""}
 onChange={(e) => handleEditChange("establishment_address", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1 sm:col-span-2">
 <label className="text-xs font-semibold text-gray-600">Referencia</label>
 <input
 type="text"
 value={editForm.establishment_reference || ""}
 onChange={(e) => handleEditChange("establishment_reference", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 </div>
 </div>

 <div className="rounded-xl border border-gray-100 bg-white p-4">
 <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Representante legal</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Nombre</label>
 <input
 type="text"
 value={editForm.legal_rep_name || ""}
 onChange={(e) => handleEditChange("legal_rep_name", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Cargo</label>
 <input
 type="text"
 value={editForm.legal_rep_position || ""}
 onChange={(e) => handleEditChange("legal_rep_position", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Cedula</label>
 <input
 type="text"
 value={editForm.legal_rep_id_document || ""}
 onChange={(e) => handleEditChange("legal_rep_id_document", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Email</label>
 <input
 type="email"
 value={editForm.legal_rep_email || ""}
 onChange={(e) => handleEditChange("legal_rep_email", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Celular</label>
 <input
 type="text"
 value={editForm.legal_rep_cellphone || ""}
 onChange={(e) => handleEditChange("legal_rep_cellphone", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 </div>
 </div>

 <div className="rounded-xl border border-gray-100 bg-white p-4">
 <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Direccion de envio</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1 sm:col-span-2">
 <label className="text-xs font-semibold text-gray-600">Direccion</label>
 <input
 type="text"
 value={editForm.shipping_address || ""}
 onChange={(e) => handleEditChange("shipping_address", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Provincia</label>
 <input
 type="text"
 value={editForm.shipping_province || ""}
 onChange={(e) => handleEditChange("shipping_province", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Ciudad</label>
 <input
 type="text"
 value={editForm.shipping_city || ""}
 onChange={(e) => handleEditChange("shipping_city", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1 sm:col-span-2">
 <label className="text-xs font-semibold text-gray-600">Referencia</label>
 <input
 type="text"
 value={editForm.shipping_reference || ""}
 onChange={(e) => handleEditChange("shipping_reference", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Horario de entrega</label>
 <input
 type="text"
 value={editForm.shipping_delivery_hours || ""}
 onChange={(e) => handleEditChange("shipping_delivery_hours", e.target.value)}
 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
 />
 </div>
 </div>
 </div>

 <div className="rounded-xl border border-gray-100 bg-white p-4">
 <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Documentos</h4>
 {Array.isArray(editDetail?.attachments) && editDetail.attachments.length > 0 ? (
 <div className="mb-4 space-y-2 text-xs">
 {editDetail.attachments.map((doc) => (
 <a
 key={doc.key}
 href={doc.link}
 target="_blank"
 rel="noreferrer"
 className="inline-flex items-center gap-2 text-blue-600 hover:underline"
 >
 <FiFileText /> {doc.label}
 </a>
 ))}
 </div>
 ) : (
 <p className="text-xs text-gray-500 mb-4">No hay documentos cargados.</p>
 )}

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Documento de identificacion (PDF)</label>
 <input
 type="file"
 accept="application/pdf,image/*"
 onChange={(e) => handleEditFile("id_file", e.target.files?.[0])}
 className="w-full text-xs"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">RUC (PDF)</label>
 <input
 type="file"
 accept="application/pdf,image/*"
 onChange={(e) => handleEditFile("ruc_file", e.target.files?.[0])}
 className="w-full text-xs"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Permiso de funcionamiento</label>
 <input
 type="file"
 accept="application/pdf,image/*"
 onChange={(e) => handleEditFile("operating_permit_file", e.target.files?.[0])}
 className="w-full text-xs"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Nombramiento representante legal</label>
 <input
 type="file"
 accept="application/pdf,image/*"
 onChange={(e) => handleEditFile("legal_rep_appointment_file", e.target.files?.[0])}
 className="w-full text-xs"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-600">Evidencia LOPDP</label>
 <input
 type="file"
 accept="application/pdf,image/*"
 onChange={(e) => handleEditFile("consent_evidence_file", e.target.files?.[0])}
 className="w-full text-xs"
 />
 </div>
 </div>
 </div>
 </>
 )}

 <div className="flex justify-end gap-3 pt-2">
 <Button variant="secondary" onClick={closeModal} disabled={editSubmitting}>
 Cancelar
 </Button>
 <Button type="submit" isLoading={editSubmitting}>
 Guardar cambios
 </Button>
 </div>
 </form>
 )}
 </Modal>

 {/* Modal de reporte final */}
 <Modal
 isOpen={modalType === "report" && !!activeClient}
 onClose={closeModal}
 title={`Reporte de visita: ${activeClient?.nombre}`}
 maxWidth="max-w-2xl"
 >
 <div className="space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-500 uppercase">Cliente</label>
 <p className="text-sm font-medium text-gray-900">{activeClient?.nombre}</p>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-500 uppercase">Identificación</label>
 <p className="text-sm text-gray-900">{activeClient?.identificador || "N/A"}</p>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-500 uppercase">Visita</label>
 <div className="flex items-center gap-2">
 <span className={`h-2 w-2 rounded-full ${getStatusMeta(activeClient?.visit_status).led}`} />
 <span className="text-sm text-gray-900">{getStatusMeta(activeClient?.visit_status).label}</span>
 </div>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-gray-500 uppercase">Duración</label>
 <p className="text-sm text-gray-900">
 {formatDuration(activeClient?.duracion_minutos ?? calculateDuration(activeClient))}
 </p>
 </div>
 </div>

 <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
 <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Tiempos y Ubicación</h4>
 <div className="space-y-3">
 <div className="flex justify-between items-center text-sm">
 <span className="text-gray-600">Entrada:</span>
 <span className="font-medium text-gray-900">{formatTime(activeClient?.hora_entrada)}</span>
 </div>
 {activeClient?.lat_entrada && (
 <div className="flex justify-end">
 <a
 href={`https://www.google.com/maps?q=${activeClient.lat_entrada},${activeClient.lng_entrada}`}
 target="_blank"
 rel="noreferrer"
 className="text-xs text-blue-600 hover:underline flex items-center gap-1"
 >
 <FiMapPin /> Ver ubicación
 </a>
 </div>
 )}
 <div className="border-t border-gray-200 my-2" />
 <div className="flex justify-between items-center text-sm">
 <span className="text-gray-600">Salida:</span>
 <span className="font-medium text-gray-900">{formatTime(activeClient?.hora_salida)}</span>
 </div>
 {activeClient?.lat_salida && (
 <div className="flex justify-end">
 <a
 href={`https://www.google.com/maps?q=${activeClient.lat_salida},${activeClient.lng_salida}`}
 target="_blank"
 rel="noreferrer"
 className="text-xs text-blue-600 hover:underline flex items-center gap-1"
 >
 <FiMapPin /> Ver ubicación
 </a>
 </div>
 )}
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-xs font-semibold text-gray-500 uppercase">Observaciones</label>
 <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 min-h-[80px]">
 {activeClient?.observaciones || "Sin observaciones registradas."}
 </div>
 </div>

 <div className="flex justify-end pt-2">
 <Button variant="secondary" onClick={closeModal}>
 Cerrar
 </Button>
 </div>
 </div>
 </Modal>
 </div >
 );
};

const ProspectVisitForm = ({ onClose, onSuccess, captureLocation }) => {
 const [name, setName] = useState("");
 const [note, setNote] = useState("");
 const [loading, setLoading] = useState(false);
 const [locating, setLocating] = useState(false);

 const handleSubmit = async (e) => {
 e.preventDefault();
 if (!name.trim()) return;

 setLoading(true);
 setLocating(true);
 try {
 const coords = await captureLocation();
 setLocating(false);

 await registerProspectVisit({
 prospect_name: name,
 check_in_time: new Date().toISOString(),
 check_in_lat: coords.latitude,
 check_in_lng: coords.longitude,
 observations: note,
 });

 onSuccess();
 } catch (error) {
 console.error(error);
 setLocating(false);
 } finally {
 setLoading(false);
 }
 };

 return (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700">Nombre del Laboratorio / Prospecto</label>
 <input
 autoFocus
 type="text"
 value={name}
 onChange={e => setName(e.target.value)}
 className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
 placeholder="Ej. Laboratorio Clínico Central"
 required
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700">Observaciones</label>
 <textarea
 value={note}
 onChange={e => setNote(e.target.value)}
 className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
 placeholder="Contactos, dirección, interés..."
 rows={3}
 />
 </div>
 <div className="flex justify-end gap-3 pt-2">
 <Button variant="secondary" onClick={onClose} disabled={loading}>
 Cancelar
 </Button>
 <Button type="submit" isLoading={loading} disabled={!name.trim()}>
 {locating ? "Obteniendo ubicación..." : "Registrar Visita"}
 </Button>
 </div>
 </form>
 );
};

export default ClientesPage;
