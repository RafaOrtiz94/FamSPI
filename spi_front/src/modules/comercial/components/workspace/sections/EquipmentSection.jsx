import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { FiActivity } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";

const DEFAULT_EQUIPMENT_PAIRS = [
  { id: Date.now(), primary: null, primary_type: "new_available", backup: null, requiresBackup: false } // Start with one empty pair
];

const EQUIPMENT_TYPE_OPTIONS = [
  { value: "new_available", label: "Nuevo" },
  { value: "cu", label: "CU" },
  { value: "installed_client", label: "Instalado en cliente" },
];

const normalizeEquipmentType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["new_available", "nuevo", "new"].includes(normalized)) return "new_available";
  if (normalized === "cu") return "cu";
  if (["installed_client", "instalado_cliente", "installed", "instalado_en_cliente"].includes(normalized)) {
    return "installed_client";
  }
  return "new_available";
};

const EquipmentSection = ({
  businessCase,
  permissions = {},
  ownership = {},
  onSave = () => { }
}) => {
  const { id: bcId } = useParams();
  const { showToast } = useUI();

  // ONE-TIME HYDRATION GUARD
  const hydratedRef = useRef(false);

  // COMPLETE SECTION DATA - All fields from businessCase, even conditional ones
  const sectionData = useMemo(() => {
    const equipmentDetails =
      businessCase?.equipment_details ||
      businessCase?.extra?.equipment_details ||
      null;
    if (!equipmentDetails) return { equipmentPairs: DEFAULT_EQUIPMENT_PAIRS };

    // Map business case equipment data to component state format
    return {
      equipmentPairs: equipmentDetails.map((detail, index) => ({
        id: detail.id || Date.now() + index,
        primary_type: normalizeEquipmentType(
          detail.primary_type ||
          detail.primary?.type
        ),
        requiresBackup: Boolean(
          detail.requires_backup ??
          detail.requiresBackup ??
          detail.backup_id ??
          detail.backup
        ),
        primary: detail.primary ? {
          id: detail.primary.id,
          name: detail.primary.name,
          code: detail.primary.code,
          capacity: detail.primary.capacity,
          price: detail.primary.price,
          description: detail.primary.description,
          categories: detail.primary.categories || []
        } : detail.primary_id ? { id: detail.primary_id } : null,
        backup: detail.backup ? {
          id: detail.backup.id,
          name: detail.backup.name,
          code: detail.backup.code,
          capacity: detail.backup.capacity,
          price: detail.backup.price,
          description: detail.backup.description,
          categories: detail.backup.categories || [],
          condition: detail.backup.condition || "Nuevo",
          install_with_primary: detail.backup.install_with_primary || false
        } : detail.backup_id ? { id: detail.backup_id } : null
      })) || DEFAULT_EQUIPMENT_PAIRS
    };
  }, [businessCase]);

  // Initialize state with sectionData (deterministic hydration)
  const [equipmentPairs, setEquipmentPairs] = useState(() => sectionData.equipmentPairs);

  // ONE-TIME HYDRATION: Reset equipment pairs when businessCase data is available
  useEffect(() => {
    // GUARD: Only hydrate once, when sectionData has equipment pairs and different from current
    if (!sectionData.equipmentPairs || hydratedRef.current) return;

    console.info("[BC][EQUIPMENT][HYDRATE]", {
      pairsCount: sectionData.equipmentPairs.length,
      hasPrimary: sectionData.equipmentPairs.some((pair) => Boolean(pair.primary)),
    });
    setEquipmentPairs(sectionData.equipmentPairs);
    hydratedRef.current = true; // Mark as hydrated - never reset again
  }, [sectionData.equipmentPairs]);

  // Handle save operation for workspace
  const handleWorkspaceSave = async (pairsData) => {
    if (!bcId) {
      showToast("Primero crea el Business Case", "warning");
      return;
    }

    // Validate that all pairs have primary equipment
    if (pairsData.some(p => !p.primary)) {
      showToast("Todos los grupos deben tener un equipo principal seleccionado", "warning");
      return;
    }

    try {
      console.info("[BC][EQUIPMENT][SAVE][START]", {
        bcId,
        pairsCount: pairsData.length,
        requiresBackup: pairsData.filter((pair) => pair.requiresBackup).length,
      });
      // Transform to backend format
      const payload = {
        equipment_pairs: pairsData.map(p => ({
          primary_id: p.primary.id,
          primary_type: normalizeEquipmentType(p.primary_type),
          requires_backup: Boolean(p.requiresBackup),
          backup_id: p.requiresBackup ? (p.backup?.id || null) : null,
          backup_install_simultaneous: p.backup?.install_with_primary || false,
        })),
      };

      // Use the existing equipment-details endpoint or v2 if available
      const res = await api.post(`/business-case/${bcId}/equipment-details-v2`, payload);
      console.info("[BC][EQUIPMENT][SAVE][OK]", {
        bcId,
        status: res?.status,
      });

      showToast("Equipos guardados exitosamente", "success");

      // Trigger UI guidance refresh
      onSave();

    } catch (err) {
      console.error("[BC][EQUIPMENT][SAVE][ERROR]", {
        bcId,
        message: err?.response?.data?.message || err?.message,
      });
      showToast("Error guardando equipos", "error");
      console.error("Error saving equipment:", err);
    }
  };

  // Check if user can edit equipment based on permissions
  const canEdit = permissions?.canEditEquipment !== false && ownership?.canEdit !== false;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <FiActivity className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Equipamiento</h2>
          <p className="text-sm text-gray-500">
            Seleccion y configuracion de equipos medicos
            {!canEdit && " (Solo lectura)"}
          </p>
        </div>
      </div>

      {/* Permission warning if user cannot edit */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="text-sm">
              No tienes permisos para editar esta seccion en el estado actual.
            </span>
          </div>
        </div>
      )}

      {/* Workspace wrapper for equipment selector */}
      <div className={`${!canEdit ? 'opacity-60 pointer-events-none' : ''}`}>
        <EquipmentSelectorWrapper
          equipmentPairs={equipmentPairs}
          onPairsChange={setEquipmentPairs}
          onSave={handleWorkspaceSave}
          disabled={!canEdit}
        />
      </div>

      {/* Section Actions */}
      {canEdit && (
        <div className="flex flex-col sm:flex-row sm:justify-end pt-4 border-t">
          <button
            onClick={() => handleWorkspaceSave(equipmentPairs)}
            className="bg-blue-600 text-white w-full sm:w-auto px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guardar Equipamiento
          </button>
        </div>
      )}
    </div>
  );
};

