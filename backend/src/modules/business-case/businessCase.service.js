const db = require("../../config/db");
const logger = require("../../config/logger");
const { ensureFolder } = require("../../utils/drive");
const businessCaseCalculator = require("./businessCaseCalculator.service");

const DEFAULT_PAGE_SIZE = 20;

/**
 * Convierte input a ISO string si es fecha válida, null si no
 * Patrón tomado de src/shared/utils/dateUtils.js (AttendanceWidget)
 */
function toIso(input) {
  if (!input) return null;

  // Si ya es Date y válido
  if (input instanceof Date && !isNaN(input)) {
    return input.toISOString();
  }

  // Si es string, intenta parsear como ISO
  if (typeof input === 'string') {
    try {
      const parsed = new Date(input);
      if (!isNaN(parsed)) {
        return parsed.toISOString();
      }
      return null;
    } catch {
      return null;
    }
  }

  // Si es número (timestamp), determina si segundos o ms
  if (typeof input === 'number') {
    const timestamp = input < 1e12 ? input * 1000 : input;
    const date = new Date(timestamp);
    if (!isNaN(date)) {
      return date.toISOString();
    }
    return null;
  }

  // Si es dayjs/moment (tiene .$d)
  if (input && typeof input === 'object' && input.$d instanceof Date) {
    return input.$d.toISOString();
  }

  // Si es moment-like (tiene .toDate())
  if (input && typeof input === 'object' && typeof input.toDate === 'function') {
    const date = input.toDate();
    if (date instanceof Date && !isNaN(date)) {
      return date.toISOString();
    }
    return null;
  }

  // Si es objeto vacío {} -> null (problema actual)
  if (input && typeof input === 'object' && Object.keys(input).length === 0) {
    return null;
  }

  return null;
}

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
    // Convert dates to ISO strings (AttendanceWidget pattern)
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    bc_created_at: toIso(row.bc_created_at),
  };
}

async function assertModernBusinessCase(id) {
  const { rows } = await db.query(
    `SELECT uses_modern_system, bc_system_type FROM v_business_cases WHERE business_case_id = $1`,
    [id],
  );

  if (!rows.length) {
    const { rows: legacyRows } = await db.query(
      `SELECT uses_modern_system, bc_system_type FROM equipment_purchase_requests WHERE id = $1`,
      [id],
    );

    if (!legacyRows.length) {
      const error = new Error("Business Case no encontrado");
      error.status = 404;
      throw error;
    }

    if (!legacyRows[0].uses_modern_system || legacyRows[0].bc_system_type !== "modern") {
      const error = new Error("BC legacy no soportado");
      error.status = 400;
      throw error;
    }

    return legacyRows[0];
  }

  if (!rows[0].uses_modern_system || rows[0].bc_system_type !== "modern") {
    const error = new Error("BC legacy no soportado");
    error.status = 400;
    throw error;
  }

  return rows[0];
}

