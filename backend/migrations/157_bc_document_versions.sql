--
-- Migration 157: BC Document Version History
--
-- Tracks all generated documents (Google Sheets + Excel fallback) per BC.
-- Existing sheet_generation_jobs only tracks the latest state.
-- This table keeps a complete immutable history.
--

CREATE TABLE IF NOT EXISTS bc_document_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_case_id UUID NOT NULL,
  version_number   SMALLINT NOT NULL,                    -- Auto-incremented per BC
  document_type    VARCHAR(30) NOT NULL DEFAULT 'sheets' -- 'sheets' | 'excel_fallback'
                     CHECK (document_type IN ('sheets', 'excel_fallback')),
  document_url     TEXT,                                 -- Google Sheets URL or null for local
  sheet_id         TEXT,                                 -- Google Sheets ID if applicable
  file_name        TEXT,                                 -- For Excel fallback files
  canonical_state  VARCHAR(50),                          -- BC state at generation time
  generated_by     INTEGER REFERENCES users(id),
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata         JSONB DEFAULT '{}',
  is_current       BOOLEAN NOT NULL DEFAULT true         -- Only latest = true
);

-- Partial unique index: only one current document per BC
CREATE UNIQUE INDEX IF NOT EXISTS idx_bcdv_current
  ON bc_document_versions (business_case_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_bcdv_bc_history
  ON bc_document_versions (business_case_id, generated_at DESC);

-- Function to insert a new version and demote previous
CREATE OR REPLACE FUNCTION insert_bc_document_version(
  p_business_case_id UUID,
  p_document_type    VARCHAR,
  p_document_url     TEXT,
  p_sheet_id         TEXT,
  p_file_name        TEXT,
  p_canonical_state  VARCHAR,
  p_generated_by     INTEGER,
  p_metadata         JSONB
) RETURNS bc_document_versions AS $$
DECLARE
  v_next_version SMALLINT;
  v_result       bc_document_versions;
BEGIN
  -- Demote all previous versions
  UPDATE bc_document_versions
  SET is_current = false
  WHERE business_case_id = p_business_case_id;

  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_next_version
  FROM bc_document_versions
  WHERE business_case_id = p_business_case_id;

  -- Insert new version
  INSERT INTO bc_document_versions (
    business_case_id, version_number, document_type, document_url,
    sheet_id, file_name, canonical_state, generated_by, metadata
  ) VALUES (
    p_business_case_id, v_next_version, p_document_type, p_document_url,
    p_sheet_id, p_file_name, p_canonical_state, p_generated_by, p_metadata
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE bc_document_versions IS
  'Immutable history of all BC documents (Sheets + Excel). Replaces overwrite pattern.';
