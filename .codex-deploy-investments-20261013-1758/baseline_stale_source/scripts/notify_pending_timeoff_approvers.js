/**
 * Reenvia recordatorios de solicitudes pendientes de aprobacion
 * para permisos/vacaciones.
 *
 * Uso:
 *   node scripts/notify_pending_timeoff_approvers.js
 *   node scripts/notify_pending_timeoff_approvers.js --dry-run
 */

const db = require("../src/config/db");
const notificationManager = require("../src/modules/notifications/notificationManager");

const isDryRun = process.argv.includes("--dry-run");

async function notifyPendingPermisosVacaciones(summary) {
  const { rows } = await db.query(
    `
      SELECT pv.id, pv.tipo_solicitud, pv.tipo_permiso, pv.status,
             pv.user_id, pv.user_email, pv.user_fullname,
             pv.approver_user_id, pv.approver_email, pv.approver_role,
             pv.created_at
        FROM permisos_vacaciones pv
       WHERE pv.status IN ('pending', 'pending_final', 'partially_approved')
         AND pv.approver_user_id IS NOT NULL
       ORDER BY pv.created_at ASC
    `
  );

  summary.permisos_vacaciones_pending_found = rows.length;

  for (const row of rows) {
    if (isDryRun) {
      summary.permisos_vacaciones_notified += 1;
      continue;
    }

    try {
      await notificationManager.sendNotification({
        userId: row.approver_user_id,
        customTitle: "Solicitud pendiente de aprobaci\u00F3n",
        customMessage: `${row.user_fullname || row.user_email} tiene una solicitud de ${row.tipo_solicitud}${
          row.tipo_permiso ? ` (${row.tipo_permiso})` : ""
        } pendiente de tu decisi\u00F3n.`,
        type: "task",
        source: "permisos_vacaciones",
        priority: 2,
        email: true,
        meta: {
          solicitud_id: row.id,
          tipo_solicitud: row.tipo_solicitud,
          tipo_permiso: row.tipo_permiso || null,
          status: row.status,
          reminder_batch: true,
        },
      });
      summary.permisos_vacaciones_notified += 1;
    } catch (error) {
      summary.errors.push({
        scope: "permisos_vacaciones",
        solicitud_id: row.id,
        message: error.message,
      });
    }
  }
}

async function notifyPendingVacaciones(summary) {
  try {
    const { rows } = await db.query(
      `
        SELECT v.id, v.status, v.requester_id, v.approver_id, v.start_date, v.end_date, v.created_at,
               u.email AS requester_email,
               COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) AS requester_name
          FROM vacaciones_solicitudes v
          LEFT JOIN users u ON u.id = v.requester_id
         WHERE v.status = 'pendiente'
           AND v.approver_id IS NOT NULL
         ORDER BY v.created_at ASC
      `
    );

    summary.vacaciones_pending_found = rows.length;

    for (const row of rows) {
      if (isDryRun) {
        summary.vacaciones_notified += 1;
        continue;
      }

      try {
        await notificationManager.sendNotification({
          userId: row.approver_id,
          customTitle: "Solicitud de vacaciones pendiente",
          customMessage: `${row.requester_name || row.requester_email} tiene una solicitud de vacaciones pendiente de tu decisi\u00F3n.`,
          type: "task",
          source: "vacaciones",
          priority: 2,
          email: true,
          meta: {
            solicitud_id: row.id,
            status: row.status,
            requester_id: row.requester_id,
            reminder_batch: true,
          },
        });
        summary.vacaciones_notified += 1;
      } catch (error) {
        summary.errors.push({
          scope: "vacaciones_solicitudes",
          solicitud_id: row.id,
          message: error.message,
        });
      }
    }
  } catch (error) {
    summary.errors.push({
      scope: "vacaciones_solicitudes_query",
      message: error.message,
    });
  }
}

async function main() {
  const summary = {
    dry_run: isDryRun,
    permisos_vacaciones_pending_found: 0,
    permisos_vacaciones_notified: 0,
    vacaciones_pending_found: 0,
    vacaciones_notified: 0,
    errors: [],
  };

  try {
    await notifyPendingPermisosVacaciones(summary);
    await notifyPendingVacaciones(summary);
    console.log(JSON.stringify({ ok: true, summary }, null, 2));
    process.exitCode = 0;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      await db.pool.end();
    } catch (_) {
      // ignore close errors
    }
  }
}

main();
