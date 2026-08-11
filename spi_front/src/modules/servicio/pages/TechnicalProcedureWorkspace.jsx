import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiExternalLink, FiRefreshCw, FiSearch } from "react-icons/fi";

import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import ProcessingOverlay from "../../../core/ui/components/ProcessingOverlay";
import { useAuth } from "../../../core/auth/AuthContext";
import {
 normalizeRoles,
 isTechnical as isTechnicalRole,
 isChiefTechnical as isChiefTechnicalRole,
} from "../../shared/purchases-workspace/purchaseRoleGroups";
import WorkflowDocumentsPanel from "../components/WorkflowDocumentsPanel";
import WorkflowTimeline from "../components/WorkflowTimeline";
import SiteInspectionStepper from "../components/SiteInspectionStepper";
import SiteInspectionSummaryCard from "../components/SiteInspectionSummaryCard";
import {
 coordinateInspectionDate,
 getEquipmentPurchaseMeta,
 getPublicPurchaseTechnicalSchedule,
 listEquipmentPurchases,
 reviewInspectionDate,
 registerPublicPurchaseSiteInspection,
} from "../../../core/api/equipmentPurchasesApi";
import {
 getPrivatePurchasesByRole,
 reviewPrivatePurchaseInspectionDate,
 registerPrivatePurchaseSiteInspection,
} from "../../../core/api/privatePurchasesApi";
import { listWorkflowDocumentsSummary } from "../../../core/api/servicioApi";
import { formatDateOnlyEs, normalizeDateOnly, toStatusLabel } from "../../../core/utils/workflowUi";

const TECH_STEP_DEFINITIONS = [
 { code: "F.ST-02", label: "Desinfección", route: "/dashboard/servicio-tecnico/desinfeccion" },
 { code: "F.ST-04", label: "Entrenamiento", route: "/dashboard/servicio-tecnico/aplicaciones" },
 { code: "F.ST-05", label: "Asistencia", route: "/dashboard/servicio-tecnico/asistencia" },
 { code: "F.ST-09", label: "Verificación", route: "/dashboard/servicio-tecnico/verificacion" },
];
const TOTAL_PROCEDURE_STEPS = TECH_STEP_DEFINITIONS.length + 2; // F.ST-20 + F.ST-07 + steps técnicos

const FST07_QUESTIONS = [
 {
 section: "1. Área física",
 items: [
 { key: "area_min_space", label: "Área con espacio mínimo requerido", allowsNA: false },
 { key: "area_pressure_temperature", label: "Condiciones de presión y temperatura correctas", allowsNA: false },
 { key: "area_humidity", label: "Humedad dentro del máximo permitido", allowsNA: false },
 { key: "area_free_dust", label: "Área libre de polvo/contaminación", allowsNA: false },
 ],
 },
 {
 section: "2. Condiciones eléctricas",
 items: [
 { key: "electrical_dedicated_outlets", label: "Tomas eléctricas dedicadas", allowsNA: false },
 { key: "electrical_polarized_outlets", label: "Tomas eléctricas polarizadas", allowsNA: false },
 { key: "electrical_breakers", label: "Brakers adecuados para la carga", allowsNA: false },
 { key: "electrical_power_capacity", label: "Capacidad eléctrica suficiente", allowsNA: false },
 { key: "electrical_ups", label: "Toma protegida por UPS central", allowsNA: true },
 { key: "electrical_grounding", label: "Conexión a tierra menor a 1V", allowsNA: false },
 ],
 },
 {
 section: "3. Requerimientos de agua",
 items: [
 { key: "water_intake", label: "Tomas de agua requeridas", allowsNA: true },
 { key: "water_pressure", label: "Presión de agua adecuada (mín. 30 PSI)", allowsNA: true },
 { key: "water_drain", label: "Desagües necesarios", allowsNA: true },
 { key: "water_quality", label: "Calidad de agua adecuada", allowsNA: true },
 ],
 },
 {
 section: "4. Conexión a servicio remoto",
 items: [
 { key: "remote_network_points", label: "Puntos de red cerca del equipo", allowsNA: false },
 { key: "remote_internet", label: "Internet disponible para acceso remoto", allowsNA: false },
 ],
 },
];

const STATUS_FILTERS = [
 { value: "all", label: "Todos" },
 { value: "needs_coordination", label: "Pendiente coordinación" },
 { value: "missing_request", label: "Sin solicitud técnica" },
 { value: "in_progress", label: "En ejecución ST" },
 { value: "completed", label: "Completado ST" },
];

const RELEVANT_PUBLIC_STATUSES = new Set([
 "pending_contract",
 "contract_available",
 "delivery_dates_requested",
 "delivery_dates_submitted",
 "waiting_dispatch",
 "dispatch_ready",
]);

const RELEVANT_PRIVATE_STATUSES = new Set([
 "inspection_requested",
 "contract_available",
 "delivery_dates_requested",
 "delivery_dates_submitted",
 "waiting_dispatch",
 "dispatch_ready",
 "delivery_act_draft_ready",
 "delivery_act_tech_assigned",
 "delivery_act_logistics_signed",
 "delivery_act_generated",
]);

const getPrivateRoleParam = (user) => {
 const roles = normalizeRoles(user);
 if (!isTechnicalRole(roles)) return null;
 return isChiefTechnicalRole(roles) ? "jefe_tecnico" : "tecnico";
};

const isChiefTechnicalUser = (user) => isChiefTechnicalRole(normalizeRoles(user));

const createEmptyFst07Checklist = () => {
 const draft = {};
 FST07_QUESTIONS.forEach((group) => {
 group.items.forEach((item) => {
 draft[item.key] = "";
 });
 });
 return draft;
};

const getStep20Done = (item) => Boolean(item?.requestId && item?.inspectionScheduledDate);
const getStep07Done = (item) =>
 Boolean(item?.inspectionSiteReportLink || item?.inspectionSiteReadyForInstallation);

const toWorkflowKey = (item) => `${item.sourceType}:${item.sourceId}`;

