-- Liquidacion mensual por kilometraje para salidas operacionales.
-- Las facturas excluidas se conservan como evidencia y para trazabilidad tributaria.

ALTER TABLE travel_allowance_invoices
  ADD COLUMN IF NOT EXISTS excluded_from_km_settlement BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS km_settlement_exclusion_reason TEXT,
  ADD COLUMN IF NOT EXISTS km_settlement_id BIGINT;

ALTER TABLE travel_allowances
  ADD COLUMN IF NOT EXISTS km_reimbursement_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS excluded_km_expense_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS travel_allowance_km_settlements (
  id BIGSERIAL PRIMARY KEY,
  period_start DATE NOT NULL UNIQUE,
  rate_per_km NUMERIC(12,4) NOT NULL CHECK (rate_per_km >= 0),
  total_km NUMERIC(12,2) NOT NULL DEFAULT 0,
  reimbursement_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  excluded_expense_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowance_count INTEGER NOT NULL DEFAULT 0,
  applied_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS travel_allowance_km_settlement_items (
  id BIGSERIAL PRIMARY KEY,
  settlement_id BIGINT NOT NULL REFERENCES travel_allowance_km_settlements(id) ON DELETE CASCADE,
  allowance_id BIGINT NOT NULL UNIQUE REFERENCES travel_allowances(id) ON DELETE RESTRICT,
  distance_km NUMERIC(12,2) NOT NULL DEFAULT 0,
  rate_per_km NUMERIC(12,4) NOT NULL,
  reimbursement_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  excluded_expense_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE travel_allowance_invoices
  DROP CONSTRAINT IF EXISTS travel_allowance_invoices_km_settlement_id_fkey;
ALTER TABLE travel_allowance_invoices
  ADD CONSTRAINT travel_allowance_invoices_km_settlement_id_fkey
  FOREIGN KEY (km_settlement_id)
  REFERENCES travel_allowance_km_settlements(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_travel_allowances_operational_month
  ON travel_allowances(source_type, visit_date)
  WHERE source_type = 'operational_exit';
CREATE INDEX IF NOT EXISTS idx_travel_allowance_invoices_km_excluded
  ON travel_allowance_invoices(allowance_id, category)
  WHERE excluded_from_km_settlement = TRUE;

ALTER TABLE travel_allowance_provider_catalog
  DROP CONSTRAINT IF EXISTS travel_allowance_provider_catalog_category_check;
ALTER TABLE travel_allowance_provider_catalog
  ADD CONSTRAINT travel_allowance_provider_catalog_category_check
  CHECK (category IN ('alimentacion', 'combustible', 'peaje', 'hospedaje', 'transporte', 'movilidad', 'materiales'));
