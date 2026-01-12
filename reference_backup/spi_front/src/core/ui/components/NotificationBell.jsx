import React, { useMemo, useState } from "react";
import { FiBell, FiCheckCircle, FiAlertTriangle, FiInfo } from "react-icons/fi";
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

  const recent = useMemo(() => notifications.slice(0, 6), [notifications]);

  const handleItemClick = async (id) => {
    await markAsRead(id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg bg-primary-light/40 hover:bg-primary-light/60 transition focus-visible:ring-2 focus-visible:ring-accent"
        title="Notificaciones"
      >
        <FiBell className="text-accent" size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-accent text-white text-[10px] rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
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

          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No hay notificaciones</p>
            )}
            {recent.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleItemClick(notif.id)}
                className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 transition ${
                  notif.status !== "read" ? "bg-amber-50/70" : ""
                }`}
              >
                <div className="mt-1">
                  {typeIcon[notif.type] || <FiInfo className="text-slate-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                    {notif.title}
                  </p>
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
        </div>
      )}
    </div>
  );
}
