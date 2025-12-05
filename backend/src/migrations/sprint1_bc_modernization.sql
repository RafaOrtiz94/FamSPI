-- ============================================
-- SPRINT 1: MODERNIZACIÓN BUSINESS CASE
-- BASE DE DATOS Y MIGRACIÓN
-- ============================================
-- Análisis: Revisado 04122025nocli.sql
-- Tablas EXISTENTES que REUTILIZAREMOS:
--   ✅ catalog_determinations (id, name, roche_code, category, equipment_id)
--   ✅ catalog_consumables (id, name, type, units_per_kit, unit_price)
--   ✅ catalog_equipment_consumables (relación equipos-consumibles)
--   ✅ catalog_investments (inversiones adicionales - YA IMPLEMENTADO)
--   ✅ servicio.equipos (catálogo de equipos del servicio técnico)
--
-- Tablas que FALTAN y CREAREMOS:
--   ❌ Tabla de equipos del Business Case (diferente de servicio.equipos)
--   ❌ bc_equipment_selection (selección de equipos en BC)
--   ❌ bc_determinations (determinaciones solicitadas en BC)
--   ❌ bc_calculations (cálculos consolidados del BC)
--   ❌ equipment_price_history (historial de precios)
--   ❌ bc_audit_log (auditoría de cambios en BC)
-- ============================================

-- ============================================
-- 1. EXTENDER TABLA EXISTENTE: catalog_determinations
-- ============================================

-- Agregar campos para cálculos automáticos (reemplazan Excel)
ALTER TABLE public.catalog_determinations
ADD COLUMN IF NOT EXISTS volume_per_test DECIMAL(10,4), -- mL de muestra por prueba
ADD COLUMN IF NOT EXISTS reagent_consumption DECIMAL(10,4), -- mL de reactivo por prueba
ADD COLUMN IF NOT EXISTS processing_time INTEGER, -- Tiempo en segundos
ADD COLUMN IF NOT EXISTS wash_cycles INTEGER DEFAULT 0, -- Ciclos de lavado
ADD COLUMN IF NOT EXISTS blank_required BOOLEAN DEFAULT false, -- Requiere blanco
ADD COLUMN IF NOT EXISTS calibration_frequency INTEGER, -- Días entre calibraciones
ADD COLUMN IF NOT EXISTS cost_per_test DECIMAL(10,2), -- Costo directo por prueba
ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100); -- Subcategoría

COMMENT ON COLUMN public.catalog_determinations.volume_per_test IS 'Volumen de muestra requerido por prueba en mL';
COMMENT ON COLUMN public.catalog_determinations.reagent_consumption IS 'Consumo de reactivo por prueba en mL - reemplaza fórmulas Excel';
COMMENT ON COLUMN public.catalog_determinations.processing_time IS 'Tiempo de procesamiento en segundos';
COMMENT ON COLUMN public.catalog_determinations.cost_per_test IS 'Costo directo por prueba calculado';

-- ============================================
-- 2. EXTENDER TABLA EXISTENTE: servicio.equipos
-- ============================================

-- Agregar campos para Business Case (capacidades, costos, tiempos)
ALTER TABLE servicio.equipos
ADD COLUMN IF NOT EXISTS code VARCHAR(50), -- 'c311', 'c501', etc.
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255), -- Fabricante
ADD COLUMN IF NOT EXISTS category_type VARCHAR(100), -- 'Química Clínica', 'Hematología'
ADD COLUMN IF NOT EXISTS capacity_per_hour INTEGER, -- Determinaciones por hora
ADD COLUMN IF NOT EXISTS max_daily_capacity INTEGER, -- Capacidad máxima diaria
ADD COLUMN IF NOT EXISTS installation_days INTEGER DEFAULT 7, -- Días de instalación
ADD COLUMN IF NOT EXISTS training_hours INTEGER DEFAULT 16, -- Horas de capacitación
ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 12, -- Meses de garantía
ADD COLUMN IF NOT EXISTS base_price DECIMAL(12,2), -- Precio base del equipo
ADD COLUMN IF NOT EXISTS maintenance_cost DECIMAL(12,2), -- Costo anual de mantenimiento
ADD COLUMN IF NOT EXISTS technical_specs JSONB DEFAULT '{}', -- Especificaciones en JSON
ADD COLUMN IF NOT EXISTS notes TEXT, -- Notas adicionales
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id), -- Quién lo creó
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id); -- Quién lo actualizó

