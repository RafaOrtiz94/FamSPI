const db = require("../../config/db");
const logger = require("../../config/logger");

// Hygiene Evaluations
const createEvaluation = async ({ employeeId, evaluationDate, hygieneArea, evaluationType, result, observations, evaluatedBy }, client = db) => {
  const q = `INSERT INTO ca0112_hygiene_evaluations (employee_id, evaluation_date, hygiene_area, evaluation_type, result, observations, evaluated_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *;`;
  const { rows } = await client.query(q, [employeeId, evaluationDate, hygieneArea, evaluationType, result, observations, evaluatedBy]);
  return rows[0];
};

const listEvaluations = async ({ employeeId, result, evaluationType } = {}, client = db) => {
  let q = `SELECT * FROM ca0112_hygiene_evaluations WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (employeeId) { v.push(employeeId); q += ` AND employee_id = $${p++}`; }
  if (result) { v.push(result); q += ` AND result = $${p++}`; }
  if (evaluationType) { v.push(evaluationType); q += ` AND evaluation_type = $${p++}`; }
  q += ` ORDER BY evaluation_date DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateEvaluation = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0112_hygiene_evaluations SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

// Practice Verifications
const createPracticeVerification = async ({ evaluationId, practiceName, practiceCode, isComplied, severity, notes }, client = db) => {
  const q = `INSERT INTO ca0112_practice_verifications (evaluation_id, practice_name, practice_code, is_complied, severity, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`;
  const { rows } = await client.query(q, [evaluationId, practiceName, practiceCode, isComplied, severity, notes]);
  return rows[0];
};

const listPracticeVerifications = async ({ evaluationId } = {}, client = db) => {
  let q = `SELECT * FROM ca0112_practice_verifications WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (evaluationId) { v.push(evaluationId); q += ` AND evaluation_id = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

// Non-compliances
const createNonCompliance = async ({ evaluationId, practiceId, description, nonComplianceType, correctiveAction }, client = db) => {
  const q = `INSERT INTO ca0112_non_compliances (evaluation_id, practice_id, description, non_compliance_type, corrective_action, status) VALUES ($1, $2, $3, $4, $5, 'open') RETURNING *;`;
  const { rows } = await client.query(q, [evaluationId, practiceId, description, nonComplianceType, correctiveAction]);
  return rows[0];
};

const listNonCompliances = async ({ evaluationId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0112_non_compliances WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (evaluationId) { v.push(evaluationId); q += ` AND evaluation_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateNonCompliance = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0112_non_compliances SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

// PPE Checks
const createPpeCheck = async ({ evaluationId, ppeType, isUsed, condition, notes }, client = db) => {
  const q = `INSERT INTO ca0112_ppe_checks (evaluation_id, ppe_type, is_used, condition, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
  const { rows } = await client.query(q, [evaluationId, ppeType, isUsed, condition, notes]);
  return rows[0];
};

const listPpeChecks = async ({ evaluationId } = {}, client = db) => {
  let q = `SELECT * FROM ca0112_ppe_checks WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (evaluationId) { v.push(evaluationId); q += ` AND evaluation_id = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

// Trainings
const createTraining = async ({ employeeId, trainingType, trainingDate, trainerId, durationHours, result, certificateUrl, validityDate }, client = db) => {
  const q = `INSERT INTO ca0112_trainings (employee_id, training_type, training_date, trainer_id, duration_hours, result, certificate_url, validity_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;`;
  const { rows } = await client.query(q, [employeeId, trainingType, trainingDate, trainerId, durationHours, result, certificateUrl, validityDate]);
  return rows[0];
};

const listTrainings = async ({ employeeId, result } = {}, client = db) => {
  let q = `SELECT * FROM ca0112_trainings WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (employeeId) { v.push(employeeId); q += ` AND employee_id = $${p++}`; }
  if (result) { v.push(result); q += ` AND result = $${p++}`; }
  q += ` ORDER BY training_date DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

module.exports = {
  createEvaluation, listEvaluations, updateEvaluation,
  createPracticeVerification, listPracticeVerifications,
  createNonCompliance, listNonCompliances, updateNonCompliance,
  createPpeCheck, listPpeChecks,
  createTraining, listTrainings
};