import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

function buildClient() {
  const token = localStorage.getItem('accessToken');
  return axios.create({
    baseURL: `${BASE_URL}/famdays`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

const famdaysApi = {
  getMyAccess: () => buildClient().get('/access/me').then((r) => r.data),
  listConfigurators: () => buildClient().get('/configurators').then((r) => r.data),
  setConfigurators: (userIds) => buildClient().put('/configurators', { user_ids: userIds }).then((r) => r.data),

  listEvents: () => buildClient().get('/events').then((r) => r.data),
  getCurrentEvent: () => buildClient().get('/events/current').then((r) => r.data),
  getAdminCurrentEvent: () => buildClient().get('/events/admin/current').then((r) => r.data),
  getEvent: (eventId) => buildClient().get(`/events/${eventId}`).then((r) => r.data),
  createEvent: (payload) => buildClient().post('/events', payload).then((r) => r.data),
  updateEvent: (eventId, patch) => buildClient().patch(`/events/${eventId}`, patch).then((r) => r.data),
  deleteEvent: (eventId) => buildClient().delete(`/events/${eventId}`).then((r) => r.data),

  getPresentations: (eventId) => buildClient().get(`/events/${eventId}/presentations`).then((r) => r.data),
  createPresentation: (eventId, payload) => buildClient().post(`/events/${eventId}/presentations`, payload).then((r) => r.data),
  updatePresentation: (presentationId, patch) => buildClient().patch(`/presentations/${presentationId}`, patch).then((r) => r.data),
  deletePresentation: (presentationId) => buildClient().delete(`/presentations/${presentationId}`).then((r) => r.data),
  getPresentation: (presentationId) => buildClient().get(`/presentations/${presentationId}`).then((r) => r.data),
  startPresentation: (presentationId) => buildClient().post(`/presentations/${presentationId}/start`).then((r) => r.data),
  finishPresentation: (presentationId) => buildClient().post(`/presentations/${presentationId}/finish`).then((r) => r.data),

  getQuestions: (presentationId, params = {}) =>
    buildClient().get(`/presentations/${presentationId}/questions`, { params }).then((r) => r.data),
  createQuestion: (presentationId, payload) =>
    buildClient().post(`/presentations/${presentationId}/questions`, payload).then((r) => r.data),
  getEventQuestions: (eventId, params = {}) =>
    buildClient().get(`/events/${eventId}/questions`, { params }).then((r) => r.data),
  createEventQuestion: (eventId, payload) =>
    buildClient().post(`/events/${eventId}/questions`, payload).then((r) => r.data),
  highlightQuestion: (questionId) => buildClient().patch(`/questions/${questionId}/highlight`).then((r) => r.data),
  answerQuestion: (questionId) => buildClient().patch(`/questions/${questionId}/answer`).then((r) => r.data),
  hideQuestion: (questionId) => buildClient().patch(`/questions/${questionId}/hide`).then((r) => r.data),
  rateAporte: (aporteId, rating) => buildClient().post(`/questions/${aporteId}/rate-aporte`, { rating }).then((r) => r.data),

  getAporteRankings: (eventId) => buildClient().get(`/events/${eventId}/aporte-rankings`).then((r) => r.data),
  getEventSummary: (eventId) => buildClient().get(`/events/${eventId}/summary`).then((r) => r.data),
  getPostEventQA: (eventId) => buildClient().get(`/events/${eventId}/post-qa`).then((r) => r.data),
  getActiveQr: (eventId) => buildClient().get(`/events/${eventId}/qr`).then((r) => r.data),
  regenerateQr: (eventId, payload = {}) => buildClient().post(`/events/${eventId}/qr/regenerate`, payload).then((r) => r.data),
  validateQr: (token) => buildClient().get(`/qr/${token}`).then((r) => r.data),
};

export default famdaysApi;
