import React, {
 createContext,
 useCallback,
 useContext,
 useEffect,
 useMemo,
 useRef,
 useState,
} from "react";
import {
 listNotifications,
 markNotificationAsRead,
 markAllNotificationsAsRead,
 deleteNotification,
 clearNotifications,
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
 const lastSeenIdsRef = useRef(new Set());
 const hasLoadedRef = useRef(false);
 const refreshTimerRef = useRef(null);
 const lastSoundAtRef = useRef(0);

 const playNotificationSound = useCallback(() => {
 try {
 const now = Date.now();
 if (now - lastSoundAtRef.current < 2500) return; // evita spam
 lastSoundAtRef.current = now;

 const audioContext = new (window.AudioContext || window.webkitAudioContext)();
 const oscillator = audioContext.createOscillator();
 const gainNode = audioContext.createGain();

 oscillator.type = "sine";
 oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
 gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
 gainNode.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
 gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.5);

 oscillator.connect(gainNode);
 gainNode.connect(audioContext.destination);

 oscillator.start();
 oscillator.stop(audioContext.currentTime + 0.6);
 oscillator.onended = () => {
 audioContext.close();
 };
 } catch (err) {
 console.warn("No se pudo reproducir sonido de notificación", err);
 }
 }, []);

 const refresh = useCallback(
 async (status) => {
 if (!isAuthenticated) return { list: [], unread: 0 };
 setLoading(true);
 setError(null);
 try {
 const { list, unread } = await listNotifications(status);
 const normalizedList = Array.isArray(list) ? list : [];
 setNotifications(normalizedList);
 setUnreadCount(unread || normalizedList.filter((n) => n.status !== "read").length);

 const newHighPriority = normalizedList.filter(
 (n) =>
 n.status !== "read" &&
 n.priority >= 2 &&
 !lastSeenIdsRef.current.has(n.id)
 );

 if (hasLoadedRef.current && newHighPriority.length > 0) {
 playNotificationSound();
 showToast?.("Nueva notificación importante", "warning");
 }

 lastSeenIdsRef.current = new Set(normalizedList.map((n) => n.id));
 hasLoadedRef.current = true;
 return { list: normalizedList, unread };
 } catch (err) {
 console.error("Error cargando notificaciones", err);
 setError("No se pudieron obtener las notificaciones");
 return { list: [], unread: 0 };
 } finally {
 setLoading(false);
 }
 },
 [isAuthenticated, playNotificationSound, showToast]
 );

 // Carga inicial: se ejecuta solo cuando cambia el estado de autenticación.
 useEffect(() => {
 if (isAuthenticated) {
 refresh();
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [isAuthenticated]);

 // Polling periódico: intervalo largo (5 min) para minimizar tráfico a Neon.
 // `refresh` se lee via ref para evitar que cambios de referencia reinicien el timer.
 const refreshRef = useRef(refresh);
 useEffect(() => {
 refreshRef.current = refresh;
 }, [refresh]);

 useEffect(() => {
 if (!isAuthenticated) {
 if (refreshTimerRef.current) {
 clearInterval(refreshTimerRef.current);
 refreshTimerRef.current = null;
 }
 return;
 }

 // Limpiar timer previo antes de crear uno nuevo
 if (refreshTimerRef.current) {
 clearInterval(refreshTimerRef.current);
 }

 // 5 minutos entre polls — suficiente para notificaciones no críticas
 refreshTimerRef.current = setInterval(() => {
 refreshRef.current();
 }, 5 * 60 * 1000);

 return () => {
 if (refreshTimerRef.current) {
 clearInterval(refreshTimerRef.current);
 refreshTimerRef.current = null;
 }
 };
 }, [isAuthenticated]);

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

 const removeNotification = useCallback(
 async (id) => {
 try {
 await deleteNotification(id);
 setNotifications((prev) => prev.filter((n) => n.id !== id));
 setUnreadCount((prev) => {
 const removed = notifications.find((n) => n.id === id);
 if (removed && removed.status !== "read") return Math.max(0, prev - 1);
 return prev;
 });
 return true;
 } catch (err) {
 console.error("No se pudo eliminar la notificación", err);
 showToast?.("No se pudo eliminar la notificación", "error");
 return false;
 }
 },
 [notifications, showToast]
 );

 const clearAll = useCallback(async () => {
 try {
 await clearNotifications();
 setNotifications([]);
 setUnreadCount(0);
 return true;
 } catch (err) {
 console.error("No se pudieron limpiar notificaciones", err);
 showToast?.("No se pudieron limpiar las notificaciones", "error");
 return false;
 }
 }, [showToast]);

 const addNotification = useCallback(
 (notification) => {
 if (!notification) return;
 setNotifications((prev) => [notification, ...prev]);
 if (notification.status !== "read") {
 setUnreadCount((prev) => prev + 1);
 if (notification.priority >= 2) {
 playNotificationSound();
 showToast?.(notification.title || "Notificación importante", "warning");
 } else {
 showToast?.(notification.title || "Nueva notificación", "info");
 }
 }
 },
 [playNotificationSound, showToast]
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
 removeNotification,
 clearAll,
 addNotification,
 }),
 [
 notifications,
 unreadCount,
 loading,
 error,
 refresh,
 markAsRead,
 markAll,
 removeNotification,
 clearAll,
 addNotification,
 ]
 );

 return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => useContext(NotificationContext);
