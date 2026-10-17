#!/usr/bin/env node
/**
 * backfill_crm_clients.js
 * Sincroniza clientes aprobados existentes de FamSPI → EspoCRM.
 * Crea Account + Contact en EspoCRM por cada cliente aprobado.
 * Idempotente: puede re-ejecutarse sin duplicar registros.
 *
 * Uso:
 *   node scripts/backfill_crm_clients.js --dry-run    # ver qué se enviaría
 *   node scripts/backfill_crm_clients.js              # ejecutar
 *   node scripts/backfill_crm_clients.js --limit=50   # máximo 50 registros
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const db = require("../src/config/db");
const crmService = require("../src/modules/integrations/crm.service");

const DRY_RUN   = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT     = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : 1000;
const BATCH_SIZE = 20;
const DELAY_MS  = 300;

if (!crmService.isCrmSyncEnabled()) {
  console.error("[BACKFILL] CRM_SYNC_ENABLED no es true — abortando.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBatch(offset, size) {
  const { rows } = await db.query(
    `SELECT
       id,
       ruc_cedula,
       commercial_name,
       legal_person_business_name,
       natural_person_firstname,
       natural_person_lastname,
       client_type,
       client_email,
       legal_rep_email,
       legal_rep_name,
       establishment_city,
       establishment_province,
       shipping_city,
       shipping_province,
       assigned_advisor_email
     FROM client_requests
     WHERE status = 'approved'
     ORDER BY approved_at ASC NULLS LAST, id ASC
     LIMIT $1 OFFSET $2`,
    [size, offset],
  );
  return rows;
}

async function run() {
  console.log("=".repeat(60));
  console.log(" FAM CRM — Backfill Clientes → EspoCRM");
  if (DRY_RUN) console.log(" MODO: DRY-RUN");
  console.log("=".repeat(60));

  // Contar total
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) FROM client_requests WHERE status = 'approved'`
  );
  const total = parseInt(countRows[0].count, 10);
  const toProcess = Math.min(total, LIMIT);
  console.log(`  Total aprobados: ${total} | Procesando: ${toProcess}`);
  console.log("=".repeat(60));

  let offset = 0;
  let ok = 0, skip = 0, failed = 0;

  while (offset < toProcess) {
    const batch = await fetchBatch(offset, Math.min(BATCH_SIZE, toProcess - offset));
    if (!batch.length) break;

    for (const client of batch) {
      const name = client.legal_person_business_name || client.commercial_name ||
        `${client.natural_person_firstname || ""} ${client.natural_person_lastname || ""}`.trim() ||
        client.ruc_cedula || `ID-${client.id}`;

      if (DRY_RUN) {
        console.log(`  [DRY] id=${client.id}  ${name}`);
        ok++;
        continue;
      }

      try {
        const result = await crmService.sendClientApproved(client);
        if (result?.skipped) {
          console.log(`  [SKIP] id=${client.id}  ${name}  — ${result.reason}`);
          skip++;
        } else {
          console.log(`  [OK]   id=${client.id}  ${name}  → ${result.action} (contact:${result.contactId})`);
          ok++;
        }
      } catch (err) {
        console.error(`  [FAIL] id=${client.id}  ${name}  — ${err?.message}`);
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
  console.error("[BACKFILL] Error fatal:", err?.message || err);
  process.exit(1);
});
