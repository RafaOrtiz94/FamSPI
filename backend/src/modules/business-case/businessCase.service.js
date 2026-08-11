const db = require("../../config/db");
const logger = require("../../config/logger");
const crypto = require("crypto");
const businessCaseCalculator = require("./businessCaseCalculator.service");
const integrationService = require("./businessCaseIntegration.service");
const { PrivatePurchaseStateMachine } = require("../private-purchases/privatePurchaseStateMachine");
const { PRIVATE_PURCHASE_STATES } = require("../private-purchases/privatePurchaseStates.constants");
const { ensureBusinessCaseDriveFolder } = require("./businessCaseDriveFolder.service");
const { filterEquipmentPairsForSheet } = require("./businessCaseSheetEquipment.helper");

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

function toObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}

function normalizeFallbackOfferKind(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "venta") return "venta";
  if (normalized === "alquiler") return "alquiler";
  if (normalized === "prestamo") return "alquiler";
  if (
    normalized === "alquiler_transferencia_dominio" ||
    normalized === "alquiler_con_transferencia_de_dominio"
  ) {
    return "alquiler_transferencia_dominio";
  }
  // No es una alternativa comercial: cierra el BC como rechazado sin ofrecer
  // venta/alquiler, porque no hubo información suficiente para evaluarlo.
  if (normalized === "rechazado_falta_informacion") return "rechazado_falta_informacion";
  return null;
}

const FEASIBILITY_ALLOWED_ROLES = new Set([
  "acp_comercial",
  "jefe_comercial",
  "jefe_de_comercial",
  "jefe_operaciones",
  "jefe_tecnico",
  "jefe_servicio",
  "gerencia",
  "gerencia_general",
]);

function normalizeRoleToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function collectUserRoles(user = {}) {
  const values = [
    user?.role,
    user?.scope,
    user?.role_name,
    user?.rol,
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.scopes) ? user.scopes : []),
  ];

  return new Set(values.map(normalizeRoleToken).filter(Boolean));
}

function assertCanSaveFeasibilityDecision(user = {}) {
  const roles = collectUserRoles(user);
  const isAllowed = Array.from(roles).some((role) => FEASIBILITY_ALLOWED_ROLES.has(role));

  if (isAllowed) return;

  const error = new Error("No tienes permisos para registrar la decision de factibilidad.");
  error.status = 403;
  error.code = "INSUFFICIENT_ROLE";
  throw error;
}

async function recordExcelExportAndMarkWaitingCalculations(businessCaseId, user = {}) {
  await assertModernBusinessCase(businessCaseId);
  const { rows } = await db.query(
    `SELECT modern_bc_metadata
       FROM equipment_purchase_requests
      WHERE id = $1`,
    [businessCaseId],
  );
  if (!rows.length) {
    const error = new Error("Business Case no encontrado");
    error.status = 404;
    throw error;
  }

  const metadata = toObject(rows[0].modern_bc_metadata);
  const feasibility = toObject(metadata.feasibility);
  const nowIso = new Date().toISOString();

  feasibility.status = "esperando_calculos";
  feasibility.export_excel = {
    at: nowIso,
    by_email: user?.email || null,
    by_id: user?.id || null,
  };
  feasibility.requires_change_approval = true;

  metadata.feasibility = feasibility;

  await db.query(
    `UPDATE equipment_purchase_requests
        SET bc_stage = 'esperando_calculos',
            modern_bc_metadata = $1::jsonb,
            updated_at = NOW()
      WHERE id = $2`,
    [JSON.stringify(metadata), businessCaseId],
  );

  return getBusinessCaseById(businessCaseId);
}

