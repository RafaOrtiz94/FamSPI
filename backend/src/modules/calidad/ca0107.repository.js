const db = require("../../config/db");
const logger = require("../../config/logger");

const createIntake = async ({ complaintType, subject, description, reporterName, reporterEmail, reporterPhone, orderId, productId, priority }, client = db) => {
  const q = `INSERT INTO ca0107_intake_form (complaint_type, subject, description, reporter_name, reporter_email, reporter_phone, order_id, product_id, priority, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted') RETURNING *;`;
  const v = [complaintType, subject, description, reporterName, reporterEmail, reporterPhone, orderId, productId, priority];
  const { rows } = await client.query(q, v);
  return rows[0];
};

const getIntakeById = async (id, client = db) => {
  const { rows } = await client.query(`SELECT * FROM ca0107_intake_form WHERE id = $1 AND is_deleted = FALSE;`, [id]);
  return rows[0] || null;
};

const listIntake = async ({ status, complaintType } = {}, client = db) => {
  let q = `SELECT * FROM ca0107_intake_form WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  if (complaintType) { v.push(complaintType); q += ` AND complaint_type = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateIntake = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0107_intake_form SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

const createInvestigation = async ({ complaintId, investigatorId, findings, rootCause }, client = db) => {
  const q = `INSERT INTO ca0107_investigation (complaint_id, investigator_id, findings, root_cause, status) VALUES ($1, $2, $3, $4, 'open') RETURNING *;`;
  const { rows } = await client.query(q, [complaintId, investigatorId, findings, rootCause]);
  return rows[0];
};

const listInvestigation = async ({ complaintId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0107_investigation WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (complaintId) { v.push(complaintId); q += ` AND complaint_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateInvestigation = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0107_investigation SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

const createRefund = async ({ complaintId, amount, refundType, approvedBy }, client = db) => {
  const q = `INSERT INTO ca0107_refunds (complaint_id, amount, refund_type, approved_by, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *;`;
  const { rows } = await client.query(q, [complaintId, amount, refundType, approvedBy]);
  return rows[0];
};

const listRefunds = async ({ complaintId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0107_refunds WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (complaintId) { v.push(complaintId); q += ` AND complaint_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const createCapaLink = async ({ complaintId, capaId, description }, client = db) => {
  const q = `INSERT INTO ca0107_capa_link (complaint_id, capa_id, description, status) VALUES ($1, $2, $3, 'open') RETURNING *;`;
  const { rows } = await client.query(q, [complaintId, capaId, description]);
  return rows[0];
};

const listCapaLink = async ({ complaintId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0107_capa_link WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (complaintId) { v.push(complaintId); q += ` AND complaint_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  const { rows } = await client.query(q, v);
  return rows;
};

module.exports = { createIntake, getIntakeById, listIntake, updateIntake, createInvestigation, listInvestigation, updateInvestigation, createRefund, listRefunds, createCapaLink, listCapaLink };