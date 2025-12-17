import api from "./index";

export const listNotifications = async (status) => {
  const { data } = await api.get("/notifications", {
    params: status ? { status } : {},
  });

  const list = data?.data || data?.result || data?.rows || [];
  const unread = Number(data?.unread || 0);

  return { list: Array.isArray(list) ? list : [], unread };
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
