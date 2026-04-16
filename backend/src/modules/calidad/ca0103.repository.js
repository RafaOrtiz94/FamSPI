const db = require("../../config/db");
const logger = require("../../config/logger");

/**
 * Repositorio de Datos - CA-01-03 (Buenas Prácticas)
 * Maneja operaciones CRUD transaccionales, consultas indexadas y soft_delete
 * para preservar auditoría GXP.
 */

// ==================== TRAINING ====================
const createTraining = async ({ employeeId, trainingType, title, description, scheduledDate, instructor, location, durationHours }, client = db) => {
  const query = `
    INSERT INTO ca0103_training (employee_id, training_type, title, description, scheduled_date, instructor, location, duration_hours, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
    RETURNING *;
  `;
  const values = [employeeId, trainingType, title, description, scheduledDate, instructor, location, durationHours];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const getTrainingById = async (id, client = db) => {
  const query = `SELECT * FROM ca0103_training WHERE id = $1 AND is_deleted = FALSE;`;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
};

const listTraining = async ({ employeeId, status, trainingType } = {}, client = db) => {
  let query = `SELECT * FROM ca0103_training WHERE is_deleted = FALSE`;
  const values = [];
  let paramIndex = 1;

  if (employeeId) {
    values.push(employeeId);
    query += ` AND employee_id = $${paramIndex++}`;
  }
  if (status) {
    values.push(status);
    query += ` AND status = $${paramIndex++}`;
  }
  if (trainingType) {
    values.push(trainingType);
    query += ` AND training_type = $${paramIndex++}`;
  }
  query += ` ORDER BY scheduled_date DESC;`;
  const { rows } = await client.query(query, values);
  return rows;
};

const updateTraining = async (id, updates, client = db) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  });

  if (fields.length === 0) return null;

  values.push(id);
  const query = `
    UPDATE ca0103_training SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex++} AND is_deleted = FALSE
    RETURNING *;
  `;
  const { rows } = await client.query(query, values);
  return rows[0];
};

const softDeleteTraining = async (id, deletedBy, client = db) => {
  const query = `
    UPDATE ca0103_training SET deleted_at = NOW(), deleted_by = $2, is_deleted = TRUE
    WHERE id = $1 AND is_deleted = FALSE RETURNING id;
  `;
  const { rows } = await client.query(query, [id, deletedBy]);
  return rows[0] || null;
};

// ==================== EXAMS ====================
const createExam = async ({ trainingId, employeeId, examType, title, description, scheduledDate, passingScore, maxAttempts }, client = db) => {
  const query = `
    INSERT INTO ca0103_exams (training_id, employee_id, exam_type, title, description, scheduled_date, passing_score, max_attempts, result)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    RETURNING *;
  `;
  const values = [trainingId, employeeId, examType, title, description, scheduledDate, passingScore || 70, maxAttempts || 3];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const getExamById = async (id, client = db) => {
  const query = `SELECT * FROM ca0103_exams WHERE id = $1 AND is_deleted = FALSE;`;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
};

const listExams = async ({ employeeId, trainingId, result } = {}, client = db) => {
  let query = `SELECT * FROM ca0103_exams WHERE is_deleted = FALSE`;
  const values = [];
  let paramIndex = 1;

  if (employeeId) {
    values.push(employeeId);
    query += ` AND employee_id = $${paramIndex++}`;
  }
  if (trainingId) {
    values.push(trainingId);
    query += ` AND training_id = $${paramIndex++}`;
  }
  if (result) {
    values.push(result);
    query += ` AND result = $${paramIndex++}`;
  }
  query += ` ORDER BY scheduled_date DESC;`;
  const { rows } = await client.query(query, values);
  return rows;
};

const updateExam = async (id, updates, client = db) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  });

  if (fields.length === 0) return null;

  values.push(id);
  const query = `
    UPDATE ca0103_exams SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex++} AND is_deleted = FALSE
    RETURNING *;
  `;
  const { rows } = await client.query(query, values);
  return rows[0];
};

