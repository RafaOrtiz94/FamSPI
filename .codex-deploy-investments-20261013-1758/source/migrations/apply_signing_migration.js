/**
 * Migration Application Script
 * Applies Document Signing System migration (026)
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
            'document_hashes',
            'document_signatures_advanced'
          )
        ORDER BY table_name
    `);

    logger.info('Created tables:', rows.map(r => r.table_name));

    // Check document table modifications
    const { rows: columns } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'documents'
          AND column_name IN ('signature_status', 'current_hash_id', 'is_locked', 'locked_at', 'locked_by')
        ORDER BY column_name
    `);

    logger.info('Modified documents columns:', columns.map(r => r.column_name));

    // Check user table modifications
    const { rows: userColumns } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name IN ('can_sign_documents', 'signature_role', 'signature_certificate_id')
        ORDER BY column_name
    `);

    logger.info('Modified users columns:', userColumns.map(r => r.column_name));
}

async function main() {
    logger.info('🚀 Starting Document Signing System migration...');

    try {
        await applyMigration('026_document_signing_system.sql');

        logger.info('✅ Migration applied successfully!');

        // Verify tables were created
        await verifyTables();

        // Check signature dashboard
        const { rows: dashboard } = await pool.query('SELECT * FROM signature_dashboard');
        logger.info('Signature dashboard data:', dashboard[0]);

    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
