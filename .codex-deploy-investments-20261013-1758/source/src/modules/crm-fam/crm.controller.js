const service = require("./crm.service");
const respond = (res, fn) =>
  fn.then((data) => res.json({ ok: true, data }))
    .catch((err) => res.status(err.status || 500).json({ ok: false, message: err.message || "Error" }));

// ACCOUNTS
const listAccounts = (req, res) => respond(res, service.listAccounts({ ...req.query, user: req.user }));
const getAccountById = (req, res) => respond(res, service.getAccountById(req.params.id, req.user));
const createAccount = (req, res) => respond(res, service.createAccount(req.body, req.user));
const updateAccount = (req, res) => respond(res, service.updateAccount(req.params.id, req.body, req.user));
const softDeleteAccount = (req, res) => respond(res, service.softDeleteAccount(req.params.id, req.user));
const getAccountTimeline = (req, res) => respond(res, service.getAccountTimeline(req.params.id, req.user));

// CONTACTS
const listContacts = (req, res) => respond(res, service.listContacts({ ...req.query, user: req.user }));
const getContactById = (req, res) => respond(res, service.getContactById(req.params.id, req.user));
const createContact = (req, res) => respond(res, service.createContact(req.body, req.user));
const updateContact = (req, res) => respond(res, service.updateContact(req.params.id, req.body, req.user));
const softDeleteContact = (req, res) => respond(res, service.softDeleteContact(req.params.id, req.user));

// LEADS
const listLeads = (req, res) => respond(res, service.listLeads({ ...req.query, user: req.user }));
const getLeadById = (req, res) => respond(res, service.getLeadById(req.params.id, req.user));
const createLead = (req, res) => respond(res, service.createLead(req.body, req.user));
const updateLead = (req, res) => respond(res, service.updateLead(req.params.id, req.body, req.user));
const softDeleteLead = (req, res) => respond(res, service.softDeleteLead(req.params.id, req.user));
const convertLead = (req, res) => respond(res, service.convertLead(req.params.id, req.body, req.user));
const disqualifyLead = (req, res) => respond(res, service.disqualifyLead(req.params.id, req.body, req.user));
const linkLeadAccount = (req, res) => respond(res, service.linkLeadAccount(req.params.id, req.body, req.user));
const createLeadContact = (req, res) => respond(res, service.createLeadContact(req.params.id, req.body, req.user));
const promoteLeadToOpportunity = (req, res) => respond(res, service.promoteLeadToOpportunity(req.params.id, req.body, req.user));

// PIPELINE STAGES
const listPipelineStages = (req, res) => respond(res, service.listPipelineStages());
const createPipelineStage = (req, res) => respond(res, service.createPipelineStage(req.body, req.user));
const updatePipelineStage = (req, res) => respond(res, service.updatePipelineStage(req.params.id, req.body, req.user));

// OPPORTUNITIES
const listOpportunities = (req, res) => respond(res, service.listOpportunities({ ...req.query, user: req.user }));
const getOpportunityById = (req, res) => respond(res, service.getOpportunityById(req.params.id, req.user));
const createOpportunity = (req, res) => respond(res, service.createOpportunity(req.body, req.user));
const updateOpportunity = (req, res) => respond(res, service.updateOpportunity(req.params.id, req.body, req.user));
const changeOpportunityStage = (req, res) => respond(res, service.changeOpportunityStage(req.params.id, req.body, req.user));
const closeWon = (req, res) => respond(res, service.closeWon(req.params.id, req.body, req.user));
const closeLost = (req, res) => respond(res, service.closeLost(req.params.id, req.body, req.user));
const suspendOpportunity = (req, res) => respond(res, service.suspendOpportunity(req.params.id, req.body, req.user));
const getOpportunityHealth = (req, res) => respond(res, service.getOpportunityHealth(req.params.id, req.user));
const getOpportunityPurchaseStatus = (req, res) => respond(res, service.getOpportunityPurchaseStatus(req.params.id, req.user));
const linkPurchaseToOpportunity = (req, res) => respond(res, service.linkPurchaseToOpportunity(req.params.id, req.body, req.user));

