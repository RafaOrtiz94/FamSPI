ALTER TABLE prospect_visits
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES crm.crm_leads(id),
  ADD COLUMN IF NOT EXISTS is_planned BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_prospect_visits_lead_id ON prospect_visits (lead_id);
