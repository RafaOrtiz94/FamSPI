const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_IvXRb0pLAku5@ep-muddy-sun-ah5um48r-pooler.c-3.us-east-1.aws.neon.tech/FamSPI?sslmode=require&channel_binding=require'
  });

  try {
    console.log('[MIGRATION] Connecting to Neon...');
    await client.connect();
    console.log('[MIGRATION] Connected');

    const migrationPath = path.join(__dirname, '../migrations/170_workflow_alignment_part2.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('[MIGRATION] Executing migration 170...');
    await client.query(migrationSQL);
    console.log('[MIGRATION] Migration 170 applied successfully!');

    // Verify the columns were added
    console.log('\n[MIGRATION] Verifying columns...');
    const result = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'equipment_purchase_requests'
        AND column_name IN (
          'purchase_type',
          'private_modality',
          'requires_business_case',
          'availability_source',
          'supply_control_type'
        )
      ORDER BY ordinal_position
    `);

    console.log('Columns added:', result.rows.map(r => r.column_name).join(', '));
    console.log('\n✅ MIGRATION COMPLETED SUCCESSFULLY');

  } catch (error) {
    console.error('[MIGRATION] ERROR:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await client.end();
  }
}

applyMigration();
