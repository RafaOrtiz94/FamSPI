const db = require("../../config/db");
const logger = require("../../config/logger");
const { enqueueIntegrationEvent } = require("../integrations/integrationOutbox.service");
const notificationManager = require("../notifications/notificationManager");

const DELIVERY_REQUEST_STATUSES = Object.freeze(["pending", "ops_approved", "confirmed", "cancelled"]);

/* ─── Schema migration (runs once per server start) ──────────────────────── */
let _tablesReady = false;
async function ensureDeliveryTables() {
  if (_tablesReady) return;
  try {
    // approved_qty: ops can approve less than what was requested (partial dispatch)
    await db.query(`
      ALTER TABLE public.delivery_request_line
        ADD COLUMN IF NOT EXISTS approved_qty NUMERIC
    `);
    // dispatch_notes on request: logistics can add notes when confirming shipment
    await db.query(`
      ALTER TABLE public.delivery_request
        ADD COLUMN IF NOT EXISTS dispatch_notes TEXT
    `);
    // Allow NULL max_quantity for open-order ceilings (no maximum enforced)
    await db.query(`
      ALTER TABLE public.delivery_ceiling_line
        ALTER COLUMN max_quantity DROP NOT NULL
    `);
    // delivery_dispatch: one record per physical shipment
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.delivery_dispatch (
        id              BIGSERIAL PRIMARY KEY,
        delivery_request_id BIGINT NOT NULL REFERENCES public.delivery_request(id),
        dispatched_by   BIGINT,
        dispatched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // delivery_dispatch_line: per-item quantities within a dispatch
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.delivery_dispatch_line (
        id                      BIGSERIAL PRIMARY KEY,
        delivery_dispatch_id    BIGINT NOT NULL REFERENCES public.delivery_dispatch(id),
        delivery_ceiling_line_id BIGINT NOT NULL REFERENCES public.delivery_ceiling_line(id),
        dispatched_qty          NUMERIC NOT NULL CHECK (dispatched_qty > 0),
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    _tablesReady = true;
    logger.info("delivery_dispatch tables ready");
  } catch (err) {
    logger.error({ err: err.message }, "ensureDeliveryTables failed");
  }
}
// Fire-and-forget on module load
ensureDeliveryTables().catch(() => {});

// "Open" requests reserve saldo but are not yet confirmed into delivered_qty.
// Both pending and ops_approved hold the reservation until logistics dispatches.
const OPEN_REQUEST_STATUSES = Object.freeze(["pending", "ops_approved"]);
const EPSILON = 1e-9;
const OPEN_ORDER_FALLBACK_ITEMS = Object.freeze([
  { name: "Reactivo", type: "reactivo", unit: "unidad" },
  { name: "Calibrador", type: "calibrador", unit: "unidad" },
  { name: "Control", type: "control", unit: "unidad" },
  { name: "Material", type: "material", unit: "unidad" },
]);

const buildError = (
  message,
  { status = 400, code = "DELIVERY_REQUEST_ERROR", details = null } = {},
) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
};

const asTrimmedText = (value, fallback = null) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
};

const asPositiveInteger = (value, fieldName) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw buildError(`${fieldName} invalido`, {
      code: "DELIVERY_REQUEST_INVALID_INPUT",
      details: { field: fieldName },
    });
  }
  return parsed;
};

const asPositiveNumeric = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw buildError(`${fieldName} debe ser mayor a 0`, {
      code: "DELIVERY_REQUEST_INVALID_INPUT",
      details: { field: fieldName },
    });
  }
  return parsed;
};

const asDateOnly = (value, fieldName) => {
  const normalized = asTrimmedText(value);
  if (!normalized) {
    throw buildError(`${fieldName} es requerido`, {
      code: "DELIVERY_REQUEST_INVALID_INPUT",
      details: { field: fieldName },
    });
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw buildError(`${fieldName} invalido`, {
      code: "DELIVERY_REQUEST_INVALID_INPUT",
      details: { field: fieldName },
    });
  }
  return parsed.toISOString().slice(0, 10);
};

