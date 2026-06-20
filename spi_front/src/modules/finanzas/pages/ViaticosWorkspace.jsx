import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiRefreshCw, FiUpload, FiTrash2, FiCheckCircle, FiXCircle,
  FiMapPin, FiCalendar, FiFileText, FiChevronDown, FiChevronUp, FiAlertTriangle,
  FiSearch, FiLayers, FiPlay,
} from "react-icons/fi";
import {
  listViaticos,
  listViaticosCandidates,
  upsertViatico,
  updateViaticoStatus,
  listViaticoInvoices,
  deleteViaticoInvoice,
  patchViaticoInvoice,
  getViaticoReport,
  listManualNotes,
  updateManualNote,
  deleteManualNote,
  listPurchasesNoInvoice,
  approveViaticoSegment,
} from "../../../core/api/viaticosApi";
import { useUI } from "../../../core/ui/UIContext";
import { useAuth } from "../../../core/auth/AuthContext";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../core/api";
import Modal from "../../../core/ui/components/Modal";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import ConsolidatedSummary from "../components/viaticos/ConsolidatedSummary";
import ManualNotesTable from "../components/viaticos/ManualNotesTable";
import PurchaseNoInvoiceTable from "../components/viaticos/PurchaseNoInvoiceTable";
import ViaticosWizard from "../components/viaticos/ViaticosWizard";

const toMoney = (v, cur = "USD") =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: cur, minimumFractionDigits: 2 }).format(
    Number.isFinite(Number(v)) ? Number(v) : 0
  );

const fmtDate = (v) => {
  if (!v) return "—";
  return String(v).slice(0, 10);
};

const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
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

const normalizeSearchText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const matchesSearch = (item, query, extraValues = []) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const haystack = [
    item?.id,
    item?.source_type,
    item?.source_id,
    item?.requester_name,
    item?.requester_email,
    item?.reference_name,
    item?.city,
    item?.status,
    item?.workflow_status,
    item?.attendance_check_status,
    item?.visit_date,
    item?.hora_entrada,
    item?.hora_salida,
    item?.notes,
    ...extraValues,
  ].map(normalizeSearchText).join(" ");
  return haystack.includes(normalizedQuery);
};

const FINANCE_ROLES = ["finanzas", "financiero", "jefe_finanzas", "jefe_financiero", "gerencia", "gerencia_general", "admin", "administrador"];

const STATUS_BADGE = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  paid: "bg-blue-100 text-blue-800",
  rejected: "bg-rose-100 text-rose-800",
};
const STATUS_LABEL = { pending: "Pendiente", approved: "Aprobado", paid: "Pagado", rejected: "Rechazado" };
const WORKFLOW_LABEL = {
  borrador: "Borrador",
  pendiente_revision: "Pendiente revisión",
  observado: "Corrección solicitada",
  aprobado_jefe: "Aprobado por jefe",
  rechazado_jefe: "Rechazado por jefe",
  pendiente_financiero: "Pendiente financiero",
  aprobado_financiero: "Aprobado financiero",
  rechazado_financiero: "Rechazado financiero",
  pendiente_aprobacion_talento: "Pendiente talento humano",
  pendiente_aprobacion_financiera: "Pendiente financiero",
  pendiente_aprobacion_mixta: "Pendiente aprobacion mixta",
  aprobado_talento_humano: "Aprobado talento humano",
  aprobado_mixto: "Aprobado mixto",
  devolucion_registrada: "Devolucion registrada",
  pago_banco_registrado: "Pago al banco registrado",
  cierre_mixto_registrado: "Cierre mixto registrado",
  listo_pago: "Listo para pago",
  pagado: "Pagado",
  cerrado: "Cerrado",
};

const INV_STATUS_BADGE = {
  pendiente_clasificacion: "bg-amber-100 text-amber-700",
  clasificada: "bg-sky-100 text-sky-700",
  aprobada: "bg-emerald-100 text-emerald-700",
  rechazada: "bg-rose-100 text-rose-700",
};
const EXPENSE_CATEGORY_OPTIONS = [
  { value: "combustible", label: "COMBUSTIBLE" },
  { value: "alimentacion", label: "ALIMENTACION" },
  { value: "hospedaje", label: "HOSPEDAJE" },
  { value: "transporte", label: "TRANSPORTE" },
  { value: "movilidad", label: "MOVILIDAD" },
  { value: "materiales", label: "MATERIALES" },
];
const EXPENSE_MODE_LABEL = {
  with_card: "Con tarjeta",
  without_card: "Sin tarjeta",
};

const surfaceClass = "rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]";
const focusClass = "focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2";
const controlClass = `${focusClass} min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-blue-600`;
const primaryButtonClass = `${focusClass} inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60`;
const secondaryButtonClass = `${focusClass} inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60`;
const ghostButtonClass = `${focusClass} inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60`;

const WizardOnlyNotice = ({ onOpen, title = "Este viatico se procesa solo desde el wizard", detail }) => (
  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          {detail || "Usa el flujo guiado para cargar facturas del SRI, notas manuales, compras sin factura y enviar la solicitud a revision."}
        </p>
      </div>
      <button type="button" onClick={onOpen} className={`${primaryButtonClass} shrink-0`}>
        <FiPlay size={14} />
        Abrir wizard
      </button>
    </div>
  </div>
);

