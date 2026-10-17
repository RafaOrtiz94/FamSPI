const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Migraciones 305-307: ficha tecnica versionada de consumibles, seed del catalogo
// y ajustes del laboratorio por producto. Se aplican en una sola transaccion.
const FILES = [
  "305_catalog_consumable_specs.sql",
  "306_seed_catalog_consumable_specs.sql",
  "307_bc_lab_product_parameters.sql",
];

function getDbPassword() {
  try {
    return execSync('gcloud secrets versions access latest --secret="DB_PASSWORD" --project="famspi-sbox"', { encoding: "utf8" }).trim();
  } catch {
    return process.env.DB_PASSWORD || "";
  }
}

async function run() {
  const pool = new Pool({
    host: "ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech",
    port: 5432,
    user: "neondb_owner",
    password: getDbPassword(),
    database: "FamSPI",
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    const pre = await client.query(`SELECT
      to_regclass('public.catalog_consumable_specs') AS specs,
      to_regclass('public.bc_lab_product_parameters') AS overrides,
      to_regclass('public.equipment_purchase_requests') AS bcs,
      (SELECT COUNT(*) FROM catalog_consumables WHERE supplier_code IS NOT NULL)::int AS catalog_with_code`);
    console.log("Estado previo:", pre.rows[0]);
    if (pre.rows[0].specs || pre.rows[0].overrides) throw new Error("Las tablas ya existen; no se aplica nada.");
    if (!pre.rows[0].bcs) throw new Error("No existe equipment_purchase_requests (FK de 307).");

    await client.query("BEGIN");
    for (const file of FILES) {
      await client.query(fs.readFileSync(path.join(__dirname, "../migrations", file), "utf8"));
      console.log(`Aplicada ${file}`);
    }
    await client.query("COMMIT");

    const post = await client.query(`SELECT
      (SELECT COUNT(*) FROM catalog_consumable_specs)::int AS specs,
      (SELECT COUNT(*) FROM catalog_consumable_specs WHERE valid_to IS NULL)::int AS open_versions,
      (SELECT COUNT(*) FROM catalog_consumables WHERE supplier_code IS NOT NULL)::int AS catalog_with_code,
      to_regclass('public.bc_lab_product_parameters') IS NOT NULL AS overrides_table`);
    console.log("Estado posterior:", post.rows[0]);
    const byStatus = await client.query(
      "SELECT item_type, verification_status, COUNT(*)::int AS n FROM catalog_consumable_specs GROUP BY 1, 2 ORDER BY 1, 2",
    );
    console.table(byStatus.rows);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error, transaccion revertida:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