-- Crear UNIQUE constraint por separado (solo si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'servicio_equipos_code_unique'
    ) THEN
        ALTER TABLE servicio.equipos ADD CONSTRAINT servicio_equipos_code_unique UNIQUE(code);
    END IF;
END $$;


-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_equipos_code ON servicio.equipos(code);
CREATE INDEX IF NOT EXISTS idx_equipos_category ON servicio.equipos(category_type);
CREATE INDEX IF NOT EXISTS idx_equipos_estado ON servicio.equipos(estado);

COMMENT ON COLUMN servicio.equipos.code IS 'Código único del equipo (ej: c311, c501) - corresponde a hojas de Excel';
COMMENT ON COLUMN servicio.equipos.capacity_per_hour IS 'Determinaciones que puede procesar por hora';
COMMENT ON COLUMN servicio.equipos.max_daily_capacity IS 'Capacidad máxima de determinaciones por día';
COMMENT ON COLUMN servicio.equipos.technical_specs IS 'Especificaciones técnicas en JSON flexible (voltaje, dimensiones, etc.)';

-- ============================================
-- 3. EXTENDER TABLA EXISTENTE: catalog_consumables
-- ============================================

-- Agregar campos para control de inventario y proveedores
ALTER TABLE public.catalog_consumables
ADD COLUMN IF NOT EXISTS yield_per_unit INTEGER, -- Determinaciones que rinde una unidad
ADD COLUMN IF NOT EXISTS reorder_point INTEGER, -- Punto de reorden
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER, -- Días de aprovisionamiento
ADD COLUMN IF NOT EXISTS supplier VARCHAR(255), -- Proveedor
ADD COLUMN IF NOT EXISTS supplier_code VARCHAR(100); -- Código del proveedor

COMMENT ON COLUMN public.catalog_consumables.yield_per_unit IS 'Número de determinaciones que rinde una unidad de consumible';
COMMENT ON COLUMN public.catalog_consumables.reorder_point IS 'Punto de reorden para inventario';

-- ============================================
-- 4. NUEVA TABLA: bc_equipment_selection
-- ============================================

CREATE TABLE IF NOT EXISTS public.bc_equipment_selection (
  id SERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL, -- Referencia a la solicitud
  equipment_id INTEGER NOT NULL REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE,
  
  is_primary BOOLEAN DEFAULT true, -- true = equipo principal, false = backup
  
  -- Auditoría
  selected_at TIMESTAMPTZ DEFAULT now(),
  selected_by INTEGER REFERENCES users(id),
  
  UNIQUE(business_case_id, is_primary) -- Solo un equipo principal por BC
);

CREATE INDEX idx_bc_equipment_bc ON public.bc_equipment_selection(business_case_id);
CREATE INDEX idx_bc_equipment_equip ON public.bc_equipment_selection(equipment_id);

COMMENT ON TABLE public.bc_equipment_selection IS 'Equipos seleccionados en cada Business Case (principal y backup)';
COMMENT ON COLUMN public.bc_equipment_selection.is_primary IS 'true = equipo principal, false = equipo de respaldo';

-- ============================================
-- 5. NUEVA TABLA: bc_determinations
-- ============================================

CREATE TABLE IF NOT EXISTS public.bc_determinations (
  id SERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL, -- Referencia a la solicitud
  determination_id INTEGER NOT NULL REFERENCES catalog_determinations(id) ON DELETE CASCADE,
  
  -- Cantidad solicitada por el usuario
  monthly_quantity INTEGER NOT NULL CHECK (monthly_quantity > 0),
  
  -- Cálculos automáticos (motor de cálculos - reemplazan Excel)
  calculated_consumption DECIMAL(12,4), -- Consumo total de reactivos
  calculated_cost DECIMAL(12,2), -- Costo total calculado
  calculation_details JSONB DEFAULT '{}', -- Detalles del cálculo en JSON
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  added_by INTEGER REFERENCES users(id),
  
  UNIQUE(business_case_id, determination_id)
);

CREATE INDEX idx_bc_determinations_bc ON public.bc_determinations(business_case_id);
CREATE INDEX idx_bc_determinations_det ON public.bc_determinations(determination_id);

