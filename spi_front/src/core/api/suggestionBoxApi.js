import api from "./index";

export async function createInternalSuggestionBoxSubmission(payload) {
  const { data } = await api.post("/suggestion-box/submissions", payload);
  return data;
}

export async function listSuggestionBoxSubmissions(params = {}) {
  const { data } = await api.get("/suggestion-box/submissions", { params });
  return data;
}

export async function getSuggestionBoxSubmission(id) {
  const { data } = await api.get(`/suggestion-box/submissions/${id}`);
  return data;
}

export async function updateSuggestionBoxSubmissionStatus(id, payload) {
  const { data } = await api.post(`/suggestion-box/submissions/${id}/status`, payload);
  return data;
}
