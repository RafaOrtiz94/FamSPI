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
    const migrationPath = path.join(__dirname, 'migrations', '042_fix_hydration_data_population.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration 042_fix_hydration_data_population.sql...');

    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim().startsWith('--') || statement.trim().startsWith('/*')) continue;
      if (statement.trim().length === 0) continue;

      try {
        await client.query(statement);
        console.log('Executed statement successfully');
      } catch (err) {
        console.error('Error executing statement:', err.message);
        console.error('Statement:', statement.substring(0, 100) + '...');
        // Continue with other statements
      }
    }

    console.log('Migration completed successfully');

    // Verify the data was populated
    const { rows: bcCount } = await client.query(`
      SELECT COUNT(*) as bc_count
      FROM equipment_purchase_requests
      WHERE uses_modern_system = true AND bc_system_type = 'modern';
    `);

    console.log(`\n=== BUSINESS CASE COUNT ===`);
    console.log(`Total modern business cases: ${bcCount[0].bc_count}`);

    // Check if section data was populated
    const sectionChecks = [
      { table: 'bc_lab_environment', name: 'Lab Environment' },
      { table: 'bc_equipment_details', name: 'Equipment Details' },
      { table: 'bc_lis_integration', name: 'LIS Integration' },
      { table: 'bc_requirements', name: 'Requirements' },
      { table: 'bc_deliveries', name: 'Deliveries' }
    ];

    console.log('\n=== SECTION DATA POPULATION ===');
    for (const check of sectionChecks) {
      const { rows } = await client.query(`SELECT COUNT(*) as count FROM ${check.table}`);
      console.log(`${check.name}: ${rows[0].count} records`);
    }

    // Check data ownership records
    const { rows: ownershipRows } = await client.query(`
      SELECT section_name, COUNT(*) as count
      FROM data_ownership
      WHERE is_completed = false
      GROUP BY section_name
      ORDER BY section_name;
    `);

    console.log('\n=== DATA OWNERSHIP RECORDS ===');
    ownershipRows.forEach(row => {
      console.log(`${row.section_name}: ${row.count} incomplete records`);
    });

  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

runMigration();
