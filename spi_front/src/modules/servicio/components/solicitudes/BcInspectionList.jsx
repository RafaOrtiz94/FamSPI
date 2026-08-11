import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiFileText,
  FiRefreshCw,
  FiUser,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import { listBusinessCases, reviewBcInspectionRequest } from "../../../../core/api/businessCaseApi";
import { getServicioCronogramaFeed } from "../../../../core/api/servicioApi";
import { getUsers } from "../../../../core/api/usersApi";
import { useUI } from "../../../../core/ui/UIContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatLong = (value) => {
  if (!value) return "N/D";
  const d = new Date(value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-EC", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatShort = (value) => {
  if (!value) return "N/D";
  const d = new Date(value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
};

const isoWeekRange = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (dt) => dt.toISOString().slice(0, 10);
  return { from: fmt(mon), to: fmt(sun) };
};

// ─── Status config ────────────────────────────────────────────────────────────

const INSP_STATUS = {
  pending: {
    label: "Pendiente",
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-800",
    Icon: FiClock,
  },
  approved: {
    label: "Aprobada",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-800",
    Icon: FiCheckCircle,
  },
  rejected: {
    label: "Rechazada",
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-800",
    Icon: FiXCircle,
  },
};

const BC_STATUS_BADGE = {
  DRAFT_INICIAL:            { label: "Borrador",               cls: "bg-slate-100 text-slate-600"    },
  DATOS_BASE_COMPLETOS:     { label: "Datos completos",         cls: "bg-blue-100 text-blue-700"      },
  EN_EVALUACION_VIABILIDAD: { label: "En evaluación",           cls: "bg-amber-100 text-amber-700"    },
  VIABLE:                   { label: "Viable",                  cls: "bg-emerald-100 text-emerald-700" },
  OBSERVADO:                { label: "Observado",               cls: "bg-orange-100 text-orange-700"  },
  AJUSTES_OPERATIVOS:       { label: "Ajustes operativos",      cls: "bg-indigo-100 text-indigo-700"  },
  CERRADO_PARA_APROBACION:  { label: "Cerrado para aprobación", cls: "bg-purple-100 text-purple-700"  },
};

// ─── Schedule mini-viewer ─────────────────────────────────────────────────────

