ALTER TABLE public.scheduled_visits
  ADD COLUMN IF NOT EXISTS crm_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_link TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ;
