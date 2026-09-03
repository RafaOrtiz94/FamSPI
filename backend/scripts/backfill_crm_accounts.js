#!/usr/bin/env node
/**
 * backfill_crm_accounts.js
 * Sincroniza las cuentas del módulo de oportunidades (tabla 'accounts')
 * hacia EspoCRM como Account records.
 * Ejecutar DESPUÉS de backfill_crm_clients.js.
 * Idempotente: puede re-ejecutarse sin duplicar registros.
 *
 * Uso:
 *   node scripts/backfill_crm_accounts.js --dry-run
 *   node scripts/backfill_crm_accounts.js
 *   node scripts/backfill_crm_accounts.js --limit=100
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const db = require("../src/config/db");
const axios = require("axios");
const crmService = require("../src/modules/integrations/crm.service");

const DRY_RUN   = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT     = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : 1000;
const BATCH_SIZE = 20;
const DELAY_MS  = 300;

if (!crmService.isCrmSyncEnabled()) {
  console.error("[BACKFILL_ACCOUNTS] CRM_SYNC_ENABLED no es true — abortando.");
  process.exit(1);
}

const CRM_BASE_URL = (process.env.CRM_BASE_URL || "").replace(/\/+$/, "");
const CRM_API_KEY  = process.env.CRM_API_KEY || "";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const espoRequest = async (method, path, data = null) => {
  const config = {
    method,
    url: `${CRM_BASE_URL}/api/v1/${path}`,
    headers: { "X-Api-Key": CRM_API_KEY, "Content-Type": "application/json" },
    timeout: 10000,
  };
  if (data) config.data = data;
  const res = await axios(config);
  return res.data;
};

const findAccountByFamspiId = async (famspiAccountId) => {
  const qs = `where[0][type]=equals&where[0][attribute]=cFamspiClientId&where[0][value]=${encodeURIComponent(String(famspiAccountId))}&maxSize=1`;
  const result = await espoRequest("GET", `Account?${qs}`);
  return result?.list?.[0] || null;
};

async function fetchBatch(offset, size) {
  const { rows } = await db.query(
    `SELECT
       a.id,
       a.name,
       a.legal_name,
       a.tax_id,
       a.industry,
       a.city,
       a.province,
       a.country,
       a.website,
       a.notes,
       a.client_id,
       cr.commercial_name  AS client_commercial_name,
       cr.ruc_cedula       AS client_ruc,
       cr.client_type      AS client_type,
       cr.assigned_advisor_email
     FROM accounts a
     LEFT JOIN client_requests cr ON cr.id = a.client_id
     ORDER BY a.created_at ASC
     LIMIT $1 OFFSET $2`,
    [size, offset],
  );
  return rows;
}

async function upsertEspoAccount(account) {
  // El identificador de deduplicación es el famspi_account_id (uuid de la tabla accounts)
  // Guardado en el campo custom cFamspiClientId de EspoCRM (que normalmente tiene el client_request id)
  // Para accounts del módulo de oportunidades usamos el prefix "acc_" para distinguirlos
  const famspiAccountId = `acc_${account.id}`;

  const existing = await findAccountByFamspiId(famspiAccountId);

  const payload = {
    name:                  account.name || account.legal_name || account.client_commercial_name || `Account-${account.id}`,
    billingAddressCity:    account.city || null,
    billingAddressState:   account.province || null,
    billingAddressCountry: account.country || "Ecuador",
    cFamspiClientId:       famspiAccountId,
    cFamspiRuc:            account.tax_id || account.client_ruc || "",
    cClientType:           account.client_type || "",
    cAssignedAdvisorEmail: account.assigned_advisor_email || "",
  };

  if (existing) {
    await espoRequest("PUT", `Account/${existing.id}`, payload);
    return { action: "updated", id: existing.id };
  }
  const result = await espoRequest("POST", "Account", payload);
  return { action: "created", id: result?.id };
}

async function run() {
  console.log("=".repeat(60));
  console.log(" FAM CRM — Backfill Accounts (Oportunidades) → EspoCRM");
  if (DRY_RUN) console.log(" MODO: DRY-RUN");
  console.log("=".repeat(60));

  const { rows: countRows } = await db.query(`SELECT COUNT(*) FROM accounts`);
  const total = parseInt(countRows[0].count, 10);
  const toProcess = Math.min(total, LIMIT);
  console.log(`  Total accounts: ${total} | Procesando: ${toProcess}`);
  console.log("=".repeat(60));

  let offset = 0;
  let ok = 0, failed = 0;

  while (offset < toProcess) {
    const batch = await fetchBatch(offset, Math.min(BATCH_SIZE, toProcess - offset));
    if (!batch.length) break;

    for (const account of batch) {
      const name = account.name || account.legal_name || `Account-${account.id}`;

      if (DRY_RUN) {
        console.log(`  [DRY] id=${account.id}  ${name}  (client_id=${account.client_id || "ninguno"})`);
        ok++;
        continue;
      }

      try {
        const result = await upsertEspoAccount(account);
        console.log(`  [OK]   id=${account.id}  ${name}  → ${result.action} (espo:${result.id})`);
        ok++;
      } catch (err) {
        console.error(`  [FAIL] id=${account.id}  ${name}  — ${err?.message}`);
        failed++;
      }

      await sleep(DELAY_MS);
    }

    offset += batch.length;
    console.log(`  → Progreso: ${Math.min(offset, toProcess)}/${toProcess}  (ok=${ok} fail=${failed})`);
  }

  console.log("=".repeat(60));
  console.log(` COMPLETADO  ok=${ok}  failed=${failed}`);
  console.log("=".repeat(60));
}

run().catch((err) => {
  console.error("[BACKFILL_ACCOUNTS] Error fatal:", err?.message || err);
  process.exit(1);
});
