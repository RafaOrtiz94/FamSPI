-- 095_public_purchase_delivery_flow.sql
-- Objetivo:
-- Extender compras públicas con tramo de entrega:
-- contrato disponible -> solicitud/registro de fechas -> arribo -> despacho -> entrega.

ALTER TABLE equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS delivery_dates_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_dates_requested_by INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_dates_requested_by_email TEXT,
  ADD COLUMN IF NOT EXISTS delivery_start_at DATE,
  ADD COLUMN IF NOT EXISTS delivery_end_at DATE,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
  ADD COLUMN IF NOT EXISTS equipment_arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS equipment_arrived_by INTEGER,
  ADD COLUMN IF NOT EXISTS equipment_arrived_by_email TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatch_ready_by INTEGER,
  ADD COLUMN IF NOT EXISTS dispatch_ready_by_email TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_by INTEGER,
  ADD COLUMN IF NOT EXISTS delivered_by_email TEXT,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_notes TEXT;

COMMENT ON COLUMN equipment_purchase_requests.delivery_dates_requested_at IS 'Fecha en que se solicitaron fechas de entrega';
COMMENT ON COLUMN equipment_purchase_requests.delivery_start_at IS 'Fecha inicial comprometida para entrega';
COMMENT ON COLUMN equipment_purchase_requests.delivery_end_at IS 'Fecha final comprometida para entrega';
COMMENT ON COLUMN equipment_purchase_requests.equipment_arrived_at IS 'Fecha de arribo del equipo para despacho';
COMMENT ON COLUMN equipment_purchase_requests.dispatch_ready_at IS 'Fecha en que despacho quedó listo';
COMMENT ON COLUMN equipment_purchase_requests.delivered_at IS 'Fecha de cierre de entrega';
