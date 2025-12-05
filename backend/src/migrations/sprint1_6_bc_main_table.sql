-- ============================================
-- DECISIÓN: Usar equipment_purchase_requests como tabla principal
-- ============================================
-- Este script extiende la tabla existente para soportar:
-- 1. Business Cases modernos (nuevo sistema)
-- 2. Business Cases legacy (Google Sheets) - backward compatibility
--
-- La diferencia se marca con el campo `uses_modern_system`

-- ============================================
-- 1. EXTENDER equipment_purchase_requests
-- ============================================

-- Agregar columnas para diferenciar sistema moderno vs legacy
ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS uses_modern_system BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bc_system_type VARCHAR(50) DEFAULT 'legacy' CHECK (bc_system_type IN ('legacy', 'modern'));

-- Comentarios para claridad
COMMENT ON COLUMN equipment_purchase_requests.uses_modern_system IS 'true = usa sistema modernizado (BD), false = usa Google Sheets (legacy)';
COMMENT ON COLUMN equipment_purchase_requests.bc_system_type IS 'Tipo de sistema: legacy (Google Sheets) o modern (nuevo sistema con motor de cálculos)';

-- Agregar campo para almacenar metadata específica del sistema moderno
ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS modern_bc_metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN equipment_purchase_requests.modern_bc_metadata IS 'Metadata adicional para BCs modernos (configuraciones, flags, etc.)';

-- Índice para filtrar rápidamente por tipo de sistema
CREATE INDEX IF NOT EXISTS idx_equipment_purchase_requests_system_type 
ON equipment_purchase_requests(bc_system_type) 
WHERE bc_system_type = 'modern';

CREATE INDEX IF NOT EXISTS idx_equipment_purchase_requests_modern 
ON equipment_purchase_requests(uses_modern_system) 
WHERE uses_modern_system = true;

-- ============================================
-- 2. ACTUALIZAR FOREIGN KEYS DE TABLAS NUEVAS
-- ============================================

-- Las tablas nuevas ya tienen business_case_id UUID
-- Ahora agregamos la foreign key explícita

ALTER TABLE bc_equipment_selection
DROP CONSTRAINT IF EXISTS fk_bc_equipment_selection_bc,
ADD CONSTRAINT fk_bc_equipment_selection_bc 
  FOREIGN KEY (business_case_id) 
  REFERENCES equipment_purchase_requests(id) 
  ON DELETE CASCADE;

ALTER TABLE bc_determinations
DROP CONSTRAINT IF EXISTS fk_bc_determinations_bc,
ADD CONSTRAINT fk_bc_determinations_bc 
  FOREIGN KEY (business_case_id) 
  REFERENCES equipment_purchase_requests(id) 
  ON DELETE CASCADE;

ALTER TABLE bc_calculations
DROP CONSTRAINT IF EXISTS fk_bc_calculations_bc,
ADD CONSTRAINT fk_bc_calculations_bc 
  FOREIGN KEY (business_case_id) 
  REFERENCES equipment_purchase_requests(id) 
  ON DELETE CASCADE;

ALTER TABLE bc_audit_log
DROP CONSTRAINT IF EXISTS fk_bc_audit_log_bc,
ADD CONSTRAINT fk_bc_audit_log_bc 
  FOREIGN KEY (business_case_id) 
  REFERENCES equipment_purchase_requests(id) 
  ON DELETE CASCADE;

-- equipment_purchase_bc_items ya tiene request_id, verificar que sea FK
ALTER TABLE equipment_purchase_bc_items
DROP CONSTRAINT IF EXISTS fk_bc_items_request,
ADD CONSTRAINT fk_bc_items_request 
  FOREIGN KEY (request_id) 
  REFERENCES equipment_purchase_requests(id) 
  ON DELETE CASCADE;

-- ============================================
-- 3. CREAR VISTAS CON NOMBRES AMIGABLES
-- ============================================

-- Vista principal: Solo BCs modernos
CREATE OR REPLACE VIEW v_business_cases AS
SELECT 
  id AS business_case_id,
  client_name,
  client_id,
  status,
  bc_stage,
  bc_progress,
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
FROM equipment_purchase_requests
WHERE uses_modern_system = true 
  AND bc_system_type = 'modern';

