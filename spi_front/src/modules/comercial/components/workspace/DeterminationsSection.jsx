import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiActivity, FiAlertTriangle, FiCheck, FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../../core/auth/AuthContext";

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

const DeterminationsSection = ({
  businessCase,
  permissions = {},
  ownership = {},
  onSave = () => {}
}) => {
  const { id: bcId } = useParams();
  const { showToast } = useUI();
  const { user } = useAuth();
  const [catalogDeterminations, setCatalogDeterminations] = useState([]);
  const [catalogConsumables, setCatalogConsumables] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [excludedKeys, setExcludedKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRefs = useRef({});
  const [equipmentIds, setEquipmentIds] = useState([]);
  const [equipmentMeta, setEquipmentMeta] = useState({});

  const [newItemByEquipment, setNewItemByEquipment] = useState({});

  const [editingItemKey, setEditingItemKey] = useState(null);
  const [editingItem, setEditingItem] = useState({
    id: "",
    name: "",
    type: "reactivo",
  });

  const canEditBase = permissions.canEdit !== false && ownership?.canUserEdit !== false;
  const currentRole = user?.role;

  const canEditType = (type) => {
    if (!canEditBase) return false;
    if (ADMIN_ROLES.has(currentRole)) return true;
    if (REACTIVO_TYPES.has(type)) return REACTIVO_ROLES.has(currentRole);
    if (TECNICO_TYPES.has(type)) return TECNICO_ROLES.has(currentRole);
    return false;
  };

  const loadEquipmentData = async () => {
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
  };

  const loadCatalog = async () => {
    if (!equipmentIds.length) return;
    setLoading(true);
    try {
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
    } catch (err) {
      showToast("No se pudieron cargar items del catalogo", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadExisting = async () => {
    if (!bcId) return;
    try {
      const res = await api.get(`/business-case/${bcId}/consumption-items`);
      const data = res?.data?.data || {};
      const items = Array.isArray(data?.items) ? data.items : [];
      const excluded = Array.isArray(data?.excluded) ? data.excluded : [];
      setSavedItems(items);
      setExcludedKeys(excluded);
      return;
    } catch (err) {
      // Fallback to businessCase metadata if API fails
      const stored = businessCase?.modern_bc_metadata?.consumption_items;
      const excluded = businessCase?.modern_bc_metadata?.consumption_excluded;
      setSavedItems(Array.isArray(stored) ? stored : []);
      setExcludedKeys(Array.isArray(excluded) ? excluded : []);
    }
  };

  useEffect(() => {
    loadEquipmentData();
  }, [bcId]);

  useEffect(() => {
    if (equipmentIds.length) {
      loadCatalog();
    }
  }, [equipmentIds]);

  useEffect(() => {
    loadExisting();
  }, [bcId]);

  const catalogItems = useMemo(() => {
    const determinations = (catalogDeterminations || []).map((det) => ({
      key: `det:${det.equipment_id}:${det.id}`,
      legacyKey: `det:${det.id}`,
      type: "determinacion",
      name: det.name,
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
      equipmentName: item.equipmentName || "Manual",
      equipmentId: item.equipmentId || null,
    }));
    return [...catalogVisible, ...enrichedCustom];
  }, [catalogItems, savedItems, excludedKeys]);

  const reactivoRows = useMemo(
    () => mergedRows.filter((row) => REACTIVO_TYPES.has(row.type)),
    [mergedRows]
  );
  const tecnicoRows = useMemo(
    () => mergedRows.filter((row) => TECNICO_TYPES.has(row.type)),
    [mergedRows]
  );

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

  const persistItems = async (nextItems, nextExcluded = excludedKeys) => {
    if (!bcId) {
      showToast("Primero crea el Business Case", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        items: nextItems,
        excluded: nextExcluded,
      };
      await api.put(`/business-case/${bcId}/consumption-items`, payload);
      setSavedItems(nextItems);
      setExcludedKeys(nextExcluded);
      onSave();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo guardar la informacion", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleQtyChange = (rowKey, value) => {
    const row = mergedRows.find((item) => item.key === rowKey);
    if (!row || !canEditType(row.type)) return;
    const numeric = Number(value) || 0;
    clearTimeout(debounceRefs.current[rowKey]);
    debounceRefs.current[rowKey] = setTimeout(() => {
      const baseItems = [...savedItems].filter((item) => item.key !== rowKey);
      if (!row) return;
      if (!numeric) {
        if (row.source === "catalog") {
          const nextExcluded = Array.from(new Set([...excludedKeys, row.key]));
          persistItems(baseItems, nextExcluded);
          return;
        }
        persistItems(baseItems);
        return;
      }
      const nextExcluded = excludedKeys.filter((key) => key !== row.key);
      const next = [
        ...baseItems,
        {
          key: row.key,
          name: row.name,
          type: row.type,
          source: row.source,
          catalogId: row.catalogId || null,
          annualQty: numeric,
          equipmentId: row.equipmentId || null,
          equipmentName: row.equipmentName || null,
        },
      ];
      persistItems(next, nextExcluded);
    }, 500);
  };

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
    persistItems(next);
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
    persistItems(next);
  };

  const cancelEditItem = () => {
    setEditingItemKey(null);
    setEditingItem({ id: "", name: "", type: "reactivo" });
  };

  const removeItem = async (row) => {
    if (!canEditType(row.type)) return;
    const next = savedItems.filter((item) => item.key !== row.key);
    if (row.source === "catalog") {
      const nextExcluded = Array.from(new Set([...excludedKeys, row.key]));
      await persistItems(next, nextExcluded);
      return;
    }
    await persistItems(next);
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

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByEquipment.map((group) => (
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
                      {group.reactivos.map((row) => {
                        const saved = getSavedRow(row);
                        const isCustom = row.source === "custom";
                        const isEditing = editingItemKey === row.key;
                        const canEditRow = canEditType(row.type);
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
                                    placeholder="ID"
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
                                  {row.itemId && <div className="text-xs text-gray-400">ID: {row.itemId}</div>}
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
                                defaultValue={saved?.annualQty || 0}
                                onChange={(e) => handleQtyChange(row.key, e.target.value)}
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
                      {group.tecnicos.map((row) => {
                        const saved = getSavedRow(row);
                        const isCustom = row.source === "custom";
                        const isEditing = editingItemKey === row.key;
                        const canEditRow = canEditType(row.type);
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
                                    placeholder="ID"
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
                                  {row.itemId && <div className="text-xs text-gray-400">ID: {row.itemId}</div>}
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
                                defaultValue={saved?.annualQty || 0}
                                onChange={(e) => handleQtyChange(row.key, e.target.value)}
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
              </div>

              <div className="p-4 border border-gray-100 bg-gray-50/50 rounded-2xl">
                <div className="text-sm font-semibold text-gray-800 mb-2">
                  Agregar item manual para {group.name}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  <input
                    type="text"
                    className="border rounded-lg px-2 py-1"
                    placeholder="ID del item"
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
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50 border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-full">
            <FiAlertTriangle size={16} />
          </div>
          <span>Los cambios se guardan automaticamente (debounce 500ms).</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
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
          onClick={onSave}
          className="bg-blue-600 text-white w-full sm:w-auto px-6 py-2.5 rounded-full font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Guardar informacion
        </button>
      </div>
    </div>
  );
};

export default DeterminationsSection;
