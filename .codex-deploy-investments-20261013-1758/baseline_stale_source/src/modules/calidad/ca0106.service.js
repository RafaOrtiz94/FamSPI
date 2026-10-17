const stateMachine = require("./ca0106StateMachine.service");
const logger = require("../../config/logger");

/**
 * Service Core - CA-01-06 (Retiro del Mercado/Recall)
 * Orkestra la lógica de estados e auditoría GXP.
 */

const normalizeRecord = (record = {}) => ({
  ...record,
  status: stateMachine.normalizeStatus(record.status || stateMachine.INITIAL_STATUS),
});

const validateWorkflowTransition = ({ flowName, fromStatus, toStatus }) => {
  stateMachine.assertTransition({ flowName, fromStatus, toStatus });
  return true;
};

const transitionWorkflowRecord = async (record, { flowName, toStatus, notes, userId }) => {
  const currentRecord = normalizeRecord(record);
  validateWorkflowTransition({
    flowName,
    fromStatus: currentRecord.status,
    toStatus,
  });

  const updatedRecord = {
    ...currentRecord,
    status: stateMachine.normalizeStatus(toStatus),
    notes: notes || currentRecord.notes || null,
    updatedBy: userId || currentRecord.updatedBy || null,
    updatedAt: new Date().toISOString(),
  };

  logger.info(
    { flowName, recordId: currentRecord.id, fromStatus: currentRecord.status, toStatus: updatedRecord.status, userId },
    "CA-01-06: transición de workflow validada."
  );

  return updatedRecord;
};

const buildWorkflowSnapshot = (record, flowName) => {
  const currentRecord = normalizeRecord(record);
  return {
    flowName: stateMachine.normalizeFlowName(flowName),
    id: currentRecord.id,
    status: currentRecord.status,
    isTerminal: stateMachine.TERMINAL_STATUS.has(currentRecord.status),
    record: currentRecord,
  };
};

module.exports = { buildWorkflowSnapshot, normalizeRecord, transitionWorkflowRecord, validateWorkflowTransition };