COMMENT ON VIEW v_business_cases IS 'Vista de Business Cases que usan el sistema modernizado (no incluye legacy de Google Sheets)';

-- Vista: BCs legacy (Google Sheets)
CREATE OR REPLACE VIEW v_business_cases_legacy AS
SELECT 
  id AS business_case_id,
  client_name,
  client_id,
  status,
  bc_stage,
  bc_spreadsheet_id,
  bc_spreadsheet_url,
  assigned_to_email,
  drive_folder_id,
  created_at,
  bc_created_at
FROM equipment_purchase_requests
WHERE uses_modern_system = false 
  OR bc_system_type = 'legacy';

COMMENT ON VIEW v_business_cases_legacy IS 'Vista de Business Cases legacy (Google Sheets) - para backward compatibility';

-- Vista: BCs completos con equipo y cálculos
CREATE OR REPLACE VIEW v_business_cases_complete AS
SELECT 
  bc.id AS business_case_id,
  bc.client_name,
  bc.client_id,
  bc.status,
  bc.bc_stage,
  bc.created_at,
  bc.bc_system_type,
  
  -- Equipo seleccionado (solo para modernos)
  eq.id_equipo AS equipment_id,
  eq.code AS equipment_code,
  eq.nombre AS equipment_name,
  eq.fabricante AS manufacturer,
  
  -- Cálculos (solo para modernos)
  calc.total_monthly_tests,
  calc.total_monthly_cost,
  calc.annual_projection,
  calc.equipment_utilization_percentage,
  calc.cost_per_test,
  calc.capacity_exceeded,
  calc.underutilized,
  
  -- Contadores
  (SELECT COUNT(*) FROM bc_determinations WHERE business_case_id = bc.id) AS total_determinations,
  (SELECT COUNT(*) FROM equipment_purchase_bc_items WHERE request_id = bc.id) AS total_investments
  
FROM equipment_purchase_requests bc
LEFT JOIN bc_equipment_selection bes ON bes.business_case_id = bc.id AND bes.is_primary = true
LEFT JOIN servicio.equipos eq ON eq.id_equipo = bes.equipment_id
LEFT JOIN bc_calculations calc ON calc.business_case_id = bc.id;

COMMENT ON VIEW v_business_cases_complete IS 'Vista completa de todos los Business Cases (modernos y legacy) con detalles';

-- ============================================
-- 4. FUNCIÓN AUXILIAR: Marcar BC como moderno
-- ============================================