async function createBusinessCase(data, user) {
  logger.info({
    user_email: user?.email,
    user_id: user?.id,
    client_name: data.client_name,
    client_id: data.client_id,
    bc_purchase_type: data.bc_purchase_type || 'public'
  }, "🚀 [FLUJO_BUSINESS_CASE] INICIANDO creación de Business Case");

  const {
    client_name,
    client_id,
    bc_purchase_type = 'public',
    bc_duration_years = null,
    bc_equipment_cost = null,
    bc_target_margin_percentage = null,
    bc_amortization_months = null,
    bc_calculation_mode = 'monthly',
    bc_show_roi = false,
    bc_show_margin = false,
    status = "draft",
    bc_stage = null,
    bc_progress = {},
    assigned_to_email = null,
    assigned_to_name = null,
    extra = {},
    modern_bc_metadata = {},
  } = data;

  logger.info({
    bc_purchase_type,
    bc_duration_years,
    bc_equipment_cost,
    status,
    bc_stage
  }, "📋 [FLUJO_BUSINESS_CASE] Datos del Business Case procesados");

  // Auto-determine bc_stage based on comodato type if not provided
  const defaultStage = bc_purchase_type === 'comodato_publico' ? 'pending_comercial' : 'pending_backoffice';
  const finalStage = bc_stage || defaultStage;

  logger.info({
    bc_stage_provided: bc_stage,
    default_stage: defaultStage,
    final_stage: finalStage
  }, "🎯 [FLUJO_BUSINESS_CASE] Etapa del Business Case determinada");

  // Manual ID generation: Column is UUID and has no default, so we generate one.
  const nextId = require('crypto').randomUUID();

  logger.info({
    generated_id: nextId
  }, "🆔 [FLUJO_BUSINESS_CASE] ID único generado");

  const insertQuery = `
    INSERT INTO equipment_purchase_requests (
      id,
      client_name,
      client_id,
      bc_purchase_type,
      bc_duration_years,
      bc_equipment_cost,
      bc_target_margin_percentage,
      bc_amortization_months,
      bc_calculation_mode,
      bc_show_roi,
      bc_show_margin,
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
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), true, 'modern', 'business_case'
    ) RETURNING id;
  `;

  const { rows } = await db.query(insertQuery, [
    nextId,
    client_name,
    client_id,
    bc_purchase_type,
    bc_duration_years,
    bc_equipment_cost,
    bc_target_margin_percentage,
    bc_amortization_months,
    bc_calculation_mode,
    bc_show_roi,
    bc_show_margin,
    status,
    finalStage,
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

  // NOTIFICACIÓN: Crear Business Case
  setImmediate(async () => {
    try {
      const notificationManager = require('../notifications/notificationManager');
      await notificationManager.sendNotification({
        userId: user?.id,
        template: 'bc_created',
        data: {
          business_case_id: returnedId,
          client_name: client_name || 'Cliente no especificado'
        },
        email: false,
        chat: false,
        priority: 1,
        source: 'business_case.created',
        meta: {
          businessCaseId: returnedId,
          createdBy: user?.id,
          clientName: client_name
        }
      });
    } catch (notificationError) {
      logger.warn({ notificationError, businessCaseId: returnedId }, 'Error enviando notificación de creación BC');
      // No lanzamos error para no afectar la creación exitosa
    }
  });

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

  // Fix: Convert dates to ISO strings to prevent {} serialization
  const query = `
    SELECT
      business_case_id,
      client_name,
      client_id,
      bc_purchase_type,
      status,
      bc_stage,
      bc_progress,
      bc_duration_years,
      bc_equipment_cost,
      bc_target_margin_percentage,
      bc_calculation_mode,
      bc_show_roi,
      bc_show_margin,
      assigned_to_email,
      assigned_to_name,
      drive_folder_id,
      extra,
      modern_bc_metadata,
      CASE WHEN created_at IS NOT NULL THEN created_at::text ELSE NULL END as created_at,
      CASE WHEN updated_at IS NOT NULL THEN updated_at::text ELSE NULL END as updated_at,
      created_by,
      CASE WHEN bc_created_at IS NOT NULL THEN bc_created_at::text ELSE NULL END as bc_created_at,
      uses_modern_system,
      bc_system_type,
      COUNT(*) OVER() AS total_count
    FROM v_business_cases
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const { rows } = await db.query(query, params);
  const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;

  logger.info('[WORKSPACE_DEBUG] business-case list sample dates', {
    created_at: rows[0]?.created_at,
    updated_at: rows[0]?.updated_at,
    created_at_type: typeof rows[0]?.created_at,
    updated_at_type: typeof rows[0]?.updated_at
  });

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
  logger.info({
    business_case_id: id,
    fields_to_update: Object.keys(data || {})
  }, "🚀 [FLUJO_BUSINESS_CASE] INICIANDO actualización de Business Case");

  await assertModernBusinessCase(id);

  logger.info({
    business_case_id: id
  }, "✅ [FLUJO_BUSINESS_CASE] Validación de Business Case moderno exitosa");

  const allowedFields = [
    "client_name",
    "client_id",
    "bc_purchase_type",
    "bc_duration_years",
    "bc_equipment_cost",
    "bc_target_margin_percentage",
    "bc_amortization_months",
    "bc_calculation_mode",
    "bc_show_roi",
    "bc_show_margin",
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
    logger.info({
      business_case_id: id
    }, "⚠️ [FLUJO_BUSINESS_CASE] No hay campos para actualizar - retornando datos actuales");
    return getBusinessCaseById(id);
  }

  logger.info({
    business_case_id: id,
    fields_being_updated: sets.map(s => s.split(' = ')[0])
  }, "📝 [FLUJO_BUSINESS_CASE] Campos que serán actualizados");

  values.push(id);

  const query = `
    UPDATE equipment_purchase_requests
    SET ${sets.join(", ")}, updated_at = now()
    WHERE id = $${values.length}
  `;

  logger.info({
    business_case_id: id,
    update_query_preview: `UPDATE ... SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length}`
  }, "🔄 [FLUJO_BUSINESS_CASE] Ejecutando actualización en base de datos");

  await db.query(query, values);

  logger.info({
    business_case_id: id
  }, "✅ [FLUJO_BUSINESS_CASE] Actualización exitosa - obteniendo datos actualizados");

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

async function updateEconomicData(id, data) {
  const { equipment_id, equipment_name, equipment_cost } = data;
  const payload = {
    equipment_id,
    equipment_name,
    equipment_cost,
    updated_at: new Date().toISOString(),
  };

  let bcRow;
  try {
    bcRow = await assertModernBusinessCase(id);
  } catch (error) {
    if (error.status === 404) {
      bcRow = await insertEquipmentPurchaseRequestFromBcMaster(id);
    } else {
      throw error;
    }
  }

  const query = `
    UPDATE equipment_purchase_requests
    SET extra = jsonb_set(
          COALESCE(extra, '{}'::jsonb),
          '{economic_data}',
          $1::jsonb,
          true
        ),
        updated_at = now()
    WHERE id = $2
    RETURNING *
  `;

  const { rows } = await db.query(query, [JSON.stringify(payload), id]);

  if (!rows.length) {
    const error = new Error("Business Case no encontrado");
    error.status = 404;
    throw error;
  }

  const updatedRow = rows[0];
  const calculationMode = updatedRow.bc_calculation_mode || bcRow?.bc_calculation_mode || "monthly";
  await upsertBCEconomicData(id, { equipment_id, equipment_name, equipment_cost }, calculationMode);

  return mapBusinessCase(rows[0]);
}

// Helper functions for BC type detection
function getBusinessCaseType(businessCase) {
  return businessCase.bc_purchase_type || 'comodato_publico';
}

function isPublicComodato(businessCase) {
  return getBusinessCaseType(businessCase) === 'comodato_publico';
}

function isPrivateComodato(businessCase) {
  return getBusinessCaseType(businessCase) === 'comodato_privado';
}

function isComodato(businessCase) {
  // Ambos son comodatos
  return true;
}

async function insertEquipmentPurchaseRequestFromBcMaster(id) {
  const { rows } = await db.query(
    "SELECT client_name, client_id, bc_type FROM bc_master WHERE id = $1",
    [id],
  );

  if (!rows.length) {
    const error = new Error("Business Case no encontrado");
    error.status = 404;
    throw error;
  }

  const bc = rows[0];
  const bcPurchaseType = mapBcMasterTypeToPurchaseType(bc.bc_type);
  const bcCalculationMode = mapBcMasterTypeToCalculationMode(bc.bc_type);
  const insertQuery = `
    INSERT INTO equipment_purchase_requests (
      id, client_name, client_id,
      status, bc_stage, bc_progress,
      extra, modern_bc_metadata,
      request_type, uses_modern_system, bc_system_type,
      created_at, updated_at,
      bc_purchase_type, bc_calculation_mode,
      bc_created_at, created_by
    ) VALUES (
      $1, $2, $3,
      'draft', 'pending_comercial', '{}'::jsonb,
      '{}'::jsonb, '{}'::jsonb,
      'business_case', true, 'modern',
      NOW(), NOW(),
      $4, $5,
      NOW(), NULL
    )
    RETURNING *;
  `;

  const { rows: inserted } = await db.query(insertQuery, [
    id,
    bc.client_name || "Cliente",
    bc.client_id,
    bcPurchaseType,
    bcCalculationMode,
  ]);

  logger.info({ bcId: id }, "Registro moderno de Business Case creado en equipment_purchase_requests");
  return inserted[0];
}

function mapBcMasterTypeToPurchaseType(bcType) {
  const mapping = {
    comodato_publico: "public",
    comodato_privado: "private_comodato",
    venta_privada: "private_sale",
  };
  return mapping[bcType] || "public";
}

function mapBcMasterTypeToCalculationMode(bcType) {
  if (bcType === "comodato_publico") return "monthly";
  return "annual";
}

async function upsertBCEconomicData(bcId, { equipment_id, equipment_name, equipment_cost }, calculationMode) {
  const updateResult = await db.query(
    `
      UPDATE bc_economic_data
      SET equipment_id = $1,
          equipment_name = $2,
          equipment_cost = $3,
          calculation_mode = $4,
          updated_at = now()
      WHERE bc_master_id = $5
    `,
    [equipment_id, equipment_name, equipment_cost, calculationMode, bcId],
  );

  if (updateResult.rowCount === 0) {
    // Only insert if bc_master exists (legacy support).
    // Modern BCs don't use bc_master, so we skip this to avoid FK violation.
    try {
      await db.query(
        `
          INSERT INTO bc_economic_data (
            bc_master_id, equipment_id, equipment_name, equipment_cost,
            calculation_mode, show_roi, show_margin, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, true, true, now(), now())
        `,
        [bcId, equipment_id, equipment_name, equipment_cost, calculationMode],
      );
    } catch (error) {
      if (error.code === '23503') { // Foreign key violation
        logger.warn({ bcId }, 'Skipping bc_economic_data insert for modern BC (no bc_master)');
      } else {
        throw error;
      }
    }
  }
}

module.exports = {
  createBusinessCase,
  getBusinessCaseById,
  listBusinessCases,
  updateBusinessCase,
  deleteBusinessCase,
  getCalculations,
  recalculateBusinessCase,
  updateEconomicData,
  assertModernBusinessCase,
  getBusinessCaseType,
  isPublicComodato,
  isPrivateComodato,
  isComodato,
};
