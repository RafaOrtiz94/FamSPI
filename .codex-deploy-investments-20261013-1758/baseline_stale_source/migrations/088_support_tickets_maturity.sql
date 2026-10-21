-- Migration: 088_support_tickets_maturity.sql
-- Description: Maturity layer for support system (SLA, lifecycle, comments, requester closure, CSAT)
-- Date: 2026-02-12

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS impact VARCHAR(10) NOT NULL DEFAULT 'medio' CHECK (impact IN ('bajo', 'medio', 'alto')),
  ADD COLUMN IF NOT EXISTS urgency VARCHAR(10) NOT NULL DEFAULT 'medio' CHECK (urgency IN ('bajo', 'medio', 'alto')),
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100),
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_response_breached BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sla_resolution_breached BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS on_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS reopened_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by_requester BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS satisfaction_score SMALLINT CHECK (satisfaction_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS satisfaction_comment TEXT;

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('abierto', 'triage', 'en_progreso', 'en_espera', 'resuelto', 'cerrado', 'reabierto'));

CREATE INDEX IF NOT EXISTS idx_support_tickets_response_due ON support_tickets(first_response_due_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_resolution_due ON support_tickets(resolution_due_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla_response_breached ON support_tickets(sla_response_breached);
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla_resolution_breached ON support_tickets(sla_resolution_breached);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);

CREATE TABLE IF NOT EXISTS support_ticket_comments (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  visibility VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_comments_ticket ON support_ticket_comments(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_comments_visibility ON support_ticket_comments(visibility);

COMMENT ON COLUMN support_tickets.first_response_due_at IS 'SLA deadline for first response by TI.';
COMMENT ON COLUMN support_tickets.resolution_due_at IS 'SLA deadline for ticket resolution.';
COMMENT ON TABLE support_ticket_comments IS 'Thread of comments between requester and TI. Internal comments visible only to TI.';
