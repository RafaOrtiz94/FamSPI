CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE external_world_cup_2026.prediction_entries
  ADD COLUMN IF NOT EXISTS participant_token UUID,
  ADD COLUMN IF NOT EXISTS identity_document TEXT,
  ADD COLUMN IF NOT EXISTS identity_document_normalized TEXT;

UPDATE external_world_cup_2026.prediction_entries
SET participant_token = gen_random_uuid()
WHERE participant_token IS NULL;

UPDATE external_world_cup_2026.prediction_entries
SET identity_document = COALESCE(NULLIF(identity_document, ''), 'LEGACY-' || id::text),
    identity_document_normalized = COALESCE(NULLIF(identity_document_normalized, ''), 'LEGACY-' || id::text)
WHERE identity_document IS NULL
   OR identity_document_normalized IS NULL
   OR identity_document = ''
   OR identity_document_normalized = '';

ALTER TABLE external_world_cup_2026.prediction_entries
  ALTER COLUMN participant_token SET NOT NULL,
  ALTER COLUMN identity_document SET NOT NULL,
  ALTER COLUMN identity_document_normalized SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wc2026_prediction_entries_participant_token
  ON external_world_cup_2026.prediction_entries (participant_token);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wc2026_prediction_entries_identity_document
  ON external_world_cup_2026.prediction_entries (identity_document_normalized);
