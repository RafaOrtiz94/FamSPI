"use strict";

/**
 * Ficha tecnica de consumibles desde los documentos del fabricante (Roche eLabDoc).
 *
 * Genera un archivo SQL para aplicar a mano (no escribe en la base):
 *
 *   # Carga completa (lo que produjo migrations/306_seed_catalog_consumable_specs.sql)
 *   node scripts/consumable-specs/run.js --mode=seed --out=migrations/3xx_seed_specs.sql
 *
 *   # Cambios de producto: busca de nuevo cada codigo y, si Roche publico otra
 *   # version del documento, cierra la version vigente (valid_to) e inserta la nueva.
 *   node scripts/consumable-specs/run.js --mode=update --out=migrations/3xx_update_specs.sql
 *
 * Opciones: --limit=N (solo N codigos, para probar), --refresh (en seed, volver a
 * buscar aunque haya cache). Lee catalog_consumables y catalog_consumable_specs en
 * modo solo lectura; conexion como el resto de scripts (ver dbConnection.js; en
 * produccion la clave sale de gcloud Secret Manager).
 *
 * Requiere `pdftotext` en el PATH (Git Bash lo trae en /mingw64/bin).
 * Cache de busquedas y PDFs en scripts/consumable-specs/.cache (ignorado por git).
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { Client } = require("pg");
const { getDbConfig } = require("../dbConnection");
const elabdoc = require("./elabdoc");
const {
  normalizeDocumentText,
  normalizeCode,
  extractFromDocument,
  toSpecRow,
} = require("../../src/modules/business-case/consumableSpecsExtractor");
const curated = require("./curatedCobasPure303.json");

const CACHE = path.join(__dirname, ".cache");
const DOCS = path.join(CACHE, "docs");
const INDEX_FILE = path.join(CACHE, "index.json");
const TODAY = new Date().toISOString().slice(0, 10);
const CONCURRENCY = 4;

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v === undefined ? true : v];
}));
const MODE = args.mode;
if (!["seed", "update"].includes(MODE) || !args.out) {
  console.error("Uso: node scripts/consumable-specs/run.js --mode=seed|update --out=<archivo.sql> [--limit=N] [--refresh]");
  process.exit(1);
}

const normName = (s) => String(s || "").normalize("NFKD").replace(/[‐-―]/g, "-").toLowerCase()
  .replace(/elecsys|cobas e|v\d+|\bcs\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

async function loadCatalog(client) {
  const { rows } = await client.query(
    "SELECT id, supplier_code, LOWER(type) AS type, name FROM catalog_consumables ORDER BY id",
  );
  const byCode = new Map();
  const codeless = [];
  rows.forEach((r) => {
    const code = normalizeCode(r.supplier_code);
    if (!code) { codeless.push(r); return; }
    const entry = byCode.get(code) || { code, type: r.type, name: r.name, catalogIds: [] };
    entry.catalogIds.push(r.id);
    byCode.set(code, entry);
  });
  return { byCode, codeless };
}

async function loadOpenSpecs(client) {
  const { rows } = await client.query(
    `SELECT supplier_code, valid_from::text AS valid_from, source_document_id, source_document_version, verification_status
       FROM catalog_consumable_specs WHERE valid_to IS NULL`,
  );
  return new Map(rows.map((r) => [r.supplier_code, r]));
}

// Productos sin supplier_code: se acepta un codigo solo si el nombre del material
// en eLabDoc coincide exactamente con el del catalogo y es unico.
async function resolveCodeless(codeless) {
  const resolved = [];
  for (const r of codeless) {
    const docs = await elabdoc.findDocuments(r.name);
    const materials = new Map();
    docs.forEach((d) => d.materials.forEach((m) => materials.set(m.code, m.name)));
    const exact = [...materials].filter(([, name]) => normName(name) === normName(r.name));
    if (exact.length === 1) resolved.push({ catalogId: r.id, code: normalizeCode(exact[0][0]), name: r.name });
  }
  return resolved;
}

function documentText(doc) {
  const pdf = path.join(DOCS, `${doc.id}.pdf`);
  const txt = path.join(DOCS, `${doc.id}.txt`);
  if (!fs.existsSync(txt)) execFileSync("pdftotext", ["-raw", pdf, txt]);
  return normalizeDocumentText(fs.readFileSync(txt, "latin1"));
}

async function buildRows(products, typeByCode, { refresh }) {
  const index = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, "utf8")) : {};
  const queue = [...products];
  const rows = [];
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      if (refresh || !index[p.code]) index[p.code] = { checkedAt: TODAY, documents: await elabdoc.findDocuments(p.code.padStart(11, "0")) };
      const doc = elabdoc.pickDocument(index[p.code].documents, p.code);
      let row;
      if (doc && await elabdoc.download(doc, path.join(DOCS, `${doc.id}.pdf`))) {
        const extraction = extractFromDocument({ text: documentText(doc), code: p.code, itemType: p.type, typeByCode });
        row = toSpecRow({ code: p.code, itemType: p.type, name: p.name, doc, extraction, retrievedAt: TODAY });
      } else {
        row = toSpecRow({ code: p.code, itemType: p.type, name: p.name, doc: null, extraction: {}, retrievedAt: TODAY });
      }
      rows.push(row);
      if (++done % 50 === 0) {
        fs.writeFileSync(INDEX_FILE, JSON.stringify(index));
        console.log(`${done}/${products.length} productos`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index));
  return rows.sort((a, b) => a.item_type.localeCompare(b.item_type) || a.supplier_code.localeCompare(b.supplier_code));
}

const COLUMNS = ["supplier_code", "item_type", "product_name", "valid_from", "containers_per_pack", "container_volume_ml",
  "levels_per_pack", "tests_per_pack", "stability_open_days", "stability_onboard_days", "single_use",
  "replacement_interval_days", "consumption_basis", "compatible_systems", "system_specs", "parameters", "source_type",
  "source_title", "source_url", "source_document_id", "source_document_version", "source_document_date",
  "source_retrieved_at", "verification_status", "notes"];

function sqlValue(column, value) {
  if (column === "compatible_systems") return `ARRAY[${(value || []).map((v) => sqlValue("", v)).join(", ")}]::text[]`;
  if (column === "system_specs" || column === "parameters") return `${sqlValue("", JSON.stringify(value || {}))}::jsonb`;
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(+value.toFixed(3));
  if (typeof value === "boolean") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

const rowValues = (row) => `  (${COLUMNS.map((c) => sqlValue(c, row[c])).join(", ")})`;
const insertSql = (rows) => `INSERT INTO public.catalog_consumable_specs (\n  ${COLUMNS.join(", ")}\n) VALUES\n${rows.map(rowValues).join(",\n")}\nON CONFLICT (supplier_code, valid_from) DO NOTHING;\n`;

function countBy(rows) {
  const counts = {};
  rows.forEach((r) => { const k = `${r.item_type}/${r.verification_status}`; counts[k] = (counts[k] || 0) + 1; });
  return Object.entries(counts).sort().map(([k, v]) => `${k}=${v}`).join(", ");
}

function catalogFixesSql(resolved) {
  if (!resolved.length) return "";
  return `\n-- Completa supplier_code (hoy NULL) en ${resolved.length} filas del catalogo cuyo nombre coincide\n`
    + "-- exactamente con el material del documento Roche.\n"
    + resolved.map((r) => `UPDATE public.catalog_consumables SET supplier_code = '${r.code.padStart(11, "0")}' WHERE id = ${r.catalogId} AND supplier_code IS NULL;`).join("\n")
    + "\n";
}

async function main() {
  fs.mkdirSync(DOCS, { recursive: true });
  const client = new Client(getDbConfig());
  await client.connect();
  await client.query("SET default_transaction_read_only = on");
  try {
    const { byCode, codeless } = await loadCatalog(client);
    console.log(`Catalogo: ${byCode.size} codigos, ${codeless.length} filas sin codigo`);
    const resolved = await resolveCodeless(codeless);
    console.log(`Resueltos por nombre exacto: ${resolved.length}`);
    resolved.forEach((r) => {
      if (!byCode.has(r.code)) byCode.set(r.code, { code: r.code, type: codeless.find((c) => c.id === r.catalogId).type, name: r.name, catalogIds: [r.catalogId] });
    });

    const typeByCode = new Map([...byCode.values()].map((p) => [p.code, p.type]));
    let products = [...byCode.values()];
    if (args.limit) products = products.slice(0, Number(args.limit));
    const extracted = await buildRows(products, typeByCode, { refresh: MODE === "update" || Boolean(args.refresh) });
    const curatedByCode = new Map(curated.map((r) => [r.supplier_code, r]));

    let sql;
    if (MODE === "seed") {
      // Las fichas revisadas a mano del piloto reemplazan a la extraccion automatica.
      const rows = [...curated, ...extracted.filter((r) => !curatedByCode.has(r.supplier_code))];
      sql = `-- Ficha tecnica de consumibles (${rows.length} codigos). Generado ${TODAY} por scripts/consumable-specs/run.js --mode=seed.\n`
        + "-- Requiere 305_catalog_consumable_specs.sql. Idempotente (ON CONFLICT DO NOTHING).\n"
        + `-- Conteo: ${countBy(rows)}\n\n${insertSql(rows)}${catalogFixesSql(resolved)}`;
    } else {
      const open = await loadOpenSpecs(client);
      const changes = [];
      const skipped = [];
      extracted.forEach((row) => {
        const current = open.get(row.supplier_code);
        if (!row.source_document_id) return; // sin documento: nada que actualizar
        if (current && current.source_document_id === row.source_document_id
          && current.source_document_version === row.source_document_version) return;
        if (current && current.valid_from >= row.valid_from) {
          // Documento fechado antes de la version vigente (p.ej. la vigente era
          // 'pending' con fecha de consulta): la nueva version rige desde hoy;
          // la fecha del documento queda en source_document_date.
          if (current.valid_from >= TODAY) {
            skipped.push(`${row.supplier_code}: la version vigente empieza ${current.valid_from}; volver a correr otro dia`);
            return;
          }
          row.valid_from = TODAY;
        }
        if (current?.verification_status === "verified") {
          row.notes = `Reemplaza una ficha verificada (documento v${current.source_document_version}); revisar los cambios. ${row.notes}`;
        }
        changes.push({ row, current });
      });
      console.log(`Cambios de documento: ${changes.length}; omitidos: ${skipped.length}`);
      sql = `-- Actualizacion de ficha tecnica por nuevas versiones de documentos Roche. Generado ${TODAY}\n`
        + "-- por scripts/consumable-specs/run.js --mode=update. Cierra la version vigente y agrega la nueva.\n"
        + (skipped.length ? `-- Omitidos:\n${skipped.map((s) => `--   ${s}`).join("\n")}\n` : "")
        + "\nBEGIN;\n"
        + changes.map(({ row, current }) => (current
          ? `UPDATE public.catalog_consumable_specs SET valid_to = '${row.valid_from}' WHERE supplier_code = '${row.supplier_code}' AND valid_to IS NULL;\n`
          : "")).join("")
        + (changes.length ? insertSql(changes.map((c) => c.row)) : "")
        + catalogFixesSql(resolved)
        + "COMMIT;\n";
    }
    fs.writeFileSync(path.resolve(process.cwd(), args.out), sql);
    console.log(`SQL escrito en ${args.out}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
