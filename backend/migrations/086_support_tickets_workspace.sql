-- Migration: 086_support_tickets_workspace.sql
-- Description: Ticketing workspace for help requests (failures, implementations, requirements, problems)
-- Date: 2026-02-12

CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(24) UNIQUE,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_ti_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ticket_type VARCHAR(20) NOT NULL CHECK (ticket_type IN ('fallo', 'implementacion', 'requerimiento', 'problema')),
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta', 'critica')),
  status VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'en_progreso', 'resuelto', 'cerrado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_requester_id ON support_tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_ti ON support_tickets(assigned_ti_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_type ON support_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_events (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(30) NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket_id ON support_ticket_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_events_created_at ON support_ticket_events(created_at DESC);

COMMENT ON TABLE support_tickets IS 'Mesa de ayuda SPI para tickets de fallos, requerimientos, implementaciones y problemas.';
COMMENT ON TABLE support_ticket_events IS 'Historial de acciones y cambios de estado de tickets de soporte.';

