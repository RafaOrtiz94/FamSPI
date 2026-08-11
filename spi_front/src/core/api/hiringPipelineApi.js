import api from './index';

const BASE = '/hiring-pipeline';

export const getPipelineForRequest = (requestId) =>
  api.get(`${BASE}/request/${requestId}`).then(r => r.data);

export const startEvaluation = (requestId, applicantId) =>
  api.post(`${BASE}/request/${requestId}/start`, { applicant_id: applicantId }).then(r => r.data);

export const finalizeHiring = (requestId, entryId) =>
  api.post(`${BASE}/request/${requestId}/${entryId}/hire`).then(r => r.data);

export const getEntry = (entryId) =>
  api.get(`${BASE}/entries/${entryId}`).then(r => r.data);

export const advanceStage = (entryId, stage, payload) =>
  api.post(`${BASE}/entries/${entryId}/stages/${stage}/advance`, payload).then(r => r.data);

export const updateStageData = (entryId, stage, data, extra = {}) =>
  api.patch(`${BASE}/entries/${entryId}/stages/${stage}`, { data, ...extra }).then(r => r.data);

export const rejectApplicant = (entryId, stage, reason) =>
  api.post(`${BASE}/entries/${entryId}/stages/${stage}/reject`, { reason }).then(r => r.data);

export const reactivateApplicant = (entryId, reason) =>
  api.post(`${BASE}/entries/${entryId}/reactivate`, { reason }).then(r => r.data);

export const createSalaryProposal = (entryId, payload) =>
  api.post(`${BASE}/entries/${entryId}/proposals`, payload).then(r => r.data);

export const updateProposalResponse = (entryId, proposalId, response, responseNotes) =>
  api.patch(`${BASE}/entries/${entryId}/proposals/${proposalId}`, { response, response_notes: responseNotes }).then(r => r.data);

export const uploadSalaryOffer = (entryId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`${BASE}/entries/${entryId}/salary-offer`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const uploadContract = (entryId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`${BASE}/entries/${entryId}/contract`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const getInternalUsers = () =>
  api.get(`${BASE}/users`).then(r => r.data);

export const getUsersByRole = (roles) =>
  api.get(`${BASE}/users/role`, { params: { roles: roles.join(',') } }).then(r => r.data);

export const getMyTestAssignments = () =>
  api.get(`${BASE}/my-test-assignments`).then(r => r.data);

export const confirmTestDate = (entryId, selectedDatetime) =>
  api.patch(`${BASE}/my-test-assignments/${entryId}/confirm`, { selected_datetime: selectedDatetime }).then(r => r.data);

export const submitTestResult = (entryId, { score, observations, decision, reason }) =>
  api.post(`${BASE}/my-test-assignments/${entryId}/result`, { score, observations, decision, reason }).then(r => r.data);
