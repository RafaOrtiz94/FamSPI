const db = require("../../config/db");
const logger = require("../../config/logger");

// Incidents
const createIncident = async ({ incidentType, severity, title, description, location, reportedBy }, client = db) => {
  const q = `INSERT INTO ca0111_incidents (incident_type, severity, title, description, location, reported_by, status) VALUES ($1, $2, $3, $4, $5, $6, 'reported') RETURNING *;`;
  const { rows } = await client.query(q, [incidentType, severity, title, description, location, reportedBy]);
  return rows[0];
};

const listIncidents = async ({ status, severity, incidentType } = {}, client = db) => {
  let q = `SELECT * FROM ca0111_incidents WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (severity) { v.push(severity); q += ` AND severity = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  if (incidentType) { v.push(incidentType); q += ` AND incident_type = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateIncident = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0111_incidents SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

// Containment Actions
const createContainmentAction = async ({ incidentId, actionDescription, responsibleId }, client = db) => {
  const q = `INSERT INTO ca0111_containment_actions (incident_id, action_description, responsible_id, action_status) VALUES ($1, $2, $3, 'pending') RETURNING *;`;
  const { rows } = await client.query(q, [incidentId, actionDescription, responsibleId]);
  return rows[0];
};

const listContainmentActions = async ({ incidentId, actionStatus } = {}, client = db) => {
  let q = `SELECT * FROM ca0111_containment_actions WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (incidentId) { v.push(incidentId); q += ` AND incident_id = $${p++}`; }
  if (actionStatus) { v.push(actionStatus); q += ` AND action_status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateContainmentAction = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0111_containment_actions SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

// Hazardous Materials
const createHazardousMaterial = async ({ incidentId, materialName, quantity, unit, casNumber, hazardClass }, client = db) => {
  const q = `INSERT INTO ca0111_hazardous_materials (incident_id, material_name, quantity, unit, cas_number, hazard_class) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`;
  const { rows } = await client.query(q, [incidentId, materialName, quantity, unit, casNumber, hazardClass]);
  return rows[0];
};

const listHazardousMaterials = async ({ incidentId } = {}, client = db) => {
  let q = `SELECT * FROM ca0111_hazardous_materials WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (incidentId) { v.push(incidentId); q += ` AND incident_id = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

// Affected
const createAffected = async ({ incidentId, affectedType, entityName, description, quantity }, client = db) => {
  const q = `INSERT INTO ca0111_affected (incident_id, affected_type, entity_name, description, quantity) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
  const { rows } = await client.query(q, [incidentId, affectedType, entityName, description, quantity]);
  return rows[0];
};

const listAffected = async ({ incidentId } = {}, client = db) => {
  let q = `SELECT * FROM ca0111_affected WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (incidentId) { v.push(incidentId); q += ` AND incident_id = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

// Cleanup Actions
const createCleanupAction = async ({ incidentId, cleanupDescription, methodUsed, responsibleId }, client = db) => {
  const q = `INSERT INTO ca0111_cleanup_actions (incident_id, cleanup_description, method_used, responsible_id, cleanup_status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *;`;
  const { rows } = await client.query(q, [incidentId, cleanupDescription, methodUsed, responsibleId]);
  return rows[0];
};

const listCleanupActions = async ({ incidentId, cleanupStatus } = {}, client = db) => {
  let q = `SELECT * FROM ca0111_cleanup_actions WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (incidentId) { v.push(incidentId); q += ` AND incident_id = $${p++}`; }
  if (cleanupStatus) { v.push(cleanupStatus); q += ` AND cleanup_status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateCleanupAction = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0111_cleanup_actions SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

module.exports = {
  createIncident, listIncidents, updateIncident,
  createContainmentAction, listContainmentActions, updateContainmentAction,
  createHazardousMaterial, listHazardousMaterials,
  createAffected, listAffected,
  createCleanupAction, listCleanupActions, updateCleanupAction
};