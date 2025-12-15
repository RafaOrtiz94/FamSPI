import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { FiCalendar, FiCheckCircle, FiChevronDown, FiPlus, FiTrash2, FiUsers } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";

const INITIAL_INTERFACE = { model: "", provider: "" };

const numberOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

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
  lab: [
    "labWorkDaysPerWeek",
    "labShiftsPerDay",
    "labHoursPerShift",
    "labQualityControlsPerShift",
    "labControlLevels",
    "labRoutineQCFrequency",
    "labSpecialTests",
    "labSpecialQCFrequency",
    "lisMonthlyPatients",
  ],
  lis: [
    "lisIncludes",
    "lisProvider",
    "lisIncludesHardware",
    "lisMonthlyPatients",
    "lisInterfaceSystem",
    "lisInterfaceProvider",
    "lisInterfaceHardware",
  ],
  requirements: [
    "requirementsDeadlineMonths",
    "requirementsProjectedDeadlineMonths",
    "deliveryType",
    "effectiveDetermination",
  ],
};

const SECTION_ORDER = ["general", "lab", "lis", "requirements"];

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

const Step1GeneralData = ({ onNext }) => {
  const { state, updateState } = useBusinessCaseWizard();
  const { showToast, showLoader, hideLoader } = useUI();
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [interfaces, setInterfaces] = useState(() => {
    if (Array.isArray(state.lisInterfaces) && state.lisInterfaces.length > 0) {
      return state.lisInterfaces;
    }
    return [INITIAL_INTERFACE];
  });

  const defaultValues = useMemo(() => state.generalData, [state.generalData]);

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
        {hasError ? "Requiere atenci贸n" : "Listo"}
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
    reset(defaultValues);
  }, [defaultValues, reset]);

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
    if (!state.bcType) return;
    const mode = state.bcType === "comodato_publico" ? "monthly" : "annual";
    if (state.calculationMode === mode) return;
    updateState({ calculationMode: mode });
  }, [state.bcType, state.calculationMode, updateState]);

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

  const persistInterfaces = (nextList) => {
    if (!nextList.length) {
      nextList = [INITIAL_INTERFACE];
    }
    setInterfaces(nextList);
    updateState({ lisInterfaces: nextList });
  };

  const addInterfaceRow = () => {
    persistInterfaces([...interfaces, { ...INITIAL_INTERFACE }]);
  };

  const removeInterfaceRow = (index) => {
    persistInterfaces(interfaces.filter((_, idx) => idx !== index));
  };

  const handleInterfaceChange = (index, field, value) => {
    persistInterfaces(
      interfaces.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    );
  };

  const formatClientLabel = (client) =>
    client?.nombre ||
    client?.commercial_name ||
    client?.name ||
    client?.display_name ||
    client?.email ||
    client?.identificador ||
    client?.id ||
    "Cliente";

  const persistOperationalSections = async (bcId, formData) => {
    const labPayload = {
      work_days_per_week: numberOrNull(formData.labWorkDaysPerWeek),
      shifts_per_day: numberOrNull(formData.labShiftsPerDay),
      hours_per_shift: numberOrNull(formData.labHoursPerShift),
      quality_controls_per_shift: numberOrNull(formData.labQualityControlsPerShift),
      control_levels: formData.labControlLevels || null,
      routine_qc_frequency: formData.labRoutineQCFrequency || null,
      special_tests: formData.labSpecialTests || null,
      special_qc_frequency: formData.labSpecialQCFrequency || null,
    };

    const lisPayload = {
      includes_lis: Boolean(formData.lisIncludes),
      lis_provider: formData.lisProvider || null,
      includes_hardware: Boolean(formData.lisIncludesHardware),
      monthly_patients: numberOrNull(formData.lisMonthlyPatients),
      current_system_name: formData.lisInterfaceSystem || null,
      current_system_provider: formData.lisInterfaceProvider || null,
      current_system_hardware: formData.lisInterfaceHardware || null,
    };

    const requirementsPayload = {
      deadline_months: numberOrNull(formData.requirementsDeadlineMonths),
      projected_deadline_months: numberOrNull(formData.requirementsProjectedDeadlineMonths),
    };

    const deliveriesPayload = {
      delivery_type: formData.deliveryType || "total",
      effective_determination: Boolean(formData.effectiveDetermination),
    };

    const calls = [
      api.post(`/business-case/${bcId}/lab-environment`, labPayload),
      api.post(`/business-case/${bcId}/lis-integration`, lisPayload),
      api.post(`/business-case/${bcId}/requirements`, requirementsPayload),
      api.post(`/business-case/${bcId}/deliveries`, deliveriesPayload),
    ];

    await Promise.all(calls);

    const validInterfaces = interfaces.filter((item) => item.model || item.provider);
    if (validInterfaces.length) {
      await Promise.all(
        validInterfaces.map((iface) =>
          api.post(`/business-case/${bcId}/lis-integration/equipment-interfaces`, {
            model: iface.model,
            provider: iface.provider,
          }),
        ),
      );
    }
  };

  const handleSave = async (formData) => {
    const selected = clients.find(
      (c) =>
        String(c.id) === String(formData.client) ||
        String(c.email) === String(formData.client) ||
        String(c.identificador) === String(formData.client),
    );

    const client_name = selected ? formatClientLabel(selected) : formData.client;
    const client_id = selected?.id && Number.isFinite(Number(selected.id)) ? Number(selected.id) : undefined;
    const bc_type = state.bcType || "comodato_publico";
    const metadata = {
      notes: formData.notes,
      clientType: formData.clientType,
      contractingEntity: formData.contractingEntity,
      provinceCity: formData.provinceCity,
    };

    const economicPayload = {
      client_id,
      client_name,
      bc_type,
      duration_years: Number(state.generalData.durationYears) || 3,
      target_margin_percentage: Number(state.generalData.targetMargin) || 25,
      process_code: formData.processCode || null,
      contract_object: formData.contractObject || null,
      calculation_mode: state.calculationMode,
      equipment_id: null,
      equipment_name: null,
      equipment_cost: 0,
      created_by: "system",
      modern_bc_metadata: metadata,
    };

    let bcId = state.businessCaseId;
    showLoader();
    setSaving(true);

    try {
      if (!bcId) {
        const res = await api.post("/business-case/orchestrator/create-economic", economicPayload);
        bcId =
          res.data?.data?.id ||
          res.data?.id ||
          res.data?.businessCaseId ||
          res.data?.data?.businessCaseId ||
          res.data?.data?.business_case_id;
        if (!bcId) {
          throw new Error("No se recibi贸 el identificador del Business Case");
        }
      } else {
        await api.put(`/business-case/${bcId}`, {
          client_id,
          client_name,
          bc_purchase_type: bc_type === "comodato_privado" ? "private_comodato" : "public",
          modern_bc_metadata: metadata,
        });
      }

      await persistOperationalSections(bcId, formData);

      updateState({
        businessCaseId: bcId,
        bcType: bc_type,
        generalData: { ...state.generalData, ...formData },
        lisInterfaces: interfaces,
      });

      showToast("Datos guardados correctamente", "success");
      if (onNext) onNext();
    } catch (error) {
      showToast(
        error.response?.data?.message || error.message || "No se pudo guardar el Business Case",
        "error",
      );
    } finally {
      hideLoader();
      setSaving(false);
    }
  };

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
          </p>
        </div>
      </div>

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
            disabled={isNA("contractingEntity")}
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
          />
        </label>
        <label className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">C贸digo del proceso</span>
            {renderNAButton("processCode")}
          </div>
          <input
            type="text"
            className={naInputClass("processCode")}
            disabled={isNA("processCode")}
            {...register("processCode")}
          />
        </label>

        <label className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Objeto de contrataci贸n</span>
            {renderNAButton("contractObject")}
          </div>
          <input
            type="text"
            className={naInputClass("contractObject")}
            disabled={isNA("contractObject")}
            {...register("contractObject")}
          />
        </label>

      </div>
        <label className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Notas / contexto</span>
            {renderNAButton("notes")}
          </div>
          <textarea
            rows={3}
            className={naInputClass("notes")}
            disabled={isNA("notes")}
            {...register("notes")}
          />
        </label>
        </AccordionSection>

        <AccordionSection
          id="lab"
          title="Ambiente de laboratorio"
          description="Describe turnos, controles y pruebas."
          isOpen={openSections.lab}
          onToggle={toggleSection}
          statusBadge={renderStatusBadge("lab")}
          onInteraction={handleSectionInteraction}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <FiUsers />
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Ambiente de laboratorio</p>
                <h3 className="text-sm font-semibold text-gray-900">Datos operativos</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">D韆s/semana</span>
                <input
                  type="number"
                  min="0"
                  {...register("labWorkDaysPerWeek")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Turnos/d韆</span>
                <input
                  type="number"
                  min="0"
                  {...register("labShiftsPerDay")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Horas/turno</span>
                <input
                  type="number"
                  min="0"
                  {...register("labHoursPerShift")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Controles/turno</span>
                <input
                  type="number"
                  min="0"
                  {...register("labQualityControlsPerShift")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Niveles de control</span>
                <input
                  type="text"
                  {...register("labControlLevels")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Frecuencia QC rutina</span>
                <input
                  type="text"
                  {...register("labRoutineQCFrequency")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Pruebas especiales</span>
                <input
                  type="text"
                  {...register("labSpecialTests")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Frecuencia QC pruebas especiales</span>
                <input
                  type="text"
                  {...register("labSpecialQCFrequency")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Pacientes mensuales</span>
                <input
                  type="number"
                  min="0"
                  {...register("lisMonthlyPatients")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>
        </AccordionSection>
        <AccordionSection
          id="lis"
          title="LIS e interfaces"
          description="Integra la tecnolog铆a LIS y sus interfaces asociadas."
          isOpen={openSections.lis}
          onToggle={toggleSection}
          statusBadge={renderStatusBadge("lis")}
          onInteraction={handleSectionInteraction}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <FiCalendar />
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">LIS e interfaces</p>
                <h3 className="text-sm font-semibold text-gray-900">Integraci贸n tecnol贸gica</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Incluye LIS</span>
                <input type="checkbox" {...register("lisIncludes")} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Proveedor del sistema</span>
                <input
                  type="text"
                  {...register("lisProvider")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Incluye hardware?</span>
                <input type="checkbox" {...register("lisIncludesHardware")} />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Sistema actual</span>
                <input
                  type="text"
                  {...register("lisInterfaceSystem")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Proveedor del sistema actual</span>
                <input
                  type="text"
                  {...register("lisInterfaceProvider")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Incluye hardware</span>
                <input
                  type="text"
                  {...register("lisInterfaceHardware")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Interfaces de equipos (modelo / proveedor)</p>
                <button
                  type="button"
                  onClick={addInterfaceRow}
                  className="inline-flex items-center gap-1 text-xs text-blue-600"
                >
                  <FiPlus /> Agregar
                </button>
              </div>
              <div className="space-y-2">
                {interfaces.map((iface, index) => (
                  <div key={`${iface.model}-${iface.provider}-${index}`} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={iface.model}
                      onChange={(e) => handleInterfaceChange(index, "model", e.target.value)}
                      placeholder="Modelo / Serie"
                      className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={iface.provider}
                      onChange={(e) => handleInterfaceChange(index, "provider", e.target.value)}
                      placeholder="Proveedor"
                      className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeInterfaceRow(index)}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs text-rose-500"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AccordionSection>
        <AccordionSection
          id="requirements"
          title="Requerimientos & entregas"
          description="Plazos y tipo de entrega del proyecto."
          isOpen={openSections.requirements}
          onToggle={toggleSection}
          statusBadge={renderStatusBadge("requirements")}
          onInteraction={handleSectionInteraction}
        >
          <div className="space-y-3">
            <p className="text-xs uppercase text-gray-500">Requerimientos & entregas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Plazo (meses)</span>
                <input
                  type="number"
                  min="0"
                  {...register("requirementsDeadlineMonths")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Proyecci贸n de plazo (meses)</span>
                <input
                  type="number"
                  min="0"
                  {...register("requirementsProjectedDeadlineMonths")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-700">Tipo de entrega</span>
                <select
                  {...register("deliveryType")}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="total">Total</option>
                  <option value="partial_time">Parcial en tiempo</option>
                  <option value="partial_on_demand">Parcial a necesidad</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" {...register("effectiveDetermination")} />
                <span className="text-sm font-semibold text-gray-700">Determinaci贸n efectiva</span>
              </label>
            </div>
          </div>
        </AccordionSection>

        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">Los datos se guardan en un borrador local autom谩ticamente.</p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar y continuar"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Step1GeneralData;