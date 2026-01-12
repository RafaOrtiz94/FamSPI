import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../api/notificationsApi";
import { useAuth } from "../auth/useAuth";
import { useUI } from "./UIContext";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { showToast } = useUI();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(
    async (status) => {
      if (!isAuthenticated) return { list: [], unread: 0 };
      setLoading(true);
      setError(null);
      try {
        const { list, unread } = await listNotifications(status);
        setNotifications(list);
        setUnreadCount(unread || list.filter((n) => n.status !== "read").length);
        return { list, unread };
      } catch (err) {
        console.error("Error cargando notificaciones", err);
        setError("No se pudieron obtener las notificaciones");
        return { list: [], unread: 0 };
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markAsRead = useCallback(
    async (id) => {
      try {
        const updated = await markNotificationAsRead(id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, ...updated, status: "read" } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        return updated;
      } catch (err) {
        console.error("No se pudo marcar la notificación", err);
        showToast?.("No se pudo marcar la notificación", "error");
        return null;
      }
    },
    [showToast]
  );

  const markAll = useCallback(async () => {
    try {
      const updated = await markAllNotificationsAsRead();
      if (Array.isArray(updated)) {
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            status: "read",
            read_at: n.read_at || new Date().toISOString(),
          }))
        );
        setUnreadCount(0);
      }
      return updated;
    } catch (err) {
      console.error("No se pudo marcar todas", err);
      showToast?.("No se pudieron marcar las notificaciones", "error");
      return null;
    }
  }, [showToast]);

  const addNotification = useCallback(
    (notification) => {
      if (!notification) return;
      setNotifications((prev) => [notification, ...prev]);
      if (notification.status !== "read") {
        setUnreadCount((prev) => prev + 1);
        showToast?.(notification.title || "Nueva notificación", "info");
      }
    },
    [showToast]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      refresh,
      markAsRead,
      markAll,
      addNotification,
    }),
    [notifications, unreadCount, loading, error, refresh, markAsRead, markAll, addNotification]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => useContext(NotificationContext);
