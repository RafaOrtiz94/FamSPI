/**
 * Migration Application Script
 * Applies Business Case database migrations (016-020)
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../src/config/logger');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const migrations = [
    '016_business_case_core_tables.sql',
    '017_bc_equipment_selection.sql',
    '018_bc_determinations.sql',
    '019_bc_investments.sql',
    '020_bc_calculations.sql',
];

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
        throw error;
    }
}

async function main() {
    logger.info('Starting Business Case migrations...');

    try {
        for (const migration of migrations) {
            await applyMigration(migration);
        }

        logger.info('✅ All migrations applied successfully!');

        // Verify tables were created
        const { rows } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'equipment_purchase_requests',
          'bc_equipment_selection',
          'bc_determinations',
          'bc_investments',
          'bc_calculations'
        )
      ORDER BY table_name
    `);

        logger.info('Created tables:', rows.map(r => r.table_name));

    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
