const sm = require("./ca0115StateMachine.service");
const repo = require("./ca0115.repository");
const normalizeRecord = (r = {}) => ({ ...r, status: sm.normalizeStatus(r.status || sm.INITIAL_STATUS) });
const validateWorkflowTransition = ({ flowName, fromStatus, toStatus }) => { sm.assertTransition({ flowName, fromStatus, toStatus }); return true; };
const transitionWorkflowRecord = async (record, { flowName, toStatus, notes, userId }) => {
  const cur = normalizeRecord(record);
  validateWorkflowTransition({ flowName, fromStatus: cur.status, toStatus });
  return { ...cur, status: sm.normalizeStatus(toStatus), notes: notes || cur.notes, updatedBy: userId };
};
const getDashboardMetrics = async () => {
  const audits = await repo.listAudits();
  return { audits: audits.length, completed: audits.filter(a => a.status === 'completed').length, inProgress: audits.filter(a => a.status === 'in_progress').length };
};
module.exports = { normalizeRecord, transitionWorkflowRecord, validateWorkflowTransition, getDashboardMetrics, repo };