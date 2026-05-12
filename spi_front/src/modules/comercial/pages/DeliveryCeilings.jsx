import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiFilter,
  FiPackage,
  FiRefreshCw,
  FiShield,
  FiTruck,
  FiX,
} from "react-icons/fi";

import { useUI } from "../../../core/ui/UIContext";
import { useAuth } from "../../../core/auth/AuthContext";
import {
  cancelDeliveryRequest,
  confirmDeliveryRequest,
  createDeliveryRequest,
  listDeliveryCeilings,
  listDeliveryRequests,
  opsApproveDeliveryRequest,
} from "../../../core/api/deliveryRequestsApi";

// ─── Constants ───────────────────────────────────────────────────────────────

const VIEW_ROLES = new Set([
  "comercial", "backoffice_comercial", "acp_comercial", "jefe_comercial",
  "gerencia", "gerencia_general", "jefe_operaciones", "operaciones",
  "jefe_logistica", "admin", "administrador",
]);

const COMMERCIAL_ROLES = new Set([
  "comercial", "backoffice_comercial", "acp_comercial", "jefe_comercial",
  "gerencia", "gerencia_general", "admin", "administrador",
]);

const OPS_ROLES = new Set([
  "jefe_operaciones", "operaciones", "gerencia", "gerencia_general",
  "acp_comercial", "jefe_comercial", "admin",
]);

const LOGISTICS_ROLES = new Set([
  "jefe_logistica", "gerencia", "gerencia_general",
  "acp_comercial", "jefe_comercial", "admin",
]);

const ITEM_TYPE_LABELS = {
  equipment:             "Equipo",
  reagent:               "Reactivo",
  determination:         "Determinación",
  calibrator:            "Calibrador",
  control:               "Control",
  additional_investment: "Inversión adicional",
  service:               "Servicio",
};

const PURCHASE_TYPE_LABELS = { public: "Pública", private: "Privada" };

