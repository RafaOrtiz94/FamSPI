import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiExternalLink,
  FiRefreshCw,
  FiSend,
  FiPlus,
  FiClipboard,
  FiDatabase,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import {
  addBusinessCaseItem,
  getBusinessCaseOptions,
  listBusinessCaseItems,
  listEquipmentPurchases,
  updateBusinessCaseFields,
} from "../../../core/api/equipmentPurchasesApi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import Modal from "../../../core/ui/components/Modal";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/useUI";

const BOOLEAN_OPTIONS = ["SI", "NO"];

const COMMERCIAL_FIELDS = [
  { label: "TIPO DE CLIENTE", optionsKey: "client_types" },
  { label: "ENTIDAD CONTRATANTE", optionsKey: "contract_entities" },
  { label: "CLIENTE", optionsKey: "clients" },
  { label: "Provincia /Ciudad", optionsKey: "locations" },
  { label: "Código del Proceso", optionsKey: "bc_codes" },
  { label: "Objeto de contratación", optionsKey: "bc_objects", type: "textarea" },
  { label: "Número de días por semana que trabaja el laboratorio", type: "number" },
  { label: "Turnos por dia", type: "number" },
  { label: "Horas por turno", type: "number" },
  { label: "Controles de calidad por turno", type: "number" },
  { label: "Niveles de Control" },
  { label: "Frecuencia de controles de calidad  (Rutina)" },
  { label: "Pruebas Especiales" },
  { label: "Frecuencia de controles de calidad pruebas especiales" },
  { label: "Nombre de Equipo Principal", optionsKey: "equipment_names" },
  { label: "Estado de equipo principal (nuevo / usado/ año de fabricación) TDR" },
  { label: "Estado de equipo: Propio / Alquilado /Nuevo /Reservado/ Serie (FAM)" },
  { label: "Imagen reserva de equipo" },
  { label: "Nombre de Equipo Back up", optionsKey: "equipment_names" },
  { label: "Estado de equipo back up (nuevo / usado/ año de fabricación)" },
  { label: "Se debe instalar a la par del equipo principal? SI/NO", optionsKey: "boolean" },
  { label: "Ubicación de los equipos a instalar" },
  { label: "Permite equipo provisional", optionsKey: "boolean" },
  { label: "Requiere equipo complementario) SI/NO", optionsKey: "boolean" },
  { label: "Equipo complementario, para que prueba", optionsKey: "equipment_names" },
  { label: "Incluye LIS : Si / No", optionsKey: "boolean" },
  { label: "Proveedor del sistema a trabajar", optionsKey: "lis_providers" },
  { label: "Incluye Hadware: Si/No", optionsKey: "boolean" },
  { label: "Número de pacientes MENSUAL", type: "number" },
  { label: "Interfaz a sistema actual", optionsKey: "boolean" },
  { label: "Nombre del sistema", optionsKey: "lis_systems" },
  { label: "Proveedor", optionsKey: "lis_providers" },
  { label: "Incluye Hadware: Si/No ", optionsKey: "boolean" },
  { label: "Interfaz de equipos" },
  { label: "Modelo / Proveedor", optionsKey: "equipment_names" },
  { label: "Modelo / Proveedor ", optionsKey: "equipment_names" },
  { label: "Modelo / Proveedor  ", optionsKey: "equipment_names" },
  { label: "Plazo" },
  { label: "Proyección de plazo" },
  { label: "Total/Parcial - tiempo/Parcial a necesidad del laboratorio" },
  { label: "Determinacion Efectiva Si/No", optionsKey: "boolean" },
];

const ACP_FIELDS = [
  { label: "Presupuesto Referencial de proceso" },
  { label: "Observaciones", type: "textarea" },
];

const GERENCIA_FIELDS = [
  { label: "Cobro de arriendo de equipamento" },
  { label: "Compromiso de compra" },
];

const OPERATIONS_FIELDS = [{ label: "Observaciones de Jefe de Operaciones", type: "textarea" }];

