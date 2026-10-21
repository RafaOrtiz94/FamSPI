const db = require("../../config/db");
const logger = require("../../config/logger");

const createPowerOutage = async ({ outageStart, outageEnd, durationMinutes, cause, affectedAreas, temperatureDrop }, client = db) => {
  const q = `INSERT INTO ca0108_power_outage (outage_start, outage_end, duration_minutes, cause, affected_areas, temperature_drop, status) VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *;`;
  const { rows } = await client.query(q, [outageStart, outageEnd, durationMinutes, cause, affectedAreas, temperatureDrop]);
  return rows[0];
};

const getPowerOutageById = async (id, client = db) => {
  const { rows } = await client.query(`SELECT * FROM ca0108_power_outage WHERE id = $1 AND is_deleted = FALSE;`, [id]);
  return rows[0] || null;
};

const listPowerOutage = async ({ status } = {}, client = db) => {
  let q = `SELECT * FROM ca0108_power_outage WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updatePowerOutage = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0108_power_outage SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

const createDryIceCalc = async ({ powerOutageId, containerVolumeLiters, targetTempCelsius, durationHours, requiredIceKg, calculationMethod }, client = db) => {
  const q = `INSERT INTO ca0108_dry_ice_calc (power_outage_id, container_volume_liters, target_temp_celsius, duration_hours, required_ice_kg, calculation_method, status) VALUES ($1, $2, $3, $4, $5, $6, 'calculated') RETURNING *;`;
  const { rows } = await client.query(q, [powerOutageId, containerVolumeLiters, targetTempCelsius, durationHours, requiredIceKg, calculationMethod]);
  return rows[0];
};

const listDryIceCalc = async ({ powerOutageId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0108_dry_ice_calc WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (powerOutageId) { v.push(powerOutageId); q += ` AND power_outage_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const createTransfer = async ({ powerOutageId, fromLocationId, fromLocationName, toLocationId, toLocationName, productsAffected }, client = db) => {
  const q = `INSERT INTO ca0108_transfer (power_outage_id, from_location_id, from_location_name, to_location_id, to_location_name, products_affected, transfer_status) VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *;`;
  const { rows } = await client.query(q, [powerOutageId, fromLocationId, fromLocationName, toLocationId, toLocationName, productsAffected]);
  return rows[0];
};

const listTransfer = async ({ powerOutageId, transferStatus } = {}, client = db) => {
  let q = `SELECT * FROM ca0108_transfer WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (powerOutageId) { v.push(powerOutageId); q += ` AND power_outage_id = $${p++}`; }
  if (transferStatus) { v.push(transferStatus); q += ` AND transfer_status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateTransfer = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0108_transfer SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

const createValidation = async ({ powerOutageId, validationType, result, passed, validatedBy }, client = db) => {
  const q = `INSERT INTO ca0108_validation (power_outage_id, validation_type, result, passed, validated_by, status) VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *;`;
  const { rows } = await client.query(q, [powerOutageId, validationType, result, passed, validatedBy]);
  return rows[0];
};

const listValidation = async ({ powerOutageId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0108_validation WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (powerOutageId) { v.push(powerOutageId); q += ` AND power_outage_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateValidation = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0108_validation SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

module.exports = { createPowerOutage, getPowerOutageById, listPowerOutage, updatePowerOutage, createDryIceCalc, listDryIceCalc, createTransfer, listTransfer, updateTransfer, createValidation, listValidation, updateValidation };