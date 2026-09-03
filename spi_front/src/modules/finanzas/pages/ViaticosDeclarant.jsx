import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiRefreshCw, FiUpload, FiTrash2, FiCheckCircle, FiXCircle,
  FiMapPin, FiCalendar, FiFileText,
  FiAlertTriangle, FiSearch, FiPlay,
  FiDollarSign, FiDownload, FiThumbsUp, FiThumbsDown,
  FiArrowRight, FiX, FiClock, FiCheck, FiArrowLeft, FiFolder,
  FiCornerUpLeft, FiCamera, FiTruck,
} from "react-icons/fi";
import {
  listViaticos, listViaticosCandidates, upsertViatico,
  updateViaticoStatus, listViaticoInvoices, listViaticoDocuments, deleteViaticoInvoice,
  patchViaticoInvoice, getViaticoReport, listManualNotes,
  updateManualNote, deleteManualNote, listPurchasesNoInvoice,
  approveViaticoSegment, getViaticoSummaryReport,
  updateViaticoWorkflow, getViaticoConfigPolicy,
  requestViaticoAnticipo, listViaticoAnticipos, updateViaticoAnticipo,
  exportViaticosUserReport,
} from "../../../core/api/viaticosApi";
import { useUI } from "../../../core/ui/UIContext";
import { useAuth } from "../../../core/auth/AuthContext";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../core/api";
import Modal from "../../../core/ui/components/Modal";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import ConsolidatedSummary from "../components/viaticos/ConsolidatedSummary";
import ManualNotesTable from "../components/viaticos/ManualNotesTable";
import PurchaseNoInvoiceTable from "../components/viaticos/PurchaseNoInvoiceTable";
import ViaticosActionModal from "../components/viaticos/ViaticosActionModal";
import ViaticosWizard from "../components/viaticos/ViaticosWizard";
import {
  toMoney, fmtDate, fmtDateTime, currentMonthKey, wideRange,
  groupByMonth, exportToCsv, EXPENSE_CATEGORIES,
  SURFACE, FOCUS, CONTROL, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST,
  BTN_SUCCESS, BTN_DANGER, BTN_WARN,
  Spinner, EmptyState, StatusBadge, WorkflowBadge, ProcessingBadge, AnticipoBadge,
  MiniProgressBar, STEP_DEFS, STEP_DOT_CLS, STEP_LABEL_CLS,
  getMonthStepInfo, InlineObservationBox, CerradoBanner,
  getSegments, getSegmentByType, getSegmentAmount,
} from "../components/viaticos/viaticosShared";

// ── Step rail ──────────────────────────────────────────────────────────────────

