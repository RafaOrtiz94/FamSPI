ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS contract_client_signed_document_id character varying(255),
  ADD COLUMN IF NOT EXISTS contract_client_signed_uploaded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS contract_client_signed_by integer;

COMMENT ON COLUMN public.private_purchase_requests.contract_client_signed_document_id IS 'Document ID del contrato firmado por el cliente';
COMMENT ON COLUMN public.private_purchase_requests.contract_client_signed_uploaded_at IS 'Fecha de carga del contrato firmado por el cliente';
COMMENT ON COLUMN public.private_purchase_requests.contract_client_signed_by IS 'Usuario que sube el contrato firmado por el cliente';