COMMENT ON TABLE public.bc_determinations IS 'Determinaciones solicitadas en cada Business Case con cantidades y cálculosautomáticos';
COMMENT ON COLUMN public.bc_determinations.monthly_quantity IS 'Cantidad mensual solicitada por el cliente';
COMMENT ON COLUMN public.bc_determinations.calculated_consumption IS 'Consumo total de reactivos calculado automáticamente';
COMMENT ON COLUMN public.bc_determinations.calculated_cost IS 'Costo total calculado automáticamente por el motor';
COMMENT ON COLUMN public.bc_determinations.calculation_details IS 'JSON con detalles del cálculo (fórmulas, factores, etc.)';

-- ============================================
-- 6. NUEVA TABLA: bc_calculations
-- ============================================

CREATE TABLE IF NOT EXISTS public.bc_calculations (
  id SERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL UNIQUE, -- Una sola fila por BC
  
  -- Totales calculados (sumas de bc_determinations)
  total_monthly_tests INTEGER DEFAULT 0, -- Total de pruebas al mes
  total_reagent_consumption DECIMAL(12,4) DEFAULT 0, -- Consumo total de reactivos
  total_monthly_cost DECIMAL(12,2) DEFAULT 0, -- Costo mensual total
  annual_projection DECIMAL(12,2) DEFAULT 0, -- Proyección anual (x12)
  
  -- Métricas del equipo
  equipment_utilization_percentage DECIMAL(5,2) DEFAULT 0, -- % de uso del equipo (0-100)
  capacity_exceeded BOOLEAN DEFAULT false, -- Si se excede la capacidad
  underutilized BOOLEAN DEFAULT false, -- Si está subutilizado (<30%)
  
  -- Indicadores económicos
  cost_per_test DECIMAL(10,2) DEFAULT 0, -- Costo promedio por prueba
  roi_months INTEGER, -- Retorno de inversión en meses (si aplica)
  break_even_date DATE, -- Fecha estimada de punto de equilibrio
  
  -- Alertas y recomendaciones
  warnings JSONB DEFAULT '[]', -- Array de advertencias
  recommendations JSONB DEFAULT '[]', -- Array de recomendaciones
  
  -- Metadatos de cálculo
  calculated_at TIMESTAMPTZ DEFAULT now(),
  calculation_version INTEGER DEFAULT 1, -- Se incrementa con cada recálculo
  calculation_engine VARCHAR(50) DEFAULT 'v1.0' -- Versión del motor de cálculo
);

CREATE INDEX idx_bc_calculations_bc ON public.bc_calculations(business_case_id);

COMMENT ON TABLE public.bc_calculations IS 'Cálculos consolidados del Business Case - reemplaza todas las fórmulas de Excel';
COMMENT ON COLUMN public.bc_calculations.equipment_utilization_percentage IS '% de utilización del equipo basado en capacidad máxima';
COMMENT ON COLUMN public.bc_calculations.calculation_version IS 'Versión del cálculo, se incrementa cada vez que se recalcula';
COMMENT ON COLUMN public.bc_calculations.warnings IS 'JSON array con advertencias (ej: capacidad excedida, bajo uso)';
COMMENT ON COLUMN public.bc_calculations.recommendations IS 'JSON array con recomendaciones automáticas';

-- ============================================
-- 7. NUEVA TABLA: equipment_price_history
-- ============================================

