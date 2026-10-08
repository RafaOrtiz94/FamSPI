BEGIN;

CREATE TABLE IF NOT EXISTS public.signature_workflows (
  id BIGSERIAL PRIMARY KEY,
  workflow_code TEXT NOT NULL UNIQUE,
  source_module TEXT NOT NULL,
  source_entity TEXT NOT NULL,
  source_entity_id BIGINT NOT NULL,
  document_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'prepared',
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prepared_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  current_step INTEGER,
  verification_token TEXT UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_signature_workflows_source
  ON public.signature_workflows(source_module, source_entity, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_signature_workflows_status
  ON public.signature_workflows(status);
CREATE INDEX IF NOT EXISTS idx_signature_workflows_created_by
  ON public.signature_workflows(created_by);
CREATE INDEX IF NOT EXISTS idx_signature_workflows_created_at
  ON public.signature_workflows(created_at DESC);

CREATE TABLE IF NOT EXISTS public.signature_workflow_documents (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES public.signature_workflows(id) ON DELETE CASCADE,
  version_num INTEGER NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  source_sha256 TEXT NOT NULL,
  source_storage_ref TEXT,
  source_drive_url TEXT,
  source_drive_file_id TEXT,
  source_pdf_base64 TEXT,
  final_sha256 TEXT,
  final_storage_ref TEXT,
  final_drive_url TEXT,
  final_drive_file_id TEXT,
  final_pdf_base64 TEXT,
  qr_token TEXT,
  qr_drive_url TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ,
  UNIQUE(workflow_id, version_num)
);

CREATE INDEX IF NOT EXISTS idx_signature_workflow_documents_workflow
  ON public.signature_workflow_documents(workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signature_workflow_documents_current
  ON public.signature_workflow_documents(workflow_id, is_current);

CREATE TABLE IF NOT EXISTS public.signature_workflow_signers (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES public.signature_workflows(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES public.signature_workflow_documents(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  email_snapshot TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  role_snapshot TEXT,
  signer_kind TEXT NOT NULL DEFAULT 'internal_user',
  sequence_order INTEGER NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending',
  access_token TEXT UNIQUE,
  access_token_expires_at TIMESTAMPTZ,
  available_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  replaced_at TIMESTAMPTZ,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  consent_text TEXT,
  payload_hash_sha256 TEXT,
  previous_signature_hash_sha256 TEXT,
  signature_hash_sha256 TEXT,
  signature_visual_ref TEXT,
  rejection_reason TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signature_workflow_signers_workflow
  ON public.signature_workflow_signers(workflow_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_signature_workflow_signers_user
  ON public.signature_workflow_signers(user_id);
CREATE INDEX IF NOT EXISTS idx_signature_workflow_signers_status
  ON public.signature_workflow_signers(status);
CREATE INDEX IF NOT EXISTS idx_signature_workflow_signers_available_at
  ON public.signature_workflow_signers(available_at);

CREATE TABLE IF NOT EXISTS public.signature_workflow_events (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES public.signature_workflows(id) ON DELETE CASCADE,
  document_id BIGINT REFERENCES public.signature_workflow_documents(id) ON DELETE SET NULL,
  signer_id BIGINT REFERENCES public.signature_workflow_signers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_description TEXT,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_hash TEXT NOT NULL,
  previous_event_hash TEXT,
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signature_workflow_events_workflow
  ON public.signature_workflow_events(workflow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.signature_workflow_notifications (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES public.signature_workflows(id) ON DELETE CASCADE,
  signer_id BIGINT REFERENCES public.signature_workflow_signers(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.signature_workflow_artifacts (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES public.signature_workflows(id) ON DELETE CASCADE,
  document_id BIGINT REFERENCES public.signature_workflow_documents(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  filename TEXT,
  sha256 TEXT,
  storage_ref TEXT,
  drive_url TEXT,
  drive_file_id TEXT,
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.collab_delivery_actas
  ADD COLUMN IF NOT EXISTS signature_workflow_id BIGINT REFERENCES public.signature_workflows(id) ON DELETE SET NULL;
ALTER TABLE public.collab_delivery_actas
  ADD COLUMN IF NOT EXISTS signature_workflow_status TEXT;
ALTER TABLE public.collab_delivery_actas
  ADD COLUMN IF NOT EXISTS final_verification_token TEXT;
ALTER TABLE public.collab_delivery_actas
  ADD COLUMN IF NOT EXISTS final_pdf_generated_at TIMESTAMPTZ;

ALTER TABLE public.ti_asset_actas
  ADD COLUMN IF NOT EXISTS signature_workflow_id BIGINT REFERENCES public.signature_workflows(id) ON DELETE SET NULL;
ALTER TABLE public.ti_asset_actas
  ADD COLUMN IF NOT EXISTS signature_workflow_status TEXT;
ALTER TABLE public.ti_asset_actas
  ADD COLUMN IF NOT EXISTS final_verification_token TEXT;
ALTER TABLE public.ti_asset_actas
  ADD COLUMN IF NOT EXISTS final_pdf_generated_at TIMESTAMPTZ;

COMMIT;
