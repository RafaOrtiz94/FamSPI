/**
 * Migration: Create clients table and update client_requests
 * ----------------------------------------------------------
 * Tabla de clientes aprobados con datos encriptados
 * Actualización de solicitudes con estado de aprobación
 */

-- Tabla de clientes (solo clientes aprobados)
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    client_request_id INTEGER REFERENCES client_requests(id) ON DELETE SET NULL,
    
    -- Información básica (encriptada)
    razon_social TEXT NOT NULL, -- Encriptado
    ruc TEXT NOT NULL, -- Encriptado
    nombre_comercial TEXT, -- Encriptado
    
    -- Contacto principal (encriptado)
    contacto_nombre TEXT, -- Encriptado
    contacto_cargo TEXT,
    contacto_email TEXT, -- Encriptado
    contacto_telefono TEXT, -- Encriptado
    
    -- Dirección (encriptada)
    direccion TEXT, -- Encriptado
    ciudad TEXT,
    provincia TEXT,
    pais TEXT DEFAULT 'Ecuador',
    
    -- Información financiera (encriptada)
    nombre_banco TEXT, -- Encriptado
    tipo_cuenta TEXT,
    numero_cuenta TEXT, -- Encriptado
    
    -- Representante legal (encriptado)
    representante_nombre TEXT, -- Encriptado
    representante_cedula TEXT, -- Encriptado
    representante_email TEXT, -- Encriptado
    representante_telefono TEXT, -- Encriptado
    
    -- Consentimiento LOPDP
    consentimiento_lopdp BOOLEAN DEFAULT FALSE,
    consentimiento_email TEXT, -- Email usado para consentimiento
    consentimiento_token TEXT, -- Token de verificación
    consentimiento_verificado BOOLEAN DEFAULT FALSE,
    consentimiento_fecha TIMESTAMP,
    
    -- Metadata
    estado VARCHAR(50) DEFAULT 'activo', -- activo, inactivo, suspendido
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Índices para búsqueda rápida (hash del RUC para no exponer dato real)
    ruc_hash VARCHAR(64) UNIQUE, -- Hash SHA-256 del RUC para búsquedas
    
    CONSTRAINT unique_client_request UNIQUE (client_request_id)
);

-- Agregar columnas de aprobación a client_requests si no existen
DO $$ 
BEGIN
    -- approval_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='client_requests' AND column_name='approval_status'
    ) THEN
        ALTER TABLE client_requests ADD COLUMN approval_status VARCHAR(50) DEFAULT 'pendiente';
    END IF;
    
    -- approved_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='client_requests' AND column_name='approved_by'
    ) THEN
        ALTER TABLE client_requests ADD COLUMN approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    
    -- approved_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='client_requests' AND column_name='approved_at'
    ) THEN
        ALTER TABLE client_requests ADD COLUMN approved_at TIMESTAMP;
    END IF;
    
    -- client_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='client_requests' AND column_name='client_id'
    ) THEN
        ALTER TABLE client_requests ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
    END IF;
    
    -- user_id para tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='client_requests' AND column_name='user_id'
    ) THEN
        ALTER TABLE client_requests ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_clients_estado ON clients(estado);
CREATE INDEX IF NOT EXISTS idx_clients_ruc_hash ON clients(ruc_hash);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_requests_approval_status ON client_requests(approval_status);
CREATE INDEX IF NOT EXISTS idx_client_requests_user_id ON client_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_created_by ON client_requests(created_by);

-- Comentarios
COMMENT ON TABLE clients IS 'Clientes aprobados con datos encriptados para máxima seguridad';
COMMENT ON COLUMN clients.ruc_hash IS 'Hash SHA-256 del RUC para búsquedas sin exponer el dato real';
COMMENT ON COLUMN client_requests.approval_status IS 'Estado de aprobación: pendiente, aprobado, rechazado';
COMMENT ON COLUMN client_requests.rejection_reason IS 'Motivo del rechazo si la solicitud fue rechazada';
