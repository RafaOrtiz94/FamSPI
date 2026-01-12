/**
 * Migration Application Script
 * Applies Document Audit Functions migration (029)
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../src/config/logger');

// Configuración directa de la base de datos
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'FamDb',
    database: process.env.DB_NAME || 'FamSPI',
});

async function applyMigration(filename) {
    const filePath = path.join(__dirname, filename);
    const sql = await fs.readFile(filePath, 'utf8');

    logger.info(`Applying migration: ${filename}`);

    try {
        await pool.query('BEGIN');
        await pool.query(sql);
        await pool.query('COMMIT');
        logger.info(`✅ Successfully applied: ${filename}`);
        return true;
    } catch (error) {
        await pool.query('ROLLBACK');
        logger.error(`❌ Error applying ${filename}:`, error.message);
        logger.error('Stack:', error.stack);
        throw error;
    }
}

async function verifyTables() {
    logger.info('Verifying created functions and triggers...');

    // Check functions created
    const { rows: functions } = await pool.query(`
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name IN (
            'generate_event_hash',
            'get_next_chain_position',
            'get_last_event_hash',
            'log_document_signature_event',
            'verify_document_log_chain',
            'get_document_audit_trail'
          )
        ORDER BY routine_name
    `);

    logger.info('Created functions:', functions.map(r => r.routine_name));

    // Check views created
    const { rows: views } = await pool.query(`
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name = 'document_audit_dashboard'
    `);

    logger.info('Created views:', views.map(r => r.table_name));

    // Check triggers created
    const { rows: triggers } = await pool.query(`
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
          AND trigger_name IN (
            'trg_log_signature_events',
            'trg_log_seal_events',
            'trg_log_qr_events'
          )
        ORDER BY trigger_name
    `);

    logger.info('Created triggers:', triggers.map(r => `${r.trigger_name} (${r.event_object_table})`));
}

async function main() {
    logger.info('🔐 Starting Document Audit Functions migration (Blockchain-like hash chain)...');

    try {
        await applyMigration('029_document_audit_functions.sql');

        logger.info('✅ Migration applied successfully!');

        // Verify functions were created
        await verifyTables();

        // Test the hash chain functionality
        logger.info('Testing hash chain functionality...');

        // Test hash generation
        const { rows: hashTest } = await pool.query(`
            SELECT generate_event_hash(
                12345,
                'TEST_EVENT',
                NOW(),
                1,
                '{"test": "data"}'::jsonb,
                NULL
            ) as test_hash
        `);
        logger.info('Test hash generation:', hashTest[0]);

        // Test chain position function
        const { rows: chainTest } = await pool.query(`
            SELECT get_next_chain_position(99999) as next_position
        `);
        logger.info('Test chain position:', chainTest[0]);

        // Test audit trail function
        const { rows: auditTest } = await pool.query(`
            SELECT * FROM get_document_audit_trail(99999)
        `);
        logger.info('Test audit trail (should be empty):', auditTest.length, 'events');

        // Check audit dashboard
        const { rows: dashboard } = await pool.query('SELECT * FROM document_audit_dashboard LIMIT 1');
        if (dashboard.length > 0) {
            logger.info('Sample audit dashboard entry:', dashboard[0]);
        } else {
            logger.info('No documents in audit dashboard yet (expected for new system)');
        }

    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
