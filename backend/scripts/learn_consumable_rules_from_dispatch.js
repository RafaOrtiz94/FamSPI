"use strict";

/**
 * Aprende de lo realmente despachado: por cada Business Case con despacho completo, guarda en
 * bc_consumable_rule_validations (origin = 'dispatch') lo despachado por producto junto con lo
 * que el motor de reglas predice hoy. Esas filas miden la exactitud del motor y alimentan el
 * ajuste aprendido por producto y equipo. No toca ofertas ni consumos.
 *
 *   node scripts/learn_consumable_rules_from_dispatch.js            # solo muestra lo que haria
 *   node scripts/learn_consumable_rules_from_dispatch.js --apply    # escribe
 *
 * Un despacho cuenta como completo cuando todos los productos con cantidad planificada del
 * Business Case tienen cantidad despachada. Requiere la migracion 326.
 */

require("dotenv").config();
const db = require("../src/config/db");
const pricingLab = require("../src/modules/business-case/businessCasePricingLab.service");

const APPLY = process.argv.includes("--apply");
const code = (value) => String(value || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");

(async () => {
  const { rows: cases } = await db.query(
    `SELECT business_case_id
       FROM bc_dispatch_items
      GROUP BY business_case_id
     HAVING COUNT(*) FILTER (WHERE COALESCE(ops_dispatched_qty, 0) > 0) > 0
        AND COUNT(*) FILTER (WHERE COALESCE(planned_qty, 0) > 0 AND COALESCE(ops_dispatched_qty, 0) <= 0) = 0`,
  );
  console.log(`Business Case con despacho completo: ${cases.length}`);
  let saved = 0;
  for (const { business_case_id: businessCaseId } of cases) {
    const { rows: dispatched } = await db.query(
      `SELECT equipment_id, LOWER(item_type) AS item_type, item_id, SUM(ops_dispatched_qty) AS qty
         FROM bc_dispatch_items
        WHERE business_case_id = $1 AND item_id IS NOT NULL
        GROUP BY 1, 2, 3`,
      [businessCaseId],
    );
    const realByKey = new Map(dispatched.map((row) => [`${row.equipment_id}::${row.item_type}::${code(row.item_id)}`, Number(row.qty)]));
    const preview = await pricingLab.buildPreview(businessCaseId);
    for (const equipment of preview.equipment || []) {
      for (const item of equipment.ruleEngine?.items || []) {
        const real = realByKey.get(`${equipment.equipmentId}::${item.itemType}::${item.supplierCode}`);
        if (real === undefined || item.status !== "calculated") continue;
        saved += 1;
        if (!APPLY) continue;
        await db.query(
          `INSERT INTO bc_consumable_rule_validations
             (business_case_id, equipment_id, equipment_code, item_type, supplier_code, origin,
              validated_qty, predicted_qty, predicted_source, conventions, validated_by)
           VALUES ($1, $2, $3, $4, $5, 'dispatch', $6, $7, $8, $9::jsonb, 'learn_consumable_rules_from_dispatch')
           ON CONFLICT (business_case_id, equipment_id, item_type, supplier_code, origin)
           DO UPDATE SET validated_qty = EXCLUDED.validated_qty, predicted_qty = EXCLUDED.predicted_qty,
                         predicted_source = EXCLUDED.predicted_source, conventions = EXCLUDED.conventions,
                         equipment_code = EXCLUDED.equipment_code, validated_at = NOW()`,
          [businessCaseId, equipment.equipmentId, equipment.equipmentCode || null, item.itemType, item.supplierCode,
            real, item.quantity, item.primarySource, JSON.stringify(equipment.ruleEngine.conventions || {})],
        );
      }
    }
  }
  console.log(`${APPLY ? "Casos guardados" : "Casos que se guardarian (use --apply)"}: ${saved}`);
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => setTimeout(() => process.exit(), 300));
