import React, { useEffect, useMemo, useState } from "react";
import {
  createEquipmentPurchase,
  getEquipmentPurchaseMeta,
  listEquipmentPurchases,
  requestProforma,
  reserveEquipment,
  saveProviderResponse,
  uploadContract,
  uploadProforma,
  uploadSignedProforma,
  submitSignedProformaWithInspection,
  startAvailability,
} from "../../../core/api/equipmentPurchasesApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";
import { useAuth } from "../../../core/auth/AuthContext";
import ProcessingOverlay from "../../../core/ui/components/ProcessingOverlay";
import StatusBadge from "./StatusBadge";
import EquipmentSelector from "./EquipmentSelector";
import RequestActions from "./RequestActions";
import {
  STATUS_CONFIG,
  VALIDATION_MESSAGES,
  MODAL_TITLES,
  PROCESSING_STEPS,
  SUCCESS_MESSAGES,
  EMPTY_STATES,
  LOADING_MESSAGES,
  ARIA_LABELS,
} from "./EquipmentPurchaseWidget.constants";
import {
  normalizeResponseItems,
  dedupeEquipmentList,
  getEquipmentDisplayList,
  getFormattedProviderResponse,
  getPaginationInfo,
  validateForm,
  getEquipmentPayload,
  formatProviderOutcome,
} from "./EquipmentPurchaseWidget.utils";
import { formatDateTimeEC } from "../../../core/utils/dateUtils";
import {
  FiPackage,
  FiMail,
  FiFileText,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiDownload,
  FiUser,
  FiSearch,
} from "react-icons/fi";



