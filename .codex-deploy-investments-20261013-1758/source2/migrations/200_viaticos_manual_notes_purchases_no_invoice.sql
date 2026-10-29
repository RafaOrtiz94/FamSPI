-- Migración: Agregar soporte para notas de venta manual y compras sin factura

-- 1. Agregar columnas a travel_allowance_invoices para notas manuales
ALTER TABLE travel_allowance_invoices
ADD COLUMN IF NOT EXISTS document_type VARCHAR(30) DEFAULT 'factura_sri'
  CHECK (document_type IN ('factura_sri', 'nota_venta_manual', 'compra_sin_factura')),
ADD COLUMN IF NOT EXISTS subtotal_12 NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS subtotal_0 NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS document_state TEXT,
ADD COLUMN IF NOT EXISTS drive_file_id BIGINT REFERENCES travel_allowance_documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS drive_link TEXT,
ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS establishment VARCHAR(50),
ADD COLUMN IF NOT EXISTS emission_point VARCHAR(50),
ADD COLUMN IF NOT EXISTS sequential VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_travel_allowance_invoices_document_type
  ON travel_allowance_invoices(document_type);

-- 2. Crear tabla travel_allowance_purchases_no_invoice
CREATE TABLE IF NOT EXISTS travel_allowance_purchases_no_invoice (
  id BIGSERIAL PRIMARY KEY,
  allowance_id BIGINT NOT NULL REFERENCES travel_allowances(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  purchase_date DATE NOT NULL,
  justification TEXT,
  file_id BIGINT REFERENCES travel_allowance_documents(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by_finance INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by_talento INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travel_allowance_purchases_no_invoice_allowance_id
  ON travel_allowance_purchases_no_invoice(allowance_id);
CREATE INDEX IF NOT EXISTS idx_travel_allowance_purchases_no_invoice_status
  ON travel_allowance_purchases_no_invoice(status);

-- 3. Agregar columnas de totales consolidados a travel_allowances
ALTER TABLE travel_allowances
ADD COLUMN IF NOT EXISTS total_sri_invoices NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_manual_notes NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_purchases_no_invoice NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_consolidated NUMERIC(12,2) GENERATED ALWAYS AS (
  COALESCE(total_sri_invoices, 0) +
  COALESCE(total_manual_notes, 0) +
  COALESCE(total_purchases_no_invoice, 0)
) STORED,
ADD COLUMN IF NOT EXISTS deducible_10_percent NUMERIC(12,2) GENERATED ALWAYS AS (
  ROUND(
    (COALESCE(total_sri_invoices, 0) +
     COALESCE(total_manual_notes, 0) +
     COALESCE(total_purchases_no_invoice, 0)) * 0.10,
    2
  )
) STORED;

-- 4. Crear índices para mejor performance en consultas
CREATE INDEX IF NOT EXISTS idx_travel_allowances_total_consolidated
  ON travel_allowances(total_consolidated);

-- Fin de migración
