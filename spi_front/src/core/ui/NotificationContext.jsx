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
 getPushNotificationsStatus,
} from "../api/notificationsApi";
import { isTransientApiError } from "../api/index";
import { useAuth } from "../auth/useAuth";
import { useUI } from "./UIContext";
import { readCachedResource, writeCachedResource } from "../pwa/localCache";
import {
 disablePushNotifications,
 enablePushNotifications,
 getBrowserPushPermission,
 isIosDevice,
 isPushSupported,
 isStandalonePwa,
 syncExistingPushSubscription,
} from "../push/webPush";

const NotificationContext = createContext();
const NOTIFICATIONS_CACHE_KEY = "notifications_snapshot";

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
 const [pushState, setPushState] = useState({
 supported: isPushSupported(),
 enabled: false,
 permission: getBrowserPushPermission(),
 subscribed: false,
 loading: false,
 error: null,
 activeSubscriptions: 0,
 isIos: isIosDevice(),
 isStandalone: isStandalonePwa(),
 });

 const persistNotificationsSnapshot = useCallback((list, unread) => {
 writeCachedResource(NOTIFICATIONS_CACHE_KEY, {
 notifications: Array.isArray(list) ? list : [],
 unreadCount: Number(unread || 0),
 });
 }, []);

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
  persistNotificationsSnapshot(
   normalizedList,
   unread || normalizedList.filter((n) => n.status !== "read").length,
  );

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
 const cached = readCachedResource(NOTIFICATIONS_CACHE_KEY, {
  maxAgeMs: 1000 * 60 * 60 * 24,
 });
 if (cached?.data?.notifications && isTransientApiError(err)) {
  const fallbackList = Array.isArray(cached.data.notifications)
   ? cached.data.notifications
   : [];
  const fallbackUnread = Number(
   cached.data.unreadCount ??
    fallbackList.filter((n) => n.status !== "read").length,
  );
  setNotifications(fallbackList);
  setUnreadCount(fallbackUnread);
  setError("Mostrando notificaciones guardadas localmente");
  return { list: fallbackList, unread: fallbackUnread, cached: true };
 }
 setError("No se pudieron obtener las notificaciones");
 return { list: [], unread: 0 };
 } finally {
 setLoading(false);
 }
 },
 [isAuthenticated, persistNotificationsSnapshot, playNotificationSound, showToast]
 );

 // Carga inicial: se ejecuta solo cuando cambia el estado de autenticación.
 useEffect(() => {
 if (isAuthenticated) {
  refresh();
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [isAuthenticated]);

 useEffect(() => {
  if (isAuthenticated) return;
  const cached = readCachedResource(NOTIFICATIONS_CACHE_KEY, {
   maxAgeMs: 1000 * 60 * 60 * 24,
  });
  if (cached?.data?.notifications) {
   setNotifications(Array.isArray(cached.data.notifications) ? cached.data.notifications : []);
   setUnreadCount(Number(cached.data.unreadCount || 0));
  }
 }, [isAuthenticated]);

 const refreshPushState = useCallback(async () => {
 if (!isAuthenticated) {
 setPushState((prev) => ({
 ...prev,
 supported: isPushSupported(),
 permission: getBrowserPushPermission(),
 enabled: false,
 subscribed: false,
 activeSubscriptions: 0,
 loading: false,
 error: null,
 isIos: isIosDevice(),
 isStandalone: isStandalonePwa(),
 }));
 return {
 supported: isPushSupported(),
 permission: getBrowserPushPermission(),
 subscribed: false,
 activeSubscriptions: 0,
 };
 }

 const supported = isPushSupported();
 const permission = getBrowserPushPermission();
 const baseState = {
 supported,
 permission,
 isIos: isIosDevice(),
 isStandalone: isStandalonePwa(),
 };

 if (!supported) {
 setPushState((prev) => ({
 ...prev,
 ...baseState,
 enabled: false,
 subscribed: false,
 activeSubscriptions: 0,
 loading: false,
 error: null,
 }));
 return { ...baseState, subscribed: false, activeSubscriptions: 0 };
 }

 try {
 const [status, syncResult] = await Promise.all([
 getPushNotificationsStatus().catch(() => ({ enabled: false, activeSubscriptions: 0 })),
 permission === "granted"
 ? syncExistingPushSubscription().catch(() => ({ subscribed: false }))
 : Promise.resolve({ subscribed: false }),
 ]);

 const nextState = {
 ...baseState,
 enabled: Boolean(status?.enabled),
 subscribed: Boolean(syncResult?.subscribed || Number(status?.activeSubscriptions || 0) > 0),
 activeSubscriptions: Number(status?.activeSubscriptions || 0),
 loading: false,
 error: null,
 };
 setPushState((prev) => ({ ...prev, ...nextState }));
 return nextState;
 } catch (error) {
 const nextState = {
 ...baseState,
 enabled: false,
 subscribed: false,
 activeSubscriptions: 0,
 loading: false,
 error: error?.message || "No se pudo validar push",
 };
 setPushState((prev) => ({ ...prev, ...nextState }));
 return nextState;
 }
 }, [isAuthenticated]);

 useEffect(() => {
  refreshPushState();
 }, [refreshPushState]);

 useEffect(() => {
  if (!notifications.length && unreadCount === 0) return;
  persistNotificationsSnapshot(notifications, unreadCount);
 }, [notifications, persistNotificationsSnapshot, unreadCount]);

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

 const enableDevicePush = useCallback(async () => {
 setPushState((prev) => ({ ...prev, loading: true, error: null }));
 try {
 const result = await enablePushNotifications({ deviceLabel: "iPhone/PWA" });
 const status = await getPushNotificationsStatus().catch(() => ({ enabled: true, activeSubscriptions: 1 }));
 const nextState = {
 supported: isPushSupported(),
 enabled: Boolean(status?.enabled),
 subscribed: Boolean(result?.subscribed),
 permission: result?.permission || getBrowserPushPermission(),
 loading: false,
 error: null,
 activeSubscriptions: Number(status?.activeSubscriptions || 1),
 isIos: isIosDevice(),
 isStandalone: isStandalonePwa(),
 };
 setPushState((prev) => ({ ...prev, ...nextState }));
 showToast?.("Notificaciones del dispositivo activadas", "success");
 return true;
 } catch (error) {
 const message =
 error?.message === "PUSH_NOT_SUPPORTED"
 ? "Este dispositivo no soporta notificaciones push para la PWA."
 : error?.message === "PUSH_NOT_CONFIGURED"
 ? "El servidor no tiene configuradas las llaves de push."
 : error?.message === "PUSH_PERMISSION_DENIED"
 ? "Safari bloqueo el permiso de notificaciones para esta PWA."
 : "No se pudieron activar las notificaciones del dispositivo.";
 setPushState((prev) => ({
 ...prev,
 supported: isPushSupported(),
 permission: getBrowserPushPermission(),
 loading: false,
 error: message,
 isIos: isIosDevice(),
 isStandalone: isStandalonePwa(),
 }));
 showToast?.(message, "error");
 return false;
 }
 }, [showToast]);

 const disableDevicePush = useCallback(async () => {
 setPushState((prev) => ({ ...prev, loading: true, error: null }));
 try {
 const result = await disablePushNotifications();
 const nextState = {
 supported: isPushSupported(),
 enabled: pushState.enabled,
 subscribed: Boolean(result?.subscribed),
 permission: result?.permission || getBrowserPushPermission(),
 loading: false,
 error: null,
 activeSubscriptions: 0,
 isIos: isIosDevice(),
 isStandalone: isStandalonePwa(),
 };
 setPushState((prev) => ({ ...prev, ...nextState }));
 showToast?.("Notificaciones del dispositivo desactivadas", "success");
 return true;
 } catch (error) {
 const message = "No se pudieron desactivar las notificaciones del dispositivo.";
 setPushState((prev) => ({ ...prev, loading: false, error: message }));
 showToast?.(message, "error");
 return false;
 }
 }, [pushState.enabled, showToast]);

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
 pushState,
 refreshPushState,
 enableDevicePush,
 disableDevicePush,
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
 pushState,
 refreshPushState,
 enableDevicePush,
 disableDevicePush,
 ]
 );

 return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => useContext(NotificationContext);
