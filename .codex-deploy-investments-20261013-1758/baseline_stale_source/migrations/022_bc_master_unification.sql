-- Migration 022: BC Master Unification
-- Creates unified BC system with central bc_master table and domain separation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PART 1: CENTRAL BC_MASTER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bc_master (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identificación
  bc_number varchar(50) UNIQUE,
  client_id integer,
  client_name varchar(255),
  
  -- Tipo y Configuración
  bc_type varchar(50) CHECK (bc_type IN ('comodato_publico', 'comodato_privado')),
  duration_years integer CHECK (duration_years >= 1 AND duration_years <= 10),
  target_margin_percentage numeric(5,2) CHECK (target_margin_percentage >= 0 AND target_margin_percentage <= 100),
  
  -- Campos específicos para público
  process_code varchar(255),
  contract_object text,
  
  -- Estado del Workflow
  current_stage varchar(50) DEFAULT 'draft' CHECK (current_stage IN (
    'draft',
    'pending_economic_approval',
    'pending_operational_data',
    'pending_recalculation',
    'pending_technical_review',
    'pending_manager_approval',
    'approved',
    'rejected'
  )),
  
  -- Completitud por módulo
  economic_data_complete boolean DEFAULT false,
  operational_data_complete boolean DEFAULT false,
  lis_data_complete boolean DEFAULT false,
  delivery_plan_complete boolean DEFAULT false,
  
  -- Métricas Económicas (calculadas automáticamente)
  calculated_roi_percentage numeric(10,2),
  calculated_payback_months numeric(10,2),
  calculated_monthly_margin numeric(12,2),
  calculated_annual_margin numeric(12,2),
  calculated_monthly_revenue numeric(12,2),
  calculated_annual_revenue numeric(12,2),
  calculated_monthly_cost numeric(12,2),
  calculated_annual_cost numeric(12,2),
  total_investment numeric(12,2),
  equipment_investment numeric(12,2),
  
  -- Validaciones y Riesgos
  has_inconsistencies boolean DEFAULT false,
  inconsistency_details jsonb,
  risk_level varchar(20) CHECK (risk_level IN ('low', 'medium', 'high')),
  
  -- Auditoría
  created_by varchar(255),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  approved_by varchar(255),
  approved_at timestamp,
  rejected_by varchar(255),
  rejected_at timestamp,
  rejection_reason text
);

COMMENT ON TABLE public.bc_master IS 'Tabla central del Business Case unificado - Orquesta todos los módulos';
COMMENT ON COLUMN public.bc_master.bc_number IS 'Número único del BC (ej: BC-2024-001)';
COMMENT ON COLUMN public.bc_master.current_stage IS 'Estado actual en el workflow del BC';
COMMENT ON COLUMN public.bc_master.risk_level IS 'Nivel de riesgo calculado: low, medium, high';

