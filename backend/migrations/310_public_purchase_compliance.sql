BEGIN;

CREATE TABLE IF NOT EXISTS public.public_purchase_compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  requirement_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'not_applicable')),
  notes text,
  completed_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (purchase_id, requirement_key)
);

CREATE INDEX IF NOT EXISTS idx_public_purchase_compliance_items_purchase
  ON public.public_purchase_compliance_items (purchase_id);

CREATE TABLE IF NOT EXISTS public.public_purchase_compliance_shared_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  document_name text NOT NULL,
  drive_file_id text NOT NULL,
  drive_file_url text,
  mime_type text,
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  notes text,
  is_current boolean NOT NULL DEFAULT true,
  uploaded_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_public_purchase_compliance_shared_current
  ON public.public_purchase_compliance_shared_documents (document_type)
  WHERE is_current = true;

CREATE TABLE IF NOT EXISTS public.public_purchase_compliance_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_item_id uuid NOT NULL REFERENCES public.public_purchase_compliance_items(id) ON DELETE CASCADE,
  shared_document_id uuid REFERENCES public.public_purchase_compliance_shared_documents(id) ON DELETE RESTRICT,
  document_name text NOT NULL,
  drive_file_id text NOT NULL,
  drive_file_url text,
  mime_type text,
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  uploaded_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_purchase_compliance_evidence_item
  ON public.public_purchase_compliance_evidence (compliance_item_id, uploaded_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_public_purchase_compliance_shared_evidence
  ON public.public_purchase_compliance_evidence (compliance_item_id, shared_document_id)
  WHERE shared_document_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.public_purchase_compliance_events (
  id bigserial PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  requirement_key text,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_purchase_compliance_events_purchase
  ON public.public_purchase_compliance_events (purchase_id, created_at DESC);

COMMIT;
