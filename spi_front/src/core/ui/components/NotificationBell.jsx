import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiCheckCircle, FiAlertTriangle, FiInfo, FiZap } from "react-icons/fi";
import { useNotifications } from "../NotificationContext";

const typeIcon = {
  alert: <FiAlertTriangle className="text-amber-500" />,
  task: <FiCheckCircle className="text-emerald-500" />,
  info: <FiInfo className="text-sky-500" />,
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString();
};

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAll, loading } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerClassName = "fixed bottom-4 right-4 z-[60] sm:bottom-6 sm:right-6";

  const recent = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => {
      const unreadScore = (b.status !== "read") - (a.status !== "read");
      if (unreadScore !== 0) return unreadScore;

      const priorityScore = (b.priority || 0) - (a.priority || 0);
      if (priorityScore !== 0) return priorityScore;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return sorted.slice(0, 6);
  }, [notifications]);

  const resolvePurchaseId = (notification) => {
    const meta = notification?.meta || {};
    return (
      meta.purchase_id ||
      meta.purchaseId ||
      meta.data?.purchase_id ||
      meta.data?.purchaseId ||
      null
    );
  };

  const handleItemClick = async (notification) => {
    if (!notification) return;
    await markAsRead(notification.id);
    const purchaseId = resolvePurchaseId(notification);
    if (purchaseId) {
      setOpen(false);
      navigate(`/dashboard/backoffice/private-purchases?purchaseId=${purchaseId}`);
    }
  };

  return (
    <div className={containerClassName}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg shadow-slate-900/20 transition hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-accent"
        title="Notificaciones"
      >
        <FiBell className="text-white" size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-rose-500 text-white text-[10px] rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-[3.75rem] right-0 w-[22rem] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-800">Notificaciones</p>
              <p className="text-[12px] text-slate-500">
                {loading ? "Cargando..." : `${unreadCount} sin leer`}
              </p>
            </div>
            <button
              onClick={markAll}
              className="text-[12px] text-accent hover:text-accent-dark"
            >
              Marcar todas
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {recent.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No hay notificaciones</p>
            )}
            {recent.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 transition ${notif.status !== "read" ? "bg-amber-50/70" : ""
                  }`}
              >
                <div className="mt-1">
                  {typeIcon[notif.type] || <FiInfo className="text-slate-400" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                      {notif.title}
                    </p>
                    {notif.priority >= 2 && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                        <FiZap className="text-amber-500" />
                        Alta
                      </span>
                    )}
                  </div>
                  {notif.message && (
                    <p className="text-xs text-slate-600 line-clamp-2">{notif.message}</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">{formatDate(notif.created_at)}</p>
                </div>
                {notif.status !== "read" && (
                  <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                )}
              </button>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500">
            Solo se muestran las 6 notificaciones más recientes. Las de prioridad alta aparecen arriba.
          </div>
        </div>
      )}
    </div>
  );
}
