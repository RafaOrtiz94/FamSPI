import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCheck,
  FiChevronUp,
  FiCpu,
  FiDownload,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUploadCloud,
  FiUser,
} from "react-icons/fi";
import { useUI } from "../../../core/ui/UIContext";
import { getUsers } from "../../../core/api/usersApi";
import {
  createTiAsset,
  downloadTiActa,
  downloadTiAssetReport,
  downloadTiCollaboratorReport,
  downloadTiMaintenanceReport,
  getTiAssetAssignmentsHistory,
  listTiActas,
  listTiAssets,
  listTiFinancialDocs,
  uploadTiFinancialDoc,
} from "../../../core/api/tiAssetsApi";

const EMPTY_FORM = {
  name: "", brand: "", model: "", serial_number: "", imei: "",
  purchase_date: "", purchase_value: "", maintenance_frequency_months: "12",
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
      setAssignHistory(Array.isArray(hist) ? hist : []);
      setActas(Array.isArray(actasRows) ? actasRows : []);
      setFinancialDocs(Array.isArray(finDocs) ? finDocs : []);
    } catch {
      setAssignHistory([]);
      setActas([]);
      setFinancialDocs([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleFinancialDocUpload = async (docType, file) => {
    if (!selected || !file) return;
    setUploadingDoc(docType);
    try {
      await uploadTiFinancialDoc(selected.id, docType, file);
      showToast(
        docType === "factura" ? "Factura subida correctamente" : "Letra de cambio subida correctamente",
        "success",
      );
      const updated = await listTiFinancialDocs(selected.id);
      setFinancialDocs(Array.isArray(updated) ? updated : []);
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

  const handleSelect = (a) => {
    setSelectedId(a.id);
    loadDetail(a.id);
  };

  // ── Filters ─────────────────────────────────────────────────────────────────

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
    if (!form.serial_number.trim()) return showToast("El número de serie es requerido", "warning");
    if (!form.purchase_date)        return showToast("La fecha de compra es requerida", "warning");
    setSaving(true);
    try {
      await createTiAsset(form);
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
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors active:scale-[0.97]"
          >
            {showCreate ? <FiChevronUp size={14} /> : <FiPlus size={14} />}
            {showCreate ? "Cancelar" : "Nuevo equipo"}
          </button>
        </div>
      </div>

      {/* Create asset form */}
      {showCreate && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 space-y-4">
          <p className="text-sm font-semibold text-blue-800">Registrar nuevo activo TI</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: "name",           label: "Nombre *",          placeholder: "Ej: Laptop Dell XPS", required: true },
              { key: "brand",          label: "Marca",             placeholder: "Ej: Dell" },
              { key: "model",          label: "Modelo",            placeholder: "Ej: XPS 15" },
              { key: "serial_number",  label: "N° de serie *",     placeholder: "Ej: SN-ABC123", required: true },
              { key: "imei",           label: "IMEI",              placeholder: "Solo para móviles" },
              { key: "purchase_value", label: "Valor de compra ($)", placeholder: "Ej: 1200.00", type: "number" },
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
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-1">Fecha de compra *</label>
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
      )}

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
                placeholder="Buscar equipo, serie, colaborador..."
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
                  <p className="text-xs text-slate-400 py-3 text-center">Sin actas generadas</p>
                ) : (
                  <div className="space-y-2">
                    {actas.map((acta) => (
                      <div key={acta.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${acta.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                              {acta.tipo}
                            </span>
                            <span className="text-xs font-mono text-slate-500">{acta.acta_code || `#${String(acta.id).padStart(6, "0")}`}</span>
                            {acta.is_complete
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
                          {acta.is_complete && acta.signed_pdf_drive_url && (
                            <a href={acta.signed_pdf_drive_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100 transition-colors">
                              <FiCheck size={10} /> Firmada
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
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
                    return (
                      <div key={type} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700">{label}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
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
