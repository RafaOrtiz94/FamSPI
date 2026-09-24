--
-- Migration 155: BC Notification Queue with retry support
--
-- Replaces fire-and-forget setImmediate notifications with a persistent queue
-- that survives process restarts and retries on failure.
--

CREATE TABLE IF NOT EXISTS bc_notification_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_case_id UUID NOT NULL,
  user_id         INTEGER NOT NULL,
  template        VARCHAR(100) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  send_email      BOOLEAN NOT NULL DEFAULT true,
  send_chat       BOOLEAN NOT NULL DEFAULT false,
  priority        SMALLINT NOT NULL DEFAULT 2,
  source          VARCHAR(200),

  -- Retry state
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead')),
  attempts        SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 3,
  last_error      TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the queue processor (pick pending items due for retry)
CREATE INDEX IF NOT EXISTS idx_bcnq_pending
  ON bc_notification_queue (next_attempt_at, priority DESC)
  WHERE status IN ('pending', 'processing');

-- Index for querying by BC
CREATE INDEX IF NOT EXISTS idx_bcnq_business_case
  ON bc_notification_queue (business_case_id);

COMMENT ON TABLE bc_notification_queue IS
  'Persistent BC notification queue with retry (max 3 attempts, exponential backoff).';
