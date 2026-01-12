import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { FiActivity } from "react-icons/fi";
import Step2EquipmentSelector from "../../wizard/Step2EquipmentSelector";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";

const DEFAULT_EQUIPMENT_PAIRS = [
  { id: Date.now(), primary: null, backup: null } // Start with one empty pair
];

const EquipmentSection = ({
  businessCase,
  permissions = {},
  ownership = {},
  onSave = () => {}
}) => {
  const { id: bcId } = useParams();
  const { showToast } = useUI();

  // ONE-TIME HYDRATION GUARD
  const hydratedRef = useRef(false);

  // COMPLETE SECTION DATA - All fields from businessCase, even conditional ones
  const sectionData = useMemo(() => {
    if (!businessCase?.equipment_details) return { equipmentPairs: DEFAULT_EQUIPMENT_PAIRS };

    // Map business case equipment data to component state format
    return {
      equipmentPairs: businessCase.equipment_details.map((detail, index) => ({
        id: detail.id || Date.now() + index,
        primary: detail.primary ? {
          id: detail.primary.id,
          name: detail.primary.name,
          code: detail.primary.code,
          capacity: detail.primary.capacity,
          price: detail.primary.price,
          description: detail.primary.description,
          categories: detail.primary.categories || []
        } : null,
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
        } : null
      })) || DEFAULT_EQUIPMENT_PAIRS
    };
  }, [businessCase]);

  // Initialize state with sectionData (deterministic hydration)
  const [equipmentPairs, setEquipmentPairs] = useState(() => sectionData.equipmentPairs);

  // ONE-TIME HYDRATION: Reset equipment pairs when businessCase data is available
  useEffect(() => {
    // GUARD: Only hydrate once, when sectionData has equipment pairs and different from current
    if (!sectionData.equipmentPairs || hydratedRef.current) return;

    console.log('EquipmentSection: Hydrating with equipment pairs:', sectionData.equipmentPairs);
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
      // Transform to backend format
      const payload = {
        equipment_pairs: pairsData.map(p => ({
          primary_id: p.primary.id,
          backup_id: p.backup?.id || null,
          backup_install_simultaneous: p.backup?.install_with_primary || false,
        })),
      };

      // Use the existing equipment-details endpoint or v2 if available
      await api.post(`/business-case/${bcId}/equipment-details-v2`, payload);

      showToast("Equipos guardados exitosamente", "success");

      // Trigger UI guidance refresh
      onSave();

    } catch (err) {
      showToast("Error guardando equipos", "error");
      console.error("Error saving equipment:", err);
    }
  };

  // Check if user can edit equipment based on permissions
  const canEdit = permissions?.canEditEquipment !== false && ownership?.canEdit !== false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FiActivity className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Equipamiento</h2>
          <p className="text-sm text-gray-500">
            Selección y configuración de equipos médicos
            {!canEdit && " (Solo lectura)"}
          </p>
        </div>
      </div>

      {/* Permission warning if user cannot edit */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="text-sm">
              No tienes permisos para editar esta sección en el estado actual.
            </span>
          </div>
        </div>
      )}

      {/* Workspace wrapper for equipment selector */}
      <div className={`${!canEdit ? 'opacity-60 pointer-events-none' : ''}`}>
        <EquipmentSelectorWrapper
          equipmentPairs={equipmentPairs}
          onSave={handleWorkspaceSave}
          disabled={!canEdit}
        />
      </div>

      {/* Section Actions */}
      {canEdit && (
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={() => handleWorkspaceSave(equipmentPairs)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guardar Equipamiento
          </button>
        </div>
      )}
    </div>
  );
};