const API_ERROR_MAP = {
  MAX_EXCEEDED:              "La cantidad supera el saldo disponible.",
  CEILING_NOT_ACTIVE:        "El techo de máximos no está activo.",
  PUBLIC_PLAN_NOT_APPROVED:  "No hay plan de entregas público aprobado.",
  OUTSIDE_DELIVERY_WINDOW:   "Fuera de la ventana de entrega vigente.",
  TRANCHE_MAX_EXCEEDED:      "La cantidad supera el máximo del tramo vigente.",
  DELIVERY_REQUEST_NOT_OPS_APPROVED: "La solicitud debe ser aprobada por Operaciones primero.",
  DELIVERY_REQUEST_NOT_PENDING:      "Solo se pueden aprobar solicitudes pendientes.",
  DELIVERY_REQUEST_ALREADY_TERMINAL: "La solicitud ya fue confirmada o cancelada.",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizeRoles = (user) => {
  if (!user) return new Set();
  const values = [
    ...((Array.isArray(user.roles) ? user.roles : [user.role]) || []),
    ...((Array.isArray(user.scope) ? user.scope : []) || []),
    ...((Array.isArray(user.scopes) ? user.scopes : []) || []),
  ];
  return new Set(
    values
      .flatMap((v) => String(v || "").split(/[,\s]+/))
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );
};

const hasAny = (roleSet, allowed) =>
  [...roleSet].some((r) => allowed.has(r));

const resolveError = (error) => {
  if (error?.response?.status === 403) return "Sin permisos para esta acción.";
  const code = error?.response?.data?.code || error?.code;
  return API_ERROR_MAP[code] || error?.response?.data?.message || error?.message || "Error inesperado.";
};

const fmtDate = (val) => {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtQty = (val, unit = "") =>
  `${Number(val || 0).toLocaleString("es-EC", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;

const pct = (delivered, max) => {
  if (!max || max <= 0) return 0;
  return Math.min(100, Math.round((delivered / max) * 100));
};

// ─── Status chips ─────────────────────────────────────────────────────────────

const CEILING_STATUS = {
  active:   { label: "Activo",   cls: "bg-green-50 text-green-700 ring-1 ring-green-200" },
  approved: { label: "Aprobado", cls: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
  draft:    { label: "Borrador", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  closed:   { label: "Cerrado",  cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" },
};

const REQUEST_STATUS = {
  pending:      { label: "Pendiente",        cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",  Icon: FiClock },
  ops_approved: { label: "Aprobado por Ops", cls: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",    Icon: FiPackage },
  confirmed:    { label: "Despachado",       cls: "bg-green-50 text-green-700 ring-1 ring-green-200", Icon: FiTruck },
  cancelled:    { label: "Cancelado",        cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", Icon: FiX },
};

function StatusChip({ status, map }) {
  const cfg = map[status] || { label: status, cls: "bg-slate-100 text-slate-600", Icon: null };
  const { label, cls, Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {Icon && <Icon size={10} aria-hidden="true" />}
      {label}
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function LineProgress({ line }) {
  const { item_type, unit, max_quantity, delivered_qty, reserved_open_qty, remaining_qty, remaining_effective_qty } = line;
  const delivered  = Number(delivered_qty || 0);
  const reserved   = Number(reserved_open_qty || 0);
  const max        = Number(max_quantity || 0);
  const pctDel     = pct(delivered, max);
  const pctRes     = Math.min(100 - pctDel, pct(reserved, max));
  const typeLabel  = ITEM_TYPE_LABELS[item_type] || item_type;

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-ink-slate">{typeLabel}</span>
        <span className="text-[11px] text-warm-ash font-mono">
          {fmtQty(delivered, unit)} / {fmtQty(max, unit)}
        </span>
      </div>
      {/* Track */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-action-blue rounded-full transition-all duration-300"
          style={{ width: `${pctDel}%` }}
          title={`Despachado: ${fmtQty(delivered, unit)}`}
        />
        {pctRes > 0 && (
          <div
            className="h-full bg-sky-300 transition-all duration-300"
            style={{ width: `${pctRes}%` }}
            title={`Reservado: ${fmtQty(reserved, unit)}`}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-3 text-[10px] text-warm-ash">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-action-blue" />
            Despachado
          </span>
          {pctRes > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-sky-300" />
              Reservado
            </span>
          )}
        </div>
        <span className="text-[10px] text-warm-ash">
          Saldo: <span className="font-medium text-ink-slate font-mono">{fmtQty(remaining_effective_qty ?? remaining_qty, unit)}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Request row ──────────────────────────────────────────────────────────────

function RequestRow({ req, canOpsApprove, canLogisticsConfirm, onAction }) {
  const [busy, setBusy] = useState(false);
  const cfg = REQUEST_STATUS[req.status] || REQUEST_STATUS.pending;

  const act = async (fn, label) => {
    setBusy(true);
    try { await fn(); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-ink-slate">Solicitud #{req.id}</span>
          <StatusChip status={req.status} map={REQUEST_STATUS} />
          <span className="text-[10px] text-warm-ash">{fmtDate(req.requested_at)}</span>
        </div>
        {req.lines?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {req.lines.map((ln) => (
              <span key={ln.id} className="text-[10px] text-warm-ash bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                {ITEM_TYPE_LABELS[ln.item_type] || ln.item_type}: <span className="font-mono font-medium text-ink-slate">{fmtQty(ln.requested_qty, ln.unit)}</span>
              </span>
            ))}
          </div>
        )}
        {req.notes && <p className="mt-1 text-[10px] text-warm-ash italic">{req.notes}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {req.status === "pending" && canOpsApprove && (
          <button
            disabled={busy}
            onClick={() => act(() => onAction("ops_approve", req.id), "Aprobando")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-action-blue text-white disabled:opacity-50 cursor-pointer hover:bg-blue-700 active:scale-[0.97] transition-colors duration-150"
          >
            <FiPackage size={11} aria-hidden="true" />
            Aprobar
          </button>
        )}
        {req.status === "ops_approved" && canLogisticsConfirm && (
          <button
            disabled={busy}
            onClick={() => act(() => onAction("confirm", req.id), "Confirmando")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-operative-green text-white disabled:opacity-50 cursor-pointer hover:bg-green-700 active:scale-[0.97] transition-colors duration-150"
          >
            <FiTruck size={11} aria-hidden="true" />
            Confirmar despacho
          </button>
        )}
        {(req.status === "pending" || req.status === "ops_approved") && (
          <button
            disabled={busy}
            onClick={() => act(() => onAction("cancel", req.id), "Cancelando")}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium text-warm-ash hover:text-alert-red hover:bg-red-50 cursor-pointer active:scale-[0.97] transition-colors duration-150"
            title="Cancelar solicitud"
          >
            <FiX size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Create request form ───────────────────────────────────────────────────────

function CreateRequestForm({ ceiling, onCreated }) {
  const { showToast } = useUI();
  const [qtys, setQtys] = useState({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lines = ceiling.lines || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = lines
      .map((ln) => ({ ceilingLineId: Number(ln.id), requestedQty: Number(qtys[ln.id] || 0) }))
      .filter((l) => l.requestedQty > 0);

    if (!payload.length) {
      showToast("Ingresa al menos una cantidad mayor a 0.", "warning");
      return;
    }

    const bad = payload.find((l) => {
      const ln = lines.find((x) => Number(x.id) === l.ceilingLineId);
      return l.requestedQty > Number(ln?.remaining_effective_qty || 0) + 1e-9;
    });
    if (bad) {
      showToast("Una cantidad supera el saldo efectivo disponible.", "error");
      return;
    }

    try {
      setSubmitting(true);
      await createDeliveryRequest({ ceilingId: Number(ceiling.id), lines: payload, notes: notes.trim() || null });
      showToast("Solicitud registrada. Pendiente de aprobación por Operaciones.", "success");
      setQtys({});
      setNotes("");
      onCreated();
    } catch (err) {
      showToast(resolveError(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-slate-100">
      <p className="text-xs font-semibold text-ink-slate mb-3">Nueva solicitud de entrega</p>
      <div className="space-y-3">
        {lines.map((ln) => {
          const balance = Number(ln.remaining_effective_qty ?? ln.remaining_qty ?? 0);
          const typeLabel = ITEM_TYPE_LABELS[ln.item_type] || ln.item_type;
          return (
            <div key={ln.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <label htmlFor={`qty-${ln.id}`} className="text-[11px] font-medium text-warm-ash block mb-0.5">
                  {typeLabel}
                </label>
                <p className="text-[10px] text-warm-ash">
                  Saldo: <span className="font-mono font-medium text-ink-slate">{fmtQty(balance, ln.unit)}</span>
                </p>
              </div>
              <input
                id={`qty-${ln.id}`}
                type="number"
                min={0}
                max={balance}
                step="any"
                disabled={balance <= 0}
                value={qtys[ln.id] ?? ""}
                onChange={(e) => setQtys((p) => ({ ...p, [ln.id]: e.target.value }))}
                placeholder="0"
                className="w-28 h-9 px-3 rounded-xl border border-slate-200 text-sm text-ink-slate text-right font-mono
                           focus:outline-none focus:border-action-blue focus:ring-2 focus:ring-sky-signal/20
                           disabled:bg-slate-50 disabled:text-warm-ash disabled:cursor-not-allowed"
              />
              <span className="text-xs text-warm-ash w-6 flex-shrink-0">{ln.unit}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <label htmlFor={`notes-${ceiling.id}`} className="text-[11px] font-medium text-warm-ash block mb-1">
          Notas (opcional)
        </label>
        <input
          id={`notes-${ceiling.id}`}
          type="text"
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Motivo o referencia de la solicitud"
          className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm text-ink-slate
                     focus:outline-none focus:border-action-blue focus:ring-2 focus:ring-sky-signal/20"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium
                     bg-action-blue text-white disabled:opacity-60 cursor-pointer
                     hover:bg-blue-700 active:scale-[0.97] transition-colors duration-150"
        >
          {submitting ? <FiRefreshCw size={13} className="animate-spin" aria-hidden="true" /> : <FiPackage size={13} aria-hidden="true" />}
          Solicitar entrega
        </button>
      </div>
    </form>
  );
}

// ─── Ceiling card ──────────────────────────────────────────────────────────────

function CeilingCard({ ceiling, canCommercial, canOpsApprove, canLogisticsConfirm, onRefresh }) {
  const { showToast } = useUI();
  const [expanded, setExpanded] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingReq, setLoadingReq] = useState(false);
  const loadedRef = useRef(false);

  const ceilCfg = CEILING_STATUS[ceiling.status] || CEILING_STATUS.draft;

  const loadRequests = useCallback(async () => {
    setLoadingReq(true);
    try {
      const data = await listDeliveryRequests({ ceiling_id: ceiling.id });
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoadingReq(false);
    }
  }, [ceiling.id]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loadedRef.current) {
      loadedRef.current = true;
      loadRequests();
    }
  };

  const handleAction = async (type, requestId) => {
    try {
      if (type === "ops_approve") {
        await opsApproveDeliveryRequest(requestId);
        showToast("Solicitud aprobada. Logística puede proceder con el despacho.", "success");
      } else if (type === "confirm") {
        await confirmDeliveryRequest(requestId);
        showToast("Despacho confirmado. Saldo actualizado.", "success");
      } else if (type === "cancel") {
        await cancelDeliveryRequest(requestId);
        showToast("Solicitud cancelada.", "success");
      }
      await loadRequests();
      onRefresh();
    } catch (err) {
      showToast(resolveError(err), "error");
    }
  };

  const activeRequests   = requests.filter((r) => r.status !== "cancelled" && r.status !== "confirmed");
  const historyRequests  = requests.filter((r) => r.status === "confirmed" || r.status === "cancelled");

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-ambient overflow-hidden">
      {/* Header */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors duration-150"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink-slate tracking-tight truncate max-w-xs font-mono">
              BC {String(ceiling.business_case_id || "—").slice(0, 8)}
            </span>
            <StatusChip status={ceiling.status} map={CEILING_STATUS} />
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium
              ${ceiling.purchase_type === "public" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"}`}>
              {PURCHASE_TYPE_LABELS[ceiling.purchase_type] || ceiling.purchase_type}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-warm-ash">
            {fmtDate(ceiling.valid_from)} — {ceiling.valid_to ? fmtDate(ceiling.valid_to) : "Sin cierre"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {activeRequests.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
              {activeRequests.length}
            </span>
          )}
          {expanded
            ? <FiChevronUp size={16} className="text-warm-ash" aria-hidden="true" />
            : <FiChevronDown size={16} className="text-warm-ash" aria-hidden="true" />
          }
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100">
          {/* Lines */}
          {ceiling.lines?.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-100">
              {ceiling.lines.map((ln) => <LineProgress key={ln.id} line={ln} />)}
            </div>
          ) : (
            <p className="mt-4 text-xs text-warm-ash">Sin líneas de máximos configuradas.</p>
          )}

          {/* Active requests */}
          {(activeRequests.length > 0 || loadingReq) && (
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-warm-ash mb-2">Solicitudes activas</p>
              {loadingReq ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeRequests.map((req) => (
                    <RequestRow
                      key={req.id}
                      req={req}
                      canOpsApprove={canOpsApprove}
                      canLogisticsConfirm={canLogisticsConfirm}
                      onAction={handleAction}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create form — only for active ceilings + commercial roles */}
          {ceiling.status === "active" && canCommercial && (
            <CreateRequestForm ceiling={ceiling} onCreated={() => { loadedRef.current = false; loadRequests(); onRefresh(); }} />
          )}

          {/* History */}
          {historyRequests.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-warm-ash mb-2">Historial</p>
              <div className="divide-y divide-slate-100">
                {historyRequests.map((req) => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    canOpsApprove={false}
                    canLogisticsConfirm={false}
                    onAction={handleAction}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty requests */}
          {!loadingReq && requests.length === 0 && ceiling.status === "active" && !canCommercial && (
            <p className="mt-4 text-xs text-warm-ash">Sin solicitudes registradas para este techo.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DeliveryCeilingsPage() {
  const { user } = useAuth();
  const { showToast } = useUI();

  const roleSet       = useMemo(() => normalizeRoles(user), [user]);
  const canView       = useMemo(() => hasAny(roleSet, VIEW_ROLES), [roleSet]);
  const canCommercial = useMemo(() => hasAny(roleSet, COMMERCIAL_ROLES), [roleSet]);
  const canOpsApprove = useMemo(() => hasAny(roleSet, OPS_ROLES), [roleSet]);
  const canLogistics  = useMemo(() => hasAny(roleSet, LOGISTICS_ROLES), [roleSet]);

  const [statusFilter, setStatusFilter] = useState("active");
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState("");
  const [bcSearch, setBcSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [ceilings, setCeilings] = useState([]);
  const [total, setTotal] = useState(0);
  const refreshKey = useRef(0);

  const loadCeilings = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const data = await listDeliveryCeilings({
        status: statusFilter || undefined,
        purchaseType: purchaseTypeFilter || undefined,
        businessCaseId: bcSearch.trim() || undefined,
        limit: 50,
      });
      const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
      setCeilings(rows);
      setTotal(data?.total ?? rows.length);
    } catch (err) {
      showToast(resolveError(err), "error");
    } finally {
      setLoading(false);
    }
  }, [canView, statusFilter, purchaseTypeFilter, bcSearch, showToast]);

  useEffect(() => {
    loadCeilings();
  }, [loadCeilings]);

  const handleRefresh = useCallback(() => {
    refreshKey.current += 1;
    loadCeilings();
  }, [loadCeilings]);

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex justify-center">
        <div className="max-w-sm w-full text-center">
          <div className="p-4 bg-red-50 rounded-2xl border border-red-100 inline-block mb-4">
            <FiShield size={24} className="text-alert-red" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-ink-slate mb-1">Acceso restringido</h2>
          <p className="text-sm text-warm-ash">Tu rol no tiene permiso para consultar máximos y saldos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0">
      {/* Page header */}
      <div className="bg-naval-slate border-b border-storm-slate">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight">Máximos y Saldos</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Control de entregas por techo de negociación</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-storm-slate transition-colors cursor-pointer disabled:opacity-40"
            title="Actualizar"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <FiFilter size={13} className="text-warm-ash flex-shrink-0" aria-hidden="true" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-slate-200 text-xs text-ink-slate bg-white cursor-pointer
                         focus:outline-none focus:border-action-blue focus:ring-2 focus:ring-sky-signal/20"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="approved">Aprobado</option>
              <option value="draft">Borrador</option>
              <option value="closed">Cerrado</option>
            </select>
            <select
              value={purchaseTypeFilter}
              onChange={(e) => setPurchaseTypeFilter(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-slate-200 text-xs text-ink-slate bg-white cursor-pointer
                         focus:outline-none focus:border-action-blue focus:ring-2 focus:ring-sky-signal/20"
            >
              <option value="">Público y privado</option>
              <option value="public">Pública</option>
              <option value="private">Privada</option>
            </select>
            <input
              type="text"
              value={bcSearch}
              onChange={(e) => setBcSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadCeilings()}
              placeholder="Business Case ID"
              className="h-8 px-2.5 rounded-xl border border-slate-200 text-xs text-ink-slate w-44
                         focus:outline-none focus:border-action-blue focus:ring-2 focus:ring-sky-signal/20"
            />
            {total > 0 && (
              <span className="ml-auto text-[11px] text-warm-ash">{total} techo{total !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-slate-50 flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-3">
          {loading && ceilings.length === 0 && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-white border border-slate-200 rounded-2xl animate-pulse shadow-ambient" />
              ))}
            </div>
          )}

          {!loading && ceilings.length === 0 && (
            <div className="text-center py-16">
              <FiAlertTriangle size={28} className="text-slate-300 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-ink-slate">Sin techos de máximos</p>
              <p className="text-xs text-warm-ash mt-1">
                Ajusta los filtros o verifica que el Business Case tenga un techo activo.
              </p>
            </div>
          )}

          {ceilings.map((ceiling) => (
            <CeilingCard
              key={ceiling.id}
              ceiling={ceiling}
              canCommercial={canCommercial}
              canOpsApprove={canOpsApprove}
              canLogisticsConfirm={canLogistics}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
