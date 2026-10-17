const db = require("../../config/db");
const logger = require("../../config/logger");

/**
 * Repositorio de Datos - CA-01-02 (Limpieza de Áreas)
 * Maneja operaciones CRUD transaccionales, consultas indexadas y soft_delete
 * para preservar auditoría GXP.
 */

// AREA CRUD
const createArea = async ({ name, riskLevel, requiredFrequency, description }) => {
  const query = `
    INSERT INTO public.ca0102_areas (name, risk_level, required_frequency, description)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const values = [name, riskLevel, requiredFrequency, description];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const getAreaById = async (id) => {
  const query = `
    SELECT * FROM public.ca0102_areas
    WHERE id = $1 AND deleted_at IS NULL;
  `;
  const { rows } = await db.query(query, [id]);
  return rows[0] || null;
};

const listAreas = async ({ riskLevel } = {}) => {
  let query = `
    SELECT * FROM public.ca0102_areas
    WHERE deleted_at IS NULL
  `;
  const values = [];
  if (riskLevel) {
    values.push(riskLevel);
    query += ` AND risk_level = $1`;
  }
  query += ` ORDER BY name ASC;`;
  const { rows } = await db.query(query, values);
  return rows;
};

const softDeleteArea = async (id) => {
  const query = `
    UPDATE public.ca0102_areas
    SET deleted_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id;
  `;
  const { rows } = await db.query(query, [id]);
  return rows[0] || null;
};

// CLEANING LOGS CRUD
const createCleaningLog = async ({ areaId, cleaningType, cleaningAgentUsed, operatorNotes, executedBy }, client = db) => {
  const query = `
    INSERT INTO public.ca0102_cleaning_logs (area_id, cleaning_type, cleaning_agent_used, operator_notes, executed_by, status)
    VALUES ($1, $2, $3, $4, $5, 'executed') -- Asume ejecución inmediata tras el borrador
    RETURNING *;
  `;
  const values = [areaId, cleaningType, cleaningAgentUsed, operatorNotes, executedBy];
  const { rows } = await client.query(query, values);
  return rows[0];
};

const updateLogStatus = async (id, { status, qaNotes, verifiedBy }, client = db) => {
  const query = `
    UPDATE public.ca0102_cleaning_logs
    SET 
      status = $2, 
      qa_notes = COALESCE($3, qa_notes),
      verified_by = CASE WHEN $2 IN ('verified', 'closed') THEN $4 ELSE verified_by END,
      updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *;
  `;
  const { rows } = await client.query(query, [id, status, qaNotes, verifiedBy]);
  return rows[0];
};

const listActiveCleaningLogs = async () => {
  const query = `
    SELECT l.*, a.name as area_name, a.risk_level
    FROM public.ca0102_cleaning_logs l
    JOIN public.ca0102_areas a ON l.area_id = a.id
    WHERE l.status NOT IN ('closed', 'archived') AND l.deleted_at IS NULL
    ORDER BY l.created_at DESC;
  `;
  const { rows } = await db.query(query);
  return rows;
};

module.exports = {
  createArea,
  getAreaById,
  listAreas,
  softDeleteArea,
  createCleaningLog,
  updateLogStatus,
  listActiveCleaningLogs,
};
