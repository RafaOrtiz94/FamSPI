const db = require("../../config/db");
const logger = require("../../config/logger");

const createFmea = async ({ processName, failureMode, severityScore, occurrenceScore, detectionScore, riskLevel, createdBy }, client = db) => {
  const q = `INSERT INTO ca0110_fmea_matrix (process_name, failure_mode, severity_score, occurrence_score, detection_score, risk_level, created_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING *;`;
  const { rows } = await client.query(q, [processName, failureMode, severityScore, occurrenceScore, detectionScore, riskLevel, createdBy]);
  return rows[0];
};

const listFmea = async ({ riskLevel, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0110_fmea_matrix WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (riskLevel) { v.push(riskLevel); q += ` AND risk_level = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY rpn DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateFmea = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0110_fmea_matrix SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

const createMitigation = async ({ fmeaId, mitigationAction, responsibleId, targetDate }, client = db) => {
  const q = `INSERT INTO ca0110_mitigation (fmea_id, mitigation_action, responsible_id, target_date, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *;`;
  const { rows } = await client.query(q, [fmeaId, mitigationAction, responsibleId, targetDate]);
  return rows[0];
};

const listMitigation = async ({ fmeaId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0110_mitigation WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (fmeaId) { v.push(fmeaId); q += ` AND fmea_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateMitigation = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0110_mitigation SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

const createReview = async ({ reviewType, reviewDate, participants, conclusions, actionItems, createdBy }, client = db) => {
  const q = `INSERT INTO ca0110_reviews (review_type, review_date, participants, conclusions, action_items, created_by, status) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled') RETURNING *;`;
  const { rows } = await client.query(q, [reviewType, reviewDate, JSON.stringify(participants), conclusions, JSON.stringify(actionItems), createdBy]);
  return rows[0];
};

const listReviews = async ({ reviewType, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0110_reviews WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (reviewType) { v.push(reviewType); q += ` AND review_type = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY review_date DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const createImpactAssessment = async ({ riskId, impactType, description, probability, impactScore, mitigationPlan, assessedBy }, client = db) => {
  const q = `INSERT INTO ca0110_impact_assessment (risk_id, impact_type, description, probability, impact_score, mitigation_plan, assessed_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft') RETURNING *;`;
  const { rows } = await client.query(q, [riskId, impactType, description, probability, impactScore, mitigationPlan, assessedBy]);
  return rows[0];
};

const listImpactAssessment = async ({ riskId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0110_impact_assessment WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (riskId) { v.push(riskId); q += ` AND risk_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY overall_risk DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

module.exports = { createFmea, listFmea, updateFmea, createMitigation, listMitigation, updateMitigation, createReview, listReviews, createImpactAssessment, listImpactAssessment };