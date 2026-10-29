const db = require("../../config/db");
const createReport = async ({ reportNumber, deviceName, deviceModel, serialNumber, incidentType, severity, description, reportedBy }, client = db) => {
  const q = `INSERT INTO ca0117_vigilance_reports (report_number, device_name, device_model, serial_number, incident_type, severity, description, reported_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'reported') RETURNING *;`;
  return (await client.query(q, [reportNumber, deviceName, deviceModel, serialNumber, incidentType, severity, description, reportedBy])).rows[0];
};
const listReports = async ({ status, severity } = {}, client = db) => {
  let q = `SELECT * FROM ca0117_vigilance_reports WHERE is_deleted = FALSE`;
  if (status) q += ` AND status = '${status}'`;
  if (severity) q += ` AND severity = '${severity}'`;
  return (await client.query(q + ` ORDER BY created_at DESC;`)).rows;
};
const createInvestigation = async ({ reportId, investigatorId }, client = db) => {
  return (await client.query(`INSERT INTO ca0117_investigations (report_id, investigator_id, status) VALUES ($1, $2, 'pending') RETURNING *;`, [reportId, investigatorId])).rows[0];
};
const createCorrectiveAction = async ({ investigationId, actionDescription, responsibleId, targetDate }, client = db) => {
  return (await client.query(`INSERT INTO ca0117_corrective_actions (investigation_id, action_description, responsible_id, target_date, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *;`, [investigationId, actionDescription, responsibleId, targetDate])).rows[0];
};
const updateReportStatus = async (id, status, client = db) => {
  return (await client.query(`UPDATE ca0117_vigilance_reports SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;`, [status, id])).rows[0];
};
module.exports = { createReport, listReports, createInvestigation, createCorrectiveAction, updateReportStatus };