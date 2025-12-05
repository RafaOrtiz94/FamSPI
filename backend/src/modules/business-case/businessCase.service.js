const db = require("../../config/db");
const logger = require("../../config/logger");
const { ensureFolder } = require("../../utils/drive");
const { v4: uuidv4 } = require("uuid");
const businessCaseCalculator = require("./businessCaseCalculator.service");

const DEFAULT_PAGE_SIZE = 20;

function mapBusinessCase(row) {
  if (!row) return null;
  const businessCaseId = row.business_case_id || row.id;
  const progress = typeof row.bc_progress === "string" ? JSON.parse(row.bc_progress) : row.bc_progress;
  const extra = typeof row.extra === "string" ? JSON.parse(row.extra) : row.extra;
  const metadata =
    typeof row.modern_bc_metadata === "string" ? JSON.parse(row.modern_bc_metadata) : row.modern_bc_metadata;

  return {
    ...row,
    business_case_id: businessCaseId,
    id: businessCaseId,
    bc_progress: progress || {},
    extra: extra || {},
    modern_bc_metadata: metadata || {},
  };
}

async function assertModernBusinessCase(id) {
  const { rows } = await db.query(
    `SELECT uses_modern_system, bc_system_type FROM equipment_purchase_requests WHERE id = $1`,
    [id],
  );

  if (!rows.length) {
    const error = new Error("Business Case no encontrado");
    error.status = 404;
    throw error;
  }

  if (!rows[0].uses_modern_system || rows[0].bc_system_type !== "modern") {
    const error = new Error("BC legacy no soportado");
    error.status = 400;
    throw error;
  }

  return rows[0];
}

async function createBusinessCase(data, user) {
  const {
    client_name,
    client_id,
    status = "draft",
    bc_stage = "pending_comercial",
    bc_progress = {},
    assigned_to_email = null,
    assigned_to_name = null,
    extra = {},
    modern_bc_metadata = {},
  } = data;

  const id = uuidv4();

  const insertQuery = `
    INSERT INTO equipment_purchase_requests (
      id,
      client_name,
      client_id,
      status,
      bc_stage,
      bc_progress,
      assigned_to_email,
      assigned_to_name,
      extra,
      modern_bc_metadata,
      created_by,
      bc_created_at,
      uses_modern_system,
      bc_system_type,
      request_type
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), true, 'modern', 'business_case'
    ) RETURNING id;
  `;

  const { rows } = await db.query(insertQuery, [
    id,
    client_name,
    client_id,
    status,
    bc_stage,
    JSON.stringify(bc_progress || {}),
    assigned_to_email,
    assigned_to_name,
    JSON.stringify(extra || {}),
    JSON.stringify(modern_bc_metadata || {}),
    user?.id || null,
  ]);

  if (!rows.length || !rows[0].id) {
    const error = new Error("No se pudo crear el Business Case (sin identificador)");
    error.status = 500;
    throw error;
  }

  const returnedId = rows[0].id;

  try {
    const parentFolderId = process.env.BUSINESS_CASE_ROOT_FOLDER_ID;
    const folderName = `Business Case ${returnedId}`;
    const folder = await ensureFolder(folderName, parentFolderId);

    await db.query(`UPDATE equipment_purchase_requests SET drive_folder_id = $1 WHERE id = $2`, [
      folder.id,
      returnedId,
    ]);
  } catch (error) {
    logger.warn({ error: error.message }, "No se pudo crear carpeta en Drive para el BC");
  }

  const bcResult = await db.query(`SELECT * FROM v_business_cases_complete WHERE business_case_id = $1`, [returnedId]);
  return mapBusinessCase(bcResult.rows[0]);
}

async function getBusinessCaseById(id) {
  const { rows } = await db.query(`SELECT * FROM v_business_cases_complete WHERE business_case_id = $1`, [id]);
  if (!rows.length) {
    const error = new Error("Business Case no encontrado");
    error.status = 404;
    throw error;
  }

  if (!rows[0].bc_system_type || rows[0].bc_system_type !== "modern") {
    const error = new Error("BC legacy no soportado");
    error.status = 400;
    throw error;
  }

  if (rows[0].uses_modern_system === false) {
    const error = new Error("BC legacy no soportado");
    error.status = 400;
    throw error;
  }

  return mapBusinessCase(rows[0]);
}

async function listBusinessCases(filters = {}) {
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, status, client_name, q } = filters;
  const params = [];
  const clauses = [];

  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }

  if (client_name) {
    params.push(`%${client_name.toLowerCase()}%`);
    clauses.push(`LOWER(client_name) LIKE $${params.length}`);
  }

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    clauses.push(
      `(LOWER(client_name) LIKE $${params.length} OR CAST(business_case_id AS TEXT) LIKE $${params.length})`,
    );
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  params.push(pageSize);
  params.push((page - 1) * pageSize);

  const query = `
    SELECT *, COUNT(*) OVER() AS total_count
    FROM v_business_cases
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const { rows } = await db.query(query, params);
  const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;

  return {
    items: rows.map(mapBusinessCase),
    pagination: {
      page: Number(page),
      pageSize: Number(pageSize),
      total,
      totalPages: pageSize ? Math.ceil(total / pageSize) : 1,
    },
  };
}

async function updateBusinessCase(id, data) {
  await assertModernBusinessCase(id);

  const allowedFields = [
    "client_name",
    "client_id",
    "status",
    "bc_stage",
    "bc_progress",
    "assigned_to_email",
    "assigned_to_name",
    "extra",
    "modern_bc_metadata",
  ];

  const sets = [];
  const values = [];

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      values.push(field === "bc_progress" || field === "extra" || field === "modern_bc_metadata"
        ? JSON.stringify(data[field])
        : data[field]);
      sets.push(`${field} = $${values.length}`);
    }
  });

  if (!sets.length) {
    return getBusinessCaseById(id);
  }

  values.push(id);

  const query = `
    UPDATE equipment_purchase_requests
    SET ${sets.join(", ")}, updated_at = now()
    WHERE id = $${values.length}
  `;

  await db.query(query, values);
  return getBusinessCaseById(id);
}

async function deleteBusinessCase(id) {
  await assertModernBusinessCase(id);
  const { rowCount } = await db.query(`DELETE FROM equipment_purchase_requests WHERE id = $1`, [id]);
  return rowCount > 0;
}

async function getCalculations(businessCaseId) {
  await assertModernBusinessCase(businessCaseId);
  const { rows } = await db.query(`SELECT * FROM bc_calculations WHERE business_case_id = $1`, [businessCaseId]);
  return rows[0] || null;
}

async function recalculateBusinessCase(businessCaseId) {
  await assertModernBusinessCase(businessCaseId);
  return businessCaseCalculator.calculateBusinessCase(businessCaseId);
}

module.exports = {
  createBusinessCase,
  getBusinessCaseById,
  listBusinessCases,
  updateBusinessCase,
  deleteBusinessCase,
  getCalculations,
  recalculateBusinessCase,
  assertModernBusinessCase,
};
