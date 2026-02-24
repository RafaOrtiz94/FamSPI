import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { FiCheckCircle, FiChevronDown, FiUsers } from "react-icons/fi";
import { useParams } from "react-router-dom";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import SectionObservationAlert from "../SectionObservationAlert";

const SECTION_FIELDS = {
  general: [
    "client",
    "clientType",
    "contractingEntity",
    "provinceCity",
    "processCode",
    "contractObject",
    "notes",
  ],
};

const SECTION_ORDER = ["general"];

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const getClientLabel = (client) =>
  client?.nombre ||
  client?.commercial_name ||
  client?.name ||
  client?.display_name ||
  client?.email ||
  client?.identificador ||
  client?.id ||
  "Cliente";

const normalizeClientType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["persona_natural", "natural", "pn"].includes(normalized)) return "persona_natural";
  if (["persona_juridica", "juridica", "jurídica", "pj", "sub_distribuidor"].includes(normalized)) {
    return "persona_juridica";
  }
  return "";
};

const isPublicPurchaseType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.includes("public");
};

const AccordionSection = ({
  id,
  title,
  description,
  isOpen,
  onToggle,
  statusBadge,
  children,
  onInteraction,
}) => (
  <div
    className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300"
    onFocusCapture={() => onInteraction?.(id)}
  >
    <button
      type="button"
      onClick={() => onToggle(id)}
      aria-expanded={isOpen}
      aria-controls={`section-panel-${id}`}
      className="flex w-full items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left transition-colors hover:bg-gray-50 focus:outline-none"
    >
      <div>
        <p className="text-base font-bold text-gray-900 tracking-tight">{title}</p>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      <div className="flex items-center gap-4">
        {statusBadge}
        <div className={`p-2 rounded-full transition-all duration-200 ${isOpen ? "bg-blue-50 text-blue-600 rotate-180" : "bg-gray-100 text-gray-500"}`}>
             <FiChevronDown size={16} />
        </div>
      </div>
    </button>
    <div
      id={`section-panel-${id}`}
      className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}
    >
      <div className="px-4 sm:px-5 pb-5 pt-0">{children}</div>
    </div>
  </div>
);

