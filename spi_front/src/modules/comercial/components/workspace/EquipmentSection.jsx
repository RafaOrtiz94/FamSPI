import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
 FiAlertCircle,
 FiCheckCircle,
 FiChevronDown,
 FiCpu,
 FiPlus,
 FiTrash2,
 FiX
} from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useParams } from "react-router-dom";
import SectionEditorBadge from "./SectionEditorBadge";

// Mismos roles que ya autoriza el backend en POST /sections/:section/unlock.
const EQUIPMENT_REOPEN_ROLES = new Set(["acp_comercial", "backoffice", "backoffice_comercial", "jefe_comercial", "jefe_de_comercial"]);

const generateLocalId = () => {
 if (typeof crypto !== "undefined" && crypto.randomUUID) {
 return crypto.randomUUID();
 }
 return `eq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const DEFAULT_EQUIPMENT_PAIR = () => ({
 id: generateLocalId(),
 primary: null,
 primary_type: "new_available",
 backup: null,
 backup_type: "new_available",
 requiresBackup: false,
 installation_location: "",
 requiresComplementary: false,
 complementary_test_purpose: "",
});

const EQUIPMENT_TYPE_OPTIONS = [
 { value: "new_available", label: "Nuevo" },
 { value: "cu", label: "CU" },
 { value: "installed_client", label: "Instalado en cliente" },
];

const ACTION_CLASS_BY_COLOR = {
 blue: "bg-blue-600 hover:bg-blue-700",
 slate: "bg-slate-700 hover:bg-slate-800",
};
const UI = {
 card: "rounded-2xl border border-slate-200/80 bg-white shadow-sm",
 cardSelected: "rounded-2xl border border-blue-300 bg-blue-50/40 ring-1 ring-blue-200 shadow-sm",
 input: "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all bg-white disabled:bg-slate-100 disabled:text-slate-500",
 title: "text-lg sm:text-xl font-semibold text-slate-900 tracking-tight",
 subtitle: "text-sm text-slate-600",
 actionPrimary: "inline-flex items-center justify-center bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed",
 actionSecondary: "inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed",
 chip: "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
};
const INPUT_CLASS = UI.input;
const SAVE_BUTTON_CLASS = UI.actionPrimary;
const INITIAL_VISIBLE_COUNT = 10;
const LOAD_MORE_STEP = 10;
const TOAST_MESSAGES = {
 catalog_load_error: "No se pudo cargar el catalogo de equipos.",
 primary_selected: "Equipo principal seleccionado correctamente.",
 backup_selected: "Equipo backup seleccionado correctamente.",
 save_success: "Equipamiento guardado exitosamente.",
 save_error: "No se pudo guardar el equipamiento.",
 no_permissions: "No tienes permisos para editar esta seccion.",
 invalid_data: "Revisa los datos ingresados antes de guardar.",
};

const normalizeEquipmentType = (value) => {
 const normalized = String(value || "").trim().toLowerCase();
 if (["new_available", "new_import", "nuevo", "new"].includes(normalized)) return "new_available";
 if (normalized === "cu") return "cu";
 if (["installed_client", "instalado_cliente", "installed", "instalado_en_cliente"].includes(normalized)) {
 return "installed_client";
 }
 return "new_available";
};

const getOpenPairsStorageKey = (businessCaseId) => `bc_equipment_open_pairs_${businessCaseId || "default"}`;

const toNullableNumber = (value) => {
 if (value === null || value === undefined || value === "") return null;
 const parsed = Number(value);
 return Number.isFinite(parsed) ? parsed : null;
};

const firstText = (...values) => {
 for (const value of values) {
 if (typeof value === "string" && value.trim().length > 0) {
 return value.trim();
 }
 }
 return "";
};

const resolveEquipmentCapacity = (raw = {}) => {
 const perHour = toNullableNumber(raw.capacity_per_hour ?? raw.capacityPerHour ?? raw.capacity);
 const perDay = toNullableNumber(raw.max_daily_capacity ?? raw.maxDailyCapacity);

 if (perHour !== null) return perHour;
 if (perDay !== null) return perDay;

 const specs = raw.technical_specs || raw.technicalSpecs || {};
 const specsCapacity = toNullableNumber(specs.capacity ?? specs.capacidad ?? specs.capacity_per_hour);
 return specsCapacity;
};

const resolveEquipmentPrice = (raw = {}) => {
 const basePrice = toNullableNumber(raw.base_price ?? raw.basePrice ?? raw.price);
 if (basePrice !== null) return basePrice;

 const leasePrice = toNullableNumber(raw.lease_price ?? raw.leasePrice);
 if (leasePrice !== null) return leasePrice;

 const metadata = raw.metadata || {};
 return toNullableNumber(metadata.base_price ?? metadata.price);
};

const resolveEquipmentDescription = (raw = {}) => {
 const technicalSpecs = raw.technical_specs || raw.technicalSpecs || {};
 const metadata = raw.metadata || {};

 return firstText(
 raw.description,
 raw.equipment_description,
 technicalSpecs.description,
 technicalSpecs.descripcion,
 metadata.description,
 metadata.descripcion,
 );
};

const normalizeCatalogItem = (item = {}) => {
 const id = item.id ?? item.equipment_id ?? item.equipmentId ?? item.code;
 const name = firstText(item.name, item.equipment_name, item.nombre) || "Equipo";
 const code = firstText(item.code, item.equipment_code, item.codigo);
 const description = resolveEquipmentDescription(item);
 const categories = Array.isArray(item.categories)
 ? item.categories
 : [item.category || item.categoria || item.category_type].filter(Boolean);
 const manufacturer = firstText(item.manufacturer, item.fabricante);
 const model = firstText(item.model, item.modelo);
 const totalDeterminations = toNullableNumber(item.total_determinations);
 const totalConsumables = toNullableNumber(item.total_consumables);

 return {
 id,
 name,
 code,
 manufacturer,
 model,
 capacity: resolveEquipmentCapacity(item),
 price: resolveEquipmentPrice(item),
 description,
 categories,
 totalDeterminations,
 totalConsumables,
 raw: item,
 };
};

const EquipmentCard = ({ item, selected, disabled, onSelect, actionLabel, actionColor = "blue" }) => {
 const actionColorClass = ACTION_CLASS_BY_COLOR[actionColor] || ACTION_CLASS_BY_COLOR.blue;
 const hasCapacity = item.capacity !== null && item.capacity !== undefined;
 const hasPrice = item.price !== null && item.price !== undefined;

 return (
 <div
 className={`p-3 text-left space-y-2 transition ${disabled ? "opacity-60 pointer-events-none" : ""} ${selected ? UI.cardSelected : `${UI.card} hover:border-slate-300`}`}
 >
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-start gap-2">
 <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
 <FiCpu />
 </div>
 <div>
 <p className="text-sm font-semibold text-gray-900">{item.name}</p>
 <p className="text-xs text-slate-600">{item.code || "Sin codigo"}</p>
 {(item.manufacturer || item.model) && (
 <p className="text-[11px] text-slate-600">
 {[item.manufacturer, item.model].filter(Boolean).join(" - ")}
 </p>
 )}
 </div>
 </div>
 <div className="text-right text-[11px] text-slate-600">
 {hasCapacity ? <p>Cap: {item.capacity}</p> : null}
 {hasPrice ? <p>${item.price}</p> : null}
 </div>
 </div>
 {onSelect && (
 <button
 type="button"
 onClick={() => onSelect(item)}
 className={`w-full rounded-lg px-3 py-2 text-xs font-semibold text-white transition ${actionColorClass}`}
 disabled={disabled}
 >
 {actionLabel}
 </button>
 )}
 </div>
 );
};

const AccordionSection = ({ title, description, isOpen, onToggle, statusBadge, children }) => (
 <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm mb-4">
 <button
 type="button"
 onClick={onToggle}
 className="flex w-full items-center justify-between gap-2 px-4 sm:px-5 py-4 text-left text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus:outline-none"
 >
 <div>
 <p className="font-semibold">{title}</p>
 {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
 </div>
 <div className="flex items-center gap-3">
 {statusBadge}
 <FiChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
 </div>
 </button>
 <div className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}>
 <div className="px-4 sm:px-5 pb-5 pt-1">{children}</div>
 </div>
 </div>
);

const SwitchField = ({ label, checked, onChange, disabled = false }) => (
 <div className="flex items-center justify-between gap-3">
 <span className="text-sm font-semibold text-slate-700">{label}</span>
 <button
 type="button"
 role="switch"
 aria-checked={checked}
 disabled={disabled}
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
 onClick={() => onChange(!checked)}
 >
 <span
 className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-1"}`}
 />
 </button>
 </div>
);

