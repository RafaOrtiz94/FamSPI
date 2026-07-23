import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiActivity, FiAlertTriangle, FiCalendar, FiCheck, FiChevronDown, FiClipboard, FiExternalLink, FiFileText, FiRefreshCw, FiSave, FiUpload, FiX } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../../core/auth/AuthContext";
import { recordBusinessCaseTelemetry } from "../../../../core/utils/businessCaseTelemetry";
import { promptDialog } from "../../../../core/ui/utils/promptDialog";
import SectionEditorBadge from "./SectionEditorBadge";
import {
 getDeterminationsStatDocumentInfo,
 parseDeterminationsQuantitiesFile,
 requestBusinessCaseEnvironmentInspection,
 uploadDeterminationsStatDocument,
} from "../../../../core/api/businessCaseApi";

const REACTIVO_TYPES = new Set(["reactivo", "determinacion"]);
const TECNICO_TYPES = new Set(["control", "calibrador", "consumible", "material"]);
const isAffirmative = (value) => {
 const normalized = String(value ?? "").trim().toLowerCase();
 return value === true || ["true", "1", "yes", "si", "sí"].includes(normalized);
};
// Public BC: only acp_comercial. Private BC: only backoffice.
const PUBLIC_BC_TYPES = new Set(["public", "comodato_publico"]);
// Roles que ejecutan la parte técnica (inspección, actas, calibradores propios)
const TECNICO_ROLES = new Set(["jefe_tecnico", "jefe_servicio"]);
// BUG-01: jefe_comercial y jefe_de_comercial son editores directos de TECNICO_TYPES
// (calibradores, controles, materiales — según PASO BC-4 del flujo documentado)
const TECNICO_EDIT_ROLES = new Set(["jefe_tecnico", "jefe_servicio", "jefe_comercial", "jefe_de_comercial"]);
const ADMIN_ROLES = new Set(["administrador", "super_admin"]);
const ROW_WINDOW_STEP = 24;
const IDEMPOTENCY_TTL_MS = 60 * 1000;
const DET_DEBUG_VERSION = "2026-05-13-det-save-v5";
const DET_DEBUG_ENABLED = (() => {
 const envFlag = String(process.env.REACT_APP_BC_CONSUMPTION_DEBUG || "").trim().toLowerCase() === "true";
 if (envFlag) return true;
 if (typeof window === "undefined") return false;
 const search = String(window.location.search || "").toLowerCase();
 if (search.includes("bc_consumption_debug=1") || search.includes("bcdebug=1")) return true;
 try {
 const localFlag = String(window.localStorage?.getItem("bc_consumption_debug") || "").trim().toLowerCase();
 return localFlag === "1" || localFlag === "true" || localFlag === "yes" || localFlag === "on";
 } catch (_err) {
 return false;
 }
})();

const debugInfo = (...args) => {
 if (!DET_DEBUG_ENABLED) return;
 console.info(...args);
};

const debugWarn = (...args) => {
 if (!DET_DEBUG_ENABLED) return;
 console.warn(...args);
};

const debugError = (...args) => {
 if (!DET_DEBUG_ENABLED) return;
 console.error(...args);
};

const summarizeItemsForAudit = (items = [], limit = 30) => {
 const safe = Array.isArray(items) ? items : [];
 return {
 total: safe.length,
 nonZero: safe.filter((item) => Number(item?.annualQty ?? item?.annualQuantity ?? 0) > 0).length,
 zeros: safe.filter((item) => Number(item?.annualQty ?? item?.annualQuantity ?? 0) <= 0).length,
 sample: safe.slice(0, limit).map((item) => ({
 key: item?.key || null,
 type: item?.type || null,
 itemId: item?.itemId || null,
 name: item?.name || null,
 source: item?.source || null,
 catalogId: item?.catalogId ?? null,
 equipmentId: item?.equipmentId ?? null,
 annualQty: Number(item?.annualQty ?? item?.annualQuantity ?? 0),
 })),
 };
};

const logFrontAudit = (label, payload = {}) => {
 try {
 console.groupCollapsed(label);
 Object.entries(payload).forEach(([key, value]) => console.log(key, value));
 console.groupEnd();
 } catch (_err) {
 console.log(label, payload);
 }
};

const getNaturalErrorMessage = (err, fallback) => {
 const status = Number(err?.response?.status || 0);
 const raw = String(err?.response?.data?.message || "").trim();
 const code = String(err?.response?.data?.code || "").trim().toUpperCase();
 if (status === 403) return "No tienes permiso para realizar esta acción en esta etapa.";
 if (status === 409 && code.startsWith("BC_INSPECTION")) return raw || fallback;
 if (status === 409 && code === "DETERMINATIONS_SLA_EXPIRED_EXTENSION_REQUIRED") return raw || fallback;
 if (status === 409) return "La información cambió mientras trabajabas. Recarga esta sección e intenta nuevamente.";
 if (!raw) return fallback;
 if (/\b(4\d\d|5\d\d)\b/.test(raw) || /forbidden|conflict|unauthorized|status/i.test(raw)) return fallback;
 return raw;
};

const formatSelectedFileSize = (bytes) => {
 const size = Number(bytes || 0);
 if (!Number.isFinite(size) || size <= 0) return "0 KB";
 if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
 return `${Math.max(1, Math.round(size / 1024))} KB`;
};

const completeDeterminationsSection = async (bcId, reason = "determinaciones_finalizadas_workspace") => {
 const payload = { section: "determinations", reason };
 console.log("[BC_AUDIT][FE][COMPLETE_SECTION][REQUEST]", { bcId, payload });
 const response = await api.post(`/business-case/${bcId}/ownership/complete`, payload);
 console.log("[BC_AUDIT][FE][COMPLETE_SECTION][RESPONSE]", {
  bcId,
  status: response?.status || null,
  data: response?.data || null,
 });
 return response?.data || null;
};

const requestUnlockSubsection = async (bcId, subsection, reason) => {
 const payload = { subsection, reason };
 console.log("[BC_AUDIT][FE][REQUEST_UNLOCK][REQUEST]", { bcId, payload });
 const response = await api.post(`/business-case/${bcId}/determinations/request-unlock-subsection`, payload);
 console.log("[BC_AUDIT][FE][REQUEST_UNLOCK][RESPONSE]", {
  bcId,
  subsection,
  status: response?.status || null,
  data: response?.data || null,
 });
 return response?.data || null;
};

const resolveUnlockSubsection = async (bcId, requestId, approve, resolutionNotes = "") => {
 const payload = {
  request_id: requestId,
  approve: Boolean(approve),
  resolution_notes: resolutionNotes,
 };
 console.log("[BC_AUDIT][FE][RESOLVE_UNLOCK][REQUEST]", { bcId, payload });
 const response = await api.post(`/business-case/${bcId}/determinations/resolve-unlock-subsection`, payload);
 console.log("[BC_AUDIT][FE][RESOLVE_UNLOCK][RESPONSE]", {
  bcId,
  requestId,
  status: response?.status || null,
  data: response?.data || null,
 });
 return response?.data || null;
};

const deriveLegacyConsumptionKey = (key) => {
 const normalized = String(key || "").trim();
 if (!normalized) return null;
 const parts = normalized.split(":");
 if (parts.length === 3 && (parts[0] === "cons" || parts[0] === "det")) {
 return `${parts[0]}:${parts[2]}`;
 }
 return null;
};

const normalizeExcludedAgainstItems = (items = [], excluded = []) => {
 const safeItems = Array.isArray(items) ? items : [];
 const safeExcluded = Array.isArray(excluded) ? excluded : [];
 if (!safeItems.length || !safeExcluded.length) return safeExcluded;

 const protectedKeys = new Set();
 safeItems.forEach((item) => {
 const key = String(item?.key || "").trim();
 if (key) protectedKeys.add(key);
 const legacy = deriveLegacyConsumptionKey(key);
 if (legacy) protectedKeys.add(legacy);
 if (item?.catalogId != null && item?.equipmentId != null) {
 const prefix = String(item?.type || "").toLowerCase() === "determinacion" ? "det" : "cons";
 protectedKeys.add(`${prefix}:${item.equipmentId}:${item.catalogId}`);
 protectedKeys.add(`${prefix}:${item.catalogId}`);
 }
 });
 return safeExcluded.filter((key) => !protectedKeys.has(String(key || "").trim()));
};

const normalizeTextKey = (value) => String(value || "").trim().toLowerCase();

const getInformationScore = (item = {}) => {
 let score = 0;
 const weightedKeys = [
 "roche_code",
 "category",
 "unit",
 "presentation",
 "brand",
 "supplier",
 "metadata",
 "notes",
 "valid_from",
 "valid_to",
 "calculation_formula",
 ];
 weightedKeys.forEach((key) => {
 const value = item?.[key];
 if (value == null) return;
 if (typeof value === "string" && value.trim() === "") return;
 if (Array.isArray(value) && value.length === 0) return;
 if (typeof value === "object" && !Array.isArray(value) && Object.keys(value || {}).length === 0) return;
 score += 2;
 });

 if (item?.status === "activo") score += 3;
 if (item?.updated_at) score += 1;
 if (item?.created_at) score += 1;

 return score;
};

const pickMostCompleteByBusinessKey = (items = [], typeFallback = "") => {
 const picked = new Map();

 items.forEach((item) => {
 const businessKey = [
 normalizeTextKey(item?.equipment_id),
 normalizeTextKey(item?.type || item?.category || typeFallback),
 normalizeTextKey(item?.name),
 ].join("|");

 const current = picked.get(businessKey);
 if (!current) {
 picked.set(businessKey, item);
 return;
 }

 const currentScore = getInformationScore(current);
 const incomingScore = getInformationScore(item);
 if (incomingScore > currentScore) {
 picked.set(businessKey, item);
 return;
 }

 if (incomingScore === currentScore) {
 const currentUpdated = new Date(current?.updated_at || current?.created_at || 0).getTime();
 const incomingUpdated = new Date(item?.updated_at || item?.created_at || 0).getTime();
 if (incomingUpdated > currentUpdated) {
 picked.set(businessKey, item);
 }
 }
 });

 return Array.from(picked.values());
};

const getTypeFamily = (type) => {
 const normalized = normalizeTextKey(type);
 if (normalized === "reactivo" || normalized === "determinacion") return "reactivo_determinacion";
 return normalized || "consumible";
};

const getCatalogRowCompletenessScore = (row = {}) => {
 let score = 0;
 if (String(row?.name || "").trim()) score += 2;
 if (String(row?.itemId || "").trim()) score += 2;
 if (String(row?.manufacturerId || "").trim()) score += 2;
 if (String(row?.equipmentName || "").trim()) score += 1;
 if (row?.catalogId != null) score += 1;
 if (row?.catalogKind === "consumable") score += 5;
 if (normalizeTextKey(row?.type) === "determinacion") score += 1;
 return score;
};

const getCatalogRowBusinessKey = (row = {}) => {
 const equipmentKey = normalizeTextKey(row?.equipmentId);
 const manufacturerKey = normalizeTextKey(row?.manufacturerId || row?.itemId);
 if (manufacturerKey) return [equipmentKey, "manufacturer", manufacturerKey].join("|");
 return [equipmentKey, normalizeTextKey(row?.name), getTypeFamily(row?.type)].join("|");
};

const dedupeCatalogRowsForUI = (items = []) => {
 const picked = new Map();
 items.forEach((row) => {
 const key = getCatalogRowBusinessKey(row);
 const current = picked.get(key);
 if (!current) {
 picked.set(key, row);
 return;
 }
 const currentScore = getCatalogRowCompletenessScore(current);
 const incomingScore = getCatalogRowCompletenessScore(row);
 if (incomingScore > currentScore) {
 picked.set(key, row);
 }
 });
 return Array.from(picked.values());
};

const toUiType = (type) => {
 const family = getTypeFamily(type);
 if (family === "reactivo_determinacion") return "reactivo";
 return family || "consumible";
};

const dedupeVisibleRowsForUI = (items = []) => {
 const byStableKey = new Map();
 (Array.isArray(items) ? items : []).forEach((row) => {
 if (!row) return;
 const stableKey = String(row?.key || "").trim();
 if (!stableKey) return;
 if (!byStableKey.has(stableKey)) {
 byStableKey.set(stableKey, row);
 }
 });
 return Array.from(byStableKey.values());
};

const normalizePersistedItemForUI = (item = {}) => {
 const normalizedType = toUiType(item?.type || "consumible");
 const rawQty = item?.annualQty ?? item?.annualQuantity ?? 0;
 const parsedQty = Number(rawQty);
 const annualQty = Number.isFinite(parsedQty) ? parsedQty : 0;
 return {
 ...item,
 type: normalizedType,
 annualQty,
 annualQuantity: annualQty,
 };
};

const normalizePersistedItemsForUI = (items = []) =>
 (Array.isArray(items) ? items : []).map((item) => normalizePersistedItemForUI(item));

const buildDebugQtySample = (rows = [], drafts = {}, getSavedRow = () => null, limit = 25) =>
 (Array.isArray(rows) ? rows : []).slice(0, limit).map((row) => ({
 key: row?.key || null,
 legacyKey: row?.legacyKey || null,
 itemId: row?.itemId || null,
 name: row?.name || null,
 draftQty: drafts?.[row?.key] ?? (row?.legacyKey ? drafts?.[row.legacyKey] : undefined) ?? null,
 savedQty: getSavedRow(row)?.annualQty ?? getSavedRow(row)?.annualQuantity ?? null,
 }));

