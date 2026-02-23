-- 109_bc_determinations_documents.sql
-- Registro versionado de documentos estadisticos para gate de determinaciones

CREATE TABLE IF NOT EXISTS public.bc_determinations_documents (
  id BIGSERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  file_name TEXT,
  mime_type TEXT,
  file_size_bytes BIGINT,
  drive_file_id TEXT,
  drive_link TEXT,
  document_hash_sha256 TEXT,
  uploaded_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_by_email TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_det_docs_case_uploaded
  ON public.bc_determinations_documents (business_case_id, uploaded_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_bc_det_docs_current
  ON public.bc_determinations_documents (business_case_id, is_current);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bc_det_docs_current_per_case
  ON public.bc_determinations_documents (business_case_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_bc_det_docs_hash
  ON public.bc_determinations_documents (document_hash_sha256);
