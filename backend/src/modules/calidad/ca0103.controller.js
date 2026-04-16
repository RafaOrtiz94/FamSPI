const Joi = require("joi");
const service = require("./ca0103.service");
const repository = require("./ca0103.repository");
const logger = require("../../config/logger");

/**
 * Controller - CA-01-03 (Buenas Prácticas)
 * -----------------------------------------
 * Capa HTTP con validación estricta para los flujos training, exams,
 * certifications y violations. Integra repositorio para persistencia GXP.
 */

const TRAINING_TYPES = ['induction', 'on_the_job', 'safety', 'technical', 'gmp', 'refresh'];
const TRAINING_STATUS = ['scheduled', 'in_progress', 'completed', 'cancelled', 'failed'];
const EXAM_TYPES = ['written', 'practical', 'oral', 'online', 'certification'];
const EXAM_RESULTS = ['passed', 'failed', 'pending', 'absent'];
const CERTIFICATION_TYPES = ['gmp', 'safety', 'technical', 'quality', 'regulatory', 'specialty'];
const CERTIFICATION_STATUS = ['active', 'expired', 'revoked', 'pending_renewal'];
const VERIFICATION_STATUS = ['valid', 'expired', 'revoked', 'pending_verification'];
const VIOLATION_TYPES = ['attendance', 'conduct', 'certification', 'safety', 'policy', 'other'];
const VIOLATION_SEVERITY = ['minor', 'major', 'critical'];
const INVESTIGATION_STATUS = ['open', 'investigating', 'resolved', 'closed', 'appeal'];

// ============ TRAINING ============
const trainingSchema = Joi.object({
  employeeId: Joi.string().uuid().required(),
  trainingType: Joi.string().valid(...TRAINING_TYPES).required(),
  title: Joi.string().max(255).required(),
  description: Joi.string().allow('', null),
  scheduledDate: Joi.date().iso().required(),
  instructor: Joi.string().allow('', null),
  location: Joi.string().allow('', null),
  durationHours: Joi.number().positive().allow(null),
});

const createTraining = async (req, res, next) => {
  try {
    const { error, value } = trainingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const result = await repository.createTraining(value);
    logger.info({ trainingId: result.id }, "CA-01-03: Training created");
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-03 createTraining error");
    next(err);
  }
};

const listTraining = async (req, res, next) => {
  try {
    const { employeeId, status, trainingType } = req.query;
    const results = await repository.listTraining({ employeeId, status, trainingType });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "CA-01-03 listTraining error");
    next(err);
  }
};

const getTraining = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await repository.getTrainingById(id);
    if (!result) {
      return res.status(404).json({ ok: false, message: "Training not found" });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-03 getTraining error");
    next(err);
  }
};

const updateTraining = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedFields = ['title', 'description', 'scheduledDate', 'completedDate', 'instructor', 'location', 'durationHours', 'status', 'certificateUrl', 'evaluationScore', 'notes'];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const result = await repository.updateTraining(id, updates);
    if (!result) {
      return res.status(404).json({ ok: false, message: "Training not found or already deleted" });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-03 updateTraining error");
    next(err);
  }
};

// ============ EXAMS ============
const examSchema = Joi.object({
  trainingId: Joi.string().uuid().allow(null),
  employeeId: Joi.string().uuid().required(),
  examType: Joi.string().valid(...EXAM_TYPES).required(),
  title: Joi.string().max(255).required(),
  description: Joi.string().allow('', null),
  scheduledDate: Joi.date().iso().required(),
  passingScore: Joi.number().min(0).max(100).default(70),
  maxAttempts: Joi.number().integer().min(1).default(3),
});

const createExam = async (req, res, next) => {
  try {
    const { error, value } = examSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const result = await repository.createExam(value);
    logger.info({ examId: result.id }, "CA-01-03: Exam created");
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-03 createExam error");
    next(err);
  }
};

const listExams = async (req, res, next) => {
  try {
    const { employeeId, trainingId, result } = req.query;
    const results = await repository.listExams({ employeeId, trainingId, result });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "CA-01-03 listExams error");
    next(err);
  }
};

// ============ CERTIFICATIONS ============
const certificationSchema = Joi.object({
  employeeId: Joi.string().uuid().required(),
  certificationType: Joi.string().valid(...CERTIFICATION_TYPES).required(),
  certificationName: Joi.string().max(255).required(),
  issuingAuthority: Joi.string().allow('', null),
  issueDate: Joi.date().iso().required(),
  expiryDate: Joi.date().iso().allow(null),
  certificateNumber: Joi.string().allow('', null),
});

const createCertification = async (req, res, next) => {
  try {
    const { error, value } = certificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const result = await repository.createCertification(value);
    logger.info({ certificationId: result.id }, "CA-01-03: Certification created");
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-03 createCertification error");
    next(err);
  }
};

const listCertifications = async (req, res, next) => {
  try {
    const { employeeId, certificationType, status } = req.query;
    const results = await repository.listCertifications({ employeeId, certificationType, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "CA-01-03 listCertifications error");
    next(err);
  }
};

const listExpiringCertifications = async (req, res, next) => {
  try {
    const { days } = req.query;
    const results = await repository.listExpiringCertifications(parseInt(days) || 30);
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "CA-01-03 listExpiringCertifications error");
    next(err);
  }
};

