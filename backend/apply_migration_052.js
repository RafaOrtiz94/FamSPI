const { Pool } = require("pg");
const fs = require("fs");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "FamDb",
  database: "FamSPI"
});

async function applyMigration() {
  try {
    const sql = fs.readFileSync('migrations/052_fase2_private_purchase_enhancements.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration applied successfully!');

    // Verify some changes
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'private_purchase_requests'
        AND column_name LIKE '%client_%'
      ORDER BY column_name
    `);
    console.log('New client-related columns:', result.rows.map(r => r.column_name));

    const correctionsTable = await pool.query(`
      SELECT tablename FROM pg_tables WHERE tablename = 'purchase_corrections'
    `);
    console.log('Corrections table created:', correctionsTable.rows.length > 0);

    const newColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'private_purchase_requests'
        AND column_name IN (
          'client_registration_requested_at',
          'client_approved_at',
          'manager_contract_decision',
          'contract_document_id',
          'delivery_act_document_id'
        )
    `);
    console.log('Key new columns added:', newColumns.rows.map(r => r.column_name));

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

applyMigration();