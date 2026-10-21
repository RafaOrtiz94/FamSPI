const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'FamDb',
    database: process.env.DB_NAME || 'FamSPI',
});

async function verifyDatabase() {
    console.log('🔍 VERIFICACIÓN COMPLETA DEL SISTEMA DE FIRMA ELECTRÓNICA\n');
    console.log('=' .repeat(60));

    try {
        // 1. Verificar tablas principales
        console.log('📋 TABLAS PRINCIPALES:');
        const { rows: tables } = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN (
                'documents', 'users', 'document_signatures_advanced',
                'document_hashes', 'document_seals', 'document_qr_codes',
                'document_signature_logs'
              )
            ORDER BY table_name
        `);

        const expectedTables = [
            'documents', 'users', 'document_signatures_advanced',
            'document_hashes', 'document_seals', 'document_qr_codes',
            'document_signature_logs'
        ];

        expectedTables.forEach(table => {
            const exists = tables.some(t => t.table_name === table);
            console.log(`   ${exists ? '✅' : '❌'} ${table}`);
        });

        console.log('');

        // 2. Verificar columnas de document_signature_logs
        console.log('📊 COLUMNAS DE document_signature_logs:');
        const { rows: columns } = await pool.query(`
            SELECT column_name, data_type, is_nullable,
                   CASE WHEN column_default IS NOT NULL THEN 'YES' ELSE 'NO' END as has_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'document_signature_logs'
            ORDER BY ordinal_position
        `);

        const expectedColumns = [
            'id', 'document_id', 'event_type', 'event_description',
            'event_timestamp', 'user_id', 'event_data', 'event_hash',
            'previous_event_hash', 'chain_position', 'is_verified',
            'created_at', 'user_name', 'user_role', 'user_email',
            'ip_address', 'user_agent', 'session_id', 'client_info',
            'verification_timestamp'
        ];

        expectedColumns.forEach(col => {
            const exists = columns.some(c => c.column_name === col);
            const colInfo = columns.find(c => c.column_name === col);
            const info = colInfo ? `${colInfo.data_type} ${colInfo.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${colInfo.has_default === 'YES' ? '(default)' : ''}` : '';
            console.log(`   ${exists ? '✅' : '❌'} ${col} ${info}`.trim());
        });

        console.log('');

        // 3. Verificar funciones
        console.log('⚙️ FUNCIONES IMPLEMENTADAS:');
        const { rows: functions } = await pool.query(`
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_schema = 'public'
              AND routine_name IN (
                'generate_event_hash', 'get_next_chain_position',
                'get_last_event_hash', 'log_document_signature_event',
                'verify_document_log_chain', 'get_document_audit_trail',
                'generate_seal_code', 'generate_qr_url',
                'create_document_seal_and_qr'
              )
            ORDER BY routine_name
        `);

        const expectedFunctions = [
            'generate_event_hash', 'get_next_chain_position',
            'get_last_event_hash', 'log_document_signature_event',
            'verify_document_log_chain', 'get_document_audit_trail',
            'generate_seal_code', 'generate_qr_url',
            'create_document_seal_and_qr'
        ];

        expectedFunctions.forEach(func => {
            const exists = functions.some(f => f.routine_name === func);
            console.log(`   ${exists ? '✅' : '❌'} ${func}()`);
        });

        console.log('');

        // 4. Verificar vistas
        console.log('👁️ VISTAS DISPONIBLES:');
        const { rows: views } = await pool.query(`
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = 'public'
              AND table_name IN (
                'document_audit_dashboard', 'document_verification_info',
                'signature_dashboard'
              )
            ORDER BY table_name
        `);

        const expectedViews = [
            'document_audit_dashboard', 'document_verification_info',
            'signature_dashboard'
        ];

        expectedViews.forEach(view => {
            const exists = views.some(v => v.table_name === view);
            console.log(`   ${exists ? '✅' : '❌'} ${view}`);
        });

        console.log('');

        // 5. Verificar triggers
        console.log('🎯 TRIGGERS CONFIGURADOS:');
        const { rows: triggers } = await pool.query(`
            SELECT trigger_name, event_object_table
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
              AND trigger_name IN (
                'trg_log_signature_events', 'trg_log_seal_events',
                'trg_log_qr_events', 'trg_generate_seal_code',
                'trg_generate_qr_url'
              )
            ORDER BY trigger_name
        `);

        const expectedTriggers = [
            { name: 'trg_log_signature_events', table: 'document_signatures_advanced' },
            { name: 'trg_log_seal_events', table: 'document_seals' },
            { name: 'trg_log_qr_events', table: 'document_qr_codes' },
            { name: 'trg_generate_seal_code', table: 'document_seals' },
            { name: 'trg_generate_qr_url', table: 'document_qr_codes' }
        ];

        expectedTriggers.forEach(trigger => {
            const exists = triggers.some(t => t.trigger_name === trigger.name);
            const triggerInfo = triggers.find(t => t.trigger_name === trigger.name);
            const table = triggerInfo ? triggerInfo.event_object_table : trigger.table;
            console.log(`   ${exists ? '✅' : '❌'} ${trigger.name} (${table})`);
        });

        console.log('');

        // 6. Verificar índices
        console.log('🔍 ÍNDICES OPTIMIZADOS:');
        const { rows: indexes } = await pool.query(`
            SELECT indexname, tablename
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename IN (
                'document_signatures_advanced', 'document_hashes',
                'document_seals', 'document_qr_codes', 'document_signature_logs'
              )
            ORDER BY tablename, indexname
        `);

        const expectedIndexes = [
            'document_signatures_advanced: idx_document_signatures_document_id',
            'document_signatures_advanced: idx_document_signatures_user_id',
            'document_hashes: idx_document_hashes_document_id',
            'document_hashes: idx_document_hashes_sha256',
            'document_seals: idx_document_seals_document_id',
            'document_seals: idx_document_seals_seal_code',
            'document_seals: idx_document_seals_token',
            'document_qr_codes: idx_document_qr_codes_document_id',
            'document_qr_codes: idx_document_qr_codes_token',
            'document_signature_logs: idx_document_signature_logs_document_id',
            'document_signature_logs: idx_document_signature_logs_timestamp'
        ];

        expectedIndexes.forEach(indexSpec => {
            const [table, index] = indexSpec.split(': ');
            const exists = indexes.some(i => i.indexname === index.trim() && i.tablename === table);
            console.log(`   ${exists ? '✅' : '❌'} ${table}.${index}`);
        });

        console.log('');

        // 7. Verificar restricciones
        console.log('🔒 RESTRICCIONES DE INTEGRIDAD:');
        const { rows: constraints } = await pool.query(`
            SELECT tc.table_name, tc.constraint_name, tc.constraint_type
            FROM information_schema.table_constraints tc
            WHERE tc.table_schema = 'public'
              AND tc.table_name IN ('document_signature_logs', 'document_seals', 'document_qr_codes')
              AND tc.constraint_name LIKE '%check%' OR tc.constraint_name LIKE '%unique%'
            ORDER BY tc.table_name, tc.constraint_name
        `);

        const expectedConstraints = [
            'document_signature_logs: valid_event_hash',
            'document_signature_logs: unique_chain_position',
            'document_seals: valid_seal_code',
            'document_qr_codes: valid_qr_size',
            'document_qr_codes: valid_qr_format'
        ];

        expectedConstraints.forEach(constraintSpec => {
            const [table, constraint] = constraintSpec.split(': ');
            const exists = constraints.some(c => c.constraint_name === constraint && c.table_name === table);
            console.log(`   ${exists ? '✅' : '❌'} ${table}.${constraint}`);
        });

        console.log('');

        // 8. Test funcional básico
        console.log('🧪 TESTS FUNCIONALES BÁSICOS:');

        // Test hash generation
        try {
            const { rows: hashTest } = await pool.query(`
                SELECT generate_event_hash(12345, 'TEST', NOW(), 1, '{"test": true}'::jsonb, NULL) as hash
            `);
            console.log(`   ✅ Función generate_event_hash(): ${hashTest[0].hash.substring(0, 16)}...`);
        } catch (err) {
            console.log(`   ❌ Función generate_event_hash(): ${err.message}`);
        }

        // Test chain position
        try {
            const { rows: positionTest } = await pool.query(`
                SELECT get_next_chain_position(99999) as position
            `);
            console.log(`   ✅ Función get_next_chain_position(): ${positionTest[0].position}`);
        } catch (err) {
            console.log(`   ❌ Función get_next_chain_position(): ${err.message}`);
        }

        // Test audit trail (empty)
        try {
            const { rows: auditTest } = await pool.query(`
                SELECT * FROM get_document_audit_trail(99999)
            `);
            console.log(`   ✅ Función get_document_audit_trail(): ${auditTest.length} eventos`);
        } catch (err) {
            console.log(`   ❌ Función get_document_audit_trail(): ${err.message}`);
        }

        console.log('');
        console.log('=' .repeat(60));
        console.log('🏁 VERIFICACIÓN COMPLETADA');

        // Contar elementos implementados
        const implemented = {
            tables: tables.length,
            columns: columns.length,
            functions: functions.length,
            views: views.length,
            triggers: triggers.length,
            indexes: indexes.length,
            constraints: constraints.length
        };

        console.log(`\n📊 RESUMEN DE IMPLEMENTACIÓN:`);
        console.log(`   Tablas: ${implemented.tables}/${expectedTables.length}`);
        console.log(`   Funciones: ${implemented.functions}/${expectedFunctions.length}`);
        console.log(`   Vistas: ${implemented.views}/${expectedViews.length}`);
        console.log(`   Triggers: ${implemented.triggers}/${expectedTriggers.length}`);
        console.log(`   Índices: ${implemented.indexes}/${expectedIndexes.length}`);

        const allImplemented = implemented.tables === expectedTables.length &&
                              implemented.functions === expectedFunctions.length &&
                              implemented.views === expectedViews.length &&
                              implemented.triggers === expectedTriggers.length;

        console.log(`\n🎯 ESTADO GENERAL: ${allImplemented ? '✅ COMPLETO' : '⚠️ INCOMPLETO'}`);

        if (allImplemented) {
            console.log('\n🚀 LA BASE DE DATOS ESTÁ LISTA PARA LAS APIs Y COMPONENTES REACT');
        } else {
            console.log('\n⚠️ FALTAN ELEMENTOS POR IMPLEMENTAR');
        }

    } catch (err) {
        console.error('❌ Error en verificación:', err.message);
    } finally {
        await pool.end();
    }
}

verifyDatabase();
