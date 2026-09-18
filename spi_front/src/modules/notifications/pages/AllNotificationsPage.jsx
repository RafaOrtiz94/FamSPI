import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBell,
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
  FiShoppingCart,
  FiPackage,
  FiCalendar,
  FiFileText,
  FiZap,
  FiX,
  FiCheck,
  FiTrash2,
  FiRefreshCw,
} from "react-icons/fi";
import { useNotifications } from "../../../core/ui/NotificationContext";
import { listAllNotificationsWithHistory } from "../../../core/api/notificationsApi";

// ── Helpers ───────────────────────────────────────────────────────────────────

const typeIcon = {
  alert: <FiAlertTriangle className="text-amber-500" size={18} />,
  task: <FiCheckCircle className="text-emerald-500" size={18} />,
  info: <FiInfo className="text-sky-500" size={18} />,
  error: <FiAlertTriangle className="text-rose-500" size={18} />,
};

const normalizeSource = (s) => String(s || "").trim().toLowerCase();

const getMetaValue = (notification, keys = []) => {
  const meta = notification?.meta || {};
  const data = meta?.data || {};
  for (const key of keys) {
    if (meta[key] != null && meta[key] !== "") return meta[key];
    if (data[key] != null && data[key] !== "") return data[key];
  }
  return null;
};

const resolveIcon = (notification) => {
  const source = normalizeSource(notification?.source);
  const tipoSolicitud = String(getMetaValue(notification, ["tipo_solicitud"]) || "").toLowerCase();
  if (source.startsWith("private_purchase")) return <FiShoppingCart className="text-cyan-600" size={18} />;
  if (source.startsWith("equipment_purchase")) return <FiPackage className="text-indigo-600" size={18} />;
  if (source.startsWith("permisos_vacaciones") || source.startsWith("vacaciones")) {
    return tipoSolicitud === "vacaciones" || source.startsWith("vacaciones")
      ? <FiCalendar className="text-emerald-600" size={18} />
      : <FiFileText className="text-amber-600" size={18} />;
  }
  return typeIcon[notification?.type] || <FiInfo className="text-slate-400" size={18} />;
};

