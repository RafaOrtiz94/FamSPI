BEGIN;

ALTER TABLE IF EXISTS applicant_documents
  ADD COLUMN IF NOT EXISTS content_hash_sha256 VARCHAR(64);
ALTER TABLE IF EXISTS applicant_documents
  ADD COLUMN IF NOT EXISTS hash_algorithm VARCHAR(20) DEFAULT 'SHA-256';

ALTER TABLE IF EXISTS personnel_request_documents
  ADD COLUMN IF NOT EXISTS content_hash_sha256 VARCHAR(64);
ALTER TABLE IF EXISTS personnel_request_documents
  ADD COLUMN IF NOT EXISTS hash_algorithm VARCHAR(20) DEFAULT 'SHA-256';

ALTER TABLE IF EXISTS collaborator_documents
  ADD COLUMN IF NOT EXISTS content_hash_sha256 VARCHAR(64);
ALTER TABLE IF EXISTS collaborator_documents
  ADD COLUMN IF NOT EXISTS hash_algorithm VARCHAR(20) DEFAULT 'SHA-256';

ALTER TABLE IF EXISTS travel_allowance_documents
  ADD COLUMN IF NOT EXISTS content_hash_sha256 VARCHAR(64);
ALTER TABLE IF EXISTS travel_allowance_documents
  ADD COLUMN IF NOT EXISTS hash_algorithm VARCHAR(20) DEFAULT 'SHA-256';

UPDATE applicant_documents
SET hash_algorithm = 'SHA-256'
WHERE content_hash_sha256 IS NOT NULL
  AND (hash_algorithm IS NULL OR trim(hash_algorithm) = '');

UPDATE personnel_request_documents
SET hash_algorithm = 'SHA-256'
WHERE content_hash_sha256 IS NOT NULL
  AND (hash_algorithm IS NULL OR trim(hash_algorithm) = '');

UPDATE collaborator_documents
SET hash_algorithm = 'SHA-256'
WHERE content_hash_sha256 IS NOT NULL
  AND (hash_algorithm IS NULL OR trim(hash_algorithm) = '');

UPDATE travel_allowance_documents
SET hash_algorithm = 'SHA-256'
WHERE content_hash_sha256 IS NOT NULL
  AND (hash_algorithm IS NULL OR trim(hash_algorithm) = '');

COMMIT;
