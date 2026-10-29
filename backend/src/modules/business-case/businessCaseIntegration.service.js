/**
 * backend/src/modules/business-case/businessCaseIntegration.service.js
 * -------------------------------------------------------------------
 * Service: Business Case Integration
 * Centraliza llamadas a otros modulos sin acoplar SQL de dominios externos.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { columnExists } = require("../../utils/dbMeta");

const TECH_TABLE_SCHEMA = "servicio";
const TECH_TABLE_NAME = "disponibilidad_tecnicos";
const TECH_ROLE_PATTERN = "%tecnico%";
const SAFE_DEFAULT_CAPACITY = Number.isFinite(
  Number.parseInt(process.env.TECHNICAL_DAILY_CAPACITY || "3", 10)
)
  ? Number.parseInt(process.env.TECHNICAL_DAILY_CAPACITY || "3", 10)
  : 3;

const escapeIdentifier = (value) =>
  `"${String(value || "").replace(/"/g, "\"\"")}"`;

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (direct) return direct[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

async function tableExists(schema, table) {
  try {
    const { rows } = await db.query(
      `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = $2
        LIMIT 1
      `,
      [schema, table]
    );
    return rows.length > 0;
  } catch (error) {
    logger.warn(
      { error: error.message, schema, table },
      "No se pudo validar existencia de tabla para capacidad tecnica"
    );
    return false;
  }
}

async function getTableColumns(schema, table) {
  try {
    const { rows } = await db.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
      `,
      [schema, table]
    );
    return new Set(rows.map((row) => String(row.column_name || "").toLowerCase()));
  } catch (error) {
    logger.warn(
      { error: error.message, schema, table },
      "No se pudo leer columnas para capacidad tecnica"
    );
    return new Set();
  }
}

const pickFirstExisting = (candidates = [], columns = new Set()) =>
  candidates.find((candidate) =>
    columns.has(String(candidate || "").toLowerCase())
  ) || null;

async function getActiveTechnicianCount() {
  const hasRoleColumn = await columnExists("public", "users", "role");
  if (!hasRoleColumn) {
    logger.warn(
      "No existe public.users.role; se usa capacidad tecnica por defecto"
    );
    return null;
  }

  const hasActiveColumn = await columnExists("public", "users", "active");
  const activeFilter = hasActiveColumn
    ? "AND COALESCE(u.active, false) = true"
    : "";

  const { rows } = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM public.users u
      WHERE LOWER(COALESCE(u.role::text, '')) LIKE LOWER($1)
      ${activeFilter}
    `,
    [TECH_ROLE_PATTERN]
  );

  return Number(rows?.[0]?.total || 0);
}

/**
 * Obtiene capacidad tecnica real:
 * 1) cuenta tecnicos activos (role like '%tecnico%')
 * 2) resta tecnicos ocupados (status busy) en la fecha indicada
 */
async function getTechnicalCapacity(date) {
  try {
    const normalizedDate = normalizeDateOnly(date);
    const activeTechnicianCount = await getActiveTechnicianCount();
    const safeActiveCount = Number.isFinite(activeTechnicianCount)
      ? Math.max(0, activeTechnicianCount)
      : SAFE_DEFAULT_CAPACITY;

    const hasTechAvailabilityTable = await tableExists(
      TECH_TABLE_SCHEMA,
      TECH_TABLE_NAME
    );
    if (!hasTechAvailabilityTable) {
      logger.warn(
        { schema: TECH_TABLE_SCHEMA, table: TECH_TABLE_NAME },
        "No existe servicio.disponibilidad_tecnicos; se usa total de tecnicos activos"
      );
      return safeActiveCount;
    }

    const columns = await getTableColumns(TECH_TABLE_SCHEMA, TECH_TABLE_NAME);

    const hasStatusViaMeta = await columnExists(
      TECH_TABLE_SCHEMA,
      TECH_TABLE_NAME,
      "status"
    );
    const statusColumn = hasStatusViaMeta
      ? "status"
      : pickFirstExisting(["estado"], columns);

    const technicianIdColumn = pickFirstExisting(
      ["user_id", "technician_id", "tecnico_id", "id_tecnico"],
      columns
    );

    const dateColumn = pickFirstExisting(
      ["date", "fecha", "availability_date", "activity_date", "target_date", "updated_at"],
      columns
    );

    if (!statusColumn || !technicianIdColumn) {
      logger.warn(
        {
          schema: TECH_TABLE_SCHEMA,
          table: TECH_TABLE_NAME,
          statusColumn,
          technicianIdColumn,
        },
        "Columnas insuficientes para calcular ocupacion tecnica; se usa total de tecnicos activos"
      );
      return safeActiveCount;
    }

    const params = [];
    const statusExpr = `LOWER(COALESCE(${escapeIdentifier(statusColumn)}::text, ''))`;
    let query = `
      SELECT COUNT(DISTINCT ${escapeIdentifier(technicianIdColumn)})::int AS busy_count
      FROM ${escapeIdentifier(TECH_TABLE_SCHEMA)}.${escapeIdentifier(TECH_TABLE_NAME)}
      WHERE ${statusExpr} = 'busy'
    `;

    if (normalizedDate && dateColumn) {
      params.push(normalizedDate);
      query += ` AND ${escapeIdentifier(dateColumn)}::date = $${params.length}::date`;
    } else if (normalizedDate && !dateColumn) {
      logger.warn(
        {
          schema: TECH_TABLE_SCHEMA,
          table: TECH_TABLE_NAME,
          normalizedDate,
        },
        "No hay columna de fecha en disponibilidad_tecnicos; se usa snapshot actual de estado"
      );
    }

    const { rows } = await db.query(query, params);
    const busyCount = Number(rows?.[0]?.busy_count || 0);
    return Math.max(0, safeActiveCount - Math.max(0, busyCount));
  } catch (error) {
    logger.error(
      { error: error.message, date: date || null },
      "Error calculando capacidad tecnica real"
    );
    return SAFE_DEFAULT_CAPACITY;
  }
}

/**
 * Notifica a otras areas sobre cambios en el Business Case
 */
async function notifyAreaTransition(businessCaseId, newStage) {
  const STAGE_NOTIFICATIONS = {
    pending_operational_data: {
      roles: ["jefe_tecnico", "jefe_operaciones"],
      template: "bc_ready_for_operational_data",
      title: "BC listo para datos operativos",
    },
    pending_manager_approval: {
      roles: ["jefe_comercial", "gerencia"],
      template: "bc_pending_approval",
      title: "BC pendiente de aprobacion gerencial",
    },
    factible: {
      roles: ["jefe_logistica", "jefe_tecnico"],
      template: "bc_approved_factible",
      title: "BC aprobado y factible",
    },
  };

  const config = STAGE_NOTIFICATIONS[newStage];
  if (!config) return;

  logger.info(
    { businessCaseId, newStage },
    `Notificando transicion a roles: ${config.roles.join(", ")}`
  );

  // Integrar con notificationManager cuando se habilite el contrato de mensajes BC.
}

module.exports = {
  getTechnicalCapacity,
  notifyAreaTransition,
};
