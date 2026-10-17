-- 113_notification_process_email_threads.sql
-- Hilo de correo por proceso para mantener trazabilidad en una misma conversacion

CREATE TABLE IF NOT EXISTS public.notification_process_email_threads (
  process_key TEXT PRIMARY KEY,
  provider VARCHAR(32) NOT NULL DEFAULT 'gmail',
  thread_id TEXT NOT NULL,
  root_subject TEXT,
  last_subject TEXT,
  last_provider_message_id TEXT,
  last_notification_id INTEGER REFERENCES public.notifications(id) ON DELETE SET NULL,
  first_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_process_email_threads_last_sent
  ON public.notification_process_email_threads (last_sent_at DESC);
