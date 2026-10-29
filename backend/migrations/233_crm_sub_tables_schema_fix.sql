-- Migration 233: Fix CRM sub-table schema to match service code column expectations
-- Root cause: migration 231 was written with a different schema design than the service code.
-- This migration adds the missing columns without dropping data.

-- 1. crm_buying_influences
-- Service uses: user_id, full_name, job_title, receptivity, priority_weight, notes, updated_by
ALTER TABLE crm.crm_buying_influences
  ADD COLUMN IF NOT EXISTS user_id integer references public.users(id),
  ADD COLUMN IF NOT EXISTS full_name varchar(255),
  ADD COLUMN IF NOT EXISTS job_title varchar(150),
  ADD COLUMN IF NOT EXISTS receptivity varchar(50),
  ADD COLUMN IF NOT EXISTS priority_weight integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_by integer references public.users(id);

-- 2. crm_win_results
-- Service INSERT uses: description (not result_description), our_position, gap_to_fill, updated_by
-- blue_sheet_id is NOT NULL in the table; service will now always supply it
ALTER TABLE crm.crm_win_results
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS our_position text,
  ADD COLUMN IF NOT EXISTS gap_to_fill text,
  ADD COLUMN IF NOT EXISTS updated_by integer references public.users(id);

-- 3. crm_competitors
-- Service uses: threat_level, updated_by
ALTER TABLE crm.crm_competitors
  ADD COLUMN IF NOT EXISTS threat_level varchar(50) NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS updated_by integer references public.users(id);

-- 4. crm_strengths
-- Service uses: relevance_score, updated_by
ALTER TABLE crm.crm_strengths
  ADD COLUMN IF NOT EXISTS relevance_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_by integer references public.users(id);

-- 5. crm_red_flags
-- flag_title is NOT NULL in migration but service INSERT never provides it
-- updated_by missing
ALTER TABLE crm.crm_red_flags
  ALTER COLUMN flag_title DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS updated_by integer references public.users(id);
