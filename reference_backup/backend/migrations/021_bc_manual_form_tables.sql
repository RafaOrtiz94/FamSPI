-- Migration 021: Manual BC Form Tables
-- Adds detailed tables for manual Business Case form

-- 1. Add fields to main BC table for public contracts
ALTER TABLE public.equipment_purchase_requests
ADD COLUMN IF NOT EXISTS process_code varchar(255),
ADD COLUMN IF NOT EXISTS contract_object text;

COMMENT ON COLUMN public.equipment_purchase_requests.process_code IS 'Código del proceso (solo para comodatos públicos)';
COMMENT ON COLUMN public.equipment_purchase_requests.contract_object IS 'Objeto de contratación (solo para comodatos públicos)';

-- 2. Lab Environment
CREATE TABLE IF NOT EXISTS public.bc_lab_environment (
  id serial PRIMARY KEY,
  business_case_id uuid UNIQUE NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  work_days_per_week integer CHECK (work_days_per_week >= 1 AND work_days_per_week <= 7),
  shifts_per_day integer CHECK (shifts_per_day >= 1),
  hours_per_shift numeric(4,2) CHECK (hours_per_shift > 0),
  quality_controls_per_shift integer CHECK (quality_controls_per_shift >= 0),
  control_levels integer CHECK (control_levels >= 0),
  routine_qc_frequency varchar(100),
  special_tests text,
  special_qc_frequency varchar(100),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

COMMENT ON TABLE public.bc_lab_environment IS 'Ambiente de laboratorio del cliente';

-- 3. Equipment Details
CREATE TABLE IF NOT EXISTS public.bc_equipment_details (
  id serial PRIMARY KEY,
  business_case_id uuid UNIQUE NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  equipment_status varchar(50) CHECK (equipment_status IN ('new', 'cu')),
  ownership_status varchar(50) CHECK (ownership_status IN ('owned', 'rented', 'new', 'reserved', 'fam_series')),
  reservation_image_url text,
  backup_equipment_name varchar(255),
  backup_status varchar(50),
  backup_manufacture_year integer CHECK (backup_manufacture_year >= 1900 AND backup_manufacture_year <= 2100),
  install_with_primary boolean DEFAULT false,
  installation_location text,
  allows_provisional boolean DEFAULT false,
  requires_complementary boolean DEFAULT false,
  complementary_test_purpose text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

COMMENT ON TABLE public.bc_equipment_details IS 'Detalles del equipamiento (principal, backup, complementario)';
COMMENT ON COLUMN public.bc_equipment_details.equipment_status IS 'Estado: new (nuevo) o cu (usado)';
COMMENT ON COLUMN public.bc_equipment_details.ownership_status IS 'Propiedad: owned, rented, new, reserved, fam_series';

-- 4. LIS Integration
CREATE TABLE IF NOT EXISTS public.bc_lis_integration (
  id serial PRIMARY KEY,
  business_case_id uuid UNIQUE NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  includes_lis boolean DEFAULT false,
  lis_provider varchar(100) CHECK (lis_provider IN ('orion', 'cobas_infiniti', 'other')),
  includes_hardware boolean DEFAULT false,
  monthly_patients integer CHECK (monthly_patients >= 0),
  current_system_name varchar(255),
  current_system_provider varchar(255),
  current_system_hardware boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

COMMENT ON TABLE public.bc_lis_integration IS 'Integración con sistema LIS';
COMMENT ON COLUMN public.bc_lis_integration.lis_provider IS 'Proveedor LIS: orion, cobas_infiniti, other';

-- 5. LIS Equipment Interfaces
CREATE TABLE IF NOT EXISTS public.bc_lis_equipment_interfaces (
  id serial PRIMARY KEY,
  lis_integration_id integer NOT NULL REFERENCES public.bc_lis_integration(id) ON DELETE CASCADE,
  model varchar(255),
  provider varchar(255),
  created_at timestamp DEFAULT now()
);

COMMENT ON TABLE public.bc_lis_equipment_interfaces IS 'Interfaces de equipos para LIS';

-- 6. BC Requirements
CREATE TABLE IF NOT EXISTS public.bc_requirements (
  id serial PRIMARY KEY,
  business_case_id uuid UNIQUE NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  deadline_months integer CHECK (deadline_months > 0),
  projected_deadline_months integer CHECK (projected_deadline_months > 0),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

COMMENT ON TABLE public.bc_requirements IS 'Requerimientos y plazos del BC';

-- 7. BC Deliveries
CREATE TABLE IF NOT EXISTS public.bc_deliveries (
  id serial PRIMARY KEY,
  business_case_id uuid UNIQUE NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  delivery_type varchar(50) CHECK (delivery_type IN ('total', 'partial_time', 'partial_need')),
  effective_determination boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

COMMENT ON TABLE public.bc_deliveries IS 'Tipo de entregas del BC';
COMMENT ON COLUMN public.bc_deliveries.delivery_type IS 'Tipo: total, partial_time (parcial a tiempo), partial_need (parcial a necesidad)';

-- Create indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_bc_lab_environment_bc_id ON public.bc_lab_environment(business_case_id);
CREATE INDEX IF NOT EXISTS idx_bc_equipment_details_bc_id ON public.bc_equipment_details(business_case_id);
CREATE INDEX IF NOT EXISTS idx_bc_lis_integration_bc_id ON public.bc_lis_integration(business_case_id);
CREATE INDEX IF NOT EXISTS idx_bc_lis_equipment_interfaces_lis_id ON public.bc_lis_equipment_interfaces(lis_integration_id);
CREATE INDEX IF NOT EXISTS idx_bc_requirements_bc_id ON public.bc_requirements(business_case_id);
CREATE INDEX IF NOT EXISTS idx_bc_deliveries_bc_id ON public.bc_deliveries(business_case_id);
