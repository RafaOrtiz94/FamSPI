-- Tabla para gestionar las solicitudes de creación de nuevos clientes
CREATE TABLE client_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Datos del solicitante y estado
    created_by VARCHAR(255) NOT NULL COMMENT 'Email del asesor que realiza la solicitud',
    status VARCHAR(50) NOT NULL DEFAULT 'pending_consent' COMMENT 'Estado de la solicitud: pending_consent, pending_approval, approved, rejected',
    rejection_reason TEXT COMMENT 'Motivo del rechazo',

    -- LOPDP (Protección de datos)
    lopdp_token VARCHAR(255) UNIQUE,
    lopdp_consent_status VARCHAR(50) NOT NULL DEFAULT 'pending' COMMENT 'pending, granted',
    consent_capture_method VARCHAR(50) NOT NULL DEFAULT 'email_link' COMMENT 'email_link, signed_document, other',
    consent_capture_details TEXT COMMENT 'Notas de cómo se obtuvo o se obtendrá el consentimiento',
    consent_email_token_id VARCHAR(64) COMMENT 'ID del token OTP verificado previo al registro',
    lopdp_consent_method VARCHAR(50) COMMENT 'Método real utilizado para registrar el consentimiento',
    lopdp_consent_details TEXT COMMENT 'Notas auditables del consentimiento',
    lopdp_consent_at DATETIME NULL COMMENT 'Fecha de aceptación',
    lopdp_consent_ip VARCHAR(64) COMMENT 'IP desde donde se otorgó el consentimiento',
    lopdp_consent_user_agent TEXT COMMENT 'User agent del cliente al aceptar',
    client_email VARCHAR(255) NOT NULL COMMENT 'Email de contacto del cliente',
    consent_recipient_email VARCHAR(255) NOT NULL COMMENT 'Correo al que se envía el código de consentimiento',

    -- Tipo de cliente
    client_type VARCHAR(50) NOT NULL COMMENT 'persona_natural o persona_juridica',
    data_processing_consent TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Aceptación interna del tratamiento de datos',

    -- Datos Persona Jurídica
    legal_person_business_name VARCHAR(255) COMMENT 'Razón Social',
    nationality VARCHAR(100) COMMENT 'Nacionalidad de la empresa',

    -- Datos Persona Natural
    natural_person_firstname VARCHAR(255) COMMENT 'Nombres',
    natural_person_lastname VARCHAR(255) COMMENT 'Apellidos',

    -- Datos Comunes
    commercial_name VARCHAR(255) COMMENT 'Nombre Comercial',
    establishment_name VARCHAR(255) COMMENT 'Nombre del Establecimiento',
    ruc_cedula VARCHAR(20) NOT NULL UNIQUE,

    -- Datos del Establecimiento
    establishment_province VARCHAR(100),
    establishment_city VARCHAR(100),
    establishment_address TEXT,
    establishment_reference TEXT,
    establishment_phone VARCHAR(50),
    establishment_cellphone VARCHAR(50),

    -- Datos del Representante Legal (Persona Jurídica)
    legal_rep_name VARCHAR(255),
    legal_rep_position VARCHAR(100),
    legal_rep_id_document VARCHAR(20),
    legal_rep_cellphone VARCHAR(50),
    legal_rep_email VARCHAR(255),

    -- Datos de Envío de Mercadería
    shipping_contact_name VARCHAR(255),
    shipping_address TEXT,
    shipping_city VARCHAR(100),
    shipping_province VARCHAR(100),
    shipping_reference TEXT,
    shipping_phone VARCHAR(50),
    shipping_cellphone VARCHAR(50),
    shipping_delivery_hours VARCHAR(255),

    -- Documentos y Permisos
    operating_permit_status VARCHAR(50) COMMENT 'has_it, in_progress, does_not_have_it',
    
    -- Integración con Google Drive
    drive_folder_id VARCHAR(255),
    legal_rep_appointment_file_id VARCHAR(255),
    ruc_file_id VARCHAR(255),
    id_file_id VARCHAR(255),
    operating_permit_file_id VARCHAR(255),
    consent_evidence_file_id VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE client_requests COMMENT 'Tabla para el flujo de creación de nuevos clientes, desde la solicitud hasta la aprobación.';

CREATE TABLE client_request_consents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_request_id INT NOT NULL,
    event_type VARCHAR(50) NOT NULL COMMENT 'request_sent, granted, revoked',
    method VARCHAR(50) NOT NULL COMMENT 'email_link, signed_document, other',
    details TEXT,
    evidence_file_id VARCHAR(255),
    actor_email VARCHAR(255),
    actor_role VARCHAR(100),
    actor_name VARCHAR(255),
    ip VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_request_id) REFERENCES client_requests(id) ON DELETE CASCADE
);

ALTER TABLE client_request_consents COMMENT 'Eventos auditables asociados a la aceptación de tratamiento de datos (LOPDP).';

CREATE TABLE client_request_consent_tokens (
    id VARCHAR(64) PRIMARY KEY,
    client_email VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    code_hash VARCHAR(255) NOT NULL,
    code_last_four VARCHAR(4),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' COMMENT 'pending, verified, used, expired',
    attempts INT NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    verified_at DATETIME NULL,
    verified_by_email VARCHAR(255),
    verified_by_user_id INT,
    created_by_email VARCHAR(255),
    created_by_user_id INT,
    used_at DATETIME NULL,
    used_request_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_consent_token_request FOREIGN KEY (used_request_id) REFERENCES client_requests(id) ON DELETE SET NULL
);

ALTER TABLE client_request_consent_tokens COMMENT 'Tokens temporales enviados por correo para confirmar el consentimiento LOPDP.';

-- =============================================================
--  LOPDP interno (colaboradores)
-- =============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS lopdp_internal_status VARCHAR(50) NOT NULL DEFAULT 'granted',
  ADD COLUMN IF NOT EXISTS lopdp_internal_signed_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS lopdp_internal_pdf_file_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS lopdp_internal_signature_file_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS lopdp_internal_ip VARCHAR(64),
  ADD COLUMN IF NOT EXISTS lopdp_internal_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS lopdp_internal_notes TEXT;

CREATE TABLE IF NOT EXISTS user_lopdp_consents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    user_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    base_folder_id VARCHAR(255),
    person_folder_id VARCHAR(255),
    signed_folder_id VARCHAR(255),
    pdf_file_id VARCHAR(255),
    signature_file_id VARCHAR(255),
    ip VARCHAR(64),
    user_agent TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE user_lopdp_consents COMMENT 'Evidencias internas de aceptación de LOPDP por colaboradores.';