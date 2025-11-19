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
    client_email VARCHAR(255) NOT NULL COMMENT 'Email del cliente para la autorización LOPDP',

    -- Tipo de cliente
    client_type VARCHAR(50) NOT NULL COMMENT 'persona_natural o persona_juridica',

    -- Datos Persona Jurídica
    legal_person_business_name VARCHAR(255) COMMENT 'Razón Social',
    nationality VARCHAR(100) COMMENT 'Nacionalidad de la empresa',

    -- Datos Persona Natural
    natural_person_firstname VARCHAR(255) COMMENT 'Nombres',
    natural_person_lastname VARCHAR(255) COMMENT 'Apellidos',

    -- Datos Comunes
    commercial_name VARCHAR(255) COMMENT 'Nombre Comercial',
    ruc_cedula VARCHAR(20) NOT NULL UNIQUE,

    -- Datos del Establecimiento
    establishment_province VARCHAR(100),
    establishment_city VARCHAR(100),
    establishment_address TEXT,
    establishment_reference TEXT,
    establishment_phone VARCHAR(50),
    establishment_cellphone VARCHAR(50),

    -- Datos del Domicilio (Persona Natural)
    domicile_province VARCHAR(100),
    domicile_city VARCHAR(100),
    domicile_address TEXT,
    domicile_phone_cellphone VARCHAR(50),

    -- Datos del Representante Legal (Persona Jurídica)
    legal_rep_name VARCHAR(255),
    legal_rep_position VARCHAR(100),
    legal_rep_id_document VARCHAR(20),
    legal_rep_cellphone VARCHAR(50),
    legal_rep_email VARCHAR(255),

    -- Datos de Tesorería
    treasury_name VARCHAR(255),
    treasury_email VARCHAR(255),
    treasury_conventional_phone VARCHAR(50),
    treasury_cellphone VARCHAR(50),

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

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE client_requests COMMENT 'Tabla para el flujo de creación de nuevos clientes, desde la solicitud hasta la aprobación.';