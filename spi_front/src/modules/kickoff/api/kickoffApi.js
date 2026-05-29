import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

function buildClient() {
  const token = localStorage.getItem('accessToken');
  return axios.create({
    baseURL: `${BASE_URL}/kickoff`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

const kickoffApi = {
  // ── events ──────────────────────────────────────────────────────────────────
  getCurrentEvent: () =>
    buildClient().get('/events/current').then(r => r.data),

  getAdminCurrentEvent: () =>
    buildClient().get('/events/admin/current').then(r => r.data),

  getEvent: (eventId) =>
    buildClient().get(`/events/${eventId}`).then(r => r.data),

  createEvent: (payload) =>
    buildClient().post('/events', payload).then(r => r.data),

  updateEvent: (eventId, patch) =>
    buildClient().patch(`/events/${eventId}`, patch).then(r => r.data),

  deleteEvent: (eventId) =>
    buildClient().delete(`/events/${eventId}`).then(r => r.data),

  // ── presentations ────────────────────────────────────────────────────────────
  getPresentations: (eventId) =>
    buildClient().get(`/events/${eventId}/presentations`).then(r => r.data),

  createPresentation: (eventId, payload) =>
    buildClient().post(`/events/${eventId}/presentations`, payload).then(r => r.data),

  getPresentation: (presentationId) =>
    buildClient().get(`/presentations/${presentationId}`).then(r => r.data),

  updatePresentation: (presentationId, patch) =>
    buildClient().patch(`/presentations/${presentationId}`, patch).then(r => r.data),

  deletePresentation: (presentationId) =>
    buildClient().delete(`/presentations/${presentationId}`).then(r => r.data),

  startPresentation: (presentationId) =>
    buildClient().post(`/presentations/${presentationId}/start`).then(r => r.data),

  finishPresentation: (presentationId) =>
    buildClient().post(`/presentations/${presentationId}/finish`).then(r => r.data),

  nextBlock: (presentationId) =>
    buildClient().post(`/presentations/${presentationId}/blocks/next`).then(r => r.data),

  prevBlock: (presentationId) =>
    buildClient().post(`/presentations/${presentationId}/blocks/previous`).then(r => r.data),

  upsertBlock: (presentationId, blockData) =>
    buildClient().put(`/presentations/${presentationId}/blocks`, blockData).then(r => r.data),

  deleteBlock: (presentationId, blockId) =>
    buildClient().delete(`/presentations/${presentationId}/blocks/${blockId}`).then(r => r.data),

  // ── questions ────────────────────────────────────────────────────────────────
  getQuestions: (presentationId, params = {}) =>
    buildClient().get(`/presentations/${presentationId}/questions`, { params }).then(r => r.data),

  createQuestion: (presentationId, payload) =>
    buildClient().post(`/presentations/${presentationId}/questions`, payload).then(r => r.data),

  moderateQuestion: (questionId, payload) =>
    buildClient().patch(`/questions/${questionId}/moderate`, payload).then(r => r.data),

  highlightQuestion: (questionId) =>
    buildClient().patch(`/questions/${questionId}/highlight`).then(r => r.data),

  approveQuestion: (questionId) =>
    buildClient().patch(`/questions/${questionId}/approve`).then(r => r.data),

  answerQuestion: (questionId, payload) =>
    buildClient().patch(`/questions/${questionId}/answer`, payload).then(r => r.data),

  hideQuestion: (questionId) =>
    buildClient().patch(`/questions/${questionId}/hide`).then(r => r.data),

  // ── ratings ──────────────────────────────────────────────────────────────────
  rateQuestion: (questionId, rating) =>
    buildClient().post(`/questions/${questionId}/rate`, { rating }).then(r => r.data),

  rateAporte: (aporteId, rating) =>
    buildClient().post(`/questions/${aporteId}/rate-aporte`, { rating }).then(r => r.data),

  ratePresentation: (presentationId, payload) =>
    buildClient().post(`/presentations/${presentationId}/rate`, payload).then(r => r.data),

  getPresentationRatings: (presentationId) =>
    buildClient().get(`/presentations/${presentationId}/ratings`).then(r => r.data),

  getEventRankings: (eventId) =>
    buildClient().get(`/events/${eventId}/rankings`).then(r => r.data),

  getAporteRankings: (eventId) =>
    buildClient().get(`/events/${eventId}/aporte-rankings`).then(r => r.data),

  getEventWinners: (eventId) =>
    buildClient().get(`/events/${eventId}/winners`).then(r => r.data),

  // ── QR ───────────────────────────────────────────────────────────────────────
  validateQr: (token) =>
    buildClient().get(`/qr/${token}`).then(r => r.data),

  getActiveQr: (presentationId) =>
    buildClient().get(`/presentations/${presentationId}/qr`).then(r => r.data),

  regenerateQr: (presentationId, payload = {}) =>
    buildClient().post(`/presentations/${presentationId}/qr/regenerate`, payload).then(r => r.data),
};

export default kickoffApi;
