/**
 * Script para ejecutar migraciones de base de datos
 * Ejecutar: node run-migration.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'famspi_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function runMigration(filename) {
    const migrationPath = path.join(__dirname, 'migrations', filename);

    console.log(`\n📋 Ejecutando migración: ${filename}`);

    if (!fs.existsSync(migrationPath)) {
        throw new Error(`Archivo de migración no encontrado: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    const client = await pool.connect();

    try {
        console.log('🔄 Procesando sentencias SQL...');

        // Ejecutar todo el SQL como un solo bloque
        // Esto maneja correctamente los bloques DO $$ ... END $$;
        await client.query(sql);

        console.log(`✅ Migración ${filename} ejecutada exitosamente`);

    } catch (error) {
        console.error(`❌ Error ejecutando migración ${filename}:`);
        console.error(`   ${error.message}`);
        if (error.detail) {
            console.error(`   Detalle: ${error.detail}`);
        }
        throw error;
    } finally {
        client.release();
    }
}

async function main() {
    console.log('🚀 Iniciando migraciones de base de datos\n');
    console.log(`📦 Base de datos: ${process.env.DB_NAME || 'famspi_db'}`);
    console.log(`🖥️  Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}\n`);

}
}

main();
