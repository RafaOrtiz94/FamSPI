ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS dispatch_items_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dispatch_notes text;

COMMENT ON COLUMN public.private_purchase_requests.dispatch_items_json IS 'Detalles de despacho registrados por logistica';
COMMENT ON COLUMN public.private_purchase_requests.dispatch_notes IS 'Observaciones de despacho';
