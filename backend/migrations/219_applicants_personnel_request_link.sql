-- Migration 219: Vincular aspirantes con su expediente de solicitud de personal
-- Agrega FK nullable de applicants → personnel_requests
-- El script create_expedientes_from_applicants.js puebla este campo.

BEGIN;

ALTER TABLE applicants
  ADD COLUMN IF NOT EXISTS personnel_request_id INTEGER
    REFERENCES personnel_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applicants_personnel_request_id
  ON applicants(personnel_request_id);

COMMIT;