const EquipmentSection = ({
 businessCase,
 permissions = {},
 ownership = {},
 onSave = () => {}
}) => {
 const { id: bcId } = useParams();
 const { showToast, showLoader, hideLoader } = useUI();
 const canEdit = permissions.canEdit !== false && ownership?.canUserEdit !== false;
 // Reabrir "equipment" tras el auto-bloqueo al guardar comercial (ver
 // saveEquipmentDetailsV2 en businessCase.controller.js). Mismos roles que
 // ya autoriza el backend en POST /sections/:section/unlock.
 const canReopenEquipment = ownership?.isLocked === true && EQUIPMENT_REOPEN_ROLES.has(permissions?.userRole || "");
 const [reopening, setReopening] = useState(false);
 const handleReopenEquipment = async () => {
  if (!bcId || reopening) return;
  setReopening(true);
  try {
   await api.post(`/business-case/${bcId}/sections/equipment/unlock`);
   onSave();
   showToast("Sección reabierta para edición.", "success");
  } catch (err) {
   showToast(err?.response?.data?.message || "No se pudo reabrir la sección.", "error");
  } finally {
   setReopening(false);
  }
 };

 const [items, setItems] = useState([]);
 const [loadingCatalog, setLoadingCatalog] = useState(false);
 const [dirty, setDirty] = useState(false);
 const [groupSearchByPair, setGroupSearchByPair] = useState({});
 const [debouncedGroupSearchByPair, setDebouncedGroupSearchByPair] = useState({});
 const [openPairs, setOpenPairs] = useState({});
 const [compatibilityByPair, setCompatibilityByPair] = useState({});
 const [compatibilityLoadingByPair, setCompatibilityLoadingByPair] = useState({});
 const [visibleRowsByPair, setVisibleRowsByPair] = useState({});
 const [pendingDeletePairId, setPendingDeletePairId] = useState(null);

 const hydratedRef = useRef(false);
 const pairRefs = useRef({});

 const sectionData = useMemo(() => {
 const equipmentDetails =
 businessCase?.equipment_details ||
 businessCase?.extra?.equipment_details ||
 null;

 if (!equipmentDetails) {
 return { equipmentPairs: [DEFAULT_EQUIPMENT_PAIR()] };
 }

 const mapped = equipmentDetails.map((detail, index) => ({
 id: detail.id || generateLocalId() || String(index + 1),
 primary_type: normalizeEquipmentType(detail.primary_type || detail.primary?.type),
 requiresBackup: detail.requires_backup ?? detail.requiresBackup ?? Boolean(detail.backup),
 installation_location: detail.installation_location || "",
 requiresComplementary: Boolean(detail.requires_complementary),
 complementary_test_purpose: detail.complementary_test_purpose || "",
 primary: detail.primary
 ? {
 id: detail.primary.id,
 name: detail.primary.name,
 code: detail.primary.code,
 capacity: detail.primary.capacity,
 price: detail.primary.price,
 description: detail.primary.description,
 categories: detail.primary.categories || [],
 }
 : detail.primary_id
 ? { id: detail.primary_id }
 : null,
 backup_type: normalizeEquipmentType(detail.backup_type || detail.backup?.type),
 backup: detail.backup
 ? {
 id: detail.backup.id,
 name: detail.backup.name,
 code: detail.backup.code,
 capacity: detail.backup.capacity,
 price: detail.backup.price,
 description: detail.backup.description,
 categories: detail.backup.categories || [],
 condition: detail.backup.condition || "Nuevo",
 install_with_primary: detail.backup.install_with_primary || false,
 }
 : detail.backup_id
 ? { id: detail.backup_id }
 : null,
 }));

 return { equipmentPairs: mapped.length ? mapped : [DEFAULT_EQUIPMENT_PAIR()] };
 }, [businessCase]);

 const [equipmentPairs, setEquipmentPairs] = useState(() => sectionData.equipmentPairs);

 useEffect(() => {
 if (!sectionData.equipmentPairs || hydratedRef.current) return;
 setEquipmentPairs(sectionData.equipmentPairs);
 const nextOpenState = {};
 const nextVisibleRows = {};
 const storageKey = getOpenPairsStorageKey(bcId);
 let persistedOpenPairs = null;
 try {
 const raw = sessionStorage.getItem(storageKey);
 persistedOpenPairs = raw ? JSON.parse(raw) : null;
 } catch (_error) {
 persistedOpenPairs = null;
 }
 sectionData.equipmentPairs.forEach((pair, idx) => {
 nextOpenState[pair.id] = typeof persistedOpenPairs?.[pair.id] === "boolean"
 ? persistedOpenPairs[pair.id]
 : idx === 0;
 nextVisibleRows[pair.id] = {
 primary: INITIAL_VISIBLE_COUNT,
 backup: INITIAL_VISIBLE_COUNT,
 };
 });
 setOpenPairs(nextOpenState);
 setVisibleRowsByPair(nextVisibleRows);
 hydratedRef.current = true;
 }, [sectionData.equipmentPairs, bcId]);

 useEffect(() => {
 if (!hydratedRef.current) return;
 const timeoutId = setTimeout(() => {
 setDebouncedGroupSearchByPair(groupSearchByPair);
 }, 250);
 return () => clearTimeout(timeoutId);
 }, [groupSearchByPair]);

 useEffect(() => {
 if (!hydratedRef.current) return;
 try {
 sessionStorage.setItem(getOpenPairsStorageKey(bcId), JSON.stringify(openPairs));
 } catch (_error) {}
 }, [openPairs, bcId]);

 const togglePair = (pairId) => {
 setOpenPairs((prev) => ({ ...prev, [pairId]: !prev[pairId] }));
 };

 const markDirty = () => setDirty(true);
 const notify = useCallback((type, key, overrideMessage = "") => {
 showToast(overrideMessage || TOAST_MESSAGES[key], type);
 }, [showToast]);

 const increaseVisibleRows = (pairId, section = "primary") => {
 setVisibleRowsByPair((prev) => ({
 ...prev,
 [pairId]: {
 primary: prev[pairId]?.primary || INITIAL_VISIBLE_COUNT,
 backup: prev[pairId]?.backup || INITIAL_VISIBLE_COUNT,
 [section]: (prev[pairId]?.[section] || INITIAL_VISIBLE_COUNT) + LOAD_MORE_STEP,
 },
 }));
 };

 const updatePair = (pairId, updates) => {
 setEquipmentPairs((prev) => prev.map((pair) => (pair.id === pairId ? { ...pair, ...updates } : pair)));
 markDirty();
 };

 const loadEquipment = useCallback(async () => {
 setLoadingCatalog(true);
 try {
 const res = await api.get("/equipment-catalog");
 const payload = res.data?.data ?? res.data;
 const parsedItems = Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload) ? payload : []);

 const normalized = parsedItems.map(normalizeCatalogItem).filter((item) => item.id);

 setItems(normalized);
 } catch (error) {
 showToast(TOAST_MESSAGES.catalog_load_error, "error");
 } finally {
 setLoadingCatalog(false);
 }
 }, [showToast]);

 useEffect(() => {
 loadEquipment();
 }, [loadEquipment]);

 useEffect(() => {
 if (!items.length) return;
 setEquipmentPairs((prev) => {
 let changed = false;
 const next = prev.map((pair) => {
 let primary = pair.primary;
 let backup = pair.backup;

 const primaryNeedsEnrichment = primary && (!primary.name || primary.capacity === null || primary.capacity === undefined || primary.price === null || primary.price === undefined || !primary.description);
 if (primaryNeedsEnrichment) {
 const found = items.find((item) => String(item.id) === String(primary.id));
 if (found) {
 primary = { ...found, ...primary, type: normalizeEquipmentType(pair.primary_type) };
 changed = true;
 }
 }

 const backupNeedsEnrichment = backup && (!backup.name || backup.capacity === null || backup.capacity === undefined || backup.price === null || backup.price === undefined || !backup.description);
 if (backupNeedsEnrichment) {
 const found = items.find((item) => String(item.id) === String(backup.id));
 if (found) {
 backup = {
 ...found,
 ...backup,
 type: normalizeEquipmentType(pair.backup_type),
 condition: backup.condition || "Nuevo",
 install_with_primary: backup.install_with_primary || false,
 };
 changed = true;
 }
 }

 return primary !== pair.primary || backup !== pair.backup ? { ...pair, primary, backup } : pair;
 });

 return changed ? next : prev;
 });
 }, [items]);

 useEffect(() => {
 const controller = new AbortController();

 const loadCompatibility = async (pair) => {
 if (!pair?.primary?.id || !pair.requiresBackup) return;
 const pairId = pair.id;
 setCompatibilityLoadingByPair((prev) => ({ ...prev, [pairId]: true }));
 try {
 const res = await api.get(
 `/business-case/equipment/${pair.primary.id}/compatibility/backups`,
 { signal: controller.signal },
 );
 const candidates = Array.isArray(res?.data?.data) ? res.data.data : [];
 const normalized = candidates.map((item) => {
 const base = normalizeCatalogItem({
 ...item,
 categories: item.categories || [item.category_type].filter(Boolean),
 price: item.base_price ?? item.price,
 capacity: item.capacity_per_hour ?? item.capacity,
 });
 return {
 ...base,
 compatibilityScore: item?.compatibility_metadata?.final_score ?? null,
 matchType: item?.compatibility_metadata?.match_type || item?.match_type || null,
 };
 });
 setCompatibilityByPair((prev) => ({ ...prev, [pairId]: normalized }));
 } catch (_error) {
 setCompatibilityByPair((prev) => ({ ...prev, [pairId]: [] }));
 } finally {
 setCompatibilityLoadingByPair((prev) => ({ ...prev, [pairId]: false }));
 }
 };

 equipmentPairs.forEach((pair) => {
 if (pair?.primary?.id && pair.requiresBackup && compatibilityByPair[pair.id] === undefined) {
 loadCompatibility(pair);
 }
 });

 return () => controller.abort();
 }, [equipmentPairs, compatibilityByPair]);

 const addPair = () => {
 const newPair = DEFAULT_EQUIPMENT_PAIR();
 setEquipmentPairs((prev) => [...prev, newPair]);
 setOpenPairs((prev) => ({ ...prev, [newPair.id]: true }));
 setGroupSearchByPair((prev) => ({ ...prev, [newPair.id]: "" }));
 setVisibleRowsByPair((prev) => ({
 ...prev,
 [newPair.id]: { primary: INITIAL_VISIBLE_COUNT, backup: INITIAL_VISIBLE_COUNT },
 }));
 markDirty();
 };

 const removePair = (pairId, forceDelete = false) => {
 if (equipmentPairs.length <= 1) {
 notify("warning", "invalid_data", "Debe haber al menos un grupo de equipos.");
 return;
 }
 const pair = equipmentPairs.find((entry) => entry.id === pairId);
 const hasData = Boolean(pair?.primary || pair?.backup || pair?.requiresBackup);
 if (!forceDelete && hasData) {
 setPendingDeletePairId(pairId);
 return;
 }
 setEquipmentPairs((prev) => prev.filter((pair) => pair.id !== pairId));
 setOpenPairs((prev) => {
 const next = { ...prev };
 delete next[pairId];
 return next;
 });
 setVisibleRowsByPair((prev) => {
 const next = { ...prev };
 delete next[pairId];
 return next;
 });
 setGroupSearchByPair((prev) => {
 const next = { ...prev };
 delete next[pairId];
 return next;
 });
 setDebouncedGroupSearchByPair((prev) => {
 const next = { ...prev };
 delete next[pairId];
 return next;
 });
 delete pairRefs.current[pairId];
 markDirty();
 };

 const selectPrimary = (pairId, item) => {
 const pair = equipmentPairs.find((entry) => entry.id === pairId);
 const nextType = normalizeEquipmentType(pair?.primary_type);
 updatePair(pairId, {
 primary: { ...item, type: nextType },
 primary_type: nextType,
 backup: null,
 backup_type: "new_available",
 requiresBackup: false,
 });
 setCompatibilityByPair((prev) => {
 const next = { ...prev };
 delete next[pairId];
 return next;
 });
 notify("success", "primary_selected");
 };

 const selectBackup = (pairId, item) => {
 const pair = equipmentPairs.find((entry) => entry.id === pairId);
 const nextType = normalizeEquipmentType(pair?.backup_type);
 updatePair(pairId, {
 requiresBackup: true,
 backup: {
 ...item,
 type: nextType,
 condition: "Nuevo",
 install_with_primary: false,
 },
 backup_type: nextType,
 });
 notify("success", "backup_selected");
 };

 const sortedEquipmentItems = useMemo(() => {
 return [...items].sort((a, b) => {
 const byName = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
 if (byName !== 0) return byName;
 return String(a.id).localeCompare(String(b.id));
 });
 }, [items]);

 const getBackupCandidates = (pair) => {
 if (!pair?.primary) return [];

 const compatibilityCandidates = compatibilityByPair[pair.id] || [];
 if (compatibilityCandidates.length) {
 return compatibilityCandidates.filter((candidate) => String(candidate.id) !== String(pair.primary.id));
 }

 const primaryModel = String(pair.primary?.model || "").trim().toLowerCase();
 const primaryCategories = Array.isArray(pair.primary?.categories) ? pair.primary.categories : [];

 const ranked = sortedEquipmentItems
 .filter((item) => String(item.id) !== String(pair.primary.id))
 .map((item) => {
 const itemModel = String(item?.model || "").trim().toLowerCase();
 const sameModel = Boolean(primaryModel && itemModel && primaryModel === itemModel);
 const sameCategory = Boolean(
 primaryCategories.length &&
 Array.isArray(item?.categories) &&
 item.categories.some((category) => primaryCategories.includes(category))
 );

 // Rank fallback compatibility: same model first, then same category, then the rest.
 let rank = 3;
 if (sameModel) rank = 1;
 else if (sameCategory) rank = 2;

 return { ...item, _fallbackRank: rank };
 })
 .filter((item) => item._fallbackRank <= 2)
 .sort((a, b) => a._fallbackRank - b._fallbackRank);

 return ranked;
 };

 const validationIssues = useMemo(() => {
 const issues = [];

 equipmentPairs.forEach((pair, index) => {
 const label = `Grupo ${index + 1}`;
 if (!pair.primary?.id) {
 issues.push({ pairId: pair.id, message: `${label}: falta equipo principal.` });
 }
 if (pair.requiresBackup && !pair.backup?.id) {
 issues.push({ pairId: pair.id, message: `${label}: requiere backup pero no tiene equipo de respaldo.` });
 }
 if (pair.requiresBackup && pair.backup?.id && String(pair.primary?.id) === String(pair.backup?.id)) {
 issues.push({ pairId: pair.id, message: `${label}: principal y backup no pueden ser el mismo equipo.` });
 }
 if (pair.requiresBackup && !pair.backup_type) {
 issues.push({ pairId: pair.id, message: `${label}: falta estado del backup.` });
 }
 });

 return issues;
 }, [equipmentPairs]);

 const pairsValidation = useMemo(() => validationIssues.map((issue) => issue.message), [validationIssues]);

 const summary = useMemo(() => {
 const total = equipmentPairs.length;
 const withPrimary = equipmentPairs.filter((pair) => Boolean(pair.primary?.id)).length;
 const withBackup = equipmentPairs.filter((pair) => Boolean(pair.requiresBackup && pair.backup?.id)).length;
 const backupRequired = equipmentPairs.filter((pair) => Boolean(pair.requiresBackup)).length;

 return {
 total,
 withPrimary,
 withBackup,
 backupRequired,
 };
 }, [equipmentPairs]);

 const confirmDeletePair = () => {
 if (!pendingDeletePairId) return;
 removePair(pendingDeletePairId, true);
 setPendingDeletePairId(null);
 };

 const cancelDeletePair = () => {
 setPendingDeletePairId(null);
 };

 const handleSave = useCallback(async () => {
 if (!canEdit) {
 notify("warning", "no_permissions");
 return;
 }

 if (pairsValidation.length) {
 notify("warning", "invalid_data", pairsValidation[0]);
 const firstIssue = validationIssues[0];
 if (firstIssue?.pairId) {
 setOpenPairs((prev) => ({ ...prev, [firstIssue.pairId]: true }));
 const node = pairRefs.current[firstIssue.pairId];
 if (node && typeof node.scrollIntoView === "function") {
 node.scrollIntoView({ behavior: "smooth", block: "center" });
 }
 }
 return;
 }

 if (!bcId) {
 notify("error", "save_error", "ID del caso de negocio no disponible.");
 return;
 }

 try {
 showLoader();

 const payload = {
 equipment_pairs: equipmentPairs.map((pair) => ({
 primary_id: Number(pair.primary.id),
 primary_type: normalizeEquipmentType(pair.primary_type),
 backup_type: pair.requiresBackup ? normalizeEquipmentType(pair.backup_type || pair.backup?.type) : null,
 requires_backup: Boolean(pair.requiresBackup),
 backup_id: pair.requiresBackup ? Number(pair.backup?.id || null) : null,
 backup_install_simultaneous: pair.requiresBackup && pair.backup ? Boolean(pair.backup.install_with_primary) : false,
 installation_location: pair.installation_location || null,
 requires_complementary: Boolean(pair.requiresComplementary),
 complementary_test_purpose: pair.requiresComplementary ? (pair.complementary_test_purpose || null) : null,
 })),
 };

 await api.post(`/business-case/${bcId}/equipment-details-v2`, payload);

 notify("success", "save_success");
 setDirty(false);
 onSave();
 } catch (error) {
 notify("error", "save_error", error?.response?.data?.message || TOAST_MESSAGES.save_error);
 } finally {
 hideLoader();
 }
 }, [
 canEdit,
 pairsValidation,
 validationIssues,
 bcId,
 showLoader,
 hideLoader,
 equipmentPairs,
 onSave,
 notify
 ]);

 const jumpToFirstIssue = () => {
 const firstIssue = validationIssues[0];
 if (!firstIssue?.pairId) return;
 setOpenPairs((prev) => ({ ...prev, [firstIssue.pairId]: true }));
 const node = pairRefs.current[firstIssue.pairId];
 if (node && typeof node.scrollIntoView === "function") {
 node.scrollIntoView({ behavior: "smooth", block: "center" });
 }
 };

 return (
 <div className="space-y-5 sm:space-y-6">
 {/* Visual header: contexto + accion principal */}
 <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 sm:p-5 shadow-sm">
 <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
 <div>
 <h2 className={UI.title}>Seleccion de equipos</h2>
 <p className={UI.subtitle}>Define principal y backup por grupo.</p>
 <div className="mt-2">
 <SectionEditorBadge ownership={ownership} />
 </div>
 </div>
 <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
 <button
 onClick={addPair}
 disabled={!canEdit}
 className={`${UI.actionPrimary} gap-2 w-full sm:w-auto`}
 >
 <FiPlus /> Agregar grupo
 </button>
 </div>
 </div>
 </div>
 </div>

 <div className={`${UI.card} px-3 sm:px-4 py-3 text-xs text-slate-700 flex flex-wrap gap-2 items-center`}>
 <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-1">Total grupos: <strong>{summary.total}</strong></span>
 <span className="rounded-full bg-blue-50 text-blue-700 px-2.5 py-1">Con principal: <strong>{summary.withPrimary}</strong></span>
 <span className="rounded-full bg-amber-50 text-amber-700 px-2.5 py-1">Backup requerido: <strong>{summary.backupRequired}</strong></span>
 <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1">Backup completo: <strong>{summary.withBackup}</strong></span>
 {dirty && <span className="inline-flex items-center gap-1 text-amber-700"><FiAlertCircle /> Cambios sin guardar</span>}
 {loadingCatalog && <span className="text-blue-700">Cargando catalogo...</span>}
 </div>

 {!canEdit && (
 <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <span>
 {ownership?.isLocked
  ? "Comercial ya guardó esta sección y quedó en solo lectura."
  : "Esta seccion esta en modo solo lectura para tu rol."}
 </span>
 {canReopenEquipment && (
 <button
  type="button"
  onClick={handleReopenEquipment}
  disabled={reopening}
  className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 w-full sm:w-auto"
 >
  Reabrir para edición
 </button>
 )}
 </div>
 )}

 {pairsValidation.length > 0 && (
 <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 space-y-1 shadow-sm">
 <div>{pairsValidation[0]}</div>
 {pairsValidation.length > 1 && <div>y {pairsValidation.length - 1} validaciones mas...</div>}
 <div className="pt-2">
 <button type="button" onClick={jumpToFirstIssue} className="text-xs font-semibold text-rose-700 underline underline-offset-2">
 Ir al primer error
 </button>
 </div>
 </div>
 )}

 <div className="space-y-4">
 {equipmentPairs.map((pair, index) => {
 const groupSearch = String(debouncedGroupSearchByPair[pair.id] || "").toLowerCase();
 const compatibleCandidates = getBackupCandidates(pair);
 const visiblePrimaryRows = visibleRowsByPair[pair.id]?.primary || INITIAL_VISIBLE_COUNT;
 const visibleBackupRows = visibleRowsByPair[pair.id]?.backup || INITIAL_VISIBLE_COUNT;
 const filteredPrimaryItems = sortedEquipmentItems.filter((item) =>
 item.name.toLowerCase().includes(groupSearch) ||
 String(item.code || "").toLowerCase().includes(groupSearch),
 );
 const visiblePrimaryItems = filteredPrimaryItems.slice(0, visiblePrimaryRows);
 const visibleBackupCandidates = compatibleCandidates.slice(0, visibleBackupRows);
 const hasMorePrimary = filteredPrimaryItems.length > visiblePrimaryItems.length;
 const hasMoreBackup = compatibleCandidates.length > visibleBackupCandidates.length;

 return (
 <div key={pair.id} ref={(node) => { pairRefs.current[pair.id] = node; }}>
 <AccordionSection
 title={`Grupo de equipos #${index + 1}`}
 description={pair.primary ? `${pair.primary.name}${pair.requiresBackup ? " + backup" : ""}` : "Seleccione equipos"}
 isOpen={Boolean(openPairs[pair.id])}
 onToggle={() => togglePair(pair.id)}
 statusBadge={
 <div className="flex items-center gap-2 flex-wrap justify-end">
 {pair.primary_type && pair.primary && (
 <span className={`${UI.chip} bg-blue-50 text-blue-700`}>
 P: {EQUIPMENT_TYPE_OPTIONS.find((option) => option.value === normalizeEquipmentType(pair.primary_type))?.label || "Nuevo"}
 </span>
 )}
 {pair.requiresBackup && pair.backup && (
 <span className={`${UI.chip} bg-slate-100 text-slate-700`}>
 B: {EQUIPMENT_TYPE_OPTIONS.find((option) => option.value === normalizeEquipmentType(pair.backup_type))?.label || "Nuevo"}
 </span>
 )}
 {pair.primary
 ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold"><FiCheckCircle size={12} /> Listo</span>
 : <span className="text-amber-600 text-xs">Pendiente</span>}
 </div>
 }
 >
 <div className="space-y-5">
 {/* Bloque visual principal */}
 <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
 <div className="flex items-center justify-between gap-2">
 <h4 className="text-sm font-semibold text-slate-800">Equipo principal</h4>
 <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">Obligatorio</span>
 </div>

 <div className="relative">
 <input
 placeholder="Buscar equipo en este grupo..."
 className={`${INPUT_CLASS} pr-10`}
 value={groupSearchByPair[pair.id] || ""}
 onChange={(event) => setGroupSearchByPair((prev) => ({ ...prev, [pair.id]: event.target.value }))}
 disabled={!canEdit}
 />
 {!!groupSearchByPair[pair.id] && (
 <button
 type="button"
 onClick={() => setGroupSearchByPair((prev) => ({ ...prev, [pair.id]: "" }))}
 className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
 aria-label="Limpiar busqueda"
 >
 <FiX />
 </button>
 )}
 </div>

 {!pair.primary ? (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
 {loadingCatalog && Array.from({ length: 4 }).map((_, skeletonIndex) => (
 <div key={`primary-skeleton-${pair.id}-${skeletonIndex}`} className="border rounded-xl p-4 animate-pulse space-y-2">
 <div className="h-4 bg-gray-200 rounded w-2/3" />
 <div className="h-3 bg-gray-100 rounded w-1/2" />
 <div className="h-3 bg-gray-100 rounded w-full" />
 </div>
 ))}
 {!loadingCatalog && visiblePrimaryItems.map((item) => (
 <EquipmentCard
 key={item.id}
 item={item}
 actionLabel="Seleccionar principal"
 onSelect={(selected) => selectPrimary(pair.id, selected)}
 disabled={!canEdit}
 />
 ))}
 {!loadingCatalog && !filteredPrimaryItems.length && (
 <div className="text-sm text-gray-500 italic">No hay equipos con ese filtro.</div>
 )}
 </div>
 ) : (
 <div className="relative space-y-2 border border-blue-100 bg-white rounded-xl p-2 sm:p-3">
 <EquipmentCard item={pair.primary} selected />

 <div className="w-full sm:max-w-sm">
 <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
 Estado del equipo principal
 </label>
 <select
 value={normalizeEquipmentType(pair.primary_type)}
 onChange={(event) =>
 updatePair(pair.id, {
 primary_type: normalizeEquipmentType(event.target.value),
 primary: pair.primary
 ? { ...pair.primary, type: normalizeEquipmentType(event.target.value) }
 : pair.primary,
 })
 }
 disabled={!canEdit}
 className={INPUT_CLASS}
 >
 {EQUIPMENT_TYPE_OPTIONS.map((option) => (
 <option key={option.value} value={option.value}>{option.label}</option>
 ))}
 </select>
 </div>

 <div className="w-full sm:max-w-sm">
 <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
 Ubicacion de instalacion
 </label>
 <input
 type="text"
 placeholder="Ej: Laboratorio central, piso 2"
 value={pair.installation_location || ""}
 onChange={(event) => updatePair(pair.id, { installation_location: event.target.value })}
 disabled={!canEdit}
 className={INPUT_CLASS}
 />
 </div>

 <button
 type="button"
 aria-label="Cambiar equipo principal"
 onClick={() =>
 updatePair(pair.id, {
 primary: null,
 backup: null,
 primary_type: "new_available",
 backup_type: "new_available",
 requiresBackup: false,
 })
 }
 disabled={!canEdit}
 className="absolute top-2 right-2 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <FiTrash2 />
 </button>
 </div>
 )}
 </div>

 {pair.primary && (
 <>
 <div className="space-y-3 border-t border-slate-200 pt-4 rounded-xl">
 <div className="flex justify-between items-center">
 <div>
 <h4 className="text-sm font-semibold text-slate-800">Equipo de respaldo (backup)</h4>
 <p className="text-[11px] text-slate-500">Se habilita solo cuando el cliente lo requiere.</p>
 </div>
 {pair.backup && pair.requiresBackup && (
 <button
 type="button"
 aria-label="Eliminar backup"
 onClick={() => updatePair(pair.id, { backup: null, backup_type: "new_available", requiresBackup: false })}
 disabled={!canEdit}
 className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Eliminar backup
 </button>
 )}
 </div>

 <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
 <div>
 <p className="text-sm font-semibold text-slate-900">Backup opcional</p>
 <p className="text-xs text-slate-600">Activalo solo si el cliente lo solicita.</p>
 </div>
 <SwitchField
 label="Requiere backup"
 checked={Boolean(pair.requiresBackup)}
 onChange={(nextValue) =>
 updatePair(pair.id, {
 requiresBackup: nextValue,
 backup: nextValue ? pair.backup : null,
 backup_type: nextValue ? normalizeEquipmentType(pair.backup_type) : "new_available",
 })
 }
 disabled={!canEdit}
 />
 </div>

 {pair.requiresBackup && (
 <>
 {compatibilityLoadingByPair[pair.id] && (
 <p className="text-xs text-blue-600">Buscando candidatos compatibles...</p>
 )}

 {!pair.backup ? (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
 {compatibilityLoadingByPair[pair.id] && Array.from({ length: 2 }).map((_, skeletonIndex) => (
 <div key={`backup-skeleton-${pair.id}-${skeletonIndex}`} className="border rounded-xl p-4 animate-pulse space-y-2">
 <div className="h-4 bg-gray-200 rounded w-2/3" />
 <div className="h-3 bg-gray-100 rounded w-1/2" />
 </div>
 ))}
 {!compatibilityLoadingByPair[pair.id] && visibleBackupCandidates.map((item) => (
 <EquipmentCard
 key={`${pair.id}-${item.id}`}
 item={item}
 actionLabel="Seleccionar backup"
 actionColor="slate"
 onSelect={(selected) => selectBackup(pair.id, selected)}
 disabled={!canEdit}
 />
 ))}
 {!compatibilityLoadingByPair[pair.id] && !compatibleCandidates.length && (
 <p className="text-sm text-gray-500 italic">No se encontraron equipos compatibles.</p>
 )}
 </div>
 ) : (
 <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
 <h5 className="font-semibold text-sm text-slate-900">{pair.backup.name}</h5>
 <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-700 space-y-1">
 <p>Principal: {pair.primary?.name || "-"}</p>
 <p>Backup: {pair.backup?.name || "-"}</p>
 {(() => {
 const match = (compatibilityByPair[pair.id] || []).find((candidate) => String(candidate.id) === String(pair.backup?.id));
 if (!match) return null;
 return (
 <>
 <p>Score: {match?.compatibilityScore ? Number(match.compatibilityScore).toFixed(2) : "N/A"}</p>
 <p>Tipo: {match?.matchType || "fallback"}</p>
 </>
 );
 })()}
 </div>

 <div className="w-full sm:max-w-sm">
 <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
 Estado del equipo backup
 </label>
 <select
 value={normalizeEquipmentType(pair.backup_type)}
 onChange={(event) =>
 updatePair(pair.id, {
 backup_type: normalizeEquipmentType(event.target.value),
 backup: pair.backup
 ? { ...pair.backup, type: normalizeEquipmentType(event.target.value) }
 : pair.backup,
 })
 }
 disabled={!canEdit}
 className={INPUT_CLASS}
 >
 {EQUIPMENT_TYPE_OPTIONS.map((option) => (
 <option key={option.value} value={option.value}>{option.label}</option>
 ))}
 </select>
 </div>

 <div className="mt-2 text-xs space-y-2 bg-white rounded-lg border border-slate-200 p-2.5">
 <label className="block">
 Condicion:
 <input
 value={pair.backup.condition}
 onChange={(event) => updatePair(pair.id, { backup: { ...pair.backup, condition: event.target.value } })}
 disabled={!canEdit}
 className="ml-2 border rounded px-1 disabled:bg-gray-100 disabled:text-gray-500"
 />
 </label>
 <label className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={Boolean(pair.backup.install_with_primary)}
 onChange={(event) => updatePair(pair.id, { backup: { ...pair.backup, install_with_primary: event.target.checked } })}
 disabled={!canEdit}
 />
 Instalar simultaneamente
 </label>
 </div>
 </div>
 )}
 </>
 )}
 </div>

 <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
 <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
 <input
 type="checkbox"
 checked={Boolean(pair.requiresComplementary)}
 onChange={(event) => updatePair(pair.id, { requiresComplementary: event.target.checked })}
 disabled={!canEdit}
 />
 Requiere equipo complementario
 </label>
 {pair.requiresComplementary && (
 <input
 type="text"
 placeholder="Proposito del equipo complementario"
 value={pair.complementary_test_purpose || ""}
 onChange={(event) => updatePair(pair.id, { complementary_test_purpose: event.target.value })}
 disabled={!canEdit}
 className={INPUT_CLASS}
 />
 )}
 </div>
 </>
 )}

 <div className="pt-4 flex justify-end border-t border-slate-200">
 <button
 type="button"
 aria-label="Eliminar grupo de equipos"
 onClick={() => removePair(pair.id)}
 disabled={!canEdit}
 className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <FiTrash2 /> Eliminar grupo
 </button>
 </div>
 </div>
 </AccordionSection>
 {!pair.primary && hasMorePrimary && (
 <div className="px-2 pb-2">
 <button
 type="button"
 className={`${UI.actionSecondary} w-full cursor-pointer gap-1.5 active:scale-[0.97] transition-transform duration-150`}
 onClick={() => increaseVisibleRows(pair.id, "primary")}
 >
 <FiChevronDown size={14} />
 Mostrar mas equipos ({filteredPrimaryItems.length - visiblePrimaryItems.length} restantes)
 </button>
 </div>
 )}
 {pair.primary && pair.requiresBackup && !pair.backup && hasMoreBackup && (
 <div className="px-2 pb-2">
 <button
 type="button"
 className={`${UI.actionSecondary} w-full cursor-pointer gap-1.5 active:scale-[0.97] transition-transform duration-150`}
 onClick={() => increaseVisibleRows(pair.id, "backup")}
 >
 <FiChevronDown size={14} />
 Mostrar mas backups ({compatibleCandidates.length - visibleBackupCandidates.length} restantes)
 </button>
 </div>
 )}
 </div>
 );
 })}
 </div>

 <div className="sticky bottom-2 z-20">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-slate-200 bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-sm">
 <p className="text-xs text-slate-600">
 {pairsValidation.length > 0
 ? `Hay ${pairsValidation.length} validaciones pendientes.`
 : dirty
 ? "Cambios listos para guardar."
 : "Sin cambios pendientes."}
 </p>
 <button
 onClick={handleSave}
 disabled={!canEdit || pairsValidation.length > 0 || !dirty}
 className={`${SAVE_BUTTON_CLASS} w-full sm:w-auto`}
 >
 Guardar equipamiento
 </button>
 </div>
 </div>

 {pendingDeletePairId && (
 <div className="fixed inset-0 z-[1200] bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-4">
 <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 space-y-4">
 <h3 className="text-base font-semibold text-slate-900">Eliminar grupo de equipos</h3>
 <p className="text-sm text-slate-600">
 Este grupo ya tiene equipos seleccionados. Si lo eliminas, perderas esta configuracion.
 </p>
 <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
 <button
 type="button"
 onClick={cancelDeletePair}
 className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
 >
 Cancelar
 </button>
 <button
 type="button"
 onClick={confirmDeletePair}
 className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
 >
 Eliminar
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default EquipmentSection;