const ClientDataSection = ({
  businessCase,
  uiGuidance,
  permissions = {},
  ownership = {},
  observationData,
  onSave = () => {}
}) => {
  const { id: bcId } = useParams();
  const { showToast, showLoader, hideLoader } = useUI();
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [filteredClients, setFilteredClients] = useState([]);
  const [isNewClient, setIsNewClient] = useState(false);

  // Explicit state for selected client to handle async reconciliation
  const [selectedClient, setSelectedClient] = useState(null);
  const fallbackBusinessCase = uiGuidance?.businessCase || {};
  const bcPurchaseType = businessCase?.bc_purchase_type || fallbackBusinessCase?.bc_purchase_type || "";
  const startedAsPublic = isPublicPurchaseType(bcPurchaseType);
  const originLabel = startedAsPublic ? "Compra publica" : "Compra privada";

  // FIX: Initialize form with empty values - don't set client ID until options are loaded
  const initializeForm = () => {
    if (!bcId) return;

    console.log("DEBUG: initializeForm called, businessCase:", businessCase);

    try {
      // Initialize form with empty/default values (don't set client ID yet)
      const metadata =
        businessCase?.modern_bc_metadata ||
        fallbackBusinessCase?.modern_bc_metadata ||
        {};
      const initialData = {
        client:
          businessCase?.client_name ||
          fallbackBusinessCase?.client_name ||
          "",
        clientType:
          startedAsPublic
            ? "persona_juridica"
            : normalizeClientType(
                businessCase?.clientType ||
                fallbackBusinessCase?.clientType ||
                metadata.clientType ||
                "",
              ),
        contractingEntity:
          businessCase?.contractingEntity ||
          fallbackBusinessCase?.contractingEntity ||
          metadata.contractingEntity ||
          "",
        provinceCity:
          businessCase?.provinceCity ||
          fallbackBusinessCase?.provinceCity ||
          metadata.provinceCity ||
          "",
        processCode:
          businessCase?.processCode ||
          businessCase?.process_code ||
          fallbackBusinessCase?.processCode ||
          fallbackBusinessCase?.process_code ||
          "",
        contractObject:
          businessCase?.contractObject ||
          businessCase?.contract_object ||
          fallbackBusinessCase?.contractObject ||
          fallbackBusinessCase?.contract_object ||
          "",
        notes:
          businessCase?.notes ||
          fallbackBusinessCase?.notes ||
          metadata.notes ||
          "",
      };

      console.log("DEBUG: Initializing form with empty client field:", initialData);
      reset(initialData);

    } catch (err) {
      showToast("Error inicializando formulario", "error");
      console.error("Error initializing form:", err);
    } finally {
      setLoading(false);
    }
  };

  const defaultValues = useMemo(() => ({}), []);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm({ defaultValues });

  const [naFields, setNaFields] = useState({});
  const watchClient = watch("client");
  const watchClientType = watch("clientType");
  const [openSections, setOpenSections] = useState(() =>
    SECTION_ORDER.reduce((acc, id) => {
      acc[id] = id === "general";
      return acc;
    }, {}),
  );

  const sectionHasErrors = (sectionId) =>
    SECTION_FIELDS[sectionId]?.some((field) => Boolean(errors[field])) ?? false;

  const toggleSection = (sectionId) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleSectionInteraction = (sectionId) => {
    setOpenSections((prev) => {
      if (prev[sectionId]) return prev;
      return { ...prev, [sectionId]: true };
    });
  };

  const renderStatusBadge = (sectionId) => {
    const hasError = sectionHasErrors(sectionId);
    return (
      <span className={`text-xs font-bold px-3 py-1 rounded-full ${hasError ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
        {hasError ? "Requiere atención" : "Listo"}
      </span>
    );
  };

  const toggleNA = (field) => {
    setNaFields((prev) => {
      const next = { ...prev, [field]: !prev[field] };
      setValue(field, next[field] ? "N/A" : "", { shouldDirty: true });
      return next;
    });
  };

  const isNA = (field) => Boolean(naFields[field]);

  const renderNAButton = (field) => (
    <button
      type="button"
      onClick={() => toggleNA(field)}
      className="text-[10px] font-bold text-gray-400 hover:text-gray-600 px-2 py-0.5 rounded-md border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all"
    >
      N/A
    </button>
  );

  const naInputClass = (field) =>
    `w-full border rounded-xl px-4 py-2.5 transition-all outline-none ${
      isNA(field) 
        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
        : "bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-gray-900 placeholder-gray-400"
    }`;



  useEffect(() => {
    initializeForm();
  }, [bcId, businessCase]);

  useEffect(() => {
    SECTION_ORDER.forEach((sectionId) => {
      const hasError = SECTION_FIELDS[sectionId]?.some((field) => Boolean(errors[field]));
      if (hasError) {
        setOpenSections((prev) => {
          if (prev[sectionId]) return prev;
          return { ...prev, [sectionId]: true };
        });
      }
    });
  }, [errors]);

  const findClientByInput = (value) => {
    const needle = normalizeText(value);
    if (!needle) return null;
    return (
      clients.find((c) => String(c.id) === String(value)) ||
      clients.find((c) => normalizeText(c.email) === needle) ||
      clients.find((c) => normalizeText(c.identificador) === needle) ||
      clients.find((c) => normalizeText(getClientLabel(c)) === needle) ||
      null
    );
  };

  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const res = await api.get("/clients");
        const payload = res.data?.data ?? res.data;
        const parsedClients = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.clients)
          ? payload.clients
          : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
          ? payload
          : [];
        setClients(parsedClients);
      } catch (err) {
        console.warn("No se pudieron cargar clientes", err.message);
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, []);

  // Resolve selected client when both client list and saved values are available
  useEffect(() => {
    if (clients.length === 0) return;

    if (businessCase?.client_id) {
      const clientOption = clients.find((c) => String(c.id) === String(businessCase.client_id));
      if (clientOption) {
        const label = getClientLabel(clientOption);
        setSelectedClient(clientOption);
        setValue("client", label, { shouldDirty: false });
      }
      return;
    }

    const fromName = findClientByInput(businessCase?.client_name);
    if (fromName) {
      setSelectedClient(fromName);
      setValue("client", getClientLabel(fromName), { shouldDirty: false });
    }
  }, [clients, businessCase?.client_id, businessCase?.client_name, setValue]);

  useEffect(() => {
    const term = normalizeText(watchClient);
    if (!term) {
      setFilteredClients([]);
      setShowClientDropdown(false);
      setSelectedClient(null);
      setIsNewClient(false);
      return;
    }

    const exact = findClientByInput(watchClient);
    setSelectedClient(exact);
    setIsNewClient(Boolean(term) && !exact);

    const matches = clients
      .filter((client) => normalizeText(getClientLabel(client)).includes(term))
      .slice(0, 8);
    setFilteredClients(matches);
  }, [watchClient, clients]);

  useEffect(() => {
    const naClientType = Boolean(naFields.clientType);
    const naProvinceCity = Boolean(naFields.provinceCity);

    if (startedAsPublic) {
      setValue("clientType", "persona_juridica", { shouldDirty: true });
    }

    if (!selectedClient) {
      if (!naClientType && !startedAsPublic) setValue("clientType", "", { shouldDirty: true });
      if (!naProvinceCity) setValue("provinceCity", "", { shouldDirty: true });
      return;
    }

    const provinceCity = [selectedClient?.shipping_city, selectedClient?.shipping_province]
      .filter(Boolean)
      .join(", ");

    if (!naClientType && !startedAsPublic) {
      setValue(
        "clientType",
        normalizeClientType(
          selectedClient?.client_type ||
          selectedClient?.person_type ||
          selectedClient?.tipo_persona ||
          watchClientType,
        ),
        { shouldDirty: true },
      );
    }
    if (!naProvinceCity) {
      setValue("provinceCity", provinceCity || "", { shouldDirty: true });
    }
  }, [selectedClient, setValue, naFields.clientType, naFields.provinceCity, startedAsPublic, watchClientType]);

  const handleSave = async (formData) => {
    if (!bcId) {
      showToast("Primero crea el Business Case", "warning");
      return;
    }

    const selected = selectedClient || findClientByInput(formData.client);
    const client_name = selected ? getClientLabel(selected) : String(formData.client || "").trim();
    const client_id = selected?.id && Number.isFinite(Number(selected.id)) ? Number(selected.id) : undefined;

    const finalClientType = startedAsPublic
      ? "persona_juridica"
      : normalizeClientType(formData.clientType);

    const metadata = {
      notes: formData.notes,
      clientType: finalClientType,
      contractingEntity: formData.contractingEntity,
      provinceCity: formData.provinceCity,
    };

    showLoader();
    setSaving(true);

    try {
      console.log("DEBUG: Saving ClientDataSection", {
        bcId,
        client_id,
        client_name,
        process_code: formData.processCode || null,
        contract_object: formData.contractObject || null,
        modern_bc_metadata: metadata,
      });

      // Update business case metadata
      const response = await api.put(`/business-case/${bcId}`, {
        client_id,
        client_name,
        process_code: formData.processCode || null,
        contract_object: formData.contractObject || null,
        modern_bc_metadata: metadata,
      });

      console.log("DEBUG: Save response", response);

      showToast("Datos del cliente guardados correctamente", "success");

      // Trigger UI guidance refresh
      onSave();

    } catch (error) {
      showToast(
        error.response?.data?.message || error.message || "No se pudo guardar los datos del cliente",
        "error",
      );
    } finally {
      hideLoader();
      setSaving(false);
    }
  };

  // Check permissions based on role
  const canEdit = () => {
    const role = permissions?.userRole || "comercial";
    return [
      "comercial",
      "acp_comercial",
      "backoffice_comercial",
      "jefe_comercial",
      "jefe_tecnico",
      "jefe_operaciones",
    ].includes(role);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gray-100 rounded-xl animate-pulse">
            <FiCheckCircle className="text-gray-400" size={24} />
          </div>
          <div>
            <div className="h-5 w-48 bg-gray-200 rounded-md animate-pulse mb-2"></div>
            <div className="h-4 w-32 bg-gray-100 rounded-md animate-pulse"></div>
          </div>
        </div>
        <div className="animate-pulse bg-white border border-gray-100 h-32 rounded-2xl shadow-sm"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="p-3 rounded-xl bg-blue-50 text-blue-600 shadow-sm">
          <FiCheckCircle size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Datos Comerciales y Operativos</h2>
          <p className="text-sm text-gray-500 mt-1">
            Captura lo necesario para que operaciones pueda continuar con el Business Case.
            {!canEdit() && " (Solo lectura)"}
          </p>
          <div className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Origen del flujo: {originLabel}
          </div>
        </div>
      </div>

      {/* Permission warning */}
      {!canEdit() && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 font-medium">
            <span className="text-sm">
              No tienes permisos para editar datos del cliente en el estado actual.
            </span>
          </div>
        </div>
      )}

      {/* Observation alert for this section */}
      <SectionObservationAlert
        sectionId="general"
        observationData={observationData}
      />

      <form className="space-y-5" onSubmit={handleSubmit(handleSave)}>
        <AccordionSection
          id="general"
          title="Datos comerciales"
          description="Captura los datos clave del cliente y del contrato."
          isOpen={openSections.general}
          onToggle={toggleSection}
          statusBadge={renderStatusBadge("general")}
          onInteraction={handleSectionInteraction}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 pt-2">

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <FiUsers className="text-gray-400" /> Cliente
          </span>
          <div className="relative">
            <input
              type="text"
              className={`w-full border rounded-xl px-4 py-2.5 transition-all outline-none bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-gray-900 ${
                selectedClient ? "bg-emerald-50" : isNewClient ? "bg-blue-50" : ""
              }`}
              placeholder={loadingClients ? "Cargando clientes..." : "Escribe o selecciona un cliente"}
              disabled={!canEdit()}
              {...register("client", { required: "El cliente es obligatorio" })}
              onChange={(event) => {
                setValue("client", event.target.value, { shouldDirty: true, shouldValidate: true });
              }}
              onFocus={() => {
                if (filteredClients.length > 0) setShowClientDropdown(true);
              }}
              onBlur={() => setTimeout(() => setShowClientDropdown(false), 120)}
            />
            {selectedClient && (
              <span className="absolute right-2 top-2 rounded bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                Registrado
              </span>
            )}
            {isNewClient && !selectedClient && (
              <span className="absolute right-2 top-2 rounded bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-800">
                Nuevo
              </span>
            )}
            {showClientDropdown && filteredClients.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    className="w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      const label = getClientLabel(client);
                      setValue("client", label, { shouldDirty: true, shouldValidate: true });
                      setSelectedClient(client);
                      setIsNewClient(false);
                      setShowClientDropdown(false);
                    }}
                  >
                    <p className="text-sm font-medium text-slate-900">{getClientLabel(client)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {loadingClients && <p className="text-xs text-blue-500 font-medium ml-1">Cargando clientes...</p>}
          {errors.client && <p className="text-xs text-rose-500 font-medium ml-1">{errors.client.message}</p>}
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">Tipo de Cliente</span>
          </div>
          <select
            className="w-full border rounded-xl px-4 py-2.5 transition-all outline-none bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
            {...register("clientType", { required: "El tipo de cliente es obligatorio" })}
            disabled={!canEdit() || startedAsPublic}
          >
            <option value="">Selecciona tipo</option>
            <option value="persona_natural">Persona natural</option>
            <option value="persona_juridica">Persona juridica</option>
          </select>
          {startedAsPublic && (
            <p className="text-xs text-slate-500 ml-1">
              En compras publicas, el tipo de cliente siempre es persona juridica.
            </p>
          )}
          {errors.clientType && <p className="text-xs text-rose-500 font-medium ml-1">{errors.clientType.message}</p>}
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">Entidad contratante</span>
            {renderNAButton("contractingEntity")}
          </div>
          <input
            type="text"
            className={naInputClass("contractingEntity")}
            disabled={isNA("contractingEntity") || !canEdit()}
            {...register("contractingEntity")}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">Provincia / Ciudad</span>
            {renderNAButton("provinceCity")}
          </div>
          <input
            type="text"
            className={naInputClass("provinceCity")}
            readOnly={Boolean(selectedClient) || isNA("provinceCity")}
            {...register("provinceCity")}
            disabled={!canEdit()}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">Código del proceso</span>
            {renderNAButton("processCode")}
          </div>
          <input
            type="text"
            className={naInputClass("processCode")}
            disabled={isNA("processCode") || !canEdit()}
            {...register("processCode")}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">Objeto de contratación</span>
            {renderNAButton("contractObject")}
          </div>
          <input
            type="text"
            className={naInputClass("contractObject")}
            disabled={isNA("contractObject") || !canEdit()}
            {...register("contractObject")}
          />
        </label>
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">Notas / contexto</span>
            {renderNAButton("notes")}
          </div>
          <textarea
            rows={3}
            className={naInputClass("notes")}
            disabled={isNA("notes") || !canEdit()}
            {...register("notes")}
          />
        </label>
      </div>
        </AccordionSection>



        {/* Section Actions */}
        {canEdit() && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium">Los cambios se guardan automáticamente al enviar el formulario.</p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.99] shadow-sm transition-all disabled:opacity-60 disabled:scale-100 w-full sm:w-auto"
            >
              {saving ? "Guardando..." : "Guardar Datos del Cliente"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default ClientDataSection;
