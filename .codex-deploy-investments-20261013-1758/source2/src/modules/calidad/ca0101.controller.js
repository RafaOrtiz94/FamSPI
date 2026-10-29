const Joi = require("joi");
const ca0101Service = require("./ca0101.service");
const logger = require("../../config/logger");

/**
 * Controller - CA-01-01 (Control de Temperatura)
 * -------------------------------------------------------------
 * Interfaz HTTP (Edge). Protege contra payloads inválidos antes
 * de comprometer la capa de negocio ISO 9001. Parseo estricto.
 */

const registerReadingSchema = Joi.object({
  deviceId: Joi.string().uuid().required(),
  temperature: Joi.number().min(-100).max(100).required(),
  humidity: Joi.number().min(0).max(100).optional(),
  recordedAt: Joi.date().iso().required(),
});

const transitionAlarmSchema = Joi.object({
  toStatus: Joi.string().valid("acknowledged", "resolved", "closed").required(),
  notes: Joi.string().allow(null, "").optional(),
});

/**
 * Registra una lectura y autogestiona el impacto (Excursión térmica).
 */
const registerReading = async (req, res, next) => {
  try {
    const { error, value } = registerReadingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const userId = req.user?.id || req.user?.uid; // Extraído por authMiddleware
    const result = await ca0101Service.registerReading({ ...value, userId });
    
    res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error endpoint CA-01-01: registerReading");
    next(err);
  }
};

/**
 * Escala o resuelve una desviación (Alarma GXP)
 */
const transitionAlarm = async (req, res, next) => {
  try {
    const { alarmId } = req.params;
    if (!alarmId) {
      return res.status(400).json({ ok: false, message: "ID de Alarma es mandatorio en path." });
    }

    const { error, value } = transitionAlarmSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const userId = req.user?.id || req.user?.uid;
    const result = await ca0101Service.transitionAlarm(alarmId, { ...value, userId });
    
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    // Interceptar aserciones del State Machine y mapearlas al HTTP Layer (4xx)
    if (err.status) {
      logger.warn({ err }, "Intento fallido de transición CA-01-01 bloqueado.");
      return res.status(err.status).json({ ok: false, message: err.message, code: err.code });
    }
    logger.error({ err }, "Error endpoint CA-01-01: transitionAlarm");
    next(err);
  }
};

/**
 * Lista el dashboard operativo (alarmas abiertas/escaladas).
 */
const getActiveAlarms = async (req, res, next) => {
  try {
    const alarms = await ca0101Service.listActiveAlarms();
    res.status(200).json({ ok: true, data: alarms });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerReading,
  transitionAlarm,
  getActiveAlarms,
};
