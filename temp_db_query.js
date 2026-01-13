const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'FamDb',
  database: process.env.DB_NAME || 'FamSPI',
});

async function analyzePrivatePurchaseTables() {
  try {
    console.log('=== ANÁLISIS BD - FLUJO COMPRA PRIVADA ===\n');

    // PASO A.1: Listar tablas relevantes con patterns de búsqueda
    console.log('PASO A.1 - TABLAS RELEVANTES CON PATTERNS:');
    console.log('Patterns: "purchase/compra/oferta/cliente/document/approval/notification/workflow"\n');

    const patterns = ['purchase', 'compra', 'oferta', 'cliente', 'client', 'document', 'approval', 'notification', 'workflow', 'private', 'business_case', 'bc_', 'equipment_purchase', 'signature', 'consent', 'lopdp', 'request', 'approval'];

    const allTablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('TABLAS TOTALES EN SISTEMA:', allTablesResult.rows.length);
    console.log('TABLAS CON PATTERNS RELEVANTES:');

    const relevantTables = allTablesResult.rows.filter(row => {
      const tableName = row.table_name.toLowerCase();
      return patterns.some(pattern => tableName.includes(pattern));
    });

    relevantTables.forEach(row => console.log(`  - ${row.table_name}`));
    console.log('');

    // PASO A.2: Identificar tablas de solicitudes/compra/procesos comerciales
    console.log('PASO A.2 - TABLAS DE SOLICITUDES/COMPRA/PROCESOS COMERCIALES:');
    const commercialTables = [
      'private_purchase_requests',
      'client_requests',
      'business_cases',
      'bc_master',
      'equipment_purchase_requests',
      'business_case_master',
      'purchase_requests_legacy_mapping'
    ];

    for (const table of commercialTables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table};`);
        console.log(`  ${table}: ${countResult.rows[0].total} registros`);

        // Mostrar estructura básica
        const columnsResult = await pool.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `, [table]);

        console.log(`    Columnas: ${columnsResult.rows.map(c => `${c.column_name}(${c.data_type})`).join(', ')}`);
        console.log('');
      } catch (e) {
        console.log(`  ${table}: NO EXISTE`);
      }
    }

    // PASO A.3: Identificar tablas de clientes/onboarding/LOPDP
    console.log('PASO A.3 - TABLAS DE CLIENTES/ONBOARDING/LOPDP:');
    const clientTables = [
      'clients',
      'client_requests',
      'user_lopdp_consents',
      'client_request_consents',
      'clients_and_approvals',
      'client_request_approval_letter'
    ];

    for (const table of clientTables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table};`);
        console.log(`  ${table}: ${countResult.rows[0].total} registros`);
      } catch (e) {
        console.log(`  ${table}: NO EXISTE`);
      }
    }
    console.log('');

    // PASO A.4: Identificar tablas de documentos/Drive/firmas/estados
    console.log('PASO A.4 - TABLAS DE DOCUMENTOS/DRIVE/FIRMAS/ESTADOS:');
    const documentTables = [
      'document_signing_system',
      'document_seals_qr_system',
      'document_audit_logs',
      'document_audit_functions',
      'signature_requests',
      'signature_logs'
    ];

    for (const table of documentTables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table};`);
        console.log(`  ${table}: ${countResult.rows[0].total} registros`);
      } catch (e) {
        console.log(`  ${table}: NO EXISTE`);
      }
    }
    console.log('');

    // PASO A.5: Identificar tablas de notificaciones y auditoría
    console.log('PASO A.5 - TABLAS DE NOTIFICACIONES Y AUDITORÍA:');
    const notificationTables = [
      'notifications',
      'notification_logs',
      'auditoria',
      'audit_logs',
      'audit_log_functions'
    ];

    for (const table of notificationTables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table};`);
        console.log(`  ${table}: ${countResult.rows[0].total} registros`);
      } catch (e) {
        console.log(`  ${table}: NO EXISTE`);
      }
    }
    console.log('');

    // PASO A.6: Verificar existencia de tabla/enum de estados del flujo
    console.log('PASO A.6 - ENUMS/TABLAS DE ESTADOS DEL FLUJO:');

    // Buscar enums relacionados
    const enumsResult = await pool.query(`
      SELECT n.nspname AS schema_name, t.typname AS enum_name, e.enumlabel AS enum_value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder;
    `);

    console.log('ENUMS ENCONTRADOS:');
    const uniqueEnums = {};
    enumsResult.rows.forEach(row => {
      if (!uniqueEnums[row.enum_name]) {
        uniqueEnums[row.enum_name] = [];
      }
      uniqueEnums[row.enum_name].push(row.enum_value);
    });

    Object.keys(uniqueEnums).forEach(enumName => {
      if (enumName.toLowerCase().includes('status') ||
          enumName.toLowerCase().includes('state') ||
          enumName.toLowerCase().includes('workflow') ||
          enumName.toLowerCase().includes('private_purchase') ||
          enumName.toLowerCase().includes('business_case')) {
        console.log(`  ${enumName}: ${uniqueEnums[enumName].join(', ')}`);
      }
    });

    // Buscar columnas con 'status' en tablas relevantes
    console.log('\nCOLUMNAS DE STATUS EN TABLAS RELEVANTES:');
    const statusColumnsResult = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND column_name ILIKE '%status%'
      AND table_name IN (
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        AND (table_name ILIKE '%purchase%' OR
             table_name ILIKE '%business_case%' OR
             table_name ILIKE '%client%' OR
             table_name ILIKE '%request%' OR
             table_name ILIKE '%approval%')
      )
      ORDER BY table_name, column_name;
    `);

    statusColumnsResult.rows.forEach(row => {
      console.log(`  ${row.table_name}.${row.column_name} (${row.data_type})`);
    });

    console.log('\n=== ANÁLISIS COMPLETADO ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

analyzePrivatePurchaseTables();