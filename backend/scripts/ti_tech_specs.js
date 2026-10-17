/**
 * Especificaciones tecnicas de activos TI redactadas fuera de la API de IA.
 *
 *   node scripts/ti_tech_specs.js export <salida.json>
 *     Exporta los datos registrados de los activos TI reservados en Business
 *     Case (reservas 'reserved' o 'delivered'), en el mismo formato que
 *     recibiria la IA (buildNarrativeInput).
 *
 *   node scripts/ti_tech_specs.js apply <redacciones.json> [--dry-run]
 *     Guarda cada redaccion en ti_assets.tech_spec_narrative. Formato:
 *     { "<asset_id>": { descripcion_producto, especificaciones[{componente, valor, fuente}],
 *                       caracteristicas_destacadas[], aplicaciones } }
 *     Valida contra el mismo esquema de secciones del PDF antes de escribir.
 *
 * Conexion a produccion: DB_PASSWORD desde gcloud Secret Manager (famspi-sbox).
 */
const fs = require("fs");
const db = require("../src/config/db");
const { ensureTiAssetsSchema } = require("../src/modules/ti-assets/tiAssets.service");
const {
  loadAssetFacts,
  buildNarrativeInput,
  isValidNarrative,
  NARRATIVE_SCHEMA,
} = require("../src/modules/ti-assets/tiAssets.spec");

async function exportReserved(outFile) {
  const { rows } = await db.query(
    `SELECT DISTINCT r.ti_asset_id AS id
       FROM public.bc_investment_ti_asset_reservations r
       JOIN public.ti_assets a ON a.id = r.ti_asset_id AND a.active IS NOT FALSE
      WHERE r.status IN ('reserved', 'delivered')
      ORDER BY r.ti_asset_id`,
  );
  const out = {};
  for (const { id } of rows) {
    const facts = await loadAssetFacts(id);
    out[id] = {
      asset_code: facts.asset.asset_code,
      has_narrative: Boolean(facts.asset.tech_spec_narrative),
      datos: buildNarrativeInput(facts),
    };
  }
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`Exportados ${rows.length} activo(s) reservados -> ${outFile}`);
}

function validateNarrative(narrative) {
  const errors = [];
  NARRATIVE_SCHEMA.required.forEach((key) => {
    if (!(key in narrative)) errors.push(`falta "${key}"`);
  });
  if (!Array.isArray(narrative.especificaciones)
    || narrative.especificaciones.some((row) => !row?.componente || !row?.valor)) {
    errors.push("especificaciones debe ser [{ componente, valor }]");
  }
  if (!isValidNarrative(narrative)) errors.push("descripcion_producto vacia");
  return errors;
}

async function applyNarratives(inFile, dryRun) {
  const narratives = JSON.parse(fs.readFileSync(inFile, "utf8"));
  let saved = 0;
  for (const [assetId, narrative] of Object.entries(narratives)) {
    const errors = validateNarrative(narrative);
    if (errors.length) {
      console.log(`  [omitido] activo ${assetId}: ${errors.join("; ")}`);
      continue;
    }
    if (dryRun) {
      console.log(`  [dry-run] activo ${assetId}: valido`);
      continue;
    }
    const { rowCount } = await db.query(
      `UPDATE public.ti_assets
          SET tech_spec_narrative = $2::jsonb, tech_spec_narrative_at = now()
        WHERE id = $1`,
      [Number(assetId), JSON.stringify(narrative)],
    );
    if (rowCount) saved += 1;
    console.log(`  [${rowCount ? "guardado" : "no existe"}] activo ${assetId}`);
  }
  console.log(dryRun ? "Dry-run terminado, nada escrito." : `Guardadas ${saved} redaccion(es).`);
}

(async () => {
  const [mode, file, flag] = process.argv.slice(2);
  if (!["export", "apply"].includes(mode) || !file) {
    console.log("Uso: node scripts/ti_tech_specs.js export <salida.json> | apply <redacciones.json> [--dry-run]");
    process.exit(1);
  }
  await ensureTiAssetsSchema();
  if (mode === "export") await exportReserved(file);
  else await applyNarratives(file, flag === "--dry-run");
  await db.end?.();
  process.exit(0);
})().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
