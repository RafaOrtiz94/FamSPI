const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'FamDb',
  database: process.env.DB_NAME || 'FamSPI',
});

async function checkBusinessCaseCriticalTables() {
  try {
    console.log('Conectando a la base de datos para análisis de tablas críticas...\n');

    // Tabla root principal (asumiendo bc_master o similar)
    console.log('=== TABLA ROOT PRINCIPAL ===');
    const rootTables = ['bc_master', 'business_cases', 'business_case_master'];
    for (const table of rootTables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table};`);
        console.log(`${table}: ${countResult.rows[0].total} registros`);
        if (countResult.rows[0].total > 0) {
          // Mostrar estructura si tiene datos
          const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position LIMIT 10;
          `, [table]);
          console.log(`Columnas principales: ${columnsResult.rows.map(c => c.column_name).join(', ')}`);
          break;
        }
      } catch (e) {
        // Tabla no existe, continuar
      }
    }

    // Tablas críticas para workspace
    console.log('\n=== TABLAS CRÍTICAS PARA WORKSPACE ===');
    const criticalTables = [
      'business_case_section_ownership',
      'business_case_state_transitions',
      'bc_workflow_history',
      'equipment_purchase_business_case_links',
      'migration_progress_business_case'
    ];

    for (const table of criticalTables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table};`);
        console.log(`${table}: ${countResult.rows[0].total} registros`);
      } catch (e) {
        console.log(`${table}: NO EXISTE`);
      }
    }

    // Verificar si hay datos en secciones
    console.log('\n=== SECCIONES DE WORKSPACE ===');
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
      } catch (e) {
        console.log(`${table}: NO EXISTE`);
      }
    }

    // Verificar tablas de wizard vs workspace
    console.log('\n=== COMPARACIÓN WIZARD VS WORKSPACE ===');
    const wizardTables = ['bc_calculations', 'bc_validations'];
    const workspaceTables = ['business_case_section_ownership', 'business_case_state_transitions'];

    console.log('Wizard tables:');
    for (const table of wizardTables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table};`);
        console.log(`  ${table}: ${countResult.rows[0].total} registros`);
      } catch (e) {
        console.log(`  ${table}: NO EXISTE`);
      }
    }

    console.log('Workspace tables:');
    for (const table of workspaceTables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table};`);
        console.log(`  ${table}: ${countResult.rows[0].total} registros`);
      } catch (e) {
        console.log(`  ${table}: NO EXISTE`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkBusinessCaseCriticalTables();