import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBox,
  FiCalendar,
  FiCheckCircle,
  FiCpu,
  FiDollarSign,
  FiEdit3,
  FiExternalLink,
  FiFileText,
  FiFilter,
  FiMapPin,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiTool,
  FiTruck,
  FiTrash2,
  FiUpload,
  FiUser,
  FiX,
} from "react-icons/fi";
import {
  deleteEquipmentAssetDocument,
  getEquipmentAssetDocuments,
  getEquipmentAssetTimeline,
  getEquipmentAssets,
  getEquipmentMaintenanceSchedule,
  getEquipmentModels,
  getEquipmentStatuses,
  updateEquipmentAsset,
  uploadEquipmentAssetDocument,
} from "../../../core/api/equipmentManagementApi";
import { fetchClients } from "../../../core/api/clientsApi";
import { useAuth } from "../../../core/auth/AuthContext";

const tabs = [
  { id: "assets", label: "Activos", icon: FiBox },
  { id: "models", label: "Modelos", icon: FiCpu },
  { id: "schedule", label: "Cronograma", icon: FiCalendar },
];

const editableRoles = new Set([
  "jefe_servicio",
  "jefe_servicio_tecnico",
  "jefe_tecnico",
  "admin",
  "administrador",
  "admin_ti",
  "ti",
]);

const colorClasses = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

const statusClass = (token) => colorClasses[token] || colorClasses.slate;

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-EC", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
};

const formatMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Sin precio";
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(number);
};

const getClientName = (client) =>
  client?.razon_social || client?.nombre || client?.commercial_name || client?.nombre_comercial || `Cliente ${client?.id}`;

const documentTypeLabels = {
  proforma_puesta_marcha: "Proforma de puesta en marcha",
  kit_arranque: "Kit de arranque",
  acta_entrega: "Acta de entrega",
  acta_retiro: "Acta de retiro",
  mantenimiento: "Mantenimiento",
  otro: "Otro documento",
};

const LoadingState = () => (
  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
    <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
      <FiRefreshCw className="h-5 w-5 animate-spin text-blue-600" />
      Cargando gestion de equipos
    </div>
  </div>
);

const EmptyState = ({ title, detail, icon: Icon = FiBox }) => (
  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
    <Icon className="mb-3 h-8 w-8 text-slate-400" />
    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-slate-500">{detail}</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
    <div className="flex items-start gap-3">
      <FiAlertTriangle className="mt-0.5 h-5 w-5 text-rose-700" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-rose-900">No se pudo cargar equipos</h3>
        <p className="mt-1 text-sm text-rose-700">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-2xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
      >
        Reintentar
      </button>
    </div>
  </div>
);

