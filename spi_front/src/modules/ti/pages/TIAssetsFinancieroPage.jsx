import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCamera,
  FiCheck,
  FiCpu,
  FiDownload,
  FiFileText,
  FiImage,
  FiPlus,
  FiPrinter,
  FiRefreshCw,
  FiSearch,
  FiUploadCloud,
  FiUser,
} from "react-icons/fi";
import { useUI } from "../../../core/ui/UIContext";
import { getUsers } from "../../../core/api/usersApi";
import Modal from "../../../core/ui/components/Modal";
import {
  createTiAsset,
  downloadTiActa,
  downloadTiAssetReport,
  downloadTiCollaboratorReport,
  downloadTiMaintenanceReport,
  getTiAssetAssignmentsHistory,
  listTiActas,
  uploadTiLegacyActaSigned,
  listTiAssets,
  listTiFinancialDocs,
  printTiAssetLabel,
  uploadTiAssetInitialConditionPhotos,
  uploadTiFinancialDoc,
} from "../../../core/api/tiAssetsApi";

const EMPTY_FORM = {
  name: "", brand: "", model: "", serial_number: "", imei: "",
  purchase_date: "", purchase_value: "", characteristics: "", maintenance_frequency_months: "12",
  physical_condition_score: "", functional_condition_score: "",
  condition_photos: [], condition_photo_previews: [],
};

// ─── Design tokens (DESIGN.md) ───────────────────────────────────────────────

const STATUS_LABELS = {
  unassigned:    "Sin asignar",
  assigned:      "Asignado",
  damaged:       "Dañado",
  in_maintenance:"En mantenimiento",
  retired:       "Dado de baja",
  available:     "Disponible",
};

const STATUS_COLORS = {
  unassigned:    "bg-slate-100 text-slate-600",
  assigned:      "bg-blue-50 text-blue-700",
  damaged:       "bg-red-50 text-red-700",
  in_maintenance:"bg-amber-50 text-amber-700",
  retired:       "bg-slate-200 text-slate-500",
  available:     "bg-green-50 text-green-700",
};

// ─── Small components ─────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || "bg-slate-100 text-slate-600"}`}>
    {STATUS_LABELS[status] || status}
  </span>
);

const DepBar = ({ pct }) => {
  if (pct == null) return null;
  const color = pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
        <span>Depreciación</span>
        <span className={pct >= 90 ? "text-red-600 font-semibold" : pct >= 60 ? "text-amber-600 font-semibold" : "text-emerald-600 font-semibold"}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{children}</p>
);

