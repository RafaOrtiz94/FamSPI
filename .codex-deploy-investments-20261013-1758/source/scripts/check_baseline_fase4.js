// Script para baseline BD PASO 4.4 - Despacho + Acta Entrega
// Ejecutar: node backend/scripts/check_baseline_fase4.js

const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'FamDb',
  database: 'FamSPI'
});

async function checkBaseline() {
  try {
    console.log('=== PASO 4.0 - BASELINE BD ===');

    // Query 1: Campos clave de private_purchase_requests
    console.log('\n--- Campos clave de private_purchase_requests ---');
    const purchaseFields = await pool.query(`
      select column_name, data_type
      from information_schema.columns
      where table_name='private_purchase_requests'
        and column_name in ('id','status','contract_document_id','delivery_act_document_id','delivery_dates_json','drive_folder_id')
      order by 1
    `);
    console.log(purchaseFields.rows);

    // Query 2: Campos de documents
    console.log('\n--- Campos de documents ---');
    const documentFields = await pool.query(`
      select column_name, data_type
      from information_schema.columns
      where table_name='documents'
      order by ordinal_position
    `);
    console.log(documentFields.rows);

    // Query 3: Tablas de templates
    console.log('\n--- Tablas de templates ---');
    const templateTables = await pool.query(`
      select table_name
      from information_schema.tables
      where table_schema='public' and table_name ilike '%template%'
    `);
    console.log(templateTables.rows);

    console.log('\n✅ Baseline completada');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

checkBaseline();