-- Migración: Solicitudes de Personal con Perfil Profesional
-- Fecha: 2025-11-27

-- Tabla principal de solicitudes de personal
CREATE TABLE IF NOT EXISTS personnel_requests (
    id SERIAL PRIMARY KEY,
    request_number VARCHAR(50) UNIQUE NOT NULL,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    
    -- Información del puesto
    position_title VARCHAR(255) NOT NULL,
    position_type VARCHAR(50) NOT NULL CHECK (position_type IN ('permanente', 'temporal', 'reemplazo', 'proyecto')),
    quantity INTEGER NOT NULL DEFAULT 1,
    start_date DATE,
    end_date DATE, -- Solo para temporales
    
    -- Perfil profesional
    education_level VARCHAR(100) NOT NULL,
    career_field VARCHAR(255),
    years_experience INTEGER,
    specific_skills TEXT,
    technical_knowledge TEXT,
    soft_skills TEXT,
    certifications TEXT,
    languages TEXT,
    
    -- Responsabilidades y funciones
    main_responsibilities TEXT NOT NULL,
    specific_functions TEXT,
    reports_to VARCHAR(255),
    supervises VARCHAR(255),
    
    -- Condiciones laborales
    work_schedule VARCHAR(100),
    salary_range VARCHAR(100),
    benefits TEXT,
    work_location VARCHAR(255),
    
    -- Justificación
    justification TEXT NOT NULL,
    urgency_level VARCHAR(50) DEFAULT 'normal' CHECK (urgency_level IN ('baja', 'normal', 'alta', 'urgente')),
    
    -- Estado y seguimiento
    status VARCHAR(50) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_revision', 'aprobada', 'rechazada', 'en_proceso', 'completada', 'cancelada')),
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    
    -- Aprobaciones
    approved_by_manager INTEGER REFERENCES users(id),
    approved_by_hr INTEGER REFERENCES users(id),
    approved_by_finance INTEGER REFERENCES users(id),
    manager_approval_date TIMESTAMP,
    hr_approval_date TIMESTAMP,
    finance_approval_date TIMESTAMP,
    
    -- Notas y comentarios
    manager_notes TEXT,
    hr_notes TEXT,
    rejection_reason TEXT,
    
    -- Archivos adjuntos (Drive)
    drive_folder_id VARCHAR(255),
    job_description_file_id VARCHAR(255),
    
    -- Auditoría
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Tabla de historial de cambios de estado
CREATE TABLE IF NOT EXISTS personnel_request_history (
    id SERIAL PRIMARY KEY,
    personnel_request_id INTEGER NOT NULL REFERENCES personnel_requests(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de comentarios/notas
CREATE TABLE IF NOT EXISTS personnel_request_comments (
    id SERIAL PRIMARY KEY,
    personnel_request_id INTEGER NOT NULL REFERENCES personnel_requests(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_personnel_requests_requester ON personnel_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_personnel_requests_department ON personnel_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_personnel_requests_status ON personnel_requests(status);
CREATE INDEX IF NOT EXISTS idx_personnel_requests_created_at ON personnel_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_personnel_request_history_request ON personnel_request_history(personnel_request_id);
CREATE INDEX IF NOT EXISTS idx_personnel_request_comments_request ON personnel_request_comments(personnel_request_id);

-- Función para generar número de solicitud
CREATE OR REPLACE FUNCTION generate_personnel_request_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.request_number := 'SP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEW.id::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar número de solicitud automáticamente
DROP TRIGGER IF EXISTS trg_generate_personnel_request_number ON personnel_requests;
CREATE TRIGGER trg_generate_personnel_request_number
    BEFORE INSERT ON personnel_requests
    FOR EACH ROW
    EXECUTE FUNCTION generate_personnel_request_number();

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_personnel_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar timestamp
DROP TRIGGER IF EXISTS trg_update_personnel_request_timestamp ON personnel_requests;
CREATE TRIGGER trg_update_personnel_request_timestamp
    BEFORE UPDATE ON personnel_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_personnel_request_timestamp();

-- Trigger para registrar cambios de estado
CREATE OR REPLACE FUNCTION log_personnel_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO personnel_request_history (
            personnel_request_id,
            previous_status,
            new_status,
            changed_by
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            NEW.approved_by_hr -- Esto debería ser el usuario actual, ajustar según contexto
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_personnel_request_status_change ON personnel_requests;
CREATE TRIGGER trg_log_personnel_request_status_change
    AFTER UPDATE ON personnel_requests
    FOR EACH ROW
    EXECUTE FUNCTION log_personnel_request_status_change();

-- Comentarios en las tablas
COMMENT ON TABLE personnel_requests IS 'Solicitudes de personal con perfil profesional completo';
COMMENT ON COLUMN personnel_requests.position_type IS 'Tipo de contratación: permanente, temporal, reemplazo, proyecto';
COMMENT ON COLUMN personnel_requests.urgency_level IS 'Nivel de urgencia: baja, normal, alta, urgente';
COMMENT ON COLUMN personnel_requests.status IS 'Estado: pendiente, en_revision, aprobada, rechazada, en_proceso, completada, cancelada';
