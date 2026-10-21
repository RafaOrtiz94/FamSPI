-- 113_bc_sheet_generation_jobs.sql
-- Cola asincrona para generar hojas de Business Case via Apps Script WebApp.

CREATE TABLE IF NOT EXISTS public.bc_sheet_generation_jobs (
  id BIGSERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  idempotency_key VARCHAR(200) NOT NULL,
  mapping_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload_hash VARCHAR(64) NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sheet_id TEXT,
  sheet_url TEXT,
  worker_response JSONB,
  error_code TEXT,
  error_message TEXT,
  correlation_id UUID,
  created_by INTEGER REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bc_sheet_generation_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT bc_sheet_generation_jobs_attempts_check
    CHECK (attempts >= 0 AND max_attempts >= 1),
  CONSTRAINT bc_sheet_generation_jobs_payload_hash_check
    CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT bc_sheet_generation_jobs_unique_request_id UNIQUE (request_id),
  CONSTRAINT bc_sheet_generation_jobs_unique_idempotency UNIQUE (business_case_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_bc_sheet_jobs_status_retry
  ON public.bc_sheet_generation_jobs (status, next_retry_at, id);

CREATE INDEX IF NOT EXISTS idx_bc_sheet_jobs_business_case
  ON public.bc_sheet_generation_jobs (business_case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bc_sheet_jobs_correlation
  ON public.bc_sheet_generation_jobs (correlation_id);

