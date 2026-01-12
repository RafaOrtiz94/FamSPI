-- Migración para agregar columna equipment_type a equipment_purchase_requests
-- Fecha: 2025-11-25

-- Agregar columna equipment_type si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'equipment_purchase_requests' 
        AND column_name = 'equipment_type'
    ) THEN
        ALTER TABLE equipment_purchase_requests 
        ADD COLUMN equipment_type TEXT DEFAULT 'new';
        
        RAISE NOTICE 'Columna equipment_type agregada exitosamente';
    ELSE
        RAISE NOTICE 'Columna equipment_type ya existe';
    END IF;
END $$;

-- Actualizar registros existentes para que tengan el valor por defecto
UPDATE equipment_purchase_requests 
SET equipment_type = 'new' 
WHERE equipment_type IS NULL;

-- Comentario en la columna
COMMENT ON COLUMN equipment_purchase_requests.equipment_type IS 'Tipo de equipo solicitado: new (nuevo) o cu (usado/reacondicionado)';