function StepRail({ currentStep, isObservado }) {
  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-1 pt-0.5">
      {STEP_DEFS.map(({ label }, i) => {
        const done   = i < currentStep;
        const active = i === currentStep;
        const error  = active && isObservado;
        const state  = error ? "error" : done ? "done" : active ? "active" : "inactive";

        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${STEP_DOT_CLS[state]}`}>
                {error ? <FiAlertTriangle size={12} /> : done ? <FiCheck size={12} /> : i + 1}
              </div>
              <span className={`text-center text-[10px] font-medium leading-tight ${STEP_LABEL_CLS[state]}`}>
                {label}
              </span>
            </div>
            {i < STEP_DEFS.length - 1 && (
              <div className={`mt-3.5 h-px flex-1 min-w-[10px] transition-colors ${done ? "bg-[#16A34A]" : "bg-slate-200"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const FINAL_BALANCE_META = {
  por_pagar: "bg-emerald-50 text-[#16A34A] border-emerald-200",
  en_cero: "bg-slate-100 text-slate-600 border-slate-200",
  por_devolver: "bg-amber-50 text-[#D97706] border-amber-200",
};

const EDITABLE_WORKFLOW_STATUSES = new Set(["", "borrador", "observado", "pendiente_revision"]);
const REVIEW_WORKFLOW_STATUSES = new Set([
  "aprobado_jefe",
  "pendiente_financiero",
  "pendiente_aprobacion_talento",
  "pendiente_aprobacion_financiera",
  "pendiente_aprobacion_mixta",
  "aprobado_financiero",
  "aprobado_talento_humano",
  "aprobado_mixto",
]);

const MONTH_STAGE_META = {
  clasificar: {
    eyebrow: "Paso actual",
    title: "Clasificar salidas operacionales",
    detail: "Define si cada salida fue dentro o fuera del area antes de continuar con el expediente.",
    badge: "bg-amber-100 text-[#D97706]",
    pill: "Pendiente de clasificar",
  },
  declarar: {
    eyebrow: "Paso actual",
    title: "Preparar expediente de viaticos",
    detail: "Las salidas fuera del area ya pueden cargarse en el wizard para subir gastos y consolidar el mes.",
    badge: "bg-blue-100 text-[#2563EB]",
    pill: "Listo para declarar",
  },
  observado: {
    eyebrow: "Paso actual",
    title: "Corregir y reenviar",
    detail: "Hay observaciones registradas. Reabre el wizard, corrige y vuelve a enviar el expediente.",
    badge: "bg-orange-100 text-orange-700",
    pill: "Correccion requerida",
  },
  enviado: {
    eyebrow: "Paso actual",
    title: "Expediente enviado",
    detail: "El expediente ya fue enviado. Todavia puedes abrir el wizard para completar o ajustar gastos del mes.",
    badge: "bg-amber-100 text-[#D97706]",
    pill: "Esperando jefe inmediato",
  },
  en_revision: {
    eyebrow: "Paso actual",
    title: "En revision administrativa",
    detail: "Los subexpedientes estan siendo revisados por talento humano y finanzas segun el tipo de gasto.",
    badge: "bg-blue-100 text-[#2563EB]",
    pill: "Revision en curso",
  },
  pagado: {
    eyebrow: "Paso actual",
    title: "Liquidacion en curso",
    detail: "Ya existen subexpedientes liquidados o pagos registrados. Revisa el resultado economico y la trazabilidad.",
    badge: "bg-emerald-100 text-[#16A34A]",
    pill: "Con movimiento economico",
  },
  cerrado: {
    eyebrow: "Estado final",
    title: "Expediente cerrado",
    detail: "El proceso mensual ya termino. Solo queda disponible la trazabilidad y los documentos generados.",
    badge: "bg-slate-100 text-slate-600",
    pill: "Cerrado",
  },
  empty: {
    eyebrow: "Sin actividad",
    title: "Mes sin movimientos",
    detail: "No hay salidas operacionales ni expedientes de viaticos para este periodo.",
    badge: "bg-slate-100 text-slate-600",
    pill: "Sin actividad",
  },
};

function BalanceBadge({ result, amount }) {
  const normalizedResult = String(result || "").toLowerCase();
  const normalizedAmount = Number(amount || 0);
  if (!normalizedResult && !normalizedAmount) return null;
  const label = normalizedResult === "por_pagar"
    ? `Pago adicional ${toMoney(normalizedAmount)}`
    : normalizedResult === "por_devolver"
      ? `Devolver ${toMoney(normalizedAmount)}`
      : "Saldo en cero";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${FINAL_BALANCE_META[normalizedResult] || FINAL_BALANCE_META.en_cero}`}>
      {label}
    </span>
  );
}

function getMonthFlowMetrics(monthAllowances = [], monthCandidates = []) {
  const insideArea = monthAllowances.filter((item) => !item.outside_labor_area && String(item.processing_state || "").toLowerCase() !== "anulado");
  const outsideActive = monthAllowances.filter((item) => item.outside_labor_area && String(item.processing_state || "").toLowerCase() !== "anulado");
  const annulled = monthAllowances.filter((item) => String(item.processing_state || "").toLowerCase() === "anulado");
  const pendingClassification = monthCandidates.length;
  const draftOutside = outsideActive.filter((item) => {
    const workflow = String(item.workflow_status || "").toLowerCase();
    const status = String(item.status || "pending").toLowerCase();
    return EDITABLE_WORKFLOW_STATUSES.has(workflow) && status === "pending";
  });
  const observed = monthAllowances.filter((item) => String(item.workflow_status || "").toLowerCase() === "observado");
  const awaitingSupervisor = monthAllowances.filter((item) => String(item.workflow_status || "").toLowerCase() === "pendiente_revision");
  const underReview = monthAllowances.filter((item) => {
    const workflow = String(item.workflow_status || "").toLowerCase();
    const processing = String(item.processing_state || "").toLowerCase();
    if (["liquidado_total", "anulado"].includes(processing)) return false;
    if (REVIEW_WORKFLOW_STATUSES.has(workflow)) return true;
    return getSegments(item).some((segment) => ["enviado", "en_revision", "aprobado"].includes(String(segment?.workflow_status || "").toLowerCase()));
  });
  const liquidated = monthAllowances.filter((item) => String(item.processing_state || "").toLowerCase() === "liquidado_total");

  return {
    totalAllowances: monthAllowances.length,
    insideArea: insideArea.length,
    outsideActive: outsideActive.length,
    annulled: annulled.length,
    pendingClassification,
    draftOutside: draftOutside.length,
    observed: observed.length,
    awaitingSupervisor: awaitingSupervisor.length,
    underReview: underReview.length,
    liquidated: liquidated.length,
  };
}

function getPrimaryPendingCount(stepLabel, metrics) {
  switch (stepLabel) {
    case "clasificar": return metrics.pendingClassification;
    case "declarar": return metrics.draftOutside;
    case "observado": return metrics.observed;
    case "enviado": return metrics.awaitingSupervisor;
    case "en_revision": return metrics.underReview;
    case "pagado": return metrics.liquidated || metrics.outsideActive;
    case "cerrado": return metrics.totalAllowances;
    default: return 0;
  }
}

function OverviewMetric({ label, value, detail, accent = "neutral" }) {
  const accentClass = {
    neutral: "text-slate-900",
    blue: "text-[#2563EB]",
    amber: "text-[#D97706]",
    green: "text-[#16A34A]",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass[accent] || accentClass.neutral}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function MonthStatusStrip({ metrics }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <OverviewMetric
        label="Por clasificar"
        value={metrics.pendingClassification}
        detail="Salidas operacionales pendientes de definir dentro o fuera del area."
        accent={metrics.pendingClassification > 0 ? "amber" : "neutral"}
      />
      <OverviewMetric
        label="En preparacion"
        value={metrics.draftOutside}
        detail="Expedientes fuera del area que todavia puedes completar o editar."
        accent={metrics.draftOutside > 0 ? "blue" : "neutral"}
      />
      <OverviewMetric
        label="En revision"
        value={metrics.underReview}
        detail="Expedientes o subexpedientes que estan siendo revisados."
        accent={metrics.underReview > 0 ? "blue" : "neutral"}
      />
      <OverviewMetric
        label="Liquidado total"
        value={metrics.liquidated}
        detail="Expedientes mensuales que ya llegaron al cierre economico."
        accent={metrics.liquidated > 0 ? "green" : "neutral"}
      />
    </div>
  );
}

function MonthPrimaryActionPanel({ stepLabel, metrics, monthOutsideForWizard, onOpenWizard }) {
  const meta = MONTH_STAGE_META[stepLabel] || MONTH_STAGE_META.empty;
  const pendingCount = getPrimaryPendingCount(stepLabel, metrics);
  const canOpenWizard = ["declarar", "observado", "enviado"].includes(stepLabel) && monthOutsideForWizard.length > 0;
  const wizardLabel = stepLabel === "observado"
    ? "Corregir con wizard"
    : stepLabel === "enviado"
      ? "Actualizar expediente"
      : "Abrir wizard";

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{meta.eyebrow}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${meta.badge}`}>{meta.pill}</span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#1E293B]">{meta.title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{meta.detail}</p>
        </div>
        {canOpenWizard && (
          <button onClick={() => onOpenWizard(monthOutsideForWizard)} className={BTN_PRIMARY}>
            <FiPlay size={14} /> {wizardLabel}
          </button>
        )}
      </div>
      <div className="grid gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-3">
        <div className="bg-white px-5 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Fuera del area</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900">{metrics.outsideActive}</p>
        </div>
        <div className="bg-white px-5 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Dentro del area</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900">{metrics.insideArea}</p>
        </div>
        <div className="bg-white px-5 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Anulados</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900">{metrics.annulled}</p>
        </div>
      </div>
    </div>
  );
}

function SegmentPill({ item, segmentType, label }) {
  const segment = getSegmentByType(item, segmentType);
  if (!segment) return null;
  const amount = getSegmentAmount(item, segmentType);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-slate-900">{toMoney(amount)}</span>
        <WorkflowBadge status={segment.workflow_status} />
      </div>
    </div>
  );
}

function AllowanceFlowRow({ item, onOpenDetail }) {
  const segments = getSegments(item);
  const isAnnulled = String(item.processing_state || "").toLowerCase() === "anulado";
  const segmentCount = segments.length;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <button type="button" onClick={() => onOpenDetail(item)} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-500">{fmtDate(item.visit_date)}</span>
          {item.city && <span className="text-xs font-medium text-slate-700">{item.city}</span>}
          <StatusBadge status={item.status} />
          <WorkflowBadge status={item.workflow_status} />
          <ProcessingBadge status={item.processing_state} />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <SegmentPill item={item} segmentType="with_card" label="Hijo con tarjeta" />
          <SegmentPill item={item} segmentType="without_card" label="Hijo sin tarjeta" />
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Resultado global</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <BalanceBadge result={item.final_balance_result} amount={item.final_balance_amount} />
              <span className="font-mono text-[11px] text-slate-500">
                {segmentCount} hijo{segmentCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
        {item.annulled_reason && (
          <p className="mt-2 text-[11px] text-red-600">
            Motivo de anulacion: {item.annulled_reason}
          </p>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-sm font-bold text-slate-900">{toMoney(item.amount || 0)}</span>
        <button onClick={() => onOpenDetail(item)} className={BTN_GHOST}>Ver</button>
      </div>
      {isAnnulled && (
        <div className="sm:hidden">
          <p className="text-[11px] text-red-600">Expediente visible solo para trazabilidad.</p>
        </div>
      )}
    </div>
  );
}

function MonthProcessingOverview({ monthAllowances, onOpenDetail }) {
  const insideArea = monthAllowances.filter((item) => !item.outside_labor_area && String(item.processing_state || "").toLowerCase() !== "anulado");
  const annulled = monthAllowances.filter((item) => String(item.processing_state || "").toLowerCase() === "anulado");
  const activeOutside = monthAllowances.filter((item) => item.outside_labor_area && String(item.processing_state || "").toLowerCase() !== "anulado");

  if (!monthAllowances.length) return null;

  return (
    <div className="space-y-4">
      {insideArea.length > 0 && (
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Salidas dentro del area</p>
            <p className="mt-1 text-[11px] text-slate-400">Se registran en el workspace, pero no siguen flujo de devolucion de gastos.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {insideArea.map((item) => <AllowanceFlowRow key={item.id} item={item} onOpenDetail={onOpenDetail} />)}
          </div>
        </div>
      )}

      {activeOutside.length > 0 && (
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Expedientes fuera del area</p>
            <p className="mt-1 text-[11px] text-slate-400">Aqui revisas el expediente padre, sus subexpedientes y el resultado economico global.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {activeOutside.map((item) => <AllowanceFlowRow key={item.id} item={item} onOpenDetail={onOpenDetail} />)}
          </div>
        </div>
      )}

      {annulled.length > 0 && (
        <div className="overflow-hidden rounded-[16px] border border-red-200 bg-red-50 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <div className="border-b border-red-100 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700">Anulados para viaticos</p>
            <p className="mt-1 text-[11px] text-red-600">No proceden a devolucion de gastos, pero permanecen visibles para el colaborador y trazabilidad.</p>
          </div>
          <div className="divide-y divide-red-100">
            {annulled.map((item) => <AllowanceFlowRow key={item.id} item={item} onOpenDetail={onOpenDetail} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Anticipo panel ─────────────────────────────────────────────────────────────

function AnticipoPanelInner({ allowanceId, isFinance, isSupervisor, isOwner, showToast, showLoader, hideLoader }) {
  const [anticipos, setAnticipos] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState({ amount: "", purpose: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [patching, setPatching]   = useState({});
  const [actionModal, setActionModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAnticipos(await listViaticoAnticipos(allowanceId) || []); }
    catch { setAnticipos([]); }
    finally { setLoading(false); }
  }, [allowanceId]);

  useEffect(() => { load(); }, [load]);

  const handleRequest = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount || 0);
    if (amount <= 0) { showToast("El monto debe ser mayor a 0", "warning"); return; }
    setSubmitting(true); showLoader("Solicitando anticipo...");
    try {
      await requestViaticoAnticipo(allowanceId, { amount, purpose: form.purpose, notes: form.notes });
      showToast("Anticipo solicitado", "success");
      setForm({ amount: "", purpose: "", notes: "" });
      await load();
    } catch (err) { showToast(err?.response?.data?.message || "Error solicitando anticipo", "error"); }
    finally { setSubmitting(false); hideLoader(); }
  };

  const handlePatch = async (anticipoId, patch) => {
    setPatching((p) => ({ ...p, [anticipoId]: true })); showLoader("Actualizando...");
    try {
      await updateViaticoAnticipo(anticipoId, patch);
      showToast("Anticipo actualizado", "success");
      setActionModal(null);
      await load();
    }
    catch (err) { showToast(err?.response?.data?.message || "Error actualizando anticipo", "error"); }
    finally { setPatching((p) => ({ ...p, [anticipoId]: false })); hideLoader(); }
  };

  const confirmActionModal = async () => {
    if (!actionModal) return;
    const rawValue = String(actionModal.value || "").trim();
    if (actionModal.kind === "reject" && !rawValue) return;
    if (actionModal.kind === "apply") {
      const amount = Number(rawValue || 0);
      if (!Number.isFinite(amount) || amount < 0) {
        showToast("Ingresa un monto valido", "warning");
        return;
      }
      await handlePatch(actionModal.anticipoId, { status: "applied", applied_amount: amount });
      return;
    }
    if (actionModal.kind === "disburse") {
      await handlePatch(actionModal.anticipoId, { status: "disbursed", payment_reference: rawValue });
      return;
    }
    if (actionModal.kind === "reject") {
      await handlePatch(actionModal.anticipoId, { status: "rejected", rejected_reason: rawValue });
    }
  };

  const activeAnticipo = anticipos.find((a) => !["rejected", "applied"].includes(a.status));

  return (
    <div className="space-y-3">
      <ViaticosActionModal
        open={Boolean(actionModal)}
        title={actionModal?.title || ""}
        description={actionModal?.description || ""}
        label={actionModal?.label || ""}
        value={actionModal?.value || ""}
        onChange={(value) => setActionModal((prev) => (prev ? { ...prev, value } : prev))}
        onClose={() => {
          if (actionModal?.anticipoId && patching[actionModal.anticipoId]) return;
          setActionModal(null);
        }}
        onConfirm={confirmActionModal}
        confirmLabel={actionModal?.confirmLabel || "Confirmar"}
        placeholder={actionModal?.placeholder || ""}
        type={actionModal?.type || "text"}
        multiline={Boolean(actionModal?.multiline)}
        required={Boolean(actionModal?.required)}
        min={actionModal?.min}
        step={actionModal?.step}
        loading={Boolean(actionModal?.anticipoId && patching[actionModal.anticipoId])}
      />
      {isOwner && !activeAnticipo && (
        <form onSubmit={handleRequest} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Solicitar anticipo</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Monto (USD)</span>
              <input type="number" min="0" step="0.01" required value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className={`${CONTROL} w-full font-mono`} placeholder="0.00" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Proposito</span>
              <input type="text" value={form.purpose}
                onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                className={`${CONTROL} w-full`} placeholder="Ej. transporte y alimentacion" />
            </label>
          </div>
          <button type="submit" disabled={submitting} className={BTN_PRIMARY}>
            {submitting ? <Spinner size={13} /> : <FiDollarSign size={13} />} Solicitar anticipo
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-slate-400"><Spinner size={13} /> Cargando anticipos...</div>
      ) : anticipos.length === 0 ? (
        <p className="py-3 text-xs text-slate-400">No hay anticipos registrados.</p>
      ) : anticipos.map((a) => (
        <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-slate-900">{toMoney(a.amount)}</span>
              <AnticipoBadge status={a.status} />
            </div>
            <span className="font-mono text-[11px] text-slate-400">{fmtDate(a.created_at)}</span>
          </div>
          {a.purpose && <p className="text-xs text-slate-600">{a.purpose}</p>}
          {a.status === "applied" && a.applied_amount != null && (
            <div className="rounded-lg bg-slate-50 p-2.5 text-xs space-y-1 border border-slate-100">
              <div className="flex justify-between"><span className="text-slate-500">Anticipo:</span><span className="font-mono">{toMoney(a.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Gasto real:</span><span className="font-mono">{toMoney(a.applied_amount)}</span></div>
              <div className={`flex justify-between font-semibold ${Number(a.difference_amount || 0) >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                <span>{Number(a.difference_amount || 0) >= 0 ? "Devolucion:" : "Diferencia a pagar:"}</span>
                <span className="font-mono">{toMoney(Math.abs(Number(a.difference_amount || 0)))}</span>
              </div>
            </div>
          )}
          {a.rejected_reason && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-[#DC2626]">Motivo: {a.rejected_reason}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-0.5">
            {a.status === "pending_approval" && (isFinance || isSupervisor) && (
              <>
                <button disabled={patching[a.id]} onClick={() => handlePatch(a.id, { status: "approved" })} className={`${BTN_SUCCESS} text-xs min-h-9 px-3`}>
                  <FiCheckCircle size={12} /> Aprobar
                </button>
                <button
                  disabled={patching[a.id]}
                  onClick={() => setActionModal({
                    kind: "reject",
                    anticipoId: a.id,
                    title: "Rechazar anticipo",
                    description: "Indica el motivo del rechazo para dejar trazabilidad en el expediente.",
                    label: "Motivo del rechazo",
                    value: a.rejected_reason || "",
                    confirmLabel: "Rechazar anticipo",
                    placeholder: "Describe el motivo del rechazo",
                    multiline: true,
                    required: true,
                  })}
                  className={`${BTN_DANGER} text-xs min-h-9 px-3`}
                >
                  <FiXCircle size={12} /> Rechazar
                </button>
              </>
            )}
            {a.status === "approved" && isFinance && (
              <button
                disabled={patching[a.id]}
                onClick={() => setActionModal({
                  kind: "disburse",
                  anticipoId: a.id,
                  title: "Marcar anticipo desembolsado",
                  description: "Puedes registrar una referencia bancaria o dejarla vacia.",
                  label: "Referencia de pago",
                  value: "",
                  confirmLabel: "Marcar desembolsado",
                  placeholder: "Transferencia, cheque o referencia bancaria",
                })}
                className={`${BTN_PRIMARY} text-xs min-h-9 px-3`}
              >
                <FiArrowRight size={12} /> Marcar desembolsado
              </button>
            )}
            {a.status === "disbursed" && isOwner && (
              <button
                disabled={patching[a.id]}
                onClick={() => setActionModal({
                  kind: "apply",
                  anticipoId: a.id,
                  title: "Liquidar anticipo",
                  description: "Registra el gasto real ejecutado para cerrar el anticipo.",
                  label: "Monto gastado real (USD)",
                  value: a.applied_amount != null ? String(a.applied_amount) : "",
                  confirmLabel: "Liquidar anticipo",
                  type: "number",
                  min: "0",
                  step: "0.01",
                  placeholder: "0.00",
                  required: true,
                })}
                className={`${BTN_SUCCESS} text-xs min-h-9 px-3`}
              >
                <FiCheckCircle size={12} /> Liquidar anticipo
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────

function OperationalVehicleEvidence({ item, compact = false }) {
  const usesPersonalVehicle = Boolean(item?.uses_personal_vehicle);
  const startKm = item?.odometer_start_km == null ? null : Number(item.odometer_start_km);
  const endKm = item?.odometer_end_km == null ? null : Number(item.odometer_end_km);
  const trackedDistance = item?.odometer_distance_km ?? item?.distance_km;
  const distanceKm = trackedDistance == null
    ? (startKm !== null && endKm !== null ? endKm - startKm : null)
    : Number(trackedDistance);
  if (!usesPersonalVehicle) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
        <FiTruck size={11} /> Sin vehiculo personal
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-sky-100 bg-sky-50 ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-sky-900"><FiTruck size={12} /> Vehiculo personal</span>
        {startKm !== null && Number.isFinite(startKm) && <span className="font-mono text-sky-800">Inicio: {startKm.toFixed(1)} km</span>}
        {endKm !== null && Number.isFinite(endKm) && <span className="font-mono text-sky-800">Fin: {endKm.toFixed(1)} km</span>}
        {distanceKm !== null && Number.isFinite(distanceKm) && (
          <span className="font-mono font-semibold text-sky-900">
            Recorrido: {distanceKm.toFixed(1)} km
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {item.odometer_start_photo_drive_url && (
          <a href={item.odometer_start_photo_drive_url} target="_blank" rel="noopener noreferrer"
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 text-[11px] font-semibold text-sky-800 transition hover:border-sky-300 hover:bg-sky-100 active:scale-[0.97] ${FOCUS}`}>
            <FiCamera size={12} /> Ver foto inicial
          </a>
        )}
        {item.odometer_end_photo_drive_url && (
          <a href={item.odometer_end_photo_drive_url} target="_blank" rel="noopener noreferrer"
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 text-[11px] font-semibold text-sky-800 transition hover:border-sky-300 hover:bg-sky-100 active:scale-[0.97] ${FOCUS}`}>
            <FiCamera size={12} /> Ver foto final
          </a>
        )}
      </div>
    </div>
  );
}

function ViaticosDetailModal({
  item, isFinance, isSupervisor, isTalento, isOwn, policy,
  invoices, invoicesLoading, manualNotes, purchases, documents, saving, report,
  onClose, onWizard, onWorkflowUpdate, onApproveSegment, onPatchStatus,
  onRejectSupervisor,
  onDeleteInvoice, onPatchInvoice, onUpdateManualNote, onDeleteManualNote,
  onBuildReport, loadInvoices, showToast, showLoader, hideLoader,
  destinationDraft, setDestinationDraft,
}) {
  const [activeSection, setActiveSection] = useState("facturas");
  if (!item) return null;

  const wf = String(item.workflow_status || "");
  const st = String(item.status || "");
  const invoiceTotal = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const inRangeCount = invoices.filter((i) => i.in_trip_date_range).length;
  const withCardTotal    = Number(item.total_with_card || 0);
  const withoutCardTotal = Number(item.total_without_card || 0);
  const requiresFinanceApproval = Boolean(item.requires_finance_approval);
  const requiresTalentoApproval = Boolean(item.requires_talento_approval);
  const withCardSegment = getSegmentByType(item, "with_card");
  const withoutCardSegment = getSegmentByType(item, "without_card");
  const requiresExpenseFlow = Boolean(item.outside_labor_area) && String(item.processing_state || "").toLowerCase() !== "anulado";

  const hasInvoices        = invoices.length > 0;
  const categoriesComplete = hasInvoices && invoices.every((inv) => String(inv.category || "").trim().length > 0);
  const modesComplete      = hasInvoices && invoices.every((inv) => String(inv.expense_mode || "").trim().length > 0);
  const destinationFilled  = String(destinationDraft || item.city || "").trim().length > 0;
  const canApproveFinance  = isFinance && st === "pending" && requiresFinanceApproval && item.finance_approval_status !== "approved" && hasInvoices && categoriesComplete && modesComplete && destinationFilled;
  const canApproveTalento  = isTalento && !isFinance && st === "pending" && requiresTalentoApproval && item.talento_approval_status !== "approved";

  const sections = [
    { id: "facturas", label: `Facturas${invoices.length ? ` (${invoices.length})` : ""}` },
    { id: "notas",    label: `Notas${manualNotes.length ? ` (${manualNotes.length})` : ""}` },
    { id: "compras",  label: `Sin factura${purchases.length ? ` (${purchases.length})` : ""}` },
    { id: "documentos", label: `Documentos${documents.length ? ` (${documents.length})` : ""}` },
    { id: "anticipo", label: "Anticipo" },
  ];

  return (
    <Modal open onClose={onClose} maxWidth="max-w-3xl" hideHeader>
      <div className="bg-[#1E293B] px-5 py-4 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {(isFinance || isSupervisor) && item.requester_name && (
              <p className="text-xs font-semibold text-slate-400 mb-0.5">{item.requester_name}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-400">#{item.id}</span>
              <StatusBadge status={item.status} />
              <WorkflowBadge status={item.workflow_status} />
              <ProcessingBadge status={item.processing_state} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="font-mono"><FiCalendar size={10} className="inline mr-1" />{fmtDate(item.visit_date)}</span>
              {item.city && <span><FiMapPin size={10} className="inline mr-1" />{item.city}</span>}
              <span className="font-mono font-semibold text-slate-200">{toMoney(item.amount || 0)}</span>
            </div>
          </div>
          <button onClick={onClose} className={`shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-white ${FOCUS}`} aria-label="Cerrar">
            <FiX size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-slate-100 px-5 py-4">
          {(withCardTotal > 0 || withoutCardTotal > 0) && (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Con tarjeta</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">{toMoney(withCardTotal)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {requiresFinanceApproval && <span className="text-[10px] text-indigo-600">Aprueba finanzas</span>}
                  {withCardSegment && <WorkflowBadge status={withCardSegment.workflow_status} />}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Sin tarjeta</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">{toMoney(withoutCardTotal)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {requiresTalentoApproval && <span className="text-[10px] text-amber-600">Aprueba talento</span>}
                  {withoutCardSegment && <WorkflowBadge status={withoutCardSegment.workflow_status} />}
                </div>
              </div>
            </div>
          )}
          {(item.final_balance_amount != null || item.final_balance_result) && (
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Saldo global del expediente</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <BalanceBadge result={item.final_balance_result} amount={item.final_balance_amount} />
                {item.processing_deadline_at && (
                  <span className="text-[11px] text-slate-500">
                    Limite: {fmtDate(item.processing_deadline_at)}
                  </span>
                )}
                {item.grace_deadline_at && (
                  <span className="text-[11px] text-slate-500">
                    Gracia: {fmtDate(item.grace_deadline_at)}
                  </span>
                )}
              </div>
            </div>
          )}
          {wf === "observado" && (
            <InlineObservationBox>
              Se solicitaron correcciones. {item.reviewer_observation ? `"${item.reviewer_observation}"` : "Revisa los detalles y actualiza el viatico con el wizard."}
            </InlineObservationBox>
          )}
          {!requiresExpenseFlow && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              Esta salida fue clasificada dentro del area. Se conserva en el workspace para control y trazabilidad, pero no sigue flujo de viaticos ni carga de gastos.
            </div>
          )}
          {item.source_type === "operational_exit" && (
            <div className="mt-3"><OperationalVehicleEvidence item={item} /></div>
          )}
          {isFinance && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-0.5">Destino</p>
                <input type="text" value={destinationDraft}
                  onChange={(e) => setDestinationDraft(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-[#2563EB] focus:outline-none"
                  placeholder="Ciudad de destino"
                />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-0.5">Total facturas</p>
                <p className="font-mono font-semibold text-slate-900 mt-1.5">{toMoney(invoiceTotal)}</p>
              </div>
            </div>
          )}
        </div>

        {isFinance && <div className="border-b border-slate-100 px-5 py-4"><ConsolidatedSummary allowance={item} /></div>}

        {isFinance && report && (
          <div className="border-b border-slate-100 px-5 py-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="mb-2 text-xs font-semibold text-[#16A34A]">Cotejo de asistencia</p>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><p className="text-emerald-600">Estado</p><p className="capitalize font-semibold">{report.attendance?.status}</p></div>
                <div><p className="text-emerald-600">Distancia</p><p className="font-mono font-semibold">{report.attendance?.min_distance_km != null ? `${Number(report.attendance.min_distance_km).toFixed(1)} km` : "—"}</p></div>
                <div><p className="text-emerald-600">Fuera de area</p><p className="font-semibold">{report.rules?.outside_labor_area ? "Si" : "No"}</p></div>
                <div><p className="text-emerald-600">Monto sugerido</p><p className="font-mono font-semibold">{toMoney(report.recommendation?.suggested_amount || 0)}</p></div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-0.5 border-b border-slate-100 px-4 pt-2 overflow-x-auto">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`shrink-0 rounded-t-lg px-3 py-2 text-xs font-semibold transition ${FOCUS} ${activeSection === s.id ? "border-b-2 border-[#2563EB] text-[#2563EB]" : "text-slate-500 hover:text-slate-700"}`}>
              {s.label}
            </button>
          ))}
          {isFinance && (
            <button onClick={() => onBuildReport(item.id)} disabled={saving[`report-${item.id}`]}
              className={`${BTN_GHOST} ml-auto shrink-0 self-center`}>
              {saving[`report-${item.id}`] ? <Spinner size={12} /> : <FiFileText size={12} />} Cotejar
            </button>
          )}
        </div>

        {activeSection === "facturas" && (
          <div className="px-5 py-4">
            {invoicesLoading ? (
              <div className="flex items-center gap-2 py-6 text-xs text-slate-400"><Spinner size={13} /> Cargando...</div>
            ) : invoices.length === 0 ? (
              (requiresExpenseFlow && !isFinance && isOwn && (wf === "borrador" || wf === "" || wf === "observado" || wf === "pendiente_revision")) ? (
                <div className="rounded-xl border border-[#2563EB]/20 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-[#2563EB]">Sin facturas cargadas</p>
                  <p className="mt-0.5 text-[11px] text-blue-700">Carga el TXT del SRI desde el wizard del mes.</p>
                  <button onClick={() => { onClose(); onWizard([item]); }} className={`${BTN_PRIMARY} mt-3 text-xs min-h-9 px-3`}>
                    <FiPlay size={12} /> Abrir wizard
                  </button>
                </div>
              ) : !requiresExpenseFlow ? (
                <EmptyState title="No aplica carga de facturas" detail="Las salidas dentro del area no generan proceso de viaticos." icon={FiFileText} />
              ) : (
                <EmptyState title="Sin facturas cargadas" icon={FiFileText} />
              )
            ) : (
              <>
                <p className="mb-2 text-xs text-slate-400">
                  {inRangeCount} en rango · {invoices.length - inRangeCount} fuera · total: {toMoney(invoiceTotal)}
                </p>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-[#1E293B] text-[10px] uppercase tracking-wider text-slate-300">
                      <tr>
                        <th className="px-3 py-2.5 text-left">Emisor</th>
                        <th className="px-3 py-2.5 text-left">Fecha</th>
                        <th className="px-3 py-2.5 text-left">Concepto</th>
                        <th className="px-3 py-2.5 text-left">Modo</th>
                        <th className="px-3 py-2.5 text-right">Total</th>
                        <th className="px-3 py-2.5 text-center">Rango</th>
                        {isFinance && <th className="px-3 py-2.5 text-center">Acc.</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className={`hover:bg-slate-50 ${!inv.in_trip_date_range ? "opacity-60" : ""}`}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800 truncate max-w-[140px]">{inv.supplier_name || "—"}</p>
                            <p className="font-mono text-[10px] text-slate-400">{inv.supplier_ruc}</p>
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600">{fmtDate(inv.issue_date)}</td>
                          <td className="px-3 py-2">
                            {isFinance ? (
                              <select value={inv.category || ""} disabled={saving[`patch-inv-${inv.id}`]}
                                onChange={(e) => onPatchInvoice(item.id, inv.id, { category: e.target.value || null })}
                                className="min-h-8 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]">
                                <option value="">Sin clasificar</option>
                                {EXPENSE_CATEGORIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              inv.category
                                ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 uppercase">{inv.category}</span>
                                : <span className="text-slate-300">Sin categoria</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${inv.expense_mode === "with_card" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-[#D97706]"}`}>
                              {inv.expense_mode === "with_card" ? "Tarjeta" : "Sin tarjeta"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{toMoney(inv.total)}</td>
                          <td className="px-3 py-2 text-center">
                            {inv.in_trip_date_range ? <FiCheckCircle size={13} className="mx-auto text-[#16A34A]" /> : <FiAlertTriangle size={13} className="mx-auto text-[#D97706]" />}
                          </td>
                          {isFinance && (
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                {inv.status !== "aprobada" && (
                                  <button disabled={saving[`patch-inv-${inv.id}`]} onClick={() => onPatchInvoice(item.id, inv.id, { status: "aprobada" })} className={`${BTN_GHOST} text-[#16A34A] hover:bg-emerald-50`}><FiCheck size={12} /></button>
                                )}
                                {inv.status !== "rechazada" && (
                                  <button disabled={saving[`patch-inv-${inv.id}`]} onClick={() => onPatchInvoice(item.id, inv.id, { status: "rechazada" })} className={`${BTN_GHOST} text-[#DC2626] hover:bg-red-50`}><FiXCircle size={12} /></button>
                                )}
                                <button disabled={saving[`del-inv-${inv.id}`]} onClick={() => onDeleteInvoice(item.id, inv.id)} className={`${BTN_GHOST} hover:bg-red-50 hover:text-[#DC2626]`}><FiTrash2 size={12} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50">
                        <td colSpan={4} className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500">Total</td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-bold text-slate-900">{toMoney(invoiceTotal)}</td>
                        <td colSpan={isFinance ? 2 : 1} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="mt-2 flex justify-end">
                  <button onClick={() => loadInvoices(item.id)} className={BTN_GHOST}><FiRefreshCw size={11} /> Recargar</button>
                </div>
              </>
            )}
          </div>
        )}

        {activeSection === "notas" && (
          <div className="px-5 py-4">
            {requiresExpenseFlow && isOwn && (wf === "borrador" || wf === "observado" || wf === "pendiente_revision") && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                Registra notas de venta manual desde el wizard.
                <button onClick={() => onWizard([item])} className="ml-2 text-[#2563EB] font-semibold hover:underline">Abrir wizard</button>
              </div>
            )}
            {!requiresExpenseFlow && manualNotes.length === 0 && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                No aplica registrar notas manuales para salidas dentro del area.
              </div>
            )}
            <ManualNotesTable notes={manualNotes} isFinance={isFinance} isRequester={false}
              onUpdate={(noteId, payload) => onUpdateManualNote(item.id, noteId, payload)}
              onDelete={(noteId) => onDeleteManualNote(item.id, noteId)}
              dateMin={String(item.visit_date || "").slice(0, 10)}
              dateMax={String(item.visit_date || "").slice(0, 10)}
            />
          </div>
        )}

        {activeSection === "compras" && (
          <div className="px-5 py-4">
            {requiresExpenseFlow && isOwn && (wf === "borrador" || wf === "observado" || wf === "pendiente_revision") && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                Registra compras sin factura desde el wizard.
                <button onClick={() => onWizard([item])} className="ml-2 text-[#2563EB] font-semibold hover:underline">Abrir wizard</button>
              </div>
            )}
            {!requiresExpenseFlow && purchases.length === 0 && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                No aplica registrar compras sin factura para salidas dentro del area.
              </div>
            )}
            <PurchaseNoInvoiceTable purchases={purchases} />
          </div>
        )}

        {activeSection === "documentos" && (
          <div className="px-5 py-4">
            {documents.length === 0 ? (
              <EmptyState title="Sin documentos del expediente" detail="Las liquidaciones y soportes apareceran aqui cuando sean generados o cargados." />
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => {
                  const segmentLabel = String(doc.notes || "").includes("segment_type=with_card")
                    ? "Hijo con tarjeta"
                    : String(doc.notes || "").includes("segment_type=without_card")
                      ? "Hijo sin tarjeta"
                      : null;
                  return (
                    <div key={doc.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{doc.doc_type}</span>
                            {segmentLabel && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#2563EB]">{segmentLabel}</span>}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-900 break-all">{doc.file_name || "Documento"}</p>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                            <span>{fmtDateTime(doc.uploaded_at)}</span>
                            {doc.uploaded_by_name && <span>{doc.uploaded_by_name}</span>}
                            {doc.amount != null && <span className="font-mono">{toMoney(doc.amount)}</span>}
                          </div>
                        </div>
                        {doc.drive_link && (
                          <a href={doc.drive_link} target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
                            <FiDownload size={13} /> Ver documento
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeSection === "anticipo" && (
          <div className="px-5 py-4">
            <AnticipoPanelInner allowanceId={item.id} isFinance={isFinance} isSupervisor={isSupervisor}
              isOwner={isOwn} showToast={showToast} showLoader={showLoader} hideLoader={hideLoader} />
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 bg-white px-5 py-3.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {requiresExpenseFlow && isOwn && !isFinance && !isSupervisor && (wf === "borrador" || wf === "" || wf === "observado" || wf === "pendiente_revision") && (
            <button onClick={() => { onClose(); onWizard([item]); }} className={BTN_PRIMARY}>
              <FiUpload size={14} /> {wf === "observado" ? "Corregir con wizard" : wf === "pendiente_revision" ? "Actualizar facturas" : "Completar con wizard"}
            </button>
          )}
          {isFinance && (
            <button disabled={saving[`dest-${item.id}`]} onClick={() => onPatchStatus(item.id, item.status, { destination_city: destinationDraft })} className={BTN_SECONDARY}>
              Guardar destino
            </button>
          )}
          {isFinance && st === "pending" && requiresFinanceApproval && item.finance_approval_status !== "approved" && (
            <button disabled={saving[`approve-segment-${item.id}`] || !canApproveFinance}
              onClick={() => onApproveSegment(item.id)} className={BTN_SUCCESS}
              title={!canApproveFinance ? "Clasifica concepto y modo en todas las facturas y registra destino primero" : undefined}>
              <FiCheckCircle size={14} /> Aprobar bloque tarjeta
            </button>
          )}
          {isTalento && !isFinance && canApproveTalento && (
            <button disabled={saving[`approve-segment-${item.id}`]} onClick={() => onApproveSegment(item.id)} className={BTN_SUCCESS}>
              <FiCheckCircle size={14} /> Aprobar bloque sin tarjeta
            </button>
          )}
          {isFinance && st === "pending" && (
            <button disabled={saving[`status-${item.id}`]} onClick={() => onPatchStatus(item.id, "rejected")} className={BTN_DANGER}>
              <FiXCircle size={14} /> Rechazar
            </button>
          )}
          {isFinance && st === "pending" && (
            <button disabled={saving[`status-${item.id}`]} onClick={() => onPatchStatus(item.id, "pending", { workflow_status: "observado" })} className={BTN_WARN}>
              <FiAlertTriangle size={14} /> Solicitar correccion
            </button>
          )}
          {isSupervisor && !isFinance && wf === "pendiente_revision" && (
            <>
              <button disabled={saving[`wf-${item.id}`]}
                onClick={() => { onWorkflowUpdate(item.id, "aprobado_jefe", { trip_authorized: true }); onClose(); }}
                className={BTN_SUCCESS}>
                <FiThumbsUp size={14} /> Aprobar
              </button>
              <button disabled={saving[`wf-${item.id}`]}
                onClick={() => onRejectSupervisor?.(item)}
                className={BTN_DANGER}>
                <FiThumbsDown size={14} /> Rechazar
              </button>
            </>
          )}
          {!canApproveFinance && isFinance && st === "pending" && requiresFinanceApproval && hasInvoices && (
            <p className="w-full text-[11px] text-[#D97706]">Para aprobar: registra destino y clasifica todas las facturas.</p>
          )}
          <button onClick={onClose} className={`${BTN_GHOST} ml-auto`}>Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Reportes modal ─────────────────────────────────────────────────────────────

function ReportesModal({ filters, showToast, onClose }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getViaticoSummaryReport({ start_date: filters.start, end_date: filters.end });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch { showToast("Error cargando reporte", "error"); }
    finally { setLoading(false); }
  }, [filters.start, filters.end, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleExportDetailed = async () => {
    setExporting(true);
    try {
      const data = await exportViaticosUserReport({ start_date: filters.start, end_date: filters.end });
      if (!data.length) { showToast("Sin datos para exportar", "warning"); return; }
      exportToCsv(data, `viaticos_detalle_${filters.start}_${filters.end}.csv`);
    } catch { showToast("Error exportando", "error"); }
    finally { setExporting(false); }
  };

  const totalAmount = rows.reduce((s, r) => s + Number(r.total_amount || r.amount || 0), 0);

  return (
    <Modal open onClose={onClose} title="Reporte del periodo" maxWidth="max-w-4xl">
      <div className="flex flex-col gap-4 px-5 pb-6 pt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-400 font-mono">{filters.start} — {filters.end}</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={load} disabled={loading} className={BTN_SECONDARY}>
              {loading ? <Spinner size={13} /> : <FiRefreshCw size={13} />} Actualizar
            </button>
            <button onClick={handleExportDetailed} disabled={exporting} className={BTN_SECONDARY}>
              {exporting ? <Spinner size={13} /> : <FiDownload size={13} />} CSV detallado
            </button>
            <button onClick={() => { if (!rows.length) { showToast("Sin datos", "warning"); return; } exportToCsv(rows, `viaticos_${filters.start}_${filters.end}.csv`); }} disabled={!rows.length} className={BTN_PRIMARY}>
              <FiDownload size={13} /> Exportar resumen
            </button>
          </div>
        </div>
        {rows.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Colaboradores</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-900">{rows.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Total periodo</p>
              <p className="mt-0.5 font-mono text-xl font-bold text-slate-900">{toMoney(totalAmount)}</p>
            </div>
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-400"><Spinner /> Generando reporte...</div>
        ) : rows.length === 0 ? (
          <EmptyState title="Sin datos en el periodo" detail="No hay viaticos aprobados en el rango seleccionado." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-[#1E293B] text-[10px] uppercase tracking-wider text-slate-300">
                <tr>{Object.keys(rows[0]).map((h) => <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h.replace(/_/g, " ")}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {typeof v === "number"
                          ? <span className="font-mono">{v.toLocaleString("es-EC", { minimumFractionDigits: v % 1 !== 0 ? 2 : 0 })}</span>
                          : String(v ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Step content areas ─────────────────────────────────────────────────────────

function StepContentClasificar({ candidates, candidateDrafts, setCandidateDrafts, saving, onClassify }) {
  if (!candidates.length) return (
    <EmptyState title="Sin salidas para clasificar" detail="Todas las salidas del mes ya fueron clasificadas." icon={FiMapPin} />
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3">
        <p className="text-sm font-semibold text-sky-900">{candidates.length} salida{candidates.length !== 1 ? "s" : ""} pendiente{candidates.length !== 1 ? "s" : ""} de clasificar</p>
        <p className="text-[11px] text-sky-700 mt-0.5">Selecciona una decision explicita por salida. Dentro del area solo deja trazabilidad; fuera del area habilita el flujo de viaticos.</p>
      </div>
      <div className={`${SURFACE} overflow-hidden`}>
        <div className="divide-y divide-slate-100">
          {candidates.map((item) => {
            const key   = `cand-${item.source_type}-${item.source_id}`;
            const draft = candidateDrafts[key] || {
              classification_kind: item.classification_completed
                ? (item.outside_labor_area ? "outside" : "inside")
                : null,
              destination_city: item.city || "",
            };
            return (
              <div key={key} className="px-4 py-4">
                <div className="flex flex-col gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{item.reference_name || "Salida operacional"}</p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-slate-400">
                      <span className="font-mono">{fmtDateTime(item.hora_entrada)}</span>
                      <span className="font-mono">{fmtDateTime(item.hora_salida)}</span>
                    </div>
                    <OperationalVehicleEvidence item={item} compact />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setCandidateDrafts((p) => ({ ...p, [key]: { ...draft, classification_kind: "inside" } }))}
                        className={`rounded-xl border px-4 py-3 text-left transition ${FOCUS} ${
                          draft.classification_kind === "inside"
                            ? "border-emerald-300 bg-emerald-50 shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Dentro del area</p>
                            <p className="mt-1 text-xs text-slate-500">Solo control y trazabilidad. No habilita carga de gastos.</p>
                          </div>
                          <span className={`h-4 w-4 rounded-full border-2 ${draft.classification_kind === "inside" ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white"}`} />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCandidateDrafts((p) => ({ ...p, [key]: { ...draft, classification_kind: "outside" } }))}
                        className={`rounded-xl border px-4 py-3 text-left transition ${FOCUS} ${
                          draft.classification_kind === "outside"
                            ? "border-blue-300 bg-blue-50 shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Fuera del area</p>
                            <p className="mt-1 text-xs text-slate-500">Continua al wizard de viaticos para cargar comprobantes y gastos.</p>
                          </div>
                          <span className={`h-4 w-4 rounded-full border-2 ${draft.classification_kind === "outside" ? "border-[#2563EB] bg-[#2563EB]" : "border-slate-300 bg-white"}`} />
                        </div>
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <input type="text" value={draft.destination_city || ""}
                        onChange={(e) => setCandidateDrafts((p) => ({ ...p, [key]: { ...draft, destination_city: e.target.value } }))}
                        placeholder="Ciudad de destino"
                        className={`${CONTROL} w-full`} />
                      <p className="text-[11px] leading-5 text-slate-500">
                        Registra la ciudad real para identificar correctamente el expediente de la salida.
                      </p>
                      <button
                        disabled={saving[key] || !draft.classification_kind}
                        onClick={() => onClassify(item, draft.classification_kind === "outside")}
                        className={`${BTN_PRIMARY} text-xs px-3 min-h-10`}
                      >
                        {saving[key] ? <Spinner size={12} /> : "Guardar clasificacion"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepContentDeclarar({ monthAllowances, monthOutsideForWizard, onOpenWizard }) {
  const outsideCount  = monthOutsideForWizard.length;
  const insideItems   = monthAllowances.filter((a) => !a.outside_labor_area);

  return (
    <div className="space-y-4">
      {outsideCount > 0 ? (
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/10">
                <FiPlay size={18} className="text-[#2563EB]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1E293B]">
                  {outsideCount} salida{outsideCount !== 1 ? "s" : ""} fuera del area lista{outsideCount !== 1 ? "s" : ""} para declarar
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Carga el TXT del SRI, clasifica gastos y envia a revision del jefe.
                </p>
              </div>
            </div>
            <button onClick={onOpenWizard}
              className="shrink-0 inline-flex cursor-pointer items-center gap-2 rounded-[16px] bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-[0.97]">
              <FiPlay size={14} /> Abrir wizard
            </button>
          </div>
          {insideItems.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-3">
              <p className="text-[11px] text-slate-400">{insideItems.length} salida{insideItems.length !== 1 ? "s" : ""} dentro del area — sin accion requerida.</p>
            </div>
          )}
        </div>
      ) : (
        <div className={`${SURFACE} flex items-start gap-3 px-5 py-4`}>
          <FiCheckCircle size={16} className="mt-0.5 shrink-0 text-[#16A34A]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Todas las salidas dentro del area</p>
            <p className="text-xs text-slate-400 mt-0.5">No se requiere declaracion de viaticos este mes.</p>
          </div>
        </div>
      )}

      {monthAllowances.length > 0 && (
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Salidas del mes</p>
          </div>
          <div className="divide-y divide-slate-100">
            {monthAllowances.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`h-2 w-2 shrink-0 rounded-full ${item.outside_labor_area ? "bg-[#2563EB]" : "bg-slate-300"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-500">{fmtDate(item.visit_date)}</span>
                    {item.city && <span className="text-xs text-slate-700">{item.city}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.outside_labor_area ? "bg-blue-100 text-[#2563EB]" : "bg-slate-100 text-slate-500"}`}>
                      {item.outside_labor_area ? "Fuera del area" : "Dentro del area"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepContentObservado({ monthObservado, monthOutsideForWizard, monthAllowances, onOpenWizard }) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[16px] border border-orange-200 bg-orange-50 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex items-start justify-between gap-3 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
              <FiCornerUpLeft size={16} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-900">
                {monthObservado.length} salida{monthObservado.length !== 1 ? "s" : ""} con correcciones solicitadas
              </p>
              <p className="text-xs text-orange-700 mt-0.5">El revisor solicito cambios. Abre el wizard para corregir y reenviar.</p>
            </div>
          </div>
          <button onClick={() => onOpenWizard(monthOutsideForWizard.length ? monthOutsideForWizard : monthObservado)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-[16px] bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-orange-700 active:scale-[0.97]">
            <FiPlay size={11} /> Corregir con wizard
          </button>
        </div>
        {monthObservado.some((item) => item.reviewer_observation) && (
          <div className="divide-y divide-orange-100 border-t border-orange-100">
            {monthObservado.map((item) => item.reviewer_observation && (
              <div key={item.id} className="px-5 py-3">
                <div className="flex gap-2 items-start">
                  <span className="font-mono text-[11px] text-orange-500 shrink-0 mt-0.5">{fmtDate(item.visit_date)}</span>
                  {item.city && <span className="text-[11px] text-orange-700 shrink-0">{item.city}:</span>}
                  <p className="text-[11px] text-orange-800 italic">{item.reviewer_observation}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepContentEnviado({ monthAllowances, monthOutsideForWizard, onOpenWizard }) {
  return (
    <div className="space-y-4">
      <div className={`${SURFACE} overflow-hidden`}>
        <div className="flex items-start gap-3 px-5 py-4">
          <FiClock size={16} className="mt-0.5 shrink-0 text-[#D97706]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Expediente enviado a revision</p>
            <p className="text-xs text-slate-400 mt-0.5">Esperando aprobacion del supervisor. Puedes seguir cargando o actualizando facturas.</p>
          </div>
          {monthOutsideForWizard.length > 0 && (
            <button onClick={onOpenWizard}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-[16px] border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-[#2563EB] hover:border-[#2563EB]/30 active:scale-[0.97]">
              <FiUpload size={12} /> Actualizar facturas
            </button>
          )}
        </div>
      </div>
      <div className={`${SURFACE} overflow-hidden`}>
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{monthAllowances.length} salidas enviadas</p>
        </div>
        <div className="divide-y divide-slate-100">
          {monthAllowances.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3">
              <div className="h-2 w-2 shrink-0 rounded-full bg-[#D97706]" />
              <span className="font-mono text-xs text-slate-500">{fmtDate(item.visit_date)}</span>
              {item.city && <span className="text-xs text-slate-700">{item.city}</span>}
              <span className="ml-auto font-mono text-xs text-slate-500">{toMoney(item.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepContentRevision({ monthAllowances }) {
  return (
    <div className="space-y-4">
      <div className={`${SURFACE} flex items-start gap-3 px-5 py-4`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <FiSearch size={16} className="text-[#2563EB]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">En proceso de aprobacion</p>
          <p className="text-xs text-slate-400 mt-0.5">Tu expediente esta siendo revisado por el equipo de aprobacion. Te notificaremos cuando este listo.</p>
        </div>
      </div>
      <div className={`${SURFACE} overflow-hidden`}>
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado por salida</p>
        </div>
        <div className="divide-y divide-slate-100">
          {monthAllowances.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3">
              <div className={`h-2 w-2 shrink-0 rounded-full ${item.status === "approved" ? "bg-[#16A34A]" : "bg-[#2563EB]"}`} />
              <span className="font-mono text-xs text-slate-500">{fmtDate(item.visit_date)}</span>
              {item.city && <span className="text-xs text-slate-700">{item.city}</span>}
              <div className="ml-auto flex items-center gap-2">
                <WorkflowBadge status={item.workflow_status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepContentPagado({ monthAllowances }) {
  const total = monthAllowances.reduce((s, a) => s + Number(a.amount || 0), 0);
  return (
    <div className="space-y-4">
      <div className={`${SURFACE} flex items-start gap-3 px-5 py-4`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
          <FiCheckCircle size={16} className="text-[#16A34A]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">Pago registrado</p>
          <p className="text-xs text-slate-400 mt-0.5">El pago del mes fue procesado por finanzas.</p>
          <p className="font-mono font-bold text-slate-900 mt-2">{toMoney(total)}</p>
        </div>
      </div>
    </div>
  );
}

function StepContentCerrado({ monthAllowances }) {
  const receiptUrl = monthAllowances.find((a) => a.payment_receipt_drive_url)?.payment_receipt_drive_url;
  return (
    <div className="space-y-4">
      <div className={`${SURFACE} overflow-hidden`}>
        <div className="flex items-start gap-3 px-5 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <FiCheckCircle size={20} className="text-[#16A34A]" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-slate-900">Expediente cerrado</p>
            <p className="text-xs text-slate-400 mt-0.5">El comprobante de pago fue subido por talento humano.</p>
            {receiptUrl && (
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition">
                <FiDownload size={13} /> Ver comprobante de pago
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepContentEmpty() {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center px-6 py-10">
      <FiFolder size={28} className="text-slate-200" />
      <p className="text-sm font-semibold text-slate-600">Sin actividad en este mes</p>
      <p className="text-xs text-slate-400 max-w-xs">Este mes no tiene salidas operacionales ni solicitudes de viatico registradas.</p>
    </div>
  );
}

// ── Main: ViaticosDeclarant ────────────────────────────────────────────────────

const ViaticosDeclarant = ({ isSupervisor }) => {
  const { showToast, showLoader, hideLoader } = useUI();
  const { user } = useAuth();

  const range = useMemo(() => wideRange(), []);
  const [filters, setFilters]   = useState({ start: range.start, end: range.end });
  const [candidates, setCandidates] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState("");
  const [policy, setPolicy]     = useState({ km_rate_per_km: 0.12 });

  const [selectedMonth, setSelectedMonth]     = useState(currentMonthKey());
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const [selectedItem, setSelectedItem]         = useState(null);
  const [wizardAllowances, setWizardAllowances] = useState(null);
  const [showReportes, setShowReportes]         = useState(false);
  const [supervisorRejectTarget, setSupervisorRejectTarget] = useState(null);
  const [supervisorRejectNote, setSupervisorRejectNote] = useState("");

  const [invoicesMap, setInvoicesMap]         = useState({});
  const [invoicesLoading, setInvoicesLoading] = useState({});
  const [manualNotesMap, setManualNotesMap]   = useState({});
  const [purchasesMap, setPurchasesMap]       = useState({});
  const [documentsMap, setDocumentsMap]       = useState({});
  const [reports, setReports]                 = useState({});
  const [saving, setSaving]                   = useState({});
  const [destinationDrafts, setDestinationDrafts] = useState({});
  const [candidateDrafts, setCandidateDrafts] = useState({});

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setLoadError(""); }
    try {
      const params = { start_date: filters.start, end_date: filters.end };
      const [avData, candData, policyData] = await Promise.all([
        listViaticos(params),
        listViaticosCandidates(params).catch(() => []),
        getViaticoConfigPolicy().catch(() => ({})),
      ]);
      setAllowances(Array.isArray(avData) ? avData : []);
      setCandidates(Array.isArray(candData) ? candData : []);
      if (policyData && typeof policyData === "object") setPolicy((p) => ({ ...p, ...policyData }));
    } catch (err) {
      const msg = err?.response?.data?.message || "No se pudieron cargar los datos.";
      setLoadError(msg); showToast(msg, "error");
    } finally { if (!silent) setLoading(false); }
  }, [filters.start, filters.end, showToast]);

  useEffect(() => { loadData(); }, [loadData]);
  useScopedAutoUpdate(DATA_UPDATE_SCOPES.VIATICOS, () => loadData({ silent: true }));

  const loadItemData = useCallback(async (id) => {
    setInvoicesLoading((p) => ({ ...p, [id]: true }));
    try {
      const [inv, notes, purchases, docs] = await Promise.all([
        listViaticoInvoices(id).catch(() => []),
        listManualNotes(id).catch(() => []),
        listPurchasesNoInvoice(id).catch(() => []),
        listViaticoDocuments(id).catch(() => []),
      ]);
      setInvoicesMap((p) => ({ ...p, [id]: inv }));
      setManualNotesMap((p) => ({ ...p, [id]: notes }));
      setPurchasesMap((p) => ({ ...p, [id]: purchases }));
      setDocumentsMap((p) => ({ ...p, [id]: docs }));
    } finally { setInvoicesLoading((p) => ({ ...p, [id]: false })); }
  }, []);

  const loadInvoices = useCallback(async (id) => {
    setInvoicesLoading((p) => ({ ...p, [id]: true }));
    try {
      const data = await listViaticoInvoices(id);
      setInvoicesMap((p) => ({ ...p, [id]: Array.isArray(data) ? data : [] }));
    } finally { setInvoicesLoading((p) => ({ ...p, [id]: false })); }
  }, []);

  const openDetail = useCallback((item) => {
    setSelectedItem(item);
    if (!invoicesMap[item.id]) loadItemData(item.id);
  }, [invoicesMap, loadItemData]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const myEmail = String(user?.email || "").toLowerCase();

  const myAllowances = useMemo(() =>
    isSupervisor
      ? allowances
      : allowances.filter((a) => String(a.requester_email || "").toLowerCase() === myEmail),
    [allowances, isSupervisor, myEmail]
  );

  const personalAllowances = useMemo(() =>
    allowances.filter((a) => String(a.requester_email || "").toLowerCase() === myEmail),
    [allowances, myEmail]
  );

  const personalCandidates = useMemo(
    () =>
      candidates.filter((c) => {
        const candidateEmail = String(c.requester_email || "").toLowerCase();
        return !candidateEmail || candidateEmail === myEmail;
      }),
    [candidates, myEmail]
  );

  const months = useMemo(() => {
    const allowanceMonths = groupByMonth(personalAllowances);
    const monthMap = new Map(allowanceMonths.map((month) => [month.key, month]));

    for (const candidate of personalCandidates) {
      const key = String(candidate.visit_date || candidate.hora_entrada || "").slice(0, 7);
      if (!key || key.length < 7 || monthMap.has(key)) continue;
      const [yr, mo] = key.split("-");
      const label = new Date(Number(yr), Number(mo) - 1, 1)
        .toLocaleString("es-EC", { month: "long", year: "numeric" });
      const labelCap = label.charAt(0).toUpperCase() + label.slice(1);
      monthMap.set(key, {
        key,
        label: labelCap,
        items: [],
        total: 0,
        pending: 0,
        approved: 0,
        paid: 0,
      });
    }

    return Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [personalAllowances, personalCandidates]);

  useEffect(() => {
    if (!months.length) return;
    const cur = currentMonthKey();
    if (!months.some((m) => m.key === cur)) setSelectedMonth(months[0].key);
  }, [months]);

  const monthAllowances = useMemo(() =>
    personalAllowances.filter((a) => String(a.visit_date || "").slice(0, 7) === selectedMonth),
    [personalAllowances, selectedMonth]
  );

  const operationalCandidates = useMemo(() =>
    personalCandidates.filter((c) => {
      if (c.source_type !== "operational_exit") return false;
      return String(c.visit_date || c.hora_entrada || "").slice(0, 7) === selectedMonth;
    }),
    [personalCandidates, selectedMonth]
  );

  const operationalPendingClassification = useMemo(() => {
    const editableWorkflow = new Set(["", "borrador", "observado", "pendiente_revision"]);

    const allowanceItems = monthAllowances
      .filter((item) => item.source_type === "operational_exit")
      .filter((item) => editableWorkflow.has(String(item.workflow_status || "").toLowerCase()))
      .filter((item) => String(item.status || "pending").toLowerCase() === "pending")
      .filter((item) => !Boolean(item.classification_completed))
      .map((item) => ({
        allowance_id: item.id,
        source_type: item.source_type,
        source_id: item.source_id,
        visit_date: item.visit_date,
        city: item.city,
        reference_name: item.reference_name || item.notes || "Salida operacional",
        hora_entrada: item.hora_entrada || null,
        hora_salida: item.hora_salida || null,
        outside_labor_area: item.outside_labor_area,
        uses_personal_vehicle: item.uses_personal_vehicle,
        odometer_start_km: item.odometer_start_km,
        odometer_end_km: item.odometer_end_km,
        odometer_distance_km: item.odometer_distance_km,
        odometer_start_photo_drive_url: item.odometer_start_photo_drive_url,
        odometer_end_photo_drive_url: item.odometer_end_photo_drive_url,
      }));

    const knownOperationalIds = new Set(
      allowanceItems
        .map((item) => Number(item.source_id))
        .filter((value) => Number.isFinite(value) && value > 0),
    );

    const fallbackCandidates = operationalCandidates
      .filter((item) => {
        const sourceId = Number(item.source_id);
        if (Number.isFinite(sourceId) && knownOperationalIds.has(sourceId)) return false;
        return !item.allowance_id;
      })
      .map((item) => ({
        ...item,
        allowance_id: item.allowance_id || null,
      }));

    return [...allowanceItems, ...fallbackCandidates];
  }, [monthAllowances, operationalCandidates]);

  const monthOutsideForWizard = useMemo(() =>
    monthAllowances.filter((a) => {
      const wf = String(a.workflow_status || "");
      return Boolean(a.outside_labor_area) && (wf === "borrador" || wf === "" || wf === "observado" || wf === "pendiente_revision") && a.status === "pending";
    }),
    [monthAllowances]
  );

  const monthObservado = useMemo(() =>
    monthAllowances.filter((a) => String(a.workflow_status || "") === "observado"),
    [monthAllowances]
  );

  const supervisorQueue = useMemo(() =>
    isSupervisor ? myAllowances.filter((a) => a.workflow_status === "pendiente_revision") : [],
    [myAllowances, isSupervisor]
  );

  const { step: monthStep, label: stepLabel } = useMemo(
    () => getMonthStepInfo(monthAllowances, operationalPendingClassification),
    [monthAllowances, operationalPendingClassification]
  );

  const selectedMonthMeta = months.find((m) => m.key === selectedMonth);
  const selectedMonthMetrics = useMemo(
    () => getMonthFlowMetrics(monthAllowances, operationalPendingClassification),
    [monthAllowances, operationalPendingClassification]
  );
  const portfolioMetrics = useMemo(
    () => getMonthFlowMetrics(personalAllowances, personalCandidates.filter((item) => item.source_type === "operational_exit")),
    [personalAllowances, personalCandidates]
  );
  const monthMetricsMap = useMemo(() => {
    const metricsMap = new Map();
    for (const month of months) {
      const monthCandidates = personalCandidates.filter((candidate) =>
        candidate.source_type === "operational_exit"
        && String(candidate.visit_date || candidate.hora_entrada || "").slice(0, 7) === month.key
      );
      metricsMap.set(month.key, getMonthFlowMetrics(month.items, monthCandidates));
    }
    return metricsMap;
  }, [months, personalCandidates]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleDeleteInvoice = async (allowanceId, invoiceId) => {
    const key = `del-inv-${invoiceId}`;
    setSaving((p) => ({ ...p, [key]: true }));
    try {
      await deleteViaticoInvoice(invoiceId);
      setInvoicesMap((p) => ({ ...p, [allowanceId]: (p[allowanceId] || []).filter((i) => i.id !== invoiceId) }));
      showToast("Factura eliminada", "success");
      loadData({ silent: true });
    } catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
    finally { setSaving((p) => ({ ...p, [key]: false })); }
  };

  const handlePatchInvoice = async (allowanceId, invoiceId, patch) => {
    const key = `patch-inv-${invoiceId}`;
    setSaving((p) => ({ ...p, [key]: true }));
    try { await patchViaticoInvoice(invoiceId, patch); await loadInvoices(allowanceId); }
    catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
    finally { setSaving((p) => ({ ...p, [key]: false })); }
  };

  const handleUpdateManualNote = async (allowanceId, noteId, payload) => {
    try {
      await updateManualNote(noteId, payload);
      showToast("Nota actualizada", "success");
      const notes = await listManualNotes(allowanceId).catch(() => []);
      setManualNotesMap((p) => ({ ...p, [allowanceId]: notes }));
      loadData({ silent: true });
    } catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
  };

  const handleDeleteManualNote = async (allowanceId, noteId) => {
    try {
      await deleteManualNote(noteId);
      showToast("Nota eliminada", "success");
      const notes = await listManualNotes(allowanceId).catch(() => []);
      setManualNotesMap((p) => ({ ...p, [allowanceId]: notes }));
      loadData({ silent: true });
    } catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
  };

  const handleApproveSegment = async (allowanceId) => {
    const key = `approve-segment-${allowanceId}`;
    setSaving((p) => ({ ...p, [key]: true })); showLoader("Registrando aprobacion...");
    try { await approveViaticoSegment(allowanceId); showToast("Aprobacion registrada", "success"); await loadData({ silent: true }); }
    catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
    finally { hideLoader(); setSaving((p) => ({ ...p, [key]: false })); }
  };

  const handleWorkflowUpdate = async (allowanceId, workflowStatus, extra = {}) => {
    const key = `wf-${allowanceId}`;
    setSaving((p) => ({ ...p, [key]: true }));
    showLoader(workflowStatus === "aprobado_jefe" ? "Aprobando..." : "Actualizando...");
    try {
      await updateViaticoWorkflow(allowanceId, { workflow_status: workflowStatus, ...extra });
      showToast(workflowStatus.startsWith("aprobado") ? "Aprobado" : "Rechazado", workflowStatus.startsWith("aprobado") ? "success" : "error");
      await loadData({ silent: true });
    } catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
    finally { hideLoader(); setSaving((p) => ({ ...p, [key]: false })); }
  };

  const handleOpenSupervisorReject = (item) => {
    setSupervisorRejectTarget(item);
    setSupervisorRejectNote(String(item?.notes || ""));
  };

  const handleConfirmSupervisorReject = async () => {
    if (!supervisorRejectTarget || !supervisorRejectNote.trim()) return;
    await handleWorkflowUpdate(supervisorRejectTarget.id, "rechazado_jefe", { notes: supervisorRejectNote.trim() });
    if (selectedItem?.id === supervisorRejectTarget.id) {
      setSelectedItem(null);
    }
    setSupervisorRejectTarget(null);
    setSupervisorRejectNote("");
  };

  const handlePatchStatus = async (allowanceId, status, extra = {}) => {
    const key = `status-${allowanceId}`;
    setSaving((p) => ({ ...p, [key]: true }));
    showLoader(extra.workflow_status === "observado" ? "Solicitando correccion..." : "Actualizando...");
    try { await updateViaticoStatus(allowanceId, { status, ...extra }); showToast("Estado actualizado", "success"); await loadData({ silent: true }); }
    catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
    finally { hideLoader(); setSaving((p) => ({ ...p, [key]: false })); }
  };

  const handleBuildReport = async (allowanceId) => {
    const key = `report-${allowanceId}`;
    setSaving((p) => ({ ...p, [key]: true })); showLoader("Cotejando asistencia...");
    try { const data = await getViaticoReport(allowanceId); setReports((p) => ({ ...p, [allowanceId]: data })); showToast("Reporte generado", "success"); }
    catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
    finally { hideLoader(); setSaving((p) => ({ ...p, [key]: false })); }
  };

  const handleClassifyCandidate = async (item, outsideLaborArea) => {
    const key   = `cand-${item.source_type}-${item.source_id}`;
    const draft = candidateDrafts[key] || {};
    const city  = String(draft.destination_city || item.city || "").trim();
    if (!city) { showToast("Debes registrar la ciudad de destino", "warning"); return; }
    setSaving((p) => ({ ...p, [key]: true })); showLoader("Guardando clasificacion...");
    try {
      await upsertViatico({
        source_type: item.source_type,
        source_id: item.source_id,
        visit_date: item.visit_date,
        city,
        amount: 0,
        outside_labor_area: Boolean(outsideLaborArea),
        classification_completed: true,
        notes: item.reference_name || "",
      });
      showToast("Clasificacion guardada", "success");
      await loadData();
    } catch (err) { showToast(err?.response?.data?.message || "Error", "error"); }
    finally { hideLoader(); setSaving((p) => ({ ...p, [key]: false })); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-4`}>
      <ViaticosActionModal
        open={Boolean(supervisorRejectTarget)}
        title="Rechazar salida operacional"
        description="Indica el motivo del rechazo para notificar al colaborador y dejar trazabilidad."
        label="Motivo del rechazo"
        value={supervisorRejectNote}
        onChange={setSupervisorRejectNote}
        onClose={() => {
          if (supervisorRejectTarget && saving[`wf-${supervisorRejectTarget.id}`]) return;
          setSupervisorRejectTarget(null);
          setSupervisorRejectNote("");
        }}
        onConfirm={handleConfirmSupervisorReject}
        confirmLabel="Rechazar salida"
        placeholder="Describe el motivo del rechazo"
        multiline
        required
        loading={Boolean(supervisorRejectTarget && saving[`wf-${supervisorRejectTarget.id}`])}
      />

      {/* Wizard modal */}
      {wizardAllowances && (
        <Modal open onClose={() => setWizardAllowances(null)} maxWidth="max-w-5xl" hideHeader>
          <ViaticosWizard allowances={wizardAllowances} onClose={() => setWizardAllowances(null)}
            onComplete={() => { setWizardAllowances(null); loadData(); }} />
        </Modal>
      )}

      {selectedItem && (
        <ViaticosDetailModal
          item={selectedItem}
          isFinance={false} isSupervisor={isSupervisor} isTalento={false}
          isOwn={String(selectedItem.requester_email || "").toLowerCase() === myEmail}
          policy={policy}
          invoices={invoicesMap[selectedItem.id] || []}
          invoicesLoading={Boolean(invoicesLoading[selectedItem.id])}
          manualNotes={manualNotesMap[selectedItem.id] || []}
          purchases={purchasesMap[selectedItem.id] || []}
          documents={documentsMap[selectedItem.id] || []}
          saving={saving}
          report={reports[selectedItem.id]}
          onClose={() => setSelectedItem(null)}
          onWizard={setWizardAllowances}
          onWorkflowUpdate={handleWorkflowUpdate}
          onRejectSupervisor={handleOpenSupervisorReject}
          onApproveSegment={handleApproveSegment}
          onPatchStatus={handlePatchStatus}
          onDeleteInvoice={handleDeleteInvoice}
          onPatchInvoice={handlePatchInvoice}
          onUpdateManualNote={handleUpdateManualNote}
          onDeleteManualNote={handleDeleteManualNote}
          onBuildReport={handleBuildReport}
          loadInvoices={loadInvoices}
          showToast={showToast} showLoader={showLoader} hideLoader={hideLoader}
          destinationDraft={destinationDrafts[selectedItem.id] ?? (selectedItem.city || "")}
          setDestinationDraft={(v) => setDestinationDrafts((p) => ({ ...p, [selectedItem.id]: v }))}
        />
      )}

      {showReportes && <ReportesModal filters={filters} showToast={showToast} onClose={() => setShowReportes(false)} />}

      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Viaticos</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[#1E293B]">
            {isSupervisor ? "Mis viaticos y aprobaciones" : "Mis viaticos"}
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            {isSupervisor ? "Tus salidas operacionales y la cola de aprobacion de tu equipo." : "Tus salidas operacionales y expedientes de viatico."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowReportes(true)} className={BTN_SECONDARY}>
            <FiDownload size={13} /> Reportes
          </button>
          <button onClick={() => loadData()} disabled={loading} className={BTN_SECONDARY}>
            {loading ? <Spinner size={13} /> : <FiRefreshCw size={13} />} Recargar
          </button>
        </div>
      </div>

      {/* Period filter */}
      <div className={`${SURFACE} px-4 py-3`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Desde</span>
            <input type="date" value={filters.start}
              onChange={(e) => setFilters((p) => ({ ...p, start: e.target.value }))}
              className={`${CONTROL} font-mono`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hasta</span>
            <input type="date" value={filters.end}
              onChange={(e) => setFilters((p) => ({ ...p, end: e.target.value }))}
              className={`${CONTROL} font-mono`} />
          </label>
          <button onClick={() => loadData()} disabled={loading} className={BTN_PRIMARY}>
            {loading ? <Spinner size={13} /> : <FiRefreshCw size={13} />} Cargar
          </button>
          {loadError && <p className="text-xs text-[#DC2626] flex items-center gap-1.5"><FiAlertTriangle size={12} /> {loadError}</p>}
        </div>
      </div>

      <MonthStatusStrip metrics={portfolioMetrics} />

      {/* Supervisor approval queue */}
      {isSupervisor && supervisorQueue.length > 0 && (
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex items-center gap-2.5 border-b border-amber-100 bg-amber-50 px-5 py-3">
            <FiClock size={14} className="text-[#D97706]" />
            <span className="text-sm font-semibold text-amber-900">Pendiente tu aprobacion</span>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">{supervisorQueue.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {supervisorQueue.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <button onClick={() => openDetail(item)} className="flex-1 min-w-0 text-left group">
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-[#2563EB] transition-colors truncate">
                    {item.requester_name || item.requester_email}
                  </p>
                  <div className="mt-0.5 flex gap-3 text-[11px] text-slate-400">
                    <span className="font-mono">{fmtDate(item.visit_date)}</span>
                    {item.city && <span>{item.city}</span>}
                    <span className="font-mono">{toMoney(item.amount)}</span>
                  </div>
                </button>
                <div className="flex gap-2 shrink-0">
                  <button disabled={saving[`wf-${item.id}`]}
                    onClick={() => handleWorkflowUpdate(item.id, "aprobado_jefe", { trip_authorized: true })}
                    className={`${BTN_SUCCESS} text-xs min-h-9 px-3`}>
                    <FiThumbsUp size={12} /> Aprobar
                  </button>
                  <button disabled={saving[`wf-${item.id}`]}
                    onClick={() => handleOpenSupervisorReject(item)}
                    className={`${BTN_DANGER} text-xs min-h-9 px-3`}>
                    <FiThumbsDown size={12} />
                  </button>
                  <button onClick={() => openDetail(item)} className={BTN_GHOST}>Ver</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">

        {/* LEFT: Month list */}
        <div className={`${SURFACE} flex flex-col overflow-hidden ${showDetailPanel ? "hidden lg:flex" : "flex"}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <FiFolder size={14} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-900">Expedientes</span>
            </div>
            {loading ? <Spinner size={12} /> : (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                {months.length} {months.length === 1 ? "mes" : "meses"}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {loading && months.length === 0 ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-400"><Spinner /> Cargando...</div>
            ) : months.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 px-5 text-center">
                <FiFolder size={22} className="text-slate-200" />
                <p className="text-xs font-medium text-slate-500">Sin expedientes en el rango</p>
                <p className="text-[11px] text-slate-400">Ajusta las fechas y presiona Cargar.</p>
              </div>
            ) : months.map((m) => {
              const isActive  = selectedMonth === m.key;
              const isCurrent = m.key === currentMonthKey();
              const allClosed = m.items.length > 0 && m.items.every((a) => a.workflow_status === "cerrado");
              const monthCandidates = personalCandidates.filter((candidate) =>
                candidate.source_type === "operational_exit"
                && String(candidate.visit_date || candidate.hora_entrada || "").slice(0, 7) === m.key
              );
              const monthMetrics = monthMetricsMap.get(m.key) || getMonthFlowMetrics(m.items, []);
              const { label: mStepLabel } = getMonthStepInfo(m.items, monthCandidates);
              const stageMeta = MONTH_STAGE_META[mStepLabel] || MONTH_STAGE_META.empty;
              const pendingCount = getPrimaryPendingCount(mStepLabel, monthMetrics);

              const stepDotCls = {
                empty: "bg-slate-200",
                clasificar: "bg-[#D97706]",
                declarar: "bg-[#2563EB]",
                observado: "bg-orange-500",
                enviado: "bg-[#D97706]",
                en_revision: "bg-[#2563EB]",
                pagado: "bg-[#16A34A]",
                cerrado: "bg-slate-300",
              };

              return (
                <button key={m.key} type="button"
                  onClick={() => { setSelectedMonth(m.key); setShowDetailPanel(true); }}
                  className={`group w-full cursor-pointer px-4 py-3.5 text-left transition active:scale-[0.99] ${FOCUS} ${isActive ? "bg-[#1E293B]" : "hover:bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${isActive ? "text-white" : "text-slate-900"}`}>{m.label}</p>
                        {isCurrent && <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${isActive ? "bg-white/15 text-white/70" : "bg-blue-100 text-[#2563EB]"}`}>Este mes</span>}
                        {allClosed && <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${isActive ? "bg-emerald-400/20 text-emerald-300" : "bg-emerald-100 text-[#16A34A]"}`}>Cerrado</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? "bg-white/60" : (stepDotCls[mStepLabel] || "bg-slate-300")}`} />
                        <span className={`text-[10px] font-medium ${isActive ? "text-white/50" : "text-slate-400"}`}>
                          {stageMeta.pill}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {pendingCount > 0 && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-600"}`}>
                            {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
                          </span>
                        )}
                        {monthMetrics.outsideActive > 0 && (
                          <span className={`text-[10px] font-medium ${isActive ? "text-white/55" : "text-slate-500"}`}>
                            {monthMetrics.outsideActive} fuera del area
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-mono text-xs font-semibold ${isActive ? "text-white/70" : "text-slate-500"}`}>{toMoney(m.total)}</p>
                      <p className={`text-[10px] ${isActive ? "text-white/40" : "text-slate-400"}`}>{m.items.length} salidas</p>
                    </div>
                  </div>
                  <MiniProgressBar paid={m.paid} approved={m.approved} pending={m.pending} total={m.items.length} active={isActive} />
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Month detail with step rail */}
        <div className={`flex flex-col gap-4 min-w-0 ${showDetailPanel ? "flex" : "hidden lg:flex"}`}>

          {showDetailPanel && (
            <div className="flex items-center lg:hidden">
              <button type="button" onClick={() => setShowDetailPanel(false)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] ${FOCUS} rounded-lg px-1 py-1`}>
                <FiArrowLeft size={13} /> Volver a expedientes
              </button>
            </div>
          )}

          {!selectedMonthMeta ? (
            <div className={`${SURFACE} flex min-h-[220px] flex-col items-center justify-center gap-2 px-6 py-10 text-center`}>
              <FiFolder size={26} className="text-slate-200" />
              <p className="text-sm font-semibold text-slate-700">Selecciona un expediente</p>
              <p className="text-xs text-slate-400">Elige un mes del panel izquierdo para ver el detalle.</p>
            </div>
          ) : (
            <>
              {/* Month header + step rail */}
              <div className={`${SURFACE} overflow-hidden`}>
                <div className="bg-[#1E293B] px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Expediente</p>
                      <h2 className="mt-0.5 text-lg font-bold text-white">{selectedMonthMeta.label}</h2>
                      <p className="mt-1 text-xs text-slate-400">El flujo del mes se organiza por clasificacion, declaracion, revision y liquidacion.</p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-right">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Salidas</p>
                        <p className="font-mono text-xl font-bold text-white">{selectedMonthMeta.items.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total</p>
                        <p className="font-mono text-xl font-bold text-white">{toMoney(selectedMonthMeta.total)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Step rail */}
                <div className="border-b border-slate-100 px-5 py-4">
                  {monthStep >= 0 ? (
                    <StepRail currentStep={monthStep} isObservado={stepLabel === "observado"} />
                  ) : (
                    <p className="text-xs text-slate-400 text-center">Sin actividad en este mes.</p>
                  )}
                </div>
                {/* Cerrado state — receipt link */}
                {monthAllowances.length > 0 && monthAllowances.every((a) => a.workflow_status === "cerrado") && (
                  <div className="px-5 py-2.5">
                    <CerradoBanner
                      receiptUrl={monthAllowances.find((a) => a.payment_receipt_drive_url)?.payment_receipt_drive_url}
                    />
                  </div>
                )}
              </div>

              <MonthPrimaryActionPanel
                stepLabel={stepLabel}
                metrics={selectedMonthMetrics}
                monthOutsideForWizard={monthOutsideForWizard}
                onOpenWizard={(targets) => setWizardAllowances(targets)}
              />

              {/* Step content area */}
              <div>
                {stepLabel === "empty" && <StepContentEmpty />}
                {stepLabel === "clasificar" && (
                  <StepContentClasificar
                    candidates={operationalPendingClassification}
                    candidateDrafts={candidateDrafts}
                    setCandidateDrafts={setCandidateDrafts}
                    saving={saving}
                    onClassify={handleClassifyCandidate}
                  />
                )}
                {stepLabel === "declarar" && (
                  <StepContentDeclarar
                    monthAllowances={monthAllowances}
                    monthOutsideForWizard={monthOutsideForWizard}
                    onOpenWizard={() => setWizardAllowances(monthOutsideForWizard)}
                  />
                )}
                {stepLabel === "observado" && (
                  <StepContentObservado
                    monthObservado={monthObservado}
                    monthOutsideForWizard={monthOutsideForWizard}
                    monthAllowances={monthAllowances}
                    onOpenWizard={(targets) => setWizardAllowances(targets)}
                  />
                )}
                {stepLabel === "enviado" && <StepContentEnviado monthAllowances={monthAllowances} monthOutsideForWizard={monthOutsideForWizard} onOpenWizard={() => setWizardAllowances(monthOutsideForWizard)} />}
                {stepLabel === "en_revision" && <StepContentRevision monthAllowances={monthAllowances} />}
                {stepLabel === "pagado" && <StepContentPagado monthAllowances={monthAllowances} />}
                {stepLabel === "cerrado" && <StepContentCerrado monthAllowances={monthAllowances} />}
              </div>

              <MonthProcessingOverview monthAllowances={monthAllowances} onOpenDetail={openDetail} />

              {/* Supervisor inline items list (for non-declarant months) */}
              {isSupervisor && monthAllowances.length > 0 && (
                <div className={`${SURFACE} overflow-hidden`}>
                  <div className="border-b border-slate-100 px-5 py-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Todos los registros del mes</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {myAllowances
                      .filter((a) => String(a.visit_date || "").slice(0, 7) === selectedMonth)
                      .sort((a, b) => String(b.visit_date).localeCompare(String(a.visit_date)))
                      .map((item) => {
                        const needsSuper = item.workflow_status === "pendiente_revision";
                        return (
                          <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                            <div className={`h-2 w-2 shrink-0 rounded-full ${item.status === "approved" ? "bg-[#16A34A]" : item.status === "paid" ? "bg-[#2563EB]" : "bg-[#D97706]"}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-2 items-center">
                                {item.requester_name && <span className="text-xs font-semibold text-slate-700">{item.requester_name}</span>}
                                <StatusBadge status={item.status} />
                                <WorkflowBadge status={item.workflow_status} />
                              </div>
                              <div className="flex gap-3 text-[11px] text-slate-400 mt-0.5">
                                <span className="font-mono">{fmtDate(item.visit_date)}</span>
                                {item.city && <span>{item.city}</span>}
                                <span className="font-mono">{toMoney(item.amount)}</span>
                              </div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              {needsSuper && (
                                <>
                                  <button disabled={saving[`wf-${item.id}`]}
                                    onClick={() => handleWorkflowUpdate(item.id, "aprobado_jefe", { trip_authorized: true })}
                                    className={`${BTN_SUCCESS} text-xs min-h-8 px-2.5 rounded-lg`} title="Aprobar">
                                    <FiThumbsUp size={12} />
                                  </button>
                                  <button disabled={saving[`wf-${item.id}`]}
                                    onClick={() => handleOpenSupervisorReject(item)}
                                    className={`${BTN_DANGER} text-xs min-h-8 px-2.5 rounded-lg`} title="Rechazar">
                                    <FiThumbsDown size={12} />
                                  </button>
                                </>
                              )}
                              <button onClick={() => openDetail(item)} className={BTN_GHOST}>Ver</button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViaticosDeclarant;