const getSummaryByKey = (summariesByKey, item) =>
 summariesByKey[toWorkflowKey(item)] || { document_codes: [], total_documents: 0, last_document_at: null };

const getDoneCount = (summary) => {
 const codes = new Set((summary?.document_codes || []).map((code) => String(code || "").toUpperCase()));
 return TECH_STEP_DEFINITIONS.filter((step) => codes.has(step.code)).length;
};

const getNextPendingStep = (summary) => {
 const codes = new Set((summary?.document_codes || []).map((code) => String(code || "").toUpperCase()));
 return TECH_STEP_DEFINITIONS.find((step) => !codes.has(step.code)) || null;
};

const getProcedureDoneCount = (item, summary) => {
 const workflowDone = getDoneCount(summary);
 return workflowDone + (getStep20Done(item) ? 1 : 0) + (getStep07Done(item) ? 1 : 0);
};

const getUrgencyRank = (item, summary) => {
 if (!item.requestId) return 5;
 if (item.inspectionCoordinationStatus === "pending_review") return 1;
 if (!item.inspectionScheduledDate) return 2;
 if (!item.inspectionSiteReadyForInstallation) return 3;
 const doneCount = getProcedureDoneCount(item, summary);
 if (doneCount < TOTAL_PROCEDURE_STEPS) return 4;
 return 6;
};

