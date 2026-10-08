-- CRM email campaigns: this migration creates the campaign workspace and a
-- recipient snapshot only. It intentionally contains no delivery queue or
-- sender configuration; promotional dispatch requires an approved consent and
-- unsubscribe design before it can be enabled.

CREATE TABLE IF NOT EXISTS crm.crm_email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name VARCHAR(160) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  preheader VARCHAR(240),
  body_content TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT crm_email_campaigns_status_check CHECK (status IN ('draft'))
);

CREATE TABLE IF NOT EXISTS crm.crm_email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES crm.crm_email_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm.crm_contacts(id) ON DELETE SET NULL,
  account_id UUID REFERENCES crm.crm_accounts(id) ON DELETE SET NULL,
  recipient_name VARCHAR(200) NOT NULL,
  recipient_email VARCHAR(320) NOT NULL,
  laboratory_name VARCHAR(200) NOT NULL,
  delivery_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_email_campaign_recipients_source_check CHECK (
    contact_id IS NOT NULL OR account_id IS NOT NULL
  ),
  CONSTRAINT crm_email_campaign_recipients_delivery_status_check CHECK (
    delivery_status IN ('pending')
  )
);

CREATE INDEX IF NOT EXISTS idx_crm_email_campaigns_active
  ON crm.crm_email_campaigns (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_email_campaign_recipients_campaign
  ON crm.crm_email_campaign_recipients (campaign_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_email_campaign_recipient_email
  ON crm.crm_email_campaign_recipients (campaign_id, lower(recipient_email));