// ==================== CERTIFICATIONS ====================
const createCertification = async ({ employeeId, certificationType, certificationName, issuingAuthority, issueDate, expiryDate, certificateNumber }, client = db) => {
  const query = `
    INSERT INTO ca0103_certifications (employee_id, certification_type, certification_name, issuing_authority, issue_date, expiry_date, certificate_number, verification_status, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_verification', 'active')
    RETURNING *;
  `;
  const values = [employeeId, certificationType, certificationName, issuingAuthority, issueDate, expiryDate, certificateNumber];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const getCertificationById = async (id, client = db) => {
  const query = `SELECT * FROM ca0103_certifications WHERE id = $1 AND is_deleted = FALSE;`;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
};

const listCertifications = async ({ employeeId, certificationType, status } = {}, client = db) => {
  let query = `SELECT * FROM ca0103_certifications WHERE is_deleted = FALSE`;
  const values = [];
  let paramIndex = 1;

  if (employeeId) {
    values.push(employeeId);
    query += ` AND employee_id = $${paramIndex++}`;
  }
  if (certificationType) {
    values.push(certificationType);
    query += ` AND certification_type = $${paramIndex++}`;
  }
  if (status) {
    values.push(status);
    query += ` AND status = $${paramIndex++}`;
  }
  query += ` ORDER BY issue_date DESC;`;
  const { rows } = await client.query(query, values);
  return rows;
};

const listExpiringCertifications = async (daysAhead = 30, client = db) => {
  const query = `
    SELECT * FROM ca0103_certifications
    WHERE is_deleted = FALSE
      AND status = 'active'
      AND expiry_date IS NOT NULL
      AND expiry_date <= NOW() + ($1 || ' days')::INTERVAL
    ORDER BY expiry_date ASC;
  `;
  const { rows } = await client.query(query, [daysAhead]);
  return rows;
};

const updateCertification = async (id, updates, client = db) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  });

  if (fields.length === 0) return null;

  values.push(id);
  const query = `
    UPDATE ca0103_certifications SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex++} AND is_deleted = FALSE
    RETURNING *;
  `;
  const { rows } = await client.query(query, values);
  return rows[0];
};

// ==================== VIOLATIONS ====================
const createViolation = async ({ employeeId, violationType, description, severity, incidentDate, reportedBy }, client = db) => {
  const query = `
    INSERT INTO ca0103_violations (employee_id, violation_type, description, severity, incident_date, reported_by, investigation_status)
    VALUES ($1, $2, $3, $4, $5, $6, 'open')
    RETURNING *;
  `;
  const values = [employeeId, violationType, description, severity, incidentDate, reportedBy];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const getViolationById = async (id, client = db) => {
  const query = `SELECT * FROM ca0103_violations WHERE id = $1 AND is_deleted = FALSE;`;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
};

const listViolations = async ({ employeeId, violationType, severity, investigationStatus } = {}, client = db) => {
  let query = `SELECT * FROM ca0103_violations WHERE is_deleted = FALSE`;
  const values = [];
  let paramIndex = 1;

  if (employeeId) {
    values.push(employeeId);
    query += ` AND employee_id = $${paramIndex++}`;
  }
  if (violationType) {
    values.push(violationType);
    query += ` AND violation_type = $${paramIndex++}`;
  }
  if (severity) {
    values.push(severity);
    query += ` AND severity = $${paramIndex++}`;
  }
  if (investigationStatus) {
    values.push(investigationStatus);
    query += ` AND investigation_status = $${paramIndex++}`;
  }
  query += ` ORDER BY incident_date DESC;`;
  const { rows } = await client.query(query, values);
  return rows;
};

const updateViolation = async (id, updates, client = db) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  });

  if (fields.length === 0) return null;

  values.push(id);
  const query = `
    UPDATE ca0103_violations SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex++} AND is_deleted = FALSE
    RETURNING *;
  `;
  const { rows } = await client.query(query, values);
  return rows[0];
};

module.exports = {
  createTraining,
  getTrainingById,
  listTraining,
  updateTraining,
  softDeleteTraining,
  createExam,
  getExamById,
  listExams,
  updateExam,
  createCertification,
  getCertificationById,
  listCertifications,
  listExpiringCertifications,
  updateCertification,
  createViolation,
  getViolationById,
  listViolations,
  updateViolation,
};