-- ============================================
-- SCRIPT DE MIGRACIÓN: MODERNIZACIÓN BUSINESS CASE
-- ============================================
-- Este script crea las nuevas tablas para reemplazar Google Sheets
-- con un sistema basado en base de datos

-- ============================================
-- 1. CATÁLOGO DE EQUIPOS
-- ============================================

CREATE TABLE IF NOT EXISTS public.catalog_equipment (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL, -- 'c311', 'c501', 'c602', etc.
  name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  model VARCHAR(255),
  category VARCHAR(100), -- 'Química Clínica', 'Hematología', 'Inmunología', etc.
  
  -- Especificaciones técnicas
  capacity_per_hour INTEGER, -- Determinaciones por hora
  max_daily_capacity INTEGER, -- Capacidad máxima diaria
  installation_days INTEGER DEFAULT 7, -- Días de instalación
  training_hours INTEGER DEFAULT 16, -- Horas de capacitación
  warranty_months INTEGER DEFAULT 12,
  
  -- Costos del equipo
  base_price DECIMAL(12,2), -- Precio base del equipo
  maintenance_cost DECIMAL(12,2), -- Costo anual de mantenimiento
  
  -- Especificaciones adicionales en JSON
  technical_specs JSONB DEFAULT '{}', -- Voltaje, dimensiones, peso, etc.
  
  -- Metadatos
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'pending')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_equipment_code ON public.catalog_equipment(code);
CREATE INDEX idx_equipment_category ON public.catalog_equipment(category);
CREATE INDEX idx_equipment_status ON public.catalog_equipment(status);

COMMENT ON TABLE public.catalog_equipment IS 'Catálogo maestro de equipos que reemplaza las hojas de Excel (c311, c501, etc.)';
COMMENT ON COLUMN public.catalog_equipment.code IS 'Código único del equipo (ej: c311, c501)';
COMMENT ON COLUMN public.catalog_equipment.technical_specs IS 'Especificaciones técnicas en formato JSON flexible';

-- ============================================
-- 2. CATÁLOGO DE DETERMINACIONES/PRUEBAS
-- ============================================

CREATE TABLE IF NOT EXISTS public.catalog_determinations (
  id SERIAL PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES catalog_equipment(id) ON DELETE CASCADE,
  
  code VARCHAR(50) NOT NULL, -- Código de la prueba
  name VARCHAR(255) NOT NULL,
  
  -- Consumos técnicos (reemplazan las fórmulas de Excel)
  volume_per_test DECIMAL(10,4), -- mL de muestra por prueba
  reagent_consumption DECIMAL(10,4), -- mL de reactivo por prueba
  processing_time INTEGER, -- Tiempo en segundos
  wash_cycles INTEGER DEFAULT 0, -- Ciclos de lavado
  blank_required BOOLEAN DEFAULT false, -- Requiere blanco
  calibration_frequency INTEGER, -- Días entre calibraciones
  
  -- Costos
  cost_per_test DECIMAL(10,2), -- Costo directo por prueba
  
  -- Clasificación
  category VARCHAR(100), -- 'Química', 'Enzimas', 'Electrolitos', etc.
  subcategory VARCHAR(100),
  
  -- Metadatos
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'experimental')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(equipment_id, code)
);

CREATE INDEX idx_determinations_equipment ON public.catalog_determinations(equipment_id);
CREATE INDEX idx_determinations_category ON public.catalog_determinations(category);
CREATE INDEX idx_determinations_status ON public.catalog_determinations(status);

COMMENT ON TABLE public.catalog_determinations IS 'Catálogo de pruebas/determinaciones por equipo - reemplaza columnas de Excel';
COMMENT ON COLUMN public.catalog_determinations.volume_per_test IS 'Volumen de muestra requerido por prueba en mL';
COMMENT ON COLUMN public.catalog_determinations.reagent_consumption IS 'Consumo de reactivo por prueba en mL';

-- ============================================
-- 3. CONSUMIBLES POR EQUIPO
-- ============================================