CREATE OR REPLACE FUNCTION mark_business_case_as_modern(p_business_case_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE equipment_purchase_requests
  SET 
    uses_modern_system = true,
    bc_system_type = 'modern',
    updated_at = now()
  WHERE id = p_business_case_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_business_case_as_modern IS 'Marca un Business Case como modernizado (ya no usa Google Sheets)';

-- ============================================
-- 5. FUNCIÓN: Migrar BC legacy a moderno
-- ============================================

CREATE OR REPLACE FUNCTION migrate_legacy_bc_to_modern(p_business_case_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_bc_exists BOOLEAN;
  v_already_modern BOOLEAN;
BEGIN
  -- Verificar que el BC existe
  SELECT EXISTS(SELECT 1 FROM equipment_purchase_requests WHERE id = p_business_case_id)
  INTO v_bc_exists;
  
  IF NOT v_bc_exists THEN
    RETURN QUERY SELECT false, 'Business Case no encontrado';
    RETURN;
  END IF;
  
  -- Verificar si ya es moderno
  SELECT uses_modern_system INTO v_already_modern
  FROM equipment_purchase_requests
  WHERE id = p_business_case_id;
  
  IF v_already_modern THEN
    RETURN QUERY SELECT false, 'Business Case ya está en sistema moderno';
    RETURN;
  END IF;
  
  -- Marcar como moderno
  UPDATE equipment_purchase_requests
  SET 
    uses_modern_system = true,
    bc_system_type = 'modern',
    bc_spreadsheet_id = NULL,  -- Ya no se usará Google Sheets
    bc_spreadsheet_url = NULL,
    modern_bc_metadata = jsonb_build_object(
      'migrated_from_legacy', true,
      'migration_date', now()
    ),
    updated_at = now()
  WHERE id = p_business_case_id;
  
  RETURN QUERY SELECT true, 'Business Case migrado exitosamente a sistema moderno';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION migrate_legacy_bc_to_modern IS 'Migra un Business Case legacy (Google Sheets) al sistema modernizado';

-- ============================================
-- 6. TRIGGER: Validar consistencia
-- ============================================

CREATE OR REPLACE FUNCTION validate_bc_system_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Si usa sistema moderno, no debe tener spreadsheet_id
  IF NEW.uses_modern_system = true AND NEW.bc_system_type = 'modern' THEN
    IF NEW.bc_spreadsheet_id IS NOT NULL THEN
      RAISE WARNING 'BC moderno no debe tener bc_spreadsheet_id, limpiando...';
      NEW.bc_spreadsheet_id := NULL;
      NEW.bc_spreadsheet_url := NULL;
    END IF;
  END IF;
  
  -- Si es legacy, debe tener spreadsheet_id (al menos para BCs creados con sheets)
  IF NEW.uses_modern_system = false AND NEW.bc_system_type = 'legacy' THEN
    -- No forzamos, pero logueamos si falta
    IF NEW.bc_spreadsheet_id IS NULL THEN
      RAISE NOTICE 'BC legacy sin bc_spreadsheet_id (puede ser intencional si es nuevo)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_bc_system ON equipment_purchase_requests;
CREATE TRIGGER trigger_validate_bc_system
  BEFORE INSERT OR UPDATE ON equipment_purchase_requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_bc_system_consistency();

-- ============================================
-- 7. DATOS DE EJEMPLO (OPCIONAL)
-- ============================================

-- Ejemplo: Crear un BC moderno de prueba
/*
INSERT INTO equipment_purchase_requests (
  client_name,
  status,
  bc_stage,
  uses_modern_system,
  bc_system_type,
  request_type,
  created_by
) VALUES (
  'Hospital de Prueba',
  'draft',
  'pending_comercial',
  true,
  'modern',
  'business_case',
  1  -- ID del usuario
) RETURNING id;
*/

-- ============================================
-- 8. CONSULTAS ÚTILES
-- ============================================

-- Ver todos los BCs modernos
-- SELECT * FROM v_business_cases;

-- Ver todos los BCs legacy
-- SELECT * FROM v_business_cases_legacy;

-- Ver todos los BCs (ambos sistemas)
-- SELECT * FROM v_business_cases_complete;

-- Contar BCs por tipo de sistema
-- SELECT 
--   bc_system_type,
--   COUNT(*) as total
-- FROM equipment_purchase_requests
-- GROUP BY bc_system_type;

-- ============================================
-- FIN DE LA CONFIGURACIÓN
-- ============================================

-- RESUMEN DE CAMBIOS:
-- ✅ equipment_purchase_requests extendido con:
--    - uses_modern_system (boolean)
--    - bc_system_type (legacy/modern)
--    - modern_bc_metadata (jsonb)
-- ✅ Foreign keys agregadas a todas las tablas nuevas
-- ✅ 3 vistas creadas:
--    - v_business_cases (solo modernos)
--    - v_business_cases_legacy (solo legacy)
--    - v_business_cases_complete (todos con detalles)
-- ✅ 2 funciones de utilidad:
--    - mark_business_case_as_modern()
--    - migrate_legacy_bc_to_modern()
-- ✅ Trigger de validación de consistencia

-- PRÓXIMOS PASOS:
-- 1. Ejecutar este script
-- 2. En el código backend, usar siempre v_business_cases para trabajar con modernos
-- 3. Los BCs legacy seguirán funcionando con el sistema antiguo
-- 4. Se pueden migrar gradualmente usando migrate_legacy_bc_to_modern()
