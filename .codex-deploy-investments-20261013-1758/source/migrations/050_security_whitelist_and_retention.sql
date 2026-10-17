-- backend/migrations/050_security_whitelist_and_retention.sql

-- Whitelist table for off-hours login exceptions
CREATE TABLE IF NOT EXISTS security_offhours_whitelist (
  id SERIAL PRIMARY KEY,
  actor_email TEXT NOT NULL,
  reason TEXT NULL,
  ip_cidr TEXT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  created_by INTEGER NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast whitelist lookups
CREATE INDEX IF NOT EXISTS idx_security_whitelist_actor_enabled
ON security_offhours_whitelist (actor_email, enabled);

-- Index for IP-based whitelisting (if used)
CREATE INDEX IF NOT EXISTS idx_security_whitelist_ip_cidr
ON security_offhours_whitelist (ip_cidr)
WHERE ip_cidr IS NOT NULL;

-- Jobs log table for retention and other security operations
CREATE TABLE IF NOT EXISTS security_jobs_log (
  id SERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for job history queries
CREATE INDEX IF NOT EXISTS idx_security_jobs_log_name_time
ON security_jobs_log (job_name, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE security_offhours_whitelist IS 'Whitelist for off-hours login exceptions';
COMMENT ON TABLE security_jobs_log IS 'Log of security maintenance jobs (retention, etc.)';
COMMENT ON INDEX idx_security_whitelist_actor_enabled IS 'Fast lookup for whitelist matching by email';
COMMENT ON INDEX idx_security_jobs_log_name_time IS 'Performance index for job history queries';