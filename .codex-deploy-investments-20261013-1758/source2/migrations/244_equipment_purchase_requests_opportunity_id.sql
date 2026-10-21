-- Migration: 244_equipment_purchase_requests_opportunity_id.sql
-- Enlaza compras publicas (equipment_purchase_requests) a la oportunidad CRM que las origino,
-- igual que 242 hizo con private_purchase_requests.

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES crm.crm_opportunities(id);

CREATE INDEX IF NOT EXISTS idx_equipment_purchase_requests_opportunity ON public.equipment_purchase_requests(opportunity_id);
