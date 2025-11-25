-- Migración para agregar columna client_sector a client_requests
-- Fecha: 2025-11-25

-- Agregar columna client_sector si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'client_requests' 
        AND column_name = 'client_sector'
    ) THEN
        ALTER TABLE client_requests 
        ADD COLUMN client_sector VARCHAR(20) DEFAULT 'privado';
        
        RAISE NOTICE 'Columna client_sector agregada exitosamente';
    ELSE
        RAISE NOTICE 'Columna client_sector ya existe';
    END IF;
END $$;

-- Actualizar registros existentes para que tengan el valor por defecto
UPDATE client_requests 
SET client_sector = 'privado' 
WHERE client_sector IS NULL;

-- Comentario en la columna
COMMENT ON COLUMN client_requests.client_sector IS 'Sector del cliente: publico o privado';

-- También agregar a la tabla clients
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'clients' 
        AND column_name = 'client_sector'
    ) THEN
        ALTER TABLE clients 
        ADD COLUMN client_sector VARCHAR(20) DEFAULT 'privado';
        
        RAISE NOTICE 'Columna client_sector agregada a clients exitosamente';
    ELSE
        RAISE NOTICE 'Columna client_sector ya existe en clients';
    END IF;
END $$;

UPDATE clients 
SET client_sector = 'privado' 
WHERE client_sector IS NULL;

COMMENT ON COLUMN clients.client_sector IS 'Sector del cliente: publico o privado';
