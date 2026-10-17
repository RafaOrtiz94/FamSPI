const repository = require("./ca0101.repository");
const stateMachine = require("./ca0101StateMachine.service");
const logger = require("../../config/logger");

/**
 * Service Core - CA-01-01 (Control de Temperatura)
 * ------------------------------------------------------------------
 * Orquesta State Machines y Operaciones Repositorio. Inyecta auditoría
 * GXP limitando el cruce de fronteras lógicas para alarmas y lecturas.
 */

/**
 * Registra una lectura termohigrométrica y autodetecta desviaciones.
 */
const registerReading = async (payload) => {
  const { deviceId, temperature, humidity, recordedAt, userId } = payload;
  
  // Regla de Negocio: Conservación Térmica (Refrigerados 2.0C - 8.0C)
  // En producción real, estos thresholds vendrían de `ca0101_devices`.
  const isOutOfRange = temperature < 2.0 || temperature > 8.0;

  const reading = await repository.createReading({
    deviceId,
    temperature,
    humidity,
    recordedAt,
    isOutOfRange,
    userId,
  });

  logger.info({ deviceId, temperature, isOutOfRange }, "Lectura GXP CA-01-01 registrada.");

  // Si hay una excursión térmica, el sistema levanta una Alarma/Desviación forzosa.
  if (isOutOfRange) {
    await repository.createAlarm({
      readingId: reading.id,
      alarmType: "TEMPERATURE_EXCURSION",
      notes: `Excursión térmica sistémica (Fuera de rango 2-8°C). Valor reportado: ${temperature}°C. Requiere investigación inmediata.`,
    });
    logger.warn({ readingId: reading.id, temperature }, "ALERTA CA-01-01: Excursión Térmica. Alarma generada.");
  }

  return reading;
};

/**
 * Gestiona el avance de estado de una Desviación/Alarma Térmica.
 * Protegido estrictamente por la State Machine.
 */
const transitionAlarm = async (alarmId, { toStatus, notes, userId }) => {
  // 1. Snapshot Actual
  const alarms = await repository.listActiveAlarms();
  const currentAlarm = alarms.find(a => a.id === alarmId);
  if (!currentAlarm) {
    const err = new Error("Registro de Alarma GXP no encontrado o inactivo.");
    err.status = 404;
    throw err;
  }

  // 2. State Machine Assertion (ISO 9001 Bloqueo)
  stateMachine.assertTransition({
    fromStatus: currentAlarm.status,
    toStatus: toStatus,
  });

  // 3. Ejecución Repositorio
  const updated = await repository.updateAlarmStatus(alarmId, {
    status: toStatus,
    notes,
    resolvedByUserId: userId 
  });

  logger.info({ alarmId, from: currentAlarm.status, to: toStatus, userId }, "Transición de Alarma CA-01-01 ejecutada con éxito.");
  return updated;
};

module.exports = {
  getDevice: repository.getDeviceById,
  registerDevice: repository.createDevice,
  listDevices: repository.listDevices,
  disableDevice: repository.softDeleteDevice,
  registerReading,
  listReadings: repository.listReadingsByDevice,
  transitionAlarm,
  listActiveAlarms: repository.listActiveAlarms,
};
