--
-- Migration 016: Business Case Core Tables (UPDATED)
-- Adds BC-specific columns to existing equipment_purchase_requests table
--

-- Drop existing views first (they will be recreated with new columns)
DROP VIEW IF EXISTS public.v_business_cases_private CASCADE;
DROP VIEW IF EXISTS public.v_business_cases_public CASCADE;
DROP VIEW IF EXISTS public.v_business_cases CASCADE;
DROP VIEW IF EXISTS public.v_business_cases_complete CASCADE;
DROP VIEW IF EXISTS public.v_business_cases_legacy CASCADE;

-- Add new columns to existing table
ALTER TABLE public.equipment_purchase_requests
ADD COLUMN IF NOT EXISTS bc_purchase_type varchar(50) DEFAULT 'public' CHECK (bc_purchase_type IN ('public', 'private_comodato', 'private_sale')),
ADD COLUMN IF NOT EXISTS bc_duration_years integer CHECK (bc_duration_years > 0),
ADD COLUMN IF NOT EXISTS bc_equipment_cost numeric(12,2) CHECK (bc_equipment_cost >= 0),
ADD COLUMN IF NOT EXISTS bc_target_margin_percentage numeric(5,2) CHECK (bc_target_margin_percentage >= 0 AND bc_target_margin_percentage <= 100),
ADD COLUMN IF NOT EXISTS bc_amortization_months integer CHECK (bc_amortization_months > 0),
ADD COLUMN IF NOT EXISTS bc_calculation_mode varchar(20) DEFAULT 'monthly' CHECK (bc_calculation_mode IN ('monthly', 'annual')),
ADD COLUMN IF NOT EXISTS bc_show_roi boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS bc_show_margin boolean DEFAULT false;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS equipment_purchase_requests_bc_purchase_type_idx 
    ON public.equipment_purchase_requests (bc_purchase_type);

-- Add comments for new columns
COMMENT ON COLUMN public.equipment_purchase_requests.bc_purchase_type IS 'Tipo de comodato: comodato_publico (licitaciones) o comodato_privado (clientes privados)';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_duration_years IS 'Duración del comodato en años';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_equipment_cost IS 'Costo del equipo para cálculo de ROI';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_target_margin_percentage IS 'Margen objetivo en %';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_calculation_mode IS 'Modo de cálculo: annual (ambos tipos de comodato)';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_show_roi IS 'Mostrar ROI en reportes';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_show_margin IS 'Mostrar margen en reportes';

-- Update table comment
COMMENT ON TABLE public.equipment_purchase_requests IS 'Business Cases de comodatos (públicos y privados) con cálculos automáticos de ROI';

-- Recreate views with new columns
CREATE OR REPLACE VIEW public.v_business_cases AS
SELECT 
    id AS business_case_id,
    client_name,
    client_id,
    bc_purchase_type,
    status,
    bc_stage,
    bc_progress,
    bc_duration_years,
    bc_equipment_cost,
    bc_target_margin_percentage,
    bc_calculation_mode,
    bc_show_roi,
    bc_show_margin,
    assigned_to_email,
    assigned_to_name,
    drive_folder_id,
    extra,
    modern_bc_metadata,
    created_at,
    updated_at,
    created_by,
    bc_created_at,
    uses_modern_system,
    bc_system_type
FROM public.equipment_purchase_requests
WHERE uses_modern_system = true 
  AND bc_system_type = 'modern';

COMMENT ON VIEW public.v_business_cases IS 'Vista de Business Cases de comodatos (públicos y privados)';

-- View for public comodatos only
CREATE OR REPLACE VIEW public.v_business_cases_public AS
SELECT * FROM public.v_business_cases
WHERE bc_purchase_type = 'comodato_publico';

COMMENT ON VIEW public.v_business_cases_public IS 'Vista de comodatos públicos (licitaciones)';

-- View for private comodatos
CREATE OR REPLACE VIEW public.v_business_cases_private AS
SELECT * FROM public.v_business_cases
WHERE bc_purchase_type = 'comodato_privado';

COMMENT ON VIEW public.v_business_cases_private IS 'Vista de comodatos privados (clientes privados)';

-- Recreate complete view if it was used
CREATE OR REPLACE VIEW public.v_business_cases_complete AS
SELECT * FROM public.v_business_cases;

COMMENT ON VIEW public.v_business_cases_complete IS 'Vista completa de Business Cases (alias de v_business_cases)';

