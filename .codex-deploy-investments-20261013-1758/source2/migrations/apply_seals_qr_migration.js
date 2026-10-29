/**
 * Migration Application Script
 * Applies Document Seals and QR System migration (027)
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
    logger.info('Verifying created tables...');

    const { rows } = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'document_seals',
            'document_qr_codes'
          )
        ORDER BY table_name
    `);

    logger.info('Created tables:', rows.map(r => r.table_name));

    // Check functions created
    const { rows: functions } = await pool.query(`
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name IN (
            'generate_seal_code',
            'generate_qr_url',
            'create_document_seal_and_qr'
          )
        ORDER BY routine_name
    `);

    logger.info('Created functions:', functions.map(r => r.routine_name));

    // Check views created
    const { rows: views } = await pool.query(`
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name = 'document_verification_info'
    `);

    logger.info('Created views:', views.map(r => r.table_name));
}

async function main() {
    logger.info('🛡️ Starting Document Seals and QR System migration...');

    try {
        await applyMigration('027_document_seals_qr_system.sql');

        logger.info('✅ Migration applied successfully!');

        // Verify tables were created
        await verifyTables();

        // Test functions
        const { rows: testSeal } = await pool.query(`
            SELECT generate_seal_code(12345, 'Delegado de Protección de Datos') as test_seal
        `);
        logger.info('Test seal code generation:', testSeal[0]);

        const { rows: testQR } = await pool.query(`
            SELECT generate_qr_url(gen_random_uuid()) as test_qr
        `);
        logger.info('Test QR URL generation:', testQR[0]);

    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
