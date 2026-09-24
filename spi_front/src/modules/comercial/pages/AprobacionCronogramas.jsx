import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiUsers,
  FiX,
} from "react-icons/fi";
import Modal from "../../../core/ui/components/Modal";
import Button from "../../../core/ui/components/Button";
import ScheduleStatusBadge from "../components/schedules/ScheduleStatusBadge";
import useScheduleApproval from "../hooks/useScheduleApproval";
import {
  WORKSPACE_2COL_CLASS,
  WORKSPACE_SIDEBAR_CLASS,
  WORKSPACE_MAIN_CLASS,
} from "../../../core/ui/workspaceLayout";
import { fetchScheduleDetail } from "../../../core/api/schedulesApi";
import { useUI } from "../../../core/ui/useUI";

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const monthLabel = (month, year) =>
  `${MONTHS[(Number(month) || 1) - 1]} ${year}`;

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).slice(0, 10).split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" });
};

const formatWeekday = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).slice(0, 10).split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("es-EC", { weekday: "long" });
};

const getWeekOfMonth = (dateStr) => {
  if (!dateStr) return null;
  const dayOfMonth = Number(String(dateStr).slice(8, 10));
  if (!dayOfMonth) return null;
  return Math.ceil(dayOfMonth / 7);
};

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");

const getVisitDisplayName = (visit) =>
  visit?.client_name
  || visit?.prospect_name
  || (visit?.client_request_id ? `Cliente #${visit.client_request_id}` : "Visita sin nombre");

const PRIORITY_LABELS = { 1: "Baja", 2: "Media", 3: "Alta" };
const PRIORITY_CLS    = {
  1: "bg-[#F3F4F6] text-[#6B7280]",
  2: "bg-[#FEF3C7] text-[#D97706]",
  3: "bg-[#FEE2E2] text-[#DC2626]",
};

const inputCls =
  "w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20 disabled:bg-[#F9FAFB]";
const labelCls = "block mb-1 text-[12px] font-medium text-[#1F2937] tracking-[0.01em]";

// ── Modal: Rechazar ────────────────────────────────────────────────────────────