const ScheduleViewer = ({ userId, date }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const prevKey = useRef(null);

  useEffect(() => {
    const key = `${userId}:${date}`;
    if (!userId || !date || prevKey.current === key) return;
    prevKey.current = key;
    const { from, to } = isoWeekRange(date);
    setLoading(true);
    getServicioCronogramaFeed({ from, to, scope: "team" })
      .then((data) => {
        const days = Array.isArray(data?.days) ? data.days : [];
        const evs = days.flatMap((d) => (d.events || []).filter((ev) => ev.user_id === userId));
        setEvents(evs);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [userId, date]);

  if (!userId || !date) return null;

  const { from, to } = isoWeekRange(date);

  return (
    <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3.5">
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Semana {formatShort(from)} — {formatShort(to)}
      </p>
      {loading ? (
        <p className="text-xs text-slate-400">Cargando cronograma...</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-slate-500">Sin actividades esa semana. Fecha disponible.</p>
      ) : (
        <ul className="space-y-1.5">
          {events.map((ev, i) => (
            <li key={ev.id || i} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 font-mono text-[11px] text-slate-400">
                {ev.activity_date}
              </span>
              <span className="flex-1 truncate text-slate-700">{ev.title}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  ev.status === "completado"
                    ? "bg-emerald-100 text-emerald-700"
                    : ev.status === "cancelado"
                    ? "bg-red-100 text-red-600"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {ev.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── Detail panel ─────────────────────────────────────────────────────────────

const BcInspectionDetail = ({ bc, onReviewed }) => {
  const { showToast } = useUI();
  const insp = bc.modern_bc_metadata?.environment_inspection_request || {};
  const inspStatus = insp.status || "pending";
  const isPending = inspStatus === "pending" || !insp.status;
  const statusMeta = INSP_STATUS[inspStatus] || INSP_STATUS.pending;
  const bcBadge =
    BC_STATUS_BADGE[bc.status] || { label: bc.status || "Desconocido", cls: "bg-slate-100 text-slate-600" };
  const StatusIcon = statusMeta.Icon;

  const [action, setAction] = useState(null); // null | 'approve' | 'reject'
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form fields when selected BC changes
  useEffect(() => {
    setAction(null);
    setAssignedUserId("");
    setInspectionDate("");
    setNotes("");
    setReason("");
  }, [bc.business_case_id]);

  // Load users once on first approve form open
  useEffect(() => {
    if (action !== "approve" || users.length) return;
    setLoadingUsers(true);
    getUsers({ role: "ing_servicio" })
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        const filtered = rows.filter((u) => {
          const r = String(u.role || u.role_name || u.scope || "").toLowerCase();
          return r.includes("ing_servicio") || r.includes("tecnico") || r.includes("servicio");
        });
        setUsers(filtered.length ? filtered : rows);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [action, users.length]);

  const selectedUser = users.find((u) => String(u.id) === String(assignedUserId));

  const handleApprove = async (e) => {
    e.preventDefault();
    if (!assignedUserId || !inspectionDate) return;
    setSaving(true);
    try {
      await reviewBcInspectionRequest(bc.business_case_id, {
        action: "approve",
        assigned_user_id: Number(assignedUserId),
        inspection_date: inspectionDate,
        notes: notes.trim() || undefined,
      });
      showToast("Inspección aprobada y asignada al cronograma", "success");
      onReviewed();
    } catch (err) {
      showToast(err?.response?.data?.message || "Error al aprobar", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await reviewBcInspectionRequest(bc.business_case_id, {
        action: "reject",
        reason: reason.trim(),
      });
      showToast("Solicitud de inspección rechazada", "success");
      onReviewed();
    } catch (err) {
      showToast(err?.response?.data?.message || "Error al rechazar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              className="text-lg font-semibold text-[#1F2937]"
              style={{ letterSpacing: "-0.01em" }}
            >
              {bc.client_name || "Cliente sin registrar"}
            </h2>
            <p className="mt-0.5 font-mono text-[12px] text-slate-400">
              BC #{String(bc.business_case_id).slice(0, 8)}&nbsp;&middot;&nbsp;Solicitud #{insp.request_id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${bcBadge.cls}`}>
              {bcBadge.label}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.badge}`}
            >
              <StatusIcon size={11} />
              {statusMeta.label}
            </span>
          </div>
        </div>

        {/* Inspection window */}
        {(insp.inspection_min_date || insp.inspection_max_date) && (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-[12px] border border-slate-100 bg-slate-50 p-3.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Fecha mínima
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">
                {formatShort(insp.inspection_min_date)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Fecha máxima
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">
                {formatShort(insp.inspection_max_date)}
              </p>
            </div>
          </div>
        )}

        <a
          href={`/dashboard/comercial/business-case/workspace/${bc.business_case_id}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded-[12px] border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <FiExternalLink size={12} />
          Ver Business Case
        </a>
      </div>

      {/* Approved state */}
      {inspStatus === "approved" && (
        <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
            Inspección asignada
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-emerald-700/70">Técnico asignado</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                <FiUser size={13} />
                {insp.assigned_user_name || "N/D"}
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-700/70">Fecha de inspección</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                <FiCalendar size={13} />
                {formatLong(insp.inspection_date)}
              </p>
            </div>
          </div>
          {insp.notes && (
            <p className="mt-3 border-t border-emerald-200 pt-3 text-xs text-emerald-800">
              {insp.notes}
            </p>
          )}
        </div>
      )}

      {/* Rejected state */}
      {inspStatus === "rejected" && (
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-red-600">
            Solicitud rechazada
          </p>
          <p className="text-sm text-red-800">
            {insp.rejection_reason || "Sin motivo registrado."}
          </p>
        </div>
      )}

      {/* Pending: action controls */}
      {isPending && (
        <>
          {action === null && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAction("approve")}
                className="inline-flex items-center gap-1.5 rounded-[14px] bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-[0.97]"
              >
                <FiCheck size={14} />
                Aprobar y asignar
              </button>
              <button
                type="button"
                onClick={() => setAction("reject")}
                className="inline-flex items-center gap-1.5 rounded-[14px] border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition-all hover:bg-red-50 active:scale-[0.97]"
              >
                <FiX size={14} />
                Rechazar
              </button>
            </div>
          )}

          {/* Approve form */}
          {action === "approve" && (
            <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Asignar inspección</h3>
              <form onSubmit={handleApprove} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Técnico / Ing. de servicio <span className="text-red-500">*</span>
                  </label>
                  {loadingUsers ? (
                    <div className="h-10 animate-pulse rounded-[12px] bg-slate-100" />
                  ) : (
                    <select
                      required
                      value={assignedUserId}
                      onChange={(e) => setAssignedUserId(e.target.value)}
                      className="w-full rounded-[12px] border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Seleccionar...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullname || u.name || u.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Fecha exacta de inspección <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    className="w-full rounded-[12px] border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {selectedUser && inspectionDate && (
                  <ScheduleViewer userId={selectedUser.id} date={inspectionDate} />
                )}

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Instrucciones, contacto, acceso al site..."
                    className="w-full resize-none rounded-[12px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="submit"
                    disabled={saving || !assignedUserId || !inspectionDate}
                    className="inline-flex items-center gap-1.5 rounded-[12px] bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:opacity-60 active:scale-[0.97]"
                  >
                    <FiCheck size={14} />
                    {saving ? "Confirmando..." : "Confirmar asignación"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setAction(null)}
                    className="rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Reject form */}
          {action === "reject" && (
            <div className="rounded-[16px] border border-red-100 bg-red-50 p-5">
              <h3 className="mb-4 text-sm font-semibold text-red-900">Rechazar solicitud</h3>
              <form onSubmit={handleReject} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-red-600/70">
                    Motivo del rechazo <span>*</span>
                  </label>
                  <textarea
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Indica el motivo por el cual se rechaza..."
                    className="w-full resize-none rounded-[12px] border border-red-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving || !reason.trim()}
                    className="inline-flex items-center gap-1.5 rounded-[12px] bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-60 active:scale-[0.97]"
                  >
                    <FiX size={14} />
                    {saving ? "Rechazando..." : "Confirmar rechazo"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setAction(null)}
                    className="rounded-[12px] border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Empty states ─────────────────────────────────────────────────────────────

const NoSelection = () => (
  <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-[16px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
    <div className="rounded-full border border-slate-200 bg-slate-50 p-3.5">
      <FiFileText size={22} className="text-slate-300" />
    </div>
    <p className="mt-4 text-sm font-medium text-slate-600">Selecciona una solicitud</p>
    <p className="mt-1 max-w-[200px] text-xs text-slate-400">
      Elige un Business Case de la lista para ver el detalle y gestionar la inspección.
    </p>
  </div>
);

const EmptyList = () => (
  <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
    <div className="rounded-full border border-slate-200 bg-slate-50 p-3">
      <FiCalendar size={18} className="text-slate-300" />
    </div>
    <p className="mt-3 text-[13px] font-medium text-slate-700">Sin solicitudes</p>
    <p className="mt-1 max-w-[160px] text-[11px] text-slate-400">
      Las solicitudes de inspección aparecerán aquí.
    </p>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const BcInspectionList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBusinessCases({ pageSize: 200 });
      const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const withInspection = rows
        .filter((r) => r?.modern_bc_metadata?.environment_inspection_request?.request_id)
        .sort((a, b) => {
          const sa = a.modern_bc_metadata.environment_inspection_request.status || "pending";
          const sb = b.modern_bc_metadata.environment_inspection_request.status || "pending";
          if (sa === sb) return 0;
          if (sa === "pending") return -1;
          if (sb === "pending") return 1;
          return 0;
        });
      setItems(withInspection);
      setSelectedId((prev) => prev ?? (withInspection.length ? String(withInspection[0].business_case_id) : null));
    } catch {
      setError("No se pudieron cargar los Business Cases.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = items.find((i) => String(i.business_case_id) === selectedId);

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-8">
      {/* ── Sidebar ── */}
      <aside className="min-w-0">
        <div className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          {/* Sidebar header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Expedientes</p>
              {!loading && (
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {items.length} solicitud{items.length !== 1 ? "es" : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              title="Actualizar"
              className="rounded-[10px] p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60"
            >
              <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs text-red-700">
              <FiAlertCircle size={13} className="shrink-0" />
              {error}
            </div>
          )}

          {/* List */}
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
            {loading && !items.length ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-[12px] bg-slate-100" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyList />
            ) : (
              <ul className="space-y-1">
                {items.map((bc) => {
                  const insp = bc.modern_bc_metadata.environment_inspection_request;
                  const status = insp.status || "pending";
                  const meta = INSP_STATUS[status] || INSP_STATUS.pending;
                  const isSelected = String(bc.business_case_id) === selectedId;

                  return (
                    <li key={bc.business_case_id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(String(bc.business_case_id))}
                        className={`w-full rounded-[12px] border p-3.5 text-left transition-all duration-150 active:scale-[0.98] ${
                          isSelected
                            ? "border-blue-200 bg-blue-50"
                            : "border-transparent hover:border-slate-200 hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`truncate text-sm font-semibold ${
                              isSelected ? "text-blue-900" : "text-slate-900"
                            }`}
                          >
                            {bc.client_name || "Cliente sin registrar"}
                          </span>
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                        </div>
                        <p
                          className={`mt-0.5 font-mono text-[11px] ${
                            isSelected ? "text-blue-500/70" : "text-slate-400"
                          }`}
                        >
                          #{String(bc.business_case_id).slice(0, 8)}
                        </p>
                        {(insp.inspection_min_date || insp.inspection_max_date) && (
                          <p
                            className={`mt-2 text-[11px] ${
                              isSelected ? "text-blue-700/70" : "text-slate-500"
                            }`}
                          >
                            {formatShort(insp.inspection_min_date)} &rarr;{" "}
                            {formatShort(insp.inspection_max_date)}
                          </p>
                        )}
                        <div className="mt-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </aside>

      {/* ── Detail ── */}
      <section className="min-w-0">
        {selected ? (
          <BcInspectionDetail bc={selected} onReviewed={load} />
        ) : (
          <NoSelection />
        )}
      </section>
    </section>
  );
};

export default BcInspectionList;
