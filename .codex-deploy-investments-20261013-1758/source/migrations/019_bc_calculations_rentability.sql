--
-- Migration 019: Campos adicionales para cálculos de rentabilidad
--

ALTER TABLE public.bc_calculations
  ADD COLUMN IF NOT EXISTS total_annual_tests integer,
  ADD COLUMN IF NOT EXISTS total_annual_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS equipment_investment numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_investment numeric(12,2),
  ADD COLUMN IF NOT EXISTS monthly_revenue numeric(12,2),
  ADD COLUMN IF NOT EXISTS annual_revenue numeric(12,2),
  ADD COLUMN IF NOT EXISTS monthly_margin numeric(12,2),
  ADD COLUMN IF NOT EXISTS annual_margin numeric(12,2),
  ADD COLUMN IF NOT EXISTS roi_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS payback_months integer,
  ADD COLUMN IF NOT EXISTS annual_operating_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS monthly_operating_cost numeric(12,2);

COMMENT ON COLUMN public.bc_calculations.total_annual_tests IS 'Total de pruebas anuales (Comodatos)';
COMMENT ON COLUMN public.bc_calculations.total_annual_cost IS 'Costo anual total estimado';
COMMENT ON COLUMN public.bc_calculations.equipment_investment IS 'Inversión directa en equipos';
COMMENT ON COLUMN public.bc_calculations.total_investment IS 'Inversión total (equipo + inversiones externas)';
COMMENT ON COLUMN public.bc_calculations.monthly_revenue IS 'Ingreso mensual necesario para cubrir costos y margen';
COMMENT ON COLUMN public.bc_calculations.monthly_margin IS 'Margen mensual neto';
COMMENT ON COLUMN public.bc_calculations.roi_percentage IS 'ROI proyectado en porcentaje';
COMMENT ON COLUMN public.bc_calculations.payback_months IS 'Meses esperados para recuperar la inversión';
COMMENT ON COLUMN public.bc_calculations.annual_operating_cost IS 'Costo operativo anual (incluye inversiones recorrentes)';
COMMENT ON COLUMN public.bc_calculations.monthly_operating_cost IS 'Costo operativo mensual';
