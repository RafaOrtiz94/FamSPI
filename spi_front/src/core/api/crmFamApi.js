import api from "./index";

// Dashboard
export const fetchCrmDashboard = () => api.get("/crm-fam/dashboard").then(r => r.data?.data);
export const fetchCrmPipeline = () => api.get("/crm-fam/dashboard/pipeline").then(r => r.data?.data);
export const fetchCrmForecast = (params) => api.get("/crm-fam/dashboard/forecast", { params }).then(r => r.data?.data);
export const fetchBlueSheetKpis = () => api.get("/crm-fam/dashboard/blue-sheet-kpis").then(r => r.data?.data);
export const fetchLostReasonsReport = (params) => api.get("/crm-fam/reports/lost-reasons", { params }).then(r => r.data?.data);
export const fetchRedFlagsReport = (params) => api.get("/crm-fam/reports/red-flags", { params }).then(r => r.data?.data);

// Pipeline Stages
export const fetchPipelineStages = () => api.get("/crm-fam/pipeline-stages").then(r => r.data?.data);
export const createPipelineStage = (data) => api.post("/crm-fam/pipeline-stages", data).then(r => r.data?.data);
export const updatePipelineStage = (id, data) => api.put(`/crm-fam/pipeline-stages/${id}`, data).then(r => r.data?.data);

// Lost Reasons
export const fetchLostReasons = () => api.get("/crm-fam/lost-reasons").then(r => r.data?.data);
export const createLostReason = (data) => api.post("/crm-fam/lost-reasons", data).then(r => r.data?.data);
export const updateLostReason = (id, data) => api.put(`/crm-fam/lost-reasons/${id}`, data).then(r => r.data?.data);

// Scorecard Criteria
export const fetchScorecardCriteria = () => api.get("/crm-fam/scorecard-criteria").then(r => r.data?.data);
export const createScorecardCriterion = (data) => api.post("/crm-fam/scorecard-criteria", data).then(r => r.data?.data);
export const updateScorecardCriterion = (id, data) => api.put(`/crm-fam/scorecard-criteria/${id}`, data).then(r => r.data?.data);

// Accounts
export const fetchAccounts = (params) => api.get("/crm-fam/accounts", { params }).then(r => r.data?.data);
export const fetchAccountById = (id) => api.get(`/crm-fam/accounts/${id}`).then(r => r.data?.data);
export const createAccount = (data) => api.post("/crm-fam/accounts", data).then(r => r.data?.data);
export const updateAccount = (id, data) => api.put(`/crm-fam/accounts/${id}`, data).then(r => r.data?.data);
export const deleteAccount = (id) => api.delete(`/crm-fam/accounts/${id}`).then(r => r.data?.data);
export const fetchAccountTimeline = (id) => api.get(`/crm-fam/accounts/${id}/timeline`).then(r => r.data?.data);

// Contacts
export const fetchContacts = (params) => api.get("/crm-fam/contacts", { params }).then(r => r.data?.data);
export const fetchContactById = (id) => api.get(`/crm-fam/contacts/${id}`).then(r => r.data?.data);
export const createContact = (data) => api.post("/crm-fam/contacts", data).then(r => r.data?.data);
export const updateContact = (id, data) => api.put(`/crm-fam/contacts/${id}`, data).then(r => r.data?.data);
export const deleteContact = (id) => api.delete(`/crm-fam/contacts/${id}`).then(r => r.data?.data);

// Leads
export const fetchLeads = (params) => api.get("/crm-fam/leads", { params }).then(r => r.data?.data);
export const fetchLeadById = (id) => api.get(`/crm-fam/leads/${id}`).then(r => r.data?.data);
export const createLead = (data) => api.post("/crm-fam/leads", data).then(r => r.data?.data);
export const updateLead = (id, data) => api.put(`/crm-fam/leads/${id}`, data).then(r => r.data?.data);
export const deleteLead = (id) => api.delete(`/crm-fam/leads/${id}`).then(r => r.data?.data);
export const linkLeadAccount = (id, data) => api.post(`/crm-fam/leads/${id}/account`, data).then(r => r.data?.data);
export const createLeadContact = (id, data) => api.post(`/crm-fam/leads/${id}/contact`, data).then(r => r.data?.data);
export const convertLead = (id, data) => api.post(`/crm-fam/leads/${id}/convert`, data).then(r => r.data?.data);
export const disqualifyLead = (id, data) => api.post(`/crm-fam/leads/${id}/disqualify`, data).then(r => r.data?.data);
export const promoteLeadToOpportunity = (id, data) => api.post(`/crm-fam/leads/${id}/promote`, data).then(r => r.data?.data);

