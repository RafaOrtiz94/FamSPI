ALTER TABLE public.bc_requirements
  ADD COLUMN IF NOT EXISTS observations text;

COMMENT ON COLUMN public.bc_requirements.observations IS 'Notas adicionales del comercial para el requerimiento';
