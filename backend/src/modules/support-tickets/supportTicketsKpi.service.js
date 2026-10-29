/**
 * Motor de KPIs configurables para el workspace de tickets de soporte TI.
 *
 * Diseno de seguridad: jefe_ti puede crear KPIs nuevos en tiempo de
 * ejecucion, pero nunca escribe SQL ni formulas libres. Cada definicion
 * combina un `metric_type` de un catalogo cerrado (METRIC_CATALOG) con
 * filtros cuyas claves y valores estan whitelisteados contra
 * FILTERABLE_FIELDS (que a su vez reutiliza los Set ya validados de
 * supportTickets.service.js). Toda condicion se arma parametrizada
 * (`column = ANY($n)`), nunca por interpolacion de string.
 */
const db = require("../../config/db");
const {
  TICKET_TYPES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  ALLOWED_LVL,
} = require("./supportTickets.service");

const METRIC_CATALOG = {
  ticket_count: { label: "Conteo de tickets", unit: "tickets", defaultGoalDirection: "gte" },
  sla_response_compliance_pct: { label: "Cumplimiento SLA de respuesta", unit: "%", defaultGoalDirection: "gte" },
  sla_resolution_compliance_pct: { label: "Cumplimiento SLA de resolucion", unit: "%", defaultGoalDirection: "gte" },
  avg_response_minutes: { label: "Tiempo promedio de primera respuesta", unit: "minutos", defaultGoalDirection: "lte" },
  avg_cycle_minutes: { label: "Tiempo promedio de ciclo total", unit: "minutos", defaultGoalDirection: "lte" },
  avg_delivery_minutes: { label: "Tiempo promedio de entrega TI", unit: "minutos", defaultGoalDirection: "lte" },
  csat_avg: { label: "Satisfaccion promedio (CSAT)", unit: "puntos (1-5)", defaultGoalDirection: "gte" },
};

const FILTERABLE_FIELDS = {
  status: { column: "t.status", label: "Estado", allowed: new Set(TICKET_STATUSES) },
  ticket_type: { column: "t.ticket_type", label: "Tipo de ticket", allowed: new Set(TICKET_TYPES) },
  priority: { column: "t.priority", label: "Prioridad", allowed: new Set(TICKET_PRIORITIES) },
  impact: { column: "t.impact", label: "Impacto", allowed: new Set(ALLOWED_LVL) },
  urgency: { column: "t.urgency", label: "Urgencia", allowed: new Set(ALLOWED_LVL) },
  category: { column: "t.category", label: "Categoria", allowed: null, isText: true },
  assigned_ti_user_id: { column: "t.assigned_ti_user_id", label: "Tecnico asignado", allowed: null, isInteger: true },
};

const PERIOD_TYPES = new Set(["current_month", "last_7_days", "last_30_days", "last_n_months", "all_time"]);
const GOAL_DIRECTIONS = new Set(["gte", "lte"]);

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function notFound(message = "KPI no encontrado") {
  const err = new Error(message);
  err.status = 404;
  return err;
}

// ── Validacion ──────────────────────────────────────────────────────────

