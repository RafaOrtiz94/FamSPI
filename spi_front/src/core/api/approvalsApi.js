import api from "./index";

export const getPendingApprovals = async () => {
  const { data } = await api.get("/approvals/pending");
  const rows =
    data?.rows ||
    data?.result?.rows ||
    data?.data?.rows ||
    data?.data ||
    data?.result ||
    data;

  return Array.isArray(rows) ? rows : { rows: Array.isArray(rows?.rows) ? rows.rows : [] };
};

export const approveRequest = async (id, note = "") => {
  const { data } = await api.post(`/approvals/${id}/approve`, { note });
  return data.result || data;
};

export const rejectRequest = async (id, note = "") => {
  const { data } = await api.post(`/approvals/${id}/reject`, { note });
  return data.result || data;
};
