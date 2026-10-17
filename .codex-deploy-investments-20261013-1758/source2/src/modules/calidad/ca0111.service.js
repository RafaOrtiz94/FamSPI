const sm = require("./ca0111StateMachine.service");
const logger = require("../../config/logger");
const repo = require("./ca0111.repository");

const normalizeRecord = (r = {}) => ({ ...r, status: sm.normalizeStatus(r.status || sm.INITIAL_STATUS) });

const validateWorkflowTransition = ({ flowName, fromStatus, toStatus }) => {
  sm.assertTransition({ flowName, fromStatus, toStatus });
  return true;
};

const transitionWorkflowRecord = async (record, { flowName, toStatus, notes, userId }) => {
  const cur = normalizeRecord(record);
  validateWorkflowTransition({ flowName, fromStatus: cur.status, toStatus });
  const upd = { ...cur, status: sm.normalizeStatus(toStatus), notes: notes || cur.notes, updatedBy: userId, updatedAt: new Date().toISOString() };
  logger.info({ flowName, recordId: cur.id, fromStatus: cur.status, toStatus: upd.status }, "CA-01-11: transición validada.");
  return upd;
};

const buildWorkflowSnapshot = (record, flowName) => {
  const cur = normalizeRecord(record);
  return { flowName: sm.normalizeFlowName(flowName), id: cur.id, status: cur.status, isTerminal: sm.TERMINAL_STATUS.has(cur.status), record: cur };
};

const getDashboardMetrics = async () => {
  const incidents = await repo.listIncidents();
  const containments = await repo.listContainmentActions();
  const cleanups = await repo.listCleanupActions();
  const hazardous = await repo.listHazardousMaterials();
  return {
    incidents: incidents.length,
    containments: containments.length,
    cleanups: cleanups.length,
    hazardousMaterials: hazardous.length,
    critical: incidents.filter(i => i.severity === 'critical').length
  };
};

module.exports = { buildWorkflowSnapshot, normalizeRecord, transitionWorkflowRecord, validateWorkflowTransition, getDashboardMetrics, repo };