// Opportunities
export const fetchOpportunities = (params) => api.get("/crm-fam/opportunities", { params }).then(r => r.data?.data);
export const fetchOpportunityById = (id) => api.get(`/crm-fam/opportunities/${id}`).then(r => r.data?.data);
export const createOpportunity = (data) => api.post("/crm-fam/opportunities", data).then(r => r.data?.data);
export const updateOpportunity = (id, data) => api.put(`/crm-fam/opportunities/${id}`, data).then(r => r.data?.data);
export const fetchOpportunityHealth = (id) => api.get(`/crm-fam/opportunities/${id}/health`).then(r => r.data?.data);
export const fetchOpportunityPurchaseStatus = (id) => api.get(`/crm-fam/opportunities/${id}/purchase-status`).then(r => r.data?.data);
export const linkPurchaseToOpportunity = (id, data) => api.post(`/crm-fam/opportunities/${id}/link-purchase`, data).then(r => r.data?.data);
export const changeOpportunityStage = (id, data) => api.post(`/crm-fam/opportunities/${id}/stage`, data).then(r => r.data?.data);
export const closeOpportunityWon = (id, data) => api.post(`/crm-fam/opportunities/${id}/close-won`, data).then(r => r.data?.data);
export const closeOpportunityLost = (id, data) => api.post(`/crm-fam/opportunities/${id}/close-lost`, data).then(r => r.data?.data);
export const suspendOpportunity = (id, data) => api.post(`/crm-fam/opportunities/${id}/suspend`, data).then(r => r.data?.data);

// Blue Sheets
export const fetchBlueSheetByOpportunity = (opportunityId) => api.get(`/crm-fam/opportunities/${opportunityId}/blue-sheet`).then(r => r.data?.data);
export const createBlueSheet = (opportunityId, data) => api.post(`/crm-fam/opportunities/${opportunityId}/blue-sheet`, data).then(r => r.data?.data);
export const updateBlueSheetGeneral = (id, data) => api.put(`/crm-fam/blue-sheets/${id}/general`, data).then(r => r.data?.data);
export const updateBlueSheetBuyingProcess = (id, data) => api.put(`/crm-fam/blue-sheets/${id}/buying-process`, data).then(r => r.data?.data);
export const updateBlueSheetStrategy = (id, data) => api.put(`/crm-fam/blue-sheets/${id}/strategy`, data).then(r => r.data?.data);
export const submitBlueSheet = (id) => api.post(`/crm-fam/blue-sheets/${id}/submit`).then(r => r.data?.data);
export const approveBlueSheet = (id, data) => api.post(`/crm-fam/blue-sheets/${id}/approve`, data).then(r => r.data?.data);
export const observeBlueSheet = (id, data) => api.post(`/crm-fam/blue-sheets/${id}/observe`, data).then(r => r.data?.data);
export const reopenBlueSheet = (id, data) => api.post(`/crm-fam/blue-sheets/${id}/reopen`, data).then(r => r.data?.data);
export const fetchBlueSheetVersions = (id) => api.get(`/crm-fam/blue-sheets/${id}/versions`).then(r => r.data?.data);
export const fetchBlueSheetCompleteness = (id) => api.get(`/crm-fam/blue-sheets/${id}/completeness`).then(r => r.data?.data);

// Buying Influences
export const fetchBuyingInfluences = (blueSheetId) => api.get(`/crm-fam/blue-sheets/${blueSheetId}/buying-influences`).then(r => r.data?.data);
export const createBuyingInfluence = (blueSheetId, data) => api.post(`/crm-fam/blue-sheets/${blueSheetId}/buying-influences`, data).then(r => r.data?.data);
export const updateBuyingInfluence = (id, data) => api.put(`/crm-fam/buying-influences/${id}`, data).then(r => r.data?.data);
export const deleteBuyingInfluence = (id) => api.delete(`/crm-fam/buying-influences/${id}`).then(r => r.data?.data);

