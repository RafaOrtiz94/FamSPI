BEGIN;

-- 123_document_hashes_uploads.sql agrego content_hash_sha256/hash_algorithm a
-- applicant_documents, personnel_request_documents, collaborator_documents y
-- travel_allowance_documents, pero omitio request_attachments -- la tabla que
-- usan requests.service.js#saveAttachment y #addDriveAttachment (F.ST-20,
-- F.ST-21 y demas adjuntos de solicitudes), rompiendo el envio de solicitudes
-- con archivos adjuntos.
ALTER TABLE IF EXISTS request_attachments
  ADD COLUMN IF NOT EXISTS content_hash_sha256 VARCHAR(64);
ALTER TABLE IF EXISTS request_attachments
  ADD COLUMN IF NOT EXISTS hash_algorithm VARCHAR(20) DEFAULT 'SHA-256';

UPDATE request_attachments
SET hash_algorithm = 'SHA-256'
WHERE content_hash_sha256 IS NOT NULL
  AND (hash_algorithm IS NULL OR trim(hash_algorithm) = '');

COMMIT;
