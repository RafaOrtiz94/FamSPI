/*
 * Backfill idempotente: enlaza con su cuenta CRM las oportunidades que nacieron de una compra o
 * de un Business Case sin cuenta. Busca la cuenta por RUC/cédula del cliente del expediente y la
 * crea si no existe. Las oportunidades sin identificación de cliente se omiten.
 *
 * Uso:
 *   node scripts/backfill_crm_opportunity_accounts.js --dry-run
 *   node scripts/backfill_crm_opportunity_accounts.js --apply
 */
const { backfillOpportunityAccounts } = require("../src/modules/crm-fam/crmPurchaseSync.service");

const APPLY = process.argv.includes("--apply");

backfillOpportunityAccounts({ dryRun: !APPLY })
  .then((summary) => {
    console.log(APPLY ? "APLICADO" : "SIMULACION (usa --apply para escribir)");
    console.log(`Oportunidades sin cuenta: ${summary.total}`);
    console.log(`  enlazadas a una cuenta existente: ${summary.linked}`);
    console.log(`  cuentas nuevas creadas:           ${summary.created}`);
    console.log(`  omitidas (sin RUC del cliente):   ${summary.skipped}`);
  })
  .catch((err) => { console.error("FALLO:", err.message); process.exitCode = 1; })
  .finally(() => setTimeout(() => process.exit(), 200));
