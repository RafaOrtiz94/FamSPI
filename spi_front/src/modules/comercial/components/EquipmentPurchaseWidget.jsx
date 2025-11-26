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
} from "../../../core/api/equipmentPurchasesApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";
import { FiPackage, FiMail, FiFileText, FiCheckCircle, FiClock, FiAlertCircle, FiDownload } from "react-icons/fi";

const STATUS_CONFIG = {
  waiting_provider_response: {
    label: "Esperando respuesta de proveedor",
    icon: FiClock,
    ledColor: "bg-amber-500",
    ledGlow: "shadow-lg shadow-amber-500/50",
    cardBg: "bg-gradient-to-br from-amber-100 via-amber-50 to-white",
    cardBorder: "border-l-4 border-amber-500",
    cardShadow: "shadow-amber-300/60",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800"
  },
  no_stock: {
    label: "Sin stock",
    icon: FiAlertCircle,
    ledColor: "bg-red-600",
    ledGlow: "shadow-lg shadow-red-600/50",
    cardBg: "bg-gradient-to-br from-red-100 via-red-50 to-white",
    cardBorder: "border-l-4 border-red-600",
    cardShadow: "shadow-red-300/60",
    badgeBg: "bg-red-100",
    badgeText: "text-red-800"
  },
  waiting_proforma: {
    label: "Solicitando proforma",
    icon: FiMail,
    ledColor: "bg-blue-500",
    ledGlow: "shadow-lg shadow-blue-500/50",
    cardBg: "bg-gradient-to-br from-blue-100 via-blue-50 to-white",
    cardBorder: "border-l-4 border-blue-500",
    cardShadow: "shadow-blue-300/60",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800"
  },
  proforma_received: {
    label: "Proforma recibida",
    icon: FiFileText,
    ledColor: "bg-indigo-500",
    ledGlow: "shadow-lg shadow-indigo-500/50",
    cardBg: "bg-gradient-to-br from-indigo-100 via-indigo-50 to-white",
    cardBorder: "border-l-4 border-indigo-500",
    cardShadow: "shadow-indigo-300/60",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800"
  },
  waiting_signed_proforma: {
    label: "Esperando proforma firmada",
    icon: FiFileText,
    ledColor: "bg-purple-500",
    ledGlow: "shadow-lg shadow-purple-500/50",
    cardBg: "bg-gradient-to-br from-purple-100 via-purple-50 to-white",
    cardBorder: "border-l-4 border-purple-500",
    cardShadow: "shadow-purple-300/60",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800"
  },
  pending_contract: {
    label: "Pendiente contrato",
    icon: FiFileText,
    ledColor: "bg-orange-500",
    ledGlow: "shadow-lg shadow-orange-500/50",
    cardBg: "bg-gradient-to-br from-orange-100 via-orange-50 to-white",
    cardBorder: "border-l-4 border-orange-500",
    cardShadow: "shadow-orange-300/60",
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-800"
  },
  completed: {
    label: "Completado",
    icon: FiCheckCircle,
    ledColor: "bg-green-500",
    ledGlow: "shadow-lg shadow-green-500/50",
    cardBg: "bg-gradient-to-br from-green-100 via-green-50 to-white",
    cardBorder: "border-l-4 border-green-500",
    cardShadow: "shadow-green-300/60",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800"
  },
};

const formatProviderOutcome = (outcome) => {
  switch (outcome) {
    case "new":
      return "El proveedor confirmó disponibilidad de equipos";
    case "cu":
      return "El proveedor confirmó disponibilidad de equipos CU";
    case "none":
      return "El proveedor indicó que no hay stock disponible";
    default:
      return "Respuesta registrada del proveedor";
  }
};

const normalizeResponseItems = (request) => {
  const equipment = Array.isArray(request?.equipment) ? request.equipment : [];

  return equipment.map((item) => ({
    id: item.id,
    name: item.name || item.label || item.sku || item.id || "Equipo",
    sku: item.sku,
    serial: item.serial,
    requested_type: item.type,
    available_type: item.type,
  }));
};

