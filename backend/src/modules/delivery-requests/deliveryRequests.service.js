const db = require("../../config/db");
const logger = require("../../config/logger");
const { enqueueIntegrationEvent } = require("../integrations/integrationOutbox.service");

const DELIVERY_REQUEST_STATUSES = Object.freeze(["pending", "confirmed", "cancelled"]);

// "Open" requests reserve saldo but are not yet confirmed into delivered_qty.
const OPEN_REQUEST_STATUSES = Object.freeze(["pending"]);
const EPSILON = 1e-9;

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
  notes: row.notes || null,
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
  created_at: row.created_at,
  updated_at: row.updated_at,
});

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
} = {}) {
  const normalizedCeilingId = asPositiveInteger(ceilingId, "ceilingId");
  const normalizedLines = normalizeLinesPayload(lines);
  const normalizedAsOfDate = asOfDate ? asDateOnly(asOfDate, "asOfDate") : new Date().toISOString().slice(0, 10);
  const normalizedNotes = asTrimmedText(notes, null);
  const actorUserId = getActorId(actorUser);

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

    await client.query("COMMIT");
    return {
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
    };
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

async function confirmDeliveryRequest({
  requestId,
  actorUser = null,
} = {}) {
  const normalizedRequestId = asPositiveInteger(requestId, "requestId");
  const actorUserId = getActorId(actorUser);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: requestRows } = await client.query(
      `
      SELECT *
      FROM public.delivery_request
      WHERE id = $1
      FOR UPDATE
      `,
      [normalizedRequestId],
    );

    if (!requestRows.length) {
      throw buildError("delivery_request no encontrado", {
        status: 404,
        code: "DELIVERY_REQUEST_NOT_FOUND",
      });
    }

    const requestRow = requestRows[0];
    if (requestRow.status !== "pending") {
      throw buildError("Solo se pueden confirmar solicitudes en estado pending", {
        status: 409,
        code: "DELIVERY_REQUEST_NOT_PENDING",
        details: { current_status: requestRow.status },
      });
    }

    const ceilingId = Number(requestRow.delivery_ceiling_id);
    await getCeilingForUpdate(client, ceilingId);

    const { rows: requestLineRows } = await client.query(
      `
      SELECT
        rl.id,
        rl.delivery_request_id,
        rl.delivery_ceiling_line_id,
        rl.requested_qty,
        rl.created_at,
        rl.updated_at,
        cl.max_quantity,
        cl.delivered_qty
      FROM public.delivery_request_line rl
      INNER JOIN public.delivery_ceiling_line cl
        ON cl.id = rl.delivery_ceiling_line_id
      WHERE rl.delivery_request_id = $1
      FOR UPDATE OF rl, cl
      `,
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

    const normalizedLines = requestLineRows.map((row) => ({
      ceilingLineId: Number(row.delivery_ceiling_line_id),
      requestedQty: Number(row.requested_qty),
    }));

    validateRequestedAgainstRemaining({
      normalizedLines,
      ceilingLines: requestLineRows.map((row) => ({
        id: row.delivery_ceiling_line_id,
        max_quantity: row.max_quantity,
        delivered_qty: row.delivered_qty,
      })),
      reservedByLine,
    });

    const appliedLines = [];
    for (const row of requestLineRows) {
      const requestedQty = Number(row.requested_qty);
      const { rows } = await client.query(
        `
        UPDATE public.delivery_ceiling_line
        SET
          delivered_qty = delivered_qty + $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, delivered_qty, max_quantity
        `,
        [row.delivery_ceiling_line_id, requestedQty],
      );

      const updatedLine = rows[0];
      appliedLines.push({
        delivery_ceiling_line_id: Number(updatedLine.id),
        requested_qty: Number(requestedQty.toFixed(3)),
        delivered_qty_after: Number(Number(updatedLine.delivered_qty).toFixed(3)),
        remaining_after: Number(
          Math.max(0, Number(updatedLine.max_quantity) - Number(updatedLine.delivered_qty)).toFixed(3),
        ),
      });
    }

    const { rows: updatedRequestRows } = await client.query(
      `
      UPDATE public.delivery_request
      SET
        status = 'confirmed',
        confirmed_by = $2,
        confirmed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [normalizedRequestId, actorUserId],
    );

    await enqueueIntegrationEvent({
      eventType: "delivery_request.confirmed",
      payload: {
        delivery_request_id: Number(updatedRequestRows[0].id),
        delivery_ceiling_id: Number(updatedRequestRows[0].delivery_ceiling_id),
        confirmed_at: updatedRequestRows[0].confirmed_at || null,
        lines: appliedLines.map((line) => ({
          delivery_ceiling_line_id: line.delivery_ceiling_line_id,
          requested_qty: line.requested_qty,
          delivered_qty_after: line.delivered_qty_after,
          remaining_after: line.remaining_after,
        })),
      },
      idempotencyKey: `delivery_request:${normalizedRequestId}:confirmed`,
      correlationId: null,
      dbClient: client,
    });

    await client.query("COMMIT");
    return {
      request: mapRequest(updatedRequestRows[0]),
      applied_lines: appliedLines,
      open_statuses_used_for_reservation: [...OPEN_REQUEST_STATUSES],
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(
        { rollbackError: rollbackError.message },
        "Error en rollback confirmDeliveryRequest",
      );
    }
    throw parsePgError(error);
  } finally {
    client.release();
  }
}

module.exports = {
  DELIVERY_REQUEST_STATUSES,
  OPEN_REQUEST_STATUSES,
  createDeliveryRequest,
  confirmDeliveryRequest,
};
