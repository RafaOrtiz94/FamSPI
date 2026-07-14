const db = require("../../config/db");
const logger = require("../../config/logger");
const {
  buildSheetPayloads,
  loadTemplateDefinition,
  pullMaximumQuantitiesFromGoogleSheet,
} = require("./businessCaseSheetSyncLocal.service");

const ALLOWED_ITEM_TYPES = new Set([
  "reactivo",
  "determinacion",
  "control",
  "calibrador",
  "consumible",
  "material",
  "otro",
]);

const ALLOWED_OPS_STATUS = new Set(["pendiente", "listo", "parcial", "despachado", "cancelado"]);

function isDispatchTableMissing(error) {
  if (!error) return false;
  if (String(error.code || "") !== "42P01") return false;
  return /bc_dispatch_items/i.test(String(error.message || ""));
}

function buildMigrationRequiredError() {
  const error = new Error(
    "Falta aplicar la migracion 104_bc_dispatch_workspace.sql (tabla bc_dispatch_items)",
  );
  error.status = 503;
  error.code = "BC_DISPATCH_MIGRATION_REQUIRED";
  return error;
}

function buildEmptyWorkspace() {
  return {
    items: [],
    summary: buildSummary([]),
    degraded: true,
    migrationRequired: true,
  };
}

function normalizeItemType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (ALLOWED_ITEM_TYPES.has(normalized)) return normalized;
  return "otro";
}

function toNonNegativeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed >= 0 ? parsed : fallback;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (ALLOWED_OPS_STATUS.has(normalized)) return normalized;
  return null;
}

function computeStatus({ status, dispatchQty, dispatchedQty }) {
  const explicit = normalizeStatus(status);
  if (explicit) return explicit;

  if (dispatchedQty > 0 && dispatchQty > 0 && dispatchedQty >= dispatchQty) return "despachado";
  if (dispatchedQty > 0 && dispatchQty > 0) return "parcial";
  if (dispatchQty > 0) return "listo";
  return "pendiente";
}