// ── Helpers de agrupación ────────────────────────────────────────────────────

function getISOWeek(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { year: d.getFullYear(), week };
}

function groupAllowancesByPeriod(items, mode) {
  const map = new Map();
  for (const item of items) {
    const date = String(item.visit_date || "").slice(0, 10);
    let key, label;
    if (mode === "week") {
      const { year, week } = getISOWeek(date);
      key = `${year}-W${String(week).padStart(2, "0")}`;
      label = `Semana ${week} · ${year}`;
    } else {
      key = date.slice(0, 7);
      const [yr, mo] = key.split("-");
      const monthName = new Date(Number(yr), Number(mo) - 1, 1)
        .toLocaleString("es-EC", { month: "long" });
      label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${yr}`;
    }
    if (!map.has(key)) map.set(key, { key, label, items: [] });
    map.get(key).items.push(item);
  }
  return Array.from(map.values());
}

function getExpenseModeLabel(value) {
  return EXPENSE_MODE_LABEL[value] || "Sin definir";
}

function getAllowanceModeBreakdown(item) {
  const withCardTotal = Number(item?.total_with_card || 0);
  const withoutCardTotal = Number(item?.total_without_card || 0);
  return {
    withCardTotal,
    withoutCardTotal,
    requiresFinanceApproval: Boolean(item?.requires_finance_approval),
    requiresTalentoApproval: Boolean(item?.requires_talento_approval),
  };
}

function getSettlementActionLabel(item) {
  const { withCardTotal, withoutCardTotal } = getAllowanceModeBreakdown(item);
  if (withCardTotal > 0 && withoutCardTotal > 0) return "Registrar cierre mixto";
  if (withCardTotal > 0) return "Registrar pago al banco";
  return "Registrar devolucion";
}

function getAllowanceProgressBadge(item) {
  const wf = String(item.workflow_status || "").toLowerCase();
  if (["pendiente_revision", "aprobado_jefe", "rechazado_jefe",
    "pendiente_financiero", "aprobado_financiero", "rechazado_financiero",
    "listo_pago", "pagado", "cerrado"].includes(wf)) {
    return null; // usa el badge de workflow normal
  }
  const hasDocs = Number(item.docs_count || 0) > 0 || Number(item.invoices_total || 0) > 0;
  if (!hasDocs) return { label: "Sin documentos", cls: "bg-amber-100 text-amber-700" };
  return { label: "En progreso", cls: "bg-sky-100 text-sky-700" };
}

// ── Sub-componentes UI ────────────────────────────────────────────────────────

function Section({ title, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`${surfaceClass} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex min-h-[56px] w-full cursor-pointer touch-manipulation items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-slate-50 active:scale-[0.99] sm:px-5 ${focusClass}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-slate-900">{title}</span>
          {badge != null && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{badge}</span>
          )}
        </div>
        {open ? <FiChevronUp className="shrink-0 text-slate-500" /> : <FiChevronDown className="shrink-0 text-slate-500" />}
      </button>
      {open && <div className="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5">{children}</div>}
    </section>
  );
}