const Metric = ({ label, value, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const Field = ({ icon: Icon, label, children }) => (
  <label className="block min-w-0">
    <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
    {children}
  </label>
);

const EquipmentWorkspace = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("assets");
  const [assets, setAssets] = useState([]);
  const [models, setModels] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [clients, setClients] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [historyAsset, setHistoryAsset] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [documentRows, setDocumentRows] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    docType: "proforma_puesta_marcha",
    title: "",
    notes: "",
    file: null,
  });

  const userRole = String(user?.role || "").toLowerCase();
  const canEditAssets = editableRoles.has(userRole);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statusRows, modelRows, assetRows, scheduleRows, clientResponse] = await Promise.all([
        getEquipmentStatuses(),
        getEquipmentModels(),
        getEquipmentAssets(),
        getEquipmentMaintenanceSchedule(),
        fetchClients({ limit: 300 }),
      ]);
      setStatuses(statusRows);
      setModels(modelRows);
      setAssets(assetRows);
      setSchedule(scheduleRows);
      setClients(clientResponse?.clients || []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Error inesperado al consultar el modulo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusByCode = useMemo(() => {
    return statuses.reduce((acc, status) => {
      acc[status.code] = status;
      return acc;
    }, {});
  }, [statuses]);

  const filteredAssets = useMemo(() => {
    const term = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesStatus = !statusFilter || asset.current_status === statusFilter;
      const matchesAvailability =
        !availabilityFilter ||
        (availabilityFilter === "available" && asset.is_available_for_negotiation) ||
        (availabilityFilter === "installed" && asset.current_status === "installed_client") ||
        (availabilityFilter === "service" && asset.lifecycle_group === "service");
      const text = [
        asset.serial_number,
        asset.internal_code,
        asset.asset_tag,
        asset.model_name,
        asset.manufacturer,
        asset.model,
        asset.category,
        asset.current_location,
        asset.assigned_client_name,
        asset.status_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesAvailability && (!term || text.includes(term));
    });
  }, [assets, availabilityFilter, query, statusFilter]);

  const filteredModels = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return models;
    return models.filter((model) =>
      [model.name, model.manufacturer, model.model, model.category, model.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [models, query]);

  const filteredSchedule = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return schedule;
    return schedule.filter((item) =>
      [item.procedure_name, item.model_name, item.manufacturer, item.model, item.serial_number, item.current_location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [query, schedule]);

  const metrics = useMemo(() => {
    const available = assets.filter((asset) => asset.is_available_for_negotiation).length;
    const installed = assets.filter((asset) => asset.current_status === "installed_client").length;
    const service = assets.filter((asset) => asset.lifecycle_group === "service").length;
    return { available, installed, service };
  }, [assets]);

  const startEdit = (asset) => {
    setNotice("");
    setEditingId(asset.id);
    setEditForm({
      current_status: asset.current_status || "",
      current_location: asset.current_location || "",
      client_id: asset.client_id || "",
      sale_price: asset.sale_price || "",
      asset_condition: asset.asset_condition || "",
      retired_at: asset.retired_at ? String(asset.retired_at).slice(0, 10) : "",
      delivered_at: asset.delivered_at ? String(asset.delivered_at).slice(0, 10) : "",
      notes: asset.notes || "",
    });
  };

  const updateForm = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveAsset = async (assetId) => {
    setSavingId(assetId);
    setNotice("");
    setError("");
    try {
      const updated = await updateEquipmentAsset(assetId, {
        ...editForm,
        client_id: editForm.client_id || null,
        sale_price: editForm.sale_price || null,
        retired_at: editForm.retired_at || null,
        delivered_at: editForm.delivered_at || null,
      });
      const refreshed = await getEquipmentAssets();
      setAssets(refreshed);
      setEditingId(null);
      setNotice(`Activo ${updated?.serial_number || assetId} actualizado correctamente.`);
      if (historyAsset?.id === assetId) {
        await openHistory({ ...historyAsset, ...updated });
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo actualizar el activo.");
    } finally {
      setSavingId(null);
    }
  };

  const openHistory = async (asset) => {
    setHistoryAsset(asset);
    setHistoryLoading(true);
    setDocumentsLoading(true);
    try {
      const [rows, docs] = await Promise.all([
        getEquipmentAssetTimeline(asset.id),
        getEquipmentAssetDocuments(asset.id),
      ]);
      setHistoryRows(rows);
      setDocumentRows(docs);
    } catch (err) {
      setHistoryRows([]);
      setDocumentRows([]);
      setError(err?.response?.data?.message || err?.message || "No se pudo cargar el historial del activo.");
    } finally {
      setHistoryLoading(false);
      setDocumentsLoading(false);
    }
  };

  const updateDocumentForm = (field, value) => {
    setDocumentForm((prev) => ({ ...prev, [field]: value }));
  };

  const uploadDocument = async () => {
    if (!historyAsset || !documentForm.file) {
      setError("Selecciona un activo y un archivo para subir.");
      return;
    }
    setUploadingDocument(true);
    setError("");
    try {
      await uploadEquipmentAssetDocument(historyAsset.id, {
        file: documentForm.file,
        docType: documentForm.docType,
        title: documentForm.title,
        notes: documentForm.notes,
      });
      setDocumentForm({ docType: "proforma_puesta_marcha", title: "", notes: "", file: null });
      setNotice("Documento del equipo cargado correctamente.");
      await openHistory(historyAsset);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo subir el documento.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const removeDocument = async (doc) => {
    if (!historyAsset || !doc?.id) return;
    setDocumentsLoading(true);
    setError("");
    try {
      await deleteEquipmentAssetDocument(historyAsset.id, doc.id);
      setNotice("Documento eliminado del equipo.");
      await openHistory(historyAsset);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo eliminar el documento.");
    } finally {
      setDocumentsLoading(false);
    }
  };

  const renderAssets = () => {
    if (!filteredAssets.length) {
      return (
        <EmptyState
          title="No hay activos con estos filtros"
          detail="Ajusta la busqueda o el estado para revisar equipos en almacenamiento, listos, reservados, instalados o en servicio."
          icon={FiFilter}
        />
      );
    }

    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="grid min-w-0 gap-4">
          {filteredAssets.map((asset) => {
            const status = statusByCode[asset.current_status] || asset;
            const isEditing = editingId === asset.id;
            return (
              <article key={asset.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(status.color_token)}`}>
                        {asset.status_label || status.label || asset.current_status}
                      </span>
                      {asset.asset_condition ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-700">
                          {asset.asset_condition === "cu" ? "CU" : "Nuevo"}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">{asset.serial_number || "Serial pendiente"}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {[asset.model_name, asset.manufacturer, asset.model].filter(Boolean).join(" / ")}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{asset.category || "Sin categoria"}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canEditAssets ? (
                      <button
                        type="button"
                        onClick={() => (isEditing ? setEditingId(null) : startEdit(asset))}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {isEditing ? <FiX className="h-4 w-4" /> : <FiEdit3 className="h-4 w-4" />}
                        {isEditing ? "Cancelar" : "Editar"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openHistory(asset)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      <FiFileText className="h-4 w-4" />
                      Historial y documentos
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Field icon={FiCheckCircle} label="Estado">
                      <select
                        value={editForm.current_status}
                        onChange={(event) => updateForm("current_status", event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                      >
                        {statuses.map((item) => (
                          <option key={item.code} value={item.code}>{item.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field icon={FiMapPin} label="Ubicacion">
                      <input
                        value={editForm.current_location}
                        onChange={(event) => updateForm("current_location", event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                        placeholder="Bodega, cliente o ciudad"
                      />
                    </Field>
                    <Field icon={FiDollarSign} label="Precio de venta">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.sale_price}
                        onChange={(event) => updateForm("sale_price", event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                        placeholder="0.00"
                      />
                    </Field>
                    <Field icon={FiTool} label="Condicion">
                      <select
                        value={editForm.asset_condition}
                        onChange={(event) => updateForm("asset_condition", event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">Sin definir</option>
                        <option value="nuevo">Nuevo</option>
                        <option value="cu">CU</option>
                      </select>
                    </Field>
                    <Field icon={FiTruck} label="Fecha retiro">
                      <input
                        type="date"
                        value={editForm.retired_at}
                        onChange={(event) => updateForm("retired_at", event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                      />
                    </Field>
                    <Field icon={FiCalendar} label="Fecha entrega">
                      <input
                        type="date"
                        value={editForm.delivered_at}
                        onChange={(event) => updateForm("delivered_at", event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                      />
                    </Field>
                    <Field icon={FiUser} label="Cliente asignado">
                      <select
                        value={editForm.client_id}
                        onChange={(event) => updateForm("client_id", event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">Sin cliente</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>{getClientName(client)}</option>
                        ))}
                      </select>
                    </Field>
                    <Field icon={FiEdit3} label="Notas">
                      <input
                        value={editForm.notes}
                        onChange={(event) => updateForm("notes", event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                        placeholder="Observaciones del activo"
                      />
                    </Field>
                    <div className="md:col-span-2 xl:col-span-4">
                      <button
                        type="button"
                        onClick={() => saveAsset(asset.id)}
                        disabled={savingId === asset.id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
                      >
                        <FiSave className="h-4 w-4" />
                        {savingId === asset.id ? "Guardando" : "Guardar activo"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Ubicacion</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{asset.current_location || "Sin ubicacion"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Cliente asignado</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{asset.assigned_client_name || "Sin cliente"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Precio de venta</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{formatMoney(asset.sale_price)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Retiro / entrega</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatDate(asset.retired_at)} / {formatDate(asset.delivered_at)}
                      </p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <aside className="min-w-0 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Historial</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                {historyAsset?.serial_number || "Selecciona un activo"}
              </h3>
            </div>
            {historyAsset ? (
              <button type="button" onClick={() => setHistoryAsset(null)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <FiX className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {!historyAsset ? (
            <p className="mt-4 text-sm text-slate-500">
              Abre un activo para ver movimientos, mantenimientos, actas y documentos como proformas de puesta en marcha o kit de arranque.
            </p>
          ) : null}
          {historyAsset ? (
            <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Documentos del equipo</p>
                  <p className="text-xs text-slate-500">Carga varios documentos por activo.</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {documentRows.length}
                </span>
              </div>

              {canEditAssets ? (
                <div className="mt-3 grid gap-2">
                  <select
                    value={documentForm.docType}
                    onChange={(event) => updateDocumentForm("docType", event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                  >
                    {Object.entries(documentTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input
                    value={documentForm.title}
                    onChange={(event) => updateDocumentForm("title", event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                    placeholder="Titulo visible del documento"
                  />
                  <input
                    value={documentForm.notes}
                    onChange={(event) => updateDocumentForm("notes", event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                    placeholder="Notas u observaciones"
                  />
                  <input
                    type="file"
                    onChange={(event) => updateDocumentForm("file", event.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={uploadDocument}
                    disabled={uploadingDocument || !documentForm.file}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiUpload className="h-4 w-4" />
                    {uploadingDocument ? "Subiendo" : "Subir documento"}
                  </button>
                </div>
              ) : null}

              {documentsLoading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                  <FiRefreshCw className="h-4 w-4 animate-spin" />
                  Cargando documentos
                </div>
              ) : null}
              {!documentsLoading && !documentRows.length ? (
                <p className="mt-4 rounded-2xl bg-white p-3 text-sm text-slate-500">Sin documentos cargados para este equipo.</p>
              ) : null}
              {!documentsLoading && documentRows.length ? (
                <div className="mt-4 space-y-2">
                  {documentRows.map((doc) => (
                    <div key={doc.id} className="rounded-2xl bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{doc.title || doc.filename}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{documentTypeLabels[doc.doc_type] || doc.doc_type}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{formatDate(doc.created_at)}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {doc.drive_link ? (
                            <a
                              href={doc.drive_link}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full p-2 text-blue-700 hover:bg-blue-50"
                              title="Abrir documento"
                            >
                              <FiExternalLink className="h-4 w-4" />
                            </a>
                          ) : null}
                          {canEditAssets ? (
                            <button
                              type="button"
                              onClick={() => removeDocument(doc)}
                              className="rounded-full p-2 text-rose-700 hover:bg-rose-50"
                              title="Eliminar documento"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {historyLoading ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
              <FiRefreshCw className="h-4 w-4 animate-spin" />
              Cargando historial
            </div>
          ) : null}
          {historyAsset && !historyLoading && !historyRows.length ? (
            <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Sin movimientos registrados para este activo.</p>
          ) : null}
          {historyAsset && !historyLoading && historyRows.length ? (
            <div className="mt-5 space-y-3">
              {historyRows.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{event.event_type}</p>
                    <span className="text-xs text-slate-500">{formatDate(event.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {[event.from_status_label || event.from_status, event.to_status_label || event.to_status].filter(Boolean).join(" -> ") || "Movimiento registrado"}
                  </p>
                  {event.created_by_name ? <p className="mt-1 text-xs text-slate-500">Por {event.created_by_name}</p> : null}
                  {event.payload?.next ? (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                      <p>Ubicacion: {event.payload.next.current_location || "Sin ubicacion"}</p>
                      <p>Cliente ID: {event.payload.next.client_id || "Sin cliente"}</p>
                      <p>Precio: {formatMoney(event.payload.next.sale_price)}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    );
  };

  const renderModels = () => {
    if (!filteredModels.length) {
      return (
        <EmptyState
          title="No hay modelos con estos filtros"
          detail="Los modelos son la referencia tecnica compartida por negociaciones, business case, consumibles y activos."
          icon={FiCpu}
        />
      );
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {filteredModels.map((model) => (
          <article key={model.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-slate-500">{model.category || "Sin categoria"}</p>
                <h3 className="mt-1 truncate text-base font-semibold text-slate-950">{model.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{[model.manufacturer, model.model].filter(Boolean).join(" / ") || "Sin fabricante/modelo"}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {model.available_count || 0} disponibles
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-lg font-semibold text-slate-950">{model.asset_count || 0}</p>
                <p className="text-xs text-slate-500">Activos</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-lg font-semibold text-slate-950">{model.installed_count || 0}</p>
                <p className="text-xs text-slate-500">En cliente</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-lg font-semibold text-slate-950">{model.procedure_count || 0}</p>
                <p className="text-xs text-slate-500">Procedimientos</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderSchedule = () => {
    if (!filteredSchedule.length) {
      return (
        <EmptyState
          title="No hay mantenimientos programados"
          detail="El cronograma se genera automaticamente al instalar un activo que tenga procedimientos preventivos activos con intervalo."
          icon={FiCalendar}
        />
      );
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {filteredSchedule.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-slate-950">{item.procedure_name}</p>
                <p className="text-sm text-slate-600">
                  {[item.model_name, item.manufacturer, item.model, item.serial_number].filter(Boolean).join(" / ")}
                </p>
                <p className="text-xs text-slate-500">{item.current_location || "Sin ubicacion registrada"}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {item.status}
                </span>
                <span className="text-sm font-semibold text-slate-900">{formatDate(item.scheduled_for)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="WORKSPACE_PAGE_CLASS flex min-w-0 flex-col gap-5 bg-slate-50 p-4 md:p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">Gestion integral</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950 md:text-3xl">Equipos</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Modelos tecnicos, activos con serial, estado operativo, cliente asignado e historial trazable por equipo.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          <FiRefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Actualizar
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Modelos" value={models.length} icon={FiCpu} />
        <Metric label="Activos" value={assets.length} icon={FiBox} />
        <Metric label="Disponibles" value={metrics.available} icon={FiCheckCircle} />
        <Metric label="En servicio" value={metrics.service} icon={FiTool} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                    isActive ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
            <label className="relative block min-w-[240px]">
              <span className="sr-only">Buscar equipos</span>
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                placeholder="Buscar modelo, serial, cliente o ubicacion"
              />
            </label>

            {activeTab === "assets" ? (
              <>
                <label className="sr-only" htmlFor="equipment-status-filter">Estado</label>
                <select
                  id="equipment-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Todos los estados</option>
                  {statuses.map((status) => (
                    <option key={status.code} value={status.code}>{status.label}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="equipment-availability-filter">Disponibilidad</label>
                <select
                  id="equipment-availability-filter"
                  value={availabilityFilter}
                  onChange={(event) => setAvailabilityFilter(event.target.value)}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Toda disponibilidad</option>
                  <option value="available">Disponible para negociar</option>
                  <option value="installed">En cliente</option>
                  <option value="service">En servicio</option>
                </select>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</div> : null}
      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && activeTab === "assets" ? renderAssets() : null}
      {!loading && !error && activeTab === "models" ? renderModels() : null}
      {!loading && !error && activeTab === "schedule" ? renderSchedule() : null}
    </main>
  );
};

export default EquipmentWorkspace;
