#!/usr/bin/env node
/**
 * revert_allowance_to_draft.js
 * Reversa completa de un viatico especifico: borra las facturas SRI cargadas
 * (travel_allowance_invoices) y devuelve la salida a 'borrador' -- tanto la
 * fila padre (travel_allowances) como sus segmentos
 * (travel_allowance_segments) -- para que el declarante pueda volver a
 * clasificar desde cero en el wizard.
 *
 * No toca notas manuales ni compras sin factura (Pasos 2/3) -- solo el paso
 * de clasificacion de facturas SRI (Paso 1), que es lo que se pidio revertir.
 *
 * Uso:
 *   node scripts/revert_allowance_to_draft.js --id=42 --dry-run
 *   node scripts/revert_allowance_to_draft.js --id=42
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const db = require("../src/config/db");
const service = require("../src/modules/viaticos/viaticos.service");

const DRY_RUN = process.argv.includes("--dry-run");
const idArg = process.argv.find((a) => a.startsWith("--id="));
const allowanceId = idArg ? Number(idArg.split("=")[1]) : null;

async function run() {
  if (!Number.isFinite(allowanceId) || allowanceId <= 0) {
    console.error("[REVERT] Uso: node scripts/revert_allowance_to_draft.js --id=<allowanceId> [--dry-run]");
    process.exit(1);
  }

  const { rows: [allowance] } = await db.query(
    `SELECT id, workflow_status, status FROM travel_allowances WHERE id = $1`,
    [allowanceId]
  );
  if (!allowance) {
    console.error(`[REVERT] Viatico #${allowanceId} no existe.`);
    process.exit(1);
  }

  const { rows: invoices } = await db.query(
    `SELECT id, supplier_name, access_key, total FROM travel_allowance_invoices WHERE allowance_id = $1`,
    [allowanceId]
  );

  console.log(`[REVERT] Viatico #${allowanceId}: workflow_status actual = "${allowance.workflow_status}"`);
  console.log(`[REVERT] ${invoices.length} factura(s) SRI cargada(s) que se eliminarian:`);
  invoices.forEach((inv) => console.log(`  - #${inv.id} ${inv.supplier_name || "(sin proveedor)"} · ${inv.access_key} · $${inv.total}`));

  if (DRY_RUN) {
    console.log("[REVERT] --dry-run: no se aplico ningun cambio.");
    return;
  }

  await db.query(`DELETE FROM travel_allowance_invoices WHERE allowance_id = $1`, [allowanceId]);

  await db.query(
    `UPDATE travel_allowances
        SET workflow_status = 'borrador',
            requires_finance_approval = FALSE,
            requires_talento_approval = FALSE,
            finance_approval_status = 'not_required',
            talento_approval_status = 'not_required',
            finance_approved_by_user_id = NULL,
            talento_approved_by_user_id = NULL,
            finance_approved_at = NULL,
            talento_approved_at = NULL,
            reviewer_observation = NULL,
            reviewer_observation_at = NULL,
            reviewer_observation_by = NULL,
            updated_at = NOW()
      WHERE id = $1`,
    [allowanceId]
  );

  const { rows: segments } = await db.query(
    `SELECT id, workflow_status FROM travel_allowance_segments WHERE allowance_id = $1`,
    [allowanceId]
  );
  for (const segment of segments) {
    const fromStatus = String(segment.workflow_status || "").toLowerCase();
    await db.query(
      `UPDATE travel_allowance_segments
          SET workflow_status = 'borrador',
              submitted_at = NULL,
              submitted_by_user_id = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [segment.id]
    );
    await service.appendSegmentEvent({
      allowanceId,
      segmentId: segment.id,
      eventType: "reverted_to_draft",
      fromStatus,
      toStatus: "borrador",
      observation: "Reversa manual solicitada por el declarante (revert_allowance_to_draft.js): reclasificar desde cero por inconsistencias",
    });
  }

  // Recalcula calculated_total de los segmentos (quedan en 0 salvo que haya
  // compras sin factura registradas -- esas no se tocan).
  await service.syncAllowanceSegments(allowanceId, { actorUserId: null });

  console.log(`[REVERT] Viatico #${allowanceId}: ${invoices.length} factura(s) eliminada(s), estado y segmentos reiniciados a 'borrador'.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[REVERT] Error:", err);
    process.exit(1);
  });
