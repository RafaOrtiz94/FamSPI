-- Migration 188: Add provider contract tracking fields to private_purchase_requests
-- El proveedor envía un contrato que ACP recibe y luego sube firmado al sistema.

ALTER TABLE private_purchase_requests
  ADD COLUMN IF NOT EXISTS provider_contract_received_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_contract_received_by  INTEGER,
  ADD COLUMN IF NOT EXISTS provider_contract_document_id  TEXT,
  ADD COLUMN IF NOT EXISTS provider_contract_uploaded_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_contract_uploaded_by  INTEGER;

-- Índice para consultas por estado de contrato del proveedor
CREATE INDEX IF NOT EXISTS idx_private_purchase_provider_contract
  ON private_purchase_requests (provider_contract_received_at, provider_contract_document_id)
  WHERE provider_contract_received_at IS NOT NULL;
