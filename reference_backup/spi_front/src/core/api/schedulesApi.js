import api from "./index";

export const fetchSchedules = () => api.get("/schedules").then((res) => res.data?.data || []);
export const fetchScheduleDetail = (id) => api.get(`/schedules/${id}`).then((res) => res.data?.data);
export const createSchedule = (payload) => api.post("/schedules", payload).then((res) => res.data?.data);
export const updateSchedule = (id, payload) => api.put(`/schedules/${id}`, payload).then((res) => res.data?.data);
export const deleteSchedule = (id) => api.delete(`/schedules/${id}`).then((res) => res.data?.data);
export const submitSchedule = (id) => api.post(`/schedules/${id}/submit`).then((res) => res.data?.data);
export const addScheduledVisit = (id, payload) => api.post(`/schedules/${id}/visits`, payload).then((res) => res.data?.data);
export const updateScheduledVisit = (id, visitId, payload) =>
  api.put(`/schedules/${id}/visits/${visitId}`, payload).then((res) => res.data?.data);
export const deleteScheduledVisit = (id, visitId) =>
  api.delete(`/schedules/${id}/visits/${visitId}`).then((res) => res.data?.data);
export const fetchPendingSchedules = () =>
  api.get("/schedules/pending-approval").then((res) => res.data?.data || []);
export const approveSchedule = (id, comments = "") =>
  api.post(`/schedules/${id}/approve`, { comments }).then((res) => res.data?.data);
export const rejectSchedule = (id, rejection_reason) =>
  api.post(`/schedules/${id}/reject`, { rejection_reason }).then((res) => res.data?.data);
export const fetchTeamSchedules = () => api.get("/schedules/team").then((res) => res.data?.data || []);
export const fetchScheduleAnalytics = () => api.get("/schedules/analytics").then((res) => res.data?.data || {});
export const fetchApprovedSchedule = (params = {}) =>
  api
    .get("/schedules/approved/current", { params })
    .then((res) => res.data?.data)
    .catch(() => null);

export default {
  fetchSchedules,
  fetchScheduleDetail,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  submitSchedule,
  addScheduledVisit,
  updateScheduledVisit,
  deleteScheduledVisit,
  fetchPendingSchedules,
  approveSchedule,
  rejectSchedule,
  fetchTeamSchedules,
  fetchScheduleAnalytics,
};
