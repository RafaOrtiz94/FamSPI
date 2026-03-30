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
 * Registra una reserva de inventario para un Business Case
 */
async function ensureReservationsTable(client) {
  await client.query(
    `
      CREATE TABLE IF NOT EXISTS public.bc_inventory_reservations (
        id BIGSERIAL PRIMARY KEY,
        business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
        equipment_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        reserved_unit_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
        status TEXT NOT NULL DEFAULT 'active',
        reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reserved_by INTEGER NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (business_case_id, equipment_id)
      )
    `
  );

  await client.query(
    `
      ALTER TABLE public.bc_inventory_reservations
      ADD COLUMN IF NOT EXISTS reserved_unit_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
      ADD COLUMN IF NOT EXISTS reserved_by INTEGER NULL,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `
  );
}

async function reserveInventory({
  businessCaseId,
  actorId = null,
  client = null,
} = {}) {
  if (!businessCaseId) {
    const error = new Error("businessCaseId es requerido para reservar inventario");
    error.status = 400;
    throw error;
  }

  const ownsClient = !client;
  const queryClient = client || (await db.getClient());

  try {
    if (ownsClient) await queryClient.query("BEGIN");

    await ensureReservationsTable(queryClient);

    const { rows: selections } = await queryClient.query(
      `
        SELECT equipment_id, COALESCE(quantity, 1)::int AS quantity
        FROM public.bc_equipment_selection
        WHERE business_case_id = $1
      `,
      [businessCaseId]
    );

    if (!selections.length) {
      const error = new Error("No hay equipos seleccionados para reservar inventario en este Business Case");
      error.status = 409;
      throw error;
    }

    const summary = [];

    for (const selection of selections) {
      const equipmentId = Number(selection.equipment_id);
      const requestedQuantity = Math.max(1, Number(selection.quantity || 1));

      if (!Number.isFinite(equipmentId) || equipmentId <= 0) {
        const error = new Error("equipment_id inválido en selección de equipo");
        error.status = 400;
        throw error;
      }

      const { rows: existingRows } = await queryClient.query(
        `
          SELECT
            COALESCE(quantity, 0)::int AS quantity,
            COALESCE(reserved_unit_ids, ARRAY[]::INTEGER[]) AS reserved_unit_ids
          FROM public.bc_inventory_reservations
          WHERE business_case_id = $1
            AND equipment_id = $2
          LIMIT 1
        `,
        [businessCaseId, equipmentId]
      );

      const existingQuantity = Number(existingRows[0]?.quantity || 0);
      let unitIds = Array.from(
        new Set(
          Array.isArray(existingRows[0]?.reserved_unit_ids)
            ? existingRows[0].reserved_unit_ids.map((value) => Number(value)).filter((value) => Number.isFinite(value))
            : []
        )
      );

      const missingQuantity = Math.max(0, requestedQuantity - existingQuantity);
      const excessQuantity = Math.max(0, existingQuantity - requestedQuantity);

      if (excessQuantity > 0 && unitIds.length) {
        const unitsToRelease = unitIds.slice(-excessQuantity);
        if (unitsToRelease.length) {
          await queryClient.query(
            `
              UPDATE public.equipos_unidad
              SET estado = 'disponible',
                  updated_at = NOW()
              WHERE id = ANY($1::INT[])
                AND estado = 'reservado_bc'
            `,
            [unitsToRelease]
          );
          const unitsToReleaseSet = new Set(unitsToRelease);
          unitIds = unitIds.filter((unitId) => !unitsToReleaseSet.has(unitId));
        }
      }

      if (missingQuantity > 0) {
        const { rows: availableUnitRows } = await queryClient.query(
          `
            SELECT u.id
            FROM public.equipos_unidad u
            WHERE u.modelo_id = $1
              AND LOWER(COALESCE(u.estado, '')) IN ('disponible', 'no_asignado')
            ORDER BY u.id ASC
            LIMIT $2
            FOR UPDATE SKIP LOCKED
          `,
          [equipmentId, missingQuantity]
        );

        if (availableUnitRows.length < missingQuantity) {
          const error = new Error(
            `No hay suficiente inventario para el equipo ${equipmentId}. Requerido: ${requestedQuantity}, disponible: ${existingQuantity + availableUnitRows.length}`
          );
          error.status = 409;
          error.code = "INSUFFICIENT_INVENTORY";
          throw error;
        }

        const newUnitIds = availableUnitRows
          .map((row) => Number(row.id))
          .filter((value) => Number.isFinite(value));

        await queryClient.query(
          `
            UPDATE public.equipos_unidad
            SET estado = 'reservado_bc',
                updated_at = NOW()
            WHERE id = ANY($1::INT[])
          `,
          [newUnitIds]
        );

        unitIds = Array.from(new Set([...unitIds, ...newUnitIds]));
      }

      await queryClient.query(
        `
          INSERT INTO public.bc_inventory_reservations (
            business_case_id,
            equipment_id,
            quantity,
            reserved_unit_ids,
            status,
            reserved_at,
            reserved_by,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4::INT[], 'active', NOW(), $5, NOW(), NOW())
          ON CONFLICT (business_case_id, equipment_id)
          DO UPDATE SET
            quantity = EXCLUDED.quantity,
            reserved_unit_ids = EXCLUDED.reserved_unit_ids,
            status = 'active',
            reserved_at = NOW(),
            reserved_by = EXCLUDED.reserved_by,
            updated_at = NOW()
        `,
        [businessCaseId, equipmentId, requestedQuantity, unitIds, actorId]
      );

      summary.push({
        equipment_id: equipmentId,
        quantity: requestedQuantity,
        reserved_unit_ids: unitIds,
      });
    }

    if (ownsClient) await queryClient.query("COMMIT");

    logger.info(
      { businessCaseId, reservations: summary.length },
      "Inventario reservado para Business Case"
    );

    return summary;
  } catch (error) {
    if (ownsClient) {
      try {
        await queryClient.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error({ rollbackError: rollbackError.message }, "Error haciendo rollback de reserva de inventario");
      }
    }
    logger.error(
      { error: error.message, businessCaseId },
      "Error reservando inventario"
    );
    throw error;
  } finally {
    if (ownsClient) queryClient.release();
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
  reserveInventory,
  notifyAreaTransition,
};
