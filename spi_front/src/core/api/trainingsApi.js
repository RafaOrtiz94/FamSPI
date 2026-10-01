import api from "./index";

const base = "/trainings";

// ── CRUD ────────────────────────────────────────────────────────────────────

export const createTraining = async (payload) => {
  const { data } = await api.post(base, payload);
  return data?.data ?? data;
};

export const listTrainings = async (params = {}) => {
  const { data } = await api.get(base, { params });
  return data?.data ?? [];
};

export const listTrainingParticipants = async (search = "") => {
  const { data } = await api.get(`${base}/participants`, {
    params: search ? { search } : {},
  });
  return data?.data ?? [];
};

export const getTraining = async (id) => {
  const { data } = await api.get(`${base}/${id}`);
  return data?.data ?? data;
};

export const updateTraining = async (id, payload) => {
  const { data } = await api.put(`${base}/${id}`, payload);
  return data?.data ?? data;
};

export const cancelTraining = async (id) => {
  const { data } = await api.delete(`${base}/${id}`);
  return data?.data ?? data;
};

// ── Asistentes ───────────────────────────────────────────────────────────────

export const addAttendees = async (id, attendees) => {
  const { data } = await api.post(`${base}/${id}/attendees`, { attendees });
  return data?.data ?? data;
};

export const removeAttendee = async (id, attendeeId) => {
  const { data } = await api.delete(`${base}/${id}/attendees/${attendeeId}`);
  return data?.data ?? data;
};

export const markAttendance = async (id, attendance) => {
  const { data } = await api.post(`${base}/${id}/attendance`, { attendance });
  return data?.data ?? data;
};

export const getMyAssigned = async () => {
  const { data } = await api.get(`${base}/me/assigned`);
  return data?.data ?? [];
};

// ── Acta principal ───────────────────────────────────────────────────────────

export const generateActa = async (id) => {
  const { data } = await api.post(`${base}/${id}/acta/generate`);
  return data?.data ?? data;
};

export const uploadExternalActa = async (id, file) => {
  const form = new FormData();
  form.append("acta_pdf", file);
  const { data } = await api.post(`${base}/${id}/acta/upload-external`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data ?? data;
};

export const uploadManualSignedActa = async (id, file) => {
  const form = new FormData();
  form.append("acta_pdf", file);
  const { data } = await api.post(`${base}/${id}/acta/upload-signed`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data ?? data;
};

export const sendActaToFamSign = async (id) => {
  const { data } = await api.post(`${base}/${id}/acta/send-famsign`);
  return data?.data ?? data;
};

export const remindMainSigners = async (id) => {
  const { data } = await api.post(`${base}/${id}/acta/remind`);
  return data?.data ?? data;
};

// ── Acta de inasistentes ─────────────────────────────────────────────────────

export const generateAbsentActa = async (id) => {
  const { data } = await api.post(`${base}/${id}/absent-acta/generate`);
  return data?.data ?? data;
};

export const sendAbsentActaToFamSign = async (id) => {
  const { data } = await api.post(`${base}/${id}/absent-acta/send-famsign`);
  return data?.data ?? data;
};

export const uploadManualSignedAbsentActa = async (id, file) => {
  const form = new FormData();
  form.append("acta_pdf", file);
  const { data } = await api.post(`${base}/${id}/absent-acta/upload-signed`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data ?? data;
};

export const remindAbsentSigners = async (id) => {
  const { data } = await api.post(`${base}/${id}/absent-acta/remind`);
  return data?.data ?? data;
};
