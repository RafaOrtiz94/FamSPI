-- Migration 212: Almacenar posición elegida por el firmante en el documento
ALTER TABLE public.signature_workflow_signers
  ADD COLUMN IF NOT EXISTS signature_placement JSONB;

COMMENT ON COLUMN public.signature_workflow_signers.signature_placement
  IS 'JSON: { page_number, x_pct, y_pct } — coordenadas relativas donde el firmante ubicó su firma en el PDF fuente';
