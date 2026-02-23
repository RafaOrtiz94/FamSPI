import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiActivity, FiAlertTriangle, FiCheck, FiEdit2, FiTrash2, FiUpload, FiX } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../../core/auth/AuthContext";
import { recordBusinessCaseTelemetry } from "../../../../core/utils/businessCaseTelemetry";
import {
  getDeterminationsStatDocumentInfo,
  uploadDeterminationsStatDocument,
} from "../../../../core/api/businessCaseApi";

const ITEM_TYPES = [
  { value: "reactivo", label: "Reactivo" },
  { value: "control", label: "Control" },
  { value: "calibrador", label: "Calibrador" },
  { value: "consumible", label: "Consumible" },
  { value: "material", label: "Material" },
  { value: "determinacion", label: "Determinacion" },
];

const REACTIVO_TYPES = new Set(["reactivo", "determinacion"]);
const TECNICO_TYPES = new Set(["control", "calibrador", "consumible", "material"]);
const REACTIVO_ROLES = new Set(["comercial", "acp_comercial", "backoffice", "backoffice_comercial"]);
const TECNICO_ROLES = new Set(["jefe_tecnico", "tecnico"]);
const ADMIN_ROLES = new Set(["administrador", "super_admin"]);
const ROW_WINDOW_STEP = 24;
const IDEMPOTENCY_TTL_MS = 60 * 1000;

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
  const savedItemsRef = useRef([]);
  const excludedKeysRef = useRef([]);
  const consumptionVersionRef = useRef(null);
  const [equipmentIds, setEquipmentIds] = useState([]);
  const [equipmentMeta, setEquipmentMeta] = useState({});

  const [newItemByEquipment, setNewItemByEquipment] = useState({});

  const [editingItemKey, setEditingItemKey] = useState(null);
  const [editingItem, setEditingItem] = useState({
    id: "",
    name: "",
    type: "reactivo",
  });
  const idempotencyCacheRef = useRef(new Map());

  const canEditBase = permissions.canEdit !== false && ownership?.canUserEdit !== false;
  const currentRole = user?.role;
  const autosaveEnabled = false;
  const gateActive = gateInfo?.enabledForBusinessCase === true;
  const canUploadDocument = gateInfo?.permissions?.canUploadDocument === true;
  const canEditByGate = gateInfo?.permissions?.canEditDeterminations === true;
  const canEditFinal = gateActive ? (canEditBase && canEditByGate) : canEditBase;

  const canEditType = (type) => {
    if (!canEditFinal) return false;
    if (gateActive) return true;
    if (ADMIN_ROLES.has(currentRole)) return true;
    if (REACTIVO_TYPES.has(type)) return REACTIVO_ROLES.has(currentRole);
    if (TECNICO_TYPES.has(type)) return TECNICO_ROLES.has(currentRole);
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
    const detailsFromExtra = businessCase?.extra?.equipment_details;
    if (Array.isArray(detailsFromExtra) && detailsFromExtra.length > 0) {
      const ids = detailsFromExtra.map((pair) => pair?.primary_id).filter(Boolean);
      if (ids.length) {
        setEquipmentIds(Array.from(new Set(ids)));
        return;
      }
    }
    try {
      const res = await api.get(`/business-case/${bcId}/equipment-details`);
      const equipmentDetails = res.data?.data || [];
      if (equipmentDetails.length > 0) {
        const ids = equipmentDetails.map((pair) => pair?.primary_id).filter(Boolean);
        if (ids.length) {
          setEquipmentIds(Array.from(new Set(ids)));
        }
      }
    } catch (err) {
      console.warn("No se pudieron cargar datos de equipo", err.message);
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
      const uniqueDeterminaciones = new Map();
      determinationsList.forEach((det) => {
        if (!uniqueDeterminaciones.has(det.id)) {
          uniqueDeterminaciones.set(det.id, det);
        }
      });
      const uniqueConsumables = new Map();
      consumablesList.forEach((item) => {
        if (!uniqueConsumables.has(item.id)) {
          uniqueConsumables.set(item.id, item);
        }
      });
      setCatalogDeterminations(Array.from(uniqueDeterminaciones.values()));
      setCatalogConsumables(Array.from(uniqueConsumables.values()));
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
        headers: {
          "Cache-Control": "no-cache, no-store, max-age=0",
          Pragma: "no-cache",
        },
      });
      const data = res?.data?.data || {};
      const items = Array.isArray(data?.items) ? data.items : [];
      const excluded = Array.isArray(data?.excluded) ? data.excluded : [];
      const version = data?.version || null;
      pendingQtyChangesRef.current = {};
      editedRowsRef.current = {};
      setPendingChangesCount(0);
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
      consumptionVersionRef.current = version;
      setSavedItems(items);
      setExcludedKeys(excluded);
      setQuantityDrafts(() => {
        const next = {};
        items.forEach((item) => {
          if (!item?.key) return;
          next[item.key] = String(item.annualQty ?? 0);
        });
        quantityDraftsRef.current = next;
        return next;
      });
      setHasStructureChanges(false);
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
      // Fallback to businessCase metadata if API fails
      const stored = businessCase?.modern_bc_metadata?.consumption_items;
      const excluded = businessCase?.modern_bc_metadata?.consumption_excluded;
      const safeStored = Array.isArray(stored) ? stored : [];
      pendingQtyChangesRef.current = {};
      editedRowsRef.current = {};
      setPendingChangesCount(0);
      consumptionVersionRef.current = null;
      setSavedItems(safeStored);
      setExcludedKeys(Array.isArray(excluded) ? excluded : []);
      setQuantityDrafts(() => {
        const next = {};
        safeStored.forEach((item) => {
          if (!item?.key) return;
          next[item.key] = String(item.annualQty ?? 0);
        });
        quantityDraftsRef.current = next;
        return next;
      });
      setHasStructureChanges(false);
      recordBusinessCaseTelemetry({
        section: "determinations",
        type: "load_existing_fallback",
        success: false,
      });
    }
  }, [bcId, businessCase?.modern_bc_metadata?.consumption_excluded, businessCase?.modern_bc_metadata?.consumption_items]);

  const loadGateInfo = useCallback(async () => {
    if (!bcId) return;
    setGateLoading(true);
    try {
      const data = await getDeterminationsStatDocumentInfo(bcId);
      setGateInfo(data || null);
    } catch (err) {
      console.warn("No se pudo cargar informacion del documento estadistico", err?.message || err);
      setGateInfo(null);
    } finally {
      setGateLoading(false);
    }
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

  useEffect(() => {
    loadGateInfo();
  }, [loadGateInfo]);

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
      type: "determinacion",
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
      type: item.type || "consumible",
      name: item.name,
      itemId: item.supplier_code || null,
      manufacturerId: item.supplier_code || null,
      source: "catalog",
      catalogId: item.id,
      equipmentId: item.equipment_id,
      equipmentName: item.equipment_name,
    }));
    return [...determinations, ...consumables].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogDeterminations, catalogConsumables]);

  const savedMap = useMemo(() => {
    const map = {};
    (savedItems || []).forEach((item) => {
      if (!item) return;
      if (item.key) map[item.key] = item;
      if (item.catalogId && item.equipmentId) {
        const prefix = item.type === "determinacion" ? "det" : "cons";
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
      manufacturerId: item.manufacturerId || item.itemId || null,
      equipmentName: item.equipmentName || "Manual",
      equipmentId: item.equipmentId || null,
    }));
    return [...catalogVisible, ...enrichedCustom];
  }, [catalogItems, savedItems, excludedKeys]);

  const groupedByEquipment = useMemo(() => {
    const groups = {};
    mergedRows.forEach((row) => {
      const groupKey = row.equipmentId ? `eq:${row.equipmentId}` : `manual:${row.equipmentName || row.name}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          name: row.equipmentName || "Manual",
          equipmentId: row.equipmentId || null,
          reactivos: [],
          tecnicos: [],
        };
      }
      if (REACTIVO_TYPES.has(row.type)) {
        groups[groupKey].reactivos.push(row);
      } else if (TECNICO_TYPES.has(row.type)) {
        groups[groupKey].tecnicos.push(row);
      }
    });

    // Ensure every selected equipment appears even if it has no catalog items
    equipmentIds.forEach((id) => {
      const groupKey = `eq:${id}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          name: equipmentMeta[id] || `Equipo ${id}`,
          equipmentId: id,
          reactivos: [],
          tecnicos: [],
        };
      }
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [mergedRows, equipmentIds, equipmentMeta]);

  const getSavedRow = (row) => {
    if (!row) return null;
    return savedMap[row.key] || (row.legacyKey ? savedMap[row.legacyKey] : null);
  };

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

  const getQtyInputValue = (row) => {
    const draftValue = quantityDrafts[row.key];
    if (draftValue !== undefined) return draftValue;
    if (row?.legacyKey && quantityDrafts[row.legacyKey] !== undefined) {
      return quantityDrafts[row.legacyKey];
    }
    const savedValue = getSavedRow(row)?.annualQty;
    return String(savedValue ?? 0);
  };

  const toPositiveNumber = (value) => {
    const normalized = String(value ?? "").trim().replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return parsed > 0 ? parsed : 0;
  };

  const syncQuantityDrafts = useCallback((items = []) => {
    const next = {};
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item?.key) return;
      next[item.key] = String(item.annualQty ?? 0);
    });
    quantityDraftsRef.current = next;
    setQuantityDrafts(next);
  }, []);

  const getWindowLimit = (groupKey, tableType) =>
    rowWindowByGroup[`${groupKey}:${tableType}`] || ROW_WINDOW_STEP;

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
    const { refresh = true, silent = false, revalidate = true } = options;
    setSaving(true);
    const startedAt = Date.now();
    try {
      const debugItemPayload = (nextItems || []).find((item) => String(item?.itemId || "").trim() === "3321193001");
      console.info("[BC_CONSUMPTION][FE][SAVE][REQUEST]", {
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
        items: nextItems,
        excluded: nextExcluded,
        version: consumptionVersionRef.current,
        idempotency_key: getIdempotencyKey("bc.consumption.save", {
          items: nextItems,
          excluded: nextExcluded,
          version: consumptionVersionRef.current,
        }),
      };
      const querySuffix = silent ? "?silent=true" : "";
      const response = await api.put(`/business-case/${bcId}/consumption-items${querySuffix}`, payload);
      const persisted = response?.data?.data || {};
      const persistedItems = Array.isArray(persisted.items) ? persisted.items : nextItems;
      const persistedExcluded = Array.isArray(persisted.excluded) ? persisted.excluded : nextExcluded;
      const debugItemResponse = (persistedItems || []).find((item) => String(item?.itemId || "").trim() === "3321193001");
      console.info("[BC_CONSUMPTION][FE][SAVE][RESPONSE]", {
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
      consumptionVersionRef.current = persisted?.version || consumptionVersionRef.current;
      savedItemsRef.current = persistedItems;
      excludedKeysRef.current = persistedExcluded;
      setSavedItems(persistedItems);
      setExcludedKeys(persistedExcluded);
      syncQuantityDrafts(persistedItems);
      pendingQtyChangesRef.current = {};
      editedRowsRef.current = {};
      setPendingChangesCount(0);
      setHasStructureChanges(false);
      if (revalidate) {
        await loadExisting();
      }
      onSave({ refresh });
      recordBusinessCaseTelemetry({
        section: "determinations",
        type: "save_full_success",
        durationMs: Date.now() - startedAt,
        success: true,
      });
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "CONSUMPTION_VERSION_CONFLICT") {
        showToast("Otro usuario actualizo esta seccion. Recargando datos...", "warning");
        await loadExisting();
      } else {
        showToast(err?.response?.data?.message || "No se pudo guardar la informacion", "error");
      }
      recordBusinessCaseTelemetry({
        section: "determinations",
        type: "save_full_error",
        durationMs: Date.now() - startedAt,
        success: false,
      });
    } finally {
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

    const nextExcluded = Array.from(new Set(excludedKeysRef.current || []));
    const nextItems = [];

    visibleRowMap.forEach((row) => {
      const saved = savedItemsRef.current.find((item) => item?.key === row.key)
        || (row.legacyKey
          ? savedItemsRef.current.find((item) => item?.key === row.legacyKey)
          : null);
      const rawQty =
        quantityDraftsRef.current[row.key]
        ?? (row?.legacyKey ? quantityDraftsRef.current[row.legacyKey] : undefined)
        ?? saved?.annualQty
        ?? row?.annualQty
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
        equipmentId: row?.equipmentId ?? saved?.equipmentId ?? null,
        equipmentName: row?.equipmentName ?? saved?.equipmentName ?? null,
      });
    });

    const debugItemFromPayload = nextItems.find((item) => String(item?.itemId || "").trim() === "3321193001");
    console.info("[BC_CONSUMPTION][FE][BUILD_PAYLOAD]", {
      bcId,
      rowsVisible: visibleRowMap.size,
      itemsToSave: nextItems.length,
      excludedToSave: nextExcluded.length,
      debugItem: debugItemFromPayload
        ? {
          key: debugItemFromPayload.key,
          itemId: debugItemFromPayload.itemId,
          annualQty: debugItemFromPayload.annualQty,
          source: debugItemFromPayload.source,
        }
        : null,
    });
    return { nextItems, nextExcluded };
  }, [bcId, mergedRows]);

  const flushPendingQtyChanges = async (options = {}) => {
    const { force = false } = options;
    const changedKeys = Object.keys(pendingQtyChangesRef.current || {});
    if (!force && !changedKeys.length && !hasStructureChanges) return;
    const { nextItems, nextExcluded } = buildPersistPayloadFromDrafts();
    await persistItems(nextItems, nextExcluded, { refresh: true, silent: false });
  };

  const handleQtyChange = (rowKey, value) => {
    const row = mergedRows.find((item) => item.key === rowKey);
    if (!row || !canEditType(row.type)) return;
    editedRowsRef.current[rowKey] = row;
    const nextDraftsRef = { ...quantityDraftsRef.current, [rowKey]: value };
    if (row.legacyKey) {
      nextDraftsRef[row.legacyKey] = value;
    }
    quantityDraftsRef.current = nextDraftsRef;
    setQuantityDrafts((prev) => {
      const next = { ...prev, [rowKey]: value };
      if (row.legacyKey) next[row.legacyKey] = value;
      return next;
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
      console.info("[BC_CONSUMPTION][FE][QTY_CHANGE]", {
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

  const handleQtyBlur = (rowKey) => {
    if (!autosaveEnabled) return;
    if (!Object.prototype.hasOwnProperty.call(quantityDraftsRef.current, rowKey)) return;
    const row = mergedRows.find((item) => item.key === rowKey);
    if (!row || !canEditType(row.type)) return;
    const value = quantityDraftsRef.current[rowKey];
    const numeric = toPositiveNumber(value);
    const savedNumeric = toPositiveNumber(getSavedRow(row)?.annualQty ?? 0);
    if (numeric !== savedNumeric) {
      pendingQtyChangesRef.current[rowKey] = true;
    } else {
      delete pendingQtyChangesRef.current[rowKey];
    }
    setPendingChangesCount(Object.keys(pendingQtyChangesRef.current).length);
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
  };

  const handleSaveNow = () => {
    // Guardado manual explícito: siempre persistimos snapshot actual para dejar avance en base.
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    flushPendingQtyChanges({ force: true });
  };

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
      showToast("Documento estadistico cargado correctamente", "success");
      setSelectedDocument(null);
      await loadGateInfo();
      onSave({ refresh: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo cargar el documento", "error");
    } finally {
      setUploadingDocument(false);
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
        label: "Ventana 48h",
        status: expired ? "blocked" : hasDoc ? "active" : "pending",
      },
    ];
  }, [gateInfo]);

  const handleAddCustom = (groupKey, equipmentName, equipmentId) => {
    const draft = newItemByEquipment[groupKey] || { id: "", name: "", type: "reactivo" };
    if (!canEditType(draft.type)) {
      showToast("No tienes permisos para registrar este tipo de item", "warning");
      return;
    }
    if (!draft.id.trim() || !draft.name.trim()) {
      showToast("Ingrese el ID y el nombre del item", "warning");
      return;
    }
    const key = `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const next = [
      ...savedItems,
      {
        key,
        itemId: draft.id.trim(),
        name: draft.name.trim(),
        type: draft.type,
        source: "custom",
        catalogId: null,
        annualQty: 0,
        equipmentName,
        equipmentId: equipmentId || null,
      },
    ];
    setNewItemByEquipment((prev) => ({ ...prev, [groupKey]: { id: "", name: "", type: "reactivo" } }));
    setSavedItems(next);
    setHasStructureChanges(true);
  };

  const startEditItem = (row) => {
    if (row.source !== "custom") return;
    if (!canEditType(row.type)) return;
    setEditingItemKey(row.key);
    setEditingItem({ id: row.itemId || "", name: row.name || "", type: row.type || "reactivo" });
  };

  const saveEditItem = () => {
    if (!editingItemKey) return;
    const next = savedItems.map((item) => {
      if (item.key !== editingItemKey) return item;
      return {
        ...item,
        itemId: editingItem.id.trim() || item.itemId,
        name: editingItem.name.trim() || item.name,
        type: editingItem.type || item.type,
      };
    });
    setEditingItemKey(null);
    setEditingItem({ id: "", name: "", type: "reactivo" });
    setSavedItems(next);
    setHasStructureChanges(true);
  };

  const cancelEditItem = () => {
    setEditingItemKey(null);
    setEditingItem({ id: "", name: "", type: "reactivo" });
  };

  const removeItem = async (row) => {
    if (!canEditType(row.type)) return;
    const itemLabel = row?.name || row?.itemId || "este elemento";
    const actionLabel = row?.source === "catalog" ? "quitar del listado" : "eliminar";
    const confirmed = window.confirm(
      `¿Confirmas ${actionLabel} "${itemLabel}"?\\n\\nLa acción quedará en borrador hasta presionar "Guardar informacion".`
    );
    if (!confirmed) return;

    const next = savedItems.filter((item) => item.key !== row.key);
    if (row.source === "catalog") {
      const nextExcluded = Array.from(new Set([...excludedKeys, row.key]));
      setSavedItems(next);
      setExcludedKeys(nextExcluded);
      setHasStructureChanges(true);
      return;
    }
    setSavedItems(next);
    setHasStructureChanges(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
          <FiActivity size={24} />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Consumos anuales</h2>
          <p className="text-sm text-gray-500">
            Registre el consumo anual informado por el laboratorio para cada item segun los equipos seleccionados.
          </p>
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
              <div className="text-xs text-gray-700 space-y-1">
                <div>
                  <span className="font-semibold">Documento:</span>{" "}
                  {gateInfo?.document?.driveLink ? (
                    <a
                      href={gateInfo.document.driveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 hover:underline"
                    >
                      {gateInfo?.document?.name || "Ver archivo"}
                    </a>
                  ) : (
                    <span>{gateInfo?.document?.name || "Cargado"}</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold">Subido por:</span> {gateInfo?.document?.uploadedByEmail || "N/A"}
                </div>
                <div>
                  <span className="font-semibold">Habilitado:</span> {formatGateDateTime(gateInfo?.enabledAt)}
                </div>
                <div>
                  <span className="font-semibold">Vence:</span> {formatGateDateTime(gateInfo?.deadlineAt)}
                </div>
                <div>
                  <span className="font-semibold">Responsables:</span> {(gateInfo?.editors || []).join(", ") || "N/A"}
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Aun no se ha cargado el documento estadistico. La seccion de determinaciones permanece bloqueada.
              </div>
            )}

            {canUploadDocument && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                  onChange={(e) => setSelectedDocument(e.target.files?.[0] || null)}
                  className="text-xs"
                />
                <button
                  type="button"
                  onClick={handleUploadStatDocument}
                  disabled={!selectedDocument || uploadingDocument}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  <FiUpload size={14} />
                  {uploadingDocument ? "Cargando..." : "Subir documento"}
                </button>
              </div>
            )}

            {!canEditFinal && (
              <div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                No tienes habilitada la edicion de determinaciones para este flujo o la ventana de 48 horas ya expiro.
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
        <div className="space-y-6">
          {groupedByEquipment.map((group) => {
            const reactivosLimit = getWindowLimit(group.key, "reactivos");
            const tecnicosLimit = getWindowLimit(group.key, "tecnicos");
            const visibleReactivos = group.reactivos.slice(0, reactivosLimit);
            const visibleTecnicos = group.tecnicos.slice(0, tecnicosLimit);

            return (
            <div key={group.name} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{group.name}</h3>
                  <p className="text-xs text-gray-500">Consumos anuales por equipo</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
                  <h4 className="text-sm font-semibold text-gray-800">Reactivos y determinaciones</h4>
                  <p className="text-xs text-gray-500">
                    Edita esta seccion con rol comercial / acp comercial / backoffice.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[640px] text-xs sm:text-sm">
                    <thead className="bg-gray-50/50">
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="py-3 px-4 font-semibold">Tipo</th>
                        <th className="py-3 px-4 font-semibold">Nombre</th>
                        <th className="py-3 px-4 font-semibold">Cantidad anual</th>
                        <th className="py-3 px-4 font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {visibleReactivos.map((row) => {
                        const isCustom = row.source === "custom";
                        const isEditing = editingItemKey === row.key;
                        const canEditRow = canEditType(row.type);
                        const manufacturerId = getManufacturerId(row);
                        return (
                          <tr key={row.key} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-4 text-gray-600">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                {row.type}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {isEditing ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <input
                                    className="border rounded-lg px-2 py-1 w-full"
                                    placeholder="ID fabricante"
                                    value={editingItem.id}
                                    onChange={(e) => setEditingItem({ ...editingItem, id: e.target.value })}
                                    disabled={!canEditRow}
                                  />
                                  <input
                                    className="border rounded-lg px-2 py-1 w-full"
                                    placeholder="Nombre"
                                    value={editingItem.name}
                                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                    disabled={!canEditRow}
                                  />
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-gray-900">{row.name}</span>
                                  {manufacturerId && (
                                    <div className="text-xs text-gray-400">ID fabricante: {manufacturerId}</div>
                                  )}
                                </div>
                              )}
                              {row.source === "catalog" && (
                                <span className="ml-2 text-xs text-gray-400">(catalogo)</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="number"
                                min={0}
                                value={getQtyInputValue(row)}
                                onChange={(e) => handleQtyChange(row.key, e.target.value)}
                                onBlur={() => handleQtyBlur(row.key)}
                                className="w-32 border border-gray-200 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-gray-900 font-medium disabled:bg-gray-50 disabled:text-gray-400"
                                placeholder="0"
                                disabled={!canEditRow}
                              />
                            </td>
                            <td className="py-3 px-4">
                              {isEditing ? (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <button
                                    onClick={saveEditItem}
                                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded flex items-center gap-1 disabled:opacity-50"
                                    disabled={!canEditRow}
                                  >
                                    <FiCheck size={12} /> Guardar
                                  </button>
                                  <button
                                    onClick={cancelEditItem}
                                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded flex items-center gap-1"
                                  >
                                    <FiX size={12} /> Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  {isCustom && (
                                    <button
                                      onClick={() => startEditItem(row)}
                                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded flex items-center gap-1 disabled:opacity-50"
                                      disabled={!canEditRow}
                                    >
                                      <FiEdit2 size={12} /> Editar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => removeItem(row)}
                                    className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded flex items-center gap-1 disabled:opacity-50"
                                    disabled={!canEditRow}
                                  >
                                    <FiTrash2 size={12} /> Quitar
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!group.reactivos.length && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-gray-500">
                            No hay reactivos o determinaciones para este equipo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {group.reactivos.length > visibleReactivos.length && (
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/70">
                    <button
                      type="button"
                      onClick={() => expandRowWindow(group.key, "reactivos")}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                    >
                      Mostrar mas ({group.reactivos.length - visibleReactivos.length} restantes)
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
                  <h4 className="text-sm font-semibold text-gray-800">Controles, calibradores y consumibles</h4>
                  <p className="text-xs text-gray-500">
                    Edita esta seccion con rol jefe tecnico / tecnico.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[640px] text-xs sm:text-sm">
                    <thead className="bg-gray-50/50">
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="py-3 px-4 font-semibold">Tipo</th>
                        <th className="py-3 px-4 font-semibold">Nombre</th>
                        <th className="py-3 px-4 font-semibold">Cantidad anual</th>
                        <th className="py-3 px-4 font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {visibleTecnicos.map((row) => {
                        const isCustom = row.source === "custom";
                        const isEditing = editingItemKey === row.key;
                        const canEditRow = canEditType(row.type);
                        const manufacturerId = getManufacturerId(row);
                        return (
                          <tr key={row.key} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-4 text-gray-600">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                {row.type}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {isEditing ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <input
                                    className="border rounded-lg px-2 py-1 w-full"
                                    placeholder="ID fabricante"
                                    value={editingItem.id}
                                    onChange={(e) => setEditingItem({ ...editingItem, id: e.target.value })}
                                    disabled={!canEditRow}
                                  />
                                  <input
                                    className="border rounded-lg px-2 py-1 w-full"
                                    placeholder="Nombre"
                                    value={editingItem.name}
                                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                    disabled={!canEditRow}
                                  />
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-gray-900">{row.name}</span>
                                  {manufacturerId && (
                                    <div className="text-xs text-gray-400">ID fabricante: {manufacturerId}</div>
                                  )}
                                </div>
                              )}
                              {row.source === "catalog" && (
                                <span className="ml-2 text-xs text-gray-400">(catalogo)</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="number"
                                min={0}
                                value={getQtyInputValue(row)}
                                onChange={(e) => handleQtyChange(row.key, e.target.value)}
                                onBlur={() => handleQtyBlur(row.key)}
                                className="w-32 border border-gray-200 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-gray-900 font-medium disabled:bg-gray-50 disabled:text-gray-400"
                                placeholder="0"
                                disabled={!canEditRow}
                              />
                            </td>
                            <td className="py-3 px-4">
                              {isEditing ? (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <button
                                    onClick={saveEditItem}
                                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded flex items-center gap-1 disabled:opacity-50"
                                    disabled={!canEditRow}
                                  >
                                    <FiCheck size={12} /> Guardar
                                  </button>
                                  <button
                                    onClick={cancelEditItem}
                                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded flex items-center gap-1"
                                  >
                                    <FiX size={12} /> Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  {isCustom && (
                                    <button
                                      onClick={() => startEditItem(row)}
                                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded flex items-center gap-1 disabled:opacity-50"
                                      disabled={!canEditRow}
                                    >
                                      <FiEdit2 size={12} /> Editar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => removeItem(row)}
                                    className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded flex items-center gap-1 disabled:opacity-50"
                                    disabled={!canEditRow}
                                  >
                                    <FiTrash2 size={12} /> Quitar
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!group.tecnicos.length && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-gray-500">
                            No hay controles, calibradores o consumibles para este equipo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {group.tecnicos.length > visibleTecnicos.length && (
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/70">
                    <button
                      type="button"
                      onClick={() => expandRowWindow(group.key, "tecnicos")}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                    >
                      Mostrar mas ({group.tecnicos.length - visibleTecnicos.length} restantes)
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 border border-gray-100 bg-gray-50/50 rounded-2xl">
                <div className="text-sm font-semibold text-gray-800 mb-2">
                  Agregar item manual para {group.name}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  <input
                    type="text"
                    className="border rounded-lg px-2 py-1"
                    placeholder="ID fabricante"
                    value={newItemByEquipment[group.key]?.id || ""}
                    onChange={(e) =>
                      setNewItemByEquipment((prev) => ({
                        ...prev,
                        [group.key]: { ...(prev[group.key] || { type: "reactivo" }), id: e.target.value },
                      }))
                    }
                    disabled={!canEditType((newItemByEquipment[group.key]?.type || "reactivo"))}
                  />
                  <input
                    type="text"
                    className="border rounded-lg px-2 py-1"
                    placeholder="Nombre del item"
                    value={newItemByEquipment[group.key]?.name || ""}
                    onChange={(e) =>
                      setNewItemByEquipment((prev) => ({
                        ...prev,
                        [group.key]: { ...(prev[group.key] || { type: "reactivo" }), name: e.target.value },
                      }))
                    }
                    disabled={!canEditType((newItemByEquipment[group.key]?.type || "reactivo"))}
                  />
                  <select
                    className="border rounded-lg px-2 py-1"
                    value={newItemByEquipment[group.key]?.type || "reactivo"}
                    onChange={(e) =>
                      setNewItemByEquipment((prev) => ({
                        ...prev,
                        [group.key]: { ...(prev[group.key] || {}), type: e.target.value },
                      }))
                    }
                  >
                    {ITEM_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAddCustom(group.key, group.name, group.equipmentId)}
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 w-full sm:w-auto disabled:opacity-50"
                    disabled={!canEditType((newItemByEquipment[group.key]?.type || "reactivo"))}
                  >
                    Agregar
                  </button>
                </div>
                {!canEditType((newItemByEquipment[group.key]?.type || "reactivo")) && (
                  <div className="mt-2 text-xs text-gray-500">
                    No tienes permisos para agregar items de este tipo.
                  </div>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50 border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-full">
            <FiAlertTriangle size={16} />
          </div>
          <span>Cambios pendientes de guardado en base de datos.</span>
          {(pendingChangesCount > 0 || hasStructureChanges) && (
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
              Pendientes: {pendingChangesCount + (hasStructureChanges ? 1 : 0)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6 text-sm">
          <button
            type="button"
            onClick={handleSaveNow}
            disabled={saving || !canEditFinal}
            className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guardar ahora
          </button>
          {saving && (
            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <span className="text-xs font-semibold">Guardando...</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-end pt-4 border-t border-gray-100">
        <button
          onClick={handleSaveNow}
          disabled={!canEditFinal || saving}
          className="bg-blue-600 text-white w-full sm:w-auto px-6 py-2.5 rounded-full font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Guardar informacion
        </button>
      </div>
    </div>
  );
};

export default DeterminationsSection;
