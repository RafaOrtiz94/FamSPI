import api, { isTransientApiError } from "./index";
import { readCachedResource, writeCachedResource } from "../pwa/localCache";

const buildNotificationsCacheKey = (suffix) => `notifications_api_${suffix}`;
const NOTIFICATIONS_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export const listNotifications = async (status) => {
 const cacheKey = buildNotificationsCacheKey(`status_${String(status || "all")}`);
 try {
  const { data } = await api.get("/notifications", {
   params: status ? { status } : {},
  });

  const list = data?.data || data?.result || data?.rows || [];
  const unread = Number(data?.unread || 0);
  const payload = { list: Array.isArray(list) ? list : [], unread };
  writeCachedResource(cacheKey, payload);
  return payload;
 } catch (error) {
  const cached = readCachedResource(cacheKey, { maxAgeMs: NOTIFICATIONS_CACHE_MAX_AGE_MS });
  if (cached?.data && isTransientApiError(error)) {
   return cached.data;
  }
  throw error;
 }
};

export const listAllNotificationsWithHistory = async () => {
 const cacheKey = buildNotificationsCacheKey("history");
 try {
  const { data } = await api.get("/notifications", {
   params: { include_cleared: "true" },
  });
  const list = data?.data || data?.result || data?.rows || [];
  const payload = Array.isArray(list) ? list : [];
  writeCachedResource(cacheKey, payload);
  return payload;
 } catch (error) {
  const cached = readCachedResource(cacheKey, { maxAgeMs: NOTIFICATIONS_CACHE_MAX_AGE_MS });
  if (cached?.data && isTransientApiError(error)) {
   return cached.data;
  }
  throw error;
 }
};

export const createNotification = async (payload) => {
 const { data } = await api.post("/notifications", payload);
 return data?.data || data;
};

export const markNotificationAsRead = async (id) => {
 const { data } = await api.patch(`/notifications/${id}/read`);
 return data?.data || data;
};

export const markAllNotificationsAsRead = async () => {
 const { data } = await api.patch("/notifications/read-all");
 return data?.data || data;
};

export const deleteNotification = async (id) => {
 const { data } = await api.delete(`/notifications/${id}`);
 return data?.data || data;
};

export const clearNotifications = async () => {
 const { data } = await api.delete("/notifications/clear");
 return data?.data || data;
};

export const getPushNotificationsConfig = async () => {
 const { data } = await api.get("/notifications/push/config");
 return data?.data || data;
};

export const getPushNotificationsStatus = async () => {
 const { data } = await api.get("/notifications/push/status");
 return data?.data || data;
};

export const subscribePushNotifications = async (payload) => {
 const { data } = await api.post("/notifications/push/subscribe", payload);
 return data?.data || data;
};

export const unsubscribePushNotifications = async (payload) => {
 const { data } = await api.post("/notifications/push/unsubscribe", payload);
 return data?.data || data;
};
