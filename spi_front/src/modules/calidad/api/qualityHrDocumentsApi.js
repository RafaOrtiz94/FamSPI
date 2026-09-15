import api from "../../../core/api";

export const getQualityHrDocuments = async (params = {}) => {
  const { data } = await api.get("/collaborators/documents/quality-hr", { params });
  return data;
};
