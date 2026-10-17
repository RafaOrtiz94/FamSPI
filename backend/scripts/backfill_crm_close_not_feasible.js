/*
 * Backfill idempotente: cierra como perdidas las oportunidades abiertas que nacieron de un Business
 * Case declarado no factible (motivo: "Business Case no factible"). Las nuevas ya se cierran solas
 * al registrar la no factibilidad.
 *
 * Uso:
 *   node scripts/backfill_crm_close_not_feasible.js --dry-run
 *   node scripts/backfill_crm_close_not_feasible.js --apply
 */
const { closeNotFeasibleOpportunities } = require("../src/modules/crm-fam/crmOpportunityJourney.service");

const APPLY = process.argv.includes("--apply");

closeNotFeasibleOpportunities({ dryRun: !APPLY })
  .then((summary) => {
    console.log(APPLY ? "APLICADO" : "SIMULACION (usa --apply para escribir)");
    console.log(`Oportunidades abiertas de Business Case revisadas: ${summary.reviewed}`);
    console.log(`  no factibles, cerradas como perdidas: ${summary.closed}`);
  })
  .catch((err) => { console.error("FALLO:", err.message); process.exitCode = 1; })
  .finally(() => setTimeout(() => process.exit(), 200));
