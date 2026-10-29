// Script para validar implementación PASO 4 - Despacho + Acta Entrega
// Ejecutar: node backend/scripts/validate_paso4_implementation.js

const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'FamDb',
  database: 'FamSPI'
});

async function validateImplementation() {
  try {
    console.log('=== VALIDACIÓN FINAL PASO 4 ===');

    // 1. Evidencia estados
    console.log('\n--- 1. Evidencia estados ---');
    const states = await pool.query(`
      select id, status, contract_document_id, delivery_act_document_id
      from private_purchase_requests
      order by id desc limit 10
    `);
    console.log(states.rows);

    // 2. Evidencia documents
    console.log('\n--- 2. Evidencia documents ---');
    const docs = await pool.query(`
      select id, request_id, request_type_id, doc_drive_id, pdf_drive_id, folder_drive_id, version_number, signed, created_at
      from documents
      order by id desc limit 10
    `);
    console.log(docs.rows);

    // 3. Verificar schedule
    console.log('\n--- 3. Evidencia purchase_delivery_schedules ---');
    const schedules = await pool.query(`
      select * from purchase_delivery_schedules order by created_at desc limit 5
    `);
    console.log(schedules.rows);

    console.log('\n✅ Validación completada');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

validateImplementation();