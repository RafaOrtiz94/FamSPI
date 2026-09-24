-- Migration 227: Tabla de anticipos para viáticos
-- Permite que colaboradores soliciten un anticipo antes del viaje
-- y lo liquiden contra las facturas presentadas después

CREATE TABLE IF NOT EXISTS viatico_anticipos (
  id                     SERIAL PRIMARY KEY,
  allowance_id           INTEGER NOT NULL REFERENCES travel_allowances(id) ON DELETE CASCADE,
  requested_by_user_id   INTEGER REFERENCES users(id),
  amount                 NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency               VARCHAR(10) NOT NULL DEFAULT 'USD',
  purpose                TEXT,
  status                 VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
  -- pending_approval | approved | disbursed | applied | rejected
  approved_by_user_id    INTEGER REFERENCES users(id),
  approved_at            TIMESTAMPTZ,
  disbursed_at           TIMESTAMPTZ,
  payment_reference      VARCHAR(255),
  applied_at             TIMESTAMPTZ,
  applied_amount         NUMERIC(12, 2),
  difference_amount      NUMERIC(12, 2),
  rejected_reason        TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viatico_anticipos_allowance ON viatico_anticipos(allowance_id);
CREATE INDEX IF NOT EXISTS idx_viatico_anticipos_status    ON viatico_anticipos(status);

-- Agregar columna km_rate_per_km a travel_allowance_policy si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'travel_allowance_policy' AND column_name = 'km_rate_per_km'
  ) THEN
    ALTER TABLE travel_allowance_policy ADD COLUMN km_rate_per_km NUMERIC(10,4) DEFAULT 0.12;
  END IF;
END $$;
