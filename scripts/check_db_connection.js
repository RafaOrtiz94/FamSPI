// Script temporal para verificar conexión a DB
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'FamDb',
    database: 'FamSPI'
});

async function checkConnection() {
    try {
        console.log('🔍 Intentando conectar a PostgreSQL...');
        const client = await pool.connect();
        console.log('✅ Conexión exitosa a la base de datos FamSPI');

        const result = await client.query('SELECT version()');
        console.log('📊 Versión de PostgreSQL:', result.rows[0].version);

        client.release();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        process.exit(1);
    }
}

checkConnection();
