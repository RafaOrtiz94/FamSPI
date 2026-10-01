/**
 * Job: Recordatorio de acciones (Blue Sheet) vencidas
 * ----------------------------------------------------
 * Ya penalizaban el health score de la oportunidad, pero no habia ningun
 * aviso proactivo -- el dueno de la tarea tenia que entrar al Blue Sheet
 * para enterarse de que estaba vencida. Notifica una vez al dueno via el
 * sistema interno de notificaciones (no email, para que quede consistente
 * con el resto de avisos del modulo CRM-Fam) y no vuelve a avisar hasta que
 * pase REMINDER_INTERVAL_HOURS -- evita spam si el job corre mas de una vez
 * al dia.
 *
 * Activacion: POST /internal-jobs/crm/action-items/overdue-reminder
 */

const db = require("../config/db");
const logger = require("../config/logger");
const notificationsService = require("../modules/notifications/notifications.service");

const REMINDER_INTERVAL_HOURS = 20;
const PRIORITY_MAP = { urgent: 2, high: 1, medium: 0, low: 0 };

async function runOnce() {
  logger.info("[JOBS][CRM_ACTION_ITEM_REMINDER] Iniciando recordatorios de acciones vencidas");

  const { rows } = await db.query(
    `SELECT ai.id, ai.title, ai.priority, ai.due_date, ai.owner_user_id,
            o.id AS opportunity_id, o.name AS opportunity_name
       FROM crm.crm_action_items ai
       LEFT JOIN crm.crm_opportunities o ON o.id = ai.opportunity_id
      WHERE ai.deleted_at IS NULL
        AND ai.status IN ('pending', 'in_progress')
        AND ai.due_date IS NOT NULL
        AND ai.due_date < CURRENT_DATE
        AND ai.owner_user_id IS NOT NULL
        AND (ai.reminder_sent_at IS NULL OR ai.reminder_sent_at < now() - make_interval(hours => $1))
      ORDER BY ai.due_date ASC`,
    [REMINDER_INTERVAL_HOURS],
  );

  let sent = 0;
  let failed = 0;

  for (const item of rows) {
    try {
      await notificationsService.createNotification({
        user_id: item.owner_user_id,
        title: "Tarea de Blue Sheet vencida",
        message: `"${item.title}"${item.opportunity_name ? ` — ${item.opportunity_name}` : ""} venció el ${new Date(item.due_date).toLocaleDateString("es-EC")}`,
        type: "warning",
        source: "crm-fam",
        status: "unread",
        priority: PRIORITY_MAP[item.priority] ?? 0,
        meta: { action_item_id: item.id, opportunity_id: item.opportunity_id },
      });
      await db.query(`UPDATE crm.crm_action_items SET reminder_sent_at = now() WHERE id = $1`, [item.id]);
      sent += 1;
    } catch (e) {
      failed += 1;
      logger.error({ error: e?.message, actionItemId: item.id }, "[JOBS][CRM_ACTION_ITEM_REMINDER] Error notificando");
    }
  }

  const result = { scanned: rows.length, sent, failed };
  logger.info(result, "[JOBS][CRM_ACTION_ITEM_REMINDER] Finalizado");
  return result;
}

module.exports = { runOnce };
