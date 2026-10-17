-- Signature dashboard view using existing tables (no schema changes)
-- Usage: psql -d <database> -f signature_dashboard_view.sql

CREATE OR REPLACE VIEW signature_dashboard AS
WITH per_document AS (
    SELECT
        d.id,
        d.signature_status,
        d.is_locked,
        d.created_at,
        MIN(dsa.signed_at) AS first_signed_at
    FROM documents d
    LEFT JOIN document_signatures_advanced dsa ON dsa.document_id = d.id
    GROUP BY d.id, d.signature_status, d.is_locked, d.created_at
)
SELECT
    COUNT(*) AS total_documents,
    COUNT(*) FILTER (WHERE signature_status = 'signed') AS signed_documents,
    COUNT(*) FILTER (WHERE is_locked IS TRUE) AS locked_documents,
    AVG(EXTRACT(EPOCH FROM (first_signed_at - created_at)) / 3600.0) AS avg_signing_time_hours
FROM per_document;
