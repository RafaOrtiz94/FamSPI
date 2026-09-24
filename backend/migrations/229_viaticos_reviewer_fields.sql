-- Migration 229: Campos para correcciones de revisor y comprobante de pago en viaticos

ALTER TABLE travel_allowances
  ADD COLUMN IF NOT EXISTS reviewer_observation TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_observation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_observation_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_receipt_drive_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_receipt_drive_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_receipt_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_receipt_uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE travel_allowance_invoices
  ADD COLUMN IF NOT EXISTS reviewer_note TEXT;
