-- =====================================================
-- Business Case Vivo - FIX: Usar servicio.equipos
-- Versión: V6b (corrección)
-- Fecha: 2025-12-02
-- Descripción: Elimina catalog_equipment y usa servicio.equipos
-- =====================================================

-- =====================================================
-- 1. ELIMINAR catalog_equipment (tabla incorrecta)
-- =====================================================

DROP TABLE IF EXISTS catalog_equipment CASCADE;

-- =====================================================
-- 2. LIMPIAR DATOS DE SEED INCORRECTOS
-- =====================================================

-- Eliminar datos de ejemplo que insertamos en V6
-- Estos hacen referencia a equipment_id que no existen en servicio.equipos
DELETE FROM catalog_equipment_consumables;
DELETE FROM catalog_determinations;
DELETE FROM catalog_consumables WHERE id IN (1,2,3,4,5,6,7);

-- =====================================================
-- 3. MODIFICAR catalog_determinations para usar servicio.equipos
-- =====================================================

-- Eliminar constraint anterior si existe
ALTER TABLE catalog_determinations 
DROP CONSTRAINT IF EXISTS catalog_determinations_equipment_id_fkey;

-- Cambiar tipo de columna equipment_id para que coincida con servicio.equipos.id_equipo (INTEGER)
ALTER TABLE catalog_determinations 
ALTER COLUMN equipment_id TYPE INTEGER;

-- Crear nueva foreign key hacia servicio.equipos
ALTER TABLE catalog_determinations
ADD CONSTRAINT catalog_determinations_equipment_id_fkey 
FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo) ON DELETE SET NULL;

-- =====================================================
-- 4. MODIFICAR catalog_equipment_consumables
-- =====================================================

-- Eliminar constraint anterior
ALTER TABLE catalog_equipment_consumables
DROP CONSTRAINT IF EXISTS catalog_equipment_consumables_equipment_id_fkey;

-- Cambiar tipo de equipment_id
ALTER TABLE catalog_equipment_consumables
ALTER COLUMN equipment_id TYPE INTEGER;

-- Crear nueva foreign key
ALTER TABLE catalog_equipment_consumables
ADD CONSTRAINT catalog_equipment_consumables_equipment_id_fkey
FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;

-- =====================================================
-- 5. ACTUALIZAR VISTA v_equipment_determinations
-- =====================================================

DROP VIEW IF EXISTS v_equipment_determinations;

CREATE OR REPLACE VIEW v_equipment_determinations AS
SELECT 
    e.id_equipo AS equipment_id,
    e.nombre AS equipment_name,
    e.modelo AS model,
    e.fabricante AS manufacturer,
    d.id AS determination_id,
    d.name AS determination_name,
    d.roche_code,
    d.category,
    d.version AS determination_version,
    d.status AS determination_status
FROM servicio.equipos e
LEFT JOIN catalog_determinations d ON d.equipment_id = e.id_equipo
ORDER BY e.nombre, d.name;

COMMENT ON VIEW v_equipment_determinations IS 'Vista de equipos (servicio.equipos) con sus determinaciones';

-- =====================================================
-- 6. DATOS CORRECTOS (OPCIONAL)
-- =====================================================

-- Si servicio.equipos tiene equipos, puedes crear determinaciones para ellos
-- Ejemplo (ajusta los IDs según tus equipos reales):
/*
INSERT INTO catalog_determinations (name, roche_code, category, equipment_id, version, status) 
SELECT 
    'TSH', 'TSH-001', 'Hormonas', id_equipo, 'V1', 'active'
FROM servicio.equipos 
WHERE nombre ILIKE '%cobas%' 
LIMIT 1
ON CONFLICT DO NOTHING;
*/

-- =====================================================
-- 7. VERIFICACIÓN
-- =====================================================

SELECT 'V6b migration completed - catalog_equipment eliminada, usando servicio.equipos' AS status;

-- Ver equipos disponibles
SELECT id_equipo, nombre, modelo, fabricante FROM servicio.equipos LIMIT 5;

-- Verificar estructura
SELECT 
    'Determinaciones' AS tabla,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'catalog_determinations' AND column_name = 'equipment_id';
