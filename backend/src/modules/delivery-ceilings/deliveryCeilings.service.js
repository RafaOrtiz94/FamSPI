const db = require("../../config/db");

const DELIVERY_CEILING_STATUSES = Object.freeze(["draft", "approved", "active", "closed"]);
const DELIVERY_CEILING_PURCHASE_TYPES = Object.freeze(["private", "public"]);
const OPEN_REQUEST_STATUSES = Object.freeze(["pending"]);

const buildError = (
  message,
  { status = 400, code = "DELIVERY_CEILING_QUERY_ERROR", details = null } = {},
) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
};

const asPositiveInteger = (value, fieldName, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw buildError(`${fieldName} invalido`, {
      code: "DELIVERY_CEILING_QUERY_INVALID",
      details: { field: fieldName },
    });
  }
  return parsed;
};

const asTrimmedText = (value, fieldName, fallback = null) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  if (!normalized) return fallback;
  if (fieldName === "status" && !DELIVERY_CEILING_STATUSES.includes(normalized)) {
    throw buildError("status no permitido", {
      code: "DELIVERY_CEILING_QUERY_INVALID",
      details: { field: fieldName, allowed: DELIVERY_CEILING_STATUSES },
    });
  }
  if (fieldName === "purchaseType" && !DELIVERY_CEILING_PURCHASE_TYPES.includes(normalized)) {
    throw buildError("purchaseType no permitido", {
      code: "DELIVERY_CEILING_QUERY_INVALID",
      details: { field: fieldName, allowed: DELIVERY_CEILING_PURCHASE_TYPES },
    });
  }
  return normalized;
};

const parsePgError = (error) => {
  if (!error?.code) return error;
  if (error.code === "22P02") {
    return buildError("Filtro invalido para delivery ceilings", {
      code: "DELIVERY_CEILING_QUERY_INVALID",
      details: { pg_code: error.code },
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

const toRounded = (value) => Number(Number(value || 0).toFixed(3));

const mapLine = (row) => {
  const maxQuantity = Number(row.max_quantity || 0);
  const deliveredQty = Number(row.delivered_qty || 0);
  const reservedQty = Number(row.reserved_open_qty || 0);
  const remainingQty = Math.max(0, maxQuantity - deliveredQty);
  const remainingEffectiveQty = Math.max(0, remainingQty - reservedQty);

  return {
    id: Number(row.id),
    delivery_ceiling_id: Number(row.delivery_ceiling_id),
    max_quantity: toRounded(maxQuantity),
    delivered_qty: toRounded(deliveredQty),
    reserved_open_qty: toRounded(reservedQty),
    remaining_qty: toRounded(remainingQty),
    remaining_effective_qty: toRounded(remainingEffectiveQty),
    unit: row.unit,
    item_type: row.item_type,
    equipment_model_id: row.equipment_model_id ? Number(row.equipment_model_id) : null,
    integration_product_map_id: row.integration_product_map_id
      ? Number(row.integration_product_map_id)
      : null,
    odoo_product_id: row.odoo_product_id ? Number(row.odoo_product_id) : null,
    notes: row.notes || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const listDeliveryCeilings = async ({
  ceilingId = null,
  businessCaseId = null,
  privatePurchaseId = null,
  status = null,
  purchaseType = null,
  page = 1,
  limit = 20,
} = {}) => {
  const safePage = asPositiveInteger(page, "page", 1) || 1;
  const safeLimit = Math.min(200, asPositiveInteger(limit, "limit", 20) || 20);
  const safeCeilingId = asPositiveInteger(ceilingId, "ceilingId", null);
  const safeBusinessCaseId = asTrimmedText(businessCaseId, "businessCaseId", null);
  const safePrivatePurchaseId = asTrimmedText(privatePurchaseId, "privatePurchaseId", null);
  const safeStatus = asTrimmedText(status, "status", null);
  const safePurchaseType = asTrimmedText(purchaseType, "purchaseType", null);
  const offset = (safePage - 1) * safeLimit;

  const params = [];
  const whereClauses = [];

  if (safeCeilingId) {
    params.push(safeCeilingId);
    whereClauses.push(`c.id = $${params.length}`);
  }
  if (safeBusinessCaseId) {
    params.push(safeBusinessCaseId);
    whereClauses.push(`c.business_case_id = $${params.length}::uuid`);
  }
  if (safePrivatePurchaseId) {
    params.push(safePrivatePurchaseId);
    whereClauses.push(`c.private_purchase_id::text = $${params.length}`);
  }
  if (safeStatus) {
    params.push(safeStatus);
    whereClauses.push(`c.status = $${params.length}`);
  }
  if (safePurchaseType) {
    params.push(safePurchaseType);
    whereClauses.push(`c.purchase_type = $${params.length}`);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  try {
    const listSql = `
      SELECT c.*
      FROM public.delivery_ceiling c
      ${whereSql}
      ORDER BY c.updated_at DESC, c.id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM public.delivery_ceiling c
      ${whereSql}
    `;

    const [listResult, countResult] = await Promise.all([
      db.query(listSql, [...params, safeLimit, offset]),
      db.query(countSql, params),
    ]);

    const ceilingRows = listResult.rows || [];
    const ceilingIds = ceilingRows.map((row) => Number(row.id));
    const linesByCeilingId = new Map();

    if (ceilingIds.length) {
      const { rows: lineRows } = await db.query(
        `
        SELECT
          l.*,
          COALESCE(reserved.reserved_qty, 0)::numeric AS reserved_open_qty
        FROM public.delivery_ceiling_line l
        LEFT JOIN (
          SELECT
            rl.delivery_ceiling_line_id,
            COALESCE(SUM(rl.requested_qty), 0)::numeric AS reserved_qty
          FROM public.delivery_request_line rl
          INNER JOIN public.delivery_request r
            ON r.id = rl.delivery_request_id
          WHERE r.status = ANY($2::text[])
            AND r.delivery_ceiling_id = ANY($1::bigint[])
          GROUP BY rl.delivery_ceiling_line_id
        ) reserved
          ON reserved.delivery_ceiling_line_id = l.id
        WHERE l.delivery_ceiling_id = ANY($1::bigint[])
        ORDER BY l.delivery_ceiling_id ASC, l.id ASC
        `,
        [ceilingIds, OPEN_REQUEST_STATUSES],
      );

      lineRows.forEach((row) => {
        const key = Number(row.delivery_ceiling_id);
        const bucket = linesByCeilingId.get(key) || [];
        bucket.push(mapLine(row));
        linesByCeilingId.set(key, bucket);
      });
    }

    return {
      page: safePage,
      limit: safeLimit,
      total: Number(countResult.rows?.[0]?.total || 0),
      rows: ceilingRows.map((row) => ({
        ...mapCeiling(row),
        lines: linesByCeilingId.get(Number(row.id)) || [],
      })),
      open_statuses_used_for_reservation: [...OPEN_REQUEST_STATUSES],
    };
  } catch (error) {
    throw parsePgError(error);
  }
};

module.exports = {
  DELIVERY_CEILING_STATUSES,
  DELIVERY_CEILING_PURCHASE_TYPES,
  OPEN_REQUEST_STATUSES,
  listDeliveryCeilings,
};
