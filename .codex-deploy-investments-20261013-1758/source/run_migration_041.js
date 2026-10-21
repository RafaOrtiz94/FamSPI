const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'famspi_db',
    user: 'famspi_user',
    password: 'famspi_password'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read and execute the migration
    const migrationPath = path.join(__dirname, 'migrations', '041_add_client_data_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration 041_add_client_data_fields.sql...');

    // Execute the entire migration as one query (since it's a single DDL statement)
    await client.query(migrationSQL);

    console.log('Migration completed successfully');

    // Verify the columns were added
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'equipment_purchase_requests'
        AND table_schema = 'public'
        AND column_name IN ('process_code', 'contract_object')
      ORDER BY column_name;
    `);

    console.log('\n=== COLUMN VALIDATION ===');
    rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Test with a sample business case
    const { rows: sample } = await client.query(`
      SELECT id, process_code, contract_object
      FROM equipment_purchase_requests
      WHERE uses_modern_system = true AND bc_system_type = 'modern'
      LIMIT 3;
    `);

    console.log('\n=== SAMPLE DATA ===');
    sample.forEach((row, i) => {
      console.log(`Row ${i+1}: process_code='${row.process_code}', contract_object='${row.contract_object}'`);
    });

  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

runMigration();
