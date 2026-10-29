/**
 * Tasas de consumo real de referencia para predecir un Business Case: procesos cargados de archivo
 * (bc_reference_consumption) y entregas reales de OTROS Business Case (bc_delivery_history).
 * El propio Business Case nunca es su referencia: su historial ya entra como "client_history".
 */

const db = require("../../config/db");
const { __testables: { moduleOf } } = require("./referenceConsumption");

const isMissingTable = (error) => String(error?.code || "") === "42P01";
const normalizeCode = (value) => String(value ?? "").replace(/\D/g, "").replace(/^0+/, "");

async function referencesFor(businessCaseId) {
  const references = [];
  try {
    const { rows } = await db.query(
      `SELECT source_name, item_type, supplier_code, product_name, module, per_month::float AS per_month FROM bc_reference_consumption`,
    );
    rows.forEach((row) => references.push({
      source: row.source_name, code: normalizeCode(row.supplier_code), name: row.product_name, itemType: row.item_type,
      module: row.module || moduleOf(row.product_name), perMonth: Number(row.per_month),
    }));
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  try {
    const { rows } = await db.query(
      `SELECT h.business_case_id::text AS id, MAX(v.client_name) OVER (PARTITION BY h.business_case_id) AS client,
              h.item_type, h.supplier_code, h.product_name, h.delivered_boxes::float AS boxes, h.period_months::float AS period
         FROM bc_delivery_history h
         LEFT JOIN v_business_cases_complete v ON v.business_case_id = h.business_case_id
        WHERE h.business_case_id <> $1 AND h.supplier_code IS NOT NULL AND h.period_months > 0`,
      [businessCaseId],
    );
    rows.forEach((row) => references.push({
      source: row.client || row.id.slice(0, 8), code: normalizeCode(row.supplier_code), name: row.product_name, itemType: row.item_type,
      module: moduleOf(row.product_name), perMonth: row.boxes / row.period,
    }));
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  // Consumo por mes que declaro jefe_servicio al justificar en otros procesos (matriz de conocimiento).
  try {
    const { rows } = await db.query(
      `SELECT k.item_type, k.supplier_code, k.product_name, k.value::float AS value, MAX(v.client_name) AS client
         FROM bc_knowledge_matrix k
         LEFT JOIN v_business_cases_complete v ON v.business_case_id = k.business_case_id
        WHERE k.business_case_id <> $1 AND k.transferable AND k.reason = 'monthly_consumption' AND k.value >= 0
        GROUP BY 1, 2, 3, 4, k.business_case_id`,
      [businessCaseId],
    );
    rows.forEach((row) => references.push({
      source: `jefe_servicio · ${row.client || "otro proceso"}`, code: normalizeCode(row.supplier_code), name: row.product_name || "",
      itemType: row.item_type, module: moduleOf(row.product_name || ""), perMonth: Number(row.value), kind: "expert",
    }));
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  return references;
}

module.exports = { referencesFor };
