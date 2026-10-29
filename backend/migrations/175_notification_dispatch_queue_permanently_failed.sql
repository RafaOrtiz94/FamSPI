-- 175_notification_dispatch_queue_permanently_failed.sql
-- Agrega estado permanently_failed al constraint de status en notification_dispatch_queue.
-- Permite distinguir jobs que agotaron todos los reintentos de los que fallaron pero aun tienen intentos.

ALTER TABLE public.notification_dispatch_queue
  DROP CONSTRAINT IF EXISTS notification_dispatch_queue_status_check;

ALTER TABLE public.notification_dispatch_queue
  ADD CONSTRAINT notification_dispatch_queue_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'permanently_failed'));

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_queue_permanently_failed
  ON public.notification_dispatch_queue (status, created_at DESC)
  WHERE status = 'permanently_failed';
