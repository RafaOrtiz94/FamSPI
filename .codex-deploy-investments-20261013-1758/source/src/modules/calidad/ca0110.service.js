const sm = require("./ca0110StateMachine.service");
const logger = require("../../config/logger");
const repo = require("./ca0110.repository");

const normalizeRecord = (r = {}) => ({ ...r, status: sm.normalizeStatus(r.status || sm.INITIAL_STATUS) });

const validateWorkflowTransition = ({ flowName, fromStatus, toStatus }) => {
  sm.assertTransition({ flowName, fromStatus, toStatus });
  return true;
};

const transitionWorkflowRecord = async (record, { flowName, toStatus, notes, userId }) => {
  const cur = normalizeRecord(record);
  validateWorkflowTransition({ flowName, fromStatus: cur.status, toStatus });
  const upd = { ...cur, status: sm.normalizeStatus(toStatus), notes: notes || cur.notes, updatedBy: userId, updatedAt: new Date().toISOString() };
  logger.info({ flowName, recordId: cur.id, fromStatus: cur.status, toStatus: upd.status }, "CA-01-10: transición validada.");
  return upd;
};

const buildWorkflowSnapshot = (record, flowName) => {
  const cur = normalizeRecord(record);
  return { flowName: sm.normalizeFlowName(flowName), id: cur.id, status: cur.status, isTerminal: sm.TERMINAL_STATUS.has(cur.status), record: cur };
};

const calculateRPN = (severity, occurrence, detection) => severity * occurrence * detection;

const createFmeaWithRPN = async (data, client) => {
  const rpn = calculateRPN(data.severityScore, data.occurrenceScore, data.detectionScore);
  return repo.createFmea({ ...data, riskLevel: rpn }, client);
};

const getDashboardMetrics = async () => {
  const fmeas = await repo.listFmea();
  const mitigations = await repo.listMitigation();
  const reviews = await repo.listReviews();
  const impacts = await repo.listImpactAssessment();
  return { fmeas: fmeas.length, mitigations: mitigations.length, reviews: reviews.length, impacts: impacts.length };
};

module.exports = { buildWorkflowSnapshot, normalizeRecord, transitionWorkflowRecord, validateWorkflowTransition, calculateRPN, createFmeaWithRPN, getDashboardMetrics, repo };