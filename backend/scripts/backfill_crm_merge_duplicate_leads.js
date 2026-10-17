/*
 * Backfill idempotente: unifica los leads repetidos que creó la sincronización con Business Case
 * y compras (uno por expediente en vez de uno por cliente). Conserva el lead más antiguo de cada
 * cliente, le pasa las oportunidades y visitas de los demás y archiva los sobrantes (soft delete).
 * No toca leads creados a mano.
 *
 * Uso:
 *   node scripts/backfill_crm_merge_duplicate_leads.js --dry-run
 *   node scripts/backfill_crm_merge_duplicate_leads.js --apply
 */
const { mergeDuplicateAutoLeads } = require("../src/modules/crm-fam/crmPurchaseSync.service");

const APPLY = process.argv.includes("--apply");

mergeDuplicateAutoLeads({ dryRun: !APPLY })
  .then((summary) => {
    console.log(APPLY ? "APLICADO" : "SIMULACION (usa --apply para escribir)");
    console.log(`Clientes con leads repetidos: ${summary.groups}`);
    console.log(`  leads sobrantes archivados:        ${summary.archived}`);
    console.log(`  oportunidades pasadas al lead que queda: ${summary.opportunities}`);
    if (APPLY) console.log(`  visitas reasignadas:               ${summary.visits}`);
  })
  .catch((err) => { console.error("FALLO:", err.message); process.exitCode = 1; })
  .finally(() => setTimeout(() => process.exit(), 200));
