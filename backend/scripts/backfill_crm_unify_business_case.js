/*
 * Backfill idempotente: el Business Case es una herramienta de la compra (pública o privada), no
 * una fuente aparte. Este script corrige lo que dejó el modelo anterior:
 *   a) cuando un Business Case y su compra privada tenían cada uno su oportunidad, queda la de la
 *      compra; la otra se archiva (soft delete) después de pasarle sus datos;
 *   b) las oportunidades (y sus leads) con fuente "business_case" pasan a "compra pública" o
 *      "compra privada" según el tipo del Business Case.
 *
 * Uso:
 *   node scripts/backfill_crm_unify_business_case.js --dry-run
 *   node scripts/backfill_crm_unify_business_case.js --apply
 */
const { unifyBusinessCaseOpportunities } = require("../src/modules/crm-fam/crmPurchaseSync.service");

const APPLY = process.argv.includes("--apply");

unifyBusinessCaseOpportunities({ dryRun: !APPLY })
  .then((summary) => {
    console.log(APPLY ? "APLICADO" : "SIMULACION (usa --apply para escribir)");
    console.log(`Oportunidades duplicadas (Business Case + su compra) unificadas: ${summary.merged}`);
    console.log(`Oportunidades con fuente "Business Case" corregidas: ${summary.resourced}`);
    console.log(`  a compra pública: ${summary.to_public}`);
    console.log(`  a compra privada: ${summary.to_private}`);
    if (APPLY) {
      console.log(`Registros pasados a la oportunidad que queda: ${summary.moved_rows}`);
      console.log(`Leads sin oportunidad viva archivados: ${summary.leads_archived}`);
    }
  })
  .catch((err) => { console.error("FALLO:", err.message); process.exitCode = 1; })
  .finally(() => setTimeout(() => process.exit(), 200));
