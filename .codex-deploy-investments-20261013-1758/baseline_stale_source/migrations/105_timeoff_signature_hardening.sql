-- Migration: 105_timeoff_signature_hardening.sql
-- Description:
--   - Endurece trazabilidad legal de permisos/vacaciones
--   - Firma workflow append-only con "is_current"
--   - Índices operativos para consultas/auditoría
--   - Token público de verificación legal por solicitud
-- Date: 2026-02-20

BEGIN;

-- ============================================================================
-- PERMISOS: HARDENING DE FIRMAS
-- ============================================================================

ALTER TABLE permisos_vacaciones_firmas
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE permisos_vacaciones_firmas
  DROP CONSTRAINT IF EXISTS permisos_vacaciones_firmas_unique_stage;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY solicitud_id, stage
      ORDER BY signed_at DESC, id DESC
    ) AS rn
  FROM permisos_vacaciones_firmas
)
UPDATE permisos_vacaciones_firmas f
SET is_current = (ranked.rn = 1)
FROM ranked
WHERE ranked.id = f.id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_permisos_firmas_current_stage
  ON permisos_vacaciones_firmas (solicitud_id, stage)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_permisos_firmas_solicitud_signed_at
  ON permisos_vacaciones_firmas (solicitud_id, signed_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_permisos_firmas_signer_user
  ON permisos_vacaciones_firmas (signer_user_id, signed_at DESC);

CREATE INDEX IF NOT EXISTS idx_permisos_firmas_stage
  ON permisos_vacaciones_firmas (stage, signed_at DESC);

ALTER TABLE permisos_vacaciones
  ADD COLUMN IF NOT EXISTS legal_verification_token TEXT,
  ADD COLUMN IF NOT EXISTS legal_verification_created_at TIMESTAMPTZ;

UPDATE permisos_vacaciones
SET
  legal_verification_token = md5(random()::text || clock_timestamp()::text || id::text),
  legal_verification_created_at = COALESCE(legal_verification_created_at, NOW())
WHERE status = 'approved'
  AND legal_verification_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_permisos_legal_verification_token
  ON permisos_vacaciones (legal_verification_token)
  WHERE legal_verification_token IS NOT NULL;

-- ============================================================================
-- VACACIONES: FIRMA WORKFLOW Y TOKEN LEGAL
-- ============================================================================

ALTER TABLE vacaciones_solicitudes
  ADD COLUMN IF NOT EXISTS pdf_validacion_legal_url TEXT,
  ADD COLUMN IF NOT EXISTS legal_verification_token TEXT,
  ADD COLUMN IF NOT EXISTS legal_verification_created_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vacaciones_legal_verification_token
  ON vacaciones_solicitudes (legal_verification_token)
  WHERE legal_verification_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS vacaciones_solicitudes_firmas (
  id BIGSERIAL PRIMARY KEY,
  solicitud_id BIGINT NOT NULL REFERENCES vacaciones_solicitudes(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  signer_user_id INTEGER NOT NULL REFERENCES users(id),
  signer_email TEXT,
  signer_name TEXT NOT NULL,
  signer_role TEXT,
  signature_type TEXT NOT NULL DEFAULT 'advanced_electronic',
  auth_method TEXT NOT NULL DEFAULT 'oauth_corporate',
  consent_text TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  payload_hash_sha256 VARCHAR(64) NOT NULL,
  previous_signature_hash_sha256 VARCHAR(64),
  signature_hash_sha256 VARCHAR(64) NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT true,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vacaciones_firmas_stage_check
    CHECK (stage IN ('solicitud', 'aprobacion_final', 'rechazo')),
  CONSTRAINT vacaciones_firmas_payload_hash_check
    CHECK (payload_hash_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT vacaciones_firmas_signature_hash_check
    CHECK (signature_hash_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT vacaciones_firmas_prev_hash_check
    CHECK (previous_signature_hash_sha256 IS NULL OR previous_signature_hash_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_vacaciones_firmas_current_stage
  ON vacaciones_solicitudes_firmas (solicitud_id, stage)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_vacaciones_firmas_solicitud_signed_at
  ON vacaciones_solicitudes_firmas (solicitud_id, signed_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_vacaciones_firmas_signer_user
  ON vacaciones_solicitudes_firmas (signer_user_id, signed_at DESC);

UPDATE vacaciones_solicitudes
SET
  legal_verification_token = md5(random()::text || clock_timestamp()::text || id::text),
  legal_verification_created_at = COALESCE(legal_verification_created_at, NOW())
WHERE LOWER(COALESCE(status, '')) IN ('aprobado', 'approved')
  AND legal_verification_token IS NULL;

COMMIT;
