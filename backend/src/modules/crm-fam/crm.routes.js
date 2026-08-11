const express = require("express");
const multer = require("multer");
const router = express.Router();
const controller = require("./crm.controller");
const { requireRole } = require("../../middlewares/roles");

const crmRoles = ['comercial', 'jefe_comercial', 'jefe_de_comercial', 'backoffice_comercial', 'asesor_comercial', 'analista_comercial', 'acp_comercial', 'backoffice'];
const managerRoles = ['jefe_comercial', 'jefe_de_comercial', 'gerencia', 'gerencia_general', 'gerente_general', 'director', 'gerente'];
const crmAll = [...new Set([...crmRoles, ...managerRoles])];
const adminRoles = ['jefe_ti', 'jefe_de_ti', 'admin', 'administrador'];
const allCrm = [...new Set([...crmAll, ...adminRoles])];
const managerAdmin = [...new Set([...managerRoles, ...adminRoles])];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Dashboard / Reports
router.get("/dashboard", requireRole(allCrm), controller.getDashboardSummary);
router.get("/dashboard/pipeline", requireRole(allCrm), controller.getPipelineByStage);
router.get("/dashboard/forecast", requireRole(managerAdmin), controller.getForecast);
router.get("/dashboard/blue-sheet-kpis", requireRole(managerAdmin), controller.getBlueSheetKpis);
router.get("/reports/lost-reasons", requireRole(managerAdmin), controller.getLostReasonsReport);
router.get("/reports/red-flags", requireRole(managerAdmin), controller.getRedFlagsReport);

// Pipeline Stages
router.get("/pipeline-stages", requireRole(allCrm), controller.listPipelineStages);
router.post("/pipeline-stages", requireRole(adminRoles), controller.createPipelineStage);
router.put("/pipeline-stages/:id", requireRole(adminRoles), controller.updatePipelineStage);

// Lost Reasons
router.get("/lost-reasons", requireRole(allCrm), controller.listLostReasons);
router.post("/lost-reasons", requireRole(adminRoles), controller.createLostReason);
router.put("/lost-reasons/:id", requireRole(adminRoles), controller.updateLostReason);

// Scorecard Criteria
router.get("/scorecard-criteria", requireRole(allCrm), controller.listScorecardCriteria);
router.post("/scorecard-criteria", requireRole(adminRoles), controller.createScorecardCriterion);
router.put("/scorecard-criteria/:id", requireRole(adminRoles), controller.updateScorecardCriterion);

// Accounts
router.get("/accounts", requireRole(allCrm), controller.listAccounts);
router.post("/accounts", requireRole(crmAll), controller.createAccount);
router.get("/accounts/:id", requireRole(allCrm), controller.getAccountById);
router.put("/accounts/:id", requireRole(crmAll), controller.updateAccount);
router.delete("/accounts/:id", requireRole(crmAll), controller.softDeleteAccount);
router.get("/accounts/:id/timeline", requireRole(allCrm), controller.getAccountTimeline);

// Contacts
router.get("/contacts", requireRole(allCrm), controller.listContacts);
router.post("/contacts", requireRole(crmAll), controller.createContact);
router.get("/contacts/:id", requireRole(allCrm), controller.getContactById);
router.put("/contacts/:id", requireRole(crmAll), controller.updateContact);
router.delete("/contacts/:id", requireRole(crmAll), controller.softDeleteContact);

// Leads
router.get("/leads", requireRole(allCrm), controller.listLeads);
router.post("/leads", requireRole(crmAll), controller.createLead);
router.get("/leads/:id", requireRole(allCrm), controller.getLeadById);
router.put("/leads/:id", requireRole(crmAll), controller.updateLead);
router.delete("/leads/:id", requireRole(crmAll), controller.softDeleteLead);
router.post("/leads/:id/account", requireRole(crmAll), controller.linkLeadAccount);
router.post("/leads/:id/contact", requireRole(crmAll), controller.createLeadContact);
router.post("/leads/:id/convert", requireRole(crmAll), controller.convertLead);
router.post("/leads/:id/disqualify", requireRole(crmAll), controller.disqualifyLead);
router.post("/leads/:id/promote", requireRole(crmAll), controller.promoteLeadToOpportunity);

// Opportunities
router.get("/opportunities", requireRole(allCrm), controller.listOpportunities);
router.post("/opportunities", requireRole(crmAll), controller.createOpportunity);
router.get("/opportunities/:id", requireRole(allCrm), controller.getOpportunityById);
router.put("/opportunities/:id", requireRole(crmAll), controller.updateOpportunity);
router.get("/opportunities/:id/health", requireRole(allCrm), controller.getOpportunityHealth);
router.get("/opportunities/:id/purchase-status", requireRole(allCrm), controller.getOpportunityPurchaseStatus);
router.post("/opportunities/:id/link-purchase", requireRole(crmAll), controller.linkPurchaseToOpportunity);
router.post("/opportunities/:id/stage", requireRole(crmAll), controller.changeOpportunityStage);
router.post("/opportunities/:id/close-won", requireRole(crmAll), controller.closeWon);
router.post("/opportunities/:id/close-lost", requireRole(crmAll), controller.closeLost);
router.post("/opportunities/:id/suspend", requireRole(crmAll), controller.suspendOpportunity);

