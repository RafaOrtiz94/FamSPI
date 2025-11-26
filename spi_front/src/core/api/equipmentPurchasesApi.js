import api from "./index";


export const getEquipmentPurchaseMeta = async () => {
  const { data } = await api.get("/equipment-purchases/meta");
  return data.data || {};
};

export const listEquipmentPurchases = async () => {
  const { data } = await api.get("/equipment-purchases");
  return data.data || [];
};

export const createEquipmentPurchase = async (payload) => {
  const { data } = await api.post("/equipment-purchases", payload);
  return data.data;
};

export const startAvailability = async (id, payload) => {
  const { data } = await api.post(`/equipment-purchases/${id}/start-availability`, payload);
  return data.data;
};

export const saveProviderResponse = async (id, payload) => {
  const { data } = await api.post(`/equipment-purchases/${id}/provider-response`, payload);
  return data.data;
};

export const requestProforma = async (id) => {
  const { data } = await api.post(`/equipment-purchases/${id}/request-proforma`);
  return data.data;
};

export const uploadProforma = async (id, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/equipment-purchases/${id}/upload-proforma`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};

export const reserveEquipment = async (id) => {
  const { data } = await api.post(`/equipment-purchases/${id}/reserve`);
  return data.data;
};

export const uploadSignedProforma = async (id, { file, inspection_min_date, inspection_max_date, includes_starter_kit }) => {
  const formData = new FormData();
  if (file) formData.append("file", file);
  if (inspection_min_date) formData.append("inspection_min_date", inspection_min_date);
  if (inspection_max_date) formData.append("inspection_max_date", inspection_max_date);
  if (includes_starter_kit !== undefined) formData.append("includes_starter_kit", includes_starter_kit);

  const { data } = await api.post(`/equipment-purchases/${id}/upload-signed-proforma`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};

export const uploadContract = async (id, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/equipment-purchases/${id}/upload-contract`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};

export const renewReservation = async (id) => {
  const { data } = await api.post(`/equipment-purchases/${id}/renew-reservation`);
  return data.data;
};

export const cancelOrder = async (id, reason) => {
  const { data } = await api.post(`/equipment-purchases/${id}/cancel-order`, { reason });
  return data.data;
};

export const submitSignedProformaWithInspection = async (id, { file, inspection_min_date, inspection_max_date, includes_starter_kit }) => {
  const formData = new FormData();
  if (file) formData.append("file", file);
  if (inspection_min_date) formData.append("inspection_min_date", inspection_min_date);
  if (inspection_max_date) formData.append("inspection_max_date", inspection_max_date);
  if (includes_starter_kit !== undefined) formData.append("includes_starter_kit", includes_starter_kit);

  const { data } = await api.post(`/equipment-purchases/${id}/submit-signed-proforma-with-inspection`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};
