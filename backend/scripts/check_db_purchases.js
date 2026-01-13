const { Client } = require('pg');
require('dotenv').config();

async function checkDatabasePurchases() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'FamDb',
    database: process.env.DB_NAME || 'FamSPI'
  });

  try {
    console.log('[PURCHASES_WORKSPACE][FASE3] DB preflight - Connecting...');
    await client.connect();
    console.log('[PURCHASES_WORKSPACE][FASE3] DB preflight - Connected successfully');

    // List all tables
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n=== TABLAS TOTAL EN SISTEMA ===');
    console.log(`Total: ${tablesResult.rows.length}`);
    console.log('Tablas relevantes:', tablesResult.rows
      .filter(row => row.table_name.includes('purchase') ||
                     row.table_name.includes('compra') ||
                     row.table_name.includes('client') ||
                     row.table_name.includes('business_case') ||
                     row.table_name.includes('equipment') ||
                     row.table_name.includes('request'))
      .map(row => row.table_name)
      .join(', '));

    // Check specific tables exist and their columns
    const criticalTables = [
      'private_purchase_requests',
      'equipment_purchase_requests',
      'client_requests',
      'business_case_master',
      'bc_master'
    ];

    console.log('\n=== VERIFICACIÓN TABLAS CRÍTICAS ===');
    for (const table of criticalTables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`✓ ${table}: ${countResult.rows[0].count} registros`);

        // Get columns
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [table]);

        console.log(`  Columnas: ${columnsResult.rows.map(col => col.column_name).join(', ')}`);

      } catch (error) {
        console.log(`✗ ${table}: NO EXISTE - ${error.message}`);
      }
    }

    // Check enums
    console.log('\n=== ENUMS DE ESTADO ===');
    try {
      const enumsResult = await client.query(`
        SELECT n.nspname AS schema_name,
               t.typname AS type_name,
               array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE t.typname LIKE '%purchase%' OR t.typname LIKE '%request%'
        GROUP BY n.nspname, t.typname
      `);

      enumsResult.rows.forEach(enumRow => {
        console.log(`${enumRow.type_name}: ${enumRow.enum_values.join(', ')}`);
      });
    } catch (error) {
      console.log('Error obteniendo enums:', error.message);
    }

    console.log('\n=== VERIFICACIÓN COMPLETADA ===');
    console.log('[PURCHASES_WORKSPACE][FASE3] DB preflight - OK');

  } catch (error) {
    console.error('[PURCHASES_WORKSPACE][FASE3] DB preflight - ERROR:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkDatabasePurchases();