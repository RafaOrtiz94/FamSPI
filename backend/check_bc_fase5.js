const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'FamDb',
  database: process.env.DB_NAME || 'FamSPI',
});

async function checkBCFase5() {
  try {
    console.log('=== VERIFICACIÓN BD FASE 5 ===\n');

    // Verificar BC existente
    const bcResult = await pool.query(`
      SELECT id, bc_number, client_name, current_stage, created_at
      FROM bc_master
      ORDER BY created_at DESC
      LIMIT 10;
    `);

    console.log('Business Cases encontrados:');
    bcResult.rows.forEach(bc => {
      console.log(`  ID ${bc.id}: ${bc.bc_number} - ${bc.client_name} (Stage: ${bc.current_stage})`);
    });

    // BC específico para testing
    const targetBCId = '73678636-7f1d-41ea-9eb5-656cf776112a';
    console.log(`\n=== BC TARGET: ${targetBCId} ===`);

    // Verificar datos operativos
    const operationalResult = await pool.query(`
      SELECT * FROM bc_operational_data
      WHERE bc_id = $1
      LIMIT 5;
    `, [targetBCId]);

    console.log('Datos operativos:');
    if (operationalResult.rows.length > 0) {
      console.log(operationalResult.rows[0]);
    } else {
      console.log('❌ NO HAY DATOS OPERATIVOS');
    }

    // Verificar datos económicos
    const economicResult = await pool.query(`
      SELECT * FROM bc_economic_data
      WHERE bc_id = $1
      LIMIT 5;
    `, [targetBCId]);

    console.log('\nDatos económicos:');
    if (economicResult.rows.length > 0) {
      console.log(economicResult.rows[0]);
    } else {
      console.log('❌ NO HAY DATOS ECONÓMICOS');
    }

    // Verificar que el BC existe
    const bcExists = await pool.query(`
      SELECT COUNT(*) as count FROM bc_master WHERE id = $1;
    `, [targetBCId]);

    console.log(`\nBC ${targetBCId} existe: ${bcExists.rows[0].count > 0 ? '✅ SÍ' : '❌ NO'}`);

    console.log('\n=== URL PARA TESTING ===');
    console.log('http://localhost:8080/dashboard/business-case/workspace/73678636-7f1d-41ea-9eb5-656cf776112a');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  checkBCFase5();
}

module.exports = { checkBCFase5 };