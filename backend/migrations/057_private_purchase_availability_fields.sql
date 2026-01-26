-- Migration 057: Add availability provider fields for private purchases

ALTER TABLE private_purchase_requests
  ADD COLUMN IF NOT EXISTS provider_email TEXT,
  ADD COLUMN IF NOT EXISTS availability_request_notes TEXT,
  ADD COLUMN IF NOT EXISTS availability_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS availability_email_file_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_response JSONB,
  ADD COLUMN IF NOT EXISTS provider_response_at TIMESTAMPTZ;

COMMENT ON COLUMN private_purchase_requests.provider_email IS 'Proveedor asignado por ACP para disponibilidad';
COMMENT ON COLUMN private_purchase_requests.availability_request_notes IS 'Notas enviadas al proveedor para disponibilidad';
COMMENT ON COLUMN private_purchase_requests.availability_email_sent_at IS 'Fecha de envio de correo de disponibilidad';
COMMENT ON COLUMN private_purchase_requests.availability_email_file_id IS 'Archivo en Drive del correo de disponibilidad';
COMMENT ON COLUMN private_purchase_requests.provider_response IS 'Respuesta del proveedor (JSON)';
COMMENT ON COLUMN private_purchase_requests.provider_response_at IS 'Fecha de respuesta del proveedor';
