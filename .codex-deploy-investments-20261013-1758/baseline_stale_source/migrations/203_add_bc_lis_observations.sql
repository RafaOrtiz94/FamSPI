ALTER TABLE public.bc_lis_integration
  ADD COLUMN IF NOT EXISTS lis_observations text,
  ADD COLUMN IF NOT EXISTS interface_observations text;

COMMENT ON COLUMN public.bc_lis_integration.lis_observations IS 'Observaciones especificas cuando el proyecto requiere LIS';
COMMENT ON COLUMN public.bc_lis_integration.interface_observations IS 'Observaciones especificas cuando el proyecto requiere interfaz';

COMMENT ON COLUMN public