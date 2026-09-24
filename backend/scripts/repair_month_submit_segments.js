#!/usr/bin/env node
/**
 * repair_month_submit_segments.js
 * Repara viaticos declarados via submit-month (ViaticosWizard multi-salida)
 * antes del fix a submitMonthAllowances: la fila padre en travel_allowances
 * quedaba correctamente en pendiente_aprobacion_talento/financiera/mixta,
 * pero los segmentos (travel_allowance_segments) nunca se marcaban
 * 'enviado' -- se quedaban en 'borrador', y las colas de revision de
 * Finanzas/Talento Humano (listReviewAllowances) filtran por el estado del
 * segmento, no de la fila padre. Resultado: la salida no aparecia en
 * ninguna cola de aprobacion aunque el solicitante ya la habia enviado.
 *
 * Detecta el mismatch (padre pendiente + segmento visible en borrador con
 * total > 0) y lo corrige reusando la misma logica que submitAllowanceForReview.
 *
 * Uso:
 *   node scripts/repair_month_submit_segments.js --dry-run
 *   node scripts/repair_month_submit_segments.js
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const db = require("../src/config/db");
const service = require("../src/modules/viaticos/viaticos.service");

const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  const { rows: candidates } = await db.query(`
    SELECT DISTINCT ta.id
      FROM travel_allowances ta
      JOIN travel_allowance_segments seg ON seg.allowance_id = ta.id
     WHERE ta.workflow_status IN ('pendiente_aprobacion_talento', 'pendiente_aprobacion_financiera', 'pendiente_aprobacion_mixta')
       AND seg.workflow_status = 'borrador'
       AND seg.visible_in_active_queue = TRUE
       AND COALESCE(seg.calculated_total, 0) > 0
     ORDER BY ta.id
  `);

  if (!candidates.length) {
    console.log("[REPAIR] No se encontraron viaticos con segmentos atascados en borrador.");
    return;
  }

  console.log(`[REPAIR] ${candidates.length} viatico(s) con segmento(s) atascado(s): ${candidates.map((c) => c.id).join(", ")}`);

  if (DRY_RUN) {
    console.log("[REPAIR] --dry-run: no se aplico ningun cambio.");
    return;
  }

  for (const { id: allowanceId } of candidates) {
    const synced = await service.syncAllowanceSegments(allowanceId, { actorUserId: null });
    let fixedCount = 0;
    for (const segment of synced?.segments || []) {
      if (!segment.visible_in_active_queue || Number(segment.calculated_total || 0) <= 0) continue;
      const fromStatus = String(segment.workflow_status || "").toLowerCase();
      if (fromStatus !== "borrador" && fromStatus !== "rechazado") continue;
      const { rows: updated } = await db.query(
        `
          UPDATE travel_allowance_segments
          SET workflow_status = 'enviado',
              submitted_at = NOW(),
              visible_in_active_queue = TRUE,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [segment.id]
      );
      if (updated[0]) {
        fixedCount += 1;
        await service.appendSegmentEvent({
          allowanceId,
          segmentId: segment.id,
          eventType: "submitted",
          fromStatus,
          toStatus: "enviado",
          observation: "Reparacion automatica: submitMonthAllowances no sincronizaba segmentos (repair_month_submit_segments.js)",
        });
      }
    }
    await service.syncAllowanceSegments(allowanceId, { actorUserId: null });
    console.log(`[REPAIR] Viatico #${allowanceId}: ${fixedCount} segmento(s) marcado(s) como enviado.`);
  }

  console.log("[REPAIR] Listo.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[REPAIR] Error:", err);
    process.exit(1);
  });
