/*
 * Backfill: lleva los Datos Generales guardados en SPI (cliente, tipo, entidad, provincia/ciudad,
 * objeto, codigo, objetivo, presupuesto referencial y porcentaje maximo de canje) a la hoja BC ya
 * generada de cada Business Case. Solo toca esas celdas de la pestana BC.
 *
 * Con --apply deja una copia de respaldo de cada hoja antes de escribir, y no escribe nada en una
 * hoja cuyas filas no coincidan con la plantilla. Necesita las credenciales de Google del backend,
 * asi que debe correrse donde el backend puede escribir en Sheets (no en el staging local).
 *
 * Uso:
 *   node scripts/backfill_bc_general_data_sheet.js --dry-run
 *   node scripts/backfill_bc_general_data_sheet.js --apply
 *   node scripts/backfill_bc_general_data_sheet.js --apply --ids=<uuid>,<uuid>
 */
const { syncGeneralDataForAllBusinessCases } = require("../src/modules/business-case/businessCaseSheetGeneration.service");

const APPLY = process.argv.includes("--apply");
const idsArg = process.argv.find((arg) => arg.startsWith("--ids="));
const businessCaseIds = idsArg ? idsArg.slice("--ids=".length).split(",").map((id) => id.trim()).filter(Boolean) : null;

syncGeneralDataForAllBusinessCases({ dryRun: !APPLY, businessCaseIds })
  .then((results) => {
    console.log(APPLY ? "APLICADO" : "SIMULACION (usa --apply para escribir)");
    console.log(`Business Cases con hoja generada: ${results.length}`);
    if (APPLY) {
      const ok = results.filter((r) => r.synced);
      const failed = results.filter((r) => !r.synced);
      console.log(`  sincronizados: ${ok.length}`);
      console.log(`  sin sincronizar: ${failed.length}`);
      failed.forEach((r) => console.log(`    - ${r.client_name || r.business_case_id}: ${r.error || r.reason}`));
    } else {
      results.forEach((r) => console.log(`  - ${r.client_name || "(sin nombre)"} · ${r.business_case_id}`));
    }
  })
  .catch((err) => { console.error("FALLO:", err.message); process.exitCode = 1; })
  .finally(() => setTimeout(() => process.exit(), 300));
