BEGIN;

ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_client_requests_external_source
  ON public.client_requests (external_source);

CREATE UNIQUE INDEX IF NOT EXISTS ux_client_requests_external_identity
  ON public.client_requests (external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

COMMIT;
