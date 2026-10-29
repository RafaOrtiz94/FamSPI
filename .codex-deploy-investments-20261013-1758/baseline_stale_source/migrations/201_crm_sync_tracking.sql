-- Migration 201: CRM sync tracking columns
-- Agrega columnas de referencia cruzada hacia Laravel CRM (venturedrake/laravel-crm)
-- en las tablas client_requests, accounts y opportunity de FamSPI.

BEGIN;

-- client_requests: referencia al crm_contact creado en Laravel CRM
ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS crm_contact_id  VARCHAR(36),
  ADD COLUMN IF NOT EXISTS crm_synced_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_client_requests_crm_contact_id
  ON public.client_requests (crm_contact_id)
  WHERE crm_contact_id IS NOT NULL;

-- accounts: referencia a la crm_organization creada en Laravel CRM
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS crm_organization_id  VARCHAR(36),
  ADD COLUMN IF NOT EXISTS crm_synced_at         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_accounts_crm_organization_id
  ON public.accounts (crm_organization_id)
  WHERE crm_organization_id IS NOT NULL;

-- opportunity: referencia al crm_deal creado en Laravel CRM
ALTER TABLE public.opportunity
  ADD COLUMN IF NOT EXISTS crm_deal_id   VARCHAR(36),
  ADD COLUMN IF NOT EXISTS crm_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_opportunity_crm_deal_id
  ON public.opportunity (crm_deal_id)
  WHERE crm_deal_id IS NOT NULL;

COMMIT;
