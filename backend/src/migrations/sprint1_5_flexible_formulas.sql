-- ============================================
-- EXTENSIÓN SPRINT 1.5: Motor de Cálculos Flexible
-- ============================================
-- Agrega soporte para fórmulas personalizadas por equipo/determinación

-- ============================================
-- 1. EXTENDER catalog_determinations con fórmulas
-- ============================================

ALTER TABLE public.catalog_determinations
ADD COLUMN IF NOT EXISTS calculation_formula JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS formula_version VARCHAR(10) DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS formula_type VARCHAR(50) DEFAULT 'default' CHECK (formula_type IN ('default', 'custom', 'template'));

COMMENT ON COLUMN public.catalog_determinations.calculation_formula IS 'Fórmula personalizada de cálculo en formato JSON';
COMMENT ON COLUMN public.catalog_determinations.formula_version IS 'Versión de la fórmula para control de cambios';
COMMENT ON COLUMN public.catalog_determinations.formula_type IS 'default=fórmula estándar, custom=personalizada, template=basada en plantilla';

-- ============================================
-- 2. EXTENDER servicio.equipos con fórmulas por defecto
-- ============================================

ALTER TABLE servicio.equipos
ADD COLUMN IF NOT EXISTS default_calculation_formula JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS calculation_engine VARCHAR(50) DEFAULT 'standard';

COMMENT ON COLUMN servicio.equipos.default_calculation_formula IS 'Fórmula por defecto para todas las determinaciones de este equipo';
COMMENT ON COLUMN servicio.equipos.calculation_engine IS 'Motor de cálculo: standard, advanced, custom';

-- ============================================
-- 3. NUEVA TABLA: calculation_templates
-- ============================================

CREATE TABLE IF NOT EXISTS public.calculation_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  formula JSONB NOT NULL,
  category VARCHAR(100), -- 'Química', 'Hematología', etc.
  
  -- Variables requeridas
  required_variables JSONB DEFAULT '[]',
  
  -- Ejemplos de uso
  example_input JSONB,
  example_output DECIMAL(12,4),
  
  -- Metadatos
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Control de versiones
  version VARCHAR(10) DEFAULT '1.0',
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_calc_templates_category ON public.calculation_templates(category);
CREATE INDEX idx_calc_templates_active ON public.calculation_templates(is_active) WHERE is_active = true;

COMMENT ON TABLE public.calculation_templates IS 'Plantillas reutilizables de fórmulas de cálculo';
COMMENT ON COLUMN public.calculation_templates.formula IS 'Fórmula en formato JSON {type, expression, variables}';
COMMENT ON COLUMN public.calculation_templates.required_variables IS 'Array JSON con nombres de variables obligatorias';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_calculation_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_calc_templates_timestamp ON public.calculation_templates;
CREATE TRIGGER update_calc_templates_timestamp
  BEFORE UPDATE ON public.calculation_templates
  FOR EACH ROW EXECUTE FUNCTION update_calculation_templates_timestamp();

-- ============================================
-- 4. SEEDERS: Plantillas Predefinidas
-- ============================================

-- Template 1: Consumo Estándar
INSERT INTO public.calculation_templates (name, description, formula, category, required_variables, example_input, example_output)
VALUES (
  'Consumo Estándar',
  'Fórmula básica para la mayoría de determinaciones: (volumen + reactivo) * cantidad',
  '{
    "type": "expression",
    "expression": "(volume_per_test + reagent_consumption) * monthly_quantity",
    "variables": {
      "volume_per_test": {"source": "catalog_determinations.volume_per_test", "type": "decimal", "default": 0.0},
      "reagent_consumption": {"source": "catalog_determinations.reagent_consumption", "type": "decimal", "default": 0.0},
      "monthly_quantity": {"source": "bc_determinations.monthly_quantity", "type": "integer", "required": true}
    },
    "unit": "mL",
    "description": "Consumo total de reactivos"
  }'::JSONB,
  'General',
  '["volume_per_test", "reagent_consumption", "monthly_quantity"]'::JSONB,
  '{"volume_per_test": 0.180, "reagent_consumption": 0.250, "monthly_quantity": 1000}'::JSONB,
  430.00
) ON CONFLICT (name) DO NOTHING;

-- Template 2: Con Lavados
INSERT INTO public.calculation_templates (name, description, formula, category, required_variables)
VALUES (
  'Consumo con Lavados',
  'Incluye ciclos de lavado en el cálculo: (volumen + reactivo + lavados*0.5) * cantidad',
  '{
    "type": "expression",
    "expression": "(volume_per_test + reagent_consumption + (wash_cycles * 0.5)) * monthly_quantity",
    "variables": {
      "volume_per_test": {"source": "catalog_determinations.volume_per_test", "type": "decimal", "default": 0.0},
      "reagent_consumption": {"source": "catalog_determinations.reagent_consumption", "type": "decimal", "default": 0.0},
      "wash_cycles": {"source": "catalog_determinations.wash_cycles", "type": "integer", "default": 0},
      "monthly_quantity": {"source": "bc_determinations.monthly_quantity", "type": "integer", "required": true}
    },
    "unit": "mL"
  }'::JSONB,
  'Química Clínica',
  '["volume_per_test", "reagent_consumption", "wash_cycles", "monthly_quantity"]'::JSONB
) ON CONFLICT (name) DO NOTHING;

