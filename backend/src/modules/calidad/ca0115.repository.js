const db = require("../../config/db");

const createAudit = async ({ auditNumber, auditType, scope, standard, plannedStartDate, plannedEndDate, leadAuditorId, teamMembers }, client = db) => {
  const q = `INSERT INTO ca0115_audits (audit_number, audit_type, scope, standard, planned_start_date, planned_end_date, lead_auditor_id, team_members, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'planned') RETURNING *;`;
  const { rows } = await client.query(q, [auditNumber, auditType, scope, standard, plannedStartDate, plannedEndDate, leadAuditorId, JSON.stringify(teamMembers)]);
  return rows[0];
};

const listAudits = async ({ auditType, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0115_audits WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (auditType) { v.push(auditType); q += ` AND audit_type = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY planned_start_date DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateAudit = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0115_audits SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

const createFinding = async ({ auditId, findingNumber, findingType, description, areaAffected, clauseReference }, client = db) => {
  const q = `INSERT INTO ca0115_findings (audit_id, finding_number, finding_type, description, area_affected, clause_reference, status) VALUES ($1, $2, $3, $4, $5, $6, 'open') RETURNING *;`;
  const { rows } = await client.query(q, [auditId, findingNumber, findingType, description, areaAffected, clauseReference]);
  return rows[0];
};

const listFindings = async ({ auditId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0115_findings WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (auditId) { v.push(auditId); q += ` AND audit_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const createEvidence = async ({ auditId, findingId, evidenceType, description, fileUrl, uploadedBy }, client = db) => {
  const q = `INSERT INTO ca0115_evidences (audit_id, finding_id, evidence_type, description, file_url, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`;
  const { rows } = await client.query(q, [auditId, findingId, evidenceType, description, fileUrl, uploadedBy]);
  return rows[0];
};

const createChecklist = async ({ auditId, clauseCode, questionText, response, evidenceRef }, client = db) => {
  const q = `INSERT INTO ca0115_checklists (audit_id, clause_code, question_text, response, evidence_ref) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
  const { rows } = await client.query(q, [auditId, clauseCode, questionText, response, evidenceRef]);
  return rows[0];
};

const listChecklists = async ({ auditId }, client = db) => {
  let q = `SELECT * FROM ca0115_checklists WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (auditId) { v.push(auditId); q += ` AND audit_id = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const createFollowUp = async ({ auditId, findingId, followUpDate, description }, client = db) => {
  const q = `INSERT INTO ca0115_follow_ups (audit_id, finding_id, follow_up_date, description) VALUES ($1, $2, $3, $4) RETURNING *;`;
  const { rows } = await client.query(q, [auditId, findingId, followUpDate, description]);
  return rows[0];
};

module.exports = { createAudit, listAudits, updateAudit, createFinding, listFindings, createEvidence, createChecklist, listChecklists, createFollowUp };