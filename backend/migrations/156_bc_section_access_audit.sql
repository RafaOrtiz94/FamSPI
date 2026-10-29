--
-- Migration 156: BC Section Access Audit Log
--
-- Tracks read access to sensitive sections (prices, investments) per user.
--

CREATE TABLE IF NOT EXISTS bc_section_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_case_id UUID NOT NULL,
  user_id         INTEGER NOT NULL,
  user_role       VARCHAR(80),
  section         VARCHAR(80) NOT NULL,
  access_type     VARCHAR(20) NOT NULL DEFAULT 'read'
                    CHECK (access_type IN ('read', 'write')),
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      INET,
  user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS idx_bcsal_bc_section
  ON bc_section_access_log (business_case_id, section, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_bcsal_user
  ON bc_section_access_log (user_id, accessed_at DESC);

-- Partial index — only sensitive sections
CREATE INDEX IF NOT EXISTS idx_bcsal_sensitive
  ON bc_section_access_log (section, accessed_at DESC)
  WHERE section IN ('prices', 'investments');

COMMENT ON TABLE bc_section_access_log IS
  'Audit log of user access to sensitive BC sections (prices, investments).';