const SearchField = ({ value, onChange, placeholder, label }) => (
  <label className="block w-full">
    <span className="mb-1.5 block text-xs font-medium text-slate-700">{label}</span>
    <span className="relative block">
      <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${controlClass} w-full pl-9`}
      />
    </span>
  </label>
);

const EmptyState = ({ title, detail, icon: Icon = FiFileText }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
    <Icon className="mb-3 h-9 w-9 text-slate-300" />
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    {detail ? <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{detail}</p> : null}
  </div>
);

const LoadingState = () => (
  <div className={`${surfaceClass} flex min-h-[220px] items-center justify-center px-6 py-8`}>
    <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
      <FiRefreshCw className="h-5 w-5 animate-spin text-blue-600" />
      Cargando viáticos
    </div>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <FiAlertTriangle className="h-5 w-5 shrink-0 text-rose-700" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-rose-900">No se pudieron cargar los viáticos</p>
        <p className="mt-1 text-sm text-rose-700">{message}</p>
      </div>
      <button type="button" onClick={onRetry} className={`${secondaryButtonClass} border-rose-300 text-rose-800 hover:bg-rose-100`}>
        Reintentar
      </button>
    </div>
  </div>
);

// ── Componente principal ──────────────────────────────────────────────────────

const ViaticosWorkspace = () => {
  const { showToast, showLoader, hideLoader } = useUI();
  const { user } = useAuth();
  const roleList = useMemo(() => normalizeRoles(user), [user]);
  const isFinance = roleList.some((r) => FINANCE_ROLES.includes(r));
  const isTalento = roleList.some((r) => ["talento_humano", "jefe_talento_humano"].includes(r));

  const range = useMemo(() => monthRange(), []);
  const [filters, setFilters] = useState({ start: range.start, end: range.end });
  const [candidateSearch, setCandidateSearch] = useState("");
  const [allowanceSearch, setAllowanceSearch] = useState("");
  const [groupBy, setGroupBy] = useState("month");

  const [candidates, setCandidates] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [invoicesMap, setInvoicesMap] = useState({});
  const [invoicesLoading, setInvoicesLoading] = useState({});

  const [manualNotesMap, setManualNotesMap] = useState({});
  const [, setManualNotesLoading] = useState({});

  const [purchasesNoInvoiceMap, setPurchasesNoInvoiceMap] = useState({});
  const [, setPurchasesNoInvoiceLoading] = useState({});

  const [expanded, setExpanded] = useState(null);
  const [candidateDrafts, setCandidateDrafts] = useState({});
  const [destinationDrafts, setDestinationDrafts] = useState({});
  const [reports, setReports] = useState({});
  const [saving, setSaving] = useState({});

  // Selección y wizard
  const [selected, setSelected] = useState(new Set());
  const [wizardAllowances, setWizardAllowances] = useState(null);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setLoadError("");
    try {
      const params = { start_date: filters.start, end_date: filters.end };
      const [avData, candData] = await Promise.all([
        listViaticos(params),
        listViaticosCandidates(params).catch(() => []),
      ]);
      setAllowances(Array.isArray(avData) ? avData : []);
      setCandidates(Array.isArray(candData) ? candData : []);
    } catch (err) {
      const message = err?.response?.data?.message || "No se pudieron cargar los datos. Verifica tu conexión.";
      setLoadError(message);
      showToast(message, "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters.start, filters.end, showToast]);

  useEffect(() => { loadData(); }, [loadData]);
  useScopedAutoUpdate(DATA_UPDATE_SCOPES.VIATICOS, () => loadData({ silent: true }), [loadData]);

  // Limpiar selección al cambiar filtros
  useEffect(() => { setSelected(new Set()); }, [filters.start, filters.end]);

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

  const loadManualNotes = useCallback(async (allowanceId) => {
    setManualNotesLoading((p) => ({ ...p, [allowanceId]: true }));
    try {
      const data = await listManualNotes(allowanceId);
      setManualNotesMap((p) => ({ ...p, [allowanceId]: Array.isArray(data) ? data : [] }));
    } catch {
      setManualNotesMap((p) => ({ ...p, [allowanceId]: [] }));
    } finally {
      setManualNotesLoading((p) => ({ ...p, [allowanceId]: false }));
    }
  }, []);

  const loadPurchasesNoInvoice = useCallback(async (allowanceId) => {
    setPurchasesNoInvoiceLoading((p) => ({ ...p, [allowanceId]: true }));
    try {
      const data = await listPurchasesNoInvoice(allowanceId);
      setPurchasesNoInvoiceMap((p) => ({ ...p, [allowanceId]: Array.isArray(data) ? data : [] }));
    } catch {
      setPurchasesNoInvoiceMap((p) => ({ ...p, [allowanceId]: [] }));
    } finally {
      setPurchasesNoInvoiceLoading((p) => ({ ...p, [allowanceId]: false }));
    }
  }, []);

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => {
      const next = prev === id ? null : id;
      if (next) {
        if (!invoicesMap[next]) loadInvoices(next);
        if (!manualNotesMap[next]) loadManualNotes(next);
        if (!purchasesNoInvoiceMap[next]) loadPurchasesNoInvoice(next);
      }
      return next;
    });
  }, [invoicesMap, manualNotesMap, purchasesNoInvoiceMap, loadInvoices, loadManualNotes, loadPurchasesNoInvoice]);

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

  const handleUpdateManualNote = async (allowanceId, noteId, payload) => {
    try {
      await updateManualNote(noteId, payload);
      showToast("Nota actualizada", "success");
      await loadManualNotes(allowanceId);
      await loadData({ silent: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Error actualizando nota", "error");
    }
  };

  const handleDeleteManualNote = async (allowanceId, noteId) => {
    try {
      await deleteManualNote(noteId);
      showToast("Nota eliminada", "success");
      await loadManualNotes(allowanceId);
      await loadData({ silent: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Error eliminando nota", "error");
    }
  };

  const handleApproveSegment = async (allowanceId) => {
    const key = `approve-segment-${allowanceId}`;
    setSaving((p) => ({ ...p, [key]: true }));
    showLoader("Registrando aprobacion...");
    try {
      await approveViaticoSegment(allowanceId);
      showToast("Aprobacion registrada", "success");
      await loadData({ silent: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Error registrando aprobacion", "error");
    } finally {
      hideLoader();
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  const handleCreateFromCandidate = async (item, outsideLaborArea) => {
    const key = `cand-${item.source_type}-${item.source_id}`;
    const draft = candidateDrafts[key] || {};
    const destinationCity = String(draft.destination_city || item.city || "").trim();
    if (!destinationCity) {
      showToast("Debes registrar la ciudad de destino", "warning");
      return;
    }
    setSaving((p) => ({ ...p, [key]: true }));
    showLoader("Guardando clasificación...");
    try {
      await upsertViatico({
        source_type: item.source_type,
        source_id: item.source_id,
        visit_date: item.visit_date,
        city: destinationCity,
        amount: 0,
        outside_labor_area: Boolean(outsideLaborArea),
        notes: item.reference_name || "",
      });
      showToast("Clasificación guardada", "success");
      setCandidateDrafts((p) => ({ ...p, [key]: { outside_labor_area: Boolean(outsideLaborArea) } }));
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || "Error guardando clasificación", "error");
    } finally {
      hideLoader();
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  const handleSaveDestination = async (item) => {
    const destinationCity = String(destinationDrafts[item.id] || item.city || "").trim();
    if (!destinationCity) {
      showToast("Debes registrar la ciudad de destino", "warning");
      return;
    }
    const key = `dest-${item.id}`;
    setSaving((p) => ({ ...p, [key]: true }));
    showLoader("Guardando destino...");
    try {
      await updateViaticoStatus(item.id, {
        status: item.status,
        destination_city: destinationCity,
      });
      showToast("Destino actualizado", "success");
      await loadData({ silent: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Error actualizando destino", "error");
    } finally {
      hideLoader();
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  const handlePatchStatus = async (allowanceId, status, extraPayload = {}) => {
    if (!isFinance) return;
    const key = `status-${allowanceId}`;
    setSaving((p) => ({ ...p, [key]: true }));
    showLoader(
      extraPayload.workflow_status === "observado"
        ? "Solicitando corrección..."
        : status === "approved"
        ? "Aprobando..."
        : status === "rejected"
        ? "Rechazando..."
        : "Actualizando..."
    );
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

  // ── Selección ──────────────────────────────────────────────────────────────

  const toggleSelectOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectGroup = (groupItems) => {
    const ids = groupItems.map((i) => i.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const openWizardForSelected = () => {
    const items = myAllowances.filter((a) => selected.has(a.id));
    if (!items.length) return;
    setWizardAllowances(items);
  };

  const openWizardForOne = (item) => {
    setWizardAllowances([item]);
  };

  const handleWizardComplete = useCallback(() => {
    setWizardAllowances(null);
    setSelected(new Set());
    loadData();
  }, [loadData]);

  // ── Derivados ──────────────────────────────────────────────────────────────

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
  const filteredOperationalCandidates = useMemo(
    () => operationalCandidates.filter((item) => matchesSearch(item, candidateSearch)),
    [candidateSearch, operationalCandidates]
  );
  const myAllowances = useMemo(
    () => allowances.filter((a) => isFinance || String(a.requester_email || "").toLowerCase() === String(user?.email || "").toLowerCase()),
    [allowances, isFinance, user]
  );
  const filteredAllowances = useMemo(
    () => myAllowances.filter((item) => matchesSearch(item, allowanceSearch)),
    [allowanceSearch, myAllowances]
  );

  const grouped = useMemo(
    () => groupAllowancesByPeriod(filteredAllowances, groupBy),
    [filteredAllowances, groupBy]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-5`}>

      {/* Modal del wizard */}
      {wizardAllowances && (
        <Modal open onClose={() => setWizardAllowances(null)} maxWidth="max-w-5xl" hideHeader>
          <ViaticosWizard
            allowances={wizardAllowances}
            onClose={() => setWizardAllowances(null)}
            onComplete={handleWizardComplete}
          />
        </Modal>
      )}

      {/* Header */}
      <section className={`${surfaceClass} overflow-hidden`}>
        <div className="bg-slate-900 p-4 text-white sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-100">Finanzas</p>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-white sm:text-3xl">Viáticos</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-100">
                {isFinance ? "Revisión financiera, facturas y cierre de solicitudes." : "Salidas operacionales, comprobantes y estado de tus solicitudes."}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-5">
          <div className="grid w-full gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700">Desde</span>
              <input type="date" value={filters.start} onChange={(e) => setFilters((p) => ({ ...p, start: e.target.value }))}
                className={`${controlClass} w-full font-mono text-slate-900`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700">Hasta</span>
              <input type="date" value={filters.end} onChange={(e) => setFilters((p) => ({ ...p, end: e.target.value }))}
                className={`${controlClass} w-full font-mono text-slate-900`} />
            </label>
            <div>
              <span className="mb-1 block text-xs font-medium text-slate-700">Agrupar por</span>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className={`${controlClass} w-full`}>
                <option value="month">Mes</option>
                <option value="week">Semana</option>
              </select>
            </div>
            <button type="button" onClick={() => loadData()} disabled={loading}
              className={`${primaryButtonClass} self-end`}>
              <FiRefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Recargar
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className={`${surfaceClass} grid overflow-hidden divide-y divide-slate-100 sm:grid-cols-5 sm:divide-x sm:divide-y-0`}>
        {[
          { label: "Pendientes", val: summary.pending, color: "text-amber-700" },
          { label: "Aprobados", val: summary.approved, color: "text-emerald-700" },
          { label: "Pagados", val: summary.paid, color: "text-blue-700" },
          { label: "Rechazados", val: summary.rejected, color: "text-rose-700" },
          { label: "Monto total", val: toMoney(summary.total), color: "text-slate-950", mono: true },
        ].map(({ label, val, color, mono }) => (
          <div key={label} className="flex items-center justify-between gap-3 px-4 py-3 sm:block sm:px-5 sm:py-4">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className={`text-lg font-semibold sm:mt-1 ${color} ${mono ? "font-mono text-base" : ""}`}>{val}</p>
          </div>
        ))}
      </section>

      {/* Candidatos — solo colaboradores */}
      {!isFinance && operationalCandidates.length > 0 && (
        <Section title="Salidas operacionales" badge={`${filteredOperationalCandidates.length}/${operationalCandidates.length}`} defaultOpen>
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_360px] lg:items-end">
            <p className="text-sm leading-6 text-slate-600">
              Clasifica cada salida. Solo las salidas fuera del área generan viático.
            </p>
            <SearchField
              label="Buscar salida"
              value={candidateSearch}
              onChange={(event) => setCandidateSearch(event.target.value)}
              placeholder="Ciudad, referencia, fecha o estado"
            />
          </div>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {filteredOperationalCandidates.length === 0 ? (
              <EmptyState title="No hay salidas con esa búsqueda" detail="Ajusta el texto para revisar las salidas operacionales del periodo." icon={FiSearch} />
            ) : filteredOperationalCandidates.map((item) => {
              const key = `cand-${item.source_type}-${item.source_id}`;
              const draft = candidateDrafts[key] || {
                outside_labor_area: Boolean(item.outside_labor_area),
                destination_city: item.city || "",
              };
              const isSaving = Boolean(saving[key]);
              return (
                <article key={key} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <p className="font-semibold text-slate-900">
                        {item.reference_name || item.city || "Salida operacional"}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 font-mono"><FiCalendar size={12} /> {fmtDateTime(item.hora_entrada)}</span>
                        <span className="inline-flex items-center gap-1 font-mono"><FiCalendar size={12} /> {fmtDateTime(item.hora_salida)}</span>
                        {item.city && <span className="inline-flex items-center gap-1"><FiMapPin size={12} /> {item.city}</span>}
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-3 sm:w-auto">
                      <label className="block sm:min-w-[260px]">
                        <span className="mb-1 block text-xs font-medium text-slate-700">Destino (ciudad)</span>
                        <input
                          type="text"
                          value={draft.destination_city || ""}
                          onChange={(event) =>
                            setCandidateDrafts((p) => ({
                              ...p,
                              [key]: { ...draft, destination_city: event.target.value },
                            }))
                          }
                          placeholder="Ej. Ambato"
                          className={`${controlClass} w-full`}
                        />
                      </label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() =>
                            setCandidateDrafts((p) => ({
                              ...p,
                              [key]: { ...draft, outside_labor_area: !draft.outside_labor_area },
                            }))
                          }
                          className={`${secondaryButtonClass} justify-between sm:min-w-[240px]`}
                          aria-pressed={draft.outside_labor_area}
                        >
                          <span>{draft.outside_labor_area ? "Fuera del área" : "Dentro del área"}</span>
                          <span className={`relative h-6 w-11 rounded-full transition-colors ${draft.outside_labor_area ? "bg-blue-600" : "bg-slate-300"}`}>
                            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${draft.outside_labor_area ? "translate-x-5" : ""}`} />
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleCreateFromCandidate(item, draft.outside_labor_area)}
                          className={`${primaryButtonClass} w-full sm:w-auto`}
                        >
                          {isSaving ? "Guardando" : (item.allowance_id ? "Actualizar" : "Guardar")}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Section>
      )}

      {/* Barra de viáticos del periodo + controles */}
      <section className={`${surfaceClass} p-4 sm:p-5`}>
        <div className="grid gap-3 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Viáticos del periodo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Mostrando {filteredAllowances.length} de {myAllowances.length} registros.
              {selected.size > 0 && (
                <span className="ml-2 font-semibold text-blue-700">{selected.size} seleccionados.</span>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <SearchField
              label="Buscar viático"
              value={allowanceSearch}
              onChange={(event) => setAllowanceSearch(event.target.value)}
              placeholder={isFinance ? "Colaborador, estado, ciudad o factura" : "Estado, ciudad, factura o fecha"}
            />
            {!isFinance && selected.size > 0 && (
              <button
                type="button"
                onClick={openWizardForSelected}
                className={`${primaryButtonClass} shrink-0`}
              >
                <FiPlay size={14} />
                Procesar {selected.size} viático{selected.size > 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Lista agrupada */}
      <div className="space-y-6">
        {loading ? (
          <LoadingState />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => loadData()} />
        ) : myAllowances.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-slate-500 text-sm">No hay viáticos en el período seleccionado.</p>
            {!isFinance && (
              <p className="mt-2 text-xs text-slate-400">Los viáticos se crean desde las salidas operacionales completadas y clasificadas como "fuera del área".</p>
            )}
          </div>
        ) : filteredAllowances.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-slate-500 text-sm">No hay viáticos que coincidan con la búsqueda.</p>
          </div>
        ) : (
          grouped.map((group) => {
            const groupIds = group.items.map((i) => i.id);
            const allGroupSelected = groupIds.length > 0 && groupIds.every((id) => selected.has(id));
            const someGroupSelected = groupIds.some((id) => selected.has(id));

            return (
              <div key={group.key} className="space-y-2">
                {/* Cabecera del grupo */}
                <div className="flex items-center gap-3 px-1">
                  {!isFinance && (
                    <input
                      type="checkbox"
                      checked={allGroupSelected}
                      ref={(el) => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                      onChange={() => toggleSelectGroup(group.items)}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                      aria-label={`Seleccionar todos de ${group.label}`}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <FiLayers size={14} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">{group.label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                      {group.items.length} viático{group.items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {!isFinance && someGroupSelected && (
                    <button
                      type="button"
                      onClick={() => {
                        const groupSelected = group.items.filter((i) => selected.has(i.id));
                        setWizardAllowances(groupSelected);
                      }}
                      className={`${ghostButtonClass} ml-auto text-xs text-blue-700 hover:bg-blue-50`}
                    >
                      <FiPlay size={12} /> Procesar seleccionados del grupo
                    </button>
                  )}
                </div>

                {/* Items del grupo */}
                <div className="space-y-3">
                  {group.items.map((item) => {
                    const isExpanded = expanded === item.id;
                    const invoices = invoicesMap[item.id] || [];
                    const invLoading = Boolean(invoicesLoading[item.id]);
                    const manualNotes = manualNotesMap[item.id] || [];
                    const purchasesNoInvoice = purchasesNoInvoiceMap[item.id] || [];
                    const report = reports[item.id];
                    const isOwnRecord = String(item.requester_email || "").toLowerCase() === String(user?.email || "").toLowerCase();
                    const canEdit = isOwnRecord && !isFinance && item.status === "pending";
                    const canViewDocs = canEdit || isFinance || isTalento;
                    const destinationDraft = destinationDrafts[item.id] ?? (item.city || "");
                    const invoiceTotal = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
                    const inRangeCount = invoices.filter((i) => i.in_trip_date_range).length;
                    const outRangeCount = invoices.length - inRangeCount;
                    const destinationReady = String(destinationDraft || "").trim().length > 0;
                    const hasInvoices = invoices.length > 0;
                    const categoriesComplete = hasInvoices && invoices.every((inv) => String(inv.category || "").trim().length > 0);
                    const expenseModesComplete = hasInvoices && invoices.every((inv) => String(inv.expense_mode || "").trim().length > 0);
                    const canApproveAllowance = destinationReady && hasInvoices && categoriesComplete && expenseModesComplete;
                    const {
                      withCardTotal,
                      withoutCardTotal,
                      requiresFinanceApproval,
                      requiresTalentoApproval,
                    } = getAllowanceModeBreakdown(item);
                    const canApproveFinanceSegment = isFinance && item.status === "pending" && requiresFinanceApproval && item.finance_approval_status !== "approved";
                    const canApproveTalentoSegment = isTalento && item.status === "pending" && requiresTalentoApproval && item.talento_approval_status !== "approved";
                    const progressBadge = getAllowanceProgressBadge(item);
                    const isSelected = selected.has(item.id);

                    return (
                      <article
                        key={item.id}
                        className={`${surfaceClass} overflow-hidden transition-all ${isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
                      >
                        <div className="flex min-h-[76px] items-start gap-3 px-4 py-4 sm:px-5">
                          {/* Checkbox selección */}
                          {!isFinance && (
                            <div className="mt-1 shrink-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectOne(item.id)}
                                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                                aria-label={`Seleccionar viático #${item.id}`}
                              />
                            </div>
                          )}

                          {/* Botón expandir */}
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className={`flex flex-1 min-w-0 cursor-pointer touch-manipulation items-start justify-between gap-4 text-left transition hover:opacity-80 active:scale-[0.99] ${focusClass}`}
                          >
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-base font-semibold text-slate-900">
                                  {item.requester_name || item.requester_email}
                                </span>
                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[item.status] || "bg-slate-100 text-slate-600"}`}>
                                  {STATUS_LABEL[item.status] || item.status}
                                </span>
                                {item.workflow_status && WORKFLOW_LABEL[item.workflow_status] && (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                    {WORKFLOW_LABEL[item.workflow_status]}
                                  </span>
                                )}
                                {progressBadge && (
                                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${progressBadge.cls}`}>
                                    {progressBadge.label}
                                  </span>
                                )}
                                {item.outside_labor_area && (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">Fuera de área</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1 font-mono"><FiCalendar size={11} /> {fmtDate(item.visit_date)}</span>
                                {item.city && <span className="inline-flex items-center gap-1"><FiMapPin size={11} /> {item.city}</span>}
                                <span className="inline-flex items-center gap-1"><FiFileText size={11} /> {item.docs_count || invoices.length || 0} docs {toMoney(item.invoices_total || invoiceTotal)}</span>
                                <span className="font-mono text-slate-400">#{item.id}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 mt-1">
                              {isExpanded ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
                            </div>
                          </button>

                          {/* Botón procesar rápido */}
                          {!isFinance && canEdit && (
                            <button
                              type="button"
                              onClick={() => openWizardForOne(item)}
                              className={`${secondaryButtonClass} shrink-0 mt-0.5 text-xs px-3`}
                              title="Completar viático con wizard"
                            >
                              <FiUpload size={13} /> Completar
                            </button>
                          )}
                        </div>

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
                              {item.workflow_status && (
                                <p className="mt-2 text-xs text-slate-500">
                                  Flujo: {WORKFLOW_LABEL[item.workflow_status] || item.workflow_status}
                                </p>
                              )}
                              {item.notes && <p className="mt-2 text-xs text-slate-500">Nota: {item.notes}</p>}
                            </div>

                            {isFinance && (
                              <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Destino</p>
                                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                                  <label className="block">
                                    <span className="mb-1 block text-xs font-medium text-slate-700">Ciudad de destino</span>
                                    <input
                                      type="text"
                                      value={destinationDraft}
                                      onChange={(event) =>
                                        setDestinationDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                                      }
                                      placeholder="Ej. Ambato"
                                      className={`${controlClass} w-full`}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    disabled={saving[`dest-${item.id}`]}
                                    onClick={() => handleSaveDestination(item)}
                                    className={secondaryButtonClass}
                                  >
                                    Guardar destino
                                  </button>
                                </div>
                              </div>
                            )}

                            <ConsolidatedSummary allowance={item} />

                            {(withCardTotal > 0 || withoutCardTotal > 0) && (
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900">Con tarjeta</p>
                                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                      {requiresFinanceApproval ? "Aprueba financiero" : "Sin consumo"}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xl font-bold text-slate-900">{toMoney(withCardTotal)}</p>
                                  <p className="mt-1 text-xs text-slate-500">Liquidacion: pago al banco</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900">Sin tarjeta</p>
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                      {requiresTalentoApproval ? "Aprueba talento humano" : "Sin devolucion"}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xl font-bold text-slate-900">{toMoney(withoutCardTotal)}</p>
                                  <p className="mt-1 text-xs text-slate-500">Liquidacion: devolucion</p>
                                </div>
                              </div>
                            )}

                            {canViewDocs && (
                              <Section title="Notas de Venta Manual" badge={manualNotes.length} defaultOpen={false}>
                                {canEdit && (
                                  <WizardOnlyNotice
                                    onOpen={() => openWizardForOne(item)}
                                    detail="Las notas manuales deben registrarse desde el wizard para conservar un solo flujo de procesamiento."
                                  />
                                )}
                                <div className={canEdit ? "mt-4" : ""}>
                                  <ManualNotesTable
                                    notes={manualNotes}
                                    isFinance={isFinance}
                                    isRequester={false}
                                    onUpdate={(noteId, payload) => handleUpdateManualNote(item.id, noteId, payload)}
                                    onDelete={(noteId) => handleDeleteManualNote(item.id, noteId)}
                                    dateMin={item.notes?.match(/Inicio:\s*(\d{4}-\d{2}-\d{2})/)?.[1] || String(item.visit_date || '').slice(0, 10)}
                                    dateMax={item.notes?.match(/Cierre:\s*(\d{4}-\d{2}-\d{2})/)?.[1] || String(item.visit_date || '').slice(0, 10)}
                                  />
                                </div>
                              </Section>
                            )}

                            {canViewDocs && (
                              <Section title="Compras sin Factura" badge={purchasesNoInvoice.length} defaultOpen={false}>
                                {canEdit && (
                                  <WizardOnlyNotice
                                    onOpen={() => openWizardForOne(item)}
                                    detail="Las compras sin factura tambien se registran desde el wizard para evitar rutas paralelas."
                                  />
                                )}
                                <div className={canEdit ? "mt-4" : ""}>
                                  <PurchaseNoInvoiceTable
                                    purchases={purchasesNoInvoice}
                                  />
                                </div>
                              </Section>
                            )}

                            {canEdit && (
                              <WizardOnlyNotice
                                onOpen={() => openWizardForOne(item)}
                                title="La carga de comprobantes SRI se hace desde el wizard"
                                detail="El flujo guiado concentra la carga del TXT, la clasificacion y el envio a revision en un solo recorrido."
                              />
                            )}

                            {/* Listado de facturas */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-slate-700">
                                  Facturas cargadas
                                  {invoices.length > 0 && (
                                    <span className="ml-2 text-xs text-slate-400">
                                      {inRangeCount} en rango · {outRangeCount} fuera · Total: {toMoney(invoiceTotal)}
                                    </span>
                                  )}
                                </p>
                                <button type="button" onClick={() => loadInvoices(item.id)} className={`${ghostButtonClass} text-xs`}>
                                  <FiRefreshCw size={11} /> Recargar
                                </button>
                              </div>

                              {invLoading ? (
                                <p className="text-xs text-slate-400 py-3">Cargando facturas...</p>
                              ) : invoices.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                                  No hay facturas cargadas aún.
                                  {canEdit && " Usa el wizard (botón Completar) para agregar comprobantes del SRI."}
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                                      <tr>
                                        <th className="px-3 py-2 text-left">Emisor</th>
                                        {isFinance && <th className="px-3 py-2 text-left">Tipo</th>}
                                        <th className="px-3 py-2 text-left">Fecha emisión</th>
                                        {isFinance && <th className="px-3 py-2 text-left">Concepto</th>}
                                        <th className="px-3 py-2 text-left">Modo</th>
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
                                              <p className="font-medium text-slate-800 truncate max-w-[180px]">{inv.supplier_name || inv.supplier_ruc || "—"}</p>
                                              <p className="text-slate-400">{inv.supplier_ruc}</p>
                                            </td>
                                            {isFinance && <td className="px-3 py-2 text-slate-600">{inv.receipt_type || "—"}</td>}
                                            <td className="px-3 py-2 text-slate-600">{fmtDate(inv.issue_date)}</td>
                                            {isFinance && (
                                              <td className="px-3 py-2">
                                                <select
                                                  value={inv.category || ""}
                                                  disabled={saving[patchKey]}
                                                  onChange={(event) =>
                                                    handlePatchInvoice(item.id, inv.id, { category: event.target.value || null })
                                                  }
                                                  className="min-h-8 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800"
                                                >
                                                  <option value="">Sin clasificar</option>
                                                  {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                  ))}
                                                </select>
                                              </td>
                                            )}
                                            {!isFinance && (
                                              <td className="px-3 py-2 text-slate-600">
                                                {inv.category ? (
                                                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 uppercase">{inv.category}</span>
                                                ) : (
                                                  <span className="text-slate-400 italic">Sin categoría</span>
                                                )}
                                              </td>
                                            )}
                                            <td className="px-3 py-2 text-slate-600">
                                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${inv.expense_mode === "with_card" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                                                {getExpenseModeLabel(inv.expense_mode)}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-semibold text-slate-800">{toMoney(inv.total)}</td>
                                            <td className="px-3 py-2 text-center">
                                              {inv.in_trip_date_range
                                                ? <span className="inline-flex items-center gap-1 text-emerald-600"><FiCheckCircle size={12} /> Sí</span>
                                                : <span className="inline-flex items-center gap-1 text-amber-500"><FiAlertTriangle size={12} /> Fuera</span>}
                                            </td>
                                            {isFinance && (
                                              <td className="px-3 py-2 text-center">
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${INV_STATUS_BADGE[inv.status] || "bg-slate-100 text-slate-600"}`}>
                                                  {inv.status || "—"}
                                                </span>
                                              </td>
                                            )}
                                            <td className="px-3 py-2 text-center">
                                              <div className="flex items-center justify-center gap-1">
                                                {isFinance && inv.status !== "aprobada" && (
                                                  <button type="button" disabled={saving[patchKey]}
                                                    onClick={() => handlePatchInvoice(item.id, inv.id, { status: "aprobada" })}
                                                    className={`${secondaryButtonClass} min-h-9 px-2 py-1 text-emerald-700 hover:bg-emerald-50`}>
                                                    <FiCheckCircle size={12} />
                                                  </button>
                                                )}
                                                {isFinance && inv.status !== "rechazada" && (
                                                  <button type="button" disabled={saving[patchKey]}
                                                    onClick={() => handlePatchInvoice(item.id, inv.id, { status: "rechazada" })}
                                                    className={`${secondaryButtonClass} min-h-9 px-2 py-1 text-rose-700 hover:bg-rose-50`}>
                                                    <FiXCircle size={12} />
                                                  </button>
                                                )}
                                                {isFinance && (
                                                  <button type="button" disabled={saving[delKey]}
                                                    onClick={() => handleDeleteInvoice(item.id, inv.id)}
                                                    className={`${secondaryButtonClass} min-h-9 px-2 py-1 text-slate-600 hover:bg-rose-50 hover:text-rose-700`}>
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
                                        <td colSpan={isFinance ? 5 : 4} className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total</td>
                                        <td className="px-3 py-2 text-right text-xs font-bold text-slate-900">{toMoney(invoiceTotal)}</td>
                                        <td colSpan={isFinance ? 3 : 1} />
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
                                  <div><p className="text-emerald-600">Distancia mín.</p><p className="font-semibold">{report.attendance?.min_distance_km != null ? `${Number(report.attendance.min_distance_km).toFixed(1)} km` : "—"}</p></div>
                                  <div><p className="text-emerald-600">Fuera de Área</p><p className="font-semibold">{report.rules?.outside_labor_area ? "Sí" : "No"}</p></div>
                                  <div><p className="text-emerald-600">Monto sugerido</p><p className="font-semibold">{toMoney(report.recommendation?.suggested_amount || 0)}</p></div>
                                </div>
                              </div>
                            )}

                            {/* Acciones de finanzas */}
                            <div className="grid gap-2 pt-1 sm:flex sm:flex-wrap sm:items-center">
                              {isFinance && (
                                <>
                                  <button type="button" disabled={saving[`report-${item.id}`]}
                                    onClick={() => handleBuildReport(item.id)}
                                    className={`${secondaryButtonClass} border-slate-300 text-slate-700`}>
                                    <FiFileText size={14} /> Cotejar asistencia
                                  </button>
                                  {canApproveFinanceSegment && (
                                    <>
                                      <button type="button" disabled={saving[`approve-segment-${item.id}`] || !canApproveAllowance}
                                        onClick={() => handleApproveSegment(item.id)}
                                        className={`${secondaryButtonClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
                                        <FiCheckCircle size={14} /> Aprobar bloque con tarjeta
                                      </button>
                                      <button type="button" disabled={saving[`status-${item.id}`]}
                                        onClick={() => handlePatchStatus(item.id, "rejected")}
                                        className={`${secondaryButtonClass} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}>
                                        <FiXCircle size={14} /> Rechazar
                                      </button>
                                      <button type="button" disabled={saving[`status-${item.id}`]}
                                        onClick={() => handlePatchStatus(item.id, "pending", { workflow_status: "observado" })}
                                        className={`${secondaryButtonClass} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}>
                                        <FiAlertTriangle size={14} /> Solicitar corrección
                                      </button>
                                      {!canApproveAllowance && (
                                        <p className="text-xs text-amber-700">Para aprobar: registra destino y clasifica concepto y modo en todas las facturas.</p>
                                      )}
                                    </>
                                  )}
                                  {item.status === "approved" && (
                                    <button type="button" disabled={saving[`status-${item.id}`]}
                                      onClick={() => handlePatchStatus(item.id, "paid")}
                                      className={primaryButtonClass}>
                                      <FiCheckCircle size={14} /> {getSettlementActionLabel(item)}
                                    </button>
                                  )}
                                </>
                              )}
                              {!isFinance && isTalento && canApproveTalentoSegment && (
                                <button type="button" disabled={saving[`approve-segment-${item.id}`] || !canApproveAllowance}
                                  onClick={() => handleApproveSegment(item.id)}
                                  className={`${secondaryButtonClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
                                  <FiCheckCircle size={14} /> Aprobar bloque sin tarjeta
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ViaticosWorkspace;