// Win-Results
export const fetchWinResults = (blueSheetId) => api.get(`/crm-fam/blue-sheets/${blueSheetId}/win-results`).then(r => r.data?.data);
export const createWinResult = (buyingInfluenceId, data) => api.post(`/crm-fam/buying-influences/${buyingInfluenceId}/win-results`, data).then(r => r.data?.data);
export const updateWinResult = (id, data) => api.put(`/crm-fam/win-results/${id}`, data).then(r => r.data?.data);
export const deleteWinResult = (id) => api.delete(`/crm-fam/win-results/${id}`).then(r => r.data?.data);

// Competitors
export const fetchCompetitors = (blueSheetId) => api.get(`/crm-fam/blue-sheets/${blueSheetId}/competitors`).then(r => r.data?.data);
export const createCompetitor = (blueSheetId, data) => api.post(`/crm-fam/blue-sheets/${blueSheetId}/competitors`, data).then(r => r.data?.data);
export const updateCompetitor = (id, data) => api.put(`/crm-fam/competitors/${id}`, data).then(r => r.data?.data);
export const deleteCompetitor = (id) => api.delete(`/crm-fam/competitors/${id}`).then(r => r.data?.data);

// Competitive Preferences
export const fetchCompetitivePreferences = (blueSheetId) => api.get(`/crm-fam/blue-sheets/${blueSheetId}/competitive-preferences`).then(r => r.data?.data);
export const upsertCompetitivePreference = (blueSheetId, data) => api.put(`/crm-fam/blue-sheets/${blueSheetId}/competitive-preferences`, data).then(r => r.data?.data);

// Strengths
export const fetchStrengths = (blueSheetId) => api.get(`/crm-fam/blue-sheets/${blueSheetId}/strengths`).then(r => r.data?.data);
export const createStrength = (blueSheetId, data) => api.post(`/crm-fam/blue-sheets/${blueSheetId}/strengths`, data).then(r => r.data?.data);
export const updateStrength = (id, data) => api.put(`/crm-fam/strengths/${id}`, data).then(r => r.data?.data);
export const deleteStrength = (id) => api.delete(`/crm-fam/strengths/${id}`).then(r => r.data?.data);

// Red Flags
export const fetchRedFlags = (blueSheetId) => api.get(`/crm-fam/blue-sheets/${blueSheetId}/red-flags`).then(r => r.data?.data);
export const createRedFlag = (blueSheetId, data) => api.post(`/crm-fam/blue-sheets/${blueSheetId}/red-flags`, data).then(r => r.data?.data);
export const updateRedFlag = (id, data) => api.put(`/crm-fam/red-flags/${id}`, data).then(r => r.data?.data);
export const deleteRedFlag = (id) => api.delete(`/crm-fam/red-flags/${id}`).then(r => r.data?.data);
export const acceptRedFlag = (id, data) => api.post(`/crm-fam/red-flags/${id}/accept`, data).then(r => r.data?.data);

// Scorecard
export const fetchBlueSheetScorecard = (blueSheetId) => api.get(`/crm-fam/blue-sheets/${blueSheetId}/scorecard`).then(r => r.data?.data);
export const saveBlueSheetScorecard = (blueSheetId, data) => api.put(`/crm-fam/blue-sheets/${blueSheetId}/scorecard`, data).then(r => r.data?.data);

// Action Items
export const fetchActionItems = (blueSheetId, params) => api.get(`/crm-fam/blue-sheets/${blueSheetId}/action-items`, { params }).then(r => r.data?.data);
export const createActionItem = (blueSheetId, data) => api.post(`/crm-fam/blue-sheets/${blueSheetId}/action-items`, data).then(r => r.data?.data);
export const updateActionItem = (id, data) => api.put(`/crm-fam/action-items/${id}`, data).then(r => r.data?.data);
export const completeActionItem = (id, data) => api.post(`/crm-fam/action-items/${id}/complete`, data).then(r => r.data?.data);
export const deleteActionItem = (id) => api.delete(`/crm-fam/action-items/${id}`).then(r => r.data?.data);

