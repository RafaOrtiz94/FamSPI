import React from "react";
import { FiRefreshCw, FiFileText, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";

// ── Pure helpers ───────────────────────────────────────────────────────────────

export const toMoney = (v) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(
    Number.isFinite(Number(v)) ? Number(v) : 0
  );

export const fmtDate = (v) => (!v ? "—" : String(v).slice(0, 10));

export const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const currentMonthKey = () => new Date().toISOString().slice(0, 7);

export const wideRange = () => {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 5);
  start.setDate(1);
  return {
    start: start.toISOString().slice(0, 10),
    end: new Date(end.getFullYear(), end.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
};

export function monthRange(monthKey) {
  const [yr, mo] = monthKey.split("-").map(Number);
  const start = new Date(yr, mo - 1, 1);
  const end = new Date(yr, mo, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function groupByMonth(items) {
  const map = new Map();
  for (const item of items) {
    const key = String(item.visit_date || "").slice(0, 7);
    if (!key || key.length < 7) continue;
    if (!map.has(key)) {
      const [yr, mo] = key.split("-");
      const label = new Date(Number(yr), Number(mo) - 1, 1)
        .toLocaleString("es-EC", { month: "long", year: "numeric" });
      const labelCap = label.charAt(0).toUpperCase() + label.slice(1);
      map.set(key, { key, label: labelCap, items: [], total: 0, pending: 0, approved: 0, paid: 0 });
    }
    const g = map.get(key);
    g.items.push(item);
    g.total += Number(item.amount || 0);
    if (item.status === "pending") g.pending++;
    else if (item.status === "approved") g.approved++;
    else if (item.status === "paid") g.paid++;
  }
  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
}

export function groupByCollaborator(items) {
  const map = new Map();
  for (const item of items) {
    const email = String(item.requester_email || "").toLowerCase();
    if (!email) continue;
    if (!map.has(email)) {
      map.set(email, { email, name: item.requester_name || email, items: [], total: 0, pending: 0, approved: 0, paid: 0 });
    }
    const c = map.get(email);
    c.items.push(item);
    c.total += Number(item.amount || 0);
    if (item.status === "pending") c.pending++;
    else if (item.status === "approved") c.approved++;
    else if (item.status === "paid") c.paid++;
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export const getInitials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const normalizeRoles = (user) =>
  [user?.scope, user?.role, user?.role_name, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .flatMap((r) => String(r || "").split(","))
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);

export const normalizeText = (v) =>
  String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export const matchesSearch = (item, query) => {
  const q = normalizeText(query);
  if (!q) return true;
  const hay = [item?.id, item?.requester_name, item?.requester_email, item?.reference_name,
    item?.city, item?.status, item?.workflow_status, item?.visit_date, item?.notes]
    .map(normalizeText).join(" ");
  return hay.includes(q);
};

export function exportToCsv(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => {
    const val = r[h] == null ? "" : String(r[h]).replace(/"/g, '""');
    return val.includes(",") || val.includes("\n") ? `"${val}"` : val;
  }).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ── Role constants ─────────────────────────────────────────────────────────────

export const FINANCE_ROLES = ["finanzas", "financiero", "jefe_finanzas", "jefe_financiero", "gerencia", "gerencia_general", "admin", "administrador"];
export const SUPERVISOR_ROLES = ["jefe_comercial", "jefe_tecnico", "jefe_servicio_tecnico", "jefe_operaciones", "jefe_inmediato", "gerencia", "gerencia_general"];

// ── Label + status maps ────────────────────────────────────────────────────────

export const STATUS_LABEL = { pending: "Pendiente", approved: "Aprobado", paid: "Pagado", rejected: "Rechazado" };

export const PROCESSING_META = {
  sin_procesar:    { label: "Sin procesar",    cls: "bg-slate-100 text-slate-600 border-slate-200" },
  parcial:         { label: "Parcial",         cls: "bg-amber-100 text-[#D97706] border-amber-200" },
  liquidado_total: { label: "Liquidado total", cls: "bg-emerald-100 text-[#16A34A] border-emerald-200" },
  anulado:         { label: "Anulado",         cls: "bg-red-100 text-[#DC2626] border-red-200" },
};

export const WORKFLOW_META = {
  borrador:                       { label: "Borrador",             cls: "bg-slate-100 text-slate-500 border-slate-200" },
  pendiente_revision:             { label: "En revision",          cls: "bg-amber-100 text-[#D97706] border-amber-200" },
  observado:                      { label: "Correccion pedida",    cls: "bg-orange-100 text-orange-700 border-orange-200" },
  aprobado_jefe:                  { label: "Jefe: aprobado",       cls: "bg-emerald-50 text-[#16A34A] border-emerald-200" },
  rechazado_jefe:                 { label: "Jefe: rechazado",      cls: "bg-red-50 text-[#DC2626] border-red-200" },
  pendiente_financiero:           { label: "En finanzas",          cls: "bg-blue-50 text-[#2563EB] border-blue-200" },
  aprobado_financiero:            { label: "Finanzas: aprobado",   cls: "bg-emerald-50 text-[#16A34A] border-emerald-200" },
  rechazado_financiero:           { label: "Finanzas: rechazado",  cls: "bg-red-50 text-[#DC2626] border-red-200" },
  pendiente_aprobacion_talento:   { label: "En talento",           cls: "bg-violet-50 text-violet-700 border-violet-200" },
  pendiente_aprobacion_financiera:{ label: "En finanzas",          cls: "bg-blue-50 text-[#2563EB] border-blue-200" },
  pendiente_aprobacion_mixta:     { label: "En revision mixta",    cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  aprobado_talento_humano:        { label: "Talento: aprobado",    cls: "bg-emerald-50 text-[#16A34A] border-emerald-200" },
  aprobado_mixto:                 { label: "Aprobado",             cls: "bg-emerald-50 text-[#16A34A] border-emerald-200" },
  listo_pago:                     { label: "Listo para pago",      cls: "bg-blue-100 text-[#2563EB] border-blue-200" },
  pagado:                         { label: "Pagado",               cls: "bg-emerald-100 text-[#16A34A] border-emerald-200" },
  cerrado:                        { label: "Cerrado",              cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

export const ANTICIPO_META = {
  pending_approval: { label: "Pendiente aprobacion", cls: "bg-amber-100 text-[#D97706]" },
  approved:         { label: "Aprobado",             cls: "bg-blue-100 text-[#2563EB]" },
  disbursed:        { label: "Desembolsado",         cls: "bg-indigo-100 text-indigo-700" },
  applied:          { label: "Liquidado",            cls: "bg-emerald-100 text-[#16A34A]" },
  rejected:         { label: "Rechazado",            cls: "bg-red-100 text-[#DC2626]" },
};

export const EXPENSE_CATEGORIES = [
  { value: "combustible", label: "Combustible" },
  { value: "alimentacion", label: "Alimentacion" },
  { value: "hospedaje", label: "Hospedaje" },
  { value: "transporte", label: "Transporte" },
  { value: "movilidad", label: "Movilidad" },
  { value: "materiales", label: "Materiales" },
];

// ── Design tokens ──────────────────────────────────────────────────────────────

export const SURFACE = "rounded-[16px] border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]";
export const FOCUS = "focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1";
export const CONTROL = `${FOCUS} min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[#2563EB]`;
export const BTN_PRIMARY   = `${FOCUS} inline-flex min-h-10 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed`;
export const BTN_SECONDARY = `${FOCUS} inline-flex min-h-10 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed`;
export const BTN_GHOST     = `${FOCUS} inline-flex min-h-9 cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed`;
export const BTN_SUCCESS   = `${FOCUS} inline-flex min-h-10 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl border border-[#16A34A]/30 bg-emerald-50 px-4 py-2 text-sm font-semibold text-[#16A34A] transition hover:bg-emerald-100 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed`;
export const BTN_DANGER    = `${FOCUS} inline-flex min-h-10 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl border border-[#DC2626]/30 bg-red-50 px-4 py-2 text-sm font-semibold text-[#DC2626] transition hover:bg-red-100 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed`;
export const BTN_WARN      = `${FOCUS} inline-flex min-h-10 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl border border-[#D97706]/30 bg-amber-50 px-4 py-2 text-sm font-semibold text-[#D97706] transition hover:bg-amber-100 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed`;

// ── Micro components ───────────────────────────────────────────────────────────

export const Spinner = ({ size = 15 }) => <FiRefreshCw size={size} className="animate-spin text-[#2563EB]" />;

export const EmptyState = ({ title, detail, icon: Icon = FiFileText }) => (
  <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
    <Icon className="mb-3 h-8 w-8 text-slate-300" />
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    {detail && <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">{detail}</p>}
  </div>
);

export const StatusBadge = ({ status }) => {
  const map = { pending: "bg-amber-100 text-[#D97706]", approved: "bg-emerald-100 text-[#16A34A]", paid: "bg-blue-100 text-[#2563EB]", rejected: "bg-red-100 text-[#DC2626]" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[status] || "bg-slate-100 text-slate-500"}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
};

export const WorkflowBadge = ({ status }) => {
  const meta = WORKFLOW_META[status];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  );
};

export const ProcessingBadge = ({ status }) => {
  const meta = PROCESSING_META[status];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  );
};

export const AnticipoBadge = ({ status }) => {
  const meta = ANTICIPO_META[status];
  if (!meta) return null;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>;
};

export const AvatarInitials = ({ name, size = "md", active = false }) => {
  const sz = size === "lg" ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs";
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${sz} ${active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"}`}>
      {getInitials(name)}
    </div>
  );
};

export const MiniProgressBar = ({ paid, approved, pending, total, active = false }) => {
  if (!total) return null;
  const rest = total - paid - approved - pending;
  return (
    <div className="mt-2 flex h-1 overflow-hidden rounded-full gap-px">
      {paid > 0 && <div style={{ flex: paid }} className={`rounded-l-full ${active ? "bg-emerald-400" : "bg-[#16A34A]"}`} />}
      {approved > 0 && <div style={{ flex: approved }} className={active ? "bg-blue-400" : "bg-[#2563EB]"} />}
      {pending > 0 && <div style={{ flex: pending }} className={active ? "bg-amber-400" : "bg-[#D97706]"} />}
      {rest > 0 && <div style={{ flex: rest }} className={`rounded-r-full ${active ? "bg-white/20" : "bg-slate-200"}`} />}
    </div>
  );
};

// ── Step rail logic ────────────────────────────────────────────────────────────

export const STEP_DEFS = [
  { id: "clasificar", label: "Clasificar" },
  { id: "declarar",   label: "Declarar" },
  { id: "enviado",    label: "Enviado" },
  { id: "revision",   label: "En revision" },
  { id: "pagado",     label: "Pagado" },
  { id: "cerrado",    label: "Cerrado" },
];

const REVIEW_WF = [
  "aprobado_jefe", "pendiente_financiero", "pendiente_aprobacion_talento",
  "pendiente_aprobacion_financiera", "pendiente_aprobacion_mixta",
  "aprobado_financiero", "aprobado_talento_humano", "aprobado_mixto",
];

export function getMonthStepInfo(monthAllowances, monthCandidates) {
  const hasAllowances = monthAllowances.length > 0;
  const hasCandidates = monthCandidates.length > 0;
  const hasPendingClassification = monthCandidates.some((candidate) => !Boolean(candidate?.classification_completed));
  const segments = monthAllowances.flatMap((item) => getSegments(item));
  const hasObserved = hasAllowances && monthAllowances.some((a) => a.workflow_status === "observado");
  const hasSent = hasAllowances && monthAllowances.some((a) => a.workflow_status === "pendiente_revision");
  const hasReviewingSegments = segments.some((segment) => ["enviado", "en_revision", "aprobado"].includes(String(segment?.workflow_status || "").toLowerCase()));
  const hasPartialProcessing = monthAllowances.some((a) => String(a.processing_state || "").toLowerCase() === "parcial");
  const hasFullyLiquidated = hasAllowances
    && monthAllowances.every((a) => ["liquidado_total", "anulado"].includes(String(a.processing_state || "").toLowerCase()));
  const hasAnyLiquidatedSegment = segments.some((segment) => String(segment?.workflow_status || "").toLowerCase() === "liquidado");

  if (!hasAllowances && !hasCandidates) return { step: -1, label: "empty" };

  if (hasFullyLiquidated)
    return { step: 5, label: "cerrado" };

  if (hasAllowances && monthAllowances.every((a) => a.workflow_status === "cerrado"))
    return { step: 5, label: "cerrado" };

  if (hasPartialProcessing || hasAnyLiquidatedSegment)
    return { step: 4, label: "pagado" };

  if (hasAllowances && monthAllowances.some((a) => a.status === "paid" || a.workflow_status === "pagado" || a.workflow_status === "listo_pago"))
    return { step: 4, label: "pagado" };

  if (hasReviewingSegments)
    return { step: 3, label: "en_revision" };

  if (hasAllowances && monthAllowances.some((a) => REVIEW_WF.includes(a.workflow_status)))
    return { step: 3, label: "en_revision" };

  if (hasSent)
    return { step: 2, label: "enviado" };

  if (hasObserved)
    return { step: 1, label: "observado" };

  if (hasPendingClassification)
    return { step: 0, label: "clasificar" };

  if (hasAllowances)
    return { step: 1, label: "declarar" };

  if (hasCandidates)
    return { step: 0, label: "clasificar" };

  return { step: 0, label: "clasificar" };
}

export const STEP_DOT_CLS = {
  done:     "bg-[#16A34A] text-white",
  active:   "bg-[#2563EB] text-white ring-2 ring-[#2563EB]/20",
  error:    "bg-orange-100 text-orange-600 ring-2 ring-orange-200",
  inactive: "bg-slate-100 text-slate-400",
};

export const STEP_LABEL_CLS = {
  done:     "text-[#16A34A]",
  active:   "text-[#2563EB]",
  error:    "text-orange-600",
  inactive: "text-slate-400",
};

export const InlineObservationBox = ({ children }) => (
  <div className="mt-3 flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5">
    <FiAlertTriangle size={13} className="mt-0.5 shrink-0 text-orange-500" />
    <p className="text-xs text-orange-800">{children}</p>
  </div>
);

export const CerradoBanner = ({ receiptUrl }) => (
  <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
    <FiCheckCircle size={14} className="shrink-0 text-[#16A34A]" />
    <span className="text-xs font-semibold text-emerald-800">Expediente cerrado con comprobante</span>
    {receiptUrl && (
      <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
        className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline">
        Ver comprobante
      </a>
    )}
  </div>
);

export const getSegments = (item) => {
  if (Array.isArray(item?.segments)) return item.segments;
  return [];
};

export const getSegmentByType = (item, segmentType) =>
  getSegments(item).find((segment) => String(segment?.segment_type || "").toLowerCase() === String(segmentType || "").toLowerCase()) || null;

export const getSegmentAmount = (item, segmentType) => {
  const segment = getSegmentByType(item, segmentType);
  return Number(segment?.approved_total ?? segment?.calculated_total ?? segment?.economic_result_amount ?? 0);
};

export const segmentNeedsReview = (item, segmentType) => {
  const segment = getSegmentByType(item, segmentType);
  if (!segment) return false;
  const status = String(segment.workflow_status || "").toLowerCase();
  return ["enviado", "en_revision", "aprobado"].includes(status);
};

export const segmentIsLiquidated = (item, segmentType) => {
  const segment = getSegmentByType(item, segmentType);
  if (!segment) return false;
  return String(segment.workflow_status || "").toLowerCase() === "liquidado";
};
