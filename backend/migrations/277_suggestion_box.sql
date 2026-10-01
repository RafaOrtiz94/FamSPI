-- Public and internal suggestion box. Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.suggestion_box_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE,
  submission_type TEXT NOT NULL,
  source TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  reporter_name TEXT,
  reporter_email TEXT,
  reporter_phone TEXT,
  reporter_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  resolution_notes TEXT,
  assigned_to_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT suggestion_box_submissions_type_check
    CHECK (submission_type IN ('suggestion', 'complaint')),
  CONSTRAINT suggestion_box_submissions_source_check
    CHECK (source IN ('external', 'internal')),
  CONSTRAINT suggestion_box_submissions_status_check
    CHECK (status IN ('received', 'in_review', 'resolved', 'closed')),
  CONSTRAINT suggestion_box_submissions_internal_reporter_check
    CHECK (source <> 'internal' OR reporter_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_suggestion_box_submissions_status_created
  ON public.suggestion_box_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestion_box_submissions_type_created
  ON public.suggestion_box_submissions(submission_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestion_box_submissions_reporter_user
  ON public.suggestion_box_submissions(reporter_user_id) WHERE reporter_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.suggestion_box_events (
  id BIGSERIAL PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.suggestion_box_submissions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggestion_box_events_submission_date
  ON public.suggestion_box_events(submission_id, created_at DESC);
