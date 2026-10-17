const sm = require("./ca0113StateMachine.service");
const logger = require("../../config/logger");
const repo = require("./ca0113.repository");

const normalizeRecord = (r = {}) => ({ ...r, status: sm.normalizeStatus(r.status || sm.INITIAL_STATUS) });

const validateWorkflowTransition = ({ flowName, fromStatus, toStatus }) => {
  sm.assertTransition({ flowName, fromStatus, toStatus });
  return true;
};

const transitionWorkflowRecord = async (record, { flowName, toStatus, notes, userId }) => {
  const cur = normalizeRecord(record);
  validateWorkflowTransition({ flowName, fromStatus: cur.status, toStatus });
  const upd = { ...cur, status: sm.normalizeStatus(toStatus), notes: notes || cur.notes, updatedBy: userId, updatedAt: new Date().toISOString() };
  logger.info({ flowName, recordId: cur.id, fromStatus: cur.status, toStatus: upd.status }, "CA-01-13: transición validada.");
  return upd;
};

const buildWorkflowSnapshot = (record, flowName) => {
  const cur = normalizeRecord(record);
  return { flowName: sm.normalizeFlowName(flowName), id: cur.id, status: cur.status, isTerminal: sm.TERMINAL_STATUS.has(cur.status), record: cur };
};

const getDashboardMetrics = async () => {
  const communications = await repo.listCommunications();
  const templates = await repo.listTemplates();
  const readLogs = await repo.listReadLogs();
  return {
    communications: communications.length,
    templates: templates.length,
    totalReads: readLogs.length,
    published: communications.filter(c => c.status === 'published').length,
    pending: communications.filter(c => c.status === 'pending').length
  };
};

module.exports = { buildWorkflowSnapshot, normalizeRecord, transitionWorkflowRecord, validateWorkflowTransition, getDashboardMetrics, repo };