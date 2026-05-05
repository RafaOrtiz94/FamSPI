import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiRefreshCw, FiUpload, FiTrash2, FiCheckCircle, FiXCircle,
  FiMapPin, FiCalendar, FiFileText, FiChevronDown, FiChevronUp, FiAlertTriangle,
} from "react-icons/fi";
import {
  listViaticos,
  listViaticosCandidates,
  upsertViatico,
  updateViaticoStatus,
  listViaticoInvoices,
  uploadViaticoInvoicesTxt,
  deleteViaticoInvoice,
  patchViaticoInvoice,
  getViaticoReport,
} from "../../../core/api/viaticosApi";
import { useUI } from "../../../core/ui/UIContext";
import { useAuth } from "../../../core/auth/AuthContext";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../core/api";

const toMoney = (v, cur = "USD") =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: cur, minimumFractionDigits: 2 }).format(
    Number.isFinite(Number(v)) ? Number(v) : 0
  );

const fmtDate = (v) => {
  if (!v) return "â€”";
  return String(v).slice(0, 10);
};

const fmtDateTime = (v) => {
  if (!v) return "â€”";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "â€”";
  return d.toLocaleString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const monthRange = () => {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
};

const normalizeRoles = (user) =>
  [user?.scope, user?.role, user?.role_name, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .flatMap((r) => String(r || "").split(","))
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);

const FINANCE_ROLES = ["finanzas", "jefe_finanzas", "jefe_financiero", "gerencia", "gerencia_general", "admin", "administrador"];

const STATUS_BADGE = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  paid: "bg-blue-100 text-blue-800",
  rejected: "bg-rose-100 text-rose-800",
};
const STATUS_LABEL = { pending: "Pendiente", approved: "Aprobado", paid: "Pagado", rejected: "Rechazado" };

const INV_STATUS_BADGE = {
  pendiente_clasificacion: "bg-amber-100 text-amber-700",
  aprobada: "bg-emerald-100 text-emerald-700",
  rechazada: "bg-rose-100 text-rose-700",
};

