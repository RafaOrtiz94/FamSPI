import api from "./index";

export const getConsumableFileByPurchase = async ({ purchaseType, purchaseRequestId }) => {
  const { data } = await api.get("/consumable-files/by-purchase", {
    params: {
      purchase_type: purchaseType,
      purchase_request_id: purchaseRequestId,
    },
  });
  return data.data ?? null;
};

export const listConsumableFilesOverview = async () => {
  const { data } = await api.get("/consumable-files/overview");
  return data.data || { items: [], summary: {} };
};

export const createConsumableFileFromPurchase = async ({ purchaseType, purchaseRequestId, processName }) => {
  const { data } = await api.post("/consumable-files/from-purchase", {
    purchase_type: purchaseType,
    purchase_request_id: purchaseRequestId,
    process_name: processName,
  });
  return data.data;
};

export const createStandaloneConsumableFile = async ({
  processName,
  processCode,
  clientId = null,
  contractingEntity = null,
  sameEntityAsClient = false,
  contractObject = null,
  equipmentIds = [],
}) => {
  const { data } = await api.post("/consumable-files/standalone", {
    process_name: processName,
    process_code: processCode,
    client_id: clientId,
    contracting_entity: contractingEntity,
    same_entity_as_client: sameEntityAsClient,
    contract_object: contractObject,
    equipment_ids: equipmentIds,
  });
  return data.data;
};

export const uploadStandaloneConsumableDocument = async (fileId, { docType, fileBase64, fileName, mimeType }) => {
  const { data } = await api.post(`/consumable-files/${fileId}/standalone-documents`, {
    doc_type: docType,
    file_base64: fileBase64,
    file_name: fileName,
    mime_type: mimeType,
  });
  return data.data;
};

export const importStandaloneBusinessCaseFile = async (fileId, { sectionId = null, fileBase64, fileName, mimeType }) => {
  const { data } = await api.post(`/consumable-files/${fileId}/standalone-business-case`, {
    section_id: sectionId,
    file_base64: fileBase64,
    file_name: fileName,
    mime_type: mimeType,
  });
  return data.data;
};

export const previewStandaloneBusinessCaseFile = async ({ fileBase64, fileName }) => {
  const { data } = await api.post("/consumable-files/standalone/parse-preview", {
    file_base64: fileBase64,
    file_name: fileName,
  });
  return data.data;
};

export const requestClientAssignment = async ({ clientId, clientLabel }) => {
  const { data } = await api.post("/consumable-files/standalone/request-client-assignment", {
    client_id: clientId,
    client_label: clientLabel,
  });
  return data.data;
};

export const getConsumableFile = async (id) => {
  const { data } = await api.get(`/consumable-files/${id}`);
  return data.data;
};

export const updateConsumableFile = async (id, payload) => {
  const { data } = await api.patch(`/consumable-files/${id}`, payload);
  return data.data;
};

export const createConsumableFileSection = async (id, payload) => {
  const { data } = await api.post(`/consumable-files/${id}/sections`, payload);
  return data.data;
};

export const importConsumableFileBusinessCase = async (sectionId) => {
  const { data } = await api.post(`/consumable-files/sections/${sectionId}/import-business-case`);
  return data.data;
};

export const addConsumableFileLine = async (sectionId, payload) => {
  const { data } = await api.post(`/consumable-files/sections/${sectionId}/lines`, payload);
  return data.data;
};

export const updateConsumableFileLine = async (lineId, payload) => {
  const { data } = await api.patch(`/consumable-files/lines/${lineId}`, payload);
  return data.data;
};

export const deleteConsumableFileLine = async (lineId) => {
  const { data } = await api.delete(`/consumable-files/lines/${lineId}`);
  return data.data;
};

export const importConsumableFileEquipment = async (sectionId, payload) => {
  const { data } = await api.post(`/consumable-files/sections/${sectionId}/import-equipment`, payload);
  return data.data;
};

export const registerConsumableFile = async (id) => {
  const { data } = await api.post(`/consumable-files/${id}/register`);
  return data.data;
};

export const cancelConsumableFile = async (id, payload = {}) => {
  const { data } = await api.post(`/consumable-files/${id}/cancel`, payload);
  return data.data;
};

export const searchConsumableCatalog = async ({ q = "", type = null, limit = 20 } = {}) => {
  const { data } = await api.get("/consumable-files/catalog/search", {
    params: { q, type, limit },
  });
  return data.data || [];
};

export const previewStandaloneConsumableCatalog = async ({ equipmentIds = [] } = {}) => {
  const { data } = await api.post("/consumable-files/catalog/standalone-preview", {
    equipment_ids: equipmentIds,
  });
  return data.data || { equipment: [], sections: [], summary: {} };
};

export const createConsumableOrder = async (id, payload) => {
  const { data } = await api.post(`/consumable-files/${id}/orders`, payload);
  return data.data;
};

export const reviewConsumableOrderExtra = async (orderId, payload) => {
  const { data } = await api.post(`/consumable-files/orders/${orderId}/review-extra`, payload);
  return data.data;
};

export const dispatchConsumableOrder = async (orderId, payload) => {
  const { data } = await api.post(`/consumable-files/orders/${orderId}/dispatch`, payload);
  return data.data;
};

export const cancelConsumableOrder = async (orderId, payload = {}) => {
  const { data } = await api.post(`/consumable-files/orders/${orderId}/cancel`, payload);
  return data.data;
};
