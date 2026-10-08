import api from "./index";

export const generateShortcutTokenForUser = async (userId) => {
  const { data } = await api.post(`/attendance/shortcut/admin/token/${userId}`);
  return data;
};

export const listShortcutTokensForUser = async (userId) => {
  const { data } = await api.get(`/attendance/shortcut/admin/tokens/${userId}`);
  return data?.data || [];
};

export const revokeShortcutToken = async (tokenId) => {
  const { data } = await api.post(`/attendance/shortcut/admin/tokens/${tokenId}/revoke`);
  return data;
};
