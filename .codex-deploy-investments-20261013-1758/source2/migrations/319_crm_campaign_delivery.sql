-- 319_crm_campaign_delivery.sql
-- CRM-Fam campanas de email: envio real, bajas (lista de supresion), plantillas y metricas.
-- Aditiva sobre 313. Las campanas existentes quedan en 'draft' sin cambios.

-- Estados de la campana: borrador -> enviando -> enviada.
ALTER TABLE crm.crm_email_campaigns DROP CONSTRAINT IF EXISTS crm_email_campaigns_status_check;
ALTER TABLE crm.crm_email_campaigns
  ADD CONSTRAINT crm_email_campaigns_status_check CHECK (status IN ('draft', 'sending', 'sent'));

ALTER TABLE crm.crm_email_campaigns
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS send_confirmed_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS send_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- Estados del destinatario: pendiente -> enviado | fallido | omitido (dado de baja).
ALTER TABLE crm.crm_email_campaign_recipients DROP CONSTRAINT IF EXISTS crm_email_campaign_recipients_delivery_status_check;
ALTER TABLE crm.crm_email_campaign_recipients
  ADD CONSTRAINT crm_email_campaign_recipients_delivery_status_check
  CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped'));

ALTER TABLE crm.crm_email_campaign_recipients
  ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_clicked_at timestamptz;

-- El token identifica al destinatario en los enlaces publicos (baja, apertura, clic).
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_email_campaign_recipient_token
  ON crm.crm_email_campaign_recipients (token);

-- Lista de supresion: quien se dio de baja no recibe ninguna campana futura.
CREATE TABLE IF NOT EXISTS crm.crm_email_suppressions (
  email_lower varchar(320) PRIMARY KEY,
  reason varchar(30) NOT NULL DEFAULT 'unsubscribed' CHECK (reason IN ('unsubscribed', 'manual')),
  campaign_id uuid REFERENCES crm.crm_email_campaigns(id) ON DELETE SET NULL,
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