// BLUE SHEETS
const createBlueSheet = (req, res) => respond(res, service.createBlueSheet(req.params.opportunityId, req.body, req.user));
const getBlueSheetByOpportunity = (req, res) => respond(res, service.getBlueSheetByOpportunity(req.params.opportunityId, req.user));
const getBlueSheetById = (req, res) => respond(res, service.getBlueSheetById(req.params.id, req.user));
const updateBlueSheetGeneral = (req, res) => respond(res, service.updateBlueSheetGeneral(req.params.id, req.body, req.user));
const updateBlueSheetBuyingProcess = (req, res) => respond(res, service.updateBlueSheetBuyingProcess(req.params.id, req.body, req.user));
const updateBlueSheetStrategy = (req, res) => respond(res, service.updateBlueSheetStrategy(req.params.id, req.body, req.user));
const submitBlueSheetForReview = (req, res) => respond(res, service.submitBlueSheetForReview(req.params.id, req.user));
const approveBlueSheet = (req, res) => respond(res, service.approveBlueSheet(req.params.id, req.body, req.user));
const observeBlueSheet = (req, res) => respond(res, service.observeBlueSheet(req.params.id, req.body, req.user));
const reopenBlueSheet = (req, res) => respond(res, service.reopenBlueSheet(req.params.id, req.body, req.user));
const getBlueSheetVersions = (req, res) => respond(res, service.getBlueSheetVersions(req.params.id, req.user));
const getBlueSheetCompleteness = (req, res) => respond(res, service.getBlueSheetCompleteness(req.params.id, req.user));

// BUYING INFLUENCES
const listBuyingInfluences = (req, res) => respond(res, service.listBuyingInfluences(req.params.blueSheetId, req.user));
const createBuyingInfluence = (req, res) => respond(res, service.createBuyingInfluence(req.params.blueSheetId, req.body, req.user));
const updateBuyingInfluence = (req, res) => respond(res, service.updateBuyingInfluence(req.params.id, req.body, req.user));
const softDeleteBuyingInfluence = (req, res) => respond(res, service.softDeleteBuyingInfluence(req.params.id, req.user));

// WIN-RESULTS
const listWinResults = (req, res) => respond(res, service.listWinResults(req.params.blueSheetId, req.user));
const createWinResult = (req, res) => respond(res, service.createWinResult(req.params.buyingInfluenceId, req.body, req.user));
const updateWinResult = (req, res) => respond(res, service.updateWinResult(req.params.id, req.body, req.user));
const softDeleteWinResult = (req, res) => respond(res, service.softDeleteWinResult(req.params.id, req.user));

// COMPETITORS
const listCompetitors = (req, res) => respond(res, service.listCompetitors(req.params.blueSheetId, req.user));
const createCompetitor = (req, res) => respond(res, service.createCompetitor(req.params.blueSheetId, req.body, req.user));
const updateCompetitor = (req, res) => respond(res, service.updateCompetitor(req.params.id, req.body, req.user));
const softDeleteCompetitor = (req, res) => respond(res, service.softDeleteCompetitor(req.params.id, req.user));

// COMPETITIVE PREFERENCES
const listCompetitivePreferences = (req, res) => respond(res, service.listCompetitivePreferences(req.params.blueSheetId, req.user));
const upsertCompetitivePreference = (req, res) => respond(res, service.upsertCompetitivePreference(req.params.blueSheetId, req.body.buying_influence_id, req.body.competitor_id, req.body, req.user));

// STRENGTHS
const listStrengths = (req, res) => respond(res, service.listStrengths(req.params.blueSheetId, req.user));
const createStrength = (req, res) => respond(res, service.createStrength(req.params.blueSheetId, req.body, req.user));
const updateStrength = (req, res) => respond(res, service.updateStrength(req.params.id, req.body, req.user));
const softDeleteStrength = (req, res) => respond(res, service.softDeleteStrength(req.params.id, req.user));

// RED FLAGS
const listRedFlags = (req, res) => respond(res, service.listRedFlags(req.params.blueSheetId, req.user));
const createRedFlag = (req, res) => respond(res, service.createRedFlag(req.params.blueSheetId, req.body, req.user));
const updateRedFlag = (req, res) => respond(res, service.updateRedFlag(req.params.id, req.body, req.user));
const softDeleteRedFlag = (req, res) => respond(res, service.softDeleteRedFlag(req.params.id, req.user));
const acceptRedFlag = (req, res) => respond(res, service.acceptRedFlag(req.params.id, req.body, req.user));

// SCORECARD
const listScorecardCriteria = (req, res) => respond(res, service.listScorecardCriteria());
const createScorecardCriterion = (req, res) => respond(res, service.createScorecardCriterion(req.body, req.user));
const updateScorecardCriterion = (req, res) => respond(res, service.updateScorecardCriterion(req.params.id, req.body, req.user));
const getBlueSheetScorecard = (req, res) => respond(res, service.getBlueSheetScorecard(req.params.blueSheetId, req.user));
const saveBlueSheetScorecard = (req, res) => respond(res, service.saveBlueSheetScorecard(req.params.blueSheetId, req.body, req.user));

// ACTION ITEMS
const listActionItems = (req, res) => respond(res, service.listActionItems(req.params.blueSheetId, { ...req.query, user: req.user }));
const createActionItem = (req, res) => respond(res, service.createActionItem(req.params.blueSheetId, req.body.opportunity_id, req.body, req.user));
const updateActionItem = (req, res) => respond(res, service.updateActionItem(req.params.id, req.body, req.user));
const completeActionItem = (req, res) => respond(res, service.completeActionItem(req.params.id, req.body, req.user));
const softDeleteActionItem = (req, res) => respond(res, service.softDeleteActionItem(req.params.id, req.user));

