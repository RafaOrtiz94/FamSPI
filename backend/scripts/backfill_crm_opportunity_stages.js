/*
 * Backfill idempotente: reclasifica las oportunidades abiertas del embudo CRM según el avance real
 * de su expediente (compra privada, compra pública o Business Case). Solo avanza de fase: no
 * retrocede ni cierra oportunidades. Requiere la migración 322 (fases de entrega y consumibles).
 *
 * Uso:
 *   node scripts/backfill_crm_opportunity_stages.js --dry-run
 *   node scripts/backfill_crm_opportunity_stages.js --apply
 */
const { reclassifyOpenOpportunities } = require("../src/modules/crm-fam/crmOpportunityJourney.service");

const APPLY = process.argv.includes("--apply");

reclassifyOpenOpportunities({ dryRun: !APPLY })
  .then((summary) => {
    console.log(APPLY ? "APLICADO" : "SIMULACION (usa --apply para escribir)");
    console.log(`Oportunidades abiertas: ${summary.total} (con expediente: ${summary.withJourney})`);
    console.log(`Cambian de fase: ${summary.moved}`);
    Object.entries(summary.moves).forEach(([move, count]) => console.log(`  ${count} × ${move}`));
  })
  .catch((err) => { console.error("FALLO:", err.message); process.exitCode = 1; })
  .finally(() => setTimeout(() => process.exit(), 200));