const getActorId = (actorUser) => {
  if (!actorUser) return null;
  const candidate = actorUser.id || actorUser.user_id || null;
  if (!candidate) return null;
  const parsed = Number.parseInt(String(candidate), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const mapRequest = (row) => ({
  id: Number(row.id),
  delivery_ceiling_id: Number(row.delivery_ceiling_id),
  status: row.status,
  requested_by: row.requested_by ? Number(row.requested_by) : null,
  confirmed_by: row.confirmed_by ? Number(row.confirmed_by) : null,
  ops_approved_by: row.ops_approved_by ? Number(row.ops_approved_by) : null,
  ops_approved_at: row.ops_approved_at || null,
  notes: row.notes || null,
  dispatch_notes: row.dispatch_notes || null,
  requested_at: row.requested_at,
  confirmed_at: row.confirmed_at || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapRequestLine = (row) => ({
  id: Number(row.id),
  delivery_request_id: Number(row.delivery_request_id),
  delivery_ceiling_line_id: Number(row.delivery_ceiling_line_id),
  requested_qty: Number(row.requested_qty),
  approved_qty: row.approved_qty != null ? Number(row.approved_qty) : null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const pickModelIdsFromEquipment = (equipment = []) => {
  const ids = new Set();
  for (const item of Array.isArray(equipment) ? equipment : []) {
    const candidates = [
      item?.equipment_model_id,
      item?.equipmentModelId,
      item?.model_id,
      item?.modelId,
    ];
    for (const value of candidates) {
      const parsed = Number.parseInt(String(value ?? ""), 10);
      if (Number.isFinite(parsed) && parsed > 0) ids.add(parsed);
    }
  }
  return Array.from(ids);
};

const normalizeOpenOrderType = (rawType) => {
  const value = String(rawType || "").trim().toLowerCase();
  if (!value) return "material";
  if (value.includes("react")) return "reactivo";
  if (value.includes("calibr")) return "calibrador";
  if (value.includes("control")) return "control";
  if (value.includes("consum")) return "material";
  if (value.includes("material")) return "material";
  return value;
};

const parsePgError = (error) => {
  if (!error?.code) return error;

  if (error.code === "23503") {
    return buildError("Referencia invalida en delivery request", {
      status: 400,
      code: "DELIVERY_REQUEST_REFERENCE_INVALID",
      details: { constraint: error.constraint || null },
    });
  }

  if (error.code === "23505") {
    return buildError("Conflicto de unicidad en delivery request", {
      status: 409,
      code: "DELIVERY_REQUEST_DUPLICATE",
      details: { constraint: error.constraint || null },
    });
  }

  if (error.code === "23514") {
    return buildError("Validacion de negocio incumplida en delivery request", {
      status: 400,
      code: "DELIVERY_REQUEST_CHECK_VIOLATION",
      details: { constraint: error.constraint || null },
    });
  }

  return error;
};

const normalizeLinesPayload = (lines = []) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw buildError("Debe enviar al menos una linea", {
      code: "DELIVERY_REQUEST_LINES_REQUIRED",
    });
  }

  const byCeilingLine = new Map();
  lines.forEach((line, index) => {
    const ceilingLineId = asPositiveInteger(line?.ceilingLineId, `lines[${index}].ceilingLineId`);
    const requestedQty = asPositiveNumeric(line?.requestedQty, `lines[${index}].requestedQty`);
    const accumulated = byCeilingLine.get(ceilingLineId) || 0;
    byCeilingLine.set(ceilingLineId, accumulated + requestedQty);
  });

  return Array.from(byCeilingLine.entries()).map(([ceilingLineId, requestedQty]) => ({
    ceilingLineId,
    requestedQty,
  }));
};

const getCeilingForUpdate = async (client, ceilingId) => {
  const { rows } = await client.query(
    `
    SELECT id, status, purchase_type
    FROM public.delivery_ceiling
    WHERE id = $1
    FOR UPDATE
    `,
    [ceilingId],
  );

  if (!rows.length) {
    throw buildError("delivery_ceiling no encontrado", {
      status: 404,
      code: "DELIVERY_CEILING_NOT_FOUND",
    });
  }

  const ceiling = rows[0];
  if (ceiling.status !== "active") {
    throw buildError("El delivery_ceiling no esta activo", {
      status: 400,
      code: "CEILING_NOT_ACTIVE",
      details: { current_status: ceiling.status },
    });
  }

  return ceiling;
};

const getApprovedPublicPlanTrancheCaps = async (
  client,
  { ceilingId, asOfDate, ceilingLineIds },
) => {
  const { rows: planRows } = await client.query(
    `
    SELECT id, status
    FROM public.public_delivery_plan
    WHERE delivery_ceiling_id = $1
      AND status = 'approved'
    ORDER BY approved_at DESC NULLS LAST, id DESC
    LIMIT 1
    `,
    [ceilingId],
  );

  if (!planRows.length) {
    throw buildError("No existe plan de entrega publico aprobado", {
      status: 400,
      code: "PUBLIC_PLAN_NOT_APPROVED",
      details: { delivery_ceiling_id: ceilingId },
    });
  }

  const approvedPlan = planRows[0];

  const { rows: trancheRows } = await client.query(
    `
    SELECT
      pl.delivery_ceiling_line_id,
      COALESCE(SUM(pl.max_qty_tranche), 0)::numeric AS tranche_qty
    FROM public.public_delivery_plan_line pl
    WHERE pl.public_delivery_plan_id = $1
      AND pl.delivery_ceiling_line_id = ANY($2::bigint[])
      AND $3::date BETWEEN pl.scheduled_start AND pl.scheduled_end
    GROUP BY pl.delivery_ceiling_line_id
    `,
    [approvedPlan.id, ceilingLineIds, asOfDate],
  );

  const trancheByLine = new Map();
  trancheRows.forEach((row) => {
    trancheByLine.set(
      Number(row.delivery_ceiling_line_id),
      Number(row.tranche_qty || 0),
    );
  });

  const missingLineIds = ceilingLineIds.filter((lineId) => !trancheByLine.has(Number(lineId)));
  if (missingLineIds.length) {
    throw buildError("No existe tramo vigente para una o mas lineas solicitadas", {
      status: 400,
      code: "OUTSIDE_DELIVERY_WINDOW",
      details: {
        as_of_date: asOfDate,
        public_delivery_plan_id: Number(approvedPlan.id),
        missing_line_ids: missingLineIds,
      },
    });
  }

  return {
    public_delivery_plan_id: Number(approvedPlan.id),
    as_of_date: asOfDate,
    tranche_by_line: trancheByLine,
  };
};

const getCeilingLinesForUpdate = async (client, { ceilingId, ceilingLineIds }) => {
  const { rows } = await client.query(
    `
    SELECT
      id,
      delivery_ceiling_id,
      max_quantity,
      delivered_qty
    FROM public.delivery_ceiling_line
    WHERE delivery_ceiling_id = $1
      AND id = ANY($2::bigint[])
    FOR UPDATE
    `,
    [ceilingId, ceilingLineIds],
  );

  if (rows.length !== ceilingLineIds.length) {
    throw buildError("Una o mas lineas no pertenecen al delivery_ceiling activo", {
      status: 400,
      code: "ITEM_NOT_ALLOWED",
      details: {
        expected_lines: ceilingLineIds.length,
        found_lines: rows.length,
      },
    });
  }

  return rows;
};

const getOpenReservedByLine = async (
  client,
  { ceilingId, ceilingLineIds, excludedRequestId = null },
) => {
  const params = [ceilingId, OPEN_REQUEST_STATUSES, ceilingLineIds];
  let excludedSql = "";
  if (excludedRequestId) {
    params.push(excludedRequestId);
    excludedSql = `AND r.id <> $${params.length}`;
  }

  const { rows } = await client.query(
    `
    SELECT
      rl.delivery_ceiling_line_id,
      COALESCE(SUM(rl.requested_qty), 0)::numeric AS reserved_qty
    FROM public.delivery_request_line rl
    INNER JOIN public.delivery_request r
      ON r.id = rl.delivery_request_id
    WHERE r.delivery_ceiling_id = $1
      AND r.status = ANY($2::text[])
      AND rl.delivery_ceiling_line_id = ANY($3::bigint[])
      ${excludedSql}
    GROUP BY rl.delivery_ceiling_line_id
    `,
    params,
  );

  const reservedByLine = new Map();
  rows.forEach((row) => {
    reservedByLine.set(
      Number(row.delivery_ceiling_line_id),
      Number(row.reserved_qty || 0),
    );
  });

  return reservedByLine;
};

const validateRequestedAgainstRemaining = ({
  normalizedLines,
  ceilingLines,
  reservedByLine,
  trancheByLine = null,
}) => {
  const linesById = new Map();
  ceilingLines.forEach((row) => {
    linesById.set(Number(row.id), row);
  });

  return normalizedLines.map((line) => {
    const ceilingLine = linesById.get(line.ceilingLineId);
    if (!ceilingLine) {
      throw buildError("Linea solicitada no permitida", {
        status: 400,
        code: "ITEM_NOT_ALLOWED",
        details: { ceiling_line_id: line.ceilingLineId },
      });
    }

    // open_orders lines have max_quantity = NULL → no maximum enforcement
    const isUnlimited = ceilingLine.max_quantity == null;
    if (isUnlimited) {
      const deliveredQty = Number(ceilingLine.delivered_qty || 0);
      return {
        ceiling_line_id: line.ceilingLineId,
        requested_qty: Number(line.requestedQty.toFixed(3)),
        remaining_before: null,
        remaining_after: null,
        max_quantity: null,
        delivered_qty: Number(deliveredQty.toFixed(3)),
        reserved_qty: Number((reservedByLine.get(line.ceilingLineId) || 0).toFixed(3)),
        tranche_max_qty: null,
        effective_limit: null,
      };
    }

    const maxQuantity = Number(ceilingLine.max_quantity || 0);
    const deliveredQty = Number(ceilingLine.delivered_qty || 0);
    const reservedQty = Number(reservedByLine.get(line.ceilingLineId) || 0);
    const remaining = maxQuantity - deliveredQty - reservedQty;
    const trancheQty = trancheByLine ? Number(trancheByLine.get(line.ceilingLineId) || 0) : null;
    const effectiveLimit = trancheQty === null ? remaining : Math.min(remaining, trancheQty);

    if (line.requestedQty > effectiveLimit + EPSILON) {
      const exceedsTranche = trancheQty !== null && trancheQty + EPSILON < remaining;
      throw buildError(
        exceedsTranche
          ? "La cantidad solicitada excede el maximo permitido para el tramo vigente"
          : "La cantidad solicitada excede el saldo disponible",
        {
          status: 400,
          code: exceedsTranche ? "TRANCHE_MAX_EXCEEDED" : "MAX_EXCEEDED",
          details: {
            ceiling_line_id: line.ceilingLineId,
            requested_qty: line.requestedQty,
            remaining: Number(Math.max(0, remaining).toFixed(3)),
            tranche_max_qty: trancheQty === null ? null : Number(Math.max(0, trancheQty).toFixed(3)),
            effective_limit: Number(Math.max(0, effectiveLimit).toFixed(3)),
            max_quantity: Number(maxQuantity.toFixed(3)),
            delivered_qty: Number(deliveredQty.toFixed(3)),
            reserved_qty: Number(reservedQty.toFixed(3)),
          },
        },
      );
    }

    return {
      ceiling_line_id: line.ceilingLineId,
      requested_qty: Number(line.requestedQty.toFixed(3)),
      remaining_before: Number(Math.max(0, remaining).toFixed(3)),
      remaining_after: Number(Math.max(0, remaining - line.requestedQty).toFixed(3)),
      tranche_max_qty: trancheQty === null ? null : Number(Math.max(0, trancheQty).toFixed(3)),
      effective_limit: Number(Math.max(0, effectiveLimit).toFixed(3)),
    };
  });
};

async function createDeliveryRequest({
  ceilingId,
  lines,
  asOfDate = null,
  notes = null,
  actorUser = null,
  privatePurchaseId = null,
} = {}) {
  const normalizedCeilingId = asPositiveInteger(ceilingId, "ceilingId");
  const normalizedLines = normalizeLinesPayload(lines);
  const normalizedAsOfDate = asOfDate ? asDateOnly(asOfDate, "asOfDate") : new Date().toISOString().slice(0, 10);
  const normalizedNotes = asTrimmedText(notes, null);
  const actorUserId = getActorId(actorUser);
  const normalizedPrivatePurchaseId = asTrimmedText(privatePurchaseId, null);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const ceiling = await getCeilingForUpdate(client, normalizedCeilingId);

    const requestedLineIds = normalizedLines.map((line) => line.ceilingLineId);
    const ceilingLines = await getCeilingLinesForUpdate(client, {
      ceilingId: normalizedCeilingId,
      ceilingLineIds: requestedLineIds,
    });

    const reservedByLine = await getOpenReservedByLine(client, {
      ceilingId: normalizedCeilingId,
      ceilingLineIds: requestedLineIds,
    });

    let publicPlanContext = null;
    if (ceiling.purchase_type === "public") {
      publicPlanContext = await getApprovedPublicPlanTrancheCaps(client, {
        ceilingId: normalizedCeilingId,
        asOfDate: normalizedAsOfDate,
        ceilingLineIds: requestedLineIds,
      });
    }

    const balanceSnapshot = validateRequestedAgainstRemaining({
      normalizedLines,
      ceilingLines,
      reservedByLine,
      trancheByLine: publicPlanContext?.tranche_by_line || null,
    });

    const { rows: requestRows } = await client.query(
      `
      INSERT INTO public.delivery_request (
        delivery_ceiling_id,
        status,
        requested_by,
        notes,
        requested_at,
        created_at,
        updated_at
      )
      VALUES ($1, 'pending', $2, $3, NOW(), NOW(), NOW())
      RETURNING *
      `,
      [normalizedCeilingId, actorUserId, normalizedNotes],
    );
    const createdRequest = requestRows[0];

    const insertedLines = [];
    for (const line of normalizedLines) {
      const { rows } = await client.query(
        `
        INSERT INTO public.delivery_request_line (
          delivery_request_id,
          delivery_ceiling_line_id,
          requested_qty,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING *
        `,
        [createdRequest.id, line.ceilingLineId, line.requestedQty],
      );
      insertedLines.push(mapRequestLine(rows[0]));
    }

    await enqueueIntegrationEvent({
      eventType: "delivery_request.created",
      payload: {
        delivery_request_id: Number(createdRequest.id),
        delivery_ceiling_id: Number(createdRequest.delivery_ceiling_id),
        as_of_date: normalizedAsOfDate,
        lines: insertedLines.map((line) => ({
          delivery_ceiling_line_id: line.delivery_ceiling_line_id,
          requested_qty: line.requested_qty,
        })),
      },
      idempotencyKey: `delivery_request:${Number(createdRequest.id)}:created`,
      correlationId: null,
      dbClient: client,
    });

    // Vincular el ceiling a la compra privada si se provee y aún no está vinculado.
    // Esto permite que delivery_ceiling.private_purchase_id se establezca la primera vez
    // que Comercial genera una solicitud de insumo para una compra privada.
    if (normalizedPrivatePurchaseId) {
      await client.query(
        `UPDATE public.delivery_ceiling
            SET private_purchase_id = $1,
                updated_at = NOW()
          WHERE id = $2
            AND private_purchase_id IS NULL`,
        [normalizedPrivatePurchaseId, normalizedCeilingId],
      );
    }

    await client.query("COMMIT");
    const response = {
      request: mapRequest(createdRequest),
      lines: insertedLines,
      balance_snapshot: balanceSnapshot,
      open_statuses_used_for_reservation: [...OPEN_REQUEST_STATUSES],
      as_of_date: normalizedAsOfDate,
      public_plan_context: publicPlanContext
        ? {
            public_delivery_plan_id: publicPlanContext.public_delivery_plan_id,
          }
        : null,
      private_purchase_id: normalizedPrivatePurchaseId,
    };
    await notifyOpsNewSupplyRequest({
      requestId: response.request.id,
      ceilingId: Number(createdRequest.delivery_ceiling_id),
    });
    return response;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(
        { rollbackError: rollbackError.message },
        "Error en rollback createDeliveryRequest",
      );
    }
    throw parsePgError(error);
  } finally {
    client.release();
  }
}

/**
 * confirmDeliveryRequest
 * Logistics confirms the physical shipment.
 * Uses approved_qty (set by ops) or falls back to requested_qty.
 * Creates a delivery_dispatch record for full traceability.
 * If approved_qty < requested_qty for any line, auto-creates a new
 * pending request for the remainder so nothing is lost.
 *
 * @param {object} options
 * @param {number} options.requestId
 * @param {string|null} [options.dispatchNotes]
 * @param {object|null} [options.actorUser]
 */
async function confirmDeliveryRequest({
  requestId,
  dispatchNotes = null,
  actorUser = null,
} = {}) {
  const normalizedRequestId = asPositiveInteger(requestId, "requestId");
  const actorUserId = getActorId(actorUser);
  const normalizedDispatchNotes = asTrimmedText(dispatchNotes, null);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: requestRows } = await client.query(
      `SELECT * FROM public.delivery_request WHERE id = $1 FOR UPDATE`,
      [normalizedRequestId],
    );

    if (!requestRows.length) {
      throw buildError("delivery_request no encontrado", {
        status: 404,
        code: "DELIVERY_REQUEST_NOT_FOUND",
      });
    }

    const requestRow = requestRows[0];
    if (requestRow.status !== "ops_approved") {
      throw buildError("Solo se pueden confirmar solicitudes aprobadas por operaciones", {
        status: 409,
        code: "DELIVERY_REQUEST_NOT_OPS_APPROVED",
        details: { current_status: requestRow.status },
      });
    }

    const ceilingId = Number(requestRow.delivery_ceiling_id);
    await getCeilingForUpdate(client, ceilingId);

    const { rows: requestLineRows } = await client.query(
      `SELECT
         rl.id,
         rl.delivery_request_id,
         rl.delivery_ceiling_line_id,
         rl.requested_qty,
         rl.approved_qty,
         cl.max_quantity,
         cl.delivered_qty
       FROM public.delivery_request_line rl
       INNER JOIN public.delivery_ceiling_line cl ON cl.id = rl.delivery_ceiling_line_id
       WHERE rl.delivery_request_id = $1
       FOR UPDATE OF rl, cl`,
      [normalizedRequestId],
    );

    if (!requestLineRows.length) {
      throw buildError("delivery_request sin lineas", {
        status: 400,
        code: "DELIVERY_REQUEST_NO_LINES",
      });
    }

    const requestedLineIds = requestLineRows.map((row) => Number(row.delivery_ceiling_line_id));
    const reservedByLine = await getOpenReservedByLine(client, {
      ceilingId,
      ceilingLineIds: requestedLineIds,
      excludedRequestId: normalizedRequestId,
    });

    // Determine dispatch qty per line: approved_qty if set, else requested_qty
    const dispatchLines = requestLineRows.map((row) => ({
      lineId: Number(row.id),
      ceilingLineId: Number(row.delivery_ceiling_line_id),
      requestedQty: Number(row.requested_qty),
      dispatchQty: row.approved_qty != null ? Number(row.approved_qty) : Number(row.requested_qty),
      maxQuantity: Number(row.max_quantity),
      deliveredQty: Number(row.delivered_qty),
    }));

    // Validate dispatch quantities against remaining saldo
    validateRequestedAgainstRemaining({
      normalizedLines: dispatchLines.map((l) => ({ ceilingLineId: l.ceilingLineId, requestedQty: l.dispatchQty })),
      ceilingLines: requestLineRows.map((row) => ({
        id: row.delivery_ceiling_line_id,
        max_quantity: row.max_quantity,
        delivered_qty: row.delivered_qty,
      })),
      reservedByLine,
    });

    // ── Apply dispatch quantities to ceiling lines ────────────────────────
    const appliedLines = [];
    for (const line of dispatchLines) {
      const { rows } = await client.query(
        `UPDATE public.delivery_ceiling_line
            SET delivered_qty = delivered_qty + $2, updated_at = NOW()
          WHERE id = $1
          RETURNING id, delivered_qty, max_quantity`,
        [line.ceilingLineId, line.dispatchQty],
      );

      const updated = rows[0];
      appliedLines.push({
        delivery_ceiling_line_id: line.ceilingLineId,
        requested_qty: Number(line.requestedQty.toFixed(3)),
        dispatched_qty: Number(line.dispatchQty.toFixed(3)),
        remainder_qty: Number(Math.max(0, line.requestedQty - line.dispatchQty).toFixed(3)),
        delivered_qty_after: Number(Number(updated.delivered_qty).toFixed(3)),
        remaining_after: Number(
          Math.max(0, Number(updated.max_quantity) - Number(updated.delivered_qty)).toFixed(3),
        ),
      });
    }

    // ── Mark request as confirmed ─────────────────────────────────────────
    const { rows: updatedRequestRows } = await client.query(
      `UPDATE public.delivery_request
          SET status        = 'confirmed',
              confirmed_by  = $2,
              confirmed_at  = NOW(),
              dispatch_notes = $3,
              updated_at    = NOW()
        WHERE id = $1
        RETURNING *`,
      [normalizedRequestId, actorUserId, normalizedDispatchNotes],
    );

    // ── Create dispatch record for traceability ───────────────────────────
    const { rows: dispatchRows } = await client.query(
      `INSERT INTO public.delivery_dispatch
         (delivery_request_id, dispatched_by, dispatched_at, notes, created_at)
       VALUES ($1, $2, NOW(), $3, NOW())
       RETURNING *`,
      [normalizedRequestId, actorUserId, normalizedDispatchNotes],
    );
    const dispatchId = Number(dispatchRows[0].id);

    for (const line of dispatchLines) {
      await client.query(
        `INSERT INTO public.delivery_dispatch_line
           (delivery_dispatch_id, delivery_ceiling_line_id, dispatched_qty, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [dispatchId, line.ceilingLineId, line.dispatchQty],
      );
    }

    // ── Auto-create remainder request if any line was partially dispatched ─
    const remainderLines = appliedLines.filter((l) => l.remainder_qty > EPSILON);
    let remainderRequest = null;
    if (remainderLines.length > 0) {
      const { rows: remReqRows } = await client.query(
        `INSERT INTO public.delivery_request
           (delivery_ceiling_id, status, requested_by, notes, requested_at, created_at, updated_at)
         VALUES ($1, 'pending', $2, $3, NOW(), NOW(), NOW())
         RETURNING *`,
        [
          ceilingId,
          requestRow.requested_by,
          `Sobrante automático de solicitud #${normalizedRequestId}`,
        ],
      );
      const remReqId = Number(remReqRows[0].id);

      for (const rem of remainderLines) {
        // Find original line's ceiling_line_id
        const origLine = dispatchLines.find((l) => l.ceilingLineId === rem.delivery_ceiling_line_id);
        if (!origLine) continue;
        await client.query(
          `INSERT INTO public.delivery_request_line
             (delivery_request_id, delivery_ceiling_line_id, requested_qty, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [remReqId, rem.delivery_ceiling_line_id, rem.remainder_qty],
        );
      }
      remainderRequest = mapRequest(remReqRows[0]);
    }

    // ── Advance public purchase state if applicable ───────────────────────
    const { rows: ceilingRows } = await client.query(
      `SELECT business_case_id, purchase_type FROM public.delivery_ceiling WHERE id = $1`,
      [ceilingId],
    );
    if (ceilingRows.length && ceilingRows[0].purchase_type === "public") {
      const purchaseRequestId = ceilingRows[0].business_case_id;
      await client.query(
        `UPDATE public.equipment_purchase_requests
            SET status = 'waiting_dispatch', updated_at = NOW()
          WHERE id = $1 AND status = 'contract_available'`,
        [purchaseRequestId],
      );
    }

    await enqueueIntegrationEvent({
      eventType: "delivery_request.confirmed",
      payload: {
        delivery_request_id: normalizedRequestId,
        delivery_ceiling_id: ceilingId,
        dispatch_id: dispatchId,
        confirmed_at: updatedRequestRows[0].confirmed_at || null,
        lines: appliedLines,
        remainder_request_id: remainderRequest ? remainderRequest.id : null,
      },
      idempotencyKey: `delivery_request:${normalizedRequestId}:confirmed`,
      correlationId: null,
      dbClient: client,
    });

    await client.query("COMMIT");
    return {
      request: mapRequest(updatedRequestRows[0]),
      dispatch_id: dispatchId,
      applied_lines: appliedLines,
      remainder_request: remainderRequest,
      open_statuses_used_for_reservation: [...OPEN_REQUEST_STATUSES],
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ rollbackError: rollbackError.message }, "Error en rollback confirmDeliveryRequest");
    }
    throw parsePgError(error);
  } finally {
    client.release();
  }
}

/**
 * opsApproveRequest
 * Ops reviews a pending delivery request and sets how much to actually send
 * per line (approved_qty). If lines are omitted, approved_qty = requested_qty
 * (approve all as-is). approved_qty can be less than requested_qty (partial).
 *
 * @param {object} options
 * @param {number} options.requestId
 * @param {Array<{lineId: number, approvedQty: number}>} [options.lines]
 * @param {object|null} [options.actorUser]
 */
async function opsApproveRequest({ requestId, lines = [], actorUser = null } = {}) {
  const normalizedRequestId = asPositiveInteger(requestId, "requestId");
  const actorUserId = getActorId(actorUser);

  // Validate per-line approved quantities if provided
  const approvedByLine = new Map();
  if (Array.isArray(lines) && lines.length > 0) {
    lines.forEach((line, idx) => {
      const lineId = asPositiveInteger(line?.lineId, `lines[${idx}].lineId`);
      const approvedQty = asPositiveNumeric(line?.approvedQty, `lines[${idx}].approvedQty`);
      approvedByLine.set(lineId, approvedQty);
    });
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT * FROM public.delivery_request WHERE id = $1 FOR UPDATE`,
      [normalizedRequestId],
    );

    if (!rows.length) {
      throw buildError("delivery_request no encontrado", {
        status: 404,
        code: "DELIVERY_REQUEST_NOT_FOUND",
      });
    }

    const requestRow = rows[0];
    if (requestRow.status !== "pending") {
      throw buildError("Solo se pueden aprobar solicitudes en estado pendiente", {
        status: 409,
        code: "DELIVERY_REQUEST_NOT_PENDING",
        details: { current_status: requestRow.status },
      });
    }

    await getCeilingForUpdate(client, Number(requestRow.delivery_ceiling_id));

    // Load lines to validate approved_qty <= requested_qty
    const { rows: lineRows } = await client.query(
      `SELECT id, delivery_ceiling_line_id, requested_qty
         FROM public.delivery_request_line
        WHERE delivery_request_id = $1`,
      [normalizedRequestId],
    );

    for (const lineRow of lineRows) {
      const lineId = Number(lineRow.id);
      const requestedQty = Number(lineRow.requested_qty);
      const approvedQty = approvedByLine.get(lineId) ?? requestedQty;

      if (approvedQty > requestedQty + EPSILON) {
        throw buildError(`La cantidad aprobada no puede superar la solicitada (línea ${lineId})`, {
          status: 400,
          code: "APPROVED_EXCEEDS_REQUESTED",
          details: { line_id: lineId, approved_qty: approvedQty, requested_qty: requestedQty },
        });
      }

      await client.query(
        `UPDATE public.delivery_request_line
            SET approved_qty = $2, updated_at = NOW()
          WHERE id = $1`,
        [lineId, Number(approvedQty.toFixed(3))],
      );
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE public.delivery_request
          SET status           = 'ops_approved',
              ops_approved_by  = $2,
              ops_approved_at  = NOW(),
              updated_at       = NOW()
        WHERE id = $1
        RETURNING *`,
      [normalizedRequestId, actorUserId],
    );

    await client.query("COMMIT");

    const { rows: updatedLineRows } = await db.query(
      `SELECT * FROM public.delivery_request_line WHERE delivery_request_id = $1`,
      [normalizedRequestId],
    );

    return {
      request: mapRequest(updatedRows[0]),
      lines: updatedLineRows.map(mapRequestLine),
    };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) { /* ignore */ }
    throw parsePgError(error);
  } finally {
    client.release();
  }
}

async function cancelDeliveryRequest({ requestId, actorUser = null } = {}) {
  const normalizedRequestId = asPositiveInteger(requestId, "requestId");
  const actorUserId = getActorId(actorUser);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT * FROM public.delivery_request WHERE id = $1 FOR UPDATE`,
      [normalizedRequestId],
    );

    if (!rows.length) {
      throw buildError("delivery_request no encontrado", { status: 404, code: "DELIVERY_REQUEST_NOT_FOUND" });
    }

    const requestRow = rows[0];
    if (requestRow.status === "confirmed" || requestRow.status === "cancelled") {
      throw buildError("No se puede cancelar una solicitud ya confirmada o cancelada", {
        status: 409,
        code: "DELIVERY_REQUEST_ALREADY_TERMINAL",
        details: { current_status: requestRow.status },
      });
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE public.delivery_request
          SET status     = 'cancelled',
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [normalizedRequestId, actorUserId],
    );
    void actorUserId;

    await client.query("COMMIT");
    return { request: mapRequest(updatedRows[0]) };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) { /* ignore */ }
    throw parsePgError(error);
  } finally {
    client.release();
  }
}

