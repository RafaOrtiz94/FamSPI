-- 093_equipment_purchases_checklist_gate.sql
-- Objetivo:
-- 1) Persistir checklist operativo por solicitud de compra pública.
-- 2) Permitir bloqueo de acciones por checklist sin alterar roles/estados existentes.

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.equipment_purchase_requests.checklist
  IS 'Checklist operativo editable por rol para habilitar acciones del flujo de compras públicas';

