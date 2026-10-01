const db = require("../../config/db");
const logger = require("../../config/logger");

const PUBLIC_DELIVERY_PLAN_STATUSES = Object.freeze(["draft", "approved", "cancelled"]);

const STATE_TRANSITIONS = Object.freeze({
  draft: new Set(["approved", "cancelled"]),
  approved: new Set(["cancelled"]),
  cancelled: new Set([]),
});

const buildError = (
  message,
  { status = 400, code = "PUBLIC_DELIVERY_PLAN_ERROR", details = null } = {},
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
      code: "PUBLIC_DELIVERY_PLAN_INVALID_INPUT",
      details: { field: fieldName },
    });
  }
  return parsed;
};

const asPositiveNumeric = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw buildError(`${fieldName} debe ser mayor a 0`, {
      code: "PUBLIC_DELIVERY_PLAN_INVALID_INPUT",
      details: { field: fieldName },
    });
  }
  return parsed;
};

const asDateOnly = (value, fieldName) => {
  const normalized = asTrimmedText(value);
  if (!normalized) {
    throw buildError(`${fieldName} es requerido`, {
      code: "PUBLIC_DELIVERY_PLAN_INVALID_INPUT",
      details: { field: fieldName },
    });
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw buildError(`${fieldName} invalido`, {
      code: "PUBLIC_DELIVERY_PLAN_INVALID_INPUT",
      details: { field: fieldName },
    });
  }

  return parsed.toISOString().slice(0, 10);
};

