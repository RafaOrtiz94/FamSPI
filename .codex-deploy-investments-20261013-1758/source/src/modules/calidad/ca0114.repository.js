const db = require("../../config/db");
const logger = require("../../config/logger");

const createArea = async ({ areaName, areaCode, areaType, classificationLevel, qualificationType, nextQualificationDate, validatedBy }, client = db) => {
  const q = `INSERT INTO ca0114_qualified_areas (area_name, area_code, area_type, classification_level, qualification_type, next_qualification_date, validated_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *;`;
  const { rows } = await client.query(q, [areaName, areaCode, areaType, classificationLevel, qualificationType, nextQualificationDate, validatedBy]);
  return rows[0];
};

const listAreas = async ({ areaType, status, classificationLevel } = {}, client = db) => {
  let q = `SELECT * FROM ca0114_qualified_areas WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (areaType) { v.push(areaType); q += ` AND area_type = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  if (classificationLevel) { v.push(classificationLevel); q += ` AND classification_level = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const updateArea = async (id, updates, client = db) => {
  const fields = [], values = [], p = 1;
  Object.entries(updates).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = $${p++}`); values.push(v); } });
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await client.query(`UPDATE ca0114_qualified_areas SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p++} AND is_deleted = FALSE RETURNING *;`, values);
  return rows[0];
};

const createQualificationParam = async ({ areaId, paramName, paramCode, paramType, minValue, maxValue, targetValue, unit, methodUsed }, client = db) => {
  const q = `INSERT INTO ca0114_qualification_params (area_id, param_name, param_code, param_type, min_value, max_value, target_value, unit, method_used) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;`;
  const { rows } = await client.query(q, [areaId, paramName, paramCode, paramType, minValue, maxValue, targetValue, unit, methodUsed]);
  return rows[0];
};

const listQualificationParams = async ({ areaId } = {}, client = db) => {
  let q = `SELECT * FROM ca0114_qualification_params WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (areaId) { v.push(areaId); q += ` AND area_id = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const createMonitoringResult = async ({ areaId, paramId, readingValue, isWithinSpec, notes, recordedBy }, client = db) => {
  const q = `INSERT INTO ca0114_monitoring_results (area_id, param_id, reading_value, is_within_spec, notes, recorded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`;
  const { rows } = await client.query(q, [areaId, paramId, readingValue, isWithinSpec, notes, recordedBy]);
  return rows[0];
};

const listMonitoringResults = async ({ areaId } = {}, client = db) => {
  let q = `SELECT * FROM ca0114_monitoring_results WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (areaId) { v.push(areaId); q += ` AND area_id = $${p++}`; }
  q += ` ORDER BY reading_time DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const createDeviation = async ({ areaId, description, severity, correctiveAction }, client = db) => {
  const q = `INSERT INTO ca0114_deviations (area_id, description, severity, corrective_action, status) VALUES ($1, $2, $3, $4, 'open') RETURNING *;`;
  const { rows } = await client.query(q, [areaId, description, severity, correctiveAction]);
  return rows[0];
};

const listDeviations = async ({ areaId, status } = {}, client = db) => {
  let q = `SELECT * FROM ca0114_deviations WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (areaId) { v.push(areaId); q += ` AND area_id = $${p++}`; }
  if (status) { v.push(status); q += ` AND status = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

const createQualificationDoc = async ({ areaId, docType, docName, docUrl, version }, client = db) => {
  const q = `INSERT INTO ca0114_qualification_docs (area_id, doc_type, doc_name, doc_url, version) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
  const { rows } = await client.query(q, [areaId, docType, docName, docUrl, version]);
  return rows[0];
};

const listQualificationDocs = async ({ areaId } = {}, client = db) => {
  let q = `SELECT * FROM ca0114_qualification_docs WHERE is_deleted = FALSE`;
  const v = [], p = 1;
  if (areaId) { v.push(areaId); q += ` AND area_id = $${p++}`; }
  q += ` ORDER BY created_at DESC;`;
  const { rows } = await client.query(q, v);
  return rows;
};

module.exports = {
  createArea, listAreas, updateArea,
  createQualificationParam, listQualificationParams,
  createMonitoringResult, listMonitoringResults,
  createDeviation, listDeviations,
  createQualificationDoc, listQualificationDocs
};