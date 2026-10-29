CREATE TABLE IF NOT EXISTS notification_push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  subscription JSONB NOT NULL,
  user_agent TEXT NULL,
  device_label TEXT NULL,
  app_path TEXT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_push_subscriptions_endpoint
  ON notification_push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS idx_notification_push_subscriptions_user_active
  ON notification_push_subscriptions (user_id, disabled_at, updated_at DESC);
