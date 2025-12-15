import React, { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiCpu, FiFilter, FiSearch, FiTrash2 } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";

const DEFAULT_EQUIPMENT_CONFIG = {
  primary: null,
  backup: null,
  secondary: [],
};

const EquipmentCard = ({ item, selected, disabled }) => (
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
  </div>
);

const AccordionSection = ({ title, description, isOpen, onToggle, statusBadge, children }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
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

const HierarchyCard = ({ label, tone = "primary", children }) => {
  const palette = {
    primary: "bg-blue-50 border-blue-200 text-gray-900",
    backup: "bg-amber-50 border-amber-200 text-gray-900",
    secondary: "bg-purple-50 border-purple-200 text-gray-900",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 ${palette[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 text-sm space-y-1 text-gray-700">{children}</div>
    </div>
  );
};

const Step2EquipmentSelector = ({ onPrev, onNext }) => {
  const { state, updateState } = useBusinessCaseWizard();
  const { showToast, showLoader, hideLoader } = useUI();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ search: "", category: "" });
  const [loading, setLoading] = useState(false);
  const [equipmentConfig, setEquipmentConfig] = useState(() => {
    const saved = state.equipmentConfig || DEFAULT_EQUIPMENT_CONFIG;
    return {
      primary: saved.primary ? { ...saved.primary } : null,
      backup: saved.backup ? { ...saved.backup } : null,
      secondary: Array.isArray(saved.secondary) ? [...saved.secondary] : [],
    };
  });
  const [openSections, setOpenSections] = useState(() => ({
    primary: true,
    backup: Boolean((state.equipmentConfig || {}).backup),
    secondary: Boolean((state.equipmentConfig || {}).secondary?.length),
  }));
  const [savingCost, setSavingCost] = useState(false);

  const applyConfig = (nextConfig) => {
    const sanitized = {
      primary: nextConfig.primary ? { ...nextConfig.primary } : null,
      backup: nextConfig.backup ? { ...nextConfig.backup } : null,
      secondary: Array.isArray(nextConfig.secondary) ? [...nextConfig.secondary] : [],
    };
    setEquipmentConfig(sanitized);
    updateState({ equipmentConfig: sanitized });
  };

  const toggleSection = (sectionId) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const backupCandidates = useMemo(() => {
    const categories = equipmentConfig.primary?.categories ?? [];
    if (!categories.length) return items;
    return items.filter((item) =>
      (item.categories || []).some((cat) => categories.includes(cat)),
    );
  }, [items, equipmentConfig.primary]);

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
      const parsedItems = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.rows)
            ? payload.rows
            : Array.isArray(payload?.items?.data)
              ? payload.items.data
              : Array.isArray(payload?.records)
                ? payload.records
                : Array.isArray(payload)
                  ? payload
                  : [];
      const normalized = (Array.isArray(parsedItems) ? parsedItems : [])
        .map((item) => {
          const id =
            item.id ??
            item.equipment_id ??
            item.equipmentId ??
            item.bc_equipment_id ??
            item.bcEquipmentId ??
            item.code;
          return {
            id,
            name: item.name ?? item.equipment_name ?? item.display_name ?? "Equipo",
            code: item.code ?? item.codigo ?? item.equipment_code,
            capacity: item.capacity ?? item.capacidad ?? item.capacidad_maxima,
            price: item.price ?? item.precio ?? item.base_price,
            description: item.description ?? item.descripcion ?? item.summary,
            categories: item.categories ?? item.categorias ?? item.tags ?? [],
            raw: item,
          };
        })
        .filter((i) => i.id);
      setItems(normalized);
    } catch (err) {
      showToast("No se pudo cargar el catálogo", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrimarySelect = async (item) => {
    if (!state.businessCaseId) {
      showToast("Primero guarda los datos generales", "warning");
      setOpenSections((prev) => ({ ...prev, primary: true }));
      return;
    }
    showLoader();
    try {
      const equipmentId =
        item.id ||
        item.raw?.id ||
        item.raw?.equipment_id ||
        item.raw?.equipmentId ||
        item.raw?.bc_equipment_id ||
        item.raw?.bcEquipmentId;

      if (!equipmentId) {
        showToast("No se pudo identificar el equipo seleccionado", "error");
        return;
      }

      const suggestedCost = Number(item.price) || 0;
      await api.put(`/business-case/${state.businessCaseId}/economic-data`, {
        equipment_id: equipmentId,
        equipment_name: item.name,
        equipment_cost: suggestedCost,
      });

      applyConfig({
        ...equipmentConfig,
        primary: {
          equipment_id: equipmentId,
          name: item.name,
          cost: suggestedCost,
          source: "catalog",
          categories: item.categories,
          capacity: item.capacity,
        },
      });

      setOpenSections((prev) => ({ ...prev, primary: true }));
      showToast("Equipo principal seleccionado", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo seleccionar el equipo", "error");
    } finally {
      hideLoader();
    }
  };

  const handlePrimaryCostBlur = async (value) => {
    const numeric = Number(value) || 0;
    if (!state.businessCaseId || !equipmentConfig.primary?.equipment_id) return;
    setSavingCost(true);
    try {
      await api.put(`/business-case/${state.businessCaseId}/economic-data`, {
        equipment_id: equipmentConfig.primary.equipment_id,
        equipment_name: equipmentConfig.primary.name,
        equipment_cost: numeric,
      });
      applyConfig({
        ...equipmentConfig,
        primary: { ...equipmentConfig.primary, cost: numeric },
      });
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo actualizar el costo", "error");
    } finally {
      setSavingCost(false);
    }
  };

  const toggleBackup = () => {
    if (!equipmentConfig.primary) {
      showToast("Selecciona un equipo principal primero", "warning");
      setOpenSections((prev) => ({ ...prev, primary: true, backup: true }));
      return;
    }
    if (equipmentConfig.backup) {
      applyConfig({ ...equipmentConfig, backup: null });
    } else {
      applyConfig({
        ...equipmentConfig,
        backup: { equipment_id: null, name: "", condition: "", install_with_primary: false, source: null },
      });
    }
  };

  const assignBackup = (item) => {
    if (!equipmentConfig.backup) return;
    applyConfig({
      ...equipmentConfig,
      backup: {
        ...equipmentConfig.backup,
        equipment_id: item.id,
        name: item.name,
        source: "catalog",
      },
    });
  };

  const updateBackupField = (field, value) => {
    if (!equipmentConfig.backup) return;
    applyConfig({
      ...equipmentConfig,
      backup: { ...equipmentConfig.backup, [field]: value },
    });
  };

  const addSecondary = (item) => {
    const already = equipmentConfig.secondary.find((sec) => sec.equipment_id === item.id);
    if (already) return;
    applyConfig({
      ...equipmentConfig,
      secondary: [
        ...equipmentConfig.secondary,
        {
          equipment_id: item.id,
          name: item.name,
          purpose: "",
        },
      ],
    });
    setOpenSections((prev) => ({ ...prev, secondary: true }));
  };

  const removeSecondary = (equipmentId) => {
    applyConfig({
      ...equipmentConfig,
      secondary: equipmentConfig.secondary.filter((sec) => sec.equipment_id !== equipmentId),
    });
  };

  const updateSecondaryPurpose = (equipmentId, purpose) => {
    applyConfig({
      ...equipmentConfig,
      secondary: equipmentConfig.secondary.map((sec) =>
        sec.equipment_id === equipmentId ? { ...sec, purpose } : sec,
      ),
    });
  };

  const renderStatusBadge = (sectionId) => {
    const readyMap = {
      primary: Boolean(equipmentConfig.primary?.equipment_id),
      backup: Boolean(equipmentConfig.backup?.equipment_id),
      secondary: Boolean(equipmentConfig.secondary.length),
    };
    const ready = readyMap[sectionId];
    return (
      <span className={`text-xs font-semibold ${ready ? "text-emerald-500" : "text-amber-500"}`}>
        {ready ? "Listo" : "Pendiente"}
      </span>
    );
  };

  const handleNext = async () => {
    if (!equipmentConfig.primary?.equipment_id) {
      showToast("Selecciona un equipo principal antes de continuar", "warning");
      setOpenSections((prev) => ({ ...prev, primary: true }));
      return;
    }
    if (!state.businessCaseId) {
      showToast("Primero guarda el Business Case", "warning");
      return;
    }
    showLoader();
    try {
      const payload = {
        equipment_status: equipmentConfig.backup?.condition || null,
        ownership_status: null,
        reservation_image_url: null,
        backup_equipment_name: equipmentConfig.backup?.name || null,
        backup_status: equipmentConfig.backup?.condition || null,
        backup_manufacture_year: null,
        install_with_primary: Boolean(equipmentConfig.backup?.install_with_primary),
        installation_location: null,
        allows_provisional: false,
        requires_complementary: false,
        complementary_test_purpose: null,
      };
      await api.post(`/business-case/${state.businessCaseId}/equipment-details`, payload);
      updateState({ equipmentConfig });
      if (onNext) onNext();
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudieron guardar los detalles de equipos", "error");
    } finally {
      hideLoader();
    }
  };

  const primarySelected = equipmentConfig.primary?.equipment_id;
  const backupEnabled = Boolean(equipmentConfig.backup);

  return (
    <div className="space-y-4">
      <AccordionSection
        title="Equipo principal"
        description="Selecciona el equipo base que define capacidad, costo e impacto ROI."
        isOpen={openSections.primary}
        onToggle={() => toggleSection("primary")}
        statusBadge={renderStatusBadge("primary")}
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200"
                placeholder="Buscar equipo"
              />
            </div>
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              className="w-full md:w-auto px-3 py-2 rounded-lg border border-gray-200"
            >
              <option value="">Todas las categorías</option>
              <option value="hematologia">Hematología</option>
              <option value="quimica">Química</option>
              <option value="coagulacion">Coagulación</option>
            </select>
            <button
              type="button"
              onClick={loadEquipment}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700"
            >
              <FiFilter /> Filtrar
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Cargando catálogo...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((item) => (
                <div key={item.id} className="space-y-2">
                  <EquipmentCard
                    item={item}
                    selected={primarySelected === item.id}
                  />
                  <button
                    type="button"
                    onClick={() => handlePrimarySelect(item)}
                    className="w-full rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600"
                  >
                    Seleccionar como principal
                  </button>
                </div>
              ))}
              {!items.length && <p className="text-sm text-gray-500">No hay equipos para mostrar.</p>}
            </div>
          )}
        </div>
      </AccordionSection>

      <AccordionSection
        title="Equipo backup"
        description="Define si el cliente requiere respaldo y elige un equipo compatible."
        isOpen={openSections.backup}
        onToggle={() => toggleSection("backup")}
        statusBadge={renderStatusBadge("backup")}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">¿El cliente requiere equipo de respaldo?</p>
            <button
              type="button"
              onClick={toggleBackup}
              className={`text-sm font-semibold ${backupEnabled ? "text-blue-600" : "text-gray-500"}`}
            >
              {backupEnabled ? "Deshabilitar respaldo" : "Agregar respaldo"}
            </button>
          </div>
          {backupEnabled ? (
            <>
              <p className="text-xs text-gray-500">
                Filtrado por la categoría del equipo principal para facilitar compatibilidad.
              </p>
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {backupCandidates.map((item) => (
                  <div key={`${item.id}-backup`} className="space-y-2">
                    <EquipmentCard
                      item={item}
                      selected={equipmentConfig.backup?.equipment_id === item.id}
                    />
                    <button
                      type="button"
                      onClick={() => assignBackup(item)}
                      className="w-full rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
                    >
                      Usar como backup
                    </button>
                  </div>
                ))}
                {!backupCandidates.length && (
                  <p className="text-sm text-gray-500">No hay equipos compatibles para respaldo.</p>
                )}
              </div>
              <div className="space-y-3">
                <label className="flex flex-col gap-2 text-sm text-gray-700">
                  Estado (nuevo / usado / año)
                  <input
                    type="text"
                    value={equipmentConfig.backup?.condition || ""}
                    onChange={(e) => updateBackupField("condition", e.target.value)}
                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <SwitchField
                  label="Instalación al mismo tiempo"
                  checked={Boolean(equipmentConfig.backup?.install_with_primary)}
                  onChange={(next) => updateBackupField("install_with_primary", next)}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Activa esta sección cuando el cliente requiere un equipo de respaldo.
            </p>
          )}
        </div>
      </AccordionSection>

      <AccordionSection
        title="Equipos secundarios"
        description="Agrega equipamiento complementario para ampliar cobertura."
        isOpen={openSections.secondary}
        onToggle={() => toggleSection("secondary")}
        statusBadge={renderStatusBadge("secondary")}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Cada equipo secundario puede tener un propósito y aporta cobertura.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => (
              <div key={`${item.id}-secondary`} className="space-y-2">
                <EquipmentCard
                  item={item}
                  selected={equipmentConfig.secondary.some((sec) => sec.equipment_id === item.id)}
                  disabled={equipmentConfig.secondary.some((sec) => sec.equipment_id === item.id)}
                />
                <button
                  type="button"
                  onClick={() => addSecondary(item)}
                  disabled={equipmentConfig.secondary.some((sec) => sec.equipment_id === item.id)}
                  className="w-full rounded-lg bg-purple-500 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-600 disabled:opacity-50"
                >
                  Agregar como secundario
                </button>
              </div>
            ))}
            {!items.length && <p className="text-sm text-gray-500">No hay equipos disponibles para adicionales.</p>}
          </div>
          {equipmentConfig.secondary.length > 0 && (
            <div className="space-y-3">
              {equipmentConfig.secondary.map((sec) => (
                <div key={`secondary-${sec.equipment_id}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{sec.name}</p>
                    <button
                      type="button"
                      onClick={() => removeSecondary(sec.equipment_id)}
                      className="text-xs text-rose-600"
                    >
                      <FiTrash2 /> Eliminar
                    </button>
                  </div>
                  <label className="text-sm text-gray-700">
                    Propósito
                    <input
                      type="text"
                      value={sec.purpose || ""}
                      onChange={(e) => updateSecondaryPurpose(sec.equipment_id, e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </AccordionSection>

      <div className="space-y-3">
        <p className="text-xs uppercase text-gray-500">Resumen jerárquico</p>
        <div className="space-y-2">
          {equipmentConfig.primary ? (
            <HierarchyCard label={`Equipo principal · ${equipmentConfig.primary.name}`} tone="primary">
              <p>Capacidad base: {equipmentConfig.primary.capacity || "No especificada"}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Costo:</span>
                <input
                  ref={costRef}
                  type="number"
                  min="0"
                  value={equipmentConfig.primary.cost || ""}
                  onChange={(e) => applyConfig({
                    ...equipmentConfig,
                    primary: { ...equipmentConfig.primary, cost: Number(e.target.value) || 0 },
                  })}
                  onBlur={(e) => handlePrimaryCostBlur(e.target.value)}
                  className="w-32 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                />
                {savingCost && <span className="text-xs text-blue-600">Actualizando costo...</span>}
              </div>
              <p className="text-xs text-gray-500">
                Este valor impacta directamente el ROI, el payback y el margen del comodato. Puedes ajustar o usar la sugerencia del catálogo.
              </p>
            </HierarchyCard>
          ) : (
            <HierarchyCard label="Equipo principal" tone="primary">
              <p className="text-sm text-gray-600">Selecciona un equipo para desplegar el resumen.</p>
            </HierarchyCard>
          )}

          {equipmentConfig.backup && (
            <HierarchyCard label={`Equipo backup · ${equipmentConfig.backup.name || "Sin nombre"}`} tone="backup">
              <p>Estado: {equipmentConfig.backup.condition || "N/A"}</p>
              <p>
                Instalación simultánea: {equipmentConfig.backup.install_with_primary ? "Sí" : "No"}
              </p>
            </HierarchyCard>
          )}

          {equipmentConfig.secondary.map((sec) => (
            <HierarchyCard key={`summary-secondary-${sec.equipment_id}`} label={`Equipo secundario · ${sec.name}`} tone="secondary">
              <p>Propósito: {sec.purpose || "No definido"}</p>
            </HierarchyCard>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700"
        >
          Regresar
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white"
          disabled={!equipmentConfig.primary?.equipment_id}
        >
          Continuar
        </button>
      </div>
    </div>
  );
};

export default Step2EquipmentSelector;
