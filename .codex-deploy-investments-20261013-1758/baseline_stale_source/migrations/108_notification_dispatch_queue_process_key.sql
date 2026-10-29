-- 108_notification_dispatch_queue_process_key.sql
-- Cola de notificaciones por proceso (orden secuencial por process_key)

ALTER TABLE public.notification_dispatch_queue
  ADD COLUMN IF NOT EXISTS process_key TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_queue_process_key
  ON public.notification_dispatch_queue (process_key, id);

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_queue_process_pending
  ON public.notification_dispatch_queue (process_key, status, next_retry_at, id);