// Internal wrapper component that manages equipment selection state
const EquipmentSelectorWrapper = ({ equipmentPairs, onPairsChange, onSave, disabled }) => {
  const [currentPairs, setCurrentPairs] = useState(equipmentPairs);

  // Sync local changes back to parent state for save button
  useEffect(() => {
    if (onPairsChange) {
      onPairsChange(currentPairs);
    }
  }, [currentPairs, onPairsChange]);

  // Mock onNext to call our onSave
  const handleNext = () => {
    onSave(currentPairs);
  };

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : ''}>
      <EquipmentSelectorCore
        equipmentPairs={currentPairs}
        onUpdatePairs={setCurrentPairs}
        onSave={handleNext}
        disabled={disabled}
      />
    </div>
  );
};

// Core equipment selection logic without wizard dependencies
const EquipmentSelectorCore = ({ equipmentPairs, onUpdatePairs, onSave, disabled }) => {
  const { showToast } = useUI();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ search: "", category: "" });
  const [loading, setLoading] = useState(false);
  const [openPairs, setOpenPairs] = useState({}); // { [pairId]: boolean }

  const togglePair = (pairId) => {
    setOpenPairs(prev => ({ ...prev, [pairId]: !prev[pairId] }));
  };

  const loadEquipment = async () => {
    setLoading(true);
    try {
      console.info("[BC][EQUIPMENT][CATALOG][LOAD]", {
        search: filters.search || null,
        category: filters.category || null,
      });
      const res = await api.get("/equipment-catalog", {
        params: {
          search: filters.search || undefined,
          category: filters.category || undefined,
        },
      });
      const payload = res?.data || {};
      const parsedItems = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : [];

      const normalized = parsedItems.map((item) => {
        const id = item.equipment_id ?? item.id ?? item.equipmentId ?? null;
        const code = item.equipment_code ?? item.code ?? item.equipmentCode ?? item.sku ?? item.id_fabricante ?? null;
        const description =
          item.equipment_description ??
          item.description ??
          item.model ??
          item.modelo ??
          null;
        return {
          id,
          name: item.equipment_name ?? item.name ?? "Equipo",
          code,
          capacity: item.capacity_per_hour ?? item.capacity ?? item.max_daily_capacity ?? null,
          price: item.base_price ?? item.price ?? null,
          description,
          categories: (item.categories || [item.category || item.categoria || item.category_type]).filter(Boolean),
          raw: item,
        };
      }).filter((i) => i.id);
      setItems(normalized);
      console.info("[BC][EQUIPMENT][CATALOG][OK]", {
        count: normalized.length,
        sample: normalized[0]
          ? { id: normalized[0].id, name: normalized[0].name, code: normalized[0].code }
          : null,
      });
    } catch (err) {
      console.error("[BC][EQUIPMENT][CATALOG][ERROR]", {
        message: err?.response?.data?.message || err?.message,
      });
      showToast("No se pudo cargar el catalogo", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEquipment();
  }, []);

  // Update a specific pair
  const updatePair = (pairId, updates) => {
    const newPairs = equipmentPairs.map(p => p.id === pairId ? { ...p, ...updates } : p);
    onUpdatePairs(newPairs);
  };

  const addPair = () => {
    const maxId = equipmentPairs.length > 0 ? Math.max(...equipmentPairs.map(p => p.id)) : 0;
    const newPair = { id: maxId + 1, primary: null, primary_type: "new_available", backup: null, requiresBackup: false };
    const newPairs = [...equipmentPairs, newPair];
    onUpdatePairs(newPairs);
    setOpenPairs(prev => ({ ...prev, [newPair.id]: true }));
  };

  const removePair = (pairId) => {
    if (equipmentPairs.length <= 1) {
      showToast("Debe haber al menos un grupo de equipos", "warning");
      return;
    }
    const newPairs = equipmentPairs.filter(p => p.id !== pairId);
    onUpdatePairs(newPairs);
  };

  const normalizeSelected = (item) => {
    if (!item) return item;
    const raw = item.raw || item;
    return {
      ...item,
      code: item.code ?? raw.equipment_code ?? raw.code ?? raw.sku ?? raw.id_fabricante ?? null,
      description: item.description ?? raw.equipment_description ?? raw.description ?? raw.model ?? raw.modelo ?? null,
      name: item.name ?? raw.equipment_name ?? raw.name ?? "Equipo",
      raw,
    };
  };

  const selectPrimary = (pairId, item) => {
    const normalized = normalizeSelected(item);
    console.info("[BC][EQUIPMENT][SELECT_PRIMARY]", {
      pairId,
      id: normalized?.id,
      code: normalized?.code,
      name: normalized?.name,
      id_fabricante: normalized?.raw?.technical_specs?.id_fabricante ?? normalized?.raw?.metadata?.id_fabricante ?? null,
      raw: normalized?.raw,
    });
    updatePair(pairId, {
      primary: { ...normalized, type: normalizeEquipmentType(equipmentPairs.find((pair) => pair.id === pairId)?.primary_type) },
      primary_type: normalizeEquipmentType(equipmentPairs.find((pair) => pair.id === pairId)?.primary_type),
      backup: null,
    });
    showToast("Equipo principal seleccionado", "success");
  };

  const selectBackup = (pairId, item) => {
    const normalized = normalizeSelected(item);
    console.info("[BC][EQUIPMENT][SELECT_BACKUP]", {
      pairId,
      id: normalized?.id,
      code: normalized?.code,
      name: normalized?.name,
      id_fabricante: normalized?.raw?.technical_specs?.id_fabricante ?? normalized?.raw?.metadata?.id_fabricante ?? null,
      raw: normalized?.raw,
    });
    updatePair(pairId, {
      requiresBackup: true,
      backup: { ...normalized, condition: "Nuevo", install_with_primary: false }
    });
    showToast("Backup seleccionado", "success");
  };

  // Resolve primary/backup details once catalog is loaded
  useEffect(() => {
    if (!items.length) return;
    const updated = equipmentPairs.map(pair => {
      let primary = pair.primary;
      let backup = pair.backup;
      if (primary?.id && (!primary.name || !primary.code || !primary.description)) {
        const found = items.find(i => i.id === primary.id);
        if (found) primary = { ...found };
      }
      if (backup?.id && (!backup.name || !backup.code || !backup.description)) {
        const found = items.find(i => i.id === backup.id);
        if (found) {
          backup = {
            ...found,
            condition: backup.condition || "Nuevo",
            install_with_primary: backup.install_with_primary || false
          };
        }
      }
      return (primary !== pair.primary || backup !== pair.backup) ? { ...pair, primary, backup } : pair;
    });
    onUpdatePairs(updated);
  }, [items]);

  const getBackupCandidates = (primaryItem) => {
    if (!primaryItem || !primaryItem.categories) return [];
    return items
      .filter(i => i.id !== primaryItem.id && i.categories.some(cat => primaryItem.categories.includes(cat)))
      .sort((a, b) => {
        const nameCompare = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        if (nameCompare !== 0) return nameCompare;
        return String(a.id).localeCompare(String(b.id));
      });
  };

  // Sort equipment items deterministically
  const sortedEquipmentItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const nameCompare = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      if (nameCompare !== 0) return nameCompare;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [items]);

  // Import the UI components we need
  const { FiChevronDown, FiCpu, FiFilter, FiSearch, FiTrash2, FiPlus, FiX } = require("react-icons/fi");

  const EquipmentCard = ({ item, selected, disabled, onSelect, actionLabel, actionColor = "blue" }) => (
    <div
      className={`border rounded-2xl p-5 text-left space-y-3 transition-all duration-300 hover:shadow-md bg-white ${disabled ? "opacity-60 pointer-events-none border-gray-100" : selected ? "border-blue-500 ring-2 ring-blue-200 shadow-sm" : "border-gray-100 shadow-sm"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <FiCpu size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{item.name}</p>
            {(item.code || item.raw?.equipment_code || item.raw?.code) && (
              <p className="text-xs text-gray-500">
                Codigo: {item.code || item.raw?.equipment_code || item.raw?.code}
              </p>
            )}
            {(item.description || item.raw?.model || item.raw?.equipment_description) && (
              <p className="text-xs text-gray-500 line-clamp-2">
                {item.description || item.raw?.model || item.raw?.equipment_description}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(item.categories || []).map((cat) => (
          <span
            key={cat}
            className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-100"
          >
            {cat}
          </span>
        ))}
      </div>
      {onSelect && (
        <button
          type="button"
          onClick={() => onSelect(item)}
          className={`w-full rounded-xl bg-${actionColor}-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-${actionColor}-700 active:scale-95 transition-all shadow-sm hover:shadow-${actionColor}-200 mt-3`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );

  const AccordionSection = ({ title, description, isOpen, onToggle, statusBadge, children }) => (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 mb-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50/50 focus:outline-none"
      >
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isOpen ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'} transition-colors`}>
                <FiActivity size={18} />
            </div>
            <div>
                <p className="text-base font-bold text-gray-900">{title}</p>
                {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
            </div>
        </div>
        <div className="flex items-center gap-4">
          {statusBadge}
          <div className={`p-1.5 rounded-full ${isOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-400'} transition-all`}>
            <FiChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </div>
      </button>
      <div className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}>
        <div className="px-6 pb-6 pt-2 border-t border-gray-50">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">Seleccion de Equipos</h2>
        <button
          onClick={addPair}
          disabled={disabled}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          <FiPlus size={16} /> Agregar Grupo
        </button>
      </div>

      <div className="space-y-4">
        {equipmentPairs.map((pair, index) => (
          <AccordionSection
            key={pair.id}
            title={`Grupo de Equipos #${index + 1}`}
            description={pair.primary ? `${pair.primary.name} ${pair.backup ? '+ Backup' : ''}` : "Seleccione equipos..."}
            isOpen={openPairs[pair.id]}
            onToggle={() => togglePair(pair.id)}
            statusBadge={pair.primary ? <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-xs font-bold border border-green-100">Listo</span> : <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-bold border border-amber-100">Pendiente</span>}
          >
            <div className="space-y-6 animate-fadeIn">
              {/* Primary Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    Equipo Principal
                </h4>
                <div className="w-full sm:max-w-sm">
                  <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Tipo de equipo
                  </label>
                  <select
                    value={normalizeEquipmentType(pair.primary_type)}
                    onChange={(e) =>
                      updatePair(pair.id, {
                        primary_type: normalizeEquipmentType(e.target.value),
                        primary: pair.primary
                          ? { ...pair.primary, type: normalizeEquipmentType(e.target.value) }
                          : pair.primary,
                      })
                    }
                    disabled={disabled}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white disabled:opacity-60"
                  >
                    {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <div className="relative w-full">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        placeholder="Buscar equipos por nombre, codigo o categoria..."
                        className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white"
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        disabled={disabled}
                    />
                  </div>
                </div>

                {!pair.primary ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {sortedEquipmentItems
                      .filter(i => (i.name || "").toLowerCase().includes(filters.search.toLowerCase()))
                      .map(item => (
                      <EquipmentCard
                        key={item.id}
                        item={item}
                        actionLabel="Seleccionar Principal"
                        onSelect={(i) => selectPrimary(pair.id, i)}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="relative group">
                    <EquipmentCard item={pair.primary} selected />
                    <div className="mt-2">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {EQUIPMENT_TYPE_OPTIONS.find((option) => option.value === normalizeEquipmentType(pair.primary_type))?.label || "Nuevo"}
                      </span>
                    </div>
                    <button
                      onClick={() => updatePair(pair.id, { primary: null, backup: null, requiresBackup: false })}
                      disabled={disabled}
                      className="absolute top-4 right-4 p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:scale-95 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                      title="Cambiar equipo"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                )}
              </div>

              {/* Backup Selection */}
              {pair.primary && (
                <div className="space-y-4 border-t border-gray-100 pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        Equipo de Respaldo (Backup)
                    </h4>
                    {pair.backup && (
                      <button
                        onClick={() => updatePair(pair.id, { backup: null })}
                        disabled={disabled}
                        className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed px-2"
                      >
                        Eliminar Backup
                      </button>
                    )}
                  </div>
                  
                  <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100">
                    <label className="flex items-center gap-3 text-sm font-medium text-gray-700 cursor-pointer select-none">
                        <div className="relative flex items-center">
                            <input
                            type="checkbox"
                            checked={Boolean(pair.requiresBackup)}
                            onChange={(e) => updatePair(pair.id, { requiresBackup: e.target.checked, backup: e.target.checked ? pair.backup : null })}
                            disabled={disabled}
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-blue-500 checked:bg-blue-500 disabled:cursor-not-allowed"
                            />
                            <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        El cliente desea equipo de respaldo
                    </label>
                    <p className="text-xs text-gray-500 mt-2 ml-8">
                        No es obligatorio elegir un equipo de respaldo. Solo se selecciona si el cliente lo solicita.
                    </p>
                  </div>

                  {pair.requiresBackup && !pair.backup ? (
                    <div className="space-y-3 animate-fadeIn">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Equipos compatibles recomendados
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {getBackupCandidates(pair.primary).length > 0 ? (
                            getBackupCandidates(pair.primary).map(item => (
                                <EquipmentCard
                                key={item.id}
                                item={item}
                                actionLabel="Agregar como Backup"
                                actionColor="purple"
                                onSelect={(i) => selectBackup(pair.id, i)}
                                disabled={disabled}
                                />
                            ))
                        ) : (
                            <div className="col-span-2 text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-gray-500">No se encontraron equipos compatibles automaticamente.</p>
                            </div>
                        )}
                        </div>
                    </div>
                  ) : pair.backup ? (
                    <div className="relative group">
                        <EquipmentCard item={pair.backup} selected actionColor="purple" />
                        <button
                            onClick={() => updatePair(pair.id, { backup: null })}
                            disabled={disabled}
                            className="absolute top-4 right-4 p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:scale-95 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                            title="Cambiar backup"
                        >
                            <FiTrash2 size={18} />
                        </button>
                        
                        <div className="mt-4 bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <h5 className="font-semibold text-sm text-purple-900 mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                Configuracion de Backup
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">Condicion</label>
                                    <input
                                        value={pair.backup.condition}
                                        onChange={(e) => updatePair(pair.id, { backup: { ...pair.backup, condition: e.target.value } })}
                                        disabled={disabled}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                                    />
                                </div>
                                <div className="flex items-end pb-2">
                                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={pair.backup.install_with_primary}
                                            onChange={(e) => updatePair(pair.id, { backup: { ...pair.backup, install_with_primary: e.target.checked } })}
                                            disabled={disabled}
                                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                        />
                                        Instalar simultaneamente
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Remove Pair Button */}
              <div className="pt-4 flex justify-end border-t border-gray-50 mt-4">
                <button
                  onClick={() => removePair(pair.id)}
                  disabled={disabled || equipmentPairs.length <= 1}
                  className="flex items-center gap-2 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiTrash2 /> Eliminar Grupo
                </button>
              </div>
            </div>
          </AccordionSection>
        ))}
      </div>
    </div>
  );
};

export default EquipmentSection;
