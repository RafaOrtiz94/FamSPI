--
-- Migration 018: Soporte de cantidades anuales en determinaciones
--

ALTER TABLE public.bc_determinations
  ADD COLUMN IF NOT EXISTS annual_quantity integer;

COMMENT ON COLUMN public.bc_determinations.monthly_quantity IS 'Cantidad mensual estimada para Business Cases públicos';
COMMENT ON COLUMN public.bc_determinations.annual_quantity IS 'Cantidad anual estimada para Business Cases privados/comodatos';
