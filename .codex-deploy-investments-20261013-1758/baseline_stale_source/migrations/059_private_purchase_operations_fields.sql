ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS includes_starter_kit boolean,
  ADD COLUMN IF NOT EXISTS operations_notes text;

COMMENT ON COLUMN public.private_purchase_requests.includes_starter_kit IS 'Indica si incluye kit de arranque para operaciones';
COMMENT ON COLUMN public.private_purchase_requests.operations_notes IS 'Observaciones de operaciones para guias';
