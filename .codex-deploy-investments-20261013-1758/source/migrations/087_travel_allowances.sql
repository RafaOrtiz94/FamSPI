-- Migration: 087_travel_allowances.sql
-- Description: Viaticos para visitas comerciales (clientes/prospectos)
-- Date: 2026-02-12

CREATE TABLE IF NOT EXISTS travel_allowances (
  id BIGSERIAL PRIMARY KEY,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('client_visit', 'prospect_visit')),
  source_id BIGINT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL,
  city TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  finance_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_travel_allowances_status ON travel_allowances(status);
CREATE INDEX IF NOT EXISTS idx_travel_allowances_visit_date ON travel_allowances(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_travel_allowances_requester ON travel_allowances(requester_email);

COMMENT ON TABLE travel_allowances IS 'Gestion de viaticos para visitas de asesores comerciales.';