// ACTIVITIES
const listActivities = (req, res) => respond(res, service.listActivities({ ...req.query, user: req.user }));
const createActivity = (req, res) => respond(res, service.createActivity(req.body, req.user));
const updateActivity = (req, res) => respond(res, service.updateActivity(req.params.id, req.body, req.user));
const completeActivity = (req, res) => respond(res, service.completeActivity(req.params.id, req.body, req.user));
const softDeleteActivity = (req, res) => respond(res, service.softDeleteActivity(req.params.id, req.user));

// DOCUMENTS
const listDocuments = (req, res) => respond(res, service.listDocuments({ ...req.query, user: req.user }));
const createDocument = (req, res) => respond(res, service.createDocument(req.body, req.user));
const uploadDocumentFile = (req, res) => respond(res, service.uploadDocumentFile({ file: req.file, body: req.body, user: req.user }));
const softDeleteDocument = (req, res) => respond(res, service.softDeleteDocument(req.params.id, req.user));

// NOTES
const listNotes = (req, res) => respond(res, service.listNotes({ ...req.query, user: req.user }));
const createNote = (req, res) => respond(res, service.createNote(req.body, req.user));
const updateNote = (req, res) => respond(res, service.updateNote(req.params.id, req.body, req.user));
const softDeleteNote = (req, res) => respond(res, service.softDeleteNote(req.params.id, req.user));

// LOST REASONS
const listLostReasons = (req, res) => respond(res, service.listLostReasons());
const createLostReason = (req, res) => respond(res, service.createLostReason(req.body, req.user));
const updateLostReason = (req, res) => respond(res, service.updateLostReason(req.params.id, req.body, req.user));

// DASHBOARD / REPORTS
const getDashboardSummary = (req, res) => respond(res, service.getDashboardSummary(req.user));
const getPipelineByStage = (req, res) => respond(res, service.getPipelineByStage(req.user));
const getForecast = (req, res) => respond(res, service.getForecast(req.query, req.user));
const getBlueSheetKpis = (req, res) => respond(res, service.getBlueSheetKpis(req.user));
const getLostReasonsReport = (req, res) => respond(res, service.getLostReasonsReport(req.query, req.user));
const getRedFlagsReport = (req, res) => respond(res, service.getRedFlagsReport(req.query, req.user));

module.exports = {
  listAccounts, getAccountById, createAccount, updateAccount, softDeleteAccount, getAccountTimeline,
  listContacts, getContactById, createContact, updateContact, softDeleteContact,
  listLeads, getLeadById, createLead, updateLead, softDeleteLead, convertLead, disqualifyLead,
  linkLeadAccount, createLeadContact, promoteLeadToOpportunity,
  listPipelineStages, createPipelineStage, updatePipelineStage,
  listOpportunities, getOpportunityById, createOpportunity, updateOpportunity,
  changeOpportunityStage, closeWon, closeLost, suspendOpportunity, getOpportunityHealth, getOpportunityPurchaseStatus, linkPurchaseToOpportunity,
  createBlueSheet, getBlueSheetByOpportunity, getBlueSheetById,
  updateBlueSheetGeneral, updateBlueSheetBuyingProcess, updateBlueSheetStrategy,
  submitBlueSheetForReview, approveBlueSheet, observeBlueSheet, reopenBlueSheet,
  getBlueSheetVersions, getBlueSheetCompleteness,
  listBuyingInfluences, createBuyingInfluence, updateBuyingInfluence, softDeleteBuyingInfluence,
  listWinResults, createWinResult, updateWinResult, softDeleteWinResult,
  listCompetitors, createCompetitor, updateCompetitor, softDeleteCompetitor,
  listCompetitivePreferences, upsertCompetitivePreference,
  listStrengths, createStrength, updateStrength, softDeleteStrength,
  listRedFlags, createRedFlag, updateRedFlag, softDeleteRedFlag, acceptRedFlag,
  listScorecardCriteria, createScorecardCriterion, updateScorecardCriterion,
  getBlueSheetScorecard, saveBlueSheetScorecard,
  listActionItems, createActionItem, updateActionItem, completeActionItem, softDeleteActionItem,
  listActivities, createActivity, updateActivity, completeActivity, softDeleteActivity,
  listDocuments, createDocument, uploadDocumentFile, softDeleteDocument,
  listNotes, createNote, updateNote, softDeleteNote,
  listLostReasons, createLostReason, updateLostReason,
  getDashboardSummary, getPipelineByStage, getForecast, getBlueSheetKpis,
  getLostReasonsReport, getRedFlagsReport,
};
