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
    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
    onFocusCapture={() => onInteraction?.(id)}
  >
    <button
      type="button"
      onClick={() => onToggle(id)}
      aria-expanded={isOpen}
      aria-controls={`section-panel-${id}`}
      className="flex w-full items-center justify-between gap-2 px-6 py-4 text-left transition-colors hover:bg-gray-50 focus:outline-none"
    >
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        {statusBadge}
        <FiChevronDown
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </div>
    </button>
    <div
      id={`section-panel-${id}`}
      className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}
    >
      <div className="px-6 pb-6 pt-0">{children}</div>
    </div>
  </div>
);

const ClientDataSection = ({
  businessCase,
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

  // FIX: Explicit state for selected client to handle async race condition
  const [selectedClient, setSelectedClient] = useState(null);

  // FIX: Initialize form with empty values - don't set client ID until options are loaded
  const initializeForm = () => {
    if (!bcId) return;

    console.log("DEBUG: initializeForm called, businessCase:", businessCase);

    try {
      // Initialize form with empty/default values (don't set client ID yet)
      const initialData = {
        client: "", // Don't set client ID - wait for reconciliation
        clientType: businessCase?.clientType || "",
        contractingEntity: businessCase?.contractingEntity || "",
        provinceCity: businessCase?.provinceCity || "",
        processCode: businessCase?.processCode || businessCase?.process_code || "",
        contractObject: businessCase?.contractObject || businessCase?.contract_object || "",
        notes: businessCase?.notes || "",
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
      <span className={`text-xs font-semibold ${hasError ? "text-rose-500" : "text-emerald-500"}`}>
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
      className="text-[11px] text-gray-400 hover:text-gray-600 px-1 rounded transition-colors"
    >
      N/A
    </button>
  );

  const naInputClass = (field) =>
    `border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 ${
      isNA(field) ? "bg-gray-50 text-gray-500" : ""
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

  // FIX: Resolve selected client when both clients list and saved value are available
  useEffect(() => {
    if (clients.length > 0 && businessCase?.client_id) {
      const savedClientValue = businessCase.client_id;
      if (savedClientValue) {
        const clientOption = clients.find(
          (c) =>
            String(c.id) === String(savedClientValue)
        );

        if (clientOption) {
          // Use the same value format as the select options
          const selectValue = clientOption.id || clientOption.email || clientOption.identificador || clientOption.nombre || clientOption.name;
          setSelectedClient(selectValue);
          setValue("client", selectValue, { shouldDirty: false });
        }
      }
    }
  }, [clients, businessCase, setValue]);

  useEffect(() => {
    const naClientType = Boolean(naFields.clientType);
    const naProvinceCity = Boolean(naFields.provinceCity);

    if (!watchClient) {
      if (!naClientType) setValue("clientType", "", { shouldDirty: true });
      if (!naProvinceCity) setValue("provinceCity", "", { shouldDirty: true });
      return;
    }
    const selected =
      clients.find(
        (c) =>
          String(c.id) === String(watchClient) ||
          String(c.email) === String(watchClient) ||
          String(c.identificador) === String(watchClient),
      ) || null;

    const provinceCity = [selected?.shipping_city, selected?.shipping_province]
      .filter(Boolean)
      .join(", ");

    if (!naClientType) {
      setValue("clientType", selected?.client_type || "", { shouldDirty: true });
    }
    if (!naProvinceCity) {
      setValue("provinceCity", provinceCity || "", { shouldDirty: true });
    }
  }, [watchClient, clients, setValue, naFields.clientType, naFields.provinceCity]);

  const formatClientLabel = (client) =>
    client?.nombre ||
    client?.commercial_name ||
    client?.name ||
    client?.display_name ||
    client?.email ||
    client?.identificador ||
    client?.id ||
    "Cliente";

  const handleSave = async (formData) => {
    if (!bcId) {
      showToast("Primero crea el Business Case", "warning");
      return;
    }

    const selected = clients.find(
      (c) =>
        String(c.id) === String(formData.client) ||
        String(c.email) === String(formData.client) ||
        String(c.identificador) === String(formData.client),
    );

    const client_name = selected ? formatClientLabel(selected) : formData.client;
    const client_id = selected?.id && Number.isFinite(Number(selected.id)) ? Number(selected.id) : undefined;

    const metadata = {
      notes: formData.notes,
      clientType: formData.clientType,
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
    const role = permissions?.userRole || 'comercial';
    return ['comercial', 'acp_comercial', 'jefe_tecnico', 'jefe_operaciones'].includes(role);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FiCheckCircle className="text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Datos del Cliente</h2>
            <p className="text-sm text-gray-500">Cargando datos...</p>
          </div>
        </div>
        <div className="animate-pulse bg-gray-200 h-32 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <FiCheckCircle />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Datos Comerciales y Operativos</h2>
          <p className="text-sm text-gray-500">
            Captura lo necesario para que operaciones pueda continuar con el Business Case.
            {!canEdit() && " (Solo lectura)"}
          </p>
        </div>
      </div>

      {/* Permission warning */}
      {!canEdit() && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-800">
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

      <form className="space-y-6" onSubmit={handleSubmit(handleSave)}>
        <AccordionSection
          id="general"
          title="Datos comerciales"
          description="Captura los datos clave del cliente y del contrato."
          isOpen={openSections.general}
          onToggle={toggleSection}
          statusBadge={renderStatusBadge("general")}
          onInteraction={handleSectionInteraction}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <FiUsers /> Cliente
          </span>
          <select
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            {...register("client", { required: "El cliente es obligatorio" })}
            disabled={!canEdit()}
          >
            <option value="">Selecciona un cliente</option>
            {Array.isArray(clients) &&
              clients.map((client) => {
                const value =
                  client.id || client.email || client.identificador || client.nombre || client.name;
                const label =
                  client.nombre ||
                  client.commercial_name ||
                  client.name ||
                  client.display_name ||
                  client.email ||
                  client.identificador ||
                  client.id;
                return (
                  <option key={`${value}-${label}`} value={value}>
                    {label}
                  </option>
                );
              })}
          </select>
          {loadingClients && <p className="text-xs text-gray-400">Cargando clientes...</p>}
          {errors.client && <p className="text-xs text-red-500">{errors.client.message}</p>}
        </label>

        <label className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Tipo de Cliente</span>
            {renderNAButton("clientType")}
          </div>
          <input
            type="text"
            className={naInputClass("clientType")}
            readOnly={Boolean(watchClient) || isNA("clientType")}
            {...register("clientType")}
            disabled={!canEdit()}
          />
        </label>

        <label className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Entidad contratante</span>
            {renderNAButton("contractingEntity")}
          </div>
          <input
            type="text"
            className={naInputClass("contractingEntity")}
            disabled={isNA("contractingEntity") || !canEdit()}
            {...register("contractingEntity")}
          />
        </label>

        <label className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Provincia / Ciudad</span>
            {renderNAButton("provinceCity")}
          </div>
          <input
            type="text"
            className={naInputClass("provinceCity")}
            readOnly={Boolean(watchClient) || isNA("provinceCity")}
            {...register("provinceCity")}
            disabled={!canEdit()}
          />
        </label>
        <label className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Código del proceso</span>
            {renderNAButton("processCode")}
          </div>
          <input
            type="text"
            className={naInputClass("processCode")}
            disabled={isNA("processCode") || !canEdit()}
            {...register("processCode")}
          />
        </label>

        <label className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Objeto de contratación</span>
            {renderNAButton("contractObject")}
          </div>
          <input
            type="text"
            className={naInputClass("contractObject")}
            disabled={isNA("contractObject") || !canEdit()}
            {...register("contractObject")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Notas / contexto</span>
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
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-xs text-gray-500">Los cambios se guardan automáticamente al enviar el formulario.</p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
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