-- Template 3: Con Descuento por Volumen
INSERT INTO public.calculation_templates (name, description, formula, category)
VALUES (
  'Descuento por Volumen',
  'Aplica descuentos según cantidad: >1000 = 10%, >500 = 5%',
  '{
    "type": "conditional",
    "rules": [
      {"condition": "monthly_quantity > 1000", "formula": "((volume_per_test + reagent_consumption) * monthly_quantity) * 0.90"},
      {"condition": "monthly_quantity > 500", "formula": "((volume_per_test + reagent_consumption) * monthly_quantity) * 0.95"},
      {"condition": "true", "formula": "(volume_per_test + reagent_consumption) * monthly_quantity"}
    ],
    "variables": {
      "volume_per_test": {"source": "catalog_determinations.volume_per_test", "type": "decimal"},
      "reagent_consumption": {"source": "catalog_determinations.reagent_consumption", "type": "decimal"},
      "monthly_quantity": {"source": "bc_determinations.monthly_quantity", "type": "integer"}
    },
    "unit": "mL"
  }'::JSONB,
  'Química Clínica'
) ON CONFLICT (name) DO NOTHING;

-- Template 4: Con Factor de Seguridad
INSERT INTO public.calculation_templates (name, description, formula, category)
VALUES (
  'Con Factor de Seguridad 10%',
  'Añade 10% de margen de seguridad al consumo calculado',
  '{
    "type": "expression",
    "expression": "((volume_per_test + reagent_consumption) * monthly_quantity) * 1.10",
    "variables": {
      "volume_per_test": {"source": "catalog_determinations.volume_per_test", "type": "decimal"},
      "reagent_consumption": {"source": "catalog_determinations.reagent_consumption", "type": "decimal"},
      "monthly_quantity": {"source": "bc_determinations.monthly_quantity", "type": "integer"}
    },
    "unit": "mL"
  }'::JSONB,
  'General'
) ON CONFLICT (name) DO NOTHING;

-- Template 5: Pipeline Complejo
INSERT INTO public.calculation_templates (name, description, formula, category)
VALUES (
  'Cálculo en Pipeline',
  'Cálculo paso a paso con factores intermedios',
  '{
    "type": "pipeline",
    "steps": [
      {
        "name": "calcular_base",
        "formula": "volume_per_test * monthly_quantity",
        "output": "consumo_base"
      },
      {
        "name": "agregar_reactivo",
        "formula": "consumo_base + (reagent_consumption * monthly_quantity)",
        "output": "consumo_con_reactivo"
      },
      {
        "name": "agregar_lavados",
        "formula": "consumo_con_reactivo + (wash_cycles * 0.5 * monthly_quantity)",
        "output": "consumo_total"
      },
      {
        "name": "aplicar_factor_seguridad",
        "formula": "consumo_total * 1.1",
        "output": "consumo_final"
      }
    ],
    "final_output": "consumo_final",
    "variables": {
      "volume_per_test": {"source": "catalog_determinations.volume_per_test"},
      "reagent_consumption": {"source": "catalog_determinations.reagent_consumption"},
      "wash_cycles": {"source": "catalog_determinations.wash_cycles", "default": 0},
      "monthly_quantity": {"source": "bc_determinations.monthly_quantity"}
    }
  }'::JSONB,
  'Avanzado'
) ON CONFLICT (name) DO NOTHING;

-- Template 6: Costo Estándar
INSERT INTO public.calculation_templates (name, description, formula, category)
VALUES (
  'Costo Estándar',
  'Cálculo simple de costo: costo_unitario * cantidad',
  '{
    "type": "expression",
    "expression": "cost_per_test * monthly_quantity",
    "variables": {
      "cost_per_test": {"source": "catalog_determinations.cost_per_test", "type": "decimal", "required": true},
      "monthly_quantity": {"source": "bc_determinations.monthly_quantity", "type": "integer", "required": true}
    },
    "unit": "USD"
  }'::JSONB,
  'General'
) ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 5. VISTAS ÚTILES
-- ============================================

-- Vista: Determinaciones con sus fórmulas
CREATE OR REPLACE VIEW v_determinations_with_formulas AS
SELECT 
  d.id,
  d.name,
  d.roche_code,
  d.category,
  d.equipment_id,
  e.nombre AS equipment_name,
  e.code AS equipment_code,
  d.formula_type,
  d.calculation_formula,
  CASE 
    WHEN d.calculation_formula IS NOT NULL THEN 'Personalizada'
    WHEN e.default_calculation_formula IS NOT NULL THEN 'Del Equipo'
    ELSE 'Por Defecto'
  END AS formula_source,
  d.volume_per_test,
  d.reagent_consumption,
  d.processing_time,
  d.cost_per_test,
  d.status
FROM catalog_determinations d
LEFT JOIN servicio.equipos e ON e.id_equipo = d.equipment_id
WHERE d.status = 'active';

COMMENT ON VIEW v_determinations_with_formulas IS 'Vista de determinaciones mostrando origen de su fórmula de cálculo';

-- ============================================
-- FIN DE LA EXTENSIÓN
-- ============================================

-- RESUMEN:
-- ✅ Columnas agregadas a catalog_determinations (calculation_formula, formula_version, formula_type)
-- ✅ Columnas agregadas a servicio.equipos (default_calculation_formula, calculation_engine)
-- ✅ Tabla calculation_templates creada
-- ✅ 6 plantillas predefinidas insertadas
-- ✅ Vista v_determinations_with_formulas creada
