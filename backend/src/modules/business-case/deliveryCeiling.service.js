const db = require("../../config/db");
const logger = require("../../config/logger");

const DELIVERY_CEILING_STATES = Object.freeze(["draft", "approved", "active", "closed"]);
const DELIVERY_CEILING_PURCHASE_TYPES = Object.freeze(["private", "public"]);
const DELIVERY_CEILING_ITEM_TYPES = Object.freeze([
  "equipment",
  "reagent",
  "determination",
  "calibrator",
  "control",
  "additional_investment",
  "service",
]);

const STATE_TRANSITIONS = Object.freeze({
  draft: new Set(["approved"]),
  approved: new Set(["active"]),
  active: new Set(["closed"]),
  closed: new Set([]),
});

const buildError = (message, { status = 400, code = "DELIVERY_CEILING_ERROR", details = null } = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
};

const asPositiveInteger = (value, fieldName) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw buildError(`${fieldName} invalido`, {
      code: "DELIVERY_CEILING_INVALID_INPUT",
      details: { field: fieldName },
    });
  }
  return parsed;
};

const asNumericPositive = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw buildError(`${fieldName} debe ser mayor a 0`, {
      code: "DELIVERY_CEILING_INVALID_INPUT",
      details: { field: fieldName },
    });
  }
  return parsed;
};

const asTrimmedText = (value, fallback = null) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
};

const asDateOnly = (value, fieldName, { required = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (!required) return null;
    throw buildError(`${fieldName} es requerido`, {
      code: "DELIVERY_CEILING_INVALID_INPUT",
      details: { field: fieldName },
    });
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw buildError(`${fieldName} invalido`, {
      code: "DELIVERY_CEILING_INVALID_INPUT",
      details: { field: fieldName },
    });
  }
  return date.toISOString().slice(0, 10);
};

const parseDbError = (error) => {
  if (!error?.code) return error;

  if (error.code === "23505") {
    if (String(error.constraint || "") === "ux_delivery_ceiling_open_per_business_case") {
      return buildError("Ya existe un delivery_ceiling abierto para el business_case", {
        status: 409,
        code: "DELIVERY_CEILING_OPEN_EXISTS",
      });
    }
    return buildError("Conflicto de unicidad en delivery_ceiling", {
      status: 409,
      code: "DELIVERY_CEILING_DUPLICATE",
      details: { constraint: error.constraint || null },
    });
  }

  if (error.code === "23503") {
    return buildError("Referencia invalida en delivery_ceiling", {
      status: 400,
      code: "DELIVERY_CEILING_REFERENCE_INVALID",
      details: { constraint: error.constraint || null },
    });
  }

  if (error.code === "23514") {
    return buildError("Validacion de negocio incumplida en delivery_ceiling", {
      status: 400,
      code: "DELIVERY_CEILING_CHECK_VIOLATION",
      details: { constraint: error.constraint || null },
    });
  }

  return error;
};

