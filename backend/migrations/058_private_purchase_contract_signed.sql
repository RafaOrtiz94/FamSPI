ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS contract_signed_document_id character varying(255),
  ADD COLUMN IF NOT EXISTS contract_signed_uploaded_at timestamp with time zone;

COMMENT ON COLUMN public.private_purchase_requests.contract_signed_document_id IS 'Document ID del contrato firmado subido por gerencia';
COMMENT ON COLUMN public.private_purchase_requests.contract_signed_uploaded_at IS 'Fecha de carga del contrato firmado';
