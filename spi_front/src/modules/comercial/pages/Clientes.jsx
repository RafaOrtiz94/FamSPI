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
 FiAlertCircle,
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
import LocationManager from "../components/LocationManager";
import { formatDateSafe } from "../../../shared/utils/dateUtils";

const todayStr = new Date().toISOString().slice(0, 10);

const ASSIGN_CLIENT_ROLES = new Set([
 "jefe_comercial",
 "jefe_de_comercial",
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
const ADVISOR_ROLES = new Set([
 "comercial",
 "asesor_comercial",
 "acp_comercial",
 "backoffice",
 "backoffice_comercial",
]);
const VISIT_ALLOWED_ROLES = new Set([...FULL_ACCESS_ROLES, ...ADVISOR_ROLES]);
const BACKOFFICE_PANEL_ROLES = new Set(["backoffice", "backoffice_comercial"]);
const ACP_COMMERCIAL_ROLES = new Set(["acp_comercial"]);
const CHECKIN_CARDS_HIDDEN_ROLES = new Set([
 "acp_comercial",
 "backoffice_comercial",
 "jefe_comercial",
]);
const ASSIGNABLE_ADVISOR_ROLES = new Set([
 "comercial",
 "asesor_comercial",
 "asesor",
 "ejecutivo_comercial",
 "acp_comercial",
 "backoffice",
 "backoffice_comercial",
]);
const PASSIVE_EMPLOYMENT_STATUSES = new Set(["pasivo", "desvinculado", "inactivo"]);

const normalizeRoleToken = (value) =>
 String(value || "")
 .trim()
 .toLowerCase()
 .replace(/[\s-]+/g, "_");

const normalizeStatus = (status) => {
 const value = (status || "").toLowerCase();
 if (["visited", "visitado"].includes(value)) return "visitado";
 if (["en_visita", "in_visit", "in_progress"].includes(value)) return "en_visita";
 return "pendiente";
};

const STATUS_STYLES = {
  pendiente: {
    label: "Pendiente",
    chip: "bg-[#F3F4F6] text-[#1F2937]",
    led: "bg-[#D1D5DB]",
  },
  en_visita: {
    label: "En visita",
    chip: "bg-[#DBEAFE] text-[#1D4ED8]",
    led: "bg-[#2563EB]",
  },
  visitado: {
    label: "Visitado",
    chip: "bg-[#DCFCE7] text-[#16A34A]",
    led: "bg-[#16A34A]",
  },
};

const ClientesPage = () => {
 const { showToast } = useUI();
 const { role, user } = useAuth();
 const normalizedRole = normalizeRoleToken(role || user?.role || user?.role_name || user?.scope || "");
 const roleTokens = (normalizedRole || "")
 .split(/[,\|]+/)
 .map((token) => normalizeRoleToken(token))
 .filter(Boolean);
 const hasAnyRole = useCallback((allowedRoles) => roleTokens.some((token) => allowedRoles.has(token)), [roleTokens]);
 const canAssignClients = hasAnyRole(ASSIGN_CLIENT_ROLES);
 const canManageAllClients = hasAnyRole(FULL_ACCESS_ROLES);
 const canVisitClients = hasAnyRole(VISIT_ALLOWED_ROLES);
 const isBackofficeUser = hasAnyRole(BACKOFFICE_PANEL_ROLES);
 const isAcpCommercial = hasAnyRole(ACP_COMMERCIAL_ROLES);
 const isJefeComercial = roleTokens.includes("jefe_comercial");
 const isCommercialOnly = roleTokens.includes("comercial") && !canManageAllClients;
 const shouldStartWithScheduleFilter = !(isAcpCommercial || canManageAllClients);
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
 const [filterBySchedule, setFilterBySchedule] = useState(shouldStartWithScheduleFilter);
 const [selectedDate, setSelectedDate] = useState(todayStr);
 const [summary, setSummary] = useState({});
 const [temporaryAssignmentsFilter, setTemporaryAssignmentsFilter] = useState("all"); // all | expiring_today | expiring_7
 const [albumSearch, setAlbumSearch] = useState("");
 const [showAllClients, setShowAllClients] = useState(false);
 const [allClientsSearch, setAllClientsSearch] = useState("");
 const [clientSourceFilter, setClientSourceFilter] = useState("all"); // all | spi | odoo
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
 const [usersDirectoryByEmail, setUsersDirectoryByEmail] = useState({});
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

const getClientSourceMeta = (client) => {
  const createdBy = String(client?.created_by || "").trim().toLowerCase();
  const dataSource = String(client?.data_source || "").trim().toLowerCase();
  const isOdooSource = dataSource === "odoo" || createdBy === "odoo_sync@spi.local";
  if (isOdooSource) {
    return {
      label: "Origen: Odoo",
      className: "border-[#DBEAFE] bg-[#DBEAFE] text-[#1D4ED8]",
    };
  }
  return {
    label: "Origen: SPI",
    className: "border-[#E5E7EB] bg-[#F3F4F6] text-[#1F2937]",
  };
};

const isClientFromOdoo = (client) => {
const createdBy = String(client?.created_by || "").trim().toLowerCase();
const dataSource = String(client?.data_source || "").trim().toLowerCase();
return dataSource === "odoo" || createdBy === "odoo_sync@spi.local";
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

 const normalizeVisitLogs = (logs) => {
 if (Array.isArray(logs)) return logs;
 if (typeof logs === "string") {
 try {
 const parsed = JSON.parse(logs);
 return Array.isArray(parsed) ? parsed : [];
 } catch (e) {
 return [];
 }
 }
 return [];
 };

 const isUserPassiveOrInactive = (userInfo) => {
 if (!userInfo) return false;
 const employmentStatus = String(
 userInfo.estatus_empleado || userInfo.employment_status || "",
 ).trim().toLowerCase();
 if (userInfo.active === false) return true;
 return PASSIVE_EMPLOYMENT_STATUSES.has(employmentStatus);
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

  const getAssignmentAlerts = useCallback((client) => {
    const details = normalizeAssignmentDetails(client?.assignment_details);
    return details
      .map((assignment) => {
        const isPassive =
          assignment.is_active_user === false ||
          PASSIVE_EMPLOYMENT_STATUSES.has(String(assignment.employment_status || "").toLowerCase());
        const hasPermiso = Boolean(assignment.has_active_permiso);
        const hasVacaciones = Boolean(assignment.has_active_vacaciones);

        if (!isPassive && !hasPermiso && !hasVacaciones) return null;

        return {
          email: assignment.assigned_to_email,
          advisorName: assignment.assigned_to_name,
          isPassive,
          hasPermiso,
          hasVacaciones,
        };
      })
      .filter(Boolean);
  }, []);

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
 const usersMap = usersArray.reduce((acc, item) => {
 const email = String(item?.email || "").trim().toLowerCase();
 if (!email) return acc;
 acc[email] = item;
 return acc;
 }, {});
 setUsersDirectoryByEmail(usersMap);
 const filtered = usersArray.filter((u) => ASSIGNABLE_ADVISOR_ROLES.has(normalizeRoleToken(u.role)));
 setAdvisors(Array.isArray(filtered) ? filtered : []);
 } catch (error) {
 console.error(error);
 setAdvisors([]);
 setUsersDirectoryByEmail({});
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
 // Mantener el ultimo estado visible evita "parpadeo" a vacio por fallas temporales.
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
 setFilterBySchedule((prev) => (prev ? false : prev));
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

 const accessibleAlbumBase = useMemo(() => {
 if (!Array.isArray(registeredClients)) return [];
 if (canManageAllClients) return registeredClients;
 return registeredClients.filter((c) => {
 const assigned = normalizeAsignados(c.asignados);
 const isAssigned = assigned.some((mail) => (mail || "").toLowerCase?.() === currentEmail);
 const isCreator = (c.created_by || "").toLowerCase?.() === currentEmail;
 return isAssigned || isCreator;
 });
 }, [registeredClients, canManageAllClients, currentEmail]);

 const sourceTotals = useMemo(() => {
 const base = Array.isArray(accessibleAlbumBase) ? accessibleAlbumBase : [];
 let spi = 0;
 let odoo = 0;
 base.forEach((client) => {
 if (isClientFromOdoo(client)) odoo += 1;
 else spi += 1;
 });
 return {
 all: base.length,
 spi,
 odoo,
 };
 }, [accessibleAlbumBase]);

 const albumClients = useMemo(() => {
 let base = Array.isArray(accessibleAlbumBase) ? [...accessibleAlbumBase] : [];

 if (clientSourceFilter === "odoo") {
 base = base.filter((c) => isClientFromOdoo(c));
 } else if (clientSourceFilter === "spi") {
 base = base.filter((c) => !isClientFromOdoo(c));
 }

 if (!albumSearch) return base.slice(0, 12);
 const q = albumSearch.toLowerCase();
 return base.filter((c) => {
 const haystack = `${c.nombre || ""} ${c.commercial_name || ""} ${c.identificador || ""} ${c.ruc_cedula || ""} ${c.shipping_contact_name || ""}`.toLowerCase();
 return haystack.includes(q);
 });
 }, [accessibleAlbumBase, clientSourceFilter, albumSearch]);

 const allAlbumClients = useMemo(() => {
 let base = Array.isArray(accessibleAlbumBase) ? [...accessibleAlbumBase] : [];
 if (clientSourceFilter === "odoo") {
 base = base.filter((c) => isClientFromOdoo(c));
 } else if (clientSourceFilter === "spi") {
 base = base.filter((c) => !isClientFromOdoo(c));
 }
 return base;
 }, [accessibleAlbumBase, clientSourceFilter]);

  const advisorAssignmentBoard = useMemo(() => {
    if (!isJefeComercial) return [];
    if (!Array.isArray(allAlbumClients)) return [];

    const grouped = new Map();

    allAlbumClients.forEach((client) => {
      const details = normalizeAssignmentDetails(client?.assignment_details);
      details.forEach((assignment) => {
        const advisorEmail = String(assignment?.assigned_to_email || "").trim().toLowerCase();
        if (!advisorEmail) return;

        const isPassive =
          assignment.is_active_user === false ||
          PASSIVE_EMPLOYMENT_STATUSES.has(String(assignment.employment_status || "").toLowerCase());
        const hasPermiso = Boolean(assignment.has_active_permiso);
        const hasVacaciones = Boolean(assignment.has_active_vacaciones);

        const existing = grouped.get(advisorEmail) || {
          advisorEmail,
          advisorName: assignment?.assigned_to_name || advisorEmail,
          advisorRole: assignment?.assigned_to_role || "",
          passive: isPassive,
          hasPermiso: hasPermiso,
          hasVacaciones: hasVacaciones,
          employmentStatus: assignment.employment_status || "activo",
          clients: [],
        };

        existing.passive = existing.passive || isPassive;
        existing.hasPermiso = existing.hasPermiso || hasPermiso;
        existing.hasVacaciones = existing.hasVacaciones || hasVacaciones;

        existing.clients.push({
          id: client.id,
          name: client.commercial_name || client.nombre || `Cliente #${client.id}`,
        });

        grouped.set(advisorEmail, existing);
      });
    });

    return [...grouped.values()].sort(
      (a, b) => b.clients.length - a.clients.length || a.advisorName.localeCompare(b.advisorName),
    );
  }, [allAlbumClients, isJefeComercial]);

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

 const handleUnassign = async (clientId) => {
 const assignment = assignments[clientId] || {};
 const selectedEmail = String(assignment.email || "").trim().toLowerCase();
 const client = Array.isArray(clientes) ? clientes.find((item) => Number(item.id) === Number(clientId)) : null;
 const assignmentDetails = normalizeAssignmentDetails(client?.assignment_details);
 const assignedEmails = assignmentDetails
   .map((item) => String(item?.assigned_to_email || "").trim().toLowerCase())
   .filter(Boolean);

 const email =
   selectedEmail ||
   (assignedEmails.length === 1 ? assignedEmails[0] : "");

 if (!email) {
   showToast(
     assignedEmails.length > 1
       ? "Selecciona el asesor específico a desasignar"
       : "Selecciona un asesor para quitar la asignacion",
     "warning",
   );
   return;
 }
 try {
 await assignClient(clientId, {
 assignee_email: email,
 unassign: true,
 reason: assignment.reason || "Desasignado por jefatura comercial",
 });
 showToast("Asignacion retirada correctamente", "success");
 setAssignments((prev) => ({
 ...prev,
 [clientId]: {
 ...(prev[clientId] || {}),
 email: "",
 temporary: false,
 ends_at: "",
 reason: "",
 },
 }));
 invalidateClientsCache();
 await loadClientes({ forceRefresh: true });
 } catch (error) {
 console.error(error);
 showToast("No se pudo quitar la asignacion", "error");
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
const sourceMeta = getClientSourceMeta(cliente);
const assignmentAlerts = getAssignmentAlerts(cliente);
const assigned =
assignmentDetails.length > 0
? assignmentDetails.map(formatAssignment).join(", ")
 : asignadosArray.length > 0
 ? asignadosArray.join(", ")
 : "Sin asignar";
 const timelineOpen = Boolean(expandedTimeline[cliente.id]);
const hasEntryCoords = cliente.lat_entrada && cliente.lng_entrada;
const hasExitCoords = cliente.lat_salida && cliente.lng_salida;
const isCommercialPlanned = Boolean(
  cliente.scheduled_info?.is_planned_commercial ?? cliente.scheduled_info?.is_planned,
);
const isTechnicalPlanned = Boolean(cliente.scheduled_info?.is_planned_technical);
const isPlanned = isCommercialPlanned || isTechnicalPlanned;

  return (
    <div
      key={cliente.id}
      className="relative flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-shadow duration-200 cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] active:scale-[0.97] active:transition-transform"
      onClick={() => openReportModal(cliente)}
    >
      {isPlanned && (
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1">
          {isCommercialPlanned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2 py-[2px] text-[10px] font-semibold text-[#16A34A]">
              <FiCalendar size={10} />
              Comercial
            </span>
          )}
          {isTechnicalPlanned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#DBEAFE] px-2 py-[2px] text-[10px] font-semibold text-[#1D4ED8]">
              <FiCalendar size={10} />
              Técnico
            </span>
          )}
        </div>
      )}
      {temporaryInfo && (
        <span className="absolute top-3 left-24 inline-flex rounded-full bg-[#FEF3C7] px-2 py-[2px] text-[10px] font-semibold text-[#D97706]">
          {temporaryInfo.daysRemaining <= 0
            ? "Temporal vencida"
            : `Temporal vence en ${temporaryInfo.daysRemaining}d`}
        </span>
      )}
      <span className={`absolute top-3 right-3 h-2.5 w-2.5 rounded-full ${meta.led}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#1F2937]">{cliente.nombre}</p>
          <span className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[10px] font-medium ${sourceMeta.className}`}>
            {sourceMeta.label}
          </span>
          <p className="flex items-center gap-1 text-xs text-[#6B7280]">
            <FiMapPin className="text-[#D1D5DB]" size={12} /> {cliente.shipping_address || "Sin dirección"}
          </p>
          <p className="font-mono text-[11px] text-[#6B7280]">#{cliente.id}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-[2px] text-[10px] font-semibold ${meta.chip}`}>
          {meta.label}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-[#6B7280]">
          <span>Entrada</span>
          <span className="font-mono font-semibold text-[#1F2937]">{formatTime(cliente.hora_entrada)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-[#6B7280]">
          <span>Salida</span>
          <span className="font-mono font-semibold text-[#1F2937]">{formatTime(cliente.hora_salida)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-[#6B7280]">
          <span>Duración</span>
          <span className="font-mono font-semibold text-[#1F2937]">{formatDuration(duration)}</span>
        </div>
        <p className="text-xs text-[#6B7280]">
          <span className="font-medium text-[#1F2937]">Asignado:</span> {assigned}
        </p>
        {isJefeComercial && assignmentAlerts.length > 0 && (
          <div className="mt-2 space-y-1 rounded-xl border border-[#FEE2E2] bg-[#FEE2E2] p-2.5">
            {assignmentAlerts.map((alert) => (
              <p
                key={alert.email}
                className={`flex items-center gap-1 text-[11px] font-semibold ${
                  alert.isPassive ? "text-[#DC2626]" : "text-[#D97706]"
                }`}
              >
                <FiAlertCircle size={11} className="shrink-0" />
                <span className="truncate">
                  {alert.isPassive
                    ? `${alert.advisorName} inactivo/desvinculado.`
                    : alert.hasVacaciones
                      ? `${alert.advisorName} en vacaciones hoy.`
                      : `${alert.advisorName} en permiso hoy.`}
                </span>
              </p>
            ))}
            <p className="ml-4 text-[10px] font-medium text-[#DC2626]/70">
              Acción requerida: Reasignar para asegurar continuidad.
            </p>
          </div>
        )}
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

      {(hasEntryCoords || hasExitCoords) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {hasEntryCoords && (
            <a
              href={`https://www.google.com/maps?q=${cliente.lat_entrada},${cliente.lng_entrada}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-3 py-1 text-[#1F2937] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
            >
              <FiMapPin size={11} /> Entrada
            </a>
          )}
          {hasExitCoords && (
            <a
              href={`https://www.google.com/maps?q=${cliente.lat_salida},${cliente.lng_salida}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-3 py-1 text-[#1F2937] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
            >
              <FiMapPin size={11} /> Salida
            </a>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-[#E5E7EB] pt-3">
        <button
          type="button"
          className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedTimeline((prev) => ({ ...prev, [cliente.id]: !prev[cliente.id] }));
          }}
        >
          {timelineOpen ? "Ocultar timeline" : "Ver timeline"}
        </button>
        {timelineOpen && (
          <div className="mt-2 space-y-1 text-xs text-[#6B7280]">
            <p>Entrada: <span className="font-mono text-[#1F2937]">{formatTime(cliente.hora_entrada)}</span></p>
            <p>Salida: <span className="font-mono text-[#1F2937]">{formatTime(cliente.hora_salida)}</span></p>
            <p>Duración: <span className="font-mono text-[#1F2937]">{formatDuration(duration)}</span></p>
            <p>Observación: {cliente.observaciones || "Sin observaciones"}</p>
          </div>
        )}
      </div>

      {canAssignClients && (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-semibold text-[#1F2937]">Reasignar asesor</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
              value={assignments[cliente.id]?.email || ""}
              onChange={(e) =>
                setAssignments((prev) => ({
                  ...prev,
                  [cliente.id]: { ...(prev[cliente.id] || {}), email: e.target.value },
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
            <label className="inline-flex items-center gap-2 text-xs text-[#6B7280] cursor-pointer">
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
                className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                value={assignments[cliente.id]?.ends_at || ""}
                onChange={(e) =>
                  setAssignments((prev) => ({
                    ...prev,
                    [cliente.id]: { ...(prev[cliente.id] || {}), ends_at: e.target.value },
                  }))
                }
              />
            )}
            <Button onClick={() => handleAssign(cliente.id)}>Asignar</Button>
            <Button variant="ghost" onClick={() => handleUnassign(cliente.id)}>Quitar</Button>
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
    const sourceMeta = getClientSourceMeta(cliente);
    const assignmentAlerts = getAssignmentAlerts(cliente);
    const isCommercialPlanned = Boolean(
      cliente.scheduled_info?.is_planned_commercial ?? cliente.scheduled_info?.is_planned,
    );
    const isTechnicalPlanned = Boolean(cliente.scheduled_info?.is_planned_technical);
    const isPlanned = isCommercialPlanned || isTechnicalPlanned;
    const assigned =
      assignmentDetails.length > 0
        ? assignmentDetails.map(formatAssignment).join(", ")
        : asignadosArray.length > 0
          ? asignadosArray.join(", ")
          : "Sin asignar";

    return (
      <div
        key={`album-${cliente.id}`}
        className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#1F2937]">{clientName}</p>
            <span className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[10px] font-medium ${sourceMeta.className}`}>
              {sourceMeta.label}
            </span>
            <p className="font-mono text-xs text-[#6B7280]">{identifier}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#DCFCE7] px-2 py-[2px] text-[10px] font-semibold text-[#16A34A]">
            Aprobado
          </span>
        </div>

        <div className="mt-3 space-y-1.5 text-xs text-[#6B7280]">
          <p className="flex items-center gap-1.5">
            <FiMapPin size={12} className="shrink-0 text-[#D1D5DB]" /> {address}
          </p>
          <p className="flex items-center gap-1.5">
            <FiUser size={12} className="shrink-0 text-[#D1D5DB]" /> {contactName}
          </p>
          <p className="flex items-center gap-1.5">
            <FiPhone size={12} className="shrink-0 text-[#D1D5DB]" /> {contactPhone}
          </p>
          <p>
            <span className="font-medium text-[#1F2937]">Asignado:</span> {assigned}
          </p>
          {isPlanned && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {isCommercialPlanned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2 py-[2px] text-[10px] font-semibold text-[#16A34A]">
                  <FiCalendar size={9} /> Comercial
                </span>
              )}
              {isTechnicalPlanned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#DBEAFE] px-2 py-[2px] text-[10px] font-semibold text-[#1D4ED8]">
                  <FiCalendar size={9} /> Técnico
                </span>
              )}
            </div>
          )}
          {isJefeComercial && assignmentAlerts.length > 0 && (
            <div className="mt-1.5 space-y-1 rounded-xl border border-[#FEE2E2] bg-[#FEE2E2] p-2">
              {assignmentAlerts.map((alert) => (
                <p
                  key={alert.email}
                  className={`flex items-center gap-1 text-[10px] font-semibold ${
                    alert.isPassive ? "text-[#DC2626]" : "text-[#D97706]"
                  }`}
                >
                  <FiAlertCircle size={10} className="shrink-0" />
                  <span>
                    {alert.isPassive
                      ? `${alert.advisorName} desvinculado.`
                      : alert.hasVacaciones
                        ? `${alert.advisorName} en vacaciones.`
                        : `${alert.advisorName} en permiso.`}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="px-3 py-1.5 text-xs cursor-pointer" onClick={() => openEditModal(cliente)}>
            <FiEdit2 className="mr-1" /> Editar
          </Button>
          {canManageAllClients && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#DBEAFE] px-2 py-1 text-[10px] font-semibold text-[#1D4ED8]">
              <FiFileText size={10} /> Documentos
            </span>
          )}
        </div>

        {canAssignClients && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
            <p className="text-xs font-semibold text-[#1F2937]">Asignación comercial</p>
            <div className="flex flex-col gap-2">
              <select
                className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                value={assignments[cliente.id]?.email || ""}
                onChange={(e) =>
                  setAssignments((prev) => ({
                    ...prev,
                    [cliente.id]: { ...(prev[cliente.id] || {}), email: e.target.value },
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
              <div className="flex flex-wrap gap-2">
                <Button className="px-3 py-1.5 text-xs cursor-pointer" onClick={() => handleAssign(cliente.id)}>
                  Asignar
                </Button>
                <Button variant="ghost" className="px-3 py-1.5 text-xs cursor-pointer" onClick={() => handleUnassign(cliente.id)}>
                  Quitar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

 const showVisitFlow = canVisitClients;
 const canSeeCheckInOutCards = showVisitFlow && !hasAnyRole(CHECKIN_CARDS_HIDDEN_ROLES);
 const canSeeDailyManagedClients = showVisitFlow && roleTokens.includes("comercial");
 const activeClientVisitLogs = useMemo(
 () =>
 normalizeVisitLogs(activeClient?.visit_logs).sort(
 (a, b) =>
 new Date(b?.hora_salida || b?.hora_entrada || b?.visit_date || 0).getTime() -
 new Date(a?.hora_salida || a?.hora_entrada || a?.visit_date || 0).getTime(),
 ),
 [activeClient],
 );

 return (
 <div className="space-y-4 sm:space-y-6 pb-6 px-3 sm:px-0">
 <header className="space-y-4">
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div>
                <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-[#1F2937] sm:text-2xl">
                  <FiUsers className="text-[#1E293B]" /> Gestión de Clientes
                </h1>
                <p className="max-w-xl text-xs text-[#6B7280] sm:text-sm">
                  Clientes aprobados que puedes gestionar, con enfoque en tu ruta diaria de visitas.
                </p>
 </div>
 </div>

 {isBackofficeUser ? (
 <>
 <BackofficeClientRequestsKpiWidget />
 <ClientApprovalsWidget />
 </>
 ) : isJefeComercial ? (
 <div className="space-y-3">
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div>
                <h2 className="text-lg font-semibold text-[#1F2937]">Panel de jefatura comercial</h2>
                <p className="text-sm text-[#6B7280]">
                  Gestiona cartera completa, asignaciones por asesor y alertas de continuidad comercial.
                </p>
                </div>
                <div className="rounded-full bg-[#DBEAFE] px-3 py-1 text-[11px] font-semibold text-[#1D4ED8]">
                  {advisorAssignmentBoard.length} asesores con clientes asignados
                </div>
                </div>

                {advisorAssignmentBoard.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {advisorAssignmentBoard.map((row) => (
                  <div key={row.advisorEmail} className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1F2937]">{row.advisorName}</p>
                        <p className="truncate text-xs text-[#6B7280]">{row.advisorEmail}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            row.passive ? "bg-[#FEE2E2] text-[#DC2626]" : "bg-[#DCFCE7] text-[#16A34A]"
                          }`}
                        >
                          {row.passive ? "Inactivo / Desvinculado" : "Laboralmente Activo"}
                        </span>
                        {row.hasPermiso && (
                          <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#D97706]">
                            En Permiso
                          </span>
                        )}
                        {row.hasVacaciones && (
                          <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#D97706]">
                            En Vacaciones
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-[#6B7280]">
                      <span className="font-mono font-semibold text-[#2563EB]">{row.clients.length}</span> clientes asignados
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-[#6B7280]">
                      {row.clients.map((client) => client.name).join(", ")}
                    </p>
                  </div>
                ))}
                </div>
                ) : (
                <div className="flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-xs text-[#6B7280]">
                  <FiUsers size={14} className="text-[#D1D5DB]" />
                  No hay asignaciones activas para asesores comerciales.
                </div>
                )}
 </div>
 ) : isAcpCommercial ? (
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div>
                <h2 className="text-lg font-semibold text-[#1F2937]">Vista global de clientes</h2>
                <p className="text-sm text-[#6B7280]">
                  Puedes revisar todos los clientes aprobados y sus asignaciones comerciales.
                </p>
                </div>
                <div className="flex items-center gap-3">
                <div className="rounded-full bg-[#DCFCE7] px-3 py-1 text-[11px] font-semibold text-[#16A34A]">
                  <span className="font-mono">{allAlbumClients.length}</span> clientes
                </div>
                <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D1D5DB]" size={14} />
                <input
                  type="text"
                  value={assignedSearch}
                  onChange={(e) => setAssignedSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-56 rounded-xl border border-[#D1D5DB] bg-white py-2 pl-9 pr-4 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
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
                  <label className="text-xs font-medium text-[#1F2937] sm:text-sm">Fecha</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl border border-[#D1D5DB] bg-white px-2.5 py-1.5 text-xs text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 sm:w-[180px] sm:px-3 sm:py-2 sm:text-sm"
                  />
                </div>
 </div>
 <div className="flex items-start gap-2 sm:items-center">
                <label className="flex cursor-pointer items-start gap-2 text-xs text-[#6B7280] sm:items-center sm:text-sm">
                  <input
                    type="checkbox"
                    checked={filterBySchedule}
                    onChange={(e) => setFilterBySchedule(e.target.checked)}
                    className="rounded accent-[#2563EB]"
                  />
                  <span>Mostrar solo clientes planificados</span>
                </label>
 </div>
 </div>

 {summary?.has_approved_schedule && (
                <Card className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="flex items-center gap-2 font-semibold text-[#1F2937]">
                        <FiCalendar size={15} className="text-[#2563EB]" /> Planificación de hoy
                      </h4>
                      <p className="mt-1 text-sm text-[#6B7280]">
                        {(summary.cities_today || []).join(", ") || "Ciudades"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-2xl font-bold text-[#1F2937]">{summary.planned_today || 0}</p>
                      <p className="text-xs text-[#6B7280]">clientes planificados</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6B7280]">Progreso</span>
                      <span className="font-mono font-semibold text-[#1F2937]">
                        {visitedCount} / {summary.planned_today || 0}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                      <div
                        className="h-1.5 rounded-full bg-[#2563EB] transition-all duration-300"
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
                <Card className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                  <div className="grid grid-cols-3 divide-x divide-[#E5E7EB]">
                    <div className="px-4 first:pl-0 last:pr-0">
                      <p className="text-xs font-medium text-[#6B7280]">Cumplimiento plan</p>
                      <p className="mt-1 font-mono text-xl font-bold text-[#1F2937]">
                        {commercialKpi.compliance === null ? "N/A" : `${commercialKpi.compliance}%`}
                      </p>
                    </div>
                    <div className="px-4 first:pl-0 last:pr-0">
                      <p className="text-xs font-medium text-[#6B7280]">Visitas efectivas</p>
                      <p className="mt-1 font-mono text-xl font-bold text-[#1F2937]">{commercialKpi.effectiveVisits}</p>
                    </div>
                    <div className="px-4 first:pl-0 last:pr-0">
                      <p className="text-xs font-medium text-[#6B7280]">Promedio en sitio</p>
                      <p className="mt-1 font-mono text-xl font-bold text-[#1F2937]">{formatDuration(commercialKpi.avgDuration)}</p>
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
                <Card className="space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-[#1F2937]">Check-in / Check-out</h2>
                      <p className="text-sm text-[#6B7280]">
                        Inicia o finaliza visitas y consulta el detalle de cada cliente.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTemporaryAssignmentsFilter("all")}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          temporaryAssignmentsFilter === "all"
                            ? "bg-[#1E293B] text-white"
                            : "bg-[#F3F4F6] text-[#1F2937]"
                        }`}
                      >
                        Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemporaryAssignmentsFilter("expiring_7")}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          temporaryAssignmentsFilter === "expiring_7"
                            ? "bg-[#D97706] text-white"
                            : "bg-[#FEF3C7] text-[#D97706]"
                        }`}
                      >
                        Temporales (7d)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemporaryAssignmentsFilter("expiring_today")}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          temporaryAssignmentsFilter === "expiring_today"
                            ? "bg-[#DC2626] text-white"
                            : "bg-[#FEE2E2] text-[#DC2626]"
                        }`}
                      >
                        Vencen hoy
                      </button>
                    </div>
                  </div>

                  {Array.isArray(filteredClientes) && filteredClientes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                      {filteredClientes.map((cliente) => renderCard(cliente))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                      <FiUsers size={32} className="text-[#D1D5DB]" />
                      <p className="text-sm font-medium text-[#1F2937]">
                        {loading ? "Cargando clientes..." : "Sin clientes para mostrar"}
                      </p>
                      {!loading && (
                        <p className="text-xs text-[#6B7280]">Ajusta los filtros o cambia la fecha seleccionada.</p>
                      )}
                    </div>
                  )}
                </Card>
 )}

 {/* Widget: Clientes asignados / registrados por mí (solo comercial) */}
                {canSeeDailyManagedClients && (
                  <Card className="space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-[#1F2937]">Mis clientes de gestión diaria</h2>
                        <p className="text-sm text-[#6B7280]">
                          Clientes asignados, registrados por ti o el conjunto completo.
                        </p>
                      </div>
                      <div className="inline-flex rounded-full bg-[#DBEAFE] px-3 py-1 text-[11px] font-semibold text-[#1D4ED8]">
                        Solo tu usuario
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex w-full flex-wrap rounded-xl bg-[#F3F4F6] p-1 text-xs font-medium sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setAssignedViewFilter("assigned")}
                          className={`cursor-pointer rounded-lg px-3 py-1.5 transition-colors ${
                            assignedViewFilter === "assigned"
                              ? "bg-white text-[#1F2937] shadow-sm"
                              : "text-[#6B7280]"
                          }`}
                        >
                          Asignados ({Array.isArray(assignedToMe) ? assignedToMe.length : 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignedViewFilter("created")}
                          className={`cursor-pointer rounded-lg px-3 py-1.5 transition-colors ${
                            assignedViewFilter === "created"
                              ? "bg-white text-[#1F2937] shadow-sm"
                              : "text-[#6B7280]"
                          }`}
                        >
                          Registrados ({Array.isArray(createdByMe) ? createdByMe.length : 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignedViewFilter("all")}
                          className={`cursor-pointer rounded-lg px-3 py-1.5 transition-colors ${
                            assignedViewFilter === "all"
                              ? "bg-white text-[#1F2937] shadow-sm"
                              : "text-[#6B7280]"
                          }`}
                        >
                          Todos ({Array.isArray(allMine) ? allMine.length : 0})
                        </button>
                      </div>

                      <div className="relative w-full md:max-w-xs">
                        <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D1D5DB]" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre, RUC o ciudad..."
                          value={assignedSearch}
                          onChange={(e) => setAssignedSearch(e.target.value)}
                          className="w-full rounded-xl border border-[#D1D5DB] py-2 pl-9 pr-3 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                        />
                      </div>
                    </div>

                    {Array.isArray(filteredAssignedList) && filteredAssignedList.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {filteredAssignedList.map((cliente) => {
                          const ciudad = cliente.shipping_city || getCityFromAddress(cliente.shipping_address);
                          const provincia = cliente.shipping_province || getProvinceFromAddress(cliente.shipping_address);
                          const clienteEmail = cliente.client_email || "Correo no disponible";
                          const clientTypeLabel = formatClientType(cliente.client_type);
                          const status = normalizeStatus(cliente.visit_status);
                          const meta = getStatusMeta(status);
                          const sourceMeta = getClientSourceMeta(cliente);
                          return (
                            <div
                              key={`mini-${cliente.id}`}
                              className="flex cursor-pointer flex-col rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] active:scale-[0.97] active:transition-transform"
                              onClick={() => openReportModal(cliente)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 space-y-0.5">
                                  <p className="line-clamp-1 text-sm font-semibold text-[#1F2937]">{cliente.nombre}</p>
                                  <span className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[10px] font-medium ${sourceMeta.className}`}>
                                    {sourceMeta.label}
                                  </span>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-[1px] text-[10px] font-semibold ${meta.chip}`}>
                                  {meta.label}
                                </span>
                              </div>
                              <div className="mt-2 space-y-1 text-[11px] text-[#6B7280]">
                                <p className="flex items-center gap-1.5">
                                  <FiMail className="h-3 w-3 shrink-0 text-[#D1D5DB]" />
                                  <span className="truncate">{clienteEmail}</span>
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <FiUser className="h-3 w-3 shrink-0 text-[#D1D5DB]" />
                                  {clientTypeLabel}
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <FiMapPin className="h-3 w-3 shrink-0 text-[#D1D5DB]" />
                                  {provincia || "Provincia no especificada"}, {ciudad || "Ciudad no especificada"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                        <FiUsers size={28} className="text-[#D1D5DB]" />
                        <p className="text-sm text-[#6B7280]">
                          {assignedViewFilter === "assigned"
                            ? "No tienes clientes asignados que coincidan."
                            : assignedViewFilter === "created"
                              ? "No tienes clientes registrados que coincidan."
                              : "No tienes clientes asignados o registrados que coincidan."}
                        </p>
                      </div>
                    )}
                  </Card>
                )}
 </>
 )
 }

                <Card className="space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-[#1F2937]">Clientes registrados</h2>
                      <p className="text-sm text-[#6B7280]">
                        Gestiona clientes aprobados. Edita nombre comercial y contacto; los roles avanzados acceden a documentos.
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                      <div className="relative w-full md:max-w-xs">
                        <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D1D5DB]" />
                        <input
                          type="text"
                          placeholder="Buscar cliente..."
                          value={albumSearch}
                          onChange={(e) => setAlbumSearch(e.target.value)}
                          className="w-full rounded-xl border border-[#D1D5DB] py-2 pl-9 pr-3 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                        />
                      </div>
                      <Button
                        variant="secondary"
                        className="w-full cursor-pointer md:w-auto"
                        onClick={() => setShowAllClients(true)}
                      >
                        Ver todos
                      </Button>
                    </div>
                  </div>

                  {(isJefeComercial || canManageAllClients) && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setClientSourceFilter("all")}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          clientSourceFilter === "all" ? "bg-[#1E293B] text-white" : "bg-[#F3F4F6] text-[#1F2937]"
                        }`}
                      >
                        Todos ({sourceTotals.all})
                      </button>
                      <button
                        type="button"
                        onClick={() => setClientSourceFilter("spi")}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          clientSourceFilter === "spi" ? "bg-[#334155] text-white" : "bg-[#F3F4F6] text-[#1F2937]"
                        }`}
                      >
                        SPI ({sourceTotals.spi})
                      </button>
                      <button
                        type="button"
                        onClick={() => setClientSourceFilter("odoo")}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          clientSourceFilter === "odoo" ? "bg-[#2563EB] text-white" : "bg-[#DBEAFE] text-[#1D4ED8]"
                        }`}
                      >
                        Odoo ({sourceTotals.odoo})
                      </button>
                    </div>
                  )}

                  {Array.isArray(albumClients) && albumClients.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                      {albumClients.map((cliente) => renderAlbumCard(cliente))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                      <FiUsers size={32} className="text-[#D1D5DB]" />
                      <p className="text-sm font-medium text-[#1F2937]">
                        {loading ? "Cargando clientes..." : albumSearch ? "Sin resultados para esa búsqueda." : "Usa el buscador para encontrar clientes."}
                      </p>
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
                    <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D1D5DB]" />
                    <input
                      type="text"
                      placeholder="Buscar cliente..."
                      value={allClientsSearch}
                      onChange={(e) => setAllClientsSearch(e.target.value)}
                      className="w-full rounded-xl border border-[#D1D5DB] py-2 pl-9 pr-3 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                    />
 </div>

                  {Array.isArray(filteredAllAlbumClients) && filteredAllAlbumClients.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                      {filteredAllAlbumClients.map((cliente) => renderAlbumCard(cliente))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                      <FiUsers size={32} className="text-[#D1D5DB]" />
                      <p className="text-sm text-[#6B7280]">
                        {loading ? "Cargando clientes..." : allClientsSearch ? "Sin resultados para esa búsqueda." : "No hay clientes para mostrar."}
                      </p>
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#1F2937]">Nueva fecha</label>
                    <input
                      type="date"
                      value={reprogramModal.date}
                      min={todayStr}
                      onChange={(e) => setReprogramModal((prev) => ({ ...prev, date: e.target.value }))}
                      className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#1F2937]">Nota (opcional)</label>
                    <textarea
                      rows={3}
                      value={reprogramModal.note}
                      onChange={(e) => setReprogramModal((prev) => ({ ...prev, note: e.target.value }))}
                      className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
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
                  <p className="text-sm text-[#6B7280]">
                    {modalType === "start"
                      ? `Estás a punto de iniciar la visita a ${activeClient?.nombre}. Se registrará tu ubicación y hora de entrada.`
                      : `Finaliza la visita a ${activeClient?.nombre}. Puedes agregar observaciones finales.`}
                  </p>

                  <div className="space-y-1.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-xs text-[#6B7280]">
                    <div className="flex justify-between">
                      <span>Fecha</span>
                      <span className="font-mono font-medium text-[#1F2937]">{visitModal.timestamp?.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hora</span>
                      <span className="font-mono font-medium text-[#1F2937]">{formatTime(visitModal.timestamp)}</span>
                    </div>
                    {visitModal.loadingLocation ? (
                      <div className="flex items-center gap-2 text-[#2563EB]">
                        <FiNavigation className="animate-spin" size={13} /> Obteniendo ubicación...
                      </div>
                    ) : visitModal.coords ? (
                      <div className="flex items-center gap-2 text-[#16A34A]">
                        <FiMapPin size={13} />
                        <span className="font-mono">{visitModal.coords.latitude.toFixed(5)}, {visitModal.coords.longitude.toFixed(5)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[#DC2626]">
                        <FiAlertCircle size={13} /> Ubicación no disponible
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#1F2937]">Observaciones (opcional)</label>
                    <textarea
                      className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                      rows={3}
                      placeholder="Escribe aquí notas sobre la visita..."
                      value={visitModal.note}
                      onChange={(e) => setVisitModal((prev) => ({ ...prev, note: e.target.value }))}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={closeModal} disabled={submittingVisit}>
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
                <div className="py-6 text-center text-sm text-[#6B7280]">Cargando detalle...</div>
 ) : (
 <form onSubmit={handleEditSubmit} className="space-y-6">
                <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Datos principales</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Nombre comercial</label>
 <input
 type="text"
 value={editForm.commercial_name || ""}
 onChange={(e) => handleEditChange("commercial_name", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Contacto principal</label>
 <input
 type="text"
 value={editForm.shipping_contact_name || ""}
 onChange={(e) => handleEditChange("shipping_contact_name", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Telefono</label>
 <input
 type="text"
 value={editForm.shipping_phone || ""}
 onChange={(e) => handleEditChange("shipping_phone", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Celular</label>
 <input
 type="text"
 value={editForm.shipping_cellphone || ""}
 onChange={(e) => handleEditChange("shipping_cellphone", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 </div>
 </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Ubicaciones para visitas y rutas</h4>
 <LocationManager
 clientId={Number(activeClient?.id || editDetail?.id || 0)}
 canEdit
 />
 </div>

 {canManageAllClients && (
 <>
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Informacion legal</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Tipo de cliente</label>
 <select
 value={editForm.client_type || ""}
 onChange={(e) => handleEditChange("client_type", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 >
 <option value="">Selecciona...</option>
 <option value="persona_juridica">Persona juridica</option>
 <option value="persona_natural">Persona natural</option>
 <option value="sub_distribuidor">Sub distribuidor</option>
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">RUC / Cedula</label>
 <input
 type="text"
 value={editForm.ruc_cedula || ""}
 onChange={(e) => handleEditChange("ruc_cedula", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Razon social</label>
 <input
 type="text"
 value={editForm.legal_person_business_name || ""}
 onChange={(e) => handleEditChange("legal_person_business_name", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Nombre establecimiento</label>
 <input
 type="text"
 value={editForm.establishment_name || ""}
 onChange={(e) => handleEditChange("establishment_name", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 </div>
 </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Direccion de establecimiento</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Provincia</label>
 <input
 type="text"
 value={editForm.establishment_province || ""}
 onChange={(e) => handleEditChange("establishment_province", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Ciudad</label>
 <input
 type="text"
 value={editForm.establishment_city || ""}
 onChange={(e) => handleEditChange("establishment_city", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1 sm:col-span-2">
 <label className="text-xs font-medium text-[#1F2937]">Direccion</label>
 <input
 type="text"
 value={editForm.establishment_address || ""}
 onChange={(e) => handleEditChange("establishment_address", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1 sm:col-span-2">
 <label className="text-xs font-medium text-[#1F2937]">Referencia</label>
 <input
 type="text"
 value={editForm.establishment_reference || ""}
 onChange={(e) => handleEditChange("establishment_reference", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 </div>
 </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Representante legal</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Nombre</label>
 <input
 type="text"
 value={editForm.legal_rep_name || ""}
 onChange={(e) => handleEditChange("legal_rep_name", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Cargo</label>
 <input
 type="text"
 value={editForm.legal_rep_position || ""}
 onChange={(e) => handleEditChange("legal_rep_position", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Cedula</label>
 <input
 type="text"
 value={editForm.legal_rep_id_document || ""}
 onChange={(e) => handleEditChange("legal_rep_id_document", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Email</label>
 <input
 type="email"
 value={editForm.legal_rep_email || ""}
 onChange={(e) => handleEditChange("legal_rep_email", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Celular</label>
 <input
 type="text"
 value={editForm.legal_rep_cellphone || ""}
 onChange={(e) => handleEditChange("legal_rep_cellphone", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 </div>
 </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Direccion de envio</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1 sm:col-span-2">
 <label className="text-xs font-medium text-[#1F2937]">Direccion</label>
 <input
 type="text"
 value={editForm.shipping_address || ""}
 onChange={(e) => handleEditChange("shipping_address", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Provincia</label>
 <input
 type="text"
 value={editForm.shipping_province || ""}
 onChange={(e) => handleEditChange("shipping_province", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Ciudad</label>
 <input
 type="text"
 value={editForm.shipping_city || ""}
 onChange={(e) => handleEditChange("shipping_city", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1 sm:col-span-2">
 <label className="text-xs font-medium text-[#1F2937]">Referencia</label>
 <input
 type="text"
 value={editForm.shipping_reference || ""}
 onChange={(e) => handleEditChange("shipping_reference", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Horario de entrega</label>
 <input
 type="text"
 value={editForm.shipping_delivery_hours || ""}
 onChange={(e) => handleEditChange("shipping_delivery_hours", e.target.value)}
 className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
 />
 </div>
 </div>
 </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Documentos</h4>
                  {Array.isArray(editDetail?.attachments) && editDetail.attachments.length > 0 ? (
                    <div className="mb-4 space-y-1.5 text-xs">
                      {editDetail.attachments.map((doc) => (
                        <a
                          key={doc.key}
                          href={doc.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                        >
                          <FiFileText size={13} /> {doc.label}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-4 text-xs text-[#6B7280]">No hay documentos cargados.</p>
                  )}

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Documento de identificacion (PDF)</label>
 <input
 type="file"
 accept="application/pdf,image/*"
 onChange={(e) => handleEditFile("id_file", e.target.files?.[0])}
 className="w-full text-xs"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">RUC (PDF)</label>
 <input
 type="file"
 accept="application/pdf,image/*"
 onChange={(e) => handleEditFile("ruc_file", e.target.files?.[0])}
 className="w-full text-xs"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Permiso de funcionamiento</label>
 <input
 type="file"
 accept="application/pdf,image/*"
 onChange={(e) => handleEditFile("operating_permit_file", e.target.files?.[0])}
 className="w-full text-xs"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Nombramiento representante legal</label>
 <input
 type="file"
 accept="application/pdf,image/*"
 onChange={(e) => handleEditFile("legal_rep_appointment_file", e.target.files?.[0])}
 className="w-full text-xs"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-medium text-[#1F2937]">Evidencia LOPDP</label>
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
 <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Cliente</label>
 <p className="text-sm font-medium text-[#1F2937]">{activeClient?.nombre}</p>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Identificación</label>
 <p className="text-sm text-[#1F2937]">{activeClient?.identificador || "N/A"}</p>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Visita</label>
 <div className="flex items-center gap-2">
 <span className={`h-2 w-2 rounded-full ${getStatusMeta(activeClient?.visit_status).led}`} />
 <span className="text-sm text-[#1F2937]">{getStatusMeta(activeClient?.visit_status).label}</span>
 </div>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Duración</label>
 <p className="text-sm text-[#1F2937]">
 {formatDuration(activeClient?.duracion_minutos ?? calculateDuration(activeClient))}
 </p>
 </div>
 </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Tiempos y ubicación</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6B7280]">Entrada</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium text-[#1F2937]">{formatTime(activeClient?.hora_entrada)}</span>
                        {activeClient?.lat_entrada && (
                          <a
                            href={`https://www.google.com/maps?q=${activeClient.lat_entrada},${activeClient.lng_entrada}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                          >
                            <FiMapPin size={11} /> Ver
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-[#E5E7EB]" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6B7280]">Salida</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium text-[#1F2937]">{formatTime(activeClient?.hora_salida)}</span>
                        {activeClient?.lat_salida && (
                          <a
                            href={`https://www.google.com/maps?q=${activeClient.lat_salida},${activeClient.lng_salida}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                          >
                            <FiMapPin size={11} /> Ver
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Observaciones</label>
                  <div className="min-h-[80px] rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-sm text-[#1F2937]">
                    {activeClient?.observaciones || <span className="text-[#6B7280]">Sin observaciones registradas.</span>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Historial de visitas comerciales</label>
                  {activeClientVisitLogs.length > 0 ? (
                    <div className="space-y-2">
                      {activeClientVisitLogs.slice(0, 8).map((visit, index) => (
                        <div key={`${visit?.id || "visit"}-${index}`} className="rounded-xl border border-[#E5E7EB] bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[#1F2937]">
                              {visit?.advisor_name || visit?.advisor_email || "Asesor no identificado"}
                            </p>
                            <span className="font-mono text-xs text-[#6B7280]">{formatDateSafe(visit?.visit_date, "dd/MM/yyyy")}</span>
                          </div>
                          <p className="mt-1 text-xs text-[#6B7280]">
                            {visit?.advisor_role || "N/A"} ·{" "}
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getStatusMeta(visit?.status).chip}`}>
                              {getStatusMeta(visit?.status).label}
                            </span>
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            <span className="font-mono">{formatTime(visit?.hora_entrada)}</span>{" "}
                            — <span className="font-mono">{formatTime(visit?.hora_salida)}</span>{" "}
                            · {formatDuration(visit?.duracion_minutos)}
                          </p>
                          {visit?.observaciones && (
                            <p className="mt-1 text-xs text-[#6B7280]">{visit.observaciones}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-4 text-sm text-[#6B7280]">
                      <FiInfo size={14} className="shrink-0 text-[#D1D5DB]" />
                      No hay visitas históricas registradas para este cliente.
                    </div>
                  )}
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
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[#1F2937]">Nombre del laboratorio / prospecto</label>
      <input
        autoFocus
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
        placeholder="Ej. Laboratorio Clínico Central"
        required
      />
    </div>
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[#1F2937]">Observaciones</label>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
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
