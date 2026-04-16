const db = require("../../config/db");
const logger = require("../../config/logger");

const createCommunication = async ({ communicationType, title, content, priority, channel, targetAudience, createdBy, expirationDate }, client = db) => {
  const q = `INSERT INTO ca0113_communications (communication_type, title, content, priority, channel, target_audience, created_by, status, expiration_date) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8) RETURNING *;`;
  const { rows } = await client.query(q, [communicationType, title, content, priority, channel, targetAudience, createdBy, expirationDate]);
  return rows[0];
};

const listCommunications = async ({ status, communicationType, priority } = {}, client = db) => {
  let q = `SELECT * FROM ca0113_communications WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  if (communicationType) { v.push(communicationType); q += ` AND communication_type = $${p++}`; }
  if (priority) { v.push(priority); q += ` AND priority = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateCommunication = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0113_communications SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

const createRecipient = async ({ communicationId, recipientType, recipientId }, client = db) => {
  const q = `INSERT INTO ca0113_recipients (communication_id, recipient_type, recipient_id) VALUES ($1, $2, $3) RETURNING *;`;
  const { rows } = await client.query(q, [communicationId, recipientType, recipientId]);
  return rows[0];
};

const listRecipients = async ({ communicationId } = {}, client = db) => {
  let q = `SELECT * FROM ca0113_recipients WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (communicationId) { v.push(communicationId); q += ` AND communication_id = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const createAttachment = async ({ communicationId, fileName, fileUrl, fileType, fileSize, uploadedBy }, client = db) => {
  const q = `INSERT INTO ca0113_attachments (communication_id, file_name, file_url, file_type, file_size, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`;
  const { rows } = await client.query(q, [communicationId, fileName, fileUrl, fileType, fileSize, uploadedBy]);
  return rows[0];
};

const listAttachments = async ({ communicationId } = {}, client = db) => {
  let q = `SELECT * FROM ca0113_attachments WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (communicationId) { v.push(communicationId); q += ` AND communication_id = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const createReadLog = async ({ communicationId, userId }, client = db) => {
  const q = `INSERT INTO ca0113_read_logs (communication_id, user_id, read_at) VALUES ($1, $2, NOW()) RETURNING *;`;
  const { rows } = await client.query(q, [communicationId, userId]);
  return rows[0];
};

const listReadLogs = async ({ communicationId, userId } = {}, client = db) => {
  let q = `SELECT * FROM ca0113_read_logs WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (communicationId) { v.push(communicationId); q += ` AND communication_id = $${p++}`; }
  if (userId) { v.push(userId); q += ` AND user_id = $${p++}`; }
  q += ` ORDER BY read_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const createTemplate = async ({ templateName, templateType, subjectTemplate, bodyTemplate, createdBy }, client = db) => {
  const q = `INSERT INTO ca0113_templates (template_name, template_type, subject_template, body_template, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
  const { rows } = await client.query(q, [templateName, templateType, subjectTemplate, bodyTemplate, createdBy]);
  return rows[0];
};

const listTemplates = async ({ templateType, isActive } = {}, client = db) => {
  let q = `SELECT * FROM ca0113_templates WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (templateType) { v.push(templateType); q += ` AND template_type = $${p++}`; }
  if (isActive !== undefined) { v.push(isActive); q += ` AND is_active = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

module.exports = {
  createCommunication, listCommunications, updateCommunication,
  createRecipient, listRecipients,
  createAttachment, listAttachments,
  createReadLog, listReadLogs,
  createTemplate, listTemplates
};