ALTER TABLE crm.crm_leads
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE public.scheduled_visits
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES crm.crm_leads(id);

CREATE INDEX IF NOT EXISTS idx_crm_leads_city ON crm.crm_leads (LOWER(TRIM(city)));
CREATE INDEX IF NOT EXISTS idx_scheduled_visits_lead_id ON public.scheduled_visits (lead_id);
