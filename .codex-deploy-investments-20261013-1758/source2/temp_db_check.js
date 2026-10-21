const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'spi_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function runQueries() {
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos\n');

    console.log('=== ROLES EXISTENTES EN USERS ===');
    const rolesQuery = await client.query('SELECT role, COUNT(*) AS total FROM users GROUP BY role ORDER BY total DESC;');
    console.table(rolesQuery.rows);

    console.log('\n=== USUARIOS TI ACTIVOS ===');
    const tiUsersQuery = await client.query("SELECT id, email, fullname, role, active FROM users WHERE role = 'ti' AND active = true ORDER BY id;");
    console.table(tiUsersQuery.rows);

    console.log('\n=== CONFIRMAR ROLES JEFE_TI/JEFE_DE_TI ===');
    const jefeTiQuery = await client.query("SELECT id, email, fullname, role, active FROM users WHERE role IN ('jefe_ti', 'jefe_de_ti') ORDER BY role, id;");
    console.table(jefeTiQuery.rows);

    console.log('\n=== COLUMNAS REALES AUDITORIA.LOGS ===');
    const auditColsQuery = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'auditoria' AND table_name = 'logs' ORDER BY ordinal_position;");
    console.table(auditColsQuery.rows);

    console.log('\n=== ÚLTIMOS LOGS DE AUTH ===');
    const authLogsQuery = await client.query("SELECT id, creado_en, usuario_email, rol, modulo, accion, descripcion, ip, user_agent, contexto FROM auditoria.logs WHERE modulo = 'auth' ORDER BY creado_en DESC LIMIT 10;");
    console.table(authLogsQuery.rows);

    console.log('\n=== COLUMNAS REALES NOTIFICATIONS ===');
    const notifColsQuery = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notifications' ORDER BY ordinal_position;");
    console.table(notifColsQuery.rows);

    console.log('\n=== ÚLTIMAS NOTIFICACIONES SECURITY/AUTH ===');
    const securityNotifQuery = await client.query("SELECT id, user_id, title, type, source, status, priority, created_at, meta FROM notifications WHERE type = 'security' OR source = 'auth' ORDER BY created_at DESC LIMIT 10;");
    console.table(securityNotifQuery.rows);

    console.log('\n=== COLUMNAS REALES USER_SESSIONS ===');
    const sessionsColsQuery = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_sessions' ORDER BY ordinal_position;");
    console.table(sessionsColsQuery.rows);

    console.log('\n=== ÚLTIMAS SESIONES REGISTRADAS ===');
    const sessionsQuery = await client.query('SELECT id, user_email, ip, user_agent, login_time, logout_time FROM user_sessions ORDER BY login_time DESC LIMIT 5;');
    console.table(sessionsQuery.rows);

    console.log('\n=== BUSCAR TABLAS DE SCHEDULE/HOLIDAYS ===');
    const scheduleTablesQuery = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%holiday%' OR table_name ILIKE '%schedule%' OR table_name ILIKE '%work%' ORDER BY table_schema, table_name;");
    console.table(scheduleTablesQuery.rows);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

runQueries();