const EquipmentPurchaseWidget = () => {
  const { showToast } = useUI();
  const [meta, setMeta] = useState({ clients: [], equipment: [] });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ clientId: "", providerEmail: "", equipment: [], notes: "" });
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

  const loadAll = async () => {
    setLoading(true);
    try {
      const [metaRes, listRes] = await Promise.all([
        getEquipmentPurchaseMeta(),
        listEquipmentPurchases(),
      ]);
      setMeta({ clients: metaRes.clients || [], equipment: metaRes.equipment || [] });
      setRequests(listRes || []);
    } catch (error) {
      console.error(error);
      showToast("No se pudo cargar las solicitudes de compra", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const selectedClient = useMemo(
    () => meta.clients.find((c) => `${c.id}` === `${form.clientId}`),
    [meta.clients, form.clientId],
  );

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
    if (!form.clientId || !form.providerEmail || !form.equipment.length) {
      showToast("Cliente, proveedor y equipos son obligatorios", "warning");
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
          type: formEq.type
        };
      });

      await createEquipmentPurchase({
        client_id: form.clientId,
        client_name: selectedClient?.name,
        client_email: selectedClient?.client_email,
        provider_email: form.providerEmail,
        equipment: equipmentPayload,
        notes: form.notes,
      });
      showToast("Solicitud creada y correo enviado al proveedor", "success");
      setForm({ clientId: "", providerEmail: "", equipment: [], notes: "" });
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

  const submitResponse = async () => {
    try {
      const responseItems = responseDraft.items || [];
      const hasAvailability = responseItems.some((item) => item.available_type && item.available_type !== "none");
      const normalizedOutcome = hasAvailability ? "new" : "none";
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
    }
  };

  const handleRequestProforma = async (id) => {
    try {
      await requestProforma(id);
      showToast("Proforma solicitada", "success");
      loadAll();
    } catch (error) {
      console.error(error);
      showToast("No se pudo solicitar la proforma", "error");
    }
  };

  const handleUpload = async (id, action, file, extra = {}) => {
    if (!file) {
      showToast("Selecciona un archivo", "warning");
      return;
    }
    try {
      if (action === "proforma") await uploadProforma(id, file);
      if (action === "signed") await uploadSignedProforma(id, { file, ...extra });
      if (action === "contract") await uploadContract(id, file);
      showToast("Archivo cargado", "success");
      loadAll();
    } catch (error) {
      console.error(error);
      showToast("No se pudo cargar el archivo", "error");
    }
  };

  const handleReserve = async (id) => {
    try {
      await reserveEquipment(id);
      showToast("Reserva enviada y recordatorio agendado", "success");
      loadAll();
    } catch (error) {
      console.error(error);
      showToast("No se pudo enviar la reserva", "error");
    }
  };
  const handleSubmitInspection = async () => {
    const { requestId, file, minDate, maxDate, includesKit } = inspectionModal;

    if (!file || !minDate || !maxDate) {
      showToast("Archivo y fechas son obligatorios", "warning");
      return;
    }

    try {
      await submitSignedProformaWithInspection(requestId, {
        file,
        inspection_min_date: minDate,
        inspection_max_date: maxDate,
        includes_starter_kit: includesKit
      });

      showToast("Proforma subida e inspección creada exitosamente", "success");
      setInspectionModal({ open: false, requestId: null, file: null, minDate: "", maxDate: "", includesKit: false });
      loadAll();
    } catch (error) {
      console.error(error);
      showToast("Error al procesar la solicitud", "error");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Nueva solicitud de compra</h2>
            <p className="text-sm text-gray-500">Disponible solo para ACP Comercial</p>
          </div>
          <Button onClick={loadAll} variant="ghost">Refrescar</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">Cliente</label>
            <select
              className="w-full mt-1 rounded-lg border border-gray-300 p-2"
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
            <label className="text-sm text-gray-600">Proveedor (correo)</label>
            <input
              type="email"
              className="w-full mt-1 rounded-lg border border-gray-300 p-2"
              value={form.providerEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, providerEmail: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">Equipos y tipo</p>
          <div className="grid grid-cols-1 gap-3 max-h-64 overflow-auto border rounded-lg p-3">
            {meta.equipment.map((eq) => {
              const selected = form.equipment.find((e) => e.id === eq.id);
              return (
                <div key={eq.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${selected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}>
                  <input
                    type="checkbox"
                    checked={!!selected}
                    onChange={() => toggleEquipment(eq.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{eq.name}</p>
                    <p className="text-xs text-gray-500">SKU: {eq.sku} {eq.serial ? `| Serie ${eq.serial}` : ""}</p>
                  </div>
                  {selected && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateEquipmentType(eq.id, "new")}
                        className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${selected.type === "new"
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                      >
                        Nuevo
                      </button>
                      <button
                        onClick={() => updateEquipmentType(eq.id, "cu")}
                        className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${selected.type === "cu"
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                      >
                        CU
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm text-gray-600">Notas al proveedor</label>
          <textarea
            className="w-full mt-1 rounded-lg border border-gray-300 p-2"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>

        <div className="mt-4">
          <Button onClick={handleCreate} loading={creating}>Enviar correo de disponibilidad</Button>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Solicitudes en curso</h2>
          {loading && <span className="text-sm text-gray-500 animate-pulse">Actualizando...</span>}
        </div>

        {requests.length === 0 ? (
          <Card className="p-12 text-center">
            <FiPackage className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500">Sin solicitudes registradas</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {requests.map((req) => {
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

              return (
                <Card
                  key={req.id}
                  className={`relative p-5 ${statusConfig.cardBg} ${statusConfig.cardBorder} border shadow-lg ${statusConfig.cardShadow} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden`}
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
                        Creado: {new Date(req.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Badge de Estado */}
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${statusConfig.badgeBg} ${statusConfig.badgeText} shadow-sm mb-3`}>
                    <StatusIcon size={14} />
                    <span className="text-xs font-semibold">{statusConfig.label}</span>
                  </div>

                  {/* Provider */}
                  <div className="mb-3 flex items-center gap-2 text-sm">
                    <FiMail className="text-gray-500" size={14} />
                    <span className="text-gray-700 font-medium">{req.provider_email}</span>
                  </div>

                  {/* Provider Response */}
                  {providerResponse && (
                    <div className="mb-4 bg-white/60 border border-white/70 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Respuesta del proveedor</p>
                          <p className="text-sm font-medium text-gray-800">{formatProviderOutcome(providerResponse.outcome)}</p>
                          {providerResponse.notes && (
                            <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{providerResponse.notes}</p>
                          )}
                        </div>
                        {req.provider_response_at && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            <FiClock size={12} />
                            <span>
                              {new Date(req.provider_response_at).toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Equipment List */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">{equipmentTitle}</p>
                    <div className="space-y-1">
                      {equipmentList.map((eq, idx) => {
                        const eqName = typeof eq === "string" ? eq : (eq.name || eq.label || eq.sku || eq.id || "Equipo");
                        const requestedType = typeof eq === "object" ? eq.requested_type || eq.type : null;
                        const availableType = typeof eq === "object" ? eq.available_type || eq.type : null;
                        const hasMismatch = requestedType && availableType && requestedType !== availableType;

                        const typeBadge = (type, label) => (
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-semibold ${type === 'new'
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
                          <div key={idx} className="flex flex-col gap-1 text-sm bg-white/60 rounded px-2 py-1">
                            <div className="flex items-center gap-2">
                              <FiPackage size={14} className="text-gray-500" />
                              <span className="font-medium text-gray-800">{eqName}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {requestedType && typeBadge(requestedType, "Solicitado")}
                              {availableType && typeBadge(availableType, "Disponible")}
                              {hasMismatch && (
                                <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
                                  Diferente a lo solicitado
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Files */}
                  {(req.proforma_file_link || req.signed_proforma_file_link || req.contract_file_link) && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {req.proforma_file_link && (
                        <a
                          href={req.proforma_file_link}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs bg-white px-3 py-1 rounded-full text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                        >
                          <FiDownload size={12} />
                          Proforma
                        </a>
                      )}
                      {req.signed_proforma_file_link && (
                        <a
                          href={req.signed_proforma_file_link}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs bg-white px-3 py-1 rounded-full text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm"
                        >
                          <FiDownload size={12} />
                          Proforma firmada
                        </a>
                      )}
                      {req.contract_file_link && (
                        <a
                          href={req.contract_file_link}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs bg-white px-3 py-1 rounded-full text-green-600 hover:bg-green-50 transition-colors shadow-sm"
                        >
                          <FiDownload size={12} />
                          Contrato
                        </a>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-white/50">
                    {req.status === "waiting_provider_response" && (
                      <Button size="sm" onClick={() => openResponse(req)} fullWidth>
                        Registrar respuesta
                      </Button>
                    )}
                    {req.status === "waiting_proforma" && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => handleRequestProforma(req.id)}>
                          Pedir proforma
                        </Button>
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="file"
                            id={`proforma-${req.id}`}
                            onChange={(e) => setInspectionDraft({ ...inspectionDraft, [`proforma-${req.id}`]: e.target.files?.[0] })}
                            className="hidden"
                          />
                          <label
                            htmlFor={`proforma-${req.id}`}
                            className="text-xs px-3 py-1 bg-white rounded cursor-pointer hover:bg-gray-50 transition-colors"
                          >
                            Elegir archivo
                          </label>
                          <Button
                            size="sm"
                            onClick={() => handleUpload(req.id, "proforma", inspectionDraft[`proforma-${req.id}`])}
                            disabled={!inspectionDraft[`proforma-${req.id}`]}
                          >
                            Subir
                          </Button>
                        </div>
                      </>
                    )}
                    {req.status === "proforma_received" && (
                      <Button size="sm" onClick={() => handleReserve(req.id)} fullWidth>
                        Enviar reserva
                      </Button>
                    )}
                    {req.status === "waiting_signed_proforma" && (
                      <Button
                        size="sm"
                        fullWidth
                        onClick={() => setInspectionModal({
                          open: true,
                          requestId: req.id,
                          file: null,
                          minDate: "",
                          maxDate: "",
                          includesKit: false
                        })}
                      >
                        📄 Subir proforma firmada e inspección
                      </Button>
                    )}
                    {req.status === "pending_contract" && (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="file"
                          id={`contract-${req.id}`}
                          onChange={(e) => setInspectionDraft({ ...inspectionDraft, [`contract-${req.id}`]: e.target.files?.[0] })}
                          className="hidden"
                        />
                        <label
                          htmlFor={`contract-${req.id}`}
                          className="text-xs px-3 py-1 bg-white rounded cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          Elegir contrato
                        </label>
                        <Button
                          size="sm"
                          onClick={() => handleUpload(req.id, "contract", inspectionDraft[`contract-${req.id}`])}
                          disabled={!inspectionDraft[`contract-${req.id}`]}
                          className="flex-1"
                        >
                          Subir contrato
                        </Button>
                      </div>
                    )}
                  </div>
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
                    {[
                      { value: "new", label: "Disponible en Nuevo" },
                      { value: "cu", label: "Disponible en CU" },
                      { value: "none", label: "Sin stock" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`availability-${item.id}`}
                          checked={item.available_type === option.value}
                          onChange={() => {
                            setResponseDraft((prev) => {
                              const items = [...prev.items];
                              items[idx] = { ...items[idx], available_type: option.value };
                              return { ...prev, items };
                            });
                          }}
                        />
                        {option.label}
                      </label>
                    ))}
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
              <Button variant="ghost" onClick={() => setResponseDraft({ open: false, id: null, outcome: "new", notes: "" })}>
                Cancelar
              </Button>
              <Button onClick={submitResponse}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};

export default EquipmentPurchaseWidget;
