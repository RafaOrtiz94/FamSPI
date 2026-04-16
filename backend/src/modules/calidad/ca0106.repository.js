const db = require("../../config/db");
const logger = require("../../config/logger");

/**
 * Repositorio de Datos - CA-01-06 (Retiro del Mercado/Recall)
 * Maneja operaciones CRUD transaccionales para auditoría GXP.
 */

// ==================== TRACEABILITY ====================
const createTraceability = async ({ productId, productName, lotNumber, manufacturingDate, expiryDate, quantityTotal, distributionChannels, affectedCountries, recallLevel }, client = db) => {
  const query = `
    INSERT INTO ca0106_traceability (product_id, product_name, lot_number, manufacturing_date, expiry_date, quantity_total, distribution_channels, affected_countries, recall_level, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
    RETURNING *;
  `;
  const values = [productId, productName, lotNumber, manufacturingDate, expiryDate, quantityTotal, distributionChannels, affectedCountries, recallLevel];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const getTraceabilityById = async (id, client = db) => {
  const query = `SELECT * FROM ca0106_traceability WHERE id = $1 AND is_deleted = FALSE;`;
  const { rows } = await client.query(query, [id]);
  return rows[0] || null;
};

const listTraceability = async ({ productId, lotNumber, status } = {}, client = db) => {
  let query = `SELECT * FROM ca0106_traceability WHERE is_deleted = FALSE`;
  const values = [];
  let paramIndex = 1;

  if (productId) {
    values.push(productId);
    query += ` AND product_id = $${paramIndex++}`;
  }
  if (lotNumber) {
    values.push(lotNumber);
    query += ` AND lot_number = $${paramIndex++}`;
  }
  if (status) {
    values.push(status);
    query += ` AND status = $${paramIndex++}`;
  }
  query += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(query, values);
  return rows;
};

const updateTraceability = async (id, updates, client = db) => {
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
    UPDATE ca0106_traceability SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex++} AND is_deleted = FALSE
    RETURNING *;
  `;
  const { rows } = await client.query(query, values);
  return rows[0];
};

// ==================== COMMUNICATION ====================
const createCommunication = async ({ recallId, communicationType, subject, body, targetAudience, channels, createdBy }, client = db) => {
  const query = `
    INSERT INTO ca0106_communication (recall_id, communication_type, subject, body, target_audience, channels, created_by, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
    RETURNING *;
  `;
  const values = [recallId, communicationType, subject, body, targetAudience, channels, createdBy];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const listCommunications = async ({ recallId, status } = {}, client = db) => {
  let query = `SELECT * FROM ca0106_communication WHERE is_deleted = FALSE`;
  const values = [];
  let paramIndex = 1;

  if (recallId) {
    values.push(recallId);
    query += ` AND recall_id = $${paramIndex++}`;
  }
  if (status) {
    values.push(status);
    query += ` AND status = $${paramIndex++}`;
  }
  query += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(query, values);
  return rows;
};

const updateCommunication = async (id, updates, client = db) => {
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
    UPDATE ca0106_communication SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex++} AND is_deleted = FALSE
    RETURNING *;
  `;
  const { rows } = await client.query(query, values);
  return rows[0];
};

// ==================== QUARANTINE ====================
const createQuarantine = async ({ recallId, locationId, locationName, quantityQuarantined, quarantineReason }, client = db) => {
  const query = `
    INSERT INTO ca0106_quarantine (recall_id, location_id, location_name, quantity_quarantined, quarantine_reason, status)
    VALUES ($1, $2, $3, $4, $5, 'pending')
    RETURNING *;
  `;
  const values = [recallId, locationId, locationName, quantityQuarantined, quarantineReason];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const listQuarantine = async ({ recallId, status } = {}, client = db) => {
  let query = `SELECT * FROM ca0106_quarantine WHERE is_deleted = FALSE`;
  const values = [];
  let paramIndex = 1;

  if (recallId) {
    values.push(recallId);
    query += ` AND recall_id = $${paramIndex++}`;
  }
  if (status) {
    values.push(status);
    query += ` AND status = $${paramIndex++}`;
  }
  query += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(query, values);
  return rows;
};

const updateQuarantine = async (id, updates, client = db) => {
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
    UPDATE ca0106_quarantine SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex++} AND is_deleted = FALSE
    RETURNING *;
  `;
  const { rows } = await client.query(query, values);
  return rows[0];
};

// ==================== LOGISTICS ====================
const createLogistics = async ({ recallId, actionType, quantity, destination, carrier }, client = db) => {
  const query = `
    INSERT INTO ca0106_logistics (recall_id, action_type, quantity, destination, carrier, status)
    VALUES ($1, $2, $3, $4, $5, 'pending')
    RETURNING *;
  `;
  const values = [recallId, actionType, quantity, destination, carrier];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const listLogistics = async ({ recallId, status } = {}, client = db) => {
  let query = `SELECT * FROM ca0106_logistics WHERE is_deleted = FALSE`;
  const values = [];
  let paramIndex = 1;

  if (recallId) {
    values.push(recallId);
    query += ` AND recall_id = $${paramIndex++}`;
  }
  if (status) {
    values.push(status);
    query += ` AND status = $${paramIndex++}`;
  }
  query += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(query, values);
  return rows;
};

const updateLogistics = async (id, updates, client = db) => {
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
    UPDATE ca0106_logistics SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex++} AND is_deleted = FALSE
    RETURNING *;
  `;
  const { rows } = await client.query(query, values);
  return rows[0];
};

module.exports = {
  createTraceability,
  getTraceabilityById,
  listTraceability,
  updateTraceability,
  createCommunication,
  listCommunications,
  updateCommunication,
  createQuarantine,
  listQuarantine,
  updateQuarantine,
  createLogistics,
  listLogistics,
  updateLogistics,
};