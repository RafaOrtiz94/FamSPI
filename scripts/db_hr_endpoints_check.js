/**
 * DB HR Endpoints Check Script - Verificación de endpoints relacionados con widgets de Talento Humano
 * Uso: node scripts/db_hr_endpoints_check.js
 */

const { Client } = require('pg');
require('dotenv').config({ path: '../backend/.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'FamDb',
    database: process.env.DB_NAME || 'FamSPI'
});

const hrEndpoints = [
    {
        widget: 'ClientRequestWidget',
        endpoint: 'GET /api/requests',
        description: 'Obtiene solicitudes de clientes',
        table: 'requests'
    },
    {
        widget: 'PermisosStatusWidget',
        endpoint: 'GET /api/attendance/exceptions',
        description: 'Obtiene excepciones de asistencia (permisos)',
        table: 'attendance_exceptions'
    },
    {
        widget: 'HRPersonnelRequestsWidget',
        endpoint: 'GET /api/personnel-requests',
        description: 'Obtiene solicitudes de personal RRHH',
        table: 'personnel_requests'
    },
    {
        widget: 'AttendanceWidget',
        endpoint: 'GET /api/attendance',
        description: 'Obtiene registros de asistencia diaria',
        table: 'user_attendance_records'
    },
    {
        widget: 'AsistenciaReportes',
        endpoint: 'POST /api/attendance/pdf',
        description: 'Genera reporte PDF de asistencia',
        table: 'user_attendance_records'
    }
];

async function checkConnectivity() {
    console.log('🔍 Verificando conectividad a BD...');
    try {
        await client.connect();
        console.log('✅ Conexión exitosa a PostgreSQL');
        return true;
    } catch (err) {
        console.error('❌ Error de conexión:', err.message);
        return false;
    }
}

async function checkTableExists(tableName) {
    try {
        const result = await client.query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = $1
            )
        `, [tableName]);
        return result.rows[0].exists;
    } catch (err) {
        console.error(`❌ Error verificando tabla ${tableName}:`, err.message);
        return false;
    }
}

async function checkTableData(tableName) {
    try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        return result.rows[0].count;
    } catch (err) {
        console.error(`❌ Error contando registros en ${tableName}:`, err.message);
        return 0;
    }
}

async function main() {
    console.log('🚀 Iniciando verificación de endpoints HR para widgets\n');

    const connected = await checkConnectivity();
    if (!connected) {
        process.exit(1);
    }

    console.log('📋 Verificando endpoints relacionados con widgets HR:\n');

    for (const endpoint of hrEndpoints) {
        console.log(`🔍 Widget: ${endpoint.widget}`);
        console.log(`   Endpoint: ${endpoint.endpoint}`);
        console.log(`   Descripción: ${endpoint.description}`);
        console.log(`   Tabla asociada: ${endpoint.table}`);

        const exists = await checkTableExists(endpoint.table);
        if (exists) {
            console.log(`   ✅ Tabla existe`);
            const count = await checkTableData(endpoint.table);
            console.log(`   📊 Registros: ${count}`);
        } else {
            console.log(`   ❌ Tabla NO existe - endpoint probablemente fallará`);
        }
        console.log('');
    }

    await client.end();
    console.log('✨ Verificación de endpoints completada');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };