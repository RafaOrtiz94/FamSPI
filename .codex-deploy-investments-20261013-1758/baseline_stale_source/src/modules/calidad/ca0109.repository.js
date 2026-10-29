const db = require("../../config/db");
const logger = require("../../config/logger");

const createRca = async ({ sourceType, sourceId, description, severity, rootCause, createdBy }, client = db) => {
  const q = `INSERT INTO ca0109_rca (source_type, source_id, description, severity, root_cause, created_by, status) VALUES ($1, $2, $3, $4, $5, $6, 'open') RETURNING *;`;
  const { rows } = await client.query(q, [sourceType, sourceId, description, severity, rootCause, createdBy]);
  return rows[0];
};

const getRcaById = async (id, client = db) => {
  const { rows } = await client.query(`SELECT * FROM ca0109_rca WHERE id = $1 AND is_deleted = FALSE;`, [id]);
  return rows[0] || null;
};

const listRca = async ({ status, severity, sourceType } = {}, client = db) => {
  let q = `SELECT * FROM ca0109_rca WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  if (severity) { v.push(severity); q += ` AND severity = $${p++}`; }
  if (sourceType) { v.push(sourceType); q += ` AND source_type = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateRca = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0109_rca SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

const createActionPlan = async ({ rcaId, actionDescription, responsibleId, dueDate }, client = db) => {
  const q = `INSERT INTO ca0109_action_plan (rca_id, action_description, responsible_id, due_date, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *;`;
  const { rows } = await client.query(q, [rcaId, actionDescription, responsibleId, dueDate]);
  return rows[0];
};

const listActionPlan = async ({ rcaId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0109_action_plan WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (rcaId) { v.push(rcaId); q += ` AND rca_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateActionPlan = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0109_action_plan SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

const createEscalation = async ({ rcaId, escalationLevel, reason, escalatedTo }, client = db) => {
  const q = `INSERT INTO ca0109_escalation (rca_id, escalation_level, reason, escalated_to, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *;`;
  const { rows } = await client.query(q, [rcaId, escalationLevel, reason, escalatedTo]);
  return rows[0];
};

const listEscalation = async ({ rcaId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0109_escalation WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (rcaId) { v.push(rcaId); q += ` AND rca_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  const { rows } = await client.query(q, v);
  return rows;
};

const createEffectiveness = async ({ actionPlanId, evaluationDate, effectivenessScore, evaluationNotes, followUpRequired, followUpDate, evaluatedBy }, client = db) => {
  const q = `INSERT INTO ca0109_effectiveness (action_plan_id, evaluation_date, effectiveness_score, evaluation_notes, follow_up_required, follow_up_date, evaluated_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`;
  const { rows } = await client.query(q, [actionPlanId, evaluationDate, effectivenessScore, evaluationNotes, followUpRequired, followUpDate, evaluatedBy]);
  return rows[0];
};

const listEffectiveness = async ({ actionPlanId } = {}, client = db) => {
  let q = `SELECT * FROM ca0109_effectiveness WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (actionPlanId) { v.push(actionPlanId); q += ` AND action_plan_id = $${p++}`; }
  const { rows } = await client.query(q, v);
  return rows;
};

module.exports = { createRca, getRcaById, listRca, updateRca, createActionPlan, listActionPlan, updateActionPlan, createEscalation, listEscalation, createEffectiveness, listEffectiveness };