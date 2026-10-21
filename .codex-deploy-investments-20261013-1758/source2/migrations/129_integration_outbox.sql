-- 129_integration_outbox.sql
-- REQ-SPI-012 + INT-ODOO-002 + INT-ODOO-003
-- Outbox desacoplada para eventos de integracion SPI -> Odoo.

CREATE TABLE IF NOT EXISTS public.integration_outbox (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.integration_outbox
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'integration_outbox_idempotency_unique'
  ) THEN
    ALTER TABLE public.integration_outbox
      ADD CONSTRAINT integration_outbox_idempotency_unique
      UNIQUE (idempotency_key);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'integration_outbox_status_check'
  ) THEN
    ALTER TABLE public.integration_outbox
      ADD CONSTRAINT integration_outbox_status_check
      CHECK (
        status IN ('pending', 'processing', 'sent', 'failed', 'dead', 'skipped')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'integration_outbox_attempt_count_check'
  ) THEN
    ALTER TABLE public.integration_outbox
      ADD CONSTRAINT integration_outbox_attempt_count_check
      CHECK (attempt_count >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_integration_outbox_status_created
  ON public.integration_outbox (status, created_at, id);

CREATE INDEX IF NOT EXISTS idx_integration_outbox_correlation
  ON public.integration_outbox (correlation_id);

CREATE INDEX IF NOT EXISTS idx_integration_outbox_event_type
  ON public.integration_outbox (event_type, created_at DESC);

COMMENT ON TABLE public.integration_outbox IS
  'Outbox transaccional para publicar eventos de integracion SPI hacia Odoo.';

