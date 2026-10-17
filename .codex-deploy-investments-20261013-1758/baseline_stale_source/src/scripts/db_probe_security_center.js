#!/usr/bin/env node

/**
 * DB PROBE: Security Center Off-hours Login Analysis
 * Uses the SAME DB config as the backend application
 */

const db = require('../config/db');
const logger = require('../config/logger');

// Helper to check if column exists
async function hasColumn(schema, table, column) {
  try {
    const result = await db.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
    `, [schema, table, column]);
    return result.rows.length > 0;
  } catch (err) {
    return false;
  }
}

async function runSecurityCenterProbes() {
  const gaps = [];
  const summary = {
    tables: {},
    columns: {},
    risks: []
  };

  try {
    console.log('🔍 DB PROBE: Security Center Off-hours Login Analysis\n');
    console.log('⏰ Timestamp:', new Date().toISOString(), '\n');

    // A) Roles y TI recipients
    console.log('========================================');
    console.log('A) ROLES REALES Y TI RECIPIENTS');
    console.log('========================================');

    try {
      console.log('\nA1) Roles existentes en users:');
      const rolesQuery = await db.query('SELECT role, COUNT(*) AS total FROM users GROUP BY role ORDER BY total DESC;');
      console.table(rolesQuery.rows);
      summary.tables.users = { roles: rolesQuery.rows };
    } catch (err) {
      console.error('❌ Error en A1:', err.message);
      gaps.push('No se puede consultar roles de users');
    }

    try {
      console.log('\nA2) Confirmar si existe columna active en users:');
      const hasActive = await hasColumn('public', 'users', 'active');
      console.log('Columna active existe:', hasActive ? '✅ SÍ' : '❌ NO');

      console.log('\nA2) Usuarios TI (destinatarios reales):');
      const tiUsersQuery = await db.query("SELECT id, email, fullname, role FROM users WHERE role = 'ti' ORDER BY id;");
      console.table(tiUsersQuery.rows);

      if (tiUsersQuery.rows.length === 0) {
        gaps.push('NO hay usuarios con role=ti (necesario para Security Center)');
        summary.risks.push('Sin usuarios TI - Security Center no funcionará');
      }
    } catch (err) {
      console.error('❌ Error en A2:', err.message);
      gaps.push('No se puede consultar usuarios TI');
    }

    try {
      console.log('\nA3) Confirmar roles jefe_ti/jefe_de_ti:');
      const jefeTiQuery = await db.query("SELECT id, email, fullname, role FROM users WHERE role IN ('jefe_ti', 'jefe_de_ti') ORDER BY role, id;");
      console.table(jefeTiQuery.rows);
    } catch (err) {
      console.error('❌ Error en A3:', err.message);
    }

    try {
      console.log('\nA4) Roles parecidos a TI (diagnóstico):');
      const similarTiQuery = await db.query("SELECT id, email, fullname, role FROM users WHERE role ILIKE '%ti%' ORDER BY id;");
      console.table(similarTiQuery.rows);
    } catch (err) {
      console.error('❌ Error en A4:', err.message);
    }

    // B) Esquema auditoría real
    console.log('\n========================================');
    console.log('B) ESQUEMA AUDITORÍA REAL');
    console.log('========================================');

    try {
      console.log('\nB1) Columnas auditoria.logs:');
      const auditColsQuery = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'auditoria' AND table_name = 'logs' ORDER BY ordinal_position;");
      console.table(auditColsQuery.rows);
      summary.columns.auditoria_logs = auditColsQuery.rows;
    } catch (err) {
      console.error('❌ Error en B1:', err.message);
      gaps.push('No se puede consultar esquema auditoria.logs');
    }

    // C) Últimos eventos auth / security y evidencia de contexto
    console.log('\n========================================');
    console.log('C) ÚLTIMOS EVENTOS AUTH/SECURITY');
    console.log('========================================');

    try {
      console.log('\nC0) Auditoría general (¿por qué auth está vacío?):');
      const totalLogsQuery = await db.query('SELECT COUNT(*) AS total_logs FROM auditoria.logs;');
      console.log('Total logs en auditoria:', totalLogsQuery.rows[0].total_logs);

      if (parseInt(totalLogsQuery.rows[0].total_logs) === 0) {
        console.log('❌ Auditoría VACÍA en sandbox - ningún evento registrado');
        gaps.push('Auditoría completamente vacía - ningún evento registrado');
        summary.risks.push('Sistema de auditoría no registra eventos');
      } else {
        const modulesQuery = await db.query("SELECT modulo, COUNT(*) AS total FROM auditoria.logs GROUP BY modulo ORDER BY total DESC;");
        console.table(modulesQuery.rows);

        const actionsQuery = await db.query("SELECT accion, COUNT(*) AS total FROM auditoria.logs GROUP BY accion ORDER BY total DESC LIMIT 30;");
        console.table(actionsQuery.rows);

        const recentLogsQuery = await db.query("SELECT id, creado_en, modulo, accion, descripcion, usuario_email, ip FROM auditoria.logs ORDER BY creado_en DESC LIMIT 20;");
        console.table(recentLogsQuery.rows);
      }
    } catch (err) {
      console.error('❌ Error en C0:', err.message);
      gaps.push('No se puede consultar auditoría general');
    }

    try {
      console.log('\nC1) Últimos 50 logs auth (todos):');
      const hasContexto = await hasColumn('auditoria', 'logs', 'contexto');
      let selectFields = 'id, creado_en, usuario_email, rol, modulo, accion, descripcion, ip, user_agent, datos_nuevos, datos_anteriores';

      if (hasContexto) {
        selectFields += ', contexto';
        console.log('✅ Columna contexto existe - incluyendo en query');
      } else {
        console.log('❌ Columna contexto NO existe - usando datos_nuevos/datos_anteriores');
        gaps.push('Columna contexto no existe en auditoria.logs');
      }

      const authLogsQuery = await db.query(`SELECT ${selectFields} FROM auditoria.logs WHERE modulo = 'auth' ORDER BY creado_en DESC LIMIT 50;`);
      console.table(authLogsQuery.rows);
      summary.tables.auditoria_logs = { auth_logs: authLogsQuery.rows };
    } catch (err) {
      console.error('❌ Error en C1:', err.message);
      gaps.push('No se puede consultar logs auth');
    }

    try {
      console.log('\nC2) Eventos específicos off-hours (usando datos_nuevos):');
      const offHoursLogsQuery = await db.query(`
        SELECT id, creado_en, usuario_email, accion, descripcion, ip, user_agent, datos_nuevos
        FROM auditoria.logs
        WHERE modulo = 'auth'
          AND (
            accion ILIKE '%off%'
            OR descripcion ILIKE '%fuera de horario%'
            OR datos_nuevos::text ILIKE '%off_hours%'
            OR datos_nuevos::text ILIKE '%weekend%'
            OR datos_nuevos::text ILIKE '%holiday%'
          )
        ORDER BY creado_en DESC LIMIT 50;
      `);
      console.table(offHoursLogsQuery.rows);

      if (offHoursLogsQuery.rows.length === 0) {
        gaps.push('NO hay eventos off-hours registrados en DB');
        summary.risks.push('Sistema off-hours nunca ha detectado logins fuera de horario');
      }
    } catch (err) {
      console.error('❌ Error en C2:', err.message);
      gaps.push('No se puede buscar eventos off-hours');
    }

    // D) Notificaciones reales security/auth
    console.log('\n========================================');
    console.log('D) NOTIFICACIONES SECURITY/AUTH');
    console.log('========================================');

    try {
      console.log('\nD1) Verificar si existe tabla notifications:');
      const notifTableExists = await db.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'notifications'
      `);
      console.log('Tabla notifications existe:', notifTableExists.rows.length > 0 ? '✅ SÍ' : '❌ NO');

      if (notifTableExists.rows.length > 0) {
        console.log('\nD1) Columnas notifications:');
        const notifColsQuery = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notifications' ORDER BY ordinal_position;");
        console.table(notifColsQuery.rows);

        console.log('\nD2) Últimas 50 notificaciones security/auth:');
        const securityNotifQuery = await db.query("SELECT id, user_id, title, type, source, status, priority, created_at, meta FROM notifications WHERE type = 'security' OR source = 'auth' ORDER BY created_at DESC LIMIT 50;");
        console.table(securityNotifQuery.rows);
        summary.tables.notifications = { security_notifications: securityNotifQuery.rows };
      } else {
        gaps.push('Tabla notifications NO existe');
        summary.risks.push('Sin tabla notifications - no hay sistema de alertas');
      }
    } catch (err) {
      console.error('❌ Error en D:', err.message);
      gaps.push('No se puede consultar notifications');
    }

    // E) Sesiones reales para correlación
    console.log('\n========================================');
    console.log('E) SESIONES PARA CORRELACIÓN');
    console.log('========================================');

    try {
      console.log('\nE1) Verificar si existe tabla user_sessions:');
      const sessionsTableExists = await db.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'user_sessions'
      `);
      console.log('Tabla user_sessions existe:', sessionsTableExists.rows.length > 0 ? '✅ SÍ' : '❌ NO');

      if (sessionsTableExists.rows.length > 0) {
        console.log('\nE1) Columnas user_sessions:');
        const sessionsColsQuery = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_sessions' ORDER BY ordinal_position;");
        console.table(sessionsColsQuery.rows);

        console.log('\nE2) Últimas 20 sesiones:');
        const sessionsQuery = await db.query('SELECT id, user_email, ip, user_agent, login_time, logout_time FROM user_sessions ORDER BY login_time DESC LIMIT 20;');
        console.table(sessionsQuery.rows);
        summary.tables.user_sessions = { sessions: sessionsQuery.rows };
      } else {
        gaps.push('Tabla user_sessions NO existe');
        summary.risks.push('Sin tabla user_sessions - timeline por correlación temporal será limitado');
      }
    } catch (err) {
      console.error('❌ Error en E:', err.message);
      gaps.push('No se puede consultar user_sessions');
    }

    // F) Correlation_id existence check
    console.log('\n========================================');
    console.log('F) CORRELATION_ID EXISTENCE CHECK');
    console.log('========================================');

    try {
      console.log('\nF1) Buscar columna correlation_id en auditoria.logs:');
      const correlationColQuery = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'auditoria' AND table_name = 'logs' AND column_name ILIKE '%correlation%';");
      console.table(correlationColQuery.rows);

      if (correlationColQuery.rows.length === 0) {
        console.log('\nF2) Buscar correlation_id en datos_nuevos JSONB:');
        const correlationJsonQuery = await db.query(`
          SELECT id, created_en, usuario_email, datos_nuevos
          FROM auditoria.logs
          WHERE datos_nuevos::text ILIKE '%correlation_id%'
          ORDER BY created_en DESC LIMIT 20;
        `);
        console.table(correlationJsonQuery.rows);

        if (correlationJsonQuery.rows.length === 0) {
          gaps.push('NO existe correlation_id en ninguna forma');
          summary.risks.push('Sin correlation_id - timeline limitado a ventana temporal');
        }
      }
    } catch (err) {
      console.error('❌ Error en F:', err.message);
      gaps.push('No se puede verificar correlation_id');
    }

    // G) Tablas schedule/holidays
    console.log('\n========================================');
    console.log('G) TABLAS SCHEDULE/HOLIDAYS');
    console.log('========================================');

    console.log('\nG1) Buscar tablas schedule/holidays (esperado: vacío):');
    const scheduleTablesQuery = await db.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%holiday%' OR table_name ILIKE '%schedule%' OR table_name ILIKE '%work%' ORDER BY table_schema, table_name;");
    console.table(scheduleTablesQuery.rows);

    // Timeline Demo
    console.log('\n========================================');
    console.log('TIMELINE DEMO: QUÉ SE HIZO EN ESE TIEMPO');
    console.log('========================================');

    const lastSession = await db.query('SELECT user_email, login_time, logout_time FROM user_sessions ORDER BY login_time DESC LIMIT 1;');
    if (lastSession.rows.length > 0) {
      const session = lastSession.rows[0];
      console.log(`\nÚltima sesión: ${session.user_email} - Login: ${session.login_time}`);

      // Timeline por ventana temporal
      const timelineQuery = await db.query(`
        SELECT id, created_en, modulo, accion, descripcion, ip, user_agent, contexto
        FROM auditoria.logs
        WHERE usuario_email = $1
          AND created_en >= $2
          AND created_en <= COALESCE($3, $2 + interval '2 hours')
        ORDER BY created_en ASC
        LIMIT 20;
      `, [session.user_email, session.login_time, session.logout_time]);

      console.log(`\nTimeline de actividad (${timelineQuery.rows.length} eventos):`);
      console.table(timelineQuery.rows);
    }

    console.log('\n✅ DB PROBE SECURITY CENTER COMPLETED SUCCESSFULLY');

  } catch (err) {
    console.error('❌ DB PROBE ERROR:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

// Run the probe
runSecurityCenterProbes().then(() => {
  console.log('\n🏁 Probe execution finished');
  process.exit(0);
}).catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});