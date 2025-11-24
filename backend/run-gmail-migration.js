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

async function runGmailMigration() {
    console.log('\n🚀 Ejecutando migración de Gmail OAuth Tokens\n');
    console.log(`📦 Base de datos: ${process.env.DB_NAME || 'famspi_db'}`);
    console.log(`🖥️  Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}\n`);

    const client = await pool.connect();

    try {
        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, 'migrations', '008_gmail_oauth_tokens.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🔄 Ejecutando SQL...\n');

        // Ejecutar la migración
        await client.query(sql);

        console.log('✅ Tabla user_gmail_tokens creada exitosamente\n');
        console.log('📝 La tabla incluye:');
        console.log('   - id (SERIAL PRIMARY KEY)');
        console.log('   - user_id (INTEGER, UNIQUE)');
        console.log('   - email (VARCHAR)');
        console.log('   - access_token (TEXT)');
        console.log('   - refresh_token (TEXT)');
        console.log('   - expiry_date (TIMESTAMP)');
        console.log('\n✨ Migración completada exitosamente\n');

    } catch (error) {
        if (error.code === '42P07') {
            console.log('⚠️  La tabla ya existe. No hay nada que hacer.\n');
        } else {
            console.error('❌ Error:', error.message);
            throw error;
        }
    } finally {
        client.release();
        await pool.end();
    }
}

runGmailMigration().catch(err => {
    console.error('\n💥 Error fatal:', err.message);
    process.exit(1);
});
