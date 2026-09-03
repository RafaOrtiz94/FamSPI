import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiActivity, FiCalendar, FiCheck, FiChevronDown, FiExternalLink, FiFileText, FiRefreshCw, FiUpload, FiX } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../../core/auth/AuthContext";
import { recordBusinessCaseTelemetry } from "../../../../core/utils/businessCaseTelemetry";
import { promptDialog } from "../../../../core/ui/utils/promptDialog";
import SectionEditorBadge from "./SectionEditorBadge";
import {
 getDeterminationsStatDocumentInfo,
 requestBusinessCaseEnvironmentInspection,
 uploadDeterminationsStatDocument,
} from "../../../../core/api/businessCaseApi";

const isAffirmative = (value) => {
 const normalized = String(value ?? "").trim().toLowerCase();
 return value === true || ["true", "1", "yes", "si", "sí"].includes(normalized);
};
// Public BC: only acp_comercial. Private BC: only backoffice.
const PUBLIC_BC_TYPES = new Set(["public", "comodato_publico"]);
// Roles que ejecutan la parte técnica (inspección, actas, calibradores propios)
const TECNICO_ROLES = new Set(["jefe_tecnico", "jefe_servicio"]);
const ROW_WINDOW_STEP = 24;
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
  if (row?.catalogId != null) {
    return [
      normalizeTextKey(row?.equipmentId),
      row?.catalogKind || "catalog",
      "catalog",
      normalizeTextKey(row?.catalogId),
    ].join("|");
  }
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
 const [quantityDrafts, setQuantityDrafts] = useState({});
 const quantityDraftsRef = useRef({});
 const [rowWindowByGroup, setRowWindowByGroup] = useState({});
 const [collapsedSections, setCollapsedSections] = useState({});
 const savedItemsRef = useRef([]);
 const excludedKeysRef = useRef([]);
 const consumptionVersionRef = useRef(null);
 const [equipmentIds, setEquipmentIds] = useState([]);
 const [equipmentMeta, setEquipmentMeta] = useState({});

 const lastSavedKeysRef = useRef([]);

 const canEditBase = permissions.canEditDeterminations === true && ownership?.canUserEdit !== false;
 const currentRole = user?.role;
 const normalizedCurrentRole = String(currentRole || "").trim().toLowerCase();
 const isJefeComercial = normalizedCurrentRole === "jefe_comercial" || normalizedCurrentRole === "jefe_de_comercial";
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
 const canEditFinal = (gateActive ? (canEditBase && canEditByGate) : canEditBase) && !quantitiesLocked;
 const technicalSlaExpired = gateInfo?.extensionRequired === true || gateInfo?.technicalSlaExpired === true;
 const canReopenCommercial = isJefeComercial && gatePhase === "technical_review";
 // Ventana de 48h vencida ANTES de validar reactivos (fase aun comercial) --
 // reopenDeterminationsCommercial solo aplica DESPUES de validar, asi que sin
 // esto el BC quedaba bloqueado sin ninguna accion visible para nadie.
 const canRenewCommercialWindow = isJefeComercial && gatePhase === "commercial_input" && gateInfo?.isExpired === true;
 const sectionLocks = gateInfo?.sectionLocks || {};
 const isSubsectionLocked = (subsectionKey) => Boolean(sectionLocks?.[subsectionKey]) || quantitiesLocked;
 const allSubsectionsLocked = ["reactivos", "controles", "calibradores", "materiales"].every((key) => isSubsectionLocked(key));
 // Bloquea controles + calibradores + materiales (no cierra la seccion).
 // Se oculta una vez que las 3 ya estan bloqueadas -- a partir de ahi el
 // unico paso pendiente es el cierre explicito de mas abajo.
 const canCloseAllTechnicalSubsections =
 canEditFinal &&
 isTechnicalRole &&
 gatePhase === "technical_review" &&
 !quantitiesLocked &&
 !allSubsectionsLocked;
 // Cierre EXPLICITO de la seccion "Determinaciones" -- nunca automatico.
 // Solo aparece cuando las 4 subsecciones (incluyendo reactivos) ya estan
 // bloqueadas; el usuario debe hacer click a proposito para avanzar a
 // Inversiones, no ocurre como efecto secundario de bloquear la ultima
 // subseccion.
 const canCloseDeterminationsSection =
 canEditFinal &&
 isTechnicalRole &&
 gatePhase === "technical_review" &&
 !quantitiesLocked &&
 allSubsectionsLocked;
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
 const persistedSyncedItems = (savedItems || []).filter((item) => item.source !== "custom");
 const catalogVisible = (catalogItems || []).filter((item) => {
 if (excludedKeys.includes(item.key)) return false;
 if (item.legacyKey && excludedKeys.includes(item.legacyKey)) return false;
 return true;
 });
 const normalizedPersistedSynced = persistedSyncedItems.map((item) => ({
 ...item,
 type: toUiType(item?.type),
 manufacturerId: item.manufacturerId || item.itemId || null,
 equipmentName: item.equipmentName || "Manual",
 equipmentId: item.equipmentId || null,
 }));
 const enrichedCustom = customItems.map((item) => ({
 ...item,
 type: toUiType(item?.type),
 manufacturerId: item.manufacturerId || item.itemId || null,
 equipmentName: item.equipmentName || "Manual",
 equipmentId: item.equipmentId || null,
 }));
 return dedupeVisibleRowsForUI([
 ...catalogVisible,
 ...normalizedPersistedSynced,
 ...enrichedCustom,
 ]);
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
  rowCatalogId !== null &&
  itemCatalogId !== null &&
  String(rowCatalogId) !== String(itemCatalogId) &&
  sameEquipment
  ) {
  return false;
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

 const getPlannedQtyValue = (row) => {
 const value = getSavedRow(row)?.plannedQty;
 return value === null || value === undefined ? "0" : String(value);
 };

 const getSheetQtyDisplayValue = (row, sectionKey) => (
 sectionKey === "reactivos" ? getQtyInputValue(row) : getPlannedQtyValue(row)
 );

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

 // El vencimiento de SLA ya no bloquea esta accion, solo se muestra como
 // aviso (ver banner de technicalSlaExpired mas abajo).
 const canValidateReactivos =
  gatePhase === "commercial_input" &&
  gateInfo?.documentUploaded === true &&
  canValidateReactivosByRole &&
  !quantitiesLocked &&
  !isSubsectionLocked("reactivos") &&
  hasSyncedReactivos;

 // Boton "Validar reactivos" oculto por falta de sync (no por permisos/fase)
 // -- sin este aviso el paso parece trabado para jefe_comercial/acp_comercial.
 const needsReactivoSyncBeforeValidate =
  gatePhase === "commercial_input" &&
  gateInfo?.documentUploaded === true &&
  canValidateReactivosByRole &&
  !quantitiesLocked &&
  !isSubsectionLocked("reactivos") &&
  !hasSyncedReactivos;


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

const handleValidateSubsection = async (sectionKey, sectionTitle = "seccion") => {
 if (!bcId || saving) return;
 setSaving(true);
 try {
  await api.post(`/business-case/${bcId}/determinations/lock-subsection`, {
   subsection: sectionKey,
  });
  await loadExisting();
  await loadGateInfo();
  onSave({ refresh: true, markComplete: false });
  showToast(
   sectionKey === "reactivos"
    ? "Reactivos validados. Se notifico a Servicio para completar controles, calibradores y materiales."
    : `${sectionTitle} validado y cerrado correctamente.`,
   "success",
  );
 } catch (err) {
  showToast(getNaturalErrorMessage(err, `No se pudo validar ${sectionTitle.toLowerCase()}.`), "error");
 } finally {
  setSaving(false);
 }
};

const handleValidateReactivos = async () => {
 if (!canValidateReactivos) return;
 await handleValidateSubsection("reactivos", "Reactivos");
};

// Bloqueo en un solo paso, solo para jefe_servicio: controles + calibradores
// + materiales. NO cierra la seccion "Determinaciones" -- eso es una accion
// explicita y separada (ver handleCloseDeterminationsSection), nunca un
// efecto secundario automatico de este boton.
const handleCloseAllTechnicalSubsections = async () => {
 if (!bcId || saving) return;
 setSaving(true);
 try {
  await api.post(`/business-case/${bcId}/determinations/lock-all-technical-subsections`);
  await loadExisting();
  await loadGateInfo();
  onSave({ refresh: true, markComplete: false });
  showToast("Controles, calibradores y materiales bloqueados correctamente.", "success");
 } catch (err) {
  showToast(getNaturalErrorMessage(err, "No se pudieron bloquear las subsecciones tecnicas."), "error");
 } finally {
  setSaving(false);
 }
};

// Cierre EXPLICITO de la seccion "Determinaciones" completa, solo para
// jefe_servicio, solo disponible cuando las 4 subsecciones ya estan
// bloqueadas. Reutiliza el endpoint generico /ownership/complete (misma
// logica de applyDeterminationsCompletionTransition que ya usan otras
// secciones), habilitando avanzar a Inversiones.
const handleCloseDeterminationsSection = async () => {
 if (!bcId || saving || !canCloseDeterminationsSection) return;
 setSaving(true);
 try {
  await completeDeterminationsSection(bcId, "jefe_servicio_cierre_determinaciones");
  await loadExisting();
  await loadGateInfo();
  onSave({ refresh: true, markComplete: false });
  showToast("Determinaciones cerradas. Ya puedes continuar con Inversiones.", "success");
 } catch (err) {
  showToast(getNaturalErrorMessage(err, "No se pudo cerrar la seccion de determinaciones."), "error");
 } finally {
  setSaving(false);
 }
};

const handleRequestUnlockSubsection = async (sectionKey) => {
 if (!bcId || saving) return;
 const reason = await promptDialog({
  title: "Solicitar desbloqueo",
  message: `Motivo para solicitar desbloqueo de ${sectionKey}:`,
  required: true,
  confirmText: "Enviar solicitud",
 });
 if (!reason || !reason.trim()) return;
 setSaving(true);
 try {
 await requestUnlockSubsection(bcId, sectionKey, reason.trim());
 await loadGateInfo();
 onSave({ refresh: true, markComplete: false });
 showToast(`Solicitud enviada a jefe_comercial para ${sectionKey}.`, "success");
 } catch (err) {
 showToast(getNaturalErrorMessage(err, `No se pudo solicitar desbloqueo para ${sectionKey}.`), "error");
 } finally {
 setSaving(false);
 }
};

const handleRenewCommercialWindow = async () => {
 if (!bcId || saving) return;
 setSaving(true);
 try {
  await api.post(`/business-case/${bcId}/determinations/renew-commercial-window`);
  await loadGateInfo();
  onSave({ refresh: true, markComplete: false });
  showToast("Ventana comercial renovada por 48 horas.", "success");
 } catch (err) {
  showToast(getNaturalErrorMessage(err, "No se pudo renovar la ventana comercial."), "error");
 } finally {
  setSaving(false);
 }
};

const handleReopenCommercial = async () => {
 if (!bcId || saving) return;
 setSaving(true);
 try {
  await api.post(`/business-case/${bcId}/determinations/reopen-commercial`);
  await loadGateInfo();
  onSave({ refresh: true, markComplete: false });
  showToast("Fase comercial reabierta. El equipo comercial puede volver a editar.", "success");
 } catch (err) {
  showToast(getNaturalErrorMessage(err, "No se pudo reabrir la fase comercial."), "error");
 } finally {
  setSaving(false);
 }
};

const handleResolveUnlockSubsection = async (requestEntry, approve) => {
 if (!bcId || !requestEntry?.id || saving) return;
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
 setSaving(true);
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
 } finally {
 setSaving(false);
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
 label: expired ? "Ventana 48h vencida" : "Ventana 48h tras validacion",
 status: expired ? "blocked" : hasDoc ? "pending" : "pending",
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
 El comercial debe cargar este documento para habilitar determinaciones. La ventana general de 48 horas inicia solo cuando se validan los reactivos y se envia el caso a servicio.
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

{technicalSlaExpired && (
<div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
 Aviso: la ventana SLA de 48 horas de Jefe de Servicio vencio. Esto ya no bloquea la edicion ni la sincronizacion, pero se recomienda solicitar una prorroga a Jefe Comercial para regularizar el flujo.
</div>
)}
{!canEditFinal && (
<div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
 {quantitiesLocked
 ? "Las cantidades quedaron bloqueadas tras cierre tecnico. Solicita reapertura con Jefe Comercial."
 : "No tienes habilitada la edicion de determinaciones para este flujo."}
</div>
)}
{canRenewCommercialWindow && (
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
 <div className="text-xs text-amber-800">
 La ventana de 48 horas para sincronizar y validar reactivos vencio. Renuevala para continuar.
 </div>
 <button
 type="button"
 onClick={handleRenewCommercialWindow}
 disabled={saving}
 className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
 >
 <FiRefreshCw size={14} />
 Renovar ventana 48h
 </button>
</div>
)}
 </div>
 )}
 </div>

 {canCloseAllTechnicalSubsections && (
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
 <div className="text-xs text-emerald-800">
 Cuando controles, calibradores y materiales ya tengan sus cantidades sincronizadas, puedes bloquearlos todos de una vez.
 </div>
 <button
 type="button"
 onClick={handleCloseAllTechnicalSubsections}
 disabled={saving}
 className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
 >
 <FiCheck size={14} />
 Bloquear controles, calibradores y materiales
 </button>
 </div>
 )}

 {canCloseDeterminationsSection && (
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
 <div className="text-xs text-blue-800">
 Reactivos, controles, calibradores y materiales ya estan bloqueados. Cierra Determinaciones para continuar con Inversiones.
 </div>
 <button
 type="button"
 onClick={handleCloseDeterminationsSection}
 disabled={saving}
 className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
 >
 <FiCheck size={14} />
 Cerrar Determinaciones y continuar con Inversiones
 </button>
 </div>
 )}

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
 // Reactivos se validan con DET/AÑO/PROCESO. Las subsecciones técnicas
 // (controles, calibradores y materiales) se validan visualmente con Producto
 // a Enviar, porque es la columna que llena jefe_servicio en el Sheet.
 const hasRows = rows.length > 0;
 const hasSyncedItems = hasRows && rows.some((row) => (
 toPositiveNumber(getSheetQtyDisplayValue(row, section.key)) > 0
 ));
 // Reactivos: cierre individual de acp_comercial/jefe_comercial (es su unica
 // seccion). Controles/calibradores/materiales: el cierre NUNCA es
 // individual por subseccion -- jefe_servicio debe usar el boton combinado
 // "Bloquear controles, calibradores y materiales" mas abajo, que bloquea
 // las 3 juntas. Por eso aqui siempre es false para esas 3.
 const canValidateSection = section.key === "reactivos" ? canValidateReactivos : false;

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
 !hasRows
 ? "bg-gray-100 text-gray-600"
 : hasSyncedItems
 ? "bg-emerald-100 text-emerald-700"
 : "bg-amber-100 text-amber-700"
}`}
 >
 <FiCheck size={11} />
 {!hasRows ? "Sin elementos" : hasSyncedItems ? "Sincronizado" : "Pendiente"}
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
 {/* acp_comercial/jefe_comercial cierran reactivos mirando la
     cantidad negociada (DET/AÑO/PROCESO); jefe_servicio ve las 4
     secciones desde su propia perspectiva de despacho, por eso ve
     Producto a Enviar incluso en reactivos. */}
 {section.key === "reactivos" ? "DET/AÑO/PROCESO (Sheet)" : "PRODUCTO A ENTREGAR (Sheet)"}
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
 {getSheetQtyDisplayValue(row, section.key)}
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

 {/* Footer principal: acciones directas, sin modo "Editar" -- todo viene del
     Sheet, no hay nada que editar/guardar a mano en esta pantalla. */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100">
  <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
   {saving && (
    <>
     <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500" />
     <span className="text-blue-600">Guardando...</span>
    </>
   )}
   {!saving && canReopenCommercial && (
    <span className="text-amber-600 font-semibold">Sección cerrada por el equipo comercial — solo jefe_comercial puede reabrir.</span>
   )}
  </div>

  {needsReactivoSyncBeforeValidate && (
   <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 sm:text-right">
    Aun no hay cantidades de reactivos sincronizadas. Usa "Sincronizar cantidades desde Sheet" en la parte superior para poder validar y enviar a Servicio.
   </div>
  )}

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

   {/* acp_comercial/jefe_comercial: cierra Reactivos (unica seccion de comercial) */}
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

 </div>
 );
};

export default DeterminationsSection;