const EmptyState = ({ icon: Icon, message }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <Icon size={28} className="text-slate-200 mb-2" />
    <p className="text-sm text-slate-400">{message}</p>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const TIAssetsFinancieroPage = () => {
  const { showToast } = useUI();

  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [assets, setAssets]       = useState([]);
  const [users, setUsers]         = useState([]);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId]     = useState(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);

  // Detail panel
  const [assignHistory, setAssignHistory]   = useState([]);
  const [actas, setActas]                   = useState([]);
  const [detailLoading, setDetailLoading]   = useState(false);
  const [financialDocs, setFinancialDocs]   = useState([]);
  const [uploadingDoc, setUploadingDoc]     = useState(null); // 'factura' | 'letra_de_cambio' | null
  const [invoiceNumberDraft, setInvoiceNumberDraft] = useState("");
  const [uploadingLegacyActa, setUploadingLegacyActa] = useState(false);
  const [printingLabelAssetId, setPrintingLabelAssetId] = useState(null);
  const [conditionBackfill, setConditionBackfill] = useState({ photos: [], previews: [] });
  const [savingConditionPhotos, setSavingConditionPhotos] = useState(false);

  // Reports panel
  const [reportCollab, setReportCollab] = useState("");
  const [reportYear, setReportYear]     = useState(new Date().getFullYear());

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [assetRows, userRows] = await Promise.all([listTiAssets(), getUsers()]);
      setAssets(Array.isArray(assetRows) ? assetRows : []);
      setUsers(Array.isArray(userRows) ? userRows : []);
    } catch {
      showToast("No se pudo cargar activos TI", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadDetail = useCallback(async (assetId) => {
    setDetailLoading(true);
    try {
      const [hist, actasRows, finDocs] = await Promise.all([
        getTiAssetAssignmentsHistory(assetId),
        listTiActas(assetId),
        listTiFinancialDocs(assetId),
      ]);
      const safeFinDocs = Array.isArray(finDocs) ? finDocs : [];
      setAssignHistory(Array.isArray(hist) ? hist : []);
      setActas(Array.isArray(actasRows) ? actasRows : []);
      setFinancialDocs(safeFinDocs);
      const factura = safeFinDocs.find((doc) => doc.doc_type === "factura");
      setInvoiceNumberDraft(String(factura?.invoice_number || ""));
    } catch {
      setAssignHistory([]);
      setActas([]);
      setFinancialDocs([]);
      setInvoiceNumberDraft("");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleFinancialDocUpload = async (docType, file) => {
    if (!selected || !file) return;
    const normalizedInvoiceNumber = String(invoiceNumberDraft || "").trim();
    if (docType === "factura" && !normalizedInvoiceNumber) {
      showToast("Ingresa el número de factura antes de subir el documento.", "warning");
      return;
    }
    setUploadingDoc(docType);
    try {
      await uploadTiFinancialDoc(selected.id, docType, file, {
        invoiceNumber: docType === "factura" ? normalizedInvoiceNumber : "",
      });
      showToast(
        docType === "factura" ? "Factura subida correctamente" : "Letra de cambio subida correctamente",
        "success",
      );
      const updated = await listTiFinancialDocs(selected.id);
      const safeUpdated = Array.isArray(updated) ? updated : [];
      setFinancialDocs(safeUpdated);
      const factura = safeUpdated.find((doc) => doc.doc_type === "factura");
      setInvoiceNumberDraft(String(factura?.invoice_number || normalizedInvoiceNumber || ""));
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo subir el documento", "error");
    } finally {
      setUploadingDoc(null);
    }
  };

  const selected = useMemo(
    () => assets.find((a) => String(a.id) === String(selectedId || "")),
    [assets, selectedId],
  );

  const legacyNoActaAssignment = useMemo(() => {
    const current = assignHistory.find((assignment) => assignment.assigned_to_user_id);
    if (!current) return null;
    const hasSystemActa = actas.some(
      (acta) => acta.tipo === "entrega" && String(acta.recipient_user_id) === String(current.assigned_to_user_id),
    );
    return hasSystemActa ? null : current;
  }, [assignHistory, actas]);

  const handleSelect = (a) => {
    setSelectedId(a.id);
    loadDetail(a.id);
  };

  const handleLegacySignedActaUpload = async (file) => {
    if (!legacyNoActaAssignment || !file) return;
    setUploadingLegacyActa(true);
    try {
      await uploadTiLegacyActaSigned(legacyNoActaAssignment.id, file);
      showToast("Acta histórica subida y vinculada al equipo", "success");
      if (selected) await loadDetail(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo subir el acta histórica", "error");
    } finally {
      setUploadingLegacyActa(false);
    }
  };

  const printAssetLabel = async (asset) => {
    if (!asset?.id) return;
    setPrintingLabelAssetId(asset.id);
    try {
      await printTiAssetLabel(asset.id, asset.asset_code || "");
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo imprimir la etiqueta del activo", "error");
    } finally {
      setPrintingLabelAssetId(null);
    }
  };

  const handleConditionPhotoFiles = (files, { append = true } = {}) => {
    const incoming = Array.from(files || []).filter((file) => file && (!file.type || file.type.startsWith("image/")));
    if (!incoming.length) return;
    setForm((current) => {
      const nextFiles = append
        ? [...current.condition_photos, ...incoming].slice(0, 2)
        : incoming.slice(0, 2);
      return {
        ...current,
        condition_photos: nextFiles,
        condition_photo_previews: nextFiles.map((file) => URL.createObjectURL(file)),
      };
    });
  };

  const removeConditionPhoto = (indexToRemove) => {
    setForm((current) => {
      const nextFiles = current.condition_photos.filter((_, index) => index !== indexToRemove);
      return {
        ...current,
        condition_photos: nextFiles,
        condition_photo_previews: nextFiles.map((file) => URL.createObjectURL(file)),
      };
    });
  };

  // ── Filters ─────────────────────────────────────────────────────────────────

  const handleBackfillConditionPhotoFiles = (files, { append = true } = {}) => {
    const incoming = Array.from(files || []).filter((file) => file && (!file.type || file.type.startsWith("image/")));
    if (!incoming.length) return;
    setConditionBackfill((current) => {
      const nextFiles = append
        ? [...current.photos, ...incoming].slice(0, 2)
        : incoming.slice(0, 2);
      return {
        photos: nextFiles,
        previews: nextFiles.map((file) => URL.createObjectURL(file)),
      };
    });
  };

  const removeBackfillConditionPhoto = (indexToRemove) => {
    setConditionBackfill((current) => {
      const nextFiles = current.photos.filter((_, index) => index !== indexToRemove);
      return {
        photos: nextFiles,
        previews: nextFiles.map((file) => URL.createObjectURL(file)),
      };
    });
  };

  const saveBackfillConditionPhotos = async () => {
    if (!selected?.id) return;
    if (conditionBackfill.photos.length !== 2) {
      return showToast("Debes adjuntar exactamente 2 fotos del estado inicial", "warning");
    }
    setSavingConditionPhotos(true);
    try {
      await uploadTiAssetInitialConditionPhotos(selected.id, conditionBackfill.photos);
      showToast("Fotos de registro cargadas correctamente", "success");
      setConditionBackfill({ photos: [], previews: [] });
      await loadAll();
      await loadDetail(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudieron cargar las fotos de registro", "error");
    } finally {
      setSavingConditionPhotos(false);
    }
  };

  const filtered = useMemo(() => {
    let list = assets;
    if (statusFilter) list = list.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.brand || "").toLowerCase().includes(q) ||
        (a.model || "").toLowerCase().includes(q) ||
        (a.serial_number || "").toLowerCase().includes(q) ||
        (a.imei || "").toLowerCase().includes(q) ||
        (a.invoice_number || "").toLowerCase().includes(q) ||
        (a.assigned_to_name || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [assets, search, statusFilter]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:      assets.length,
    assigned:   assets.filter((a) => a.status === "assigned").length,
    available:  assets.filter((a) => a.status === "available" || a.status === "unassigned").length,
    damaged:    assets.filter((a) => a.status === "damaged" || a.status === "in_maintenance").length,
    deprecated: assets.filter((a) => (a.depreciation_pct || 0) >= 100).length,
  }), [assets]);

  const setField = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleCreateAsset = async () => {
    if (!form.name.trim())          return showToast("El nombre es requerido", "warning");
    const physicalScore = Number(form.physical_condition_score);
    const functionalScore = Number(form.functional_condition_score);
    if (!Number.isInteger(physicalScore) || physicalScore < 1 || physicalScore > 10) return showToast("El estado físico debe ser del 1 al 10", "warning");
    if (!Number.isInteger(functionalScore) || functionalScore < 1 || functionalScore > 10) return showToast("El estado funcional debe ser del 1 al 10", "warning");
    if (form.condition_photos.length !== 2) return showToast("Debes adjuntar exactamente 2 fotos del estado inicial", "warning");
    setSaving(true);
    try {
      const { condition_photo_previews: _previews, ...payload } = form;
      await createTiAsset(payload);
      showToast("Activo registrado correctamente", "success");
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo registrar el activo", "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-w-0 flex-col space-y-5 p-4 sm:p-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Activos de TI</h1>
          <p className="text-xs text-slate-500 mt-0.5">Vista financiera — lectura, depreciación y reportes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors active:scale-[0.97]"
          >
            <FiRefreshCw size={14} /> Actualizar
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors active:scale-[0.97]"
          >
            <FiPlus size={14} />
            Nuevo equipo
          </button>
        </div>
      </div>

      {/* Create asset form */}
      <Modal
        open={showCreate}
        title="Registrar nuevo activo TI"
        maxWidth="max-w-5xl"
        onClose={() => setShowCreate(false)}
        disableClose={saving}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: "name",           label: "Nombre *",          placeholder: "Ej: Laptop Dell XPS", required: true },
              { key: "brand",          label: "Marca",             placeholder: "Ej: Dell" },
              { key: "model",          label: "Modelo",            placeholder: "Ej: XPS 15" },
              { key: "serial_number",  label: "N° de serie",       placeholder: "Opcional, no debe repetirse" },
              { key: "imei",           label: "IMEI",              placeholder: "Solo para móviles" },
              { key: "purchase_value", label: "Valor de compra ($)", placeholder: "Ej: 1200.00", type: "number" },
              { key: "physical_condition_score", label: "Estado físico (1-10) *", placeholder: "Ej: 9", type: "number" },
              { key: "functional_condition_score", label: "Estado funcional (1-10) *", placeholder: "Ej: 10", type: "number" },
            ].map(({ key, label, placeholder, type = "text" }) => (
              <div key={key}>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={setField(key)}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-colors"
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-1">Fecha de compra</label>
              <input
                type="date"
                value={form.purchase_date}
                onChange={setField("purchase_date")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-1">Frec. mantenimiento (meses)</label>
              <select
                value={form.maintenance_frequency_months}
                onChange={setField("maintenance_frequency_months")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-colors"
              >
                {[3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} meses</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-1">Características</label>
              <input
                value={form.characteristics}
                onChange={setField("characteristics")}
                placeholder="RAM, disco, procesador, etc."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-colors"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-1">
                Fotos del estado inicial ({form.condition_photos.length}/2) *
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                  <FiCamera size={15} />
                  Tomar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      handleConditionPhotoFiles(event.target.files, { append: true });
                      event.target.value = "";
                    }}
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">
                  <FiDownload size={15} />
                  Seleccionar archivo
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      handleConditionPhotoFiles(event.target.files, { append: false });
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Toma 2 fotos desde la cÃ¡mara. La selecciÃ³n de archivo queda como respaldo.</p>
              {form.condition_photo_previews.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {form.condition_photo_previews.map((src, index) => (
                    <div key={src} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img src={src} alt={`Estado inicial ${index + 1}`} className="h-28 w-full object-cover" />
                      <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Foto {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeConditionPhoto(index)}
                        className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm hover:bg-white"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleCreateAsset}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors active:scale-[0.97]"
            >
              <FiPlus size={14} />
              {saving ? "Registrando..." : "Registrar equipo"}
            </button>
          </div>
        </div>
      </Modal>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-slate-800" },
          { label: "Asignados", value: stats.assigned, color: "text-blue-700" },
          { label: "Disponibles", value: stats.available, color: "text-emerald-700" },
          { label: "En incidencia", value: stats.damaged, color: "text-amber-700" },
          { label: "Depreciados", value: stats.deprecated, color: "text-red-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <p className="text-xs text-slate-400">{k.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Main panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

        {/* Asset list — col 2/5 */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] flex flex-col">
          {/* Filters */}
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                placeholder="Buscar equipo, serie, IMEI, factura o colaborador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 focus:border-slate-400 focus:outline-none transition-colors"
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          {/* List */}
          <div className="flex-1 overflow-auto p-2 space-y-1 max-h-[520px]">
            {loading ? (
              <EmptyState icon={FiRefreshCw} message="Cargando activos..." />
            ) : filtered.length === 0 ? (
              <EmptyState icon={FiCpu} message={search || statusFilter ? "Sin resultados para este filtro" : "No hay activos registrados"} />
            ) : filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleSelect(a)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer active:scale-[0.98] ${
                  String(selectedId) === String(a.id)
                    ? "border-slate-300 bg-slate-50"
                    : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {[a.brand, a.model].filter(Boolean).join(" · ") || "Sin especificar"}
                    </p>
                    {a.serial_number && <p className="text-xs font-mono text-slate-400 mt-0.5">{a.serial_number}</p>}
                    <p className="text-xs text-slate-500 mt-0.5">{a.assigned_to_name || "Sin asignación"}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <DepBar pct={a.depreciation_pct} />
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel — col 3/5 */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          {!selected ? (
            <EmptyState icon={FiCpu} message="Selecciona un equipo para ver sus detalles" />
          ) : (
            <div className="p-5 space-y-6 overflow-auto max-h-[640px]">

              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[selected.brand, selected.model].filter(Boolean).join(" · ") || "Sin especificar"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <button
                    type="button"
                    onClick={() => printAssetLabel(selected)}
                    disabled={printingLabelAssetId === selected.id}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {printingLabelAssetId === selected.id ? <FiRefreshCw size={11} className="animate-spin" /> : <FiPrinter size={11} />}
                    Etiqueta
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadTiAssetReport(selected.id)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <FiFileText size={11} /> Reporte
                  </button>
                </div>
              </div>

              {/* Depreciation */}
              {selected.depreciation_pct != null && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-slate-600">Depreciación acumulada</span>
                    <span className={`text-sm font-bold ${selected.depreciation_pct >= 90 ? "text-red-600" : selected.depreciation_pct >= 60 ? "text-amber-600" : "text-emerald-600"}`}>
                      {selected.depreciation_pct}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${selected.depreciation_pct >= 90 ? "bg-red-400" : selected.depreciation_pct >= 60 ? "bg-amber-400" : "bg-emerald-400"}`}
                      style={{ width: `${Math.min(selected.depreciation_pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                    <span>Vida útil 3 años</span>
                    <span>Residual: {selected.residual_pct}%</span>
                  </div>
                  {selected.fully_depreciated && (
                    <div className="flex items-center gap-1.5 mt-2 rounded-lg bg-red-50 border border-red-100 px-3 py-1.5">
                      <FiAlertTriangle size={12} className="text-red-500" />
                      <span className="text-xs text-red-700 font-medium">Activo totalmente depreciado</span>
                    </div>
                  )}
                </div>
              )}

              {/* Info fields */}
              <div>
                <SectionLabel>Información del equipo</SectionLabel>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    ["Código",           selected.asset_code || "-"],
                    ["N° de serie",      selected.serial_number || "-"],
                    ["IMEI",             selected.imei || "-"],
                    ["Estado físico",    selected.physical_condition_score ? `${selected.physical_condition_score}/10` : "-"],
                    ["Estado funcional", selected.functional_condition_score ? `${selected.functional_condition_score}/10` : "-"],
                    ["Fecha de compra",  selected.purchase_date ? String(selected.purchase_date).slice(0, 10) : "-"],
                    ["Frec. mantenimiento", `${selected.maintenance_frequency_months || 12} meses`],
                    ["Último mantenimiento", selected.last_maintenance_at ? String(selected.last_maintenance_at).slice(0, 10) : "-"],
                  ].map(([lbl, val]) => (
                    <div key={lbl}>
                      <p className="text-xs text-slate-400">{lbl}</p>
                      <p className="text-slate-800 font-medium">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selected.initial_condition_photos?.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <SectionLabel>Fotos de registro</SectionLabel>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {selected.initial_condition_photos.map((photo) => (
                      <a
                        key={photo.index}
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <img
                          src={photo.url}
                          alt={`Foto de registro ${photo.index}`}
                          className="h-36 w-full object-cover transition-transform group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                        <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <FiImage size={12} /> Foto {photo.index}
                          </span>
                          <span>Ver</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {!selected.initial_condition_photos?.length && (
                <div className="border-t border-slate-100 pt-4">
                  <SectionLabel>Regularizar fotos de registro</SectionLabel>
                  <p className="mb-3 text-xs text-slate-500">
                    Este activo fue registrado sin evidencia fotogrÃ¡fica inicial. Carga exactamente 2 fotos para completar la trazabilidad.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                      <FiCamera size={15} />
                      Tomar foto
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(event) => {
                          handleBackfillConditionPhotoFiles(event.target.files, { append: true });
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">
                      <FiDownload size={15} />
                      Seleccionar archivo
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          handleBackfillConditionPhotoFiles(event.target.files, { append: false });
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {conditionBackfill.previews.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {conditionBackfill.previews.map((src, index) => (
                        <div key={src} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                          <img src={src} alt={`Foto de regularizaciÃ³n ${index + 1}`} className="h-36 w-full object-cover" />
                          <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Foto {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeBackfillConditionPhoto(index)}
                            className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm hover:bg-white"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={savingConditionPhotos || conditionBackfill.photos.length !== 2}
                      onClick={saveBackfillConditionPhotos}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors active:scale-[0.97]"
                    >
                      {savingConditionPhotos ? <FiRefreshCw size={14} className="animate-spin" /> : <FiCamera size={14} />}
                      {savingConditionPhotos ? "Cargando fotos..." : "Guardar fotos"}
                    </button>
                  </div>
                </div>
              )}

              {/* Current assignment */}
              <div className="border-t border-slate-100 pt-4">
                <SectionLabel>Asignación actual</SectionLabel>
                {selected.assigned_to_name ? (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <FiUser size={14} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{selected.assigned_to_name}</p>
                      {selected.assigned_at && (
                        <p className="text-xs text-slate-400">Desde {new Date(selected.assigned_at).toLocaleDateString("es-EC")}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Sin asignación actual</p>
                )}
              </div>

              {/* Assignment history */}
              <div className="border-t border-slate-100 pt-4">
                <SectionLabel>Historial de asignaciones</SectionLabel>
                {detailLoading ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Cargando...</p>
                ) : assignHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Sin movimientos registrados</p>
                ) : (
                  <div className="rounded-xl border border-slate-100 overflow-hidden max-h-48 overflow-y-auto">
                    {assignHistory.map((h, i) => (
                      <div key={h.id} className={`px-3 py-2.5 text-xs ${i < assignHistory.length - 1 ? "border-b border-slate-100" : ""}`}>
                        <p className="font-medium text-slate-700">
                          {h.action === "unassign"
                            ? `Retiro — ${h.previous_user_name || "usuario"}`
                            : `Entrega a ${h.assigned_to_name || "usuario"}`}
                        </p>
                        {h.reason && <p className="text-slate-500 mt-0.5">Motivo: {h.reason}</p>}
                        <p className="text-slate-400 mt-0.5">
                          {new Date(h.created_at).toLocaleString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {h.created_by_name && ` · por ${h.created_by_name}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actas */}
              <div className="border-t border-slate-100 pt-4">
                <SectionLabel>Actas generadas</SectionLabel>
                {detailLoading ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Cargando...</p>
                ) : actas.length === 0 ? (
                  legacyNoActaAssignment ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                      <div className="flex items-start gap-2">
                        <FiAlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-amber-800">Acta histórica previa a SPI</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                            Esta entrega fue registrada antes de que SPI generara actas automáticamente. Carga aquí el PDF del acta firmada para vincularlo al equipo.
                          </p>
                          <label className="mt-2 inline-flex cursor-pointer">
                            <span className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors">
                              {uploadingLegacyActa ? <FiRefreshCw size={11} className="animate-spin" /> : <FiUploadCloud size={11} />}
                              Subir acta firmada histórica
                            </span>
                            <input type="file" accept=".pdf,application/pdf" className="hidden" disabled={uploadingLegacyActa}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLegacySignedActaUpload(f); e.target.value = ""; }} />
                          </label>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-3 text-center">Sin actas generadas</p>
                  )
                ) : (
                  <div className="space-y-2">
                    {legacyNoActaAssignment && (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-[11px] leading-relaxed text-amber-800">Acta histórica previa a SPI. Puedes reemplazar el PDF firmado si es necesario.</p>
                        <label className="inline-flex shrink-0 cursor-pointer">
                          <span className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors">
                            {uploadingLegacyActa ? <FiRefreshCw size={11} className="animate-spin" /> : <FiUploadCloud size={11} />}
                            Reemplazar
                          </span>
                          <input type="file" accept=".pdf,application/pdf" className="hidden" disabled={uploadingLegacyActa}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLegacySignedActaUpload(f); e.target.value = ""; }} />
                        </label>
                      </div>
                    )}
                    {actas.map((acta) => {
                      const isAnnulled = Boolean(acta.is_annulled);
                      return (
                      <div key={acta.id} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${isAnnulled ? "border-red-100 bg-red-50/40" : "border-slate-100 bg-slate-50"}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${acta.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                              {acta.tipo}
                            </span>
                            <span className="text-xs font-mono text-slate-500">{acta.acta_code || `#${String(acta.id).padStart(6, "0")}`}</span>
                            {isAnnulled
                              ? <span className="flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700"><FiAlertTriangle size={9} /> Anulada</span>
                              : acta.is_complete
                              ? <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700"><FiCheck size={9} /> Firmada</span>
                              : <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>
                            }
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {acta.recipient_nombre || "-"} · {new Date(acta.generated_at).toLocaleDateString("es-EC")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button type="button" onClick={() => downloadTiActa(acta.id, acta.tipo)}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:text-slate-900 transition-colors cursor-pointer">
                            <FiDownload size={10} /> Borrador
                          </button>
                          {!isAnnulled && acta.is_complete && acta.signed_pdf_drive_url && (
                            <a href={acta.signed_pdf_drive_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100 transition-colors">
                              <FiCheck size={10} /> Firmada
                            </a>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Documentos financieros */}
              <div className="border-t border-slate-100 pt-4">
                <SectionLabel>Documentos financieros</SectionLabel>
                <div className="space-y-3">
                  {[
                    { type: "factura",         label: "Factura",          desc: "Factura de compra del equipo" },
                    { type: "letra_de_cambio", label: "Letra de cambio",  desc: "Copia de la letra de cambio" },
                  ].map(({ type, label, desc }) => {
                    const doc        = financialDocs.find((d) => d.doc_type === type);
                    const uploading  = uploadingDoc === type;
                    const isFactura  = type === "factura";
                    return (
                      <div key={type} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700">{label}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                            {isFactura ? (
                              <div className="mt-3 max-w-xs">
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                  Número de factura
                                </label>
                                <input
                                  type="text"
                                  value={invoiceNumberDraft}
                                  onChange={(e) => setInvoiceNumberDraft(e.target.value)}
                                  placeholder="Ej: 001-001-000123456"
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                                />
                              </div>
                            ) : null}
                            {doc ? (
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                  <FiCheck size={9} /> Subido
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                                  {doc.filename}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(doc.uploaded_at).toLocaleDateString("es-EC")}
                                </span>
                                {isFactura && doc.invoice_number ? (
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-mono text-slate-500 border border-slate-200">
                                    Factura {doc.invoice_number}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="inline-flex mt-1.5 items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                Pendiente
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Download if exists */}
                            {doc?.drive_url && (
                              <a
                                href={doc.drive_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                              >
                                <FiDownload size={11} />
                              </a>
                            )}
                            {/* Upload button */}
                            <label className="cursor-pointer">
                              <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                                uploading
                                  ? "border-slate-200 bg-slate-100 text-slate-400 cursor-wait"
                                  : doc
                                  ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                              }`}>
                                {uploading ? (
                                  <><FiRefreshCw size={11} className="animate-spin" /> Subiendo...</>
                                ) : (
                                  <><FiUploadCloud size={11} /> {doc ? "Reemplazar" : "Subir"}</>
                                )}
                              </span>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                                className="hidden"
                                disabled={!!uploadingDoc}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleFinancialDocUpload(type, f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* SHA-256 integrity chip */}
                        {doc?.sha256 && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">SHA-256:</span>
                            <span
                              className="font-mono text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer hover:bg-slate-50"
                              title={doc.sha256}
                              onClick={() => navigator.clipboard?.writeText(doc.sha256)}
                            >
                              {String(doc.sha256).slice(0, 14)}…
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Reports section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5">
        <div className="flex items-center gap-2 mb-5">
          <FiBarChart2 size={15} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-800">Reportes PDF</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

          {/* By equipment */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">Por equipo</p>
            <p className="text-xs text-slate-400">Historial completo, actas y depreciación de un activo.</p>
            <select
              value={selectedId || ""}
              onChange={(e) => { const found = assets.find((a) => String(a.id) === e.target.value); if (found) handleSelect(found); }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
            >
              <option value="">Selecciona un equipo</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}{a.serial_number ? ` · ${a.serial_number}` : ""}</option>)}
            </select>
            {selectedId && (
              <button
                type="button"
                onClick={() => downloadTiAssetReport(selectedId)}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors active:scale-[0.97] cursor-pointer w-full"
              >
                <FiDownload size={13} /> Descargar PDF
              </button>
            )}
          </div>

          {/* By collaborator */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">Por colaborador</p>
            <p className="text-xs text-slate-400">Todos los activos asignados (actuales e históricos) de una persona.</p>
            <select
              value={reportCollab}
              onChange={(e) => setReportCollab(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
            >
              <option value="">Selecciona un colaborador</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullname || u.name || u.email}</option>)}
            </select>
            {reportCollab && (
              <button
                type="button"
                onClick={() => downloadTiCollaboratorReport(reportCollab)}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors active:scale-[0.97] cursor-pointer w-full"
              >
                <FiDownload size={13} /> Descargar PDF
              </button>
            )}
          </div>

          {/* General / maintenance */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">General (cronograma)</p>
            <p className="text-xs text-slate-400">Cronograma de mantenimientos de todos los activos para el año.</p>
            <input
              type="number"
              min={2020}
              max={2100}
              value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value || new Date().getFullYear()))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
            />
            <button
              type="button"
              onClick={() => downloadTiMaintenanceReport({ period_type: "annual", year: reportYear })}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors active:scale-[0.97] cursor-pointer w-full"
            >
              <FiDownload size={13} /> Descargar PDF
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};

export default TIAssetsFinancieroPage;
