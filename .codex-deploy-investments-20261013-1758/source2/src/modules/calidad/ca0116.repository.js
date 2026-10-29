const db = require("../../config/db");
const createBatch = async ({ batchNumber, productName, quantity, unit, sampleDate }, client = db) => {
  const q = `INSERT INTO ca0116_sampling_batches (batch_number, product_name, quantity, unit, sample_date, status) VALUES ($1, $2, $3, $4, $5, 'sampling') RETURNING *;`;
  const { rows } = await client.query(q, [batchNumber, productName, quantity, unit, sampleDate]);
  return rows[0];
};
const listBatches = async ({ status } = {}, client = db) => {
  let q = `SELECT * FROM ca0116_sampling_batches WHERE is_deleted = FALSE`;
  if (status) q += ` AND status = '${status}'`;
  q += ` ORDER BY created_at DESC;`;
  return (await client.query(q)).rows;
};
const createAnalysisResult = async ({ batchId, parameter, resultValue, conforms }, client = db) => {
  const q = `INSERT INTO ca0116_analysis_results (batch_id, parameter, result_value, conforms) VALUES ($1, $2, $3, $4) RETURNING *;`;
  return (await client.query(q, [batchId, parameter, resultValue, conforms])).rows[0];
};
const createApproval = async ({ batchId, approverId }, client = db) => {
  const q = `INSERT INTO ca0116_approvals (batch_id, approver_id, approval_status) VALUES ($1, $2, 'pending') RETURNING *;`;
  return (await client.query(q, [batchId, approverId])).rows[0];
};
const updateBatchStatus = async (id, status, client = db) => {
  const { rows } = await client.query(`UPDATE ca0116_sampling_batches SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;`, [status, id]);
  return rows[0];
};
const createRelease = async ({ batchId, releasedBy, destination, quantityReleased }, client = db) => {
  const q = `INSERT INTO ca0116_releases (batch_id, released_by, destination, quantity_released) VALUES ($1, $2, $3, $4) RETURNING *;`;
  return (await client.query(q, [batchId, releasedBy, destination, quantityReleased])).rows[0];
};
module.exports = { createBatch, listBatches, createAnalysisResult, createApproval, updateBatchStatus, createRelease };