const EquipmentPurchaseWidget = ({ showCreation = true, compactList = false }) => {
  const { showToast } = useUI();
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const isManager = ["acp_comercial", "gerencia", "jefe_comercial"].includes(role);
  const canAccessAttachments = ["acp_comercial", "gerencia_general"].includes(role);
  const [meta, setMeta] = useState({ clients: [], equipment: [], acpUsers: [] });
  const [requests, setRequests] = useState([]);
  const [listQuery, setListQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ clientId: "", providerEmail: "", assignedTo: "", equipment: [], notes: "" });
  const [responseDraft, setResponseDraft] = useState({ open: false, id: null, outcome: "new", notes: "", items: [] });
  const [inspectionDraft, setInspectionDraft] = useState({});
  const [inspectionModal, setInspectionModal] = useState({
    open: false,
    requestId: null,
    file: null,
    minDate: "",
    maxDate: "",
    includesKit: false
  });
  const [availabilityDrafts, setAvailabilityDrafts] = useState({});
  const [processingAction, setProcessingAction] = useState(null);
  const [processingStep, setProcessingStep] = useState(null);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const loadAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const [metaRes, listRes] = await Promise.all([
        showCreation ? getEquipmentPurchaseMeta() : Promise.resolve({ clients: [], equipment: [], acp_users: [] }),
        listEquipmentPurchases(),
      ]);
      setMeta({
        clients: metaRes.clients || [],
        equipment: dedupeEquipmentList(metaRes.equipment || []),
        acpUsers: metaRes.acp_users || [],
      });
      setRequests(listRes || []);
    } catch (error) {
      console.error(error);
      showToast("No se pudo cargar las solicitudes de compra", "error");
    } finally {
      setLoading(false);
    }
  }, [showCreation, isManager, showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setPage(1);
  }, [listQuery]);

  useEffect(() => {
    if (showCreation && !isManager && meta.acpUsers?.length && !form.assignedTo) {
      setForm((prev) => ({ ...prev, assignedTo: meta.acpUsers[0].id }));
    }
  }, [showCreation, isManager, meta.acpUsers, form.assignedTo]);

  const selectedClient = useMemo(
    () => (showCreation ? meta.clients.find((c) => `${c.id}` === `${form.clientId}`) : null),
    [showCreation, meta.clients, form.clientId],
  );

  const filteredRequests = useMemo(() => {
    const q = (listQuery || "").trim().toLowerCase();
    const purchaseRequests = requests.filter((req) => req.request_type !== "business_case");
    if (!q) return purchaseRequests;
    return purchaseRequests.filter((req) =>
      [req.client_name, req.provider_email, req.assigned_to_name, req.assigned_to_email]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q))
    );
  }, [listQuery, requests]);

  const perPage = compactList ? 9 : Math.max(filteredRequests.length, 1);
  const totalPages = Math.max(1, Math.ceil((filteredRequests.length || 0) / perPage));
  const currentPage = Math.min(page, totalPages);
  const visibleRequests = useMemo(() => {
    if (!compactList) return filteredRequests;
    const start = (currentPage - 1) * perPage;
    return filteredRequests.slice(start, start + perPage);
  }, [compactList, filteredRequests, currentPage, perPage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const toggleEquipment = (id) => {
    setForm((prev) => {
      const exists = prev.equipment.find((eq) => eq.id === id);
      return {
        ...prev,
        equipment: exists
          ? prev.equipment.filter((x) => x.id !== id)
          : [...prev.equipment, { id, type: "new" }],
      };
    });
  };

  const updateEquipmentType = (id, type) => {
    setForm((prev) => ({
      ...prev,
      equipment: prev.equipment.map((eq) =>
        eq.id === id ? { ...eq, type } : eq
      ),
    }));
  };

  const handleCreate = async () => {
    if (!form.clientId || !form.equipment.length) {
      showToast("Cliente y equipos son obligatorios", "warning");
      return;
    }
    if (!isManager && !form.assignedTo) {
      showToast("Debes asignar la solicitud a un ACP Comercial", "warning");
      return;
    }
    setCreating(true);
    try {
      const equipmentPayload = form.equipment.map((formEq) => {
        const eq = meta.equipment.find((e) => e.id === formEq.id);
        return {
          id: eq.id,
          name: eq.name,
          sku: eq.sku,
          serial: eq.serial,
          status: eq.status,
          type: formEq.type
        };
      });

      await createEquipmentPurchase({
        client_id: form.clientId,
        client_name: selectedClient?.name,
        client_email: selectedClient?.client_email,
        provider_email: isManager ? form.providerEmail : undefined,
        assigned_to: form.assignedTo || null,
        equipment: equipmentPayload,
        notes: form.notes,
      });
      const successMessage = isManager && form.providerEmail
        ? "Solicitud creada y correo enviado al proveedor"
        : "Solicitud creada y enviada a ACP Comercial para gestionar proveedor";
      showToast(successMessage, "success");
      setForm({
        clientId: "",
        providerEmail: "",
        assignedTo: isManager ? "" : meta.acpUsers?.[0]?.id || "",
        equipment: [],
        notes: "",
      });
      loadAll();
    } catch (error) {
      console.error(error);
      showToast("No se pudo crear la solicitud", "error");
    } finally {
      setCreating(false);
    }
  };

  const openResponse = (request) => setResponseDraft({
    open: true,
    id: request.id,
    outcome: "new",
    notes: "",
    items: normalizeResponseItems(request),
  });

  const runWithOverlay = async (title, steps, asyncFn) => {
    setProcessingAction({ title, steps });
    setProcessingStep(steps?.[0]?.id || null);
    await new Promise((resolve) => setTimeout(resolve, 10));
    try {
      await asyncFn();
    } finally {
      setProcessingAction(null);
      setProcessingStep(null);
    }
  };

  const submitResponse = async () => {
    await runWithOverlay(
      "Enviando respuesta al proveedor",
      [{ id: "response", label: "Registrando respuesta" }],
      async () => {
        try {
          const responseItems = (responseDraft.items || []).map((item) => {
            const availableType = item.available_type || "none";
            const decision = availableType === "none" ? "reject" : item.decision || "reject";
            return { ...item, available_type: availableType, decision };
          });

          const acceptedItems = responseItems.filter(
            (item) => item.available_type !== "none" && item.decision !== "reject",
          );
          const normalizedOutcome = acceptedItems.length > 0 ? "new" : "none";
          await saveProviderResponse(responseDraft.id, {
            outcome: normalizedOutcome,
            notes: responseDraft.notes,
            items: responseItems,
          });
          showToast("Respuesta registrada", "success");
          setResponseDraft({ open: false, id: null, outcome: "new", notes: "", items: [] });
          loadAll();
        } catch (error) {
          console.error(error);
          showToast("No se pudo guardar la respuesta", "error");
          throw error;
        }
      },
    );
  };

  const handleRequestProforma = async (id) => {
    await runWithOverlay(
      "Solicitando proforma",
      [{ id: "proforma", label: "Solicitando proforma" }],
      async () => {
        try {
          await requestProforma(id);
          showToast("Proforma solicitada", "success");
          loadAll();
        } catch (error) {
          console.error(error);
          showToast("No se pudo solicitar la proforma", "error");
        }
      },
    );
  };

  const handleUpload = async (id, action, file, extra = {}) => {
    if (!file) {
      showToast("Selecciona un archivo", "warning");
      return;
    }
    const label = action === "proforma" ? "subiendo proforma" : action === "signed" ? "subiendo proforma firmada" : "subiendo contrato";
    await runWithOverlay(
      `Enviando ${label}`,
      [{ id: action, label: `Subiendo ${label}` }],
      async () => {
        try {
          if (action === "proforma") await uploadProforma(id, file);
          if (action === "signed") await uploadSignedProforma(id, { file, ...extra });
          if (action === "contract") await uploadContract(id, file);
          showToast("Archivo cargado", "success");
          loadAll();
        } catch (error) {
          console.error(error);
          showToast("No se pudo cargar el archivo", "error");
          throw error;
        }
      },
    );
  };

  const handleReserve = async (id) => {
    await runWithOverlay(
      "Enviando reserva",
      [{ id: "reserve", label: "Enviando reserva" }],
      async () => {
        try {
          await reserveEquipment(id);
          showToast("Reserva enviada y recordatorio agendado", "success");
          loadAll();
        } catch (error) {
          console.error(error);
          showToast("No se pudo enviar la reserva", "error");
        }
      },
    );
  };

  const handleStartAvailability = async (request) => {
    const draft = availabilityDrafts[request.id] || {};
    const providerEmail = draft.provider_email ?? request.provider_email ?? "";
    const notes = draft.notes ?? request.notes ?? "";

    if (!providerEmail) {
      showToast("Debes ingresar el correo del proveedor", "warning");
      return;
    }

    await runWithOverlay(
      "Enviando correo de disponibilidad",
      [{ id: "availability", label: "Enviando correo de disponibilidad" }],
      async () => {
        try {
          await startAvailability(request.id, { provider_email: providerEmail, notes });
          showToast("Correo de disponibilidad enviado", "success");
          setAvailabilityDrafts((prev) => ({ ...prev, [request.id]: {} }));
          loadAll();
        } catch (error) {
          console.error(error);
          showToast("No se pudo enviar el correo de disponibilidad", "error");
        }
      },
    );
  };
  const handleSubmitInspection = async () => {
    const { requestId, file, minDate, maxDate, includesKit } = inspectionModal;

    if (!file || !minDate || !maxDate) {
      showToast("Archivo y fechas son obligatorios", "warning");
      return;
    }

    await runWithOverlay(
      "Subiendo inspección",
      [{ id: "inspection", label: "Enviando inspección" }],
      async () => {
        try {
          await submitSignedProformaWithInspection(requestId, {
            file,
            inspection_min_date: minDate,
            inspection_max_date: maxDate,
            includes_starter_kit: includesKit,
          });

          showToast("Proforma subida e inspección creada exitosamente", "success");
          setInspectionModal({ open: false, requestId: null, file: null, minDate: "", maxDate: "", includesKit: false });
          loadAll();
        } catch (error) {
          console.error(error);
          showToast("Error al procesar la solicitud", "error");
          throw error;
        }
      },
    );
  };

  return (
    <>
      {processingAction && (
        <ProcessingOverlay
          className="z-[1010]"
          title={processingAction.title}
          steps={processingAction.steps}
          activeStep={processingStep}
        />
      )}
      <div className="space-y-6">
        {showCreation && (
          <Card className="overflow-hidden border border-slate-200/70 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200/60 bg-slate-50/80 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-slate-900 p-2.5 text-white shadow-sm">
                    <FiPackage size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Nueva solicitud de compra</h2>
                    <p className="text-sm text-slate-500">Cualquier comercial puede registrar y asignar al ACP Comercial</p>
                  </div>
                </div>
                <Button onClick={loadAll} variant="ghost" className="px-3">
                  Refrescar
                </Button>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Cliente</label>
                  <select
                    className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    value={form.clientId}
                    onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
                  >
                    <option value="">Selecciona un cliente</option>
                    {meta.clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Proveedor (correo)</label>
                  <input
                    type="email"
                    className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    value={form.providerEmail}
                    onChange={(e) => setForm((prev) => ({ ...prev, providerEmail: e.target.value }))}
                    placeholder={isManager ? "correo@proveedor.com" : "Solo ACP Comercial"}
                    disabled={!isManager}
                  />
                  {!isManager && (
                    <p className="text-xs text-slate-500 mt-2">El ACP Comercial completara el proveedor y enviara el correo.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Asignar a ACP Comercial</label>
                  <select
                    className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    value={form.assignedTo}
                    onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: e.target.value }))}
                    disabled={meta.acpUsers.length === 0}
                  >
                    <option value="">{meta.acpUsers.length ? "Selecciona un ACP" : "Sin ACP disponibles"}</option>
                    {meta.acpUsers.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <EquipmentSelector
                equipment={meta.equipment}
                selectedEquipment={form.equipment}
                onToggleEquipment={toggleEquipment}
                onUpdateType={updateEquipmentType}
              />

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Notas al proveedor</label>
                <textarea
                  className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500">
                  Recuerda validar cliente y equipos antes de enviar la solicitud.
                </div>
                <Button onClick={handleCreate} loading={creating} className="sm:w-auto w-full">
                  Enviar correo de disponibilidad
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900">Solicitudes en curso</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {filteredRequests.length} total
                </span>
              </div>
              {loading && <span className="block text-sm text-slate-500 animate-pulse">Actualizando...</span>}
            </div>
            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
              {compactList && (
                <div className="relative w-full md:w-72">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    value={listQuery}
                    onChange={(e) => setListQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Buscar cliente o proveedor"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                {!showCreation && (
                  <Button onClick={loadAll} variant="ghost" className="text-sm px-3 py-1.5">
                    Refrescar
                  </Button>
                )}
                {compactList && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <Button
                      variant="secondary"
                      className="px-3 py-1"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="text-slate-700">
                      Pagina {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      className="px-3 py-1"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {visibleRequests.length === 0 ? (
            <Card className="p-12 text-center border border-slate-200/70 bg-white/80 shadow-sm">
              <FiPackage className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500">Sin solicitudes registradas</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleRequests.map((req) => {
                const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.waiting_provider_response;
                const StatusIcon = statusConfig.icon;
                const providerResponse = req.provider_response || null;
                const requestedMap = new Map((req.equipment || []).map((item) => [item.id, item]));
                const availableItems = Array.isArray(providerResponse?.items)
                  ? providerResponse.items.map((item) => {
                    const requestedItem = requestedMap.get(item.id) || {};
                    return {
                      ...item,
                      name: item.name || requestedItem.name || requestedItem.label || requestedItem.sku || item.id || "Equipo",
                      requested_type: item.requested_type || requestedItem.type,
                      available_type: item.available_type || item.type,
                      decision: item.decision || (item.available_type === "none" ? "reject" : "accept"),
                    };
                  })
                  : [];
                const showAvailableItems = !!providerResponse && availableItems.length > 0;
                const equipmentList = showAvailableItems
                  ? availableItems
                  : (req.equipment || []).map((item) => ({
                    ...item,
                    requested_type: item.type,
                    available_type: item.type,
                  }));
                const equipmentTitle = showAvailableItems
                  ? "Equipos disponibles (respuesta del proveedor):"
                  : "Equipos solicitados:";
                const availabilityDraft = availabilityDrafts[req.id] || {};
                const draftProviderEmail = availabilityDraft.provider_email ?? req.provider_email ?? "";
                const draftNotes = availabilityDraft.notes ?? req.notes ?? "";
                const providerText = providerResponse
                  ? formatProviderOutcome(providerResponse.outcome)
                  : "Sin respuesta del proveedor";
                const providerTimestamp =
                  providerResponse?.updated_at ||
                  req.provider_response_at ||
                  req.updated_at ||
                  req.created_at;
                const formattedResponseDate = providerTimestamp
                  ? new Date(providerTimestamp).toLocaleString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : null;
                const expanded = expandedRequestId === req.id;
                const toggleExpanded = () => {
                  setExpandedRequestId((prev) => (prev === req.id ? null : req.id));
                };

                return (
                  <Card
                    key={req.id}
                    className={`relative h-full flex flex-col rounded-2xl p-4 md:p-5 border border-slate-200/70 ${statusConfig.cardBg} ${statusConfig.cardBorder} shadow-md ${statusConfig.cardShadow} hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 overflow-hidden`}
                  >
                    {/* LED de Estado - Esquina Superior Derecha */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <div className="relative">
                        <div className={`w-4 h-4 rounded-full ${statusConfig.ledColor} ${statusConfig.ledGlow} animate-pulse`}></div>
                        <div className={`absolute inset-0 w-4 h-4 rounded-full ${statusConfig.ledColor} animate-ping opacity-75`}></div>
                        <div className={`absolute inset-0.5 w-3 h-3 rounded-full bg-white/30 blur-sm`}></div>
                      </div>
                    </div>

                    {/* Header */}
                    <div className="flex items-start justify-between mb-4 pr-8">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900">{req.client_name}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Creado: {formatDateTimeEC(req.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Badge de Estado */}
                    <div className="mb-3">
                      <StatusBadge status={req.status} />
                    </div>

                    <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        <FiMail className="text-gray-500" size={14} />
                        <span className="font-medium">{req.provider_email || "Proveedor pendiente"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={toggleExpanded}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {expanded ? "Mostrar menos" : "Mostrar más"}
                      </button>
                    </div>

                    {(req.assigned_to_name || req.assigned_to_email) && (
                      <div className="mb-3 flex items-center gap-2 text-sm text-gray-700">
                        <FiUser className="text-gray-500" size={14} />
                        <span className="font-medium">Asignado a: {req.assigned_to_name || req.assigned_to_email}</span>
                      </div>
                    )}

                    {expanded && providerResponse && (
                      <div className="mb-4 rounded-2xl border border-gray-200 bg-white/70 p-4 space-y-4 shadow-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">Respuesta del proveedor</p>
                          <p className="text-sm font-semibold text-gray-900">{providerText}</p>
                          {formattedResponseDate && (
                            <p className="text-[10px] text-gray-500">{formattedResponseDate}</p>
                          )}
                        </div>
                        {providerResponse.notes && (
                          <p className="text-sm text-gray-700 whitespace-pre-line">{providerResponse.notes}</p>
                        )}
                        <div className="space-y-3">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">{equipmentTitle}</p>
                          <div className="space-y-2">
                            {equipmentList.map((eq, idx) => {
                              const eqName = typeof eq === "string" ? eq : (eq.name || eq.label || eq.sku || eq.id || "Equipo");
                              const requestedType = typeof eq === "object" ? eq.requested_type || eq.type : null;
                              const availableType = typeof eq === "object" ? eq.available_type || eq.type : null;
                              const decision = typeof eq === "object" ? eq.decision : null;
                              const hasMismatch = requestedType && availableType && requestedType !== availableType;

                              const typeBadge = (type, label) => (
                                <span
                                  className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${type === 'new'
                                    ? 'bg-green-100 text-green-700'
                                    : type === 'cu'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-600'
                                    }`}
                                >
                                  {label}: {type === 'new' ? 'Nuevo' : type === 'cu' ? 'CU' : 'Sin stock'}
                                </span>
                              );

                              return (
                                <div key={`${req.id}-${idx}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                                  <p className="font-medium text-gray-900">{eqName}</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {requestedType && typeBadge(requestedType, "Solicitado")}
                                    {availableType && typeBadge(availableType, "Disponible")}
                                    {decision && (
                                      <span
                                        className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${decision === 'reject'
                                          ? 'bg-red-100 text-red-700 border border-red-200'
                                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                          }`}
                                      >
                                        {decision === "reject" ? "Rechazado" : "Aceptado"}
                                      </span>
                                    )}
                                    {hasMismatch && (
                                      <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                        Diferente a lo solicitado
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {canAccessAttachments && (
                          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide">
                            {req.proforma_file_link && (
                              <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-800">Proforma</span>
                            )}
                            {req.signed_proforma_file_link && (
                              <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-800">Proforma firmada</span>
                            )}
                            {req.contract_file_link && (
                              <span className="px-2 py-1 rounded-full bg-green-50 text-green-800">Contrato</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <RequestActions
                      request={req}
                      isManager={isManager}
                      canAccessAttachments={canAccessAttachments}
                      availabilityDrafts={availabilityDrafts}
                      inspectionDraft={inspectionDraft}
                      onStartAvailability={handleStartAvailability}
                      onOpenResponse={openResponse}
                      onRequestProforma={handleRequestProforma}
                      onReserve={handleReserve}
                      onOpenInspection={(request) => setInspectionModal({
                        open: true,
                        requestId: request.id,
                        file: null,
                        minDate: "",
                        maxDate: "",
                        includesKit: false
                      })}
                      onUploadProforma={(id, action, file) => handleUpload(id, action, file)}
                      onUploadContract={(id, action, file) => handleUpload(id, action, file)}
                      onUpdateAvailabilityDraft={(requestId, field, value) => {
                        setAvailabilityDrafts((prev) => ({
                          ...prev,
                          [requestId]: { ...prev[requestId], [field]: value },
                        }));
                      }}
                    />
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        {inspectionModal.open && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Solicitud de Inspección de Ambiente</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proforma firmada <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setInspectionModal(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                    className="w-full text-sm border rounded p-2"
                  />
                  {inspectionModal.file && (
                    <p className="text-xs text-green-600 mt-1">✓ {inspectionModal.file.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha mínima de inspección <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={inspectionModal.minDate}
                    onChange={(e) => setInspectionModal(prev => ({ ...prev, minDate: e.target.value }))}
                    className="w-full border rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha máxima de inspección <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={inspectionModal.maxDate}
                    onChange={(e) => setInspectionModal(prev => ({ ...prev, maxDate: e.target.value }))}
                    className="w-full border rounded-lg p-2"
                  />
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={inspectionModal.includesKit}
                    onChange={(e) => setInspectionModal(prev => ({ ...prev, includesKit: e.target.checked }))}
                  />
                  <span className="text-sm text-gray-700">Incluye kit de arranque</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="ghost"
                  onClick={() => setInspectionModal({ open: false, requestId: null, file: null, minDate: "", maxDate: "", includesKit: false })}
                >
                  Cancelar</Button>
                <Button onClick={handleSubmitInspection}>
                  Crear Solicitud
                </Button>
              </div>
            </div>
          </div>
        )}
        {responseDraft.open && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-md">
              <h3 className="text-lg font-semibold">Respuesta del proveedor</h3>
              <div className="mt-3 space-y-3 text-sm">
                {responseDraft.items?.map((item, idx) => (
                  <div key={item.id || idx} className="border rounded-lg p-3 bg-gray-50/60">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          Solicitado: {item.requested_type === "cu" ? "CU" : item.requested_type === "new" ? "Nuevo" : "Sin especificar"}
                        </p>
                      </div>
                      {item.sku && <span className="text-[11px] text-gray-500">SKU: {item.sku}</span>}
                    </div>
                    <div className="space-y-1">
                      {[{ value: "new", label: "Disponible en Nuevo" }, { value: "cu", label: "Disponible en CU" }, { value: "none", label: "Sin stock" }]
                        .map((option) => (
                          <label key={option.value} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`availability-${item.id}`}
                              checked={item.available_type === option.value}
                              onChange={() => {
                                setResponseDraft((prev) => {
                                  const items = [...prev.items];
                                  items[idx] = {
                                    ...items[idx],
                                    available_type: option.value,
                                    decision: option.value === "none" ? "reject" : items[idx].decision,
                                  };
                                  return { ...prev, items };
                                });
                              }}
                            />
                            {option.label}
                          </label>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[{ value: "accept", label: "Aceptar producto" }, { value: "reject", label: "Rechazar producto" }]
                        .map((option) => {
                          const disabled = option.value === "accept" && item.available_type === "none";
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                if (disabled) return;
                                setResponseDraft((prev) => {
                                  const items = [...prev.items];
                                  items[idx] = { ...items[idx], decision: option.value };
                                  return { ...prev, items };
                                });
                              }}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${item.decision === option.value
                                ? option.value === "accept"
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                  : "bg-red-100 text-red-700 border-red-200"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}
                              ${disabled ? " opacity-50 cursor-not-allowed" : ""}`}
                              disabled={disabled}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
                <textarea
                  className="w-full border rounded p-2"
                  rows={3}
                  placeholder="Detalles del proveedor"
                  value={responseDraft.notes}
                  onChange={(e) => setResponseDraft((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={() => setResponseDraft({ open: false, id: null, outcome: "new", notes: "", items: [] })}>
                  Cancelar
                </Button>
                <Button onClick={submitResponse}>Guardar</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default EquipmentPurchaseWidget;