CREATE TABLE IF NOT EXISTS public.equipment_consumables (
  id SERIAL PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES catalog_equipment(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('reactivo', 'kit', 'calibrador', 'control', 'otro')),
  
  -- Precios y rendimiento
  unit_price DECIMAL(12,2) NOT NULL,
  units_per_package INTEGER DEFAULT 1,
  yield_per_unit INTEGER, -- Determinaciones que rinde una unidad
  
  -- Control de inventario
  reorder_point INTEGER, -- Punto de reorden
  lead_time_days INTEGER, -- Días de aprovisionamiento
  
  -- Proveedor
  supplier VARCHAR(255),
  supplier_code VARCHAR(100),
  
  -- Metadatos
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consumables_equipment ON public.equipment_consumables(equipment_id);
CREATE INDEX idx_consumables_type ON public.equipment_consumables(type);

COMMENT ON TABLE public.equipment_consumables IS 'Consumibles asociados a cada equipo con precios y rendimientos';
COMMENT ON COLUMN public.equipment_consumables.yield_per_unit IS 'Número de determinaciones que rinde una unidad de consumible';

-- ============================================
-- 4. SELECCIÓN DE EQUIPO EN BUSINESS CASE
-- ============================================

CREATE TABLE IF NOT EXISTS public.bc_equipment_selection (
  id SERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL REFERENCES catalog_equipment(id),
  
  is_primary BOOLEAN DEFAULT true, -- true = equipo principal, false = backup
  
  -- Auditoría
  selected_at TIMESTAMPTZ DEFAULT now(),
  selected_by INTEGER REFERENCES users(id),
  
  UNIQUE(business_case_id, is_primary) -- Solo un equipo principal por BC
);

CREATE INDEX idx_bc_equipment_bc ON public.bc_equipment_selection(business_case_id);

COMMENT ON TABLE public.bc_equipment_selection IS 'Equipos seleccionados en cada Business Case (principal y backup)';

-- ============================================
-- 5. DETERMINACIONES SOLICITADAS EN BC
-- ============================================

CREATE TABLE IF NOT EXISTS public.bc_determinations (
  id SERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
  determination_id INTEGER NOT NULL REFERENCES catalog_determinations(id),
  
  -- Cantidad solicitada
  monthly_quantity INTEGER NOT NULL CHECK (monthly_quantity > 0),
  
  -- Cálculos automáticos (reemplazan fórmulas de Excel)
  calculated_consumption DECIMAL(12,4), -- Consumo total calculado
  calculated_cost DECIMAL(12,2), -- Costo total calculado
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  added_by INTEGER REFERENCES users(id),
  
  UNIQUE(business_case_id, determination_id)
);

CREATE INDEX idx_bc_determinations_bc ON public.bc_determinations(business_case_id);
CREATE INDEX idx_bc_determinations_det ON public.bc_determinations(determination_id);

COMMENT ON TABLE public.bc_determinations IS 'Determinaciones solicitadas en cada Business Case con cantidades y cálculos';
COMMENT ON COLUMN public.bc_determinations.calculated_consumption IS 'Consumo total calculado automáticamente por el motor';
COMMENT ON COLUMN public.bc_determinations.calculated_cost IS 'Costo total calculado automáticamente por el motor';

-- ============================================
-- 6. CÁLCULOS CONSOLIDADOS DEL BC
-- ============================================

CREATE TABLE IF NOT EXISTS public.bc_calculations (
  id SERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL UNIQUE REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
  
  -- Totales calculados
  total_monthly_tests INTEGER, -- Total de pruebas al mes
  total_reagent_consumption DECIMAL(12,4), -- Consumo total de reactivos
  total_monthly_cost DECIMAL(12,2), -- Costo mensual total
  annual_projection DECIMAL(12,2), -- Proyección anual
  
  -- Métricas del equipo
  equipment_utilization_percentage DECIMAL(5,2), -- % de uso del equipo (0-100)
  capacity_exceeded BOOLEAN DEFAULT false, -- Si se excede la capacidad
  
  -- Indicadores económicos
  cost_per_test DECIMAL(10,2), -- Costo promedio por prueba
  roi_months INTEGER, -- Retorno de inversión en meses
  break_even_date DATE, -- Fecha estimada de punto de equilibrio
  
  -- Metadatos de cálculo
  calculated_at TIMESTAMPTZ DEFAULT now(),
  calculation_version INTEGER DEFAULT 1, -- Versión del algoritmo de cálculo
  calculation_engine VARCHAR(50) DEFAULT 'v1.0'
);

CREATE INDEX idx_bc_calculations_bc ON public.bc_calculations(business_case_id);

COMMENT ON TABLE public.bc_calculations IS 'Cálculos consolidados del Business Case - reemplaza fórmulas complejas de Excel';
COMMENT ON COLUMN public.bc_calculations.equipment_utilization_percentage IS 'Porcentaje de utilización del equipo basado en capacidad máxima';
COMMENT ON COLUMN public.bc_calculations.calculation_version IS 'Versión del algoritmo, se incrementa con cada recálculo';

-- ============================================
-- 7. HISTORIAL DE PRECIOS
-- ============================================

CREATE TABLE IF NOT EXISTS public.equipment_price_history (
  id SERIAL PRIMARY KEY,
  equipment_id INTEGER REFERENCES catalog_equipment(id),
  consumable_id INTEGER REFERENCES equipment_consumables(id),
  determination_id INTEGER REFERENCES catalog_determinations(id),
  
  -- Solo uno de los anteriores debe estar lleno
  CHECK (
    (equipment_id IS NOT NULL AND consumable_id IS NULL AND determination_id IS NULL) OR
    (equipment_id IS NULL AND consumable_id IS NOT NULL AND determination_id IS NULL) OR
    (equipment_id IS NULL AND consumable_id IS NULL AND determination_id IS NOT NULL)
  ),
  
  -- Precio histórico
  price DECIMAL(12,2) NOT NULL,
  price_type VARCHAR(50) CHECK (price_type IN ('base_price', 'unit_price', 'cost_per_test', 'maintenance')),
  
  -- Vigencia
  effective_from DATE NOT NULL,
  effective_to DATE,
  
  -- Auditoría
  changed_by INTEGER REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_price_history_equipment ON public.equipment_price_history(equipment_id);
CREATE INDEX idx_price_history_consumable ON public.equipment_consumables(id);
CREATE INDEX idx_price_history_dates ON public.equipment_price_history(effective_from, effective_to);

COMMENT ON TABLE public.equipment_price_history IS 'Historial de cambios de precios para equipos, consumibles y determinaciones';

-- ============================================
-- 8. AUDITORÍA DE CAMBIOS EN BC
-- ============================================

CREATE TABLE IF NOT EXISTS public.bc_audit_log (
  id SERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
  
  action VARCHAR(100) NOT NULL, -- 'equipment_selected', 'determination_added', 'calculation_run', etc.
  entity_type VARCHAR(50), -- 'equipment', 'determination', 'calculation', etc.
  entity_id INTEGER, -- ID de la entidad modificada
  
  -- Datos del cambio
  before_value JSONB,
  after_value JSONB,
  
  -- Auditoría
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  ip_address VARCHAR(64),
  user_agent TEXT
);

CREATE INDEX idx_bc_audit_bc ON public.bc_audit_log(business_case_id);
CREATE INDEX idx_bc_audit_action ON public.bc_audit_log(action);
CREATE INDEX idx_bc_audit_date ON public.bc_audit_log(changed_at);

COMMENT ON TABLE public.bc_audit_log IS 'Registro de auditoría completo de todos los cambios en Business Cases';

-- ============================================
-- 9. AÑADIR COLUMNA A TABLA EXISTENTE
-- ============================================

-- Marcar BC como modernizado (migrado al nuevo sistema)
ALTER TABLE equipment_purchase_requests 
ADD COLUMN IF NOT EXISTS uses_modern_system BOOLEAN DEFAULT false;

COMMENT ON COLUMN equipment_purchase_requests.uses_modern_system IS 'true si usa el nuevo sistema de BD, false si usa Google Sheets legacy';

-- ============================================
-- 10. FUNCIONES AUXILIARES
-- ============================================

-- Función para obtener precio vigente
CREATE OR REPLACE FUNCTION get_current_price(
  p_equipment_id INTEGER DEFAULT NULL,
  p_consumable_id INTEGER DEFAULT NULL,
  p_determination_id INTEGER DEFAULT NULL,
  p_price_type VARCHAR DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL AS $$
DECLARE
  v_price DECIMAL(12,2);
BEGIN
  SELECT price INTO v_price
  FROM equipment_price_history
  WHERE (
    (p_equipment_id IS NOT NULL AND equipment_id = p_equipment_id) OR
    (p_consumable_id IS NOT NULL AND consumable_id = p_consumable_id) OR
    (p_determination_id IS NOT NULL AND determination_id = p_determination_id)
  )
  AND (p_price_type IS NULL OR price_type = p_price_type)
  AND effective_from <= p_date
  AND (effective_to IS NULL OR effective_to >= p_date)
  ORDER BY effective_from DESC
  LIMIT 1;
  
  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_price IS 'Obtiene el precio vigente de un equipo, consumible o determinación en una fecha específica';

-- ============================================
-- 11. VISTAS ÚTILES
-- ============================================

-- Vista: Equipos con su catálogo de determinaciones
CREATE OR REPLACE VIEW v_equipment_catalog AS
SELECT 
  e.id AS equipment_id,
  e.code AS equipment_code,
  e.name AS equipment_name,
  e.category AS equipment_category,
  COUNT(d.id) AS total_determinations,
  e.capacity_per_hour,
  e.max_daily_capacity,
  e.base_price,
  e.status
FROM catalog_equipment e
LEFT JOIN catalog_determinations d ON d.equipment_id = e.id AND d.status = 'active'
WHERE e.status = 'active'
GROUP BY e.id, e.code, e.name, e.category, e.capacity_per_hour, e.max_daily_capacity, e.base_price, e.status;

COMMENT ON VIEW v_equipment_catalog IS 'Vista consolidada de equipos con su cantidad de determinaciones disponibles';

-- Vista: Business Cases con cálculos
CREATE OR REPLACE VIEW v_business_cases_summary AS
SELECT 
  bc.id,
  bc.client_name,
  bc.status,
  bc.bc_stage,
  eq.name AS equipment_name,
  eq.code AS equipment_code,
  calc.total_monthly_tests,
  calc.total_monthly_cost,
  calc.annual_projection,
  calc.equipment_utilization_percentage,
  calc.cost_per_test,
  calc.roi_months,
  bc.created_at,
  bc.updated_at
FROM equipment_purchase_requests bc
LEFT JOIN bc_equipment_selection bes ON bes.business_case_id = bc.id AND bes.is_primary = true
LEFT JOIN catalog_equipment eq ON eq.id = bes.equipment_id
LEFT JOIN bc_calculations calc ON calc.business_case_id = bc.id
WHERE bc.uses_modern_system = true
  AND bc.request_type = 'business_case';

COMMENT ON VIEW v_business_cases_summary IS 'Vista resumen de Business Cases modernizados con sus cálculos principales';

-- ============================================
-- 12. TRIGGERS
-- ============================================

-- Trigger: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON catalog_equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_determinations_updated_at BEFORE UPDATE ON catalog_determinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bc_determinations_updated_at BEFORE UPDATE ON bc_determinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 13. DATOS DE EJEMPLO (SEED)
-- ============================================

-- Ejemplo: Equipo c311
INSERT INTO catalog_equipment (code, name, manufacturer, model, category, capacity_per_hour, max_daily_capacity, base_price, maintenance_cost, installation_days, training_hours)
VALUES ('c311', 'Cobas c311', 'Roche', 'c311', 'Química Clínica', 100, 800, 45000.00, 5000.00, 7, 16)
ON CONFLICT (code) DO NOTHING;

-- Determinaciones de ejemplo para c311
INSERT INTO catalog_determinations (equipment_id, code, name, volume_per_test, reagent_consumption, processing_time, cost_per_test, category, status)
SELECT 
  (SELECT id FROM catalog_equipment WHERE code = 'c311'),
  'GLU',
  'Glucosa',
  0.180,
  0.250,
  180,
  0.85,
  'Química',
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_determinations WHERE equipment_id = (SELECT id FROM catalog_equipment WHERE code = 'c311') AND code = 'GLU'
);

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
