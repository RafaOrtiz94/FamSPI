const stateMachine = require("./ca0103StateMachine.service");
const logger = require("../../config/logger");

/**
 * Service Core - CA-01-03 (Buenas Prácticas)
 * ------------------------------------------
 * Orquesta la lógica de estados para training, exams y certifications.
 * La persistencia todavía no está acoplada en esta iteración; el objetivo
 * de esta micro-tarea es dejar la capa core preparada para integrar
 * repositorio y auditoría GXP en el siguiente paso.
 */

const normalizeRecord = (record = {}) => ({
  ...record,
  status: stateMachine.normalizeStatus(record.status || stateMachine.INITIAL_STATUS),
});

const validateWorkflowTransition = ({ flowName, fromStatus, toStatus }) => {
  stateMachine.assertTransition({
    flowName,
    fromStatus,
    toStatus,
  });

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
    {
      flowName,
      recordId: currentRecord.id || null,
      fromStatus: currentRecord.status,
      toStatus: updatedRecord.status,
      userId: userId || null,
    },
    "CA-01-03: transicion de workflow validada."
  );

  return updatedRecord;
};

const buildWorkflowSnapshot = (record, flowName) => {
  const currentRecord = normalizeRecord(record);
  return {
    flowName: stateMachine.normalizeFlowName(flowName),
    id: currentRecord.id || null,
    status: currentRecord.status,
    isTerminal: stateMachine.TERMINAL_STATUS.has(currentRecord.status),
    record: currentRecord,
  };
};

module.exports = {
  buildWorkflowSnapshot,
  normalizeRecord,
  transitionWorkflowRecord,
  validateWorkflowTransition,
};
