const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'FamDb',
  database: process.env.DB_NAME || 'FamSPI',
});

async function checkBusinessCaseTables() {
  try {
    console.log('Conectando a la base de datos...');

    // Listar todas las tablas relacionadas con business_case
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name ILIKE '%business_case%'
      ORDER BY table_name;
    `);

    console.log('\n=== TABLAS DE BUSINESS CASE ===');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });

    // Si hay tablas, mostrar estructura de la principal
    if (tablesResult.rows.length > 0) {
      const mainTable = tablesResult.rows[0].table_name;
      console.log(`\n=== ESTRUCTURA DE ${mainTable.toUpperCase()} ===`);

      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position;
      `, [mainTable]);

      columnsResult.rows.forEach(col => {
        console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(NULL)' : '(NOT NULL)'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });

      // Contar registros
      const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${mainTable};`);
      console.log(`\nTotal de registros en ${mainTable}: ${countResult.rows[0].total}`);
    }

    // Mostrar algunas tablas relacionadas
    console.log('\n=== OTRAS TABLAS RELACIONADAS ===');
    const relatedTablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name ILIKE '%bc_%' OR table_name ILIKE '%wizard%' OR table_name ILIKE '%workspace%')
      ORDER BY table_name;
    `);

    relatedTablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkBusinessCaseTables();