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
    lopdp_consent_method VARCHAR(50) COMMENT 'Método real utilizado para registrar el consentimiento',
    lopdp_consent_details TEXT COMMENT 'Notas auditables del consentimiento',
    lopdp_consent_at DATETIME NULL COMMENT 'Fecha de aceptación',
    lopdp_consent_ip VARCHAR(64) COMMENT 'IP desde donde se otorgó el consentimiento',
    lopdp_consent_user_agent TEXT COMMENT 'User agent del cliente al aceptar',
    client_email VARCHAR(255) NOT NULL COMMENT 'Email del cliente para la autorización LOPDP',

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