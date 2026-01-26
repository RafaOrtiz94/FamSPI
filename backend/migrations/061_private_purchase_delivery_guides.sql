ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS delivery_guides_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_guides_uploaded_at timestamp with time zone;

COMMENT ON COLUMN public.private_purchase_requests.delivery_guides_json IS 'Guias de despacho asociadas a la compra privada';
COMMENT ON COLUMN public.private_purchase_requests.delivery_guides_uploaded_at IS 'Fecha de carga de guias de despacho';
