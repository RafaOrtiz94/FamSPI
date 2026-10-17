-- ============================================================
-- Migración: Almacenamiento de Tokens Gmail OAuth 2.0
-- ============================================================
-- Tabla para almacenar tokens de acceso de Gmail por usuario
-- Permite enviar emails desde la cuenta del usuario sin SMTP
-- ============================================================

-- Crear tabla de tokens de Gmail
CREATE TABLE IF NOT EXISTS user_gmail_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expiry_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Foreign key a la tabla users
  CONSTRAINT fk_user_gmail_tokens_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_user_gmail_tokens_user_id ON user_gmail_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gmail_tokens_email ON user_gmail_tokens(email);

-- Comentarios
COMMENT ON TABLE user_gmail_tokens IS 'Tokens OAuth 2.0 de Gmail para envío de emails por usuario';
COMMENT ON COLUMN user_gmail_tokens.access_token IS 'Token de acceso temporal de Gmail API';
COMMENT ON COLUMN user_gmail_tokens.refresh_token IS 'Token para renovar el access_token automáticamente';
COMMENT ON COLUMN user_gmail_tokens.expiry_date IS 'Fecha de expiración del access_token';