function mapDispatchRow(row) {
  const annualQty = Number(row.annual_qty || 0);
  const plannedQty = Number(row.planned_qty || 0);
  const opsDispatchQty = Number(row.ops_dispatch_qty || 0);
  const opsDispatchedQty = Number(row.ops_dispatched_qty || 0);
  const unitPrice = row.unit_price !== null ? Number(row.unit_price) : null;
  const pendingQty = Math.max(opsDispatchQty - opsDispatchedQty, 0);

  return {
    id: row.id,
    businessCaseId: row.business_case_id,
    itemKey: row.item_key,
    itemId: row.item_id || null,
    itemName: row.item_name,
    itemType: row.item_type,
    source: row.source || null,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name || "Sin equipo",
    annualQty,
    plannedQty,
    unitPrice,
    plannedAmount: unitPrice !== null ? plannedQty * unitPrice : null,
    commercialNotes: row.commercial_notes || "",
    commercialUpdatedByEmail: row.commercial_updated_by_email || null,
    commercialUpdatedAt: row.commercial_updated_at || null,
    opsDispatchQty,
    opsDispatchedQty,
    pendingQty,
    opsStatus: row.ops_status,
    operationsNotes: row.operations_notes || "",
    operationsUpdatedByEmail: row.operations_updated_by_email || null,
    operationsUpdatedAt: row.operations_updated_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function queryWithClient(client, sql, params = []) {
  if (client) return client.query(sql, params);
  return db.query(sql, params);
}

function toObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

async function resolveBusinessCaseSheetId(businessCaseId, client = null) {
  // BUG corregido: esta query pedia bc_spreadsheet_id, columna que no existe
  // en equipment_purchase_requests -- la query fallaba siempre (atrapada en
  // el try/catch del caller), asi que el pull de PRODUCTO A ENTREGAR desde
  // Sheets nunca se ejecutaba. El sheet_id real vive solo en
  // modern_bc_metadata.bc_sheet_generation.last.sheet_id.
  const { rows } = await queryWithClient(
    client,
    `SELECT modern_bc_metadata
       FROM equipment_purchase_requests
      WHERE id = $1
      LIMIT 1`,
    [businessCaseId],
  );
  const row = rows[0];
  if (!row) return null;

  const metadata = toObject(row.modern_bc_metadata);
  return metadata?.bc_sheet_generation?.last?.sheet_id || null;
}

function buildSheetContextFromConsumptionRows(consumptionRows = []) {
  const equipmentMap = new Map();
  consumptionRows.forEach((row) => {
    const equipmentId = Number(row.equipment_id);
    if (!Number.isInteger(equipmentId) || equipmentId <= 0) return;
    if (!equipmentMap.has(equipmentId)) {
      equipmentMap.set(equipmentId, {
        id: equipmentId,
        name: row.equipment_name || null,
        code: null,
        model: null,
      });
    }
  });

  const maxQuantities = consumptionRows.map((row) => ({
    item_key: row.item_key,
    item_id: row.item_id || null,
    item_name: row.name || null,
    item_type: row.item_type || null,
    source: row.source || null,
    equipment_id: row.equipment_id || null,
    equipment_name: row.equipment_name || null,
    annual_qty: row.annual_qty === null || row.annual_qty === undefined ? null : Number(row.annual_qty),
  }));

  const equipmentRecords = Array.from(equipmentMap.values());
  const equipmentTabs = buildSheetPayloads({
    template: loadTemplateDefinition(),
    equipmentRecords,
    payload: {
      fields: {},
      max_quantities: maxQuantities,
      sheet_context: {},
    },
  });

  return { equipmentTabs };
}

async function syncDispatchWorkspaceFromConsumption(businessCaseId, options = {}) {
  const client = options.client || null;
  const allowMissingTable = Boolean(options.allowMissingTable);
  try {
    const { rows: consumptionRows } = await queryWithClient(
      client,
      `SELECT
         item_key,
         item_id,
         name,
         item_type,
         source,
         equipment_id,
         equipment_name,
         annual_qty
       FROM bc_consumption_items
       WHERE business_case_id = $1`,
      [businessCaseId],
    );

    if (!consumptionRows.length) {
      await queryWithClient(client, `DELETE FROM bc_dispatch_items WHERE business_case_id = $1`, [businessCaseId]);
      return { items: [], summary: buildSummary([]) };
    }

    const payload = consumptionRows.map((row) => ({
      item_key: row.item_key,
      item_id: row.item_id,
      item_name: row.name,
      item_type: normalizeItemType(row.item_type),
      source: row.source || "catalog",
      equipment_id: row.equipment_id,
      equipment_name: row.equipment_name,
      annual_qty: toNonNegativeNumber(row.annual_qty, 0),
    }));

    await queryWithClient(
      client,
      `WITH payload AS (
         SELECT *
         FROM jsonb_to_recordset($2::jsonb) AS p(
           item_key text,
           item_id text,
           item_name text,
           item_type text,
           source text,
           equipment_id integer,
           equipment_name text,
           annual_qty numeric
         )
       )
       INSERT INTO bc_dispatch_items (
         business_case_id,
         item_key,
         item_id,
         item_name,
         item_type,
         source,
         equipment_id,
         equipment_name,
         annual_qty,
         planned_qty,
         ops_dispatch_qty,
         ops_dispatched_qty,
         ops_status,
         created_at,
         updated_at
       )
       SELECT
         $1,
         p.item_key,
         p.item_id,
         p.item_name,
         p.item_type,
         p.source,
         p.equipment_id,
         p.equipment_name,
         GREATEST(COALESCE(p.annual_qty, 0), 0),
         0,
         0,
         0,
         'pendiente',
         NOW(),
         NOW()
       FROM payload p
       ON CONFLICT (business_case_id, item_key)
       DO UPDATE SET
         item_id = EXCLUDED.item_id,
         item_name = EXCLUDED.item_name,
         item_type = EXCLUDED.item_type,
         source = EXCLUDED.source,
         equipment_id = EXCLUDED.equipment_id,
         equipment_name = EXCLUDED.equipment_name,
         annual_qty = EXCLUDED.annual_qty,
         updated_at = NOW()`,
      [businessCaseId, JSON.stringify(payload)],
    );

    await queryWithClient(
      client,
      `DELETE FROM bc_dispatch_items d
        WHERE d.business_case_id = $1
          AND NOT EXISTS (
            SELECT 1
            FROM bc_consumption_items c
            WHERE c.business_case_id = $1
              AND c.item_key = d.item_key
          )`,
      [businessCaseId],
    );

    try {
      const sheetId = await resolveBusinessCaseSheetId(businessCaseId, client);
      if (sheetId) {
        const { equipmentTabs } = buildSheetContextFromConsumptionRows(consumptionRows);
        const sheetUpdates = await pullMaximumQuantitiesFromGoogleSheet({
          sheetId,
          equipmentTabs,
        });

        if (sheetUpdates.length) {
          await queryWithClient(
            client,
            `WITH payload AS (
               SELECT *
               FROM jsonb_to_recordset($2::jsonb) AS p(
                 item_key text,
                 planned_qty numeric
               )
             )
             UPDATE bc_dispatch_items d
                SET planned_qty = CASE
                    WHEN d.commercial_updated_at IS NULL THEN GREATEST(COALESCE(p.planned_qty, 0), 0)
                    ELSE d.planned_qty
                  END,
                    updated_at = NOW()
               FROM payload p
              WHERE d.business_case_id = $1
                AND d.item_key = p.item_key`,
            [businessCaseId, JSON.stringify(sheetUpdates)],
          );
        }
      }
    } catch (sheetSyncError) {
      logger.warn(
        { businessCaseId, error: sheetSyncError.message },
        "No se pudo sincronizar PRODUCTO A ENTREGAR/ENVIAR desde Google Sheet. Continua con datos locales.",
      );
    }

    return getDispatchWorkspace(businessCaseId, { client, skipSync: true });
  } catch (error) {
    if (isDispatchTableMissing(error)) {
      if (allowMissingTable) {
        logger.warn(
          { businessCaseId },
          "bc_dispatch_items no existe. Workspace despacho en modo degradado.",
        );
        return buildEmptyWorkspace();
      }
      throw buildMigrationRequiredError();
    }
    throw error;
  }
}

function buildSummary(items = []) {
  const byStatus = {
    pendiente: 0,
    listo: 0,
    parcial: 0,
    despachado: 0,
    cancelado: 0,
  };

  let totalPlannedQty = 0;
  let totalOpsDispatchQty = 0;
  let totalOpsDispatchedQty = 0;
  let totalPlannedAmount = 0;

  for (const item of items) {
    byStatus[item.opsStatus] = (byStatus[item.opsStatus] || 0) + 1;
    totalPlannedQty += Number(item.plannedQty || 0);
    totalOpsDispatchQty += Number(item.opsDispatchQty || 0);
    totalOpsDispatchedQty += Number(item.opsDispatchedQty || 0);
    if (typeof item.plannedAmount === "number") {
      totalPlannedAmount += item.plannedAmount;
    }
  }

  const completionRatio = totalOpsDispatchQty > 0 ? totalOpsDispatchedQty / totalOpsDispatchQty : 0;

  return {
    totalItems: items.length,
    totalPlannedQty,
    totalOpsDispatchQty,
    totalOpsDispatchedQty,
    totalPendingQty: Math.max(totalOpsDispatchQty - totalOpsDispatchedQty, 0),
    totalPlannedAmount,
    completionRatio,
    statusBreakdown: byStatus,
  };
}

async function getDispatchWorkspace(businessCaseId, options = {}) {
  const client = options.client || null;
  const skipSync = Boolean(options.skipSync);

  if (!skipSync) {
    const synced = await syncDispatchWorkspaceFromConsumption(businessCaseId, { client, allowMissingTable: true });
    if (synced?.migrationRequired) {
      return synced;
    }
  }
  try {
    const { rows } = await queryWithClient(
      client,
      `SELECT *
       FROM bc_dispatch_items
       WHERE business_case_id = $1
       ORDER BY
         COALESCE(equipment_name, ''),
         COALESCE(equipment_id, 2147483647),
         CASE item_type
           WHEN 'determinacion' THEN 1
           WHEN 'reactivo' THEN 2
           WHEN 'control' THEN 3
           WHEN 'calibrador' THEN 4
           WHEN 'consumible' THEN 5
           WHEN 'material' THEN 6
           ELSE 7
         END,
         item_name`,
      [businessCaseId],
    );

    const items = rows.map(mapDispatchRow);

    return {
      items,
      summary: buildSummary(items),
    };
  } catch (error) {
    if (isDispatchTableMissing(error)) {
      logger.warn(
        { businessCaseId },
        "bc_dispatch_items no existe al consultar workspace. Retornando fallback vacío.",
      );
      return buildEmptyWorkspace();
    }
    throw error;
  }
}

async function saveCommercialPlan(businessCaseId, items = [], user = {}) {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    await syncDispatchWorkspaceFromConsumption(businessCaseId, { client });

    const updates = Array.isArray(items) ? items : [];
    for (const row of updates) {
      const itemKey = String(row?.item_key || row?.itemKey || "").trim();
      if (!itemKey) continue;

      const plannedQty = toNonNegativeNumber(row?.planned_qty ?? row?.plannedQty, 0);
      const unitPrice = toNullableNumber(row?.unit_price ?? row?.unitPrice);
      const notes = row?.commercial_notes ?? row?.commercialNotes;
      const commercialNotes = notes === null || notes === undefined ? null : String(notes).slice(0, 4000);

      await client.query(
        `UPDATE bc_dispatch_items
            SET planned_qty = $1,
                unit_price = $2,
                commercial_notes = $3,
                commercial_updated_by_email = $4,
                commercial_updated_at = NOW(),
                ops_dispatch_qty = CASE
                  WHEN operations_updated_at IS NULL THEN $1
                  ELSE ops_dispatch_qty
                END,
                updated_at = NOW()
          WHERE business_case_id = $5
            AND item_key = $6`,
        [plannedQty, unitPrice, commercialNotes, user?.email || null, businessCaseId, itemKey],
      );
    }

    await client.query("COMMIT");
    return getDispatchWorkspace(businessCaseId, { client: null, skipSync: true });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error({ error: error.message, businessCaseId }, "Error guardando plan comercial de despacho");
    throw error;
  } finally {
    client.release();
  }
}

async function saveOperationsControl(businessCaseId, items = [], user = {}) {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    await syncDispatchWorkspaceFromConsumption(businessCaseId, { client });

    const updates = Array.isArray(items) ? items : [];
    for (const row of updates) {
      const itemKey = String(row?.item_key || row?.itemKey || "").trim();
      if (!itemKey) continue;

      const dispatchQty = toNonNegativeNumber(row?.ops_dispatch_qty ?? row?.opsDispatchQty, 0);
      const dispatchedQty = toNonNegativeNumber(row?.ops_dispatched_qty ?? row?.opsDispatchedQty, 0);
      const status = computeStatus({
        status: row?.ops_status ?? row?.opsStatus,
        dispatchQty,
        dispatchedQty,
      });
      const notes = row?.operations_notes ?? row?.operationsNotes;
      const operationsNotes = notes === null || notes === undefined ? null : String(notes).slice(0, 4000);

      await client.query(
        `UPDATE bc_dispatch_items
            SET ops_dispatch_qty = $1,
                ops_dispatched_qty = $2,
                ops_status = $3,
                operations_notes = $4,
                operations_updated_by_email = $5,
                operations_updated_at = NOW(),
                updated_at = NOW()
          WHERE business_case_id = $6
            AND item_key = $7`,
        [dispatchQty, dispatchedQty, status, operationsNotes, user?.email || null, businessCaseId, itemKey],
      );
    }

    await client.query("COMMIT");
    return getDispatchWorkspace(businessCaseId, { client: null, skipSync: true });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error({ error: error.message, businessCaseId }, "Error guardando control operativo de despacho");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  syncDispatchWorkspaceFromConsumption,
  getDispatchWorkspace,
  saveCommercialPlan,
  saveOperationsControl,
};
