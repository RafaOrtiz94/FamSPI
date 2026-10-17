/**
 * Migration Application Script
 * Applies Commercial Drive Folder IDs migration (045)
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

async function verifyColumns() {
    logger.info('Verifying created columns...');

    // Check new columns exist
    const { rows: columns } = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'requests'
          AND column_name IN (
            'drive_comercial_folder_id',
            'drive_user_folder_id',
            'drive_type_folder_id',
            'drive_request_folder_id'
          )
        ORDER BY column_name
    `);

    logger.info('Created columns:', columns.map(c => `${c.column_name} (${c.data_type}, ${c.is_nullable})`));

    // Check indexes exist
    const { rows: indexes } = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'requests'
          AND indexname LIKE '%drive_comercial%'
        ORDER BY indexname
    `);

    logger.info('Created indexes:', indexes.map(i => i.indexname));

    // Check if migration was recorded (skip if migrations table doesn't exist)
    try {
        const { rows: migrations } = await pool.query(`
            SELECT name, executed_at
            FROM migrations
            WHERE name = '045_add_commercial_drive_folder_ids'
        `);

        if (migrations.length > 0) {
            logger.info('Migration recorded:', migrations[0]);
        } else {
            logger.warn('Migration not found in migrations table');
        }
    } catch (error) {
        logger.warn('Migrations table not found, skipping migration record check');
    }
}

async function main() {
    logger.info('📁 Starting Commercial Drive Folder IDs migration...');

    try {
        await applyMigration('045_add_commercial_drive_folder_ids_no_migrations.sql');

        logger.info('✅ Migration applied successfully!');

        // Verify columns were created
        await verifyColumns();

        // Test the columns exist and can be used
        logger.info('Testing column functionality...');

        // Insert a test record to verify columns work
        const testId = Math.floor(Math.random() * 1000000);
        await pool.query(`
            INSERT INTO requests (
                request_group_id, requester_id, request_type_id,
                payload, status, version_number,
                drive_comercial_folder_id, drive_user_folder_id,
                drive_type_folder_id, drive_request_folder_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )
        `, [
            'test-group-' + testId,
            1, // Assuming user 1 exists
            1, // Assuming request type 1 exists
            JSON.stringify({ test: true }),
            'pendiente',
            1,
            '1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6',
            '2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7',
            '3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8',
            '4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9'
        ]);

        // Query it back
        const { rows: testRecord } = await pool.query(`
            SELECT id, drive_comercial_folder_id, drive_user_folder_id,
                   drive_type_folder_id, drive_request_folder_id
            FROM requests
            WHERE request_group_id = $1
        `, ['test-group-' + testId]);

        if (testRecord.length > 0) {
            logger.info('Test record created and retrieved:', {
                id: testRecord[0].id,
                comercialId: testRecord[0].drive_comercial_folder_id?.substring(0, 10) + '...',
                userId: testRecord[0].drive_user_folder_id?.substring(0, 10) + '...',
                typeId: testRecord[0].drive_type_folder_id?.substring(0, 10) + '...',
                requestId: testRecord[0].drive_request_folder_id?.substring(0, 10) + '...'
            });

            // Clean up test record
            await pool.query('DELETE FROM requests WHERE id = $1', [testRecord[0].id]);
            logger.info('Test record cleaned up');
        }

    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();