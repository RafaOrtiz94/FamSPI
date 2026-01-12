const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'FamDb',
  database: process.env.DB_NAME || 'FamSPI',
});

async function checkWorkspaceTables() {
  try {
    console.log('=== DETALLE DE TABLAS WORKSPACE ===\n');

    // Tablas críticas para workspace
    const workspaceTables = [
      'business_case_section_ownership',
      'business_case_state_transitions',
      'bc_workflow_history',
      'migration_progress_business_case'
    ];

    for (const table of workspaceTables) {
      try {
        console.log(`\n--- ${table.toUpperCase()} ---`);

        // Contar registros
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table};`);
        console.log(`Total registros: ${countResult.rows[0].total}`);

        if (countResult.rows[0].total > 0) {
          // Estructura
          const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position;
          `, [table]);

          console.log('Columnas:');
          columnsResult.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULL)'}`);
          });

          // Muestra algunos registros de ejemplo
          const sampleResult = await pool.query(`SELECT * FROM ${table} LIMIT 2;`);
          if (sampleResult.rows.length > 0) {
            console.log('Registros de ejemplo:');
            sampleResult.rows.forEach((row, idx) => {
              console.log(`  Registro ${idx + 1}: ${JSON.stringify(row, null, 2)}`);
            });
          }
        }
      } catch (e) {
        console.log(`Tabla ${table}: NO EXISTE o ERROR - ${e.message}`);
      }
    }

    // Verificar si hay datos en secciones
    console.log('\n=== DATOS EN SECCIONES ===');
    const sectionTables = [
      'bc_economic_data',
      'bc_operational_data',
      'bc_determinations',
      'bc_equipment_selection',
      'bc_investments'
    ];

    for (const table of sectionTables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table};`);
        console.log(`${table}: ${countResult.rows[0].total} registros`);

        if (countResult.rows[0].total > 0) {
          // Ver estructura
          const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position LIMIT 5;
          `, [table]);
          console.log(`  Columnas principales: ${columnsResult.rows.map(c => c.column_name).join(', ')}`);

          // Ver si hay business_case_id
          const sampleResult = await pool.query(`SELECT business_case_id, id FROM ${table} LIMIT 3;`);
          console.log(`  BC IDs asociados: ${sampleResult.rows.map(r => r.business_case_id).join(', ')}`);
        }
      } catch (e) {
        console.log(`${table}: NO EXISTE`);
      }
    }

    // Verificar si hay BC master con secciones
    console.log('\n=== BUSINESS CASES CON SECCIONES ===');
    try {
      const bcResult = await pool.query(`
        SELECT id, bc_number, client_name, current_stage
        FROM bc_master
        ORDER BY id DESC LIMIT 5;
      `);
      console.log('Business Cases existentes:');
      bcResult.rows.forEach(bc => {
        console.log(`  ID ${bc.id}: ${bc.bc_number} - ${bc.client_name} (Stage: ${bc.current_stage})`);
      });
    } catch (e) {
      console.log('Error consultando bc_master:', e.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkWorkspaceTables();