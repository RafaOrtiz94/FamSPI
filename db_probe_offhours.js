const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'spi_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function runOffHoursProbes() {
  try {
    console.log('🔍 DB PROBE: Off-Hours Login System Analysis\n');
    console.log('⏰ Timestamp:', new Date().toISOString(), '\n');

    await client.connect();
    console.log('✅ Connected to database\n');

    // A) Roles reales y TI reales
    console.log('========================================');
    console.log('A) ROLES REALES Y TI RECIPIENTS');
    console.log('========================================');

    console.log('\nA1) Roles existentes en users:');
    const rolesQuery = await client.query('SELECT role, COUNT(*) AS total FROM users GROUP BY role ORDER BY total DESC;');
    console.table(rolesQuery.rows);

    console.log('\nA2) Usuarios TI activos (destinatarios reales):');
    const tiUsersQuery = await client.query("SELECT id, email, fullname, role, active FROM users WHERE role = 'ti' AND active = true ORDER BY id;");
    console.table(tiUsersQuery.rows);

    console.log('\nA3) Confirmar roles jefe_ti/jefe_de_ti (esperado: vacío):');
    const jefeTiQuery = await client.query("SELECT id, email, fullname, role, active FROM users WHERE role IN ('jefe_ti', 'jefe_de_ti') ORDER BY role, id;");
    console.table(jefeTiQuery.rows);

    // B) Esquema auditoría real
    console.log('\n========================================');
    console.log('B) ESQUEMA AUDITORÍA REAL');
    console.log('========================================');

    console.log('\nB1) Columnas auditoria.logs:');
    const auditColsQuery = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'auditoria' AND table_name = 'logs' ORDER BY ordinal_position;");
    console.table(auditColsQuery.rows);

    // C) Últimos eventos auth / security y evidencia de contexto
    console.log('\n========================================');
    console.log('C) ÚLTIMOS EVENTOS AUTH/SECURITY');
    console.log('========================================');

    console.log('\nC1) Últimos 20 logs auth (todos):');
    const authLogsQuery = await client.query("SELECT id, creado_en, usuario_email, rol, modulo, accion, descripcion, ip, user_agent, contexto FROM auditoria.logs WHERE modulo = 'auth' ORDER BY creado_en DESC LIMIT 20;");
    console.table(authLogsQuery.rows);

    console.log('\nC2) Eventos específicos off-hours (si existen):');
    const offHoursLogsQuery = await client.query("SELECT id, creado_en, usuario_email, accion, descripcion, ip, user_agent, contexto FROM auditoria.logs WHERE modulo = 'auth' AND (accion ILIKE '%off%' OR descripcion ILIKE '%fuera de horario%' OR descripcion ILIKE '%offhours%') ORDER BY creado_en DESC LIMIT 20;");
    console.table(offHoursLogsQuery.rows);

    // D) Notificaciones reales security/auth
    console.log('\n========================================');
    console.log('D) NOTIFICACIONES SECURITY/AUTH');
    console.log('========================================');

    console.log('\nD1) Columnas notifications:');
    const notifColsQuery = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notifications' ORDER BY ordinal_position;");
    console.table(notifColsQuery.rows);

    console.log('\nD2) Últimas 20 notificaciones security/auth:');
    const securityNotifQuery = await client.query("SELECT id, user_id, title, type, source, status, priority, created_at, meta FROM notifications WHERE type = 'security' OR source = 'auth' ORDER BY created_at DESC LIMIT 20;");
    console.table(securityNotifQuery.rows);

    // E) Sesiones reales para correlación
    console.log('\n========================================');
    console.log('E) SESIONES PARA CORRELACIÓN');
    console.log('========================================');

    console.log('\nE1) Columnas user_sessions:');
    const sessionsColsQuery = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_sessions' ORDER BY ordinal_position;");
    console.table(sessionsColsQuery.rows);

    console.log('\nE2) Últimas 15 sesiones:');
    const sessionsQuery = await client.query('SELECT id, user_email, ip, user_agent, login_time, logout_time FROM user_sessions ORDER BY login_time DESC LIMIT 15;');
    console.table(sessionsQuery.rows);

    // F) Tablas schedule/holidays
    console.log('\n========================================');
    console.log('F) TABLAS SCHEDULE/HOLIDAYS');
    console.log('========================================');

    console.log('\nF1) Buscar tablas schedule/holidays (esperado: vacío):');
    const scheduleTablesQuery = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%holiday%' OR table_name ILIKE '%schedule%' OR table_name ILIKE '%work%' ORDER BY table_schema, table_name;");
    console.table(scheduleTablesQuery.rows);

    // Timeline Demo - usando el último usuario que hizo login
    console.log('\n========================================');
    console.log('DEMO: TIMELINE "QUÉ SE HIZO EN ESE TIEMPO"');
    console.log('========================================');

    const lastSession = await client.query('SELECT user_email, login_time, logout_time FROM user_sessions ORDER BY login_time DESC LIMIT 1;');
    if (lastSession.rows.length > 0) {
      const session = lastSession.rows[0];
      console.log(`\nÚltima sesión: ${session.user_email} - Login: ${session.login_time}`);

      // Timeline por ventana temporal (últimas 2 horas de actividad)
      const timelineQuery = await client.query(`
        SELECT id, creado_en, modulo, accion, descripcion, ip, user_agent, contexto
        FROM auditoria.logs
        WHERE usuario_email = $1
          AND creado_en >= $2
          AND creado_en <= COALESCE($3, $2 + interval '2 hours')
        ORDER BY creado_en ASC
        LIMIT 20;
      `, [session.user_email, session.login_time, session.logout_time]);

      console.log(`\nTimeline de actividad (${timelineQuery.rows.length} eventos):`);
      console.table(timelineQuery.rows);
    }

    console.log('\n✅ DB PROBE COMPLETED SUCCESSFULLY');

  } catch (err) {
    console.error('❌ DB PROBE ERROR:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await client.end();
  }
}

runOffHoursProbes();