CREATE TABLE IF NOT EXISTS public.equipment_price_history (
  id SERIAL PRIMARY KEY,
  
  -- Solo uno de estos debe estar lleno
  equipment_id INTEGER REFERENCES servicio.equipos(id_equipo),
  consumable_id INTEGER REFERENCES catalog_consumables(id),
  determination_id INTEGER REFERENCES catalog_determinations(id),
  
  CHECK (
    (equipment_id IS NOT NULL AND consumable_id IS NULL AND determination_id IS NULL) OR
    (equipment_id IS NULL AND consumable_id IS NOT NULL AND determination_id IS NULL) OR
    (equipment_id IS NULL AND consumable_id IS NULL AND determination_id IS NOT NULL)
  ),
  
  -- Precio histórico
  price DECIMAL(12,2) NOT NULL,
  price_type VARCHAR(50) NOT NULL CHECK (price_type IN ('base_price', 'unit_price', 'cost_per_test', 'maintenance')),
  
  -- Vigencia
  effective_from DATE NOT NULL,
  effective_to DATE,
  
  -- Auditoría
  changed_by INTEGER REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_price_history_equipment ON public.equipment_price_history(equipment_id) WHERE equipment_id IS NOT NULL;
CREATE INDEX idx_price_history_consumable ON public.equipment_price_history(consumable_id) WHERE consumable_id IS NOT NULL;
CREATE INDEX idx_price_history_dates ON public.equipment_price_history(effective_from, effective_to);

COMMENT ON TABLE public.equipment_price_history IS 'Historial completo de cambios de precios para trazabilidad';
COMMENT ON COLUMN public.equipment_price_history.price_type IS 'Tipo de precio: base_price, unit_price, cost_per_test, maintenance';

-- ============================================
-- 8. NUEVA TABLA: bc_audit_log
-- ============================================

CREATE TABLE IF NOT EXISTS public.bc_audit_log (
  id SERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL, -- Referencia a la solicitud
  
  action VARCHAR(100) NOT NULL, -- 'equipment_selected', 'determination_added', 'calculation_run'
  entity_type VARCHAR(50), -- 'equipment', 'determination', 'calculation'
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

COMMENT ON TABLE public.bc_audit_log IS 'Registro completo de auditoría de todos los cambios en Business Cases';
COMMENT ON COLUMN public.bc_audit_log.action IS 'Acción realizada: equipment_selected, determination_added, calculation_run, etc.';

-- ============================================
-- 9. FUNCIÓN: Obtener precio vigente
-- ============================================

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
  -- Buscar en historial primero
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
  
  -- Si no hay en historial, buscar en tablas actuales
  IF v_price IS NULL THEN
    IF p_equipment_id IS NOT NULL THEN
      SELECT base_price INTO v_price FROM servicio.equipos WHERE id_equipo = p_equipment_id;
    ELSIF p_consumable_id IS NOT NULL THEN
      SELECT unit_price INTO v_price FROM catalog_consumables WHERE id = p_consumable_id;
    ELSIF p_determination_id IS NOT NULL THEN
      SELECT cost_per_test INTO v_price FROM catalog_determinations WHERE id = p_determination_id;
    END IF;
  END IF;
  
  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_price IS 'Obtiene el precio vigente de un equipo, consumible o determinación en una fecha específica';

-- ============================================
-- 10. FUNCIÓN: Trigger para auditoría automática
-- ============================================

CREATE OR REPLACE FUNCTION bc_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bc_audit_log (
    business_case_id,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    changed_by
  ) VALUES (
    COALESCE(NEW.business_case_id, OLD.business_case_id),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    row_to_json(OLD),
    row_to_json(NEW),
    COALESCE(NEW.added_by, NEW.selected_by, NEW.changed_by)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas relevantes
DROP TRIGGER IF EXISTS bc_equipment_audit ON public.bc_equipment_selection;
CREATE TRIGGER bc_equipment_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.bc_equipment_selection
  FOR EACH ROW EXECUTE FUNCTION bc_audit_trigger();

DROP TRIGGER IF EXISTS bc_determinations_audit ON public.bc_determinations;
CREATE TRIGGER bc_determinations_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.bc_determinations
  FOR EACH ROW EXECUTE FUNCTION bc_audit_trigger();

-- ============================================
-- 11. VISTAS ÚTILES
-- ============================================

-- Vista: Equipos con sus determinaciones disponibles
CREATE OR REPLACE VIEW v_equipment_full_catalog AS
SELECT 
  e.id_equipo AS equipment_id,
  e.code AS equipment_code,
  e.nombre AS equipment_name,
  e.fabricante AS manufacturer,
  e.modelo AS model,
  e.category_type AS category,
  e.capacity_per_hour,
  e.max_daily_capacity,
  e.base_price,
  e.estado AS status,
  COUNT(DISTINCT d.id) AS total_determinations,
  COUNT(DISTINCT c.id) AS total_consumables
FROM servicio.equipos e
LEFT JOIN catalog_determinations d ON d.equipment_id = e.id_equipo AND d.status = 'active'
LEFT JOIN catalog_equipment_consumables ec ON ec.equipment_id = e.id_equipo
LEFT JOIN catalog_consumables c ON c.id = ec.consumable_id AND c.status = 'active'
WHERE e.estado = 'operativo'
GROUP BY e.id_equipo, e.code, e.nombre, e.fabricante, e.modelo, e.category_type, 
         e.capacity_per_hour, e.max_daily_capacity, e.base_price, e.estado;

COMMENT ON VIEW v_equipment_full_catalog IS 'Vista consolidada de equipos con conteo de determinaciones y consumibles disponibles';

-- Vista: Business Cases modernizados con sus cálculos
CREATE OR REPLACE VIEW v_business_cases_modern AS
SELECT 
  bes.business_case_id,
  eq.code AS equipment_code,
  eq.nombre AS equipment_name,
  eq.fabricante AS manufacturer,
  calc.total_monthly_tests,
  calc.total_monthly_cost,
  calc.annual_projection,
  calc.equipment_utilization_percentage,
  calc.cost_per_test,
  calc.roi_months,
  calc.capacity_exceeded,
  calc.underutilized,
  calc.calculated_at,
  COUNT(DISTINCT bd.id) AS total_determinations_requested
FROM bc_equipment_selection bes
JOIN servicio.equipos eq ON eq.id_equipo = bes.equipment_id
LEFT JOIN bc_calculations calc ON calc.business_case_id = bes.business_case_id
LEFT JOIN bc_determinations bd ON bd.business_case_id = bes.business_case_id
WHERE bes.is_primary = true
GROUP BY bes.business_case_id, eq.code, eq.nombre, eq.fabricante,
         calc.total_monthly_tests, calc.total_monthly_cost, calc.annual_projection,
         calc.equipment_utilization_percentage, calc.cost_per_test, calc.roi_months,
         calc.capacity_exceeded, calc.underutilized, calc.calculated_at;

COMMENT ON VIEW v_business_cases_modern IS 'Vista resumen de Business Cases modernizados con cálculos automáticos';

-- ============================================
-- 12. DATOS DE EJEMPLO (SEED) - COMENTADO
-- ============================================
-- Los datos de ejemplo se agregarán manualmente después de la migración
-- para evitar errores por duplicados

/*
-- Ejemplo: Equipo c311 (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM servicio.equipos WHERE nombre = 'Cobas c311') THEN
    INSERT INTO servicio.equipos (nombre, code, fabricante, modelo, category_type, capacity_per_hour, max_daily_capacity, base_price, maintenance_cost, installation_days, training_hours, estado)
    VALUES ('Cobas c311', 'c311', 'Roche', 'c311', 'Química Clínica', 100, 800, 45000.00, 5000.00, 7, 16, 'operativo');
  END IF;
END $$;

-- Ejemplo: Determinación de Glucosa para c311
INSERT INTO catalog_determinations (name, roche_code, category, equipment_id, volume_per_test, reagent_consumption, processing_time, cost_per_test, status)
SELECT 
  'Glucosa',
  'GLU',
  'Química',
  (SELECT id_equipo FROM servicio.equipos WHERE code = 'c311'),
  0.180,
  0.250,
  180,
  0.85,
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_determinations 
  WHERE equipment_id = (SELECT id_equipo FROM servicio.equipos WHERE code = 'c311') 
  AND roche_code = 'GLU'
);
*/


-- ============================================
-- FIN DEL SPRINT 1
-- ============================================

-- RESUMEN DE CAMBIOS:
-- ✅ Extendidas 3 tablas existentes (catalog_determinations, servicio.equipos, catalog_consumables)
-- ✅ Creadas 5 nuevas tablas (bc_equipment_selection, bc_determinations, bc_calculations, equipment_price_history, bc_audit_log)
-- ✅ Creada 1 función de utilidad (get_current_price)
-- ✅ Creada 1 función de trigger (bc_audit_trigger)
-- ✅ Creados triggers automáticos para auditoría
-- ✅ Creadas 2 vistas útiles
-- ✅ Insertados datos de ejemplo

-- PRÓXIMOS PASOS (Sprint 2):
-- - Implementar motor de cálculos en backend (businessCaseCalculator.service.js)
-- - Crear endpoints API para CRUD de equipos, determinaciones, consumibles
-- - Implementar función de cálculo automático que llena bc_calculations
