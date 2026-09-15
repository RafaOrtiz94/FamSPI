#!/usr/bin/env node
/**
 * setup_crm_pipeline.js
 * Configura el pipeline comercial en EspoCRM:
 *   1. Copia entityDefs con 12 etapas al contenedor Docker
 *   2. Crea/actualiza webhooks EspoCRM → FamSPI backend
 *   3. Limpia la caché de EspoCRM
 *
 * Uso: node scripts/setup_crm_pipeline.js [--dry-run]
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const axios = require("axios");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const DRY_RUN = process.argv.includes("--dry-run");
const CRM_BASE_URL = (process.env.CRM_BASE_URL || "http://localhost:8081").replace(/\/+$/, "");
const CRM_API_KEY = process.env.CRM_API_KEY || "";
const CONTAINER_NAME = process.env.CRM_CONTAINER_NAME || "fam_espocrm";
const BACKEND_URL = (process.env.BACKEND_URL || "http://host.docker.internal:8080").replace(/\/+$/, "");
const CRM_WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET || "";

if (!CRM_API_KEY) {
  console.error("ERROR: CRM_API_KEY no configurado en .env");
  process.exit(1);
}

// API con X-Api-Key (operaciones normales)
const api = axios.create({
  baseURL: `${CRM_BASE_URL}/api/v1`,
  headers: { "X-Api-Key": CRM_API_KEY, "Content-Type": "application/json" },
  timeout: 15000,
});

// API con Basic Auth (operaciones admin: webhooks)
const CRM_ADMIN_USER = process.env.CRM_ADMIN_USER || process.env.ESPOCRM_ADMIN_USERNAME || "admin";
const CRM_ADMIN_PASS = process.env.CRM_ADMIN_PASS || process.env.ESPOCRM_ADMIN_PASSWORD || "";

const adminApi = axios.create({
  baseURL: `${CRM_BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  auth: { username: CRM_ADMIN_USER, password: CRM_ADMIN_PASS },
  timeout: 15000,
});

function log(msg, data = null) {
  const prefix = DRY_RUN ? "[DRY-RUN]" : "[SETUP]";
  if (data) console.log(`${prefix} ${msg}`, JSON.stringify(data, null, 2));
  else console.log(`${prefix} ${msg}`);
}

function run(cmd) {
  if (DRY_RUN) {
    log(`CMD: ${cmd}`);
    return;
  }
  console.log(`  > ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

// ─── PASO 1: Copiar entityDefs al contenedor ─────────────────────────────────

async function copyEntityDefs() {
  log("Paso 1: Copiando entityDefs de Opportunity al contenedor...");

  const localDir = path.resolve(__dirname, "../../espocrm/metadata/entityDefs");
  const localFile = path.join(localDir, "Opportunity.json");

  if (!fs.existsSync(localFile)) {
    throw new Error(`No se encontró ${localFile}`);
  }

  const containerDir = `/var/www/html/custom/Espo/Custom/Resources/metadata/entityDefs`;

  run(`docker exec ${CONTAINER_NAME} mkdir -p ${containerDir}`);
  run(`docker cp "${localFile}" ${CONTAINER_NAME}:${containerDir}/Opportunity.json`);

  log("EntityDefs copiados OK");
}

// ─── PASO 2: Crear/actualizar webhooks EspoCRM ───────────────────────────────

const WEBHOOK_DEFS = [
  {
    name: "FamSPI Opportunity Create",
    entityType: "Opportunity",
    event: "create",
  },
  {
    name: "FamSPI Opportunity Update",
    entityType: "Opportunity",
    event: "update",
  },
];

async function upsertWebhooks() {
  log("Paso 2: Configurando webhooks en EspoCRM...");

  const webhookUrl = `${BACKEND_URL}/api/v1/integrations/crm/webhook`;
  const headers = CRM_WEBHOOK_SECRET ? { "X-Hook-Secret": CRM_WEBHOOK_SECRET } : {};

  // EspoCRM bloquea URLs internas (host.docker.internal, 192.168.x.x, etc.)
  // Solo se pueden crear webhooks con URLs públicas accesibles desde internet.
  const isInternalUrl = /host\.docker\.internal|localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./.test(webhookUrl);
  if (isInternalUrl) {
    console.log("\n" + "─".repeat(60));
    console.log(" WEBHOOKS — Configuración manual requerida");
    console.log("─".repeat(60));
    console.log(" EspoCRM rechaza URLs internas por seguridad.");
    console.log(" Los webhooks deben configurarse MANUALMENTE en EspoCRM.");
    console.log("\n Accede a: http://localhost:8081 → Administración → Webhooks");
    console.log(" Crea 2 webhooks con estos datos:");
    console.log("\n  Webhook 1:");
    console.log("   - Nombre:       FamSPI Opportunity Create");
    console.log("   - URL:          {URL_PRODUCCION}/api/v1/integrations/crm/webhook");
    console.log("   - Entity Type:  Opportunity");
    console.log("   - Event:        create");
    console.log("   - Active:       ✓");
    console.log("   - Headers:      X-Hook-Secret: " + (CRM_WEBHOOK_SECRET || "TU_SECRET"));
    console.log("\n  Webhook 2:");
    console.log("   - Nombre:       FamSPI Opportunity Update");
    console.log("   - URL:          {URL_PRODUCCION}/api/v1/integrations/crm/webhook");
    console.log("   - Entity Type:  Opportunity");
    console.log("   - Event:        update");
    console.log("   - Active:       ✓");
    console.log("   - Headers:      X-Hook-Secret: " + (CRM_WEBHOOK_SECRET || "TU_SECRET"));
    console.log("\n URL producción: https://spi-backend-983537733948.us-central1.run.app");
    console.log("─".repeat(60) + "\n");
    return;
  }

  // URL pública — crear webhooks via API
  let existing = [];
  try {
    const res = await adminApi.get("Webhook?maxSize=50");
    existing = res.data?.list || [];
    log(`Webhooks existentes encontrados: ${existing.length}`);
  } catch (err) {
    log(`No se pudo listar webhooks (${err?.response?.status || err?.message}) — se procederá a crear`);
  }

  for (const def of WEBHOOK_DEFS) {
    const found = existing.find(
      (w) => w.entityType === def.entityType && w.event === def.event && w.name === def.name
    );

    const payload = {
      name: def.name,
      url: webhookUrl,
      entityType: def.entityType,
      event: def.event,
      isActive: true,
      headers,
    };

    if (found) {
      log(`Actualizando webhook: ${def.name} (id: ${found.id})`);
      if (!DRY_RUN) {
        await adminApi.put(`Webhook/${found.id}`, payload);
        log(`Webhook actualizado OK`);
      }
    } else {
      log(`Creando webhook: ${def.name}`);
      if (!DRY_RUN) {
        const res = await adminApi.post("Webhook", payload);
        log(`Webhook creado OK`, { id: res.data?.id, url: webhookUrl });
      }
    }
  }
}

// ─── PASO 3: Limpiar caché ────────────────────────────────────────────────────

async function clearCache() {
  log("Paso 3: Limpiando caché de EspoCRM...");
  if (!DRY_RUN) {
    await adminApi.post("Admin/clearCache");
  }
  log("Caché limpiada OK");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log(" FAM CRM — Setup Pipeline Comercial (12 etapas)");
  if (DRY_RUN) console.log(" MODO: DRY-RUN (sin cambios reales)");
  console.log("=".repeat(60));
  console.log(`  CRM_BASE_URL:  ${CRM_BASE_URL}`);
  console.log(`  BACKEND_URL:   ${BACKEND_URL}`);
  console.log(`  Container:     ${CONTAINER_NAME}`);
  console.log(`  Admin user:    ${CRM_ADMIN_USER}`);
  console.log(`  Admin pass:    ${CRM_ADMIN_PASS ? "configurado" : "NO configurado"}`);
  console.log(`  Webhook secret:${CRM_WEBHOOK_SECRET ? " configurado" : " NO configurado"}`);
  console.log("=".repeat(60));

  try {
    await copyEntityDefs();
    await upsertWebhooks();
    await clearCache();

    console.log("\n" + "=".repeat(60));
    console.log(" COMPLETADO: Pipeline configurado con 12 etapas.");
    console.log(" Etapas: Prospeccion → Asignado → En Seguimiento →");
    console.log("         Lead Calificado → Analisis de Necesidades →");
    console.log("         Desarrollo de Oferta → Presentacion de Propuesta →");
    console.log("         Negociacion → Contratos →");
    console.log("         Cerrado Ganado / Cerrado Perdido / Archivado");
    console.log("=".repeat(60));
    console.log("\nPROXIMO PASO: Ejecutar backfill de clientes:");
    console.log("  node scripts/backfill_crm_clients.js --dry-run");
    console.log("  node scripts/backfill_crm_clients.js");
  } catch (err) {
    console.error("\n[ERROR]", err?.message || err);
    if (err?.response?.data) {
      console.error("[ESPO ERROR]", JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
