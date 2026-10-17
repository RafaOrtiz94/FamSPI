import api from "./index";

const base = "/business-case/template-versions";

export const getBcTemplateStatus = async () => {
  const { data } = await api.get(base);
  return data?.data;
};

export const uploadBcTemplateVersion = async (file) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(base, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data;
};

export const activateBcTemplateVersion = async (id) => {
  const { data } = await api.post(`${base}/${id}/activate`);
  return data?.data;
};

export const rejectBcTemplateVersion = async (id, reason) => {
  const { data } = await api.post(`${base}/${id}/reject`, { reason });
  return data?.data;
};

export const getBcCatalogDiff = async () => {
  const { data } = await api.get(`${base}/catalog-diff`);
  return data?.data;
};

export const syncBcCatalog = async () => {
  const { data } = await api.post(`${base}/catalog-sync`);
  return data?.data;
};

export const getBcInvestmentCatalogDiff = async () => {
  const { data } = await api.get(`${base}/investment-catalog-diff`);
  return data?.data;
};

export const syncBcInvestmentCatalog = async () => {
  const { data } = await api.post(`${base}/investment-catalog-sync`);
  return data?.data;
};

export const getBcEquipmentSheetMappingReport = async () => {
  const { data } = await api.get(`${base}/equipment-sheet-mapping-report`);
  return data?.data;
};
