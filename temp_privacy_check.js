const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'FamSPI',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'FamDb',
});

async function checkPrivacyColumns() {
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos FamSPI\n');

    console.log('=== BUSCANDO COLUMNAS RELACIONADAS CON PRIVACY/LOPDP ===');
    const query = `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE column_name ILIKE '%privacy%'
         OR column_name ILIKE '%lopdp%'
         OR column_name ILIKE '%confiden%'
         OR column_name ILIKE '%policy%'
         OR column_name ILIKE '%legal%'
         OR column_name ILIKE '%notice%'
      ORDER BY table_name, column_name;
    `;
    const result = await client.query(query);
    console.table(result.rows);

    if (result.rows.length === 0) {
      console.log('❌ No se encontraron columnas relacionadas con privacy/LOPDP en la BD.');
    }

    console.log('\n=== BUSCANDO TABLAS DE SETTINGS/CONFIG/POLICIES ===');
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name ILIKE '%setting%'
             OR table_name ILIKE '%config%'
             OR table_name ILIKE '%polic%'
             OR table_name ILIKE '%notice%'
             OR table_name ILIKE '%legal%'
             OR table_name ILIKE '%privacy%')
      ORDER BY table_name;
    `;
    const tablesResult = await client.query(tablesQuery);
    console.table(tablesResult.rows);

    if (tablesResult.rows.length === 0) {
      console.log('❌ No se encontraron tablas de configuración relacionadas.');
    } else {
      // Para cada tabla encontrada, mostrar sus columnas
      for (const row of tablesResult.rows) {
        const tableName = row.table_name;
        console.log(`\n=== COLUMNAS DE TABLA: ${tableName} ===`);
        const colsQuery = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `, [tableName]);
        console.table(colsQuery.rows);
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

checkPrivacyColumns();