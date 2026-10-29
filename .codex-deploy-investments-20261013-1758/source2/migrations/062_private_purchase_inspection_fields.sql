ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS inspection_request_id integer,
  ADD COLUMN IF NOT EXISTS inspection_acta_document_id character varying(255),
  ADD COLUMN IF NOT EXISTS inspection_requested_at timestamp with time zone;

COMMENT ON COLUMN public.private_purchase_requests.inspection_request_id IS 'ID de la solicitud de inspeccion de ambiente';
COMMENT ON COLUMN public.private_purchase_requests.inspection_acta_document_id IS 'Document ID del acta de inspeccion';
COMMENT ON COLUMN public.private_purchase_requests.inspection_requested_at IS 'Fecha de solicitud de inspeccion';
