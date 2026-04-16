const db = require("../../config/db");

/**
 * Repositorio de Datos - CA-01-04 (Control de Plagas)
 * ----------------------------------------------------
 * CRUD transaccional y soft delete para las tablas maestras.
 */

const createTrapsMap = async (
  { areaName, trapCode, pestType, riskLevel, status = "draft", coordinates = null, description = null, createdBy = null },
  client = db,
) => {
  const { rows } = await client.query(
    `
      INSERT INTO public.ca0104_traps_map (
        area_name, trap_code, pest_type, risk_level, status, coordinates, description, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `,
    [areaName, trapCode, pestType, riskLevel, status, coordinates, description, createdBy],
  );
  return rows[0];
};

const getTrapsMapById = async (id, client = db) => {
  const { rows } = await client.query(
    `SELECT * FROM public.ca0104_traps_map WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return rows[0] || null;
};

const listTrapsMaps = async ({ riskLevel, status } = {}, client = db) => {
  const conditions = ["deleted_at IS NULL"];
  const values = [];

  if (riskLevel) {
    values.push(riskLevel);
    conditions.push(`risk_level = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const { rows } = await client.query(
    `
      SELECT * FROM public.ca0104_traps_map
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC;
    `,
    values,
  );
  return rows;
};

const softDeleteTrapsMap = async (id, client = db) => {
  const { rows } = await client.query(
    `
      UPDATE public.ca0104_traps_map
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id;
    `,
    [id],
  );
  return rows[0] || null;
};

const createInspection = async (
  { trapsMapId, inspectionDate, inspectorName, findings, pestEvidence = false, status = "draft", qaNotes = null, createdBy = null },
  client = db,
) => {
  const { rows } = await client.query(
    `
      INSERT INTO public.ca0104_inspections (
        traps_map_id, inspection_date, inspector_name, findings, pest_evidence, status, qa_notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `,
    [trapsMapId, inspectionDate, inspectorName, findings, pestEvidence, status, qaNotes, createdBy],
  );
  return rows[0];
};

const listInspections = async ({ trapsMapId, status } = {}, client = db) => {
  const conditions = ["deleted_at IS NULL"];
  const values = [];

  if (trapsMapId) {
    values.push(trapsMapId);
    conditions.push(`traps_map_id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const { rows } = await client.query(
    `
      SELECT i.*, t.area_name, t.trap_code, t.risk_level
      FROM public.ca0104_inspections i
      INNER JOIN public.ca0104_traps_map t ON t.id = i.traps_map_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY i.created_at DESC;
    `,
    values,
  );
  return rows;
};

const updateInspectionStatus = async (id, { status, qaNotes }, client = db) => {
  const { rows } = await client.query(
    `
      UPDATE public.ca0104_inspections
      SET status = $2,
          qa_notes = COALESCE($3, qa_notes),
          updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `,
    [id, status, qaNotes],
  );
  return rows[0] || null;
};

const softDeleteInspection = async (id, client = db) => {
  const { rows } = await client.query(
    `
      UPDATE public.ca0104_inspections
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id;
    `,
    [id],
  );
  return rows[0] || null;
};

const createVendorApi = async (
  { vendorName, apiEndpoint, apiKeyRef = null, contactEmail = null, status = "draft", description = null, createdBy = null },
  client = db,
) => {
  const { rows } = await client.query(
    `
      INSERT INTO public.ca0104_vendor_api (
        vendor_name, api_endpoint, api_key_ref, contact_email, status, description, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `,
    [vendorName, apiEndpoint, apiKeyRef, contactEmail, status, description, createdBy],
  );
  return rows[0];
};

const listVendorApis = async ({ status } = {}, client = db) => {
  const values = [];
  const conditions = ["deleted_at IS NULL"];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const { rows } = await client.query(
    `
      SELECT * FROM public.ca0104_vendor_api
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC;
    `,
    values,
  );
  return rows;
};

const softDeleteVendorApi = async (id, client = db) => {
  const { rows } = await client.query(
    `
      UPDATE public.ca0104_vendor_api
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id;
    `,
    [id],
  );
  return rows[0] || null;
};

const createToxicity = async (
  { inspectionId = null, chemicalName, toxicityLevel, exposureNotes = null, status = "draft", qaNotes = null, createdBy = null },
  client = db,
) => {
  const { rows } = await client.query(
    `
      INSERT INTO public.ca0104_toxicity (
        inspection_id, chemical_name, toxicity_level, exposure_notes, status, qa_notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `,
    [inspectionId, chemicalName, toxicityLevel, exposureNotes, status, qaNotes, createdBy],
  );
  return rows[0];
};

const listToxicity = async ({ inspectionId, status } = {}, client = db) => {
  const conditions = ["deleted_at IS NULL"];
  const values = [];

  if (inspectionId) {
    values.push(inspectionId);
    conditions.push(`inspection_id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const { rows } = await client.query(
    `
      SELECT tox.*, i.inspector_name, i.inspection_date, t.trap_code
      FROM public.ca0104_toxicity tox
      LEFT JOIN public.ca0104_inspections i ON i.id = tox.inspection_id
      LEFT JOIN public.ca0104_traps_map t ON t.id = i.traps_map_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY tox.created_at DESC;
    `,
    values,
  );
  return rows;
};

const updateToxicityStatus = async (id, { status, qaNotes }, client = db) => {
  const { rows } = await client.query(
    `
      UPDATE public.ca0104_toxicity
      SET status = $2,
          qa_notes = COALESCE($3, qa_notes),
          updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `,
    [id, status, qaNotes],
  );
  return rows[0] || null;
};

const softDeleteToxicity = async (id, client = db) => {
  const { rows } = await client.query(
    `
      UPDATE public.ca0104_toxicity
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id;
    `,
    [id],
  );
  return rows[0] || null;
};

module.exports = {
  createTrapsMap,
  getTrapsMapById,
  listTrapsMaps,
  softDeleteTrapsMap,
  createInspection,
  listInspections,
  updateInspectionStatus,
  softDeleteInspection,
  createVendorApi,
  listVendorApis,
  softDeleteVendorApi,
  createToxicity,
  listToxicity,
  updateToxicityStatus,
  softDeleteToxicity,
};
