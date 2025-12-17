import React, { useMemo } from "react";
import { FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import { useNotifications } from "../NotificationContext";

export default function ImportantAlertsPanel() {
  const { notifications, markAsRead } = useNotifications();

  const highlighted = useMemo(
    () =>
      notifications
        .filter((n) => n.status !== "read" || n.priority >= 2)
        .filter((n) => n.priority >= 2 || ["alert", "task"].includes(n.type || ""))
        .slice(0, 4),
    [notifications]
  );

  if (highlighted.length === 0) return null;

  return (
    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      {highlighted.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"
        >
          <div className="mt-1 text-amber-500">
            {alert.type === "task" ? <FiCheckCircle /> : <FiAlertTriangle />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">{alert.title}</p>
            {alert.message && <p className="text-sm text-amber-800">{alert.message}</p>}
            <div className="mt-2 flex items-center gap-2 text-[12px] text-amber-700">
              <span className="px-2 py-0.5 rounded-full bg-white/80 border border-amber-200 uppercase font-semibold tracking-wide">
                {alert.type || "info"}
              </span>
              {alert.priority >= 2 && <span className="text-xs">Prioridad alta</span>}
            </div>
          </div>
          <button
            onClick={() => markAsRead(alert.id)}
            className="text-xs text-amber-800 hover:text-amber-900 underline"
          >
            Marcar leída
          </button>
        </div>
      ))}
    </div>
  );
}