const DETERMINATION_CATEGORY_CONFIG = [
 {
 key: "reactivos",
 title: "Reactivos",
 description: "Edita esta seccion con rol comercial / acp comercial / backoffice.",
 types: new Set(["reactivo", "determinacion"]),
 },
 {
 key: "controles",
 title: "Controles",
 description: "Edita esta seccion con rol jefe tecnico / tecnico.",
 types: new Set(["control"]),
 },
 {
 key: "calibradores",
 title: "Calibradores",
 description: "Edita esta seccion con rol jefe tecnico / tecnico.",
 types: new Set(["calibrador"]),
 },
 {
 key: "materiales",
 title: "Materiales",
 description: "Edita esta seccion con rol jefe tecnico / tecnico.",
 types: new Set(["consumible", "material"]),
 },
];

const subsectionFromType = (type) => {
 const normalized = String(type || "").trim().toLowerCase();
 if (normalized === "reactivo" || normalized === "determinacion") return "reactivos";
 if (normalized === "control") return "controles";
 if (normalized === "calibrador") return "calibradores";
 return "materiales";
};

const DeterminationsSection = ({
 businessCase,
 permissions = {},
 featureFlags = {},
 ownership = {},
 onSave = () => {}
}) => {
 const { id: bcId } = useParams();
 const { showToast } = useUI();
 const { user } = useAuth();
 const [catalogDeterminations, setCatalogDeterminations] = useState([]);
 const [catalogConsumables, setCatalogConsumables] = useState([]);
 const [gateInfo, setGateInfo] = useState(null);
 const [gateLoading, setGateLoading] = useState(false);
 const [uploadingDocument, setUploadingDocument] = useState(false);
 const [selectedDocument, setSelectedDocument] = useState(null);
 const [sheetUrl, setSheetUrl] = useState(null);
 const [sheetSyncing, setSheetSyncing] = useState(false);
 const [isDetermEditing, setIsDetermEditing] = useState(false);
 const [importModal, setImportModal] = useState(null);
 const [importTab, setImportTab] = useState("paste");
 const [importPasteText, setImportPasteText] = useState("");
 const [importPreview, setImportPreview] = useState(null);
 const [importFileLoading, setImportFileLoading] = useState(false);
 const importFileRef = useRef(null);
 const statDocumentInputRef = useRef(null);
 const [inspectionModal, setInspectionModal] = useState({
  open: false,
  minDate: "",
  maxDate: "",
  contactName: "",
  contactPhone: "",
  accessories: "",
  annotations: "",
  observations: "",
 });
 const [submittingInspectionRequest, setSubmittingInspectionRequest] = useState(false);
 const [savedItems, setSavedItems] = useState([]);
 const [excludedKeys, setExcludedKeys] = useState([]);
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState(false);
 const autosaveTimeoutRef = useRef(null);
 const pendingQtyChangesRef = useRef({});
 const editedRowsRef = useRef({});
 const [pendingChangesCount, setPendingChangesCount] = useState(0);
 const [hasStructureChanges, setHasStructureChanges] = useState(false);
 const [quantityDrafts, setQuantityDrafts] = useState({});
 const quantityDraftsRef = useRef({});
 const [rowWindowByGroup, setRowWindowByGroup] = useState({});
 const [collapsedSections, setCollapsedSections] = useState({});
 const savedItemsRef = useRef([]);
 const excludedKeysRef = useRef([]);
 const consumptionVersionRef = useRef(null);
 const [equipmentIds, setEquipmentIds] = useState([]);
 const [equipmentMeta, setEquipmentMeta] = useState({});

 const idempotencyCacheRef = useRef(new Map());
 const lastSavedKeysRef = useRef([]);
 const lastEditedRowRef = useRef(null);
 const persistInFlightRef = useRef(false);

 const canEditBase = permissions.canEditDeterminations === true && ownership?.canUserEdit !== false;
 const currentRole = user?.role;
 const normalizedCurrentRole = String(currentRole || "").trim().toLowerCase();
 const isJefeComercial = normalizedCurrentRole === "jefe_comercial" || normalizedCurrentRole === "jefe_de_comercial";
 const autosaveEnabled = false;
 const gateActive = gateInfo?.enabledForBusinessCase === true;
 const gatePhase = String(gateInfo?.phase || "commercial_input").toLowerCase();
 const quantitiesLocked = gateInfo?.quantitiesLocked === true;
 const isTechnicalRole = TECNICO_ROLES.has(normalizedCurrentRole);
 const canUploadDocument = gateInfo?.permissions?.canUploadDocument === true;
 const uploadReadiness = gateInfo?.uploadReadiness || null;
 const uploadBlockingMessage = uploadReadiness?.message || null;
 const uploadMissingSections = Array.isArray(uploadReadiness?.missingSections)
 ? uploadReadiness.missingSections
 : [];
 const inspectionRequestInfo = gateInfo?.inspectionRequest || null;
 const inspectionDraft = gateInfo?.inspectionDraft?.draft || null;
 const inspectionMissingFields = gateInfo?.inspectionDraft?.missingFields || [];
 const canRequestInspection = (canEditBase || gateInfo?.permissions?.canRequestInspection) && gateInfo?.documentUploaded && !inspectionRequestInfo?.request_id;
 const selectedDocumentSummary = selectedDocument
 ? `${selectedDocument.name} (${formatSelectedFileSize(selectedDocument.size)})`
 : "Aun no has seleccionado un archivo.";
 const canEditByGate = gateInfo?.permissions?.canEditDeterminations === true;
 const canEditFinal = (gateActive ? (canEditBase && canEditByGate) : canEditBase) && !quantitiesLocked && isDetermEditing;
 const technicalSlaExpired = gateInfo?.extensionRequired === true || gateInfo?.technicalSlaExpired === true;
 const canReopenCommercial = isJefeComercial && gatePhase === "technical_review";
 const sectionLocks = gateInfo?.sectionLocks || {};
 const isSubsectionLocked = (subsectionKey) => Boolean(sectionLocks?.[subsectionKey]) || quantitiesLocked;
 const allSubsectionsLocked = ["reactivos", "controles", "calibradores", "materiales"].every((key) => isSubsectionLocked(key));
 const pendingUnlockBySubsection = useMemo(() => {
 const map = {};
 (gateInfo?.unlockRequests || [])
  .filter((entry) => String(entry?.status || "").toLowerCase() === "pending")
  .forEach((entry) => {
   const key = String(entry?.subsection || "").trim().toLowerCase();
   if (key && !map[key]) map[key] = entry;
  });
 return map;
}, [gateInfo?.unlockRequests]);

const inspectionSummary = useMemo(() => {
 // equipmentMeta tiene los nombres reales del catálogo ya cargados en este componente.
 // El draft del backend puede traer placeholders ("Equipo principal") cuando el
 // selectedEquipment no tiene nombre resuelto, por eso equipmentMeta tiene prioridad.
 const equipment = equipmentIds.length > 0
  ? equipmentIds.map((id) => ({ nombre_equipo: equipmentMeta[id] || `Equipo ${id}` }))
  : (Array.isArray(inspectionDraft?.equipos) && inspectionDraft.equipos.length > 0
   ? inspectionDraft.equipos
   : []);
 return {
  clientName: inspectionDraft?.nombre_cliente || businessCase?.client_name || "Cliente pendiente",
  processCode: businessCase?.process_code || "Sin numero de proceso",
  address: inspectionDraft?.direccion_cliente || "Pendiente en datos del cliente",
  contactName: inspectionDraft?.persona_contacto || "",
  contactPhone: inspectionDraft?.celular_contacto || "",
  accessories: inspectionDraft?.accesorios || "",
  annotations: inspectionDraft?.anotaciones || "",
  observations: inspectionDraft?.observaciones || "",
  equipment,
 };
}, [businessCase, inspectionDraft, equipmentIds, equipmentMeta]);

 const isPublicBC = PUBLIC_BC_TYPES.has(businessCase?.bc_purchase_type);

const canEditType = (type) => {
 if (!canEditFinal) return false;
 if (isSubsectionLocked(subsectionFromType(type))) return false;
 if (ADMIN_ROLES.has(normalizedCurrentRole)) return true;
 // NUEVO-02: jefe_comercial y jefe_de_comercial pueden editar reactivos en BC público y privado
 if (REACTIVO_TYPES.has(type)) {
   const isJefeComercial = normalizedCurrentRole === "jefe_comercial" || normalizedCurrentRole === "jefe_de_comercial";
   if (isJefeComercial) return true;
   return isPublicBC ? normalizedCurrentRole === "acp_comercial" : normalizedCurrentRole === "backoffice_comercial";
 }
 // BUG-01: usar TECNICO_EDIT_ROLES (incluye jefe_comercial/jefe_de_comercial) para sub-secciones técnicas
 if (TECNICO_TYPES.has(type)) return TECNICO_EDIT_ROLES.has(normalizedCurrentRole);
 return false;
 };

 const getStableJson = useCallback((value) => {
 if (Array.isArray(value)) {
 return `[${value.map((entry) => getStableJson(entry)).join(",")}]`;
 }
 if (!value || typeof value !== "object") {
 return JSON.stringify(value);
 }
 const keys = Object.keys(value).sort();
 const body = keys.map((key) => `${JSON.stringify(key)}:${getStableJson(value[key])}`).join(",");
 return `{${body}}`;
 }, []);

 const buildFastHash = useCallback((input) => {
 const str = String(input || "");
 let hash = 0;
 for (let index = 0; index < str.length; index += 1) {
 hash = (hash * 31 + str.charCodeAt(index)) >>> 0;
 }
 return hash.toString(16);
 }, []);

 const getIdempotencyKey = useCallback(
 (scope, payload) => {
 const now = Date.now();
 const fingerprint = `${scope}:${buildFastHash(getStableJson(payload))}`;
 const existing = idempotencyCacheRef.current.get(fingerprint);
 if (existing && existing.expiresAt > now) {
 return existing.key;
 }

 const randomKey =
 (typeof window !== "undefined" && window.crypto?.randomUUID?.()) ||
 `${now}-${Math.random().toString(16).slice(2)}`;
 const key = `${scope}:${bcId}:${randomKey}`;
 idempotencyCacheRef.current.set(fingerprint, { key, expiresAt: now + IDEMPOTENCY_TTL_MS });

 if (idempotencyCacheRef.current.size > 100) {
 const entries = Array.from(idempotencyCacheRef.current.entries());
 entries
 .filter(([, value]) => value.expiresAt <= now)
 .forEach(([fingerprintKey]) => idempotencyCacheRef.current.delete(fingerprintKey));
 }

 return key;
 },
 [bcId, buildFastHash, getStableJson],
 );

 const loadEquipmentData = useCallback(async () => {
 if (!bcId) return;
 // Solo el backup que se instala simultaneamente forma parte del equipo
 // operativo que debe aparecer en determinaciones y consumibles.
 const detailsFromExtra = businessCase?.extra?.equipment_details;
 if (Array.isArray(detailsFromExtra) && detailsFromExtra.length > 0) {
 const ids = detailsFromExtra.flatMap((pair) => [
  pair?.primary_id,
  isAffirmative(pair?.backup_install_simultaneous) ? pair?.backup_id : null,
 ]).filter(Boolean);
 if (ids.length) {
 setEquipmentIds(Array.from(new Set(ids)));
 return;
 }
 }
 try {
 const res = await api.get(`/business-case/${bcId}/equipment-details`);
 const equipmentDetails = res.data?.data || [];
 if (equipmentDetails.length > 0) {
 const ids = equipmentDetails.flatMap((pair) => [
  pair?.primary_id,
  isAffirmative(pair?.backup_install_simultaneous ?? pair?.install_with_primary) ? pair?.backup_id : null,
 ]).filter(Boolean);
 if (ids.length) {
 setEquipmentIds(Array.from(new Set(ids)));
 }
 }
 } catch (err) {
 debugWarn("No se pudieron cargar datos de equipo", err.message);
 }
 }, [bcId, businessCase?.extra?.equipment_details]);

 const loadCatalog = useCallback(async () => {
 if (!equipmentIds.length) return;
 setLoading(true);
 try {
 const start = Date.now();
 const determinationsList = [];
 const consumablesList = [];
 const nextEquipmentMeta = {};
 await Promise.all(
 equipmentIds.map(async (id) => {
 const [detailsRes, detsRes, consRes] = await Promise.all([
 api.get(`/equipment-catalog/${id}`),
 api.get(`/equipment-catalog/${id}/determinations`),
 api.get(`/equipment-catalog/${id}/consumables`),
 ]);
 const equipmentName =
 detailsRes.data?.data?.equipment_name ||
 detailsRes.data?.data?.name ||
 `Equipo ${id}`;
 nextEquipmentMeta[id] = equipmentName;
 const dets = detsRes.data?.data || [];
 const cons = consRes.data?.data || [];
 determinationsList.push(
 ...dets.map((det) => ({
 ...det,
 equipment_id: id,
 equipment_name: equipmentName,
 }))
 );
 consumablesList.push(
 ...cons.map((item) => ({
 ...item,
 equipment_id: id,
 equipment_name: equipmentName,
 }))
 );
 })
 );
 const dedupedDeterminations = pickMostCompleteByBusinessKey(determinationsList, "determinacion");
 const dedupedConsumables = pickMostCompleteByBusinessKey(consumablesList, "consumible");
 setCatalogDeterminations(dedupedDeterminations);
 setCatalogConsumables(dedupedConsumables);
 setEquipmentMeta((prev) => ({ ...prev, ...nextEquipmentMeta }));
 recordBusinessCaseTelemetry({
 section: "determinations",
 type: "load_catalog_success",
 durationMs: Date.now() - start,
 success: true,
 });
 } catch (err) {
 showToast("No se pudieron cargar items del catalogo", "error");
 recordBusinessCaseTelemetry({
 section: "determinations",
 type: "load_catalog_error",
 success: false,
 });
 } finally {
 setLoading(false);
 }
 }, [equipmentIds, showToast]);

 const loadExisting = useCallback(async () => {
 if (!bcId) return;
 const start = Date.now();
 try {
 const res = await api.get(`/business-case/${bcId}/consumption-items`, {
 params: { _t: Date.now() },
 });
 const data = res?.data?.data || {};
 const items = Array.isArray(data?.items) ? data.items : [];
 const excludedRaw = Array.isArray(data?.excluded) ? data.excluded : [];
 const normalizedItems = normalizePersistedItemsForUI(items);
 const excluded = normalizeExcludedAgainstItems(normalizedItems, excludedRaw);
 const version = data?.version || null;
 logFrontAudit("[BC_AUDIT][FE][GET_CONSUMPTION_ITEMS]", {
 bcId,
 version,
 excludedRawCount: excludedRaw.length,
 excludedFinalCount: excluded.length,
 rawSummary: summarizeItemsForAudit(items),
 normalizedSummary: summarizeItemsForAudit(normalizedItems),
 });
 console.log("[BC_AUDIT][FE][LOAD_EXISTING]", {
 bcId,
 version,
 itemsCount: items.length,
 excludedCount: excluded.length,
 nonZeroItems: items.filter((item) => Number(item?.annualQty ?? item?.annualQuantity ?? 0) > 0).length,
 });
 pendingQtyChangesRef.current = {};
 editedRowsRef.current = {};
 setPendingChangesCount(0);
 if (autosaveTimeoutRef.current) {
 clearTimeout(autosaveTimeoutRef.current);
 autosaveTimeoutRef.current = null;
 }
 consumptionVersionRef.current = version;
 setSavedItems(normalizedItems);
 setExcludedKeys(excluded);
 setQuantityDrafts(() => {
 const next = {};
 normalizedItems.forEach((item) => {
 if (!item?.key) return;
 next[item.key] = String(item.annualQty ?? item.annualQuantity ?? 0);
 });
 quantityDraftsRef.current = next;
 return next;
 });
 setHasStructureChanges(false);
  debugInfo("[DET_DEBUG] loadExisting:success", {
  bcId,
  items: items.length,
  excluded: excluded.length,
  loadedKeysSample: items.slice(0, 10).map((item) => item?.key),
  loadedNonZeroSample: items
  .filter((item) => Number(item?.annualQty ?? item?.annualQuantity ?? 0) > 0)
  .slice(0, 15)
  .map((item) => ({
  key: item?.key || null,
  itemId: item?.itemId || null,
  annualQty: item?.annualQty ?? item?.annualQuantity ?? 0,
  })),
  lastSavedKeysSample: lastSavedKeysRef.current.slice(0, 10),
  });
 recordBusinessCaseTelemetry({
 section: "determinations",
 type: "load_existing_success",
 durationMs: Date.now() - start,
 success: true,
 });
 return;
 } catch (err) {
 if (err?.response?.status === 304) {
 // 304 no trae cuerpo útil para axios; mantenemos estado actual y evitamos fallback destructivo.
 return;
 }
 // Fail-safe estricto: no hidratar desde metadata para evitar sobreescritura con ceros.
 // Si falla el endpoint fuente-de-verdad (bc_consumption_items), mantenemos estado actual.
 debugError("[DET_DEBUG] loadExisting:error_source_of_truth", {
 bcId,
 message: err?.response?.data?.message || err?.message,
 status: err?.response?.status || null,
 });
 showToast("No se pudo cargar consumos desde base de datos. Reintenta en unos segundos.", "error");
 recordBusinessCaseTelemetry({
 section: "determinations",
 type: "load_existing_error",
 success: false,
 });
 }
 }, [
 bcId,
 showToast,
 ]);

 const loadGateInfo = useCallback(async () => {
 if (!bcId) return;
 setGateLoading(true);
 try {
 const data = await getDeterminationsStatDocumentInfo(bcId);
 setGateInfo(data || null);
 } catch (err) {
 debugWarn("No se pudo cargar informacion del documento estadistico", err?.message || err);
 setGateInfo(null);
 } finally {
 setGateLoading(false);
 }
 }, [bcId]);

 const loadExistingSheetUrl = useCallback(async () => {
  if (!bcId) return;
  try {
   const res = await api.get(`/business-case/${bcId}/sheets/preview`);
   const url = res?.data?.data?.last_generation?.sheet_url;
   setSheetUrl(url || null);
  } catch (_err) {
   setSheetUrl(null);
  }
 }, [bcId]);

 useEffect(() => {
 debugInfo("[DET_DEBUG_VERSION]", DET_DEBUG_VERSION, { bcId });
 }, [bcId]);

 useEffect(() => {
 loadEquipmentData();
 }, [loadEquipmentData]);

 useEffect(() => {
 if (equipmentIds.length) {
 loadCatalog();
 }
 }, [equipmentIds, loadCatalog]);

 useEffect(() => {
 loadExisting();
 }, [loadExisting]);

 // Refuerzo de hidratacion:
 // cuando cambia el snapshot del BC (refresh de workspace), forzar GET fuente-de-verdad.
 useEffect(() => {
 if (!bcId) return;
 console.log("[BC_AUDIT][FE][RELOAD_ON_BC_SNAPSHOT]", {
 bcId,
 businessCaseUpdatedAt: businessCase?.updated_at || businessCase?.updatedAt || null,
 });
 loadExisting();
 }, [bcId, businessCase?.updated_at, businessCase?.updatedAt, loadExisting]);

 // Refuerzo adicional: al volver a la pestaña/ventana, rehidratar desde backend.
 useEffect(() => {
 if (!bcId) return undefined;
 const onVisibilityOrFocus = () => {
 if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
 console.log("[BC_AUDIT][FE][RELOAD_ON_FOCUS]", { bcId });
 loadExisting();
 };
 window.addEventListener("focus", onVisibilityOrFocus);
 document.addEventListener("visibilitychange", onVisibilityOrFocus);
 return () => {
 window.removeEventListener("focus", onVisibilityOrFocus);
 document.removeEventListener("visibilitychange", onVisibilityOrFocus);
 };
 }, [bcId, loadExisting]);

 useEffect(() => {
 loadGateInfo();
 }, [loadGateInfo]);

 useEffect(() => {
 loadExistingSheetUrl();
 }, [loadExistingSheetUrl]);

 useEffect(() => {
 savedItemsRef.current = savedItems;
 }, [savedItems]);

 useEffect(() => {
 excludedKeysRef.current = excludedKeys;
 }, [excludedKeys]);

 useEffect(() => {
 return () => {
 if (autosaveTimeoutRef.current) {
 clearTimeout(autosaveTimeoutRef.current);
 autosaveTimeoutRef.current = null;
 }
 pendingQtyChangesRef.current = {};
 };
 }, []);

 const catalogItems = useMemo(() => {
 const determinations = (catalogDeterminations || []).map((det) => ({
 key: `det:${det.equipment_id}:${det.id}`,
 legacyKey: `det:${det.id}`,
 type: toUiType("determinacion"),
 catalogKind: "determination",
 name: det.name,
 itemId: det.roche_code || null,
 manufacturerId: det.roche_code || null,
 source: "catalog",
 catalogId: det.id,
 equipmentId: det.equipment_id,
 equipmentName: det.equipment_name,
 }));
 const consumables = (catalogConsumables || []).map((item) => ({
 key: `cons:${item.equipment_id}:${item.id}`,
 legacyKey: `cons:${item.id}`,
 type: toUiType(item.type || "consumible"),
 catalogKind: "consumable",
 name: item.name,
 itemId: item.supplier_code || null,
 manufacturerId: item.supplier_code || null,
 source: "catalog",
 catalogId: item.id,
 equipmentId: item.equipment_id,
 equipmentName: item.equipment_name,
 }));
 const dedupedRows = dedupeCatalogRowsForUI([...determinations, ...consumables]);
 return dedupedRows.sort((a, b) => a.name.localeCompare(b.name));
 }, [catalogDeterminations, catalogConsumables]);

const savedMap = useMemo(() => {
const map = {};
const resolvePrefix = (rawType) => {
const family = getTypeFamily(rawType);
if (family === "reactivo_determinacion") return "det";
return "cons";
};
(savedItems || []).forEach((item) => {
if (!item) return;
if (item.key) map[item.key] = item;
if (item.catalogId && item.equipmentId) {
const prefix = resolvePrefix(item.type);
map[`${prefix}:${item.equipmentId}:${item.catalogId}`] = item;
}
});
return map;
}, [savedItems]);

 const mergedRows = useMemo(() => {
 const customItems = (savedItems || []).filter((item) => item.source === "custom");
 const catalogVisible = (catalogItems || []).filter((item) => {
 if (excludedKeys.includes(item.key)) return false;
 if (item.legacyKey && excludedKeys.includes(item.legacyKey)) return false;
 return true;
 });
 const enrichedCustom = customItems.map((item) => ({
 ...item,
 type: toUiType(item?.type),
 manufacturerId: item.manufacturerId || item.itemId || null,
 equipmentName: item.equipmentName || "Manual",
 equipmentId: item.equipmentId || null,
 }));
 return dedupeVisibleRowsForUI([...catalogVisible, ...enrichedCustom]);
 }, [catalogItems, savedItems, excludedKeys]);

 const groupedByEquipment = useMemo(() => {
 const groups = {};
 mergedRows.forEach((row) => {
 const groupKey = row.equipmentId ? `eq:${row.equipmentId}` : `manual:${row.equipmentName || row.name}`;
 if (!groups[groupKey]) {
 const categories = {};
 DETERMINATION_CATEGORY_CONFIG.forEach((section) => {
 categories[section.key] = [];
 });
 groups[groupKey] = {
 key: groupKey,
 name: row.equipmentName || "Manual",
 equipmentId: row.equipmentId || null,
 categories,
 };
 }
 const normalizedType = String(row.type || "").toLowerCase();
 const targetSection = DETERMINATION_CATEGORY_CONFIG.find((section) =>
 section.types.has(normalizedType),
 );
 if (targetSection) {
 groups[groupKey].categories[targetSection.key].push(row);
 }
 });

 // Ensure every selected equipment appears even if it has no catalog items
 equipmentIds.forEach((id) => {
 const groupKey = `eq:${id}`;
 if (!groups[groupKey]) {
 const categories = {};
 DETERMINATION_CATEGORY_CONFIG.forEach((section) => {
 categories[section.key] = [];
 });
 groups[groupKey] = {
 key: groupKey,
 name: equipmentMeta[id] || `Equipo ${id}`,
 equipmentId: id,
 categories,
 };
 }
 });

 return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
 }, [mergedRows, equipmentIds, equipmentMeta]);

 const getSavedRow = useCallback((row) => {
 if (!row) return null;
 const direct = savedMap[row.key] || (row.legacyKey ? savedMap[row.legacyKey] : null);
 if (direct) return direct;

 const normalizedType = String(row.type || "").trim().toLowerCase();
 const normalizedItemId = String(row.itemId || "").trim();
 const normalizedName = String(row.name || "").trim().toLowerCase();
 const rowCatalogId = row.catalogId ?? null;
 const rowEquipmentId = row.equipmentId ?? null;
 const rowEquipmentNormalized = String(rowEquipmentId ?? "").trim();

 return (savedItemsRef.current || []).find((item) => {
 if (!item) return false;
 const itemType = String(item.type || "").trim().toLowerCase();
 const itemId = String(item.itemId || "").trim();
 const itemName = String(item.name || "").trim().toLowerCase();
 const itemCatalogId = item.catalogId ?? null;
 const itemEquipmentId = item.equipmentId ?? null;
 const itemEquipmentNormalized = String(itemEquipmentId ?? "").trim();
 const sameEquipment = rowEquipmentNormalized === itemEquipmentNormalized;
 const rowEquipmentMissing = rowEquipmentId == null || rowEquipmentNormalized === "";
 const itemEquipmentMissing = itemEquipmentId == null || itemEquipmentNormalized === "";

 if (
 rowCatalogId !== null &&
 itemCatalogId !== null &&
 String(rowCatalogId) === String(itemCatalogId) &&
 (sameEquipment || rowEquipmentMissing || itemEquipmentMissing)
 ) {
 return true;
 }

 if (
 normalizedItemId &&
 itemId &&
 normalizedItemId === itemId &&
 normalizedType === itemType &&
 (sameEquipment || rowEquipmentMissing || itemEquipmentMissing)
 ) {
 return true;
 }

 return (
 normalizedName &&
 normalizedName === itemName &&
 normalizedType === itemType &&
 (sameEquipment || rowEquipmentMissing || itemEquipmentMissing)
 );
 }) || null;
}, [savedMap]);

 const getManufacturerId = (row) => {
 const saved = getSavedRow(row);
 return String(
 row?.manufacturerId ??
 row?.itemId ??
 saved?.manufacturerId ??
 saved?.itemId ??
 ""
 ).trim();
 };

 // eslint-disable-next-line react-hooks/exhaustive-deps
 const getQtyInputValue = (row) => {
 const draftValue = quantityDrafts[row.key];
 if (draftValue !== undefined) return draftValue;
 if (row?.legacyKey && quantityDrafts[row.legacyKey] !== undefined) {
 return quantityDrafts[row.legacyKey];
 }
 const savedValue = getSavedRow(row)?.annualQty;
 return String(savedValue ?? 0);
 };

 useEffect(() => {
 if (!DET_DEBUG_ENABLED) return;
 if (!mergedRows.length) return;
 const sample = buildDebugQtySample(mergedRows, quantityDraftsRef.current, getSavedRow, 40);
 const nonZeroDrafts = sample.filter((item) => Number(item?.draftQty ?? 0) > 0).length;
 const nonZeroSaved = sample.filter((item) => Number(item?.savedQty ?? 0) > 0).length;
 debugInfo("[BC_CONSUMPTION][FE][RENDER_QTY_SNAPSHOT]", {
 bcId,
 mergedRows: mergedRows.length,
 sampleSize: sample.length,
 nonZeroDrafts,
 nonZeroSaved,
 sample,
 });
 }, [bcId, mergedRows, savedItems, getSavedRow]);

 const toPositiveNumber = (value) => {
 const normalized = String(value ?? "").trim().replace(",", ".");
 const parsed = Number(normalized);
 if (!Number.isFinite(parsed)) return 0;
 return parsed > 0 ? parsed : 0;
 };

 const hasSyncedReactivos = (mergedRows || []).some((row) =>
  subsectionFromType(row?.type) === "reactivos" &&
  toPositiveNumber(quantityDraftsRef.current?.[row?.key] ?? getSavedRow(row)?.annualQty ?? row?.annualQty ?? 0) > 0
 );
 const canValidateReactivosByRole =
  isJefeComercial ||
  (isPublicBC ? normalizedCurrentRole === "acp_comercial" : normalizedCurrentRole === "backoffice_comercial");

 const canValidateReactivos =
  gatePhase === "commercial_input" &&
  gateInfo?.documentUploaded === true &&
  gateInfo?.isExpired !== true &&
  canValidateReactivosByRole &&
  !quantitiesLocked &&
  !isSubsectionLocked("reactivos") &&
  hasSyncedReactivos;

const syncQuantityDrafts = useCallback((items = []) => {
 const next = {};
 (Array.isArray(items) ? items : []).forEach((item) => {
 if (!item) return;
 const qty = String(item.annualQty ?? item.annualQuantity ?? 0);
 const itemKey = String(item?.key || "").trim();
 if (itemKey) next[itemKey] = qty;
 });
 quantityDraftsRef.current = next;
 setQuantityDrafts(next);
 }, []);

const applyPersistedSnapshot = useCallback((persisted, fallbackItems = [], fallbackExcluded = []) => {
 const persistedItemsRaw = Array.isArray(persisted?.items) ? persisted.items : fallbackItems;
 const persistedItems = normalizePersistedItemsForUI(persistedItemsRaw);
 const rawExcluded = Array.isArray(persisted?.excluded) ? persisted.excluded : fallbackExcluded;
 const persistedExcluded = normalizeExcludedAgainstItems(persistedItems, rawExcluded);
 consumptionVersionRef.current = persisted?.version || consumptionVersionRef.current;
 lastSavedKeysRef.current = persistedItems.map((item) => item?.key).filter(Boolean);
 savedItemsRef.current = persistedItems;
 excludedKeysRef.current = persistedExcluded;
 setSavedItems(persistedItems);
 setExcludedKeys(persistedExcluded);
 syncQuantityDrafts(persistedItems);
 pendingQtyChangesRef.current = {};
 editedRowsRef.current = {};
 setPendingChangesCount(0);
 setHasStructureChanges(false);
 return { persistedItems, persistedExcluded };
 }, [syncQuantityDrafts]);

 const getWindowLimit = (groupKey, tableType) =>
 rowWindowByGroup[`${groupKey}:${tableType}`] || ROW_WINDOW_STEP;

 const isSectionCollapsed = (groupKey, sectionKey) =>
 collapsedSections[`${groupKey}:${sectionKey}`] !== false;

 const toggleSectionCollapsed = (groupKey, sectionKey) => {
 const stateKey = `${groupKey}:${sectionKey}`;
 setCollapsedSections((prev) => ({
 ...prev,
 [stateKey]: !prev[stateKey],
 }));
 };

 const expandRowWindow = (groupKey, tableType) => {
 setRowWindowByGroup((prev) => {
 const key = `${groupKey}:${tableType}`;
 const current = prev[key] || ROW_WINDOW_STEP;
 return { ...prev, [key]: current + ROW_WINDOW_STEP };
 });
 };

 const persistItems = async (nextItems, nextExcluded = excludedKeys, options = {}) => {
 if (!bcId) {
 showToast("Primero crea el Business Case", "warning");
 return;
 }
 if (persistInFlightRef.current) {
 debugWarn("[DET_DEBUG] persistItems:skipped_inflight", { bcId });
 return;
 }
 const { refresh = false, silent = false, revalidate = false, markComplete = false } = options;
 const effectiveRefresh = markComplete ? Boolean(refresh) : false;
 const effectiveRevalidate = markComplete ? Boolean(revalidate) : false;
 debugInfo("[DET_DEBUG] persistItems:start", {
 bcId,
 options: { refresh, silent, revalidate, markComplete },
 effectiveOptions: { refresh: effectiveRefresh, revalidate: effectiveRevalidate },
 nextItemsCount: Array.isArray(nextItems) ? nextItems.length : 0,
 nextExcludedCount: Array.isArray(nextExcluded) ? nextExcluded.length : 0,
 version: consumptionVersionRef.current,
 });
 persistInFlightRef.current = true;
 setSaving(true);
 const startedAt = Date.now();
 try {
 const debugItemPayload = (nextItems || []).find((item) => String(item?.itemId || "").trim() === "3321193001");
 debugInfo("[BC_CONSUMPTION][FE][SAVE][REQUEST]", {
 bcId,
 itemsCount: Array.isArray(nextItems) ? nextItems.length : 0,
 excludedCount: Array.isArray(nextExcluded) ? nextExcluded.length : 0,
 debugItem: debugItemPayload
 ? {
 key: debugItemPayload.key,
 itemId: debugItemPayload.itemId,
 annualQty: debugItemPayload.annualQty,
 source: debugItemPayload.source,
 }
 : null,
 });
 const payload = {
 items: (nextItems || []).map((item) => ({
 ...item,
 annualQuantity: item?.annualQty ?? item?.annualQuantity ?? 0,
 })),
 excluded: nextExcluded,
 version: consumptionVersionRef.current,
 idempotency_key: getIdempotencyKey("bc.consumption.save", {
 items: (nextItems || []).map((item) => ({
 ...item,
 annualQuantity: item?.annualQty ?? item?.annualQuantity ?? 0,
 })),
 excluded: nextExcluded,
 version: consumptionVersionRef.current,
 }),
 };
 console.log("[BC_AUDIT][FE][SAVE_REQUEST]", {
 bcId,
 version: payload.version || null,
 itemsCount: payload.items.length,
 excludedCount: payload.excluded.length,
 nonZeroItems: payload.items.filter((item) => Number(item?.annualQty ?? item?.annualQuantity ?? 0) > 0).length,
 markComplete,
 });
 const querySuffix = silent ? "?silent=true" : "";
 logFrontAudit("[BC_AUDIT][FE][PUT_CONSUMPTION_ITEMS][REQUEST]", {
 bcId,
 url: `/business-case/${bcId}/consumption-items${querySuffix}`,
 version: payload.version || null,
 excludedCount: payload.excluded.length,
 itemsSummary: summarizeItemsForAudit(payload.items),
 excludedSample: payload.excluded.slice(0, 40),
 markComplete,
 });
 const runSaveRequest = async (body) =>
 api.put(`/business-case/${bcId}/consumption-items${querySuffix}`, body);

 let response;
 try {
 response = await runSaveRequest(payload);
 } catch (firstErr) {
 const firstCode = firstErr?.response?.data?.code;
 const currentVersion = firstErr?.response?.data?.details?.currentVersion || null;
 if (firstCode !== "CONSUMPTION_VERSION_CONFLICT" || !currentVersion) {
 throw firstErr;
 }
 debugWarn("[DET_DEBUG] persistItems:retry_on_version_conflict", {
 bcId,
 previousVersion: payload.version || null,
 currentVersion,
 });
 consumptionVersionRef.current = currentVersion;
 const retryPayload = {
 ...payload,
 version: currentVersion,
 idempotency_key: getIdempotencyKey("bc.consumption.save.retry", {
 items: payload.items,
 excluded: payload.excluded,
 version: currentVersion,
 }),
 };
 response = await runSaveRequest(retryPayload);
 }
 debugInfo("[DET_DEBUG] persistItems:api_success", {
 bcId,
 status: response?.status,
 hasData: Boolean(response?.data),
 ms: Date.now() - startedAt,
 });
 const persisted = response?.data?.data || {};
 logFrontAudit("[BC_AUDIT][FE][PUT_CONSUMPTION_ITEMS][RESPONSE]", {
 bcId,
 httpStatus: response?.status || null,
 version: persisted?.version || null,
 excludedCount: Array.isArray(persisted?.excluded) ? persisted.excluded.length : 0,
 itemsSummary: summarizeItemsForAudit(Array.isArray(persisted?.items) ? persisted.items : []),
 excludedSample: Array.isArray(persisted?.excluded) ? persisted.excluded.slice(0, 40) : [],
 markComplete,
 });
 console.log("[BC_AUDIT][FE][SAVE_RESPONSE]", {
 bcId,
 version: persisted?.version || null,
 itemsCount: Array.isArray(persisted?.items) ? persisted.items.length : 0,
 excludedCount: Array.isArray(persisted?.excluded) ? persisted.excluded.length : 0,
 nonZeroItems: Array.isArray(persisted?.items)
 ? persisted.items.filter((item) => Number(item?.annualQty ?? item?.annualQuantity ?? 0) > 0).length
 : 0,
 markComplete,
 });
 const { persistedItems, persistedExcluded } = applyPersistedSnapshot(
 persisted,
 nextItems,
 nextExcluded,
 );
 const debugItemResponse = (persistedItems || []).find((item) => String(item?.itemId || "").trim() === "3321193001");
 debugInfo("[BC_CONSUMPTION][FE][SAVE][RESPONSE]", {
 bcId,
 itemsCount: persistedItems.length,
 excludedCount: persistedExcluded.length,
 debugItem: debugItemResponse
 ? {
 key: debugItemResponse.key,
 itemId: debugItemResponse.itemId,
 annualQty: debugItemResponse.annualQty,
 source: debugItemResponse.source,
 }
 : null,
 });
 if (effectiveRevalidate) {
 debugInfo("[DET_DEBUG] persistItems:revalidate_start", { bcId });
 await loadExisting();
 debugInfo("[DET_DEBUG] persistItems:revalidate_done", { bcId });
 }
 if (!silent) {
 showToast("Determinaciones guardadas correctamente.", "success");
 }
 if (markComplete) {
 debugInfo("[DET_DEBUG] persistItems:mark_complete_request", { bcId, gatePhase, role: currentRole });
 try {
 await completeDeterminationsSection(bcId);
 await loadGateInfo();
 } catch (completeErr) {
 console.error("[BC_AUDIT][FE][COMPLETE_SECTION][ERROR]", {
  bcId,
  message: completeErr?.response?.data?.message || completeErr?.message,
  code: completeErr?.response?.data?.code || null,
  status: completeErr?.response?.status || null,
  data: completeErr?.response?.data || null,
 });
 showToast(
  getNaturalErrorMessage(
   completeErr,
   "Las cantidades se guardaron, pero no se pudo terminar la sección.",
  ),
  "warning",
 );
 }
 }
 if (effectiveRefresh) {
 debugInfo("[DET_DEBUG] persistItems:onSave", {
 bcId,
 refresh: effectiveRefresh,
 markComplete,
 });
 onSave({ refresh: effectiveRefresh, markComplete });
 } else {
 debugInfo("[DET_DEBUG] persistItems:onSave:skipped_refresh", { bcId, markComplete });
 }
 recordBusinessCaseTelemetry({
 section: "determinations",
 type: "save_full_success",
 durationMs: Date.now() - startedAt,
 success: true,
 });
 } catch (err) {
 debugError("[DET_DEBUG] persistItems:error", {
 bcId,
 message: err?.response?.data?.message || err?.message,
 code: err?.response?.data?.code || null,
 status: err?.response?.status || null,
 data: err?.response?.data || null,
 });
 const code = err?.response?.data?.code;
 if (code === "CONSUMPTION_VERSION_CONFLICT") {
 console.warn("[BC_AUDIT][FE][VERSION_CONFLICT]", {
 bcId,
 expectedVersion: err?.response?.data?.details?.expectedVersion || null,
 currentVersion: err?.response?.data?.details?.currentVersion || null,
 });
 showToast("Otro usuario actualizo esta seccion. Recargando datos...", "warning");
 await loadExisting();
 } else {
 showToast(getNaturalErrorMessage(err, "No se pudo guardar la información"), "error");
 }
 recordBusinessCaseTelemetry({
 section: "determinations",
 type: "save_full_error",
 durationMs: Date.now() - startedAt,
 success: false,
 });
 } finally {
 persistInFlightRef.current = false;
 setSaving(false);
 }
 };

 const buildPersistPayloadFromDrafts = useCallback(() => {
  const visibleRowMap = new Map();
  mergedRows.forEach((row) => {
  if (row?.key) visibleRowMap.set(row.key, row);
  });
 Object.values(editedRowsRef.current || {}).forEach((row) => {
 if (row?.key && !visibleRowMap.has(row.key)) {
 visibleRowMap.set(row.key, row);
 }
 });

 // Conserva filas guardadas que no estén visibles por cambios de catálogo/equipo.
  (savedItemsRef.current || []).forEach((item) => {
  if (item?.key && !visibleRowMap.has(item.key)) {
  visibleRowMap.set(item.key, item);
  }
  });

  // Blindaje: cualquier draft con cantidad > 0 debe terminar en payload, incluso
  // si no quedó en mergedRows por desalineación temporal de UI.
  const rowIndexByKey = new Map();
  const indexCandidate = (rowLike) => {
  if (!rowLike) return;
  const key = String(rowLike?.key || "").trim();
  if (key) rowIndexByKey.set(key, rowLike);
  const legacyKey = String(rowLike?.legacyKey || "").trim();
  if (legacyKey) rowIndexByKey.set(legacyKey, rowLike);
  };
  (catalogItems || []).forEach(indexCandidate);
  mergedRows.forEach(indexCandidate);
  (savedItemsRef.current || []).forEach(indexCandidate);
  Object.values(editedRowsRef.current || {}).forEach(indexCandidate);

  Object.entries(quantityDraftsRef.current || {}).forEach(([draftKey, draftValue]) => {
  const numeric = toPositiveNumber(draftValue);
  if (numeric <= 0) return;
  if (visibleRowMap.has(draftKey)) return;
  const resolved = rowIndexByKey.get(draftKey);
  if (resolved?.key) {
  visibleRowMap.set(resolved.key, resolved);
  return;
  }
  const fromLegacy = (catalogItems || []).find((row) => row?.legacyKey && row.legacyKey === draftKey);
  if (fromLegacy?.key) {
  visibleRowMap.set(fromLegacy.key, fromLegacy);
  }
  });

  const nextExcluded = Array.from(new Set(excludedKeysRef.current || []));
  const nextItems = [];

 visibleRowMap.forEach((row) => {
 const saved = getSavedRow(row);
 const rawQty = quantityDraftsRef.current[row.key]
  ?? quantityDrafts[row.key]
  ?? saved?.annualQty
  ?? saved?.annualQuantity
  ?? row?.annualQty
 ?? row?.annualQuantity
 ?? 0;
 const annualQty = toPositiveNumber(rawQty);
 const isCatalog = String(row?.source || saved?.source || "").toLowerCase() === "catalog";
 // Si el usuario puso cantidad > 0, reactivamos el item aunque haya quedado excluido previamente.
 if (annualQty > 0) {
 const keySet = new Set([row.key, row.legacyKey].filter(Boolean));
 for (const key of keySet) {
 const idx = nextExcluded.indexOf(key);
 if (idx >= 0) nextExcluded.splice(idx, 1);
 }
 }
 const isExcluded = nextExcluded.includes(row.key) || (row.legacyKey && nextExcluded.includes(row.legacyKey));

 // Catálogo: solo persistimos cantidades > 0. Con 0 sigue visible en UI, no se excluye.
 if (isCatalog) {
 if (isExcluded || annualQty <= 0) return;
 }

 const name = String(row?.name || saved?.name || "").trim();
 if (!name) return;

 nextItems.push({
 key: row.key,
 itemId: row?.itemId ?? saved?.itemId ?? null,
 name,
 type: String(row?.type || saved?.type || "consumible").trim().toLowerCase(),
 source: String(row?.source || saved?.source || "custom").trim().toLowerCase(),
 catalogId: row?.catalogId ?? saved?.catalogId ?? null,
 annualQty,
 annualQuantity: annualQty,
 equipmentId: row?.equipmentId ?? saved?.equipmentId ?? null,
 equipmentName: row?.equipmentName ?? saved?.equipmentName ?? null,
 });
 });

 const debugItemFromPayload = nextItems.find((item) => String(item?.itemId || "").trim() === "3321193001");
  debugInfo("[BC_CONSUMPTION][FE][BUILD_PAYLOAD]", {
  bcId,
  rowsVisible: visibleRowMap.size,
  itemsToSave: nextItems.length,
  excludedToSave: nextExcluded.length,
  nonZeroItemsSample: nextItems
  .filter((item) => Number(item?.annualQty ?? item?.annualQuantity ?? 0) > 0)
  .slice(0, 15)
  .map((item) => ({
  key: item?.key || null,
  itemId: item?.itemId || null,
  annualQty: item?.annualQty ?? item?.annualQuantity ?? 0,
  })),
  debugItem: debugItemFromPayload
  ? {
  key: debugItemFromPayload.key,
 itemId: debugItemFromPayload.itemId,
 annualQty: debugItemFromPayload.annualQty,
 source: debugItemFromPayload.source,
 }
 : null,
 });
  debugInfo("[DET_DEBUG] buildPersistPayloadFromDrafts", {
 bcId,
 visibleRows: visibleRowMap.size,
 nextItems: nextItems.length,
 nextExcluded: nextExcluded.length,
 pendingQtyKeys: Object.keys(pendingQtyChangesRef.current || {}),
 hasStructureChanges,
  sampleKeys: nextItems.slice(0, 8).map((item) => item?.key),
  qtySample: buildDebugQtySample(Array.from(visibleRowMap.values()), quantityDraftsRef.current, getSavedRow),
  });
  logFrontAudit("[BC_AUDIT][FE][BUILD_PERSIST_PAYLOAD]", {
  bcId,
  visibleRows: visibleRowMap.size,
  hasStructureChanges,
  nextExcludedCount: nextExcluded.length,
  nextExcludedSample: nextExcluded.slice(0, 40),
  nextItemsSummary: summarizeItemsForAudit(nextItems),
  });
 return { nextItems, nextExcluded };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [bcId, getSavedRow, hasStructureChanges, mergedRows]);

 const flushPendingQtyChanges = async (options = {}) => {
 const { force = false, markComplete = false } = options;
 const changedKeys = Object.keys(pendingQtyChangesRef.current || {});
 debugInfo("[DET_DEBUG] flushPendingQtyChanges:start", {
 bcId,
 force,
 markComplete,
 changedKeys,
 hasStructureChanges,
 });
 if (!force && !changedKeys.length && !hasStructureChanges) return;
 const { nextItems, nextExcluded } = buildPersistPayloadFromDrafts();
 debugInfo("[DET_DEBUG] flushPendingQtyChanges:payload_ready", {
 bcId,
 nextItems: nextItems.length,
 nextExcluded: nextExcluded.length,
 });
 await persistItems(nextItems, nextExcluded, {
 refresh: false,
 silent: false,
 revalidate: Boolean(force),
 markComplete,
 });
 debugInfo("[DET_DEBUG] flushPendingQtyChanges:done", { bcId });
 };

 // eslint-disable-next-line react-hooks/exhaustive-deps
 const handleQtyChange = (rowKey, value) => {
 const row = mergedRows.find((item) => item.key === rowKey);
 if (!row || !canEditType(row.type)) return;
 lastEditedRowRef.current = row;
 editedRowsRef.current[rowKey] = row;
 const nextDraftsRef = { ...quantityDraftsRef.current, [rowKey]: value };
 quantityDraftsRef.current = nextDraftsRef;
 setQuantityDrafts((prev) => {
 return { ...prev, [rowKey]: value };
 });
 const numeric = toPositiveNumber(value);
 const savedNumeric = toPositiveNumber(getSavedRow(row)?.annualQty ?? 0);
 if (numeric !== savedNumeric) {
 pendingQtyChangesRef.current[rowKey] = true;
 } else {
 delete pendingQtyChangesRef.current[rowKey];
 }
 setPendingChangesCount(Object.keys(pendingQtyChangesRef.current).length);
 if (String(row?.itemId || "").trim() === "3321193001") {
 debugInfo("[BC_CONSUMPTION][FE][QTY_CHANGE]", {
 bcId,
 rowKey,
 itemId: row.itemId,
 rawValue: value,
 parsedValue: numeric,
 savedQty: savedNumeric,
 });
 }
 if (!autosaveEnabled) return;
 };

const handleSaveNow = () => {
 // Guardado manual explícito: siempre persistimos snapshot actual para dejar avance en base.
 if (autosaveTimeoutRef.current) {
 clearTimeout(autosaveTimeoutRef.current);
 autosaveTimeoutRef.current = null;
 }
 debugInfo("[DET_DEBUG] handleSaveNow", {
 bcId,
 pendingQtyKeys: Object.keys(pendingQtyChangesRef.current || {}),
 hasStructureChanges,
 });
 flushPendingQtyChanges({ force: true, markComplete: false });
};

const handleCompleteSection = async () => {
 if (!canEditFinal || saving) return;
 if (!allSubsectionsLocked) {
 showToast("Primero debes bloquear reactivos, controles, calibradores y materiales.", "warning");
 return;
 }
 if (autosaveTimeoutRef.current) {
 clearTimeout(autosaveTimeoutRef.current);
 autosaveTimeoutRef.current = null;
 }
 const { nextItems, nextExcluded } = buildPersistPayloadFromDrafts();
 console.log("[BC_AUDIT][FE][COMPLETE_SECTION_CLICK]", {
 bcId,
 gatePhase,
 role: currentRole,
 nextItemsCount: nextItems.length,
 nextExcludedCount: nextExcluded.length,
 nonZeroItems: nextItems.filter((item) => Number(item?.annualQty ?? item?.annualQuantity ?? 0) > 0).length,
 });
 await persistItems(nextItems, nextExcluded, {
 refresh: true,
 silent: false,
 revalidate: true,
 markComplete: true,
 });
};

const handleValidateSubsection = async (sectionKey, sectionTitle = "seccion") => {
 if (!bcId || saving) return;
 try {
  await api.post(`/business-case/${bcId}/determinations/lock-subsection`, {
   subsection: sectionKey,
  });
  await loadExisting();
  await loadGateInfo();
  if (sectionKey === "reactivos") setIsDetermEditing(false);
  onSave({ refresh: true, markComplete: false });
  showToast(
   sectionKey === "reactivos"
    ? "Reactivos validados. Se notifico a Servicio para completar controles, calibradores y materiales."
    : `${sectionTitle} validado y cerrado correctamente.`,
   "success",
  );
 } catch (err) {
  showToast(getNaturalErrorMessage(err, `No se pudo validar ${sectionTitle.toLowerCase()}.`), "error");
 }
};

const handleValidateReactivos = async () => {
 if (!canValidateReactivos) return;
 await handleValidateSubsection("reactivos", "Reactivos");
};

const handleRequestUnlockSubsection = async (sectionKey) => {
 if (!bcId) return;
 const reason = await promptDialog({
  title: "Solicitar desbloqueo",
  message: `Motivo para solicitar desbloqueo de ${sectionKey}:`,
  required: true,
  confirmText: "Enviar solicitud",
 });
 if (!reason || !reason.trim()) return;
 try {
 await requestUnlockSubsection(bcId, sectionKey, reason.trim());
 await loadGateInfo();
 onSave({ refresh: true, markComplete: false });
 showToast(`Solicitud enviada a jefe_comercial para ${sectionKey}.`, "success");
 } catch (err) {
 showToast(getNaturalErrorMessage(err, `No se pudo solicitar desbloqueo para ${sectionKey}.`), "error");
 }
};

const handleReopenCommercial = async () => {
 if (!bcId) return;
 try {
  await api.post(`/business-case/${bcId}/determinations/reopen-commercial`);
  await loadGateInfo();
  setIsDetermEditing(false);
  onSave({ refresh: true, markComplete: false });
  showToast("Fase comercial reabierta. El equipo comercial puede volver a editar.", "success");
 } catch (err) {
  showToast(getNaturalErrorMessage(err, "No se pudo reabrir la fase comercial."), "error");
 }
};

const handleResolveUnlockSubsection = async (requestEntry, approve) => {
 if (!bcId || !requestEntry?.id) return;
 const notes = (await promptDialog({
  title: approve ? "Aprobar desbloqueo" : "Rechazar desbloqueo",
  message: approve ? "Notas de aprobación (opcional):" : "Motivo de rechazo:",
  required: !approve,
  confirmText: approve ? "Aprobar" : "Rechazar",
 })) || "";
 if (!approve && !notes.trim()) {
 showToast("Debes indicar el motivo de rechazo.", "warning");
 return;
 }
 try {
 await resolveUnlockSubsection(bcId, requestEntry.id, approve, notes.trim());
 await loadGateInfo();
 onSave({ refresh: true, markComplete: false });
 showToast(
  approve
   ? `Desbloqueo aprobado para ${requestEntry.subsection}.`
   : `Desbloqueo rechazado para ${requestEntry.subsection}.`,
  "success",
 );
 } catch (err) {
 showToast(getNaturalErrorMessage(err, "No se pudo resolver la solicitud."), "error");
 }
};

 const triggerAutoSheetSync = useCallback(async (caseId, options = {}) => {
  if (!caseId) return;
  setSheetSyncing(true);
  try {
   // force_recreate solo cuando el usuario dispara la sincronizacion a mano
   // (boton "Actualizar hoja") -- garantiza formato correcto (copia fresca
   // del Sheet maestro) en vez de reescribir valores sobre un archivo previo
   // que pudo haberse creado con el metodo viejo. El trigger automatico tras
   // subir el documento estadistico no fuerza recreacion (primera vez, no
   // hay archivo previo que corregir).
   const res = await api.post(`/business-case/${caseId}/sheets/generate`, {
    force_recreate: Boolean(options.forceRecreate),
   });
   const jobId = res?.data?.data?.job_id;
   if (!jobId) return;
   let attempts = 0;
   const poll = async () => {
    if (attempts >= 24) return;
    attempts += 1;
    await new Promise((r) => setTimeout(r, attempts < 8 ? 1000 : attempts < 16 ? 2000 : 3000));
     const statusRes = await api.get(`/business-case/${caseId}/sheets/jobs/${jobId}`);
     const job = statusRes?.data?.data || statusRes?.data;
     if (job?.status === "completed" && job?.sheet_url) {
     setSheetUrl(job.sheet_url);
      return;
     }
    if (job?.status === "failed") return;
    await poll();
   };
   await poll();
  } catch (err) {
   console.warn("[DET] auto-sheet-sync error", err?.message);
  } finally {
   setSheetSyncing(false);
  }
 }, []);

 const buildImportPreviewFromPaste = useCallback((text, rows) => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hasTabs = lines.some((l) => l.includes("\t"));
  if (hasTabs) {
   const byId = new Map();
   const byName = new Map();
   lines.forEach((line) => {
    const parts = line.split("\t");
    const key = String(parts[0] || "").trim();
    const valStr = String(parts[1] || "").replace(",", ".").replace(/[^0-9.]/g, "");
    const val = parseFloat(valStr);
    if (!key || !Number.isFinite(val) || val < 0) return;
    byId.set(key.toLowerCase(), Math.round(val));
    byName.set(key.toLowerCase(), Math.round(val));
   });
   return rows.map((row) => {
    const rowId = String(row.itemId || row.manufacturerId || "").trim().toLowerCase();
    const rowName = String(row.name || "").trim().toLowerCase();
    const val = (rowId ? byId.get(rowId) : undefined) ?? (rowName ? byName.get(rowName) : undefined) ?? null;
    return { item_key: row.key, item_name: row.name, current: getQtyInputValue(row), newValue: val };
   });
  }
  return rows.map((row, i) => {
   const line = lines[i];
   if (!line) return { item_key: row.key, item_name: row.name, current: getQtyInputValue(row), newValue: null };
   const valStr = line.replace(",", ".").replace(/[^0-9.]/g, "");
   const val = parseFloat(valStr);
   return { item_key: row.key, item_name: row.name, current: getQtyInputValue(row), newValue: Number.isFinite(val) && val >= 0 ? Math.round(val) : null };
  });
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [getQtyInputValue]);

 const applyImportPreview = useCallback((preview) => {
  const toApply = (preview || []).filter((p) => p.newValue !== null && Number.isFinite(Number(p.newValue)));
  toApply.forEach((p) => handleQtyChange(p.item_key, String(p.newValue)));
  return toApply.length;
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [handleQtyChange]);

 const closeImportModal = useCallback(() => {
  setImportModal(null);
  setImportPasteText("");
  setImportPreview(null);
  setImportTab("paste");
  if (importFileRef.current) importFileRef.current.value = "";
 }, []);

 const handleImportFile = useCallback(async (file, sectionKey) => {
  if (!file || !bcId) return;
  try {
   setImportFileLoading(true);
   const result = await parseDeterminationsQuantitiesFile(bcId, file, sectionKey || null);
   const matched = Array.isArray(result?.matched) ? result.matched : [];
   if (!matched.length) {
    showToast("No se encontraron ítems reconocibles en el archivo.", "warning");
    return;
   }
   const itemKeyToRow = new Map(mergedRows.map((r) => [r.key, r]));
   const preview = matched.map((m) => {
    const row = itemKeyToRow.get(m.item_key);
    return { item_key: m.item_key, item_name: m.item_name, current: row ? getQtyInputValue(row) : null, newValue: m.annual_qty };
   });
   setImportPreview(preview);
  } catch (err) {
   showToast(getNaturalErrorMessage(err, "No se pudo procesar el archivo."), "error");
  } finally {
   setImportFileLoading(false);
  }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [bcId, mergedRows, getQtyInputValue, showToast]);

 const handleUploadStatDocument = async () => {
 if (!bcId) {
 showToast("No se encontro el Business Case", "error");
 return;
 }
 if (!selectedDocument) {
 showToast("Selecciona un archivo para cargar", "warning");
 return;
 }
 const allowedMimeTypes = new Set([
 "application/pdf",
 "application/msword",
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 "application/vnd.ms-excel",
 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 "text/csv",
 "image/png",
 "image/jpeg",
 ]);
 const maxBytes = 15 * 1024 * 1024;
 if (selectedDocument.size > maxBytes) {
 showToast("El archivo supera 15MB.", "error");
 return;
 }
 if (selectedDocument.type && !allowedMimeTypes.has(selectedDocument.type)) {
 showToast("Tipo de archivo no permitido. Usa PDF, Word, Excel, CSV o imagen.", "error");
 return;
 }
 try {
 setUploadingDocument(true);
 await uploadDeterminationsStatDocument(bcId, selectedDocument);
 showToast("Documento estadístico cargado. Generando hoja de Sheets...", "success");
 setSelectedDocument(null);
 if (statDocumentInputRef.current) statDocumentInputRef.current.value = "";
 await loadGateInfo();
 onSave({ refresh: true, markComplete: false });
 triggerAutoSheetSync(bcId);
 } catch (err) {
 showToast(getNaturalErrorMessage(err, "No se pudo cargar el documento"), "error");
 } finally {
 setUploadingDocument(false);
 }
 };

 const handleSubmitInspectionRequest = async () => {
 if (!bcId) return;
 const minDate = String(inspectionModal.minDate || "").trim();
 const maxDate = String(inspectionModal.maxDate || "").trim();
 if (!minDate || !maxDate) {
 showToast("Debes registrar el rango minimo y maximo de instalacion.", "warning");
 return;
 }
 if (minDate > maxDate) {
 showToast("La fecha minima no puede ser mayor que la fecha maxima.", "warning");
 return;
 }
 try {
 setSubmittingInspectionRequest(true);
 await requestBusinessCaseEnvironmentInspection(bcId, {
  inspection_min_date: minDate,
  inspection_max_date: maxDate,
  persona_contacto: inspectionModal.contactName || undefined,
  celular_contacto: inspectionModal.contactPhone || undefined,
  accesorios: inspectionModal.accessories || undefined,
  anotaciones: inspectionModal.annotations || undefined,
  observaciones: inspectionModal.observations || undefined,
 });
 showToast("Solicitud de inspeccion de ambiente enviada correctamente.", "success");
 setInspectionModal({
 open: false,
 minDate: "",
 maxDate: "",
 contactName: "",
 contactPhone: "",
 accessories: "",
 annotations: "",
 observations: "",
 });
 await loadGateInfo();
 onSave({ refresh: true, markComplete: false });
 } catch (err) {
 showToast(getNaturalErrorMessage(err, "No se pudo solicitar la inspeccion de ambiente."), "error");
 } finally {
 setSubmittingInspectionRequest(false);
 }
 };

 const formatGateDateTime = (value) => {
 if (!value) return "No definido";
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return "No definido";
 return parsed.toLocaleString("es-EC", {
 year: "numeric",
 month: "2-digit",
 day: "2-digit",
 hour: "2-digit",
 minute: "2-digit",
 hour12: false,
 });
 };

 const gateSteps = useMemo(() => {
 const hasDoc = Boolean(gateInfo?.documentUploaded);
 const canEdit = Boolean(gateInfo?.permissions?.canEditDeterminations);
 const expired = Boolean(gateInfo?.isExpired);
 const inspectionRequested = Boolean(gateInfo?.inspectionRequest?.request_id);
 return [
 {
 id: "doc",
 label: "Documento estadistico",
 status: hasDoc ? "done" : "pending",
 },
 {
 id: "role",
 label: "Responsable habilitado",
 status: hasDoc && canEdit ? "done" : hasDoc ? "active" : "pending",
 },
 {
 id: "window",
 label: expired ? "Ventana 48h vencida" : "Ventana 48h",
 status: expired ? "blocked" : hasDoc ? "active" : "pending",
 },
 {
 id: "inspection",
 label: "Inspeccion de ambiente",
 status: inspectionRequested ? "done" : hasDoc ? "active" : "pending",
 },
 ];
 }, [gateInfo]);

 // ponytail: administracion manual de items (agregar/editar/quitar) removida --
 // las cantidades ahora se sincronizan desde el Sheet oficial
 // (syncConsumptionQuantitiesFromSheet en el backend). Esta seccion solo
 // muestra el resumen de lo ya sincronizado.

 return (
 <div className="space-y-5 animate-fadeIn">
 <div className="flex flex-col sm:flex-row sm:items-center gap-3">
 <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
 <FiActivity size={24} />
 </div>
 <div>
 <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Consumos anuales</h2>
 <p className="text-sm text-gray-500">
 Registre el consumo anual informado por el laboratorio para cada item segun los equipos seleccionados.
 </p>
 <div className="mt-2">
 <SectionEditorBadge ownership={ownership} />
 </div>
 </div>
 </div>

 <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
 <div className="flex flex-col gap-1">
 <h3 className="text-sm font-semibold text-gray-900">Documento estadistico para determinaciones</h3>
 <p className="text-xs text-gray-500">
 El comercial debe cargar este documento para habilitar la edicion de determinaciones y activar la ventana de 48 horas.
 </p>
 </div>
 {gateLoading ? (
 <div className="text-xs text-gray-500">Cargando estado del documento...</div>
 ) : (
 <div className="space-y-3">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
 {gateSteps.map((step) => (
 <div
 key={step.id}
 className={`rounded-lg border px-3 py-2 text-xs ${
 step.status === "done"
 ? "border-emerald-200 bg-emerald-50 text-emerald-700"
 : step.status === "active"
 ? "border-sky-200 bg-sky-50 text-sky-700"
 : step.status === "blocked"
 ? "border-rose-200 bg-rose-50 text-rose-700"
 : "border-gray-200 bg-gray-50 text-gray-600"
 }`}
 >
 <div className="font-semibold">{step.label}</div>
 </div>
 ))}
 </div>
 {gateInfo?.documentUploaded ? (
 <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 space-y-3">
 {/* Fila 1: identidad del documento (izquierda) | fechas (derecha) */}
 <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-0 text-xs text-gray-700">
 <div className="flex-1 min-w-0 space-y-1">
 <div>
 <span className="font-semibold text-gray-500">Documento:</span>{" "}
 {gateInfo?.document?.driveLink ? (
 <a
 href={gateInfo.document.driveLink}
 target="_blank"
 rel="noreferrer"
 className="text-blue-700 hover:underline break-words"
 >
 {gateInfo?.document?.name || "Ver archivo"}
 </a>
 ) : (
 <span className="break-words">{gateInfo?.document?.name || "Cargado"}</span>
 )}

 </div>
 <div>
 <span className="font-semibold text-gray-500">Subido por:</span> {gateInfo?.document?.uploadedByEmail || "N/A"}
 </div>
 </div>

 <div className="hidden sm:block w-px self-stretch bg-gray-200 mx-4" aria-hidden="true" />

 <div className="flex-1 min-w-0 space-y-1 sm:text-right">
 <div>
 <span className="font-semibold text-gray-500">Habilitado:</span> {formatGateDateTime(gateInfo?.enabledAt)}
 </div>
 <div>
 <span className="font-semibold text-gray-500">Vence:</span> {formatGateDateTime(gateInfo?.deadlineAt)}
 </div>
 </div>
 </div>

 {/* Fila 2: responsables (izquierda) | fase actual como badge (derecha) */}
 <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 pt-2 border-t border-gray-200 text-xs text-gray-700">
 <div className="flex-1 min-w-0">
 <span className="font-semibold text-gray-500">Responsables:</span> {(gateInfo?.editors || []).join(", ") || "N/A"}
 </div>
 <div className="flex-shrink-0">
 <span
 className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
 gatePhase === "technical_review"
 ? "bg-sky-100 text-sky-700"
 : gatePhase === "locked"
 ? "bg-rose-100 text-rose-700"
 : "bg-blue-100 text-blue-700"
 }`}
 >
 Fase: {gatePhase === "technical_review" ? "Revision tecnica" : gatePhase === "locked" ? "Bloqueada" : "Carga comercial"}
 </span>
 </div>
 </div>
 </div>
 ) : (
 <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
 Aun no se ha cargado el documento estadistico. La seccion de determinaciones permanece bloqueada.
 </div>
 )}

 {/* ponytail: el bloque "Hoja de Sheets disponible / Actualizar hoja /
     Sincronizar cantidades / Abrir en Sheets" se movio a CaseHeader.jsx --
     es un elemento universal del BC, no solo de Determinaciones. */}
 {sheetSyncing && (
 <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
  <FiRefreshCw size={14} className="text-emerald-600 animate-spin flex-shrink-0" />
  <span className="text-xs text-emerald-800 font-medium">Generando hoja de cálculo en Google Sheets...</span>
 </div>
 )}

  {canUploadDocument && !gateInfo?.documentUploaded && (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
  <div className="space-y-1">
  <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
  <FiUpload size={13} />
  Carga comercial
  </div>
  <p className="text-sm font-semibold text-slate-900">Selecciona y carga el documento estadistico</p>
  <p className="text-xs text-slate-600">
  Formatos permitidos: PDF, Word, Excel, CSV e imagen. Tamano maximo: 15 MB.
  </p>
  </div>
  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200">
  {selectedDocument ? "Archivo listo" : "Pendiente de seleccion"}
  </span>
  </div>
  {uploadBlockingMessage ? (
  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 space-y-2">
  <div className="font-semibold">La carga aun no esta habilitada.</div>
  <div>{uploadBlockingMessage}</div>
  {uploadMissingSections.length > 0 ? (
  <div className="flex flex-wrap gap-2">
  {uploadMissingSections.map((section) => (
  <span
  key={section.key || section.label}
  className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 border border-amber-200"
  >
  {section.label || section.key}
  </span>
  ))}
  </div>
  ) : null}
  </div>
  ) : null}
  <input
  ref={statDocumentInputRef}
  type="file"
  accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
  onChange={(e) => setSelectedDocument(e.target.files?.[0] || null)}
  className="hidden"
  />
  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4">
  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
  <div className="space-y-1">
  <div className="text-xs font-semibold text-slate-900">{selectedDocument ? selectedDocument.name : "Ningun archivo seleccionado"}</div>
  <div className="text-xs text-slate-500">{selectedDocumentSummary}</div>
  </div>
  <div className="flex flex-col sm:flex-row gap-2">
  <button
  type="button"
  onClick={() => statDocumentInputRef.current?.click()}
  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
  >
  <FiFileText size={14} />
  {selectedDocument ? "Cambiar archivo" : "Elegir archivo"}
  </button>
  <button
  type="button"
  onClick={handleUploadStatDocument}
  disabled={!selectedDocument || uploadingDocument || uploadReadiness?.canUpload === false}
  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
  >
  <FiUpload size={14} />
  {uploadingDocument ? "Cargando documento..." : "Subir documento"}
  </button>
  </div>
  </div>
  </div>
  </div>
  )}
  {/* Botón reemplazar — solo cuando ya hay documento y el usuario puede subir */}
  {canUploadDocument && gateInfo?.documentUploaded && (
  <div className="flex items-center justify-end">
  <input
  ref={statDocumentInputRef}
  type="file"
  accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
  onChange={(e) => setSelectedDocument(e.target.files?.[0] || null)}
  className="hidden"
  />
  {selectedDocument ? (
  <div className="flex items-center gap-2">
  <span className="text-xs text-slate-600 truncate max-w-[180px]">{selectedDocument.name}</span>
  <button
  type="button"
  onClick={handleUploadStatDocument}
  disabled={uploadingDocument}
  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
  >
  <FiUpload size={12} />
  {uploadingDocument ? "Subiendo..." : "Subir reemplazo"}
  </button>
  <button type="button" onClick={() => setSelectedDocument(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
  </div>
  ) : (
  <button
  type="button"
  onClick={() => statDocumentInputRef.current?.click()}
  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
  >
  <FiUpload size={12} />
  Reemplazar documento
  </button>
  )}
  </div>
  )}

 {gateInfo?.documentUploaded && (
 <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
 <div className="flex items-start justify-between gap-3">
 <div className="space-y-1">
 <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
 <FiFileText size={13} />
 Solicitud tecnica
 </div>
 <h4 className="text-sm font-semibold text-slate-900">Solicitar inspeccion de ambiente por costos</h4>
 <p className="text-xs text-slate-600">
 Registra el rango estimado para la inspeccion de ambiente por costos o factibilidad. El sistema llenara el F.ST-20 con la informacion ya guardada en las secciones previas del Business Case.
 </p>
 </div>
 {inspectionRequestInfo?.request_id ? (
 <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
 Solicitada
 </span>
 ) : (
 <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">
 Pendiente
 </span>
 )}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
 <div className="rounded-lg bg-white border border-slate-200 px-3 py-2">
 <div className="font-semibold text-slate-900">Cliente</div>
 <div>{inspectionSummary.clientName}</div>
 </div>
 <div className="rounded-lg bg-white border border-slate-200 px-3 py-2">
 <div className="font-semibold text-slate-900">Proceso</div>
 <div>{inspectionSummary.processCode}</div>
 </div>
 <div className="rounded-lg bg-white border border-slate-200 px-3 py-2">
 <div className="font-semibold text-slate-900">Direccion</div>
 <div>{inspectionSummary.address}</div>
 </div>
 </div>

 {inspectionRequestInfo?.request_id ? (
 <div className="space-y-2 text-xs text-slate-700">
 <div><span className="font-semibold">Solicitud:</span> #{inspectionRequestInfo.request_id}</div>
 <div>
 <span className="font-semibold">Rango registrado:</span>{" "}
 {inspectionRequestInfo?.inspection_min_date || "Pendiente"} a {inspectionRequestInfo?.inspection_max_date || "Pendiente"}
 </div>
 {inspectionRequestInfo?.acta_document_link && (
 <a
 href={inspectionRequestInfo.acta_document_link}
 target="_blank"
 rel="noreferrer"
 className="inline-flex items-center gap-2 text-blue-700 hover:underline"
 >
 <FiFileText size={13} />
 Ver F.ST-20 por costos
 </a>
 )}
 <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-700">
 El departamento de servicio seleccionara la fecha exacta de inspeccion dentro del rango registrado.
 </div>
 </div>
 ) : (
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3">
 <div className="text-xs text-slate-600">
 Despues de enviarla, el departamento de servicio podra escoger la fecha exacta dentro del rango indicado.
 </div>
 <button
 type="button"
 onClick={() => setInspectionModal({
 open: true,
 minDate: inspectionRequestInfo?.inspection_min_date || "",
 maxDate: inspectionRequestInfo?.inspection_max_date || "",
 contactName: inspectionSummary.contactName || "",
 contactPhone: inspectionSummary.contactPhone || "",
 accessories: inspectionSummary.accessories || "",
 annotations: inspectionSummary.annotations || "",
 observations: inspectionSummary.observations || "",
 })}
 disabled={!canRequestInspection}
 className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
 >
 <FiCalendar size={14} />
 Solicitar inspeccion
 </button>
 </div>
 )}
 </div>
 )}

{!canEditFinal && (
<div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
 {technicalSlaExpired
 ? "No se puede editar ni sincronizar determinaciones por SLA vencido. Solicita una prorroga de 24 horas a Jefe Comercial."
 : quantitiesLocked
 ? "Las cantidades quedaron bloqueadas tras cierre tecnico. Solicita reapertura con Jefe Comercial."
 : "No tienes habilitada la edicion de determinaciones para este flujo o la ventana de 48 horas ya expiro."}
</div>
)}
 </div>
 )}
 </div>

 {loading ? (
 <div className="flex justify-center py-12">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
 </div>
 ) : (
 <div className="space-y-5">
 {groupedByEquipment.map((group) => {
 return (
 <div key={group.key} className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-base font-semibold text-gray-900">{group.name}</h3>
 <p className="text-xs text-gray-500">
 Resumen de consumos anuales sincronizados desde el Sheet oficial del Business Case.
 </p>
 </div>
 </div>

{DETERMINATION_CATEGORY_CONFIG.map((section) => {
const rowsRaw = group.categories?.[section.key] || [];
const rows =
gatePhase === "technical_review" && isTechnicalRole && section.key === "reactivos"
? rowsRaw.filter((row) => toPositiveNumber(getQtyInputValue(row)) > 0)
: rowsRaw;
const subsectionLocked = isSubsectionLocked(section.key);
const pendingUnlock = pendingUnlockBySubsection[section.key] || null;
const rowLimit = getWindowLimit(group.key, section.key);
 const visibleRows = rows.slice(0, rowLimit);
 const isCollapsed = isSectionCollapsed(group.key, section.key);
 // Al menos un item con cantidad sincronizada desde el Sheet ya cuenta como
 // "Sincronizado" -- no hace falta que todos tengan cantidad para dejar de
 // verse "Pendiente".
 const hasSyncedItems = rows.some((row) => toPositiveNumber(getQtyInputValue(row)) > 0);
 const sectionReadyToClose = rows.length > 0 && rows.every((row) => toPositiveNumber(getQtyInputValue(row)) > 0);
 const canValidateSection =
 section.key === "reactivos"
 ? canValidateReactivos
 : canEditFinal && !subsectionLocked && sectionReadyToClose;

 return (
 <div key={`${group.key}:${section.key}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
 <div className="w-full px-4 py-3 border-b border-gray-100 bg-gray-50/70 text-left flex items-center justify-between gap-3">
 <div>
 <h4 className="text-sm font-semibold text-gray-800">{section.title}</h4>
 <p className="text-xs text-gray-500">{section.description}</p>
 </div>
 <div className="flex items-center gap-2">
{sheetUrl && (
<a
href={sheetUrl}
target="_blank"
rel="noreferrer"
onClick={(event) => event.stopPropagation()}
className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
title={`Abrir Sheet oficial para ${section.title.toLowerCase()}`}
aria-label={`Abrir Sheet oficial para ${section.title.toLowerCase()}`}
>
<FiExternalLink size={14} />
</a>
)}
{canValidateSection && (
<button
type="button"
onClick={(event) => {
event.stopPropagation();
handleValidateSubsection(section.key, section.title);
}}
disabled={saving}
className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
title={`Validar y cerrar ${section.title.toLowerCase()}`}
aria-label={`Validar y cerrar ${section.title.toLowerCase()}`}
>
<FiCheck size={14} />
</button>
)}
{/* ponytail: las cantidades ahora se sincronizan desde el Sheet oficial
    (ver syncConsumptionQuantitiesFromSheet en el backend) -- se quitaron
    "Guardar seccion" e "Importar cantidades", ya no aplican. "Bloquear
    subseccion" tambien se quito: sin edicion manual no hay nada que
    bloquear yendo hacia adelante. Se deja el flujo de desbloqueo por si
    alguna subseccion ya quedo bloqueada de antes de este cambio. */}
{subsectionLocked && !pendingUnlock && !isJefeComercial && (
<button
type="button"
onClick={(event) => {
event.stopPropagation();
handleRequestUnlockSubsection(section.key);
}}
disabled={saving}
className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
>
Solicitar desbloqueo
</button>
)}
{pendingUnlock && (
<span className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold bg-amber-100 text-amber-800">
Desbloqueo pendiente
</span>
)}
{isJefeComercial && pendingUnlock && (
<>
<button
type="button"
onClick={(event) => {
event.stopPropagation();
handleResolveUnlockSubsection(pendingUnlock, true);
}}
disabled={saving}
className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-100 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
>
Aprobar desbloqueo
</button>
<button
type="button"
onClick={(event) => {
event.stopPropagation();
handleResolveUnlockSubsection(pendingUnlock, false);
}}
disabled={saving}
className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-100 px-2.5 py-1.5 text-[11px] font-semibold text-rose-800 hover:bg-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
>
Rechazar desbloqueo
</button>
</>
)}
<span
className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
 hasSyncedItems ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
}`}
 >
 <FiCheck size={11} />
 {hasSyncedItems ? "Sincronizado" : "Pendiente"}
 </span>
 <button
 type="button"
 onClick={() => toggleSectionCollapsed(group.key, section.key)}
 className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-100"
 aria-label={isCollapsed ? "Expandir seccion" : "Colapsar seccion"}
 >
 <FiChevronDown
 className={`transition-transform ${isCollapsed ? "" : "rotate-180"}`}
 size={16}
 />
 </button>
 </div>
 </div>

 {!isCollapsed && (
 <>
 <div className="overflow-x-auto">
 <table className="min-w-[640px] text-xs sm:text-sm">
 <thead className="bg-gray-50/50">
 <tr className="text-left text-gray-500 border-b border-gray-100">
 <th className="py-3 px-4 font-semibold">Tipo</th>
 <th className="py-3 px-4 font-semibold">Nombre</th>
 <th className="py-3 px-4 font-semibold">
 {section.key === "reactivos" ? "Cantidad anual (Sheet)" : "Producto calculado (Sheet)"}
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {visibleRows.map((row) => {
 const manufacturerId = getManufacturerId(row);
 return (
 <tr key={row.key} className="hover:bg-gray-50/50 transition-colors">
 <td className="py-3 px-4 text-gray-600">
 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
 {row.type}
 </span>
 </td>
 <td className="py-3 px-4">
 <div className="space-y-0.5">
 <span className="font-semibold text-gray-900">{row.name}</span>
 {manufacturerId && (
 <div className="text-xs text-gray-400">ID fabricante: {manufacturerId}</div>
 )}
 </div>
 </td>
 <td className="py-3 px-4 font-medium text-gray-900">
 {getQtyInputValue(row)}
 </td>
 </tr>
 );
 })}
 {!rows.length && (
 <tr>
 <td colSpan={3} className="py-8 text-center text-gray-500">
 No hay elementos en {section.title.toLowerCase()} para este equipo.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 {rows.length > visibleRows.length && (
 <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/70">
 <button
 type="button"
 onClick={() => expandRowWindow(group.key, section.key)}
 className="text-xs font-semibold text-blue-700 hover:text-blue-800"
 >
 Mostrar mas ({rows.length - visibleRows.length} restantes)
 </button>
 </div>
 )}
 </>
 )}
 </div>
 );
 })}
 </div>
 );
 })}
 </div>
 )}

 {/* Footer principal — patrón Editar / Guardar / Cerrar definitivo */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100">
  <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
   {saving && (
    <>
     <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500" />
     <span className="text-blue-600">Guardando...</span>
    </>
   )}
   {!saving && isDetermEditing && (pendingChangesCount > 0 || hasStructureChanges) && (
    <span className="inline-flex items-center gap-1 text-amber-600">
     <FiAlertTriangle size={12} />
     {pendingChangesCount + (hasStructureChanges ? 1 : 0)} cambio(s) sin guardar
    </span>
   )}
   {!saving && !isDetermEditing && canReopenCommercial && (
    <span className="text-amber-600 font-semibold">Sección cerrada por el equipo comercial — solo jefe_comercial puede reabrir.</span>
   )}
   {!saving && !isDetermEditing && !canReopenCommercial && (canEditBase) && (
    <span>Sección en modo solo lectura.</span>
   )}
  </div>

  <div className="flex flex-wrap gap-2 sm:justify-end">
   {/* jefe_comercial: botón reabrir cuando ya terminó la fase comercial */}
   {canReopenCommercial && (
    <button
     type="button"
     onClick={handleReopenCommercial}
     disabled={saving}
     className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 transition-all disabled:opacity-50 w-full sm:w-auto"
    >
     Reabrir para edición
    </button>
   )}

   {/* Modo lectura: mostrar botón Editar (solo si tiene permiso de edición gate-level) */}
   {canValidateReactivos && (
    <button
     type="button"
     onClick={handleValidateReactivos}
     disabled={saving}
     className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.99] shadow-sm transition-all disabled:opacity-50 w-full sm:w-auto"
     title="Valida los reactivos sincronizados y habilita la etapa tecnica"
    >
     <FiCheck size={16} />
     Validar reactivos y enviar a Servicio
    </button>
   )}

   {!isDetermEditing && !canReopenCommercial && (canEditBase && canEditByGate && !quantitiesLocked) && (
    <button
     type="button"
     onClick={() => setIsDetermEditing(true)}
     className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all w-full sm:w-auto"
    >
     Editar
    </button>
   )}

   {/* Modo edición: Cancelar + Guardar información + Cerrar definitivamente */}
   {isDetermEditing && (
    <>
     <button
      type="button"
      onClick={() => { setIsDetermEditing(false); closeImportModal(); }}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all w-full sm:w-auto"
     >
      Cancelar
     </button>
     <button
      type="button"
      onClick={handleSaveNow}
      disabled={saving}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.99] shadow-sm transition-all disabled:opacity-50 w-full sm:w-auto"
     >
      <FiSave size={16} />
      {saving ? "Guardando..." : "Guardar información"}
     </button>
     <button
      type="button"
      onClick={handleCompleteSection}
      disabled={saving || !allSubsectionsLocked}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 active:scale-[0.99] shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
      title={!allSubsectionsLocked ? "Primero bloquea todas las subsecciones" : "Cierra definitivamente la fase comercial"}
     >
      Cerrar definitivamente
     </button>
    </>
   )}
  </div>
 </div>

 {/* Modal de solicitud de inspeccion de ambiente — usa Dialog de Headless UI
     para portal correcto, focus-trap, cierre con Escape y z-index DESIGN.md */}
 <Dialog
  open={inspectionModal.open}
  onClose={() => {
   if (submittingInspectionRequest) return;
   setInspectionModal({ open: false, minDate: "", maxDate: "", contactName: "", contactPhone: "", accessories: "", annotations: "", observations: "" });
  }}
  className="relative z-[40]"
 >
  {/* Backdrop — z-index modalBackdrop=30 gestionado por Dialog */}
  <div className="fixed inset-0 z-[30] bg-slate-950/40 backdrop-blur-sm" aria-hidden="true" />

  <div className="fixed inset-0 z-[40] flex items-center justify-center px-4 py-6 overflow-y-auto">
   <Dialog.Panel className="w-full max-w-xl overflow-hidden rounded-2xl border border-soft-border bg-white shadow-2xl">
    {/* Header */}
    <div className="flex items-start justify-between gap-3 border-b border-soft-border px-6 py-5">
     <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warm-ash">Inspeccion por costos</p>
      <Dialog.Title className="mt-0.5 text-lg font-semibold text-ink-slate">Solicitar F.ST-20 por costos</Dialog.Title>
      <p className="mt-1 text-sm text-warm-ash">
       Registra el rango estimado de la inspeccion por costos. Los datos del cliente, direccion y equipo se tomaran del Business Case.
      </p>
     </div>
     <button
      type="button"
      onClick={() => !submittingInspectionRequest && setInspectionModal({ open: false, minDate: "", maxDate: "", contactName: "", contactPhone: "", accessories: "", annotations: "", observations: "" })}
      className="rounded-lg p-2 text-warm-ash hover:bg-paper-white transition-colors"
      aria-label="Cerrar modal"
     >
      <FiX size={16} />
     </button>
    </div>

    {/* Body */}
    <div className="space-y-5 px-6 py-5 max-h-[70vh] overflow-y-auto">
     {inspectionMissingFields.length > 0 && (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-caution-amber">
        <span className="font-semibold">Faltan datos para F.ST-20 por costos:</span>{" "}
       {inspectionMissingFields.join(", ")}.
      </div>
     )}

     {/* Rango de instalacion */}
     <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="space-y-1.5">
       <span className="text-xs font-semibold uppercase tracking-wide text-warm-ash">Fecha minima de instalacion <span className="text-alert-red">*</span></span>
       <input
        type="date"
        value={inspectionModal.minDate}
        onChange={(e) => setInspectionModal((prev) => ({ ...prev, minDate: e.target.value }))}
        className="w-full rounded-[12px] border border-fog bg-white px-3 py-2 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
       />
      </label>
      <label className="space-y-1.5">
       <span className="text-xs font-semibold uppercase tracking-wide text-warm-ash">Fecha maxima de instalacion <span className="text-alert-red">*</span></span>
       <input
        type="date"
        value={inspectionModal.maxDate}
        min={inspectionModal.minDate || undefined}
        onChange={(e) => setInspectionModal((prev) => ({ ...prev, maxDate: e.target.value }))}
        className="w-full rounded-[12px] border border-fog bg-white px-3 py-2 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
       />
      </label>
     </div>

     {/* Datos de contacto */}
     <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="space-y-1.5">
       <span className="text-xs font-semibold uppercase tracking-wide text-warm-ash">Persona de contacto</span>
       <input
        type="text"
        value={inspectionModal.contactName}
        onChange={(e) => setInspectionModal((prev) => ({ ...prev, contactName: e.target.value }))}
        className="w-full rounded-[12px] border border-fog bg-white px-3 py-2 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
        placeholder="Nombre del contacto"
       />
      </label>
      <label className="space-y-1.5">
       <span className="text-xs font-semibold uppercase tracking-wide text-warm-ash">Celular de contacto</span>
       <input
        type="text"
        value={inspectionModal.contactPhone}
        onChange={(e) => setInspectionModal((prev) => ({ ...prev, contactPhone: e.target.value }))}
        className="w-full rounded-[12px] border border-fog bg-white px-3 py-2 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
        placeholder="+593 9xx xxx xxxx"
       />
      </label>
     </div>

     {/* Resumen datos BC — solo lectura */}
     <div className="rounded-[16px] border border-soft-border bg-paper-white p-4 space-y-2 text-sm text-ink-slate">
      <p className="text-xs font-semibold uppercase tracking-wide text-warm-ash mb-2">Datos tomados del Business Case</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
       <div><span className="font-semibold text-ink-slate">Cliente:</span>{" "}<span className="text-warm-ash">{inspectionSummary.clientName}</span></div>
       <div><span className="font-semibold text-ink-slate">Proceso:</span>{" "}<span className="text-warm-ash">{inspectionSummary.processCode}</span></div>
       <div className="sm:col-span-2"><span className="font-semibold text-ink-slate">Direccion:</span>{" "}<span className="text-warm-ash">{inspectionSummary.address}</span></div>
       <div className="sm:col-span-2">
        <span className="font-semibold text-ink-slate">Equipos:</span>{" "}
        <span className="text-warm-ash">
         {inspectionSummary.equipment.length
          ? inspectionSummary.equipment.map((item) => item?.nombre_equipo || "Equipo").join(", ")
          : <span className="italic">Pendiente — configura equipos en la seccion de equipos del BC</span>
         }
        </span>
       </div>
      </div>
     </div>

     {/* Accesorios */}
     <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-warm-ash">Accesorios</span>
      <input
       type="text"
       value={inspectionModal.accessories}
       onChange={(e) => setInspectionModal((prev) => ({ ...prev, accessories: e.target.value }))}
       className="w-full rounded-[12px] border border-fog bg-white px-3 py-2 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
       placeholder="Ej: mangueras, adaptadores..."
      />
     </label>

     {/* Anotaciones */}
     <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-warm-ash">Anotaciones</span>
      <textarea
       rows={3}
       value={inspectionModal.annotations}
       onChange={(e) => setInspectionModal((prev) => ({ ...prev, annotations: e.target.value }))}
       className="w-full rounded-[12px] border border-fog bg-white px-3 py-2 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20 resize-none"
       placeholder="Notas adicionales para el tecnico..."
      />
     </label>

     {/* Observaciones */}
     <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-warm-ash">Observaciones</span>
      <textarea
       rows={4}
       value={inspectionModal.observations}
       onChange={(e) => setInspectionModal((prev) => ({ ...prev, observations: e.target.value }))}
       className="w-full rounded-[12px] border border-fog bg-white px-3 py-2 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20 resize-none"
       placeholder="Observaciones del Business Case..."
      />
     </label>
    </div>

    {/* Footer */}
    <div className="flex items-center justify-end gap-3 border-t border-soft-border bg-paper-white px-6 py-4">
     <button
      type="button"
      onClick={() => setInspectionModal({ open: false, minDate: "", maxDate: "", contactName: "", contactPhone: "", accessories: "", annotations: "", observations: "" })}
      disabled={submittingInspectionRequest}
      className="rounded-[16px] border border-fog px-4 py-2 text-sm font-medium text-ink-slate hover:bg-white transition-colors disabled:opacity-50"
     >
      Cancelar
     </button>
     <button
      type="button"
      onClick={handleSubmitInspectionRequest}
      disabled={submittingInspectionRequest}
      className="inline-flex items-center gap-2 rounded-[16px] bg-action-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.97] transition-all disabled:opacity-50"
     >
      <FiCheck size={15} />
      {submittingInspectionRequest ? "Enviando..." : "Enviar solicitud"}
     </button>
    </div>
   </Dialog.Panel>
  </div>
 </Dialog>

 {/* ===== IMPORT QUANTITIES MODAL ===== */}
 {importModal && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={closeImportModal}>
   <div
    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
    onClick={(e) => e.stopPropagation()}
   >
    {/* Header */}
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/70">
     <div>
      <h2 className="text-base font-bold text-gray-900">Importar cantidades</h2>
      <p className="text-xs text-gray-500 mt-0.5">
       Sección: <span className="font-semibold text-violet-700 capitalize">{importModal.sectionKey}</span>
       {" · "}{importModal.rows.length} ítem(s)
      </p>
     </div>
     <button type="button" onClick={closeImportModal} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
      <FiX size={18} />
     </button>
    </div>

    {/* Tabs */}
    <div className="flex border-b border-gray-100">
     {[
      { key: "paste", label: "Pegar desde Excel", icon: <FiClipboard size={13} /> },
      { key: "file", label: "Subir documento", icon: <FiUpload size={13} /> },
     ].map((tab) => (
      <button
       key={tab.key}
       type="button"
       onClick={() => { setImportTab(tab.key); setImportPreview(null); setImportPasteText(""); if (importFileRef.current) importFileRef.current.value = ""; }}
       className={`flex items-center gap-1.5 px-5 py-3 text-xs font-semibold border-b-2 transition-colors ${
        importTab === tab.key
         ? "border-violet-600 text-violet-700"
         : "border-transparent text-gray-500 hover:text-gray-700"
       }`}
      >
       {tab.icon}{tab.label}
      </button>
     ))}
    </div>

    {/* Body */}
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
     {importTab === "paste" && (
      <div className="space-y-3">
       <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 text-xs text-violet-800 space-y-1">
        <p className="font-semibold">¿Cómo pegar desde Excel?</p>
        <p>• <strong>Solo números (una por línea):</strong> Copia la columna de cantidades — cada línea se asigna al ítem en el mismo orden que aparece en la lista.</p>
        <p>• <strong>Dos columnas (ID [Tab] Cantidad):</strong> Copia ID fabricante y cantidad separados por tabulador para que el sistema haga la correspondencia automáticamente.</p>
       </div>
       <textarea
        rows={8}
        value={importPasteText}
        onChange={(e) => { setImportPasteText(e.target.value); setImportPreview(null); }}
        onPaste={(e) => {
         const text = e.clipboardData.getData("text");
         setImportPasteText(text);
         setImportPreview(null);
         e.preventDefault();
        }}
        placeholder={"100\n250\n80\n...\n\no con ID:\nABC-123\t100\nXYZ-456\t250"}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
       />
       <div className="flex justify-end">
        <button
         type="button"
         disabled={!importPasteText.trim()}
         onClick={() => setImportPreview(buildImportPreviewFromPaste(importPasteText, importModal.rows))}
         className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
        >
         <FiActivity size={13} />
         Previsualizar
        </button>
       </div>
      </div>
     )}

     {importTab === "file" && (
      <div className="space-y-3">
       <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-800 space-y-1">
        <p className="font-semibold">Sube un archivo Excel o CSV</p>
        <p>El sistema buscará en el archivo ítems que coincidan por ID de fabricante o nombre con los de esta sección, y leerá la columna de cantidad anual.</p>
        <p className="text-blue-600">Formatos aceptados: .xlsx, .xls, .csv</p>
       </div>
       <div className="flex flex-col gap-3">
        <input
         ref={importFileRef}
         type="file"
         accept=".xlsx,.xls,.csv"
         className="block w-full text-xs text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-violet-50 file:text-violet-700 file:font-semibold hover:file:bg-violet-100 cursor-pointer"
         onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) { setImportPreview(null); }
         }}
        />
        <button
         type="button"
         disabled={importFileLoading}
         onClick={() => {
          const f = importFileRef.current?.files?.[0];
          if (!f) { showToast("Selecciona un archivo primero.", "warning"); return; }
          handleImportFile(f, importModal.sectionKey);
         }}
         className="inline-flex items-center gap-1.5 self-end rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
        >
         {importFileLoading ? <><div className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Procesando...</> : <><FiFileText size={13} />Leer archivo</>}
        </button>
       </div>
      </div>
     )}

     {/* Preview table */}
     {importPreview && (
      <div className="space-y-2">
       <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Vista previa</h3>
        <span className="text-xs text-gray-500">
         {importPreview.filter((p) => p.newValue !== null).length} de {importPreview.length} ítem(s) con valor
        </span>
       </div>
       <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-xs">
         <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
           <th className="px-3 py-2 text-left font-semibold text-gray-600">Ítem</th>
           <th className="px-3 py-2 text-right font-semibold text-gray-600 w-24">Actual</th>
           <th className="px-3 py-2 text-right font-semibold text-gray-600 w-28">Nuevo valor</th>
          </tr>
         </thead>
         <tbody className="divide-y divide-gray-100">
          {importPreview.map((p) => (
           <tr key={p.item_key} className={p.newValue !== null ? "" : "opacity-40"}>
            <td className="px-3 py-2 text-gray-800 max-w-[260px] truncate">{p.item_name}</td>
            <td className="px-3 py-2 text-right text-gray-500 font-mono">{p.current ?? "—"}</td>
            <td className="px-3 py-2 text-right font-mono">
             {p.newValue !== null
              ? <span className="font-semibold text-emerald-700">{p.newValue}</span>
              : <span className="text-gray-300">sin dato</span>
             }
            </td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>
      </div>
     )}
    </div>

    {/* Footer */}
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
     <p className="text-xs text-gray-500">
      {importPreview
       ? `${importPreview.filter((p) => p.newValue !== null).length} cantidad(es) listas para aplicar.`
       : "Previsualiza antes de aplicar."}
     </p>
     <div className="flex gap-2">
      <button type="button" onClick={closeImportModal} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
       Cancelar
      </button>
      <button
       type="button"
       disabled={!importPreview?.some((p) => p.newValue !== null)}
       onClick={() => {
        const n = applyImportPreview(importPreview);
        showToast(`${n} cantidad(es) aplicada(s). Guarda la sección para confirmar.`, "success");
        closeImportModal();
       }}
       className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
       <FiCheck size={13} />
       Aplicar {importPreview?.filter((p) => p.newValue !== null).length ?? 0} cambio(s)
      </button>
     </div>
    </div>
   </div>
  </div>
 )}
 </div>
 );
};

export default DeterminationsSection;