const mapCeiling = (row) => ({
  id: Number(row.id),
  business_case_id: row.business_case_id,
  purchase_type: row.purchase_type,
  status: row.status,
  valid_from: row.valid_from,
  valid_to: row.valid_to,
  notes: row.notes || null,
  created_by: row.created_by ? Number(row.created_by) : null,
  updated_by: row.updated_by ? Number(row.updated_by) : null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapLine = (row) => ({
  id: Number(row.id),
  delivery_ceiling_id: Number(row.delivery_ceiling_id),
  max_quantity: Number(row.max_quantity),
  unit: row.unit,
  item_type: row.item_type,
  equipment_model_id: row.equipment_model_id ? Number(row.equipment_model_id) : null,
  integration_product_map_id: row.integration_product_map_id ? Number(row.integration_product_map_id) : null,
  odoo_product_id: row.odoo_product_id ? Number(row.odoo_product_id) : null,
  notes: row.notes || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const assertState = (status) => {
  if (!DELIVERY_CEILING_STATES.includes(status)) {
    throw buildError("status no permitido", {
      code: "DELIVERY_CEILING_INVALID_STATUS",
      details: { allowed: DELIVERY_CEILING_STATES },
    });
  }
};

const assertPurchaseType = (purchaseType) => {
  if (!DELIVERY_CEILING_PURCHASE_TYPES.includes(purchaseType)) {
    throw buildError("purchase_type no permitido", {
      code: "DELIVERY_CEILING_INVALID_PURCHASE_TYPE",
      details: { allowed: DELIVERY_CEILING_PURCHASE_TYPES },
    });
  }
};

const assertItemType = (itemType) => {
  if (!DELIVERY_CEILING_ITEM_TYPES.includes(itemType)) {
    throw buildError("item_type no permitido", {
      code: "DELIVERY_CEILING_INVALID_ITEM_TYPE",
      details: { allowed: DELIVERY_CEILING_ITEM_TYPES },
    });
  }
};

const getActorId = (actorUser) => {
  if (!actorUser) return null;
  return actorUser.id || actorUser.user_id || null;
};

const insertAuditEvent = async (
  client,
  {
    deliveryCeilingId,
    businessCaseId,
    userId = null,
    action,
    fromStatus = null,
    toStatus = null,
    reason = null,
    payload = {},
  },
) => {
  await client.query(
    `
    INSERT INTO public.delivery_ceiling_audit (
      delivery_ceiling_id,
      business_case_id,
      user_id,
      action,
      from_status,
      to_status,
      reason,
      at,
      payload
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8::jsonb)
    `,
    [
      deliveryCeilingId,
      businessCaseId,
      userId,
      action,
      fromStatus,
      toStatus,
      reason,
      JSON.stringify(payload || {}),
    ],
  );
};

const ensureBusinessCaseExists = async (client, businessCaseId) => {
  const { rows } = await client.query(
    `
    SELECT id
    FROM public.equipment_purchase_requests
    WHERE id = $1
    LIMIT 1
    `,
    [businessCaseId],
  );

  if (!rows.length) {
    throw buildError("Business Case no encontrado", {
      status: 404,
      code: "DELIVERY_CEILING_BUSINESS_CASE_NOT_FOUND",
    });
  }
};

const getCeilingForUpdate = async (client, deliveryCeilingId) => {
  const { rows } = await client.query(
    `
    SELECT *
    FROM public.delivery_ceiling
    WHERE id = $1
    FOR UPDATE
    `,
    [deliveryCeilingId],
  );

  if (!rows.length) {
    throw buildError("delivery_ceiling no encontrado", {
      status: 404,
      code: "DELIVERY_CEILING_NOT_FOUND",
    });
  }

  return rows[0];
};

async function createDraft({
  businessCaseId,
  purchaseType,
  validFrom,
  validTo = null,
  notes = null,
  actorUser = null,
} = {}) {
  const normalizedBusinessCaseId = asTrimmedText(businessCaseId);
  if (!normalizedBusinessCaseId) {
    throw buildError("business_case_id es requerido", {
      code: "DELIVERY_CEILING_INVALID_INPUT",
      details: { field: "business_case_id" },
    });
  }

  const normalizedPurchaseType = asTrimmedText(purchaseType, "private");
  assertPurchaseType(normalizedPurchaseType);

  const normalizedValidFrom = asDateOnly(validFrom, "valid_from");
  const normalizedValidTo = asDateOnly(validTo, "valid_to", { required: false });
  if (normalizedValidTo && normalizedValidTo < normalizedValidFrom) {
    throw buildError("valid_to no puede ser menor a valid_from", {
      code: "DELIVERY_CEILING_INVALID_DATE_RANGE",
    });
  }

  const userId = getActorId(actorUser);
  const normalizedNotes = asTrimmedText(notes, null);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await ensureBusinessCaseExists(client, normalizedBusinessCaseId);

    const { rows } = await client.query(
      `
      INSERT INTO public.delivery_ceiling (
        business_case_id,
        purchase_type,
        status,
        valid_from,
        valid_to,
        notes,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'draft', $3, $4, $5, $6, $6, NOW(), NOW())
      RETURNING *
      `,
      [
        normalizedBusinessCaseId,
        normalizedPurchaseType,
        normalizedValidFrom,
        normalizedValidTo,
        normalizedNotes,
        userId,
      ],
    );

    const created = rows[0];
    await insertAuditEvent(client, {
      deliveryCeilingId: created.id,
      businessCaseId: created.business_case_id,
      userId,
      action: "create_draft",
      fromStatus: null,
      toStatus: "draft",
      reason: normalizedNotes,
      payload: {
        purchase_type: normalizedPurchaseType,
        valid_from: normalizedValidFrom,
        valid_to: normalizedValidTo,
      },
    });

    await client.query("COMMIT");
    return mapCeiling(created);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ rollbackError: rollbackError.message }, "Error en rollback createDraft");
    }
    throw parseDbError(error);
  } finally {
    client.release();
  }
}