async function listDeliveryRequests({ ceilingId = null, status = null, limit = 100 } = {}) {
  const safeCeilingId = ceilingId ? asPositiveInteger(ceilingId, "ceilingId") : null;
  const safeLimit = Math.min(200, Math.max(1, Number.parseInt(String(limit || 100), 10) || 100));

  const params = [];
  const where = [];

  if (safeCeilingId) {
    params.push(safeCeilingId);
    where.push(`dr.delivery_ceiling_id = $${params.length}`);
  }
  if (status) {
    params.push(String(status).trim());
    where.push(`dr.status = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows: requestRows } = await db.query(
    `SELECT dr.*
       FROM public.delivery_request dr
       ${whereSql}
       ORDER BY dr.created_at DESC
       LIMIT $${params.length + 1}`,
    [...params, safeLimit],
  );

  if (!requestRows.length) return [];

  const requestIds = requestRows.map((r) => Number(r.id));
  const { rows: lineRows } = await db.query(
    `SELECT
       rl.*,
       cl.item_type,
       cl.unit,
       cl.max_quantity,
       cl.delivered_qty
     FROM public.delivery_request_line rl
     INNER JOIN public.delivery_ceiling_line cl ON cl.id = rl.delivery_ceiling_line_id
     WHERE rl.delivery_request_id = ANY($1::int[])`,
    [requestIds],
  );

  const linesByRequest = new Map();
  lineRows.forEach((row) => {
    const reqId = Number(row.delivery_request_id);
    if (!linesByRequest.has(reqId)) linesByRequest.set(reqId, []);
    linesByRequest.get(reqId).push({
      id: Number(row.id),
      delivery_ceiling_line_id: Number(row.delivery_ceiling_line_id),
      requested_qty: Number(row.requested_qty),
      item_type: row.item_type,
      unit: row.unit,
    });
  });

  return requestRows.map((row) => ({
    ...mapRequest(row),
    lines: linesByRequest.get(Number(row.id)) || [],
  }));
}

/**
 * listDeliveryDispatches
 * Returns all dispatch records for a given ceiling or request, with per-line quantities.
 */
async function listDeliveryDispatches({ ceilingId = null, requestId = null, limit = 100 } = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number.parseInt(String(limit || 100), 10) || 100));

  const params = [];
  const where = [];

  if (ceilingId) {
    params.push(asPositiveInteger(ceilingId, "ceilingId"));
    where.push(`dr.delivery_ceiling_id = $${params.length}`);
  }
  if (requestId) {
    params.push(asPositiveInteger(requestId, "requestId"));
    where.push(`dd.delivery_request_id = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows: dispatchRows } = await db.query(
    `SELECT
       dd.id,
       dd.delivery_request_id,
       dd.dispatched_by,
       dd.dispatched_at,
       dd.notes,
       dd.created_at,
       dr.delivery_ceiling_id
     FROM public.delivery_dispatch dd
     INNER JOIN public.delivery_request dr ON dr.id = dd.delivery_request_id
     ${whereSql}
     ORDER BY dd.dispatched_at DESC
     LIMIT $${params.length + 1}`,
    [...params, safeLimit],
  );

  if (!dispatchRows.length) return [];

  const dispatchIds = dispatchRows.map((r) => Number(r.id));
  const { rows: dispatchLineRows } = await db.query(
    `SELECT
       ddl.id,
       ddl.delivery_dispatch_id,
       ddl.delivery_ceiling_line_id,
       ddl.dispatched_qty,
       cl.item_type,
       cl.unit,
       cl.max_quantity,
       cl.delivered_qty
     FROM public.delivery_dispatch_line ddl
     INNER JOIN public.delivery_ceiling_line cl ON cl.id = ddl.delivery_ceiling_line_id
     WHERE ddl.delivery_dispatch_id = ANY($1::int[])`,
    [dispatchIds],
  );

  const linesByDispatch = new Map();
  dispatchLineRows.forEach((row) => {
    const dId = Number(row.delivery_dispatch_id);
    if (!linesByDispatch.has(dId)) linesByDispatch.set(dId, []);
    linesByDispatch.get(dId).push({
      id: Number(row.id),
      delivery_ceiling_line_id: Number(row.delivery_ceiling_line_id),
      dispatched_qty: Number(row.dispatched_qty),
      item_type: row.item_type,
      unit: row.unit,
    });
  });

  return dispatchRows.map((row) => ({
    id: Number(row.id),
    delivery_request_id: Number(row.delivery_request_id),
    delivery_ceiling_id: Number(row.delivery_ceiling_id),
    dispatched_by: row.dispatched_by ? Number(row.dispatched_by) : null,
    dispatched_at: row.dispatched_at,
    notes: row.notes || null,
    created_at: row.created_at,
    lines: linesByDispatch.get(Number(row.id)) || [],
  }));
}

async function notifyOpsNewSupplyRequest({ requestId, ceilingId }) {
  try {
    const { rows: metaRows } = await db.query(
      `SELECT p.client_snapshot, p.equipment
         FROM public.delivery_ceiling c
         LEFT JOIN public.private_purchase_requests p ON p.id::text = c.private_purchase_id::text
        WHERE c.id = $1
        LIMIT 1`,
      [ceilingId],
    );
    const meta = metaRows[0] || {};
    const clientName =
      meta?.client_snapshot?.commercial_name ||
      meta?.client_snapshot?.name ||
      "Cliente";
    const equipmentName = Array.isArray(meta?.equipment)
      ? meta.equipment.map((item) => item?.name || item?.label || item?.sku).filter(Boolean).join(", ")
      : "";

    const { rows: recipients } = await db.query(
      `SELECT id FROM users WHERE role = 'jefe_operaciones' AND active = true`,
    );
    if (!recipients.length) return;

    await Promise.all(recipients.map((recipient) => notificationManager.sendNotification({
      userId: recipient.id,
      customTitle: "Nuevo pedido de insumos recibido",
      customMessage: `Cliente: ${clientName}. Equipo: ${equipmentName || "N/D"}. Pedido #${requestId}.`,
      type: "info",
      source: "supply_control_request",
      priority: 1,
      data: { delivery_request_id: requestId, delivery_ceiling_id: ceilingId },
      email: true,
      chat: false,
    })));
  } catch (notifyError) {
    logger.warn({ notifyError: notifyError.message, requestId, ceilingId }, "No se pudo notificar pedido de insumos a jefe_operaciones");
  }
}

/**
 * OPEN_ORDER_ITEM_TYPES
 * Predefined item categories for private purchases without a BC.
 * No max_quantity — the system tracks totals without enforcing a ceiling.
 */
const OPEN_ORDER_ITEM_TYPES = [...OPEN_ORDER_FALLBACK_ITEMS];

async function resolveOpenOrderItemsForPrivatePurchase(client, privatePurchaseId) {
  const { rows: purchaseRows } = await client.query(
    `SELECT business_case_id, equipment
       FROM public.private_purchase_requests
      WHERE id::text = $1
      LIMIT 1`,
    [String(privatePurchaseId)],
  );
  if (!purchaseRows.length) return [...OPEN_ORDER_ITEM_TYPES];

  const purchase = purchaseRows[0];
  const items = [];

  if (purchase.business_case_id) {
    const { rows: bcRows } = await client.query(
      `SELECT name, item_type
         FROM public.bc_consumption_items
        WHERE business_case_id = $1
          AND COALESCE(annual_qty, 0) > 0
        ORDER BY name ASC`,
      [purchase.business_case_id],
    );
    bcRows.forEach((row) => {
      const name = String(row.name || "").trim();
      if (!name) return;
      items.push({ name, type: normalizeOpenOrderType(row.item_type), unit: "unidad" });
    });
  }

  if (!items.length) {
    const modelIds = pickModelIdsFromEquipment(purchase.equipment);
    if (modelIds.length) {
      const { rows: modelRows } = await client.query(
        `SELECT cc.name, cc.type, COALESCE(NULLIF(cc.unit, ''), 'unidad') AS unit
           FROM public.catalog_equipment_consumables cec
           JOIN public.catalog_consumables cc ON cc.id = cec.consumable_id
          WHERE cec.equipment_id = ANY($1::int[])
          ORDER BY cc.name ASC`,
        [modelIds],
      );
      modelRows.forEach((row) => {
        const name = String(row.name || "").trim();
        if (!name) return;
        items.push({ name, type: normalizeOpenOrderType(row.type), unit: String(row.unit || "unidad").trim() || "unidad" });
      });
    }
  }

  const dedup = new Map();
  items.forEach((item) => {
    const key = `${item.type}|${item.name.toLowerCase()}`;
    if (!dedup.has(key)) dedup.set(key, item);
  });

  return dedup.size ? Array.from(dedup.values()) : [...OPEN_ORDER_ITEM_TYPES];
}

/**
 * createOpenOrderCeiling
 * Auto-creates a delivery_ceiling + 4 open lines (no max) for a private
 * purchase that uses open_orders supply control (no BC linked).
 * Safe to call multiple times — won't create duplicates.
 *
 * @param {string|number} privatePurchaseId
 * @returns {object} ceiling row
 */
async function createOpenOrderCeiling(privatePurchaseId) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Check if an open-order ceiling already exists for this purchase
    const { rows: existing } = await client.query(
      `SELECT id FROM public.delivery_ceiling
        WHERE private_purchase_id = $1 AND purchase_type = 'private'
        LIMIT 1`,
      [String(privatePurchaseId)],
    );
    if (existing.length) {
      await client.query("COMMIT");
      return existing[0];
    }

    // Create the ceiling (no business_case_id for open orders)
    const { rows: ceilingRows } = await client.query(
      `INSERT INTO public.delivery_ceiling
         (purchase_type, private_purchase_id, status, created_at, updated_at)
       VALUES ('private', $1, 'active', NOW(), NOW())
       RETURNING *`,
      [String(privatePurchaseId)],
    );
    const ceilingId = Number(ceilingRows[0].id);

    // Create lines with max_quantity = NULL (unlimited) from BC or model-linked catalog.
    const openItems = await resolveOpenOrderItemsForPrivatePurchase(client, privatePurchaseId);
    for (const item of openItems) {
      await client.query(
        `INSERT INTO public.delivery_ceiling_line
           (delivery_ceiling_id, item_type, unit, max_quantity, delivered_qty, created_at, updated_at)
         VALUES ($1, $2, $3, NULL, 0, NOW(), NOW())`,
        [ceilingId, item.name, item.unit],
      );
    }

    await client.query("COMMIT");
    logger.info({ ceilingId, privatePurchaseId }, "open_order ceiling created");
    return ceilingRows[0];
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) { /* ignore */ }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  DELIVERY_REQUEST_STATUSES,
  OPEN_REQUEST_STATUSES,
  OPEN_ORDER_ITEM_TYPES,
  createDeliveryRequest,
  opsApproveRequest,
  cancelDeliveryRequest,
  confirmDeliveryRequest,
  listDeliveryRequests,
  listDeliveryDispatches,
  createOpenOrderCeiling,
};
