const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "FamDb",
  database: "FamSPI"
});

async function queryDB() {
  try {
    // Listar tablas
    console.log("=== LISTA DE TABLAS ===");
    const tables = await pool.query(`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog','information_schema')
      ORDER BY schemaname, tablename
    `);
    console.log(tables.rows);

    // Buscar tablas por patrón
    console.log("\n=== TABLAS RELACIONADAS CON COMPRAS ===");
    const purchaseTables = await pool.query(`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog','information_schema')
        AND (tablename ILIKE '%compra%' OR tablename ILIKE '%purchase%' OR tablename ILIKE '%solic%' OR tablename ILIKE '%request%' OR tablename ILIKE '%offer%' OR tablename ILIKE '%oferta%' OR tablename ILIKE '%quote%' OR tablename ILIKE '%cliente%' OR tablename ILIKE '%customer%' OR tablename ILIKE '%lopdp%' OR tablename ILIKE '%consent%' OR tablename ILIKE '%document%' OR tablename ILIKE '%attach%' OR tablename ILIKE '%drive%' OR tablename ILIKE '%workflow%' OR tablename ILIKE '%state%' OR tablename ILIKE '%status%' OR tablename ILIKE '%timeline%' OR tablename ILIKE '%audit%' OR tablename ILIKE '%notif%' OR tablename ILIKE '%calendar%' OR tablename ILIKE '%event%' OR tablename ILIKE '%business%case%')
      ORDER BY schemaname, tablename
    `);
    console.log(purchaseTables.rows);

    // Constraints para estados
    console.log("\n=== CONSTRAINTS PARA ESTADOS ===");
    const constraints = await pool.query(`
      SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE contype IN ('c','f','p','u')
      ORDER BY conrelid::regclass::text, conname
    `);
    console.log(constraints.rows.slice(0, 50)); // Limitar output

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

queryDB();