// Internal wrapper component that manages state and adapts Step2EquipmentSelector
const EquipmentSelectorWrapper = ({ equipmentPairs, onSave, disabled }) => {
  const [currentPairs, setCurrentPairs] = useState(equipmentPairs);
  const { showToast } = useUI();

  // Mock wizard context for Step2EquipmentSelector
  const mockWizardContext = {
    state: {
      equipmentPairs: currentPairs,
      businessCaseId: null // Not needed for workspace
    },
    updateState: (updates) => {
      if (updates.equipmentPairs) {
        setCurrentPairs(updates.equipmentPairs);
      }
    }
  };

  // Mock onNext to call our onSave
  const handleNext = () => {
    onSave(currentPairs);
  };

  // Mock onPrev (not used in workspace)
  const handlePrev = () => {
    // No action needed in workspace
  };

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : ''}>
      {/* We need to provide the wizard context somehow. Since we can't modify Step2EquipmentSelector,
          we'll need to create a minimal context provider or use a different approach.

          For now, let's create a simplified version that reuses the core logic but without wizard dependencies. */}
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
      const res = await api.get("/equipment-catalog", {
        params: {
          search: filters.search || undefined,
          category: filters.category || undefined,
        },
      });
      const payload = res.data?.data ?? res.data;
      const parsedItems = Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload) ? payload : []);

      const normalized = parsedItems.map((item) => {
        const id = item.id ?? item.equipment_id ?? item.equipmentId ?? item.code;
        return {
          id,
          name: item.name ?? item.equipment_name ?? "Equipo",
          code: item.code,
          capacity: item.capacity,
          price: item.price,
          description: item.description,
          categories: item.categories ?? [item.category || item.categoria || item.category_type].filter(Boolean),
          raw: item,
        };
      }).filter((i) => i.id);
      setItems(normalized);
    } catch (err) {
      showToast("No se pudo cargar el catálogo", "error");
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
    const newPair = { id: maxId + 1, primary: null, backup: null };
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

  const selectPrimary = (pairId, item) => {
    updatePair(pairId, {
      primary: { ...item },
      backup: null,
    });
    showToast("Equipo principal seleccionado", "success");
  };

  const selectBackup = (pairId, item) => {
    updatePair(pairId, {
      backup: { ...item, condition: "Nuevo", install_with_primary: false }
    });
    showToast("Backup seleccionado", "success");
  };

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
      className={`border rounded-xl p-4 text-left space-y-2 transition hover:shadow ${disabled ? "opacity-60 pointer-events-none border-gray-200" : selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <FiCpu />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{item.name}</p>
            <p className="text-xs text-gray-500">{item.code || "Sin código"}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-700">Capacidad: {item.capacity || "-"}</p>
          <p className="text-sm text-gray-700">Precio: ${item.price ?? "-"}</p>
        </div>
      </div>
      <p className="text-xs text-gray-600">{item.description || "Sin descripción"}</p>
      <div className="flex flex-wrap gap-1">
        {(item.categories || []).map((cat) => (
          <span
            key={cat}
            className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200"
          >
            {cat}
          </span>
        ))}
      </div>
      {onSelect && (
        <button
          type="button"
          onClick={() => onSelect(item)}
          className={`w-full rounded-lg bg-${actionColor}-500 px-3 py-2 text-xs font-semibold text-white hover:bg-${actionColor}-600 mt-2`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );

  const AccordionSection = ({ title, description, isOpen, onToggle, statusBadge, children }) => (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm mb-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-6 py-4 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none"
      >
        <div>
          <p>{title}</p>
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          {statusBadge}
          <FiChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>
      <div className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}>
        <div className="px-6 pb-6 pt-0">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-lg font-semibold text-gray-800">Selección de Equipos</h2>
        <button
          onClick={addPair}
          disabled={disabled}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiPlus /> Agregar Grupo de Equipos
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
            statusBadge={pair.primary ? <span className="text-green-600 text-xs font-bold">Listo</span> : <span className="text-amber-600 text-xs">Pendiente</span>}
          >
            <div className="space-y-6">
              {/* Primary Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">Equipo Principal</h4>
                <div className="flex gap-2 mb-2">
                  <input
                    placeholder="Filtrar..."
                    className="border rounded px-2 py-1 text-sm w-full"
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    disabled={disabled}
                  />
                </div>

                {!pair.primary ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {sortedEquipmentItems.filter(i => i.name.toLowerCase().includes(filters.search.toLowerCase())).map(item => (
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
                  <div className="relative">
                    <EquipmentCard item={pair.primary} selected />
                    <button
                      onClick={() => updatePair(pair.id, { primary: null, backup: null })}
                      disabled={disabled}
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiTrash2 /> Cambiar
                    </button>
                  </div>
                )}
              </div>

              {/* Backup Selection */}
              {pair.primary && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-gray-700">Equipo de Respaldo (Backup)</h4>
                    {pair.backup && (
                      <button
                        onClick={() => updatePair(pair.id, { backup: null })}
                        disabled={disabled}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Eliminar Backup
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Mostrando equipos con características similares (mismas categorías).
                  </p>

                  {!pair.backup ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                      {getBackupCandidates(pair.primary).map(item => (
                        <EquipmentCard
                          key={item.id}
                          item={item}
                          actionLabel="Agregar como Backup"
                          actionColor="amber"
                          onSelect={(i) => selectBackup(pair.id, i)}
                          disabled={disabled}
                        />
                      ))}
                      {getBackupCandidates(pair.primary).length === 0 && (
                        <p className="text-sm text-gray-500 italic">No se encontraron equipos similares.</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                      <h5 className="font-semibold text-sm text-amber-900">{pair.backup.name}</h5>
                      <div className="mt-2 text-xs space-y-2">
                        <label className="block">
                          Condición:
                          <input
                            value={pair.backup.condition}
                            onChange={(e) => updatePair(pair.id, { backup: { ...pair.backup, condition: e.target.value } })}
                            disabled={disabled}
                            className="ml-2 border rounded px-1 disabled:opacity-50"
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={pair.backup.install_with_primary}
                            onChange={(e) => updatePair(pair.id, { backup: { ...pair.backup, install_with_primary: e.target.checked } })}
                            disabled={disabled}
                          />
                          Instalar simultáneamente
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Remove Pair Button */}
              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => removePair(pair.id)}
                  disabled={disabled || equipmentPairs.length <= 1}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
