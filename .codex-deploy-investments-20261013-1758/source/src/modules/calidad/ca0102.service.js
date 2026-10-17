const repo = require("./ca0102.repository");
const { applyTransition } = require("./ca0102StateMachine.service");
const logger = require("../../config/logger");

/**
 * Core Service - CA-01-02 (Limpieza de Áreas)
 * Orquesta el repositorio y la state machine, centralizando la lógica GXP.
 */

const registrarLimpieza = async ({ areaId, cleaningType, cleaningAgentUsed, operatorNotes, executedBy }) => {
  const area = await repo.getAreaById(areaId);
  if (!area) {
    const err = new Error(`Área ${areaId} no encontrada o fue dada de baja.`);
    err.status = 404;
    throw err;
  }

  const log = await repo.createCleaningLog({
    areaId,
    cleaningType,
    cleaningAgentUsed,
    operatorNotes,
    executedBy,
  });

  logger.info({ logId: log.id, areaId, cleaningType }, "CA-01-02: Registro de limpieza creado.");
  return log;
};

const transitionLog = async (logId, { toStatus, qaNotes, verifiedBy }) => {
  // Obtener el registro actual
  const { rows } = await require("../../config/db").query(
    `SELECT * FROM public.ca0102_cleaning_logs WHERE id = $1 AND deleted_at IS NULL`,
    [logId]
  );
  const currentLog = rows[0];
  if (!currentLog) {
    const err = new Error(`Registro de limpieza ${logId} no encontrado.`);
    err.status = 404;
    throw err;
  }

  // Validar transición GXP (lanza 400 si ilegal)
  applyTransition(currentLog, toStatus);

  const updated = await repo.updateLogStatus(logId, { status: toStatus, qaNotes, verifiedBy });
  logger.info({ logId, fromStatus: currentLog.status, toStatus }, "CA-01-02: Transición de estado aplicada.");
  return updated;
};

const getActiveLogs = async () => {
  return repo.listActiveCleaningLogs();
};

const getAreas = async ({ riskLevel } = {}) => {
  return repo.listAreas({ riskLevel });
};

module.exports = { registrarLimpieza, transitionLog, getActiveLogs, getAreas };