function Section({ title, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-800">{title}</span>
          {badge != null && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{badge}</span>
          )}
        </div>
        {open ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100 px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

const ViaticosWorkspace = () => {
  const { showToast, showLoader, hideLoader } = useUI();
  const { user } = useAuth();
  const roleList = useMemo(() => normalizeRoles(user), [user]);
  const isFinance = roleList.some((r) => FINANCE_ROLES.includes(r));

  const range = useMemo(() => monthRange(), []);
  const [filters, setFilters] = useState({ start: range.start, end: range.end });

  const [candidates, setCandidates] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [loading, setLoading] = useState(true);

  const [invoicesMap, setInvoicesMap] = useState({});
  const [invoicesLoading, setInvoicesLoading] = useState({});

  const [txtMap, setTxtMap] = useState({});        // { [id]: { file, content } }
  const [txtUploading, setTxtUploading] = useState({});

  const [expanded, setExpanded] = useState(null);

  const [candidateDrafts, setCandidateDrafts] = useState({});

  const [reports, setReports] = useState({});

  const [saving, setSaving] = useState({});

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const params = { start_date: filters.start, end_date: filters.end };
      const [avData, candData] = await Promise.all([
        listViaticos(params),
        listViaticosCandidates(params).catch(() => []),
      ]);
      setAllowances(Array.isArray(avData) ? avData : []);
      setCandidates(Array.isArray(candData) ? candData : []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Error cargando viáticos", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters.start, filters.end, showToast]);

  useEffect(() => { loadData(); }, [loadData]);
  useScopedAutoUpdate(DATA_UPDATE_SCOPES.VIATICOS, () => loadData({ silent: true }), [loadData]);

  const loadInvoices = useCallback(async (allowanceId) => {
    setInvoicesLoading((p) => ({ ...p, [allowanceId]: true }));
    try {
      const data = await listViaticoInvoices(allowanceId);
      setInvoicesMap((p) => ({ ...p, [allowanceId]: Array.isArray(data) ? data : [] }));
    } catch {
      setInvoicesMap((p) => ({ ...p, [allowanceId]: [] }));
    } finally {
      setInvoicesLoading((p) => ({ ...p, [allowanceId]: false }));
    }
  }, []);

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => {
      const next = prev === id ? null : id;
      if (next && !invoicesMap[next]) loadInvoices(next);
      return next;
    });
  }, [invoicesMap, loadInvoices]);

  const handleTxtFileChange = (allowanceId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setTxtMap((p) => ({ ...p, [allowanceId]: { file, content: e.target.result } }));
    };
    reader.readAsText(file, "utf-8");
  };

  const handleUploadTxt = async (allowanceId) => {
    const entry = txtMap[allowanceId];
    if (!entry?.content) { showToast("Selecciona un archivo TXT", "warning"); return; }
    setTxtUploading((p) => ({ ...p, [allowanceId]: true }));
    showLoader("Cargando facturas desde TXT...");
    try {
      const result = await uploadViaticoInvoicesTxt(allowanceId, entry.content);
      showToast(`${result.loaded} facturas cargadas, ${result.skipped} omitidas`, "success");
      setTxtMap((p) => ({ ...p, [allowanceId]: null }));
      await loadInvoices(allowanceId);
      await loadData({ silent: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Error procesando TXT", "error");
    } finally {
      hideLoader();
      setTxtUploading((p) => ({ ...p, [allowanceId]: false }));
    }
  };

  const handleDeleteInvoice = async (allowanceId, invoiceId) => {
    const key = `del-inv-${invoiceId}`;
    setSaving((p) => ({ ...p, [key]: true }));
    try {
      await deleteViaticoInvoice(invoiceId);
      setInvoicesMap((p) => ({
        ...p,
        [allowanceId]: (p[allowanceId] || []).filter((i) => i.id !== invoiceId),
      }));
      showToast("Factura eliminada", "success");
      await loadData({ silent: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Error eliminando factura", "error");
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  const handlePatchInvoice = async (allowanceId, invoiceId, patch) => {
    const key = `patch-inv-${invoiceId}`;
    setSaving((p) => ({ ...p, [key]: true }));
    try {
      await patchViaticoInvoice(invoiceId, patch);
      await loadInvoices(allowanceId);
    } catch (err) {
      showToast(err?.response?.data?.message || "Error actualizando factura", "error");
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  const handleCreateFromCandidate = async (item, outsideLaborArea) => {
    const key = `cand-${item.source_type}-${item.source_id}`;
    setSaving((p) => ({ ...p, [key]: true }));
    showLoader("Guardando clasificacion...");
    try {
      await upsertViatico({
        source_type: item.source_type,
        source_id: item.source_id,
        visit_date: item.visit_date,
        city: item.city || "",
        amount: 0,
        outside_labor_area: Boolean(outsideLaborArea),
        notes: item.reference_name || "",
      });
      showToast("Clasificacion guardada", "success");
      setCandidateDrafts((p) => ({ ...p, [key]: { outside_labor_area: Boolean(outsideLaborArea) } }));
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || "Error guardando clasificacion", "error");
    } finally {
      hideLoader();
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  const handlePatchStatus = async (allowanceId, status, extraPayload = {}) => {
    if (!isFinance) return;
    const key = `status-${allowanceId}`;
    setSaving((p) => ({ ...p, [key]: true }));
    showLoader(status === "approved" ? "Aprobando..." : status === "rejected" ? "Rechazando..." : "Actualizando...");
    try {
      await updateViaticoStatus(allowanceId, { status, ...extraPayload });
      showToast("Estado actualizado", "success");
      await loadData({ silent: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Error actualizando estado", "error");
    } finally {
      hideLoader();
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  const handleBuildReport = async (allowanceId) => {
    const key = `report-${allowanceId}`;
    setSaving((p) => ({ ...p, [key]: true }));
    showLoader("Cotejando asistencia...");
    try {
      const data = await getViaticoReport(allowanceId);
      setReports((p) => ({ ...p, [allowanceId]: data }));
      showToast("Reporte generado", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Error generando reporte", "error");
    } finally {
      hideLoader();
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  const summary = useMemo(() =>
    allowances.reduce(
      (acc, a) => {
        acc.total += Number(a.amount || 0);
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, paid: 0, rejected: 0 }
    ), [allowances]);

  const operationalCandidates = useMemo(
    () => candidates.filter((c) => c.source_type === "operational_exit"),
    [candidates]
  );
  const myAllowances = useMemo(
    () => allowances.filter((a) => isFinance || String(a.requester_email || "").toLowerCase() === String(user?.email || "").toLowerCase()),
    [allowances, isFinance, user]
  );

  return (
    <div className="space-y-5 p-3 sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Viáticos</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isFinance ? "Revisión y procesamiento de solicitudes de viáticos" : "Solicitudes y comprobantes de tus salidas operacionales"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={filters.start} onChange={(e) => setFilters((p) => ({ ...p, start: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <span className="text-slate-400 text-sm"></span>
          <input type="date" value={filters.end} onChange={(e) => setFilters((p) => ({ ...p, end: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <FiRefreshCw size={14} /> Recargar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Pendientes", val: summary.pending, color: "text-amber-700" },
          { label: "Aprobados", val: summary.approved, color: "text-emerald-700" },
          { label: "Pagados", val: summary.paid, color: "text-blue-700" },
          { label: "Rechazados", val: summary.rejected, color: "text-rose-700" },
          { label: "Monto total", val: toMoney(summary.total), color: "text-slate-900", big: true },
        ].map(({ label, val, color, big }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`mt-1 ${big ? "text-lg" : "text-2xl"} font-bold ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      {!isFinance && operationalCandidates.length > 0 && (
        <Section title="Salidas operacionales" badge={operationalCandidates.length} defaultOpen>
          <p className="mb-4 text-sm text-slate-500">
            Clasifica cada salida como dentro o fuera del area de labores. Las salidas fuera del area aplican a viatico.
          </p>
          <div className="space-y-3">
            {operationalCandidates.map((item) => {
              const key = `cand-${item.source_type}-${item.source_id}`;
              const draft = candidateDrafts[key] || { outside_labor_area: Boolean(item.outside_labor_area) };
              const isSaving = Boolean(saving[key]);
              return (
                <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-800">
                        {item.reference_name || item.city || "Salida operacional"}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><FiCalendar size={11} /> Inicio: {fmtDateTime(item.hora_entrada)}</span>
                        <span className="inline-flex items-center gap-1"><FiCalendar size={11} /> Cierre: {fmtDateTime(item.hora_salida)}</span>
                        {item.city && <span className="inline-flex items-center gap-1"><FiMapPin size={11} /> {item.city}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                        <div
                          onClick={() => setCandidateDrafts((p) => ({ ...p, [key]: { outside_labor_area: !draft.outside_labor_area } }))}
                          className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${draft.outside_labor_area ? "bg-blue-600" : "bg-slate-300"}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${draft.outside_labor_area ? "translate-x-5" : ""}`} />
                        </div>
                        <span className={draft.outside_labor_area ? "font-semibold text-blue-700" : "text-slate-500"}>
                          {draft.outside_labor_area ? "Fuera del area (aplica viatico)" : "Dentro del area"}
                        </span>
                      </label>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleCreateFromCandidate(item, draft.outside_labor_area)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                      >
                        {isSaving ? "Guardando..." : (item.allowance_id ? "Actualizar clasificacion" : "Guardar clasificacion")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Cargando viáticos...</div>
        ) : myAllowances.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-slate-500 text-sm">No hay viáticos en el período seleccionado.</p>
            {!isFinance && (
              <p className="mt-2 text-xs text-slate-400">Los viáticos se crean desde las salidas operacionales completadas y clasificadas como "fuera del área".</p>
            )}
          </div>
        ) : (
          myAllowances.map((item) => {
            const isExpanded = expanded === item.id;
            const invoices = invoicesMap[item.id] || [];
            const invLoading = Boolean(invoicesLoading[item.id]);
            const txtEntry = txtMap[item.id];
            const isTxtUploading = Boolean(txtUploading[item.id]);
            const report = reports[item.id];
            const isOwnRecord = String(item.requester_email || "").toLowerCase() === String(user?.email || "").toLowerCase();
            const canEdit = isOwnRecord && !isFinance && item.status === "pending";

            const invoiceTotal = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
            const inRangeCount = invoices.filter((i) => i.in_trip_date_range).length;
            const outRangeCount = invoices.length - inRangeCount;

            return (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 truncate">
                        {item.requester_name || item.requester_email}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[item.status] || "bg-slate-100 text-slate-600"}`}>
                        {STATUS_LABEL[item.status] || item.status}
                      </span>
                      {item.outside_labor_area && (
                        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">Fuera de Ã¡rea</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><FiCalendar size={11} /> {fmtDate(item.visit_date)}</span>
                      {item.city && <span className="inline-flex items-center gap-1"><FiMapPin size={11} /> {item.city}</span>}
                      <span className="inline-flex items-center gap-1"><FiFileText size={11} /> {item.docs_count || invoices.length || 0} docs {toMoney(item.invoices_total || invoiceTotal)}</span>
                      <span className="text-slate-400">#{item.id} Â· {item.source_type}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 mt-1">
                    {isExpanded ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 pb-6 pt-4 space-y-5">

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Detalle del viaje</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
                        <div><p className="text-[11px] text-slate-400">Monto solicitado</p><p className="font-semibold">{toMoney(item.amount)}</p></div>
                        <div><p className="text-[11px] text-slate-400">Aprobado</p><p className="font-semibold">{toMoney(item.approved_amount || 0)}</p></div>
                        <div><p className="text-[11px] text-slate-400">Total facturas</p><p className="font-semibold">{toMoney(invoiceTotal)}</p></div>
                        <div><p className="text-[11px] text-slate-400">Asistencia</p><p className="font-semibold capitalize">{item.attendance_check_status || "sin verificar"}</p></div>
                      </div>
                      {item.notes && <p className="mt-2 text-xs text-slate-500">Nota: {item.notes}</p>}
                    </div>

                    {/* TXT upload (requester, pending) */}
                    {canEdit && (
                      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
                        <p className="text-sm font-semibold text-blue-800">Cargar comprobantes desde TXT del SRI</p>
                        <p className="text-xs text-blue-600 leading-5">
                          Descarga el archivo de comprobantes recibidos desde el portal del SRI (formato: <code>RUC_Recibidos.txt</code>). El sistema filtrarÃ¡ automÃ¡ticamente las facturas que correspondan al perÃ­odo del viaje.
                        </p>
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="flex-1">
                            <span className="text-xs text-blue-700 font-medium">Archivo TXT del SRI</span>
                            <input
                              type="file"
                              accept=".txt,text/plain"
                              onChange={(e) => handleTxtFileChange(item.id, e.target.files?.[0] || null)}
                              className="mt-1 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={!txtEntry?.content || isTxtUploading}
                            onClick={() => handleUploadTxt(item.id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                          >
                            <FiUpload size={14} />
                            {isTxtUploading ? "Procesando..." : "Cargar facturas"}
                          </button>
                        </div>
                        {txtEntry?.file && (
                          <p className="text-xs text-blue-700">Archivo seleccionado: <strong>{txtEntry.file.name}</strong></p>
                        )}
                      </div>
                    )}

                    {/* Invoice list */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-700">
                          Facturas cargadas
                          {invoices.length > 0 && (
                            <span className="ml-2 text-xs text-slate-400">
                              {inRangeCount} en rango del viaje {outRangeCount} fuera del rango Total: {toMoney(invoiceTotal)}
                            </span>
                          )}
                        </p>
                        <button type="button" onClick={() => loadInvoices(item.id)} className="text-xs text-slate-400 hover:text-slate-600 inline-flex items-center gap-1">
                          <FiRefreshCw size={11} /> Recargar
                        </button>
                      </div>

                      {invLoading ? (
                        <p className="text-xs text-slate-400 py-3">Cargando facturas...</p>
                      ) : invoices.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                          No hay facturas cargadas aÃºn.
                          {canEdit && " Usa el cargador TXT para agregar comprobantes del SRI."}
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                              <tr>
                                <th className="px-3 py-2 text-left">Emisor</th>
                                <th className="px-3 py-2 text-left">Fecha</th>
                                <th className="px-3 py-2 text-right">Total</th>
                                <th className="px-3 py-2 text-center">Rango</th>
                                {isFinance && <th className="px-3 py-2 text-center">Estado</th>}
                                <th className="px-3 py-2 text-center">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {invoices.map((inv) => {
                                const delKey = `del-inv-${inv.id}`;
                                const patchKey = `patch-inv-${inv.id}`;
                                return (
                                  <tr key={inv.id} className={`hover:bg-slate-50 transition-colors ${!inv.in_trip_date_range ? "opacity-60" : ""}`}>
                                    <td className="px-3 py-2">
                                      <p className="font-medium text-slate-800 truncate max-w-[180px]">{inv.supplier_name || inv.supplier_ruc || "â€”"}</p>
                                      <p className="text-slate-400">{inv.supplier_ruc}</p>
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">{fmtDate(inv.issue_date)}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{toMoney(inv.total)}</td>
                                    <td className="px-3 py-2 text-center">
                                      {inv.in_trip_date_range
                                        ? <span className="inline-flex items-center gap-1 text-emerald-600"><FiCheckCircle size={12} /> SÃ­</span>
                                        : <span className="inline-flex items-center gap-1 text-amber-500"><FiAlertTriangle size={12} /> Fuera</span>}
                                    </td>
                                    {isFinance && (
                                      <td className="px-3 py-2 text-center">
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${INV_STATUS_BADGE[inv.status] || "bg-slate-100 text-slate-600"}`}>
                                          {inv.status || "â€”"}
                                        </span>
                                      </td>
                                    )}
                                    <td className="px-3 py-2 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        {isFinance && inv.status !== "aprobada" && (
                                          <button
                                            type="button"
                                            disabled={saving[patchKey]}
                                            onClick={() => handlePatchInvoice(item.id, inv.id, { status: "aprobada" })}
                                            className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                          >
                                            <FiCheckCircle size={12} />
                                          </button>
                                        )}
                                        {isFinance && inv.status !== "rechazada" && (
                                          <button
                                            type="button"
                                            disabled={saving[patchKey]}
                                            onClick={() => handlePatchInvoice(item.id, inv.id, { status: "rechazada" })}
                                            className="rounded-lg bg-rose-50 border border-rose-200 px-2 py-1 text-rose-700 hover:bg-rose-100 transition-colors"
                                          >
                                            <FiXCircle size={12} />
                                          </button>
                                        )}
                                        {(canEdit || isFinance) && (
                                          <button
                                            type="button"
                                            disabled={saving[delKey]}
                                            onClick={() => handleDeleteInvoice(item.id, inv.id)}
                                            className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-slate-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors"
                                          >
                                            <FiTrash2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-50">
                                <td colSpan={2} className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total</td>
                                <td className="px-3 py-2 text-right text-xs font-bold text-slate-900">{toMoney(invoiceTotal)}</td>
                                <td colSpan={isFinance ? 3 : 2} />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>

                    {isFinance && report && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2 text-sm">
                        <p className="font-semibold text-emerald-800">Cotejo de asistencia</p>
                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <div><p className="text-emerald-600">Estado asistencia</p><p className="font-semibold capitalize">{report.attendance?.status}</p></div>
                          <div><p className="text-emerald-600">Distancia mín.</p><p className="font-semibold">{report.attendance?.min_distance_km != null ? `${Number(report.attendance.min_distance_km).toFixed(1)} km` : "â€”"}</p></div>
                          <div><p className="text-emerald-600">Fuera de Área</p><p className="font-semibold">{report.rules?.outside_labor_area ? "SÃ­" : "No"}</p></div>
                          <div><p className="text-emerald-600">Monto sugerido</p><p className="font-semibold">{toMoney(report.recommendation?.suggested_amount || 0)}</p></div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {isFinance && (
                        <>
                          <button
                            type="button"
                            disabled={saving[`report-${item.id}`]}
                            onClick={() => handleBuildReport(item.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100 transition-colors"
                          >
                            <FiFileText size={14} /> Cotejar asistencia
                          </button>
                          {item.status === "pending" && (
                            <>
                              <button
                                type="button"
                                disabled={saving[`status-${item.id}`]}
                                onClick={() => handlePatchStatus(item.id, "approved")}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100 transition-colors"
                              >
                                <FiCheckCircle size={14} /> Aprobar
                              </button>
                              <button
                                type="button"
                                disabled={saving[`status-${item.id}`]}
                                onClick={() => handlePatchStatus(item.id, "rejected")}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100 transition-colors"
                              >
                                <FiXCircle size={14} /> Rechazar
                              </button>
                            </>
                          )}
                          {item.status === "approved" && (
                            <button
                              type="button"
                              disabled={saving[`status-${item.id}`]}
                              onClick={() => handlePatchStatus(item.id, "paid")}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <FiCheckCircle size={14} /> Marcar pagado
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ViaticosWorkspace;