// Blue Sheets (under opportunity)
router.get("/opportunities/:opportunityId/blue-sheet", requireRole(allCrm), controller.getBlueSheetByOpportunity);
router.post("/opportunities/:opportunityId/blue-sheet", requireRole(crmAll), controller.createBlueSheet);
router.put("/blue-sheets/:id/general", requireRole(crmAll), controller.updateBlueSheetGeneral);
router.put("/blue-sheets/:id/buying-process", requireRole(crmAll), controller.updateBlueSheetBuyingProcess);
router.put("/blue-sheets/:id/strategy", requireRole(crmAll), controller.updateBlueSheetStrategy);
router.post("/blue-sheets/:id/submit", requireRole(crmAll), controller.submitBlueSheetForReview);
router.post("/blue-sheets/:id/approve", requireRole(managerAdmin), controller.approveBlueSheet);
router.post("/blue-sheets/:id/observe", requireRole(managerAdmin), controller.observeBlueSheet);
router.post("/blue-sheets/:id/reopen", requireRole(managerAdmin), controller.reopenBlueSheet);
router.get("/blue-sheets/:id/versions", requireRole(allCrm), controller.getBlueSheetVersions);
router.get("/blue-sheets/:id/completeness", requireRole(allCrm), controller.getBlueSheetCompleteness);

// Buying Influences
router.get("/blue-sheets/:blueSheetId/buying-influences", requireRole(allCrm), controller.listBuyingInfluences);
router.post("/blue-sheets/:blueSheetId/buying-influences", requireRole(crmAll), controller.createBuyingInfluence);
router.put("/buying-influences/:id", requireRole(crmAll), controller.updateBuyingInfluence);
router.delete("/buying-influences/:id", requireRole(crmAll), controller.softDeleteBuyingInfluence);

// Win-Results
router.get("/blue-sheets/:blueSheetId/win-results", requireRole(allCrm), controller.listWinResults);
router.post("/buying-influences/:buyingInfluenceId/win-results", requireRole(crmAll), controller.createWinResult);
router.put("/win-results/:id", requireRole(crmAll), controller.updateWinResult);
router.delete("/win-results/:id", requireRole(crmAll), controller.softDeleteWinResult);

// Competitors
router.get("/blue-sheets/:blueSheetId/competitors", requireRole(allCrm), controller.listCompetitors);
router.post("/blue-sheets/:blueSheetId/competitors", requireRole(crmAll), controller.createCompetitor);
router.put("/competitors/:id", requireRole(crmAll), controller.updateCompetitor);
router.delete("/competitors/:id", requireRole(crmAll), controller.softDeleteCompetitor);

// Competitive Preferences
router.get("/blue-sheets/:blueSheetId/competitive-preferences", requireRole(allCrm), controller.listCompetitivePreferences);
router.put("/blue-sheets/:blueSheetId/competitive-preferences", requireRole(crmAll), controller.upsertCompetitivePreference);

// Strengths
router.get("/blue-sheets/:blueSheetId/strengths", requireRole(allCrm), controller.listStrengths);
router.post("/blue-sheets/:blueSheetId/strengths", requireRole(crmAll), controller.createStrength);
router.put("/strengths/:id", requireRole(crmAll), controller.updateStrength);
router.delete("/strengths/:id", requireRole(crmAll), controller.softDeleteStrength);

// Red Flags
router.get("/blue-sheets/:blueSheetId/red-flags", requireRole(allCrm), controller.listRedFlags);
router.post("/blue-sheets/:blueSheetId/red-flags", requireRole(crmAll), controller.createRedFlag);
router.put("/red-flags/:id", requireRole(crmAll), controller.updateRedFlag);
router.delete("/red-flags/:id", requireRole(crmAll), controller.softDeleteRedFlag);
router.post("/red-flags/:id/accept", requireRole(managerAdmin), controller.acceptRedFlag);

// Scorecard
router.get("/blue-sheets/:blueSheetId/scorecard", requireRole(allCrm), controller.getBlueSheetScorecard);
router.put("/blue-sheets/:blueSheetId/scorecard", requireRole(crmAll), controller.saveBlueSheetScorecard);

// Action Items
router.get("/blue-sheets/:blueSheetId/action-items", requireRole(allCrm), controller.listActionItems);
router.post("/blue-sheets/:blueSheetId/action-items", requireRole(crmAll), controller.createActionItem);
router.put("/action-items/:id", requireRole(crmAll), controller.updateActionItem);
router.post("/action-items/:id/complete", requireRole(crmAll), controller.completeActionItem);
router.delete("/action-items/:id", requireRole(crmAll), controller.softDeleteActionItem);

// Activities
router.get("/activities", requireRole(allCrm), controller.listActivities);
router.post("/activities", requireRole(crmAll), controller.createActivity);
router.put("/activities/:id", requireRole(crmAll), controller.updateActivity);
router.post("/activities/:id/complete", requireRole(crmAll), controller.completeActivity);
router.delete("/activities/:id", requireRole(crmAll), controller.softDeleteActivity);

// Documents
router.get("/documents", requireRole(allCrm), controller.listDocuments);
router.post("/documents", requireRole(crmAll), controller.createDocument);
router.post("/documents/upload", requireRole(crmAll), upload.single("file"), controller.uploadDocumentFile);
router.delete("/documents/:id", requireRole(crmAll), controller.softDeleteDocument);

// Notes
router.get("/notes", requireRole(allCrm), controller.listNotes);
router.post("/notes", requireRole(crmAll), controller.createNote);
router.put("/notes/:id", requireRole(crmAll), controller.updateNote);
router.delete("/notes/:id", requireRole(crmAll), controller.softDeleteNote);

module.exports = router;
