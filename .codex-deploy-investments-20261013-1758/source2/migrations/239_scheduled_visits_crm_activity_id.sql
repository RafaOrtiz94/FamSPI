ALTER TABLE public.scheduled_visits
  ADD COLUMN IF NOT EXISTS crm_activity_id UUID;
