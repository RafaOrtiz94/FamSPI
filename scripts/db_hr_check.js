/**
 * DB HR Check Script - Verificación de endpoints y tablas relacionadas con Talento Humano
 * Uso: node scripts/db_hr_check.js
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

async function checkTables() {
    console.log('\n📋 Verificando tablas relacionadas con HR/Talento Humano...');

    const hrTables = [
        'users',
        'departments',
        'user_attendance_records',
        'attendance_exceptions',
        'attendance_overtime'
    ];

    for (const table of hrTables) {
        try {
            const result = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )
      `, [table]);

            if (result.rows[0].exists) {
                console.log(`✅ Tabla '${table}' existe`);

                // Contar registros
                const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`   📊 Registros: ${countResult.rows[0].count}`);
            } else {
                console.log(`❌ Tabla '${table}' NO existe`);
            }
        } catch (err) {
            console.error(`❌ Error verificando tabla '${table}':`, err.message);
        }
    }
}

async function checkColumns() {
    console.log('\n🔧 Verificando columnas críticas de tablas HR...');

    const checks = [
        {
            table: 'attendance_exceptions',
            columns: ['start_time', 'arrival_time', 'departure_time', 'return_time']
        },
        {
            table: 'user_attendance_records',
            columns: ['entry_time', 'lunch_start_time', 'lunch_end_time', 'exit_time']
        }
    ];

    for (const check of checks) {
        console.log(`\nTabla: ${check.table}`);
        for (const column of check.columns) {
            try {
                const result = await client.query(`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
          )
        `, [check.table, column]);

                if (result.rows[0].exists) {
                    console.log(`  ✅ Columna '${column}' existe`);
                } else {
                    console.log(`  ❌ Columna '${column}' NO existe`);
                }
            } catch (err) {
                console.error(`  ❌ Error verificando columna '${column}':`, err.message);
            }
        }
    }
}

async function checkConstraints() {
    console.log('\n🔗 Verificando constraints y FKs...');

    try {
        // Verificar FK de users a departments
        const fkResult = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('users', 'user_attendance_records', 'attendance_exceptions')
    `);

        if (fkResult.rows.length > 0) {
            console.log('✅ Foreign Keys encontradas:');
            fkResult.rows.forEach(row => {
                console.log(`  ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
            });
        } else {
            console.log('⚠️  No se encontraron Foreign Keys críticas');
        }
    } catch (err) {
        console.error('❌ Error verificando constraints:', err.message);
    }
}

async function main() {
    console.log('🚀 Iniciando verificación de BD para módulo Talento Humano\n');

    const connected = await checkConnectivity();
    if (!connected) {
        process.exit(1);
    }

    await checkTables();
    await checkColumns();
    await checkConstraints();

    await client.end();
    console.log('\n✨ Verificación completada');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };