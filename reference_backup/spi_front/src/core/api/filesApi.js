import api from "./index";

export const uploadFiles = async (requestId, formData) => {
  const { data } = await api.post(`/files/upload/${requestId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.result || data;
};

export const getFilesByRequest = async (requestId) => {
  const { data } = await api.get(`/files/by-request/${requestId}`);
  return (
    data.files ||
    data.result?.files ||
    data.rows ||
    data.result?.rows ||
    []
  );
};

export const downloadFile = async (fileId) => {
  const { data } = await api.get(`/files/${fileId}/download`, {
    responseType: "blob",
  });
  return data;
};

export const deleteFile = async (fileId) => {
  const { data } = await api.delete(`/files/${fileId}`);
  return data.result || data;
};