-- ============================================================================
-- PART 2: DOMAIN - ECONOMICS (Datos Económicos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bc_economic_data (
  id serial PRIMARY KEY,
  bc_master_id uuid UNIQUE NOT NULL REFERENCES public.bc_master(id) ON DELETE CASCADE,
  
  -- Equipo Principal
  equipment_id integer,
  equipment_name varchar(255),
  equipment_cost numeric(12,2),
  
  -- Configuración de Cálculo
  calculation_mode varchar(20) DEFAULT 'annual' CHECK (calculation_mode IN ('monthly', 'annual')),
  show_roi boolean DEFAULT true,
  show_margin boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

COMMENT ON TABLE public.bc_economic_data IS 'Dominio Economics - Datos económicos del BC';

-- Determinaciones (ya existe, solo agregamos referencia a bc_master)
ALTER TABLE public.bc_determinations 
ADD COLUMN IF NOT EXISTS bc_master_id uuid REFERENCES public.bc_master(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bc_determinations_master ON public.bc_determinations(bc_master_id);

-- Inversiones (ya existe, solo agregamos referencia a bc_master)
ALTER TABLE public.bc_investments
ADD COLUMN IF NOT EXISTS bc_master_id uuid REFERENCES public.bc_master(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bc_investments_master ON public.bc_investments(bc_master_id);

-- ============================================================================
-- PART 3: DOMAIN - OPERATIONS (Datos Operativos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bc_operational_data (
  id serial PRIMARY KEY,
  bc_master_id uuid UNIQUE NOT NULL REFERENCES public.bc_master(id) ON DELETE CASCADE,
  
  -- Ambiente de Laboratorio
  work_days_per_week integer CHECK (work_days_per_week >= 1 AND work_days_per_week <= 7),
  shifts_per_day integer CHECK (shifts_per_day >= 1),
  hours_per_shift numeric(4,2) CHECK (hours_per_shift > 0),
  quality_controls_per_shift integer CHECK (quality_controls_per_shift >= 0),
  control_levels integer CHECK (control_levels >= 0),
  routine_qc_frequency varchar(100),
  special_tests text,
  special_qc_frequency varchar(100),
  
  -- Equipamiento Detallado
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
  
  -- Requerimientos
  deadline_months integer CHECK (deadline_months > 0),
  projected_deadline_months integer CHECK (projected_deadline_months > 0),
  
  -- Entregas
  delivery_type varchar(50) CHECK (delivery_type IN ('total', 'partial_time', 'partial_need')),
  effective_determination boolean DEFAULT false,
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

COMMENT ON TABLE public.bc_operational_data IS 'Dominio Operations - Datos operativos del cliente (ambiente + equipamiento + requerimientos + entregas)';

-- ============================================================================
-- PART 4: DOMAIN - LIS INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bc_lis_data (
  id serial PRIMARY KEY,
  bc_master_id uuid UNIQUE NOT NULL REFERENCES public.bc_master(id) ON DELETE CASCADE,
  
  -- Configuración LIS
  includes_lis boolean DEFAULT false,
  lis_provider varchar(100) CHECK (lis_provider IN ('orion', 'cobas_infiniti', 'other')),
  includes_hardware boolean DEFAULT false,
  monthly_patients integer CHECK (monthly_patients >= 0),
  
  -- Sistema Actual del Cliente
  current_system_name varchar(255),
  current_system_provider varchar(255),
  current_system_hardware boolean DEFAULT false,
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

COMMENT ON TABLE public.bc_lis_data IS 'Dominio LIS - Integración con sistemas de información de laboratorio';

-- bc_lis_equipment_interfaces ya existe de migración 021
-- Solo necesitamos agregar la referencia a bc_lis_data si no existe
DO $$
BEGIN
  -- Verificar si la columna bc_lis_data_id ya existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bc_lis_equipment_interfaces' 
    AND column_name = 'bc_lis_data_id'
  ) THEN
    -- Si existe lis_integration_id, renombrarla
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'bc_lis_equipment_interfaces' 
      AND column_name = 'lis_integration_id'
    ) THEN
      ALTER TABLE bc_lis_equipment_interfaces 
      RENAME COLUMN lis_integration_id TO bc_lis_data_id;
    ELSE
      -- Si no existe ninguna, agregar bc_lis_data_id
      ALTER TABLE bc_lis_equipment_interfaces 
      ADD COLUMN bc_lis_data_id integer REFERENCES bc_lis_data(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE public.bc_lis_equipment_interfaces IS 'Interfaces de equipos para integración LIS';

-- ============================================================================
-- PART 5: DOMAIN - GOVERNANCE (Workflow y Validaciones)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bc_workflow_history (
  id serial PRIMARY KEY,
  bc_master_id uuid NOT NULL REFERENCES public.bc_master(id) ON DELETE CASCADE,
  from_stage varchar(50),
  to_stage varchar(50),
  changed_by varchar(255),
  changed_at timestamp DEFAULT now(),
  notes text
);

COMMENT ON TABLE public.bc_workflow_history IS 'Historial de cambios de estado del BC';

CREATE TABLE IF NOT EXISTS public.bc_validations (
  id serial PRIMARY KEY,
  bc_master_id uuid NOT NULL REFERENCES public.bc_master(id) ON DELETE CASCADE,
  validation_type varchar(50), -- 'coherence', 'capacity', 'cost', 'roi', 'operational'
  severity varchar(20) CHECK (severity IN ('info', 'warning', 'error')),
  message text,
  details jsonb,
  resolved boolean DEFAULT false,
  resolved_at timestamp,
  resolved_by varchar(255),
  created_at timestamp DEFAULT now()
);

COMMENT ON TABLE public.bc_validations IS 'Validaciones y alertas del BC';

-- ============================================================================
-- PART 6: TRIGGERS FOR AUTO-RECALCULATION
-- ============================================================================

-- Función para marcar BC para recálculo
CREATE OR REPLACE FUNCTION trigger_mark_for_recalculation()
RETURNS TRIGGER AS $$
DECLARE
  v_bc_master_id uuid;
BEGIN
  -- Obtener bc_master_id según la operación
  IF TG_OP = 'DELETE' THEN
    v_bc_master_id := OLD.bc_master_id;
  ELSE
    v_bc_master_id := NEW.bc_master_id;
  END IF;
  
  -- Solo marcar si no está en estados finales
  IF v_bc_master_id IS NOT NULL THEN
    UPDATE bc_master 
    SET current_stage = 'pending_recalculation',
        updated_at = now()
    WHERE id = v_bc_master_id
      AND current_stage NOT IN ('approved', 'rejected', 'draft');
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger en determinaciones
DROP TRIGGER IF EXISTS recalculate_on_determination_change ON bc_determinations;
CREATE TRIGGER recalculate_on_determination_change
AFTER INSERT OR UPDATE OR DELETE ON bc_determinations
FOR EACH ROW 
EXECUTE FUNCTION trigger_mark_for_recalculation();

-- Trigger en inversiones
DROP TRIGGER IF EXISTS recalculate_on_investment_change ON bc_investments;
CREATE TRIGGER recalculate_on_investment_change
AFTER INSERT OR UPDATE OR DELETE ON bc_investments
FOR EACH ROW
EXECUTE FUNCTION trigger_mark_for_recalculation();

-- Trigger en datos operativos
DROP TRIGGER IF EXISTS recalculate_on_operational_change ON bc_operational_data;
CREATE TRIGGER recalculate_on_operational_change
AFTER UPDATE ON bc_operational_data
FOR EACH ROW
EXECUTE FUNCTION trigger_mark_for_recalculation();

-- Trigger en datos económicos
DROP TRIGGER IF EXISTS recalculate_on_economic_change ON bc_economic_data;
CREATE TRIGGER recalculate_on_economic_change
AFTER UPDATE ON bc_economic_data
FOR EACH ROW
EXECUTE FUNCTION trigger_mark_for_recalculation();

-- ============================================================================
-- PART 7: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bc_master_stage ON public.bc_master(current_stage);
CREATE INDEX IF NOT EXISTS idx_bc_master_client ON public.bc_master(client_id);
CREATE INDEX IF NOT EXISTS idx_bc_master_type ON public.bc_master(bc_type);
CREATE INDEX IF NOT EXISTS idx_bc_master_created ON public.bc_master(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bc_economic_data_master ON public.bc_economic_data(bc_master_id);
CREATE INDEX IF NOT EXISTS idx_bc_operational_data_master ON public.bc_operational_data(bc_master_id);
CREATE INDEX IF NOT EXISTS idx_bc_lis_data_master ON public.bc_lis_data(bc_master_id);
CREATE INDEX IF NOT EXISTS idx_bc_workflow_history_master ON public.bc_workflow_history(bc_master_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bc_validations_master ON public.bc_validations(bc_master_id, severity);
CREATE INDEX IF NOT EXISTS idx_bc_lis_interfaces_lis ON public.bc_lis_equipment_interfaces(bc_lis_data_id);

-- ============================================================================
-- PART 8: SEQUENCE FOR BC_NUMBER
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS bc_number_seq START 1;

-- Función para generar BC_NUMBER automáticamente
CREATE OR REPLACE FUNCTION generate_bc_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bc_number IS NULL THEN
    NEW.bc_number := 'BC-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('bc_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_bc_number
BEFORE INSERT ON bc_master
FOR EACH ROW
EXECUTE FUNCTION generate_bc_number();

-- ============================================================================
-- PART 9: VIEWS FOR EASY QUERYING
-- ============================================================================

CREATE OR REPLACE VIEW v_bc_complete AS
SELECT 
  m.*,
  e.equipment_id,
  e.equipment_name,
  e.equipment_cost,
  e.calculation_mode,
  o.work_days_per_week,
  o.shifts_per_day,
  o.hours_per_shift,
  o.installation_location,
  o.delivery_type,
  l.includes_lis,
  l.lis_provider,
  l.monthly_patients,
  (SELECT COUNT(*) FROM bc_determinations WHERE bc_master_id = m.id) as determination_count,
  (SELECT COUNT(*) FROM bc_investments WHERE bc_master_id = m.id) as investment_count,
  (SELECT COUNT(*) FROM bc_validations WHERE bc_master_id = m.id AND severity = 'error' AND NOT resolved) as error_count,
  (SELECT COUNT(*) FROM bc_validations WHERE bc_master_id = m.id AND severity = 'warning' AND NOT resolved) as warning_count
FROM bc_master m
LEFT JOIN bc_economic_data e ON e.bc_master_id = m.id
LEFT JOIN bc_operational_data o ON o.bc_master_id = m.id
LEFT JOIN bc_lis_data l ON l.bc_master_id = m.id;

COMMENT ON VIEW v_bc_complete IS 'Vista completa del BC con todos los módulos';
