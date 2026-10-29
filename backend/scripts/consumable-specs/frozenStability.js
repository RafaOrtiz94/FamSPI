"use strict";

/**
 * Completa en las fichas vigentes la estabilidad congelada (parameters.stability_frozen_once_days)
 * a partir del texto de almacenamiento que ya guarda cada ficha (parameters.evidence).
 *
 * Por que: las fichas Elecsys (PreciControl, CalSet) dicen "reconstituido: -20 °C N meses (freeze
 * only once) o 2-8 °C 3 dias en el analizador". El extractor solo reconocia "when frozen once", asi
 * que quedo solo la estabilidad corta y el motor abria un envase cada pocos dias.
 *
 * No escribe en la base: genera un SQL para aplicar a mano.
 *   node scripts/consumable-specs/frozenStability.js --out=migrations/3xx_specs_frozen_stability.sql
 */

require("dotenv").config();
const fs = require("fs");
const { Client } = require("pg");
const { getDbConfig } = require("../dbConnection");
const { parseStability } = require("../../src/modules/business-case/consumableSpecsExtractor");

const out = (process.argv.find((arg) => arg.startsWith("--out=")) || "").slice(6);
if (!out) {
  console.error("Uso: node scripts/consumable-specs/frozenStability.js --out=<archivo.sql>");
  process.exit(1);
}
const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

(async () => {
  const client = new Client(getDbConfig());
  await client.connect();
  const { rows } = await client.query(
    `SELECT supplier_code, source_document_id, item_type, parameters->'evidence'->'storage_and_stability' AS blocks
       FROM catalog_consumable_specs
      WHERE valid_to IS NULL AND parameters->>'stability_frozen_once_days' IS NULL
      ORDER BY supplier_code`,
  );
  await client.end();
  const statements = [];
  const byType = {};
  rows.forEach((row) => {
    const blocks = Array.isArray(row.blocks) ? row.blocks : [];
    const frozen = blocks.map((block) => parseStability(String(block || "")).frozen_once_days).find((value) => value > 0);
    if (!frozen) return;
    byType[row.item_type] = (byType[row.item_type] || 0) + 1;
    statements.push(
      `UPDATE catalog_consumable_specs SET parameters = COALESCE(parameters, '{}'::jsonb) || ${quote(JSON.stringify({ stability_frozen_once_days: frozen }))}::jsonb`
      + ` WHERE valid_to IS NULL AND supplier_code = ${quote(row.supplier_code)}`
      + (row.source_document_id ? ` AND source_document_id = ${quote(row.source_document_id)}` : " AND source_document_id IS NULL")
      + " AND parameters->>'stability_frozen_once_days' IS NULL;",
    );
  });
  fs.writeFileSync(out, [
    "-- Estabilidad congelada (congelar una sola vez) de las fichas vigentes, leida del texto de",
    "-- almacenamiento que ya guarda cada ficha. Generado por scripts/consumable-specs/frozenStability.js.",
    "-- Solo agrega parameters.stability_frozen_once_days donde falta; no cambia versiones ni otros datos.",
    "BEGIN;",
    ...statements,
    "COMMIT;",
    "",
  ].join("\n"));
  console.log(`fichas sin estabilidad congelada: ${rows.length} · completadas: ${statements.length} · por tipo: ${JSON.stringify(byType)}`);
})().catch((error) => { console.error(error.message); process.exit(1); });