async function saveFeasibilityDecision(
  businessCaseId,
  {
    is_feasible,
    notes = "",
    fallback_offer_kind = null,
    quantities = null,
    prices = null,
    calculations = null,
  } = {},
  user = {},
) {
  assertCanSaveFeasibilityDecision(user);
  await assertModernBusinessCase(businessCaseId);
  const client = await db.getClient();
  const nowIso = new Date().toISOString();
  const normalizedFallback = normalizeFallbackOfferKind(fallback_offer_kind);
  let metadata = {};

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, modern_bc_metadata
         FROM equipment_purchase_requests
        WHERE id = $1
        FOR UPDATE`,
      [businessCaseId],
    );
    if (!rows.length) {
      const error = new Error("Business Case no encontrado");
      error.status = 404;
      throw error;
    }

    const row = rows[0];
    metadata = toObject(row.modern_bc_metadata);
    const feasibility = toObject(metadata.feasibility);
    const exportInfo = toObject(feasibility.export_excel);

    if (Boolean(is_feasible) && !exportInfo.at) {
      const error = new Error("Primero debe exportar los reactivos para iniciar calculos");
      error.status = 409;
      error.code = "EXPORT_REQUIRED";
      throw error;
    }

    if (is_feasible === false && !String(notes || "").trim()) {
      const error = new Error("Debe registrar el motivo para cerrar el Business Case como no factible");
      error.status = 400;
      error.code = "NON_FEASIBLE_REASON_REQUIRED";
      throw error;
    }

    if (is_feasible === false && !normalizedFallback) {
      const error = new Error(
        "Debe seleccionar venta directa, alquiler, alquiler con transferencia de dominio o rechazado por falta de informacion cuando no es factible",
      );
      error.status = 400;
      error.code = "FALLBACK_OFFER_KIND_REQUIRED";
      throw error;
    }

    if (Boolean(is_feasible)) {
      await integrationService.reserveInventory({
        businessCaseId,
        actorId: user?.id || null,
        client,
      });
    }

    feasibility.status = is_feasible ? "factible" : "no_factible";
    feasibility.decision = {
      is_feasible: Boolean(is_feasible),
      notes: notes || "",
      decided_at: nowIso,
      decided_by_email: user?.email || null,
      decided_by_id: user?.id || null,
      fallback_offer_kind: is_feasible ? null : normalizedFallback,
      quantities: quantities || null,
      prices: prices || null,
      calculations: calculations || null,
    };
    feasibility.requires_change_approval = false;
    feasibility.closed = true;
    feasibility.closed_at = nowIso;
    feasibility.closed_by_email = user?.email || null;
    feasibility.closed_by_id = user?.id || null;

    metadata.feasibility = feasibility;
    await client.query(
      `UPDATE equipment_purchase_requests
          SET bc_stage = $2,
              modern_bc_metadata = $1::jsonb,
              updated_at = NOW()
        WHERE id = $3`,
      [JSON.stringify(metadata), is_feasible ? "factible" : "cerrado_no_factible", businessCaseId],
    );

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ rollbackError: rollbackError.message, businessCaseId }, "Error haciendo rollback de factibilidad BC");
    }
    throw error;
  } finally {
    client.release();
  }

  const privatePurchaseId = metadata?.private_purchase_id || null;
  if (privatePurchaseId) {
    const { rows: privateRows } = await db.query(
      `SELECT id, status, offer_kind, extra
         FROM private_purchase_requests
        WHERE id = $1`,
      [privatePurchaseId],
    );

    if (privateRows.length) {
      const purchase = privateRows[0];
      const actorId = user?.id || -1;
      const actorReason = `Decision de factibilidad BC ${businessCaseId}`;

      if (is_feasible) {
        if (purchase.status === PRIVATE_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS) {
          await PrivatePurchaseStateMachine.transition(
            privatePurchaseId,
            PRIVATE_PURCHASE_STATES.BUSINESS_CASE_UNDER_REVIEW,
            actorId,
            actorReason,
            { source: "business_case", businessCaseId, decision: "under_review" },
          );
        }
        if (
          purchase.status === PRIVATE_PURCHASE_STATES.BUSINESS_CASE_UNDER_REVIEW ||
          purchase.status === PRIVATE_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS
        ) {
          await PrivatePurchaseStateMachine.transition(
            privatePurchaseId,
            PRIVATE_PURCHASE_STATES.BUSINESS_CASE_FEASIBILITY_APPROVED,
            actorId,
            actorReason,
            { source: "business_case", businessCaseId, decision: "approved" },
          );
        }
      } else {
        if (purchase.status === PRIVATE_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS) {
          await PrivatePurchaseStateMachine.transition(
            privatePurchaseId,
            PRIVATE_PURCHASE_STATES.BUSINESS_CASE_UNDER_REVIEW,
            actorId,
            actorReason,
            { source: "business_case", businessCaseId, decision: "under_review" },
          );
        }
        if (
          purchase.status === PRIVATE_PURCHASE_STATES.BUSINESS_CASE_UNDER_REVIEW ||
          purchase.status === PRIVATE_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS
        ) {
          await PrivatePurchaseStateMachine.transition(
            privatePurchaseId,
            PRIVATE_PURCHASE_STATES.BUSINESS_CASE_REJECTED,
            actorId,
            actorReason,
            { source: "business_case", businessCaseId, decision: "rejected" },
          );
        }

        const privateExtra = toObject(purchase.extra);
        privateExtra.business_case_decision = {
          business_case_id: businessCaseId,
          outcome: "no_factible",
          fallback_offer_kind: normalizedFallback,
          decided_at: nowIso,
          decided_by_email: user?.email || null,
          notes: notes || "",
        };

        await db.query(
          `UPDATE private_purchase_requests
              SET offer_kind = $2,
                  extra = $3::jsonb,
                  updated_at = NOW()
            WHERE id = $1`,
          [privatePurchaseId, normalizedFallback, JSON.stringify(privateExtra)],
        );

        const { rows: refreshedRows } = await db.query(
          `SELECT status FROM private_purchase_requests WHERE id = $1`,
          [privatePurchaseId],
        );
        const currentPrivateStatus = refreshedRows[0]?.status || purchase.status;
        if (
          PrivatePurchaseStateMachine.canTransition(
            currentPrivateStatus,
            PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE,
          )
        ) {
          await PrivatePurchaseStateMachine.transition(
            privatePurchaseId,
            PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE,
            actorId,
            "BC no factible, continuar flujo alterno",
            {
              source: "business_case",
              businessCaseId,
              fallback_offer_kind: normalizedFallback,
            },
          );
        }
      }
    }
  }

  return getBusinessCaseById(businessCaseId);
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
    await ensureBusinessCaseDriveFolder({
      businessCaseId: returnedId,
      clientName: client_name || "Cliente",
      bcPurchaseType: bc_purchase_type,
      existingFolderId: null,
      persist: true,
    });
  } catch (error) {
    logger.warn({ error: error.message, businessCaseId: returnedId }, "No se pudo crear carpeta en Drive para el BC");
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

  const bcResult = await db.query(
    `SELECT vc.*, u.fullname AS created_by_name, u.email AS created_by_email
       FROM v_business_cases_complete vc
       LEFT JOIN users u ON u.id = vc.created_by
      WHERE vc.business_case_id = $1`,
    [returnedId],
  );
  return mapBusinessCase(bcResult.rows[0]);
}

async function getBusinessCaseById(id) {
  const { rows } = await db.query(
    `SELECT vc.*, u.fullname AS created_by_name, u.email AS created_by_email
       FROM v_business_cases_complete vc
       LEFT JOIN users u ON u.id = vc.created_by
      WHERE vc.business_case_id = $1`,
    [id],
  );
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

  const mapped = mapBusinessCase(rows[0]);
  const consumptionData = await loadConsumptionData(id);
  if (consumptionData) {
    mapped.modern_bc_metadata = {
      ...(mapped.modern_bc_metadata || {}),
      consumption_items: consumptionData.items,
      consumption_excluded: consumptionData.excluded,
    };
  }
  return mapped;
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
      v.business_case_id,
      v.client_name,
      v.client_id,
      v.bc_purchase_type,
      v.status,
      v.bc_stage,
      v.bc_progress,
      v.bc_duration_years,
      v.bc_equipment_cost,
      v.bc_target_margin_percentage,
      v.bc_calculation_mode,
      v.bc_show_roi,
      v.bc_show_margin,
      v.assigned_to_email,
      v.assigned_to_name,
      v.drive_folder_id,
      v.extra,
      v.modern_bc_metadata,
      CASE WHEN v.created_at IS NOT NULL THEN v.created_at::text ELSE NULL END as created_at,
      CASE WHEN v.updated_at IS NOT NULL THEN v.updated_at::text ELSE NULL END as updated_at,
      v.created_by,
      u.fullname AS created_by_name,
      u.email AS created_by_email,
      CASE WHEN v.bc_created_at IS NOT NULL THEN v.bc_created_at::text ELSE NULL END as bc_created_at,
      v.uses_modern_system,
      v.bc_system_type,
      COUNT(*) OVER() AS total_count
    FROM v_business_cases v
    LEFT JOIN users u ON u.id = v.created_by
    ${whereClause}
    ORDER BY v.created_at DESC
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
    "process_code",
    "contract_object",
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
    if (data[field] === undefined) return;
    if (field === "modern_bc_metadata") {
      // Merge JSONB a nivel de Postgres (no reemplazo ciego) para cerrar una
      // condicion de carrera real detectada en produccion: multiples
      // endpoints leen todo el metadata al inicio del request, mutan UNA
      // clave anidada (ej. determinations_gate) y reescriben el objeto
      // completo al final. Si otro request (ej. aprobacion de prorroga SLA)
      // commitea entre medio, un SET ciego pisa esa clave top-level entera
      // con la copia vieja -- revirtiendo la aprobacion silenciosamente.
      // El operador `||` de jsonb hace merge superficial (top-level) de
      // forma atomica en la misma sentencia UPDATE, sin ventana de carrera.
      values.push(JSON.stringify(data[field]));
      sets.push(`modern_bc_metadata = COALESCE(modern_bc_metadata, '{}'::jsonb) || $${values.length}::jsonb`);
      return;
    }
    values.push(field === "bc_progress" || field === "extra" ? JSON.stringify(data[field]) : data[field]);
    sets.push(`${field} = $${values.length}`);
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

  // CRITICAL:
  // No sincronizar consumos desde PUT general de BC.
  // Este endpoint se usa para multiples secciones y puede traer
  // modern_bc_metadata parcial/desactualizado (incluyendo arreglos vacios),
  // lo que termina borrando bc_consumption_items.
  // La fuente de verdad de consumos debe modificarse solo por:
  // - PUT /business-case/:id/consumption-items
  // - PATCH /business-case/:id/consumption-items/:itemKey

  logger.info({
    business_case_id: id
  }, "✅ [FLUJO_BUSINESS_CASE] Actualización exitosa - obteniendo datos actualizados");

  return getBusinessCaseById(id);
}

async function loadConsumptionData(businessCaseId) {
  try {
    const { rows: items } = await db.query(
      `SELECT
         c.item_key, c.item_id, c.name, c.item_type, c.source, c.catalog_id,
         c.annual_qty, c.reference_qty, c.equipment_id, c.equipment_name,
         -- Producto a Enviar: si jefe_operaciones/comercial ya ajusto
         -- manualmente el valor en el workspace de despacho
         -- (commercial_updated_at), esa decision manual manda; si no, se usa
         -- el valor recien sincronizado directo desde el Sheet en esta tabla.
         CASE
           WHEN d.commercial_updated_at IS NOT NULL THEN d.planned_qty
           ELSE COALESCE(c.planned_qty, d.planned_qty)
         END AS planned_qty
       FROM bc_consumption_items c
       LEFT JOIN bc_dispatch_items d
         ON d.business_case_id = c.business_case_id AND d.item_key = c.item_key
       WHERE c.business_case_id = $1
       ORDER BY c.name`,
      [businessCaseId],
    );
    const { rows: excluded } = await db.query(
      `SELECT item_key FROM bc_consumption_excluded WHERE business_case_id = $1`,
      [businessCaseId],
    );

    const mappedItems = items.map((row) => ({
      key: row.item_key,
      itemId: row.item_id,
      name: row.name,
      type: row.item_type,
      source: row.source,
      catalogId: row.catalog_id,
      annualQty: row.annual_qty,
      referenceQty: row.reference_qty === null || row.reference_qty === undefined ? null : Number(row.reference_qty),
      plannedQty: row.planned_qty === null || row.planned_qty === undefined ? null : Number(row.planned_qty),
      equipmentId: row.equipment_id,
      equipmentName: row.equipment_name,
    }));
    const mappedExcluded = normalizeExcludedForItems(
      mappedItems,
      excluded.map((row) => row.item_key),
    );
    const version = buildConsumptionVersion(mappedItems, mappedExcluded);
    logger.info(
      {
        businessCaseId,
        version,
        itemsCount: mappedItems.length,
        excludedCount: mappedExcluded.length,
        nonZeroItems: mappedItems.filter((item) => Number(item?.annualQty ?? 0) > 0).length,
      },
      "[BC_AUDIT][BE][LOAD_CONSUMPTION]",
    );

    return {
      items: mappedItems,
      excluded: mappedExcluded,
      version,
    };
  } catch (error) {
    logger.warn({ error: error.message, businessCaseId }, "No se pudo cargar consumos de BC");
    return null;
  }
}

function normalizeExpectedVersion(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return raw.replace(/^W\/"/, "").replace(/^"/, "").replace(/"$/, "");
}

function buildConsumptionVersion(items = [], excluded = []) {
  const normalizedItems = normalizeConsumptionItemsForComparison(items);
  const normalizedExcluded = normalizeExcludedKeysForComparison(excluded);
  return crypto
    .createHash("sha1")
    .update(JSON.stringify({ items: normalizedItems, excluded: normalizedExcluded }))
    .digest("hex");
}

function normalizeConsumptionItemsForComparison(items = []) {
  const byKey = new Map();
  const safeItems = Array.isArray(items) ? items : [];

  for (const item of safeItems) {
    if (!item) continue;
    const key = String(item.key || "").trim();
    if (!key) continue;

    const annualQtyRaw = item.annualQty ?? item.annualQuantity ?? item.annual_qty ?? 0;
    const annualQty = Number(annualQtyRaw);
    const referenceQtyRaw = item.referenceQty ?? item.reference_qty ?? null;
    const referenceQty = referenceQtyRaw === null || referenceQtyRaw === undefined ? null : Number(referenceQtyRaw);
    const plannedQtyRaw = item.plannedQty ?? item.planned_qty ?? null;
    const plannedQty = plannedQtyRaw === null || plannedQtyRaw === undefined ? null : Number(plannedQtyRaw);

    byKey.set(key, {
      key,
      itemId: item.itemId ?? item.item_id ?? null,
      name: String(item.name || "").trim(),
      type: String(item.type || item.item_type || "consumible").trim().toLowerCase(),
      source: String(item.source || "catalog").trim().toLowerCase(),
      catalogId: item.catalogId ?? item.catalog_id ?? null,
      annualQty: Number.isFinite(annualQty) ? annualQty : 0,
      // Producto Calculado para reactivos: solo de referencia visual, nunca
      // se usa en calculos (annualQty sigue viniendo unicamente de DET/AÑO
      // PROCESO). null cuando no aplica (equipos no-reactivo o sin dato).
      referenceQty: Number.isFinite(referenceQty) ? referenceQty : null,
      // Producto a Enviar (PRODUCTO A ENTREGAR/ENVIAR): aplica a todos los
      // tipos por igual, se sincroniza junto con annualQty.
      plannedQty: Number.isFinite(plannedQty) ? plannedQty : null,
      equipmentId: item.equipmentId ?? item.equipment_id ?? null,
      equipmentName: item.equipmentName ?? item.equipment_name ?? null,
    });
  }

  return Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function normalizeExcludedKeysForComparison(excluded = []) {
  const safeExcluded = Array.isArray(excluded) ? excluded : [];
  return Array.from(
    new Set(
      safeExcluded
        .map((key) => String(key || "").trim())
        .filter(Boolean),
    ),
  ).sort();
}

function deriveLegacyConsumptionKey(itemKey) {
  const normalized = String(itemKey || "").trim();
  if (!normalized) return null;
  const parts = normalized.split(":");
  if (parts.length === 3 && (parts[0] === "cons" || parts[0] === "det")) {
    return `${parts[0]}:${parts[2]}`;
  }
  return null;
}

function normalizeExcludedForItems(items = [], excluded = []) {
  const safeExcluded = normalizeExcludedKeysForComparison(excluded);
  if (!Array.isArray(items) || !items.length || !safeExcluded.length) return safeExcluded;

  const protectedKeys = new Set();
  items.forEach((item) => {
    const key = String(item?.key || item?.item_key || "").trim();
    if (key) protectedKeys.add(key);
    const legacy = deriveLegacyConsumptionKey(key);
    if (legacy) protectedKeys.add(legacy);
    const catalogId = item?.catalogId ?? item?.catalog_id ?? null;
    const equipmentId = item?.equipmentId ?? item?.equipment_id ?? null;
    if (catalogId != null && equipmentId != null) {
      const normalizedType = String(item?.type || item?.item_type || "").toLowerCase();
      const prefix = normalizedType === "determinacion" ? "det" : "cons";
      protectedKeys.add(`${prefix}:${equipmentId}:${catalogId}`);
      protectedKeys.add(`${prefix}:${catalogId}`);
    }
  });

  return safeExcluded.filter((key) => !protectedKeys.has(String(key || "").trim()));
}

function matchesConsumptionItem(item = {}, candidate = {}) {
  const itemKey = String(item?.key || "").trim();
  const candidateKey = String(candidate?.key || "").trim();
  if (itemKey && candidateKey && itemKey === candidateKey) return true;

  const itemCatalogId = item?.catalogId ?? null;
  const candidateCatalogId = candidate?.catalogId ?? null;
  const itemEquipmentId = item?.equipmentId ?? null;
  const candidateEquipmentId = candidate?.equipmentId ?? null;
  if (
    itemCatalogId !== null &&
    candidateCatalogId !== null &&
    String(itemCatalogId) === String(candidateCatalogId) &&
    String(itemEquipmentId || "") === String(candidateEquipmentId || "")
  ) {
    return true;
  }

  const itemId = String(item?.itemId || "").trim();
  const candidateItemId = String(candidate?.itemId || "").trim();
  const itemType = String(item?.type || "").trim().toLowerCase();
  const candidateType = String(candidate?.type || "").trim().toLowerCase();
  if (
    itemId &&
    candidateItemId &&
    itemId === candidateItemId &&
    itemType === candidateType &&
    String(itemEquipmentId || "") === String(candidateEquipmentId || "")
  ) {
    return true;
  }

  return false;
}

function buildTemplateConsumptionSyncItems({ template, equipmentTabs = [], catalogItems = [] }) {
  const catalogSignatures = new Set(
    (Array.isArray(catalogItems) ? catalogItems : [])
      .map((item) => {
        const equipmentId = String(item?.equipment_id || item?.equipmentId || "").trim();
        const itemId = String(item?.item_id || item?.itemId || "").trim();
        const itemType = String(item?.item_type || item?.itemType || "").trim().toLowerCase();
        const itemName = String(item?.item_name || item?.itemName || item?.name || "").trim().toLowerCase();
        return [
          itemId ? `${equipmentId}:id:${itemId}:${itemType}` : null,
          itemName ? `${equipmentId}:name:${itemName}:${itemType}` : null,
        ].filter(Boolean);
      })
      .flat(),
  );

  const templateItems = [];
  (Array.isArray(equipmentTabs) ? equipmentTabs : []).forEach((tab) => {
    const definition = template?.equipmentSheets?.find((entry) => entry.name === tab?.sheet_name);
    if (!definition) return;
    const equipmentId = Number(tab?.equipment_ids?.[0] || 0);
    if (!Number.isInteger(equipmentId) || equipmentId <= 0) return;
    const equipmentName = Array.isArray(tab?.equipment_names) ? tab.equipment_names[0] : null;

    (Array.isArray(definition.rows) ? definition.rows : []).forEach((row) => {
      const itemId = String(row?.itemId || "").trim();
      const name = String(row?.label || "").trim();
      const itemType = String(row?.itemType || "reactivo").trim().toLowerCase();
      if (!itemId) return;

      const byId = itemId ? `${equipmentId}:id:${itemId}:${itemType}` : null;
      const byName = name ? `${equipmentId}:name:${name.toLowerCase()}:${itemType}` : null;
      if ((byId && catalogSignatures.has(byId)) || (byName && catalogSignatures.has(byName))) return;

      templateItems.push({
        item_key: `sheet:${equipmentId}:${itemId || row.rowNumber}:${itemType}`,
        item_id: itemId || null,
        item_name: name || itemId || `Fila ${row.rowNumber}`,
        item_type: itemType,
        equipment_id: equipmentId,
        equipment_name: equipmentName,
        catalog_id: null,
        source: "sheet_template",
      });
    });
  });

  return templateItems;
}

function isObsoleteTemplateFallbackItem(item = {}) {
  const source = String(item?.source || "").trim().toLowerCase();
  if (source !== "sheet_template") return false;
  const itemId = String(item?.itemId || item?.item_id || "").trim();
  if (!itemId) return true;
  const name = String(item?.name || "").trim().toLowerCase();
  return name === "total det" || name === "total" || name === "sub total" || name === "subtotal";
}

function resolveEquipmentIdsForConsumptionSync({ selectionRows = [], extra = {} }) {
  const ids = new Set(
    (Array.isArray(selectionRows) ? selectionRows : [])
      .map((row) => Number(row?.equipment_id))
      .filter((id) => Number.isInteger(id) && id > 0),
  );

  const equipmentPairs = Array.isArray(extra?.equipment_details) ? extra.equipment_details : [];
  filterEquipmentPairsForSheet(equipmentPairs).forEach((pair) => {
    [pair?.primary_id, pair?.backup_id]
      .map((value) => Number(value))
      .filter((id) => Number.isInteger(id) && id > 0)
      .forEach((id) => ids.add(id));
  });

  return Array.from(ids);
}

function isSameConsumptionPayload(current = {}, nextItems = [], nextExcluded = []) {
  const currentItems = normalizeConsumptionItemsForComparison(current.items || []);
  const currentExcluded = normalizeExcludedKeysForComparison(current.excluded || []);
  const incomingItems = normalizeConsumptionItemsForComparison(nextItems);
  const incomingExcluded = normalizeExcludedKeysForComparison(nextExcluded);

  return (
    JSON.stringify(currentItems) === JSON.stringify(incomingItems)
    && JSON.stringify(currentExcluded) === JSON.stringify(incomingExcluded)
  );
}

function assertConsumptionVersion(expectedVersion, currentVersion) {
  const normalizedExpected = normalizeExpectedVersion(expectedVersion);
  if (!normalizedExpected) return;
  if (normalizedExpected === currentVersion) return;
  logger.warn(
    {
      expectedVersion: normalizedExpected,
      currentVersion,
    },
    "[BC_AUDIT][BE][VERSION_CONFLICT]",
  );

  const error = new Error("Los consumos fueron actualizados por otro usuario. Refresca antes de guardar.");
  error.status = 409;
  error.code = "CONSUMPTION_VERSION_CONFLICT";
  error.details = { expectedVersion: normalizedExpected, currentVersion };
  throw error;
}

async function syncConsumptionData(businessCaseId, metadata = {}) {
  const normalizedItems = normalizeConsumptionItemsForComparison(
    Array.isArray(metadata.consumption_items) ? metadata.consumption_items : [],
  );
  const items = normalizedItems.map((item) => ({
    item_key: item.key,
    item_id: item.itemId || null,
    name: item.name || item.key,
    item_type: item.type || "consumible",
    source: item.source || "catalog",
    catalog_id: item.catalogId === null || item.catalogId === undefined
      ? null
      : (Number.isFinite(Number(item.catalogId)) ? Number(item.catalogId) : null),
    annual_qty: Math.max(0, Number(item.annualQty ?? item.annualQuantity ?? 0)),
    // ojo: Number(null) es 0, no NaN -- hay que descartar null/undefined
    // explicitamente antes de convertir, si no un item sin referencia/plan
    // (ej. un control, que nunca tiene reference_qty) queda guardado como 0
    // en vez de quedar NULL.
    reference_qty: item.referenceQty === null || item.referenceQty === undefined
      ? null
      : (Number.isFinite(Number(item.referenceQty)) ? Number(item.referenceQty) : null),
    planned_qty: item.plannedQty === null || item.plannedQty === undefined
      ? null
      : (Number.isFinite(Number(item.plannedQty)) ? Number(item.plannedQty) : null),
    equipment_id: Number.isFinite(Number(item.equipmentId)) ? Number(item.equipmentId) : null,
    equipment_name: item.equipmentName || null,
  }));
  const excluded = normalizeExcludedForItems(
    normalizedItems,
    Array.isArray(metadata.consumption_excluded) ? metadata.consumption_excluded : [],
  );
  const client = await db.getClient();
  logger.info(
    {
      businessCaseId,
      itemsCount: items.length,
      excludedCount: excluded.length,
      nonZeroItems: items.filter((item) => Number(item?.annual_qty ?? 0) > 0).length,
    },
    "[BC_AUDIT][BE][SYNC_INPUT]",
  );

  await client.query("BEGIN");
  try {
    if (items.length) {
      const itemsPayload = JSON.stringify(items);
      await client.query(
        `
        WITH payload AS (
          SELECT *
          FROM jsonb_to_recordset($2::jsonb) AS p(
            item_key text,
            item_id text,
            name text,
            item_type text,
            source text,
            catalog_id integer,
            annual_qty numeric,
            reference_qty numeric,
            planned_qty numeric,
            equipment_id integer,
            equipment_name text
          )
        )
        INSERT INTO bc_consumption_items (
          business_case_id,
          item_key,
          item_id,
          name,
          item_type,
          source,
          catalog_id,
          annual_qty,
          reference_qty,
          planned_qty,
          equipment_id,
          equipment_name,
          created_at,
          updated_at
        )
        SELECT
          $1,
          p.item_key,
          p.item_id,
          p.name,
          p.item_type,
          p.source,
          p.catalog_id,
          p.annual_qty,
          p.reference_qty,
          p.planned_qty,
          p.equipment_id,
          p.equipment_name,
          NOW(),
          NOW()
        FROM payload p
        ON CONFLICT (business_case_id, item_key)
        DO UPDATE SET
          item_id = EXCLUDED.item_id,
          name = EXCLUDED.name,
          item_type = EXCLUDED.item_type,
          source = EXCLUDED.source,
          catalog_id = EXCLUDED.catalog_id,
          annual_qty = EXCLUDED.annual_qty,
          reference_qty = EXCLUDED.reference_qty,
          planned_qty = EXCLUDED.planned_qty,
          equipment_id = EXCLUDED.equipment_id,
          equipment_name = EXCLUDED.equipment_name,
          updated_at = NOW()
        `,
        [businessCaseId, itemsPayload],
      );

      await client.query(
        `
        DELETE FROM bc_consumption_items b
        WHERE b.business_case_id = $1
          AND b.item_key NOT IN (
            SELECT p.item_key
            FROM jsonb_to_recordset($2::jsonb) AS p(item_key text)
          )
        `,
        [businessCaseId, itemsPayload],
      );
    } else {
      await client.query(`DELETE FROM bc_consumption_items WHERE business_case_id = $1`, [businessCaseId]);
    }

    if (excluded.length) {
      const excludedPayload = JSON.stringify(excluded.map((item_key) => ({ item_key })));
      await client.query(
        `
        WITH payload AS (
          SELECT p.item_key
          FROM jsonb_to_recordset($2::jsonb) AS p(item_key text)
        )
        INSERT INTO bc_consumption_excluded (business_case_id, item_key, created_at)
        SELECT $1, p.item_key, NOW()
        FROM payload p
        ON CONFLICT (business_case_id, item_key) DO NOTHING
        `,
        [businessCaseId, excludedPayload],
      );

      await client.query(
        `
        DELETE FROM bc_consumption_excluded b
        WHERE b.business_case_id = $1
          AND b.item_key NOT IN (
            SELECT p.item_key
            FROM jsonb_to_recordset($2::jsonb) AS p(item_key text)
          )
        `,
        [businessCaseId, excludedPayload],
      );
    } else {
      await client.query(`DELETE FROM bc_consumption_excluded WHERE business_case_id = $1`, [businessCaseId]);
    }

    await client.query("COMMIT");
    const { rows: counters } = await db.query(
      `
      SELECT
        COUNT(*)::int AS items_count,
        COALESCE(SUM(CASE WHEN annual_qty > 0 THEN 1 ELSE 0 END), 0)::int AS non_zero_items,
        COALESCE(SUM(annual_qty), 0)::int AS total_qty
      FROM bc_consumption_items
      WHERE business_case_id = $1
      `,
      [businessCaseId],
    );
    logger.info(
      {
        businessCaseId,
        persisted: counters?.[0] || null,
      },
      "[BC_AUDIT][BE][SYNC_RESULT]",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error({ error: error.message, businessCaseId }, "Error sincronizando consumos de BC");
    throw error;
  } finally {
    client.release();
  }
}

async function getConsumptionItems(businessCaseId) {
  await assertModernBusinessCase(businessCaseId);
  return loadConsumptionData(businessCaseId);
}

async function saveConsumptionItems(businessCaseId, items = [], excluded = [], options = {}) {
  await assertModernBusinessCase(businessCaseId);
  const expectedVersion = options?.expectedVersion || null;
  const nextItems = Array.isArray(items) ? items : [];
  let nextExcluded = Array.isArray(excluded) ? excluded : [];
  if (nextItems.length && nextExcluded.length) {
    const protectedKeys = new Set();
    nextItems.forEach((item) => {
      const key = String(item?.key || "").trim();
      if (!key) return;
      protectedKeys.add(key);
      const legacy = deriveLegacyConsumptionKey(key);
      if (legacy) protectedKeys.add(legacy);
    });
    nextExcluded = nextExcluded.filter((key) => !protectedKeys.has(String(key || "").trim()));
  }
  nextExcluded = normalizeExcludedForItems(nextItems, nextExcluded);
  const current = await loadConsumptionData(businessCaseId);
  logger.info(
    {
      businessCaseId,
      expectedVersion,
      currentVersion: current?.version || null,
      incomingItems: nextItems.length,
      incomingExcluded: nextExcluded.length,
      incomingNonZero: nextItems.filter((item) => Number(item?.annualQty ?? item?.annualQuantity ?? 0) > 0).length,
    },
    "[BC_AUDIT][BE][SAVE_CONSUMPTION_PRECHECK]",
  );
  assertConsumptionVersion(expectedVersion, current?.version || null);

  if (current && isSameConsumptionPayload(current, nextItems, nextExcluded)) {
    return current;
  }

  await syncConsumptionData(businessCaseId, {
    consumption_items: nextItems,
    consumption_excluded: nextExcluded
  });
  const reloaded = await loadConsumptionData(businessCaseId);
  logger.info(
    {
      businessCaseId,
      version: reloaded?.version || null,
      itemsCount: Array.isArray(reloaded?.items) ? reloaded.items.length : 0,
      nonZeroItems: Array.isArray(reloaded?.items)
        ? reloaded.items.filter((item) => Number(item?.annualQty ?? 0) > 0).length
        : 0,
    },
    "[BC_AUDIT][BE][SAVE_CONSUMPTION_POST]",
  );
  return reloaded;
}

// Sincronizacion inversa Sheet -> SPI: la hoja oficial es la fuente de verdad
// de CANTIDADES para reactivos, calibradores, controles y materiales. La
// columna real difiere por bloque: reactivos usa "DET/AÑO PROCESO"; jefe de
// servicio registra calibradores/controles/materiales en "PRODUCTO CALCULADO"
// (ver ANNUAL_QUANTITY_HEADERS en businessCaseSheetSyncLocal.service.js).
// Esta funcion no solo actualiza cantidades de items
// que ya existen en bc_consumption_items -- tambien CREA los que esten
// llenos en la hoja pero todavia no se hayan agregado en SPI, usando el
// catalogo del equipo (catalog_equipment_consumables) como fuente de
// item_type/nombre, ya que la hoja nunca indica el tipo, solo la cantidad.
// Se dispara automaticamente al cargar la pantalla de consumo (ver
// getConsumptionItems en el controller, que la salta si la subseccion ya
// esta bloqueada) y tambien queda disponible como accion manual via
// POST /:id/consumption-items/sync-from-sheet para forzar un re-sync.
async function syncConsumptionQuantitiesFromSheet(businessCaseId, options = {}) {
  await assertModernBusinessCase(businessCaseId);
  const requestedItemTypes = Array.isArray(options?.itemTypes)
    ? new Set(
      options.itemTypes
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    )
    : null;
  const annualQuantityProtectionSubsection = String(options?.protectAnnualQuantities || "").trim().toLowerCase();

  const { rows: bcRows } = await db.query(
    `SELECT modern_bc_metadata, extra FROM equipment_purchase_requests WHERE id = $1 LIMIT 1`,
    [businessCaseId],
  );
  const bcRow = bcRows[0] || {};
  const metadata = bcRow.modern_bc_metadata && typeof bcRow.modern_bc_metadata === "object" ? bcRow.modern_bc_metadata : {};
  const extra = bcRow.extra && typeof bcRow.extra === "object" ? bcRow.extra : {};
  const sheetId = metadata?.bc_sheet_generation?.last?.sheet_id || null;

  if (!sheetId) {
    const error = new Error("Este Business Case no tiene una hoja de Sheets generada todavia.");
    error.status = 409;
    error.code = "SHEET_NOT_GENERATED";
    throw error;
  }

  const current = await loadConsumptionData(businessCaseId);

  const { rows: selectionRows } = await db.query(
    `SELECT equipment_id FROM bc_equipment_selection WHERE business_case_id = $1`,
    [businessCaseId],
  );
  const equipmentIds = resolveEquipmentIdsForConsumptionSync({ selectionRows, extra });
  if (!equipmentIds.length) {
    if (annualQuantityProtectionSubsection) {
      const error = new Error("No existen equipos seleccionados para localizar las celdas anuales del Sheet.");
      error.status = 409;
      error.code = "ANNUAL_QUANTITY_PROTECTION_FAILED";
      throw error;
    }
    return { updated: 0, created: 0, items: current };
  }

  const { rows: equipmentRows } = await db.query(
    `SELECT equipment_id, equipment_name FROM v_equipment_full_catalog WHERE equipment_id = ANY($1::int[])`,
    [equipmentIds],
  );
  const equipmentNameById = new Map(equipmentRows.map((row) => [Number(row.equipment_id), row.equipment_name]));

  const { rows: catalogRows } = await db.query(
    `SELECT ec.equipment_id, c.id AS catalog_id, c.name, c.type AS item_type, c.supplier_code
       FROM catalog_equipment_consumables ec
       JOIN catalog_consumables c ON c.id = ec.consumable_id
      WHERE ec.equipment_id = ANY($1::int[])`,
    [equipmentIds],
  );

  const {
    loadTemplateDefinition,
    buildSheetPayloads,
    pullAnnualQuantitiesFromGoogleSheet,
    pullReferenceQuantitiesFromGoogleSheet,
    pullMaximumQuantitiesFromGoogleSheet,
  } = require("./businessCaseSheetSyncLocal.service");
  const templateDefinition = loadTemplateDefinition();

  const equipmentRecords = equipmentIds.map((id) => ({
    id,
    name: equipmentNameById.get(id) || null,
    code: null,
    model: null,
  }));

  // The sync catalog only identifies rows. Quantities are read exclusively
  // from the annual column DET/AÑO/PROCESO, never from PRODUCTO A ENVIAR.
  const catalogRowsForSync = requestedItemTypes?.size
    ? catalogRows.filter((row) => requestedItemTypes.has(String(row.item_type || "").trim().toLowerCase()))
    : catalogRows;
  const catalogItemsForSync = catalogRowsForSync.map((row) => ({
    item_key: `cons:${row.equipment_id}:${row.catalog_id}`,
    item_id: row.supplier_code || null,
    item_name: row.name || null,
    item_type: row.item_type || null,
    equipment_id: row.equipment_id,
    equipment_name: equipmentNameById.get(Number(row.equipment_id)) || null,
    catalog_id: row.catalog_id,
  }));

  let equipmentTabs = buildSheetPayloads({
    template: templateDefinition,
    equipmentRecords,
    payload: { fields: {}, sync_items: catalogItemsForSync, sheet_context: {} },
  });
  const templateItemsForSync = buildTemplateConsumptionSyncItems({
    template: templateDefinition,
    equipmentTabs,
    catalogItems: catalogItemsForSync,
  }).filter((item) => (
    requestedItemTypes?.size
      ? requestedItemTypes.has(String(item?.item_type || "").trim().toLowerCase())
      : true
  ));
  const mergedCatalogItemsForSync = [...catalogItemsForSync, ...templateItemsForSync];
  if (templateItemsForSync.length) {
    equipmentTabs = buildSheetPayloads({
      template: templateDefinition,
      equipmentRecords,
      payload: { fields: {}, sync_items: mergedCatalogItemsForSync, sheet_context: {} },
    });
    logger.warn(
      {
        businessCaseId,
        templateFallbackItems: templateItemsForSync.length,
        selectedEquipmentIds: equipmentIds,
        selectedSheets: equipmentTabs.map((tab) => tab.sheet_name),
      },
      "[BC_AUDIT][BE][SHEET_TEMPLATE_CONSUMPTION_FALLBACK]",
    );
  }

  let annualQuantityProtection = null;
  if (annualQuantityProtectionSubsection) {
    const {
      protectAnnualQuantityCellsForSubsection,
    } = require("./businessCaseSheetSyncLocal.service");
    annualQuantityProtection = await protectAnnualQuantityCellsForSubsection({
      sheetId,
      businessCaseId,
      subsection: annualQuantityProtectionSubsection,
      equipmentTabs,
    });
    if (!annualQuantityProtection?.protected) {
      const error = new Error(
        annualQuantityProtection?.reason === "NO_ANNUAL_CELLS_FOUND"
          ? "No se encontraron celdas de cantidades anuales para proteger en el Sheet."
          : "No se pudo proteger la columna de cantidades anuales en el Sheet.",
      );
      error.status = annualQuantityProtection?.reason === "NO_ANNUAL_CELLS_FOUND" ? 409 : 503;
      error.code = "ANNUAL_QUANTITY_PROTECTION_FAILED";
      throw error;
    }
  }

  const sheetUpdatesFromSheet = await pullAnnualQuantitiesFromGoogleSheet({ sheetId, equipmentTabs });
  // Producto Calculado para reactivos: solo de referencia visual (ver
  // pullReferenceQuantitiesFromGoogleSheet). Se combina por item_key con las
  // actualizaciones de annual_qty, sin afectar la logica de creacion/edicion
  // existente.
  const referenceUpdatesFromSheet = await pullReferenceQuantitiesFromGoogleSheet({ sheetId, equipmentTabs });
  // "Producto a Enviar" (PRODUCTO A ENTREGAR/ENVIAR en el Sheet): aplica por
  // igual a reactivos, calibradores, controles y materiales, sin distincion
  // de categoria (a diferencia de la cantidad anual). Se sincroniza aqui
  // directo a bc_consumption_items para que la pantalla de Determinaciones
  // no dependa de que se haya abierto antes el workspace de despacho.
  const plannedUpdatesFromSheet = await pullMaximumQuantitiesFromGoogleSheet({ sheetId, equipmentTabs });
  const currentItems = Array.isArray(current?.items)
    ? current.items.filter((item) => !isObsoleteTemplateFallbackItem(item))
    : [];
  const eligibleCurrentKeys = requestedItemTypes?.size
    ? new Set(
      currentItems
        .filter((item) => requestedItemTypes.has(String(item?.type || "").trim().toLowerCase()))
        .map((item) => String(item?.key || "").trim())
        .filter(Boolean),
    )
    : null;
  const eligibleCatalogKeys = new Set(mergedCatalogItemsForSync.map((item) => item.item_key));
  const filterEligible = (entry) => (requestedItemTypes?.size
    ? eligibleCatalogKeys.has(String(entry?.item_key || "").trim()) ||
      eligibleCurrentKeys.has(String(entry?.item_key || "").trim())
    : true);
  const sheetUpdates = sheetUpdatesFromSheet.filter(filterEligible);
  const referenceUpdates = referenceUpdatesFromSheet.filter(filterEligible);
  const plannedUpdates = plannedUpdatesFromSheet.filter(filterEligible);
  if (!sheetUpdates.length && !referenceUpdates.length && !plannedUpdates.length) {
    return { updated: 0, created: 0, items: current, annualQuantityProtection };
  }

  const catalogByKey = new Map(mergedCatalogItemsForSync.map((row) => [row.item_key, row]));
  const currentByKey = new Map(currentItems.map((item) => [item.key, item]));
  const excludedSet = new Set(current?.excluded || []);
  const updatesByKey = new Map(sheetUpdates.map((entry) => [entry.item_key, entry.annual_qty]));
  const referenceByKey = new Map(referenceUpdates.map((entry) => [entry.item_key, entry.reference_qty]));
  const plannedByKey = new Map(plannedUpdates.map((entry) => [entry.item_key, entry.planned_qty]));

  let updatedCount = 0;
  const nextItems = currentItems.map((item) => {
    const hasAnnualUpdate = updatesByKey.has(item.key);
    const hasReferenceUpdate = referenceByKey.has(item.key);
    const hasPlannedUpdate = plannedByKey.has(item.key);
    if (!hasAnnualUpdate && !hasReferenceUpdate && !hasPlannedUpdate) return item;

    const nextQty = hasAnnualUpdate ? Math.max(0, Number(updatesByKey.get(item.key)) || 0) : Number(item.annualQty);
    const nextReferenceQty = hasReferenceUpdate
      ? Math.max(0, Number(referenceByKey.get(item.key)) || 0)
      : (item.referenceQty ?? null);
    const nextPlannedQty = hasPlannedUpdate
      ? Math.max(0, Number(plannedByKey.get(item.key)) || 0)
      : (item.plannedQty ?? null);
    if (
      nextQty === Number(item.annualQty) &&
      nextReferenceQty === (item.referenceQty ?? null) &&
      nextPlannedQty === (item.plannedQty ?? null)
    ) return item;
    updatedCount += 1;
    return { ...item, annualQty: nextQty, referenceQty: nextReferenceQty, plannedQty: nextPlannedQty };
  });

  const creationKeys = new Set([
    ...sheetUpdates.map((entry) => entry.item_key),
    ...plannedUpdates.map((entry) => entry.item_key),
  ]);
  let createdCount = 0;
  for (const itemKey of creationKeys) {
    if (currentByKey.has(itemKey)) continue; // ya actualizado arriba
    if (excludedSet.has(itemKey)) continue; // el usuario lo excluyo a proposito
    const catalogInfo = catalogByKey.get(itemKey);
    if (!catalogInfo) continue;

    const candidate = {
      key: itemKey,
      itemId: catalogInfo.item_id,
      name: catalogInfo.item_name,
      type: catalogInfo.item_type,
      source: catalogInfo.source || "catalog",
      catalogId: catalogInfo.catalog_id,
      annualQty: updatesByKey.has(itemKey)
        ? Math.max(0, Number(updatesByKey.get(itemKey)) || 0)
        : 0,
      referenceQty: referenceByKey.has(itemKey)
        ? Math.max(0, Number(referenceByKey.get(itemKey)) || 0)
        : null,
      plannedQty: plannedByKey.has(itemKey)
        ? Math.max(0, Number(plannedByKey.get(itemKey)) || 0)
        : null,
      equipmentId: catalogInfo.equipment_id,
      equipmentName: catalogInfo.equipment_name,
    };

    const equivalentIndex = nextItems.findIndex((item) => matchesConsumptionItem(item, candidate));
    if (equivalentIndex >= 0) {
      nextItems[equivalentIndex] = {
        ...nextItems[equivalentIndex],
        ...candidate,
      };
      updatedCount += 1;
      continue;
    }

    nextItems.push(candidate);
    createdCount += 1;
  }

  if (!updatedCount && !createdCount) {
    return { updated: 0, created: 0, items: current, annualQuantityProtection };
  }

  await syncConsumptionData(businessCaseId, {
    consumption_items: nextItems,
    consumption_excluded: current?.excluded || [],
  });

  try {
    await recalculateBusinessCase(businessCaseId);
  } catch (error) {
    logger.warn(
      { businessCaseId, error: error.message },
      "No se pudo recalcular tras sincronizar cantidades desde Sheet",
    );
  }

  return {
    updated: updatedCount,
    created: createdCount,
    items: await loadConsumptionData(businessCaseId),
    annualQuantityProtection,
  };
}

async function patchConsumptionItem(businessCaseId, itemKey, patch = {}, options = {}) {
  await assertModernBusinessCase(businessCaseId);
  const normalizedKey = String(itemKey || "").trim();
  if (!normalizedKey) {
    const error = new Error("itemKey requerido para actualizar consumo");
    error.status = 400;
    throw error;
  }

  const expectedVersion = options?.expectedVersion || null;
  const current = await loadConsumptionData(businessCaseId);
  assertConsumptionVersion(expectedVersion, current?.version || null);

  const existingItem = (current?.items || []).find((item) => item.key === normalizedKey) || null;
  const row = patch?.row && typeof patch.row === "object" ? patch.row : {};
  const annualQtyRaw = patch?.annualQty;
  const annualQtyNumber = Number(annualQtyRaw);
  const annualQty = Number.isFinite(annualQtyNumber) ? Math.max(0, annualQtyNumber) : 0;
  const legacyItemKey = deriveLegacyConsumptionKey(normalizedKey);
  const keyVariants = new Set([normalizedKey]);
  if (legacyItemKey) keyVariants.add(legacyItemKey);

  let nextItems = (current?.items || []).filter((item) => item.key !== normalizedKey);
  let nextExcluded = (current?.excluded || []).filter((key) => !keyVariants.has(String(key || "").trim()));
  let expectedPatchedItem = null;

  if (annualQty > 0) {
    const name = String(row.name || existingItem?.name || "").trim();
    if (!name) {
      const error = new Error("Nombre del item requerido para guardar consumo");
      error.status = 400;
      throw error;
    }

    nextItems = [
      ...nextItems,
      (expectedPatchedItem = {
        key: normalizedKey,
        itemId: row.itemId ?? existingItem?.itemId ?? null,
        name,
        type: String(row.type || existingItem?.type || "consumible").trim().toLowerCase(),
        source: String(row.source || existingItem?.source || "custom").trim().toLowerCase(),
        catalogId: row.catalogId ?? existingItem?.catalogId ?? null,
        annualQty,
        referenceQty: existingItem?.referenceQty ?? null,
        plannedQty: existingItem?.plannedQty ?? null,
        equipmentId: row.equipmentId ?? existingItem?.equipmentId ?? null,
        equipmentName: row.equipmentName ?? existingItem?.equipmentName ?? null,
      }),
    ];
  } else {
    const source = String(row.source || existingItem?.source || "").trim().toLowerCase();
    if (source === "catalog" || patch?.exclude === true) {
      const exclusionKeys = legacyItemKey ? [normalizedKey, legacyItemKey] : [normalizedKey];
      nextExcluded = Array.from(new Set([...nextExcluded, ...exclusionKeys]));
    }
  }
  nextExcluded = normalizeExcludedForItems(nextItems, nextExcluded);

  if (isSameConsumptionPayload(current, nextItems, nextExcluded)) {
    return current;
  }

  await syncConsumptionData(businessCaseId, {
    consumption_items: nextItems,
    consumption_excluded: nextExcluded,
  });

  let result = await loadConsumptionData(businessCaseId);

  if (annualQty > 0 && expectedPatchedItem) {
    const existsInResult = Array.isArray(result?.items)
      ? result.items.some((item) => matchesConsumptionItem(item, expectedPatchedItem))
      : false;
    if (!existsInResult) {
      const repairedItems = [
        ...((result?.items || []).filter((item) => !matchesConsumptionItem(item, expectedPatchedItem))),
        expectedPatchedItem,
      ];
      const repairedExcluded = Array.isArray(result?.excluded)
        ? result.excluded.filter((key) => !keyVariants.has(String(key || "").trim()))
        : [];
      await syncConsumptionData(businessCaseId, {
        consumption_items: repairedItems,
        consumption_excluded: repairedExcluded,
      });
      result = await loadConsumptionData(businessCaseId);
    }
  }

  return result;
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

// NO es codigo muerto: bc_master/bc_economic_data son tablas de un diseño
// anterior (migracion 022) reemplazado por el enfoque actual (reusar
// equipment_purchase_requests, ver README_TABLE_STRUCTURE.md), pero todavia
// tienen 6 filas reales en produccion (verificado). Esta funcion migra ese BC
// legacy a equipment_purchase_requests la primera vez que se toca via el
// endpoint moderno (PUT /:id/economic-data). No borrar sin antes migrar o
// archivar esas 6 filas.
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
  getConsumptionItems,
  saveConsumptionItems,
  patchConsumptionItem,
  syncConsumptionQuantitiesFromSheet,
  getBusinessCaseType,
  isPublicComodato,
  isPrivateComodato,
  isComodato,
  recordExcelExportAndMarkWaitingCalculations,
  saveFeasibilityDecision,
};
