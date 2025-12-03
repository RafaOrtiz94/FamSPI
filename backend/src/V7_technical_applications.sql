-- =====================================================
-- Migration: Technical Applications Documents
-- Version: V7
-- Description: Tabla para almacenar documentos técnicos
--              generados por el área de Servicio Técnico
-- =====================================================

BEGIN;

-- 1. Crear tabla de documentos técnicos
CREATE TABLE IF NOT EXISTS technical_documents (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(100) NOT NULL,
    document_code VARCHAR(50) NOT NULL, -- Ej: F.ST-02
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    user_email VARCHAR(255), -- Cache del email para auditoría
    user_name VARCHAR(255), -- Cache del nombre para auditoría
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Datos del formulario (JSON flexible)
    form_data JSONB NOT NULL,
    
    -- Referencias a archivos
    file_name VARCHAR(500),
    file_path TEXT,
    drive_file_id VARCHAR(255),
    drive_folder_id VARCHAR(255),
    
    -- Metadata para facilitar búsquedas
    equipment_name VARCHAR(255),
    equipment_serial VARCHAR(100),
    status VARCHAR(50) DEFAULT 'generated',
    notes TEXT,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Índices para optimizar consultas
CREATE INDEX idx_tech_docs_type ON technical_documents(document_type);
CREATE INDEX idx_tech_docs_user ON technical_documents(user_id);
CREATE INDEX idx_tech_docs_created ON technical_documents(created_at DESC);
CREATE INDEX idx_tech_docs_equipment ON technical_documents(equipment_name);
CREATE INDEX idx_tech_docs_serial ON technical_documents(equipment_serial);

-- 3. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_tech_docs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tech_docs_updated_at
BEFORE UPDATE ON technical_documents
FOR EACH ROW
EXECUTE FUNCTION update_tech_docs_timestamp();

-- 4. Comentarios para documentación
COMMENT ON TABLE technical_documents IS 'Registro de documentos técnicos generados por el área de Servicio Técnico';
COMMENT ON COLUMN technical_documents.document_type IS 'Tipo de documento: DISINFECTION, TRAINING_ATTENDANCE, etc.';
COMMENT ON COLUMN technical_documents.document_code IS 'Código del formato (Ej: F.ST-02, F.ST-05)';
COMMENT ON COLUMN technical_documents.form_data IS 'Datos del formulario en formato JSON';
COMMENT ON COLUMN technical_documents.drive_file_id IS 'ID del archivo en Google Drive';

COMMIT;