// Activities
export const fetchActivities = (params) => api.get("/crm-fam/activities", { params }).then(r => r.data?.data);
export const createActivity = (data) => api.post("/crm-fam/activities", data).then(r => r.data?.data);
export const updateActivity = (id, data) => api.put(`/crm-fam/activities/${id}`, data).then(r => r.data?.data);
export const completeActivity = (id, data) => api.post(`/crm-fam/activities/${id}/complete`, data).then(r => r.data?.data);
export const deleteActivity = (id) => api.delete(`/crm-fam/activities/${id}`).then(r => r.data?.data);

// Documents
export const fetchDocuments = (params) => api.get("/crm-fam/documents", { params }).then(r => r.data?.data);
export const createDocument = (data) => api.post("/crm-fam/documents", data).then(r => r.data?.data);
export const uploadDocument = (data) => api.post("/crm-fam/documents/upload", data, {
  headers: { "Content-Type": "multipart/form-data" },
}).then(r => r.data?.data);
export const deleteDocument = (id) => api.delete(`/crm-fam/documents/${id}`).then(r => r.data?.data);

// Notes
export const fetchNotes = (params) => api.get("/crm-fam/notes", { params }).then(r => r.data?.data);
export const createNote = (data) => api.post("/crm-fam/notes", data).then(r => r.data?.data);
export const updateNote = (id, data) => api.put(`/crm-fam/notes/${id}`, data).then(r => r.data?.data);
export const deleteNote = (id) => api.delete(`/crm-fam/notes/${id}`).then(r => r.data?.data);

const crmFamApi = {
  fetchCrmDashboard,
  fetchCrmPipeline,
  fetchCrmForecast,
  fetchBlueSheetKpis,
  fetchLostReasonsReport,
  fetchRedFlagsReport,
  fetchPipelineStages,
  createPipelineStage,
  updatePipelineStage,
  fetchLostReasons,
  createLostReason,
  updateLostReason,
  fetchScorecardCriteria,
  createScorecardCriterion,
  updateScorecardCriterion,
  fetchAccounts,
  fetchAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  fetchAccountTimeline,
  fetchContacts,
  fetchContactById,
  createContact,
  updateContact,
  deleteContact,
  fetchLeads,
  fetchLeadById,
  createLead,
  updateLead,
  deleteLead,
  linkLeadAccount,
  createLeadContact,
  convertLead,
  disqualifyLead,
  promoteLeadToOpportunity,
  fetchOpportunities,
  fetchOpportunityById,
  createOpportunity,
  updateOpportunity,
  fetchOpportunityHealth,
  fetchOpportunityPurchaseStatus,
  linkPurchaseToOpportunity,
  changeOpportunityStage,
  closeOpportunityWon,
  closeOpportunityLost,
  suspendOpportunity,
  fetchBlueSheetByOpportunity,
  createBlueSheet,
  updateBlueSheetGeneral,
  updateBlueSheetBuyingProcess,
  updateBlueSheetStrategy,
  submitBlueSheet,
  approveBlueSheet,
  observeBlueSheet,
  reopenBlueSheet,
  fetchBlueSheetVersions,
  fetchBlueSheetCompleteness,
  fetchBuyingInfluences,
  createBuyingInfluence,
  updateBuyingInfluence,
  deleteBuyingInfluence,
  fetchWinResults,
  createWinResult,
  updateWinResult,
  deleteWinResult,
  fetchCompetitors,
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
  fetchCompetitivePreferences,
  upsertCompetitivePreference,
  fetchStrengths,
  createStrength,
  updateStrength,
  deleteStrength,
  fetchRedFlags,
  createRedFlag,
  updateRedFlag,
  deleteRedFlag,
  acceptRedFlag,
  fetchBlueSheetScorecard,
  saveBlueSheetScorecard,
  fetchActionItems,
  createActionItem,
  updateActionItem,
  completeActionItem,
  deleteActionItem,
  fetchActivities,
  createActivity,
  updateActivity,
  completeActivity,
  deleteActivity,
  fetchDocuments,
  createDocument,
  uploadDocument,
  deleteDocument,
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
};

export default crmFamApi;