function validateFilters(filters) {
  if (filters === null || filters === undefined) return {};
  if (typeof filters !== "object" || Array.isArray(filters)) {
    throw badRequest("filters debe ser un objeto");
  }

  const clean = {};
  for (const [key, rawValue] of Object.entries(filters)) {
    const field = FILTERABLE_FIELDS[key];
    if (!field) {
      throw badRequest(`Filtro no permitido: ${key}`);
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    if (!values.length) continue;

    if (field.isInteger) {
      const ints = values.map((v) => Number(v));
      if (ints.some((v) => !Number.isInteger(v) || v <= 0)) {
        throw badRequest(`Filtro ${key} debe contener solo IDs enteros positivos`);
      }
      clean[key] = ints;
      continue;
    }

    if (field.isText) {
      const texts = values.map((v) => String(v || "").trim().slice(0, 100)).filter(Boolean);
      if (!texts.length) continue;
      clean[key] = texts;
      continue;
    }

    const normalized = values.map((v) => String(v || "").trim().toLowerCase());
    const invalid = normalized.find((v) => !field.allowed.has(v));
    if (invalid) {
      throw badRequest(`Valor no permitido para ${key}: ${invalid}`);
    }
    clean[key] = normalized;
  }

  return clean;
}

function validateKpiPayload(payload = {}, { partial = false } = {}) {
  const out = {};

  if (!partial || payload.name !== undefined) {
    const name = String(payload.name || "").trim();
    if (name.length < 3 || name.length > 120) {
      throw badRequest("name debe tener entre 3 y 120 caracteres");
    }
    out.name = name;
  }

  if (payload.description !== undefined) {
    out.description = payload.description ? String(payload.description).trim().slice(0, 2000) : null;
  }

  if (!partial || payload.metric_type !== undefined) {
    const metricType = String(payload.metric_type || "").trim();
    if (!METRIC_CATALOG[metricType]) {
      throw badRequest(`metric_type invalido: ${metricType}`);
    }
    out.metric_type = metricType;
  }

  if (!partial || payload.filters !== undefined) {
    out.filters = validateFilters(payload.filters);
  }

  if (!partial || payload.period_type !== undefined) {
    const periodType = String(payload.period_type || "current_month").trim();
    if (!PERIOD_TYPES.has(periodType)) {
      throw badRequest(`period_type invalido: ${periodType}`);
    }
    out.period_type = periodType;

    if (periodType === "last_n_months") {
      const months = Number(payload.period_months);
      if (!Number.isInteger(months) || months < 1 || months > 24) {
        throw badRequest("period_months debe ser un entero entre 1 y 24 cuando period_type es last_n_months");
      }
      out.period_months = months;
    } else {
      out.period_months = null;
    }
  }

  if (!partial || payload.goal_value !== undefined || payload.goal_direction !== undefined) {
    const hasGoalValue = payload.goal_value !== undefined && payload.goal_value !== null && payload.goal_value !== "";
    const hasGoalDirection = payload.goal_direction !== undefined && payload.goal_direction !== null && payload.goal_direction !== "";

    if (hasGoalValue !== hasGoalDirection) {
      throw badRequest("goal_value y goal_direction deben definirse juntos o ninguno de los dos");
    }

    if (hasGoalValue) {
      const goalValue = Number(payload.goal_value);
      if (!Number.isFinite(goalValue)) {
        throw badRequest("goal_value debe ser numerico");
      }
      const goalDirection = String(payload.goal_direction || "").trim();
      if (!GOAL_DIRECTIONS.has(goalDirection)) {
        throw badRequest("goal_direction debe ser 'gte' o 'lte'");
      }
      out.goal_value = goalValue;
      out.goal_direction = goalDirection;
    } else {
      out.goal_value = null;
      out.goal_direction = null;
    }
  }

  if (payload.show_in_workspace !== undefined) out.show_in_workspace = Boolean(payload.show_in_workspace);
  if (payload.show_in_reports !== undefined) out.show_in_reports = Boolean(payload.show_in_reports);
  if (payload.is_active !== undefined) out.is_active = Boolean(payload.is_active);
  if (payload.display_order !== undefined) {
    const order = Number(payload.display_order);
    out.display_order = Number.isFinite(order) ? Math.trunc(order) : 0;
  }

  return out;
}

// ── Construccion de SQL parametrizado ──────────────────────────────────

function buildFilterClause(filters = {}, params) {
  const clauses = [];
  for (const [key, values] of Object.entries(filters || {})) {
    const field = FILTERABLE_FIELDS[key];
    if (!field || !Array.isArray(values) || !values.length) continue;
    params.push(values);
    clauses.push(`${field.column} = ANY($${params.length})`);
  }
  return clauses;
}

function buildPeriodClause({ periodType, periodMonths, asOfMonth }, params) {
  if (asOfMonth && asOfMonth.year && asOfMonth.month) {
    params.push(`${asOfMonth.year}-${String(asOfMonth.month).padStart(2, "0")}-01`);
    const idx = params.length;
    return `t.created_at >= date_trunc('month', $${idx}::date) AND t.created_at < date_trunc('month', $${idx}::date) + interval '1 month'`;
  }

  switch (periodType) {
    case "last_7_days":
      return `t.created_at >= NOW() - interval '7 days'`;
    case "last_30_days":
      return `t.created_at >= NOW() - interval '30 days'`;
    case "last_n_months": {
      params.push(Math.max(0, Number(periodMonths || 1) - 1));
      const idx = params.length;
      return `t.created_at >= date_trunc('month', NOW()) - make_interval(months => $${idx}::int)`;
    }
    case "all_time":
      return "TRUE";
    case "current_month":
    default:
      return `t.created_at >= date_trunc('month', NOW())`;
  }
}

function buildMetricSelect(metricType) {
  switch (metricType) {
    case "ticket_count":
      return { expr: "COUNT(*)::numeric", needsEvents: false };
    case "avg_response_minutes":
      return {
        expr: `ROUND(AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 60.0) FILTER (WHERE t.first_response_at IS NOT NULL), 2)`,
        needsEvents: false,
      };
    case "avg_cycle_minutes":
      return {
        expr: `ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - t.created_at)) / 60.0) FILTER (WHERE t.status IN ('resuelto', 'cerrado')), 2)`,
        needsEvents: false,
      };
    case "avg_delivery_minutes":
      return {
        expr: `ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - COALESCE(ev.first_in_progress_at, t.first_response_at, t.created_at))) / 60.0) FILTER (WHERE t.status IN ('resuelto', 'cerrado')), 2)`,
        needsEvents: true,
      };
    case "sla_response_compliance_pct":
      return {
        expr: `ROUND(100.0 * COUNT(*) FILTER (WHERE NOT t.sla_response_breached AND t.first_response_at IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE t.first_response_due_at IS NOT NULL), 0), 2)`,
        needsEvents: false,
      };
    case "sla_resolution_compliance_pct":
      return {
        expr: `ROUND(100.0 * COUNT(*) FILTER (WHERE NOT t.sla_resolution_breached AND t.resolved_at IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE t.resolution_due_at IS NOT NULL), 0), 2)`,
        needsEvents: false,
      };
    case "csat_avg":
      return {
        expr: `ROUND(AVG(t.satisfaction_score) FILTER (WHERE t.satisfaction_score IS NOT NULL), 2)`,
        needsEvents: false,
      };
    default:
      throw badRequest(`metric_type invalido: ${metricType}`);
  }
}

async function computeKpiValue(definition, { asOfMonth } = {}) {
  const { expr, needsEvents } = buildMetricSelect(definition.metric_type);
  const params = [];
  const periodClause = buildPeriodClause(
    { periodType: definition.period_type, periodMonths: definition.period_months, asOfMonth },
    params
  );
  const filterClauses = buildFilterClause(definition.filters, params);
  const whereClause = [periodClause, ...filterClauses].filter(Boolean).join(" AND ");

  const eventsJoin = needsEvents
    ? `LEFT JOIN LATERAL (
         SELECT MIN(e.created_at) FILTER (WHERE e.new_status = 'en_progreso') AS first_in_progress_at
         FROM support_ticket_events e
         WHERE e.ticket_id = t.id
       ) ev ON TRUE`
    : "";

  const { rows } = await db.query(
    `SELECT ${expr} AS value FROM support_tickets t ${eventsJoin} WHERE ${whereClause}`,
    params
  );

  const rawValue = rows[0]?.value;
  const value = rawValue === null || rawValue === undefined ? null : Number(rawValue);
  const unit = METRIC_CATALOG[definition.metric_type]?.unit || "";
  const meetsGoal = definition.goal_value === null || definition.goal_value === undefined || value === null
    ? null
    : definition.goal_direction === "lte"
      ? value <= Number(definition.goal_value)
      : value >= Number(definition.goal_value);

  return { value, unit, meets_goal: meetsGoal };
}

// ── Mapeo de filas ──────────────────────────────────────────────────────

function mapDefinitionRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description || null,
    metric_type: row.metric_type,
    metric_label: METRIC_CATALOG[row.metric_type]?.label || row.metric_type,
    filters: row.filters || {},
    period_type: row.period_type,
    period_months: row.period_months !== null && row.period_months !== undefined ? Number(row.period_months) : null,
    goal_value: row.goal_value !== null && row.goal_value !== undefined ? Number(row.goal_value) : null,
    goal_direction: row.goal_direction || null,
    display_order: Number(row.display_order || 0),
    show_in_workspace: Boolean(row.show_in_workspace),
    show_in_reports: Boolean(row.show_in_reports),
    is_active: Boolean(row.is_active),
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── CRUD ────────────────────────────────────────────────────────────────

async function listKpiDefinitions({ activeOnly = false, workspaceOnly = false, reportsOnly = false } = {}) {
  const filters = [];
  if (activeOnly) filters.push("is_active = TRUE");
  if (workspaceOnly) filters.push("show_in_workspace = TRUE");
  if (reportsOnly) filters.push("show_in_reports = TRUE");
  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const { rows } = await db.query(
    `SELECT * FROM support_ticket_kpi_definitions ${whereClause} ORDER BY display_order ASC, id ASC`
  );
  return rows.map(mapDefinitionRow);
}

async function listKpiDefinitionsWithValues({ workspaceOnly = false, reportsOnly = false, asOfMonth } = {}) {
  const definitions = await listKpiDefinitions({ activeOnly: true, workspaceOnly, reportsOnly });
  const results = [];
  for (const definition of definitions) {
    try {
      const computed = await computeKpiValue(definition, { asOfMonth });
      results.push({ ...definition, ...computed });
    } catch (error) {
      results.push({ ...definition, value: null, unit: METRIC_CATALOG[definition.metric_type]?.unit || "", meets_goal: null, error: true });
    }
  }
  return results;
}

async function getKpiDefinition(id) {
  const { rows } = await db.query(`SELECT * FROM support_ticket_kpi_definitions WHERE id = $1 LIMIT 1`, [id]);
  if (!rows.length) throw notFound();
  return mapDefinitionRow(rows[0]);
}

async function createKpiDefinition({ payload, actorUserId }) {
  const clean = validateKpiPayload(payload, { partial: false });
  const { rows } = await db.query(
    `
      INSERT INTO support_ticket_kpi_definitions (
        name, description, metric_type, filters, period_type, period_months,
        goal_value, goal_direction, display_order, show_in_workspace, show_in_reports,
        is_active, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
      RETURNING *
    `,
    [
      clean.name,
      clean.description ?? null,
      clean.metric_type,
      JSON.stringify(clean.filters || {}),
      clean.period_type,
      clean.period_months ?? null,
      clean.goal_value ?? null,
      clean.goal_direction ?? null,
      clean.display_order ?? 0,
      clean.show_in_workspace ?? true,
      clean.show_in_reports ?? true,
      clean.is_active ?? true,
      actorUserId || null,
    ]
  );
  return mapDefinitionRow(rows[0]);
}

async function updateKpiDefinition({ id, payload, actorUserId }) {
  await getKpiDefinition(id);
  const clean = validateKpiPayload(payload, { partial: true });

  const fields = [];
  const values = [];
  const pushField = (column, value, isJsonb = false) => {
    values.push(value);
    fields.push(`${column} = $${values.length}${isJsonb ? "::jsonb" : ""}`);
  };

  if (clean.name !== undefined) pushField("name", clean.name);
  if (clean.description !== undefined) pushField("description", clean.description);
  if (clean.metric_type !== undefined) pushField("metric_type", clean.metric_type);
  if (clean.filters !== undefined) pushField("filters", JSON.stringify(clean.filters), true);
  if (clean.period_type !== undefined) pushField("period_type", clean.period_type);
  if (clean.period_months !== undefined) pushField("period_months", clean.period_months);
  if (clean.goal_value !== undefined) pushField("goal_value", clean.goal_value);
  if (clean.goal_direction !== undefined) pushField("goal_direction", clean.goal_direction);
  if (clean.display_order !== undefined) pushField("display_order", clean.display_order);
  if (clean.show_in_workspace !== undefined) pushField("show_in_workspace", clean.show_in_workspace);
  if (clean.show_in_reports !== undefined) pushField("show_in_reports", clean.show_in_reports);
  if (clean.is_active !== undefined) pushField("is_active", clean.is_active);

  pushField("updated_by", actorUserId || null);
  fields.push("updated_at = NOW()");

  values.push(id);
  const { rows } = await db.query(
    `UPDATE support_ticket_kpi_definitions SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!rows.length) throw notFound();
  return mapDefinitionRow(rows[0]);
}

async function deleteKpiDefinition(id) {
  const { rows } = await db.query(
    `DELETE FROM support_ticket_kpi_definitions WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!rows.length) throw notFound();
  return { id: Number(rows[0].id) };
}

async function reorderKpiDefinitions(items = []) {
  if (!Array.isArray(items) || !items.length) {
    throw badRequest("Se requiere un arreglo de { id, display_order }");
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      const id = Number(item?.id);
      const order = Number(item?.display_order);
      if (!Number.isInteger(id) || !Number.isFinite(order)) {
        throw badRequest("Cada item debe tener id y display_order numericos");
      }
      await client.query(
        `UPDATE support_ticket_kpi_definitions SET display_order = $2, updated_at = NOW() WHERE id = $1`,
        [id, Math.trunc(order)]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listKpiDefinitions({});
}

function getMetricCatalog() {
  return {
    metrics: Object.entries(METRIC_CATALOG).map(([value, meta]) => ({ value, ...meta })),
    filterableFields: Object.entries(FILTERABLE_FIELDS).map(([value, meta]) => ({
      value,
      label: meta.label,
      options: meta.allowed ? Array.from(meta.allowed) : null,
      type: meta.isInteger ? "integer" : meta.isText ? "text" : "enum",
    })),
  };
}

module.exports = {
  METRIC_CATALOG,
  FILTERABLE_FIELDS,
  getMetricCatalog,
  computeKpiValue,
  listKpiDefinitions,
  listKpiDefinitionsWithValues,
  getKpiDefinition,
  createKpiDefinition,
  updateKpiDefinition,
  deleteKpiDefinition,
  reorderKpiDefinitions,
};
