ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS estimated_arrival_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS estimated_arrival_updated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS equipment_arrived_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS equipment_arrived_by integer;

COMMENT ON COLUMN public.private_purchase_requests.estimated_arrival_at IS 'Fecha tentativa de llegada del equipo (editable hasta llegada)';
COMMENT ON COLUMN public.private_purchase_requests.estimated_arrival_updated_at IS 'Ultima actualizacion de fecha tentativa de llegada';
COMMENT ON COLUMN public.private_purchase_requests.equipment_arrived_at IS 'Fecha en que el equipo llego a operaciones';
COMMENT ON COLUMN public.private_purchase_requests.equipment_arrived_by IS 'Usuario que marco llegada de equipo';
