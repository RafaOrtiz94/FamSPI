#!/usr/bin/env node
/**
 * backfill_crm_opportunities.js
 * Sincroniza todas las oportunidades (FamSheets) existentes hacia EspoCRM.
 * Crea o actualiza Opportunity records en EspoCRM.
 * Idempotente: puede re-ejecutarse sin duplicar registros.
 *
 * Uso:
 *   node scripts/backfill_crm_opportunities.js --dry-run
 *   node scripts/backfill_crm_opportunities.js
 *   node scripts/backfill_crm_opportunities.js --limit=100
 *   node scripts/backfill_crm_opportunities.js --stage=pursue   # solo etapa específica
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const db = require("../src/config/db");
const crmService = require("../src/modules/integrations/crm.service");

const DRY_RUN    = process.argv.includes("--dry-run");
const LIMIT_ARG  = process.argv.find((a) => a.startsWith("--limit="));
const STAGE_ARG  = process.argv.find((a) => a.startsWith("--stage="));
const LIMIT      = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : 2000;
const STAGE_FILTER = STAGE_ARG ? STAGE_ARG.split("=")[1] : null;
const BATCH_SIZE = 10;   // más lento para respetar rate limit de EspoCRM
const DELAY_MS   = 400;

if (!crmService.isCrmSyncEnabled()) {
  console.error("[BACKFILL_OPP] CRM_SYNC_ENABLED no es true — abortando.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBatch(offset, size) {
  const stageClause = STAGE_FILTER ? `AND o.funnel_stage = $3` : "";
  const params = STAGE_FILTER ? [size, offset, STAGE_FILTER] : [size, offset];

  const { rows } = await db.query(
    `SELECT
       o.id                     AS famspi_opportunity_id,
       o.title,
       o.estimated_amount,
       o.currency,
       o.funnel_stage,
       o.competitive_position,
       o.singular_objective,
       o.target_close_date,
       o.account_id,
       o.owner_id,
       o.summary,
       o.updated_at,
       a.name                   AS account_name,
       u.name                   AS owner_name,
       COALESCE(r.total_score, 0) AS total_score
     FROM opportunity o
     LEFT JOIN accounts a ON a.id = o.account_id
     LEFT JOIN users u    ON u.id = o.owner_id
     LEFT JOIN opportunity_rating r ON r.opportunity_id = o.id
     WHERE o.funnel_stage NOT IN ('archived')
     ${stageClause}
     ORDER BY o.updated_at DESC
     LIMIT $1 OFFSET $2`,
    params,
  );
  return rows;
}

async function run() {
  console.log("=".repeat(60));
  console.log(" FAM CRM — Backfill Oportunidades → EspoCRM");
  if (DRY_RUN) console.log(" MODO: DRY-RUN");
  if (STAGE_FILTER) console.log(` FILTRO: funnel_stage = '${STAGE_FILTER}'`);
  console.log("=".repeat(60));

  const stageClause = STAGE_FILTER ? `AND funnel_stage = '${STAGE_FILTER}'` : "";
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) FROM opportunity WHERE funnel_stage NOT IN ('archived') ${stageClause}`
  );
  const total = parseInt(countRows[0].count, 10);
  const toProcess = Math.min(total, LIMIT);
  console.log(`  Total oportunidades: ${total} | Procesando: ${toProcess}`);
  console.log("=".repeat(60));

  let offset = 0;
  let ok = 0, skip = 0, failed = 0;

  while (offset < toProcess) {
    const batch = await fetchBatch(offset, Math.min(BATCH_SIZE, toProcess - offset));
    if (!batch.length) break;

    for (const opp of batch) {
      if (DRY_RUN) {
        console.log(`  [DRY] id=${opp.famspi_opportunity_id}  stage=${opp.funnel_stage}  "${opp.title}"`);
        ok++;
        continue;
      }

      try {
        const result = await crmService.sendOpportunitySync(opp);
        if (result?.skipped) {
          console.log(`  [SKIP] id=${opp.famspi_opportunity_id}  — ${result.reason}`);
          skip++;
        } else {
          const stageInfo = result.stageChanged ? ` stage→${result.opportunityId}` : "";
          console.log(`  [OK]   id=${opp.famspi_opportunity_id}  "${opp.title}"  → ${result.action}${stageInfo}`);
          ok++;
        }
      } catch (err) {
        console.error(`  [FAIL] id=${opp.famspi_opportunity_id}  "${opp.title}"  — ${err?.message}`);
        failed++;
      }

      await sleep(DELAY_MS);
    }

    offset += batch.length;
    console.log(`  → Progreso: ${Math.min(offset, toProcess)}/${toProcess}  (ok=${ok} skip=${skip} fail=${failed})`);
  }

  console.log("=".repeat(60));
  console.log(` COMPLETADO  ok=${ok}  skip=${skip}  failed=${failed}`);
  console.log("=".repeat(60));
}

run().catch((err) => {
  console.error("[BACKFILL_OPP] Error fatal:", err?.message || err);
  process.exit(1);
});
