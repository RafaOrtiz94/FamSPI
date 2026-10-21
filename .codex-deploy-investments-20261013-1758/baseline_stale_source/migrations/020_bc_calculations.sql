--
-- Migration 020: BC Calculations Table (UPDATED)
-- Stores calculated results for Business Cases
--

-- Add missing columns if table already exists
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

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS bc_calculations_business_case_id_idx 
    ON public.bc_calculations (business_case_id);
    
CREATE INDEX IF NOT EXISTS bc_calculations_calculated_at_idx 
    ON public.bc_calculations (calculated_at DESC);

-- Add/update comments
COMMENT ON TABLE public.bc_calculations IS 'Resultados de cálculos para Business Cases (consumo, costos, ROI, etc.)';
COMMENT ON COLUMN public.bc_calculations.total_monthly_tests IS 'Total de pruebas mensuales (BCs públicos)';
COMMENT ON COLUMN public.bc_calculations.total_annual_tests IS 'Total de pruebas anuales (BCs privados)';
COMMENT ON COLUMN public.bc_calculations.equipment_investment IS 'Inversión en equipos';
COMMENT ON COLUMN public.bc_calculations.total_investment IS 'Inversión total (equipo + extras)';
COMMENT ON COLUMN public.bc_calculations.monthly_revenue IS 'Ingreso mensual necesario para alcanzar margen objetivo';
COMMENT ON COLUMN public.bc_calculations.monthly_margin IS 'Margen mensual (ingreso - costo)';
COMMENT ON COLUMN public.bc_calculations.roi_percentage IS 'ROI en porcentaje sobre la duración del comodato';
COMMENT ON COLUMN public.bc_calculations.payback_months IS 'Meses necesarios para recuperar la inversión';
COMMENT ON COLUMN public.bc_calculations.warnings IS 'Array JSON de advertencias (capacidad excedida, ROI bajo, etc.)';
COMMENT ON COLUMN public.bc_calculations.recommendations IS 'Array JSON de recomendaciones automáticas';
COMMENT ON COLUMN public.bc_calculations.calculation_version IS 'Versión del cálculo (incrementa con cada recálculo)';
