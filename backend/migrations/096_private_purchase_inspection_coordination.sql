-- 096_private_purchase_inspection_coordination.sql
-- Objetivo:
-- 1) Soportar coordinación formal de inspección en compras privadas.
-- 2) Permitir inspección automática con ventana mínima/máxima.
-- 3) Endurecer flujo para bloquear contrato si no hay coordinación.

ALTER TABLE private_purchase_requests
  ADD COLUMN IF NOT EXISTS inspection_min_date DATE,
  ADD COLUMN IF NOT EXISTS inspection_max_date DATE,
  ADD COLUMN IF NOT EXISTS inspection_scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS inspection_coordination_notes TEXT,
  ADD COLUMN IF NOT EXISTS inspection_coordinated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspection_coordinated_by INTEGER,
  ADD COLUMN IF NOT EXISTS inspection_coordinated_by_email TEXT;

CREATE INDEX IF NOT EXISTS idx_private_purchase_inspection_coordination
  ON private_purchase_requests (status, inspection_request_id, inspection_scheduled_date);

COMMENT ON COLUMN private_purchase_requests.inspection_min_date
  IS 'Fecha mínima de inspección para coordinación privada';
COMMENT ON COLUMN private_purchase_requests.inspection_max_date
  IS 'Fecha máxima de inspección para coordinación privada';
COMMENT ON COLUMN private_purchase_requests.inspection_scheduled_date
  IS 'Fecha coordinada final de inspección privada';
COMMENT ON COLUMN private_purchase_requests.inspection_coordination_notes
  IS 'Notas de coordinación comercial/servicio técnico';