const fmt = (dateString) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("es-EC", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const TYPE_LABELS = { alert: "Alerta", task: "Tarea", info: "Info", error: "Error" };
const ALL_TYPES = ["alert", "task", "info", "error"];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AllNotificationsPage() {
  const {
    markAsRead,
    markAll,
    removeNotification,
    clearAll,
    pushState,
    enableDevicePush,
    disableDevicePush,
  } = useNotifications();
  const navigate = useNavigate();

  const [allNotifs, setAllNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAllNotificationsWithHistory();
      setAllNotifs(list);
    } catch {
      // silencioso — el contexto sigue funcionando
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    return [...allNotifs]
      .sort((a, b) => {
        // Limpiadas al final
        if (!!a.cleared_at !== !!b.cleared_at) return a.cleared_at ? 1 : -1;
        const pDiff = (b.priority || 0) - (a.priority || 0);
        if (pDiff !== 0) return pDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .filter((n) => {
        if (statusFilter === "unread" && (n.status === "read" || n.cleared_at)) return false;
        if (statusFilter === "read" && (n.status !== "read" || n.cleared_at)) return false;
        if (statusFilter === "cleared" && !n.cleared_at) return false;
        if (statusFilter === "active" && n.cleared_at) return false;
        if (typeFilter !== "all" && n.type !== typeFilter) return false;
        return true;
      });
  }, [allNotifs, statusFilter, typeFilter]);

  const activeCount = useMemo(() => allNotifs.filter((n) => !n.cleared_at).length, [allNotifs]);
  const unreadCount = useMemo(() => allNotifs.filter((n) => !n.cleared_at && n.status !== "read").length, [allNotifs]);
  const clearedCount = useMemo(() => allNotifs.filter((n) => n.cleared_at).length, [allNotifs]);

  const resolveTargetPath = (notification) => {
    const metaPath = getMetaValue(notification, ["target_path", "targetPath", "url", "path", "redirect_to"]);
    if (metaPath) return metaPath;
    const source = normalizeSource(notification?.source);
    // La alerta de SLA vencido solo informa el incumplimiento; no debe
    // ofrecer acceso directo al BC. El responsable entra mediante la
    // solicitud de prorroga cuando corresponda.
    if (source === "business_case.preflow.expiry") return null;
    const purchaseId = getMetaValue(notification, ["purchase_id", "purchaseId"]);
    const requestId = getMetaValue(notification, ["request_id", "requestId"]);
    const solicitudId = getMetaValue(notification, ["solicitud_id", "solicitudId"]);
    const bcId = getMetaValue(notification, ["business_case_id", "businessCaseId", "bc_id"]);
    if (source.startsWith("private_purchase") && purchaseId) return `/dashboard/purchases/workspace?tab=private&requestId=${purchaseId}&requestType=private`;
    if (source.startsWith("equipment_purchase") && requestId) return `/dashboard/purchases/workspace?tab=public&requestId=${requestId}&requestType=public`;
    if ((source.startsWith("permisos_vacaciones") || source.startsWith("vacaciones")) && solicitudId) return `/dashboard/talento-humano/permisos?solicitudId=${solicitudId}`;
    if (source.startsWith("business_case") && bcId) return `/dashboard/business-case/workspace/${bcId}`;
    return null;
  };

  const handleItemClick = async (notification) => {
    if (notification.cleared_at) return;
    await markAsRead(notification.id);
    const path = resolveTargetPath(notification);
    if (path) navigate(path);
    fetchAll();
  };

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation();
    await markAsRead(id);
    fetchAll();
  };

  const handleRemove = async (e, id) => {
    e.stopPropagation();
    await removeNotification(id);
    fetchAll();
  };

  const handleMarkAll = async () => {
    await markAll();
    fetchAll();
  };

  const handleClearAll = async () => {
    await clearAll();
    fetchAll();
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FiBell size={20} className="text-[#6B7280]" />
            <h1 className="text-lg font-semibold text-[#1F2937]">Notificaciones</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                {unreadCount} sin leer
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B7280]">
            {activeCount} activas · {clearedCount} en historial
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchAll}
            className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#374151] transition hover:bg-[#F3F4F6] active:scale-[0.97]"
          >
            <FiRefreshCw size={12} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
            className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#374151] transition hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.97]"
          >
            <FiCheck size={13} />
            Marcar todas como leidas
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={activeCount === 0}
            className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#FCA5A5] px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.97]"
          >
            <FiTrash2 size={13} />
            Limpiar activas
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_45%,#ecfeff_100%)] p-4 shadow-[0_8px_24px_rgba(14,116,144,0.08)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Notificaciones en el dispositivo</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {pushState.supported
                ? pushState.subscribed
                  ? "Esta PWA ya puede mostrar alertas del sistema en este dispositivo."
                  : "Activa las notificaciones para recibir alertas aunque la PWA no este abierta."
                : pushState.isIos && !pushState.isStandalone
                ? "En iPhone debes abrir la PWA desde la pantalla de inicio para habilitar push."
                : "Este navegador no soporta notificaciones push para esta PWA."}
            </p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Permiso: {pushState.permission || "desconocido"} · Suscripciones activas: {pushState.activeSubscriptions || 0}
            </p>
            {pushState.error && (
              <p className="mt-2 text-xs font-medium text-rose-600">{pushState.error}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {pushState.subscribed ? (
              <button
                type="button"
                onClick={disableDevicePush}
                disabled={pushState.loading}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Desactivar push
              </button>
            ) : (
              <button
                type="button"
                onClick={enableDevicePush}
                disabled={pushState.loading || !pushState.supported}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pushState.loading ? "Activando..." : "Activar en este iPhone"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { value: "all", label: "Todas" },
          { value: "active", label: "Activas" },
          { value: "unread", label: "Sin leer" },
          { value: "read", label: "Leidas" },
          { value: "cleared", label: `Historial${clearedCount > 0 ? ` (${clearedCount})` : ""}` },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatusFilter(opt.value)}
            className={`min-h-[32px] cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition active:scale-[0.97] ${
              statusFilter === opt.value
                ? "bg-[#1F2937] text-white"
                : "border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"
            }`}
          >
            {opt.label}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-[#E5E7EB]" />

        <button
          type="button"
          onClick={() => setTypeFilter("all")}
          className={`min-h-[32px] cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition active:scale-[0.97] ${
            typeFilter === "all"
              ? "bg-[#1F2937] text-white"
              : "border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"
          }`}
        >
          Todos los tipos
        </button>
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`min-h-[32px] cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition active:scale-[0.97] ${
              typeFilter === t
                ? "bg-[#1F2937] text-white"
                : "border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-[#6B7280]">
          Cargando notificaciones...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <FiBell size={40} className="text-[#D1D5DB]" />
          <p className="text-sm font-medium text-[#1F2937]">No hay notificaciones</p>
          <p className="text-xs text-[#6B7280]">
            {statusFilter !== "all" || typeFilter !== "all"
              ? "Prueba cambiando los filtros."
              : "Cuando recibas una notificacion aparecera aqui."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[#F3F4F6] rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          {filtered.map((notif) => {
            const isCleared = !!notif.cleared_at;
            const isUnread = !isCleared && notif.status !== "read";
            const hasTarget = !isCleared && !!resolveTargetPath(notif);

            return (
              <div
                key={notif.id}
                role={hasTarget ? "button" : undefined}
                tabIndex={hasTarget ? 0 : undefined}
                onClick={hasTarget ? () => handleItemClick(notif) : undefined}
                onKeyDown={
                  hasTarget
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleItemClick(notif);
                        }
                      }
                    : undefined
                }
                className={`flex min-h-[64px] items-start gap-3 px-4 py-3.5 transition
                  ${isCleared ? "opacity-50" : ""}
                  ${isUnread && !isCleared ? "bg-amber-50/60" : ""}
                  ${hasTarget ? "cursor-pointer hover:bg-[#F3F4F6] active:scale-[0.99]" : ""}
                `}
              >
                {/* Icon */}
                <div className={`mt-0.5 shrink-0 ${isCleared ? "grayscale" : ""}`}>
                  {resolveIcon(notif)}
                </div>

                {/* Body */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className={`text-sm font-semibold leading-snug ${isCleared ? "text-[#9CA3AF] line-through" : isUnread ? "text-[#1F2937]" : "text-[#374151]"}`}>
                      {notif.title}
                    </p>
                    {notif.priority >= 2 && !isCleared && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                        <FiZap size={9} />
                        Alta
                      </span>
                    )}
                    {isCleared && (
                      <span className="rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-medium text-[#9CA3AF]">
                        Limpiada
                      </span>
                    )}
                    {notif.type && !isCleared && (
                      <span className="rounded-full border border-[#E5E7EB] px-1.5 py-0.5 text-[10px] font-medium text-[#6B7280]">
                        {TYPE_LABELS[notif.type] || notif.type}
                      </span>
                    )}
                  </div>
                  {notif.message && (
                    <p className={`mt-0.5 text-xs line-clamp-2 ${isCleared ? "text-[#D1D5DB]" : "text-[#6B7280]"}`}>
                      {notif.message}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="font-mono text-[11px] text-[#9CA3AF]">{fmt(notif.created_at)}</p>
                    {isCleared && notif.cleared_at && (
                      <p className="font-mono text-[11px] text-[#D1D5DB]">
                        Limpiada: {fmt(notif.cleared_at)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!isCleared && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isUnread && <span className="h-2 w-2 rounded-full bg-[#2563EB]" title="Sin leer" />}
                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(e, notif.id)}
                        title="Marcar como leida"
                        className="min-h-[32px] min-w-[32px] cursor-pointer rounded-lg p-1.5 text-[#9CA3AF] transition hover:bg-[#F3F4F6] hover:text-[#2563EB]"
                      >
                        <FiCheck size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleRemove(e, notif.id)}
                      title="Limpiar"
                      aria-label="Limpiar notificacion"
                      className="min-h-[32px] min-w-[32px] cursor-pointer rounded-lg p-1.5 text-[#9CA3AF] transition hover:bg-rose-50 hover:text-rose-500"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-[#9CA3AF]">
        Se muestran hasta 200 notificaciones incluyendo el historial.
      </p>
    </div>
  );
}