// ============ VIOLATIONS ============
const violationSchema = Joi.object({
  employeeId: Joi.string().uuid().required(),
  violationType: Joi.string().valid(...VIOLATION_TYPES).required(),
  description: Joi.string().required(),
  severity: Joi.string().valid(...VIOLATION_SEVERITY).required(),
  incidentDate: Joi.date().iso().required(),
  reportedBy: Joi.string().uuid().allow(null),
});

const createViolation = async (req, res, next) => {
  try {
    const { error, value } = violationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const result = await repository.createViolation(value);
    logger.info({ violationId: result.id }, "CA-01-03: Violation created");
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-03 createViolation error");
    next(err);
  }
};

const listViolations = async (req, res, next) => {
  try {
    const { employeeId, violationType, severity, investigationStatus } = req.query;
    const results = await repository.listViolations({ employeeId, violationType, severity, investigationStatus });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "CA-01-03 listViolations error");
    next(err);
  }
};

const updateViolation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedFields = ['resolutionNotes', 'correctiveAction', 'disciplinaryAction', 'suspensionStartDate', 'suspensionEndDate', 'investigationStatus'];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const result = await repository.updateViolation(id, updates);
    if (!result) {
      return res.status(404).json({ ok: false, message: "Violation not found or already deleted" });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "CA-01-03 updateViolation error");
    next(err);
  }
};

// ============ LEGACY: Snapshot & Transition (mantiene compatibilidad) ============
const FLOW_NAMES = ["training", "exams", "certifications"];
const FLOW_STATES = ["draft", "review", "approved", "archived"];

const snapshotSchema = Joi.object({
  flowName: Joi.string().valid(...FLOW_NAMES).required(),
  record: Joi.object({
    id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
    status: Joi.string().valid(...FLOW_STATES).optional(),
    notes: Joi.string().allow("", null).optional(),
    updatedBy: Joi.alternatives(Joi.string(), Joi.number()).optional(),
    updatedAt: Joi.date().iso().optional(),
  }).required(),
});

const buildSnapshot = async (req, res, next) => {
  try {
    const { error, value } = snapshotSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const snapshot = service.buildWorkflowSnapshot(value.record, value.flowName);
    return res.status(200).json({ ok: true, data: snapshot });
  } catch (err) {
    logger.error({ err }, "CA-01-03 buildSnapshot error");
    next(err);
  }
};

const transitionRecord = async (req, res, next) => {
  try {
    const Joi = require("joi");
    const transitionSchema = Joi.object({
      flowName: Joi.string().valid(...FLOW_NAMES).required(),
      record: Joi.object({
        id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
        status: Joi.string().valid(...FLOW_STATES).required(),
        notes: Joi.string().allow("", null).optional(),
        updatedBy: Joi.alternatives(Joi.string(), Joi.number()).optional(),
        updatedAt: Joi.date().iso().optional(),
      }).required(),
      toStatus: Joi.string().valid(...FLOW_STATES).required(),
      notes: Joi.string().allow("", null).optional(),
    });

    const { error, value } = transitionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    const userId = req.user?.id || req.user?.uid || null;
    const result = await service.transitionWorkflowRecord(value.record, {
      flowName: value.flowName,
      toStatus: value.toStatus,
      notes: value.notes,
      userId,
    });

    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    if (err.status) {
      logger.warn({ err }, "CA-01-03 transition blocked by state machine.");
      return res.status(err.status).json({ ok: false, message: err.message, code: err.code });
    }

    logger.error({ err }, "CA-01-03 transitionRecord error");
    next(err);
  }
};

const validateTransition = async (req, res, next) => {
  try {
    const Joi = require("joi");
    const transitionSchema = Joi.object({
      flowName: Joi.string().valid(...FLOW_NAMES).required(),
      record: Joi.object({
        id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
        status: Joi.string().valid(...FLOW_STATES).required(),
        notes: Joi.string().allow("", null).optional(),
        updatedBy: Joi.alternatives(Joi.string(), Joi.number()).optional(),
        updatedAt: Joi.date().iso().optional(),
      }).required(),
      toStatus: Joi.string().valid(...FLOW_STATES).required(),
      notes: Joi.string().allow("", null).optional(),
    });

    const { error, value } = transitionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.details[0].message });
    }

    service.validateWorkflowTransition({
      flowName: value.flowName,
      fromStatus: value.record.status,
      toStatus: value.toStatus,
    });

    return res.status(200).json({ ok: true, data: { allowed: true } });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, message: err.message, code: err.code });
    }

    next(err);
  }
};

module.exports = {
  createTraining,
  getTraining,
  listTraining,
  updateTraining,
  createExam,
  listExams,
  createCertification,
  listCertifications,
  listExpiringCertifications,
  createViolation,
  listViolations,
  updateViolation,
  buildSnapshot,
  transitionRecord,
  validateTransition,
};