const ROLE_FIELD_MAP = {
  comercial: COMMERCIAL_FIELDS.map((f) => f.label),
  acp_comercial: ACP_FIELDS.map((f) => f.label),
  gerencia_general: GERENCIA_FIELDS.map((f) => f.label),
  jefe_operaciones: OPERATIONS_FIELDS.map((f) => f.label),
  jefe_tecnico: COMMERCIAL_FIELDS.map((f) => f.label),
};

const STAGE_LABELS = {
  pending_comercial: { label: "Pendiente Comercial", className: "bg-amber-100 text-amber-700" },
  pending_managerial: { label: "Pendiente ACP + Gerencia", className: "bg-blue-100 text-blue-700" },
  investments: { label: "Inversiones adicionales", className: "bg-emerald-100 text-emerald-700" },
};

const STATUS_LABELS = {
  waiting_proforma: "Esperando proforma",
  proforma_received: "Proforma recibida",
  waiting_signed_proforma: "Esperando proforma firmada",
  pending_contract: "Pendiente contrato",
  completed: "Completado",
};

const INVESTMENT_ROLES = new Set(["comercial", "acp_comercial", "jefe_tecnico", "jefe_operaciones"]);

const FieldInput = ({
  field,
  value,
  onChange,
  options,
}) => {
  const resolvedOptions = useMemo(() => {
    if (field.optionsKey === "boolean") return BOOLEAN_OPTIONS;
    return options?.[field.optionsKey] || [];
  }, [field.optionsKey, options]);

  const handleChange = (val) => {
    if (val === "__custom__") {
      const custom = window.prompt("Ingresa el nuevo valor");
      if (custom) onChange(custom);
      return;
    }
    onChange(val);
  };

  if (resolvedOptions?.length) {
    return (
      <select
        value={value ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
      >
        <option value="">Selecciona</option>
        {resolvedOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option value="__custom__">Otro / Nuevo valor</option>
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
        placeholder={field.placeholder || field.label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
      placeholder={field.placeholder || field.label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

const BusinessCaseWidget = ({ title = "Business Case", compact = false, showCommercialStartCards = false }) => {
  const { user } = useAuth();
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [itemsByRequest, setItemsByRequest] = useState({});
  const [itemsLoading, setItemsLoading] = useState({});
  const [newItem, setNewItem] = useState({});
  const [activeForm, setActiveForm] = useState(null);
  const [bcOptions, setBcOptions] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const normalizedRole = useMemo(() => (user?.role || "").toLowerCase(), [user]);

  const allowedLabels = useMemo(() => {
    const base = COMMERCIAL_FIELDS.map((f) => f.label);
    return new Set(ROLE_FIELD_MAP[normalizedRole] || base);
  }, [normalizedRole]);

  const canEditPrices = normalizedRole === "jefe_operaciones";
  const canHandleInvestments = INVESTMENT_ROLES.has(normalizedRole) || canEditPrices;

  const buildDraftFromRequest = (req) => {
    const extra = req.extra || {};
    return {
      "TIPO DE CLIENTE": extra.tipo_cliente || "",
      "ENTIDAD CONTRATANTE": extra.entidad_contratante || "",
      CLIENTE: req.client_name || "",
      "Provincia /Ciudad": extra.ciudad || extra.provincia || "",
      "Código del Proceso": extra.codigo_proceso || "",
      "Objeto de contratación": extra.objeto_contratacion || "",
      "Número de días por semana que trabaja el laboratorio": extra.dias_lab || "",
      "Turnos por dia": extra.turnos_dia || "",
      "Horas por turno": extra.horas_turno || "",
      "Controles de calidad por turno": extra.controles_por_turno || "",
      "Niveles de Control": extra.niveles_control || "",
      "Frecuencia de controles de calidad  (Rutina)": extra.frecuencia_calidad || "",
      "Pruebas Especiales": extra.pruebas_especiales || "",
      "Frecuencia de controles de calidad pruebas especiales": extra.frecuencia_especiales || "",
      "Nombre de Equipo Principal": extra.equipo_principal || "",
      "Estado de equipo principal (nuevo / usado/ año de fabricación) TDR": extra.estado_equipo_principal || "",
      "Estado de equipo: Propio / Alquilado /Nuevo /Reservado/ Serie (FAM)": extra.estado_equipo_propiedad || "",
      "Imagen reserva de equipo": extra.imagen_reserva_equipo || "",
      "Nombre de Equipo Back up": extra.equipo_backup || "",
      "Estado de equipo back up (nuevo / usado/ año de fabricación)": extra.estado_equipo_backup || "",
      "Se debe instalar a la par del equipo principal? SI/NO": extra.backup_paralelo || "",
      "Ubicación de los equipos a instalar": extra.ubicacion_equipos || "",
      "Permite equipo provisional": extra.permite_equipo_provisional || "",
      "Requiere equipo complementario) SI/NO": extra.requiere_equipo_complementario || "",
      "Equipo complementario, para que prueba": extra.equipo_complementario_para || "",
      "Incluye LIS : Si / No": extra.incluye_lis || "",
      "Proveedor del sistema a trabajar": extra.proveedor_lis || "",
      "Incluye Hadware: Si/No": extra.incluye_hardware || "",
      "Número de pacientes MENSUAL": extra.pacientes_mensual || "",
      "Interfaz a sistema actual": extra.interfaz_sistema_actual || "",
      "Nombre del sistema": extra.nombre_sistema || "",
      Proveedor: extra.proveedor_sistema || "",
      "Incluye Hadware: Si/No ": extra.incluye_hardware_actual || "",
      "Interfaz de equipos": extra.interfaz_equipos || "",
      "Modelo / Proveedor": extra.interfaz_modelo_1 || "",
      "Modelo / Proveedor ": extra.interfaz_modelo_2 || "",
      "Modelo / Proveedor  ": extra.interfaz_modelo_3 || "",
      Plazo: extra.plazo || "",
      "Proyección de plazo": extra.proyeccion_plazo || "",
      "Total/Parcial - tiempo/Parcial a necesidad del laboratorio": extra.entregas_plan || "",
      "Determinacion Efectiva Si/No": extra.determinacion_efectiva || "",
      "Cobro de arriendo de equipamento": extra.cobro_arriendo || "",
      "Compromiso de compra": extra.compromiso_compra || "",
      "Presupuesto Referencial de proceso": extra.presupuesto_referencial || "",
      Observaciones: extra.observaciones || "",
      "Observaciones de Jefe de Operaciones": extra.observaciones_operaciones || "",
    };
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await listEquipmentPurchases();
      setRequests(data || []);
      const nextDrafts = {};
      (data || []).forEach((req) => {
        nextDrafts[req.id] = buildDraftFromRequest(req);
      });
      setDrafts(nextDrafts);
    } catch (error) {
      console.error(error);
      showToast("No se pudieron cargar los Business Case", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    setOptionsLoading(true);
    try {
      const data = await getBusinessCaseOptions();
      setBcOptions(data || {});
    } catch (error) {
      console.error(error);
      showToast("No se pudieron cargar las listas para el Business Case", "error");
    } finally {
      setOptionsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    loadOptions();
  }, []);

  const filteredRequests = useMemo(() => {
    const q = (query || "").toLowerCase();
    const bcReady = requests.filter((req) => req.status && req.status !== "pending_provider_assignment");
    if (!q) return bcReady;
    return bcReady.filter((req) =>
      [req.client_name, req.assigned_to_name, req.assigned_to_email, req.provider_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [query, requests]);

  const visibleRequests = compact ? filteredRequests.slice(0, 3) : filteredRequests;

  const handleSave = async (id, fieldsToSend) => {
    const current = drafts[id] || {};
    const payload = Object.fromEntries(
      fieldsToSend
        .map((f) => (typeof f === "string" ? f : f.label))
        .filter(Boolean)
        .map((label) => [label, current[label]])
        .filter(([label]) => allowedLabels.has(label)),
    );

    if (!Object.keys(payload).length) {
      showToast("No hay campos editables para tu rol", "warning");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateBusinessCaseFields(id, payload);
      showToast("Business Case actualizado", "success");
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      setDrafts((prev) => ({ ...prev, [id]: buildDraftFromRequest(updated) }));
      setActiveForm(null);
    } catch (error) {
      console.error(error);
      showToast(error?.response?.data?.message || "No se pudieron guardar los campos", "error");
    } finally {
      setSaving(false);
    }
  };

  const loadItems = async (id) => {
    setItemsLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const items = await listBusinessCaseItems(id);
      setItemsByRequest((prev) => ({ ...prev, [id]: items }));
    } catch (error) {
      console.error(error);
      showToast("No se pudieron cargar las inversiones adicionales", "error");
    } finally {
      setItemsLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleAddItem = async (req) => {
    const draft = newItem[req.id] || {};
    if (req.bc_stage !== "investments") {
      showToast("Completa primero Comercial, ACP Comercial y Gerencia", "warning");
      return;
    }
    if (!draft.name) {
      showToast("Selecciona o ingresa un concepto de inversión", "warning");
      return;
    }

    try {
      await addBusinessCaseItem(req.id, draft);
      showToast("Inversión registrada", "success");
      setNewItem((prev) => ({ ...prev, [req.id]: {} }));
      await loadItems(req.id);
    } catch (error) {
      console.error(error);
      showToast(error?.response?.data?.message || "No se pudo guardar la inversión", "error");
    }
  };

  const openForm = (reqId, type) => {
    const roleGuards = {
      commercial: "comercial",
      acp: "acp_comercial",
      gerencia: "gerencia_general",
      operations: "jefe_operaciones",
    };
    const requiredRole = roleGuards[type];
    if (requiredRole && normalizedRole !== requiredRole) {
      showToast("Este formulario solo puede ser completado por el rol asignado", "warning");
      return;
    }
    setActiveForm({ id: reqId, type });
    setExpanded(reqId);
  };

  const formFields = useMemo(() => {
    if (!activeForm) return [];
    if (activeForm.type === "commercial") return COMMERCIAL_FIELDS;
    if (activeForm.type === "acp") return ACP_FIELDS;
    if (activeForm.type === "gerencia") return GERENCIA_FIELDS;
    if (activeForm.type === "operations") return OPERATIONS_FIELDS;
    return [];
  }, [activeForm]);

  const progressChip = (label, done) => (
    <span
      key={label}
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${done ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
        }`}
    >
      {done ? <FiCheckCircle /> : <FiClock />} {label}
    </span>
  );

  const renderStageBadge = (stage) => {
    const data = STAGE_LABELS[stage] || { label: stage, className: "bg-gray-100 text-gray-700" };
    return <span className={`text-xxs px-2 py-1 rounded-full font-semibold ${data.className}`}>{data.label}</span>;
  };

  const showCommercialStarts = showCommercialStartCards && normalizedRole === "comercial";
  const pendingCommercial = showCommercialStarts
    ? visibleRequests.filter(
      (req) =>
        (req.bc_stage || "pending_comercial") === "pending_comercial" &&
        !req.bc_spreadsheet_id &&
        !req.business_case_link &&
        !(req.bc_progress || {}).comercial,
    )
    : [];



  return (
    <Card className="p-4 border border-gray-200">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div>
          <p className="text-xs uppercase text-gray-500 font-semibold">{title}</p>
          <h3 className="text-lg font-semibold text-gray-900">Seguimiento de Business Case</h3>
          <p className="text-xs text-gray-500">Flujo guiado por rol y etapa</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar por cliente o responsable"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <Button variant="secondary" icon={FiRefreshCw} onClick={loadRequests} loading={loading}>
            Actualizar
          </Button>
        </div>
      </div>



      {loading ? (
        <p className="text-sm text-gray-500">Cargando Business Case...</p>
      ) : visibleRequests.length === 0 ? (
        <p className="text-sm text-gray-500">No hay solicitudes en etapa de Business Case.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((req) => {
              const progress = req.bc_progress || {};
              const items = itemsByRequest[req.id] || [];
              const stage = req.bc_stage || "pending_comercial";
              const canSeeCommercial = normalizedRole === "comercial";
              const canSeeAcp = normalizedRole === "acp_comercial";
              const canSeeGerencia = normalizedRole === "gerencia_general";
              const canSeeOperations = normalizedRole === "jefe_operaciones";

              return (
                <div key={req.id} className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm flex flex-col h-full">
                  <div className="flex flex-col gap-2 flex-1">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <FiClipboard className="text-blue-500" /> {req.client_name}
                      </p>
                      <p className="text-xs text-gray-500">Asignado a: {req.assigned_to_name || req.assigned_to_email || "Sin asignar"}</p>
                      <p className="text-xs text-gray-500">Estado: {STATUS_LABELS[req.status] || req.status || "-"}</p>
                      <div className="mt-1 flex flex-wrap gap-1">{renderStageBadge(stage)}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {progressChip("Comercial", progress.comercial)}
                        {progressChip("ACP Comercial", progress.acp_comercial)}
                        {progressChip("Gerencia", progress.gerencia)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-auto pt-2">
                      {req.business_case_link && (
                        <a
                          href={req.business_case_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:text-blue-600"
                        >
                          <FiExternalLink /> Ver en Sheets
                        </a>
                      )}
                      {stage === "pending_comercial" && canSeeCommercial && (
                        <Button size="sm" icon={FiEdit2} onClick={() => openForm(req.id, "commercial")}>
                          Completar Comercial
                        </Button>
                      )}
                      {stage === "pending_managerial" && canSeeAcp && (
                        <Button size="sm" icon={FiSend} onClick={() => openForm(req.id, "acp")}>
                          ACP Comercial
                        </Button>
                      )}
                      {stage === "pending_managerial" && canSeeGerencia && (
                        <Button size="sm" icon={FiSend} onClick={() => openForm(req.id, "gerencia")}>
                          Gerencia
                        </Button>
                      )}
                      {stage === "investments" && canSeeOperations && (
                        <Button size="sm" icon={FiEdit2} onClick={() => openForm(req.id, "operations")}>
                          Operaciones
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={expanded === req.id ? FiDatabase : FiClipboard}
                        onClick={() => {
                          setExpanded(expanded === req.id ? null : req.id);
                          if (!itemsByRequest[req.id]) loadItems(req.id);
                        }}
                      >
                        {expanded === req.id ? "Ocultar detalle" : "Ver detalle"}
                      </Button>
                    </div>

                    {expanded === req.id && (
                      <div className="mt-1 space-y-3">
                        <div className="grid grid-cols-1 gap-2 bg-gray-50 p-3 rounded-lg">
                          {["TIPO DE CLIENTE", "ENTIDAD CONTRATANTE", "CLIENTE", "Provincia /Ciudad"].map((label) => (
                            <div key={label}>
                              <p className="text-xxs uppercase text-gray-500">{label}</p>
                              <p className="text-sm font-semibold text-gray-900">{drafts[req.id]?.[label] || "-"}</p>
                            </div>
                          ))}
                        </div>

                        {stage === "investments" && canHandleInvestments && (
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-gray-800">Inversiones adicionales</p>
                              <Button size="xs" variant="ghost" icon={FiRefreshCw} onClick={() => loadItems(req.id)} loading={!!itemsLoading[req.id]}>
                                Recargar
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <FieldInput
                                field={{ label: "Concepto", optionsKey: "investment_catalog" }}
                                value={(newItem[req.id] || {}).name || ""}
                                options={bcOptions}
                                onChange={(val) =>
                                  setNewItem((prev) => ({ ...prev, [req.id]: { ...(prev[req.id] || {}), name: val } }))
                                }
                              />
                              <FieldInput
                                field={{ label: "Estado" }}
                                value={(newItem[req.id] || {}).status || ""}
                                onChange={(val) =>
                                  setNewItem((prev) => ({ ...prev, [req.id]: { ...(prev[req.id] || {}), status: val } }))
                                }
                              />
                              <FieldInput
                                field={{ label: "Características" }}
                                value={(newItem[req.id] || {}).characteristics || ""}
                                onChange={(val) =>
                                  setNewItem((prev) => ({ ...prev, [req.id]: { ...(prev[req.id] || {}), characteristics: val } }))
                                }
                              />
                              <FieldInput
                                field={{ label: "Cantidad", type: "number" }}
                                value={(newItem[req.id] || {}).quantity || ""}
                                onChange={(val) =>
                                  setNewItem((prev) => ({ ...prev, [req.id]: { ...(prev[req.id] || {}), quantity: val } }))
                                }
                              />
                              {canEditPrices && (
                                <FieldInput
                                  field={{ label: "Precio", type: "number" }}
                                  value={(newItem[req.id] || {}).price || ""}
                                  onChange={(val) =>
                                    setNewItem((prev) => ({ ...prev, [req.id]: { ...(prev[req.id] || {}), price: val } }))
                                  }
                                />
                              )}
                              {canEditPrices && (
                                <FieldInput
                                  field={{ label: "Total", type: "number" }}
                                  value={(newItem[req.id] || {}).total || ""}
                                  onChange={(val) =>
                                    setNewItem((prev) => ({ ...prev, [req.id]: { ...(prev[req.id] || {}), total: val } }))
                                  }
                                />
                              )}
                            </div>
                            <div className="flex justify-end mt-2">
                              <Button size="sm" icon={FiPlus} onClick={() => handleAddItem(req)}>
                                Registrar inversión
                              </Button>
                            </div>
                            <div className="mt-3 bg-white rounded-lg border border-gray-200 p-2 max-h-56 overflow-y-auto">
                              {itemsLoading[req.id] ? (
                                <p className="text-sm text-gray-500">Cargando inversiones...</p>
                              ) : items.length ? (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-500">
                                      <th className="py-1 px-2 text-left">Concepto</th>
                                      <th className="py-1 px-2 text-left">Estado</th>
                                      <th className="py-1 px-2 text-left">Cantidad</th>
                                      {canEditPrices && <th className="py-1 px-2 text-left">Precio</th>}
                                      {canEditPrices && <th className="py-1 px-2 text-left">Total</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map((item) => (
                                      <tr key={item.id} className="border-t">
                                        <td className="py-1 px-2 font-semibold text-gray-900">{item.name}</td>
                                        <td className="py-1 px-2 text-gray-700">{item.status || "-"}</td>
                                        <td className="py-1 px-2 text-gray-700">{item.quantity ?? "-"}</td>
                                        {canEditPrices && <td className="py-1 px-2 text-gray-700">{item.price ?? "-"}</td>}
                                        {canEditPrices && <td className="py-1 px-2 text-gray-700">{item.total ?? "-"}</td>}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-sm text-gray-500">Sin inversiones registradas.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {visibleRequests.length > itemsPerPage && (
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-500">
                Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, visibleRequests.length)} a {Math.min(currentPage * itemsPerPage, visibleRequests.length)} de {visibleRequests.length} resultados
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={FiChevronLeft}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(Math.ceil(visibleRequests.length / itemsPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(visibleRequests.length / itemsPerPage)}
                >
                  Siguiente <FiChevronRight className="ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={!!activeForm}
        onClose={() => setActiveForm(null)}
        title={
          activeForm?.type === "commercial"
            ? "Datos iniciales (Comercial)"
            : activeForm?.type === "acp"
              ? "Datos ACP Comercial"
              : activeForm?.type === "gerencia"
                ? "Datos Gerencia"
                : "Operaciones"
        }
        maxWidth="max-w-4xl"
      >
        {optionsLoading && <p className="text-sm text-gray-500">Cargando listas...</p>}
        {activeForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {formFields.map((field) => (
                <div key={field.label} className="space-y-1">
                  <p className="text-xxs uppercase text-gray-500">{field.label}</p>
                  <FieldInput
                    field={field}
                    value={(drafts[activeForm.id] || {})[field.label] || ""}
                    options={bcOptions}
                    onChange={(val) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [activeForm.id]: { ...(prev[activeForm.id] || {}), [field.label]: val },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setActiveForm(null)}>
                Cancelar
              </Button>
              <Button onClick={() => handleSave(activeForm.id, formFields)} loading={saving} icon={FiSend}>
                Guardar y sincronizar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default BusinessCaseWidget;
