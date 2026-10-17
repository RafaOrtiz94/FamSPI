import api from "./index";

const unwrapRows = (data) => {
 if (Array.isArray(data?.rows)) return data.rows;
 if (Array.isArray(data?.result?.rows)) return data.result.rows;
 if (Array.isArray(data?.data?.rows)) return data.data.rows;
 if (Array.isArray(data?.data)) return data.data;
 if (Array.isArray(data)) return data;
 return [];
};

export const getTeamAvailability = async () => {
 const { data } = await api.get("/servicio/disponibilidad");
 return unwrapRows(data);
};

export const updateAvailabilityStatus = async (status, note = "") => {
 const { data } = await api.post("/servicio/disponibilidad", { status, note });
 return data?.result || data;
};

export const getTechnicalActivities = async ({ from, to }) => {
 const { data } = await api.get("/servicio/actividades", {
 params: { from, to },
 });
 return unwrapRows(data);
};

export const getTechnicalScheduleFeed = async ({ from, to, scope } = {}) => {
 const { data } = await api.get("/servicio/cronograma/feed", {
 params: { from, to, scope },
 });
 return {
  rows: Array.isArray(data?.rows) ? data.rows : [],
  backlog: Array.isArray(data?.backlog) ? data.backlog : [],
  summary: data?.summary || {},
  scope: data?.scope || scope || "mine",
  from: data?.from || from || null,
  to: data?.to || to || null,
 };
};

export const createTechnicalActivity = async ({ activity_date, title, notes = "", status = "programado", user_id } = {}) => {
 const { data } = await api.post("/servicio/actividades", {
 activity_date,
 title,
 notes,
 status,
 user_id,
 });
 return data?.row || data;
};