const TechnicalProcedureWorkspace = () => {
 const navigate = useNavigate();
 const [searchParams, setSearchParams] = useSearchParams();
 const { user } = useAuth();

 const initialTab = searchParams.get("tab") === "private" ? "private" : "public";
 const initialSearch = String(searchParams.get("q") || "").trim();
 const initialStatusFilter = STATUS_FILTERS.some((item) => item.value === searchParams.get("status"))
 ? searchParams.get("status")
 : "all";

 const [activeTab, setActiveTab] = useState(initialTab);
 const [search, setSearch] = useState(initialSearch);
 const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");
 const [publicItems, setPublicItems] = useState([]);
 const [privateItems, setPrivateItems] = useState([]);
 const [workflowSummariesByKey, setWorkflowSummariesByKey] = useState({});
 const [expandedWorkflowKey, setExpandedWorkflowKey] = useState("");
 const [coordDrafts, setCoordDrafts] = useState({});
 const [reviewDrafts, setReviewDrafts] = useState({});
 const [reviewingId, setReviewingId] = useState("");
 const [coordinatingId, setCoordinatingId] = useState("");
 const [coordinationOverlay, setCoordinationOverlay] = useState({ open: false, clientName: "" });
 const [siteInspectionModal, setSiteInspectionModal] = useState({ open: false, item: null });
 const [siteInspectionDraft, setSiteInspectionDraft] = useState({
 result: "compliant",
 checklist: createEmptyFst07Checklist(),
 observations: "",
 recommendations: "",
 responsible_name: "",
 client_signer_name: "",
 follow_up_date: "",
 });
 const [siteInspectionAttemptedSubmit, setSiteInspectionAttemptedSubmit] = useState(false);
 const [siteInspectionSaving, setSiteInspectionSaving] = useState(false);
 const [publicScheduleDays, setPublicScheduleDays] = useState([]);
 const [technicalUsers, setTechnicalUsers] = useState([]);
 const isChiefTechnical = useMemo(() => isChiefTechnicalUser(user), [user]);
 const technicalRoleParam = useMemo(() => getPrivateRoleParam(user), [user]);
 const isTechnicalProcedureUser = useMemo(
 () => technicalRoleParam === "jefe_tecnico" || technicalRoleParam === "tecnico",
 [technicalRoleParam],
 );

 const syncQueryParams = useCallback(
 ({ tab = activeTab, q = search, status = statusFilter } = {}) => {
 setSearchParams((prev) => {
 const next = new URLSearchParams(prev);
 next.set("tab", tab);
 if (String(q || "").trim()) next.set("q", String(q || "").trim());
 else next.delete("q");
 if (status && status !== "all") next.set("status", status);
 else next.delete("status");
 return next;
 });
 },
 [activeTab, search, setSearchParams, statusFilter],
 );

 useEffect(() => {
 const tabParam = searchParams.get("tab");
 const qParam = String(searchParams.get("q") || "").trim();
 const statusParam = searchParams.get("status");
 if (tabParam === "public" || tabParam === "private") setActiveTab(tabParam);
 setSearch(qParam);
 setStatusFilter(STATUS_FILTERS.some((item) => item.value === statusParam) ? statusParam : "all");
 }, [searchParams]);

 const fetchWorkflowSummaries = useCallback(async (sourceType, items) => {
 const ids = (items || []).map((item) => item.sourceId).filter(Boolean);
 if (!ids.length) return [];
 return listWorkflowDocumentsSummary({
 source_type: sourceType,
 source_ids: ids,
 });
 }, []);

 const loadWorkspaceData = useCallback(async () => {
 setLoading(true);
 setError("");
 try {
 const privateRole = technicalRoleParam;
 const [publicResult, privateResult, metaResult] = await Promise.allSettled([
 listEquipmentPurchases(),
 privateRole ? getPrivatePurchasesByRole(privateRole) : Promise.resolve([]),
 getEquipmentPurchaseMeta(),
 ]);
 if (metaResult.status === "fulfilled") {
 setTechnicalUsers(Array.isArray(metaResult.value?.technical_users) ? metaResult.value.technical_users : []);
 }

 if (publicResult.status !== "fulfilled") {
 throw publicResult.reason || new Error("No se pudieron cargar compras públicas");
 }

 const publicRows = publicResult.value;
 const privateRows = privateResult.status === "fulfilled" ? privateResult.value : [];

 const normalizedPublic = (Array.isArray(publicRows) ? publicRows : [])
 .filter((row) => row?.inspection_request_id || RELEVANT_PUBLIC_STATUSES.has(row?.status))
 .map((row) => ({
 sourceType: "public_purchase",
 sourceId: String(row.id),
 requestId: row.inspection_request_id || null,
 purchaseId: row.id,
 flowType: "public",
 clientName: row.client_name || "Cliente",
 status: row.status || "",
 updatedAt: row.updated_at || null,
 inspectionMinDate: normalizeDateOnly(row.inspection_min_date) || null,
 inspectionMaxDate: normalizeDateOnly(row.inspection_max_date) || null,
 inspectionScheduledDate: normalizeDateOnly(row.inspection_scheduled_date) || null,
 inspectionProposedDate: normalizeDateOnly(row.inspection_proposed_date) || null,
 inspectionProposedNotes: row.inspection_proposed_notes || "",
 inspectionCoordinationStatus: row.inspection_coordination_status || null,
 inspectionCoordinationNotes: row.inspection_coordination_notes || null,
 assignedTechnicianId: row.inspection_assigned_technician_id || null,
 assignedTechnicianName: row.inspection_assigned_technician_name || null,
 assignedTechnicianEmail: row.inspection_assigned_technician_email || null,
 inspectionCalendarEventLink: row.inspection_calendar_event_link || null,
 inspectionActaLink: row?.extra?.inspection_acta_link || null,
 inspectionSiteStatus: row.inspection_site_status || null,
 inspectionSiteResult: row.inspection_site_result || null,
 inspectionSiteReportLink: row.inspection_site_report_link || null,
 inspectionSiteFollowUpDate: normalizeDateOnly(row.inspection_site_follow_up_date) || null,
 inspectionSiteReadyForInstallation: Boolean(row.inspection_site_ready_for_installation),
 inspectionSiteChecklist:
 row.inspection_site_checklist && typeof row.inspection_site_checklist === "object"
 ? row.inspection_site_checklist
 : createEmptyFst07Checklist(),
 inspectionSiteObservations: row.inspection_site_observations || "",
 inspectionSiteRecommendations: row.inspection_site_recommendations || "",
 inspectionSiteResponsibleName: row.inspection_site_responsible_name || "",
 inspectionSiteClientSignerName: row.inspection_site_client_signer_name || "",
 inspectionSiteHistory: Array.isArray(row.inspection_site_history) ? row.inspection_site_history : [],
 }));

 const normalizedPrivate = (Array.isArray(privateRows) ? privateRows : [])
 .filter((row) => row?.inspection_request_id || RELEVANT_PRIVATE_STATUSES.has(row?.status))
 .map((row) => {
 const snapshot = row.client_snapshot || {};
 return {
 sourceType: "private_purchase",
 sourceId: String(row.id),
 requestId: row.inspection_request_id || null,
 purchaseId: row.id,
 flowType: "private",
 clientName: snapshot.commercial_name || snapshot.client_name || snapshot.name || "Cliente",
 status: row.status || "",
 updatedAt: row.updated_at || null,
 inspectionMinDate: normalizeDateOnly(row.inspection_min_date) || null,
 inspectionMaxDate: normalizeDateOnly(row.inspection_max_date) || null,
 inspectionScheduledDate: normalizeDateOnly(row.inspection_scheduled_date) || null,
 inspectionProposedDate: normalizeDateOnly(row.inspection_proposed_date) || null,
 inspectionProposedNotes: row.inspection_proposed_notes || "",
 inspectionCoordinationStatus: row.inspection_coordination_status || null,
 inspectionCoordinationNotes: row.inspection_coordination_notes || null,
 inspectionActaLink:
 row.inspection_acta_link ||
 row.inspection_acta_document_link ||
 (row.inspection_acta_document_id
 ? `https://drive.google.com/file/d/${row.inspection_acta_document_id}/view`
 : null),
 inspectionSiteStatus: row.inspection_site_status || null,
 inspectionSiteResult: row.inspection_site_result || null,
 inspectionSiteReportLink: row.inspection_site_report_link || null,
 inspectionSiteFollowUpDate: normalizeDateOnly(row.inspection_site_follow_up_date) || null,
 inspectionSiteReadyForInstallation: Boolean(row.inspection_site_ready_for_installation),
 inspectionSiteChecklist:
 row.inspection_site_checklist && typeof row.inspection_site_checklist === "object"
 ? row.inspection_site_checklist
 : createEmptyFst07Checklist(),
 inspectionSiteObservations: row.inspection_site_observations || "",
 inspectionSiteRecommendations: row.inspection_site_recommendations || "",
 inspectionSiteResponsibleName: row.inspection_site_responsible_name || "",
 inspectionSiteClientSignerName: row.inspection_site_client_signer_name || "",
 inspectionSiteHistory: Array.isArray(row.inspection_site_history) ? row.inspection_site_history : [],
 };
 });

 const [publicSummaries, privateSummaries] = await Promise.all([
 fetchWorkflowSummaries("public_purchase", normalizedPublic),
 fetchWorkflowSummaries("private_purchase", normalizedPrivate),
 ]);

 const nextSummaryMap = {};
 (publicSummaries || []).forEach((row) => {
 nextSummaryMap[`public_purchase:${String(row.source_id)}`] = row;
 });
 (privateSummaries || []).forEach((row) => {
 nextSummaryMap[`private_purchase:${String(row.source_id)}`] = row;
 });

 setPublicItems(normalizedPublic);
 setPrivateItems(normalizedPrivate);
 setWorkflowSummariesByKey(nextSummaryMap);
 } catch (loadError) {
 setError(loadError?.message || "No se pudo cargar el workspace técnico");
 } finally {
 setLoading(false);
 }
 }, [fetchWorkflowSummaries, technicalRoleParam]);

 useEffect(() => {
 loadWorkspaceData();
 }, [loadWorkspaceData]);

 useEffect(() => {
 let cancelled = false;
 const loadSchedule = async () => {
 try {
 const candidates = publicItems.filter((item) => item.inspectionMinDate && item.inspectionMaxDate);
 if (!candidates.length) {
 if (!cancelled) setPublicScheduleDays([]);
 return;
 }
 const from = candidates.map((item) => item.inspectionMinDate).sort()[0];
 const to = candidates.map((item) => item.inspectionMaxDate).sort().slice(-1)[0];
 const calendar = await getPublicPurchaseTechnicalSchedule({ from, to });
 if (!cancelled) setPublicScheduleDays(Array.isArray(calendar?.days) ? calendar.days : []);
 } catch (_error) {
 if (!cancelled) setPublicScheduleDays([]);
 }
 };
 loadSchedule();
 return () => {
 cancelled = true;
 };
 }, [publicItems]);

 const handleCoordinateInspection = useCallback(
 async (item) => {
 const draft = coordDrafts[item.sourceId] || {};
 const inspectionDate = normalizeDateOnly(draft.inspection_date || "");
 if (!inspectionDate) {
 return;
 }
 setCoordinatingId(item.sourceId);
 setCoordinationOverlay({ open: true, clientName: item.clientName || "cliente" });
 setError("");
 try {
     await coordinateInspectionDate(item.sourceId, {
     inspection_date: inspectionDate,
     notes: draft.notes || null,
     assigned_technician_id: draft.assigned_technician_id || item.assignedTechnicianId || null,
     });
 setPublicItems((prev) =>
 prev.map((row) =>
 row.sourceId === item.sourceId
 ? {
 ...row,
 inspectionScheduledDate: inspectionDate,
 inspectionCoordinationStatus: "accepted",
 }
 : row,
 ),
 );
 await loadWorkspaceData();
 } catch (coordError) {
 setError(coordError?.response?.data?.message || coordError?.message || "No se pudo coordinar la inspección");
 } finally {
 setCoordinationOverlay({ open: false, clientName: "" });
 setCoordinatingId("");
 }
 },
 [coordDrafts, loadWorkspaceData],
 );

 const handleReviewInspectionDate = useCallback(
 async (item, decision) => {
 if (!item?.sourceId) return;
 if (decision !== "accept" && decision !== "reject") return;
 setReviewingId(item.sourceId);
 setError("");
 try {
 const draft = reviewDrafts[item.sourceId] || {};
 const payload = {
 decision,
 review_notes: draft.review_notes || null,
 };
 if (item.flowType === "public") {
 await reviewInspectionDate(item.sourceId, payload);
 } else {
 await reviewPrivatePurchaseInspectionDate(item.sourceId, payload);
 }
 await loadWorkspaceData();
 } catch (reviewError) {
 setError(
 reviewError?.response?.data?.message ||
 reviewError?.message ||
 "No se pudo registrar la decisión de coordinación",
 );
 } finally {
 setReviewingId("");
 }
 },
 [loadWorkspaceData, reviewDrafts],
 );

 const openSiteInspection = useCallback(
 (item) => {
 const nextChecklist = createEmptyFst07Checklist();
 const sourceChecklist = item?.inspectionSiteChecklist || {};
 Object.keys(nextChecklist).forEach((key) => {
 const raw = String(sourceChecklist?.[key] || "").trim().toUpperCase();
 nextChecklist[key] = raw === "SI" || raw === "NO" || raw === "N/A" ? raw : "";
 });
 setSiteInspectionDraft({
 result: item?.inspectionSiteResult === "non_compliant" ? "non_compliant" : "compliant",
 checklist: nextChecklist,
 observations: item?.inspectionSiteObservations || "",
 recommendations: item?.inspectionSiteRecommendations || "",
 responsible_name: user?.fullname || user?.name || user?.email || "",
 client_signer_name: item?.inspectionSiteClientSignerName || "",
 follow_up_date: item?.inspectionSiteFollowUpDate || "",
 });
 setSiteInspectionAttemptedSubmit(false);
 setSiteInspectionModal({ open: true, item });
 },
 [user],
);

const closeSiteInspection = useCallback(() => {
if (siteInspectionSaving) return;
 setSiteInspectionAttemptedSubmit(false);
setSiteInspectionModal({ open: false, item: null });
}, [siteInspectionSaving]);

 const siteInspectionChecklistErrors = useMemo(() => {
 const nextErrors = {};
 FST07_QUESTIONS.forEach((group) => {
 group.items.forEach((question) => {
 const value = String(siteInspectionDraft.checklist?.[question.key] || "").trim().toUpperCase();
 if (!value) {
 nextErrors[question.key] = "Selecciona una opción";
 return;
 }
 if (value === "N/A" && !question.allowsNA) {
 nextErrors[question.key] = "N/A no aplica para este ítem";
 }
 });
 });
 return nextErrors;
 }, [siteInspectionDraft.checklist]);

 const siteInspectionChecklistStats = useMemo(() => {
 const total = FST07_QUESTIONS.reduce((acc, group) => acc + (group.items?.length || 0), 0);
 const answered = total - Object.keys(siteInspectionChecklistErrors).length;
 const pending = Math.max(0, total - answered);
 return { total, answered, pending };
 }, [siteInspectionChecklistErrors]);

 const handleSubmitSiteInspection = useCallback(async () => {
 const item = siteInspectionModal.item;
 if (!item?.sourceId) return;
 setSiteInspectionAttemptedSubmit(true);
 if (Object.keys(siteInspectionChecklistErrors).length) {
 setError("Checklist F.ST-07 incompleto. Completa todos los ítems requeridos.");
 return;
 }
 if (!String(siteInspectionDraft.client_signer_name || "").trim()) {
 setError("Debes registrar el nombre de quien firma por parte del cliente.");
 return;
 }
 if (siteInspectionDraft.result === "non_compliant" && !normalizeDateOnly(siteInspectionDraft.follow_up_date)) {
 setError("Debes seleccionar fecha de reinspección cuando el área no cumple.");
 return;
 }

 setSiteInspectionSaving(true);
 setError("");
 try {
 const payload = {
 result: siteInspectionDraft.result,
 checklist: siteInspectionDraft.checklist,
 observations: siteInspectionDraft.observations || null,
 recommendations: siteInspectionDraft.recommendations || null,
 client_signer_name: siteInspectionDraft.client_signer_name || null,
 follow_up_date:
 siteInspectionDraft.result === "non_compliant"
 ? normalizeDateOnly(siteInspectionDraft.follow_up_date)
 : null,
 is_reinspection: item?.inspectionSiteStatus === "non_compliant_reinspection_pending",
 expected_updated_at: item?.updatedAt || null,
 };
 if (item.flowType === "public") {
 await registerPublicPurchaseSiteInspection(item.sourceId, payload);
 } else {
 await registerPrivatePurchaseSiteInspection(item.sourceId, payload);
 }
 setSiteInspectionModal({ open: false, item: null });
 setSiteInspectionAttemptedSubmit(false);
 await loadWorkspaceData();
 } catch (submitError) {
 setError(
 submitError?.response?.data?.message ||
 submitError?.message ||
 "No se pudo registrar la inspección en sitio",
 );
 } finally {
 setSiteInspectionSaving(false);
 }
 }, [
 loadWorkspaceData,
 siteInspectionChecklistErrors,
 siteInspectionDraft,
 siteInspectionModal.item,
 ]);

 const activeItems = useMemo(
 () => (activeTab === "private" ? privateItems : publicItems),
 [activeTab, privateItems, publicItems],
 );

 const filteredItems = useMemo(() => {
 const term = search.trim().toLowerCase();
 const byText = !term
 ? activeItems
 : activeItems.filter((item) => {
 const haystack =
 `${item.clientName} ${item.status} ${item.purchaseId} ${item.requestId || ""}`.toLowerCase();
 return haystack.includes(term);
 });

 const byStatus = byText.filter((item) => {
 if (statusFilter === "all") return true;
 const summary = getSummaryByKey(workflowSummariesByKey, item);
 const doneCount = getProcedureDoneCount(item, summary);
 if (statusFilter === "needs_coordination") return Boolean(item.requestId) && !item.inspectionScheduledDate;
 if (statusFilter === "missing_request") return !item.requestId;
 if (statusFilter === "in_progress") return doneCount > 0 && doneCount < TOTAL_PROCEDURE_STEPS;
 if (statusFilter === "completed") return doneCount >= TOTAL_PROCEDURE_STEPS;
 return true;
 });

 return byStatus
 .slice()
 .sort((a, b) => {
 const rankA = getUrgencyRank(a, getSummaryByKey(workflowSummariesByKey, a));
 const rankB = getUrgencyRank(b, getSummaryByKey(workflowSummariesByKey, b));
 if (rankA !== rankB) return rankA - rankB;
 return String(a.clientName || "").localeCompare(String(b.clientName || ""), "es");
 });
 }, [activeItems, search, statusFilter, workflowSummariesByKey]);

 const openStep = useCallback(
 (item, step) => {
 const params = new URLSearchParams({
 source_type: item.sourceType,
 source_id: item.sourceId,
 });
 if (item.requestId) params.set("request_id", String(item.requestId));
 navigate(`${step.route}?${params.toString()}`);
 },
 [navigate],
 );

 const openPurchaseWorkspace = useCallback(
 (flowType) => {
 navigate(`/dashboard/purchases/workspace?tab=${flowType === "private" ? "private" : "public"}`);
 },
 [navigate],
 );

 const openExternalCasesWorkspace = useCallback(() => {
 navigate("/dashboard/servicio-tecnico/casos-externos");
 }, [navigate]);

 const handleTabChange = (tab) => {
 setActiveTab(tab);
 syncQueryParams({ tab });
 };

 const handleSearchChange = (value) => {
 setSearch(value);
 syncQueryParams({ q: value });
 };

 const handleStatusFilterChange = (value) => {
 setStatusFilter(value);
 syncQueryParams({ status: value });
 };

 return (
 <div className="space-y-4">
 <div className="rounded-2xl border border-slate-200 bg-white p-5">
 <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-slate-900">Workspace Técnico de Procedimiento</h1>
 <p className="text-sm text-slate-600">
 Ejecución unificada ST-01-01 para compras públicas y privadas.
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <Button variant="outline" icon={FiExternalLink} onClick={openExternalCasesWorkspace}>
 Casos externos ST-01-04
 </Button>
 <Button variant="secondary" icon={FiRefreshCw} onClick={loadWorkspaceData} loading={loading}>
 Actualizar
 </Button>
 </div>
 </div>

 <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[auto_auto_auto_1fr_auto] md:items-center">
 <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
 <button
 type="button"
 onClick={() => handleTabChange("public")}
 className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
 activeTab === "public" ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:bg-white"
 }`}
 >
 Compras públicas
 </button>
 <button
 type="button"
 onClick={() => handleTabChange("private")}
 className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
 activeTab === "private" ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:bg-white"
 }`}
 >
 Compras privadas
 </button>
 </div>

 <div className="text-sm text-slate-600">
 Procesos: <span className="font-semibold text-slate-900">{activeItems.length}</span>
 </div>

 <select
 value={statusFilter}
 onChange={(event) => handleStatusFilterChange(event.target.value)}
 className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
 >
 {STATUS_FILTERS.map((item) => (
 <option key={item.value} value={item.value}>
 {item.label}
 </option>
 ))}
 </select>

 <div className="relative">
 <FiSearch className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
 <input
 value={search}
 onChange={(event) => handleSearchChange(event.target.value)}
 placeholder="Buscar por cliente, estado o ID"
 className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
 />
 </div>

 <Button
 variant="outline"
 icon={FiExternalLink}
 onClick={() => openPurchaseWorkspace(activeTab)}
 >
 Ver workspace de compras
 </Button>
 </div>
 </div>

 {error ? (
 <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
 {error}
 </div>
 ) : null}

 {filteredItems.length === 0 ? (
 <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
 No hay procesos técnicos para mostrar con los filtros actuales.
 </div>
 ) : (
 <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
 {filteredItems.map((item) => {
 const key = toWorkflowKey(item);
 const isWorkflowExpanded = expandedWorkflowKey === key;
 const summary = getSummaryByKey(workflowSummariesByKey, item);
 const docCodes = new Set((summary.document_codes || []).map((code) => String(code || "").toUpperCase()));
 const fst20Done = getStep20Done(item);
 const fst07Done = getStep07Done(item);
 const doneCount = getProcedureDoneCount(item, summary);
 const progressPercent = Math.round((doneCount / TOTAL_PROCEDURE_STEPS) * 100);
 const nextWorkflowStep = getNextPendingStep(summary);

 const draft = coordDrafts[item.sourceId] || {};
 const selectedInspectionDate = draft.inspection_date || "";
 const selectedDaySchedule = publicScheduleDays.find((day) => day.date === selectedInspectionDate);
 const selectedDateIsFull = Boolean(
 selectedDaySchedule && Array.isArray(selectedDaySchedule.items) && selectedDaySchedule.items.length >= 3,
 );
 const canCoordinateHere = Boolean(
 isChiefTechnical &&
 item.flowType === "public" &&
 item.requestId &&
 !item.inspectionScheduledDate &&
 item.inspectionMinDate &&
 item.inspectionMaxDate,
 );
 const canReviewCoordination = Boolean(
 isChiefTechnical &&
 item.requestId &&
 item.inspectionCoordinationStatus === "pending_review" &&
 item.inspectionProposedDate,
 );
 const canRegisterSiteInspection = Boolean(
 isTechnicalProcedureUser && fst20Done,
 );
 const siteNeedsReinspection = item.inspectionSiteStatus === "non_compliant_reinspection_pending";
 const proposedDateLabel = item.inspectionProposedDate ? formatDateOnlyEs(item.inspectionProposedDate) : "Pendiente";
 const fst20StatusText = !item.requestId
 ? "Pendiente: ACP Comercial aún no genera la solicitud"
 : item.inspectionCoordinationStatus === "pending_review"
 ? `Pendiente aprobación de jefatura técnica · propuesta: ${proposedDateLabel}`
 : item.inspectionCoordinationStatus === "rejected"
 ? "Propuesta rechazada, comercial debe coordinar una nueva fecha"
 : !item.inspectionScheduledDate
 ? "Pendiente: coordinación de fecha exacta"
 : `Listo: coordinación confirmada para ${formatDateOnlyEs(item.inspectionScheduledDate)}`;
 const fst07StatusText = !fst20Done
 ? "Pendiente: primero coordinar F.ST-20"
 : fst07Done
 ? siteNeedsReinspection
 ? `Registrada con observaciones · reinspección: ${formatDateOnlyEs(item.inspectionSiteFollowUpDate)}`
 : "Listo: acta F.ST-07 generada"
 : siteNeedsReinspection
 ? `Reinspección pendiente para ${formatDateOnlyEs(item.inspectionSiteFollowUpDate)}`
 : "Pendiente: inspección en sitio";
 const nextActionLabel = canReviewCoordination
 ? "Revisar propuesta F.ST-20"
 : !fst20Done
 ? "Continuar: F.ST-20"
 : !fst07Done
 ? "Continuar: F.ST-07"
 : nextWorkflowStep
 ? `Continuar: ${nextWorkflowStep.code}`
 : "Flujo ST completo";
 const canContinue =
 canReviewCoordination ||
 (!fst20Done && canCoordinateHere) ||
 (fst20Done && !fst07Done && canRegisterSiteInspection) ||
 Boolean(fst20Done && fst07Done && nextWorkflowStep && item.requestId);

 return (
 <article key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-xs uppercase tracking-wide text-slate-500">
 {item.flowType === "public" ? "Compra pública" : "Compra privada"} #{item.purchaseId}
 </p>
 <h3 className="mt-1 text-base font-semibold text-slate-900">{item.clientName}</h3>
 <p className="text-xs text-slate-600">
 Estado: {toStatusLabel(item.status)}
 {item.inspectionScheduledDate ? ` · Inspección: ${formatDateOnlyEs(item.inspectionScheduledDate)}` : ""}
 </p>
 {item.inspectionCoordinationStatus === "accepted" && item.inspectionScheduledDate && (
 <p className="text-xs font-medium text-emerald-700">Coordinación lista</p>
 )}
 {!item.inspectionScheduledDate && item.inspectionMinDate && item.inspectionMaxDate && (
 <p className="text-xs text-slate-600">
 Ventana comercial: {formatDateOnlyEs(item.inspectionMinDate)} - {formatDateOnlyEs(item.inspectionMaxDate)}
 </p>
 )}
 {item.requestId ? (
 <p className="text-xs text-slate-500">Solicitud técnica #{item.requestId}</p>
 ) : (
 <p className="text-xs text-amber-700">Sin solicitud técnica asociada aún</p>
 )}
 </div>
 <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
 {doneCount}/{TOTAL_PROCEDURE_STEPS} pasos ST
 </span>
 </div>

 <div className="mt-3">
 <div className="h-2 w-full rounded-full bg-slate-200">
 <div
 className="h-2 rounded-full bg-slate-800 transition-all"
 style={{ width: `${progressPercent}%` }}
 />
 </div>
 </div>

 {canCoordinateHere && (
 <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
 <p className="text-xs font-medium text-slate-700">Coordinación de fecha (Jefe Técnico)</p>
 <input
 type="date"
 value={selectedInspectionDate}
 min={item.inspectionMinDate || undefined}
 max={item.inspectionMaxDate || undefined}
 onChange={(event) =>
 setCoordDrafts((prev) => ({
 ...prev,
 [item.sourceId]: {
 ...prev[item.sourceId],
 inspection_date: event.target.value,
 },
 }))
 }
 className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
 />
 <select
 value={draft.assigned_technician_id || item.assignedTechnicianId || ""}
 onChange={(event) =>
 setCoordDrafts((prev) => ({
 ...prev,
 [item.sourceId]: {
 ...prev[item.sourceId],
 assigned_technician_id: event.target.value,
 },
 }))
 }
 className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
 >
 <option value="">Asignarme como técnico responsable</option>
 {technicalUsers.map((tech) => (
 <option key={tech.id} value={tech.id}>
 {tech.name} · {tech.role}
 </option>
 ))}
 </select>
 <textarea
 rows={2}
 value={draft.notes || ""}
 onChange={(event) =>
 setCoordDrafts((prev) => ({
 ...prev,
 [item.sourceId]: {
 ...prev[item.sourceId],
 notes: event.target.value,
 },
 }))
 }
 placeholder="Notas de coordinación (opcional)"
 className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
 />
 <Button
 size="sm"
 onClick={() => handleCoordinateInspection(item)}
 loading={coordinatingId === item.sourceId}
 disabled={!selectedInspectionDate || selectedDateIsFull}
 >
 Coordinar fecha exacta
 </Button>
 {selectedDateIsFull && (
 <p className="text-xs text-amber-700">
 El cronograma técnico está lleno para esa fecha.
 </p>
 )}
 </div>
 )}

 {canReviewCoordination && (
 <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2">
 <p className="text-xs font-semibold text-indigo-800">
 Revisión de propuesta F.ST-20 (Jefatura Técnica)
 </p>
 <p className="text-xs text-indigo-700">
 Fecha propuesta por comercial: <span className="font-semibold">{proposedDateLabel}</span>
 </p>
 <textarea
 rows={2}
 value={reviewDrafts[item.sourceId]?.review_notes || ""}
 onChange={(event) =>
 setReviewDrafts((prev) => ({
 ...prev,
 [item.sourceId]: {
 ...prev[item.sourceId],
 review_notes: event.target.value,
 },
 }))
 }
 placeholder="Notas de revisión (opcional)"
 className="w-full rounded border border-indigo-200 bg-white px-2 py-1.5 text-sm"
 />
 <div className="flex flex-wrap gap-2">
 <Button
 size="sm"
 variant="success"
 loading={reviewingId === item.sourceId}
 onClick={() => handleReviewInspectionDate(item, "accept")}
 >
 Aprobar fecha
 </Button>
 <Button
 size="sm"
 variant="warning"
 loading={reviewingId === item.sourceId}
 onClick={() => handleReviewInspectionDate(item, "reject")}
 >
 Rechazar fecha
 </Button>
 </div>
 </div>
 )}

 <div className="mt-3 space-y-2">
 <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
 <div className="text-sm">
 <span className={fst20Done ? "font-medium text-emerald-700" : "text-slate-700"}>
 F.ST-20 · Solicitud de inspección de ambiente
 </span>
 <p className="text-xs text-slate-500">{fst20StatusText}</p>
 </div>
 <div className="flex items-center gap-2">
 {item.inspectionActaLink && (
 <a
 href={item.inspectionActaLink}
 target="_blank"
 rel="noreferrer"
 className="text-xs font-medium text-slate-700 underline"
 >
 Ver acta
 </a>
 )}
 <span
 className={`rounded-full px-2 py-0.5 text-xs font-medium ${
 fst20Done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
 }`}
 >
 {fst20Done ? "Listo" : "Pendiente"}
 </span>
 </div>
 </div>

 <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
 <div className="text-sm">
 <span className={fst07Done ? "font-medium text-emerald-700" : "text-slate-700"}>
 F.ST-07 · Inspección en sitio
 </span>
 <p className="text-xs text-slate-500">{fst07StatusText}</p>
 </div>
 <div className="flex items-center gap-2">
 {item.inspectionSiteReportLink && (
 <a
 href={item.inspectionSiteReportLink}
 target="_blank"
 rel="noreferrer"
 className="text-xs font-medium text-slate-700 underline"
 >
 Ver F.ST-07
 </a>
 )}
 {canRegisterSiteInspection && (
 <Button size="sm" variant={fst07Done ? "secondary" : "primary"} onClick={() => openSiteInspection(item)}>
 {siteNeedsReinspection ? "Registrar reinspección" : "Registrar inspección"}
 </Button>
 )}
 </div>
 </div>

 {TECH_STEP_DEFINITIONS.map((step) => {
 const done = docCodes.has(step.code);
 return (
 <div
 key={`${key}-${step.code}`}
 className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
 >
 <div className="text-sm">
 <span className={done ? "font-medium text-emerald-700" : "text-slate-700"}>
 {step.code} · {step.label}
 </span>
 </div>
 <Button
 size="sm"
 variant={done ? "secondary" : "primary"}
 disabled={!item.requestId}
 onClick={() => openStep(item, step)}
 >
 {done ? "Ver" : "Ejecutar"}
 </Button>
 </div>
 );
 })}
 </div>

 <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
 <div className="flex items-center justify-between gap-2">
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Expediente ST</p>
 <Button
 size="sm"
 variant="secondary"
 onClick={() => setExpandedWorkflowKey((prev) => (prev === key ? "" : key))}
 >
 {isWorkflowExpanded ? "Ocultar expediente" : "Ver expediente"}
 </Button>
 </div>
 {!isWorkflowExpanded ? (
 <p className="mt-1 text-xs text-slate-600">
 Resumen: {summary?.total_documents || 0} documento{summary?.total_documents === 1 ? "" : "s"}
 {summary?.last_document_at ? ` · Ultimo: ${formatDateOnlyEs(summary.last_document_at)}` : ""}
 </p>
 ) : (
 <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
 <WorkflowDocumentsPanel
 sourceType={item.sourceType}
 sourceId={item.sourceId}
 summary={summary}
 />
 <WorkflowTimeline
 sourceType={item.sourceType}
 sourceId={item.sourceId}
 procedureCode="ST-01-01"
 />
 </div>
 )}
 </div>

 <div className="mt-3 flex flex-wrap gap-2">
 <Button
 size="sm"
 variant="outline"
 disabled={!canContinue}
 onClick={() => {
 if (canReviewCoordination) return;
 if (!fst20Done && canCoordinateHere) return;
 if (fst20Done && !fst07Done && canRegisterSiteInspection) {
 openSiteInspection(item);
 return;
 }
 if (fst20Done && fst07Done && nextWorkflowStep) {
 openStep(item, nextWorkflowStep);
 }
 }}
 >
 {nextActionLabel}
 </Button>
 <Button size="sm" variant="secondary" onClick={() => openPurchaseWorkspace(item.flowType)}>
 Ver flujo completo
 </Button>
 </div>
 </article>
 );
 })}
 </div>
 )}
 <Modal
 open={siteInspectionModal.open}
 onClose={closeSiteInspection}
 title={`F.ST-07 · Inspección en sitio ${siteInspectionModal.item?.clientName ? `- ${siteInspectionModal.item.clientName}` : ""}`}
 maxWidth="max-w-5xl"
 >
 <div className="space-y-4">
 <SiteInspectionSummaryCard
 result={siteInspectionDraft.result}
 scheduledDate={siteInspectionModal.item?.inspectionScheduledDate}
 followUpDate={siteInspectionDraft.follow_up_date}
 answeredCount={siteInspectionChecklistStats.answered}
 totalCount={siteInspectionChecklistStats.total}
 pendingCount={siteInspectionChecklistStats.pending}
 reinspectionPending={siteInspectionModal.item?.inspectionSiteStatus === "non_compliant_reinspection_pending"}
 />
 {Array.isArray(siteInspectionModal.item?.inspectionSiteHistory) &&
 siteInspectionModal.item.inspectionSiteHistory.length > 0 ? (
 <p className="text-xs text-slate-600">
 Historial de inspecciones registradas:{" "}
 <span className="font-semibold text-slate-800">
 {siteInspectionModal.item.inspectionSiteHistory.length}
 </span>
 </p>
 ) : null}

 <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
 <div className="text-sm text-slate-700">
 Responsable (automático)
 <div className="mt-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
 {siteInspectionDraft.responsible_name || user?.fullname || user?.name || user?.email || "N/D"}
 </div>
 </div>
 <label className="text-sm text-slate-700">
 Nombre del firmante del cliente
 <input
 type="text"
 value={siteInspectionDraft.client_signer_name || ""}
 onChange={(event) =>
 setSiteInspectionDraft((prev) => ({ ...prev, client_signer_name: event.target.value }))
 }
 placeholder="Ej: Juan Pérez"
 className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
 />
 {siteInspectionAttemptedSubmit && !String(siteInspectionDraft.client_signer_name || "").trim() ? (
 <p className="mt-1 text-xs text-rose-700">Campo obligatorio para emitir F.ST-07</p>
 ) : null}
 </label>
 </div>

 <div className="text-sm text-slate-700">
 Resultado del área
 <div className="mt-2 flex flex-wrap gap-4">
 <label className="inline-flex items-center gap-2">
 <input
 type="radio"
 name="site-result"
 checked={siteInspectionDraft.result === "compliant"}
 onChange={() => setSiteInspectionDraft((prev) => ({ ...prev, result: "compliant" }))}
 />
 Cumple
 </label>
 <label className="inline-flex items-center gap-2">
 <input
 type="radio"
 name="site-result"
 checked={siteInspectionDraft.result === "non_compliant"}
 onChange={() => setSiteInspectionDraft((prev) => ({ ...prev, result: "non_compliant" }))}
 />
 No cumple (requiere reinspección)
 </label>
 </div>
 </div>

 {siteInspectionDraft.result === "non_compliant" && (
 <label className="text-sm text-slate-700">
 Fecha propuesta de reinspección
 <input
 type="date"
 value={siteInspectionDraft.follow_up_date || ""}
 onChange={(event) =>
 setSiteInspectionDraft((prev) => ({ ...prev, follow_up_date: event.target.value }))
 }
 className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm md:w-64"
 />
 {siteInspectionAttemptedSubmit && !normalizeDateOnly(siteInspectionDraft.follow_up_date) ? (
 <p className="mt-1 text-xs text-rose-700">Debes definir la fecha de reinspección</p>
 ) : null}
 </label>
 )}

 <SiteInspectionStepper
 sections={FST07_QUESTIONS}
 checklist={siteInspectionDraft.checklist}
 errors={siteInspectionChecklistErrors}
 touched={siteInspectionAttemptedSubmit}
 disabled={siteInspectionSaving}
 onChange={(key, value) =>
 setSiteInspectionDraft((prev) => ({
 ...prev,
 checklist: {
 ...prev.checklist,
 [key]: value,
 },
 }))
 }
 />

 <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
 <label className="text-sm text-slate-700">
 Observaciones
 <textarea
 rows={3}
 value={siteInspectionDraft.observations || ""}
 onChange={(event) =>
 setSiteInspectionDraft((prev) => ({ ...prev, observations: event.target.value }))
 }
 className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
 />
 </label>
 <label className="text-sm text-slate-700">
 Recomendaciones
 <textarea
 rows={3}
 value={siteInspectionDraft.recommendations || ""}
 onChange={(event) =>
 setSiteInspectionDraft((prev) => ({ ...prev, recommendations: event.target.value }))
 }
 className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
 />
 </label>
 </div>

 <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
 <Button variant="secondary" onClick={closeSiteInspection} disabled={siteInspectionSaving}>
 Cancelar
 </Button>
 <Button onClick={handleSubmitSiteInspection} loading={siteInspectionSaving}>
 Guardar F.ST-07
 </Button>
 </div>
 </div>
 </Modal>
 {coordinationOverlay.open && (
 <ProcessingOverlay
 title={`Coordinando inspección para ${coordinationOverlay.clientName}`}
 steps={[
 { id: "send", label: "Registrando fecha exacta" },
 { id: "refresh", label: "Actualizando workspace técnico" },
 ]}
 activeStep="send"
 />
 )}
 </div>
 );
};

export default TechnicalProcedureWorkspace;
