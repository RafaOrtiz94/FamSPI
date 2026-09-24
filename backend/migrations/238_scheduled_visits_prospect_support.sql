ALTER TABLE public.scheduled_visits
  ALTER COLUMN client_request_id DROP NOT NULL;

ALTER TABLE public.scheduled_visits
  ADD COLUMN IF NOT EXISTS prospect_name TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scheduled_visits_client_or_prospect_check'
      AND conrelid = 'public.scheduled_visits'::regclass
  ) THEN
    ALTER TABLE public.scheduled_visits
      ADD CONSTRAINT scheduled_visits_client_or_prospect_check
      CHECK (
        (client_request_id IS NOT NULL AND NULLIF(BTRIM(COALESCE(prospect_name, '')), '') IS NULL)
        OR
        (client_request_id IS NULL AND NULLIF(BTRIM(COALESCE(prospect_name, '')), '') IS NOT NULL)
      );
  END IF;
END
$$;
