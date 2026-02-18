-- 102_notification_dispatch_queue.sql
-- Cola asincrona para despacho de notificaciones por email/chat

CREATE TABLE IF NOT EXISTS public.notification_dispatch_queue (
  id BIGSERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel VARCHAR(16) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_dispatch_queue_channel_check CHECK (channel IN ('email', 'chat')),
  CONSTRAINT notification_dispatch_queue_status_check CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  CONSTRAINT notification_dispatch_queue_attempts_check CHECK (attempts >= 0 AND max_attempts >= 1),
  UNIQUE (notification_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_queue_pending
  ON public.notification_dispatch_queue (status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_queue_notification
  ON public.notification_dispatch_queue (notification_id);