const getActorId = (actorUser) => {
  if (!actorUser) return null;
  const candidate = actorUser.id || actorUser.user_id || null;
  const parsed = Number.parseInt(String(candidate ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parsePgError = (error) => {
  if (!error?.code) return error;

  if (error.code === "23503") {
    return buildError("Referencia invalida en public delivery plan", {
      status: 400,
      code: "PUBLIC_DELIVERY_PLAN_REFERENCE_INVALID",
      details: { constraint: error.constraint || null },
    });
  }

  if (error.code === "23505") {
    return buildError("Conflicto de unicidad en public delivery plan", {
      status: 409,
      code: "PUBLIC_DELIVERY_PLAN_DUPLICATE",
      details: { constraint: error.constraint || null },
    });
  }

  if (error.code === "23514") {
    return buildError("Validacion de negocio incumplida en public delivery plan", {
      status: 400,
      code: "PUBLIC_DELIVERY_PLAN_CHECK_VIOLATION",
      details: { constraint: error.constraint || null },
    });
  }

  return error;
};

const mapPlan = (row) => ({
  id: Number(row.id),
  delivery_ceiling_id: Number(row.delivery_ceiling_id),
  status: row.status,
  notes: row.notes || null,
  created_by: row.created_by ? Number(row.created_by) : null,
  updated_by: row.updated_by ? Number(row.updated_by) : null,
  approved_by: row.approved_by ? Number(row.approved_by) : null,
  approved_at: row.approved_at || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapPlanLine = (row) => ({
  id: Number(row.id),
  public_delivery_plan_id: Number(row.public_delivery_plan_id),
  delivery_ceiling_line_id: Number(row.delivery_ceiling_line_id),
  scheduled_start: row.scheduled_start,
  scheduled_end: row.scheduled_end,
  max_qty_tranche: Number(row.max_qty_tranche),
  notes: row.notes || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const assertStatus = (status) => {
  if (!PUBLIC_DELIVERY_PLAN_STATUSES.includes(status)) {
    throw buildError("status no permitido", {
      code: "PUBLIC_DELIVERY_PLAN_INVALID_STATUS",
      details: { allowed: PUBLIC_DELIVERY_PLAN_STATUSES },
    });
  }
};

const ensurePublicCeiling = async (client, deliveryCeilingId) => {
  const { rows } = await client.query(
    `
    SELECT id, purchase_type
    FROM public.delivery_ceiling
    WHERE id = $1
    LIMIT 1
    `,
    [deliveryCeilingId],
  );

  if (!rows.length) {
    throw buildError("delivery_ceiling no encontrado", {
      status: 404,
      code: "DELIVERY_CEILING_NOT_FOUND",
    });
  }

  const ceiling = rows[0];
  if (ceiling.purchase_type !== "public") {
    throw buildError("El delivery_ceiling no es de compra publica", {
      status: 400,
      code: "PUBLIC_DELIVERY_PLAN_CEILING_NOT_PUBLIC",
      details: { purchase_type: ceiling.purchase_type },
    });
  }

  return ceiling;
};

const getPlanForUpdate = async (client, planId) => {
  const { rows } = await client.query(
    `
    SELECT *
    FROM public.public_delivery_plan
    WHERE id = $1
    FOR UPDATE
    `,
    [planId],
  );

  if (!rows.length) {
    throw buildError("public_delivery_plan no encontrado", {
      status: 404,
      code: "PUBLIC_DELIVERY_PLAN_NOT_FOUND",
    });
  }

  return rows[0];
};

async function createDraft({
  deliveryCeilingId,
  notes = null,
  actorUser = null,
} = {}) {
  const normalizedDeliveryCeilingId = asPositiveInteger(
    deliveryCeilingId,
    "deliveryCeilingId",
  );
  const normalizedNotes = asTrimmedText(notes, null);
  const userId = getActorId(actorUser);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await ensurePublicCeiling(client, normalizedDeliveryCeilingId);

    const { rows } = await client.query(
      `
      INSERT INTO public.public_delivery_plan (
        delivery_ceiling_id,
        status,
        notes,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES ($1, 'draft', $2, $3, $3, NOW(), NOW())
      RETURNING *
      `,
      [normalizedDeliveryCeilingId, normalizedNotes, userId],
    );

    await client.query("COMMIT");
    return mapPlan(rows[0]);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(
        { rollbackError: rollbackError.message },
        "Error en rollback createDraft public delivery plan",
      );
    }
    throw parsePgError(error);
  } finally {
    client.release();
  }
}

async function addLine({
  planId,
  deliveryCeilingLineId,
  scheduledStart,
  scheduledEnd,
  maxQtyTranche,
  notes = null,
  actorUser = null,
} = {}) {
  const normalizedPlanId = asPositiveInteger(planId, "planId");
  const normalizedLineId = asPositiveInteger(deliveryCeilingLineId, "deliveryCeilingLineId");
  const normalizedStart = asDateOnly(scheduledStart, "scheduledStart");
  const normalizedEnd = asDateOnly(scheduledEnd, "scheduledEnd");
  if (normalizedEnd < normalizedStart) {
    throw buildError("scheduledEnd no puede ser menor a scheduledStart", {
      code: "PUBLIC_DELIVERY_PLAN_INVALID_DATE_RANGE",
    });
  }
  const normalizedMaxQty = asPositiveNumeric(maxQtyTranche, "maxQtyTranche");
  const normalizedNotes = asTrimmedText(notes, null);
  const userId = getActorId(actorUser);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const plan = await getPlanForUpdate(client, normalizedPlanId);
    await ensurePublicCeiling(client, plan.delivery_ceiling_id);

    if (plan.status !== "draft") {
      throw buildError("Solo se pueden agregar lineas en estado draft", {
        status: 409,
        code: "PUBLIC_DELIVERY_PLAN_LINES_LOCKED",
        details: { current_status: plan.status },
      });
    }

    const { rows: ceilingLineRows } = await client.query(
      `
      SELECT id
      FROM public.delivery_ceiling_line
      WHERE id = $1
        AND delivery_ceiling_id = $2
      LIMIT 1
      `,
      [normalizedLineId, plan.delivery_ceiling_id],
    );

    if (!ceilingLineRows.length) {
      throw buildError("delivery_ceiling_line no pertenece al delivery_ceiling del plan", {
        status: 400,
        code: "PUBLIC_DELIVERY_PLAN_ITEM_NOT_ALLOWED",
        details: {
          delivery_ceiling_line_id: normalizedLineId,
          delivery_ceiling_id: Number(plan.delivery_ceiling_id),
        },
      });
    }

    const { rows: insertedRows } = await client.query(
      `
      INSERT INTO public.public_delivery_plan_line (
        public_delivery_plan_id,
        delivery_ceiling_line_id,
        scheduled_start,
        scheduled_end,
        max_qty_tranche,
        notes,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
      `,
      [
        normalizedPlanId,
        normalizedLineId,
        normalizedStart,
        normalizedEnd,
        normalizedMaxQty,
        normalizedNotes,
      ],
    );

    await client.query(
      `
      UPDATE public.public_delivery_plan
      SET
        updated_by = $2,
        updated_at = NOW()
      WHERE id = $1
      `,
      [normalizedPlanId, userId],
    );

    await client.query("COMMIT");
    return mapPlanLine(insertedRows[0]);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(
        { rollbackError: rollbackError.message },
        "Error en rollback addLine public delivery plan",
      );
    }
    throw parsePgError(error);
  } finally {
    client.release();
  }
}

async function transitionStatus({
  planId,
  toStatus,
  reason = null,
  actorUser = null,
} = {}) {
  const normalizedPlanId = asPositiveInteger(planId, "planId");
  const normalizedToStatus = asTrimmedText(toStatus);
  assertStatus(normalizedToStatus);
  const normalizedReason = asTrimmedText(reason, null);
  const userId = getActorId(actorUser);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const current = await getPlanForUpdate(client, normalizedPlanId);
    const fromStatus = current.status;
    const allowed = STATE_TRANSITIONS[fromStatus] || new Set();

    if (!allowed.has(normalizedToStatus)) {
      throw buildError(
        `Transicion invalida de public_delivery_plan: ${fromStatus} -> ${normalizedToStatus}`,
        {
          status: 400,
          code: "PUBLIC_DELIVERY_PLAN_INVALID_STATUS_TRANSITION",
          details: {
            from_status: fromStatus,
            to_status: normalizedToStatus,
            allowed_to: Array.from(allowed),
          },
        },
      );
    }

    if (normalizedToStatus === "approved") {
      const { rows: countRows } = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM public.public_delivery_plan_line
        WHERE public_delivery_plan_id = $1
        `,
        [normalizedPlanId],
      );
      const totalLines = Number(countRows[0]?.total || 0);
      if (totalLines < 1) {
        throw buildError("No se puede aprobar un plan sin lineas", {
          status: 400,
          code: "PUBLIC_DELIVERY_PLAN_LINES_REQUIRED",
        });
      }
    }

    const approvedBy = normalizedToStatus === "approved" ? userId : null;
    const approvedAt = normalizedToStatus === "approved" ? "NOW()" : "approved_at";

    const { rows } = await client.query(
      `
      UPDATE public.public_delivery_plan
      SET
        status = $2,
        notes = COALESCE($3, notes),
        updated_by = $4,
        updated_at = NOW(),
        approved_by = ${normalizedToStatus === "approved" ? "$4" : "approved_by"},
        approved_at = ${approvedAt}
      WHERE id = $1
      RETURNING *
      `,
      [normalizedPlanId, normalizedToStatus, normalizedReason, approvedBy || userId],
    );

    await client.query("COMMIT");
    return mapPlan(rows[0]);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(
        { rollbackError: rollbackError.message },
        "Error en rollback transitionStatus public delivery plan",
      );
    }
    throw parsePgError(error);
  } finally {
    client.release();
  }
}

async function list({
  deliveryCeilingId,
  status,
  page = 1,
  limit = 25,
} = {}) {
  const safePage = Math.max(1, Number.parseInt(String(page || "1"), 10));
  const safeLimit = Math.min(200, Math.max(1, Number.parseInt(String(limit || "25"), 10)));
  const offset = (safePage - 1) * safeLimit;

  const params = [];
  const where = [];

  if (deliveryCeilingId !== undefined && deliveryCeilingId !== null) {
    params.push(asPositiveInteger(deliveryCeilingId, "deliveryCeilingId"));
    where.push(`p.delivery_ceiling_id = $${params.length}`);
  }

  if (status) {
    assertStatus(status);
    params.push(status);
    where.push(`p.status = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const listSql = `
    SELECT p.*, COUNT(*) OVER()::int AS total_count
    FROM public.public_delivery_plan p
    ${whereSql}
    ORDER BY p.updated_at DESC, p.id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  const { rows: rawRows } = await db.query(listSql, [...params, safeLimit, offset]);
  const total = rawRows.length > 0 ? rawRows[0].total_count : 0;
  const listResult = { rows: rawRows.map(({ total_count, ...row }) => row) };

  const planIds = listResult.rows.map((row) => Number(row.id));
  const linesByPlan = new Map();
  if (planIds.length) {
    const { rows: lineRows } = await db.query(
      `
      SELECT *
      FROM public.public_delivery_plan_line
      WHERE public_delivery_plan_id = ANY($1::bigint[])
      ORDER BY scheduled_start ASC, id ASC
      `,
      [planIds],
    );

    lineRows.forEach((lineRow) => {
      const key = Number(lineRow.public_delivery_plan_id);
      const bucket = linesByPlan.get(key) || [];
      bucket.push(mapPlanLine(lineRow));
      linesByPlan.set(key, bucket);
    });
  }

  return {
    page: safePage,
    limit: safeLimit,
    total,
    rows: listResult.rows.map((row) => ({
      ...mapPlan(row),
      lines: linesByPlan.get(Number(row.id)) || [],
    })),
  };
}

module.exports = {
  PUBLIC_DELIVERY_PLAN_STATUSES,
  createDraft,
  addLine,
  transitionStatus,
  list,
};
