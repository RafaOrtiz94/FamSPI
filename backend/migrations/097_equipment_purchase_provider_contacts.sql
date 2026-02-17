-- 097_equipment_purchase_provider_contacts.sql
-- Catalogo reusable de correos de proveedor para flujo ACP de compras publicas.

CREATE TABLE IF NOT EXISTS equipment_purchase_provider_contacts (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_by INTEGER,
  created_by_email TEXT,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_purchase_provider_contacts_last_used
  ON equipment_purchase_provider_contacts (last_used_at DESC, updated_at DESC);
