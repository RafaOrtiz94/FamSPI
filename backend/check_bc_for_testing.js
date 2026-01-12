const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'FamDb',
  database: process.env.DB_NAME || 'FamSPI',
});

async function checkBCForTesting() {
  try {
    console.log('=== VERIFICACIÓN BC PARA TESTING FASE 4 ===\n');

    // Ver BC existentes
    const bcResult = await pool.query(`
      SELECT id, bc_number, client_name, current_stage, created_at
      FROM bc_master
      ORDER BY created_at DESC
      LIMIT 5;
    `);

    console.log('Business Cases existentes:');
    if (bcResult.rows.length === 0) {
      console.log('❌ NO HAY BUSINESS CASES - Necesito crear uno para testing');
      console.log('\nCreando BC de prueba...');

      // Crear BC de prueba
      const createResult = await pool.query(`
        INSERT INTO bc_master (
          bc_number, client_name, contact_person, contact_email,
          current_stage, created_by, created_at, updated_at
        ) VALUES (
          'BC-TEST-001',
          'Hospital Test Fase 4',
          'Dr. Test',
          'test@hospital.com',
          'draft',
          'system',
          NOW(),
          NOW()
        ) RETURNING id, bc_number, client_name;
      `);

      console.log('✅ BC creado:', createResult.rows[0]);

      // Obtener el ID del BC creado
      const bcId = createResult.rows[0].id;

      // Crear algunas secciones básicas para testing
      await pool.query(`
        INSERT INTO bc_economic_data (business_case_id, equipment_id, equipment_name, equipment_cost, created_at)
        VALUES ($1, 1, 'Equipo Test', 100000.00, NOW());
      `, [bcId]);

      console.log('✅ Datos económicos creados');

      await pool.query(`
        INSERT INTO bc_operational_data (business_case_id, lab_type, operational_hours, sample_volume, created_at)
        VALUES ($1, 'clinical', 8, 1000, NOW());
      `, [bcId]);

      console.log('✅ Datos operativos creados');

      console.log(`\n🎯 BC listo para testing: ID ${bcId}, Número BC-TEST-001`);
      return bcId;

    } else {
      console.log('✅ YA HAY BUSINESS CASES EXISTENTES');
      bcResult.rows.forEach(bc => {
        console.log(`  ID ${bc.id}: ${bc.bc_number} - ${bc.client_name} (Stage: ${bc.current_stage})`);
      });

      const firstBC = bcResult.rows[0];
      console.log(`\n🎯 Usando BC existente para testing: ID ${firstBC.id}, Número ${firstBC.bc_number}`);
      return firstBC.id;
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  checkBCForTesting();
}

module.exports = { checkBCForTesting };