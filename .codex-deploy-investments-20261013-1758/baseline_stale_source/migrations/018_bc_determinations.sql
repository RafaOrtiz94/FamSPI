--
-- Migration 018: BC Determinations Table (UPDATED)
-- Manages determinations (tests) for Business Cases
--

-- Add missing columns if table already exists
ALTER TABLE public.bc_determinations
ADD COLUMN IF NOT EXISTS annual_quantity integer CHECK (annual_quantity > 0);

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS bc_determinations_business_case_id_idx 
    ON public.bc_determinations (business_case_id);
    
CREATE INDEX IF NOT EXISTS bc_determinations_determination_id_idx 
    ON public.bc_determinations (determination_id);

-- Unique constraint: no duplicate determinations per BC
DROP INDEX IF EXISTS bc_determinations_unique_idx;
CREATE UNIQUE INDEX bc_determinations_unique_idx 
    ON public.bc_determinations (business_case_id, determination_id);

-- Add/update comments
COMMENT ON TABLE public.bc_determinations IS 'Determinaciones agregadas a cada Business Case con cantidades mensuales o anuales';
COMMENT ON COLUMN public.bc_determinations.monthly_quantity IS 'Cantidad mensual de pruebas (para BCs públicos con cálculo mensual)';
COMMENT ON COLUMN public.bc_determinations.annual_quantity IS 'Cantidad anual de pruebas (para BCs privados con cálculo anual)';
COMMENT ON COLUMN public.bc_determinations.calculated_consumption IS 'Consumo calculado de reactivos';
COMMENT ON COLUMN public.bc_determinations.calculated_cost IS 'Costo calculado';
COMMENT ON COLUMN public.bc_determinations.calculation_details IS 'Detalles del cálculo en JSON';
