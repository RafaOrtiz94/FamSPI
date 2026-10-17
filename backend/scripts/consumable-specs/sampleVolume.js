"use strict";

/**
 * Agrega a las fichas vigentes de reactivos el volumen de muestra por prueba que declara el
 * documento del fabricante (parameters.sample_volume_ul). Lo usa la receta de consumibles para
 * saber cuanto calibrador o control gasta cada medicion.
 *
 * No escribe en la base: genera un archivo SQL para aplicar a mano, como run.js.
 *
 *   node scripts/consumable-specs/sampleVolume.js --out=migrations/3xx_specs_sample_volume.sql
 *
 * Lee catalog_consumable_specs en modo solo lectura y los documentos ya descargados en
 * scripts/consumable-specs/.cache/docs (los deja run.js). Un reactivo sin documento en cache o
 * sin el dato queda igual.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { getDbConfig } = require("../dbConnection");
const { normalizeDocumentText, parseSampleVolumeUl } = require("../../src/modules/business-case/consumableSpecsExtractor");

const DOCS = path.join(__dirname, ".cache", "docs");
const out = (process.argv.find((arg) => arg.startsWith("--out=")) || "").slice(6);
if (!out) {
  console.error("Uso: node scripts/consumable-specs/sampleVolume.js --out=<archivo.sql>");
  process.exit(1);
}
const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

(async () => {
  const client = new Client(getDbConfig());
  await client.connect();
  const { rows } = await client.query(
    `SELECT supplier_code, source_document_id
       FROM catalog_consumable_specs
      WHERE valid_to IS NULL AND item_type = 'reactivo' AND source_document_id IS NOT NULL
      ORDER BY supplier_code`,
  );
  await client.end();

  const statements = [];
  let withoutDocument = 0;
  let withoutValue = 0;
  rows.forEach((row) => {
    const file = path.join(DOCS, `${row.source_document_id}.txt`);
    if (!fs.existsSync(file)) { withoutDocument += 1; return; }
    const volume = parseSampleVolumeUl(normalizeDocumentText(fs.readFileSync(file, "latin1")));
    if (volume === null) { withoutValue += 1; return; }
    statements.push(
      `UPDATE catalog_consumable_specs SET parameters = COALESCE(parameters, '{}'::jsonb) || ${quote(JSON.stringify({ sample_volume_ul: volume }))}::jsonb`
      + ` WHERE valid_to IS NULL AND supplier_code = ${quote(row.supplier_code)} AND source_document_id = ${quote(row.source_document_id)};`,
    );
  });

  fs.writeFileSync(out, [
    "-- Volumen de muestra por prueba (µL) de cada reactivo, segun el documento del fabricante.",
    "-- Generado por scripts/consumable-specs/sampleVolume.js. Solo agrega parameters.sample_volume_ul",
    "-- a la ficha vigente del mismo documento; no cambia versiones ni otros datos.",
    "BEGIN;",
    ...statements,
    "COMMIT;",
    "",
  ].join("\n"));
  console.log(`reactivos ${rows.length} · con volumen ${statements.length} · sin documento en cache ${withoutDocument} · documento sin el dato ${withoutValue}`);
})().catch((error) => { console.error(error.message); process.exit(1); });
