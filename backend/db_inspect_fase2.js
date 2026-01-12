const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "FamDb",
  database: "FamSPI"
});

async function inspectDB() {
  try {
    // 1. Listar tablas relevantes
    console.log("=== 1. LISTA DE TABLAS RELEVANTES ===");
    const tables = await pool.query(`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog','information_schema')
      ORDER BY schemaname, tablename
    `);
    console.log(tables.rows);

    // 2. Describir private_purchase_requests
    console.log("\n=== 2. DESCRIBE private_purchase_requests ===");
    const privatePurchasesDesc = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'private_purchase_requests' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log(privatePurchasesDesc.rows);

    // 3. Describir client_request_consents
    console.log("\n=== 3. DESCRIBE client_request_consents ===");
    const clientConsentsDesc = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'client_request_consents' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log(clientConsentsDesc.rows);

    // 4. Describir user_lopdp_consents
    console.log("\n=== 4. DESCRIBE user_lopdp_consents ===");
    const lopdpConsentsDesc = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_lopdp_consents' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log(lopdpConsentsDesc.rows);

    // 5. Describir document_signatures
    console.log("\n=== 5. DESCRIBE document_signatures ===");
    const signaturesDesc = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'document_signatures' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log(signaturesDesc.rows);

    // 6. Describir notifications
    console.log("\n=== 6. DESCRIBE notifications ===");
    const notificationsDesc = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'notifications' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log(notificationsDesc.rows);

    // 7. Constraints para estados
    console.log("\n=== 7. CONSTRAINTS PARA ESTADOS ===");
    const constraints = await pool.query(`
      SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE contype IN ('c','f','p','u')
        AND conrelid::regclass::text IN ('private_purchase_requests', 'client_request_consents', 'user_lopdp_consents', 'document_signatures', 'notifications')
      ORDER BY conrelid::regclass::text, conname
    `);
    console.log(constraints.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

inspectDB();