const RejectModal = ({ open, onClose, onSubmit, busy, schedule }) => {
  const [notes, setNotes] = useState("");
  useEffect(() => { if (open) setNotes(""); }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!notes.trim()) return;
    await onSubmit(notes.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title="Rechazar cronograma" maxWidth="max-w-md">
      {schedule && (
        <div className="mb-4 rounded-xl bg-[#FEE2E2] px-3 py-2.5">
          <p className="text-xs font-semibold text-[#DC2626]">{schedule.user_name || schedule.user_email}</p>
          <p className="text-xs text-[#DC2626]">{monthLabel(schedule.month, schedule.year)}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelCls}>
            Motivo de rechazo <span className="text-[#DC2626]">*</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Explica al asesor los motivos del rechazo y que debe corregir"
            className={inputCls}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" variant="danger" disabled={busy || !notes.trim()}>
            {busy ? <FiRefreshCw size={14} className="animate-spin" /> : <FiX size={14} />}
            Rechazar cronograma
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ── UserCard (sidebar) ─────────────────────────────────────────────────────────

const UserCard = ({ group, selected, onClick }) => {
  const ini = initials(group.userName);
  const hasPending = group.pendingCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full cursor-pointer rounded-xl border px-3 py-3 text-left transition-all active:scale-[0.98] ${
        selected
          ? "border-[#2563EB]/30 bg-[#EFF6FF] shadow-sm"
          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            selected ? "bg-[#2563EB] text-white" : "bg-[#F3F4F6] text-[#1F2937]"
          }`}
        >
          {ini || "?"}
        </div>
        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#1F2937]">{group.userName}</p>
          <p className="text-[11px] text-[#6B7280]">
            {group.schedules.length} cronograma{group.schedules.length !== 1 ? "s" : ""}
            {hasPending ? ` · ${group.pendingCount} pendiente${group.pendingCount !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
        {/* Pending badge */}
        {hasPending && (
          <span className="ml-auto shrink-0 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold text-[#D97706]">
            {group.pendingCount}
          </span>
        )}
      </div>
    </button>
  );
};

// ── Visits list ────────────────────────────────────────────────────────────────

const VisitsList = ({ visits, unexpectedClients }) => {
  const VISIT_STATUS_CLS = {
    visited:  "bg-[#DCFCE7] text-[#16A34A]",
    skipped:  "bg-[#FEE2E2] text-[#DC2626]",
    in_visit: "bg-[#DBEAFE] text-[#1D4ED8]",
    pending:  "bg-[#F3F4F6] text-[#6B7280]",
  };
  const VISIT_STATUS_LABELS = {
    visited: "Visitado", skipped: "Omitido", in_visit: "En visita", pending: "Pendiente",
  };

  const sorted = [...(visits || [])].sort((a, b) =>
    String(a.planned_date).localeCompare(String(b.planned_date)),
  );

  if (!sorted.length && !unexpectedClients?.length) {
    return (
      <div className="py-6 text-center">
        <FiCalendar size={24} className="mx-auto mb-1.5 text-[#D1D5DB]" />
        <p className="text-xs text-[#6B7280]">Sin visitas en este cronograma.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((v) => (
        <div key={v.id} className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3">
          <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            Number(v.priority) === 3 ? "bg-[#DC2626]" :
            Number(v.priority) === 2 ? "bg-[#D97706]" : "bg-[#D1D5DB]"
          }`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-[#1F2937]">
                {getVisitDisplayName(v)}
              </span>
              {getWeekOfMonth(v.planned_date) && (
                <span className="inline-flex rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-medium text-[#1D4ED8]">
                  Semana {getWeekOfMonth(v.planned_date)}
                </span>
              )}
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_CLS[v.priority || 1]}`}>
                {PRIORITY_LABELS[v.priority || 1]}
              </span>
              {v.visit_status && (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${VISIT_STATUS_CLS[v.visit_status] || VISIT_STATUS_CLS.pending}`}>
                  {VISIT_STATUS_LABELS[v.visit_status] || v.visit_status}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-[#6B7280]">
              {formatWeekday(v.planned_date)}
              {v.planned_date ? ` · ${formatDate(v.planned_date)}` : ""}
              {v.city ? ` — ${v.city}` : ""}
              {v.hora_entrada && v.hora_salida ? ` — ${v.hora_entrada} a ${v.hora_salida}` : ""}
              {v.duracion_minutos ? ` (${v.duracion_minutos} min)` : ""}
            </p>
            {v.justification && (
              <p className="mt-1 rounded-lg bg-[#FEF3C7] px-2 py-1 text-[11px] text-[#D97706]">
                Justificacion: {v.justification}
              </p>
            )}
          </div>
        </div>
      ))}

      {(unexpectedClients?.length > 0) && (
        <>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[#D97706]">
            Visitas no planificadas
          </p>
          {unexpectedClients.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-xl border border-[#FEF3C7] bg-[#FFFBEB] p-3">
              <FiAlertCircle size={14} className="shrink-0 text-[#D97706]" />
              <div>
                <p className="text-sm font-medium text-[#1F2937]">{getVisitDisplayName(v)}</p>
                <p className="text-[11px] text-[#6B7280]">{String(v.visit_date || "").slice(0, 10)}</p>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

// ── ScheduleRow (expandable card in expediente) ────────────────────────────────

const ScheduleRow = ({ schedule, expanded, onToggle, onApprove, onReject, busy }) => {
  const [detail, setDetail]     = useState(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!expanded || detail) return;
    setLoading(true);
    fetchScheduleDetail(schedule.id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [expanded, schedule.id, detail]);

  const visits           = Array.isArray(detail?.visits) ? detail.visits : [];
  const unexpectedClients = Array.isArray(detail?.unexpected_client_visits) ? detail.unexpected_client_visits : [];
  const visitCount       = Number(schedule.visits_count || visits.length);
  const visitedCount     = visits.filter((v) => v.visit_status === "visited").length;
  const efficiency       = visitCount > 0 ? Math.round((visitedCount / visitCount) * 100) : null;
  const isPending        = schedule.status === "pending_approval";

  return (
    <div className={`rounded-2xl border transition-all ${
      expanded ? "border-[#2563EB]/20 shadow-sm" : "border-[#E5E7EB]"
    } bg-white overflow-hidden`}>
      {/* Row header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full cursor-pointer px-4 py-3.5 text-left hover:bg-[#F9FAFB] transition-colors"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              <FiCalendar size={15} className="text-[#6B7280]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1F2937]">
                {monthLabel(schedule.month, schedule.year)}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <ScheduleStatusBadge status={schedule.status} size="xs" />
                {schedule.submitted_at && (
                  <span className="text-[11px] text-[#6B7280]">
                    Enviado {formatDate(schedule.submitted_at)}
                  </span>
                )}
                {visitCount > 0 && (
                  <span className="text-[11px] text-[#6B7280]">
                    {visitCount} visitas{efficiency !== null ? ` · ${efficiency}% ejec.` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isPending && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onReject(); }}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-xl border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#DC2626] transition-colors hover:border-[#FCA5A5] hover:bg-[#FEE2E2] disabled:opacity-50"
                >
                  <FiX size={12} /> Rechazar
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onApprove(); }}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-xl bg-[#16A34A] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] disabled:opacity-50"
                >
                  <FiCheck size={12} /> Aprobar
                </button>
              </>
            )}
            {expanded ? (
              <FiChevronUp size={15} className="text-[#6B7280]" />
            ) : (
              <FiChevronDown size={15} className="text-[#6B7280]" />
            )}
          </div>
        </div>

        {/* Rejection banner inside header */}
        {schedule.rejection_reason && (
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-[#FEE2E2] px-3 py-2">
            <FiAlertCircle size={12} className="mt-0.5 shrink-0 text-[#DC2626]" />
            <p className="text-[11px] text-[#DC2626]">
              <span className="font-semibold">Motivo rechazo: </span>{schedule.rejection_reason}
            </p>
          </div>
        )}
        {schedule.notes && !schedule.rejection_reason && (
          <p className="mt-1.5 text-[11px] text-[#6B7280]">Notas: {schedule.notes}</p>
        )}
        {schedule.reviewed_by_email && (
          <p className="mt-0.5 text-[11px] text-[#6B7280]">
            Revisado por {schedule.reviewed_by_email}
          </p>
        )}
      </button>

      {/* Expanded: visits */}
      {expanded && (
        <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-4">
          {detail?.general_justification && (
            <div className="mb-3 rounded-xl bg-[#FEF3C7] px-3 py-2 text-[11px] text-[#D97706]">
              Justificacion del asesor: {detail.general_justification}
            </div>
          )}
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-[#F3F4F6]" />
              ))}
            </div>
          ) : (
            <VisitsList visits={visits} unexpectedClients={unexpectedClients} />
          )}
        </div>
      )}
    </div>
  );
};

// ── UserExpediente (main panel) ────────────────────────────────────────────────

const UserExpediente = ({ group, onApprove, onReject, busy }) => {
  const [expandedId, setExpandedId] = useState(null);

  const sorted = useMemo(
    () => [...group.schedules].sort((a, b) => {
      if (a.year !== b.year) return Number(b.year) - Number(a.year);
      return Number(b.month) - Number(a.month);
    }),
    [group.schedules],
  );

  useEffect(() => {
    const firstPending = sorted.find((s) => s.status === "pending_approval");
    setExpandedId(firstPending?.id || sorted[0]?.id || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.userId]);

  const ini = initials(group.userName);

  return (
    <div className="flex h-full flex-col">
      {/* Expediente header */}
      <div className="border-b border-[#E5E7EB] bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1E293B] text-sm font-bold text-white">
            {ini || "?"}
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1F2937]">{group.userName}</h2>
            <p className="text-xs text-[#6B7280]">
              {group.schedules.length} cronograma{group.schedules.length !== 1 ? "s" : ""}
              {group.pendingCount > 0
                ? ` · ${group.pendingCount} pendiente${group.pendingCount !== 1 ? "s" : ""} de aprobacion`
                : " · todo al dia"}
            </p>
          </div>
          {group.pendingCount > 0 && (
            <span className="ml-auto rounded-full bg-[#FEF3C7] px-3 py-1 text-xs font-bold text-[#D97706]">
              {group.pendingCount} pendiente{group.pendingCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Schedule list */}
      <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-4 lg:p-5">
        {sorted.length === 0 ? (
          <div className="py-10 text-center">
            <FiCalendar size={28} className="mx-auto mb-2 text-[#D1D5DB]" />
            <p className="text-sm text-[#6B7280]">Sin cronogramas registrados.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((s) => (
              <ScheduleRow
                key={s.id}
                schedule={s}
                expanded={expandedId === s.id}
                onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                onApprove={() => onApprove(s)}
                onReject={() => onReject(s)}
                busy={busy}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────────

const AprobacionCronogramas = () => {
  const { teamSchedules, analytics, loading, error, approve, reject, loadPending, loadTeamSchedules } =
    useScheduleApproval();
  const { showToast } = useUI();

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [actionSchedule, setActionSchedule] = useState(null);
  const [modalReject,    setModalReject]    = useState(false);
  const [busy,           setBusy]           = useState("");

  useEffect(() => {
    loadPending();
    loadTeamSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group teamSchedules by user
  const userGroups = useMemo(() => {
    const map = {};
    teamSchedules.forEach((s) => {
      const key = s.user_id || s.user_email;
      if (!map[key]) {
        map[key] = {
          userId: s.user_id || s.user_email,
          userEmail: s.user_email,
          userName: s.user_name || s.user_email || "Usuario",
          schedules: [],
          pendingCount: 0,
        };
      }
      map[key].schedules.push(s);
      if (s.status === "pending_approval") map[key].pendingCount++;
    });
    return Object.values(map).sort(
      (a, b) => b.pendingCount - a.pendingCount || a.userName.localeCompare(b.userName),
    );
  }, [teamSchedules]);

  const selectedGroup = useMemo(
    () => userGroups.find((g) => g.userId === selectedUserId) || null,
    [userGroups, selectedUserId],
  );

  // Auto-select first user with pending when data loads
  useEffect(() => {
    if (!selectedUserId && userGroups.length > 0) {
      setSelectedUserId(userGroups[0].userId);
    }
  }, [userGroups, selectedUserId]);

  const totalPending = useMemo(
    () => userGroups.reduce((acc, g) => acc + g.pendingCount, 0),
    [userGroups],
  );

  const handleApprove = useCallback(async (schedule) => {
    if (!schedule) return;
    setBusy("approve");
    try {
      await approve(schedule.id);
      showToast("Cronograma aprobado", "success");
      await loadTeamSchedules();
    } catch (err) {
      showToast(err.message || "No se pudo aprobar", "error");
    } finally {
      setBusy("");
    }
  }, [approve, loadTeamSchedules, showToast]);

  const handleReject = useCallback(async (notes) => {
    if (!actionSchedule) return;
    setBusy("reject");
    try {
      await reject(actionSchedule.id, notes);
      setModalReject(false);
      setActionSchedule(null);
      showToast("Cronograma rechazado", "success");
      await loadTeamSchedules();
    } catch (err) {
      showToast(err.message || "No se pudo rechazar", "error");
    } finally {
      setBusy("");
    }
  }, [actionSchedule, reject, loadTeamSchedules, showToast]);

  const openReject = useCallback((schedule) => {
    setActionSchedule(schedule);
    setModalReject(true);
  }, []);

  return (
    <>
      <div className={WORKSPACE_2COL_CLASS}>
        {/* ── Sidebar: usuarios ── */}
        <aside className={`${WORKSPACE_SIDEBAR_CLASS} col-span-12 lg:col-span-4`}>
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-sm font-semibold text-[#1E293B]">Asesores comerciales</h1>
                <p className="text-[11px] text-[#6B7280]">
                  {userGroups.length} asesor{userGroups.length !== 1 ? "es" : ""}
                  {totalPending > 0 ? ` · ${totalPending} cronograma${totalPending !== 1 ? "s" : ""} pendiente${totalPending !== 1 ? "s" : ""}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { loadPending(); loadTeamSchedules(); }}
                disabled={loading}
                className="rounded-xl border border-[#E5E7EB] bg-white p-1.5 text-[#6B7280] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {/* KPI strip */}
            {analytics?.byStatus && (
              <div className="mt-2 grid grid-cols-3 divide-x divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] overflow-hidden">
                {[
                  { label: "Pendientes", val: analytics.byStatus.pending_approval || 0, cls: "text-[#D97706]" },
                  { label: "Aprobados",  val: analytics.byStatus.approved  || 0, cls: "text-[#16A34A]" },
                  { label: "Rechazados", val: analytics.byStatus.rejected  || 0, cls: "text-[#DC2626]" },
                ].map((s) => (
                  <div key={s.label} className="bg-white px-2 py-2 text-center">
                    <p className={`text-base font-bold ${s.cls}`}>{s.val}</p>
                    <p className="text-[9px] text-[#6B7280]">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User list */}
          <div className="p-3">
            {loading && !userGroups.length && (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F3F4F6]" />
                ))}
              </div>
            )}
            {!loading && !userGroups.length && (
              <div className="py-8 text-center">
                <FiUsers size={28} className="mx-auto mb-2 text-[#D1D5DB]" />
                <p className="text-xs text-[#6B7280]">Sin cronogramas registrados en el equipo.</p>
              </div>
            )}
            {error && <p className="mt-2 text-xs text-[#DC2626]">{error}</p>}
            <div className="flex flex-col gap-2">
              {userGroups.map((group) => (
                <UserCard
                  key={group.userId}
                  group={group}
                  selected={selectedUserId === group.userId}
                  onClick={() => setSelectedUserId(group.userId)}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main panel: expediente del asesor ── */}
        <main className={`${WORKSPACE_MAIN_CLASS} col-span-12 lg:col-span-8`}>
          {!selectedGroup ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
              <FiUsers size={36} className="text-[#D1D5DB]" />
              <div>
                <p className="text-sm font-medium text-[#1F2937]">Selecciona un asesor</p>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  Elige un asesor del panel izquierdo para ver su expediente de cronogramas.
                </p>
              </div>
            </div>
          ) : (
            <UserExpediente
              key={selectedGroup.userId}
              group={selectedGroup}
              onApprove={handleApprove}
              onReject={openReject}
              busy={Boolean(busy)}
            />
          )}
        </main>
      </div>

      <RejectModal
        open={modalReject}
        onClose={() => { if (!busy) { setModalReject(false); setActionSchedule(null); } }}
        onSubmit={handleReject}
        busy={busy === "reject"}
        schedule={actionSchedule}
      />
    </>
  );
};

export default AprobacionCronogramas;
