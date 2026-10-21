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
    const migrationPath = path.join(__dirname, 'migrations', '039_fix_ui_guidance_column_issue.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration 039_fix_ui_guidance_column_issue.sql...');

    // Execute the entire migration as one query (since it's a single DDL statement)
    await client.query(migrationSQL);

    console.log('Migration completed successfully');

    // Verify the view now includes the required columns
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'v_business_cases_complete'
        AND table_schema = 'public'
        AND column_name IN ('process_code', 'contract_object', 'canonical_state')
      ORDER BY column_name;
    `);

    console.log('\n=== VIEW COLUMNS VERIFICATION ===');
    rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });

    // Test the view with sample data
    const { rows: sample } = await client.query(`
      SELECT business_case_id, process_code, contract_object
      FROM v_business_cases_complete
      LIMIT 3;
    `);

    console.log('\n=== SAMPLE VIEW DATA ===');
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