async function addLine({
  deliveryCeilingId,
  maxQuantity,
  unit,
  itemType,
  equipmentModelId = null,
  integrationProductMapId = null,
  odooProductId = null,
  notes = null,
  actorUser = null,
} = {}) {
  const normalizedDeliveryCeilingId = asPositiveInteger(deliveryCeilingId, "delivery_ceiling_id");
  const normalizedMaxQuantity = asNumericPositive(maxQuantity, "max_quantity");
  const normalizedUnit = asTrimmedText(unit);
  if (!normalizedUnit) {
    throw buildError("unit es requerido", {
      code: "DELIVERY_CEILING_INVALID_INPUT",
      details: { field: "unit" },
    });
  }

  const normalizedItemType = asTrimmedText(itemType);
  assertItemType(normalizedItemType);

  const normalizedEquipmentModelId = equipmentModelId ? asPositiveInteger(equipmentModelId, "equipment_model_id") : null;
  const normalizedProductMapId = integrationProductMapId
    ? asPositiveInteger(integrationProductMapId, "integration_product_map_id")
    : null;
  const normalizedOdooProductId = odooProductId ? asPositiveInteger(odooProductId, "odoo_product_id") : null;

  if (!normalizedEquipmentModelId && !normalizedProductMapId) {
    throw buildError("Debe existir equipment_model_id o integration_product_map_id", {
      code: "DELIVERY_CEILING_LINE_REFERENCE_REQUIRED",
    });
  }

  const normalizedNotes = asTrimmedText(notes, null);
  const userId = getActorId(actorUser);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const ceiling = await getCeilingForUpdate(client, normalizedDeliveryCeilingId);

    if (ceiling.status !== "draft") {
      throw buildError("No se pueden agregar lineas fuera de estado draft", {
        status: 409,
        code: "DELIVERY_CEILING_LINES_LOCKED",
        details: { current_status: ceiling.status },
      });
    }

    const { rows } = await client.query(
      `
      INSERT INTO public.delivery_ceiling_line (
        delivery_ceiling_id,
        max_quantity,
        unit,
        item_type,
        equipment_model_id,
        integration_product_map_id,
        odoo_product_id,
        notes,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
      `,
      [
        normalizedDeliveryCeilingId,
        normalizedMaxQuantity,
        normalizedUnit,
        normalizedItemType,
        normalizedEquipmentModelId,
        normalizedProductMapId,
        normalizedOdooProductId,
        normalizedNotes,
      ],
    );

    const line = rows[0];
    await insertAuditEvent(client, {
      deliveryCeilingId: normalizedDeliveryCeilingId,
      businessCaseId: ceiling.business_case_id,
      userId,
      action: "add_line",
      fromStatus: ceiling.status,
      toStatus: ceiling.status,
      reason: normalizedNotes,
      payload: {
        line_id: line.id,
        item_type: normalizedItemType,
        max_quantity: normalizedMaxQuantity,
      },
    });

    await client.query("COMMIT");
    return mapLine(line);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ rollbackError: rollbackError.message }, "Error en rollback addLine");
    }
    throw parseDbError(error);
  } finally {
    client.release();
  }
}

async function transitionStatus({
  deliveryCeilingId,
  toStatus,
  reason = null,
  actorUser = null,
} = {}) {
  const normalizedDeliveryCeilingId = asPositiveInteger(deliveryCeilingId, "delivery_ceiling_id");
  const normalizedToStatus = asTrimmedText(toStatus);
  assertState(normalizedToStatus);
  const normalizedReason = asTrimmedText(reason, null);
  const userId = getActorId(actorUser);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const current = await getCeilingForUpdate(client, normalizedDeliveryCeilingId);
    const fromStatus = current.status;

    const allowedNextStates = STATE_TRANSITIONS[fromStatus] || new Set();
    if (!allowedNextStates.has(normalizedToStatus)) {
      throw buildError(`Transicion invalida: ${fromStatus} -> ${normalizedToStatus}`, {
        status: 400,
        code: "DELIVERY_CEILING_INVALID_TRANSITION",
        details: {
          from_status: fromStatus,
          to_status: normalizedToStatus,
          allowed_to: Array.from(allowedNextStates),
        },
      });
    }

    const { rows } = await client.query(
      `
      UPDATE public.delivery_ceiling
      SET
        status = $2,
        updated_by = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [normalizedDeliveryCeilingId, normalizedToStatus, userId],
    );
    const updated = rows[0];

    await insertAuditEvent(client, {
      deliveryCeilingId: normalizedDeliveryCeilingId,
      businessCaseId: updated.business_case_id,
      userId,
      action: "status_transition",
      fromStatus,
      toStatus: normalizedToStatus,
      reason: normalizedReason,
      payload: {},
    });

    await client.query("COMMIT");
    return mapCeiling(updated);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ rollbackError: rollbackError.message }, "Error en rollback transitionStatus");
    }
    throw parseDbError(error);
  } finally {
    client.release();
  }
}

module.exports = {
  DELIVERY_CEILING_STATES,
  DELIVERY_CEILING_PURCHASE_TYPES,
  DELIVERY_CEILING_ITEM_TYPES,
  createDraft,
  addLine,
  transitionStatus,
};
