ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS offer_valid_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS offer_kind character varying(32) DEFAULT 'venta',
  ADD COLUMN IF NOT EXISTS comodato_document_id character varying(255);

COMMENT ON COLUMN public.private_purchase_requests.offer_valid_until IS 'Fecha de expiración de la oferta propuesta';
COMMENT ON COLUMN public.private_purchase_requests.offer_kind IS 'Tipo de solicitud: venta, prestamo o comodato';
COMMENT ON COLUMN public.private_purchase_requests.comodato_document_id IS 'Documento de estadísticas cargado para comodatos, almacenado en Drive';
