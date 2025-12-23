import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiCpu, FiFilter, FiSearch, FiTrash2, FiPlus, FiX } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";

const DEFAULT_EQUIPMENT_PAIRS = [
  { id: Date.now(), primary: null, backup: null } // Start with one empty pair
];

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

const SwitchField = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm font-semibold text-gray-700">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-blue-600" : "bg-gray-200"}`}
      onClick={() => onChange(!checked)}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-1"}`}
      />
    </button>
  </div>
);

const Step2EquipmentSelector = ({ onPrev, onNext, hideNavigation }) => {
  const { state, updateState } = useBusinessCaseWizard();
  const { showToast, showLoader, hideLoader } = useUI();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ search: "", category: "" });
  const [loading, setLoading] = useState(false);

  // Pairs state: Array of { id, primary: {}, backup: {} }
  const [equipmentPairs, setEquipmentPairs] = useState(() => {
    return state.equipmentPairs || DEFAULT_EQUIPMENT_PAIRS;
  });

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
    setEquipmentPairs(newPairs);
    updateState({ equipmentPairs: newPairs });
  };

  const addPair = () => {
    const newPair = { id: Date.now(), primary: null, backup: null };
    const newPairs = [...equipmentPairs, newPair];
    setEquipmentPairs(newPairs);
    updateState({ equipmentPairs: newPairs });
    setOpenPairs(prev => ({ ...prev, [newPair.id]: true }));
  };

  const removePair = (pairId) => {
    if (equipmentPairs.length <= 1) {
      showToast("Debe haber al menos un grupo de equipos", "warning");
      return;
    }
    const newPairs = equipmentPairs.filter(p => p.id !== pairId);
    setEquipmentPairs(newPairs);
    updateState({ equipmentPairs: newPairs });
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
    // Filter by similar categories
    return items.filter(i => i.id !== primaryItem.id && i.categories.some(cat => primaryItem.categories.includes(cat)));
  };

  const handleNext = async () => {
    if (equipmentPairs.some(p => !p.primary)) {
      showToast("Todos los grupos deben tener un equipo principal seleccionado", "warning");
      return;
    }
    if (!state.businessCaseId) {
      showToast("Primero guarda los datos generales", "warning");
      return;
    }

    try {
      showLoader();
      // Prepare payload with list of pairs
      // Backend currently expects equipment details. 
      // We might need to update backend to accept list, or loop here.
      // For now, let's assume we send the whole structure to a new endpoint or the same one updated.
      // Since I can't edit backend right now easily to support list if it doesn't, I will try to save the MAIN (first) pair as the primary one for legacy compatibility, 
      // and save the full list in a JSON field if possible, or assume backend handles list.
      // Actually, the user asked to change the LOGIC, implying backend might need change or already supports it.
      // I will basically send the array.

      const payload = {
        equipment_pairs: equipmentPairs.map(p => ({
          primary_id: p.primary.id,
          backup_id: p.backup?.id || null,
          backup_install_simultaneous: p.backup?.install_with_primary || false,
        })),
      };

      // Note: Using a special endpoint or assuming the existing one can handle it.
      // If current backend expects 1-to-1, this calls for backend refactor.
      // I will use a new route path to be safe or just POST to equipment-details and handle in backend (I'll check backend service next).
      await api.post(`/business-case/${state.businessCaseId}/equipment-details-v2`, payload);

      updateState({ equipmentPairs });
      onNext();
    } catch (err) {
      showToast("Error guardando equipos", "error");
      console.error(err);
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-lg font-semibold text-gray-800">Selección de Equipos</h2>
        <button
          onClick={addPair}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
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
                {/* Simple Search for this pair (uses global items but could filter locally) */}
                <div className="flex gap-2 mb-2">
                  <input
                    placeholder="Filtrar..."
                    className="border rounded px-2 py-1 text-sm w-full"
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))} // Global search for simplicity
                  />
                </div>

                {!pair.primary ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {items.filter(i => i.name.toLowerCase().includes(filters.search.toLowerCase())).map(item => (
                      <EquipmentCard
                        key={item.id}
                        item={item}
                        actionLabel="Seleccionar Principal"
                        onSelect={(i) => selectPrimary(pair.id, i)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="relative">
                    <EquipmentCard item={pair.primary} selected />
                    <button
                      onClick={() => updatePair(pair.id, { primary: null, backup: null })}
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                    >
                      <FiTrash2 /> Cambiar
                    </button>
                  </div>
                )}
              </div>

              {/* Backup Selection (Only if Primary is set) */}
              {pair.primary && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-gray-700">Equipo de Respaldo (Backup)</h4>
                    {pair.backup && (
                      <button
                        onClick={() => updatePair(pair.id, { backup: null })}
                        className="text-xs text-red-500 hover:text-red-700"
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
                            className="ml-2 border rounded px-1"
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={pair.backup.install_with_primary}
                            onChange={(e) => updatePair(pair.id, { backup: { ...pair.backup, install_with_primary: e.target.checked } })}
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
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                >
                  <FiTrash2 /> Eliminar Grupo
                </button>
              </div>
            </div>
          </AccordionSection>
        ))}
      </div>

      {!hideNavigation && (
        <div className="flex justify-between pt-4">
          <button onClick={onPrev} className="px-6 py-2 rounded-lg border hover:bg-gray-50 text-gray-700">Regresar</button>
          <button onClick={handleNext} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Continuar</button>
        </div>
      )}
    </div>
  );
};

export default Step2EquipmentSelector;
