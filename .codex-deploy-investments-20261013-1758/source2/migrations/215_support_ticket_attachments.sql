-- Migration: 215_support_ticket_attachments.sql
-- Purpose: agregar evidencia fotografica opcional a tickets de soporte TI

CREATE TABLE IF NOT EXISTS support_ticket_attachments (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  drive_file_id TEXT,
  drive_url TEXT,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes INTEGER,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_ticket_attachments_ticket_unique
  ON support_ticket_attachments(ticket_id);

CREATE INDEX IF NOT EXISTS idx_support_ticket_attachments_uploaded_by
  ON support_ticket_attachments(uploaded_by);

COMMENT ON TABLE support_ticket_attachments IS 'Evidencia fotografica opcional asociada a tickets de soporte TI.';
