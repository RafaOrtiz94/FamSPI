-- 303_crm_action_items_reminders.sql
-- CRM-Fam / Blue Sheet: soporte para recordatorios de action items vencidos
-- (plan Senior de Blue Sheet). Sin esta columna, un job de recordatorios
-- notificaria la misma tarea vencida en cada corrida -- reminder_sent_at
-- marca la ultima vez que se aviso, para notificar una sola vez por dia (o
-- el intervalo que defina el scheduler) en vez de spamear.

ALTER TABLE crm.crm_action_items
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_crm_action_items_due_pending
  ON crm.crm_action_items (due_date)
  WHERE deleted_at IS NULL AND status IN ('pending', 'in_progress');
